import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { tasks, users, customers, roles, userRoles, clinics, hospitals,
  clinicRepresentativeAssignments, hospitalRepresentativeAssignments } from "@shared/schema";
import { assignmentField, assignOwnerIssues, type AssignOwnerConfig } from "../../shared/automation-assign-owner";
import { assignMedicalPartnerRepresentative } from "./representative-assignment";
import { UPDATE_RECORD_RELATIONS } from "../../shared/automation-update-record";
import { updateRecordTables, updateRecordOwner, readUpdateRecord, resolveUpdateRecord, countryExpression, scopePredicate } from "./automation-update-record";
import { userMayAccessTaskCountry } from "./task-contract";
import { assertTaskRecipientAllowed, taskAssignmentAllowlist } from "./task-assignment-access";
import { taskEventCountry } from "./event-bus";

type Owner = Awaited<ReturnType<typeof updateRecordOwner>>;
const cursors = new Map<string, number>();
const queues = new Map<string, Promise<unknown>>();
function personalTask(row: any) {
  return !row.assignedDepartmentId && !(row.tags || []).some((tag: string) => /^(group_id:|group:)/.test(tag));
}
async function lockedTaskCountry(executor: any, row: any) {
  const links = [{ type: "customer", id: row.customerId }, { type: row.relatedEntityType, id: row.relatedEntityId }];
  for (const link of links) if (link.id && ["customer", "hospital", "clinic", "collaborator"].includes(link.type)) {
    const table = updateRecordTables[link.type];
    const [source] = await executor.select({ country: countryExpression(link.type, table) })
      .from(table).where(eq(table.id, link.id)).for("share");
    if (source?.country) return source.country;
  }
  return row.country || null;
}
async function recipients(executor: any, ids: string[], countries: string[], type: string, kind = "owner") {
  const rows = await executor.select({
    id: users.id, role: users.role, roleId: users.roleId, assignedCountries: users.assignedCountries, isActive: users.isActive,
  }).from(users).where(inArray(users.id, ids)).for("share");
  if (rows.length !== ids.length || rows.some((row: any) => !row.isActive ||
    countries.some(country => !userMayAccessTaskCountry(row.role, row.assignedCountries, country))))
    throw new Error("A selected owner is inactive or not authorized for the record country");
  if (type === "task") for (const id of ids) await assertTaskRecipientAllowed(executor, id, countries[0] || null);
  if (kind === "representative") {
    const repRoles = await executor.select({ id: roles.id }).from(roles)
      .where(and(eq(roles.isActive, true), sql`lower(${roles.name}) in ('representant', 'representative')`)).for("share");
    const roleIds: string[] = repRoles.map((row: any) => row.id);
    if (!roleIds.length) throw new Error("No representative roles are configured");
    const memberships = await executor.select({ userId: userRoles.userId }).from(userRoles)
      .where(and(inArray(userRoles.userId, ids), inArray(userRoles.roleId, roleIds))).for("share");
    if (rows.some((row: any) => !roleIds.includes(row.roleId) && !memberships.some((membership: any) => membership.userId === row.id)))
      throw new Error("A selected person is not an active business representative");
  }
}
export async function validateSavedAssignOwner(config: any, module: string, owner: Owner, countries?: string[] | null) {
  if (assignOwnerIssues(config, module).length) throw new Error("Review the owner target, selected people and confirmation");
  let targetCountries = countries?.length ? countries :
    ["admin", "superadmin", "owner"].includes((owner.role || "").toLowerCase()) ? [] : owner.assignedCountries || [];
  if (config.target.mode === "selected") {
    const row = await readUpdateRecord(config.target.entityType, config.target.recordId, owner, countries);
    if (config.target.entityType === "task" && !personalTask(row)) throw new Error("A shared task cannot be converted to a personal assignment");
    const country = config.target.entityType === "task" ? await taskEventCountry(row) : row.country || row.countryCode;
    if (country) targetCountries = [country];
  }
  await recipients(db, config.userIds, targetCountries, config.target.entityType, config.assignmentKind);
}
/** Serialize each rule's pool in this process; successful round-robin positions reset on restart. */
export async function executeAssignOwner(config: AssignOwnerConfig, ctx: any) {
  const key = `${ctx.rule?.id || ctx.rule?.createdByUserId}:${config.assignmentKind || "owner"}:${config.target?.entityType}:${config.userIds?.join(",")}`;
  const previous = queues.get(key) || Promise.resolve();
  const running = previous.catch(() => undefined).then(async () => {
    const owner = await updateRecordOwner(ctx.rule?.createdByUserId || "");
    const countries = ctx.rule?.countryCodes || (ctx.rule?.countryCode ? [ctx.rule.countryCode] : null);
    await validateSavedAssignOwner(config, ctx.event?.module, owner, countries);
    const resolved = await resolveUpdateRecord(config, ctx, owner);
    const type = config.target.entityType;
    const table = updateRecordTables[type], field = assignmentField(config)!;
    const targetCountry = type === "task" ? await taskEventCountry(resolved.row) : resolved.targetCountry;
    if (targetCountry && ((countries?.length && !countries.includes(targetCountry)) ||
      (!["admin", "superadmin", "owner"].includes((owner.role || "").toLowerCase()) &&
        !userMayAccessTaskCountry(owner.role || "", owner.assignedCountries, targetCountry))))
      throw new Error("Target country is outside the rule scope");
    const result = await db.transaction(async tx => {
      if (config.target.mode === "related") {
        const sourceType = ctx.event.entityType, sourceTable = updateRecordTables[sourceType];
        const relation = (UPDATE_RECORD_RELATIONS[sourceType] || []).find(item => item.key === config.target.relation)!;
        const [source] = await tx.select().from(sourceTable).where(and(eq(sourceTable.id, ctx.event.entityId),
          scopePredicate(sourceType, sourceTable, owner, countries))).for("share");
        if (!source || source[relation.key] !== resolved.row.id ||
          (relation.entityType === "dynamic" && source.relatedEntityType !== type))
          throw new Error("The linked record changed; no owner was assigned");
      }
      const [before] = await tx.select().from(table).where(and(eq(table.id, resolved.row.id),
        scopePredicate(type, table, owner, countries))).for("update");
      if (!before) throw new Error("Record is no longer available");
      if (type === "task" && !personalTask(before)) throw new Error("Shared group and department tasks keep their routing");
      const currentCountry = type === "task" ? await lockedTaskCountry(tx, before) : before.country || before.countryCode;
      if ((currentCountry || null) !== (targetCountry || null)) throw new Error("Record country changed");
      await recipients(tx, config.userIds, targetCountry ? [targetCountry] : countries || [], type, config.assignmentKind);
      const repTable = type === "clinic" ? clinicRepresentativeAssignments : hospitalRepresentativeAssignments;
      const repKey = type === "clinic" ? clinicRepresentativeAssignments.clinicId : hospitalRepresentativeAssignments.hospitalId;
      const active = config.assignmentKind === "representative" ? await tx.select().from(repTable)
        .where(and(eq(repKey, before.id), isNull(repTable.validTo))).for("update") : [];
      if (!config.replaceExisting && (config.assignmentKind === "representative" ? active.length || before[field] : before[field]))
        return { before, after: before, changed: false, reason: "already_assigned" };
      let chosen = config.userIds[0];
      if (config.strategy === "random") chosen = config.userIds[Math.floor(Math.random() * config.userIds.length)];
      if (config.strategy === "round_robin") chosen = config.userIds[(cursors.get(key) || 0) % config.userIds.length];
      if (config.strategy === "least_loaded") {
        const partnerTable = type === "clinic" ? clinics : hospitals;
        const rows = config.assignmentKind === "representative" ? await tx.select({
          id: repTable.userId, count: sql<number>`count(distinct ${repKey})::int`,
        }).from(repTable).innerJoin(partnerTable, eq(partnerTable.id, repKey))
          .where(and(inArray(repTable.userId, config.userIds), isNull(repTable.validTo),
            targetCountry ? eq(partnerTable.countryCode, targetCountry) : undefined)).groupBy(repTable.userId)
          : await tx.select({ id: tasks.assignedUserId, count: sql<number>`count(*)::int` }).from(tasks)
          .where(and(inArray(tasks.assignedUserId, config.userIds), inArray(tasks.status, ["pending", "in_progress"]),
            sql`${tasks.assignedDepartmentId} is null`,
            sql`not exists (select 1 from unnest(${tasks.tags}) t(tag) where t.tag like 'group_id:%' or t.tag like 'group:%')`,
            targetCountry ? sql`coalesce(
              (select c.country from customers c where c.id = ${tasks.customerId}),
              case ${tasks.relatedEntityType}
                when 'customer' then (select c.country from customers c where c.id = ${tasks.relatedEntityId})
                when 'hospital' then (select h.country_code from hospitals h where h.id = ${tasks.relatedEntityId})
                when 'clinic' then (select c.country_code from clinics c where c.id = ${tasks.relatedEntityId})
                when 'collaborator' then (select c.country_code from collaborators c where c.id = ${tasks.relatedEntityId})
              end, ${tasks.country}) = ${targetCountry}` : undefined)).groupBy(tasks.assignedUserId);
        const counts = new Map(rows.map(row => [row.id, Number(row.count)]));
        chosen = [...config.userIds].sort((a, b) => (counts.get(a) || 0) - (counts.get(b) || 0) ||
          config.userIds.indexOf(a) - config.userIds.indexOf(b))[0];
      }
      if (config.assignmentKind === "representative") {
        const result = await assignMedicalPartnerRepresentative(tx, {
          entityType: type as "clinic" | "hospital", entityId: before.id, userId: chosen,
          assignedBy: owner.id, assignmentType: "automation",
        });
        return { ...result, assignedTo: chosen };
      }
      if (before[field] === chosen) return { before, after: before, changed: false, reason: "same_owner" };
      const [after] = await tx.update(table).set({ [field]: chosen, ...(table.updatedAt ? { updatedAt: new Date() } : {}) })
        .where(eq(table.id, before.id)).returning();
      return { before, after, changed: true, assignedTo: chosen };
    });
    if (result.changed && config.strategy === "round_robin") cursors.set(key, (cursors.get(key) || 0) + 1);
    return { ...result, entityType: type, entityId: resolved.row.id };
  });
  queues.set(key, running);
  try { return await running; } finally { if (queues.get(key) === running) queues.delete(key); }
}

