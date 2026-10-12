import assert from "node:assert/strict";
import { pool } from "../db";
import { selectSmsProvider } from "./sms-provider-selection";
import { sendSmsViaProvider, applyCampaignSmsProvider } from "./sms-provider";

// Synthetic credentials in this isolated test process. Every HTTP call is
// intercepted: this test must never send a real SMS.
process.env.BULKGATE_APPLICATION_ID = "fixture";
process.env.BULKGATE_APPLICATION_TOKEN = "fixture";
process.env.SMSTOOLS_API_KEY = "fixture";
const wire: string[] = [];
let rejectBulkGate = false;
globalThis.fetch = async (url) => {
  wire.push(String(url));
  assert.equal(String(url), "https://portal.bulkgate.com/api/1.0/simple/transactional");
  return new Response(JSON.stringify(rejectBulkGate
    ? { error: "fixture rejection", code: 400 }
    : { data: { status: "accepted", sms_id: "fixture-bulkgate-id" } }), { status: 200 });
};
try {
  assert.equal(selectSmsProvider({
    country: "SK", requested: "bulkgate",
    configured: { bulkgate: true, smstools: true },
    settings: [
      { provider: "smstools", countryCode: "SK", isActive: true, isDefault: true },
      { provider: "bulkgate", countryCode: "SK", isActive: true, isDefault: false },
    ],
  }).provider, "bulkgate");
  assert.equal(selectSmsProvider({
    country: "SK", requested: "bulkgate", settings: [],
    configured: { bulkgate: false, smstools: true },
  }).provider, undefined, "missing BulkGate must not fall back to SMSTOOLS");
  assert(applyCampaignSmsProvider({ campaignProvider: "smstools", requestedProvider: "bulkgate" }).error);
  const options = {
    number: "+421000000001", text: "fixture", country: "SK",
    provider: "smstools", requiredProvider: "bulkgate" as const,
    senderId: "gSystem", forceSender: true,
  };
  const sent = await sendSmsViaProvider(options);
  assert.equal(sent.success, true);
  assert.equal(sent.provider, "bulkgate");
  assert.equal(sent.smsId, "fixture-bulkgate-id");
  rejectBulkGate = true;
  assert.equal((await sendSmsViaProvider(options)).success, false);
  assert.equal(wire.length, 2, "no additional fallback requests");
  console.log("Omni reply gateway: actual BulkGate HTTP transport, default override and no fallback PASSED");
} finally {
  await pool.end();
}
