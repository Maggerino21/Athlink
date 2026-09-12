/**
 * Converts a hex color string to rgba().
 * e.g. hexToRgba('#3B82F6', 0.38) → 'rgba(59,130,246,0.38)'
 */
export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean;
  const r = parseInt(full.substring(0, 2), 16);
  const g = parseInt(full.substring(2, 4), 16);
  const b = parseInt(full.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(59,130,246,${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Returns the two orb gradient colours derived from the club's primary colour. */
export function clubGradientOrbs(primaryColor: string) {
  return {
    top:    [hexToRgba(primaryColor, 0.22), hexToRgba(primaryColor, 0)] as [string, string],
    bottom: [hexToRgba(primaryColor, 0.12), hexToRgba(primaryColor, 0)] as [string, string],
  };
}

/**
 * The app's ground colour.
 *
 * Deliberately not pure black: the glass system is rgba-white over a blur, and
 * over #000 it has nothing to sample, so every card edge hardens and a rim-lit
 * Blob's glow terminates instead of falling off. ~4% luminance, a hair cool, so
 * the warm blobs read warmer against it.
 */
export const SURFACE_BASE = '#0A0A0C';

export interface HSL { h: number; s: number; l: number }

/** Hex → HSL. `h` in degrees 0–360, `s`/`l` in percent 0–100. */
export function hexToHsl(hex: string): HSL {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  const r = parseInt(full.substring(0, 2), 16) / 255;
  const g = parseInt(full.substring(2, 4), 16) / 255;
  const b = parseInt(full.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r ? ((g - b) / d + (g < b ? 6 : 0)) :
    max === g ? ((b - r) / d + 2) :
                ((r - g) / d + 4);
  return { h: h * 60, s: s * 100, l: l * 100 };
}

/** HSL(+alpha) → an rgba() string, since RN styles do not accept hsl(). */
export function hsla(h: number, s: number, l: number, a = 1): string {
  const H = ((h % 360) + 360) % 360, S = s / 100, L = l / 100;
  const c = (1 - Math.abs(2 * L - 1)) * S;
  const x = c * (1 - Math.abs(((H / 60) % 2) - 1));
  const m = L - c / 2;
  const [r1, g1, b1] =
    H < 60  ? [c, x, 0] : H < 120 ? [x, c, 0] : H < 180 ? [0, c, x] :
    H < 240 ? [0, x, c] : H < 300 ? [x, 0, c] : [c, 0, x];
  const to = (v: number) => Math.round((v + m) * 255);
  return `rgba(${to(r1)},${to(g1)},${to(b1)},${a})`;
}

/**
 * Multiplies a colour's alpha, leaving its hue alone.
 *
 * Accepts the two forms our palettes actually contain — hex (3, 6 or 8 digit)
 * and rgb()/rgba() — because a palette is authored as literals in whichever
 * form the design tool produced, and dimming one should not require rewriting
 * it in a single canonical form first.
 */
export function scaleAlpha(color: string, k: number): string {
  if (color === 'transparent') return color;
  const clamp = (a: number) => Math.max(0, Math.min(1, a));

  if (color.startsWith('#')) {
    const c = color.slice(1);
    const full = c.length === 3 || c.length === 4 ? c.split('').map(x => x + x).join('') : c;
    const r = parseInt(full.substring(0, 2), 16);
    const g = parseInt(full.substring(2, 4), 16);
    const b = parseInt(full.substring(4, 6), 16);
    const a = full.length === 8 ? parseInt(full.substring(6, 8), 16) / 255 : 1;
    if (isNaN(r) || isNaN(g) || isNaN(b)) return color;
    return `rgba(${r},${g},${b},${clamp(a * k)})`;
  }

  const m = color.match(/rgba?\(([^)]+)\)/);
  if (!m) return color;
  const parts = m[1].split(',').map(x => x.trim());
  if (parts.length < 3) return color;
  const a = parts.length > 3 ? parseFloat(parts[3]) : 1;
  return `rgba(${parts[0]},${parts[1]},${parts[2]},${clamp(a * k)})`;
}

/**
 * Black or white — whichever stays readable on top of `color`.
 *
 * The mobile counterpart of the web app's `--accent-on` token. Club colours are
 * chosen by the club, so a label sitting on a filled accent cannot assume a
 * dark background: hardcoding white put yellow clubs at 1.92:1 on the web
 * before that token existed. Relative luminance per WCAG, with the crossover
 * placed where the two candidates are equally readable rather than at 0.5.
 */
export function onAccent(color: string): string {
  const clean = color.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  const ch = (i: number) => {
    const v = parseInt(full.substring(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const r = ch(0), g = ch(2), b = ch(4);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '#FFFFFF';
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.38 ? '#0A0A0C' : '#FFFFFF';
}

/** What a matte accent resolves to. */
export interface MatteAccent {
  /** Icons and the small type label. Readable, still clearly the hue. */
  ink: string;
  /** A rule, a dot, a mark. The most concentrated the colour gets. */
  edge: string;
  /** A barely-there tint behind something small. */
  wash: string;
  /**
   * A whole card's ground. Opaque rather than an alpha tint, so a card reads
   * the same colour wherever it is laid — over the page, over another card, or
   * over the sheet — instead of shifting with whatever is behind it.
   */
  fill: string;
  /** The edge of a card filled with `fill`. */
  border: string;
}

/**
 * Turns a vivid palette hue into a matte accent.
 *
 * The event-type palette is web-style — `#3B82F6` is HSL(217, **91%**, 60%) —
 * and at that saturation it reads as neon on a dark matte surface, which is
 * the look we are deliberately moving away from. Hue is identity here: blue
 * means training, orange means match. So hue is kept and saturation is cut.
 *
 * Derived rather than hand-picked so the whole app's colour temperature is
 * three numbers in one place. Turn SAT down and every accent in the app gets
 * quieter together, which is not true of ten hand-chosen hexes.
 */
/**
 * Rustic, not neon.
 *
 * The first attempt rotated each hue toward amber to "warm" it. That is the
 * wrong model, and it failed loudly: blue sits at 217°, almost exactly opposite
 * amber at 35°, so the shorter way round went *up* through purple and training
 * blue came out violet.
 *
 * Earth colour is not a rotated hue. It is pigment **mixed with clay** — the
 * same operation a painter does, and one that behaves sensibly for every hue:
 * it drops chroma, warms, and lifts toward a mid-tone all at once, and it can
 * never send blue to purple because it never touches the hue wheel.
 *
 * So: take the type's hue at a modest saturation, then mix it toward a warm
 * neutral. `EARTH_MIX` is how much clay is in the pot — turn it up for quieter
 * and dustier, down for more pigment.
 */

/** The clay. A warm mid-grey — brown-leaning, never blue. */
const CLAY: RGB = [116, 104, 90];
/** The clay, in shadow: what a card's ground is mixed toward. */
const CLAY_DARK: RGB = [58, 52, 46];

const EARTH_MIX = 0.54;   // ink and marks
/**
 * Card grounds. At 0.72 there was so much clay in the pot that training came
 * out rgb(53,56,64) — a grey with a rumour of blue. Enough pigment has to
 * survive the mixing that the type is legible as a colour across the room.
 */
const FILL_MIX = 0.48;

type RGB = [number, number, number];

/** HSL → rgb triple. Same maths as `hsla`, without the string. */
function hslRgb(h: number, s: number, l: number): RGB {
  const H = ((h % 360) + 360) % 360, S = s / 100, L = l / 100;
  const c = (1 - Math.abs(2 * L - 1)) * S;
  const x = c * (1 - Math.abs(((H / 60) % 2) - 1));
  const m = L - c / 2;
  const [r, g, b] =
    H < 60  ? [c, x, 0] : H < 120 ? [x, c, 0] : H < 180 ? [0, c, x] :
    H < 240 ? [0, x, c] : H < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function rgbStr([r, g, b]: RGB): string {
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

const matteCache = new Map<string, MatteAccent>();

export function matteAccent(hex: string): MatteAccent {
  const hit = matteCache.get(hex);
  if (hit) return hit;
  const { h } = hexToHsl(hex);

  // Pigment, then clay. The lightness of the pigment before mixing is what
  // decides whether the result is a card ground or a label.
  const out: MatteAccent = {
    ink:    rgbStr(mix(hslRgb(h, 52, 68), CLAY,      EARTH_MIX - 0.14)),
    edge:   rgbStr(mix(hslRgb(h, 48, 54), CLAY,      EARTH_MIX)),
    wash:   `rgba(${rgbStr(mix(hslRgb(h, 40, 44), CLAY, EARTH_MIX)).slice(4, -1)},0.18)`,
    fill:   rgbStr(mix(hslRgb(h, 52, 32), CLAY_DARK, FILL_MIX)),
    border: rgbStr(mix(hslRgb(h, 44, 44), CLAY_DARK, FILL_MIX - 0.10)),
  };
  matteCache.set(hex, out);
  return out;
}

