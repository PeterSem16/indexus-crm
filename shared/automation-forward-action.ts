import { emailAddressList } from "./automation-email-action";
export type ForwardConfig = {
  forwardActionVersion: 1;
  destination: "email" | "user" | "back_office";
  mode: "whole" | "attachments";
  selection: "invoice" | "all";
  to?: string;
  userId?: string;
  taskGroupId?: string;
  title?: string;
  matchSender?: boolean;
};
export function forwardActionIssues(value: any): string[] {
  const issues: string[] = [];
  if (!value || value.forwardActionVersion !== 1) return ["Unsupported forwarding configuration"];
  if (!["email", "user", "back_office"].includes(value.destination)) issues.push("Choose a forwarding destination");
  if (!["whole", "attachments"].includes(value.mode)) issues.push("Choose whole message or attachments");
  if (!["invoice", "all"].includes(value.selection)) issues.push("Choose an attachment selection");
  if (value.destination === "email") {
    try {
      const addresses = emailAddressList(value.to);
      if (!addresses.length || addresses.length > 25) issues.push("Choose between one and 25 explicit email recipients");
    } catch { issues.push("Forwarding requires valid explicit email addresses"); }
    if (value.userId || value.taskGroupId) issues.push("Email forwarding cannot contain internal recipients");
  } else if (value.destination === "user") {
    if (typeof value.userId !== "string" || !value.userId.trim() || /[{}\r\n]/.test(value.userId))
      issues.push("Choose a user");
    if (value.to || value.taskGroupId) issues.push("User forwarding cannot contain another destination");
  } else if (value.destination === "back_office") {
    if (typeof value.taskGroupId !== "string" || !value.taskGroupId.trim() || /[{}\r\n]/.test(value.taskGroupId))
      issues.push("Choose a Back Office group");
    if (value.to || value.userId) issues.push("Back Office forwarding cannot contain another destination");
  }
  if (value.matchSender !== undefined && typeof value.matchSender !== "boolean") issues.push("Sender matching must be a boolean");
  if (value.destination === "email" && value.matchSender === true) issues.push("Sender matching requires an internal task");
  const allowed = new Set(["forwardActionVersion", "destination", "mode", "selection", "to", "userId", "taskGroupId", "title", "matchSender"]);
  if (Object.keys(value).some(key => !allowed.has(key))) issues.push("Unsupported forwarding field");
  return issues;
}
