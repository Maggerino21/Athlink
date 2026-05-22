'use client';

import { useState, useEffect } from 'react';
import { FolderOpen, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

/* ── Types ──────────────────────────────────────────────────────────── */
type Group = {
  id:          string;
  name:        string;
  color:       string;
  description: string | null;
  member_count: number;
};

type Athlete = { id: string; full_name: string };

type Member  = { id: string; athlete_id: string; full_name: string };

/* ── Preset colors ──────────────────────────────────────────────────── */
const PRESET_COLORS = [
  '#60A5FA', '#A78BFA', '#F472B6', '#34D399',
  '#FB923C', '#FBBF24', '#4ADE80', '#F87171',
  '#38BDF8', '#C084FC', '#94A3B8', '#6EE7B7',
];

/* ── Helpers ────────────────────────────────────────────────────────── */
function hexToRgb(hex: string): string {
  const c = hex.replace('#', '');
  return `${parseInt(c.slice(0,2),16)}, ${parseInt(c.slice(2,4),16)}, ${parseInt(c.slice(4,6),16)}`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/* ══ Main component ═════════════════════════════════════════════════ */
export default function GroupsTab({ clubId }: { clubId: string }) {
  const supabase = createClient();

  const [groups,      setGroups]      = useState<Group[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [showCreate,  setShowCreate]  = useState(false);

  async function fetchGroups() {
    // Fetch groups + member counts via a join
    const { data } = await supabase
      .from('groups')
      .select('id, name, color, description, group_members(count)')
      .eq('club_id', clubId)
      .order('name');

    if (data) {
      setGroups(data.map((g: any) => ({
        id:           g.id,
        name:         g.name,
        color:        g.color,
        description:  g.description,
        member_count: g.group_members?.[0]?.count ?? 0,
      })));
    }
    setLoading(false);
  }

  useEffect(() => { fetchGroups(); }, [clubId]);

  function openGroup(g: Group) { setShowCreate(false); setActiveGroup(g); }
  function closePanel()        { setActiveGroup(null); setShowCreate(false); }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '28px 32px 20px',
        borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
      }}>
        <div>
          <div className="t-label" style={{ marginBottom: 4 }}>Dashboard</div>
          <h1 className="t-display" style={{ color: 'var(--text-primary)', margin: 0 }}>Groups</h1>
        </div>
        <button
          className="btn-ghost"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--accent-subtle)', borderColor: 'var(--accent-border)', color: 'var(--accent)' }}
          onClick={() => { setActiveGroup(null); setShowCreate(true); }}
        >
          <Plus size={13} strokeWidth={2.5} />
          New group
        </button>
      </div>

      {/* ── Grid ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            {[1,2,3].map(i => (
              <div key={i} className="skeleton" style={{ height: 140, borderRadius: 'var(--radius-lg)', background: 'var(--surface-2)' }} />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <EmptyState onNew={() => setShowCreate(true)} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            {groups.map(g => (
              <GroupCard key={g.id} group={g} active={activeGroup?.id === g.id} onClick={() => openGroup(g)} />
            ))}
          </div>
        )}
      </div>

      {/* ── Backdrop ───────────────────────────────────────────────── */}
      {(activeGroup || showCreate) && (
        <div
          onClick={closePanel}
          style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(2px)' }}
        />
      )}

      {/* ── Group detail panel ──────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: 420, zIndex: 30,
        display: 'flex', flexDirection: 'column',
        background: 'var(--surface-3)', borderLeft: '1px solid var(--border-default)',
        boxShadow: '-12px 0 48px rgba(0,0,0,0.35)',
        transform: activeGroup ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.26s cubic-bezier(0.25,0.46,0.45,0.94)',
      }}>
        {activeGroup && (
          <GroupDetail
            key={activeGroup.id}
            group={activeGroup}
            clubId={clubId}
            onClose={closePanel}
            onUpdated={fetchGroups}
            onDeleted={() => { closePanel(); fetchGroups(); }}
          />
        )}
      </div>

      {/* ── Create panel ────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: 420, zIndex: 30,
        display: 'flex', flexDirection: 'column',
        background: 'var(--surface-3)', borderLeft: '1px solid var(--border-default)',
        boxShadow: '-12px 0 48px rgba(0,0,0,0.35)',
        transform: showCreate ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.26s cubic-bezier(0.25,0.46,0.45,0.94)',
      }}>
        {showCreate && (
          <CreateGroupPanel
            clubId={clubId}
            onClose={closePanel}
            onCreated={() => { closePanel(); fetchGroups(); }}
          />
        )}
      </div>
    </div>
  );
}

/* ── Group card ─────────────────────────────────────────────────────── */
function GroupCard({ group, active, onClick }: { group: Group; active: boolean; onClick: () => void }) {
  const { name, color, description, member_count } = group;
  const rgb = hexToRgb(color);

  return (
    <button
      onClick={onClick}
      style={{
        background:    active ? `rgba(${rgb}, 0.13)` : `rgba(${rgb}, 0.07)`,
        border:        active ? `1px solid rgba(${rgb}, 0.45)` : `1px solid rgba(${rgb}, 0.22)`,
        borderRadius:  'var(--radius-lg)', padding: '0 0 20px',
        textAlign:     'left', cursor: 'pointer', fontFamily: 'inherit',
        display:       'flex', flexDirection: 'column',
        transition:    'background 0.15s, border-color 0.15s, transform 0.12s, box-shadow 0.15s',
        position:      'relative', overflow: 'hidden',
        transform:     active ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow:     active ? `0 8px 32px rgba(${rgb}, 0.20)` : 'none',
      }}
      onMouseEnter={e => {
        if (active) return;
        const b = e.currentTarget as HTMLButtonElement;
        b.style.background   = `rgba(${rgb}, 0.11)`;
        b.style.borderColor  = `rgba(${rgb}, 0.35)`;
        b.style.transform    = 'translateY(-2px)';
        b.style.boxShadow    = `0 6px 24px rgba(${rgb}, 0.15)`;
      }}
      onMouseLeave={e => {
        if (active) return;
        const b = e.currentTarget as HTMLButtonElement;
        b.style.background   = `rgba(${rgb}, 0.07)`;
        b.style.borderColor  = `rgba(${rgb}, 0.22)`;
        b.style.transform    = 'translateY(0)';
        b.style.boxShadow    = 'none';
      }}
    >
      {/* Color bar */}
      <div style={{ height: 4, background: color, borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', flexShrink: 0 }} />

      <div style={{ padding: '18px 20px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Name + member count */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color, letterSpacing: '-0.01em', lineHeight: 1.2 }}>
            {name}
          </div>
          <div style={{
            flexShrink: 0, padding: '2px 8px', borderRadius: 'var(--radius-full)',
            background: `rgba(${rgb}, 0.14)`, border: `1px solid rgba(${rgb}, 0.28)`,
            fontSize: 11, fontWeight: 700, color,
          }}>
            {member_count} {member_count === 1 ? 'player' : 'players'}
          </div>
        </div>

        {description && (
          <div className="t-small" style={{ color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
            {description}
          </div>
        )}

        {/* Arrow */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
        </div>
      </div>
    </button>
  );
}

/* ── Empty state ────────────────────────────────────────────────────── */
function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12, textAlign: 'center' }}>
      <FolderOpen size={48} strokeWidth={1.25} style={{ opacity: 0.3, color: 'var(--text-secondary)' }} />
      <div className="t-subheading" style={{ color: 'var(--text-primary)' }}>No groups yet</div>
      <div className="t-body" style={{ color: 'var(--text-secondary)', maxWidth: 320 }}>
        Groups let you organise athletes — defenders, attackers, rehab list — and assign tasks to the whole group at once.
      </div>
      <button onClick={onNew} className="btn-ghost" style={{ marginTop: 8, background: 'var(--accent-subtle)', borderColor: 'var(--accent-border)', color: 'var(--accent)' }}>
        Create first group
      </button>
    </div>
  );
}

/* ── Color picker ───────────────────────────────────────────────────── */
function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {PRESET_COLORS.map(c => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          style={{
            width: 28, height: 28, borderRadius: 'var(--radius-full)',
            background: c, border: value === c ? `3px solid white` : '3px solid transparent',
            cursor: 'pointer', transition: 'transform 0.1s, border-color 0.1s',
            outline: value === c ? `2px solid ${c}` : 'none', outlineOffset: 1,
            transform: value === c ? 'scale(1.15)' : 'scale(1)',
          }}
        />
      ))}
    </div>
  );
}

/* ── Create group panel ─────────────────────────────────────────────── */
function CreateGroupPanel({ clubId, onClose, onCreated }: { clubId: string; onClose: () => void; onCreated: () => void }) {
  const supabase = createClient();
  const [name,        setName]        = useState('');
  const [color,       setColor]       = useState(PRESET_COLORS[0]);
  const [description, setDescription] = useState('');
  const [athletes,    setAthletes]    = useState<Athlete[]>([]);
  const [selected,    setSelected]    = useState<string[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  useEffect(() => {
    supabase.from('profiles').select('id, full_name')
      .eq('club_id', clubId).eq('role', 'athlete').order('full_name')
      .then(({ data }) => setAthletes((data ?? []) as Athlete[]));
  }, [clubId]);

  function toggleAthlete(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Please enter a group name.'); return; }
    setError(''); setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: grp, error: grpErr } = await supabase.from('groups').insert({
        club_id:     clubId,
        created_by:  user.id,
        name:        name.trim(),
        color,
        description: description.trim() || null,
      }).select('id').single();
      if (grpErr) throw grpErr;

      if (selected.length > 0) {
        const { error: mErr } = await supabase.from('group_members').insert(
          selected.map(aid => ({ group_id: grp.id, athlete_id: aid }))
        );
        if (mErr) throw mErr;
      }

      onCreated();
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong.');
      setLoading(false);
    }
  }

  const rgb = hexToRgb(color);

  return (
    <>
      {/* Panel header */}
      <div style={{ padding: '24px 24px 20px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="t-label" style={{ marginBottom: 4 }}>Groups</div>
          <div className="t-subheading" style={{ color: 'var(--text-primary)' }}>New group</div>
        </div>
        <CloseBtn onClick={onClose} />
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Preview chip */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 14px', borderRadius: 'var(--radius-full)',
          background: `rgba(${rgb}, 0.12)`, border: `1px solid rgba(${rgb}, 0.30)`,
          alignSelf: 'flex-start',
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 700, color }}>{name || 'Group name'}</span>
        </div>

        <PanelField label="Group name">
          <input
            className="input"
            placeholder="e.g. Defenders, Rehab group, U23s"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />
        </PanelField>

        <PanelField label="Color">
          <ColorPicker value={color} onChange={setColor} />
        </PanelField>

        <PanelField label="Description (optional)">
          <input
            className="input"
            placeholder="Short note about this group"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </PanelField>

        <PanelField label={`Add athletes (${selected.length} selected)`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 220, overflowY: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'var(--surface-1)' }}>
            {athletes.length === 0 && <div className="t-small" style={{ color: 'var(--text-tertiary)', padding: '12px 14px' }}>No athletes found</div>}
            {athletes.map(a => {
              const checked = selected.includes(a.id);
              return (
                <AthleteRow key={a.id} athlete={a} checked={checked} onToggle={() => toggleAthlete(a.id)} />
              );
            })}
          </div>
        </PanelField>

        {error && <ErrorMsg msg={error} />}
      </form>

      {/* Footer */}
      <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <button
          onClick={handleSubmit as any}
          disabled={loading}
          style={{
            width: '100%', padding: '11px 18px', fontSize: 14, fontWeight: 600,
            fontFamily: 'inherit', cursor: loading ? 'not-allowed' : 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            borderRadius: 'var(--radius-md)',
            background: `rgba(${rgb}, 0.15)`,
            border: `1px solid rgba(${rgb}, 0.35)`,
            color,
            opacity: loading ? 0.5 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          {loading ? 'Creating…' : 'Create group'}
        </button>
      </div>
    </>
  );
}

/* ── Group detail panel ─────────────────────────────────────────────── */
function GroupDetail({ group, clubId, onClose, onUpdated, onDeleted }: {
  group:     Group;
  clubId:    string;
  onClose:   () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}) {
  const supabase = createClient();
  const [members,     setMembers]     = useState<Member[]>([]);
  const [athletes,    setAthletes]    = useState<Athlete[]>([]);
  const [editing,     setEditing]     = useState(false);
  const [editName,    setEditName]    = useState(group.name);
  const [editColor,   setEditColor]   = useState(group.color);
  const [editDesc,    setEditDesc]    = useState(group.description ?? '');
  const [saving,      setSaving]      = useState(false);
  const [addOpen,     setAddOpen]     = useState(false);
  const [toAdd,       setToAdd]       = useState<string[]>([]);
  const [adding,      setAdding]      = useState(false);
  const [delConfirm,  setDelConfirm]  = useState(false);

  const rgb = hexToRgb(group.color);

  async function fetchMembers() {
    const { data } = await supabase
      .from('group_members')
      .select('id, athlete_id, profiles(full_name)')
      .eq('group_id', group.id);
    if (data) {
      setMembers(data.map((m: any) => ({
        id: m.id, athlete_id: m.athlete_id, full_name: m.profiles?.full_name ?? '—',
      })));
    }
  }

  async function fetchAthletes() {
    const { data } = await supabase.from('profiles').select('id, full_name')
      .eq('club_id', clubId).eq('role', 'athlete').order('full_name');
    setAthletes((data ?? []) as Athlete[]);
  }

  useEffect(() => { fetchMembers(); fetchAthletes(); }, [group.id]);

  const memberIds    = members.map(m => m.athlete_id);
  const nonMembers   = athletes.filter(a => !memberIds.includes(a.id));

  async function removeMember(memberId: string) {
    await supabase.from('group_members').delete().eq('id', memberId);
    fetchMembers(); onUpdated();
  }

  async function addMembers() {
    if (toAdd.length === 0) return;
    setAdding(true);
    await supabase.from('group_members').insert(toAdd.map(aid => ({ group_id: group.id, athlete_id: aid })));
    setToAdd([]); setAddOpen(false); setAdding(false);
    fetchMembers(); onUpdated();
  }

  async function saveEdits() {
    if (!editName.trim()) return;
    setSaving(true);
    await supabase.from('groups').update({
      name:        editName.trim(),
      color:       editColor,
      description: editDesc.trim() || null,
      updated_at:  new Date().toISOString(),
    }).eq('id', group.id);
    setSaving(false); setEditing(false); onUpdated();
  }

  async function deleteGroup() {
    await supabase.from('groups').delete().eq('id', group.id);
    onDeleted();
  }

  return (
    <>
      {/* Header */}
      <div style={{ padding: '24px 24px 20px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: group.color, flexShrink: 0 }} />
            <div>
              <div className="t-label" style={{ marginBottom: 2 }}>Group</div>
              <div className="t-subheading" style={{ color: group.color }}>{group.name}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setEditing(e => !e)} className="btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }}>
              {editing ? 'Cancel' : 'Edit'}
            </button>
            <CloseBtn onClick={onClose} />
          </div>
        </div>
        {group.description && !editing && (
          <div className="t-small" style={{ color: 'var(--text-tertiary)', marginTop: 10 }}>{group.description}</div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Edit form */}
        {editing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 18px', borderRadius: 'var(--radius-md)', background: 'var(--surface-1)', border: '1px solid var(--border-default)' }}>
            <PanelField label="Name">
              <input className="input" value={editName} onChange={e => setEditName(e.target.value)} />
            </PanelField>
            <PanelField label="Color">
              <ColorPicker value={editColor} onChange={setEditColor} />
            </PanelField>
            <PanelField label="Description">
              <input className="input" placeholder="Optional" value={editDesc} onChange={e => setEditDesc(e.target.value)} />
            </PanelField>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveEdits} disabled={saving} className="btn-ghost"
                style={{ flex: 1, justifyContent: 'center', background: `rgba(${rgb},0.12)`, borderColor: `rgba(${rgb},0.30)`, color: group.color }}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              {!delConfirm ? (
                <button onClick={() => setDelConfirm(true)} className="btn-ghost"
                  style={{ background: 'var(--color-danger-subtle)', borderColor: 'var(--color-danger-border)', color: 'var(--color-danger)' }}>
                  Delete
                </button>
              ) : (
                <button onClick={deleteGroup} className="btn-ghost"
                  style={{ background: 'var(--color-danger-subtle)', borderColor: 'var(--color-danger-border)', color: 'var(--color-danger)', fontWeight: 700 }}>
                  Confirm delete
                </button>
              )}
            </div>
          </div>
        )}

        {/* Members list */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div className="t-label">Members · {members.length}</div>
            {nonMembers.length > 0 && (
              <button onClick={() => setAddOpen(o => !o)} className="btn-ghost" style={{ padding: '4px 10px', fontSize: 11, gap: 4 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add
              </button>
            )}
          </div>

          {/* Add members dropdown */}
          {addOpen && nonMembers.length > 0 && (
            <div style={{ marginBottom: 10, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'var(--surface-1)', overflow: 'hidden' }}>
              <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                {nonMembers.map(a => {
                  const checked = toAdd.includes(a.id);
                  return <AthleteRow key={a.id} athlete={a} checked={checked} onToggle={() => setToAdd(prev => checked ? prev.filter(x => x !== a.id) : [...prev, a.id])} />;
                })}
              </div>
              {toAdd.length > 0 && (
                <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border-subtle)' }}>
                  <button onClick={addMembers} disabled={adding} className="btn-ghost"
                    style={{ width: '100%', justifyContent: 'center', background: `rgba(${rgb},0.12)`, borderColor: `rgba(${rgb},0.30)`, color: group.color }}>
                    {adding ? 'Adding…' : `Add ${toAdd.length} athlete${toAdd.length > 1 ? 's' : ''}`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Member rows */}
          {members.length === 0 ? (
            <div className="t-small" style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No members yet — add athletes above.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {members.map(m => (
                <div key={m.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-1)', border: '1px solid var(--border-subtle)',
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 'var(--radius-full)', flexShrink: 0,
                    background: `rgba(${rgb}, 0.15)`, border: `1px solid rgba(${rgb}, 0.30)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, color: group.color,
                  }}>
                    {getInitials(m.full_name)}
                  </div>
                  <span className="t-small" style={{ color: 'var(--text-primary)', fontWeight: 500, flex: 1 }}>{m.full_name}</span>
                  <button
                    onClick={() => removeMember(m.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4, display: 'flex', alignItems: 'center' }}
                    title="Remove from group"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ── Shared small components ────────────────────────────────────────── */
function PanelField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label className="t-label">{label}</label>
      {children}
    </div>
  );
}

function AthleteRow({ athlete, checked, onToggle }: { athlete: Athlete; checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
        textAlign: 'left', fontFamily: 'inherit', width: '100%',
        background: checked ? 'var(--surface-2)' : 'transparent',
        border: 'none', borderBottom: '1px solid var(--border-subtle)',
        cursor: 'pointer', transition: 'background 0.1s',
      }}
    >
      <div style={{
        width: 16, height: 16, borderRadius: 4, flexShrink: 0,
        border: checked ? '2px solid var(--accent)' : '2px solid var(--border-strong)',
        background: checked ? 'var(--accent-subtle)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {checked && (
          <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="2 6 5 9 10 3"/>
          </svg>
        )}
      </div>
      <span className="t-small" style={{ color: 'var(--text-primary)', fontWeight: checked ? 600 : 400 }}>
        {athlete.full_name}
      </span>
    </button>
  );
}

function CloseBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="btn-ghost" style={{ width: 32, height: 32, padding: 0, flexShrink: 0 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--color-danger-subtle)', border: '1px solid var(--color-danger-border)', color: 'var(--color-danger)', fontSize: 13 }}>
      {msg}
    </div>
  );
}
