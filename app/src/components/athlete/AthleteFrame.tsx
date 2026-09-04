/**
 * AthleteFrame — the header every athlete tab sits under.
 *
 * Exists because `UITabBarController` owns full-screen children, so a header
 * rendered *above* the tabs (as it was when the app used a horizontal pager)
 * has nowhere to live.
 *
 * **The backdrop must live here, inside each tab.** Hoisting it behind
 * `BottomTabs` and making these screens transparent was tried and does not
 * work: `BottomTabsScreen` renders an opaque container, so the hoisted
 * backdrop was hidden and the whole app went white. Do not try it again.
 */
import React from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { clubGradientOrbs } from '../../utils/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface AthleteFrameProps {
  clubColor: string;
  greeting: string;
  name: string;
  initials: string;
  clubName: string | null;
  dateLabel: string;
  nextMatchLabel: string | null;
  onAvatarPress: () => void;
  onAvatarLongPress?: () => void;
  children: React.ReactNode;
}

export default function AthleteFrame({
  clubColor, greeting, name, initials, clubName, dateLabel,
  nextMatchLabel, onAvatarPress, onAvatarLongPress, children,
}: AthleteFrameProps) {
  const orbs = clubGradientOrbs(clubColor);

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0c0a0a' }]} />
        <LinearGradient colors={orbs.top}    style={styles.orbTopRight}   start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} />
        <LinearGradient colors={orbs.bottom} style={styles.orbBottomLeft} start={{ x: 0.5, y: 1 }} end={{ x: 0.5, y: 0 }} />
      </View>

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.greeting}>{greeting}</Text>
              <Text style={styles.athleteName}>{name || '—'}</Text>
            </View>
            <TouchableOpacity
              style={styles.avatarWrap}
              onPress={onAvatarPress}
              onLongPress={onAvatarLongPress}
              delayLongPress={500}
              activeOpacity={0.8}
            >
              <View style={[styles.avatar, { backgroundColor: clubColor }]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.metaRow}>
            {clubName && <GlassChip label={clubName} />}
            <GlassChip label={dateLabel} />
            {nextMatchLabel && <GlassChip label={nextMatchLabel} accent accentColor={clubColor} />}
          </View>
        </View>

        <View style={styles.content}>{children}</View>
      </SafeAreaView>
    </View>
  );
}

function GlassChip({
  label, accent = false, accentColor = '#3B82F6',
}: { label: string; accent?: boolean; accentColor?: string }) {
  return (
    <View style={[styles.chip, accent && { backgroundColor: accentColor + '26', borderColor: accentColor + '4D' }]}>
      <View style={styles.chipSpec} />
      <Text style={[styles.chipText, accent && { color: accentColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0c0a0a' },
  safeArea: { flex: 1 },
  content: { flex: 1 },
  orbTopRight:   { position: 'absolute', top: -160, right: -160, width: SCREEN_WIDTH * 1.3, height: SCREEN_HEIGHT * 0.65, borderRadius: 9999 },
  orbBottomLeft: { position: 'absolute', bottom: -160, left: -120, width: SCREEN_WIDTH * 1.2, height: SCREEN_HEIGHT * 0.65, borderRadius: 9999 },
  header: { paddingTop: 6, paddingBottom: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  greeting:    { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 3 },
  athleteName: { fontSize: 26, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5 },
  avatarWrap:  { shadowColor: '#000', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8 },
  avatar:      { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)' },
  avatarText:  { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  metaRow:     { flexDirection: 'row', gap: 8 },
  chip:        { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  chipSpec:    { position: 'absolute', top: 0, left: 8, right: 8, height: 1, backgroundColor: 'rgba(255,255,255,0.25)' },
  chipText:    { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
});
