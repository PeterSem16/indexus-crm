/**
 * Ready-to-configure outbound call services. Drafts use the shared automation
 * engine's existing handlers and deliberately contain no caller/contact PII.
 */
export const OUTBOUND_CALL_SERVICES = [
  {
    id: "started_notice",
    eventType: "outbound.started",
    actionType: "notify_user",
    config: { userId: "{{newValues.agentId}}", title: "Outbound call started", message: "Your outbound call has started." },
    conditions: { field: "newValues.agentId", op: "is_not_null" },
    enabled: false,
  },
  {
    id: "unanswered_agent_notice",
    eventType: "outbound.unanswered",
    actionType: "notify_user",
    config: { userId: "{{newValues.agentId}}", title: "Outbound call unanswered", message: "Follow up on your unanswered outbound call." },
    conditions: { field: "newValues.agentId", op: "is_not_null" },
    enabled: false,
  },
  {
    id: "completed_review_task",
    eventType: "outbound.completed",
    actionType: "create_task",
    config: { assignedUserId: "{{newValues.agentId}}", title: "Review completed outbound call", priority: "medium" },
    conditions: { field: "newValues.agentId", op: "is_not_null" },
    enabled: false,
  },
  {
    id: "unanswered_followup_task",
    eventType: "outbound.unanswered",
    actionType: "create_task",
    config: { assignedUserId: "{{newValues.agentId}}", title: "Follow up on unanswered outbound call", priority: "high" },
    conditions: { field: "newValues.agentId", op: "is_not_null" },
    enabled: false,
  },
] as const;