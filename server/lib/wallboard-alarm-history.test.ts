import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import test from "node:test";
import { sql } from "drizzle-orm";
import express, { type RequestHandler } from "express";
import {
  WALLBOARD_ALARM_HISTORY_RETENTION_DAYS,
  wallboardAlarmHistoryEntrySchema,
} from "@shared/wallboard-alarm-history";
import { wallboardAlarmHistory } from "@shared/schema";

function entry(revision: number, changes: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    incidentId: "f4a7fc7d-6c4f-4cc6-a96c-074036d37273",
    revision,
    type: "no_calls",
    threshold: 90,
    startedAt: new Date(now - 120_000).toISOString(),
    lastObservedAt: new Date(now - 15_000).toISOString(),
    endedAt: null,
    endReason: null,
    acknowledgedAt: null,
    mutedAt: null,
    mutedUntil: null,
    ...changes,
  };
}

test("wallboard alarm history contract is strict and ordered", () => {
  assert.equal(WALLBOARD_ALARM_HISTORY_RETENTION_DAYS, 30);
  assert.equal(wallboardAlarmHistoryEntrySchema.safeParse(entry(1)).success, true);
  const observed = entry(1);
  const recoveredAt = new Date(Date.parse(observed.lastObservedAt) + 15_000).toISOString();
  assert.equal(wallboardAlarmHistoryEntrySchema.safeParse({
    ...observed,
    lastObservedAt: recoveredAt,
    endedAt: recoveredAt,
    endReason: "recovered",
  }).success, true);
  assert.equal(wallboardAlarmHistoryEntrySchema.safeParse({
    ...entry(1),
    ruleId: "not-permitted",
  }).success, false);
  assert.equal(wallboardAlarmHistoryEntrySchema.safeParse({
    ...entry(1),
    endedAt: entry(1).startedAt,
    endReason: null,
  }).success, false);
  assert.equal(wallboardAlarmHistoryEntrySchema.safeParse({
    ...entry(1),
    lastObservedAt: new Date(Date.now() - 180_000).toISOString(),
  }).success, false);
  assert.equal(wallboardAlarmHistoryEntrySchema.safeParse({
    ...entry(1),
    acknowledgedAt: new Date().toISOString(),
  }).success, false);
  assert.equal(wallboardAlarmHistoryEntrySchema.safeParse({
    ...entry(1),
    mutedUntil: new Date().toISOString(),
  }).success, false);
  assert.equal(wallboardAlarmHistoryEntrySchema.safeParse({
    ...entry(2_147_483_648),
  }).success, false);
});

