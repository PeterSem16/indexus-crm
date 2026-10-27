import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Activity, ArrowDown, ArrowUp, Bell, ChevronDown, ChevronRight, CircleHelp, Eye, EyeOff, Layers3, ListChecks, Mail, Maximize2, MessageSquare, Minimize2, Phone, Plus, Search, Send, Settings2, ShieldCheck, Tag, UserRound, Webhook, Workflow, Wrench, Zap } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { StatusListOptionSourcePanel, isOptionGroup } from "./status-list-option-source-panel";
import { StatusListBackgroundSourcePanel } from "./status-list-background-source-panel";
import { StatusListWorkflowEditor } from "./status-list-workflow-editor";
import { StatusListWorkflowDiagnostics } from "@/components/status-list-workflow-diagnostics";
import { StatusListBackgroundDiagnostics } from "./status-list-background-diagnostics";
import { getStatusListWorkspaceCopy } from "./status-list-workspace-copy";
import { StatusListViewport } from "./status-list-viewport";
import { StatusListPhaseOrganizer, getPhaseOrganizerCopy } from "./status-list-phase-organizer";
import { StatusListHelp } from "./status-list-help";
import { useStatusListConfirm } from "./status-list-confirm";
import { StatusListServiceHistory } from "./status-list-service-history";
import { StatusListHealthcareNavigationProvider } from "./status-list-healthcare-navigation";
import { statusListActionLabel } from "./status-list-action-labels";
import { outlineHidden, statusListOutline } from "@/lib/status-list-outline";
import { emptyStatusListOrganization } from "@shared/status-list-organization";
import type { OptionSource } from "@shared/status-list-option-source";
import type { WorkflowCatalogItem } from "@shared/status-list-workflow";
import "./status-list-workspace.css";

