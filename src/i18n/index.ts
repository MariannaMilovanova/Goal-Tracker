import i18n from 'i18next';
import { getLocales } from 'expo-localization';
import { initReactI18next } from 'react-i18next';

import { resources, SupportedLocale } from './resources';

export const FALLBACK_LOCALE: SupportedLocale = 'en';

export function resolveSupportedLocale(languageTag?: string | null): SupportedLocale {
  if (!languageTag) {
    return FALLBACK_LOCALE;
  }

  const normalized = languageTag.toLowerCase();

  if (normalized === 'pt-br') {
    return 'pt-BR';
  }
  if (normalized === 'en' || normalized.startsWith('en-')) {
    return 'en';
  }
  if (normalized === 'es' || normalized.startsWith('es-')) {
    return 'es';
  }
  if (normalized === 'de' || normalized.startsWith('de-')) {
    return 'de';
  }
  if (normalized === 'fr' || normalized.startsWith('fr-')) {
    return 'fr';
  }
  if (normalized === 'uk' || normalized.startsWith('uk-')) {
    return 'uk';
  }

  return FALLBACK_LOCALE;
}

const initialLanguage = resolveSupportedLocale(getLocales()[0]?.languageTag);

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: FALLBACK_LOCALE,
  supportedLngs: Object.keys(resources),
  interpolation: {
    escapeValue: false,
  },
  compatibilityJSON: 'v4',
  returnNull: false,
});

export default i18n;
