"use strict";
// Build only a standalone operator tool; never build/restart the application.
const fs = require("node:fs"), path = require("node:path");
async function build(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o077))
    throw Error("PRIVATE_DIRECTORY_REQUIRED");
  const { extract, RECIPES } = require("../ai-gateway-c1/replay.cjs");
  const source = extract(RECIPES["email.sentiment"]);
  const outfile = path.join(directory, "run-sentiment.cjs");
  if (fs.existsSync(outfile)) throw Error("OUTPUT_ALREADY_EXISTS");
  await require("esbuild").build({
    entryPoints: ["script/ai-email-sentiment/live-cli.ts"], outfile,
    bundle: true, platform: "node", format: "cjs", target: "node20", packages: "external",
    define: { SENTIMENT_ANALYZER_SOURCE: JSON.stringify(source), SENTIMENT_OPERATOR_ENTRY: "true" },
    banner: { js: 'module.paths.unshift("/var/www/indexus-crm/node_modules");' },
  });
  fs.chmodSync(outfile, 0o600);
  return outfile;
}
module.exports = { build };
if (require.main === module) build(process.argv[2]).then(() => console.log("SENTIMENT_OPERATOR_TOOL_BUILT"))
  .catch(() => { console.error("SENTIMENT_BUILD_FAILED"); process.exitCode = 1; });
