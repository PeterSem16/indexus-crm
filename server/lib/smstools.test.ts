import assert from "node:assert/strict";
import {
  isSmsToolsCallbackConfigured,
  mapSmsToolsState,
  normalizeSlovakPhone,
  parseSmsToolsIncomingMessages,
  parseSmsToolsStates,
  sendSmsTools,
  verifySmsToolsCallback,
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

await test("accepts SMSTOOLS callback payload variants", () => {
  const [direct] = parseSmsToolsStates({
    msg_id: 3,
    stateType: "delivery",
    status: "delivered",
    permanent: 1,
  });
  const [formEncoded] = parseSmsToolsStates({
    sms_state: JSON.stringify([{ message_id: 4, state_id: "FAILED", permanent: "1" }]),
  });
  assert.equal(direct.msgId, "3");
  assert.equal(mapSmsToolsState(direct), "delivered");
  assert.equal(formEncoded.msgId, "4");
  assert.equal(mapSmsToolsState(formEncoded), "failed");
});

await test("parses incoming SMSTOOLS reply payload variants", () => {
  const [nested] = parseSmsToolsIncomingMessages({
    received_sms: [{
      msg_id: 15,
      response_id: 1501,
      sender_phonenr: "+421905123456",
      recipient_phonenr: "1234",
      text: "Áno, súhlasím",
      ts: "2026-08-26T10:40:00+02:00",
    }],
  });
  const [direct] = parseSmsToolsIncomingMessages({
    message_id: "16",
    sender: "0905123456",
    text: "Prosím zavolajte",
  });
  assert.equal(nested.messageId, "1501");
  assert.equal(nested.inReplyToMessageId, "15");
  assert.equal(nested.senderPhone, "+421905123456");
  assert.equal(nested.recipientPhone, "1234");
  assert.equal(nested.text, "Áno, súhlasím");
  assert.equal(direct.messageId, "16");
  assert.equal(direct.text, "Prosím zavolajte");
  assert.equal(parseSmsToolsStates({
    message_id: "16",
    sender: "0905123456",
    text: "Prosím zavolajte",
  }).length, 0);
  assert.equal(parseSmsToolsIncomingMessages({
    sms_state: [{ msg_id: 17, phonenr: "+421905123456", state_id: "DORUCENA" }],
  }).length, 0);
});

await test("authenticates callbacks by query, header, bearer, or basic credentials", () => {
  const previousToken = process.env.SMSTOOLS_CALLBACK_TOKEN;
  const previousUser = process.env.SMSTOOLS_CALLBACK_USER;
  const previousPassword = process.env.SMSTOOLS_CALLBACK_PASSWORD;
  try {
    process.env.SMSTOOLS_CALLBACK_TOKEN = "callback-secret";
    assert.equal(isSmsToolsCallbackConfigured(), true);
    assert.equal(verifySmsToolsCallback({ headers: {}, query: { token: "callback-secret" } }), true);
    assert.equal(verifySmsToolsCallback({ headers: { "x-smstools-callback-token": "callback-secret" } }), true);
    assert.equal(verifySmsToolsCallback({ headers: { authorization: "Bearer callback-secret" } }), true);
    assert.equal(verifySmsToolsCallback({ headers: {}, query: { token: "wrong" } }), false);

    delete process.env.SMSTOOLS_CALLBACK_TOKEN;
    process.env.SMSTOOLS_CALLBACK_USER = "smstools";
    process.env.SMSTOOLS_CALLBACK_PASSWORD = "password";
    const basic = Buffer.from("smstools:password").toString("base64");
    assert.equal(verifySmsToolsCallback({ headers: { authorization: `Basic ${basic}` } }), true);

    process.env.SMSTOOLS_CALLBACK_TOKEN = "legacy-token";
    assert.equal(verifySmsToolsCallback({ headers: { authorization: `Basic ${basic}` } }), true);
  } finally {
    if (previousToken === undefined) delete process.env.SMSTOOLS_CALLBACK_TOKEN;
    else process.env.SMSTOOLS_CALLBACK_TOKEN = previousToken;
    if (previousUser === undefined) delete process.env.SMSTOOLS_CALLBACK_USER;
    else process.env.SMSTOOLS_CALLBACK_USER = previousUser;
    if (previousPassword === undefined) delete process.env.SMSTOOLS_CALLBACK_PASSWORD;
    else process.env.SMSTOOLS_CALLBACK_PASSWORD = previousPassword;
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);