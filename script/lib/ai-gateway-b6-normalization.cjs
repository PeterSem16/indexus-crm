"use strict";
const P = require("../ai-gateway-b4-pilot.cjs");
const POLICY = Object.freeze({
  name: "source-bound-SYN-B4-only",
  scope: "document_id only; no changes to JSON, schema, dates or other fields",
  required: "valid original schema; one source identifier; one matching output identifier; no other numeric output tokens",
  expectedAnswersUsed: false,
});
const matches = text => [...text.matchAll(/(?<![\p{L}\p{N}_-])SYN-B4-\d{2}(?![\p{L}\p{N}_-])/gu)];
function normalizeDocumentId(value, source) {
  const result = { applied: false, before: value, after: value, reason: "UNSUPPORTED_OR_MISSING_ID" };
  if (typeof value !== "string" || typeof source !== "string") return result;
  const sourceIds = new Set(matches(source).map(m => m[0]));
  const outputIds = matches(value);
  if (sourceIds.size > 1 || outputIds.length > 1)
    return { ...result, reason: "AMBIGUOUS_ID" };
  if (sourceIds.size !== 1 || outputIds.length !== 1) return result;
  const id = outputIds[0][0];
  if (!sourceIds.has(id)) return { ...result, reason: "SOURCE_OUTPUT_ID_MISMATCH" };
  const adornment = value.slice(0, outputIds[0].index) +
    value.slice(outputIds[0].index + id.length);
  if (/\p{N}/u.test(adornment)) return { ...result, reason: "ADDITIONAL_NUMERIC_TOKEN" };
  if (/[\p{L}\p{N}]+(?:[-_/:.][\p{L}\p{N}]+)+/u.test(adornment))
    return { ...result, reason: "ADDITIONAL_IDENTIFIER_TOKEN" };
  if (value === id) return { ...result, reason: "ALREADY_EXACT" };
  return { applied: true, before: value, after: id, reason: "UNIQUE_SOURCE_MATCH" };
}
function evaluateResponse(text, doc) {
  const raw = P.evaluate(text, doc.expected);
  if (!raw.schemaValid) return { ...raw, normalized: structuredClone(raw),
    normalization: { applied: false, reason: "INVALID_JSON_OR_SCHEMA" } };
  // This function sees only the model value and source text, never the expected ID.
  const normalization = normalizeDocumentId(raw.actual.document_id, doc.text);
  const actual = { ...raw.actual, document_id: normalization.after };
  return { ...raw, normalization,
    normalized: P.evaluate(JSON.stringify(actual), doc.expected) };
}
module.exports = { POLICY, normalizeDocumentId, evaluateResponse };
