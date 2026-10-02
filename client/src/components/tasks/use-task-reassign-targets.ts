import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { ReassignTargets } from "./task-reassign-dialog.helpers";

export function useTaskReassignTargets(taskId: string | null, open: boolean) {
  return useQuery<ReassignTargets>({
    queryKey: ["/api/tasks", taskId, "reassign-targets"],
    enabled: open && !!taskId,
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/tasks/${encodeURIComponent(taskId!)}/reassign-targets`);
      return response.json();
    },
    staleTime: 0,
    refetchOnMount: "always",
    retry: false,
  });
}