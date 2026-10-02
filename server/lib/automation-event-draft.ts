import { z } from "zod";
import { FIELD_OPTIONS, MODULE_EVENTS, MODULE_LABELS, fieldsForEvent } from "./automation-capabilities";

// Only source/event pairs emitted by the application are offered. These are
// discovery inputs for read-only drafts, not permission to execute an action.
export const EVENT_DRAFT_SOURCES = Object.entries(MODULE_EVENTS).map(([module, events]) => ({
  module, label: MODULE_LABELS[module], events,
  fields: FIELD_OPTIONS[module].map(field => field.value),
  fieldsByEvent: Object.fromEntries(events.map(event =>
    [event, fieldsForEvent(module, event).map(field => field.value)])),
}));

export const EVENT_DRAFT_COUNTRIES = ["SK", "CZ", "AT", "HU", "RO", "IT", "DE"] as const;
export const EVENT_DRAFT_INTENTS = ["create_task", "notify_user"] as const;

export const eventDraftRequest = z.object({
  module: z.string(),
  eventType: z.string(),
  countryCode: z.string(),
  conditionField: z.string().optional(),
  conditionValue: z.string().trim().max(120).optional(),
  desiredIntent: z.string().optional(),
  instruction: z.string().trim().min(8).max(1000),
}).strict();

export function validateEventDraftInput(value: unknown, user: { role?: string; assignedCountries?: string[] }) {
  const input = eventDraftRequest.parse(value);
  const role = (user.role || "").toLowerCase();
  if (!["manager", "admin", "superadmin", "owner"].includes(role)) throw new Error("Designer role required");
  const source = EVENT_DRAFT_SOURCES.find(s => s.module === input.module);
  if (!source || !(source.events as readonly string[]).includes(input.eventType)) throw new Error("Unsupported source event");
  if (!EVENT_DRAFT_COUNTRIES.includes(input.countryCode as typeof EVENT_DRAFT_COUNTRIES[number])) throw new Error("Unsupported country");
  if (role === "manager" && !user.assignedCountries?.includes(input.countryCode)) {
    throw new Error("Country not assigned to manager");
  }
  if (input.conditionField && !fieldsForEvent(input.module, input.eventType).some(field => field.value === input.conditionField))
    throw new Error("Unsupported condition field");
  if (!!input.conditionField !== !!input.conditionValue) throw new Error("Condition needs both field and value");
  if (input.desiredIntent && !EVENT_DRAFT_INTENTS.includes(input.desiredIntent as typeof EVENT_DRAFT_INTENTS[number])) throw new Error("Unsupported intent");
  return input;
}

const eventDraftOutput = z.object({
  proposals: z.array(z.object({
    evidence: z.string().trim().min(1).max(240),
    intent: z.enum(EVENT_DRAFT_INTENTS),
    condition: z.string().min(1).max(600),
    explanation: z.string().min(1).max(800),
    draftText: z.string().max(2000).optional(),
    missingInformation: z.array(z.string().min(1).max(200)).max(6),
  }).strict()).max(10),
  questions: z.array(z.string().min(1).max(300)).max(8),
}).strict();

export function validateEventDraftOutput(value: unknown, input: ReturnType<typeof validateEventDraftInput>) {
  const draft = eventDraftOutput.parse(value);
  for (const proposal of draft.proposals) {
    if (!input.instruction.toLocaleLowerCase().includes(proposal.evidence.toLocaleLowerCase())) {
      throw new Error("Draft evidence not present in manager instruction");
    }
    if (input.desiredIntent && proposal.intent !== input.desiredIntent) {
      throw new Error("Draft chose a different intent");
    }
  }
  return {
    scope: {
      module: input.module, entityType: input.module, eventType: input.eventType,
      countryCode: input.countryCode, conditionField: input.conditionField || null,
      conditionValue: input.conditionValue || null,
    },
    proposals: draft.proposals.map(p => ({ ...p, support: "not_integrated" as const })),
    questions: draft.questions,
  };
}