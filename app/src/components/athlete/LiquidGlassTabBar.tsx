/**
 * LiquidGlassTabBar
 *
 * Two separate render paths, chosen by `LIQUID`. Not variations on a theme —
 * they want opposite things and must not be merged.
 *
 * ── Native (iOS 26+, including inside Expo Go) ──
 *
 * Exactly two glass elements, both plain `GlassView`:
 *
 *   1. the bar   — `regular`, rounded to PILL_RADIUS
 *   2. the blob  — `clear`, UNTINTED, `isInteractive`, sliding across
 *
 * Nothing else. No border, no gradient, no shadow, no overflow clip.
 * UIGlassEffect draws its own edge, specular and shadow; anything painted on
 * top competes with it instead of adding to it.
 *
 * Four things here were each learned the hard way. Do not undo them:
 *
 *  - **The blob is untinted, and the club colour lives on the icon and label.**
 *    A tinted capsule fills the lens with paint and stops it refracting. This
 *    is the difference between a glass bar and a painted one — see the note at
 *    the blob itself.
 *
 *  - **No `GlassContainer`.** Its merge behaviour is genuinely nice, but it
 *    renders a *rectangular* effect region that ignores `borderRadius`, so
 *    wrapping a pill in one leaves a visible square block around the bar — it
 *    reads as "cut off from the rest of the app". Two independent GlassViews
 *    are correct here; the container is for rectangular groupings.
 *
 *  - **`isInteractive` only fires on glass the touch actually lands on.** So
 *    the blob sits ABOVE the icon row, and the icon row is `pointerEvents:
 *    'none'`. A blob layered *beneath* the row can never be touched and is
 *    therefore dead however right it looks at rest.
 *
 *  - **Taps are resolved at bar level from the touch x**, not by per-tab
 *    gesture handlers. That is what frees the blob to own the touch while tabs
 *    still work.
 *
 * ── Fallback (pre-iOS-26, Android) ──
 *
 * The hand-layered approximation: shadow → border → BlurView ultraThin → white
 * fill → indicator → specular gradients → icons. A decent imitation; simply not
 * what should run when the real thing exists.
 *
 * ── Motion (both paths) ──
 *
 * Driven by the pager's scroll offset, not a settled index, so the bar tracks
 * your thumb rather than snapping once the swipe is over.
 *
 * NOTE: GlassLab feeds this a *static* scrollX, so the blob cannot move there.
 * Judge movement in the app, not the lab.
 */

import React, { useCallback } from 'react';
import { View, StyleSheet, Platform, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView } from 'expo-glass-effect';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  SharedValue,
  useAnimatedStyle,
  interpolate,
  interpolateColor,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated';
import { hexToRgba } from '../../utils/theme';
import { CAN_USE_GLASS } from '../../utils/glass';

/** Capability detection lives in utils/glass.ts — read the note there first. */
const LIQUID = CAN_USE_GLASS;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TABS = [
  { id: 'this-week', label: 'Home',     icon: 'home-outline'             as const, iconActive: 'home'             as const },
  { id: 'feedback',  label: 'Feedback', icon: 'chatbubble-outline'       as const, iconActive: 'chatbubble'       as const },
  { id: 'schedule',  label: 'Schedule', icon: 'calendar-outline'         as const, iconActive: 'calendar'         as const },
  { id: 'tasks',     label: 'Tasks',    icon: 'checkmark-circle-outline' as const, iconActive: 'checkmark-circle' as const },
  { id: 'progress',  label: 'Progress', icon: 'trending-up-outline'      as const, iconActive: 'trending-up'      as const },
] as const;

const PILL_H = 68;
const PILL_RADIUS = 34;
const H_MARGIN = 28;
const ROW_PAD = 6;

const PILL_W = SCREEN_WIDTH - H_MARGIN * 2;
const TAB_W  = (PILL_W - ROW_PAD * 2) / TABS.length;

/**
 * The blob is deliberately TALLER than the bar and WIDER than its tab slot, so
 * it stands proud of the pill instead of sitting inset inside it. Both Apple's
 * own tab bars and every third-party bar that reads as convincing do this — the
 * lens overhanging its container is a large part of why it looks like a
 * physical object rather than a highlight.
 */
