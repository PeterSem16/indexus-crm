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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CalendarDays, ChevronDown, UserCircle2, ArrowRight,
  Building2, Handshake, FileCheck2, Megaphone,
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
  green: "ring-2 ring-emerald-400/60", amber: "ring-2 ring-amber-400/60",
  red: "ring-2 ring-red-400/60",       gray: "ring-1 ring-border",
};
const DOT: Record<Light, string> = {
  green: "bg-emerald-500 shadow-[0_0_8px_2px_rgba(52,211,153,0.45)]",
  amber: "bg-amber-400 shadow-[0_0_8px_2px_rgba(251,191,36,0.45)]",
  red:   "bg-red-500 shadow-[0_0_8px_2px_rgba(239,68,68,0.45)]",
  gray:  "bg-muted-foreground/30",
};
const VAL: Record<Light, string> = {
  green: "text-emerald-600 dark:text-emerald-400", amber: "text-amber-600 dark:text-amber-400",
  red:   "text-red-600 dark:text-red-400",         gray:  "text-muted-foreground",
};
const GRAD: Record<Light, string> = {
  green: "from-emerald-50 to-emerald-100/60 dark:from-emerald-950/40 dark:to-emerald-900/20",
  amber: "from-amber-50 to-amber-100/60 dark:from-amber-950/40 dark:to-amber-900/20",
  red:   "from-red-50 to-red-100/60 dark:from-red-950/40 dark:to-red-900/20",
  gray:  "from-muted/40 to-muted/20",
};

