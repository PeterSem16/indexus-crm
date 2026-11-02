const { test } = require("node:test");
const assert = require("node:assert/strict");
const { inspectMailboxes } = require("./inspect-mission-proposal-mailboxes.cjs");
const { SUBJECT } = require("./review-mission-proposal-emails.cjs");
const addr = address => ({ emailAddress: { address } });
function fixture() {
  const rows = Array.from({ length: 38 }, (_, index) => ({
    id: `message-${index}`, clinic_id: `clinic-${index % 34}`, user_id: "original-user",
    content: "<p>Purpose must still be reviewed privately</p>", subject: SUBJECT,
    contact_ids: [`contact-${index % 34}`], country_allowed: true,
    campaign_id: null, sent_at: null, provider: null, external_id: null,
    metadata: JSON.stringify({ from: "sender@example.test", sentVia: "ms365", contactType: "clinic",
      recipientEmails: ["clinic@example.test"], conversationId: `conversation-${index}` }),
  }));
  const batch = { rows, originalBatchFingerprint: "a".repeat(64) };
  const readerFor = async row => ({
    mailbox: "sender@example.test", allowedSenders: ["sender@example.test", "delegate@example.test"],
    sentConversation: async conversationId => [{
      id: `immutable-${row.id}`, internetMessageId: `<${row.id}@example.test>`, isDraft: false,
      conversationId, sentDateTime: "2026-09-08T08:11:12Z", subject: row.subject,
      from: addr("sender@example.test"), sender: addr("sender@example.test"),
      toRecipients: [addr("clinic@example.test")], ccRecipients: [], bccRecipients: [],
      body: { content: row.content }, attachmentSha256: [],
    }],
  });
  return { batch, readerFor };
}
test("inspection reads the original unassigned batch but NEVER promotes candidate times to verified evidence", async () => {
  const { batch, readerFor } = fixture(), before = JSON.stringify(batch);
  const { summary, report } = await inspectMailboxes(batch, readerFor);
  assert.equal(summary.uniqueCandidates, 38);
  assert.equal(summary.conversationsRead, 38);
  assert.equal(summary.verified, 0);
  assert.equal(summary.sendingTimeUnknown, 38);
  assert.equal(summary.updates, 0);
  assert.equal(summary.evidenceFingerprint, report.evidenceFingerprint);
  assert.ok(report.results.every(row => row.sentAt === null && row.candidate.sentAt &&
    row.recipientClinicOwnershipReviewed === false && row.purposeReviewed === false));
  assert.equal(JSON.stringify(batch), before);
  assert.ok(!JSON.stringify(summary).includes("@example.test"));
  assert.ok(!JSON.stringify(report).includes(batch.rows[0].content));
  assert.ok(!JSON.stringify(report).includes("clinic@example.test"));
});
test("wrong recipient/body/sender, multiple matches and reused transmissions remain unknown", async () => {
  for (const change of [
    messages => messages[0].toRecipients = [addr("wrong@example.test")],
    messages => messages[0].body.content = "different purpose",
    messages => messages[0].sender = addr("wrong@example.test"),
    messages => messages.push({ ...messages[0], id: "another" }),
    messages => messages[0].internetMessageId = "<same-transmission@example.test>",
  ]) {
    const { batch, readerFor } = fixture();
    const result = await inspectMailboxes(batch, async row => {
      const reader = await readerFor(row), read = reader.sentConversation;
      return { ...reader, sentConversation: async conversationId => {
        const messages = await read(conversationId); change(messages); return messages;
      } };
    });
    assert.equal(result.summary.uniqueCandidates, 0);
    assert.ok(result.report.results.every(row => row.sentAt === null && !row.candidate));
  }
});
test("read failures never leak provider errors; partial results remain unverified", async () => {
  const { batch, readerFor } = fixture();
  const result = await inspectMailboxes(batch, async row => {
    if (row.id === "message-0") throw Error("PRIVATE_TOKEN_AND_EMAIL@example.test");
    if (row.id === "message-1") throw Object.assign(Error("PRIVATE_DETAIL"), { safeCode: "MAILBOX_READ_ACCESS_DENIED" });
    return readerFor(row);
  });
  assert.equal(result.summary.uniqueCandidates, 36);
  assert.equal(result.summary.verified, 0);
  assert.equal(result.summary.reasons.MAILBOX_INSPECTION_FAILED, 1);
  assert.equal(result.summary.reasons.MAILBOX_READ_ACCESS_DENIED, 1);
  assert.ok(!JSON.stringify(result).includes("PRIVATE"));
});
test("invalid batch is rejected before any mailbox reads", async () => {
  const { batch } = fixture();
  batch.rows.pop();
  await assert.rejects(inspectMailboxes(batch, async () => assert.fail("must not read Graph")), /ORIGINAL_UNASSIGNED_SCOPE_CHANGED/);
});
test("diagnostics distinguish empty Sent Items, identity mismatch and body differences without accepting them", async () => {
  for (const [mutate, reason, expectedIdentity] of [
    [messages => messages.splice(0), "NO_SENT_ITEMS_IN_ALLOWED_MAILBOXES", 0],
    [messages => messages[0].toRecipients = [addr("different@example.test")], "SENT_ITEM_IDENTITY_OR_RECIPIENT_DIFFERENCE", 0],
    [messages => messages[0].body.content = "<html>Provider transformed HTML</html>", "EXACT_BODY_DIFFERENCE_REQUIRES_REVIEW", 38],
  ]) {
    const { batch, readerFor } = fixture();
    const result = await inspectMailboxes(batch, async row => {
      const reader = await readerFor(row), read = reader.sentConversation;
      return { ...reader, sentConversation: async conversationId => {
        const messages = await read(conversationId); mutate(messages); return messages;
      } };
    });
    assert.equal(result.summary.reasons[reason], 38);
    assert.equal(result.summary.diagnosticRecords.identityRecipientsAndTime, expectedIdentity);
    assert.equal(result.summary.uniqueCandidates, 0);
    assert.equal(result.summary.verified, 0);
    assert.ok(result.report.results.every(row => row.sentAt === null));
    if (expectedIdentity) {
      assert.equal(result.summary.bodyReviewRequired, 38);
      assert.ok(result.report.results.every(row => row.reviewCandidates.length === 1));
      assert.ok(!JSON.stringify(result.summary).includes("Provider transformed"));
    }
  }
});
test("shared From may have its sent copy in the original author's personal mailbox because sends used /me", async () => {
  const { batch, readerFor } = fixture();
  const inspected = await inspectMailboxes(batch, async row => {
    const reader = await readerFor(row);
    return { ...reader, originMailbox: "delegate@example.test", originReader: reader,
      sentConversation: async () => [] };
  });
  assert.equal(inspected.summary.uniqueCandidates, 38);
  assert.equal(inspected.summary.conversationsRead, 76);
  assert.ok(inspected.report.results.every(row => row.candidate.mailbox === "delegate@example.test"));
  assert.equal(inspected.summary.verified, 0);
  const denied = await inspectMailboxes(batch, async row => ({
    ...await readerFor(row), originMailbox: "unrelated@example.test", originReader: {},
  }));
  assert.equal(denied.summary.reasons.ORIGIN_MAILBOX_NOT_AUTHORIZED, 38);
});
