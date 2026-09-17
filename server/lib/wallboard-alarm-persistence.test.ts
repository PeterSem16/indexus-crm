import assert from "node:assert/strict";
import test from "node:test";
import { sql } from "drizzle-orm";
import {
  defaultWallboardAlarmSettings,
  type WallboardAlarmSettings,
} from "@shared/wallboard-alarms";
import { wallboardAlarmSettings } from "@shared/schema";

test("wallboard alarm persistence is owner/scope isolated and rejects malformed rows", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not configured");
    return;
  }
  const [{ db, pool }, { getWallboardAlarmSettings, saveWallboardAlarmSettings }] = await Promise.all([
    import("../db"),
    import("./wallboard"),
  ]);
  try {
    const rollback = new Error("wallboard alarm fixture rollback");
    const rule = {
      id: "rule-a",
      name: "Calls",
      enabled: true,
      type: "no_calls" as const,
      threshold: 90,
      direction: "both" as const,
      callEvent: "started" as const,
      delaySeconds: 5,
      mode: "visual" as const,
      repeatSeconds: 30,
      schedule: {
        enabled: false,
        days: [1],
        startTime: "09:00",
        endTime: "17:00",
      },
    };
    const fullSettings: WallboardAlarmSettings = {
      startupGraceSeconds: 45,
      volume: 0.7,
      rules: [rule],
    };

    try {
      await db.transaction(async (tx) => {
        // Shadow the production table inside this transaction. No users,
        // campaigns, or project rows are created or mutated by this test.
        await tx.execute(sql`
          CREATE TEMP TABLE wallboard_alarm_settings (
            id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id varchar NOT NULL,
            scope text NOT NULL,
            settings jsonb NOT NULL,
            updated_at timestamp NOT NULL DEFAULT now(),
            UNIQUE(user_id, scope)
          ) ON COMMIT DROP
        `);

        assert.deepEqual(
          await saveWallboardAlarmSettings("synthetic-user-a", null, fullSettings, tx),
          fullSettings,
        );
        assert.deepEqual(
          await getWallboardAlarmSettings("synthetic-user-a", null, tx),
          fullSettings,
        );

        // PUT semantics replace the complete document, including its rules.
        const edited: WallboardAlarmSettings = {
          ...fullSettings,
          rules: [{ ...rule, threshold: 120 }],
        };
        assert.deepEqual(
          await saveWallboardAlarmSettings("synthetic-user-a", null, edited, tx),
          edited,
        );
        const cleared = { ...edited, rules: [] };
        await saveWallboardAlarmSettings("synthetic-user-a", null, cleared, tx);
        assert.deepEqual(await getWallboardAlarmSettings("synthetic-user-a", null, tx), cleared);

        // Neither a different owner nor a different campaign scope can see
        // the all-board document.
        assert.deepEqual(
          await getWallboardAlarmSettings("synthetic-user-b", null, tx),
          defaultWallboardAlarmSettings(),
        );
        assert.deepEqual(
          await getWallboardAlarmSettings("synthetic-user-a", "campaign-2", tx),
          defaultWallboardAlarmSettings(),
        );

        await tx.insert(wallboardAlarmSettings).values({
          userId: "synthetic-user-a",
          scope: "campaign:malformed",
          settings: { startupGraceSeconds: 30 },
        });
        await assert.rejects(
          getWallboardAlarmSettings("synthetic-user-a", "malformed", tx),
          (error: unknown) => error instanceof Error &&
            error.message === "WALLBOARD_ALARM_SETTINGS_INVALID",
        );
        throw rollback;
      });
      assert.fail("the fixture transaction should roll back");
    } catch (error) {
      assert.equal(error, rollback);
    }
  } finally {
    await pool.end();
  }
});