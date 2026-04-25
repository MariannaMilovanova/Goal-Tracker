import React, { PropsWithChildren, useEffect } from 'react';
import { useLocales } from 'expo-localization';
import { I18nextProvider } from 'react-i18next';

import i18n, { resolveSupportedLocale } from './index';

export function AppI18nProvider({ children }: PropsWithChildren) {
  const locales = useLocales();

  useEffect(() => {
    const nextLanguage = resolveSupportedLocale(locales[0]?.languageTag);
    if (i18n.resolvedLanguage !== nextLanguage) {
      void i18n.changeLanguage(nextLanguage);
    }
  }, [locales]);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
