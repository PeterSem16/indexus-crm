import { FolderOpen } from "lucide-react";
import { AccountIcon } from "./nexus-sidebar";
import type { OmniMailboxGroup } from "@shared/omni-mailbox-groups";
export function OmniGroupMark({ group }: { group: OmniMailboxGroup }) {
  const color = /^#[0-9a-f]{6}$/i.test(group.color || "") ? group.color! : "#346B61";
  return <span className="omni-group-mark" style={{ color, backgroundColor: `${color}18` }} aria-hidden="true">
    <AccountIcon iconKey={group.icon || "users"} className="h-4 w-4" />
    <FolderOpen className="omni-group-badge" />
  </span>;
}
