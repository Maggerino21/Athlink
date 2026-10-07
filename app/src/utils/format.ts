/**
 * Dates in the user's language.
 *
 * Every screen formatted with a hardcoded `'en-GB'`, which is exactly the kind
 * of thing that survives a translation pass and then prints "Saturday 20 Sep"
 * in the middle of an otherwise Norwegian screen. Ask here instead: the tag
 * follows i18next's active language, which `i18n/index.ts` seeds from the
 * device locale and `AuthContext` overrides with `profiles.language` at login.
 *
 * Norwegian writes weekdays and months in lower case ("mandag", "sep"). That is
 * correct, not a bug — the places that want capitals (Schedule's day cards)
 * uppercase them themselves.
 */
import i18n from '../i18n';

export function localeTag(): string {
  return i18n.language === 'no' ? 'nb-NO' : 'en-GB';
}

const asDate = (d: Date | string) => (typeof d === 'string' ? new Date(d) : d);

function fmt(d: Date | string, opts: Intl.DateTimeFormatOptions): string {
  return asDate(d).toLocaleDateString(localeTag(), opts);
}

/** "Monday" · "mandag" */
export const weekdayLong = (d: Date | string) => fmt(d, { weekday: 'long' });
/** "Mon" · "man." */
export const weekdayShort = (d: Date | string) => fmt(d, { weekday: 'short' });
/** "20 Sep" · "20. sep." */
export const dayMonth = (d: Date | string) => fmt(d, { day: 'numeric', month: 'short' });
/** "Sat 20 Sep" · "lør. 20. sep." */
export const weekdayDayMonth = (d: Date | string) =>
  fmt(d, { weekday: 'short', day: 'numeric', month: 'short' });
/** "Monday 20 September" · "mandag 20. september" */
export const longDate = (d: Date | string) =>
  fmt(d, { weekday: 'long', day: 'numeric', month: 'long' });
/**
 * "Sep" · "sep" — Schedule's month strip and day cards. The trailing full stop
 * Norwegian uses is dropped: these are set in capitals as labels, where it
 * reads as a typo rather than as grammar.
 */
export const monthShort = (d: Date | string) =>
  fmt(d, { month: 'short' }).replace(/\.$/, '');

/**
 * 24-hour wall clock in the device's zone. Never slice a timestamptz — the wire
 * format is UTC, and slicing it printed Oslo kick-offs two hours early.
 */
export const time = (iso: string) =>
  new Date(iso).toLocaleTimeString(localeTag(), { hour: '2-digit', minute: '2-digit', hour12: false });
