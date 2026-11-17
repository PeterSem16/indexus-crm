"use strict";
// Builds a private verification bundle, never the live CRM distribution.
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const { analyzeSource } = require("./source.cjs");
const files = [
  "server/lib/ai/internal-adapter.ts", "server/lib/ai/email-monitoring-profile.ts",
  "server/lib/ai/email-monitoring-contract.ts", "server/lib/ai/router.ts",
];
async function main() {
  const out = process.argv[2];
  if (process.argv.length !== 3 || !path.isAbsolute(out) || fs.existsSync(out))
    throw Error("B112_NEW_ABSOLUTE_OUTPUT_REQUIRED");
  fs.mkdirSync(out, { recursive: true, mode: 0o700 });
  const source = analyzeSource(path.resolve("server/lib/email-monitoring-service.ts"));
  const hashes = Object.fromEntries(files.map(file =>
    [file, crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")]));
  const outfile = path.join(out, "run-b112.cjs");
  await require("esbuild").build({
    entryPoints: ["script/ai-email-monitoring-b1/b112-run.ts"], outfile, bundle: true,
    platform: "node", target: "node20", format: "cjs", logLevel: "silent",
    external: ["pg", "openai", "dotenv", "zod", "typescript", "drizzle-orm", "drizzle-orm/*"],
    banner: { js: 'module.paths.unshift("/var/www/indexus-crm/node_modules");' },
    define: { B112_SOURCE: JSON.stringify(source), B112_FILES: JSON.stringify(hashes) },
  });
  fs.chmodSync(outfile, 0o600);
  console.log("B112_BUNDLE_BUILT");
}
if (require.main === module) main().catch(() => { console.error("B112_BUILD_FAILED"); process.exitCode = 1; });
module.exports = { files };
