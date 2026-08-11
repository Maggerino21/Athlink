'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

function AthlinkMark({ size = 44, color }: { size?: number; color?: string }) {
  const h  = Math.round(size * (110 / 104));
  const sw = Math.round((size / 104) * 16);
  const stroke = color ?? 'url(#smg)';
  return (
    <svg width={size} height={h} viewBox="0 0 104 110" fill="none">
      <defs>
        <linearGradient id="smg" x1="0" y1="0" x2="0" y2="110" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#F4F1ED" />
          <stop offset="100%" stopColor="#ECE9F5" />
        </linearGradient>
      </defs>
      <path
        d="M 16 98 L 16 28 A 18 18 0 0 1 52 28 L 52 80 A 18 18 0 0 0 88 80 L 88 38"
        stroke={stroke}
        strokeWidth={sw}
        strokeLinecap="square"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const CLUB_COLORS = [
  '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7',
  '#EC4899', '#F43F5E', '#EF4444', '#F97316',
  '#EAB308', '#22C55E', '#14B8A6', '#06B6D4',
];

type Step = 'form' | 'done';
type Mode = 'create' | 'join';

export default function SignupPage() {
  const router   = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>('form');
  const [mode, setMode] = useState<Mode>('create');

  const [fullName,   setFullName]   = useState('');
  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [clubName,   setClubName]   = useState('');
  const [clubColor,  setClubColor]  = useState('#6366F1');
  const [inviteCode, setInviteCode] = useState('');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim())    { setError('Full name is required.');          return; }
    if (!email.trim())       { setError('Email is required.');              return; }
    if (password.length < 6) { setError('Password must be 6+ characters.'); return; }
    if (mode === 'create' && !clubName.trim())   { setError('Club name is required.');   return; }
    if (mode === 'join'   && !inviteCode.trim()) { setError('Invite code is required.'); return; }

    setError('');
    setLoading(true);

    // Note: `role` is deliberately NOT sent. The handle_new_user trigger derives it —
    // creating a club makes you staff; joining takes the role implied by which code
    // matched. Anything sent from here would be client-controlled and untrusted.
    const metadata = mode === 'create'
      ? {
          full_name:     fullName.trim(),
          language:      'en',
          club_name:     clubName.trim(),
          primary_color: clubColor,
        }
      : {
          full_name:   fullName.trim(),
          language:    'en',
          invite_code: inviteCode.trim().toUpperCase(),
        };

    const { data, error: err } = await supabase.auth.signUp({
      email:    email.trim(),
      password,
      options: {
        data: metadata,
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    setLoading(false);

    if (err) {
      // The trigger raises on a code that matches no club, which surfaces here as an
      // opaque database error — worth translating for the common case.
      setError(
        mode === 'join' && /database|unexpected/i.test(err.message)
          ? 'That invite code doesn’t match any club. Check it and try again.'
          : err.message
      );
      return;
    }
    if (data.session) { router.push('/dashboard'); return; }
    setStep('done');
  };

  if (step === 'done') {
    return (
      <PageShell>
        <div className="glass" style={{ borderRadius: 'var(--radius-xl)', padding: '48px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 20 }}>✉️</div>
          <h2 className="t-heading" style={{ color: 'var(--text-primary)', marginBottom: 12 }}>Check your email</h2>
          <p className="t-body" style={{ color: 'var(--text-secondary)', maxWidth: 320, margin: '0 auto 32px' }}>
            We sent a confirmation link to <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>.
            Click it to activate your account and access your dashboard.
          </p>
          <Link href="/login" className="btn-primary-neutral" style={{ textDecoration: 'none', display: 'inline-flex' }}>
            Back to sign in
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <form onSubmit={handleSubmit} noValidate>

        {/* ── Mode switch ─────────────────────────────────────── */}
        <div style={{
          display: 'flex', gap: 4, padding: 4, marginBottom: 14,
          background: 'var(--surface-1)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
        }}>
          {([
            { key: 'create' as Mode, label: 'Create a club' },
            { key: 'join'   as Mode, label: 'Join a club' },
          ]).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => { setMode(key); setError(''); }}
              style={{
                flex: 1, padding: '9px 12px', borderRadius: 'var(--radius-sm)',
                fontSize: 13, fontWeight: mode === key ? 700 : 500, fontFamily: 'inherit',
                cursor: 'pointer', border: 'none',
                background: mode === key ? 'var(--surface-3)' : 'transparent',
                color: mode === key ? 'var(--text-primary)' : 'var(--text-secondary)',
                transition: 'background 0.12s, color 0.12s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Account section ─────────────────────────────────── */}
        <div className="glass" style={{ borderRadius: 'var(--radius-xl)', padding: '28px 28px 24px', marginBottom: 14 }}>
          <div className="t-label" style={{ marginBottom: 18 }}>Your account</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Full name">
              <input
                className="input input-neutral"
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Alex Johnson"
                autoComplete="name"
                required
              />
            </Field>

            <Field label="Email">
              <input
                className="input input-neutral"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="coach@yourclub.com"
                autoComplete="email"
                required
              />
            </Field>

            <Field label="Password">
              <input
                className="input input-neutral"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
                autoComplete="new-password"
                required
              />
            </Field>
          </div>
        </div>

        {/* ── Join an existing club ────────────────────────────── */}
        {mode === 'join' && (
          <div className="glass" style={{ borderRadius: 'var(--radius-xl)', padding: '28px 28px 24px', marginBottom: 14 }}>
            <div className="t-label" style={{ marginBottom: 18 }}>Join a club</div>

            <Field label="Invite code">
              <input
                className="input input-neutral"
                type="text"
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value.toUpperCase())}
                placeholder="6-character code"
                autoCapitalize="characters"
                autoComplete="off"
                maxLength={6}
                style={{ letterSpacing: '0.18em', fontWeight: 700 }}
                required
              />
            </Field>

            <div className="t-small" style={{ color: 'var(--text-tertiary)', marginTop: 12, lineHeight: 1.6 }}>
              Ask a coach at your club for the{' '}
              <strong style={{ color: 'var(--text-secondary)' }}>staff code</strong>{' '}
              &mdash; they&rsquo;ll find it on their dashboard. Your role is set by the code
              you use, so an athlete code will not grant dashboard access.
            </div>
          </div>
        )}

        {/* ── Club section ─────────────────────────────────────── */}
        {mode === 'create' && (
        <div className="glass" style={{ borderRadius: 'var(--radius-xl)', padding: '28px 28px 24px', marginBottom: 14 }}>
          <div className="t-label" style={{ marginBottom: 18 }}>Your club</div>

          <Field label="Club name" style={{ marginBottom: 22 }}>
            <input
              className="input input-neutral"
              type="text"
              value={clubName}
              onChange={e => setClubName(e.target.value)}
              placeholder="FC United, Lyn, Arsenal…"
              autoComplete="organization"
              required
            />
          </Field>

          <div className="t-label" style={{ marginBottom: 14 }}>Club colour</div>

          {/* Swatches */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
            {CLUB_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setClubColor(c)}
                style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: c, border: 'none',
                  outline: clubColor === c ? `2px solid rgba(255,255,255,0.8)` : '2px solid transparent',
                  outlineOffset: 2,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'outline-color 0.12s, transform 0.12s',
                  transform: clubColor === c ? 'scale(1.15)' : 'scale(1)',
                  boxShadow: clubColor === c ? `0 0 12px ${c}80` : 'none',
                }}
                aria-label={c}
              >
                {clubColor === c && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          {/* Club badge preview */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '14px 16px',
            borderRadius: 'var(--radius-md)',
            background: `rgba(${hexToRgb(clubColor)}, 0.06)`,
            border: `1px solid rgba(${hexToRgb(clubColor)}, 0.20)`,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 'var(--radius-sm)', flexShrink: 0,
              background: `rgba(${hexToRgb(clubColor)}, 0.14)`,
              border: `1px solid rgba(${hexToRgb(clubColor)}, 0.30)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 800, color: clubColor,
            }}>
              {clubName.trim()[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <div className="t-body-medium" style={{ color: 'var(--text-primary)' }}>
                {clubName.trim() || 'Your club name'}
              </div>
              <div className="t-small" style={{ color: 'var(--text-tertiary)', marginTop: 2 }}>Staff dashboard</div>
            </div>
            <div style={{ marginLeft: 'auto', opacity: 0.55 }}>
              <AthlinkMark size={24} color={clubColor} />
            </div>
          </div>
        </div>
        )}

        {/* ── Error + submit ───────────────────────────────────── */}
        {error && (
          <div className="t-small" style={{ color: 'var(--color-danger)', textAlign: 'center', marginBottom: 12 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          className="btn-primary-neutral"
          disabled={loading}
          style={{ width: '100%', padding: '14px 18px', fontSize: 15, fontWeight: 700 }}
        >
          {loading
            ? (mode === 'create' ? 'Creating your club…' : 'Joining…')
            : (mode === 'create' ? 'Create club & sign up' : 'Join club')}
        </button>

        <div className="t-small" style={{ textAlign: 'center', color: 'var(--text-tertiary)', marginTop: 20 }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--neutral-accent)', textDecoration: 'none', fontWeight: 600 }}>
            Sign in
          </Link>
        </div>

      </form>
    </PageShell>
  );
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={style}>
      <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingBottom: 48,
    }}>
      <div className="orb-top-neutral" />
      <div className="orb-bottom-neutral" />

      <div style={{ width: '100%', maxWidth: 460, padding: '0 20px', position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', padding: '48px 0 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <AthlinkMark size={36} />
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '0.12em', color: 'rgba(244,241,237,0.92)' }}>
            ATHLINK
          </div>
          <div className="t-small" style={{ color: 'var(--text-tertiary)', marginTop: 6 }}>
            Set up your club in 60 seconds
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}

function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}
