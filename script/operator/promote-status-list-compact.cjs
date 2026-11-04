#!/usr/bin/env node
// Exact application release. No schema, answer, callback or approval writes.
const cp = require("node:child_process");
const crypto = require("node:crypto");
const { Module } = require("node:module");
const APP = "/var/www/indexus-crm";
const TARGET = "1f24432815b6c6f6100ea48941750b0fa8636483";
const PARENT = "23fb44c77eee2af4df5ef05f59bb1466b9215a1d";
const TREE = "06015a285b6739650f75f7209655b9f4edf0700c";
const SOURCE = "script/operator/promote-mission-funnel-status-policy.cjs";
const SOURCE_HASH = "2e2071fe176f5b569336ce8a32b118515f7519e0eca65ab2d6476dc6b86d6951";
const BASES = {
  "714e05cf336e29759d57f7c91aff0f2c93a11602": {
    patch: "5c2cecebb0ce0301b2acf02a15e391362a711f1b96e2f5eb73eb40c57d54b3b0",
    paths: "856773473823de29f137c3596f2377b0848833cad9c69c21683c36a3a27e1489",
  },
  "f6018d294c62b0fcc2a61b4340efbca4d9f6859e": {
    patch: "d4fda3d5084dd2b2384bd7a2c98fb8cc7c91b30f1b7c639a546ae37fdae6f2ac",
    paths: "65c2c9250a0bb93a24af4c76433e937d6cb3405e35851b04734ef4c202a00043",
  },
  "a3e3d1ee853b4ef618a6f3c6333ff61b090d4001": {
    patch: "471bcb69495bdfecf858b3a6b0123628620d621ead462d1d4e9b5e8aa19424ec",
    paths: "f96e40e0a3083c6da192ae00408dffba4164a30c430293d7a08d33c662e80a4c",
  },
  "58c0c8b1016b502a1e79dcff2f4c2b0b247c7799": {
    patch: "c3413fd21456f86d8acca64e563a1ff1c6e36038921fb1890bdd59523cf0e30b",
    paths: "db92444556071a836561e6cae9a454f5f694d05bdeca994c3cc74081a39b5149",
  },
  "23fb44c77eee2af4df5ef05f59bb1466b9215a1d": {
    patch: "dc38224b486663269f4a040fd262c3c05e8c20de7ed44b87f3dcaca33e65b276",
    paths: "9d972bad02f76973f9a870749c759e7493b04453d55bf52eccd9057275e6b6f0",
  },
};
function loadEngine(git) {
  let source = git(["show", `${TARGET}:${SOURCE}`], true);
  if (crypto.createHash("sha256").update(source).digest("hex") !== SOURCE_HASH)
    throw Error("Reviewed promotion engine differs");
  const head = git(["rev-parse", "HEAD"]);
  const pin = BASES[head];
  if (!pin) throw Error("Unexpected production HEAD; stop and return the output");
  const bindings = {
    BASE: ["70668b15ae2ddace29946c6bb42d6bd2a80a3029", head],
    PARENT: ["1765ca1cd26ca8200f163e9985eb0e2daa45eb15", PARENT],
    TARGET: ["714e05cf336e29759d57f7c91aff0f2c93a11602", TARGET],
    TREE: ["ec0ea48956c710f74a08e53b0a44aba8561b22af", TREE],
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
  "client/src/lib/status-list-phase-progress.test.ts",
  "client/src/components/status-list-agent-preview.test.tsx",
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
  console.log("STATUS_LIST_COMPACT_TARGET=" + TARGET);
  const run = cp.spawnSync("bash", ["-s", "--", "--apply"], {
    input: body, stdio: ["pipe", "inherit", "inherit"],
  });
  if (run.error) throw Error("Cannot start promotion");
  process.exitCode = run.status ?? 1;
}
module.exports = { TARGET, PARENT, TREE, SOURCE, SOURCE_HASH, BASES, loadEngine };
if (require.main === module || !module.parent) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(`STOP: ${error.message.split("\n")[0]}`); process.exitCode = 1; }
}
