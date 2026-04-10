import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Animated, Platform, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabase';
import SlideUpSheet from '../../ui/SlideUpSheet';
import { hexToRgba } from '../../../utils/theme';

// ── Types ──────────────────────────────────────────────────────────────────────

type EventType = 'training' | 'exercise' | 'recovery' | 'travel' | 'meeting' | 'match' | 'other';

interface CalEvent {
  id: string;
  type: EventType;
  title: string;
  start_time: string | null;
  location: string | null;
  description: string | null;
  date: string; // YYYY-MM-DD
  source: 'event' | 'match';
}

interface DayGroup {
  dateStr: string;       // YYYY-MM-DD
  date: Date;
  label: string;         // "Today", "Tomorrow", "Next Tuesday" …
  subLabel: string;      // "Mon 14 Apr"
  events: CalEvent[];
  isToday: boolean;
  isPast: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const EVENT_META: Record<EventType, { icon: string; color: string }> = {
  training: { icon: 'fitness',         color: '#3B82F6' },
  exercise: { icon: 'barbell',         color: '#8B5CF6' },
  recovery: { icon: 'leaf',            color: '#22C55E' },
  travel:   { icon: 'airplane',        color: '#F59E0B' },
  meeting:  { icon: 'people',          color: '#EC4899' },
  match:    { icon: 'football',        color: '#F97316' },
  other:    { icon: 'calendar-outline',color: '#6B7280' },
};

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

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

function buildDayLabel(date: Date, today: Date, nextMondayStart: Date): { label: string; subLabel: string } {
  const todayYMD    = toYMD(today);
  const tomorrowYMD = toYMD(addDays(today, 1));
  const dateYMD     = toYMD(date);

  const dayName = DAYS[date.getDay()];
  const sub = `${dayName.slice(0,3)} ${date.getDate()} ${SHORT_MONTHS[date.getMonth()]}`;

  let label: string;
  if (dateYMD === todayYMD)    label = 'Today';
  else if (dateYMD === tomorrowYMD) label = 'Tomorrow';
  else if (date >= nextMondayStart) label = `Next ${dayName}`;
  else label = dayName;

  return { label, subLabel: sub };
}

function buildTwoWeekRange(anchor: Date): Date[] {
  const monday = startOfWeek(anchor);
  return Array.from({ length: 14 }, (_, i) => addDays(monday, i));
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
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);

  const isDefaultView = toYMD(startOfWeek(anchor)) === toYMD(startOfWeek(today));

  // ── Data ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!profile?.club_id) return;
    setLoading(true);

    const days = buildTwoWeekRange(anchor);
    const from = toYMD(days[0]);
    const to   = toYMD(days[13]);

    const [{ data: evData }, { data: matchData }] = await Promise.all([
      supabase
        .from('events')
        .select('id, type, title, location, description, event_date')
        .eq('club_id', profile.club_id)
        .gte('event_date', `${from}T00:00:00`)
        .lte('event_date', `${to}T23:59:59`)
        .order('event_date', { ascending: true }),
      supabase
        .from('matches')
        .select('id, opponent, match_date, location')
        .eq('club_id', profile.club_id)
        .gte('match_date', `${from}T00:00:00`)
        .lte('match_date', `${to}T23:59:59`)
        .order('match_date', { ascending: true }),
    ]);

    const mapped: CalEvent[] = [
      ...(evData ?? []).map((e: any) => ({
        id: e.id,
        type: e.type as EventType,
        title: e.title,
        start_time: e.event_date ? e.event_date.slice(11, 16) : null,  // HH:MM from timestamp
        location: e.location ?? null,
        description: e.description ?? null,
        date: e.event_date.slice(0, 10),
        source: 'event' as const,
      })),
      ...(matchData ?? []).map((m: any) => ({
        id: m.id,
        type: 'match' as EventType,
        title: `vs ${m.opponent}`,
        start_time: m.match_date.slice(11, 16),
        location: m.location ?? null,
        description: null,
        date: m.match_date.slice(0, 10),
        source: 'match' as const,
      })),
    ];

