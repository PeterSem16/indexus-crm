import { useMemo, useState } from "react";
import { Download, Search, ArrowDownWideNarrow, ArrowUpWideNarrow, ChevronDown, FileSpreadsheet, FileText } from "lucide-react";
import type { AgentFunnelMetric, AgentFunnelResult, FunnelMember, FunnelStep, MissionFunnelReport } from "../../../../shared/mission-funnel";
import type { MissionFunnelCopy } from "@/i18n/mission-funnel-translations";
import type { Locale } from "@/i18n/translations";
import { funnelDownloadLabels } from "@/i18n/mission-funnel-export-translations";
import { funnelExportCsv, funnelExportXlsx } from "./mission-funnel-export";
import { makeAgentFunnelExport } from "./mission-agent-funnel-export";
import { agentFunnelTranslations } from "./mission-agent-funnel-translations";
import MissionFunnelChart from "./MissionFunnelChart";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type Mode = "cohort" | "contribution";
type Filters = { from: string; to: string; referral: "all" | "yes" | "no" };
interface Props {
  report: MissionFunnelReport;
  copy: MissionFunnelCopy;
  locale: string;
  campaignId: string;
  filters: Filters;
}

const PAGE_SIZE = 10;
const STEPS: FunnelStep[] = [
  "dialed", "connected", "qualified", "agreed", "wantsContract", "email", "wantsToSign", "sent",
  "received", "returned", "validated", "withoutContract", "cooperating", "materials",
];
const PRIMARY: FunnelStep[] = ["dialed", "connected", "qualified", "agreed", "wantsContract", "email", "wantsToSign", "sent", "received", "returned", "validated"];
const countText = (value: number | null, locale: string, missing: string) =>
  value == null || !Number.isFinite(value) ? missing : value.toLocaleString(locale);
