import { storage } from "./storage";

const SESSION_TIMEOUT_MINUTES = 60;
const CLEANUP_INTERVAL_MS = 60 * 1000;

export function startSessionCleanup() {
  console.log(`[SessionCleanup] Starting session cleanup with ${SESSION_TIMEOUT_MINUTES}min timeout`);
  
  setInterval(async () => {
    try {
      const endedCount = await storage.endStaleSessions(SESSION_TIMEOUT_MINUTES);
      if (endedCount > 0) {
        console.log(`[SessionCleanup] Ended ${endedCount} stale session(s)`);
      }
    } catch (error) {
      console.error("[SessionCleanup] Error cleaning up sessions:", error);
    }
  }, CLEANUP_INTERVAL_MS);
}
