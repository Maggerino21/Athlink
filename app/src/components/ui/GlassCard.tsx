/**
 * GlassCard — the standard content surface for list rows and panels.
 *
 * ── This is NOT real Liquid Glass, on purpose ──
 *
 * It used to render a native `GlassView` (`UIGlassEffect`) whenever the device
 * supported it. That looked reasonable in isolation and was a serious mistake
 * in aggregate: `GlassCard` is used inside `.map()` in Feedback and Tasks, so a
 * twenty-item list meant twenty live Liquid Glass views, each sampling and
 * blurring its own backdrop every frame — and the native tab bar was competing
 * with all of them for the same GPU work. That, not the background gradients,
 * was what made the app feel like it was running at ten frames per second.
 *
 * Apple's guidance is that Liquid Glass is for a small number of floating
 * controls — a tab bar, a sheet, a toolbar. Not for every row of a list. The
 * same applies to `BlurView`: a real-time backdrop blur per row is expensive
 * for the same reason.
 *
 * So the default surface is static: a translucent fill, a hairline edge, and
 * two small gradients. Over Athlink's near-black background this is very close
 * to visually identical, because a blur of an almost-flat backdrop has hardly
 * anything to blur — we were paying full price for an effect that had nothing
 * to show.
 *
 * `native` opts a single element back into real glass. Use it only for
 * something floating above content, never inside a list.
 */
import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView } from 'expo-glass-effect';
import { CAN_USE_GLASS } from '../../utils/glass';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Strength of the surface, 0–100. Higher reads as nearer the viewer. */
  intensity?: number;
  radius?: number;
  padding?: number;
  /** Brighter fill and edge, for a row that wants attention (e.g. unread). */
  elevated?: boolean;
  /**
   * Render real Liquid Glass instead of the static surface.
   *
   * Only for elements that FLOAT above content and appear a handful of times
   * on screen. Never inside a list — see the note at the top of this file.
   */
  native?: boolean;
}

export default function GlassCard({
  children,
  style,
  intensity = 50,
  radius = 22,
  padding = 18,
  elevated = false,
  native = false,
}: GlassCardProps) {

  // ── Real Liquid Glass — opt-in, floating elements only ────────────────────
  if (native && CAN_USE_GLASS) {
    return (
      // Deliberately bare: no border, no clip, no shadow. UIGlassEffect draws
      // its own edge, specular and shadow, and layering ours on top competes
      // with it rather than adding to it.
      <View style={style}>
        <GlassView
          colorScheme="dark"
          glassEffectStyle="regular"
          style={[styles.nativeShell, { borderRadius: radius }]}
        >
          <View style={{ padding }}>{children}</View>
        </GlassView>
      </View>
    );
  }

  // ── Static surface — the default, and what every list row gets ────────────
  // `intensity` maps to fill opacity rather than blur radius. The numbers are
  // tuned so the result sits where the blurred version used to over a dark
  // backdrop.
  const fill = Math.min(0.14, Math.max(0.03, (intensity / 100) * (elevated ? 0.16 : 0.11)));

  return (
    <View style={[styles.shadow, { borderRadius: radius }, style]}>
      <View
        style={[
          styles.shell,
          {
            borderRadius: radius,
            backgroundColor: `rgba(255,255,255,${fill.toFixed(3)})`,
            borderColor: elevated ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.12)',
          },
        ]}
      >
        {/* Soft top wash — the light-catching edge, without a hard line. */}
        <LinearGradient
          colors={[
            elevated ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.08)',
            'rgba(255,255,255,0)',
          ]}
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.4, y: 1 }}
          pointerEvents="none"
        />

        {/* Bottom darkening — reads as thickness. */}
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.18)']}
          style={[styles.bottomDark, { borderRadius: radius }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          pointerEvents="none"
        />

        <View style={[styles.content, { padding }]}>
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 5,
  },
  nativeShell: {
    overflow: 'hidden',
  },
  shell: {
    overflow: 'hidden',
    borderWidth: 1,
  },
  bottomDark: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 48,
    zIndex: 1,
  },
  content: {
    position: 'relative',
    zIndex: 3,
  },
});
