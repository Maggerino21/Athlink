'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { CLUB_COLORS } from '@/lib/clubTheme';
import { suggestColorsFromBadge } from '@/lib/badgeColor';

/* ── Types ──────────────────────────────────────────────────────────── */
type Mode = 'create' | 'join';

/** Club creation is a wizard so the club comes together before we ask for a password. */
type Step = 'sport' | 'team' | 'review' | 'manual' | 'account';

type Sport = { key: string; label: string; hasFixtures: boolean; icon: React.FC };

type ApiTeam = {
  id: number;
  name: string;
  country: string | null;
  founded: number | null;
  /** Provider-supplied; women's sides identify themselves rather than being guessed
   *  from the name, which the previous provider forced us to do. */
  gender: string | null;
  logo: string | null;
};

type Fixture = {
  id: number;
  date: string;
  opponent: string;
  isHome: boolean;
  venue: string | null;
  league: string | null;
};

/* ── Sports ─────────────────────────────────────────────────────────── */
// Only football has a fixture provider wired up. The others exist so the flow reads as
// tailored rather than football-only, and they route straight to manual setup.
const SPORTS: Sport[] = [
  { key: 'football',   label: 'Football',   hasFixtures: true,  icon: FootballIcon },
  { key: 'handball',   label: 'Handball',   hasFixtures: false, icon: HandballIcon },
  { key: 'basketball', label: 'Basketball', hasFixtures: false, icon: BasketballIcon },
  { key: 'icehockey',  label: 'Ice hockey', hasFixtures: false, icon: HockeyIcon },
  { key: 'volleyball', label: 'Volleyball', hasFixtures: false, icon: VolleyballIcon },
  { key: 'other',      label: 'Other',      hasFixtures: false, icon: OtherSportIcon },
];

