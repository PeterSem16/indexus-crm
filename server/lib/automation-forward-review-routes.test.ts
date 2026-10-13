import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express from "express";
import { eq, inArray } from "drizzle-orm";
import { db, pool } from "../db";
import { users, customers, tasks } from "../../shared/schema";
import { registerForwardReviewRoutes } from "./automation-forward-review-routes";
import { matchForwardSender } from "./automation-forward-matching";
import { canAccessTaskByPolicy } from "./task-contract";

// Private local fixtures only. No messages, automations or external deliveries are replayed.
const ownerId = randomUUID(), otherId = randomUUID();
const ids = Array.from({ length: 3 }, () => randomUUID());
const taskIds = [randomUUID(), randomUUID()];
const email = `forward-review-${randomUUID()}@example.test`;
const phone = "0900123456";
const owner = { id: ownerId, role: "manager", assignedCountries: ["SK"], isActive: true };
const outsider = { id: otherId, role: "user", assignedCountries: ["CZ"], isActive: true };
let server: any;
try {
  await pool.query("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS forward_review jsonb");
  await db.insert(users).values([owner, outsider].map(actor => ({ ...actor, username: `review-${actor.id}`,
    email: `${actor.id}@example.test`, passwordHash: "!", fullName: "Forward review fixture" })));
  await db.insert(customers).values([
    { id: ids[0], firstName: "Review", lastName: "First fixture", email, mobile2: phone, country: "SK" },
    { id: ids[1], firstName: "Review", lastName: "Second fixture", email: `second-${email}`, country: "SK" },
    { id: ids[2], firstName: "Review", lastName: "Foreign fixture", email, mobile2: phone, country: "CZ" },
  ]);
  const source: any = { channel: "email", communication: { senderEmail: email, countryCode: "SK" } };
  const ctx = { rule: { createdByUserId: ownerId, countryCodes: ["SK"] } };
  assert.equal((await matchForwardSender(source, ctx)).customerId, ids[0], "foreign duplicate cannot affect authorized match");
  assert.equal((await matchForwardSender({ channel: "sms", communication: { senderPhone: "+421900123456", countryCode: "SK" } } as any, ctx)).customerId,
    ids[0], "secondary mobile normalizes national and international forms");
  await db.update(customers).set({ email }).where(eq(customers.id, ids[1]));
  const ambiguous = await matchForwardSender(source, ctx);
  assert.equal(ambiguous.customerId, null);
  assert.equal(ambiguous.matchStatus, "ambiguous");
  assert.equal(ambiguous.candidateIds.length, 2);
  await assert.rejects(() => matchForwardSender({ ...source, communication: { ...source.communication, countryCode: "CZ" } }, ctx));
  const unknownCountry = await matchForwardSender({ ...source, communication: { senderEmail: email } },
    { rule: { createdByUserId: ownerId, countryCodes: ["SK", "CZ"] } });
  assert.equal(unknownCountry.customerId, null);
  assert.deepEqual(unknownCountry.candidateIds, []);
  assert.equal(unknownCountry.matchStatus, "ambiguous", "unknown country remains a manual decision, never an unsafe lookup");
  const invalidSender = await matchForwardSender({ ...source, communication: { senderEmail: "Unknown sender", countryCode: "SK" } }, ctx);
  assert.equal(invalidSender.customerId, null);
  const attachmentId = randomUUID(), archiveId = randomUUID();
  const review: any = { version: 1, matchSender: true, matchStatus: "ambiguous", candidateIds: ids,
    invoices: [{ attachmentId, name: "invoice.pdf", approvedAt: null, approvedBy: null }] };
  await db.insert(tasks).values(taskIds.map((id, i) => ({
    id, title: "Forward review fixture", country: "SK", assignedUserId: ownerId, createdByUserId: ownerId,
    tags: i ? [] : ["back_office"], forwardReview: review,
    attachments: [{ id: attachmentId, name: "invoice.pdf", url: `/api/tasks/attachments/${attachmentId}`, type: "application/pdf", size: 1 },
      { id: archiveId, name: "original-email.eml", url: `/api/tasks/attachments/${archiveId}`, type: "message/rfc822", size: 1 }],
  })));
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => { req.session = { user: req.headers["x-outsider"] ? outsider : owner }; next(); });
  registerForwardReviewRoutes(app, (_req, _res, next) => next(), {
    canAccess: async (req: any, task) => canAccessTaskByPolicy(req.session.user, task),
    canApprove: (req: any, task) => task.tags.includes("back_office") && canAccessTaskByPolicy(req.session.user, task),
  });
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/tasks/`;
  const request = (suffix: string, method = "GET", body?: any, outsider = false) => fetch(url + suffix, {
    method, headers: { "Content-Type": "application/json", ...(outsider ? { "x-outsider": "1" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const detail = await (await request(`${taskIds[0]}/forward-review`)).json() as any;
  assert.equal(detail.customer, null);
  assert.equal(detail.candidates.length, 2, "persisted candidates are filtered against fresh actor and task country");
  const search = await (await request(`${taskIds[0]}/forward-review/customers?q=${encodeURIComponent(email)}`)).json() as any;
  assert.equal(search.records.length, 2);
  assert.equal((await request(`${taskIds[0]}/forward-review/customer`, "PATCH", { customerId: ids[2] })).status, 404);
  assert.equal((await request(`${taskIds[0]}/forward-review/customer`, "PATCH", { customerId: ids[0] })).status, 200);
  assert.equal((await request(`${taskIds[0]}/forward-review/customer`, "PATCH", { customerId: ids[1] })).status, 200);
  assert.equal((await request(`${taskIds[0]}/forward-review`)).status, 200);
  assert.equal((await request(`${taskIds[0]}/forward-review`, "GET", undefined, true)).status, 404);
  assert.equal((await request(`${taskIds[1]}/forward-review/approval`, "POST", { attachmentId })).status, 403);
  assert.equal((await request(`${taskIds[0]}/forward-review/approval`, "POST", { attachmentId: archiveId })).status, 404);
  const approvals = await Promise.all([1, 2].map(() => request(`${taskIds[0]}/forward-review/approval`, "POST", { attachmentId })));
  assert.ok(approvals.every(response => response.status === 200));
  const [saved] = await db.select().from(tasks).where(eq(tasks.id, taskIds[0]));
  assert.equal(saved.customerId, ids[1]);
  assert.ok(saved.forwardReview?.invoices[0].approvedAt);
  assert.equal(saved.forwardReview?.invoices[0].approvedBy, ownerId);
  const timestamp = saved.forwardReview!.invoices[0].approvedAt;
  await request(`${taskIds[0]}/forward-review/approval`, "POST", { attachmentId });
  const [again] = await db.select().from(tasks).where(eq(tasks.id, taskIds[0]));
  assert.equal(again.forwardReview!.invoices[0].approvedAt, timestamp);
  assert.equal(again.status, "pending", "optical approval does not complete work or create an accounting action");
  assert.equal((await request(`${taskIds[0]}/forward-review/customer`, "PATCH", { customerId: null })).status, 200);
  assert.equal((await request(`${taskIds[0]}/forward-review/customer`, "PATCH", { customerId: ids[0], country: "CZ" })).status, 400);
  console.log("Forward review HTTP and sender matching fixtures passed");
} finally {
  if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
  await db.delete(tasks).where(inArray(tasks.id, taskIds));
  await db.delete(customers).where(inArray(customers.id, ids));
  await db.delete(users).where(inArray(users.id, [ownerId, otherId]));
  await pool.end();
}
