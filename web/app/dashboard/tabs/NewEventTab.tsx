'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Dumbbell, Home, HeartPulse, Users, FileText, Umbrella,
  CheckCircle, Wrench, Upload, File as FileIcon,
} from 'lucide-react';

/* ── Types ──────────────────────────────────────────────────────────── */
type EventCategory = {
  key:         string;
  label:       string;
  description: string;
  color:       string;
  icon:        React.FC<{ size?: number; color?: string; strokeWidth?: number }>;
};

type Athlete = { id: string; full_name: string };

type Group = { id: string; name: string; color: string };


type LineItem = { label: string; time: string };

/* ── Categories ─────────────────────────────────────────────────────── */
const CATEGORIES: EventCategory[] = [
  {
    key:         'training',
    label:       'Team training',
    description: 'Session for the whole squad — date, time and location',
    color:       '#60A5FA',
    icon:        Dumbbell,
  },
  {
    key:         'home',
    label:       'Home training',
    description: 'Individual program with PDF — assigned to players',
    color:       '#A78BFA',
    icon:        Home,
  },
  {
    key:         'rehab',
    label:       'Rehabilitation',
    description: 'Physio rehab protocol — PDF upload, completion tracking',
    color:       '#34D399',
    icon:        HeartPulse,
  },
  {
    key:         'meeting',
    label:       'Meeting',
    description: 'Team or individual meeting — tactical, administrative',
    color:       '#F472B6',
    icon:        Users,
  },
  {
    key:         'other',
    label:       'Generic event',
    description: 'Anything else — travel, logistics, custom line items',
    color:       '#9CA3AF',
    icon:        FileText,
  },
  {
    key:         'vacation',
    label:       'Vacation / Break',
    description: 'Block off a period — winter break, international window',
    color:       '#94A3B8',
    icon:        Umbrella,
  },
];

/* ── Helpers ────────────────────────────────────────────────────────── */
const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];
const DAY_FULL    = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return `${DAY_FULL[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function hexToRgb(hex: string): string {
  const c = hex.replace('#', '');
  return `${parseInt(c.slice(0,2),16)}, ${parseInt(c.slice(2,4),16)}, ${parseInt(c.slice(4,6),16)}`;
}

/* ── Root component ─────────────────────────────────────────────────── */
type View = { type: 'pick' } | { type: 'form'; category: EventCategory };

export default function NewEventTab({ clubId, prefilledDate }: { clubId: string; prefilledDate?: string }) {
  const [view, setView] = useState<View>({ type: 'pick' });

  // Reset to picker when prefilledDate changes (new calendar tap)
  useEffect(() => { setView({ type: 'pick' }); }, [prefilledDate]);

  if (view.type === 'form') {
    return (
      <EventForm
        category={view.category}
        clubId={clubId}
        date={prefilledDate}
        onBack={() => setView({ type: 'pick' })}
      />
    );
  }

  return (
    <div style={{ padding: '36px 40px', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: 36 }}>
        <div className="t-label" style={{ marginBottom: 6 }}>Dashboard</div>
        <h1 className="t-display" style={{ color: 'var(--text-primary)', margin: '0 0 8px' }}>
          New event
        </h1>
        {prefilledDate ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <DateChip date={prefilledDate} color="var(--accent)" bg="var(--accent-subtle)" border="var(--accent-border)" />
            <span className="t-body" style={{ color: 'var(--text-secondary)' }}>— pick a type below</span>
          </div>
        ) : (
          <p className="t-body" style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Choose a category to get started. These colours appear on the calendar for both staff and athletes.
          </p>
        )}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
        gap: 16,
      }}>
        {CATEGORIES.map((cat) => (
          <CategoryCard key={cat.key} category={cat} onClick={() => setView({ type: 'form', category: cat })} />
        ))}
      </div>
    </div>
  );
}

/* ── Category picker card ───────────────────────────────────────────── */
function CategoryCard({ category, onClick }: { category: EventCategory; onClick: () => void }) {
  const { label, description, color, icon: Icon } = category;
  const rgb = hexToRgb(color);

  return (
    <button
      onClick={onClick}
      style={{
        background: `rgba(${rgb}, 0.07)`, border: `1px solid rgba(${rgb}, 0.22)`,
        borderRadius: 'var(--radius-lg)', padding: '24px 20px', textAlign: 'left',
        cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s, transform 0.12s, box-shadow 0.15s',
        display: 'flex', flexDirection: 'column', gap: 12,
        fontFamily: 'inherit', position: 'relative', overflow: 'hidden',
      }}
      onMouseEnter={e => {
        const b = e.currentTarget as HTMLButtonElement;
        b.style.background = `rgba(${rgb}, 0.13)`; b.style.borderColor = `rgba(${rgb}, 0.40)`;
        b.style.transform = 'translateY(-2px)'; b.style.boxShadow = `0 8px 32px rgba(${rgb}, 0.18)`;
      }}
      onMouseLeave={e => {
        const b = e.currentTarget as HTMLButtonElement;
        b.style.background = `rgba(${rgb}, 0.07)`; b.style.borderColor = `rgba(${rgb}, 0.22)`;
        b.style.transform = 'translateY(0)'; b.style.boxShadow = 'none';
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color, borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0' }} />
      <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: `rgba(${rgb}, 0.14)`, border: `1px solid rgba(${rgb}, 0.28)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={22} color={color} strokeWidth={1.75} />
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color, marginBottom: 4, letterSpacing: '-0.01em' }}>{label}</div>
        <div className="t-small" style={{ color: 'var(--text-tertiary)', lineHeight: 1.5 }}>{description}</div>
      </div>
      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
          <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
        </svg>
      </div>
    </button>
  );
}

