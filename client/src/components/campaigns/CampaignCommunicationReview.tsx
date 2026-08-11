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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CallRecordingPlayer } from "@/components/call-recording-player";
import {
  CalendarDays, ChevronDown, UserCircle2, Phone, Mail,
  Shuffle, AlertTriangle, ThumbsUp, Minus, ThumbsDown,
  Clock, Star, ArrowUpRight, ArrowDownLeft, BarChart3,
} from "lucide-react";
import type { DateRange } from "react-day-picker";

// ── Sentiment helpers ─────────────────────────────────────────────────────────
type Sentiment = "positive" | "neutral" | "negative" | null;

const SENT_COLOR: Record<string, string> = {
  positive: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700",
  neutral:  "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700",
  negative: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700",
};
const SENT_ICON: Record<string, React.ElementType> = {
  positive: ThumbsUp,
  neutral:  Minus,
  negative: ThumbsDown,
};

function SentimentBadge({ sentiment, label }: { sentiment: string | null; label: string }) {
  const key = sentiment ?? "unknown";
  const cls = SENT_COLOR[key] ?? "bg-muted text-muted-foreground border-border";
  const Icon = SENT_ICON[key] ?? Minus;
  return (
    <Badge variant="outline" className={`text-[10px] font-bold gap-1 px-2 py-0.5 ${cls}`}>
      <Icon className="h-2.5 w-2.5" /> {label}
    </Badge>
  );
}

