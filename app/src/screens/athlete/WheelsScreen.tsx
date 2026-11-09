/**
 * WheelsScreen — the botsjef's wheels. Pick one, then either hand it to
 * players or spin it yourself to try it.
 *
 * Two pages that slide, like GiveFineScreen: the wheels, then (after
 * "Gi til spillere") the squad by squad number. A spin given to a player waits
 * for them on their Fines tab.
 *
 * PROTOTYPE: wheels and spins are in memory only — see `useWheels`. The squad
 * list is real (read-only).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import PressableScale from '../../components/ui/PressableScale';
import haptics from '../../utils/haptics';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import WheelGraphic from '../../components/athlete/WheelGraphic';
import { useWheels, assignSpin, type Wheel } from '../../components/athlete/useWheels';
import { SURFACE, TEXT, RADIUS } from '../../utils/tokens';
import { DISPLAY_FONT, UI_FONT, UI_FONT_REGULAR } from '../../utils/type';
import type { AthleteStackParamList } from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<AthleteStackParamList, 'Wheels'>;
type Player = { id: string; name: string; number: number | null };

const SLIDE = { duration: 320, easing: Easing.bezier(0.22, 1, 0.36, 1) };
const PAD = 8;

export default function WheelsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { profile } = useAuth();
  const { wheels, pending } = useWheels();

  const [players, setPlayers] = useState<Player[] | null>(null);
  const [giving, setGiving] = useState<Wheel | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const step = useSharedValue(0);

  useEffect(() => {
    if (!profile?.club_id) return;
    supabase.from('profiles').select('id, full_name, squad_number')
      .eq('club_id', profile.club_id).eq('role', 'athlete').is('removed_at', null)
      .then(({ data }) => {
        type Row = { id: string; full_name: string | null; squad_number: number | null };
        setPlayers(((data ?? []) as Row[])
          .map(p => ({ id: p.id, name: p.full_name ?? 'Unknown', number: p.squad_number }))
          .sort((a, b) =>
            a.number !== null && b.number !== null ? a.number - b.number
            : a.number !== null ? -1 : b.number !== null ? 1 : a.name.localeCompare(b.name)));
      });
  }, [profile?.club_id]);

  const pages = useAnimatedStyle(() => ({ transform: [{ translateX: -step.value * width }] }));

  const openGive = (w: Wheel) => {
    haptics.selection();
    setGiving(w);
    setPicked(new Set());
    step.value = withTiming(1, SLIDE);
  };
  const back = () => { step.value = withTiming(0, SLIDE); };

  const toggle = (id: string) => {
    haptics.selection();
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const give = () => {
    if (!giving || picked.size === 0 || !players) return;
    assignSpin(giving.id, players.filter(p => picked.has(p.id)));
    haptics.success();
    navigation.goBack();
  };

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.pages, { width: width * 2 }, pages]}>

        {/* ── Page 1: the wheels ── */}
        <View style={{ width }}>
          <Header title={t('wheel.title')} subtitle={t('wheel.subtitle')} onClose={() => navigation.goBack()} />
          <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 90 }]} showsVerticalScrollIndicator={false}>
            {wheels.map(w => {
              const waiting = pending.filter(p => p.wheelId === w.id);
              return (
                <View key={w.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <WheelGraphic items={w.items} size={64} labels={false} />
                    <View style={styles.cardText}>
                      <Text style={styles.kind}>{w.kind === 'reward' ? t('wheel.reward') : t('wheel.forfeit')}</Text>
                      <Text style={styles.name} numberOfLines={1}>{w.name}</Text>
                      <Text style={styles.items} numberOfLines={2}>{w.items.join('  ·  ')}</Text>
                    </View>
                  </View>
                  {waiting.length > 0 && (
                    <Text style={styles.waiting} numberOfLines={1}>
                      {t('wheel.waiting', { names: waiting.map(p => p.athleteName.split(' ')[0]).join(', ') })}
                    </Text>
                  )}
                  <View style={styles.actions}>
                    <PressableScale style={[styles.btn, styles.btnQuiet]} scaleTo={0.95}
                      onPress={() => navigation.navigate('WheelEditor', { wheelId: w.id })}>
                      <Text style={styles.btnQuietText}>{t('wheel.edit')}</Text>
                    </PressableScale>
                    <PressableScale style={[styles.btn, styles.btnQuiet]} scaleTo={0.95}
                      onPress={() => navigation.navigate('SpinWheel', { wheelId: w.id })}>
                      <Text style={styles.btnQuietText}>{t('wheel.try')}</Text>
                    </PressableScale>
                    <PressableScale style={[styles.btn, styles.btnMain]} scaleTo={0.95} haptic="none" onPress={() => openGive(w)}>
                      <Text style={styles.btnMainText}>{t('wheel.give')}</Text>
                    </PressableScale>
                  </View>
                </View>
              );
            })}
          </ScrollView>
          <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
            <PressableScale style={styles.primary} scaleTo={0.97} onPress={() => navigation.navigate('WheelEditor', {})}>
              <Text style={styles.primaryText}>{t('wheel.new')}</Text>
            </PressableScale>
          </View>
        </View>

        {/* ── Page 2: who gets it ── */}
        <View style={{ width }}>
          <Header
            title={giving?.name ?? ''}
            subtitle={t('wheel.whoSpins')}
            onBack={back}
            onClose={() => navigation.goBack()}
          />
          <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 90 }]} showsVerticalScrollIndicator={false}>
            {(players ?? []).map(p => {
              const on = picked.has(p.id);
              return (
                <PressableScale key={p.id} style={[styles.player, on && styles.playerOn]} scaleTo={0.98} haptic="none" onPress={() => toggle(p.id)}>
                  <Text style={[styles.number, on && styles.onText]}>{p.number ?? '–'}</Text>
                  <Text style={[styles.playerName, on && styles.onText]} numberOfLines={1}>{p.name}</Text>
                  {on && <Ionicons name="checkmark" size={18} color={SURFACE.base} />}
                </PressableScale>
              );
            })}
          </ScrollView>
          <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
            <PressableScale style={[styles.primary, picked.size === 0 && styles.disabled]} scaleTo={0.97} haptic="none" onPress={give}>
              <Text style={styles.primaryText}>
                {picked.size === 0 ? t('wheel.pickPlayers') : t('wheel.giveTo', { count: picked.size })}
              </Text>
            </PressableScale>
          </View>
        </View>

      </Animated.View>
    </View>
  );
}

