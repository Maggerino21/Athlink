'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

// 'profile' is a real tab but deliberately not in NAV — it is reached by clicking your
// own name at the bottom of the sidebar, where people look for it.
export type DashTab = 'overview' | 'athletes' | 'calendar' | 'feedback' | 'tasks' | 'groups' | 'club' | 'new' | 'profile';

/* ── Inline SVG icons — defined before NAV so Turbopack can resolve them ── */
function GridIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  );
}

function UsersIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}

function CalendarIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}

function ChatIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  );
}

function SignOutIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}

function LayersIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2"/>
      <polyline points="2 17 12 22 22 17"/>
      <polyline points="2 12 12 17 22 12"/>
    </svg>
  );
}

function ShieldIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}

function PlusIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}

/* ── Nav items ────────────────────────────────────────────────────── */
const NAV: { tab: DashTab; label: string; icon: React.FC<{ size?: number }>; highlight?: boolean }[] = [
  { tab: 'overview',  label: 'Overview',   icon: GridIcon },
  { tab: 'athletes',  label: 'Athletes',   icon: UsersIcon },
  { tab: 'calendar',  label: 'Calendar',   icon: CalendarIcon },
  { tab: 'feedback',  label: 'Feedback',   icon: ChatIcon },
  { tab: 'tasks',     label: 'Tasks',      icon: CheckIcon },
  { tab: 'groups',    label: 'Groups',     icon: LayersIcon },
  { tab: 'club',      label: 'Club',       icon: ShieldIcon },
  { tab: 'new',       label: 'New event',  icon: PlusIcon, highlight: true },
];

function getInitials(name: string) {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function Sidebar({
  staffName,
  clubName,
  clubColor,
  activeTab,
  onTabChange,
}: {
  staffName:    string;
  clubName:     string;
  clubColor:    string;
  activeTab:    DashTab;
  onTabChange:  (tab: DashTab) => void;
}) {
  const supabase = createClient();

  // The sign-out control is a small unlabelled icon sitting next to the profile, so it is
  // easy to hit by accident. Confirm before dropping the session.
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut,     setSigningOut]     = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    window.location.replace('/login');
  };

  return (
    <aside
      className="glass-strong flex flex-col w-[220px] shrink-0 h-full relative z-20"
      style={{ borderRight: '1px solid var(--border-default)', borderTop: 'none', borderBottom: 'none', borderLeft: 'none', borderRadius: 0 }}
    >
      {/* Club header */}
      <div style={{ padding: '24px 16px 20px', borderBottom: '1px solid var(--border-default)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--accent-subtle)',
            border: '1px solid var(--accent-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700,
            color: clubColor,
            flexShrink: 0,
          }}>
            {clubName[0]?.toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="t-body-medium" style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {clubName}
            </div>
            <div className="t-label" style={{ marginTop: 2 }}>Staff dashboard</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.map(({ tab, label, icon: Icon, highlight }) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`nav-item${activeTab === tab ? ' active' : ''}`}
            style={{
              width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
              marginTop: highlight ? 8 : 0,
              ...(highlight && activeTab !== tab ? {
                background:  'var(--accent-subtle)',
                border:      '1px solid var(--accent-border)',
                color:       'var(--accent)',
              } : {}),
            }}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>

      {/* Staff profile + sign out */}
      <div style={{ padding: '14px 10px', borderTop: '1px solid var(--border-default)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* The whole name/avatar block opens your profile — a name is the one thing
              everyone tries to click, so it has to lead somewhere. */}
          <button
            onClick={() => onTabChange('profile')}
            title="Your profile"
            className={`nav-item${activeTab === 'profile' ? ' active' : ''}`}
            style={{
              flex: 1, minWidth: 0, gap: 10, padding: '6px 6px',
              textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <div style={{
              width: 30, height: 30,
              borderRadius: 'var(--radius-full)',
              background: 'var(--surface-2)',
              border: '1px solid var(--border-default)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700,
              color: 'var(--text-secondary)',
              flexShrink: 0,
            }}>
              {getInitials(staffName)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="t-small" style={{ fontWeight: 600, color: 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {staffName}
              </div>
              <div className="t-label" style={{ marginTop: 1 }}>Staff</div>
            </div>
          </button>
          <button
            onClick={() => setConfirmSignOut(true)}
            title="Sign out"
            className="btn-ghost"
            style={{ width: 28, height: 28, padding: 0, flexShrink: 0 }}
          >
            <SignOutIcon size={14} />
          </button>
        </div>
      </div>

      {confirmSignOut && (
        <SignOutDialog
          busy={signingOut}
          onCancel={() => setConfirmSignOut(false)}
          onConfirm={signOut}
        />
      )}
    </aside>
  );
}

/* ── Sign out confirmation ────────────────────────────────────────── */
function SignOutDialog({ busy, onCancel, onConfirm }: {
  busy:      boolean;
  onCancel:  () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      onMouseDown={e => { if (e.target === e.currentTarget) onCancel(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div style={{
        width: 380, borderRadius: 'var(--radius-xl)',
        background: 'var(--bg-base)', border: '1px solid var(--border-default)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)', padding: 24,
      }}>
        <div className="t-subheading" style={{ color: 'var(--text-primary)', marginBottom: 10 }}>
          Sign out?
        </div>
        <div className="t-small" style={{ color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 22 }}>
          You&rsquo;ll need your email and password to get back in.
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {/* Focus the safe option: the whole point of this dialog is catching a
              mis-click, so Enter should keep you signed in. */}
          <button onClick={onCancel} className="btn-ghost" autoFocus>Stay signed in</button>
          <button onClick={onConfirm} disabled={busy} className="btn-primary">
            {busy ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </div>
    </div>
  );
}
