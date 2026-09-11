import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import test from "node:test";
import express, { type RequestHandler } from "express";
import { pool } from "./db";
import {
  registerPhoneCardPreferenceRoutes,
  type PhoneLookupMatch,
} from "./phone-card-preference-routes";
import { getRememberedPhoneCard, orderPhoneMatchesWithRememberedCard } from "../client/src/lib/phone-card-preference";
import { resolveMissedCallCardTarget } from "../client/src/lib/missed-call-card-resolver";

const slovakNumber = "+421 918 751 470";
const czechNumber = "+420 918 751 470";
const slovakMatches: PhoneLookupMatch[] = [
  { entityType: "customer", id: "customer-sk", name: "Slovak customer", phone: slovakNumber },
  { entityType: "clinic", id: "clinic-sk", name: "Slovak clinic", phone: slovakNumber },
];
const czechMatches: PhoneLookupMatch[] = [
  { entityType: "customer", id: "customer-cz", name: "Czech customer", phone: czechNumber },
  { entityType: "hospital", id: "hospital-cz", name: "Czech hospital", phone: czechNumber },
];

test("the authenticated preferences API preserves repeated inbound card choice and country boundaries", async () => {
  const suffix = randomUUID();
  const firstAgentId = randomUUID();
  const secondAgentId = randomUUID();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const userId = req.header("x-test-agent");
    if (userId) (req as any).session = { user: { id: userId } };
    next();
  });
  const requireAuth: RequestHandler = (req, res, next) => {
    if (!(req as any).session?.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next();
  };
  registerPhoneCardPreferenceRoutes(app, requireAuth, async (phone) => {
    if (phone.includes("420")) return czechMatches;
    return slovakMatches;
  });
  const server = createServer(app);

  await pool.query(
    `INSERT INTO users (id, username, email, full_name, password_hash)
     VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)`,
    [
      firstAgentId,
      `phone-card-agent-a-${suffix}`,
      `phone-card-agent-a-${suffix}@test.invalid`,
      "Phone-card test agent A",
      "not-used-by-route-test",
      secondAgentId,
      `phone-card-agent-b-${suffix}`,
      `phone-card-agent-b-${suffix}@test.invalid`,
      "Phone-card test agent B",
      "not-used-by-route-test",
    ],
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const request = (userId: string | undefined, path: string, init?: RequestInit) =>
    fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        ...(userId ? { "x-test-agent": userId } : {}),
      },
    });

  try {
    assert.equal((await request(undefined, `/api/phone/preferences?phone=${encodeURIComponent(slovakNumber)}`)).status, 401);

    // The first live call offers both matches. The agent selects the clinic
    // through the actual authenticated PUT endpoint.
    assert.deepEqual(
      orderPhoneMatchesWithRememberedCard(slovakMatches, undefined).map((match) => match.id),
      ["customer-sk", "clinic-sk"],
    );
    const saveResponse = await request(firstAgentId, "/api/phone/preferences", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        phone: slovakNumber,
        entityType: "clinic",
        entityId: "clinic-sk",
      }),
    });
    assert.equal(saveResponse.status, 204);

    // The repeated live call arrives in 00 format. It reads the stored
    // preference through GET and promotes that current match first.
    const repeatResponse = await request(
      firstAgentId,
      `/api/phone/preferences?phone=${encodeURIComponent("00421 918 751 470")}`,
    );
    assert.equal(repeatResponse.status, 200);
    const preference = await repeatResponse.json();
    assert.equal(preference.entityType, "clinic");
    assert.equal(preference.entityId, "clinic-sk");
    const remembered = getRememberedPhoneCard(slovakMatches, preference);
    assert.deepEqual(
      orderPhoneMatchesWithRememberedCard(slovakMatches, remembered).map((match) => match.id),
      ["clinic-sk", "customer-sk"],
    );

    // A missed call without a persisted customer identity opens this validated
    // remembered match rather than forcing an ambiguous card choice.
    assert.deepEqual(
      resolveMissedCallCardTarget(null, slovakNumber, slovakMatches, remembered),
      { kind: "match", match: slovakMatches[1] },
    );

    // Agent B never sees agent A's choice, even for the exact same caller.
    const otherAgentResponse = await request(
      secondAgentId,
      `/api/phone/preferences?phone=${encodeURIComponent(slovakNumber)}`,
    );
    assert.equal(otherAgentResponse.status, 200);
    assert.equal(await otherAgentResponse.json(), null);

    // The same national suffix in another country uses a different persistence
    // key and must not promote or open the Slovak clinic card.
    const czechPreferenceResponse = await request(
      firstAgentId,
      `/api/phone/preferences?phone=${encodeURIComponent(czechNumber)}`,
    );
    assert.equal(czechPreferenceResponse.status, 200);
    assert.equal(await czechPreferenceResponse.json(), null);
    assert.equal(getRememberedPhoneCard(czechMatches, undefined), undefined);
    assert.deepEqual(
      resolveMissedCallCardTarget(null, czechNumber, czechMatches),
      { kind: "ambiguous", matches: czechMatches },
    );

    const persisted = await pool.query(
      `SELECT user_id, normalized_phone, entity_type, entity_id
       FROM agent_phone_entity_preferences
       WHERE user_id = $1`,
      [firstAgentId],
    );
    assert.deepEqual(persisted.rows, [{
      user_id: firstAgentId,
      normalized_phone: "e164:421918751470",
      entity_type: "clinic",
      entity_id: "clinic-sk",
    }]);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await pool.query("DELETE FROM agent_phone_entity_preferences WHERE user_id = ANY($1::varchar[])", [[firstAgentId, secondAgentId]]);
    await pool.query("DELETE FROM users WHERE id = ANY($1::varchar[])", [[firstAgentId, secondAgentId]]);
    await pool.end();
  }
});