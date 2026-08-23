'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AvatarCircle } from '../athletes/AthletesClient';

/**
 * The signed-in user's own profile.
 *
 * Reached from the profile block at the bottom of the sidebar, not from the nav list —
 * it is about you, not about the club, so it does not belong beside Athletes and Calendar.
 *
 * Only `full_name` and `language` are editable, and that is not a UI choice: `authenticated`
 * holds column-level UPDATE on `full_name, avatar_url, language, push_token` only. Role,
 * club and manager status are shown as facts because the database will not let them be
 * changed from here.
 */

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'no', label: 'Norsk'   },
];

export default function ProfileTab({
  profileId, fullName, email, role, isClubManager, language, joinedAt, clubName, onNameChanged,
}: {
  profileId:      string;
  fullName:       string;
  email:          string;
  role:           string;
  isClubManager:  boolean;
  language:       string;
  joinedAt:       string;
  clubName:       string;
  onNameChanged:  (name: string) => void;
}) {
  const supabase = createClient();

  const [name,   setName]   = useState(fullName);
  const [lang,   setLang]   = useState(language || 'en');
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState('');

  // What is currently in the database. The props are the values at page load and never
  // change again, so comparing against them would leave the page looking unsaved after
  // a successful save.
  const [stored, setStored] = useState({ name: fullName, lang: language || 'en' });

  const dirty = name.trim() !== stored.name || lang !== stored.lang;

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2200);
    return () => clearTimeout(t);
  }, [saved]);

  async function save() {
    if (!name.trim()) { setError('Your name cannot be empty.'); return; }
    setSaving(true); setError('');

    const { error: err } = await supabase
      .from('profiles')
      .update({ full_name: name.trim(), language: lang })
      .eq('id', profileId);

    setSaving(false);
    if (err) { setError('Could not save. Please try again.'); return; }

    setStored({ name: name.trim(), lang });
    setSaved(true);
    // Hand the name up so the sidebar updates straight away. A reload would work but
    // would knock you back to Overview.
    onNameChanged(name.trim());
  }

  const accessLabel = isClubManager ? 'Club manager' : role === 'staff' ? 'Staff' : 'Athlete';

  return (
    <div style={{ padding: '36px 40px', maxWidth: 860, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <div className="t-label" style={{ marginBottom: 6 }}>Dashboard</div>
        <h1 className="t-display" style={{ color: 'var(--text-primary)', margin: 0 }}>Your profile</h1>
      </div>

      {/* Identity */}
      <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <AvatarCircle name={fullName} size={64} />
          <div style={{ minWidth: 0 }}>
            <div className="t-heading" style={{ color: 'var(--text-primary)' }}>{fullName}</div>
            <div className="t-small" style={{ color: 'var(--text-secondary)', marginTop: 4, wordBreak: 'break-all' }}>
              {email}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              <span className="badge">{role === 'staff' ? 'Staff' : 'Athlete'}</span>
              {isClubManager && <span className="badge badge-info">Club manager</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Editable */}
      <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: '22px 24px', marginBottom: 24 }}>
        <div className="t-label" style={{ marginBottom: 18 }}>Your details</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>Name</label>
            <input
              className="input"
              value={name}
              onChange={e => setName(e.target.value)}
              style={{ maxWidth: 340 }}
            />
            <div className="t-small" style={{ color: 'var(--text-tertiary)', marginTop: 6 }}>
              This is the name your athletes see on feedback and tasks.
            </div>
          </div>

          <div>
            <label className="t-label" style={{ display: 'block', marginBottom: 8 }}>Language</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {LANGUAGES.map(l => {
                const on = lang === l.code;
                return (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => setLang(l.code)}
                    className="btn-ghost"
                    style={{
                      padding: '8px 16px',
                      ...(on ? {
                        background:  'var(--accent-subtle)',
                        borderColor: 'var(--accent-border)',
                        color:       'var(--accent)',
                      } : {}),
                    }}
                  >
                    {l.label}
                  </button>
                );
              })}
            </div>
            <div className="t-small" style={{ color: 'var(--text-tertiary)', marginTop: 8 }}>
              Used in the Athlink app on your phone. This dashboard is English only for now.
            </div>
          </div>

          {error && <div className="t-small" style={{ color: 'var(--color-danger)' }}>{error}</div>}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={save}
              disabled={!dirty || saving}
              className="btn-primary"
              style={{ opacity: dirty ? 1 : 0.45, cursor: dirty ? 'pointer' : 'not-allowed' }}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            {saved && <span className="t-small" style={{ color: 'var(--color-success)' }}>Saved</span>}
          </div>
        </div>
      </div>

      {/* Facts */}
      <div className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: '22px 24px' }}>
        <div className="t-label">Account</div>

        <Row label="Email" value={email} note="You sign in with this. Get in touch if you need it changed." />
        <Row label="Club"  value={clubName} />
        <Row
          label="Access"
          value={accessLabel}
          note={isClubManager
            ? 'You can rename the club, change its colour, and add or remove staff.'
            : role === 'staff'
              ? 'A club manager can give you full club access.'
              : undefined}
        />
        <Row
          label="Joined"
          value={new Date(joinedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          last
        />
      </div>
    </div>
  );
}

function Row({ label, value, note, last }: { label: string; value: string; note?: string; last?: boolean }) {
  return (
    <div style={{
      display: 'flex', gap: 16, padding: '14px 0',
      borderBottom: last ? 'none' : '1px solid var(--border-subtle)',
      alignItems: 'baseline',
    }}>
      <div className="t-small" style={{ color: 'var(--text-tertiary)', width: 92, flexShrink: 0 }}>
        {label}
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="t-body-medium" style={{ color: 'var(--text-primary)', wordBreak: 'break-all' }}>
          {value}
        </div>
        {note && (
          <div className="t-small" style={{ color: 'var(--text-tertiary)', marginTop: 3 }}>{note}</div>
        )}
      </div>
    </div>
  );
}
