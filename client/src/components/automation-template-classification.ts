import { templateVisualTone } from "@shared/automation-template-visual";

type Template = { id: string; name: string };
export type AutomationTemplateSource = "calls" | "tasks" | "email" | "messages" | "records" | "notifications" | "analysis" | "other";
export type AutomationTemplateMeaning = "sentiment" | "tone" | "success" | "urgency" | "deadlines";
const normalize = (value: string) => value.toLowerCase().replace(/[_-]+/g, " ");
export function sourceForModule(module?: string): AutomationTemplateSource | null {
  if (!module) return null;
  if (/^(call|calls|phone|voice|inbound|outbound)$/.test(module)) return "calls";
  if (/^(task|tasks)$/.test(module)) return "tasks";
  if (/^(communication|analysis)$/.test(module)) return "analysis";
  if (/^(email|emails)$/.test(module)) return "email";
  if (/^(sms|chat|message|messages)$/.test(module)) return "messages";
  if (/^(customer|clinic|hospital|contract|invoice|campaign|collection|product|metric|collaborator)s?$/.test(module)) return "records";
  if (/^notifications?$/.test(module)) return "notifications";
  return "other";
}
export function classifySource(template: Template): AutomationTemplateSource {
  const id = template.id.toLowerCase();
  const parts = id.split("-");
  if (id.startsWith("indexus-activity-")) {
    if (parts[3] === "analysis")
      return ["inbound", "outbound", "voice"].includes(parts[4]) ? "calls" : sourceForModule(parts[4]) || "analysis";
    return sourceForModule(parts[3]) || "other";
  }
  // Legacy IDs encode delivery first, NOT their trigger source.
  if (id.includes("-analysis-")) return "analysis";
  if (id.includes("-call-")) return "calls";
  if (/-event-|new-task|action-needed|completed|deadline|overdue|assigned/.test(id)) return "tasks";
  if (/data-change|information/.test(id)) return "records";
  if (/^indexus-task-template-/.test(id)) return "other"; // Generic follow-up instructions work for every entity.
  return "other";
}
export function classifyMeanings(template: Template): AutomationTemplateMeaning[] {
  const identity = normalize(`${template.id} ${template.name}`);
  const meanings: AutomationTemplateMeaning[] = [];
  const tone = /\btone\b/.test(identity) || /\banalysis\b.*\burgent\b/.test(identity);
  if (tone) meanings.push("tone");
  else if (/\bsentiment\b|\bpositive\b|\bnegative\b/.test(identity)) meanings.push("sentiment");
  if (/\b(?:success|successful|completed|complete|answered|won|delivered|resolved)\b/.test(identity)) meanings.push("success");
  if (/urgent|urgency|critical|escalat|priority|overdue/.test(identity) && !tone) meanings.push("urgency");
  if (templateVisualTone(template.id) === "deadline" || /deadline|due date|overdue|expires|expiry/.test(identity)) meanings.push("deadlines");
  return [...new Set(meanings)];
}
