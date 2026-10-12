import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/queryClient";

/** One actor-private cache shared by the global menu and the SMS workspace. */
export function useOmniSmsUnread() {
  const { user } = useAuth();
  const query = useQuery<{ unread: number }>({
    queryKey: ["omni-sms", "unread", user?.id ?? "anonymous"],
    queryFn: async () => (await apiRequest("GET", "/api/omni-sms/unread")).json(),
    enabled: Boolean(user?.id),
    staleTime: 0,
    refetchInterval: 10_000,
  });
  return { ...query, unread: query.isError ? 0 : query.data?.unread ?? 0 };
}
