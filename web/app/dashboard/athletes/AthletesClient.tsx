'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import DateField from '@/components/DateField';
import type { MatchFeedback, Task } from '@/lib/database.types';

type Athlete = {
  id: string;
  full_name: string;
  language: string;
  created_at: string;
  pending_tasks: number;
  total_tasks: number;
  unread_feedback: number;
  total_feedback: number;
};

export default function AthletesClient({
  athletes,
  staffId,
  clubId,
}: {
  athletes: Athlete[];
  staffId: string;
  clubId: string;
}) {
  const [selected, setSelected] = useState<Athlete | null>(null);
  const [search,   setSearch]   = useState('');

  const filtered = athletes.filter((a) =>
    a.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Main table area */}
      <div style={{ flex: 1, minWidth: 0, padding: '36px 40px', paddingRight: selected ? 24 : 40, transition: 'padding-right 0.25s' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <div className="t-label" style={{ marginBottom: 6 }}>Squad</div>
            <h1 className="t-display" style={{ margin: 0, color: 'var(--text-primary)' }}>
              Athletes
              <span className="t-subheading" style={{ color: 'var(--text-tertiary)', marginLeft: 10, fontWeight: 500 }}>
                {athletes.length}
              </span>
            </h1>
          </div>
          <input
            className="input"
            style={{ width: 220, padding: '8px 14px' }}
            placeholder="Search athletes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Table */}
        <div className="glass" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Athlete</th>
                <th>Language</th>
                <th>Feedback</th>
                <th>Tasks</th>
                <th>Joined</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '32px 0' }}>
                    No athletes found
                  </td>
                </tr>
              )}
              {filtered.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => setSelected(selected?.id === a.id ? null : a)}
                  style={{ background: selected?.id === a.id ? 'var(--accent-subtle)' : undefined }}
                >
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <AvatarCircle name={a.full_name} size={32} />
                      <span className="t-body-medium">{a.full_name}</span>
                    </div>
                  </td>
                  <td>
                    <span className="badge">{a.language.toUpperCase()}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {a.unread_feedback > 0 && (
                        <span className="badge badge-info">{a.unread_feedback} unread</span>
                      )}
                      <span className="t-small" style={{ color: 'var(--text-tertiary)' }}>{a.total_feedback} total</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {a.pending_tasks > 0 && (
                        <span className="badge badge-success">{a.pending_tasks} pending</span>
                      )}
                      <span className="t-small" style={{ color: 'var(--text-tertiary)' }}>{a.total_tasks} total</span>
                    </div>
                  </td>
                  <td className="t-small" style={{ color: 'var(--text-tertiary)' }}>
                    {new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </td>
                  <td style={{ color: 'var(--text-tertiary)' }}>
                    <ChevronIcon />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <AthleteDetailPanel
          athlete={selected}
          staffId={staffId}
          clubId={clubId}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

/* ── Athlete detail panel ─────────────────────────────────────────── */
function AthleteDetailPanel({
  athlete, staffId, clubId, onClose,
}: {
  athlete: Athlete;
  staffId: string;
  clubId: string;
  onClose: () => void;
}) {
  const supabase = createClient();
  const [feedback, setFeedback] = useState<MatchFeedback[]>([]);
  const [tasks,    setTasks]    = useState<Task[]>([]);
  const [tab,      setTab]      = useState<'feedback' | 'tasks'>('feedback');
  const [loading,  setLoading]  = useState(true);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showTaskModal,     setShowTaskModal]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [fb, tk] = await Promise.all([
      supabase.from('match_feedback').select('*').eq('athlete_id', athlete.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('tasks').select('*').eq('assigned_to', athlete.id).order('created_at', { ascending: false }).limit(20),
    ]);
    setFeedback((fb.data as MatchFeedback[]) ?? []);
    setTasks((tk.data as Task[]) ?? []);
    setLoading(false);
  }, [athlete.id]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div
        className="glass-strong"
        style={{
          width: 360, flexShrink: 0,
          borderLeft: '1px solid var(--border-default)',
          borderTop: 'none', borderRight: 'none', borderBottom: 'none', borderRadius: 0,
          display: 'flex', flexDirection: 'column',
          height: '100%', overflow: 'hidden',
        }}
      >
        {/* Panel header */}
        <div style={{ padding: '20px 20px 0', borderBottom: '1px solid var(--border-default)', paddingBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <AvatarCircle name={athlete.full_name} size={40} />
            <div style={{ flex: 1 }}>
              <div className="t-subheading" style={{ color: 'var(--text-primary)' }}>
                {athlete.full_name}
              </div>
              <div className="t-small" style={{ color: 'var(--text-tertiary)', marginTop: 2 }}>
                {athlete.language.toUpperCase()} · {athlete.total_feedback} feedback · {athlete.total_tasks} tasks
              </div>
            </div>
            <button onClick={onClose} className="btn-ghost" style={{ width: 30, height: 30, padding: 0 }}>
              <CloseIcon />
            </button>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            <button
              onClick={() => setShowFeedbackModal(true)}
              className="btn-primary"
              style={{ flex: 1, fontSize: 12, padding: '7px 0', gap: 5 }}
            >
              <SendIcon size={13} />
              Send feedback
            </button>
            <button
              onClick={() => setShowTaskModal(true)}
              className="btn-ghost"
              style={{ flex: 1, fontSize: 12, padding: '7px 0', gap: 5 }}
            >
              <TaskIcon size={13} />
              Assign task
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4 }}>
            {(['feedback', 'tasks'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1, padding: '7px 0',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
                  cursor: 'pointer', border: 'none',
                  background: tab === t ? 'var(--accent-subtle)' : 'var(--surface-1)',
                  color: tab === t ? 'var(--text-primary)' : 'var(--text-secondary)',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
                {t === 'feedback' && athlete.unread_feedback > 0 && (
                  <span className="badge badge-info" style={{ marginLeft: 6, padding: '1px 6px' }}>
                    {athlete.unread_feedback}
                  </span>
                )}
                {t === 'tasks' && athlete.pending_tasks > 0 && (
                  <span className="badge badge-success" style={{ marginLeft: 6, padding: '1px 6px' }}>
                    {athlete.pending_tasks}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {loading ? (
            <div className="t-small" style={{ textAlign: 'center', color: 'var(--text-tertiary)', paddingTop: 40 }}>Loading…</div>
          ) : tab === 'feedback' ? (
            feedback.length === 0
              ? <EmptyState text="No feedback yet" sub="Send feedback above to get started." />
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {feedback.map((f) => <FeedbackCard key={f.id} fb={f} />)}
                </div>
          ) : (
            tasks.length === 0
              ? <EmptyState text="No tasks yet" sub="Assign a task above." />
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {tasks.map((t) => <TaskCard key={t.id} task={t} />)}
                </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showFeedbackModal && (
        <SendFeedbackModal
          athlete={athlete}
          staffId={staffId}
          onClose={() => setShowFeedbackModal(false)}
          onSent={() => { setShowFeedbackModal(false); load(); }}
        />
      )}
      {showTaskModal && (
        <AssignTaskModal
          athlete={athlete}
          staffId={staffId}
          clubId={clubId}
          onClose={() => setShowTaskModal(false)}
          onSaved={() => { setShowTaskModal(false); load(); }}
        />
      )}
    </>
  );
}

/* ── Send Feedback Modal ──────────────────────────────────────────── */
function SendFeedbackModal({
  athlete, staffId, onClose, onSent,
}: {
  athlete: Athlete;
  staffId: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const supabase = createClient();
  const [title,        setTitle]        = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [actionPoint,  setActionPoint]  = useState('');
  const [useAi,        setUseAi]        = useState(true);
  const [step,         setStep]         = useState<'compose' | 'preview'>('compose');
  const [preview,      setPreview]      = useState<{ feedback: string; action_point: string | null } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSending,    setIsSending]    = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const processWithAI = async () => {
    if (!feedbackText.trim()) return;
    setIsProcessing(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('process-feedback', {
        body: {
          feedback_text: feedbackText,
          action_point: actionPoint.trim() || null,
          athlete_language: athlete.language ?? 'en',
        },
      });
      if (fnErr) throw new Error(fnErr.message);
      setPreview({ feedback: data.feedback, action_point: data.action_point ?? null });
      setStep('preview');
    } catch (e: any) {
      setError('AI processing failed: ' + (e.message ?? 'unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  const send = async (withAI: boolean) => {
    setIsSending(true);
    setError(null);
    const { error: insertErr } = await supabase.from('match_feedback').insert({
      athlete_id:       athlete.id,
      created_by:       staffId,
      title:            title.trim() || null,
      feedback_text:    feedbackText.trim(),
      processed_text:   withAI && preview ? preview.feedback : null,
      action_point:     withAI && preview ? (preview.action_point ?? null) : (actionPoint.trim() || null),
      athlete_language: athlete.language ?? 'en',
      is_ai_processed:  withAI,
      acknowledged:     false,
    });
    setIsSending(false);
    if (insertErr) { setError(insertErr.message); return; }
    onSent();
  };

  return (
    <ModalOverlay onClose={onClose}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border-default)' }}>
        <div>
          <div className="t-subheading" style={{ color: 'var(--text-primary)' }}>Send feedback</div>
          <div className="t-small" style={{ color: 'var(--text-tertiary)', marginTop: 3 }}>to {athlete.full_name}</div>
        </div>
        <button onClick={onClose} className="btn-ghost" style={{ width: 32, height: 32, padding: 0 }}><CloseIcon /></button>
      </div>

      {/* Body */}
      <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
        {step === 'compose' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>Title (optional)</label>
              <input
                className="input"
                placeholder="e.g. Match performance — Brann"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>Feedback *</label>
              <textarea
                className="input"
                placeholder="Write your observations and key points…"
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                rows={5}
                style={{ resize: 'vertical', minHeight: 110 }}
              />
            </div>
            <div>
              <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>Action point (optional)</label>
              <input
                className="input"
                placeholder="One concrete thing to work on"
                value={actionPoint}
                onChange={(e) => setActionPoint(e.target.value)}
              />
            </div>
            {/* AI toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--surface-1)', border: '1px solid var(--border-default)' }}>
              <input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} style={{ accentColor: 'var(--accent)', width: 16, height: 16 }} />
              <div>
                <div className="t-small" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Translate & structure with AI</div>
                <div className="t-label" style={{ marginTop: 2 }}>Rewrites in athlete's language ({athlete.language.toUpperCase()}) with clear structure</div>
              </div>
              <span className="badge badge-info" style={{ marginLeft: 'auto' }}>AI</span>
            </label>
            {error && <div className="t-small" style={{ color: 'var(--color-danger)' }}>{error}</div>}
          </div>
        ) : (
          /* Preview step */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="t-small" style={{ color: 'var(--text-tertiary)' }}>
              AI has translated and structured your feedback. Review before sending.
            </div>
            <div style={{ padding: '14px 16px', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-info-border)' }}>
              <div className="t-label" style={{ marginBottom: 8, color: 'var(--color-info)' }}>Processed feedback</div>
              <textarea
                className="t-small"
                value={preview?.feedback ?? ''}
                onChange={(e) => setPreview(p => p ? { ...p, feedback: e.target.value } : p)}
                rows={6}
                style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-secondary)', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
              />
            </div>
            {preview?.action_point && (
              <div style={{ padding: '10px 14px', background: 'var(--color-info-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-info-border)' }}>
                <div className="t-label" style={{ marginBottom: 4, color: 'var(--color-info)' }}>Action point</div>
                <input
                  className="t-small"
                  value={preview.action_point}
                  onChange={(e) => setPreview(p => p ? { ...p, action_point: e.target.value } : p)}
                  style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'var(--color-info)', fontFamily: 'inherit' }}
                />
              </div>
            )}
            {error && <div className="t-small" style={{ color: 'var(--color-danger)' }}>{error}</div>}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-default)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        {step === 'compose' ? (
          <>
            <button onClick={onClose} className="btn-ghost">Cancel</button>
            {useAi ? (
              <button
                onClick={processWithAI}
                disabled={!feedbackText.trim() || isProcessing}
                className="btn-primary"
              >
                {isProcessing ? 'Processing…' : 'Process with AI →'}
              </button>
            ) : (
              <button
                onClick={() => send(false)}
                disabled={!feedbackText.trim() || isSending}
                className="btn-primary"
              >
                {isSending ? 'Sending…' : 'Send feedback'}
              </button>
            )}
          </>
        ) : (
          <>
            <button onClick={() => setStep('compose')} className="btn-ghost">← Edit</button>
            <button
              onClick={() => send(true)}
              disabled={isSending}
              className="btn-primary"
            >
              {isSending ? 'Sending…' : 'Confirm & send'}
            </button>
          </>
        )}
      </div>
    </ModalOverlay>
  );
}

/* ── Assign Task Modal ────────────────────────────────────────────── */
function AssignTaskModal({
  athlete, staffId, clubId, onClose, onSaved,
}: {
  athlete: Athlete;
  staffId: string;
  clubId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [dueDate,     setDueDate]     = useState('');
  const [isSaving,    setIsSaving]    = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const save = async () => {
    if (!title.trim()) return;
    setIsSaving(true);
    setError(null);
    const { error: insertErr } = await supabase.from('tasks').insert({
      title:       title.trim(),
      description: description.trim() || null,
      due_date:    dueDate || null,
      status:      'pending',
      assigned_to: athlete.id,
      created_by:  staffId,
      club_id:     clubId,
    });
    setIsSaving(false);
    if (insertErr) { setError(insertErr.message); return; }
    onSaved();
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border-default)' }}>
        <div>
          <div className="t-subheading" style={{ color: 'var(--text-primary)' }}>Assign task</div>
          <div className="t-small" style={{ color: 'var(--text-tertiary)', marginTop: 3 }}>to {athlete.full_name}</div>
        </div>
        <button onClick={onClose} className="btn-ghost" style={{ width: 32, height: 32, padding: 0 }}><CloseIcon /></button>
      </div>

      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>Task title *</label>
          <input
            className="input"
            placeholder="e.g. Watch back last match — first 20 mins"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
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
          <DateField value={dueDate} onChange={setDueDate} placeholder="No deadline" />
        </div>
        {error && <div className="t-small" style={{ color: 'var(--color-danger)' }}>{error}</div>}
      </div>

      <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-default)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onClose} className="btn-ghost">Cancel</button>
        <button
          onClick={save}
          disabled={!title.trim() || isSaving}
          className="btn-primary"
        >
          {isSaving ? 'Saving…' : 'Assign task'}
        </button>
      </div>
    </ModalOverlay>
  );
}

/* ── Shared modal wrapper ─────────────────────────────────────────── */
function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: 520, maxHeight: '88vh',
          borderRadius: 'var(--radius-xl)',
          background: 'var(--bg-base)',
          border: '1px solid var(--border-default)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ── Cards ────────────────────────────────────────────────────────── */
function FeedbackCard({ fb }: { fb: MatchFeedback }) {
  const text = fb.processed_text ?? fb.feedback_text;
  return (
    <div
      className="glass"
      style={{
        borderRadius: 'var(--radius-md)', padding: '12px 14px',
        borderColor: !fb.acknowledged ? 'var(--color-info-border)' : undefined,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div className="t-body-medium" style={{ color: 'var(--text-primary)' }}>
          {fb.title ?? 'Feedback'}
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 8 }}>
          {fb.is_ai_processed && <span className="badge badge-info" style={{ fontSize: 10 }}>AI</span>}
          {!fb.acknowledged  && <span className="badge badge-info" style={{ fontSize: 10 }}>Unread</span>}
        </div>
      </div>
      <p className="t-small" style={{ color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
        {text.length > 140 ? text.slice(0, 140) + '…' : text}
      </p>
      {fb.action_point && (
        <div
          className="t-small"
          style={{
            marginTop: 8, padding: '6px 10px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-info-subtle)',
            border: '1px solid var(--color-info-border)',
            color: 'var(--color-info)',
          }}
        >
          → {fb.action_point}
        </div>
      )}
      <div className="t-label" style={{ marginTop: 8 }}>
        {new Date(fb.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        {fb.reaction && <span style={{ marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>{fb.reaction}</span>}
      </div>
    </div>
  );
}

function TaskCard({ task }: { task: Task }) {
  const done   = task.status === 'completed';
  const overdue = !done && task.due_date && new Date(task.due_date) < new Date();
  return (
    <div
      className="glass"
      style={{
        borderRadius: 'var(--radius-md)', padding: '11px 14px',
        display: 'flex', gap: 10, alignItems: 'flex-start',
        opacity: done ? 0.55 : 1,
      }}
    >
      <div
        style={{
          width: 18, height: 18, borderRadius: 'var(--radius-sm)', flexShrink: 0, marginTop: 1,
          background: done ? 'var(--color-success-subtle)' : 'transparent',
          border: `1.5px solid ${done ? 'var(--color-success)' : 'var(--border-strong)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {done && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="var(--color-success)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="2 6 5 9 10 3"/>
          </svg>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="t-body-medium" style={{ color: 'var(--text-primary)', textDecoration: done ? 'line-through' : 'none' }}>
          {task.title}
        </div>
        {task.description && (
          <div className="t-small" style={{ color: 'var(--text-tertiary)', marginTop: 3 }}>{task.description}</div>
        )}
        {task.due_date && (
          <div className="t-label" style={{ marginTop: 5, color: overdue ? 'var(--color-danger)' : 'var(--text-tertiary)', textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>
            Due {new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            {overdue && ' · Overdue'}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ text, sub }: { text: string; sub?: string }) {
  return (
    <div style={{ textAlign: 'center', paddingTop: 32 }}>
      <div className="t-small" style={{ color: 'var(--text-tertiary)', marginBottom: 4 }}>{text}</div>
      {sub && <div className="t-label" style={{ color: 'var(--text-disabled)' }}>{sub}</div>}
    </div>
  );
}

/* ── Shared small components ──────────────────────────────────────── */
export function AvatarCircle({ name, size = 32 }: { name: string; size?: number }) {
  const initials = (() => {
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  })();
  return (
    <div
      style={{
        width: size, height: size,
        borderRadius: 'var(--radius-full)', flexShrink: 0,
        background: 'var(--accent-subtle)',
        border: '1px solid var(--accent-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.38, fontWeight: 700,
        color: 'var(--accent)',
      }}
    >
      {initials}
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

function SendIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  );
}

function TaskIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  );
}
