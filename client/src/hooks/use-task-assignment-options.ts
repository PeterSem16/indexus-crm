import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/auth-context";

export type TaskAssignmentUser = {
  id: string;
  fullName: string | null;
  username: string;
  email?: string | null;
  avatarUrl?: string | null;
};

export type TaskAssignmentGroup = {
  id: string;
  name: string;
  displayAlias?: string | null;
};

export type TaskAssignmentOptions = {
  users: TaskAssignmentUser[];
  groups: TaskAssignmentGroup[];
  canResolve: boolean;
};

export function useTaskAssignmentOptions(country?: string | null) {
  const { user } = useAuth();
  return useQuery<TaskAssignmentOptions>({
    queryKey: ["/api/tasks/assignment-options", user?.id, country || null],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/tasks/assignment-options${country ? `?country=${encodeURIComponent(country)}` : ""}`);
      return response.json();
    },
    staleTime: 0,
    enabled: !!user?.id,
  });
}