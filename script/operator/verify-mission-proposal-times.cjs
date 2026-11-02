// Pure/read-only reconciliation. No send, token refresh or database write path.
const { createHash } = require("node:crypto");
const { MISSION, SUBJECT, SOURCE, SQL: ORIGINAL_SQL, validate: validateOriginal,
  fingerprint: originalFingerprint } = require("./review-mission-proposal-emails.cjs");
const hash = value => createHash("sha256").update(typeof value === "string" || Buffer.isBuffer(value)
  ? value : JSON.stringify(value)).digest("hex");
const address = value => typeof value === "string" ? value.trim().toLowerCase() : "";
const isAddress = value => /^[^\s@<>,;]+@[^\s@<>,;]+$/.test(value || "");
const bodyHash = value => hash(value.replace(/\r\n/g, "\n"));
const sourceFingerprint = row => hash(row);
const fail = code => { throw Object.assign(new Error(code), { safeCode: code }); };
function metadata(row) {
  try { return typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata; }
  catch { fail("INVALID_SOURCE_METADATA"); }
}
function addresses(values) {
  if (!Array.isArray(values) || values.some(value => !isAddress(value))) return null;
  return values.map(address).sort();
}
const same = (a, b) => a !== null && b !== null && JSON.stringify(a) === JSON.stringify(b);
const graphAddresses = values => addresses(Array.isArray(values)
  ? values.map(value => value?.emailAddress?.address) : null);
function validateApproval(approval, now = Date.now()) {
  if (approval?.version !== 1 || approval?.readOnlyApproved !== true ||
      !/^[A-Za-z0-9_-]{3,100}$/.test(approval?.approvalRef || "") ||
      !Number.isFinite(Date.parse(approval?.expiresAt)) || Date.parse(approval.expiresAt) <= now ||
      Date.parse(approval.expiresAt) > now + 7 * 86400000 ||
      !Array.isArray(approval?.entries) || !approval.entries.length || approval.entries.length > 38 ||
      new Set(approval.entries.map(entry => entry.messageId)).size !== approval.entries.length)
    fail("EXPLICIT_BOUNDED_APPROVAL_REQUIRED");
  if (approval.sourceMode != null && !["reviewed_mission", "unassigned_batch"].includes(approval.sourceMode))
    fail("INVALID_SOURCE_MODE");
  if (approval.sourceMode === "unassigned_batch" &&
      (approval.entries.length !== 38 || !/^[a-f0-9]{64}$/.test(approval.originalBatchFingerprint || "")))
    fail("EXACT_UNASSIGNED_BATCH_REQUIRED");
  for (const entry of approval.entries) {
    if (!entry.messageId || !entry.clinicId || !entry.userId ||
        !isAddress(entry.mailbox) || !isAddress(entry.sender) || !isAddress(entry.from) ||
        entry.recipientClinicOwnershipReviewed !== true || entry.purpose !== "contract_proposal" ||
        !/^[a-f0-9]{64}$/.test(entry.sourceFingerprint || "") ||
        !Array.isArray(entry.attachmentSha256) ||
        entry.attachmentSha256.some(value => !/^[a-f0-9]{64}$/.test(value)) ||
        // A separate review must establish the purpose, not just repeat the subject.
        (entry.bodySha256 != null && !/^[a-f0-9]{64}$/.test(entry.bodySha256)) ||
        (!entry.bodySha256 && !entry.attachmentSha256.length))
      fail("INCOMPLETE_IDENTITY_OR_PURPOSE_REVIEW");
  }
}
function validateSource(row, entry, unassignedBatch = false) {
  const meta = metadata(row);
  const attributionValid = unassignedBatch
    ? row.campaign_id === null && row.reviewed === false
    : row.campaign_id === MISSION && row.reviewed === true;
  if (sourceFingerprint(row) !== entry.sourceFingerprint || row.id !== entry.messageId ||
      row.clinic_id !== entry.clinicId || row.user_id !== entry.userId ||
      !attributionValid || row.contact_ids?.length !== 1 ||
      row.country_allowed !== true || row.sent_at !== null ||
      row.external_id !== null || row.provider !== null || row.subject !== SUBJECT ||
      !["sent", "delivered", "read"].includes(row.status) ||
      meta?.sentVia !== "ms365" || meta.contactType !== "clinic" ||
      typeof meta.conversationId !== "string" || !meta.conversationId.trim() ||
      address(meta.from) !== address(entry.from) || !addresses(meta.recipientEmails)?.length ||
      (entry.bodySha256 && bodyHash(row.content) !== entry.bodySha256))
    fail("SOURCE_CHANGED_OR_UNPROVEN");
  // Historical shared-sender identity is mandatory. Do not substitute a country's
  // current system mailbox or infer it from the subject.
  if (meta.sharedMailbox && address(meta.sharedMailbox) !== address(entry.from))
    fail("SHARED_SENDER_CONFLICT");
  return meta;
}
const SQL = `
 SELECT m.id,m.customer_id AS clinic_id,m.user_id,m.campaign_id,m.subject,m.content,
   m.status,m.provider,m.external_id,m.metadata,
   to_char(m.sent_at,'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS sent_at,
   to_char(m.created_at,'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS recorded_at,
   c.country_code=ANY(mission.country_codes) AS country_allowed,
   ARRAY(SELECT cc.id FROM campaign_contacts cc WHERE cc.clinic_id=c.id
     AND cc.contact_type='clinic' AND cc.campaign_id=$2 ORDER BY cc.id) AS contact_ids,
   EXISTS(SELECT 1 FROM campaign_contact_history h JOIN campaign_contacts cc
     ON cc.id=h.campaign_contact_id
     WHERE cc.campaign_id=$2 AND cc.clinic_id=c.id AND cc.contact_type='clinic'
       AND h.action='mission_email_attribution' AND h.metadata->>'messageId'=m.id
       AND h.metadata->>'purpose'='contract_proposal'
       AND h.metadata->>'reviewSource'=$3) AS reviewed
 FROM communication_messages m JOIN clinics c ON c.id=m.customer_id
 JOIN campaigns mission ON mission.id=$2
 WHERE m.id=ANY($1::text[]) AND m.type='email' AND m.direction='outbound'
 ORDER BY m.id`;
