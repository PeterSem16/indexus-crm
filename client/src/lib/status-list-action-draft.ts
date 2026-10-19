import type { CampaignStatusListAutomation } from "@shared/schema";

export type SavedStatusListAction = Partial<CampaignStatusListAutomation>;
export type ActionConditionMode = "always" | "country" | "answer" | "compound" | "field_changed_to" | "stored";
export type ActionRule = { field: string; op: string; value: string };
export const statusListServiceActions = ["assign_task", "send_email_group", "notify_email", "send_sms", "send_contact_email", "set_contact_status", "set_callback", "notify_role", "sys_webhook"] as const;
export type StatusListActionDraft = {
  actionType: string; targetRole: string; taskGroupId: string; taskDescription: string;
  taskDeadlineOffset: string; taskPriority: string; assignNotify: boolean; assignNotifyChannels: string[];
  emailTemplateId: string; emailRecipients: string; smsTemplateId: string; smsProvider: string;
  dispositionId: string; callbackOffsetDays: string; callbackTime: string; callbackBusinessDaysOnly: boolean; notifyAgentPulse: boolean; webhookTarget: string;
  conditionMode: ActionConditionMode; conditionCountry: string; conditionAnswer: string;
  conditionLogic: string; conditionRules: ActionRule[]; fieldChangedKey: string; fieldChangedValue: string;
};

