import assert from "node:assert/strict";
import { SystemMailboxChecks, type MailboxConnection } from "./system-mailbox-check";

async function exercise(mode: "success" | "timeout" | "denied" | "mismatch" | "changed") {
  let connection: MailboxConnection = {
    id: "test-mailbox", email: "diagnostic@example.invalid", isConnected: true,
    accessToken: "PRIVATE_TOKEN", updatedAt: new Date("2026-01-01"),
  };
  let sent: any;
  let requests: { url: string; method: string }[] = [];
  let count = 0;
  const checker = new SystemMailboxChecks({
    connection: async () => connection,
    sender: async () => mode === "mismatch" ? "old@example.invalid" : connection.email,
    token: async () => "PRIVATE_TOKEN",
    attempts: 2,
    sleep: async () => {},
    fetch: (async (url, options) => {
      const path = String(url); const method = options?.method || "GET";
      requests.push({ url: path, method });
      assert.equal(options?.redirect, "error");
      if (path.includes("/me?")) {
        if (mode === "denied") return new Response(JSON.stringify({ error: {
          code: "ErrorAccessDenied", message: "PRIVATE_PROVIDER_MESSAGE diagnostic@example.invalid PRIVATE_TOKEN",
        } }), { status: 403 });
        return Response.json({ mail: connection.email });
      }
      if (method === "POST") {
        count++;
        sent = JSON.parse(String(options?.body));
        assert.deepEqual(sent.message.toRecipients, [{ emailAddress: { address: "diagnostic@example.invalid" } }]);
        if (mode === "changed") connection = { ...connection, email: "different@example.invalid" };
        return new Response(null, { status: 202 });
      }
      assert(path.includes("/me/mailFolders/inbox/messages?"));
      return Response.json({ value: mode === "timeout" ? [] : [{
        subject: sent.message.subject,
        from: { emailAddress: { address: "diagnostic@example.invalid" } },
        toRecipients: sent.message.toRecipients,
        internetMessageHeaders: sent.message.internetMessageHeaders,
      }] });
    }) as typeof fetch,
  });
  const initial = await checker.start("SK");
  assert.equal(initial.phase, mode === "mismatch" ? "failed" : "checking");
  await assert.rejects(checker.start("SK"), e => [409, 429].includes((e as any).status));
  let result = initial;
  for (let i = 0; i < 50; i++) {
    await new Promise(resolve => setImmediate(resolve));
    result = await checker.status("SK");
    if (!["checking", "sent"].includes(result.phase)) break;
  }
  const output = JSON.stringify(result);
  assert(!output.includes("PRIVATE_")); assert(!output.includes("@"));
  if (mode === "success") {
    assert.equal(result.phase, "received"); assert.equal(result.send, "ok"); assert.equal(result.receive, "ok");
  } else if (mode === "timeout") {
    assert.equal(result.phase, "timeout"); assert.equal(result.send, "ok"); assert.equal(result.receive, "timeout");
  } else if (mode === "denied") {
    assert.equal(result.phase, "failed"); assert.equal(result.auth, "failed");
    assert.equal(result.providerCode, "ErrorAccessDenied"); assert.equal(count, 0);
  } else if (mode === "mismatch") {
    assert.equal(result.phase, "failed"); assert.equal(result.errorCode, "sender_mismatch");
    assert.equal(requests.length, 0);
  } else {
    assert.equal(result.phase, "idle"); assert.equal(count, 1); // Old mailbox result is hidden.
  }
  assert(count <= 1);
  await assert.rejects(checker.start("SK"), e => (e as any).status === 429);
  if (mode === "success") {
    connection = { ...connection, updatedAt: new Date("2026-01-02") };
    assert.equal((await checker.status("SK")).phase, "idle");
  }
}
async function main() {
  for (const mode of ["success", "timeout", "denied", "mismatch", "changed"] as const) await exercise(mode);
  console.log("System mailbox checks: send/receipt, timeout, provider redaction, mismatch, concurrency, cooldown, identity/reconnect PASSED");
}
void main().catch(e => { console.error(e); process.exitCode = 1; });
