import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import express from "express";
import { createExportGraph, OmniExportGraphError } from "./omni-export-graph";
import { registerOmniSearchExport } from "./omni-search-export";

const delivery = { to: "recipient@example.test", subject: "Search results", body: "Results" };

test("small send distinguishes rejection, permissions, expired auth and uncertain delivery without retries or drafts", async () => {
  const directory = await mkdtemp(join(tmpdir(), "omni-send-failure-"));
  const path = join(directory, "emails.zip");
  await writeFile(path, "ZIP fixture");
  try {
    for (const [status, code] of [
      [401, "mailbox_disconnected"], [403, "send_permissions_required"], [400, "send_rejected"],
      [429, "send_rejected"], [408, "send_uncertain"], [500, "send_uncertain"], [0, "send_uncertain"],
    ] as const) {
      let calls = 0;
      const request: typeof fetch = async (url, options) => {
        calls++;
        assert.equal(String(url), "https://graph.microsoft.com/v1.0/me/sendMail");
        assert.equal(options?.method, "POST");
        const body = JSON.parse(options!.body as string);
        assert.equal(body.saveToSentItems, true);
        assert.equal(body.message.from, undefined);
        if (!status) throw new Error("private transport details must not escape");
        return new Response("private provider details", { status });
      };
      await assert.rejects(createExportGraph("fixture-token", new AbortController().signal, request)
        .send(path, "emails.zip", delivery), error => {
        assert.ok(error instanceof OmniExportGraphError);
        assert.equal(error.message, code); assert.equal(error.stage, "send");
        return true;
      });
      assert.equal(calls, 1);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("large send preserves uncertain drafts, cleans definite failures and never sends after a failed upload", async () => {
  const directory = await mkdtemp(join(tmpdir(), "omni-large-failure-"));
  const path = join(directory, "emails.zip");
  await writeFile(path, Buffer.alloc(3_000_100));
  try {
    for (const mode of ["draft403", "upload403", "send400", "send500", "sendNetwork", "badSession"]) {
      const calls: string[] = [];
      const request: typeof fetch = async (url, options) => {
        const address = String(url); calls.push(`${options?.method} ${address}`);
        if (options?.method === "DELETE") return new Response(null, { status: 204 });
        if (address.endsWith("/me/messages"))
          return mode === "draft403" ? new Response(null, { status: 403 }) : Response.json({ id: "draft" });
        if (address.endsWith("/createUploadSession")) return Response.json({
          uploadUrl: mode === "badSession" ? "invalid" : "https://outlook.office.com/upload/fixture",
        });
        if (options?.method === "PUT") return new Response(null, { status: mode === "upload403" ? 403 : 201 });
        if (mode === "sendNetwork") throw new Error("private network failure");
        return new Response(null, { status: mode === "send400" ? 400 : 500 });
      };
      const uncertain = mode === "send500" || mode === "sendNetwork";
      const code = uncertain ? "send_uncertain" : mode === "send400" ? "send_rejected"
        : mode === "badSession" ? "send_preparation_failed" : "send_permissions_required";
      await assert.rejects(createExportGraph("fixture-token", new AbortController().signal, request)
        .send(path, "emails.zip", delivery), new RegExp(code));
      const sends = calls.filter(call => call.endsWith("/send"));
      assert.equal(sends.length, mode.startsWith("send") ? 1 : 0);
      assert.equal(calls.some(call => call.startsWith("DELETE")), mode !== "draft403" && !uncertain);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("actual encoded JSON size selects the upload path when signature pushes a small ZIP over the request limit", async () => {
  const directory = await mkdtemp(join(tmpdir(), "omni-json-size-"));
  const path = join(directory, "emails.zip");
  await writeFile(path, Buffer.alloc(2_999_999));
  let drafts = 0, sends = 0;
  const request: typeof fetch = async (url, options) => {
    const address = String(url);
    assert.ok(!address.endsWith("/sendMail"));
    if (address.endsWith("/me/messages")) { drafts++; return Response.json({ id: "draft" }); }
    if (address.endsWith("/createUploadSession")) return Response.json({ uploadUrl: "https://outlook.office.com/upload/test" });
    if (options?.method === "PUT") return new Response(null, { status: 201 });
    if (address.endsWith("/send")) { sends++; return new Response(null, { status: 202 }); }
    return new Response(null, { status: 204 });
  };
  try {
    await createExportGraph("fixture", new AbortController().signal, request)
      .send(path, "emails.zip", { ...delivery, htmlBody: "x".repeat(20_000) });
    assert.equal(drafts, 1); assert.equal(sends, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("route exposes safe failure codes and stages, without leaking provider or customer details", async () => {
  let mode = "source";
  let sends = 0;
  const logs: string[] = [];
  const warn = console.warn;
  console.warn = (...values) => { logs.push(values.join(" ")); };
  const app = express(); app.use(express.json());
  registerOmniSearchExport(app, (req: any, _res, next) => {
    req.session = { user: { id: "test-only-user" } }; next();
  }, {
    inventory: async () => new Set(["me@example.test"]),
    token: async () => {
      if (mode === "auth") throw new Error("mailbox_disconnected");
      return { accessToken: "NEVER_LOG_TOKEN", personalMailbox: "me@example.test" };
    },
    mime: async () => {
      if (mode === "source") throw new OmniExportGraphError("source", 404);
      if (mode === "unsupported") throw new Error("unsupported_attachment");
      return Buffer.from("From: fixture@example.test\r\n\r\nFixture");
    },
    send: async () => {
      sends++;
      if (mode === "prepare") throw new OmniExportGraphError("attachment", 500);
      if (mode === "permissions") throw new OmniExportGraphError("send", 403);
      if (mode === "reject") throw new OmniExportGraphError("send", 400);
      throw new Error("NEVER_LOG_TOKEN recipient@example.test private provider body");
    },
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.on("listening", resolve));
  try {
    for (const [value, status, code] of [
      ["source", 502, "message_unavailable"], ["unsupported", 502, "unsupported_attachment"],
      ["auth", 401, "mailbox_disconnected"], ["prepare", 502, "send_preparation_failed"],
      ["permissions", 403, "send_permissions_required"], ["reject", 502, "send_rejected"],
      ["unknown", 502, "send_uncertain"],
    ] as const) {
      mode = value;
      const response = await fetch(`http://127.0.0.1:${(server.address() as any).port}/api/nexus/search-export`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "eml", messages: [{ id: "private-message-id", mailbox: "me@example.test", subject: "private subject" }], delivery }),
      });
      assert.equal(response.status, status);
      assert.deepEqual(await response.json(), { error: code });
    }
    assert.equal(sends, 4);
    assert.match(logs.join("\n"), /"stage":"source","status":404/);
    assert.match(logs.join("\n"), /"stage":"send","status":403/);
    assert.doesNotMatch(logs.join("\n"), /NEVER_LOG_TOKEN|recipient@example|private|test-only-user|me@example/);
  } finally {
    console.warn = warn;
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
