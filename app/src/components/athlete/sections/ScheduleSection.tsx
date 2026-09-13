import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, ScrollView,
  Platform, Modal, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
// RNGH's ScrollView for the inner lists. A plain RN ScrollView owns a native
// pan recogniser that takes the touch outright; RNGH's participates in the
// same arbitration as the pager above it, so sideways reaches the pager and
// vertical stays with the list.
import { ScrollView as GHScrollView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, useDerivedValue, useAnimatedScrollHandler,
  withTiming, withSpring, interpolate, interpolateColor, Easing, FadeIn,
} from 'react-native-reanimated';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabase';
import PressableScale from '../../ui/PressableScale';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { SharedValue } from 'react-native-reanimated';
import type { AthleteStackParamList } from '../../../navigation/RootNavigator';
import { eventMeta, eventAccent, type EventType, type CalEvent } from '../eventTypes';
import { SURFACE, LINE, TEXT, RADIUS } from '../../../utils/tokens';
import { DISPLAY_FONT, DISPLAY_FONT_LARGE, UI_FONT } from '../../../utils/type';
import haptics from '../../../utils/haptics';

// ── Types ──────────────────────────────────────────────────────────────────────

// ── Motion ─────────────────────────────────────────────────────────────────────

/**
 * One easing and one set of durations for the whole screen, so a toggle, a
 * month step and a day expanding all move with the same hand.
 *
 * Fast is the point. These sit at 200-280ms because the transition has to cover
 * the swap without ever being something you wait for — anything slower reads as
 * friction, which is the opposite of what the motion is for.
 */
const EASE = Easing.bezier(0.22, 1, 0.36, 1);
const SWAP   = { duration: 170, easing: EASE } as const;
const TRAVEL = { duration: 210, easing: EASE } as const;
/** Quick and barely overshooting — a selection should land, not wobble. */
const { width: SCREEN_W } = Dimensions.get('window');

/** Distance between month names in the strip — one 'step' of the swipe. */
const STRIP_STEP = 104;

/**
 * Card heights, so snap offsets can be computed instead of measured.
 *
 * These are applied as exact `height`s below, not `minHeight`s — and that
 * distinction is the whole bug they used to cause. The full card was
 * `minHeight: 168`, but its date block is taller than that, so the real card
 * rendered at 178.67pt (measured off the screen pixels). The snap maths
 * believed 168, so every full card added 10.67pt of error: the first date
 * snapped perfectly, the fourth was ~43pt off. A minimum is a floor, not a size.
 *
 * Now each constant IS the rendered height, so the maths cannot drift from the
 * layout however many cards you scroll past.
 */
const CARD_FULL_H = 180;        // measured natural 178.67 → set exactly, never clips
const CARD_SLIM_H = 56;
const EVENT_CARD_BODY_H = 98;   // measured natural 97.33
const EVENT_CARD_H = EVENT_CARD_BODY_H + 8;   // + its marginBottom
const REVEAL_PAD = 10;          // reveal paddingBottom
const CARD_GAP = 8;

const SELECT_SPRING = { damping: 20, stiffness: 380, mass: 0.5 } as const;

/** Shared so an empty day does not hand DayCell a new array on every render. */
const NO_EVENTS: CalEvent[] = [];

