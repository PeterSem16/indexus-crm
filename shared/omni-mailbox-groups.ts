export interface OmniMailboxGroup { id: string; name: string; emails: string[] }
export interface OmniGroupSettings { groups: OmniMailboxGroup[]; revision: number }
export interface ScopeMailbox { email: string; type: string }
export const groupScope = (id: string) => `group:${id}`;
export function validateMailboxGroups(value: unknown, allowed: Set<string>): OmniMailboxGroup[] {
  if (!Array.isArray(value) || value.length > 30) throw new Error("invalid_groups");
  const ids = new Set<string>();
  return value.map(group => {
    if (!group || typeof group !== "object" || typeof group.id !== "string" ||
        !/^[a-zA-Z0-9_-]{1,80}$/.test(group.id) || ids.has(group.id) ||
        typeof group.name !== "string" || !group.name.trim() || group.name.trim().length > 80 ||
        !Array.isArray(group.emails) || group.emails.length > 100 ||
        group.emails.some((email: unknown) => typeof email !== "string")) throw new Error("invalid_groups");
    ids.add(group.id);
    const emails = Array.from(new Set<string>(group.emails.map((email: string) => email.trim().toLowerCase())));
    if (emails.some(email => !allowed.has(email))) throw new Error("mailbox_forbidden");
    return { id: group.id, name: group.name.trim(), emails };
  });
}
/** Resolve only against the current authorized mailbox inventory. Unknown groups stay empty. */
export function resolveMailboxScope(scope: string, groups: OmniMailboxGroup[], mailboxes: ScopeMailbox[]): string[] {
  let selected = mailboxes;
  if (scope.startsWith("group:")) {
    const group = groups.find(item => groupScope(item.id) === scope);
    selected = group ? mailboxes.filter(m => group.emails.includes(m.email.toLowerCase())) : [];
  } else if (scope !== "all") {
    selected = mailboxes.filter(m => scope === (m.type === "personal" ? "personal" : m.email));
  }
  return Array.from(new Set(selected.map(m => m.type === "personal" ? "personal" : m.email)));
}
export const OMNI_GROUPS_DDL = `CREATE TABLE IF NOT EXISTS nexus_omni_mailbox_groups (
  user_id varchar PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  groups jsonb NOT NULL DEFAULT '[]'::jsonb,
  revision integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
)`;
