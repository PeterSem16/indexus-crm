"use strict";
// No application build/restart; embed the reviewed candidate analyzer only.
const fs = require("node:fs"), path = require("node:path");
async function build(directory) {
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o077))
    throw Error("PRIVATE_DIRECTORY_REQUIRED");
  const outfile = path.join(directory, "run-once.cjs");
  if (fs.existsSync(outfile) || fs.existsSync(path.join(directory, "results.jsonl")))
    throw Error("ONE_SHOT_ALREADY_PREPARED_OR_STARTED");
  const { extract, RECIPES } = require("../ai-gateway-c1/replay.cjs");
  await require("esbuild").build({
    entryPoints: ["script/ai-email-sentiment/one-shot.ts"], outfile,
    bundle: true, platform: "node", format: "cjs", target: "node20", packages: "external",
    define: { SENTIMENT_ANALYZER_SOURCE: JSON.stringify(extract(RECIPES["email.sentiment"])),
      SENTIMENT_ONE_SHOT_ENTRY: "true" },
    banner: { js: 'module.paths.unshift("/var/www/indexus-crm/node_modules");' },
  });
  fs.chmodSync(outfile, 0o600);
  return outfile;
}
module.exports = { build };
if (require.main === module) build(process.argv[2]).then(() => console.log("SYNTHETIC_ONE_SHOT_PREPARED"))
  .catch(() => { console.log("BLOCKED: ONE_SHOT_PREPARATION_FAILED"); process.exitCode = 2; });
