import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StatusListHelp } from "./status-list-help";
import { getStatusListSetupGuide } from "./status-list-setup-guide-copy";
import { AlertCircle, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Locale } from "@/i18n";
import type { WorkflowCatalogItem } from "@shared/status-list-workflow";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { getStatusListBackgroundCopy } from "./status-list-background-copy";
import { StatusListOptionSourcePanel } from "./status-list-option-source-panel";
import { StatusListHealthcareSetup } from "./status-list-healthcare-setup";
import { getSourceEditorCopy } from "./status-list-source-editor-copy";
import { StatusListSourceEditor, type SourceEditorStage } from "./status-list-source-editor";
import { useStatusListConfirm } from "./status-list-confirm";
import { StatusListSourceTargetButton } from "./status-list-source-target-button";
import { getStatusListRefinementCopy } from "@/i18n/status-list-refinement-translations";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { StatusListRepresentativeCheckSettings } from "./status-list-representative-check-settings";
import { getRepresentativeCheckCopy } from "@/i18n/status-list-representative-check-copy";
import { defaultRepresentativeCheck, type RepresentativeCheckConfig } from "@shared/status-list-representative-check";
import { StatusListBackgroundActions } from "./status-list-background-actions";
import { getBackgroundActionCopy } from "./status-list-background-action-copy";

type Source = { questionId: string; source: "representative_assigned" | "representative_assignment_type"; hidden: boolean; showInformation?: boolean; check?: RepresentativeCheckConfig | null };
type SourceResponse = { sources: Source[]; catalog: WorkflowCatalogItem[] };
const supports = (item: WorkflowCatalogItem, source: Source["source"], catalog: WorkflowCatalogItem[]) => {
  if (item.kind !== "question" || !item.systemSourceEligible) return false;
  return source === "representative_assigned"
    ? ["yesno", "yes_no"].includes(item.fieldType.toLowerCase())
    : ["text", "string"].includes(item.fieldType.toLowerCase());
};

