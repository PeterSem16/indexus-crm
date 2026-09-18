"use strict";

const crypto = require("node:crypto");

const DEFAULT_MIN_AGE_MINUTES = 5;

function deterministicCallLogId(inboundId) {
  const hex = crypto
    .createHash("sha256")
    .update(`indexus:recovered-inbound-call-log:${inboundId}`, "utf8")
    .digest("hex")
    .slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function campaignIdFromMetadata(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  return typeof metadata.campaignId === "string" && metadata.campaignId.trim()
    ? metadata.campaignId
    : null;
}

function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  const as = new Date(aStart).getTime();
  const ae = new Date(aEnd || aStart).getTime();
  const bs = new Date(bStart).getTime();
  const be = new Date(bEnd || bStart).getTime();
  return as <= be && bs <= ae;
}

/**
 * Pure fixture classifier mirroring the database safety gates. It intentionally
 * does not infer campaigns, users, customers, or forwarding state.
 */
function classifyFixture(inbound, context) {
  if (inbound.callLogId) return "already_linked";
  if (inbound.status !== "completed") return "ineligible_status";
  if (!inbound.answeredAt) return "missing_answered_at";
  if (!inbound.completedAt) return "missing_completed_at";
  if (new Date(inbound.completedAt) >= new Date(context.before)) return "too_recent";
  if (!context.userIds.has(inbound.assignedAgentId)) return "invalid_user";

  const campaignId = campaignIdFromMetadata(inbound.metadata);
  if (!campaignId) return "missing_campaign_metadata";
  if (!context.campaignIds.has(campaignId)) return "invalid_campaign";

  const canonical = context.callLogs || [];
  if (canonical.some((row) => row.inboundCallLogId === inbound.id)) return "backlink_repair";
  if (
    inbound.ariChannelId &&
    canonical.some((row) => row.sipCallId && row.sipCallId === inbound.ariChannelId)
  ) return "sip_channel_duplicate";

  const ambiguous = canonical.some((row) =>
    row.direction === "inbound" &&
    row.userId === inbound.assignedAgentId &&
    row.phoneNumber === inbound.callerNumber &&
    !row.inboundCallLogId &&
    intervalsOverlap(
      inbound.enteredQueueAt,
      inbound.completedAt,
      row.startedAt,
      row.endedAt || row.startedAt,
    ),
  );
  return ambiguous ? "ambiguous_overlap" : "missing";
}

function parseArgs(argv, now = new Date()) {
  const options = {
    apply: false,
    before: new Date(now.getTime() - DEFAULT_MIN_AGE_MINUTES * 60_000),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") options.apply = true;
    else if (arg === "--dry-run") options.apply = false;
    else if (arg === "--before") {
      const value = argv[++index];
      if (!value) throw new Error("--before requires an ISO-8601 timestamp");
      options.before = new Date(value);
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (Number.isNaN(options.before.getTime())) {
    throw new Error("--before must be a valid ISO-8601 timestamp");
  }
  return options;
}

module.exports = {
  DEFAULT_MIN_AGE_MINUTES,
  campaignIdFromMetadata,
  classifyFixture,
  deterministicCallLogId,
  intervalsOverlap,
  parseArgs,
};