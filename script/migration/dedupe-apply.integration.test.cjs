const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { spawnSync } = require("node:child_process");
const { Pool } = require("pg");
const d = require("./dedupe-collaborators-facilities.cjs");
const trace = (message) => {
  if (process.env.DEDUPE_TEST_TRACE === "1") process.stderr.write(`[dedupe-integration] ${message}\n`);
};

const run = (command, args) => {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
  }
};

async function unusedPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function snapshot(pool) {
  const tables = [
    "collaborators", "contact_assignments", "agreements", "teams", "links",
    "audit_history", "dedupe_entity_aliases", "dedupe_apply_ledger",
  ];
  const result = {};
  for (const table of tables) {
    result[table] = (await pool.query(`SELECT * FROM ${table} ORDER BY 1`)).rows;
  }
  return result;
}

test("real PostgreSQL apply is atomic, redirects all supported references, and is idempotent", { timeout: 120000 }, async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dedupe-pg-"));
  const data = path.join(root, "data");
  const socket = path.join(root, "socket");
  fs.mkdirSync(socket, { mode: 0o700 });
  const port = await unusedPort();
  run("initdb", ["--no-locale", "--encoding=UTF8", "--auth=trust", "-D", data]);
  trace("initdb complete");
  run("pg_ctl", [
    "-D", data,
    "-l", path.join(root, "postgres.log"),
    "-o", `-F -p ${port} -k ${socket}`,
    "-w", "start",
  ]);
  trace("postgres started");
  t.after(() => {
    spawnSync("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"], { encoding: "utf8" });
    fs.rmSync(root, { recursive: true, force: true });
  });

  const pool = new Pool({
    host: socket,
    port,
    database: "postgres",
    user: os.userInfo().username,
    max: 4,
  });
  t.after(() => pool.end());

  await pool.query(`
    CREATE TABLE collaborators (
      id varchar PRIMARY KEY,
      legacy_id varchar,
      email varchar,
      data_source varchar,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE clinics (
      id varchar PRIMARY KEY,
      legacy_id varchar,
      is_active boolean NOT NULL DEFAULT true,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE hospitals (LIKE clinics INCLUDING ALL);
    CREATE TABLE contact_assignments (
      id varchar PRIMARY KEY,
      person_id varchar NOT NULL,
      entity_type varchar NOT NULL,
      entity_id varchar NOT NULL,
      category_id varchar,
      cbc_activity_codes text[] NOT NULL DEFAULT '{}',
      is_primary boolean NOT NULL DEFAULT false,
      is_active boolean NOT NULL DEFAULT true,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE agreements (id varchar PRIMARY KEY, collaborator_id varchar);
    CREATE TABLE teams (id varchar PRIMARY KEY, collaborator_ids text[]);
    CREATE TABLE links (id varchar PRIMARY KEY, entity_type varchar, entity_id varchar);
    CREATE TABLE audit_history (id varchar PRIMARY KEY, person_id varchar);
    CREATE TABLE dedupe_entity_aliases (
      id bigserial PRIMARY KEY,
      entity_kind varchar NOT NULL,
      source varchar NOT NULL,
      legacy_id varchar NOT NULL,
      loser_id varchar NOT NULL,
      canonical_id varchar NOT NULL,
      plan_hash varchar NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(entity_kind, source, legacy_id)
    );
    CREATE TABLE dedupe_apply_ledger (
      plan_hash varchar PRIMARY KEY,
      status varchar NOT NULL,
      backup_manifest_path text NOT NULL,
      operation_count integer NOT NULL,
      details jsonb,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
    INSERT INTO collaborators (id, legacy_id, email, data_source) VALUES
      ('winner', NULL, NULL, 'manual'),
      ('loser', '393', 'person@example.test', 'iscbc');
    INSERT INTO contact_assignments
      (id, person_id, entity_type, entity_id, category_id, cbc_activity_codes, is_primary)
    VALUES
      ('assignment-a', 'winner', 'clinic', 'clinic-a', 'gynecology', ARRAY['A'], false),
      ('assignment-b', 'loser', 'clinic', 'clinic-a', 'gynecology', ARRAY['B'], true);
    INSERT INTO agreements VALUES ('agreement-a', 'loser');
    INSERT INTO teams VALUES ('team-a', ARRAY['loser']);
    INSERT INTO links VALUES ('link-a', 'collaborator', 'loser');
    INSERT INTO audit_history VALUES ('audit-a', 'loser');
  `);
  trace("schema and fixtures created");

  const sourceRows = (await pool.query(
    "SELECT * FROM collaborators WHERE id=ANY($1::varchar[]) ORDER BY id",
    [["winner", "loser"]]
  )).rows;
  const operation = {
    kind: "person",
    winnerId: "winner",
    loserIds: ["loser"],
    autoApplicable: true,
    executionPatch: { email: "person@example.test", legacy_id: "393" },
    sourceFingerprints: sourceRows.map((row) => ({
      id: String(row.id),
      hash: crypto.createHash("sha256").update(JSON.stringify(row)).digest("hex"),
    })),
  };
  operation.references = await d.referenceInventory(pool, operation);
  trace("reference inventory built");
  const assignments = (await pool.query("SELECT * FROM contact_assignments ORDER BY id")).rows;
  const assignmentMerges = d.plannedAssignmentMerges(assignments, [operation]);
  const plan = d.executionPlan({
    database: await d.databaseIdentity(pool),
    operations: [operation],
    assignmentMerges,
  });
  const backup = {
    manifestPath: "/private/verified-backup.manifest.json",
    manifest: { dump: { sha256: "verified-test-sha256" } },
  };
  const baseline = await snapshot(pool);
  trace("plan and baseline built");

  for (const phase of ["patches", "aliases", "references", "assignments", "deactivation", "ledger"]) {
    trace(`fault phase ${phase} started`);
    await assert.rejects(
      d.applyExecutionPlan(pool, plan, backup, { faultAfterPhase: phase }),
      new RegExp(`after ${phase}`)
    );
    assert.deepEqual(await snapshot(pool), baseline, `rollback after ${phase}`);
    trace(`fault phase ${phase} rolled back`);
  }

  trace("successful apply started");
  const applied = await d.applyExecutionPlan(pool, plan, backup);
  assert.equal(applied.applied, true);
  assert.equal((await pool.query("SELECT email, legacy_id FROM collaborators WHERE id='winner'")).rows[0].email, "person@example.test");
  assert.equal((await pool.query("SELECT is_active FROM collaborators WHERE id='loser'")).rows[0].is_active, false);
  assert.equal((await pool.query("SELECT collaborator_id FROM agreements")).rows[0].collaborator_id, "winner");
  assert.deepEqual((await pool.query("SELECT collaborator_ids FROM teams")).rows[0].collaborator_ids, ["winner"]);
  assert.equal((await pool.query("SELECT entity_id FROM links")).rows[0].entity_id, "winner");
  assert.equal((await pool.query("SELECT person_id FROM audit_history")).rows[0].person_id, "loser");
  assert.deepEqual(
    (await pool.query("SELECT canonical_id, loser_id FROM dedupe_entity_aliases")).rows[0],
    { canonical_id: "winner", loser_id: "loser" }
  );
  assert.deepEqual(
    (await pool.query("SELECT id, is_active, person_id, cbc_activity_codes, is_primary FROM contact_assignments ORDER BY id")).rows,
    [
      { id: "assignment-a", is_active: true, person_id: "winner", cbc_activity_codes: ["A", "B"], is_primary: true },
      { id: "assignment-b", is_active: false, person_id: "winner", cbc_activity_codes: ["B"], is_primary: true },
    ]
  );
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM dedupe_apply_ledger")).rows[0].count, 1);

  const rerun = await d.applyExecutionPlan(pool, plan, backup);
  assert.equal(rerun.alreadyApplied, true);
  assert.equal((await pool.query("SELECT count(*)::int AS count FROM dedupe_apply_ledger")).rows[0].count, 1);
  trace("successful apply and rerun verified");
});