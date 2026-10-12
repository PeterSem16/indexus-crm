import type { CallPeriodSummaryCopy } from "../i18n/call-period-summary-translations";

export function callQualityPraise(quality: number | null, copy: CallPeriodSummaryCopy) {
  const band = quality === null || !Number.isFinite(quality) ? "unrated"
    : quality >= 9 ? "excellent" : quality >= 8 ? "strong"
      : quality >= 7 ? "good" : quality >= 6 ? "developing" : "supportive";
  return { band, title: copy[`${band}Title`], message: copy[`${band}Copy`] };
}

/** Missing and invalid scores never create a rating or a congratulatory tier. */
export function callSummaryQuality(total: number, value: string | null): number | null {
  if (!total || value === null || value.trim() === "") return null;
  const score = Number(value);
  return Number.isFinite(score) && score >= 0 && score <= 10 ? score : null;
}
