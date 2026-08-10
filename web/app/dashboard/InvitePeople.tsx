'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Adding people to a club.
 *
 * Codes are deliberately NOT shown on the dashboard at rest — a bare 6-character string
 * tells a coach nothing about what to do with it. They live behind "Add athletes" /
 * "Add coaches", where the dialog can explain the how and the why alongside the code.
 *
 * "Get a new code" lives inside that same dialog rather than in a settings screen: the
 * moment a coach realises the code went to the wrong person is the moment they are looking
 * at the code.
 */

type Kind = 'athlete' | 'staff';

export default function InvitePeople({
  athleteCode, staffCode, clubName, noAthletesYet,
}: {
  athleteCode:   string;
  staffCode:     string | null;
  clubName:      string;
  noAthletesYet: boolean;
}) {
  const [open,   setOpen]   = useState<Kind | null>(null);
  // Seeded from the server, then kept locally so a regenerated code shows immediately
  // without a full page refresh.
  const [codes,  setCodes]  = useState({ athlete: athleteCode, staff: staffCode });

  useEffect(() => {
    setCodes({ athlete: athleteCode, staff: staffCode });
  }, [athleteCode, staffCode]);

  return (
    <>
      <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
        <button
          onClick={() => setOpen('athlete')}
          className="btn-ghost"
          style={noAthletesYet ? {
            background:  'var(--accent-subtle)',
            borderColor: 'var(--accent-border)',
            color:       'var(--accent)',
            fontWeight:  600,
          } : undefined}
        >
          <PersonPlusIcon />
          Add athletes
        </button>

        {codes.staff && (
          <button onClick={() => setOpen('staff')} className="btn-ghost">
            <PersonPlusIcon />
            Add coaches
          </button>
        )}

        {noAthletesYet && (
          <div className="t-small" style={{
            color: 'var(--text-tertiary)', alignSelf: 'center', marginLeft: 4,
          }}>
            Nobody in your squad yet — start here.
          </div>
        )}
      </div>

      {open && (
        <InviteDialog
          kind={open}
          code={open === 'athlete' ? codes.athlete : (codes.staff ?? '')}
          clubName={clubName}
          onClose={() => setOpen(null)}
          onNewCode={(kind, code) => setCodes(c => ({ ...c, [kind]: code }))}
        />
      )}
    </>
  );
}

/* ── Dialog ───────────────────────────────────────────────────────── */
type View = 'info' | 'confirm' | 'working';

