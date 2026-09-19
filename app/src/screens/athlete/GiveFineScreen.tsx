/**
 * GiveFineScreen — the bøtesjef hands out a fine, in two steps.
 *
 * 1. **Which fine.** Cards built like Schedule's day cards — a small spaced
 *    label, then the amount set large with a small "kr" beside it — with the
 *    fine type's colour as the dot, and as the whole card's fill once picked.
 * 2. **Who.** Shorter cards, one per player, numbered players first by squad
 *    number ("#7", in the flourish face), anyone without a number last. Pick
 *    one or several.
 *
 * Both steps have a search field at the top and their button fixed at the
 * bottom, so the next move is always in the same place. The two steps are
 * pages in one sheet that slide sideways rather than two stacked sheets: going
 * back is a slide, not a sheet dismissing, and swiping down still closes the
 * whole thing.
 *
 * A native iOS page sheet (`presentation: 'modal'`), not a `formSheet` like
 * EventDetail — a formSheet resizes any list inside it to the full screen, so
 * a scrolling list cannot live in one. See CLAUDE.md.
 *
 * The write is `give_fine(rule, players[], note)`, which checks on the server
 * that the caller is the bøtesjef and that every player is in the club.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, Alert, ActivityIndicator,
  KeyboardAvoidingView, Keyboard, Dimensions,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import PressableScale from '../../components/ui/PressableScale';
import haptics from '../../utils/haptics';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { notifyFineBoxChanged, fineAccent } from '../../components/athlete/useFineBox';
import { SURFACE, TEXT, RADIUS } from '../../utils/tokens';
import { DISPLAY_FONT, THIN_FONT, LIGHT_FONT, UI_FONT, UI_FONT_REGULAR, FLOURISH_FONT } from '../../utils/type';
import type { AthleteStackParamList } from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<AthleteStackParamList, 'GiveFine'>;

const { width: W } = Dimensions.get('window');

/** Schedule's gutter. */
const PAD = 8;

/** The app's easing, fast: the slide covers the swap, it is never waited on. */
const SLIDE = { duration: 280, easing: Easing.bezier(0.22, 1, 0.36, 1) } as const;

interface Rule { id: string; name: string; amount: number; color: string | null }
interface Player { id: string; name: string; number: number | null }

