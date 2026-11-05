import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { inflateRawSync } from "node:zlib";
import express from "express";
import MsgReaderModule from "msgreader";
import XLSX from "xlsx";
const { CFB } = XLSX;
import { writeOutlookMsg, type MsgMessage } from "./omni-msg";
import { createExportGraph, MAX_EMAIL_ZIP_BYTES } from "./omni-export-graph";
import { registerOmniSearchExport, validateExportDelivery } from "./omni-search-export";
import { omniSearchDateRange } from "./omni-search-dates";
import { searchEmails } from "./ms365";

const attachment = Buffer.from([0, 1, 255, 3, 0, 254]);
const html = '<p>Žiadosť — <img src="cid:picture"></p>';
const message: MsgMessage = {
  subject: "Žiadosť – dôverné", body: { contentType: "HTML", content: html }, bodyPreview: "Žiadosť",
  from: { emailAddress: { name: "Sender", address: "sender@example.test" } },
  toRecipients: [{ emailAddress: { name: "Recipient", address: "to@example.test" } }],
  ccRecipients: [{ emailAddress: { address: "cc@example.test" } }],
  receivedDateTime: "2026-11-05T12:30:00.123Z", sentDateTime: "2026-11-05T12:29:00Z", isRead: true,
};
function readMsg(bytes: Buffer) {
  const Reader = (MsgReaderModule as any).default || MsgReaderModule;
  const reader = new Reader(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  return { reader, data: reader.getFileData() };
}

test("genuine Unicode Outlook compound MSG: independent reader, HTML, recipients, exact binary attachments, MAPI property sizes", () => {
  const bytes = writeOutlookMsg(message, [
    { name: "Príloha.bin", data: attachment },
    { name: "picture.png", data: attachment, contentId: "picture", isInline: true },
  ]);
  assert.equal(bytes.subarray(0, 8).toString("hex"), "d0cf11e0a1b11ae1");
  const { reader, data } = readMsg(bytes);
  assert.equal(data.subject, message.subject);
  assert.equal(data.senderEmail, "sender@example.test");
  assert.equal(data.body, "Žiadosť");
  assert.equal(Buffer.from(data.bodyHtml).toString(), html);
  assert.deepEqual(data.recipients.map((r: any) => r.email), ["to@example.test", "cc@example.test"]);
  assert.deepEqual(Buffer.from(reader.getAttachment(0).content), attachment);
  assert.equal(reader.getAttachment(0).fileName, "Príloha.bin");
  const ole = CFB.read(bytes, { type: "buffer" });
  assert.equal(ole.FileIndex[0].clsid.toLowerCase(), "0b0d020000000000c000000000000046");
  const props = Buffer.from(CFB.find(ole, "__properties_version1.0").content);
  assert.equal(props.readUInt32LE(16), 2); assert.equal(props.readUInt32LE(20), 2);
  for (let position = 32; position < props.length; position += 16) {
    const tag = props.readUInt32LE(position), type = tag & 0xffff;
    if (type !== 0x001f && type !== 0x0102) continue;
    const stream = CFB.find(ole, `__substg1.0_${tag.toString(16).padStart(8, "0").toUpperCase()}`);
    assert.equal(props.readUInt32LE(position + 8), stream.size + (type === 0x001f ? 2 : 0));
    if (type === 0x001f) { assert.ok(stream.size > 0); assert.notEqual(Buffer.from(stream.content).readUInt16LE(stream.size - 2), 0); }
  }
});

test("date range includes the whole last day, uses Bratislava DST, rejects invalid or reversed dates", () => {
  assert.deepEqual(omniSearchDateRange("2026-11-05", "2026-11-05"),
    { start: "2026-11-04T23:00:00.000Z", end: "2026-11-05T23:00:00.000Z" });
  const spring = omniSearchDateRange("2026-03-29", "2026-03-29");
  assert.equal(Date.parse(spring.end!) - Date.parse(spring.start!), 23 * 3600_000);
  const autumn = omniSearchDateRange("2026-10-25", "2026-10-25");
  assert.equal(Date.parse(autumn.end!) - Date.parse(autumn.start!), 25 * 3600_000);
  assert.equal(omniSearchDateRange(undefined, "2026-12-31").end, "2026-12-31T23:00:00.000Z");
  for (const value of ["no date", "2026-02-30", "2026-13-01", ["2026-11-01"]]) assert.throws(() => omniSearchDateRange(value));
  assert.throws(() => omniSearchDateRange("2026-11-06", "2026-11-05"));
});

test("Graph search receives dates before pagination; date-only uses exclusive OData end and text search uses KQL", async () => {
  const saved = globalThis.fetch;
  const requests: URL[] = [];
  globalThis.fetch = (async (input: any) => {
    requests.push(new URL(typeof input === "string" ? input : input.url || String(input)));
    return new Response(JSON.stringify({ value: [
      { id: "last-fraction", receivedDateTime: "2026-11-05T22:59:59.999Z" },
      { id: "outside", receivedDateTime: "2026-11-05T23:00:00.000Z" },
    ] }), { headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  try {
    const result = await searchEmails("test-only", "invoice", undefined, 50, "2026-11-05", "2026-11-05", true);
    assert.deepEqual(result.emails.map(e => e.id), ["last-fraction"]);
    assert.match(requests[0].searchParams.get("$search")!, /received>=2026-11-04T23:00:00.000Z/);
    assert.match(requests[0].searchParams.get("$search")!, /received<2026-11-05T23:00:00.000Z/);
    await searchEmails("test-only", "", undefined, 50, undefined, "2026-11-05");
    assert.match(requests[1].searchParams.get("$filter")!, /receivedDateTime lt 2026-11-05T23:00:00.000Z/);
  } finally { globalThis.fetch = saved; }
});

test("Graph MSG reader fetches every attachment page, uses correct mailbox and preserves file/inline/embedded contents", async () => {
  const calls: string[] = [];
  const request = (async (url: any) => {
    const path = new URL(String(url)).pathname;
    calls.push(String(url));
    if (path.endsWith("/attachments/a/$value")) return new Response(attachment);
    if (path.endsWith("/attachments/b/$value")) return new Response("From: embedded@example.test\r\n\r\nOriginal");
    if (path.endsWith("/attachments/c/$value")) return new Response(attachment);
    if (path.endsWith("/attachments/b")) return Response.json({ item: { "@odata.type": "#microsoft.graph.message" } });
    if (path.endsWith("/attachments/c")) return Response.json({ contentId: "picture" });
    if (String(url).includes("page=2")) return Response.json({ value: [
      { id: "b", "@odata.type": "#microsoft.graph.itemAttachment", name: "forwarded" },
      { id: "c", "@odata.type": "#microsoft.graph.fileAttachment", name: "inline.png", isInline: true },
    ] });
    if (path.endsWith("/attachments")) return Response.json({ value: [
      { id: "a", "@odata.type": "#microsoft.graph.fileAttachment", name: "Príloha.bin" },
    ], "@odata.nextLink": "https://graph.microsoft.com/v1.0/users/shared%40example.test/messages/id/attachments?page=2" });
    return Response.json(message);
  }) as typeof fetch;
  const bytes = await createExportGraph("test-only", new AbortController().signal, request)
    .message({ id: "id", mailbox: "shared@example.test", subject: "", personal: false }, "msg");
  const { reader, data } = readMsg(bytes);
  assert.equal(data.attachments.length, 3);
  assert.deepEqual(Buffer.from(reader.getAttachment(0).content), attachment);
  assert.equal(reader.getAttachment(1).fileName, "forwarded.eml");
  assert.equal(Buffer.from(reader.getAttachment(1).content).toString(), "From: embedded@example.test\r\n\r\nOriginal");
  assert.ok(calls.every(url => url.includes("/users/shared%40example.test/messages/id")));
  const ole = CFB.read(bytes, { type: "buffer" });
  assert.equal(Buffer.from(CFB.find(ole, "Root Entry/__attach_version1.0_#00000002/__substg1.0_3712001F").content).toString("utf16le"), "picture");
});

test("small email ZIP uses personal sendMail with exact bytes and no draft permission; rejection never succeeds", async () => {
  const dir = await mkdtemp(join(tmpdir(), "omni-send-test-")), path = join(dir, "test.zip");
  await writeFile(path, attachment);
  const calls: any[] = [];
  let rejectAttachment = false;
  const request = (async (url: any, options: any) => {
    calls.push({ url: String(url), method: options?.method, body: options?.body });
    if (String(url).endsWith("/me/sendMail")) {
      if (rejectAttachment) return new Response("private vendor error", { status: 500 });
      assert.deepEqual(Buffer.from(JSON.parse(options.body).message.attachments[0].contentBytes, "base64"), attachment);
      return new Response(null, { status: 202 });
    }
    if (options.method === "DELETE") return new Response(null, { status: 204 });
    if (String(url).endsWith("/send")) return new Response(null, { status: 202 });
    return Response.json({ id: "draft" }, { status: 201 });
  }) as typeof fetch;
  try {
    const graph = createExportGraph("test-only", new AbortController().signal, request);
    await graph.send(path, "nexus-omni-msg.zip", { to: "recipient@example.test", subject: "Export", body: "Requested messages" });
    assert.ok(calls.every(call => call.url === "https://graph.microsoft.com/v1.0/me/sendMail"));
    assert.equal(calls.length, 1);
    const payload = JSON.parse(calls[0].body).message;
    assert.equal(payload.from, undefined);
    assert.deepEqual(payload.toRecipients, [{ emailAddress: { address: "recipient@example.test" } }]);
    assert.equal(payload.body.contentType, "Text");
    rejectAttachment = true; calls.length = 0;
    await assert.rejects(graph.send(path, "a.zip", { to: "a@example.test", subject: "a", body: "" }));
    assert.equal(calls.some(call => call.url.endsWith("/send")), false);
    assert.equal(calls.length, 1, "never automatically retry an uncertain send");
    // No network operation when the ZIP exceeds the email-specific size limit.
    const file = await import("node:fs/promises").then(fs => fs.open(path, "w"));
    await file.truncate(MAX_EMAIL_ZIP_BYTES + 1); await file.close(); calls.length = 0;
    await assert.rejects(graph.send(path, "a.zip", { to: "a@example.test", subject: "a", body: "" }), /email_export_limit/);
    assert.equal(calls.length, 0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("large email attachment uploads bounded byte ranges without forwarding Graph authorization to the upload URL", async () => {
  const dir = await mkdtemp(join(tmpdir(), "omni-upload-test-")), path = join(dir, "large.zip");
  const bytes = Buffer.alloc(7_000_123, 0x5a);
  await writeFile(path, bytes);
  const chunks: Buffer[] = [], ranges: string[] = [];
  const request = (async (url: any, options: any) => {
    if (options.method === "PUT") {
      assert.equal(options.headers.Authorization, undefined);
      chunks.push(Buffer.from(options.body)); ranges.push(options.headers["Content-Range"]);
      return new Response(chunks.reduce((total, chunk) => total + chunk.length, 0) === bytes.length ? null : "{}",
        { status: chunks.reduce((total, chunk) => total + chunk.length, 0) === bytes.length ? 201 : 200 });
    }
    if (String(url).endsWith("createUploadSession")) return Response.json({ uploadUrl: "https://outlook.office.com/upload/test" });
    if (String(url).endsWith("/send")) return new Response(null, { status: 202 });
    return Response.json({ id: "draft" });
  }) as typeof fetch;
  try {
    await createExportGraph("test-only", new AbortController().signal, request)
      .send(path, "a.zip", { to: "a@example.test", subject: "a", body: "" });
    assert.equal(chunks.length, 3);
    assert.ok(chunks.every(chunk => chunk.length <= 3_276_800));
    assert.deepEqual(Buffer.concat(chunks), bytes);
    assert.equal(ranges[0], "bytes 0-3276799/7000123");
    assert.equal(ranges[2], "bytes 6553600-7000122/7000123");
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("export route validates delivery before downloads, serializes work, returns MSG and sends ZIP only after every message succeeds", async () => {
  for (const value of [null, {}, { to: "a@example.test\r\nBcc:b@example.test", subject: "a", body: "" },
    { to: "a@example.test", subject: "a\r\nb", body: "" }]) assert.throws(() => validateExportDelivery(value));
  const app = express(); app.use(express.json());
  let sent = 0, mimeCalls = 0, fail = false, personalMailbox: string | undefined = "me@example.test", zipPath = "";
  const deps = { inventory: async () => new Set(["me@example.test", "shared@example.test"]),
    token: async () => ({ accessToken: "test-only", personalMailbox }),
    mime: async () => { mimeCalls++; return attachment; },
    msg: async (_: string, msg: any) => { if (fail && !msg.personal) throw new Error("private vendor error"); return writeOutlookMsg(message, []); },
    send: async (_: string, path: string) => { sent++; zipPath = path; assert.equal((await readFile(path)).readUInt32LE(), 0x04034b50); } };
  registerOmniSearchExport(app, (req: any, _res, next) => { req.session = { user: { id: "fixture" } }; next(); }, deps);
  const server = app.listen(0, "127.0.0.1"); await new Promise<void>(resolve => server.on("listening", resolve));
  const url = `http://127.0.0.1:${(server.address() as any).port}/api/nexus/search-export`;
  const messages = [{ id: "a", mailbox: "me@example.test", subject: "A" }, { id: "b", mailbox: "shared@example.test", subject: "B" }];
  const delivery = { to: "a@example.test", subject: "Export", body: "Messages" };
  const call = (body: unknown) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  try {
    assert.equal((await call({ format: "msg", messages, delivery: {} })).status, 400);
    assert.equal(mimeCalls, 0); assert.equal(sent, 0);
    const result = await call({ format: "msg", messages, delivery });
    assert.equal(result.status, 202);
    assert.deepEqual(await result.json(), { sent: true, sender: "me@example.test" });
    assert.equal(sent, 1);
    await new Promise(resolve => setTimeout(resolve, 10));
    await assert.rejects(access(zipPath));
    const download = await call({ format: "msg", messages });
    assert.equal(download.status, 200); assert.match(download.headers.get("content-disposition")!, /nexus-omni-msg.zip/);
    const zip = Buffer.from(await download.arrayBuffer()), compressedSize = zip.readUInt32LE(18), nameLength = zip.readUInt16LE(26);
    assert.match(zip.subarray(30, 30 + nameLength).toString(), /\.msg$/);
    assert.equal(readMsg(inflateRawSync(zip.subarray(30 + nameLength, 30 + nameLength + compressedSize))).data.subject, message.subject);
    await new Promise(resolve => setTimeout(resolve, 10));
    fail = true;
    assert.equal((await call({ format: "msg", messages, delivery })).status, 502); assert.equal(sent, 1);
    personalMailbox = undefined;
    assert.equal((await call({ format: "eml", messages, delivery })).status, 403); assert.equal(sent, 1);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
