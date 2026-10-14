import { activityTemplateLabel, ACTIVITY_TEMPLATE_LANGUAGES, type ActivityTemplateLanguage } from "@shared/automation-activity-template-copy";
const labelKeys: Record<string, string> = {
  id: "id", entityId: "id", title: "subject", subject: "subject", taskTitle: "subject",
  actorUserId: "from", senderName: "from", senderEmail: "from", callerNumber: "from",
  recipientName: "to", recipientEmail: "to", assignedUserId: "to", assignedDepartmentId: "to", taskGroupIds: "to",
  occurredAt: "time", eventType: "event", receivedAt: "received", createdAt: "created", updatedAt: "updated",
  dueDate: "due", status: "status", priority: "priority", sentiment: "sentiment", tone: "tone", summary: "summary",
  campaignId: "mission", customerId: "to", contractNumber: "subject", invoiceNumber: "subject",
  playbackUrl: "playback", detailUrl: "detail",
};
export function templateFieldLabel(key: string, locale: string, variables: { value: string; label: string }[]) {
  const available = variables.find(item => item.value.replace(/[{}]/g, "").trim() === key);
  if (available) return available.label;
  const leaf = key.split(".").at(-1)!;
  const label = labelKeys[leaf];
  const language = ACTIVITY_TEMPLATE_LANGUAGES.includes(locale as ActivityTemplateLanguage) ? locale as ActivityTemplateLanguage : "en";
  return label ? activityTemplateLabel(language, label) : `{{${key}}}`;
}
