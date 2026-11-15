// Operator entry point from an EXTRACTED, verified C1 bundle. Never edits the live app.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const fail = code => { throw Error(code); };
function prepareIsolatedRoot(bundle, app) {
  const manifest = JSON.parse(fs.readFileSync(path.join(bundle, "manifest.json"), "utf8"));
  if (manifest.phase !== "C1") fail("C1_BUNDLE_INVALID");
  for (const [file, expected] of Object.entries(manifest.files)) {
    const full = path.resolve(bundle, file);
    if (!full.startsWith(bundle + path.sep) || fs.lstatSync(full).isSymbolicLink() ||
        hash(fs.readFileSync(full)) !== expected) fail("C1_BUNDLE_HASH_MISMATCH");
  }
  const sources = JSON.parse(fs.readFileSync(path.join(bundle, "runtime-sources.json"), "utf8"));
  const verifiedSources = new Map();
  for (const [file, expected] of Object.entries(sources)) {
    // Only this standalone test helper comes from the hash-verified bundle.
    // All CRM prompts, parsers and adapters must still match the live checkout.
    const bundledHelper = file === "script/ai-gateway-b4-pilot.cjs";
    const base = bundledHelper ? bundle : app;
    if (bundledHelper && manifest.files[file] !== expected) fail("C1_BUNDLE_HELPER_HASH_MISMATCH");
    const full = path.resolve(base, file);
    if (!full.startsWith(base + path.sep) || !fs.realpathSync(full).startsWith(base + path.sep) ||
        hash(fs.readFileSync(full)) !== expected) fail("C1_LIVE_SOURCE_DIFFERS_FROM_REFERENCE");
    verifiedSources.set(file, full);
  }
  const data = path.join(app, "data");
  if (fs.realpathSync(data) !== data || !fs.statSync(data).isDirectory()) fail("C1_PRIVATE_DATA_DIRECTORY_REQUIRED");
  const root = fs.mkdtempSync(path.join(data, "c1-isolated-runner-"));
  fs.chmodSync(root, 0o700);
  const copy = (from, file) => {
    const to = path.join(root, file);
    fs.mkdirSync(path.dirname(to), { recursive: true, mode: 0o700 });
    fs.writeFileSync(to, fs.readFileSync(from), { mode: 0o600, flag: "wx" });
  };
  for (const [file, full] of verifiedSources) copy(full, file);
  for (const file of Object.keys(manifest.files).filter(f => f.startsWith("script/ai-gateway-c1/")))
    copy(path.join(bundle, file), file);
  copy(path.join(bundle, "plan.json"), "plan.json");
  fs.writeFileSync(path.join(root, "package.json"), '{"type":"module"}\n', { flag: "wx", mode: 0o600 });
  // Existing dependencies/credentials stay in place. No installation or secret copying.
  fs.symlinkSync(path.join(app, "node_modules"), path.join(root, "node_modules"));
  fs.symlinkSync(path.join(app, ".env"), path.join(root, ".env"));
  return root;
}
function launch() {
  if (process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN || process.platform !== "linux" ||
      os.hostname().split(".")[0].toUpperCase() !== "CORPCRM01") fail("C1_CORPCRM01_ONLY");
  if (process.getuid?.() !== 1001) fail("C1_RUN_AS_SEMAN");
  const bundle = path.resolve(__dirname, "../.."), app = "/var/www/indexus-crm";
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 2) {
    if (!["--services", "--audio-profile", "--audio-fixtures"].includes(args[i]) || !args[i + 1] ||
        args[i + 1].startsWith("--")) fail("C1_ARGUMENTS_INVALID");
    if (args[i] !== "--services") args[i + 1] = path.resolve(args[i + 1]);
  }
  const root = prepareIsolatedRoot(bundle, app);
  console.log("C1_ISOLATED_ROOT " + root);
  const result = spawnSync(process.execPath, ["--require", "/etc/indexus-ai-runtime/preload.cjs",
    "--import", "tsx", path.join(root, "script/ai-gateway-c1/run.ts"), "--run-c1",
    path.join(root, "plan.json"), ...args], { cwd: root, stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production" } });
  process.exitCode = result.status ?? 1;
}
module.exports = { prepareIsolatedRoot };
if (require.main === module) {
  try { launch(); } catch (error) {
    console.error(/^C1_[A-Z0-9_]+$/.test(error?.message) ? error.message :
      /^E[A-Z0-9]+$/.test(error?.code) ? "C1_ISOLATED_FILESYSTEM_" + error.code : "C1_ISOLATED_LAUNCH_FAILED");
    process.exitCode = 1;
  }
}
