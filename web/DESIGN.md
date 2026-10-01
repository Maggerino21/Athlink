# Athlink Web — Design System

## Philosophy

**The dashboard is a companion to the phone, not a product of its own.** A coach who
looks at both in one day should see one piece of software, so these tokens mirror the
mobile app's `app/src/utils/tokens.ts` — same greys, same four text levels, same radii,
same event palette.

Matte, greyscale, data-dense. Three rules carry over from mobile, and they are what
stopped that app reading as machine-written:

1. **Surfaces are opaque.** No `rgba()` fills, no backdrop blur, no gradients, no glow.
   A translucent card picks up whatever sits behind it, so nothing in the app has a
   settled colour.
2. **The club colour is identity, not atmosphere.** It is drawn in exactly two places:
   the hairline down the edge of the sidebar (`.club-edge`) and the crest circle that
   stands in for a badge. It used to fill background orbs, buttons, active nav items,
   badges and the biggest number on the Overview page — which meant it competed with
   the event colours, the only colour that tells a coach anything.
3. **"Current" is weight and brightness, never a tint.** A selected row, an open tab, a
   focused field: brighter surface, stronger edge.

**The one rule above all: never write a raw hex or `rgba()` in a component.**

---

## Colour tokens

### Ground and surfaces — opaque, identical to mobile

| Token | Value | Use |
|---|---|---|
| `--bg-base` | `#0A0A0C` | The page |
| `--surface-raised` (`--surface-1`) | `#19191B` | A card — the default raised thing |
| `--surface-recessed` | `#101012` | A quieter card; input wells |
| `--surface-2` | `#202023` | A focused input |
| `--surface-active` (`--surface-3`) | `#252527` | Current, hovered or selected |

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
| `--accent-solid` | The true club colour. `.club-edge` and crest circles only |
| `--accent-on` | Black or white, whichever is legible **on** `--accent-solid` |
| `--accent` | A lightened variant guaranteed readable on `--bg-base`, for the rare case something has to set the club colour as text |

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

## Cards

`.glass` and `.glass-strong` are historical names — there is no glass left. `.glass` is
`--surface-raised` with a subtle edge; `.glass-strong` is `--surface-active`. Use them
for containers, never for interactive elements.

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
Neutral by default (`--surface-active`). The semantic variants are for their stated
semantics only — "Home" / "Away" is a fact, not a warning.

### Active nav item — `.nav-item.active`
`--surface-active` and `--text-primary`. No tint, no border.

### Avatar / crest circle
The one place besides `.club-edge` that may carry `--accent-solid`, with `--accent-on`
for the initials. A person's avatar is greyscale (`--surface-active`).

### Page layout
`padding: 36px 40px`; `max-width: 960px` for content-dense pages, unconstrained for
full-width ones (athletes, calendar).

---

## Rules for AI writing code in this codebase

1. **No raw hex or `rgba()` in components.** If a colour is not in this doc, add a token first.
2. **No gradients and no blur.** Not on backgrounds, not on cards, not on buttons.
3. **No emoji anywhere** — in UI copy, labels, empty states or placeholder text. Use an
   inline SVG icon or nothing.
4. **Club colour is `.club-edge` and crest circles.** Nothing else.
5. **Semantic colours are for their stated semantics only.**
6. **Typography classes for font sizes.** Don't write `fontSize: 11` — check `.t-label` first.
7. **Spacing in multiples of 4.**
8. **Never add a token without documenting it here first.**
