import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Dimensions, Pressable, RefreshControl, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import SlideUpSheet from '../../ui/SlideUpSheet';

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
      <Pressable onPress={onPress}>
        {inner}
      </Pressable>
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

interface SummaryData {
  headline: string;
  bullets: string[];
  fullSummary: string;
  sections: Array<{ title: string; items: string[] }>;
}

const EVENT_ICONS: Record<string, { icon: string; color: string }> = {
  training: { icon: 'fitness',  color: '#3B82F6' },
  exercise: { icon: 'barbell',  color: '#8B5CF6' },
  recovery: { icon: 'leaf',     color: '#22C55E' },
  travel:   { icon: 'airplane', color: '#F59E0B' },
  meeting:  { icon: 'people',   color: '#EC4899' },
  other:    { icon: 'calendar', color: '#6B7280' },
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
  const scale       = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.963,
      useNativeDriver: true,
      tension: 400,
      friction: 25,
    }).start();
  };

  const handlePress = () => {
    // Bubbly: compress → overshoot → settle
    Animated.sequence([
      Animated.spring(scale, {
        toValue: 1.028,
        useNativeDriver: true,
        tension: 120,
        friction: 4,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 220,
        friction: 12,
      }),
    ]).start();

    // Border glow pulse
    Animated.sequence([
      Animated.timing(glowOpacity, { toValue: 1, duration: 55, useNativeDriver: true }),
      Animated.timing(glowOpacity, { toValue: 0, duration: 450, useNativeDriver: true }),
    ]).start();

    onPress();
  };

  const handlePressOut = () => {
    // If released without registering as a press (e.g. scroll cancel), snap back
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 200,
      friction: 12,
    }).start();
  };

  return (
    <Pressable onPressIn={handlePressIn} onPress={handlePress} onPressOut={handlePressOut}>
      <Animated.View style={[styles.aiCard, { transform: [{ scale }] }]}>

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
          style={[styles.aiCardGlowBorder, { opacity: glowOpacity }]}
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
    </Pressable>
  );
}

// ── Full summary sheet content ─────────────────────────────────────────────────
function SummarySheetContent({
  headline,
  fullSummary,
  sections,
}: {
  headline: string;
  fullSummary: string;
  sections: Array<{ title: string; items: string[] }>;
}) {
  return (
    <View>
      {/* AI label */}
      <View style={styles.sheetAiLabel}>
        <Text style={styles.sheetAiStar}>✦</Text>
        <Text style={styles.sheetAiLabelText}>AI DAILY BRIEFING</Text>
      </View>

      {/* Headline */}
      <Text style={styles.sheetHeadline}>{headline}</Text>

      {/* Summary paragraph */}
      <Text style={styles.sheetSummaryText}>{fullSummary}</Text>

      {/* Sections */}
      {sections.map((sec, si) => (
        <View key={si} style={styles.sheetSection}>
          <Text style={styles.sheetSectionTitle}>{sec.title}</Text>
          {sec.items.map((item, ii) => (
            <View key={ii} style={styles.sheetItemRow}>
              <View style={styles.sheetItemDot} />
              <Text style={styles.sheetItemText}>{item}</Text>
            </View>
          ))}
        </View>
      ))}

      {/* Footer note */}
      <View style={styles.sheetFooterNote}>
        <Text style={styles.sheetAiStar}>✦</Text>
        <Text style={styles.sheetFooterText}>
          Summary generated from your live schedule, feedback, and tasks.
        </Text>
      </View>
    </View>
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
  const [sheetOpen, setSheetOpen]           = useState(false);

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
          onPress={() => setSheetOpen(true)}
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

      {/* ── Full summary sheet ───────────────────────────────────────────── */}
      <SlideUpSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Today's Briefing"
      >
        <SummarySheetContent
          headline={summary.headline}
          fullSummary={summary.fullSummary}
          sections={summary.sections}
        />
      </SlideUpSheet>
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
  sheetAiLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sheetAiStar: {
    fontSize: 10,
    color: 'rgba(167,139,250,0.6)',
  },
  sheetAiLabelText: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(167,139,250,0.5)',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  sheetHeadline: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F1F5F9',
    letterSpacing: -0.3,
    lineHeight: 28,
    marginBottom: 14,
  },
  sheetSummaryText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 24,
    marginBottom: 24,
  },
  sheetSection: {
    marginBottom: 20,
  },
  sheetSectionTitle: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(167,139,250,0.45)',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  sheetItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 9,
  },
  sheetItemDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(167,139,250,0.4)',
    flexShrink: 0,
    marginTop: 7,
  },
  sheetItemText: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 21,
  },
  sheetFooterNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  sheetFooterText: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.2)',
    lineHeight: 18,
    fontStyle: 'italic',
  },
});
