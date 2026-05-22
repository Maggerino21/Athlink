'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AvatarCircle } from '../athletes/AthletesClient';

type AthleteRow = { id: string; full_name: string; language: string };

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: 'pending' | 'completed' | 'unable';
  completed_at: string | null;
  created_at: string;
  athlete_id: string;
  athlete_name: string;
};

function formatDue(iso: string | null): { label: string; overdue: boolean; urgent: boolean } {
  if (!iso) return { label: 'No deadline', overdue: false, urgent: false };
  const due  = new Date(iso);
  const now  = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.ceil((due.getTime() - now.getTime()) / 86400000);
  if (diff < 0)  return { label: 'Overdue',          overdue: true,  urgent: true  };
  if (diff === 0) return { label: 'Today',            overdue: false, urgent: true  };
  if (diff === 1) return { label: 'Tomorrow',         overdue: false, urgent: true  };
  if (diff <= 3) return { label: `In ${diff} days`,  overdue: false, urgent: true  };
  if (diff < 7)  return { label: `In ${diff} days`,  overdue: false, urgent: false };
  return {
    label: due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    overdue: false, urgent: false,
  };
}

export default function TasksTab({ staffId, clubId }: { staffId: string; clubId: string }) {
  const supabase = createClient();
  const [tasks,    setTasks]    = useState<TaskRow[] | null>(null);
  const [athletes, setAthletes] = useState<AthleteRow[]>([]);
  const [filter,   setFilter]   = useState<'all' | 'pending' | 'completed'>('all');
  const [showModal, setShowModal] = useState(false);
  const [search,   setSearch]   = useState('');
  const [loading,  setLoading]  = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    const [profileRes, taskRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, language').eq('club_id', clubId).eq('role', 'athlete').order('full_name'),
      supabase.from('tasks').select('id, title, description, due_date, status, completed_at, created_at, assigned_to').eq('club_id', clubId).order('created_at', { ascending: false }).limit(200),
    ]);

    const ath = (profileRes.data ?? []) as AthleteRow[];
    setAthletes(ath);

    const athMap: Record<string, string> = {};
    ath.forEach((a) => { athMap[a.id] = a.full_name; });

    const rows: TaskRow[] = (taskRes.data ?? []).map((t: any) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      due_date: t.due_date,
      status: t.status,
      completed_at: t.completed_at,
      created_at: t.created_at,
      athlete_id: t.assigned_to,
      athlete_name: athMap[t.assigned_to] ?? 'Unknown',
    }));

    setTasks(rows);
    setLoading(false);
  }, [clubId]);

  useEffect(() => { load(); }, [load]);

  const toggleStatus = async (task: TaskRow) => {
    const next = task.status === 'completed' ? 'pending' : 'completed';
    const { error } = await supabase
      .from('tasks')
      .update({ status: next, completed_at: next === 'completed' ? new Date().toISOString() : null })
      .eq('id', task.id);
    if (!error) {
      setTasks(prev => prev?.map(t => t.id === task.id ? { ...t, status: next } : t) ?? null);
    }
  };

  const deleteTask = async (id: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (!error) {
      setTasks(prev => prev?.filter(t => t.id !== id) ?? null);
    }
  };

  const allTasks = tasks ?? [];
  const filtered = allTasks
    .filter(t => filter === 'all' || (filter === 'pending' ? t.status !== 'completed' : t.status === 'completed'))
    .filter(t => !search || t.athlete_name.toLowerCase().includes(search.toLowerCase()) || t.title.toLowerCase().includes(search.toLowerCase()));

  const pendingCount  = allTasks.filter(t => t.status !== 'completed').length;
  const overdueCount  = allTasks.filter(t => t.status !== 'completed' && t.due_date && new Date(t.due_date) < new Date()).length;

  return (
    <div style={{ padding: '36px 40px', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div className="t-label" style={{ marginBottom: 6 }}>Squad</div>
          <h1 className="t-display" style={{ margin: 0, color: 'var(--text-primary)' }}>
            Tasks
            {!loading && (
              <span className="t-subheading" style={{ color: 'var(--text-tertiary)', marginLeft: 10, fontWeight: 500 }}>
                {pendingCount} pending{overdueCount > 0 ? ` · ${overdueCount} overdue` : ''}
              </span>
            )}
          </h1>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary" style={{ gap: 6 }}>
          <PlusIcon size={14} />
          Assign task
        </button>
      </div>

      {/* Filters + search */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
        {(['all', 'pending', 'completed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 14px', borderRadius: 'var(--radius-full)',
              fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
              cursor: 'pointer', border: 'none',
              background: filter === f ? 'var(--accent-subtle)' : 'var(--surface-1)',
              color: filter === f ? 'var(--text-primary)' : 'var(--text-secondary)',
              transition: 'background 0.12s',
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <input
          className="input"
          placeholder="Search tasks or athletes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 220, padding: '7px 12px', fontSize: 13, marginLeft: 'auto' }}
        />
      </div>

      {/* Table */}
      <div className="glass" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }} className="t-small">Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }} className="t-small">No tasks found</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}></th>
                <th>Task</th>
                <th>Athlete</th>
                <th>Due</th>
                <th>Status</th>
                <th style={{ width: 32 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(task => {
                const done = task.status === 'completed';
                const { label: dueLabel, overdue, urgent } = formatDue(task.due_date);

                return (
                  <tr key={task.id} style={{ opacity: done ? 0.55 : 1 }}>
                    <td>
                      <button
                        onClick={() => toggleStatus(task)}
                        style={{
                          width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                          background: done ? 'var(--color-success-subtle)' : 'transparent',
                          border: `1.5px solid ${done ? 'var(--color-success)' : 'var(--border-strong)'}`,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          padding: 0,
                        }}
                        title={done ? 'Mark pending' : 'Mark complete'}
                      >
                        {done && (
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="var(--color-success)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="2 6 5 9 10 3"/>
                          </svg>
                        )}
                      </button>
                    </td>
                    <td style={{ maxWidth: 320 }}>
                      <div className="t-body-medium" style={{ color: 'var(--text-primary)', textDecoration: done ? 'line-through' : 'none', marginBottom: task.description ? 2 : 0 }}>
                        {task.title}
                      </div>
                      {task.description && (
                        <div className="t-small" style={{ color: 'var(--text-tertiary)' }}>{task.description}</div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <AvatarCircle name={task.athlete_name} size={26} />
                        <span className="t-small" style={{ color: 'var(--text-secondary)' }}>{task.athlete_name}</span>
                      </div>
                    </td>
                    <td>
                      {task.due_date ? (
                        <span
                          className="t-small"
                          style={{
                            color: overdue ? 'var(--color-danger)' : urgent ? 'var(--color-warning)' : 'var(--text-tertiary)',
                            fontWeight: (overdue || urgent) ? 600 : 400,
                          }}
                        >
                          {dueLabel}
                        </span>
                      ) : (
                        <span className="t-small" style={{ color: 'var(--text-disabled)' }}>—</span>
                      )}
                    </td>
                    <td>
                      {done
                        ? <span className="badge badge-success">Done</span>
                        : overdue
                          ? <span className="badge badge-danger">Overdue</span>
                          : <span className="badge">Pending</span>
                      }
                    </td>
                    <td>
                      <button
                        onClick={() => { if (confirm('Delete this task?')) deleteTask(task.id); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-disabled)', padding: 4, borderRadius: 4 }}
                        title="Delete task"
                      >
                        <TrashIcon size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Assign task modal */}
      {showModal && (
        <AssignTaskModal
          athletes={athletes}
          staffId={staffId}
          clubId={clubId}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

/* ── Assign Task Modal ────────────────────────────────────────────── */
function AssignTaskModal({
  athletes, staffId, clubId, onClose, onSaved,
}: {
  athletes: AthleteRow[];
  staffId: string;
  clubId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [athleteId,   setAthleteId]   = useState('');
  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [dueDate,     setDueDate]     = useState('');
  const [isSaving,    setIsSaving]    = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const save = async () => {
    if (!title.trim() || !athleteId) return;
    setIsSaving(true);
    setError(null);
    const { error: insertErr } = await supabase.from('tasks').insert({
      title:       title.trim(),
      description: description.trim() || null,
      due_date:    dueDate || null,
      status:      'pending',
      assigned_to: athleteId,
      created_by:  staffId,
      club_id:     clubId,
    });
    setIsSaving(false);
    if (insertErr) { setError(insertErr.message); return; }
    onSaved();
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: 480,
        borderRadius: 'var(--radius-xl)',
        background: 'var(--bg-base)',
        border: '1px solid var(--border-default)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border-default)' }}>
          <div className="t-subheading" style={{ color: 'var(--text-primary)' }}>Assign task</div>
          <button onClick={onClose} className="btn-ghost" style={{ width: 32, height: 32, padding: 0 }}>
            <CloseIcon />
          </button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>Assign to *</label>
            <select
              className="input"
              value={athleteId}
              onChange={(e) => setAthleteId(e.target.value)}
              style={{ cursor: 'pointer' }}
            >
              <option value="">Select athlete…</option>
              {athletes.map(a => (
                <option key={a.id} value={a.id}>{a.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>Task title *</label>
            <input
              className="input"
              placeholder="e.g. Review match footage from Tuesday"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>Description (optional)</label>
            <textarea
              className="input"
              placeholder="Add context or instructions…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              style={{ resize: 'vertical' }}
            />
          </div>
          <div>
            <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>Due date (optional)</label>
            <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          {error && <div className="t-small" style={{ color: 'var(--color-danger)' }}>{error}</div>}
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-default)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} disabled={!title.trim() || !athleteId || isSaving} className="btn-primary">
            {isSaving ? 'Saving…' : 'Assign task'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Icons ────────────────────────────────────────────────────────── */
function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

function PlusIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}

function TrashIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14H6L5 6"/>
      <path d="M10 11v6"/>
      <path d="M14 11v6"/>
      <path d="M9 6V4h6v2"/>
    </svg>
  );
}
