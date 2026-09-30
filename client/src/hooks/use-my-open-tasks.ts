import { useQuery } from "@tanstack/react-query";
import type { Task } from "@shared/schema";
import { useAuth } from "@/contexts/auth-context";

export const MY_TASKS_QUERY_KEY = ["/api/tasks", "my"] as const;

export function useMyOpenTasks() {
  const { user } = useAuth();

  const query = useQuery<Task[]>({
    // Keeping "my" as a child key lets Omni's existing ["/api/tasks"]
    // invalidations refresh this user-scoped, authenticated endpoint too.
    queryKey: MY_TASKS_QUERY_KEY,
    enabled: !!user,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    select: (tasks) => tasks.filter((task) =>
      task.status === "pending" || task.status === "in_progress"
    ),
  });

  return {
    ...query,
    tasks: query.data ?? [],
    pendingTasks: (query.data ?? []).filter((task) => task.status === "pending"),
    inProgressTasks: (query.data ?? []).filter((task) => task.status === "in_progress"),
  };
}