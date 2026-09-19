/**
 * useFineBox — everything the fine box shows, for the signed-in player.
 *
 * Reads straight from the `fine_*` tables; RLS already limits every row to the
 * caller's club and hides the whole box from staff, so nothing here filters by
 * role. Writes other than reactions go through the SECURITY DEFINER functions
 * in `supabase/fine_box.sql` (give_fine, record_fine_payment, …).
 *
 * The numbers:
 * - **In the box** = payments in the open season.
 * - **You owe** = your fines − your payments across ALL seasons, so a reset
 *   never wipes a debt.
 * - **You have paid** = your payments in the open season.
 * - **Leaderboard** = fines this season per player, in kr.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { readCache, writeCache } from '../../utils/cache';
import { matteAccent, type MatteAccent } from '../../utils/theme';

export const REACTIONS = ['😂', '💀', '🔥', '👏', '🤡'] as const;

/**
 * Hues a fine type can take when the bøtesjef has not picked one. Spread round
 * the wheel so neighbours differ; run through `matteAccent` so they sit in the
 * same clay family as Schedule's event colours.
 */
const FINE_HUES = ['#E5484D', '#F76B15', '#FFB224', '#46A758', '#12A594', '#0090FF', '#6E56CF', '#D6409F'];

/**
 * A fine type's colour: the one stored on the rule, or failing that one derived
 * from its id — stable across sessions and devices, so "Red card" is the same
 * colour for the whole squad before anyone chooses.
 */
export function fineAccent(id: string, color: string | null): MatteAccent {
  if (color) return matteAccent(color);
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return matteAccent(FINE_HUES[h % FINE_HUES.length]);
}
export type Reaction = (typeof REACTIONS)[number];

/**
 * Something outside the Fines tab changed the box — a fine given from the
 * sheet, for instance. The sheet is a separate route, so it cannot reach the
 * tab's state directly; every mounted useFineBox listens here and reloads.
 */
const listeners = new Set<() => void>();
export function notifyFineBoxChanged() {
  listeners.forEach(fn => fn());
}

/** How many recent fines the feed loads. */
const FEED_LIMIT = 40;

export interface FeedItem {
  id: string;
  who: string;
  what: string;
  amount: number;
  note: string | null;
  createdAt: string;
  counts: Partial<Record<Reaction, number>>;
  mine: Reaction | null;
}

export interface FineBox {
  loaded: boolean;
  /** The club has a bøtesjef at all. Without one nothing gets fined. */
  hasManager: boolean;
  isFineManager: boolean;
  total: number;
  goal: { label: string | null; amount: number } | null;
  owed: number;
  paid: number;
  leaderboard: { id: string; name: string; amount: number }[];
  feed: FeedItem[];
}

const EMPTY: FineBox = {
  loaded: false, hasManager: false, isFineManager: false,
  total: 0, goal: null, owed: 0, paid: 0, leaderboard: [], feed: [],
};

const sum = (rows: { amount: number }[] | null | undefined) =>
  (rows ?? []).reduce((acc, r) => acc + r.amount, 0);

/**
 * A load that failed keeps what is already on screen — usually last session's
 * box, from the cache — instead of replacing it with zeros. It still counts as
 * loaded, so a first load that fails ends the wait rather than spinning.
 */
const keep = (prev: FineBox): FineBox => (prev.loaded ? prev : { ...prev, loaded: true });

