import { queryClient } from "@/lib/queryClient";

/** The Omni task inbox and standalone Tasks page share the task query cache. */
export async function invalidateTaskReassignment() {
  await queryClient.invalidateQueries({
    predicate: query => {
      const key = query.queryKey[0];
      return typeof key === "string" && (
        key === "/api/tasks" || key.startsWith("/api/tasks/") ||
        key === "/api/task-groups" || key.startsWith("/api/task-groups/") ||
        key.startsWith("/api/notifications")
      );
    },
  });
}