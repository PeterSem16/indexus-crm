import { UPDATE_RECORD_RELATIONS, type UpdateRecordTarget } from "./automation-update-record";

export const OWNER_FIELDS = {
  task: "assignedUserId",
  customer: "assignedUserId",
  hospital: "responsiblePersonId",
} as const;
export const OWNER_STRATEGIES = ["specific", "round_robin", "least_loaded", "random"] as const;
export const REPRESENTATIVE_TARGETS = ["clinic", "hospital"] as const;
export function assignmentField(config: any): string | undefined {
  if (config.assignmentKind === "representative")
    return REPRESENTATIVE_TARGETS.includes(config.target?.entityType) ? "representativeId" : undefined;
  if (config.assignmentKind != null && config.assignmentKind !== "owner") return undefined;
  return OWNER_FIELDS[config.target?.entityType as keyof typeof OWNER_FIELDS];
}
export type AssignOwnerConfig = {
  assignOwnerVersion: 2;
  assignmentKind?: "owner" | "representative";
  target: UpdateRecordTarget;
  strategy: typeof OWNER_STRATEGIES[number];
  userIds: string[];
  replaceExisting: boolean;
  acknowledged: boolean;
};
export function assignOwnerIssues(config: any, module: string): string[] {
  if (!config || config.assignOwnerVersion !== 2) return ["version"];
  const issues: string[] = [], target = config.target;
  if (!target || !assignmentField(config) ||
    !["event", "related", "selected"].includes(target.mode)) return ["target"];
  if (target.mode === "event" && target.entityType !== module) issues.push("eventTarget");
  if (target.mode === "selected" && (typeof target.recordId !== "string" ||
    !target.recordId.trim() || /[{}]/.test(target.recordId))) issues.push("record");
  if (target.mode === "related" && !(UPDATE_RECORD_RELATIONS[module] || []).some(relation =>
    relation.key === target.relation && (relation.entityType === target.entityType || relation.entityType === "dynamic")))
    issues.push("relation");
  if (!OWNER_STRATEGIES.includes(config.strategy)) issues.push("strategy");
  if (!Array.isArray(config.userIds) || !config.userIds.length || config.userIds.length > 50 ||
    config.userIds.some((id: unknown) => typeof id !== "string" || !id.trim() || /[{},]/.test(id)) ||
    new Set(config.userIds).size !== config.userIds.length ||
    (config.strategy === "specific" && config.userIds.length !== 1)) issues.push("users");
  if (typeof config.replaceExisting !== "boolean") issues.push("replace");
  if (config.acknowledged !== true) issues.push("acknowledgment");
  // A reviewed v2 action never carries hidden legacy overrides or fallback filters.
  if (["entityType", "entityId", "userId", "roleFilter", "countryFilter"].some(key => config[key] != null))
    issues.push("legacyOverrides");
  return issues;
}
