"use strict";
// Preparation only. There is no deploy, migration, provider or restart mode.
const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const crypto = require("node:crypto");
const os = require("node:os");
const APP = "/var/www/indexus-crm";
const DATA = APP + "/data";
const BASE = "def0850154852b344bcdc9f4c9052e91887d15a1";
const TARGET = "3a1406b7d5c05f29fc5107a7a34a1032c0079ae8";
const TREE = "c7b06be1ad4e016fb49fa079be0b6c23e8961294";
const RUNTIME = {
  "dist/index.cjs": "307835123bb1934728f15b42ed13326e1a773231ead6e6ecc8fb49b29c5977ab",
  "dist/ai-worker.cjs": "717317bf07087a929dca0783e0ea27d36e441185dc59c6ba5ec5cedb59c46829",
  "dist/public/index.html": "06513bdfeabee36e856f36bdbd77e6fdff3b1562024e07c027fd01a41a373979",
};
const FILES = [
  "client/src/components/configurator/AIMaintenanceControl.tsx",
  "client/src/components/configurator/AISettingsTab.tsx",
  "client/src/i18n/ai-maintenance-translations.ts",
  "client/src/i18n/ai-settings-translations.ts",
  "script/test-ai-settings-ui.cjs",
  "server/lib/ai-jobs/inference-schema.ts",
  "server/lib/ai-jobs/inference-store.ts",
  "server/lib/ai-jobs/maintenance-gate.ts",
  "server/lib/ai-jobs/maintenance-routes.ts",
  "server/lib/ai-jobs/maintenance-schema.ts",
  "server/lib/ai-jobs/maintenance-store.ts",
  "server/lib/ai-jobs/maintenance.db.test.ts",
  "server/lib/ai-jobs/readiness.ts",
  "server/lib/ai-jobs/store.ts",
  "server/lib/ai-settings-bootstrap.ts",
  "server/lib/ai/settings-controller.ts",
  "server/lib/ai/settings-routes.db.test.ts",
  "shared/ai-maintenance.ts",
].sort();
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const fail = code => { throw Object.assign(new Error(code), { safeCode: code }); };
function buildEnvironment(inherited) {
  // Never pass runtime preloads, DB/provider credentials or Replit flags to builds.
  const clean = { NODE_ENV: "production", NODE_OPTIONS: "--max-old-space-size=3072" };
  for (const key of ["PATH", "HOME", "LANG", "LC_ALL", "TZ"])
    if (inherited[key]) clean[key] = inherited[key];
  return clean;
}
function validateScope(parent, tree, names) {
  if (parent !== BASE || tree !== TREE ||
      JSON.stringify([...names].sort()) !== JSON.stringify(FILES))
    fail("release_identity_or_scope_changed");
}
function assertMount(mounts, canonical = fs.realpathSync) {
  if (mounts?.length !== 1 || mounts[0].target !== DATA ||
      canonical(mounts[0].source) !== canonical("/dev/sdb1"))
    fail("approved_data_volume_required");
}
function regular(root, relative, optional = false) {
  if (!relative || relative.includes("\\") ||
      relative.split("/").some(p => !p || p === "." || p === "..")) fail("unsafe_path");
  let file = root;
  try {
    for (const part of relative.split("/")) {
      file = path.join(file, part);
      if (fs.lstatSync(file).isSymbolicLink()) fail("source_symlink");
    }
    if (!fs.lstatSync(file).isFile()) fail("source_not_regular");
    return fs.readFileSync(file);
  } catch (error) {
    if (optional && error.code === "ENOENT") return null;
    throw error;
  }
}
function processRole(cmdline, cwd) {
  const argv = cmdline.split("\0").filter(Boolean);
  // PM2 replaces its daemon argv with one process title. Do not exempt a
  // similarly named script, an extra argv entry, or arbitrary root Node.
  if (argv.length === 1 &&
      /^PM2 v[0-9][0-9A-Za-z.+-]*: God Daemon \([^()\r\n]+\)$/.test(argv[0]))
    return "pm2-daemon";
  const words = argv.flatMap(arg => arg.split(/[ \t]+/));
  for (const [file, role] of [["index.cjs", "api"], ["ai-worker.cjs", "worker"]]) {
    if (words.includes(`${APP}/dist/${file}`) ||
        cwd === APP && [`dist/${file}`, `./dist/${file}`].some(p => words.includes(p)))
      return role;
  }
  return "other-node";
}
function applicationProcesses({ procFs = fs, ownPid = process.pid } = {}) {
  const found = [];
  for (const name of procFs.readdirSync("/proc").filter(n => /^\d+$/.test(n) && Number(n) !== ownPid)) {
    try {
      const executable = procFs.readlinkSync(`/proc/${name}/exe`);
      if (!/\/node(?:js)?$/.test(executable)) continue;
      const cwd = procFs.readlinkSync(`/proc/${name}/cwd`);
      const role = processRole(procFs.readFileSync(`/proc/${name}/cmdline`, "utf8"), cwd);
      if (role === "pm2-daemon") continue;
      if (cwd !== APP && role === "other-node") continue;
      if (cwd !== APP) fail("application_cwd_changed");
      const status = procFs.readFileSync(`/proc/${name}/status`, "utf8");
      const match = /^Uid:\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*$/m.exec(status);
      const uids = match && match.slice(1).map(Number);
      if (!uids || uids.some(uid => !Number.isSafeInteger(uid) || uid === 0 || uid !== uids[0]))
        fail("application_privacy_not_verified");
      // Linux start time is field 22, after the parenthesized comm field.
      const stat = procFs.readFileSync(`/proc/${name}/stat`, "utf8");
      const startTime = stat.slice(stat.lastIndexOf(")") + 2).trim().split(/\s+/)[19];
      if (!/^\d+$/.test(startTime || "")) fail("application_identity_not_verified");
      found.push({ pid: Number(name), uid: uids[0], role, startTime, cwd, executable });
    } catch (error) {
      if (["ENOENT", "ESRCH"].includes(error.code)) continue; // Exited process, not an unknown owner.
      throw error;
    }
  }
  if (!found.some(p => p.role === "api") || !found.some(p => p.role === "worker"))
    fail("running_application_not_identified");
  return found.sort((a, b) => a.pid - b.pid);
}
function assertProcessSnapshot(before, after) {
  if (JSON.stringify(before) !== JSON.stringify(after)) fail("application_process_changed");
}
function main(args) {
  if (args.length !== 1 || args[0] !== "--prepare") fail("usage_prepare_only");
  if (os.hostname().split(".")[0].toUpperCase() !== "CORPCRM01" || process.getuid() !== 0)
    fail("root_on_corpcrm01_required");
  if (Number(process.versions.node.split(".")[0]) < 20) fail("node_20_required");
  const env = buildEnvironment(process.env);
  const run = (bin, argv, opts = {}) => cp.execFileSync(bin, argv, {
    encoding: "utf8", timeout: 30000, maxBuffer: 8 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"], env, ...opts,
  });
  const git = argv => run("git", ["--no-optional-locks", "-c", "core.fsmonitor=false",
    "-c", `safe.directory=${APP}`, "-C", APP, ...argv]).trim();
  const source = (ref, file) => run("git", ["--no-optional-locks", "-c", `safe.directory=${APP}`,
    "-C", APP, "show", ref + ":" + file], { encoding: null });
  validateScope(git(["rev-parse", TARGET + "^"]), git(["rev-parse", TARGET + "^{tree}"]),
    git(["diff", "--name-only", BASE, TARGET]).split("\n").filter(Boolean));
  const tracked = new Set(git(["ls-tree", "-r", "--name-only", BASE]).split("\n"));
  const checkFiles = [...new Set([...FILES, "package.json", "package-lock.json", "script/build.ts",
    "server/ai-worker.ts", "server/index.ts", "server/routes.ts", "server/lib/ai/admin-router.ts"])];
  const baseline = () => {
    if (git(["rev-parse", "HEAD"]) !== BASE ||
        git(["status", "--porcelain", "--untracked-files=no"])) fail("production_sources_changed");
    for (const file of checkFiles) {
      const bytes = regular(APP, file, true);
      if (tracked.has(file) ? !bytes || sha(bytes) !== sha(source(BASE, file)) : bytes !== null)
        fail("production_source_conflict");
    }
    for (const [file, digest] of Object.entries(RUNTIME))
      if (sha(regular(APP, file)) !== digest) fail("production_runtime_changed");
  };
  baseline();
  assertMount(JSON.parse(run("findmnt", ["--json", "--target", DATA, "--output", "SOURCE,TARGET"])).filesystems);
  const free = Number(run("df", ["--output=avail", "-B1", DATA]).trim().split(/\s+/).at(-1));
  if (!Number.isSafeInteger(free) || free < 4 * 1024 ** 3) fail("data_space_insufficient");
  const available = Number(/^MemAvailable:\s+(\d+)/m.exec(fs.readFileSync("/proc/meminfo", "utf8"))?.[1]);
  if (!Number.isFinite(available) || available * 1024 < 4 * 1024 ** 3) fail("build_memory_insufficient");
  const processes = applicationProcesses();
  const directory = fs.mkdtempSync(DATA + "/ai-maintenance-stage-");
  fs.chmodSync(directory, 0o700);
  let phase = "privacy";
  try {
    for (const uid of new Set(processes.map(p => p.uid))) {
      for (const access of ["-r", "-x"]) {
        const result = cp.spawnSync("setpriv", [`--reuid=${uid}`, `--regid=${uid}`,
          "--clear-groups", "/usr/bin/test", access, directory], { stdio: "ignore", env });
        if (result.status !== 1) fail("private_stage_access_not_verified");
      }
    }
    phase = "archive";
    const staged = path.join(directory, "source");
    fs.mkdirSync(staged, { mode: 0o700 });
    const archive = path.join(directory, "source.tar");
    const fd = fs.openSync(archive, "wx", 0o600);
    try {
      run("git", ["--no-optional-locks", "-c", `safe.directory=${APP}`, "-C", APP, "archive",
        TARGET, "client", "server", "shared", "script", "ops", "package.json", "package-lock.json",
        "tsconfig.json", "vite.config.ts", "postcss.config.js", "tailwind.config.ts", "components.json"],
        { stdio: ["ignore", fd, "pipe"], timeout: 120000 });
    } finally { fs.closeSync(fd); }
    run("tar", ["-xf", archive, "-C", staged], { timeout: 120000 });
    for (const file of FILES)
      if (sha(regular(staged, file)) !== sha(source(TARGET, file))) fail("stage_source_mismatch");
    for (const file of ["package.json", "package-lock.json", "script/build.ts"])
      if (sha(regular(staged, file)) !== sha(regular(APP, file))) fail("build_dependencies_changed");
    phase = "dependencies";
    const modules = path.join(staged, "node_modules");
    fs.mkdirSync(modules);
    for (const entry of fs.readdirSync(APP + "/node_modules")) {
      if (entry.startsWith(".") && entry !== ".bin") continue;
      const from = APP + "/node_modules/" + entry, to = path.join(modules, entry);
      if (entry.startsWith("@") || entry === ".bin") {
        fs.mkdirSync(to);
        for (const pkg of fs.readdirSync(from)) fs.symlinkSync(path.join(from, pkg), path.join(to, pkg));
      } else fs.symlinkSync(from, to);
    }
    phase = "build";
    console.log("PREPARING_ONLY: private build; live application and worker remain unchanged.");
    const temporary = path.join(directory, "temporary");
    fs.mkdirSync(temporary, { mode: 0o700 });
    const log = fs.openSync(path.join(directory, "build.log"), "wx", 0o600);
    try {
      run("nice", ["-n", "10", process.execPath, APP + "/node_modules/tsx/dist/cli.mjs", "script/build.ts"],
        { cwd: staged, env: { ...env, TMPDIR: temporary },
          timeout: 600000, stdio: ["ignore", log, log] });
    } finally { fs.closeSync(log); }
    phase = "verification";
    baseline();
    assertProcessSnapshot(processes, applicationProcesses());
    const outputs = {};
    for (const file of Object.keys(RUNTIME)) {
      const bytes = regular(staged, file);
      if (!bytes.length) fail("build_output_empty");
      outputs[file] = { bytes: bytes.length, sha256: sha(bytes) };
    }
    const result = { mode: "prepared_not_deployed", productionBase: BASE, sourceCommit: TARGET,
      sourceTree: TREE, stageDirectory: directory, outputs, unchangedProcesses: processes,
      liveApplicationChanged: false, workerRestarted: false, databaseAccessed: false,
      providersActivated: false, backupValidated: false, deploymentAuthorized: false,
      gatewayDrain: "unverified", backendDrain: "unverified" };
    fs.writeFileSync(path.join(directory, "prepared.json"), JSON.stringify(result, null, 2) + "\n", { mode: 0o600 });
    console.log(JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.log(JSON.stringify({ mode: "preparation_failed_no_deployment", phase,
      code: error.safeCode || "stage_operation_failed", stageDirectory: directory,
      liveApplicationChangedByThisTool: false, databaseAccessed: false }));
    throw Object.assign(new Error(error.safeCode || "stage_operation_failed"), { alreadyReported: true });
  }
}
if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (e) { if (!e.alreadyReported) console.error(e.safeCode || "preparation_failed"); process.exitCode = 1; }
}
module.exports = { main, BASE, TARGET, TREE, RUNTIME, FILES, sha, buildEnvironment, validateScope,
  assertMount, regular, processRole, applicationProcesses, assertProcessSnapshot };
