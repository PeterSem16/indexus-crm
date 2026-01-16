export const API_BASE_URL = __DEV__ 
  ? 'https://indexus.cordbloodcenter.com'
  : 'https://indexus.cordbloodcenter.com';

export const API_TIMEOUT = 30000;

export const SYNC_INTERVAL = 60000;

export const GPS_UPDATE_INTERVAL = 30000;

export const TOKEN_KEY = 'auth_token';
export const USER_KEY = 'user_data';
export const LANGUAGE_KEY = 'app_language';

export const SUPPORTED_LANGUAGES = ['sk', 'cs', 'hu', 'de', 'it', 'ro', 'en'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'sk';
