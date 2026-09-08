# Athlink — Developer Reference

## Stack

| Layer | Technology |
|---|---|
| Mobile app (`app/`) | Expo SDK 57 / React Native 0.86 (iOS primary) |
| Staff web app (`web/`) | Next.js 16 (App Router) / React 19 / Tailwind v4 |
| Language | TypeScript (strict) |
| Backend | Supabase (Postgres + Auth + Edge Functions + Storage) |
| AI | OpenAI `gpt-4o-mini` via Supabase Edge Functions |
| Push notifications | Expo Push Notifications (`expo-notifications`) |
| i18n | `react-i18next` + JSON translation files (EN / NO) — mobile only |
| Navigation | React Navigation v6 — NativeStack (mobile) |
| Animation | Reanimated 4 worklets + `react-native-gesture-handler` (mobile) — UI thread only |
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
        PressableScale.tsx  # Standard tap target — UI-thread press feedback
        SlideUpSheet.tsx    # Reusable bottom sheet (slides up ~62% screen)
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
      haptics.ts          # the only entry point for haptics — six named intents
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

**Detail views are native iOS sheets, not components.** Tapping an event or the daily
briefing navigates to a route in `RootNavigator`'s athlete sheet group, presented with
`presentation: 'formSheet'` — i.e. `UISheetPresentationController`. iOS owns the detents
(`sheetAllowedDetents: 'fitToContents'`), the grabber, interactive dismissal,
scroll-to-expand, the stacked-card recede of the screen behind, and the sheet's own Liquid
Glass material on iOS 26.

The sheet screens draw **content only** — never add a drag handle, backdrop or close
button, because the presentation already supplies all three.

Because it is a route, the detail data travels as navigation params. `CalEvent` is a flat
object of primitives so it is serialisable; pass it directly rather than refetching what
the list already had.

