/**
 * Type tokens.
 *
 * Two families, two jobs. The display face carries figures and day names —
 * anything the eye lands on first. The UI face carries labels, captions and
 * body text. Mixing them up is how a screen starts reading as a poster.
 *
 * `DISPLAY_FONT` is still provisional: the live switcher on Home exists because
 * the wordmark's typeface has not been chosen yet, and the display face has to
 * sit next to it. Everything that is not being actively compared imports from
 * here, so settling on one is a single-line change rather than a sweep.
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
