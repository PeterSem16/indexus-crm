import { useId, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { AutomationAnalysisRetry } from "@/components/automation-analysis-retry";
import type { OverviewRule } from "@/lib/automation-overview-model";
import { isAnalysisServiceEvent } from "@shared/automation-analysis-triggers";
import { ELIGIBILITY_SOURCE_EVENTS, type AnalysisEligibilityDiagnostic, type EligibilitySourceList, type RuleInputSettings } from "@shared/automation-eligibility";
import type { AutomationEligibilityCopy } from "@/i18n/automation-eligibility-translations";

function InputSettings({ settings, copy }: { settings: RuleInputSettings; copy: AutomationEligibilityCopy }) {
  const channelEvents: Record<string, string> = { email: "email.received", sms: "sms.received", voice: "voice.transcribed",
    task: "task.body_received", chat: "chat.received" };
  return <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 break-words text-xs">
    <dt>{copy.state}</dt><dd>{settings.enabled ? copy.enabled : copy.paused}</dd>
    <dt>{copy.channels}</dt><dd>{settings.channels.map(channel => copy.sources[channelEvents[channel]]).join(", ") || "—"}</dd>
    <dt>{copy.countries}</dt><dd>{settings.countries === null ? copy.allCountries : settings.countries.join(", ") || "—"}</dd>
    <dt>{copy.activation}</dt><dd className="break-words">{[settings.listenAfter, settings.reviewActivatedAt].filter(Boolean).join(" / ") || copy.noActivation}</dd>
    <dt>{copy.filters}</dt><dd>{copy.mailboxes}: {settings.mailboxMode === "selected" || settings.mailboxCount > 0 ? settings.mailboxCount : "—"};
      {" "}{copy.senders}: {settings.senderCount}; {copy.textSearch}: {settings.textSearch ? "✓" : "—"}; {copy.conditions}: {settings.hasConditions ? "✓" : "—"}</dd>
  </dl>;
}

export function AutomationEligibilityDiagnostic({ rules, ruleId }: { rules: OverviewRule[]; ruleId?: string }) {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const copy = t.automationEligibility;
  const id = useId();
  const [selectedRuleId, setSelectedRuleId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [sourceEvent, setSourceEvent] = useState<string>(ELIGIBILITY_SOURCE_EVENTS[0]);
  const [periodDays, setPeriodDays] = useState("7");
  const analysisRules = rules.filter(rule => (!ruleId || rule.id === ruleId) &&
    rule.module === "communication" && rule.trigger?.type === "event" &&
    isAnalysisServiceEvent(rule.trigger.eventType) && rule.trigger.analysis);
  const effectiveId = analysisRules.find(rule => rule.id === (ruleId || selectedRuleId))?.id || analysisRules[0]?.id;
  const selectionKey = `${effectiveId}:${sourceEvent}:${periodDays}`;
  const sources = useMutation({
    mutationFn: async ({ rule, event, days }: { key: string; rule: string; event: string; days: string }) => {
      const to = new Date();
      const from = new Date(to.getTime() - Number(days) * 86400000);
      const query = new URLSearchParams({ sourceEvent: event, from: from.toISOString(), to: to.toISOString() });
      const response = await fetch(`/api/automation/rules/${encodeURIComponent(rule)}/eligibility-sources?${query}`, {
        credentials: "include", cache: "no-store",
      });
      if (!response.ok) throw new Error("Source list unavailable");
      return await response.json() as EligibilitySourceList;
    },
  });
  const available = sources.variables?.key === selectionKey ? sources.data?.records : undefined;
  const validSourceId = available?.some(record => record.id === sourceId) ? sourceId : "";
  const diagnosticKey = `${selectionKey}:${validSourceId}`;
  const diagnostic = useMutation({
    mutationFn: async ({ rule, event, record }: { key: string; rule: string; event: string; record: string }) => {
      const query = new URLSearchParams({ sourceId: record, sourceEvent: event });
      const response = await fetch(`/api/automation/rules/${encodeURIComponent(rule)}/eligibility?${query}`, {
        credentials: "include", cache: "no-store",
      });
      if (!response.ok) throw new Error("Diagnostic unavailable");
      return await response.json() as AnalysisEligibilityDiagnostic;
    },
  });
  const result = diagnostic.variables?.key === diagnosticKey ? diagnostic.data : undefined;
  const resetSelection = () => { setSourceId(""); sources.reset(); diagnostic.reset(); };
  if (!user || !["admin", "superadmin", "owner"].includes(user.role) || !analysisRules.length) return null;
  return <details className="rounded-lg border bg-card p-3" data-testid="automation-eligibility">
    <summary className="cursor-pointer text-sm font-medium">{copy.title}</summary>
    <p className="my-3 text-xs text-muted-foreground">{copy.hint}</p>
    <form className="space-y-3" onSubmit={event => {
      event.preventDefault();
      if (effectiveId && validSourceId && !diagnostic.isPending && !sources.isPending)
        diagnostic.mutate({ key: diagnosticKey, rule: effectiveId, event: sourceEvent, record: validSourceId });
    }}>
      <fieldset disabled={diagnostic.isPending || sources.isPending} className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm" htmlFor={`${id}-rule`}><span>{copy.rule}</span>
          <select id={`${id}-rule`} className="block w-full rounded-md border bg-background p-2"
            value={effectiveId || ""} onChange={event => { setSelectedRuleId(event.target.value); resetSelection(); }}>
            {analysisRules.map(rule => <option value={rule.id} key={rule.id}>{rule.name}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm" htmlFor={`${id}-source`}><span>{copy.source}</span>
          <select id={`${id}-source`} className="block w-full rounded-md border bg-background p-2"
            value={sourceEvent} onChange={event => { setSourceEvent(event.target.value); resetSelection(); }}>
            {ELIGIBILITY_SOURCE_EVENTS.map(value => <option value={value} key={value}>{copy.sources[value]}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm" htmlFor={`${id}-period`}><span>{copy.period}</span>
          <select id={`${id}-period`} className="block w-full rounded-md border bg-background p-2"
            value={periodDays} onChange={event => { setPeriodDays(event.target.value); resetSelection(); }}>
            <option value="1">{copy.lastDay}</option><option value="7">{copy.lastWeek}</option>
            <option value="30">{copy.lastMonth}</option>
          </select>
        </label>
        <div className="flex items-end">
          <Button type="button" variant="outline" size="sm" disabled={!effectiveId} onClick={() => {
            setSourceId(""); diagnostic.reset();
            sources.mutate({ key: selectionKey, rule: effectiveId!, event: sourceEvent, days: periodDays });
          }}>{sources.isPending ? copy.loadingSources : copy.loadSources}</Button>
        </div>
        <label className="space-y-1 text-sm sm:col-span-2" htmlFor={`${id}-record`}><span>{copy.record}</span>
          <select id={`${id}-record`} className="block w-full rounded-md border bg-background p-2"
            value={validSourceId} required disabled={!available?.length} aria-describedby={`${id}-hint`}
            onChange={event => { setSourceId(event.target.value); diagnostic.reset(); }}>
            <option value="">{copy.chooseRecord}</option>
            {available?.map(record => <option key={record.id} value={record.id}>
              {new Date(record.createdAt).toLocaleString(locale, { timeZone: "Europe/Bratislava" })} · {record.id}
            </option>)}
          </select>
          <span id={`${id}-hint`} className="block text-xs text-muted-foreground">{copy.listHint}</span>
        </label>
      </fieldset>
      {sources.isError && <p role="alert" className="text-sm text-destructive">{copy.sourcesError}</p>}
      {available?.length === 0 && <p role="status" className="text-sm text-muted-foreground">{copy.noSources}</p>}
      <Button type="submit" variant="outline" size="sm" disabled={!validSourceId || diagnostic.isPending || sources.isPending}>
        {diagnostic.isPending ? copy.checking : copy.check}
      </Button>
      {diagnostic.isError && <p role="alert" className="text-sm text-destructive">{copy.error}</p>}
      {result && <div role="status" className="space-y-3 rounded-md border bg-muted/30 p-3 text-sm">
        <h4 className="font-medium">{copy.currentTitle}</h4>
        <ul className="list-disc space-y-2 pl-4">{result.reasons.map(reason =>
          <li key={reason}>{copy.reasons[reason]}</li>)}</ul>
        {result.countryUnknown && <p className="text-muted-foreground">{copy.unknown}</p>}
        {result.history.currentSettings && <InputSettings settings={result.history.currentSettings} copy={copy}/>}
        <section className="space-y-2 border-t pt-3" data-testid="automation-eligibility-history">
          <h4 className="font-medium">{copy.historyTitle}</h4>
          <p className="text-xs text-muted-foreground">{copy.historyHint}</p>
          <p>{copy.historyStatus[result.history.status]}</p>
          {result.history.eventAt && <p className="text-xs">{copy.eventAt}: {result.history.eventAt}</p>}
          {result.history.status === "verified" && <>
            <p className="text-xs">{copy.version}: {result.history.version} · {copy.recordedAt}: {result.history.recordedAt}</p>
            <p>{result.history.changed ? copy.changed : copy.unchanged}</p>
            {result.history.settings && <InputSettings settings={result.history.settings} copy={copy}/>}
          </>}
          <p className="text-xs text-muted-foreground">{copy.permissionUnknown}</p>
          <p className="text-xs text-muted-foreground">{copy.filtersHint}</p>
        </section>
      </div>}
      {result && effectiveId && validSourceId && <AutomationAnalysisRetry
        key={diagnosticKey} diagnosticKey={diagnosticKey} ruleId={effectiveId}
        sourceId={validSourceId} sourceEvent={sourceEvent}/>}
    </form>
  </details>;
}
