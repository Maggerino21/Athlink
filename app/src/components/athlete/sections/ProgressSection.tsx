import React from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import GlassCard from '../../ui/GlassCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const H_PAD = 16;
const GAP = 10;
const STAT_W = (SCREEN_WIDTH - H_PAD * 2 - GAP) / 2;

const STATS = [
  { label: 'Feedback received', value: '14', sub: 'last 30 days', trend: '+3', trendUp: true },
  { label: 'Tasks completed',   value: '9/11', sub: 'this month',  trend: null,  trendUp: true },
  { label: 'Ack. rate',         value: '100%', sub: 'all feedback', trend: null, trendUp: true },
  { label: 'Sessions attended', value: '18',  sub: 'last 30 days', trend: null,  trendUp: true },
];

const THEMES = [
  { label: 'Press triggers',     count: 5, icon: 'flash'        as const },
  { label: 'Off-ball positioning', count: 3, icon: 'locate'     as const },
  { label: 'Recovery compliance', count: 2, icon: 'fitness'     as const },
];

const WINS = [
  'Strong link-up play vs Rovers — 22 Feb',
  'Full recovery session completed — 20 Feb',
  'Pre-match activation goal met — 17 Feb',
];

export default function ProgressSection() {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Stats grid */}
      <Text style={styles.sectionLabel}>This Month</Text>
      <View style={styles.statGrid}>
        {STATS.map((stat, i) => (
          <GlassCard key={i} style={{ width: STAT_W }} intensity={60} padding={14}>
            <View style={styles.statTop}>
              <Text style={styles.statValue}>{stat.value}</Text>
              {stat.trend && (
                <View style={styles.trendBadge}>
                  <Text style={styles.trendText}>{stat.trend}</Text>
                </View>
              )}
            </View>
            <Text style={styles.statLabel}>{stat.label}</Text>
            <Text style={styles.statSub}>{stat.sub}</Text>
          </GlassCard>
        ))}
      </View>

      {/* Coaching themes */}
      <Text style={styles.sectionLabel}>Coaching Themes</Text>
      <GlassCard elevated intensity={65}>
        <Text style={styles.themeSub}>Areas your coaches have focused on most</Text>
        {THEMES.map((item, i) => (
          <View key={i} style={[styles.themeRow, i > 0 && styles.themeRowBorder]}>
            <View style={styles.themeIconWrap}>
              <Ionicons name={item.icon} size={15} color="#60A5FA" />
            </View>
            <Text style={styles.themeLabel}>{item.label}</Text>
            <View style={styles.themeCount}>
              <Text style={styles.themeCountText}>{item.count}×</Text>
            </View>
          </View>
        ))}
      </GlassCard>

      {/* Recent wins */}
      <Text style={styles.sectionLabel}>Recent Wins</Text>
      {WINS.map((win, i) => (
        <GlassCard key={i} radius={12} padding={14} intensity={52}>
          <View style={styles.winRow}>
            <Text style={styles.winStar}>✦</Text>
            <Text style={styles.winText}>{win}</Text>
          </View>
        </GlassCard>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:  { flex: 1 },
  content: { paddingHorizontal: H_PAD, paddingTop: 18, paddingBottom: 16, gap: GAP },

  sectionLabel: {
    fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.25)',
    textTransform: 'uppercase', letterSpacing: 1.1,
  },

  // Stat grid
  statGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  statTop:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  statValue:  { fontSize: 26, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5 },
  trendBadge: { backgroundColor: 'rgba(34,197,94,0.15)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)' },
  trendText:  { fontSize: 11, color: '#4ADE80', fontWeight: '700' },
  statLabel:  { fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: '500', marginBottom: 2 },
  statSub:    { fontSize: 11, color: 'rgba(255,255,255,0.22)' },

  // Themes
  themeSub:       { fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 14, lineHeight: 18 },
  themeRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  themeRowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  themeIconWrap:  { width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(59,130,246,0.12)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)', justifyContent: 'center', alignItems: 'center' },
  themeLabel:     { flex: 1, fontSize: 14, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  themeCount:     { backgroundColor: 'rgba(59,130,246,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(59,130,246,0.25)' },
  themeCountText: { fontSize: 12, color: '#60A5FA', fontWeight: '700' },

  // Wins
  winRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  winStar: { color: '#FBBF24', fontSize: 12, marginTop: 2 },
  winText: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 20 },
});
