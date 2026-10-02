import type { Express, RequestHandler } from "express";
import type { Task } from "@shared/schema";
import type { TaskAccessUser } from "./task-contract";
import {
  assertTaskReassignmentActive,
  parseTaskReassignmentTarget,
  taskReassignmentGroupId,
  TaskReassignmentError,
  type TaskReassignmentResult,
  type TaskReassignmentTarget,
  type buildTaskReassignmentTargets,
} from "./task-reassignment";
import { TaskAssignmentAccessError } from "./task-assignment-access";

type Dependencies = {
  getTask: (id: string) => Promise<Task | undefined>;
  canAccessTask: (user: TaskAccessUser, task: Task) => Promise<boolean>;
  getTargets: (task: Task, user: TaskAccessUser) => Promise<ReturnType<typeof buildTaskReassignmentTargets>>;
  reassign: (id: string, target: TaskReassignmentTarget, user: TaskAccessUser, expectedUpdatedAt: Date) => Promise<TaskReassignmentResult | undefined>;
  log: (result: TaskReassignmentResult, target: TaskReassignmentTarget, userId: string, ip?: string) => Promise<void>;
  emitUserAssignment: (result: TaskReassignmentResult, userId: string) => Promise<unknown>;
  notifyGroup: (result: TaskReassignmentResult) => Promise<void>;
};

export function registerTaskReassignmentRoutes(app: Express, requireAuth: RequestHandler, dependencies: Dependencies): void {
  const handleError = (res: any, error: unknown) => {
    if (error instanceof TaskAssignmentAccessError) {
      return res.status(403).json({ error: error.message, code: error.code });
    }
    if (error instanceof TaskReassignmentError) {
      return res.status(error.status).json({ error: error.message, code: error.code });
    }
    console.error("Task reassignment failed:", error);
    return res.status(500).json({ error: "Failed to reassign task" });
  };
  app.get("/api/tasks/:id/reassign-targets", requireAuth, async (req, res) => {
    try {
      const user = req.session.user!;
      const task = await dependencies.getTask(req.params.id);
      if (!task || !await dependencies.canAccessTask(user, task)) return res.status(404).json({ error: "Task not found" });
      return res.json(await dependencies.getTargets(task, user));
    } catch (error) { return handleError(res, error); }
  });
  app.post("/api/tasks/:id/reassign", requireAuth, async (req, res) => {
    try {
      const target = parseTaskReassignmentTarget(req.body);
      const user = req.session.user!;
      const oldTask = await dependencies.getTask(req.params.id);
      if (!oldTask || !await dependencies.canAccessTask(user, oldTask)) return res.status(404).json({ error: "Task not found" });
      assertTaskReassignmentActive(oldTask);
      const result = await dependencies.reassign(oldTask.id, target, user, oldTask.updatedAt);
      if (!result) return res.status(404).json({ error: "Task not found" });
      if (result.changed) {
        await dependencies.log(result, target, user.id, req.ip);
        if (result.oldTask.assignedUserId !== result.task.assignedUserId) {
          try { await dependencies.emitUserAssignment(result, user.id); }
          catch (error) { console.error("[EventBus] task reassignment emit error:", error); }
        }
        if (result.group && taskReassignmentGroupId(result.oldTask) !== result.group.id) {
          try { await dependencies.notifyGroup(result); }
          catch (error) { console.error("[Tasks] group reassignment notification error:", error); }
        }
      }
      return res.json(result.task);
    } catch (error) { return handleError(res, error); }
  });
}