function InviteDialog({ kind, code, clubName, onClose, onNewCode }: {
  kind:      Kind;
  code:      string;
  clubName:  string;
  onClose:   () => void;
  onNewCode: (kind: Kind, code: string) => void;
}) {
  const supabase = createClient();
  const [view,      setView]      = useState<View>('info');
  const [copied,    setCopied]    = useState(false);
  const [justReset, setJustReset] = useState(false);
  const [error,     setError]     = useState('');

  const isStaff = kind === 'staff';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // Clipboard needs a secure context; the code is user-select:all as a fallback.
    }
  }

  async function regenerate() {
    setView('working');
    setError('');
    const { data, error: err } = await supabase.rpc('regenerate_invite_code', { p_kind: kind });
    if (err || !data) {
      setError('Could not get a new code. Please try again.');
      setView('confirm');
      return;
    }
    onNewCode(kind, data as string);
    setJustReset(true);
    setView('info');
  }

  return (
    <div
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div style={{
        width: 520, maxHeight: '88vh', overflowY: 'auto',
        borderRadius: 'var(--radius-xl)',
        background: 'var(--bg-base)',
        border: '1px solid var(--border-default)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          padding: '22px 24px 18px', borderBottom: '1px solid var(--border-default)',
        }}>
          <div>
            <div className="t-subheading" style={{ color: 'var(--text-primary)' }}>
              {isStaff ? 'Add coaches' : 'Add athletes'}
            </div>
            <div className="t-small" style={{ color: 'var(--text-tertiary)', marginTop: 3 }}>
              {clubName}
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ width: 32, height: 32, padding: 0 }}>
            <CloseIcon />
          </button>
        </div>

        {view === 'confirm' ? (
          <ConfirmNewCode
            kind={kind}
            code={code}
            error={error}
            onCancel={() => { setError(''); setView('info'); }}
            onConfirm={regenerate}
          />
        ) : (
          <div style={{ padding: 24 }}>
            {/* Why it matters — coaches only */}
            {isStaff && (
              <div style={{
                padding: '12px 14px', marginBottom: 20,
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-warning-subtle)',
                border: '1px solid var(--color-warning-border)',
              }}>
                <div className="t-small" style={{ color: 'var(--color-warning)', lineHeight: 1.6 }}>
                  Anyone who uses this code becomes a coach. They can send feedback, set tasks,
                  change the calendar and see every athlete. Only share it with people you trust.
                </div>
              </div>
            )}

            {/* How */}
            <div className="t-label" style={{ marginBottom: 12 }}>How it works</div>
            <ol style={{ margin: '0 0 22px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(isStaff
                ? [
                    'Send the code below to your coach.',
                    'They open the Athlink staff site and choose “Join a club”.',
                    'They enter the code when they sign up — that makes them a coach here.',
                  ]
                : [
                    'Send the code below to your players.',
                    'They download the Athlink app and sign up.',
                    'They enter the code when asked — that puts them in your squad.',
                  ]
              ).map((text, i) => (
                <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{
                    flexShrink: 0, width: 22, height: 22, borderRadius: 'var(--radius-full)',
                    background: 'var(--surface-2)', border: '1px solid var(--border-default)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
                  }}>{i + 1}</span>
                  <span className="t-small" style={{ color: 'var(--text-secondary)', lineHeight: 1.6, paddingTop: 2 }}>
                    {text}
                  </span>
                </li>
              ))}
            </ol>

            {/* The code */}
            <div style={{
              borderRadius: 'var(--radius-lg)',
              background: 'var(--surface-1)',
              border: `1px solid ${justReset ? 'var(--color-success-border)' : 'var(--border-default)'}`,
              padding: '18px 20px',
              display: 'flex', alignItems: 'center', gap: 16,
            }}>
              <div>
                <div className="t-label" style={{ marginBottom: 6 }}>
                  {isStaff ? 'Coach code' : 'Athlete code'}
                </div>
                <div
                  title="Select to copy"
                  style={{
                    fontSize: 27, fontWeight: 800,
                    letterSpacing: '0.2em', marginRight: '-0.2em',
                    color: 'var(--text-primary)', userSelect: 'all', cursor: 'text',
                  }}
                >
                  {code}
                </div>
              </div>
              <button
                onClick={copy}
                className="btn-ghost"
                style={{
                  marginLeft: 'auto', flexShrink: 0,
                  background:  copied ? 'var(--color-success-subtle)' : undefined,
                  borderColor: copied ? 'var(--color-success-border)' : undefined,
                  color:       copied ? 'var(--color-success)' : undefined,
                }}
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
                {copied ? 'Copied' : 'Copy code'}
              </button>
            </div>

            {justReset && (
              <div className="t-small" style={{ color: 'var(--color-success)', marginTop: 10 }}>
                Done — this is your new code. The old one no longer works.
              </div>
            )}

            {/* The escape hatch, phrased as the situation rather than the mechanism */}
            <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--border-subtle)' }}>
              <div className="t-small" style={{ color: 'var(--text-tertiary)', marginBottom: 10, lineHeight: 1.6 }}>
                Did this code end up with someone who shouldn&rsquo;t have it?
              </div>
              <button onClick={() => { setJustReset(false); setView('confirm'); }} className="btn-ghost">
                Get a new code
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Confirmation ─────────────────────────────────────────────────── */
// Spells out what this does AND what it does not do. A coach reaching for a new code has
// usually just lost someone from the club and will assume this removes them. It does not.
function ConfirmNewCode({ kind, code, error, onCancel, onConfirm }: {
  kind:      Kind;
  code:      string;
  error:     string;
  onCancel:  () => void;
  onConfirm: () => void;
}) {
  const who = kind === 'staff' ? 'Coaches' : 'Athletes';

  return (
    <div style={{ padding: 24 }}>
      <div className="t-subheading" style={{ color: 'var(--text-primary)', marginBottom: 14 }}>
        Get a new code?
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 22 }}>
        <Point tone="danger">
          The current code <strong>{code}</strong> stops working straight away. Anyone you
          already sent it to will not be able to use it.
        </Point>
        <Point tone="neutral">
          {who} already in {kind === 'staff' ? 'your club' : 'your squad'} are not affected.
          They stay exactly as they are.
        </Point>
        <Point tone="neutral">
          You will need to share the new code with anyone still waiting to join.
        </Point>
      </div>

      <div style={{
        padding: '12px 14px', marginBottom: 20,
        borderRadius: 'var(--radius-md)',
        background: 'var(--surface-1)', border: '1px solid var(--border-default)',
      }}>
        <div className="t-small" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text-primary)' }}>Trying to remove someone?</strong>{' '}
          A new code will not do that. It only stops new people joining —
          {kind === 'staff' ? ' a coach' : ' an athlete'} who has already joined keeps their
          access.
        </div>
      </div>

      {error && (
        <div className="t-small" style={{ color: 'var(--color-danger)', marginBottom: 14 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} className="btn-ghost">Cancel</button>
        <button onClick={onConfirm} className="btn-primary">Get a new code</button>
      </div>
    </div>
  );
}

function Point({ tone, children }: { tone: 'danger' | 'neutral'; children: React.ReactNode }) {
  const color = tone === 'danger' ? 'var(--color-danger)' : 'var(--text-tertiary)';
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span style={{
        flexShrink: 0, width: 5, height: 5, borderRadius: '50%',
        background: color, marginTop: 8,
      }} />
      <span className="t-small" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        {children}
      </span>
    </div>
  );
}

/* ── Icons ────────────────────────────────────────────────────────── */
function PersonPlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="17" y1="11" x2="23" y2="11" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
