/**
 * HomeSection — the athlete home.
 *
 * Rebuilt 2026-09-20 after a reference Magne liked, and it reads top to bottom
 * as one sentence about the day:
 *
 * - **The light hangs from the top** and is gone by half way down — see
 *   `HomeBackdrop`, which lives in `AthleteFrame` so it covers the header too.
 * - **In the light, two lines**: the next match as one small line, and under it,
 *   bigger, the next thing actually happening. The match is the week's headline;
 *   what you do next is today's.
 * - **Where it turns dark, a section headline** in Schedule's and the fine
 *   box's face, then **boxes of different sizes** — a tall one beside two
 *   stacked — in Schedule's greys. No colour: Schedule's day cards do not use
 *   any either, and Home had a dot per tile for three categories nobody sorts by.
 *
 * Data: fixtures must filter `suppressed_at IS NULL`, and squad-wide events can
 * only be resolved by `visible_events_for_me` — an athlete cannot distinguish
 * "unassigned" from "assigned to someone else" under RLS.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabase';
import { readCache, writeCache } from '../../../utils/cache';
import Reveal from '../../ui/Reveal';
import PressableScale from '../../ui/PressableScale';
import Crest from '../../ui/Crest';
import type { AthleteStackParamList } from '../../../navigation/RootNavigator';
import { useToDo } from '../useToDo';
import { useFineBox } from '../useFineBox';
import { SURFACE, TEXT, RADIUS } from '../../../utils/tokens';
import { DISPLAY_FONT, THIN_FONT, LIGHT_FONT, UI_FONT, UI_FONT_REGULAR } from '../../../utils/type';
import { time as localTime } from '../../../utils/format';

/** Schedule's gutter. */
const PAD = 8;
/** Between boxes. */
const GAP = 8;
/** Inside a box, text sits this far from the edge. */
const BOX_PAD_X = 18;
/** One left edge for every line of text on Home, boxes included. */
const TEXT_INSET = PAD + BOX_PAD_X;
/** The least dark room between the headline and the section below it. */
const DARK_ROOM = 28;
/** The boxes' block. A tall one beside two stacked, as in the reference. */
const BENTO_H = 232;

/** The tab bar floats over content: 49pt of bar plus the home-indicator inset. */
const TAB_BAR = 49;
const BOTTOM_GAP = 12;

/**
 * Stand-in data for design work, dev-only and never shipped. Real data always
 * wins: these fill in only where the live value is absent or zero.
 *
 * Fines are mock-only because Home's box is not wired to the fine box yet.
 * Until then a release build shows a dash, not a number.
 */
const USE_MOCK = __DEV__;
const MOCK = {
  opponent: 'Brann', isHome: false, daysUntil: 8, logo: null as string | null,
  next: { title: 'Team training', days: 1, time: '18:00', location: 'Lerkendal kunstgress' },
};

interface NextMatch {
  opponent: string;
  match_date: string;
  is_home: boolean | null;
  // Optional: caches written before the crest existed do not have them.
  opponent_logo_url?: string | null;
  location?: string | null;
}

interface UpcomingEvent {
  id: string;
  type: string;
  title: string;
  event_date: string;
  location: string | null;
}

/** What Home keeps between sessions — see `utils/cache`. */
interface HomeCache {
  nextMatch: NextMatch | null;
  events: UpcomingEvent[];
}

/**
 * Last session's Home, minus whatever has happened since. A match that kicked
 * off yesterday must not open today's app as "Match today" while the refresh is
 * still on its way.
 */
function fromCache(userId: string | undefined): HomeCache | undefined {
  const c = userId ? readCache<HomeCache>(userId, 'home') : undefined;
  if (!c) return undefined;
  const now = Date.now();
  const ahead = (iso: string) => new Date(iso).getTime() >= now;
  return {
    nextMatch: c.nextMatch && ahead(c.nextMatch.match_date) ? c.nextMatch : null,
    events: c.events.filter(e => ahead(e.event_date)),
  };
}