function Header({ title, subtitle, onClose, onBack }: { title: string; subtitle: string; onClose: () => void; onBack?: () => void }) {
  return (
    <View style={styles.header}>
      {onBack && (
        <PressableScale style={styles.close} scaleTo={0.9} onPress={onBack}>
          <Ionicons name="chevron-back" size={18} color={TEXT.secondary} />
        </PressableScale>
      )}
      <View style={styles.headerText}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
      </View>
      <PressableScale style={styles.close} scaleTo={0.9} onPress={onClose}>
        <Ionicons name="close" size={18} color={TEXT.secondary} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SURFACE.base, overflow: 'hidden' },
  pages: { flex: 1, flexDirection: 'row' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingLeft: 24, paddingRight: 16, paddingTop: 22, paddingBottom: 14,
  },
  headerText: { flex: 1 },
  title: { fontFamily: DISPLAY_FONT, fontSize: 24, color: TEXT.primary, letterSpacing: -0.6 },
  subtitle: { fontFamily: UI_FONT_REGULAR, fontSize: 14, color: TEXT.secondary, marginTop: 2 },
  close: {
    width: 32, height: 32, borderRadius: RADIUS.pill, backgroundColor: SURFACE.raised,
    alignItems: 'center', justifyContent: 'center',
  },

  list: { paddingHorizontal: PAD, gap: 8 },
  card: { borderRadius: RADIUS.lg, backgroundColor: SURFACE.raised, padding: 16 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cardText: { flex: 1, minWidth: 0 },
  kind: { fontFamily: UI_FONT, fontSize: 11, letterSpacing: 1.1, color: TEXT.tertiary, textTransform: 'uppercase' },
  name: { fontFamily: DISPLAY_FONT, fontSize: 19, color: TEXT.primary, marginTop: 2, letterSpacing: -0.3 },
  items: { fontFamily: UI_FONT_REGULAR, fontSize: 13, color: TEXT.secondary, marginTop: 3, lineHeight: 18 },
  waiting: { fontFamily: UI_FONT_REGULAR, fontSize: 13, color: TEXT.tertiary, marginTop: 12 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  btn: { height: 38, borderRadius: RADIUS.pill, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  btnQuiet: { backgroundColor: SURFACE.active },
  btnQuietText: { fontFamily: UI_FONT, fontSize: 14, color: TEXT.primary },
  btnMain: { flex: 1, backgroundColor: TEXT.primary },
  btnMainText: { fontFamily: UI_FONT, fontSize: 14, color: SURFACE.base },

  player: {
    flexDirection: 'row', alignItems: 'center', gap: 14, height: 56, paddingHorizontal: 18,
    borderRadius: RADIUS.md, backgroundColor: SURFACE.raised,
  },
  playerOn: { backgroundColor: TEXT.primary },
  number: { width: 26, fontFamily: UI_FONT, fontSize: 15, color: TEXT.tertiary },
  playerName: { flex: 1, fontFamily: UI_FONT, fontSize: 16, color: TEXT.primary },
  onText: { color: SURFACE.base },

  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: PAD, paddingTop: 10, backgroundColor: SURFACE.base },
  primary: { height: 54, borderRadius: RADIUS.pill, backgroundColor: TEXT.primary, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: UI_FONT, fontSize: 16, color: SURFACE.base },
  disabled: { opacity: 0.4 },
});