test("wallboard alarm history is owner/scope isolated and revision-monotonic", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not configured");
    return;
  }
  const [{ db, pool }, history] = await Promise.all([
    import("../db"),
    import("./wallboard"),
  ]);
  const { registerWallboardRoutes } = await import("../wallboard-routes");
  const rollback = new Error("wallboard alarm history fixture rollback");
  try {
    try {
      await db.transaction(async (tx) => {
        await tx.execute(sql`
          CREATE TEMP TABLE wallboard_alarm_history (
            id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id varchar NOT NULL,
            scope text NOT NULL,
            incident_id varchar NOT NULL,
            revision integer NOT NULL,
            type text NOT NULL,
            threshold numeric NOT NULL,
            started_at timestamp NOT NULL,
            last_observed_at timestamp NOT NULL,
            ended_at timestamp,
            end_reason text,
            acknowledged_at timestamp,
            muted_at timestamp,
            muted_until timestamp,
            authorized_mission_ids text[] NOT NULL,
            created_at timestamp NOT NULL DEFAULT now(),
            updated_at timestamp NOT NULL DEFAULT now(),
            UNIQUE(user_id, scope, incident_id)
          ) ON COMMIT DROP
        `);

        // A later revision may arrive first, and an earlier keepalive must not
        // overwrite it. The server accepts no owner or Mission IDs from input.
        const first = entry(2);
        const revision = (number: number, changes: Record<string, unknown> = {}) => ({
          ...first, revision: number, ...changes,
        });
        await history.saveWallboardAlarmHistory("viewer-a", null, [first], ["mission-a", "mission-b"], new Date(), tx);
        await history.saveWallboardAlarmHistory("viewer-a", null, [revision(1)], ["mission-a", "mission-b"], new Date(), tx);
        const own = await history.getWallboardAlarmHistory(
          "viewer-a", null, 30, ["mission-a", "mission-b"], new Date(), tx,
        );
        assert.equal(own.items.length, 1);
        assert.equal(own.items[0].revision, 2);
        assert.equal((await history.getWallboardAlarmHistory(
          "viewer-b", null, 30, ["mission-a", "mission-b"], new Date(), tx,
        )).items.length, 0);
        assert.equal((await history.getWallboardAlarmHistory(
          "viewer-a", "mission-a", 30, ["mission-a", "mission-b"], new Date(), tx,
        )).items.length, 0);

        // Losing a Mission filters only the affected historical aggregate
        // rows. It must not block a new incident for the still-visible scope.
        assert.equal((await history.getWallboardAlarmHistory(
          "viewer-a", null, 30, ["mission-a"], new Date(), tx,
        )).items.length, 0);
        const fresh = {
          ...revision(1),
          incidentId: "2ccdfd06-fc7a-455f-aa88-8c3ccfd5d8e9",
        };
        await history.saveWallboardAlarmHistory(
          "viewer-a", null, [fresh], ["mission-a"], new Date(), tx,
        );
        const visibleAfterLoss = await history.getWallboardAlarmHistory(
          "viewer-a", null, 30, ["mission-a"], new Date(), tx,
        );
        assert.deepEqual(visibleAfterLoss.items.map((item: { incidentId: string }) => item.incidentId), [fresh.incidentId]);
        await assert.rejects(
          history.saveWallboardAlarmHistory("viewer-a", null, [revision(3)], ["mission-a"], new Date(), tx),
          (error: unknown) => error instanceof Error &&
            error.message === "WALLBOARD_ALARM_HISTORY_SCOPE_CONFLICT",
        );
        // A changed set (including newly visible Missions) cannot update the
        // old aggregate incident either.
        await assert.rejects(
          history.saveWallboardAlarmHistory("viewer-a", null, [revision(3)], ["mission-a", "mission-b", "mission-c"], new Date(), tx),
          (error: unknown) => error instanceof Error &&
            error.message === "WALLBOARD_ALARM_HISTORY_SCOPE_CONFLICT",
        );

        // Higher revisions cannot change an incident's immutable identity.
        await assert.rejects(
          history.saveWallboardAlarmHistory(
            "viewer-a", null, [revision(3, { threshold: 91 })], ["mission-a", "mission-b"], new Date(), tx,
          ),
          (error: unknown) => error instanceof Error &&
            error.message === "WALLBOARD_ALARM_HISTORY_IDENTITY_CONFLICT",
        );
        await assert.rejects(
          history.saveWallboardAlarmHistory(
            "viewer-a", null,
            [revision(3, { startedAt: new Date(Date.now() + 20 * 60 * 1000).toISOString() })],
            ["mission-a", "mission-b"],
            new Date(),
            tx,
          ),
          (error: unknown) => error instanceof Error &&
            error.message === "WALLBOARD_ALARM_HISTORY_INVALID",
        );
        // Cumulative fields cannot move backwards, clear prior user action,
        // or reopen an already closed incident.
        const acknowledged = revision(3, {
          lastObservedAt: new Date(Date.parse(first.lastObservedAt) + 1_000).toISOString(),
          acknowledgedAt: new Date(Date.parse(first.lastObservedAt) + 1_000).toISOString(),
        });
        await history.saveWallboardAlarmHistory(
          "viewer-a", null, [acknowledged], ["mission-a", "mission-b"], new Date(), tx,
        );
        await assert.rejects(
          history.saveWallboardAlarmHistory(
            "viewer-a", null, [revision(4)], ["mission-a", "mission-b"], new Date(), tx,
          ),
          (error: unknown) => error instanceof Error &&
            error.message === "WALLBOARD_ALARM_HISTORY_STATE_CONFLICT",
        );

        // The API fetches one extra row, so truncation is tied only to the
        // response cap, not the intentionally selected time window.
        const observedAt = new Date().toISOString();
        await tx.insert(wallboardAlarmHistory).values(Array.from({ length: 1_001 }, (_, index) => ({
          userId: "viewer-a",
          scope: "all",
          incidentId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
          revision: 1,
          type: "no_calls",
          threshold: "90",
          startedAt: new Date(Date.now() - 30_000),
          lastObservedAt: new Date(observedAt),
          endedAt: null,
          endReason: null,
          acknowledgedAt: null,
          mutedAt: null,
          mutedUntil: null,
          authorizedMissionIds: ["mission-a"],
        })));
        const capped = await history.getWallboardAlarmHistory(
          "viewer-a", null, 1, ["mission-a"], new Date(), tx,
        );
        assert.equal(capped.items.length, 1_000);
        assert.equal(capped.truncated, true);
        throw rollback;
      });
      assert.fail("the fixture transaction should roll back");
    } catch (error) {
      assert.equal(error, rollback);
    }

    // Two independent transactions write the same absent key concurrently.
    // The transaction-scoped advisory lock prevents the unique-key race.
    const schema = `wallboard_history_concurrency_${process.pid}`;
    await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await pool.query(`CREATE SCHEMA "${schema}"`);
    try {
      await pool.query(`
        CREATE TABLE "${schema}".wallboard_alarm_history (
          id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id varchar NOT NULL, scope text NOT NULL, incident_id varchar NOT NULL,
          revision integer NOT NULL, type text NOT NULL, threshold numeric NOT NULL,
          started_at timestamp NOT NULL, last_observed_at timestamp NOT NULL,
          ended_at timestamp, end_reason text, acknowledged_at timestamp,
          muted_at timestamp, muted_until timestamp, authorized_mission_ids text[] NOT NULL,
          created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(),
          UNIQUE(user_id, scope, incident_id)
        )
      `);
      const concurrent = entry(1, {
        incidentId: "e26fba7d-a2d5-48f5-a320-537599f92e8e",
      });
      const write = () => db.transaction(async (tx) => {
        await tx.execute(sql.raw(`SET LOCAL search_path TO "${schema}", public`));
        await history.saveWallboardAlarmHistory(
          "concurrent-viewer", null, [concurrent], ["mission-a"], new Date(), tx,
        );
      });
      await Promise.all([write(), write()]);
      await db.transaction(async (tx) => {
        await tx.execute(sql.raw(`SET LOCAL search_path TO "${schema}", public`));
        const stored = await history.getWallboardAlarmHistory(
          "concurrent-viewer", null, 30, ["mission-a"], new Date(), tx,
        );
        assert.equal(stored.items.length, 1);
      });
    } finally {
      await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    }

    // This is a real HTTP route/session check, not only a storage assertion:
    // the authenticated manager is a member of Mission A but cannot select B.
    const suffix = randomUUID();
    const ownerId = randomUUID();
    const visibleMissionId = randomUUID();
    const hiddenMissionId = randomUUID();
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      if (req.header("x-history-owner") === ownerId) {
        (req as any).session = { user: { id: ownerId, role: "manager" } };
      }
      next();
    });
    const requireAuth: RequestHandler = (req, res, next) => {
      if (!(req as any).session?.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      next();
    };
    registerWallboardRoutes(app, requireAuth);
    const server = createServer(app);
    await pool.query(
      `INSERT INTO users (id, username, email, full_name, password_hash, role)
       VALUES ($1, $2, $3, $4, $5, 'manager')`,
      [
        ownerId,
        `wallboard-history-owner-${suffix}`,
        `wallboard-history-owner-${suffix}@test.invalid`,
        "Wallboard history owner",
        "not-used-by-route-test",
      ],
    );
    await pool.query(
      `INSERT INTO campaigns (id, name, status, country_codes)
       VALUES ($1, $2, 'active', ARRAY[]::text[]), ($3, $4, 'active', ARRAY[]::text[])`,
      [
        visibleMissionId,
        "Visible history mission",
        hiddenMissionId,
        "Hidden history mission",
      ],
    );
    await pool.query(
      `INSERT INTO campaign_agents (campaign_id, user_id, role) VALUES ($1, $2, 'agent')`,
      [visibleMissionId, ownerId],
    );
    try {
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/wallboard/alarm-history?campaignId=${hiddenMissionId}&days=1`,
        { headers: { "x-history-owner": ownerId } },
      );
      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), { error: "WALLBOARD_CAMPAIGN_FORBIDDEN" });
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => error ? reject(error) : resolve()),
      );
      await pool.query("DELETE FROM campaign_agents WHERE campaign_id = ANY($1::varchar[])", [[visibleMissionId, hiddenMissionId]]);
      await pool.query("DELETE FROM campaigns WHERE id = ANY($1::varchar[])", [[visibleMissionId, hiddenMissionId]]);
      await pool.query("DELETE FROM users WHERE id = $1", [ownerId]);
    }
  } finally {
    await pool.end();
  }
});