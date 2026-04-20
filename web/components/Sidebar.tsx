'use client';

import { createClient } from '@/lib/supabase/client';

export type DashTab = 'overview' | 'athletes' | 'calendar' | 'feedback' | 'tasks';

const NAV: { tab: DashTab; label: string; icon: React.FC<{ size?: number }> }[] = [
  { tab: 'overview',  label: 'Overview', icon: GridIcon },
  { tab: 'athletes',  label: 'Athletes', icon: UsersIcon },
  { tab: 'calendar',  label: 'Calendar', icon: CalendarIcon },
  { tab: 'feedback',  label: 'Feedback', icon: ChatIcon },
  { tab: 'tasks',     label: 'Tasks',    icon: CheckIcon },
];

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

  const signOut = async () => {
    await supabase.auth.signOut();
    // Hard navigation clears the Next.js server component cache so the
    // dashboard layout's auth check runs fresh and redirects to login.
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
          <div
            style={{
              width: 32, height: 32,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--accent-subtle)',
              border: '1px solid var(--accent-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700,
              color: clubColor,
              flexShrink: 0,
            }}
          >
            {clubName[0]?.toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              className="t-body-medium"
              style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {clubName}
            </div>
            <div className="t-label" style={{ marginTop: 2 }}>Staff dashboard</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.map(({ tab, label, icon: Icon }) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`nav-item${activeTab === tab ? ' active' : ''}`}
            style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>

      {/* Staff profile + sign out */}
      <div style={{ padding: '14px 10px', borderTop: '1px solid var(--border-default)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 30, height: 30,
              borderRadius: 'var(--radius-full)',
              background: 'var(--surface-2)',
              border: '1px solid var(--border-default)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700,
              color: 'var(--text-secondary)',
              flexShrink: 0,
            }}
          >
            {getInitials(staffName)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              className="t-small"
              style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {staffName}
            </div>
            <div className="t-label" style={{ marginTop: 1 }}>Coach</div>
          </div>
          <button
            onClick={signOut}
            title="Sign out"
            className="btn-ghost"
            style={{ width: 28, height: 28, padding: 0, flexShrink: 0 }}
          >
            <SignOutIcon size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/* ── Inline SVG icons ────────────────────────────────────────────── */
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
