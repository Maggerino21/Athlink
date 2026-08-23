'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Date picker replacing <input type="date">.
 *
 * The native control renders an OS-drawn popup that ignores the dark theme entirely — on
 * Windows it is a light grey box looking nothing like the rest of the app.
 *
 * Deliberately not a library: the month-grid logic is a dozen lines, and a dependency would
 * still need restyling to match the design tokens.
 *
 * `min` does two jobs — it disables earlier days AND decides which month opens first, so
 * choosing an end date starts where the start date is rather than at today.
 */

const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

const pad   = (n: number) => String(n).padStart(2, '0');
const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function parse(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s + 'T12:00:00');
  return Number.isNaN(d.getTime()) ? null : d;
}

function monthGrid(year: number, month: number) {
  const first  = new Date(year, month, 1);
  const last   = new Date(year, month + 1, 0);
  const offset = (first.getDay() + 6) % 7;            // Monday-first
  const cells: { date: Date; current: boolean }[] = [];
  for (let i = offset - 1; i >= 0; i--) cells.push({ date: new Date(year, month, -i), current: false });
  for (let d = 1; d <= last.getDate(); d++) cells.push({ date: new Date(year, month, d), current: true });
  while (cells.length % 7 !== 0) {
    const prev = cells[cells.length - 1].date;
    const next = new Date(prev);
    next.setDate(prev.getDate() + 1);
    cells.push({ date: next, current: false });
  }
  return cells;
}

export default function DateField({
  value, onChange, min, placeholder = 'Pick a date', compact = false, autoFocus = false,
}: {
  value: string;
  onChange: (v: string) => void;
  /** yyyy-mm-dd — earlier days are disabled, and the calendar opens on this month. */
  min?: string;
  placeholder?: string;
  compact?: boolean;
  autoFocus?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos,  setPos]  = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const selected = parse(value);
  const minDate  = parse(min);

  const [view, setView] = useState<Date>(() => selected ?? minDate ?? new Date());

  // Re-anchor the visible month each time it opens, so an end-date field lands on the
  // start date's month instead of today.
  useEffect(() => {
    if (!open) return;
    setView(parse(value) ?? parse(min) ?? new Date());
  }, [open, value, min]);

  const place = useCallback(() => {
    const b = btnRef.current?.getBoundingClientRect();
    if (!b) return;
    const width = 268, height = 330;
    let left = b.left;
    let top  = b.bottom + 6;
    if (left + width > window.innerWidth - 8)   left = window.innerWidth - width - 8;
    if (top + height > window.innerHeight - 8)  top  = Math.max(8, b.top - height - 6);
    setPos({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    const onDoc = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node)) return;
      if (btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  const label = selected
    ? selected.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : placeholder;

  const isDisabled = (d: Date) => (minDate ? toKey(d) < toKey(minDate) : false);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        autoFocus={autoFocus}
        onClick={() => setOpen(o => !o)}
        className="input"
        style={{
          cursor: 'pointer', textAlign: 'left',
          display: 'flex', alignItems: 'center', gap: 8,
          padding: compact ? '5px 8px' : undefined,
          fontSize: compact ? 12 : undefined,
          color: selected ? 'var(--text-primary)' : 'var(--text-tertiary)',
          borderColor: open ? 'var(--accent-border)' : undefined,
        }}
      >
        <CalendarGlyph />
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
      </button>

      {/* Fixed positioning so no scrolling ancestor can clip the popover or scroll-jump it. */}
      {open && pos && (
        <div
          ref={popRef}
          style={{
            position: 'fixed', top: pos.top, left: pos.left, width: 268, zIndex: 400,
            background: 'var(--bg-base)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 18px 50px rgba(0,0,0,0.55)',
            padding: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <NavBtn dir="left" onClick={() => setView(v => new Date(v.getFullYear(), v.getMonth() - 1, 1))} />
            <div style={{ flex: 1, textAlign: 'center' }} className="t-small">
              <strong style={{ color: 'var(--text-primary)' }}>
                {MONTHS[view.getMonth()]} {view.getFullYear()}
              </strong>
            </div>
            <NavBtn dir="right" onClick={() => setView(v => new Date(v.getFullYear(), v.getMonth() + 1, 1))} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {DAY_LABELS.map(d => (
              <div key={d} className="t-label" style={{ textAlign: 'center', fontSize: 10 }}>{d}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {monthGrid(view.getFullYear(), view.getMonth()).map(({ date, current }, i) => {
              const key     = toKey(date);
              const isSel   = value === key;
              const isToday = key === toKey(new Date());
              const off     = isDisabled(date);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={off}
                  onClick={() => { onChange(key); setOpen(false); }}
                  style={{
                    height: 30, borderRadius: 'var(--radius-sm)', border: 'none',
                    fontFamily: 'inherit', fontSize: 12,
                    fontWeight: isSel ? 700 : 500,
                    cursor: off ? 'not-allowed' : 'pointer',
                    background: isSel ? 'var(--accent-solid)' : 'transparent',
                    color: isSel ? 'var(--accent-on)'
                         : off ? 'var(--text-disabled)'
                         : current ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    outline: !isSel && isToday ? '1px solid var(--accent-border)' : 'none',
                    outlineOffset: -1,
                    opacity: off ? 0.4 : 1,
                  }}
                  onMouseEnter={e => { if (!isSel && !off) e.currentTarget.style.background = 'var(--surface-2)'; }}
                  onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
            <button
              type="button" className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}
              onClick={() => {
                const t = new Date();
                if (!isDisabled(t)) { onChange(toKey(t)); setOpen(false); }
              }}
            >
              Today
            </button>
            {value && (
              <button
                type="button" className="btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}
                onClick={() => { onChange(''); setOpen(false); }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function NavBtn({ dir, onClick }: { dir: 'left' | 'right'; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="btn-ghost" style={{ width: 26, height: 26, padding: 0 }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {dir === 'left' ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
      </svg>
    </button>
  );
}

function CalendarGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
      strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.7 }}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
