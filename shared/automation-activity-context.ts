/** Template-only allowlist. Empty optional values are prose, never authorization targets. */
export const ACTIVITY_TEMPLATE_FIELDS = [
  "id", "title", "actorUserId", "assignedUserId", "assignedDepartmentId", "taskGroupIds",
  "createdAt", "updatedAt", "dueDate", "status", "priority", "eventType", "occurredAt",
  "campaignId", "customerId", "value", "metricType", "contractNumber", "invoiceNumber",
] .map(key => ({ value: `activity.${key}`, label: key, type: "string" }));

export function activityTemplateContext(ctx: any) {
  const data = ctx.newValues || {};
  const event = ctx.event || {};
  const safe = (value: unknown): string | number | string[] =>
    value instanceof Date ? value.toISOString() : typeof value === "string" || typeof value === "number" ? value
      : Array.isArray(value) && value.every(item => typeof item === "string") ? value : "";
  return { ...ctx, activity: Object.fromEntries(ACTIVITY_TEMPLATE_FIELDS.map(({ value }) => {
    const key = value.slice("activity.".length);
    const valueForKey = key === "id" ? ctx.entityId || event.entityId
      : key === "title" ? data.title || data.name || [data.firstName, data.lastName].filter(Boolean).join(" ") || data.contractNumber || data.invoiceNumber
      : key === "actorUserId" ? ctx.actorUserId || event.actorUserId || data.createdByUserId
      : key === "eventType" ? event.eventType : key === "occurredAt" ? event.createdAt
      : data[key];
    return [key, safe(valueForKey)];
  })) };
}
