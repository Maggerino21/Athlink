'use client';

import { useState, useEffect, useMemo } from 'react';
import { CalendarDays } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
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

/* ── Color map ──────────────────────────────────────────────────────── */
const COLOR: Record<string, string> = {
  match:    '#FB923C',
  training: '#60A5FA',
  home:     '#A78BFA',
  rehab:    '#34D399',
  recovery: '#4ADE80',
  meeting:  '#F472B6',
  travel:   '#FBBF24',
  vacation: '#94A3B8',
  exercise: '#C084FC',
  other:    '#9CA3AF',
};

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

function hexToRgb(hex: string): string {
  const c = hex.replace('#', '');
  return `${parseInt(c.slice(0,2),16)}, ${parseInt(c.slice(2,4),16)}, ${parseInt(c.slice(4,6),16)}`;
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
      .eq('club_id', clubId).eq('role', 'athlete').order('full_name')
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
        supabase.from('matches').select('id, opponent, match_date, is_home, location, meet_time, meet_location, notes, opponent_logo_url, source')
          .eq('club_id', clubId).is('suppressed_at', null)
          .gte('match_date', rangeStart).lte('match_date', rangeEnd),
        // Removed fixtures are kept so the sync cannot resurrect them; surface them so
        // removal is not a one-way door.
        supabase.from('matches').select('id, opponent, match_date, is_home')
          .eq('club_id', clubId).not('suppressed_at', 'is', null)
          .gte('match_date', rangeStart).lte('match_date', rangeEnd),
      ]);
      if (cancelled) return;

      // Multi-day events (vacations, rehab blocks, home programmes with an end date) must
      // appear on every day they cover, not just the first. Previously end_date was not
      // even fetched, so a two-week break showed as a single pill.
      const evs: CalEvent[] = (evRes.data ?? []).flatMap((e: any) => {
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
          startTime: e.event_date.slice(11, 16),
          type: e.type,
          title: e.title,
          date: d,
          // Only the opening day carries a time; later days would imply it restarts.
          time: i === 0 ? e.event_date.slice(11, 16) : undefined,
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
        time: m.match_date.slice(11, 16),
        location: m.location,
        meetTime: m.meet_time,
        meetLocation: m.meet_location,
        notes: m.notes,
        opponentLogo: m.opponent_logo_url,
        opponentName: m.opponent,
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

  // overflow:clip — same reason as GroupsTab: the off-screen day panel must not create a
  // scrollable overflow area that focus can drag into view.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'clip', position: 'relative' }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '20px 28px 16px',
        borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <NavBtn onClick={prevMonth} dir="left" />
          <div style={{ minWidth: 180, textAlign: 'center' }}>
            <span className="t-subheading" style={{ color: 'var(--text-primary)' }}>
              {MONTH_NAMES[month]} {year}
            </span>
          </div>
          <NavBtn onClick={nextMonth} dir="right" />
          <button onClick={goToday} className="btn-ghost" style={{ padding: '5px 12px', fontSize: 12, marginLeft: 4 }}>
            Today
          </button>
        </div>

        {/* Athlete selector */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setDropdownOpen(o => !o)}
            className="btn-ghost"
            style={{
              gap: 8, paddingRight: 10,
              borderColor: selectedId ? 'var(--accent-border)' : undefined,
              background:  selectedId ? 'var(--accent-subtle)' : undefined,
              color:       selectedId ? 'var(--accent)' : undefined,
            }}
          >
            <span style={{ fontSize: 13 }}>{selectedAthlete ? selectedAthlete.full_name : '👥  All athletes'}</span>
            <ChevronIcon />
          </button>
          {dropdownOpen && (
            <div style={{
              position: 'absolute', top: '110%', right: 0, zIndex: 50,
              background: 'var(--surface-3)', border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              minWidth: 200, overflow: 'hidden',
            }}>
              <DropItem label="👥  All athletes" active={!selectedId}
                onClick={() => { setSelectedId(null); setDropdownOpen(false); }} />
              <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
              {athletes.map(a => (
                <DropItem key={a.id} label={a.full_name} active={selectedId === a.id}
                  onClick={() => { setSelectedId(a.id); setDropdownOpen(false); }} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Calendar grid ───────────────────────────────────────────── */}
      <div
        style={{ flex: 1, overflow: 'auto', padding: '0 12px 12px' }}
        onClick={() => setDropdownOpen(false)}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, marginBottom: 2, paddingTop: 12 }}>
          {DAY_LABELS.map(d => (
            <div key={d} style={{
              textAlign: 'center', padding: '4px 0',
              fontSize: 11, fontWeight: 600, letterSpacing: '0.07em',
              color: 'var(--text-tertiary)', textTransform: 'uppercase',
            }}>{d}</div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
          {grid.map(({ date, current }, i) => {
            const ds        = toDateStr(date);
            const isToday   = ds === todayStr;
            const isActive  = ds === activeDate;
            const dayEvents = events.filter(e => e.date === ds);
            const shown     = dayEvents.slice(0, 3);
            const overflow  = dayEvents.length - shown.length;
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;

            return (
              <div
                key={i}
                onClick={() => setActiveDate(ds === activeDate ? null : ds)}
                style={{
                  minHeight: 96, borderRadius: 'var(--radius-sm)',
                  padding: '6px 6px 4px', cursor: 'pointer',
                  background: isActive
                    ? 'var(--accent-subtle)'
                    : isToday
                    ? 'rgba(255,255,255,0.04)'
                    : isWeekend && current
                    ? 'rgba(255,255,255,0.02)'
                    : current
                    ? 'rgba(255,255,255,0.015)'
                    : 'transparent',
                  border: isActive
                    ? '1px solid var(--accent-border)'
                    : isToday
                    ? '1px solid var(--accent-border)'
                    : '1px solid var(--border-subtle)',
                  opacity: current ? 1 : 0.38,
                  transition: 'background 0.12s, border-color 0.12s',
                }}
              >
                {/* Date number */}
                <div style={{
                  fontSize: 12, fontWeight: isToday || isActive ? 700 : 500,
                  color: isToday || isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  marginBottom: 4, textAlign: 'right', lineHeight: 1,
                }}>
                  {date.getDate()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {shown.map(ev => <EventPill key={ev.id} event={ev} />)}
                  {overflow > 0 && (
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', paddingLeft: 4, marginTop: 1 }}>
                      +{overflow} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '8px 20px',
          padding: '14px 4px 4px', borderTop: '1px solid var(--border-subtle)', marginTop: 12,
        }}>
          {LEGEND.map(({ key, label }) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: COLOR[key], flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Date card panel ─────────────────────────────────────────── */}
      {/* Backdrop */}
      {activeDate && (
        <div
          onClick={() => setActiveDate(null)}
          style={{
            position: 'absolute', inset: 0, zIndex: 20,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(2px)',
          }}
        />
      )}

      {/* Panel */}
      <div style={{
        position:   'absolute', top: 0, right: 0, bottom: 0,
        width:      400,
        zIndex:     30,
        display:    'flex', flexDirection: 'column',
        background: 'var(--surface-3)',
        borderLeft: '1px solid var(--border-default)',
        boxShadow:  '-12px 0 48px rgba(0,0,0,0.35)',
        transform:  activeDate ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.26s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      }}>
        {activeD && (
          <>
            {/* Panel header */}
            <div style={{
              padding: '24px 24px 20px',
              borderBottom: '1px solid var(--border-subtle)',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div className="t-label" style={{ marginBottom: 6 }}>
                    {DAY_FULL[(activeD.getDay() + 6) % 7]}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                    <span style={{ fontSize: 48, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.03em' }}>
                      {activeD.getDate()}
                    </span>
                    <span className="t-subheading" style={{ color: 'var(--text-secondary)' }}>
                      {MONTH_NAMES[activeD.getMonth()]} {activeD.getFullYear()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setActiveDate(null)}
                  className="btn-ghost"
                  style={{ width: 32, height: 32, padding: 0, flexShrink: 0 }}
                >
                  <CloseIcon />
                </button>
              </div>

              {/* Event count badge */}
              <div style={{ marginTop: 12 }}>
                {activeDateEvents.length === 0 ? (
                  <span className="t-small" style={{ color: 'var(--text-tertiary)' }}>No events scheduled</span>
                ) : (
                  <span className="badge">{activeDateEvents.length} {activeDateEvents.length === 1 ? 'event' : 'events'}</span>
                )}
              </div>
            </div>

            {/* Event list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {activeDateEvents.length === 0 ? (
                <div style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 8,
                  color: 'var(--text-tertiary)', textAlign: 'center', paddingBottom: 48,
                }}>
                  <CalendarDays size={36} strokeWidth={1.25} style={{ opacity: 0.4 }} />
                  <div className="t-small">Nothing planned for this day.</div>
                  <div className="t-small" style={{ opacity: 0.6 }}>Use the button below to add something.</div>
                </div>
              ) : (
                activeDateEvents.map(ev => (
                  <DetailCard
                    key={ev.id}
                    event={ev}
                    onEdit={ev.type === 'match' ? () => setEditMatch(ev) : () => setEditEvent(ev)}
                    onDelete={() => setPendingDelete([ev])}
                  />
                ))
              )}
            </div>

            {/* Add event button */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0 }}>
              <button
                style={{
                  width: '100%', padding: '11px 18px', fontSize: 14, fontWeight: 600,
                  fontFamily: 'inherit', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--accent-subtle)',
                  border: '1px solid var(--accent-border)',
                  color: 'var(--accent)',
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                onClick={() => {
                  onAddEvent?.(activeDate!);
                  setActiveDate(null);
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add event on this day
              </button>

              <HiddenOnDay
                items={hidden.filter(h => h.date === activeDate)}
                onRestored={() => setRefreshKey(k => k + 1)}
              />

              {activeDateEvents.length > 0 && (
                <button
                  onClick={() => setPendingDelete(activeDateEvents)}
                  className="btn-ghost"
                  style={{
                    width: '100%', marginTop: 8, justifyContent: 'center',
                    color: 'var(--color-danger)', borderColor: 'var(--color-danger-border)',
                  }}
                >
                  Clear this day
                </button>
              )}
            </div>
          </>
        )}
      </div>

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

/* ── Detail card — full event info ──────────────────────────────────── */
function DetailCard({ event, onEdit, onDelete }: { event: any; onEdit?: () => void; onDelete?: () => void }) {
  const color = COLOR[event.type] ?? COLOR.other;
  const rgb   = hexToRgb(color);
  const meetTime = event.meetTime
    ? new Date(event.meetTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : null;
  return (
    <div style={{
      borderRadius: 'var(--radius-md)',
      background:   `rgba(${rgb}, 0.07)`,
      border:       `1px solid rgba(${rgb}, 0.22)`,
      overflow:     'hidden',
    }}>
      {/* Colour bar */}
      <div style={{ height: 3, background: color }} />
      <div style={{ padding: '14px 16px' }}>
        {/* Type + time */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
            textTransform: 'uppercase', color,
          }}>
            {TYPE_LABEL[event.type] ?? event.type}
          </span>
          {event.time && event.time !== '00:00' && (
            <span className="t-small" style={{ color: 'var(--text-tertiary)' }}>
              🕐 {event.time}
            </span>
          )}
          {event.spanTotal && (
            <span className="t-small" style={{ color: 'var(--text-tertiary)' }}>
              Day {event.spanDay} of {event.spanTotal}
            </span>
          )}
        </div>
        {/* Title */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          marginBottom: event.location || event.description ? 8 : 0,
        }}>
          {event.type === 'match' && (
            <OpponentCrest url={event.opponentLogo} name={event.opponentName ?? event.title} size={26} />
          )}
          <span className="t-body-medium" style={{ color: 'var(--text-primary)' }}>
            {event.title}
          </span>
        </div>
        {/* Location */}
        {event.location && (
          <div className="t-small" style={{ color: 'var(--text-secondary)', marginBottom: event.description ? 6 : 0 }}>
            📍 {event.location}
          </div>
        )}
        {/* Description */}
        {event.description && (
          <div className="t-small" style={{ color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
            {event.description}
          </div>
        )}

        {/* Matchday detail — what an athlete actually opens the app to check. */}
        {(meetTime || event.meetLocation || event.notes) && (
          <div style={{
            marginTop: 10, paddingTop: 10,
            borderTop: `1px solid rgba(${rgb}, 0.20)`,
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            {(meetTime || event.meetLocation) && (
              <div className="t-small" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                Meet {meetTime ?? ''}{meetTime && event.meetLocation ? ' · ' : ''}{event.meetLocation ?? ''}
              </div>
            )}
            {event.notes && (
              <div className="t-small" style={{ color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
                {event.notes}
              </div>
            )}
          </div>
        )}

        {(onEdit || onDelete) && (
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            {onEdit && (
              <button onClick={onEdit} className="btn-ghost" style={{ padding: '5px 12px', fontSize: 12 }}>
                {event.type !== 'match'
                  ? 'Edit'
                  : (meetTime || event.meetLocation || event.notes) ? 'Edit matchday info' : 'Add meeting time'}
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="btn-ghost"
                title="Remove from calendar"
                style={{
                  padding: '5px 10px', fontSize: 12, marginLeft: 'auto',
                  color: 'var(--color-danger)', borderColor: 'var(--color-danger-border)',
                }}
              >
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
        background: 'var(--bg-base)', border: '1px solid var(--border-default)',
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
function EventPill({ event }: { event: CalEvent }) {
  const color = COLOR[event.type] ?? COLOR.other;
  const rgb   = hexToRgb(color);
  return (
    <div style={{
      background: `rgba(${rgb}, 0.15)`, borderLeft: `2px solid ${color}`,
      borderRadius: '0 3px 3px 0', padding: '2px 5px',
      fontSize: 10, fontWeight: 600, color,
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.4,
    }}>
      {event.time && event.time !== '00:00' ? `${event.time} ` : ''}{event.title}
      {event.spanTotal ? ` · ${event.spanDay}/${event.spanTotal}` : ''}
    </div>
  );
}

function NavBtn({ onClick, dir }: { onClick: () => void; dir: 'left' | 'right' }) {
  return (
    <button onClick={onClick} className="btn-ghost" style={{ width: 30, height: 30, padding: 0 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {dir === 'left' ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
      </svg>
    </button>
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
        display: 'block', width: '100%', textAlign: 'left',
        padding: '8px 12px', fontSize: 13, fontWeight: active ? 600 : 400,
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        background: active ? 'var(--surface-2)' : 'transparent',
        border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.1s',
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-1)'; }}
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
        background: 'var(--bg-base)', border: '1px solid var(--border-default)',
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
        background: 'var(--bg-base)', border: '1px solid var(--border-default)',
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
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
      <div className="t-label" style={{ marginBottom: 8 }}>
        Removed from this day · {items.length}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map(h => (
          <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="t-small" style={{ color: 'var(--text-tertiary)', flex: 1, minWidth: 0 }}>
              {h.title}
            </span>
            <button
              onClick={() => restore(h.id)}
              disabled={busy === h.id}
              className="btn-ghost"
              style={{ padding: '4px 10px', fontSize: 11, flexShrink: 0 }}
            >
              {busy === h.id ? 'Adding…' : 'Add back'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
