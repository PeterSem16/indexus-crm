// Reproducible offline handoff. No network, credentials, DB or application imports.
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { prepare, hash } = require("./prepare.cjs");
const ROOT = path.resolve(__dirname, "../..");
const [catalogFile, destination, referenceRoot] = process.argv.slice(2);
if (!catalogFile || !destination) throw Error("Usage: package.cjs CATALOG.json NEW_OUTPUT_DIRECTORY");
const out = path.resolve(destination);
if (!out.startsWith(path.join(ROOT, "generated-artifacts") + path.sep))
  throw Error("C1_PACKAGE_MUST_BE_IN_GENERATED_ARTIFACTS");
fs.mkdirSync(out, { recursive: false, mode: 0o700 });
const plan = prepare(JSON.parse(fs.readFileSync(catalogFile, "utf8")), referenceRoot || ROOT);
fs.writeFileSync(path.join(out, "plan.json"), JSON.stringify(plan, null, 2) + "\n", { mode: 0o600 });
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
const manifest = Object.fromEntries([...files, reference, "plan.json",
  "evidence/evidence.json", "evidence/evidence.csv", "evidence/evidence.html"]
  .map(file => [file, hash(fs.readFileSync(path.join(out, file)))]));
fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify({
  phase: "C1", kind: "OFFLINE_HANDOFF_NOT_LIVE_RESULTS", files: manifest,
  requiredExistingSources: plan.sourceHashes,
  instructions: "Read docs/ai-gateway-c1-compatibility.md. Do not deploy the workspace branch. No production switch is authorized.",
}, null, 2) + "\n", { mode: 0o600 });
execFileSync("zip", ["-q", "-r", path.join(out, "INDEXUS-AI-C1-podklady.zip"),
  "plan.json", "manifest.json", "evidence", "script", "docs", "generated-artifacts"], { cwd: out });
console.log("C1_OFFLINE_HANDOFF " + out);
