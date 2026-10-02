import { translations, type Locale } from "@/i18n/translations";
import { taskDisplayText } from "@/lib/task-display";

export type TaskRequestCategory =
  | "ChangeData"
  | "WrongPhone"
  | "WrongEmail"
  | "WrongAddress"
  | "Document"
  | "Complaint"
  | "Other";

const categoryKeys: TaskRequestCategory[] = [
  "ChangeData",
  "WrongPhone",
  "WrongEmail",
  "WrongAddress",
  "Document",
  "Complaint",
  "Other",
];

export interface TaskRequestBriefText {
  /** Sanitized full source text, retained for the optional original disclosure. */
  original: string;
  /** The featured request, or the full source when no trusted template was found. */
  request: string;
  category: TaskRequestCategory | null;
  isFeatured: boolean;
}

/**
 * Features user-authored text only when a trusted translated request prompt is
 * found at the beginning of a line. Anything uncertain remains untouched.
 */
export function getTaskRequestBrief(
  description: string | null | undefined,
  locale: Locale,
): TaskRequestBriefText {
  const original = taskDisplayText(description);
  if (!original.trim()) {
    return { original, request: original, category: null, isFeatured: false };
  }

  if (!translations[locale]) {
    return { original, request: original, category: null, isFeatured: false };
  }

  const lines = original.split(/\r?\n/);
  let sourceOffset = 0;
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    for (const category of categoryKeys) {
      const indentation = line.match(/^[ \t]*/)?.[0] ?? "";
      const content = line.slice(indentation.length);
      const prompt = (Object.keys(translations) as Locale[])
        .map((catalogLocale) => translations[catalogLocale].quickCreate[`req${category}`])
        .find((candidate) => candidate && content.startsWith(candidate));
      if (!prompt) continue;

      const promptEnd = sourceOffset + indentation.length + prompt.length;
      const rawTail = original.slice(promptEnd);
      const request = rawTail.replace(/^[ \t\r\n]+/, "");
      if (!request.trim()) {
        return { original, request: original, category: null, isFeatured: false };
      }
      return { original, request, category, isFeatured: request !== original };
    }
    if (lineIndex < lines.length - 1) {
      sourceOffset += line.length + (original.slice(sourceOffset + line.length, sourceOffset + line.length + 2) === "\r\n" ? 2 : 1);
    }
  }

  return { original, request: original, category: null, isFeatured: false };
}