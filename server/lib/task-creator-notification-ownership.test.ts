import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db, pool } from "../db";
import { storage } from "../storage";
import {
  notifications,
  tasks,
  users,
  workflowActionLog,
  workflowEvents,
  workflowRules,
  workflowRuns,
} from "@shared/schema";
import { MANUAL_PULSE_TASK_TAG } from "@shared/task-provenance";
import {
  buildPulseCompletionNotification,
  shouldNotifyTaskCreator,
  withUnmanagedTaskCreatorNoticeCondition,
} from "./task-contract";
import { processEvent } from "./automation-engine";
import { taskCompletionEventValues } from "./event-bus";

const suffix = randomUUID();
const prefix = `task-notice-ownership-${suffix}`;
const creatorUserId = randomUUID();
const resolverUserId = randomUUID();
const ruleId = randomUUID();
const taskIds = Array.from({ length: 4 }, () => randomUUID());
const eventIds = Array.from({ length: 4 }, () => randomUUID());

async function run() {
  if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT) {
    throw new Error("Task notice ownership fixtures must not run in production");
  }
  try {
    const passwordHash = randomUUID();
    await db.insert(users).values([
      {
        id: creatorUserId,
        username: `${prefix}-creator`,
        email: `${prefix}-creator@example.invalid`,
        fullName: "Task notice fixture creator",
        passwordHash,
        assignedCountries: ["SK"],
        isActive: true,
      },
      {
        id: resolverUserId,
        username: `${prefix}-resolver`,
        email: `${prefix}-resolver@example.invalid`,
        fullName: "Task notice fixture resolver",
        passwordHash,
        assignedCountries: ["SK"],
        isActive: true,
      },
    ]);
    await db.insert(workflowRules).values({
      id: ruleId,
      name: `${prefix}-seeded-system-rule`,
      module: "task",
      enabled: true,
      isSystem: true,
      trigger: { type: "event", entityType: "task", eventType: "task.completed" },
      conditions: withUnmanagedTaskCreatorNoticeCondition({
        field: "newValues.status",
        op: "eq",
        value: "completed",
      }) as any,
      actions: [{
        type: "notify_user",
        config: {
          userId: "{{newValues.createdByUserId}}",
          title: "Task completed: {{newValues.title}}",
          message: "Your task was completed.",
          type: "task_completed",
          entityType: "task",
          entityId: "{{newValues.id}}",
          priority: "normal",
        },
      }],
    });

    const scenarios = [
      { index: 0, label: "manual-opt-in", tags: [MANUAL_PULSE_TASK_TAG], notifyAgent: undefined, expectedNotices: 1 },
      { index: 1, label: "manual-opt-out", tags: [MANUAL_PULSE_TASK_TAG], notifyAgent: false, expectedNotices: 0 },
      { index: 2, label: "legacy-default-off", tags: ["group_id:legacy"], notifyAgent: undefined, expectedNotices: 0 },
      { index: 3, label: "legacy-explicit-opt-in", tags: ["group_id:legacy"], notifyAgent: true, expectedNotices: 1 },
    ] as const;

    for (const scenario of scenarios) {
      const taskId = taskIds[scenario.index];
      await db.insert(tasks).values({
        id: taskId,
        title: `${prefix}-${scenario.label}`,
        status: "pending",
        priority: "medium",
        assignedUserId: resolverUserId,
        createdByUserId: creatorUserId,
        relatedEntityType: "clinic",
        relatedEntityId: `${prefix}-clinic`,
        country: "SK",
        tags: [...scenario.tags],
      });
      const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
      if (!task) throw new Error(`${scenario.label} fixture task was not persisted`);
      const notifyCreator = shouldNotifyTaskCreator(task, true, scenario.notifyAgent);
      const result = await storage.updateTaskWithActor(
        taskId,
        { status: "completed", resolution: `${scenario.label} resolution` },
        resolverUserId,
        notifyCreator
          ? async completedTask => buildPulseCompletionNotification(completedTask)
          : undefined,
      );
      if (!result?.completedNow) throw new Error(`${scenario.label} should complete exactly once`);

      const eventValues = taskCompletionEventValues(result.task, { creatorNotificationHandled: true });
      assert.equal(eventValues.creatorNotificationHandled, true);
      assert.equal(eventValues.pulseOrigin, false,
        "manual provenance and legacy clinic linkage stay separate from Status List source classification");
      await db.insert(workflowEvents).values({
        id: eventIds[scenario.index],
        source: "storage",
        module: "task",
        entityType: "task",
        entityId: taskId,
        eventType: "task.completed",
        actorUserId: resolverUserId,
        countryCode: "SK",
        newValues: eventValues,
      });
      const [rule] = await db.select().from(workflowRules).where(eq(workflowRules.id, ruleId)).limit(1);
      const [event] = await db.select().from(workflowEvents).where(eq(workflowEvents.id, eventIds[scenario.index])).limit(1);
      if (!rule || !event) throw new Error(`${scenario.label} automation fixture rows were not persisted`);
      await processEvent(event.id);
      const [execution] = await db.select({ status: workflowRuns.status, skippedReason: workflowRuns.skippedReason })
        .from(workflowRuns).where(and(
          eq(workflowRuns.ruleId, ruleId),
          eq(workflowRuns.eventId, eventIds[scenario.index]),
        )).limit(1);
      assert.equal(execution?.status, "skipped");
      assert.equal(execution?.skippedReason, "condition_false",
        "the enabled seeded creator-notify rule must skip only because the route marked notice ownership handled");

      const persisted = await db.select({ id: notifications.id, userId: notifications.userId })
        .from(notifications).where(eq(notifications.entityId, taskId));
      assert.equal(persisted.length, scenario.expectedNotices, `${scenario.label} persisted notification count`);
      if (scenario.expectedNotices) {
        assert.equal(persisted[0]?.userId, creatorUserId,
          `${scenario.label} derives the notice recipient from the persisted creator`);
      }
    }
  } finally {
    const runs = await db.select({ id: workflowRuns.id }).from(workflowRuns).where(eq(workflowRuns.ruleId, ruleId));
    if (runs.length) {
      await db.delete(workflowActionLog).where(inArray(workflowActionLog.runId, runs.map(run => run.id)));
    }
    await db.delete(workflowRuns).where(eq(workflowRuns.ruleId, ruleId));
    await db.delete(notifications).where(inArray(notifications.entityId, taskIds));
    await db.delete(workflowEvents).where(inArray(workflowEvents.id, eventIds));
    await db.delete(workflowRules).where(eq(workflowRules.id, ruleId));
    await db.delete(tasks).where(inArray(tasks.id, taskIds));
    await db.delete(users).where(inArray(users.id, [creatorUserId, resolverUserId]));
    await pool.end();
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});