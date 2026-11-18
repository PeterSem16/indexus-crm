"use strict";
// Read-only preparation. Deliberately contains no deployment/worker-start mode.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const SOURCE = "5c7c1f9e065f255d5b300cd503417766f0f81b29";
const BASE = "2464decc180187d1edc9742a4d07f04f918c4660";
const APP = "/var/www/indexus-crm";
const DATA = APP + "/data";
const LOADER = "/etc/indexus-ai-runtime/preload.cjs";
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const blob = bytes => crypto.createHash("sha1")
  .update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes])).digest("hex");
const fail = code => { throw Object.assign(new Error(code), { safeCode: code }); };
const dependencyHash = pkg => hash(Buffer.from(JSON.stringify(
  ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"].map(group =>
    [group, Object.entries(pkg[group] || {}).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)]))));

function validateManifest(m) {
  if (m?.format !== 1 || m.sourceCommit !== SOURCE || m.baseCommit !== BASE ||
      !/^[a-f0-9]{40}$/.test(m.sourceTree || "") ||
      !/^[a-f0-9]{64}$/.test(m.dependenciesSha256 || "") ||
      !/^[a-f0-9]{64}$/.test(m.patchSha256 || "") ||
      !Array.isArray(m.files) || m.files.length !== 56) fail("manifest_invalid");
  const names = new Set();
  for (const e of m.files) {
    if (typeof e.path !== "string" || !/^(client|server|shared|script|docs)\//.test(e.path) && e.path !== "package.json" ||
        e.path.split("/").some(p => !p || p === "." || p === ".." || p.startsWith(".")) ||
        e.path.includes("\\") || names.has(e.path) ||
        !/^[a-f0-9]{40}$/.test(e.blob || "") ||
        e.baseBlob !== null && !/^[a-f0-9]{40}$/.test(e.baseBlob || "") ||
        !/^[a-f0-9]{64}$/.test(e.sha256 || "")) fail("manifest_invalid");
    names.add(e.path);
  }
  return m;
}

function readRegular(root, relative) {
  let target = root;
  for (const [index, part] of relative.split("/").entries()) {
    target = path.join(target, part);
    let stat;
    try { stat = fs.lstatSync(target); }
    catch (error) { if (error.code === "ENOENT") return null; throw error; }
    if (stat.isSymbolicLink()) fail("source_symlink");
    const last = index === relative.split("/").length - 1;
    if (last ? !stat.isFile() : !stat.isDirectory()) fail("source_type_invalid");
  }
  return fs.readFileSync(target);
}

function verifyBundle(directory, manifest) {
  validateManifest(manifest);
  const source = path.join(directory, "sources");
  if (!fs.lstatSync(source).isDirectory() || fs.lstatSync(source).isSymbolicLink()) fail("source_type_invalid");
  const expected = new Set(manifest.files.map(e => e.path));
  const walk = (dir, prefix = "") => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const relative = prefix + entry.name;
      if (entry.isDirectory()) walk(path.join(dir, entry.name), relative + "/");
      else if (!entry.isFile() || !expected.delete(relative)) fail("unexpected_bundle_source");
    }
  };
  walk(source);
  if (expected.size) fail("bundle_source_missing");
  const patch = readRegular(directory, "application.patch");
  if (!patch || hash(patch) !== manifest.patchSha256) fail("bundle_patch_mismatch");
  for (const entry of manifest.files) {
    const bytes = readRegular(source, entry.path);
    if (!bytes || hash(bytes) !== entry.sha256 || blob(bytes) !== entry.blob) fail("bundle_source_mismatch");
  }
  return { verified: true, sourceCommit: SOURCE, files: manifest.files.length };
}

