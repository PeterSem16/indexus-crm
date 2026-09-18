import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import type { SafeUser } from "@shared/schema";

interface ActiveSessionInfo {
  id: string;
  loginAt: string;
  ipAddress: string;
  device: string;
  lastActivityAt: string | null;
}

interface LoginResult {
  user?: SafeUser;
  requireMs365?: boolean;
  message?: string;
  userId?: string;
  error?: string;
  activeSession?: ActiveSessionInfo;
}

interface AuthContextType {
  user: SafeUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<LoginResult>;
  loginWithMs365: (username: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);

  const { data, isLoading } = useQuery<{ user: SafeUser } | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
  });

  useEffect(() => {
    if (data?.user) {
      setUser(data.user);
    } else {
      setUser(null);
    }
  }, [data]);

  const loginMutation = useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }): Promise<LoginResult> => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include",
      });
      const data = await res.json();
      if (res.status === 409 && data.activeSession) {
        return { error: "already_logged_in", activeSession: data.activeSession, message: data.message };
      }
      if (!res.ok) {
        throw new Error(data.error || data.message || "Login failed");
      }
      return data;
    },
    onSuccess: (data) => {
      if (data.user) {
        setUser(data.user);
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      }
    },
  });

  const ms365LoginMutation = useMutation({
    mutationFn: async (username: string) => {
      const res = await apiRequest("POST", "/api/auth/login-ms365", { username });
      return res.json();
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      setUser(null);
      queryClient.clear();
    },
  });

  const login = async (username: string, password: string): Promise<LoginResult> => {
    const result = await loginMutation.mutateAsync({ username, password });
    return result;
  };

  const loginWithMs365 = async (username: string) => {
    // Replit renders the app in a preview iframe, while Microsoft explicitly
    // forbids its sign-in page from being embedded. Open a window synchronously
    // while the click still counts as a user gesture so popup blockers allow it,
    // then navigate that window after the API returns the authorization URL.
    const isEmbedded = window.self !== window.top;
    const authWindow = isEmbedded ? window.open("about:blank", "_blank") : null;

    try {
      const result = await ms365LoginMutation.mutateAsync(username);
      if (result.authUrl) {
        if (authWindow) {
          authWindow.location.href = result.authUrl;
        } else {
          window.location.href = result.authUrl;
        }
      } else {
        authWindow?.close();
        throw new Error("Microsoft 365 login URL was not returned");
      }
    } catch (error) {
      authWindow?.close();
      throw error;
    }
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  return (
    // The query can finish one render before the effect copies its user.
    // Keep routing pending in that gap instead of redirecting a valid session
    // to /login and then losing the requested deep link to the landing page.
    <AuthContext.Provider value={{ user, isLoading: isLoading || (!!data?.user && !user), login, loginWithMs365, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
