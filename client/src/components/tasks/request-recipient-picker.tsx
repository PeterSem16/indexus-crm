import { useState } from "react";
import { Users, UserRound } from "lucide-react";
import { useI18n } from "@/i18n";
import { type RequestRecipients, toggleRecipient, recipientsAreAvailable } from "./request-routing-model";
import type { TaskAssignmentOptions } from "@/hooks/use-task-assignment-options";
import "./task-communications.css";

export function RequestRecipientPicker({ value, onChange, options, disabled = false }: {
  value: RequestRecipients; onChange: (value: RequestRecipients) => void; options: TaskAssignmentOptions; disabled?: boolean;
}) {
  const { t } = useI18n();
  const c = t.taskCommunication;
  const [search, setSearch] = useState("");
  const available = recipientsAreAvailable(value, options.groups, options.users);
  const count = value.groupIds.length + value.userIds.length;
  return <div className="pulse-live pulse-recipient-box" data-testid="request-recipients">
    <div className="pulse-label">{t.quickCreate.assignedTo}</div>
    <div className="flex flex-wrap gap-2 mb-2">
      {value.groupIds.map(id => <button type="button" disabled={disabled} className="pulse-chip" key={`g:${id}`} onClick={() => onChange(toggleRecipient(value, "groupIds", id))}>
        <Users size={13}/>{options.groups.find(group => group.id === id)?.name || c.recipientsUnavailable} ×
      </button>)}
      {value.userIds.map(id => <button type="button" disabled={disabled} className="pulse-chip" key={`u:${id}`} onClick={() => onChange(toggleRecipient(value, "userIds", id))}>
        <UserRound size={13}/>{(() => { const person = options.users.find(user => user.id === id); return person?.fullName || person?.username || c.recipientsUnavailable; })()} ×
      </button>)}
      {!count && <span className="pulse-note">{c.manual}</span>}
    </div>
    {!available && <p role="alert" className="text-sm text-amber-800 mb-2">{c.recipientsUnavailable}</p>}
    <p className="pulse-note mb-3">{c.sharedHint}</p>
    <input aria-label={t.common.search} className="pulse-input mb-3" placeholder={t.common.search} value={search} disabled={disabled} onChange={event => setSearch(event.target.value)} />
    <div className="pulse-recipient-options">
      <div><div className="pulse-label">{c.groups}</div><div className="pulse-target-scroll">
        {options.groups.filter(group => group.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(group => <label key={group.id}>
          <input type="checkbox" disabled={disabled} checked={value.groupIds.includes(group.id)} onChange={() => onChange(toggleRecipient(value, "groupIds", group.id))} />{group.name}
        </label>)}
      </div></div>
      <div><div className="pulse-label">{c.colleagues}</div><div className="pulse-target-scroll">
        {options.users.filter(user => `${user.fullName || ""} ${user.username}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(user => <label key={user.id}>
          <input type="checkbox" disabled={disabled} checked={value.userIds.includes(user.id)} onChange={() => onChange(toggleRecipient(value, "userIds", user.id))} />{user.fullName || user.username}
        </label>)}
      </div></div>
    </div>
  </div>;
}
