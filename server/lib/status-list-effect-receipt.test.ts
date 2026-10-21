import assert from "node:assert/strict";
import { test } from "node:test";
import { statusListEffectOnce } from "./status-list-effect-receipt";
const key = { contactId: "contact", automationId: "action", eventKey: "confirmation:one", actorId: "agent" };
function database() {
  let row: any;
  let failUpdate = false;
  const query = async (sql: string, args: any[] = []) => {
    if (sql.startsWith("INSERT")) {
      if (row) return { rows: [] };
      row = { actor_id: args[3], status: "running", result: null };
      return { rows: [{ event_key: args[2] }] };
    }
    if (sql.startsWith("SELECT")) return { rows: row ? [{ ...row }] : [] };
    if (failUpdate) throw new Error("connection_lost");
    row.status = args[4]; row.result = JSON.parse(args[5]); return { rows: [] };
  };
  return { query, loseReceipt: () => { failUpdate = true; }, read: () => row };
}
test("concurrent duplicate never sends twice and does not claim pending delivery succeeded", async () => {
  const db = database();
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  let sends = 0;
  const first = statusListEffectOnce(db.query, key, async () => { sends++; await wait; return { ok: true }; });
  await Promise.resolve(); await Promise.resolve();
  const second = await statusListEffectOnce(db.query, key, async () => { sends++; return { ok: true }; });
  assert.equal(second.ok, false); assert.equal(second.status, "uncertain");
  release(); assert.equal((await first).ok, true);
  assert.equal((await statusListEffectOnce(db.query, key, async () => { sends++; })).ok, true);
  assert.equal(sends, 1);
});
test("failed action remains failed and never silently resends", async () => {
  const db = database(); let sends = 0;
  const execute = async () => { sends++; throw new Error("private recipient and provider response"); };
  assert.equal((await statusListEffectOnce(db.query, key, execute)).ok, false);
  assert.equal((await statusListEffectOnce(db.query, key, execute)).ok, false);
  assert.equal(sends, 1);
  assert.ok(!JSON.stringify(db.read()).includes("private"));
});
test("lost receipt after successful external delivery is uncertain, not resent", async () => {
  const db = database(); let sends = 0;
  db.loseReceipt();
  await assert.rejects(statusListEffectOnce(db.query, key, async () => { sends++; return { ok: true }; }));
  const retry = await statusListEffectOnce(db.query, key, async () => { sends++; });
  assert.equal(sends, 1); assert.equal(retry.ok, false); assert.equal(retry.status, "uncertain");
});
test("a skipped condition is evaluated once and actor ownership cannot change", async () => {
  const db = database(); let evaluations = 0;
  const execute = async () => { evaluations++; return { ok: true, skipped: true }; };
  assert.equal((await statusListEffectOnce(db.query, key, execute)).skipped, true);
  assert.equal((await statusListEffectOnce(db.query, key, execute)).skipped, true);
  await assert.rejects(statusListEffectOnce(db.query, { ...key, actorId: "other" }, execute), /actor_conflict/);
  assert.equal(evaluations, 1);
});
