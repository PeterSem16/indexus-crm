// Reproducible offline handoff. No network, credentials, DB or application imports.
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { prepare, hash } = require("./prepare.cjs");
const { fixtureManifestTemplate, runtimeProfileTemplate } = require("./transcription-mapping.cjs");
const ROOT = path.resolve(__dirname, "../..");
const [catalogFile, destination, referenceRoot] = process.argv.slice(2);
if (!catalogFile || !destination) throw Error("Usage: package.cjs CATALOG.json NEW_OUTPUT_DIRECTORY");
const out = path.resolve(destination);
const referenceDirectory = referenceRoot ? path.resolve(referenceRoot) : ROOT;
if (!out.startsWith(path.join(ROOT, "generated-artifacts") + path.sep))
  throw Error("C1_PACKAGE_MUST_BE_IN_GENERATED_ARTIFACTS");
fs.mkdirSync(out, { recursive: false, mode: 0o700 });
const plan = prepare(JSON.parse(fs.readFileSync(catalogFile, "utf8")), referenceDirectory);
fs.writeFileSync(path.join(out, "plan.json"), JSON.stringify(plan, null, 2) + "\n", { mode: 0o600 });
const graphFile = path.join(out, "runtime-imports.json");
execFileSync(path.join(ROOT, "node_modules/.bin/esbuild"), ["script/ai-gateway-c1/run.ts", "--bundle",
  "--platform=node", "--format=esm", "--packages=external", "--metafile=" + graphFile,
  "--outfile=" + path.join(out, "runtime-validation.mjs")], { cwd: ROOT, stdio: "pipe" });
const core = [...new Set([...Object.keys(JSON.parse(fs.readFileSync(graphFile, "utf8")).inputs),
  ...Object.keys(plan.sourceHashes)])].filter(f => !f.startsWith("script/ai-gateway-c1/"));
const runtimeSources = Object.fromEntries(core.map(f => [f,
  hash(fs.readFileSync(path.join(referenceDirectory, f)))]));
fs.writeFileSync(path.join(out, "runtime-sources.json"), JSON.stringify(runtimeSources, null, 2) + "\n", { mode: 0o600 });
fs.writeFileSync(path.join(out, "audio-fixtures.template.json"), JSON.stringify(fixtureManifestTemplate(), null, 2) + "\n");
fs.writeFileSync(path.join(out, "audio-profile.template.json"), JSON.stringify(runtimeProfileTemplate(), null, 2) + "\n");
execFileSync(process.execPath, ["--import", "tsx", path.join(__dirname, "run.ts"), "--offline",
  path.join(out, "plan.json"), path.join(out, "evidence"), ...(referenceRoot ? [referenceRoot] : [])],
  { cwd: ROOT, stdio: "inherit" });
const files = [...fs.readdirSync(__dirname).map(f => "script/ai-gateway-c1/" + f),
  "script/ai-gateway-b4-pilot.cjs", "docs/ai-gateway-c1-compatibility.md"];
for (const file of files) {
  fs.mkdirSync(path.dirname(path.join(out, file)), { recursive: true });
  fs.copyFileSync(path.join(ROOT, file), path.join(out, file));
}
// Include reference input so offline coverage tests in the receiving checkout need not skip.
const reference = "generated-artifacts/ai-service-inventory/INDEXUS-65-AI-sluzieb.json";
fs.mkdirSync(path.dirname(path.join(out, reference)), { recursive: true });
fs.copyFileSync(catalogFile, path.join(out, reference));
const manifest = Object.fromEntries([...files, reference, "plan.json", "runtime-sources.json",
  "audio-fixtures.template.json", "audio-profile.template.json",
  "evidence/evidence.json", "evidence/evidence.csv", "evidence/evidence.html"]
  .map(file => [file, hash(fs.readFileSync(path.join(out, file)))]));
fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify({
  phase: "C1", kind: "OFFLINE_HANDOFF_NOT_LIVE_RESULTS", files: manifest,
  requiredExistingSources: plan.sourceHashes,
  instructions: "Read docs/ai-gateway-c1-compatibility.md. Do not deploy the workspace branch. No production switch is authorized.",
}, null, 2) + "\n", { mode: 0o600 });
execFileSync("zip", ["-q", "-r", path.join(out, "INDEXUS-AI-C1-podklady.zip"),
  "plan.json", "manifest.json", "runtime-sources.json", "audio-fixtures.template.json",
  "audio-profile.template.json", "evidence", "script", "docs", "generated-artifacts"], { cwd: out });
console.log("C1_OFFLINE_HANDOFF " + out);
