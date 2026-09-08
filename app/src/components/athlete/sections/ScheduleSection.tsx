import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ScrollView, Platform, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing,
} from 'react-native-reanimated';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabase';
import PressableScale from '../../ui/PressableScale';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AthleteStackParamList } from '../../../navigation/RootNavigator';
import { EVENT_META, type EventType, type CalEvent } from '../eventTypes';
import { hexToRgba } from '../../../utils/theme';
import { DISPLAY_FONT, UI_FONT } from '../../../utils/type';
import haptics from '../../../utils/haptics';

// ── Types ──────────────────────────────────────────────────────────────────────

interface DayGroup {
  dateStr: string;       // YYYY-MM-DD
  date: Date;
  label: string;         // "Today", or just the day name
  /** Set on the Monday that opens a week block — "Last week" / "This week" / … */
  weekLabel: string | null;
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

/**
 * Last week, this week, next week — 21 days from the Monday BEFORE the anchor's
 * week. Last week is in range so the schedule has somewhere to scroll back to;
 * the list still opens on today, so its only cost is that the gesture works.
 */
const RANGE_DAYS = 21;

function buildRange(anchor: Date): Date[] {
  const monday = addDays(startOfWeek(anchor), -7);
  return Array.from({ length: RANGE_DAYS }, (_, i) => addDays(monday, i));
}

/** Only Mondays open a block, and only these three are ever on screen. */
function weekLabelFor(date: Date, today: Date): string | null {
  if (date.getDay() !== 1) return null;
  const diff = Math.round((startOfWeek(date).getTime() - startOfWeek(today).getTime()) / 604800000);
  return diff === -1 ? 'Last week' : diff === 0 ? 'This week' : diff === 1 ? 'Next week' : null;
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [anchor, setAnchor]         = useState<Date>(today);  // determines which 2 weeks to show
  const [events, setEvents]         = useState<CalEvent[]>([]);
  const [loading, setLoading]       = useState(false);
  const [expandedDay, setExpanded]  = useState<string>(toYMD(today));
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerDate, setPickerDate] = useState(today);
  const navigation = useNavigation<NativeStackNavigationProp<AthleteStackParamList>>();

  // The list still starts on Monday — the earlier days of this week have to be
  // reachable — but it opens scrolled to today rather than making you scroll
  // down past days that have already happened. Driven off the today row's own
  // layout rather than index * rowHeight, because a row's height changes once
  // it is expanded and any arithmetic would drift the moment one is.
  const scrollRef = useRef<ScrollView>(null);
  const didJump = useRef(false);
  useEffect(() => { didJump.current = false; }, [anchor]);

  const isDefaultView = toYMD(startOfWeek(anchor)) === toYMD(startOfWeek(today));

  // ── Data ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!profile?.club_id) return;
    setLoading(true);

    const days = buildRange(anchor);
    const from = days[0];
    const to   = addDays(days[RANGE_DAYS - 1], 1);   // exclusive upper bound, local

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

    setEvents(mapped);
    setLoading(false);
  }, [profile?.club_id, anchor]);

  useEffect(() => { if (isActive) load(); }, [isActive, load]);

  // ── Build day groups ──────────────────────────────────────────────────────

  const dayGroups: DayGroup[] = buildRange(anchor).map(date => {
    const dateStr = toYMD(date);
    return {
      dateStr,
      date,
      label: buildDayLabel(date, today),
      weekLabel: weekLabelFor(date, today),
      events: events.filter(e => e.date === dateStr),
      isToday: dateStr === toYMD(today),
      isPast:  date < today,
    };
  });

  // ── Jump to date ──────────────────────────────────────────────────────────

  const handlePickerChange = (_: any, date?: Date) => {
    if (Platform.OS === 'android') setPickerVisible(false);
    if (date) setPickerDate(date);
  };

  const confirmJump = () => {
    setAnchor(pickerDate);
    setExpanded(toYMD(pickerDate));
    setPickerVisible(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Schedule</Text>
        <View style={styles.headerRight}>
          {!isDefaultView && (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => { setAnchor(today); setExpanded(toYMD(today)); }}
              activeOpacity={0.7}
            >
              <Ionicons name="return-up-back" size={14} color="rgba(147,197,253,0.8)" style={{ marginRight: 4 }} />
              <Text style={styles.backBtnText}>Today</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.jumpBtn}
            onPress={() => setPickerVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="calendar" size={14} color="rgba(255,255,255,0.4)" style={{ marginRight: 5 }} />
            <Text style={styles.jumpBtnText}>Jump to date</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Day list */}
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
      >
        {dayGroups.map((day) => (
          <React.Fragment key={day.dateStr}>
            {day.weekLabel && <WeekMark label={day.weekLabel} />}
            <DayRow
            day={day}
            onMeasure={day.isToday ? (y) => {
              if (didJump.current) return;
              didJump.current = true;
              scrollRef.current?.scrollTo({ y, animated: false });
            } : undefined}
            expanded={expandedDay === day.dateStr}
            onToggle={() => {
              haptics.selection();
              setExpanded(expandedDay === day.dateStr ? '' : day.dateStr);
            }}
            onEventPress={(e: CalEvent) => navigation.navigate('EventDetail', { event: e })}
            clubColor={profile?.club_color ?? '#3B82F6'}
            />
          </React.Fragment>
        ))}
      </ScrollView>

      {/* Date picker */}
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
                  <Text style={styles.pickerTitle}>Jump to date</Text>
                  <TouchableOpacity onPress={confirmJump}>
                    <Text style={styles.pickerDone}>Go</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={pickerDate}
                  mode="date"
                  display="spinner"
                  onChange={handlePickerChange}
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
            onChange={(e, date) => { setPickerVisible(false); if (date) { setPickerDate(date); setAnchor(date); setExpanded(toYMD(date)); } }}
          />
        )
      )}

      {/* Event detail sheet */}
    </View>
  );
}