export default function GiveFineScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();

  const [rules, setRules] = useState<Rule[] | null>(null);
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [ruleId, setRuleId] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [fineQuery, setFineQuery] = useState('');
  const [playerQuery, setPlayerQuery] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  const step = useSharedValue(0);
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: -step.value * W }] }));

  useEffect(() => {
    if (!profile?.club_id) return;
    (async () => {
      const [rulesRes, playersRes] = await Promise.all([
        // Only fines a person gives. Recurring and automatic ones charge
        // themselves, so offering them here would only invite double fines.
        supabase.from('fine_rules').select('id, name, amount, color')
          .eq('club_id', profile.club_id).eq('kind', 'manual').eq('active', true)
          .order('name'),
        supabase.from('profiles').select('id, full_name, squad_number')
          .eq('club_id', profile.club_id).eq('role', 'athlete').is('removed_at', null),
      ]);
      setRules((rulesRes.data ?? []) as Rule[]);
      type Row = { id: string; full_name: string | null; squad_number: number | null };
      setPlayers(((playersRes.data ?? []) as Row[])
        .map(p => ({ id: p.id, name: p.full_name ?? 'Unknown', number: p.squad_number }))
        // Numbered first, lowest first; no number last, by name.
        .sort((a, b) =>
          a.number !== null && b.number !== null ? a.number - b.number
          : a.number !== null ? -1
          : b.number !== null ? 1
          : a.name.localeCompare(b.name)));
    })();
  }, [profile?.club_id]);

  const rule = rules?.find(r => r.id === ruleId) ?? null;

  const shownRules = useMemo(() => {
    const q = fineQuery.trim().toLowerCase();
    return (rules ?? []).filter(r => !q || r.name.toLowerCase().includes(q));
  }, [rules, fineQuery]);

  const shownPlayers = useMemo(() => {
    const q = playerQuery.trim().toLowerCase();
    // A number is searchable too: typing "7" finds number 7 as well as names.
    return (players ?? []).filter(p =>
      !q || p.name.toLowerCase().includes(q) || (p.number !== null && String(p.number) === q));
  }, [players, playerQuery]);

  const goTo = (n: 0 | 1) => {
    Keyboard.dismiss();
    step.value = withTiming(n, SLIDE);
  };

  const pickRule = (id: string) => {
    haptics.selection();
    setRuleId(prev => (prev === id ? null : id));
  };

  const togglePlayer = (id: string) => {
    haptics.selection();
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const give = async () => {
    if (!rule || picked.size === 0) return;
    setSending(true);
    const { error } = await supabase.rpc('give_fine', {
      p_rule_id: rule.id,
      p_athlete_ids: [...picked],
      p_note: note.trim() || null,
    });
    setSending(false);
    if (error) {
      haptics.error();
      Alert.alert('The fine was not given', error.message);
      return;
    }
    haptics.success();
    notifyFineBoxChanged();
    navigation.goBack();
  };

  const giveLabel = picked.size <= 1 ? 'Give fine' : `Give to ${picked.size} players`;
  const total = rule ? rule.amount * Math.max(1, picked.size) : 0;

  return (
    <KeyboardAvoidingView style={styles.root} behavior="padding">
      <Animated.View style={[styles.row, slide]}>

        {/* ── Step 1: which fine ─────────────────────────────────────────── */}
        <View style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.title}>Give a fine</Text>
          </View>
          <SearchField value={fineQuery} onChange={setFineQuery} placeholder="Search fines" />

          {rules === null ? (
            <ActivityIndicator color={TEXT.tertiary} style={styles.loading} />
          ) : (
            <FlatList
              data={shownRules}
              keyExtractor={r => r.id}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <Text style={styles.empty}>
                  {rules.length === 0 ? 'No fines set up yet.' : 'No fines match.'}
                </Text>
              }
              renderItem={({ item }) => (
                <FineCard rule={item} selected={item.id === ruleId} onPress={() => pickRule(item.id)} />
              )}
            />
          )}

          <View style={[styles.bottom, { paddingBottom: insets.bottom + 8 }]}>
            <PrimaryButton
              label="Choose players"
              icon="chevron-forward"
              disabled={!rule}
              onPress={() => goTo(1)}
            />
          </View>
        </View>

        {/* ── Step 2: who ────────────────────────────────────────────────── */}
        <View style={styles.page}>
          <View style={[styles.header, styles.headerRow]}>
            <PressableScale style={styles.back} scaleTo={0.9} onPress={() => goTo(0)}>
              <Ionicons name="chevron-back" size={22} color={TEXT.primary} />
            </PressableScale>
            <View style={styles.headerText}>
              <Text style={styles.title} numberOfLines={1}>{rule?.name ?? 'Choose players'}</Text>
              {rule && <Text style={styles.subtitle}>{rule.amount} kr</Text>}
            </View>
          </View>
          <SearchField value={playerQuery} onChange={setPlayerQuery} placeholder="Search name or number" />

          {players === null ? (
            <ActivityIndicator color={TEXT.tertiary} style={styles.loading} />
          ) : (
            <FlatList
              data={shownPlayers}
              keyExtractor={p => p.id}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={<Text style={styles.empty}>No players match.</Text>}
              renderItem={({ item }) => (
                <PlayerCard player={item} selected={picked.has(item.id)} onPress={() => togglePlayer(item.id)} />
              )}
            />
          )}

          <View style={[styles.bottom, { paddingBottom: insets.bottom + 8 }]}>
            <TextInput
              style={styles.note}
              value={note}
              onChangeText={setNote}
              placeholder="Add a note (optional)"
              placeholderTextColor={TEXT.tertiary}
              returnKeyType="done"
              maxLength={120}
            />
            <PrimaryButton
              label={picked.size > 0 ? `${giveLabel}  ·  ${total} kr` : 'Pick a player'}
              disabled={picked.size === 0 || sending}
              busy={sending}
              onPress={give}
            />
          </View>
        </View>

      </Animated.View>
    </KeyboardAvoidingView>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────────

