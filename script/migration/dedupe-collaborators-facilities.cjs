#!/usr/bin/env node
/**
 * Production-safe collaborator/facility deduplication.
 *
 * This intentionally uses pg directly (DATABASE_URL/PG* environment variables)
 * and never deletes rows.  The JSON emitted by --plan is the contract between
 * review and --apply.
 */
const crypto = require("node:crypto");
const path = require("node:path");
const { Pool } = require("pg");
const { createVerifiedBackup } = require("./dedupe-backup.cjs");

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

function reviewRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([field, value]) => [field, reviewValue(field, value)])
  );
}

function canonicalize(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(canonicalize(value));
}

function operationId(operation) {
  return crypto.createHash("sha256").update(stableJson({
    kind: operation.kind,
    entityKind: operation.entityKind || null,
    winnerId: String(operation.winnerId),
    loserIds: [...operation.loserIds].map(String).sort(),
  })).digest("hex").slice(0, 24);
}

function sourceRowFingerprint(row) {
  // Facility discovery adds a synthetic `kind` discriminator that is not a
  // physical clinics/hospitals column. Fingerprint only persisted DB fields so
  // the reviewed snapshot matches the row read back during apply.
  const { kind, ...persisted } = row;
  return crypto.createHash("sha256").update(stableJson(persisted)).digest("hex");
}

function executionPlan(report, selectedOperationIds = []) {
  const selected = new Set(selectedOperationIds);
  const operations = (report.operations || [])
    .map((operation) => ({ ...operation, operationId: operation.operationId || operationId(operation) }))
    .filter((operation) => operation.autoApplicable || selected.has(operation.operationId))
    .sort((a, b) => a.operationId.localeCompare(b.operationId));
  const unsupported = operations.flatMap((operation) =>
    (operation.references || [])
      .filter((reference) => reference.policy === "unsupported_block")
      .map((reference) => `${reference.table}.${reference.column}`)
  );
  if (unsupported.length) {
    throw new Error(`Selected operations contain unsupported references: ${[...new Set(unsupported)].join(", ")}`);
  }
  const assignmentMerges = [...(report.assignmentMerges || [])]
    .sort((a, b) => String(a.winnerId).localeCompare(String(b.winnerId)));
  const content = {
    format: 2,
    generatedBy: "dedupe-collaborators-facilities",
    database: report.database,
    operations: operations.map((operation) => ({
      operationId: operation.operationId,
      kind: operation.kind,
      entityKind: operation.entityKind || null,
      winnerId: String(operation.winnerId),
      loserIds: [...operation.loserIds].map(String).sort(),
      plannedPatch: operation.executionPatch || {},
      references: [...(operation.references || [])].sort((a, b) =>
        `${a.table}|${a.column}|${a.policy}`.localeCompare(`${b.table}|${b.column}|${b.policy}`)
      ),
      sourceFingerprints: [...(operation.sourceFingerprints || [])].sort((a, b) =>
        String(a.id).localeCompare(String(b.id))
      ),
    })),
    assignmentMerges,
  };
  return {
    ...content,
    planHash: crypto.createHash("sha256").update(stableJson(content)).digest("hex"),
  };
}

