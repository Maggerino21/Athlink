# Athlink Web — Design System

## Where this stands (read first)

The **materials are settled** and the **layout is not.** Keep the two apart when changing
anything here.

**Settled, and hard-won — don't undo these without a reason:**

- Opaque surfaces. No `rgba` fills, no backdrop blur, no coloured glow.
- No outlines on cards, no hairline rules under headers, no accent stripe down an edge.
- Club colour is spent deliberately, never as atmosphere: a page's one main action,
  "today" (Home's week bar, the calendar's date circle), Home's next-match card and the
  crest circles. Never a
  background, glow, tint or border.
- "Current" is a brighter surface, never a tint.
- Event colours come from the tokens, matching the phone.
- No emoji, anywhere.
- Archivo, not Inter.

**The home screen (2026-10-03).** Six cards of one size, three by two (`.home` /
`.home-grid` / `.card`), under a header with the page's main action. Built from a
reference Magne picked. **The cards are equal in size and unequal in fill**, and the
fill carries the hierarchy:

| Card | Fill | Why |
|---|---|---|
| Next match | `.card-accent` — the club colour | The thing the week is organised around. The only loud card |
| Today / a picked day | `.card-light` — warm off-white, `--ink` text | Second step: what is on, right now |
| Feedback, Tasks, After that, Next 7 days | `.card` — raised grey | Everything else |

Rules that came with it:

- **One accent card, one light card, never more.** Two loud cards and neither is loud.
- **Actions inside a card are outline pills** (`.btn-outline`), so they do not fight
  the card's fill. The page's main action is the one `.btn-accent`.
- **Stripes mean "this one"** in a chart (`.hatch-accent` for today, `.hatch-danger`
  for past due) — emphasis without a second colour.
- **The only decoration is the pitch** behind the Feedback card, at 5% — it is the
  place the feedback is about.
- **Cards are `--radius-card` (26px).** Larger than mobile's on purpose.
- **The sidebar sits on the canvas** behind one line — tall soft nav pills, open tab
  is a raised pill with full-strength text.

This replaces the bento and its "sizes are unequal" principle below.

**The calendar (2026-10-03)** follows Home without copying it:

- Same header: the month set light at 28px, the year beside it in tertiary, outline
  circles for ‹ ›, the athlete filter as an outline pill, `.btn-accent` "New event".
- **The month is one `.card`, ruled into days** (`.cal-cell`) — structural lines, not 42
  outlined boxes. Hover is `--surface-hover`, the open day `--surface-active`.
- **An event in a cell is a line, not a pill**: the type's 8px square, the time in
  tertiary, the title. Matches are set in weight 600. Ten filled colours across a month
  was the "too much" this replaced.
- **Today is the date in a club-colour circle** — the same "today" as Home's striped bar.
- **Opening a day slides in Home's light card**, floating 16px from the edges at
  `--radius-card`. Events are rows (time column, type square and label, title), never
  filled cards. The action is `.btn-ink`; danger on light is `--ink-danger`.

