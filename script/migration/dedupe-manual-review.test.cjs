const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const review = require("./dedupe-manual-review.cjs");

function fixture() {
  return {
    executionPlanHash: "audit-hash",
    assignmentMerges: [{ winnerId: "assignment-a" }],
    manualReview: [{
      operationId: "operation-a",
      kind: "person",
      winnerId: "winner",
      loserIds: ["loser"],
      reason: "strong_email_phone",
      confidence: 1,
      matchEvidence: [
        { id: "winner", name: "Winner <script>alert(1)</script>", countryCode: "SK" },
        { id: "loser", name: "Loser", countryCode: "CZ" },
      ],
      fieldConflicts: [{
        field: "birth_number",
        values: [
          { id: "winner", value: { redacted: true, present: true, hash: "abc" } },
          { id: "loser", value: { redacted: true, present: true, hash: "def" } },
        ],
      }],
      autoReviewBlockers: ["country_code"],
      references: [{ table: "contact_assignments", column: "person_id", count: 1, policy: "contact_assignment_special" }],
    }],
  };
}

test("review model keeps review evidence and flags assignment handling", () => {
  const model = review.reviewModel(fixture(), "/private/audit.json");
  assert.equal(model.candidates.length, 1);
  assert.equal(model.candidates[0].hasAssignmentHandling, true);
  assert.equal(model.candidates[0].conflicts[0].values[0].value.redacted, true);
});

test("HTML embeds data safely and has no apply action", () => {
  const html = review.renderHtml(review.reviewModel(fixture(), "/private/audit.json"));
  assert.doesNotMatch(html, /Winner <script>/);
  assert.match(html, /Winner \\u003cscript\\u003ealert/);
  assert.match(html, /Exportovať rozhodnutia/);
  assert.doesNotMatch(html, /--apply|DEDUPLICATE_NO_DELETE/);
});

test("generator requires private input and creates mode-0600 output", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dedupe-review-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const audit = path.join(root, "audit.json");
  const output = path.join(root, "review.html");
  fs.writeFileSync(audit, JSON.stringify(fixture()), { mode: 0o600 });
  fs.chmodSync(audit, 0o600);
  const result = review.generateReview({ auditPath: audit, outputPath: output });
  assert.equal(result.candidateCount, 1);
  assert.equal(fs.statSync(output).mode & 0o777, 0o600);
  assert.throws(() => review.generateReview({ auditPath: audit, outputPath: output }), /already exists/);
});

test("generator rejects an audit readable by group or others", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dedupe-review-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const audit = path.join(root, "audit.json");
  fs.writeFileSync(audit, JSON.stringify(fixture()), { mode: 0o644 });
  fs.chmodSync(audit, 0o644);
  assert.throws(
    () => review.generateReview({ auditPath: audit, outputPath: path.join(root, "review.html") }),
    /mode 0600/
  );
});