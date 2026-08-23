import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/auth';
import DashboardShell from './DashboardShell';

export default async function DashboardPage() {
  const profile = await getSessionProfile();
  if (!profile?.club_id) redirect('/login');

  return (
    <DashboardShell
      staffName={profile.full_name}
      staffEmail={profile.email}
      staffRole={profile.role}
      staffLanguage={profile.language ?? 'en'}
      staffJoinedAt={profile.created_at}
      clubName={profile.clubs?.name ?? 'Your Club'}
      clubColor={profile.clubs?.primary_color ?? '#6366F1'}
      inviteCode={profile.clubs?.invite_code ?? null}
      staffInviteCode={profile.clubs?.staff_invite_code ?? null}
      isClubManager={profile.is_club_manager}
      externalTeamId={profile.clubs?.external_team_id ?? null}
      externalSyncedAt={profile.clubs?.external_synced_at ?? null}
      staffId={profile.id}
      clubId={profile.club_id}
    />
  );
}