async function loadSources(client, ids) {
  if (!Array.isArray(ids) || !ids.length || ids.length > 38 || new Set(ids).size !== ids.length)
    fail("INVALID_MESSAGE_SCOPE");
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await client.query("SET LOCAL statement_timeout='20s'");
    const { rows } = await client.query(SQL, [ids, MISSION, SOURCE]);
    if (rows.length !== ids.length) fail("SOURCE_SCOPE_MISSING");
    return rows;
  } finally { await client.query("ROLLBACK"); }
}
async function loadUnassignedBatch(client) {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await client.query("SET LOCAL statement_timeout='20s'");
    // Use the original batch's complete safety checks, not the broader subject
    // diagnostic. No attribution INSERT/UPDATE or artificial review is needed.
    const original = await client.query(ORIGINAL_SQL, [MISSION, null, SUBJECT, SOURCE]);
    try { validateOriginal(original.rows); } catch { fail("ORIGINAL_UNASSIGNED_SCOPE_CHANGED"); }
    if (original.rows.some(row => row.campaign_id !== null || row.review_id !== null))
      fail("ORIGINAL_UNASSIGNED_SCOPE_CHANGED");
    const ids = original.rows.map(row => row.id);
    const { rows } = await client.query(SQL, [ids, MISSION, SOURCE]);
    if (rows.length !== 38 || new Set(rows.map(row => row.id)).size !== 38 ||
        rows.some(row => !ids.includes(row.id) || row.campaign_id !== null || row.reviewed !== false))
      fail("ORIGINAL_UNASSIGNED_SCOPE_CHANGED");
    return { rows, originalBatchFingerprint: originalFingerprint(original.rows) };
  } finally { await client.query("ROLLBACK"); }
}
// Diagnostic counts only. A subject match is a search candidate, never approval
// or evidence. This must not relax validateSource when a cohort is unexpected.
const SCOPE_SQL = `
 WITH reviews AS (
   SELECT DISTINCT h.metadata->>'messageId' AS message_id,cc.clinic_id,
     h.metadata->>'reviewSource'=$3 AS expected_source
   FROM campaign_contact_history h
   JOIN campaign_contacts cc ON cc.id=h.campaign_contact_id
   WHERE cc.campaign_id=$1 AND cc.contact_type='clinic'
     AND h.action='mission_email_attribution'
     AND h.metadata->>'purpose'='contract_proposal'
 ), candidates AS (
   SELECT m.id,m.customer_id,m.campaign_id,m.sent_at,
     EXISTS(SELECT 1 FROM reviews r WHERE r.message_id=m.id
       AND r.clinic_id=m.customer_id AND r.expected_source=true) AS expected_review,
     EXISTS(SELECT 1 FROM reviews r WHERE r.message_id=m.id
       AND r.clinic_id=m.customer_id) AS any_review
   FROM communication_messages m
   WHERE m.type='email' AND m.direction='outbound'
     AND m.status IN ('sent','delivered','read') AND m.subject=$2
     AND EXISTS(SELECT 1 FROM campaign_contacts cc WHERE cc.campaign_id=$1
       AND cc.clinic_id=m.customer_id AND cc.contact_type='clinic')
 )
 SELECT EXISTS(SELECT 1 FROM campaigns WHERE id=$1) AS "missionFound",
   count(*)::int AS "candidateRecords",
   count(DISTINCT customer_id)::int AS "candidateClinics",
   count(*) FILTER(WHERE campaign_id IS NULL)::int AS "unassignedRecords",
   count(*) FILTER(WHERE campaign_id=$1)::int AS "boundToMission",
   count(*) FILTER(WHERE campaign_id IS NOT NULL AND campaign_id<>$1)::int AS "boundElsewhere",
   count(*) FILTER(WHERE sent_at IS NULL)::int AS "unknownSendingTime",
   count(*) FILTER(WHERE expected_review)::int AS "expectedBatchReviewed",
   count(*) FILTER(WHERE any_review AND NOT expected_review)::int AS "otherReviewSource",
   (SELECT count(DISTINCT message_id)::int FROM reviews) AS "allMissionReviewedMessages"
 FROM candidates`;
