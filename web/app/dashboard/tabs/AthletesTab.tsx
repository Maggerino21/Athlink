'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import AthletesClient from '../athletes/AthletesClient';

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

export default function AthletesTab({ staffId, clubId }: { staffId: string; clubId: string }) {
  const supabase = createClient();
  const [athletes, setAthletes] = useState<Athlete[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: list } = await supabase
        .from('profiles')
        .select('id, full_name, language, avatar_url, created_at')
        .eq('club_id', clubId)
        .eq('role', 'athlete')
        .order('full_name');

      const rows = list ?? [];
      const ids = rows.map((a: { id: string }) => a.id);
      const safeIds = ids.length ? ids : ['none'];

      const [taskRes, fbRes] = await Promise.all([
        supabase.from('tasks').select('assigned_to, status').in('assigned_to', safeIds).eq('status', 'pending'),
        supabase.from('match_feedback').select('athlete_id, acknowledged').in('athlete_id', safeIds),
      ]);

      const tasks    = taskRes.data    ?? [];
      const feedback = fbRes.data ?? [];

      const enriched: Athlete[] = rows.map((a: { id: string; full_name: string; language: string | null; created_at: string }) => ({
        id:              a.id,
        full_name:       a.full_name,
        language:        a.language ?? 'en',
        created_at:      a.created_at,
        pending_tasks:   tasks.filter((t: { assigned_to: string; status: string }) => t.assigned_to === a.id).length,
        total_tasks:     tasks.filter((t: { assigned_to: string }) => t.assigned_to === a.id).length,
        unread_feedback: feedback.filter((f: { athlete_id: string; acknowledged: boolean }) => f.athlete_id === a.id && !f.acknowledged).length,
        total_feedback:  feedback.filter((f: { athlete_id: string }) => f.athlete_id === a.id).length,
      }));

      if (!cancelled) setAthletes(enriched);
    }

    load();
    return () => { cancelled = true; };
  }, [clubId]);

  if (!athletes) return <AthletesLoadingSkeleton />;
  return <AthletesClient athletes={athletes} staffId={staffId} clubId={clubId} />;
}

function AthletesLoadingSkeleton() {
  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{ width: 320, borderRight: '1px solid var(--border-default)', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Bone width="60%" height={11} style={{ marginBottom: 16 }} />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 'var(--radius-md)' }}>
            <Bone width={32} height={32} style={{ borderRadius: 'var(--radius-full)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <Bone width="65%" height={13} style={{ marginBottom: 5 }} />
              <Bone width="40%" height={10} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ flex: 1, padding: '36px 40px' }}>
        <Bone width={180} height={28} style={{ marginBottom: 8 }} />
        <Bone width={100} height={13} style={{ marginBottom: 32 }} />
      </div>
    </div>
  );
}

function Bone({ width, height, style }: { width: number | string; height: number; style?: React.CSSProperties }) {
  return <div className="skeleton" style={{ width, height, borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', ...style }} />;
}