async function writeRestrictedPlan(filePath, plan) {
  if (!filePath || !path.isAbsolute(filePath)) throw new Error("--plan-file must be an absolute path");
  const fs = require("node:fs/promises");
  await fs.writeFile(filePath, `${JSON.stringify(plan, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  await fs.chmod(filePath, 0o600);
}

async function readRestrictedPlan(filePath) {
  if (!filePath || !path.isAbsolute(filePath)) throw new Error("--plan-file must be an absolute path");
  const fs = require("node:fs/promises");
  const stat = await fs.stat(filePath);
  if (!stat.isFile()) throw new Error("--plan-file is not a regular file");
  if ((stat.mode & 0o077) !== 0) throw new Error("--plan-file must have mode 0600");
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function verifyExecutionPlan(plan, expectedHash, confirmation) {
  if (!plan || plan.format !== 2 || !plan.planHash) throw new Error("Invalid execution plan");
  const { planHash, ...content } = plan;
  const actualHash = crypto.createHash("sha256").update(stableJson(content)).digest("hex");
  if (actualHash !== planHash || (expectedHash && expectedHash !== planHash)) {
    throw new Error("Execution plan hash mismatch");
  }
  if (confirmation !== `DEDUPLICATE_NO_DELETE:${planHash}`) {
    throw new Error("Confirmation must be DEDUPLICATE_NO_DELETE:<planHash>");
  }
  return true;
}

function parseApprovalArgs(argv) {
  const prefix = "--approve-operation=";
  return argv
    .filter((argument) => argument.startsWith(prefix))
    .map((argument) => argument.slice(prefix.length));
}

function operationsForWinnerCountry(operations, countryCode) {
  const expected = String(countryCode || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(expected)) {
    throw new Error("--approve-winner-country must be a two-letter country code");
  }
  return operations.filter((operation) => {
    const winner = (operation.matchEvidence || []).find(
      (evidence) => String(evidence.id) === String(operation.winnerId)
    );
    return String(winner?.countryCode || "").trim().toUpperCase() === expected;
  });
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

function automaticConflictBlockers(rows, conflicts = fieldConflicts(rows)) {
  return conflicts
    .filter((conflict) => {
      if (conflict.field === "legacy_id") return false;
      const sourceValues = rows
        .map((row) => row[conflict.field])
        .filter((value) => filled(value) || (Array.isArray(value) && value.length));
      return !sourceValues.length || !sourceValues.every(Array.isArray);
    })
    .map((conflict) => conflict.field)
    .sort();
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
      _sourceFingerprint: crypto.createHash("sha256").update(JSON.stringify(row)).digest("hex"),
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
      sourceFingerprints: [merge.winnerId, ...merge.duplicateIds].map((id) => {
        const row = remapped.find((candidate) => String(candidate.id) === String(id));
        return { id: String(id), hash: row?._sourceFingerprint };
      }).sort((a, b) => a.id.localeCompare(b.id)),
      expectedCategoryId: remapped.find((row) => String(row.id) === String(merge.winnerId))?.category_id || null,
    }));
}

function referencePolicy(table, column) {
  if (table === "contact_assignments") return "contact_assignment_special";
  if (table === "clinic_representative_assignments" && column === "clinic_id") {
    return "clinic_representative_assignment_special";
  }
  if (table === "dedupe_entity_aliases" && column === "loser_id") return "preserve_alias";
  if (/(audit|snapshot|history|log)/i.test(`${table}.${column}`)) return "preserve_audit";
  return "redirect";
}

const quoteIdentifier = (value) => {
  if (!/^[a-z_][a-z0-9_]*$/i.test(String(value))) throw new Error(`Unsafe SQL identifier: ${value}`);
  return `"${String(value).replace(/"/g, '""')}"`;
};

const tableForOperation = (operation) =>
  operation.kind === "person"
    ? "collaborators"
    : operation.entityKind === "hospital" ? "hospitals" : "clinics";

async function databaseIdentity(db) {
  const result = await db.query(`
    SELECT current_database() AS database,
           current_user AS "user",
           current_setting('server_version_num') AS "serverVersion",
           (SELECT oid::text FROM pg_database WHERE datname=current_database()) AS "databaseOid"
  `);
  return result.rows[0];
}

function assertSame(label, actual, expected) {
  if (stableJson(actual) !== stableJson(expected)) {
    throw new Error(`${label} changed since the reviewed plan; refusing to apply`);
  }
}

async function verifyOperationState(db, operation, observedReferences = undefined) {
  const table = tableForOperation(operation);
  const ids = [String(operation.winnerId), ...operation.loserIds.map(String)];
  const rows = (await db.query(
    `SELECT * FROM ${quoteIdentifier(table)} WHERE id=ANY($1::varchar[]) ORDER BY id FOR UPDATE`,
    [ids]
  )).rows;
  if (rows.length !== ids.length) throw new Error(`Missing source row for operation ${operation.operationId}`);
  if (rows.some((row) => row.is_active !== true)) {
    throw new Error(`Inactive source row for operation ${operation.operationId}`);
  }
  const fingerprints = rows.map((row) => ({
    id: String(row.id),
    hash: sourceRowFingerprint(row),
  })).sort((a, b) => a.id.localeCompare(b.id));
  assertSame(`Source fingerprint for operation ${operation.operationId}`, fingerprints, operation.sourceFingerprints);
  if (observedReferences !== null) {
    const references = observedReferences || await referenceInventory(db, operation);
    assertSame(
      `Reference inventory for operation ${operation.operationId}`,
      references.sort((a, b) => `${a.table}|${a.column}|${a.policy}`.localeCompare(`${b.table}|${b.column}|${b.policy}`)),
      [...operation.references].sort((a, b) => `${a.table}|${a.column}|${a.policy}`.localeCompare(`${b.table}|${b.column}|${b.policy}`))
    );
  }
  return { table, rows };
}

