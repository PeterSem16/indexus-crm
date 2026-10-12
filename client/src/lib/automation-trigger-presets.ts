export type AutomationTriggerPreset = {
  id: "newEmail" | "newSms" | "newCustomer" | "statusChange" | "negativeSentiment" | "contentAnalysis" | "attachmentAnalysis" | "metricMonitor" | "taskOverdue" | "taskAssigned";
  module: string;
  eventType: string;
  availableIn: string[];
};

export const AUTOMATION_TRIGGER_PRESETS: AutomationTriggerPreset[] = [
  { id: "newEmail", module: "communication", eventType: "email.received", availableIn: ["communication"] },
  { id: "newSms", module: "communication", eventType: "sms.received", availableIn: ["communication"] },
  { id: "newCustomer", module: "customer", eventType: "created", availableIn: ["customer"] },
  { id: "statusChange", module: "customer", eventType: "status_changed", availableIn: ["customer"] },
  { id: "negativeSentiment", module: "communication", eventType: "sentiment.negative", availableIn: ["communication"] },
  { id: "contentAnalysis", module: "communication", eventType: "communication.received", availableIn: ["communication"] },
  { id: "attachmentAnalysis", module: "communication", eventType: "communication.received", availableIn: ["communication"] },
  { id: "metricMonitor", module: "metric", eventType: "metric.threshold", availableIn: ["metric"] },
  { id: "taskOverdue", module: "task", eventType: "task.overdue", availableIn: ["task"] },
  { id: "taskAssigned", module: "task", eventType: "task.assigned", availableIn: ["task"] },
];