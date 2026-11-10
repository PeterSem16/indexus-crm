import { createHash, randomUUID } from "node:crypto";

export class DistributionError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
export type DistributionInput = {
  entity: "clinic" | "hospital"; kind: "assign" | "departure" | "temporary";
  criteria?: unknown; fromUserId?: string; startsAt?: string; endsAt?: string;
  regions: { countryCode: string; region: string; userId: string }[];
};
export const regionKey = (country: string, region: string | null) => JSON.stringify([country, region || ""]);
export function tables(entity: string) {
  if (entity === "clinic") return { entity: "clinics", assignments: "clinic_representative_assignments", key: "clinic_id" };
  if (entity === "hospital") return { entity: "hospitals", assignments: "hospital_representative_assignments", key: "hospital_id" };
  throw new DistributionError("invalid");
}
export function parseDistributionInput(raw: any): DistributionInput {
  if (!raw || !["clinic", "hospital"].includes(raw.entity) || !["assign", "departure", "temporary"].includes(raw.kind))
    throw new DistributionError("invalid");
  if (!Array.isArray(raw.regions) || raw.regions.length > 500) throw new DistributionError("invalid");
  const seen = new Set<string>();
  for (const r of raw.regions) {
    if (!r || typeof r.countryCode !== "string" || typeof r.region !== "string" || typeof r.userId !== "string" || !r.userId.trim())
      throw new DistributionError("invalid");
    const key = regionKey(r.countryCode, r.region);
    if (seen.has(key)) throw new DistributionError("duplicate");
    seen.add(key);
  }
  if (raw.fromUserId !== undefined && (typeof raw.fromUserId !== "string" || !raw.fromUserId)) throw new DistributionError("invalid");
  if (raw.kind !== "assign" && !raw.fromUserId) throw new DistributionError("source");
  return { entity: raw.entity, kind: raw.kind, criteria: raw.criteria, fromUserId: raw.fromUserId,
    startsAt: raw.startsAt, endsAt: raw.endsAt, regions: raw.regions };
}
export function period(input: DistributionInput, now: Date) {
  const startsAt = input.kind === "temporary" && input.startsAt ? new Date(input.startsAt) : now;
  const endsAt = input.kind === "temporary" && input.endsAt ? new Date(input.endsAt) : null;
  if (input.kind === "temporary" && (
    (input.startsAt !== undefined && (typeof input.startsAt !== "string" || !/Z$/.test(input.startsAt)))
    || typeof input.endsAt !== "string" || !/Z$/.test(input.endsAt)
    || !Number.isFinite(startsAt.getTime()) || !endsAt || !Number.isFinite(endsAt.getTime())
    || startsAt.getTime() < now.getTime() - 60000 || endsAt <= startsAt || endsAt <= now
  )) throw new DistributionError("period");
  return { startsAt, endsAt };
}
export async function representativeUsers(client: any, scope?: string[]) {
  const { rows } = await client.query(`
    SELECT u.id,u.full_name AS name,u.is_active AS "isActive",u.assigned_countries AS countries,
      EXISTS(SELECT 1 FROM roles r WHERE lower(r.name) IN ('representant','representative')
        AND (r.id=u.role_id OR EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role_id=r.id))) AS eligible,
      (SELECT count(*)::int FROM clinic_representative_assignments a JOIN clinics e ON e.id=a.clinic_id
        WHERE a.user_id=u.id AND a.valid_to IS NULL AND ($1::text[] IS NULL OR e.country_code=ANY($1))) AS "clinicCount",
      EXISTS(SELECT 1 FROM representative_distribution_plans p
        JOIN representative_distribution_items i ON i.plan_id=p.id
        WHERE p.from_user_id=u.id AND i.status IN ('pending','active','conflict') AND
          ($1::text[] IS NULL
            OR (p.entity_type='clinic' AND EXISTS(SELECT 1 FROM clinics c WHERE c.id=i.entity_id AND c.country_code=ANY($1)))
            OR (p.entity_type='hospital' AND EXISTS(SELECT 1 FROM hospitals h WHERE h.id=i.entity_id AND h.country_code=ANY($1))))) AS "hasCoverage",
      (SELECT count(*)::int FROM hospital_representative_assignments a JOIN hospitals e ON e.id=a.hospital_id
        WHERE a.user_id=u.id AND a.valid_to IS NULL AND ($1::text[] IS NULL OR e.country_code=ANY($1))) AS "hospitalCount"
    FROM users u ORDER BY u.full_name,u.id`, [scope ?? null]);
  return rows.filter((u: any) => u.eligible || u.clinicCount || u.hospitalCount || u.hasCoverage);
}
export async function selectionRows(client: any, entity: string, ids: string[], fromUserId?: string) {
  const t = tables(entity);
  const { rows } = await client.query(`
    SELECT e.id,e.country_code AS "countryCode",COALESCE(e.region,'') AS region,
      a.id AS "assignmentId",a.user_id AS "userId",
      coverage.from_user_id AS "coveredOwner"
    FROM ${t.entity} e LEFT JOIN ${t.assignments} a ON a.${t.key}=e.id AND a.valid_to IS NULL
    LEFT JOIN LATERAL (
      SELECT i.from_user_id FROM representative_distribution_items i
      JOIN representative_distribution_plans p ON p.id=i.plan_id
      WHERE p.entity_type=$2 AND i.entity_id=e.id AND i.status IN ('active','conflict')
        AND i.temporary_assignment_id=a.id LIMIT 1
    ) coverage ON true
    WHERE e.id=ANY($1::varchar[]) ORDER BY e.id`, [ids, entity]);
  const unique = new Set(rows.map((r: any) => r.id));
  if (unique.size !== rows.length) throw new DistributionError("stale", 409);
  return rows.filter((r: any) => !fromUserId || r.userId === fromUserId || r.coveredOwner === fromUserId);
}
export function regionGroups(rows: any[]) {
  const groups = new Map<string, { countryCode: string; region: string; count: number }>();
  for (const r of rows) {
    const key = regionKey(r.countryCode, r.region);
    const group = groups.get(key) || { countryCode: r.countryCode, region: r.region, count: 0 };
    group.count++; groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => regionKey(a.countryCode, a.region).localeCompare(regionKey(b.countryCode, b.region)));
}
export async function buildDistribution(client: any, input: DistributionInput, rows: any[], actorId: string, now = new Date()) {
  const times = period(input, now);
  await client.query(`SELECT id FROM users WHERE id=ANY($1::varchar[]) ORDER BY id FOR SHARE`,
    [[...input.regions.map(r => r.userId), ...(input.fromUserId ? [input.fromUserId] : [])]]);
  const users = await representativeUsers(client);
  const source = users.find((u: any) => u.id === input.fromUserId);
  if (input.kind !== "assign" && (!source || (input.kind === "temporary" && (!source.isActive || !source.eligible))))
    throw new DistributionError("source");
  const map = new Map(input.regions.map(r => [regionKey(r.countryCode, r.region), r.userId]));
  const selected = rows.filter(r => map.has(regionKey(r.countryCode, r.region)));
  if (!selected.length) throw new DistributionError("empty");
  for (const r of selected) {
    const targetId = map.get(regionKey(r.countryCode, r.region))!;
    const target = users.find((u: any) => u.id === targetId);
    if (!target?.isActive || !target.eligible || (target.countries?.length && !target.countries.includes(r.countryCode))
      || (input.kind !== "assign" && targetId === input.fromUserId)) throw new DistributionError("target");
  }
  const changes = selected.filter(r => r.userId !== map.get(regionKey(r.countryCode, r.region)));
  if (input.kind === "temporary") {
    if (selected.some(r => r.userId !== input.fromUserId)) throw new DistributionError("overlap", 409);
    const overlap = await client.query(`
      SELECT 1 FROM representative_distribution_plans p
      JOIN representative_distribution_items i ON i.plan_id=p.id
      WHERE p.kind='temporary' AND p.starts_at<$2 AND p.ends_at>$1
        AND i.status IN ('pending','active')
        AND ((p.entity_type=$3 AND i.entity_id=ANY($4::varchar[])) OR p.from_user_id=ANY($5::varchar[]))
      LIMIT 1`, [times.startsAt, times.endsAt, input.entity, changes.map(r => r.id), [...map.values()]]);
    if (overlap.rows.length) throw new DistributionError("overlap", 409);
  } else {
    const absent = await client.query(`SELECT 1 FROM representative_distribution_plans p
      JOIN representative_distribution_items i ON i.plan_id=p.id
      WHERE p.kind='temporary' AND p.from_user_id=ANY($1::varchar[])
        AND p.starts_at<=$2 AND p.ends_at>$2 AND i.status IN ('pending','active') LIMIT 1`,
    [[...map.values()], now]);
    if (absent.rows.length) throw new DistributionError("target");
  }
  const fingerprint = createHash("sha256").update(JSON.stringify({
    actorId, input, rows: selected.map(r => [r.id, r.assignmentId, r.userId, r.coveredOwner, r.countryCode, r.region]),
  })).digest("hex");
  return { ...times, fingerprint, changes: changes.map(r => ({ ...r, toUserId: map.get(regionKey(r.countryCode, r.region))! })),
    affected: changes.length, unchanged: rows.length - changes.length, selected: selected.length, groups: regionGroups(selected) };
}
export async function saveDistribution(client: any, input: DistributionInput, built: Awaited<ReturnType<typeof buildDistribution>>, actorId: string) {
  const { rows: [plan] } = await client.query(`INSERT INTO representative_distribution_plans
    (entity_type,kind,from_user_id,starts_at,ends_at,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
  [input.entity, input.kind, input.fromUserId || null, built.startsAt, built.endsAt, actorId]);
  await client.query(`INSERT INTO representative_distribution_items
    (plan_id,entity_id,source_assignment_id,from_user_id,to_user_id)
    SELECT $1,x.id,x."assignmentId",x."userId",x."toUserId"
    FROM jsonb_to_recordset($2::jsonb) AS x(id varchar,"assignmentId" varchar,"userId" varchar,"toUserId" varchar)`,
  [plan.id, JSON.stringify(built.changes)]);
  return plan.id as string;
}

/** Caller owns the transaction and plan lock. No restoration ever overwrites a later human decision. */
export async function processDistribution(client: any, planId: string, now = new Date(), actorOverride?: string) {
  const { rows: [plan] } = await client.query(`SELECT * FROM representative_distribution_plans WHERE id=$1 FOR UPDATE`, [planId]);
  if (!plan) throw new DistributionError("invalid", 404);
  const t = tables(plan.entity_type);
  const { rows: items } = await client.query(`SELECT * FROM representative_distribution_items
    WHERE plan_id=$1 AND status IN ('pending','active') ORDER BY entity_id FOR UPDATE`, [planId]);
  const due = items.filter((item: any) => item.status === "active"
    ? plan.ends_at && now >= plan.ends_at : now >= plan.starts_at);
  if (!due.length) return;
  const ids = due.map((i: any) => i.entity_id);
  const { rows: entities } = await client.query(`SELECT id,country_code FROM ${t.entity}
    WHERE id=ANY($1::varchar[]) ORDER BY id FOR UPDATE`, [ids]);
  const { rows: assignments } = await client.query(`SELECT id,user_id,${t.key} AS entity_id FROM ${t.assignments}
    WHERE ${t.key}=ANY($1::varchar[]) AND valid_to IS NULL ORDER BY ${t.key},id FOR UPDATE`, [ids]);
  const actorId = actorOverride || plan.created_by;
  const { rows: [creator] } = await client.query(`SELECT role,is_active,assigned_countries FROM users WHERE id=$1`, [actorId]);
  await client.query(`SELECT id FROM users WHERE id=ANY($1::varchar[]) ORDER BY id FOR SHARE`,
    [[...due.map((i: any) => i.status === "active" ? i.from_user_id : i.to_user_id), plan.from_user_id].filter(Boolean)]);
  const reps = await representativeUsers(client);
  const { rows: absent } = await client.query(`SELECT DISTINCT p.from_user_id FROM representative_distribution_plans p
    JOIN representative_distribution_items i ON i.plan_id=p.id
    WHERE p.id<>$1 AND p.kind='temporary' AND p.starts_at<=$2 AND p.ends_at>$2
      AND i.status IN ('pending','active')`, [planId, now]);
  const away = new Set(absent.map((r: any) => r.from_user_id));
  const updates: any[] = [], changes: any[] = [];
  for (const item of due) {
    const active = item.status === "active";
    const entity = entities.find((e: any) => e.id === item.entity_id);
    const currentRows = assignments.filter((a: any) => a.entity_id === item.entity_id);
    const current = currentRows[0];
    let reason: string | null = null;
    let status = active ? "completed" : plan.kind === "temporary" ? "active" : "completed";
    if (!entity) reason = "removed";
    else if (!creator?.is_active || !["admin", "manager"].includes(creator.role)
      || (creator.role !== "admin" && creator.assigned_countries?.length && !creator.assigned_countries.includes(entity.country_code))) reason = "permission";
    else if (currentRows.length > 1 || (current?.id || null) !== (active ? item.temporary_assignment_id : item.source_assignment_id)) reason = "changed";
    else if (!active && plan.kind === "temporary" && now >= plan.ends_at) reason = "expired";
    const nextId = active ? item.from_user_id : item.to_user_id;
    const next = reps.find((u: any) => u.id === nextId);
    if (!reason && (!next?.isActive || !next.eligible
      || away.has(nextId) || (next.countries?.length && !next.countries.includes(entity.country_code)))) reason = "unavailable";
    if (!reason && !active && plan.kind === "temporary") {
      const original = reps.find((u: any) => u.id === item.from_user_id);
      if (!original?.isActive || !original.eligible) reason = "unavailable";
    }
    if (reason) {
      status = active && reason !== "changed" && reason !== "removed" ? "conflict" : "skipped";
      updates.push({ id: item.id, status, reason, temporaryId: item.temporary_assignment_id });
      continue;
    }
    const assignmentId = randomUUID();
    changes.push({ id: assignmentId, entityId: item.entity_id, userId: nextId, currentId: current?.id,
      type: active ? "temporary_return" : plan.kind === "temporary" ? "temporary_cover" : plan.kind === "departure" ? "departure" : "bulk_region" });
    updates.push({ id: item.id, status, reason: null, temporaryId: active ? item.temporary_assignment_id : assignmentId });
  }
  if (changes.length) {
    await client.query(`UPDATE ${t.assignments} SET valid_to=$2 WHERE id=ANY($1::varchar[])`,
      [changes.map(c => c.currentId).filter(Boolean), now]);
    await client.query(`INSERT INTO ${t.assignments}(id,${t.key},user_id,valid_from,assigned_by,assignment_type)
      SELECT x.id,x."entityId",x."userId",$2,$3,x.type
      FROM jsonb_to_recordset($1::jsonb) AS x(id varchar,"entityId" varchar,"userId" varchar,type text)`,
    [JSON.stringify(changes), now, actorId]);
    await client.query(`UPDATE ${t.entity} e SET representative_id=x."userId"
      FROM jsonb_to_recordset($1::jsonb) AS x("entityId" varchar,"userId" varchar) WHERE e.id=x."entityId"`, [JSON.stringify(changes)]);
    await client.query(`UPDATE representative_distribution_items i SET status='skipped',reason='changed'
      FROM representative_distribution_plans p WHERE p.id=i.plan_id AND p.id<>$1 AND p.entity_type=$2
        AND ((i.status IN ('active','conflict') AND i.temporary_assignment_id=ANY($3::varchar[]))
          OR (i.status='pending' AND i.source_assignment_id=ANY($3::varchar[])))`,
    [planId, plan.entity_type, changes.map(c => c.currentId).filter(Boolean)]);
  }
  if (updates.length) await client.query(`UPDATE representative_distribution_items i
    SET status=x.status,reason=x.reason,temporary_assignment_id=x."temporaryId"
    FROM jsonb_to_recordset($1::jsonb) AS x(id uuid,status text,reason text,"temporaryId" varchar)
    WHERE i.id=x.id`, [JSON.stringify(updates)]);
}