/* ══ Page ═══════════════════════════════════════════════════════════ */
export default function SignupPage() {
  const router   = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>('create');
  const [step, setStep] = useState<Step>('sport');
  const [done, setDone] = useState(false);

  // Club
  const [sport,      setSport]      = useState<Sport>(SPORTS[0]);
  const [clubName,   setClubName]   = useState('');
  const [clubColor,  setClubColor]  = useState('#3B82F6');
  const [team,       setTeam]       = useState<ApiTeam | null>(null);
  const [suggested,  setSuggested]  = useState<{ name: string; hex: string }[]>([]);

  // Account
  const [fullName,   setFullName]   = useState('');
  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const reset = () => { setTeam(null); setSuggested([]); setError(''); };

  /* ── Submit — one signUp call carries the whole club ─────────────── */
  async function submit() {
    if (!fullName.trim())    { setError('Full name is required.');          return; }
    if (!email.trim())       { setError('Email is required.');              return; }
    if (password.length < 6) { setError('Password must be 6+ characters.'); return; }

    setError(''); setLoading(true);

    // `role` is deliberately never sent — handle_new_user derives it. Creating a club
    // makes you staff and club manager; joining takes the role of the matched code.
    const metadata: Record<string, string> = mode === 'join'
      ? { full_name: fullName.trim(), language: 'en', invite_code: inviteCode.trim().toUpperCase() }
      : {
          full_name:     fullName.trim(),
          language:      'en',
          club_name:     clubName.trim(),
          primary_color: clubColor,
          sport:         sport.key,
          ...(team ? {
            external_team_id:   String(team.id),
            external_team_name: team.name,
            ...(team.logo ? { external_badge_url: team.logo } : {}),
          } : {}),
        };

    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: metadata, emailRedirectTo: `${window.location.origin}/dashboard` },
    });

    setLoading(false);

    if (err) {
      setError(
        mode === 'join' && /database|unexpected/i.test(err.message)
          ? 'That invite code doesn’t match any club. Check it and try again.'
          : err.message,
      );
      return;
    }
    if (data.session) { router.push('/dashboard'); return; }
    setDone(true);
  }

  /* ── Confirmation ────────────────────────────────────────────────── */
  if (done) {
    return (
      <Shell subtitle="Almost there">
        <div className="glass" style={{ borderRadius: 'var(--radius-xl)', padding: '48px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 20 }}>✉️</div>
          <h2 className="t-heading" style={{ color: 'var(--text-primary)', marginBottom: 12 }}>Check your email</h2>
          <p className="t-body" style={{ color: 'var(--text-secondary)', maxWidth: 320, margin: '0 auto 32px' }}>
            We sent a confirmation link to <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>.
            Click it to activate your account.
          </p>
          <Link href="/login" className="btn-primary-neutral" style={{ textDecoration: 'none', display: 'inline-flex' }}>
            Back to sign in
          </Link>
        </div>
      </Shell>
    );
  }

  /* ── Join an existing club — single short form ───────────────────── */
  if (mode === 'join') {
    return (
      <Shell subtitle="Join your club">
        <ModeSwitch mode={mode} onChange={m => { setMode(m); setError(''); }} />
        <Card label="Join a club">
          <Field label="Invite code">
            <input
              className="input input-neutral" value={inviteCode}
              onChange={e => setInviteCode(e.target.value.toUpperCase())}
              placeholder="6-character code" maxLength={6} autoComplete="off"
              style={{ letterSpacing: '0.18em', fontWeight: 700 }}
            />
          </Field>
          <p className="t-small" style={{ color: 'var(--text-tertiary)', marginTop: 12, lineHeight: 1.6 }}>
            Ask someone at your club for the{' '}
            <strong style={{ color: 'var(--text-secondary)' }}>staff code</strong>{' '}
            &mdash; they&rsquo;ll find it on their dashboard. Your role is set by the code you
            use, so an athlete code will not grant dashboard access.
          </p>
        </Card>
        <AccountFields
          fullName={fullName} setFullName={setFullName}
          email={email} setEmail={setEmail}
          password={password} setPassword={setPassword}
        />
        {error && <ErrorLine msg={error} />}
        <button onClick={submit} disabled={loading} className="btn-primary-neutral"
          style={{ width: '100%', padding: '14px 18px', fontSize: 15, fontWeight: 700 }}>
          {loading ? 'Joining…' : 'Join club'}
        </button>
        <SignInLink />
      </Shell>
    );
  }

  /* ── Create a club — wizard ──────────────────────────────────────── */
  const stepIndex = ['sport', 'team', 'review', 'manual', 'account'].indexOf(step);

  return (
    <Shell subtitle="Set up your club">
      {step === 'sport' && <ModeSwitch mode={mode} onChange={m => { setMode(m); setError(''); }} />}

      <Progress current={step} />

      {step === 'sport' && (
        <SportStep
          selected={sport}
          onSelect={s => {
            setSport(s);
            reset();
            setStep(s.hasFixtures ? 'team' : 'manual');
          }}
        />
      )}

      {step === 'team' && (
        <TeamStep
          clubName={clubName}
          setClubName={setClubName}
          onBack={() => setStep('sport')}
          onPick={async (t) => {
            setTeam(t);
            setClubName(t.name);
            setStep('review');
            const s = t.logo ? await suggestColorsFromBadge(t.logo) : [];
            setSuggested(s);
            if (s.length) setClubColor(s[0].hex);
          }}
          onManual={() => { reset(); setStep('manual'); }}
        />
      )}

      {step === 'review' && team && (
        <ReviewStep
          team={team}
          clubName={clubName}
          setClubName={setClubName}
          color={clubColor}
          setColor={setClubColor}
          suggested={suggested}
          onBack={() => { reset(); setStep('team'); }}
          onNext={() => setStep('account')}
        />
      )}

      {step === 'manual' && (
        <ManualStep
          sport={sport}
          clubName={clubName}
          setClubName={setClubName}
          color={clubColor}
          setColor={setClubColor}
          onBack={() => setStep(sport.hasFixtures ? 'team' : 'sport')}
          onNext={() => setStep('account')}
        />
      )}

      {step === 'account' && (
        <>
          <BackLink onClick={() => setStep(team ? 'review' : 'manual')} />
          <Card label="Your account">
            <AccountFields
              fullName={fullName} setFullName={setFullName}
              email={email} setEmail={setEmail}
              password={password} setPassword={setPassword}
              bare
            />
          </Card>
          {error && <ErrorLine msg={error} />}
          <button onClick={submit} disabled={loading} className="btn-primary-neutral"
            style={{ width: '100%', padding: '14px 18px', fontSize: 15, fontWeight: 700 }}>
            {loading ? 'Creating your club…' : `Create ${clubName.trim() || 'club'}`}
          </button>
        </>
      )}

      {stepIndex === 0 && <SignInLink />}
    </Shell>
  );
}

/* ── Step 1: sport ──────────────────────────────────────────────────── */
function SportStep({ selected, onSelect }: { selected: Sport; onSelect: (s: Sport) => void }) {
  return (
    <>
      <StepHeading title="What sport?" sub="This shapes what we can set up for you." />
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))',
        gap: 12, marginBottom: 14,
      }}>
        {SPORTS.map(s => {
          const active = s.key === selected.key;
          const Icon = s.icon;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => onSelect(s)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
                padding: '26px 14px 18px', borderRadius: 'var(--radius-xl)',
                background: active ? 'rgba(244,241,237,0.09)' : 'var(--surface-1)',
                border: `1px solid ${active ? 'rgba(244,241,237,0.28)' : 'var(--border-default)'}`,
                color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'inherit',
                transition: 'background 0.16s, border-color 0.16s, transform 0.16s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(244,241,237,0.07)';
                e.currentTarget.style.transform = 'translateY(-3px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = active ? 'rgba(244,241,237,0.09)' : 'var(--surface-1)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <span style={{ opacity: 0.92, display: 'flex' }}><Icon /></span>
              <span className="t-body-medium">{s.label}</span>
            </button>
          );
        })}
      </div>
      <p className="t-small" style={{ color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.6 }}>
        Football clubs can have their fixtures filled in automatically. Everything else is
        set up by hand — the rest of Athlink works exactly the same.
      </p>
    </>
  );
}

