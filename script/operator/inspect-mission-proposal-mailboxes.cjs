// Discovery only: a matching provider time remains a candidate until a human
// reviews historical recipient ownership and proposal/attachment purpose.
const core = require("./verify-mission-proposal-times.cjs");
const { MISSION } = require("./review-mission-proposal-emails.cjs");
function stop(code) { throw Object.assign(new Error(code), { safeCode: code }); }
async function inspectMailboxes(batch, readerFor) {
  if (batch?.rows?.length !== 38 || new Set(batch.rows.map(row => row.id)).size !== 38 ||
      new Set(batch.rows.map(row => row.clinic_id)).size !== 34 ||
      !/^[a-f0-9]{64}$/.test(batch.originalBatchFingerprint || ""))
    stop("ORIGINAL_UNASSIGNED_SCOPE_CHANGED");
  const cache = new Map(), results = [];
  let conversationsRead = 0;
  for (const row of batch.rows) {
    const base = { messageId: row.id, clinicId: row.clinic_id, userId: row.user_id,
      sourceFingerprint: core.sourceFingerprint(row), sentAt: null, status: "unknown" };
    try {
      const meta = typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata;
      if (row.campaign_id !== null || row.sent_at !== null || row.provider !== null || row.external_id !== null ||
          row.country_allowed !== true || row.contact_ids?.length !== 1 ||
          meta?.sentVia !== "ms365" || meta?.contactType !== "clinic" ||
          typeof meta.conversationId !== "string" || !meta.conversationId.trim() ||
          typeof row.content !== "string" || !row.content.trim() ||
          !Array.isArray(meta.recipientEmails) || !meta.recipientEmails.length ||
          !/^[^\s@<>,;]+@[^\s@<>,;]+$/.test(meta.from || ""))
        stop("SOURCE_CHANGED_OR_UNPROVEN");
      const reader = await readerFor(row, { mailbox: meta.from });
      const mailbox = core.address(reader.mailbox);
      if (mailbox !== core.address(meta.from) ||
          !Array.isArray(reader.allowedSenders) || !reader.allowedSenders.length)
        stop("MAILBOX_IDENTITY_MISMATCH");
      const key = `${row.user_id}:${mailbox}:${meta.conversationId}`;
      let messages = cache.get(key);
      if (!messages) {
        messages = await reader.sentConversation(meta.conversationId);
        cache.set(key, messages);
        conversationsRead++;
      }
      const matches = messages.filter(message => {
        const sender = core.address(message.sender?.emailAddress?.address);
        // Attachment hashes here describe the observed candidate; they are NOT
        // an independent expectation and do not establish proposal purpose.
        return reader.allowedSenders.map(core.address).includes(sender) &&
          core.matchMessage(row, {
            from: meta.from, sender, bodySha256: core.bodyHash(row.content),
            attachmentSha256: message.attachmentSha256,
          }, message);
      });
      if (matches.length !== 1) {
        results.push({ ...base, reason: matches.length ? "AMBIGUOUS_SENT_ITEMS" : "NO_EXACT_SENT_ITEM" });
        continue;
      }
      const candidate = matches[0];
      results.push({ ...base, reason: "HISTORICAL_IDENTITY_AND_PURPOSE_REVIEW_REQUIRED",
        candidate: { sentAt: candidate.sentDateTime, externalId: candidate.id,
          internetMessageId: candidate.internetMessageId, mailbox,
          from: core.address(meta.from), sender: core.address(candidate.sender.emailAddress.address),
          bodySha256: core.bodyHash(row.content), attachmentSha256: candidate.attachmentSha256 },
        recipientClinicOwnershipReviewed: false, purposeReviewed: false });
    } catch (error) {
      // Do not retain provider/SQL/crypto messages or potentially sensitive fields.
      results.push({ ...base, reason: /^[A-Z_]+$/.test(error?.safeCode || "")
        ? error.safeCode : "MAILBOX_INSPECTION_FAILED" });
    }
  }
  const counts = new Map();
  for (const result of results) if (result.candidate) {
    const key = result.candidate.internetMessageId;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const safeResults = results.map(result => result.candidate && counts.get(result.candidate.internetMessageId) > 1
    ? { ...result, candidate: undefined, reason: "TRANSMISSION_REUSED" } : result);
  const report = { version: 1, mode: "read_only_candidates_require_review", missionId: MISSION,
    missionAttribution: "unassigned_not_changed", checkedAt: new Date().toISOString(),
    originalBatchFingerprint: batch.originalBatchFingerprint, conversationsRead,
    results: safeResults };
  const evidenceFingerprint = core.hash(report);
  const reasons = {};
  for (const result of safeResults) reasons[result.reason] = (reasons[result.reason] || 0) + 1;
  return {
    report: { ...report, evidenceFingerprint },
    summary: { mode: report.mode, records: 38, clinics: 34, conversationsRead,
      uniqueCandidates: safeResults.filter(result => result.candidate).length,
      verified: 0, sendingTimeUnknown: 38, reasons, evidenceFingerprint, updates: 0 },
  };
}
module.exports = { inspectMailboxes };
