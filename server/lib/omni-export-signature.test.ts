import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { attachPersonalExportSignature, personalExportSignature } from "./omni-export-signature";
import { registerOmniSearchExport, validateExportDelivery } from "./omni-search-export";
import { createExportGraph, type ExportDelivery } from "./omni-export-graph";

test("personal signature uses the existing personal-account key and respects inactive or empty rows", async () => {
  const calls: string[] = [];
  let row: { isActive: boolean; htmlContent: string } | undefined = { isActive: true, htmlContent: "<p>Personal signature</p>" };
  const storage = {
    getEmailSignature: async (userId: string, mailbox: string) => { calls.push(`${userId}:${mailbox}`); return row; },
    getUser: async (userId: string) => { calls.push(`legacy:${userId}`); return { signature: "<p>Legacy personal signature</p>" }; },
  };
  assert.equal(await personalExportSignature(storage, "agent-a"), "<p>Personal signature</p>");
  assert.deepEqual(calls, ["agent-a:personal"]);
  row = { isActive: false, htmlContent: "<p>Disabled signature</p>" };
  assert.equal(await personalExportSignature(storage, "agent-a"), undefined);
  row = { isActive: true, htmlContent: "" };
  assert.equal(await personalExportSignature(storage, "agent-a"), "");
  assert.equal(calls.some(call => call.startsWith("legacy:")), false);
  row = undefined;
  assert.equal(await personalExportSignature(storage, "agent-b"), "<p>Legacy personal signature</p>");
  assert.equal(calls.at(-1), "legacy:agent-b");
});

test("HTML personal signature preserves formatting/images and the editable message remains escaped text", () => {
  const delivery = { to: "recipient@example.test", subject: "Export", body: '<b>Not HTML</b>\n"Text" & details', includeSignature: true };
  const signed = attachPersonalExportSignature(delivery,
    '<p style="color:#333"><strong>Personal account</strong></p><img src="data:image/png;base64,YQ==" onerror=alert(1)><script>bad()</script><a href=javascript:alert(1)>link</a>');
  assert.ok(signed.htmlBody?.includes("&lt;b&gt;Not HTML&lt;/b&gt;<br>&quot;Text&quot; &amp; details"));
  assert.ok(signed.htmlBody?.includes('<p style="color:#333"><strong>Personal account</strong></p>'));
  assert.ok(signed.htmlBody?.includes('src="data:image/png;base64,YQ=="'));
  assert.doesNotMatch(signed.htmlBody!, /<script|onerror|javascript:/i);
  assert.equal(delivery.body, '<b>Not HTML</b>\n"Text" & details');
  for (const signature of [undefined, "", " ", "<script>bad()</script>"]) {
    assert.throws(() => attachPersonalExportSignature(delivery, signature), /signature_unavailable/);
  }
});

test("export route derives signature from authenticated user and fails before downloading if it is unavailable", async () => {
  const app = express(); app.use(express.json());
  let signature: string | undefined = "<p>Stored personal signature</p>";
  let reads = 0, sends = 0;
  const signatureUsers: string[] = [];
  const sent: ExportDelivery[] = [];
  registerOmniSearchExport(app, ((req: any, _res: any, next: any) => {
    req.session = { user: { id: "authenticated-agent" } }; next();
  }) as any, {
    inventory: async () => new Set(["support@example.test"]),
    token: async () => ({ accessToken: "fixture", personalMailbox: "personal@example.test" }),
    mime: async () => { reads++; return Buffer.from("Subject: fixture\r\n\r\nMessage"); },
    signature: async userId => { signatureUsers.push(userId); return signature; },
    send: async (_token, _path, _filename, delivery) => { sends++; sent.push(delivery); },
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.on("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const call = (delivery: unknown) => fetch(`${base}/api/nexus/search-export`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      format: "eml", messages: [{ id: "message", mailbox: "support@example.test", subject: "Original" }], delivery,
    }),
  });
  const unsigned = { to: "recipient@example.test", subject: "Export", body: "Message" };
  try {
    assert.equal((await call({ ...unsigned, includeSignature: false })).status, 202);
    assert.equal(signatureUsers.length, 0);
    assert.equal(sent[0].htmlBody, undefined);
    assert.deepEqual(sent[0], unsigned);
    assert.equal((await call({ ...unsigned, includeSignature: true, userId: "other-user",
      signature: "<p>Forged</p>", htmlBody: "<p>Forged HTML</p>" })).status, 202);
    assert.deepEqual(signatureUsers, ["authenticated-agent"]);
    assert.ok(sent[1].htmlBody?.endsWith("<p>Stored personal signature</p>"));
    assert.doesNotMatch(sent[1].htmlBody!, /Forged/);
    const beforeReads = reads, beforeSends = sends;
    signature = undefined;
    const failed = await call({ ...unsigned, includeSignature: true });
    assert.equal(failed.status, 400);
    assert.deepEqual(await failed.json(), { error: "signature_unavailable" });
    assert.equal(reads, beforeReads);
    assert.equal(sends, beforeSends);
    assert.equal((await call({ ...unsigned, includeSignature: "yes" })).status, 400);
    assert.equal(reads, beforeReads);
    assert.deepEqual(validateExportDelivery({ ...unsigned, htmlBody: "<p>Ignored</p>" }), unsigned);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

test("Graph sends the prepared personal signature as HTML without changing unsigned messages", async () => {
  const directory = await mkdtemp(join(tmpdir(), "omni-signature-test-"));
  const path = join(directory, "emails.zip");
  await writeFile(path, Buffer.from("Fixture ZIP"));
  const drafts: any[] = [];
  const fakeFetch: typeof fetch = async (url, options) => {
    if (String(url).endsWith("/me/sendMail")) {
      drafts.push(JSON.parse(options!.body as string).message);
      return new Response(null, { status: 202 });
    }
    if (String(url).endsWith("/send")) return new Response(null, { status: 202 });
    return new Response(JSON.stringify({ id: "attachment" }), { status: 201, headers: { "Content-Type": "application/json" } });
  };
  try {
    const graph = createExportGraph("fixture-token", new AbortController().signal, fakeFetch);
    const unsigned = { to: "recipient@example.test", subject: "Export", body: "Message" };
    const signed = attachPersonalExportSignature({ ...unsigned, includeSignature: true }, "<p>Personal signature</p>");
    await graph.send(path, "emails.zip", signed);
    assert.deepEqual(drafts[0].body, { contentType: "HTML", content: signed.htmlBody });
    assert.equal(drafts[0].includeSignature, undefined);
    await graph.send(path, "emails.zip", unsigned);
    assert.deepEqual(drafts[1].body, { contentType: "Text", content: "Message" });
  } finally { await rm(directory, { recursive: true, force: true }); }
});
