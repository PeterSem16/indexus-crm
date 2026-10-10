import { useEffect, useState } from "react";
import { useI18n } from "@/i18n";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

type Person = { id: string; fullName: string; username?: string };
export type MissionChatSelections = Record<string, string[] | null>;

export function MissionAgentChatSettings({ agents, people, selections, onChange }: {
  agents: Person[]; people: Person[]; selections: MissionChatSelections;
  onChange: (next: MissionChatSelections) => void;
}) {
  const { t } = useI18n();
  const c = t.taskCommunication;
  const [agentId, setAgentId] = useState("");
  const [search, setSearch] = useState("");
  const selectedAgentId = agents.some(person => person.id === agentId) ? agentId : agents[0]?.id || "";
  const selected = selections[selectedAgentId] ?? null;
  useEffect(() => setSearch(""), [selectedAgentId]);
  return <section className="rounded-lg border bg-muted/20 p-3 space-y-2 max-h-[44dvh] overflow-y-auto shrink-0" data-testid="mission-agent-chat-settings">
    <h3 className="text-sm font-semibold">{c.missionChatTitle}</h3>
    <p className="text-xs text-muted-foreground">{c.missionChatHint}</p>
    {!agents.length ? <p className="text-xs text-muted-foreground">{c.missionChatNoAgents}</p> : <>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs">{c.missionChatAgent}
          <select className="mt-1 w-full rounded-md border bg-background p-2" value={selectedAgentId}
            onChange={event => setAgentId(event.target.value)} data-testid="mission-chat-agent">
            {agents.map(person => <option key={person.id} value={person.id}>{person.fullName || person.username || person.id}</option>)}
          </select>
        </label>
        <label className="text-xs">{c.missionChatTitle}
          <select className="mt-1 w-full rounded-md border bg-background p-2" value={selected === null ? "default" : "selected"}
            onChange={event => onChange({ ...selections, [selectedAgentId]: event.target.value === "default" ? null : [] })}
            data-testid="mission-chat-mode">
            <option value="default">{c.missionChatDefault}</option>
            <option value="selected">{c.missionChatSelected}</option>
          </select>
        </label>
      </div>
      {selected !== null && <>
        <Input value={search} onChange={event => setSearch(event.target.value)} aria-label={c.missionChatSearch} placeholder={c.missionChatSearch} className="h-8"/>
        {!selected.length && <p className="text-xs text-amber-700 dark:text-amber-400">{c.missionChatNone}</p>}
        <div className="max-h-36 overflow-y-auto space-y-1">
          {people.filter(person => person.id !== selectedAgentId
            && `${person.fullName} ${person.username || ""}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
            .map(person => <label key={person.id} className="flex items-center gap-2 rounded px-1 py-1 text-xs hover:bg-muted">
              <Checkbox checked={selected.includes(person.id)} data-testid={`mission-chat-colleague-${person.id}`}
                onCheckedChange={checked => onChange({ ...selections, [selectedAgentId]: checked
                  ? [...new Set([...selected, person.id])] : selected.filter(id => id !== person.id) })}/>
              {person.fullName || person.username || person.id}
            </label>)}
        </div>
      </>}
      <p className="text-[10px] text-muted-foreground">{c.missionChatUnion}</p>
    </>}
  </section>;
}
