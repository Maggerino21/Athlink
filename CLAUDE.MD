# Athlink: Athlete Operating System
## Comprehensive Project Definition

### 1. Product Vision & Core Concept

**Athlink is an athlete operating system** — a single, living dashboard that becomes indispensable because it's the source of truth for everything an athlete needs to know and do.

The product is not:
- Another video platform
- Another analytics tool
- A generic team chat app
- A replacement for specialized tools (wearables, nutrition apps, video analysis)

**What Athlink is:**
- A coordination and communication hub for athletes
- A dashboard that pulls together staff communications, training, planning, progress tracking, and personal development
- An evolving platform that intentionally adds functionality over time to remain the quintessential media for athletes
- A tool that ensures alignment between coaches, physios, doctors, and athletes through structured communication (not chat)

**Core Problem Solved:** Athletes receive fragmented communication from multiple staff members across multiple platforms, leading to misunderstandings, inconsistent feedback, and poor continuity in development. Athlink creates a single source of truth.

### 2. Product Architecture: Two-Sided Design

#### Athlete App (Mobile-First)
The athlete opens Athlink and sees a unified dashboard with everything they need to know:

**Top-level sections:**
- **This week**: What am I supposed to do? (training programs, focus areas, key events)
- **Feedback**: What did staff say about me? (unread, recent, from coaches/physios/doctors)
- **Tasks/Assignments**: Programs, recovery work, or specific tasks assigned by staff with deadlines
- **Calendar**: What's coming up? (sessions, events, assessments, appointments)
- **Progress**: How am I doing? (personal metrics, wins, trends, improvements over time)
- **Resources**: What should I consume? (videos, articles, programs assigned by staff)

**Secondary sections (expandable):**
- **My Goals**: Personal goals separate from team/coach goals (nutrition targets, sleep quality, strength improvements, etc.)
- **Messages/Notifications**: Unread feedback, reminders, updates from staff
- **Community** (Phase 6+): Connect with other athletes, peer coaching, mentorship

**Key principle:** The athlete never needs to think about where information is. Everything appears on this dashboard. Staff adds something → it shows up in the right section → athlete knows what to do.

#### Staff App (Web Primary + Mobile Secondary)
**Web interface (laptop/desktop):** Heavy lifting and coordination
- **Team overview**: See all athletes, their status, pending tasks, compliance with programs
- **Athlete profiles**: Deep dive into one athlete—all feedback, programs, progress, notes, coordination with other staff
- **Create/manage programs**: Build training programs, assign them to athletes with deadlines
- **Bulk feedback**: Write feedback for multiple athletes at once
- **Analytics**: Trends, compliance (who completed assigned programs?), feedback patterns
- **Calendar management**: Schedule sessions, events, assessments
- **Communication center**: All staff updates live here—physio notes, doctor flags, coach observations all visible to relevant staff

**Mobile interface (for on-the-go):**
- Quick feedback entry
- See athlete status (availability, load capacity, injury status, recent metrics)
- Review assigned programs
- Receive physio/doctor flags in real-time
- Mark tasks complete or flag athletes

**Key principle:** The staff app is where coordination happens between coaches, physios, doctors, and other support staff. One athlete, one view, all perspectives visible.

### 3. Core Communication Model

#### Feedback Loop (Structured Communication, Not Chat)
1. **Coach observes**: "X player needs to press earlier in transition" (can be entered as structured form or natural text via AI parsing)
2. **AI layer processes**: Translates observation into clear, actionable guidance
3. **Player receives**: "This week: Press earlier. Why: Regaining shape in transition. Action: Watch footage from min 15–22, notice the trigger point" — not ambiguous, not jargon
4. **Player confirms**: Taps "I understand" or "I have questions" — creates acknowledgement record
5. **History preserved**: Coach can see later if this feedback was repeated, what the player did with it, how they improved

**AI role (supportive, invisible, never authoritative):**
- Translates coach language → clear, actionable player language
- Structures feedback consistently (What? Why? How will we know?)
- Converts abstract observations into concrete actions
- Summarizes patterns and development themes
- Maintains context over time ("You've been asked to focus on X five times, Y three times…")
- AI is NOT used to judge players, replace coaching decisions, or make medical/tactical calls

