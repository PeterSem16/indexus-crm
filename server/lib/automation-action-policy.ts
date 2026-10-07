import { z } from "zod";
import { validTaskActionRecipients } from "@shared/automation-task-action";

export type AutomationActionRisk = "internal" | "state_change" | "external_message" | "external_system";

const nonempty = z.string().trim().min(1);
const createTaskDraft = z.object({
  title: nonempty,
  description: z.string().optional(),
  taskText: z.string().optional(),
  templateId: nonempty.optional(),
  recipients: z.array(z.object({
    kind: z.enum(["user", "group", "role"]),
    id: nonempty.max(200),
  }).strict()).refine(validTaskActionRecipients, "Choose unique task recipients").optional(),
  assignedUserId: nonempty.optional(),
  assignedDepartmentId: nonempty.optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  dueInHours: z.number().finite().min(0).max(24 * 3650).optional(),
  dueAt: z.string().datetime({ offset: true }).optional(),
  checklist: z.array(z.union([
    nonempty,
    z.object({ label: nonempty, required: z.boolean().optional() }).strict(),
  ])).optional(),
}).strict().refine(
  (config) => Boolean(config.assignedUserId || config.assignedDepartmentId || config.recipients?.length),
  "A task needs an assigned user or department",
).refine(
  config => !(config.recipients && (config.assignedUserId || config.assignedDepartmentId)),
  "Multiple recipients cannot be mixed with legacy assignment fields",
).refine(
  config => !(config.dueAt && config.dueInHours !== undefined),
  "Choose a relative or fixed task deadline",
);

const notifyUserDraft = z.object({
  userId: nonempty.optional(),
  userIds: z.array(nonempty).min(1).optional(),
  title: nonempty,
  message: z.string().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  entityType: nonempty.optional(),
  entityId: nonempty.optional(),
}).strict().refine(
  (config) => Boolean(config.userId || config.userIds?.length),
  "A notification needs a recipient",
);

/**
 * This policy mirrors the executable handlers. Only the two internal actions
 * have a strict AI-draft schema so far; other actions remain manual-only.
 * In particular, "supported by the engine" does not mean "safe for AI".
 */
export const AUTOMATION_ACTION_POLICY = {
  create_task: { risk: "internal", aiDraftEligible: true, draftSchema: createTaskDraft },
  notify_user: { risk: "internal", aiDraftEligible: true, draftSchema: notifyUserDraft },
  send_email: { risk: "external_message", aiDraftEligible: false },
  send_sms: { risk: "external_message", aiDraftEligible: false },
  webhook: { risk: "external_system", aiDraftEligible: false },
  update_entity: { risk: "state_change", aiDraftEligible: false },
  assign_user: { risk: "state_change", aiDraftEligible: false },
  add_tag: { risk: "state_change", aiDraftEligible: false },
  remove_tag: { risk: "state_change", aiDraftEligible: false },
} as const;

export type ActionValidationIssue = { path: string; message: string };

export function validateAutomationActions(
  actions: unknown,
  mode: "manual" | "ai_draft",
): ActionValidationIssue[] {
  if (!Array.isArray(actions) || actions.length === 0 || actions.length > 20) {
    return [{ path: "actions", message: "Provide between 1 and 20 actions" }];
  }
  const issues: ActionValidationIssue[] = [];
  for (const [index, action] of actions.entries()) {
    const path = `actions[${index}]`;
    if (!action || typeof action !== "object" || Array.isArray(action)) {
      issues.push({ path, message: "Action must be an object" });
      continue;
    }
    const { type, config } = action as Record<string, unknown>;
    if (typeof type !== "string" || !(type in AUTOMATION_ACTION_POLICY)) {
      issues.push({ path: `${path}.type`, message: "Unsupported action type" });
      continue;
    }
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      issues.push({ path: `${path}.config`, message: "Action config must be an object" });
      continue;
    }
    if (mode === "ai_draft") {
      const policy = AUTOMATION_ACTION_POLICY[type as keyof typeof AUTOMATION_ACTION_POLICY];
      if (!policy.aiDraftEligible) {
        issues.push({ path: `${path}.type`, message: "Action is not allowed in AI drafts" });
        continue;
      }
      const parsed = policy.draftSchema.safeParse(config);
      if (!parsed.success) {
        for (const error of parsed.error.issues) {
          issues.push({ path: `${path}.config${error.path.length ? `.${error.path.join(".")}` : ""}`, message: error.message });
        }
      }
      for (const key of Object.keys(action)) {
        if (key !== "type" && key !== "config") {
          issues.push({ path: `${path}.${key}`, message: "Unsupported action field" });
        }
      }
    }
  }
  return issues;
}