import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveMissionEmailContext } from "./mission-email-context";
function fixture(allowed = true, linked = true) {
  return { query: async (sql: string) => ({ rows: sql.includes("FROM users u CROSS JOIN campaigns")
    ? allowed ? [{ role: "admin", assigned_countries: ["SK"], country_codes: ["SK"], name: "Mission" }] : []
    : linked ? [{ id: "contact" }] : [] }) } as any;
}
test("email Mission context is optional for standalone compose, otherwise exact and authorized", async () => {
  assert.deepEqual(await resolveMissionEmailContext(fixture(), "agent", {}), {});
  const body = { campaignId: "medical", customerId: "clinic", contactType: "clinic", campaignCountryCode: "SK" };
  assert.deepEqual(await resolveMissionEmailContext(fixture(), "agent", body),
    { campaignId: "medical", campaignContactId: "contact" });
  await assert.rejects(resolveMissionEmailContext(fixture(false), "agent", body));
  await assert.rejects(resolveMissionEmailContext(fixture(true, false), "agent", body));
  await assert.rejects(resolveMissionEmailContext(fixture(), "agent", { ...body, campaignCountryCode: "IT" }));
});
