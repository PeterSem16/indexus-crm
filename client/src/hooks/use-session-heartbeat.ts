import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/auth-context";

const HEARTBEAT_INTERVAL_MS = 60 * 1000;

export function useSessionHeartbeat() {
  const { user } = useAuth();
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
        await fetch("/api/auth/heartbeat", {
          method: "POST",
          credentials: "include",
        });
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
  }, [user]);
}
