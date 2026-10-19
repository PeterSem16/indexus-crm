import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Workflow, AlertCircle } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Locale } from "@/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { statusListWorkflowSchema, type StatusListWorkflow, type WorkflowCatalogItem, type SavedStatusListWorkflow, type WorkflowRef } from "@shared/status-list-workflow";
import { isWorkflowBoolean, isWorkflowSupported, isWorkflowYesNo, workflowRefKey } from "@/lib/status-workflow-catalog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { getStatusListWorkflowCopy } from "./status-list-workflow-copy";
import { StatusListWorkflowDialog } from "./status-list-workflow-dialog";

type CatalogResponse = { rules: SavedStatusListWorkflow[]; catalog: WorkflowCatalogItem[] };

export function StatusListWorkflowEditor({ campaignId, locale }: { campaignId: string; locale: Locale | string }) {
  const copy = getStatusListWorkflowCopy(locale);
  const { toast } = useToast();
  const queryKey = ["/api/campaigns", campaignId, "status-list-workflows"];
  const endpoint = `/api/campaigns/${campaignId}/status-list-workflows`;
  const query = useQuery<CatalogResponse>({
    queryKey,
    queryFn: async () => {
      const response = await fetch(endpoint, { credentials: "include" });
      if (!response.ok) throw new Error(`${response.status}`);
      return response.json();
    },
  });
  const [editing, setEditing] = useState<SavedStatusListWorkflow | null>(null);
  const [draft, setDraft] = useState<StatusListWorkflow | null>(null);
  const [validation, setValidation] = useState("");
  const rules = query.data?.rules || [];
  const catalog = query.data?.catalog || [];
  const sourceItems = useMemo(() => catalog.filter(item => item.writable && isWorkflowSupported(item)), [catalog]);
  const close = () => { setDraft(null); setEditing(null); setValidation(""); };
  const saveMutation = useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: StatusListWorkflow }) =>
      apiRequest(id ? "PUT" : "POST", id ? `${endpoint}/${id}` : endpoint, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      close();
      toast({ title: copy.saved });
    },
    onError: () => toast({ title: copy.saveError, variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `${endpoint}/${id}`),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey }); toast({ title: copy.deleted }); },
    onError: () => toast({ title: copy.deleteError, variant: "destructive" }),
  });
  const startNew = async () => {
    const fresh = await query.refetch();
    if (fresh.isError) { toast({ title: copy.loadError, variant: "destructive" }); return; }
    const source = fresh.data?.catalog.find(item => item.writable && isWorkflowSupported(item));
    if (!source) { toast({ title: copy.noSource, variant: "destructive" }); return; }
    setEditing(null);
    setDraft({ name: "", enabled: true, source: { kind: source.kind, id: source.id }, trigger: "agent_confirmation", logic: "and", conditions: [], thenActions: [], elseActions: [] });
    setValidation("");
  };
  const startEdit = async (rule: SavedStatusListWorkflow) => {
    const fresh = await query.refetch();
    if (fresh.isError) { toast({ title: copy.loadError, variant: "destructive" }); return; }
    setEditing(rule);
    setDraft(structuredClone({ name: rule.name, enabled: rule.enabled, source: rule.source, sourceValue: rule.sourceValue, trigger: "agent_confirmation" as const, logic: rule.logic, conditions: rule.conditions, thenActions: rule.thenActions, elseActions: rule.elseActions }));
    setValidation("");
  };
  const update = (patch: Partial<StatusListWorkflow>) => {
    setDraft(current => current ? { ...current, ...patch } : current);
    setValidation("");
  };
  const apply = () => {
    if (!draft) return;
    const result = statusListWorkflowSchema.safeParse(draft);
    if (!result.success) { setValidation(result.error.issues[0]?.message || copy.invalid); return; }
    const itemFor = (ref: WorkflowRef) => catalog.find(item => workflowRefKey(item) === workflowRefKey(ref));
    const source = itemFor(result.data.source);
    const sourceValueOkay = result.data.sourceValue === undefined ||
      (isWorkflowBoolean(source) ? result.data.sourceValue === true :
        isWorkflowYesNo(source) ? result.data.sourceValue === "yes" || result.data.sourceValue === "no" : typeof result.data.sourceValue === "string");
    const refsOkay = !!source?.writable && isWorkflowSupported(source) && sourceValueOkay &&
      [...result.data.thenActions, ...result.data.elseActions].every(action => {
        const target = itemFor(action.target);
        const valueOkay = isWorkflowBoolean(target) ? action.value === true :
          isWorkflowYesNo(target) ? action.value === "yes" || action.value === "no" : typeof action.value === "string";
        return !!target?.writable && isWorkflowSupported(target) && workflowRefKey(action.target) !== workflowRefKey(result.data.source) && valueOkay;
      });
    if (!refsOkay) { setValidation(copy.invalid); return; }
    saveMutation.mutate({ id: editing?.id, data: result.data });
  };
  return <section className="rounded-xl border border-border/70 bg-card/70 p-4 shadow-sm" data-testid="status-list-workflows">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3"><span className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary"><Workflow className="h-4 w-4"/></span><div><h2 className="text-sm font-semibold">{copy.title}</h2><p className="mt-1 text-xs text-muted-foreground">{copy.subtitle}</p></div></div>
      <Button type="button" size="sm" data-testid="status-workflow-create" onClick={startNew} disabled={query.isLoading || query.isFetching || query.isError || sourceItems.length === 0}><Plus className="mr-1.5 h-3.5 w-3.5"/>{copy.add}</Button>
    </div>
    {query.isLoading && <div className="mt-4 space-y-2"><div className="h-12 animate-pulse rounded-lg bg-muted/70"/><div className="h-12 w-4/5 animate-pulse rounded-lg bg-muted/70"/></div>}
    {query.isError && <div className="mt-4 flex items-center justify-between rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm"><span className="flex items-center gap-2"><AlertCircle className="h-4 w-4"/>{copy.loadError}</span><Button type="button" size="sm" variant="outline" onClick={() => void query.refetch()}>{copy.retry}</Button></div>}
    {query.data && catalog.length === 0 && <p className="mt-4 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">{copy.noCatalog}</p>}
    {query.data && catalog.length > 0 && rules.length === 0 && <p className="mt-4 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">{copy.empty}</p>}
    {rules.length > 0 && <div className="mt-4 space-y-2">{rules.map(rule => {
      const source = catalog.find(item => workflowRefKey(item) === workflowRefKey(rule.source));
      return <div key={rule.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border/70 bg-background/70 px-3 py-2.5">
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm font-semibold">{rule.name}</strong>{!rule.enabled && <Badge variant="secondary">{copy.disabled}</Badge>}</div><p className="mt-0.5 truncate text-xs text-muted-foreground">{source?.label || rule.source.id} · {rule.conditions.length} {copy.conditions} · {rule.thenActions.length} {copy.then}</p></div>
        <Switch aria-label={copy.enabled} checked={rule.enabled} disabled={saveMutation.isPending} onCheckedChange={enabled => {
          const { id, campaignId: _campaignId, ...payload } = rule;
          saveMutation.mutate({ id, data: { ...payload, enabled } });
        }}/>
        <Button type="button" variant="ghost" size="icon" aria-label={copy.edit} onClick={() => startEdit(rule)}><Pencil className="h-4 w-4"/></Button>
        <Button type="button" variant="ghost" size="icon" aria-label={copy.delete} disabled={deleteMutation.isPending} onClick={() => { if (window.confirm(copy.confirmDelete)) deleteMutation.mutate(rule.id); }}><Trash2 className="h-4 w-4"/></Button>
      </div>;
    })}</div>}
    {draft && <StatusListWorkflowDialog open draft={draft} catalog={catalog} locale={locale} editing={!!editing} pending={saveMutation.isPending} validation={validation} onUpdate={update} onClose={close} onSave={apply}/>}
  </section>;
}
export default StatusListWorkflowEditor;
