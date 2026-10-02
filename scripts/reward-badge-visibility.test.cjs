const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");

test("approved badge follows the live clinic link and the latest Action payment", async () => {
  const source = fs.readFileSync(path.join(__dirname, "../server/routes.ts"), "utf8");
  const sql = source.match(/const activeRewardBadgeClinicLink = `([\s\S]*?)`;/)?.[1];
  assert.ok(sql?.includes("badge_assignment.is_active"), "Clinic-link filter is missing");
  assert.ok(sql?.includes("paid_badge_action.reward_paid"), "Latest-Action filter is missing");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TEMP TABLE collaborators (id text, clinic_id text, clinic_ids text[]);
      CREATE TEMP TABLE contact_assignments (
        person_id text, entity_type text, entity_id text, is_active boolean
      );
      CREATE TEMP TABLE collaborator_activities (
        id text, collaborator_id text, due_date timestamp, created_at timestamp,
        reward_paid boolean, reward_paid_at timestamp
      );
      CREATE TEMP TABLE unpaid_reward_badge_clinic_pairs (
        collaborator_id text, clinic_id text
      );
      INSERT INTO collaborators VALUES ('person-1', 'clinic-1', NULL);
      INSERT INTO unpaid_reward_badge_clinic_pairs VALUES ('person-1', 'clinic-1');
    `);
    const visible = async () => {
      const result = await client.query(
        `SELECT COUNT(*)::int AS count FROM unpaid_reward_badge_clinic_pairs badge
          WHERE badge.clinic_id = 'clinic-1' AND ${sql}`
      );
      return result.rows[0].count;
    };
    assert.equal(await visible(), 1, "no Action must still show the approved badge");
    await client.query(`
      INSERT INTO collaborator_activities
      VALUES ('paid', 'person-1', '2026-10-01', '2026-09-29', true, '2026-09-29');
    `);
    assert.equal(await visible(), 0, "paid latest Action must hide the badge");
    await client.query(`
      INSERT INTO collaborator_activities
      VALUES ('unpaid', 'person-1', '2026-10-02', '2026-09-30', false, NULL);
    `);
    assert.equal(await visible(), 1, "new unpaid latest Action makes the badge visible again");
    await client.query("UPDATE collaborators SET clinic_id = NULL WHERE id = 'person-1'");
    assert.equal(await visible(), 0, "lost clinic link must hide the badge");
    await client.query(`
      INSERT INTO contact_assignments VALUES ('person-1', 'clinic', 'clinic-1', true);
    `);
    assert.equal(await visible(), 1, "active assignment is also a valid clinic link");
    await client.query("UPDATE contact_assignments SET is_active = false");
    assert.equal(await visible(), 0, "inactive assignment is not a valid link");
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    await client.end();
  }
});