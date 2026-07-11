import { Fragment, useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { format, startOfDay, endOfDay, startOfWeek, startOfMonth, parseISO } from "date-fns";
import { useI18n } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from "@/components/ui/table";
import {
  HelpCircle, Users, Phone, Mail, MessageSquare, ClipboardCheck, CalendarClock,
  Clock, TrendingUp, TrendingDown, Minus, Trophy, Medal, Award, Sparkles, LucideIcon,
  Building2, User, Contact, Check, X, ChevronRight, ChevronDown, Download, FileSpreadsheet,
} from "lucide-react";

interface AgentProductivityRow {
  agentId: string;
  agentName: string;
  avatarUrl: string | null;
  newCalls: number;
  repeatCalls: number;
  emails: number;
  sms: number;
  nonstandardTasks: number;
  scheduledPending: number;
  scheduledOverdue: number;
  twSeconds: number;
  talkSeconds: number;
  ringSeconds: number;
  totalSeconds: number;
  prevTotalSeconds: number;
  trendPct: number | null;
}

interface AgentDailyRow {
  agentId: string;
  day: string;
  newCalls: number;
  repeatCalls: number;
  emails: number;
  sms: number;
  nonstandardTasks: number;
  twSeconds: number;
  talkSeconds: number;
  ringSeconds: number;
  totalSeconds: number;
}

interface TopContact {
  name: string;
  entityType: string;
  calls: number;
  emails: number;
  sms: number;
  tasks: number;
  total: number;
  reachable: number;
  unreachable: number;
  attemptsBeforeReach: number;
  reached: boolean;
}

interface TopContactsResponse {
  contacts: TopContact[];
  total: number;
  page: number;
  pageSize: number;
}

function fmtDur(seconds: number): string {
  const s = Math.max(0, Math.round(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function ColHead({ label, help, testId }: { label: string; help: string; testId?: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span>{label}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            tabIndex={-1}
            aria-label={help}
            data-testid={testId}
            className="text-muted-foreground/50 hover:text-foreground transition-colors"
          >
            <HelpCircle className="h-3 w-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[18rem] whitespace-normal text-xs font-normal leading-relaxed">
          {help}
        </TooltipContent>
      </Tooltip>
    </span>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const KPI_TONES: Record<string, { icon: string; value: string }> = {
  blue: { icon: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400", value: "text-blue-700 dark:text-blue-300" },
  violet: { icon: "bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400", value: "text-violet-700 dark:text-violet-300" },
  cyan: { icon: "bg-cyan-100 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400", value: "text-cyan-700 dark:text-cyan-300" },
  amber: { icon: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400", value: "text-amber-700 dark:text-amber-300" },
  rose: { icon: "bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400", value: "text-rose-700 dark:text-rose-300" },
  emerald: { icon: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400", value: "text-emerald-700 dark:text-emerald-300" },
};

function KpiCard({ icon: Icon, label, value, sub, tone, testId }: {
  icon: LucideIcon; label: string; value: string; sub?: string; tone: keyof typeof KPI_TONES | string; testId?: string;
}) {
  const tw = KPI_TONES[tone] || KPI_TONES.blue;
  return (
    <div className="rounded-xl border bg-card p-3" data-testid={testId}>
      <div className="flex items-center gap-2">
        <div className={`h-8 w-8 shrink-0 rounded-lg flex items-center justify-center ${tw.icon}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-xs font-medium text-muted-foreground leading-tight">{label}</span>
      </div>
      <div className={`mt-2 text-2xl font-bold tabular-nums ${tw.value}`}>{value}</div>
      {sub ? <div className="text-xs text-muted-foreground mt-0.5">{sub}</div> : null}
    </div>
  );
}

function StatChip({ icon: Icon, value, label, className }: {
  icon: LucideIcon; value: string | number; label: string; className: string;
}) {
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs ${className}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="tabular-nums font-semibold">{value}</span>
      <span className="opacity-70">{label}</span>
    </div>
  );
}

const RANK_STYLES = [
  { icon: Trophy, cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 ring-1 ring-amber-400/40", bar: "from-amber-400 to-emerald-500" },
  { icon: Medal, cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 ring-1 ring-slate-400/30", bar: "from-slate-400 to-blue-500" },
  { icon: Award, cls: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-400 ring-1 ring-orange-400/30", bar: "from-orange-400 to-amber-500" },
];

const ENTITY_ICON: Record<string, LucideIcon> = {
  clinic: Building2,
  hospital: Building2,
  collaborator: Users,
  customer: User,
};

function TrendBadge({ pct, hasActivity, apNew, apVs }: {
  pct: number | null; hasActivity: boolean; apNew: string; apVs: string;
}) {
  if (pct === null) {
    if (!hasActivity) return null;
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400" title={apVs}>
        <Sparkles className="h-3 w-3" /> {apNew}
      </span>
    );
  }
  if (pct > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" title={apVs} data-testid="badge-trend-up">
        <TrendingUp className="h-3 w-3" /> +{pct}%
      </span>
    );
  }
  if (pct < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400" title={apVs} data-testid="badge-trend-down">
        <TrendingDown className="h-3 w-3" /> {pct}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground" title={apVs}>
      <Minus className="h-3 w-3" /> 0%
    </span>
  );
}

function AgentCard({ r, rank, maxTotal, ap }: {
  r: AgentProductivityRow; rank: number; maxTotal: number; ap: ReturnType<typeof useI18n>["t"]["agentProductivity"];
}) {
  const totalCalls = r.newCalls + r.repeatCalls;
  const pct = maxTotal > 0 ? Math.round((r.totalSeconds / maxTotal) * 100) : 0;
  const rankStyle = RANK_STYLES[rank];
  const hasActivity = r.totalSeconds > 0 || totalCalls > 0 || r.emails > 0 || r.sms > 0 || r.nonstandardTasks > 0;

  return (
    <div
      className="rounded-xl border bg-card p-4 transition-shadow hover:shadow-md"
      data-testid={`card-agent-${r.agentId}`}
    >
      <div className="flex items-center gap-3">
        {rankStyle ? (
          <div className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center ${rankStyle.cls}`}>
            <rankStyle.icon className="h-5 w-5" />
          </div>
        ) : (
          <div className="h-9 w-9 shrink-0 rounded-lg flex items-center justify-center bg-muted text-muted-foreground text-sm font-bold">
            {rank + 1}
          </div>
        )}
        <Avatar className="h-9 w-9 shrink-0">
          {r.avatarUrl ? <AvatarImage src={r.avatarUrl} alt={r.agentName} /> : null}
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
            {initials(r.agentName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold truncate" data-testid={`text-agent-name-${r.agentId}`}>{r.agentName}</span>
            <TrendBadge pct={r.trendPct} hasActivity={hasActivity} apNew={ap.newAgentBadge} apVs={ap.vsPrevPeriod} />
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {ap.workedTimeLabel}: <span className="font-semibold text-foreground tabular-nums" data-testid={`text-total-${r.agentId}`}>{fmtDur(r.totalSeconds)}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${rankStyle ? rankStyle.bar : "from-primary/70 to-primary"}`}
          style={{ width: `${Math.max(pct, r.totalSeconds > 0 ? 4 : 0)}%` }}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <StatChip
          icon={Phone}
          value={totalCalls}
          label={`${ap.callsLabel} · ${r.newCalls} ${ap.newShort} / ${r.repeatCalls} ${ap.repeatShort}`}
          className="bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
        />
        <StatChip icon={Mail} value={r.emails} label={ap.emailsLabel} className="bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300" />
        <StatChip icon={MessageSquare} value={r.sms} label={ap.smsLabel} className="bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300" />
        <StatChip icon={ClipboardCheck} value={r.nonstandardTasks} label={ap.tasksLabel} className="bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" />
        <StatChip
          icon={CalendarClock}
          value={r.scheduledPending}
          label={r.scheduledOverdue > 0 ? `${ap.scheduledLabel} · ${r.scheduledOverdue} ${ap.overdueLabel}` : ap.scheduledLabel}
          className={r.scheduledOverdue > 0
            ? "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
            : "bg-muted text-muted-foreground"}
        />
        <StatChip icon={Clock} value={fmtDur(r.talkSeconds)} label={ap.talkTime} className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" />
      </div>
    </div>
  );
}

function csvEscape(v: string | number): string {
  const s = String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function sanitizeFileName(s: string): string {
  return s
    .replace(/[\\/:*?"<>|#%&{}$!'@+`=,;.\s]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "report";
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function CampaignAgentProductivity({ campaignId, campaignName }: { campaignId: string; campaignName?: string }) {
  const { t } = useI18n();
  const ap = t.agentProductivity;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  const validRange =
    !!from && !!to && !isNaN(parseISO(from).getTime()) && !isNaN(parseISO(to).getTime());
  const fromISO = validRange ? startOfDay(parseISO(from)).toISOString() : "";
  const toISO = validRange ? endOfDay(parseISO(to)).toISOString() : "";

  const { data: rows = [], isLoading } = useQuery<AgentProductivityRow[]>({
    queryKey: ["/api/campaigns", campaignId, "agent-productivity", fromISO, toISO],
    enabled: validRange && !!campaignId,
    queryFn: async () => {
      const res = await fetch(
        `/api/campaigns/${campaignId}/agent-productivity?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to load agent productivity");
      return res.json();
    },
  });

  const dailyQueryKey = ["/api/campaigns", campaignId, "agent-productivity-daily", fromISO, toISO];
  const fetchDailyRows = async (): Promise<AgentDailyRow[]> => {
    const res = await fetch(
      `/api/campaigns/${campaignId}/agent-productivity/daily?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`,
      { credentials: "include" },
    );
    if (!res.ok) throw new Error("Failed to load daily breakdown");
    return res.json();
  };

  const { data: dailyRows = [], isLoading: dailyLoading } = useQuery<AgentDailyRow[]>({
    queryKey: dailyQueryKey,
    enabled: validRange && !!campaignId && expandedAgents.size > 0,
    queryFn: fetchDailyRows,
  });

  const dailyByAgent = useMemo(() => {
    const m = new Map<string, AgentDailyRow[]>();
    for (const d of dailyRows) {
      const list = m.get(d.agentId);
      if (list) list.push(d);
      else m.set(d.agentId, [d]);
    }
    return m;
  }, [dailyRows]);

  useEffect(() => {
    setExpandedAgents(new Set());
  }, [fromISO, toISO, campaignId]);

  const toggleAgent = (agentId: string) => {
    setExpandedAgents((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  };

  const TOP_PAGE_SIZE = 10;
  const [topPage, setTopPage] = useState(1);

  useEffect(() => {
    setTopPage(1);
  }, [fromISO, toISO, campaignId]);

  const { data: topData, isLoading: topLoading } = useQuery<TopContactsResponse>({
    queryKey: ["/api/campaigns", campaignId, "top-contacts", fromISO, toISO, topPage],
    enabled: validRange && !!campaignId,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const res = await fetch(
        `/api/campaigns/${campaignId}/top-contacts?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}&page=${topPage}&pageSize=${TOP_PAGE_SIZE}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to load top contacts");
      return res.json();
    },
  });

  const topContacts = topData?.contacts ?? [];
  const topTotal = topData?.total ?? 0;
  const topTotalPages = Math.max(1, Math.ceil(topTotal / TOP_PAGE_SIZE));

  const summary = useMemo(() => {
    const n = rows.length || 1;
    const totals = rows.reduce(
      (acc, r) => ({
        calls: acc.calls + r.newCalls + r.repeatCalls,
        emails: acc.emails + r.emails,
        sms: acc.sms + r.sms,
        tasks: acc.tasks + r.nonstandardTasks,
        scheduled: acc.scheduled + r.scheduledPending,
        overdue: acc.overdue + r.scheduledOverdue,
        worked: acc.worked + r.totalSeconds,
      }),
      { calls: 0, emails: 0, sms: 0, tasks: 0, scheduled: 0, overdue: 0, worked: 0 },
    );
    const maxTotal = rows.reduce((m, r) => Math.max(m, r.totalSeconds), 0);
    const avg = (v: number) => Math.round(v / n);
    return { totals, maxTotal, avg };
  }, [rows]);

  const detailTotals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        newCalls: acc.newCalls + r.newCalls,
        repeatCalls: acc.repeatCalls + r.repeatCalls,
        nonstandardTasks: acc.nonstandardTasks + r.nonstandardTasks,
        twSeconds: acc.twSeconds + r.twSeconds,
        talkSeconds: acc.talkSeconds + r.talkSeconds,
        ringSeconds: acc.ringSeconds + r.ringSeconds,
        totalSeconds: acc.totalSeconds + r.totalSeconds,
      }),
      { newCalls: 0, repeatCalls: 0, nonstandardTasks: 0, twSeconds: 0, talkSeconds: 0, ringSeconds: 0, totalSeconds: 0 },
    );
  }, [rows]);

  const setRange = (kind: "today" | "week" | "month") => {
    const now = new Date();
    setTo(format(now, "yyyy-MM-dd"));
    if (kind === "today") setFrom(format(now, "yyyy-MM-dd"));
    else if (kind === "week") setFrom(format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"));
    else setFrom(format(startOfMonth(now), "yyyy-MM-dd"));
  };

  // Export: summary table + per-day raster, as CSV (Excel-friendly, BOM + ";")
  // or real XLSX (two sheets). Filename = report + campaign + selected range.
  const handleExport = async (kind: "csv" | "xlsx") => {
    if (!validRange || exporting) return;
    setExporting(true);
    try {
      const daily = await queryClient.fetchQuery({
        queryKey: dailyQueryKey,
        queryFn: fetchDailyRows,
        staleTime: 60_000,
      });
      const nameOf = new Map(rows.map((r) => [r.agentId, r.agentName]));
      const summaryHeader = [
        ap.agent, ap.newCalls, ap.repeatCalls, ap.emailsLabel, ap.smsLabel, ap.nonstandardTasks,
        ap.scheduledLabel, ap.nonCallTime, ap.talkTime, ap.ringTime, ap.totalEstimated,
      ];
      const summaryRows = rows.map((r) => [
        r.agentName, r.newCalls, r.repeatCalls, r.emails, r.sms, r.nonstandardTasks,
        r.scheduledOverdue > 0 ? `${r.scheduledPending} (${r.scheduledOverdue} ${ap.overdueLabel})` : String(r.scheduledPending),
        fmtDur(r.twSeconds), fmtDur(r.talkSeconds), fmtDur(r.ringSeconds), fmtDur(r.totalSeconds),
      ]);
      const totalsRow = [
        ap.totals, detailTotals.newCalls, detailTotals.repeatCalls, summary.totals.emails, summary.totals.sms,
        detailTotals.nonstandardTasks, summary.totals.scheduled,
        fmtDur(detailTotals.twSeconds), fmtDur(detailTotals.talkSeconds), fmtDur(detailTotals.ringSeconds), fmtDur(detailTotals.totalSeconds),
      ];
      const dailyHeader = [
        ap.agent, ap.dayLabel, ap.newCalls, ap.repeatCalls, ap.emailsLabel, ap.smsLabel, ap.nonstandardTasks,
        ap.nonCallTime, ap.talkTime, ap.ringTime, ap.totalEstimated,
      ];
      const sortedDaily = [...daily].sort((a, b) => {
        const an = nameOf.get(a.agentId) || a.agentId;
        const bn = nameOf.get(b.agentId) || b.agentId;
        return an.localeCompare(bn) || a.day.localeCompare(b.day);
      });
      const dailyOut = sortedDaily.map((d) => [
        nameOf.get(d.agentId) || d.agentId, d.day, d.newCalls, d.repeatCalls, d.emails, d.sms, d.nonstandardTasks,
        fmtDur(d.twSeconds), fmtDur(d.talkSeconds), fmtDur(d.ringSeconds), fmtDur(d.totalSeconds),
      ]);
      const base = `${sanitizeFileName(ap.detailedStats)}_${sanitizeFileName(campaignName || campaignId)}_${from}_${to}`;

      if (kind === "csv") {
        const lines: string[] = [];
        lines.push(csvEscape(`${ap.detailedStats} — ${campaignName || campaignId} (${from} – ${to})`));
        lines.push("");
        lines.push(csvEscape(ap.summaryLabel));
        lines.push(summaryHeader.map(csvEscape).join(";"));
        for (const r of summaryRows) lines.push(r.map(csvEscape).join(";"));
        lines.push(totalsRow.map(csvEscape).join(";"));
        lines.push("");
        lines.push(csvEscape(ap.dailyBreakdown));
        lines.push(dailyHeader.map(csvEscape).join(";"));
        for (const r of dailyOut) lines.push(r.map(csvEscape).join(";"));
        const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
        downloadBlob(blob, `${base}.csv`);
      } else {
        const XLSX = await import("xlsx");
        const wb = XLSX.utils.book_new();
        const sheetName = (s: string, fallback: string) =>
          (s.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31)) || fallback;
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([summaryHeader, ...summaryRows, totalsRow]), sheetName(ap.summaryLabel, "Summary"));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([dailyHeader, ...dailyOut]), sheetName(ap.dailyBreakdown, "Daily"));
        const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        downloadBlob(
          new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
          `${base}.xlsx`,
        );
      }
    } catch (e) {
      console.error("Export failed:", e);
      toast({ title: ap.exportFailed, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card data-testid="card-campaign-agent-productivity">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2" data-testid="text-productivity-title">
              <Trophy className="h-4 w-4 text-amber-500" />
              {ap.title}
            </h3>
            <p className="text-sm text-muted-foreground">{ap.subtitle}</p>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-how-calculated">
                <HelpCircle className="h-4 w-4 mr-2" />
                {ap.howCalculated}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-96 text-sm" data-testid="popover-formula">
              <h4 className="font-bold mb-2">{ap.formulaTitle}</h4>
              <p className="text-muted-foreground mb-3">{ap.formulaIntro}</p>
              <ul className="space-y-1.5 mb-3 list-disc pl-4">
                <li>{ap.formulaNewCall}</li>
                <li>{ap.formulaRepeatCall}</li>
                <li>{ap.formulaTask}</li>
              </ul>
              <div className="rounded-md bg-muted p-2 font-mono text-xs space-y-1 mb-3">
                <div>{ap.formulaTw}</div>
                <div>{ap.formulaTotal}</div>
              </div>
              <p className="text-xs text-muted-foreground">{ap.formulaNote}</p>
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex flex-wrap items-end gap-3 pt-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">{ap.from}</label>
            <Input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="w-40"
              data-testid="input-from"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">{ap.to}</label>
            <Input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              className="w-40"
              data-testid="input-to"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setRange("today")} data-testid="button-range-today">{ap.today}</Button>
            <Button variant="outline" size="sm" onClick={() => setRange("week")} data-testid="button-range-week">{ap.thisWeek}</Button>
            <Button variant="outline" size="sm" onClick={() => setRange("month")} data-testid="button-range-month">{ap.thisMonth}</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
            </div>
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground" data-testid="text-no-data">
            <Users className="h-10 w-10 mb-3 opacity-40" />
            <p>{ap.noData}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              <KpiCard icon={Phone} tone="blue" label={ap.callsLabel} value={String(summary.totals.calls)} sub={`⌀ ${summary.avg(summary.totals.calls)} ${ap.avgPerAgent}`} testId="kpi-calls" />
              <KpiCard icon={Mail} tone="violet" label={ap.emailsLabel} value={String(summary.totals.emails)} sub={`⌀ ${summary.avg(summary.totals.emails)} ${ap.avgPerAgent}`} testId="kpi-emails" />
              <KpiCard icon={MessageSquare} tone="cyan" label={ap.smsLabel} value={String(summary.totals.sms)} sub={`⌀ ${summary.avg(summary.totals.sms)} ${ap.avgPerAgent}`} testId="kpi-sms" />
              <KpiCard icon={ClipboardCheck} tone="amber" label={ap.tasksLabel} value={String(summary.totals.tasks)} sub={`⌀ ${summary.avg(summary.totals.tasks)} ${ap.avgPerAgent}`} testId="kpi-tasks" />
              <KpiCard icon={CalendarClock} tone="rose" label={ap.scheduledLabel} value={String(summary.totals.scheduled)} sub={summary.totals.overdue > 0 ? `${summary.totals.overdue} ${ap.overdueLabel}` : undefined} testId="kpi-scheduled" />
              <KpiCard icon={Clock} tone="emerald" label={ap.workedTimeLabel} value={fmtDur(summary.totals.worked)} sub={`⌀ ${fmtDur(summary.avg(summary.totals.worked))}`} testId="kpi-worked" />
            </div>

            <div className="mt-5">
              <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <Trophy className="h-4 w-4 text-amber-500" />
                {ap.leaderboard}
              </h4>
              <div className="space-y-3">
                {rows.map((r, idx) => (
                  <AgentCard key={r.agentId} r={r} rank={idx} maxTotal={summary.maxTotal} ap={ap} />
                ))}
              </div>
            </div>

            <div className="mt-6">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  {ap.detailedStats}
                </h4>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={exporting || !validRange}
                    onClick={() => handleExport("csv")}
                    data-testid="button-export-csv"
                  >
                    <Download className="h-4 w-4 mr-1.5" />
                    {ap.exportCsv}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={exporting || !validRange}
                    onClick={() => handleExport("xlsx")}
                    data-testid="button-export-xlsx"
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-1.5" />
                    {ap.exportXlsx}
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead><ColHead label={ap.agent} help={ap.helpAgent} testId="help-agent" /></TableHead>
                      <TableHead className="text-right"><ColHead label={ap.newCalls} help={ap.helpNewCalls} testId="help-new-calls" /></TableHead>
                      <TableHead className="text-right"><ColHead label={ap.repeatCalls} help={ap.helpRepeatCalls} testId="help-repeat-calls" /></TableHead>
                      <TableHead className="text-right"><ColHead label={ap.emailsLabel} help={ap.helpEmails} testId="help-emails" /></TableHead>
                      <TableHead className="text-right"><ColHead label={ap.smsLabel} help={ap.helpSms} testId="help-sms" /></TableHead>
                      <TableHead className="text-right"><ColHead label={ap.nonstandardTasks} help={ap.helpNonstandardTasks} testId="help-tasks" /></TableHead>
                      <TableHead className="text-right"><ColHead label={ap.scheduledLabel} help={ap.helpScheduled} testId="help-scheduled" /></TableHead>
                      <TableHead className="text-right"><ColHead label={ap.nonCallTime} help={ap.helpNonCallTime} testId="help-non-call-time" /></TableHead>
                      <TableHead className="text-right"><ColHead label={ap.talkTime} help={ap.helpTalkTime} testId="help-talk-time" /></TableHead>
                      <TableHead className="text-right"><ColHead label={ap.ringTime} help={ap.helpRingTime} testId="help-ring-time" /></TableHead>
                      <TableHead className="text-right font-bold"><ColHead label={ap.totalEstimated} help={ap.helpTotalEstimated} testId="help-total-estimated" /></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => {
                      const isExpanded = expandedAgents.has(r.agentId);
                      const agentDaily = dailyByAgent.get(r.agentId) || [];
                      return (
                        <Fragment key={r.agentId}>
                          <TableRow data-testid={`row-agent-${r.agentId}`}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => toggleAgent(r.agentId)}
                                  aria-expanded={isExpanded}
                                  aria-label={ap.dailyBreakdown}
                                  title={ap.dailyBreakdown}
                                  data-testid={`button-expand-${r.agentId}`}
                                  className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                >
                                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </button>
                                <Avatar className="h-6 w-6 shrink-0">
                                  {r.avatarUrl ? <AvatarImage src={r.avatarUrl} alt={r.agentName} /> : null}
                                  <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                                    {initials(r.agentName)}
                                  </AvatarFallback>
                                </Avatar>
                                <span data-testid={`text-agent-name-row-${r.agentId}`}>{r.agentName}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right" data-testid={`text-new-calls-${r.agentId}`}>{r.newCalls}</TableCell>
                            <TableCell className="text-right" data-testid={`text-repeat-calls-${r.agentId}`}>{r.repeatCalls}</TableCell>
                            <TableCell className="text-right" data-testid={`text-emails-${r.agentId}`}>{r.emails}</TableCell>
                            <TableCell className="text-right" data-testid={`text-sms-${r.agentId}`}>{r.sms}</TableCell>
                            <TableCell className="text-right" data-testid={`text-tasks-${r.agentId}`}>{r.nonstandardTasks}</TableCell>
                            <TableCell className="text-right" data-testid={`text-scheduled-${r.agentId}`}>
                              {r.scheduledPending}
                              {r.scheduledOverdue > 0 ? (
                                <span className="text-rose-600 dark:text-rose-400"> ({r.scheduledOverdue} {ap.overdueLabel})</span>
                              ) : null}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">{fmtDur(r.twSeconds)}</TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">{fmtDur(r.talkSeconds)}</TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">{fmtDur(r.ringSeconds)}</TableCell>
                            <TableCell className="text-right tabular-nums font-bold" data-testid={`text-total-row-${r.agentId}`}>{fmtDur(r.totalSeconds)}</TableCell>
                          </TableRow>
                          {isExpanded && dailyLoading ? (
                            <TableRow className="bg-muted/30" data-testid={`row-daily-loading-${r.agentId}`}>
                              <TableCell colSpan={11}><Skeleton className="h-5 w-full" /></TableCell>
                            </TableRow>
                          ) : null}
                          {isExpanded && !dailyLoading && agentDaily.length === 0 ? (
                            <TableRow className="bg-muted/30" data-testid={`row-daily-empty-${r.agentId}`}>
                              <TableCell colSpan={11} className="pl-12 text-xs text-muted-foreground">{ap.noDailyData}</TableCell>
                            </TableRow>
                          ) : null}
                          {isExpanded && !dailyLoading && agentDaily.map((d) => (
                            <TableRow key={`${r.agentId}-${d.day}`} className="bg-muted/30" data-testid={`row-daily-${r.agentId}-${d.day}`}>
                              <TableCell className="pl-12 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1.5">
                                  <CalendarClock className="h-3 w-3" />
                                  {format(parseISO(d.day), "d.M.yyyy")}
                                </span>
                              </TableCell>
                              <TableCell className="text-right text-xs tabular-nums" data-testid={`text-daily-new-${r.agentId}-${d.day}`}>{d.newCalls}</TableCell>
                              <TableCell className="text-right text-xs tabular-nums">{d.repeatCalls}</TableCell>
                              <TableCell className="text-right text-xs tabular-nums">{d.emails}</TableCell>
                              <TableCell className="text-right text-xs tabular-nums">{d.sms}</TableCell>
                              <TableCell className="text-right text-xs tabular-nums">{d.nonstandardTasks}</TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground">—</TableCell>
                              <TableCell className="text-right text-xs tabular-nums text-muted-foreground">{fmtDur(d.twSeconds)}</TableCell>
                              <TableCell className="text-right text-xs tabular-nums text-muted-foreground">{fmtDur(d.talkSeconds)}</TableCell>
                              <TableCell className="text-right text-xs tabular-nums text-muted-foreground">{fmtDur(d.ringSeconds)}</TableCell>
                              <TableCell className="text-right text-xs tabular-nums font-semibold" data-testid={`text-daily-total-${r.agentId}-${d.day}`}>{fmtDur(d.totalSeconds)}</TableCell>
                            </TableRow>
                          ))}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow data-testid="row-totals">
                      <TableCell className="font-bold">{ap.totals}</TableCell>
                      <TableCell className="text-right font-bold">{detailTotals.newCalls}</TableCell>
                      <TableCell className="text-right font-bold">{detailTotals.repeatCalls}</TableCell>
                      <TableCell className="text-right font-bold">{summary.totals.emails}</TableCell>
                      <TableCell className="text-right font-bold">{summary.totals.sms}</TableCell>
                      <TableCell className="text-right font-bold">{detailTotals.nonstandardTasks}</TableCell>
                      <TableCell className="text-right font-bold">{summary.totals.scheduled}</TableCell>
                      <TableCell className="text-right tabular-nums font-bold">{fmtDur(detailTotals.twSeconds)}</TableCell>
                      <TableCell className="text-right tabular-nums font-bold">{fmtDur(detailTotals.talkSeconds)}</TableCell>
                      <TableCell className="text-right tabular-nums font-bold">{fmtDur(detailTotals.ringSeconds)}</TableCell>
                      <TableCell className="text-right tabular-nums font-bold" data-testid="text-total-all">{fmtDur(detailTotals.totalSeconds)}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </div>

            <div className="mt-6">
              <h4 className="text-sm font-semibold flex items-center gap-2 mb-1">
                <Contact className="h-4 w-4 text-primary" />
                {ap.topContactsTitle}
              </h4>
              <p className="text-xs text-muted-foreground mb-3">{ap.topContactsSubtitle}</p>
              {topLoading ? (
                <Skeleton className="h-48 w-full rounded-xl" />
              ) : topContacts.length === 0 ? (
                <div
                  className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground"
                  data-testid="text-no-top-contacts"
                >
                  {ap.noData}
                </div>
              ) : (
                <>
                <div className="overflow-x-auto rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead><ColHead label={ap.contactLabel} help={ap.helpTopContact} testId="help-top-contact" /></TableHead>
                        <TableHead className="text-right"><ColHead label={ap.callsLabel} help={ap.helpTopCalls} testId="help-top-calls" /></TableHead>
                        <TableHead className="text-right"><ColHead label={ap.emailsLabel} help={ap.helpTopEmails} testId="help-top-emails" /></TableHead>
                        <TableHead className="text-right"><ColHead label={ap.smsLabel} help={ap.helpTopSms} testId="help-top-sms" /></TableHead>
                        <TableHead className="text-right"><ColHead label={ap.tasksLabel} help={ap.helpTopTasks} testId="help-top-tasks" /></TableHead>
                        <TableHead className="text-right"><ColHead label={ap.reachableLabel} help={ap.helpReachable} testId="help-reachable" /></TableHead>
                        <TableHead className="text-right"><ColHead label={ap.unreachableLabel} help={ap.helpUnreachable} testId="help-unreachable" /></TableHead>
                        <TableHead className="text-right"><ColHead label={ap.conversionLabel} help={ap.helpConversion} testId="help-conversion" /></TableHead>
                        <TableHead className="text-right"><ColHead label={ap.attemptsToReachLabel} help={ap.helpAttemptsToReach} testId="help-attempts-to-reach" /></TableHead>
                        <TableHead className="text-right font-bold"><ColHead label={ap.mixLabel} help={ap.helpMix} testId="help-mix" /></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topContacts.map((c, idx) => {
                        const globalIdx = (topPage - 1) * TOP_PAGE_SIZE + idx;
                        const rankStyle = RANK_STYLES[globalIdx];
                        const EntityIcon = ENTITY_ICON[c.entityType] || User;
                        return (
                          <TableRow key={`${c.name}-${globalIdx}`} data-testid={`row-top-contact-${idx}`}>
                            <TableCell>
                              {rankStyle ? (
                                <div className={`h-6 w-6 rounded-md flex items-center justify-center ${rankStyle.cls}`}>
                                  <rankStyle.icon className="h-3.5 w-3.5" />
                                </div>
                              ) : (
                                <span className="text-xs font-bold text-muted-foreground pl-2">{globalIdx + 1}</span>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <EntityIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <span data-testid={`text-top-contact-name-${idx}`}>{c.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums" data-testid={`text-top-calls-${idx}`}>{c.calls}</TableCell>
                            <TableCell className="text-right tabular-nums" data-testid={`text-top-emails-${idx}`}>{c.emails}</TableCell>
                            <TableCell className="text-right tabular-nums" data-testid={`text-top-sms-${idx}`}>{c.sms}</TableCell>
                            <TableCell className="text-right tabular-nums" data-testid={`text-top-tasks-${idx}`}>{c.tasks}</TableCell>
                            <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400" data-testid={`text-top-reachable-${idx}`}>{c.reachable}</TableCell>
                            <TableCell className="text-right tabular-nums text-red-600 dark:text-red-400" data-testid={`text-top-unreachable-${idx}`}>{c.unreachable}</TableCell>
                            <TableCell className="text-right" data-testid={`text-top-conversion-${idx}`}>
                              {(() => {
                                const attempts = c.reachable + c.unreachable;
                                if (attempts === 0) {
                                  return <span className="text-muted-foreground">—</span>;
                                }
                                const pct = Math.round((c.reachable / attempts) * 100);
                                const barColor = pct >= 50 ? "bg-emerald-500" : pct >= 20 ? "bg-amber-500" : "bg-red-500";
                                const textColor = pct >= 50 ? "text-emerald-600 dark:text-emerald-400" : pct >= 20 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
                                return (
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className={`w-9 text-xs font-semibold tabular-nums ${textColor}`}>{pct}%</span>
                                  </div>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="text-right" data-testid={`text-top-attempts-${idx}`}>
                              {(() => {
                                const n = c.attemptsBeforeReach;
                                if (c.reached) {
                                  const color = n === 0
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                    : n <= 2
                                      ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                                      : "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300";
                                  return (
                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${color}`}>
                                      <Check className="h-3 w-3" />{n}
                                    </span>
                                  );
                                }
                                if (n > 0) {
                                  return (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-red-700 dark:bg-red-950/60 dark:text-red-300">
                                      <X className="h-3 w-3" />{n}
                                    </span>
                                  );
                                }
                                return <span className="text-muted-foreground">—</span>;
                              })()}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-bold" data-testid={`text-top-total-${idx}`}>{c.total}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                {topTotalPages > 1 && (
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-muted-foreground" data-testid="text-top-contacts-page">
                      {ap.pageLabel} {topPage} / {topTotalPages}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={topPage <= 1}
                        onClick={() => setTopPage((p) => Math.max(1, p - 1))}
                        data-testid="button-top-contacts-prev"
                      >
                        {ap.prevPage}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={topPage >= topTotalPages}
                        onClick={() => setTopPage((p) => Math.min(topTotalPages, p + 1))}
                        data-testid="button-top-contacts-next"
                      >
                        {ap.nextPage}
                      </Button>
                    </div>
                  </div>
                )}
                </>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