#### Task Assignment (New Feature)
Coaches can assign specific tasks with deadlines that appear on athlete's dashboard:

**Example:** Coach writes "X player needs the recovery program for Wednesday"

**System flow:**
1. Coach creates task (via form: select player → select program → set deadline)
2. System creates task object with deadline
3. Player sees on dashboard: "Complete recovery program by Wednesday"
4. Player marks complete when done
5. Coach sees completion status and can track patterns over time

**Why this matters:** Creates accountability, tracks compliance, ensures critical activities (recovery work, specific programs) actually get done by the deadline.

**Implementation difficulty:** 2–3 hours for basic version (form-based), +1–2 hours for AI parsing of natural language, +1–2 hours for notifications/reminders.

### 4. Technology Stack & Implementation Approach

#### Frontend
- **Framework**: Expo (React Native)
- **Rationale**: 
  - Single codebase for iOS + Android
  - Mobile-first product (coaches review feedback on sideline, athletes check tasks during week)
  - Fast iteration with OTA updates (critical for real-world pilots)
  - No native code needed for MVP
- **Structure**: One app, two entry points (login determines whether user sees athlete or staff UI)
- **UI**: React Navigation for navigation, minimal custom components initially

#### Backend
- **Language**: Node.js + Express (or Python FastAPI if preferred)
- **Database**: PostgreSQL
- **Hosting**: Railway or Render (simple deployments, good for iteration)
- **Key components**:
  - Role-based auth and permission system
  - Structured data API (feedback, tasks, programs, athletes, teams)
  - LLM integration endpoint (Claude API for feedback translation/parsing)
  - Notification system (Expo Notifications for mobile)

#### Security & Data
- Expo SecureStore for auth tokens (not AsyncStorage)
- All sensitive data lives on backend (not on device)
- Role-based access control (player only sees their own data, coaches see their team, physios see their patients, etc.)

### 5. MVP Strategy: Phased Approach

**Phase 1 (MVP - Weeks 1–2):**
- Auth with role detection
- Coach feedback input (form-based, no AI yet)
- Player feedback view
- Basic API connectivity
- Player "I understand" acknowledgement

**Phase 2 (Week 3):**
- AI translation layer (coach observation → clarified action points)
- Coach sees translation before sending, can edit
- Simple feedback history (last 4 weeks per player)

**Phase 3 (Week 4+):**
- Task assignment feature (coach assigns recovery program → player completes by deadline)
- Physio read-only layer (can see coaching focus and add notes)
- Notifications when feedback arrives or task assigned
- Team overview dashboard for coaches

**Future phases (not in initial MVP):**
- Doctor role and medical flag system
- Advanced progress tracking and analytics
- Video integration (coach uploads video, links to feedback)
- Wearable data integration (Apple Health, Whoop, Oura, etc.)
- Community layer (athletes connect, share tips, mentor)
- Marketplace/opportunities layer (scouts, agents, sponsors access profiles)
- Payment system and contract management

### 6. Expansion Roadmap (The "Never Stops" Vision)

Athlink is designed as a platform that intentionally expands over time without losing focus:

**Phase 1 (MVP):** Feedback, programs, tasks, events
**Phase 2:** Progress tracking, athlete metrics, goal setting
**Phase 3:** Video integration (coach uploads video, links to feedback)
**Phase 4:** Wearable data (pull from Apple Health, Whoop, Oura)
**Phase 5:** Nutrition & recovery tools (integrate with MyFitnessPal, etc.)
**Phase 6:** Community layer (athletes connect within platform, peer coaching, mentorship)
**Phase 7:** Marketplace (scouts, agents, sponsors access athlete profiles; athletes see opportunities)
**Phase 8:** Payments & contracts (sponsorships, appearance fees, training fees through platform)

**Expansion principles:**
- Each phase should make the app more sticky and valuable
- Expand into adjacent needs, not into competition with specialized tools
- Integrate with external tools (video platforms, wearables, nutrition apps) rather than replace them
- Always keep athlete dashboard as the hub, not a shrunk-down version of staff tools
- Only expand when the current phase is working well

### 7. Business Model & Value Proposition

