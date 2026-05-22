'use client';

import { useState, useEffect, useMemo } from 'react';
import { CalendarDays } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

/* ── Types ─────────────────────────────────────────────────────────── */
type CalEvent = {
  id:    string;
  type:  string;
  title: string;
  date:  string;
  time?: string;
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
      const [evRes, matchRes] = await Promise.all([
        supabase.from('events').select('id, type, title, event_date, location, description')
          .eq('club_id', clubId).gte('event_date', rangeStart).lte('event_date', rangeEnd),
        supabase.from('matches').select('id, opponent, match_date, is_home, location')
          .eq('club_id', clubId).gte('match_date', rangeStart).lte('match_date', rangeEnd),
      ]);
      if (cancelled) return;

      const evs: CalEvent[] = (evRes.data ?? []).map((e: any) => ({
        id: e.id, type: e.type, title: e.title,
        date: isoToDateStr(e.event_date),
        time: e.event_date.slice(11, 16),
        location: e.location,
        description: e.description,
      }));
      const matches: CalEvent[] = (matchRes.data ?? []).map((m: any) => ({
        id: m.id, type: 'match',
        title: (m.is_home ? 'vs ' : '@ ') + m.opponent,
        date: isoToDateStr(m.match_date),
        time: m.match_date.slice(11, 16),
        location: m.location,
      }));
      setEvents([...evs, ...matches].sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')));
    }
    load();
    return () => { cancelled = true; };
  }, [clubId, year, month, selectedId]);

  const grid    = useMemo(() => getCalendarGrid(year, month), [year, month]);
  const todayStr = toDateStr(today);
  const selectedAthlete = athletes.find(a => a.id === selectedId);

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const goToday   = () => setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));

  const activeDateEvents = activeDate ? events.filter(e => e.date === activeDate) : [];
  const activeD          = activeDate ? new Date(activeDate + 'T12:00:00') : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>

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
                activeDateEvents.map(ev => <DetailCard key={ev.id} event={ev} />)
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
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Detail card — full event info ──────────────────────────────────── */
function DetailCard({ event }: { event: any }) {
  const color = COLOR[event.type] ?? COLOR.other;
  const rgb   = hexToRgb(color);
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
        </div>
        {/* Title */}
        <div className="t-body-medium" style={{ color: 'var(--text-primary)', marginBottom: event.location || event.description ? 8 : 0 }}>
          {event.title}
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
