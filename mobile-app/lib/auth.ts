import * as SecureStore from 'expo-secure-store';
import { api } from './api';
import { TOKEN_KEY, USER_KEY } from '@/constants/config';

export interface LoginResponse {
  token: string;
  collaborator: {
    id: string;
    firstName: string;
    lastName: string;
    countryCode: string;
  };
}

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  countryCode: string;
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/api/mobile/auth/login', {
    username,
    password,
  });

  await SecureStore.setItemAsync(TOKEN_KEY, response.token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(response.collaborator));

  return response;
}

export async function logout(): Promise<void> {
  try {
    await api.delete('/api/mobile/push-token');
  } catch {
  }

  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}

export async function verifyToken(): Promise<boolean> {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!token) return false;

    await api.get('/api/mobile/auth/verify');
    return true;
  } catch {
    return false;
  }
}

export async function getStoredUser(): Promise<AuthUser | null> {
  try {
    const userData = await SecureStore.getItemAsync(USER_KEY);
    if (!userData) return null;
    return JSON.parse(userData);
  } catch {
    return null;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  return !!token;
}
