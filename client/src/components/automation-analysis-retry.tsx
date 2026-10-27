import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { AutomationFlowPreview, type FlowCatalog } from "./automation-flow-preview";
import type { FlowRule } from "@/lib/automation-flow-model";
import { getConditionChoiceCopy } from "@/i18n/automation-condition-choice-copy";
import type { AutomationRetryCopy } from "@/i18n/automation-retry-translations";

type RetryPreview = {
  token: string; ruleName: string; actions: string[];
  runs: { id: string; status: string; skippedReason: string | null; startedAt: string }[];
  attempts: { id: string; status: string; createdAt: string; canResume: boolean }[];
  effects: { actionIndex: number; status: string }[];
  rule?: { module: string; trigger: unknown; conditions: unknown; actions: unknown[]; countryCode: string | null;
    countryCodes: string[] | null; name: string; enabled: boolean };
  actionResults?: { runId: string; actionIndex: number; actionType: string; status: string; executedAt: string | null }[];
  existingAnalyses?: { attemptId: string; status: string; summary: string | null; sentiment: string | null;
    tone: string | null; hasInvoice: boolean | null; attachmentCount: number; failedAttachmentCount: number }[];
};
type AnalysisPayload = {
  attemptId: string; status: string;
  analysis: { summary: string | null; sentiment: string | null; tone: string | null; hasInvoice: boolean | null;
    attachmentCount: number; failedAttachmentCount: number } | null;
};
type Props = { ruleId: string; sourceId: string; sourceEvent: string; diagnosticKey: string };

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", cache: "no-store", ...init });
  if (!response.ok) throw new Error("retry-request-failed");
  return await response.json() as T;
}

