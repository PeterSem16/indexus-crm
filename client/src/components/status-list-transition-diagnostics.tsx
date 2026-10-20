import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  compareTransitionModels,
  TRANSITION_GATES,
  transitionBoundaryMatrix,
  type TransitionComparison,
  type TransitionEffect,
  type TransitionInventories,
  type TransitionInventory,
  type TransitionScenario,
} from "@shared/status-list-transition";
import { getStatusListTransitionCopy } from "./status-list-transition-copy";
import "./status-list-transition-diagnostics.css";

type Preset = "weekday" | "friday" | "weekend" | "springDst" | "manual" | "existing";
const PRESETS: Record<Preset, { now: string; manualDate?: string; existingDate?: string }> = {
  weekday: { now: "2026-10-20T12:00:00Z" },
  friday: { now: "2026-10-23T12:00:00Z" },
  weekend: { now: "2026-10-24T12:00:00Z" },
  springDst: { now: "2027-03-26T12:00:00Z" },
  manual: { now: "2026-10-20T12:00:00Z", manualDate: "2026-11-02T10:30:00+01:00" },
  existing: { now: "2026-10-21T07:00:00Z", existingDate: "2026-10-20T07:00:00Z" },
};
const issueKeys = {
  condition_unsupported: "unsupportedCondition",
  reference_missing: "missingReference",
  calendar_unsupported: "calendarUnsupported",
  action_unsupported: "unsupportedAction",
  legacy_notification_unhandled: "notify",
  excluded_by_owner: "excluded",
  exclusion_changed: "exclusionChanged",
} as const;
const gates: Record<(typeof TRANSITION_GATES)[number], keyof ReturnType<typeof getStatusListTransitionCopy>> = {
  executor_missing: "gateExecutor",
  ownership_unverified: "gateOwnership",
  inflight_unverified: "gateInflight",
  dependencies_unverified: "gateDependencies",
  live_fingerprint_unverified: "gateFingerprint",
};
const actionLabels: Record<string, keyof ReturnType<typeof getStatusListTransitionCopy>> = {
  set_callback: "actionSetCallback",
  set_contact_status: "actionSetStatus",
  notify_role: "actionNotifyRole",
  send_email_group: "actionEmail",
};
function actionText(type: string, copy: ReturnType<typeof getStatusListTransitionCopy>) {
  const key = actionLabels[type];
  return key ? copy[key] : type;
}
function interpolate(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}
function useInventory(campaignId: string) {
  return useQuery<TransitionInventories>({
    queryKey: ["/api/campaigns", campaignId, "status-list-workflows", "transition-inventory"],
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/status-list-workflows/transition-inventory`, {
        credentials: "include", cache: "no-store",
      });
      if (!response.ok) throw new Error(String(response.status));
      return response.json() as Promise<TransitionInventories>;
    },
    enabled: Boolean(campaignId),
    staleTime: 0,
    refetchOnMount: "always",
  });
}
function conditionText(action: TransitionInventory["actions"][number], copy: ReturnType<typeof getStatusListTransitionCopy>) {
  if (action.condition.kind === "always") return copy.always;
  if (action.condition.kind === "unsupported") return copy.unsupportedCondition;
  return `${action.condition.logic} · ${action.condition.rules.map(rule => `${copy.countRule} ${rule.op} ${rule.value}`).join(" · ")}`;
}
function effectText(effect: TransitionEffect, copy: ReturnType<typeof getStatusListTransitionCopy>) {
  switch (effect.status) {
    case "condition_false": return copy.conditionFalse;
    case "not_triggered": return copy.notTriggered;
    case "unverified": return copy.unverified;
    case "excluded": return copy.excludedStatus;
    case "callback": return copy.callback;
  }
}
function EffectView({ effect, copy, locale }: { effect: TransitionEffect; copy: ReturnType<typeof getStatusListTransitionCopy>; locale: string }) {
  return <div>
    <span className="slt-status">{effectText(effect, copy)}</span>
    {effect.callbackDate && <p><small>{copy.callbackDate}: {new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Bratislava" }).format(new Date(effect.callbackDate))}</small></p>}
    {effect.dispositionId && <p><small>{copy.referencePresent}</small></p>}
    {effect.assignsActingAgent && <p><small>{copy.actingAgent}</small></p>}
    {effect.keptExisting && <p><small>{copy.keptExisting}</small></p>}
    {effect.policy && <p><small>{effect.policy === "replace" ? copy.existingReplace : copy.existingKeep}</small></p>}
  </div>;
}
function ResultRows({ inventory, comparisons, copy, locale }: { inventory: TransitionInventory; comparisons: TransitionComparison[]; copy: ReturnType<typeof getStatusListTransitionCopy>; locale: string }) {
  return <>{comparisons.map(result => {
    const action = inventory.actions.find(row => row.id === result.id);
    return <div className="slt-result" key={result.id}>
      <strong>{action?.stepCode || copy.action}<small>{action ? actionText(action.type, copy) : ""}</small></strong>
      <EffectView effect={result.legacy} copy={copy} locale={locale}/>
    </div>;
  })}</>;
}
export function StatusListTransitionDiagnostics({ campaignId, locale }: { campaignId: string; locale: string }) {
  const copy = getStatusListTransitionCopy(locale);
  const query = useInventory(campaignId);
  const [source, setSource] = useState<"current_configuration" | "audited_production">("current_configuration");
  const [itemId, setItemId] = useState("");
  const [callCount, setCallCount] = useState(0);
  const [preset, setPreset] = useState<Preset>("weekday");
  const [manualDate, setManualDate] = useState(PRESETS.manual.manualDate || "");
  const [resultState, setResultState] = useState<{ key: string; comparisons?: TransitionComparison[]; matrix?: ReturnType<typeof transitionBoundaryMatrix>; error?: boolean } | null>(null);
  const inventories = !query.isFetching && !query.isError ? query.data : undefined;
  const selectedInventory = source === "audited_production" ? inventories?.audited || null : inventories?.current || null;
  const inventoryFingerprint = selectedInventory ? `${selectedInventory.campaignId}:${selectedInventory.source}:${selectedInventory.fingerprint}` : "";
  const selectedAction = selectedInventory?.actions.find(action => action.itemId === itemId);
  const eligibleItems = useMemo(() => {
    const unique = new Map<string, TransitionInventory["actions"][number]>();
    selectedInventory?.actions.forEach(action => { if (!unique.has(action.itemId)) unique.set(action.itemId, action); });
    return Array.from(unique.values());
  }, [inventoryFingerprint]);
  const scenarioKey = `${campaignId}|${source}|${inventoryFingerprint}|${itemId}|${callCount}|${preset}|${manualDate}`;
  const safeResults = resultState?.key === scenarioKey ? resultState : null;
  useEffect(() => {
    setResultState(null);
  }, [scenarioKey]);
  useEffect(() => {
    if (selectedInventory && !selectedInventory.actions.some(action => action.itemId === itemId)) {
      setItemId(selectedInventory.actions[0]?.itemId || "");
      setResultState(null);
    }
  }, [inventoryFingerprint, itemId]);
  useEffect(() => {
    if (!inventories?.audited && source === "audited_production") setSource("current_configuration");
  }, [inventories?.audited, source]);
  const snapshotDate = selectedInventory?.capturedAt ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Bratislava" }).format(new Date(selectedInventory.capturedAt)) : "";
  const run = () => {
    if (!selectedInventory || !itemId) return;
    const selectedPreset = PRESETS[preset];
    const scenario: TransitionScenario = {
      itemId, callCount, now: selectedPreset.now,
      ...(preset === "manual" ? { manualDate } : {}),
      ...(selectedPreset.existingDate ? { existingDate: selectedPreset.existingDate } : {}),
    };
    try {
      const comparisons = compareTransitionModels(selectedInventory, scenario);
      const matrix = transitionBoundaryMatrix(selectedInventory);
      setResultState({ key: scenarioKey, comparisons, matrix });
    } catch {
      setResultState({ key: scenarioKey, error: true });
    }
  };
  const presetOptions: { value: Preset; label: string }[] = [
    { value: "weekday", label: copy.weekday }, { value: "friday", label: copy.friday },
    { value: "weekend", label: copy.weekend }, { value: "springDst", label: copy.springDst },
    { value: "manual", label: copy.manual }, { value: "existing", label: copy.existing },
  ];
  return <section className="slt" data-testid="status-list-transition-diagnostics">
    <header className="slt-head"><div><span className="slt-kicker">{copy.eyebrow}</span><h3>{copy.title}</h3><p>{copy.intro}</p></div></header>
    <div className="slt-body">
      {query.isFetching && !query.isError && <div className="slt-skeleton" role="status" aria-label={copy.loading} data-testid="transition-inventory-loading"/>}
      {query.isError && <div className="slt-warning" role="alert"><AlertTriangle size={15}/><span>{copy.error}</span><Button variant="outline" size="sm" data-testid="transition-inventory-retry" onClick={() => void query.refetch()}><RefreshCw size={13} className="mr-1"/>{copy.retry}</Button></div>}
      {!query.isFetching && !query.isError && inventories && <><div className="slt-warning" data-testid="transition-not-live-warning"><AlertTriangle size={15}/><span>{source === "audited_production" ? interpolate(copy.auditedWarning, { date: snapshotDate }) : copy.currentWarning}</span></div>{selectedInventory && !selectedInventory.evidence.schemaAvailable && <div className="slt-warning"><AlertTriangle size={15}/><span>{copy.schemaWarning}</span></div>}</>}
      {inventories && <div className="slt-controls">
        <label className="slt-field">{copy.source}<select data-testid="transition-source" value={source} onChange={event => { setSource(event.target.value as typeof source); setResultState(null); }}>
          <option value="current_configuration">{copy.current}</option>
          {inventories.audited && <option value="audited_production">{copy.audited}</option>}
        </select></label>
        <label className="slt-field">{copy.item}<select data-testid="transition-item" value={itemId} onChange={event => { setItemId(event.target.value); setResultState(null); }}>
          {eligibleItems.map(action => <option key={action.itemId} value={action.itemId}>{action.stepCode} · {actionText(action.type, copy)}</option>)}
        </select></label>
        <label className="slt-field">{copy.callCount}<input data-testid="transition-call-count" type="number" min={0} max={999999999} step={1} value={callCount} onChange={event => { const value = event.target.value === "" ? 0 : Number(event.target.value); setCallCount(Number.isFinite(value) ? Math.max(0, Math.min(999999999, Math.floor(value))) : 0); setResultState(null); }}/></label>
        <label className="slt-field">{copy.scenario}<select data-testid="transition-clock-scenario" value={preset} onChange={event => { setPreset(event.target.value as Preset); setResultState(null); }}>
          {presetOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select></label>
        {preset === "manual" && <label className="slt-field">{copy.manualDate}<input data-testid="transition-manual-date" value={manualDate} readOnly aria-readonly="true"/></label>}
      </div>}
      {selectedInventory && <div className="slt-source-meta" data-testid="transition-source-metadata">
        <span><strong>{copy.captured}:</strong> {snapshotDate}</span>
        <span><strong>{copy.snapshotItems}:</strong> {selectedInventory.evidence.itemCount}</span>
      </div>}
      {selectedInventory && <>
        <div className="slt-actions">
          <Button data-testid="transition-compare" onClick={run} disabled={!selectedAction}>{copy.run}</Button>
        </div>
        <section className="slt-inventory" data-testid="transition-action-inventory">
          <header><strong>{copy.inventory}</strong><small>{interpolate(copy.itemCount, { count: selectedInventory.actions.length })}</small></header>
          {selectedInventory.actions.length === 0 ? <p className="slt-empty">{copy.empty}</p> : selectedInventory.actions.map(action => (
            <article className="slt-row" key={action.id} data-testid={`transition-action-${action.id}`}>
              <div className="slt-row-title"><strong>{action.stepCode}</strong><span>{actionText(action.type, copy)}</span>{action.excluded && <span className="slt-pill">{copy.excluded}</span>}</div>
              <div className="slt-definition"><strong>{copy.condition}</strong><p>{conditionText(action, copy)}</p>{action.condition.kind === "call_count" && <small>{action.condition.logic} · {action.condition.rules.map(rule => `${rule.op} ${rule.value}`).join(" · ")}</small>}</div>
              <div className="slt-definition"><strong>{copy.policy}</strong>{action.callback ? <><p>{interpolate(copy.callbackDays, { days: action.callback.days })} · {action.callback.weekdaysOnly ? copy.weekdaysOnly : copy.everyDay}</p><p>{action.callback.time ? interpolate(copy.atTime, { time: action.callback.time }) : copy.missingCallback}</p><small>{action.callback.existing === "replace" ? copy.existingReplace : copy.existingKeep}</small></> : <p>{action.type === "notify_role" ? copy.notify : copy.missingCallback}</p>}</div>
              <div className="slt-definition"><strong>{copy.issues}</strong>{action.dispositionId ? <small>{copy.referencePresent}</small> : <small>{copy.missingDisposition}</small>}<div className="slt-issues">{action.issues.map(issue => <span className="slt-pill" key={issue}>{copy[issueKeys[issue]]}</span>)}</div></div>
            </article>
          ))}
        </section>
        <section className="slt-gates" data-testid="transition-gates">
          <header><strong>{copy.gates} · {copy.activationFalse}</strong><span>{copy.blocked}</span></header><p>{copy.gatesHint}</p>
          <ul>{TRANSITION_GATES.map(gate => <li key={gate}>{copy[gates[gate]]}</li>)}</ul>
        </section>
        {resultState?.key === scenarioKey && resultState.error && <p className="slt-warning" role="alert" data-testid="transition-simulation-error">{copy.simulationError}</p>}
        {safeResults?.comparisons && safeResults.matrix && <div data-testid="transition-results">
          <div className="slt-run">
            <section className="slt-model"><h4>{copy.legacy}<span>{copy.runtimeCaveat}</span></h4><ResultRows inventory={selectedInventory} comparisons={safeResults.comparisons} copy={copy} locale={locale}/></section>
            <section className="slt-model"><h4>{copy.proposed}<span>{copy.runtimeCaveat}</span></h4>{safeResults.comparisons.map(result => {
              const action = selectedInventory.actions.find(row => row.id === result.id);
              return <div className="slt-result" key={result.id}>
                <strong>{action?.stepCode || copy.action}<small>{action ? actionText(action.type, copy) : ""}</small><small>{result.comparison === "model_match" ? copy.modelMatch : result.comparison === "excluded" ? copy.excludedStatus : copy.notComparable}</small></strong>
                <EffectView effect={result.proposed} copy={copy} locale={locale}/>
              </div>;
            })}</section>
          </div>
          <p className="slt-subtle" style={{ fontSize: 10, lineHeight: 1.55 }}>{copy.notExecution}</p>
          <section className="slt-matrix" data-testid="transition-boundary-matrix">
            <header><strong>{copy.matrix}</strong><small>{copy.matrixHint}</small></header>
            {safeResults.matrix.map(row => {
              const action = selectedInventory.actions.find(item => item.id === row.id);
              return <div className="slt-matrix-row" key={row.id}><strong>{action?.stepCode || copy.action}</strong>
                {row.cases.map(boundary => <div className="slt-matrix-cell" key={boundary.callCount}><span>{interpolate(copy.callN, { count: boundary.callCount })}</span><b>{effectText(boundary.result.proposed, copy)}</b><small>{boundary.result.comparison === "model_match" ? copy.modelMatch : boundary.result.comparison === "excluded" ? copy.excludedStatus : copy.notComparable}</small></div>)}
              </div>;
            })}
          </section>
        </div>}
        <details className="slt-details" data-testid="transition-identifiers">
          <summary>{copy.identity} · {copy.detailsHint}</summary>
          <pre>{JSON.stringify({ campaignId: selectedInventory.campaignId, fingerprint: selectedInventory.fingerprint, sourceCommit: selectedInventory.evidence.sourceCommit, actions: selectedInventory.actions.map(({ id, itemId: sourceItemId, fingerprint, dispositionId }) => ({ id, itemId: sourceItemId, fingerprint, dispositionId })) }, null, 2)}</pre>
        </details>
      </>}
      {selectedInventory && selectedInventory.actions.length === 0 && <p className="slt-empty">{copy.noSource}</p>}
    </div>
  </section>;
}
