import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import en from './en.json';
import no from './no.json';

const deviceLocale = Localization.getLocales()[0]?.languageCode ?? 'en';
const defaultLang  = deviceLocale === 'nb' || deviceLocale === 'nn' || deviceLocale === 'no' ? 'no' : 'en';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      no: { translation: no },
    },
    lng: defaultLang,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v4',
  });

export default i18n;
