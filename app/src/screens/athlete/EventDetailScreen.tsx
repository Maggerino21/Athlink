/**
 * EventDetailScreen — an event or fixture, presented as a real iOS sheet.
 *
 * This is a navigation *route*, not an inline component, because that is what
 * it takes to get `UISheetPresentationController`. React Navigation's
 * native-stack presents it with `presentation: 'formSheet'`, and iOS then owns
 * the detents, the grabber, interactive dismissal, scroll-to-expand, the
 * stacked-card recede of the screen behind, and — on iOS 26 — the sheet's own
 * Liquid Glass material.
 *
 * It replaces a hand-built `SlideUpSheet`: ~230 lines reimplementing drag,
 * velocity projection, rubber-band overscroll and backdrop fade. Same lesson as
 * the tab bar — `expo-glass-effect` gives the material, the platform gives the
 * control, and hand-building the control is what makes it read as a copy.
 *
 * The sheet chrome is Apple's, so this screen draws only its *content*. Do not
 * add a drag handle, a backdrop, or a close button — the presentation supplies
 * all three.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { hexToRgba } from '../../utils/theme';
import { EVENT_META } from '../../components/athlete/eventTypes';
import type { AthleteStackParamList } from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<AthleteStackParamList, 'EventDetail'>;

export default function EventDetailScreen({ route }: Props) {
  const { event } = route.params;
  const { profile } = useAuth();
  const clubColor = profile?.club_color ?? '#3B82F6';

  const meta = EVENT_META[event.type];
  const isMatch = event.source === 'match';

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Opponent crest, when the provider gave us one. Falls back to the
            type badge rather than a broken image box. */}
        {isMatch && event.opponent_logo_url ? (
          <View style={styles.crestRow}>
            <Image
              source={{ uri: event.opponent_logo_url }}
              style={styles.crest}
              resizeMode="contain"
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.crestTitle}>{event.title}</Text>
              <Text style={styles.crestSub}>
                {event.is_home === false ? 'Away' : 'Home'}
                {event.location ? ` · ${event.location}` : ''}
              </Text>
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.title}>{event.title}</Text>
            <View style={[styles.typeBadge, { backgroundColor: hexToRgba(meta.color, 0.12), borderColor: hexToRgba(meta.color, 0.25) }]}>
              <Ionicons name={meta.icon as any} size={14} color={meta.color} style={{ marginRight: 6 }} />
              <Text style={[styles.typeText, { color: meta.color }]}>
                {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
              </Text>
            </View>
          </>
        )}

        {/* Meet time and place lead for a match — they are what an athlete
            opens this to find, and they matter more than kick-off. */}
        {isMatch && (event.meet_time || event.meet_location) && (
          <View style={[styles.meetBlock, { borderColor: hexToRgba(clubColor, 0.3), backgroundColor: hexToRgba(clubColor, 0.08) }]}>
            <Text style={[styles.meetLabel, { color: clubColor }]}>MEET</Text>
            {event.meet_time && <Text style={styles.meetPrimary}>{event.meet_time}</Text>}
            {event.meet_location && <Text style={styles.meetSecondary}>{event.meet_location}</Text>}
          </View>
        )}

        {/* Multi-day blocks say so, rather than looking like a one-day event
            that mysteriously repeats. */}
        {event.spanTotal && event.spanTotal > 1 && (
          <MetaRow icon="calendar-outline" text={`Day ${event.spanDay} of ${event.spanTotal}`} />
        )}

        {event.start_time && (
          <MetaRow
            icon="time-outline"
            text={isMatch ? `Kick-off ${event.start_time}` : event.start_time}
          />
        )}

        {event.location && !(isMatch && event.opponent_logo_url) && (
          <MetaRow icon="location-outline" text={event.location} />
        )}

        <View style={styles.divider} />

        {/* Coach's notes for a match, otherwise the event description. */}
        {isMatch && event.notes ? (
          <Text style={styles.description}>{event.notes}</Text>
        ) : event.description ? (
          <Text style={styles.description}>{event.description}</Text>
        ) : (
          <Text style={styles.noDesc}>No additional details.</Text>
        )}
      </ScrollView>
    </View>
  );
}

function MetaRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.metaRow}>
      <Ionicons name={icon as any} size={16} color="rgba(255,255,255,0.3)" style={styles.metaIcon} />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Sheet chrome (corners, material, grabber) belongs to the presentation, so
  // this only needs to fill and tint.
  root: { flex: 1, backgroundColor: '#0E1220' },
  content: { padding: 22, paddingTop: 18, paddingBottom: 40 },

  title: { fontSize: 22, fontWeight: '800', color: '#F1F5F9', letterSpacing: -0.3, marginBottom: 10 },

  crestRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  crest: { width: 54, height: 54, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)' },
  crestTitle: { fontSize: 19, fontWeight: '800', color: '#F1F5F9', letterSpacing: -0.3 },
  crestSub: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 3 },

  typeBadge: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    borderWidth: 1, marginBottom: 14,
  },
  typeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },

  meetBlock: {
    borderRadius: 14, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 12,
  },
  meetLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 4 },
  meetPrimary: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.6 },
  meetSecondary: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 2 },

  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  metaIcon: { marginRight: 9 },
  metaText: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },

  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 16 },

  description: { fontSize: 14, lineHeight: 21, color: 'rgba(255,255,255,0.75)' },
  noDesc: { fontSize: 14, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' },
});
