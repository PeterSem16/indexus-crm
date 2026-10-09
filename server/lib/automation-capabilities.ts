import { taskSalutationFields } from "../../shared/task-template-variables";
import { RECORD_TAG_ENTITY_TYPES, tagActionIssues, normalizeTagName, isProtectedRecordTag } from "@shared/automation-record-tags";
import { smsRecipientList } from "../../shared/automation-sms-policy";
import { COUNTRIES, TASK_PRIORITIES, TASK_STATUSES } from "@shared/schema";
import { isTaskAssignmentTriggerTarget } from "@shared/task-automation";
import { taskActionDeadline, validTaskActionRecipients } from "@shared/automation-task-action";
import { emailActionIssues } from "@shared/automation-email-action";
import { UPDATE_RECORD_ENTITIES, updateRecordIssues } from "@shared/automation-update-record";

/** Executable event and action capabilities of the standalone Automation Engine. */
export const MODULE_EVENTS: Record<string, string[]> = {
  customer: ["created", "updated", "status_changed"],
  task: ["created", "updated", "status_changed", "task.assigned", "task.completed", "task.overdue"],
  communication: ["email.received", "sms.received", "sentiment.negative"],
  contract: ["created", "updated", "status_changed", "contract.completed", "contract.cancelled"],
  hospital: ["created", "updated"],
  clinic: ["created", "updated"],
  collaborator: ["created", "updated"],
  collection: ["created", "updated"],
  campaign: ["created", "updated"],
  product: ["created", "updated"],
  invoice: ["created", "updated", "status_changed"],
  call: [
    "call.assigned", "call.answered", "call.completed", "call.abandoned", "call.timeout",
    "outbound.started", "outbound.answered", "outbound.completed", "outbound.unanswered",
  ],
};

export const MODULE_LABELS: Record<string, string> = {
  customer: "Customer", task: "Task", contract: "Contract", hospital: "Hospital",
  clinic: "Clinic", collaborator: "Collaborator", invoice: "Invoice", call: "Call",
  communication: "Communications and analyzed text",
  collection: "Collection", campaign: "Mission", product: "Product",
};

import { assignOwnerIssues } from "../../shared/automation-assign-owner";

export const ACTION_TARGETS: Record<string, string[] | null> = {
  create_task: null,
  notify_user: null,
  send_email: null,
  send_sms: null,
  webhook: null,
  update_entity: ["task", "customer", "hospital", "clinic", "invoice"],
  assign_user: ["task", "customer", "hospital"],
  add_tag: RECORD_TAG_ENTITY_TYPES,
  remove_tag: RECORD_TAG_ENTITY_TYPES,
};

/** Service descriptions are tied to existing handlers, not promises of new integrations. */
export const AUTOMATION_SERVICE_DETAILS: Record<string, { purpose: string; needs: string[] }> = {
  create_task: { purpose: "Create a task for a user, department, task group or role", needs: ["title", "assignedUserId, assignedDepartmentId, taskGroupId or targetRole"] },
  notify_user: { purpose: "Notify a user, task group or role in the application", needs: ["userId, userIds, taskGroupId or targetRole", "title"] },
  send_email: { purpose: "Send email to an address, task group or role", needs: ["to, taskGroupId or targetRole", "subject and body or templateId"] },
  send_sms: { purpose: "Send SMS to a number or verified event recipient", needs: ["to", "text or templateId"] },
  webhook: { purpose: "Call an external HTTP endpoint", needs: ["url"] },
  update_entity: { purpose: "Change permitted fields on the triggering entity", needs: ["fields"] },
  assign_user: { purpose: "Assign a reviewed internal owner or a Clinic/Hospital business representative", needs: ["assignmentKind", "target", "strategy", "explicit userIds", "replaceExisting", "acknowledged"] },
  add_tag: { purpose: "Add tags to the triggering entity", needs: ["tags"] },
  remove_tag: { purpose: "Remove tags from the triggering entity", needs: ["tags"] },
};

export const RECIPIENT_CAPABILITIES = [
  { value: "explicit_user", label: "Selected user ID", actions: ["notify_user", "create_task"], modules: Object.keys(MODULE_EVENTS) },
  { value: "explicit_department", label: "Selected department ID", actions: ["create_task"], modules: Object.keys(MODULE_EVENTS) },
  { value: "task_group", label: "Task group members", actions: ["create_task", "notify_user", "send_email"], modules: Object.keys(MODULE_EVENTS) },
  { value: "role", label: "Role members", actions: ["create_task", "notify_user", "send_email"], modules: Object.keys(MODULE_EVENTS) },
  { value: "email_address", label: "Configured email address", actions: ["send_email"], modules: Object.keys(MODULE_EVENTS) },
  { value: "phone_number", label: "Configured phone number", actions: ["send_sms"], modules: Object.keys(MODULE_EVENTS) },
  { value: "webhook_url", label: "Approved external URL", actions: ["webhook"], modules: Object.keys(MODULE_EVENTS) },
  { value: "task_assignee", label: "Current task assignee", actions: ["notify_user", "create_task"], modules: ["task"] },
  { value: "task_creator", label: "Current task creator", actions: ["notify_user", "create_task"], modules: ["task"] },
  { value: "customer_email", label: "Customer email", actions: ["send_email"], modules: ["customer"] },
  { value: "customer_phone", label: "Customer phone", actions: ["send_sms"], modules: ["customer"] },
  { value: "call_agent", label: "Call agent", actions: ["notify_user", "create_task"], modules: ["call"] },
];

