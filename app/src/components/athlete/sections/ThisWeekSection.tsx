import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Dimensions, TouchableOpacity, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const H_PAD = 16;
const GAP   = 12;
const SMALL_W = (SCREEN_WIDTH - H_PAD * 2 - GAP) / 2;

// ── DashCard — matches Figma spec exactly ──────────────────────────────────────
// #0e0d0d fill · 35px radius · outer drop shadow · inner rim glow via border
function DashCard({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: object;
  onPress?: () => void;
}) {
  const inner = (
    <View style={[styles.card, style]}>
      {/* Inner rim glow layer */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={styles.cardRim} />
      </View>
      {children}
    </View>
  );
  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.82} onPress={onPress}>
        {inner}
      </TouchableOpacity>
    );
  }
  return inner;
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface NextMatch {
  opponent: string;
  match_date: string;
  is_home: boolean | null;
  location: string | null;
}

interface UpcomingEvent {
  id: string;
  type: string;
  title: string;
  event_date: string;
  location: string | null;
}

const EVENT_ICONS: Record<string, { icon: string; color: string }> = {
  training: { icon: 'fitness',   color: '#3B82F6' },
  exercise: { icon: 'barbell',   color: '#8B5CF6' },
  recovery: { icon: 'leaf',      color: '#22C55E' },
  travel:   { icon: 'airplane',  color: '#F59E0B' },
  meeting:  { icon: 'people',    color: '#EC4899' },
  other:    { icon: 'calendar',  color: '#6B7280' },
};

// ── Main component ─────────────────────────────────────────────────────────────

