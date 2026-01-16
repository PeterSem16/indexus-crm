import { useSettingsStore } from '@/stores/settingsStore';
import { getTranslation, t } from '@/i18n/translations';

export function useTranslation() {
  const language = useSettingsStore((state) => state.language);
  
  return {
    t: (path: string) => t(language, path),
    translations: getTranslation(language),
    language,
  };
}
