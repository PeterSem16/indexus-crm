import type { Express, RequestHandler } from "express";
import {
  generateTaskResolutionDraft,
  supportedTaskResolutionDraftLanguage,
  type TaskResolutionDraftInput,
  type TaskResolutionDraftResult,
} from "./task-resolution-draft";
import { assertPulseTaskChecklistComplete, PulseChecklistCompletionError } from "./task-completion";

type DraftTask = {
  id: string;
  title: string;
  country?: string | null;
  description?: string | null;
  status: string;
  relatedEntityType?: string | null;
  tags?: string[] | null;
};
type DraftChecklistItem = TaskResolutionDraftInput["completedItems"][number];

export type TaskResolutionDraftRouteDependencies = {
  getTask: (id: string) => Promise<DraftTask | null | undefined>;
  canAccessTask: (user: any, taskId: string) => Promise<boolean>;
  getChecklist: (taskId: string) => Promise<DraftChecklistItem[]>;
  generate?: (input: TaskResolutionDraftInput) => Promise<TaskResolutionDraftResult>;
};

/** A private preview only: this endpoint never changes the task or resolution. */
export function registerTaskResolutionDraftRoute(
  app: Express,
  requireAuth: RequestHandler,
  dependencies: TaskResolutionDraftRouteDependencies,
): void {
  const inFlight = new Set<string>();
  app.post("/api/tasks/:id/resolution-draft", requireAuth, async (req, res) => {
    let requestKey: string | undefined;
    try {
      const user = (req as any).session.user;
      const task = await dependencies.getTask(req.params.id);
      if (!task) return res.status(404).json({ error: "Task not found" });
      if (!await dependencies.canAccessTask(user, task.id)) {
        return res.status(403).json({ error: "Not authorized" });
      }
      if (!["pending", "in_progress"].includes(task.status)) {
        return res.status(409).json({ status: "failed", errorCode: "task_inactive" });
      }
      const body = req.body ?? {};
      if (typeof body !== "object" || Array.isArray(body) ||
        Object.keys(body).some(key => key !== "locale") ||
        (body.locale !== undefined && (typeof body.locale !== "string" ||
          body.locale.length > 20 || !supportedTaskResolutionDraftLanguage(body.locale)))) {
        return res.status(400).json({ status: "failed", errorCode: "invalid_draft_request" });
      }
      const items = await dependencies.getChecklist(task.id);
      assertPulseTaskChecklistComplete(task, items);
      const key = `${user.id}:${task.id}`;
      if (inFlight.has(key)) {
        return res.status(409).json({ status: "failed", errorCode: "draft_in_progress" });
      }
      if (inFlight.size >= 200) {
        return res.status(429).json({ status: "failed", errorCode: "draft_busy" });
      }
      requestKey = key;
      inFlight.add(key);
      const result = await (dependencies.generate ?? generateTaskResolutionDraft)({
        title: task.title,
        country: task.country ?? null,
        request: task.description ?? null,
        completedItems: items.filter(item => !!item.doneAt),
        readyForClosure: items.length > 0 && items.every(item => !!item.doneAt),
        userLocale: body.locale ?? null,
      });
      return res.json(result);
    } catch (error) {
      if (error instanceof PulseChecklistCompletionError) {
        return res.status(409).json({
          status: "failed",
          errorCode: error.code,
          remainingCount: error.remainingCount,
        });
      }
      return res.status(500).json({ status: "failed", errorCode: "internal_error" });
    } finally {
      if (requestKey) inFlight.delete(requestKey);
    }
  });
}