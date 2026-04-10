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
    top:    [hexToRgba(primaryColor, 0.35), hexToRgba(primaryColor, 0)] as [string, string],
    bottom: [hexToRgba(primaryColor, 0.18), hexToRgba(primaryColor, 0)] as [string, string],
  };
}
