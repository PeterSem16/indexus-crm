import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { transformSync } from "esbuild";
import * as schema from "../../shared/schema";
import { analysisConfigIssues } from "../../shared/automation-analysis";
import { taskCommunicationSourceChanged } from "../../shared/automation-task-source";
import { privateAnalysisAttachmentIds, readPrivateAnalysisAttachment } from "./automation-private-attachment";

function productionModule(path: string, overrides: Record<string, unknown>) {
  const require = createRequire(new URL(path, import.meta.url));
  const module = { exports: {} };
  const code = transformSync(readFileSync(new URL(path, import.meta.url), "utf8"), {
    loader: "ts", format: "cjs",
  }).code;
  new Function("module", "exports", "require", code)(module, module.exports, (id: string) =>
    Object.prototype.hasOwnProperty.call(overrides, id) ? overrides[id] : require(id));
  return module.exports as any;
}

test("attachment-only configurations accept chat, tasks and email, but not SMS/voice alone", () => {
  for (const channel of ["chat", "task", "email"]) assert.deepEqual(analysisConfigIssues({
    channels: [channel], analyzeContent: false, analyzeAttachments: true,
  }), []);
  for (const channel of ["sms", "voice"]) assert.ok(analysisConfigIssues({
    channels: [channel], analyzeContent: false, analyzeAttachments: true,
  }).length);
});

test("adding only an attachment to an existing task publishes a source, unrelated updates and automation loops do not", () => {
  const base = { module: "task", entityId: "task", eventType: "updated",
    oldValues: { title: "Same", attachments: [] }, newValues: { title: "Same", attachments: [{ id: "new-file" }] } };
  assert.equal(taskCommunicationSourceChanged(base), true);
  assert.equal(taskCommunicationSourceChanged({ ...base, causationRunId: "automation-run" }), false);
  assert.equal(taskCommunicationSourceChanged({ ...base, module: "communication" }), false);
  assert.equal(taskCommunicationSourceChanged({ ...base, newValues: { title: "Same", attachments: [] } }), false);
  assert.equal(taskCommunicationSourceChanged({ ...base, eventType: "created" }), true);
  assert.equal(taskCommunicationSourceChanged({ ...base, entityId: null }), false);
});

