/**
 * FinesSection — the fine box (bøtekasse).
 *
 * Data comes from `useFineBox`; see that file for what each number means.
 * "Give a fine" opens `GiveFineScreen` as a sheet; managing the fine list,
 * payments, the goal and resets are not built yet.
 *
 * Design notes:
 * - Cards follow the rest of the app: opaque `SURFACE` fills, `RADIUS.lg`, the
 *   8pt gutter, thin Inter for figures and Archivo for the section title.
 * - **No background glow here.** Home earns one because it has a single
 *   subject; this screen is a wall of varied content and emoji, and a coloured
 *   ground behind it would fight everything on top.
 * - The podium is the one place with colour of its own: gold, silver and
 *   bronze are the point of a leaderboard, and they say rank rather than
 *   category, so they do not collide with the event-type colours.
 * - **Reacting works like Messages' Tapback**: press and hold a fine, a row of
 *   emoji springs up, tap one. Apple does not expose Tapback as a component, so
 *   it is rebuilt here. The important half is what is NOT shown: a fine with no
 *   reactions shows nothing at all, instead of five grey glyphs on every card.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, RefreshControl } from 'react-native';
import Animated, { ZoomIn, ZoomOut } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PressableScale from '../../ui/PressableScale';
import haptics from '../../../utils/haptics';
import { SURFACE, TEXT, RADIUS } from '../../../utils/tokens';
import { DISPLAY_FONT, THIN_FONT, LIGHT_FONT, UI_FONT, UI_FONT_REGULAR, FLOURISH_FONT } from '../../../utils/type';
import { useFineBox, REACTIONS, type Reaction } from '../useFineBox';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AthleteStackParamList } from '../../../navigation/RootNavigator';

const { width: W } = Dimensions.get('window');

const PAD = 8;
const GAP = 8;
const HALF = Math.floor((W - PAD * 2 - GAP) / 2);
const CARD_W = W - PAD * 2;

/**
 * The total is the one piece of showing-off on the screen: centred, in the
 * brand face rather than Inter, and filled with a chrome gradient.
 *
 * It is drawn as SVG text because a gradient has to run THROUGH the letters —
 * RN text takes a flat colour only. The stops are a soft silver: bright top, a
 * gentle dip, a highlight below it, then a mild fall-off. An earlier version
 * had a hard dark band across the middle, the way a chrome logo does at large
 * sizes, and at 62pt it read as a crease folded across every digit.
 */
const CHROME_H = 92;
const CHROME_FONT = FLOURISH_FONT;
const CHROME_SIZE = 62;
const CHROME_UNIT = 26;
/** Gap between the figure and its unit. */
const CHROME_GAP = 9;
const CHROME = [
  ['0', '#FFFFFF'], ['0.3', '#E4E9F0'], ['0.55', '#B4BCC8'],
  ['0.68', '#EFF3F8'], ['0.86', '#C5CCD7'], ['1', '#A3ABB8'],
] as const;

/** The tab bar floats over content: 49pt of bar plus the home-indicator inset. */
const TAB_BAR = 49;

/**
 * Rank colours — the only colour on this screen. Muted like the rest of the
 * app rather than metallic-bright, so a podium does not glow in a dark room.
 */
const MEDAL = ['#C9A227', '#A8B0BA', '#B06A3B'] as const;