/* ── Form router ────────────────────────────────────────────────────── */
function EventForm({ category, clubId, date, onBack }: { category: EventCategory; clubId: string; date?: string; onBack: () => void }) {
  const props = { clubId, date, onBack, color: category.color };

  return (
    <div style={{ padding: '36px 40px', maxWidth: 640, margin: '0 auto' }}>
      {/* Back */}
      <button onClick={onBack} className="btn-ghost" style={{ marginBottom: 28, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
        </svg>
        All event types
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: date ? 16 : 32 }}>
        <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', background: `rgba(${hexToRgb(category.color)}, 0.14)`, border: `1px solid rgba(${hexToRgb(category.color)}, 0.30)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <category.icon size={24} color={category.color} strokeWidth={1.75} />
        </div>
        <div>
          <div className="t-label" style={{ marginBottom: 4 }}>New event</div>
          <h1 className="t-heading" style={{ color: category.color, margin: 0 }}>{category.label}</h1>
        </div>
      </div>

      {date && (
        <div style={{ marginBottom: 28 }}>
          <DateChip date={date} color={category.color} bg={`rgba(${hexToRgb(category.color)}, 0.10)`} border={`rgba(${hexToRgb(category.color)}, 0.25)`} />
        </div>
      )}

      {category.key === 'training'  && <TrainingForm       {...props} />}
      {category.key === 'home'     && <HomeProgramForm    {...props} type="home" />}
      {category.key === 'rehab'    && <HomeProgramForm    {...props} type="rehab" />}
      {category.key === 'meeting'  && <MeetingForm        {...props} />}
      {category.key === 'other'    && <GenericForm        {...props} />}
      {category.key === 'vacation' && <VacationForm       {...props} />}
    </div>
  );
}

