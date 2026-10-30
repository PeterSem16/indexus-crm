import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useI18n } from "@/i18n";
import { ReportingPeriodProvider, ReportingPeriodControls, useOptionalReportingPeriod } from "./reporting-period";
import "./mission-funnel-report.css";
import MissionFunnelChart from "./MissionFunnelChart";
import { buildFunnelExport, funnelExportCsv, funnelExportXlsx, funnelExportFilename } from "./mission-funnel-export";
import { funnelExportTranslations, funnelDownloadLabels } from "@/i18n/mission-funnel-export-translations";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  funnelExceptions, funnelSources, funnelSteps,
  type FunnelConfig, type FunnelMember, type FunnelSource, type FunnelStep, type MissionFunnelReport,
} from "../../../../shared/mission-funnel";
import type { MissionFunnelCopy } from "@/i18n/mission-funnel-translations";
import { AlertCircle, Check, ChevronDown, ChevronUp, CircleHelp, Download, FileSpreadsheet, FileText, Filter, RefreshCw, Search, Settings2 } from "lucide-react";

interface Props { campaignId: string }
const PAGE_SIZE = 10;

function displayDate(value: string | null | undefined, locale: string, missing: string) {
  if (!value) return missing;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" }).format(parsed);
}

function percent(value: number | null) {
  return value == null || !Number.isFinite(value) ? "—" : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)}%`;
}

function cloneConfig(config: FunnelConfig): FunnelConfig {
  return {
    ...config,
    version: 1,
    sources: Object.fromEntries(funnelSources.map(source => [source, [...config.sources[source]]])) as FunnelConfig["sources"],
  };
}

function ClinicDetails({ members, copy, locale, emptyLabel }: {
  members: FunnelMember[]; copy: MissionFunnelCopy; locale: string; emptyLabel: string;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return needle ? members.filter(member => member.name.toLocaleLowerCase().includes(needle)) : members;
  }, [members, search]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="border-t border-border/70 bg-muted/20 px-3 py-4 sm:px-5">
      <label className="mb-3 flex max-w-md items-center gap-2 rounded-md border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
        <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input value={search} onChange={event => { setSearch(event.target.value); setPage(0); }}
          placeholder={copy.searchClinics} className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          aria-label={copy.searchClinics} />
      </label>
      {visible.length ? (
        <>
          <div className="overflow-x-auto rounded-lg border border-border/70">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-muted/70 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-semibold">{copy.clinic}</th>
                  <th className="px-3 py-2 font-semibold">{copy.firstDate}</th>
                  <th className="px-3 py-2 font-semibold">{copy.evidenceDate}</th>
                  <th className="px-3 py-2 font-semibold">{copy.basis}</th>
                  <th className="px-3 py-2 font-semibold">{copy.inferredLabel}</th>
                  <th className="px-3 py-2 font-semibold">{copy.returnDate}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {visible.map((member, index) => (
                  <tr key={`${member.id}-${index}`} className="bg-card/70">
                    <td className="px-3 py-2.5 font-medium text-foreground">{member.name || member.id}</td>
                    <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{displayDate(member.firstDate, locale, copy.noDate)}</td>
                    <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{displayDate(member.evidenceDate, locale, copy.noDate)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{copy.basisLabels[member.basis] ?? member.basis}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${member.inferred
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                        : "border-teal-600/25 bg-teal-600/10 text-teal-800 dark:text-teal-300"}`}>
                        {member.inferred ? copy.inferredLabel : copy.directLabel}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{displayDate(member.returnDate, locale, copy.noDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{copy.showing} {filtered.length ? page * PAGE_SIZE + 1 : 0}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} {copy.of} {filtered.length}</span>
            <div className="flex items-center gap-2">
              <span>{copy.page} {page + 1} / {pages}</span>
              <button type="button" className="rounded border border-border px-2.5 py-1.5 disabled:opacity-40" onClick={() => setPage(current => Math.max(0, current - 1))} disabled={page === 0}>{copy.previousPage}</button>
              <button type="button" className="rounded border border-border px-2.5 py-1.5 disabled:opacity-40" onClick={() => setPage(current => Math.min(pages - 1, current + 1))} disabled={page >= pages - 1}>{copy.nextPage}</button>
            </div>
          </div>
        </>
      ) : <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{filtered.length ? emptyLabel : copy.noClinics}</p>}
    </div>
  );
}

