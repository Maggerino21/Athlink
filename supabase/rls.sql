-- ══════════════════════════════════════════════════════════════════════
-- Athlink — Row Level Security
-- Run this in the Supabase SQL editor (supabase.co → project → SQL editor)
-- ══════════════════════════════════════════════════════════════════════

-- ── Helper functions ───────────────────────────────────────────────────
-- Cached per query — avoids repeated profile lookups inside policies

CREATE OR REPLACE FUNCTION public.user_club_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT club_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- ── Enable RLS on all tables ───────────────────────────────────────────
ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE clubs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches           ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_plans       ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_feedback    ENABLE ROW LEVEL SECURITY;
ALTER TABLE self_assessments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE events            ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups            ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members     ENABLE ROW LEVEL SECURITY;

-- ══ PROFILES ══════════════════════════════════════════════════════════
-- Users can read any profile in their club (needed for athlete lists etc.)
CREATE POLICY "Club members can read profiles"
  ON profiles FOR SELECT TO authenticated
  USING (club_id = public.user_club_id());

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Allow insert during signup (handle_new_user trigger runs as service role,
-- but belt-and-suspenders for direct inserts)
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- ══ CLUBS ═════════════════════════════════════════════════════════════
-- Members can read their own club
CREATE POLICY "Club members can read their club"
  ON clubs FOR SELECT TO authenticated
  USING (id = public.user_club_id());

-- Staff can update their club
CREATE POLICY "Staff can update their club"
  ON clubs FOR UPDATE TO authenticated
  USING (id = public.user_club_id() AND public.user_role() = 'staff')
  WITH CHECK (id = public.user_club_id() AND public.user_role() = 'staff');

-- ══ MATCHES ═══════════════════════════════════════════════════════════
CREATE POLICY "Club members can read matches"
  ON matches FOR SELECT TO authenticated
  USING (club_id = public.user_club_id());

CREATE POLICY "Staff can manage matches"
  ON matches FOR ALL TO authenticated
  USING (club_id = public.user_club_id() AND public.user_role() = 'staff')
  WITH CHECK (club_id = public.user_club_id() AND public.user_role() = 'staff');

-- ══ MATCH PLANS ═══════════════════════════════════════════════════════
CREATE POLICY "Club members can read match plans"
  ON match_plans FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_plans.match_id
        AND m.club_id = public.user_club_id()
    )
  );

CREATE POLICY "Staff can manage match plans"
  ON match_plans FOR ALL TO authenticated
  USING (
    public.user_role() = 'staff' AND
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_plans.match_id
        AND m.club_id = public.user_club_id()
    )
  )
  WITH CHECK (
    public.user_role() = 'staff' AND
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_plans.match_id
        AND m.club_id = public.user_club_id()
    )
  );

-- ══ MATCH FEEDBACK ════════════════════════════════════════════════════
-- Athletes can read their own feedback
CREATE POLICY "Athletes can read own feedback"
  ON match_feedback FOR SELECT TO authenticated
  USING (athlete_id = auth.uid());

-- Athletes can update reaction/reply on their own feedback
CREATE POLICY "Athletes can react to own feedback"
  ON match_feedback FOR UPDATE TO authenticated
  USING (athlete_id = auth.uid())
  WITH CHECK (athlete_id = auth.uid());

-- Staff can do everything for feedback belonging to athletes in their club
CREATE POLICY "Staff can manage match feedback"
  ON match_feedback FOR ALL TO authenticated
  USING (
    public.user_role() = 'staff' AND
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = match_feedback.athlete_id
        AND p.club_id = public.user_club_id()
    )
  )
  WITH CHECK (
    public.user_role() = 'staff' AND
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = match_feedback.athlete_id
        AND p.club_id = public.user_club_id()
    )
  );

-- ══ SELF ASSESSMENTS ══════════════════════════════════════════════════
-- Athletes manage their own
CREATE POLICY "Athletes manage own self assessments"
  ON self_assessments FOR ALL TO authenticated
  USING (athlete_id = auth.uid())
  WITH CHECK (athlete_id = auth.uid());

