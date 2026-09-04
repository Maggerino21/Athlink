/**
 * GlassLab — a dev-only screen for looking at what Liquid Glass actually does
 * on this device, instead of inferring it from how one tab bar happens to look.
 *
 * Not shipped. Reachable in __DEV__ only, by long-pressing your avatar on the
 * athlete home screen.
 *
 * It exists because of a specific failure mode: Liquid Glass is a *refractive*
 * material. It samples whatever is behind it. Over Athlink's near-black
 * background (#0c0a0a with two very low-alpha orbs) there is almost nothing to
 * refract, so a perfectly correct GlassView still renders as a flat grey slab.
 * The BACKDROP toggle at the top is the control for exactly that question:
 * flip between the app's real background and a deliberately busy one, and if
 * the glass only comes alive over the busy one, the bug is our background, not
 * our API usage.
 *
 * Row 1 is the important one — a completely bare GlassView with no styling of
 * ours at all. If that looks wrong, the problem is upstream of anything we
 * wrote.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform,
  Dimensions, AccessibilityInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { GlassView, GlassContainer } from 'expo-glass-effect';
import { CAN_USE_GLASS, glassDiagnostics } from '../../utils/glass';
import { useSharedValue } from 'react-native-reanimated';
import LiquidGlassTabBar from '../../components/athlete/LiquidGlassTabBar';
import { hexToRgba } from '../../utils/theme';

const { width: W } = Dimensions.get('window');
const SAMPLE_W = W - 48;
const SAMPLE_H = 74;

type Backdrop = 'app' | 'rich' | 'busy' | 'photo';

export default function GlassLab({ onClose, clubColor = '#3B82F6' }: {
  onClose: () => void;
  clubColor?: string;
}) {
  const [backdrop, setBackdrop] = useState<Backdrop>('app');
  // Drives the real tab bar pinned at the bottom of this screen. Static — this
  // is about how the bar *looks* on a given backdrop, not how it animates.
  const labScrollX = useSharedValue(0);
  const [reduceTransparency, setReduceTransparency] = useState<boolean | null>(null);

  useEffect(() => {
    // If the user has Reduce Transparency on, iOS strips the effect system-wide
    // and every sample below will look flat however correct the code is.
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then(setReduceTransparency)
      .catch(() => setReduceTransparency(null));
  }, []);

  const d = glassDiagnostics;
  const usable = CAN_USE_GLASS;

  return (
    <View style={styles.root}>
      <Backdrops kind={backdrop} clubColor={clubColor} />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Glass Lab</Text>
          <Pressable onPress={onClose} hitSlop={16}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
        </View>

        {/* Capability readout — the facts, not a guess */}
        <View style={styles.readout}>
          <Fact label="Platform" value={d.platform} />
          <Fact label="Liquid Glass design" value={d.designAvailable ? 'available' : 'unavailable'} good={d.designAvailable} />
          <Fact label="API flag present?" value={d.apiFlagPresent ? 'yes' : 'no (ignored)'} />
          <Fact label="API flag value" value={d.apiFlagPresent ? String(d.apiFlagValue) : 'n/a'} />
          <Fact
            label="Reduce Transparency"
            value={reduceTransparency === null ? 'unknown' : reduceTransparency ? 'ON (dims glass)' : 'off'}
            good={reduceTransparency === false}
          />
          <Fact label="→ using" value={usable ? 'NATIVE glass' : 'BlurView fallback'} good={usable} />
          <Text style={styles.reason}>{d.reason}</Text>
        </View>

        {/* Backdrop switcher — the actual experiment */}
        <View style={styles.switcher}>
          {(['app', 'rich', 'busy', 'photo'] as Backdrop[]).map(k => (
            <Pressable
              key={k}
              onPress={() => setBackdrop(k)}
              style={[styles.switchBtn, backdrop === k && styles.switchBtnOn]}
            >
              <Text style={[styles.switchTxt, backdrop === k && styles.switchTxtOn]}>
                {k === 'app' ? 'App now' : k === 'rich' ? 'App richer' : k === 'busy' ? 'Busy' : 'Contrast'}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Note>
            Row 1 is bare — no styling of ours. If that looks wrong, nothing we write
            downstream will fix it. Then switch the backdrop above: if glass only comes
            alive over "Busy", our near-black background is the problem, not the API.
          </Note>

          <Sample label="1 · Bare GlassView (control)">
            <GlassView style={styles.fill} />
          </Sample>

          <Sample label="2 · regular + dark scheme">
            <GlassView glassEffectStyle="regular" colorScheme="dark" style={styles.fill} />
          </Sample>

          <Sample label="3 · regular + auto scheme">
            <GlassView glassEffectStyle="regular" colorScheme="auto" style={styles.fill} />
          </Sample>

          <Sample label="4 · clear">
            <GlassView glassEffectStyle="clear" style={styles.fill} />
          </Sample>

          <Sample label="5 · clear + club tint">
            <GlassView glassEffectStyle="clear" tintColor={clubColor} style={styles.fill} />
          </Sample>

          <Sample label="6 · regular + rounded (radius 37)">
            <GlassView
              glassEffectStyle="regular"
              colorScheme="dark"
              style={[styles.fill, { borderRadius: 37 }]}
            />
          </Sample>

          <Sample label="7 · WITH our old border + shadow (the mistake)">
            <View style={styles.mistakeWrap}>
              <GlassView
                glassEffectStyle="regular"
                colorScheme="dark"
                style={[styles.fill, { borderRadius: 37 }]}
              />
            </View>
          </Sample>

          <Sample label="8 · GlassContainer, two elements merging">
            <GlassContainer spacing={18} style={styles.fill}>
              <GlassView
                glassEffectStyle="regular"
                colorScheme="dark"
                style={[StyleSheet.absoluteFill, { borderRadius: 37 }]}
              />
              <GlassView
                glassEffectStyle="clear"
                tintColor={clubColor}
                isInteractive
                style={styles.mergePill}
              />
            </GlassContainer>
          </Sample>

          <Sample label="9 · Current tab-bar recipe, full width">
            <GlassContainer spacing={18} style={styles.fill}>
              <GlassView
                glassEffectStyle="regular"
                colorScheme="dark"
                style={[StyleSheet.absoluteFill, { borderRadius: 37 }]}
              />
              <GlassView
                glassEffectStyle="clear"
                tintColor={clubColor + '80'}
                isInteractive
                colorScheme="dark"
                style={styles.mergePill}
              />
            </GlassContainer>
          </Sample>

          <Note>
            Below: the indicator at six tint strengths. Tell me which number looks
            right and I will set it. 1.00 and 0.50 are what shipped and both read as
            paint rather than glass.
          </Note>

          {[0.0, 0.12, 0.22, 0.32, 0.5, 1.0].map(a => (
            <Sample key={a} label={`11 · indicator tint alpha ${a.toFixed(2)}${a === 0 ? ' (none)' : ''}`}>
              <GlassContainer spacing={18} style={styles.fill}>
                <GlassView
                  glassEffectStyle="regular"
                  colorScheme="dark"
                  style={[StyleSheet.absoluteFill, { borderRadius: 37 }]}
                />
                <GlassView
                  glassEffectStyle="clear"
                  {...(a > 0 ? { tintColor: hexToRgba(clubColor, a) } : {})}
                  style={styles.mergePill}
                />
              </GlassContainer>
            </Sample>
          ))}

          <Sample label="10 · BlurView fallback, for comparison">
            <View style={[styles.fill, styles.blurWrap]}>
              <BlurView
                intensity={80}
                tint="systemUltraThinMaterialDark"
                style={[StyleSheet.absoluteFill, { borderRadius: 37 }]}
              />
              <View style={[StyleSheet.absoluteFill, styles.blurTint, { borderRadius: 37 }]} />
            </View>
          </Sample>

          <View style={{ height: 200 }} />
        </ScrollView>

        {/* The actual shipped tab bar, over the selected backdrop. */}
        <LiquidGlassTabBar
          scrollX={labScrollX}
          onTabPress={() => {}}
          clubColor={clubColor}
        />
      </SafeAreaView>
    </View>
  );
}

// ── Backdrops ────────────────────────────────────────────────────────────────

function Backdrops({ kind, clubColor }: { kind: Backdrop; clubColor: string }) {
  if (kind === 'app') {
    // Deliberately identical to HomeScreen's real background.
    return (
      <View style={StyleSheet.absoluteFill}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0c0a0a' }]} />
        <LinearGradient
          colors={[clubColor + '38', clubColor + '00']}
          style={styles.orbTop}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        />
        <LinearGradient
          colors={[clubColor + '1F', clubColor + '00']}
          style={styles.orbBottom}
          start={{ x: 0.5, y: 1 }} end={{ x: 0.5, y: 0 }}
        />
      </View>
    );
  }

  if (kind === 'rich') {
    // Same identity as the app today, but with enough luminance range under the
    // tab bar for the glass to have something to bend. Nothing here is final —
    // it exists to answer "is the background the constraint?".
    return (
      <View style={StyleSheet.absoluteFill}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0B0A12' }]} />
        <LinearGradient
          colors={[clubColor + '66', clubColor + '00']}
          style={styles.orbTop}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        />
        <LinearGradient
          colors={[clubColor + '4D', clubColor + '00']}
          style={styles.orbBottomRich}
          start={{ x: 0.5, y: 1 }} end={{ x: 0.5, y: 0 }}
        />
        <LinearGradient
          colors={['#7C3AED44', '#7C3AED00']}
          style={styles.orbMid}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        />
      </View>
    );
  }

  if (kind === 'busy') {
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#101830' }]}>
        {Array.from({ length: 22 }).map((_, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: (i * 97) % W,
              top: (i * 149) % 900,
              width: 130 + (i % 4) * 60,
              height: 130 + (i % 3) * 70,
              borderRadius: 999,
              backgroundColor: ['#F97316', '#22D3EE', '#A855F7', '#22C55E', '#EF4444', '#EAB308'][i % 6],
              opacity: 0.55,
            }}
          />
        ))}
      </View>
    );
  }

  // High-contrast stripes — the harshest possible test of refraction.
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]}>
      {Array.from({ length: 30 }).map((_, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            top: i * 34,
            left: 0,
            right: 0,
            height: 17,
            backgroundColor: i % 2 ? '#FFFFFF' : '#FF2D55',
          }}
        />
      ))}
    </View>
  );
}