export function registerAssignOwnerRoutes(app: any, requireDesigner: any, requireAuth: any) {
  app.get("/api/automation/assign-owner/people", requireDesigner, async (req: any, res: any) => {
    try {
      const owner = await updateRecordOwner(req.session.user.id);
      const type = String(req.query.entityType || "");
      const kind = String(req.query.assignmentKind || (type === "clinic" ? "representative" : "owner"));
      if (!assignmentField({ target: { entityType: type }, assignmentKind: kind })) throw new Error("Unsupported owner type");
      const countries: string[] = typeof req.query.countries === "string" ? req.query.countries.split(",").filter(Boolean) : [];
      scopePredicate("customer", customers, owner, countries); // Validate requested country scope before lookup.
      const scoped = countries.length ? countries : ["admin", "superadmin", "owner"].includes((owner.role || "").toLowerCase())
        ? [] : owner.assignedCountries || [];
      if (!scoped.length && !["admin", "superadmin", "owner"].includes((owner.role || "").toLowerCase()))
        throw new Error("No authorized country scope");
      const id = typeof req.query.id === "string" ? req.query.id : "";
      const q = String(req.query.q || "").trim().slice(0, 100).replace(/[\\%_]/g, "\\$&");
      const rows = await db.select({ value: users.id, label: users.fullName, role: users.role, countries: users.assignedCountries })
        .from(users).where(and(eq(users.isActive, true), id ? eq(users.id, id) : undefined,
          kind === "representative" ? sql`exists (
            select 1 from roles r where r.is_active = true and lower(r.name) in ('representant', 'representative')
              and (r.id = ${users.roleId} or exists
                (select 1 from user_roles ur where ur.user_id = ${users.id} and ur.role_id = r.id))
          )` : undefined,
          q ? sql`${users.fullName} ilike ${`%${q}%`}` : undefined)).orderBy(users.fullName, users.id).limit(101);
      const allowlist = type === "task" ? await taskAssignmentAllowlist(db) : null;
      const options = rows.filter(row => scoped.every(country => userMayAccessTaskCountry(row.role || "", row.countries, country)) &&
        (!allowlist?.configured || allowlist.allowedUserIds.includes(row.value))).slice(0, 100)
        .map(({ value, label }) => ({ value, label }));
      res.json({ options, truncated: rows.length > 100 });
    } catch { res.status(400).json({ error: "Owner selection unavailable" }); }
  });
  app.get("/api/customers/:id/owner", requireAuth, async (req: any, res: any) => {
    try {
      const [owner] = await db.select({ id: users.id, role: users.role, assignedCountries: users.assignedCountries, isActive: users.isActive })
        .from(users).where(eq(users.id, req.session.user.id));
      if (!owner?.isActive) return res.status(403).json({ error: "Record unavailable" });
      const [record] = await db.select({ userId: customers.assignedUserId }).from(customers)
        .where(and(eq(customers.id, req.params.id), scopePredicate("customer", customers, owner)));
      if (!record) return res.status(404).json({ error: "Record unavailable" });
      const [person] = record.userId ? await db.select({ name: users.fullName }).from(users).where(eq(users.id, record.userId)) : [];
      res.json({ name: person?.name || null });
    } catch { res.status(404).json({ error: "Record unavailable" }); }
  });
}
