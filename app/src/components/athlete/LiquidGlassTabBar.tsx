/**
 * LiquidGlassTabBar
 *
 * Closest possible approximation of Apple's Liquid Glass tab bar in React Native.
 *
 * Layering (back to front on the pill):
 *  1. Drop shadow           — floating depth
 *  2. Outer border          — rgba(255,255,255,0.15) — the glass edge
 *  3. BlurView ultraThin    — real native backdrop blur
 *  4. Glass fill            — very subtle white tint
 *  5. Top specular          — 1px bright line + gradient fade (light catching top rim)
 *  6. Bottom inner shadow   — subtle darkening at bottom (glass thickness cue)
 *  7. Active indicator pill — lighter sub-glass pill behind active icon
 *  8. Icons + labels
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

const LIQUID = isLiquidGlassAvailable();

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TABS = [
  {
    id: 'this-week',
    label: 'Home',
    icon: 'home-outline' as const,
    iconActive: 'home' as const,
  },
  {
    id: 'feedback',
    label: 'Feedback',
    icon: 'chatbubble-outline' as const,
    iconActive: 'chatbubble' as const,
  },
  {
    id: 'schedule',
    label: 'Schedule',
    icon: 'calendar-outline' as const,
    iconActive: 'calendar' as const,
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: 'checkmark-circle-outline' as const,
    iconActive: 'checkmark-circle' as const,
  },
  {
    id: 'progress',
    label: 'Progress',
    icon: 'trending-up-outline' as const,
    iconActive: 'trending-up' as const,
  },
] as const;

const PILL_H = 68;
const PILL_RADIUS = 38;
const H_MARGIN = 28;

interface Props {
  activeIndex: number;
  onTabPress: (index: number) => void;
  badges?: Partial<Record<number, number>>;
}

export default function LiquidGlassTabBar({ activeIndex, onTabPress, badges = {} }: Props) {
  const insets = useSafeAreaInsets();
  const bottomOffset = Math.max(insets.bottom, 8) + 12;

  return (
    <View
      style={[
        styles.floatWrapper,
        { bottom: bottomOffset, left: H_MARGIN, right: H_MARGIN },
      ]}
      pointerEvents="box-none"
    >
      {/* ── Shadow halo (rendered outside clip so shadow shows) ── */}
      <View style={[styles.shadowRing, { height: PILL_H, borderRadius: PILL_RADIUS }]} />

      {/* ── The pill ── */}
      <View style={[styles.pill, { height: PILL_H, borderRadius: PILL_RADIUS }]}>

        {/* Glass background — native on iOS 26+, BlurView fallback */}
        {LIQUID ? (
          <GlassView
            colorScheme="dark"
            glassEffectStyle="regular"
            style={[StyleSheet.absoluteFill, { borderRadius: PILL_RADIUS }]}
          />
        ) : (
          <>
            <BlurView
              intensity={Platform.OS === 'ios' ? 80 : 95}
              tint="systemUltraThinMaterialDark"
              style={[StyleSheet.absoluteFill, { borderRadius: PILL_RADIUS }]}
            />
            <View style={[StyleSheet.absoluteFill, styles.glassFill, { borderRadius: PILL_RADIUS }]} />
            <LinearGradient
              colors={['rgba(255,255,255,0.26)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={[styles.topGradient, { borderRadius: PILL_RADIUS }]}
              pointerEvents="none"
            />
            <LinearGradient
              colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.18)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={[styles.bottomGradient, { borderRadius: PILL_RADIUS }]}
              pointerEvents="none"
            />
          </>
        )}

        {/* No hard top edge line — soft gradient only */}

        {/* Tab items */}
        <View style={styles.tabRow}>
          {TABS.map((tab, index) => {
            const isActive = activeIndex === index;
            const badge = badges[index];

            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => onTabPress(index)}
                activeOpacity={0.75}
                style={styles.tabHitArea}
              >
                {/* Active sub-pill */}
                {isActive && (
                  LIQUID ? (
                    <GlassView
                      colorScheme="dark"
                      glassEffectStyle="clear"
                      style={[StyleSheet.absoluteFill, styles.activePillWrap]}
                    >
                      <View style={styles.activePillSpec} />
                    </GlassView>
                  ) : (
                    <View style={styles.activePillWrap}>
                      <BlurView
                        intensity={30}
                        tint="systemUltraThinMaterialDark"
                        style={[StyleSheet.absoluteFill, styles.activePillBlur]}
                      />
                      <View style={styles.activePillSpec} />
                      <View style={[StyleSheet.absoluteFill, styles.activePillFill]} />
                    </View>
                  )
                )}

                {/* Icon */}
                <View style={styles.iconWrap}>
                  <Ionicons
                    name={isActive ? tab.iconActive : tab.icon}
                    size={22}
                    color={isActive ? '#FFFFFF' : 'rgba(255,255,255,0.38)'}
                  />
                  {badge != null && badge > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
                    </View>
                  )}
                </View>

                {/* Label */}
                <Text
                  style={[
                    styles.label,
                    isActive ? styles.labelActive : styles.labelInactive,
                  ]}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatWrapper: {
    position: 'absolute',
  },

  // Outer shadow — separate so iOS renders it outside clip
  shadowRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 28,
    elevation: 20,
    backgroundColor: 'transparent',
  },

  // The clipped pill container
  pill: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },

  glassFill: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 28,
    zIndex: 1,
  },

  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 24,
    zIndex: 1,
  },

  // ── Tab items ──
  tabRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    zIndex: 4,
  },

  tabHitArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 30,
    minHeight: PILL_H - 8,
  },

  // Active indicator sub-pill
  activePillWrap: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    right: 4,
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  activePillBlur: {
    borderRadius: 26,
  },
  activePillFill: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 26,
  },
  activePillSpec: {
    // removed hard line — no visible stripe
  },

  iconWrap: {
    position: 'relative',
    marginBottom: 2,
  },

  badge: {
    position: 'absolute',
    top: -4,
    right: -9,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    minWidth: 15,
    height: 15,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: 'rgba(8,14,26,0.8)',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0,
  },

  label: {
    fontSize: 10,
    letterSpacing: 0.1,
  },
  labelActive: {
    color: 'rgba(255,255,255,0.95)',
    fontWeight: '600',
  },
  labelInactive: {
    color: 'rgba(255,255,255,0.35)',
    fontWeight: '500',
  },
});
