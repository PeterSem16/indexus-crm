import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db, pool } from "../db";
import { users, clinics, collections, workflowEvents } from "@shared/schema";
import {
  executeUpdateRecord, searchUpdateRecords, updateRecordOwner, readUpdateRecord,
  publicUpdateRecord, validateSavedUpdateRecord, registerUpdateRecordRoutes,
} from "./automation-update-record";
import { validateRuleCapabilities } from "./automation-capabilities";
import express from "express";

test("Update record: real database scope, persisted relationships, typed atomic updates and protected routes", async () => {
  const ownerId = randomUUID(), limitedId = randomUUID();
  const clinicId = randomUUID(), foreignId = randomUUID(), collectionId = randomUUID();
  const prefix = `update-record-test-${randomUUID().slice(0, 8)}`;
  let server: any;
  const config = (fields: any, overrides: any = {}) => ({
    updateRecordVersion: 2, acknowledged: true, fields,
    target: { mode: "selected", entityType: "clinic", recordId: clinicId }, ...overrides,
  });
  const ctx = { rule: { createdByUserId: ownerId, countryCodes: ["SK"] },
    event: { module: "collection", entityType: "collection", entityId: collectionId, countryCode: "SK" },
    newValues: { clinicId: foreignId, note: "Copied safely" }, oldValues: {} };
  try {
    await db.insert(users).values([
      { id: ownerId, username: `${prefix}-admin`, email: `${prefix}-admin@example.invalid`, passwordHash: "unused-test-hash", fullName: "Test automation administrator", role: "admin", isActive: true },
      { id: limitedId, username: `${prefix}-manager`, email: `${prefix}-manager@example.invalid`, passwordHash: "unused-test-hash", fullName: "Test automation manager", role: "manager", assignedCountries: ["SK"], isActive: true },
    ]);
    await db.insert(clinics).values([
      { id: clinicId, name: `${prefix} clinic SK`, countryCode: "SK", notes: "Before" },
      { id: foreignId, name: `${prefix} clinic CZ`, countryCode: "CZ", notes: "Foreign" },
    ]);
    await db.insert(collections).values({ id: collectionId, countryCode: "SK", cbuNumber: `${prefix}-CBU`, clinicId, note: "Source" });
    const owner = await updateRecordOwner(ownerId), limited = await updateRecordOwner(limitedId);
    const search = await searchUpdateRecords("clinic", prefix, limited);
    assert.deepEqual(search.records.map(row => row.id), [clinicId]);
    await assert.rejects(searchUpdateRecords("clinic", prefix, limited, ["CZ"]), /access/i);
    await assert.rejects(readUpdateRecord("clinic", foreignId, limited), /unavailable/i);
    assert.equal(publicUpdateRecord("clinic", await readUpdateRecord("clinic", clinicId, owner, ["SK"])).values.notes, "Before");
    const changed = await executeUpdateRecord(config({ notes: "Changed", isActive: false }), ctx);
    assert.equal(changed.after.notes, "Changed");
    assert.equal(changed.after.isActive, false);
    assert.equal(changed.after.countryCode, "SK");
    // The browser/event snapshot lies about the relationship: only persisted clinicId is authoritative.
    const related = config({ notes: "{{newValues.note}}" }, { target: { mode: "related", entityType: "clinic", relation: "clinicId" } });
    const linked = await executeUpdateRecord(related, ctx);
    assert.equal(linked.entityId, clinicId);
    assert.equal(linked.after.notes, "Copied safely");
    for (const invalid of [
      config({ notes: "Bad", countryCode: "CZ" }),
      config({ notes: "Bad", isActive: "false" }),
      config({ notes: null }),
      config({ notes: "Bad" }, { acknowledged: false }),
      config({ notes: "Bad" }, { target: { mode: "selected", entityType: "clinic", recordId: foreignId } }),
      config({ notes: "{{newValues.missing}}" }),
    ]) await assert.rejects(executeUpdateRecord(invalid, ctx));
    assert.equal((await readUpdateRecord("clinic", clinicId, owner)).notes, "Copied safely", "Invalid multi-field action cannot partially write");
    assert.equal((await readUpdateRecord("clinic", foreignId, owner)).notes, "Foreign");
    await db.update(collections).set({ clinicId: null }).where(eq(collections.id, collectionId));
    await assert.rejects(executeUpdateRecord(related, ctx), /missing/i);
    await db.update(users).set({ isActive: false }).where(eq(users.id, ownerId));
    await assert.rejects(executeUpdateRecord(config({ notes: "Bad" }), ctx), /authorized/i);
    await db.update(users).set({ isActive: true }).where(eq(users.id, ownerId));
    await assert.rejects(validateSavedUpdateRecord(config({ notes: "x" }, {
      target: { mode: "selected", entityType: "clinic", recordId: randomUUID() },
    }), "collection", owner, ["SK"]), /unavailable/i);

    const rule = { module: "collection", trigger: { type: "event", entityType: "collection", eventType: "updated" },
      conditions: null, actions: [{ type: "update_entity", config: config({ notes: "x" }) }] };
    assert.deepEqual(validateRuleCapabilities(rule), []);
    assert.ok(validateRuleCapabilities({ ...rule, actions: [{ type: "update_entity", config: config({ countryCode: "CZ" }) }] }).length);

    const app = express();
    const auth = (req: any, res: any, next: any) => {
      if (req.headers["x-fixture-user"] !== limitedId) return res.status(401).end();
      req.session = { user: { id: limitedId } }; next();
    };
    registerUpdateRecordRoutes(app, auth);
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    const url = `http://127.0.0.1:${server.address().port}/api/automation/update-record`;
    assert.equal((await fetch(`${url}/records?entityType=clinic&q=${prefix}`)).status, 401);
    const response = await fetch(`${url}/records?entityType=clinic&q=${prefix}&countries=SK`, { headers: { "x-fixture-user": limitedId } });
    const data = await response.json() as any;
    assert.deepEqual(data.records.map((row: any) => row.id), [clinicId]);
    assert.equal(JSON.stringify(data).includes("password"), false);
    assert.equal((await fetch(`${url}/record?entityType=clinic&id=${foreignId}`, { headers: { "x-fixture-user": limitedId } })).status, 400);
    assert.equal((await fetch(`${url}/records?entityType=__proto__`, { headers: { "x-fixture-user": limitedId } })).status, 400);
    // The execution helper itself emits no events: the engine attaches exact run provenance.
    const emitted = await db.select({ id: workflowEvents.id }).from(workflowEvents).where(eq(workflowEvents.entityId, clinicId));
    assert.equal(emitted.length, 0);
  } finally {
    if (server) await new Promise<void>(resolve => server.close(resolve));
    await db.delete(collections).where(eq(collections.id, collectionId));
    await db.delete(clinics).where(inArray(clinics.id, [clinicId, foreignId]));
    await db.delete(users).where(inArray(users.id, [ownerId, limitedId]));
    await pool.end();
  }
});