async function applyReviewedPatch(db, operation, table) {
  const patch = operation.plannedPatch || {};
  const forbidden = new Set(["id", "kind", "is_active", "created_at", "updated_at"]);
  const columns = (await db.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name=$1
  `, [table])).rows.map((row) => row.column_name);
  const allowed = new Set(columns);
  const keys = Object.keys(patch);
  for (const key of keys) {
    if (forbidden.has(key) || !allowed.has(key)) throw new Error(`Unsafe planned patch field ${table}.${key}`);
  }
  if (!keys.length) return;
  await db.query(
    `UPDATE ${quoteIdentifier(table)}
     SET ${keys.map((key, index) => `${quoteIdentifier(key)}=$${index + 2}`).join(", ")},
         updated_at=now()
     WHERE id=$1`,
    [operation.winnerId, ...keys.map((key) => patch[key])]
  );
}

async function insertLegacyAliases(db, operation, rows, planHash) {
  const winnerId = String(operation.winnerId);
  for (const row of rows.filter((candidate) => String(candidate.id) !== winnerId && filled(candidate.legacy_id))) {
    const source = operation.kind === "person" ? String(row.data_source || "legacy") : "legacy";
    await db.query(`
      INSERT INTO dedupe_entity_aliases
        (entity_kind, source, legacy_id, loser_id, canonical_id, plan_hash)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (entity_kind, source, legacy_id) DO UPDATE SET
        loser_id=EXCLUDED.loser_id,
        canonical_id=EXCLUDED.canonical_id,
        plan_hash=EXCLUDED.plan_hash
      WHERE dedupe_entity_aliases.canonical_id=EXCLUDED.canonical_id
    `, [operation.kind === "person" ? "person" : operation.entityKind, source, String(row.legacy_id), String(row.id), winnerId, planHash]);
    const alias = (await db.query(`
      SELECT canonical_id FROM dedupe_entity_aliases
      WHERE entity_kind=$1 AND source=$2 AND legacy_id=$3
    `, [operation.kind === "person" ? "person" : operation.entityKind, source, String(row.legacy_id)])).rows[0];
    if (!alias || String(alias.canonical_id) !== winnerId) {
      throw new Error(`Legacy alias conflict for ${operation.operationId}`);
    }
  }
}

async function redirectReviewedReferences(db, operation) {
  const winnerId = String(operation.winnerId);
  const loserIds = operation.loserIds.map(String);
  const entityType = operation.kind === "person" ? "collaborator" : operation.entityKind;
  for (const reference of operation.references || []) {
    if (
      reference.policy === "preserve_audit" ||
      reference.policy === "contact_assignment_special" ||
      reference.policy === "clinic_representative_assignment_special"
    ) continue;
    const table = quoteIdentifier(reference.table);
    if (reference.policy === "redirect_array") {
      const column = quoteIdentifier(reference.column);
      await db.query(`
        UPDATE ${table}
        SET ${column}=ARRAY(
          SELECT DISTINCT CASE WHEN value=ANY($2::text[]) THEN $1 ELSE value END
          FROM unnest(${column}) AS value
          ORDER BY 1
        )
        WHERE ${column} && $2::text[]
      `, [winnerId, loserIds]);
    } else if (reference.column === "entity_type/entity_id") {
      await db.query(
        `UPDATE ${table} SET entity_id=$1 WHERE entity_type=$2 AND entity_id=ANY($3::varchar[])`,
        [winnerId, entityType, loserIds]
      );
    } else if (reference.policy === "redirect") {
      const column = quoteIdentifier(reference.column);
      await db.query(`UPDATE ${table} SET ${column}=$1 WHERE ${column}=ANY($2::varchar[])`, [winnerId, loserIds]);
    } else {
      throw new Error(`Unsupported reference policy ${reference.policy}`);
    }
  }
}

async function applyClinicRepresentativeRedirects(db, operations) {
  for (const operation of operations) {
    if (operation.kind !== "facility" || operation.entityKind !== "clinic") continue;
    const hasReference = (operation.references || []).some((reference) =>
      reference.table === "clinic_representative_assignments" &&
      reference.column === "clinic_id" &&
      reference.policy === "clinic_representative_assignment_special"
    );
    if (!hasReference) continue;

    const winnerId = String(operation.winnerId);
    const loserIds = operation.loserIds.map(String);
    const ids = [winnerId, ...loserIds];
    const rows = (await db.query(`
      SELECT id, clinic_id, valid_from, valid_to, assigned_at
      FROM clinic_representative_assignments
      WHERE clinic_id=ANY($1::varchar[])
      ORDER BY
        (clinic_id=$2) DESC,
        valid_from DESC,
        assigned_at DESC,
        id
      FOR UPDATE
    `, [ids, winnerId])).rows;

    const active = rows.filter((row) => row.valid_to === null);
    const keeper = active[0];
    const closeIds = active.slice(1).map((row) => String(row.id));
    if (closeIds.length) {
      await db.query(`
        UPDATE clinic_representative_assignments
        SET valid_to=GREATEST(valid_from, now())
        WHERE id=ANY($1::varchar[])
      `, [closeIds]);
    }
    if (loserIds.length) {
      await db.query(`
        UPDATE clinic_representative_assignments
        SET clinic_id=$1
        WHERE clinic_id=ANY($2::varchar[])
      `, [winnerId, loserIds]);
    }

    const remainingActive = (await db.query(`
      SELECT id FROM clinic_representative_assignments
      WHERE clinic_id=$1 AND valid_to IS NULL
      ORDER BY id
    `, [winnerId])).rows;
    if (remainingActive.length > 1 || (keeper && remainingActive.length !== 1)) {
      throw new Error(`Clinic representative assignment merge failed for ${operation.operationId}`);
    }
  }
}

async function applyAssignmentRedirects(db, operations, assignmentMerges) {
  for (const operation of operations) {
    if (operation.kind === "person") {
      await db.query(
        "UPDATE contact_assignments SET person_id=$1, updated_at=now() WHERE person_id=ANY($2::varchar[])",
        [operation.winnerId, operation.loserIds]
      );
    } else {
      await db.query(
        "UPDATE contact_assignments SET entity_id=$1, updated_at=now() WHERE entity_type=$2 AND entity_id=ANY($3::varchar[])",
        [operation.winnerId, operation.entityKind, operation.loserIds]
      );
    }
  }
  for (const merge of assignmentMerges || []) {
    const ids = [String(merge.winnerId), ...merge.duplicateIds.map(String)];
    const rows = (await db.query(
      "SELECT * FROM contact_assignments WHERE id=ANY($1::varchar[]) ORDER BY id FOR UPDATE",
      [ids]
    )).rows;
    if (rows.length !== ids.length) throw new Error(`Assignment merge source changed for ${merge.winnerId}`);
    const keys = Object.keys(merge.patch || {}).filter((key) =>
      !["id", "person_id", "entity_type", "entity_id", "category_id", "is_active", "created_at", "updated_at"].includes(key)
    );
    if (keys.length) {
      await db.query(
        `UPDATE contact_assignments SET ${keys.map((key, index) => `${quoteIdentifier(key)}=$${index + 2}`).join(", ")}, updated_at=now() WHERE id=$1`,
        [merge.winnerId, ...keys.map((key) => merge.patch[key])]
      );
    }
    await db.query(
      "UPDATE contact_assignments SET is_active=false, updated_at=now() WHERE id=ANY($1::varchar[])",
      [merge.duplicateIds]
    );
  }
}

async function verifyAssignmentMerges(db, assignmentMerges) {
  for (const merge of assignmentMerges || []) {
    const ids = [String(merge.winnerId), ...merge.duplicateIds.map(String)];
    const rows = (await db.query(
      "SELECT * FROM contact_assignments WHERE id=ANY($1::varchar[]) ORDER BY id FOR UPDATE",
      [ids]
    )).rows;
    if (rows.length !== ids.length || rows.some((row) => row.is_active !== true)) {
      throw new Error(`Assignment merge source changed for ${merge.winnerId}`);
    }
    const fingerprints = rows.map((row) => ({
      id: String(row.id),
      hash: crypto.createHash("sha256").update(JSON.stringify(row)).digest("hex"),
    })).sort((a, b) => a.id.localeCompare(b.id));
    assertSame(`Assignment fingerprints for ${merge.winnerId}`, fingerprints, merge.sourceFingerprints);
    const categories = new Set(rows.map((row) => row.category_id || null));
    if (categories.size !== 1 || !categories.has(merge.expectedCategoryId || null)) {
      throw new Error(`Assignment category changed for ${merge.winnerId}`);
    }
  }
}

async function applyExecutionPlan(pool, plan, backup, options = {}) {
  const client = await pool.connect();
  const failAfter = (phase) => {
    if (options.faultAfterPhase === phase) throw new Error(`Injected dedupe failure after ${phase}`);
  };
  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE");
    await client.query("SET LOCAL statement_timeout = '10min'");
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '12min'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('indexus:dedupe:v2'))");
    const prior = (await client.query(
      "SELECT status FROM dedupe_apply_ledger WHERE plan_hash=$1 FOR UPDATE",
      [plan.planHash]
    )).rows[0];
    if (prior?.status === "applied") {
      await client.query("ROLLBACK");
      return { alreadyApplied: true, planHash: plan.planHash };
    }
    assertSame("Database identity", await databaseIdentity(client), plan.database);
    const verified = [];
    for (const operation of plan.operations) {
      verified.push({ operation, ...(await verifyOperationState(client, operation, null)) });
    }
    const liveReferences = await referenceInventories(client, plan.operations);
    for (const operation of plan.operations) {
      assertSame(
        `Reference inventory for operation ${operation.operationId}`,
        liveReferences.get(operation.operationId),
        [...operation.references].sort((a, b) =>
          `${a.table}|${a.column}|${a.policy}`.localeCompare(`${b.table}|${b.column}|${b.policy}`)
        )
      );
    }
    await verifyAssignmentMerges(client, plan.assignmentMerges);
    for (const item of verified) {
      await applyReviewedPatch(client, item.operation, item.table);
    }
    failAfter("patches");
    for (const item of verified) {
      await insertLegacyAliases(client, item.operation, item.rows, plan.planHash);
    }
    failAfter("aliases");
    for (const item of verified) {
      await redirectReviewedReferences(client, item.operation);
    }
    await applyClinicRepresentativeRedirects(client, plan.operations);
    failAfter("references");
    await applyAssignmentRedirects(client, plan.operations, plan.assignmentMerges);
    failAfter("assignments");
    for (const item of verified) {
      await client.query(
        `UPDATE ${quoteIdentifier(item.table)} SET is_active=false, updated_at=now()
         WHERE id=ANY($1::varchar[])`,
        [item.operation.loserIds]
      );
    }
    failAfter("deactivation");
    const remainingReferences = await referenceInventories(client, plan.operations);
    for (const operation of plan.operations) {
      const remaining = remainingReferences.get(operation.operationId)
        .filter((reference) =>
          !["preserve_audit", "preserve_alias", "contact_assignment_special"].includes(reference.policy)
          && reference.policy !== "clinic_representative_assignment_special"
        );
      if (remaining.length) throw new Error(`Mutable references remain for operation ${operation.operationId}`);
    }
    await client.query(`
      INSERT INTO dedupe_apply_ledger
        (plan_hash, status, backup_manifest_path, operation_count, details)
      VALUES ($1,'applied',$2,$3,$4::jsonb)
    `, [
      plan.planHash,
      backup.manifestPath,
      plan.operations.length,
      JSON.stringify({ backupSha256: backup.manifest.dump.sha256 }),
    ]);
    failAfter("ledger");
    await client.query("COMMIT");
    return {
      applied: true,
      planHash: plan.planHash,
      operationCount: plan.operations.length,
      backupManifestPath: backup.manifestPath,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
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
      const matchedIdentifiers = [
        sameBirthNumber ? "birth_number" : null,
        sameEmail ? "email" : null,
        samePhone ? "phone" : null,
      ].filter(Boolean);
      const strong = matchedIdentifiers.length > 0;
      if (strong || sameWorkplace) {
        yieldCandidate(
          q,
          p,
          strong ? `strong_${matchedIdentifiers.join("_")}` : "exact_name_duplicate_workplace",
          strong ? 1 : .8
        );
      }
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
const operationEntityType = (operation) =>
  operation.kind === "person" ? "collaborator" : operation.entityKind;

const KNOWN_PERSON_REFERENCE_COLUMNS = new Set([
  "collections.cord_blood_collector_id",
  "collections.tissue_collector_id",
  "collections.placenta_collector_id",
  "collections.assistant_nurse_id",
  "collections.second_nurse_id",
  "customer_potential_cases.obstetrician_id",
]);

const isKnownScalarReference = (operation, table, column) =>
  operation.kind === "person"
    ? column.endsWith("collaborator_id") ||
      column.endsWith("person_id") ||
      KNOWN_PERSON_REFERENCE_COLUMNS.has(`${table}.${column}`)
    : column.endsWith(`${operation.entityKind}_id`);

const isKnownArrayReference = (operation, column) =>
  operation.kind === "person"
    ? column.endsWith("collaborator_ids") || column.endsWith("person_ids")
    : column.endsWith(`${operation.entityKind}_ids`);

function addReference(referenceMaps, operation, table, column, policy) {
  const references = referenceMaps.get(operation.operationId);
  const key = `${table}|${column}|${policy}`;
  const current = references.get(key) || { table, column, count: 0, policy };
  current.count += 1;
  references.set(key, current);
}

async function referenceInventories(db, operations) {
  const normalizedOperations = operations.map((operation) => ({
    ...operation,
    operationId: operation.operationId || operationId(operation),
    loserIds: operation.loserIds.map(String),
  }));
  const referenceMaps = new Map(normalizedOperations.map((operation) => [
    operation.operationId,
    new Map(),
  ]));
  if (!normalizedOperations.length) return new Map();

  const operationsByLoserId = new Map();
  for (const operation of normalizedOperations) {
    for (const loserId of operation.loserIds) {
      const list = operationsByLoserId.get(loserId) || [];
      list.push(operation);
      operationsByLoserId.set(loserId, list);
    }
  }
  const allLoserIds = [...operationsByLoserId.keys()].sort();
  const schemaRows = (await db.query(`
    SELECT c.table_name, c.column_name, c.data_type, c.udt_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema=c.table_schema AND t.table_name=c.table_name
    WHERE c.table_schema='public'
      AND t.table_type='BASE TABLE'
      AND (
        c.data_type IN ('character varying', 'text')
        OR (c.data_type='ARRAY' AND c.udt_name IN ('_text', '_varchar'))
      )
    ORDER BY c.table_name, c.ordinal_position
  `)).rows;
  const byTable = new Map();
  for (const column of schemaRows) {
    const entry = byTable.get(column.table_name) || { scalar: [], arrays: [] };
    if (column.data_type === "ARRAY") entry.arrays.push(column.column_name);
    else entry.scalar.push(column.column_name);
    byTable.set(column.table_name, entry);
  }

  for (const [table, columns] of byTable) {
    const scalar = columns.scalar;
    const arrays = columns.arrays;
    const polymorphic = scalar.includes("entity_type") && scalar.includes("entity_id");
    const select = [];
    const predicates = [];
    scalar.forEach((column, index) => {
      if (polymorphic && column === "entity_id") return;
      const identifier = quoteIdentifier(column);
      select.push(`CASE WHEN ${identifier}::text=ANY($1::text[]) THEN ${identifier}::text END AS "__s${index}"`);
      predicates.push(`${identifier}::text=ANY($1::text[])`);
    });
    arrays.forEach((column, index) => {
      const identifier = quoteIdentifier(column);
      select.push(`ARRAY(SELECT value FROM unnest(${identifier}::text[]) AS value WHERE value=ANY($1::text[])) AS "__a${index}"`);
      predicates.push(`${identifier}::text[] && $1::text[]`);
    });
    if (polymorphic) {
      select.push(
        `CASE WHEN "entity_id"::text=ANY($1::text[]) THEN "entity_type"::text END AS "__entity_type"`,
        `CASE WHEN "entity_id"::text=ANY($1::text[]) THEN "entity_id"::text END AS "__entity_id"`
      );
      predicates.push(`"entity_id"::text=ANY($1::text[])`);
    }
    if (!predicates.length) continue;
    const rows = (await db.query(`
      SELECT ${select.join(", ")}
      FROM ${quoteIdentifier(table)}
      WHERE ${predicates.join(" OR ")}
    `, [allLoserIds])).rows;

    for (const row of rows) {
      scalar.forEach((column, index) => {
        if (polymorphic && column === "entity_id") return;
        const value = row[`__s${index}`];
        if (!value) return;
        for (const operation of operationsByLoserId.get(String(value)) || []) {
          if (table === tableForOperation(operation) && column === "id") continue;
          const known = isKnownScalarReference(operation, table, column);
          const basePolicy = referencePolicy(table, column);
          const policy = known
            ? basePolicy
            : basePolicy === "preserve_alias" ? basePolicy : "unsupported_block";
          addReference(referenceMaps, operation, table, column, policy);
        }
      });
      arrays.forEach((column, index) => {
        const matchedValues = new Set(array(row[`__a${index}`]).map(String));
        const seenOperations = new Set();
        for (const value of matchedValues) {
          for (const operation of operationsByLoserId.get(value) || []) {
            if (seenOperations.has(operation.operationId)) continue;
            seenOperations.add(operation.operationId);
            addReference(
              referenceMaps,
              operation,
              table,
              column,
              isKnownArrayReference(operation, column) ? "redirect_array" : "unsupported_block"
            );
          }
        }
      });
      if (polymorphic && row.__entity_id) {
        for (const operation of operationsByLoserId.get(String(row.__entity_id)) || []) {
          if (String(row.__entity_type) !== operationEntityType(operation)) continue;
          addReference(
            referenceMaps,
            operation,
            table,
            "entity_type/entity_id",
            referencePolicy(table, "entity_type/entity_id")
          );
        }
      }
    }
  }

  return new Map(normalizedOperations.map((operation) => [
    operation.operationId,
    [...referenceMaps.get(operation.operationId).values()].sort((a, b) =>
      `${a.table}|${a.column}|${a.policy}`.localeCompare(`${b.table}|${b.column}|${b.policy}`)
    ),
  ]));
}

async function referenceInventory(db, operation) {
  const id = operation.operationId || operationId(operation);
  return (await referenceInventories(db, [{ ...operation, operationId: id }])).get(id);
}
function stablePlan(plan) {
  const publicOperations = (plan.operations || [])
    .map(({ executionPatch, ...operation }) => operation)
    .map((operation) => ({
      ...operation,
      operationId: operation.operationId || operationId(operation),
      loserIds: [...operation.loserIds].map(String).sort(),
    }))
    .sort((a, b) => a.operationId.localeCompare(b.operationId));
  const normalized = {
    version: 1,
    generatedBy: "dedupe-collaborators-facilities",
    operations: publicOperations,
    assignmentMerges: [...(plan.assignmentMerges || [])].sort((a, b) => String(a.winnerId).localeCompare(String(b.winnerId))),
  };
  const json = JSON.stringify(normalized);
  return { ...normalized, planHash: crypto.createHash("sha256").update(json).digest("hex") };
}

function publicOperation(operation) {
  const { executionPatch, ...publicData } = operation;
  return publicData;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const onlyName = process.argv.find((x) => x.startsWith("--only-name="))?.slice(12);
  const apply = args.has("--apply"), planArg = process.argv.find((x) => x.startsWith("--plan-hash="));
  const confirmation = process.argv.find((x) => x.startsWith("--confirm="));
  const planFile = process.argv.find((x) => x.startsWith("--plan-file="))?.slice(12);
  const approvals = parseApprovalArgs(process.argv);
  const approveWinnerCountry = process.argv
    .find((x) => x.startsWith("--approve-winner-country="))
    ?.slice("--approve-winner-country=".length);
  const backupRoot = process.argv.find((x) => x.startsWith("--backup-dir="))?.slice(13);
  if (args.has("--backup")) {
    if (!backupRoot) throw new Error("--backup requires --backup-dir=/absolute/protected/path");
    const backup = await createVerifiedBackup({ backupRoot });
    console.log(JSON.stringify(backup.manifest, null, 2));
    return;
  }
  if (apply) {
    if (!planFile || !planArg || !confirmation || !backupRoot) {
      throw new Error("Apply requires --plan-file, --plan-hash, --confirm, and --backup-dir");
    }
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
  if (apply) {
    try {
      const plan = await readRestrictedPlan(planFile);
      verifyExecutionPlan(plan, planArg.slice(12), confirmation.slice(10));
      const preflight = await pool.connect();
      try {
        const support = (await preflight.query(`
          SELECT to_regclass('public.dedupe_entity_aliases') AS aliases,
                 to_regclass('public.dedupe_apply_ledger') AS ledger
        `)).rows[0];
        if (!support.aliases || !support.ledger) {
          throw new Error("Dedupe support tables are missing; deploy and restart the application before apply");
        }
        const prior = (await preflight.query(
          "SELECT status, backup_manifest_path FROM dedupe_apply_ledger WHERE plan_hash=$1",
          [plan.planHash]
        )).rows[0];
        if (prior?.status === "applied") {
          console.log(JSON.stringify({
            alreadyApplied: true,
            planHash: plan.planHash,
            backupManifestPath: prior.backup_manifest_path,
          }, null, 2));
          return;
        }
        assertSame("Database identity", await databaseIdentity(preflight), plan.database);
      } finally {
        preflight.release();
      }
      const backup = await createVerifiedBackup({ backupRoot });
      const result = await applyExecutionPlan(pool, plan, backup);
      console.log(JSON.stringify(result, null, 2));
      return;
    } finally {
      await pool.end();
    }
  }
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
      op.executionPatch = patch;
      op.operationId = operationId(op);
      op.plannedPatch = reviewPatch(patch);
      op.matchEvidence = [winner, ...losers].map((row) => matchEvidence(row, workplaces));
      op.reviewRows = [winner, ...losers].map(reviewRow);
      op.fieldConflicts = fieldConflicts([winner, ...losers]);
      op.autoReviewBlockers = automaticConflictBlockers([winner, ...losers], op.fieldConflicts);
      if (op.autoReviewBlockers.length) op.autoApplicable = false;
      op.sourceFingerprints = [winner, ...losers].map((row) => ({
        id: String(row.id),
        hash: sourceRowFingerprint(row),
      }));
    }
    const referencesByOperation = await referenceInventories(client, operations);
    for (const op of operations) op.references = referencesByOperation.get(op.operationId);
    const assignmentMerges = plannedAssignmentMerges(assignments.rows, operations);
    const countryApprovedOperations = approveWinnerCountry
      ? operationsForWinnerCountry(operations, approveWinnerCountry)
      : [];
    const effectiveApprovals = [
      ...approvals,
      ...countryApprovedOperations.map((operation) => operation.operationId),
    ];
    const approvedSet = new Set(effectiveApprovals);
    const approvedOperations = operations.filter((operation) =>
      operation.autoApplicable || approvedSet.has(operation.operationId)
    );
    const approvedAssignmentMerges = plannedAssignmentMerges(assignments.rows, approvedOperations);
    const executablePlan = executionPlan({
      database: await databaseIdentity(client),
      operations,
      assignmentMerges: approvedAssignmentMerges,
    }, effectiveApprovals);
    const report = stablePlan({ operations, assignmentMerges });
    if (planFile) {
      await writeRestrictedPlan(planFile, executablePlan);
      report.planFile = planFile;
    }
    delete report.executionPatch;
    report.operations.forEach((operation) => delete operation.executionPatch);
    report.autoApplicable = operations.filter((x) => x.autoApplicable).map(publicOperation);
    report.manualReview = operations.filter((x) => !x.autoApplicable).map(publicOperation);
    report.approvedOperationIds = executablePlan.operations.map((operation) => operation.operationId);
    report.bulkApproval = approveWinnerCountry ? {
      winnerCountry: approveWinnerCountry.toUpperCase(),
      operationCount: countryApprovedOperations.length,
    } : null;
    report.executionPlanHash = executablePlan.planHash;
    if (onlyName) {
      report.inspectionMatches = inspectionMatches(onlyName, people.rows, facilities.rows, workplaces);
    }
    await client.query("ROLLBACK");
    console.log(JSON.stringify(report, null, 2));
    return;
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); await pool.end(); }
}
module.exports = { normalize, normalizeEmail, normalizePhone, personName, facilityName, facilityLocationKey, canonicalize, canonical, mergeFillOnly, mergeAssignment, assignmentMergePlan, plannedAssignmentMerges, referencePolicy, referenceInventory, referenceInventories, fieldConflicts, automaticConflictBlockers, findPeople, findFacilities, inspectionMatches, stablePlan, operationId, executionPlan, verifyExecutionPlan, readRestrictedPlan, databaseIdentity, applyExecutionPlan, reviewRow, parseApprovalArgs, operationsForWinnerCountry, sourceRowFingerprint };
if (require.main === module) main().catch((e) => { console.error(`FATAL: ${e.message}`); process.exitCode = 1; });