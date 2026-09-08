# Athlink — Project Brief

A durable reference for discussing this project. Describes what Athlink is, how it
is built, the decisions behind it and the constraints it lives under. Deliberately
avoids point-in-time status — nothing here should need updating week to week.

---

## 1. What Athlink is

A communication and organisation app for sports clubs, built around **two roles**:

- **Athletes** use a mobile app (iOS-first, Android required) — their schedule,
  matchday details, coach feedback, and assigned tasks.
- **Staff** (coaches, physios, analysts) use a web dashboard — the fixture calendar,
  squad management, feedback composition, task assignment, and club settings.

One codebase per platform, one Supabase backend, one login. The role on the account
decides which interface you get.

The initial market is **Norwegian football clubs**, sold directly to established clubs
rather than grown from hobby users.

### What it deliberately is not

- **Not a chat app.** WhatsApp already won that. Athlink handles structured,
  contextual, searchable communication. If something isn't discoverable and
  actionable, it belongs in WhatsApp.
- **Not an admin tool.** Every user is a coach or an athlete. Assume no tolerance for
  jargon, configuration screens, or explanations longer than a sentence.
- **Not feature-broad.** Breadth is not what this product wins on.

---

## 2. Who is building it

Magne Engan, building solo. Norwegian, Oslo timezone. Football background informs the
domain model — the product assumes real club structures (squads, fixtures, matchday
logistics) rather than generic "teams and events".

**Development environment, and its constraints:**

- Works on **Windows**. No Mac.
- The iOS app is tested on a **physical iPhone via Expo Go** — there is no iOS
  simulator on Windows, and cloud Macs/device farms stream video, which is useless for
  judging animation smoothness.
- Consequence: whoever is writing the mobile UI cannot see it. Screenshots and screen
  recordings from the phone are the feedback loop. This is the single biggest source of
  friction in the project and the cause of most wasted effort.
- Shipping to the App Store does **not** require a Mac — EAS Build compiles and submits
  from Windows. A Mac would buy the simulator, Instruments profiling, local dev builds
  and testable push notifications.
- A **Cisco AnyConnect work VPN** runs on the same machine and reconnects on its own.
  While up, it blocks inbound connections on the Wi-Fi interface, so the phone cannot
  reach the Metro dev server. This presents as "connection timed out" in Expo Go and is
  the most common false alarm in the project.

---

## 3. Go-to-market and the launch bar

The first sellable version is **deliberately not a conventional MVP**. The plan is to
approach established clubs directly, so the product has to read as finished on first
contact. Something rough-but-functional loses on credibility before anyone evaluates
the features.

**The competitive frame:** the app must feel better than PayTheHippo. Feel — smoothness,
polish, native-ness — is treated as the differentiator, not feature count.

Two non-negotiables:

1. **Near-zero friction for staff.** A coach should never be asked to type something the
   system could already know. Automatic fixture import is the highest-leverage example.
2. **The mobile app must feel like a consumer social app**, not enterprise software.
   Athletes are the daily users and have no patience for admin software.

**Day-to-day implication: when polish and feature count compete, cut features.**

Order of work: staff web app → mobile app to launch standard → marketing site
(Framer) → sales.

---

## 4. Technical architecture

| Layer | Technology |
|---|---|
| Mobile (`app/`) | Expo / React Native, iOS-first, TypeScript strict |
| Staff web (`web/`) | Next.js App Router, React, Tailwind |
| Backend | Supabase — Postgres, Auth, Edge Functions, Storage |
| AI | OpenAI `gpt-4o-mini` via a Supabase Edge Function |
| Push | Expo Push Notifications |
| Fixtures | Sportmonks football API, proxied through an Edge Function |
| i18n | `react-i18next`, EN + NO (mobile only) |
| Mobile navigation | React Navigation native-stack + native iOS tab bar |
| Mobile animation | Reanimated worklets + gesture-handler — UI thread only |

Supabase project: `wdkmlfveunzjhsbentcl` (region eu-north-1).

Both apps need a gitignored `.env`; a missing one surfaces as `supabaseUrl is required`
at startup.

**The Supabase project is on the free tier, which auto-pauses after about a week idle.**
From the app this is indistinguishable from being offline — React Native reports
`TypeError: Network request failed`. This is a genuine launch risk: a club opening the
app on a Monday after a quiet week would hit a dead backend. Upgrading the tier is a
prerequisite for any demo.

---

## 5. Data model

Core tables:

