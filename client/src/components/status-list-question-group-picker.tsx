import { useId, useState } from "react";
import { Layers3, Plus } from "lucide-react";
import { Button } from "./ui/button";
import { getStatusListQuestionStudioCopy } from "./status-list-question-studio-copy";
import { getStatusListRefinementCopy } from "@/i18n/status-list-refinement-translations";

export function StatusListQuestionGroupPicker({locale, questions, questionId, value, onChange}: {
  locale: string; questions: {id: string; groupName?: string | null; logicOperator?: string | null}[];
  questionId?: string | null; value: string; onChange: (name: string, logic?: string) => void;
}) {
  const c = getStatusListRefinementCopy(locale);
  const studio = getStatusListQuestionStudioCopy(locale);
  const id = useId();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const peers = questions.filter(q => q.id !== questionId);
  const groups = Array.from(new Set([...peers.map(q => q.groupName?.trim()), value.trim()].filter(Boolean))) as string[];
  const select = (group: string) => {
    onChange(group, peers.find(q => q.groupName?.trim() === group)?.logicOperator || undefined);
    setCreating(false); setName("");
  };
  return <div className="slqs-field slqs-wide" data-testid="status-list-group-picker">
    <label htmlFor={id} className="inline-flex items-center gap-2"><Layers3 size={14}/>{studio.group}</label>
    <select id={id} data-testid="status-list-question-group" value={creating ? "__create__" : value.trim()} onChange={event => {
      if (event.target.value === "__create__") {setCreating(true);setName("");}
      else select(event.target.value);
    }}>
      <option value="">{c.noGroup}</option>
      {groups.map(group => <option key={group} value={group}>{group}</option>)}
      <option value="__create__">{c.newGroup}</option>
    </select>
    {creating && <div className="flex flex-wrap items-end gap-2 rounded-xl border bg-muted/30 p-3">
      <label className="min-w-0 flex-1 text-xs" htmlFor={`${id}-new`}>{c.groupName}<input id={`${id}-new`} data-testid="status-list-new-group-name" autoFocus value={name} maxLength={120} onChange={event => setName(event.target.value)} /></label>
      <Button type="button" size="sm" disabled={!name.trim()} data-testid="status-list-create-group" onClick={() => select(name.trim())}><Plus size={14}/>{c.useGroup}</Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)}>{studio.cancel}</Button>
    </div>}
    <small>{c.groupHelp}</small>
    {!!value && <small>{c.groupRuleHelp}</small>}
  </div>;
}