// Recipient paths differ from condition fields: status_changed conditions test
// the status delta, but the task event still contains the complete saved row.
export const RECIPIENT_TEMPLATES: Record<string, Record<string, string[]>> = {
  task: Object.fromEntries(MODULE_EVENTS.task.map(event => [event,
    ["newValues.assignedUserId", "newValues.createdByUserId"]])),
  customer: {
    updated: ["newValues.email", "newValues.phone"],
    status_changed: ["newValues.email", "newValues.phone"],
  },
  call: {
    "call.assigned": ["newValues.agentId"],
    "call.answered": ["newValues.agentId"],
    "call.completed": ["newValues.agentId"],
    "call.abandoned": ["newValues.assignedAgentId"],
    "call.timeout": ["newValues.assignedAgentId"],
    "outbound.started": ["newValues.agentId"],
    "outbound.answered": ["newValues.agentId"],
    "outbound.completed": ["newValues.agentId"],
    "outbound.unanswered": ["newValues.agentId"],
  },
};

export const FIELD_OPTIONS: Record<string, { value: string; label: string; type: string; options?: string[] }[]> = {
  communication: [
    { value: "newValues.type", label: "Source", type: "string", options: ["email", "sms", "inbound_call", "outbound_call", "task"] },
    { value: "newValues.customerId", label: "Linked contact ID", type: "string" },
    { value: "newValues.campaignId", label: "Mission ID", type: "string" },
    { value: "newValues.contactType", label: "Linked contact type", type: "string" },
    { value: "newValues.sentiment", label: "Sentiment", type: "string" },
    { value: "newValues.callLogId", label: "Call ID", type: "string" },
    { value: "newValues.recordingId", label: "Recording ID", type: "string" },
  ],
  customer: [
    { value: "newValues.id", label: "Customer ID", type: "string" },
    { value: "newValues.firstName", label: "First name", type: "string" },
    { value: "newValues.lastName", label: "Last name", type: "string" },
    { value: "newValues.email", label: "Email", type: "string" },
    { value: "newValues.phone", label: "Phone", type: "string" },
    { value: "newValues.country", label: "Country", type: "string" },
    { value: "newValues.status", label: "Status", type: "string", options: ["active", "pending", "inactive"] },
    { value: "newValues.clientStatus", label: "Client status", type: "string", options: ["potential", "in_process", "acquired", "terminated"] },
    { value: "newValues.newsletter", label: "Newsletter", type: "boolean" },
    { value: "newValues.useCorrespondenceAddress", label: "Uses correspondence address", type: "boolean" },
    { value: "newValues.assignedUserId", label: "Assigned user", type: "string" },
    { value: "newValues.leadScore", label: "Lead score", type: "number" },
    { value: "newValues.leadScoreUpdatedAt", label: "Lead score updated at", type: "date" },
    { value: "newValues.leadStatus", label: "Lead status", type: "string", options: ["cold", "warm", "hot", "qualified"] },
    { value: "newValues.serviceType", label: "Service type", type: "string", options: ["cord_blood", "cord_tissue", "both"] },
    { value: "newValues.registrationSource", label: "Registration source", type: "string", options: ["web_form", "phone", "email", "in_person", "referral"] },
    { value: "newValues.registrationDate", label: "Registration date", type: "date" },
    { value: "newValues.createdAt", label: "Created at", type: "date" },
  ],
  task: [
    { value: "newValues.id", label: "Task ID", type: "string" },
    { value: "newValues.title", label: "Title", type: "string" },
    { value: "newValues.priority", label: "Priority", type: "enum", options: TASK_PRIORITIES.map(option => option.value) },
    { value: "newValues.status", label: "Status", type: "enum", options: TASK_STATUSES.map(option => option.value) },
    { value: "newValues.assignedUserId", label: "Assignee", type: "string" },
    { value: "newValues.assignedDepartmentId", label: "Assigned department", type: "string" },
    { value: "newValues.taskGroupIds", label: "Assigned task group", type: "list" },
    { value: "newValues.createdByUserId", label: "Creator", type: "string" },
    { value: "newValues.dueDate", label: "Due date", type: "date" },
    { value: "newValues.customerId", label: "Linked customer ID", type: "string" },
    { value: "newValues.relatedEntityType", label: "Related record type", type: "string" },
    { value: "newValues.relatedEntityId", label: "Related record ID", type: "string" },
    { value: "newValues.resolvedByUserId", label: "Resolved by", type: "string" },
    { value: "newValues.resolvedByGroupIds", label: "Resolver task group", type: "list" },
    { value: "newValues.resolvedAt", label: "Resolved at", type: "date" },
    { value: "newValues.boState", label: "Back Office state", type: "string" },
    { value: "newValues.createdAt", label: "Created at", type: "date" },
    { value: "newValues.updatedAt", label: "Updated at", type: "date" },
  ],
  contract: [
    { value: "newValues.status", label: "Status", type: "string" },
    { value: "newValues.contractNumber", label: "Contract number", type: "string" },
    { value: "newValues.customerId", label: "Customer", type: "string" },
  ],
  hospital: [
    { value: "newValues.id", label: "Hospital ID", type: "string" },
    { value: "newValues.name", label: "Name", type: "string" },
    { value: "newValues.isActive", label: "Active", type: "boolean" },
    { value: "newValues.representativeId", label: "Representative", type: "string" },
    { value: "newValues.countryCode", label: "Country", type: "string" },
    { value: "newValues.city", label: "City", type: "string" },
    { value: "newValues.region", label: "Region", type: "string" },
    { value: "newValues.district", label: "District", type: "string" },
    { value: "newValues.autoRecruiting", label: "Auto recruiting", type: "boolean" },
    { value: "newValues.svetZdravia", label: "Svet zdravia", type: "boolean" },
  ],
  clinic: [
    { value: "newValues.id", label: "Clinic ID", type: "string" },
    { value: "newValues.name", label: "Name", type: "string" },
    { value: "newValues.isActive", label: "Active", type: "boolean" },
    { value: "newValues.contractStatus", label: "Contract status", type: "string" },
    { value: "newValues.countryCode", label: "Country", type: "string" },
    { value: "newValues.leadSource", label: "Lead source", type: "string" },
    { value: "newValues.leadSourceDate", label: "Lead source date", type: "date" },
    { value: "newValues.conferenceName", label: "Conference", type: "string" },
    { value: "newValues.conferenceDate", label: "Conference date", type: "date" },
    { value: "newValues.isReferredByDoctor", label: "Referred by doctor", type: "boolean" },
    { value: "newValues.isFromConference", label: "From conference", type: "boolean" },
    { value: "newValues.initialStatus", label: "Initial status", type: "string" },
    { value: "newValues.interestCooperation", label: "Cooperation interest", type: "string" },
    { value: "newValues.interestContract", label: "Contract interest", type: "string" },
    { value: "newValues.hasFlyers", label: "Has flyers", type: "boolean" },
    { value: "newValues.flyersSentDate", label: "Flyers sent date", type: "date" },
  ],
  collaborator: [
    { value: "newValues.id", label: "Collaborator ID", type: "string" },
    { value: "newValues.firstName", label: "First name", type: "string" },
    { value: "newValues.lastName", label: "Last name", type: "string" },
    { value: "newValues.isActive", label: "Active", type: "boolean" },
    { value: "newValues.countryCode", label: "Country", type: "string" },
    { value: "newValues.collaboratorType", label: "Collaborator type", type: "string" },
    { value: "newValues.professionalClassification", label: "Professional classification", type: "string" },
    { value: "newValues.workplaceName", label: "Workplace", type: "string" },
    { value: "newValues.isManager", label: "Manager", type: "boolean" },
    { value: "newValues.clientContact", label: "Client contact", type: "boolean" },
    { value: "newValues.representativeId", label: "Representative", type: "string" },
    { value: "newValues.companyName", label: "Company", type: "string" },
    { value: "newValues.hospitalId", label: "Linked hospital ID", type: "string" },
    { value: "newValues.clinicId", label: "Linked clinic ID", type: "string" },
  ],
  invoice: [
    { value: "newValues.status", label: "Status", type: "string" },
    { value: "newValues.invoiceNumber", label: "Invoice number", type: "string" },
    { value: "newValues.customerId", label: "Customer", type: "string" },
    { value: "newValues.dueDate", label: "Due date", type: "date" },
  ],
  call: [{ value: "newValues.callId", label: "Call ID", type: "string" }],
};

