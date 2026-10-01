export interface TaskRequestCategoryForm {
  title: string;
  description: string;
  category: string;
}

/**
 * Change generated category metadata without replacing the agent-authored body.
 */
export function applyTaskRequestCategory<T extends TaskRequestCategoryForm>(
  form: T,
  category: string,
  title: string,
): T {
  return { ...form, category, title };
}

/**
 * Preserve the established plain-text description format consumed throughout
 * Pulse: optional entity line, localized request prefix, then agent text.
 */
export function composeTaskRequestDescription(
  entityName: string | null | undefined,
  categoryPhrase: string | null | undefined,
  agentBody: string,
): string {
  return [entityName?.trim(), categoryPhrase, agentBody.trim() ? agentBody : undefined]
    .filter((part): part is string => Boolean(part))
    .join("\n");
}