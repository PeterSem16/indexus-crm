/** The same contract is used by the editor, save validation and execution. */
export type UpdateField = {
  key: string;
  kind: "text" | "number" | "boolean" | "date" | "enum" | "reference";
  nullable?: boolean;
  options?: string[];
  reference?: string;
  min?: number;
  max?: number;
};
const text = (key: string): UpdateField => ({ key, kind: "text", nullable: true });
const date = (key: string): UpdateField => ({ key, kind: "date", nullable: true });
const reference = (key: string, reference: string): UpdateField => ({ key, kind: "reference", reference, nullable: true });
export const UPDATE_RECORD_ENTITIES: Record<string, UpdateField[]> = {
  task: [
    { key: "title", kind: "text" }, text("description"),
    { key: "status", kind: "enum", options: ["pending", "in_progress", "completed", "cancelled"] },
    { key: "priority", kind: "enum", options: ["low", "medium", "high", "urgent"] },
    date("dueDate"), { key: "assignedUserId", kind: "reference", reference: "user" }, reference("assignedDepartmentId", "department"),
  ],
  customer: [text("notes"), { key: "leadScore", kind: "number", min: 0, max: 100 }, reference("assignedUserId", "user")],
  hospital: [{ key: "isActive", kind: "boolean" }, { key: "autoRecruiting", kind: "boolean" }, reference("responsiblePersonId", "user")],
  clinic: [text("notes"), { key: "isActive", kind: "boolean" }, date("nextContactDate")],
  invoice: [text("note"), date("dueDate")],
  collection: [text("note"), text("doctorNote"), date("collectionDate"), { key: "status", kind: "reference", reference: "collection_status", nullable: true }],
  collaborator: [{ key: "isActive", kind: "boolean" }],
  contract: [text("internalNotes"), date("validFrom"), date("validTo")],
  campaign: [text("description")],
  product: [text("description"), { key: "isActive", kind: "boolean" }],
};
export type UpdateRecordTarget = {
  mode: "event" | "related" | "selected";
  entityType: string;
  recordId?: string;
  relation?: string;
};
export type UpdateRecordConfig = {
  updateRecordVersion: 2;
  target: UpdateRecordTarget;
  fields: Record<string, unknown>;
  acknowledged: boolean;
  clearAcknowledged?: boolean;
};
/** Only persisted, explicit, single-valued relationships are offered. */
export const UPDATE_RECORD_RELATIONS: Record<string, Array<{ key: string; entityType: string }>> = {
  task: [{ key: "customerId", entityType: "customer" }, { key: "relatedEntityId", entityType: "dynamic" }],
  invoice: [{ key: "customerId", entityType: "customer" }],
  collection: [
    { key: "customerId", entityType: "customer" }, { key: "hospitalId", entityType: "hospital" },
    { key: "clinicId", entityType: "clinic" }, { key: "collaboratorId", entityType: "collaborator" },
    { key: "contractId", entityType: "contract" },
  ],
  contract: [{ key: "customerId", entityType: "customer" }],
  collaborator: [{ key: "hospitalId", entityType: "hospital" }, { key: "clinicId", entityType: "clinic" }],
  customer: [],
};
export function updateRecordIssues(config: any, sourceModule: string, allowTemplates = true): string[] {
  const issues: string[] = [];
  if (!config || config.updateRecordVersion !== 2) return ["version"];
  const target = config.target;
  if (!target || !["event", "related", "selected"].includes(target.mode) ||
      !Object.hasOwn(UPDATE_RECORD_ENTITIES, target.entityType)) return ["target"];
  if (target.mode === "event" && target.entityType !== sourceModule) issues.push("eventTarget");
  if (target.mode === "selected" && (typeof target.recordId !== "string" || !target.recordId.trim() ||
      /[{}]/.test(target.recordId))) issues.push("recordRequired");
  if (target.mode === "related" && !(UPDATE_RECORD_RELATIONS[sourceModule] || []).some(
    item => item.key === target.relation && (item.entityType === target.entityType || item.entityType === "dynamic"),
  )) issues.push("relation");
  if (target.mode !== "selected" && target.recordId) issues.push("target");
  if (config.acknowledged !== true) issues.push("acknowledge");
  if (!config.fields || typeof config.fields !== "object" || Array.isArray(config.fields) ||
      !Object.keys(config.fields).length) return [...issues, "fieldsRequired"];
  if (Object.keys(config.fields).length > 20) issues.push("fieldsRequired");
  if (Object.values(config.fields).some(value => value === null) && config.clearAcknowledged !== true)
    issues.push("clearAcknowledge");
  for (const [key, value] of Object.entries(config.fields)) {
    const field = UPDATE_RECORD_ENTITIES[target.entityType].find(item => item.key === key);
    if (!field) { issues.push(`field:${key}`); continue; }
    if (allowTemplates && typeof value === "string" && /{{/.test(value)) {
      if (!/^{{\s*(?:newValues|oldValues)\.[A-Za-z][A-Za-z0-9]*\s*}}$/.test(value)) issues.push(`value:${key}`);
      continue;
    }
    if (value === null) { if (!field.nullable) issues.push(`value:${key}`); continue; }
    const valid = field.kind === "boolean" ? typeof value === "boolean"
      : field.kind === "number" ? typeof value === "number" && Number.isFinite(value) &&
        (field.min == null || value >= field.min) && (field.max == null || value <= field.max)
      : field.kind === "enum" ? typeof value === "string" && field.options?.includes(value)
      : field.kind === "date" ? typeof value === "string" && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) &&
        !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value.slice(0, 10)
      : field.kind === "reference" ? (field.reference === "collection_status"
        ? Number.isInteger(value) && Number(value) > 0
        : typeof value === "string" && Boolean(value.trim()) && value.length <= 200)
      : typeof value === "string" && value.length <= 10000 && Boolean(value.trim());
    if (!valid) issues.push(`value:${key}`);
  }
  return issues;
}
