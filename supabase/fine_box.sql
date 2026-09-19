-- ════════════════════════════════════════════════════════════════════════════
-- Fine box (bøtekasse) — v1 schema
--
-- Players only. Staff choose the bøtesjef and otherwise have no access: every
-- read policy below requires user_role() = 'athlete', so a staff session sees
-- nothing, and every write goes through a SECURITY DEFINER function that checks
-- the caller is the club's current bøtesjef.
--
-- Money is whole kroner. "You owe" is computed across ALL seasons (fines minus
-- payments), so debts carry over a reset without any copying.
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1. The bøtesjef ──────────────────────────────────────────────────────────
-- One per club, so it lives on the club rather than as a flag on profiles:
-- "two bøtesjefs at once" is then unrepresentable.

ALTER TABLE public.clubs
  ADD COLUMN fine_manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- `authenticated` currently holds UPDATE on the WHOLE clubs table, and club
-- managers may update their club row — so without this a manager could write
-- fine_manager_id directly, skipping the checks in set_fine_manager (e.g. make a
-- staff member or someone from another club the bøtesjef).
--
-- A column-level REVOKE has no effect while a table-level grant exists, so the
-- table grant is replaced with the only columns the web app writes directly
-- (ClubTab: name + primary_color). Everything else on clubs is already written
-- by SECURITY DEFINER functions, which this does not affect. As a side effect
-- this also stops managers editing invite codes or the provider link directly.
REVOKE UPDATE ON public.clubs FROM authenticated;
GRANT UPDATE (name, primary_color) ON public.clubs TO authenticated;


-- ── 2. Tables ────────────────────────────────────────────────────────────────

-- A season is the time between two resets. Exactly one is open per club.
CREATE TABLE public.fine_seasons (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id      uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  started_at   timestamptz NOT NULL DEFAULT now(),
  ended_at     timestamptz,
  goal_amount  integer CHECK (goal_amount > 0),
  goal_label   text,
  -- Saved at reset: { total, botekonge: [...], cheapskate: [...] }
  recap        jsonb
);
CREATE UNIQUE INDEX fine_seasons_one_open ON public.fine_seasons (club_id) WHERE ended_at IS NULL;

-- The club's fine list. One table for all three kinds; unused columns stay null,
-- and the shape check keeps each kind honest.
CREATE TABLE public.fine_rules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id       uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name          text NOT NULL CHECK (length(btrim(name)) > 0),
  amount        integer NOT NULL CHECK (amount > 0),
  kind          text NOT NULL CHECK (kind IN ('manual', 'recurring', 'automatic')),
  -- recurring
  starts_on     date,
  repeat_every  text CHECK (repeat_every IN ('week', 'month', 'season')),
  -- automatic
  condition     text CHECK (condition IN ('clean_sheet', 'milestone')),
  period        text CHECK (period IN ('week', 'month')),   -- clean_sheet
  threshold     integer CHECK (threshold > 0),              -- milestone
  active        boolean NOT NULL DEFAULT true,
  created_by    uuid REFERENCES public.profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fine_rules_shape CHECK (
       (kind = 'manual'    AND starts_on IS NULL AND repeat_every IS NULL AND condition IS NULL)
    OR (kind = 'recurring' AND starts_on IS NOT NULL AND repeat_every IS NOT NULL AND condition IS NULL)
    OR (kind = 'automatic' AND starts_on IS NULL AND repeat_every IS NULL AND (
             (condition = 'clean_sheet' AND period IS NOT NULL AND threshold IS NULL)
          OR (condition = 'milestone'   AND threshold IS NOT NULL AND period IS NULL)))
  )
);