const jsonCondition = (action?: SavedStatusListAction) => {
  try {
    const parsed = action?.conditionJson ? JSON.parse(action.conditionJson) : null;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
};
export function statusListActionDraft(action?: SavedStatusListAction, initialActionType = "assign_task"): StatusListActionDraft {
  const parsed = jsonCondition(action);
  const mode: ActionConditionMode = action?.conditionJson
    ? parsed?.__type === "field_changed_to" && typeof parsed.field === "string" && typeof parsed.value === "string" && (!parsed.op || parsed.op === "eq") ? "field_changed_to"
      : parsed && ["AND", "OR"].includes(parsed.logic) && Array.isArray(parsed.rules)
        && parsed.rules.every((rule: any) => rule && typeof rule.field === "string" && typeof rule.op === "string" && typeof rule.value === "string") ? "compound" : "stored"
    : !action?.conditionField ? "always" : action.conditionField === "country" && (!action.conditionOperator || action.conditionOperator === "eq") ? "country"
      : action.conditionField === "answer" && (!action.conditionOperator || action.conditionOperator === "eq") ? "answer" : "stored";
  return {
    actionType: action?.actionType || initialActionType, targetRole: action ? action.targetRole || "" : "role:back_office",
    taskGroupId: action?.taskGroupId || "", taskDescription: action?.taskDescription || "",
    taskDeadlineOffset: action ? action.taskDeadlineOffset || "" : "+24h", taskPriority: action?.taskPriority || "medium",
    assignNotify: action?.assignNotify ?? false, assignNotifyChannels: [...(action?.assignNotifyChannels || [])],
    emailTemplateId: action?.emailTemplateId || "", emailRecipients: (action?.emailRecipients || []).join("\n"),
    smsTemplateId: action?.smsTemplateId || "", smsProvider: action?.smsProvider || "default",
    dispositionId: action?.dispositionId || "", callbackOffsetDays: String(action?.callbackOffsetDays ?? 1),
    callbackTime: action?.callbackTime || "09:00", callbackBusinessDaysOnly: action?.callbackBusinessDaysOnly ?? true, notifyAgentPulse: action?.notifyAgentPulse ?? false,
    webhookTarget: action?.webhookTarget || "", conditionMode: mode, conditionCountry: action?.conditionField === "country" ? action.conditionValue || "SK" : "SK",
    conditionAnswer: action?.conditionField === "answer" ? action.conditionValue || "" : "", conditionLogic: typeof parsed?.logic === "string" ? parsed.logic : "AND",
    conditionRules: mode === "compound" ? parsed.rules.map((rule: ActionRule) => ({ ...rule })) : [],
    fieldChangedKey: mode === "field_changed_to" ? parsed.field || "" : "contact.status_code",
    fieldChangedValue: mode === "field_changed_to" ? parsed.value || "" : "",
  };
}

const writable = ["sortOrder", "actionType", "targetRole", "emailTemplateId", "emailRecipients", "smsTemplateId", "smsProvider",
  "callbackOffsetDays", "callbackTime", "callbackBusinessDaysOnly", "notifyAgentPulse", "taskDescription", "taskDeadlineOffset", "taskPriority",
  "conditionField", "conditionOperator", "conditionValue", "conditionJson", "dispositionId", "webhookTarget", "taskGroupId",
  "assignNotify", "assignNotifyChannels"] as const;
const conditionKeys = ["conditionMode", "conditionCountry", "conditionAnswer", "conditionLogic", "conditionRules", "fieldChangedKey", "fieldChangedValue"] as const;
export const statusListActionDirty = (draft: StatusListActionDraft, original?: SavedStatusListAction, initialActionType?: string) =>
  JSON.stringify(draft) !== JSON.stringify(statusListActionDraft(original, initialActionType));
export const statusListConditionDirty = (draft: StatusListActionDraft, original?: SavedStatusListAction) => {
  const base = statusListActionDraft(original);
  return conditionKeys.some(key => JSON.stringify(draft[key]) !== JSON.stringify(base[key]));
};

/** Explicit writable fields only. Insert-schema defaults require keeping the
 * original recipient/notification arrays even when editing unrelated fields.
 * Preserve condition bytes and dormant action fields until explicitly edited.
 */
export function statusListActionPayload(draft: StatusListActionDraft, original?: SavedStatusListAction, campaignProvider: string | null = null, callbackDisposition = false) {
  const payload: Record<string, unknown> = {};
  for (const key of writable) if (original && key in original) payload[key] = original[key];
  const base = statusListActionDraft(original);
  payload.actionType = draft.actionType;
  const put = (field: keyof StatusListActionDraft, value: unknown = draft[field]) => {
    if (!original || draft.actionType !== original.actionType || JSON.stringify(draft[field]) !== JSON.stringify(base[field])) payload[field] = value;
  };
  const text = (field: keyof StatusListActionDraft) => put(field, (draft[field] as string) || null);
  if (["assign_task", "send_email_group", "notify_role"].includes(draft.actionType)) text("targetRole");
  if (draft.actionType === "assign_task") {
    for (const key of ["taskGroupId", "taskDescription", "taskDeadlineOffset"] as const) text(key);
    put("taskPriority"); put("assignNotify"); put("assignNotifyChannels", draft.assignNotify ? draft.assignNotifyChannels : []);
  }
  if (["send_email_group", "notify_email"].includes(draft.actionType)) {
    text("emailTemplateId"); put("emailRecipients", draft.emailRecipients.split(/[\n,;]+/).map(value => value.trim()).filter(Boolean));
  }
  if (draft.actionType === "send_contact_email") text("emailTemplateId");
  if (draft.actionType === "send_sms") {
    text("smsTemplateId"); text("taskDescription");
    put("smsProvider", campaignProvider || draft.smsProvider === "default" ? null : draft.smsProvider);
  }
  if (draft.actionType === "sys_webhook") text("webhookTarget");
  if (draft.actionType === "set_contact_status") text("dispositionId");
  if (draft.actionType === "set_callback" || (draft.actionType === "set_contact_status" && callbackDisposition)) {
    put("callbackOffsetDays", Number(draft.callbackOffsetDays));
    put("callbackBusinessDaysOnly");
    if (draft.actionType === "set_contact_status") { put("callbackTime"); put("notifyAgentPulse"); }
    if (draft.actionType === "set_contact_status" && original?.dispositionId !== draft.dispositionId) {
      payload.callbackOffsetDays = Number(draft.callbackOffsetDays); payload.callbackTime = draft.callbackTime; payload.notifyAgentPulse = draft.notifyAgentPulse;
    }
  }
  if (!original || statusListConditionDirty(draft, original)) {
    if (draft.conditionMode !== "stored") {
      payload.conditionField = null; payload.conditionOperator = null; payload.conditionValue = null; payload.conditionJson = null;
    }
    if (draft.conditionMode === "country" || draft.conditionMode === "answer") {
      payload.conditionField = draft.conditionMode; payload.conditionOperator = "eq";
      payload.conditionValue = draft.conditionMode === "country" ? draft.conditionCountry : draft.conditionAnswer;
    }
    if (draft.conditionMode === "compound" || draft.conditionMode === "field_changed_to") {
      const prior = jsonCondition(original);
      payload.conditionJson = JSON.stringify(draft.conditionMode === "compound"
        ? { ...(original && statusListActionDraft(original).conditionMode === "compound" ? prior : {}), logic: draft.conditionLogic, rules: draft.conditionRules }
        : { ...(original && statusListActionDraft(original).conditionMode === "field_changed_to" ? prior : {}), __type: "field_changed_to", field: draft.fieldChangedKey, op: "eq", value: draft.fieldChangedValue });
    }
  }
  return payload;
}

export function statusListActionError(draft: StatusListActionDraft, callbackDisposition = false): "target" | "status" | "callback" | "email" | "template" | "sms" | "webhook" | "condition" | null {
  if (["assign_task", "send_email_group", "notify_role"].includes(draft.actionType) && !draft.targetRole && !(draft.actionType === "assign_task" && draft.taskGroupId)) return "target";
  if (draft.actionType === "set_contact_status" && !draft.dispositionId) return "status";
  if ((draft.actionType === "set_callback" || (draft.actionType === "set_contact_status" && callbackDisposition))
    && (!draft.callbackOffsetDays.trim() || !Number.isSafeInteger(Number(draft.callbackOffsetDays)) || Number(draft.callbackOffsetDays) < 0
      || (draft.actionType === "set_contact_status" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.callbackTime)))) return "callback";
  const recipients = draft.emailRecipients.split(/[\n,;]+/).map(value => value.trim()).filter(Boolean);
  if (["send_email_group", "notify_email"].includes(draft.actionType) && recipients.some(value => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) return "email";
  if (draft.actionType === "notify_email" && !recipients.length) return "email";
  if (draft.actionType === "send_contact_email" && !draft.emailTemplateId) return "template";
  if (draft.actionType === "send_sms" && !draft.taskDescription.trim() && !draft.smsTemplateId) return "sms";
  if (draft.actionType === "sys_webhook") {
    try { if (!["https:", "http:"].includes(new URL(draft.webhookTarget).protocol)) return "webhook"; } catch { return "webhook"; }
  }
  if (draft.conditionMode === "compound" && (!draft.conditionRules.length || !["AND", "OR"].includes(draft.conditionLogic)
    || draft.conditionRules.some(rule => !rule.field || !rule.op || !rule.value.trim()))) return "condition";
  if (draft.conditionMode === "field_changed_to" && (!draft.fieldChangedKey || !draft.fieldChangedValue.trim())) return "condition";
  if (draft.conditionMode === "answer" && !draft.conditionAnswer.trim()) return "condition";
  return null;
}
