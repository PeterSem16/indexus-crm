import assert from "node:assert/strict";
import { test } from "node:test";
import { attachmentActivity, privateRunSummary } from "./automation-attachment-activity";
import { analyzeAttachmentBatch } from "./automation-attachment-batch";
import { attachmentFailureReason, attachmentOutcomesForActivity } from "../../shared/automation-attachment-outcomes";
import { automationAttachmentTranslations } from "../../client/src/i18n/automation-attachment-translations";
import type { WorkflowRun, WorkflowRule, WorkflowEvent } from "../../shared/schema";

test("mixed attachments retain order, safe failure reasons, totals and exactly one attempt", async () => {
  const attempts: number[] = [];
  const result = await analyzeAttachmentBatch([0, 1, 2, 3, 4, 5], async index => {
    attempts.push(index);
    if (index === 0) return { classification: "invoice" as const, url: "/private/snapshot" };
    if (index === 2) return { classification: "other" as const, url: "/private/snapshot" };
    throw new Error(["", "analysis_attachment_missing", "", "analysis_unsupported_attachment",
      "analysis_document_encrypted", "Vendor secret /internal/file customer-id"][index]);
  });
  assert.deepEqual(attempts, [0, 1, 2, 3, 4, 5]);
  assert.equal(result.invoiceCount, 1);
  assert.equal(result.attachmentCount, 6);
  assert.equal(result.failedAttachmentCount, 4);
  assert.equal(result.hasInvoice, true);
  assert.deepEqual(result.attachmentOutcomes, [
    { position: 1, result: "invoice" }, { position: 2, result: "unprocessed", reason: "missing" },
    { position: 3, result: "other" }, { position: 4, result: "unprocessed", reason: "unsupported" },
    { position: 5, result: "unprocessed", reason: "encrypted" }, { position: 6, result: "unprocessed", reason: "unavailable" },
  ]);
  assert.doesNotMatch(JSON.stringify(attachmentOutcomesForActivity(result)), /Vendor|private|internal|customer-id|url/);
});

test("failed documents are unknown, never a negative invoice classification", async () => {
  const failed = await analyzeAttachmentBatch([1, 2], async () => { throw Object.assign(new Error("/secret/path"), { code: "ENOENT" }); });
  assert.equal(failed.hasInvoice, null);
  assert.equal(failed.failedAttachmentCount, 2);
  assert.equal((await analyzeAttachmentBatch([], async () => ({ classification: "other" as const }))).hasInvoice, false);
  assert.equal((await analyzeAttachmentBatch([1], async () => ({ classification: "other" as const }))).hasInvoice, false);
  assert.equal(attachmentFailureReason(new Error("analysis_document_timeout")), "unavailable");
  assert.equal(attachmentFailureReason(new Error("analysis_document_unreadable")), "unreadable");
  assert.equal(attachmentFailureReason(new Error("analysis_document_text_limit")), "limit");
});

const run = {
  id: "run", ruleId: "rule", eventId: "PRIVATE-event", status: "success", startedAt: new Date(), finishedAt: new Date(),
  error: "Vendor secret", payload: { analysis: { attachmentOutcomes: [
    { position: 7, result: "invoice", storageKey: "/secret", name: "PRIVATE" },
  ], summary: "PRIVATE document text", communication: { id: "PRIVATE-other" } } },
  actionResults: [{ content: "PRIVATE" }], causationChain: ["PRIVATE"],
} as unknown as WorkflowRun;

test("activity checks current source permissions on every read and strips all diagnostic data", async () => {
  let permitted = true;
  const seen: string[] = [];
  const deps = {
    rule: async () => ({ id: "rule" } as WorkflowRule),
    event: async () => ({ id: "PRIVATE-event" } as WorkflowEvent),
    canRead: async (_rule: WorkflowRule, _event: WorkflowEvent, viewer: string) => {
      seen.push(viewer);
      return viewer === "participant" && permitted;
    },
  };
  assert.deepEqual(await attachmentActivity(run, "participant", deps), {
    status: "available", outcomes: [{ position: 1, result: "invoice" }],
  });
  const denied = { status: "unavailable", outcomes: [] };
  assert.deepEqual(await attachmentActivity(run, "outsider-admin", deps), denied);
  permitted = false;
  assert.deepEqual(await attachmentActivity(run, "participant", deps), denied);
  assert.deepEqual(await attachmentActivity(run, "participant", { ...deps, event: async () => undefined }), denied);
  assert.deepEqual(await attachmentActivity(run, "participant", { ...deps, canRead: async () => { throw new Error("PRIVATE"); } }), denied);
  assert.deepEqual(seen, ["participant", "outsider-admin", "participant"]);
  assert.doesNotMatch(JSON.stringify(privateRunSummary(run)), /PRIVATE|Vendor|payload|eventId|actionResults|error/);
});

test("legacy runs show successful classifications and unknown reasons without inventing historical evidence", async () => {
  assert.deepEqual(attachmentOutcomesForActivity({ attachments: [{ classification: "invoice", name: "PRIVATE" }], failedAttachmentCount: 1 }), [
    { position: 1, result: "invoice" }, { position: 2, result: "unprocessed", reason: "unknown" },
  ]);
  assert.deepEqual(attachmentOutcomesForActivity({ attachmentOutcomes: [{ reason: "/internal/secret" }] }), [
    { position: 1, result: "unprocessed", reason: "unknown" },
  ]);
  assert.deepEqual(attachmentOutcomesForActivity(null), []);
});

test("all seven languages have every result and failure reason", () => {
  assert.deepEqual(Object.keys(automationAttachmentTranslations).sort(), ["cs", "de", "en", "hu", "it", "ro", "sk"]);
  for (const copy of Object.values(automationAttachmentTranslations)) {
    assert.deepEqual(Object.keys(copy).sort(), Object.keys(automationAttachmentTranslations.en).sort());
    assert.deepEqual(Object.keys(copy.reasons).sort(), ["encrypted", "limit", "missing", "unavailable", "unknown", "unreadable", "unsupported"]);
    for (const value of [...Object.values(copy).filter(value => typeof value === "string"), ...Object.values(copy.reasons)]) assert.ok(value.length);
  }
});
