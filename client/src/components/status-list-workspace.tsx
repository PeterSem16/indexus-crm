import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Activity, ArrowDown, ArrowUp, ChevronDown, ChevronRight, Eye, EyeOff, Layers3, Maximize2, Minimize2, Search, Settings2, ShieldCheck, UserRound, Workflow, Wrench, Zap } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { StatusListOptionSourcePanel, isOptionGroup } from "./status-list-option-source-panel";
import { StatusListBackgroundSourcePanel } from "./status-list-background-source-panel";
import { StatusListWorkflowEditor } from "./status-list-workflow-editor";
import { StatusListWorkflowDiagnostics } from "@/components/status-list-workflow-diagnostics";
import { getStatusListWorkspaceCopy } from "./status-list-workspace-copy";
import { StatusListViewport } from "./status-list-viewport";
import { StatusListCategoryManager } from "./status-list-category-manager";
import { outlineCategory, outlineHidden, statusListOutline } from "@/lib/status-list-outline";
import { emptyStatusListOrganization, type StatusListOrganization } from "@shared/status-list-organization";
import type { ComponentProps } from "react";
import type { OptionSource } from "@shared/status-list-option-source";
import type { WorkflowCatalogItem } from "@shared/status-list-workflow";
import "./status-list-workspace.css";

