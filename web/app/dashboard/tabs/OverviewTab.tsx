'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import InvitePeople from '../InvitePeople';
import OpponentCrest from '@/components/OpponentCrest';
import type { DashTab } from '@/components/Sidebar';

export type MatchRow = {
  id: string; opponent: string; match_date: string; is_home: boolean; location: string | null;
  opponent_logo_url: string | null; opponent_color: string | null;
  meet_time: string | null; meet_location: string | null;
};
export type EventRow = { id: string; type: string; title: string; event_date: string; end_date: string | null; location: string | null };

export type HomeData = {
  athleteCount:   number;
  unreadFeedback: number;
  openTasks:      number;
  overdueTasks:   number;
  matches:        MatchRow[];   // from the start of today, so a match earlier today still counts
  events:         EventRow[];   // anything touching the next seven days
};

/** One thing on a day — an event or a match, flattened for the day list and the chart. */
type DayItem = { id: string; time: string; title: string; place: string | null; cssVar: string; isMatch: boolean };

const WEEK = 7;

export default function OverviewTab({ clubId, clubName, inviteCode, staffInviteCode, onTabChange }: {
  clubId:           string;
  clubName:         string;
  inviteCode:       string | null;
  staffInviteCode:  string | null;
  onTabChange:      (tab: DashTab) => void;
}) {
  const supabase = createClient();
  const [data, setData] = useState<HomeData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: athleteRows } = await supabase
        .from('profiles')
        .select('id')
        .eq('club_id', clubId)
        .eq('role', 'athlete')
        .is('removed_at', null);

      const ids = (athleteRows ?? []).map((a: { id: string }) => a.id);
      const safeIds = ids.length ? ids : ['none'];
      const now = new Date().toISOString();
      const today = startOfDay(new Date());
      const weekEnd = addDays(today, WEEK).toISOString();

      const [fbRes, ptRes, otRes, matchRes, eventRes] = await Promise.all([
        supabase.from('match_feedback').select('id', { count: 'exact', head: true }).in('athlete_id', safeIds).eq('acknowledged', false),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('club_id', clubId).eq('status', 'pending'),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('club_id', clubId).eq('status', 'pending').lt('due_date', now),
        supabase.from('matches')
          .select('id,opponent,match_date,is_home,location,opponent_logo_url,opponent_color,meet_time,meet_location')
          .eq('club_id', clubId).is('suppressed_at', null).eq('status', 'upcoming')
          .gte('match_date', today.toISOString()).order('match_date').limit(8),
        // A multi-day block that started last week still covers today, so match
        // on either end of the span.
        supabase.from('events')
          .select('id,type,title,event_date,end_date,location')
          .eq('club_id', clubId).lt('event_date', weekEnd)
          .or(`event_date.gte.${today.toISOString()},end_date.gte.${today.toISOString()}`)
          .order('event_date'),
      ]);

      if (cancelled) return;
      setData({
        athleteCount:   ids.length,
        unreadFeedback: fbRes.count ?? 0,
        openTasks:      ptRes.count ?? 0,
        overdueTasks:   otRes.count ?? 0,
        matches:        (matchRes.data as MatchRow[]) ?? [],
        events:         (eventRes.data as EventRow[]) ?? [],
      });
    }

    load();
    return () => { cancelled = true; };
  }, [clubId]);

  return (
    <HomeView
      data={data}
      clubName={clubName}
      inviteCode={inviteCode}
      staffInviteCode={staffInviteCode}
      onTabChange={onTabChange}
    />
  );
}

/** The screen itself, given its data — `null` while loading. Kept apart from the
 *  loader so the layout can be looked at without a signed-in session. */