#### Primary Revenue Model
- **Subscription per team/per month** (clubs pay, not individual athletes)
- **Indicative pricing**: €150–400 per team/month (depending on level: academy vs. elite club)
- Reduces friction and improves alignment, saves time immediately
- Value increases over time through historical data and continuity

#### Why This Works
- Teams already pay for tools
- Clear ROI: better feedback clarity = better compliance = better development
- Network effects develop over time (athlete can't leave because they have 2+ years of feedback history and community connections)

#### Future Revenue Opportunities (Later)
- Agency/management tools (higher tier)
- Athlete premium features (insights, peer coaching, opportunity alerts)
- Data and analytics for talent scouting (anonymized, ethical)
- Marketplace transactions (sponsorships, appearances, training fees)

### 8. Key Design Principles

1. **Athlete-first UX for mobile**: The athlete app is not a shrunk-down version of the staff app. It's its own clean, focused experience. Athlete should understand their week in 10 seconds.

2. **Never become a chat app**: Pure messaging is excluded. WhatsApp already won that. Athlink handles structured communication, context, and actionable information. If it's not information that needs to be discoverable, searchable, and contextual, it belongs in WhatsApp, not Athlink.

3. **Staff coordination, not silos**: The staff app is one unified platform where all staff perspectives are visible on the same athlete. Coach feedback, physio notes, doctor flags, all in one place. No separate tools for each role.

4. **Intentional scope expansion**: Don't build everything at once. Build one phase, nail it, get real pilot feedback, then expand. Each new feature should make the core experience better, not dilute it.

5. **Open ecosystem (eventually)**: Integrate with other tools (video platforms, wearables, nutrition apps) rather than build them yourself. Be the hub, not the monolith.

6. **Structured > Freeform**: Prefer structured input (forms, dropdowns, templates) where possible. This keeps data clean, searchable, and actionable. Freeform text is only for coaching observations (which get processed and structured).

### 9. Critical Success Factors & Potential Pitfalls

#### Success Factors
- **Real pilot early**: Build Phase 1, get it in front of 1–2 real teams immediately, watch them use it
- **Feedback loop clarity**: Make sure the coach-athlete communication loop actually reduces friction
- **Staff alignment**: Ensure physios/doctors can easily see coaching focus and add their own constraints
- **Adoption ease**: If first session takes 30 minutes to onboard, you lose. Ruthlessly simple.
- **Cultural fit**: Start with teams/athletes who already value structured feedback; they'll adopt faster

#### Pitfalls to Avoid
- **Scope creep**: Easy to say "let's add wearables" in month 2. Stay focused on communication and coordination first.
- **Feature bloat**: Each new feature should be obviously connected to athlete/staff needs. Don't add because it sounds cool.
- **Chat competition**: Don't try to replace Slack or WhatsApp. You'll lose. Stay in your lane: structured communication + context.
- **AI hallucination**: If AI mistranslates feedback, trust breaks immediately. Build guardrails (coach reviews before sending) or keep AI translations as suggestions only.
- **Data silos**: If physio can't see coaching focus, or if doctor flags get missed by coaches, the whole system breaks. Test cross-role workflows constantly.

### 10. Current Development Status

**Current phase:** Theoretical analysis and product definition (this document)

**Next steps:**
1. Finalize MVP feature list based on this definition
2. Create detailed wireframes/mockups for athlete and staff apps
3. Design data models and API structure
4. Set up backend infrastructure (database, API framework, auth system)
5. Build Phase 1: Basic feedback loop (coach → player → acknowledgement)
6. Pilot with 1–2 real teams, collect feedback
7. Iterate and move to Phase 2

**Important note:** Nothing in this document is final. All ideas, timelines, and features are subject to change based on pilot feedback and market learning.

---

## Quick Reference: App Flows

### Athlete App (Mobile)
Dashboard view → Sections: This week, Feedback, Tasks, Calendar, Progress, Resources, Goals, Messages

### Staff App
- **Web**: Team overview, athlete profiles, create programs, bulk feedback, analytics, calendar, communication center
- **Mobile**: Quick feedback, athlete status, program review, real-time alerts

### MVP Scope (Phase 1)
- Auth + role detection
- Coach feedback form input
- Player feedback view + acknowledgement
- Basic API

---

This document captures the full vision and approach discussed. Use it as the basis for new development conversations.