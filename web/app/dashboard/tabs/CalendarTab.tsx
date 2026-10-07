'use client';

import { useState, useEffect, useMemo } from 'react';
import { CalendarDays } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { matteAccent } from '@/lib/clubTheme';
import OpponentCrest from '@/components/OpponentCrest';
import DateField from '@/components/DateField';

/* ── Types ─────────────────────────────────────────────────────────── */
type CalEvent = {
  id:    string;
  type:  string;
  title: string;
  date:  string;
  time?: string;
  location?: string | null;
  description?: string | null;
  /** Matchday detail a coach owns — never written by the fixture sync. */
  meetTime?: string | null;
  meetLocation?: string | null;
  notes?: string | null;
  opponentLogo?: string | null;
  opponentName?: string | null;
  /** The opposing club's colour, when the club has recorded one. */
  opponentColor?: string | null;
  /** Set on multi-day events so a pill can read "Day 3 of 10". */
  spanDay?: number;
  spanTotal?: number;
  /** Real row id, without the ':date' suffix multi-day expansion adds. */
  rowId?: string;
  source?: string | null;
  startDate?: string;
  endDate?: string;
  startTime?: string;
};

type Athlete = { id: string; full_name: string };

/* ── Event colour ───────────────────────────────────────────────────────
   From the tokens, never a raw hex. This map used to be ten literals here,
   at full web saturation — and two of them disagreed with the phone about
   what they meant (`home` was purple here and green there, `rehab` the
   other way round). One source now, derived from the mobile palette.

   `ink` is the label and the mark; `fill` is an opaque card ground and
   `border` its edge. Translucent fills are gone: a card that lets the page
   through has no settled colour. */
const TYPES = new Set([
  'match', 'training', 'home', 'rehab', 'recovery',
  'meeting', 'travel', 'vacation', 'exercise', 'other',
]);

function eventVars(type: string) {
  const t = TYPES.has(type) ? type : 'other';
  return {
    ink:    `var(--event-${t})`,
    fill:   `var(--event-${t}-fill)`,
    border: `var(--event-${t}-border)`,
  };
}

/**
 * What colour a calendar item is drawn in.
 *
 * A match takes **the opposing side's colour** where the club has one — a
 * fixture against Lillestrøm is yellow, against Tromsø red — because that is
 * how a squad actually thinks about its season. Everything else takes its
 * event type, and a match with no stored colour falls back to the match clay,
 * so nothing is lost when the field is empty.
 */
function itemVars(ev: { type: string; opponentColor?: string | null }) {
  if (ev.type === 'match' && ev.opponentColor) {
    const m = matteAccent(ev.opponentColor);
    return { ink: m.ink, fill: m.fill, border: m.ink };
  }
  return eventVars(ev.type);
}

const TYPE_LABEL: Record<string, string> = {
  match: 'Match', training: 'Training', home: 'Home training',
  rehab: 'Rehab', recovery: 'Recovery', meeting: 'Meeting',
  travel: 'Travel', vacation: 'Vacation', exercise: 'Exercise', other: 'Other',
};

const LEGEND = [
  { key: 'match', label: 'Match' }, { key: 'training', label: 'Training' },
  { key: 'home', label: 'Home training' }, { key: 'rehab', label: 'Rehab' },
  { key: 'recovery', label: 'Recovery' }, { key: 'meeting', label: 'Meeting' },
  { key: 'travel', label: 'Travel' }, { key: 'vacation', label: 'Vacation' },
];

const DAY_LABELS   = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_FULL     = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const MONTH_NAMES  = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];


/* Which fields each event type actually uses — mirrors the creation forms in NewEventTab.
 * A vacation has no kick-off time and no venue; a training session has no end date. */
const EDIT_FIELDS: Record<string, { end: boolean; time: boolean; location: boolean }> = {
  vacation: { end: true,  time: false, location: false },
  home:     { end: true,  time: false, location: false },
  rehab:    { end: true,  time: false, location: false },
  training: { end: false, time: true,  location: true  },
  meeting:  { end: false, time: true,  location: true  },
  other:    { end: false, time: true,  location: true  },
};

/* ── Helpers ────────────────────────────────────────────────────────── */
function toDateStr(d: Date): string {
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function isoToDateStr(iso: string): string {
  const d = new Date(iso);
  return toDateStr(d);
}

/**
 * The wall clock in the viewer's zone.
 *
 * **Never slice a timestamptz.** `iso.slice(11, 16)` reads the UTC portion
 * straight off the wire, so a 09:30 session at Aspmyra was drawn as 07:30 and
 * the web calendar disagreed with the phone by two hours about the same event.
 * The mobile app hit this exact bug and it is written up in CLAUDE.md.
 */
function localTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}


