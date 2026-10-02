export type AutomationTriggerPreset = {
  id: "newEmail" | "newSms" | "newCustomer" | "statusChange" | "negativeSentiment" | "taskOverdue" | "taskAssigned";
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
  { id: "taskOverdue", module: "task", eventType: "task.overdue", availableIn: ["task"] },
  { id: "taskAssigned", module: "task", eventType: "task.assigned", availableIn: ["task"] },
];