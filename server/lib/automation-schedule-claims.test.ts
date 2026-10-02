import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { workflowRules } from "@shared/schema";

test("schedule claims survive restarts and are atomic across workers", {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const [{ db, pool }, { claimScheduledRuleDue }] = await Promise.all([
    import("../db"),
    import("./automation-engine"),
  ]);
  const id = randomUUID();
  const intervalMs = 5 * 60 * 1000;
  try {
    const [rule] = await db
      .insert(workflowRules)
      .values({
        id,
        name: "schedule claim test",
        module: "customer",
        trigger: { type: "schedule", interval: "every_5_min" },
        actions: [],
      })
      .returning();

    // A fresh enabled rule is deferred by a full interval, including after a
    // process restart (which invokes this durable claim function again).
    assert.equal(await claimScheduledRuleDue(rule, intervalMs), false);
    assert.equal(await claimScheduledRuleDue(rule, intervalMs), false);
    const due = await pool.query(
      "SELECT schedule_next_due_at > clock_timestamp() AS is_future FROM workflow_rules WHERE id = $1",
      [id],
    );
    assert.equal(due.rows[0]?.is_future, true);

    await pool.query(
      "UPDATE workflow_rules SET schedule_next_due_at = clock_timestamp() - interval '1 second' WHERE id = $1",
      [id],
    );
    const concurrentClaims = await Promise.all(
      Array.from({ length: 8 }, () => claimScheduledRuleDue(rule, intervalMs)),
    );
    assert.equal(concurrentClaims.filter(Boolean).length, 1);
    assert.equal(await claimScheduledRuleDue(rule, intervalMs), false);

    // Interval edits and re-enables establish a new full interval instead of
    // treating the previous interval's due time as immediately runnable.
    await pool.query(
      "UPDATE workflow_rules SET trigger = '{\"type\":\"schedule\",\"interval\":\"daily\"}'::jsonb WHERE id = $1",
      [id],
    );
    const editedRule = { ...rule, trigger: { type: "schedule", interval: "daily" } };
    assert.equal(await claimScheduledRuleDue(editedRule, 24 * 60 * 60 * 1000), false);
    await pool.query(
      "UPDATE workflow_rules SET enabled = false, schedule_next_due_at = NULL WHERE id = $1",
      [id],
    );
    await pool.query("UPDATE workflow_rules SET enabled = true WHERE id = $1", [id]);
    assert.equal(await claimScheduledRuleDue(editedRule, 24 * 60 * 60 * 1000), false);

    // Unsupported intervals are deliberately inert.
    assert.equal(await claimScheduledRuleDue(editedRule, 0), false);
  } finally {
    await pool.query("DELETE FROM workflow_rules WHERE id = $1", [id]);
  }
});