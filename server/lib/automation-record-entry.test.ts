import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import express from "express";
import { eq, inArray } from "drizzle-orm";
import { db, pool } from "../db";
import { users, customers, clinics, hospitals, collaborators, activityLogs, taskAttachmentUploads, tasks, taskGroups } from "../../shared/schema";
import { DATA_ROOT } from "../config/storage-paths";
import { executeRecordEntry, matchRecordContacts, registerRecordEntryRoutes, RECORD_ENTRY_SCHEMA } from "./automation-record-entry";
import { registerConditionOptionsRoute } from "./automation-condition-options";
const ownerId = randomUUID(), czOwnerId = randomUUID(), eventId = randomUUID(), ruleId = randomUUID();
const ids = Array.from({ length: 5 }, () => randomUUID()), uploadId = randomUUID(), key = `${randomUUID()}.pdf`;
const email = `fixture-${randomUUID()}@example.test`;
const groupId = randomUUID(), normalGroupId = randomUUID(), reviewTaskIds: string[] = [];
const owner = { id: ownerId, role: "manager", assignedCountries: ["SK"], isActive: true };
const filePath = join(dirname(DATA_ROOT), "private-task-attachments", key);
let server: any;
try {
  await pool.query(RECORD_ENTRY_SCHEMA);
  await db.insert(users).values([ownerId, czOwnerId].map((id, i) => ({
    id, username: `record-entry-test-${id}`, email: `${id}@example.test`, passwordHash: "!",
    fullName: "Automation test fixture", role: "manager", isActive: true, assignedCountries: [i ? "CZ" : "SK"],
  })));
  await db.insert(taskGroups).values([{ id: groupId, name: `Review fixture ${groupId}`, isBackOffice: true },
    { id: normalGroupId, name: `Normal fixture ${normalGroupId}`, isBackOffice: false }]);
  await db.insert(customers).values([
    { id: ids[0], firstName: "Automation", lastName: "Fixture", email, phone: "0900 123 456", country: "SK" },
    { id: ids[4], firstName: "Automation", lastName: "Foreign fixture", email: `foreign-${email}`, phone: "0900 123 456", country: "CZ" },
  ]);
  await db.insert(clinics).values({ id: ids[1], name: "Automation clinic fixture", countryCode: "SK", email: `clinic-${email}`, phone: "+421 900 123 457" });
  await db.insert(hospitals).values({ id: ids[2], name: "Automation hospital fixture", countryCode: "SK", email: `hospital-${email}` });
  await db.insert(collaborators).values({ id: ids[3], firstName: "Automation", lastName: "Person fixture", countryCode: "SK", email: `person-${email}` });
  assert.equal((await matchRecordContacts({ targetType: "customer", email: email.toUpperCase() }, owner, ["SK"])).records[0].id, ids[0]);
  assert.equal((await matchRecordContacts({ targetType: "customer", phone: "+421900123456" }, owner, ["SK"])).records[0].id, ids[0]);
  assert.equal((await matchRecordContacts({ targetType: "clinic", phone: "0900123457" }, owner, ["SK"])).records[0].id, ids[1]);
  assert.equal((await matchRecordContacts({ targetType: "customer", email: `foreign-${email}` }, owner, ["SK"])).records.length, 0);
  await assert.rejects(() => matchRecordContacts({ targetType: "customer", email }, owner, ["CZ"]));
  assert.equal((await matchRecordContacts({ targetType: "customer", email, phone: "+421900123499" }, owner, ["SK"])).records.length, 0);
  await db.update(clinics).set({ email }).where(eq(clinics.id, ids[1]));
  assert.equal((await matchRecordContacts({ targetType: "auto", email }, owner, ["SK"])).records.length, 2);
  const ctx: any = { rule: { id: ruleId, name: "Fixture rule", createdByUserId: ownerId, countryCodes: ["SK"] },
    event: { id: eventId }, communication: { id: eventId }, analysis: { summary: "Verified finding" } };
  // Only this isolated test supplies a trusted source snapshot. The engine always loads the persisted authorized source.
  const source = async () => ({ channel: "email" as const, text: "Fixture", communication: { id: eventId, countryCode: "SK", senderEmail: email } });
  const config: any = { recordEntryVersion: 1, targetType: "auto", lookup: "sender", mode: "history", title: "Finding" };
  assert.equal((await executeRecordEntry(config, ctx, source as any)).error, "record_entry_ambiguous");
  const missing = { ...config, lookup: "configured", email: `missing-${email}` };
  assert.equal((await executeRecordEntry(missing, ctx, source as any)).error, "record_entry_not_found");
  const denied = async () => ({ ...await source(), communication: { id: randomUUID(), countryCode: "SK", senderEmail: email } });
  assert.equal((await executeRecordEntry(config, ctx, denied as any)).error, "record_entry_source_denied");
  for (const [type, address] of [["customer", email], ["clinic", email], ["hospital", `hospital-${email}`], ["collaborator", `person-${email}`]]) {
    const cfg = { ...config, targetType: type, lookup: "configured", email: address };
    assert.equal((await executeRecordEntry(cfg, ctx, source as any)).ok, true);
    assert.equal((await executeRecordEntry(cfg, ctx, source as any)).output?.duplicate, true);
  }
  await mkdir(dirname(filePath), { recursive: true }); await writeFile(filePath, "private original invoice fixture");
  await db.insert(taskAttachmentUploads).values({ id: uploadId, uploaderUserId: ownerId, storageKey: key, name: "invoice.pdf",
    type: "application/pdf", size: 32 });
  ctx.analysis.attachments = [{ id: uploadId, classification: "invoice", sourceAttachmentId: "trusted-original-id" }];
  const invoice = { ...config, targetType: "customer", mode: "invoice" };
  assert.equal((await executeRecordEntry(invoice, ctx, source as any)).ok, true);
  ctx.analysis.attachments = [{ id: randomUUID(), classification: "invoice", sourceAttachmentId: "trusted-original-id" }];
  assert.equal((await executeRecordEntry(invoice, ctx, source as any)).error, "record_entry_attachment_denied");
  ctx.analysis.attachments = [{ id: uploadId, classification: "invoice", sourceAttachmentId: "trusted-original-id" }];
  const reviewConfig = { ...invoice, targetType: "auto", onAmbiguous: { taskGroupId: groupId } };
  let deliveries = 0;
  const createTask = async (cfg: any, taskCtx: any) => {
    deliveries++;
    assert.equal(cfg.taskGroupId, groupId);
    assert.equal(cfg.country, "SK");
    assert.equal(cfg.customerId, undefined);
    assert.equal(cfg.relatedEntityId, undefined);
    assert.equal(cfg.analysisAttachments, "invoice");
    assert.equal(taskCtx.analysis.attachments[0].id, uploadId);
    assert.match(taskCtx.recordReview.description, /Automation clinic fixture/);
    assert.match(taskCtx.recordReview.description, /Automation Fixture/);
    assert.match(taskCtx.recordReview.description, /Verified finding/);
    const [task] = await db.insert(tasks).values({ title: taskCtx.recordReview.title, description: taskCtx.recordReview.description,
      country: cfg.country, createdByUserId: ownerId, assignedUserId: ownerId, tags: ["back_office", `group_id:${groupId}`] }).returning();
    reviewTaskIds.push(task.id);
    return { ok: true, output: { taskId: task.id } };
  };
  const before = await pool.query("SELECT count(*) FROM automation_record_entries WHERE rule_id=$1 AND entity_type<>'task'", [ruleId]);
  assert.equal((await executeRecordEntry({ ...reviewConfig, onAmbiguous: { taskGroupId: normalGroupId } }, ctx, source as any, createTask)).error,
    "record_entry_review_group_unavailable");
  const reviewed = await executeRecordEntry(reviewConfig, ctx, source as any, createTask);
  assert.equal(reviewed.output?.routedToBackOffice, true);
  assert.equal((await executeRecordEntry(reviewConfig, ctx, source as any, createTask)).output?.duplicate, true);
  assert.equal(deliveries, 1);
  // Even if the directory becomes unique later, a routed event stays with Back Office.
  await db.update(clinics).set({ email: `clinic-${email}` }).where(eq(clinics.id, ids[1]));
  assert.equal((await executeRecordEntry(reviewConfig, ctx, source as any, createTask)).output?.duplicate, true);
  const after = await pool.query("SELECT count(*) FROM automation_record_entries WHERE rule_id=$1 AND entity_type<>'task'", [ruleId]);
  assert.equal(after.rows[0].count, before.rows[0].count);
  // Restore the ambiguous directory for the IF search assertion below.
  await db.update(clinics).set({ email }).where(eq(clinics.id, ids[1]));
  const app = express(); app.use(express.json());
  const auth: any = (req: any, _res: any, next: any) => { req.session = { user: { id: req.headers["x-test-reader"] === "CZ" ? czOwnerId : ownerId } }; next(); };
  registerRecordEntryRoutes(app, auth, auth); registerConditionOptionsRoute(app, auth);
  server = await new Promise(resolve => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api/automation`;
  const entries = await fetch(`${base}/records/customer/${ids[0]}/entries`);
  assert.equal(entries.status, 200); const rows: any[] = await entries.json();
  assert.equal(rows.length, 2); assert.ok(rows.every(row => row.note === "Verified finding"));
  const privateUrl = `${base}/records/customer/${ids[0]}/files/${uploadId}`;
  const file = await fetch(privateUrl); assert.equal(file.status, 200); assert.match(file.headers.get("content-disposition")!, /^attachment/);
  assert.equal(await file.text(), "private original invoice fixture");
  assert.equal((await fetch(privateUrl, { headers: { "x-test-reader": "CZ" } })).status, 403);
  assert.equal((await fetch(`${base}/records/clinic/${ids[1]}/files/${uploadId}`)).status, 404);
  const options = await fetch(`${base}/condition-options?module=communication&eventType=communication.received&field=communication.customerId&q=${encodeURIComponent(email)}&countryCodes=SK`);
  assert.equal(options.status, 200);
  const choiceRows = (await options.json()).options;
  assert.equal(choiceRows.length, 4); // The IF picker searches substrings; execution requires an exact identity.
  assert.ok(choiceRows.some((row: any) => row.value === ids[0]) && choiceRows.some((row: any) => row.value === ids[1]));
  assert.ok(!choiceRows.some((row: any) => row.value === ids[4]));
  assert.equal((await fetch(`${base}/condition-options?module=customer&eventType=created&field=passwordHash`)).status, 400);
  console.log("Record-entry DB matching, ambiguity, all card types, atomic dedup, invoice retention and private access tests passed");
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  await pool.query("DELETE FROM automation_record_entries WHERE rule_id=$1", [ruleId]);
  await db.delete(activityLogs).where(eq(activityLogs.userId, ownerId));
  await db.delete(taskAttachmentUploads).where(eq(taskAttachmentUploads.id, uploadId));
  if (reviewTaskIds.length) await db.delete(tasks).where(inArray(tasks.id, reviewTaskIds));
  await db.delete(taskGroups).where(inArray(taskGroups.id, [groupId, normalGroupId]));
  await db.delete(customers).where(inArray(customers.id, [ids[0], ids[4]]));
  await db.delete(clinics).where(eq(clinics.id, ids[1]));
  await db.delete(hospitals).where(eq(hospitals.id, ids[2]));
  await db.delete(collaborators).where(eq(collaborators.id, ids[3]));
  await db.delete(users).where(inArray(users.id, [ownerId, czOwnerId]));
  await unlink(filePath).catch(() => {});
  await pool.end();
}
