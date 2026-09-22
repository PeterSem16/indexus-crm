#!/usr/bin/env node
/**
 * Production-safe collaborator/facility deduplication.
 *
 * This intentionally uses pg directly (DATABASE_URL/PG* environment variables)
 * and never deletes rows.  The JSON emitted by --plan is the contract between
 * review and --apply.
 */
const crypto = require("node:crypto");
const { Pool } = require("pg");

const normalize = (value) => String(value || "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]/g, "");
const personName = (p) => normalize([p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" "));
const facilityName = (f) => normalize(f.name);
const facilityLocationKey = (f) => normalize(f.postal_code) || normalize(f.city);
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const normalizePhone = (value) => String(value || "").replace(/\D/g, "");
const filled = (v) => v !== null && v !== undefined && String(v).trim() !== "";
const array = (v) => Array.isArray(v) ? v : [];
const SENSITIVE_FIELD = /(birth_number|iban|swift|password|secret|token|hash|personal_id|id_card|bank_account)/i;
const valueHash = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);

function reviewValue(field, value) {
  if (!filled(value) && !Array.isArray(value)) return null;
  if (SENSITIVE_FIELD.test(field)) return { redacted: true, present: true, hash: valueHash(value) };
  return value;
}

function reviewPatch(patch) {
  return Object.fromEntries(Object.entries(patch).map(([field, value]) => [field, reviewValue(field, value)]));
}

function fieldConflicts(rows) {
  const fields = new Set(rows.flatMap((row) => Object.keys(row)));
  const conflicts = [];
  for (const field of fields) {
    if (["id", "created_at", "updated_at"].includes(field)) continue;
    const values = rows
      .map((row) => ({ id: String(row.id), value: row[field] }))
      .filter(({ value }) => filled(value) || (Array.isArray(value) && value.length));
    const distinct = new Set(values.map(({ value }) => JSON.stringify(value)));
    if (distinct.size > 1) {
      conflicts.push({
        field,
        values: values.map(({ id, value }) => ({ id, value: reviewValue(field, value) })),
      });
    }
  }
  return conflicts;
}

function matchEvidence(row, workplacesByPerson = {}) {
  if (row.kind === "clinic" || row.kind === "hospital") {
    return {
      id: String(row.id),
      kind: row.kind,
      name: row.name,
      city: row.city,
      countryCode: row.country_code,
      registry: {
        idZz: filled(row.id_zz) ? row.id_zz : null,
        pzsCode: filled(row.pzs_code) ? row.pzs_code : null,
        pzsNamePresent: filled(row.pzs_name),
      },
    };
  }
  return {
    id: String(row.id),
    kind: "person",
    name: [row.title_before, row.first_name, row.middle_name, row.last_name, row.title_after].filter(Boolean).join(" "),
    normalizedName: personName(row),
    countryCode: row.country_code,
    dataSource: row.data_source,
    hasBirthNumber: filled(row.birth_number),
    hasEmail: filled(row.email),
    phoneCount: [row.phone, row.mobile, row.mobile_2].filter(filled).length,
    workplaces: array(workplacesByPerson[row.id]).map((workplace) => ({
      entityType: workplace.entity_type,
      entityId: workplace.entity_id,
    })),
  };
}

function inspectionMatches(onlyName, people, facilities, workplacesByPerson = {}) {
  const needle = normalize(onlyName);
  if (!needle) return [];
  return [...people, ...facilities]
    .filter((row) => {
      const candidate = row.kind === "clinic" || row.kind === "hospital"
        ? facilityName(row)
        : personName(row);
      return candidate.includes(needle) || needle.includes(candidate);
    })
    .map((row) => matchEvidence(row, workplacesByPerson))
    .sort((a, b) => `${a.kind}|${a.name}|${a.id}`.localeCompare(`${b.kind}|${b.name}|${b.id}`));
}

