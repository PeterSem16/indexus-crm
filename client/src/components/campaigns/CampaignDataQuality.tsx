import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/i18n";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarDays, ChevronDown, Users, TrendingUp, CheckCircle2, Timer,
  Zap, AlertCircle, AlertTriangle, CheckCircle, ListChecks, UserCircle2, Stethoscope
} from "lucide-react";
import type { DateRange } from "react-day-picker";

// ── Traffic-light ──────────────────────────────────────────────────────────────
type Light = "green" | "amber" | "red" | "gray";
function trafficLight(value: number | null, green: number, amber: number, higherIsBetter = true): Light {
  if (value == null) return "gray";
  if (higherIsBetter) return value >= green ? "green" : value >= amber ? "amber" : "red";
  return value <= green ? "green" : value <= amber ? "amber" : "red";
}
const RING: Record<Light, string> = {
  green: "ring-2 ring-emerald-400/60",
  amber: "ring-2 ring-amber-400/60",
  red:   "ring-2 ring-red-400/60",
  gray:  "ring-1 ring-border",
};
const DOT: Record<Light, string> = {
  green: "bg-emerald-500 shadow-[0_0_8px_2px_rgba(52,211,153,0.45)]",
  amber: "bg-amber-400 shadow-[0_0_8px_2px_rgba(251,191,36,0.45)]",
  red:   "bg-red-500   shadow-[0_0_8px_2px_rgba(239,68,68,0.45)]",
  gray:  "bg-muted-foreground/30",
};
const VAL: Record<Light, string> = {
  green: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600  dark:text-amber-400",
  red:   "text-red-600    dark:text-red-400",
  gray:  "text-muted-foreground",
};
const GRAD: Record<Light, string> = {
  green: "from-emerald-50 to-emerald-100/60 dark:from-emerald-950/40 dark:to-emerald-900/20",
  amber: "from-amber-50  to-amber-100/60  dark:from-amber-950/40  dark:to-amber-900/20",
  red:   "from-red-50    to-red-100/60    dark:from-red-950/40    dark:to-red-900/20",
  gray:  "from-muted/40  to-muted/20",
};

