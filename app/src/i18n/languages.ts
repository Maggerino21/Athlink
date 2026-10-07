/**
 * The languages the app ships in.
 *
 * **A language belongs here only once its translation file exists and someone
 * who speaks it has read the strings.** i18next falls back to English for a
 * missing key, so a half-finished language does not crash — it just quietly
 * shows English in places, which reads worse to a player than English would
 * have. Offering a language is a promise that it is actually translated.
 *
 * Everything else reads this list: the signup picker, the settings picker, and
 * the device-locale guess at first launch. Adding a language is this file plus
 * the import in `index.ts` — nothing else needs to know how many there are.
 *
 * `native` is what the speaker calls it, because that is what someone scanning
 * a list is looking for. `english` is there so the search box also matches what
 * a Norwegian coach would type while helping a new signing set their phone up.
 */
export interface Language {
  /** ISO 639-1, and the key in `profiles.language`. */
  code: string;
  /** The name in that language — "Norsk", not "Norwegian". */
  native: string;
  /** The English name, for searching. */
  english: string;
}

export const LANGUAGES: Language[] = [
  { code: 'en', native: 'English',  english: 'English' },
  { code: 'no', native: 'Norsk',    english: 'Norwegian' },
  { code: 'de', native: 'Deutsch',  english: 'German' },
  { code: 'es', native: 'Español',  english: 'Spanish' },
  { code: 'fr', native: 'Français', english: 'French' },
];

export const DEFAULT_LANGUAGE = 'en';

/** Every code we ship, for a quick membership test. */
const CODES = new Set(LANGUAGES.map(l => l.code));

/**
 * The language to start in, from the phone's own setting.
 *
 * Norwegian reaches us as `nb`, `nn` or `no` depending on the device, and all
 * three mean the same file.
 */
export function resolveDeviceLanguage(deviceCode: string | undefined | null): string {
  if (!deviceCode) return DEFAULT_LANGUAGE;
  const code = deviceCode.toLowerCase().split('-')[0];
  if (code === 'nb' || code === 'nn' || code === 'no') return 'no';
  return CODES.has(code) ? code : DEFAULT_LANGUAGE;
}

/** The entry for a code, falling back to the default rather than returning undefined. */
export function languageFor(code: string | null | undefined): Language {
  return LANGUAGES.find(l => l.code === code) ?? LANGUAGES[0];
}

/**
 * Languages matching what someone has typed — native name or English name.
 * An empty query returns the whole list.
 */
export function searchLanguages(query: string): Language[] {
  const q = query.trim().toLowerCase();
  if (!q) return LANGUAGES;
  return LANGUAGES.filter(
    l => l.native.toLowerCase().includes(q) || l.english.toLowerCase().includes(q) || l.code === q,
  );
}
