import test from "node:test";
import assert from "node:assert/strict";
import { regressionCases } from "./regression-corpus";
import { evaluateRegression, summarizeRegression } from "./regression-evaluator";

// Synthetic complete outputs only, NOT extra gold labels for unspecified fields.
const response = { sentiment: "neutral", hasInappropriateContent: false, hasAngryTone: false,
  hasRudeExpressions: false, wantsToCancel: false, wantsConsent: false,
  doesNotAcceptContract: false, alertLevel: "none", note: "Syntetické vysvetlenie." };
const manual = { noteSlovak: true, noteDoesNotClaimCancellation: true };

test("supplied corpus has exactly the original 18 unique cases and unchanged partial references", () => {
  assert.equal(regressionCases.length, 18);
  assert.deepEqual(regressionCases.map(row => row.id),
    ["K01", "K02", "K03", "K04", "K05", "K06", "K07", "K08", "K09", "K10", "K11", "K12",
      "EN", "CS", "HU", "RO", "IT", "DE"]);
  assert.ok(regressionCases.every(row => row.subject === "Syntetický test"));
  assert.deepEqual(regressionCases.find(row => row.id === "K08")?.expected, { wantsToCancel: false });
  assert.deepEqual(regressionCases.find(row => row.id === "K12")?.expected, { wantsConsent: false });
  assert.equal("hasRudeExpressions" in regressionCases.find(row => row.id === "K10")!.expected, false);
  assert.ok(Object.isFrozen(regressionCases));
  assert.ok(regressionCases.every(row => Object.isFrozen(row.expected)));
});

for (const row of regressionCases) test(`partial reference evaluator ${row.id}: no guessed fields`, () => {
  const output = { ...response, ...row.expected };
  const result = evaluateRegression(row.id, output, manual);
  assert.equal(result.status, "PASS");
  assert.equal(result.classificationValid, true);
  assert.deepEqual(result.checkedFields, Object.keys(row.expected));
  for (const [key, value] of Object.entries(row.expected)) {
    const bad = { ...output, [key]: typeof value === "boolean" ? !value : "neutral" };
    assert.equal(evaluateRegression(row.id, bad, manual).status, "FAIL");
  }
});

test("K12 safe review remains separate from nine-field JSON and field-accuracy denominators", () => {
  const result = evaluateRegression("K12", { status: "review_required", code: "review_required" });
  assert.equal(result.status, "SAFE_REJECTION");
  assert.equal(result.classificationValid, false);
  assert.deepEqual(result.checkedFields, []);
  assert.equal(evaluateRegression("K12", { ...response, wantsConsent: true }).status, "FAIL");
  assert.equal(evaluateRegression("K03", { status: "review_required", code: "review_required" }).status,
    "REVIEW_REQUIRED");
});

test("K04 refuses angry sentiment without inventing another required sentiment", () => {
  const output = { ...response, wantsToCancel: true };
  assert.equal(evaluateRegression("K04", { ...output, sentiment: "angry" }).status, "FAIL");
  for (const sentiment of ["positive", "neutral", "negative"])
    assert.equal(evaluateRegression("K04", { ...output, sentiment }).status, "PASS");
});

test("valid structure cannot substitute for human language and note-semantic approval", () => {
  assert.equal(evaluateRegression("EN", response).status, "REVIEW_REQUIRED");
  assert.equal(evaluateRegression("K09", response).status, "REVIEW_REQUIRED");
  assert.equal(evaluateRegression("EN", response, { noteSlovak: false }).status, "FAIL");
  assert.equal(evaluateRegression("K09", response, { noteDoesNotClaimCancellation: false }).status, "FAIL");
});

test("all nine fields remain required, including fields without a gold value", () => {
  const missing = { ...response } as any;
  delete missing.hasRudeExpressions;
  assert.equal(evaluateRegression("K01", missing).status, "FAIL");
  assert.equal(evaluateRegression("K01", { ...response, hasAngryTone: "false" }).status, "FAIL");
  assert.equal(evaluateRegression("K01", "{invalid").status, "FAIL");
  assert.equal(evaluateRegression("K01", { status: "failed" }).classificationValid, false);
});

test("summary preserves 18-case denominator and reports 17 classifications + one safe rejection distinctly", () => {
  const results = regressionCases.map(row => row.id === "K12"
    ? evaluateRegression(row.id, { status: "review_required", code: "review_required" })
    : evaluateRegression(row.id, { ...response, ...row.expected }, manual));
  const summary = summarizeRegression(results);
  assert.equal(summary.classificationPass, 17);
  assert.equal(summary.safeRejections, 1);
  assert.equal(summary.completeAndAccepted, true);
  assert.equal(summarizeRegression(results.slice(1)).completeAndAccepted, false);
  assert.throws(() => summarizeRegression([...results, results[0]]));
  assert.throws(() => evaluateRegression("K13", response));
});
