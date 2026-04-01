import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

let secureStoreModule: typeof import('expo-secure-store') | null = null;
let useAsyncStorageFallback = false;

async function getSecureStore() {
  if (useAsyncStorageFallback) return null;
  if (!secureStoreModule) {
    try {
      secureStoreModule = require('expo-secure-store');
    } catch {
      useAsyncStorageFallback = true;
      return null;
    }
  }
  return secureStoreModule;
}

export async function setItem(key: string, value: string): Promise<void> {
  const store = await getSecureStore();
  if (!store) {
    await AsyncStorage.setItem(key, value);
    return;
  }
  try {
    await store.setItemAsync(key, value, {
      keychainAccessible: store.WHEN_UNLOCKED,
    });
  } catch {
    useAsyncStorageFallback = true;
    await AsyncStorage.setItem(key, value);
  }
}

export async function getItem(key: string): Promise<string | null> {
  const store = await getSecureStore();
  if (!store) {
    return AsyncStorage.getItem(key);
  }
  try {
    return await store.getItemAsync(key);
  } catch {
    useAsyncStorageFallback = true;
    return AsyncStorage.getItem(key);
  }
}

export async function deleteItem(key: string): Promise<void> {
  const store = await getSecureStore();
  if (!store) {
    await AsyncStorage.removeItem(key);
    return;
  }
  try {
    await store.deleteItemAsync(key);
  } catch {
    useAsyncStorageFallback = true;
    await AsyncStorage.removeItem(key);
  }
}
