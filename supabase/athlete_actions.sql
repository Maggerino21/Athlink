-- ══ What a player can do to what the staff sent them ═══════════════════════
--
-- Exactly two things: tick a task off (or back on), and say "Got it" to a piece
-- of feedback. Both go through the SECURITY DEFINER functions below.
--
-- Before this, athletes had row-level UPDATE policies on `tasks` and
-- `match_feedback`, and `authenticated` holds UPDATE on every column of both.
-- RLS cannot restrict columns, so a player could rewrite a coach's feedback
-- text, or a task's title, due date or author — verified: one UPDATE as a test
-- athlete rewrote all three of their feedback rows. Column grants cannot fix it
-- here the way they did for `profiles`, because staff legitimately need those
-- columns and a grant cannot tell a player from a coach. So the direct path
-- goes, and a narrow one replaces it.
--
-- Replies (`athlete_reply`) and emoji reactions (`reaction`) are no longer
-- written by anything. Replies were cut on purpose: Athlink is not a chat.

DROP POLICY IF EXISTS "Athletes can react to own feedback" ON public.match_feedback;
DROP POLICY IF EXISTS "Athletes can update own task status" ON public.tasks;

CREATE OR REPLACE FUNCTION public.set_task_done(p_task_id uuid, p_done boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- user_role() is NULL for removed members, so they are refused as well.
  IF public.user_role() IS DISTINCT FROM 'athlete' THEN
    RAISE EXCEPTION 'Only players can tick off their own tasks';
  END IF;

  UPDATE public.tasks
     SET status       = CASE WHEN p_done THEN 'completed' ELSE 'pending' END,
         completed_at = CASE WHEN p_done THEN now() ELSE NULL END
   WHERE id = p_task_id AND assigned_to = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.acknowledge_feedback(p_feedback_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.user_role() IS DISTINCT FROM 'athlete' THEN
    RAISE EXCEPTION 'Only players can acknowledge their own feedback';
  END IF;

  UPDATE public.match_feedback
     SET acknowledged    = true,
         -- Saying "Got it" twice must not move the time the staff see.
         acknowledged_at = coalesce(acknowledged_at, now())
   WHERE id = p_feedback_id AND athlete_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Feedback not found';
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.set_task_done(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.acknowledge_feedback(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_task_done(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.acknowledge_feedback(uuid) TO authenticated;
