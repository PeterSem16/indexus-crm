"use strict";
// Preparation only. There is deliberately no deployment, DB or PM2 mode.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const cp = require("node:child_process");
const APP = "/var/www/indexus-crm";
const DATA = APP + "/data";
const BASE = "0ee328b123a33014fab7380210ac7ee158b14085";
const LOADER = "/etc/indexus-ai-runtime/preload.cjs";
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const fail = code => { throw Object.assign(new Error(code), { safeCode: code }); };
const env = { ...process.env };
delete env.NODE_OPTIONS;
delete env.NODE_PATH;
delete env.DATABASE_URL;
const dependencyHash = pkg => sha(Buffer.from(JSON.stringify(
  ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"].map(group =>
    [group, Object.entries(pkg[group] || {}).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)]))));
function run(bin, args, options = {}) {
  return cp.execFileSync(bin, args, {
    encoding: "utf8", timeout: 30000, maxBuffer: 8 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"], env, ...options,
  });
}
const git = args => run("git", ["--no-optional-locks", "-c", `safe.directory=${APP}`, "-C", APP, ...args]).trim();
function regular(root, name) {
  let file = root;
  for (const part of name.split("/")) {
    file = path.join(file, part);
    let stat;
    try { stat = fs.lstatSync(file); }
    catch (error) { if (error.code === "ENOENT") return null; throw error; }
    if (stat.isSymbolicLink()) fail("source_symlink");
  }
  if (!fs.lstatSync(file).isFile()) fail("source_not_regular");
  return fs.readFileSync(file);
}
function validateManifest(m) {
  if (m?.format !== 2 || m.productionBase !== BASE ||
      !/^[a-f0-9]{40}$/.test(m.sourceCommit || "") ||
      !/^[a-f0-9]{40}$/.test(m.sourceTree || "") ||
      !/^[a-f0-9]{64}$/.test(m.dependenciesSha256 || "") ||
      !/^[a-f0-9]{64}$/.test(m.loaderSha256 || "") ||
      !Array.isArray(m.files) || m.files.length < 56 || m.files.length > 80) fail("manifest_invalid");
  if (JSON.stringify(Object.keys(m.runtime || {}).sort()) !==
      JSON.stringify(["dist/index.cjs", "dist/public/index.html"]) ||
      Object.values(m.runtime).some(value => !/^[a-f0-9]{64}$/.test(value))) fail("manifest_runtime_invalid");
  const names = new Set();
  for (const f of m.files) {
    if (!/^(client|server|shared|script|docs)\//.test(f.path || "") && f.path !== "package.json")
      fail("manifest_path_invalid");
    if (f.path.split("/").some(p => !p || p === "." || p === ".." || p.startsWith(".")) ||
        f.path.includes("\\") || names.has(f.path) || !/^[a-f0-9]{64}$/.test(f.sha256 || "") ||
        f.baseSha256 !== null && !/^[a-f0-9]{64}$/.test(f.baseSha256 || "")) fail("manifest_invalid");
    names.add(f.path);
  }
  return m;
}
function baseline(m) {
  if (git(["rev-parse", "HEAD"]) !== BASE) fail("production_baseline_changed");
  if (git(["status", "--porcelain", "--untracked-files=no"])) fail("dirty_tracked_checkout");
  for (const f of m.files) {
    const bytes = regular(APP, f.path);
    if (f.baseSha256 === null ? bytes !== null : bytes === null || sha(bytes) !== f.baseSha256)
      fail("production_source_conflict");
  }
  if (dependencyHash(JSON.parse(regular(APP, "package.json"))) !== m.dependenciesSha256)
    fail("dependencies_changed");
  for (const [name, expected] of Object.entries(m.runtime)) {
    const bytes = regular(APP, name);
    if (!bytes || sha(bytes) !== expected) fail("production_runtime_changed");
  }
  const loader = fs.lstatSync(LOADER);
  if (!loader.isFile() || loader.isSymbolicLink() || loader.uid !== 0 || loader.mode & 0o022 ||
      sha(fs.readFileSync(LOADER)) !== m.loaderSha256) fail("gateway_loader_changed");
  const processStat = fs.readFileSync("/proc/958103/status", "utf8");
  if (!/^Uid:\s+1001\s/m.test(processStat) ||
      fs.readlinkSync("/proc/958103/cwd") !== APP) fail("application_process_changed");
}
function main(args) {
  if (args.length !== 2 || args[0] !== "--prepare") fail("usage_prepare_only");
  const m = validateManifest(JSON.parse(fs.readFileSync(args[1], "utf8")));
  if (os.hostname().split(".")[0].toUpperCase() !== "CORPCRM01" || process.getuid() !== 0)
    fail("root_on_corpcrm01_required");
  if (Number(process.versions.node.split(".")[0]) < 20) fail("node_20_required");
  const mounts = JSON.parse(run("findmnt", ["--json", "--target", DATA, "--output", "SOURCE,TARGET"])).filesystems;
  if (mounts?.length !== 1 || mounts[0].target !== DATA ||
      fs.realpathSync(mounts[0].source) !== fs.realpathSync("/dev/sdb1")) fail("approved_data_volume_required");
  const available = Number(run("df", ["--output=avail", "-B1", DATA]).trim().split(/\s+/).at(-1));
  if (!Number.isSafeInteger(available) || available < 4 * 1024 ** 3) fail("stage_space_insufficient");
  baseline(m);
  if (git(["rev-parse", `${m.sourceCommit}^{tree}`]) !== m.sourceTree ||
      git(["rev-parse", `${m.sourceCommit}^`]) !== BASE) fail("release_identity_invalid");
  const expectedNames = m.files.map(f => f.path).sort();
  const actualNames = git(["diff", "--name-only", BASE, m.sourceCommit]).split("\n").filter(Boolean).sort();
  if (JSON.stringify(expectedNames) !== JSON.stringify(actualNames)) fail("release_scope_mismatch");
  const work = fs.mkdtempSync(DATA + "/ai-services-stage-");
  fs.chmodSync(work, 0o700);
  const logFile = path.join(work, "preparation.log");
  let phase = "extract";
  try {
    const source = path.join(work, "source");
    fs.mkdirSync(source, { mode: 0o700 });
    const archive = path.join(work, "source.tar");
    const fd = fs.openSync(archive, "wx", 0o600);
    try {
      run("git", ["--no-optional-locks", "-c", `safe.directory=${APP}`, "-C", APP,
        "archive", m.sourceCommit, "client", "server", "shared", "script", "package.json",
        "package-lock.json", "tsconfig.json", "vite.config.ts", "postcss.config.js",
        "tailwind.config.ts", "components.json"], { stdio: ["ignore", fd, "pipe"], timeout: 120000 });
    } finally { fs.closeSync(fd); }
    run("tar", ["-xf", archive, "-C", source], { timeout: 120000 });
    for (const f of m.files.filter(f => !f.path.startsWith("docs/"))) {
      const bytes = regular(source, f.path);
      if (!bytes || sha(bytes) !== f.sha256) fail("stage_source_hash_mismatch");
    }
    phase = "dependencies";
    if (dependencyHash(JSON.parse(regular(source, "package.json"))) !== m.dependenciesSha256)
      fail("stage_dependencies_changed");
    const modules = path.join(source, "node_modules");
    fs.mkdirSync(modules);
    const installed = path.join(APP, "node_modules");
    for (const entry of fs.readdirSync(installed)) {
      if (entry.startsWith(".") && entry !== ".bin") continue;
      const from = path.join(installed, entry), to = path.join(modules, entry);
      if (entry.startsWith("@")) {
        fs.mkdirSync(to);
        for (const pkg of fs.readdirSync(from)) fs.symlinkSync(path.join(from, pkg), path.join(to, pkg));
      } else fs.symlinkSync(from, to);
    }
    fs.symlinkSync(path.join(APP, "attached_assets"), path.join(source, "attached_assets"));
    phase = "build";
    console.log("PREPARING_BUILD: live application remains unchanged");
    const log = fs.openSync(logFile, "wx", 0o600);
    try {
      run(process.execPath, [path.join(APP, "node_modules/tsx/dist/cli.mjs"), "script/build.ts"],
        { cwd: source, env: { ...env, NODE_ENV: "production" }, timeout: 600000, stdio: ["ignore", log, log] });
    } finally { fs.closeSync(log); }
    phase = "final_checks";
    baseline(m);
    const output = {};
    for (const file of ["dist/index.cjs", "dist/ai-worker.cjs", "dist/public/index.html"]) {
      const bytes = regular(source, file);
      if (!bytes?.length) fail("build_output_missing");
      output[file] = { bytes: bytes.length, sha256: sha(bytes) };
    }
    const result = { mode: "prepared_not_deployed", productionBase: BASE, sourceCommit: m.sourceCommit,
      stageDirectory: work, outputs: output, liveApplicationChanged: false, workerStarted: false,
      providersActivated: false, databaseAccessed: false, backupValidated: false, deploymentAuthorized: false };
    fs.writeFileSync(path.join(work, "prepared.json"), JSON.stringify(result, null, 2) + "\n", { mode: 0o600 });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ mode: "preparation_failed_no_deployment", phase,
      code: error.safeCode || "stage_operation_failed", stageDirectory: work,
      privateLog: logFile, liveApplicationChanged: false }));
    process.exitCode = 2;
  }
}
module.exports = { validateManifest, dependencyHash, sha, main };
if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.log(JSON.stringify({ mode: "preparation_refused", code: error.safeCode || "preparation_unavailable",
    liveApplicationChanged: false })); process.exitCode = 2; }
}
