import type { AutomationCondition } from "./sentiment-source-conditions";

export type NotificationAutomationSource = {
  name: string; description?: string | null; triggerType: string; triggerConditions?: unknown;
  countryCodes?: string[] | null; targetType?: string; targetUserIds?: string[] | null;
  targetRoles?: string[] | null; notificationTitle?: string; notificationMessage?: string | null;
  priority?: string;
};
export type NotificationAutomationAction = "notify_user" | "send_email" | "send_sms";

/** Creates a paused, independent draft. Never updates or disables the original rule. */
export function notificationAutomationDraft(source: NotificationAutomationSource, actionType: NotificationAutomationAction) {
  let snapshot = source.triggerConditions;
  if (typeof snapshot === "string") {
    try { snapshot = snapshot.trim() ? JSON.parse(snapshot) : null; }
    catch { throw new Error("unsupported_legacy_conditions"); }
  }
  const keys = new Set(["countryCode", "provider", "sentiment", "alertLevel", "hasAngryTone",
    "hasRudeExpressions", "wantsToCancel", "wantsConsent", "doesNotAcceptContract"]);
  if (snapshot != null && (typeof snapshot !== "object" || Array.isArray(snapshot))) {
    throw new Error("unsupported_legacy_conditions");
  }
  const entries = Object.entries(snapshot || {});
  if (entries.some(([key, value]) => !keys.has(key) ||
      !(Array.isArray(value) ? value.length && value.every(v => ["string", "boolean"].includes(typeof v))
        : ["string", "boolean"].includes(typeof value)))) throw new Error("unsupported_legacy_conditions");
  const analysis = entries.some(([key]) => !["countryCode", "provider"].includes(key));
  const module = ["new_customer", "status_change"].includes(source.triggerType) ? "customer" : "communication";
  const eventType = source.triggerType === "sentiment_negative" ? "sentiment.negative"
    : source.triggerType === "new_sms" ? analysis ? "communication.analyzed" : "sms.received"
    : source.triggerType === "new_email" ? analysis ? "communication.analyzed" : "email.received"
    : source.triggerType === "new_customer" ? "created" : source.triggerType === "status_change" ? "status_changed" : null;
  if (!eventType || (module === "customer" && entries.length)) throw new Error("unsupported_legacy_conditions");
  const leaves: AutomationCondition[] = entries.map(([key, value]) => ({
    field: key === "countryCode" ? key : `newValues.${key}`,
    op: Array.isArray(value) ? "in" : "eq", value,
  }));
  if (module === "communication") {
    leaves.unshift({ field: "newValues.type", op: "in",
      value: source.triggerType === "new_sms" ? ["sms"] : source.triggerType === "new_email" ? ["email"] : ["email", "sms"] });
  }
  const title = source.notificationTitle || source.name;
  const message = source.notificationMessage || "";
  const config: Record<string, unknown> = actionType === "notify_user"
    ? { notificationActionVersion: 2, title, message, priority: source.priority || "normal" }
    : actionType === "send_email" ? { emailActionVersion: 2, senderMode: "personal", subject: title, body: message }
    : { smsActionVersion: 2, text: message };
  const recipients = source.targetType === "role" ? Array.from(new Set(source.targetRoles || [])).map(targetRole => ({ targetRole }))
    : ["specific_users", "assignee"].includes(source.targetType || "")
      ? Array.from(new Set(source.targetUserIds || [])).map(userId => ({ userId })) : [];
  return {
    name: source.name, description: source.description || "", module, enabled: false,
    countryCodes: source.countryCodes?.length ? [...source.countryCodes] : null,
    trigger: { type: "event" as const, eventType, entityType: module },
    conditions: leaves.length === 1 ? leaves[0] : leaves.length ? { all: leaves } : null,
    actions: actionType === "notify_user" && recipients.length
      ? recipients.map(recipient => ({ type: actionType, config: { ...config, ...recipient } }))
      : [{ type: actionType, config }],
  };
}