const CALL_EVENT_FIELDS: Record<string, typeof FIELD_OPTIONS.call> = {
  "call.assigned": [
    { value: "newValues.queueId", label: "Queue ID", type: "string" },
    { value: "newValues.campaignId", label: "Mission ID", type: "string" },
    { value: "newValues.agentId", label: "Assigned agent", type: "string" },
    { value: "newValues.waitDuration", label: "Queue wait (seconds)", type: "number" },
  ],
  "call.answered": [
    { value: "newValues.queueId", label: "Queue ID", type: "string" },
    { value: "newValues.campaignId", label: "Mission ID", type: "string" },
    { value: "newValues.agentId", label: "Answering agent", type: "string" },
  ],
  "call.completed": [
    { value: "newValues.queueId", label: "Queue ID", type: "string" },
    { value: "newValues.campaignId", label: "Mission ID", type: "string" },
    { value: "newValues.agentId", label: "Answering agent", type: "string" },
    { value: "newValues.talkDuration", label: "Talk duration (seconds)", type: "number" },
    { value: "newValues.completedAt", label: "Completed at", type: "date" },
  ],
  "call.abandoned": [
    { value: "newValues.queueId", label: "Queue ID", type: "string" },
    { value: "newValues.campaignId", label: "Mission ID", type: "string" },
    { value: "newValues.assignedAgentId", label: "Assigned agent (if any)", type: "string" },
    { value: "newValues.reason", label: "Reason", type: "string" },
  ],
  "call.timeout": [
    { value: "newValues.queueId", label: "Queue ID", type: "string" },
    { value: "newValues.campaignId", label: "Mission ID", type: "string" },
    { value: "newValues.assignedAgentId", label: "Assigned agent (if any)", type: "string" },
  ],
  "outbound.started": [
    { value: "newValues.campaignId", label: "Mission ID", type: "string" },
    { value: "newValues.agentId", label: "Calling agent", type: "string" },
    { value: "newValues.status", label: "Call status", type: "string" },
    { value: "newValues.durationSeconds", label: "Duration (seconds)", type: "number" },
    { value: "newValues.startedAt", label: "Started at", type: "date" },
    { value: "newValues.answeredAt", label: "Answered at", type: "date" },
    { value: "newValues.endedAt", label: "Ended at", type: "date" },
  ],
  "outbound.answered": [
    { value: "newValues.campaignId", label: "Mission ID", type: "string" },
    { value: "newValues.agentId", label: "Calling agent", type: "string" },
    { value: "newValues.status", label: "Call status", type: "string" },
    { value: "newValues.talkDuration", label: "Talk duration (seconds)", type: "number" },
    { value: "newValues.durationSeconds", label: "Duration (seconds)", type: "number" },
    { value: "newValues.startedAt", label: "Started at", type: "date" },
    { value: "newValues.answeredAt", label: "Answered at", type: "date" },
    { value: "newValues.endedAt", label: "Ended at", type: "date" },
  ],
  "outbound.completed": [
    { value: "newValues.campaignId", label: "Mission ID", type: "string" },
    { value: "newValues.agentId", label: "Calling agent", type: "string" },
    { value: "newValues.status", label: "Call status", type: "string" },
    { value: "newValues.talkDuration", label: "Talk duration (seconds)", type: "number" },
    { value: "newValues.durationSeconds", label: "Duration (seconds)", type: "number" },
    { value: "newValues.startedAt", label: "Started at", type: "date" },
    { value: "newValues.answeredAt", label: "Answered at", type: "date" },
    { value: "newValues.endedAt", label: "Ended at", type: "date" },
  ],
  "outbound.unanswered": [
    { value: "newValues.campaignId", label: "Mission ID", type: "string" },
    { value: "newValues.agentId", label: "Calling agent", type: "string" },
    { value: "newValues.status", label: "Call status", type: "string" },
    { value: "newValues.durationSeconds", label: "Duration (seconds)", type: "number" },
    { value: "newValues.startedAt", label: "Started at", type: "date" },
    { value: "newValues.answeredAt", label: "Answered at", type: "date" },
    { value: "newValues.endedAt", label: "Ended at", type: "date" },
  ],
};