interface DayGroup {
  dateStr: string;       // YYYY-MM-DD
  date: Date;
  label: string;         // "Today", or just the day name
  events: CalEvent[];
  isToday: boolean;
  isPast: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/**
 * Local wall-clock time from a timestamptz.
 *
 * This used to be `iso.slice(11, 16)`, which reads the UTC portion of the
 * string straight off the wire: a 20:00 Oslo kick-off stored as 18:00Z
 * rendered as "18:00". Home and Schedule then disagreed by two hours about the
 * same fixture, because Home happened to use toLocaleTimeString.
 */
function localTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** Local calendar day from a timestamptz — `.slice(0, 10)` has the same UTC bug. */
function localYMD(iso: string): string {
  return toYMD(new Date(iso));
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function startOfWeek(d: Date): Date {
  const day = d.getDay();           // 0=Sun
  const offset = day === 0 ? -6 : 1 - day; // shift to Monday
  const r = new Date(d);
  r.setDate(d.getDate() + offset);
  r.setHours(0, 0, 0, 0);
  return r;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(d.getDate() + n);
  return r;
}

/**
 * Day name, and "Today" as the single exception.
 *
 * There used to be "Tomorrow" and "Next Tuesday" here. Both had to go: with
 * three weeks on screen, "Next Tuesday" and the Tuesday two rows below it are
 * different days with almost the same name, and no amount of styling makes
 * that legible. The week intermissions carry that information now, which is
 * what a heading is for — the row says which day, the heading says which week.
 */
function buildDayLabel(date: Date, today: Date): string {
  return toYMD(date) === toYMD(today) ? 'Today' : DAYS[date.getDay()];
}

// ── Month maths ────────────────────────────────────────────────────────────────

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

/** Weeks run Monday-first here, matching `startOfWeek`. */
const WEEKDAY_INITIALS = ['M','T','W','T','F','S','S'];

/** Identity of a month, for keys and for the per-month memory. */
function monthKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}`;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  // Day 1 first, so stepping from the 31st never skips a short month.
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function fromYMD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * The cells of a month grid: whole weeks, so it always starts on a Monday and
 * ends on a Sunday. Leading and trailing days belong to the neighbouring months
 * and are drawn dimmed — a grid that began mid-row would misalign the weekday
 * header above it.
 */
function buildMonthGrid(monthStart: Date): Date[] {
  const lastOfMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  const cells: Date[] = [];
  let d = startOfWeek(monthStart);
  while ((d <= lastOfMonth || cells.length % 7 !== 0) && cells.length < 42) {
    cells.push(d);
    d = addDays(d, 1);
  }
  return cells;
}

/**
 * A vacation or camp is ONE row with `event_date` + `end_date`, not many rows.
 * Expanded across days for display only. Without this a week-long block showed
 * on its first day and vanished — which reads as "my holiday disappeared".
 *
 * Capped so a bad `end_date` can't lock the UI thread building rows forever.
 */
const MAX_SPAN_DAYS = 60;

function expandEvent(e: any): CalEvent[] {
  const base = {
    id: e.id,
    type: e.type as EventType,
    title: e.title,
    location: e.location ?? null,
    description: e.description ?? null,
    source: 'event' as const,
  };

  const startYMD = localYMD(e.event_date);
  if (!e.end_date) {
    return [{ ...base, start_time: localTime(e.event_date), date: startYMD }];
  }

  const start = new Date(e.event_date);
  const end   = new Date(e.end_date);
  const days: CalEvent[] = [];

  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);

  let i = 0;
  while (cursor <= last && i < MAX_SPAN_DAYS) {
    const ymd = toYMD(cursor);
    days.push({
      ...base,
      // A start time only makes sense on the first day of the block.
      start_time: i === 0 ? localTime(e.event_date) : null,
      date: ymd,
      spanDay: i + 1,
      spanTotal: 0, // filled in below, once the total is known
    });
    cursor.setDate(cursor.getDate() + 1);
    i++;
  }

  return days.map(d => ({ ...d, spanTotal: days.length }));
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ScheduleSection({ isActive }: { isActive: boolean }) {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();

  // Memoised because it is a dependency of almost everything below. A fresh
  // Date on every render gives every child a changed prop, which defeats every
  // memo in the subtree — 90 day cards rebuilding because midnight moved.
  const today = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [events, setEvents]         = useState<CalEvent[]>([]);
  /** Latest events without making the reset depend on them. */
  const eventsRef = useRef<CalEvent[]>([]);
  eventsRef.current = events;
  /** True once events have loaded — the lists wait for it. See MonthList. */
  const [ready, setReady] = useState(false);
  const navigation = useNavigation<NativeStackNavigationProp<AthleteStackParamList>>();
  /**
   * Which days are open — each on its own, not one per month.
   *
   * This was one open day per month, and opening a day silently closed the
   * one that was open before. When that day sat above you — today, usually —
   * its events vanished and everything below was pulled up by exactly the
   * height that closed. Open the 23rd and the list lurched 116pt, for a reason
   * nothing on screen explained. Earlier still it was one day for the whole
   * screen, with the same flaw across months.
   *
   * The rule: nothing moves unless you touched it. So each day opens and closes
   * independently, and a day you are not looking at is never changed by a tap
   * somewhere else.
   */
  const [openDays, setOpenDays] = useState<Record<string, true>>({});
  /** Bumped on every reset, so each month's list scrolls back to its landing. */
  const [resetToken, setResetToken] = useState(0);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerDate, setPickerDate] = useState(today);

  const [monthAnchor, setMonthAnchor] = useState<Date>(startOfMonth(today));
  /** Today opens itself once, and only if there is something to open. */
  const seededToday = useRef(false);

  /** What `events` currently covers, so a step inside it skips the query. */
  const loadedRange = useRef<{ from: Date; to: Date } | null>(null);

  const isDefaultView = toYMD(monthAnchor) === toYMD(startOfMonth(today));

  /** Shared by the strip, the chevrons and the swipe, so they cannot diverge. */
  const goToMonth = useCallback((next: Date) => {
    setMonthAnchor(next);
  }, []);

  const stepMonth = useCallback((n: number) => {
    goToMonth(addMonths(monthAnchor, n));
  }, [goToMonth, monthAnchor]);

  // Stable identities, so a month that did not change does not re-render.
  const handleToggle = useCallback((ymd: string) => {
    setOpenDays(prev => {
      const next = { ...prev };
      if (next[ymd]) delete next[ymd]; else next[ymd] = true;
      return next;
    });
  }, []);

  const handleEventPress = useCallback((e: CalEvent) => {
    navigation.navigate('EventDetail', { event: e });
  }, [navigation]);

  /**
   * Every month, laid out end to end. No recycling.
   *
   * The previous design kept a three-page window and recentred it after each
   * step. That required two things to commit atomically — which months React
   * renders, and where the native scroll view is parked — and React Native has
   * no primitive that does both in one frame. Every fix narrowed that window
   * without closing it, and swiping fast blew it open again: a second gesture
   * arrives before the first has settled, and the recentre teleports the list
   * out from under the finger.
   *
   * So: stop recycling. Two years either side is 49 pages, FlatList mounts only
   * the few near the viewport, and the scroll offset becomes the single source
   * of truth. There is nothing to reset, nothing to synchronise, and no race to
   * lose — which is the only way this stops being a category of bug rather than
   * a bug.
   */
  const RANGE = 24;
  const months = React.useMemo(
    () => Array.from({ length: RANGE * 2 + 1 }, (_, i) => addMonths(startOfMonth(today), i - RANGE)),
    [today],
  );
  const HOME_INDEX = RANGE;

  const pagerRef = useRef<any>(null);
  const scrollX = useSharedValue(HOME_INDEX * SCREEN_W);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => { scrollX.value = e.contentOffset.x; },
  });

  /** Which page is centred, as a float — the strip reads this directly. */
  const page = useDerivedValue(() => scrollX.value / SCREEN_W);

  const goToIndex = useCallback((index: number, animated = true) => {
    const clamped = Math.max(0, Math.min(months.length - 1, index));
    pagerRef.current?.scrollToOffset({ offset: clamped * SCREEN_W, animated });
  }, [months.length]);

  /** Land on a specific day — the month AND the day, not just the month. */
  const jumpTo = useCallback((d: Date) => {
    const key = monthKey(d);
    setOpenDays(prev => ({ ...prev, [toYMD(d)]: true }));
    goToIndex(months.findIndex(m => monthKey(m) === key), false);
  }, [goToIndex, months]);

  const goToToday = useCallback(() => {
    goToIndex(HOME_INDEX);
  }, [goToIndex]);

  /**
   * The month the viewport has settled on. This now only decides which data to
   * fetch and which day is open — never where anything is drawn — so arriving
   * late costs nothing visible.
   */
  const onSettled = useCallback((x: number) => {
    const idx = Math.round(x / SCREEN_W);
    const next = months[Math.max(0, Math.min(months.length - 1, idx))];
    if (!next || monthKey(next) === monthKey(monthAnchor)) return;
    goToMonth(next);
  }, [months, monthAnchor, goToMonth]);


  /** The chevrons and month names scroll the pager, so they animate identically. */
  const slideTo = useCallback((dir: number) => {
    goToIndex(months.findIndex(m => monthKey(m) === monthKey(monthAnchor)) + dir);
  }, [goToIndex, months, monthAnchor]);

  // ── Data ──────────────────────────────────────────────────────────────────

  const load = useCallback(async (force = false) => {
    if (!profile?.club_id) return;

    // Five months, not the three on screen.
    //
    // Three months are mounted so the carousel can show real content mid-drag,
    // but fetching exactly three means every single step needs a new query —
    // and each one replaces `events`, which re-renders every mounted day card.
    // Fetching a month of slack either side means stepping within the window
    // costs nothing at all: no query, no new array, no re-render.
    const from = startOfMonth(addMonths(monthAnchor, -2));
    const to   = startOfMonth(addMonths(monthAnchor, 3));   // exclusive, local

    // Already covered? Then there is nothing to do. This is what makes a step
    // free rather than merely fast.
    if (!force && loadedRange.current
        && from >= loadedRange.current.from
        && to <= loadedRange.current.to) {
      return;
    }

    const [{ data: evData }, { data: matchData }] = await Promise.all([
      // Server-side resolution of "which events am I supposed to see".
      // An absent event_assignments row means WHOLE SQUAD, but RLS only lets an
      // athlete read their own assignment rows — so the client genuinely cannot
      // tell "unassigned" from "assigned to someone else". Filtering client-side
      // hid every squad-wide event.
      supabase.rpc('visible_events_for_me', {
        p_from: from.toISOString(),
        p_to: to.toISOString(),
      }),
      supabase
        .from('matches')
        .select('id, opponent, match_date, location, is_home, meet_time, meet_location, notes, opponent_logo_url')
        .eq('club_id', profile.club_id)
        // Provider fixtures a coach removed are hidden, not deleted — the sync
        // would recreate them. Every read of `matches` must filter this.
        .is('suppressed_at', null)
        .gte('match_date', from.toISOString())
        .lt('match_date', to.toISOString())
        .order('match_date', { ascending: true }),
    ]);

    const mapped: CalEvent[] = [
      ...(evData ?? []).flatMap((e: any) => expandEvent(e)),
      ...(matchData ?? []).map((m: any) => ({
        id: m.id,
        type: 'match' as EventType,
        title: `${m.is_home === false ? 'Away vs' : 'vs'} ${m.opponent}`,
        start_time: localTime(m.match_date),
        location: m.location ?? null,
        description: null,
        date: localYMD(m.match_date),
        source: 'match' as const,
        meet_time: m.meet_time ? localTime(m.meet_time) : null,
        meet_location: m.meet_location ?? null,
        notes: m.notes ?? null,
        opponent_logo_url: m.opponent_logo_url ?? null,
        is_home: m.is_home,
      })),
    ];

    loadedRange.current = { from, to };
    // Today opens in the SAME render the events arrive, not one after.
    //
    // This used to be an effect watching `events`, which runs after the render
    // that delivered them — so the list's first frame showed today closed, and
    // the next frame opened it and pushed every card below down 116pt. React
    // batches these three into one commit, so today is already open the first
    // time the list is drawn.
    if (!seededToday.current) {
      seededToday.current = true;
      const t = toYMD(today);
      if (mapped.some(e => e.date === t)) setOpenDays({ [t]: true });
    }
    // A background refresh that returns the same rows must not re-render every
    // mounted card for nothing. Compare a cheap signature first.
    const sig = (xs: CalEvent[]) => xs.map(e => `${e.id}|${e.date}|${e.start_time}|${e.title}`).join('~');
    if (sig(mapped) !== sig(eventsRef.current)) setEvents(mapped);
    setReady(true);
  }, [profile?.club_id, monthAnchor]);




  /**
   * Leaving the section puts it back to its defaults.
   *
   * Coming back to Schedule three days later and finding it still parked on
   * the day in March you were checking is a small betrayal — the answer to
   * "what's on" is almost always about now. Each month's open day is for
   * moving around *within* a visit, and does not outlive one.
   */
  // Swiping to a new month may step outside the fetched window. Not on mount —
  // the effect below already loads then, and running both would fetch twice.
  const anchorMounted = useRef(false);
  useEffect(() => {
    if (!anchorMounted.current) { anchorMounted.current = true; return; }
    if (isActive) load();
  }, [monthAnchor]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isActive) {
      // Returning: refresh quietly. The screen is already in its final state
      // from the reset below, so this only matters if the data really changed.
      load(true);
      return;
    }
    /**
     * Leaving: put everything straight into the state you will see on return,
     * NOW, while the section is hidden — using the events already in hand.
     *
     * This used to clear the open days and throw away the loaded range. Coming
     * back, the list drew instantly with today closed, then waited on the
     * network to refetch, then opened today and pushed every card below it down
     * 116pt. Measured with realistic latency: 840ms of the wrong layout, then a
     * jump. Nothing on the first frame may depend on a request that has not
     * come back yet.
     */
    const t = toYMD(today);
    setOpenDays(eventsRef.current.some(e => e.date === t) ? { [t]: true } : {});
    setMonthAnchor(startOfMonth(today));
    setPickerVisible(false);
    goToIndex(HOME_INDEX, false);
    // Each month's list scrolls itself back to where it opens. While hidden.
    setResetToken(n => n + 1);
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Build day groups ──────────────────────────────────────────────────────

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      {/* Header. The Today button is absolute so that appearing and
          disappearing cannot resize the header and shove the list down — a
          control that shifts the page when it arrives is worse than no control. */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Schedule</Text>
        {!isDefaultView && (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={goToToday}
            activeOpacity={0.7}
          >
            <Ionicons name="return-up-back" size={14} color={TEXT.secondary} style={{ marginRight: 4 }} />
            <Text style={styles.backBtnText}>Today</Text>
          </TouchableOpacity>
        )}
      </View>

      <MonthStrip months={months} page={page} onStep={slideTo} onJump={() => setPickerVisible(true)} />

      {/* Every month, end to end. FlatList mounts only what is near. */}
      <Animated.FlatList
        ref={pagerRef}
        data={months}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        // Fixed page width, so the list can jump straight to a month without
        // measuring its way there.
        getItemLayout={(_: any, i: number) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
        initialScrollIndex={HOME_INDEX}
        keyExtractor={(m: any) => monthKey(m)}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e: any) => onSettled(e.nativeEvent.contentOffset.x)}
        // `removeClippedSubviews` is off deliberately: on iOS it is a known
        // cause of blank and stale cells while flinging, which is almost
        // certainly the "start of September" appearing during a fast swipe.
        // A slightly larger window costs little now that the cards are cheap,
        // and it is what stops a fast fling outrunning the renderer.
        windowSize={5}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        style={{ flex: 1 }}
        renderItem={({ item }: { item: Date }) => (
          <MonthList
            month={item}
            events={events}
            ready={ready}
            today={today}
            openDays={openDays}
            resetToken={resetToken}
            // Where a month first opens: today in this month, the 1st in any
            // other. Deliberately NOT derived from which days are open — that
            // coupling is what used to throw you back to today on collapse.
            landOn={toYMD(monthKey(item) === monthKey(today) ? today : startOfMonth(item))}
            bottomPad={40 + insets.bottom}
            onToggle={handleToggle}
            onEventPress={handleEventPress}
          />
        )}
      />

      {/* Pick any date. The strip walks month by month; this is for the jump
          that would take a dozen swipes. */}
      {pickerVisible && (
        Platform.OS === 'ios' ? (
          <Modal transparent animationType="slide" onRequestClose={() => setPickerVisible(false)}>
            <View style={styles.pickerBackdrop}>
              <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setPickerVisible(false)} />
              <View style={styles.pickerSheet}>
                <View style={styles.pickerHeader}>
                  <TouchableOpacity onPress={() => setPickerVisible(false)}>
                    <Text style={styles.pickerCancel}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={styles.pickerTitle}>Go to date</Text>
                  <TouchableOpacity onPress={() => { jumpTo(pickerDate); setPickerVisible(false); }}>
                    <Text style={styles.pickerDone}>Go</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={pickerDate}
                  mode="date"
                  display="spinner"
                  onChange={(_, d) => { if (d) setPickerDate(d); }}
                  textColor="#fff"
                  style={styles.picker}
                />
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={pickerDate}
            mode="date"
            display="default"
            onChange={(_, d) => { setPickerVisible(false); if (d) { setPickerDate(d); jumpTo(d); } }}
          />
        )
      )}

      {/* Event detail sheet */}
    </View>
  );
}

// ── MonthList ──────────────────────────────────────────────────────────────────

/**
 * One month's days, as its own scroller.
 *
 * Three of these are mounted at once — previous, current, next — so the month
 * you drag toward is already on screen with its real data. The previous design
 * animated a single container and swapped its contents when the animation
 * finished, which meant the frames during the slide showed the month you were
 * leaving: the state change and the Supabase query both land a frame or more
 * after the UI-thread animation, so the "new" month slid in still showing the
 * old one and then popped. No amount of tuning fixes that — the content was
 * wrong by construction.
 *
 * Each list owns its own scroll position and snap offsets, which is also why
 * they are a component: coming back to a month finds it where you left it
 * without a single line of restore logic.
 */
const MonthList = React.memo(function MonthList({
  month, events, ready, openDays, resetToken, landOn, bottomPad, today, onToggle, onEventPress,
}: {
  month: Date;
  ready: boolean;
  events: CalEvent[];
  openDays: Record<string, true>;
  resetToken: number;
  landOn: string;
  bottomPad: number;
  today: Date;
  onToggle: (ymd: string) => void;
  onEventPress: (e: CalEvent) => void;
}) {

  const days = React.useMemo(() => {
    const first = startOfMonth(month);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return Array.from({ length: last }, (_, i) => addDays(first, i));
  }, [month]);

  const dayGroups: DayGroup[] = React.useMemo(() => {
    const todayStr = toYMD(today);
    const byDay = new Map<string, CalEvent[]>();
    for (const e of events) {
      const b = byDay.get(e.date);
      if (b) b.push(e); else byDay.set(e.date, [e]);
    }
    return days.map(date => {
      const dateStr = toYMD(date);
      return {
        dateStr,
        date,
        label: buildDayLabel(date, today),
        events: byDay.get(dateStr) ?? NO_EVENTS,
        isToday: dateStr === todayStr,
        isPast: date < today,
      };
    });
  }, [days, events, today]);

  /**
   * Snap offsets, computed rather than measured.
   *
   * These used to come from an `onLayout` on every card feeding a debounced
   * `setState`. That meant expanding one day relayed out the list, which fired
   * thirty layout callbacks, which scheduled a state update in the middle of
   * the animation — the stutter was the measurement, not the motion.
   *
   * Every height here is a constant we set ourselves, so the running total is
   * exact for collapsed days and close enough for the one open day that snapping
   * still lands where it should.
   */
  // This month's open days, as a string. Every mounted month receives the same
  // `openDays` object, so memoising on it would recompute every month's offsets
  // — and hand every month's ScrollView a new `snapToOffsets` — whenever a day
  // anywhere was tapped. A string only changes when THIS month's days do.
  const openKey = dayGroups.filter(d => openDays[d.dateStr]).map(d => d.dateStr).join(',');

  const { offsets } = React.useMemo(() => {
    const out: number[] = [];
    let y = 0;
    for (const d of dayGroups) {
      out.push(y);
      const slim = d.isPast && !d.isToday && d.events.length === 0;
      const open = !!openDays[d.dateStr] && d.events.length > 0;
      y += (slim ? CARD_SLIM_H : CARD_FULL_H)
         + (open ? d.events.length * EVENT_CARD_H + REVEAL_PAD : 0)
         + CARD_GAP;
    }
    return { offsets: out };
  }, [dayGroups, openKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Where the list opens, applied as `contentOffset` — i.e. at mount, before
   * the first frame is drawn.
   *
   * This used to be a `useEffect` calling `scrollTo`, and a passive effect runs
   * after paint: the first frame was always drawn at the top of the month, then
   * it jumped to today. `contentOffset` makes the first frame already correct,
   * so there is no second position to jump to.
   *
   * Lands on the exact snap offset. The old landing used `offset - 8` while
   * snapping used the raw offset, so the first touch nudged the list 8pt.
   *
   * See `land` below — this value is only ever applied once.
   */
  const landIndex = dayGroups.findIndex(d => d.dateStr === landOn);
  const initialY = landIndex >= 0 ? offsets[landIndex] : 0;

  /**
   * Positioned once, imperatively, during the first layout — never as a prop.
   *
   * This was `contentOffset`, and on the New Architecture that is not an
   * initial position: it lives in the ScrollView's shadow-tree state and
   * takes part in layout. Whenever content height changed it pulled the offset
   * back toward that value, which caused two bugs at once:
   *
   *  - Collapsing any day recomputed the landing day to "today", changed the
   *    prop, and scrolled you back to the 13th from wherever you were.
   *  - Expanding a day moved everything ABOVE it up by exactly the revealed
   *    height (116pt) while everything below held still — the reverse of how a
   *    list should grow. Measured with snapping disabled, so it was not that.
   *
   * `scrollTo` in `onLayout` runs before paint, and the page fades in from
   * opacity 0, so the first visible frame is already in place — which is what
   * `contentOffset` was there to achieve — without holding the offset hostage
   * for the rest of the list's life.
   */
  const scrollRef = useRef<any>(null);
  const didLand = useRef(false);
  const land = useCallback(() => {
    if (didLand.current) return;
    didLand.current = true;
    if (initialY > 0) scrollRef.current?.scrollTo({ x: 0, y: initialY, animated: false });
  }, [initialY]);

  // A reset (leaving Schedule) scrolls back to the landing day. It runs while
  // the section is hidden, so the move is never seen.
  const firstReset = useRef(resetToken);
  useEffect(() => {
    if (resetToken === firstReset.current) return;
    scrollRef.current?.scrollTo({ x: 0, y: initialY, animated: false });
  }, [resetToken]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) return <View style={styles.monthPage} />;

  return (
    <Animated.View entering={FadeIn.duration(160)} style={styles.monthPage}>
      <GHScrollView
        ref={scrollRef}
        style={styles.monthScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        onLayout={land}
        snapToOffsets={offsets}
        snapToEnd={false}
        decelerationRate="fast"
      >
        {dayGroups.map(day => (
          <DayCard
            key={day.dateStr}
            day={day}
            expanded={!!openDays[day.dateStr]}
            onToggle={onToggle}
            onEventPress={onEventPress}
          />
        ))}
      </GHScrollView>
    </Animated.View>
  );
});

// ── MonthStrip ─────────────────────────────────────────────────────────────────

/**
 * The month, with its neighbours either side.
 *
 * Naming the months you are moving *between*, rather than only the one you are
 * in, is what makes the sideways swipe discoverable — otherwise nothing on
 * screen suggests there is anywhere to go.
 */
function MonthStrip({
  months, page, onStep, onJump,
}: {
  months: Date[];
  page: SharedValue<number>;
  onStep: (n: number) => void;
  onJump: () => void;
}) {
  /**
   * The same scroll, at a different scale.
   *
   * Every month's label is laid out in one long row, and the row is translated
   * by the pager's own page position. The strip is not told which month is
   * current and it holds no state of its own — it reads the number the list is
   * already reading, so it cannot lag it, overshoot it, or disagree with it.
   *
   * This is what the recycling version could never quite manage: it had to be
   * *told* when the month changed, and being told always arrives a frame late.
   */
  const groupStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -page.value * STRIP_STEP }],
  }));

  return (
    <View style={styles.monthStrip}>
      <PressableScale style={styles.stripArrow} scaleTo={0.88} dim={false} onPress={() => onStep(-1)}>
        <Ionicons name="chevron-back" size={15} color={TEXT.tertiary} />
      </PressableScale>

      <View style={styles.stripWindow}>
        <Animated.View style={[styles.stripGroup, groupStyle]}>
          {months.map((m, i) => (
            <StripLabel
              key={monthKey(m)}
              label={SHORT_MONTHS[m.getMonth()].toUpperCase()}
              index={i}
              page={page}
              onJump={onJump}
            />
          ))}
        </Animated.View>
      </View>

      <PressableScale style={styles.stripArrow} scaleTo={0.88} dim={false} onPress={() => onStep(1)}>
        <Ionicons name="chevron-forward" size={15} color={TEXT.tertiary} />
      </PressableScale>
    </View>
  );
}

/** One month name. Brightens as it approaches the centre of the strip. */
function StripLabel({
  label, index, page, onJump,
}: { label: string; index: number; page: SharedValue<number>; onJump: () => void }) {
  const style = useAnimatedStyle(() => {
    const d = Math.abs(index - page.value);   // 0 at centre, 1 either side
    return {
      opacity: interpolate(d, [0, 1, 2], [1, 0.3, 0.12], 'clamp'),
      transform: [{ scale: interpolate(d, [0, 1], [1, 0.86], 'clamp') }],
    };
  });
  return (
    <PressableScale style={styles.stripSlot} scaleTo={0.94} onPress={onJump}>
      <Animated.Text style={[styles.stripLabel, style]} numberOfLines={1}>
        {label}
      </Animated.Text>
    </PressableScale>
  );
}

// ── DayCard ────────────────────────────────────────────────────────────────────

/**
 * A day, as a tall card: the date set large on the left, and a row of dots on
 * the right saying only *that* something is on and roughly what kind.
 *
 * The dots are deliberately not the events. A closed day should be a glance —
 * scanning a month means reading thirty of these, and thirty rows of event
 * titles is a wall of text. Open the day and the events arrive in full.
 *
 * Every card takes the same treatment rather than a colour per day. The colour
 * on this screen belongs to the event types, and a coloured card behind them
 * would compete with the only colour that carries meaning.
 *
 * Days with nothing on collapse to a slim row. A month of empty cards at full
 * height is a lot of scrolling past nothing, and the size difference does real
 * work: the days that hold something are the big ones.
 */
const DayCard = React.memo(function DayCard({
  day, expanded, onToggle, onEventPress,
}: {
  day: DayGroup;
  expanded: boolean;
  onToggle: (ymd: string) => void;
  onEventPress: (e: CalEvent) => void;
}) {
  const isPast = day.isPast && !day.isToday;
  const isSlim = isPast && day.events.length === 0;
  const monthLabel = SHORT_MONTHS[day.date.getMonth()].toUpperCase();
  const hasEvents = day.events.length > 0;

  const todayStyle = day.isToday && { backgroundColor: SURFACE.active };

  return (
    <View style={styles.cardWrap}>
      {isSlim ? (
        <View style={[styles.card, styles.cardSlim, styles.cardPast, todayStyle]}>
          <Text allowFontScaling={false} style={[styles.slimNum, day.isToday && styles.slimNumToday]}>
            {day.date.getDate()}
          </Text>
          <Text style={styles.slimMon}>{monthLabel}</Text>
          <Text style={styles.slimDay} numberOfLines={1}>{day.label.toUpperCase()}</Text>
        </View>
      ) : (
        <View style={[styles.card, isPast && styles.cardPast, todayStyle]}>
          {/* TouchableOpacity, not PressableScale.
              PressableScale is a gesture handler with its own shared value and
              animated style. One per card, thirty cards a month, several months
              mounted — hundreds of live recognisers, and what made mounting a
              page (and therefore swiping) expensive. A native Touchable costs
              almost nothing. */}
          <TouchableOpacity
            style={styles.cardTop}
            activeOpacity={hasEvents ? 0.75 : 1}
            onPress={hasEvents ? () => onToggle(day.dateStr) : undefined}
          >
            <View style={styles.dateBlock}>
              <Text style={styles.dayName} numberOfLines={1}>{day.label.toUpperCase()}</Text>
              <Text allowFontScaling={false} style={styles.dateNum}>{day.date.getDate()}</Text>
              <Text allowFontScaling={false} style={styles.dateMon}>{monthLabel}</Text>
            </View>

            {/* One dot per KIND of thing, not per event. */}
            <View style={styles.dotRow}>
              {[...new Set(day.events.map(e => e.type))].slice(0, 4).map(type => (
                <View key={type} style={[styles.bigDot, { backgroundColor: eventAccent(type).edge }]} />
              ))}
            </View>
          </TouchableOpacity>

          {/* Only the open day mounts the animation. A collapsed card used to
              carry two shared values, an effect and an animated style for a
              reveal it was not showing — twenty-nine wasted copies per month. */}
          {expanded && hasEvents && (
            <DayReveal events={day.events} onEventPress={onEventPress} />
          )}
        </View>
      )}
    </View>
  );
});

// ── DayReveal ──────────────────────────────────────────────────────────────────

/** The opened day's events, sliding in. Mounted only while open. */
function DayReveal({ events, onEventPress }: { events: CalEvent[]; onEventPress: (e: CalEvent) => void }) {
  const t = useSharedValue(0);
  useEffect(() => { t.value = withTiming(1, { duration: 220, easing: EASE }); }, []); // eslint-disable-line

  // Opacity and a small rise — not height. Animating height relayouts the whole
  // list every frame, which is what made opening a day stutter; the card simply
  // takes its new size and the content arrives into it.
  const style = useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [{ translateY: (1 - t.value) * -8 }],
  }));

  return (
    <Animated.View style={[styles.reveal, style]}>
      {events.map(ev => (
        <DayEventCard key={ev.id} event={ev} onPress={() => onEventPress(ev)} />
      ))}
    </Animated.View>
  );
}

// ── DayEventCard ───────────────────────────────────────────────────────────────

/**
 * One event, opened out. Colour-coded to its type, because the type is the
 * thing an athlete sorts by at a glance — a match is not a physio slot.
 *
 * No duration: nothing in `events` carries an end time yet (one row in the
 * whole club has an `end_date`, and it is the multi-day vacation), so a
 * "45 min" pill would be invented rather than reported.
 */
function DayEventCard({ event, onPress }: { event: CalEvent; onPress: () => void }) {
  const meta = eventMeta(event.type);
  const accent = eventAccent(event.type);
  const sub = [event.start_time, event.location].filter(Boolean).join('  ·  ');
  return (
    <PressableScale
      style={[styles.evCard, { backgroundColor: accent.fill }]}
      scaleTo={0.975}
      dim={false}
      onPress={onPress}
    >
      <View style={styles.evTypeRow}>
        <Ionicons name={meta.icon as any} size={13} color={accent.ink} />
        <Text style={[styles.evType, { color: accent.ink }]} numberOfLines={1}>
          {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
        </Text>
        {event.spanTotal && event.spanTotal > 1 ? (
          <Text style={[styles.evType, { color: TEXT.tertiary }]}>
            · Day {event.spanDay} of {event.spanTotal}
          </Text>
        ) : null}
      </View>
      {/* One line each: the card has an exact height so snapping stays exact.
          The full title is one tap away in the sheet. */}
      <Text style={styles.evTitle} numberOfLines={1}>{event.title}</Text>
      {sub ? <Text style={styles.evSub} numberOfLines={1}>{sub}</Text> : null}
    </PressableScale>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 4 },

  // ── Top header
  header: {
    justifyContent: 'center',
    height: 44,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontFamily: DISPLAY_FONT, fontSize: 24, color: '#FFFFFF', letterSpacing: -0.6,
  },

  backBtn: {
    position: 'absolute', right: 20, top: 8,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.sm,
    backgroundColor: SURFACE.recessed,
    borderWidth: 1, borderColor: LINE.soft,
  },
  backBtnText: { fontFamily: UI_FONT, fontSize: 12, color: TEXT.secondary },

  // ── Month strip
  monthStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingTop: 6, paddingBottom: 14,
  },
  // Wide enough to show the neighbours either side of the centre month.
  stripWindow: { width: STRIP_STEP * 3, overflow: 'hidden' },
  // Offset so page 0's label sits in the middle of the window rather than
  // at its left edge; the translate then walks it along.
  stripGroup: { flexDirection: 'row', marginLeft: STRIP_STEP },
  stripSlot: { width: STRIP_STEP, alignItems: 'center' },
  stripLabel: {
    fontFamily: DISPLAY_FONT, fontSize: 22,
    color: TEXT.primary, letterSpacing: 0.5,
  },
  stripArrow: { paddingHorizontal: 2, paddingVertical: 6 },

  // ── Go to date
  pickerBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  pickerSheet: {
    backgroundColor: '#14161F',
    borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg,
    paddingBottom: 28,
  },
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: LINE.soft,
  },
  pickerTitle:  { fontFamily: UI_FONT, fontSize: 14, color: TEXT.primary },
  pickerCancel: { fontFamily: UI_FONT, fontSize: 15, color: TEXT.tertiary },
  pickerDone:   { fontFamily: UI_FONT, fontSize: 15, color: TEXT.primary },
  picker: { alignSelf: 'stretch' },

  // One month's page in the pager. `flex: 1` so the scroller inside it has
  // the pager's full height to fill.
  monthPage: { width: SCREEN_W, flex: 1 },
  monthScroll: { flex: 1 },

  // ── Day cards
  // Near the edge on purpose: a wide gutter makes the screen itself look
  // narrower and the phone's bezel look thicker.
  cardWrap: { paddingHorizontal: 8, marginBottom: 8 },

  // The container: one card per day, holding the date and, when open, the
  // events. `overflow: hidden` keeps the revealed cards clipped to its corners
  // as it grows.
  card: {
    borderRadius: RADIUS.lg,
    backgroundColor: SURFACE.raised,
    overflow: 'hidden',
  },
  // The part you tap. Tall on purpose: the date is the card's subject, not a
  // label on a row, and it needs room around it to read that way.
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    height: CARD_FULL_H,
    paddingVertical: 20,
    paddingHorizontal: 22,
  },
  // Gone, not greyed: a day that has happened should recede without becoming a
  // puzzle to read if you do look at it.
  cardPast: { opacity: 0.42 },

  // Only the past collapses. A future day with nothing on it is still a day you
  // are looking ahead to, and shrinking it would say the opposite.
  cardSlim: {
    flexDirection: 'row',
    alignItems: 'center',
    height: CARD_SLIM_H,
    paddingVertical: 14,
    paddingHorizontal: 22,
    gap: 9,
  },
  slimNum: {
    fontFamily: DISPLAY_FONT_LARGE, fontSize: 24, lineHeight: 28,
    color: TEXT.secondary, letterSpacing: -0.8,
  },
  slimNumToday: { color: TEXT.primary },
  slimMon: {
    fontFamily: UI_FONT, fontSize: 10, letterSpacing: 1,
    color: TEXT.faint,
  },
  slimDay: {
    fontFamily: UI_FONT, fontSize: 12, letterSpacing: 1.4,
    color: TEXT.tertiary, marginLeft: 2,
  },

  dateBlock: { flex: 1 },
  dayName: {
    fontFamily: UI_FONT, fontSize: 12,
    letterSpacing: 1.4,
    color: TEXT.tertiary,
    marginBottom: 6,
  },
  // The number and the month are one object at one size, stacked. Set in the
  // plainer weight — at this size the stroke does not need to add emphasis,
  // the size already has it.
  dateNum: {
    fontFamily: DISPLAY_FONT_LARGE, fontSize: 58, lineHeight: 58,
    color: TEXT.primary, letterSpacing: -2,
  },
  dateMon: {
    fontFamily: DISPLAY_FONT_LARGE, fontSize: 58, lineHeight: 60,
    color: TEXT.secondary, letterSpacing: -1,
  },

  // ── What is on, as a hint
  dotRow: { flexDirection: 'row', alignItems: 'center', gap: 9, flexShrink: 0 },
  bigDot: { width: 13, height: 13, borderRadius: RADIUS.pill },

  // ── The day, opened
  reveal: { paddingHorizontal: 10, paddingBottom: 10 },
  // No stroke. A card with a colour of its own does not need an outline to say
  // where it ends — the fill already does that, and an outline on top reads as
  // a border drawn around a thing rather than as the thing.
  evCard: {
    borderRadius: RADIUS.lg,
    height: EVENT_CARD_BODY_H,
    paddingHorizontal: 18, paddingVertical: 16,
    marginBottom: 8,
  },
  evTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  evType: { fontFamily: UI_FONT, fontSize: 11, letterSpacing: 0.3 },
  evTitle: {
    fontFamily: DISPLAY_FONT, fontSize: 20, lineHeight: 25,
    color: TEXT.primary, letterSpacing: -0.4,
  },
  evSub: {
    fontFamily: UI_FONT, fontSize: 13,
    color: 'rgba(255,255,255,0.66)', marginTop: 5,
  },
});