export type WorkspaceItem = {
  id: string; label: string; stepId: string; parentId: string | null; sortOrder: number;
  itemType?: string; confirmationType: string; tab?: string | null; isHidden?: boolean; required: boolean;
  automations: { id: string; actionType: string }[];
  questions: { id: string; questionText: string; sortOrder?: number; isHidden?: boolean; required?: boolean; groupName?: string | null; logicOperator?: string; gotoQuestionId?: string | null; icon?: string | null; color?: string | null; description?: string | null; fieldType?: string | null; automations: { id: string; actionType: string }[] }[];
};
type Props = {
  campaignId: string; locale: string; items: WorkspaceItem[]; selectedId: string; onSelect: (id: string) => void;
  navigation?: { itemId: string; questionId?: string; nonce: number };
  tools: ReactNode; onPreview?: () => void; previewLabel?: string; addStepLabel?: string; onAddStep?: () => void; definition: ReactNode | ((selectedItemId: string, selectedQuestionId: string | null, controls: { source: (onDirtyChange: (dirty: boolean) => void) => ReactNode; workflows: ReactNode; ancestorHidden: boolean; onDirtyChange: (dirty: boolean) => void }) => ReactNode); coverage: ReactNode;
};
export function StatusListWorkspace({ campaignId, locale, items, selectedId, onSelect, tools, definition, coverage, navigation, onPreview, previewLabel, addStepLabel, onAddStep }: Props) {
  const copy = getStatusListWorkspaceCopy(locale);
  const confirm = useStatusListConfirm(locale);
  const phaseCopy = getPhaseOrganizerCopy(locale);
  const { toast } = useToast();
  const [tab, setTab] = useState<"content" | "rules" | "tests" | "tools">("content");
  const [expanded, setExpanded] = useState(false);
  const workspaceRef = useRef<HTMLElement>(null);
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!expanded) return;
    expandButtonRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || document.querySelector('[role="dialog"][data-state="open"], [role="menu"][data-state="open"], [role="listbox"][data-state="open"], [data-radix-popper-content-wrapper] [data-state="open"]')) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setExpanded(false);
      } else if (event.key === "Tab") {
        const nodes = Array.from(workspaceRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], summary, [tabindex="0"]') || [])
          .filter(node => node.getClientRects().length > 0);
        const next = event.shiftKey ? nodes[nodes.length - 1] : nodes[0];
        const boundary = event.shiftKey ? nodes[0] : nodes[nodes.length - 1];
        if (next && document.activeElement === boundary) { event.preventDefault(); next.focus(); }
      }
    };
    // A closing Radix dialog can still stop bubbling Escape during its exit
    // animation. Capture it here, but always let an open nested surface close first.
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      expandButtonRef.current?.focus({ preventScroll: true });
    };
  }, [expanded]);
  const [phase, setPhase] = useState("all");
  const [visibility, setVisibility] = useState<"all" | "visible" | "hidden">("all");
  const [search, setSearch] = useState("");
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [selectionRevision, setSelectionRevision] = useState(0);
  const [dirty, setDirty] = useState(false);
  const allowNavigation = async () => {
    if (!dirty) return true;
    if (!await confirm(copy.discardChanges)) return false;
    setDirty(false); onSelect(""); setSelectedQuestionId(null); setSelectionRevision(value => value + 1);
    return true;
  };
  const navigationRequest = useRef(0);
  const endpoint = `/api/campaigns/${campaignId}/status-list-workflows/option-sources`;
  const sourceQuery = useQuery<{ sources: OptionSource[]; catalog: WorkflowCatalogItem[] }>({
    queryKey: [endpoint],
    queryFn: async () => { const response = await fetch(endpoint, { credentials: "include" }); if (!response.ok) throw Error(String(response.status)); return response.json(); },
  });
  const outline = useMemo(() => statusListOutline(items, phase, "", search, emptyStatusListOrganization, visibility), [items, phase, search, visibility]);
  const phaseCounts = useMemo(() => Object.fromEntries(
    ["all", "acquisition", "contract", "retention", "shared", "quick"].map(value => [
      value, statusListOutline(items, value, "", "", emptyStatusListOrganization).matchingItems.size,
    ])
  ), [items]);
  // Resolve the selection synchronously from the exact outline displayed at left.
  const candidate = items.find(item => item.id === selectedId);
  const selectedQuestionCandidate = candidate?.questions.find(question => question.id === selectedQuestionId && outline.visibleQuestions.has(question.id));
  const selected = candidate && (outline.matchingItems.has(candidate.id) || !!selectedQuestionCandidate) ? candidate : undefined;
  const selectedQuestion = selected?.questions.find(question => question.id === selectedQuestionId && outline.visibleQuestions.has(question.id));
  const selectedForTree = selected?.id || "";
  const parent = selectedId && items.find(item => item.id === selectedId)?.parentId
    ? items.find(item => item.id === items.find(entry => entry.id === selectedId)?.parentId)
    : undefined;
  const catalog = sourceQuery.data?.catalog || [];
  const parentCatalogItem = parent && catalog.find(item => item.id === parent.id);
  const sourceGroup = parent && parentCatalogItem && isOptionGroup(parentCatalogItem, catalog) ? parent : selected;
  const source = sourceQuery.data?.sources.find(entry => entry.groupId === sourceGroup?.id);
  const isDerived = selectedQuestion
    ? catalog.some(item => item.kind === "question" && item.id === selectedQuestion.id && !!item.backgroundSource)
    : !!source || catalog.some(item => item.id === selectedId && item.backgroundSource);
  const hiddenAncestor = (() => {
    const seen = new Set<string>();
    let ancestor = parent;
    while (ancestor && !seen.has(ancestor.id)) {
      seen.add(ancestor.id);
      if (ancestor.isHidden) return ancestor;
      ancestor = items.find(item => item.id === ancestor?.parentId);
    }
    return undefined;
  })();
  const eligibleGroup = !!sourceGroup && !!catalog.find(item => item.id === sourceGroup.id && isOptionGroup(item, catalog));
  const hasQuestions = !!selected?.questions.length;
  const contextIds = useMemo(() => {
    if (selectedQuestion) return [selectedQuestion.id];
    const ids = new Set<string>(selectedForTree ? [selectedForTree] : []);
    let changed = true;
    while (changed) {
      changed = false;
      for (const item of items) if (item.parentId && ids.has(item.parentId) && !ids.has(item.id)) { ids.add(item.id); changed = true; }
    }
    for (const item of items) if (ids.has(item.id)) for (const question of item.questions) ids.add(question.id);
    return Array.from(ids);
  }, [items, selectedForTree, selectedQuestion?.id]);
  const move = useMutation({
    mutationFn: ({ itemId, questionId, direction, neighborId }: { itemId: string; questionId?: string; direction: "up" | "down"; neighborId: string }) =>
      apiRequest("POST", `/api/campaigns/${campaignId}/status-list-workflows/items/${itemId}${questionId ? `/questions/${questionId}` : ""}/move`, { direction, neighborId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list"] }),
    onError: () => toast({ title: copy.error, variant: "destructive" }),
  });
  const childrenOf = (id: string) => items.filter(item => item.parentId === id).sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  const roots = items.filter(item => (!item.parentId || !items.some(parent => parent.id === item.parentId)) && outline.visibleItems.has(item.id)).sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  const choose = async (id: string, _edit = false) => {
    if (!await allowNavigation()) return;
    onSelect(id); setSelectedQuestionId(null); setSelectionRevision(value => value + 1); setTab("content");
  };
  const openHealthcareContentGroup = async (groupId: string) => {
    if (!await allowNavigation()) return false;
    setPhase("all");
    setVisibility("all");
    setSearch("");
    setTab("content");
    setExpandedItems(previous => new Set(previous).add(groupId));
    onSelect(groupId);
    setSelectedQuestionId(null);
    setSelectionRevision(value => value + 1);
    return true;
  };
  const addRootStep = async () => {
    if (!await allowNavigation()) return;
    onAddStep?.();
  };
  const addHealthcareCustomQuestion = async () => {
    if (!onAddStep || !await allowNavigation()) return false;
    setPhase("all");
    setVisibility("all");
    setSearch("");
    setSelectedQuestionId(null);
    setTab("content");
    onAddStep();
    return true;
  };
  useEffect(() => {
    if (!navigation) return;
    const request = ++navigationRequest.current;
    void (async () => {
      if (!await allowNavigation() || request !== navigationRequest.current) return;
      setPhase("all"); setVisibility("all"); setSearch(""); setTab("content");
      onSelect(navigation.itemId); setSelectedQuestionId(navigation.questionId || null);
      setSelectionRevision(value => value + 1);
      if (navigation.questionId) setExpandedItems(previous => new Set(previous).add(navigation.itemId));
    })();
    // Explicit navigation requests only; this must not reconcile/filter selections.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);
  const moveButtons = (item: WorkspaceItem, question?: WorkspaceItem["questions"][number]) => {
    const siblings = question
      ? item.questions.filter(entry => outline.visibleQuestions.has(entry.id)).slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.id.localeCompare(b.id))
       : items.filter(entry => entry.parentId === item.parentId && entry.itemType === item.itemType && outline.matchingItems.has(entry.id)).sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
    const id = question?.id || item.id, index = siblings.findIndex(entry => entry.id === id);
    return <span className="slw-row-move">{(["up", "down"] as const).map(direction => {
      const neighbor = siblings[index + (direction === "up" ? -1 : 1)];
      return <button key={direction} type="button" data-testid={`status-list-move-${id}-${direction}`} aria-label={`${copy[direction]}: ${question?.questionText || item.label}`} title={copy[direction]} disabled={move.isPending || !neighbor} onClick={() => neighbor && move.mutate({ itemId: item.id, questionId: question?.id, direction, neighborId: neighbor.id })}>{direction === "up" ? <ArrowUp size={12}/> : <ArrowDown size={12}/>}</button>;
    })}</span>;
  };
  const visibilityBadge = (hidden: boolean, inherited = false) => <span className={`slw-visibility ${hidden ? "is-hidden" : "is-visible"}`} title={inherited ? copy.inheritedHidden : hidden ? copy.hidden : copy.visible} aria-label={inherited ? copy.inheritedHidden : hidden ? copy.hidden : copy.visible}>{hidden ? <EyeOff size={12}/> : <Eye size={12}/>}<span>{inherited ? copy.inheritedHidden : hidden ? copy.hidden : copy.visible}</span></span>;
  const renderQuestionRow = (item: WorkspaceItem, question: WorkspaceItem["questions"][number]) => {
    const hidden = outlineHidden(item, items);
     return <div key={question.id} data-testid={`status-list-question-row-${question.id}`} data-hidden={hidden || !!question.isHidden} className={`slw-tree-row slw-question-row ${hidden || question.isHidden ? "slw-hidden-row" : ""} ${selectedQuestionId === question.id ? "selected" : ""}`}>
       <CircleHelp className="slw-row-type-icon slw-question-icon" size={14} aria-hidden="true"/><span className="slw-type-badge is-question">{copy.questionType}</span><button type="button" className="slw-tree-label" aria-current={selectedQuestionId === question.id ? "true" : undefined} data-testid={`status-list-select-question-${question.id}`} onClick={() => { void (async () => { if (!await allowNavigation()) return; onSelect(item.id); setSelectedQuestionId(question.id); setSelectionRevision(value => value + 1); })(); }}>{question.questionText}</button>
      {visibilityBadge(hidden || !!question.isHidden, hidden)}{moveButtons(item, question)}
    </div>;
  };
  const renderTree = (item: WorkspaceItem, depth = 0, seen = new Set<string>()): ReactNode => {
    if (seen.has(item.id) || !outline.visibleItems.has(item.id)) return null;
    const next = new Set(seen).add(item.id), children = childrenOf(item.id).filter(child => outline.visibleItems.has(child.id));
    const questions = item.questions.filter(question => outline.visibleQuestions.has(question.id)).slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.id.localeCompare(b.id));
    const open = expandedItems.has(item.id) || !!search.trim();
    const hidden = outlineHidden(item, items);
    const selectable = outline.matchingItems.has(item.id);
    // Ancestors keep the traversal connected, but are not questions belonging to
    // this filter. Promote matching descendants instead of showing wrong-phase rows.
    if (!selectable) return <div key={item.id} className="slw-context-contents">
      {children.map(child => renderTree(child, depth, next))}
      {questions.map(question => renderQuestionRow(item, question))}
    </div>;
    const contextOnly = !selectable;
    return <div key={item.id} className={depth ? "slw-tree-branch" : ""}>
      <div className={`slw-tree-row ${selectedId === item.id && !selectedQuestion ? "selected" : ""} ${hidden ? "slw-hidden-row" : ""} ${contextOnly ? "slw-context-row" : ""} ${item.itemType === "option" ? "slw-quick-row" : "slw-step-row"}`} data-hidden={hidden} data-context-only={contextOnly}>
        {children.length || questions.length ? <button type="button" data-testid={`status-list-expand-${item.id}`} aria-label={`${open ? copy.collapse : copy.expand}: ${item.label}`} aria-expanded={open} onClick={() => setExpandedItems(previous => { const result = new Set(previous); result.has(item.id) ? result.delete(item.id) : result.add(item.id); return result; })}>{open ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</button> : <span className="slw-dot"/>}
        {item.itemType === "option" ? <Zap className="slw-row-type-icon slw-quick-icon" size={14} aria-hidden="true"/> : <ListChecks className="slw-row-type-icon slw-step-icon" size={14} aria-hidden="true"/>}
        <span className={`slw-type-badge ${item.itemType === "option" ? "is-quick" : "is-step"}`}>{item.itemType === "option" ? copy.quickType : copy.stepType}</span>
         {selectable ? <button type="button" data-testid={`status-list-select-${item.id}`} className="slw-tree-label" aria-current={selectedId === item.id && !selectedQuestion ? "true" : undefined} onClick={() => choose(item.id)}><span>{item.label}</span></button> : <span className="slw-tree-label slw-context-label"><span>{item.label}</span><small>{copy.contextOnly}</small></span>}
        {visibilityBadge(hidden, hidden && !item.isHidden)}
        {item.required && <span className="slw-required" title={copy.required}>*</span>}
        {item.automations.length > 0 && <span title={copy.original}><Zap size={12}/></span>}
        {selectable && moveButtons(item)}
      </div>
      {open && children.map(child => renderTree(child, depth + 1, next))}
      {open && questions.map(question => renderQuestionRow(item, question))}
    </div>;
  };
  const originalActions: Array<{ id: string; actionType: string; item: WorkspaceItem; question?: WorkspaceItem["questions"][number] }> = items.flatMap(item => [
    ...item.automations.map(action => ({ ...action, item })),
    ...item.questions.flatMap(question => question.automations.map(action => ({ ...action, item, question }))),
  ]);
  return <StatusListHealthcareNavigationProvider value={{ openContentGroup: openHealthcareContentGroup,
    addCustomQuestion: onAddStep ? addHealthcareCustomQuestion : undefined }}>
  <StatusListViewport expanded={expanded}><section ref={workspaceRef} className={`slw${expanded ? " slw-fullscreen" : ""}`} data-testid="status-list-workspace" data-fullscreen={expanded} role={expanded ? "dialog" : undefined} aria-modal={expanded ? true : undefined} aria-label={expanded ? "Status List" : undefined}>
     <header className="slw-heading"><div><h2>Status List</h2><p>{copy.sourceHint}</p></div><div className="slw-heading-actions"><span className="slw-chain-notice"><ShieldCheck size={14}/>{copy.chaining}</span><StatusListHelp locale={locale}/><Button ref={expandButtonRef} type="button" variant="outline" size="icon" data-testid="status-list-toggle-fullscreen" aria-label={expanded ? copy.restore : copy.maximize} title={expanded ? copy.restore : copy.maximize} onClick={() => setExpanded(value => !value)}>{expanded ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}</Button></div></header>
    <nav className="slw-tabs" aria-label="Status List">
      {([["content", Layers3, copy.content], ["rules", Workflow, copy.rules], ["tests", Activity, copy.tests], ["tools", Wrench, copy.tools]] as const).map(([value, Icon, label]) =>
        <button key={value} type="button" data-testid={`status-list-tab-${value}`} aria-current={tab === value ? "page" : undefined} className={tab === value ? "active" : ""} onClick={() => { if (tab !== value) void (async () => { if (await allowNavigation()) setTab(value); })(); }}><Icon size={15}/>{label}</button>)}
      {onPreview && <button type="button" data-testid="btn-toggle-preview" aria-haspopup="dialog" onClick={onPreview}><Eye size={15}/>{previewLabel}</button>}
    </nav>
    <div className="slw-body">
     {tab === "tools" && <div className="slw-tools" data-testid="status-list-tools"><header><div><span>{copy.toolsEyebrow}</span><h3>{copy.toolsTitle}</h3><p>{copy.toolsDescription}</p></div></header>{tools}{coverage}</div>}
    {tab === "content" && <>
      <div className="slw-layout">
        <aside className="slw-outline">
           <header className="slw-outline-heading">
             <h3>{copy.structure}</h3>
             {onAddStep && <Button type="button" variant="outline" size="sm" className="slw-outline-add-step" data-testid="status-list-add-step-content" onClick={() => void addRootStep()}>
               <Plus size={14}/>{addStepLabel}
             </Button>}
           </header>
           <div className="slw-filter-label">{copy.agentPhase}</div>
           <div className="slw-phases">{(["all", "acquisition", "contract", "retention", "shared", "quick"] as const).map(value =>
              <button type="button" data-testid={`status-list-phase-${value}`} aria-pressed={phase === value} className={phase === value ? "active" : ""} onClick={() => { if (phase !== value) void (async () => { if (await allowNavigation()) setPhase(value); })(); }} key={value}>{copy[value]} <span data-testid={`status-list-phase-count-${value}`} className="slw-phase-count">{phaseCounts[value]}</span></button>)}</div>
           <div className="slw-filter-label">{copy.agentVisibility}</div>
           <div className="slw-phases slw-visibility-filters">{(["all", "visible", "hidden"] as const).map(value =>
              <button type="button" data-testid={`status-list-visibility-${value}`} aria-pressed={visibility === value} className={visibility === value ? "active" : ""} onClick={() => { if (visibility !== value) void (async () => { if (await allowNavigation()) setVisibility(value); })(); }} key={value}>{copy[value]}</button>)}</div>
          <label className="slw-search"><Search size={14}/><input aria-label={copy.search} placeholder={copy.search} value={search} onChange={event => { const value = event.target.value; void (async () => { if (await allowNavigation()) setSearch(value); })(); }}/></label>
          <div className="slw-tree">{roots.length ? roots.map(item => renderTree(item)) : <div className="slw-filter-empty">
            <p>{phaseCounts[phase] === 0 && ["acquisition", "contract", "retention"].includes(phase) ? phaseCopy.emptyPhase : copy.empty}</p>
            {phaseCounts[phase] === 0 && phaseCounts.shared > 0 && <small>{phaseCopy.legacy}</small>}
          </div>}</div>
          <div className="slw-tree-actions"><StatusListPhaseOrganizer campaignId={campaignId} locale={locale} items={items} phase={phase}/></div>
        </aside>
        <article className="slw-detail">
          {selected ? <>
            <header className="slw-detail-heading"><small>{selectedQuestion ? `${selected.stepId} · ${selected.label}` : selected.stepId}</small><h3>{selectedQuestion?.questionText || selected.label}</h3></header>
            <div className="slw-inspector">
              <div key={selectionRevision}>
              {typeof definition === "function" ? definition(selected.id, selectedQuestion?.id || null, {
                onDirtyChange: setDirty,
                ancestorHidden: !!hiddenAncestor,
                source: onDirtyChange => <>
                <div className="slw-source-summary"><span>{isDerived ? <Settings2 size={17}/> : <UserRound size={17}/>}</span><div><strong>{copy.owner}</strong><p>{isDerived ? copy.system : copy.agent}</p></div></div>
                <p className="slw-message">{copy.sourceHint}</p>
                {sourceGroup?.id !== selected.id && <p className="slw-notice">{copy.inherited} <strong>{sourceGroup?.label}</strong></p>}
                {sourceQuery.isLoading ? <div className="h-20 animate-pulse rounded bg-muted"/> : sourceQuery.isError ? <Button variant="outline" onClick={() => void sourceQuery.refetch()}>{copy.error}</Button> :
                  eligibleGroup && !selectedQuestion ? <StatusListOptionSourcePanel key={sourceGroup!.id} campaignId={campaignId} locale={locale} targetGroupId={sourceGroup!.id} onDirtyChange={onDirtyChange}/> :
                  null}
                {source && !selectedQuestion && <StatusListBackgroundDiagnostics campaignId={campaignId} locale={locale} groupId={source.groupId}/>}
                {(hasQuestions || !eligibleGroup) && <StatusListBackgroundSourcePanel key={`${selected.id}:${selectedQuestion?.id || ""}`} campaignId={campaignId} locale={locale} targetItemId={selected.id} targetQuestionId={selectedQuestion?.id} hideOptionSources onDirtyChange={onDirtyChange}/>}
                </>,
                workflows: <>
                <p className="slw-notice">{copy.chaining}</p>
                <StatusListWorkflowEditor campaignId={campaignId} locale={locale} sourceIds={contextIds} showBackgroundSources/>
                <p className="slw-message">{copy.transition}</p>
                <p className="slw-message">{copy.originalHint}</p>
                </>,
              }) : definition}
              </div>
            </div>
          </> : <div className="slw-empty-detail"><Layers3 size={20}/><p>{copy.select}</p><small>{copy.emptyDetail}</small></div>}
        </article>
      </div>
    </>}
    {tab === "rules" && <div className="slw-page">
      <p className="slw-notice">{copy.transition}</p>
      <StatusListWorkflowEditor campaignId={campaignId} locale={locale} showBackgroundSources/>
      <section className="slw-original"><h3>{copy.original} · {originalActions.length}</h3>
        {originalActions.map(action => {
          const label = statusListActionLabel(action.actionType, locale);
          const Icon = action.actionType.includes("email") ? Mail : action.actionType.includes("task") ? ListChecks : action.actionType.includes("sms") ? MessageSquare : action.actionType.includes("callback") ? Phone : action.actionType.includes("status") ? Tag : action.actionType.includes("role") ? Bell : action.actionType.includes("webhook") ? Webhook : action.actionType.includes("send") ? Send : Zap;
          return <div className="slw-original-action" key={action.id}>
            <span className="slw-original-action-icon"><Icon size={15}/></span>
            <div><strong>{action.item.label}{action.question ? ` · ${action.question.questionText}` : ""}</strong><small>{label}</small></div>
            <Button size="sm" variant="outline" onClick={() => void choose(action.item.id, true)}>{copy.edit}</Button>
          </div>;
        })}
        <StatusListServiceHistory campaignId={campaignId} locale={locale}/>
      </section>
    </div>}
    {tab === "tests" && <div className="slw-page"><p className="slw-history-scope">{copy.historyScope}</p><StatusListBackgroundDiagnostics campaignId={campaignId} locale={locale}/><StatusListWorkflowDiagnostics campaignId={campaignId} locale={locale}/></div>}
    </div>
  </section></StatusListViewport></StatusListHealthcareNavigationProvider>;
}