function getCalendarGrid(year: number, month: number): { date: Date; current: boolean }[] {
  const first       = new Date(year, month, 1);
  const last        = new Date(year, month + 1, 0);
  const startOffset = (first.getDay() + 6) % 7;
  const cells: { date: Date; current: boolean }[] = [];

  for (let i = startOffset - 1; i >= 0; i--)
    cells.push({ date: new Date(year, month, -i), current: false });
  for (let d = 1; d <= last.getDate(); d++)
    cells.push({ date: new Date(year, month, d), current: true });
  while (cells.length < 42) {
    const prev = cells[cells.length - 1].date;
    const next = new Date(prev); next.setDate(prev.getDate() + 1);
    cells.push({ date: next, current: false });
  }
  return cells;
}

/* ── Main component ─────────────────────────────────────────────────── */
export default function CalendarTab({
  clubId,
  onAddEvent,
}: {
  clubId:      string;
  onAddEvent?: (date: string) => void;
}) {
  const supabase = createClient();
  const today    = new Date();

  const [viewDate,     setViewDate]     = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [events,       setEvents]       = useState<CalEvent[]>([]);
  const [athletes,     setAthletes]     = useState<Athlete[]>([]);
  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeDate,   setActiveDate]   = useState<string | null>(null);
  const [editMatch,    setEditMatch]    = useState<CalEvent | null>(null);
  const [refreshKey,   setRefreshKey]   = useState(0);
  const [pendingDelete, setPendingDelete] = useState<CalEvent[] | null>(null);
  const [editEvent,    setEditEvent]    = useState<CalEvent | null>(null);
  const [hidden,       setHidden]       = useState<{ id: string; title: string; date: string }[]>([]);

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();

  useEffect(() => {
    supabase.from('profiles').select('id, full_name')
      .eq('club_id', clubId).eq('role', 'athlete').is('removed_at', null).order('full_name')
      .then(({ data }) => setAthletes((data ?? []) as Athlete[]));
  }, [clubId]);

  useEffect(() => {
    let cancelled = false;
    const rangeStart = new Date(year, month - 1, 1).toISOString();
    const rangeEnd   = new Date(year, month + 2, 0).toISOString();

    async function load() {
      const [evRes, matchRes, hiddenRes] = await Promise.all([
        supabase.from('events').select('id, type, title, event_date, end_date, location, description')
          .eq('club_id', clubId).gte('event_date', rangeStart).lte('event_date', rangeEnd),
        supabase.from('matches').select('id, opponent, match_date, is_home, location, meet_time, meet_location, notes, opponent_logo_url, opponent_color, source')
          .eq('club_id', clubId).is('suppressed_at', null)
          .gte('match_date', rangeStart).lte('match_date', rangeEnd),
        // Removed fixtures are kept so the sync cannot resurrect them; surface them so
        // removal is not a one-way door.
        supabase.from('matches').select('id, opponent, match_date, is_home')
          .eq('club_id', clubId).not('suppressed_at', 'is', null)
          .gte('match_date', rangeStart).lte('match_date', rangeEnd),
      ]);
      if (cancelled) return;

      // The athlete filter. An event with no assignment rows is for the whole
      // squad, so it shows for everyone; one with rows shows only for those
      // athletes. (This filter used to reload and change nothing.)
      let evRows = evRes.data ?? [];
      if (selectedId && evRows.length) {
        const { data: asg } = await supabase.from('event_assignments')
          .select('event_id, athlete_id').in('event_id', evRows.map((e: any) => e.id));
        if (cancelled) return;
        const assigned = new Map<string, Set<string>>();
        for (const a of asg ?? []) {
          if (!assigned.has(a.event_id)) assigned.set(a.event_id, new Set());
          assigned.get(a.event_id)!.add(a.athlete_id);
        }
        evRows = evRows.filter((e: any) => !assigned.has(e.id) || assigned.get(e.id)!.has(selectedId));
      }

      // Multi-day events (vacations, rehab blocks, home programmes with an end date) must
      // appear on every day they cover, not just the first. Previously end_date was not
      // even fetched, so a two-week break showed as a single pill.
      const evs: CalEvent[] = evRows.flatMap((e: any) => {
        const start = isoToDateStr(e.event_date);
        const end   = e.end_date ? isoToDateStr(e.end_date) : start;

        const days: string[] = [];
        const cursor = new Date(start + 'T12:00:00');
        const last   = new Date(end + 'T12:00:00');
        // Guard against a mis-entered end date turning into thousands of cells.
        for (let i = 0; i < 400 && cursor <= last; i++) {
          days.push(toDateStr(cursor));
          cursor.setDate(cursor.getDate() + 1);
        }
        if (days.length === 0) days.push(start);

        return days.map((d, i) => ({
          id: days.length > 1 ? `${e.id}:${d}` : e.id,
          rowId: e.id,
          startDate: start,
          endDate: end,
          startTime: localTime(e.event_date),
          type: e.type,
          title: e.title,
          date: d,
          // Only the opening day carries a time; later days would imply it restarts.
          time: i === 0 ? localTime(e.event_date) : undefined,
          location: e.location,
          description: e.description,
          spanDay: days.length > 1 ? i + 1 : undefined,
          spanTotal: days.length > 1 ? days.length : undefined,
        }));
      });
      const matches: CalEvent[] = (matchRes.data ?? []).map((m: any) => ({
        id: m.id, type: 'match',
        title: (m.is_home ? 'vs ' : '@ ') + m.opponent,
        date: isoToDateStr(m.match_date),
        time: localTime(m.match_date),
        location: m.location,
        meetTime: m.meet_time,
        meetLocation: m.meet_location,
        notes: m.notes,
        opponentLogo: m.opponent_logo_url,
        opponentName: m.opponent,
        opponentColor: m.opponent_color,
        rowId: m.id,
        source: m.source,
      }));
      setHidden((hiddenRes.data ?? []).map((m: any) => ({
        id: m.id,
        title: (m.is_home ? 'vs ' : '@ ') + m.opponent,
        date: isoToDateStr(m.match_date),
      })));
      setEvents([...evs, ...matches].sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')));
    }
    load();
    return () => { cancelled = true; };
  }, [clubId, year, month, selectedId, refreshKey]);

  const grid    = useMemo(() => getCalendarGrid(year, month), [year, month]);
  const todayStr = toDateStr(today);
  const selectedAthlete = athletes.find(a => a.id === selectedId);

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const goToday   = () => setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));

  const activeDateEvents = activeDate ? events.filter(e => e.date === activeDate) : [];
  const activeD          = activeDate ? new Date(activeDate + 'T12:00:00') : null;

  const plannedOnActive = activeDateEvents.length;

  // overflow:clip — same reason as GroupsTab: the off-screen day panel must not create a
  // scrollable overflow area that focus can drag into view.
  return (
    <div style={{ height: '100%', overflow: 'clip', position: 'relative' }}>
    <div className="page" style={{ height: '100%', overflowY: 'auto' }} onClick={() => setDropdownOpen(false)}>

      {/* ── Header — Home's: a title set light, the context beside it, actions right ── */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        {/* Fixed width so the arrows do not jump as the month name changes length. */}
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--text-primary)', width: 210, whiteSpace: 'nowrap' }}>
          {MONTH_NAMES[month]}
          <span className="t-small" style={{ color: 'var(--text-tertiary)', marginLeft: 12, letterSpacing: 0 }}>{year}</span>
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <NavBtn onClick={prevMonth} dir="left" />
          <NavBtn onClick={nextMonth} dir="right" />
          <button onClick={goToday} className="btn-outline" style={{ height: 40, padding: '0 16px', fontSize: 13 }}>
            Today
          </button>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Athlete filter */}
          <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className="btn-outline"
              style={{
                height: 44, gap: 10, paddingRight: 14, fontSize: 13.5,
                background:  selectedId ? 'var(--surface-active)' : undefined,
                borderColor: selectedId ? 'transparent' : undefined,
              }}
            >
              {selectedAthlete ? selectedAthlete.full_name : 'Whole squad'}
              <ChevronIcon />
            </button>
            {dropdownOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 50,
                background: 'var(--surface-active)', borderRadius: 'var(--radius-md)',
                boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
                minWidth: 220, maxHeight: 380, overflowY: 'auto', padding: 6,
              }}>
                <DropItem label="Whole squad" active={!selectedId}
                  onClick={() => { setSelectedId(null); setDropdownOpen(false); }} />
                <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 6px' }} />
                {athletes.map(a => (
                  <DropItem key={a.id} label={a.full_name} active={selectedId === a.id}
                    onClick={() => { setSelectedId(a.id); setDropdownOpen(false); }} />
                ))}
              </div>
            )}
          </div>
          <button className="btn-accent" onClick={() => onAddEvent?.(activeDate ?? todayStr)}>
            <PlusIcon /> New event
          </button>
        </div>
      </header>

      {/* ── The month — one card, ruled into days ──────────────────────
          A single surface with structural lines rather than 42 outlined boxes:
          the grid is one object, and the days are divisions of it. */}
      <section className="card" style={{ flex: 1, padding: 0, minHeight: 640 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', padding: '18px 0 10px' }}>
          {DAY_LABELS.map(d => (
            <div key={d} style={{ padding: '0 16px', fontSize: 12, color: 'var(--text-tertiary)' }}>{d}</div>
          ))}
        </div>

        <div style={{
          flex: 1, display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gridTemplateRows: 'repeat(6, minmax(96px, 1fr))',
        }}>
          {grid.map(({ date, current }, i) => {
            const ds        = toDateStr(date);
            const isToday   = ds === todayStr;
            const isActive  = ds === activeDate;
            const dayEvents = events.filter(e => e.date === ds);
            const shown     = dayEvents.slice(0, 3);
            const overflow  = dayEvents.length - shown.length;

            return (
              <button
                key={i}
                className="cal-cell"
                onClick={() => setActiveDate(ds === activeDate ? null : ds)}
                style={{
                  borderTop:  '1px solid var(--border-subtle)',
                  borderLeft: i % 7 ? '1px solid var(--border-subtle)' : 'none',
                  background: isActive ? 'var(--surface-active)' : undefined,
                }}
              >
                {/* Today is the one club-coloured mark on the page — the same
                    "today" Home's week chart draws. */}
                <span style={{
                  width: 28, height: 28, marginLeft: -6, marginTop: -4,
                  borderRadius: 'var(--radius-full)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: isToday ? 600 : 500, fontVariantNumeric: 'tabular-nums',
                  background: isToday ? 'var(--accent-solid)' : 'transparent',
                  color: isToday ? 'var(--accent-on)'
                    : current ? (isActive ? 'var(--text-primary)' : 'var(--text-secondary)')
                    : 'var(--text-disabled)',
                }}>
                  {date.getDate()}
                </span>
                <span style={{
                  display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6, minWidth: 0,
                  opacity: current ? 1 : 0.4,
                }}>
                  {shown.map(ev => <EventLine key={ev.id} event={ev} />)}
                  {overflow > 0 && (
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', paddingLeft: 14 }}>
                      {overflow} more
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Legend — on the canvas, under the card, at a whisper */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', marginTop: -12, padding: '0 4px' }}>
        {LEGEND.map(({ key, label }) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <i style={{ width: 8, height: 8, borderRadius: 2, background: eventVars(key).ink, flexShrink: 0 }} />
            <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>

      {/* ── The day — Home's light card, slid in ─────────────────────── */}
      {activeDate && (
        <div
          onClick={() => setActiveDate(null)}
          style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(0,0,0,0.45)' }}
        />
      )}

      <aside style={{
        position:   'absolute', top: 16, right: 16, bottom: 16,
        width:      'min(420px, calc(100% - 32px))',
        zIndex:     30,
        display:    'flex', flexDirection: 'column',
        background: 'var(--surface-light)',
        color:      'var(--ink)',
        borderRadius: 'var(--radius-card)',
        boxShadow:  '0 24px 80px rgba(0,0,0,0.5)',
        transform:  activeDate ? 'translateX(0)' : 'translateX(calc(100% + 24px))',
        transition: 'transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)',
        overflow:   'hidden',
      }}>
        {activeD && (
          <>
            <div style={{ padding: '26px 28px 18px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }}>
                  {DAY_FULL[(activeD.getDay() + 6) % 7]}
                </span>
                <button
                  onClick={() => setActiveDate(null)}
                  title="Close"
                  style={{
                    width: 38, height: 38, borderRadius: 'var(--radius-full)', border: 'none', cursor: 'pointer',
                    background: 'var(--ink)', color: 'var(--surface-light)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <CloseIcon />
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 18 }}>
                <span style={{ fontSize: 72, fontWeight: 200, letterSpacing: '-0.045em', lineHeight: 0.85, fontVariantNumeric: 'tabular-nums' }}>
                  {activeD.getDate()}
                </span>
                <span style={{ fontSize: 15, color: 'var(--ink-secondary)' }}>
                  {MONTH_NAMES[activeD.getMonth()]} {activeD.getFullYear()}
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-secondary)', marginTop: 14 }}>
                {plannedOnActive === 0 ? 'Nothing planned' : `${plannedOnActive} planned`}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 28px' }}>
              {plannedOnActive === 0 ? (
                <div style={{
                  borderTop: '1px solid var(--ink-line)', padding: '28px 0',
                  display: 'flex', alignItems: 'center', gap: 12, color: 'var(--ink-secondary)', fontSize: 13.5,
                }}>
                  <CalendarDays size={20} strokeWidth={1.5} />
                  A free day, so far.
                </div>
              ) : (
                activeDateEvents.map(ev => (
                  <DayRow
                    key={ev.id}
                    event={ev}
                    onEdit={ev.type === 'match' ? () => setEditMatch(ev) : () => setEditEvent(ev)}
                    onDelete={() => setPendingDelete([ev])}
                  />
                ))
              )}
            </div>

            <div style={{ padding: '16px 28px 24px', flexShrink: 0 }}>
              <button
                className="btn-ink"
                onClick={() => {
                  onAddEvent?.(activeDate!);
                  setActiveDate(null);
                }}
              >
                <PlusIcon /> Add on this day
              </button>

              <HiddenOnDay
                items={hidden.filter(h => h.date === activeDate)}
                onRestored={() => setRefreshKey(k => k + 1)}
              />

              {plannedOnActive > 1 && (
                <button
                  onClick={() => setPendingDelete(activeDateEvents)}
                  style={{ ...INK_BTN, display: 'block', margin: '14px auto 0', color: 'var(--ink-danger)' }}
                >
                  Clear this day
                </button>
              )}
            </div>
          </>
        )}
      </aside>

      {editEvent && (
        <EventEditor
          event={editEvent}
          onClose={() => setEditEvent(null)}
          onSaved={() => { setEditEvent(null); setRefreshKey(k => k + 1); }}
        />
      )}

      {pendingDelete && (
        <DeleteConfirm
          items={pendingDelete}
          onClose={() => setPendingDelete(null)}
          onDone={() => { setPendingDelete(null); setRefreshKey(k => k + 1); }}
        />
      )}

      {editMatch && (
        <MatchDayEditor
          match={editMatch}
          onClose={() => setEditMatch(null)}
          onSaved={() => { setEditMatch(null); setRefreshKey(k => k + 1); }}
        />
      )}
    </div>
  );
}

/** A text button on the light day panel. */
const INK_BTN: React.CSSProperties = {
  background: 'none', border: 'none', padding: '4px 0',
  fontFamily: 'inherit', fontSize: 12.5, fontWeight: 500,
  color: 'var(--ink)', cursor: 'pointer',
};

/* ── One thing on the opened day ────────────────────────────────────────
 * A row, not a card: time in its own column, the type as a small square and
 * a label — the way Home's day card lists a day. Event cards used to be
 * filled with the type colour, a stack of blue, olive and maroon slabs; the
 * type is information, so it gets a mark, never a ground. */
function DayRow({ event, onEdit, onDelete }: { event: CalEvent; onEdit?: () => void; onDelete?: () => void }) {
  const { ink } = itemVars(event);
  const meetTime = event.meetTime ? localTime(event.meetTime) : null;
  const hasTime = event.time && event.time !== '00:00';

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '52px 1fr', gap: 10,
      padding: '16px 0', borderTop: '1px solid var(--ink-line)',
    }}>
      <span style={{ fontSize: 13.5, color: 'var(--ink-secondary)', fontVariantNumeric: 'tabular-nums', paddingTop: 1 }}>
        {hasTime ? event.time : event.spanTotal ? 'All day' : ''}
      </span>

      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--ink-secondary)' }}>
          <i style={{ width: 8, height: 8, borderRadius: 2, background: ink, flexShrink: 0 }} />
          {TYPE_LABEL[event.type] ?? event.type}
          {event.spanTotal && <span>· Day {event.spanDay} of {event.spanTotal}</span>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
          {event.type === 'match' && (
            <OpponentCrest url={event.opponentLogo} name={event.opponentName ?? event.title} color={event.opponentColor} size={26} />
          )}
          <span style={{ fontSize: 15, fontWeight: 500, letterSpacing: '-0.01em' }}>{event.title}</span>
        </div>

        {event.location && (
          <div style={{ fontSize: 13, color: 'var(--ink-secondary)', marginTop: 4 }}>{event.location}</div>
        )}
        {event.description && (
          <div style={{ fontSize: 13, color: 'var(--ink-secondary)', marginTop: 6, lineHeight: 1.55 }}>{event.description}</div>
        )}

        {/* Matchday detail — what an athlete actually opens the app to check. */}
        {(meetTime || event.meetLocation || event.notes) && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(meetTime || event.meetLocation) && (
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                Meet {[meetTime, event.meetLocation].filter(Boolean).join(' · ')}
              </div>
            )}
            {event.notes && (
              <div style={{ fontSize: 13, color: 'var(--ink-secondary)', lineHeight: 1.55 }}>{event.notes}</div>
            )}
          </div>
        )}

        {(onEdit || onDelete) && (
          <div style={{ display: 'flex', gap: 18, marginTop: 10 }}>
            {onEdit && (
              <button onClick={onEdit} style={INK_BTN}>
                {event.type !== 'match'
                  ? 'Edit'
                  : (meetTime || event.meetLocation || event.notes) ? 'Edit matchday info' : 'Add meeting time'}
              </button>
            )}
            {onDelete && (
              <button onClick={onDelete} title="Remove from calendar" style={{ ...INK_BTN, color: 'var(--ink-danger)' }}>
                Remove
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Matchday editor ────────────────────────────────────────────────── */
// Only club-owned fields are editable here. Opponent, kick-off and home/away come from the
// fixture provider and are overwritten on every sync, so letting a coach edit them would
// silently lose their work.
function MatchDayEditor({ match, onClose, onSaved }: {
  match: any; onClose: () => void; onSaved: () => void;
}) {
  const supabase = createClient();

  // Default the meeting to 90 minutes before kick-off — the usual convention, so a coach
  // normally confirms rather than types.
  const kickOff = match.date && match.time ? new Date(`${match.date}T${match.time}:00`) : null;
  const defaultMeet = kickOff ? new Date(kickOff.getTime() - 90 * 60 * 1000) : null;
  const asTime = (d: Date | null) =>
    d ? `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` : '';

  const [meetTime, setMeetTime] = useState<string>(
    match.meetTime
      ? asTime(new Date(match.meetTime))
      : asTime(defaultMeet),
  );
  const [meetLocation, setMeetLocation] = useState<string>(match.meetLocation ?? '');
  const [notes,        setNotes]        = useState<string>(match.notes ?? '');
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function save() {
    setSaving(true); setError('');
    const { error: err } = await supabase.from('matches').update({
      meet_time:     meetTime ? new Date(`${match.date}T${meetTime}:00`).toISOString() : null,
      meet_location: meetLocation.trim() || null,
      notes:         notes.trim() || null,
    }).eq('id', match.id);
    setSaving(false);
    if (err) { setError('Could not save. Please try again.'); return; }
    onSaved();
  }

  return (
    <div
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div style={{
        width: 460, borderRadius: 'var(--radius-xl)',
        background: 'var(--surface-raised)', border: '1px solid var(--border-default)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)', padding: 24,
      }}>
        <div className="t-subheading" style={{ color: 'var(--text-primary)' }}>{match.title}</div>
        <div className="t-small" style={{ color: 'var(--text-tertiary)', marginTop: 3, marginBottom: 20 }}>
          Kick-off {match.time}{match.location ? ` · ${match.location}` : ''}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>Meet at</label>
            <input className="input" type="time" value={meetTime}
              onChange={e => setMeetTime(e.target.value)} style={{ width: 140 }} />
          </div>

          <div>
            <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>Meeting point</label>
            <input className="input" value={meetLocation}
              onChange={e => setMeetLocation(e.target.value)}
              placeholder="e.g. Clubhouse car park" />
          </div>

          <div>
            <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>Anything else</label>
            <textarea className="input" rows={3} value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Bus leaves sharp, bring passports…"
              style={{ resize: 'vertical' }} />
          </div>
        </div>

        {error && (
          <div className="t-small" style={{ color: 'var(--color-danger)', marginTop: 14 }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 22 }}>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Small components ───────────────────────────────────────────────── */
/** One line in a day cell: the type's mark, the time, the title. No fill —
 *  a month of filled pills in ten colours is the "too much" this replaced. */
function EventLine({ event }: { event: CalEvent }) {
  const { ink } = itemVars(event);
  const isMatch = event.type === 'match';
  const continued = (event.spanDay ?? 1) > 1;
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, fontSize: 12, lineHeight: 1.35 }}>
      <i style={{ width: 8, height: 8, borderRadius: 2, background: ink, flexShrink: 0 }} />
      {event.time && event.time !== '00:00' && (
        <span style={{ color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{event.time}</span>
      )}
      <span style={{
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        color: continued ? 'var(--text-tertiary)' : isMatch ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontWeight: isMatch ? 600 : 400,
      }}>
        {event.title}
      </span>
    </span>
  );
}

function NavBtn({ onClick, dir }: { onClick: () => void; dir: 'left' | 'right' }) {
  return (
    <button
      onClick={onClick}
      className="btn-outline"
      title={dir === 'left' ? 'Previous month' : 'Next month'}
      style={{ width: 40, height: 40, padding: 0 }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {dir === 'left' ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
      </svg>
    </button>
  );
}

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

function DropItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left', borderRadius: 10,
        padding: '9px 12px', fontSize: 13, fontWeight: active ? 600 : 400,
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        background: active ? 'var(--surface-hover)' : 'transparent',
        border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.1s',
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-raised)'; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
    >
      {label}
    </button>
  );
}

/* ── Delete confirmation ────────────────────────────────────────────
 * Scope is spelled out rather than implied. Removing a vacation from its fifth day
 * deletes the entire block, and a coach has no way to know that from the card alone.
 */
function DeleteConfirm({ items, onClose, onDone }: {
  items: any[]; onClose: () => void; onDone: () => void;
}) {
  const supabase = createClient();
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const bulk    = items.length > 1;
  const spanned = items.filter(i => i.spanTotal);
  const synced  = items.filter(i => i.type === 'match' && i.source === 'api');

  async function run() {
    setBusy(true); setError('');
    for (const it of items) {
      const { error: err } = await supabase.rpc('delete_calendar_item', {
        p_kind: it.type === 'match' ? 'match' : 'event',
        p_id: it.rowId ?? it.id,
      });
      if (err) { setError(err.message.replace(/^.*?:\s*/, '')); setBusy(false); return; }
    }
    onDone();
  }

  const fmt = (d?: string) =>
    d ? new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : '';

  return (
    <div
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 320,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div style={{
        width: 460, borderRadius: 'var(--radius-xl)',
        background: 'var(--surface-raised)', border: '1px solid var(--border-default)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)', padding: 24,
      }}>
        <div className="t-subheading" style={{ color: 'var(--text-primary)', marginBottom: 14 }}>
          {bulk ? `Remove ${items.length} things from this day?` : `Remove ${items[0].title}?`}
        </div>

        {bulk && (
          <ul style={{ margin: '0 0 14px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map(i => (
              <li key={i.id} className="t-small" style={{ color: 'var(--text-secondary)' }}>
                · {i.title}
                {i.spanTotal ? ` — the whole ${i.spanTotal}-day block` : ''}
              </li>
            ))}
          </ul>
        )}

        {spanned.length > 0 && (
          <div style={{
            padding: '12px 14px', marginBottom: 14, borderRadius: 'var(--radius-md)',
            background: 'var(--color-warning-subtle)', border: '1px solid var(--color-warning-border)',
          }}>
            <div className="t-small" style={{ color: 'var(--color-warning)', lineHeight: 1.6 }}>
              {bulk ? 'Some of these run across several days.' : 'This runs across several days.'}{' '}
              Removing it takes out the whole block
              {spanned.length === 1 && spanned[0].startDate
                ? ` — ${fmt(spanned[0].startDate)} to ${fmt(spanned[0].endDate)}`
                : ''}, not just this day. To keep it but change the dates, edit it instead.
            </div>
          </div>
        )}

        {synced.length > 0 && (
          <div className="t-small" style={{ color: 'var(--text-tertiary)', lineHeight: 1.6, marginBottom: 14 }}>
            {synced.length === 1 ? 'This match came from your fixture list' : 'Some of these came from your fixture list'} —
            it will stay hidden and will not come back on the next update.
          </div>
        )}

        {error && (
          <div className="t-small" style={{ color: 'var(--color-danger)', marginBottom: 14 }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn-ghost" autoFocus>Cancel</button>
          <button
            onClick={run}
            disabled={busy}
            className="btn-primary"
            style={{ background: 'var(--color-danger)', borderColor: 'var(--color-danger-border)', color: '#fff', boxShadow: 'none' }}
          >
            {busy ? 'Removing…' : bulk ? `Remove ${items.length}` : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Event editor ───────────────────────────────────────────────────
 * Editing the dates is the answer to "I want to shorten this break" — the alternative
 * would be splitting a row in two, which is a lot of machinery for something coaches
 * are unlikely to want.
 *
 * Type is deliberately not editable: it drives the colour and the athletes' view, and
 * changing a vacation into a training session is almost always a mistake rather than
 * an intention.
 */
function EventEditor({ event, onClose, onSaved }: {
  event: any; onClose: () => void; onSaved: () => void;
}) {
  const supabase = createClient();

  const [title,   setTitle]   = useState<string>(event.title ?? '');
  const [start,   setStart]   = useState<string>(event.startDate ?? event.date);
  const [end,     setEnd]     = useState<string>(
    event.endDate && event.endDate !== event.startDate ? event.endDate : '',
  );
  const [time,    setTime]    = useState<string>(
    event.startTime && event.startTime !== '00:00' ? event.startTime : '',
  );
  const [location, setLocation]    = useState<string>(event.location ?? '');
  const [description, setDescription] = useState<string>(event.description ?? '');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function save() {
    if (!title.trim()) { setError('This needs a name.'); return; }
    if (!start)        { setError('Pick a start date.'); return; }
    if (end && end < start) { setError('The end date is before the start date.'); return; }

    setSaving(true); setError('');
    const { error: err } = await supabase.from('events').update({
      title:       title.trim(),
      event_date:  start + (time ? `T${time}:00` : 'T00:00:00'),
      end_date:    end ? end + 'T00:00:00' : null,
      location:    location.trim() || null,
      description: description.trim() || null,
    }).eq('id', event.rowId ?? event.id);

    setSaving(false);
    if (err) { setError('Could not save. Please try again.'); return; }
    onSaved();
  }

  // Never hide a field that already holds a value, or existing data becomes unreachable.
  const allowed = EDIT_FIELDS[event.type] ?? { end: true, time: true, location: true };
  const showEnd      = allowed.end      || !!end;
  const showTime     = allowed.time     || !!time;
  const showLocation = allowed.location || !!location;

  const spans = !!end && end !== start;
  const dayCount = spans
    ? Math.round((new Date(end + 'T12:00:00').getTime() - new Date(start + 'T12:00:00').getTime()) / 86400000) + 1
    : 1;

  return (
    <div
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 310,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div style={{
        width: 480, maxHeight: '88vh', overflowY: 'auto',
        borderRadius: 'var(--radius-xl)',
        background: 'var(--surface-raised)', border: '1px solid var(--border-default)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)', padding: 24,
      }}>
        <div className="t-subheading" style={{ color: 'var(--text-primary)' }}>Edit</div>
        <div className="t-small" style={{ color: 'var(--text-tertiary)', marginTop: 3, marginBottom: 20 }}>
          {TYPE_LABEL[event.type] ?? event.type}
          {spans ? ` · ${dayCount} days` : ''}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>Name</label>
            <input className="input" value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          {showEnd ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>Starts</label>
                <DateField value={start} onChange={setStart} />
              </div>
              <div>
                <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>Ends</label>
                {/* min = start, so the picker opens on the right month and cannot go backwards. */}
                <DateField value={end} onChange={setEnd} min={start} placeholder="Same day" />
              </div>
            </div>
          ) : (
            <div>
              <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>Date</label>
              <DateField value={start} onChange={setStart} />
            </div>
          )}

          {showTime && (
            <div>
              <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>Time (optional)</label>
              <input className="input" type="time" value={time}
                onChange={e => setTime(e.target.value)} style={{ width: 140 }} />
            </div>
          )}

          {showLocation && (
            <div>
              <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>Location (optional)</label>
              <input className="input" value={location} onChange={e => setLocation(e.target.value)} />
            </div>
          )}

          <div>
            <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>Notes (optional)</label>
            <textarea className="input" rows={3} value={description}
              onChange={e => setDescription(e.target.value)} style={{ resize: 'vertical' }} />
          </div>
        </div>

        {error && (
          <div className="t-small" style={{ color: 'var(--color-danger)', marginTop: 14 }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 22 }}>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Hidden fixtures on a day ───────────────────────────────────────
 * A removed provider fixture is only hidden, never deleted. Without this it would be
 * unrecoverable from the interface, which makes "Remove" feel more final than it is.
 */
function HiddenOnDay({ items, onRestored }: {
  items: { id: string; title: string }[];
  onRestored: () => void;
}) {
  const supabase = createClient();
  const [busy, setBusy] = useState<string | null>(null);

  if (items.length === 0) return null;

  async function restore(id: string) {
    setBusy(id);
    const { error } = await supabase.rpc('restore_calendar_match', { p_id: id });
    setBusy(null);
    if (!error) onRestored();
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 12, color: 'var(--ink-secondary)', marginBottom: 6 }}>
        Removed from this day · {items.length}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map(h => (
          <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--ink-secondary)', flex: 1, minWidth: 0, textDecoration: 'line-through' }}>
              {h.title}
            </span>
            <button
              onClick={() => restore(h.id)}
              disabled={busy === h.id}
              style={{ ...INK_BTN, flexShrink: 0 }}
            >
              {busy === h.id ? 'Adding…' : 'Add back'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
