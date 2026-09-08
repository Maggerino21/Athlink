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