export function useFineBox(isActive?: boolean) {
  const { profile } = useAuth();
  // Last session's box, so the tab opens on it instead of waiting.
  const [box, setBox] = useState<FineBox>(
    () => (profile && readCache<FineBox>(profile.id, 'fines')) || EMPTY,
  );

  const load = useCallback(async () => {
    if (!profile) return;
    if (!profile.club_id) {
      setBox({ ...EMPTY, loaded: true });
      return;
    }
    const club = profile.club_id;
    const me = profile.id;

    const [clubRes, seasonRes, membersRes, myFinesRes, myPaysRes] = await Promise.all([
      supabase.from('clubs').select('fine_manager_id').eq('id', club).maybeSingle(),
      supabase.from('fine_seasons').select('id, goal_amount, goal_label')
        .eq('club_id', club).is('ended_at', null).maybeSingle(),
      supabase.from('profiles').select('id, full_name').eq('club_id', club).eq('role', 'athlete'),
      supabase.from('fines').select('amount').eq('athlete_id', me).is('voided_at', null),
      supabase.from('fine_payments').select('amount').eq('athlete_id', me),
    ]);
    if ([clubRes, seasonRes, membersRes, myFinesRes, myPaysRes].some(r => r.error)) {
      setBox(keep);
      return;
    }

    const names = new Map<string, string>(
      (membersRes.data ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name ?? 'Unknown']),
    );
    const manager = (clubRes.data as { fine_manager_id: string | null } | null)?.fine_manager_id ?? null;
    const season = seasonRes.data as { id: string; goal_amount: number | null; goal_label: string | null } | null;
    const owed = Math.max(0, sum(myFinesRes.data) - sum(myPaysRes.data));

    // No open season yet means nothing has happened in this box: no fines, no
    // payments. The first fine or payment opens one.
    if (!season) {
      setBox({ ...EMPTY, loaded: true, hasManager: !!manager, isFineManager: manager === me, owed });
      return;
    }

    const [finesRes, paysRes] = await Promise.all([
      // Reactions ride along on the fines rather than following in a third
      // round trip once the feed's ids are known. That fetches them for the
      // whole season, not just the feed — a few bytes each, against ~130ms.
      supabase.from('fines')
        .select('id, athlete_id, name, amount, note, created_at, fine_reactions(profile_id, emoji)')
        .eq('season_id', season.id).is('voided_at', null)
        .order('created_at', { ascending: false }),
      supabase.from('fine_payments').select('athlete_id, amount').eq('season_id', season.id),
    ]);
    if (finesRes.error || paysRes.error) {
      setBox(keep);
      return;
    }

    type ReactionRow = { profile_id: string; emoji: Reaction };
    type FineRow = {
      id: string; athlete_id: string; name: string; amount: number; note: string | null; created_at: string;
      fine_reactions: ReactionRow[] | null;
    };
    const fines = (finesRes.data ?? []) as FineRow[];
    const pays = (paysRes.data ?? []) as { athlete_id: string; amount: number }[];

    const perPlayer = new Map<string, number>();
    for (const f of fines) perPlayer.set(f.athlete_id, (perPlayer.get(f.athlete_id) ?? 0) + f.amount);
    const leaderboard = [...perPlayer.entries()]
      .map(([id, amount]) => ({ id, name: names.get(id) ?? 'Former player', amount }))
      .sort((a, b) => b.amount - a.amount);

    const feed: FeedItem[] = fines.slice(0, FEED_LIMIT).map(f => {
      const counts: Partial<Record<Reaction, number>> = {};
      let mine: Reaction | null = null;
      for (const r of f.fine_reactions ?? []) {
        counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
        if (r.profile_id === me) mine = r.emoji;
      }
      return {
        id: f.id, who: names.get(f.athlete_id) ?? 'Former player', what: f.name,
        amount: f.amount, note: f.note, createdAt: f.created_at, counts, mine,
      };
    });

    setBox({
      loaded: true,
      hasManager: !!manager,
      isFineManager: manager === me,
      total: sum(pays),
      goal: season.goal_amount ? { label: season.goal_label, amount: season.goal_amount } : null,
      owed,
      paid: sum(pays.filter(p => p.athlete_id === me)),
      leaderboard,
      feed,
    });
  }, [profile?.club_id, profile?.id]);

  // Load on mount even while the tab is hidden: HomeScreen mounts every tab in
  // the background after launch precisely so the first visit finds its data
  // waiting. Gating this on `isActive` skipped that, and Fines opened on "0 kr"
  // for ~400ms. After mount, reload each time the tab comes back into view.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; load(); return; }
    if (isActive) load();
  }, [isActive, load]);

  // Whatever is on screen is what the next launch opens on — reactions
  // included, since those change the box without a reload.
  useEffect(() => {
    if (box.loaded && profile) writeCache(profile.id, 'fines', box);
  }, [box, profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    listeners.add(load);
    return () => { listeners.delete(load); };
  }, [load]);

  /**
   * Tap an emoji: set it, swap to it, or take it back if it was already yours.
   * Optimistic — the feed changes under the finger, then the write catches up;
   * if the write fails the box is reloaded so it never shows a lie for long.
   *
   * `current` is passed in rather than read from state: a setState updater runs
   * later, during render, so a flag set inside one is not there yet when the
   * write below needs to know whether this tap adds or removes.
   */
  const react = useCallback(async (fineId: string, emoji: Reaction, current: Reaction | null) => {
    if (!profile) return;
    const removing = current === emoji;

    setBox(prev => ({
      ...prev,
      feed: prev.feed.map(f => {
        if (f.id !== fineId) return f;
        const counts = { ...f.counts };
        if (current) counts[current] = Math.max(0, (counts[current] ?? 1) - 1);
        if (!removing) counts[emoji] = (counts[emoji] ?? 0) + 1;
        return { ...f, counts, mine: removing ? null : emoji };
      }),
    }));

    const { error } = removing
      ? await supabase.from('fine_reactions').delete().eq('fine_id', fineId).eq('profile_id', profile.id)
      : await supabase.from('fine_reactions').upsert(
          { fine_id: fineId, profile_id: profile.id, emoji },
          { onConflict: 'fine_id,profile_id' },
        );
    if (error) load();
  }, [profile, load]);

  return { box, reload: load, react };
}