export default function HomeSection({ isActive }: { isActive?: boolean }) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [cached] = useState(() => fromCache(profile?.id));
  const [nextMatch, setNextMatch] = useState<NextMatch | null>(cached?.nextMatch ?? null);
  const [events, setEvents] = useState<UpcomingEvent[]>(cached?.events ?? []);
  // Open tasks and unread feedback — see useToDo. Its own load and cache.
  const todo = useToDo(isActive);
  // What you owe the box. Its own load and cache too, so Home never waits on
  // it — the card says nothing until the number is real.
  const { box: fineBox } = useFineBox(isActive);
  const navigation = useNavigation<NativeStackNavigationProp<AthleteStackParamList>>();
  /** Nothing below the header is drawn until this — see `Reveal`. */
  const [loaded, setLoaded] = useState(!!cached);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!profile) return;
    try {
      const [matchRes, eventsRes] = await Promise.all([
        profile.club_id
          ? supabase
              .from('matches')
              .select('opponent, match_date, is_home, opponent_logo_url, location')
              .eq('club_id', profile.club_id)
              .eq('status', 'upcoming')
              // Fixtures a coach removed are hidden, not deleted — a real DELETE
              // would be undone by the next provider sync. Every read must filter.
              .is('suppressed_at', null)
              .gte('match_date', new Date().toISOString())
              .order('match_date', { ascending: true })
              .limit(1)
              // Not .single(): that reports "no upcoming match" as an error,
              // and an error here now means "keep what is on screen".
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),

        // Squad-wide events have NO event_assignments rows, and RLS only lets an
        // athlete read their own — so filtering client-side by assignment hides
        // every event meant for the whole squad. Resolved server-side instead.
        (async () => {
          const from = new Date();
          const to = new Date();
          to.setDate(to.getDate() + 21);
          const { data, error } = await supabase.rpc('visible_events_for_me', {
            p_from: from.toISOString(),
            p_to: to.toISOString(),
          });
          return { data, error };
        })(),
      ]);

      // A refresh that failed — offline, a dropped connection — must not replace
      // a good screen (usually last session's, from the cache) with zeros.
      if (matchRes.error || eventsRes.error) return;

      const match = (matchRes.data as NextMatch) ?? null;
      // The RPC does not promise an order, and "next up" is whatever sorts first.
      // Unsorted, a recovery session two days out was shown as next while two
      // events were still to come today.
      const list = ((eventsRes.data as UpcomingEvent[]) ?? [])
        .slice()
        .sort((a, b) => a.event_date.localeCompare(b.event_date));
      setNextMatch(match);
      setEvents(list);
      writeCache(profile.id, 'home', { nextMatch: match, events: list } satisfies HomeCache);
    } finally {
      // Even a failed first load has to end the wait, or the tab spins forever.
      setLoaded(true);
    }
  }, [profile]);

  // On mount and each time the tab comes back into view. This used to be two
  // effects that both fired on mount, so every launch queried Home twice.
  useEffect(() => { if (isActive !== false) fetchData(); }, [isActive, fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  // ── Derived ────────────────────────────────────────────────────────────────

  // Stand-ins fill real zeros only once the real answer is in. Before that they
  // were the first thing on screen, and cut to the real match ~350ms later.
  const mock = USE_MOCK && loaded;

  const match = nextMatch
    ? {
        opponent: nextMatch.opponent, isHome: nextMatch.is_home, iso: nextMatch.match_date,
        logo: nextMatch.opponent_logo_url ?? null,
      }
    : mock ? {
        opponent: MOCK.opponent, isHome: MOCK.isHome, iso: mockKickoff(MOCK.daysUntil),
        logo: MOCK.logo,
      } : null;

  const nextEvent = events[0];
  const next = nextEvent
    ? {
        title: nextEvent.title,
        days: calendarDaysUntil(nextEvent.event_date),
        // An all-day event is stored at midnight, and "00:00" is not a time
        // anybody is being asked to turn up at.
        time: allDay(nextEvent.event_date) ? null : localTime(nextEvent.event_date),
        location: nextEvent.location,
      }
    : mock ? MOCK.next : null;

  /** Today's events, in order, for the tall box. */
  const todayList = events
    .filter(e => calendarDaysUntil(e.event_date) === 0)
    .map(e => ({ id: e.id, title: e.title, time: allDay(e.event_date) ? null : localTime(e.event_date) }));

  // The events RPC starts at "now", so this counts what is still to come today.
  // Not mocked: the box lists what it counts, and a stand-in count with an
  // empty list underneath contradicts itself.
  const todayCount = todayList.length;
  // Never mocked: the box opens the real list, and a stand-in "3" that opens
  // nothing reads as broken.
  const toDoCount = todo.items.length;

  const bottom = insets.bottom + TAB_BAR + BOTTOM_GAP;

  return (
    <View style={styles.root}>
      {/* Both halves, so no figure arrives after the rest. The light behind all
          of this is `HomeBackdrop`, in the frame. */}
      <Reveal ready={loaded && todo.loaded}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingBottom: bottom }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEXT.tertiary} />
          }
        >
          <View style={styles.lead}>
            <MatchLine match={match} t={t} />

            <Text style={styles.headline} numberOfLines={2}>
              {next ? next.title : t('home.nothingPlanned')}
            </Text>
            {next ? (
              <Text style={styles.headlineMeta} numberOfLines={1}>
                {[relativeDay(next.days, t), next.time, next.location].filter(Boolean).join('  ·  ')}
              </Text>
            ) : null}
          </View>

          {/* The dark room between the light and the boxes. */}
          <View style={styles.spacer} />

          <Text style={styles.sectionTitle}>{t('home.sectionToday')}</Text>

          <View style={styles.bento}>
            <Box
              style={styles.boxTall}
              label={t('home.events')}
              figure={String(todayCount)}
              size={58}
            >
              {/* The count alone left the tall box mostly air; what the events
                  actually are is the useful thing to put in it. */}
              {todayList.length === 0 ? <Text style={styles.boxLine}>{t('home.nothingOn')}</Text> : null}
              {todayList.slice(0, 2).map(e => (
                <Text key={e.id} style={styles.boxLine} numberOfLines={1}>
                  {[e.time, e.title].filter(Boolean).join('  ')}
                </Text>
              ))}
              {todayList.length > 2 ? (
                <Text style={styles.boxLine}>{t('home.more', { count: todayList.length - 2 })}</Text>
              ) : null}
            </Box>
            <View style={styles.bentoCol}>
              <Box
                style={styles.boxMid}
                label={t('home.todo')}
                figure={String(toDoCount)}
                sub={toDoCount === 0 ? t('home.allDone') : t('home.forYou')}
                size={40}
                // Only when there is something to open: an empty sheet is a
                // tap spent on nothing.
                onPress={toDoCount > 0 ? () => navigation.navigate('ToDo') : undefined}
              />
              <Box
                style={styles.boxShort}
                label={t('home.fines')}
                figure={fineBox.loaded ? String(fineBox.owed) : '—'}
                unit={fineBox.loaded ? t('common.kr') : undefined}
                size={30}
              />
            </View>
          </View>
        </ScrollView>
      </Reveal>
    </View>
  );
}

