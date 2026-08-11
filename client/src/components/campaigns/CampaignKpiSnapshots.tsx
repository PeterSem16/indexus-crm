import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/auth-context";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell,
} from "recharts";
import { TrendingUp, UserCircle2, Lock, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

// ── Constants ──────────────────────────────────────────────────────────────────
const KPI_KEYS = ["kpi_34", "kpi_35", "kpi_36", "kpi_37"] as const;
const KPI_COLORS: Record<string, string> = {
  kpi_34: "#3b82f6",
  kpi_35: "#10b981",
  kpi_36: "#f59e0b",
  kpi_37: "#8b5cf6",
};

// ── Helper: build month options for the selector ───────────────────────────────
function buildMonthOptions(campaignStart?: string | null, campaignEnd?: string | null) {
  const now = new Date();
  const endLimit = campaignEnd ? new Date(campaignEnd) : now;
  const startLimit = campaignStart ? new Date(campaignStart) : new Date(now.getFullYear() - 1, 0, 1);
  const months: { year: number; month: number; label: string }[] = [];
  let cur = new Date(startLimit.getFullYear(), startLimit.getMonth(), 1);
  const endMonth = new Date(endLimit.getFullYear(), endLimit.getMonth(), 1);
  while (cur <= endMonth) {
    months.push({
      year: cur.getFullYear(),
      month: cur.getMonth() + 1,
      label: format(cur, "MMMM yyyy"),
    });
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  return months.reverse(); // newest first
}

// ── Custom tooltip ─────────────────────────────────────────────────────────────
function KpiTooltip({ active, payload, label, kpi34Label, kpi35Label, kpi36Label, kpi37Label }: any) {
  if (!active || !payload?.length) return null;
  const labelMap: Record<string, string> = { kpi_34: kpi34Label, kpi_35: kpi35Label, kpi_36: kpi36Label, kpi_37: kpi37Label };
  return (
    <div className="bg-popover text-popover-foreground border rounded-lg shadow-lg p-3 text-xs min-w-[160px]">
      <p className="font-semibold text-sm mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 mb-1">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            {labelMap[p.dataKey] ?? p.dataKey}
          </span>
          <span className="font-bold">{Math.round((p.value ?? 0) * 100)}%</span>
        </div>
      ))}
      {payload[0]?.payload?._meta && (
        <div className="mt-2 pt-2 border-t text-muted-foreground text-[10px]">
          {payload[0].payload._meta.map((m: any) => (
            <div key={m.key}>{m.label}: {m.numerator}/{m.denominator}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
interface Props {
  campaignId: string;
  campaignStartDate?: string | null;
  campaignEndDate?: string | null;
}

export default function CampaignKpiSnapshots({ campaignId, campaignStartDate, campaignEndDate }: Props) {
  const { t } = useI18n();
  const ks = t.kpiSnapshots;
  const { user } = useAuth();
  const { toast } = useToast();

  const isAdmin = user?.role === "admin" || user?.role === "manager";

  const [repId, setRepId] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<{ year: number; month: number; label: string } | null>(null);

  // ── Rep selector ──────────────────────────────────────────────────────────
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

  // ── Snapshot data ─────────────────────────────────────────────────────────
  const { data: snapshots = [], isFetching } = useQuery<any[]>({
    queryKey: ["/api/representative-performance/kpi-snapshots", repId, campaignId],
    queryFn: () =>
      fetch(
        `/api/representative-performance/kpi-snapshots?representativeId=${repId}&campaignId=${campaignId}`,
        { credentials: "include" }
      ).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); }),
    enabled: !!repId,
    staleTime: 30_000,
  });

  // ── Generate mutation ─────────────────────────────────────────────────────
  const generateMutation = useMutation({
    mutationFn: (params: { year: number; month: number }) =>
      fetch("/api/representative-performance/kpi-snapshots/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ representativeId: repId, campaignId, year: params.year, month: params.month }),
      }).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); }),
    onSuccess: () => {
      toast({ title: ks.generated });
      queryClient.invalidateQueries({ queryKey: ["/api/representative-performance/kpi-snapshots", repId, campaignId] });
      setConfirmOpen(false);
    },
    onError: () => {
      toast({ title: ks.generateError, variant: "destructive" });
    },
  });

  // ── Chart data ────────────────────────────────────────────────────────────
  const monthOptions = useMemo(() => buildMonthOptions(campaignStartDate, campaignEndDate), [campaignStartDate, campaignEndDate]);

  const chartData = useMemo(() => {
    if (!snapshots.length) return [];
    return (snapshots as any[]).map(snap => {
      const label = (() => {
        try { return format(new Date(snap.year, snap.month - 1, 1), "MM/yyyy"); }
        catch { return `${snap.month}/${snap.year}`; }
      })();
      const row: Record<string, any> = { name: label };
      const meta: any[] = [];
      for (const key of KPI_KEYS) {
        const kpiData = snap.kpis?.[key];
        row[key] = kpiData?.value ?? 0;
        meta.push({
          key,
          label: key === "kpi_34" ? ks.kpi34Label : key === "kpi_35" ? ks.kpi35Label : key === "kpi_36" ? ks.kpi36Label : ks.kpi37Label,
          numerator: kpiData?.numerator ?? 0,
          denominator: kpiData?.denominator ?? 0,
        });
      }
      row._meta = meta;
      return row;
    });
  }, [snapshots, ks]);

  const currentMonthOption = monthOptions[0]; // first = newest (current month)

  return (
    <div className="space-y-5">
      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Rep selector */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
              <UserCircle2 className="h-3.5 w-3.5" /> {ks.selectRep}
            </label>
            <Select value={repId} onValueChange={setRepId}>
              <SelectTrigger className="h-10 text-sm font-medium">
                <SelectValue placeholder={ks.selectRepPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {agents.length === 0 && (
                  <SelectItem value="__none" disabled>{ks.selectRepPlaceholder}</SelectItem>
                )}
                {agents.map((u: any) => (
                  <SelectItem key={u.userId} value={u.userId}>
                    <div className="flex items-center gap-2">
                      {u.avatarUrl
                        ? <img src={u.avatarUrl} className="w-6 h-6 rounded-full object-cover shrink-0" alt="" />
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
          </CardContent>
        </Card>

        {/* Generate snapshot (admin/manager only) */}
        {isAdmin && repId && (
          <Card>
            <CardContent className="pt-4 pb-4">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" /> {ks.generateBtn}
              </label>
              <div className="flex gap-2">
                <Select
                  value={selectedMonth ? `${selectedMonth.year}-${selectedMonth.month}` : ""}
                  onValueChange={val => {
                    const opt = monthOptions.find(m => `${m.year}-${m.month}` === val);
                    setSelectedMonth(opt ?? null);
                  }}
                >
                  <SelectTrigger className="h-9 text-sm flex-1">
                    <SelectValue placeholder={ks.monthLabel} />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map(m => (
                      <SelectItem key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="h-9 gap-1.5 shrink-0"
                  disabled={!selectedMonth && !currentMonthOption}
                  onClick={() => {
                    if (!selectedMonth && currentMonthOption) setSelectedMonth(currentMonthOption);
                    setConfirmOpen(true);
                  }}
                >
                  <Lock className="h-3.5 w-3.5" />
                  {ks.generateBtn}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!isAdmin && repId && (
          <Card className="border-dashed">
            <CardContent className="py-4 flex items-center gap-2 text-muted-foreground text-xs">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {ks.adminHint}
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {!repId && (
        <Card className="border-dashed">
          <CardContent className="py-12 flex flex-col items-center text-center gap-3">
            <TrendingUp className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground max-w-xs">{ks.pickRepFirst}</p>
          </CardContent>
        </Card>
      )}

      {/* ── Chart ────────────────────────────────────────────────────────── */}
      {repId && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                {ks.chartTitle}
              </CardTitle>
              {!isFetching && snapshots.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {snapshots.length} {ks.monthLabel.toLowerCase()}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isFetching ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : chartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                <Lock className="h-10 w-10 opacity-20" />
                <p className="text-sm text-center max-w-xs">{ks.noSnapshots}</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis
                    tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                    domain={[0, 1]}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    content={
                      <KpiTooltip
                        kpi34Label={ks.kpi34Label}
                        kpi35Label={ks.kpi35Label}
                        kpi36Label={ks.kpi36Label}
                        kpi37Label={ks.kpi37Label}
                      />
                    }
                  />
                  <Legend
                    formatter={(value) => {
                      const labelMap: Record<string, string> = {
                        kpi_34: ks.kpi34Label,
                        kpi_35: ks.kpi35Label,
                        kpi_36: ks.kpi36Label,
                        kpi_37: ks.kpi37Label,
                      };
                      return <span style={{ fontSize: 11 }}>{labelMap[value] ?? value}</span>;
                    }}
                  />
                  {KPI_KEYS.map(key => (
                    <Bar key={key} dataKey={key} fill={KPI_COLORS[key]} radius={[3, 3, 0, 0]} maxBarSize={30}>
                      {(chartData).map((_entry, idx) => (
                        <Cell key={idx} fill={KPI_COLORS[key]} />
                      ))}
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Snapshot list ────────────────────────────────────────────────── */}
      {repId && !isFetching && snapshots.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              {ks.lockedAt}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {(snapshots as any[]).map(snap => {
                const monthLabel = (() => {
                  try { return format(new Date(snap.year, snap.month - 1, 1), "MMMM yyyy"); }
                  catch { return `${snap.month}/${snap.year}`; }
                })();
                const lockedDate = snap.lockedAt ? format(new Date(snap.lockedAt), "dd.MM.yyyy HH:mm") : "—";
                return (
                  <div key={`${snap.year}-${snap.month}`} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <Lock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="text-sm font-semibold">{monthLabel}</span>
                    </div>
                    <div className="flex gap-3 flex-wrap flex-1">
                      {KPI_KEYS.map(key => {
                        const kpiData = snap.kpis?.[key];
                        const pct = kpiData?.value != null ? `${Math.round(kpiData.value * 100)}%` : "—";
                        const label = key === "kpi_34" ? ks.kpi34Label : key === "kpi_35" ? ks.kpi35Label : key === "kpi_36" ? ks.kpi36Label : ks.kpi37Label;
                        return (
                          <div key={key} className="flex items-center gap-1">
                            <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: KPI_COLORS[key] }} />
                            <span className="text-[11px] text-muted-foreground">{label}:</span>
                            <span className="text-[11px] font-bold" style={{ color: KPI_COLORS[key] }}>{pct}</span>
                          </div>
                        );
                      })}
                    </div>
                    <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{lockedDate}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Confirm dialog ───────────────────────────────────────────────── */}
      <Dialog open={confirmOpen} onOpenChange={open => { if (!generateMutation.isPending) setConfirmOpen(open); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              {ks.confirmLock} {(selectedMonth ?? currentMonthOption)?.label ?? ""}
            </DialogTitle>
            <DialogDescription>{ks.confirmLockDesc}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={generateMutation.isPending}>
              {ks.cancel}
            </Button>
            <Button
              onClick={() => {
                const m = selectedMonth ?? currentMonthOption;
                if (m) generateMutation.mutate({ year: m.year, month: m.month });
              }}
              disabled={generateMutation.isPending}
              className="gap-1.5"
            >
              {generateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
              {generateMutation.isPending ? ks.generating : ks.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
