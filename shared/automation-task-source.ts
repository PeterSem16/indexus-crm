/** Only user-originated source changes publish a new communication identity. */
export function taskCommunicationSourceChanged(event: {
  module: string; entityId?: string | null; causationRunId?: string | null; eventType: string;
  newValues?: unknown; oldValues?: unknown;
}): boolean {
  if (event.module !== "task" || !event.entityId || event.causationRunId) return false;
  if (event.eventType === "created") return true;
  if (event.eventType !== "updated") return false;
  const current = event.newValues as Record<string, unknown> | null;
  const previous = event.oldValues as Record<string, unknown> | null;
  return ["title", "description", "taskText"].some(field => current?.[field] !== previous?.[field]) ||
    JSON.stringify(current?.attachments || []) !== JSON.stringify(previous?.attachments || []);
}