    setEvents(mapped);
    setLoading(false);
  }, [profile?.club_id, anchor]);

  useEffect(() => { if (isActive) load(); }, [isActive, load]);

  // ── Build day groups ──────────────────────────────────────────────────────

  const nextMondayStart = startOfWeek(addDays(today, 7));

  const dayGroups: DayGroup[] = buildTwoWeekRange(anchor).map(date => {
    const dateStr = toYMD(date);
    const { label, subLabel } = buildDayLabel(date, today, nextMondayStart);
    return {
      dateStr,
      date,
      label,
      subLabel,
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
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
      >
        {dayGroups.map((day) => (
          <DayRow
            key={day.dateStr}
            day={day}
            expanded={expandedDay === day.dateStr}
            onToggle={() => setExpanded(expandedDay === day.dateStr ? '' : day.dateStr)}
            onEventPress={setSelectedEvent}
            clubColor={profile?.club_color ?? '#3B82F6'}
          />
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
      <EventDetailSheet
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        clubColor={profile?.club_color ?? '#3B82F6'}
      />
    </View>
  );
}

// ── DayRow ─────────────────────────────────────────────────────────────────────

function DayRow({
  day, expanded, onToggle, onEventPress, clubColor,
}: {
  day: DayGroup;
  expanded: boolean;
  onToggle: () => void;
  onEventPress: (e: CalEvent) => void;
  clubColor: string;
}) {
  const anim = useRef(new Animated.Value(expanded ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: expanded ? 1 : 0,
      duration: 260,
      useNativeDriver: false,
    }).start();
  }, [expanded]);

  const isEmpty = day.events.length === 0;
  const isMuted = day.isPast && !day.isToday;

  return (
    <View style={styles.dayWrap}>
      {/* Tap target for the header */}
      <TouchableOpacity
        onPress={isEmpty ? undefined : onToggle}
        activeOpacity={isEmpty ? 1 : 0.6}
        style={styles.dayHeader}
      >
        <View style={styles.dayLabelCol}>
          {/* BIG day name */}
          <Text style={[
            styles.dayName,
            isMuted   && styles.dayNameMuted,
            day.isToday && { color: clubColor },
          ]}>
            {day.label.toUpperCase()}
          </Text>
          {/* Small date + dots row */}
          <View style={styles.dayMeta}>
            <Text style={[styles.dayDate, isMuted && { opacity: 0.35 }]}>{day.subLabel}</Text>
            {!isEmpty && (
              <View style={styles.dotRow}>
                {[...new Set(day.events.map(e => e.type))].slice(0, 5).map(type => (
                  <View key={type} style={[styles.dot, { backgroundColor: EVENT_META[type].color }]} />
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Chevron — only when events exist */}
        {!isEmpty && (
          <Animated.View style={{
            transform: [{ rotate: anim.interpolate({ inputRange: [0,1], outputRange: ['0deg','180deg'] }) }],
            opacity: 0.3,
          }}>
            <Ionicons name="chevron-down" size={20} color="#fff" />
          </Animated.View>
        )}
      </TouchableOpacity>

      {/* Expanded event list */}
      {!isEmpty && (
        <Animated.View style={{
          opacity: anim,
          maxHeight: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 800] }),
          overflow: 'hidden',
        }}>
          <View style={styles.eventList}>
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

// ── EventRow ───────────────────────────────────────────────────────────────────

function EventRow({ event, onPress, isLast }: { event: CalEvent; onPress: () => void; isLast: boolean }) {
  const meta = EVENT_META[event.type];
  return (
    <TouchableOpacity
      style={[styles.eventRow, isLast && styles.eventRowLast]}
      onPress={onPress}
      activeOpacity={0.65}
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
    </TouchableOpacity>
  );
}

// ── EventDetailSheet ───────────────────────────────────────────────────────────

function EventDetailSheet({
  event, onClose, clubColor,
}: {
  event: CalEvent | null;
  onClose: () => void;
  clubColor: string;
}) {
  if (!event) return null;
  const meta = EVENT_META[event.type];

  return (
    <SlideUpSheet visible={!!event} onClose={onClose} title={event.title}>
      {/* Type badge */}
      <View style={[detailStyles.typeBadge, { backgroundColor: hexToRgba(meta.color, 0.12), borderColor: hexToRgba(meta.color, 0.25) }]}>
        <Ionicons name={meta.icon as any} size={14} color={meta.color} style={{ marginRight: 6 }} />
        <Text style={[detailStyles.typeText, { color: meta.color }]}>
          {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
        </Text>
      </View>

      {/* Meta rows */}
      {event.start_time && (
        <View style={detailStyles.metaRow}>
          <Ionicons name="time-outline" size={16} color="rgba(255,255,255,0.3)" style={detailStyles.metaIcon} />
          <Text style={detailStyles.metaText}>{event.start_time.slice(0,5)}</Text>
        </View>
      )}
      {event.location && (
        <View style={detailStyles.metaRow}>
          <Ionicons name="location-outline" size={16} color="rgba(255,255,255,0.3)" style={detailStyles.metaIcon} />
          <Text style={detailStyles.metaText}>{event.location}</Text>
        </View>
      )}

      {/* Divider */}
      <View style={detailStyles.divider} />

      {/* Description */}
      {event.description ? (
        <Text style={detailStyles.description}>{event.description}</Text>
      ) : (
        <Text style={detailStyles.noDesc}>No additional details.</Text>
      )}

      {/* Accent line at bottom */}
      <View style={[detailStyles.accentLine, { backgroundColor: hexToRgba(clubColor, 0.4) }]} />
    </SlideUpSheet>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 4 },

  // ── Top header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 8, paddingTop: 4,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#F1F5F9', letterSpacing: 0.2 },
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 22, paddingBottom: 14,
  },

  dayLabelCol: { flex: 1 },

  // THE BIG TEXT
  dayName: {
    fontSize: 36,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: 0.5,
  },
  dayNameMuted: {
    color: 'rgba(255,255,255,0.2)',
  },

  dayMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 3 },
  dayDate: { fontSize: 13, color: 'rgba(255,255,255,0.3)', fontWeight: '400' },
  dotRow:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
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

const detailStyles = StyleSheet.create({
  typeBadge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    borderWidth: 1, marginBottom: 20,
  },
  typeText: { fontSize: 13, fontWeight: '600' },

  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  metaIcon: { marginRight: 10 },
  metaText: { fontSize: 14, color: 'rgba(255,255,255,0.6)' },

  divider: {
    height: 1, backgroundColor: 'rgba(255,255,255,0.07)',
    marginVertical: 16,
  },
  description: { fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 21 },
  noDesc:      { fontSize: 13, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' },

  accentLine: {
    height: 2, borderRadius: 1, marginTop: 24, width: 40,
  },
});
