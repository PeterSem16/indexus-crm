import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, sql, getTableName } from "drizzle-orm";
import express from "express";
import { db, pool } from "../db";
import { users, contractTemplates, billingDetails } from "@shared/schema";
import { RECORD_TAG_ENTITY_TYPES } from "../../shared/automation-record-tags";
import { executeRecordTagAction, recordTagSuggestions, taggedRecords, registerRecordTagRoutes, mergeRecordTags } from "./automation-record-tags";
import { updateRecordTables, updateRecordOwner } from "./automation-update-record";
import { buildValidatedTaskPatch } from "./task-contract";
import { safeTaskEventValues } from "./event-bus";

test("Tags: real atomic writes across ten records, scope, contract state, directory and protected GET", async () => {
  const ownerId = randomUUID(), limitedId = randomUUID(), templateId = randomUUID(), billingId = randomUUID();
  const ids = Object.fromEntries(RECORD_TAG_ENTITY_TYPES.map(type => [type, randomUUID()]));
  const foreignId = randomUUID(), prefix = `tag-test-${randomUUID().slice(0, 8)}`;
  let server: any;
  try {
    // Same additive migration as startup; never db:push or touch unrelated columns.
    for (const table of Object.values(updateRecordTables))
      await db.execute(sql.raw(`ALTER TABLE "${getTableName(table)}" ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`));
    await db.insert(users).values([
      { id: ownerId, username: `${prefix}-admin`, email: `${prefix}-admin@example.invalid`, passwordHash: "test-only", fullName: "Tag test admin", role: "admin", isActive: true },
      { id: limitedId, username: `${prefix}-manager`, email: `${prefix}-manager@example.invalid`, passwordHash: "test-only", fullName: "Tag test manager", role: "manager", assignedCountries: ["SK"], isActive: true },
    ]);
    await db.insert(billingDetails).values({ id: billingId, countryCode: "SK", companyName: prefix, address: "Test", city: "Test" });
    await db.insert(contractTemplates).values({ id: templateId, name: prefix, countryCode: "SK", languageCode: "sk" });
    const data: Record<string, any> = {
      customer: { firstName: prefix, lastName: "Test", email: `${prefix}@example.invalid`, country: "SK" },
      task: { title: prefix, assignedUserId: ownerId, createdByUserId: ownerId, country: "SK", tags: ["group_id:kept", "status_list"] },
      hospital: { name: prefix, countryCode: "SK" }, clinic: { name: prefix, countryCode: "SK" },
      invoice: { invoiceNumber: prefix, customerId: ids.customer, totalAmount: "1" },
      collection: { countryCode: "SK", cbuNumber: prefix, clinicId: ids.clinic },
      collaborator: { firstName: prefix, lastName: "Test", countryCode: "SK" },
      contract: { contractNumber: prefix, templateId, billingDetailsId: billingId, customerId: ids.customer, status: "signed" },
      campaign: { name: prefix, countryCodes: ["SK"] }, product: { name: prefix },
    };
    for (const type of ["customer", "task", "hospital", "clinic", "invoice", "collection", "collaborator", "contract", "campaign", "product"])
      await db.insert(updateRecordTables[type]).values({ id: ids[type], ...data[type] });
    await db.insert(updateRecordTables.clinic).values({ id: foreignId, name: `${prefix}-foreign`, countryCode: "CZ" });
    const config = (type: string, tags = ["VIP"], target: any = { mode: "event", entityType: type }) =>
      ({ recordTagActionVersion: 2 as const, tags, target, acknowledged: true });
    const context = (type: string, owner = ownerId) => ({
      rule: { createdByUserId: owner }, event: { module: type, entityType: type, entityId: ids[type] },
      newValues: {}, oldValues: {},
    });
    for (const type of RECORD_TAG_ENTITY_TYPES) {
      assert.equal((await executeRecordTagAction(config(type), context(type), "add")).changed, true, type);
      assert.equal((await executeRecordTagAction(config(type, ["vip"]), context(type), "add")).changed, false, type);
      assert.deepEqual((await recordTagSuggestions(type, "vi", await updateRecordOwner(ownerId))).tags, ["VIP"], type);
      assert.ok((await taggedRecords(type, "vip", prefix, await updateRecordOwner(ownerId))).records.some(row => row.id === ids[type]), type);
      assert.equal((await executeRecordTagAction(config(type, ["vIp"]), context(type), "remove")).changed, true, type);
      assert.equal((await executeRecordTagAction(config(type), context(type), "remove")).changed, false, type);
    }
    await Promise.all(["One", "Two", "Three"].map(tag => executeRecordTagAction(config("clinic", [tag]), context("clinic"), "add")));
    const [clinic] = await db.select().from(updateRecordTables.clinic).where(eq(updateRecordTables.clinic.id, ids.clinic));
    assert.deepEqual(new Set(clinic.tags), new Set(["One", "Two", "Three"]), "No lost concurrent additions");
    const [task] = await db.select().from(updateRecordTables.task).where(eq(updateRecordTables.task.id, ids.task));
    assert.deepEqual(task.tags, ["group_id:kept", "status_list"]);
    assert.deepEqual(buildValidatedTaskPatch({ tags: ["group_id:new"] }, ["VIP", ...task.tags]).tags, ["VIP", "status_list", "group_id:new"]);
    assert.deepEqual(safeTaskEventValues({ ...task, tags: [...task.tags, "VIP"] }).tags, ["VIP"]);
    assert.deepEqual(mergeRecordTags(["group_id:kept", "VIP", "vip", "Other"], ["vIp"], "remove"), ["group_id:kept", "Other"]);
    const related = config("clinic", ["Related"], { mode: "related", entityType: "clinic", relation: "clinicId" });
    assert.equal((await executeRecordTagAction(related, { ...context("collection"), newValues: { clinicId: foreignId } }, "add")).entityId, ids.clinic);
    await assert.rejects(executeRecordTagAction(config("clinic", ["Foreign"], { mode: "selected", entityType: "clinic", recordId: foreignId }), context("clinic", limitedId), "add"));
    await assert.rejects(executeRecordTagAction(config("task", ["group_id:removed"]), context("task"), "remove"));
    const [contract] = await db.select().from(updateRecordTables.contract).where(eq(updateRecordTables.contract.id, ids.contract));
    assert.equal(contract.status, "signed", "Tags must not change contract state");
    const app = express();
    app.use((req: any, _res, next) => {
      const id = req.headers["x-test-user"];
      if (id) req.session = { user: { id } };
      next();
    });
    const auth = (req: any, res: any, next: any) => req.session?.user ? next() : res.status(401).end();
    registerRecordTagRoutes(app, auth, auth);
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(`${base}/api/record-tags/clinic/${ids.clinic}`)).status, 401);
    assert.equal((await fetch(`${base}/api/record-tags/clinic/${foreignId}`, { headers: { "x-test-user": limitedId } })).status, 404);
    const response = await fetch(`${base}/api/record-tags/clinic/${ids.clinic}`, { headers: { "x-test-user": limitedId } });
    assert.equal(response.status, 200);
    assert.deepEqual(Object.keys(await response.json()), ["tags"], "Only public tag labels, never private entity columns");
    const forbidden = await fetch(`${base}/api/automation/record-tags/records?entityType=clinic&countries=CZ&q=${prefix}`, { headers: { "x-test-user": limitedId } });
    assert.equal(forbidden.status, 400);
    await db.update(users).set({ isActive: false }).where(eq(users.id, ownerId));
    await assert.rejects(executeRecordTagAction(config("clinic"), context("clinic"), "add"), /authorized/i);
  } finally {
    if (server) await new Promise<void>(resolve => server.close(resolve));
    for (const type of ["contract", "invoice", "collection", "task", "collaborator", "campaign", "product", "clinic", "hospital", "customer"])
      await db.delete(updateRecordTables[type]).where(eq(updateRecordTables[type].id, ids[type]));
    await db.delete(updateRecordTables.clinic).where(eq(updateRecordTables.clinic.id, foreignId));
    await db.delete(contractTemplates).where(eq(contractTemplates.id, templateId));
    await db.delete(billingDetails).where(eq(billingDetails.id, billingId));
    await db.delete(users).where(sql`${users.id} in (${ownerId}, ${limitedId})`);
    await pool.end();
  }
});
