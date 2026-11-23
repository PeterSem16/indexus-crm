"use strict";
// Explicit operator-only release. Reuses the reviewed worker-only cutover.
// No dependency installation, schema change, routing change, or AI request.
const fs = require("node:fs"), cp = require("node:child_process"), os = require("node:os");
const path = require("node:path"), crypto = require("node:crypto");
const APP = "/var/www/indexus-crm", DATA = APP + "/data";
const LIVE_WORKER = "1f5d03c8b7f761399f284d5a8e3733f8122a0a073ff8fb2c382d9c05f19efad1";
const PROMOTER_SHA = "2d476fbcba5412180e1bd1b910cf4f727c934354b7423dfc0281634ac7eae44d";
const sha = b => crypto.createHash("sha256").update(b).digest("hex");
const fail = code => { throw Object.assign(Error(code), { safeCode: code }); };
const env = { PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", LANG: "C.UTF-8" };
const edits = {
  "shared/ai-jobs.ts": [
    ['export type AIJobService = typeof AI_JOB_SERVICES[number];',
      'export type AIJobService = typeof AI_JOB_SERVICES[number];\n/** Approved background execution budget; not a synchronous request timeout. */\nexport const EMAIL_SUMMARY_JOB_TIMEOUT_MS = 240_000;'],
  ],
  "server/lib/ai-jobs/policy.ts": [
    ['import { AI_JOB_SERVICES, type AIJobService }', 'import { AI_JOB_SERVICES, EMAIL_SUMMARY_JOB_TIMEOUT_MS, type AIJobService }'],
    ['export function aiJobTimeout(): number {', 'export function aiJobTimeout(service?: AIJobService): number {'],
    ['  return value;\n}', '  return service === "email.summary" ? EMAIL_SUMMARY_JOB_TIMEOUT_MS : value;\n}'],
    ['export class JobError extends Error {', 'export function aiWorkerShutdownTimeout(baseTimeoutMs = aiJobTimeout()): number {\n  return Math.max(baseTimeoutMs, EMAIL_SUMMARY_JOB_TIMEOUT_MS) + 30_000;\n}\nexport class JobError extends Error {'],
  ],
  "server/lib/ai/background-context.ts": [
    ['import { AI_JOB_SERVICES, type AIJobService }', 'import { AI_JOB_SERVICES, EMAIL_SUMMARY_JOB_TIMEOUT_MS, type AIJobService }'],
    ['  if (!AI_JOB_SERVICES.includes(service) || !Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120000)',
      '  const maximum = service === "email.summary" ? EMAIL_SUMMARY_JOB_TIMEOUT_MS : 120000;\n  if (!AI_JOB_SERVICES.includes(service) || !Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > maximum)'],
    ['  if (!Object.hasOwn(AI_SERVICES, service) || !Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120000)',
      '  const maximum = service === "email.summary" ? EMAIL_SUMMARY_JOB_TIMEOUT_MS : 120000;\n  if (!Object.hasOwn(AI_SERVICES, service) || !Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > maximum)'],
  ],
  "server/lib/ai-jobs/store.ts": [
    ['async claim(workerId: string, leaseMs: number):', 'async claim(workerId: string, leaseMs: number, summaryLeaseMs = leaseMs):'],
    ["locked_until=now()+($3 * interval '1 millisecond'),", "locked_until=now()+((CASE WHEN service='email.summary' THEN $4::int ELSE $3::int END) * interval '1 millisecond'),"],
    ['[row.id, workerId, leaseMs]', '[row.id, workerId, leaseMs, summaryLeaseMs]'],
  ],
  "server/lib/ai-jobs/worker.ts": [
    ['  timeoutMs: number;', '  timeoutMs: number;\n  summaryTimeoutMs?: number;'],
    ['execute(job: JobRow, signal: AbortSignal):', 'execute(job: JobRow, signal: AbortSignal, timeoutMs: number):'],
    ['  const leaseMs = options.timeoutMs + 60000;', '  const summaryTimeoutMs = options.summaryTimeoutMs ?? options.timeoutMs;'],
    ['const job = await options.store.claim(`${id}:${randomUUID()}`, leaseMs);\n        if (!job) return false;',
      'const job = await options.store.claim(`${id}:${randomUUID()}`,\n          options.timeoutMs + 60000, summaryTimeoutMs + 60000);\n        if (!job) return false;\n        const timeoutMs = job.service === "email.summary" ? summaryTimeoutMs : options.timeoutMs;\n        const leaseMs = timeoutMs + 60000;'],
    ['}, options.timeoutMs);', '}, timeoutMs);'],
    ['options.execute(job, controller.signal)', 'options.execute(job, controller.signal, timeoutMs)'],
  ],
  "server/lib/ai-jobs/inference-store.ts": [
    ['async claim(workerId: string, timeoutMs: number):', 'async claim(workerId: string, timeoutMs: number, summaryTimeoutMs = timeoutMs):'],
    ["attempts=1,started_at=now(),locked_until=now()+($2::int * interval '1 millisecond')",
      "attempts=1,started_at=now(),locked_until=now()+(\n            (CASE WHEN service='email.summary' THEN $3::int ELSE $2::int END) * interval '1 millisecond')"],
    ['[workerId, timeoutMs + 60000]', '[workerId, timeoutMs + 60000, summaryTimeoutMs + 60000]'],
  ],
  "server/lib/ai-jobs/inference-worker.ts": [
    ['client: (service: InferenceJob["service"])', 'client: (service: InferenceJob["service"], timeoutMs: number)'],
    ['  timeoutMs: number;', '  timeoutMs: number;\n  summaryTimeoutMs?: number;'],
    ['const job = await options.store.claim(id, options.timeoutMs);\n        if (!job) return false;',
      'const job = await options.store.claim(id, options.timeoutMs, options.summaryTimeoutMs ?? options.timeoutMs);\n        if (!job) return false;\n        const timeoutMs = job.service === "email.summary" ? options.summaryTimeoutMs ?? options.timeoutMs : options.timeoutMs;'],
    ['}, options.timeoutMs);', '}, timeoutMs);'],
    ['withInternalWorkerContext(job.service, options.timeoutMs,', 'withInternalWorkerContext(job.service, timeoutMs,'],
    ['options.client(job.service)', 'options.client(job.service, timeoutMs)'],
    ['maxRetries: 0, timeout: options.timeoutMs', 'maxRetries: 0, timeout: timeoutMs'],
  ],
  "server/ai-worker.ts": [
    ['import { aiJobTimeout }', 'import { aiJobTimeout, aiWorkerShutdownTimeout }'],
    ['  const worker = createJobWorker({ store: aiJobStore, timeoutMs,\n    execute: (job, signal) => executeJob(pool, job, timeoutMs, signal), apply: applyJob });\n  const inference = createInferenceWorker({ store: inferenceStore, timeoutMs,',
      '  const summaryTimeoutMs = aiJobTimeout("email.summary");\n  const worker = createJobWorker({ store: aiJobStore, timeoutMs, summaryTimeoutMs,\n    execute: (job, signal, budget) => executeJob(pool, job, budget, signal), apply: applyJob });\n  const inference = createInferenceWorker({ store: inferenceStore, timeoutMs, summaryTimeoutMs,'],
    ['client: service => internalAIAdapter.createClient({ timeout: timeoutMs, maxRetries: 0 }, { service })',
      'client: (service, budget) => internalAIAdapter.createClient({ timeout: budget, maxRetries: 0 }, { service })'],
    ['}, timeoutMs + 30000);', '}, aiWorkerShutdownTimeout(timeoutMs));'],
  ],
};
function patchSources(sources) {
  const result = {};
  for (const [file, changes] of Object.entries(edits)) {
    let text = sources[file];
    if (typeof text !== "string") fail("approved_source_missing");
    for (const [before, after] of changes) {
      if (text.split(before).length !== 2) fail("approved_source_context_changed");
      text = text.replace(before, after);
    }
    result[file] = text;
  }
  return result;
}
function read(file) {
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const s = fs.fstatSync(fd);
    if (!s.isFile() || s.size > 32 * 1024 ** 2) fail("regular_file_required");
    return fs.readFileSync(fd);
  } finally { fs.closeSync(fd); }
}
async function buildDriver() {
  const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
  const vm = require("node:vm"), { createRequire } = require("node:module");
  const input = JSON.parse(fs.readFileSync(0, "utf8")), req = createRequire(input.app + "/package.json");
  const esbuild = req("esbuild"), hash = b => crypto.createHash("sha256").update(b).digest("hex");
  const captured = {};
  const pkg = fs.readFileSync(input.app + "/package.json"), config = fs.readFileSync(input.app + "/script/build.ts");
  captured[input.app + "/package.json"] = hash(pkg); captured[input.app + "/script/build.ts"] = hash(config);
  const manifest = JSON.parse(pkg), list = /const allowlist = \[([\s\S]*?)\];/.exec(config.toString());
  if (!list) throw Error("build_configuration_unrecognized");
  const allow = (list[1].match(/"[^"]+"/g) || []).map(x => JSON.parse(x));
  const external = [...Object.keys(manifest.dependencies || {}), ...Object.keys(manifest.devDependencies || {})]
    .filter(x => !allow.includes(x));
  const compile = sources => esbuild.build({ absWorkingDir: input.app, entryPoints: ["server/ai-worker.ts"],
    platform: "node", bundle: true, format: "cjs", outfile: "dist/ai-worker.cjs",
    define: { "process.env.NODE_ENV": '"production"' }, minify: true, external,
    write: false, logLevel: "silent", plugins: [{ name: "approved-budget-overlay", setup(b) {
      b.onLoad({ filter: /\.(?:[cm]?js|tsx?|json)$/ }, args => {
        const bytes = fs.readFileSync(args.path); captured[args.path] = hash(bytes);
        return { contents: sources[args.path] ?? bytes.toString(), resolveDir: path.dirname(args.path),
          loader: args.path.endsWith(".json") ? "json" : args.path.endsWith(".tsx") ? "tsx" :
            args.path.endsWith(".ts") ? "ts" : "js" };
      });
    } }] });
  const evaluate = (text, imports) => {
    const mod = { exports: {} };
    vm.runInNewContext(esbuild.transformSync(text, { loader: "ts", format: "cjs", target: "node20" }).code,
      { module: mod, exports: mod.exports, process: { env: {} },
        require: key => { if (!(key in imports)) throw Error("unexpected_selftest_import"); return imports[key]; } });
    return mod.exports;
  };
  const shared = evaluate(input.sources[input.app + "/shared/ai-jobs.ts"], {});
  const policy = evaluate(input.sources[input.app + "/server/lib/ai-jobs/policy.ts"], {
    "../../../shared/ai-jobs": shared, "../ai/admin-runtime": { aiAdminSnapshot: () => undefined },
  });
  if (policy.aiJobTimeout("email.summary") !== 240000 || policy.aiJobTimeout() !== 120000 ||
      policy.aiJobTimeout("task.checklist") !== 120000 || policy.aiJobTimeout("task.resolution") !== 120000 ||
      policy.aiWorkerShutdownTimeout() !== 270000) throw Error("budget_selftest_failed");
  const original = await compile({}), fixed = await compile(input.sources);
  for (const [file, expected] of Object.entries(captured))
    if (hash(fs.readFileSync(file)) !== expected) throw Error("build_input_changed");
  process.stdout.write(JSON.stringify({ originalSha256: hash(original.outputFiles[0].contents),
    bundle: Buffer.from(fixed.outputFiles[0].contents).toString("base64"), inputs: captured, selftests: 5 }));
}
function processSnapshot() {
  const result = {};
  for (const pid of fs.readdirSync("/proc").filter(x => /^\d+$/.test(x))) {
    try {
      if (fs.realpathSync(`/proc/${pid}/cwd`) !== APP) continue;
      const args = fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0");
      for (const [role, file] of [["web", "index.cjs"], ["worker", "ai-worker.cjs"]]) {
        if (!args.includes(APP + "/dist/" + file) && args[0]?.trim() !== "node " + APP + "/dist/" + file) continue;
        if (result[role]) fail("multiple_service_processes");
        const status = fs.readFileSync(`/proc/${pid}/status`, "utf8"), stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
        result[role] = { pid: Number(pid), uid: Number(/^Uid:\s+(\d+)/m.exec(status)?.[1]),
          gid: Number(/^Gid:\s+(\d+)/m.exec(status)?.[1]), executable: fs.realpathSync(`/proc/${pid}/exe`),
          start: stat.slice(stat.lastIndexOf(")") + 2).split(" ")[19] };
      }
    } catch (e) { if (e.safeCode) throw e; }
  }
  if (!result.web?.uid || result.web.uid !== result.worker?.uid) fail("service_identity_unverified");
  return result;
}
async function main(args = process.argv.slice(2)) {
  if (args.length !== 1 || args[0] !== "--apply" || process.getuid() !== 0 ||
      os.hostname().split(".")[0].toUpperCase() !== "CORPCRM01") fail("root_apply_on_corpcrm01_only");
  if (fs.realpathSync(APP) !== APP || fs.realpathSync(DATA) !== DATA) fail("canonical_application_paths_required");
  const run = (bin, args, options = {}) => cp.execFileSync(bin, args, { env, encoding: "utf8",
    timeout: 15000, maxBuffer: 32 * 1024 ** 2, stdio: ["pipe", "pipe", "pipe"], ...options });
  const promoterPath = path.join(__dirname, "promote-summary-worker.cjs");
  if (sha(read(promoterPath)) !== PROMOTER_SHA) fail("reviewed_promoter_required");
  const promoter = require(promoterPath);
  console.log("PHASE=prepare_240_second_summary_budget");
  const disk = JSON.parse(run("findmnt", ["--json", "--target", DATA, "--output", "SOURCE,TARGET"])).filesystems;
  if (disk.length !== 1 || disk[0].source !== "/dev/sdb1" || disk[0].target !== DATA) fail("approved_data_disk_required");
  const identity = processSnapshot();
  if (identity.worker.executable !== fs.realpathSync(process.execPath)) fail("use_existing_worker_node_binary");
  if (sha(read(APP + "/dist/ai-worker.cjs")) !== LIVE_WORKER) fail("current_worker_changed_inspection_required");
  for (const root of [DATA, APP + "/dist"]) {
    const s = fs.statfsSync(root); if (s.bavail * s.bsize < 256 * 1024 ** 2) fail("disk_space_required");
  }
  const parent = DATA + "/ai-summary-budget-private";
  try { fs.mkdirSync(parent, { mode: 0o700 }); } catch (e) { if (e.code !== "EEXIST") throw e; }
  const stat = fs.lstatSync(parent);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== 0 || (stat.mode & 0o777) !== 0o700 ||
      fs.realpathSync(parent) !== parent) fail("private_directory_required");
  for (const uid of new Set([identity.web.uid, 33])) for (const mode of ["-r", "-x"]) {
    const denied = cp.spawnSync("setpriv", [`--reuid=${uid}`, `--regid=${uid}`, "--clear-groups",
      "/usr/bin/test", mode, parent], { env, stdio: "ignore", timeout: 10000 });
    if (denied.status !== 1) fail("private_directory_access_unverified");
  }
  const originals = Object.fromEntries(Object.keys(edits).map(f => [f, read(APP + "/" + f).toString()]));
  const sources = patchSources(originals), baseline = {};
  for (const file of [...Object.keys(edits), "dist/ai-worker.cjs", "dist/index.cjs", "dist/public/index.html"])
    baseline[file] = sha(read(APP + "/" + file));
  const user = run("id", ["-nu", String(identity.worker.uid)]).trim();
  if (!/^[a-z_][a-z0-9_-]*$/.test(user)) fail("worker_account_invalid");
  console.log("PHASE=build_in_memory_without_live_writes");
  let built;
  try {
    built = JSON.parse(run("runuser", ["-u", user, "--", process.execPath, "-e",
      `(${buildDriver.toString()})().catch(()=>process.exit(1))`], {
      env: { ...env, HOME: "/home/" + user }, cwd: APP, timeout: 120000,
      input: JSON.stringify({ app: APP, sources: Object.fromEntries(Object.entries(sources).map(([f, v]) => [APP + "/" + f, v])) }),
    }));
  } catch { fail("isolated_budget_build_failed_no_live_changes"); }
  if (built.originalSha256 !== LIVE_WORKER) fail("original_sources_do_not_match_running_worker");
  const bundle = Buffer.from(built.bundle, "base64");
  if (bundle.length < 1024 || bundle.length > 16 * 1024 ** 2) fail("bundle_size_invalid");
  run(process.execPath, ["--input-type=commonjs", "--check"], { input: bundle });
  for (const [file, expected] of Object.entries(built.inputs)) {
    if (!file.startsWith(APP + "/") || path.normalize(file) !== file || sha(read(file)) !== expected)
      fail("build_input_changed");
  }
  for (const [file, expected] of Object.entries(baseline))
    if (sha(read(APP + "/" + file)) !== expected) fail("live_file_changed");
  if (JSON.stringify(processSnapshot()) !== JSON.stringify(identity)) fail("service_process_changed");
  const stageDirectory = fs.mkdtempSync(parent + "/release-"); fs.chmodSync(stageDirectory, 0o700);
  const files = {}, outputs = {};
  for (const [file, value] of [...Object.entries(sources), ["dist/ai-worker.cjs", bundle]]) {
    files[file] = sha(value); outputs[path.basename(file)] = sha(value);
    fs.writeFileSync(stageDirectory + "/" + path.basename(file), value, { flag: "wx", mode: 0o600 });
  }
  const manifest = { format: 1, mode: "prepared_not_deployed", directory: stageDirectory,
    baseline, inputs: built.inputs, processes: identity, outputs };
  fs.writeFileSync(stageDirectory + "/manifest.json", JSON.stringify(manifest, null, 2), { flag: "wx", mode: 0o600 });
  console.log("BUDGET_SELFTESTS_PASSED=" + built.selftests);
  const ops = promoter.operations({ stageDirectory, files, processes: identity,
    killTimeoutMs: 280000, drainMs: 270000, persistPm2: true });
  try { return await promoter.orchestrate(ops); }
  catch (e) { e.state = ops.failureState(); throw e; }
}
module.exports = { main, edits, patchSources, buildDriver };
if (require.main === module) main().catch(e => {
  console.error(JSON.stringify({ mode: "not_confirmed", code: e.safeCode || "budget_release_failed",
    ...e.state, rollbackVerified: !!e.rollbackVerified, recoveryCode: e.recoveryCode || null,
    manualRecoveryRequired: !!e.manualRecoveryRequired || !!e.releaseAttempted,
    claimReleaseAttempted: !!e.releaseAttempted })); process.exitCode = 1;
});
