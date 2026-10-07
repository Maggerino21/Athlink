/**
 * i18next setup.
 *
 * The language list lives in `languages.ts`; this file only wires the files it
 * names into i18next. **Adding a language is two lines here** — an import and a
 * `resources` entry — plus its row in `LANGUAGES`.
 *
 * `fallbackLng: 'en'` means a key missing from a translation shows the English
 * string instead of the key itself, so a language can ship incomplete without
 * anything breaking visibly. That is a safety net, not a plan: see the note in
 * `languages.ts` about only listing a language once it is actually translated.
 *
 * **Dates deliberately do not follow the UI language** beyond English and
 * Norwegian — see `utils/format.ts`. A date in English is legible to everyone,
 * and it is not worth carrying a locale map for.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import { resolveDeviceLanguage } from './languages';

import en from './en.json';
import no from './no.json';
import de from './de.json';
import es from './es.json';
import fr from './fr.json';

const resources = {
  en: { translation: en },
  no: { translation: no },
  de: { translation: de },
  es: { translation: es },
  fr: { translation: fr },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: resolveDeviceLanguage(Localization.getLocales()[0]?.languageCode),
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v4',
  });

export default i18n;
