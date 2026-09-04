import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Dimensions, RefreshControl,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  withSequence, runOnJS, Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import PressableScale from '../../ui/PressableScale';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AthleteStackParamList } from '../../../navigation/RootNavigator';
import haptics from '../../../utils/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const H_PAD = 16;
const GAP   = 12;
const SMALL_W = (SCREEN_WIDTH - H_PAD * 2 - GAP) / 2;

// ── DashCard ───────────────────────────────────────────────────────────────────
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
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={styles.cardRim} />
      </View>
      {children}
    </View>
  );
  if (onPress) {
    return (
      <PressableScale onPress={onPress} scaleTo={0.975} haptic="medium">
        {inner}
      </PressableScale>
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
  // Club-owned matchday detail — what the athlete actually needs to know.
  meet_time: string | null;
  meet_location: string | null;
  notes: string | null;
  opponent_logo_url: string | null;
}

interface UpcomingEvent {
  id: string;
  type: string;
  title: string;
  event_date: string;
  location: string | null;
}

interface SummaryData {
  headline: string;
  bullets: string[];
  fullSummary: string;
  sections: Array<{ title: string; items: string[] }>;
}

const EVENT_ICONS: Record<string, { icon: string; color: string }> = {
  training: { icon: 'fitness',      color: '#3B82F6' },
  home:     { icon: 'home',         color: '#34D399' },
  rehab:    { icon: 'medkit',       color: '#A78BFA' },
  exercise: { icon: 'barbell',      color: '#8B5CF6' },
  recovery: { icon: 'leaf',         color: '#22C55E' },
  meeting:  { icon: 'people',       color: '#EC4899' },
  match:    { icon: 'football',     color: '#F97316' },
  vacation: { icon: 'partly-sunny', color: '#FBBF24' },
  other:    { icon: 'calendar',     color: '#6B7280' },
};

// ── Build summary from live data ───────────────────────────────────────────────
function buildSummary(
  nextMatch: NextMatch | null,
  daysUntil: number | null,
  unreadCount: number,
  pendingCount: number,
  upcomingEvents: UpcomingEvent[]
): SummaryData {
  const bullets: string[] = [];
  const sections: Array<{ title: string; items: string[] }> = [];

  // Match context
  if (nextMatch && daysUntil !== null) {
    if (daysUntil === 0) {
      bullets.push(`Match day vs ${nextMatch.opponent} — stay focused`);
    } else if (daysUntil === 1) {
      bullets.push(`Match tomorrow vs ${nextMatch.opponent} — light activation only`);
    } else if (daysUntil <= 7) {
      bullets.push(`Match vs ${nextMatch.opponent} in ${daysUntil} days`);
    }
    const matchItems = [`Opponent: ${nextMatch.opponent}`];
    const matchTime = new Date(nextMatch.match_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const matchDay  = new Date(nextMatch.match_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
    matchItems.push(`Kick-off: ${matchDay} at ${matchTime}`);
    if (nextMatch.location) matchItems.push(`Venue: ${nextMatch.location}`);
    matchItems.push(nextMatch.is_home ? 'Home fixture' : 'Away fixture');
    if (daysUntil !== null && daysUntil <= 2) {
      matchItems.push('Focus on recovery and activation — no heavy loading');
    }
    sections.push({ title: 'MATCH', items: matchItems });
  }

  // Feedback
  if (unreadCount > 0) {
    bullets.push(`${unreadCount} coaching note${unreadCount > 1 ? 's' : ''} waiting for you`);
    sections.push({
      title: 'COACHING',
      items: [`${unreadCount} unread message${unreadCount > 1 ? 's' : ''} from your staff — head to the Feedback tab to review and respond`],
    });
  }

  // Tasks
  if (pendingCount > 0) {
    bullets.push(`${pendingCount} task${pendingCount > 1 ? 's' : ''} to complete this week`);
    sections.push({
      title: 'TASKS',
      items: [`${pendingCount} pending task${pendingCount > 1 ? 's' : ''} — open the Tasks tab to check what's due`],
    });
  }

  // Upcoming events as bullets if still space
  if (upcomingEvents.length > 0 && bullets.length < 3) {
    const evt = upcomingEvents[0];
    const d = new Date(evt.event_date);
    const dayStr  = d.toLocaleDateString('en-GB', { weekday: 'short' });
    const timeStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    bullets.push(`${evt.title} — ${dayStr} at ${timeStr}`);
  }

  if (upcomingEvents.length > 0) {
    sections.push({
      title: 'SCHEDULE',
      items: upcomingEvents.slice(0, 4).map(evt => {
        const d = new Date(evt.event_date);
        const dayStr  = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
        const timeStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        return `${evt.title} — ${dayStr} at ${timeStr}`;
      }),
    });
  }

  // Fallback bullets
  if (bullets.length === 0) {
    bullets.push('No upcoming matches scheduled');
    if (unreadCount === 0) bullets.push('All feedback reviewed');
    if (pendingCount === 0) bullets.push('All tasks up to date');
  }

  // Headline
  let headline = "Here's your day.";
  if (nextMatch && daysUntil !== null) {
    if (daysUntil === 0) headline = 'Match day. Stay focused.';
    else if (daysUntil === 1) headline = 'Match tomorrow. Rest up.';
    else if (daysUntil <= 2) headline = 'Match week. Stay sharp.';
    else if (daysUntil <= 7) headline = `${daysUntil} days to match day.`;
    else headline = 'Keep the momentum going.';
  } else if (unreadCount > 0) {
    headline = 'Your coach left you notes.';
  } else if (pendingCount > 0) {
    headline = 'Tasks need your attention.';
  } else {
    headline = 'Looking good this week.';
  }

  // Full summary paragraph
  let fullSummary = '';
  if (nextMatch && daysUntil !== null) {
    if (daysUntil === 0) {
      fullSummary = `It's match day. Focus on your warm-up, stay composed, and trust your preparation. Your team needs you at your best — everything you've worked on this week leads to today.`;
    } else if (daysUntil === 1) {
      fullSummary = `Your match against ${nextMatch.opponent} is tomorrow. Keep it light today — activation, sleep, and mental prep. Avoid anything that could compromise how you feel at kick-off.`;
    } else if (daysUntil <= 2) {
      fullSummary = `Match against ${nextMatch.opponent} is ${daysUntil} days out. Prioritise recovery over hard training, make sure you've reviewed any coaching notes, and get your head into the game plan.`;
    } else {
      fullSummary = `You have ${daysUntil} days until your match against ${nextMatch.opponent}. Use this window to build form, review feedback from your coaches, and clear your task list before match week.`;
    }
  } else {
    fullSummary = 'No upcoming match right now. Keep training consistently, stay on top of your tasks, and review any coaching notes to keep developing.';
  }

  return { headline, bullets: bullets.slice(0, 3), fullSummary, sections };
}

// ── AI Summary Card ────────────────────────────────────────────────────────────
function AISummaryCard({
  headline,
  bullets,
  onPress,
  loading,
}: {
  headline: string;
  bullets: string[];
  onPress: () => void;
  loading: boolean;
}) {
  const pressed = useSharedValue(0);
  const bounce  = useSharedValue(1);
  const glow    = useSharedValue(0);

  const fire = useCallback(() => {
    haptics.medium();
    onPress();
  }, [onPress]);

  const tap = Gesture.Tap()
    .maxDuration(4000)
    .maxDistance(14)
    .onBegin(() => {
      pressed.value = withTiming(1, { duration: 90, easing: Easing.out(Easing.quad) });
    })
    .onFinalize(() => {
      pressed.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) });
    })
    .onEnd((_e, success) => {
      if (!success) return;
      // Bubbly: overshoot, then settle.
      bounce.value = withSequence(
        withSpring(1.028, { duration: 260, dampingRatio: 0.42 }),
        withSpring(1,     { duration: 380, dampingRatio: 0.85 })
      );
      // Border glow pulse.
      glow.value = withSequence(
        withTiming(1, { duration: 55 }),
        withTiming(0, { duration: 450 })
      );
      runOnJS(fire)();
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bounce.value * (1 - pressed.value * 0.037) }],
  }));

  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  return (
    <GestureDetector gesture={tap}>
      <Animated.View style={[styles.aiCard, cardStyle]}>

        {/* Top-corner AI tint gradient */}
        <LinearGradient
          colors={['rgba(139,92,246,0.2)', 'rgba(99,102,241,0.08)', 'transparent']}
          style={styles.aiCardTint}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          pointerEvents="none"
        />

        {/* Glow border flash on tap */}
        <Animated.View
          style={[styles.aiCardGlowBorder, glowStyle]}
          pointerEvents="none"
        />

        {/* Header row */}
        <View style={styles.aiHeader}>
          <View style={styles.aiLabelRow}>
            <Text style={styles.aiLabelStar}>✦</Text>
            <Text style={styles.aiLabelText}>DAILY BRIEFING</Text>
          </View>
          <Ionicons name="sparkles" size={15} color="rgba(167,139,250,0.55)" />
        </View>

        {/* Divider */}
        <View style={styles.aiDivider} />

        {/* Headline or loading skeleton */}
        {loading ? (
          <View style={styles.aiSkeletonWrap}>
            <View style={[styles.aiSkeletonLine, { width: '75%' }]} />
            <View style={[styles.aiSkeletonLine, { width: '55%', marginTop: 8 }]} />
          </View>
        ) : (
          <Text style={styles.aiHeadline}>{headline}</Text>
        )}

        {/* Bullets */}
        {!loading && (
          <View style={styles.aiBulletsWrap}>
            {bullets.map((b, i) => (
              <View key={i} style={styles.aiBulletRow}>
                <View style={styles.aiBulletDot} />
                <Text style={styles.aiBulletText} numberOfLines={1}>{b}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Footer tap hint */}
        {!loading && (
          <View style={styles.aiFooter}>
            <Text style={styles.aiFooterText}>Full summary</Text>
            <Ionicons name="chevron-forward" size={11} color="rgba(167,139,250,0.38)" />
          </View>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

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
  const navigation = useNavigation<NativeStackNavigationProp<AthleteStackParamList>>();

  const fetchData = useCallback(async () => {
    if (!profile) return;

    const [matchRes, feedbackRes, tasksRes, eventsRes] = await Promise.all([
      profile.club_id
        ? supabase
            .from('matches')
            .select('opponent, match_date, is_home, location, meet_time, meet_location, notes, opponent_logo_url')
            .eq('club_id', profile.club_id)
            .eq('status', 'upcoming')
            // Fixtures a coach removed are hidden, not deleted — a real DELETE
            // would be undone by the next provider sync. Every read must filter.
            .is('suppressed_at', null)
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

      // Squad-wide events have NO event_assignments rows, and RLS only lets an
      // athlete read their own — so filtering client-side by assignment hid
      // every event meant for the whole squad. Resolved server-side instead.
      (async () => {
        const from = new Date();
        const to = new Date();
        to.setDate(to.getDate() + 21);
        const { data } = await supabase.rpc('visible_events_for_me', {
          p_from: from.toISOString(),
          p_to: to.toISOString(),
        });
        return { data: (data ?? []).slice(0, 5) };
      })(),
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

  const summary = buildSummary(nextMatch, daysUntil, unreadCount, pendingCount, upcomingEvents);

  return (
    <>
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
        {/* ── AI Daily Summary card ──────────────────────────────────────── */}
        <AISummaryCard
          headline={summary.headline}
          bullets={summary.bullets}
          onPress={() => navigation.navigate('Briefing', {
            headline: summary.headline,
            fullSummary: summary.fullSummary,
            sections: summary.sections,
          })}
          loading={loading}
        />

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

    </>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const CARD_BG     = '#0e0d0d';
const CARD_RADIUS = 35;
const RIM_COLOR   = 'rgba(94,94,94,0.32)';
const AI_BG       = '#09080f';
const AI_RADIUS   = 28;

const styles = StyleSheet.create({
  scroll:  { flex: 1 },
  content: { paddingHorizontal: H_PAD, paddingTop: 14, paddingBottom: 24, gap: GAP },

  // ── DashCard base
  card: {
    backgroundColor: CARD_BG,
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
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

  // ── AI Summary Card
  aiCard: {
    backgroundColor: AI_BG,
    borderRadius: AI_RADIUS,
    overflow: 'hidden',
    padding: 22,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 14,
    // Subtle outer border
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.18)',
  },
  aiCardTint: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: AI_RADIUS,
  },
  aiCardGlowBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: AI_RADIUS,
    borderWidth: 1.5,
    borderColor: 'rgba(167,139,250,0.7)',
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  aiLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  aiLabelStar: {
    fontSize: 9,
    color: 'rgba(167,139,250,0.7)',
    lineHeight: 14,
  },
  aiLabelText: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(167,139,250,0.55)',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  aiDivider: {
    height: 1,
    backgroundColor: 'rgba(139,92,246,0.12)',
    marginBottom: 18,
  },
  aiHeadline: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F1F5F9',
    letterSpacing: -0.4,
    lineHeight: 30,
    marginBottom: 16,
  },
  aiSkeletonWrap: {
    marginBottom: 16,
  },
  aiSkeletonLine: {
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  aiBulletsWrap: {
    gap: 9,
    marginBottom: 18,
  },
  aiBulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  aiBulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(167,139,250,0.5)',
    flexShrink: 0,
  },
  aiBulletText: {
    flex: 1,
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 19,
  },
  aiFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderTopWidth: 1,
    borderTopColor: 'rgba(139,92,246,0.1)',
    paddingTop: 14,
  },
  aiFooterText: {
    fontSize: 12,
    color: 'rgba(167,139,250,0.38)',
    fontWeight: '500',
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

  // ── Sheet content
});
