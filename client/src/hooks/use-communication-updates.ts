import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { useChatContext } from "@/contexts/chat-context";
import { apiRequest } from "@/lib/queryClient";
import type { Task } from "@shared/schema";
import { communicationTaskCounts, communicationTaskVersion, communicationChatCount } from "@/lib/communication-updates";

function readSeen(userId: string): Record<string, string> | null {
  try {
    const value = JSON.parse(localStorage.getItem(`pulse-communication-seen:${userId}`) || "null");
    return value && typeof value === "object" && !Array.isArray(value)
      && Object.values(value).every(item => typeof item === "string") ? value : null;
  } catch { return null; }
}
function writeSeen(userId: string, value: Record<string, string>) {
  try { localStorage.setItem(`pulse-communication-seen:${userId}`, JSON.stringify(value)); }
  catch { /* Reading still works for this session when browser storage is unavailable. */ }
}
export function useCommunicationUpdates(enabled: boolean) {
  const { user } = useAuth();
  const chat = useChatContext();
  const qc = useQueryClient();
  const [seen, setSeen] = useState<{ userId: string; versions: Record<string, string> | null }>({ userId: "", versions: null });
  const tasks = useQuery<Task[]>({
    queryKey: ["/api/tasks/created", user?.id],
    queryFn: async () => (await apiRequest("GET", "/api/tasks/created")).json(),
    enabled: enabled && !!user?.id, staleTime: 0, refetchInterval: enabled ? 5000 : false,
  });
  const threads = useQuery<{ partnerId: string; unreadCount: number }[]>({
    queryKey: ["/api/chat/conversations", user?.id],
    queryFn: async () => (await apiRequest("GET", "/api/chat/conversations")).json(),
    enabled: enabled && !!user?.id, staleTime: 0, refetchInterval: enabled ? 15000 : false,
  });
  useEffect(() => {
    setSeen({ userId: user?.id || "", versions: user?.id ? readSeen(user.id) : null });
  }, [user?.id]);
  useEffect(() => {
    if (!user?.id || seen.userId !== user.id || seen.versions || !tasks.isSuccess) return;
    const versions = Object.fromEntries(tasks.data.map(task => [task.id, communicationTaskVersion(task)]));
    writeSeen(user.id, versions);
    setSeen({ userId: user.id, versions });
  }, [user?.id, seen, tasks.data, tasks.isSuccess]);
  useEffect(() => {
    if (!enabled || !user?.id) return;
    const refresh = () => { void qc.invalidateQueries({ queryKey: ["/api/chat/conversations", user.id] }); };
    window.addEventListener("chat_new_message", refresh);
    window.addEventListener("chat_read_confirmed", refresh);
    return () => {
      window.removeEventListener("chat_new_message", refresh);
      window.removeEventListener("chat_read_confirmed", refresh);
    };
  }, [enabled, user?.id, qc]);
  const markTaskViewed = useCallback((task: Task) => {
    if (!user?.id) return;
    setSeen(previous => {
      if (previous.userId !== user.id || !previous.versions) return previous;
      const version = communicationTaskVersion(task);
      if (previous.versions[task.id] === version) return previous;
      const versions = { ...previous.versions, [task.id]: version };
      writeSeen(user.id, versions);
      return { userId: user.id, versions };
    });
  }, [user?.id]);
  const sameUser = seen.userId === user?.id;
  return {
    counts: {
      ...communicationTaskCounts(tasks.data || [], sameUser ? seen.versions : null),
      chat: sameUser ? communicationChatCount(threads.data || [], chat.unreadCounts) : 0,
    },
    markTaskViewed,
  };
}