export const OPERATORS = [
  { value: "eq", label: "equals", arity: 1 },
  { value: "neq", label: "not equals", arity: 1 },
  { value: "gt", label: ">", arity: 1 },
  { value: "gte", label: ">=", arity: 1 },
  { value: "lt", label: "<", arity: 1 },
  { value: "lte", label: "<=", arity: 1 },
  { value: "in", label: "in (comma list)", arity: 1 },
  { value: "not_in", label: "not in (comma list)", arity: 1 },
  { value: "contains", label: "contains", arity: 1 },
  { value: "not_contains", label: "does not contain tag", arity: 1 },
  { value: "starts_with", label: "starts with", arity: 1 },
  { value: "is_null", label: "is empty", arity: 0 },
  { value: "is_not_null", label: "is set", arity: 0 },
  { value: "changed", label: "changed (any)", arity: 0 },
  { value: "changed_to", label: "changed to", arity: 1 },
  { value: "changed_from", label: "changed from", arity: 1 },
];

export const SCHEDULE_INTERVALS = ["every_5_min", "every_15_min", "every_30_min", "hourly", "every_6_hours", "daily", "weekly"];
export const SCHEDULE_RECORD_MODULES = ["customer", "task", "hospital", "clinic"] as const;
export const SCHEDULE_MAX_MATCHES = 100;
export const SCHEDULE_MAX_SCAN_ROWS = 50_000;

// Only fields backed by current persisted columns and safe to retain in
// workflow snapshots. In particular, schedule snapshots never include contact
// details, names, notes, identity numbers, or full rows.
const SCHEDULE_RECORD_FIELDS: Record<string, string[]> = {
  customer: [
    "newValues.country", "newValues.status", "newValues.clientStatus",
    "newValues.leadScore", "newValues.leadStatus",
    "newValues.registrationSource", "newValues.registrationDate", "newValues.createdAt",
  ],
  task: [
    "newValues.country", "newValues.status", "newValues.priority", "newValues.dueDate",
    "newValues.boState", "newValues.createdAt", "newValues.updatedAt",
  ],
  hospital: [
    "newValues.countryCode", "newValues.isActive", "newValues.region", "newValues.district",
    "newValues.autoRecruiting", "newValues.svetZdravia",
  ],
  clinic: [
    "newValues.countryCode", "newValues.isActive", "newValues.contractStatus",
    "newValues.leadSource", "newValues.leadSourceDate", "newValues.conferenceDate",
    "newValues.isReferredByDoctor", "newValues.isFromConference", "newValues.initialStatus",
    "newValues.interestCooperation", "newValues.interestContract", "newValues.hasFlyers",
    "newValues.flyersSentDate",
  ],
};

export const hasChangeSnapshot = (event: string) =>
  event === "updated" || event === "status_changed" || event === "task.assigned" ||
  event === "contract.completed" || event === "contract.cancelled";

for (const module of ["collection", "campaign", "product"]) {
  FIELD_OPTIONS[module] = [
    { value: "newValues.id", label: "ID", type: "string" },
    ...UPDATE_RECORD_ENTITIES[module].map(field => ({
      value: `newValues.${field.key}`, label: field.key,
      type: field.kind === "reference" ? field.reference === "collection_status" ? "number" : "string"
        : field.kind === "text" ? "string" : field.kind,
      ...(field.options ? { options: field.options } : {}),
    })),
    ...(module === "collection" ? ["customerId", "hospitalId", "clinicId", "collaboratorId", "contractId"].map(key => ({
      value: `newValues.${key}`, label: key, type: "string",
    })) : []),
  ];
}

for (const module of RECORD_TAG_ENTITY_TYPES) {
  FIELD_OPTIONS[module] ||= [];
  FIELD_OPTIONS[module].push(
    { value: "newValues.tags", label: "Record tags", type: "tags" },
    { value: "oldValues.tags", label: "Previous record tags", type: "tags" },
  );
}