export function StatusListBackgroundSourcePanel({ campaignId, locale, targetItemId, targetQuestionId, hideOptionSources = false, onDirtyChange }: { campaignId: string; locale: Locale | string; targetItemId?: string; targetQuestionId?: string; hideOptionSources?: boolean; onDirtyChange?: (dirty: boolean) => void }) {
  const copy = getStatusListBackgroundCopy(locale);
  const checkCopy = getRepresentativeCheckCopy(locale);
  const confirm = useStatusListConfirm(locale);
  const editorCopy = getSourceEditorCopy(locale);
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
  const [showInformation, setShowInformation] = useState(false);
  const [check, setCheck] = useState<RepresentativeCheckConfig>(defaultRepresentativeCheck);
  const [editing, setEditing] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [stage, setStage] = useState<SourceEditorStage>("source");
  const [baseline, setBaseline] = useState("");
  const ownDirtyRef = useRef(false);
  const optionDirtyRef = useRef(false);
  const reportOptionDirty = useCallback((optionDirty: boolean) => {
    optionDirtyRef.current = optionDirty;
    onDirtyChange?.(optionDirty || ownDirtyRef.current);
  }, [onDirtyChange]);
  const catalog = query.data?.catalog || [];
  const relevant = (id: string) => (!targetQuestionId || id === targetQuestionId) && (!targetItemId || catalog.some(item => item.id === id && item.parentId === targetItemId));
  const owned = (query.data?.sources || []).filter(entry => relevant(entry.questionId));
  const questions = useMemo(() => catalog.filter(item =>
    item.kind === "question" && relevant(item.id) && supports(item, source, catalog) &&
    (!owned.some(entry => entry.questionId === item.id) || item.id === editing)
  ), [catalog, source, owned, editing]);
  const hasAvailable = catalog.some(item => item.kind === "question" && relevant(item.id) &&
    (supports(item, "representative_assigned", catalog) || supports(item, "representative_assignment_type", catalog)) &&
    !owned.some(entry => entry.questionId === item.id));
  const parentAllowsQuestion = !targetItemId || catalog.find(item => item.kind === "item" && item.id === targetItemId)?.systemSourceEligible !== false;
  const editingQuestion = catalog.find(item => item.kind === "question" && item.id === editing);
  const hasValidQuestion = questions.some(item => item.id === questionId);
  const canCreateOnSave = !questionId && !editing && !targetQuestionId && !questions.length &&
    parentAllowsQuestion && !query.isFetching && !query.isError;
  const canSaveSource = hasValidQuestion || canCreateOnSave;
  const saveBlockedReason = !parentAllowsQuestion || targetQuestionId && !questions.length
    ? getStatusListRefinementCopy(locale).backgroundHelp : checkCopy.selectQuestion;
  const draft = JSON.stringify({ questionId, source, hidden, showInformation, check: showInformation ? check : null });
  const dirty = !!baseline && draft !== baseline;
  useEffect(() => { ownDirtyRef.current = dirty; onDirtyChange?.(dirty || optionDirtyRef.current); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  const close = async (force = false) => {
    if (!force && dirty && !await confirm(editorCopy.changed)) return;
    setFormOpen(false); setEditing(null); setQuestionId(""); setSource("representative_assigned"); setHidden(false); setShowInformation(false); setCheck(defaultRepresentativeCheck);
    setStage("source"); setBaseline("");
    onDirtyChange?.(false);
  };
  const reset = () => close(true);
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!canSaveSource) throw new Error("invalid_source_question");
      const config = { source, hidden, showInformation, check: showInformation ? check : null };
      const refinement = getStatusListRefinementCopy(locale);
      const response = await fetch(canCreateOnSave ? endpoint : `${endpoint}/${encodeURIComponent(questionId)}`, {
        method: canCreateOnSave ? "POST" : "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(canCreateOnSave ? {
          ...(targetItemId ? {parentId:targetItemId} : {}),
          label: showInformation ? checkCopy.title : source === "representative_assigned" ? refinement.assignedQuestion : refinement.assignmentQuestion,
          config,
        } : config),
      });
      if (!response.ok) throw new Error(String(response.status));
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: catalogQueryKey }),
        queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId] }),
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
  const editSource = async (entry: Source) => {
    if (dirty && !await confirm(editorCopy.changed)) return;
    setFormOpen(true); setEditing(entry.questionId);
    setQuestionId(entry.questionId);
    setSource(entry.source);
    setHidden(entry.hidden);
    setShowInformation(entry.showInformation === true);
    setCheck(entry.showInformation
      ? entry.check || { ...defaultRepresentativeCheck, behavior: "information" }
      : defaultRepresentativeCheck);
    setStage("source");
    setBaseline(JSON.stringify({
      questionId: entry.questionId, source: entry.source, hidden: entry.hidden, showInformation: entry.showInformation === true,
      check: entry.showInformation ? entry.check || { ...defaultRepresentativeCheck, behavior: "information" } : null,
    }));
  };
  const begin = () => {
    reset();
    setFormOpen(true);
    const first = catalog.find(item => item.kind === "question" && relevant(item.id) && supports(item, "representative_assigned", catalog) && !owned.some(entry => entry.questionId === item.id));
    const hasText = catalog.some(item => item.kind === "question" && relevant(item.id) &&
      supports(item, "representative_assignment_type", catalog) && !owned.some(entry => entry.questionId === item.id));
    const type = first || !hasText ? "representative_assigned" : "representative_assignment_type";
    const information = !hasAvailable && !owned.length;
    const candidate = catalog.find(item => item.kind === "question" && relevant(item.id) && supports(item, type, catalog) && !owned.some(entry => entry.questionId === item.id));
    setSource(type);
    setShowInformation(information);
    setHidden(information);
    setCheck(defaultRepresentativeCheck);
    setQuestionId(candidate?.id || "");
    setStage("source");
    setBaseline(JSON.stringify({ questionId: candidate?.id || "", source: type, hidden: information, showInformation: information,
      check: information ? defaultRepresentativeCheck : null }));
  };
  const labelFor = (entry: Source) => catalog.find(item => item.kind === "question" && item.id === entry.questionId)?.label || entry.questionId;
  const open = formOpen;
  const availableQuestion = catalog.find(item => item.kind === "question" && item.id === questionId);
  const stageHeading = stage === "source" ? editorCopy.stageSource : stage === "mapping" ? editorCopy.stageMapping : stage === "evaluation" ? editorCopy.stageEvaluation : editorCopy.stageReview;
  const stageIndex = (["source", "mapping", "evaluation", "review"] as SourceEditorStage[]).indexOf(stage);
  const sourceName = showInformation ? checkCopy.title : source === "representative_assigned" ? copy.assigned : copy.assignmentType;
  const valueName = availableQuestion?.label || (canCreateOnSave ? checkCopy.newQuestion : checkCopy.selectQuestion);
  const checkSummary = `${check.enabled ? checkCopy.enabledSummary : checkCopy.disabledSummary} · ${checkCopy.trigger[check.trigger]} · ${checkCopy.behavior[check.behavior]}`;
  const setStageAt = (index: number) => setStage((["source", "mapping", "evaluation", "review"] as SourceEditorStage[])[Math.max(0, Math.min(3, index))]);
  const isBusy = saveMutation.isPending || deleteMutation.isPending;
  const requestClose = () => {
    if (!open || isBusy) return;
    void close();
  };
  return <>{hideOptionSources && <StatusListHealthcareSetup campaignId={campaignId} locale={locale} targetGroupId={targetItemId} onDirtyChange={reportOptionDirty}/>}
  <section className="slse-panel mt-4 rounded-xl border border-border/70 bg-background/65 p-3" data-testid="status-list-background-sources">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="text-sm font-semibold">{copy.title}</h3><p className="mt-1 text-xs text-muted-foreground">{copy.subtitle}</p></div>
      {!open && <Button type="button" size="sm" variant="outline" onClick={begin} disabled={query.isLoading || query.isFetching || query.isError}><Plus className="mr-1.5 h-3.5 w-3.5"/>{copy.add}</Button>}
    </header>
    <div className="mt-3 space-y-2" data-testid="background-source-explanation">
      <p className="text-xs leading-relaxed text-muted-foreground">{getStatusListSetupGuide(locale).answerSources.paragraphs[1]}</p>
      <StatusListHelp locale={locale} section="answerSources" contextual/>
    </div>
    {query.isLoading && <div className="mt-3 h-12 animate-pulse rounded-lg bg-muted/60"/>}
    {query.isError && <div className="mt-3 flex items-center justify-between rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm"><span className="flex items-center gap-2"><AlertCircle className="h-4 w-4"/>{copy.loadError}</span><Button type="button" size="sm" variant="outline" onClick={() => void query.refetch()}><RefreshCw className="mr-1.5 h-3.5 w-3.5"/>{copy.retry}</Button></div>}
    {query.data && !owned.length && !open && <p className="mt-3 rounded-lg bg-muted/45 p-3 text-sm text-muted-foreground">{copy.none}</p>}
    {!!owned.length && <div className="mt-3 space-y-2">{owned.map(entry => <div key={entry.questionId} className="slse-summary flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-3 py-2">
        <div className="min-w-0 w-full sm:w-auto sm:flex-1"><strong className="block break-words text-sm">{labelFor(entry)}</strong><span className="text-xs text-muted-foreground">{entry.showInformation ? checkCopy.title : entry.source === "representative_assigned" ? copy.assigned : copy.assignmentType}{entry.hidden ? ` · ${copy.hidden}` : ""}</span>{entry.showInformation && <span className="mt-1 block text-xs text-blue-800 dark:text-blue-200">{entry.check ? `${entry.check.enabled ? checkCopy.enabledSummary : checkCopy.disabledSummary} · ${checkCopy.trigger[entry.check.trigger]} · ${checkCopy.behavior[entry.check.behavior]}` : `${checkCopy.enabledSummary} · ${checkCopy.trigger.pulse_open} · ${checkCopy.behavior.information}`}</span>}</div>
      <span className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">{copy.readonly}</span>
       <StatusListBackgroundActions campaignId={campaignId} locale={locale} targets={[{kind:"question",id:entry.questionId,label:labelFor(entry)}]}/>
      <Button type="button" size="icon" variant="ghost" aria-label={copy.edit} onClick={() => editSource(entry)}><Pencil className="h-4 w-4"/></Button>
      <Button type="button" size="icon" variant="ghost" aria-label={copy.remove} disabled={deleteMutation.isPending} onClick={async () => { if (await confirm(copy.clearConfirm, { destructive: true })) deleteMutation.mutate(entry.questionId); }}><Trash2 className="h-4 w-4"/></Button>
    </div>)}</div>}
    <Dialog open={open} onOpenChange={isOpen => { if (!isOpen) requestClose(); }}>
      <DialogContent hideCloseButton overlayClassName="bg-foreground/35 backdrop-blur-sm"
        onEscapeKeyDown={event => { event.preventDefault(); event.stopPropagation(); requestClose(); }}
        onInteractOutside={event => { event.preventDefault(); requestClose(); }}
        className="slse-source-dialog flex h-[min(92dvh,900px)] w-[calc(100%-1rem)] max-w-4xl flex-col gap-0 overflow-hidden rounded-2xl border-border bg-card p-0 shadow-2xl sm:w-[calc(100%-2rem)]">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-background/90 px-4 py-3 sm:px-6">
          <DialogTitle className="text-sm font-semibold">{copy.title}</DialogTitle>
          <Button type="button" size="icon" variant="ghost" aria-label={editorCopy.cancel} onClick={requestClose} disabled={isBusy}>
            <X className="h-4 w-4"/>
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5">
      {open && <>
      {!questions.length && !canCreateOnSave && <div className="mb-3 space-y-3 rounded-xl border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900 dark:bg-blue-950/20" data-testid="background-source-prerequisites">
        <p className="text-xs leading-relaxed">{getStatusListRefinementCopy(locale).backgroundHelp}</p>
        {!targetQuestionId && <StatusListSourceTargetButton campaignId={campaignId} locale={locale} source={source} parentId={targetItemId} disabled={!parentAllowsQuestion} onCreated={target => {
          setQuestionId(target.questionId || ""); setHidden(true);
             setBaseline(JSON.stringify({questionId:target.questionId || "",source,hidden:true,showInformation,check:showInformation ? check : null}));
        }}/>}
      </div>}
      <StatusListSourceEditor copy={editorCopy} context={`${copy.source}: ${sourceName} · ${copy.question}: ${valueName}`} editing={editing !== null} stage={stage}
        onStage={setStage} onBack={() => setStageAt(stageIndex - 1)} onNext={() => setStageAt(stageIndex + 1)}
         onSave={() => saveMutation.mutate()} onCancel={() => close()} saving={saveMutation.isPending}
         canSave={canSaveSource} saveDisabledReason={saveBlockedReason}>
        <div className="slse-intro"><h4>{stage === "review" ? editorCopy.reviewTitle : stageHeading}</h4><p>{stage === "source" ? editorCopy.stageSource : stage === "mapping" ? editorCopy.stageMapping : stage === "evaluation" ? editorCopy.stageEvaluation : editorCopy.stageReview}</p></div>
        {stage === "source" && <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-medium text-muted-foreground"><span>{copy.source}</span><select data-testid="background-source-kind" className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground" value={showInformation ? "representative_information" : source} disabled={saveMutation.isPending} onChange={event => {
            const information = event.target.value === "representative_information";
            const next = information ? "representative_assigned" : event.target.value as Source["source"];
            setSource(next); setShowInformation(information); setCheck(information ? (showInformation ? check : defaultRepresentativeCheck) : defaultRepresentativeCheck);
            if (information) setHidden(true);
            const first = catalog.find(item => item.kind === "question" && relevant(item.id) && supports(item, next, catalog) && (!owned.some(entry => entry.questionId === item.id) || item.id === editing));
            setQuestionId(first?.id || "");
          }}>
            <option value="representative_assigned" disabled={editing !== null && !!editingQuestion && !supports(editingQuestion, "representative_assigned", catalog)}>{copy.assigned}</option>
            <option value="representative_information" disabled={editing !== null && !!editingQuestion && !supports(editingQuestion, "representative_assigned", catalog)}>{checkCopy.title}</option>
            <option value="representative_assignment_type" disabled={editing !== null && !!editingQuestion && !supports(editingQuestion, "representative_assignment_type", catalog)}>{copy.assignmentType}</option>
          </select></label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground"><span>{copy.question}</span><select data-testid="background-source-question" className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground" value={questionId} disabled={saveMutation.isPending || editing !== null || !questions.length} onChange={event => setQuestionId(event.target.value)}>
            <option value="" disabled>{canCreateOnSave ? checkCopy.newQuestion : copy.compatibleEmpty}</option>{questions.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}
          </select></label>
          <p className="sm:col-span-2 text-xs text-muted-foreground">{copy.typeHint}</p>
          {showInformation && <div className="sm:col-span-2"><StatusListRepresentativeCheckSettings config={check} onChange={setCheck} locale={locale} disabled={saveMutation.isPending}/></div>}
          {canCreateOnSave && <p className="sm:col-span-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-950 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100" data-testid="source-create-on-save">{checkCopy.createOnSave}</p>}
        </div>}
        {stage === "mapping" && <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm"><strong>{sourceName}</strong><span className="mx-2 text-muted-foreground">→</span><strong>{valueName}</strong><p className="mt-2 text-xs text-muted-foreground">{copy.notice}</p></div>}
        {stage === "evaluation" && <div className="grid gap-3"><label className="flex items-center gap-2 text-sm"><Switch data-testid="background-source-hidden" checked={hidden} disabled={saveMutation.isPending} onCheckedChange={setHidden}/>{copy.hidden}</label><p className="rounded-md border-l-2 border-primary/40 bg-primary/[0.035] px-3 py-2 text-xs leading-relaxed text-muted-foreground">{editorCopy.hidden}</p></div>}
        {stage === "review" && <div className="slse-review">
            <section><h5>{editorCopy.sourceContext}</h5><p>{copy.question}: {valueName}</p><p>{copy.source}: {sourceName}</p>{showInformation && <p>{checkSummary}</p>}
              {canCreateOnSave && <p data-testid="source-create-on-save">{checkCopy.createOnSave}</p>}
              {!canSaveSource && <p role="alert">{saveBlockedReason}</p>}
            </section>
          <section><h5>{editorCopy.evaluation}</h5><p>{hidden ? editorCopy.enabledHidden : editorCopy.enabledVisible}</p></section>
          <section><h5>{editorCopy.reviewTitle}</h5><p>{copy.notice}</p>{showInformation && <><p>{checkCopy.scope}</p><p>{checkSummary}</p><p>{checkCopy.hiddenIndependent}</p>{check.behavior !== "information" && <><p>{check.assignedActions ? getBackgroundActionCopy(locale).title : checkCopy.actionsTitle}</p>{check.assignedActions ? <p>{getBackgroundActionCopy(locale).assignedHelp}</p> : <ol className="list-decimal space-y-1 pl-4">{checkCopy.actionSteps.map(step => <li key={step}>{step}</li>)}</ol>}<p>{checkCopy.reopening}</p></>}</>}</section>
        </div>}
      </StatusListSourceEditor>
      </>}
        </div>
      </DialogContent>
    </Dialog>
  </section>{!hideOptionSources && <StatusListOptionSourcePanel campaignId={campaignId} locale={locale} onDirtyChange={reportOptionDirty}/>}</>;
}
