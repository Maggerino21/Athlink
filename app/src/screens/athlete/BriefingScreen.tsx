/**
 * BriefingScreen — the day's briefing, presented as a real iOS sheet.
 *
 * See EventDetailScreen for why this is a route rather than an inline sheet.
 * Draw content only: corners, grabber, detents and dismissal are Apple's.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AthleteStackParamList } from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<AthleteStackParamList, 'Briefing'>;

export default function BriefingScreen({ route }: Props) {
  const { headline, fullSummary, sections } = route.params;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.labelRow}>
          <Text style={styles.star}>✦</Text>
          <Text style={styles.labelText}>DAILY BRIEFING</Text>
        </View>

        <Text style={styles.headline}>{headline}</Text>
        <Text style={styles.summary}>{fullSummary}</Text>

        {sections.map((sec, si) => (
          <View key={si} style={styles.section}>
            <Text style={styles.sectionTitle}>{sec.title}</Text>
            {sec.items.map((item, ii) => (
              <View key={ii} style={styles.itemRow}>
                <View style={styles.itemDot} />
                <Text style={styles.itemText}>{item}</Text>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.footerNote}>
          <Text style={styles.star}>✦</Text>
          <Text style={styles.footerText}>
            Built from your live schedule, feedback, and tasks.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0E1220' },
  content: { padding: 22, paddingTop: 18, paddingBottom: 40 },

  labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  star: { color: 'rgba(167,139,250,0.85)', fontSize: 12, marginRight: 6 },
  labelText: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1.6,
    color: 'rgba(167,139,250,0.85)',
  },

  headline: {
    fontSize: 24, fontWeight: '800', color: '#F1F5F9',
    letterSpacing: -0.5, marginBottom: 12, lineHeight: 30,
  },
  summary: { fontSize: 14, lineHeight: 22, color: 'rgba(255,255,255,0.72)' },

  section: { marginTop: 22 },
  sectionTitle: {
    fontSize: 10, fontWeight: '800', letterSpacing: 1.4,
    color: 'rgba(255,255,255,0.35)', marginBottom: 8,
  },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 7 },
  itemDot: {
    width: 4, height: 4, borderRadius: 2, marginTop: 7, marginRight: 10,
    backgroundColor: 'rgba(167,139,250,0.6)',
  },
  itemText: { flex: 1, fontSize: 13, lineHeight: 19, color: 'rgba(255,255,255,0.75)' },

  footerNote: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginTop: 26, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  footerText: { flex: 1, fontSize: 11, lineHeight: 16, color: 'rgba(255,255,255,0.35)' },
});
