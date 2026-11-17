import { parseEmailSentimentAnalysis, type EmailSentimentAnalysis } from "../../server/lib/ai/email-sentiment-contract";
import { regressionCases, type ManualCheck } from "./regression-corpus";

export interface RegressionEvaluation {
  id: string;
  status: "PASS" | "SAFE_REJECTION" | "FAIL" | "REVIEW_REQUIRED";
  classificationValid: boolean;
  checkedFields: string[];
  mismatches: string[];
  pendingManualChecks: ManualCheck[];
  code?: string;
}

/** Pure offline evaluation. No provider, transport, DB, retries or text-language heuristic. */
export function evaluateRegression(
  id: string, result: unknown, manual: Partial<Record<ManualCheck, boolean>> = {},
): RegressionEvaluation {
  const row = regressionCases.find(row => row.id === id);
  if (!row) throw new Error("sentiment_regression_unknown_case");
  const base = { id, classificationValid: false, checkedFields: [] as string[],
    mismatches: [] as string[], pendingManualChecks: [] as ManualCheck[] };
  const error = result as { status?: unknown; code?: unknown } | null;
  if (error?.status === "review_required" && error.code === "review_required") {
    return { ...base, status: row.allowSafeReview ? "SAFE_REJECTION" : "REVIEW_REQUIRED", code: "review_required" };
  }
  if (error?.status === "failed")
    return { ...base, status: "FAIL", code: "sentiment_regression_technical_failure" };
  let analysis: EmailSentimentAnalysis;
  try { analysis = parseEmailSentimentAnalysis(typeof result === "string" ? result : JSON.stringify(result)); }
  catch { return { ...base, status: "FAIL", code: "sentiment_regression_invalid_classification" }; }
  const checkedFields = Object.keys(row.expected) as (keyof EmailSentimentAnalysis)[];
  const mismatches = checkedFields.filter(key => analysis[key] !== row.expected[key]) as string[];
  if (row.forbidden?.sentiment.includes(analysis.sentiment)) mismatches.push("sentiment:not-angry");
  const manualChecks = row.manualChecks ?? [];
  for (const check of manualChecks) if (manual[check] === false) mismatches.push(check);
  const pendingManualChecks = manualChecks.filter(check => manual[check] !== true && manual[check] !== false);
  return {
    ...base, classificationValid: true, checkedFields, mismatches, pendingManualChecks,
    status: mismatches.length ? "FAIL" : pendingManualChecks.length ? "REVIEW_REQUIRED" : "PASS",
  };
}

/** A complete denominator is mandatory. An approved safe rejection is never a valid JSON classification. */
export function summarizeRegression(rows: readonly RegressionEvaluation[]) {
  const ids = new Set(rows.map(row => row.id));
  if (ids.size !== rows.length || rows.some(row => !regressionCases.some(original => original.id === row.id)))
    throw new Error("sentiment_regression_invalid_case_set");
  const expectedIds = regressionCases.map(row => row.id);
  return {
    expectedCases: expectedIds.length, evaluatedCases: rows.length,
    missing: expectedIds.filter(id => !ids.has(id)),
    classificationPass: rows.filter(row => row.status === "PASS").length,
    safeRejections: rows.filter(row => row.status === "SAFE_REJECTION").length,
    failures: rows.filter(row => row.status === "FAIL").length,
    requiresReview: rows.filter(row => row.status === "REVIEW_REQUIRED").length,
    completeAndAccepted: ids.size === expectedIds.length &&
      rows.every(row => row.status === "PASS" || row.status === "SAFE_REJECTION"),
  };
}
