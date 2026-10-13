/** Literal substring search: metacharacters never become regular expressions or instructions. */
export type TextSearchConfig = {
  terms: string[];
  scope: "content" | "attachments" | "all";
  match: "any" | "all";
  caseSensitive: boolean;
};
export type SearchDocument = { text: string | null; complete: boolean };
export type TextSearchResult = {
  textMatched: boolean | null;
  textContentMatched: boolean | null;
  textAttachmentsMatched: boolean | null;
  /** Distinct configured terms found, not substring occurrences. */
  textMatchCount: number;
};

export function textSearchIssues(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return ["invalid text search"];
  const config = value as TextSearchConfig;
  const issues: string[] = [];
  if (!Array.isArray(config.terms) || !config.terms.length || config.terms.length > 20 ||
      config.terms.some(term => typeof term !== "string" || !term.trim() || term.length > 200))
    issues.push("choose 1–20 nonempty literal terms of at most 200 characters");
  if (!["content", "attachments", "all"].includes(config.scope)) issues.push("invalid text search scope");
  if (!["any", "all"].includes(config.match)) issues.push("invalid text search matching");
  if (typeof config.caseSensitive !== "boolean") issues.push("invalid text search case sensitivity");
  return issues;
}

export function evaluateTextSearch(config: TextSearchConfig, content: SearchDocument,
  attachments: SearchDocument[], attachmentsComplete: boolean): TextSearchResult {
  if (textSearchIssues(config).length) throw new Error("analysis_text_search_invalid");
  const normalize = (value: string) => {
    const nfc = value.normalize("NFC");
    return config.caseSensitive ? nfc : nfc.toLowerCase();
  };
  const terms = [...new Set(config.terms.map(normalize))];
  const foundIn = (documents: SearchDocument[]) => new Set(terms.filter(term =>
    documents.some(document => document.text !== null && normalize(document.text).includes(term))));
  const decide = (found: Set<string>, complete: boolean): boolean | null => {
    if (config.match === "any" ? found.size > 0 : found.size === terms.length) return true;
    return complete ? false : null;
  };
  const contentFound = foundIn([content]);
  const attachmentFound = foundIn(attachments);
  const filesComplete = attachmentsComplete && attachments.every(document => document.complete && document.text !== null);
  const selected = config.scope === "content" ? contentFound : config.scope === "attachments" ? attachmentFound
    : new Set([...contentFound, ...attachmentFound]);
  const complete = config.scope === "content" ? content.complete && content.text !== null
    : config.scope === "attachments" ? filesComplete : content.complete && content.text !== null && filesComplete;
  return {
    textMatched: decide(selected, complete),
    textContentMatched: config.scope === "attachments" ? null : decide(contentFound, content.complete && content.text !== null),
    textAttachmentsMatched: config.scope === "content" ? null : decide(attachmentFound, filesComplete),
    textMatchCount: selected.size,
  };
}
