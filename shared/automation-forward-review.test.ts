import { test } from "node:test";
import assert from "node:assert/strict";
import { approveForwardInvoice, forwardSenderDecision, type ForwardReview } from "./automation-forward-review";
import { forwardActionIssues } from "./automation-forward-action";

test("only one complete sender match links a customer", () => {
  assert.equal(forwardSenderDecision(true, ["one"]).customerId, "one");
  assert.equal(forwardSenderDecision(true, ["one", "one"]).customerId, "one");
  for (const decision of [forwardSenderDecision(false, ["one"]), forwardSenderDecision(true, []),
    forwardSenderDecision(true, ["one", "two"]), forwardSenderDecision(true, ["one"], true)])
    assert.equal(decision.customerId, null);
  assert.equal(forwardSenderDecision(true, ["one", "two"]).matchStatus, "ambiguous");
});
test("approval marks only the selected invoice and is idempotent", () => {
  const review: ForwardReview = { version: 1, matchSender: true, matchStatus: "none", candidateIds: [],
    invoices: ["one", "two"].map(attachmentId => ({ attachmentId, name: `${attachmentId}.pdf`, approvedAt: null, approvedBy: null })) };
  const approved = approveForwardInvoice(review, "one", "reviewer", "2026-10-13T12:00:00Z");
  assert.equal(approved.invoices[0].approvedBy, "reviewer");
  assert.equal(approved.invoices[1].approvedAt, null);
  assert.equal(review.invoices[0].approvedAt, null);
  assert.deepEqual(approveForwardInvoice(approved, "one", "other", "2026-10-14T12:00:00Z"), approved);
  assert.throws(() => approveForwardInvoice(review, "unknown", "reviewer", "now"));
});
test("sender matching is optional and internal-only", () => {
  const config = { forwardActionVersion: 1, destination: "user", userId: "reviewer", mode: "whole", selection: "all" };
  assert.deepEqual(forwardActionIssues(config), []);
  assert.deepEqual(forwardActionIssues({ ...config, matchSender: true }), []);
  assert.ok(forwardActionIssues({ ...config, matchSender: "true" }).length);
  assert.ok(forwardActionIssues({ ...config, userId: undefined, destination: "email", to: "reviewer@example.test", matchSender: true }).length);
});