function facilityScore(f) {
  return (filled(f.id_zz) ? 100000 : 0) + (filled(f.pzs_code) ? 10000 : 0) +
    (filled(f.pzs_name) ? 1000 : 0) + completeness(f);
}
function completeness(row) {
  return Object.entries(row).filter(([k, v]) =>
    !["id", "created_at", "updated_at", "is_active"].includes(k) &&
    (filled(v) || (Array.isArray(v) && v.length))).length;
}
function personScore(p, workplaces = []) {
  const realWorkplace = workplaces.some((w) => w && w.is_active !== false && filled(w.entity_id));
  const nonIsb = String(p.data_source || "").toLowerCase() !== "iscbc";
  return (nonIsb ? 100000 : 0) + (realWorkplace ? 10000 : 0) + completeness(p);
}
function canonical(rows, kind, workplacesByPerson = {}) {
  return [...rows].sort((a, b) => {
    const score = kind === "facility" ? facilityScore : (x) => personScore(x, workplacesByPerson[x.id] || []);
    const d = score(b) - score(a);
    if (d) return d;
    return String(a.id).localeCompare(String(b.id));
  })[0];
}

function mergeFillOnly(winner, loser, fields = Object.keys(loser)) {
  const patch = {};
  for (const field of fields) {
    if (["id", "kind", "is_active", "created_at", "updated_at"].includes(field)) continue;
    const w = winner[field], l = loser[field];
    if (!filled(w) && filled(l)) patch[field] = l;
    else if (Array.isArray(w) && Array.isArray(l)) {
      const next = [...new Set([...w, ...l])].sort();
      if (JSON.stringify(next) !== JSON.stringify(w)) patch[field] = next;
    }
  }
  return patch;
}
function mergeAssignment(primary, duplicate) {
  const patch = mergeFillOnly(primary, duplicate, ["category_id", "department", "position", "role", "subcategory", "notes"]);
  patch.cbc_activity_codes = [...new Set([...array(primary.cbc_activity_codes), ...array(duplicate.cbc_activity_codes)])].sort();
  patch.is_primary = Boolean(primary.is_primary || duplicate.is_primary);
  if (primary.start_date && duplicate.start_date) patch.start_date = new Date(primary.start_date) < new Date(duplicate.start_date) ? primary.start_date : duplicate.start_date;
  else if (!primary.start_date && duplicate.start_date) patch.start_date = duplicate.start_date;
  if (primary.end_date && duplicate.end_date) patch.end_date = new Date(primary.end_date) > new Date(duplicate.end_date) ? primary.end_date : duplicate.end_date;
  else if (!primary.end_date && duplicate.end_date) patch.end_date = duplicate.end_date;
  return patch;
}
function assignmentMergePlan(rows) {
  const groups = new Map();
  for (const row of rows) {
    // One person may legitimately have multiple roles/categories at the same
    // facility. Only rows in the same category are safe merge candidates.
    const key = `${row.person_id}|${row.entity_type}|${row.entity_id}|${row.category_id || ""}`;
    const list = groups.get(key) || []; list.push(row); groups.set(key, list);
  }
  return [...groups.values()].filter((g) => g.length > 1).map((g) => {
    const sorted = [...g].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    return { winnerId: sorted[0].id, duplicateIds: sorted.slice(1).map((x) => x.id), patch: sorted.slice(1).reduce((p, x) => Object.assign(p, mergeAssignment({ ...sorted[0], ...p }, x)), {}) };
  });
}

function plannedAssignmentMerges(rows, operations) {
  const personMap = new Map();
  const facilityMap = new Map();
  for (const op of operations) {
    for (const loserId of op.loserIds) {
      if (op.kind === "person") personMap.set(String(loserId), String(op.winnerId));
      else facilityMap.set(`${op.entityKind}:${loserId}`, String(op.winnerId));
    }
  }
  const remapped = rows.map((row) => {
    const personId = personMap.get(String(row.person_id)) || String(row.person_id);
    const entityId = facilityMap.get(`${row.entity_type}:${row.entity_id}`) || String(row.entity_id);
    return {
      ...row,
      person_id: personId,
      entity_id: entityId,
      _dedupeRemapped: personId !== String(row.person_id) || entityId !== String(row.entity_id),
    };
  });
  const affectedKeys = new Set(remapped
    .filter((row) => row._dedupeRemapped)
    .map((row) => `${row.person_id}|${row.entity_type}|${row.entity_id}|${row.category_id || ""}`));
  return assignmentMergePlan(remapped)
    .filter((merge) => {
      const winner = remapped.find((row) => row.id === merge.winnerId);
      return winner && affectedKeys.has(
        `${winner.person_id}|${winner.entity_type}|${winner.entity_id}|${winner.category_id || ""}`
      );
    })
    .map((merge) => ({
      ...merge,
      patch: Object.fromEntries(Object.entries(merge.patch).filter(([key]) => key !== "_dedupeRemapped")),
    }));
}