function MetricCard({ icon: Icon, title, value, sub, light, loading }: {
  icon: React.ElementType; title: string; value: string;
  sub?: string; light: Light; loading?: boolean;
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
        {loading ? <Skeleton className="h-9 w-24 mt-1" /> : (
          <div className={`text-3xl font-black tracking-tight leading-none ${VAL[light]}`}>{value}</div>
        )}
        {sub && !loading && <p className="text-[11px] text-muted-foreground mt-2 leading-snug">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ── Funnel step ───────────────────────────────────────────────────────────────
const PHASE_COLORS = [
  "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800",
  "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800",
  "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
  "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800",
];

function FunnelStep({ label, count, pct, phase }: { label: string; count: number; pct: number; phase: number }) {
  const color = PHASE_COLORS[phase] ?? PHASE_COLORS[0];
  return (
    <div className={`flex-1 min-w-0 rounded-xl border p-4 text-center ${color}`}>
      <div className="text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">{label}</div>
      <div className="text-3xl font-black leading-none">{count}</div>
      <div className="text-xs font-medium mt-1 opacity-80">{pct}%</div>
    </div>
  );
}

function FunnelArrow({ medianDays, label }: { medianDays: number | null; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 shrink-0 px-1">
      <ArrowRight className="h-5 w-5 text-muted-foreground/50" />
      {medianDays != null ? (
        <span className="text-[9px] text-muted-foreground font-medium whitespace-nowrap">
          {medianDays.toFixed(1)} {label}
        </span>
      ) : <span className="text-[9px] text-muted-foreground/40">–</span>}
    </div>
  );
}

// ── Phase badge ───────────────────────────────────────────────────────────────
const PHASE_BADGE = [
  "bg-muted text-muted-foreground",
  "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
];

// ── Main component ─────────────────────────────────────────────────────────────
interface Props {
  campaignId: string;
  campaignStartDate?: string | null;
  campaignEndDate?: string | null;
}

export default function CampaignClinicKPIs({ campaignId, campaignStartDate, campaignEndDate }: Props) {
  const { t } = useI18n();
  const ck = t.clinicKpi;

  const defaultFrom = campaignStartDate ? new Date(campaignStartDate) : startOfMonth(new Date());
  const defaultTo   = campaignEndDate   ? new Date(campaignEndDate)   : endOfMonth(new Date());

  const [repId, setRepId]     = useState("");
  const [range, setRange]     = useState<DateRange>({ from: defaultFrom, to: defaultTo });
  const [calOpen, setCalOpen] = useState(false);

  // ── Rep selector: campaign agents + system reps merged ────────────────────
  const { data: agentStats = [] } = useQuery<any[]>({
    queryKey: ["/api/campaigns", campaignId, "agent-stats"],
    queryFn: () => fetch(`/api/campaigns/${campaignId}/agent-stats`, { credentials: "include" })
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); }),
    enabled: !!campaignId,
    staleTime: 5 * 60_000,
  });
  const { data: systemReps = [] } = useQuery<any[]>({
    queryKey: ["/api/representatives"],
    queryFn: () => fetch("/api/representatives", { credentials: "include" })
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); }),
    staleTime: 5 * 60_000,
  });

  const agents = useMemo(() => {
    const map = new Map<string, any>();
    for (const a of agentStats as any[]) {
      map.set(String(a.userId), { userId: String(a.userId), name: a.name, avatarUrl: a.avatarUrl, isRep: false });
    }
    for (const r of systemReps as any[]) {
      const uid = String(r.id);
      if (!map.has(uid)) {
        map.set(uid, { userId: uid, name: [r.firstName, r.lastName].filter(Boolean).join(" ") || r.name || uid, avatarUrl: r.avatarUrl ?? null, isRep: true });
      } else {
        map.get(uid)!.isRep = true;
      }
    }
    return Array.from(map.values());
  }, [agentStats, systemReps]);

  // ── Date presets ──────────────────────────────────────────────────────────
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
    if (!range?.from) return ck.selectPeriod;
    if (!range?.to)   return format(range.from, "dd.MM.yyyy");
    return `${format(range.from, "dd.MM.")} – ${format(range.to, "dd.MM.yyyy")}`;
  };

  // ── Data query ────────────────────────────────────────────────────────────
  const fromIso = range?.from?.toISOString() ?? "";
  const toIso   = range?.to?.toISOString()   ?? "";

  const { data: kpi, isFetching } = useQuery<any>({
    queryKey: ["/api/representative-performance/clinic-kpis", repId, fromIso, toIso],
    queryFn: () =>
      fetch(
        `/api/representative-performance/clinic-kpis?representativeId=${repId}&from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`,
        { credentials: "include" }
      ).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); }),
    enabled: !!repId && !!range?.from && !!range?.to,
    staleTime: 60_000,
  });

  const s   = kpi?.summary;
  const fn  = s?.funnel;
  const total = s?.totalAssigned ?? 0;

  // Traffic lights — rough benchmarks
  const approachLight   = trafficLight(total > 0 ? Math.round((s?.approached / total) * 100) : null, 80, 50);
  const coopLight       = trafficLight(total > 0 ? Math.round((s?.cooperating  / total) * 100) : null, 30, 15);
  const flyersLight     = trafficLight(total > 0 ? Math.round((s?.withFlyers   / total) * 100) : null, 50, 25);
  const contractLight   = trafficLight(total > 0 ? Math.round((s?.withContract / total) * 100) : null, 20, 10);

  const phaseName = (n: number) =>
    [ck.phaseNone, ck.phaseP1, ck.phaseP2, ck.phaseP3, ck.phaseP4][n] ?? ck.phaseNone;

  const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Rep selector */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
              <UserCircle2 className="h-3.5 w-3.5" /> {ck.selectRep}
            </label>
            <Select value={repId} onValueChange={setRepId}>
              <SelectTrigger className="h-10 text-sm font-medium">
                <SelectValue placeholder={ck.selectRepPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {agents.length === 0 && (
                  <SelectItem value="__none" disabled>{ck.selectRepPlaceholder}</SelectItem>
                )}
                {agents.map((u: any) => (
                  <SelectItem key={u.userId} value={u.userId}>
                    <div className="flex items-center gap-2">
                      {u.avatarUrl
                        ? <img src={u.avatarUrl} className="w-6 h-6 rounded-full object-cover shrink-0" />
                        : <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">{u.name?.[0] ?? "?"}</div>
                      }
                      <span>{u.name}</span>
                      {u.isRep && (
                        <span className="ml-auto text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 shrink-0">rep</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {s && (
              <p className="text-xs text-muted-foreground mt-2">
                {total} {ck.totalAssigned}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Date range */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" /> {ck.selectPeriod}
            </label>
            <div className="flex gap-2 flex-wrap">
              {[
                { key: "thisMonth", label: ck.presetThisMonth },
                { key: "lastMonth", label: ck.presetLastMonth },
                { key: "last3",     label: ck.presetLast3 },
                { key: "campaign",  label: ck.presetCampaign },
              ].map(p => (
                <Button key={p.key} size="sm" variant="outline" className="text-xs h-7 px-2"
                  onClick={() => applyPreset(p.key)}>{p.label}</Button>
              ))}
            </div>
            <Popover open={calOpen} onOpenChange={setCalOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="mt-2 w-full justify-between h-9 text-sm font-medium">
                  {formatRange()} <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="range" selected={range} onSelect={r => r && setRange(r)}
                  numberOfMonths={2} initialFocus />
              </PopoverContent>
            </Popover>
          </CardContent>
        </Card>
      </div>

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {!repId && (
        <Card className="border-dashed">
          <CardContent className="py-12 flex flex-col items-center text-center gap-3">
            <Building2 className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground max-w-xs">{ck.pickRepFirst}</p>
          </CardContent>
        </Card>
      )}

      {/* ── KPI Cards ────────────────────────────────────────────────────── */}
      {repId && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              icon={Megaphone}
              title={ck.kpi34}
              value={isFetching ? "…" : s ? `${s.approached} / ${total}` : "–"}
              sub={s ? `${pct(s.approached)}% · +${s.newInPeriod} ${ck.newInPeriod}` : ck.kpi34Sub}
              light={approachLight}
              loading={isFetching}
            />
            <MetricCard
              icon={Handshake}
              title={ck.kpi35}
              value={isFetching ? "…" : s ? `${pct(s.cooperating)}%` : "–"}
              sub={s ? `${s.cooperating} / ${total} ${ck.ofTotal}` : ck.kpi35Sub}
              light={coopLight}
              loading={isFetching}
            />
            <MetricCard
              icon={Building2}
              title={ck.kpi36}
              value={isFetching ? "…" : s ? `${pct(s.withFlyers)}%` : "–"}
              sub={s ? `${s.withFlyers} / ${total} ${ck.ofTotal}` : ck.kpi36Sub}
              light={flyersLight}
              loading={isFetching}
            />
            <MetricCard
              icon={FileCheck2}
              title={ck.kpi37}
              value={isFetching ? "…" : s ? `${pct(s.withContract)}%` : "–"}
              sub={s ? `${s.withContract} / ${total} ${ck.ofTotal}` : ck.kpi37Sub}
              light={contractLight}
              loading={isFetching}
            />
          </div>

          {/* ── Funnel ──────────────────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">{ck.funnelTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              {isFetching ? (
                <div className="flex gap-2 items-center">
                  {[0, 1, 2, 3].map(i => <Skeleton key={i} className="flex-1 h-20 rounded-xl" />)}
                </div>
              ) : fn ? (
                <div className="flex items-center gap-1">
                  <FunnelStep label={ck.phaseContacted} count={fn.p1} pct={pct(fn.p1)} phase={0} />
                  <FunnelArrow medianDays={fn.medianP1P2Days} label={ck.medianDays} />
                  <FunnelStep label={ck.phaseInterested} count={fn.p2} pct={pct(fn.p2)} phase={1} />
                  <FunnelArrow medianDays={fn.medianP2P3Days} label={ck.medianDays} />
                  <FunnelStep label={ck.phaseContract}   count={fn.p3} pct={pct(fn.p3)} phase={2} />
                  <FunnelArrow medianDays={fn.medianP3P4Days} label={ck.medianDays} />
                  <FunnelStep label={ck.phaseActive}     count={fn.p4} pct={pct(fn.p4)} phase={3} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">{ck.noData}</p>
              )}
            </CardContent>
          </Card>

          {/* ── Clinic table ─────────────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">{ck.clinicTableTitle}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isFetching ? (
                <div className="space-y-2 p-4">
                  {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-8 w-full" />)}
                </div>
              ) : kpi?.clinics?.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">{ck.nameCol}</TableHead>
                        <TableHead className="text-xs">{ck.phaseCol}</TableHead>
                        <TableHead className="text-xs">{ck.firstContactCol}</TableHead>
                        <TableHead className="text-xs">{ck.cooperationCol}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(kpi.clinics as any[]).map((c: any) => (
                        <TableRow key={c.clinicId}>
                          <TableCell className="text-sm font-medium py-2">{c.name}</TableCell>
                          <TableCell className="py-2">
                            <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${PHASE_BADGE[c.phaseNum] ?? PHASE_BADGE[0]}`}>
                              {phaseName(c.phaseNum)}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground py-2">
                            {c.firstContactAt ? format(new Date(c.firstContactAt), "dd.MM.yyyy") : "–"}
                          </TableCell>
                          <TableCell className="py-2">
                            <div className="flex gap-1 flex-wrap">
                              {c.isCooperating && <Badge variant="outline" className="text-[9px] px-1 py-0 border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400">✓ coop</Badge>}
                              {c.hasFlyers     && <Badge variant="outline" className="text-[9px] px-1 py-0 border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400">✓ letáky</Badge>}
                              {c.hasContract   && <Badge variant="outline" className="text-[9px] px-1 py-0 border-violet-300 text-violet-700 dark:border-violet-700 dark:text-violet-400">✓ zmluva</Badge>}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">{ck.noData}</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
