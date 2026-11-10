import assert from "node:assert/strict";
import express from "express";
import { pool } from "./db";
import { registerRepresentativeRoutes } from "./representative-routes";

async function main() {
  let user: any, connections = 0;
  const queries: string[] = [], originalConnect = pool.connect;
  (pool as any).connect = async () => {
    connections++;
    return { query: async (sql: string) => { queries.push(sql); return { rows: [] }; }, release() {} };
  };
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => { req.session = { user }; next(); });
  registerRepresentativeRoutes(app);
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise<void>(resolve => server.once("listening", resolve));
    const base = `http://127.0.0.1:${(server.address() as any).port}/api/representatives/distribution/suggestions`;
    const post = (body: any) => fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const body = { entity: "clinic", mode: "official", countryCode: "SK", criteria: { countryScope: ["SK"] } };
    assert.equal((await post(body)).status, 401); assert.equal(connections, 0);
    user = { id: "fixture", role: "user", assignedCountries: ["SK"] };
    assert.equal((await post(body)).status, 403); assert.equal(connections, 0);
    user = { id: "fixture", role: "manager", assignedCountries: ["SK"] };
    const forbidden = await post({ ...body, countryCode: "CZ", criteria: { countryScope: ["SK", "CZ"] } });
    assert.equal(forbidden.status, 403); assert.equal((await forbidden.json()).code, "scope");
    assert.equal((await post({ ...body, entity: "person" })).status, 400);
    assert.equal((await post({ ...body, mode: "balanced", territories: 100 })).status, 400);
    assert.equal((await post({ ...body, criteria: { unsupported: true } })).status, 400);
    user = { id: "fixture", role: "admin" };
    assert.equal((await post({ ...body, countryCode: "CH", criteria: {} })).status, 400);
    assert(queries.every(sql => sql === "BEGIN" || sql === "ROLLBACK"), "Forbidden/invalid suggestions must never read institution data or call AI");
    console.log("PASS: real route authentication, manager role, forged country scope, Persons exclusion and input guards before database reads/AI");
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    (pool as any).connect = originalConnect; await pool.end();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