-- One row per fine given. Name and amount are COPIED from the rule, so editing
-- or deactivating a rule never rewrites history.
CREATE TABLE public.fines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  season_id   uuid NOT NULL REFERENCES public.fine_seasons(id),
  rule_id     uuid REFERENCES public.fine_rules(id) ON DELETE SET NULL,
  athlete_id  uuid NOT NULL REFERENCES public.profiles(id),
  name        text NOT NULL,
  amount      integer NOT NULL CHECK (amount > 0),
  note        text,
  issued_by   uuid REFERENCES public.profiles(id),   -- null = charged automatically
  created_at  timestamptz NOT NULL DEFAULT now(),
  voided_at   timestamptz,
  voided_by   uuid REFERENCES public.profiles(id),
  -- Set only on scheduled/automatic fines, so a re-run can never double-charge.
  dedupe_key  text UNIQUE
);
CREATE INDEX fines_club_season ON public.fines (club_id, season_id);
CREATE INDEX fines_athlete     ON public.fines (athlete_id);

-- Money in. `source` and `external_ref` are there for Vipps later, so switching
-- from "bøtesjef marks paid" to automatic payments changes no table.
CREATE TABLE public.fine_payments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id       uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  season_id     uuid NOT NULL REFERENCES public.fine_seasons(id),
  athlete_id    uuid NOT NULL REFERENCES public.profiles(id),
  amount        integer NOT NULL CHECK (amount > 0),
  source        text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'vipps')),
  external_ref  text UNIQUE,
  recorded_by   uuid REFERENCES public.profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fine_payments_club_season ON public.fine_payments (club_id, season_id);
CREATE INDEX fine_payments_athlete     ON public.fine_payments (athlete_id);

-- One reaction per person per fine, from a small fixed set.
CREATE TABLE public.fine_reactions (
  fine_id     uuid NOT NULL REFERENCES public.fines(id) ON DELETE CASCADE,
  profile_id  uuid NOT NULL REFERENCES public.profiles(id),
  emoji       text NOT NULL CHECK (emoji IN ('😂', '💀', '🔥', '👏', '🤡')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (fine_id, profile_id)
);


-- ── 3. Helpers ───────────────────────────────────────────────────────────────

-- Built on user_club_id() / user_role(), so removed members are denied for free.
CREATE OR REPLACE FUNCTION public.is_fine_manager()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clubs
    WHERE id = public.user_club_id()
      AND fine_manager_id = auth.uid()
      AND public.user_role() = 'athlete'
  )
$$;

-- The open season for a club, opening one if none exists yet.
CREATE OR REPLACE FUNCTION public.fine_open_season(p_club_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.fine_seasons WHERE club_id = p_club_id AND ended_at IS NULL;
  IF v_id IS NULL THEN
    INSERT INTO public.fine_seasons (club_id) VALUES (p_club_id) RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.fine_open_season(uuid) FROM PUBLIC, anon, authenticated;

-- "Today" for fines is the Norwegian calendar day, not UTC's.
CREATE OR REPLACE FUNCTION public.fine_today()
RETURNS date LANGUAGE sql STABLE AS $$
  SELECT (now() AT TIME ZONE 'Europe/Oslo')::date
$$;


-- ── 4. Row level security ────────────────────────────────────────────────────
-- Reads: athletes of the club. Writes: none directly, except rules (bøtesjef)
-- and your own reaction. Everything else goes through the functions in §5.

ALTER TABLE public.fine_seasons   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fine_rules     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fines          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fine_payments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fine_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players read their fine box" ON public.fine_seasons
  FOR SELECT USING (club_id = public.user_club_id() AND public.user_role() = 'athlete');
CREATE POLICY "Players read their fine box" ON public.fine_rules
  FOR SELECT USING (club_id = public.user_club_id() AND public.user_role() = 'athlete');
CREATE POLICY "Players read their fine box" ON public.fines
  FOR SELECT USING (club_id = public.user_club_id() AND public.user_role() = 'athlete');
CREATE POLICY "Players read their fine box" ON public.fine_payments
  FOR SELECT USING (club_id = public.user_club_id() AND public.user_role() = 'athlete');
CREATE POLICY "Players read reactions" ON public.fine_reactions
  FOR SELECT USING (
    public.user_role() = 'athlete'
    AND EXISTS (SELECT 1 FROM public.fines f WHERE f.id = fine_id AND f.club_id = public.user_club_id())
  );

-- Rules: the bøtesjef creates and edits (no delete — deactivate instead, so old
-- fines keep a link to the rule they came from).
CREATE POLICY "Bøtesjef creates rules" ON public.fine_rules
  FOR INSERT WITH CHECK (club_id = public.user_club_id() AND public.is_fine_manager());
CREATE POLICY "Bøtesjef edits rules" ON public.fine_rules
  FOR UPDATE USING (club_id = public.user_club_id() AND public.is_fine_manager())
  WITH CHECK (club_id = public.user_club_id() AND public.is_fine_manager());

-- Reactions: your own, on fines in your club.
CREATE POLICY "Players react" ON public.fine_reactions
  FOR INSERT WITH CHECK (
    profile_id = auth.uid() AND public.user_role() = 'athlete'
    AND EXISTS (SELECT 1 FROM public.fines f WHERE f.id = fine_id AND f.club_id = public.user_club_id())
  );
CREATE POLICY "Players change their reaction" ON public.fine_reactions
  FOR UPDATE USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());
