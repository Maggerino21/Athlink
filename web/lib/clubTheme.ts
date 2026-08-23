/**
 * Club colour palette and accent derivation.
 *
 * Single source of truth: the dashboard layout derives these on the server for the initial
 * paint, and DashboardShell re-derives them on the client when a manager changes the colour.
 * Both call accentTokens() so the two can never drift apart.
 */

/* ── Palette ──────────────────────────────────────────────────────────
 * Primaries, plus shades only where football actually needs them — three reds
 * (Arsenal vs Liverpool), four blues (sky / royal / navy), three greens, two yellows.
 * Deliberately NOT a full spectrum: a curated set keeps every club looking right against
 * the dark theme, and no club needs its exact brand hex.
 */
export const CLUB_COLORS: { name: string; hex: string }[] = [
  { name: 'Scarlet',    hex: '#F5424B' },
  { name: 'Red',        hex: '#E01B24' },
  { name: 'Deep red',   hex: '#B01B2E' },
  { name: 'Claret',     hex: '#9E3050' },
  { name: 'Sky blue',   hex: '#5FB3E4' },
  { name: 'Blue',       hex: '#3B82F6' },
  { name: 'Royal blue', hex: '#2563C9' },
  { name: 'Navy',       hex: '#4A6CB3' },
  { name: 'Mint',       hex: '#4ADE80' },
  { name: 'Green',      hex: '#22B455' },
  { name: 'Forest',     hex: '#3E8E5A' },
  { name: 'Yellow',     hex: '#FBD024' },
  { name: 'Amber',      hex: '#F59E0B' },
  { name: 'Orange',     hex: '#F97316' },
  { name: 'Purple',     hex: '#A855F7' },
  { name: 'Maroon',     hex: '#8E4A6B' },
  { name: 'Silver',     hex: '#C6CBD4' },
  { name: 'Teal',       hex: '#14B8A6' },
];

/** The app background these colours have to survive against — keep in sync with --bg-base. */
const BG: RGB = [0x0b, 0x0b, 0x0d];
/** WCAG AA for normal text. */
const MIN_TEXT_CONTRAST = 4.5;

type RGB = [number, number, number];

/* ── Colour maths ─────────────────────────────────────────────────── */
export function hexToRgb(hex: string): RGB {
  const c = hex.replace('#', '');
  const f = c.length === 3 ? c.split('').map(x => x + x).join('') : c;
  const n = [0, 2, 4].map(i => parseInt(f.slice(i, i + 2), 16));
  return (n.some(Number.isNaN) ? [99, 102, 241] : n) as RGB;
}

const toHex = ([r, g, b]: RGB) =>
  '#' + [r, g, b].map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');

/** WCAG relative luminance. */
function luminance([r, g, b]: RGB): number {
  const f = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastRatio(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** sRGB → CIELAB, so "nearest colour" matches how eyes see it rather than raw RGB distance. */
function toLab([r, g, b]: RGB): [number, number, number] {
  const f = (c: number) => {
    const v = c / 255;
    return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92;
  };
  const [R, G, B] = [f(r), f(g), f(b)];
  const k = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const X = k((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
  const Y = k(R * 0.2126 + G * 0.7152 + B * 0.0722);
  const Z = k((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}

/**
 * Closest palette entry to an arbitrary colour — used to turn a colour sampled from a club
 * badge into one of ours. No club gets its exact brand hex; it gets the nearest we ship.
 */
export function nearestClubColor(hex: string): { name: string; hex: string } {
  const target = toLab(hexToRgb(hex));
  let best = CLUB_COLORS[0];
  let bestD = Infinity;
  for (const c of CLUB_COLORS) {
    const l = toLab(hexToRgb(c.hex));
    const d = Math.hypot(target[0] - l[0], target[1] - l[1], target[2] - l[2]);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

/* ── Accent tokens ────────────────────────────────────────────────── */
/**
 * A club colour has to do two incompatible jobs: be the brand fill, and be legible as text
 * on a near-black background. A deep red that reads as Liverpool fails badly as 13px text.
 *
 * So we split it:
 *   --accent-solid  the true club colour, for fills and button backgrounds
 *   --accent        a version guaranteed readable on --bg-base, for text and icon strokes
 *   --accent-on     black or white, for labels sitting ON --accent-solid
 *
 * For most of the palette --accent === --accent-solid; only the dark entries shift, which
 * is what lets Deep red and Navy stay genuinely dark instead of being flattened to pastels.
 */
export function accentTokens(clubColor: string) {
  const solid = hexToRgb(clubColor);

  // Lighten toward white, preserving hue, until it clears the text threshold.
  let readable: RGB = [...solid] as RGB;
  for (let i = 0; i < 100 && contrastRatio(readable, BG) < MIN_TEXT_CONTRAST; i++) {
    readable = readable.map(v => v + (255 - v) * 0.04) as RGB;
  }

  // Whichever of black/white is more legible on the solid colour.
  const onSolid =
    contrastRatio([255, 255, 255], solid) >= contrastRatio([0, 0, 0], solid) ? '#FFFFFF' : '#000000';

  const rgb = solid.join(', ');
  return {
    '--accent-solid':  clubColor,
    '--accent':        toHex(readable.map(Math.round) as RGB),
    '--accent-on':     onSolid,
    '--accent-subtle': `rgba(${rgb}, 0.12)`,
    '--accent-border': `rgba(${rgb}, 0.28)`,
    '--accent-glow':   `rgba(${rgb}, 0.18)`,
  } as Record<string, string>;
}
