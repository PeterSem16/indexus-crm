#!/usr/bin/env node
// Build a standalone private test bundle; does not deploy or execute it.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const esbuild = require("esbuild");
const { analyzeSource } = require("./source.cjs");
async function main() {
  const out = process.argv[2];
  const b12 = process.argv[3] === "--b12";
  const b13 = process.argv[3] === "--b13";
  const b14 = process.argv[3] === "--b14";
  const b15 = process.argv[3] === "--b15";
  const b16 = process.argv[3] === "--b16";
  const b17 = process.argv[3] === "--b17";
  const b18 = process.argv[3] === "--b18";
  if (process.argv.length !== (b12 || b13 || b14 || b15 || b16 || b17 || b18 ? 4 : 3)) throw Error("B1_BUILD_ARGUMENTS_INVALID");
  if (!out || fs.existsSync(out)) throw Error("B1_NEW_OUTPUT_DIRECTORY_REQUIRED");
  const source = analyzeSource(path.resolve("server/lib/email-monitoring-service.ts"));
  fs.mkdirSync(out, { recursive: true, mode: 0o700 });
  const name = b18 ? "run-b18.cjs" : b17 ? "run-b17.cjs" : b16 ? "run-b16.cjs" : b15 ? "run-b15.cjs" : b14 ? "run-b14.cjs" : b13 ? "run-b13.cjs" : b12 ? "run-b12.cjs" : "run-b1.cjs";
  const outfile = path.join(out, name);
  await esbuild.build({ entryPoints: [b12 || b13 || b14 || b15 || b16 || b17 || b18 ? "script/ai-email-monitoring-b1/b12-run.ts" : "script/ai-email-monitoring-b1/run.ts"], outfile,
    bundle: true, platform: "node", target: "node20", format: "cjs", logLevel: "silent",
    banner: { js: `if (process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN || process.platform !== "linux" || require("node:os").hostname().split(".")[0].toUpperCase() !== "CORPCRM01") { console.error("B1_CORPCRM01_ONLY"); process.exit(1); }\nmodule.paths.unshift("/var/www/indexus-crm/node_modules");` },
    external: ["pg", "openai", "dotenv", "zod", "drizzle-orm", "drizzle-orm/*"],
    define: { B1_PREPARED_SOURCE: JSON.stringify(source), B1_PILOT_PHASE: JSON.stringify(b18 ? "B18" : b17 ? "B17" : b16 ? "B16" : b15 ? "B15" : b14 ? "B14" : b13 ? "B13" : "B12") } });
  fs.chmodSync(outfile, 0o600);
  const hash = text => crypto.createHash("sha256").update(text).digest("hex");
  const manifest = { kind: b18 ? "ISOLATED_B18_135_CASE_PAIRED_REGRESSION_NOT_PRODUCTION_DEPLOYMENT" :
    b17 ? "ISOLATED_B17_100_UNSEEN_CASE_VALIDATION_NOT_PRODUCTION_DEPLOYMENT" :
    b16 ? "ISOLATED_B16_35_CASE_STRICT_REGRESSION_NOT_PRODUCTION_DEPLOYMENT" :
    b15 ? "ISOLATED_B15_35_CASE_FINAL_REGRESSION_NOT_PRODUCTION_DEPLOYMENT" :
    b14 ? "ISOLATED_B14_35_CASE_REGRESSION_NOT_PRODUCTION_DEPLOYMENT" :
    b13 ? "ISOLATED_B13_30_CASE_PILOT_NOT_PRODUCTION_DEPLOYMENT" :
    b12 ? "ISOLATED_B12_SINGLE_TEST_NOT_PRODUCTION_DEPLOYMENT" : "ISOLATED_B1_TEST_NOT_PRODUCTION_DEPLOYMENT",
    originalRequestSha256: source.requestSha256, preparedAnalyzerSha256: source.sourceSha256,
    files: { [name]: hash(fs.readFileSync(outfile)) } };
  fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { mode: 0o600 });
  console.log(JSON.stringify(manifest, null, 2));
}
main().catch(() => { console.error("B1_BUNDLE_BUILD_FAILED"); process.exitCode = 1; });