export function fieldsForEvent(module: string, event: string) {
  if (event === "schedule.tick")
    return [...(SCHEDULE_RECORD_FIELDS[module] || []).flatMap(value =>
      (FIELD_OPTIONS[module] || []).filter(field => field.value === value)),
      ...(SCHEDULE_RECORD_MODULES.includes(module) ? FIELD_OPTIONS[module].filter(field => field.value === "newValues.tags") : [])];
  if (module === "call") return [...FIELD_OPTIONS.call, ...(CALL_EVENT_FIELDS[event] || [])];
  if (module === "communication") {
    const payloadFields = event === "sentiment.negative"
      ? ["newValues.type", "newValues.sentiment"]
      : ["newValues.type", "newValues.customerId", "newValues.campaignId", "newValues.contactType"];
    return FIELD_OPTIONS.communication.filter(field => payloadFields.includes(field.value));
  }
  const fields = FIELD_OPTIONS[module] || [];
  if (module === "customer" && event === "created") return fields.filter(f =>
    [
      "newValues.id", "newValues.firstName", "newValues.lastName", "newValues.country",
      "newValues.status", "newValues.clientStatus", "newValues.newsletter",
      "newValues.useCorrespondenceAddress", "newValues.assignedUserId", "newValues.leadScore",
      "newValues.leadScoreUpdatedAt", "newValues.leadStatus", "newValues.serviceType",
      "newValues.registrationSource", "newValues.registrationDate", "newValues.createdAt", "newValues.tags",
    ].includes(f.value));
  if (event === "status_changed" && module !== "task") return fields.filter(f => f.value === "newValues.status");
  return fields;
}

/** Multi-country scope takes precedence; legacy-only rows keep single-country behavior. */
export function matchesRuleCountryScope(
  countryCodes: string[] | null | undefined,
  legacyCountryCode: string | null | undefined,
  eventCountryCode: string | null | undefined,
) {
  if (countryCodes != null) return !!eventCountryCode && countryCodes.includes(eventCountryCode);
  if (legacyCountryCode) return legacyCountryCode === eventCountryCode;
  return true;
}

export function operatorsForEvent(event: string, fieldType?: string) {
  if (fieldType === "tags") return OPERATORS.filter(op => ["contains", "not_contains"].includes(op.value));
  return OPERATORS.filter(op =>
    (fieldType !== "list" || ["in", "not_in", "is_null", "is_not_null"].includes(op.value)) &&
    (!op.value.startsWith("changed") || hasChangeSnapshot(event)) &&
    (!["gt", "gte", "lt", "lte"].includes(op.value) || fieldType === "number" || fieldType === "date") &&
    (!["in", "not_in"].includes(op.value) || fieldType !== "boolean") &&
    op.value !== "not_contains" &&
    (!["contains", "starts_with"].includes(op.value) || fieldType === "string"));
}

/** JSONB events serialize dates to ISO strings; Number(isoString) is NaN. */
export function compareOrderedValues(left: unknown, right: unknown, operator: "gt" | "gte" | "lt" | "lte") {
  const numeric = (value: unknown) => {
    if (value == null || value === "") return NaN;
    if (value instanceof Date) return value.getTime();
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value))
      return Date.parse(value);
    return Number(value);
  };
  const a = numeric(left);
  const b = numeric(right);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  switch (operator) {
    case "gt": return a > b;
    case "gte": return a >= b;
    case "lt": return a < b;
    case "lte": return a <= b;
  }
}

/** A calendar-date choice matches both a date column and an ISO timestamp from JSONB. */
export function conditionValuesEqual(left: unknown, right: unknown): boolean {
  if (typeof right === "string" && /^\d{4}-\d{2}-\d{2}$/.test(right) &&
      typeof left === "string" && /^\d{4}-\d{2}-\d{2}T/.test(left)) {
    return left.slice(0, 10) === right;
  }
  return left === right;
}

export type CapabilityIssue = { path: string; message: string };
const record = (v: unknown): v is Record<string, any> => !!v && typeof v === "object" && !Array.isArray(v);
const specified = (v: unknown) =>
  typeof v === "string" ? v.trim().length > 0 : Array.isArray(v) && v.length > 0;
const conditionValueMatchesType = (value: unknown, type: string) => {
  if (type === "boolean") return typeof value === "boolean";
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "date") return typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) && Number.isFinite(Date.parse(value));
  return typeof value === "string";
};

