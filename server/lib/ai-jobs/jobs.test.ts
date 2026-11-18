import assert from "node:assert/strict";
import test from "node:test";
import { backgroundDeadline, withAIJobContext } from "../ai/background-context";
import { createInternalAIAdapter } from "../ai/internal-adapter";
import { aiJobEnabled, aiJobTimeout, JobError, jobFailure } from "./policy";
import { emailSummaryRequest, emailSummaryResult } from "./summary";
import { mayReadSystemSource } from "./mailbox";
import { originalBoundaries } from "../../../script/ai-three-services/source";
import { createJobWorker } from "./worker";

test("worker deadline is a scoped capability; legacy tasks and monitoring retain their own policies", async () => {
  const adapter = createInternalAIAdapter({ readConfiguration: () => ({
    production: true, replit: false, enabled: true,
    baseURL: "https://ai.cordbloodcenter.com/gateway/", token: "SYNTHETIC_UNIT_TOKEN",
  }) });
  assert.equal(backgroundDeadline(undefined), undefined);
  assert.equal(adapter.createClient({}, { service: "task.checklist" }).timeout, 15000);
  assert.equal(adapter.createClient({}, { service: "task.resolution" }).timeout, 15000);
  const monitoring = adapter.createClient({}, { service: "email.monitoring" });
  await withAIJobContext("task.checklist", 120000, async () => {
    await Promise.resolve();
    assert.equal(adapter.createClient({ timeout: 120000, maxRetries: 2 }, { service: "task.checklist" }).timeout, 120000);
    assert.equal(adapter.createClient({ timeout: 120000 }, { service: "task.checklist" }).maxRetries, 0);
    assert.equal(adapter.createClient({}, { service: "task.resolution" }).timeout, 15000);
    assert.equal(adapter.createClient({}, { service: "email.monitoring" }).timeout, monitoring.timeout);
    assert.equal(backgroundDeadline(undefined), undefined);
  });
  assert.equal(backgroundDeadline("task.checklist"), undefined);
  assert.equal(adapter.createClient({}, { service: "task.checklist" }).timeout, 15000);
  assert.throws(() => withAIJobContext("email.monitoring" as any, 120000, async () => {}));
});

test("three independent flags default off; timeout is bounded and invalid server settings fail explicitly", () => {
  const keys = ["AI_JOBS_TASK_CHECKLIST_ENABLED", "AI_JOBS_TASK_RESOLUTION_ENABLED", "AI_JOBS_EMAIL_SUMMARY_ENABLED", "AI_JOBS_GATEWAY_TIMEOUT_MS"];
  const before = keys.map(k => process.env[k]);
  try {
    keys.forEach(k => delete process.env[k]);
    for (const service of ["task.checklist", "task.resolution", "email.summary"] as const) assert.equal(aiJobEnabled(service), false);
    process.env[keys[0]] = "true";
    assert.equal(aiJobEnabled("task.checklist"), true); assert.equal(aiJobEnabled("task.resolution"), false);
    assert.equal(aiJobTimeout(), 120000);
    for (const value of ["0", "120001", "NaN", "1000.5"]) { process.env[keys[3]] = value; assert.throws(aiJobTimeout, /invalid_worker_timeout/); }
  } finally { keys.forEach((k, i) => before[i] === undefined ? delete process.env[k] : process.env[k] = before[i]); }
});

test("summary worker request exactly preserves original prompts, language and token budget", async () => {
  const source = originalBoundaries(process.cwd());
  for (const language of ["sk", "cs", "en", "hu", "ro", "it", "de", "auto"]) {
    const input = { emailSubject: "Synthetic topic", emailBody: "<p>Synthetic   message</p><ul><li>One item</li></ul>",
      emailFrom: "Synthetic sender", language };
    let original: any;
    await source.execute("email.summary", input, () => ({ chat: { completions: { create: async (body: any) => {
      original = JSON.parse(JSON.stringify(body));
      return { choices: [{ message: { content: "<p>Fixture summary.</p>" } }] };
    } } } }));
    assert.deepEqual(emailSummaryRequest(input), original);
    const plain = input.emailBody.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 5000);
    assert.deepEqual(emailSummaryRequest({ ...input, emailBody: plain }, true), original);
  }
});

test("HTML summaries reject active markup; invalid contract, timeout, transport and rejection stay distinct", () => {
  assert.equal(emailSummaryResult("```html\n<p>Summary.</p><ul><li>Point.</li></ul>\n```").summary, "<p>Summary.</p><ul><li>Point.</li></ul>");
  for (const content of ["", '<p onclick="steal()">No</p>', "<script>steal()</script>", "<p>Unclosed", '{"steps":["wrong contract"]}<img src=x>'])
    assert.throws(() => emailSummaryResult(content), /invalid_output/);
  assert.equal(jobFailure(new JobError("source_changed")), "source_changed");
  assert.equal(jobFailure({ name: "TimeoutError" }), "timeout_outcome_unknown");
  assert.equal(jobFailure({ safeCode: "invalid_output" }), "invalid_output");
  assert.equal(jobFailure({ cause: { code: "ai_internal_transport_error" } }), "connection_failed");
  assert.equal(jobFailure({ status: 503, message: "SENSITIVE" }), "gateway_unavailable");
  assert.equal(jobFailure({ status: 422 }), "gateway_rejected");
  assert.equal(jobFailure({ message: "SENSITIVE" }), "provider_or_contract_error");
});

test("system mailbox source selection is not a grant for managers, inactive users or ordinary users", () => {
  for (const role of ["admin", "superadmin", "owner"]) assert.equal(mayReadSystemSource({ role, isActive: true }, "SK"), true);
  for (const role of ["manager", "user"]) assert.equal(mayReadSystemSource({ role, isActive: true }, "SK"), false);
  assert.equal(mayReadSystemSource({ role: "admin", isActive: false }, "SK"), false);
});

test("worker timeout fails one claimed attempt without automatic retries or applying a late result", async () => {
  let calls = 0, applies = 0, failed: string | undefined;
  const job: any = { id: "fixture", status: "processing", worker_id: "worker" };
  const store: any = {
    claim: async () => calls++ === 0 ? job : null,
    heartbeat: async () => true,
    fail: async (_job: any, code: string) => { failed = code; },
    finish: async () => { applies++; },
  };
  const worker = createJobWorker({ store, timeoutMs: 20,
    execute: () => new Promise(resolve => setTimeout(() => resolve({ steps: ["late"] }), 60)), apply: async () => {} });
  await worker.tick();
  assert.equal(failed, "timeout_outcome_unknown");
  await new Promise(r => setTimeout(r, 80));
  assert.equal(applies, 0); assert.equal(await worker.tick(), false);
});
