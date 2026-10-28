import assert from "node:assert/strict";
import test from "node:test";
import { callAnalysisViewState } from "./call-analysis-view-state";
import { translations } from "../i18n/translations";

test("recorded audio is never described as missing while analysis is pending, failed or unknown", () => {
  for (const status of ["pending", "failed", "processing", "completed", null, undefined, "unknown"]) {
    assert.notEqual(callAnalysisViewState(true, status), "missing");
  }
  assert.equal(callAnalysisViewState(false), "missing");
  assert.equal(callAnalysisViewState(true, "failed"), "failed");
  assert.equal(callAnalysisViewState(true, "pending"), "pending");
  assert.equal(callAnalysisViewState(true, "processing"), "processing");
});

test("pending and failed analysis labels exist in all seven runtime languages", () => {
  for (const dictionary of Object.values(translations)) {
    assert.ok(dictionary.commReview.analysisPending.trim());
    assert.ok(dictionary.commReview.analysisFailed.trim());
    assert.notEqual(dictionary.commReview.analysisPending, dictionary.callAnalysis.withoutRecording);
  }
});
