#!/usr/bin/env node
// Exact, application-only release. Reuse the hash-pinned safe promotion engine.
const cp = require("node:child_process");
const crypto = require("node:crypto");
const { Module } = require("node:module");
const APP = "/var/www/indexus-crm";
const TARGET = "f6018d294c62b0fcc2a61b4340efbca4d9f6859e";
const SOURCE = "script/operator/promote-mission-funnel-status-policy.cjs";
const SOURCE_HASH = "2e2071fe176f5b569336ce8a32b118515f7519e0eca65ab2d6476dc6b86d6951";
const BASES = {
  "70668b15ae2ddace29946c6bb42d6bd2a80a3029": {
    patch: "87f54c9aa441e8c8bdb836ec760816a08c9e1c47598e5382d6509355ba67c005",
    paths: "bb8dfca329be4e3fe0cda138ac6951056a95cda0d6ee3f8637ceef01f522b7a5",
  },
  "8bcf6241f1a4618ebc4ddc2061b51bba0504128a": {
    patch: "9752fcdf022128c981ec3bb6a3c4f20a5b230540ccd0bd353c51d3d8cf96fbb8",
    paths: "b2a2ef44508807e49329ae52c96a6203047a06d4e012222b2924989d09f61d46",
  },
};

function loadEngine(git) {
  let source = git(["show", `${TARGET}:${SOURCE}`], true);
  if (crypto.createHash("sha256").update(source).digest("hex") !== SOURCE_HASH)
    throw Error("Reviewed promotion engine differs");
  const head = git(["rev-parse", "HEAD"]);
  const pin = BASES[head];
  if (!pin) throw Error("Unexpected production HEAD; stop");
  const bindings = {
    BASE: ["70668b15ae2ddace29946c6bb42d6bd2a80a3029", head],
    PARENT: ["1765ca1cd26ca8200f163e9985eb0e2daa45eb15", "24e4f216bbbb9874f8b1d5556cc2968ca75a8a98"],
    TARGET: ["714e05cf336e29759d57f7c91aff0f2c93a11602", TARGET],
    TREE: ["ec0ea48956c710f74a08e53b0a44aba8561b22af", "79d3b405115219c201e459f2707411cc8c7521b7"],
    PATCH_HASH: ["38dbf6250329621858dd4a7b7f22bf83a38cd6560449b434a5f253dd0a2f76f5", pin.patch],
    PATHS_HASH: ["6d19eb5d07c8bc7b48b496c286ff707afed4a44dc5ecc4187f8a743152c5e608", pin.paths],
  };
  for (const [name, [before, after]] of Object.entries(bindings)) {
    const anchor = `const ${name} = "${before}";`;
    if (source.split(anchor).length !== 2) throw Error("Reviewed release binding differs");
    source = source.replace(anchor, `const ${name} = "${after}";`);
  }
  const anchor = "const TESTS = [";
  if (source.split(anchor).length !== 2) throw Error("Reviewed test binding differs");
  source = source.replace(anchor, `${anchor}
  "client/src/i18n/agreement-workspace-translations.test.ts",
  "client/src/components/record-activity-display.test.ts",
  "server/lib/record-activity-state.test.ts",
  "shared/status-list-history-display.test.ts",
  "server/lib/status-list-history-display.test.ts",`);
  const loaded = new Module(APP + "/" + SOURCE, module);
  loaded.filename = APP + "/" + SOURCE;
  loaded.paths = Module._nodeModulePaths(APP + "/script/operator");
  loaded._compile(source, loaded.filename);
  return loaded.exports;
}
function main(args) {
  if (args.length !== 2 || args[0] !== "--apply" || args[1] !== TARGET)
    throw Error(`Use --apply ${TARGET} as seman on CORPCRM01`);
  const git = (args, raw = false) => {
    const output = cp.execFileSync("git", ["-C", APP, ...args], {
      encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"],
    });
    return raw ? output : output.trimEnd();
  };
  const engine = loadEngine(git);
  const body = engine.render(git, engine.validate(git, TARGET));
  if (cp.spawnSync("bash", ["-n"], { input: body, encoding: "utf8" }).status !== 0)
    throw Error("Invalid rendered promotion script");
  console.log("RECORD_ACTIVITY_TARGET=" + TARGET);
  const run = cp.spawnSync("bash", ["-s", "--", "--apply"], {
    input: body, stdio: ["pipe", "inherit", "inherit"],
  });
  if (run.error) throw Error("Cannot start promotion");
  process.exitCode = run.status ?? 1;
}
module.exports = { TARGET, SOURCE, SOURCE_HASH, loadEngine };
if (require.main === module || !module.parent) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