**Club colour, the rule now:** a page's one main action (`.btn-accent`), "today", Home's
next-match card, and crest circles. **Still unsettled:** Athletes, Feedback, Tasks,
Groups, Club and Profile keep the old page shell (`padding: 36px 40px`, a 960px measure)
and flat panels. New pages should use `.page` (Home's padding and gap).

## Philosophy

**The dashboard is a companion to the phone, not a product of its own.** A coach who
looks at both in one day should see one piece of software, so these tokens mirror the
mobile app's `app/src/utils/tokens.ts` — same greys, same four text levels, same radii,
same event palette.

**But it is not a stretched phone.** The two have different jobs and different room, and
the web's own language comes from three things:

1. **It fills the window.** No centred column, no 960px measure, no generous margin
   between the sidebar and the content. A desktop gives you a wall, and leaving two
   thirds of it as canvas is the single most recognisable shape of a generated
   dashboard. Panels tile to every edge with an even 8px gutter — the canvas reads as
   mortar between tiles, not as a margin around a document.
2. **Sizes are unequal, and the size is the argument.** The next fixture is the biggest
   thing on the home screen because a season is organised around it; four counts sit
   beside it as figures rather than cards; the lists take the floor. A page of equal
   cards tells a coach nothing about what matters, which is the actual failure of a
   grid of identical tiles.
3. **Numbers are set like numbers.** A count a coach came to read is `clamp(42px,
   4.6vw, 86px)` at a hairline weight — see `.figure`. It scales with the viewport
   because on a 27" monitor a 44px number is a label.

Where the phone is a single column you thumb through, the web is a board you stand back
from. Same materials, different architecture.

### Typeface

**Archivo, not Inter.** Inter is the default of every generated dashboard on the
internet, and a product whose whole argument is "two people can build something better
than the incumbent" cannot open in the house font of software that was not designed at
all. Archivo is a grotesque with real drawing in it — flat-sided bowls, a tall x-height,
numerals with weight — and it is already the display face on the phone, so the two apps
read as siblings without being copies. Loaded variable, because the scale leans on the
extremes: 200 at 86px for the figures, 500 at 11px for labels.

Matte, greyscale, data-dense. Three rules carry over from mobile, and they are what
stopped that app reading as machine-written:

1. **Surfaces are opaque.** No `rgba()` fills, no backdrop blur, no coloured glow.
   A translucent card picks up whatever sits behind it, so nothing in the app has a
   settled colour. The one gradient in the app is the canvas itself (below): neutral,
   no hue, and it is a ground rather than a decoration.
2. **The club colour is identity, not atmosphere.** Since 2026-10-03 it is spent on
   purpose and only on Home: the next-match card, the "New event" button and today's
   bar in the week chart — plus the crest circle that stands in for a badge. It used to fill background orbs, buttons, active nav items,
   badges and the biggest number on the Overview page — which meant it competed with
   the event colours, the only colour that tells a coach anything.
3. **"Current" is weight and brightness, never a tint.** A selected row, an open tab, a
   focused field: brighter surface, stronger edge.

**The one rule above all: never write a raw hex or `rgba()` in a component.**

---

## Colour tokens

### Ground and surfaces

The ladder is the phone's, **lifted a step**. A phone screen is full of content; a
desktop page is mostly empty, and the same near-black that reads as a ground on a 6"
screen reads as a void across 1440px. The half of the window with nothing in it is what
decides whether a page looks sparse or endless, so the canvas floor stays well clear of
black and falls gently from top to bottom.

| Token | Value | Use |
|---|---|---|
| `--bg-base` | `#0A0A0C` | The shell — the sidebar, and the darkest thing in the window |
| `--bg-canvas-top` → `--bg-canvas-bottom` | `#16161A` → `#121216` | The content area, as a fixed vertical gradient on `html, body` |
| `--surface-recessed` | `#141418` | A well: inputs, and deliberately quiet cards |
| `--surface-raised` | `#232328` | A card — the default raised thing |
| `--surface-hover` | `#292930` | Hovered, or a row you have ticked |
| `--surface-active` | `#2E2E34` | Current |

Four steps, named for their job. They were `--surface-1/2/3` until the numbers stopped
saying anything about what each one was for.

The sidebar being the **darkest** surface is what frames the canvas. Dialogs float on
`--surface-raised`; a dialog painted in `--bg-base` would sink below the page.

### Borders

| Token | Value | Use |
|---|---|---|
| `--border-subtle` | white 7% | Card edges, table rules |
| `--border-default` | white 13% | Dividers that carry structure |
| `--border-strong` | white 20% | The edge of something current |

### Text — four levels, and four is the limit

`--text-primary` 95% · `--text-secondary` 62% · `--text-tertiary` 40% · `--text-disabled` 22%

### Fills

`--fill-strong` `#F4F1ED` — the near-white a primary button is filled with, the same
fill as "Gi en bot" and "Betal alt" on the phone.

### Club colour

| Token | Use |
|---|---|
| `--accent-solid` | The true club colour. Home's accent card and button, today's bar, crest circles |
| `--accent-on` | Black or white, whichever is legible **on** `--accent-solid` |
| `--accent` | A lightened variant guaranteed readable on the canvas, for the rare case something has to set the club colour as *text*. Nothing uses it today — it is kept because the contrast search that derives it is the part that would be easy to get wrong later |

Injected by `app/dashboard/layout.tsx` via `accentTokens()` in `lib/clubTheme.ts`. There
are no `--accent-subtle` / `--accent-border` / `--accent-glow` tints any more.

### Status — muted to sit on a matte ground rather than glow on it

`--color-success` / `--color-warning` / `--color-danger` / `--color-info`, each with a
`-subtle` (an opaque fill) and a `-border`.

### Event types

Ten hues, derived from the mobile `matteAccent()` so a training session is the same
colour on both screens. Each has three tokens:

| Token | Use |
|---|---|
| `--event-{type}` | The label, the icon and the edge |
| `--event-{type}-fill` | An opaque card ground |
| `--event-{type}-border` | That card's edge |

Types: `match training home rehab recovery meeting travel vacation exercise other`.
Read them through a small local helper (`eventVars()` in CalendarTab, `catVars()` in
NewEventTab) rather than writing the variable names inline.

> The web app used to keep its own hardcoded list, and two entries disagreed with the
> phone about what they meant — `home` was purple here and green there, `rehab` the
> other way round.

---

## Typography

Font: **Inter** — loaded via `next/font/google` on `<html>`. Never override it.

| Class | Size | Weight | Use |
|---|---|---|---|
| `.t-display` | 30px | 700 | Page titles (one per page) |
| `.t-heading` | 22px | 600 | Section headings |
| `.t-subheading` | 17px | 600 | Panel headings, card titles |
| `.t-body` | 14px | 400 | Body copy |
| `.t-body-medium` | 14px | 500 | Emphasised body text, table cells |
| `.t-small` | 13px | 400 | Supporting text |
| `.t-label` | 11px | 500 | uppercase, 0.07em — section labels, column headers |

Weights come down across the board from the old scale: at 700–800 on a matte ground the
type was doing the shouting that size should do.

---

## Spacing

Multiples of 4 only: `4 8 12 16 20 24 32 40 48 64`.

---

## Border radius

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | `10px` | Icon buttons, inputs, small chips |
| `--radius-md` | `16px` | Cards, icon tiles |
| `--radius-lg` / `--radius-xl` | `22px` | Large cards, modals |
| `--radius-full` | `9999px` | Buttons, badges, avatar circles |

---

## The home grid

`.home` is a flex column: a header (title, date, invite buttons, `.btn-accent`) at its
natural height, then `.home-grid` taking the rest — three equal columns,
`grid-auto-rows: minmax(300px, 1fr)` so the cards reach the bottom of the window. Two
columns under 1100px, one under 720px. See the top of this document for the fills.

It is deliberately the one screen that works this way so far. Athletes, Calendar and
the rest are still tables and panels on the old shell.

## Cards

**A card is a fill and nothing else** — no outline, no hairline, no stripe down one
side. An opaque surface on a lighter canvas separates itself; the 1px white border that
used to sit on every card, and the coloured bar down the left of every event row, are
the two most recognisable tells of generated UI. Badges, ghost buttons and inputs are
borderless for the same reason — an input shows an edge only while it is focused.

Lines that remain are **structural**: table row rules, the calendar grid, the left edge
of a slide-in panel, and row separators inside a picker list. A rule under a page or
dialog header is not structural — those are all gone.

`.panel` is `--surface-raised`; `.panel-strong` is `--surface-active`. Use them for
containers, never for interactive elements. (They were `.glass` / `.glass-strong` until
the opaque pass left those names describing something the app no longer does.)

---

## Component patterns

### Primary button — `.btn-primary`
A near-white pill with dark type: `--fill-strong` background, `--bg-base` label,
`--radius-full`, hover `opacity: 0.88`. No shadow, no club colour. `.btn-primary-neutral`
is the same thing, kept so the logged-out pages do not need editing.

### Ghost button — `.btn-ghost`
`--surface-raised`, `--border-subtle`, `--text-secondary`, pill. Hover brightens to
`--surface-active` and `--text-primary`.

### Input — `.input`
A well: `--surface-recessed` with a `--border-subtle` edge. Focus brightens the field to
`--surface-2` and the edge to `--border-strong`. Never a coloured focus ring.

### Badge — `.badge`
Neutral by default (`--surface-active`), no border. The semantic variants are for their
stated semantics only — "Home" / "Away" is a fact, not a warning. An event-type badge
takes that type's opaque `-fill`.

### Active nav item — `.nav-item.active`
`--surface-active` and `--text-primary`. No tint, no border.

### Group colour
A group's colour is **a 9px dot beside its name**, and nothing else. It is a label for
telling two groups apart in a list, not a material. The card used to be built out of it
— tinted ground, outline, 4px top bar, the name, the count and the arrow all set in it —
and a group that picked a warm orange came out looking like a warning.

### Avatar / crest circle
A crest circle may carry `--accent-solid`, with `--accent-on`
for the initials. A person's avatar is greyscale (`--surface-active`).

### Page layout
`padding: 36px 40px`; `max-width: 960px` for content-dense pages, unconstrained for
full-width ones (athletes, calendar).

---

## Rules for AI writing code in this codebase

1. **No raw hex or `rgba()` in components.** If a colour is not in this doc, add a token first.
2. **No blur, and no gradient other than the canvas.** Not on cards, not on buttons,
   and never a coloured one.
3. **No outlines on cards, and no left accent stripes.** If something needs to separate
   from what is behind it, give it a different opaque surface.
3. **No emoji anywhere** — in UI copy, labels, empty states or placeholder text. Use an
   inline SVG icon or nothing.
4. **Club colour is Home's accent card and button, today's bar, and crest circles.** Nothing else.
5. **Semantic colours are for their stated semantics only.**
6. **Typography classes for font sizes.** Don't write `fontSize: 11` — check `.t-label` first.
7. **Spacing in multiples of 4.**
8. **Never add a token without documenting it here first.**