export function AutomationAnalysisRetry({ ruleId, sourceId, sourceEvent, diagnosticKey }: Props) {
  const { t, locale } = useI18n();
  const copy = (t as typeof t & { automationRetry: AutomationRetryCopy }).automationRetry;
  const [preview, setPreview] = useState<RetryPreview | null>(null);
  const [result, setResult] = useState<AnalysisPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [analyzeConfirmed, setAnalyzeConfirmed] = useState(false);
  const [executeConfirmed, setExecuteConfirmed] = useState(false);
  const [selectedAttempt, setSelectedAttempt] = useState("");
  const catalog = useQuery<FlowCatalog>({ queryKey: ["/api/automation/catalog"], enabled: !!preview });
  const requestId = useRef<string | null>(null);
  const currentKey = useRef(diagnosticKey);
  currentKey.current = diagnosticKey;
  const endpoint = `/api/automation/rules/${encodeURIComponent(ruleId)}/analysis-retry`;
  const date = (value: string) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString(locale, { timeZone: "Europe/Bratislava" });
  };
  const statusText = (status: string) => copy.status[status as keyof typeof copy.status] || status;
  const actionLabel = (type: string) => (t.automationServices.names as Record<string, string>)[type] ||
    catalog.data?.actionTypes.find(action => action.value === type)?.label || type;
  const signalLabel = (value: string | null) => value ? getConditionChoiceCopy(locale).values[value] || value : "—";

  useEffect(() => {
    setPreview(null); setResult(null); setError(""); setAnalyzeConfirmed(false);
    setExecuteConfirmed(false); setSelectedAttempt(""); requestId.current = null;
  }, [diagnosticKey]);

  const fetchPreview = async (preserveResult = false) => {
    const key = diagnosticKey;
    setBusy(true); setError("");
    setPreview(null);
    setAnalyzeConfirmed(false); setExecuteConfirmed(false); setSelectedAttempt("");
    requestId.current = null;
    if (!preserveResult) setResult(null);
    try {
      const data = await requestJson<RetryPreview>(`${endpoint}/preview`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId, sourceEvent }),
      });
      if (currentKey.current !== key) return;
      setPreview(data);
      requestId.current = crypto.randomUUID();
      if (!preserveResult) setResult(null);
    } catch {
      if (currentKey.current === key) setError(copy.previewError);
    } finally {
      if (currentKey.current === key) setBusy(false);
    }
  };

  const selectionMatches = !!preview && currentKey.current === diagnosticKey;
  const analyze = async () => {
    if (!selectionMatches || !preview || !analyzeConfirmed || busy || !requestId.current) return;
    const key = diagnosticKey;
    setBusy(true); setError(""); setExecuteConfirmed(false);
    try {
      const data = await requestJson<AnalysisPayload>(`${endpoint}/analyze`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId, sourceEvent, token: preview.token, requestId: requestId.current, confirmed: true }),
      });
      if (currentKey.current === key) { setResult(data); setSelectedAttempt(data.attemptId); }
    } catch {
      if (currentKey.current === key) setError(copy.genericError);
    } finally {
      if (currentKey.current === key) setBusy(false);
    }
  };

  const inspectAttempt = async (attemptId: string) => {
    const key = diagnosticKey;
    if (!selectionMatches || busy || !attemptId) return;
    setBusy(true); setError("");
    try {
      const query = new URLSearchParams({ sourceId, sourceEvent });
      const data = await requestJson<AnalysisPayload>(`${endpoint}/${encodeURIComponent(attemptId)}?${query}`);
      if (currentKey.current === key) { setResult(data); setSelectedAttempt(attemptId); setExecuteConfirmed(false); }
    } catch {
      if (currentKey.current === key) setError(copy.genericError);
    } finally {
      if (currentKey.current === key) setBusy(false);
    }
  };

  const execute = async () => {
    if (!selectionMatches || !result || result.status !== "ready" || !executeConfirmed || busy) return;
    const key = diagnosticKey;
    setBusy(true); setError("");
    try {
      const data = await requestJson<{ attemptId: string; status: string }>(`${endpoint}/execute`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId, sourceEvent, attemptId: result.attemptId, confirmed: true }),
      });
      if (currentKey.current !== key) return;
      setResult(previous => previous ? { ...previous, status: data.status, attemptId: data.attemptId } : previous);
      setExecuteConfirmed(false);
      await fetchPreview(true);
    } catch {
      if (currentKey.current === key) setError(copy.genericError);
    } finally {
      if (currentKey.current === key) setBusy(false);
    }
  };

  const readyAttempt = result?.status === "ready";
  return <section className="mt-4 space-y-3 rounded-md border border-border/80 bg-background p-3" data-testid="automation-analysis-retry">
    <div>
      <h5 className="text-sm font-semibold">{copy.title}</h5>
      <p className="mt-1 text-xs text-muted-foreground">{copy.hint}</p>
    </div>
    <div className="rounded-md border-l-2 border-amber-500 bg-amber-50/60 px-3 py-2 text-xs text-foreground">
      <p>{copy.activationNote}</p><p className="mt-1">{copy.safeguards}</p><p className="mt-1">{copy.historyNote}</p>
    </div>
    <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void fetchPreview()}>
      {busy && !preview ? copy.previewing : copy.preview}
    </Button>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {preview && selectionMatches && <div className="space-y-3">
      <div className="rounded-md bg-muted/40 p-3 text-sm">
        <p><span className="font-medium">{copy.rule}:</span> {preview.ruleName}</p>
        <p className="mt-1"><span className="font-medium">{copy.actions}:</span> {preview.actions.map(actionLabel).join(", ") || copy.noActions}</p>
      </div>
      {preview.rule && <section className="space-y-2 rounded-md border p-3 text-xs">
        <h6 className="font-semibold">{copy.definition}</h6>
        <p>{copy.module}: {preview.rule.module} · {copy.rule}: {preview.rule.name} · {preview.rule.enabled ? copy.enabled : copy.paused}</p>
        {catalog.data && <AutomationFlowPreview rule={preview.rule as FlowRule} catalog={catalog.data} compact />}
        <p>{copy.countries}: {preview.rule.countryCodes?.length ? preview.rule.countryCodes.join(", ") : preview.rule.countryCode || "—"}</p>
      </section>}
      <p className="text-xs text-muted-foreground">{copy.linkedNote}</p>
      <div className="grid gap-3 lg:grid-cols-2">
        <section className="rounded-md border p-3">
          <h6 className="mb-2 text-xs font-semibold">{copy.runs}</h6>
          {preview.runs.length ? <ul className="space-y-1 text-xs">
            {preview.runs.map(run => <li key={run.id} className="break-words">
              <span className="font-medium">{statusText(run.status)}</span> · {date(run.startedAt)}
              {run.skippedReason && run.skippedReason in t.automationEligibility.reasons &&
                <span className="text-muted-foreground"> · {t.automationEligibility.reasons[run.skippedReason as keyof typeof t.automationEligibility.reasons]}</span>}
            </li>)}
          </ul> : <p className="text-xs text-muted-foreground">—</p>}
        </section>
        <section className="rounded-md border p-3">
          <h6 className="mb-2 text-xs font-semibold">{copy.attempts}</h6>
          {preview.attempts.length ? <ul className="space-y-2 text-xs">
            {preview.attempts.map(attempt => <li key={attempt.id} className="flex flex-wrap items-center gap-2">
              <span className="break-all">{attempt.id}</span><span className="font-medium">{statusText(attempt.status)}</span>
              <span className="text-muted-foreground">{date(attempt.createdAt)}</span>
              {attempt.canResume ? <Button type="button" variant="ghost" size="sm" disabled={busy}
                onClick={() => void inspectAttempt(attempt.id)}>
                {attempt.status === "ready" ? copy.resume : copy.inspect}
              </Button> : <span className="text-muted-foreground">{copy.resumeUnavailable}</span>}
            </li>)}
          </ul> : <p className="text-xs text-muted-foreground">—</p>}
        </section>
      </div>
      <section className="rounded-md border p-3">
        <h6 className="mb-2 text-xs font-semibold">{copy.effects}</h6>
        {preview.effects.length ? <ul className="space-y-1 text-xs">
          {preview.effects.map(effect => <li key={`${effect.actionIndex}:${effect.status}`}>
            {copy.actions} {effect.actionIndex + 1} · {statusText(effect.status)}
          </li>)}
        </ul> : <p className="text-xs text-muted-foreground">—</p>}
      </section>
      {preview.existingAnalyses?.length ? <section className="rounded-md border p-3">
        <h6 className="mb-2 text-xs font-semibold">{copy.analysisHistory}</h6>
        <ul className="space-y-2 text-xs">{preview.existingAnalyses.map(item => <li key={item.attemptId} className="break-words border-t pt-2 first:border-0 first:pt-0">
          <p className="font-medium">{item.attemptId} · {statusText(item.status)}</p>
          <p>{copy.summary}: {item.summary || "—"} · {copy.sentiment}: {signalLabel(item.sentiment)} · {copy.tone}: {signalLabel(item.tone)}</p>
          <p>{copy.invoice}: {item.hasInvoice == null ? "—" : item.hasInvoice ? "✓" : "—"} · {copy.attachments}: {item.attachmentCount} · {copy.failedAttachments}: {item.failedAttachmentCount}</p>
        </li>)}</ul>
      </section> : null}
      {preview.actionResults?.length ? <section className="rounded-md border p-3">
        <h6 className="mb-2 text-xs font-semibold">{copy.actionResults}</h6>
        <ul className="space-y-1 text-xs">{preview.actionResults.map((item, index) => <li key={`${item.runId}:${item.actionIndex}:${index}`} className="break-words">
          {actionLabel(item.actionType)} · {statusText(item.status)} · {item.runId} {item.executedAt ? `· ${date(item.executedAt)}` : ""}
        </li>)}</ul>
      </section> : null}
      <div className="space-y-2 border-t pt-3">
        <label className="flex items-start gap-2 text-xs">
          <input type="checkbox" checked={analyzeConfirmed} disabled={busy}
            onChange={event => setAnalyzeConfirmed(event.target.checked)} />
          <span>{copy.confirmAnalyze}</span>
        </label>
        {catalog.isError && <p role="alert" className="text-xs text-destructive">{copy.previewError}</p>}
        <Button type="button" size="sm" disabled={busy || !analyzeConfirmed || !requestId.current || !catalog.data}
          onClick={() => void analyze()}>{busy ? copy.analyzing : copy.analyze}</Button>
        {result && <div className="space-y-2 rounded-md bg-muted/40 p-3 text-sm" aria-live="polite">
          <p className="font-medium">{copy.attempt}: {result.attemptId} · {statusText(result.status)}</p>
          {result.status === "done" && <p className="text-xs text-muted-foreground">{copy.doneNote}</p>}
          {result.analysis ? <>
            <p><span className="font-medium">{copy.summary}:</span> {result.analysis.summary || "—"}</p>
            <p>{copy.sentiment}: {signalLabel(result.analysis.sentiment)} · {copy.tone}: {signalLabel(result.analysis.tone)}</p>
            <p>{copy.invoice}: {result.analysis.hasInvoice == null ? "—" : result.analysis.hasInvoice ? "✓" : "—"} · {copy.attachments}: {result.analysis.attachmentCount} · {copy.failedAttachments}: {result.analysis.failedAttachmentCount}</p>
          </> : <p className="text-muted-foreground">{copy.noAnalysis}</p>}
          {result.status === "ready" && <div className="space-y-2 border-t pt-2">
            <p className="text-xs text-muted-foreground">{copy.effectsNeverResent}</p>
            <label className="flex items-start gap-2 text-xs">
              <input type="checkbox" checked={executeConfirmed} disabled={busy}
                onChange={event => setExecuteConfirmed(event.target.checked)} />
              <span>{copy.confirmExecute}</span>
            </label>
            <Button type="button" size="sm" disabled={busy || !executeConfirmed || !readyAttempt || preview.actions.length === 0}
              onClick={() => void execute()}>{busy ? copy.executing : copy.execute}</Button>
          </div>}
        </div>}
      </div>
    </div>}
  </section>;
}
