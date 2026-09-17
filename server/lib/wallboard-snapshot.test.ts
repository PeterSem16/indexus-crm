import assert from "node:assert/strict";
import test from "node:test";

/**
 * The snapshot check is read-only; the aggregate regression uses a synthetic
 * transaction that always rolls back. The wallboard builder imports the
 * application pool, so keep the import behind the environment guard.
 */
test("wallboard snapshot executes the latest-session aggregate join", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not configured");
    return;
  }

  const [{ db, pool }, { users, campaigns, campaignAgents, callLogs, inboundCallLogs }, { and, eq }] = await Promise.all([
    import("../db"),
    import("@shared/schema"),
    import("drizzle-orm"),
  ]);
  const { buildWallboardSnapshot } = await import("./wallboard");

  try {
    const [admin] = await db.select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, "admin"), eq(users.isActive, true)))
      .limit(1);
    if (!admin) {
      t.skip("no active admin is available in the development database");
      return;
    }

    const [activeCampaign] = await db.select({ id: campaigns.id })
      .from(campaigns)
      .innerJoin(campaignAgents, eq(campaignAgents.campaignId, campaigns.id))
      .where(eq(campaigns.status, "active"))
      .limit(1);
    if (!activeCampaign) {
      t.skip("no active campaign with a current roster is available");
      return;
    }

    const viewer = { id: admin.id, role: "admin" as const, roleId: null };
    const all = await buildWallboardSnapshot(viewer, null);
    const one = await buildWallboardSnapshot(viewer, activeCampaign.id);

    assert.equal(all.scope.campaignId, null);
    assert.ok(all.campaigns.length > 0);
    assert.ok(one.scope.campaignId !== null);
    assert.equal(one.campaigns.length, 1);
    for (const snapshot of [all, one]) {
      assert.equal(typeof snapshot.generatedAt, "string");
      assert.ok(snapshot.callActivity);
      assert.ok(["inbound", "outbound"].every((direction) =>
        [snapshot.callActivity[direction as "inbound" | "outbound"].startedAt,
          snapshot.callActivity[direction as "inbound" | "outbound"].connectedAt]
          .every((timestamp) => timestamp === null || typeof timestamp === "string"),
      ));
      assert.equal(typeof snapshot.queue.answeredToday, "number");
      assert.equal(typeof snapshot.source.live, "boolean");
      assert.ok(snapshot.agents.every((agent) =>
        (typeof agent.avatarUrl === "string" || agent.avatarUrl === null) &&
        typeof agent.todayMissionSeconds === "number" &&
        typeof agent.todayAccruing === "boolean",
      ));
    }

    // Rollback-only fixture: an ended/completed call must remain the last
    // event clock for no-calls rules. This exercises the aggregate query,
    // rather than merely checking the response shape.
    const aggregateNow = new Date("2099-01-01T00:00:00.000Z");
    const completedStartedAt = new Date("2098-12-31T23:00:00.000Z");
    const completedAnsweredAt = new Date("2098-12-31T23:05:00.000Z");
    const rollback = new Error("wallboard fixture rollback");
    try {
      await db.transaction(async (tx) => {
        await tx.insert(callLogs).values({
          userId: admin.id,
          campaignId: activeCampaign.id,
          phoneNumber: "synthetic-test-number",
          direction: "outbound",
          status: "completed",
          startedAt: completedStartedAt,
          answeredAt: completedAnsweredAt,
          endedAt: new Date("2098-12-31T23:10:00.000Z"),
        });
        const [inboundLog] = await tx.insert(callLogs).values({
          userId: admin.id,
          campaignId: activeCampaign.id,
          phoneNumber: "synthetic-inbound-number",
          direction: "inbound",
          status: "completed",
          startedAt: new Date("2098-12-31T22:00:00.000Z"),
          answeredAt: new Date("2098-12-31T22:10:00.000Z"),
          endedAt: new Date("2098-12-31T22:15:00.000Z"),
        }).returning({ id: callLogs.id });
        await tx.insert(inboundCallLogs).values({
          callLogId: inboundLog.id,
          callerNumber: "synthetic-inbound-number",
          status: "completed",
          enteredQueueAt: new Date("2098-12-31T22:01:00.000Z"),
          answeredAt: new Date("2098-12-31T22:09:00.000Z"),
        });
        // Null-campaign and future timestamps are deliberately excluded.
        await tx.insert(callLogs).values({
          userId: admin.id,
          campaignId: null,
          phoneNumber: "synthetic-null-campaign",
          direction: "outbound",
          status: "completed",
          startedAt: new Date("2098-12-31T23:30:00.000Z"),
          endedAt: new Date("2098-12-31T23:35:00.000Z"),
        });
        await tx.insert(callLogs).values({
          userId: admin.id,
          campaignId: activeCampaign.id,
          phoneNumber: "synthetic-future",
          direction: "outbound",
          status: "completed",
          startedAt: new Date("2099-01-01T00:01:00.000Z"),
          endedAt: new Date("2099-01-01T00:02:00.000Z"),
        });
        const { aggregateWallboardCallActivity } = await import("./wallboard");
        const activity = await aggregateWallboardCallActivity(
          [activeCampaign.id],
          aggregateNow,
          tx,
        );
        assert.equal(activity.outbound.startedAt, completedStartedAt.toISOString());
        assert.equal(activity.outbound.connectedAt, completedAnsweredAt.toISOString());
        assert.equal(activity.inbound.startedAt, "2098-12-31T22:01:00.000Z");
        assert.equal(activity.inbound.connectedAt, "2098-12-31T22:10:00.000Z");
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