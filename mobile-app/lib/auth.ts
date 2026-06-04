import { setItem, getItem, deleteItem } from './secureStorage';
import { api } from './api';
import { TOKEN_KEY, USER_KEY } from '@/constants/config';

export interface LoginResponse {
  token: string;
  collaborator: {
    id: string;
    firstName: string;
    lastName: string;
    countryCode: string;
    avatarUrl?: string | null;
  };
}

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  countryCode: string;
  avatarUrl?: string | null;
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/api/mobile/auth/login', {
    username,
    password,
  });

  await setItem(TOKEN_KEY, response.token);
  await setItem(USER_KEY, JSON.stringify(response.collaborator));

  return response;
}

export async function logout(): Promise<void> {
  try {
    await api.delete('/api/mobile/push-token');
  } catch {
  }

  await deleteItem(TOKEN_KEY);
  await deleteItem(USER_KEY);
}

export async function verifyToken(): Promise<boolean> {
  try {
    const token = await getItem(TOKEN_KEY);
    if (!token) return false;

    const data = await api.get<{ valid: boolean; collaborator: AuthUser }>('/api/mobile/auth/verify');
    if (data?.collaborator) {
      await setItem(USER_KEY, JSON.stringify(data.collaborator));
    }
    return true;
  } catch {
    return false;
  }
}

export async function getStoredUser(): Promise<AuthUser | null> {
  try {
    const userData = await getItem(USER_KEY);
    if (!userData) return null;
    return JSON.parse(userData);
  } catch {
    return null;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getItem(TOKEN_KEY);
  return !!token;
}
