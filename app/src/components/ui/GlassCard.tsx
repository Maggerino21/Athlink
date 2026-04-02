import React from 'react';
import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

const LIQUID = isLiquidGlassAvailable();

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  radius?: number;
  padding?: number;
  elevated?: boolean;
}

export default function GlassCard({
  children,
  style,
  intensity = 50,
  radius = 22,
  padding = 18,
  elevated = false,
}: GlassCardProps) {

  // ── iOS 26+: real native liquid glass ─────────────────────────────────────
  if (LIQUID) {
    return (
      <View style={[styles.shadow, { borderRadius: radius }, style]}>
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

  // ── Fallback: BlurView ─────────────────────────────────────────────────────
  return (
    <View style={[styles.shadow, { borderRadius: radius }, style]}>
      <View style={[styles.shell, { borderRadius: radius }]}>

        {/* Backdrop blur */}
        <BlurView
          intensity={Platform.OS === 'ios' ? intensity : 50}
          tint="systemUltraThinMaterialDark"
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        />

        {/* Soft white wash — no hard lines */}
        <LinearGradient
          colors={[
            elevated ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.11)',
            elevated ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
          ]}
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.4, y: 1 }}
          pointerEvents="none"
        />

        {/* Bottom darkening — gives the glass depth/thickness */}
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
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
  },
  shell: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
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
