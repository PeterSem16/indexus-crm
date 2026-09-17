import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultWallboardAlarmSettings,
  wallboardAlarmSettingsSchema,
} from "@shared/wallboard-alarms";

test("wallboard alarm settings default is a strict, empty configuration", () => {
  const parsed = wallboardAlarmSettingsSchema.safeParse(defaultWallboardAlarmSettings());
  assert.equal(parsed.success, true);
  assert.deepEqual(parsed.success ? parsed.data : null, {
    startupGraceSeconds: 30,
    volume: 0.5,
    rules: [],
  });
});

test("wallboard alarm settings reject unknown fields and more than 30 rules", () => {
  const base = defaultWallboardAlarmSettings();
  assert.equal(wallboardAlarmSettingsSchema.safeParse({ ...base, extra: true }).success, false);
  // The owner is always taken from req.session.user.id; it is not part of the
  // shared direct settings contract and cannot be forged in a PUT body.
  assert.equal(wallboardAlarmSettingsSchema.safeParse({ ...base, userId: "forged-user" }).success, false);
  const rule = {
    id: "rule",
    name: "No calls",
    enabled: true,
    type: "no_calls" as const,
    threshold: 1,
    direction: "both" as const,
    callEvent: "started" as const,
    delaySeconds: 0,
    mode: "visual" as const,
    repeatSeconds: 0,
    schedule: {
      enabled: false,
      days: [1],
      startTime: "09:00",
      endTime: "17:00",
    },
  };
  assert.equal(wallboardAlarmSettingsSchema.safeParse({
    ...base,
    rules: Array.from({ length: 31 }, (_, index) => ({ ...rule, id: `rule-${index}` })),
  }).success, false);
});

test("wallboard campaign query parser rejects object and array forms", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not configured");
    return;
  }
  const { parseWallboardCampaignId } = await import("../wallboard-routes");
  for (const campaignId of [["campaign-a", "campaign-b"], { id: "campaign-a" }]) {
    assert.throws(
      () => parseWallboardCampaignId({ query: { campaignId } } as any),
      (error: unknown) => error instanceof Error &&
        error.message === "WALLBOARD_INVALID_CAMPAIGN_ID",
    );
  }
});