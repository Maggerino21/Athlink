'use client';

import { createClient } from '@/lib/supabase/client';

/**
 * Shown when a signed-in user reaches the dashboard without the staff role.
 *
 * This must NOT redirect to /login: proxy.ts bounces any signed-in user from /login back
 * to /dashboard, so redirecting here produces an infinite loop. Signing out is the only
 * exit that actually resolves the state.
 */
export default function NotStaffNotice({ fullName }: { fullName: string }) {
  const supabase = createClient();

  async function signOut() {
    await supabase.auth.signOut();
    window.location.replace('/login');
  }

  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 40, position: 'relative', zIndex: 10,
    }}>
      <div className="glass" style={{
        borderRadius: 'var(--radius-xl)', padding: '36px 32px',
        maxWidth: 420, textAlign: 'center',
      }}>
        <div className="t-label" style={{ marginBottom: 10 }}>Staff dashboard</div>
        <h1 className="t-heading" style={{ color: 'var(--text-primary)', margin: '0 0 12px' }}>
          This area is for coaches
        </h1>
        <p className="t-body" style={{ color: 'var(--text-secondary)', margin: '0 0 24px' }}>
          You&rsquo;re signed in as <strong style={{ color: 'var(--text-primary)' }}>{fullName}</strong>,
          which is an athlete account. Athletes use the Athlink mobile app — everything for you
          lives there.
        </p>
        <button onClick={signOut} className="btn-ghost">Sign out</button>
      </div>
    </div>
  );
}