export function HomeView({ data, clubName, inviteCode, staffInviteCode, onTabChange }: {
  data:            HomeData | null;
  clubName:        string;
  inviteCode:      string | null;
  staffInviteCode: string | null;
  onTabChange:     (tab: DashTab) => void;
}) {
  const now = new Date();
  const days = Array.from({ length: WEEK }, (_, i) => addDays(startOfDay(now), i));
  const byDay = data ? days.map(d => itemsOn(d, data)) : [];
  const upcoming = data?.matches.filter(m => new Date(m.match_date) >= now) ?? [];

  return (
    <div className="home">
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
          Home
        </h1>
        <span className="t-small" style={{ color: 'var(--text-tertiary)', paddingTop: 6 }}>
          {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {inviteCode && (
            <InvitePeople
              inline
              athleteCode={inviteCode}
              staffCode={staffInviteCode}
              clubName={clubName}
              // Until the counts land, stay neutral rather than flashing the
              // onboarding nudge at a club that already has athletes.
              noAthletesYet={data?.athleteCount === 0}
            />
          )}
          <button className="btn-accent" onClick={() => onTabChange('new')}>
            <PlusIcon /> New event
          </button>
        </div>
      </header>

      <section className="home-grid">
        {!data ? (
          Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="card skeleton" style={{ background: 'var(--surface-recessed)' }} />
          ))
        ) : (
          <>
            <NextMatchCard match={upcoming[0]} squad={data.athleteCount} onTabChange={onTabChange} />
            <DaysCard days={days} byDay={byDay} onTabChange={onTabChange} />
            <FeedbackCard unread={data.unreadFeedback} onTabChange={onTabChange} />
            <TasksCard open={data.openTasks} overdue={data.overdueTasks} onTabChange={onTabChange} />
            <FixturesCard matches={upcoming.slice(1, 4)} onTabChange={onTabChange} />
            <WeekCard days={days} byDay={byDay} onTabChange={onTabChange} />
          </>
        )}
      </section>
    </div>
  );
}

/* ── 1. Next match — the one card in the club's colour ───────────────── */

