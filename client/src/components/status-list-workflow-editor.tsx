import { useMemo, useState, type ComponentProps } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Workflow, AlertCircle, EyeOff, Lock, Loader2, Check } from "lucide-react";
import type { Locale } from "@/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { statusListWorkflowSchema, type StatusListWorkflow, type WorkflowAction, type WorkflowAnswer, type WorkflowCatalogItem, type WorkflowCondition, type WorkflowRef, type SavedStatusListWorkflow } from "@shared/status-list-workflow";
import { AutomationBlockEditor } from "@/components/automation-block-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent as BaseSelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getStatusListWorkflowCopy } from "@/components/status-list-workflow-copy";

type CatalogResponse = { rules: SavedStatusListWorkflow[]; catalog: WorkflowCatalogItem[] };
// Select portals do not inherit the focused Automation modal's stacking context.
const SelectContent = (props: ComponentProps<typeof BaseSelectContent>) =>
  <BaseSelectContent {...props} className={`!z-[10040] ${props.className || ""}`} />;
const refKey = (ref?: WorkflowRef) => ref ? `${ref.kind}:${ref.id}` : "";
const refFromKey = (value: string): WorkflowRef => {
  const [kind, ...id] = value.split(":");
  return { kind: kind as WorkflowRef["kind"], id: id.join(":") };
};
const isBoolean = (item?: WorkflowCatalogItem) => ["checkbox", "radio"].includes((item?.fieldType || "").toLowerCase());
const isYesNo = (item?: WorkflowCatalogItem) => ["yesno", "yes_no"].includes((item?.fieldType || "").toLowerCase());
const isSupportedSource = (item: WorkflowCatalogItem) => item.kind === "item" || isBoolean(item) || isYesNo(item) || ["text", "string", "number", "date"].includes(item.fieldType.toLowerCase());
const defaultAnswer = (item?: WorkflowCatalogItem): WorkflowAnswer => item?.kind === "item" || isBoolean(item) ? true : isYesNo(item) ? "yes" : "";
const answerFor = (item: WorkflowCatalogItem | undefined, value: string): WorkflowAnswer =>
  item?.kind === "item" || isBoolean(item) ? value === "true" : value;
const answerInput = (value: WorkflowAnswer | undefined, item: WorkflowCatalogItem | undefined, onChange: (value: WorkflowAnswer) => void, copy: ReturnType<typeof getStatusListWorkflowCopy>, options?: { allowFalse?: boolean; testId?: string }) =>
  isBoolean(item) ? <Select value={String(value ?? true)} onValueChange={v => onChange(v === "true")}><SelectTrigger data-testid={options?.testId}><SelectValue/></SelectTrigger><SelectContent><SelectItem value="true">{copy.booleanTrue}</SelectItem>{options?.allowFalse && <SelectItem value="false">{copy.booleanFalse}</SelectItem>}</SelectContent></Select>
    : isYesNo(item) ? <Select value={String(value ?? "yes")} onValueChange={v => onChange(v)}><SelectTrigger data-testid={options?.testId}><SelectValue/></SelectTrigger><SelectContent><SelectItem value="yes">{copy.yes}</SelectItem><SelectItem value="no">{copy.no}</SelectItem></SelectContent></Select>
    : <Input data-testid={options?.testId} type={item?.fieldType.toLowerCase() === "number" ? "number" : item?.fieldType.toLowerCase() === "date" ? "date" : "text"} value={typeof value === "string" ? value : ""} onChange={e => onChange(e.target.value)} />;