function inspect(manifest, deps = {}) {
  validateManifest(manifest);
  const hostname = (deps.hostname || os.hostname)();
  if (hostname.split(".")[0].toUpperCase() !== "CORPCRM01") fail("wrong_host");
  if ((deps.uid || (() => process.getuid()))() !== 0) fail("root_console_required");
  if (Number(process.versions.node.split(".")[0]) < 20) fail("node_20_required");
  const app = deps.app || APP;
  const run = deps.run || ((bin, args) => execFileSync(bin, args, {
    encoding: "utf8", timeout: 20000, maxBuffer: 4 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim());
  const git = args => run("git", ["--no-optional-locks", "-c", `safe.directory=${app}`, "-C", app, ...args]);
  const checks = [];
  let observedHead = null, trackedChangesCount = null;
  const check = (name, operation) => {
    try { const detail = operation(); checks.push({ name, passed: true, ...(detail || {}) }); }
    catch (error) { checks.push({ name, passed: false, code: error.safeCode || "check_unavailable" }); }
  };
  check("published_source_baseline", () => {
    const head = git(["rev-parse", "HEAD"]);
    if (/^[a-f0-9]{40}$/.test(head)) observedHead = head;
    if (head !== BASE) fail("production_baseline_changed");
    const dirty = git(["status", "--porcelain", "--untracked-files=no"]);
    trackedChangesCount = dirty ? dirty.split("\n").length : 0;
    if (trackedChangesCount) fail("dirty_tracked_checkout");
    for (const entry of manifest.files) {
      const bytes = readRegular(app, entry.path);
      if (entry.baseBlob === null ? bytes !== null : bytes === null || blob(bytes) !== entry.baseBlob)
        fail("production_source_changed");
    }
    return { head };
  });
  check("installed_dependencies", () => {
    const pkg = JSON.parse(readRegular(app, "package.json"));
    if (dependencyHash(pkg) !== manifest.dependenciesSha256) fail("dependency_manifest_changed");
    for (const binary of ["vite", "esbuild", "tsx"]) {
      if (!fs.existsSync(path.join(app, "node_modules", ".bin", binary))) fail("build_tool_missing");
    }
  });
  check("approved_data_volume", () => {
    const mounts = JSON.parse(run("findmnt", ["--json", "--target", DATA, "--output", "SOURCE,TARGET"])).filesystems;
    if (mounts?.length !== 1 || mounts[0].target !== DATA ||
        fs.realpathSync(mounts[0].source) !== fs.realpathSync("/dev/sdb1")) fail("wrong_data_volume");
    const available = Number(run("df", ["--output=avail", "-B1", DATA]).split(/\s+/).at(-1));
    if (!Number.isSafeInteger(available) || available < 2 * 1024 ** 3) fail("insufficient_preparation_space");
    return { availableBytes: available, fullBackupCapacityVerified: false };
  });
  check("installed_gateway_loader", () => {
    const stat = fs.lstatSync(LOADER);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== 0 || stat.mode & 0o022)
      fail("loader_permissions_invalid");
    return { sha256: hash(fs.readFileSync(LOADER)) };
  });
  const runtime = {};
  for (const [key, relative] of [["backend", "dist/index.cjs"], ["entryHtml", "dist/public/index.html"]]) {
    check("current_" + key, () => {
      const bytes = readRegular(app, relative);
      if (!bytes) fail("runtime_missing");
      runtime[key] = hash(bytes);
    });
  }
  const nodeProcesses = [];
  for (const pid of fs.readdirSync("/proc").filter(n => /^\d+$/.test(n))) {
    if (Number(pid) === process.pid) continue;
    try {
      if (fs.readlinkSync(`/proc/${pid}/cwd`) !== fs.realpathSync(app) ||
          !["node", "nodejs"].includes(path.basename(fs.readlinkSync(`/proc/${pid}/exe`)))) continue;
      const status = fs.readFileSync(`/proc/${pid}/status`, "utf8");
      const uid = Number(status.match(/^Uid:\s+(\d+)/m)?.[1]);
      const ppid = Number(status.match(/^PPid:\s+(\d+)/m)?.[1]);
      if (Number.isInteger(uid) && Number.isInteger(ppid)) nodeProcesses.push({ pid: Number(pid), uid, ppid });
    } catch { /* A process can exit while /proc is observed. */ }
  }
  return {
    mode: "read_only_preparation", sourceCommit: SOURCE, expectedBase: BASE,
    checkedAt: new Date().toISOString(), nodeVersion: process.versions.node,
    observedHead, trackedChangesCount, checks, runtime, nodeProcesses,
    preparationChecksPassed: checks.every(c => c.passed),
    deploymentAuthorized: false, backupValidated: false, liveInferenceTested: false,
    next: "Review baseline, privately validate backup and finalize pinned build promotion before any production change.",
  };
}

function main(args) {
  if (args.length !== 2 || !["--manifest", "--verify-bundle"].includes(args[0])) fail("usage_invalid");
  if (args[0] === "--verify-bundle") {
    const directory = path.resolve(args[1]);
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, "release-manifest.json"), "utf8"));
    console.log(JSON.stringify(verifyBundle(directory, manifest), null, 2));
    return;
  }
  const manifest = JSON.parse(fs.readFileSync(args[1], "utf8"));
  const result = inspect(manifest);
  console.log(JSON.stringify(result, null, 2));
  if (!result.preparationChecksPassed) process.exitCode = 2;
}

module.exports = { validateManifest, verifyBundle, inspect, main, hash, blob, dependencyHash, SOURCE, BASE };
if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) {
    console.log(JSON.stringify({ mode: "read_only_preparation", passed: false,
      code: error.safeCode || "preflight_unavailable", deploymentAuthorized: false }));
    process.exitCode = 2;
  }
}
