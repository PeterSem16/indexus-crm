"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  closure,
  verified,
  loadManifest,
  planClinic,
  executeCleanup,
  parseArgs,
  publicError,
} = require("./reviewed-medical-partner-cleanup.cjs");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function rowFor(guard, extra = {}) {
  return {
    ...guard,
    postal_code: "81101",
    email: " info@ZZZ.sk ",
    email2: null,
    email3: null,
    is_active: true,
    notes: "Pôvodná poznámka",
    ...extra,
  };
}

function database(initialRows, options = {}) {
  let rows = new Map(initialRows.map(row => [row.id, clone(row)]));
  let before;
  let updates = 0;
  const calls = [];
  return {
    calls,
    get rows() { return rows; },
    async query(sql, args = []) {
      const q = sql.replace(/\s+/g, " ").trim();
      calls.push(q);
      const result = data => ({ rows: data, rowCount: data.length });
      if (q.startsWith("BEGIN")) {
        before = new Map([...rows].map(([id, row]) => [id, clone(row)]));
        return result([]);
      }
      if (q === "ROLLBACK") {
        rows = new Map([...before].map(([id, row]) => [id, clone(row)]));
        return result([]);
      }
      if (q === "COMMIT" || q.startsWith("SET LOCAL") ||
          q === "LOCK TABLE dedupe_entity_aliases IN SHARE MODE") return result([]);
      if (q.startsWith("SELECT id,name,country_code")) {
        return result(args[0].filter(id => rows.has(id)).map(id => clone(rows.get(id))));
      }
      if (q.startsWith("SELECT loser_id")) {
        return result(options.redirect ? [{ loser_id: args[0][0] }] : []);
      }
      if (q.startsWith("UPDATE clinics SET")) {
        updates++;
        if (options.failAt === updates) throw Object.assign(new Error("simulated"), { code: "40001" });
        const row = rows.get(args[0]);
        const fields = [...q.matchAll(/"([a-z0-9_]+)"=\$\d+/g)].map(match => match[1]);
        fields.forEach((field, index) => { row[field] = args[index + 1]; });
        return { rows: [], rowCount: row ? 1 : 0 };
      }
      throw new Error(`Unexpected SQL: ${q}`);
    },
  };
}

test("frozen manifest contains exactly 313 unique exact identity guards", () => {
  const manifest = loadManifest();
  assert.equal(manifest.clinics.length, 313);
  assert.equal(new Set(manifest.clinics.map(item => item.id)).size, 313);
  for (const item of manifest.clinics) {
    assert.deepEqual(Object.keys(item).sort(), ["address", "city", "country_code", "id", "name"]);
  }
});

test("pure email planner removes only exact trimmed case-insensitive bogus values", () => {
  const guard = loadManifest().clinics[0];
  const row = rowFor(guard, {
    email: " INFO@ZZZ.SK ",
    email2: "doctor@example.sk",
    email3: "info@zzz.sk.example",
  });
  const plan = planClinic(row, guard, { email: true, verified: false });
  assert.deepEqual(plan.set.email, null);
  assert.ok(!("email2" in plan.set));
  assert.ok(!("email3" in plan.set));
  assert.equal(plan.stats.emailValuesRemoved, 1);
  assert.match(plan.set.notes, /email=„ INFO@ZZZ\.SK “/);
  assert.match(plan.set.notes, /https:\/\/www\.zzz\.sk\/login/);
  assert.ok(plan.set.notes.startsWith("Pôvodná poznámka\n\n"));
  assert.equal(row.email, " INFO@ZZZ.SK ");
  assert.equal(row.is_active, true);
  assert.ok(!("is_active" in plan.set));
});

test("pure verified planner performs only approved closure and Demková enrichments", () => {
  const closing = planClinic(rowFor(closure, { email: null }), closure,
    { email: false, verified: true });
  assert.equal(closing.set.is_active, false);
  assert.match(closing.set.notes, /31\.08\.2024/);
  assert.match(closing.set.notes, /page_id=106643/);

  const demkova = verified.find(item => item.demkova);
  const enriched = planClinic(rowFor(demkova, { email: null, postal_code: "" }), demkova,
    { email: false, verified: true });
  assert.equal(enriched.set.address, "Ochtinská 29");
  assert.equal(enriched.set.city, "Štítnik");
  assert.equal(enriched.set.postal_code, "04932");
  assert.ok(!("phone" in enriched.set));

  const frozenPostal = planClinic(rowFor(demkova, { email: null, postal_code: "447 04" }), demkova,
    { email: false, verified: true });
  assert.equal(frozenPostal.set.postal_code, "04932");
  assert.match(frozenPostal.set.notes, /postal_code opravené z „447 04“ na „04932“/);
  assert.match(frozenPostal.set.notes, /https:\/\/stitnik\.oma\.sk\/zdravotnictvo\/ordinacia/);

  const alreadyCorrect = planClinic(rowFor(demkova, { email: null, postal_code: "04932" }), demkova,
    { email: false, verified: true });
  assert.ok(!("postal_code" in alreadyCorrect.set));

  assert.throws(() => planClinic(
    rowFor(demkova, { email: null, postal_code: "99999" }),
    demkova,
    { email: false, verified: true }
  ), /Zmenené PSČ/);
});