| Table | Purpose |
|---|---|
| `profiles` | Extends `auth.users`. `role`, `club_id`, `language`, `push_token`, `avatar_url`, `is_club_manager`, `removed_at` |
| `clubs` | `name`, `sport`, `primary_color`, two invite codes, and the fixture-provider link |
| `matches` | Fixtures. Provider-owned and club-owned fields (see below) |
| `events` | Generic events — training, rehab, meetings, vacations. Supports multi-day via `end_date` |
| `event_assignments` | Joins events to athletes. **An absent row means the whole squad** |
| `match_feedback` | Coach → athlete feedback, with AI-processed text and athlete reply/reaction |
| `tasks` | Assigned tasks with due dates and completion |
| `groups` / `group_members` | Athlete groupings |

RLS is enabled on every table.

### Domain rules that bite

These are the non-obvious rules that have each caused a real bug:

**Match fields have owners.** `opponent`, `match_date`, `is_home` and the crest are
provider-owned and overwritten on every sync — that is how postponements arrive.
`meet_time`, `meet_location` and `notes` are **club-owned and must never appear in the
sync's update list.** A coach's typed meeting point was once silently wiped on every
sync because the venue field was overwritten unconditionally.

**Deleting a fixture is suppression, not deletion.** A real DELETE is useless — the sync
upserts and would recreate the row within hours. Provider matches set `suppressed_at`
instead, and **every read of `matches` must filter `suppressed_at IS NULL`.** Events and
manually-entered matches are genuinely deleted.

**Removal from a club is soft.** `profiles.removed_at` marks a member as gone. Hard
deletion is impossible anyway — feedback history belongs to the club, not the departing
member. Access is revoked at a single chokepoint: the helper functions that every RLS
policy is built on filter on `removed_at`, so one flag denies everything.

**Roles are only `athlete` or `staff`.** Club manager is a separate boolean flag, not a
third role — dozens of RLS policies compare against the role string, and adding a value
would mean editing every one.

**Role must be server-derived.** It is set by a database trigger from whichever invite
code matched. It must never come from client-supplied signup metadata, because the anon
key ships in the client bundle — anyone holding a club's athlete code could otherwise
register as staff.

**RLS cannot restrict columns.** Column-level grants are what stop an athlete promoting
themselves by updating their own profile row. Any new privileged column on `profiles` is
protected by default and must never be added to that grant.

**A squad-wide event has no assignment rows**, and the athlete RLS policy only exposes
an athlete's *own* assignment rows — so from the client, "unassigned" and "assigned to
someone else" are indistinguishable. Resolving athlete-visible events therefore has to
happen server-side in a `SECURITY DEFINER` function.

**Never slice a timestamptz string.** Reading characters 11–16 off the wire gives UTC,
not local time, which showed athletes kick-off times two hours early in Norway.

---

## 6. Fixture data (Sportmonks)

Fixtures should **arrive, not be typed** — a core product goal. A club links its team
once, and fixtures and the club crest populate automatically.

- All calls go through a Supabase Edge Function that returns the app's own shape, not
  provider types. That seam is why switching provider (from API-Football, which
  suspended the account with no reachable support) cost one file.
- The sync is triggered when a staff member opens the web dashboard and the last sync is
  stale. It is deliberately silent and un-awaited so a provider outage cannot block the
  dashboard. The throttle lives on the club row, so ten staff produce one request between
  them; it scales with clubs, not squad size.
- **Manual entry stays first-class.** Coverage will never be complete, so a paste-a-
  fixture-list flow exists alongside single-match entry. Anything entered by hand is
  marked as such and is untouchable by a sync.
- **There is no club → team hierarchy at the provider.** Senior, reserve, youth and
  women's sides are separate records sharing a name, so linking must ask *which team do
  you coach* before searching.
- The free plan covers a single league, so Norwegian clubs return nothing from search
  until the plan is upgraded. Full Norwegian coverage is roughly sixteen leagues.

---

## 7. Product and UI principles

**Built for sports people, not office workers:**

- Name things after the real-world event, not the mechanism. "Get a new code", never
  "Regenerate" or "Rotate".
- No security vocabulary in the UI — no "credential", "token", "revoke", "permissions".
- State what a destructive action does **and does not** do, in plain words. Users assume
  an action did more than it did.
