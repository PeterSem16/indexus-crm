import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

let useAsyncStorageFallback = false;

export async function setItem(key: string, value: string): Promise<void> {
  if (useAsyncStorageFallback) {
    await AsyncStorage.setItem(key, value);
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    console.warn('[SecureStorage] SecureStore failed, falling back to AsyncStorage');
    useAsyncStorageFallback = true;
    await AsyncStorage.setItem(key, value);
  }
}

export async function getItem(key: string): Promise<string | null> {
  if (useAsyncStorageFallback) {
    return AsyncStorage.getItem(key);
  }
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    useAsyncStorageFallback = true;
    return AsyncStorage.getItem(key);
  }
}

export async function deleteItem(key: string): Promise<void> {
  if (useAsyncStorageFallback) {
    await AsyncStorage.removeItem(key);
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    useAsyncStorageFallback = true;
    await AsyncStorage.removeItem(key);
  }
}
