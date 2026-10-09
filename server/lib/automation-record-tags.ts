import { and, eq, ilike, sql } from "drizzle-orm";
import { db } from "../db";
import { users } from "@shared/schema";
import {
  RECORD_TAG_ENTITY_TYPES, normalizeTagName, tagKey, isProtectedRecordTag, visibleRecordTags,
  tagActionIssues, type RecordTagActionConfig,
  PROTECTED_RECORD_TAG_NAMES, PROTECTED_RECORD_TAG_PREFIXES,
} from "../../shared/automation-record-tags";
import { UPDATE_RECORD_RELATIONS } from "../../shared/automation-update-record";
import { userMayAccessTaskCountry } from "./task-contract";
import {
  updateRecordTables, updateRecordOwner, readUpdateRecord, resolveUpdateRecord, searchUpdateRecords,
  publicUpdateRecord, countryExpression, scopePredicate, labelExpression,
} from "./automation-update-record";

type Owner = Awaited<ReturnType<typeof updateRecordOwner>>;
function recordTable(type: string) {
  if (!RECORD_TAG_ENTITY_TYPES.includes(type)) throw new Error("Unsupported record type");
  return updateRecordTables[type];
}
function tagReadPredicate(type: string, table: any, owner: Owner, requested?: string[] | null) {
  if (owner.isActive === false) throw new Error("Record unavailable");
  const admin = ["admin", "superadmin", "owner"].includes(String(owner.role).toLowerCase());
  if ((requested || []).some(country => !userMayAccessTaskCountry(owner.role || "", owner.assignedCountries || [], country)))
    throw new Error("Country access denied");
  const countries = requested?.length ? requested : owner.assignedCountries || [];
  if (type === "product") return undefined; // Shared catalog labels, not price/configuration access.
  if (type === "campaign") return admin && !requested?.length ? undefined : countries.length
    ? sql`${table.countryCodes} && ARRAY[${sql.join(countries.map(value => sql`${value}`), sql`, `)}]::text[]` : sql`false`;
  const scope = scopePredicate(type, table, owner, requested);
  if (type === "task" && scope) return sql`(${scope} or ${countryExpression(type, table)} is null)`;
  return scope;
}
export async function validateSavedTagAction(config: any, module: string, owner: Owner, countries?: string[] | null) {
  if (tagActionIssues(config, module).length) throw new Error("Review the tag action target and tag names");
  if (config.target.mode === "selected")
    await readUpdateRecord(config.target.entityType, config.target.recordId, owner, countries);
}
export function mergeRecordTags(existing: string[], requested: string[], mode: "add" | "remove") {
  const wanted = new Set(requested.map(tagKey));
  if (mode === "remove") return existing.filter(tag => isProtectedRecordTag(tag) || !wanted.has(tagKey(tag)));
  const result = [...existing], keys = new Set(existing.map(tagKey));
  for (const tag of requested.map(normalizeTagName)) if (!keys.has(tagKey(tag))) {
    keys.add(tagKey(tag)); result.push(tag);
  }
  return result;
}
export async function executeRecordTagAction(config: RecordTagActionConfig, ctx: any, mode: "add" | "remove") {
  const owner = await updateRecordOwner(ctx.rule?.createdByUserId || "");
  const countries = ctx.rule?.countryCodes || (ctx.rule?.countryCode ? [ctx.rule.countryCode] : null);
  await validateSavedTagAction(config, ctx.event?.module, owner, countries);
  const resolved = await resolveUpdateRecord(config, ctx, owner, true);
  const type = config.target.entityType, table = recordTable(type);
  const result = await db.transaction(async tx => {
    // Lock the persisted relationship so it cannot silently move while its target is tagged.
    if (config.target.mode === "related") {
      const sourceType = ctx.event.entityType, sourceTable = recordTable(sourceType);
      const relation = (UPDATE_RECORD_RELATIONS[sourceType] || []).find(item => item.key === config.target.relation)!;
      const [source] = await tx.select().from(sourceTable).where(and(
        eq(sourceTable.id, ctx.event.entityId), scopePredicate(sourceType, sourceTable, owner, countries),
      )).for("share");
      if (!source || source[relation.key] !== resolved.row.id ||
        (relation.entityType === "dynamic" && source.relatedEntityType !== type))
        throw new Error("The linked record changed; no tag was changed");
    }
    const predicate = and(eq(table.id, resolved.row.id), scopePredicate(type, table, owner, countries),
      resolved.targetCountry ? sql`${countryExpression(type, table)} = ${resolved.targetCountry}` : undefined);
    const [before] = await tx.select().from(table).where(predicate).for("update");
    if (!before) throw new Error("Record is no longer available; no tag was changed");
    const oldTags = Array.isArray(before.tags) ? before.tags as string[] : [];
    const tags = mergeRecordTags(oldTags, config.tags, mode);
    if (visibleRecordTags(tags).length > 100) throw new Error("A record can have at most 100 organizational tags");
    if (JSON.stringify(oldTags) === JSON.stringify(tags)) return { before, after: before, changed: false };
    const changes: any = { tags };
    if (table.updatedAt) changes.updatedAt = new Date();
    const [after] = await tx.update(table).set(changes).where(predicate).returning();
    if (!after) throw new Error("Record scope changed; no tag was changed");
    return { before, after, changed: true };
  });
  return { ...result, entityType: type, entityId: resolved.row.id, country: resolved.targetCountry,
    currentTags: visibleRecordTags(result.after.tags), requested: config.tags.map(normalizeTagName), mode };
}
const sqlTagKey = (value: any) =>
  sql`lower(regexp_replace(btrim(normalize(${value}, NFKC)), '[[:space:]]+', ' ', 'g'))`;
