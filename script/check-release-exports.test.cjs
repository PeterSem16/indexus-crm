const assert = require("node:assert/strict");
const { checkExports, compareBaseline } = require("./check-release-exports.cjs");
const fixture = sources => checkExports({ sources: Object.entries(sources).map(([file, content]) => ({ file, content })) });
const result = fixture({
  "server/lib/exports.ts": "export function present() {}; export interface TypeOnly {}; export default present;",
  "server/lib/forwarded.ts": 'export { present as renamed } from "./exports";',
  "server/lib/no-default.ts": "export const named = 1;",
  "server/main.ts": `
    import type { NotARuntimeExport } from "./lib/no-default";
    import { type AlsoNotRuntime, named } from "./lib/no-default";
    import { renamed } from "./lib/forwarded";
    const { present: alias, missingDestructure } = await import("./lib/exports");
    const ns = await import("./lib/exports");
    ns.present(); ns.missingNamespace(); ns["missingElement"]();
    (await import("./lib/exports")).missingDirect();
    import("./lib/exports").then(({ missingCallback }) => missingCallback());
    import("./lib/exports").then(mod => mod.missingThenNamespace());
    const lazy = x => x;
    lazy(() => import("./lib/no-default"));
    import("./lib/exports").then(mod => mod.TypeOnly);
    function shadow() { const ns = { notAnExport: () => 1 }; ns.notAnExport(); }
  `,
});
assert.equal(result.missing.length, 8, result.missing.join("\n"));
for (const name of ["missingDestructure", "missingNamespace", "missingElement", "missingDirect",
  "missingCallback", "missingThenNamespace", "default", "TypeOnly"]) {
  assert.ok(result.missing.some(line => line.includes(`"${name}"`)), name);
}
assert.ok(!result.missing.some(line => line.includes("notAnExport") || line.includes("NotARuntimeExport") || line.includes("AlsoNotRuntime")));
const valid = fixture({
  "server/lib/exports.ts": "export function available() {};",
  "server/lib/forwarded.ts": 'export { available as renamed } from "./exports";',
  "server/main.ts": `
    import * as api from "./lib/exports";
    import { renamed } from "./lib/forwarded";
    const { available: handler } = await import("./lib/exports");
    api.available(); handler(); renamed();
  `,
});
assert.deepEqual(valid.missing, []);
const old = 'server/main.ts:10 -> server/module.ts has no runtime export "oldMissing"';
const moved = old.replace(":10 ->", ":30 ->");
const newMissing = old.replace('"oldMissing"', '"newMissing"');
assert.deepEqual(compareBaseline([moved, newMissing], [old]), { existing: [moved], regressions: [newMissing] });
assert.equal(compareBaseline([moved, moved], [old]).regressions.length, 1);
// The failed production candidate must remain a reproducible regression:
// its module exists, but its newly requested hospital registrar does not.
const { spawnSync } = require("node:child_process");
const snapshot = spawnSync(process.execPath, [
  "--max-old-space-size=2048", require.resolve("./check-release-exports.cjs"),
  "cdf0dc2cbaa2c88b93a7c059f2988f875033e595",
  "--baseline", "0b1bc1c12ea690cd3db2fb01369a7f7dbe370a5e",
], { encoding: "utf8", maxBuffer: 1024 * 1024 });
assert.equal(snapshot.status, 1, snapshot.stdout + snapshot.stderr);
assert.match(snapshot.stderr, /MISSING_EXPORT .*registerHospitalAgreementRoutes/);
assert.match(snapshot.stdout, /1 new missing exports; 2 pre-existing export defects/);
console.log("Release export checks passed: dynamic bindings, namespaces and shadowing, then/default contracts, type-only imports, re-exports, and explicit baseline regression comparison.");