// ── DayRow ─────────────────────────────────────────────────────────────────────

function DayRow({
  day, expanded, onToggle, onEventPress, clubColor, onMeasure,
}: {
  day: DayGroup;
  expanded: boolean;
  onToggle: () => void;
  onEventPress: (e: CalEvent) => void;
  clubColor: string;
  onMeasure?: (y: number) => void;
}) {
  // Drives both the chevron and the reveal. Reanimated applies these on the UI
  // thread — the old `Animated` version ran with useNativeDriver:false, which
  // meant every single frame of this expand crossed the bridge.
  const progress = useSharedValue(expanded ? 1 : 0);
  // Natural height of the event list, captured on first layout. Animating to a
  // measured height rather than a hardcoded maxHeight means the reveal takes the
  // same time regardless of how many events a day holds — and days with more
  // than the old 800px cap no longer get silently clipped.
  const measured = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(expanded ? 1 : 0, {
      duration: 300,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
  }, [expanded]); // eslint-disable-line react-hooks/exhaustive-deps

  const listStyle = useAnimatedStyle(() => {
    // Before the first layout pass we don't know the natural height yet, so
    // fall back to auto (expanded) or zero (collapsed) to avoid a one-frame pop.
    if (measured.value === 0) {
      return { height: progress.value > 0.5 ? undefined : 0, opacity: progress.value };
    }
    return { height: measured.value * progress.value, opacity: progress.value };
  });

  const isEmpty = day.events.length === 0;
  const isMuted = day.isPast && !day.isToday;

  return (
    <View
      style={styles.dayWrap}
      onLayout={onMeasure ? (e) => onMeasure(e.nativeEvent.layout.y) : undefined}
    >
      {/* Tap target for the header */}
      <TouchableOpacity
        onPress={isEmpty ? undefined : onToggle}
        activeOpacity={isEmpty ? 1 : 0.6}
        style={styles.dayHeader}
      >
        {/* Sized to fill the row rather than set at a fixed point size: the
            names differ in length by a factor of two ("Today" vs "Wednesday"),
            so a size that fills the box for one leaves the other floating in
            it. Auto-fit makes every day read as the same weight of thing. */}
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.3}
          allowFontScaling={false}
          style={[
            styles.dayName,
            isMuted && styles.dayNameMuted,
            day.isToday && { color: clubColor },
          ]}
        >
          {day.label.toUpperCase()}
        </Text>

        {/* What is on, without saying what it is yet. */}
        {!isEmpty && (
          <View style={styles.dotRow}>
            {[...new Set(day.events.map(e => e.type))].slice(0, 5).map(type => (
              <View key={type} style={[styles.dot, { backgroundColor: EVENT_META[type].color }]} />
            ))}
          </View>
        )}
      </TouchableOpacity>

      {/* Expanded event list */}
      {!isEmpty && (
        <Animated.View style={[{ overflow: 'hidden' }, listStyle]}>
          {/* Inner view lays out at its natural height regardless of the clipped
              parent, which is what makes it measurable. */}
          <View
            style={styles.eventList}
            onLayout={(e) => { measured.value = e.nativeEvent.layout.height; }}
          >
            {day.events.map((ev, i) => (
              <EventRow
                key={ev.id}
                event={ev}
                onPress={() => onEventPress(ev)}
                isLast={i === day.events.length - 1}
              />
            ))}
          </View>
        </Animated.View>
      )}

      {/* Full-width divider */}
      <View style={styles.divider} />
    </View>
  );
}

