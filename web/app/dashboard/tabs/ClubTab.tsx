'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AvatarCircle } from '../athletes/AthletesClient';
import InvitePeople from '../InvitePeople';
import { CLUB_COLORS } from '@/lib/clubTheme';

/**
 * Club settings and membership.
 *
 * Every rule shown here is also enforced in the database (remove_club_member,
 * set_club_manager, and the clubs UPDATE policy). The UI hides what you cannot do so the
 * page stays calm; it is not what makes it safe.
 */

type Member = {
  id:              string;
  full_name:       string;
  role:            'athlete' | 'staff';
  language:        string;
  is_club_manager: boolean;
  removed_at:      string | null;
  created_at:      string;
};

type Confirm =
  | { kind: 'remove';  member: Member }
  | { kind: 'promote'; member: Member }
  | { kind: 'demote';  member: Member }
  | { kind: 'restore'; member: Member };

export default function ClubTab({
  clubId, clubName, clubColor, staffId, isClubManager,
  inviteCode, staffInviteCode, onClubUpdated,
}: {
  clubId:           string;
  clubName:         string;
  clubColor:        string;
  staffId:          string;
  isClubManager:    boolean;
  inviteCode:       string | null;
  staffInviteCode:  string | null;
  onClubUpdated:    (name: string, color: string) => void;
}) {
  const supabase = createClient();

  const [members, setMembers] = useState<Member[] | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role, language, is_club_manager, removed_at, created_at')
      .eq('club_id', clubId)
      .order('full_name');
    setMembers((data ?? []) as Member[]);
  }, [clubId]);

  useEffect(() => { load(); }, [load]);

  async function run(c: Confirm) {
    setBusy(true);
    setError('');

    const call =
      c.kind === 'remove'  ? supabase.rpc('remove_club_member',  { p_profile_id: c.member.id })
    : c.kind === 'restore' ? supabase.rpc('restore_club_member', { p_profile_id: c.member.id })
    : supabase.rpc('set_club_manager', {
        p_profile_id: c.member.id,
        p_value: c.kind === 'promote',
      });

    const { error: err } = await call;
    setBusy(false);

    if (err) {
      // The database messages are already written for humans, so show them as-is.
      setError(err.message.replace(/^.*?:\s*/, ''));
      return;
    }
    setConfirm(null);
    load();
  }

  const active  = (members ?? []).filter(m => !m.removed_at);
  const removed = (members ?? []).filter(m =>  m.removed_at);
  const staffMembers = active.filter(m => m.role === 'staff');
  const athletes = active.filter(m => m.role === 'athlete');

  // A club must always keep at least one manager, so the last one cannot step down.
  // Enforced in set_club_manager; mirrored here so the UI never offers an action that
  // is guaranteed to fail.
  const managerCount = active.filter(m => m.is_club_manager).length;

  return (
    <div style={{ padding: '36px 40px', maxWidth: 860, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <div className="t-label" style={{ marginBottom: 6 }}>Dashboard</div>
        <h1 className="t-display" style={{ color: 'var(--text-primary)', margin: 0 }}>Club</h1>
      </div>

      <ClubDetails
        clubId={clubId}
        clubName={clubName}
        clubColor={clubColor}
        canEdit={isClubManager}
        onSaved={onClubUpdated}
      />

      {members === null ? (
        <div className="t-small" style={{ color: 'var(--text-tertiary)', padding: '24px 0' }}>
          Loading…
        </div>
      ) : (
        <>
          {inviteCode && (
            <InvitePeople
              athleteCode={inviteCode}
              staffCode={staffInviteCode}
              clubName={clubName}
              noAthletesYet={athletes.length === 0}
            />
          )}

          <PeopleSection
            title="Staff"
            count={staffMembers.length}
            members={staffMembers}
            selfId={staffId}
            isClubManager={isClubManager}
            managerCount={managerCount}
            onAction={setConfirm}
          />
          <PeopleSection
            title="Athletes"
            count={athletes.length}
            members={athletes}
            selfId={staffId}
            isClubManager={isClubManager}
            managerCount={managerCount}
            onAction={setConfirm}
            emptyText="Nobody has joined yet. Use Add athletes above to share your code."
          />
          {removed.length > 0 && (
            <PeopleSection
              title="No longer in the club"
              count={removed.length}
              members={removed}
              selfId={staffId}
              isClubManager={isClubManager}
              managerCount={managerCount}
              onAction={setConfirm}
            />
          )}
        </>
      )}

      {confirm && (
        <ConfirmDialog
          confirm={confirm}
          busy={busy}
          error={error}
          onCancel={() => { setConfirm(null); setError(''); }}
          onConfirm={() => run(confirm)}
        />
      )}
    </div>
  );
}

/* ── Club details ─────────────────────────────────────────────────── */
function ClubDetails({ clubId, clubName, clubColor, canEdit, onSaved }: {
  clubId: string; clubName: string; clubColor: string; canEdit: boolean;
  onSaved: (name: string, color: string) => void;
}) {
  const supabase = createClient();
  const [name,   setName]   = useState(clubName);
  const [color,  setColor]  = useState(clubColor);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState('');

  const dirty = name.trim() !== clubName || color !== clubColor;

  // Clubs created before the curated palette may hold a colour that is no longer offered.
  // Show it as an extra swatch so their current choice still reads as selected.
  const swatches = CLUB_COLORS.some(c => c.hex.toLowerCase() === clubColor.toLowerCase())
    ? CLUB_COLORS
    : [{ name: 'Current colour', hex: clubColor }, ...CLUB_COLORS];

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2200);
    return () => clearTimeout(t);
  }, [saved]);

  async function save() {
    if (!name.trim()) { setError('Your club needs a name.'); return; }
    setSaving(true); setError('');
    const { error: err } = await supabase
      .from('clubs')
      .update({ name: name.trim(), primary_color: color })
      .eq('id', clubId);
    setSaving(false);
    if (err) { setError('Could not save. Please try again.'); return; }
    setSaved(true);
    // Hand the new values up so the sidebar and accent colour update immediately.
    // Reloading here would reset the dashboard tab and bounce you back to Overview.
    onSaved(name.trim(), color);
  }

  return (
    <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: '22px 24px', marginBottom: 28 }}>
      <div className="t-label" style={{ marginBottom: 18 }}>Club details</div>

      {!canEdit ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 'var(--radius-sm)', flexShrink: 0,
            background: 'var(--accent-subtle)', border: '1px solid var(--accent-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, color: clubColor,
          }}>
            {clubName[0]?.toUpperCase()}
          </div>
          <div>
            <div className="t-body-medium" style={{ color: 'var(--text-primary)' }}>{clubName}</div>
            <div className="t-small" style={{ color: 'var(--text-tertiary)', marginTop: 2 }}>
              Only a club manager can change these.
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>Club name</label>
            <input
              className="input"
              value={name}
              onChange={e => setName(e.target.value)}
              style={{ maxWidth: 340 }}
            />
          </div>

          <div>
            <label className="t-label" style={{ display: 'block', marginBottom: 10 }}>Club colour</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
              {swatches.map(c => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setColor(c.hex)}
                  title={c.name}
                  aria-label={c.name}
                  style={{
                    width: 30, height: 30, borderRadius: '50%', background: c.hex,
                    border: 'none', cursor: 'pointer',
                    outline: color === c.hex ? '2px solid rgba(255,255,255,0.85)' : '2px solid transparent',
                    outlineOffset: 2,
                    transform: color === c.hex ? 'scale(1.12)' : 'scale(1)',
                    transition: 'transform 0.12s, outline-color 0.12s',
                  }}
                />
              ))}
            </div>
          </div>

          {error && <div className="t-small" style={{ color: 'var(--color-danger)' }}>{error}</div>}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={save} disabled={!dirty || saving} className="btn-primary"
              style={{ opacity: dirty ? 1 : 0.45, cursor: dirty ? 'pointer' : 'not-allowed' }}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            {saved && (
              <span className="t-small" style={{ color: 'var(--color-success)' }}>Saved</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── People ───────────────────────────────────────────────────────── */
function PeopleSection({
  title, count, members, selfId, isClubManager, managerCount, onAction, emptyText,
}: {
  title:         string;
  count:         number;
  members:       Member[];
  selfId:        string;
  isClubManager: boolean;
  managerCount:  number;
  onAction:      (c: Confirm) => void;
  emptyText?:    string;
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div className="t-label" style={{ marginBottom: 12 }}>{title} · {count}</div>

      {members.length === 0 ? (
        <div className="glass t-small" style={{
          borderRadius: 'var(--radius-md)', padding: '18px 16px',
          color: 'var(--text-tertiary)', textAlign: 'center',
        }}>
          {emptyText ?? 'Nobody here.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {members.map(m => (
            <MemberRow
              key={m.id}
              member={m}
              isSelf={m.id === selfId}
              isClubManager={isClubManager}
              managerCount={managerCount}
              onAction={onAction}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MemberRow({ member, isSelf, isClubManager, managerCount, onAction }: {
  member:        Member;
  isSelf:        boolean;
  isClubManager: boolean;
  managerCount:  number;
  onAction:      (c: Confirm) => void;
}) {
  const isRemoved = !!member.removed_at;
  const isStaff   = member.role === 'staff';

  // The club's only manager cannot step down or be removed — someone has to be able to
  // manage it. set_club_manager / remove_club_member reject both; this keeps the buttons
  // from being offered in the first place.
  const isLastManager = member.is_club_manager && !isRemoved && managerCount <= 1;

  // Mirrors the database rules: coaches are manager-only, athletes are any staff.
  const mayRemove  = !isRemoved && !isSelf && !isLastManager && (isStaff ? isClubManager : true);
  const mayRestore =  isRemoved && (isStaff ? isClubManager : true);
  const mayToggle  = !isRemoved && isStaff && isClubManager && !isLastManager;

  return (
    <div className="glass" style={{
      borderRadius: 'var(--radius-md)', padding: '11px 14px',
      display: 'flex', alignItems: 'center', gap: 12,
      opacity: isRemoved ? 0.55 : 1,
    }}>
      <AvatarCircle name={member.full_name} size={32} />

      <div style={{ minWidth: 0 }}>
        <div className="t-body-medium" style={{ color: 'var(--text-primary)' }}>
          {member.full_name}
        </div>
        <div className="t-small" style={{ color: 'var(--text-tertiary)', marginTop: 1 }}>
          {isStaff ? 'Staff' : 'Athlete'} · {member.language.toUpperCase()}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginLeft: 10, flexWrap: 'wrap' }}>
        {member.is_club_manager && !isRemoved && (
          <span className="badge badge-info">Club manager</span>
        )}
        {isSelf   && <span className="badge">You</span>}
        {isRemoved && <span className="badge badge-danger">Removed</span>}
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
        {isLastManager && isClubManager && (
          <span className="t-small" style={{ color: 'var(--text-tertiary)', textAlign: 'right' }}>
            Make another staff member a manager to change this
          </span>
        )}
        {mayToggle && (
          <button
            className="btn-ghost"
            style={{ padding: '5px 10px', fontSize: 12 }}
            onClick={() => onAction({
              kind: member.is_club_manager ? 'demote' : 'promote',
              member,
            })}
          >
            {member.is_club_manager ? 'Remove manager role' : 'Make manager'}
          </button>
        )}
        {mayRemove && (
          <button
            className="btn-ghost"
            style={{
              padding: '5px 10px', fontSize: 12,
              color: 'var(--color-danger)', borderColor: 'var(--color-danger-border)',
            }}
            onClick={() => onAction({ kind: 'remove', member })}
          >
            Remove
          </button>
        )}
        {mayRestore && (
          <button
            className="btn-ghost"
            style={{ padding: '5px 10px', fontSize: 12 }}
            onClick={() => onAction({ kind: 'restore', member })}
          >
            Add back
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Confirmation ─────────────────────────────────────────────────── */
function ConfirmDialog({ confirm, busy, error, onCancel, onConfirm }: {
  confirm:   Confirm;
  busy:      boolean;
  error:     string;
  onCancel:  () => void;
  onConfirm: () => void;
}) {
  const { kind, member } = confirm;
  const who     = member.full_name;
  const isStaffMember = member.role === 'staff';

  const copy: Record<Confirm['kind'], { title: string; body: React.ReactNode; cta: string; danger: boolean }> = {
    remove: {
      title: `Remove ${who}?`,
      body: (
        <>
          <p style={{ margin: '0 0 10px' }}>
            {who} loses access to Athlink straight away and drops off your {isStaffMember ? 'staff list' : 'squad'}.
          </p>
          <p style={{ margin: 0 }}>
            Nothing is deleted. {isStaffMember
              ? 'Feedback and tasks they created stay exactly where they are.'
              : 'Their feedback, tasks and history stay in the club records.'} You can add
            them back at any time.
          </p>
        </>
      ),
      cta: 'Remove from club',
      danger: true,
    },
    restore: {
      title: `Add ${who} back?`,
      body: <p style={{ margin: 0 }}>They get access again as {isStaffMember ? 'a staff member' : 'an athlete'}, exactly as before.</p>,
      cta: 'Add back',
      danger: false,
    },
    promote: {
      title: `Make ${who} a club manager?`,
      body: (
        <>
          <p style={{ margin: '0 0 10px' }}>
            Club managers can edit the club, remove staff, and decide who else manages the club.
          </p>
          <p style={{ margin: 0 }}>That includes being able to remove you.</p>
        </>
      ),
      cta: 'Make club manager',
      danger: false,
    },
    demote: {
      title: `Remove ${who}’s manager role?`,
      body: <p style={{ margin: 0 }}>They stay staff and keep working with athletes, but can no longer edit the club or remove other staff.</p>,
      cta: 'Remove manager role',
      danger: true,
    },
  };

  const { title, body, cta, danger } = copy[kind];

  return (
    <div
      onMouseDown={e => { if (e.target === e.currentTarget) onCancel(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div style={{
        width: 460, borderRadius: 'var(--radius-xl)',
        background: 'var(--bg-base)', border: '1px solid var(--border-default)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)', padding: 24,
      }}>
        <div className="t-subheading" style={{ color: 'var(--text-primary)', marginBottom: 12 }}>
          {title}
        </div>
        <div className="t-small" style={{ color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 22 }}>
          {body}
        </div>

        {error && (
          <div style={{
            padding: '10px 12px', marginBottom: 16,
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-danger-subtle)', border: '1px solid var(--color-danger-border)',
          }}>
            <div className="t-small" style={{ color: 'var(--color-danger)' }}>{error}</div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} className="btn-ghost">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="btn-primary"
            style={danger ? {
              background: 'var(--color-danger)',
              borderColor: 'var(--color-danger-border)',
              boxShadow: 'none',
            } : undefined}
          >
            {busy ? 'Working…' : cta}
          </button>
        </div>
      </div>
    </div>
  );
}
