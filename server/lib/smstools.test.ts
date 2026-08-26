import assert from "node:assert/strict";
import {
  mapSmsToolsState,
  normalizeSlovakPhone,
  parseSmsToolsStates,
  sendSmsTools,
} from "./smstools";
import { selectSmsProvider } from "./sms-provider-selection";
import { applyCampaignSmsProvider, parseCampaignSmsProvider } from "./sms-provider";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`  ✗ ${name}`);
    console.log(`    ${(error as Error).message}`);
  }
}

console.log("SMSTOOLS provider");

await test("normalizes Slovak local and international numbers", () => {
  assert.equal(normalizeSlovakPhone("0905 123 456"), "+421905123456");
  assert.equal(normalizeSlovakPhone("00421 905 123 456"), "+421905123456");
  assert.equal(normalizeSlovakPhone("+421-905-123-456"), "+421905123456");
});

await test("blocks foreign destinations", () => {
  assert.throws(() => normalizeSlovakPhone("+420777123456"), /slovenské/i);
  assert.throws(() => normalizeSlovakPhone("+4915112345678"), /slovenské/i);
});

await test("selects a country default and preserves BulkGate fallback", () => {
  assert.deepEqual(selectSmsProvider({
    country: "SK",
    settings: [{ provider: "smstools", countryCode: "SK", isActive: true, isDefault: true }],
    configured: { bulkgate: true, smstools: true },
  }), { provider: "smstools" });
  assert.deepEqual(selectSmsProvider({
    country: "CZ",
    settings: [],
    configured: { bulkgate: true, smstools: true },
  }), { provider: "bulkgate" });
});

await test("rejects an explicit SMSTOOLS request outside Slovakia", () => {
  const selected = selectSmsProvider({
    requested: "smstools",
    country: "CZ",
    settings: [],
    configured: { bulkgate: true, smstools: true },
  });
  assert.equal(selected.provider, undefined);
  assert.match(selected.error || "", /Slovensko/i);
});

await test("never falls back to a provider disabled for the country", () => {
  assert.deepEqual(selectSmsProvider({
    country: "SK",
    settings: [
      { provider: "bulkgate", countryCode: "SK", isActive: false, isDefault: false },
      { provider: "smstools", countryCode: "SK", isActive: true, isDefault: false },
    ],
    configured: { bulkgate: true, smstools: true },
  }), { provider: "smstools" });

  assert.equal(selectSmsProvider({
    requested: "smstools",
    country: "SK",
    settings: [
      { provider: "smstools", countryCode: null, isActive: true, isDefault: true },
      { provider: "smstools", countryCode: "SK", isActive: false, isDefault: false },
    ],
    configured: { bulkgate: true, smstools: true },
  }).provider, undefined);
});

await test("parses fixed Mission provider and preserves legacy Missions", () => {
  assert.equal(parseCampaignSmsProvider(JSON.stringify({ smsProvider: "smstools" })), "smstools");
  assert.equal(parseCampaignSmsProvider(JSON.stringify({ otherSetting: true })), null);
  assert.equal(parseCampaignSmsProvider(null), null);
});

await test("rejects manual Mission provider overrides", () => {
  const rejected = applyCampaignSmsProvider({
    campaignProvider: "smstools",
    requestedProvider: "bulkgate",
  });
  assert.equal(rejected.provider, undefined);
  assert.match(rejected.error || "", /SMSTOOLS/);
  assert.deepEqual(applyCampaignSmsProvider({
    campaignProvider: "smstools",
    requestedProvider: "bulkgate",
    mode: "override",
  }), { provider: "smstools" });
});

await test("enforces BulkGate while country-default Missions stay configurable", () => {
  assert.deepEqual(applyCampaignSmsProvider({
    campaignProvider: "bulkgate",
  }), { provider: "bulkgate" });
  assert.deepEqual(applyCampaignSmsProvider({
    campaignProvider: null,
    requestedProvider: "smstools",
  }), { provider: "smstools" });
});

await test("parses accepted message and batch IDs", async () => {
  process.env.SMSTOOLS_API_KEY = "test-key";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    const payload = JSON.parse(String(init?.body));
    assert.equal(payload.auth.apikey, "test-key");
    assert.equal(payload.data.recipients[0].phonenr, "+421905123456");
    return new Response(JSON.stringify({
      id: "OK",
      data: {
        batch_id: 12345,
        recipients: { accepted: [{ msg_id: 22345, phonenr: "+421905123456" }], rejected: [] },
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  try {
    const result = await sendSmsTools({ number: "0905123456", text: "Test", senderText: "CBC" });
    assert.equal(result.success, true);
    assert.equal(result.smsId, "22345");
    assert.equal(result.batchId, "12345");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

await test("maps provider API failures without accepting the send", async () => {
  process.env.SMSTOOLS_API_KEY = "test-key";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    id: "NEDOSTATOK_KREDITU",
    note: "Nedostatok kreditu",
  }), { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch;
  try {
    const result = await sendSmsTools({ number: "+421905123456", text: "Test", senderText: "CBC" });
    assert.equal(result.success, false);
    assert.match(result.error || "", /kreditu/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

await test("parses callbacks and maps terminal delivery states", () => {
  const [delivered, failed] = parseSmsToolsStates({
    sms_state: [
      { msg_id: 1, state_type: "DORUCOVANIE", state_id: "DORUCENA", permanent: "TRUE" },
      { msg_id: 2, state_type: "ODOSIELANIE", state_id: "NEDORUCENA", permanent: "TRUE" },
    ],
  });
  assert.equal(delivered.msgId, "1");
  assert.equal(mapSmsToolsState(delivered), "delivered");
  assert.equal(mapSmsToolsState(failed), "failed");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);