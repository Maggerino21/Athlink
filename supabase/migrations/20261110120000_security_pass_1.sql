-- Security pass 1 — database fixes from the Athlink Security Plan, section 1.
-- Audited against the live database on 2026-11-10. NOT YET APPLIED.
--
-- ORDER MATTERS: deploy the web change that reads the staff code through
-- my_staff_invite_code() BEFORE applying this. Step 3 removes SELECT on
-- clubs.staff_invite_code, and the old dashboard query names that column —
-- PostgREST would reject the whole profile read and every staff member
-- would be bounced to /login.
--
-- After applying: re-run the security advisor.

BEGIN;

-- ════════════════════════════════════════════════════════════════════════
-- 1. Legacy RPCs nobody calls any more — and one of them hands out manager.
--
--    join_club_by_code(code) moves the CALLER into whichever club owns the
--    athlete code, without touching their role or manager flag. So:
--      a) sign up creating a throwaway club  → staff + manager of it
--      b) call join_club_by_code(<any club's athlete code>)
--      → staff AND club manager of the victim club.
--    Every athlete knows their club's athlete code. Worse, anon could call it
--    too, and it returns the club name for a valid code with no rate limit —
--    a free oracle for guessing codes.
--
--    create_club_for_user lets any signed-in user leave their club for a new
--    one with no staff code. get_my_* are superseded by user_club_id() /
--    user_role(), which also honour removed_at; no policy or client uses them.
--
--    Revoked rather than dropped so this is trivially reversible. Drop them
--    in a later migration once nothing has complained.
-- ════════════════════════════════════════════════════════════════════════
REVOKE ALL ON FUNCTION public.join_club_by_code(text)    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_club_for_user(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_my_club_id()           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_my_role()              FROM PUBLIC, anon, authenticated;

-- Trigger function: only ever run by the trigger on auth.users.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════
-- 2. Nothing SECURITY DEFINER is callable signed out.
--    Each body was read: all of these check the caller themselves (role,
--    bøtesjef, own rows). Signed-in access stays as it is.
-- ════════════════════════════════════════════════════════════════════════
REVOKE EXECUTE ON FUNCTION public.user_club_id()            FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_role()               FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_is_club_manager()    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_fine_manager()         FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_fine_manager(uuid)    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.give_fine(uuid, uuid[], text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.void_fine(uuid)           FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_fine_payment(uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_fine_goal(integer, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reset_fine_season()       FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.visible_events_for_me(timestamptz, timestamptz) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.user_club_id()            TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_role()               TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_club_manager()    TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_fine_manager()         TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_fine_manager(uuid)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.give_fine(uuid, uuid[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_fine(uuid)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_fine_payment(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_fine_goal(integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_fine_season()       TO authenticated;
GRANT EXECUTE ON FUNCTION public.visible_events_for_me(timestamptz, timestamptz) TO authenticated;

-- The fine-box policies were created TO public, so a signed-out request
-- would now hit "permission denied for function user_club_id" instead of an
-- empty result. Scope them to signed-in users like every other policy.
ALTER POLICY "Bøtesjef creates rules"      ON public.fine_rules     TO authenticated;
ALTER POLICY "Bøtesjef edits rules"        ON public.fine_rules     TO authenticated;
ALTER POLICY "Players read their fine box" ON public.fine_rules     TO authenticated;
ALTER POLICY "Players read their fine box" ON public.fine_seasons   TO authenticated;
ALTER POLICY "Players read their fine box" ON public.fines          TO authenticated;
ALTER POLICY "Players read their fine box" ON public.fine_payments  TO authenticated;
ALTER POLICY "Players react"               ON public.fine_reactions TO authenticated;
ALTER POLICY "Players change their reaction" ON public.fine_reactions TO authenticated;
ALTER POLICY "Players read reactions"      ON public.fine_reactions TO authenticated;
ALTER POLICY "Players remove their reaction" ON public.fine_reactions TO authenticated;

-- New functions stop being callable signed out by default. Signed-in users
-- still get EXECUTE through Supabase's schema default, so a new RPC works
-- for the app without an extra GRANT.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;


-- ════════════════════════════════════════════════════════════════════════
-- 3. Athletes could read their club's staff code.
--    "Club members can read their club" returns the whole row, and RLS
--    cannot hide a column — so any athlete could
--      select staff_invite_code from clubs
--    and sign up a second account as staff. Column grants are the fix, as on
--    profiles. Every column EXCEPT staff_invite_code is listed.
--
--    A new column on clubs is now unreadable until added here — the same
--    protected-by-default rule profiles already has for UPDATE.
-- ════════════════════════════════════════════════════════════════════════
REVOKE SELECT ON public.clubs FROM anon, authenticated;
GRANT SELECT (
  id, name, created_at, sport, primary_color, invite_code, fine_manager_id,
  external_provider, external_team_id, external_team_name,
  external_badge_url, external_synced_at
) ON public.clubs TO authenticated;

CREATE OR REPLACE FUNCTION public.my_staff_invite_code()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT c.staff_invite_code
  FROM public.clubs c
  JOIN public.profiles p ON p.club_id = c.id
  WHERE p.id = auth.uid() AND p.role = 'staff' AND p.removed_at IS NULL
$$;
REVOKE ALL ON FUNCTION public.my_staff_invite_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_staff_invite_code() TO authenticated;


-- ════════════════════════════════════════════════════════════════════════
-- 4. Signed-in users can INSERT a profile with any role.
--    "Users can insert own profile" + an all-columns INSERT grant means a
--    user without a profile row could write role='staff', any club_id,
--    is_club_manager=true. Latent today (0 users lack a profile — the
--    signup trigger always writes one), but one failed trigger away from
--    real. Profiles are created only by handle_new_user; nothing in either
--    app inserts or deletes them.
-- ════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
REVOKE INSERT, DELETE ON public.profiles FROM anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════
-- 5. Fixed search_path on the access helpers (advisor lint 0011).
--    Bodies already qualify everything (public.profiles, auth.uid(), now()).
-- ════════════════════════════════════════════════════════════════════════
ALTER FUNCTION public.user_club_id()         SET search_path = '';
ALTER FUNCTION public.user_role()            SET search_path = '';
ALTER FUNCTION public.user_is_club_manager() SET search_path = '';
ALTER FUNCTION public.fine_today()           SET search_path = '';


-- ════════════════════════════════════════════════════════════════════════
-- 6. Event PDFs were readable and writable across clubs.
--    Both policies checked only bucket_id, so any signed-in user — athlete,
--    any club — could upload into any club's folder and read every club's
--    files. Paths are {club_id}/{timestamp}_{filename} (NewEventTab), and the
--    one existing object follows it.
-- ════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Club staff can upload PDFs"  ON storage.objects;
DROP POLICY IF EXISTS "Club members can read PDFs" ON storage.objects;

CREATE POLICY "Club staff can upload PDFs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'event-pdfs'
    AND (storage.foldername(name))[1] = public.user_club_id()::text
    AND public.user_role() = 'staff'
  );

CREATE POLICY "Club members can read PDFs"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'event-pdfs'
    AND (storage.foldername(name))[1] = public.user_club_id()::text
  );

COMMIT;
