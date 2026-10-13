import assert from "node:assert/strict";
import test from "node:test";
import { evaluateTextSearch, textSearchIssues, type TextSearchConfig } from "./automation-text-search";
import { ANALYSIS_FIELDS, analysisConfigIssues } from "./automation-analysis";
import { contentSignalLabels } from "../client/src/i18n/automation-content-signal-copy";
import { getTextSearchCopy } from "../client/src/i18n/automation-text-search-copy";
const config: TextSearchConfig = { terms: ["faktúra"], scope: "content", match: "any", caseSensitive: false };
const document = (text: string) => ({ text, complete: true });

test("literal substrings, characters, accents and case are matched without regex or semantic inference", () => {
  assert.equal(evaluateTextSearch(config, document("FAKTÚRA 123"), [], true).textMatched, true);
  assert.equal(evaluateTextSearch(config, document("faktu\u0301ra"), [], true).textMatched, true);
  assert.equal(evaluateTextSearch({ ...config, caseSensitive: true }, document("FAKTÚRA"), [], true).textMatched, false);
  assert.equal(evaluateTextSearch({ ...config, terms: [".*"] }, document("anything"), [], true).textMatched, false);
  for (const term of [".*", "$", "[", "😀", "#INV-2026", "A B"])
    assert.equal(evaluateTextSearch({ ...config, terms: [term] }, document(`x${term}y`), [], true).textMatched, true);
  assert.equal(evaluateTextSearch(config, document("billing document requests payment"), [], true).textMatched, false);
});

test("scope and any/all are evaluated across original text and readable attachments, never summaries or names", () => {
  const all = { ...config, terms: ["alpha", "beta"], match: "all" as const, scope: "all" as const };
  const result = evaluateTextSearch(all, document("alpha"), [document("beta")], true);
  assert.equal(result.textMatched, true);
  assert.equal(result.textContentMatched, false);
  assert.equal(result.textAttachmentsMatched, false);
  assert.equal(result.textMatchCount, 2);
  assert.equal(evaluateTextSearch({ ...all, scope: "content" }, document("alpha"), [document("beta")], true).textMatched, false);
  assert.equal(evaluateTextSearch({ ...config, scope: "attachments" }, document("faktúra"), [document("other")], true).textMatched, false);
  assert.equal(evaluateTextSearch({ ...config, scope: "attachments" }, document("faktúra"), [], true).textMatched, false);
  assert.equal(evaluateTextSearch({ ...config, terms: ["faktúra", "FAKTÚRA"] }, document("faktúra faktúra"), [], true).textMatchCount, 1);
});

test("unreadable, missing and incomplete OCR sources remain unknown unless sufficient literal matches are proven", () => {
  const unknown = { text: null, complete: false };
  const scope = { ...config, scope: "attachments" as const };
  assert.equal(evaluateTextSearch(scope, document(""), [unknown], true).textMatched, null);
  assert.equal(evaluateTextSearch(scope, document(""), [{ text: "other", complete: false }], true).textMatched, null);
  assert.equal(evaluateTextSearch(scope, document(""), [{ text: "faktúra", complete: false }], true).textMatched, true);
  assert.equal(evaluateTextSearch(scope, document(""), [], false).textMatched, null);
  assert.equal(evaluateTextSearch({ ...scope, match: "all", terms: ["faktúra", "#"] }, document(""),
    [document("faktúra"), unknown], true).textMatched, null);
  assert.equal(evaluateTextSearch({ ...scope, match: "all", terms: ["faktúra", "#"] }, document(""),
    [{ text: "faktúra #", complete: false }, unknown], true).textMatched, true);
  assert.equal(evaluateTextSearch({ ...config, scope: "all" }, document("faktúra"), [unknown], false).textMatched, true);
  assert.equal(evaluateTextSearch(config, unknown, [], true).textMatched, null);
});

test("bounded configuration is validated on the server and old rules remain unchanged", () => {
  const analysis = { channels: ["email"], analyzeContent: true, analyzeAttachments: false };
  assert.deepEqual(analysisConfigIssues(analysis), []);
  assert.deepEqual(analysisConfigIssues({ ...analysis, textSearch: config }), []);
  assert.ok(analysisConfigIssues({ ...analysis, textSearch: { ...config, scope: "attachments" } }).length);
  assert.ok(analysisConfigIssues({ ...analysis, analyzeContent: false, analyzeAttachments: true, textSearch: config }).length);
  for (const invalid of [null, [], {}, { ...config, terms: [] }, { ...config, terms: [" "] },
    { ...config, terms: ["x".repeat(201)] }, { ...config, terms: Array(21).fill("x") },
    { ...config, terms: [42] }, { ...config, scope: "filename" }, { ...config, match: "regex" }, { ...config, caseSensitive: "yes" }])
    assert.ok(textSearchIssues(invalid).length, JSON.stringify(invalid));
});

test("all text search settings and IF result fields have seven complete locales", () => {
  for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"] as const) {
    assert.ok(Object.values(getTextSearchCopy(locale)).every(value => typeof value === "string" && value.trim()));
    const labels = contentSignalLabels(locale);
    for (const field of ANALYSIS_FIELDS.filter(field => field.value.startsWith("analysis.text"))) assert.ok(labels[field.value]);
  }
});
