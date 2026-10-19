import { useMemo, useState } from "react";
import { AlertCircle, ArrowRight, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Locale } from "@/i18n";
import type { WorkflowCatalogItem } from "@shared/status-list-workflow";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { getStatusListBackgroundCopy } from "./status-list-background-copy";
import { StatusListOptionSourcePanel } from "./status-list-option-source-panel";

type Source = { questionId: string; source: "representative_assigned" | "representative_assignment_type"; hidden: boolean };
type SourceResponse = { sources: Source[]; catalog: WorkflowCatalogItem[] };
const supports = (item: WorkflowCatalogItem, source: Source["source"], catalog: WorkflowCatalogItem[]) => {
  if (item.kind !== "question" || item.multiSelectable === true) return false;
  const seen = new Set<string>();
  let parentId = item.parentId;
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = catalog.find(entry => entry.kind === "item" && entry.id === parentId);
    if (!parent) break;
    if (parent.multiSelectable === false) return false;
    parentId = parent.parentId;
  }
  return source === "representative_assigned"
    ? ["yesno", "yes_no"].includes(item.fieldType.toLowerCase())
    : ["text", "string"].includes(item.fieldType.toLowerCase());
};

export function StatusListBackgroundSourcePanel({ campaignId, locale }: { campaignId: string; locale: Locale | string }) {
  const copy = getStatusListBackgroundCopy(locale);
  const { toast } = useToast();
  const endpoint = `/api/campaigns/${campaignId}/status-list-workflows/sources`;
  const queryKey = [endpoint];
  const catalogQueryKey = ["/api/campaigns", campaignId, "status-list-workflows"];
  const query = useQuery<SourceResponse>({
    queryKey,
    queryFn: async () => {
      const response = await fetch(endpoint, { credentials: "include" });
      if (!response.ok) throw new Error(String(response.status));
      return response.json();
    },
  });
  const [questionId, setQuestionId] = useState("");
  const [source, setSource] = useState<Source["source"]>("representative_assigned");
  const [hidden, setHidden] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const owned = query.data?.sources || [];
  const catalog = query.data?.catalog || [];
  const questions = useMemo(() => catalog.filter(item =>
    item.kind === "question" && supports(item, source, catalog) &&
    (!owned.some(entry => entry.questionId === item.id) || item.id === editing)
  ), [catalog, source, owned, editing]);
  const hasAvailable = catalog.some(item => item.kind === "question" &&
    (supports(item, "representative_assigned", catalog) || supports(item, "representative_assignment_type", catalog)) &&
    !owned.some(entry => entry.questionId === item.id));
  const editingQuestion = catalog.find(item => item.kind === "question" && item.id === editing);
  const reset = () => { setEditing(null); setQuestionId(""); setSource("representative_assigned"); setHidden(false); };
  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${endpoint}/${encodeURIComponent(questionId)}`, {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, hidden }),
      });
      if (!response.ok) throw new Error(String(response.status));
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: catalogQueryKey }),
      ]);
      toast({ title: copy.saved }); reset();
    },
    onError: () => toast({ title: copy.saveError, variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${endpoint}/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" });
      if (!response.ok) throw new Error(String(response.status));
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: catalogQueryKey }),
      ]);
      toast({ title: copy.deleted }); reset();
    },
    onError: () => toast({ title: copy.deleteError, variant: "destructive" }),
  });
  const editSource = (entry: Source) => {
    setEditing(entry.questionId);
    setQuestionId(entry.questionId);
    setSource(entry.source);
    setHidden(entry.hidden);
  };
  const begin = () => {
    reset();
    const first = catalog.find(item => item.kind === "question" && supports(item, "representative_assigned", catalog) && !owned.some(entry => entry.questionId === item.id));
    const type = first ? "representative_assigned" : "representative_assignment_type";
    const candidate = catalog.find(item => item.kind === "question" && supports(item, type, catalog) && !owned.some(entry => entry.questionId === item.id));
    setSource(type);
    setQuestionId(candidate?.id || "");
  };
  const labelFor = (entry: Source) => catalog.find(item => item.kind === "question" && item.id === entry.questionId)?.label || entry.questionId;
  return <><section className="mt-4 rounded-xl border border-border/70 bg-background/65 p-3" data-testid="status-list-background-sources">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="text-sm font-semibold">{copy.title}</h3><p className="mt-1 text-xs text-muted-foreground">{copy.subtitle}</p></div>
      {!editing && <Button type="button" size="sm" variant="outline" onClick={begin} disabled={query.isLoading || query.isFetching || query.isError || !hasAvailable}><Plus className="mr-1.5 h-3.5 w-3.5"/>{copy.add}</Button>}
    </header>
    {query.isLoading && <div className="mt-3 h-12 animate-pulse rounded-lg bg-muted/60"/>}
    {query.isError && <div className="mt-3 flex items-center justify-between rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm"><span className="flex items-center gap-2"><AlertCircle className="h-4 w-4"/>{copy.loadError}</span><Button type="button" size="sm" variant="outline" onClick={() => void query.refetch()}><RefreshCw className="mr-1.5 h-3.5 w-3.5"/>{copy.retry}</Button></div>}
    {query.data && !owned.length && !editing && <p className="mt-3 rounded-lg bg-muted/45 p-3 text-sm text-muted-foreground">{copy.none}</p>}
    {!!owned.length && <div className="mt-3 space-y-2">{owned.map(entry => <div key={entry.questionId} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-3 py-2">
      <div className="min-w-0 w-full sm:w-auto sm:flex-1"><strong className="block break-words text-sm">{labelFor(entry)}</strong><span className="text-xs text-muted-foreground">{entry.source === "representative_assigned" ? copy.assigned : copy.assignmentType}{entry.hidden ? ` · ${copy.hidden}` : ""}</span></div>
      <span className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">{copy.readonly}</span>
      <Button type="button" size="icon" variant="ghost" aria-label={copy.edit} onClick={() => editSource(entry)}><Pencil className="h-4 w-4"/></Button>
      <Button type="button" size="icon" variant="ghost" aria-label={copy.remove} disabled={deleteMutation.isPending} onClick={() => { if (window.confirm(copy.clearConfirm)) deleteMutation.mutate(entry.questionId); }}><Trash2 className="h-4 w-4"/></Button>
    </div>)}</div>}
    {editing !== null || (questionId && !owned.some(entry => entry.questionId === questionId)) ? <div className="mt-3 rounded-lg border border-primary/20 bg-primary/[0.035] p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-medium text-muted-foreground"><span>{copy.source}</span><select className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground" value={source} disabled={saveMutation.isPending} onChange={event => { const next = event.target.value as Source["source"]; setSource(next); const first = catalog.find(item => item.kind === "question" && supports(item, next, catalog) && (!owned.some(entry => entry.questionId === item.id) || item.id === editing)); setQuestionId(first?.id || ""); }}><option value="representative_assigned" disabled={editing !== null && !supports(editingQuestion!, "representative_assigned", catalog)}>{copy.assigned}</option><option value="representative_assignment_type" disabled={editing !== null && !supports(editingQuestion!, "representative_assignment_type", catalog)}>{copy.assignmentType}</option></select></label>
        <label className="grid gap-1 text-xs font-medium text-muted-foreground"><span>{copy.question}</span><select className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground" value={questionId} disabled={saveMutation.isPending || editing !== null || !questions.length} onChange={event => setQuestionId(event.target.value)}><option value="" disabled>{copy.compatibleEmpty}</option>{questions.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{copy.typeHint}</p>
      <label className="mt-3 flex items-center gap-2 text-sm"><Switch checked={hidden} disabled={saveMutation.isPending} onCheckedChange={setHidden}/>{copy.hidden}</label>
      <p className="mt-3 border-l-2 border-primary/35 pl-2.5 text-xs leading-relaxed text-muted-foreground">{copy.notice}</p>
      <div className="mt-3 flex justify-end gap-2"><Button type="button" size="sm" variant="ghost" onClick={reset} disabled={saveMutation.isPending}>{copy.cancel}</Button><Button type="button" size="sm" onClick={() => saveMutation.mutate()} disabled={!questionId || saveMutation.isPending}>{saveMutation.isPending ? copy.saving : copy.save}<ArrowRight className="ml-1.5 h-3.5 w-3.5"/></Button></div>
    </div> : null}
  </section><StatusListOptionSourcePanel campaignId={campaignId} locale={locale}/></>;
}