`components/ui/SlideUpSheet.tsx` is the superseded hand-built version — kept for reference,
used by nothing. **Don't wire it back in.** Feedback and task detail views should become
sheet routes in the same group.

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
`CalendarTab` colour-maps all of them. The mobile app covers all nine in `EVENT_META`
(ScheduleSection) and `EVENT_ICONS` (ThisWeekSection); keep those two in sync.

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
- **Progress tab** — still a placeholder.
- **Mobile is English-only below the landing screen.** 171 translation keys exist but only
  `LandingScreen` consumes them, and there is still no way to change language after signup
  (mobile signup *does* have an EN/NO picker — it's the web signup that hardcodes `en`).

**Fixed in the correctness pass** (all verified against production rows):

- **Squad-wide events were invisible.** Both sections filtered to `event_assignments`, but
  an absent row means *whole squad*. Live data had 5 events and 1 assignment row, so an
  athlete saw almost nothing. This could not be fixed client-side — the athlete policy on
  `event_assignments` is `athlete_id = auth.uid()`, so "unassigned" and "assigned to
  someone else" are indistinguishable from the client. Resolved by the
  `visible_events_for_me(from, to)` RPC (`SECURITY DEFINER`), which keeps assignment
  details private while answering correctly. **Use it for any athlete-facing event read.**
- **Kick-off times displayed in UTC.** `ScheduleSection` did `iso.slice(11, 16)`, reading
  the UTC portion straight off the wire — a 20:00 Oslo fixture rendered as 18:00, and
  Schedule disagreed with Home by two hours about the same match. `localTime()` /
  `localYMD()` now do this; **never slice a timestamptz string.**
- **Suppressed fixtures reappeared on mobile** — no `suppressed_at IS NULL` filter on any
  of the three `matches` reads.
- **Multi-day events collapsed to day one.** `end_date` was read nowhere in `app/`.
  `expandEvent()` now spans them, tagged `spanDay` / `spanTotal`, capped at 60 days.
- **Matchday fields are now read** — `meet_time`, `meet_location`, `notes` and
  `opponent_logo_url`. Meet time and place lead the detail sheet, above kick-off, because
  that is what an athlete opens it to find.
- **`removed_at` is now honoured** — `RootNavigator` shows a plain-language explanation and
  a sign-out button instead of silently empty tabs.

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

**Mobile feel — the animation stack**

Everything animated now runs as a Reanimated worklet on the UI thread. `PanResponder` and
the legacy `Animated` API are gone from `app/` entirely — **do not reintroduce either.**
The rule: if a value changes while a finger is down, it belongs in a worklet.

- **`react-native-gesture-handler`** drives every gesture. `GestureHandlerRootView` wraps
  the tree in `App.tsx` and must stay outermost with `flex: 1`.
- **`utils/haptics.ts`** is the only entry point for haptics — six named intents, all
  fire-and-forget so a failure can never surface. Don't call `expo-haptics` directly.
- **`components/ui/PressableScale.tsx`** is the standard tap target. It uses a
  gesture-handler Tap rather than `Pressable` so the press-down visual starts on the UI
  thread instead of waiting for a JS round-trip.

> **The worklets babel plugin is injected by `babel-preset-expo` automatically** whenever
> `react-native-worklets` is present (it is, via Reanimated 4). `babel.config.js` used to
> *also* list `react-native-reanimated/plugin` — which re-exports the same plugin — so it
> was applied twice. Don't add it back. Note the v4 rename: the plugin is
> `react-native-worklets/plugin` now, not the Reanimated one.

> **`react-native-worklets` must be pinned to the exact version in
> `expo/bundledNativeModules.json`** — `0.10.1` on SDK 57. It is not a direct dependency by
> nature: it arrives transitively via Reanimated, which declares a loose range and so
> resolves to something newer. But Expo Go ships the *native* half at exactly the bundled
> version, and a newer JS half throws at startup:
> `Mismatch between JavaScript part and native part of Worklets (0.7.2 vs 0.5.1)`.
>
> Any `npm install` that re-resolves the tree can reintroduce the drift, and **every SDK
> upgrade changes the required version** — re-pin it as part of the upgrade. Reanimated
> itself compares only major.minor, so its own patch drift is harmless.

**Never layer anything on top of real Liquid Glass.** `expo-glass-effect` is bundled in
Expo Go and resolves on any iOS 26 device, so `GlassView` gives us Apple's actual
`UIGlassEffect` — the same one Expo Go's own tab bar uses. It draws its own edge, specular
highlight and shadow. Both `LiquidGlassTabBar` and `SlideUpSheet` used to apply it and then
bury it under a hand-built imitation — a 1px white border, gradient speculars, a manual
shadow, `overflow: 'hidden'`, and in the sheet's case an **85%-opaque fill directly over a
BlurView**, which made the blur invisible while still paying for it. The native path must
stay bare.

Gate on **both** `isLiquidGlassAvailable()` *and* `isGlassEffectAPIAvailable()`. The second
is not redundant: some iOS 26 builds report the design as available while the API is
missing, and that crashes rather than degrading.

Use **`GlassContainer`** when two glass elements should merge — its `spacing` prop is what
makes the tab bar's indicator flow into the bar as it travels instead of sliding over it as
a separate pane. Without the container they ignore each other.

The hand-layered `BlurView` stack is still correct as the pre-iOS-26 / Android fallback, and
lives in the `else` branch. Keep the two paths separate rather than trying to unify them —
they want opposite things.

> **Skia is not the answer to glass.** Shader-based approaches (`@shopify/react-native-skia`
> and the various `react-native-liquid-glass*` packages) exist to *simulate* this effect
> where the platform lacks it. We have the real API. A hand-written refraction shader would
> be more code, more GPU, and still not match, since Apple's samples the live backdrop and
> responds to Reduce Transparency. Skia earns its place for Android parity or a bespoke
> effect Apple doesn't ship — not here.

> **SDK 57 upgrade notes** (from SDK 54, Sept 2026). Four things broke and are worth
> knowing if you upgrade again:
>
> - **`StyleSheet.absoluteFillObject` was removed** in RN 0.86. `absoluteFill` is now a
>   plain frozen object rather than a registered style ID, so it spreads correctly and is a
>   direct replacement. 11 call sites.
> - **`BottomTabs` / `BottomTabsScreen` became `Tabs.Host` / `Tabs.Screen`** in
>   react-native-screens 4.26 — see the tab bar section below.
> - **`@expo/config-plugins` is no longer hoisted.** It lives under `expo/node_modules`, so
>   `@react-native-community/datetimepicker`'s config plugin cannot resolve it and every
>   `expo export` fails with `Cannot find module '@expo/config-plugins'`. Fixed by adding it
>   as a top-level devDependency, matching the nested version.
> - **Expo packages are renumbered to match the SDK** — `expo-blur` is `57.0.2`, not `15.x`.
>   Don't read those as major-version jumps.

**The athlete tab bar is Apple's, not ours.** `HomeScreen` uses `Tabs.Host` /
`Tabs.Screen` from `react-native-screens` — a real `UITabBarController`. This is the
only way to get authentic Liquid Glass, and the distinction that took several rounds to
find is this: **`expo-glass-effect` gives you the material, not the control.** `GlassView`
is `UIGlassEffect`; the tab bar is something Apple *built on top of* that material, and the
control is what contributes the selection lens that magnifies and displaces content behind
it, the chromatic edge fringing, the lens merging into the bar as it travels, and
scroll-edge/minimize behaviour. A hand-built pill applying the material will always read as
a copy, however carefully it is tuned — that is not a tuning problem.

`react-native-screens` is bundled in Expo Go, so this needs no dev build and no Mac.

- `tabBarTintColor` is not just a label colour — from iOS 26 it drives the glow of the
  Liquid Glass selection lens, so `club_color` flows into Apple's own effect.
- Icons are **SF Symbols** (`icon={{ sfSymbolName }}`), rendered by the bar itself at the
  system's optical size and weight. A bitmap icon does not get the same treatment.
- `tabBarMinimizeBehavior: 'onScrollDown'` is the iOS 26 shrink-on-scroll behaviour.
- **Platform props are nested** under `ios` / `android` since screens 4.26.
- **Selection is native-owned and acknowledged.** There is no per-screen `isFocused` any
  more: you request a tab via `navStateRequest={{ selectedScreenKey, baseProvenance }}` and
  native confirms through `onTabSelected`, handing back a new `provenance`. Store it — it
  is what lets native reject a request built on a stale view (two fast taps) rather than
  applying it out of order.
- `UITabBarController` owns full-screen children, so each tab draws its own background and
  header through `AthleteFrame` rather than sharing one above a pager.
- Tabs are **tapped, not swiped**. Horizontal paging between sections is gone; that is how
  iOS tab bars work, and it was the accepted cost of the switch.

`LiquidGlassTabBar` is retained but **no longer used by the app** — GlassLab still renders
it for comparison. Don't wire it back into `HomeScreen`.

**The old custom tab bar was driven by scroll position, not by a settled index.** `HomeScreen` writes
the pager's offset into a `scrollX` shared value and hands it to `LiquidGlassTabBar`, which
interpolates the indicator, icon cross-fade, label colour and active scale from it. Passing
an `activeIndex` instead would make the bar snap after the swipe rather than track the thumb.

**Athlete sections mount lazily.** Page 0 renders at launch; the rest are mounted by
`InteractionManager.runAfterInteractions` once the first paint is done. All five used to
mount and fire their query batches simultaneously, saturating JS exactly as the app became
visible. Mounting them on page-crossing instead would move the cost into the middle of a
gesture, which is why it's a post-interaction prefetch rather than on-demand.

**Not yet verified on a device.** All of the above typechecks and produces a clean
production bundle (`npx expo export --platform ios`), and the worklets are confirmed to
compile, but no one has run it on hardware. Judge it from a **release** build — dev-mode
Expo Go is not a fair test of any of this.

**Polish / deferred**

- **Dashboard SlideUpSheet (mobile)** — feedback and task cards should use `SlideUpSheet` for
  detail view (component is built, not yet wired to those cards)
- **i18n coverage** — `LandingScreen` fully translated; other screens are English-only
  (acceptable for MVP since EN is default). The web app has no i18n at all.
- **Video integration** — Phase 3, not started
- **Wearable integration** — Phase 4, not started
