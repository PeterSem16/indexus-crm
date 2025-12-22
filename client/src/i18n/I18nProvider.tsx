import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { translations, Translations, Locale, COUNTRY_TO_LOCALE } from './translations';

interface I18nContextType {
  locale: Locale;
  t: Translations;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function getLocaleFromCountries(countries: string[]): Locale {
  if (countries.length === 1) {
    const countryCode = countries[0];
    return COUNTRY_TO_LOCALE[countryCode] || 'en';
  }
  return 'en';
}

interface I18nProviderProps {
  children: React.ReactNode;
  userCountries?: string[];
}

export function I18nProvider({ children, userCountries = [] }: I18nProviderProps) {
  const [locale, setLocale] = useState<Locale>('en');

  useEffect(() => {
    const detectedLocale = getLocaleFromCountries(userCountries);
    setLocale(detectedLocale);
  }, [userCountries]);

  const t = useMemo(() => translations[locale], [locale]);

  const value = useMemo(() => ({
    locale,
    t,
    setLocale,
  }), [locale, t]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextType {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