const BLOB_H = PILL_H + 6;
const BLOB_W = TAB_W + 10;
/** Vertical offset so the overhang is symmetric. */
const BLOB_TOP = (PILL_H - BLOB_H) / 2;

interface Props {
  /** Horizontal scroll offset of the pager, in px. Drives every animation here. */
  scrollX: SharedValue<number>;
  onTabPress: (index: number) => void;
  badges?: Partial<Record<number, number>>;
  clubColor?: string;
}

export default function LiquidGlassTabBar({
  scrollX,
  onTabPress,
  badges = {},
  clubColor = '#3B82F6',
}: Props) {
  const insets = useSafeAreaInsets();
  const bottomOffset = Math.max(insets.bottom, 8) + 12;

  const blobStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          ROW_PAD +
          (scrollX.value / SCREEN_WIDTH) * TAB_W +
          (TAB_W - BLOB_W) / 2,
      },
    ],
  }));

  const press = useCallback((i: number) => onTabPress(i), [onTabPress]);

  // One gesture for the whole bar, resolving which tab from the touch x. This
  // is what lets the blob sit on top and own the touch (so `isInteractive` can
  // fire) while tapping still selects tabs.
  const barTap = Gesture.Tap()
    .maxDuration(4000)
    .maxDistance(18)
    .onEnd((e, success) => {
      if (!success) return;
      const raw = Math.floor((e.x - ROW_PAD) / TAB_W);
      const idx = Math.min(TABS.length - 1, Math.max(0, raw));
      runOnJS(press)(idx);
    });

  const icons = (
    <View style={styles.tabRow} pointerEvents="none">
      {TABS.map((tab, index) => (
        <TabItem
          key={tab.id}
          tab={tab}
          index={index}
          scrollX={scrollX}
          badge={badges[index]}
          clubColor={clubColor}
        />
      ))}
    </View>
  );

  return (
    <View
      style={[styles.floatWrapper, { bottom: bottomOffset, left: H_MARGIN, right: H_MARGIN }]}
      pointerEvents="box-none"
    >
      {/* Our own shadow is for the fallback only — real glass casts its own,
          and stacking ours beneath it reads as a grey smudge. */}
      {!LIQUID && (
        <View style={[styles.shadowRing, { height: PILL_H, borderRadius: PILL_RADIUS }]} />
      )}

      {LIQUID ? (
        <GestureDetector gesture={barTap}>
          <View style={[styles.pillGlass, { height: PILL_H }]}>
            {/* 1 · the bar */}
            <GlassView
              glassEffectStyle="regular"
              colorScheme="dark"
              style={[StyleSheet.absoluteFill, { borderRadius: PILL_RADIUS }]}
            />

            {/* 2 · the blob — above the bar, above the icons, so the finger
                   lands on it and the glass can deform.

                   NO tintColor. This is the single biggest thing that separates
                   a convincing glass tab bar from a painted one: the capsule is
                   a clear LENS that refracts and magnifies whatever passes
                   behind it, and the club colour lives on the icon and label
                   instead. Tinting the capsule fills the lens with paint and
                   destroys the effect — at 0.32 it read as a maroon chip, at
                   1.0 as a flat pink pill. Verified against Expo Go's own bar
                   and a shipping third-party app, both of which use an
                   untinted capsule with a coloured glyph. */}
            <Animated.View style={[styles.blobBox, blobStyle]}>
              <GlassView
                glassEffectStyle="clear"
                isInteractive
                style={[StyleSheet.absoluteFill, { borderRadius: BLOB_H / 2 }]}
              />
            </Animated.View>

            {icons}
          </View>
        </GestureDetector>
      ) : (
        <GestureDetector gesture={barTap}>
          <View style={[styles.pill, { height: PILL_H, borderRadius: PILL_RADIUS }]}>
            <BlurView
              intensity={Platform.OS === 'ios' ? 80 : 95}
              tint="systemUltraThinMaterialDark"
              style={[StyleSheet.absoluteFill, { borderRadius: PILL_RADIUS }]}
            />
            <View style={[StyleSheet.absoluteFill, styles.glassFill, { borderRadius: PILL_RADIUS }]} />

            <Animated.View
              pointerEvents="none"
              style={[
                styles.blobBox,
                {
                  borderRadius: BLOB_H / 2,
                  backgroundColor: hexToRgba(clubColor, 0.16),
                  borderWidth: 1,
                  borderColor: hexToRgba(clubColor, 0.3),
                },
                blobStyle,
              ]}
            />

            <LinearGradient
              colors={['rgba(255,255,255,0.26)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
              style={[styles.topGradient, { borderRadius: PILL_RADIUS }]}
              pointerEvents="none"
            />
            <LinearGradient
              colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.18)']}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
              style={[styles.bottomGradient, { borderRadius: PILL_RADIUS }]}
              pointerEvents="none"
            />

            {icons}
          </View>
        </GestureDetector>
      )}
    </View>
  );
}

