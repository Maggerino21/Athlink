import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/auth';

function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  const r = parseInt(full.substring(0, 2), 16);
  const g = parseInt(full.substring(2, 4), 16);
  const b = parseInt(full.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '99, 102, 241';
  return `${r}, ${g}, ${b}`;
}

// Thin layout — just sets accent CSS vars and guards auth.
// Sidebar + tab switching live in DashboardShell (client) to avoid server
// round-trips on every tab click.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getSessionProfile();
  if (!profile || profile.role !== 'staff') redirect('/login');

  const clubColor = profile.clubs?.primary_color ?? '#6366F1';
  const rgb       = hexToRgb(clubColor);

  const accentVars = {
    '--accent':        clubColor,
    '--accent-subtle': `rgba(${rgb}, 0.12)`,
    '--accent-border': `rgba(${rgb}, 0.28)`,
    '--accent-glow':   `rgba(${rgb}, 0.18)`,
  } as React.CSSProperties;

  return (
    <div className="flex h-full" style={accentVars}>
      <div className="orb-top" />
      <div className="orb-bottom" />
      {children}
    </div>
  );
}
