const test = require("node:test"), assert = require("node:assert/strict");
const { capture } = require("./diagnose-clinic-callback.cjs");
function fixture(failHistory = false) {
  const calls = [], output = [];
  const client = { async query(sql, params) {
    calls.push({ sql, params });
    assert.match(sql, /^(SELECT|BEGIN|SET LOCAL|SAVEPOINT|ROLLBACK|RELEASE)/);
    if (sql.includes("FROM clinics")) return { rows: [{ id: "clinic-a", name: "Clinic fixture" }] };
    if (sql.includes("FROM campaign_contacts c")) return { rows: [{ id: "enrollment-a", campaign_id: "mission-a" }] };
    if (sql.includes("to_regclass")) return { rows: [{ exists: true }] };
    if (sql.includes("FROM information_schema.columns"))
      return { rows: [{ column_name: "customer_id" }, { column_name: "campaign_contact_id" }] };
    if (failHistory && sql.includes("FROM campaign_contact_history"))
      throw Object.assign(Error("operator does not exist: uuid = character varying\nPRIVATE_PARAMETER"), { code: "42883" });
    return { rows: [] };
  } };
  return { client, calls, output, emit: text => output.push(JSON.parse(text)) };
}
test("uses only bounded read-only capture with bound search and enrollment identities", async () => {
  const f = fixture(), search = ["Clinic%_'\\ OR 1=1; --", "Surname", "Givenname"];
  await capture(f.client, search, f.emit);
  assert.equal(f.calls[0].sql, "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  assert.equal(f.calls.at(-1).sql, "ROLLBACK");
  assert(!f.calls.some(c => /\b(COMMIT|INSERT|DELETE|UPDATE|TRUNCATE|ALTER|CREATE)\b/.test(c.sql)));
  assert(!f.calls.some(c => c.sql.includes(search[0])));
  const clinic = f.calls.find(c => c.sql.includes("FROM clinics"));
  assert(clinic.params[0].includes("\\%\\_"));
  for (const c of f.calls.filter(c => c.sql.includes("FROM campaign_contact_history") || c.sql.includes("FROM campaign_contact_status_list_state")))
    assert.deepEqual(c.params, [["enrollment-a"]]);
  const source = require("node:fs").readFileSync(require.resolve("./diagnose-clinic-callback.cjs"), "utf8");
  assert(!source.includes("callback_note"));
  assert(!source.includes("item_note"));
  assert(!source.includes("password"));
  assert(f.output.some(r => r.check === "mission_callback_service_events"));
  assert(f.calls.some(c => c.sql.includes("state AS status") && c.sql.includes("mission_callback_service_events")));
  const counts = f.calls.find(c => c.sql.includes("FROM call_logs"));
  assert(!/\bcontact_id\b/.test(counts.sql));
  assert.deepEqual(counts.params, [["clinic-a"], ["enrollment-a"]]);
});
test("schema failure is distinguished from app failure and subsequent probes continue", async () => {
  const f = fixture(true);
  await capture(f.client, ["Clinic", "Surname", "Givenname"], f.emit);
  const history = f.output.find(r => r.check === "history");
  assert.equal(history.sqlstate, "42883");
  assert.equal(history.typeHint, "operator does not exist: uuid = character varying");
  assert(!JSON.stringify(f.output).includes("PRIVATE_PARAMETER"));
  assert(f.calls.some(c => c.sql === "ROLLBACK TO SAVEPOINT probe"));
  assert(f.output.some(r => r.check === "callback_definitions"));
  assert.equal(f.calls.at(-1).sql, "ROLLBACK");
});
test("rejects a broad or incomplete search before connecting the transaction", async () => {
  const f = fixture();
  await assert.rejects(() => capture(f.client, ["Clinic", "", "Givenname"], f.emit), /SEARCH_ARGUMENTS_INVALID/);
  assert.equal(f.calls.length, 0);
});
