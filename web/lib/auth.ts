import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

type SessionProfile = {
  id: string;
  full_name: string;
  role: string;
  club_id: string | null;
  clubs: { name: string; primary_color: string } | null;
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
    .select('id, full_name, role, club_id, clubs(name, primary_color)')
    .eq('id', user.id)
    .single();

  return (data as SessionProfile | null) ?? null;
});
