export type ConditionChoiceSource = { kind: "record"; entityTypes: string[] } |
  { kind: "values"; entityType: string; key: string } | { kind: "collection_status" } | { kind: "queue" };
const records = ["customer", "clinic", "hospital", "collaborator", "task", "invoice", "contract", "collection", "campaign", "product"];
const users = ["assignedUserId", "createdByUserId", "resolvedByUserId", "agentId", "assignedAgentId",
  "representativeId", "responsiblePersonId", "senderUserId", "recipientUserId", "ownerUserId", "initiatorUserId", "agentUserId"];
/** Known references and saved classifications; never convert source content into a dropdown. */
export function conditionChoiceSource(module: string, field: string): ConditionChoiceSource | null {
  const key = field.split(".").pop() || field;
  if (key === "queueId") return { kind: "queue" };
  if (users.includes(key)) return { kind: "record", entityTypes: ["user"] };
  if (key === "assignedDepartmentId") return { kind: "record", entityTypes: ["department"] };
  if (key === "id" && records.includes(module)) return { kind: "record", entityTypes: [module] };
  if (module === "communication" && ["entityId", "customerId"].includes(key))
    return { kind: "record", entityTypes: ["customer", "clinic", "hospital", "collaborator"] };
  if (["relatedEntityId"].includes(key)) return { kind: "record", entityTypes: records };
  const reference = records.find(type => key === `${type}Id`);
  if (reference) return { kind: "record", entityTypes: [reference] };
  if (module === "collection" && key === "statusId") return { kind: "collection_status" };
  if (records.includes(module) && ["status", "contractStatus", "leadSource", "initialStatus", "interestCooperation",
    "interestContract", "collaboratorType", "professionalClassification", "workplaceName", "companyName",
    "conferenceName", "city", "region", "district", "serviceType", "registrationSource", "leadStatus", "clientStatus"].includes(key))
    return { kind: "values", entityType: module, key };
  return null;
}
export const COMMUNICATION_CHOICE_VALUES: Record<string, string[]> = {
  countryCode: ["SK", "CZ", "HU", "RO", "IT", "DE", "US"],
  entityType: ["customer", "clinic", "hospital", "collaborator", "task"],
  contactType: ["customer", "clinic", "hospital", "collaborator"],
  relatedEntityType: records,
  sentiment: ["positive", "neutral", "negative", "angry"],
  taskStatus: ["pending", "in_progress", "completed", "cancelled"],
  taskPriority: ["low", "medium", "high", "urgent"],
  boState: ["received", "in_progress", "waiting_agent", "done"],
  endedBy: ["customer", "user"],
  commentKind: ["comment", "question", "answer", "state_change"],
  transcriptionLanguage: ["en", "sk", "cs", "hu", "ro", "it", "de"],
  provider: ["smstools", "bulkgate"],
  status: ["pending", "sent", "delivered", "failed", "received", "calling", "ringing", "answered", "completed", "missed", "busy", "no_answer", "cancelled", "in_progress"],
};