function matchingPeople(people, workplacesByPerson = {}, facilities = []) {
  const facilityCluster = new Map();
  const facilityGroups = new Map();
  for (const f of facilities) {
    const key = `${f.kind}|${facilityName(f)}|${facilityLocationKey(f)}|${normalize(f.country_code || "")}`;
    const group = facilityGroups.get(key) || []; group.push(f); facilityGroups.set(key, group);
  }
  for (const group of facilityGroups.values()) {
    if (group.length < 2 || !normalize(group[0]?.city) || !normalize(group[0]?.country_code)) continue;
    const cluster = group.map((f) => String(f.id)).sort().join(",");
    for (const f of group) facilityCluster.set(String(f.id), cluster);
  }
  const byName = new Map();
  for (const p of people) {
    const key = personName(p);
    if (!key) continue;
    const workplaceKeys = array(workplacesByPerson[p.id]).map((w) =>
      facilityCluster.get(String(w.entity_id)) || normalize(facilities.find((f) => f.id === w.entity_id)?.name || w.entity_id));
    const bucket = byName.get(key) || [];
    for (const q of bucket) {
      const qWork = array(workplacesByPerson[q.id]).map((w) =>
        facilityCluster.get(String(w.entity_id)) || normalize(facilities.find((f) => f.id === w.entity_id)?.name || w.entity_id));
      const sameWorkplace = workplaceKeys.some((w) => w && qWork.includes(w));
      const sameBirthNumber = filled(p.birth_number) && normalize(p.birth_number) === normalize(q.birth_number);
      const sameEmail = filled(p.email) && normalizeEmail(p.email) === normalizeEmail(q.email);
      const samePhone = [p.mobile, p.phone, p.mobile_2].some((phone) => {
        const normalized = normalizePhone(phone);
        return normalized.length >= 7 && [q.mobile, q.phone, q.mobile_2].some((other) => normalizePhone(other) === normalized);
      });
      const strong = sameBirthNumber || sameEmail || samePhone;
      if (strong || sameWorkplace) yieldCandidate(q, p, strong ? "strong_identifier" : "exact_name_duplicate_workplace", strong ? 1 : .8);
      else yieldCandidate(q, p, "ambiguous_exact_name", .5);
    }
    if (!bucket.includes(p)) bucket.push(p);
    byName.set(key, bucket);
  }
  return candidateBuffer;
}
let candidateBuffer = [];
function yieldCandidate(a, b, reason, confidence) {
  const ids = [String(a.id), String(b.id)].sort();
  candidateBuffer.push({ kind: "person", winnerId: null, loserIds: ids, reason, confidence, autoApplicable: confidence >= .95 });
}
function findPeople(people, workplacesByPerson = {}, facilities = []) {
  candidateBuffer = []; matchingPeople(people, workplacesByPerson, facilities);
  // Pairwise matches form a graph; apply one operation per connected component.
  const byId = new Map(people.map((p) => [String(p.id), p]));
  const parent = new Map(people.map((p) => [String(p.id), String(p.id)]));
  const root = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  for (const c of candidateBuffer) {
    const a = root(c.loserIds[0]), b = root(c.loserIds[1]); if (a !== b) parent.set(a, b);
  }
  const groups = new Map();
  for (const c of candidateBuffer) { const g = groups.get(root(c.loserIds[0])) || { ids: new Set(), reasons: [], confidence: 1, autoApplicable: true }; c.loserIds.forEach((id) => g.ids.add(id)); g.reasons.push(c.reason); g.confidence = Math.min(g.confidence, c.confidence); g.autoApplicable &&= c.autoApplicable; groups.set(root(c.loserIds[0]), g); }
  return [...groups.values()].map((g) => {
    const rows = [...g.ids].map((id) => byId.get(id)).filter(Boolean);
    const winner = canonical(rows, "person", workplacesByPerson);
    return { kind: "person", winnerId: winner.id, loserIds: [...g.ids].filter((id) => id !== String(winner.id)).sort(), reason: [...new Set(g.reasons)].sort().join("+"), confidence: g.confidence, autoApplicable: g.autoApplicable };
  }).filter((x) => x.loserIds.length).sort((a, b) => a.loserIds.join().localeCompare(b.loserIds.join()));
}
function findFacilities(facilities) {
  const groups = new Map();
  for (const f of facilities) {
    const key = `${f.kind}|${facilityName(f)}|${facilityLocationKey(f)}|${normalize(f.country_code || "")}`;
    if (!facilityName(f) || !normalize(f.city) || !normalize(f.country_code)) continue;
    const rows = groups.get(key) || []; rows.push(f); groups.set(key, rows);
  }
  return [...groups.values()].filter((r) => r.length > 1).map((rows) => {
    const winner = canonical(rows, "facility");
    const hasRegistryAnchor = rows[0].kind === "clinic" && filled(winner.id_zz) && filled(winner.pzs_code);
    const exactRegistryMatch = rows.some((row, index) => rows.slice(index + 1).some((other) =>
      (filled(row.id_zz) && filled(other.id_zz) && normalize(row.id_zz) === normalize(other.id_zz)) ||
      (filled(row.pzs_code) && filled(other.pzs_code) && normalize(row.pzs_code) === normalize(other.pzs_code))
    ));
    const locationReason = rows.every((row) => normalize(row.postal_code) === normalize(winner.postal_code))
      ? "postal"
      : "city";
    return {
      kind: "facility", winnerId: winner.id,
      loserIds: rows.filter((r) => r.id !== winner.id).map((r) => r.id).sort(),
      reason: hasRegistryAnchor
        ? `exact_name_${locationReason}_registry_anchor`
        : `exact_normalized_name_${locationReason}`,
      confidence: exactRegistryMatch ? 1 : hasRegistryAnchor ? .9 : .6,
      autoApplicable: exactRegistryMatch,
    };
  }).map((op) => {
    const row = facilities.find((f) => String(f.id) === String(op.winnerId));
    return { ...op, entityKind: row?.kind };
  }).sort((a, b) => String(a.winnerId).localeCompare(String(b.winnerId)));
}
async function referenceInventory(db, op) {
  const ids = op.loserIds;
  const suffix = op.kind === "person" ? ["collaborator_id", "person_id"] : [`${op.entityKind}_id`];
  const semanticSuffix = op.kind === "person" ? "%collaborator_id" : `%${op.entityKind}_id`;
  const columns = (await db.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema='public'
      AND (column_name = ANY($1::text[]) OR column_name LIKE $2)
    ORDER BY table_name, column_name
  `, [suffix, semanticSuffix])).rows;
  const counts = [];
  for (const { table_name: table, column_name: column } of columns) {
    const result = await db.query(`SELECT count(*)::int AS count FROM "${table}" WHERE "${column}" = ANY($1::varchar[])`, [ids]);
    if (result.rows[0].count > 0) counts.push({ table, column, count: result.rows[0].count });
  }
  if (op.kind === "facility") {
    const arrayColumn = op.entityKind === "clinic" ? "clinic_ids" : "hospital_ids";
    const result = await db.query(`SELECT count(*)::int AS count FROM collaborators WHERE "${arrayColumn}" && $1::text[]`, [ids]);
    if (result.rows[0].count > 0) counts.push({ table: "collaborators", column: arrayColumn, count: result.rows[0].count });
  }
  const polymorphic = (await db.query(`
    SELECT t.table_name
    FROM information_schema.columns t
    JOIN information_schema.columns i USING (table_schema, table_name)
    WHERE t.table_schema='public' AND t.column_name='entity_type' AND i.column_name='entity_id'
    ORDER BY t.table_name
  `)).rows;
  const entityType = op.kind === "person" ? "collaborator" : op.entityKind;
  for (const { table_name: table } of polymorphic) {
    const result = await db.query(`SELECT count(*)::int AS count FROM "${table}" WHERE entity_type=$1 AND entity_id = ANY($2::varchar[])`, [entityType, ids]);
    if (result.rows[0].count > 0) counts.push({ table, column: "entity_type/entity_id", count: result.rows[0].count });
  }
  return counts;
}
function stablePlan(plan) {
  const normalized = {
    version: 1,
    generatedBy: "dedupe-collaborators-facilities",
    operations: plan.operations || [],
    assignmentMerges: plan.assignmentMerges || [],
  };
  const json = JSON.stringify(normalized);
  return { ...normalized, planHash: crypto.createHash("sha256").update(json).digest("hex") };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const onlyName = process.argv.find((x) => x.startsWith("--only-name="))?.slice(12);
  const apply = args.has("--apply"), planArg = process.argv.find((x) => x.startsWith("--plan-hash="));
  const confirmation = process.argv.find((x) => x.startsWith("--confirm="));
  if (apply) {
    throw new Error("Apply is intentionally disabled. Review the production dry-run report and reference inventory first.");
  }
  if (apply && (!planArg || confirmation?.slice(10) !== "DEDUPLICATE_NO_DELETE")) {
    throw new Error("Apply requires --plan-hash=<hash> and --confirm=DEDUPLICATE_NO_DELETE");
  }
  const hasConnectionString = filled(process.env.DATABASE_URL);
  const password = process.env.PGPASSWORD;
  if (!hasConnectionString && typeof password !== "string") {
    throw new Error(
      "Database password is missing. Set PGPASSWORD in the shell (do not put it in the command history), " +
      "or set DATABASE_URL, then run the read-only command again."
    );
  }
  const pool = new Pool(hasConnectionString ? undefined : {
    host: process.env.PGHOST || "localhost",
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || "indexus_crm",
    user: process.env.PGUSER || "indexus",
    password,
  });
  const client = await pool.connect();
  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SET LOCAL statement_timeout = '120s'");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '180s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('indexus:dedupe:v1'))");
    // A single pg Client executes one query at a time. Keep these sequential so
    // the repeatable-read snapshot remains compatible with pg@9 and later.
    const people = await client.query("SELECT * FROM collaborators WHERE is_active = true ORDER BY id");
    const clinics = await client.query("SELECT 'clinic' AS kind, clinics.* FROM clinics WHERE is_active = true ORDER BY id");
    const hospitals = await client.query("SELECT 'hospital' AS kind, hospitals.* FROM hospitals WHERE is_active = true ORDER BY id");
    const facilities = { rows: [...clinics.rows, ...hospitals.rows] };
    const assignments = await client.query("SELECT * FROM contact_assignments WHERE is_active = true ORDER BY id");
    const workplaces = {}; for (const a of assignments.rows) (workplaces[a.person_id] ||= []).push(a);
    const operations = [...findFacilities(facilities.rows), ...findPeople(people.rows, workplaces, facilities.rows)]
      .filter((x) => !onlyName || x.loserIds.some((id) => normalize((people.rows.find((p) => p.id === id) || facilities.rows.find((f) => f.id === id) || {}).name || personName(people.rows.find((p) => p.id === id) || {})).includes(normalize(onlyName))))
      .filter((x) => x.loserIds.length).map((x) => ({ ...x, loserIds: x.loserIds.sort() }));
    const allRows = new Map([...people.rows, ...facilities.rows].map((r) => [String(r.id), r]));
    for (const op of operations) {
      const winner = allRows.get(String(op.winnerId));
      const losers = op.loserIds.map((id) => allRows.get(String(id))).filter(Boolean);
      const patch = losers.reduce((acc, loser) => Object.assign(acc, mergeFillOnly({ ...winner, ...acc }, loser)), {});
      op.plannedPatch = reviewPatch(patch);
      op.matchEvidence = [winner, ...losers].map((row) => matchEvidence(row, workplaces));
      op.fieldConflicts = fieldConflicts([winner, ...losers]);
      op.sourceFingerprints = [winner, ...losers].map((row) => ({
        id: String(row.id),
        hash: crypto.createHash("sha256").update(JSON.stringify(row)).digest("hex"),
      }));
      op.references = await referenceInventory(client, op);
    }
    const assignmentMerges = plannedAssignmentMerges(assignments.rows, operations);
    const report = stablePlan({ operations, assignmentMerges });
    report.autoApplicable = operations.filter((x) => x.autoApplicable);
    report.manualReview = operations.filter((x) => !x.autoApplicable);
    if (onlyName) {
      report.inspectionMatches = inspectionMatches(onlyName, people.rows, facilities.rows, workplaces);
    }
    if (!apply) { await client.query("ROLLBACK"); console.log(JSON.stringify(report, null, 2)); return; }
    if (planArg.slice(12) !== report.planHash) throw new Error("Plan hash does not match current database; refusing to apply");
    for (const op of operations.filter((x) => x.autoApplicable)) await applyOperation(client, op);
    for (const merge of report.assignmentMerges) {
      const current = (await client.query("SELECT * FROM contact_assignments WHERE id=$1 FOR UPDATE", [merge.winnerId])).rows[0];
      // Metadata is merged before deactivation; duplicate rows are retained for audit.
      let merged = { ...current };
      for (const id of merge.duplicateIds) merged = { ...merged, ...mergeAssignment(merged, (await client.query("SELECT * FROM contact_assignments WHERE id=$1", [id])).rows[0] || {}) };
      const setKeys = Object.keys(merged).filter((k) => !["id", "person_id", "entity_type", "entity_id"].includes(k));
      if (setKeys.length) await client.query(`UPDATE contact_assignments SET ${setKeys.map((k, i) => `"${k}"=$${i + 2}`).join(", ")}, updated_at=now() WHERE id=$1`, [merge.winnerId, ...setKeys.map((k) => merged[k])]);
      await client.query("UPDATE contact_assignments SET is_active=false, updated_at=now() WHERE id=ANY($1::varchar[])", [merge.duplicateIds]);
    }
    await client.query("COMMIT");
    console.log(JSON.stringify({ ...report, applied: true }, null, 2));
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); await pool.end(); }
}
async function applyOperation(db, op) {
  const person = op.kind === "person", table = person ? "collaborators" : (op.entityKind === "hospital" ? "hospitals" : "clinics");
  for (const loserId of op.loserIds) {
    const winner = op.winnerId || (await db.query(`SELECT id FROM ${table} WHERE is_active=true ORDER BY id LIMIT 1`)).rows[0]?.id;
    if (!winner || winner === loserId) continue;
    const loser = (await db.query(`SELECT * FROM ${table} WHERE id=$1`, [loserId])).rows[0];
    const current = (await db.query(`SELECT * FROM ${table} WHERE id=$1 FOR UPDATE`, [winner])).rows[0];
    const patch = mergeFillOnly(current, loser);
    const keys = Object.keys(patch);
    if (keys.length) await db.query(`UPDATE ${table} SET ${keys.map((k, i) => `"${k}"=$${i + 2}`).join(", ")}, updated_at=now() WHERE id=$1`, [winner, ...keys.map((k) => patch[k])]);
    if (person) {
      const refs = (await db.query(`SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema='public' AND data_type IN ('character varying','text')
          AND column_name IN ('collaborator_id','person_id')`)).rows;
      for (const ref of refs) {
        if (["collaborator_agreements", "collaborator_activities", "collaborator_documents", "collaborator_addresses", "contact_assignments", "collaborator_other_data"].includes(ref.table_name)) continue;
        if (/(audit|snapshot|history|log)/i.test(ref.table_name)) {
          const found = await db.query(`SELECT 1 FROM "${ref.table_name}" WHERE "${ref.column_name}"=$1 LIMIT 1`, [loserId]);
          if (found.rowCount) throw new Error(`BLOCKED person ${loserId}: unsupported audit/snapshot reference ${ref.table_name}.${ref.column_name}`);
          continue;
        }
        await db.query(`UPDATE "${ref.table_name}" SET "${ref.column_name}"=$1 WHERE "${ref.column_name}"=$2`, [winner, loserId]);
      }
      await db.query("UPDATE collaborator_agreements SET collaborator_id=$1 WHERE collaborator_id=$2", [winner, loserId]);
      await db.query("UPDATE collaborator_activities SET collaborator_id=$1 WHERE collaborator_id=$2", [winner, loserId]);
      await db.query("UPDATE collaborator_documents SET collaborator_id=$1 WHERE collaborator_id=$2", [winner, loserId]);
      await db.query("UPDATE collaborator_addresses SET collaborator_id=$1 WHERE collaborator_id=$2", [winner, loserId]);
      const other = (await db.query("SELECT * FROM collaborator_other_data WHERE collaborator_id=$1", [loserId])).rows[0];
      if (other) {
        const currentOther = (await db.query("SELECT * FROM collaborator_other_data WHERE collaborator_id=$1", [winner])).rows[0];
        if (!currentOther) await db.query("UPDATE collaborator_other_data SET collaborator_id=$1 WHERE collaborator_id=$2", [winner, loserId]);
        else throw new Error(`BLOCKED ${op.kind} ${loserId}: collaborator_other_data exists for both records; no-delete policy requires manual merge`);
      }
      await db.query("UPDATE contact_assignments SET person_id=$1 WHERE person_id=$2", [winner, loserId]);
    } else {
      const entityType = op.entityKind;
      await db.query("UPDATE contact_assignments SET entity_id=$1 WHERE entity_id=$2 AND entity_type=$3", [winner, loserId, entityType]);
      if (entityType === "clinic") {
        await db.query("UPDATE collaborators SET clinic_id=$1 WHERE clinic_id=$2", [winner, loserId]);
        await db.query("UPDATE collaborators SET clinic_ids=(SELECT array_agg(DISTINCT CASE WHEN x=$2 THEN $1 ELSE x END) FROM unnest(clinic_ids) x) WHERE $2=ANY(clinic_ids)", [winner, loserId]);
        for (const [table, column] of [["clinic_referrals", "clinic_id"], ["clinic_referrals", "referring_clinic_id"], ["clinic_events", "clinic_id"], ["hospital_network_members", "clinic_id"], ["campaign_contacts", "clinic_id"]])
          await db.query(`UPDATE ${table} SET ${column}=$1 WHERE ${column}=$2`, [winner, loserId]);
      } else if (entityType === "hospital") {
        await db.query("UPDATE collaborators SET hospital_id=$1 WHERE hospital_id=$2", [winner, loserId]);
        await db.query("UPDATE collaborators SET hospital_ids=(SELECT array_agg(DISTINCT CASE WHEN x=$2 THEN $1 ELSE x END) FROM unnest(hospital_ids) x) WHERE $2=ANY(hospital_ids)", [winner, loserId]);
        for (const [table, column] of [["collections", "hospital_id"], ["collaborator_activities", "hospital_id"], ["hospital_network_members", "hospital_id"], ["hospital_representative_assignments", "hospital_id"], ["campaign_contacts", "hospital_id"]])
          await db.query(`UPDATE ${table} SET ${column}=$1 WHERE ${column}=$2`, [winner, loserId]);
      }
    }
    await db.query(`UPDATE ${table} SET is_active=false, updated_at=now() WHERE id=$1`, [loserId]);
  }
}
module.exports = { normalize, normalizeEmail, normalizePhone, personName, facilityName, facilityLocationKey, canonical, mergeFillOnly, mergeAssignment, assignmentMergePlan, plannedAssignmentMerges, findPeople, findFacilities, inspectionMatches, stablePlan };
if (require.main === module) main().catch((e) => { console.error(`FATAL: ${e.message}`); process.exitCode = 1; });