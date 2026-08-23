'use client';

import { nearestClubColor, CLUB_COLORS } from './clubTheme';

/**
 * Reads the dominant colours out of a club badge and maps them onto our palette.
 *
 * Browser-only: it draws the badge to a canvas and reads the pixels back. That works
 * because media.api-sports.io serves the images with CORS enabled (verified — a
 * cross-origin fetch to a host without CORS is blocked in the same context, this one
 * is not), so the canvas is not tainted and needs no proxy.
 *
 * Accuracy is roughly 6 in 10 on its own, and the failures are systematic rather than
 * random:
 *   - Black-and-white clubs (Newcastle, Juventus) have their identity filtered out by
 *     the saturation cut, which exists to stop outlines winning.
 *   - Multi-colour clubs pick whichever covers more area, not the identity colour —
 *     Man City's badge holds more navy than sky blue.
 * So this returns several ranked candidates and the UI treats them as a suggestion to
 * confirm, never as an answer.
 */

const SAMPLE = 80;          // downscale before sampling; badges are 150x150
const MIN_SATURATION = 0.25; // below this is grey/white/black — usually outlines
const MIN_LIGHTNESS = 0.12;
const MAX_LIGHTNESS = 0.92;

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Palette colours matching the badge, best first. Empty when the badge is missing, or
 * has no colour worth using (a purely black-and-white crest, for instance).
 */
export async function suggestColorsFromBadge(
  badgeUrl: string,
  limit = 3,
): Promise<{ name: string; hex: string }[]> {
  const img = await loadImage(badgeUrl);
  if (!img) return [];

  let data: Uint8ClampedArray;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = SAMPLE;
    canvas.height = SAMPLE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return [];
    ctx.clearRect(0, 0, SAMPLE, SAMPLE);
    ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
    data = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;
  } catch {
    // Tainted canvas — should not happen given the CORS headers, but never break signup
    // over a colour suggestion.
    return [];
  }

  const buckets = new Map<string, { weight: number; r: number; g: number; b: number; n: number }>();

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 200) continue;

    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const lightness = (mx + mn) / 510;
    const saturation = mx === mn ? 0 : (mx - mn) / (255 - Math.abs(mx + mn - 255));
    if (saturation < MIN_SATURATION) continue;
    if (lightness < MIN_LIGHTNESS || lightness > MAX_LIGHTNESS) continue;

    const key = `${r >> 3},${g >> 3},${b >> 3}`;
    const prev = buckets.get(key) ?? { weight: 0, r: 0, g: 0, b: 0, n: 0 };
    buckets.set(key, {
      weight: prev.weight + 1 + saturation * 2, // favour saturated pixels over muddy ones
      r: prev.r + r, g: prev.g + g, b: prev.b + b,
      n: prev.n + 1,
    });
  }

  if (buckets.size === 0) return [];

  const ranked = [...buckets.values()]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 12)
    .map(v => {
      const hex = '#' + [v.r / v.n, v.g / v.n, v.b / v.n]
        .map(c => Math.round(c).toString(16).padStart(2, '0')).join('');
      return nearestClubColor(hex);
    });

  // Several badge colours often land on the same palette entry; keep first occurrence.
  const seen = new Set<string>();
  const unique: { name: string; hex: string }[] = [];
  for (const c of ranked) {
    if (seen.has(c.hex)) continue;
    seen.add(c.hex);
    unique.push(c);
    if (unique.length >= limit) break;
  }
  return unique;
}

/** Fallback ordering when there is no badge to read — keeps the picker useful. */
export const DEFAULT_SUGGESTIONS = CLUB_COLORS.slice(0, 3);
