import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity, RefreshControl } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import GlassCard from '../../ui/GlassCard';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const H_PAD = 16;
const GAP = 10;
const SMALL_W = (SCREEN_WIDTH - H_PAD * 2 - GAP) / 2;

interface NextMatch {
  opponent: string;
  match_date: string;
  is_home: boolean | null;
  location: string | null;
}

export default function ThisWeekSection({ isActive }: { isActive?: boolean }) {
  const { profile } = useAuth();
  const [nextMatch, setNextMatch]         = useState<NextMatch | null>(null);
  const [daysUntil, setDaysUntil]         = useState<number | null>(null);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [pendingCount, setPendingCount]   = useState(0);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);

  const fetchData = useCallback(async () => {
    if (!profile) return;

    const [matchRes, feedbackRes, tasksRes] = await Promise.all([
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
    setLoading(false);
  }, [profile]);

  // Initial load
  useEffect(() => { fetchData(); }, [fetchData]);

  // Re-fetch when this tab becomes the active page
  useEffect(() => {
    if (isActive) fetchData();
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const matchLabel = daysUntil === null
    ? null
    : daysUntil === 0 ? 'Today' : `${daysUntil}d away`;

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
          tintColor="rgba(255,255,255,0.4)"
        />
      }
    >
      {/* ── Large card: upcoming match ── */}
      <GlassCard elevated intensity={70}>
        {nextMatch ? (
          <>
            <View style={styles.largeHeader}>
              <View style={styles.matchBadge}>
                <Text style={styles.matchBadgeText}>Next Match</Text>
              </View>
              <Text style={styles.countdown}>{matchLabel}</Text>
            </View>
            <Text style={styles.matchTitle}>
              {nextMatch.is_home
                ? `FC United vs ${nextMatch.opponent}`
                : `${nextMatch.opponent} vs FC United`}
            </Text>
            <Text style={styles.matchSub}>
              {matchDay} · {matchTime} · {nextMatch.is_home ? 'Home' : 'Away'}
              {nextMatch.location ? ` · ${nextMatch.location}` : ''}
            </Text>
          </>
        ) : loading ? (
          <Text style={styles.matchSub}>Loading...</Text>
        ) : (
          <>
            <View style={styles.largeHeader}>
              <View style={styles.matchBadge}>
                <Text style={styles.matchBadgeText}>No matches</Text>
              </View>
            </View>
            <Text style={styles.matchTitle}>No upcoming matches</Text>
            <Text style={styles.matchSub}>Check back with your coach for the schedule.</Text>
          </>
        )}
      </GlassCard>

      {/* ── Two small cards ── */}
      <View style={styles.smallRow}>
        <TouchableOpacity activeOpacity={0.85} style={{ width: SMALL_W }}>
          <GlassCard style={styles.smallCard} intensity={60}>
            <View style={styles.smallIconTop}>
              <Ionicons name="chatbubble" size={16} color="#60A5FA" />
            </View>
            <Text style={styles.smallValue}>{loading ? '–' : unreadCount}</Text>
            <Text style={styles.smallLabel}>New{'\n'}Feedback</Text>
            <View style={[styles.smallDot, { backgroundColor: '#3B82F6' }]} />
          </GlassCard>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.85} style={{ width: SMALL_W }}>
          <GlassCard style={styles.smallCard} intensity={60}>
            <View style={styles.smallIconTop}>
              <Ionicons name="checkmark-circle" size={16} color="#4ADE80" />
            </View>
            <Text style={styles.smallValue}>{loading ? '–' : pendingCount}</Text>
            <Text style={styles.smallLabel}>Tasks{'\n'}Pending</Text>
            <View style={[styles.smallDot, { backgroundColor: '#22C55E' }]} />
          </GlassCard>
        </TouchableOpacity>
      </View>

      {/* ── Match countdown detail ── */}
      {nextMatch && daysUntil !== null && daysUntil <= 7 && (
        <>
          <Text style={styles.sectionLabel}>Match Week</Text>
          <GlassCard radius={12} padding={14} intensity={55}>
            <View style={styles.matchWeekRow}>
              <Ionicons name="football" size={18} color="#60A5FA" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.matchWeekTitle}>
                  {daysUntil === 0 ? 'Match day!' : `${daysUntil} day${daysUntil === 1 ? '' : 's'} until kick-off`}
                </Text>
                <Text style={styles.matchWeekSub}>
                  {daysUntil <= 2
                    ? 'Focus on recovery and activation. Stay sharp.'
                    : 'Prepare well. Review your coach feedback before match day.'}
                </Text>
              </View>
            </View>
          </GlassCard>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll:  { flex: 1 },
  content: { paddingHorizontal: H_PAD, paddingTop: 18, paddingBottom: 16, gap: GAP },

  largeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  matchBadge: {
    backgroundColor: 'rgba(29,78,216,0.35)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)',
  },
  matchBadgeText: { fontSize: 11, color: '#93C5FD', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  countdown:  { fontSize: 30, fontWeight: '700', color: '#FFFFFF', letterSpacing: -1 },
  matchTitle: { fontSize: 20, fontWeight: '700', color: '#F1F5F9', letterSpacing: -0.3, marginBottom: 4 },
  matchSub:   { fontSize: 13, color: 'rgba(255,255,255,0.35)', marginBottom: 4 },

  smallRow: { flexDirection: 'row', gap: GAP },
  smallCard: { minHeight: 148, justifyContent: 'flex-end' },
  smallIconTop: {
    position: 'absolute', top: 16, right: 16,
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  smallValue: { fontSize: 44, fontWeight: '700', color: '#FFFFFF', letterSpacing: -2, lineHeight: 50, marginBottom: 4 },
  smallLabel: { fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 17, fontWeight: '500' },
  smallDot:   { position: 'absolute', top: 18, left: 16, width: 7, height: 7, borderRadius: 4 },

  sectionLabel: {
    fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.25)',
    textTransform: 'uppercase', letterSpacing: 1.1,
  },

  matchWeekRow: { flexDirection: 'row', alignItems: 'flex-start' },
  matchWeekTitle: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.85)', marginBottom: 4 },
  matchWeekSub: { fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 18 },
});