- Prefer flows framed around *people* ("Add a coach") over *artifacts* ("Create an invite
  token").
- Anything a coach does once or twice a year should be discoverable at the moment they
  need it, not filed under Settings.
- Say "staff", never "coaches" — physios and analysts need access without being coaches.

**Club theming.** Each club picks a primary colour at signup, and it flows through
backgrounds, accents and the native tab bar's selection glow. On the web it is
deliberately three tokens, not one: the true colour for fills, a lightened variant
guaranteed readable on dark, and black-or-white for labels sitting on the solid colour.
Hardcoding white on an accent background made yellow clubs unreadable.

**AI is translation and structuring, never authority.** It turns a coach's rough
observation into clear athlete-language. The coach always reviews before sending, and AI
is never presented to the athlete as making decisions.

---

## 8. The mobile "feel" problem, and what was learned

The mobile app's smoothness is treated as a product requirement, not polish. Several
hard-won lessons:

**Everything animated must run on the UI thread.** Reanimated worklets and
gesture-handler only. `PanResponder` and the legacy `Animated` API are banned. The rule:
if a value changes while a finger is down, it belongs in a worklet.

**Judge performance from a release build.** Dev-mode Expo Go is not a fair test of
anything, and confusing the two led to a serious near-miss where the whole framework was
almost abandoned as too slow.

**Liquid Glass: the material is not the control.** This is the most transferable lesson
in the project. `expo-glass-effect` gives Apple's actual glass *material*. Apple's tab
bar is a *control* built on top of that material, and the control is what contributes
the selection lens that magnifies content behind it, the chromatic edge fringing, and
the lens merging into the bar as it travels. A hand-built pill applying the material
will always read as a copy, however carefully tuned — that is not a tuning problem. The
fix was to stop drawing a tab bar and use the real `UITabBarController`. The same applies
to bottom sheets: iOS's own sheet presentation brings detents, the grabber, correct
dismissal physics and scroll-to-expand that a hand-built sheet cannot reproduce.

**Never layer anything on top of real glass.** It draws its own edge, specular highlight
and shadow. Adding a border, gradient or shadow competes with the effect rather than
adding to it, and burying it under an imitation of itself is what made it look fake.

**Glass is for a handful of floating controls, not list rows.** Rendering a native glass
view per row in a scrolling list meant dozens of live backdrop-sampling views competing
for GPU, which is what made the app feel like it ran at ten frames per second. Static
surfaces for content, real glass only for chrome.

**A blurred backdrop over near-black has nothing to blur.** Over a dark background, an
expensive real-time blur and a cheap translucent fill look nearly identical.

---

## 9. Known weak points

Durable characteristics rather than a to-do list:

- **The staff web app has never been verified while signed in.** Everything below the
  login is built and typechecks, but an AI assistant cannot enter a password, so the
  authenticated surface has only ever been exercised at the database layer.
- **The mobile app has never been run on Android at all.** Android is a hard requirement
  — a squad app that excludes a third of the squad is unsellable — and it is completely
  untested.
- **Push notifications have never been tested.** They do not work in Expo Go, and there
  is no dev build.
- **The mobile app is English-only below the landing screen.** Translation keys exist but
  are largely unused, and there is no way to change language after signup on mobile.
- **`database.types.ts` is hand-maintained** and drifts from the live schema.
- **The mobile UI has no design system.** Roughly twenty distinct font sizes, thirty-plus
  ad-hoc white alphas, twenty-plus corner radii and dozens of hardcoded hex colours.
  Nothing rhymes with anything else, which is the mechanical cause of it reading as
  generated rather than designed. Any redesign has to start with tokens or it will drift
  straight back.
- **GDPR and minors.** No retention policy, deletion path or processor agreement.
  Athletes may be under 18, and this is the sort of thing a professional club's
  safeguarding officer asks about before signing.

---

## 10. How development actually works

Claude Code runs on the Windows machine with access to the repo, the Supabase project,
and a browser. Established working patterns:

- **The assistant cannot see the mobile app.** Screenshots and screen recordings from the
  phone are the only feedback. A helper script collects recent captures and extracts
  video frames so they can be examined. Comparison recordings — Athlink next to an app
  that does the thing correctly — have repeatedly settled questions that reasoning alone
  could not.
- **Plain description of what is wrong is unusually valuable.** "The bar section is cut
  off from the rest of the app" and "the blob is over the home button and doesn't move"
  each identified a specific bug faster than any amount of code analysis.
- **Verification is typecheck plus a production bundle** (`npx expo export`), and for
  animation work, confirming the worklets actually compile. None of that proves it looks
  right on a device.
- **Schema and data claims are checked against the live database**, not inferred from
  code — several "bugs" turned out to be about what the data actually contained.
- Test accounts exist for staff and athlete roles; credentials are in the repo's
  `CLAUDE.md`, not here.

`CLAUDE.md` in the repo root is the working technical reference and is kept current with
architectural decisions and the reasoning behind them. This brief is the higher-level
companion to it.
