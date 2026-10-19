import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Activity, ArrowDown, ArrowUp, ChevronDown, ChevronRight, Eye, EyeOff, Layers3, Search, Settings2, ShieldCheck, UserRound, Workflow, Zap } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { StatusListOptionSourcePanel, isOptionGroup } from "./status-list-option-source-panel";
import { StatusListBackgroundSourcePanel } from "./status-list-background-source-panel";
import { StatusListWorkflowEditor } from "./status-list-workflow-editor";
import { StatusListWorkflowDiagnostics } from "@/components/status-list-workflow-diagnostics";
import { getStatusListWorkspaceCopy } from "./status-list-workspace-copy";
import type { OptionSource } from "@shared/status-list-option-source";
import type { WorkflowCatalogItem } from "@shared/status-list-workflow";
import "./status-list-workspace.css";

export type WorkspaceItem = {
  id: string; label: string; stepId: string; parentId: string | null; sortOrder: number;
  itemType?: string; confirmationType: string; tab?: string | null; isHidden?: boolean; required: boolean;
  automations: { id: string; actionType: string }[];
  questions: { id: string; questionText: string; automations: { id: string; actionType: string }[] }[];
};
type Props = {
  campaignId: string; locale: string; items: WorkspaceItem[]; selectedId: string; onSelect: (id: string) => void;
  tools: ReactNode; definition: ReactNode; coverage: ReactNode;
};
export function StatusListWorkspace({ campaignId, locale, items, selectedId, onSelect, tools, definition, coverage }: Props) {
  const copy = getStatusListWorkspaceCopy(locale);
  const { toast } = useToast();
  const [tab, setTab] = useState<"content" | "rules" | "tests">("content");
  const [panel, setPanel] = useState<"owner" | "visibility" | "triggers">("owner");
  const [phase, setPhase] = useState("all");
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [definitionOpen, setDefinitionOpen] = useState(false);
  const endpoint = `/api/campaigns/${campaignId}/status-list-workflows/option-sources`;
  const sourceQuery = useQuery<{ sources: OptionSource[]; catalog: WorkflowCatalogItem[] }>({
    queryKey: [endpoint],
    queryFn: async () => { const response = await fetch(endpoint, { credentials: "include" }); if (!response.ok) throw Error(String(response.status)); return response.json(); },
  });
  const selected = items.find(item => item.id === selectedId);
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
    mutationFn: (patch: { isHidden?: boolean; required?: boolean }) => apiRequest("PATCH", `/api/campaigns/${campaignId}/status-list-workflows/items/${selectedId}/presentation`, patch),
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
    mutationFn: (direction: "up" | "down") => apiRequest("POST", `/api/campaigns/${campaignId}/status-list-workflows/items/${selectedId}/move`, { direction }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "status-list"] }),
    onError: () => toast({ title: copy.error, variant: "destructive" }),
  });
  const siblings = items.filter(item => item.parentId === selected?.parentId && item.itemType === selected?.itemType && item.tab === selected?.tab).sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  const selectedIndex = siblings.findIndex(item => item.id === selectedId);
  const childrenOf = (id: string) => items.filter(item => item.parentId === id).sort((a, b) => a.sortOrder - b.sortOrder);
  const matches = (item: WorkspaceItem, seen = new Set<string>()): boolean => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return `${item.label} ${item.stepId} ${item.questions.map(q => q.questionText).join(" ")}`.toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale)) ||
      childrenOf(item.id).some(child => matches(child, seen));
  };
  const roots = items.filter(item => (!item.parentId || !items.some(parent => parent.id === item.parentId)) &&
    (phase === "quick" ? item.itemType === "option" : item.itemType !== "option" &&
      (phase === "all" || !item.tab || item.tab === "both" || item.tab === phase))).sort((a, b) => a.sortOrder - b.sortOrder);
  const choose = (id: string, edit = false) => { onSelect(id); setTab("content"); setPanel("owner"); setDefinitionOpen(edit); };
  const renderTree = (item: WorkspaceItem, depth = 0, seen = new Set<string>()): ReactNode => {
    if (seen.has(item.id) || !matches(item)) return null;
    const next = new Set(seen).add(item.id), children = childrenOf(item.id), open = !collapsed.has(item.id);
    return <div key={item.id} className={depth ? "slw-tree-branch" : ""}>
      <div className={`slw-tree-row ${selectedId === item.id ? "selected" : ""}`}>
        {children.length ? <button type="button" aria-label={copy.structure} aria-expanded={open} onClick={() => setCollapsed(previous => { const result = new Set(previous); result.has(item.id) ? result.delete(item.id) : result.add(item.id); return result; })}>{open ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</button> : <span className="slw-dot"/>}
        <button type="button" data-testid={`status-list-select-${item.id}`} className="slw-tree-label" onClick={() => choose(item.id)}><small>{item.stepId}</small><span>{item.label}</span></button>
        {item.isHidden && <EyeOff size={12}/>}
        {item.required && <span className="slw-required" title={copy.required}>*</span>}
        {item.automations.length > 0 && <span title={copy.original}><Zap size={12}/></span>}
      </div>
      {open && children.map(child => renderTree(child, depth + 1, next))}
      {open && item.questions.map(question => <button key={question.id} className="slw-question-link" onClick={() => choose(item.id, true)}>{question.questionText}</button>)}
    </div>;
  };
  const originalActions = items.flatMap(item => [
    ...item.automations.map(action => ({ ...action, item })),
    ...item.questions.flatMap(question => question.automations.map(action => ({ ...action, item, question }))),
  ]);
  return <section className="slw" data-testid="status-list-workspace">
    <header className="slw-heading"><div><h2>Status List</h2><p>{copy.sourceHint}</p></div><span><ShieldCheck size={14}/>{copy.chaining}</span></header>
    <nav className="slw-tabs" aria-label="Status List">
      {([["content", Layers3, copy.content], ["rules", Workflow, copy.rules], ["tests", Activity, copy.tests]] as const).map(([value, Icon, label]) =>
        <button key={value} type="button" data-testid={`status-list-tab-${value}`} aria-current={tab === value ? "page" : undefined} className={tab === value ? "active" : ""} onClick={() => setTab(value)}><Icon size={15}/>{label}</button>)}
    </nav>
    {tab === "content" && <>
      <div className="slw-tools">{tools}</div>
      <div className="slw-layout">
        <aside className="slw-outline">
          <h3>{copy.structure}</h3>
          <div className="slw-phases">{(["all", "acquisition", "contract", "retention", "quick"] as const).filter(value => value !== "contract" || items.some(item => item.tab === "contract")).map(value =>
            <button type="button" className={phase === value ? "active" : ""} onClick={() => setPhase(value)} key={value}>{copy[value]}</button>)}</div>
          <label className="slw-search"><Search size={14}/><input aria-label={copy.search} placeholder={copy.search} value={search} onChange={event => setSearch(event.target.value)}/></label>
          <div className="slw-tree">{roots.some(item => matches(item)) ? roots.map(item => renderTree(item)) : <p className="slw-message">{copy.empty}</p>}</div>
          <div className="slw-tree-actions"><Button variant="ghost" size="icon" aria-label={copy.up} disabled={move.isPending || selectedIndex <= 0} onClick={() => move.mutate("up")}><ArrowUp size={14}/></Button><Button variant="ghost" size="icon" aria-label={copy.down} disabled={move.isPending || selectedIndex < 0 || selectedIndex >= siblings.length - 1} onClick={() => move.mutate("down")}><ArrowDown size={14}/></Button><Button variant="ghost" size="sm" disabled={!selected} onClick={() => setDefinitionOpen(true)}>{copy.edit}</Button></div>
        </aside>
        <article className="slw-detail">
          {selected ? <>
            <header className="slw-detail-heading"><small>{selected.stepId}</small><h3>{selected.label}</h3></header>
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
  </section>;
}
