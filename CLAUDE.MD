# Athlink — Developer Reference

## Stack

| Layer | Technology |
|---|---|
| Mobile app (`app/`) | Expo SDK 55 / React Native (iOS primary) |
| Staff web app (`web/`) | Next.js 16 (App Router) / React 19 / Tailwind v4 |
| Language | TypeScript (strict) |
| Backend | Supabase (Postgres + Auth + Edge Functions + Storage) |
| AI | OpenAI `gpt-4o-mini` via Supabase Edge Functions |
| Push notifications | Expo Push Notifications (`expo-notifications`) |
| i18n | `react-i18next` + JSON translation files (EN / NO) — mobile only |
| Navigation | React Navigation v6 — NativeStack (mobile) |
| UI | Mobile: custom glass system. Web: CSS design tokens in `web/app/globals.css` |

> **Next.js version warning.** `web/` runs a Next.js release with breaking changes from
> older conventions — see `web/AGENTS.md`. Notably `middleware.ts` is now **`proxy.ts`**
> (exporting `proxy()`). Read `web/node_modules/next/dist/docs/` before writing new
> Next-specific code rather than relying on familiar patterns.

## Running it

```bash
cd app && npm start      # Expo — press i / a, or scan the QR
cd web && npm run dev    # Next dev server on :3000  (npm start = prod, needs a build first)
```

Both need a `.env` that is gitignored and therefore absent on a fresh clone:

| File | Vars |
|---|---|
| `app/.env` | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` |
| `web/.env.local` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

A missing `.env` surfaces as **`supabaseUrl is required`** at startup.

Supabase project ref: `wdkmlfveunzjhsbentcl`. On the free tier it auto-pauses after ~a week
idle — that shows up instead as auth/queries hanging or failing against a valid URL, and is
fixed by restoring the project from the Supabase dashboard.

## Project structure

```
app/
  src/
    components/
      athlete/
        sections/         # Tab content: ThisWeek, Feedback, Schedule, Tasks, Progress
        LiquidGlassTabBar.tsx
      ui/
        GlassCard.tsx
        GlassInput.tsx
        SlideUpSheet.tsx  # Reusable bottom sheet (slides up ~62% screen)
    context/
      AuthContext.tsx     # Session, profile, club_color, push token registration
    i18n/
      index.ts            # i18next init (device locale → default lang)
      en.json
      no.json
    navigation/
      RootNavigator.tsx
    screens/
      athlete/HomeScreen.tsx
      auth/LandingScreen.tsx
      staff/StaffHomeScreen.tsx
      staff/StaffAthleteDetailScreen.tsx
    utils/
      theme.ts            # hexToRgba(), clubGradientOrbs()
    lib/
      supabase.ts

web/
  proxy.ts                # Auth gate (this Next version's middleware). Redirects
                          # signed-out → /login, signed-in away from /login,/signup
  app/
    globals.css           # Design tokens — DO NOT write raw hex/rgba in components
    layout.tsx
    login/page.tsx
    signup/page.tsx       # Staff only: creates a NEW club (name + primary_color)
    dashboard/
      layout.tsx          # Auth guard (role must be 'staff') + injects --accent vars
      page.tsx
      DashboardShell.tsx  # Client tab switcher — all tabs live here, no route changes
      tabs/               # OverviewTab, AthletesTab, CalendarTab, FeedbackTab,
                          # TasksTab, GroupsTab, ClubTab, NewEventTab
      athletes/AthletesClient.tsx   # also exports AvatarCircle, reused by other tabs
      InvitePeople.tsx    # Add athletes / Add staff dialogs + "get a new code"
      NotStaffNotice.tsx  # shown to non-staff; must NOT redirect (see below)
  components/
    Sidebar.tsx
    DateField.tsx         # replaces <input type="date"> everywhere
    OpponentCrest.tsx     # badge with initials fallback
  lib/
    auth.ts               # getSessionProfile() — React cache(), one profile fetch/request
    clubTheme.ts          # palette + accentTokens() + nearestClubColor()
    badgeColor.ts         # samples a club badge to suggest a palette colour (browser only)
    parseFixtures.ts      # parses a pasted fixture list (37 unit-tested cases)
    syncFixtures.ts       # pulls provider fixtures, writes via RPC
    database.types.ts     # hand-maintained — update when you add columns
    supabase/{client,server}.ts

