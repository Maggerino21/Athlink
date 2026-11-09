/**
 * SpinWheelScreen — one spin of one wheel.
 *
 * Opened two ways: by a player whose name the botsjef put on a wheel (with a
 * `spinId`, used up when it lands), or by the botsjef trying a wheel out
 * (no `spinId`, nothing is used up).
 *
 * The spin runs on the UI thread: one `withTiming` over ~4.5s, easing out like
 * a real wheel losing speed, with a tick of haptics each time a segment passes
 * the pointer — that tick is most of what makes it feel like a wheel rather
 * than an animation.
 *
 * PROTOTYPE: the outcome is picked here, on the phone. See `useWheels`.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing, runOnJS,
  useAnimatedReaction, FadeIn, FadeInDown,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import PressableScale from '../../components/ui/PressableScale';
import haptics from '../../utils/haptics';
import { useAuth } from '../../context/AuthContext';
import WheelGraphic, { itemColor } from '../../components/athlete/WheelGraphic';
import { useWheels, wheelSegments, completeSpin } from '../../components/athlete/useWheels';
import { SURFACE, TEXT, RADIUS } from '../../utils/tokens';
import { DISPLAY_FONT, UI_FONT, UI_FONT_REGULAR, LIGHT_FONT } from '../../utils/type';
import type { AthleteStackParamList } from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<AthleteStackParamList, 'SpinWheel'>;

const SPIN_MS = 4600;
const TURNS = 6;

export default function SpinWheelScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { profile } = useAuth();
  const { wheels, pending } = useWheels();

  const { wheelId, spinId } = route.params;
  const wheel = wheels.find(w => w.id === wheelId);
  const spin = spinId ? pending.find(p => p.id === spinId) : undefined;
  const who = spin?.athleteName ?? profile?.full_name ?? '';

  const [phase, setPhase] = useState<'ready' | 'spinning' | 'done'>('ready');
  const [landed, setLanded] = useState<{ label: string; itemIndex: number } | null>(null);

  const rotation = useSharedValue(0);
  const size = Math.min(width - 40, 380);
  const segCount = wheel ? wheel.items.length * 2 : 1;
  const segDeg = 360 / segCount;

  // A tick each time a new segment comes under the pointer.
  useAnimatedReaction(
    () => Math.floor((((360 - (rotation.value % 360)) % 360)) / segDeg),
    (now, prev) => {
      if (prev !== null && now !== prev) runOnJS(haptics.selection)();
    },
  );

  const wheelStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  if (!wheel) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.subtitle}>{t('wheel.gone')}</Text>
      </View>
    );
  }

  const segs = wheelSegments(wheel.items);

  const land = (index: number) => {
    const s = segs[index];
    setLanded(s);
    setPhase('done');
    haptics.success();
    completeSpin(spinId ?? null, wheel, who, s.label);
  };

  const go = () => {
    if (phase !== 'ready') return;
    haptics.medium();
    setPhase('spinning');
    const index = Math.floor(Math.random() * segs.length);
    // Somewhere inside the segment, never on a line, so nobody argues the call.
    const within = segDeg * (0.2 + Math.random() * 0.6);
    // Segment i sits at [i·seg, (i+1)·seg) clockwise from the top; turning the
    // wheel by r brings angle (360 − r) under the pointer.
    const target = 360 - (index * segDeg + within);
    rotation.value = withTiming(
      TURNS * 360 + target,
      { duration: SPIN_MS, easing: Easing.out(Easing.cubic) },
      done => { if (done) runOnJS(land)(index); },
    );
  };

  const kindLabel = wheel.kind === 'reward' ? t('wheel.reward') : t('wheel.forfeit');

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{wheel.name}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {spin ? t('wheel.yourSpin', { kind: kindLabel.toLowerCase() }) : t('wheel.tryOut')}
          </Text>
        </View>
        {phase !== 'spinning' && (
          <PressableScale style={styles.close} scaleTo={0.9} onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={18} color={TEXT.secondary} />
          </PressableScale>
        )}
      </View>

      <View style={styles.stage}>
        {/* The pointer: a plain notch at twelve o'clock. */}
        <View style={styles.pointer} />
        <Animated.View style={[{ width: size, height: size }, wheelStyle]}>
          <WheelGraphic items={wheel.items} size={size} />
        </Animated.View>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
        {phase === 'done' && landed ? (
          <Animated.View entering={FadeInDown.duration(320)} style={[styles.result, { backgroundColor: itemColor(landed.itemIndex).fill }]}>
            <Text style={styles.resultLabel}>{t('wheel.landedOn')}</Text>
            <Text style={styles.resultText}>{landed.label}</Text>
          </Animated.View>
        ) : (
          <Animated.Text entering={FadeIn} style={styles.hint}>
            {wheel.items.length} {t('wheel.itemsTwice')}
          </Animated.Text>
        )}

        {phase === 'done' ? (
          <PressableScale style={styles.primary} scaleTo={0.97} onPress={() => navigation.goBack()}>
            <Text style={styles.primaryText}>{t('wheel.done')}</Text>
          </PressableScale>
        ) : (
          <PressableScale
            style={[styles.primary, phase === 'spinning' && styles.primaryBusy]}
            scaleTo={0.97}
            haptic="none"
            onPress={go}
          >
            <Text style={styles.primaryText}>{phase === 'spinning' ? t('wheel.spinning') : t('wheel.spin')}</Text>
          </PressableScale>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SURFACE.base },
  center: { alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72,
    paddingLeft: 24, paddingRight: 16, paddingTop: 22, paddingBottom: 14,
  },
  headerText: { flex: 1 },
  title: { fontFamily: DISPLAY_FONT, fontSize: 24, color: TEXT.primary, letterSpacing: -0.6 },
  subtitle: { fontFamily: UI_FONT_REGULAR, fontSize: 14, color: TEXT.secondary, marginTop: 2 },
  close: {
    width: 32, height: 32, borderRadius: RADIUS.pill, backgroundColor: SURFACE.raised,
    alignItems: 'center', justifyContent: 'center',
  },

  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pointer: {
    width: 0, height: 0, marginBottom: -6, zIndex: 2,
    borderLeftWidth: 12, borderRightWidth: 12, borderTopWidth: 20,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: TEXT.primary,
  },

  bottom: { paddingHorizontal: 16, gap: 12 },
  hint: { fontFamily: UI_FONT_REGULAR, fontSize: 14, color: TEXT.tertiary, textAlign: 'center' },
  result: { borderRadius: RADIUS.lg, paddingHorizontal: 22, paddingVertical: 20 },
  resultLabel: { fontFamily: UI_FONT_REGULAR, fontSize: 13, color: TEXT.secondary },
  resultText: { fontFamily: LIGHT_FONT, fontSize: 28, lineHeight: 34, color: TEXT.primary, marginTop: 4, letterSpacing: -0.6 },
  primary: {
    height: 54, borderRadius: RADIUS.pill, backgroundColor: TEXT.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryBusy: { opacity: 0.4 },
  primaryText: { fontFamily: UI_FONT, fontSize: 16, color: SURFACE.base },
});
