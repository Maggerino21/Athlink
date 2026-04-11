# Athlink — Developer Reference

## Stack

| Layer | Technology |
|---|---|
| Mobile app | Expo SDK 55 / React Native (iOS primary) |
| Language | TypeScript (strict) |
| Backend | Supabase (Postgres + Auth + Edge Functions + Storage) |
| AI | OpenAI `gpt-4o-mini` via Supabase Edge Functions |
| Push notifications | Expo Push Notifications (`expo-notifications`) |
| i18n | `react-i18next` + JSON translation files (EN / NO) |
| Navigation | React Navigation v6 — NativeStack |
| UI | Custom glass system (`GlassCard`, `LiquidGlassTabBar`, `SlideUpSheet`) |

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
```

## Key architectural decisions

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
| `match_feedback` | Coach → athlete feedback. Has `feedback_text`, `processed_text` (AI), `is_ai_processed`, `action_point`, `acknowledged`, `reaction` (emoji), `athlete_reply` |
| `tasks` | Assigned tasks with `due_date`, `status` (pending/completed/overdue) |
| `matches` | Match calendar entries (`opponent`, `match_date`, `location`) |
| `events` | Generic events (`type`, `title`, `event_date` timestamp, `location`, `description`) |

### Event types
`training` · `exercise` · `recovery` · `travel` · `meeting` · `other` (plus `match` from the matches table)

### Club signup flow (DB trigger `handle_new_user`)
- Staff "Create team": generates 6-char `invite_code`, creates club with `primary_color`, creates profile linked to club
- Staff/Athlete "Join team": looks up club by `invite_code`, creates profile linked to that club

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

## Staff app — screens

| Screen | Notes |
|---|---|
| `StaffHomeScreen` | Athlete list, 2×2 quick actions (Feedback / Task / Training / Match), modals for each |
| `StaffAthleteDetailScreen` | Per-athlete view: stats, full feedback history, task list, quick feedback/task modals |

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

- **Progress tab** — currently a placeholder. Needs: feedback themes over time, task completion rate, timeline view
- **Settings screen** — no UI yet to change language post-signup or update club color
- **Invite code display** — staff has no in-app way to see/share their club's invite code
- **Staff web app** — not started. Currently staff uses the mobile app only
- **Dashboard SlideUpSheet** — feedback and task cards should use `SlideUpSheet` for detail view (component is built, not yet wired to those cards)
- **i18n coverage** — `LandingScreen` fully translated. Other screens are English-only (acceptable for MVP since EN is default)
- **Video integration** — Phase 3, not started
- **Wearable integration** — Phase 4, not started