-- Staff can read all self assessments in their club
CREATE POLICY "Staff can read self assessments"
  ON self_assessments FOR SELECT TO authenticated
  USING (
    public.user_role() = 'staff' AND
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = self_assessments.athlete_id
        AND p.club_id = public.user_club_id()
    )
  );

-- ══ TASKS ═════════════════════════════════════════════════════════════
-- Athletes can read tasks assigned to them
CREATE POLICY "Athletes can read own tasks"
  ON tasks FOR SELECT TO authenticated
  USING (assigned_to = auth.uid());

-- Athletes can update status on their own tasks
CREATE POLICY "Athletes can update own task status"
  ON tasks FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid())
  WITH CHECK (assigned_to = auth.uid());

-- Staff can do everything for their club's tasks
CREATE POLICY "Staff can manage tasks"
  ON tasks FOR ALL TO authenticated
  USING (club_id = public.user_club_id() AND public.user_role() = 'staff')
  WITH CHECK (club_id = public.user_club_id() AND public.user_role() = 'staff');

-- ══ EVENTS ════════════════════════════════════════════════════════════
-- Club members can read all club events
CREATE POLICY "Club members can read events"
  ON events FOR SELECT TO authenticated
  USING (club_id = public.user_club_id());

-- Staff can manage events
CREATE POLICY "Staff can manage events"
  ON events FOR ALL TO authenticated
  USING (club_id = public.user_club_id() AND public.user_role() = 'staff')
  WITH CHECK (club_id = public.user_club_id() AND public.user_role() = 'staff');

-- ══ EVENT ASSIGNMENTS ═════════════════════════════════════════════════
-- Athletes can read their own assignments
CREATE POLICY "Athletes can read own event assignments"
  ON event_assignments FOR SELECT TO authenticated
  USING (athlete_id = auth.uid());

-- Staff can manage event assignments for their club's events
CREATE POLICY "Staff can manage event assignments"
  ON event_assignments FOR ALL TO authenticated
  USING (
    public.user_role() = 'staff' AND
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_assignments.event_id
        AND e.club_id = public.user_club_id()
    )
  )
  WITH CHECK (
    public.user_role() = 'staff' AND
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_assignments.event_id
        AND e.club_id = public.user_club_id()
    )
  );

-- ══ GROUPS ════════════════════════════════════════════════════════════
-- Club members can read groups
CREATE POLICY "Club members can read groups"
  ON groups FOR SELECT TO authenticated
  USING (club_id = public.user_club_id());

-- Staff can manage groups
CREATE POLICY "Staff can manage groups"
  ON groups FOR ALL TO authenticated
  USING (club_id = public.user_club_id() AND public.user_role() = 'staff')
  WITH CHECK (club_id = public.user_club_id() AND public.user_role() = 'staff');

-- ══ GROUP MEMBERS ═════════════════════════════════════════════════════
-- Athletes can read their own group memberships
CREATE POLICY "Athletes can read own group memberships"
  ON group_members FOR SELECT TO authenticated
  USING (athlete_id = auth.uid());

-- Staff can read all group members in their club
CREATE POLICY "Staff can read group members"
  ON group_members FOR SELECT TO authenticated
  USING (
    public.user_role() = 'staff' AND
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_members.group_id
        AND g.club_id = public.user_club_id()
    )
  );

-- Staff can manage group members
CREATE POLICY "Staff can manage group members"
  ON group_members FOR ALL TO authenticated
  USING (
    public.user_role() = 'staff' AND
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_members.group_id
        AND g.club_id = public.user_club_id()
    )
  )
  WITH CHECK (
    public.user_role() = 'staff' AND
    EXISTS (
      SELECT 1 FROM groups g
      WHERE g.id = group_members.group_id
        AND g.club_id = public.user_club_id()
    )
  );