function QualityDots({ score }: { score: number | null }) {
  if (score == null) return null;
  const filled = Math.round((score / 100) * 5);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`h-2.5 w-2.5 ${i < filled ? "fill-amber-400 text-amber-400" : "text-muted-foreground/25"}`} />
      ))}
      <span className="text-[10px] text-muted-foreground ml-1">{score}</span>
    </div>
  );
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ── Summary card ──────────────────────────────────────────────────────────────
function SummaryCard({ icon: Icon, title, value, sub, color }: {
  icon: React.ElementType; title: string; value: number; sub?: string; color: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</span>
        </div>
        <div className="text-3xl font-black tracking-tight leading-none">{value}</div>
        {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
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

type FilterType = "all" | "calls" | "emails";

export default function CampaignCommunicationReview({ campaignId, campaignStartDate, campaignEndDate }: Props) {
  const { t } = useI18n();
  const cr = t.commReview;

  const defaultFrom = campaignStartDate ? new Date(campaignStartDate) : startOfMonth(new Date());
  const defaultTo   = campaignEndDate   ? new Date(campaignEndDate)   : endOfMonth(new Date());

  const [repId, setRepId]         = useState("");
  const [range, setRange]         = useState<DateRange>({ from: defaultFrom, to: defaultTo });
  const [calOpen, setCalOpen]     = useState(false);
  const [filter, setFilter]       = useState<FilterType>("all");
  const [sampleMode, setSample]   = useState(false);
  const [expandedCall, setExpand] = useState<string | null>(null);

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
      } else { map.get(uid)!.isRep = true; }
    }
    return Array.from(map.values());
  }, [agentStats, systemReps]);

  // ── Date presets ──────────────────────────────────────────────────────────
  const applyPreset = (preset: string) => {
    const now = new Date();
    const r: DateRange =
      preset === "thisMonth" ? { from: startOfMonth(now), to: endOfMonth(now) } :
      preset === "lastMonth" ? { from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) } :
      preset === "last3"     ? { from: startOfMonth(subMonths(now, 2)), to: endOfMonth(now) } :
      preset === "campaign"  ? { from: defaultFrom, to: defaultTo } :
                               { from: startOfYear(now), to: endOfYear(now) };
    setRange(r);
    setCalOpen(false);
  };

  const formatRange = () => {
    if (!range?.from) return cr.selectPeriod;
    if (!range?.to)   return format(range.from, "dd.MM.yyyy");
    return `${format(range.from, "dd.MM.")} – ${format(range.to, "dd.MM.yyyy")}`;
  };

  // ── Data query ────────────────────────────────────────────────────────────
  const fromIso = range?.from?.toISOString() ?? "";
  const toIso   = range?.to?.toISOString()   ?? "";

  const { data, isFetching } = useQuery<any>({
    queryKey: ["/api/representative-performance/communication-review", repId, fromIso, toIso],
    queryFn: () =>
      fetch(
        `/api/representative-performance/communication-review?representativeId=${repId}&from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`,
        { credentials: "include" }
      ).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); }),
    enabled: !!repId && !!range?.from && !!range?.to,
    staleTime: 60_000,
  });

  const summary   = data?.summary;
  const allRecs: any[]   = data?.recordings ?? [];
  const allEmails: any[] = data?.emails     ?? [];

  // Random sample: pick 10 random from each list
  const shownRecs = useMemo(() => {
    if (!sampleMode) return allRecs;
    const copy = [...allRecs];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, 10);
  }, [allRecs, sampleMode]);

  const shownEmails = useMemo(() => {
    if (!sampleMode) return allEmails;
    const copy = [...allEmails];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, 10);
  }, [allEmails, sampleMode]);

  const sentimentLabel = (s: string | null) =>
    s === "positive" ? cr.sentimentPositive :
    s === "neutral"  ? cr.sentimentNeutral  :
    s === "negative" ? cr.sentimentNegative : cr.sentimentUnknown;

  return (
    <div className="space-y-5">
      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Rep */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
              <UserCircle2 className="h-3.5 w-3.5" /> {cr.selectRep}
            </label>
            <Select value={repId} onValueChange={v => { setRepId(v); setSample(false); }}>
              <SelectTrigger className="h-10 text-sm font-medium">
                <SelectValue placeholder={cr.selectRepPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {agents.map((u: any) => (
                  <SelectItem key={u.userId} value={u.userId}>
                    <div className="flex items-center gap-2">
                      {u.avatarUrl
                        ? <img src={u.avatarUrl} className="w-6 h-6 rounded-full object-cover shrink-0" />
                        : <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">{u.name?.[0] ?? "?"}</div>
                      }
                      <span>{u.name}</span>
                      {u.isRep && <span className="ml-auto text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 shrink-0">rep</span>}
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
              <CalendarDays className="h-3.5 w-3.5" /> {cr.selectPeriod}
            </label>
            <div className="flex gap-2 flex-wrap">
              {[
                { key: "thisMonth", label: cr.presetThisMonth },
                { key: "lastMonth", label: cr.presetLastMonth },
                { key: "last3",     label: cr.presetLast3 },
                { key: "campaign",  label: cr.presetCampaign },
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

      {/* ── Empty ────────────────────────────────────────────────────────── */}
      {!repId && (
        <Card className="border-dashed">
          <CardContent className="py-12 flex flex-col items-center text-center gap-3">
            <BarChart3 className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground max-w-xs">{cr.pickRepFirst}</p>
          </CardContent>
        </Card>
      )}

      {repId && (
        <>
          {/* ── Summary ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard icon={Phone}        title={cr.totalCalls}    value={summary?.totalCalls    ?? 0} sub={`${summary?.analyzedCalls ?? 0} ${cr.analyzedCalls}`} color="bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400" />
            <SummaryCard icon={Mail}         title={cr.totalEmails}   value={summary?.totalEmails   ?? 0} sub={summary?.alertEmails > 0 ? `${summary.alertEmails} ${cr.alertEmails}` : undefined} color="bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400" />
            <SummaryCard icon={ThumbsUp}     title={cr.sentimentPositive} value={summary?.sentimentBreakdown?.positive ?? 0} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400" />
            <SummaryCard icon={ThumbsDown}   title={cr.sentimentNegative} value={summary?.sentimentBreakdown?.negative ?? 0} color="bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400" />
          </div>

          {/* ── Filter bar ──────────────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Tabs value={filter} onValueChange={v => setFilter(v as FilterType)}>
              <TabsList className="h-8">
                <TabsTrigger value="all"    className="text-xs px-3 h-7">{cr.filterAll}</TabsTrigger>
                <TabsTrigger value="calls"  className="text-xs px-3 h-7"><Phone className="h-3 w-3 mr-1" />{cr.filterCalls}</TabsTrigger>
                <TabsTrigger value="emails" className="text-xs px-3 h-7"><Mail  className="h-3 w-3 mr-1" />{cr.filterEmails}</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button size="sm" variant={sampleMode ? "default" : "outline"} className="text-xs h-8 gap-1.5"
              onClick={() => setSample(s => !s)}>
              <Shuffle className="h-3 w-3" />
              {sampleMode ? cr.resetSample : cr.randomSample}
            </Button>
          </div>

          {isFetching && (
            <div className="space-y-3">
              {[0,1,2].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
            </div>
          )}

          {/* ── Call recordings ──────────────────────────────────────────── */}
          {!isFetching && (filter === "all" || filter === "calls") && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Phone className="h-3.5 w-3.5" /> {cr.sectionCalls}
                {sampleMode && allRecs.length > 10 && (
                  <span className="font-normal normal-case tracking-normal text-muted-foreground/60">
                    ({shownRecs.length} {cr.showingOf} {allRecs.length})
                  </span>
                )}
              </h3>
              {shownRecs.length === 0 ? (
                <Card className="border-dashed"><CardContent className="py-8 text-center text-sm text-muted-foreground">{cr.noCalls}</CardContent></Card>
              ) : (
                shownRecs.map((rec: any) => (
                  <Card key={rec.id} className={`overflow-hidden transition-shadow ${rec.sentiment === "negative" ? "ring-1 ring-red-300/60 dark:ring-red-700/40" : ""}`}>
                    <CardContent className="pt-4 pb-0">
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold">
                              {rec.contactName ?? rec.phoneNumber ?? cr.callWith}
                            </span>
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-1">
                              {rec.direction === "outbound"
                                ? <><ArrowUpRight className="h-2.5 w-2.5" />{cr.directionOut}</>
                                : <><ArrowDownLeft className="h-2.5 w-2.5" />{cr.directionIn}</>
                              }
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                            <span>{format(new Date(rec.startedAt ?? rec.createdAt), "dd.MM.yyyy HH:mm")}</span>
                            {rec.durationSeconds > 0 && (
                              <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{formatDuration(rec.durationSeconds)}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <SentimentBadge sentiment={rec.sentiment} label={sentimentLabel(rec.sentiment)} />
                          <QualityDots score={rec.qualityScore} />
                        </div>
                      </div>

                      {/* Summary */}
                      {rec.summary && (
                        <p className="text-xs text-muted-foreground mb-3 leading-relaxed line-clamp-3 bg-muted/30 rounded-lg px-3 py-2">
                          {rec.summary}
                        </p>
                      )}

                      {/* Key topics + alert keywords */}
                      {((rec.keyTopics?.length > 0) || (rec.alertKeywords?.length > 0)) && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {(rec.keyTopics ?? []).slice(0, 5).map((t: string) => (
                            <Badge key={t} variant="secondary" className="text-[9px] px-1.5 py-0">{t}</Badge>
                          ))}
                          {(rec.alertKeywords ?? []).slice(0, 3).map((k: string) => (
                            <Badge key={k} variant="destructive" className="text-[9px] px-1.5 py-0 gap-0.5"><AlertTriangle className="h-2.5 w-2.5" />{k}</Badge>
                          ))}
                        </div>
                      )}

                      {/* Player toggle */}
                      <div className="border-t mt-1">
                        <button
                          onClick={() => setExpand(prev => prev === rec.id ? null : rec.id)}
                          className="w-full text-left text-xs text-primary font-medium py-2 hover:text-primary/80 transition-colors flex items-center gap-1"
                        >
                          <Phone className="h-3 w-3" />
                          {expandedCall === rec.id ? "▲" : "▶"} {cr.sectionCalls}
                        </button>
                        {expandedCall === rec.id && (
                          <div className="pb-3">
                            <CallRecordingPlayer callLogId={rec.callLogId} compact />
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* ── Emails ──────────────────────────────────────────────────── */}
          {!isFetching && (filter === "all" || filter === "emails") && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Mail className="h-3.5 w-3.5" /> {cr.sectionEmails}
                {sampleMode && allEmails.length > 10 && (
                  <span className="font-normal normal-case tracking-normal text-muted-foreground/60">
                    ({shownEmails.length} {cr.showingOf} {allEmails.length})
                  </span>
                )}
              </h3>
              {shownEmails.length === 0 ? (
                <Card className="border-dashed"><CardContent className="py-8 text-center text-sm text-muted-foreground">{cr.noEmails}</CardContent></Card>
              ) : (
                shownEmails.map((email: any) => (
                  <Card key={email.id} className={`${email.aiAlertLevel && email.aiAlertLevel !== "none" ? "ring-1 ring-amber-400/60 dark:ring-amber-600/40" : ""}`}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold truncate">
                              {email.subject ?? cr.noSubject}
                            </span>
                            {email.aiAlertLevel && email.aiAlertLevel !== "none" && (
                              <Badge variant="destructive" className="text-[9px] px-1.5 py-0 gap-0.5 shrink-0">
                                <AlertTriangle className="h-2.5 w-2.5" /> alert
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap">
                            <span>{format(new Date(email.sentAt ?? email.createdAt), "dd.MM.yyyy HH:mm")}</span>
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-1">
                              {email.direction === "outbound"
                                ? <><ArrowUpRight className="h-2.5 w-2.5" />{cr.directionOut}</>
                                : <><ArrowDownLeft className="h-2.5 w-2.5" />{cr.directionIn}</>
                              }
                            </Badge>
                            {email.contactName && <span className="text-muted-foreground/70">{email.contactName}</span>}
                          </div>
                        </div>
                        <SentimentBadge sentiment={email.aiSentiment} label={sentimentLabel(email.aiSentiment)} />
                      </div>
                      {email.contentExcerpt && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                          {email.contentExcerpt}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
