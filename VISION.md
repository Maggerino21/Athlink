# Athlink — Product Vision
*Updated April 2026*

---

## What Athlink is

**Athlink is an athlete operating system.** A single, living hub that becomes the one place athletes and their staff need to communicate, plan, and track development.

The core problem: athletes receive fragmented input from multiple people across multiple platforms — coach texts here, physio emails there, training plan in a PDF somewhere else. Nobody has the full picture. Things get missed. Feedback gets forgotten. Development is inconsistent.

Athlink fixes this by making one place the source of truth for everything that matters to an athlete's development.

---

## What Athlink is not

- A chat app (WhatsApp already won that — we don't compete)
- A video platform
- An analytics tool
- A replacement for specialized tools (wearables, nutrition apps, GPS trackers)

Athlink is the **hub** that sits above all of these — the place where all the signals come together and become actionable.

---

## The two sides

### Athlete (mobile-first)

The athlete opens Athlink and immediately knows what they need to do, what their staff said, and what's coming up. No hunting across apps. No missed messages.

**Current tabs:**
- **Home** — This week at a glance: match, key focus areas, upcoming events
- **Feedback** — Everything coaches and staff have said, structured and clear. Athlete can react with an emoji and reply.
- **Schedule** — Bold, full-width calendar view. Today through two weeks out. Tap any day to expand events. Tap an event for full detail.
- **Tasks** — Assigned work with deadlines. Recovery programs, video review, assessments.
- **Progress** — *(coming)* How am I developing over time?

**Design principles for the athlete app:**
- The athlete should understand their week in 10 seconds
- Never make them hunt for information — it surfaces to them
- The UI should feel personal and polished, not like a sports admin tool

### Staff (mobile + web eventually)

Staff use Athlink to communicate with athletes in a structured way, coordinate with other staff, and track compliance and development.

**Current screens:**
- **Home** — See all athletes in the club. Quick actions: give feedback, assign task, create training event, log a match.
- **Athlete detail** — Full view of one athlete: unread feedback count, pending tasks, complete feedback history (with athlete reactions and replies), task list.

**Staff app principles:**
- Coach feedback → AI structures and translates it → athlete receives it clearly in their language
- All staff perspectives on one athlete in one place (coach, physio, doctor eventually)
- Coordination happens here, not in group chats

---

## The AI layer

AI in Athlink is supportive and invisible — never authoritative.

**What it does:**
1. Takes a coach's raw observation ("needs to press earlier in transition, not reading the trigger")
2. Structures it into: What / Why / Action
3. Translates it into the athlete's language (Norwegian, French, etc.)
4. Returns a draft — coach reviews and edits before sending

**What it never does:**
- Make judgments about athletes
- Replace coaching decisions
- Show the athlete it's making calls on their behalf

The AI layer is currently powered by OpenAI `gpt-4o-mini`. The cost per feedback item is negligible.

---

## Club identity

Each club chooses a primary colour at signup. That colour becomes the app's theme for all members of that club — background gradients, accent bars, today highlighting. Subtle but meaningful: the app feels like *their* app, not a generic tool.

Future: club logo, custom welcome messages, club-specific content sections.

---

## Communication model (not chat)

```
Coach observes something
        ↓
Enters observation (form or natural text)
        ↓
AI structures + translates into athlete's language
        ↓
Coach reviews draft, edits if needed, sends
        ↓
Athlete receives on dashboard — What / Why / Action
        ↓
Athlete reacts (emoji) + optionally replies
        ↓
Coach sees reaction + reply in athlete detail view
        ↓
History preserved — both sides can see the full arc
```

This loop creates accountability, continuity, and clarity. After 6 months, a coach can see every piece of feedback they've given an athlete and whether it landed. An athlete can see every theme their staff has focused on.

---

## Business model

**Primary:** Subscription per club per month  
**Target price:** €150–400/month depending on club level (academy vs. professional)  
**Who pays:** The club, not individual athletes  
**Value:** Saves admin time, improves feedback clarity, creates development continuity

**Why clubs pay:**
- They already pay for tools that do less
- Clear ROI: better feedback → better athlete buy-in → better development
- Data lock-in grows over time (2 years of feedback history = network effect)

**Future revenue:**
- Agency and management tools (higher tier)
- Athlete premium features (career profile, opportunity alerts)
- Marketplace: scouts, agents, sponsors access athlete profiles
- Transaction fees on contracts/sponsorships processed through platform

---

## Expansion roadmap

The platform is designed to expand in deliberate phases. Each phase makes the core stickier — it doesn't dilute the experience.

| Phase | Focus | Status |
|---|---|---|
| 1 | Auth, feedback loop (coach → athlete), acknowledgement | ✅ Done |
| 2 | AI feedback translation + structuring, events, schedule, club theming | ✅ Done |
| 3 | Emoji reactions, athlete reply, push notifications, invite system | ✅ Done |
| 4 | Progress tab, staff web app, settings screen, invite code UI | 🔜 Next |
| 5 | Video integration (coach uploads clip, links to feedback) | Planned |
| 6 | Wearable data (Apple Health, Whoop, Oura) | Planned |
| 7 | Nutrition & recovery tool integrations | Planned |
| 8 | Community layer (athletes connect, peer coaching, mentorship) | Planned |
| 9 | Marketplace (scouts, agents, sponsors discover athletes) | Planned |
| 10 | Payments & contracts (sponsorships, appearance fees through platform) | Long-term |

**Expansion principle:** Don't build the next phase until the current one is working well in a real pilot. Each phase should make the existing experience better, not just add surface area.

---

## What success looks like at each stage

**Phase 1 pilot (1–2 clubs):**
- Coach can give feedback in under 2 minutes
- Athlete sees it clearly and knows what to do
- Acknowledgement rate > 80%

**Phase 2 (5–10 clubs):**
- Clubs actively using the schedule feature
- AI translation reducing confusion for multilingual squads
- Coaches prefer Athlink over WhatsApp for development comms

**Phase 3 (paying clubs):**
- Clubs renewing subscriptions without being asked
- Athletes checking the app daily without prompting
- Staff from different roles (coach + physio) both using the platform

---

## Pitfalls to avoid

- **Scope creep** — resist adding features before the core loop is nailed
- **Becoming a chat app** — every time someone asks for messaging, ask what the real need is. Usually it's structured feedback or a task.
- **AI hallucination breaking trust** — the coach always reviews before sending. Never auto-send AI output.
- **Data silos** — if physio can't see coaching focus or coach can't see medical flags, the whole system breaks
- **Onboarding friction** — if first session takes > 15 minutes, adoption dies. Ruthlessly simple.

---

## The long vision

In 5 years, a professional athlete should be able to look back at their entire career development arc through Athlink — every piece of feedback, every focus area, every milestone, every staff member who shaped their development. The platform becomes a living record of who they are as an athlete.

At the same time, clubs should be able to look at their entire squad and see, with one view, who's on track, who needs attention, who's responding well to coaching, and what themes are emerging across the team.

That's the flywheel: more data → better insights → more value → more clubs → more athletes → more data.