function MetricCard({ icon: Icon, title, value, unit, light, sub, loading }: {
  icon: React.ElementType; title: string; value: string;
  unit?: string; light: Light; sub?: string; loading?: boolean;
}) {
  return (
    <Card className={`overflow-hidden transition-all duration-300 relative ${RING[light]}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${GRAD[light]} pointer-events-none`} />
      <CardContent className="relative pt-5 pb-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-background/60 backdrop-blur-sm">
              <Icon className="h-4 w-4 text-foreground/70" />
            </div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider leading-tight">{title}</span>
          </div>
          <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${DOT[light]}`} />
        </div>
        {loading ? (
          <Skeleton className="h-9 w-24 mt-1" />
        ) : (
          <div className={`text-3xl font-black tracking-tight leading-none ${VAL[light]}`}>
            {value}
            {unit && <span className="text-base font-normal text-muted-foreground ml-1">{unit}</span>}
          </div>
        )}
        {sub && !loading && <p className="text-[11px] text-muted-foreground mt-2 leading-snug">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
interface Props {
  campaignId: string;
  campaignStartDate?: string | null;
  campaignEndDate?: string | null;
}

export default function CampaignDataQuality({ campaignId, campaignStartDate, campaignEndDate }: Props) {
  const { t } = useI18n();
  const rq = t.repQuality;

  // Default date range: campaign dates if available, else current month
  const defaultFrom = campaignStartDate ? new Date(campaignStartDate) : startOfMonth(new Date());
  const defaultTo   = campaignEndDate   ? new Date(campaignEndDate)   : endOfMonth(new Date());

  const [repId, setRepId]   = useState("");
  const [range, setRange]   = useState<DateRange>({ from: defaultFrom, to: defaultTo });
  const [calOpen, setCalOpen] = useState(false);

  // ── Fetch campaign agents + system representatives, merged & deduped ──────
  const { data: agentStats = [] } = useQuery<any[]>({
    queryKey: ["/api/campaigns", campaignId, "agent-stats"],
    queryFn: () =>
      fetch(`/api/campaigns/${campaignId}/agent-stats`, { credentials: "include" })
        .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); }),
    enabled: !!campaignId,
    staleTime: 5 * 60_000,
  });

  const { data: systemReps = [] } = useQuery<any[]>({
    queryKey: ["/api/representatives"],
    queryFn: () =>
      fetch("/api/representatives", { credentials: "include" })
        .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); }),
    staleTime: 5 * 60_000,
  });

  // Normalise both sources to { userId, name, avatarUrl, isRep }
  // then deduplicate by userId — campaign agents shown first, reps appended
  const agents = useMemo(() => {
    const map = new Map<string, any>();
    for (const a of agentStats as any[]) {
      map.set(String(a.userId), { userId: String(a.userId), name: a.name, avatarUrl: a.avatarUrl, isRep: false });
    }
    for (const r of systemReps as any[]) {
      const uid = String(r.id);
      if (!map.has(uid)) {
        map.set(uid, {
          userId: uid,
          name: [r.firstName, r.lastName].filter(Boolean).join(" ") || r.name || uid,
          avatarUrl: r.avatarUrl ?? null,
          isRep: true,
        });
      } else {
        // mark existing entry as also a representative
        map.get(uid)!.isRep = true;
      }
    }
    return Array.from(map.values());
  }, [agentStats, systemReps]);

  const selectedRep = useMemo(() => agents.find((u: any) => u.userId === repId), [agents, repId]);

  // ── Presets ────────────────────────────────────────────────────────────────
  const applyPreset = (preset: string) => {
    const now = new Date();
    const r: DateRange =
      preset === "thisMonth"  ? { from: startOfMonth(now), to: endOfMonth(now) } :
      preset === "lastMonth"  ? { from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) } :
      preset === "last3"      ? { from: startOfMonth(subMonths(now, 2)), to: endOfMonth(now) } :
      preset === "campaign"   ? { from: defaultFrom, to: defaultTo } :
                                { from: startOfYear(now), to: endOfYear(now) };
    setRange(r);
    setCalOpen(false);
  };

  const formatRange = () => {
    if (!range?.from) return rq.selectPeriod;
    if (!range?.to)   return format(range.from, "dd.MM.yyyy");
    return `${format(range.from, "dd.MM.")} – ${format(range.to, "dd.MM.yyyy")}`;
  };

  // ── Query ──────────────────────────────────────────────────────────────────
  const fromIso = range?.from?.toISOString() ?? "";
  const toIso   = range?.to?.toISOString()   ?? "";

  const { data: dq, isFetching } = useQuery<any>({
    queryKey: ["/api/representative-performance/data-quality", repId, fromIso, toIso],
    queryFn: () =>
      fetch(
        `/api/representative-performance/data-quality?representativeId=${repId}&from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`,
        { credentials: "include" }
      ).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); }),
    enabled: !!repId && !!range?.from && !!range?.to,
    staleTime: 60_000,
  });

  // ── Derived ────────────────────────────────────────────────────────────────
  const covLight  = trafficLight(dq?.coverage?.pct,        95, 80);
  const cmpLight  = trafficLight(dq?.completeness?.pct,   100, 90);
  const medLight  = trafficLight(dq?.latency?.medianHours,  1, 24, false);
  const flagCount = (dq?.consistency?.noCallStatuses?.length ?? 0) + (dq?.consistency?.bulkFillFlags?.length ?? 0);
  const cnsLight: Light = flagCount === 0 ? "green" : flagCount <= 3 ? "amber" : "red";
  const dataReady = !!repId && !!dq && !isFetching;

  return (
    <div className="space-y-5">
      {/* ── Controls ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Rep selector */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
              <UserCircle2 className="h-3.5 w-3.5" /> {rq.selectRep}
            </label>
            <Select value={repId} onValueChange={setRepId}>
              <SelectTrigger className="h-10 text-sm font-medium">
                <SelectValue placeholder={rq.selectRepPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {agents.length === 0 && (
                  <SelectItem value="__none" disabled>{rq.selectRepPlaceholder}</SelectItem>
                )}
                {agents.map((u: any) => (
                  <SelectItem key={u.userId} value={u.userId}>
                    <div className="flex items-center gap-2">
                      {u.avatarUrl ? (
                        <img src={u.avatarUrl} className="w-6 h-6 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                          {u.name?.[0] ?? "?"}
                        </div>
                      )}
                      <span>{u.name}</span>
                      {u.isRep && (
                        <span className="ml-auto text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 shrink-0">
                          rep
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Date range */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" /> {rq.selectPeriod}
            </label>
            <Popover open={calOpen} onOpenChange={setCalOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-10 w-full justify-between text-sm font-medium">
                  <span>{formatRange()}</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground ml-2 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="flex gap-1 p-3 border-b flex-wrap">
                  {(campaignStartDate ? [
                    { key: "campaign",  label: "🎯 " + (t.campaigns?.detail?.overview ?? "Campaign period") },
                    { key: "thisMonth",  label: rq.presetThisMonth },
                    { key: "lastMonth",  label: rq.presetLastMonth },
                    { key: "last3",      label: rq.presetLast3 },
                  ] : [
                    { key: "thisMonth",  label: rq.presetThisMonth },
                    { key: "lastMonth",  label: rq.presetLastMonth },
                    { key: "last3",      label: rq.presetLast3 },
                    { key: "thisYear",   label: rq.presetThisYear },
                  ]).map(p => (
                    <button
                      key={p.key}
                      onClick={() => applyPreset(p.key)}
                      className="text-xs px-3 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary font-semibold transition-colors"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <Calendar
                  mode="range"
                  selected={range}
                  onSelect={r => r && setRange(r)}
                  numberOfMonths={2}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </CardContent>
        </Card>
      </div>

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {!repId && (
        <Card className="border-dashed border-2">
          <CardContent className="py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center mx-auto mb-4">
              <Stethoscope className="h-7 w-7 text-violet-500" />
            </div>
            <p className="text-base font-semibold text-muted-foreground">{rq.pickRepFirst}</p>
          </CardContent>
        </Card>
      )}

      {repId && (
        <>
          {/* ── Metric cards ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard
              icon={TrendingUp}
              title={rq.coverage}
              value={dq?.coverage?.pct != null ? `${dq.coverage.pct}%` : "–"}
              light={isFetching ? "gray" : covLight}
              sub={dq ? `${dq.coverage.covered} / ${dq.coverage.contacted} ${rq.clinicsOf}` : undefined}
              loading={isFetching}
            />
            <MetricCard
              icon={CheckCircle}
              title={rq.completeness}
              value={dq?.completeness?.pct != null ? `${dq.completeness.pct}%` : "–"}
              light={isFetching ? "gray" : cmpLight}
              sub={dq ? `${dq.completeness.complete} / ${dq.completeness.total} ${rq.clinicsOf}` : undefined}
              loading={isFetching}
            />
            <MetricCard
              icon={Timer}
              title={rq.latencyMedian}
              value={dq?.latency?.medianHours != null ? String(dq.latency.medianHours) : "–"}
              unit="h"
              light={isFetching ? "gray" : medLight}
              sub={dq ? `P90: ${dq.latency.p90Hours != null ? dq.latency.p90Hours + " h" : "–"} · ${dq.latency.pairedCount} ${rq.pairedCalls}` : undefined}
              loading={isFetching}
            />
            <MetricCard
              icon={Zap}
              title={rq.consistency}
              value={dq ? String(flagCount) : "–"}
              unit={dq ? rq.flagsLabel : undefined}
              light={isFetching ? "gray" : (dq ? cnsLight : "gray")}
              sub={dq ? rq.consistencySub : undefined}
              loading={isFetching}
            />
          </div>

          {/* Progress bars */}
          {dataReady && (
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {([
                    { label: rq.coverage,     pct: dq.coverage.pct,     light: covLight },
                    { label: rq.completeness, pct: dq.completeness.pct, light: cmpLight },
                  ] as { label: string; pct: number | null; light: Light }[]).map(row => (
                    <div key={row.label}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-semibold text-muted-foreground">{row.label}</span>
                        <span className={`font-bold ${VAL[row.light]}`}>{row.pct != null ? `${row.pct}%` : "–"}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            row.light === "green" ? "bg-emerald-500" :
                            row.light === "amber" ? "bg-amber-400" : "bg-red-500"
                          }`}
                          style={{ width: `${Math.min(row.pct ?? 0, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Incomplete clinics ────────────────────────────────────────── */}
          {dataReady && dq.completeness.incomplete?.length > 0 && (
            <Card className={`overflow-hidden ${RING[cmpLight]}`}>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  {rq.incompleteTitle}
                  <Badge variant="secondary" className="ml-1 text-xs">{dq.completeness.incomplete.length}</Badge>
                  <span className="text-xs text-muted-foreground font-normal ml-1">— {rq.incompleteHint}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-56 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                      <tr>
                        <th className="text-left px-4 py-2 font-semibold">{rq.clinicCol}</th>
                        <th className="text-left px-4 py-2 font-semibold">{rq.missingCoop} / {rq.missingFlyers} / {rq.missingContract} / {rq.missingServices}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dq.completeness.incomplete.map((row: any, i: number) => (
                        <tr key={row.clinicId} className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                          <td className="px-4 py-2 font-medium">{row.name}</td>
                          <td className="px-4 py-2">
                            <div className="flex flex-wrap gap-1">
                              {row.missing.map((m: string) => (
                                <Badge key={m} variant="outline"
                                  className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30">
                                  {m}
                                </Badge>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Consistency flags ─────────────────────────────────────────── */}
          {dataReady && flagCount > 0 && (
            <Card className={`overflow-hidden ${RING[cnsLight]}`}>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  {rq.consistency}
                  <Badge variant="secondary" className="ml-1 text-xs">{flagCount}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-5">
                {dq.consistency.noCallStatuses?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">{rq.noCallTitle}</p>
                    <div className="rounded-lg border overflow-hidden">
                      <div className="max-h-40 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/60 sticky top-0">
                            <tr>
                              <th className="text-left px-3 py-1.5 font-semibold">{rq.clinicCol}</th>
                              <th className="text-left px-3 py-1.5 font-semibold">{rq.statusCol}</th>
                              <th className="text-left px-3 py-1.5 font-semibold">{rq.confirmedCol}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dq.consistency.noCallStatuses.map((r: any, i: number) => (
                              <tr key={r.clinicId + r.confirmedAt} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                                <td className="px-3 py-1.5 font-medium">{r.clinicName}</td>
                                <td className="px-3 py-1.5 font-mono text-[10px] text-muted-foreground">{r.statusKey?.replace(/_/g, " ")}</td>
                                <td className="px-3 py-1.5 text-muted-foreground">
                                  {new Date(r.confirmedAt).toLocaleString("sk-SK", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {dq.consistency.bulkFillFlags?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">{rq.bulkFillTitle}</p>
                    <div className="rounded-lg border overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/60">
                          <tr>
                            <th className="text-left px-3 py-1.5 font-semibold">{rq.userCol}</th>
                            <th className="text-left px-3 py-1.5 font-semibold">{rq.timeCol}</th>
                            <th className="text-left px-3 py-1.5 font-semibold">{rq.countCol}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dq.consistency.bulkFillFlags.map((r: any, i: number) => (
                            <tr key={r.userId + r.minuteBucket} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                              <td className="px-3 py-1.5 font-semibold">{r.userName}</td>
                              <td className="px-3 py-1.5 text-muted-foreground">
                                {new Date(r.minuteBucket).toLocaleString("sk-SK", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </td>
                              <td className="px-3 py-1.5">
                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{r.count}</Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── All clean ─────────────────────────────────────────────────── */}
          {dataReady && dq.completeness.incomplete?.length === 0 && flagCount === 0 && (
            <Card className="border-emerald-200 dark:border-emerald-800 ring-2 ring-emerald-400/40">
              <CardContent className="py-10 text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                </div>
                <p className="font-bold text-emerald-700 dark:text-emerald-400 text-base">{rq.allClean}</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
