import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search, UsersRound, UserRound, ShieldCheck, X } from "lucide-react";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AutomationEditorCopy } from "@/i18n/automation-editor-help-translations";

export type TaskRecipient = { kind: "user" | "group" | "role"; id: string };
type Props = {
  open: boolean;
  recipients: TaskRecipient[];
  users: Array<{ id: string; label: string }>;
  groups: Array<{ id: string; name: string; displayAlias?: string | null }>;
  roles: Array<{ id: string; name: string; isActive?: boolean }>;
  copy: AutomationEditorCopy;
  onOpenChange: (open: boolean) => void;
  onApply: (recipients: TaskRecipient[]) => void;
};

export function AutomationTaskRecipientDialog({ open, recipients, users, groups, roles, copy, onOpenChange, onApply }: Props) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<TaskRecipient[]>([]);
  const [view, setView] = useState<TaskRecipient["kind"]>("group");
  const [search, setSearch] = useState("");
  const priorRecipients = useRef<TaskRecipient[]>(recipients);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (!open) {
      wasOpen.current = false;
      priorRecipients.current = recipients;
      return;
    }
    if (!wasOpen.current) {
      wasOpen.current = true;
      setDraft(recipients.map(item => ({ ...item })));
      setView("group");
      setSearch("");
      priorRecipients.current = recipients;
      return;
    }
    const prior = priorRecipients.current;
    const remapped = new Map<string, TaskRecipient>();
    prior.forEach((item, index) => {
      const next = recipients[index];
      if (next && next.kind === item.kind && next.id !== item.id) {
        remapped.set(`${item.kind}:${item.id}`, { kind: next.kind, id: next.id });
      }
    });
    if (remapped.size) setDraft(current => {
      const next = current.map(item => remapped.get(`${item.kind}:${item.id}`) || item);
      const seen = new Set<string>();
      return next.filter(item => {
        const key = `${item.kind}:${item.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    });
    priorRecipients.current = recipients;
  }, [open, recipients]);

  const allOptions = useMemo(() => [
    ...groups.map(item => ({ kind: "group" as const, id: item.id, label: item.displayAlias || item.name })),
    ...users.map(item => ({ kind: "user" as const, id: item.id, label: item.label })),
    ...roles.filter(item => item.isActive !== false).map(item => ({ kind: "role" as const, id: item.id, label: item.name })),
  ], [groups, users, roles]);
  const selected = (item: TaskRecipient) => draft.some(current => current.kind === item.kind && current.id === item.id);
  const labelFor = (item: TaskRecipient) => allOptions.find(option => option.kind === item.kind && option.id === item.id)?.label;
  const filtered = allOptions.filter(item => item.kind === view && item.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const toggle = (item: TaskRecipient) => setDraft(current => selected(item)
    ? current.filter(value => value.kind !== item.kind || value.id !== item.id)
    : [...current, { kind: item.kind, id: item.id }]);
  const count = (kind: TaskRecipient["kind"]) => draft.filter(item => item.kind === kind).length;
  const kindLabel = (kind: TaskRecipient["kind"]) => kind === "group" ? copy.groups : kind === "user" ? copy.people : copy.roles;

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent
      hideCloseButton
      overlayClassName="z-[10029]"
      className="z-[10030] grid max-h-[min(680px,calc(100dvh-1rem))] w-[calc(100vw-1rem)] max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] gap-4 overflow-hidden p-4 sm:p-6"
      data-testid="task-recipient-dialog"
      onInteractOutside={event => event.preventDefault()}
    >
      <DialogHeader className="relative pr-12 text-left">
        <DialogTitle>{copy.chooseRecipients}</DialogTitle>
        <DialogDescription>{copy.selectionSummary}: {count("group")} {copy.groups.toLocaleLowerCase()} · {count("user")} {copy.people.toLocaleLowerCase()} · {count("role")} {copy.roles.toLocaleLowerCase()}</DialogDescription>
        <Button type="button" variant="ghost" size="icon" aria-label={t.common.close} title={t.common.close}
          className="absolute right-0 top-0 h-8 w-8 p-0" style={{ position: "absolute", right: 0, top: 0 }}
          onClick={() => onOpenChange(false)} data-testid="task-recipient-close"><X className="h-4 w-4" /></Button>
      </DialogHeader>
      <div className="grid min-h-0 grid-cols-1 gap-3 sm:grid-cols-[170px_minmax(0,1fr)]">
        <nav className="grid grid-cols-3 gap-1 sm:flex sm:flex-col" aria-label={copy.chooseRecipients}>
          {(["group", "user", "role"] as const).map(kind => {
            const Icon = kind === "group" ? UsersRound : kind === "user" ? UserRound : ShieldCheck;
            return <button key={kind} type="button" aria-pressed={view === kind} onClick={() => { setView(kind); setSearch(""); }}
              className={`flex min-w-0 items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition-colors ${view === kind ? "border-primary/40 bg-primary/10 text-foreground" : "border-transparent text-muted-foreground hover:bg-muted"}`}
              data-testid={`recipient-view-${kind}`}>
              <Icon className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 truncate">{kind === "group" ? copy.groupsFirst : kindLabel(kind)}</span>
              <span className="tabular-nums">{count(kind)}</span>
            </button>;
          })}
        </nav>
        <section className="flex min-h-0 min-w-0 flex-col gap-2">
          <div className="relative shrink-0"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={event => setSearch(event.target.value)} placeholder={copy.searchRecipients}
              aria-label={copy.searchRecipients} className="pl-9" data-testid="recipient-search" /></div>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
            {filtered.length ? filtered.map(item => {
              const checked = selected(item);
              return <button type="button" role="checkbox" aria-checked={checked} key={`${item.kind}:${item.id}`}
                onClick={() => toggle(item)} className={`flex w-full items-center gap-3 border-b px-3 py-2.5 text-left last:border-b-0 hover:bg-muted/70 ${checked ? "bg-primary/5" : ""}`}
                data-testid={`recipient-option-${item.kind}-${item.id}`}>
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded border ${checked ? "border-primary bg-primary text-primary-foreground" : "border-input"}`}>{checked && <Check className="h-3.5 w-3.5" />}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{item.label}</span>
                <span className="text-xs text-muted-foreground">{kindLabel(item.kind)}</span>
              </button>;
            }) : <p className="p-5 text-center text-sm text-muted-foreground">{copy.noMatches}</p>}
          </div>
          {draft.some(item => !labelFor(item)) && <div className="flex max-h-16 flex-wrap gap-1.5 overflow-y-auto" aria-label={copy.unavailable}>
            {draft.filter(item => !labelFor(item)).map(item => <button type="button" key={`${item.kind}:${item.id}`}
              className="rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground"
              title={`${copy.unavailable}: ${item.id}`} aria-label={`${copy.unavailable}: ${item.id}`}
              onClick={() => toggle(item)}>{copy.unavailable} · {item.id} <span aria-hidden="true">×</span></button>)}
          </div>}
        </section>
      </div>
      <footer className="flex justify-end gap-2 border-t pt-3">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{copy.cancel}</Button>
        <Button type="button" onClick={() => { onApply(draft); onOpenChange(false); }} data-testid="task-recipient-apply">{copy.apply}</Button>
      </footer>
    </DialogContent>
  </Dialog>;
}
