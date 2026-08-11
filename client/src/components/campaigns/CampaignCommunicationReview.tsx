import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/i18n";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CallRecordingPlayer } from "@/components/call-recording-player";
import {
  CalendarDays, ChevronDown, UserCircle2, Phone, Mail,
  Shuffle, AlertTriangle, ThumbsUp, Minus, ThumbsDown,
  Clock, Star, ArrowUpRight, ArrowDownLeft, BarChart3,
  MessageSquare, Maximize2, X,
} from "lucide-react";
import type { DateRange } from "react-day-picker";

// ── HTML helpers ─────────────────────────────────────────────────────────────
/** Strip HTML tags and collapse whitespace for a plain-text preview */
function stripHtml(raw: string): string {
  return raw
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** Returns true when the string looks like HTML (has a tag) */
const isHtml = (s: string) => /<[a-z]/i.test(s);

// ── Sentiment helpers ─────────────────────────────────────────────────────────
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

// ── Direction badge ───────────────────────────────────────────────────────────
function DirectionBadge({ dir, labelOut, labelIn }: { dir: string; labelOut: string; labelIn: string }) {
  const out = dir === "outbound";
  return (
    <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-1 shrink-0">
      {out ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownLeft className="h-2.5 w-2.5" />}
      {out ? labelOut : labelIn}
    </Badge>
  );
}

// ── Full-email dialog ─────────────────────────────────────────────────────────
function EmailViewer({ email, onClose, labelClose }: { email: any; onClose: () => void; labelClose: string }) {
  const html = isHtml(email.content) ? email.content : `<pre style="white-space:pre-wrap;font-family:sans-serif">${email.content}</pre>`;
  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl w-full h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 pt-4 pb-3 border-b shrink-0">
          <DialogTitle className="text-sm font-semibold leading-tight">
            {email.subject ?? "(no subject)"}
          </DialogTitle>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[11px] text-muted-foreground">
              {format(new Date(email.sentAt ?? email.createdAt), "dd.MM.yyyy HH:mm")}
            </span>
            {email.contactName && (
              <span className="text-[11px] text-muted-foreground">· {email.contactName}</span>
            )}
            {email.recipientEmail && (
              <span className="text-[11px] text-muted-foreground">· {email.recipientEmail}</span>
            )}
          </div>
        </DialogHeader>
        {/* Sandboxed iframe — prevents XSS while rendering HTML email properly */}
        <iframe
          className="flex-1 w-full border-0 bg-white"
          sandbox="allow-same-origin"
          srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
            body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:13px;line-height:1.6;padding:16px;max-width:100%;word-break:break-word;color:#111;}
            img{max-width:100%;height:auto;}
            a{color:#2563eb;}
            pre,blockquote{white-space:pre-wrap;background:#f4f4f5;padding:8px;border-radius:4px;}
          </style></head><body>${html}</body></html>`}
          title="email-content"
        />
        <div className="px-5 py-3 border-t flex justify-end shrink-0">
          <Button size="sm" variant="outline" onClick={onClose}>
            <X className="h-3.5 w-3.5 mr-1.5" /> {labelClose}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
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

// ── Shuffle helper ────────────────────────────────────────────────────────────
function shuffleSample<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

// ── Main component ─────────────────────────────────────────────────────────────
interface Props {
  campaignId: string;
  campaignStartDate?: string | null;
  campaignEndDate?: string | null;
}

type FilterType = "all" | "calls" | "emails" | "sms";

export default function CampaignCommunicationReview({ campaignId, campaignStartDate, campaignEndDate }: Props) {
  const { t } = useI18n();
  const cr = t.commReview;

  const defaultFrom = campaignStartDate ? new Date(campaignStartDate) : startOfMonth(new Date());
  const defaultTo   = campaignEndDate   ? new Date(campaignEndDate)   : endOfMonth(new Date());

  const [repId, setRepId]               = useState("");
  const [range, setRange]               = useState<DateRange>({ from: defaultFrom, to: defaultTo });
  const [calOpen, setCalOpen]           = useState(false);
  const [filter, setFilter]             = useState<FilterType>("all");
  const [sampleMode, setSample]         = useState(false);
  const [expandedCall, setExpandCall]   = useState<string | null>(null);
  const [viewingEmail, setViewingEmail] = useState<any | null>(null);

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

  const summary    = data?.summary;
  const allRecs:   any[] = data?.recordings ?? [];
  const allEmails: any[] = data?.emails     ?? [];
  const allSms:    any[] = data?.sms        ?? [];

  // ── Random sample (shuffle) ────────────────────────────────────────────────
  const shownRecs   = useMemo(() => sampleMode ? shuffleSample(allRecs, 10)   : allRecs,   [allRecs, sampleMode]);
  const shownEmails = useMemo(() => sampleMode ? shuffleSample(allEmails, 10) : allEmails, [allEmails, sampleMode]);
  const shownSms    = useMemo(() => sampleMode ? shuffleSample(allSms, 10)    : allSms,    [allSms, sampleMode]);

  const sentimentLabel = (s: string | null) =>
    s === "positive" ? cr.sentimentPositive :
    s === "neutral"  ? cr.sentimentNeutral  :
    s === "negative" ? cr.sentimentNegative : cr.sentimentUnknown;

  const showCalls  = filter === "all" || filter === "calls";
  const showEmails = filter === "all" || filter === "emails";
  const showSms    = filter === "all" || filter === "sms";

  return (
    <div className="space-y-5">
      {/* ── Full-email viewer dialog ─────────────────────────────────────── */}
      {viewingEmail && (
        <EmailViewer
          email={viewingEmail}
          onClose={() => setViewingEmail(null)}
          labelClose={cr.closeEmail}
        />
      )}

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
                      {u.isRep && (
                        <span className="ml-auto text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 shrink-0">rep</span>
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
              <CalendarDays className="h-3.5 w-3.5" /> {cr.selectPeriod}
            </label>
            <div className="flex gap-2 flex-wrap">
              {([
                { key: "thisMonth", label: cr.presetThisMonth },
                { key: "lastMonth", label: cr.presetLastMonth },
                { key: "last3",     label: cr.presetLast3 },
                { key: "campaign",  label: cr.presetCampaign },
              ] as const).map(p => (
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

      {/* ── Empty state ───────────────────────────────────────────────────── */}
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
          {/* ── Summary cards ────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard icon={Phone}       title={cr.totalCalls}       value={summary?.totalCalls   ?? 0}
              sub={`${summary?.analyzedCalls ?? 0} ${cr.analyzedCalls}`}
              color="bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400" />
            <SummaryCard icon={Mail}        title={cr.totalEmails}      value={summary?.totalEmails  ?? 0}
              sub={summary?.alertEmails > 0 ? `${summary.alertEmails} ${cr.alertEmails}` : undefined}
              color="bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400" />
            <SummaryCard icon={MessageSquare} title={cr.totalSms}       value={summary?.totalSms     ?? 0}
              color="bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-400" />
            <SummaryCard icon={ThumbsDown}  title={cr.sentimentNegative} value={summary?.sentimentBreakdown?.negative ?? 0}
              color="bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400" />
          </div>

          {/* ── Filter + sample bar ──────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Tabs value={filter} onValueChange={v => setFilter(v as FilterType)}>
              <TabsList className="h-8">
                <TabsTrigger value="all"    className="text-xs px-3 h-7">{cr.filterAll}</TabsTrigger>
                <TabsTrigger value="calls"  className="text-xs px-3 h-7"><Phone         className="h-3 w-3 mr-1" />{cr.filterCalls}</TabsTrigger>
                <TabsTrigger value="emails" className="text-xs px-3 h-7"><Mail          className="h-3 w-3 mr-1" />{cr.filterEmails}</TabsTrigger>
                <TabsTrigger value="sms"    className="text-xs px-3 h-7"><MessageSquare className="h-3 w-3 mr-1" />{cr.filterSms}</TabsTrigger>
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
              {[0, 1, 2].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              CALL RECORDINGS
          ════════════════════════════════════════════════════════════════ */}
          {!isFetching && showCalls && (
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
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">{cr.noCalls}</CardContent>
                </Card>
              ) : (
                shownRecs.map((rec: any) => (
                  <Card key={rec.id} className={`overflow-hidden transition-shadow ${rec.sentiment === "negative" ? "ring-1 ring-red-300/60 dark:ring-red-700/40" : ""}`}>
                    <CardContent className="pt-4 pb-0">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold">
                              {rec.contactName ?? rec.phoneNumber ?? cr.callWith}
                            </span>
                            <DirectionBadge dir={rec.direction} labelOut={cr.directionOut} labelIn={cr.directionIn} />
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

                      {/* AI summary */}
                      {rec.summary && (
                        <p className="text-xs text-muted-foreground mb-3 leading-relaxed line-clamp-3 bg-muted/30 rounded-lg px-3 py-2">
                          {rec.summary}
                        </p>
                      )}

                      {/* Tags */}
                      {((rec.keyTopics?.length > 0) || (rec.alertKeywords?.length > 0)) && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {(rec.keyTopics ?? []).slice(0, 5).map((topic: string) => (
                            <Badge key={topic} variant="secondary" className="text-[9px] px-1.5 py-0">{topic}</Badge>
                          ))}
                          {(rec.alertKeywords ?? []).slice(0, 3).map((kw: string) => (
                            <Badge key={kw} variant="destructive" className="text-[9px] px-1.5 py-0 gap-0.5">
                              <AlertTriangle className="h-2.5 w-2.5" />{kw}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Player toggle */}
                      <div className="border-t mt-1">
                        <button
                          onClick={() => setExpandCall(prev => prev === rec.id ? null : rec.id)}
                          className="w-full text-left text-xs text-primary font-medium py-2 hover:text-primary/80 transition-colors flex items-center gap-1.5"
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

          {/* ════════════════════════════════════════════════════════════════
              EMAILS — formatted HTML preview + full-view dialog
          ════════════════════════════════════════════════════════════════ */}
          {!isFetching && showEmails && (
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
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">{cr.noEmails}</CardContent>
                </Card>
              ) : (
                shownEmails.map((email: any) => {
                  const plain = isHtml(email.content) ? stripHtml(email.content) : email.content;
                  const excerpt = plain.slice(0, 280);
                  return (
                    <Card key={email.id} className={`${email.aiAlertLevel && email.aiAlertLevel !== "none" ? "ring-1 ring-amber-400/60 dark:ring-amber-600/40" : ""}`}>
                      <CardContent className="pt-4 pb-3">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold truncate max-w-[360px]">
                                {email.subject ?? cr.noSubject}
                              </span>
                              {email.aiAlertLevel && email.aiAlertLevel !== "none" && (
                                <Badge variant="destructive" className="text-[9px] px-1.5 py-0 gap-0.5 shrink-0">
                                  <AlertTriangle className="h-2.5 w-2.5" /> alert
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground flex-wrap">
                              <span>{format(new Date(email.sentAt ?? email.createdAt), "dd.MM.yyyy HH:mm")}</span>
                              <DirectionBadge dir={email.direction} labelOut={cr.directionOut} labelIn={cr.directionIn} />
                              {email.contactName && <span className="text-muted-foreground/70">{email.contactName}</span>}
                              {email.recipientEmail && <span className="text-muted-foreground/50 truncate max-w-[200px]">{email.recipientEmail}</span>}
                            </div>
                          </div>
                          <SentimentBadge sentiment={email.aiSentiment} label={sentimentLabel(email.aiSentiment)} />
                        </div>

                        {/* Plain-text excerpt (HTML stripped) */}
                        {excerpt && (
                          <p className="text-xs text-muted-foreground mt-2 leading-relaxed line-clamp-3">
                            {excerpt}{plain.length > 280 ? "…" : ""}
                          </p>
                        )}

                        {/* Show full email button */}
                        {email.content && (
                          <button
                            onClick={() => setViewingEmail(email)}
                            className="mt-2 flex items-center gap-1.5 text-xs text-primary font-medium hover:text-primary/80 transition-colors"
                          >
                            <Maximize2 className="h-3 w-3" /> {cr.showFullEmail}
                          </button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              SMS
          ════════════════════════════════════════════════════════════════ */}
          {!isFetching && showSms && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5" /> {cr.sectionSms}
                {sampleMode && allSms.length > 10 && (
                  <span className="font-normal normal-case tracking-normal text-muted-foreground/60">
                    ({shownSms.length} {cr.showingOf} {allSms.length})
                  </span>
                )}
              </h3>
              {shownSms.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">{cr.noSms}</CardContent>
                </Card>
              ) : (
                shownSms.map((sms: any) => (
                  <Card key={sms.id} className={`${sms.aiAlertLevel && sms.aiAlertLevel !== "none" ? "ring-1 ring-amber-400/60 dark:ring-amber-600/40" : ""}`}>
                    <CardContent className="pt-3 pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <DirectionBadge dir={sms.direction} labelOut={cr.directionOut} labelIn={cr.directionIn} />
                            {sms.contactName && <span className="text-xs font-medium">{sms.contactName}</span>}
                            {sms.recipientPhone && (
                              <span className="text-[11px] text-muted-foreground">{sms.recipientPhone}</span>
                            )}
                            {sms.aiAlertLevel && sms.aiAlertLevel !== "none" && (
                              <Badge variant="destructive" className="text-[9px] px-1.5 py-0 gap-0.5">
                                <AlertTriangle className="h-2.5 w-2.5" /> alert
                              </Badge>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            {format(new Date(sms.sentAt ?? sms.createdAt), "dd.MM.yyyy HH:mm")}
                          </span>
                          {sms.content && (
                            <p className="text-xs text-foreground mt-1.5 leading-relaxed bg-muted/40 rounded-lg px-3 py-2">
                              {sms.content}
                            </p>
                          )}
                        </div>
                        <SentimentBadge sentiment={sms.aiSentiment} label={sentimentLabel(sms.aiSentiment)} />
                      </div>
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