export default function ThisWeekSection({ isActive }: { isActive?: boolean }) {
  const { profile } = useAuth();
  const [nextMatch, setNextMatch]           = useState<NextMatch | null>(null);
  const [daysUntil, setDaysUntil]           = useState<number | null>(null);
  const [unreadCount, setUnreadCount]       = useState(0);
  const [pendingCount, setPendingCount]     = useState(0);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading]               = useState(true);
  const [refreshing, setRefreshing]         = useState(false);

  const fetchData = useCallback(async () => {
    if (!profile) return;

    const [matchRes, feedbackRes, tasksRes, eventsRes] = await Promise.all([
      profile.club_id
        ? supabase
            .from('matches')
            .select('opponent, match_date, is_home, location')
            .eq('club_id', profile.club_id)
            .eq('status', 'upcoming')
            .gte('match_date', new Date().toISOString())
            .order('match_date', { ascending: true })
            .limit(1)
            .single()
        : Promise.resolve({ data: null }),

      supabase
        .from('match_feedback')
        .select('id', { count: 'exact', head: true })
        .eq('athlete_id', profile.id)
        .eq('acknowledged', false),

      supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to', profile.id)
        .eq('status', 'pending'),

      profile.club_id
        ? supabase
            .from('events')
            .select('id, type, title, event_date, location')
            .eq('club_id', profile.club_id)
            .gte('event_date', new Date().toISOString())
            .order('event_date', { ascending: true })
            .limit(5)
        : Promise.resolve({ data: [] }),
    ]);

    if (matchRes.data) {
      setNextMatch(matchRes.data as NextMatch);
      const days = Math.ceil(
        (new Date((matchRes.data as NextMatch).match_date).getTime() - Date.now()) / 86400000
      );
      setDaysUntil(days);
    } else {
      setNextMatch(null);
      setDaysUntil(null);
    }

    setUnreadCount((feedbackRes as any).count ?? 0);
    setPendingCount((tasksRes as any).count ?? 0);
    setUpcomingEvents((eventsRes.data as UpcomingEvent[]) ?? []);
    setLoading(false);
  }, [profile]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (isActive) fetchData(); }, [isActive]); // eslint-disable-line

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const matchLabel = daysUntil === null
    ? null
    : daysUntil === 0 ? 'Today' : `${daysUntil}d`;

  const matchTime = nextMatch
    ? new Date(nextMatch.match_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : null;

  const matchDay = nextMatch
    ? new Date(nextMatch.match_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
    : null;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="rgba(255,255,255,0.3)"
        />
      }
    >
      {/* ── Large card: next match ──────────────────────────────────────── */}
      <DashCard style={styles.largeCard}>
        {nextMatch ? (
          <>
            <View style={styles.largeHeader}>
              <Text style={styles.matchBadgeText}>NEXT MATCH</Text>
              {matchLabel && <Text style={styles.countdown}>{matchLabel}</Text>}
            </View>
            <Text style={styles.matchTitle}>
              {nextMatch.is_home
                ? `${profile?.club_name ?? 'Us'} vs ${nextMatch.opponent}`
                : `${nextMatch.opponent} vs ${profile?.club_name ?? 'Us'}`}
            </Text>
            <Text style={styles.matchSub}>
              {matchDay} · {matchTime}
              {nextMatch.location ? ` · ${nextMatch.location}` : ''}
            </Text>
            {daysUntil !== null && daysUntil <= 2 && (
              <View style={styles.alertRow}>
                <View style={styles.alertDot} />
                <Text style={styles.alertText}>
                  {daysUntil === 0 ? 'Match day — stay focused.' : 'Focus on recovery and activation.'}
                </Text>
              </View>
            )}
          </>
        ) : loading ? (
          <Text style={styles.matchSub}>Loading...</Text>
        ) : (
          <>
            <Text style={styles.matchBadgeText}>NEXT MATCH</Text>
            <Text style={styles.matchTitle}>No upcoming matches</Text>
            <Text style={styles.matchSub}>Check back with your coach.</Text>
          </>
        )}
      </DashCard>

      {/* ── Two small stat cards ────────────────────────────────────────── */}
      <View style={styles.smallRow}>
        <DashCard style={styles.smallCard}>
          <Text style={styles.smallCategory}>FEEDBACK</Text>
          <Text style={styles.smallValue}>{loading ? '–' : unreadCount}</Text>
          <Text style={styles.smallLabel}>unread</Text>
          <View style={[styles.smallAccent, { backgroundColor: '#3B82F6' }]} />
        </DashCard>

        <DashCard style={styles.smallCard}>
          <Text style={styles.smallCategory}>TASKS</Text>
          <Text style={styles.smallValue}>{loading ? '–' : pendingCount}</Text>
          <Text style={styles.smallLabel}>pending</Text>
          <View style={[styles.smallAccent, { backgroundColor: '#22C55E' }]} />
        </DashCard>
      </View>

      {/* ── Upcoming events ─────────────────────────────────────────────── */}
      {upcomingEvents.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Coming up</Text>
          {upcomingEvents.map(evt => {
            const meta    = EVENT_ICONS[evt.type] ?? EVENT_ICONS.other;
            const d       = new Date(evt.event_date);
            const dateStr = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
            const timeStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            return (
              <DashCard key={evt.id} style={styles.eventCard}>
                <View style={styles.eventRow}>
                  <View style={[styles.eventIconWrap, { backgroundColor: meta.color + '18' }]}>
                    <Ionicons name={meta.icon as any} size={17} color={meta.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventTitle}>{evt.title}</Text>
                    <Text style={styles.eventMeta}>
                      {dateStr} · {timeStr}
                      {evt.location ? ` · ${evt.location}` : ''}
                    </Text>
                  </View>
                </View>
              </DashCard>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const CARD_BG     = '#0e0d0d';
const CARD_RADIUS = 35;
const RIM_COLOR   = 'rgba(94,94,94,0.32)';

const styles = StyleSheet.create({
  scroll:  { flex: 1 },
  content: { paddingHorizontal: H_PAD, paddingTop: 14, paddingBottom: 24, gap: GAP },

  // ── DashCard base
  card: {
    backgroundColor: CARD_BG,
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
    // Drop shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12,
  },
  cardRim: {
    flex: 1,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    borderColor: RIM_COLOR,
  },

  // ── Large match card
  largeCard: {
    padding: 24,
    minHeight: 160,
  },
  largeHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 16,
  },
  matchBadgeText: {
    fontSize: 10, fontWeight: '700',
    color: 'rgba(255,255,255,0.25)',
    letterSpacing: 1.4,
  },
  countdown: {
    fontSize: 32, fontWeight: '800',
    color: '#FFFFFF', letterSpacing: -1,
    lineHeight: 34,
  },
  matchTitle: {
    fontSize: 22, fontWeight: '700',
    color: '#F1F5F9', letterSpacing: -0.4,
    marginBottom: 6,
    lineHeight: 28,
  },
  matchSub: {
    fontSize: 13, color: 'rgba(255,255,255,0.3)',
    lineHeight: 18,
  },
  alertRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginTop: 16, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  alertDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#F97316',
  },
  alertText: {
    fontSize: 12, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic',
  },

  // ── Small stat cards
  smallRow:  { flexDirection: 'row', gap: GAP },
  smallCard: {
    width: SMALL_W,
    padding: 20,
    minHeight: 150,
    justifyContent: 'flex-end',
  },
  smallCategory: {
    fontSize: 9, fontWeight: '700',
    color: 'rgba(255,255,255,0.2)',
    letterSpacing: 1.6,
    marginBottom: 'auto' as any,
    paddingBottom: 20,
  },
  smallValue: {
    fontSize: 52, fontWeight: '800',
    color: '#FFFFFF', letterSpacing: -3,
    lineHeight: 54, marginBottom: 2,
  },
  smallLabel: {
    fontSize: 13, color: 'rgba(255,255,255,0.3)',
    fontWeight: '400',
  },
  smallAccent: {
    position: 'absolute', top: 20, right: 20,
    width: 8, height: 8, borderRadius: 4,
  },

  // ── Section label
  sectionLabel: {
    fontSize: 10, fontWeight: '700',
    color: 'rgba(255,255,255,0.2)',
    textTransform: 'uppercase', letterSpacing: 1.4,
    marginTop: 6,
  },

  // ── Event rows
  eventCard: { padding: 16 },
  eventRow:  { flexDirection: 'row', alignItems: 'center', gap: 14 },
  eventIconWrap: {
    width: 40, height: 40, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  eventTitle: {
    fontSize: 14, fontWeight: '600',
    color: 'rgba(255,255,255,0.82)', marginBottom: 3,
  },
  eventMeta: { fontSize: 12, color: 'rgba(255,255,255,0.28)' },
});
