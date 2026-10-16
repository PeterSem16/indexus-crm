import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/queryClient";

interface UnreadCountsResponse {
  connected: boolean;
  counts: { mailbox: string; unreadCount: number }[];
  totalUnread?: number;
  requiresReauth?: boolean;
}

/** Shared with the email bell: one actor-private query, no second Graph poller. */
export function useOmniEmailUnread(enabled = true) {
  const { user } = useAuth();
  const query = useQuery<UnreadCountsResponse>({
    queryKey: ["/api/users", user?.id, "ms365-unread-counts"],
    queryFn: async () =>
      (await apiRequest("GET", `/api/users/${encodeURIComponent(user!.id)}/ms365-unread-counts`)).json(),
    enabled: enabled && Boolean(user?.id),
    staleTime: 10_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const total = query.data?.totalUnread;
  const unread = !query.isError && query.data?.connected && typeof total === "number" && Number.isFinite(total)
    ? Math.max(0, Math.floor(total)) : 0;
  return { ...query, unread };
}
