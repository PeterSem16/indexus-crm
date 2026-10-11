import { useMemo, useState } from "react";
import { useI18n } from "@/i18n";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronRight, Search, UserRound, UsersRound } from "lucide-react";
import "./mission-agent-people.css";

export type MissionAssignmentPerson = {
  id: string;
  fullName: string;
  username?: string;
  avatarUrl?: string | null;
};
export type MissionAgentRoleGroup = {
  roleId: string;
  roleName: string;
  users: MissionAssignmentPerson[];
};

function displayName(person: MissionAssignmentPerson) {
  return person.fullName || person.username || person.id;
}

function initials(person: MissionAssignmentPerson) {
  const source = person.fullName || person.username || person.id;
  return source.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toLocaleUpperCase();
}

function Avatar({ person }: { person: MissionAssignmentPerson }) {
  return <span className="mission-person-avatar mission-person-avatar--large" aria-hidden="true">
    {person.avatarUrl ? <img src={person.avatarUrl} alt="" /> : <span>{initials(person)}</span>}
  </span>;
}

export function MissionAgentAssignmentPicker({ groups, selectedIds, onChange, disabled = false }: {
  groups: MissionAgentRoleGroup[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const c = t.taskCommunication;
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredGroups = useMemo(() => groups.map(group => ({
    ...group,
    users: group.users.filter(person => !normalizedQuery
      || `${person.fullName || ""} ${person.username || ""}`.toLocaleLowerCase().includes(normalizedQuery)),
  })).filter(group => group.users.length > 0), [groups, normalizedQuery]);
  const selectedPeople = useMemo(() => groups.flatMap(group => group.users).filter(person => selectedSet.has(person.id)), [groups, selectedSet]);

  const togglePerson = (id: string, checked: boolean) => {
    onChange(checked
      ? selectedIds.includes(id) ? selectedIds : [...selectedIds, id]
      : selectedIds.filter(selectedId => selectedId !== id));
  };

  return <section className="mission-people-panel mission-assignment-panel" data-testid="mission-agent-assignment-picker">
    <header className="mission-people-heading mission-assignment-heading">
      <span className="mission-people-heading-icon"><UsersRound size={17} strokeWidth={2} /></span>
      <div>
        <h3>{c.peopleAssigned}</h3>
        <p>{c.peopleAssignmentHint}</p>
      </div>
    </header>
    <div className="mission-assignment-toolbar">
      <label className="mission-assignment-search">
        <Search size={17} aria-hidden="true" />
        <Input placeholder={c.peopleSearch} value={query} onChange={event => setQuery(event.target.value)}
          className="mission-assignment-search-input" data-testid="input-search-agents" />
      </label>
      <span className="mission-assignment-count" aria-live="polite">
        <strong>{selectedIds.length}</strong> {c.peopleSelectedCount.replace("{count}", "").trim()}
      </span>
    </div>
    {selectedPeople.length > 0 && <div className="mission-assignment-selected" aria-label={c.peopleAssigned}>
      {selectedPeople.map(person => <label key={person.id} className="mission-assignment-selected-person">
        <Checkbox checked disabled={disabled} data-testid={`checkbox-selected-agent-${person.id}`}
          onCheckedChange={value => togglePerson(person.id, value === true)} />
        <Avatar person={person} />
        <span className="mission-agent-option-copy"><span>{displayName(person)}</span></span>
      </label>)}
    </div>}
    <div className="mission-assignment-available-label">
      <span>{c.peopleAvailable}</span>
      <span>{groups.reduce((count, group) => count + group.users.length, 0)}</span>
    </div>
    <div className="mission-assignment-groups">
      {filteredGroups.map(group => {
        const isExpanded = normalizedQuery.length > 0 || expanded.has(group.roleId);
        const selectedCount = group.users.filter(person => selectedSet.has(person.id)).length;
        return <div key={group.roleId} className={`mission-role-group${selectedCount ? " has-selected" : ""}`}>
          <button type="button" className="mission-role-toggle" disabled={disabled}
            aria-expanded={isExpanded}
            onClick={() => setExpanded(current => {
              const next = new Set<string>();
              current.forEach(roleId => next.add(roleId));
              if (next.has(group.roleId)) next.delete(group.roleId);
              else next.add(group.roleId);
              return next;
            })}
            data-testid={`button-toggle-role-${group.roleId}`}>
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <span className="mission-role-title">{group.roleName}</span>
            <span className="mission-role-count">{selectedCount > 0 ? `${selectedCount} / ` : ""}{group.users.length}</span>
          </button>
          {isExpanded && <div className="mission-role-people">
            {group.users.map(person => {
              const checked = selectedSet.has(person.id);
              return <label key={person.id} className={`mission-agent-option${checked ? " is-selected" : ""}${disabled ? " is-disabled" : ""}`}>
                <Checkbox checked={checked} disabled={disabled} data-testid={`checkbox-agent-${person.id}`}
                  onCheckedChange={value => togglePerson(person.id, value === true)} />
                <Avatar person={person} />
                <span className="mission-agent-option-copy">
                  <span>{displayName(person)}</span>
                  {person.username && person.fullName && <small>@{person.username}</small>}
                </span>
                {checked && <span className="mission-agent-selected-mark"><UserRound size={13} />{c.peopleAssigned}</span>}
              </label>;
            })}
          </div>}
        </div>;
      })}
      {!filteredGroups.length && <div className="mission-people-empty">
        <Search size={19} />
        <span>{c.peopleNoResults}</span>
      </div>}
    </div>
    <p className="mission-assignment-inbox-hint">{c.peopleInboxHint}</p>
  </section>;
}