/**
 * Schedule's day card, for a fine: the name where the weekday sits, the amount
 * where the date sits, the type's dot on the right. "kr" is small and beside
 * the figure rather than stacked at full size — the currency is not news.
 * Picked, the card takes the fine's colour, the way an event card wears its
 * type's colour when a day opens.
 */
function FineCard({ rule, selected, onPress }: { rule: Rule; selected: boolean; onPress: () => void }) {
  const accent = fineAccent(rule.id, rule.color);
  return (
    <PressableScale
      style={[styles.fineCard, selected && { backgroundColor: accent.fill }]}
      scaleTo={0.98}
      dim={false}
      haptic="none"
      onPress={onPress}
    >
      <View style={styles.fineBlock}>
        <Text style={styles.fineName} numberOfLines={2}>{rule.name.toUpperCase()}</Text>
        <View style={styles.amountRow}>
          <Text style={styles.fineAmount} allowFontScaling={false}>{rule.amount}</Text>
          <Text style={styles.fineUnit} allowFontScaling={false}>kr</Text>
        </View>
      </View>
      {selected
        ? <Ionicons name="checkmark-circle" size={26} color={TEXT.primary} />
        : <View style={[styles.dot, { backgroundColor: accent.edge }]} />}
    </PressableScale>
  );
}

/**
 * A player, as Schedule's slim card: the number at the front, the name, and a
 * tick once picked. Picked is the near-white fill with dark text the calendar
 * uses for a selected day.
 */
function PlayerCard({ player, selected, onPress }: { player: Player; selected: boolean; onPress: () => void }) {
  return (
    <PressableScale
      style={[styles.playerCard, selected && styles.playerCardOn]}
      scaleTo={0.98}
      dim={false}
      haptic="none"
      onPress={onPress}
    >
      <Text style={styles.playerNum} allowFontScaling={false}>
        {player.number !== null && (
          <>
            <Text style={[styles.playerHash, selected && styles.onTextDim]}>#</Text>
            <Text style={[styles.playerDigits, selected && styles.onText]}>{player.number}</Text>
          </>
        )}
      </Text>
      <Text style={[styles.playerName, selected && styles.onText]} numberOfLines={1}>{player.name}</Text>
      {selected && <Ionicons name="checkmark" size={20} color={SURFACE.base} />}
    </PressableScale>
  );
}

function SearchField({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder: string;
}) {
  return (
    <View style={styles.search}>
      <Ionicons name="search" size={16} color={TEXT.tertiary} />
      <TextInput
        style={styles.searchInput}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={TEXT.tertiary}
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="search"
      />
    </View>
  );
}

