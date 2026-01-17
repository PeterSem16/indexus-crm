import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LANGUAGE_KEY, DEFAULT_LANGUAGE, SupportedLanguage } from '@/constants/config';

const NOTIFICATIONS_KEY = 'indexus_notifications_enabled';

interface SettingsState {
  language: SupportedLanguage;
  notificationsEnabled: boolean;
  setLanguage: (language: SupportedLanguage) => Promise<void>;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
  loadSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  language: DEFAULT_LANGUAGE,
  notificationsEnabled: true,

  setLanguage: async (language: SupportedLanguage) => {
    await AsyncStorage.setItem(LANGUAGE_KEY, language);
    set({ language });
  },

  setNotificationsEnabled: async (enabled: boolean) => {
    await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(enabled));
    set({ notificationsEnabled: enabled });
  },

  loadSettings: async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY) as SupportedLanguage | null;
      const savedNotifications = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
      
      if (savedLanguage) {
        set({ language: savedLanguage });
      }
      if (savedNotifications !== null) {
        set({ notificationsEnabled: JSON.parse(savedNotifications) });
      }
    } catch {
    }
  },
}));
