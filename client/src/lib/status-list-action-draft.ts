import type { CampaignStatusListAutomation } from "@shared/schema";
import { statusListNativeActionTypes } from "@shared/status-list-service-config";

export type SavedStatusListAction = Partial<CampaignStatusListAutomation> & {
  serviceActionConfig?: Record<string, any> | null;
  serviceActionOwnerId?: string | null;
};
export type ActionConditionMode = "always" | "country" | "answer" | "compound" | "field_changed_to" | "stored";
export type ActionRule = { field: string; op: string; value: string };
export const statusListServiceActions = ["assign_task", "send_email_group", "notify_email", "send_sms", "send_contact_email", "set_contact_status", "set_callback", "notify_role", "sys_webhook"] as const;
export type StatusListActionDraft = {
  actionType: string; targetRole: string; taskGroupId: string; taskDescription: string;
  taskDeadlineOffset: string; taskPriority: string; assignNotify: boolean; assignNotifyChannels: string[];
  emailTemplateId: string; emailRecipients: string; smsTemplateId: string; smsProvider: string;
  dispositionId: string; callbackOffsetDays: string; callbackTime: string; callbackBusinessDaysOnly: boolean; callbackExistingPolicy: string; notifyAgentPulse: boolean; webhookTarget: string;
  conditionMode: ActionConditionMode; conditionCountry: string; conditionAnswer: string;
  conditionLogic: string; conditionRules: ActionRule[]; fieldChangedKey: string; fieldChangedValue: string;
  serviceActionConfig: Record<string, any> | null; serviceActionExplicit: boolean;
};
export const nativeServiceActionTypes: Record<string, string> = statusListNativeActionTypes;
const isNativeType = (type: string) => type in nativeServiceActionTypes;
export const nativeConfigFromLegacy = (action?: SavedStatusListAction) => {
  if (!action) return {};
  const type = action.actionType;
  if (type === "assign_task") return {
    title: action.taskDescription || "", description: "", taskText: action.taskDescription || "",
    taskGroupId: action.taskGroupId || undefined,
    targetRole: action.targetRole || undefined,
    priority: action.taskPriority || "medium",
    dueInHours: action.taskDeadlineOffset ? Number.parseInt(action.taskDeadlineOffset.replace(/[^\d]/g, ""), 10) || undefined : undefined,
  };
  if (["send_email_group", "notify_email", "send_contact_email"].includes(type || "")) return {
    emailActionVersion: 2,
    to: type === "send_contact_email" ? "{{contact.email}}" : (action.emailRecipients || []).join(", "),
    ...(action.targetRole?.startsWith("role:") ? { toTargets: [{ kind: "role", id: action.targetRole.slice(5) }] } : {}),
  };
  if (type === "send_sms") return {
    smsActionVersion: 2,
    to: [], text: action.taskDescription || "",
    provider: action.smsProvider === "default" ? undefined : action.smsProvider,
  };
  if (type === "notify_role") return {
    notificationActionVersion: 2,
    ...(action.targetRole ? { targetRole: action.targetRole } : {}),
    title: action.taskDescription || "", message: action.taskDescription || "",
  };
  return {};
};
export const emptyNativeActionConfig = (actionType: string): Record<string, any> => {
  const action = nativeServiceActionTypes[actionType];
  if (action === "create_task") return {};
  if (action === "notify_user") return { notificationActionVersion: 2, title: "", message: "", priority: "normal" };
  if (action === "send_email") return { emailActionVersion: 2, senderMode: "personal" };
  if (action === "send_sms") return {};
  return {};
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
    callbackExistingPolicy: action?.callbackExistingPolicy ?? "replace",
    webhookTarget: action?.webhookTarget || "", conditionMode: mode, conditionCountry: action?.conditionField === "country" ? action.conditionValue || "SK" : "SK",
    conditionAnswer: action?.conditionField === "answer" ? action.conditionValue || "" : "", conditionLogic: typeof parsed?.logic === "string" ? parsed.logic : "AND",
    conditionRules: mode === "compound" ? parsed.rules.map((rule: ActionRule) => ({ ...rule })) : [],
    fieldChangedKey: mode === "field_changed_to" ? parsed.field || "" : "contact.status_code",
    fieldChangedValue: mode === "field_changed_to" ? parsed.value || "" : "",
    serviceActionConfig: action?.serviceActionConfig && typeof action.serviceActionConfig === "object"
      ? { ...action.serviceActionConfig }
      : isNativeType(action?.actionType || "") ? nativeConfigFromLegacy(action)
        : !action && isNativeType(initialActionType) ? emptyNativeActionConfig(initialActionType) : null,
    serviceActionExplicit: Boolean(action?.serviceActionConfig) || !action,
  };
}