supabase/
  rls.sql
  functions/football/     # Sportmonks proxy
```

**Do not redirect non-staff away from `/dashboard`.** `proxy.ts` bounces any signed-in user
from `/login` back to `/dashboard`, so redirecting produces an infinite loop. `NotStaffNotice`
renders an explanation with a sign-out button instead — signing out is the only exit that
resolves the state.

**Web navigation is tab state, not routing.** `DashboardShell` holds a `DashTab` in
`useState` and conditionally renders one tab component. The `/dashboard/*` route folders
exist but the sidebar does not navigate to them — it calls `onTabChange`.

`'profile'` is a `DashTab` like any other but is deliberately **absent from `NAV`** — it is
reached by clicking your own name at the foot of the sidebar, where people look for it,
rather than sitting in the list beside Athletes and Calendar.

**Name and club name live in `DashboardShell` state, not in the props they arrive as.**
Both are editable (Profile and Club respectively) and the sidebar has to pick a change up
without a reload — a reload would reset the active tab and bounce you to Overview. Any
future editable identity field needs the same treatment.

## Launch bar

The first sellable version is **deliberately not a conventional MVP.** The plan is to
approach established clubs directly rather than grow from hobby users, so it has to read as
a finished product on first contact — something rough-but-functional loses on credibility
before anyone evaluates the features.

Two non-negotiables:

- **Near-zero friction for staff.** A coach should never be asked to type something the
  system could already know. Fixture sync is the highest-leverage example of this.
- **The mobile app must feel like a consumer social app**, not an enterprise tool — gesture
  navigation, real transitions, nothing that stutters or drops frames. Athletes are the
  daily users and have no patience for admin software.

Order of work: finish the staff web app (incl. signup and club creation with fixture sync)
→ bring the mobile app to launch standard → marketing site (Framer + template) → sales.

**Implication for day-to-day decisions: when polish and feature count compete, cut
features.** Breadth is not what this product has to win on.

## Key architectural decisions

**Built for sports people, not office workers.** Every user is a coach or an athlete. Assume
no tolerance for jargon, admin screens, or multi-step configuration, and assume nobody will
read an explanation longer than a sentence. Concretely:

- Name things after the real-world event, not the mechanism. "Get a new code", never
  "Regenerate" / "Rotate" / "Invalidate".
- No security vocabulary in the UI — no "credential", "token", "revoke", "permissions".
- State what a destructive action does **and does not** do, in plain words. Users will
  assume an action did more than it did (see: getting a new code does not remove anyone
  who already joined).
- Prefer flows framed around *people* ("Add a coach") over flows framed around *artifacts*
  ("Create an invite token"). Coaches think in squad members, not credentials.
- Anything a coach only does once or twice a year should be discoverable at the moment they
  need it, not filed under Settings.

**Fixtures should arrive, not be typed.** A core product goal, not a nice-to-have: coaches
must not have to enter every match by hand. Sportmonks populates a club's fixtures and
badge once its team is linked — see External fixture data under Known gaps for the
integration contract and its limits.

**No chat.** WhatsApp already won that. Athlink handles structured, contextual, searchable communication. If it's not discoverable and actionable, it belongs in WhatsApp.

**AI = translation + structuring, never authority.** OpenAI `gpt-4o-mini` translates coach observations into clear athlete-language (What / Why / How). Coach always reviews before sending. AI is never shown to the athlete as making decisions.

**One app, two UIs.** Login role determines whether the user sees the athlete dashboard or the staff interface. Same codebase.

**Club theming.** Each club picks a `primary_color` at signup. All background gradients (top + bottom orbs) derive from this color via `clubGradientOrbs()` in `utils/theme.ts`. Athletes in the same club see the same color theme.

**Language per user.** User selects language at signup (EN / NO). Stored on `profiles.language`. Applied via `i18n.changeLanguage()` on login. AI feedback is translated into the athlete's language by the edge function.

**SlideUpSheet pattern.** Tap any content item (event, feedback, task) → sheet slides up from the bottom covering ~62% of screen. Draggable to dismiss. Used for calendar events today; planned for feedback and task detail views.

## Database schema (key tables)

| Table | Purpose |
|---|---|
| `profiles` | Extends `auth.users`. Has `role`, `club_id`, `language`, `push_token`, `avatar_url`, `is_club_manager`, `removed_at` |
| `clubs` | `name`, `sport`, `invite_code` + `staff_invite_code` (6-char), `primary_color`, and the provider link: `external_provider`, `external_team_id`, `external_team_name`, `external_badge_url`, `external_synced_at` |
| `match_feedback` | Coach → athlete feedback. Has `title`, `feedback_text`, `processed_text` (AI), `is_ai_processed`, `action_point`, `athlete_language`, `acknowledged`, `reaction` (emoji), `athlete_reply` |
| `tasks` | Assigned tasks. `title`, `description`, `due_date`, `status`, `assigned_to`, `created_by`, `club_id`, `completed_at` |
| `matches` | Fixtures. Provider-owned: `opponent`, `opponent_logo_url`, `match_date`, `is_home`, `location`. Club-owned: `meet_time`, `meet_location`, `notes`. Plus `source` ('manual'\|'api'), `external_id`, `suppressed_at` |
| `events` | Generic events. `type`, `title`, `event_date`, `end_date`, `location`, `description`, `pdf_url`, `line_items` (jsonb) |
| `event_assignments` | Joins `event_id` → `athlete_id`. Absent rows = whole squad |
| `groups` | Athlete groupings — `name`, `color`, `description`, `club_id`, `created_by` |
| `group_members` | Joins `group_id` → `athlete_id` |
| `match_plans` | Defined in SQL; **no app or web code reads it yet** |
| `self_assessments` | Defined in SQL; **no app or web code reads it yet** |

RLS is enabled on every table. PDF uploads go to the **`event-pdfs`** storage bucket
(path `{club_id}/{timestamp}_{filename}`), read back via `getPublicUrl`.

### Match fields have owners — do not blur them

| Owner | Fields | Sync behaviour |
|---|---|---|
| Provider | `opponent`, `opponent_logo_url`, `match_date`, `is_home` | overwritten every sync — that is how postponements arrive |
| Provider *if supplied* | `location` (the ground) | `COALESCE(EXCLUDED, existing)` — a null from the provider must never clear it |
| **Club** | `meet_time`, `meet_location`, `notes` | never in the update list at all |

This cost a real bug once: `location` was overwritten unconditionally while the provider
returned no venue, so every sync silently reset a coach's typed meeting point to NULL. Any
new coach-entered column must stay out of `sync_external_fixtures`' `DO UPDATE`.

### Deleting from the calendar

`delete_calendar_item(p_kind, p_id)` is the single entry point, because matches and events
delete differently:

- **Events** and **manual matches** are really deleted — nothing can bring them back.
- **Provider matches set `suppressed_at`** instead. A real DELETE is useless: the sync
  upserts on `(club_id, external_id)` and would re-create the row within six hours, so the
  coach would watch a deleted fixture reappear. The row stays, hidden, and the sync keeps
  updating it without ever un-suppressing.

**Every read of `matches` must filter `suppressed_at IS NULL`.** `restore_calendar_match(id)`
reverses it; the Calendar day panel surfaces removed fixtures with an "Add back" action.

### Multi-day events

A vacation is **one row** with `event_date` + `end_date`, not many rows. `CalendarTab`
expands it across days for display only (capped at 400), tagging each with `spanDay` /
`spanTotal`. Deleting or editing from any day therefore affects the whole block — the
confirm dialog says so explicitly. Partial-span deletion is deliberately not supported;
shortening the block by editing its end date is the intended path.

### Event types
Mobile documents: `training` · `exercise` · `recovery` · `travel` · `meeting` · `other`
(plus `match` from the matches table).

The web app writes three more — `home` (home training), `rehab`, `vacation` — and
`CalendarTab` colour-maps all of them. **The mobile app has no colour/label for these
three**, so events created on web currently fall through to the mobile default styling.

### Club signup flow (DB trigger `handle_new_user`)

Each club has **two** 6-char codes, unique across both columns:

| Column | Grants |
|---|---|
| `clubs.invite_code` | athlete |
| `clubs.staff_invite_code` | staff — full club admin |

- **Create a club** (`club_name` in metadata): generates both codes, creates the club, and
  makes the creator `staff` — implied by the action, not requested.
- **Join a club** (`invite_code` in metadata): looks up the athlete code first, then the staff
  code. **Role is derived from whichever matched.** Athlete-first means a hypothetical
  collision resolves to the lesser privilege.
- A supplied code matching no club **raises**, aborting signup. It previously created a
  profile with `club_id = NULL`, so signup appeared to succeed into no club.
- No code and no club name (e.g. a user created in the Supabase dashboard) → `athlete`, no club.

Either code can be replaced via the `regenerate_invite_code(p_kind)` RPC —
`SECURITY DEFINER`, staff-only, scoped to the caller's own club. It lives server-side because
a new code must stay unique across *both* code columns, which a client cannot guarantee.
Surfaced as "Get a new code" inside the Add athletes / Add coaches dialogs.

### Roles and club managers

`profiles.role` is only ever `athlete` or `staff`. The manager tier is a **separate flag**,
`profiles.is_club_manager`, *not* a third role value — 21 RLS policies compare
`user_role() = 'staff'`, and a new role value would mean editing every one of them.

| Can | Athlete | Coach (`staff`) | Club manager (`staff` + flag) |
|---|---|---|---|
| Use the web dashboard | ✗ | ✓ | ✓ |
| Remove an athlete | ✗ | ✓ | ✓ |
| Remove a coach | ✗ | ✗ | ✓ |
| Rename / recolour the club | ✗ | ✗ | ✓ |
| Change who manages the club | ✗ | ✗ | ✓ |

Enforced by `remove_club_member`, `restore_club_member` and `set_club_manager`
(`SECURITY DEFINER`, staff-only, own club only). The **last remaining manager cannot be
removed or demoted** — enforced in those functions, not in the UI.

### Removal is soft, never a delete

`profiles.removed_at` marks a member as gone. Hard deletion is impossible anyway:
`match_feedback`, `tasks`, `events`, `matches` and `match_plans` all reference `profiles`
with `ON DELETE NO ACTION`, and cascading would destroy athlete feedback history that
belongs to the club rather than the departing member.

Access is revoked through a single chokepoint — `user_club_id()` and `user_role()` both
filter on `removed_at IS NULL`, so **every policy built on them denies removed members with
no policy changes at all.**

> **Never take `role` from `raw_user_meta_data`.** That field comes from the client-supplied
> `options.data` of `supabase.auth.signUp()`, and the anon key ships in the client bundle —
> so a client can set it to anything. Before this was fixed, anyone holding a club's invite
> code (i.e. every athlete in it) could register as staff of that club with one API call.
> Hardcoding the role in the signup UI enforces nothing. Role must stay server-derived.

> **RLS cannot restrict columns.** The `Users can update own profile` policy allows UPDATE
> where `id = auth.uid()`, which for a while let any athlete run
> `update profiles set role='staff'` on themselves and become staff — no invite code needed.
> Column-level privileges are the fix: `authenticated` holds UPDATE on only
> `full_name, avatar_url, language, push_token`. **Any new privileged column on `profiles`
> is protected by default — never add it to that grant.**

## Supabase Edge Functions

| Function | Purpose |
|---|---|
| `process-feedback` | Takes `feedback_text`, `action_point`, `athlete_language` → calls `gpt-4o-mini` → returns structured + translated `{ feedback, action_point }` |
| `send-notification` | Takes `{ tokens, title, body, data }` → calls Expo Push API |
| `football` | Sportmonks proxy — `ping` / `search` / `fixtures`. Holds `sportsmonks_api_key`; returns our own `{ teams }` / `{ fixtures }` shape |

## Athlete app — tabs

| Tab | Component | Notes |
|---|---|---|
| Home | `ThisWeekSection` | Match week card, focus areas, upcoming events strip |
| Feedback | `FeedbackSection` | Unread/read feedback cards, emoji reactions, athlete reply |
| Schedule | `ScheduleSection` | Accordion day list (bold, full-width), event detail sheet |
| Tasks | `TasksSection` | Assigned tasks with due dates and completion |
| Progress | `ProgressSection` | Placeholder — Phase D |

## Staff — mobile screens

| Screen | Notes |
|---|---|
| `StaffHomeScreen` | Athlete list, 2×2 quick actions (Feedback / Task / Training / Match), modals for each |
| `StaffAthleteDetailScreen` | Per-athlete view: stats, full feedback history, task list, quick feedback/task modals |

## Staff — web dashboard tabs

All tabs are built and backed by live Supabase queries (no mock data).

| Tab | Notes |
|---|---|
| Overview | KPI cards (athletes, unread feedback, pending/overdue tasks) + upcoming matches & events |
| Athletes | Athlete list with per-athlete task/feedback counts → `AthletesClient` detail |
| Calendar | Month grid, events + matches, athlete filter, day panel. Add / edit / remove per item, "Clear this day", matchday editor (meet time, meeting point, notes), restore for hidden fixtures |
| Feedback | Athlete list → history; compose modal with AI process-and-preview before sending |
| Tasks | Table with filters/search, complete/delete inline, assign-task modal |
| Groups | Create/edit/delete groups, manage members, slide-in side panels |
| New event | Category picker → per-type form (**match** / training / home / rehab / meeting / generic / vacation) |
| Club | Club name + colour (manager only), staff and athlete lists, promote/demote, soft removal, invite codes |
| Profile | Your own account — name, email, role, club, joined date. Name and language are editable |

### Web UI conventions

- **Never write raw hex or `rgba()` in components** — use the tokens in `globals.css`.
- **Slide-in side panels** (Groups, Calendar) sit at `translateX(100%)` while closed. Their
  container must use `overflow: clip`, **not** `overflow: hidden` — `hidden` still creates a
  scrollable overflow area, and focusing anything inside a closed/animating panel makes the
  browser scroll it into view, permanently shifting the page sideways.
- **Avoid native `<select>`** — the OS-rendered option list ignores the dark theme and is
  unreadable on Windows. Use a custom dropdown (see `AthleteSelect` in `TasksTab.tsx`).
- **Never use `<input type="date">`** — same problem, an OS-drawn popup that ignores the
  theme. Use `components/DateField.tsx`. Its `min` prop both disables earlier days *and*
  decides the opening month, so an end-date field lands on the start date's month rather
  than today.
- **Club colour is three tokens, not one.** `--accent-solid` is the true colour (fills,
  button backgrounds), `--accent` is a lightened variant guaranteed readable on the dark
  background (text, icon strokes), `--accent-on` is black or white for labels sitting on
  the solid colour. All derived by `accentTokens()` in `lib/clubTheme.ts`, called by both
  the server layout and `DashboardShell` so they cannot drift. Hardcoding `#fff` on an
  accent background made yellow clubs unreadable at 1.92:1.
- **The palette is curated, not free-form** — 18 football-informed colours in
  `lib/clubTheme.ts`. `nearestClubColor()` maps an arbitrary hex (e.g. sampled from a club
  badge) onto the nearest one using CIELAB distance.
- **Say "staff", never "coaches"** in UI copy — physios and analysts need dashboard access
  without being coaches. The `role` value is `'staff'`; the wording follows it.

## UI system

**Glass cards** use `expo-blur` `BlurView` (iOS) with `rgba` background overlay.

**Background gradient pattern** (all main screens):
```tsx
const orbs = clubGradientOrbs(profile?.club_color ?? '#3B82F6');
// top orb: 35% opacity, bottom orb: 18% opacity
// base: #080C1E
```

**Schedule/Calendar design language:** Full-width rows, no cards/borders. Day name is 36px / 800-weight / uppercase. Single 1px divider between days. Matches the bold editorial aesthetic of the reference design.

**SlideUpSheet:** Drag handle + spring animation open/close. Backdrop tap to dismiss. Scrollable content area.

## Test accounts

| Email | Password | Role |
|---|---|---|
| `coach@test.no` | `test1234` | Staff |
| *(athlete accounts created via invite code from staff club)* | | |

To get the invite code for a club:
```sql
SELECT name, invite_code, primary_color FROM clubs;
```

## Known gaps / next priorities

> **Nothing in the staff web app has been verified signed in.** Everything below the login
> is built, typechecked and production-built, but Claude cannot enter a password, so the
> whole authenticated surface — club creation, Club page, Calendar editing and deletion,
> the Match paste form — has only ever been exercised at the database layer or rendered
> statically. Assume UI-level bugs remain until a human clicks through.

**Web — highest value next**

- **The Match paste form has never rendered.** `lib/parseFixtures.ts` has 37 passing unit
  tests, but the confirm table and the insert are unexercised. Most likely place for a bug.
- **`database.types.ts` drifts** — it is hand-maintained and was already missing five
  columns once. Sweep it against the live schema when touching data code.
- **Fixture sync has no visible state.** It is silent by design, but the Club page should
  show "Fixtures updated 5 minutes ago · Refresh" so a coach can retry after an outage.
- **Cancelled fixtures linger.** If a match disappears from the provider feed entirely,
  nothing prunes the stored row.
- **Sportmonks is on the free plan** — Danish Superliga and Scottish leagues only. Norwegian
  clubs return nothing from search until the plan is upgraded.

**Mobile — untouched this cycle, and now behind the web app**

- **No invite-code display** — a coach working purely from mobile cannot onboard anyone.
- **Ignores `removed_at`** — a removed athlete just sees empty queries, with no explanation.
- **No styling for `home` / `rehab` / `vacation`** event types the web app creates.
- **Knows nothing about the new match fields** — `meet_time`, `meet_location`, `notes` and
  `opponent_logo_url` are the whole point of matchday for an athlete, and the app does not
  read them yet. This is the biggest single gap between what the staff app produces and
  what athletes see.
- **Progress tab** — still a placeholder.

**Both apps**

- **Settings** — mobile still has no UI to change language post-signup. The web Profile
  tab now does, and signup hardcodes `en`, so web is currently the only way to set `no`.
- **GDPR / minors** — no retention policy, no deletion path, no processor agreement. Not a
  polish item: it is the sort of thing a professional club's safeguarding officer asks about
  before signing, and athletes may be under 18.

**External fixture data — Sportmonks (integrated, plan-gated)**

Provider: **Sportmonks** (`api.sportmonks.com/v3/football`). Chosen after API-Football
suspended the account with no reachable support — an unacceptable dependency risk — and
because its Norwegian coverage is deeper: 3. divisjon (4th tier) groups, Junior, both
women's tiers, women's cup and U19 cup.

Key lives in the Supabase secret **`sportsmonks_api_key`** (note that spelling). Auth is
`?api_token=` or an `Authorization` header — either works, unlike API-Football's
"x-apisports-key must be the only header" rule.

All calls go through `supabase/functions/football/index.ts`, which returns our own
`{ teams }` / `{ fixtures }` shape. **That seam is the reason swapping provider cost one
file** — the wizard, colour extraction, schema and UI never see provider types.

```
GET /teams/search/{name}?include=country
GET /fixtures/between/{from}/{to}/{teamId}?include=participants;league
```

There is no "next N fixtures" endpoint; a date range from today is the documented approach.
Home/away comes from `participants[].meta.location`, not field order.

| Field | Use |
|---|---|
| team `id` | → `clubs.external_team_id` |
| team `image_path` | → `clubs.external_badge_url` (**must be stored** — not derivable from the id, unlike API-Football) |
| team `gender` | distinguishes women's sides without guessing from the name |
| fixture `id` | → `matches.external_id`, so a re-sync upserts |

**Free plan is Danish Superliga only.** Verified: `brondby` returns Brøndby IF with current-season
fixtures; `glimt` and `rosenborg` return nothing. Norwegian clubs need a paid plan. Current
seasons *are* available on free within that one league, which API-Football's free tier could
not do at all.

**Badges** — `cdn.sportmonks.com`, 150×150 PNG. Verified: the host sends CORS headers, so
`badgeColor.ts` can read pixels off a canvas client-side (a control fetch to a non-CORS host
is blocked in the same context, so the pass is real). Missing crest → fall back to a circle
in the club colour. Never store the image itself.

**There is still no club → teams hierarchy.** Senior, reserve, youth and women's sides are
separate records sharing a name, so linking must ask **"which team do you coach"** before
searching. `gender` helps; nothing identifies age group, so a youth coach may still see only
the senior side.

**How the sync actually runs.** `DashboardShell` triggers it on mount when the club has an
`external_team_id` and the last sync is over 6h old (`isSyncStale`). It is deliberately
silent and un-awaited so a provider outage cannot block the dashboard. The edge function
returns fixtures; the `sync_external_fixtures(jsonb)` RPC writes them, taking the club from
the caller's own profile so a client cannot push fixtures into someone else's club.

Consequences worth knowing: the throttle lives on the club row, so ten staff opening the
dashboard produce **one** request between them — a ceiling of 4/club/day. Squad size and
staff count are irrelevant; it scales with clubs only. But it only runs when a staff member
opens the **web** dashboard, so athletes on mobile never trigger it. A scheduled job is the
eventual fix and would *reduce* requests (1/club/day) while improving freshness.

Sportmonks limits are **per entity, per hour** (Free 3,000 · Starter 2,000 · Growth 2,500 ·
Pro 3,000), with no monthly quota. Tiers buy *leagues*, not calls: Starter 5, Growth 30,
Pro 120, plus extra leagues from €4/mo. Full Norwegian coverage is ~16 leagues.

**Manual entry stays first-class.** Coverage will never be complete, so `NewEventTab`'s Match
category offers paste-a-fixture-list (parsed by `lib/parseFixtures.ts`, confirmed row by row)
alongside single-match entry. Everything it writes is `source = 'manual'` and is therefore
untouchable by a sync.

**Mobile feel — blocking the launch bar**

The app has `react-native-reanimated` v4 installed but **does not use it for gestures**.
`SlideUpSheet.tsx` and the `BottomSheet` in `LandingScreen.tsx` both drive drag with
`PanResponder` + the legacy `Animated` API, which runs on the JS thread — that is the gap
between "works" and "feels native", and it will not reach the bar set above.

Also absent: **`react-native-gesture-handler`** (needed for swipeable rows, drag-to-dismiss
and any real gesture work — it runs on the UI thread) and **`expo-haptics`** (cheap to add,
disproportionate effect on perceived quality).

**Polish / deferred**

- **Dashboard SlideUpSheet (mobile)** — feedback and task cards should use `SlideUpSheet` for
  detail view (component is built, not yet wired to those cards)
- **i18n coverage** — `LandingScreen` fully translated; other screens are English-only
  (acceptable for MVP since EN is default). The web app has no i18n at all.
- **Video integration** — Phase 3, not started
- **Wearable integration** — Phase 4, not started
