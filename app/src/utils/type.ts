/**
 * Type tokens.
 *
 * Two families, two jobs. The display face carries figures and day names —
 * anything the eye lands on first. The UI face carries labels, captions and
 * body text. Mixing them up is how a screen starts reading as a poster.
 *
 * `DISPLAY_FONT` is still provisional: the wordmark's typeface has not been
 * chosen yet, and the display face has to sit next to it. Everything imports
 * from here, so settling on one is a single-line change rather than a sweep.
 */
export const DISPLAY_FONT = 'Archivo_500Medium';
/**
 * The display face at a plainer weight, for type set large.
 *
 * At 60pt+ the Medium reads heavy and a little shouty; Regular keeps the same
 * grotesque character while letting the size carry the emphasis instead of the
 * stroke. Use it for the big date on a schedule card, not for labels.
 */
export const DISPLAY_FONT_LARGE = 'Archivo_400Regular';
export const UI_FONT = 'Inter_500Medium';
export const UI_FONT_REGULAR = 'Inter_400Regular';

/**
 * Inter at its thin weights, for Home's large figures and the match name.
 * Thin type only works big — below ~28pt ExtraLight loses its strokes on a dark
 * ground, so keep it to headline sizes.
 */
export const THIN_FONT = 'Inter_200ExtraLight';

/**
 * The fine box's flourish face — the wordmark's Space Grotesk, used only where
 * the fine box shows off: the chrome total and squad numbers. Kept to those so
 * it stays a flourish rather than becoming a third body face.
 */
export const FLOURISH_FONT = 'SpaceGrotesk_500Medium';
export const LIGHT_FONT = 'Inter_300Light';
