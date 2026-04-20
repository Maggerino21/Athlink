# Athlink Web — Design System

## Philosophy

Dark glass aesthetic. Minimal, data-dense, editorial. The club's primary color is the single accent — it drives every interactive element when logged in. Logged-out screens use a fixed neutral indigo. Everything else is semantic (green = success, red = error, etc.) and never changes with the club theme.

**The one rule above all: never write a raw hex value or `rgba()` directly in a component. Every color must reference a CSS token.**

---

## Color tokens

### Base & surfaces (always fixed)

| Token | Value | Use |
|---|---|---|
| `--bg-base` | `#080C1E` | Page background — the deepest layer |
| `--surface-1` | `rgba(255,255,255,0.04)` | Default card, panel background |
| `--surface-2` | `rgba(255,255,255,0.07)` | Hover state, elevated card |
| `--surface-3` | `rgba(255,255,255,0.11)` | Sidebar, modal, sheet — highest elevation |

### Borders (always fixed)

| Token | Value | Use |
|---|---|---|
| `--border-subtle` | `rgba(255,255,255,0.06)` | Hairlines, row dividers |
| `--border-default` | `rgba(255,255,255,0.10)` | Card and panel borders |
| `--border-strong` | `rgba(255,255,255,0.18)` | Emphasized separators |

### Text (always fixed)

| Token | Value | Use |
|---|---|---|
| `--text-primary` | `rgba(255,255,255,0.92)` | Headings, body copy, active labels |
| `--text-secondary` | `rgba(255,255,255,0.50)` | Supporting text, inactive nav, descriptions |
| `--text-tertiary` | `rgba(255,255,255,0.28)` | Timestamps, column headers, placeholder hints |
| `--text-disabled` | `rgba(255,255,255,0.18)` | Disabled states only |

### Accent (logged-in only — derived from club's `primary_color`)

Injected as inline CSS variables on the `<div>` wrapping the dashboard layout. **Never hardcode these.** They change per club.

| Token | How it's derived | Use |
|---|---|---|
| `--accent` | club hex verbatim | Button bg, active nav bg, focus ring color |
| `--accent-subtle` | club hex @ 12% opacity | Badge bg, avatar fill, selected row bg |
| `--accent-border` | club hex @ 28% opacity | Badge border, input focus border, active nav border |
| `--accent-glow` | club hex @ 18% opacity | Orb backgrounds, button box-shadow |

### Neutral accent (logged-out screens only — always fixed)

| Token | Value | Use |
|---|---|---|
| `--neutral-accent` | `#6366F1` | Login button, logo icon |
| `--neutral-accent-subtle` | `rgba(99,102,241,0.12)` | Login icon bg |
| `--neutral-accent-border` | `rgba(99,102,241,0.28)` | Login icon border |
| `--neutral-accent-glow` | `rgba(99,102,241,0.18)` | Login page orbs |

### Semantic colors (always fixed — never change with club theme)

These carry meaning. Only ever use them for their stated purpose.

| Group | Token | Value | Use |
|---|---|---|---|
| **Success** | `--color-success` | `#22C55E` | Completed tasks, positive status |
| | `--color-success-subtle` | `rgba(34,197,94,0.12)` | Success badge bg |
| | `--color-success-border` | `rgba(34,197,94,0.25)` | Success badge border |
| **Warning** | `--color-warning` | `#F59E0B` | Matches, approaching deadlines, away games |
| | `--color-warning-subtle` | `rgba(245,158,11,0.12)` | Warning badge bg |
| | `--color-warning-border` | `rgba(245,158,11,0.25)` | Warning badge border |
| **Danger** | `--color-danger` | `#EF4444` | Overdue tasks, errors, destructive actions |
| | `--color-danger-subtle` | `rgba(239,68,68,0.12)` | Danger badge bg |
| | `--color-danger-border` | `rgba(239,68,68,0.25)` | Danger badge border |
| **Info / AI** | `--color-info` | `#8B5CF6` | AI-processed content, unread feedback status |
| | `--color-info-subtle` | `rgba(139,92,246,0.12)` | Info/AI badge bg |
| | `--color-info-border` | `rgba(139,92,246,0.25)` | Info/AI badge border |

> Why purple for AI/unread? It matches the app's established pattern where purple = AI-structured content. Unread feedback is also AI-adjacent in this product.

### Event type colors (calendar — always fixed)

| Token | Value | Event type |
|---|---|---|
| `--event-training` | `#3B82F6` | Training session |
| `--event-exercise` | `#8B5CF6` | Exercise / gym |
| `--event-recovery` | `#22C55E` | Recovery |
| `--event-travel` | `#F59E0B` | Travel |
| `--event-meeting` | `#EC4899` | Meeting |
| `--event-other` | `#6B7280` | Other |
| `--event-match` | `#F59E0B` | Match (same as warning / travel) |