export function validateRuleCapabilities(rule: {
  module: string; trigger: unknown; conditions?: unknown; actions?: unknown;
  countryCode?: string | null; countryCodes?: string[] | null;
}): CapabilityIssue[] {
  const issues: CapabilityIssue[] = [];
  const fail = (path: string, message: string) => issues.push({ path, message });
  const events = MODULE_EVENTS[rule.module];
  if (!events) fail("module", "Module has no verified event source");
  const trigger = rule.trigger;
  let event = "";
  let scheduleMode: "once" | "per_record" | null = null;
  if (!record(trigger)) fail("trigger", "Trigger is required");
  else if (trigger.type === "event") {
    event = trigger.eventType;
    if (trigger.entityType !== rule.module) fail("trigger.entityType", "Entity must match module");
    if (!events?.includes(event)) fail("trigger.eventType", "Event is not emitted by this module");
    if (trigger.assignmentTarget != null &&
      (rule.module !== "task" || event !== "task.assigned" || !isTaskAssignmentTriggerTarget(trigger.assignmentTarget))) {
      fail("trigger.assignmentTarget", "Assignment target must select task groups or users for task.assigned");
    }
  } else if (trigger.type === "schedule") {
    event = "schedule.tick";
    if (!SCHEDULE_INTERVALS.includes(trigger.interval)) fail("trigger.interval", "Unsupported schedule interval");
    scheduleMode = trigger.mode === undefined ? "once" : trigger.mode;
    if (scheduleMode !== "once" && scheduleMode !== "per_record")
      fail("trigger.mode", "Schedule mode must be once or per_record");
    if (scheduleMode === "per_record" && !SCHEDULE_RECORD_MODULES.includes(rule.module as any))
      fail("module", "Module has no verified country-scoped schedule record source");
    if (scheduleMode === "per_record" && rule.conditions == null)
      fail("conditions", "Per-record schedules require at least one condition");
    if (scheduleMode === "once" && rule.conditions != null)
      fail("conditions", "One-shot schedules cannot use record conditions");
  } else fail("trigger.type", "Unsupported trigger type");

  let count = 0;
  const visit = (node: unknown, path: string, depth: number) => {
    if (++count > 50 || depth > 6) { fail(path, "Condition tree too large"); return; }
    if (!record(node)) { fail(path, "Invalid condition"); return; }
    if (Array.isArray(node.all) || Array.isArray(node.any)) {
      const key = Array.isArray(node.all) ? "all" : "any";
      if (!node[key].length) fail(path, "Condition group cannot be empty");
      else node[key].forEach((n: unknown, i: number) => visit(n, `${path}.${key}[${i}]`, depth + 1));
    } else if ("not" in node) visit(node.not, `${path}.not`, depth + 1);
    else {
      const field = fieldsForEvent(rule.module, event).find(f => f.value === node.field);
      if (!field) fail(`${path}.field`, "Field is not available on this event");
      const op = operatorsForEvent(event, field?.type).find(o => o.value === node.op);
      if (!op) fail(`${path}.op`, "Operator is not supported for this field and event");
      if (op?.arity && node.value === undefined) fail(`${path}.value`, "Value is required");
      if (field?.type === "tags" && (typeof node.value !== "string" || !normalizeTagName(node.value) ||
        normalizeTagName(node.value).length > 64 || /[{}\u0000-\u001f\u007f]/u.test(node.value) ||
        isProtectedRecordTag(node.value))) fail(`${path}.value`, "Choose one literal organizational tag");
      const listOperator = ["in", "not_in"].includes(node.op);
      if (listOperator && (!Array.isArray(node.value) || !node.value.length))
        fail(`${path}.value`, "List operator requires a nonempty array");
      if (field && op?.arity && node.value !== undefined) {
        const values = listOperator
          ? Array.isArray(node.value) ? node.value : []
          : [node.value];
        if (values.some((value: unknown) => !conditionValueMatchesType(value, field.type))) {
          fail(`${path}.value`, `Value must match the ${field.type} field type`);
        } else if (field.options && values.some((value: unknown) => !field.options!.includes(value as string))) {
          fail(`${path}.value`, "Value is not one of the supported options for this field");
        }
      }
    }
  };
  if (rule.conditions != null) visit(rule.conditions, "conditions", 0);
  if (scheduleMode === "once") {
    const hasProviderAction = Array.isArray(rule.actions) &&
      rule.actions.some((action: any) => ["send_email", "send_sms"].includes(action?.type));
    if (hasProviderAction) {
      const selectedCountries = rule.countryCodes != null
        ? rule.countryCodes
        : specified(rule.countryCode) ? [rule.countryCode!] : [];
      if (selectedCountries.length !== 1 ||
          !COUNTRIES.some(country => country.code === selectedCountries[0]))
        fail("countryCodes", "One-shot email/SMS schedules require exactly one selected country");
    }
  }
  let staticallyKnownDeliveries = 0;
  if (Array.isArray(rule.actions)) rule.actions.forEach((a, i) => {
    const path = `actions[${i}]`;
    const targets = ACTION_TARGETS[a?.type];
    if (targets === undefined) return fail(`${path}.type`, "Action has no executable handler");
    const updateV2 = a?.type === "update_entity" && a?.config?.updateRecordVersion === 2;
    const tagV2 = ["add_tag", "remove_tag"].includes(a?.type) && a?.config?.recordTagActionVersion === 2;
    const ownerV2 = a?.type === "assign_user" && a?.config?.assignOwnerVersion === 2;
    const targetedV2 = updateV2 || tagV2 || ownerV2;
    if (ownerV2) {
      for (const issue of assignOwnerIssues(a.config, rule.module)) fail(`${path}.config`, issue);
      if (scheduleMode === "per_record" && a.config.target?.mode === "selected")
        fail(`${path}.config.target`, "Per-record schedules cannot repeatedly assign a fixed record");
      if (scheduleMode === "once" && a.config.target?.mode !== "selected")
        fail(`${path}.config.target`, "One-shot schedules require a selected owner target");
    } else if (a?.type === "assign_user" && (a?.config?.assignOwnerVersion != null || a?.config?.target != null))
      fail(`${path}.config`, "Unsupported owner assignment format");
    if (tagV2) {
      for (const issue of tagActionIssues(a.config, rule.module)) fail(`${path}.config`, issue);
      if (scheduleMode === "per_record" && a.config.target?.mode === "selected")
        fail(`${path}.config.target`, "Per-record schedules cannot tag a fixed record repeatedly");
      if (scheduleMode === "once" && a.config.target?.mode !== "selected")
        fail(`${path}.config.target`, "One-shot schedules require a selected tag target");
    } else if (["add_tag", "remove_tag"].includes(a?.type) &&
      (a?.config?.recordTagActionVersion != null || a?.config?.target != null))
      fail(`${path}.config`, "Unsupported tag action format");
    if (updateV2) {
      for (const issue of updateRecordIssues(a.config, rule.module)) fail(`${path}.config`, issue);
      if (scheduleMode === "per_record" && a.config.target?.mode === "selected")
        fail(`${path}.config.target`, "Per-record schedules must not repeatedly update a fixed record");
      if (scheduleMode === "once" && a.config.target?.mode !== "selected")
        fail(`${path}.config.target`, "One-shot schedules require a selected record");
    }
    if (!targetedV2 && targets && !targets.includes(rule.module)) fail(`${path}.type`, "Action cannot target this module by default");
    if (!targetedV2 && targets && event === "schedule.tick" && scheduleMode !== "per_record")
      fail(`${path}.type`, "One-shot schedules have no target entity");
    if (!targetedV2 && targets && a?.config?.entityType && a.config.entityType !== rule.module)
      fail(`${path}.config.entityType`, "Action target must match rule module");
    const config = a?.config;
    if (!record(config)) return fail(`${path}.config`, "Action configuration is required");
    if (scheduleMode === "per_record" && targets && specified(config.entityId) &&
        !["{{entityId}}", "{{event.entityId}}"].includes(String(config.entityId).trim()))
      fail(`${path}.config.entityId`, "Per-record actions must target the matched record");
    if (scheduleMode === "per_record" && ["create_task", "notify_user"].includes(a.type)) {
      if (specified(config.customerId))
        fail(`${path}.config.customerId`, "Scheduled task links are bound to the matched record");
      for (const key of ["entityId", "relatedEntityId"]) {
        if (specified(config[key]) &&
            !["{{entityId}}", "{{event.entityId}}"].includes(String(config[key]).trim()))
          fail(`${path}.config.${key}`, "Scheduled actions must target the matched record");
      }
      if (specified(config.relatedEntityType) && config.relatedEntityType !== rule.module)
        fail(`${path}.config.relatedEntityType`, "Scheduled actions must target the matched record");
    }
    if (scheduleMode === "once") {
      const hasTemplate = (value: unknown): boolean => typeof value === "string"
        ? /\{\{\s*[^{}]+?\s*\}\}/.test(value)
        : Array.isArray(value) ? value.some(hasTemplate)
          : record(value) ? Object.values(value).some(hasTemplate) : false;
      if (hasTemplate(config)) fail(`${path}.config`, "One-shot schedules cannot use record templates");
    }
    const groupTarget = specified(config.taskGroupId) || specified(config.targetRole);
    if (specified(config.taskGroupId) && specified(config.targetRole) && !(a.type === "send_email" && config.emailActionVersion === 2))
      fail(`${path}.config`, "Choose either a task group or a role");
    if (groupTarget && !["create_task", "notify_user", "send_email"].includes(a.type))
      fail(`${path}.config`, "This service does not support a group or role recipient");
    if (a.type === "create_task") {
      if (!specified(config.title)) fail(`${path}.config.title`, "Task title is required");
      const multiple = config.recipients !== undefined;
      if (multiple && !validTaskActionRecipients(config.recipients))
        fail(`${path}.config.recipients`, "Choose between 1 and 100 unique user, group or role recipients");
      if (multiple && [config.assignedUserId, config.assignedDepartmentId, config.assignee_user_id,
          config.assignee_department_id, config.taskGroupId, config.targetRole].some(specified))
        fail(`${path}.config.recipients`, "Multiple recipients cannot be mixed with legacy assignment fields");
      if (!specified(config.assignedUserId) && !specified(config.assignedDepartmentId) &&
          !specified(config.assignee_user_id) && !specified(config.assignee_department_id) && !groupTarget && !multiple)
        fail(`${path}.config.assignedUserId`, "Choose a user, department, task group or role");
      if (groupTarget && [config.assignedUserId, config.assignedDepartmentId, config.assignee_user_id, config.assignee_department_id].some(specified))
        fail(`${path}.config`, "Choose only one task recipient");
      try { taskActionDeadline(config, new Date()); }
      catch (error) { fail(`${path}.config.dueAt`, (error as Error).message); }
      if (specified(config.priority) && !TASK_PRIORITIES.some(priority => priority.value === config.priority))
        fail(`${path}.config.priority`, "Unknown task priority");
      if (config.taskText !== undefined) {
        if (config.templateLanguage !== undefined &&
            !["en", "sk", "cs", "cz", "hu", "ro", "it", "de"].includes(config.templateLanguage))
          fail(`${path}.config.templateLanguage`, "Unsupported Task template language");
        const variables = new Set([
          ...fieldsForEvent(rule.module, event).map(field => field.value),
          ...taskSalutationFields(rule.module, event).map(field => field.value),
          "entityId", "countryCode", "actorUserId", "event.entityId", "event.countryCode", "event.actorUserId",
        ]);
        for (const key of ["title", "description", "taskText"]) {
          if (config[key] != null && typeof config[key] !== "string")
            fail(`${path}.config.${key}`, "Task text fields must be strings");
          if (typeof config[key] !== "string") continue;
          for (const match of config[key].matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) {
            if (!variables.has(match[1])) fail(`${path}.config.${key}`, `Unavailable task variable: ${match[1]}`);
          }
        }
      }
    }
    if (a.type === "notify_user") {
      if (!specified(config.userId) && !specified(config.userIds) && !groupTarget)
        fail(`${path}.config.userId`, "Choose a user, task group or role");
      if (groupTarget && (specified(config.userId) || specified(config.userIds)))
        fail(`${path}.config`, "Choose only one notification recipient");
      if (config.notificationActionVersion === 2) {
        if (typeof config.title !== "string" || !config.title.trim())
          fail(`${path}.config.title`, "Notification title is required");
        if (config.message != null && typeof config.message !== "string")
          fail(`${path}.config.message`, "Notification message must be text");
        if (specified(config.priority) && !["low", "normal", "high", "urgent"].includes(config.priority))
          fail(`${path}.config.priority`, "Unknown notification priority");
        if (config.templateLanguage !== undefined &&
            !["en", "sk", "cs", "cz", "hu", "ro", "it", "de"].includes(config.templateLanguage))
          fail(`${path}.config.templateLanguage`, "Unsupported notification template language");
        const variables = new Set([
          ...fieldsForEvent(rule.module, event).map(field => field.value),
          ...taskSalutationFields(rule.module, event).map(field => field.value),
          "entityId", "countryCode", "actorUserId", "event.entityId", "event.countryCode", "event.actorUserId",
        ]);
        for (const key of ["title", "message"]) {
          if (typeof config[key] !== "string") continue;
          for (const match of config[key].matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g))
            if (!variables.has(match[1].trim())) fail(`${path}.config.${key}`, `Unavailable notification variable: ${match[1]}`);
        }
      }
    }
    if (a.type === "send_email") {
      if (config.emailActionVersion === 2) {
        for (const message of emailActionIssues(config)) fail(`${path}.config`, message);
        const variables = new Set([
          ...fieldsForEvent(rule.module, event).map(field => field.value),
          ...taskSalutationFields(rule.module, event).map(field => field.value),
          "entityId", "countryCode", "actorUserId", "event.entityId", "event.countryCode", "event.actorUserId",
        ]);
        for (const key of ["subject", "body"]) {
          if (typeof config[key] !== "string") continue;
          for (const match of config[key].matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g))
            if (!variables.has(match[1].trim())) fail(`${path}.config.${key}`, `Unavailable email variable: ${match[1]}`);
        }
      } else if (!specified(config.to) && !groupTarget)
        fail(`${path}.config.to`, "Email address, task group or role is required");
      if (config.emailActionVersion !== 2 && groupTarget && specified(config.to))
        fail(`${path}.config`, "Choose either an email address or a group/role");
    }
    if (a.type === "send_sms" && !specified(config.to))
      fail(`${path}.config.to`, "Phone number is required");
    if (a.type === "send_sms" && config.smsActionVersion === 2) {
      try { smsRecipientList(config.to); }
      catch (error) { fail(`${path}.config.to`, (error as Error).message); }
      if (typeof config.text !== "string" || !config.text.trim())
        fail(`${path}.config.text`, "SMS message is required");
      if (specified(config.kind) && !["transactional", "promotional"].includes(config.kind))
        fail(`${path}.config.kind`, "Unknown SMS kind");
      if (specified(config.provider) && !["bulkgate", "smstools", "default"].includes(config.provider))
        fail(`${path}.config.provider`, "Unknown SMS gateway");
      if (config.templateLanguage !== undefined &&
          !["en", "sk", "cs", "cz", "hu", "ro", "it", "de"].includes(config.templateLanguage))
        fail(`${path}.config.templateLanguage`, "Unsupported SMS template language");
      const variables = new Set([
        ...fieldsForEvent(rule.module, event).map(field => field.value),
        ...taskSalutationFields(rule.module, event).map(field => field.value),
        "entityId", "countryCode", "actorUserId", "event.entityId", "event.countryCode", "event.actorUserId",
      ]);
      if (typeof config.text === "string")
        for (const match of config.text.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g))
          if (!variables.has(match[1].trim())) fail(`${path}.config.text`, `Unavailable SMS variable: ${match[1]}`);
    }
    if (scheduleMode && ["send_email", "send_sms"].includes(a.type)) {
      const explicitCount = (value: unknown): number | null => {
        if (typeof value !== "string" && !Array.isArray(value)) return null;
        const values = Array.isArray(value) ? value : [value];
        if (values.some(item => typeof item !== "string" || /\{\{\s*[^{}]+?\s*\}\}/.test(item)))
          return null;
        return values.flatMap(item => String(item).split(/[,;\s]+/).filter(Boolean)).length;
      };
      if (a.type === "send_email" && config.emailActionVersion === 2) {
        const lists = ["to", "cc", "bcc"].map(key => explicitCount(config[key] || ""));
        if (lists.every(count => count != null)) staticallyKnownDeliveries += lists.reduce<number>((sum, count) => sum + (count || 0), 0);
      } else if (a.type === "send_email" && !groupTarget) {
        const toCount = explicitCount(config.to);
        const ccCount = config.cc == null ? 0 : explicitCount(config.cc);
        const bccCount = config.bcc == null ? 0 : explicitCount(config.bcc);
        if (toCount != null && ccCount != null && bccCount != null)
          staticallyKnownDeliveries += toCount * (1 + ccCount + bccCount);
      } else if (a.type === "send_sms") {
        let toCount = explicitCount(config.to);
        if (config.smsActionVersion === 2) {
          try { toCount = smsRecipientList(config.to).length; }
          catch { toCount = null; }
        }
        if (toCount != null) {
          if (config.smsActionVersion !== 2 && toCount !== 1)
            fail(`${path}.config.to`, "Scheduled SMS requires exactly one explicit recipient");
          staticallyKnownDeliveries += toCount;
        }
      }
    }
    if (a.type === "webhook" && !specified(config.url))
      fail(`${path}.config.url`, "Webhook URL is required");
    const templateFields: Record<string, string[]> = {
      create_task: ["assignedUserId", "assignee_user_id"],
      notify_user: ["userId", "userIds"],
      send_email: ["to", "cc", "bcc"],
      send_sms: ["to"],
    };
    const permitted = (RECIPIENT_TEMPLATES[rule.module]?.[event] || []).filter(field =>
      ["create_task", "notify_user"].includes(a.type)
        ? field.endsWith("UserId") || (rule.module === "call" && (field.endsWith(".agentId") || field.endsWith(".assignedAgentId")))
        : a.type === "send_email" ? field.endsWith(".email") : field.endsWith(".phone"));
    for (const key of templateFields[a.type] || []) {
      const entries = Array.isArray(config[key]) ? config[key] : [config[key]];
      for (const value of entries) {
        if (typeof value !== "string") continue;
        for (const match of value.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) {
          if (!permitted.includes(match[1].trim()))
            fail(`${path}.config.${key}`, "Recipient template path is not available for this event");
        }
      }
    }
  });
  if (scheduleMode && staticallyKnownDeliveries > 100)
    fail("actions", "Scheduled external deliveries exceed the 100 delivery safety limit");
  return issues;
}