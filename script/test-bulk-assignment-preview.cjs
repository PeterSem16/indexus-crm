// Exercises the real HTTP handlers with an in-memory DB adapter: no DB writes.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { build } = require("esbuild");
const { getTableName } = require("drizzle-orm");

(async () => {
  const result = await build({
    stdin: {
      contents: fs.readFileSync("server/representative-routes.ts", "utf8") + "\nexport { db as testDb };",
      resolveDir: process.cwd() + "/server", loader: "ts",
    },
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external",
    alias: { "@shared": process.cwd() + "/shared" },
    plugins: [{
      name: "no-real-database",
      setup(build) {
        build.onResolve({ filter: /^\.\/db$/ }, () => ({ path: "db", namespace: "fake" }));
        build.onLoad({ filter: /.*/, namespace: "fake" }, () => ({
          contents: "export const db = {}; export const pool = {};", loader: "js",
        }));
      },
    }],
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", result.outputFiles[0].text)(require, module, module.exports);
  const { registerRepresentativeRoutes, testDb } = module.exports;
  const routes = new Map();
  const app = new Proxy({}, { get: (_, method) => (path, ...handlers) => {
    routes.set(`${method} ${path}`, handlers.at(-1));
  } });
  registerRepresentativeRoutes(app);

  for (const entity of ["clinics", "hospitals"]) {
    for (const mode of ["bulk-assign-representative", "swap-representative"]) {
      const rows = Array.from({ length: 753 }, (_, i) => ({
        id: `entity-${String(i).padStart(4, "0")}`, name: "Test entity",
        countryCode: "SK", pzsCode: "PZS", isActive: true,
      })).reverse();
      let currentRows = [...rows, { id: "excluded-country", countryCode: "CZ", pzsCode: "PZS" }];
      if (entity === "clinics") currentRows.push({ id: "excluded-empty-pzs", countryCode: "SK", pzsCode: "" });
      const writes = [];
      testDb.select = () => ({
        from(table) {
          const name = getTableName(table);
          const data = name === entity ? currentRows
            : name.endsWith("_representative_assignments")
              ? currentRows.map(row => ({ entityId: row.id, userId: "source" }))
              : [];
          return { then: (resolve, reject) => Promise.resolve(data).then(resolve, reject), where: async () => data };
        },
      });
      testDb.update = table => ({ set: values => ({ where: async () => {
        writes.push({ table: getTableName(table), values });
      } }) });
      testDb.insert = table => ({ values: async values => {
        writes.push({ table: getTableName(table), values });
      } });
      const handler = routes.get(`post /api/${entity}/${mode}`);
      const criteria = {
        countryScope: ["SK"],
        filterRules: [
          { field: "country", op: "isAny", value: ["SK"] },
          ...(entity === "clinics" ? [{ field: "pzsCode", op: "isNotEmpty", conjunction: "and" }] : []),
        ],
      };
      const base = { userId: "target", fromUserId: "source", toUserId: "target", criteria };
      async function call(body) {
        let status = 200, payload;
        await handler({ body, session: { user: { id: "admin", role: "admin" } } }, {
          status(code) { status = code; return this; },
          json(value) { payload = JSON.parse(JSON.stringify(value)); return this; },
        });
        return { status, payload };
      }
      const preview = await call({ ...base, dryRun: true });
      assert.equal(preview.status, 200);
      assert.equal(preview.payload.affected, 753);
      const ids = rows.map(row => row.id).sort();
      assert.deepEqual(preview.payload.previewIds, ids);
      assert.equal(writes.length, 0);
      const confirmation = {
        ...base, dryRun: false, previewIds: preview.payload.previewIds,
        previewFingerprint: preview.payload.previewFingerprint, previewTargetUserId: "target",
      };
      assert.equal((await call({ ...confirmation, previewIds: [{ id: ids[0] }] })).status, 400);
      assert.equal((await call({ ...confirmation, previewIds: ids.slice(1) })).status, 409);
      assert.equal(writes.length, 0);
      const confirmed = await call(confirmation);
      assert.equal(confirmed.status, 200);
      assert.equal(confirmed.payload.affected ?? confirmed.payload.swapped, 753);
      const inserted = writes.find(write => Array.isArray(write.values)).values;
      assert.deepEqual(inserted.map(row => row.clinicId ?? row.hospitalId), ids);
      assert.ok(inserted.every(row => row.userId === "target"));
      writes.length = 0;
      currentRows = currentRows.filter(row => row.id !== ids[0]);
      assert.equal((await call(confirmation)).status, 409);
      assert.equal(writes.length, 0);
      console.log(`PASS ${entity}/${mode}: 753 IDs, preview/confirm, invalid and stale guards`);
    }
  }
})().catch(error => { console.error(error); process.exit(1); });