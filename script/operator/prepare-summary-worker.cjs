"use strict";
// Builds only. No DB, network, PM2, service changes, or writes to live source/dist.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const crypto = require("node:crypto"), cp = require("node:child_process");
const APP = "/var/www/indexus-crm", DATA = APP + "/data";
const PATCH_HASH = "854f36dc1b33c2b4237b28154cc3cc4d176026b16facb6ceaef722e97c2c7472";
const SOURCE_HASH = "9c223ba7aeb11149b692e82114c4668448a0ed235fe222efc46d2c8b625bd6be";
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const fail = code => { throw Object.assign(Error(code), { safeCode: code }); };
const safeEnv = { PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", LANG: "C.UTF-8" };
function run(bin, args, options = {}) {
  return cp.execFileSync(bin, args, { env: safeEnv, encoding: "utf8",
    timeout: 15000, maxBuffer: 32 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"], ...options });
}
function read(file) {
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const s = fs.fstatSync(fd);
    if (!s.isFile() || s.size > 32 * 1024 * 1024) fail("regular_file_required");
    return fs.readFileSync(fd);
  } finally { fs.closeSync(fd); }
}
function patchSources(patch, original) {
  if (sha(patch) !== PATCH_HASH || sha(original) !== SOURCE_HASH) fail("patch_or_source_changed");
  const sections = patch.toString("utf8").split(/^diff --git /m).slice(1);
  if (sections.length !== 2) fail("patch_paths_changed");
  const added = sections[1].split("\n").filter(l => l.startsWith("+") && !l.startsWith("+++"))
    .map(l => l.slice(1)).join("\n") + "\n";
  if (!sections[1].startsWith("a/server/lib/ai-jobs/summary-html.ts b/server/lib/ai-jobs/summary-html.ts"))
    fail("patch_paths_changed");
  const before = original.toString("utf8");
  const start = before.indexOf("export function emailSummaryResult(");
  if (start < 0) fail("summary_function_missing");
  const summary = before.slice(0, start).replace('import { JobError } from "./policy";',
    'import { normalizeSummaryHtml } from "./summary-html";') +
    'export function emailSummaryResult(content: string): { summary: string } {\n' +
    '  return { summary: normalizeSummaryHtml(content) };\n}\n';
  return { summary, helper: added };
}
function processes() {
  const result = {};
  for (const pid of fs.readdirSync("/proc").filter(p => /^\d+$/.test(p))) {
    try {
      if (fs.realpathSync(`/proc/${pid}/cwd`) !== APP) continue;
      const args = fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0");
      for (const [role, file] of [["web", "index.cjs"], ["worker", "ai-worker.cjs"]]) {
        const entry = APP + "/dist/" + file;
        if (!args.includes(entry) && args[0]?.trim() !== "node " + entry) continue;
        if (result[role]) fail("multiple_managed_processes");
        const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
        const status = fs.readFileSync(`/proc/${pid}/status`, "utf8");
        const uid = Number(/^Uid:\s+(\d+)/m.exec(status)?.[1]);
        const gid = Number(/^Gid:\s+(\d+)/m.exec(status)?.[1]);
        if (!uid || !Number.isSafeInteger(gid)) fail("unprivileged_process_required");
        result[role] = { pid: Number(pid), uid, gid,
          executable: fs.realpathSync(`/proc/${pid}/exe`),
          start: stat.slice(stat.lastIndexOf(")") + 2).split(" ")[19] };
      }
    } catch (error) { if (error.safeCode) throw error; }
  }
  if (!result.web || !result.worker || result.web.uid !== result.worker.uid) fail("service_identity_unverified");
  return result;
}
// Executed as the existing worker's Unix user. write:false means no build tree
// or temp output is ever created in the application's web-served namespace.
async function buildDriver() {
  const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
  const { createRequire } = require("node:module"), vm = require("node:vm");
  const input = JSON.parse(fs.readFileSync(0, "utf8"));
  const req = createRequire(input.app + "/package.json"), esbuild = req("esbuild");
  const hash = b => crypto.createHash("sha256").update(b).digest("hex");
  const captured = {};
  const pkg = fs.readFileSync(input.app + "/package.json"), build = fs.readFileSync(input.app + "/script/build.ts");
  const list = /const allowlist = \[([\s\S]*?)\];/.exec(build.toString());
  if (!list) throw Error("build_configuration_unrecognized");
  const allow = (list[1].match(/"[^"]+"/g) || []).map(x => JSON.parse(x));
  const manifest = JSON.parse(pkg);
  const external = [...Object.keys(manifest.dependencies || {}), ...Object.keys(manifest.devDependencies || {})]
    .filter(x => !allow.includes(x));
  captured[input.app + "/package.json"] = hash(pkg);
  captured[input.app + "/script/build.ts"] = hash(build);
  const check = esbuild.transformSync(input.helper, { loader: "ts", format: "cjs", target: "node20" });
  const mod = { exports: {} };
  class FixtureError extends Error {}
  vm.runInNewContext(check.code, { module: mod, exports: mod.exports,
    require: name => {
      if (name === "./policy") return { JobError: FixtureError };
      if (name === "cheerio") return req("cheerio");
      throw Error("unexpected_selftest_import");
    } });
  const normalize = mod.exports.normalizeSummaryHtml;
  const samples = ["Žiadosť prijatá.", "Žádost přijata.", "Request received.", "Kérelem fogadva.",
    "Cerere primită.", "Richiesta ricevuta.", "Anfrage eingegangen."];
  for (const value of samples)
    if (normalize(`<div><strong>${value}</strong></div>`) !== `<p>${value}</p>`) throw Error("language_selftest_failed");
  for (const value of ["", "<script>fixture</script>", "<p onclick='fixture'>text</p>"])
    try { normalize(value); throw Error("unsafe_selftest_failed"); }
    catch (error) { if (!(error instanceof FixtureError)) throw error; }
  const result = await esbuild.build({ absWorkingDir: input.app, entryPoints: ["server/ai-worker.ts"],
    platform: "node", bundle: true, format: "cjs", write: false, minify: true,
    define: { "process.env.NODE_ENV": '"production"' }, external, logLevel: "silent",
    plugins: [{ name: "summary-overlay", setup(b) {
      b.onResolve({ filter: /^\.\/summary-html$/ }, args => {
        if (args.importer !== input.app + "/server/lib/ai-jobs/summary.ts") return;
        return { path: "summary-html", namespace: "hotfix" };
      });
      b.onLoad({ filter: /.*/, namespace: "hotfix" }, () => ({
        contents: input.helper, loader: "ts", resolveDir: input.app + "/server/lib/ai-jobs" }));
      b.onLoad({ filter: /\.(?:[cm]?js|tsx?|json)$/ }, args => {
        const bytes = fs.readFileSync(args.path);
        captured[args.path] = hash(bytes);
        return { contents: args.path === input.app + "/server/lib/ai-jobs/summary.ts" ? input.summary : bytes.toString(),
          loader: args.path.endsWith(".json") ? "json" : args.path.endsWith(".tsx") ? "tsx" :
            args.path.endsWith(".ts") ? "ts" : "js", resolveDir: path.dirname(args.path) };
      });
    } }] });
  for (const [file, expected] of Object.entries(captured))
    if (hash(fs.readFileSync(file)) !== expected) throw Error("build_input_changed");
  process.stdout.write(JSON.stringify({ bundle: Buffer.from(result.outputFiles[0].contents).toString("base64"),
    inputs: captured, selftests: 10 }));
}
async function main(args = process.argv.slice(2)) {
  if (args.length !== 1 || args[0] !== "--prepare") fail("usage_prepare_only");
  if (os.hostname().split(".")[0].toUpperCase() !== "CORPCRM01" || process.getuid() !== 0 ||
      fs.realpathSync(APP) !== APP || fs.realpathSync(DATA) !== DATA) fail("root_on_corpcrm01_required");
  console.log("PHASE=verify_current_source");
  const source = read(APP + "/server/lib/ai-jobs/summary.ts");
  const overlay = patchSources(read("/tmp/email-summary-format-fix.patch"), source);
  if (fs.existsSync(APP + "/server/lib/ai-jobs/summary-html.ts")) fail("helper_already_exists");
  const identity = processes();
  if (identity.worker.executable !== fs.realpathSync(process.execPath)) fail("use_existing_worker_node_binary");
  const device = JSON.parse(run("findmnt", ["--json", "--target", DATA, "--output", "SOURCE,TARGET"])).filesystems;
  if (device.length !== 1 || device[0].source !== "/dev/sdb1" || device[0].target !== DATA) fail("approved_data_disk_required");
  const capacity = fs.statfsSync(DATA);
  if (Number(capacity.bavail) * Number(capacity.bsize) < 512 * 1024 * 1024) fail("data_disk_space_required");
  const parent = DATA + "/ai-summary-hotfix-private";
  try { fs.mkdirSync(parent, { mode: 0o700 }); } catch (e) { if (e.code !== "EEXIST") throw e; }
  const p = fs.lstatSync(parent);
  if (!p.isDirectory() || p.isSymbolicLink() || p.uid !== 0 || (p.mode & 0o777) !== 0o700) fail("private_directory_required");
  for (const uid of new Set([identity.web.uid, 33])) {
    const denied = cp.spawnSync("setpriv", [`--reuid=${uid}`, `--regid=${uid}`, "--clear-groups",
      "/usr/bin/test", "-r", parent], { env: safeEnv, stdio: "ignore", timeout: 10000 });
    if (denied.status !== 1) fail("private_directory_readable_or_unverified");
  }
  const directory = fs.mkdtempSync(parent + "/release-");
  fs.chmodSync(directory, 0o700);
  const baseline = {};
  for (const file of ["server/lib/ai-jobs/summary.ts", "server/lib/ai-jobs/handlers.ts",
    "server/lib/ai/internal-adapter.ts", "server/ai-worker.ts", "dist/ai-worker.cjs",
    "dist/index.cjs", "dist/public/index.html", "package.json", "script/build.ts"])
    baseline[file] = sha(read(APP + "/" + file));
  console.log("PHASE=build_worker_without_live_writes");
  let built;
  try {
    const user = run("id", ["-nu", String(identity.worker.uid)]).trim();
    built = JSON.parse(run("runuser", ["-u", user, "--", process.execPath, "-e", `(${buildDriver.toString()})().catch(()=>process.exit(1))`],
      { cwd: APP, env: { ...safeEnv, HOME: "/home/" + user }, timeout: 120000,
        input: JSON.stringify({ app: APP, ...overlay }) }));
  } catch { fail("worker_build_failed_no_live_changes"); }
  const bytes = Buffer.from(built.bundle, "base64");
  if (bytes.length < 1024 || bytes.length > 16 * 1024 * 1024) fail("worker_bundle_size_invalid");
  run(process.execPath, ["--input-type=commonjs", "--check"], { input: bytes.toString(), timeout: 15000 });
  for (const [file, expected] of Object.entries(baseline))
    if (sha(read(APP + "/" + file)) !== expected) fail("live_source_or_runtime_changed");
  for (const [file, expected] of Object.entries(built.inputs))
    if (sha(read(file)) !== expected) fail("build_input_changed");
  if (JSON.stringify(processes()) !== JSON.stringify(identity)) fail("service_process_changed");
  const write = (name, value) => fs.writeFileSync(directory + "/" + name, value, { flag: "wx", mode: 0o600 });
  write("summary.ts", overlay.summary); write("summary-html.ts", overlay.helper); write("ai-worker.cjs", bytes);
  const result = { format: 1, mode: "prepared_not_deployed", directory, baseline,
    inputs: built.inputs, processes: identity, patchSha256: PATCH_HASH,
    outputs: { "summary.ts": sha(overlay.summary), "summary-html.ts": sha(overlay.helper), "ai-worker.cjs": sha(bytes) } };
  write("manifest.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ mode: result.mode, directory, workerSha256: result.outputs["ai-worker.cjs"],
    workerBytes: bytes.length, selftests: built.selftests, sourceFilesChecked: Object.keys(built.inputs).length,
    webPid: identity.web.pid, workerPid: identity.worker.pid, liveChanges: false, aiCalls: 0 }, null, 2));
}
module.exports = { main, patchSources, buildDriver, sha };
if (require.main === module) main().catch(e => {
  console.error("STOP_NO_LIVE_CHANGES=" + (e.safeCode || "preparation_failed")); process.exitCode = 1;
});
