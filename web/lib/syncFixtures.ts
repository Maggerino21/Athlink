'use client';

import { createClient } from './supabase/client';

/**
 * Pulls the linked team's fixtures from the provider and writes them into `matches`.
 *
 * Split in two deliberately: the edge function holds the provider key and returns fixtures,
 * then a SECURITY DEFINER RPC does the writing so the club is taken from the caller's own
 * profile rather than the request. The RPC upserts on (club_id, external_id), so re-running
 * this is safe and never disturbs matches a coach entered by hand.
 */
export async function syncFixtures(teamId: number, count = 20): Promise<
  { ok: true; synced: number } | { ok: false; error: string }
> {
  const supabase = createClient();

  const { data, error } = await supabase.functions.invoke('football', {
    body: { action: 'fixtures', teamId, count },
  });
  if (error) return { ok: false, error: 'Could not reach the fixture service.' };

  const fixtures = data?.fixtures;
  if (!Array.isArray(fixtures)) return { ok: false, error: 'Unexpected response from the fixture service.' };
  if (fixtures.length === 0) return { ok: true, synced: 0 };

  const { data: synced, error: rpcError } = await supabase.rpc('sync_external_fixtures', {
    p_fixtures: fixtures,
  });
  if (rpcError) return { ok: false, error: rpcError.message };

  return { ok: true, synced: Number(synced) || 0 };
}

/** Long enough that switching tabs doesn't re-hit the provider; short enough to catch a
 *  postponement the same day. */
const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

export function isSyncStale(lastSyncedAt: string | null): boolean {
  if (!lastSyncedAt) return true;
  const t = Date.parse(lastSyncedAt);
  return Number.isNaN(t) || Date.now() - t > STALE_AFTER_MS;
}
