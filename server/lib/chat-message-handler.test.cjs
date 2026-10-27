const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const source = readFileSync("server/routes.ts", "utf8");
// Execute the real handler body, rather than reproducing its implementation.
const tsBody = source.split('case "chat_message":')[1].split('case "mark_read":')[0].replace(/break;\s*$/, "")
  .replace('import("./lib/automation-communication-sources")', "Promise.resolve({ publishCommunicationServiceSource: publishChatSource })");
const compiled = require("esbuild").transformSync(`async function handle() { ${tsBody} }`, { loader: "ts" }).code;
const body = compiled.slice(compiled.indexOf("{") + 1, compiled.lastIndexOf("}"));
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const handler = new AsyncFunction("message", "userId", "user", "ws", "storage", "chatPartnerAllowed",
  "loadChatPolicy", "resolveTaskAttachments", "db", "chatMessages", "notifications",
  "taskAttachmentUploads", "inArray", "notificationService", "sendChatToUser", "publishChatSource", "enqueueChatAnalysis", body);

async function run(allowed = true, analysisFails = false) {
  const confirmations = [], delivered = [], writes = [], validated = [], sources = [], pending = [];
  const actor = { id: "sender", fullName: "Sender", isActive: true };
  const target = { id: "recipient", isActive: true };
  const tx = { insert: table => ({ values: value => ({ returning: async () => {
    writes.push({ table, value });
    return [{ id: `${table}-saved`, ...value }];
  } }) }) };
  await handler({ receiverId: target.id, content: "  First message  ", clientMessageId: "client-one", attachments: [] },
    actor.id, actor, { send: raw => confirmations.push(JSON.parse(raw)), close: () => {} },
    { getUser: async id => id === actor.id ? actor : target }, () => allowed, async () => ({}),
    async (attachments, user) => { validated.push({ attachments, user }); return attachments; },
    { transaction: async fn => fn(tx) }, "messages", "notifications", "uploads", () => {},
    { broadcastExistingNotification: async () => {} }, (id, payload) => delivered.push({ id, payload }),
    async (channel, id) => {
      sources.push({ channel, id, committedWrites: writes.length });
      if (analysisFails) throw new Error("synthetic source publisher failure");
    }, async (executor, message) => {
      assert.equal(executor, tx, "handoff must use the message transaction");
      pending.push(message.id);
    });
  await new Promise(resolve => setImmediate(resolve));
  return { confirmations, delivered, writes, validated, sources, pending };
}

test("first private message persists, confirms the draft ID and reaches only its recipient", async () => {
  const result = await run();
  assert.equal(result.validated.length, 1);
  assert.equal(result.validated[0].user.id, "sender");
  assert.equal(result.writes.length, 2);
  assert.deepEqual(result.writes[0].value, {
    senderId: "sender", receiverId: "recipient", content: "First message", isRead: false, attachments: [],
  });
  assert.equal(result.confirmations[0].type, "message_sent");
  assert.equal(result.confirmations[0].clientMessageId, "client-one");
  assert.equal(result.delivered[0].id, "recipient");
  assert.equal(result.writes[1].value.userId, "recipient");
  assert.deepEqual(result.sources, [{ channel: "chat", id: "messages-saved", committedWrites: 2 }]);
  assert.deepEqual(result.pending, ["messages-saved"]);
});

test("a forbidden colleague cannot receive or persist a message", async () => {
  const result = await run(false);
  assert.equal(result.writes.length, 0);
  assert.equal(result.delivered.length, 0);
  assert.equal(result.confirmations[0].type, "error");
  assert.equal(result.confirmations[0].clientMessageId, "client-one");
  assert.deepEqual(result.sources, []);
  assert.deepEqual(result.pending, []);
});

test("analysis publication failure never discards a committed message or its delivery", async () => {
  const result = await run(true, true);
  assert.equal(result.writes.length, 2);
  assert.equal(result.confirmations[0].type, "message_sent");
  assert.equal(result.delivered[0].id, "recipient");
  assert.equal(result.sources.length, 1);
  assert.deepEqual(result.pending, ["messages-saved"]);
});
