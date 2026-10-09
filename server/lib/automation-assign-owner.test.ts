import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, inArray, and, isNull, sql } from "drizzle-orm";
import express from "express";
import { db, pool } from "../db";
import { users, customers, hospitals, clinics, tasks, roles, userRoles,
  clinicRepresentativeAssignments, hospitalRepresentativeAssignments } from "@shared/schema";
import { executeAssignOwner, validateSavedAssignOwner, registerAssignOwnerRoutes } from "./automation-assign-owner";
import { updateRecordOwner } from "./automation-update-record";
import { taskAssignmentAllowlist } from "./task-assignment-access";
import { assignOwnerIssues, type AssignOwnerConfig } from "../../shared/automation-assign-owner";
import { validateRuleCapabilities } from "./automation-capabilities";
import { assignMedicalPartnerRepresentative } from "./representative-assignment";

test("Owner assignment: reviewed contract, real targets, protected routing, scope and distribution", async () => {
  const admin = randomUUID(), person = randomUUID(), foreign = randomUUID();
  const customer = randomUUID(), hospital = randomUUID(), clinic = randomUUID(), task = randomUUID(), foreignCustomer = randomUUID();
  let repRole: string | undefined, createdRole = false;
  const fixtureTasks: string[] = [], prefix = `owner-test-${randomUUID().slice(0, 8)}`;
  let server: any;
  const config = (type: string, ids = [person]): AssignOwnerConfig => ({
    assignOwnerVersion: 2, target: { mode: "event", entityType: type },
    strategy: "specific", userIds: ids, replaceExisting: true, acknowledged: true,
  });
  const context = (type: string, id: string, actor = admin) => ({
    rule: { id: prefix, createdByUserId: actor, countryCodes: ["SK"] },
    event: { module: type, entityType: type, entityId: id, countryCode: "SK" },
  });
  try {
    await db.insert(users).values([
      { id: admin, username: `${prefix}-admin`, email: `${prefix}-a@example.invalid`, fullName: "Owner test admin", passwordHash: "test-only", role: "admin", isActive: true },
      { id: person, username: `${prefix}-person`, email: `${prefix}-p@example.invalid`, fullName: "Owner test person", passwordHash: "test-only", role: "manager", assignedCountries: ["SK"], isActive: true },
      { id: foreign, username: `${prefix}-foreign`, email: `${prefix}-f@example.invalid`, fullName: "Owner test foreign", passwordHash: "test-only", role: "manager", assignedCountries: ["CZ"], isActive: true },
    ]);
    await db.insert(customers).values([
      { id: customer, firstName: prefix, lastName: "Test", email: `${prefix}@example.invalid`, country: "SK" },
      { id: foreignCustomer, firstName: prefix, lastName: "Foreign", email: `${prefix}-foreign@example.invalid`, country: "CZ" },
    ]);
    await db.insert(hospitals).values({ id: hospital, name: prefix, countryCode: "SK" });
    await db.insert(clinics).values({ id: clinic, name: prefix, countryCode: "SK" });
    const valid = config("customer");
    assert.deepEqual(assignOwnerIssues(valid, "customer"), []);
    const rule = { module: "customer", trigger: { type: "event", entityType: "customer", eventType: "updated" }, actions: [{ type: "assign_user", config: valid }] };
    assert.deepEqual(validateRuleCapabilities(rule), []);
    for (const bad of [{ ...valid, acknowledged: false }, { ...valid, userIds: [] },
      { ...valid, userIds: [person, person] }, { ...valid, strategy: "anything" }, { ...valid, entityId: customer },
      { ...valid, target: { mode: "event", entityType: "clinic" } }]) {
      assert.ok(assignOwnerIssues(bad, "customer").length);
      assert.ok(validateRuleCapabilities({ ...rule, actions: [{ type: "assign_user", config: bad }] }).length);
    }
    assert.equal((await executeAssignOwner(valid, context("customer", customer))).assignedTo, person);
    assert.equal((await executeAssignOwner(valid, context("customer", customer))).changed, false, "No event-worthy write for same owner");
    assert.equal((await executeAssignOwner({ ...config("customer", [admin]), replaceExisting: false }, context("customer", customer))).reason, "already_assigned");
    assert.equal((await executeAssignOwner(config("hospital"), context("hospital", hospital))).after.responsiblePersonId, person);
    await assert.rejects(executeAssignOwner(config("customer", [foreign]), context("customer", customer)));
    await assert.rejects(executeAssignOwner({ ...valid, target: { mode: "selected", entityType: "customer", recordId: foreignCustomer } }, context("customer", customer, person)));
    await db.update(customers).set({ assignedUserId: null }).where(eq(customers.id, customer));
    const rr = { ...config("customer", [person, admin]), strategy: "round_robin" as const };
    const runs = await Promise.all(Array.from({ length: 4 }, () => executeAssignOwner(rr, context("customer", customer))));
    assert.deepEqual(runs.map(run => run.assignedTo), [person, admin, person, admin]);
    const random = await executeAssignOwner({ ...rr, strategy: "random" }, context("customer", customer));
    assert.ok(rr.userIds.includes(random.after.assignedUserId));
    const allowlist = await taskAssignmentAllowlist(db);
    const active = await db.select({ id: users.id, role: users.role, countries: users.assignedCountries }).from(users)
      .where(eq(users.isActive, true));
    const approved = active.filter(row => (!allowlist.configured || allowlist.allowedUserIds.includes(row.id)) &&
      (row.role === "admin" || row.countries?.includes("SK"))).map(row => row.id);
    assert.ok(approved.length >= 2, "Two existing or fixture approved users needed for actual task assignment coverage");
    const taskPool = [approved[0], approved[1]];
    await db.insert(tasks).values({ id: task, title: prefix, country: "SK", assignedUserId: taskPool[0], createdByUserId: admin, tags: ["VIP"] });
    const taskCfg = config("task", [taskPool[1]]);
    const assigned = await executeAssignOwner(taskCfg, context("task", task));
    assert.equal(assigned.after.assignedUserId, taskPool[1]);
    assert.deepEqual(assigned.after.tags, ["VIP"]);
    await db.update(tasks).set({ tags: ["VIP", "group_id:preserved"] }).where(eq(tasks.id, task));
    await assert.rejects(executeAssignOwner(taskCfg, context("task", task)), /Shared/);
    const related = { ...valid, target: { mode: "related" as const, entityType: "customer", relation: "customerId" } };
    await db.update(tasks).set({ customerId: customer }).where(eq(tasks.id, task));
    assert.equal((await executeAssignOwner(related, context("task", task))).entityId, customer);
    for (let i = 0; i < 3; i++) {
      const id = randomUUID(); fixtureTasks.push(id);
      await db.insert(tasks).values({ id, title: prefix, country: "SK", assignedUserId: admin, createdByUserId: admin });
    }
    const least = await executeAssignOwner({ ...rr, strategy: "least_loaded" }, context("customer", customer));
    assert.equal(least.after.assignedUserId, person, "Fixture person has no open tasks, admin has fixture load");
    const canonical = await db.select({ id: roles.id, name: roles.name, active: roles.isActive }).from(roles)
      .where(sql`lower(${roles.name}) in ('representant', 'representative')`);
    repRole = canonical.find(row => row.active)?.id;
    if (!repRole) {
      repRole = randomUUID(); createdRole = true;
      const name = ["Representant", "Representative", "REPRESENTANT", "REPRESENTATIVE", "RePrEsEnTaNt"]
        .find(value => !canonical.some(row => row.name === value))!;
      await db.insert(roles).values({ id: repRole, name, isActive: true });
    }
    await db.update(users).set({ roleId: repRole }).where(eq(users.id, admin));
    await db.insert(userRoles).values({ userId: person, roleId: repRole });
    const representative = (type: string, ids = [person]): AssignOwnerConfig =>
      ({ ...config(type, ids), assignmentKind: "representative" });
    for (const [type, id, assignments, key] of [
      ["clinic", clinic, clinicRepresentativeAssignments, clinicRepresentativeAssignments.clinicId],
      ["hospital", hospital, hospitalRepresentativeAssignments, hospitalRepresentativeAssignments.hospitalId],
    ] as const) {
      const first = await executeAssignOwner(representative(type), context(type, id));
      assert.equal(first.after.representativeId, person);
      assert.equal((await executeAssignOwner(representative(type), context(type, id))).changed, false);
      assert.equal((await executeAssignOwner({ ...representative(type, [admin]), replaceExisting: false }, context(type, id))).changed, false);
      await executeAssignOwner(representative(type, [admin]), context(type, id));
      const history = await db.select().from(assignments).where(eq(key, id));
      assert.equal(history.length, 2);
      const previous = history.find(row => row.userId === person)!;
      const current = history.find(row => row.validTo === null)!;
      assert.equal(current.userId, admin); assert.equal(current.assignmentType, "automation");
      assert.equal(current.assignedBy, admin);
      assert.equal(previous.validTo?.toISOString(), current.validFrom.toISOString(), "Old period closes at new period's start");
    }
    const [hospitalAfter] = await db.select().from(hospitals).where(eq(hospitals.id, hospital));
    assert.equal(hospitalAfter.responsiblePersonId, person, "Business representative never overwrites internal responsible person");
    await db.update(users).set({ assignedCountries: ["SK"] }).where(eq(users.id, foreign));
    await assert.rejects(executeAssignOwner(representative("clinic", [foreign]), context("clinic", clinic)), /representative/);
    await db.update(users).set({ assignedCountries: ["CZ"] }).where(eq(users.id, foreign));
    const repLeast = await executeAssignOwner({ ...representative("clinic", [admin, person]), strategy: "least_loaded" }, context("clinic", clinic));
    assert.equal(repLeast.after.representativeId, person, "Representative workload uses clinic assignments, not personal task counts");
    await Promise.all([
      executeAssignOwner(representative("clinic"), context("clinic", clinic)),
      db.transaction(tx => assignMedicalPartnerRepresentative(tx, {
        entityType: "clinic", entityId: clinic, userId: admin, assignedBy: admin, assignmentType: "manual",
      })),
    ]);
    const activeHistory = await db.select().from(clinicRepresentativeAssignments)
      .where(and(eq(clinicRepresentativeAssignments.clinicId, clinic), isNull(clinicRepresentativeAssignments.validTo)));
    const [clinicAfter] = await db.select().from(clinics).where(eq(clinics.id, clinic));
    assert.equal(activeHistory.length, 1); assert.equal(clinicAfter.representativeId, activeHistory[0].userId);
    await db.update(users).set({ isActive: false }).where(eq(users.id, person));
    await assert.rejects(validateSavedAssignOwner(valid, "customer", await updateRecordOwner(admin), ["SK"]));
    await db.update(users).set({ isActive: true }).where(eq(users.id, person));
    const app = express();
    app.use((req: any, _res, next) => { if (req.headers["x-test-user"]) req.session = { user: { id: req.headers["x-test-user"] } }; next(); });
    const auth = (req: any, res: any, next: any) => req.session?.user ? next() : res.sendStatus(401);
    registerAssignOwnerRoutes(app, auth, auth);
    server = app.listen(0, "127.0.0.1"); await new Promise<void>(resolve => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(`${base}/api/customers/${customer}/owner`)).status, 401);
    assert.equal((await fetch(`${base}/api/customers/${foreignCustomer}/owner`, { headers: { "x-test-user": person } })).status, 404);
    const response = await fetch(`${base}/api/customers/${customer}/owner`, { headers: { "x-test-user": person } });
    assert.deepEqual(await response.json(), { name: "Owner test person" });
    const people = await fetch(`${base}/api/automation/assign-owner/people?entityType=customer&countries=SK&id=${foreign}`, { headers: { "x-test-user": admin } });
    assert.deepEqual((await people.json()).options, []);
    for (const id of [admin, person]) {
      const reps = await fetch(`${base}/api/automation/assign-owner/people?entityType=clinic&assignmentKind=representative&countries=SK&id=${id}`, { headers: { "x-test-user": admin } });
      assert.equal((await reps.json()).options[0].value, id, "Primary role and many-to-many representative role are both supported");
    }
    assert.equal((await fetch(`${base}/api/automation/assign-owner/people?entityType=customer&countries=CZ`, { headers: { "x-test-user": person } })).status, 400);
  } finally {
    if (server) await new Promise<void>(resolve => server.close(resolve));
    await db.delete(tasks).where(inArray(tasks.id, [task, ...fixtureTasks]));
    await db.delete(clinicRepresentativeAssignments).where(eq(clinicRepresentativeAssignments.clinicId, clinic));
    await db.delete(hospitalRepresentativeAssignments).where(eq(hospitalRepresentativeAssignments.hospitalId, hospital));
    await db.delete(clinics).where(eq(clinics.id, clinic));
    await db.delete(hospitals).where(eq(hospitals.id, hospital));
    await db.delete(customers).where(inArray(customers.id, [customer, foreignCustomer]));
    await db.delete(userRoles).where(inArray(userRoles.userId, [admin, person, foreign]));
    await db.delete(users).where(inArray(users.id, [admin, person, foreign]));
    if (createdRole && repRole) await db.delete(roles).where(eq(roles.id, repRole));
    await pool.end();
  }
});
