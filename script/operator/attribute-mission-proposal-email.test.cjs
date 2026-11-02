const { test } = require("node:test");
const assert = require("node:assert/strict");
const { attributeProposalEmail } = require("./attribute-mission-proposal-email.cjs");
const input = { messageId: "11111111-1111-1111-1111-111111111111",
  missionId: "22222222-2222-2222-2222-222222222222", clinicId: "33333333-3333-3333-3333-333333333333",
  subject: "A reviewed proposal", sentAt: "2026-10-01T09:26:59.018121Z", apply: true };
function fixture({ found = true, prior = false, campaignId = null, fail = false } = {}) {
  const calls = [];
  return { calls, query: async (sql, params) => {
    calls.push({ sql, params });
    if (sql.startsWith("SELECT m.id")) return { rows: found ? [{ id: input.messageId, contact_id: "contact",
      campaign_id: campaignId, sent_at: input.sentAt }] : [] };
    if (sql.startsWith("SELECT id FROM campaign_contact_history")) return { rows: prior ? [{ id: "prior" }] : [] };
    if (fail && sql.startsWith("INSERT")) throw Error("audit failed");
    return { rows: [] };
  } };
}
test("reviewed repair binds only one sent email, records provenance and does not send or rewrite its time/body", async () => {
  const db = fixture(); assert.equal((await attributeProposalEmail(db, input)).status, "applied");
  assert.ok(db.calls.some(c => c.sql.startsWith("COMMIT")));
  const update = db.calls.find(c => c.sql.startsWith("UPDATE"));
  assert.equal(update.sql, "UPDATE communication_messages SET campaign_id=$2 WHERE id=$1");
  assert.deepEqual(update.params, [input.messageId, input.missionId]);
  const metadata = JSON.parse(db.calls.find(c => c.sql.startsWith("INSERT")).params[3]);
  assert.equal(metadata.originalSentAt, input.sentAt);
  assert.equal(metadata.purpose, "contract_proposal");
});
test("check-only and mismatch do not change data; failed audit rolls back message attribution", async () => {
  const check = fixture(); assert.equal((await attributeProposalEmail(check, { ...input, apply: false })).status, "ready");
  assert.ok(!check.calls.some(c => /^(INSERT|UPDATE)/.test(c.sql)));
  const mismatch = fixture({ found: false });
  await assert.rejects(attributeProposalEmail(mismatch, input), /differs/);
  assert.ok(!mismatch.calls.some(c => /^(INSERT|UPDATE)/.test(c.sql)));
  const fail = fixture({ fail: true });
  await assert.rejects(attributeProposalEmail(fail, input), /audit failed/);
  assert.equal(fail.calls.at(-1).sql, "ROLLBACK");
});
test("a repeated repair is idempotent and conflicting attributions fail closed", async () => {
  const db = fixture({ prior: true, campaignId: input.missionId });
  assert.equal((await attributeProposalEmail(db, input)).status, "already_applied");
  assert.ok(!db.calls.some(c => /^(INSERT|UPDATE)/.test(c.sql)));
  await assert.rejects(attributeProposalEmail(fixture({ prior: true }), input), /conflicts/);
});