CREATE POLICY "Players remove their reaction" ON public.fine_reactions
  FOR DELETE USING (profile_id = auth.uid());


-- ── 5. Actions ───────────────────────────────────────────────────────────────

-- Staff (one-time setup) or the current bøtesjef (handing over).
CREATE OR REPLACE FUNCTION public.set_fine_manager(p_profile_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_club    uuid := public.user_club_id();
  v_role    text := public.user_role();
  v_current uuid;
BEGIN
  SELECT fine_manager_id INTO v_current FROM public.clubs WHERE id = v_club;

  IF v_club IS NULL OR NOT (v_role = 'staff' OR v_current = auth.uid()) THEN
    RAISE EXCEPTION 'Only staff or the current bøtesjef can choose the bøtesjef';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_profile_id AND club_id = v_club AND role = 'athlete' AND removed_at IS NULL
  ) THEN
    RAISE EXCEPTION 'The bøtesjef has to be a player in your club';
  END IF;

  UPDATE public.clubs SET fine_manager_id = p_profile_id WHERE id = v_club;
END $$;

-- Give one fine to one or more players. Three taps: fine → players → done.
CREATE OR REPLACE FUNCTION public.give_fine(p_rule_id uuid, p_athlete_ids uuid[], p_note text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_club   uuid := public.user_club_id();
  v_rule   public.fine_rules%ROWTYPE;
  v_season uuid;
  v_count  integer;
BEGIN
  IF NOT public.is_fine_manager() THEN
    RAISE EXCEPTION 'Only the bøtesjef can give fines';
  END IF;

  SELECT * INTO v_rule FROM public.fine_rules
  WHERE id = p_rule_id AND club_id = v_club AND active AND kind = 'manual';
  IF NOT FOUND THEN RAISE EXCEPTION 'That fine does not exist'; END IF;

  IF coalesce(array_length(p_athlete_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Pick at least one player';
  END IF;

  v_season := public.fine_open_season(v_club);

  INSERT INTO public.fines (club_id, season_id, rule_id, athlete_id, name, amount, note, issued_by)
  SELECT v_club, v_season, v_rule.id, p.id, v_rule.name, v_rule.amount, nullif(btrim(p_note), ''), auth.uid()
  FROM public.profiles p
  WHERE p.id = ANY (p_athlete_ids) AND p.club_id = v_club AND p.role = 'athlete' AND p.removed_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Milestones fire straight away rather than waiting for the nightly job.
  PERFORM public.apply_milestone_fines(v_club);
  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION public.void_fine(p_fine_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_fine_manager() THEN
    RAISE EXCEPTION 'Only the bøtesjef can remove fines';
  END IF;
  UPDATE public.fines SET voided_at = now(), voided_by = auth.uid()
  WHERE id = p_fine_id AND club_id = public.user_club_id() AND voided_at IS NULL;
END $$;

-- Temporary: the bøtesjef records money received. Vipps will write the same
-- table with source = 'vipps'.
CREATE OR REPLACE FUNCTION public.record_fine_payment(p_athlete_id uuid, p_amount integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_club uuid := public.user_club_id();
BEGIN
  IF NOT public.is_fine_manager() THEN
    RAISE EXCEPTION 'Only the bøtesjef can record payments';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'The amount has to be more than 0';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_athlete_id AND club_id = v_club AND role = 'athlete') THEN
    RAISE EXCEPTION 'That player is not in your club';
  END IF;

  INSERT INTO public.fine_payments (club_id, season_id, athlete_id, amount, recorded_by)
  VALUES (v_club, public.fine_open_season(v_club), p_athlete_id, p_amount, auth.uid());
END $$;

CREATE OR REPLACE FUNCTION public.set_fine_goal(p_amount integer, p_label text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_club uuid := public.user_club_id();
BEGIN
  IF NOT public.is_fine_manager() THEN
    RAISE EXCEPTION 'Only the bøtesjef can set the goal';
  END IF;
  UPDATE public.fine_seasons
  SET goal_amount = CASE WHEN p_amount > 0 THEN p_amount END,
      goal_label  = nullif(btrim(p_label), '')
  WHERE id = public.fine_open_season(v_club);
END $$;

-- Reset: save the recap, close the season, open a new one. Debts carry over on
-- their own because "you owe" spans all seasons.
CREATE OR REPLACE FUNCTION public.reset_fine_season()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_club   uuid := public.user_club_id();
  v_season uuid;
  v_recap  jsonb;
BEGIN
  IF NOT public.is_fine_manager() THEN
    RAISE EXCEPTION 'Only the bøtesjef can reset the fine box';
  END IF;
  v_season := public.fine_open_season(v_club);

  WITH totals AS (
    -- Every player still in the club, including those with nothing — the
    -- cheapskate is usually someone on 0.
    SELECT p.id, p.full_name,
           coalesce(sum(f.amount) FILTER (WHERE f.voided_at IS NULL), 0)::int AS amount
    FROM public.profiles p
    LEFT JOIN public.fines f ON f.athlete_id = p.id AND f.season_id = v_season
    WHERE p.club_id = v_club AND p.role = 'athlete' AND p.removed_at IS NULL
    GROUP BY p.id, p.full_name
  )
  SELECT jsonb_build_object(
    'total', (SELECT coalesce(sum(amount), 0) FROM public.fine_payments WHERE season_id = v_season),
    -- Ties share the title.
    'botekonge', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', full_name, 'amount', amount)), '[]')
                  FROM totals WHERE amount > 0 AND amount = (SELECT max(amount) FROM totals)),
    'cheapskate', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', full_name, 'amount', amount)), '[]')
                   FROM totals WHERE amount = (SELECT min(amount) FROM totals))
  ) INTO v_recap;

  UPDATE public.fine_seasons SET ended_at = now(), recap = v_recap WHERE id = v_season;
  PERFORM public.fine_open_season(v_club);
  RETURN v_recap;
END $$;


-- ── 6. Scheduled fines ───────────────────────────────────────────────────────

-- Milestones: once per season per rule per player. Counts only fines the
-- bøtesjef GAVE (issued_by set), like clean sheets: recurring fees would
-- otherwise push everyone over at once, and automatic fines — including this
-- rule's own — have issued_by = NULL, so it cannot feed itself.
CREATE OR REPLACE FUNCTION public.apply_milestone_fines(p_club_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_season uuid := public.fine_open_season(p_club_id);
BEGIN
  INSERT INTO public.fines (club_id, season_id, rule_id, athlete_id, name, amount, dedupe_key)
  SELECT p_club_id, v_season, r.id, t.athlete_id, r.name, r.amount,
         'milestone:' || r.id || ':' || t.athlete_id || ':' || v_season
  FROM public.fine_rules r
  JOIN LATERAL (
    SELECT f.athlete_id, sum(f.amount) AS total
    FROM public.fines f
    JOIN public.profiles p ON p.id = f.athlete_id AND p.removed_at IS NULL
    WHERE f.season_id = v_season AND f.voided_at IS NULL AND f.issued_by IS NOT NULL
    GROUP BY f.athlete_id
  ) t ON t.total >= r.threshold
  WHERE r.club_id = p_club_id AND r.active AND r.kind = 'automatic' AND r.condition = 'milestone'
  ON CONFLICT (dedupe_key) DO NOTHING;
END $$;
REVOKE EXECUTE ON FUNCTION public.apply_milestone_fines(uuid) FROM PUBLIC, anon, authenticated;

-- Nightly. Charges only the CURRENT period of each recurring rule (no backfill),
-- and only players who were already members when that period began.
CREATE OR REPLACE FUNCTION public.run_scheduled_fines()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_today  date := public.fine_today();
  v_club   uuid;
  v_season uuid;
  r        public.fine_rules%ROWTYPE;
  v_start  date;   -- start of the period being charged / checked
  v_end    date;
BEGIN
  FOR v_club IN SELECT id FROM public.clubs WHERE fine_manager_id IS NOT NULL LOOP
    v_season := public.fine_open_season(v_club);

    FOR r IN SELECT * FROM public.fine_rules WHERE club_id = v_club AND active AND kind <> 'manual' LOOP

      -- Recurring: every week / month from starts_on, or once per season.
      IF r.kind = 'recurring' AND r.starts_on <= v_today THEN
        v_start := CASE r.repeat_every
          WHEN 'week'  THEN r.starts_on + (((v_today - r.starts_on) / 7) * 7)
          WHEN 'month' THEN (r.starts_on + make_interval(months =>
                              (extract(year FROM age(v_today, r.starts_on)) * 12
                             + extract(month FROM age(v_today, r.starts_on)))::int))::date
          ELSE NULL
        END;

        INSERT INTO public.fines (club_id, season_id, rule_id, athlete_id, name, amount, dedupe_key)
        SELECT v_club, v_season, r.id, p.id, r.name, r.amount,
               'recurring:' || r.id || ':' || p.id || ':' || coalesce(v_start::text, v_season::text)
        FROM public.profiles p
        WHERE p.club_id = v_club AND p.role = 'athlete' AND p.removed_at IS NULL
          AND (v_start IS NULL OR (p.created_at AT TIME ZONE 'Europe/Oslo')::date <= v_start)
        ON CONFLICT (dedupe_key) DO NOTHING;
      END IF;

      -- Clean sheet: checked the day after a calendar week (Mon–Sun) or month ends.
      IF r.kind = 'automatic' AND r.condition = 'clean_sheet' THEN
        IF r.period = 'week' AND extract(isodow FROM v_today) = 1 THEN
          v_start := v_today - 7;  v_end := v_today - 1;
        ELSIF r.period = 'month' AND extract(day FROM v_today) = 1 THEN
          v_start := (v_today - interval '1 month')::date;  v_end := v_today - 1;
        ELSE
          CONTINUE;
        END IF;

        INSERT INTO public.fines (club_id, season_id, rule_id, athlete_id, name, amount, dedupe_key)
        SELECT v_club, v_season, r.id, p.id, r.name, r.amount,
               'clean_sheet:' || r.id || ':' || p.id || ':' || v_start
        FROM public.profiles p
        WHERE p.club_id = v_club AND p.role = 'athlete' AND p.removed_at IS NULL
          AND (p.created_at AT TIME ZONE 'Europe/Oslo')::date <= v_start
          -- Only fines the bøtesjef GAVE count. Recurring fees land on everyone,
          -- so counting them would mean nobody ever keeps a clean sheet.
          AND NOT EXISTS (
            SELECT 1 FROM public.fines f
            WHERE f.athlete_id = p.id AND f.voided_at IS NULL
              AND f.issued_by IS NOT NULL
              AND (f.created_at AT TIME ZONE 'Europe/Oslo')::date BETWEEN v_start AND v_end
          )
        ON CONFLICT (dedupe_key) DO NOTHING;
      END IF;
    END LOOP;

    PERFORM public.apply_milestone_fines(v_club);
  END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public.run_scheduled_fines() FROM PUBLIC, anon, authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron;
-- 00:15 UTC = 01:15 or 02:15 in Oslo, safely after midnight in both.
SELECT cron.schedule('fine-box-nightly', '15 0 * * *', $$SELECT public.run_scheduled_fines()$$);