function PrimaryButton({ label, icon, disabled, busy, onPress }: {
  label: string; icon?: 'chevron-forward'; disabled?: boolean; busy?: boolean; onPress: () => void;
}) {
  return (
    <PressableScale
      style={[styles.button, disabled && styles.buttonOff]}
      scaleTo={0.97}
      haptic="none"
      disabled={disabled}
      onPress={onPress}
    >
      {busy ? (
        <ActivityIndicator color={SURFACE.base} />
      ) : (
        <>
          <Text style={[styles.buttonText, disabled && styles.buttonTextOff]}>{label}</Text>
          {icon && <Ionicons name={icon} size={18} color={disabled ? TEXT.tertiary : SURFACE.base} />}
        </>
      )}
    </PressableScale>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SURFACE.base, overflow: 'hidden' },
  // Two pages side by side; the row slides to show one.
  row: { flex: 1, flexDirection: 'row', width: W * 2 },
  page: { width: W, flex: 1 },

  header: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 12 },
  headerText: { flex: 1 },
  back: { padding: 6 },
  title: { fontFamily: DISPLAY_FONT, fontSize: 24, color: TEXT.primary, letterSpacing: -0.6 },
  subtitle: { fontFamily: UI_FONT_REGULAR, fontSize: 14, color: TEXT.secondary, marginTop: 2 },

  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: PAD, height: 44, paddingHorizontal: 16,
    borderRadius: RADIUS.pill, backgroundColor: SURFACE.raised,
  },
  searchInput: { flex: 1, fontFamily: UI_FONT_REGULAR, fontSize: 16, color: TEXT.primary },

  list: { paddingHorizontal: PAD, paddingTop: 10, paddingBottom: 16, gap: 8 },
  loading: { marginTop: 40 },
  empty: {
    fontFamily: UI_FONT_REGULAR, fontSize: 15, color: TEXT.tertiary,
    textAlign: 'center', marginTop: 40,
  },

  // ── Fine card — Schedule's DayCard, in its proportions and type.
  fineCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: RADIUS.lg, backgroundColor: SURFACE.raised,
    paddingVertical: 20, paddingHorizontal: 22,
  },
  fineBlock: { flex: 1 },
  fineName: {
    fontFamily: UI_FONT, fontSize: 13, letterSpacing: 1.3,
    color: TEXT.primary, marginBottom: 14,
  },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  fineAmount: {
    fontFamily: THIN_FONT, fontSize: 58, lineHeight: 62,
    color: TEXT.primary, letterSpacing: -2,
    // Negative tracking leaves the box narrower than the ink; give it back.
    paddingRight: 2,
  },
  fineUnit: {
    fontFamily: LIGHT_FONT, fontSize: 17,
    color: TEXT.secondary,
  },
  dot: { width: 13, height: 13, borderRadius: RADIUS.pill },

  // ── Player card — Schedule's slim card.
  playerCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: RADIUS.lg, backgroundColor: SURFACE.raised,
    paddingVertical: 16, paddingHorizontal: 22,
  },
  playerCardOn: { backgroundColor: TEXT.primary },
  // "#7" in the flourish face: the hash quieter and a touch smaller, the
  // number bright, tight tracking so it reads like a shirt number.
  playerNum: { width: 58, fontFamily: FLOURISH_FONT, lineHeight: 28 },
  playerHash: { fontFamily: FLOURISH_FONT, fontSize: 18, color: TEXT.tertiary },
  playerDigits: {
    fontFamily: FLOURISH_FONT, fontSize: 24,
    color: TEXT.primary, letterSpacing: -0.5,
  },
  playerName: { flex: 1, fontFamily: UI_FONT_REGULAR, fontSize: 17, color: TEXT.primary },
  onText: { color: SURFACE.base },
  // The hash on a selected (near-white) card: dark, but quieter than the number.
  onTextDim: { color: 'rgba(10,10,12,0.45)' },

  // ── Fixed bottom bar.
  bottom: { paddingHorizontal: PAD, paddingTop: 10, gap: 8, backgroundColor: SURFACE.base },
  note: {
    height: 46, paddingHorizontal: 18,
    fontFamily: UI_FONT_REGULAR, fontSize: 16, color: TEXT.primary,
    borderRadius: RADIUS.pill, backgroundColor: SURFACE.raised,
  },
  button: {
    height: 54, borderRadius: RADIUS.pill, backgroundColor: TEXT.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  buttonOff: { backgroundColor: SURFACE.active },
  buttonText: { fontFamily: UI_FONT, fontSize: 16, color: SURFACE.base },
  buttonTextOff: { color: TEXT.tertiary },
});
