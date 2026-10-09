import { and, eq, ilike, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import {
  tasks, customers, hospitals, clinics, invoices, collections, collaborators,
  contractInstances, campaigns, products, users, departments, collectionStatuses,
} from "@shared/schema";
import {
  UPDATE_RECORD_ENTITIES, UPDATE_RECORD_RELATIONS, updateRecordIssues,
  type UpdateRecordConfig,
} from "../../shared/automation-update-record";
import { userMayAccessTaskCountry } from "./task-contract";

export const updateRecordTables: Record<string, any> = {
  task: tasks, customer: customers, hospital: hospitals, clinic: clinics, invoice: invoices,
  collection: collections, collaborator: collaborators, contract: contractInstances,
  campaign: campaigns, product: products,
};
const tables = updateRecordTables;
const names: Record<string, string[]> = {
  task: ["title"], customer: ["firstName", "lastName"], hospital: ["name"], clinic: ["name", "doctorName"],
  invoice: ["invoiceNumber"], collection: ["cbuNumber", "clientFirstName", "clientLastName"],
  collaborator: ["firstName", "lastName"], contract: ["contractNumber"], campaign: ["name"], product: ["name"],
};
type Owner = { id: string; role?: string | null; assignedCountries?: string[] | null; isActive?: boolean | null };
const isAdmin = (owner: Owner) => ["admin", "superadmin", "owner"].includes(String(owner.role).toLowerCase());
const permittedCountry = (owner: Owner, country: string | null) =>
  owner.isActive !== false && (country ? userMayAccessTaskCountry(owner.role || "", owner.assignedCountries || [], country) : isAdmin(owner));
function scopeCountries(owner: Owner, countries?: string[] | null): string[] | undefined {
  const requested = (countries || []).filter(Boolean);
  const permitted = isAdmin(owner) ? undefined : owner.assignedCountries || [];
  if (requested.some(country => !permittedCountry(owner, country))) throw new Error("Country access denied");
  return requested.length ? requested : permitted;
}
export function countryExpression(type: string, table: any) {
  if (type === "invoice" || type === "contract")
    return sql<string>`(select country from customers where customers.id = ${table.customerId})`;
  return table.countryCode || table.country || sql<string>`null`;
}
export function scopePredicate(type: string, table: any, owner: Owner, countries?: string[] | null) {
  const scoped = scopeCountries(owner, countries);
  if (type === "product" || type === "campaign") {
    // These settings affect a shared product/Mission, not a single country's card.
    if (!isAdmin(owner)) throw new Error("Shared configuration requires administrator access");
    return undefined;
  }
  return scoped ? inArray(countryExpression(type, table), scoped) : undefined;
}
export function labelExpression(type: string, table: any) {
  const columns = (names[type] || []).filter(key => table[key]).map(key => sql`coalesce(${table[key]}::text, '')`);
  return sql<string>`trim(concat_ws(' ', ${sql.join(columns, sql`, `)}))`;
}
export async function updateRecordOwner(id: string): Promise<Owner> {
  const [owner] = await db.select({
    id: users.id, role: users.role, assignedCountries: users.assignedCountries, isActive: users.isActive,
  }).from(users).where(eq(users.id, id));
  if (!owner || owner.isActive !== true || !["admin", "superadmin", "owner", "manager"].includes(String(owner.role).toLowerCase()))
    throw new Error("Rule owner is not authorized");
  return owner;
}
export async function searchUpdateRecords(type: string, q: string, owner: Owner, countries?: string[] | null, includeFinalContracts = false) {
  if (type === "user" || type === "department") {
    const { options } = await updateRecordOptions("task", type === "user" ? "assignedUserId" : "assignedDepartmentId", q, owner, countries);
    return { records: options.slice(0, 20).map(option => ({ id: String(option.value), label: option.label, secondary: "", country: null })), truncated: options.length > 20 };
  }
  const table = tables[type];
  if (!Object.hasOwn(tables, type)) throw new Error("Unsupported entity");
  const label = labelExpression(type, table);
  const query = q.trim().slice(0, 100).replace(/[\\%_]/g, "\\$&");
  const rows = await db.select({
    id: table.id, label, country: countryExpression(type, table),
    secondary: type === "collection" ? table.cbuNumber
      : table.city || table.contractNumber || table.invoiceNumber || sql<string>`''`,
  }).from(table).where(and(scopePredicate(type, table, owner, countries),
    type === "contract" && !includeFinalContracts ? eq(table.status, "draft") : undefined, query ? ilike(label, `%${query}%`) : undefined))
    .orderBy(label, table.id).limit(21);
  return { records: rows.slice(0, 20).map(row => ({ ...row, label: row.label || type })), truncated: rows.length > 20 };
}
export async function readUpdateRecord(type: string, id: string, owner: Owner, countries?: string[] | null): Promise<Record<string, any>> {
  if (type === "user" || type === "department") {
    scopeCountries(owner, countries);
    if (type === "user") {
      const [row] = await db.select({ id: users.id, fullName: users.fullName, role: users.role, assignedCountries: users.assignedCountries })
        .from(users).where(and(eq(users.id, id), eq(users.isActive, true)));
      if (!row || (scopeCountries(owner, countries) || []).some(country =>
        !userMayAccessTaskCountry(row.role || "", row.assignedCountries || [], country))) throw new Error("User unavailable");
      return row;
    }
    const [row] = await db.select({ id: departments.id, name: departments.name }).from(departments)
      .where(and(eq(departments.id, id), eq(departments.isActive, true)));
    if (!row) throw new Error("Department unavailable");
    return row;
  }
  const table = tables[type];
  if (!Object.hasOwn(tables, type) || !id || id.length > 200) throw new Error("Invalid target");
  const [row] = await db.select().from(table).where(and(eq(table.id, id), scopePredicate(type, table, owner, countries))).limit(1);
  if (!row) throw new Error("Record unavailable or outside permitted countries");
  return row as Record<string, any>;
}
export function publicUpdateRecord(type: string, row: Record<string, any>) {
  const label = (names[type] || (type === "user" ? ["fullName"] : ["name"])).map(key => row[key]).filter(Boolean).join(" ") || type;
  const values = Object.fromEntries((UPDATE_RECORD_ENTITIES[type] || []).map(field => [field.key, row[field.key] ?? null]));
  return { record: { id: row.id, label, secondary: row.city || "", country: row.countryCode || row.country || null }, values };
}
export async function updateRecordOptions(type: string, key: string, q: string, owner: Owner, countries?: string[] | null) {
  const field = UPDATE_RECORD_ENTITIES[type]?.find(item => item.key === key);
  if (!field) throw new Error("Unsupported field");
  if (field.options) return { options: field.options.map(value => ({ value, label: value })) };
  if (field.reference === "collection_status") {
    const rows = await db.select({ value: collectionStatuses.id, label: collectionStatuses.name }).from(collectionStatuses)
      .orderBy(collectionStatuses.sortOrder);
    return { options: rows };
  }
  if (field.reference === "department") {
    const options = await db.select({ value: departments.id, label: departments.name }).from(departments)
      .where(and(eq(departments.isActive, true), q ? ilike(departments.name, `%${q.slice(0, 100)}%`) : undefined)).limit(100);
    return { options };
  }
  if (field.reference === "user") {
    const countriesScope = scopeCountries(owner, countries);
    const rows = await db.select({
      value: users.id, label: users.fullName, countries: users.assignedCountries, role: users.role,
    }).from(users).where(and(eq(users.isActive, true), q ? ilike(users.fullName, `%${q.slice(0, 100)}%`) : undefined)).limit(100);
    return { options: rows.filter(row => !countriesScope || countriesScope.every(country =>
      userMayAccessTaskCountry(row.role || "", row.countries || [], country))).map(({ value, label }) => ({ value, label })) };
  }
  return { options: [] };
}

export async function validateSavedUpdateRecord(config: any, module: string, owner: Owner, countries?: string[] | null) {
  const issues = updateRecordIssues(config, module);
  if (issues.length) throw new Error(`Invalid Update record: ${issues.join(", ")}`);
  scopeCountries(owner, countries);
  if (config.target.mode === "selected") {
    const target = await readUpdateRecord(config.target.entityType, config.target.recordId, owner, countries);
    if (config.target.entityType === "contract" && target.status !== "draft")
      throw new Error("Only draft contracts can be changed");
  }
  for (const field of UPDATE_RECORD_ENTITIES[config.target.entityType]) {
    const value = config.fields[field.key];
    if (value != null && field.kind === "reference" && !(typeof value === "string" && value.includes("{{"))) {
      const options = field.reference === "collection_status"
        ? await updateRecordOptions(config.target.entityType, field.key, "", owner, countries) : { options: [] };
      // Validate the exact identity independently of a bounded picker result.
      if (field.reference === "user") {
        const [user] = await db.select().from(users).where(eq(users.id, String(value)));
        if (!user || user.isActive === false || (countries || []).some(country =>
          !userMayAccessTaskCountry(user.role || "", user.assignedCountries || [], country))) throw new Error(`Unavailable value: ${field.key}`);
      } else if (field.reference === "department") {
        const [department] = await db.select({ id: departments.id }).from(departments).where(and(eq(departments.id, String(value)), eq(departments.isActive, true)));
        if (!department) throw new Error(`Unavailable value: ${field.key}`);
      } else if (!options.options.some(option => String(option.value) === String(value))) {
        throw new Error(`Unavailable value: ${field.key}`);
      }
    }
  }
}

/** Resolve relationships from the current persisted source, never browser payloads. */
export async function resolveUpdateRecord(config: Pick<UpdateRecordConfig, "target">, ctx: any, owner: Owner, includeFinalContracts = false) {
  const target = config.target;
  const countries = ctx.rule?.countryCodes || (ctx.rule?.countryCode ? [ctx.rule.countryCode] : null);
  let id = target.recordId;
  if (target.mode === "event") {
    if (ctx.event?.entityType !== target.entityType) throw new Error("Event target does not match");
    id = ctx.event?.entityId;
  } else if (target.mode === "related") {
    const sourceType = ctx.event?.entityType;
    const relation = (UPDATE_RECORD_RELATIONS[sourceType] || []).find(item => item.key === target.relation);
    if (!relation) throw new Error("Unsupported relationship");
    const source = await readUpdateRecord(sourceType, ctx.event?.entityId, owner, countries);
    if (relation.entityType === "dynamic" && source.relatedEntityType !== target.entityType)
      throw new Error("Linked record type does not match");
    id = source[relation.key];
  }
  if (!id) throw new Error("Target record or relationship is missing");
  const row = await readUpdateRecord(target.entityType, id, owner, countries);
  const table = tables[target.entityType];
  const [countryRow] = await db.select({ country: countryExpression(target.entityType, table) }).from(table).where(eq(table.id, id));
  const targetCountry = countryRow?.country;
  if (ctx.event?.countryCode && targetCountry && ctx.event.countryCode !== targetCountry)
    throw new Error("Target country differs from the event");
  if (!includeFinalContracts && target.entityType === "contract" && row.status !== "draft") throw new Error("Only draft contracts can be changed");
  return { row, countries, targetCountry };
}

export async function executeUpdateRecord(config: UpdateRecordConfig, ctx: any) {
  const ownerId = ctx.rule?.createdByUserId;
  if (!ownerId) throw new Error("Rule owner is required");
  const owner = await updateRecordOwner(ownerId);
  await validateSavedUpdateRecord(config, ctx.event?.module, owner, ctx.rule?.countryCodes || (ctx.rule?.countryCode ? [ctx.rule.countryCode] : null));
  const { row, countries, targetCountry } = await resolveUpdateRecord(config, ctx, owner);
  const fields: Record<string, unknown> = {};
  for (const [key, input] of Object.entries(config.fields)) {
    let value = input;
    if (typeof input === "string" && /^{{/.test(input)) {
      const match = /^{{\s*(newValues|oldValues)\.([A-Za-z][A-Za-z0-9]*)\s*}}$/.exec(input);
      if (!match || !Object.hasOwn(ctx[match[1]] || {}, match[2])) throw new Error(`Unresolved value: ${key}`);
      value = ctx[match[1]][match[2]];
    }
    fields[key] = value;
  }
  const resolved = { ...config, fields };
  const issues = updateRecordIssues(resolved, ctx.event?.module, false);
  if (issues.length) throw new Error(`Invalid resolved values: ${issues.join(", ")}`);
  await validateSavedUpdateRecord(resolved, ctx.event?.module, owner, targetCountry ? [targetCountry] : countries);
  const type = config.target.entityType;
  if (type === "contract" && ("validFrom" in fields || "validTo" in fields)) {
    const from = Object.hasOwn(fields, "validFrom") ? fields.validFrom : row.validFrom;
    const to = Object.hasOwn(fields, "validTo") ? fields.validTo : row.validTo;
    if (from && to && Date.parse(String(from)) > Date.parse(String(to)))
      throw new Error("Contract validity end cannot precede its start");
  }
  const safe: Record<string, any> = { ...fields };
  for (const field of UPDATE_RECORD_ENTITIES[type]) {
    if (field.kind === "date" && safe[field.key] != null && !["validFrom", "validTo"].includes(field.key))
      safe[field.key] = new Date(safe[field.key]);
  }
  let updated;
  if (type === "task") {
    updated = (await storage.updateTaskWithActor(row.id, safe, owner.id))?.task;
  } else {
    const table = tables[type];
    const guards = [eq(table.id, row.id), scopePredicate(type, table, owner, countries)];
    if (targetCountry) guards.push(sql`${countryExpression(type, table)} = ${targetCountry}`);
    // PostgreSQL's microsecond timestamp is truncated when read as a JS Date;
    // compare the fields being changed instead of a lossy updatedAt round-trip.
    for (const key of Object.keys(fields)) guards.push(sql`${table[key]} is not distinct from ${row[key] ?? null}`);
    if (type === "contract") guards.push(eq(table.status, "draft"));
    // A guarded single write prevents changing a record whose scope changed after resolution.
    if (table.updatedAt) safe.updatedAt = new Date();
    [updated] = await db.update(table).set(safe).where(and(...guards)).returning();
  }
  if (!updated) throw new Error("Record changed or became unavailable; no update applied");
  return { before: row, after: updated, entityType: type, entityId: row.id, fields: Object.keys(fields) };
}

export function registerUpdateRecordRoutes(app: any, requireDesigner: any) {
  const ownerAndScope = async (req: any) => ({
    owner: await updateRecordOwner(req.session.user.id),
    countries: typeof req.query.countries === "string" ? req.query.countries.split(",").filter(Boolean) : null,
  });
  const route = (path: string, handler: (req: any) => Promise<any>) =>
    app.get(`/api/automation/update-record/${path}`, requireDesigner, async (req: any, res: any) => {
      try { res.json(await handler(req)); } catch { res.status(400).json({ error: "Update record selection unavailable" }); }
    });
  route("catalog", async req => {
    await ownerAndScope(req);
    return { entities: Object.entries(UPDATE_RECORD_ENTITIES).map(([value, fields]) => ({ value, fields })), relations: UPDATE_RECORD_RELATIONS };
  });
  route("records", async req => {
    const { owner, countries } = await ownerAndScope(req);
    return searchUpdateRecords(String(req.query.entityType || ""), String(req.query.q || ""), owner, countries);
  });
  route("record", async req => {
    const { owner, countries } = await ownerAndScope(req);
    const type = String(req.query.entityType || "");
    const row = await readUpdateRecord(type, String(req.query.id || ""), owner, countries);
    if (type === "contract" && row.status !== "draft") throw new Error("Contract is no longer a draft");
    return publicUpdateRecord(type, row);
  });
  route("options", async req => {
    const { owner, countries } = await ownerAndScope(req);
    return updateRecordOptions(String(req.query.entityType || ""), String(req.query.field || ""), String(req.query.q || ""), owner, countries);
  });
}

/** Emit a minimal persisted snapshot, not private collection/person payloads. */
export async function emitUpdateRecordLifecycle(type: string, after: any, before?: any) {
  if (!after) return;
  const { emitEntityCreated, emitEntityUpdated } = await import("./event-bus");
  const snapshot = (row: any) => row ? Object.fromEntries([
    ["id", row.id], ["countryCode", row.countryCode || row.country || null],
    ["tags", row.tags || []],
    ...UPDATE_RECORD_ENTITIES[type].map(field => [field.key, row[field.key]]),
    ...(UPDATE_RECORD_RELATIONS[type] || []).map(relation => [relation.key, row[relation.key]]),
  ]) : undefined;
  if (before) await emitEntityUpdated(type, type, after.id, snapshot(before), snapshot(after), undefined, after.countryCode || null);
  else await emitEntityCreated(type, type, after.id, snapshot(after), undefined, after.countryCode || null);
}
