import test from "node:test";
import assert from "node:assert/strict";
import { resolveAutomationMissionSender } from "./automation-mission-sender";
import { selectAutomationEmailSender } from "./automation-email-policy";
import { sendAutomationGraphEmail } from "./automation-email-graph";
import { deliverAutomationSms } from "./automation-sms-delivery";
import { emailActionIssues } from "../../shared/automation-email-action";
import { statusListNativeActionIssues } from "../../shared/status-list-service-config";
import copy from "../../client/src/i18n/mission-communication-translations";

const context = () => ({
  rule: { createdByUserId: "author" },
  statusList: { campaignId: "mission" },
  event: { countryCode: "SK", actorUserId: "agent", newValues: { campaignId: "mission" } },
  newValues: { campaignId: "mission" },
});
function deps(mode = "user", overrides: Record<string, any> = {}) {
  return {
    campaign: async (id: string) => {
      assert.equal(id, "mission");
      return { countryCodes: ["SK"], settings: JSON.stringify({
        nexusPulseEmailMode: mode, nexusPulseEmailAddress: "shared@example.test",
      }) };
    },
    user: async (id: string) => ({ id, isActive: true }),
    session: async () => ({ campaignIds: ["mission"] }),
    sharedMailboxes: async () => [{ email: "shared@example.test", isActive: true }],
    ...overrides,
  };
}
test("legacy personal/system choices preserve rule-author semantics without Mission lookups", async () => {
  for (const senderMode of ["personal", "system"]) {
    const config = { senderMode };
    const result = await resolveAutomationMissionSender(config, context(), deps("user", {
      campaign: () => { throw new Error("must not resolve legacy"); },
    }));
    assert.equal(result.config, config);
  }
  assert.equal(selectAutomationEmailSender({ senderMode: "personal", senderUserId: "spoof" }, context()).authorId, "author");
});
test("agent mode resolves the real event actor, never author or client sender", async () => {
  const result = await resolveAutomationMissionSender({
    senderMode: "agent", senderUserId: "spoof", includeSystemSignature: true,
  }, context(), deps("system"));
  assert.equal(selectAutomationEmailSender(result.config, context()).authorId, "agent");
  assert.equal(result.config.includeSystemSignature, false);
});
test("Mission user/system/shared choices use current persisted settings", async () => {
  const user = await resolveAutomationMissionSender({ senderMode: "mission" }, context(), deps());
  assert.equal(user.config.senderMode, "agent");
  const system = await resolveAutomationMissionSender({ senderMode: "mission" }, context(), deps("system", {
    session: () => { throw new Error("system does not borrow agent credentials"); },
  }));
  assert.equal(system.config.senderMode, "system");
  const shared = await resolveAutomationMissionSender({ senderMode: "mission" }, context(), deps("custom"));
  assert.equal(shared.sharedMailboxEmail, "shared@example.test");
  assert.equal(shared.config.senderMode, "agent");
});
test("missing actor, inactive or wrong-Mission shifts and unconnected shared access fail closed", async () => {
  const noActor = context() as any;
  delete noActor.event.actorUserId;
  await assert.rejects(resolveAutomationMissionSender({ senderMode: "agent" }, noActor, deps()), /triggered/);
  for (const changes of [
    { user: async () => ({ isActive: false }) },
    { session: async () => null },
    { session: async () => ({ campaignIds: ["different"] }) },
    { session: async () => ({ campaignIds: ["mission"], endedAt: new Date() }) },
  ]) await assert.rejects(resolveAutomationMissionSender({ senderMode: "agent" }, context(), deps("user", changes)), /active agent shift/);
  await assert.rejects(resolveAutomationMissionSender({ senderMode: "mission" }, context(),
    deps("custom", { sharedMailboxes: async () => [{ email: "other@example.test", isActive: true }] })), /not available/);
});
test("Mission and country are required; malformed policy is not silently replaced", async () => {
  await assert.rejects(resolveAutomationMissionSender({ senderMode: "mission" }, {}, deps()), /verified Mission/);
  await assert.rejects(resolveAutomationMissionSender({ senderMode: "mission" }, context(),
    deps("user", { campaign: async () => ({ countryCodes: ["CZ"] }) })), /country/);
  await assert.rejects(resolveAutomationMissionSender({ senderMode: "mission" }, context(),
    deps("user", { campaign: async () => ({ countryCodes: ["SK"], settings: "{" }) })), /invalid/);
});
test("shared mailbox uses a delegated users/sendMail endpoint without altering normal mail", async () => {
  const urls: string[] = [];
  const fetcher = async (url: any) => { urls.push(String(url)); return { ok: true } as Response; };
  const payload = { message: {}, saveToSentItems: true };
  await sendAutomationGraphEmail("test", payload, fetcher as any);
  await sendAutomationGraphEmail("test", payload, fetcher as any, "shared@example.test");
  assert.deepEqual(urls, [
    "https://graph.microsoft.com/v1.0/me/sendMail",
    "https://graph.microsoft.com/v1.0/users/shared%40example.test/sendMail",
  ]);
});
test("both new email choices pass persisted action validation", () => {
  for (const senderMode of ["mission", "agent"]) assert.deepEqual(emailActionIssues({
    emailActionVersion: 2, senderMode, to: "recipient@example.test", subject: "Test", body: "Test",
  }), []);
});
test("Mission SMS inherits server gateway policy and attributes history to the actor", async () => {
  const sent: any[] = [], history: any[] = [];
  const result = await deliverAutomationSms({
    smsActionVersion: 2, to: ["+421900123456"], text: "Test", provider: "mission",
  }, { ...context(), statusListService: true, user: { id: "author" } }, {
    createMessage: async message => { history.push(message); return { id: "message" }; },
    updateMessage: async () => {},
    send: async options => { sent.push(options); return { success: true, provider: "smstools" }; },
  });
  assert.equal(result.ok, true);
  assert.equal(history[0].userId, "agent");
  assert.equal(sent[0].campaignId, "mission");
  assert.equal(sent[0].provider, undefined);
  assert.equal(sent[0].campaignProviderMode, "reject-conflict");
  assert.deepEqual(statusListNativeActionIssues("send_sms", {
    smsActionVersion: 2, to: ["+421900123456"], text: "Test", provider: "mission",
  }), []);
});
test("Mission SMS without a Mission fails before creating history or external effects", async () => {
  const forbidden = async () => { throw new Error("unexpected effect"); };
  await assert.rejects(deliverAutomationSms({
    smsActionVersion: 2, to: ["+421900123456"], text: "Test", provider: "mission",
  }, { event: { countryCode: "SK" } }, {
    createMessage: forbidden, updateMessage: forbidden, send: forbidden,
  }), /verified Mission/);
});
test("sender labels and explanatory copy exist in all seven languages", () => {
  for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"] as const) {
    assert.deepEqual(Object.keys(copy[locale]).sort(), Object.keys(copy.en).sort());
    for (const text of Object.values(copy[locale])) assert.ok(text.trim());
  }
});
