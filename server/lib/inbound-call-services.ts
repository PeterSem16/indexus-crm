/**
 * Ready-to-configure inbound services. These use existing executable actions,
 * not a parallel rule engine. Every draft starts disabled and contains no PII.
 * An unassigned missed call needs an explicitly chosen department.
 */
export const INBOUND_CALL_SERVICES = [
  {
    id: "assigned_notice",
    eventType: "call.assigned",
    actionType: "notify_user",
    config: { userId: "{{newValues.agentId}}", title: "Inbound call assigned", message: "A call was assigned to you." },
    conditions: null,
  },
  {
    id: "missed_agent_notice",
    eventType: "call.abandoned",
    actionType: "notify_user",
    config: { userId: "{{newValues.assignedAgentId}}", title: "Missed inbound call", message: "Review the missed call in your queue." },
    conditions: { field: "newValues.assignedAgentId", op: "is_not_null" },
  },
  {
    id: "missed_group_task",
    eventType: "call.timeout",
    actionType: "create_task",
    config: { assignedDepartmentId: "", title: "Review missed inbound call", priority: "high" },
    conditions: { field: "newValues.campaignId", op: "is_not_null" },
  },
  {
    id: "completed_review_task",
    eventType: "call.completed",
    actionType: "create_task",
    config: { assignedUserId: "{{newValues.agentId}}", title: "Review completed inbound call", priority: "medium" },
    conditions: { field: "newValues.agentId", op: "is_not_null" },
  },
  {
    id: "long_wait_notice",
    eventType: "call.assigned",
    actionType: "notify_user",
    config: { userId: "{{newValues.agentId}}", title: "Long inbound wait", message: "This caller has been waiting in the queue." },
    conditions: { field: "newValues.waitDuration", op: "gte", value: 120 },
  },
] as const;