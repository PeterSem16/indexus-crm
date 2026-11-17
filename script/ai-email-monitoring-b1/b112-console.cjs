"use strict";
// Extract one pinned candidate to a private directory. No pull/checkout/install,
// live build, PM2 restart, credential-file edit or production-routing write.
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const cp = require("node:child_process");
function main() {
  const pin = process.argv[2], app = "/var/www/indexus-crm";
  if (process.argv.length !== 3 || !/^[a-f0-9]{40}$/.test(pin || "")) throw Error("B112_PIN_REQUIRED");
  if (os.hostname().split(".")[0].toUpperCase() !== "CORPCRM01" || process.getuid?.() !== 1001 ||
    process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN) throw Error("B112_CORPCRM01_AS_SEMAN_REQUIRED");
  const parent = path.join(os.homedir(), "INDEXUS-Email-Monitoring-Tools");
  if (!fs.existsSync(parent)) fs.mkdirSync(parent, { mode: 0o700 });
  const st = fs.lstatSync(parent);
  if (!st.isDirectory() || st.isSymbolicLink() || st.uid !== process.getuid() || (st.mode & 0o077))
    throw Error("B112_PRIVATE_PARENT_REQUIRED");
  const work = fs.mkdtempSync(path.join(parent, "B112-"));
  const source = path.join(work, "source"), output = path.join(work, "bundle");
  fs.mkdirSync(source, { mode: 0o700 });
  const archive = cp.execFileSync("git", ["archive", pin, "server/lib/ai",
    "server/lib/email-monitoring-service.ts", "shared/ai-settings.ts", "script/ai-email-monitoring-b1",
    "script/ai-gateway-b4-pilot.cjs"], { cwd: app, maxBuffer: 25 * 1024 * 1024 });
  const extraction = cp.spawnSync("tar", ["-x", "-C", source], { input: archive });
  if (extraction.status !== 0) throw Error("B112_EXTRACTION_FAILED");
  fs.symlinkSync(path.join(app, "node_modules"), path.join(source, "node_modules"));
  const build = cp.spawnSync(process.execPath, ["script/ai-email-monitoring-b1/b112-package.cjs", output],
    { cwd: source, stdio: "inherit" });
  if (build.status !== 0) throw Error("B112_BUILD_FAILED");
  const run = cp.spawnSync(process.execPath, ["--require", "/etc/indexus-ai-runtime/preload.cjs",
    path.join(output, "run-b112.cjs"), "--run-seven"],
    { cwd: app, stdio: "inherit", env: { ...process.env, NODE_ENV: "production" } });
  process.exitCode = run.status ?? 1;
}
if (require.main === module) {
  try { main(); } catch { console.error("B112_PREPARATION_STOPPED"); process.exitCode = 1; }
}
