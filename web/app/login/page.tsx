'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

// S-chain mark — two interlocked U shapes, warm→cool gradient with subtle blue tint.
// Path: M 16 98 L 16 28 A 18 18 0 0 1 52 28 L 52 80 A 18 18 0 0 0 88 80 L 88 38
function AthlinkMark({ size = 44 }: { size?: number }) {
  const h  = Math.round(size * (110 / 104));
  const sw = Math.round((size / 104) * 16);
  return (
    <svg width={size} height={h} viewBox="0 0 104 110" fill="none">
      <defs>
        <linearGradient id="lmg" x1="0" y1="0" x2="0" y2="110" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#F4F1ED" />
          <stop offset="100%" stopColor="#ECE9F5" />
        </linearGradient>
        <linearGradient id="ltg" x1="0" y1="0" x2="0" y2="110" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#ECE9F5" stopOpacity={0} />
          <stop offset="100%" stopColor="#ECE9F5" stopOpacity={0.5} />
        </linearGradient>
      </defs>
      <path d="M 16 98 L 16 28 A 18 18 0 0 1 52 28 L 52 80 A 18 18 0 0 0 88 80 L 88 38"
        stroke="url(#lmg)" strokeWidth={sw} strokeLinecap="square" strokeLinejoin="round" />
      <path d="M 16 98 L 16 28 A 18 18 0 0 1 52 28 L 52 80 A 18 18 0 0 0 88 80 L 88 38"
        stroke="url(#ltg)" strokeWidth={sw} strokeLinecap="square" strokeLinejoin="round" />
    </svg>
  );
}

export default function LoginPage() {
  const router   = useRouter();
  const supabase = createClient();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: err } = await supabase.auth.signInWithPassword({ email, password });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-base)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Neutral orbs — no club color on logged-out screen */}
      <div className="orb-top-neutral" />
      <div className="orb-bottom-neutral" />

      <div style={{ width: '100%', maxWidth: 380, padding: '0 20px', position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <AthlinkMark size={44} />
          </div>
          <div className="t-display" style={{ color: 'var(--text-primary)', letterSpacing: '0.12em', fontSize: 20 }}>
            ATHLINK
          </div>
          <div className="t-small" style={{ color: 'var(--text-tertiary)', marginTop: 4 }}>
            Staff dashboard
          </div>
        </div>

        {/* Card */}
        <div className="glass" style={{ borderRadius: 'var(--radius-xl)', padding: '28px 24px' }}>
          <form onSubmit={signIn} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>Email</label>
              <input
                className="input input-neutral"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="coach@yourclub.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>Password</label>
              <input
                className="input input-neutral"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="t-small" style={{ color: 'var(--color-danger)', textAlign: 'center' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary-neutral"
              disabled={loading}
              style={{ marginTop: 4, width: '100%', padding: '13px 18px', fontSize: 15, fontWeight: 700 }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <div className="t-small" style={{ textAlign: 'center', color: 'var(--text-tertiary)', marginTop: 20 }}>
          No account?{' '}
          <Link href="/signup" style={{ color: 'rgba(244,241,237,0.72)', textDecoration: 'none', fontWeight: 600 }}>
            Create your club →
          </Link>
        </div>
      </div>
    </div>
  );
}