export type WorkspaceItem = {
  id: string; label: string; stepId: string; parentId: string | null; sortOrder: number;
  itemType?: string; confirmationType: string; tab?: string | null; isHidden?: boolean; required: boolean;
  automations: { id: string; actionType: string }[];
  questions: { id: string; questionText: string; sortOrder?: number; isHidden?: boolean; automations: { id: string; actionType: string }[] }[];
};
type Props = {
  campaignId: string; locale: string; items: WorkspaceItem[]; selectedId: string; onSelect: (id: string) => void;
  tools: ReactNode; definition: ReactNode; coverage: ReactNode;
};
export function StatusListWorkspace({ campaignId, locale, items, selectedId, onSelect, tools, definition, coverage }: Props) {
  const copy = getStatusListWorkspaceCopy(locale);
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
  const [panel, setPanel] = useState<"owner" | "visibility" | "triggers">("owner");
  const [phase, setPhase] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState("");
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [definitionOpen, setDefinitionOpen] = useState(false);
  const endpoint = `/api/campaigns/${campaignId}/status-list-workflows/option-sources`;
  const organizationEndpoint = `/api/campaigns/${campaignId}/status-list-workflows/organization`;
  const organizationQuery = useQuery<StatusListOrganization>({
    queryKey: [organizationEndpoint],
    queryFn: async () => { const response = await fetch(organizationEndpoint, { credentials: "include" }); if (!response.ok) throw Error(String(response.status)); return response.json(); },
  });
  const organization = organizationQuery.data || emptyStatusListOrganization;
  const organize = useMutation({
    mutationFn: (edit: Parameters<ComponentProps<typeof StatusListCategoryManager>["onEdit"]>[0]) => apiRequest("PATCH", organizationEndpoint, edit),
    onSuccess: async response => {
      const next = await response.json() as StatusListOrganization;
      queryClient.setQueryData([organizationEndpoint], next);
      void queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId], exact: true });
      if (category && !next.categories.some(entry => entry.id === category)) setCategory("");
      toast({ title: copy.saved });
    },
    onError: () => toast({ title: copy.error, variant: "destructive" }),
  });
  const sourceQuery = useQuery<{ sources: OptionSource[]; catalog: WorkflowCatalogItem[] }>({
    queryKey: [endpoint],
    queryFn: async () => { const response = await fetch(endpoint, { credentials: "include" }); if (!response.ok) throw Error(String(response.status)); return response.json(); },
  });
  const selected = items.find(item => item.id === selectedId);
  const selectedQuestion = selected?.questions.find(question => question.id === selectedQuestionId);
  const parent = selected && items.find(item => item.id === selected.parentId);
  const catalog = sourceQuery.data?.catalog || [];
  const sourceGroup = parent && isOptionGroup(catalog.find(item => item.id === parent.id)!, catalog) ? parent : selected;
  const source = sourceQuery.data?.sources.find(entry => entry.groupId === sourceGroup?.id);
  const isDerived = !!source || catalog.some(item => item.id === selectedId && item.backgroundSource);
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
    const ids = new Set<string>(selectedId ? [selectedId] : []);
    let changed = true;
    while (changed) {
      changed = false;
      for (const item of items) if (item.parentId && ids.has(item.parentId) && !ids.has(item.id)) { ids.add(item.id); changed = true; }
    }
    for (const item of items) if (ids.has(item.id)) for (const question of item.questions) ids.add(question.id);
    return Array.from(ids);
  }, [items, selectedId]);
  useEffect(() => {
    if (!selected && items.length) onSelect(items.find(item => !item.parentId)?.id || items[0].id);
  }, [items, selected, onSelect]);
  const update = useMutation({
    mutationFn: (patch: { isHidden?: boolean; required?: boolean; tab?: string | null }) => apiRequest("PATCH", `/api/campaigns/${campaignId}/status-list-workflows/items/${selectedId}/presentation`, patch),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list"] }),
        queryClient.invalidateQueries({ queryKey: [endpoint] }),
        queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list-workflows"] }),
      ]);
      toast({ title: copy.saved });
    },
    onError: () => toast({ title: copy.error, variant: "destructive" }),
  });
  const move = useMutation({
    mutationFn: ({ itemId, questionId, direction, neighborId }: { itemId: string; questionId?: string; direction: "up" | "down"; neighborId: string }) =>
      apiRequest("POST", `/api/campaigns/${campaignId}/status-list-workflows/items/${itemId}${questionId ? `/questions/${questionId}` : ""}/move`, { direction, neighborId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list"] }),
    onError: () => toast({ title: copy.error, variant: "destructive" }),
  });
  const outline = useMemo(() => statusListOutline(items, phase, category, search, organization), [items, phase, category, search, organization]);
  const childrenOf = (id: string) => items.filter(item => item.parentId === id).sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  const roots = items.filter(item => (!item.parentId || !items.some(parent => parent.id === item.parentId)) && outline.visibleItems.has(item.id)).sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  const choose = (id: string, edit = false) => { onSelect(id); setSelectedQuestionId(null); setTab("content"); setPanel("owner"); setDefinitionOpen(edit); };
  const moveButtons = (item: WorkspaceItem, question?: WorkspaceItem["questions"][number]) => {
    const siblings = question
      ? item.questions.filter(entry => outline.visibleQuestions.has(entry.id)).slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.id.localeCompare(b.id))
      : items.filter(entry => entry.parentId === item.parentId && entry.itemType === item.itemType && outline.visibleItems.has(entry.id)).sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
    const id = question?.id || item.id, index = siblings.findIndex(entry => entry.id === id);
    return <span className="slw-row-move">{(["up", "down"] as const).map(direction => {
      const neighbor = siblings[index + (direction === "up" ? -1 : 1)];
      return <button key={direction} type="button" data-testid={`status-list-move-${id}-${direction}`} aria-label={`${copy[direction]}: ${question?.questionText || item.label}`} title={copy[direction]} disabled={move.isPending || !neighbor} onClick={() => neighbor && move.mutate({ itemId: item.id, questionId: question?.id, direction, neighborId: neighbor.id })}>{direction === "up" ? <ArrowUp size={12}/> : <ArrowDown size={12}/>}</button>;
    })}</span>;
  };
  const visibilityBadge = (hidden: boolean, inherited = false) => <span className={`slw-visibility ${hidden ? "is-hidden" : "is-visible"}`} title={inherited ? copy.inheritedHidden : hidden ? copy.hidden : copy.visible} aria-label={inherited ? copy.inheritedHidden : hidden ? copy.hidden : copy.visible}>{hidden ? <EyeOff size={12}/> : <Eye size={12}/>}</span>;
  const renderTree = (item: WorkspaceItem, depth = 0, seen = new Set<string>()): ReactNode => {
    if (seen.has(item.id) || !outline.visibleItems.has(item.id)) return null;
    const next = new Set(seen).add(item.id), children = childrenOf(item.id).filter(child => outline.visibleItems.has(child.id));
    const questions = item.questions.filter(question => outline.visibleQuestions.has(question.id)).slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.id.localeCompare(b.id));
    const open = expandedItems.has(item.id) || !!search.trim();
    const hidden = outlineHidden(item, items);
    return <div key={item.id} className={depth ? "slw-tree-branch" : ""}>
      <div className={`slw-tree-row ${selectedId === item.id && !selectedQuestion ? "selected" : ""} ${hidden ? "slw-hidden-row" : ""}`} data-hidden={hidden}>
        {children.length || questions.length ? <button type="button" data-testid={`status-list-expand-${item.id}`} aria-label={`${open ? copy.collapse : copy.expand}: ${item.label}`} aria-expanded={open} onClick={() => setExpandedItems(previous => { const result = new Set(previous); result.has(item.id) ? result.delete(item.id) : result.add(item.id); return result; })}>{open ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</button> : <span className="slw-dot"/>}
        <button type="button" data-testid={`status-list-select-${item.id}`} className="slw-tree-label" onClick={() => choose(item.id)}><span>{item.label}</span></button>
        {visibilityBadge(hidden, hidden && !item.isHidden)}
        {item.required && <span className="slw-required" title={copy.required}>*</span>}
        {item.automations.length > 0 && <span title={copy.original}><Zap size={12}/></span>}
        {moveButtons(item)}
      </div>
      {open && children.map(child => renderTree(child, depth + 1, next))}
      {open && questions.map(question => <div key={question.id} data-testid={`status-list-question-row-${question.id}`} data-hidden={hidden || !!question.isHidden} className={`slw-tree-row slw-question-row ${hidden || question.isHidden ? "slw-hidden-row" : ""} ${selectedQuestionId === question.id ? "selected" : ""}`}>
        <span className="slw-dot"/><button type="button" className="slw-tree-label" data-testid={`status-list-select-question-${question.id}`} onClick={() => { onSelect(item.id); setSelectedQuestionId(question.id); setDefinitionOpen(true); }}>{question.questionText}</button>
        {visibilityBadge(hidden || !!question.isHidden, hidden)}{moveButtons(item, question)}
      </div>)}
    </div>;
  };
  const originalActions = items.flatMap(item => [
    ...item.automations.map(action => ({ ...action, item })),
    ...item.questions.flatMap(question => question.automations.map(action => ({ ...action, item, question }))),
  ]);
  return <StatusListViewport expanded={expanded}><section ref={workspaceRef} className={`slw${expanded ? " slw-fullscreen" : ""}`} data-testid="status-list-workspace" data-fullscreen={expanded} role={expanded ? "dialog" : undefined} aria-modal={expanded ? true : undefined} aria-label={expanded ? "Status List" : undefined}>
    <header className="slw-heading"><div><h2>Status List</h2><p>{copy.sourceHint}</p></div><div className="slw-heading-actions"><span className="slw-chain-notice"><ShieldCheck size={14}/>{copy.chaining}</span><Button ref={expandButtonRef} type="button" variant="outline" size="icon" data-testid="status-list-toggle-fullscreen" aria-label={expanded ? copy.restore : copy.maximize} title={expanded ? copy.restore : copy.maximize} onClick={() => setExpanded(value => !value)}>{expanded ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}</Button></div></header>
    <nav className="slw-tabs" aria-label="Status List">
      {([["content", Layers3, copy.content], ["rules", Workflow, copy.rules], ["tests", Activity, copy.tests], ["tools", Wrench, copy.tools]] as const).map(([value, Icon, label]) =>
        <button key={value} type="button" data-testid={`status-list-tab-${value}`} aria-current={tab === value ? "page" : undefined} className={tab === value ? "active" : ""} onClick={() => setTab(value)}><Icon size={15}/>{label}</button>)}
    </nav>
    <div className="slw-body">
    {tab === "tools" && <div className="slw-tools" data-testid="status-list-tools">{tools}</div>}
    {tab === "content" && <>
      <div className="slw-layout">
        <aside className="slw-outline">
          <h3>{copy.structure}</h3>
          <div className="slw-phases">{(["all", "acquisition", "contract", "retention", "quick"] as const).map(value =>
            <button type="button" data-testid={`status-list-phase-${value}`} aria-pressed={phase === value && !category} className={phase === value && !category ? "active" : ""} onClick={() => { setPhase(value); setCategory(""); }} key={value}>{copy[value]}</button>)}</div>
          {organizationQuery.isError ? <Button size="sm" variant="ghost" onClick={() => void organizationQuery.refetch()}>{copy.error}</Button> : <>
            <div className="slw-phases slw-custom-categories">{organization.categories.map(entry => <button type="button" data-testid={`status-list-category-${entry.id}`} aria-pressed={category === entry.id} className={category === entry.id ? "active" : ""} onClick={() => { setCategory(entry.id); setPhase("all"); }} key={entry.id}>{entry.name}</button>)}</div>
            <StatusListCategoryManager organization={organization} locale={locale} busy={organize.isPending || organizationQuery.isLoading} onEdit={edit => organize.mutate(edit)}/>
          </>}
          <div className="slw-legend"><span>{visibilityBadge(false)}{copy.visible}</span><span>{visibilityBadge(true)}{copy.hidden}</span></div>
          <label className="slw-search"><Search size={14}/><input aria-label={copy.search} placeholder={copy.search} value={search} onChange={event => setSearch(event.target.value)}/></label>
          <div className="slw-tree">{roots.length ? roots.map(item => renderTree(item)) : <p className="slw-message">{copy.empty}</p>}</div>
          <div className="slw-tree-actions"><Button variant="ghost" size="sm" disabled={!selected} onClick={() => setDefinitionOpen(true)}>{copy.edit}</Button></div>
        </aside>
        <article className="slw-detail">
          {selected ? <>
            <header className="slw-detail-heading"><small>{selected.stepId}</small><h3>{selected.label}</h3></header>
            <section className="slw-organization">
              {selectedQuestion && <strong>{selectedQuestion.questionText}</strong>}
              <label>{copy.agentPhase}{selectedQuestion ? <span>{copy.inheritPhase}</span> : <select data-testid="status-list-phase-assignment" value={selected.tab || "both"} disabled={update.isPending} onChange={event => update.mutate({ tab: event.target.value === "both" ? null : event.target.value })}>
                <option value="both">{copy.sharedPhase}</option><option value="acquisition">{copy.acquisition}</option><option value="contract">{copy.contract}</option><option value="retention">{copy.retention}</option>
              </select>}</label>
              <label>{copy.categoryAssignment}<select data-testid="status-list-category-assignment" disabled={organize.isPending || !organizationQuery.data} value={organization.assignments[selectedQuestion?.id || selected.id] || ""} onChange={event => organize.mutate({ operation: "assign", kind: selectedQuestion ? "question" : "item", id: selectedQuestion?.id || selected.id, categoryId: event.target.value || null })}>
                <option value="">{copy.noCategory}</option>{organization.categories.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
              </select></label>
              {!organization.assignments[selectedQuestion?.id || selected.id] && outlineCategory(selectedQuestion?.id || selected.id, selected, items, organization) && <small>{copy.inheritedCategory}: {organization.categories.find(entry => entry.id === outlineCategory(selectedQuestion?.id || selected.id, selected, items, organization))?.name}</small>}
              <p>{copy.categoryHint}</p>
            </section>
            <div className="slw-source-summary"><span>{isDerived ? <Settings2 size={17}/> : <UserRound size={17}/>}</span><div><strong>{copy.owner}</strong><p>{isDerived ? copy.system : copy.agent}</p></div></div>
            <nav className="slw-inspector-tabs">{(["owner", "visibility", "triggers"] as const).map(value => <button type="button" className={panel === value ? "active" : ""} onClick={() => setPanel(value)} key={value}>{copy[value]}</button>)}</nav>
            <div className="slw-inspector">
              {panel === "owner" && <>
                <p className="slw-message">{copy.sourceHint}</p>
                {sourceGroup?.id !== selected.id && <p className="slw-notice">{copy.inherited} <strong>{sourceGroup?.label}</strong></p>}
                {sourceQuery.isLoading ? <div className="h-20 animate-pulse rounded bg-muted"/> : sourceQuery.isError ? <Button variant="outline" onClick={() => void sourceQuery.refetch()}>{copy.error}</Button> :
                  eligibleGroup ? <StatusListOptionSourcePanel key={sourceGroup!.id} campaignId={campaignId} locale={locale} targetGroupId={sourceGroup!.id}/> :
                  !hasQuestions && <p className="slw-notice">{copy.unsupported}</p>}
                {hasQuestions && <StatusListBackgroundSourcePanel key={selected.id} campaignId={campaignId} locale={locale} targetItemId={selected.id} hideOptionSources/>}
              </>}
              {panel === "visibility" && <>
                <p className="slw-message">{copy.sourceHint}</p>
                {hiddenAncestor && <p className="slw-notice">{copy.parentHidden} <button className="underline" onClick={() => onSelect(hiddenAncestor.id)}>{hiddenAncestor.label}</button></p>}
                <label className="slw-setting"><span><Eye size={16}/>{copy.show}</span><Switch aria-label={copy.show} checked={!selected.isHidden && !hiddenAncestor} disabled={update.isPending || !!hiddenAncestor} onCheckedChange={visible => update.mutate({ isHidden: !visible })}/></label>
                <label className="slw-setting"><span>{copy.required}</span><Switch aria-label={copy.required} checked={selected.required} disabled={update.isPending} onCheckedChange={required => update.mutate({ required })}/></label>
              </>}
              {panel === "triggers" && <>
                <p className="slw-notice">{copy.chaining}</p>
                <StatusListWorkflowEditor campaignId={campaignId} locale={locale} sourceIds={contextIds} showBackgroundSources={false}/>
                <p className="slw-message">{copy.transition}</p>
                <Button variant="outline" onClick={() => setDefinitionOpen(true)}>{copy.original}</Button>
              </>}
              <details className="slw-definition" open={definitionOpen} onToggle={event => setDefinitionOpen(event.currentTarget.open)}>
                <summary>{copy.definition}</summary>{definitionOpen && definition}
              </details>
              <details className="slw-definition"><summary>{copy.advanced}</summary>{coverage}</details>
            </div>
          </> : <div className="slw-message">{copy.select}{definition}</div>}
        </article>
      </div>
    </>}
    {tab === "rules" && <div className="slw-page">
      <p className="slw-notice">{copy.transition}</p>
      <StatusListWorkflowEditor campaignId={campaignId} locale={locale} showBackgroundSources={false}/>
      <section className="slw-original"><h3>{copy.original} · {originalActions.length}</h3>
        {originalActions.map(action => <div key={action.id}><div><strong>{action.item.label}</strong><small>{action.actionType}</small></div><Button size="sm" variant="outline" onClick={() => choose(action.item.id, true)}>{copy.edit}</Button></div>)}
      </section>
    </div>}
    {tab === "tests" && <div className="slw-page"><StatusListWorkflowDiagnostics campaignId={campaignId} locale={locale}/></div>}
    </div>
  </section></StatusListViewport>;
}
