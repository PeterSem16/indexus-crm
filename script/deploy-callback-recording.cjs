#!/usr/bin/env node
"use strict";

// Operator-only deployment; build away from live assets and never install packages.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const http = require("node:http");
const { execFileSync } = require("node:child_process");
const root = "/var/www/indexus-crm";
const base = "4cd6e34073d5650f33baf097309613dfba4327ea";
const permitted = new Set([
  "client/src/components/sip-phone.tsx", "client/src/contexts/sip-context.tsx",
  "client/src/pages/agent-workspace.tsx", "server/routes.ts", "server/lib/queue-engine.ts",
  "server/lib/queue-call-lifecycle.ts",
  "server/lib/missed-call-callback.ts", "server/lib/missed-call-callback-flow.test.ts",
  "server/lib/standing-recording-transitions.ts", "server/lib/standing-recording-transitions.test.ts",
  "server/lib/standing-recording-flow.test.ts", "shared/missed-call-callback.ts",
  "shared/missed-call-callback.test.ts", "script/deploy-callback-recording.cjs",
  "script/deploy-callback-recording.test.cjs",
]);
const args = process.argv.slice(2);
const target = args[args.indexOf("--target") + 1];
function command(bin, args, options = {}) {
  return execFileSync(bin, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options });
}
const git = (...args) => command("git", args).trim();
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
function assert(condition, message) { if (!condition) throw new Error(message); }
function filesStillMatch(commit, files) {
  for (const file of files) {
    // Probe the tree separately: a failed blob read is never proof of absence.
    // The tree entry is tiny even when the source file exceeds Node's default
    // 1 MiB child-process output buffer.
    const entry = command("git", ["ls-tree", "-z", commit, "--", file]);
    const exists = fs.existsSync(path.join(root, file));
    if (!entry) {
      assert(!exists, `UNTRACKED_CONFLICT: ${file}`);
      continue;
    }
    const match = /^(100644|100755) blob ([a-f0-9]{40})\t([\s\S]*)\0$/.exec(entry);
    assert(match && match[3] === file, `INVALID_SOURCE_ENTRY: ${file}`);
    let blob;
    try {
      blob = execFileSync("git", ["cat-file", "blob", match[2]], {
        cwd: root, maxBuffer: 64 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch {
      throw new Error(`GIT_BLOB_READ_FAILED: ${file}`);
    }
    assert(exists && hash(fs.readFileSync(path.join(root, file))) === hash(blob), `SOURCE_CHANGED: ${file}`);
  }
}
function status(url) {
  return new Promise(resolve => {
    const req = http.get(url, res => { res.resume(); resolve(res.statusCode); });
    req.on("error", () => resolve(0));
    req.setTimeout(2000, () => { req.destroy(); resolve(0); });
  });
}
async function ready() {
  for (let i = 0; i < 30; i++) {
    const [page, api] = await Promise.all([
      status("http://127.0.0.1:5000/"), status("http://127.0.0.1:5000/api/users"),
    ]);
    if (page === 200 && api === 401) return true;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return false;
}
function atomicCopy(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.new`;
  fs.copyFileSync(source, temporary);
  fs.renameSync(temporary, destination);
}
async function main() {
  assert(os.userInfo().username === "seman" && os.hostname().split(".")[0].toUpperCase() === "CORPCRM01",
    "Run only as seman on CORPCRM01");
  assert(args.includes("--apply") && args.includes("--allow-restart"), "Explicit --apply --allow-restart is required");
  assert(args.includes("--target") && /^[a-f0-9]{40}$/.test(target || ""), "A pinned 40-character target commit is required");
  assert(git("rev-parse", "HEAD") === base, "Unexpected production HEAD; stop and review it");
  assert(!git("diff", "--name-only", "HEAD").split("\n").filter(Boolean)
    .some(file => /^(client\/|server\/|shared\/|script\/|package)/.test(file)), "Local application edits must be reviewed first");
  git("fetch", "origin", "main");
  assert(git("rev-parse", "origin/main") === target, "Remote main changed; stop and review it");
  git("merge-base", "--is-ancestor", base, target);
  const files = git("diff", "--name-only", base, target).split("\n").filter(Boolean);
  assert(files.length > 0 && files.every(file => permitted.has(file)), "Release contains unexpected paths");
  assert(!git("diff", "--name-status", base, target).split("\n").some(line => line.startsWith("D\t")),
    "This release must not delete any files");
  filesStillMatch(base, files);
  const backup = fs.mkdtempSync("/home/seman/indexus-callback-update-");
  fs.chmodSync(backup, 0o700);
  const build = path.join(backup, "build");
  fs.mkdirSync(build, { mode: 0o700 });
  fs.writeFileSync(path.join(backup, "source-head.txt"), base + "\n", { mode: 0o600 });
  fs.writeFileSync(path.join(backup, "target-head.txt"), target + "\n", { mode: 0o600 });
  fs.cpSync(path.join(root, "dist"), path.join(backup, "dist"), { recursive: true });
  console.log(`ZÁLOHA: ${backup}`);
  const archive = execFileSync("git", ["archive", target], { cwd: root, maxBuffer: 250 * 1024 * 1024 });
  execFileSync("tar", ["-x", "-C", build], { input: archive });
  fs.symlinkSync(path.join(root, "node_modules"), path.join(build, "node_modules"));
  if (fs.existsSync(path.join(root, ".env"))) fs.symlinkSync(path.join(root, ".env"), path.join(build, ".env"));
  execFileSync("npm", ["run", "build"], { cwd: build, stdio: "inherit" });
  assert(fs.existsSync(path.join(build, "dist/index.cjs")) && fs.existsSync(path.join(build, "dist/public/index.html")),
    "Incomplete private build; live files were not changed");
  assert(git("rev-parse", "HEAD") === base, "Production HEAD changed during build");
  filesStillMatch(base, files);
  git("merge", "--ff-only", target);
  filesStillMatch(target, files);
  let promotionStarted = false;
  try {
    promotionStarted = true;
    // Keep old hashed chunks for browsers that still have the previous HTML.
    const builtPublic = path.join(build, "dist/public");
    for (const name of fs.readdirSync(builtPublic)) {
      if (name === "index.html") continue;
      fs.cpSync(path.join(builtPublic, name), path.join(root, "dist/public", name), { recursive: true });
    }
    atomicCopy(path.join(builtPublic, "index.html"), path.join(root, "dist/public/index.html"));
    atomicCopy(path.join(build, "dist/index.cjs"), path.join(root, "dist/index.cjs"));
    command("pm2", ["restart", "indexus-crm"], { stdio: "inherit" });
    assert(await ready(), "New runtime did not pass readiness checks");
    console.log(`AKTUALIZÁCIA OK: ${target}\nZÁLOHA: ${backup}`);
  } catch (error) {
    if (promotionStarted) {
      fs.cpSync(path.join(backup, "dist"), path.join(root, "dist"), { recursive: true });
      command("pm2", ["restart", "indexus-crm"], { stdio: "inherit" });
      console.error(`OLD RUNTIME RESTORED; Git source remains ${target}; database was not restored`);
      console.error(`RESTORED_RUNTIME_READY: ${await ready()}`);
    }
    throw error;
  }
}
if (require.main === module) main().catch(error => {
  console.error("DEPLOYMENT_STOPPED:", String(error.message || "unknown").split("\n")[0]
    .replace(/(https?:\/\/)[^/@\s]+@/gi, "$1[redacted]@")
    .replace(/((?:password|token|secret|authorization)[=:]\s*)[^\s&]+/gi, "$1[redacted]"));
  process.exitCode = 1;
});
