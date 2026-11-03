import { test } from "node:test";
import assert from "node:assert/strict";
import { sendWithMs365Evidence, Ms365DeliveryError } from "./ms365-send-evidence";

function fixture(options: { draftError?: boolean; sendError?: any; readError?: boolean; sent?: any } = {}) {
  const calls: Array<{ path: string; method: string; headers: Record<string, string>; body?: any }> = [];
  const client = { api(path: string) {
    const headers: Record<string, string> = {};
    return {
      header(name: string, value: string) { headers[name] = value; return this; },
      select() { return this; },
      async post(body: any) {
        calls.push({ path, method: "POST", headers, body });
        if (path.endsWith("/messages")) {
          if (options.draftError) throw { statusCode: 403 };
          return { id: "immutable/id", conversationId: "conversation" };
        }
        if (options.sendError) throw options.sendError;
      },
      async get() {
        calls.push({ path, method: "GET", headers });
        if (options.readError) throw Error("private provider error");
        return options.sent ?? { id: "immutable/id", isDraft: false,
          conversationId: "conversation", internetMessageId: "<message@example.invalid>",
          sentDateTime: "2026-01-01T10:01:02.000Z" };
      },
    };
  } };
  return { client, calls };
}
const message = { subject: "private subject", body: { content: "private body" } };
test("personal/shared origin draft uses immutable ID and actual provider sentDateTime", async () => {
  for (const input of [message, { ...message, from: { emailAddress: { address: "shared@example.invalid" } } }]) {
    const f = fixture(), result = await sendWithMs365Evidence(f.client, input);
    assert.equal(result.externalId, "immutable/id");
    assert.equal(result.sentAt, "2026-01-01T10:01:02.000Z");
    assert.equal(result.sentAtSource, "ms365_sent_datetime");
    assert.equal(result.internetMessageId, "<message@example.invalid>");
    assert.equal(result.sentItemLocation, "originating_mailbox");
    assert.equal(f.calls[0].headers.Prefer, 'IdType="ImmutableId"');
    assert.equal(f.calls[1].path, "/me/messages/immutable%2Fid/send");
    assert.equal(f.calls.filter(c => c.method === "POST").length, 2);
    assert.equal(JSON.stringify(result).includes("private body"), false);
  }
});
test("draft failure falls back exactly once and labels acceptance, never invents a provider date/ID", async () => {
  const f = fixture({ draftError: true }), result = await sendWithMs365Evidence(f.client, message);
  assert.equal(result.externalId, null);
  assert.equal(result.sentAtSource, "ms365_accepted_at");
  assert.equal(result.sentAt, result.acceptedAt);
  assert.equal(f.calls.at(-1)!.path, "/me/sendMail");
  assert.equal(f.calls.at(-1)!.body.saveToSentItems, true);
});
test("failed draft send never falls back or retransmits; uncertainty is explicit and sanitized", async () => {
  for (const sendError of [Error("private recipient/address"), { statusCode: 403 }, { statusCode: 408 }]) {
    const f = fixture({ sendError });
    await assert.rejects(sendWithMs365Evidence(f.client, message), error => {
      assert.ok(error instanceof Ms365DeliveryError);
      assert.equal(error.deliveryUncertain, (sendError as { statusCode?: number }).statusCode !== 403);
      assert.equal(error.message.includes("private"), false);
      assert.equal(error.sendEvidence?.externalId, "immutable/id");
      assert.equal(error.sendEvidence?.sentAt, undefined);
      assert.equal(Object.keys(error).includes("sendEvidence"), false);
      return true;
    });
    assert.equal(f.calls.some(c => c.path === "/me/sendMail"), false);
    assert.equal(f.calls.length, 2);
  }
});
test("explicit shared-mailbox compose retains its authorized mailbox on draft, send and receipt", async () => {
  const f = fixture();
  const result = await sendWithMs365Evidence(f.client, message, "shared@example.invalid");
  assert.ok(f.calls.every(c => c.path.startsWith("/users/shared%40example.invalid/")));
  assert.equal(result.sentItemMailbox, "shared@example.invalid");
  assert.equal(result.sentItemLocation, "shared_mailbox");
  assert.equal(result.sentAtSource, "ms365_sent_datetime");
});
test("missing/unsettled/foreign sent copy preserves acceptance without a second send", async () => {
  for (const options of [
    { readError: true }, { sent: { id: "another", isDraft: false, sentDateTime: "2026-01-01" } },
    { sent: { id: "immutable/id", isDraft: true, sentDateTime: "2026-01-01" } },
    { sent: { id: "immutable/id", isDraft: false, sentDateTime: "invalid" } },
    { sent: { id: "immutable/id", isDraft: false, sentDateTime: "2999-01-01" } },
  ]) {
    const f = fixture(options), result = await sendWithMs365Evidence(f.client, message);
    assert.equal(result.sentAtSource, "ms365_accepted_at");
    assert.equal(result.sentAt, result.acceptedAt);
    assert.equal(result.externalId, "immutable/id");
    assert.equal(f.calls.filter(c => c.method === "POST").length, 2);
  }
});
