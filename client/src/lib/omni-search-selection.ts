export type OmniExportMessage = { id: string; mailbox: string; subject: string };
export type OmniSearchSelection = { scope: string; keys: ReadonlySet<string> } | null;

// Graph IDs are mailbox-scoped and case-sensitive. Mailbox casing is not.
export function omniSearchMessageKey(message: { id: string; mailbox: string }): string {
  return JSON.stringify([message.mailbox.toLowerCase(), message.id]);
}

export function omniSearchExportMessages(results: readonly {
  mailbox: string; emails: readonly { id: string; subject?: string | null }[];
}[]): OmniExportMessage[] {
  const unique = new Map<string, OmniExportMessage>();
  for (const result of results) for (const email of result.emails) {
    const message = { id: email.id, mailbox: result.mailbox.toLowerCase(), subject: email.subject || "" };
    const key = omniSearchMessageKey(message);
    if (!unique.has(key)) unique.set(key, message);
  }
  return [...unique.values()];
}

export function selectedOmniSearchMessages(
  messages: readonly OmniExportMessage[], selection: OmniSearchSelection, scope: string,
): OmniExportMessage[] {
  // A new executed search starts with all results, preserving existing exports.
  if (!selection || selection.scope !== scope) return [...messages];
  return messages.filter(message => selection.keys.has(omniSearchMessageKey(message)));
}

export function toggleOmniSearchMessage(
  messages: readonly OmniExportMessage[], selection: OmniSearchSelection, scope: string,
  message: { id: string; mailbox: string }, checked: boolean,
): NonNullable<OmniSearchSelection> {
  const keys = new Set(selectedOmniSearchMessages(messages, selection, scope).map(omniSearchMessageKey));
  const key = omniSearchMessageKey(message);
  if (checked && messages.some(candidate => omniSearchMessageKey(candidate) === key)) keys.add(key);
  else keys.delete(key);
  return { scope, keys };
}

export function pruneOmniSearchSelection(
  messages: readonly OmniExportMessage[], selection: OmniSearchSelection, scope: string,
): OmniSearchSelection {
  if (!selection || selection.scope !== scope) return selection;
  const keys = new Set(selectedOmniSearchMessages(messages, selection, scope).map(omniSearchMessageKey));
  return keys.size === selection.keys.size ? selection : { scope, keys };
}
