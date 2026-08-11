import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/i18n";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays, ChevronDown, UserCircle2, Hospital,
  CheckCircle2, Clock, AlertTriangle, Phone, MapPin,
} from "lucide-react";
import type { DateRange } from "react-day-picker";

// ── Traffic light helpers ─────────────────────────────────────────────────────
type Light = "green" | "yellow" | "red";

const CARD_RING: Record<Light | "gray", string> = {
  green:  "ring-2 ring-emerald-400/60",
  yellow: "ring-2 ring-amber-400/60",
  red:    "ring-2 ring-red-400/60",
  gray:   "ring-1 ring-border",
};
const CARD_GRAD: Record<Light | "gray", string> = {
  green:  "from-emerald-50 to-emerald-100/60 dark:from-emerald-950/40 dark:to-emerald-900/20",
  yellow: "from-amber-50 to-amber-100/60 dark:from-amber-950/40 dark:to-amber-900/20",
  red:    "from-red-50 to-red-100/60 dark:from-red-950/40 dark:to-red-900/20",
  gray:   "from-muted/40 to-muted/20",
};
const CARD_VAL: Record<Light | "gray", string> = {
  green:  "text-emerald-600 dark:text-emerald-400",
  yellow: "text-amber-600 dark:text-amber-400",
  red:    "text-red-600 dark:text-red-400",
  gray:   "text-muted-foreground",
};
const CARD_DOT: Record<Light | "gray", string> = {
  green:  "bg-emerald-500 shadow-[0_0_8px_2px_rgba(52,211,153,0.45)]",
  yellow: "bg-amber-400 shadow-[0_0_8px_2px_rgba(251,191,36,0.45)]",
  red:    "bg-red-500 shadow-[0_0_8px_2px_rgba(239,68,68,0.45)]",
  gray:   "bg-muted-foreground/30",
};

// Row badge
const ROW_BADGE: Record<Light, string> = {
  green:  "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700",
  yellow: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700",
  red:    "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700",
};
const ROW_ICON: Record<Light, React.ElementType> = {
  green:  CheckCircle2,
  yellow: Clock,
  red:    AlertTriangle,
};

