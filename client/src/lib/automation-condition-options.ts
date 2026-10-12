export type ConditionOption = { value: string; label: string };
export type ConditionValueField = {
  value: string; label: string; type: string;
  options?: string[]; optionLabels?: Record<string, string>;
};

/** Catalog choices apply to string fields too, not just fields marked enum.
 * Partial-text comparisons keep their text input and historical semantics. */
export function usesConditionChoices(field: ConditionValueField | undefined, operator: string): boolean {
  return !!field?.options && !["contains", "starts_with", "not_contains"].includes(operator);
}
export function conditionValueOptions(field: ConditionValueField, current: unknown, savedLabel: string): ConditionOption[] {
  const choices = (field.options || []).filter(Boolean).map(value => ({
    value, label: field.optionLabels?.[value] || value,
  }));
  const saved = Array.isArray(current) ? current : current == null || current === "" ? [] : [current];
  for (const value of saved.map(String)) {
    if (value && !choices.some(option => option.value === value))
      choices.push({ value, label: `${value} · ${savedLabel}` });
  }
  return choices;
}

export const SENTIMENT_OPTIONS = ["positive", "neutral", "negative", "angry"];
export const TONE_OPTIONS = ["calm", "concerned", "angry", "rude"];