async function inspectScope(client) {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await client.query("SET LOCAL statement_timeout='20s'");
    const result = await client.query(SCOPE_SQL, [MISSION, SUBJECT, SOURCE]);
    if (result.rows.length !== 1) fail("INVALID_SCOPE_SUMMARY");
    return { mode: "read_only_scope_diagnostic", ...result.rows[0], mailboxReads: 0, updates: 0 };
  } finally { await client.query("ROLLBACK"); }
}
// All URLs, including pagination, are constrained to this mailbox resource.
// Never forward bearer credentials to a nextLink on another host/path.
function graphReader(token, mailbox, fetcher = fetch) {
  const base = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(address(mailbox))}`;
  async function get(path) {
    if (typeof path !== "string") fail("UNSAFE_GRAPH_LINK");
    const url = path.startsWith("https:") ? path : base + path;
    const parsed = new URL(url);
    if (parsed.origin !== "https://graph.microsoft.com" ||
        !(parsed.pathname === new URL(base).pathname || parsed.pathname.startsWith(new URL(base).pathname + "/")) ||
        parsed.username || parsed.password || parsed.hash)
      fail("UNSAFE_GRAPH_LINK");
    let response;
    // A single retry for a transport failure only. Never retry sends, refresh
    // tokens, or interpret an incomplete read as an empty conversation.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        response = await fetcher(url, { method: "GET", redirect: "error",
          headers: { Authorization: `Bearer ${token}`, Prefer: 'IdType="ImmutableId", outlook.body-content-type="html"' },
          signal: AbortSignal.timeout(30000) });
        break;
      } catch { if (attempt === 1) fail("GRAPH_NETWORK_FAILURE"); }
    }
    if (!response.ok) {
      if (response.status === 401) fail("MAILBOX_RECONNECT_REQUIRED");
      if (response.status === 403) fail("MAILBOX_READ_ACCESS_DENIED");
      if (response.status === 429) fail("GRAPH_RATE_LIMITED_RETRY_LATER");
      fail("GRAPH_READ_FAILED");
    }
    // Provider errors and bodies must never reach operator logs.
    try {
      const data = await response.json();
      if (!data || typeof data !== "object" || Array.isArray(data)) fail("INVALID_GRAPH_RESPONSE");
      return data;
    } catch { fail("INVALID_GRAPH_RESPONSE"); }
  }
  async function list(path) {
    const values = [], seen = new Set();
    for (let page = 0; path; page++) {
      if (page >= 20 || seen.has(path)) fail("INCOMPLETE_GRAPH_PAGINATION");
      seen.add(path);
      const result = await get(path);
      if (!Array.isArray(result.value)) fail("INVALID_GRAPH_RESPONSE");
      values.push(...result.value);
      path = result["@odata.nextLink"];
    }
    return values;
  }
  return {
    async sentConversation(conversationId) {
      const identity = await get("?$select=id,mail,userPrincipalName");
      if (![identity.mail, identity.userPrincipalName].some(value => address(value) === address(mailbox)))
        fail("MAILBOX_IDENTITY_MISMATCH");
      const folder = await get("/mailFolders/sentitems?$select=id");
      if (!folder.id) fail("SENT_FOLDER_MISSING");
      const query = new URLSearchParams({
        "$filter": `conversationId eq '${conversationId.replace(/'/g, "''")}'`,
        "$select": "id,internetMessageId,conversationId,parentFolderId,isDraft,sentDateTime,from,sender,toRecipients,ccRecipients,bccRecipients,subject,body",
        "$top": "100",
      });
      const messages = await list(`/mailFolders/sentitems/messages?${query}`);
      if (messages.some(message => !message.id || message.parentFolderId !== folder.id) ||
          new Set(messages.map(message => message.id)).size !== messages.length)
        fail("INCONSISTENT_SENT_ITEMS");
      for (const message of messages) {
        const attachments = await list(`/messages/${encodeURIComponent(message.id)}/attachments`);
        message.attachmentSha256 = [];
        for (const attachment of attachments) {
          if (attachment.isInline === true) continue;
          if (attachment["@odata.type"] !== "#microsoft.graph.fileAttachment" ||
              attachment.isInline !== false ||
              typeof attachment.contentBytes !== "string" || attachment.size > 15 * 1024 * 1024 ||
              attachment.contentBytes.length > 21 * 1024 * 1024 ||
              !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(attachment.contentBytes))
            fail("UNSUPPORTED_ATTACHMENT_EVIDENCE");
          message.attachmentSha256.push(hash(Buffer.from(attachment.contentBytes, "base64")));
        }
        message.attachmentSha256.sort();
      }
      return messages;
    },
  };
}
function matchMessage(row, entry, message) {
  const meta = metadata(row);
  const cc = meta.cc ? String(meta.cc).split(",").map(value => value.trim()) : [];
  return message.isDraft === false && Boolean(message.id) && Boolean(message.internetMessageId) &&
    message.conversationId === meta.conversationId && message.subject === row.subject &&
    typeof message.sentDateTime === "string" &&
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(message.sentDateTime) &&
    Number.isFinite(Date.parse(message.sentDateTime)) &&
    Date.parse(message.sentDateTime) <= Date.now() &&
    address(message.from?.emailAddress?.address) === address(entry.from) &&
    address(message.sender?.emailAddress?.address) === address(entry.sender) &&
    same(graphAddresses(message.toRecipients), addresses(meta.recipientEmails)) &&
    same(graphAddresses(message.ccRecipients), addresses(cc)) &&
    same(graphAddresses(message.bccRecipients), []) &&
    same(message.attachmentSha256, [...entry.attachmentSha256].sort()) &&
    (!entry.bodySha256 || (typeof message.body?.content === "string" &&
      bodyHash(message.body.content) === entry.bodySha256));
}
async function reconcile(rows, approval, readerFor, originalBatchFingerprint) {
  validateApproval(approval);
  const unassigned = approval.sourceMode === "unassigned_batch";
  if (unassigned && approval.originalBatchFingerprint !== originalBatchFingerprint)
    fail("UNASSIGNED_BATCH_FINGERPRINT_CHANGED");
  if (rows.length !== approval.entries.length || new Set(rows.map(row => row.id)).size !== rows.length)
    fail("SOURCE_SCOPE_MISMATCH");
  const results = [];
  for (const entry of approval.entries) {
    const row = rows.find(value => value.id === entry.messageId);
    if (!row) fail("SOURCE_SCOPE_MISSING");
    const meta = validateSource(row, entry, unassigned);
    const messages = await (await readerFor(row, entry)).sentConversation(meta.conversationId);
    const matches = messages.filter(message => matchMessage(row, entry, message));
    results.push(matches.length !== 1
      ? { messageId: row.id, status: "unknown", reason: matches.length ? "AMBIGUOUS_SENT_ITEMS" : "NO_EXACT_SENT_ITEM", sentAt: null }
      : { messageId: row.id, clinicId: row.clinic_id, contactId: row.contact_ids[0],
        status: "verified", sentAt: matches[0].sentDateTime, externalId: matches[0].id,
        internetMessageId: matches[0].internetMessageId,
        mailboxHash: hash(address(entry.mailbox)), sourceFingerprint: entry.sourceFingerprint });
  }
  // Two app records referring to one actual transmission must not both gain dates.
  const used = new Map();
  for (const result of results.filter(value => value.status === "verified")) {
    // internetMessageId catches copies in both a shared and a delegate mailbox.
    const key = result.internetMessageId;
    used.set(key, (used.get(key) || 0) + 1);
  }
  const final = results.map(result => result.status === "verified" && used.get(result.internetMessageId) > 1
    ? { messageId: result.messageId, status: "unknown", reason: "TRANSMISSION_REUSED", sentAt: null } : result);
  const plan = { version: 1, mode: "read_only_proposal_not_applied", missionId: MISSION,
    ...(unassigned ? { sourceMode: "unassigned_batch", originalBatchFingerprint,
      missionAttribution: "unassigned_not_changed" } : {}),
    approvalRef: approval.approvalRef, checkedAt: new Date().toISOString(),
    approvalFingerprint: hash(approval), results: final };
  return { ...plan, evidenceFingerprint: hash(plan) };
}
module.exports = { hash, address, bodyHash, sourceFingerprint, validateApproval, validateSource,
  loadSources, loadUnassignedBatch, inspectScope, SCOPE_SQL, graphReader, matchMessage, reconcile };
