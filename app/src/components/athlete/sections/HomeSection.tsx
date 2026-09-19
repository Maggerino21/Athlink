/**
 * HomeSection — the athlete home.
 *
 * Built up from a stripped floor (2026-09-13):
 *
 * - **The match sits at the top as text**, not a card.
 * - **Light rises from the bottom of the screen** in the competition's hue,
 *   clearly visible every day, and more vivid on matchday. It shows in the space between the match and
 *   the panel, and under the tab bar.
 * - **One solid panel, cut into tiles.** Not cards floating on a card — a
 *   single opaque slab divided by thin grooves of the page colour, like a
 *   bento box. One wide tile for what is next, three narrow ones beneath it.
 *   The wide tile gives the panel a lead; four equal squares never had one.
 * - **Colour lives in the type**: each tile's figure and dot take its category
 *   ink. Fills stay grey and opaque.
 * - **Thin Inter, set large.**
 *
 * Data: fixtures must filter `suppressed_at IS NULL`, and squad-wide events can
 * only be resolved by `visible_events_for_me` — an athlete cannot distinguish
 * "unassigned" from "assigned to someone else" under RLS.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence, cancelAnimation, Easing,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Stop, Ellipse } from 'react-native-svg';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabase';
import { readCache, writeCache } from '../../../utils/cache';
import Reveal from '../../ui/Reveal';
import PressableScale from '../../ui/PressableScale';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AthleteStackParamList } from '../../../navigation/RootNavigator';
import { useToDo } from '../useToDo';
import { SURFACE, TEXT, RADIUS } from '../../../utils/tokens';
import { THIN_FONT, LIGHT_FONT, UI_FONT, UI_FONT_REGULAR } from '../../../utils/type';
import { hsla, matteAccent, type MatteAccent } from '../../../utils/theme';
import { eventAccent } from '../eventTypes';

/** Schedule's gutter. */
const PAD = 8;
/** Space between tiles. They are separate cards, edge to edge on the sides. */
const GROOVE = 11;
/** The match text lines up with the text inside the tiles. */
const TEXT_INSET = PAD + 20;
/** How much open space is kept between the match and the panel, for the glow. */
const GLOW_ROOM = 48;
/** Floor for the panel, so a very short screen still gets usable tiles. */
const PANEL_MIN = 400;
/** The narrow row keeps a fixed height; the wide tile grows upward into the rest. */
const ROW_H = 212;

/** The tab bar floats over content: 49pt of bar plus the home-indicator inset. */
const TAB_BAR = 49;
const BOTTOM_GAP = 12;

const EASE = Easing.bezier(0.22, 1, 0.36, 1);

/**
 * The glow's hue. Nothing stores a match's competition yet (the `football`
 * edge function receives `league`, but `matches` has no column for it), so
 * every match glows Eliteserien blue until that exists.
 */
const COMPETITION_HUE = 200;

/**
 * Category colours for the text inside each card, through `matteAccent` so they
 * sit in Schedule's family. "Next up" takes whatever the event's type is.
 * Today, Tasks and Fines are not event types, so their hues are chosen here.
 */
const CATEGORY: Record<'today' | 'todo' | 'fines' | 'none', MatteAccent> = {
  today: matteAccent('#3B82F6'),
  // Matches EVENT_META's task/feedback hue, so To do reads the same in Schedule.
  todo: matteAccent('#14B8A6'),
  fines: matteAccent('#EF4444'),
  none: matteAccent('#6B7280'),
};

/**
 * Stand-in data for design work, dev-only and never shipped. Real data always
 * wins: these fill in only where the live value is absent or zero.
 *
 * Fines are mock-only because the fine box does not exist yet — it is the next
 * feature to be built. Until then a release build shows a dash, not a number.
 */
const USE_MOCK = __DEV__;
const MOCK = {
  opponent: 'Brann', isHome: false, daysUntil: 8,
  next: { title: 'Team training', days: 1, time: '18:00', location: 'Lerkendal kunstgress' },
  today: 2,
  fines: 150,
};

interface NextMatch {
  opponent: string;
  match_date: string;
  is_home: boolean | null;
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
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [cached] = useState(() => fromCache(profile?.id));
  const [nextMatch, setNextMatch] = useState<NextMatch | null>(cached?.nextMatch ?? null);
  const [events, setEvents] = useState<UpcomingEvent[]>(cached?.events ?? []);
  // Open tasks and unread feedback — see useToDo. Its own load and cache.
  const todo = useToDo(isActive);
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
              .select('opponent, match_date, is_home')
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
    ? { opponent: nextMatch.opponent, isHome: nextMatch.is_home, iso: nextMatch.match_date }
    : mock ? { opponent: MOCK.opponent, isHome: MOCK.isHome, iso: mockKickoff(MOCK.daysUntil) } : null;

