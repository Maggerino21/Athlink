import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/auth';
import DashboardShell from './DashboardShell';

export default async function DashboardPage() {
  const profile = await getSessionProfile();
  if (!profile?.club_id) redirect('/login');

  return (
    <DashboardShell
      staffName={profile.full_name}
      clubName={profile.clubs?.name ?? 'Your Club'}
      clubColor={profile.clubs?.primary_color ?? '#6366F1'}
      staffId={profile.id}
      clubId={profile.club_id}
    />
  );
}