function NextMatchCard({ match, squad, onTabChange }: {
  match?: MatchRow; squad: number; onTabChange: (t: DashTab) => void;
}) {
  if (!match) {
    return (
      <article className="card card-accent">
        <div className="card-title">Next match</div>
        <div style={{ marginTop: 'auto', fontSize: 'clamp(30px, 2.6vw, 44px)', fontWeight: 300, letterSpacing: '-0.035em', lineHeight: 1.05 }}>
          Nothing scheduled
        </div>
        <button onClick={() => onTabChange('new')} style={{ ...onAccentPill, marginTop: 22, alignSelf: 'flex-start' }}>
          Add a match
        </button>
      </article>
    );
  }

  const d = daysUntil(match.match_date);
  const when = d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `In ${d} days`;
  const kickoff = new Date(match.match_date);

  return (
    <article className="card card-accent">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div className="card-title">Next match</div>
        <span style={onAccentPill}>{when}</span>
      </div>

      <div style={{ marginTop: 'auto', minWidth: 0 }}>
        <div style={{
          fontSize: 'clamp(40px, 3.6vw, 62px)', fontWeight: 300, letterSpacing: '-0.04em', lineHeight: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {match.opponent}
        </div>
        <div style={{ fontSize: 14, marginTop: 8, opacity: 0.68 }}>
          {[match.is_home ? 'Home' : 'Away', match.location, `${weekdayShort(kickoff)} ${time(match.match_date)}`]
            .filter(Boolean).join(' · ')}
        </div>
      </div>

      {/* What a coach is asked on matchday: when do we meet, and where. */}
      <div style={{ marginTop: 22 }}>
        <AccentRow
          label="Meet"
          value={match.meet_time
            ? [time(match.meet_time), match.meet_location].filter(Boolean).join(' · ')
            : 'Not set yet'}
          strong
        />
        <AccentRow label="Squad" value={`${squad} ${squad === 1 ? 'player' : 'players'}`} />
      </div>
    </article>
  );
}

function AccentRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 13, padding: '10px 0',
      borderTop: '1px solid color-mix(in srgb, var(--accent-on) 16%, transparent)',
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--accent-on)', opacity: strong ? 1 : 0.3 }} />
        {label}
      </span>
      <span style={{ textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}

/** A filled pill in the card's own ink — the "Tomorrow" chip and the empty-state action. */
const onAccentPill: React.CSSProperties = {
  background: 'var(--accent-on)', color: 'var(--accent-solid)',
  fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
  padding: '6px 12px', borderRadius: 'var(--radius-full)', border: 'none', cursor: 'pointer',
  whiteSpace: 'nowrap',
};

/* ── 2. Days — the light card. Pick a day, see what is on it ─────────── */

function DaysCard({ days, byDay, onTabChange }: {
  days: Date[]; byDay: DayItem[][]; onTabChange: (t: DashTab) => void;
}) {
  const [sel, setSel] = useState(0);
  const items = byDay[sel] ?? [];
  const SHOWN = 3;

  return (
    <article className="card card-light">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="card-title">{sel === 0 ? 'Today' : sel === 1 ? 'Tomorrow' : days[sel].toLocaleDateString('en-GB', { weekday: 'long' })}</div>
        <button
          onClick={() => onTabChange('calendar')}
          title="Open the calendar"
          style={{
            width: 38, height: 38, borderRadius: 'var(--radius-full)', border: 'none', cursor: 'pointer',
            background: 'var(--ink)', color: 'var(--surface-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <ArrowIcon />
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
        {days.slice(0, 4).map((d, i) => {
          const on = i === sel;
          const hasMatch = byDay[i]?.some(x => x.isMatch);
          return (
            <button
              key={i}
              onClick={() => setSel(i)}
              style={{
                width: 52, height: 62, borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit',
                border: 'none',
                boxShadow: on ? 'none' : 'inset 0 0 0 1px var(--ink-line)',
                background: on ? 'var(--ink)' : 'transparent',
                color: on ? 'var(--surface-light)' : 'var(--ink-secondary)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                fontSize: 11.5, transition: 'background 0.15s',
              }}
            >
              {weekdayShort(d)}
              <b style={{ fontSize: 17, fontWeight: 500, color: on ? 'var(--surface-light)' : 'var(--ink)' }}>{d.getDate()}</b>
              <i style={{ width: 4, height: 4, borderRadius: '50%', background: hasMatch ? 'var(--event-match)' : 'transparent' }} />
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 16 }}>
        {items.length === 0 ? (
          <div style={{ fontSize: 13.5, color: 'var(--ink-secondary)', padding: '10px 0', borderTop: '1px solid var(--ink-line)' }}>
            Nothing planned
          </div>
        ) : (
          <>
            {items.slice(0, SHOWN).map(it => (
              <div key={it.id} style={{
                display: 'grid', gridTemplateColumns: '48px 1fr', gap: 10, alignItems: 'baseline',
                padding: '10px 0', borderTop: '1px solid var(--ink-line)', fontSize: 13.5,
              }}>
                <span style={{ color: 'var(--ink-secondary)', fontVariantNumeric: 'tabular-nums' }}>{it.time}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <i style={{ width: 8, height: 8, borderRadius: 2, background: `var(${it.cssVar})`, flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</span>
                  </span>
                  {it.place && (
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-secondary)', marginTop: 2, paddingLeft: 16 }}>
                      {it.place}
                    </span>
                  )}
                </span>
              </div>
            ))}
            {items.length > SHOWN && (
              <button
                onClick={() => onTabChange('calendar')}
                style={{
                  background: 'none', border: 'none', padding: '8px 0 0 58px', cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 12.5, color: 'var(--ink-secondary)',
                }}
              >
                {items.length - SHOWN} more
              </button>
            )}
          </>
        )}
      </div>
    </article>
  );
}

/* ── 3. Feedback ─────────────────────────────────────────────────────── */

function FeedbackCard({ unread, onTabChange }: { unread: number; onTabChange: (t: DashTab) => void }) {
  return (
    <article className="card">
      <PitchLines />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
        <span style={{
          height: 38, padding: '0 18px', borderRadius: 'var(--radius-full)',
          border: '1px solid var(--border-default)', display: 'inline-flex', alignItems: 'center', fontSize: 13.5,
        }}>
          Feedback
        </span>
        <button className="card-link" onClick={() => onTabChange('feedback')}>History</button>
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'flex-end', gap: 16, position: 'relative' }}>
        <span className="figure">{unread}</span>
        <p className="t-small" style={{ margin: 0, color: 'var(--text-secondary)', paddingBottom: 4 }}>
          {unread === 0 ? <>Everything sent<br />has been read</> : <>not yet read<br />by the players</>}
        </p>
      </div>

      <button
        className="btn-outline"
        onClick={() => onTabChange('feedback')}
        style={{ marginTop: 22, position: 'relative', justifyContent: 'space-between', padding: '0 6px 0 20px', height: 48 }}
      >
        Write feedback
        <span style={{
          width: 36, height: 36, borderRadius: 'var(--radius-full)', background: 'var(--surface-active)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <PlusIcon />
        </span>
      </button>
    </article>
  );
}

/** A pitch drawn at a whisper behind the card — the one decoration on Home,
 *  and it is the place the feedback is about. */
function PitchLines() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      fill="none" stroke="currentColor" strokeWidth={1.5}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.05, pointerEvents: 'none' }}
    >
      <rect x="20" y="20" width="360" height="260" rx="2" />
      <path d="M200 20v260" />
      <circle cx="200" cy="150" r="46" />
      <rect x="20" y="85" width="56" height="130" /><rect x="20" y="118" width="20" height="64" />
      <path d="M76 122a34 34 0 0 1 0 56" />
      <rect x="324" y="85" width="56" height="130" /><rect x="360" y="118" width="20" height="64" />
      <path d="M324 122a34 34 0 0 0 0 56" />
    </svg>
  );
}

/* ── 4. Tasks ────────────────────────────────────────────────────────── */

function TasksCard({ open, overdue, onTabChange }: { open: number; overdue: number; onTabChange: (t: DashTab) => void }) {
  const onTime = Math.max(open - overdue, 0);
  return (
    <article className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            width: 32, height: 32, borderRadius: 10, background: 'var(--surface-active)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <TickIcon />
          </span>
          <span className="card-title">Tasks</span>
        </span>
        <button className="card-link" onClick={() => onTabChange('tasks')}>All tasks</button>
      </div>

      <div style={{ marginTop: 'auto' }}>
        <span className="figure">{open}</span>
        <p className="t-small" style={{ margin: '12px 0 0', color: 'var(--text-tertiary)' }}>
          {open === 1 ? 'open task' : 'open across the squad'}
        </p>
      </div>

      {/* Past due is striped — the only thing on this card that wants doing now. */}
      <div style={{ display: 'flex', gap: 4, height: 10, marginTop: 24 }}>
        {open === 0 ? (
          <i style={{ flex: 1, borderRadius: 3, background: 'var(--surface-active)' }} />
        ) : (
          <>
            {overdue > 0 && <i className="hatch-danger" style={{ flex: overdue, borderRadius: 3 }} />}
            {onTime > 0 && <i style={{ flex: onTime, borderRadius: 3, background: 'var(--surface-active)' }} />}
          </>
        )}
      </div>
      <div style={{ display: 'flex', gap: 18, marginTop: 14, fontSize: 12.5, color: 'var(--text-tertiary)' }}>
        <span><b style={{ color: 'var(--text-primary)', fontWeight: 500, marginRight: 4 }}>{overdue}</b>past due</span>
        <span><b style={{ color: 'var(--text-primary)', fontWeight: 500, marginRight: 4 }}>{onTime}</b>on time</span>
      </div>
    </article>
  );
}

/* ── 5. Fixtures — the ones after the next ───────────────────────────── */

function FixturesCard({ matches, onTabChange }: { matches: MatchRow[]; onTabChange: (t: DashTab) => void }) {
  return (
    <article className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="card-title">After that</span>
        <button className="card-link" onClick={() => onTabChange('calendar')}>Calendar</button>
      </div>

      <div style={{ marginTop: 'auto' }}>
        {matches.length === 0 ? (
          <div className="t-small" style={{ color: 'var(--text-tertiary)' }}>No more fixtures yet</div>
        ) : matches.map((m, i) => {
          const d = new Date(m.match_date);
          return (
            <div key={m.id} style={{
              display: 'grid', gridTemplateColumns: '36px 1fr auto', gap: 14, alignItems: 'center',
              padding: '12px 0', borderTop: i ? '1px solid var(--border-subtle)' : 'none',
            }}>
              <OpponentCrest url={m.opponent_logo_url} name={m.opponent} color={m.opponent_color} size={36} />
              <span style={{ minWidth: 0 }}>
                <span className="t-body-medium" style={{ display: 'block', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.opponent}
                </span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[m.is_home ? 'Home' : 'Away', m.location].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                {weekdayShort(d)} {d.getDate()} {d.toLocaleDateString('en-GB', { month: 'short' })}
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{time(m.match_date)}</span>
              </span>
            </div>
          );
        })}
      </div>
    </article>
  );
}

/* ── 6. The week, as a bar per day ───────────────────────────────────── */

function WeekCard({ days, byDay, onTabChange }: {
  days: Date[]; byDay: DayItem[][]; onTabChange: (t: DashTab) => void;
}) {
  const counts = byDay.map(x => x.length);
  const total = counts.reduce((a, b) => a + b, 0);
  // Never let one busy day flatten the rest into slivers — and never divide by zero.
  const max = Math.max(3, ...counts);

  return (
    <article className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="card-title">Next 7 days</span>
        <button className="card-link" onClick={() => onTabChange('calendar')}>
          {total} {total === 1 ? 'thing' : 'things'} planned
        </button>
      </div>

      <div style={{
        marginTop: 'auto', paddingTop: 16, height: 170,
        display: 'grid', gridTemplateColumns: `repeat(${days.length}, 1fr)`, gap: 12, alignItems: 'end',
      }}>
        {days.map((d, i) => {
          const n = counts[i];
          const isMatch = byDay[i].some(x => x.isMatch);
          return (
            <div key={i} title={`${n} on ${d.toLocaleDateString('en-GB', { weekday: 'long' })}`}
              style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{n || ''}</span>
              <div
                className={i === 0 ? 'hatch-accent' : undefined}
                style={{
                  width: '100%', maxWidth: 34, borderRadius: 8,
                  // An empty day still gets a stub, so the week reads as seven days.
                  height: `${Math.max(n / max, 0.04) * 100}%`,
                  maxHeight: 'calc(100% - 44px)',
                  background: i === 0 ? undefined : isMatch ? 'var(--event-match)' : 'var(--surface-active)',
                }}
              />
              <span style={{ fontSize: 11.5, color: i === 0 ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                {weekdayShort(d)}
              </span>
            </div>
          );
        })}
      </div>
    </article>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

function itemsOn(day: Date, data: HomeData): DayItem[] {
  const from = day.getTime();
  const to = addDays(day, 1).getTime();
  const out: (DayItem & { at: number })[] = [];

  for (const e of data.events) {
    const start = new Date(e.event_date).getTime();
    const end = e.end_date ? new Date(e.end_date).getTime() : start;
    if (start >= to || end < from) continue;
    const meta = EVENT_META[e.type] ?? EVENT_META.other;
    // A block that started on an earlier day has no start time today.
    const startsToday = start >= from;
    out.push({
      id: `${e.id}:${from}`, at: startsToday ? start : from,
      time: startsToday ? time(e.event_date) : 'All day',
      title: e.title, place: e.location, cssVar: meta.cssVar, isMatch: false,
    });
  }
  for (const m of data.matches) {
    const at = new Date(m.match_date).getTime();
    if (at < from || at >= to) continue;
    out.push({
      id: m.id, at, time: time(m.match_date),
      title: `${m.is_home ? 'vs' : '@'} ${m.opponent}`, place: m.location,
      cssVar: '--event-match', isMatch: true,
    });
  }
  return out.sort((a, b) => a.at - b.at);
}

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

/** Calendar days, not elapsed hours — a Monday 20:00 kick-off seen on Sunday morning is "tomorrow". */
function daysUntil(iso: string) {
  return Math.round((startOfDay(new Date(iso)).getTime() - startOfDay(new Date()).getTime()) / 86400000);
}

/** Local time — never slice a timestamptz. */
function time(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
function weekdayShort(d: Date) { return d.toLocaleDateString('en-GB', { weekday: 'short' }); }

const EVENT_META: Record<string, { cssVar: string }> = {
  training: { cssVar: '--event-training' },
  home:     { cssVar: '--event-home' },
  rehab:    { cssVar: '--event-rehab' },
  exercise: { cssVar: '--event-exercise' },
  recovery: { cssVar: '--event-recovery' },
  travel:   { cssVar: '--event-travel' },
  meeting:  { cssVar: '--event-meeting' },
  vacation: { cssVar: '--event-vacation' },
  other:    { cssVar: '--event-other' },
};

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}
function TickIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12 4.5 4.5L19 7" />
    </svg>
  );
}
