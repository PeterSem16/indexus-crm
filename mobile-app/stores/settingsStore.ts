import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LANGUAGE_KEY, DEFAULT_LANGUAGE, SupportedLanguage } from '@/constants/config';

interface SettingsState {
  language: SupportedLanguage;
  setLanguage: (language: SupportedLanguage) => Promise<void>;
  loadSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  language: DEFAULT_LANGUAGE,

  setLanguage: async (language: SupportedLanguage) => {
    await AsyncStorage.setItem(LANGUAGE_KEY, language);
    set({ language });
  },

  loadSettings: async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY) as SupportedLanguage | null;
      if (savedLanguage) {
        set({ language: savedLanguage });
      }
    } catch {
    }
  },
}));
