import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Check, Search, ShieldCheck, UsersRound } from "lucide-react";
import "./mission-agent-people.css";

type Person = { id: string; fullName: string; username?: string; avatarUrl?: string | null };
export type MissionChatSelections = Record<string, string[] | null>;

function personName(person: Person) {
  return person.fullName || person.username || person.id;
}

function initials(person: Person) {
  const source = person.fullName || person.username || person.id;
  return source.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toLocaleUpperCase();
}

function PersonAvatar({ person, size = "small" }: { person: Person; size?: "small" | "large" }) {
  return <span className={`mission-person-avatar mission-person-avatar--${size}`} aria-hidden="true">
    {person.avatarUrl
      ? <img src={person.avatarUrl} alt="" />
      : <span>{initials(person)}</span>}
  </span>;
}

export function MissionAgentChatSettings({ agents, people, selections, onChange }: {
  agents: Person[];
  people: Person[];
  selections: MissionChatSelections;
  onChange: (next: MissionChatSelections) => void;
}) {
  const { t } = useI18n();
  const c = t.taskCommunication;
  const [agentId, setAgentId] = useState("");
  const [search, setSearch] = useState("");
  const selectedAgentId = agents.some(person => person.id === agentId) ? agentId : agents[0]?.id || "";
  const selected = selections[selectedAgentId] ?? null;
  const visiblePeople = useMemo(() => people.filter(person =>
    person.id !== selectedAgentId
    && `${person.fullName || ""} ${person.username || ""}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  ), [people, selectedAgentId, search]);
  const selectedPeople = useMemo(() => people.filter(person => selected?.includes(person.id)), [people, selected]);

  useEffect(() => setSearch(""), [selectedAgentId]);

  const updateSelection = (id: string, checked: boolean) => {
    if (selected === null) return;
    onChange({
      ...selections,
      [selectedAgentId]: checked
        ? selected.includes(id) ? selected : [...selected, id]
        : selected.filter(personId => personId !== id),
    });
  };

  return <section className="mission-people-panel mission-chat-panel" data-testid="mission-agent-chat-settings">
    <header className="mission-people-heading">
      <span className="mission-people-heading-icon"><ShieldCheck size={17} strokeWidth={2} /></span>
      <div>
        <h3>{c.missionChatTitle}</h3>
        <p>{c.missionChatHint}</p>
      </div>
    </header>

    {!agents.length ? <div className="mission-people-empty">
      <UsersRound size={19} />
      <span>{c.missionChatNoAgents}</span>
    </div> : <>
      <div className="mission-chat-controls">
        <label className="mission-chat-field">
          <span>{c.missionChatAgent}</span>
          <select value={selectedAgentId} onChange={event => setAgentId(event.target.value)} data-testid="mission-chat-agent">
            {agents.map(person => <option key={person.id} value={person.id}>{personName(person)}</option>)}
          </select>
        </label>
        <label className="mission-chat-field">
          <span>{c.missionChatTitle}</span>
          <select value={selected === null ? "default" : "selected"}
            onChange={event => onChange({ ...selections, [selectedAgentId]: event.target.value === "default" ? null : [] })}
            data-testid="mission-chat-mode">
            <option value="default">{c.missionChatDefault}</option>
            <option value="selected">{c.missionChatSelected}</option>
          </select>
        </label>
      </div>

      <div className={`mission-chat-policy-note${selected === null ? " is-open" : " is-limited"}`}>
        <span className="mission-chat-policy-mark" aria-hidden="true">{selected === null ? "∞" : "•"}</span>
        <p>{selected === null ? c.missionChatDefault : c.missionChatSelected}</p>
      </div>

      {selected !== null && <>
        <div className="mission-chat-people-header">
          <div>
            <strong>{c.peopleSelectedCount.replace("{count}", String(selected.length))}</strong>
            <span>{selected.length ? selectedPeople.map(personName).join(", ") : c.missionChatNone}</span>
          </div>
          <span className="mission-chat-count">{selected.length}</span>
        </div>
        <label className="mission-chat-search">
          <Search size={16} aria-hidden="true" />
          <Input value={search} onChange={event => setSearch(event.target.value)}
            aria-label={c.missionChatSearch} placeholder={c.missionChatSearch} />
        </label>
        <div className="mission-chat-colleague-list">
          {visiblePeople.map(person => {
            const checked = selected.includes(person.id);
            return <label key={person.id} className={`mission-chat-colleague${checked ? " is-selected" : ""}`}>
              <Checkbox checked={checked} data-testid={`mission-chat-colleague-${person.id}`}
                onCheckedChange={value => updateSelection(person.id, value === true)} />
              <PersonAvatar person={person} />
              <span className="mission-chat-colleague-name">{personName(person)}
                {person.username && person.fullName && <small>@{person.username}</small>}
              </span>
              {checked && <span className="mission-chat-permitted" aria-hidden="true"><Check size={16}/></span>}
            </label>;
          })}
          {!visiblePeople.length && <p className="mission-people-no-results">{c.peopleNoResults}</p>}
        </div>
      </>}
      <p className="mission-chat-union">{c.missionChatUnion}</p>
    </>}
  </section>;
}