// ── Summary card ──────────────────────────────────────────────────────────────
function SummaryCard({ icon: Icon, title, value, light, loading }: {
  icon: React.ElementType; title: string; value: number; light: Light | "gray"; loading?: boolean;
}) {
  return (
    <Card className={`overflow-hidden relative transition-all duration-300 ${CARD_RING[light]}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${CARD_GRAD[light]} pointer-events-none`} />
      <CardContent className="relative pt-5 pb-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-background/60">
              <Icon className="h-4 w-4 text-foreground/70" />
            </div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider leading-tight">{title}</span>
          </div>
          <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${CARD_DOT[light]}`} />
        </div>
        {loading
          ? <Skeleton className="h-9 w-16 mt-1" />
          : <div className={`text-3xl font-black tracking-tight leading-none ${CARD_VAL[light]}`}>{value}</div>
        }
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

export default function CampaignHospitalPlan({ campaignId, campaignStartDate, campaignEndDate }: Props) {
  const { t } = useI18n();
  const hp = t.hospitalPlan;

  const defaultFrom = campaignStartDate ? new Date(campaignStartDate) : startOfMonth(new Date());
  const defaultTo   = campaignEndDate   ? new Date(campaignEndDate)   : endOfMonth(new Date());

  const [repId, setRepId]     = useState("");
  const [range, setRange]     = useState<DateRange>({ from: defaultFrom, to: defaultTo });
  const [calOpen, setCalOpen] = useState(false);

  // ── Rep selector ─────────────────────────────────────────────────────────
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
    if (!range?.from) return hp.selectPeriod;
    if (!range?.to)   return format(range.from, "dd.MM.yyyy");
    return `${format(range.from, "dd.MM.")} – ${format(range.to, "dd.MM.yyyy")}`;
  };

  // ── Data query ────────────────────────────────────────────────────────────
  const fromIso = range?.from?.toISOString() ?? "";
  const toIso   = range?.to?.toISOString()   ?? "";

  const { data, isFetching } = useQuery<any>({
    queryKey: ["/api/representative-performance/hospital-plan", repId, fromIso, toIso],
    queryFn: () =>
      fetch(
        `/api/representative-performance/hospital-plan?representativeId=${repId}&from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`,
        { credentials: "include" }
      ).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); }),
    enabled: !!repId && !!range?.from && !!range?.to,
    staleTime: 60_000,
  });

  const summary = data?.summary;
  const items: any[]  = data?.items ?? [];

  const lightLabel: Record<Light, string> = {
    green:  hp.statusOnTime,
    yellow: hp.statusDueSoon,
    red:    hp.statusOverdue,
  };

  return (
    <div className="space-y-5">
      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Rep selector */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
              <UserCircle2 className="h-3.5 w-3.5" /> {hp.selectRep}
            </label>
            <Select value={repId} onValueChange={setRepId}>
              <SelectTrigger className="h-10 text-sm font-medium">
                <SelectValue placeholder={hp.selectRepPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {agents.length === 0 && (
                  <SelectItem value="__none" disabled>{hp.selectRepPlaceholder}</SelectItem>
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
          </CardContent>
        </Card>

        {/* Date range */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" /> {hp.selectPeriod}
            </label>
            <div className="flex gap-2 flex-wrap">
              {[
                { key: "thisMonth", label: hp.presetThisMonth },
                { key: "lastMonth", label: hp.presetLastMonth },
                { key: "last3",     label: hp.presetLast3 },
                { key: "campaign",  label: hp.presetCampaign },
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
            <Hospital className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground max-w-xs">{hp.pickRepFirst}</p>
          </CardContent>
        </Card>
      )}

      {/* ── Summary cards ────────────────────────────────────────────────── */}
      {repId && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard icon={Hospital}       title={hp.totalTasks} value={summary?.total   ?? 0} light="gray"   loading={isFetching} />
            <SummaryCard icon={CheckCircle2}   title={hp.onTime}     value={summary?.onTime  ?? 0} light="green"  loading={isFetching} />
            <SummaryCard icon={Clock}          title={hp.dueSoon}    value={summary?.dueSoon ?? 0} light="yellow" loading={isFetching} />
            <SummaryCard icon={AlertTriangle}  title={hp.overdue}    value={summary?.overdue ?? 0} light="red"    loading={isFetching} />
          </div>

          {/* ── Table ───────────────────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">{hp.tableTitle}</CardTitle>
                {items.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">{hp.contactWindowNote}</span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isFetching ? (
                <div className="space-y-2 p-4">
                  {[0,1,2,3,4].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : items.length === 0 ? (
                <div className="py-12 flex flex-col items-center text-center gap-3 px-6">
                  <Hospital className="h-8 w-8 text-muted-foreground/25" />
                  <p className="text-sm text-muted-foreground max-w-sm">{hp.noTasks}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs w-8"></TableHead>
                        <TableHead className="text-xs">{hp.hospitalCol}</TableHead>
                        <TableHead className="text-xs">{hp.taskCol}</TableHead>
                        <TableHead className="text-xs">{hp.dueDateCol}</TableHead>
                        <TableHead className="text-xs">{hp.lastContactCol}</TableHead>
                        <TableHead className="text-xs">{hp.statusCol}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item: any) => {
                        const light = item.trafficLight as Light;
                        const Icon  = ROW_ICON[light];
                        return (
                          <TableRow key={item.taskId} className="hover:bg-muted/30">
                            {/* Traffic light dot */}
                            <TableCell className="py-2 pr-0">
                              <div className={`w-2.5 h-2.5 rounded-full mx-auto ${
                                light === "green"  ? "bg-emerald-500" :
                                light === "yellow" ? "bg-amber-400"   : "bg-red-500"
                              }`} />
                            </TableCell>

                            {/* Hospital */}
                            <TableCell className="py-2">
                              <div className="font-medium text-sm leading-tight">
                                {item.hospitalName ?? item.hospitalId ?? "–"}
                              </div>
                              {(item.hospitalCity || item.hospitalRegion) && (
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                                  <MapPin className="h-2.5 w-2.5 shrink-0" />
                                  {[item.hospitalCity, item.hospitalRegion].filter(Boolean).join(", ")}
                                </div>
                              )}
                            </TableCell>

                            {/* Task */}
                            <TableCell className="py-2 text-xs text-muted-foreground max-w-[200px] truncate">
                              {item.taskTitle}
                            </TableCell>

                            {/* Due date */}
                            <TableCell className="py-2 text-xs whitespace-nowrap">
                              {item.dueDate ? format(new Date(item.dueDate), "dd.MM.yyyy") : "–"}
                            </TableCell>

                            {/* Last contact */}
                            <TableCell className="py-2">
                              {item.lastContactAt ? (
                                <div className="text-xs whitespace-nowrap">
                                  <div className="font-medium">{format(new Date(item.lastContactAt), "dd.MM.yyyy")}</div>
                                  <div className="text-muted-foreground flex items-center gap-1 mt-0.5">
                                    {item.lastCallAt && new Date(item.lastCallAt) >= new Date(item.lastVisitAt ?? 0)
                                      ? <><Phone className="h-2.5 w-2.5" />{hp.lastCall}</>
                                      : <><MapPin className="h-2.5 w-2.5" />{hp.lastVisit}</>
                                    }
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[11px] text-muted-foreground/60 italic">{hp.noContact}</span>
                              )}
                            </TableCell>

                            {/* Status badge */}
                            <TableCell className="py-2">
                              <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 gap-1 ${ROW_BADGE[light]}`}>
                                <Icon className="h-2.5 w-2.5" />
                                {item.taskStatus === "completed" ? hp.statusCompleted : lightLabel[light]}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
