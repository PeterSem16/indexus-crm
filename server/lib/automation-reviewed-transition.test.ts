import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import { eq, inArray } from "drizzle-orm";
import { db, pool } from "../db";
import { users, notificationRules, workflowRules } from "../../shared/schema";
import { registerReviewedTransitionRoutes, isUnreviewedReplacement } from "./automation-reviewed-transition";

const userId = randomUUID();
const sources: string[] = [];
const drafts: string[] = [];
const app = express();
app.use(express.json());
app.use((req, _res, next) => { (req as any).session = { user: { id: userId, role: "admin" } }; next(); });
registerReviewedTransitionRoutes(app, (_req, _res, next) => next());
const server = app.listen(0, "127.0.0.1");
await new Promise<void>(resolve => server.on("listening", resolve));
const address = server.address() as { port: number };
async function post(path: string) {
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  return { status: response.status, body: await response.json() };
}
async function source(name: string) {
  const [row] = await db.insert(notificationRules).values({
    name, triggerType: "new_email", triggerConditions: { provider: "bulkgate" },
    targetType: "specific_users", targetUserIds: [userId], notificationTitle: "Test only",
    countryCodes: ["SK"], isActive: false, createdBy: userId,
  }).returning();
  sources.push(row.id);
  return row;
}
try {
  await db.insert(users).values({ id: userId, username: `service-test-${userId}`,
    email: `${userId}@service-test.invalid`, passwordHash: randomUUID(),
    fullName: "Service test fixture", role: "admin", assignedCountries: ["SK"], isActive: true });
  const original = await source("Reviewed transition fixture");
  const replacement = await post(`/api/automation/legacy/notification/${original.id}/draft`);
  assert.equal(replacement.status, 200, JSON.stringify(replacement.body));
  drafts.push(replacement.body.id);
  assert.equal(replacement.body.enabled, false);
  assert.equal(await isUnreviewedReplacement(replacement.body.id), true);
  const [unchanged] = await db.select().from(notificationRules).where(eq(notificationRules.id, original.id));
  assert.equal(unchanged.isActive, original.isActive);
  assert.deepEqual(unchanged.triggerConditions, original.triggerConditions);
  const again = await post(`/api/automation/legacy/notification/${original.id}/draft`);
  assert.equal(again.body.id, replacement.body.id, "repeated conversion must return the same pending replacement");
  const simultaneous = await Promise.all([
    post(`/api/automation/rules/${replacement.body.id}/activate-reviewed`),
    post(`/api/automation/rules/${replacement.body.id}/activate-reviewed`),
  ]);
  assert.deepEqual(simultaneous.map(result => result.status).sort(), [200, 409], JSON.stringify(simultaneous));
  assert.equal(await isUnreviewedReplacement(replacement.body.id), false);
  const [enabled] = await db.select().from(workflowRules).where(eq(workflowRules.id, replacement.body.id));
  assert.equal(enabled.enabled, true);
  assert.ok((enabled.trigger as any).reviewActivatedAt);
  // This test rule cannot match real email (email has no SMS gateway); promptly pause it.
  await db.update(workflowRules).set({ enabled: false }).where(eq(workflowRules.id, enabled.id));
  const changed = await source("Stale review fixture");
  const stale = await post(`/api/automation/legacy/notification/${changed.id}/draft`);
  assert.equal(stale.status, 200);
  drafts.push(stale.body.id);
  await db.update(notificationRules).set({ name: "Changed after preview" }).where(eq(notificationRules.id, changed.id));
  const refused = await post(`/api/automation/rules/${stale.body.id}/activate-reviewed`);
  assert.equal(refused.status, 409);
  const [stillPaused] = await db.select().from(workflowRules).where(eq(workflowRules.id, stale.body.id));
  assert.equal(stillPaused.enabled, false);
  console.log("Reviewed replacement HTTP/DB tests passed: paused source preservation, idempotent draft, concurrent one-shot activation and stale-source rejection");
} finally {
  if (drafts.length) await db.delete(workflowRules).where(inArray(workflowRules.id, drafts));
  if (sources.length) await db.delete(notificationRules).where(inArray(notificationRules.id, sources));
  await db.delete(users).where(eq(users.id, userId));
  await new Promise<void>(resolve => server.close(() => resolve()));
  await pool.end();
}
