import type { Pool } from "pg";
import { B1_SCHEMA } from "./schema";
import { AI_JOBS_SCHEMA } from "../ai-jobs/schema-migration";
import { AISettingsStore } from "../ai/settings-store";
import { GATEWAY_URL } from "../ai/settings-policy";
import { THREE_SERVICE_CANDIDATE_ROUTES } from "../ai/three-services-profile";
import { installAIAdminReload } from "../ai/admin-runtime";
import { assertJobSchema } from "../ai-jobs/readiness";
import { createAIJobRuntime } from "../ai-jobs/runtime";
import { createJobWorker } from "../ai-jobs/worker";
import { executeJob } from "../ai-jobs/handlers";
import { createB1App } from "./app";
import { serveStatic } from "../../static";

type Stage = "checklist" | "resolution" | "summary";
const check = (value: unknown, code: string) => { if (!value) throw Error(code); };
export async function runB1(pool: Pool, config: { sessionSecret: string; uiPassword: string }, mode: string) {
  const settings = new AISettingsStore(pool);
  if (mode === "init") {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const tables = await client.query(`SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname=current_schema() AND c.relkind IN ('r','p','v','m','S','f')`);
      check(tables.rows.length === 1 && tables.rows[0].relname === "b1_environment", "B1_FRESH_MARKER_ONLY_REQUIRED");
      await client.query(B1_SCHEMA + AI_JOBS_SCHEMA);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    await settings.initialize();
    const current = await settings.read();
    await settings.mutate(current.version, "b1-operator", "b1-initialize", () => ({
      gateway: { baseURL: GATEWAY_URL, enabled: true, timeoutMs: 120000, maxRetries: 0, temperature: null, maxTokens: null },
      routes: { "task.checklist": THREE_SERVICE_CANDIDATE_ROUTES["task.checklist"] },
    }));
    console.info(JSON.stringify({ initialized: true, workerStarted: false, inferenceRequests: 0 }));
    await pool.end(); return;
  }
  await assertJobSchema(pool);
  const stage: Stage = (await pool.query("SELECT stage FROM b1_stage WHERE singleton=true")).rows[0]?.stage;
  check(["checklist", "resolution", "summary"].includes(stage), "B1_STAGE_INVALID");
  process.env.AI_JOBS_TASK_CHECKLIST_ENABLED = String(stage === "checklist");
  process.env.AI_JOBS_TASK_RESOLUTION_ENABLED = String(stage === "resolution");
  process.env.AI_JOBS_EMAIL_SUMMARY_ENABLED = "false";
  const current = await settings.read();
  const service = stage === "checklist" ? "task.checklist" : "task.resolution";
  check(stage !== "summary" && current.value.gateway.enabled && current.value.gateway.maxRetries === 0 &&
    current.value.gateway.baseURL === GATEWAY_URL &&
    current.value.gateway.timeoutMs === 120000 &&
    current.value.routes[service]?.provider === "internal" &&
    current.value.routes[service]?.model === THREE_SERVICE_CANDIDATE_ROUTES[service].model &&
    current.value.routes[service]?.enabled, "B1_APPROVED_ROUTE_REQUIRED");
  installAIAdminReload(async () => { await settings.read(); });
  if (mode === "check") {
    console.info(JSON.stringify({ database: "indexus_ai_b1", stage, timeoutMs: 120000, concurrency: 1,
      sourceCommit: process.env.INDEXUS_B1_COMMIT ?? "local-fixture",
      workerStarted: false, inferenceRequests: 0, mailboxTest: "blocked_not_authorized" }));
    await pool.end(); return;
  }
  if (mode === "report" || mode === "accept-checklist") {
    const jobs = (await pool.query(`SELECT id,service,status,attempts,metrics,result,error_code,created_at,
      started_at,finished_at,history FROM ai_jobs ORDER BY created_at`)).rows;
    const items = (await pool.query("SELECT label,position,done_at,note FROM task_checklist_items ORDER BY position,id")).rows;
    if (mode === "accept-checklist") {
      check(process.argv[3] === "--reviewed-language-and-facts", "B1_HUMAN_REVIEW_REQUIRED");
      check(stage === "checklist" && jobs.length === 1 && jobs[0].service === "task.checklist" &&
        jobs[0].status === "completed" && jobs[0].attempts === 1 && items.length >= 3 && items.length <= 5 &&
        new Set(items.map(i => i.label.trim().toLocaleLowerCase())).size === items.length,
      "B1_SINGLE_CHECKLIST_SUCCESS_REQUIRED");
      await settings.mutate(current.version, "b1-operator", "b1-accept-checklist", state => ({
        ...state.value, routes: { "task.resolution": THREE_SERVICE_CANDIDATE_ROUTES["task.resolution"] },
      }));
      await pool.query("UPDATE b1_stage SET stage='resolution',reviewed_at=now() WHERE singleton=true");
      console.info(JSON.stringify({ stage: "resolution", inferenceRequests: 0, restartOnlyB1Required: true }));
    } else {
      const raw = (await pool.query("SELECT job_id,attempt,raw_content,received_at FROM b1_evidence ORDER BY received_at")).rows;
      console.info(JSON.stringify({ stage, liveAcceptance: "requires_human_review", jobs, checklist: items, originalResponses: raw,
        httpStatusPolicy: "metrics.httpStatus or unknown; never inferred", productionChangesByToolkit: false,
        productionUnchangedIndependentVerification: "required", mailboxTest: "blocked_not_authorized" }, null, 2));
    }
    await pool.end(); return;
  }
  if (mode === "web") {
    const app = createB1App(pool, config, stage);
    serveStatic(app);
    const server = app.listen(15491, "127.0.0.1", () => console.info("B1_UI_LOOPBACK_READY port=15491"));
    server.on("error", () => { console.error("B1_UI_LISTEN_FAILED"); void pool.end(); });
    const stop = () => {
      server.close(() => { void pool.end(); });
      setTimeout(() => process.exit(1), 10000).unref();
    };
    process.once("SIGINT", stop); process.once("SIGTERM", stop);
    return;
  }
  check(mode === "worker", "B1_EXPLICIT_MODE_REQUIRED");
  const runtime = createAIJobRuntime(pool);
  const worker = createJobWorker({ store: runtime.aiJobStore, timeoutMs: 120000, apply: runtime.applyJob,
    execute: (job, signal) => {
      check(job.service === service && job.entity_id === "b1-checklist-sk-1" &&
        job.owner_user_id === "b1-operator", "B1_WORKER_SOURCE_NOT_APPROVED");
      return executeJob(pool, job, 120000, signal, async content => {
      const saved = await pool.query(`INSERT INTO b1_evidence(job_id,attempt,raw_content)
        SELECT id,attempts,$3 FROM ai_jobs WHERE id=$1 AND worker_id=$2
        AND status='processing' AND locked_until>now() RETURNING job_id`, [job.id, job.worker_id, content]);
      check(saved.rowCount === 1, "B1_EVIDENCE_CLAIM_LOST");
      });
    } });
  let stopping = false;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    if (stopping) return;
    stopping = true; worker.stop();
    deadline = setTimeout(() => { console.error("B1_WORKER_STOP_DEADLINE"); process.exit(1); }, 150000);
    deadline.unref();
  };
  process.on("SIGINT", stop); process.on("SIGTERM", stop);
  console.info("B1_WORKER_READY concurrency=1 timeoutMs=120000");
  while (!stopping) {
    // No hidden retry loop after a failed inference. A DB failure stops this pilot.
    if (!await worker.tick()) await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (deadline) clearTimeout(deadline);
  await pool.end();
}
