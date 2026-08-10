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
                          # TasksTab, GroupsTab, NewEventTab
      athletes/AthletesClient.tsx   # also exports AvatarCircle, reused by other tabs
  components/Sidebar.tsx
  lib/
    auth.ts               # getSessionProfile() — React cache(), one profile fetch/request
    database.types.ts
    supabase/{client,server}.ts
```

**Web navigation is tab state, not routing.** `DashboardShell` holds a `DashTab` in
`useState` and conditionally renders one tab component. The `/dashboard/*` route folders
exist but the sidebar does not navigate to them — it calls `onTabChange`.

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

**No chat.** WhatsApp already won that. Athlink handles structured, contextual, searchable communication. If it's not discoverable and actionable, it belongs in WhatsApp.

**AI = translation + structuring, never authority.** OpenAI `gpt-4o-mini` translates coach observations into clear athlete-language (What / Why / How). Coach always reviews before sending. AI is never shown to the athlete as making decisions.

**One app, two UIs.** Login role determines whether the user sees the athlete dashboard or the staff interface. Same codebase.

**Club theming.** Each club picks a `primary_color` at signup. All background gradients (top + bottom orbs) derive from this color via `clubGradientOrbs()` in `utils/theme.ts`. Athletes in the same club see the same color theme.

**Language per user.** User selects language at signup (EN / NO). Stored on `profiles.language`. Applied via `i18n.changeLanguage()` on login. AI feedback is translated into the athlete's language by the edge function.

**SlideUpSheet pattern.** Tap any content item (event, feedback, task) → sheet slides up from the bottom covering ~62% of screen. Draggable to dismiss. Used for calendar events today; planned for feedback and task detail views.

## Database schema (key tables)

| Table | Purpose |
|---|---|
| `profiles` | Extends `auth.users`. Has `role`, `club_id`, `language`, `push_token`, `avatar_url` |
| `clubs` | `name`, `invite_code` (6-char), `primary_color` |
| `match_feedback` | Coach → athlete feedback. Has `title`, `feedback_text`, `processed_text` (AI), `is_ai_processed`, `action_point`, `athlete_language`, `acknowledged`, `reaction` (emoji), `athlete_reply` |
| `tasks` | Assigned tasks. `title`, `description`, `due_date`, `status`, `assigned_to`, `created_by`, `club_id`, `completed_at` |
| `matches` | Match calendar entries (`opponent`, `match_date`, `is_home`, `location`, `status`) |
| `events` | Generic events. `type`, `title`, `event_date`, `end_date`, `location`, `description`, `pdf_url`, `line_items` (jsonb) |
| `event_assignments` | Joins `event_id` → `athlete_id`. Absent rows = whole squad |
| `groups` | Athlete groupings — `name`, `color`, `description`, `club_id`, `created_by` |
| `group_members` | Joins `group_id` → `athlete_id` |
| `match_plans` | Defined in SQL; **no app or web code reads it yet** |
| `self_assessments` | Defined in SQL; **no app or web code reads it yet** |

RLS is enabled on every table. PDF uploads go to the **`event-pdfs`** storage bucket
(path `{club_id}/{timestamp}_{filename}`), read back via `getPublicUrl`.

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
| Calendar | Month grid, events + matches, athlete filter, day panel. "Add event on this day" hands a prefilled date to the New event tab |
| Feedback | Athlete list → history; compose modal with AI process-and-preview before sending |
| Tasks | Table with filters/search, complete/delete inline, assign-task modal |
| Groups | Create/edit/delete groups, manage members, slide-in side panels |
| New event | Category picker → per-type form (training / home / rehab / meeting / generic / vacation) |

### Web UI conventions

- **Never write raw hex or `rgba()` in components** — use the tokens in `globals.css`.
- **Slide-in side panels** (Groups, Calendar) sit at `translateX(100%)` while closed. Their
  container must use `overflow: clip`, **not** `overflow: hidden` — `hidden` still creates a
  scrollable overflow area, and focusing anything inside a closed/animating panel makes the
  browser scroll it into view, permanently shifting the page sideways.
- **Avoid native `<select>`** — the OS-rendered option list ignores the dark theme and is
  unreadable on Windows. Use a custom dropdown (see `AthleteSelect` in `TasksTab.tsx`).

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

**Missing surfaces**

- **Mobile has no invite-code display** — only the web Overview tab surfaces the codes, so a
  coach working purely from mobile still can't onboard anyone.
- **Mobile ignores `removed_at`** — the web dashboard is gated by RLS, but the mobile app has
  no UI telling a removed athlete what happened; their queries simply return nothing.
- **`InvitePeople.tsx` "get a new code" copy** now understates things: removal *does* exist
  on the Club page, so that dialog could point there instead of saying access is permanent.
- **Settings** — no UI in either app to change language post-signup, rename a club, or
  update `primary_color`
- **Progress tab (mobile)** — placeholder. Needs feedback themes over time, task completion
  rate, timeline view
- **Mobile ↔ web event type parity** — mobile has no styling for the `home` / `rehab` /
  `vacation` types the web app creates (see Event types above)

**Polish / deferred**

- **Dashboard SlideUpSheet (mobile)** — feedback and task cards should use `SlideUpSheet` for
  detail view (component is built, not yet wired to those cards)
- **i18n coverage** — `LandingScreen` fully translated; other screens are English-only
  (acceptable for MVP since EN is default). The web app has no i18n at all.
- **Video integration** — Phase 3, not started
- **Wearable integration** — Phase 4, not started