  const nextEvent = events[0];
  const next = nextEvent
    ? { title: nextEvent.title, days: calendarDaysUntil(nextEvent.event_date), time: localTime(nextEvent.event_date), location: nextEvent.location }
    : mock ? MOCK.next : null;
  const nextType = nextEvent?.type ?? (mock ? 'training' : null);

  // The events RPC starts at "now", so this counts what is still to come today.
  const todayCount = events.filter(e => calendarDaysUntil(e.event_date) === 0).length || (mock ? MOCK.today : 0);
  // Never mocked: the tile opens the real list, and a stand-in "3" that opens
  // nothing reads as broken.
  const toDoCount = todo.items.length;

  const bottom = insets.bottom + TAB_BAR + BOTTOM_GAP;

  const nextAccent = nextType ? eventAccent(nextType) : CATEGORY.none;

  return (
    <View style={styles.root}>
      {/* Behind everything, so it lights the space above the panel and reaches
          under the tab bar, whose glass picks it up. */}
      <RisingGlow days={match ? calendarDaysUntil(match.iso) : null} hue={COMPETITION_HUE} />

      {/* Both halves, so the To do figure never arrives after the rest. */}
      <Reveal ready={loaded && todo.loaded}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingBottom: bottom }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEXT.tertiary} />
          }
        >
          <Match match={match} />

          {/* Open space for the glow, between the match and the panel. */}
          <View style={styles.spacer} />

          {/* Flexbox, not measurement: the panel grows into whatever the match
              leaves, and the lead tile into whatever the row leaves. This was
              computed from two onLayout heights, both 0 on the first frame —
              so a Home drawn from the cache opened at the minimum size and
              jumped once measured. */}
          <View style={styles.panel}>
            <LeadTile
              accent={nextAccent}
              kind={nextType ? capitalise(nextType) : null}
              when={next ? relativeDay(next.days) : null}
              figure={next ? next.time : '—'}
              title={next?.title ?? 'Nothing planned'}
              place={next?.location ?? null}
            />
            <View style={styles.row}>
              <Tile
                accent={CATEGORY.today}
                label="Today"
                figure={String(todayCount)}
                detail={todayCount === 0 ? 'nothing on' : todayCount === 1 ? 'event' : 'events'}
              />
              <Tile
                accent={CATEGORY.todo}
                label="To do"
                figure={String(toDoCount)}
                detail={toDoCount === 0 ? 'all done' : 'for you'}
                // Only when there is something to open: an empty sheet is a
                // tap spent on nothing.
                onPress={toDoCount > 0 ? () => navigation.navigate('ToDo') : undefined}
              />
              <Tile
                accent={CATEGORY.fines}
                label="Fines"
                figure={mock ? String(MOCK.fines) : '—'}
                unit={mock ? 'kr' : undefined}
                detail={mock ? 'unpaid' : undefined}
              />
            </View>
          </View>
        </ScrollView>
      </Reveal>
    </View>
  );
}

// ── The match ──────────────────────────────────────────────────────────────

