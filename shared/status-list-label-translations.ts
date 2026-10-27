import { z } from "zod";

export const statusListLabelLanguages = ["en", "sk", "cs", "hu", "ro", "it", "de"] as const;
export type StatusListLabelLanguage = typeof statusListLabelLanguages[number];
const label = z.string().trim().min(1).max(240);
export const statusListLabelTranslationsSchema = z.object({
  en: label.optional(), sk: label.optional(), cs: label.optional(), hu: label.optional(),
  ro: label.optional(), it: label.optional(), de: label.optional(),
}).strict();
export type StatusListLabelTranslations = z.infer<typeof statusListLabelTranslationsSchema>;

export function statusListOptionLabel(
  option: { label: string; labelTranslations?: unknown }, locale: string,
): string {
  const values = option.labelTranslations;
  if (!values || typeof values !== "object" || !statusListLabelLanguages.includes(locale as StatusListLabelLanguage)) return option.label;
  const value = (values as Record<string, unknown>)[locale];
  return typeof value === "string" && value.trim() ? value.trim() : option.label;
}
