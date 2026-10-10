import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, Trash2, ArrowRight } from "lucide-react";
import { useI18n } from "@/i18n";
import { apiRequest } from "@/lib/queryClient";
import { useTaskAssignmentOptions } from "@/hooks/use-task-assignment-options";
import { useToast } from "@/hooks/use-toast";
import { RequestRecipientPicker } from "./request-recipient-picker";
import { requestTypeLabel, type TaskRequestType } from "./request-routing-model";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import "./task-communications.css";

export function TaskRequestRouting() {
  const { t } = useI18n();
  const c = t.taskCommunication;
  const { toast } = useToast();
  const qc = useQueryClient();
  const routes = useQuery<TaskRequestType[]>({ queryKey: ["/api/task-request-types"] });
  const options = useTaskAssignmentOptions();
  const [draft, setDraft] = useState<TaskRequestType | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [switchTarget, setSwitchTarget] = useState<TaskRequestType | null>(null);
  const [dirty, setDirty] = useState(false);
  const select = (value: TaskRequestType) => {
    if (dirty) { setSwitchTarget(value); return; }
    setDraft({ ...value, groupIds: [...value.groupIds], userIds: [...value.userIds] });
  };
  const save = useMutation({
    mutationFn: async ({ row, remove }: { row: TaskRequestType; remove?: boolean }) => {
      if (remove) return apiRequest("DELETE", `/api/task-request-types/${encodeURIComponent(row.id)}`);
      const response = await apiRequest(row.id ? "PUT" : "POST", row.id ? `/api/task-request-types/${encodeURIComponent(row.id)}` : "/api/task-request-types",
        { name: row.name, enabled: row.enabled, groupIds: row.groupIds, userIds: row.userIds });
      return response.json() as Promise<TaskRequestType>;
    },
    onSuccess: (result, variables) => {
      setDraft(variables.remove ? null : result as TaskRequestType);
      setDirty(false); setDeleteOpen(false);
      void qc.invalidateQueries({ queryKey: ["/api/task-request-types"] });
    },
    onError: () => toast({ title: c.saveFailed, variant: "destructive" }),
  });
  if (routes.isLoading || options.isLoading) return <div className="p-6">{t.common.loading}</div>;
  if (routes.isError || options.isError) return <div className="p-6" role="alert">{c.loadFailed}<button onClick={() => { void routes.refetch(); void options.refetch(); }} className="ml-2 underline">{t.common.refresh}</button></div>;
  const current = draft || routes.data?.[0];
  const edit = (change: Partial<TaskRequestType>) => { if (current) { setDraft({ ...current, ...change }); setDirty(true); } };
  return <div className="pulse-live pulse-routing-root">
    <header className="pulse-heading"><div><h1>{c.routingTitle}</h1><p>{c.routingSubtitle}</p></div>
      <button className="pulse-btn primary" disabled={save.isPending} onClick={() => select({ id: "", name: c.newType, groupIds: [], userIds: [], enabled: true })}><Plus size={14}/>{c.addType}</button>
    </header>
    <div className="pulse-routing-grid">
      <aside className="pulse-panel p-3"><div className="pulse-label">{c.requestTypes}</div>
        {(routes.data || []).map(row => <button key={row.id} className={`center-task-item ${current?.id === row.id ? "is-current" : ""}`} disabled={save.isPending} onClick={() => select(row)}>
          <div className="flex items-center justify-between"><strong>{requestTypeLabel(row, t)}</strong><ArrowRight size={14}/></div>
          <span className="pulse-note">{row.enabled && row.groupIds.length + row.userIds.length ? `${row.groupIds.length + row.userIds.length} · ${t.quickCreate.assignedTo}` : c.manual}</span>
        </button>)}
      </aside>
      {current ? <article className="pulse-panel p-5">
        <label className="pulse-label" htmlFor="request-type-name">{c.requestTypes}</label>
        <input id="request-type-name" className="pulse-input mb-4" value={current.name === current.id ? requestTypeLabel(current, t) : current.name} disabled={save.isPending} maxLength={200} onChange={event => edit({ name: event.target.value })}/>
        <label className="flex items-center gap-2 mb-4 text-sm"><input type="checkbox" disabled={save.isPending} checked={current.enabled} onChange={event => edit({ enabled: event.target.checked })}/>{c.enabledRouting}</label>
        <RequestRecipientPicker value={current} options={options.data || { users: [], groups: [], canResolve: false }} disabled={save.isPending} onChange={value => edit(value)}/>
        <div className="pulse-label mt-4">{c.preview}</div>
        <div className="pulse-note">{current.enabled && current.groupIds.length + current.userIds.length ? c.sharedHint : c.manual}</div>
        <footer className="flex justify-between gap-2 mt-5">
          <button className="pulse-btn" disabled={!current.id || save.isPending} onClick={() => setDeleteOpen(true)}><Trash2 size={14}/>{t.common.delete}</button>
          <button className="pulse-btn primary" disabled={save.isPending || !current.name.trim()} onClick={() => save.mutate({ row: current })}><Save size={14}/>{t.common.save}</button>
        </footer>
      </article> : <div className="pulse-empty">{t.common.noResults}</div>}
    </div>
    <AlertDialog open={deleteOpen || !!switchTarget} onOpenChange={open => { if (!open) { setDeleteOpen(false); setSwitchTarget(null); } }}>
      <AlertDialogContent className="z-[10030]"><AlertDialogHeader><AlertDialogTitle>{deleteOpen ? t.common.delete : c.unsaved}</AlertDialogTitle>
        <AlertDialogDescription>{deleteOpen ? current && requestTypeLabel(current, t) : c.unsavedHint}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>{t.common.cancel}</AlertDialogCancel><AlertDialogAction onClick={() => {
          if (deleteOpen && current) save.mutate({ row: current, remove: true });
          else if (switchTarget) { setDraft({ ...switchTarget }); setDirty(false); setSwitchTarget(null); }
        }}>{deleteOpen ? t.common.delete : t.common.confirm}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
