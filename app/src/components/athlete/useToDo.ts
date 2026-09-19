/**
 * useToDo — what the staff have sent this player that still wants something
 * from them: open tasks, and feedback they have not said "Got it" to.
 *
 * **There is no Tasks or Feedback tab** (decided 2026-09-19). A player has 0–3
 * of these at a time, and a tab for a list that is usually empty is exactly the
 * admin-software feel the app exists to avoid. They live where they matter:
 *
 * - **Home**, while open — the "To do" tile opens `ToDoScreen`.
 * - **Schedule**, for good — a task on its due day, feedback on its match. That
 *   is also the history: "what did the coach say after Molde" is answered by
 *   opening Molde. See `toTaskItem` / `toFeedbackItem`, which Schedule shares.
 *
 * Writes go through `set_task_done` and `acknowledge_feedback` — players have
 * no direct UPDATE on either table (supabase/athlete_actions.sql). No replies:
 * Athlink is not a chat.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { readCache, writeCache } from '../../utils/cache';

export interface TaskItem {
  kind: 'task';
  id: string;
  title: string;
  description: string | null;
  /** timestamptz, or null for "no deadline". */
  due: string | null;
  from: string;
  done: boolean;
}

export interface FeedbackItem {
  kind: 'feedback';
  id: string;
  title: string | null;
  /** The AI-structured text when there is one, else what the coach wrote. */
  body: string;
  actionPoint: string | null;
  from: string;
  /** "vs Molde" — the match it is about, if it names one. */
  about: string | null;
  /** The day it belongs on in Schedule: the match's kick-off, else when sent. */
  dayOf: string;
  sentAt: string;
  done: boolean;
}

export type ToDoItem = TaskItem | FeedbackItem;

// ── Rows → items. Shared with Schedule so the two can never disagree. ─────────

export const TASK_SELECT =
  'id, title, description, due_date, status, staff:profiles!tasks_created_by_fkey(full_name)';

export const FEEDBACK_SELECT =
  'id, title, feedback_text, processed_text, action_point, acknowledged, created_at, ' +
  // Every embed names its key: profiles is linked twice, and naming them all
  // is cheaper than finding out which one turns ambiguous next (PGRST201).
  'staff:profiles!match_feedback_created_by_fkey(full_name), ' +
  'match:matches!match_feedback_match_id_fkey(opponent, match_date, is_home)';

export function toTaskItem(row: any): TaskItem {
  return {
    kind: 'task',
    id: row.id,
    title: row.title,
    description: row.description || null,
    due: row.due_date ?? null,
    from: row.staff?.full_name ?? 'Your staff',
    done: row.status !== 'pending',
  };
}

export function toFeedbackItem(row: any): FeedbackItem {
  const m = row.match as { opponent: string; match_date: string; is_home: boolean | null } | null;
  return {
    kind: 'feedback',
    id: row.id,
    title: row.title || null,
    body: row.processed_text || row.feedback_text,
    actionPoint: row.action_point || null,
    from: row.staff?.full_name ?? 'Your staff',
    about: m ? `${m.is_home === false ? 'Away vs' : 'vs'} ${m.opponent}` : null,
    dayOf: m?.match_date ?? row.created_at,
    sentAt: row.created_at,
    done: !!row.acknowledged,
  };
}

// ── Writes ────────────────────────────────────────────────────────────────────

/**
 * Anything that changed what is open — a tick in the sheet, say — tells every
 * mounted reader to reload. The sheet is a separate route and cannot reach
 * Home's or Schedule's state directly; same pattern as the fine box.
 */
const listeners = new Set<() => void>();
export function onToDoChanged(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
function notify() { listeners.forEach(fn => fn()); }

/** true when the server took it. Callers are optimistic and undo on false. */
export async function setTaskDone(id: string, done: boolean): Promise<boolean> {
  const { error } = await supabase.rpc('set_task_done', { p_task_id: id, p_done: done });
  if (!error) notify();
  return !error;
}

export async function acknowledgeFeedback(id: string): Promise<boolean> {
  const { error } = await supabase.rpc('acknowledge_feedback', { p_feedback_id: id });
  if (!error) notify();
  return !error;
}

// ── The open list ─────────────────────────────────────────────────────────────

/** Feedback first, newest first — it is news. Then tasks, soonest due first. */
function order(items: ToDoItem[]): ToDoItem[] {
  const feedback = items.filter((i): i is FeedbackItem => i.kind === 'feedback')
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  const tasks = items.filter((i): i is TaskItem => i.kind === 'task')
    .sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'));
  return [...feedback, ...tasks];
}

export function useToDo(isActive?: boolean) {
  const { profile } = useAuth();
  const [cached] = useState(() => (profile ? readCache<ToDoItem[]>(profile.id, 'todo') : undefined));
  const [items, setItems] = useState<ToDoItem[]>(cached ?? []);
  const [loaded, setLoaded] = useState(!!cached);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      const [tasksRes, feedbackRes] = await Promise.all([
        supabase.from('tasks').select(TASK_SELECT)
          .eq('assigned_to', profile.id).eq('status', 'pending'),
        supabase.from('match_feedback').select(FEEDBACK_SELECT)
          .eq('athlete_id', profile.id).eq('acknowledged', false),
      ]);
      // A failed refresh keeps what is on screen — see utils/cache.
      if (tasksRes.error || feedbackRes.error) return;
      const next = order([
        ...(tasksRes.data ?? []).map(toTaskItem),
        ...(feedbackRes.data ?? []).map(toFeedbackItem),
      ]);
      setItems(next);
      writeCache(profile.id, 'todo', next);
    } finally {
      setLoaded(true);
    }
  }, [profile]);

  // On mount even while hidden, then each time the tab comes back into view.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; load(); return; }
    if (isActive) load();
  }, [isActive, load]);

  useEffect(() => onToDoChanged(load), [load]);

  return { items, loaded, reload: load };
}
