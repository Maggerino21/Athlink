/**
 * The match a new piece of feedback is about, for the staff mobile forms.
 *
 * Feedback must name a match: the staff policy on `match_feedback` only admits
 * a row whose match is in the caller's club. Neither form set one, so every
 * insert was refused by RLS — feedback could not be sent from mobile at all.
 *
 * The mobile forms have no picker (the web one does), so they take the most
 * recent match that has kicked off — almost always the one being talked
 * about — or, before a club's first match, the next one. The form shows which,
 * so a coach is never surprised by where it landed.
 */
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface FeedbackMatch { id: string; label: string }

export function useFeedbackMatch(visible: boolean, clubId: string | null | undefined) {
  const [match, setMatch] = useState<FeedbackMatch | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!visible || !clubId) return;
    let cancelled = false;
    setLoaded(false);
    (async () => {
      const now = new Date().toISOString();
      const base = () => supabase
        .from('matches')
        .select('id, opponent, match_date, is_home')
        .eq('club_id', clubId)
        // Removed fixtures are suppressed, not deleted — see CLAUDE.md.
        .is('suppressed_at', null);

      let { data } = await base().lte('match_date', now)
        .order('match_date', { ascending: false }).limit(1).maybeSingle();
      if (!data) {
        ({ data } = await base().gt('match_date', now)
          .order('match_date', { ascending: true }).limit(1).maybeSingle());
      }
      if (cancelled) return;
      setMatch(data ? {
        id: data.id,
        label: `${data.is_home === false ? 'Away vs' : 'vs'} ${data.opponent} · ${
          new Date(data.match_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
        }`,
      } : null);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [visible, clubId]);

  return { match, loaded };
}

/** What the form says when there is nothing to attach feedback to. */
export const NO_MATCH_MESSAGE = 'Feedback is given on a match, and there are no matches in the calendar yet.';
