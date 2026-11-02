const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { MISSION, SUBJECT } = require("./review-mission-proposal-emails.cjs");
const { hash, bodyHash, sourceFingerprint, validateApproval, loadSources, graphReader, reconcile } =
  require("./verify-mission-proposal-times.cjs");
const { inspectScope, SCOPE_SQL } = require("./verify-mission-proposal-times.cjs");
const { loadUnassignedBatch } = require("./verify-mission-proposal-times.cjs");
const { SQL: ORIGINAL_SQL, fingerprint: originalFingerprint } = require("./review-mission-proposal-emails.cjs");
const addr = address => ({ emailAddress: { address } });
function fixture() {
  const row = { id: "message-1", clinic_id: "clinic-1", user_id: "agent-1", campaign_id: MISSION,
    contact_ids: ["contact-1"], reviewed: true, country_allowed: true,
    subject: SUBJECT, content: "<p>Reviewed proposal</p>", sent_at: null,
    recorded_at: "2026-09-09T01:00:00Z", status: "sent", external_id: null, provider: null,
    metadata: JSON.stringify({ contactType: "clinic", sentVia: "ms365",
      from: "shared@example.test", sharedMailbox: "shared@example.test",
      recipientEmails: ["clinic@example.test"], cc: null, conversationId: "conversation-1" }) };
  const entry = { messageId: row.id, clinicId: row.clinic_id, userId: row.user_id,
    mailbox: "shared@example.test", from: "shared@example.test", sender: "delegate@example.test",
    recipientClinicOwnershipReviewed: true, purpose: "contract_proposal",
    sourceFingerprint: sourceFingerprint(row), bodySha256: bodyHash(row.content), attachmentSha256: [] };
  const approval = { version: 1, readOnlyApproved: true, approvalRef: "approved-local-review",
    expiresAt: new Date(Date.now() + 3600000).toISOString(), entries: [entry] };
  const message = { id: "immutable-1", internetMessageId: "<transmission-1@example.test>",
    conversationId: "conversation-1", parentFolderId: "sent-folder", isDraft: false,
    sentDateTime: "2026-09-08T08:11:12Z", subject: SUBJECT,
    from: addr(entry.from), sender: addr(entry.sender), toRecipients: [addr("clinic@example.test")],
    ccRecipients: [], bccRecipients: [], body: { content: row.content }, attachmentSha256: [] };
  return { row, entry, approval, message };
}
const reader = messages => async () => ({ sentConversation: async () => messages });
test("unique sent-item proof proposes actual provider time, never recorded_at; no source mutation", async () => {
  const { row, approval, message } = fixture(), before = JSON.stringify(row);
  const plan = await reconcile([row], approval, reader([message]));
  assert.equal(plan.results[0].status, "verified");
  assert.equal(plan.results[0].sentAt, message.sentDateTime);
  assert.notEqual(plan.results[0].sentAt, row.recorded_at);
  assert.equal(JSON.stringify(row), before);
  assert.equal(plan.mode, "read_only_proposal_not_applied");
  assert.equal(plan.evidenceFingerprint.length, 64);
  assert.equal(JSON.stringify(plan).includes("clinic@example.test"), false);
  assert.equal(JSON.stringify(plan).includes(row.content), false);
});
test("conversation and subject alone, reply, draft, wrong clinic/sender and missing purpose never prove time", async () => {
  const mutations = [
    m => m.body.content = "<p>Information only</p>",
    m => m.isDraft = true, m => m.internetMessageId = null,
    m => m.toRecipients = [addr("different@example.test")],
    m => m.ccRecipients = [addr("extra@example.test")],
    m => m.bccRecipients = [addr("hidden@example.test")],
    m => m.from = addr("other@example.test"), m => m.sender = addr("other@example.test"),
    m => m.sentDateTime = null, m => m.sentDateTime = "not-a-date",
    m => m.sentDateTime = "2999-01-01T00:00:00Z",
    m => m.attachmentSha256 = [hash("different proposal")],
    m => m.conversationId = "other", m => m.subject = "other",
  ];
  for (const mutate of mutations) {
    const { row, approval, message } = fixture(); mutate(message);
    const plan = await reconcile([row], approval, reader([message]));
    assert.equal(plan.results[0].status, "unknown");
    assert.equal(plan.results[0].sentAt, null);
  }
});
test("multiple identical transmissions stay unknown even when all timestamps agree", async () => {
  const { row, approval, message } = fixture();
  const plan = await reconcile([row], approval, reader([message, { ...message, id: "immutable-2" }]));
  assert.equal(plan.results[0].reason, "AMBIGUOUS_SENT_ITEMS");
});
test("one actual transmission reused by two app records stays unknown for BOTH", async () => {
  const { row, entry, approval, message } = fixture();
  const second = { ...row, id: "message-2" };
  approval.entries.push({ ...entry, messageId: second.id, sourceFingerprint: sourceFingerprint(second) });
  const plan = await reconcile([row, second], approval, reader([message]));
  assert.ok(plan.results.every(value => value.reason === "TRANSMISSION_REUSED" && value.sentAt === null));
});
test("missing, expired or unbounded approval and missing purpose fail before any mailbox access", async () => {
  for (const mutate of [
    a => a.readOnlyApproved = false, a => a.expiresAt = "2000-01-01T00:00:00Z",
    a => a.expiresAt = new Date(Date.now() + 8 * 86400000).toISOString(),
    a => a.entries[0].recipientClinicOwnershipReviewed = false,
    a => a.entries[0].bodySha256 = null, a => a.entries.push(a.entries[0]),
  ]) {
    const { row, approval } = fixture(); mutate(approval);
    assert.throws(() => validateApproval(approval));
    await assert.rejects(reconcile([row], approval, async () => assert.fail("Graph must not run")));
  }
});
test("source drift and incorrect enrollment/provenance fail closed before Graph", async () => {
  for (const mutate of [
    r => r.content += "changed", r => r.sent_at = "2026-09-08T08:11:12Z",
    r => r.campaign_id = "other", r => r.contact_ids.push("duplicate"),
    r => r.reviewed = false, r => r.country_allowed = false,
    r => r.external_id = "existing-provider-id", r => r.user_id = "other-agent",
  ]) {
    const { row, entry, approval } = fixture(); mutate(row);
    // Test semantic checks as well as the source fingerprint.
    if (!row.content.endsWith("changed")) entry.sourceFingerprint = sourceFingerprint(row);
    await assert.rejects(reconcile([row], approval, async () => assert.fail("Graph must not run")));
  }
});
test("SQL source capture is bounded, enforced READ ONLY and always rolled back", async () => {
  const calls = [], { row } = fixture();
  const db = { query: async (sql, params) => { calls.push({ sql, params }); return { rows: sql.includes("SELECT m.id") ? [row] : [] }; } };
  assert.deepEqual(await loadSources(db, [row.id]), [row]);
  assert.match(calls[0].sql, /READ ONLY/);
  assert.equal(calls.at(-1).sql, "ROLLBACK");
  assert.equal(calls.some(({ sql }) => /^(UPDATE|INSERT|DELETE|COMMIT)/.test(sql)), false);
  await assert.rejects(loadSources(db, []));
  await assert.rejects(loadSources(db, ["missing", "other"]));
  assert.equal(calls.at(-1).sql, "ROLLBACK");
});
test("scope mismatch diagnostics report counts even for zero reviews without granting access or weakening proof", async () => {
  const calls = [];
  const counts = { missionFound: true, candidateRecords: 39, candidateClinics: 35,
    unassignedRecords: 38, boundToMission: 1, boundElsewhere: 0,
    unknownSendingTime: 39, expectedBatchReviewed: 0, otherReviewSource: 1,
    allMissionReviewedMessages: 1 };
  const db = { query: async (sql, params) => {
    calls.push({ sql, params });
    return { rows: sql === SCOPE_SQL ? [counts] : [] };
  } };
  assert.deepEqual(await inspectScope(db),
    { mode: "read_only_scope_diagnostic", ...counts, mailboxReads: 0, updates: 0 });
  assert.match(calls[0].sql, /READ ONLY/);
  assert.equal(calls.at(-1).sql, "ROLLBACK");
  assert.equal(calls.some(({ sql }) => /^(UPDATE|INSERT|DELETE|COMMIT)/.test(sql)), false);
  assert.equal(calls[2].params.length, 3);
  assert.ok(!SCOPE_SQL.includes("access_token"));
  const broken = { query: async sql => {
    if (sql === SCOPE_SQL) throw Error("query failed");
    calls.push({ sql }); return { rows: [] };
  } };
  await assert.rejects(inspectScope(broken));
  assert.equal(calls.at(-1).sql, "ROLLBACK");
});
function unassignedFixture() {
  const base = fixture();
  const rows = Array.from({ length: 38 }, (_, index) => ({
    ...base.row, id: `message-${index}`, clinic_id: `clinic-${index % 34}`,
    contact_ids: [`contact-${index % 34}`], campaign_id: null, reviewed: false,
    metadata: JSON.stringify({ ...JSON.parse(base.row.metadata), conversationId: `conversation-${index}` }),
  }));
  const original = rows.map(row => ({ ...row, country_code: "SK", country_allowed: true,
    mission_ids: [MISSION], review_id: null, conflicting_review: false }));
  const approval = { ...base.approval, sourceMode: "unassigned_batch",
    originalBatchFingerprint: originalFingerprint(original),
    entries: rows.map(row => ({ ...base.entry, messageId: row.id, clinicId: row.clinic_id,
      sourceFingerprint: sourceFingerprint(row) })) };
  return { rows, original, approval, message: base.message };
}
test("original unassigned batch is captured in one read-only snapshot without requiring or creating attribution", async () => {
  const { rows, original, approval } = unassignedFixture(), calls = [];
  const db = { query: async (sql, params) => {
    calls.push({ sql, params });
    return { rows: sql === ORIGINAL_SQL ? original : sql.includes("SELECT m.id") ? rows : [] };
  } };
  const result = await loadUnassignedBatch(db);
  assert.deepEqual(result.rows, rows);
  assert.equal(result.originalBatchFingerprint, approval.originalBatchFingerprint);
  assert.match(calls[0].sql, /READ ONLY/);
  assert.equal(calls.at(-1).sql, "ROLLBACK");
  assert.equal(calls.some(({ sql }) => /^(UPDATE|INSERT|DELETE|COMMIT)/.test(sql)), false);
  for (const mutate of [
    values => values.pop(), values => values[0].country_allowed = false,
    values => values[0].mission_ids.push("other"),
    values => values[0].contact_ids.push("duplicate"),
    values => values[0].campaign_id = MISSION,
  ]) {
    const f = unassignedFixture(); mutate(f.original);
    const broken = { query: async sql => ({ rows: sql === ORIGINAL_SQL ? f.original : [] }) };
    await assert.rejects(loadUnassignedBatch(broken), /ORIGINAL_UNASSIGNED_SCOPE_CHANGED/);
  }
});
test("verified provider times for the exact approved unassigned batch do not claim saved Mission attribution", async () => {
  const { rows, approval, message } = unassignedFixture();
  const readerFor = async row => ({ sentConversation: async conversationId => [{
    ...message, conversationId, id: `immutable-${row.id}`, internetMessageId: `<${row.id}@example.test>`,
  }] });
  const before = JSON.stringify(rows);
  await assert.rejects(reconcile(rows, approval, readerFor), /UNASSIGNED_BATCH_FINGERPRINT_CHANGED/);
  await assert.rejects(reconcile(rows, approval, readerFor, "0".repeat(64)), /UNASSIGNED_BATCH_FINGERPRINT_CHANGED/);
  const plan = await reconcile(rows, approval, readerFor, approval.originalBatchFingerprint);
  assert.equal(plan.results.length, 38);
  assert.ok(plan.results.every(value => value.status === "verified"));
  assert.equal(plan.missionAttribution, "unassigned_not_changed");
  assert.equal(JSON.stringify(rows), before);
  const partial = { ...approval, entries: approval.entries.slice(0, 37) };
  assert.throws(() => validateApproval(partial), /EXACT_UNASSIGNED_BATCH_REQUIRED/);
  const notApproved = { ...approval, sourceMode: "reviewed_mission" };
  await assert.rejects(reconcile(rows, notApproved, readerFor), /SOURCE_CHANGED_OR_UNPROVEN/);
});
function graphFixture(responses) {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    const value = responses.shift();
    if (value instanceof Error) throw value;
    return { ok: !value?.status, status: value?.status || 200, json: async () => value };
  };
  return { calls, fetcher };
}
const profile = { mail: "shared@example.test" }, folder = { id: "sent-folder" };
test("Graph follows all pages with GET only, immutable ids and exact attachment bytes", async () => {
  const { message } = fixture(), bytes = Buffer.from("attachment proof");
  const next = "https://graph.microsoft.com/v1.0/users/shared%40example.test/mailFolders/sentitems/messages?$skip=1";
  const mock = graphFixture([profile, folder,
    { value: [], "@odata.nextLink": next }, { value: [message] },
    { value: [{ "@odata.type": "#microsoft.graph.fileAttachment", isInline: false,
      size: bytes.length, contentBytes: bytes.toString("base64") }] }]);
  const result = await graphReader("SECRET_NOT_LOGGED", "shared@example.test", mock.fetcher).sentConversation("conversation-1");
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].attachmentSha256, [createHash("sha256").update(bytes).digest("hex")]);
  assert.ok(mock.calls.every(({ options }) => options.method === "GET" && options.redirect === "error"));
  assert.match(mock.calls[0].options.headers.Prefer, /ImmutableId/);
});
test("Graph retries a transport failure once but never retries a permission error", async () => {
  const transient = graphFixture([new Error("private socket detail"), profile, folder, { value: [] }]);
  assert.deepEqual(await graphReader("secret", "shared@example.test", transient.fetcher).sentConversation("thread"), []);
  assert.equal(transient.calls.length, 4);
  assert.ok(transient.calls.every(call => call.options.method === "GET"));
  const persistent = graphFixture([new Error("private"), new Error("private")]);
  await assert.rejects(graphReader("secret", "shared@example.test", persistent.fetcher).sentConversation("thread"),
    /GRAPH_NETWORK_FAILURE/);
  assert.equal(persistent.calls.length, 2);
  const denied = graphFixture([{ status: 403 }]);
  await assert.rejects(graphReader("secret", "shared@example.test", denied.fetcher).sentConversation("thread"),
    /MAILBOX_READ_ACCESS_DENIED/);
  assert.equal(denied.calls.length, 1);
});
test("wrong mailbox, wrong folder, hostile pagination, repeated pages and partial failures cannot produce a plan", async () => {
  const { message } = fixture();
  const hostile = [
    "https://evil.example/steal",
    "https://graph.microsoft.com/v1.0/users/other%40example.test/messages",
    "https://graph.microsoft.com/v1.0/users/shared%40example.test.evil/messages",
  ];
  for (const next of hostile) {
    const mock = graphFixture([profile, folder, { value: [], "@odata.nextLink": next }]);
    await assert.rejects(graphReader("secret", "shared@example.test", mock.fetcher).sentConversation("thread"), /UNSAFE_GRAPH_LINK/);
    assert.equal(mock.calls.length, 3);
  }
  for (const responses of [
    [{ mail: "wrong@example.test" }],
    [profile, folder, { value: [{ ...message, parentFolderId: "inbox" }] }],
    [profile, folder, { status: 403 }],
    [profile, folder, { status: 429 }],
    [profile, folder, new Error("sensitive provider details")],
    [profile, folder, { value: [message] }, { status: 500 }],
  ]) {
    const mock = graphFixture(responses);
    await assert.rejects(graphReader("secret", "shared@example.test", mock.fetcher).sentConversation("thread"),
      error => !error.message.includes("sensitive") && Boolean(error.safeCode));
  }
  const next = "https://graph.microsoft.com/v1.0/users/shared%40example.test/mailFolders/sentitems/messages?$skip=1";
  const mock = graphFixture([profile, folder, { value: [], "@odata.nextLink": next },
    { value: [], "@odata.nextLink": next }]);
  await assert.rejects(graphReader("secret", "shared@example.test", mock.fetcher).sentConversation("thread"), /INCOMPLETE_GRAPH_PAGINATION/);
});
test("CLI rejects unapproved/private-file violations without reading application configuration or leaking inputs", () => {
  const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
  const { spawnSync } = require("node:child_process");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "proposal-time-cli-"));
  const input = path.join(directory, "approval.json");
  const output = path.join(directory, "must-not-exist.json");
  const cli = path.resolve(__dirname, "verify-mission-proposal-times.ts");
  const tsx = path.resolve(__dirname, "../../node_modules/.bin/tsx");
  try {
    const approval = fixture().approval;
    approval.readOnlyApproved = false;
    approval.privateMarker = "PRIVATE_ADDRESS_AND_BODY_DO_NOT_PRINT";
    fs.writeFileSync(input, JSON.stringify(approval), { mode: 0o600 });
    const run = args => spawnSync(tsx, [cli, ...args], {
      cwd: directory, encoding: "utf8",
      // Deliberately no .env or application credentials; guards must precede them.
      env: { PATH: process.env.PATH, HOME: directory },
    });
    let result = run(["--verify", input, output]);
    assert.equal(result.status, 1);
    assert.equal(result.stderr.trim(), "STOP: EXPLICIT_BOUNDED_APPROVAL_REQUIRED");
    assert.equal(result.stdout, "");
    assert.equal(fs.existsSync(output), false);
    fs.chmodSync(input, 0o644);
    result = run(["--verify", input, output]);
    assert.equal(result.status, 1);
    assert.equal(result.stderr.trim(), "STOP: PRIVATE_INPUT_REQUIRED");
    fs.chmodSync(input, 0o600);
    const link = path.join(directory, "link.json");
    fs.symlinkSync(input, link);
    result = run(["--verify", link, output]);
    assert.equal(result.status, 1);
    assert.equal(result.stderr.trim(), "STOP: PRIVATE_INPUT_REQUIRED");
    result = run(["--apply", input, output]);
    assert.equal(result.status, 1);
    assert.equal(result.stderr.trim(), "STOP: USE_SNAPSHOT_OR_VERIFY_PRIVATE_INPUT_PRIVATE_OUTPUT");
    assert.equal(fs.existsSync(output), false);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
