import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

type SessionProfile = {
  id: string;
  /** From auth.users, not profiles — it is the login identity, not a profile field. */
  email: string;
  full_name: string;
  role: string;
  language: string;
  club_id: string | null;
  is_club_manager: boolean;
  created_at: string;
  clubs: {
    name: string;
    primary_color: string;
    invite_code: string;
    staff_invite_code: string;
    /** Linked provider team; drives the fixture sync. */
    external_team_id: number | null;
    external_synced_at: string | null;
  } | null;
};

/**
 * Fetches the current user's profile exactly once per request.
 * React `cache()` deduplicates calls across the layout and all pages
 * rendered in the same server request — no extra DB round-trips.
 */
export const getSessionProfile = cache(async (): Promise<SessionProfile | null> => {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, role, language, club_id, is_club_manager, created_at, clubs(name, primary_color, invite_code, staff_invite_code, external_team_id, external_synced_at)')
    .eq('id', user.id)
    .single();

  if (!data) return null;

  return { ...(data as unknown as Omit<SessionProfile, 'email'>), email: user.email ?? '' };
});
