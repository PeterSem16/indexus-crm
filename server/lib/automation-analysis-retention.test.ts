import assert from "node:assert/strict";
import test from "node:test";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { mkdtemp, writeFile, readFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { transformSync } from "esbuild";
import { ANALYSIS_RETENTION_SCHEMA, cleanAutomationAnalysis, validAnalysisStorageKey } from "./automation-analysis-retention";
import { admitAutomationRun } from "./automation-run-admission";
import { attachmentActivity } from "./automation-attachment-activity";
import { ensureAutomationRetrySchema } from "./automation-retry-schema";

async function fixture() {
  const schema = `analysis_retention_${randomUUID().replace(/-/g, "")}`;
  const directory = await mkdtemp(join(tmpdir(), "analysis-retention-"));
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const setup = await pool.connect();
  await setup.query(`CREATE SCHEMA "${schema}"; SET search_path TO "${schema}";
    CREATE TABLE workflow_analysis_cache (
      cache_key text PRIMARY KEY, owner_user_id text NOT NULL, result jsonb,
      error_code text, created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE task_attachment_uploads (
      id text PRIMARY KEY, storage_key text UNIQUE, uploader_user_id text,
      ever_associated boolean DEFAULT false, association_history jsonb DEFAULT '[]',
      created_at timestamptz DEFAULT now());
    CREATE TABLE tasks (id text PRIMARY KEY, status text, attachments jsonb, forward_review jsonb);
    CREATE TABLE task_comments (metadata jsonb);
    CREATE TABLE chat_messages (attachments jsonb);
    CREATE TABLE automation_record_entries (attachments jsonb);
    CREATE TABLE workflow_rules (id text PRIMARY KEY, rate_limit_per_hour integer);
    CREATE TABLE workflow_runs (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text, rule_id text, event_id text,
      status text, payload jsonb, skipped_reason text, causation_chain text[],
      started_at timestamptz DEFAULT now(), finished_at timestamptz);
    INSERT INTO workflow_rules VALUES ('rule',NULL);
  `);
  await setup.query(ANALYSIS_RETENTION_SCHEMA);
  const scoped = { connect: async () => {
    const client = await pool.connect();
    await client.query(`SET search_path TO "${schema}"`);
    return client;
  } };
  const upload = async (cacheKey: string | null, days = 100) => {
    const id = randomUUID(), storageKey = `${randomUUID()}.pdf`;
    await writeFile(join(directory, storageKey), "private original", { mode: 0o600 });
    await setup.query(`INSERT INTO task_attachment_uploads
      (id,storage_key,uploader_user_id,analysis_cache_key,created_at)
      VALUES($1,$2,'owner',$3,now()-$4::int*interval '1 day')`, [id, storageKey, cacheKey, days]);
    return { id, storageKey, url: `/api/tasks/attachments/${id}` };
  };
  const cache = async (key: string, result: any, days = 100, status: string | null = "success", mapped = true) => {
    await setup.query(`INSERT INTO workflow_analysis_cache
      (cache_key,owner_user_id,result,error_code,created_at,rule_id,event_id)
      VALUES($1,'owner',$2,$3,now()-$4::int*interval '1 day',$5,$6)`,
    [key, result, result ? null : "analysis_failed", days, mapped ? "rule" : null, mapped ? key : null]);
    if (status) await setup.query("INSERT INTO workflow_runs(rule_id,event_id,status,payload) VALUES('rule',$1,$2,'{}')", [key, status]);
  };
  return { setup, scoped, directory, upload, cache,
    clean: () => cleanAutomationAnalysis(scoped, directory),
    close: async () => {
      await setup.query(`DROP SCHEMA "${schema}" CASCADE`);
      setup.release();
      await pool.end();
      await rm(directory, { recursive: true, force: true });
    } };
}

test("retention keeps every live/historical reference and collects only old analysis-owned orphans", async () => {
  const f = await fixture();
  try {
    const retained: { id: string; storageKey: string; url: string }[] = [];
    for (const kind of ["open", "completed", "comment", "run-url", "record", "chat", "associated", "association-history", "forward-review", "recent", "manual"]) {
      const file = await f.upload(kind === "manual" ? null : kind, kind === "recent" ? 1 : 100);
      retained.push(file);
      if (kind === "open" || kind === "completed") await f.setup.query(
        "INSERT INTO tasks(id,status,attachments) VALUES($1,$2,$3)", [kind, kind === "open" ? "pending" : "completed", JSON.stringify([file])]);
      if (kind === "comment") await f.setup.query("INSERT INTO task_comments VALUES($1)", [{ attachments: [file] }]);
      if (kind === "run-url") await f.setup.query("INSERT INTO workflow_runs(payload) VALUES($1)", [{ old: { attachment: { url: file.url } } }]);
      if (kind === "record") await f.setup.query("INSERT INTO automation_record_entries VALUES($1)", [JSON.stringify([file])]);
      if (kind === "chat") await f.setup.query("INSERT INTO chat_messages VALUES($1)", [JSON.stringify([file])]);
      if (kind === "associated") await f.setup.query("UPDATE task_attachment_uploads SET ever_associated=true WHERE id=$1", [file.id]);
      if (kind === "association-history") await f.setup.query("UPDATE task_attachment_uploads SET association_history=$1 WHERE id=$2", [JSON.stringify([{ taskId: "deleted-task" }]), file.id]);
      if (kind === "forward-review") await f.setup.query("INSERT INTO tasks(id,forward_review) VALUES('review',$1)", [{ files: [file] }]);
    }
    // Successful cache can expire when a terminal run exists; the run remains
    // the authority for dedup even when it did not save attachment details.
    const orphan = await f.upload("expired");
    await f.cache("expired", { attachments: [orphan] });
    const failedPartial = await f.upload("error");
    await f.cache("error", null, 8, null);
    const cached = await f.upload("cached");
    retained.push(cached);
    await f.cache("cached", { attachments: [cached] }, 10);
    const running = await f.upload("running");
    retained.push(running);
    await f.cache("running", { attachments: [running] }, 100, "running");
    // Legacy snapshots are identified from the cache, not arbitrary uploads.
    const legacy = await f.upload(null);
    retained.push(legacy);
    const result = { attachments: [legacy] };
    await f.cache("legacy", result, 100, null, false);
    await f.setup.query("INSERT INTO workflow_runs(rule_id,event_id,status,payload) VALUES('rule','legacy','success',$1)", [{ analysis: result }]);
    await f.cache("legacy-unmapped", { summary: "no provable saved history" }, 100, null, false);
    const counts = await f.clean();
    assert.deepEqual(counts, { caches: 3, uploads: 2, files: 2 });
    for (const file of retained) {
      assert.equal(await readFile(join(f.directory, file.storageKey), "utf8"), "private original");
      assert.equal((await f.setup.query("SELECT id FROM task_attachment_uploads WHERE id=$1", [file.id])).rows.length, 1);
    }
    for (const file of [orphan, failedPartial]) {
      await assert.rejects(readFile(join(f.directory, file.storageKey)), { code: "ENOENT" });
    }
    assert.equal((await f.setup.query("SELECT * FROM workflow_analysis_tombstones")).rows.length, 2);
    assert.equal((await f.setup.query("SELECT * FROM workflow_runs WHERE event_id='expired'")).rows.length, 1);
    assert.equal((await f.setup.query("SELECT * FROM workflow_analysis_cache WHERE cache_key='legacy-unmapped'")).rows.length, 1);
    const savedRun = (await f.setup.query("SELECT payload FROM workflow_runs WHERE event_id='legacy'")).rows[0];
    assert.deepEqual(savedRun.payload.analysis, result);
    const activity = await attachmentActivity({ ruleId: "rule", eventId: "legacy", payload: savedRun.payload } as any, "viewer", {
      rule: async () => ({ id: "rule" }) as any,
      event: async () => ({ id: "legacy" }) as any,
      canRead: async () => true,
    });
    assert.equal(activity.status, "available");
    assert.equal(activity.outcomes.length, 1);
    assert.equal((await f.setup.query("SELECT * FROM workflow_analysis_cache WHERE cache_key='legacy'")).rows.length, 0);
    assert.deepEqual(await f.clean(), { caches: 0, uploads: 0, files: 0 });
    // A request that validated the upload before cleanup must not resurrect a
    // now-missing file, even after the unlink queue has finished.
    await assert.rejects(f.setup.query("INSERT INTO tasks(id,attachments) VALUES('stale',$1)", [JSON.stringify([orphan])]),
      { code: "23503" });
    await assert.rejects(f.setup.query("INSERT INTO workflow_runs(payload) VALUES($1)", [{ analysis: { attachments: [orphan] } }]),
      { code: "23503" });
  } finally { await f.close(); }
});

test("manual analysis snapshots survive cache eviction and reject references to retired originals", async () => {
  const f = await fixture();
  try {
    await ensureAutomationRetrySchema(f.setup);
    const file = await f.upload("manual-retry");
    const analysis = { attachments: [file] };
    await f.cache("manual-retry", analysis);
    const id = randomUUID();
    await f.setup.query(`INSERT INTO workflow_analysis_retries
      (id,rule_id,event_id,requested_by,request_id,definition_hash,status,analysis)
      VALUES($1,'rule','manual-retry','owner',$2,'reviewed','ready',$3)`,
    [id, randomUUID(), JSON.stringify(analysis)]);
    await f.clean();
    assert.equal((await f.setup.query("SELECT 1 FROM workflow_analysis_cache WHERE cache_key='manual-retry'")).rows.length, 0);
    assert.equal((await f.setup.query("SELECT 1 FROM task_attachment_uploads WHERE id=$1", [file.id])).rows.length, 1);
    assert.ok(await readFile(join(f.directory, file.storageKey)));
    await f.setup.query("UPDATE workflow_analysis_retries SET status='done' WHERE id=$1", [id]);
    await f.clean();
    assert.ok(await readFile(join(f.directory, file.storageKey)), "manual audit history retains its private original");
    await f.setup.query("DELETE FROM workflow_analysis_retries WHERE id=$1", [id]);
    await f.clean();
    await assert.rejects(readFile(join(f.directory, file.storageKey)));
    await assert.rejects(f.setup.query(`INSERT INTO workflow_analysis_retries
      (rule_id,event_id,requested_by,request_id,definition_hash,analysis)
      VALUES('rule','manual-retry','owner',$1,'reviewed',$2)`, [randomUUID(), JSON.stringify(analysis)]),
    /retired/i);
  } finally { await f.close(); }
});

test("active analysis locks, absent history schema and concurrent cleaners fail closed", async () => {
  const f = await fixture();
  const other = await f.scoped.connect();
  try {
    await f.cache("active", { attachments: [] });
    await other.query("SELECT pg_advisory_lock(hashtext('active'))");
    await f.clean();
    assert.equal((await f.setup.query("SELECT * FROM workflow_analysis_cache WHERE cache_key='active'")).rows.length, 1);
    await other.query("SELECT pg_advisory_unlock(hashtext('active'))");
    await other.query("SELECT pg_advisory_lock(hashtext('indexus:analysis-retention'))");
    assert.deepEqual(await f.clean(), { caches: 0, uploads: 0, files: 0 });
    await other.query("SELECT pg_advisory_unlock(hashtext('indexus:analysis-retention'))");
    await f.setup.query("DROP TABLE automation_record_entries");
    const orphan = await f.upload("unmapped-error");
    await f.clean();
    assert.equal(await readFile(join(f.directory, orphan.storageKey), "utf8"), "private original");
  } finally { other.release(); await f.close(); }
});

test("failed unlink resumes durably, rollback deletes nothing and unsafe paths are rejected", async () => {
  const f = await fixture();
  const other = await f.scoped.connect();
  try {
    const orphan = await f.upload("partial-failure");
    await other.query("BEGIN; LOCK TABLE tasks IN ROW EXCLUSIVE MODE");
    await assert.rejects(f.clean(), { code: "55P03" });
    await other.query("ROLLBACK");
    assert.equal((await f.setup.query("SELECT id FROM task_attachment_uploads WHERE id=$1", [orphan.id])).rows.length, 1);
    assert.equal(await readFile(join(f.directory, orphan.storageKey), "utf8"), "private original");
    await rm(join(f.directory, orphan.storageKey));
    await mkdir(join(f.directory, orphan.storageKey));
    await assert.rejects(f.clean(), { code: "EISDIR" });
    assert.equal((await f.setup.query("SELECT * FROM workflow_analysis_file_deletions WHERE cleaned_at IS NULL")).rows.length, 1);
    await rm(join(f.directory, orphan.storageKey), { recursive: true });
    await writeFile(join(f.directory, orphan.storageKey), "retry");
    assert.deepEqual(await f.clean(), { caches: 0, uploads: 0, files: 1 });
    for (const key of ["../elsewhere.pdf", "/etc/passwd", "not-a-snapshot.pdf", `${randomUUID()}.pdf/../x`]) {
      assert.equal(validAnalysisStorageKey(key), false);
    }
    assert.equal(validAnalysisStorageKey(`${randomUUID()}.pdf`), true);
  } finally { await other.query("ROLLBACK"); other.release(); await f.close(); }
});

test("cache eviction never repeats analysis or previously admitted actions", async () => {
  const f = await fixture();
  try {
    const config = { analyzeContent: true };
    const key = createHash("sha256").update(JSON.stringify(["communication-private-attachments-v2", "rule", "event", config])).digest("hex");
    await f.cache(key, { summary: "finished" }, 100, null);
    await f.setup.query("INSERT INTO workflow_runs(rule_id,event_id,status,payload) VALUES('rule','event','success','{}')");
    await f.setup.query("UPDATE workflow_analysis_cache SET event_id='event' WHERE cache_key=$1", [key]);
    assert.equal((await f.clean()).caches, 1);
    const require = createRequire(import.meta.url);
    const module = { exports: {} as any };
    const code = transformSync(readFileSync(new URL("./automation-analysis.ts", import.meta.url), "utf8"), { loader: "ts", format: "cjs" }).code;
    let sourceReads = 0;
    const overrides: Record<string, unknown> = {
      "../db": { db: { execute: async () => undefined }, pool: f.scoped },
      "./automation-analysis-source": { loadAnalysisSource: async () => { sourceReads++; return { text: "private", communication: {} }; } },
    };
    new Function("module", "exports", "require", code)(module, module.exports,
      (id: string) => Object.prototype.hasOwnProperty.call(overrides, id) ? overrides[id] : require(id));
    await assert.rejects(module.exports.analyzeCommunication(
      { id: "rule", createdByUserId: "owner", trigger: { analysis: config } }, { id: "event" }),
    /analysis_result_expired/);
    assert.equal(sourceReads, 1); // Access is still checked; AI/actions never run.
    let actions = 0;
    for (const status of ["success", "running", "failed", "skipped"]) {
      await f.setup.query("UPDATE workflow_runs SET status=$1 WHERE event_id='event'", [status]);
      const admitted = await admitAutomationRun(f.scoped, {
        ruleId: "rule", eventId: "event", payload: {}, causationChain: [], deduplicateEvent: true,
      });
      if (admitted.admitted) actions++;
    }
    assert.equal(actions, 0);
    const engine = readFileSync(new URL("./automation-engine.ts", import.meta.url), "utf8");
    assert.match(engine, /deduplicateEvent: \(event.eventType === "chat.received" \|\| Boolean\(\(rule.trigger as any\)\?\.analysis\)\) && !manual/);
    assert.doesNotMatch(engine, /\bstartAutomationAnalysisRetention\s*\(/,
      "production startup must not enable deletion without separate approval");
  } finally { await f.close(); }
});
