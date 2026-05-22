'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AvatarCircle } from '../athletes/AthletesClient';
import type { MatchFeedback } from '@/lib/database.types';

type AthleteRow = {
  id: string;
  full_name: string;
  language: string;
  unread: number;
};

type FeedbackDetail = MatchFeedback & { athlete_name?: string };

export default function FeedbackTab({ staffId, clubId }: { staffId: string; clubId: string }) {
  const supabase = createClient();
  const [athletes, setAthletes] = useState<AthleteRow[] | null>(null);
  const [selected, setSelected] = useState<AthleteRow | null>(null);
  const [feedback, setFeedback] = useState<FeedbackDetail[]>([]);
  const [loadingFb, setLoadingFb] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');

  // Load athletes
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: list } = await supabase
        .from('profiles')
        .select('id, full_name, language')
        .eq('club_id', clubId)
        .eq('role', 'athlete')
        .order('full_name');

      const rows = list ?? [];
      const ids = rows.map((a: any) => a.id);
      const safeIds = ids.length ? ids : ['none'];

      const { data: fbRows } = await supabase
        .from('match_feedback')
        .select('athlete_id, acknowledged')
        .in('athlete_id', safeIds)
        .eq('acknowledged', false);

      const unreadMap: Record<string, number> = {};
      (fbRows ?? []).forEach((f: any) => {
        unreadMap[f.athlete_id] = (unreadMap[f.athlete_id] ?? 0) + 1;
      });

      if (!cancelled) {
        setAthletes(rows.map((a: any) => ({
          id: a.id,
          full_name: a.full_name,
          language: a.language ?? 'en',
          unread: unreadMap[a.id] ?? 0,
        })));
      }
    }
    load();
    return () => { cancelled = true; };
  }, [clubId]);

  // Load feedback for selected athlete
  const loadFeedback = useCallback(async (athleteId: string) => {
    setLoadingFb(true);
    const { data } = await supabase
      .from('match_feedback')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('created_at', { ascending: false })
      .limit(30);
    setFeedback((data as FeedbackDetail[]) ?? []);
    setLoadingFb(false);
  }, []);

  useEffect(() => {
    if (selected) loadFeedback(selected.id);
    else setFeedback([]);
  }, [selected, loadFeedback]);

  const filtered = (athletes ?? []).filter(a =>
    a.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const totalUnread = (athletes ?? []).reduce((s, a) => s + a.unread, 0);

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Left: athlete list */}
      <div style={{
        width: 260, flexShrink: 0,
        borderRight: '1px solid var(--border-default)',
        display: 'flex', flexDirection: 'column',
        height: '100%', overflow: 'hidden',
      }}>
        <div style={{ padding: '24px 16px 12px', borderBottom: '1px solid var(--border-default)' }}>
          <div className="t-label" style={{ marginBottom: 5 }}>
            Feedback
            {totalUnread > 0 && <span className="badge badge-info" style={{ marginLeft: 8 }}>{totalUnread} unread</span>}
          </div>
          <input
            className="input"
            placeholder="Search athletes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginTop: 10, padding: '7px 12px', fontSize: 13 }}
          />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
          {!athletes ? (
            <LoadingSkeleton />
          ) : filtered.length === 0 ? (
            <div className="t-small" style={{ color: 'var(--text-tertiary)', padding: '24px 8px', textAlign: 'center' }}>
              No athletes found
            </div>
          ) : (
            filtered.map(a => (
              <button
                key={a.id}
                onClick={() => setSelected(selected?.id === a.id ? null : a)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 10px', borderRadius: 'var(--radius-md)',
                  background: selected?.id === a.id ? 'var(--accent-subtle)' : 'transparent',
                  border: selected?.id === a.id ? '1px solid var(--accent-border)' : '1px solid transparent',
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'background 0.12s',
                }}
              >
                <div style={{ position: 'relative' }}>
                  <AvatarCircle name={a.full_name} size={32} />
                  {a.unread > 0 && (
                    <div style={{
                      position: 'absolute', top: -2, right: -2,
                      width: 14, height: 14, borderRadius: '50%',
                      background: 'var(--color-info)', border: '2px solid var(--bg-base)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 8, fontWeight: 700, color: '#fff',
                    }}>
                      {a.unread > 9 ? '9+' : a.unread}
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t-small" style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {a.full_name}
                  </div>
                  <div className="t-label" style={{ marginTop: 2 }}>
                    {a.language.toUpperCase()}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right: feedback panel */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {!selected ? (
          <EmptySelection />
        ) : (
          <>
            {/* Panel header */}
            <div style={{ padding: '24px 32px 20px', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: 14 }}>
              <AvatarCircle name={selected.full_name} size={40} />
              <div style={{ flex: 1 }}>
                <div className="t-subheading" style={{ color: 'var(--text-primary)' }}>{selected.full_name}</div>
                <div className="t-small" style={{ color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {selected.unread > 0 ? `${selected.unread} unread · ` : ''}{selected.language.toUpperCase()}
                </div>
              </div>
              <button
                onClick={() => setShowModal(true)}
                className="btn-primary"
                style={{ gap: 6, fontSize: 13 }}
              >
                <SendIcon size={14} />
                Send feedback
              </button>
            </div>

            {/* Feedback list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 32px 32px' }}>
              {loadingFb ? (
                <div className="t-small" style={{ color: 'var(--text-tertiary)', textAlign: 'center', paddingTop: 40 }}>Loading…</div>
              ) : feedback.length === 0 ? (
                <div style={{ textAlign: 'center', paddingTop: 48 }}>
                  <div className="t-small" style={{ color: 'var(--text-tertiary)', marginBottom: 6 }}>No feedback sent yet</div>
                  <div className="t-label">Click "Send feedback" to get started.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 680 }}>
                  {feedback.map(fb => (
                    <FeedbackCard key={fb.id} fb={fb} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modal */}
      {showModal && selected && (
        <SendFeedbackModal
          athlete={selected}
          staffId={staffId}
          onClose={() => setShowModal(false)}
          onSent={() => { setShowModal(false); loadFeedback(selected.id); }}
        />
      )}
    </div>
  );
}

/* ── Feedback card ────────────────────────────────────────────────── */
function FeedbackCard({ fb }: { fb: MatchFeedback }) {
  const [expanded, setExpanded] = useState(false);
  const text = fb.processed_text ?? fb.feedback_text;
  const isLong = text.length > 180;

  return (
    <div
      className="glass"
      style={{
        borderRadius: 'var(--radius-md)', padding: '14px 16px',
        borderColor: !fb.acknowledged ? 'var(--color-info-border)' : undefined,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div className="t-body-medium" style={{ color: 'var(--text-primary)' }}>
          {fb.title ?? 'Feedback'}
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0, marginLeft: 8 }}>
          {fb.is_ai_processed && <span className="badge badge-info" style={{ fontSize: 10 }}>AI</span>}
          {fb.acknowledged
            ? <span className="badge badge-success" style={{ fontSize: 10 }}>{fb.reaction ? fb.reaction + ' Acknowledged' : 'Acknowledged'}</span>
            : <span className="badge badge-info" style={{ fontSize: 10 }}>Unread</span>
          }
        </div>
      </div>

      <p className="t-small" style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
        {!expanded && isLong ? text.slice(0, 180) + '…' : text}
      </p>

      {isLong && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="t-label"
          style={{ marginTop: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0 }}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}

      {fb.action_point && (
        <div style={{
          marginTop: 10, padding: '8px 12px',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--color-info-subtle)',
          border: '1px solid var(--color-info-border)',
        }}>
          <div className="t-label" style={{ marginBottom: 3, color: 'var(--color-info)' }}>Action point</div>
          <div className="t-small" style={{ color: 'var(--color-info)' }}>{fb.action_point}</div>
        </div>
      )}

      {fb.athlete_reply && (
        <div style={{
          marginTop: 10, padding: '8px 12px',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--surface-2)',
        }}>
          <div className="t-label" style={{ marginBottom: 3 }}>Athlete reply</div>
          <div className="t-small" style={{ color: 'var(--text-secondary)' }}>{fb.athlete_reply}</div>
        </div>
      )}

      <div className="t-label" style={{ marginTop: 10 }}>
        {new Date(fb.created_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
      </div>
    </div>
  );
}

/* ── Send Feedback Modal ──────────────────────────────────────────── */
function SendFeedbackModal({
  athlete, staffId, onClose, onSent,
}: {
  athlete: AthleteRow;
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
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: 540, maxHeight: '88vh',
        borderRadius: 'var(--radius-xl)',
        background: 'var(--bg-base)',
        border: '1px solid var(--border-default)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border-default)' }}>
          <div>
            <div className="t-subheading" style={{ color: 'var(--text-primary)' }}>Send feedback</div>
            <div className="t-small" style={{ color: 'var(--text-tertiary)', marginTop: 3 }}>to {athlete.full_name}</div>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ width: 32, height: 32, padding: 0 }}>
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {step === 'compose' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>Title (optional)</label>
                <input className="input" placeholder="e.g. Match performance — vs Brann" value={title} onChange={(e) => setTitle(e.target.value)} />
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
                  autoFocus
                />
              </div>
              <div>
                <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>Action point (optional)</label>
                <input className="input" placeholder="One concrete thing to work on" value={actionPoint} onChange={(e) => setActionPoint(e.target.value)} />
              </div>
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
                <button onClick={processWithAI} disabled={!feedbackText.trim() || isProcessing} className="btn-primary">
                  {isProcessing ? 'Processing…' : 'Process with AI →'}
                </button>
              ) : (
                <button onClick={() => send(false)} disabled={!feedbackText.trim() || isSending} className="btn-primary">
                  {isSending ? 'Sending…' : 'Send feedback'}
                </button>
              )}
            </>
          ) : (
            <>
              <button onClick={() => setStep('compose')} className="btn-ghost">← Edit</button>
              <button onClick={() => send(true)} disabled={isSending} className="btn-primary">
                {isSending ? 'Sending…' : 'Confirm & send'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Misc ─────────────────────────────────────────────────────────── */
function EmptySelection() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 40 }}>
      <ChatIcon size={40} style={{ color: 'var(--text-disabled)' }} />
      <div className="t-subheading" style={{ color: 'var(--text-tertiary)' }}>Select an athlete</div>
      <div className="t-small" style={{ color: 'var(--text-disabled)', textAlign: 'center', maxWidth: 280 }}>
        Pick an athlete from the list to view their feedback history and send new notes.
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ padding: '8px 4px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px' }}>
          <div className="skeleton" style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface-2)' }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 12, width: '60%', borderRadius: 4, background: 'var(--surface-2)', marginBottom: 5 }} />
            <div className="skeleton" style={{ height: 10, width: '30%', borderRadius: 4, background: 'var(--surface-2)' }} />
          </div>
        </div>
      ))}
    </div>
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

function ChatIcon({ size = 16, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
}