// ── The match ──────────────────────────────────────────────────────────────

/**
 * The match, as one line in the light: crest, who, and when. It was a card with
 * both crests and the kick-off between them, which made the week's fixture
 * louder than the session you actually have to turn up to.
 */
function MatchLine({ match, t }: {
  match: { opponent: string; isHome: boolean | null; iso: string; logo: string | null } | null;
  t: TFunction;
}) {
  if (!match) {
    return <Text style={styles.matchLine}>{t('home.noMatch')}</Text>;
  }
  const days = calendarDaysUntil(match.iso);
  const when = days === 0 ? t('home.matchToday')
    : days === 1 ? t('home.matchTomorrow')
    : t('home.matchInDays', { count: days });
  const venue = match.isHome === false ? ` ${t('home.awayShort')}`
    : match.isHome ? ` ${t('home.homeShort')}` : '';
  return (
    <View style={styles.matchRow}>
      <Crest url={match.logo} name={match.opponent} size={20} />
      <Text style={styles.matchLine} numberOfLines={1}>
        {match.opponent}{venue}  ·  {when} {localTime(match.iso)}
      </Text>
    </View>
  );
}

// ── Boxes ──────────────────────────────────────────────────────────────────

/**
 * One box: a small tracked label, a thin figure, a word under it. Schedule's day
 * card, in the sizes the grid gives it.
 */