function Match({ match }: { match: { opponent: string; isHome: boolean | null; iso: string } | null }) {
  if (!match) {
    return (
      <View style={styles.match}>
        <Text style={styles.matchWhen}>No match scheduled</Text>
      </View>
    );
  }

  const days = calendarDaysUntil(match.iso);
  const when = days === 0 ? 'Match today' : days === 1 ? 'Match tomorrow' : `Match in ${days} days`;
  const venue = match.isHome === false ? '(A)' : match.isHome ? '(H)' : '';

  return (
    <View style={styles.match}>
      <Text style={styles.matchWhen}>{when}</Text>
      <Text style={styles.matchName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {match.opponent}
        {venue ? <Text style={styles.matchVenue}>{` ${venue}`}</Text> : null}
      </Text>
      <Text style={styles.matchTime}>Kick off {localTime(match.iso)}</Text>
    </View>
  );
}

// ── The glow ───────────────────────────────────────────────────────────────

/**
 * Light rising from the bottom edge of the screen.
 *
 * **Every day** it is fully visible — two pools anchored below the screen's
 * floor, the hue and a neighbour 18° away, so it reads as atmosphere rather
 * than a spotlight. It is not earned by the calendar any more: a faint glow on
 * six days out of seven left Home looking black most of the week.
 *
 * **Matchday** adds a second, more vivid layer on top: denser colour, reaching
 * higher up the screen, a brighter core low in the middle, and a slow breath.
 * It fades in over the everyday glow rather than replacing it, so the two can
 * never disagree about where the light sits.
 *
 * Gradients, not blur, so nothing ends in a hard edge. The screen's bottom edge
 * is the only boundary the pools meet, and a screen edge is a natural one.
 *
 * Drawn in a 100×100 viewBox stretched to the section (`preserveAspectRatio
 * "none"`): every pool was already sized as a fraction of the width across and
 * the height down, so stretching draws exactly the same shapes — and the glow
 * is there on the first frame instead of waiting for a measured height.
 */
function RisingGlow({ days, hue }: { days: number | null; hue: number }) {
  const matchday = days === 0;
  // Start where the first render says, not at 0: a Home drawn from the cache
  // already knows its match, and the light should be on from the first frame.
  const base = useSharedValue(days === null ? 0 : 1);
  const boost = useSharedValue(matchday ? 1 : 0);
  const breath = useSharedValue(1);

  useEffect(() => {
    base.value = withTiming(days === null ? 0 : 1, { duration: 600, easing: EASE });
  }, [days === null]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    boost.value = withTiming(matchday ? 1 : 0, { duration: 700, easing: EASE });
    if (matchday) {
      breath.value = withRepeat(
        withSequence(
          withTiming(0.55, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
          withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      );
    } else {
      cancelAnimation(breath);
      breath.value = withTiming(1, { duration: 400 });
    }
  }, [matchday]); // eslint-disable-line react-hooks/exhaustive-deps

  const baseStyle = useAnimatedStyle(() => ({ opacity: base.value }));
  const boostStyle = useAnimatedStyle(() => ({ opacity: boost.value * breath.value }));

  const a = hsla(hue, 95, 58);
  const b = hsla(hue + 18, 95, 64);
  // Matchday colour: more saturated, and a lighter core so it reads as brighter
  // light rather than just more of the same paint.
  const c = hsla(hue, 100, 62);
  const core = hsla(hue - 12, 100, 72);

  return (
    <>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, baseStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <RadialGradient id="riseA" cx="50%" cy="50%" r="50%">
              <Stop offset={0} stopColor={a} stopOpacity={0.75} />
              <Stop offset={0.55} stopColor={a} stopOpacity={0.32} />
              <Stop offset={1} stopColor={a} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="riseB" cx="50%" cy="50%" r="50%">
              <Stop offset={0} stopColor={b} stopOpacity={0.55} />
              <Stop offset={0.5} stopColor={b} stopOpacity={0.2} />
              <Stop offset={1} stopColor={b} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          {/* Centres sit at the floor, so the pools rise upward from it. */}
          <Ellipse cx={30} cy={100} rx={100} ry={95} fill="url(#riseA)" />
          <Ellipse cx={85} cy={100} rx={75} ry={75} fill="url(#riseB)" />
        </Svg>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, boostStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <RadialGradient id="boostWide" cx="50%" cy="50%" r="50%">
              <Stop offset={0} stopColor={c} stopOpacity={0.85} />
              <Stop offset={0.5} stopColor={c} stopOpacity={0.4} />
              <Stop offset={0.88} stopColor={c} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="boostCore" cx="50%" cy="50%" r="50%">
              <Stop offset={0} stopColor={core} stopOpacity={0.7} />
              <Stop offset={0.4} stopColor={core} stopOpacity={0.35} />
              <Stop offset={1} stopColor={core} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          {/* Reaches as high as the section itself, and no higher: the section
              is clipped under the header, so a pool that is still coloured at
              the top edge gets cut into a hard horizontal line there. The
              gradient ends at 88% of the radius for the same reason. */}
          <Ellipse cx={50} cy={100} rx={115} ry={100} fill="url(#boostWide)" />
          <Ellipse cx={45} cy={100} rx={70} ry={55} fill="url(#boostCore)" />
        </Svg>
      </Animated.View>
    </>
  );
}

// ── Tiles ──────────────────────────────────────────────────────────────────

/**
 * What is next, across the full width.
 *
 * The time is the headline, set thin and very large in the event's colour, so
 * the tile reads from arm's length. What and where sit beside it, right-aligned
 * on the same baseline, so the tile has two ends instead of one stack.
 */
function LeadTile({ accent, kind, when, figure, title, place }: {
  accent: MatteAccent; kind: string | null; when: string | null;
  figure: string; title: string; place: string | null;
}) {
  return (
    <View style={styles.lead}>
      <View style={styles.tileTop}>
        <View style={styles.labelRow}>
          <View style={[styles.dot, { backgroundColor: accent.ink }]} />
          <Text style={styles.label}>{kind ? `Next · ${kind}` : 'Next up'}</Text>
        </View>
        {when && <Text style={styles.label}>{when}</Text>}
      </View>

      <View style={styles.leadBottom}>
        <Text allowFontScaling={false} numberOfLines={1} style={styles.leadFigure}>
          {figure}
        </Text>
        <View style={styles.leadText}>
          <Text style={styles.leadTitle} numberOfLines={2}>{title}</Text>
          {place ? <Text style={styles.leadPlace} numberOfLines={1}>{place}</Text> : null}
        </View>
      </View>
    </View>
  );
}

/** A narrow tile: dot and label, a thin figure, one or two words under it. */
function Tile({ label, figure, unit, detail, accent, onPress }: {
  label: string; figure: string; unit?: string; detail?: string; accent: MatteAccent;
  onPress?: () => void;
}) {
  const size = figure.length <= 2 ? 64 : 48;
  const content = (
    <>
      <View style={styles.labelRow}>
        <View style={[styles.dot, { backgroundColor: accent.ink }]} />
        <Text style={styles.label} numberOfLines={1}>{label}</Text>
      </View>

      <View>
        <View style={styles.figureRow}>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.figure, { fontSize: size, lineHeight: Math.round(size * 1.08) }]}
          >
            {figure}
          </Text>
          {unit ? <Text allowFontScaling={false} style={styles.unit}>{unit}</Text> : null}
        </View>
        {detail ? <Text style={styles.detail} numberOfLines={2}>{detail}</Text> : null}
      </View>
    </>
  );
  return onPress ? (
    <PressableScale style={styles.tile} scaleTo={0.96} dim={false} haptic="medium" onPress={onPress}>
      {content}
    </PressableScale>
  ) : (
    <View style={styles.tile}>{content}</View>
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

/** Never slice a timestamptz — the wire format is UTC. Date applies the device zone. */
function localTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function relativeDay(days: number): string {
  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
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
  spacer: { height: GLOW_ROOM },

  match: {
    paddingHorizontal: TEXT_INSET,
    paddingTop: 20,
  },
  matchWhen: {
    fontFamily: UI_FONT_REGULAR, fontSize: 16,
    color: TEXT.primary,
  },
  // No lineHeight, deliberately. With `adjustsFontSizeToFit`, iOS shrinks the
  // font until the text fits its frame, and Yoga's pixel rounding can hand
  // that frame back a third of a point shorter than it measured. A fixed line
  // height never shrinks with the font, so nothing ever fits and the fitter
  // falls to its 4pt floor (on Fabric it ignores `minimumFontScale`) — the
  // name drew as a smudge. A natural line height shrinks with the font, so the
  // same rounding costs a fraction of a point instead.
  matchName: {
    fontFamily: LIGHT_FONT, fontSize: 44,
    color: TEXT.primary, letterSpacing: -1.2,
    marginTop: 4,
  },
  matchVenue: {
    fontFamily: THIN_FONT, fontSize: 44,
    color: TEXT.primary, letterSpacing: -1.2,
  },
  matchTime: {
    fontFamily: UI_FONT_REGULAR, fontSize: 16,
    color: TEXT.primary,
    marginTop: 4,
  },

  panel: {
    flexGrow: 1,
    minHeight: PANEL_MIN,
    marginHorizontal: PAD,
    gap: GROOVE,
  },
  row: { flexDirection: 'row', gap: GROOVE, height: ROW_H },

  lead: {
    flex: 1,
    borderRadius: RADIUS.lg,
    backgroundColor: SURFACE.raised,
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14,
    justifyContent: 'space-between',
  },
  tile: {
    flex: 1,
    borderRadius: RADIUS.lg,
    backgroundColor: SURFACE.raised,
    paddingHorizontal: 14, paddingTop: 16, paddingBottom: 14,
    justifyContent: 'space-between',
  },

  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 7, height: 7, borderRadius: RADIUS.pill },
  label: {
    fontFamily: UI_FONT_REGULAR, fontSize: 14,
    color: TEXT.primary,
  },

  leadBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  leadFigure: {
    fontFamily: THIN_FONT, fontSize: 96, lineHeight: 100,
    color: TEXT.primary,
    letterSpacing: -4,
    // Negative tracking leaves the box narrower than the ink; give it back.
    paddingRight: 4,
    marginBottom: -8,
  },
  leadText: { flexShrink: 1, alignItems: 'flex-end', paddingBottom: 6 },
  leadTitle: {
    fontFamily: LIGHT_FONT, fontSize: 20, lineHeight: 24,
    color: TEXT.primary, textAlign: 'right', letterSpacing: -0.3,
  },
  leadPlace: {
    fontFamily: UI_FONT_REGULAR, fontSize: 14,
    color: TEXT.primary, textAlign: 'right', marginTop: 3,
  },

  figureRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  figure: {
    fontFamily: THIN_FONT,
    color: TEXT.primary,
    letterSpacing: -2.5,
    paddingRight: 2,
  },
  unit: {
    fontFamily: LIGHT_FONT, fontSize: 18,
    color: TEXT.primary,
  },
  detail: {
    fontFamily: UI_FONT_REGULAR, fontSize: 13, lineHeight: 17,
    color: TEXT.primary, marginTop: 2,
  },
});