// ── WeekMark ───────────────────────────────────────────────────────────────────

/**
 * The divider between week blocks. Rules on both sides rather than a left-
 * aligned heading, because the day names it separates are centred — a heading
 * off to one side would read as belonging to the row under it rather than to
 * the block.
 */
function WeekMark({ label }: { label: string }) {
  return (
    <View style={styles.weekMark}>
      <View style={styles.weekRule} />
      <Text style={styles.weekMarkText}>{label.toUpperCase()}</Text>
      <View style={styles.weekRule} />
    </View>
  );
}

// ── EventRow ───────────────────────────────────────────────────────────────────

function EventRow({ event, onPress, isLast }: { event: CalEvent; onPress: () => void; isLast: boolean }) {
  const meta = EVENT_META[event.type];
  return (
    <PressableScale
      style={[styles.eventRow, isLast && styles.eventRowLast]}
      onPress={onPress}
      scaleTo={0.975}
      haptic="medium"
    >
      {/* Coloured left strip */}
      <View style={[styles.eventStrip, { backgroundColor: meta.color }]} />

      <View style={[styles.eventIconWrap, { backgroundColor: hexToRgba(meta.color, 0.1) }]}>
        <Ionicons name={meta.icon as any} size={18} color={meta.color} />
      </View>

      <View style={styles.eventInfo}>
        <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
        {event.location
          ? <Text style={styles.eventMeta} numberOfLines={1}>{event.location}</Text>
          : null}
      </View>

      {event.start_time
        ? <Text style={styles.eventTime}>{event.start_time.slice(0, 5)}</Text>
        : null}
    </PressableScale>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 4 },

  // ── Top header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 10, paddingTop: 4,
  },
  headerTitle: {
    fontFamily: DISPLAY_FONT, fontSize: 24, color: '#FFFFFF', letterSpacing: -0.6,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  backBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
    backgroundColor: 'rgba(147,197,253,0.08)',
    borderWidth: 1, borderColor: 'rgba(147,197,253,0.2)',
  },
  backBtnText: { fontSize: 12, color: 'rgba(147,197,253,0.8)', fontWeight: '600' },

  jumpBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
  },
  jumpBtnText: { fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: '500' },

  // ── Day rows — full-width, no cards
  dayWrap: { width: '100%' },

  dayHeader: {
    paddingHorizontal: 16, paddingTop: 18, paddingBottom: 14,
    alignItems: 'center', justifyContent: 'center',
  },

  // THE BIG TEXT — one line, centred, as large as the row will take.
  dayName: {
    fontFamily: DISPLAY_FONT,
    fontSize: 68,
    lineHeight: 74,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -1.5,
  },
  dayNameMuted: {
    color: 'rgba(255,255,255,0.18)',
  },

  weekMark: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 30, paddingBottom: 12,
  },
  weekRule: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.10)' },
  weekMarkText: {
    fontFamily: UI_FONT, fontSize: 10, letterSpacing: 2.4,
    color: 'rgba(255,255,255,0.35)',
  },

  dotRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 8 },
  dot:     { width: 6, height: 6, borderRadius: 3 },

  // Full-width divider between days
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginHorizontal: 0,
  },

  // ── Event list inside expanded day
  eventList: {
    paddingBottom: 8,
  },

  eventRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  eventRowLast: {
    // no special style needed, divider is on the dayWrap
  },
  eventStrip: {
    width: 3, height: 36, borderRadius: 2, flexShrink: 0,
  },
  eventIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  eventInfo:  { flex: 1 },
  eventTitle: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  eventMeta:  { fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 3 },
  eventTime:  { fontSize: 14, color: 'rgba(255,255,255,0.4)', fontWeight: '500', flexShrink: 0 },

  // ── Date picker modal (iOS)
  pickerBackdrop: {
    flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)',
  },
  pickerSheet: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 32,
  },
  pickerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  pickerTitle:  { fontSize: 15, fontWeight: '600', color: '#F1F5F9' },
  pickerCancel: { fontSize: 15, color: 'rgba(255,255,255,0.4)' },
  pickerDone:   { fontSize: 15, fontWeight: '700', color: '#60A5FA' },
  picker:       { height: 200 },
});
