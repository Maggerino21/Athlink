/**
 * Design tokens for the mobile app.
 *
 * The web app has had these since the start (`web/app/globals.css`), with a
 * rule in CLAUDE.md forbidding raw hex in components. Mobile never got the
 * equivalent, and an audit of `app/src` found what that costs: **14 different
 * surface greys** (0.04, 0.045, 0.05, 0.06, 0.07, 0.08, 0.1, 0.12 …) and
 * **12 different corner radii** (2, 4, 8, 9, 10, 12, 14, 16, 20, 37, 999,
 * 9999) scattered across the screens.
 *
 * No single one of those is wrong, which is exactly the problem: every screen
 * is locally plausible and the app is globally incoherent. That reads as
 * unfinished however good any one screen looks.
 *
 * Use these. Do not write a raw grey or radius in a component.
 */

/**
 * The ground, and the surfaces that sit on it.
 *
 * **Opaque, always.** These used to be translucent white (raised was white at
 * 6%), which is the default look of generated dark UI and picks up whatever
 * sits behind a card — a glow, a gradient, another card. Each value below is
 * exactly what the old alpha looked like composited onto `base`, so nothing
 * changes on a flat page; it just stops being see-through.
 */
export const SURFACE = {
  /** The page itself. Not pure black — see SURFACE_BASE in theme.ts. */
  base: '#0A0A0C',
  /** A card. The default raised thing. (was white 6% over base) */
  raised: '#19191B',
  /** A card that is deliberately quieter — a day with nothing on it. (was 2.5%) */
  recessed: '#101012',
  /** A card that is active or current, without resorting to colour. (was 11%) */
  active: '#252527',
} as const;

/** Hairlines and card edges. */
export const LINE = {
  /** The default card edge. Barely there on purpose. */
  soft: 'rgba(255,255,255,0.07)',
  /** A divider that has to carry structure. */
  hard: 'rgba(255,255,255,0.13)',
  /** The edge of something current. */
  active: 'rgba(255,255,255,0.20)',
} as const;

/**
 * Four levels, and four is the limit.
 *
 * Anything that does not fit one of these is asking for a fifth grey, which is
 * how the 14 got there.
 */
export const TEXT = {
  primary: 'rgba(255,255,255,0.95)',
  secondary: 'rgba(255,255,255,0.62)',
  tertiary: 'rgba(255,255,255,0.40)',
  faint: 'rgba(255,255,255,0.22)',
} as const;

/** Corner radii. Three sizes and a pill — not twelve. */
export const RADIUS = {
  sm: 10,
  md: 16,
  lg: 22,
  pill: 999,
} as const;

/** Spacing scale. Everything is a multiple of 4. */
export const SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 32,
} as const;