const percentText = (value: number | null, locale: string) =>
  value == null || !Number.isFinite(value) ? "—" : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)}%`;
const agentKey = (item: AgentFunnelResult) => item.agentId == null ? "__unknown__" : item.agentId;
const agentLabel = (item: AgentFunnelResult, unknown: string) => item.agentId == null ? unknown : item.agentName || item.agentId;

function displayDate(value: string | null | undefined, locale: string, missing: string) {
  if (!value) return missing;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" }).format(date);
}

function safeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "mission";
}

export default function MissionAgentFunnel({ report, copy, locale, campaignId, filters }: Props) {
  const labels = agentFunnelTranslations[(locale in agentFunnelTranslations ? locale : "en") as keyof typeof agentFunnelTranslations];
  const [mode, setMode] = useState<Mode>("cohort");
  const [selectedAgent, setSelectedAgent] = useState("");
  const [selectedStep, setSelectedStep] = useState<FunnelStep | "">("");
  const [agentSearch, setAgentSearch] = useState("");
  const [clinicSearch, setClinicSearch] = useState("");
  const [page, setPage] = useState(0);
  const [sortStep, setSortStep] = useState<FunnelStep>("qualified");
  const [sortDescending, setSortDescending] = useState(true);
  const [exporting, setExporting] = useState<"" | "csv" | "xlsx">("");
  const [exportError, setExportError] = useState(false);
  const comparison = report.agentComparison;
  const data = comparison?.[mode] ?? [];
  const available = data.length > 0;
  const currentAgent = data.find(agent => agentKey(agent) === selectedAgent) ?? data[0];
  const selectedAgentKey = currentAgent ? agentKey(currentAgent) : "";
  const selectedMetric: AgentFunnelMetric | undefined = currentAgent?.rows.find(row => row.key === selectedStep);
  const members = selectedMetric?.total == null ? [] : selectedMetric.members;
  const proofAuthorNames = new Map<string, string>();
  for (const view of [comparison?.cohort ?? [], comparison?.contribution ?? []]) {
    for (const agent of view) if (agent.agentId) proofAuthorNames.set(agent.agentId, agent.agentName || agent.agentId);
  }
  const filteredMembers = useMemo(() => {
    const needle = clinicSearch.trim().toLocaleLowerCase();
    return needle ? members.filter(member => `${member.name} ${member.id}`.toLocaleLowerCase().includes(needle)) : members;
  }, [clinicSearch, members]);
  const pages = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE));
  const visibleMembers = filteredMembers.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const filteredAgents = useMemo(() => {
    const needle = agentSearch.trim().toLocaleLowerCase();
    const matching = needle ? data.filter(agent => `${agentLabel(agent, labels.unknownAgent)} ${agent.agentId ?? ""}`.toLocaleLowerCase().includes(needle)) : data;
    return [...matching].sort((a, b) => {
      const av = a.rows.find(row => row.key === sortStep)?.total;
      const bv = b.rows.find(row => row.key === sortStep)?.total;
      if (av == null && bv == null) return (a.agentName ?? "").localeCompare(b.agentName ?? "", locale);
      if (av == null) return 1;
      if (bv == null) return -1;
      const compared = av - bv;
      return (sortDescending ? -compared : compared) || (a.agentName ?? "").localeCompare(b.agentName ?? "", locale);
    });
  }, [agentSearch, data, locale, sortDescending, sortStep]);
  const calledCohort = currentAgent?.rows.find(row => row.key === "dialed")?.total ?? null;
  const hasExportRows = available && data.some(agent => agent.rows.some(row => row.total != null));
  const download = async (format: "csv" | "xlsx") => {
    if (!hasExportRows || exporting) return;
    setExporting(format);
    setExportError(false);
    try {
      const tables = makeAgentFunnelExport(report, mode, filters, copy, labels);
      const blob = format === "csv"
        ? new Blob([funnelExportCsv(tables)], { type: "text/csv;charset=utf-8" })
        : new Blob([await funnelExportXlsx(tables)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `mission-agent-funnel_${safeFilename(campaignId)}_${filters.from || "all"}_${filters.to || "all"}_${filters.referral}_${mode}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setExportError(true);
    } finally {
      setExporting("");
    }
  };
  const selectMode = (next: Mode) => {
    setMode(next);
    setSelectedAgent("");
    setSelectedStep("");
    setClinicSearch("");
    setPage(0);
  };
  const selectStep = (step: FunnelStep) => {
    setSelectedStep(step);
    setClinicSearch("");
    setPage(0);
  };
  const basisLabel = (member: FunnelMember) => copy.basisLabels[member.basis] ?? member.basis;
  const memberAuthor = (member: FunnelMember) => {
    if (member.inferred || (member.basis !== "call" && member.basis !== "history") || !member.actorId) return labels.unknownProofAuthor;
    return proofAuthorNames.get(member.actorId) ?? labels.unknownProofAuthor;
  };

  return (
    <section data-testid="mission-agent-funnel" className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border bg-teal-700/[0.035] px-4 py-4 dark:bg-teal-300/[0.035] sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-teal-800 dark:text-teal-300">INDEXUS</p>
            <h2 className="mt-1 text-base font-semibold tracking-tight">{labels.title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{labels.assignedExcluded}</p>
            <p className="mt-1.5 max-w-4xl text-xs font-medium leading-relaxed text-teal-900 dark:text-teal-200">{labels.periodNote}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" data-testid="mission-agent-funnel-download" disabled={!hasExportRows || Boolean(exporting)}
                className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-teal-700/25 bg-teal-700/10 px-3 text-xs font-semibold text-teal-900 hover:bg-teal-700/15 disabled:cursor-not-allowed disabled:opacity-45 dark:text-teal-200">
                <Download aria-hidden="true" className="h-3.5 w-3.5" />{exporting ? "…" : funnelDownloadLabels[locale as Locale] ?? funnelDownloadLabels.en}<ChevronDown aria-hidden="true" className="h-3.5 w-3.5 opacity-70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={6} className="w-48 rounded-xl p-1.5">
              <DropdownMenuItem data-testid="mission-agent-funnel-export-xlsx" className="min-h-10 cursor-pointer rounded-lg px-3" onSelect={() => void download("xlsx")}>
                <FileSpreadsheet aria-hidden="true" className="text-teal-700 dark:text-teal-300" />{labels.exportXlsx}
              </DropdownMenuItem>
              <DropdownMenuItem data-testid="mission-agent-funnel-export-csv" className="min-h-10 cursor-pointer rounded-lg px-3" onSelect={() => void download("csv")}>
                <FileText aria-hidden="true" className="text-muted-foreground" />{labels.exportCsv}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {exportError && <p role="alert" className="mt-2 text-xs font-medium text-destructive">{labels.exportFailed}</p>}
        <details className="mt-3 rounded-lg border border-teal-700/15 bg-background/70 px-3 py-2.5 dark:border-teal-300/15">
          <summary data-testid="mission-agent-funnel-help" className="cursor-pointer text-xs font-semibold text-teal-900 marker:text-teal-700 dark:text-teal-200 dark:marker:text-teal-300">{labels.helpTitle}</summary>
          <div className="mt-2 grid gap-2 text-xs leading-relaxed text-muted-foreground md:grid-cols-2">
            {labels.helpParagraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          </div>
        </details>
      </div>
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div role="tablist" aria-label={labels.mode} className="inline-flex w-fit rounded-lg border border-border bg-muted/40 p-1">
          {(["cohort", "contribution"] as const).map(tab => (
            <button key={tab} type="button" role="tab" aria-selected={mode === tab}
              data-testid={`mission-agent-funnel-tab-${tab}`} onClick={() => selectMode(tab)}
              className={`rounded-md px-3 py-2 text-xs font-semibold transition-colors ${mode === tab ? "bg-card text-teal-900 shadow-sm dark:text-teal-200" : "text-muted-foreground hover:text-foreground"}`}>
              {tab === "cohort" ? labels.cohortLabel : labels.contributionLabel}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span>{labels.clinicCount}: <b className="font-mono tabular-nums text-foreground">{currentAgent ? currentAgent.clinicCount.toLocaleString(locale) : "—"}</b></span>
        </div>
      </div>
      {!comparison ? (
        <p className="p-6 text-center text-sm text-muted-foreground">{labels.noComparison}</p>
      ) : !available ? (
        <p className="p-6 text-center text-sm text-muted-foreground">{labels.noEvidence}</p>
      ) : (
        <>
          {mode === "cohort" && currentAgent && (
            <details data-testid="mission-agent-funnel-selected-chart" className="border-b border-border">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-teal-900 hover:bg-muted/20 dark:text-teal-200 sm:px-5">
                {labels.selectedChart}: {agentLabel(currentAgent, labels.unknownAgent)}
              </summary>
              <MissionFunnelChart
                rows={currentAgent.rows.filter(row => row.key !== "assigned")}
                copy={copy}
                locale={locale}
                selectedStep={selectedStep || null}
                onSelectStep={selectStep}
              />
            </details>
          )}
          <div className="grid gap-3 border-b border-border bg-muted/15 p-3 sm:grid-cols-[minmax(220px,.65fr)_minmax(0,1.35fr)] sm:p-4">
            <label className="relative block">
              <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input data-testid="mission-agent-funnel-agent-search" value={agentSearch} onChange={event => setAgentSearch(event.target.value)}
                placeholder={`${labels.search} · ${labels.agent.toLocaleLowerCase()}`} aria-label={`${labels.search} · ${labels.agent}`}
                className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </label>
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span>{labels.primaryPath}</span><i aria-hidden="true" className="h-px w-5 bg-teal-700/40 dark:bg-teal-300/40" />
              <span>{labels.noContract}</span><i aria-hidden="true" className="h-px w-5 bg-border" /><span>{labels.outcomes}</span>
              <span className="ml-auto text-right">{mode === "cohort" ? labels.cohortRateBasis : labels.contributionRateBasis}</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1260px] border-separate border-spacing-0 text-left" data-testid="mission-agent-funnel-matrix">
              <thead>
                <tr className="bg-muted/65 text-[10px] uppercase tracking-[.1em] text-muted-foreground">
                  <th scope="col" rowSpan={2} className="sticky left-0 z-20 min-w-[220px] border-b border-r border-border bg-muted/95 px-3 py-2.5">{labels.agent}</th>
                  <th scope="col" rowSpan={2} className="min-w-[90px] border-b border-r border-border px-3 py-2.5 text-right">{labels.clinicCount}</th>
                  <th scope="colgroup" colSpan={PRIMARY.length} className="border-b border-r border-border px-2 py-2 text-center">{labels.primaryPath}</th>
                  <th scope="colgroup" colSpan={1} className="border-b border-r border-border px-2 py-2 text-center">{labels.noContract}</th>
                  <th scope="colgroup" colSpan={STEPS.length - PRIMARY.length - 1} className="border-b border-border px-2 py-2 text-center">{labels.outcomes}</th>
                </tr>
                <tr className="bg-muted/35 text-[10px] text-muted-foreground">
                  {STEPS.map(step => (
                    <th key={step} scope="col" className={`min-w-[84px] border-b border-border px-2 py-2 text-center ${step === "withoutContract" ? "border-l border-r" : ""}`}>
                      <button type="button" data-testid={`mission-agent-funnel-column-${step}`} aria-pressed={selectedStep === step} title={copy.stepLabels[step]}
                        onClick={() => selectStep(step)}
                        className={`max-w-[120px] rounded px-1 py-1 leading-tight hover:bg-teal-700/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selectedStep === step ? "bg-teal-700/10 font-bold text-teal-900 dark:text-teal-200" : ""}`}>
                        {copy.stepLabels[step]}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredAgents.map((agent, index) => {
                  const key = agentKey(agent);
                  const selected = selectedAgentKey === key;
                  return (
                    <tr key={key} data-testid={`mission-agent-funnel-agent-${index}`} className={`group ${selected ? "bg-teal-700/[0.07] dark:bg-teal-300/[0.07]" : "hover:bg-muted/20"}`}>
                      <th scope="row" className={`sticky left-0 z-10 border-r border-border px-3 py-2 text-left ${selected ? "bg-teal-50 dark:bg-teal-950/70" : "bg-card group-hover:bg-muted/60"}`}>
                        <button type="button" data-testid={`mission-agent-funnel-select-agent-${index}`} aria-pressed={selected}
                          onClick={() => { setSelectedAgent(key); setSelectedStep(""); setPage(0); setClinicSearch(""); }}
                          className="block max-w-[205px] truncate text-sm font-semibold hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:text-teal-200">
                      {agentLabel(agent, labels.unknownAgent)}
                        </button>
                      </th>
                      <td className="border-r border-border px-3 py-2 text-right font-mono text-xs font-semibold tabular-nums">{agent.clinicCount.toLocaleString(locale)}</td>
                      {STEPS.map(step => {
                        const metric = agent.rows.find(row => row.key === step);
                        const value = metric?.total ?? null;
                        const denominator = agent.rows.find(row => row.key === "dialed")?.total ?? null;
                        const rate = mode === "cohort"
                          ? value == null || denominator == null || denominator === 0 ? null : value / denominator * 100
                          : metric?.missionPercent ?? null;
                        return (
                          <td key={step} className={`px-1 py-1 text-center ${step === "withoutContract" ? "border-x border-border" : ""}`}>
                            <button type="button" data-testid={`mission-agent-funnel-cell-${index}-${step}`} aria-pressed={selected && selectedStep === step}
                              onClick={() => { setSelectedAgent(key); selectStep(step); }}
                              disabled={!metric || value == null}
                              className={`min-w-[60px] rounded px-2 py-1 font-mono text-xs tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:text-muted-foreground/70 ${selected && selectedStep === step ? "bg-teal-700 text-white dark:bg-teal-300 dark:text-teal-950" : "hover:bg-teal-700/10"}`}>
                              <span className="block">{countText(value, locale, "—")}</span>
                              <span className={`mt-0.5 block text-[10px] ${selected && selectedStep === step ? "opacity-80" : "text-muted-foreground"}`}>{percentText(rate, locale)}</span>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {!filteredAgents.length && <tr><td colSpan={STEPS.length + 2} className="px-4 py-8 text-center text-sm text-muted-foreground">{labels.noEvidence}</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-2 border-t border-border bg-muted/15 px-4 py-3 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>{mode === "cohort" ? labels.helpParagraphs[0] : labels.helpParagraphs[1]}</p>
            <div className="flex shrink-0 items-center gap-2">
              <span>{labels.stage}</span>
              <select aria-label={labels.stage} value={sortStep} onChange={event => setSortStep(event.target.value as FunnelStep)}
                className="h-8 max-w-[180px] rounded-md border border-input bg-background px-2 text-xs text-foreground">
                {STEPS.map(step => <option key={step} value={step}>{copy.stepLabels[step]}</option>)}
              </select>
              <button type="button" aria-label={sortDescending ? labels.sortAscending : labels.sortDescending} onClick={() => setSortDescending(value => !value)}
                className="inline-flex h-8 w-8 items-center justify-center rounded border border-border bg-background hover:bg-muted">
                {sortDescending ? <ArrowDownWideNarrow aria-hidden="true" className="h-4 w-4" /> : <ArrowUpWideNarrow aria-hidden="true" className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <section data-testid="mission-agent-funnel-evidence" className="border-t border-border">
            <div className="flex flex-col gap-1 border-b border-border px-4 py-3 sm:flex-row sm:items-end sm:justify-between sm:px-5">
              <div>
                <h3 className="text-sm font-semibold">{labels.evidenceTitle}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {currentAgent ? agentLabel(currentAgent, labels.unknownAgent) : labels.unknownAgent}{selectedStep ? ` · ${copy.stepLabels[selectedStep]}` : ` · ${labels.selectStep}`}
                  {selectedMetric && ` · ${labels.total}: ${countText(selectedMetric.total, locale, labels.unmeasured)} · ${labels.direct}: ${countText(selectedMetric.direct, locale, labels.unmeasured)} · ${labels.inferred}: ${countText(selectedMetric.inferred, locale, labels.unmeasured)}`}
                </p>
              </div>
              {mode === "cohort" && selectedMetric && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  <span>{labels.previous}: <b className="font-mono text-foreground">{percentText(selectedMetric.previousPercent, locale)}</b></span>
                  <span>{labels.qualified}: <b className="font-mono text-foreground">{percentText(selectedMetric.qualifiedPercent, locale)}</b></span>
                </div>
              )}
              {mode === "contribution" && selectedMetric && (
                <span className="text-[11px] text-muted-foreground">{labels.missionShare}: <b className="font-mono text-foreground">{percentText(selectedMetric.missionPercent, locale)}</b></span>
              )}
            </div>
            {selectedStep ? (
              <div className="p-3 sm:p-4">
                <label className="mb-3 flex max-w-md items-center gap-2 rounded-md border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
                  <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input data-testid="mission-agent-funnel-clinic-search" value={clinicSearch} onChange={event => { setClinicSearch(event.target.value); setPage(0); }}
                    placeholder={labels.search} aria-label={labels.search} className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
                </label>
                {visibleMembers.length ? (
                  <>
                    <div className="overflow-x-auto rounded-lg border border-border/70">
                      <table className="w-full min-w-[820px] text-left text-xs">
                        <thead className="bg-muted/60 text-[10px] uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2">{copy.clinic}</th><th className="px-3 py-2">{labels.firstDate}</th>
                            <th className="px-3 py-2">{labels.evidenceDate}</th><th className="px-3 py-2">{labels.basis}</th><th className="px-3 py-2">{labels.proofAuthor}</th><th className="px-3 py-2">{labels.inferredEvidence}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {visibleMembers.map((member, index) => (
                            <tr key={`${member.id}-${index}`} className="hover:bg-muted/20">
                              <td className="px-3 py-2.5 font-medium">{member.name || member.id}</td>
                              <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{displayDate(member.firstDate, locale, labels.noDate)}</td>
                              <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{displayDate(member.evidenceDate, locale, labels.noDate)}</td>
                              <td className="px-3 py-2.5 text-muted-foreground">{basisLabel(member)}</td>
                              <td className="px-3 py-2.5 text-muted-foreground">{memberAuthor(member)}</td>
                              <td className="px-3 py-2.5"><span className={`rounded-full border px-2 py-0.5 text-[10px] ${member.inferred ? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300" : "border-teal-600/25 bg-teal-600/10 text-teal-800 dark:text-teal-300"}`}>{member.inferred ? labels.inferredEvidence : labels.directEvidence}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>{labels.showing} {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredMembers.length)} {labels.of} {filteredMembers.length}</span>
                      <div className="flex items-center gap-2">
                        <span>{labels.page} {page + 1} / {pages}</span>
                        <button type="button" data-testid="mission-agent-funnel-prev-page" onClick={() => setPage(value => Math.max(0, value - 1))} disabled={page === 0} className="rounded border border-border px-2.5 py-1.5 disabled:opacity-40">{labels.previousPage}</button>
                        <button type="button" data-testid="mission-agent-funnel-next-page" onClick={() => setPage(value => Math.min(pages - 1, value + 1))} disabled={page >= pages - 1} className="rounded border border-border px-2.5 py-1.5 disabled:opacity-40">{labels.nextPage}</button>
                      </div>
                    </div>
                  </>
                ) : <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{labels.noEvidence}</p>}
              </div>
            ) : <p className="px-4 py-5 text-sm text-muted-foreground">{labels.selectAgent} · {labels.selectStep}</p>}
          </section>
        </>
      )}
    </section>
  );
}