test("private reads reject URL-only references, traversal, symlinks, size lies and oversized files", async () => {
  const root = await mkdtemp(join(tmpdir(), "analysis-private-"));
  try {
    assert.deepEqual(privateAnalysisAttachmentIds([{ id: "trusted", url: "https://untrusted.invalid" }]), ["trusted"]);
    assert.throws(() => privateAnalysisAttachmentIds([{ url: "https://untrusted.invalid/file.pdf" }]));
    assert.throws(() => privateAnalysisAttachmentIds([{ id: "same" }, { id: "same" }]));
    await writeFile(join(root, "file.pdf"), "invoice");
    assert.equal((await readPrivateAnalysisAttachment(root, "file.pdf", 7)).toString(), "invoice");
    await assert.rejects(readPrivateAnalysisAttachment(root, "../file.pdf", 7));
    await assert.rejects(readPrivateAnalysisAttachment(root, "file.pdf", 8));
    await assert.rejects(readPrivateAnalysisAttachment(root, "file.pdf", 16 * 1024 * 1024));
    await symlink(join(root, "file.pdf"), join(root, "link.pdf"));
    await assert.rejects(readPrivateAnalysisAttachment(root, "link.pdf", 7));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("production resolver and analyzer read actual invoice bytes from chat, task body/comment and Graph", async () => {
  const root = await mkdtemp(join(tmpdir(), "analysis-channels-"));
  const privateRoot = join(root, "private-task-attachments");
  const bytes = Buffer.from("%PDF-1.4\nInvoice document fixture\n%%EOF");
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.OPENAI_API_KEY;
  // No external provider is called. Real source resolution, disk reads, document preparation
  // and snapshots run; only database/Graph/AI boundaries are deterministic fixtures.
  process.env.OPENAI_API_KEY = "fixture-only";
  let creatorId = "owner", allowedCountry = "SK";
  let memberships: any[] = [], missingUpload = false, unsupported = false, missingFile = false;
  let graphRequests = 0, aiDocuments = 0, snapshots = 0, emptyAttachments = false, graphDownload = false;
  const references = [{ id: "upload", name: "forged.html", type: "text/html", size: 1, url: "https://never-fetch.invalid" }];
  const rows = (table: unknown) => {
    if (table === schema.users) return [{ id: "owner", fullName: "Fixture", email: "fixture@example.invalid" }];
    if (table === schema.chatMessages) return [{ id: "chat-source", senderId: "sender", receiverId: "owner", content: "", attachments: emptyAttachments ? [] : references }];
    if (table === schema.tasks) return [{
      id: "task-source", title: "", description: "", assignedUserId: "owner", createdByUserId: "sender",
      country: allowedCountry, attachments: references, tags: ["group_id:review"],
    }];
    if (table === schema.taskComments) return [{
      id: "comment-source", taskId: "task-source", userId: "sender", content: "", metadata: { attachments: references },
    }];
    if (table === schema.taskGroupMembers) return memberships;
    if (table === schema.taskAttachmentUploads) return missingUpload ? [] : [{
      id: "upload", name: unsupported ? "unknown.exe" : "trusted-invoice.pdf",
      type: unsupported ? "application/x-executable" : "application/pdf", size: bytes.length,
      storageKey: missingFile ? "missing.pdf" : "fixture.pdf",
    }];
    if (table === schema.communicationMessages) return [{
      id: "email-source", externalId: "graph-message", direction: "inbound", type: "email", content: "",
      userId: "owner", metadata: { from: "sender@example.invalid" },
    }];
    throw new Error("Unexpected fixture table");
  };
  const db = { execute: async () => ({}), select: () => ({
    from: (table: unknown) => ({ where: async () => rows(table) }),
  }) };
  const connection = {
    query: async (sql: string) => {
      if (sql.includes("count(*)")) return { rows: [{ n: 0 }] };
      if (sql.includes("INSERT INTO task_attachment_uploads")) return { rows: [{ id: `snapshot-${++snapshots}` }] };
      return { rows: [] };
    }, release() {},
  };
  const pool = { connect: async () => connection };
  const storage = {
    getUser: async () => ({ id: creatorId, role: "user", isActive: true, assignedCountries: ["SK"] }),
    getUserMs365Connection: async () => ({ isConnected: true, accessToken: "fixture", email: "fixture@example.invalid" }),
  };
  const source = productionModule("./automation-analysis-source.ts", {
    "../db": { db }, "../storage": { storage },
    "../../shared/schema": schema,
    "../config/storage-paths": { DATA_ROOT: join(root, "data") },
    "./token-crypto": { decryptTokenSafe: (v: string) => v, encryptTokenWithMarker: (v: string) => v },
    "./ms365": { getValidAccessToken: async () => ({ accessToken: "fixture", refreshed: false }) },
    "./automation-communication-context": {
      communicationSourceContext: (channel: string, row: any) => ({
        id: row.id, channel, recipientEmail: "fixture@example.invalid", sentAt: "2026-01-01", receivedAt: "2026-01-01",
      }),
    },
  });
  class FakeOpenAI {
    responses = { create: async ({ input }: any) => {
      const file = input[1].content.find((item: any) => item.type === "input_file");
      assert.ok(file, "attachment-only sources still invoke document analysis with empty message text");
      assert.deepEqual(Buffer.from(file.file_data.split(",")[1], "base64"), bytes);
      aiDocuments++;
      return { output_text: JSON.stringify({ sentiment: "neutral", tone: "calm", summary: "Invoice",
        wantsToCancel: false, classification: "invoice" }) };
    } };
  }
  const analyzer = productionModule("./automation-analysis.ts", {
    openai: FakeOpenAI, "../db": { db, pool }, "./automation-analysis-source": source,
    "../../shared/schema": schema,
    "../config/storage-paths": { DATA_ROOT: join(root, "data") },
  });
  globalThis.fetch = (async (url: string) => {
    assert.ok(url.startsWith("https://graph.microsoft.com/"), "never fetch chat/task attachment URLs");
    graphRequests++;
    if (url.endsWith("/attachments/graph-attachment"))
      return new Response(JSON.stringify({ contentBytes: bytes.toString("base64") }), { status: 200 });
    return new Response(JSON.stringify({ value: [{
      id: "graph-attachment", name: "trusted-invoice.pdf", contentType: "application/pdf",
      size: bytes.length, ...(graphDownload ? {} : { contentBytes: bytes.toString("base64") }), isInline: false,
    }] }), { status: 200 });
  }) as typeof fetch;
  let sequence = 0;
  const run = async (channel: string, analyzeContent = false) => {
    const rule = { id: "rule", createdByUserId: "owner", trigger: { analysis: {
      channels: ["email", "chat", "task"], analyzeContent, analyzeAttachments: true,
    } } };
    const eventType = channel === "chat" ? "chat.received" : channel === "email" ? "email.received" :
      channel === "comment" ? "task.message_received" : "task.body_received";
    return analyzer.analyzeCommunication(rule, { id: `event-${++sequence}`, module: "communication",
      eventType, entityId: `${channel}-source` });
  };
  try {
    await mkdir(privateRoot, { recursive: true });
    await writeFile(join(privateRoot, "fixture.pdf"), bytes);
    for (const channel of ["chat", "task", "comment", "email"]) {
      const result = await run(channel);
      assert.equal(result.hasInvoice, true, channel);
      assert.equal(result.attachmentCount, 1, channel);
      assert.equal(result.invoiceCount, 1, channel);
      assert.equal(result.failedAttachmentCount, 0, channel);
      assert.deepEqual(result.attachmentOutcomes, [{ position: 1, result: "invoice" }]);
      assert.equal(analyzer.selectedAnalysisAttachments("invoice", result).length, 1);
      assert.equal(result.attachments[0].name, "trusted-invoice.pdf", "registry metadata beats persisted client claims");
    }
    assert.equal(graphRequests, 1, "chat/task analysis does not access mailboxes");
    graphDownload = true;
    assert.equal((await run("email")).hasInvoice, true, "Graph metadata-only listings download the original separately");
    assert.equal(graphRequests, 3);
    emptyAttachments = true;
    const empty = await run("chat");
    assert.equal(empty.attachmentCount, 0);
    assert.equal(empty.hasInvoice, false, "an empty list differs from an unreadable attachment");
    emptyAttachments = false;
    for (const channel of ["chat", "task", "comment"]) assert.equal((await run(channel, true)).hasInvoice, true);
    creatorId = "outsider";
    assert.equal(await run("chat"), null);
    assert.equal(await run("task"), null);
    assert.equal(await run("comment"), null);
    assert.equal(await run("email"), null);
    memberships = [{ groupId: "review" }];
    assert.equal((await run("task")).hasInvoice, true, "current task group membership is authorized");
    allowedCountry = "DE";
    assert.equal(await run("task"), null, "group membership never bypasses country scope");
    allowedCountry = "SK"; creatorId = "owner"; memberships = [];
    missingUpload = true;
    const absent = await run("chat");
    assert.equal(absent.hasInvoice, null);
    assert.equal(absent.failedAttachmentCount, 1);
    assert.deepEqual(absent.attachmentOutcomes, [{ position: 1, result: "unprocessed", reason: "missing" }]);
    missingUpload = false; missingFile = true;
    let failed = await run("chat");
    assert.equal(failed.hasInvoice, null, "a missing file is unknown, not a negative classification");
    assert.equal(failed.failedAttachmentCount, 1);
    assert.deepEqual(failed.attachmentOutcomes, [{ position: 1, result: "unprocessed", reason: "missing" }]);
    missingFile = false; unsupported = true;
    failed = await run("comment");
    assert.equal(failed.hasInvoice, null);
    assert.equal(failed.failedAttachmentCount, 1);
    assert.deepEqual(failed.attachmentOutcomes, [{ position: 1, result: "unprocessed", reason: "unsupported" }]);
    assert.equal(aiDocuments, snapshots, "every successfully classified original has a private snapshot");
    const saved = (await import("node:fs/promises")).readdir;
    const files = await saved(privateRoot);
    assert.deepEqual(await readFile(join(privateRoot, files.find(name => name !== "fixture.pdf")!)), bytes);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey;
    await rm(root, { recursive: true, force: true });
  }
});
