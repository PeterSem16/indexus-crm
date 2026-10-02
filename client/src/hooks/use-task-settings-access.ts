import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/queryClient";

/** Settings authority is resolved by the server, not by a role's display name. */
export function useTaskSettingsAccess() {
  const { user } = useAuth();
  const access = useQuery<{ canManage: boolean }>({
    queryKey: ["/api/task-settings/access", user?.id],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/task-settings/access");
      return response.json();
    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: false,
  });
  return {
    canManage: !!user?.id && !access.isError && access.data?.canManage === true,
    isPending: !!user?.id && access.isPending,
  };
}