import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Clock3, Database, RefreshCw, ShieldCheck } from "lucide-react";
import type { Locale } from "@/i18n";
import { Button } from "@/components/ui/button";
import { getStatusListBackgroundDiagnosticsCopy } from "./status-list-background-diagnostics-copy";
import { getStatusListOptionSourceCopy } from "./status-list-option-source-copy";

type DiagnosticsGroup = {
  groupId: string;
  label: string;
  source: string;
  hidden: boolean;
  totalContacts: number;
  evaluatedContacts: number;
  currentRevisionContacts: number;
  lastEvaluatedAt: string | null;
  states: { value: string; count: number }[];
  legacyActions: { itemId: string; label: string; count: number }[];
  rules: { id: string; name: string; enabled: boolean; trigger: string; sourceId: string }[];
  transitions: { id: string; occurredAt: string; baseline: boolean; previousLabel: string; valueLabel: string }[];
};

type DiagnosticsResponse = { groups: DiagnosticsGroup[] };

function formatDate(value: string | null, locale: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }
}

export function StatusListBackgroundDiagnostics({
  campaignId,
  locale,
  groupId,
}: {
  campaignId: string;
  locale: Locale | string;
  groupId?: string;
}) {
  const copy = getStatusListBackgroundDiagnosticsCopy(locale);
  const sourceCopy = getStatusListOptionSourceCopy(locale);
  const endpoint = `/api/campaigns/${campaignId}/status-list-workflows/background-diagnostics`;
  const query = useQuery<DiagnosticsResponse>({
    queryKey: [endpoint],
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const response = await fetch(endpoint, { credentials: "include" });
      if (!response.ok) throw new Error(String(response.status));
      return response.json();
    },
  });
  const groups = useMemo(
    () => (query.data?.groups || []).filter(group => !groupId || group.groupId === groupId),
    [query.data?.groups, groupId],
  );

  return <section className="slbd" data-testid="status-list-background-diagnostics" aria-busy={query.isLoading}>
    <header className="slbd-heading">
      <div>
        <h3><Database size={15} aria-hidden="true"/>{copy.title}</h3>
        <p>{copy.subtitle}</p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching}>
        <RefreshCw className={`mr-1.5 h-3.5 w-3.5${query.isFetching ? " animate-spin" : ""}`}/>{copy.reload}
      </Button>
    </header>
    {query.isLoading && <div className="slbd-skeleton" aria-label={copy.loading}>
      <span/><span/><span/>
    </div>}
    {query.isError && <div className="slbd-state slbd-error" role="alert">
      <span><AlertCircle size={16}/>{copy.loadError}</span>
      <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>{copy.retry}</Button>
    </div>}
    {query.data && groups.length === 0 && <p className="slbd-state">{groupId ? copy.groupEmpty : copy.empty}</p>}
    {groups.map(group => {
      const backgroundRules = group.rules.filter(rule => rule.enabled && rule.trigger === "background_transition");
      const agentRules = group.rules.filter(rule => rule.trigger !== "background_transition");
      const latestTransition = group.transitions.filter(entry => !entry.baseline).reduce<DiagnosticsGroup["transitions"][number] | null>((latest, entry) => {
        if (!latest) return entry;
        return new Date(entry.occurredAt).getTime() > new Date(latest.occurredAt).getTime() ? entry : latest;
      }, null);
      const olderRevisionContacts = Math.max(0, group.evaluatedContacts - group.currentRevisionContacts);

      return <article className="slbd-group" key={group.groupId} data-group-id={group.groupId}>
        <header className="slbd-group-heading">
          <div><h4>{group.label}</h4><p>{copy.source}: {group.source === "reachability" ? sourceCopy.reachability : sourceCopy.coordinator}{group.hidden ? ` · ${copy.hidden}` : ""}</p></div>
          <span className="slbd-group-id">{group.groupId}</span>
        </header>
        <div className="slbd-metrics">
          <div><small>{copy.coverage}</small><strong>{group.evaluatedContacts} / {group.totalContacts}</strong><span>{copy.contacts}</span></div>
          <div><small>{copy.currentRevision}</small><strong>{group.currentRevisionContacts}</strong><span>{copy.oldRevision}: {olderRevisionContacts}</span></div>
          <div><small>{copy.changedAt}</small><strong className="slbd-date">{latestTransition ? formatDate(latestTransition.occurredAt, locale) : copy.noChange}</strong><span>{latestTransition?.baseline ? copy.baselineTitle : "\u00a0"}</span></div>
        </div>
        <div className="slbd-columns">
          <section>
            <h5>{copy.states}</h5>
            {group.states.length ? <ul className="slbd-state-list">{group.states.map((state, index) =>
              <li key={`${state.value}-${index}`}><span>{group.source === "coordinator" ? state.value === "unassigned" ? sourceCopy.unassigned : sourceCopy.assigned : (["not_defined","waiting","unreachable","reachable"] as string[]).includes(state.value) ? sourceCopy[state.value as "not_defined" | "waiting" | "unreachable" | "reachable"] : state.value || "—"}</span><strong>{state.count}</strong></li>
            )}</ul> : <p className="slbd-muted">—</p>}
          </section>
          <section>
            <h5>{copy.backgroundRules} · {backgroundRules.length}</h5>
            {backgroundRules.map(rule => <div className="slbd-rule" key={rule.id}>
              <strong>{rule.name}</strong><span>{copy.backgroundTrigger}</span>
            </div>)}
            <h5 className="slbd-subheading">{copy.agentRules} · {agentRules.length}</h5>
            {agentRules.map(rule => <div className="slbd-rule" key={rule.id}>
              <strong>{rule.name}{!rule.enabled ? ` · ${copy.disabled}` : ""}</strong><span>{copy.agentTrigger}</span>
            </div>)}
            {!group.rules.length && <p className="slbd-muted">{copy.noRules}</p>}
          </section>
        </div>
        <section className="slbd-legacy">
          <h5>{copy.legacy} · {group.legacyActions.reduce((sum, action) => sum + action.count, 0)}</h5>
          {group.legacyActions.length ? <>
            <p className="slbd-warning"><ShieldCheck size={14}/>{copy.legacyWarning}</p>
            <ul>{group.legacyActions.map(action => <li key={action.itemId}><span>{action.label}</span><strong>{action.count}</strong></li>)}</ul>
          </> : <p className="slbd-muted">{copy.noLegacy}</p>}
        </section>
        <section className="slbd-transitions">
          <h5><Clock3 size={14}/>{copy.changedAt}</h5>
          {group.transitions.length ? <ul>{group.transitions.slice().sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()).slice(0, 5).map(transition =>
            <li key={transition.id}>
              <time dateTime={transition.occurredAt}>{formatDate(transition.occurredAt, locale)}</time>
              <span>{transition.baseline ? copy.baselineTitle : `${transition.previousLabel || "—"} → ${transition.valueLabel || "—"}`}</span>
            </li>
          )}</ul> : <p className="slbd-muted">{copy.noChange}</p>}
        </section>
      </article>;
    })}
    <div className="slbd-baseline"><strong>{copy.baselineTitle}</strong><p>{copy.baseline}</p><small>{copy.opening}</small></div>
  </section>;
}

export default StatusListBackgroundDiagnostics;