const FIELD_LABEL: Record<WorkflowCondition["field"], keyof ReturnType<typeof getStatusListWorkflowCopy>> = {
  answer: "answer", hospital_id: "hospital", clinic_id: "clinic", status: "status", contact_type: "contactType",
};
const OP_LABEL: Record<WorkflowCondition["op"], keyof ReturnType<typeof getStatusListWorkflowCopy>> = {
  equals: "equals", not_equals: "notEquals", empty: "opEmpty", not_empty: "opNotEmpty",
};

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
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<StatusListWorkflow | null>(null);
  const [validation, setValidation] = useState("");
  const [focusedBlock, setFocusedBlock] = useState<"overview" | "when" | "if" | "then" | "else">("overview");
  const rules = query.data?.rules || [];
  const catalog = query.data?.catalog || [];
  const sourceItems = useMemo(() => catalog.filter(item => item.writable && isSupportedSource(item)), [catalog]);
  const writableItems = useMemo(() => catalog.filter(item => item.writable && isSupportedSource(item)), [catalog]);

  const saveMutation = useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: StatusListWorkflow }) =>
      apiRequest(id ? "PUT" : "POST", id ? `${endpoint}/${id}` : endpoint, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      setOpen(false); setDraft(null); setEditing(null); setValidation("");
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
    const source = (fresh.data?.catalog || []).filter(item => item.writable && isSupportedSource(item))[0];
    if (!source) { toast({ title: copy.noSource, variant: "destructive" }); return; }
    setEditing(null);
    setDraft({ name: "", enabled: true, source: { kind: source.kind, id: source.id }, trigger: "agent_confirmation", logic: "and", conditions: [], thenActions: [], elseActions: [] });
    setValidation(""); setFocusedBlock("overview"); setOpen(true);
  };
  const startEdit = async (rule: SavedStatusListWorkflow) => {
    await query.refetch();
    setEditing(rule);
    setDraft(structuredClone({ name: rule.name, enabled: rule.enabled, source: rule.source, sourceValue: rule.sourceValue, trigger: "agent_confirmation" as const, logic: rule.logic, conditions: rule.conditions, thenActions: rule.thenActions, elseActions: rule.elseActions }));
    setValidation(""); setFocusedBlock("overview"); setOpen(true);
  };
  const close = () => { setOpen(false); setDraft(null); setEditing(null); setValidation(""); setFocusedBlock("overview"); };
  const update = (patch: Partial<StatusListWorkflow>) => setDraft(current => current ? { ...current, ...patch } : current);
  const catalogItem = (ref?: WorkflowRef) => catalog.find(item => item.kind === ref?.kind && item.id === ref?.id);
  const targets = writableItems.filter(item => refKey({ kind: item.kind, id: item.id }) !== refKey(draft?.source));
  const apply = () => {
    if (!draft) return;
    const result = statusListWorkflowSchema.safeParse(draft);
    if (!result.success) { setValidation(result.error.issues[0]?.message || copy.invalid); return; }
    const sourceItem = catalogItem(result.data.source);
    const sourceValueOkay = result.data.sourceValue === undefined ||
      (result.data.source.kind === "item" ? result.data.sourceValue === true :
        isBoolean(sourceItem) ? result.data.sourceValue === true :
          isYesNo(sourceItem) ? result.data.sourceValue === "yes" || result.data.sourceValue === "no" : typeof result.data.sourceValue === "string");
    const refsOkay = !!sourceItem?.writable && isSupportedSource(sourceItem) && sourceValueOkay &&
      [...result.data.thenActions, ...result.data.elseActions].every(action => {
      const target = catalogItem(action.target);
      const valueOkay = action.target.kind === "item" ? action.value === true :
        isBoolean(target) ? action.value === true :
          isYesNo(target) ? action.value === "yes" || action.value === "no" : typeof action.value === "string";
      return !!target?.writable && isSupportedSource(target) && refKey(action.target) !== refKey(result.data.source) && valueOkay;
    });
    if (!refsOkay) { setValidation(copy.invalid); return; }
    setValidation("");
    saveMutation.mutate({ id: editing?.id, data: result.data });
  };
  const setAction = (branch: "thenActions" | "elseActions", index: number, action: WorkflowAction) =>
    update({ [branch]: (draft?.[branch] || []).map((entry, i) => i === index ? action : entry) } as Partial<StatusListWorkflow>);

  return <section className="rounded-xl border border-border/70 bg-card/70 p-4 shadow-sm" data-testid="status-list-workflows">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary"><Workflow className="h-4 w-4"/></span>
        <div><h2 className="text-sm font-semibold">{copy.title}</h2><p className="mt-1 text-xs text-muted-foreground">{copy.subtitle}</p></div>
      </div>
       <Button type="button" size="sm" data-testid="status-workflow-create" onClick={startNew} disabled={query.isLoading || query.isFetching || query.isError || sourceItems.length === 0}><Plus className="mr-1.5 h-3.5 w-3.5"/>{copy.add}</Button>
    </div>
    {query.isLoading && <div className="mt-4 space-y-2"><div className="h-12 animate-pulse rounded-lg bg-muted/70"/><div className="h-12 w-4/5 animate-pulse rounded-lg bg-muted/70"/></div>}
    {query.isError && <div className="mt-4 flex items-center justify-between rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm"><span className="flex items-center gap-2"><AlertCircle className="h-4 w-4"/>{copy.loadError}</span><Button type="button" size="sm" variant="outline" onClick={() => void query.refetch()}>{copy.retry}</Button></div>}
    {query.data && catalog.length === 0 && <p className="mt-4 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">{copy.noCatalog}</p>}
    {query.data && catalog.length > 0 && rules.length === 0 && <p className="mt-4 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">{copy.empty}</p>}
    {rules.length > 0 && <div className="mt-4 space-y-2">{rules.map(rule => {
      const source = catalog.find(item => item.kind === rule.source.kind && item.id === rule.source.id);
      return <div key={rule.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border/70 bg-background/70 px-3 py-2.5">
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{rule.name}</strong>{!rule.enabled && <Badge variant="secondary">{copy.disabled}</Badge>}</div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{source?.label || rule.source.id} · {rule.conditions.length} {copy.conditions} · {rule.thenActions.length} {copy.then}</p></div>
        <Switch aria-label={copy.enabled} checked={rule.enabled} disabled={saveMutation.isPending} onCheckedChange={enabled => {
          const { id, campaignId: _campaignId, ...payload } = rule;
          saveMutation.mutate({ id, data: { ...payload, enabled } });
        }}/>
        <Button type="button" variant="ghost" size="icon" aria-label={copy.edit} onClick={() => startEdit(rule)}><Pencil className="h-4 w-4"/></Button>
        <Button type="button" variant="ghost" size="icon" aria-label={copy.delete} disabled={deleteMutation.isPending} onClick={() => { if (window.confirm(copy.confirmDelete)) deleteMutation.mutate(rule.id); }}><Trash2 className="h-4 w-4"/></Button>
      </div>;
    })}</div>}
    <AutomationBlockEditor open={open} title={editing ? copy.edit : copy.create} onCancel={close}
      onApply={() => focusedBlock === "overview" ? apply() : setFocusedBlock("overview")} disabled={saveMutation.isPending || !draft}>
      {draft && <div className="space-y-4">
        {focusedBlock === "overview" ? <>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-1.5"><Label>{copy.name}</Label><Input data-testid="status-workflow-name" value={draft.name} onChange={event => update({ name: event.target.value })} maxLength={180}/></div>
            <div className="flex items-center gap-2 pb-2"><Switch checked={draft.enabled} onCheckedChange={enabled => update({ enabled })}/><Label>{copy.enabled}</Label></div>
          </div>
          <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">{copy.writeNotice}</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {(["when", "if", "then", "else"] as const).map(block => {
              const title = copy[block];
              const summary = block === "when"
                ? catalogItem(draft.source)?.label || copy.source
                : block === "if"
                  ? draft.conditions.length ? `${copy.conditionCount.replace("{count}", String(draft.conditions.length))} · ${draft.logic === "and" ? copy.all : copy.any}` : copy.noConditions
                  : (block === "then" ? draft.thenActions : draft.elseActions).length
                    ? copy.writeCount.replace("{count}", String((block === "then" ? draft.thenActions : draft.elseActions).length))
                    : copy.noWrites;
              const count = block === "if" ? draft.conditions.length : block === "then" ? draft.thenActions.length : block === "else" ? draft.elseActions.length : undefined;
              return <button key={block} type="button" data-testid={`status-workflow-overview-${block}`} onClick={() => setFocusedBlock(block)}
                className="group flex min-h-20 items-center justify-between rounded-lg border border-border/70 bg-background/70 px-3 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5">
                <span><span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">{title}</span><span className="mt-1 block text-sm font-medium">{summary}</span></span>
                {count !== undefined && <Badge variant="secondary">{count}</Badge>}
                {block === "when" && <Pencil className="h-4 w-4 text-muted-foreground group-hover:text-primary"/>}
              </button>;
            })}
          </div>
          {validation && <p role="alert" className="text-sm text-destructive">{validation === "Enter a rule name." ? copy.nameRequired : validation === "Array must contain at least 1 element(s)" ? copy.actionRequired : copy.invalid}</p>}
          {saveMutation.isPending && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin"/>{copy.saving}</p>}
          <Button type="button" className="w-full" data-testid="status-workflow-save" disabled={saveMutation.isPending} onClick={apply}>{saveMutation.isPending ? copy.saving : copy.save}</Button>
        </> : <>
          <div className="flex items-center gap-2 border-b border-border/70 pb-3">
            <Button type="button" variant="outline" size="sm" data-testid="status-workflow-overview-back" onClick={() => setFocusedBlock("overview")}>{copy.backToOverview}</Button>
            <h3 className="text-sm font-semibold">{copy[focusedBlock]}</h3>
          </div>
          {focusedBlock === "when" && <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>{copy.source}</Label><Select value={refKey(draft.source)} onValueChange={value => update({ source: refFromKey(value), sourceValue: undefined })}><SelectTrigger data-testid="status-workflow-source"><SelectValue/></SelectTrigger><SelectContent>
              {sourceItems.map(item => <SelectItem key={refKey({ kind: item.kind, id: item.id })} value={refKey({ kind: item.kind, id: item.id })}>{item.parentLabel ? `${item.parentLabel} / ` : ""}{item.label}</SelectItem>)}
            </SelectContent></Select></div>
            <div className="space-y-1.5"><Label>{copy.sourceValue}</Label>
              {draft.source.kind === "item" || isBoolean(catalogItem(draft.source)) || isYesNo(catalogItem(draft.source))
                ? <Select value={draft.sourceValue === undefined ? "any" : String(draft.sourceValue)} onValueChange={value => update({ sourceValue: value === "any" ? undefined : answerFor(catalogItem(draft.source), value) })}>
                    <SelectTrigger data-testid="status-workflow-source-value"><SelectValue/></SelectTrigger><SelectContent>
                      <SelectItem value="any">{copy.optional}</SelectItem>
                      {(draft.source.kind === "item" || isBoolean(catalogItem(draft.source)) ? ["true"] : ["yes", "no"]).map(value => <SelectItem key={value} value={value}>{value === "true" ? copy.booleanTrue : value === "yes" ? copy.yes : copy.no}</SelectItem>)}
                    </SelectContent>
                  </Select>
                : <Input data-testid="status-workflow-source-value" type={catalogItem(draft.source)?.fieldType.toLowerCase() === "number" ? "number" : catalogItem(draft.source)?.fieldType.toLowerCase() === "date" ? "date" : "text"} value={typeof draft.sourceValue === "string" ? draft.sourceValue : ""} placeholder={copy.optional} onChange={event => update({ sourceValue: event.target.value || undefined })}/>}
          </div></div>}
          {focusedBlock === "if" && <div className="space-y-3 rounded-lg border border-border/70 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-xs font-semibold uppercase tracking-wider">{copy.conditions}</h3><Select value={draft.logic} onValueChange={logic => update({ logic: logic as "and" | "or" })}><SelectTrigger className="h-8 w-56" data-testid="status-workflow-condition-logic"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="and">{copy.all}</SelectItem><SelectItem value="or">{copy.any}</SelectItem></SelectContent></Select></div>
            {draft.conditions.map((condition, index) => <div key={index} className="grid gap-2 rounded-md bg-muted/35 p-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <Select value={condition.field} onValueChange={field => { const ref = field === "answer" ? catalog[0] : undefined; const next = [...draft.conditions]; next[index] = { field: field as WorkflowCondition["field"], op: "equals", ...(ref ? { ref: { kind: ref.kind, id: ref.id } } : {}), ...(field === "answer" ? { value: defaultAnswer(ref) } : { value: "" }) }; update({ conditions: next }); }}>
                <SelectTrigger data-testid={`status-workflow-condition-field-${index}`}><SelectValue/></SelectTrigger><SelectContent>{(Object.keys(FIELD_LABEL) as WorkflowCondition["field"][]).map(field => <SelectItem key={field} value={field}>{copy[FIELD_LABEL[field]]}</SelectItem>)}</SelectContent></Select>
              {condition.field === "answer" ? <Select value={refKey(condition.ref)} onValueChange={value => { const ref = refFromKey(value); const next = [...draft.conditions]; next[index] = { ...condition, ref, value: defaultAnswer(catalogItem(ref)) }; update({ conditions: next }); }}><SelectTrigger data-testid={`status-workflow-condition-ref-${index}`}><SelectValue/></SelectTrigger><SelectContent>{catalog.map(item => <SelectItem key={refKey({ kind: item.kind, id: item.id })} value={refKey({ kind: item.kind, id: item.id })}>{item.label}</SelectItem>)}</SelectContent></Select> : <div/>}
              <Select value={condition.op} onValueChange={op => { const next = [...draft.conditions]; next[index] = { ...condition, op: op as WorkflowCondition["op"], value: ["empty", "not_empty"].includes(op) ? undefined : condition.value ?? defaultAnswer(catalogItem(condition.ref)) }; update({ conditions: next }); }}><SelectTrigger data-testid={`status-workflow-condition-op-${index}`}><SelectValue/></SelectTrigger><SelectContent>{(Object.keys(OP_LABEL) as WorkflowCondition["op"][]).map(op => <SelectItem key={op} value={op}>{copy[OP_LABEL[op]]}</SelectItem>)}</SelectContent></Select>
              {["equals", "not_equals"].includes(condition.op) && (condition.field === "answer" && (isBoolean(catalogItem(condition.ref)) || isYesNo(catalogItem(condition.ref)))
                ? answerInput(condition.value, catalogItem(condition.ref), value => { const next = [...draft.conditions]; next[index] = { ...condition, value }; update({ conditions: next }); }, copy, { allowFalse: true, testId: `status-workflow-condition-value-${index}` })
                : <Input data-testid={`status-workflow-condition-value-${index}`} aria-label={copy.value} value={typeof condition.value === "string" ? condition.value : String(condition.value ?? "")} onChange={e => { const next = [...draft.conditions]; next[index] = { ...condition, value: e.target.value }; update({ conditions: next }); }}/>)}
              <Button type="button" variant="ghost" size="icon" aria-label={copy.remove} onClick={() => update({ conditions: draft.conditions.filter((_, i) => i !== index) })}><Trash2 className="h-4 w-4"/></Button>
            </div>)}
            <Button type="button" size="sm" variant="outline" data-testid="status-workflow-add-condition" disabled={draft.conditions.length >= 20} onClick={() => {
              const ref = catalog[0]; update({ conditions: [...draft.conditions, { field: "answer", ref: ref ? { kind: ref.kind, id: ref.id } : undefined, op: "equals", value: defaultAnswer(ref) }] });
            }}><Plus className="mr-1 h-3.5 w-3.5"/>{copy.addCondition}</Button>
          </div>}
          {(focusedBlock === "then" || focusedBlock === "else") && (() => {
            const branch = focusedBlock === "then" ? "thenActions" : "elseActions";
            const branchName = focusedBlock === "then" ? "then" : "else";
            return <div className="space-y-3 rounded-lg border border-border/70 p-3">
              <div className="flex items-center justify-between"><h3 className="text-xs font-semibold uppercase tracking-wider">{copy[branchName]}</h3>
                <Button type="button" size="sm" variant="outline" data-testid={`status-workflow-add-${branchName}-action`} disabled={!targets.length || draft[branch].length >= 10} onClick={() => {
                  const target = targets[0]; update({ [branch]: [...draft[branch], { type: "set_answer", target: { kind: target.kind, id: target.id }, value: defaultAnswer(target), mode: "if_empty" }] } as Partial<StatusListWorkflow>);
                }}><Plus className="mr-1 h-3.5 w-3.5"/>{copy.addAction}</Button>
              </div>
              {draft[branch].map((action, index) => {
                const target = catalogItem(action.target);
                return <div key={index} className="grid gap-2 rounded-md bg-muted/35 p-2 sm:grid-cols-[1.4fr_1fr_1fr_1.2fr_auto]">
                  <Select value={refKey(action.target)} onValueChange={value => { const item = catalog.find(entry => refKey({ kind: entry.kind, id: entry.id }) === value)!; setAction(branch, index, { ...action, target: { kind: item.kind, id: item.id }, value: defaultAnswer(item) }); }}><SelectTrigger data-testid={`status-workflow-${branchName}-target-${index}`}><SelectValue placeholder={copy.target}/></SelectTrigger><SelectContent>
                    {catalog.map(item => <SelectItem key={refKey({ kind: item.kind, id: item.id })} value={refKey({ kind: item.kind, id: item.id })} disabled={!item.writable || !isSupportedSource(item) || refKey({ kind: item.kind, id: item.id }) === refKey(draft.source)}>
                      <span className="flex items-center gap-2">{item.label}{item.hidden && <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{copy.hidden}</Badge>}{!item.writable && <Badge variant="outline" className="px-1.5 py-0 text-[10px]">{copy.readOnly}</Badge>}</span>
                    </SelectItem>)}
                  </SelectContent></Select>
                  <div data-testid={`status-workflow-${branchName}-answer-${index}`}>{action.target.kind === "item" ? <div className="flex items-center gap-2 text-xs text-muted-foreground"><Check className="h-4 w-4"/>{copy.booleanTrue}</div> : answerInput(action.value, target, value => setAction(branch, index, { ...action, value }), copy, { allowFalse: false })}</div>
                  <Select value={action.mode} onValueChange={mode => setAction(branch, index, { ...action, mode: mode as WorkflowAction["mode"] })}><SelectTrigger data-testid={`status-workflow-${branchName}-mode-${index}`}><SelectValue/></SelectTrigger><SelectContent><SelectItem value="if_empty">{copy.ifEmpty}</SelectItem><SelectItem value="replace">{copy.replace}</SelectItem></SelectContent></Select>
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">{target?.hidden && <><EyeOff className="h-3 w-3"/>{copy.hidden}</>}{target && !target.writable && <><Lock className="h-3 w-3"/>{copy.readOnly}</>}</span>
                  <Button type="button" variant="ghost" size="icon" aria-label={copy.remove} onClick={() => update({ [branch]: draft[branch].filter((_, i) => i !== index) } as Partial<StatusListWorkflow>)}><Trash2 className="h-4 w-4"/></Button>
                </div>;
              })}
              {focusedBlock === "then" && !targets.length && <p className="text-xs text-muted-foreground">{copy.sourceWarning}</p>}
            </div>;
          })()}
          {validation && <p role="alert" className="text-sm text-destructive">{validation === "Enter a rule name." ? copy.nameRequired : validation === "Array must contain at least 1 element(s)" ? copy.actionRequired : copy.invalid}</p>}
        </>}
      </div>}
    </AutomationBlockEditor>
  </section>;
}

export default StatusListWorkflowEditor;