export default function FinesSection({ isActive }: { isActive?: boolean }) {
  const insets = useSafeAreaInsets();
  const { box, reload, react: writeReaction } = useFineBox(isActive);
  const navigation = useNavigation<NativeStackNavigationProp<AthleteStackParamList>>();
  const [refreshing, setRefreshing] = useState(false);

  // Which fine has its picker open. One at a time, like a context menu.
  const [picking, setPicking] = useState<string | null>(null);

  const react = (fineId: string, emoji: Reaction, current: Reaction | null) => {
    haptics.selection();
    setPicking(null);
    writeReaction(fineId, emoji, current);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const goalPct = box.goal ? Math.min(1, box.total / box.goal.amount) : 0;
  const podium = box.leaderboard.slice(0, 3);

  const chromeText = kr(box.total);
  const chromeX = chromeLayout(chromeText, CARD_W - 36);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Fines</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        // Scrolling away is the natural "never mind" for an open picker.
        onScrollBeginDrag={() => setPicking(null)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEXT.tertiary} />}
        // The bøtesjef's floating button sits over the list, so their list needs
        // enough extra room at the end to scroll the last fine clear of it.
        contentContainerStyle={{ paddingHorizontal: PAD, paddingBottom: insets.bottom + TAB_BAR + 24 + (box.isFineManager ? 64 : 0), gap: GAP }}
      >
        {/* A box nobody runs never fills. Say so, and who can fix it. */}
        {box.loaded && !box.hasManager && (
          <View style={styles.card}>
            <Text style={styles.label}>No bøtesjef yet</Text>
            <Text style={styles.emptyText}>Your staff choose who runs the fine box.</Text>
          </View>
        )}

        {/* The box itself. One figure, the way Home leads with one. */}
        <View style={styles.card}>
          <Text style={[styles.label, styles.centered]}>In the box</Text>

          <Svg width={CARD_W - 36} height={CHROME_H} style={styles.chrome}>
            <Defs>
              <LinearGradient id="chrome" x1="0" y1="0" x2="0" y2="1">
                {CHROME.map(([offset, color]) => (
                  <Stop key={offset} offset={offset} stopColor={color} />
                ))}
              </LinearGradient>
            </Defs>
            {/* Laid out by hand rather than with textAnchor="middle": the two
                parts are different sizes, so SVG would centre the number and
                let "kr" hang off the right edge (where it gets clipped). */}
            <SvgText
              x={chromeX.num}
              y={CHROME_H * 0.74}
              fontFamily={CHROME_FONT}
              fontSize={CHROME_SIZE}
              fill="url(#chrome)"
            >
              {chromeText}
            </SvgText>
            <SvgText
              x={chromeX.unit}
              y={CHROME_H * 0.74}
              fontFamily={CHROME_FONT}
              fontSize={CHROME_UNIT}
              fill="url(#chrome)"
            >
              kr
            </SvgText>
          </Svg>

          {box.goal && (
            <View style={styles.goal}>
              <View style={styles.goalTrack}>
                <View style={[styles.goalFill, { width: `${goalPct * 100}%` }]} />
              </View>
              <View style={styles.goalRow}>
                <Text style={styles.goalLabel}>{box.goal.label ?? 'Goal'}</Text>
                <Text style={styles.goalLabel}>{kr(box.goal.amount)} kr</Text>
              </View>
            </View>
          )}
        </View>

        {/* You. Owed first, because that is what you came to check. */}
        <View style={styles.row}>
          <View style={[styles.card, styles.halfCard]}>
            <Text style={styles.label}>You owe</Text>
            <View style={styles.amountRow}>
              <Text style={styles.figure} allowFontScaling={false}>{kr(box.owed)}</Text>
              <Text style={styles.figureUnit} allowFontScaling={false}>kr</Text>
            </View>
          </View>
          <View style={[styles.card, styles.halfCard]}>
            <Text style={styles.label}>You have paid</Text>
            <View style={styles.amountRow}>
              <Text style={styles.figure} allowFontScaling={false}>{kr(box.paid)}</Text>
              <Text style={styles.figureUnit} allowFontScaling={false}>kr</Text>
            </View>
          </View>
        </View>

        {/* Podium: three columns of different heights, then the rest as a list. */}
        <View style={styles.card}>
          <Text style={styles.label}>Season leaderboard</Text>

          {podium.length === 0 ? (
            <Text style={styles.emptyText}>Nobody has been fined yet this season.</Text>
          ) : (
            <View style={styles.podium}>
              {[1, 0, 2].map(rank => {
                const p = podium[rank];
                if (!p) return <View key={rank} style={styles.podiumCol} />;
                const height = rank === 0 ? 96 : rank === 1 ? 74 : 60;
                return (
                  <View key={p.id} style={styles.podiumCol}>
                    <Text style={styles.podiumName} numberOfLines={1}>{firstName(p.name)}</Text>
                    <Text style={styles.podiumAmount} allowFontScaling={false}>{kr(p.amount)}</Text>
                    <View style={[styles.podiumBlock, { height, backgroundColor: MEDAL[rank] }]}>
                      <Text style={styles.podiumRank} allowFontScaling={false}>{rank + 1}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {box.leaderboard.slice(3).map((p, i) => (
            <View key={p.id} style={styles.rankRow}>
              <Text style={styles.rankNum} allowFontScaling={false}>{i + 4}</Text>
              <Text style={styles.rankName} numberOfLines={1}>{p.name}</Text>
              <Text style={styles.rankAmount} allowFontScaling={false}>{kr(p.amount)} kr</Text>
            </View>
          ))}
        </View>

        {/* The feed. Where the banter lives, so reactions sit right on it. */}
        <Text style={[styles.label, styles.feedLabel]}>Latest fines</Text>

        {box.loaded && box.feed.length === 0 && (
          <View style={styles.card}>
            <Text style={styles.emptyText}>No fines yet. Enjoy it while it lasts.</Text>
          </View>
        )}

        {box.feed.map(f => {
          const chosen = f.mine;
          const counts = f.counts;
          const used = REACTIONS.filter(e => (counts[e] ?? 0) > 0);

          return (
            <PressableScale
              key={f.id}
              style={styles.card}
              scaleTo={0.985}
              dim={false}
              haptic="none"
              onPress={() => setPicking(picking === f.id ? null : f.id)}
              onLongPress={() => setPicking(f.id)}
            >
              <View style={styles.fineTop}>
                <View style={styles.fineWho}>
                  <Text style={styles.fineName} numberOfLines={1}>{f.who}</Text>
                  <Text style={styles.fineWhat} numberOfLines={1}>
                    {f.what}{f.note ? `  ·  ${f.note}` : ''}
                  </Text>
                </View>
                <View style={styles.fineRight}>
                  <Text style={styles.fineAmount} allowFontScaling={false}>{kr(f.amount)} kr</Text>
                  <Text style={styles.fineWhen}>{when(f.createdAt)}</Text>
                </View>
              </View>

              {/* Only reactions people have actually given. */}
              {used.length > 0 && (
                <View style={styles.reactionRow}>
                  {used.map(e => (
                    <PressableScale
                      key={e}
                      style={[styles.reaction, chosen === e && styles.reactionMine]}
                      scaleTo={0.9}
                      onPress={() => react(f.id, e, chosen)}
                    >
                      <Text style={styles.reactionEmoji}>{e}</Text>
                      <Text style={styles.reactionCount} allowFontScaling={false}>{counts[e]}</Text>
                    </PressableScale>
                  ))}
                </View>
              )}

              {/* Tapback: springs up over the card, and is gone once you pick. */}
              {picking === f.id && (
                <Animated.View
                  entering={ZoomIn.springify().damping(17).mass(0.5)}
                  exiting={ZoomOut.duration(120)}
                  style={styles.picker}
                >
                  {REACTIONS.map(e => (
                    <PressableScale
                      key={e}
                      style={[styles.pickerItem, chosen === e && styles.pickerItemMine]}
                      scaleTo={0.85}
                      dim={false}
                      onPress={() => react(f.id, e, chosen)}
                    >
                      <Text style={styles.pickerEmoji}>{e}</Text>
                    </PressableScale>
                  ))}
                </Animated.View>
              )}
            </PressableScale>
          );
        })}

      </ScrollView>

      {/* Only the bøtesjef sees this. Everything they can do lives behind it. */}
      {box.isFineManager && (
        <PressableScale
          style={[styles.fab, { bottom: insets.bottom + TAB_BAR + 16 }]}
          scaleTo={0.96}
          haptic="medium"
          onPress={() => navigation.navigate('GiveFine')}
        >
          <Text style={styles.fabText}>Give a fine</Text>
        </PressableScale>
      )}
    </View>
  );
}

/**
 * Where to put the figure and its unit so the pair sits centred.
 *
 * SVG cannot measure text without rendering it, so the widths are estimated
 * from Space Grotesk's own proportions — digits are ~0.6em, the thin space
 * ~0.28em. An estimate is fine here: it only has to centre a short string, and
 * being a point or two out is invisible.
 */
function chromeLayout(text: string, boxWidth: number): { num: number; unit: number } {
  const digits = [...text].filter(c => c !== '\u2009').length;
  const spaces = [...text].filter(c => c === '\u2009').length;
  const numW = (digits * 0.6 + spaces * 0.28) * CHROME_SIZE;
  const unitW = 1.1 * CHROME_UNIT;
  const start = Math.max(0, (boxWidth - (numW + CHROME_GAP + unitW)) / 2);
  return { num: start, unit: start + numW + CHROME_GAP };
}

/** "now", "12m", "3h", "Yesterday", "Mon", or "12 Sep" for anything older. */
function when(iso: string): string {
  const d = new Date(iso);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - day.getTime()) / 86400000);
  if (days === 0) return `${Math.floor(mins / 60)}h`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString('en-GB', { weekday: 'short' });
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** 6450 → "6 450". Norwegian grouping, which is a space. */
function kr(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function firstName(full: string): string {
  return full.split(' ')[0];
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 4 },
  // Schedule's header, so section titles line up across tabs.
  header: { justifyContent: 'center', height: 44, paddingHorizontal: 20 },
  headerTitle: {
    fontFamily: DISPLAY_FONT, fontSize: 24, color: TEXT.primary, letterSpacing: -0.6,
  },

  card: {
    borderRadius: RADIUS.lg,
    backgroundColor: SURFACE.raised,
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 16,
  },
  row: { flexDirection: 'row', gap: GAP },
  halfCard: { width: HALF },

  label: { fontFamily: UI_FONT_REGULAR, fontSize: 14, color: TEXT.primary },
  centered: { textAlign: 'center' },
  emptyText: { fontFamily: UI_FONT_REGULAR, fontSize: 14, color: TEXT.secondary, marginTop: 6 },
  chrome: { alignSelf: 'center', marginTop: 2 },
  feedLabel: { marginTop: 8, marginLeft: 4 },

  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5, marginTop: 6 },
  figure: {
    fontFamily: THIN_FONT, fontSize: 40, lineHeight: 46,
    color: TEXT.primary, letterSpacing: -1.4,
  },
  figureUnit: { fontFamily: LIGHT_FONT, fontSize: 16, color: TEXT.primary },

  // The goal bar, in the same grey family: the fill is simply brighter.
  goal: { marginTop: 14 },
  goalTrack: { height: 6, borderRadius: RADIUS.pill, backgroundColor: SURFACE.base, overflow: 'hidden' },
  goalFill: { height: 6, borderRadius: RADIUS.pill, backgroundColor: TEXT.primary },
  goalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 },
  goalLabel: { fontFamily: UI_FONT_REGULAR, fontSize: 13, color: TEXT.secondary },

  podium: { flexDirection: 'row', alignItems: 'flex-end', gap: GAP, marginTop: 16, marginBottom: 6 },
  podiumCol: { flex: 1, alignItems: 'center' },
  podiumName: { fontFamily: UI_FONT, fontSize: 13, color: TEXT.primary },
  podiumAmount: {
    fontFamily: THIN_FONT, fontSize: 26, lineHeight: 32,
    color: TEXT.primary, letterSpacing: -0.8, marginBottom: 6,
  },
  podiumBlock: {
    width: '100%', borderTopLeftRadius: RADIUS.sm, borderTopRightRadius: RADIUS.sm,
    alignItems: 'center', paddingTop: 8,
  },
  podiumRank: {
    fontFamily: LIGHT_FONT, fontSize: 18,
    // The blocks are light enough that the rank has to go dark on them.
    color: SURFACE.base,
  },

  rankRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 9,
  },
  rankNum: { fontFamily: UI_FONT_REGULAR, fontSize: 13, color: TEXT.tertiary, width: 18 },
  rankName: { fontFamily: UI_FONT_REGULAR, fontSize: 15, color: TEXT.primary, flex: 1 },
  rankAmount: { fontFamily: UI_FONT_REGULAR, fontSize: 15, color: TEXT.secondary },

  fineTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  fineWho: { flex: 1 },
  fineName: { fontFamily: LIGHT_FONT, fontSize: 20, lineHeight: 25, color: TEXT.primary, letterSpacing: -0.3 },
  fineWhat: { fontFamily: UI_FONT_REGULAR, fontSize: 14, color: TEXT.secondary, marginTop: 2 },
  fineRight: { alignItems: 'flex-end' },
  fineAmount: { fontFamily: LIGHT_FONT, fontSize: 20, lineHeight: 25, color: TEXT.primary },
  fineWhen: { fontFamily: UI_FONT_REGULAR, fontSize: 13, color: TEXT.tertiary, marginTop: 2 },

  reactionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  // Sits above the card it belongs to, anchored to its left edge, the way a
  // Tapback row sits above its bubble.
  picker: {
    position: 'absolute', top: -26, left: 14,
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 8, paddingVertical: 7,
    borderRadius: RADIUS.pill, backgroundColor: SURFACE.active,
  },
  pickerItem: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.pill },
  pickerItemMine: { backgroundColor: TEXT.faint },
  pickerEmoji: { fontSize: 24 },
  reaction: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 5,
    borderRadius: RADIUS.pill, backgroundColor: SURFACE.active,
  },
  // Your own reaction: brighter surface, no colour — the same "current" rule
  // Schedule uses for today.
  reactionMine: { backgroundColor: TEXT.faint },
  reactionEmoji: { fontSize: 15 },
  reactionCount: { fontFamily: UI_FONT_REGULAR, fontSize: 13, color: TEXT.primary },

  fab: {
    position: 'absolute', alignSelf: 'center',
    paddingHorizontal: 22, paddingVertical: 13,
    borderRadius: RADIUS.pill, backgroundColor: TEXT.primary,
  },
  fabText: { fontFamily: UI_FONT, fontSize: 15, color: SURFACE.base },
});
