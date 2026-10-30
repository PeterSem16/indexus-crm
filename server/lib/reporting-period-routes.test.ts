import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import { parseReportingQuery, reportingBounds } from "../../shared/reporting-period";

const source = readFileSync("server/routes.ts", "utf8");
function handler(path: string, query: (sql: string, params?: any[]) => Promise<any>, fetcher = globalThis.fetch) {
  const start = source.indexOf(`app.get("${path}"`);
  assert.ok(start > 0, path);
  const end = source.indexOf("\n  app.", start + 1);
  const code = transformSync(source.slice(start, end), { loader: "ts", format: "cjs" }).code;
  let route: any;
  new Function("app", "requireAuth", "pool", "parseReportingQuery", "fetch", code)(
    { get: (_path: string, _auth: any, fn: any) => { route = fn; } },
    () => {}, { query }, parseReportingQuery, fetcher,
  );
  return route;
}
async function invoke(route: any, query: Record<string, any>) {
  const response = {
    statusCode: 200, body: undefined as any,
    status(code: number) { this.statusCode = code; return this; },
    json(body: any) { this.body = body; return this; },
    setHeader() {},
    send(body: any) { this.body = body; return this; },
  };
  await route({ params: { id: "mission" }, query, headers: { cookie: "test-session" } }, response);
  return response;
}
test("Status List rejects invalid periods before touching the database", async () => {
  let queries = 0;
  const route = handler("/api/campaigns/:id/status-list-analytics", async () => { queries++; return { rows: [] }; });
  for (const query of [{ from: "invalid" }, { from: "2026-10-30", to: "2026-10-01" }]) {
    assert.equal((await invoke(route, query)).statusCode, 400);
  }
  assert.equal(queries, 0);
});
test("Status List confirmations, calls and Back Office evidence receive identical inclusive timezone bounds", async () => {
  const calls: Array<{ sql: string; params: any[] }> = [];
  const route = handler("/api/campaigns/:id/status-list-analytics", async (sql, params = []) => {
    calls.push({ sql, params });
    if (/FROM campaign_status_list_items/.test(sql)) return { rows: [{ id: "item", label: "Step", sort_order: 1 }] };
    if (/FROM campaign_contacts WHERE/.test(sql)) return { rows: [{ id: "contact", contact_type: "clinic" }] };
    return { rows: [] };
  });
  const result = await invoke(route, { from: "2026-10-25", to: "2026-10-25" });
  assert.equal(result.statusCode, 200);
  const bounds = reportingBounds({ from: "2026-10-25", to: "2026-10-25" });
  for (const table of ["campaign_contact_status_list_state", "campaign_contact_history", "task_back_office_confirmations"]) {
    const call = calls.find(call => call.sql.includes(`FROM ${table}`));
    assert.ok(call, table);
    assert.deepEqual(call.params.slice(1), [bounds.fromISO, bounds.toISO], table);
    assert.match(call.sql, /\$2::timestamptz IS NULL/);
    assert.match(call.sql, /<= \$3::timestamptz/);
  }
});
test("Status List CSV forwards the displayed period rather than silently exporting all history", async () => {
  let requested = "";
  const route = handler("/api/campaigns/:id/status-list-analytics/export", async () => ({ rows: [{ name: "Mission" }] }),
    (async (url: any) => {
      requested = String(url);
      return new Response(JSON.stringify({ items: [], contacts: [], agents: [], totalContacts: 0 }), { headers: { "Content-Type": "application/json" } });
    }) as typeof fetch);
  const result = await invoke(route, { from: "2026-09-01", to: "2026-09-30" });
  assert.equal(result.statusCode, 200);
  const params = new URL(requested).searchParams;
  const bounds = reportingBounds({ from: "2026-09-01", to: "2026-09-30" });
  assert.equal(params.get("from"), bounds.fromISO);
  assert.equal(params.get("to"), bounds.toISO);
});
