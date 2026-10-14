import { useId, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpRight, CalendarDays, ChevronRight, CircleAlert, CircleCheck,
  Clock3, Filter, History, Inbox, Loader2, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { useI18n } from "@/i18n";
import { getQueryFn } from "@/lib/queryClient";
import { getRecordEntryCopy } from "@/i18n/automation-record-entry-copy";
import { getForwardCopy } from "@/i18n/automation-forward-copy";
import { runDayKey, runDurationMs, runStatistics, type OverviewCatalog,
  type OverviewRule, type OverviewRun } from "@/lib/automation-overview-model";
import "./automation-overview.css";

type RunDetail = {
  run: OverviewRun;
  event: null | { module: string; entityType: string; eventType: string; entityId?: string; [key: string]: unknown };
  actions: { id: string; actionIndex: number; actionType: string; status: string; error?: string | null; output?: unknown }[];
};
type Props = {
  rules: OverviewRule[]; catalog?: OverviewCatalog; ruleId?: string; compact?: boolean;
  onBack?: () => void; onOpenRule?: (rule: OverviewRule) => void;
};

export function AutomationRunHistory({ rules, catalog, ruleId, compact, onBack, onOpenRule }: Props) {
  const { t, locale } = useI18n();
  const copy = t.automationOverview;
  const inspectorId = useId();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [module, setModule] = useState("all");
  const [ruleFilter, setRuleFilter] = useState(ruleId || "all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const runsQ = useQuery<OverviewRun[]>({
    queryKey: ["/api/automation/runs", { ruleId: ruleId || (ruleFilter === "all" ? undefined : ruleFilter) }],
    refetchInterval: 5000,
    staleTime: 0,
    queryFn: async context => {
      const data = await getQueryFn<OverviewRun[]>({ on401: "throw" })(context);
      if (!Array.isArray(data)) throw new Error("Invalid runs response");
      return data;
    },
  });
  const runs = runsQ.data || [];
  const ruleById = useMemo(() => new Map(rules.map(rule => [rule.id, rule])), [rules]);
  const name = (id: string) => ruleById.get(id)?.name || `${copy.unknownRule} · ${id.slice(0, 8)}`;
  const statusLabel = (value: string) =>
    (["success", "failed", "skipped", "running", "pending"] as const).includes(value as any)
      ? copy[value as "success" | "failed" | "skipped" | "running" | "pending"]
      : `${copy.unknownStatus} · ${value}`;
  const statusClass = (value: string) => value === "success" ? "completed"
    : ["failed", "skipped", "running", "pending"].includes(value) ? value : "other";
  const reasonLabel = (reason: string | null) => !reason ? "" : ({
    condition_false: copy.conditionFalse, loop_guard: copy.loopGuard,
    analysis_condition_unknown: copy.analysisUnknown, analysis_source_not_eligible: copy.sourceNotEligible,
  } as Record<string, string>)[reason] || reason;
  const moduleLabel = (value: string) => t.automationServices.editorCatalog.moduleLabels[value]
    || catalog?.modules.find(option => option.value === value)?.label || value;
  const eventLabel = (value: string) => t.automationServices.editorCatalog.eventLabels[value]
    || catalog?.eventTypes.find(option => option.value === value)?.label || value;
  const actionLabel = (value: string) => value === "record_analysis" ? getRecordEntryCopy(locale).actionLabel
    : value === "forward_message" ? getForwardCopy(locale).heading
      : (t.automationServices.names as Record<string, string>)[value]
        || catalog?.actionTypes.find(option => option.value === value)?.label || value;
  const date = (value: string, options: Intl.DateTimeFormatOptions) => {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime())
      ? new Intl.DateTimeFormat(locale, { timeZone: "Europe/Bratislava", ...options }).format(parsed) : "—";
  };
  const fullDate = (value: string) => date(value, { dateStyle: "medium", timeStyle: "medium" });
  const duration = (value: number | null) => value === null ? "—" : value < 1000
    ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)} ms`
    : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value / 1000)} s`;
  const resetFilters = () => { setSearch(""); setStatus("all"); setModule("all"); setRuleFilter(ruleId || "all"); };
  const filtered = runs.filter(run =>
    [name(run.ruleId), run.id, run.error, reasonLabel(run.skippedReason), statusLabel(run.status)]
      .join(" ").toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
    && (status === "all" || run.status === status)
    && (module === "all" || ruleById.get(run.ruleId)?.module === module),
  );
  // A filtered-out/deleted selection must never keep another run's inspector visible.
  const selected = filtered.find(run => run.id === selectedId) || filtered[0];
  const detailQ = useQuery<RunDetail>({
    queryKey: ["/api/automation/runs", selected?.id],
    enabled: !!selected,
    staleTime: 0,
    refetchInterval: selected && ["running", "pending"].includes(selected.status) ? 5000 : false,
    queryFn: async context => {
      const data = await getQueryFn<RunDetail>({ on401: "throw" })(context);
      if (!data?.run || data.run.id !== selected?.id || !Array.isArray(data.actions))
        throw new Error("Invalid run detail response");
      return data;
    },
  });
  const detail = !detailQ.isError && detailQ.data?.run.id === selected?.id ? detailQ.data : undefined;
  const currentRun = detail?.run || selected;
  const selectedRule = selected ? ruleById.get(selected.ruleId) : undefined;
  const stats = runStatistics(runs);
  const days = Array.from(new Set(filtered.map(run => runDayKey(run.startedAt))));
  const perRule = Array.from(new Set(runs.map(run => run.ruleId))).map(id => ({
    id, ...runStatistics(runs.filter(run => run.ruleId === id)),
  })).sort((a, b) => b.total - a.total).slice(0, 8);
  const options = Array.from(new Set([...rules.map(rule => rule.id), ...runs.map(run => run.ruleId),
    ...(ruleFilter === "all" ? [] : [ruleFilter])]));
  const pick = (id: string) => {
    setSelectedId(id);
    if (window.matchMedia("(max-width: 600px)").matches) {
      requestAnimationFrame(() => document.getElementById(inspectorId)?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start",
      }));
    }
  };
  const statusIcon = (value: string) => value === "success" ? CircleCheck : value === "failed" ? CircleAlert : Clock3;
  const split = copy.historyTitle.lastIndexOf(" ");
  const count = (value: number) => runsQ.isLoading || runsQ.isError ? "—" : value;
  return <main className={`rules-history automation-production-overview ${compact ? "is-compact" : ""}`}>
    {!compact && <header className="rh-topbar">
      <div className="rh-brand"><span className="rh-mark" aria-hidden="true">i</span><span>INDEXUS <i>/</i> {copy.automationTitle}</span></div>
      <span className="rh-mode"><span className="rh-mode-dot"/>{copy.operational}</span>
    </header>}
    <div className="rh-shell">
      {onBack && <button className="rh-back" onClick={onBack} aria-label={copy.backRules}><ArrowLeft size={15}/>{copy.rules}</button>}
      {!compact && <section className="rh-heading"><div>
        <div className="rh-eyebrow"><History size={14}/>{copy.automationTitle} / {copy.operational}</div>
        <h1>{copy.historyTitle.slice(0, split + 1)}<span>{copy.historyTitle.slice(split + 1)}</span></h1><p>{copy.historySubtitle}</p>
      </div><button className="rh-demo-seal rh-refresh-button" disabled={runsQ.isFetching} onClick={() => { void runsQ.refetch(); if (selected) void detailQ.refetch(); }}><RotateCcw size={15}/>{copy.refresh}</button></section>}
      <section className="rh-summary" aria-label={copy.loadedHistory}>
        <div className="rh-summary-lead"><span className="rh-summary-icon"><CalendarDays size={18}/></span><div><b>{copy.loadedHistory}</b><small>{copy.loadedOnly}</small></div></div>
        <div className="rh-stat" data-testid="stat-total"><strong>{count(stats.total)}</strong><span>{copy.runs}</span></div>
        <div className="rh-stat rh-stat-good" data-testid="stat-success"><strong>{count(stats.counts.success || 0)}</strong><span>{copy.success}</span></div>
        <div className="rh-stat rh-stat-alert" data-testid="stat-failed"><strong>{count(stats.counts.failed || 0)}</strong><span>{copy.failed}</span></div>
      </section>
      <div className="rh-additional-stats"><span data-testid="stat-success-rate">{copy.successRate}: <b>{stats.successRate === null ? "—" : `${stats.successRate}%`}</b></span>
        <span data-testid="stat-avg-duration">{copy.avgDuration}: <b>{duration(stats.avgDuration)}</b></span><span>{copy.autoRefresh}</span></div>
      <section className="rh-workspace">
        <div className="rh-work-heading"><div><h2>{copy.history}</h2><p>{copy.chooseRun}</p></div><span className="rh-count" data-testid="text-runs-count">{runsQ.isFetching ? <Loader2 size={13} className="animate-spin"/> : <History size={13}/>} {filtered.length} / {runs.length}</span></div>
        <div className="rh-filters">
          <label className="rh-search"><Search size={15}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder={copy.searchHistory} aria-label={copy.searchHistory}/></label>
          <label className="rh-select"><Filter size={14}/><select aria-label={copy.module} value={module} onChange={event => setModule(event.target.value)}>
            <option value="all">{copy.allModules}</option>{(catalog?.modules || []).map(option => <option key={option.value} value={option.value}>{moduleLabel(option.value)}</option>)}
          </select></label>
          {!ruleId && <label className="rh-select"><select aria-label={copy.rules} data-testid="select-runs-rule" value={ruleFilter} onChange={event => setRuleFilter(event.target.value)}>
            <option value="all">{copy.allRules}</option>{options.map(id => <option key={id} value={id}>{name(id)}</option>)}
          </select></label>}
        </div>
        <div className="rh-status-filters" aria-label={copy.allResults}>
          {["all", "success", "skipped", "failed", "running", "pending"].map(value => <button key={value} className={status === value ? "is-selected" : ""}
            onClick={() => setStatus(value)} aria-pressed={status === value} data-status-filter={value}>
            {value === "all" ? copy.allResults : statusLabel(value)}{value !== "all" && <span>{stats.counts[value] || 0}</span>}
          </button>)}
        </div>
        <div className="rh-content">
          <div className="rh-timeline">
            {runsQ.isLoading ? <div className="rh-empty" role="status"><Loader2 className="animate-spin"/><p>{copy.loading}</p></div>
              : runsQ.isError ? <div className="rh-empty" role="alert"><CircleAlert/><p>{copy.fetchError}</p><button onClick={() => void runsQ.refetch()}>{copy.retry}</button></div>
                : days.length ? days.map(day => <section className="rh-day" key={day}>
                  <h3><span className="rh-day-dot"/>{date(filtered.find(run => runDayKey(run.startedAt) === day)!.startedAt, { dateStyle: "full" })}</h3>
                  <div className="rh-run-list">{filtered.filter(run => runDayKey(run.startedAt) === day).map(run => {
                    const Icon = statusIcon(run.status);
                    return <button key={run.id} className={`rh-run ${selected?.id === run.id ? "is-active" : ""}`}
                      onClick={() => pick(run.id)} aria-pressed={selected?.id === run.id} aria-controls={inspectorId}
                      data-run-id={run.id} data-testid={`row-globalrun-${run.id}`}>
                      <span className={`rh-run-icon ${statusClass(run.status)}`}><Icon size={15}/></span>
                      <span className="rh-run-copy"><b title={name(run.ruleId)}>{name(run.ruleId)}</b><span title={run.error || reasonLabel(run.skippedReason)}>{run.error || reasonLabel(run.skippedReason) || statusLabel(run.status)}</span>
                        <small>{statusLabel(run.status)} · {copy.duration}: {duration(runDurationMs(run))}</small></span>
                      <span className="rh-run-time">{date(run.startedAt, { timeStyle: "short" })}<ChevronRight size={14}/></span>
                    </button>;
                  })}</div>
                </section>) : <div className="rh-empty"><span><Inbox size={21}/></span><b>{runs.length ? copy.noMatches : copy.noRuns}</b><p>{runs.length ? copy.noMatchesHint : copy.noRunsHint}</p>
                  {(search || status !== "all" || module !== "all" || ruleFilter !== "all" && !ruleId) && <button onClick={resetFilters}>{copy.resetFilters}</button>}
                </div>}
          </div>
          <aside className="rh-inspector" id={inspectorId} aria-label={copy.detail} data-testid="run-inspector">
            {selected && currentRun && !runsQ.isError ? <>
              <div className="rh-inspector-top"><span><SlidersHorizontal size={15}/></span><small>{copy.detail}</small></div>
              <span className={`rh-large-state ${statusClass(currentRun.status)}`} data-testid={`badge-status-${currentRun.id}`}><span/>{statusLabel(currentRun.status)}</span>
              <h3>{name(currentRun.ruleId)}</h3>
              <div className="rh-detail-time"><Clock3 size={14}/>{copy.started}: {fullDate(currentRun.startedAt)}</div>
              <p className="rh-detail-meta">{copy.finished}: {currentRun.finishedAt ? fullDate(currentRun.finishedAt) : "—"}<br/>{copy.duration}: {duration(runDurationMs(currentRun))}</p>
              {currentRun.skippedReason && <div className="rh-recovery"><Clock3 size={15}/><span>{copy.reason}: {reasonLabel(currentRun.skippedReason)}</span></div>}
              {currentRun.error && <div className="rh-recovery rh-error" role="alert"><CircleAlert size={15}/><span>{currentRun.error}</span></div>}
              {detailQ.isLoading ? <div className="rh-detail-loading" role="status"><Loader2 size={16} className="animate-spin"/>{copy.loading}</div>
                : detailQ.isError ? <div className="rh-recovery" role="alert"><span>{copy.fetchError} <button onClick={() => void detailQ.refetch()}>{copy.retry}</button></span></div>
                  : detail && <>
                    {detail.event && <section className="rh-event-details"><h4>{copy.event}</h4><b>{eventLabel(detail.event.eventType)}</b>
                      <p>{moduleLabel(detail.event.module)} · {moduleLabel(detail.event.entityType)}</p>
                      {detail.event.entityId && <code>{detail.event.entityId}</code>}
                    </section>}
                    <section className="rh-action-logs"><h4>{copy.actions}</h4>
                      {detail.actions.length ? detail.actions.map(action => <article key={action.id} className="rh-logged-action">
                        <span className={`rh-large-state ${statusClass(action.status)}`}><span/>{statusLabel(action.status)}</span>
                        <b>{action.actionIndex + 1}. {actionLabel(action.actionType)}</b>
                        {action.error && <p className="rh-action-error">{action.error}</p>}
                        {action.output != null && <details><summary>{copy.output}</summary><pre>{JSON.stringify(action.output, null, 2)}</pre></details>}
                      </article>) : <p>{copy.noActions}</p>}
                    </section>
                    <details className="rh-raw-json"><summary>{copy.rawJson}</summary><pre>{JSON.stringify(detail, null, 2)}</pre></details>
                  </>}
              {selectedRule && onOpenRule && <button className="rh-rule-button" disabled={!catalog} onClick={() => onOpenRule(selectedRule)}>{copy.openRule}<ArrowUpRight size={14}/></button>}
              <div className="rh-disclaimer">{copy.definitionNotice}</div>
            </> : <div className="rh-inspector-empty"><Search size={20}/><b>{copy.chooseRun}</b></div>}
          </aside>
        </div>
        <footer className="rh-footer"><span><span className="rh-footer-dot"/>{copy.autoRefresh}</span>
          <button onClick={() => { void runsQ.refetch(); if (selected) void detailQ.refetch(); }} disabled={runsQ.isFetching}><RotateCcw size={13}/>{copy.refresh}</button>
        </footer>
      </section>
      {!!runs.length && <details className="rh-analytics">
        <summary>{copy.topRules}<ChevronRight size={13}/></summary>
        <div className="rh-recent-runs"><p>{copy.recentRuns}</p><div data-testid="sparkline-runs">{runs.slice(0, 50).reverse().map(run =>
          <button key={run.id} className={`rh-recent-dot ${statusClass(run.status)}`} title={`${name(run.ruleId)} · ${statusLabel(run.status)} · ${fullDate(run.startedAt)}`}
            aria-label={`${name(run.ruleId)} · ${statusLabel(run.status)} · ${fullDate(run.startedAt)}`}
            onClick={() => { setSearch(""); setStatus("all"); setModule("all"); pick(run.id); }} data-testid={`spark-${run.id}`}/>)}</div></div>
        {perRule.map(item => <div className="rh-per-rule" key={item.id} data-testid={`perrule-${item.id}`}>
          <button onClick={() => { if (!ruleId) setRuleFilter(item.id); setSearch(""); setStatus("all"); setModule("all"); }}>{name(item.id)}</button>
          <span>{copy.success}: {item.counts.success || 0} · {copy.failed}: {item.counts.failed || 0} / {item.total}</span><b>{item.successRate === null ? "—" : `${item.successRate}%`}</b>
        </div>)}
      </details>}
    </div>
  </main>;
}