function Box({ label, figure, unit, sub, size, style, onPress, children }: {
  label: string; figure: string; unit?: string; sub?: string; size: number;
  style?: object; onPress?: () => void; children?: React.ReactNode;
}) {
  const content = (
    <>
      <View style={styles.boxHead}>
        <Text style={styles.boxLabel} numberOfLines={1}>{label}</Text>
        {children}
      </View>
      <View>
        <View style={styles.figureRow}>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.boxFigure, { fontSize: size, lineHeight: Math.round(size * 1.06) }]}
          >
            {figure}
          </Text>
          {unit ? <Text allowFontScaling={false} style={styles.boxUnit}>{unit}</Text> : null}
        </View>
        {sub ? <Text style={styles.boxSub} numberOfLines={1}>{sub}</Text> : null}
      </View>
    </>
  );
  return onPress ? (
    <PressableScale style={[styles.box, style]} scaleTo={0.96} dim={false} haptic="medium" onPress={onPress}>
      {content}
    </PressableScale>
  ) : (
    <View style={[styles.box, style]}>{content}</View>
  );
}

// ── Dates ──────────────────────────────────────────────────────────────────

/**
 * Whole calendar days between today and the day of `iso`, in local time.
 * Not `ceil(ms / 86400000)`: seen at 11:00 on Sunday, a Monday 20:00 kick-off is
 * 33 hours away and would round up to "in 2 days" when it is tomorrow.
 */
function calendarDaysUntil(iso: string): number {
  const d = new Date(iso);
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.max(0, Math.round((day - today) / 86400000));
}

function relativeDay(days: number, t: TFunction): string {
  if (days <= 0) return t('common.today');
  if (days === 1) return t('common.tomorrow');
  return t('common.inDays', { count: days });
}

/** Stored at local midnight: an all-day event, not a 00:00 start. */
function allDay(iso: string): boolean {
  const d = new Date(iso);
  return d.getHours() === 0 && d.getMinutes() === 0;
}

function mockKickoff(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(20, 0, 0, 0);
  return d.toISOString();
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1 },
  spacer: { flexGrow: 1, minHeight: DARK_ROOM },

  lead: { paddingHorizontal: TEXT_INSET, paddingTop: 10 },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  matchLine: { fontFamily: UI_FONT_REGULAR, fontSize: 15, color: TEXT.primary, flexShrink: 1 },
  headline: {
    fontFamily: LIGHT_FONT, fontSize: 36, lineHeight: 42,
    color: TEXT.primary, letterSpacing: -1, marginTop: 14,
  },
  headlineMeta: {
    fontFamily: UI_FONT_REGULAR, fontSize: 16,
    color: TEXT.secondary, marginTop: 6,
  },

  // Schedule's and the fine box's section headline, to the point.
  sectionTitle: {
    fontFamily: DISPLAY_FONT, fontSize: 24, color: TEXT.primary, letterSpacing: -0.6,
    marginHorizontal: TEXT_INSET, marginBottom: 12,
  },

  bento: { flexDirection: 'row', gap: GAP, marginHorizontal: PAD, height: BENTO_H },
  bentoCol: { flex: 1, gap: GAP },
  box: {
    borderRadius: RADIUS.lg,
    backgroundColor: SURFACE.raised,
    paddingHorizontal: BOX_PAD_X, paddingTop: 16, paddingBottom: 14,
    justifyContent: 'space-between',
  },
  // Different sizes on purpose: a tall one beside a taller and a shorter.
  boxTall: { flex: 1.15 },
  boxMid: { flex: 1.3 },
  boxShort: { flex: 1 },

  boxHead: { gap: 10 },
  boxLabel: { fontFamily: UI_FONT, fontSize: 12, letterSpacing: 1.4, color: TEXT.tertiary },
  boxLine: { fontFamily: UI_FONT_REGULAR, fontSize: 14, color: TEXT.secondary },
  figureRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  boxFigure: { fontFamily: THIN_FONT, color: TEXT.primary, letterSpacing: -2 },
  boxUnit: { fontFamily: LIGHT_FONT, fontSize: 16, color: TEXT.primary },
  boxSub: { fontFamily: UI_FONT_REGULAR, fontSize: 13, color: TEXT.secondary, marginTop: 2 },
});
