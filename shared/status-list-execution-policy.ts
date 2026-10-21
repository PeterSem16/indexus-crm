export type StatusListExecutionMode = "immediate" | "batch";
export function statusListExecutionMode(settings: unknown): StatusListExecutionMode {
  const value = typeof settings === "string" ? JSON.parse(settings || "{}") : settings;
  if (value == null) return "immediate";
  const mode = (value as any).statusListMode;
  if (mode == null || mode === "immediate") return "immediate";
  if (mode === "batch") return "batch";
  throw new Error("invalid_status_list_mode");
}
export function checkStatusListExecution(settings: unknown, command: { executionMode?: unknown; commit?: unknown }) {
  const mode = statusListExecutionMode(settings);
  if (command.executionMode != null && command.executionMode !== mode) throw new Error("status_list_mode_changed");
  if (mode === "batch" && (command.executionMode !== "batch" || command.commit !== true))
    throw new Error("status_list_batch_save_required");
  return mode;
}
/** Include cleared siblings as well as the newly selected answer. */
export function statusListAnswerChanges(before: Record<string, any>, after: Record<string, any>) {
  return Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort()
    .filter(id => (before[id] ?? null) !== (after[id] ?? null))
    .map(questionId => ({ questionId, expected: before[questionId] ?? null, value: after[questionId] ?? null }));
}
export function hasStatusListCallbackAction(item: any, dispositions: any[]) {
  return (item?.automations || []).some((action: any) => action.actionType === "set_callback" ||
    (action.actionType === "set_contact_status" && dispositions.some(disposition =>
      String(disposition.id) === String(action.dispositionId) &&
      ["callback", "schedule_email", "schedule_sms"].includes(disposition.actionType))));
}
