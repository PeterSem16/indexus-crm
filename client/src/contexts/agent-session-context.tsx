import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/contexts/auth-context";
import type { AgentSession, AgentBreakType, AgentBreak } from "@shared/schema";

type AgentStatus = "available" | "busy" | "break" | "wrap_up" | "offline";

interface AgentSessionContextType {
  session: AgentSession | null;
  isSessionActive: boolean;
  isLoading: boolean;
  status: AgentStatus;
  workTime: string;
  breakTime: string;
  activeBreak: AgentBreak | null;
  breakTypes: AgentBreakType[];
  stats: {
    calls: number;
    emails: number;
    sms: number;
    contactsHandled: number;
    totalBreakTime: number;
    totalWorkTime: number;
  };
  startSession: (campaignId?: string | null, campaignIds?: string[]) => Promise<void>;
  endSession: () => Promise<void>;
  updateStatus: (status: AgentStatus) => Promise<void>;
  startBreak: (breakTypeId: string) => Promise<void>;
  endBreak: () => Promise<void>;
  recordActivity: (activityType: string, contactId?: string | null, campaignContactId?: string | null, metadata?: any) => Promise<string | null>;
  endActivity: (activityId: string) => Promise<void>;
}

const AgentSessionContext = createContext<AgentSessionContextType | null>(null);

export function useAgentSession() {
  const ctx = useContext(AgentSessionContext);
  if (!ctx) throw new Error("useAgentSession must be used within AgentSessionProvider");
  return ctx;
}

export function AgentSessionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [workTime, setWorkTime] = useState("00:00:00");
  const [breakTime, setBreakTime] = useState("00:00:00");
  const workTimerRef = useRef<NodeJS.Timeout | null>(null);
  const breakTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { data: session, isLoading } = useQuery<AgentSession | null>({
    queryKey: ["/api/agent-sessions/active"],
    enabled: !!user,
    refetchInterval: 30000,
  });

  const { data: breakTypes = [] } = useQuery<AgentBreakType[]>({
    queryKey: ["/api/agent-break-types"],
    enabled: !!user,
  });

  const { data: activeBreakData } = useQuery<AgentBreak[]>({
    queryKey: ["/api/agent-sessions", session?.id, "breaks"],
    enabled: !!session?.id,
  });

  const activeBreak = activeBreakData?.find((b: any) => !b.endedAt) || null;

  const isSessionActive = !!session && !session.endedAt;
  const status: AgentStatus = (session?.status as AgentStatus) || "offline";

  const stats = {
    calls: session?.totalCallTime || 0,
    emails: session?.totalEmailTime || 0,
    sms: session?.totalSmsTime || 0,
    contactsHandled: session?.contactsHandled || 0,
    totalBreakTime: session?.totalBreakTime || 0,
    totalWorkTime: session?.totalWorkTime || 0,
  };

  useEffect(() => {
    if (workTimerRef.current) clearInterval(workTimerRef.current);
    if (!isSessionActive || !session?.startedAt) {
      setWorkTime("00:00:00");
      return;
    }
    const updateWorkTime = () => {
      const start = new Date(session.startedAt).getTime();
      const diff = Math.floor((Date.now() - start) / 1000);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setWorkTime(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);
    };
    updateWorkTime();
    workTimerRef.current = setInterval(updateWorkTime, 1000);
    return () => { if (workTimerRef.current) clearInterval(workTimerRef.current); };
  }, [isSessionActive, session?.startedAt]);

  useEffect(() => {
    if (breakTimerRef.current) clearInterval(breakTimerRef.current);
    if (!activeBreak || activeBreak.endedAt) {
      setBreakTime("00:00:00");
      return;
    }
    const updateBreakTime = () => {
      const start = new Date(activeBreak.startedAt).getTime();
      const diff = Math.floor((Date.now() - start) / 1000);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setBreakTime(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);
    };
    updateBreakTime();
    breakTimerRef.current = setInterval(updateBreakTime, 1000);
    return () => { if (breakTimerRef.current) clearInterval(breakTimerRef.current); };
  }, [activeBreak]);

  const startSession = useCallback(async (campaignId?: string | null, campaignIds?: string[]) => {
    try {
      const ids = campaignIds || (campaignId ? [campaignId] : []);
      const res = await fetch("/api/agent-sessions/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: campaignId || (ids.length > 0 ? ids[0] : null), campaignIds: ids }),
        credentials: "include",
      });
      if (res.status === 409) {
        // Session already exists, just refresh
        await queryClient.invalidateQueries({ queryKey: ["/api/agent-sessions/active"] });
        return;
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to start session");
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/agent-sessions/active"] });
    } catch (error) {
      throw error;
    }
  }, []);

  const endSession = useCallback(async () => {
    if (!session?.id) return;
    await apiRequest("POST", `/api/agent-sessions/${session.id}/end`);
    queryClient.invalidateQueries({ queryKey: ["/api/agent-sessions/active"] });
    queryClient.invalidateQueries({ queryKey: ["/api/agent-sessions"] });
  }, [session?.id]);

  const updateStatus = useCallback(async (newStatus: AgentStatus) => {
    if (!session?.id) return;
    await apiRequest("PATCH", `/api/agent-sessions/${session.id}/status`, { status: newStatus });
    queryClient.invalidateQueries({ queryKey: ["/api/agent-sessions/active"] });
  }, [session?.id]);

  const startBreak = useCallback(async (breakTypeId: string) => {
    if (!session?.id) return;
    await apiRequest("POST", `/api/agent-sessions/${session.id}/breaks`, { breakTypeId });
    queryClient.invalidateQueries({ queryKey: ["/api/agent-sessions/active"] });
    queryClient.invalidateQueries({ queryKey: ["/api/agent-sessions", session.id, "breaks"] });
  }, [session?.id]);

  const endBreak = useCallback(async () => {
    if (!activeBreak?.id) return;
    await apiRequest("POST", `/api/agent-breaks/${activeBreak.id}/end`);
    queryClient.invalidateQueries({ queryKey: ["/api/agent-sessions/active"] });
    queryClient.invalidateQueries({ queryKey: ["/api/agent-sessions", session?.id, "breaks"] });
  }, [activeBreak?.id, session?.id]);

  const recordActivity = useCallback(async (activityType: string, contactId?: string | null, campaignContactId?: string | null, metadata?: any): Promise<string | null> => {
    if (!session?.id) return null;
    const res = await apiRequest("POST", `/api/agent-sessions/${session.id}/activities`, {
      activityType,
      contactId: contactId || null,
      campaignContactId: campaignContactId || null,
      metadata: metadata || null,
    });
    const data = await res.json();
    return data.id || null;
  }, [session?.id]);

  const endActivity = useCallback(async (activityId: string) => {
    await apiRequest("POST", `/api/agent-activities/${activityId}/end`);
    queryClient.invalidateQueries({ queryKey: ["/api/agent-sessions/active"] });
  }, []);

  return (
    <AgentSessionContext.Provider value={{
      session,
      isSessionActive,
      isLoading,
      status,
      workTime,
      breakTime,
      activeBreak,
      breakTypes,
      stats,
      startSession,
      endSession,
      updateStatus,
      startBreak,
      endBreak,
      recordActivity,
      endActivity,
    }}>
      {children}
    </AgentSessionContext.Provider>
  );
}
