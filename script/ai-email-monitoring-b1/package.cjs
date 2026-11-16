#!/usr/bin/env node
// Build a standalone private test bundle; does not deploy or execute it.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const esbuild = require("esbuild");
const { analyzeSource } = require("./source.cjs");
async function main() {
  const out = process.argv[2];
  if (!out || fs.existsSync(out)) throw Error("B1_NEW_OUTPUT_DIRECTORY_REQUIRED");
  const source = analyzeSource(path.resolve("server/lib/email-monitoring-service.ts"));
  fs.mkdirSync(out, { recursive: true, mode: 0o700 });
  const outfile = path.join(out, "run-b1.cjs");
  await esbuild.build({ entryPoints: ["script/ai-email-monitoring-b1/run.ts"], outfile,
    bundle: true, platform: "node", target: "node20", format: "cjs", logLevel: "silent",
    banner: { js: `if (process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN || process.platform !== "linux" || require("node:os").hostname().split(".")[0].toUpperCase() !== "CORPCRM01") { console.error("B1_CORPCRM01_ONLY"); process.exit(1); }\nmodule.paths.unshift("/var/www/indexus-crm/node_modules");` },
    external: ["pg", "openai", "dotenv", "zod", "drizzle-orm", "drizzle-orm/*"],
    define: { B1_PREPARED_SOURCE: JSON.stringify(source) } });
  fs.chmodSync(outfile, 0o600);
  const hash = text => crypto.createHash("sha256").update(text).digest("hex");
  const manifest = { kind: "ISOLATED_B1_TEST_NOT_PRODUCTION_DEPLOYMENT",
    originalRequestSha256: source.requestSha256, preparedAnalyzerSha256: source.sourceSha256,
    files: { "run-b1.cjs": hash(fs.readFileSync(outfile)) } };
  fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { mode: 0o600 });
  console.log(JSON.stringify(manifest, null, 2));
}
main().catch(() => { console.error("B1_BUNDLE_BUILD_FAILED"); process.exitCode = 1; });