function DetailsToggle({ open, onClick, copy, count, testId }: {
  open: boolean; onClick: () => void; copy: MissionFunnelCopy; count: number; testId: string;
}) {
  return (
    <button type="button" onClick={onClick} aria-expanded={open}
      data-testid={testId}
      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {open ? copy.hideDetails : copy.details} <span className="tabular-nums text-muted-foreground">({count})</span>
      {open ? <ChevronUp aria-hidden="true" className="h-3.5 w-3.5" /> : <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />}
    </button>
  );
}

export default function MissionFunnelReport(props: Props) {
  const sharedPeriod = useOptionalReportingPeriod();
  return sharedPeriod ? <MissionFunnelContent {...props} /> : (
    <ReportingPeriodProvider campaignId={props.campaignId}>
      <MissionFunnelContent {...props} showPeriodControls />
    </ReportingPeriodProvider>
  );
}

function MissionFunnelContent({ campaignId, showPeriodControls = false }: Props & { showPeriodControls?: boolean }) {
  const { locale, t } = useI18n();
  const copy = t.missionFunnel;
  const queryClient = useQueryClient();
  const { from, to, valid } = useOptionalReportingPeriod()!;
  const [referral, setReferral] = useState<"all" | "yes" | "no">("all");
  const [openDetail, setOpenDetail] = useState("");
  const [config, setConfig] = useState<FunnelConfig | null>(null);
  const [itemSearch, setItemSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const exportCopy = funnelExportTranslations[locale];
  const [saveMessage, setSaveMessage] = useState<"saved" | "error" | "">("");
  const activeCampaign = useRef(campaignId);

  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  params.set("referral", referral);
  const queryString = params.toString();

  const reportQuery = useQuery<MissionFunnelReport>({
    queryKey: ["/api/campaigns", campaignId, "mission-funnel", from, to, referral],
    enabled: Boolean(campaignId) && valid,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/mission-funnel?${queryString}`, { credentials: "include" });
      if (!response.ok) throw new Error(`Mission funnel request failed (${response.status})`);
      return response.json() as Promise<MissionFunnelReport>;
    },
  });
  const report = reportQuery.data;
  const exportReport = async (format: "csv" | "xlsx") => {
    if (!report || !valid || reportQuery.isFetching || reportQuery.isError || exporting) return;
    setExporting(true);
    setExportError(false);
    try {
      const tables = buildFunnelExport(report, copy, exportCopy, { from, to, referral });
      const blob = format === "csv"
        ? new Blob([funnelExportCsv(tables)], { type: "text/csv;charset=utf-8" })
        : new Blob([await funnelExportXlsx(tables)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${funnelExportFilename(campaignId, { from, to, referral })}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setExportError(true);
    } finally {
      setExporting(false);
    }
  };
  const configSignature = report ? JSON.stringify(report.config) : "";
  const initialConfig = useMemo(() => configSignature ? JSON.parse(configSignature) as FunnelConfig : null, [configSignature]);
  const initializedCampaign = useRef("");

  useEffect(() => {
    activeCampaign.current = campaignId;
    setOpenDetail("");
    setConfig(null);
    setSaving(false);
    setSaveMessage("");
    setItemSearch("");
  }, [campaignId]);

  useEffect(() => {
    if (initialConfig && initializedCampaign.current !== campaignId) {
      setConfig(cloneConfig(initialConfig));
      initializedCampaign.current = campaignId;
    }
  }, [campaignId, initialConfig]);

  const saveConfig = async () => {
    if (!config || !report?.canConfigure || saving) return;
    const campaignAtStart = campaignId;
    setSaving(true);
    setSaveMessage("");
    try {
      const response = await apiRequest("PUT", `/api/campaigns/${encodeURIComponent(campaignAtStart)}/mission-funnel/config`, config);
      if (!response.ok) throw new Error("Configuration save failed");
      if (activeCampaign.current === campaignAtStart) setSaveMessage("saved");
      await queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignAtStart, "mission-funnel"] });
    } catch {
      if (activeCampaign.current === campaignAtStart) setSaveMessage("error");
    } finally {
      if (activeCampaign.current === campaignAtStart) setSaving(false);
    }
  };

  const updateSource = (source: FunnelSource, itemId: string, checked: boolean) => {
    setConfig(current => {
      if (!current) return current;
      const selected = current.sources[source];
      return {
        ...current,
        sources: { ...current.sources, [source]: checked ? [...new Set([...selected, itemId])] : selected.filter(id => id !== itemId) },
      };
    });
    setSaveMessage("");
  };

  const openStepDetails = (step: FunnelStep) => {
    setOpenDetail(`step:${step}`);
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        document.querySelector(`[data-testid="mission-funnel-step-${step}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  };

  const hasMissingMapping = Boolean(report && funnelSources.some(source => report.config.sources[source].length === 0));
  const displayedRows = useMemo(() => funnelSteps.map(step => report?.rows.find(row => row.key === step) ?? {
    key: step, total: null, direct: null, inferred: null, previousPercent: null, qualifiedPercent: null, members: [],
  }), [report?.rows]);
  const quality = report?.quality;
  const qualityRows = quality ? [
    [copy.clinics, quality.clinics], [copy.cohort, quality.cohort], [copy.withoutAttempt, quality.withoutAttempt], [copy.provisional, quality.provisional],
    [copy.orphanCalls, quality.orphanCalls], [copy.duplicateEnrollments, quality.duplicateEnrollments],
    [copy.stateOnly, quality.stateOnly], [copy.unknownProposal, quality.unknownProposal],
  ] as const : [];
  const filteredItems = useMemo(() => {
    const term = itemSearch.trim().toLocaleLowerCase();
    if (!term) return report?.items ?? [];
    return (report?.items ?? []).filter(item => `${item.label} ${item.stepId}`.toLocaleLowerCase().includes(term));
  }, [report?.items, itemSearch]);

  return (
    <main data-testid="mission-funnel-report" className="mission-funnel-report space-y-5 text-foreground">
      <header className="relative overflow-hidden rounded-xl border border-border bg-card px-5 py-5 shadow-sm sm:px-7 sm:py-6">
        <div className="absolute inset-y-0 left-0 w-1 bg-teal-700 dark:bg-teal-400" />
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="max-w-3xl">
            <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-teal-800 dark:text-teal-300">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-700 dark:bg-teal-400" /> INDEXUS · REPORTING / V04
            </p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{copy.title}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{copy.subtitle}{report?.missionName ? ` · ${report.missionName}` : ""}</p>
          </div>
          {report && <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span>{copy.generated}: {displayDate(report.generatedAt, locale, copy.noDate)}</span>
            <span>{copy.timezone}: {report.timezone}</span>
          </div>}
        </div>
      </header>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" data-testid="mission-funnel-export"
              disabled={!report || !valid || reportQuery.isFetching || reportQuery.isError || exporting}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-teal-700/25 bg-teal-700/10 px-3 text-sm font-semibold text-teal-900 transition-colors hover:bg-teal-700/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 dark:border-teal-300/25 dark:bg-teal-300/10 dark:text-teal-200 dark:hover:bg-teal-300/15">
              <Download aria-hidden="true" className="h-4 w-4" />
              {exporting ? exportCopy.exporting : funnelDownloadLabels[locale]}
              <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 opacity-70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={6} className="w-48 rounded-xl p-1.5">
            <DropdownMenuItem data-testid="mission-funnel-export-xlsx" className="min-h-10 cursor-pointer rounded-lg px-3"
              onSelect={() => void exportReport("xlsx")}>
              <FileSpreadsheet aria-hidden="true" className="text-teal-700 dark:text-teal-300" />{exportCopy.excel}
            </DropdownMenuItem>
            <DropdownMenuItem data-testid="mission-funnel-export-csv" className="min-h-10 cursor-pointer rounded-lg px-3"
              onSelect={() => void exportReport("csv")}>
              <FileText aria-hidden="true" className="text-muted-foreground" />{exportCopy.csv}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {exportError && <p role="alert" className="w-full text-right text-sm text-destructive">{exportCopy.error}</p>}
      </div>

      {showPeriodControls && <ReportingPeriodControls />}
      <section aria-label={copy.referral} className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Filter aria-hidden="true" className="h-4 w-4 text-teal-700 dark:text-teal-300" /> {copy.referral}
        </div>
        <div className="max-w-md">
          <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
            {copy.referral}
            <select data-testid="mission-funnel-referral" value={referral} onChange={event => setReferral(event.target.value as "all" | "yes" | "no")}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="all">{copy.referralAll}</option><option value="yes">{copy.referralYes}</option><option value="no">{copy.referralNo}</option>
            </select>
          </label>
        </div>
      </section>

      {reportQuery.isPending ? (
        <div className="space-y-4" aria-label={copy.loading} aria-live="polite">
          <div className="h-16 animate-pulse rounded-lg bg-muted/70" />
          <div className="h-80 animate-pulse rounded-xl bg-muted/70" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><div className="h-24 animate-pulse rounded-lg bg-muted/70" /><div className="h-24 animate-pulse rounded-lg bg-muted/70" /><div className="h-24 animate-pulse rounded-lg bg-muted/70" /><div className="h-24 animate-pulse rounded-lg bg-muted/70" /></div>
        </div>
      ) : reportQuery.isError ? (
        <section role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5 sm:flex-row sm:items-center">
          <AlertCircle aria-hidden="true" className="h-5 w-5 shrink-0 text-destructive" />
          <div className="flex-1"><h2 className="font-semibold">{copy.loadError}</h2><p className="mt-1 text-sm text-muted-foreground">{copy.noPeriodAssigned}</p></div>
          <button type="button" onClick={() => reportQuery.refetch()} className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
            <RefreshCw aria-hidden="true" className="h-4 w-4" /> {copy.retry}
          </button>
        </section>
      ) : report ? (
        <>
          <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex flex-col gap-2 border-b border-border px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
              <div><h2 className="text-base font-semibold tracking-tight">{copy.funnel}</h2><p className="mt-1 text-xs text-muted-foreground">{copy.assignedNote}</p></div>
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground"><CircleHelp aria-hidden="true" className="h-3.5 w-3.5" /> {copy.connectedHelp}</span>
            </div>
            {hasMissingMapping && <div role="status" className="m-4 flex items-start gap-2 rounded-lg border border-amber-600/30 bg-amber-500/10 p-3 text-sm text-amber-950 dark:text-amber-100 sm:m-5">
              <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /><p>{funnelSources.every(source => report.config.sources[source].length === 0) ? copy.mappingMissing : copy.mappingIncomplete}</p>
            </div>}
            <MissionFunnelChart
              rows={displayedRows}
              copy={copy}
              locale={locale}
              selectedStep={openDetail.startsWith("step:") ? openDetail.slice("step:".length) as FunnelStep : null}
              onSelectStep={openStepDetails}
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead className="bg-muted/55 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">{copy.step}</th>
                    <th scope="col" className="px-3 py-3 text-right font-semibold">{copy.total}</th>
                    <th scope="col" className="px-3 py-3 text-right font-semibold">{copy.direct}</th>
                    <th scope="col" className="px-3 py-3 text-right font-semibold">{copy.inferred}</th>
                    <th scope="col" className="px-3 py-3 text-right font-semibold">{copy.previous}</th>
                    <th scope="col" className="px-3 py-3 text-right font-semibold">{copy.qualified}</th>
                    <th scope="col" className="px-3 py-3 text-right font-semibold">{copy.details}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {displayedRows.map((row, index) => {
                    const isOpen = openDetail === `step:${row.key}`;
                    const value = (count: number | null) => count == null ? <span className="text-xs font-medium text-muted-foreground">{copy.unmeasured}</span> : count.toLocaleString(locale);
                    return (
                      <Fragment key={row.key}>
                        <tr data-testid={`mission-funnel-step-${row.key}`} className={index === 0 ? "bg-teal-700/[0.045] dark:bg-teal-300/[0.06]" : "hover:bg-muted/25"}>
                          <th scope="row" className="px-4 py-3 text-sm font-semibold">
                            <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-teal-700/70 align-middle dark:bg-teal-300/70" />{copy.stepLabels[row.key]}
                          </th>
                          <td className="px-3 py-3 text-right font-mono text-sm font-semibold tabular-nums">{value(row.total)}</td>
                          <td className="px-3 py-3 text-right font-mono text-sm tabular-nums">{value(row.direct)}</td>
                          <td className="px-3 py-3 text-right font-mono text-sm tabular-nums">{value(row.inferred)}</td>
                          <td className="px-3 py-3 text-right font-mono text-xs tabular-nums text-muted-foreground">{percent(row.previousPercent)}</td>
                          <td className="px-3 py-3 text-right font-mono text-xs tabular-nums text-muted-foreground">{percent(row.qualifiedPercent)}</td>
                          <td className="px-3 py-2 text-right"><DetailsToggle open={isOpen} count={row.members.length} copy={copy} testId={`mission-funnel-expand-step-${row.key}`} onClick={() => setOpenDetail(isOpen ? "" : `step:${row.key}`)} /></td>
                        </tr>
                        {isOpen && <tr><td colSpan={7} className="p-0"><ClinicDetails members={row.members} copy={copy} locale={locale} emptyLabel={copy.noMembers} /></td></tr>}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="grid gap-3 border-t border-border bg-muted/20 p-4 text-xs leading-relaxed text-muted-foreground sm:grid-cols-2 sm:p-5">
              <p>{copy.firstDialCaveat}</p><p>{copy.firstCallHelp}</p><p>{copy.missingDateHelp}</p><p>{copy.inferenceHelp}</p>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div><h2 className="text-base font-semibold">{copy.quality}</h2><p className="mt-1 text-xs text-muted-foreground">{copy.qualityHelp}</p></div>
              <span className="text-[11px] text-muted-foreground">{copy.noPeriodAssigned}</span>
            </div>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3 lg:grid-cols-4">
              {qualityRows.map(([label, count], index) => (
                <div key={label} className={`bg-card p-3 sm:p-4 ${index === 0 ? "col-span-2 sm:col-span-1" : ""}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                  <p className="mt-1 font-mono text-2xl font-semibold tabular-nums tracking-tight">{count.toLocaleString(locale)}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-4 py-4 sm:px-5"><h2 className="text-base font-semibold">{copy.exceptions}</h2></div>
            <div className="divide-y divide-border">
              {funnelExceptions.map(exception => {
                const block = report.exceptions.find(entry => entry.key === exception);
                const members = block?.members ?? [];
                const isOpen = openDetail === `exception:${exception}`;
                return (
                  <div key={exception} data-testid={`mission-funnel-exception-${exception}`}>
                    <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
                      <div className="flex flex-1 items-center gap-3">
                        <span className="min-w-0 font-medium">{copy.exceptionLabels[exception]}</span>
                        <span className={`rounded-full px-2 py-0.5 font-mono text-xs tabular-nums ${block?.measurable
                          ? "bg-muted text-foreground" : "bg-amber-500/10 text-amber-800 dark:text-amber-300"}`}>
                          {block?.measurable ? members.length.toLocaleString(locale) : copy.unmeasured}
                        </span>
                      </div>
                      <DetailsToggle open={isOpen} count={members.length} copy={copy} testId={`mission-funnel-expand-exception-${exception}`} onClick={() => setOpenDetail(isOpen ? "" : `exception:${exception}`)} />
                    </div>
                    {exception === "refused" && <p className="px-4 pb-3 text-xs text-muted-foreground sm:px-5">{copy.refusedWindow}</p>}
                    {exception === "unreachable" && <p className="px-4 pb-3 text-xs text-muted-foreground sm:px-5">{copy.unreachableRule}</p>}
                    {isOpen && <ClinicDetails members={members} copy={copy} locale={locale} emptyLabel={copy.noMembers} />}
                  </div>
                );
              })}
            </div>
          </section>

          {report.canConfigure && config && (
            <section className="rounded-xl border border-border bg-card shadow-sm">
              <details>
                <summary data-testid="mission-funnel-config-expand" className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 marker:hidden sm:px-5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-700/10 text-teal-800 dark:bg-teal-300/10 dark:text-teal-300"><Settings2 aria-hidden="true" className="h-4 w-4" /></span>
                  <span className="flex-1"><span className="block font-semibold">{copy.configuration}</span><span className="mt-0.5 block text-xs text-muted-foreground">{copy.configurationSavedNote}</span></span>
                  <ChevronDown aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                </summary>
                <div className="border-t border-border px-4 py-4 sm:px-5">
                  <p className="mb-4 max-w-4xl text-sm leading-relaxed text-muted-foreground">{copy.configurationHelp}</p>
                  <label className="mb-4 flex max-w-lg items-center gap-2 rounded-md border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
                    <Search aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                    <input value={itemSearch} onChange={event => setItemSearch(event.target.value)} placeholder={copy.searchItems}
                      aria-label={copy.searchItems} className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
                  </label>
                  <div className="mb-5 max-w-2xl space-y-2">
                    <label htmlFor="mission-funnel-absence-return-question" className="block text-sm font-semibold">{copy.absenceReturnQuestion}</label>
                    <select
                      id="mission-funnel-absence-return-question"
                      value={config.absenceReturnQuestionId ?? ""}
                      onChange={event => {
                        const selectedQuestionId = event.target.value || null;
                        setConfig(current => current ? { ...current, absenceReturnQuestionId: selectedQuestionId } : current);
                        setSaveMessage("");
                      }}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">{copy.noDate}</option>
                      {config.absenceReturnQuestionId && !(report.dateQuestions ?? []).some(question => question.id === config.absenceReturnQuestionId) && (
                        <option value={config.absenceReturnQuestionId}>{config.absenceReturnQuestionId}</option>
                      )}
                      {(report.dateQuestions ?? []).map(question => <option key={question.id} value={question.id}>{question.label}</option>)}
                    </select>
                    <p className="text-xs leading-relaxed text-muted-foreground">{copy.absenceReturnQuestionHelp}</p>
                  </div>
                  {filteredItems.length === 0 && <p className="mb-4 text-sm text-muted-foreground">{copy.noMatchingItems}</p>}
                  <div className="space-y-3">
                    {funnelSources.map(source => {
                      const visibleItems = filteredItems;
                      const selectedCount = config.sources[source].length;
                      return (
                        <fieldset key={source} className="rounded-lg border border-border/80 p-3 sm:p-4">
                          <legend className="px-1 text-sm font-semibold">{copy.sourceLabels[source]}</legend>
                          <div className="mb-2 text-[11px] text-muted-foreground">{selectedCount} {copy.selected}</div>
                          <div className="grid max-h-44 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                            {visibleItems.map(item => {
                              const checked = config.sources[source].includes(item.id);
                              return (
                                <label key={item.id} className="flex min-w-0 cursor-pointer items-start gap-2 rounded px-2 py-2 hover:bg-muted/60">
                                  <input type="checkbox" checked={checked} onChange={event => updateSource(source, item.id, event.target.checked)}
                                    className="mt-0.5 h-4 w-4 shrink-0 accent-teal-700" />
                                  <span className="min-w-0 text-xs leading-snug"><span className="block truncate font-medium text-foreground">{item.label}</span><span className="font-mono text-[10px] text-muted-foreground">{item.stepId}</span></span>
                                </label>
                              );
                            })}
                          </div>
                        </fieldset>
                      );
                    })}
                  </div>
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <button type="button" data-testid="mission-funnel-config-save" disabled={saving} onClick={saveConfig}
                      className="inline-flex h-10 items-center gap-2 rounded-md bg-teal-800 px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-300 dark:text-teal-950 dark:hover:bg-teal-200">
                      {saveMessage === "saved" ? <Check aria-hidden="true" className="h-4 w-4" /> : null}
                      {saving ? copy.saving : copy.saveConfiguration}
                    </button>
                    {saveMessage && <p role={saveMessage === "error" ? "alert" : "status"} className={`text-sm ${saveMessage === "error" ? "text-destructive" : "text-teal-800 dark:text-teal-300"}`}>{saveMessage === "saved" ? copy.saved : copy.saveError}</p>}
                  </div>
                </div>
              </details>
            </section>
          )}
        </>
      ) : <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{copy.noData}</p>}
    </main>
  );
}
