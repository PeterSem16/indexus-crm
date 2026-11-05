import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";
import express from "express";
import XLSX from "xlsx";
import { createExportGraph } from "./omni-export-graph";
import { registerOmniSearchExport } from "./omni-search-export";

const { CFB } = XLSX;
const logo = Buffer.from([137, 80, 78, 71, 0, 255, 1]);
const spreadsheet = Buffer.from([208, 207, 17, 224, 0, 255, 2]);

// Model Graph's real base/derived-type selection rules, rather than returning
// success for every URL. No Microsoft credentials or live sends are involved.
function graphFixture() {
  const requests: URL[] = [];
  const request: typeof fetch = async input => {
    const url = new URL(String(input));
    requests.push(url);
    const path = url.pathname;
    if (path === "/v1.0/me/messages/source") return Response.json({
      subject: "Archived message",
      body: { contentType: "html", content: '<p>Original<img src="cid:signature-logo"></p>' },
      receivedDateTime: "2019-07-03T12:00:00Z",
      from: { emailAddress: { address: "sender@example.test" } },
      toRecipients: [{ emailAddress: { address: "me@example.test" } }],
    });
    if (path.endsWith("/attachments")) return Response.json({ value: [
      { id: "sheet", "@odata.type": "#microsoft.graph.fileAttachment", name: "original.xls", size: spreadsheet.length },
      { id: "logo", "@odata.type": "#microsoft.graph.fileAttachment", name: "logo.png", isInline: true, size: logo.length },
    ] });
    if (path.endsWith("/attachments/logo/$value")) return new Response(logo);
    if (path.endsWith("/attachments/sheet/$value")) return new Response(spreadsheet);
    if (path.endsWith("/attachments/logo")) {
      if (url.searchParams.get("$select") === "contentId") return Response.json({
        error: { code: "RequestBroker--ParseUri", message: "Could not find a property named 'contentId' on type 'microsoft.graph.attachment'." },
      }, { status: 400 });
      assert.equal(url.searchParams.get("$select"), "microsoft.graph.fileAttachment/contentId");
      return Response.json({ contentId: "signature-logo" });
    }
    assert.fail(`Unexpected fixture operation: ${path}`);
  };
  return { request, requests };
}

function verifyZip(zip: Buffer) {
  assert.equal(zip.readUInt32LE(), 0x04034b50);
  const compressed = zip.readUInt32LE(18), nameLength = zip.readUInt16LE(26), extraLength = zip.readUInt16LE(28);
  assert.match(zip.subarray(30, 30 + nameLength).toString(), /\.msg$/);
  const offset = 30 + nameLength + extraLength;
  const msg = inflateRawSync(zip.subarray(offset, offset + compressed));
  assert.equal(msg.subarray(0, 8).toString("hex"), "d0cf11e0a1b11ae1");
  const compound = CFB.read(msg, { type: "buffer" });
  const stream = (path: string) => {
    const entry = CFB.find(compound, path);
    assert.ok(entry, `Missing MSG stream: ${path}`);
    return Buffer.from(entry.content);
  };
  assert.deepEqual(stream("Root Entry/__attach_version1.0_#00000000/__substg1.0_37010102"), spreadsheet);
  assert.deepEqual(stream("Root Entry/__attach_version1.0_#00000001/__substg1.0_37010102"), logo);
  assert.equal(stream("Root Entry/__attach_version1.0_#00000001/__substg1.0_3712001F").toString("utf16le"), "signature-logo");
  assert.match(stream("__substg1.0_10130102").toString("utf8"), /cid:signature-logo/);
}

test("MSG with signature logo and XLS attachment downloads and prepares the same complete email ZIP", async () => {
  const fixture = graphFixture();
  // Demonstrate the provider rejection the previous permissive mocks missed.
  const rejected = await fixture.request("https://graph.microsoft.com/v1.0/me/messages/source/attachments/logo?$select=contentId");
  assert.equal(rejected.status, 400);
  const app = express(); app.use(express.json());
  let sends = 0;
  registerOmniSearchExport(app, (req: any, _res, next) => {
    req.session = { user: { id: "fixture" } }; next();
  }, {
    inventory: async () => new Set(["me@example.test"]),
    token: async () => ({ accessToken: "fixture-only", personalMailbox: "me@example.test" }),
    mime: async () => { assert.fail("MSG must not silently fall back to EML"); },
    msg: (token, message, signal) => createExportGraph(token, signal, fixture.request).message(message, "msg"),
    send: async (_token, path) => { verifyZip(await readFile(path)); sends++; },
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.on("listening", resolve));
  const endpoint = `http://127.0.0.1:${(server.address() as any).port}/api/nexus/search-export`;
  const messages = [{ id: "source", mailbox: "me@example.test", subject: "Archived message" }];
  const post = (delivery?: object) => fetch(endpoint, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ format: "msg", messages, ...(delivery ? { delivery } : {}) }),
  });
  try {
    const download = await post();
    assert.equal(download.status, 200);
    assert.match(download.headers.get("content-type")!, /application\/zip/);
    verifyZip(Buffer.from(await download.arrayBuffer()));
    assert.equal(sends, 0);
    const email = await post({ to: "recipient@example.test", subject: "Export", body: "Requested messages" });
    assert.equal(email.status, 202);
    assert.deepEqual(await email.json(), { sent: true, sender: "me@example.test" });
    assert.equal(sends, 1);
    assert.equal(fixture.requests.filter(url => url.searchParams.get("$select") === "microsoft.graph.fileAttachment/contentId").length, 2);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