/* ── Shared form primitives ─────────────────────────────────────────── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label className="t-label">{label}</label>
      {children}
    </div>
  );
}

function DateChip({ date, color, bg, border }: { date: string; color: string; bg: string; border: string }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 'var(--radius-full)', background: bg, border: `1px solid ${border}`, fontSize: 13, fontWeight: 600, color }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      {formatDate(date)}
    </div>
  );
}

function SubmitBtn({ color, loading, label = 'Create event' }: { color: string; loading: boolean; label?: string }) {
  const rgb = hexToRgb(color);
  return (
    <button
      type="submit"
      disabled={loading}
      style={{
        width: '100%', padding: '13px 18px', fontSize: 14, fontWeight: 600,
        fontFamily: 'inherit', cursor: loading ? 'not-allowed' : 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        borderRadius: 'var(--radius-md)',
        background: `rgba(${rgb}, 0.15)`,
        border: `1px solid rgba(${rgb}, 0.35)`,
        color,
        opacity: loading ? 0.5 : 1,
        transition: 'opacity 0.15s',
        marginTop: 8,
      }}
    >
      {loading ? 'Creating…' : label}
    </button>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--color-danger-subtle)', border: '1px solid var(--color-danger-border)', color: 'var(--color-danger)', fontSize: 13 }}>{msg}</div>;
}

function SuccessBanner({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <div style={{ padding: '32px 28px', borderRadius: 'var(--radius-xl)', background: 'var(--color-success-subtle)', border: '1px solid var(--color-success-border)', textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
        <CheckCircle size={40} color="var(--color-success)" strokeWidth={1.5} />
      </div>
      <div className="t-subheading" style={{ color: 'var(--color-success)', marginBottom: 8 }}>{label} created</div>
      <button onClick={onBack} className="btn-ghost" style={{ marginTop: 8 }}>← Back to event types</button>
    </div>
  );
}

/* ── Athlete / group selector ───────────────────────────────────────── */
function AthleteSelector({ clubId, wholeSquad, onWholeSquadChange, selectedAthletes, onAthletesChange, selectedGroupIds, onGroupChange }: {
  clubId:             string;
  wholeSquad:         boolean;
  onWholeSquadChange: (v: boolean) => void;
  selectedAthletes:   string[];
  onAthletesChange:   (ids: string[]) => void;
  selectedGroupIds:   string[];
  onGroupChange:      (ids: string[]) => void;
}) {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [groups,   setGroups]   = useState<Group[]>([]);
  const supabase = createClient();

  useEffect(() => {
    supabase.from('profiles').select('id, full_name')
      .eq('club_id', clubId).eq('role', 'athlete').order('full_name')
      .then(({ data }) => setAthletes((data ?? []) as Athlete[]));
    supabase.from('groups').select('id, name, color')
      .eq('club_id', clubId).order('name')
      .then(({ data }) => setGroups((data ?? []) as Group[]));
  }, [clubId]);

  function toggleGroup(id: string) {
    onGroupChange(selectedGroupIds.includes(id)
      ? selectedGroupIds.filter(x => x !== id)
      : [...selectedGroupIds, id]);
  }

  function toggleAthlete(id: string) {
    onAthletesChange(selectedAthletes.includes(id)
      ? selectedAthletes.filter(x => x !== id)
      : [...selectedAthletes, id]);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Whole squad toggle */}
      <button
        type="button"
        onClick={() => onWholeSquadChange(!wholeSquad)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 14px', borderRadius: 'var(--radius-md)', textAlign: 'left',
          fontFamily: 'inherit', cursor: 'pointer',
          background: wholeSquad ? 'var(--surface-3)' : 'var(--surface-1)',
          border: wholeSquad ? '1px solid var(--border-strong)' : '1px solid var(--border-default)',
          transition: 'all 0.12s',
        }}
      >
        <div style={{
          width: 16, height: 16, borderRadius: 4, flexShrink: 0,
          border: wholeSquad ? '2px solid var(--accent)' : '2px solid var(--border-strong)',
          background: wholeSquad ? 'var(--accent-subtle)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {wholeSquad && <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="2 6 5 9 10 3"/></svg>}
        </div>
        <span className="t-small" style={{ color: 'var(--text-primary)', fontWeight: wholeSquad ? 700 : 400 }}>Whole squad</span>
      </button>

      {/* Groups + athletes — always visible; whole squad is just an override */}
      <div style={{ opacity: wholeSquad ? 0.4 : 1, pointerEvents: wholeSquad ? 'none' : 'auto', transition: 'opacity 0.15s' }}>
        {/* Groups */}
        {groups.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="t-label">Groups {selectedGroupIds.length > 0 && `· ${selectedGroupIds.length} selected`}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {groups.map(g => {
                  const rgb     = hexToRgb(g.color);
                  const checked = selectedGroupIds.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => toggleGroup(g.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 14px', borderRadius: 'var(--radius-md)', textAlign: 'left',
                        fontFamily: 'inherit', cursor: 'pointer',
                        background: checked ? `rgba(${rgb}, 0.12)` : 'var(--surface-1)',
                        border: checked ? `1px solid rgba(${rgb}, 0.35)` : '1px solid var(--border-default)',
                        transition: 'all 0.12s',
                      }}
                    >
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                      <span className="t-small" style={{ color: checked ? g.color : 'var(--text-primary)', fontWeight: checked ? 700 : 400, flex: 1 }}>
                        {g.name}
                      </span>
                      {checked && (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={g.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Individual athletes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="t-label">Individual athletes {selectedAthletes.length > 0 && `· ${selectedAthletes.length} selected`}</div>
            <AthleteSearch athletes={athletes} selected={selectedAthletes} onToggle={toggleAthlete} />
          </div>
      </div>
    </div>
  );
}

/* ── Athlete search + multi-select ─────────────────────────────────── */
function AthleteSearch({ athletes, selected, onToggle }: {
  athletes: Athlete[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? athletes.filter(a => a.full_name.toLowerCase().includes(query.toLowerCase()))
    : athletes;

  // Selected athletes always shown at top, then unselected filtered results
  const selectedList   = athletes.filter(a => selected.includes(a.id));
  const unselectedList = filtered.filter(a => !selected.includes(a.id));
  const displayed      = query.trim() ? filtered : [...selectedList, ...unselectedList];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Search input */}
      <div style={{ position: 'relative' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
          style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          className="input"
          placeholder="Search athletes…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ paddingLeft: 32 }}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2, display: 'flex' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 220, overflowY: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'var(--surface-1)' }}>
        {displayed.length === 0 && (
          <div className="t-small" style={{ color: 'var(--text-tertiary)', padding: '12px 14px' }}>
            {athletes.length === 0 ? 'No athletes found' : 'No matches'}
          </div>
        )}
        {displayed.map(a => {
          const checked = selected.includes(a.id);
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onToggle(a.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 14px', textAlign: 'left', fontFamily: 'inherit',
                background: checked ? 'var(--surface-2)' : 'transparent',
                border: 'none', borderBottom: '1px solid var(--border-subtle)',
                cursor: 'pointer', transition: 'background 0.1s', flexShrink: 0,
              }}
            >
              <div style={{
                width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                border: checked ? '2px solid var(--accent)' : '2px solid var(--border-strong)',
                background: checked ? 'var(--accent-subtle)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {checked && <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="2 6 5 9 10 3"/></svg>}
              </div>
              <span className="t-small" style={{ color: 'var(--text-primary)', fontWeight: checked ? 600 : 400, flex: 1 }}>
                {a.full_name}
              </span>
              {checked && !query && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected count */}
      {selected.length > 0 && (
        <div className="t-label" style={{ color: 'var(--text-secondary)' }}>
          {selected.length} athlete{selected.length !== 1 ? 's' : ''} selected
        </div>
      )}
    </div>
  );
}

/* ── PDF upload field ───────────────────────────────────────────────── */
function PdfUpload({ file, onChange, color }: { file: File | null; onChange: (f: File | null) => void; color: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const rgb = hexToRgb(color);

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        style={{ display: 'none' }}
        onChange={e => onChange(e.target.files?.[0] ?? null)}
      />
      {file ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--radius-md)', background: `rgba(${rgb}, 0.08)`, border: `1px solid rgba(${rgb}, 0.25)` }}>
          <FileIcon size={16} color={color} strokeWidth={1.75} />
          <span className="t-small" style={{ color, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
          <button type="button" onClick={() => onChange(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          style={{
            width: '100%', padding: '22px 18px', borderRadius: 'var(--radius-md)',
            background: `rgba(${rgb}, 0.05)`, border: `1.5px dashed rgba(${rgb}, 0.30)`,
            color: 'var(--text-tertiary)', fontFamily: 'inherit', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            transition: 'background 0.15s, border-color 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `rgba(${rgb}, 0.10)`; (e.currentTarget as HTMLButtonElement).style.borderColor = `rgba(${rgb}, 0.50)`; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = `rgba(${rgb}, 0.05)`; (e.currentTarget as HTMLButtonElement).style.borderColor = `rgba(${rgb}, 0.30)`; }}
        >
          <Upload size={22} color={color} strokeWidth={1.5} style={{ opacity: 0.8 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color }}>Upload PDF</span>
          <span style={{ fontSize: 11 }}>Click to browse · max 20 MB</span>
        </button>
      )}
    </div>
  );
}

/* ══ FORM: Team training ════════════════════════════════════════════ */
function TrainingForm({ clubId, date, color, onBack }: { clubId: string; date?: string; color: string; onBack: () => void }) {
  const supabase = createClient();
  const [eventDate, setEventDate] = useState(date ?? '');
  const [time,      setTime]      = useState('');
  const [duration,  setDuration]  = useState('');
  const [location,  setLocation]  = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [done,      setDone]      = useState(false);

  if (done) return <SuccessBanner label="Training session" onBack={onBack} />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!eventDate) { setError('Please pick a date.'); return; }
    setError(''); setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const datetime = eventDate + (time ? `T${time}:00` : 'T00:00:00');
      const desc     = duration ? `Duration: ${duration} min` : null;

      const { error: evErr } = await supabase.from('events').insert({
        club_id:     clubId,
        created_by:  user.id,
        type:        'training',
        title:       'Team training',
        event_date:  datetime,
        location:    location.trim() || null,
        description: desc,
      });
      if (evErr) throw evErr;
      setDone(true);
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Date">
          <input className="input" type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
        </Field>
        <Field label="Kick-off time (optional)">
          <input className="input" type="time" value={time} onChange={e => setTime(e.target.value)} />
        </Field>
      </div>

      <Field label="Location (optional)">
        <input className="input" placeholder="e.g. Main pitch, Sports hall" value={location} onChange={e => setLocation(e.target.value)} />
      </Field>

      <Field label="Duration in minutes (optional)">
        <input className="input" type="number" min="1" placeholder="e.g. 90" value={duration} onChange={e => setDuration(e.target.value)} style={{ maxWidth: 160 }} />
      </Field>

      {error && <ErrorMsg msg={error} />}
      <SubmitBtn color={color} loading={loading} />
    </form>
  );
}

/* ══ FORM: Home training / Rehab ════════════════════════════════════ */
function HomeProgramForm({ clubId, date, color, type, onBack }: {
  clubId: string; date?: string; color: string; type: 'home' | 'rehab'; onBack: () => void;
}) {
  const supabase = createClient();
  const [title,        setTitle]        = useState('');
  const [eventDate,    setEventDate]    = useState(date ?? '');
  const [endDate,      setEndDate]      = useState('');
  const [pdf,          setPdf]          = useState<File | null>(null);
  const [wholeSquad,   setWholeSquad]   = useState(false);
  const [selAthletes,  setSelAthletes]  = useState<string[]>([]);
  const [selGroupIds,  setSelGroupIds]  = useState<string[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [done,         setDone]         = useState(false);

  if (done) return <SuccessBanner label={type === 'home' ? 'Home program' : 'Rehab program'} onBack={onBack} />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim())                                   { setError('Please enter a title.'); return; }
    if (!eventDate)                                      { setError('Please pick a date.'); return; }
    if (!wholeSquad && selGroupIds.length === 0 && selAthletes.length === 0) { setError('Select at least one group or athlete, or choose whole squad.'); return; }
    setError(''); setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Upload PDF if provided
      let pdf_url: string | null = null;
      if (pdf) {
        const path = `${clubId}/${Date.now()}_${pdf.name.replace(/\s+/g, '_')}`;
        const { error: uploadErr } = await supabase.storage.from('event-pdfs').upload(path, pdf);
        if (uploadErr) throw uploadErr;
        const { data: { publicUrl } } = supabase.storage.from('event-pdfs').getPublicUrl(path);
        pdf_url = publicUrl;
      }

      // Insert event
      const { data: ev, error: evErr } = await supabase.from('events').insert({
        club_id:    clubId,
        created_by: user.id,
        type,
        title:      title.trim(),
        event_date: eventDate + 'T00:00:00',
        end_date:   endDate ? endDate + 'T00:00:00' : null,
        pdf_url,
      }).select('id').single();
      if (evErr) throw evErr;

      // Resolve assignees — merge group members + individual picks, deduplicate
      let assigneeIds: string[] = [];
      if (!wholeSquad) {
        let groupMemberIds: string[] = [];
        if (selGroupIds.length > 0) {
          const { data: members } = await supabase
            .from('group_members').select('athlete_id').in('group_id', selGroupIds);
          groupMemberIds = (members ?? []).map((m: any) => m.athlete_id as string);
        }
        assigneeIds = [...new Set([...groupMemberIds, ...selAthletes])];
      }

      if (assigneeIds.length > 0) {
        const { error: aErr } = await supabase.from('event_assignments').insert(
          assigneeIds.map(aid => ({ event_id: ev.id, athlete_id: aid }))
        );
        if (aErr) throw aErr;
      }

      setDone(true);
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Field label="Title">
        <input className="input" placeholder={type === 'home' ? 'e.g. Week 18 — Individual program' : 'e.g. Knee rehab protocol — Eriksen'} value={title} onChange={e => setTitle(e.target.value)} />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Start date">
          <input className="input" type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
        </Field>
        <Field label="End date (optional)">
          <div style={{ position: 'relative' }}>
            <input className="input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ paddingRight: endDate ? 32 : 14 }} />
            {endDate && (
              <button type="button" onClick={() => setEndDate('')}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', padding: 2 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>
        </Field>
      </div>

      <Field label="Program PDF (optional)">
        <PdfUpload file={pdf} onChange={setPdf} color={color} />
      </Field>

      <Field label="Assign to">
        <AthleteSelector
          clubId={clubId}
          wholeSquad={wholeSquad}          onWholeSquadChange={setWholeSquad}
          selectedAthletes={selAthletes}   onAthletesChange={setSelAthletes}
          selectedGroupIds={selGroupIds}   onGroupChange={setSelGroupIds}
        />
      </Field>

      {error && <ErrorMsg msg={error} />}
      <SubmitBtn color={color} loading={loading} />
    </form>
  );
}

/* ══ FORM: Meeting ══════════════════════════════════════════════════ */
function MeetingForm({ clubId, date, color, onBack }: { clubId: string; date?: string; color: string; onBack: () => void }) {
  const supabase = createClient();
  const [title,     setTitle]     = useState('');
  const [eventDate, setEventDate] = useState(date ?? '');
  const [time,      setTime]      = useState('');
  const [online,    setOnline]    = useState(false);
  const [location,  setLocation]  = useState('');
  const [link,      setLink]      = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [done,      setDone]      = useState(false);

  if (done) return <SuccessBanner label="Meeting" onBack={onBack} />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('Please enter a title.'); return; }
    if (!eventDate)     { setError('Please pick a date.'); return; }
    setError(''); setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const datetime = eventDate + (time ? `T${time}:00` : 'T00:00:00');
      const desc = online && link ? `Online — ${link}` : undefined;

      const { error: evErr } = await supabase.from('events').insert({
        club_id:     clubId,
        created_by:  user.id,
        type:        'meeting',
        title:       title.trim(),
        event_date:  datetime,
        location:    online ? 'Online' : (location.trim() || null),
        description: desc ?? null,
      });
      if (evErr) throw evErr;
      setDone(true);
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Field label="Title">
        <input className="input" placeholder="e.g. Tactical review, Individual check-in" value={title} onChange={e => setTitle(e.target.value)} />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Date">
          <input className="input" type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
        </Field>
        <Field label="Time (optional)">
          <input className="input" type="time" value={time} onChange={e => setTime(e.target.value)} />
        </Field>
      </div>

      {/* Online / In person toggle */}
      <Field label="Location type">
        <div style={{ display: 'flex', gap: 8 }}>
          {[{ v: false, l: '📍 In person' }, { v: true, l: '💻 Online' }].map(({ v, l }) => (
            <button key={String(v)} type="button" onClick={() => setOnline(v)}
              style={{ padding: '6px 14px', borderRadius: 'var(--radius-full)', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', background: online === v ? 'var(--surface-3)' : 'var(--surface-1)', border: online === v ? '1px solid var(--border-strong)' : '1px solid var(--border-default)', color: online === v ? 'var(--text-primary)' : 'var(--text-secondary)', transition: 'all 0.12s' }}>
              {l}
            </button>
          ))}
        </div>
      </Field>

      {online ? (
        <Field label="Meeting link (optional)">
          <input className="input" placeholder="https://meet.google.com/…" value={link} onChange={e => setLink(e.target.value)} />
        </Field>
      ) : (
        <Field label="Location (optional)">
          <input className="input" placeholder="e.g. Club house, Boardroom" value={location} onChange={e => setLocation(e.target.value)} />
        </Field>
      )}

      {error && <ErrorMsg msg={error} />}
      <SubmitBtn color={color} loading={loading} />
    </form>
  );
}

/* ══ FORM: Generic event ════════════════════════════════════════════ */
function GenericForm({ clubId, date, color, onBack }: { clubId: string; date?: string; color: string; onBack: () => void }) {
  const supabase = createClient();
  const [title,     setTitle]     = useState('');
  const [eventDate, setEventDate] = useState(date ?? '');
  const [time,      setTime]      = useState('');
  const [location,  setLocation]  = useState('');
  const [items,     setItems]     = useState<LineItem[]>([{ label: '', time: '' }]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [done,      setDone]      = useState(false);

  if (done) return <SuccessBanner label="Event" onBack={onBack} />;

  function updateItem(i: number, field: keyof LineItem, val: string) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: val } : it));
  }
  function addItem()    { setItems(prev => [...prev, { label: '', time: '' }]); }
  function removeItem(i: number) { setItems(prev => prev.filter((_, idx) => idx !== i)); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('Please enter a title.'); return; }
    if (!eventDate)     { setError('Please pick a date.'); return; }
    setError(''); setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const filledItems = items.filter(it => it.label.trim());
      const datetime    = eventDate + (time ? `T${time}:00` : 'T00:00:00');

      const { error: evErr } = await supabase.from('events').insert({
        club_id:    clubId,
        created_by: user.id,
        type:       'other',
        title:      title.trim(),
        event_date: datetime,
        location:   location.trim() || null,
        line_items: filledItems.length > 0 ? filledItems : null,
      });
      if (evErr) throw evErr;
      setDone(true);
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Field label="Title">
        <input className="input" placeholder="e.g. Pre-match logistics, Cup trip" value={title} onChange={e => setTitle(e.target.value)} />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Date">
          <input className="input" type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
        </Field>
        <Field label="Time (optional)">
          <input className="input" type="time" value={time} onChange={e => setTime(e.target.value)} />
        </Field>
      </div>

      <Field label="Location (optional)">
        <input className="input" placeholder="e.g. Oslo Airport, Hotel lobby" value={location} onChange={e => setLocation(e.target.value)} />
      </Field>

      {/* Line items */}
      <Field label="Schedule / line items (optional)">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                className="input"
                placeholder="e.g. Meet at bus"
                value={item.label}
                onChange={e => updateItem(i, 'label', e.target.value)}
                style={{ flex: 1 }}
              />
              <input
                className="input"
                type="time"
                value={item.time}
                onChange={e => updateItem(i, 'time', e.target.value)}
                style={{ width: 110 }}
              />
              {items.length > 1 && (
                <button type="button" onClick={() => removeItem(i)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4, flexShrink: 0 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={addItem}
            className="btn-ghost"
            style={{ alignSelf: 'flex-start', padding: '5px 12px', fontSize: 12, gap: 5, marginTop: 2 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add line
          </button>
        </div>
      </Field>

      {error && <ErrorMsg msg={error} />}
      <SubmitBtn color={color} loading={loading} />
    </form>
  );
}

/* ══ FORM: Vacation / Break ═════════════════════════════════════════ */
function VacationForm({ clubId, date, color, onBack }: { clubId: string; date?: string; color: string; onBack: () => void }) {
  const supabase = createClient();
  const [label,     setLabel]     = useState('');
  const [startDate, setStartDate] = useState(date ?? '');
  const [endDate,   setEndDate]   = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [done,      setDone]      = useState(false);

  if (done) return <SuccessBanner label="Break" onBack={onBack} />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!startDate) { setError('Please pick a start date.'); return; }
    if (!endDate)   { setError('Please pick an end date.'); return; }
    if (endDate < startDate) { setError('End date must be after start date.'); return; }
    setError(''); setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error: evErr } = await supabase.from('events').insert({
        club_id:    clubId,
        created_by: user.id,
        type:       'vacation',
        title:      label.trim() || 'Break',
        event_date: startDate + 'T00:00:00',
        end_date:   endDate   + 'T00:00:00',
      });
      if (evErr) throw evErr;
      setDone(true);
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Field label="Label (optional)">
        <input
          className="input"
          placeholder="Defaults to 'Break' — e.g. Winter break, International window"
          value={label}
          onChange={e => setLabel(e.target.value)}
        />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Start date">
          <input className="input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </Field>
        <Field label="End date">
          <input className="input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </Field>
      </div>

      <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}>
        <span className="t-small" style={{ color: 'var(--text-tertiary)' }}>
          This will appear as a block on the calendar for the whole squad.
        </span>
      </div>

      {error && <ErrorMsg msg={error} />}
      <SubmitBtn color={color} loading={loading} label="Create break" />
    </form>
  );
}
