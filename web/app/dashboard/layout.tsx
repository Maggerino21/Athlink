import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/auth';
import NotStaffNotice from './NotStaffNotice';
import { accentTokens } from '@/lib/clubTheme';

// Thin layout — just sets accent CSS vars and guards auth.
// Sidebar + tab switching live in DashboardShell (client) to avoid server
// round-trips on every tab click.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await getSessionProfile();
  if (!profile) redirect('/login');

  const clubColor  = profile.clubs?.primary_color ?? '#6366F1';
  const accentVars = accentTokens(clubColor) as React.CSSProperties;

  return (
    // id lets the client rewrite these accent vars in place when the club colour
    // changes, instead of reloading (a reload would reset the active dashboard tab).
    <div id="dashboard-root" className="flex h-full" style={accentVars}>
      <div className="orb-top" />
      <div className="orb-bottom" />
      {profile.role === 'staff'
        ? children
        : <NotStaffNotice fullName={profile.full_name} />}
    </div>
  );
}