test("verified planner is idempotent after approved address change and notes", () => {
  const guard = verified.find(item => item.demkova);
  const first = planClinic(rowFor(guard, { email: null, postal_code: "" }), guard,
    { email: false, verified: true });
  const after = { ...rowFor(guard, { email: null, postal_code: "" }), ...first.set };
  const second = planClinic(after, guard, { email: false, verified: true });
  assert.deepEqual(second.set, {});
});

test("default execution is read-only and never locks or updates", async () => {
  const guard = loadManifest().clinics[0];
  const db = database([rowFor(guard)]);
  const result = await executeCleanup(db, {
    apply: false, email: true, verified: false,
    manifest: { clinics: [guard] },
  });
  assert.equal(result.applied, false);
  assert.equal(db.calls.at(-1), "ROLLBACK");
  assert.ok(db.calls[0].includes("READ ONLY"));
  assert.ok(!db.calls.some(call => call.includes("FOR UPDATE") || call.startsWith("UPDATE")));
  assert.equal(db.rows.get(guard.id).email, " info@ZZZ.sk ");
});

test("apply takes row locks, commits, and repeat is idempotent", async () => {
  const guard = loadManifest().clinics[0];
  const db = database([rowFor(guard)]);
  const options = {
    apply: true, email: true, verified: false,
    manifest: { clinics: [guard] },
  };
  const first = await executeCleanup(db, options);
  assert.equal(first.emailValuesRemoved, 1);
  assert.equal(db.rows.get(guard.id).email, null);
  assert.ok(db.calls.some(call => call.endsWith("FOR UPDATE")));
  const aliasLock = db.calls.indexOf("LOCK TABLE dedupe_entity_aliases IN SHARE MODE");
  const rowLock = db.calls.findIndex(call => call.endsWith("FOR UPDATE"));
  assert.ok(aliasLock >= 0 && aliasLock < rowLock);
  assert.equal(db.calls.at(-1), "COMMIT");
  const notes = db.rows.get(guard.id).notes;
  const second = await executeCleanup(db, options);
  assert.equal(second.rowsChanged, 0);
  assert.equal(db.rows.get(guard.id).notes, notes);
});

test("failure rolls back all earlier updates", async () => {
  const guards = loadManifest().clinics.slice(0, 2);
  const db = database(guards.map(rowFor), { failAt: 2 });
  await assert.rejects(executeCleanup(db, {
    apply: true, email: true, verified: false,
    manifest: { clinics: guards },
  }), /simulated/);
  assert.equal(db.calls.at(-1), "ROLLBACK");
  for (const guard of guards) assert.equal(db.rows.get(guard.id).email, " info@ZZZ.sk ");
});

test("changed identity and redirected clinics fail closed without writes", async () => {
  const guard = loadManifest().clinics[0];
  for (const [row, options] of [
    [rowFor(guard, { city: "Iné mesto" }), {}],
    [rowFor(guard), { redirect: true }],
  ]) {
    const db = database([row], options);
    await assert.rejects(executeCleanup(db, {
      apply: true, email: true, verified: false,
      manifest: { clinics: [guard] },
    }));
    assert.equal(db.calls.at(-1), "ROLLBACK");
    assert.ok(!db.calls.some(call => call.startsWith("UPDATE")));
  }
});

test("CLI flags never imply silent writes", () => {
  assert.deepEqual(parseArgs([]), { apply: false, email: true, verified: true });
  assert.deepEqual(parseArgs(["--apply-email-cleanup"]),
    { apply: true, email: true, verified: false });
  assert.deepEqual(parseArgs(["--apply-verified-updates"]),
    { apply: true, email: false, verified: true });
  assert.deepEqual(parseArgs(["--apply-all"]),
    { apply: true, email: true, verified: true });
  assert.throws(() => parseArgs(["--apply"]), /Neznámy parameter/);
});

test("public error formatting never exposes unknown database or network messages", () => {
  const error = Object.assign(
    new Error("connect postgres://user:secret@example.invalid/private"),
    { code: "ECONNREFUSED" }
  );
  assert.equal(publicError(error), "neočakávaná chyba (kód ECONNREFUSED)");
  assert.doesNotMatch(publicError(error), /secret|example|postgres/i);
});