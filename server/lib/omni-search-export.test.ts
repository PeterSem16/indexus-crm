import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { inflateRawSync } from "node:zlib";
import { registerOmniSearchExport, validateExportMessages } from "./omni-search-export";
import { crc32, safeEmlName } from "./omni-eml-zip";
const mime = Buffer.from("From: sender@example.test\r\nSubject: Original\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary=abc\r\n\r\n--abc\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\nPríloha\r\n--abc\r\nContent-Type: application/octet-stream; name=\"file.bin\"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename=\"file.bin\"\r\n\r\nAAECAw==\r\n--abc--\r\n", "utf8");
test("ZIP export preserves original MIME and attachments, checks inventory, and fails atomically", async () => {
  const app = express(); app.use(express.json());
  const calls: any[] = [];
  let fail = false;
  registerOmniSearchExport(app, (req: any, res, next) => {
    if (!req.header("x-test-user")) return res.sendStatus(401);
    req.session = { user: { id: "fixture" } }; next();
  }, { inventory: async () => new Set(["me@example.test", "shared@example.test"]),
    token: async () => ({ accessToken: "test-only", personalMailbox: "me@example.test" }),
    mime: async (_, message) => { calls.push(message); if (fail && message.mailbox === "shared@example.test") throw new Error("private provider detail"); return mime; } });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.on("listening", resolve));
  const url = `http://127.0.0.1:${(server.address() as any).port}/api/nexus/search-export`;
  const messages = [{ id: "same-id", mailbox: "me@example.test", subject: "../../Žiadosť" },
    { id: "same-id", mailbox: "shared@example.test", subject: "Žiadosť" }];
  const call = (body: unknown, authorized = true) => fetch(url, { method: "POST",
    headers: { "Content-Type": "application/json", ...(authorized ? { "x-test-user": "fixture" } : {}) }, body: JSON.stringify(body) });
  try {
    assert.equal((await call({ format: "eml", messages }, false)).status, 401);
    assert.equal((await call({ format: "pdf", messages })).status, 400);
    assert.equal((await call({ format: "eml", messages: [] })).status, 400);
    assert.equal((await call({ format: "eml", messages: [{ ...messages[0], mailbox: "foreign@example.test" }] })).status, 403);
    assert.equal(calls.length, 0);
    const response = await call({ format: "eml", messages: [...messages, messages[0]] });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type")!, /application\/zip/);
    assert.match(response.headers.get("content-disposition")!, /nexus-omni-eml.zip/);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const zip = Buffer.from(await response.arrayBuffer());
    let offset = 0, count = 0;
    while (zip.readUInt32LE(offset) === 0x04034b50) {
      assert.equal(zip.readUInt16LE(offset + 6), 0x800);
      const size = zip.readUInt32LE(offset + 18), nameLength = zip.readUInt16LE(offset + 26);
      const filename = zip.subarray(offset + 30, offset + 30 + nameLength).toString("utf8");
      assert.ok(filename.endsWith(".eml")); assert.ok(!filename.split("/").some(part => part === ".." || part === "."));
      const contents = inflateRawSync(zip.subarray(offset + 30 + nameLength, offset + 30 + nameLength + size));
      assert.deepEqual(contents, mime);
      assert.equal(zip.readUInt32LE(offset + 14), crc32(contents));
      offset += 30 + nameLength + size; count++;
    }
    assert.equal(count, 2); // same Graph ID in separate mailboxes must survive
    assert.equal(zip.readUInt32LE(offset), 0x02014b50);
    assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50);
    assert.equal(zip.readUInt16LE(zip.length - 12), 2);
    assert.equal(zip.readUInt32LE(zip.length - 6), offset);
    assert.equal(calls[0].personal, true); assert.equal(calls[1].personal, false);
    fail = true;
    const failed = await call({ format: "eml", messages });
    assert.equal(failed.status, 502);
    assert.deepEqual(await failed.json(), { error: "export_failed" });
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
test("metadata validation and CRC known vector", () => {
  assert.equal(crc32(Buffer.from("123456789")), 0xcbf43926);
  assert.equal(safeEmlName("../unsafe/name\\file\r\n"), "_unsafe_name_file__");
  assert.throws(() => validateExportMessages({ format: "eml", messages: Array(10_001).fill({}) }, new Set()));
});
