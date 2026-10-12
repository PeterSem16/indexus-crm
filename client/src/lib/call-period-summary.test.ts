import assert from "node:assert/strict";
import { callQualityPraise, callSummaryQuality } from "./call-period-summary";
import { callPeriodSummaryTranslations } from "../i18n/call-period-summary-translations";

for (const copy of Object.values(callPeriodSummaryTranslations)) {
  assert.ok(Object.values(copy).every(value => typeof value === "string" && value.length > 0));
  assert.equal(callQualityPraise(null, copy).band, "unrated");
  assert.equal(callQualityPraise(NaN, copy).band, "unrated");
  for (const [score, band] of [[0, "supportive"], [5.9, "supportive"], [6, "developing"], [6.9, "developing"], [7, "good"], [7.9, "good"], [8, "strong"], [8.9, "strong"], [9, "excellent"], [10, "excellent"]] as const) {
    const result = callQualityPraise(score, copy);
    assert.equal(result.band, band);
    assert.ok(result.title && result.message);
  }
}
assert.equal(Object.keys(callPeriodSummaryTranslations).length, 7);
assert.equal(callSummaryQuality(0, "9.5"), null);
assert.equal(callSummaryQuality(11, null), null);
assert.equal(callSummaryQuality(11, ""), null);
assert.equal(callSummaryQuality(11, "broken"), null);
assert.equal(callSummaryQuality(11, "Infinity"), null);
assert.equal(callSummaryQuality(11, "-1"), null);
assert.equal(callSummaryQuality(11, "11"), null);
assert.equal(callSummaryQuality(11, "0.0"), 0);
assert.equal(callSummaryQuality(11, "7.0"), 7);
assert.equal(callSummaryQuality(11, "9.5"), 9.5);
console.log("PASS call-period summary: seven complete locales, every praise boundary, and missing/invalid/zero quality.");