// ── One tab's icon + label (no touch handling — the bar owns that) ───────────

function TabItem({
  tab, index, scrollX, badge, clubColor,
}: {
  tab: (typeof TABS)[number];
  index: number;
  scrollX: SharedValue<number>;
  badge?: number;
  clubColor: string;
}) {
  const inputRange = [
    (index - 1) * SCREEN_WIDTH,
    index * SCREEN_WIDTH,
    (index + 1) * SCREEN_WIDTH,
  ];

  const activeIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, inputRange, [0, 1, 0], Extrapolation.CLAMP),
  }));

  const inactiveIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, inputRange, [1, 0, 1], Extrapolation.CLAMP),
  }));

  const iconWrapStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(scrollX.value, inputRange, [1, 1.08, 1], Extrapolation.CLAMP) },
      { translateY: interpolate(scrollX.value, inputRange, [0, -1, 0], Extrapolation.CLAMP) },
    ],
  }));

  // The active tab's identity is carried by the glyph, not by the capsule.
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      scrollX.value,
      inputRange,
      ['rgba(255,255,255,0.45)', clubColor, 'rgba(255,255,255,0.45)']
    ),
  }));

  return (
    <View style={styles.tabHitArea}>
      <Animated.View style={[styles.iconWrap, iconWrapStyle]}>
        {/* Ionicons takes colour as a prop, which can't be animated, so two
            icons are stacked and cross-faded by opacity instead. */}
        <Animated.View style={inactiveIconStyle}>
          <Ionicons name={tab.icon} size={23} color="rgba(255,255,255,0.45)" />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, styles.iconOverlay, activeIconStyle]}>
          <Ionicons name={tab.iconActive} size={23} color={clubColor} />
        </Animated.View>

        {badge != null && badge > 0 && (
          <View style={[styles.badge, { backgroundColor: clubColor }]}>
            <Animated.Text style={styles.badgeText}>
              {badge > 9 ? '9+' : badge}
            </Animated.Text>
          </View>
        )}
      </Animated.View>

      <Animated.Text style={[styles.label, labelStyle]} numberOfLines={1}>
        {tab.label}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  floatWrapper: { position: 'absolute' },

  shadowRing: {
    position: 'absolute', top: 0, left: 0, right: 0,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55, shadowRadius: 28, elevation: 20,
    backgroundColor: 'transparent',
  },

  // Native-glass pill: plain View, no clip, no border, no background.
  pillGlass: { position: 'relative' },

  // Fallback pill.
  pill: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },

  glassFill: { backgroundColor: 'rgba(255,255,255,0.06)' },

  blobBox: {
    position: 'absolute',
    top: BLOB_TOP,
    left: 0,
    width: BLOB_W,
    height: BLOB_H,
    zIndex: 3,
  },

  topGradient: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 28, zIndex: 4,
  },
  bottomGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 24, zIndex: 4,
  },

  tabRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ROW_PAD,
    zIndex: 5,
  },

  tabHitArea: {
    width: TAB_W,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    height: PILL_H,
  },

  iconWrap: {
    position: 'relative', marginBottom: 2,
    width: 24, height: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  iconOverlay: { alignItems: 'center', justifyContent: 'center' },

  badge: {
    position: 'absolute', top: -4, right: -9,
    borderRadius: 8, minWidth: 15, height: 15,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 3, borderWidth: 1.5,
    borderColor: 'rgba(8,14,26,0.8)', zIndex: 6,
  },
  badgeText: {
    color: '#FFFFFF', fontSize: 9, fontWeight: '700', letterSpacing: 0,
  },

  label: { fontSize: 10, letterSpacing: 0.1, fontWeight: '600' },
});
