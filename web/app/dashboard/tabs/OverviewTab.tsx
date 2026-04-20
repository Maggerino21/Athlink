'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

type MatchRow = { id: string; opponent: string; match_date: string; is_home: boolean; location: string | null };
type EventRow = { id: string; type: string; title: string; event_date: string; location: string | null };

type State = {
  athleteCount:    number;
  unreadFeedback:  number;
  pendingTasks:    number;
  overdueTasks:    number;
  upcomingMatches: MatchRow[];
  upcomingEvents:  EventRow[];
};

export default function OverviewTab({ clubId, staffName }: { clubId: string; staffName: string }) {
  const supabase = createClient();
  const [data, setData] = useState<State | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Fetch athletes first to get IDs for scoped queries
      const { data: athleteRows } = await supabase
        .from('profiles')
        .select('id')
        .eq('club_id', clubId)
        .eq('role', 'athlete');

      const ids = (athleteRows ?? []).map((a: { id: string }) => a.id);
      const safeIds = ids.length ? ids : ['none'];
      const now = new Date().toISOString();

      const [fbRes, ptRes, otRes, matchRes, eventRes] = await Promise.all([
        supabase.from('match_feedback').select('id', { count: 'exact', head: true }).in('athlete_id', safeIds).eq('acknowledged', false),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('club_id', clubId).eq('status', 'pending'),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('club_id', clubId).eq('status', 'pending').lt('due_date', now),
        supabase.from('matches').select('id,opponent,match_date,is_home,location').eq('club_id', clubId).eq('status', 'upcoming').gte('match_date', now).order('match_date').limit(3),
        supabase.from('events').select('id,type,title,event_date,location').eq('club_id', clubId).gte('event_date', now).order('event_date').limit(5),
      ]);

      if (cancelled) return;
      setData({
        athleteCount:    ids.length,
        unreadFeedback:  fbRes.count ?? 0,
        pendingTasks:    ptRes.count ?? 0,
        overdueTasks:    otRes.count ?? 0,
        upcomingMatches: (matchRes.data as MatchRow[]) ?? [],
        upcomingEvents:  (eventRes.data as EventRow[]) ?? [],
      });
    }

    load();
    return () => { cancelled = true; };
  }, [clubId]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div style={{ padding: '36px 40px', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: 36 }}>
        <div className="t-label" style={{ marginBottom: 6 }}>{greeting}</div>
        <h1 className="t-display" style={{ color: 'var(--text-primary)', margin: 0 }}>
          {staffName}
        </h1>
      </div>

      {!data ? (
        <OverviewSkeleton />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 36 }}>
            <KpiCard label="Athletes"        value={data.athleteCount}    intent="accent"  />
            <KpiCard label="Unread feedback" value={data.unreadFeedback}  intent="info"    alert={data.unreadFeedback > 0} />
            <KpiCard label="Pending tasks"   value={data.pendingTasks}    intent="success" />
            <KpiCard label="Overdue tasks"   value={data.overdueTasks}    intent="danger"  alert={data.overdueTasks > 0} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <Section title="Upcoming matches">
              {data.upcomingMatches.length === 0 ? <Empty text="No upcoming matches" /> : (
                data.upcomingMatches.map((m) => (
                  <div key={m.id} className="glass" style={{ borderRadius: 'var(--radius-md)', padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', flexShrink: 0, background: 'var(--color-warning-subtle)', border: '1px solid var(--color-warning-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/></svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="t-body-medium" style={{ color: 'var(--text-primary)', marginBottom: 2 }}>{m.is_home ? 'vs' : '@'} {m.opponent}</div>
                      <div className="t-small" style={{ color: 'var(--text-tertiary)' }}>{formatDate(m.match_date)}{m.location ? ` · ${m.location}` : ''}</div>
                    </div>
                    <span className="badge badge-warning">{m.is_home ? 'Home' : 'Away'}</span>
                  </div>
                ))
              )}
            </Section>

            <Section title="Upcoming events">
              {data.upcomingEvents.length === 0 ? <Empty text="No upcoming events" /> : (
                data.upcomingEvents.map((ev) => {
                  const { cssVar, label } = EVENT_META[ev.type] ?? EVENT_META.other;
                  return (
                    <div key={ev.id} className="glass" style={{ borderRadius: 'var(--radius-md)', padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ width: 4, height: 36, borderRadius: 'var(--radius-full)', flexShrink: 0, background: `var(${cssVar})` }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="t-body-medium" style={{ color: 'var(--text-primary)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                        <div className="t-small" style={{ color: 'var(--text-tertiary)' }}>{formatDate(ev.event_date)}{ev.location ? ` · ${ev.location}` : ''}</div>
                      </div>
                      <span className="badge" style={{ background: `color-mix(in srgb, var(${cssVar}) 12%, transparent)`, borderColor: `color-mix(in srgb, var(${cssVar}) 28%, transparent)`, color: `var(${cssVar})` }}>{label}</span>
                    </div>
                  );
                })
              )}
            </Section>
          </div>
        </>
      )}
    </div>
  );
}

type KpiIntent = 'accent' | 'info' | 'success' | 'danger';
const INTENT_VAR: Record<KpiIntent, string> = { accent: '--accent', info: '--color-info', success: '--color-success', danger: '--color-danger' };
const INTENT_BORDER: Record<KpiIntent, string> = { accent: '--accent-border', info: '--color-info-border', success: '--color-success-border', danger: '--color-danger-border' };

function KpiCard({ label, value, intent, alert = false }: { label: string; value: number; intent: KpiIntent; alert?: boolean }) {
  const showColor = intent === 'accent' || alert;
  return (
    <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: '18px 20px', borderColor: showColor ? `var(${INTENT_BORDER[intent]})` : undefined }}>
      <div style={{ fontSize: 32, fontWeight: 800, color: showColor ? `var(${INTENT_VAR[intent]})` : 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</div>
      <div className="t-label" style={{ marginTop: 8 }}>{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="t-label" style={{ marginBottom: 12 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="glass t-small" style={{ borderRadius: 'var(--radius-md)', padding: '20px 16px', textAlign: 'center', color: 'var(--text-tertiary)' }}>{text}</div>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const EVENT_META: Record<string, { cssVar: string; label: string }> = {
  training: { cssVar: '--event-training', label: 'Training' },
  exercise: { cssVar: '--event-exercise', label: 'Exercise' },
  recovery: { cssVar: '--event-recovery', label: 'Recovery' },
  travel:   { cssVar: '--event-travel',   label: 'Travel'   },
  meeting:  { cssVar: '--event-meeting',  label: 'Meeting'  },
  other:    { cssVar: '--event-other',    label: 'Other'    },
};

function OverviewSkeleton() {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 36 }}>
        {[0,1,2,3].map((i) => (
          <div key={i} className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: '18px 20px' }}>
            <Bone width={48} height={32} style={{ marginBottom: 10 }} />
            <Bone width={90} height={11} />
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {[0,1].map((col) => (
          <div key={col}>
            <Bone width={120} height={11} style={{ marginBottom: 14 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[0,1,2].map((row) => (
                <div key={row} className="glass" style={{ borderRadius: 'var(--radius-md)', padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'center' }}>
                  <Bone width={36} height={36} style={{ borderRadius: 'var(--radius-sm)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <Bone width="70%" height={13} style={{ marginBottom: 6 }} />
                    <Bone width="50%" height={11} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Bone({ width, height, style }: { width: number | string; height: number; style?: React.CSSProperties }) {
  return <div className="skeleton" style={{ width, height, borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', ...style }} />;
}