/* ── Step 2: team name / search ─────────────────────────────────────── */
function TeamStep({
  clubName, setClubName, onPick, onManual, onBack,
}: {
  clubName: string;
  setClubName: (v: string) => void;
  onPick: (t: ApiTeam) => void;
  onManual: () => void;
  onBack: () => void;
}) {
  const supabase = createClient();
  const [results,  setResults]  = useState<ApiTeam[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [failed,   setFailed]   = useState(false);
  const seq = useRef(0);

  const search = useCallback(async (q: string) => {
    const mine = ++seq.current;
    if (q.trim().length < 3) { setResults(null); setFailed(false); return; }
    setSearching(true); setFailed(false);
    const { data, error } = await supabase.functions.invoke('football', {
      body: { action: 'search', query: q.trim() },
    });
    if (mine !== seq.current) return; // a newer keystroke already won
    setSearching(false);
    if (error || !data?.teams) { setFailed(true); setResults([]); return; }
    setResults(data.teams as ApiTeam[]);
  }, []);

  // Debounce so a fast typist doesn't burn the request quota.
  useEffect(() => {
    const t = setTimeout(() => search(clubName), 350);
    return () => clearTimeout(t);
  }, [clubName, search]);

  return (
    <>
      <BackLink onClick={onBack} />
      <StepHeading title="What's your club called?" sub="We'll look it up and fill in the rest." />

      <Card>
        <input
          className="input input-neutral"
          value={clubName}
          onChange={e => setClubName(e.target.value)}
          placeholder="Start typing… e.g. Glimt, Lyn, Rosenborg"
          autoFocus
          autoComplete="off"
          style={{ fontSize: 16 }}
        />

        <div style={{ marginTop: 14, minHeight: 44 }}>
          {searching && <Hint>Searching…</Hint>}

          {!searching && results && results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {results.slice(0, 8).map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onPick(t)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                    padding: '10px 12px', borderRadius: 'var(--radius-md)', textAlign: 'left',
                    background: 'transparent', border: '1px solid transparent',
                    color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <Badge url={t.logo} name={t.name} size={30} />
                  <span style={{ minWidth: 0 }}>
                    <span className="t-body-medium" style={{ display: 'block' }}>{t.name}</span>
                    <span className="t-small" style={{ color: 'var(--text-tertiary)' }}>
                      {[t.country,
                        t.gender === 'female' ? 'Women' : null,
                        t.founded ? `est. ${t.founded}` : null].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {!searching && results && results.length === 0 && !failed && (
            <Hint>No club found by that name.</Hint>
          )}
          {!searching && failed && (
            <Hint>Couldn&rsquo;t reach the club directory just now — you can still set up by hand.</Hint>
          )}
        </div>
      </Card>

      <div style={{
        padding: '16px 18px', borderRadius: 'var(--radius-lg)',
        background: 'var(--surface-1)', border: '1px solid var(--border-default)',
        marginBottom: 14,
      }}>
        <div className="t-body-medium" style={{ marginBottom: 6 }}>Can&rsquo;t see your club?</div>
        <p className="t-small" style={{ color: 'var(--text-tertiary)', lineHeight: 1.6, margin: '0 0 12px' }}>
          Lower divisions and younger age groups often aren&rsquo;t listed. That&rsquo;s
          normal — set it up by hand and everything else works the same.
        </p>
        <button type="button" onClick={onManual} className="btn-ghost">Set up by hand</button>
      </div>
    </>
  );
}

/* ── Step 3: review the matched team ────────────────────────────────── */
function ReviewStep({
  team, clubName, setClubName, color, setColor, suggested, onBack, onNext,
}: {
  team: ApiTeam;
  clubName: string;
  setClubName: (v: string) => void;
  color: string;
  setColor: (v: string) => void;
  suggested: { name: string; hex: string }[];
  onBack: () => void;
  onNext: () => void;
}) {
  const supabase = createClient();
  const [fixtures, setFixtures] = useState<Fixture[] | null>(null);
  const [fixtureNote, setFixtureNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.functions.invoke('football', {
        body: { action: 'fixtures', teamId: team.id, count: 5 },
      });
      if (cancelled) return;
      if (error || !data?.fixtures) {
        setFixtures([]);
        setFixtureNote('We couldn’t load fixtures for this team yet — you can add matches yourself.');
        return;
      }
      setFixtures(data.fixtures as Fixture[]);
      if ((data.fixtures as Fixture[]).length === 0) {
        setFixtureNote('No upcoming matches listed yet. They’ll appear here once the season is published.');
      }
    })();
    return () => { cancelled = true; };
  }, [team.id]);

  return (
    <>
      <BackLink onClick={onBack} />
      <StepHeading title="Does this look right?" sub="Change anything that isn't." />

      {/* The reveal */}
      <div className="glass" style={{
        borderRadius: 'var(--radius-xl)', padding: '26px 24px', marginBottom: 14,
        display: 'flex', alignItems: 'center', gap: 18,
      }}>
        <Badge url={team.logo} name={team.name} size={64} color={color} />
        <div style={{ minWidth: 0 }}>
          <div className="t-heading" style={{ color: 'var(--text-primary)' }}>{team.name}</div>
          <div className="t-small" style={{ color: 'var(--text-tertiary)', marginTop: 4 }}>
            {[team.country, team.founded ? `founded ${team.founded}` : null].filter(Boolean).join(' · ')}
          </div>
        </div>
      </div>

      <Card label="Club name">
        <input className="input input-neutral" value={clubName}
          onChange={e => setClubName(e.target.value)} />
      </Card>

      <Card label="Club colour">
        {suggested.length > 0 && (
          <p className="t-small" style={{ color: 'var(--text-tertiary)', margin: '0 0 12px', lineHeight: 1.6 }}>
            Looks like <strong style={{ color: 'var(--text-secondary)' }}>{suggested[0].name.toLowerCase()}</strong>{' '}
            from the badge. Change it if that&rsquo;s not right.
          </p>
        )}
        <Swatches value={color} onChange={setColor} highlight={suggested.map(s => s.hex)} />
      </Card>

      <Card label="Upcoming matches">
        {fixtures === null ? (
          <Hint>Loading fixtures…</Hint>
        ) : fixtures.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {fixtures.map(f => (
              <div key={f.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 'var(--radius-md)',
                background: 'var(--surface-1)', border: '1px solid var(--border-subtle)',
              }}>
                <span className="t-small" style={{ color: 'var(--text-tertiary)', width: 62, flexShrink: 0 }}>
                  {new Date(f.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
                <span className="t-small" style={{ color: 'var(--text-primary)', flex: 1, minWidth: 0 }}>
                  {f.isHome ? 'vs' : '@'} {f.opponent}
                </span>
                {f.league && <span className="badge">{f.league}</span>}
              </div>
            ))}
          </div>
        ) : (
          <Hint>{fixtureNote ?? 'No upcoming matches listed.'}</Hint>
        )}
      </Card>

      <button onClick={onNext} className="btn-primary-neutral"
        style={{ width: '100%', padding: '14px 18px', fontSize: 15, fontWeight: 700 }}>
        Looks right — continue
      </button>
    </>
  );
}

/* ── Step 3b: manual setup ──────────────────────────────────────────── */
function ManualStep({
  sport, clubName, setClubName, color, setColor, onBack, onNext,
}: {
  sport: Sport;
  clubName: string;
  setClubName: (v: string) => void;
  color: string;
  setColor: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [touched, setTouched] = useState(false);
  const valid = clubName.trim().length > 0;

  return (
    <>
      <BackLink onClick={onBack} />
      <StepHeading
        title="Set up your club"
        sub={sport.hasFixtures
          ? 'You can add matches yourself once you’re in.'
          : `We don’t have fixture listings for ${sport.label.toLowerCase()} yet — you’ll add matches yourself.`}
      />

      <Card label="Club name">
        <input
          className="input input-neutral" value={clubName} autoFocus
          onChange={e => setClubName(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="FC United, Lyn, Arsenal…"
        />
        {touched && !valid && <ErrorLine msg="Your club needs a name." />}
      </Card>

      <Card label="Club colour">
        <Swatches value={color} onChange={setColor} />
      </Card>

      <button
        onClick={() => (valid ? onNext() : setTouched(true))}
        disabled={!valid}
        className="btn-primary-neutral"
        style={{ width: '100%', padding: '14px 18px', fontSize: 15, fontWeight: 700, opacity: valid ? 1 : 0.5 }}
      >
        Continue
      </button>
    </>
  );
}

/* ── Shared pieces ──────────────────────────────────────────────────── */
function Badge({ url, name, size, color }: { url: string | null; name: string; size: number; color?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [url]);

  const initials = name.replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/)
    .slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

  // Newer teams often have no crest (Bodø/Glimt Women, for one) and the CDN 404s cleanly,
  // so fall back to a circle in the club colour rather than a broken image.
  if (failed || !url) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: color ? `${color}22` : 'var(--surface-2)',
        border: `1px solid ${color ?? 'var(--border-default)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.36, fontWeight: 800, color: color ?? 'var(--text-secondary)',
      }}>
        {initials}
      </div>
    );
  }

  return (
    <img
      src={url} alt="" width={size} height={size} onError={() => setFailed(true)}
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }}
    />
  );
}

function Swatches({ value, onChange, highlight = [] }: {
  value: string; onChange: (hex: string) => void; highlight?: string[];
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      {CLUB_COLORS.map(({ name, hex }) => {
        const active = value.toLowerCase() === hex.toLowerCase();
        const isSuggested = highlight.some(h => h.toLowerCase() === hex.toLowerCase());
        return (
          <button
            key={hex} type="button" onClick={() => onChange(hex)} title={name} aria-label={name}
            style={{
              width: 32, height: 32, borderRadius: '50%', background: hex, border: 'none',
              cursor: 'pointer', position: 'relative',
              outline: active ? '2px solid rgba(255,255,255,0.85)'
                     : isSuggested ? '2px dashed rgba(255,255,255,0.45)' : '2px solid transparent',
              outlineOffset: 2,
              transform: active ? 'scale(1.14)' : 'scale(1)',
              transition: 'transform 0.12s, outline-color 0.12s',
            }}
          />
        );
      })}
    </div>
  );
}

function AccountFields({ fullName, setFullName, email, setEmail, password, setPassword, bare }: {
  fullName: string; setFullName: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  bare?: boolean;
}) {
  const body = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Field label="Full name">
        <input className="input input-neutral" value={fullName} autoFocus
          onChange={e => setFullName(e.target.value)} placeholder="Alex Johnson" autoComplete="name" />
      </Field>
      <Field label="Email">
        <input className="input input-neutral" type="email" value={email}
          onChange={e => setEmail(e.target.value)} placeholder="coach@yourclub.com" autoComplete="email" />
      </Field>
      <Field label="Password">
        <input className="input input-neutral" type="password" value={password}
          onChange={e => setPassword(e.target.value)} placeholder="Min. 6 characters" autoComplete="new-password" />
      </Field>
    </div>
  );
  return bare ? body : <Card label="Your account">{body}</Card>;
}

function Progress({ current }: { current: Step }) {
  const order: Step[] = ['sport', 'team', 'review', 'account'];
  const idx = current === 'manual' ? 1 : order.indexOf(current);
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 22 }}>
      {order.map((_, i) => (
        <div key={i} style={{
          height: 3, flex: 1, borderRadius: 2,
          background: i <= idx ? 'rgba(244,241,237,0.55)' : 'var(--surface-2)',
          transition: 'background 0.25s',
        }} />
      ))}
    </div>
  );
}

function StepHeading({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h2 className="t-heading" style={{ color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
      {sub && <p className="t-small" style={{ color: 'var(--text-tertiary)', margin: '6px 0 0' }}>{sub}</p>}
    </div>
  );
}

function Card({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="glass" style={{ borderRadius: 'var(--radius-xl)', padding: '22px 22px 20px', marginBottom: 14 }}>
      {label && <div className="t-label" style={{ marginBottom: 14 }}>{label}</div>}
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="t-label" style={{ display: 'block', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="t-small" style={{ color: 'var(--text-tertiary)', margin: 0, lineHeight: 1.6 }}>{children}</p>;
}

function ErrorLine({ msg }: { msg: string }) {
  return <div className="t-small" style={{ color: 'var(--color-danger)', textAlign: 'center', margin: '0 0 12px' }}>{msg}</div>;
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="btn-ghost" style={{ marginBottom: 16, gap: 6 }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
      </svg>
      Back
    </button>
  );
}

function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div style={{
      display: 'flex', gap: 4, padding: 4, marginBottom: 18,
      background: 'var(--surface-1)', border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-md)',
    }}>
      {([['create', 'Create a club'], ['join', 'Join a club']] as [Mode, string][]).map(([key, label]) => (
        <button key={key} type="button" onClick={() => onChange(key)}
          style={{
            flex: 1, padding: '9px 12px', borderRadius: 'var(--radius-sm)',
            fontSize: 13, fontWeight: mode === key ? 700 : 500, fontFamily: 'inherit',
            cursor: 'pointer', border: 'none',
            background: mode === key ? 'var(--surface-3)' : 'transparent',
            color: mode === key ? 'var(--text-primary)' : 'var(--text-secondary)',
            transition: 'background 0.12s, color 0.12s',
          }}>
          {label}
        </button>
      ))}
    </div>
  );
}

function SignInLink() {
  return (
    <div className="t-small" style={{ textAlign: 'center', color: 'var(--text-tertiary)', marginTop: 20 }}>
      Already have an account?{' '}
      <Link href="/login" style={{ color: 'var(--neutral-accent)', textDecoration: 'none', fontWeight: 600 }}>
        Sign in
      </Link>
    </div>
  );
}

function Shell({ children, subtitle }: { children: React.ReactNode; subtitle: string }) {
  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-base)', position: 'relative',
      overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center',
      paddingBottom: 48,
    }}>
      <div className="orb-top-neutral" />
      <div className="orb-bottom-neutral" />
      <div style={{ width: '100%', maxWidth: 520, padding: '0 20px', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', padding: '48px 0 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <AthlinkMark size={36} />
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '0.12em', color: 'rgba(244,241,237,0.92)' }}>
            ATHLINK
          </div>
          <div className="t-small" style={{ color: 'var(--text-tertiary)', marginTop: 6 }}>{subtitle}</div>
        </div>
        {children}
      </div>
    </div>
  );
}

function AthlinkMark({ size = 44 }: { size?: number }) {
  const h  = Math.round(size * (110 / 104));
  const sw = Math.round((size / 104) * 16);
  return (
    <svg width={size} height={h} viewBox="0 0 104 110" fill="none">
      <defs>
        <linearGradient id="smg" x1="0" y1="0" x2="0" y2="110" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F4F1ED" /><stop offset="100%" stopColor="#ECE9F5" />
        </linearGradient>
      </defs>
      <path d="M 16 98 L 16 28 A 18 18 0 0 1 52 28 L 52 80 A 18 18 0 0 0 88 80 L 88 38"
        stroke="url(#smg)" strokeWidth={sw} strokeLinecap="square" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Sport icons ────────────────────────────────────────────────────── */
const ico = { width: 34, height: 34, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

function FootballIcon() {
  return (
    <svg {...ico}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 7.2l3.6 2.6-1.4 4.3H9.8L8.4 9.8 12 7.2z" />
      <path d="M12 2.5v4.7M20.9 9.4l-5.3.4M18.2 19.4l-4-5M5.8 19.4l4-5M3.1 9.4l5.3.4" />
    </svg>
  );
}
function HandballIcon() {
  return (
    <svg {...ico}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M5 6.5c2.6 2 4 5 4.2 8.4M19 6.5c-2.6 2-4 5-4.2 8.4M12 2.6v3.6M4.2 16.5c2.4-.7 5-.7 7.8-.2M19.8 16.5c-2-.6-4-.8-5.9-.7" />
    </svg>
  );
}
function BasketballIcon() {
  return (
    <svg {...ico}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 2.5v19M2.5 12h19M5 5.2c3.8 2.6 5.6 8.4 4.3 16M19 5.2c-3.8 2.6-5.6 8.4-4.3 16" />
    </svg>
  );
}
function HockeyIcon() {
  return (
    <svg {...ico}>
      <path d="M4 4v11.5c0 1.4 1.1 2.5 2.5 2.5H14" />
      <ellipse cx="18" cy="18" rx="3.4" ry="1.9" />
      <path d="M14.6 18v1.6c0 1 1.5 1.9 3.4 1.9s3.4-.9 3.4-1.9V18" />
    </svg>
  );
}
function VolleyballIcon() {
  return (
    <svg {...ico}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 2.5c-3 3.6-4.2 7.6-3.4 12.4M12 2.5c3 3.6 4.2 7.6 3.4 12.4M2.9 15.4c4.4-1.5 8.6-1.2 12.5.9M21.1 15.4c-2-3.8-5-6.4-9-7.7" />
    </svg>
  );
}
function OtherSportIcon() {
  return (
    <svg {...ico}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 8.2v.1M12 11.2v4.6" />
    </svg>
  );
}
