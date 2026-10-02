import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { tasks, workflowEvents } from "@shared/schema";
import { db } from "../db";
import { emitEventOnceForIdentity } from "./event-bus";
import { taskTextContentIdentity } from "./task-text-identity";

const taskId = `task-sentiment-test-${randomUUID()}`;
const staleTaskId = `task-sentiment-stale-${randomUUID()}`;
const deletedTaskId = `task-sentiment-deleted-${randomUUID()}`;
const eventIdentity = (textIdentity: string) => ({
  source: "task-analysis" as const,
  module: "communication",
  entityType: "communication",
  entityId: taskId,
  eventType: "sentiment.negative",
  newValues: { type: "task", sentiment: "negative", textIdentity },
});
const emit = (textIdentity: string) => emitEventOnceForIdentity(
  eventIdentity(textIdentity),
  "textIdentity",
  textIdentity,
  `task-sentiment:${taskId}:${textIdentity}`,
);

try {
  const sameTextResults = await Promise.all([emit("hash-a"), emit("hash-a")]);
  assert.equal(sameTextResults.filter(Boolean).length, 1, "concurrent duplicate text identities emit once");

  const changedTextEvent = await emit("hash-b");
  assert.ok(changedTextEvent, "a new text identity emits a new event");
  assert.equal(await emit("hash-b"), null, "repeating the new identity does not duplicate it");

  const rows = await db.select({ identity: workflowEvents.newValues })
    .from(workflowEvents)
    .where(and(
      eq(workflowEvents.source, "task-analysis"),
      eq(workflowEvents.entityId, taskId),
      eq(workflowEvents.eventType, "sentiment.negative"),
    ));
  assert.deepEqual(rows.map((row) => (row.identity as any)?.textIdentity).sort(), ["hash-a", "hash-b"]);

  await db.insert(tasks).values({
    id: staleTaskId,
    title: "Original customer complaint",
    description: "Please follow up",
    assignedUserId: "sentiment-test-user",
    createdByUserId: "sentiment-test-user",
  });
  const staleIdentity = taskTextContentIdentity("Original customer complaint", "Please follow up");
  await db.update(tasks).set({ title: "Updated task text" }).where(eq(tasks.id, staleTaskId));
  const staleResult = await emitEventOnceForIdentity({
    ...eventIdentity(staleIdentity),
    entityId: staleTaskId,
  }, "textIdentity", staleIdentity, `task-sentiment:${staleTaskId}:${staleIdentity}`, {
    taskId: staleTaskId,
    textIdentity: staleIdentity,
  });
  assert.equal(staleResult, null, "changed task text prevents stale analysis from emitting");

  await db.insert(tasks).values({
    id: deletedTaskId,
    title: "Customer complaint",
    description: "Please follow up",
    assignedUserId: "sentiment-test-user",
    createdByUserId: "sentiment-test-user",
  });
  const deletedIdentity = taskTextContentIdentity("Customer complaint", "Please follow up");
  await db.delete(tasks).where(eq(tasks.id, deletedTaskId));
  const deletedResult = await emitEventOnceForIdentity({
    ...eventIdentity(deletedIdentity),
    entityId: deletedTaskId,
  }, "textIdentity", deletedIdentity, `task-sentiment:${deletedTaskId}:${deletedIdentity}`, {
    taskId: deletedTaskId,
    textIdentity: deletedIdentity,
  });
  assert.equal(deletedResult, null, "deleted task prevents stale analysis from emitting");
  console.log("task sentiment event identity tests passed");
} finally {
  await db.delete(workflowEvents).where(and(
    eq(workflowEvents.source, "task-analysis"),
    eq(workflowEvents.entityId, taskId),
  ));
  await db.delete(tasks).where(eq(tasks.id, staleTaskId));
  await db.delete(tasks).where(eq(tasks.id, deletedTaskId));
}