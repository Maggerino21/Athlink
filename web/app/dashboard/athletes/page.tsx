import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import AthletesClient from './AthletesClient';

type AthleteRow    = { id: string; full_name: string; language: string | null; avatar_url: string | null; created_at: string };
type TaskRow       = { assigned_to: string; status: string };
type FeedbackRow   = { athlete_id: string; acknowledged: boolean };

export default async function AthletesPage() {
  const profile = await getSessionProfile();
  if (!profile?.club_id) redirect('/login');

  const supabase = await createClient();

  // Kick off athlete fetch + task/feedback fetches in parallel where possible
  const { data: athleteData } = await supabase
    .from('profiles')
    .select('id, full_name, language, avatar_url, created_at')
    .eq('club_id', profile.club_id)
    .eq('role', 'athlete')
    .order('full_name');

  const list = (athleteData as AthleteRow[] | null) ?? [];
  const ids  = list.map((a) => a.id);
  const safeIds = ids.length ? ids : ['none'];

  const [taskRes, feedbackRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('assigned_to, status')
      .in('assigned_to', safeIds)
      .eq('status', 'pending'),
    supabase
      .from('match_feedback')
      .select('athlete_id, acknowledged')
      .in('athlete_id', safeIds),
  ]);

  const taskData     = (taskRes.data as TaskRow[] | null) ?? [];
  const feedbackData = (feedbackRes.data as FeedbackRow[] | null) ?? [];

  const enriched = list.map((a) => ({
    id:              a.id,
    full_name:       a.full_name,
    language:        a.language ?? 'en',
    created_at:      a.created_at,
    pending_tasks:   taskData.filter((t) => t.assigned_to === a.id && t.status === 'pending').length,
    total_tasks:     taskData.filter((t) => t.assigned_to === a.id).length,
    unread_feedback: feedbackData.filter((f) => f.athlete_id === a.id && !f.acknowledged).length,
    total_feedback:  feedbackData.filter((f) => f.athlete_id === a.id).length,
  }));

  return (
    <AthletesClient
      athletes={enriched}
      staffId={profile.id}
      clubId={profile.club_id}
    />
  );
}
