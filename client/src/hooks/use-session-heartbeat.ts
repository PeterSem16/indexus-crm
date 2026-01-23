import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useLocation } from "wouter";

const HEARTBEAT_INTERVAL_MS = 60 * 1000;

export function useSessionHeartbeat() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!user) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const sendHeartbeat = async () => {
      try {
        const response = await fetch("/api/auth/heartbeat", {
          method: "POST",
          credentials: "include",
        });
        
        if (response.status === 403) {
          const data = await response.json();
          if (data.error === "session_terminated") {
            // Session was terminated by admin - logout and redirect
            await logout();
            setLocation("/login?error=session_terminated");
          }
        }
      } catch (error) {
      }
    };

    sendHeartbeat();

    intervalRef.current = window.setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [user, logout, setLocation]);
}
