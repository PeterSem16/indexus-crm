import { useEffect, useRef } from "react";
import { useAgentSession } from "@/contexts/agent-session-context";

const HEARTBEAT_INTERVAL_MS = 30 * 1000;

// Keeps the agent session's lastActiveAt fresh while the Nexus Pulse workspace is
// open, so inbound routing knows the agent is genuinely present at their desk. When
// the workspace is unmounted (agent navigates away or closes it) the beats stop, the
// session goes stale after the engine's PRESENCE_STALE_MS window, and inbound calls
// fall through to standing forward (mobile).
//
// MUST stay workspace-scoped — do NOT move this to AgentSessionProvider / app-wide.
// The bug this fixes is an agent whose INDEXUS is still open on OTHER pages (the SIP
// softphone registers on app-auth alone, so it answers 180 and the desk rings) but
// who left a stale, un-ended agent session. An app-wide heartbeat — even gated on
// isSessionActive — would keep that stale session fresh for as long as INDEXUS is
// open anywhere and reintroduce the desk-ring bug. Accepted tradeoff: an on-shift
// agent who leaves this page for longer than the stale window has inbound calls
// diverted to their mobile.
export function useAgentSessionHeartbeat() {
  const { session, isSessionActive } = useAgentSession();
  const sessionId = session?.id ?? null;
  const activeRef = useRef(false);
  activeRef.current = isSessionActive && !!sessionId;

  useEffect(() => {
    if (!isSessionActive || !sessionId) return;

    const beat = async () => {
      if (!activeRef.current) return;
      try {
        await fetch(`/api/agent-sessions/${sessionId}/heartbeat`, {
          method: "POST",
          credentials: "include",
        });
      } catch {
        // best-effort; a missed beat is recovered by the next interval
      }
    };

    beat();
    const interval = window.setInterval(beat, HEARTBEAT_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isSessionActive, sessionId]);
}
