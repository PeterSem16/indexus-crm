import { FolderOpen } from "lucide-react";
import type { OmniMailboxGroup } from "@shared/omni-mailbox-groups";
import { groupScope } from "@shared/omni-mailbox-groups";
import { AccountIcon, type AccountIconConfig } from "./nexus-sidebar";
import { useI18n } from "@/i18n/I18nProvider";

export function OmniGroupNavigation({ groups, mailboxes, selected, onSelect, collapsed }: {
  groups: OmniMailboxGroup[]; mailboxes: AccountIconConfig[]; selected?: string;
  onSelect?: (scope: string) => void; collapsed?: boolean;
}) {
  const { t } = useI18n();
  return <div className={`omni-group-navigation ${collapsed ? "is-collapsed" : ""}`} aria-label={t.omniGroups.title}>
    {!collapsed && <p className="omni-group-label">{t.omniGroups.title}</p>}
    {groups.map(group => <div key={group.id}>
      <button type="button" title={group.name} aria-label={group.name}
        className={`omni-group-link ${selected === groupScope(group.id) ? "selected" : ""}`}
        onClick={() => onSelect?.(groupScope(group.id))} data-testid={`omni-group-${group.id}`}>
        <FolderOpen className="h-4 w-4 shrink-0" /><span className="truncate">{group.name}</span>
      </button>
      {!collapsed && <div className="omni-group-children">{mailboxes.filter(m => group.emails.includes(m.email.toLowerCase())).map(mailbox => {
        const key = mailbox.type === "personal" ? "personal" : mailbox.email;
        return <button type="button" key={mailbox.email} className={`omni-group-link ${selected === key ? "selected" : ""}`}
          onClick={() => onSelect?.(key)} title={mailbox.email}>
          <span style={{ color: mailbox.color }}><AccountIcon iconKey={mailbox.icon} className="h-3.5 w-3.5" /></span>
          <span className="truncate">{mailbox.displayName}</span>
        </button>;
      })}</div>}
    </div>)}
  </div>;
}
