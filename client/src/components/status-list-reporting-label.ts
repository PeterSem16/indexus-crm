import { translations, type Locale } from "@/i18n/translations";

export function statusListReportingLabel(key: string, locale: string): string {
  const language = locale.toLowerCase().split(/[-_]/)[0] as Locale;
  return translations[language]?.statusListReportingLabels[key]
    || translations.en.statusListReportingLabels[key]
    || key.replace(/_/g, " ").replace(/\b[a-z]/g, letter => letter.toUpperCase());
}

export function statusListReportingTooltip(key: string, locale: string): string {
  const language = locale.toLowerCase().split(/[-_]/)[0] as Locale;
  return `${statusListReportingLabel(key, locale)} · ${key} — ${translations[language]?.statusListCanonicalStatusHint || translations.en.statusListCanonicalStatusHint}`;
}
