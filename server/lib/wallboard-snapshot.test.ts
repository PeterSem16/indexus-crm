import assert from "node:assert/strict";
import test from "node:test";

/**
 * This is deliberately a read-only integration check.  The wallboard builder
 * imports the application pool, so keep the import behind the environment
 * guard to let the pure test suite run without a provisioned database.
 */
test("wallboard snapshot executes the latest-session aggregate join", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not configured");
    return;
  }

  const [{ db, pool }, { users, campaigns, campaignAgents }, { and, eq }] = await Promise.all([
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
      assert.equal(typeof snapshot.queue.answeredToday, "number");
      assert.equal(typeof snapshot.source.live, "boolean");
      assert.ok(snapshot.agents.every((agent) =>
        (typeof agent.avatarUrl === "string" || agent.avatarUrl === null) &&
        typeof agent.todayMissionSeconds === "number" &&
        typeof agent.todayAccruing === "boolean",
      ));
    }
  } finally {
    await pool.end();
  }
});