// ── Bits ─────────────────────────────────────────────────────────────────────

function Sample({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.sample}>
      <Text style={styles.sampleLabel}>{label}</Text>
      <View style={styles.sampleBox}>{children}</View>
    </View>
  );
}

function Fact({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <View style={styles.factRow}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text
        style={[
          styles.factValue,
          good === true && { color: '#4ADE80' },
          good === false && { color: '#F87171' },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.note}>
      <Text style={styles.noteText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  orbTop:    { position: 'absolute', top: -160, right: -160, width: W * 1.3, height: 460, borderRadius: 9999 },
  orbBottom: { position: 'absolute', bottom: -160, left: -120, width: W * 1.2, height: 460, borderRadius: 9999 },
  orbBottomRich: { position: 'absolute', bottom: -120, left: -100, width: W * 1.3, height: 520, borderRadius: 9999 },
  orbMid: { position: 'absolute', bottom: 40, right: -140, width: W * 0.95, height: 380, borderRadius: 9999 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingVertical: 12,
  },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },

  readout: {
    marginHorizontal: 24, marginBottom: 12, padding: 12,
    borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  factRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  factLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 11 },
  factValue: { color: '#fff', fontSize: 11, fontWeight: '700' },
  reason: {
    color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 6,
    paddingTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)',
  },

  switcher: { flexDirection: 'row', gap: 8, paddingHorizontal: 24, marginBottom: 8 },
  switchBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  switchBtnOn: { backgroundColor: '#fff', borderColor: '#fff' },
  switchTxt: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' },
  switchTxtOn: { color: '#000' },

  scroll: { paddingHorizontal: 24, paddingTop: 4 },

  note: {
    padding: 10, borderRadius: 10, marginBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  noteText: { color: 'rgba(255,255,255,0.7)', fontSize: 11, lineHeight: 16 },

  sample: { marginBottom: 18 },
  sampleLabel: {
    color: '#fff', fontSize: 11, fontWeight: '700', marginBottom: 6,
    textShadowColor: '#000', textShadowRadius: 4,
  },
  sampleBox: { width: SAMPLE_W, height: SAMPLE_H },
  fill: { width: SAMPLE_W, height: SAMPLE_H },

  // Reproduces exactly what we used to do wrong, for side-by-side comparison.
  mistakeWrap: {
    width: SAMPLE_W, height: SAMPLE_H, borderRadius: 37,
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55, shadowRadius: 28,
  },

  mergePill: {
    position: 'absolute', left: 10, top: 8,
    width: SAMPLE_W * 0.3, height: SAMPLE_H - 16,
    borderRadius: (SAMPLE_H - 16) / 2,
  },

  blurWrap: { borderRadius: 37, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  blurTint: { backgroundColor: 'rgba(255,255,255,0.06)' },
});