const writable = ["sortOrder", "actionType", "targetRole", "emailTemplateId", "emailRecipients", "smsTemplateId", "smsProvider",
  "callbackOffsetDays", "callbackTime", "callbackBusinessDaysOnly", "callbackExistingPolicy", "notifyAgentPulse", "taskDescription", "taskDeadlineOffset", "taskPriority",
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
  if (isNativeType(draft.actionType) && (!original || draft.serviceActionExplicit || original.serviceActionConfig != null)) {
    payload.serviceActionConfig = draft.serviceActionConfig || {};
  } else if (original?.serviceActionConfig != null && draft.actionType !== original.actionType) {
    payload.serviceActionConfig = null;
  } else if (original && "serviceActionConfig" in original) {
    payload.serviceActionConfig = original.serviceActionConfig;
  }
  const put = (field: keyof StatusListActionDraft, value: unknown = draft[field]) => {
    if (!original || draft.actionType !== original.actionType || JSON.stringify(draft[field]) !== JSON.stringify(base[field])) payload[field] = value;
  };
  const text = (field: keyof StatusListActionDraft) => put(field, (draft[field] as string) || null);
  const nativeConfigActive = isNativeType(draft.actionType) &&
    (!original || draft.serviceActionExplicit || original.serviceActionConfig != null);
  if (!nativeConfigActive && ["assign_task", "send_email_group", "notify_role"].includes(draft.actionType)) text("targetRole");
  if (!nativeConfigActive && draft.actionType === "assign_task") {
    for (const key of ["taskGroupId", "taskDescription", "taskDeadlineOffset"] as const) text(key);
    put("taskPriority"); put("assignNotify"); put("assignNotifyChannels", draft.assignNotify ? draft.assignNotifyChannels : []);
  }
  if (!nativeConfigActive && ["send_email_group", "notify_email"].includes(draft.actionType)) {
    text("emailTemplateId"); put("emailRecipients", draft.emailRecipients.split(/[\n,;]+/).map(value => value.trim()).filter(Boolean));
  }
  if (!nativeConfigActive && draft.actionType === "send_contact_email") text("emailTemplateId");
  if (!nativeConfigActive && draft.actionType === "send_sms") {
    text("smsTemplateId"); text("taskDescription");
    put("smsProvider", campaignProvider || draft.smsProvider === "default" ? null : draft.smsProvider);
  }
  if (draft.actionType === "sys_webhook") text("webhookTarget");
  if (draft.actionType === "set_contact_status") text("dispositionId");
  if (draft.actionType === "set_callback" || (draft.actionType === "set_contact_status" && callbackDisposition)) {
    put("callbackOffsetDays", Number(draft.callbackOffsetDays));
    put("callbackBusinessDaysOnly");
    put("callbackExistingPolicy");
    put("callbackTime");
    if (draft.actionType === "set_contact_status") put("notifyAgentPulse");
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
  const nativeActive = isNativeType(draft.actionType) && draft.serviceActionExplicit;
  if (!nativeActive && ["assign_task", "send_email_group", "notify_role"].includes(draft.actionType) && !draft.targetRole && !(draft.actionType === "assign_task" && draft.taskGroupId)) return "target";
  if (draft.actionType === "set_contact_status" && !draft.dispositionId) return "status";
  if ((draft.actionType === "set_callback" || (draft.actionType === "set_contact_status" && callbackDisposition))
    && (!draft.callbackOffsetDays.trim() || !Number.isSafeInteger(Number(draft.callbackOffsetDays)) || Number(draft.callbackOffsetDays) < 0
      || !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.callbackTime)
      || !["replace", "keep_existing"].includes(draft.callbackExistingPolicy))) return "callback";
  const recipients = draft.emailRecipients.split(/[\n,;]+/).map(value => value.trim()).filter(Boolean);
  if (!nativeActive && ["send_email_group", "notify_email"].includes(draft.actionType) && recipients.some(value => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) return "email";
  if (!nativeActive && draft.actionType === "notify_email" && !recipients.length) return "email";
  if (!nativeActive && draft.actionType === "send_contact_email" && !draft.emailTemplateId) return "template";
  if (!nativeActive && draft.actionType === "send_sms" && !draft.taskDescription.trim() && !draft.smsTemplateId) return "sms";
  if (draft.actionType === "sys_webhook") {
    try { if (!["https:", "http:"].includes(new URL(draft.webhookTarget).protocol)) return "webhook"; } catch { return "webhook"; }
  }
  if (draft.conditionMode === "compound" && (!draft.conditionRules.length || !["AND", "OR"].includes(draft.conditionLogic)
    || draft.conditionRules.some(rule => !rule.field || !rule.op || !rule.value.trim()))) return "condition";
  if (draft.conditionMode === "field_changed_to" && (!draft.fieldChangedKey || !draft.fieldChangedValue.trim())) return "condition";
  if (draft.conditionMode === "answer" && !draft.conditionAnswer.trim()) return "condition";
  return null;
}
