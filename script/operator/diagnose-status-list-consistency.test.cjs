const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { reportSnapshot, capture } = require("./diagnose-status-list-consistency.cjs");
function fixture() {
  return {
    mission: { id: "mission", name: "Medical Partner Cooperation" },
    contacts: [{ id: "enrollment", clinic_id: "clinic", campaign_id: "mission", name: "ALLATURA" }],
    items: [{ id: "parent", campaign_id: "mission", question_selection_mode: "single" },
      { id: "a", campaign_id: "mission", parent_id: "parent", step_id: "MPN-05b" },
      { id: "b", campaign_id: "mission", parent_id: "parent", step_id: "MPN-05c" }],
    states: [],
    history: [{ id: "event", campaign_contact_id: "enrollment", item_id: "a",
      action: "status_list_confirmation", confirmed: true, sequence: 1 }],
  };
}
test("missing current state is reported for review, never automatically restored", () => {
  const data = fixture(), before = JSON.stringify(data);
  const r = reportSnapshot(data);
  assert.equal(r.counts.unresolvedCandidates, 1);
  assert.equal(r.target.states.length, 0);
  assert.equal(r.candidates[0].classification, "requires-audit-review");
  assert.equal(JSON.stringify(data), before);
});
test("later removal is not treated as a lost confirmation", () => {
  const f = fixture();
  f.history.push({ ...f.history[0], confirmed: false, sequence: 2 });
  assert.equal(reportSnapshot(f).candidates.length, 0);
});
test("single-select replacement is distinguished from unexplained disappearance", () => {
  const f = fixture();
  f.history.push({ ...f.history[0], item_id: "b", sequence: 2 });
  f.states.push({ campaign_contact_id: "enrollment", status_list_item_id: "b" });
  const r = reportSnapshot(f);
  assert.equal(r.counts.unresolvedCandidates, 0);
  assert.equal(r.candidates[0].classification, "later-single-select-choice");
});
test("duplicate enrollment evidence is never merged into another enrollment", () => {
  const f = fixture();
  f.contacts.push({ ...f.contacts[0], id: "other" });
  f.states.push({ campaign_contact_id: "other", status_list_item_id: "a" });
  const r = reportSnapshot(f);
  assert.equal(r.counts.unresolvedCandidates, 1);
  assert.deepEqual(r.duplicateEnrollments, [["enrollment", "other"]]);
});
test("invalid definitions and conflicting radio states remain visible", () => {
  const f = fixture();
  f.states = ["a", "b", "deleted"].map(id => ({ campaign_contact_id: "enrollment", status_list_item_id: id }));
  const r = reportSnapshot(f);
  assert.equal(r.definitionIssues.length, 1);
  assert.equal(r.multipleSingleSelectStates.length, 1);
});
test("notes, recipient values and real user identities are excluded", () => {
  const f = fixture();
  f.history[0].user_id = "private-user-id";
  f.history[0].workflow = [{ type: "set_answer", value: "private-text", target: { kind: "item", id: "b" },
    arbitrary: "private-text", cleared: [{ kind: "item", id: "a", secret: "private-text" }] }];
  const out = JSON.stringify(reportSnapshot(f));
  assert.ok(!out.includes("private-user-id"));
  assert.ok(!out.includes("private-text"));
});
test("capture holds one read-only snapshot and rolls back on query failure", async () => {
  const seen = [];
  const fake = { async query(sql) {
    seen.push(sql);
    if (sql.startsWith("SELECT id,name")) throw Error("fixture stop");
    return { rows: [] };
  } };
  await assert.rejects(capture(fake), /fixture stop/);
  assert.match(seen[0], /REPEATABLE READ READ ONLY/);
  assert.equal(seen.at(-1), "ROLLBACK");
  assert.ok(seen.every(sql => /^(BEGIN|SET LOCAL|SELECT|ROLLBACK)/.test(sql)));
  const source = fs.readFileSync("script/operator/diagnose-status-list-consistency.cjs", "utf8");
  assert.doesNotMatch(source, /client\.query\(["'`](INSERT|UPDATE|DELETE|ALTER|CREATE|TRUNCATE)/);
});
test("successful capture also closes its snapshot without committing or starting application services", async () => {
  const data = fixture(), queries = [];
  const client = { async query(sql) {
    queries.push(sql);
    if (sql.startsWith("SELECT id,name")) return { rows: [data.mission] };
    if (sql.startsWith("SELECT cc.id")) return { rows: data.contacts };
    if (sql.startsWith("SELECT campaign_contact_id")) return { rows: data.states };
    if (sql.startsWith("SELECT id,campaign_contact_id")) return { rows: data.history };
    if (sql.startsWith("SELECT id,campaign_id")) return { rows: data.items };
    return { rows: [] };
  } };
  assert.equal((await capture(client)).target.matched, true);
  assert.equal(queries.at(-1), "ROLLBACK");
  assert.ok(queries.every(sql => /^(BEGIN|SET LOCAL|SELECT|ROLLBACK)/.test(sql)));
});
