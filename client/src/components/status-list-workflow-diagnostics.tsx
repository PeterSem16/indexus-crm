import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Play, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SavedStatusListWorkflow, WorkflowAction, WorkflowAnswer, WorkflowCatalogItem } from "@shared/status-list-workflow";
import { dryRunStatusListRule } from "@/lib/status-list-dry-run";
import { getStatusListWorkspaceCopy } from "./status-list-workspace-copy";
import { getStatusWorkflowActionCopy } from "./status-list-workflow-action-copy";
import { getStatusListWorkflowCopy } from "./status-list-workflow-copy";
import { getStatusListChainCopy } from "./status-list-chain-copy";

type Run = { id: string; ruleName: string; branch: string; createdAt: string; actorKind: string; actorName: string | null; results: { sourceLabel?: string; targetLabel?: string; status: string; type?: WorkflowAction["type"]; previous?: WorkflowAnswer | null; value?: WorkflowAnswer | null; reason?: string; chainStatus?: string; causation?: { rootEventId: string; parentRunId: string; depth: number } }[] };
const read = async (endpoint: string) => {
  const response = await fetch(endpoint, { credentials: "include" });
  if (!response.ok) throw Error(String(response.status));
  return response.json();
};
export function StatusListWorkflowDiagnostics({ campaignId, locale }: { campaignId: string; locale: string }) {
  const copy = getStatusListWorkspaceCopy(locale), workflowCopy = getStatusListWorkflowCopy(locale), actionCopy = getStatusWorkflowActionCopy(locale);
  const chainCopy = getStatusListChainCopy(locale);
  const root = `/api/campaigns/${campaignId}/status-list-workflows`;
  const definitions = useQuery<{ rules: SavedStatusListWorkflow[]; catalog: WorkflowCatalogItem[] }>({ queryKey: ["/api/campaigns", campaignId, "status-list-workflows"], queryFn: () => read(root) });
  const history = useQuery<{ runs: Run[] }>({ queryKey: [root, "history"], queryFn: () => read(`${root}/history`), staleTime: 0, refetchOnMount: "always" });
  const [selected, setSelected] = useState("");
  const [source, setSource] = useState<WorkflowAnswer | undefined>(undefined);
  const [values, setValues] = useState<(WorkflowAnswer | undefined)[]>([]);
  const [result, setResult] = useState<ReturnType<typeof dryRunStatusListRule> | null>(null);
  const rule = definitions.data?.rules.find(item => item.id === selected);
  const catalog = definitions.data?.catalog || [];
  const formatValue = (value: WorkflowAnswer | null | undefined) => value === null || value === undefined ? workflowCopy.noAnswer : typeof value === "boolean" ? value ? workflowCopy.booleanTrue : workflowCopy.booleanFalse : value;
  const branchLabel = (branch: string) => branch === "then" ? workflowCopy.then : branch === "else" ? workflowCopy.otherwise : workflowCopy.invalidResult;
  const field = (label: string, value: WorkflowAnswer | undefined, change: (value: WorkflowAnswer | undefined) => void, item?: WorkflowCatalogItem) => {
    const type = item?.fieldType.toLowerCase();
    return <label>{label}{type && ["checkbox", "radio", "boolean", "yesno", "yes_no"].includes(type) ?
      <select value={value === undefined ? "__unknown__" : String(value)} onChange={event => change(event.target.value === "__unknown__" ? undefined : ["yesno", "yes_no"].includes(type) ? event.target.value : event.target.value === "true")}>
        <option value="__unknown__">{copy.unknown}</option>
        {["yesno", "yes_no"].includes(type) ? <><option value="yes">{workflowCopy.yes}</option><option value="no">{workflowCopy.no}</option></> : <><option value="true">{workflowCopy.booleanTrue}</option><option value="false">{workflowCopy.booleanFalse}</option></>}
      </select> : <input value={value === undefined ? "" : String(value)} placeholder={copy.unknown} onChange={event => change(event.target.value === "" ? undefined : event.target.value)}/>}
    </label>;
  };
  return <div className="slw-diagnostics">
    <section data-testid="status-list-dry-run"><h3>{copy.dryRun}</h3><p className="slw-notice"><ShieldCheck size={15}/>{copy.dryHint}</p>
      {definitions.isError ? <Button variant="outline" onClick={() => void definitions.refetch()}>{copy.error}</Button> :
        <select aria-label={workflowCopy.name} value={selected} onChange={event => { setSelected(event.target.value); setValues([]); setSource(undefined); setResult(null); }}>
          <option value="">{copy.select}</option>{definitions.data?.rules.map(rule => <option key={rule.id} value={rule.id}>{rule.name}</option>)}
        </select>}
      {rule && <>
        {!rule.enabled && <p className="slw-notice">{workflowCopy.disabled}</p>}
        {field("WHEN · " + (catalog.find(item => item.kind === rule.source.kind && item.id === rule.source.id)?.label || rule.source.id), source, value => { setSource(value); setResult(null); }, catalog.find(item => item.kind === rule.source.kind && item.id === rule.source.id))}
        {rule.conditions.map((condition, index) => <div key={index}>{field("IF · " + (catalog.find(item => item.kind === condition.ref?.kind && item.id === condition.ref?.id)?.label || condition.field), values[index],
          value => { setValues(previous => { const next = [...previous]; next[index] = value; return next; }); setResult(null); },
          catalog.find(item => item.kind === condition.ref?.kind && item.id === condition.ref?.id))}</div>)}
        <Button data-testid="status-list-run-test" onClick={() => setResult(dryRunStatusListRule(rule, source, values))}><Play size={14} className="mr-2"/>{copy.run}</Button>
      </>}
      {result && <div className="slw-run" data-testid="status-list-test-result">
        <strong>{result.branch === "none" ? copy.noTrigger : branchLabel(result.branch)}</strong>
        {result.actions.map((action, index) => <p key={index}>{actionCopy.labels[action.type]} → {catalog.find(item => item.kind === action.target.kind && item.id === action.target.id)?.label || action.target.id}</p>)}
        <p>{copy.noEffects}</p><small>{chainCopy.dryRun}</small>
      </div>}
    </section>
    <section data-testid="status-list-history"><div className="flex items-center justify-between gap-2"><h3>{copy.history}</h3><Button size="icon" variant="ghost" aria-label={workflowCopy.retry} onClick={() => void history.refetch()}><RefreshCw size={15}/></Button></div>
      {history.isLoading && <div className="h-20 animate-pulse rounded bg-muted"/>}
      {history.isError && <p className="slw-notice">{copy.error}</p>}
      {history.data?.runs.length === 0 && <p className="slw-message">{copy.noRuns}</p>}
      {history.data?.runs.map(run => <article className="slw-run" key={run.id}>
        <strong>{run.ruleName}</strong>
        <small>{new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "medium", timeZone: "Europe/Bratislava" }).format(new Date(run.createdAt))} · {run.actorKind === "system" ? copy.system : run.actorName || copy.agent}</small>
        <p>{branchLabel(run.branch)}</p>
        {run.results.map((item, index) => <div key={index}>
          <p>{item.sourceLabel} {item.targetLabel && <>→ {item.targetLabel}</>}</p>
          <p>{item.type && actionCopy.labels[item.type]} · {item.status === "changed" ? workflowCopy.changed : item.status === "skipped" ? workflowCopy.skipped : workflowCopy.invalidResult}</p>
          {item.causation && <details><summary>{chainCopy.chained} · {item.causation.depth}</summary><small>{item.causation.rootEventId}<br/>{item.causation.parentRunId}</small></details>}
          {item.chainStatus === "limit_reached" && <small>{chainCopy.limit}</small>}
          {"value" in item && <small>{formatValue(item.previous)} → {formatValue(item.value)}</small>}
          {item.reason && <small>{item.reason === "chain_conflict" ? chainCopy.conflict : item.reason === "unchanged" ? workflowCopy.unchangedReason : item.reason === "not_empty" ? workflowCopy.notEmptyReason : workflowCopy.otherReason}</small>}
        </div>)}
      </article>)}
    </section>
  </div>;
}
