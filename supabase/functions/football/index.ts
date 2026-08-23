/**
 * Proxy for the Sportmonks Football API.
 *
 * Exists so the provider key never reaches a client bundle. The browser calls this with its
 * Supabase JWT; the function holds the key and returns only the fields the UI needs, in our
 * own shape — so swapping provider again touches this file and nothing else.
 *
 * Replaces an earlier API-Football implementation. That provider suspended the account with
 * no support recourse, and capped free plans at seasons 2022-2024.
 */

const BASE = 'https://api.sportmonks.com/v3/football';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
  });

async function call(path: string, key: string, params: Record<string, string> = {}) {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set('api_token', key);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), { method: 'GET' });
  const text = await res.text();

  let body: any = null;
  try { body = JSON.parse(text); } catch { /* keep raw below */ }

  if (!res.ok) {
    return {
      ok: false as const,
      status: res.status,
      detail: body?.message ?? text.slice(0, 300),
    };
  }
  return { ok: true as const, data: body };
}

/** Sportmonks returns "2026-08-15 18:00:00" in UTC; normalise to something Date can parse. */
const toIso = (s: string | null | undefined) =>
  s ? s.replace(' ', 'T') + (s.endsWith('Z') ? '' : 'Z') : null;

const ymd = (d: Date) => d.toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const key = Deno.env.get('sportsmonks_api_key');
  if (!key) return json({ error: 'sportsmonks_api_key is not set on this project' }, 500);

  let payload: { action?: string; query?: string; teamId?: number; count?: number };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Expected a JSON body' }, 400);
  }

  /* ── Connectivity / key check ─────────────────────────────────── */
  if (payload.action === 'ping') {
    const r = await call('/leagues', key, { per_page: '1' });
    return r.ok
      ? json({ ok: true, sample: r.data?.data?.[0]?.name ?? null, subscription: r.data?.subscription ?? null })
      : json({ ok: false, status: r.status, detail: r.detail }, 502);
  }

  /* ── Find a team by name ──────────────────────────────────────────
   * Sportmonks has no club -> teams hierarchy either: senior, reserve, youth and women's
   * sides are separate records sharing a name. Unlike the previous provider it exposes
   * `gender` and league `sub_type`, which disambiguate far better than name-guessing.
   */
  if (payload.action === 'search') {
    const query = (payload.query ?? '').trim();
    if (query.length < 3) return json({ error: 'Search needs at least 3 characters' }, 400);

    const r = await call(`/teams/search/${encodeURIComponent(query)}`, key, {
      include: 'country',
    });
    if (!r.ok) return json({ error: 'Provider error', status: r.status, detail: r.detail }, 502);

    const teams = (r.data?.data ?? []).map((t: any) => ({
      id: t.id,
      name: t.name,
      country: t.country?.name ?? null,
      founded: t.founded ?? null,
      gender: t.gender ?? null,
      logo: t.image_path ?? null,
    }));

    return json({ teams });
  }

  /* ── Upcoming fixtures for a team ─────────────────────────────────
   * No "next N" endpoint exists; the documented approach is a date range starting today.
   */
  if (payload.action === 'fixtures') {
    const teamId = Number(payload.teamId);
    if (!Number.isFinite(teamId)) return json({ error: 'teamId is required' }, 400);
    const count = Math.min(Math.max(Number(payload.count) || 10, 1), 20);

    const from = new Date();
    const to = new Date(from.getTime() + 365 * 24 * 60 * 60 * 1000);

    const r = await call(`/fixtures/between/${ymd(from)}/${ymd(to)}/${teamId}`, key, {
      include: 'participants;league;venue',
    });
    if (!r.ok) return json({ error: 'Provider error', status: r.status, detail: r.detail }, 502);

    const fixtures = (r.data?.data ?? [])
      .map((f: any) => {
        const parts = f.participants ?? [];
        const us = parts.find((p: any) => p.id === teamId);
        const them = parts.find((p: any) => p.id !== teamId);
        return {
          id: f.id,
          date: toIso(f.starting_at),
          opponent: them?.name ?? 'Unknown',
          isHome: us?.meta?.location === 'home',
          venue: f.venue?.name ?? null,
          league: f.league?.name ?? null,
          status: f.state_id ?? null,
        };
      })
      .filter((f: any) => f.date)
      .sort((a: any, b: any) => a.date.localeCompare(b.date))
      .slice(0, count);

    return json({ fixtures, totalInRange: (r.data?.data ?? []).length });
  }

  return json({ error: `Unknown action: ${payload.action}` }, 400);
});
