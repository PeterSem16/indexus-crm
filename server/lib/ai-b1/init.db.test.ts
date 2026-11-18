import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { runB1 } from "./run";
import { pool } from "../../db";

test("B1 initialization and readiness use only an isolated schema and create no jobs (fixture, not internal readiness)",
  async () => {
    assert(process.env.REPLIT_DEV_DOMAIN || process.env.REPL_ID);
    const schema = "b1_init_" + randomUUID().replaceAll("-", "");
    const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const makePool = () => new pg.Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema},public` });
    const config = { uiPassword: "synthetic", sessionSecret: "synthetic" };
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      const init = makePool();
      await init.query("CREATE TABLE b1_environment(singleton boolean PRIMARY KEY)");
      await runB1(init, config, "init");
      const verify = makePool();
      const value = (await verify.query("SELECT value FROM ai_router_configuration")).rows[0].value;
      assert.deepEqual(Object.keys(value.routes), ["task.checklist"]);
      assert.equal(value.gateway.timeoutMs, 120000); assert.equal(value.gateway.maxRetries, 0);
      assert.equal((await verify.query("SELECT count(*)::integer AS n FROM ai_jobs")).rows[0].n, 0);
      await verify.end();
      await runB1(makePool(), config, "check");
      assert.equal(process.env.AI_JOBS_TASK_CHECKLIST_ENABLED, "true");
      assert.equal(process.env.AI_JOBS_TASK_RESOLUTION_ENABLED, "false");
      assert.equal(process.env.AI_JOBS_EMAIL_SUMMARY_ENABLED, "false");
    } finally {
      await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); await pool.end();
    }
  });