---

## Typography

Font: **Inter** — loaded via `next/font/google` and applied on `<html>`. Never override with another typeface or a system font stack.

| Class | Size | Weight | Transform | Tracking | Use |
|---|---|---|---|---|---|
| `.t-display` | 30px | 800 | — | -0.03em | Page titles (one per page) |
| `.t-heading` | 22px | 700 | — | -0.02em | Section headings |
| `.t-subheading` | 17px | 600 | — | -0.01em | Panel headings, card titles |
| `.t-body` | 14px | 400 | — | 0 | Body copy |
| `.t-body-medium` | 14px | 600 | — | 0 | Emphasized body text, table cells |
| `.t-small` | 13px | 500 | — | 0 | Supporting text, descriptions |
| `.t-label` | 11px | 600 | uppercase | 0.07em | Section labels, column headers — color always `--text-tertiary` |

---

## Spacing

Use multiples of 4px only. Common values: `4 8 12 16 20 24 32 40 48 64`.

Never use odd values like 9, 11, 13, 18 for spacing (fine for font-sizes, not for padding/gap/margin).

---

## Border radius

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | `8px` | Icon buttons, checkboxes, small chips |
| `--radius-md` | `12px` | Inputs, small cards, badges |
| `--radius-lg` | `16px` | Cards, panels, table containers |
| `--radius-xl` | `20px` | Large cards, modals |
| `--radius-full` | `9999px` | Pills, avatar circles, scrollbar thumbs |

---

## Glass effect

Two levels. Apply via class — never replicate the blur/backdrop inline.

| Class | Blur | Background | Border | Use |
|---|---|---|---|---|
| `.glass` | 16px | `--surface-1` | `--border-default` | Cards, panels, table containers |
| `.glass-strong` | 24px | `--surface-3` | `--border-default` | Sidebar, modals, slide-in panels |

---

## Component patterns

### Primary button
```
background:   --accent
border:       1px solid --accent-border
color:        white
border-radius: --radius-md
box-shadow:   0 4px 16px --accent-glow
hover:        opacity 0.88
```
On **logged-out screens** (login page), substitute `--neutral-accent`, `--neutral-accent-border`, `--neutral-accent-glow`.

---

### Ghost button
```
background:   --surface-1
border:       1px solid --border-default
color:        --text-secondary
border-radius: --radius-sm
hover → background: --surface-2, color: --text-primary
```

---

### Badge
Use only the semantic badge classes. Never create a badge with `--accent` — badges are always semantic or neutral.

| Intent | Class | Tokens used |
|---|---|---|
| Neutral | `.badge` | `--surface-1` / `--border-default` / `--text-secondary` |
| Success | `.badge-success` | `--color-success-subtle` / `--color-success-border` / `--color-success` |
| Warning | `.badge-warning` | `--color-warning-subtle` / `--color-warning-border` / `--color-warning` |
| Danger | `.badge-danger` | `--color-danger-subtle` / `--color-danger-border` / `--color-danger` |
| Info / AI | `.badge-info` | `--color-info-subtle` / `--color-info-border` / `--color-info` |

---

### Avatar circle
```
background:    --accent-subtle
border:        1px solid --accent-border
color:         --accent
border-radius: --radius-full
```

---

### Active nav item
```
background:   --accent-subtle
border:       1px solid --accent-border
color:        --text-primary
```

---

### Input
```
background:   --surface-2
border:       1px solid --border-default
focus border: --accent-border   (not --accent — full color is too heavy)
color:        --text-primary
placeholder:  --text-tertiary
border-radius: --radius-md
```

---

### Page layout
All dashboard pages follow this shell:
```
padding:   36px 40px
max-width: 960px (content-dense pages) or unconstrained (full-width like athletes/calendar)
```

---

## Rules for AI writing code in this codebase

1. **No raw hex or rgba() in components.** If a color isn't in this doc, add a token first.
2. **`--accent` tokens only exist inside `/dashboard`.** The layout injects them. Never use `--accent` on the login page or any public route — use `--neutral-accent` instead.
3. **Semantic colors are for their stated semantics only.** Don't use `--color-success` as a decorative green element.
4. **`.glass` / `.glass-strong` are for containers, not interactive elements** like buttons or badges.
5. **Typography classes for font sizes.** Don't write `fontSize: 11` — check if `.t-label` (11px) fits. Only deviate if a specific size falls between scale steps and there's a clear reason.
6. **Spacing in multiples of 4.** Gap, padding, margin — all multiples of 4.
7. **Never add a new token without documenting it here first.**
