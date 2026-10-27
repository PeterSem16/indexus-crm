const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { parseDatabaseUrl, dumpEnvironment, guardSnapshot } = require("./automation-production-db-admin.cjs");
const script = path.join(__dirname, "apply-automation-production-release.sh");
const quote = value => `'${String(value).replaceAll("'", "'\\''")}'`;

test("application requires explicit maintenance approval and valid shell syntax", () => {
  assert.equal(spawnSync("bash", ["-n", script]).status, 0);
  for (const args of [[], ["--apply"], ["--prepare"], ["--apply", "--allow-restart"]]) {
    const result = spawnSync("bash", [script, ...args], { encoding: "utf8" });
    assert.equal(result.status, 2);
    assert.match(result.stdout, /Usage:/);
  }
});

test("backup connection parsing preserves punctuation without exposing a URI to pg_dump arguments", () => {
  const password = "synthetic-only+!@$:/";
  const value = `postgresql://fixture:${encodeURIComponent(password)}@127.0.0.1:5433/fixture_db?sslmode=require`;
  assert.equal(parseDatabaseUrl(`UNRELATED=not shell code\r\nDATABASE_URL='${value}'\r\n`), value);
  const env = dumpEnvironment(value, { PGSERVICE: "wrong", PGHOSTADDR: "192.0.2.1", DATABASE_URL: "wrong", KEEP: "yes" });
  assert.equal(env.PGPASSWORD, password);
  assert.equal(env.PGDATABASE, "fixture_db");
  assert.equal(env.PGPORT, "5433");
  assert.equal(env.PGSSLMODE, "require");
  assert.equal(env.KEEP, "yes");
  assert.equal(env.PGSERVICE, undefined);
  assert.equal(env.PGHOSTADDR, undefined);
  assert.equal(env.DATABASE_URL, undefined);
  assert.throws(() => parseDatabaseUrl("DATABASE_URL=https://example.invalid/db"), /CONFIG_INVALID/);
  assert.throws(() => dumpEnvironment(value + "&unexpected=value", {}), /PARAMETER_UNSUPPORTED/);
});

test("an absent-to-empty service table preserves policy identity; activation or approval changes do not", async () => {
  async function snapshot({ table = false, enabled = false, owner = "compatible", groups = [] } = {}) {
    return guardSnapshot({ query: async sql => {
      if (sql.includes("to_regclass")) return { rows: [{ t: table ? "mission_callback_groups" : null }] };
      if (sql.includes("mission_callback_ownership")) return { rows: [{ campaign_id: "mission", owner, fingerprint: "reviewed" }] };
      if (sql.includes("mission_callback_candidates")) return { rows: [{ automation_id: "action", definition: { safe: true } }] };
      if (sql.includes("workflow_rules")) return { rows: [{ id: "rule", enabled }] };
      if (sql.includes("automatic_configs")) return { rows: [] };
      if (sql.includes("mission_callback_groups")) return { rows: groups };
      throw new Error("Unexpected policy query");
    } });
  }
  assert.deepEqual(await snapshot(), await snapshot({ table: true }));
  assert.notEqual((await snapshot()).sha256, (await snapshot({ enabled: true })).sha256);
  assert.notEqual((await snapshot()).sha256, (await snapshot({ owner: "legacy" })).sha256);
  assert.notEqual((await snapshot()).sha256,
    (await snapshot({ table: true, groups: [{ campaign_id: "mission", enrolled: true }] })).sha256);
});

test("frontend assembly retains old hashed assets while promoting the new document", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "automation-overlay-test-"));
  try {
    for (const name of ["old", "new"]) fs.mkdirSync(path.join(dir, name));
    fs.writeFileSync(path.join(dir, "old", "index.html"), "old document");
    fs.writeFileSync(path.join(dir, "old", "old-hash.js"), "old asset");
    fs.writeFileSync(path.join(dir, "new", "index.html"), "new document");
    fs.writeFileSync(path.join(dir, "new", "new-hash.js"), "new asset");
    const result = spawnSync("bash", ["-c", `source ${quote(script)}; merge_public ${quote(path.join(dir, "old"))} ${quote(path.join(dir, "new"))} ${quote(path.join(dir, "merged"))}`],
      { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.readFileSync(path.join(dir, "merged", "index.html"), "utf8"), "new document");
    assert.equal(fs.readFileSync(path.join(dir, "merged", "old-hash.js"), "utf8"), "old asset");
    assert.equal(fs.readFileSync(path.join(dir, "merged", "new-hash.js"), "utf8"), "new asset");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("rollback restores only runtime, uses the compatible backend, and stops when archive restoration fails", () => {
  for (const failArchive of [false, true]) {
    const result = spawnSync("bash", ["-c", `source ${quote(script)}
ROOT=/fixture; BACKUP=/private-backup; OWNER=1000; GROUP=1000; MODE=644
pm2() { echo "PM2:$*"; }
sudo() { echo "SUDO:$*"; ${failArchive ? 'if [ "$1" = tar ]; then return 1; fi' : ':'}; }
install_index() { echo "INSTALL:$1"; }
wait_ready() { echo READY; }
rollback_runtime`], { encoding: "utf8" });
    if (failArchive) {
      assert.notEqual(result.status, 0);
      assert.doesNotMatch(result.stdout, /INSTALL:|PM2:restart|READY/);
    } else {
      assert.equal(result.status, 0);
      assert.match(result.stdout, /PM2:stop[\s\S]*tar -xpf[\s\S]*INSTALL:\/private-backup\/rollback-index.cjs[\s\S]*PM2:restart[\s\S]*READY/);
    }
    assert.doesNotMatch(result.stdout, /pg_restore|database\.dump/);
  }
});