const humanSqlTag = (value: any) =>
  and(sql`${sqlTagKey(value)} <> ''`,
    ...PROTECTED_RECORD_TAG_NAMES.map(name => sql`${sqlTagKey(value)} <> ${name}`),
    ...PROTECTED_RECORD_TAG_PREFIXES.map(prefix =>
      sql`${sqlTagKey(value)} not like ${`${prefix.replace(/[\\%_]/gu, "\\$&")}%`}`))!;

export async function recordTagSuggestions(type: string, q: string, owner: Owner, countries?: string[] | null) {
  const table = recordTable(type), scope = tagReadPredicate(type, table, owner, countries);
  const rows = await db.execute(sql`
    select distinct t.tag from ${table} cross join lateral unnest(${table.tags}) as t(tag)
    where ${scope || sql`true`} and ${humanSqlTag(sql`t.tag`)}
      and ${q.trim() ? sql`${sqlTagKey(sql`t.tag`)} like ${`%${tagKey(q).replace(/[\\%_]/gu, "\\$&")}%`}` : sql`true`}
    order by t.tag limit 101`);
  return { tags: visibleRecordTags(rows.rows.map((row: any) => row.tag)).slice(0, 100),
    truncated: rows.rows.length > 100 };
}
export async function taggedRecords(type: string, tag: string, q: string, owner: Owner, countries?: string[] | null) {
  const table = recordTable(type);
  if (tag && (isProtectedRecordTag(tag) || normalizeTagName(tag).length > 64)) throw new Error("Invalid tag");
  const label = labelExpression(type, table), pattern = q.trim().slice(0, 100).replace(/[\\%_]/gu, "\\$&");
  const rows = await db.select({ id: table.id, label, country: countryExpression(type, table),
    tags: table.tags, secondary: table.city || table.cbuNumber || table.contractNumber || sql<string>`''` })
    .from(table).where(and(tagReadPredicate(type, table, owner, countries),
      sql`exists (select 1 from unnest(${table.tags}) as t(tag) where ${humanSqlTag(sql`t.tag`)}
        and ${tag ? sql`${sqlTagKey(sql`t.tag`)} = ${tagKey(tag)}` : sql`true`})`,
      pattern ? ilike(label, `%${pattern}%`) : undefined))
    .orderBy(label, table.id).limit(51);
  return { records: rows.slice(0, 50).map(row => ({ ...row, tags: visibleRecordTags(row.tags) })),
    truncated: rows.length > 50 };
}
export function registerRecordTagRoutes(app: any, requireDesigner: any, requireAuth: any) {
  const scope = async (req: any) => ({
    owner: await updateRecordOwner(req.session.user.id),
    countries: typeof req.query.countries === "string" ? req.query.countries.split(",").filter(Boolean) : null,
  });
  const route = (path: string, handler: (req: any) => Promise<any>) =>
    app.get(`/api/automation/record-tags/${path}`, requireDesigner, async (req: any, res: any) => {
      try { res.json(await handler(req)); } catch { res.status(400).json({ error: "Record tag selection unavailable" }); }
    });
  route("catalog", async req => {
    await scope(req);
    return { entities: RECORD_TAG_ENTITY_TYPES.map(value => ({ value })), relations: UPDATE_RECORD_RELATIONS };
  });
  route("records", async req => {
    const { owner, countries } = await scope(req);
    return searchUpdateRecords(String(req.query.entityType || ""), String(req.query.q || ""), owner, countries, true);
  });
  route("record", async req => {
    const { owner, countries } = await scope(req), type = String(req.query.entityType || "");
    recordTable(type);
    const row = await readUpdateRecord(type, String(req.query.id || ""), owner, countries);
    const [scopeRow] = await db.select({ country: countryExpression(type, recordTable(type)) })
      .from(recordTable(type)).where(eq(recordTable(type).id, row.id));
    return { record: { ...publicUpdateRecord(type, row).record, country: scopeRow?.country || null },
      tags: visibleRecordTags(row.tags) };
  });
  route("suggestions", async req => {
    const { owner, countries } = await scope(req);
    return recordTagSuggestions(String(req.query.entityType || ""), String(req.query.q || ""), owner, countries);
  });
  route("tagged", async req => {
    const { owner, countries } = await scope(req);
    return taggedRecords(String(req.query.entityType || ""), String(req.query.tag || ""), String(req.query.q || ""), owner, countries);
  });
  app.get("/api/record-tags/:entityType/:id", requireAuth, async (req: any, res: any) => {
    try {
      const [owner] = await db.select({ id: users.id, role: users.role, assignedCountries: users.assignedCountries,
        isActive: users.isActive }).from(users).where(eq(users.id, req.session.user.id));
      if (!owner?.isActive) return res.status(403).json({ error: "Record unavailable" });
      const type = String(req.params.entityType); recordTable(type);
      const table = recordTable(type), guard = tagReadPredicate(type, table, owner);
      const [row] = await db.select({ tags: table.tags }).from(table)
        .where(and(eq(table.id, String(req.params.id)), guard));
      if (!row) return res.status(404).json({ error: "Record unavailable" });
      res.json({ tags: visibleRecordTags(row.tags) });
    } catch { res.status(404).json({ error: "Record unavailable" }); }
  });
}
