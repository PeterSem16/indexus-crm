import { useState, useEffect } from 'react';
import Constants from 'expo-constants';
import { API_BASE_URL } from '@/constants/config';

const LOCAL_VERSION = Constants.expoConfig?.version || '1.2.30';

let _cachedServerVersion: string | null = null;

export function useAppVersion() {
  const [version, setVersion] = useState<string>(_cachedServerVersion ?? LOCAL_VERSION);

  useEffect(() => {
    if (_cachedServerVersion) return;
    fetch(`${API_BASE_URL}/api/mobile/app-version`, { signal: AbortSignal.timeout(5000) })
      .then(r => r.ok ? r.json() : null)
      .then((data: { version: string } | null) => {
        if (data?.version) {
          _cachedServerVersion = data.version;
          setVersion(data.version);
        }
      })
      .catch(() => {});
  }, []);

  return version;
}
