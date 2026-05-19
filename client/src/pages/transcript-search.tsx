import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Search, FileText, AlertTriangle, Download, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Loader2, Phone, Megaphone, Filter, X, PhoneIncoming, PhoneOutgoing, PhoneMissed, Mic, MicOff, Brain, Calendar, UserCircle, Tag, BarChart3, SlidersHorizontal, ListChecks, ClipboardList, CheckCircle2, ShieldAlert, ClipboardCheck, Sparkles, Star, Smartphone } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useI18n } from "@/i18n";
import { CallRecordingPlayer, type PlaybackState } from "@/components/call-recording-player";

const LOCALE_MAP: Record<string, string> = { en: 'en-US', sk: 'sk-SK', cs: 'cs-CZ', hu: 'hu-HU', ro: 'ro-RO', it: 'it-IT', de: 'de-DE' };
const DAY_NAMES = ["Ne", "Po", "Ut", "St", "Št", "Pi", "So"];

interface TranscriptResult {
  id: string; callLogId: string; customerId: string | null; customerName: string | null;
  agentName: string | null; campaignName: string | null; phoneNumber: string | null;
  durationSeconds: number | null; sentiment: string | null; qualityScore: number | null;
  scriptComplianceScore: number | null; summary: string | null; alertKeywords: string[] | null;
  keyTopics: string[] | null; actionItems: string[] | null; complianceNotes: string | null;
  scriptComplianceDetails: string | null; transcriptionText: string; createdAt: string;
}

interface CallLogEntry {
  id: string; userId: string; customerId: string | null; campaignId: string | null;
  phoneNumber: string; direction: string; status: string; startedAt: string;
  durationSeconds: number | null; notes: string | null; createdAt: string;
  customerName: string | null; campaignName: string | null; hasRecording: boolean; isMobile: boolean;
  mobileAgentName: string | null; mobileOutboundCallerId: string | null;
  recording: {
    id: string; analysisStatus: string | null; transcriptionText: string | null;
    sentiment: string | null; qualityScore: number | null; scriptComplianceScore: number | null;
    summary: string | null; alertKeywords: string[] | null; keyTopics: string[] | null;
    actionItems: string[] | null; complianceNotes: string | null; scriptComplianceDetails: string | null;
    customerName: string | null; agentName: string | null; campaignName: string | null;
  } | null;
}

interface CampaignBasic { id: string; name: string; }

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function getWeekDays(weekOffset: number): Date[] {
  const today = new Date();
  const dow = today.getDay();
  const mondayOff = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOff + weekOffset * 7);
  return Array.from({ length: 5 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
}

function highlightText(text: string, query: string): JSX.Element {
  if (!query.trim()) return <span>{text}</span>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return <span>{parts.map((p, i) => p.toLowerCase() === query.toLowerCase()
    ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded-sm font-medium">{p}</mark>
    : <span key={i}>{p}</span>)}</span>;
}

function splitIntoSegments(text: string): string[] {
  const byNewline = text.split(/\n/).filter(l => l.trim().length > 0);
  if (byNewline.length >= 3) return byNewline;
  const segments: string[] = [];
  for (const line of byNewline) {
    const sentences = line.match(/[^.!?]+[.!?]+\s*/g);
    if (sentences && sentences.length > 1) {
      let chunk = "";
      for (const s of sentences) {
        chunk += s;
        if (chunk.length >= 80) { segments.push(chunk.trim()); chunk = ""; }
      }
      if (chunk.trim()) segments.push(chunk.trim());
    } else if (line.length > 150) {
      const words = line.split(/\s+/); let chunk = "";
      for (const w of words) {
        if (chunk.length + w.length > 100 && chunk.length > 0) { segments.push(chunk.trim()); chunk = ""; }
        chunk += (chunk ? " " : "") + w;
      }
      if (chunk.trim()) segments.push(chunk.trim());
    } else { segments.push(line); }
  }
  return segments.length > 0 ? segments : [text];
}

function TranscriptWithPlayback({ text, searchText, playback }: { text: string; searchText?: string; playback?: PlaybackState | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLSpanElement>(null);
  const segments = useMemo(() => splitIntoSegments(text), [text]);
  const activeLineIdx = useMemo(() => {
    if (!playback || playback.duration <= 0 || playback.currentTime <= 0) return -1;
    return Math.min(Math.floor((playback.currentTime / playback.duration) * segments.length), segments.length - 1);
  }, [playback?.currentTime, playback?.duration, segments.length]);
  useEffect(() => { if (activeLineRef.current && activeLineIdx >= 0) activeLineRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [activeLineIdx]);
  return (
    <div ref={containerRef} className="bg-muted/40 rounded-md p-2">
      <div className="text-xs leading-relaxed space-y-0.5">
        {segments.map((seg, idx) => {
          const isActive = idx === activeLineIdx, isPast = activeLineIdx >= 0 && idx < activeLineIdx;
          return (
            <span key={idx} ref={isActive ? activeLineRef : undefined}
              className={`block py-0.5 px-1.5 rounded-sm transition-colors duration-200 ${isActive ? "bg-primary/15 border-l-2 border-primary font-medium" : isPast ? "text-muted-foreground" : ""}`}
              data-testid={`transcript-line-${idx}`}>
              {searchText ? highlightText(seg, searchText) : <span>{seg}</span>}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function getSnippet(text: string, query: string, maxLen = 300): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return text.substring(0, maxLen) + (text.length > maxLen ? "..." : "");
  const start = Math.max(0, idx - 100), end = Math.min(text.length, idx + query.length + 200);
  let snippet = text.substring(start, end);
  if (start > 0) snippet = "..." + snippet;
  if (end < text.length) snippet += "...";
  return snippet;
}

function ScoreRing({ value, max = 10, stroke, label, sub }: { value: number; max?: number; stroke: string; label: string; sub: string }) {
  const r = 24, c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-1" data-testid={`score-ring-${label}`}>
      <svg viewBox="0 0 60 60" className="w-14 h-14">
        <circle cx="30" cy="30" r={r} fill="none" stroke="currentColor" strokeWidth="4.5" className="text-muted/40" />
        <circle cx="30" cy="30" r={r} fill="none" stroke={stroke} strokeWidth="4.5"
          strokeDasharray={`${(value / max) * c} ${c}`} strokeLinecap="round"
          transform="rotate(-90 30 30)" />
        <text x="30" y="34" textAnchor="middle" fontSize="13" fontWeight="700" fill="currentColor" className="fill-foreground">{value}</text>
      </svg>
      <div className="text-center leading-tight">
        <div className="text-[11px] font-semibold text-foreground">{label}</div>
        <div className="text-[10px] text-muted-foreground">{sub}</div>
      </div>
    </div>
  );
}

function MiniScoreBar({ value, max = 10, cls }: { value: number; max?: number; cls: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${cls}`} style={{ width: `${(value / max) * 100}%` }} />
      </div>
      <span className="text-[10px] font-semibold text-muted-foreground w-5 text-right">{value}</span>
    </div>
  );
}

const SENTIMENT_CFG: Record<string, { dot: string; stroke: string; bg: string; badge: string; text: string }> = {
  positive: { dot: "bg-emerald-500", stroke: "#10b981", bg: "bg-emerald-50 dark:bg-emerald-950/30", badge: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300", text: "text-emerald-700 dark:text-emerald-400" },
  neutral:  { dot: "bg-sky-500",     stroke: "#0ea5e9", bg: "bg-sky-50 dark:bg-sky-950/30",         badge: "bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300",         text: "text-sky-700 dark:text-sky-400" },
  negative: { dot: "bg-amber-500",   stroke: "#f59e0b", bg: "bg-amber-50 dark:bg-amber-950/30",     badge: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300", text: "text-amber-700 dark:text-amber-400" },
  angry:    { dot: "bg-red-500",     stroke: "#ef4444", bg: "bg-red-50 dark:bg-red-950/30",         badge: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",         text: "text-red-700 dark:text-red-400" },
};

function DirectionIcon({ direction, status }: { direction: string; status: string }) {
  if (["failed", "no_answer", "busy"].includes(status)) return <PhoneMissed className="h-4 w-4 text-destructive" />;
  if (direction === "inbound") return <PhoneIncoming className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
  return <PhoneOutgoing className="h-4 w-4 text-sky-600 dark:text-sky-400" />;
}

function CallRowItem({ log, isSelected, onClick, locale, ca }: { log: CallLogEntry; isSelected: boolean; onClick: () => void; locale: string; ca: Record<string, any> }) {
  const rec = log.recording;
  const sc = rec?.sentiment ? SENTIMENT_CFG[rec.sentiment] : null;
  const timeStr = new Date(log.startedAt || log.createdAt).toLocaleTimeString(LOCALE_MAP[locale] || "en-US", { hour: "2-digit", minute: "2-digit" });
  return (
    <div onClick={onClick} data-testid={`call-row-${log.id}`}
      className={`px-3 py-2.5 cursor-pointer transition-all border-l-[3px] ${isSelected ? "bg-primary/10 border-l-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.12)] dark:bg-primary/15" : "hover:bg-muted/50 border-l-transparent"}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <DirectionIcon direction={log.direction} status={log.status} />
          <span className="text-xs font-semibold">{timeStr}</span>
          <span className="text-[10px] text-muted-foreground">{formatDuration(log.durationSeconds)}</span>
        </div>
        <div className="flex items-center gap-1">
          {rec?.alertKeywords && rec.alertKeywords.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-destructive" />}
          {sc && <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />}
        </div>
      </div>
      <div className="text-xs font-medium truncate">{log.customerName || log.phoneNumber}</div>
      {log.customerName && <div className="text-[10px] text-muted-foreground truncate">{log.phoneNumber}</div>}
      {rec?.summary && <div className="text-[10px] text-muted-foreground truncate mt-0.5 italic">{rec.summary.slice(0, 58)}…</div>}
      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        {log.status === "no_answer" && <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{ca.statusNoAnswer}</span>}
        {log.status === "failed" && <span className="text-[9px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full">{ca.statusFailed}</span>}
        {log.isMobile && <span className="text-[9px] bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Smartphone className="h-2 w-2" />{log.mobileAgentName || "Mobile"}</span>}
        {log.hasRecording && <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Mic className="h-2 w-2" /></span>}
        {rec?.qualityScore != null && <span className="text-[9px] bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full">★ {rec.qualityScore}</span>}
        {log.campaignName && <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full truncate max-w-[90px]">{log.campaignName}</span>}
      </div>
    </div>
  );
}

function AnalysisDetail({ log, ca, locale, searchText }: { log: CallLogEntry; ca: Record<string, any>; locale: string; searchText?: string }) {
  const [tab, setTab] = useState<"analysis" | "transcript">("analysis");
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);
  const rec = log.recording;
  const dateStr = new Date(log.startedAt || log.createdAt).toLocaleString(LOCALE_MAP[locale] || "en-US", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const sc = rec?.sentiment ? SENTIMENT_CFG[rec.sentiment] : null;
  const sentimentLabels: Record<string, string> = { positive: ca.positive, neutral: ca.neutral, negative: ca.negative, angry: ca.angry };
  const alerts = rec?.alertKeywords ?? [];
  const topics = rec?.keyTopics ?? [];
  const actionItems = rec?.actionItems ?? [];

  const handleExport = (fmt: string) => { if (rec?.id) window.open(`/api/call-recordings/${rec.id}/export-transcript?format=${fmt}`, "_blank"); };

  return (
    <div className="flex flex-col h-full" data-testid={`analysis-detail-${log.id}`}>
      {/* Call header */}
      <div className="px-5 py-4 border-b bg-background shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/70 to-primary flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">
              {(log.customerName || log.phoneNumber)[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{log.customerName || log.phoneNumber}</div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {log.customerName && <span className="text-xs text-muted-foreground">{log.phoneNumber}</span>}
                <Badge variant="outline" className={`text-[10px] font-medium ${log.direction === "inbound" ? "text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700" : "text-sky-600 dark:text-sky-400 border-sky-300 dark:border-sky-700"}`}>
                  {log.direction === "inbound" ? <><PhoneIncoming className="h-2.5 w-2.5 mr-1" />{ca.inbound}</> : <><PhoneOutgoing className="h-2.5 w-2.5 mr-1" />{ca.outbound}</>}
                </Badge>
                {log.campaignName && <Badge variant="outline" className="text-[10px]"><Megaphone className="h-2.5 w-2.5 mr-1" />{log.campaignName}</Badge>}
                {rec?.agentName && <Badge variant="outline" className="text-[10px]"><UserCircle className="h-2.5 w-2.5 mr-1" />{rec.agentName}</Badge>}
                {log.isMobile && (
                  <Badge className="text-[10px] bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-700 hover:bg-violet-100">
                    <Smartphone className="h-2.5 w-2.5 mr-1" />INDEXUS Connect{log.mobileAgentName ? ` · ${log.mobileAgentName}` : ""}
                  </Badge>
                )}
                {log.isMobile && log.mobileOutboundCallerId && (
                  <Badge variant="outline" className="text-[10px] text-violet-600 dark:text-violet-400 border-violet-300 dark:border-violet-700">
                    <Phone className="h-2.5 w-2.5 mr-1" />{log.mobileOutboundCallerId}
                  </Badge>
                )}
                <span className="text-[10px] text-muted-foreground">{dateStr} · {formatDuration(log.durationSeconds)}</span>
              </div>
            </div>
          </div>
          {sc && rec?.sentiment && (
            <div className={`px-3 py-2 rounded-xl ${sc.bg} text-center shrink-0`} data-testid={`sentiment-badge-${log.id}`}>
              <div className={`text-sm font-bold ${sc.text}`}>{sentimentLabels[rec.sentiment] || rec.sentiment}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{ca.sentiment}</div>
            </div>
          )}
        </div>

        {/* Player */}
        {log.hasRecording ? (
          <div className="mt-3 bg-muted/40 rounded-xl border border-border px-3 py-2" data-testid={`player-${log.id}`}>
            <CallRecordingPlayer callLogId={log.id} compact onTimeUpdate={setPlaybackState} />
          </div>
        ) : (
          <div className="mt-3 bg-muted/30 rounded-xl border border-dashed border-border px-3 py-2.5 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <MicOff className="h-3.5 w-3.5" />{ca.withoutRecording}
          </div>
        )}
      </div>

      {/* Tabs + content */}
      {rec && rec.analysisStatus === "completed" ? (
        <>
          <div className="px-5 pt-3 shrink-0">
            <div className="flex gap-0 border border-border rounded-xl overflow-hidden w-fit bg-background">
              {(["analysis", "transcript"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} data-testid={`tab-${t}-${log.id}`}
                  className={`px-4 py-1.5 text-xs font-medium transition-colors ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                  {t === "analysis" ? <span className="flex items-center gap-1.5"><Brain className="h-3 w-3" />{ca.callAnalysis || "AI Analýza"}</span>
                    : <span className="flex items-center gap-1.5"><FileText className="h-3 w-3" />{ca.showTranscript || "Prepis"}</span>}
                </button>
              ))}
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="px-5 py-4 space-y-3 pb-6">
              {tab === "analysis" && (
                <>
                  {/* Score rings */}
                  {(rec.qualityScore != null || rec.scriptComplianceScore != null) && (
                    <div className="bg-background border border-border rounded-xl p-4" data-testid={`section-scores-${log.id}`}>
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">{ca.callAnalysis || "Výsledky analýzy"}</div>
                      <div className="flex items-start gap-4">
                        <div className="flex gap-6">
                          {rec.qualityScore != null && (
                            <ScoreRing value={rec.qualityScore} stroke="#6366f1" label={ca.quality || "Kvalita"} sub="Quality Score" />
                          )}
                          {rec.scriptComplianceScore != null && (
                            <ScoreRing value={rec.scriptComplianceScore} stroke="#10b981" label={ca.script || "Skript"} sub="Script Score" />
                          )}
                        </div>
                        <div className="flex-1 space-y-2 pt-1">
                          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{ca.quality || "Detail"}</div>
                          {rec.qualityScore != null && (
                            <div>
                              <div className="flex justify-between text-[10px] text-muted-foreground mb-1"><span>{ca.quality || "Kvalita"}</span></div>
                              <MiniScoreBar value={rec.qualityScore} cls="bg-indigo-500" />
                            </div>
                          )}
                          {rec.scriptComplianceScore != null && (
                            <div>
                              <div className="flex justify-between text-[10px] text-muted-foreground mb-1"><span>{ca.script || "Skript"}</span></div>
                              <MiniScoreBar value={rec.scriptComplianceScore} cls="bg-emerald-500" />
                            </div>
                          )}
                          {sc && rec.sentiment && (
                            <div className="mt-2 pt-2 border-t border-border">
                              <div className="text-[10px] text-muted-foreground mb-1">{ca.sentiment || "Sentiment"}</div>
                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${sc.badge}`}>{sentimentLabels[rec.sentiment] || rec.sentiment}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Alerts */}
                  {alerts.length > 0 && (
                    <div className="bg-destructive/8 border border-destructive/20 rounded-xl p-3.5" data-testid={`section-alerts-${log.id}`}>
                      <div className="flex items-center gap-2 mb-2.5">
                        <ShieldAlert className="h-4 w-4 text-destructive" />
                        <span className="text-xs font-semibold text-destructive">{ca.alerts || "Kritické slová"}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {alerts.map((a, i) => (
                          <Badge key={i} variant="destructive" className="text-xs" data-testid={`badge-alert-${log.id}-${i}`}>{a}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  {rec.summary && (
                    <div className="bg-background border border-border rounded-xl p-4" data-testid={`section-summary-${log.id}`}>
                      <div className="flex items-center gap-2 mb-2.5">
                        <div className="w-5 h-5 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center shrink-0">
                          <Brain className="h-3 w-3 text-purple-500" />
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground">{ca.summaryLabel || "AI Zhrnutie"}</span>
                      </div>
                      <p className="text-sm leading-relaxed">{rec.summary}</p>
                    </div>
                  )}

                  {/* Script compliance details */}
                  {rec.scriptComplianceDetails && (
                    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-xl p-4" data-testid={`section-script-${log.id}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <ClipboardCheck className="h-4 w-4 text-blue-500" />
                        <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">{ca.scriptComplianceLabel || "Dodržanie skriptu"}</span>
                      </div>
                      <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">{rec.scriptComplianceDetails}</p>
                    </div>
                  )}

                  {/* Topics + Action items */}
                  {(topics.length > 0 || actionItems.length > 0) && (
                    <div className="grid grid-cols-2 gap-3">
                      {topics.length > 0 && (
                        <div className="bg-background border border-border rounded-xl p-3.5" data-testid={`section-topics-${log.id}`}>
                          <div className="flex items-center gap-1.5 mb-2.5">
                            <Tag className="h-3.5 w-3.5 text-indigo-500" />
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{ca.topicsLabel || "Témy"}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {topics.map((t, i) => (
                              <Badge key={i} variant="outline" className="text-xs bg-primary/5" data-testid={`badge-topic-${log.id}-${i}`}>{t}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {actionItems.length > 0 && (
                        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-3.5" data-testid={`section-actions-${log.id}`}>
                          <div className="flex items-center gap-1.5 mb-2.5">
                            <ListChecks className="h-3.5 w-3.5 text-emerald-500" />
                            <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">{ca.actionItemsLabel || "Akcie"}</span>
                          </div>
                          <ul className="space-y-1.5">
                            {actionItems.map((item, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-xs text-emerald-800 dark:text-emerald-300" data-testid={`action-item-${log.id}-${i}`}>
                                <CheckCircle2 className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />{item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Compliance notes */}
                  {rec.complianceNotes && (
                    <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/50 rounded-xl p-3.5">
                      <div className="flex items-center gap-2 mb-2">
                        <ShieldAlert className="h-3.5 w-3.5 text-orange-500" />
                        <span className="text-xs font-semibold text-orange-700 dark:text-orange-400">{ca.complianceLabel || "Compliance"}</span>
                      </div>
                      <p className="text-xs text-orange-700 dark:text-orange-300 leading-relaxed">{rec.complianceNotes}</p>
                    </div>
                  )}

                  {log.notes && (
                    <div className="bg-muted/40 rounded-xl p-3.5">
                      <p className="text-xs text-muted-foreground italic">{log.notes}</p>
                    </div>
                  )}
                </>
              )}

              {tab === "transcript" && rec.transcriptionText && (
                <div className="bg-background border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground">{ca.showTranscript || "Prepis hovoru"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => handleExport("txt")} data-testid={`btn-export-txt-${log.id}`}>
                        <Download className="h-3 w-3" /><span className="text-xs">TXT</span>
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => handleExport("json")} data-testid={`btn-export-json-${log.id}`}>
                        <Download className="h-3 w-3" /><span className="text-xs">JSON</span>
                      </Button>
                    </div>
                  </div>
                  <TranscriptWithPlayback text={rec.transcriptionText} searchText={searchText} playback={playbackState} />
                </div>
              )}

              {tab === "transcript" && !rec.transcriptionText && (
                <div className="text-center py-8 text-muted-foreground text-sm">{ca.noTranscript || "Prepis nie je k dispozícii"}</div>
              )}
            </div>
          </ScrollArea>
        </>
      ) : rec?.analysisStatus === "processing" ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /><span className="text-sm">{ca.processing}</span>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center py-12 text-muted-foreground">
          <MicOff className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm font-medium">{ca.withoutRecording}</p>
          {log.notes && <p className="text-xs mt-2 text-center max-w-xs italic">{log.notes}</p>}
        </div>
      )}
    </div>
  );
}

/* ─── Search tab: ResultCard (unchanged logic, updated style) ─── */
function ResultCard({ result, query }: { result: TranscriptResult; query: string }) {
  const { t, locale } = useI18n();
  const ca = t.callAnalysis;
  const [expanded, setExpanded] = useState(false);
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);
  const snippet = getSnippet(result.transcriptionText, query);
  const dateStr = new Date(result.createdAt).toLocaleString(LOCALE_MAP[locale] || "en-US", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const sentimentLabels: Record<string, string> = { positive: ca.positive, neutral: ca.neutral, negative: ca.negative, angry: ca.angry };
  const sc = result.sentiment ? SENTIMENT_CFG[result.sentiment] : null;
  const handleExport = (fmt: string) => window.open(`/api/call-recordings/${result.id}/export-transcript?format=${fmt}`, "_blank");

  return (
    <div className="bg-background border border-border rounded-xl p-4 space-y-2.5" data-testid={`transcript-result-${result.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            {result.customerName && <span className="text-sm font-medium">{result.customerName}</span>}
            {result.phoneNumber && <span className="text-xs text-muted-foreground">{result.phoneNumber}</span>}
            {result.agentName && <Badge variant="outline" className="text-[10px]">{result.agentName}</Badge>}
            {result.campaignName && <Badge variant="outline" className="text-[10px] gap-1"><Megaphone className="h-2.5 w-2.5" />{result.campaignName}</Badge>}
          </div>
          <div className="flex items-center gap-2 flex-wrap text-[10px] text-muted-foreground">
            <span>{dateStr}</span>
            <span>{formatDuration(result.durationSeconds)}</span>
            {sc && result.sentiment && <span className={`font-medium ${sc.text}`}>{sentimentLabels[result.sentiment] || result.sentiment}</span>}
            {result.qualityScore != null && <span className="flex items-center gap-0.5"><Star className="h-2.5 w-2.5 text-amber-500" />{result.qualityScore}/10</span>}
            {result.alertKeywords && result.alertKeywords.length > 0 && (
              <Badge variant="destructive" className="text-[10px] gap-1"><AlertTriangle className="h-2.5 w-2.5" />{result.alertKeywords.length} {ca.alerts}</Badge>
            )}
          </div>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button size="icon" variant="ghost" className="shrink-0" data-testid={`btn-analysis-result-${result.id}`}>
              <Brain className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Brain className="h-5 w-5 text-purple-600 dark:text-purple-400" />{ca.callAnalysis}</DialogTitle>
              <DialogDescription className="sr-only">{ca.callAnalysis}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              {result.summary && <div className="bg-muted/40 rounded-md p-3"><Brain className="h-4 w-4 text-purple-500 mb-1" /><p className="text-sm leading-relaxed">{result.summary}</p></div>}
              {result.keyTopics && result.keyTopics.length > 0 && <div className="flex flex-wrap gap-1.5">{result.keyTopics.map((t, i) => <Badge key={i} variant="outline" className="text-xs">{t}</Badge>)}</div>}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {result.callLogId && <div className="border border-border rounded-lg p-2"><CallRecordingPlayer callLogId={result.callLogId} compact onTimeUpdate={setPlaybackState} /></div>}

      <div className="bg-muted/40 rounded-lg p-2.5">
        <p className="text-xs leading-relaxed">{highlightText(snippet, query)}</p>
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => setExpanded(!expanded)} data-testid={`btn-full-transcript-${result.id}`}>
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          <span className="text-[11px]">{expanded ? ca.hideFullTranscript : ca.fullTranscript}</span>
        </Button>
        <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => handleExport("txt")} data-testid={`btn-export-txt-${result.id}`}><Download className="h-3 w-3" /><span className="text-[11px]">TXT</span></Button>
        <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => handleExport("json")} data-testid={`btn-export-json-${result.id}`}><Download className="h-3 w-3" /><span className="text-[11px]">JSON</span></Button>
      </div>
      {expanded && <ScrollArea className="max-h-[300px] mt-1"><TranscriptWithPlayback text={result.transcriptionText} searchText={query} playback={playbackState} /></ScrollArea>}
    </div>
  );
}

/* ═══════════════════ MAIN PAGE ═══════════════════ */
export function TranscriptSearchContent() {
  const { t, locale } = useI18n();
  const ca = t.callAnalysis;

  /* Day navigation */
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string>(toDateStr(new Date()));
  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset]);

  /* Browse filters */
  const [browseSearchText, setBrowseSearchText] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [browseCampaignFilter, setBrowseCampaignFilter] = useState("");
  const [browseDirectionFilter, setBrowseDirectionFilter] = useState("");
  const [browseStatusFilter, setBrowseStatusFilter] = useState("");
  const [browseRecordingFilter, setBrowseRecordingFilter] = useState("");
  const [browseSentimentFilter, setBrowseSentimentFilter] = useState("");
  const [browseAgentFilter, setBrowseAgentFilter] = useState("");
  const [browseHasAlertsFilter, setBrowseHasAlertsFilter] = useState(false);
  const [browseMobileFilter, setBrowseMobileFilter] = useState(false);
  const [browseMinQuality, setBrowseMinQuality] = useState("");
  const [browseQueueFilter, setBrowseQueueFilter] = useState("");
  const [selectedCallLogId, setSelectedCallLogId] = useState<string | null>(null);

  /* Search tab */
  const [activeTab, setActiveTab] = useState<"browse" | "search">("browse");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sentimentFilter, setSentimentFilter] = useState("");
  const [hasAlertsFilter, setHasAlertsFilter] = useState(false);

  /* Queries */
  const { data: callLogs = [], isLoading: logsLoading } = useQuery<CallLogEntry[]>({
    queryKey: ["/api/call-logs/browse"],
    queryFn: async () => {
      const res = await fetch("/api/call-logs/browse?limit=500", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: activeTab === "browse",
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  });

  const { data: campaignsList = [] } = useQuery<CampaignBasic[]>({
    queryKey: ["/api/campaigns", "basic-list"],
    queryFn: async () => {
      const res = await fetch("/api/campaigns", { credentials: "include" });
      if (!res.ok) return [];
      return (await res.json()).map((c: any) => ({ id: c.id, name: c.name }));
    },
  });

  const { data: results = [], isLoading, isFetching } = useQuery<TranscriptResult[]>({
    queryKey: ["/api/call-recordings/search/transcripts", { query: searchQuery, sentiment: sentimentFilter, hasAlerts: hasAlertsFilter }],
    queryFn: async () => {
      const p = new URLSearchParams({ query: searchQuery, limit: "50" });
      if (sentimentFilter) p.set("sentiment", sentimentFilter);
      if (hasAlertsFilter) p.set("hasAlerts", "true");
      const res = await fetch(`/api/call-recordings/search/transcripts?${p}`, { credentials: "include" });
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: searchQuery.length >= 2 && activeTab === "search",
  });

  const handleSearch = useCallback(() => { if (searchInput.trim().length >= 2) setSearchQuery(searchInput.trim()); }, [searchInput]);

  const uniqueAgents = useMemo(() => { const s = new Set<string>(); callLogs.forEach(l => { if (l.recording?.agentName) s.add(l.recording.agentName); if (l.mobileAgentName) s.add(l.mobileAgentName); }); return Array.from(s).sort(); }, [callLogs]);
  const uniqueCampaigns = useMemo(() => { const m = new Map<string, string>(); callLogs.forEach(l => { if (l.campaignId && l.campaignName) m.set(l.campaignId, l.campaignName); }); return Array.from(m.entries()).map(([id, name]) => ({ id, name })); }, [callLogs]);
  const uniqueQueues = useMemo(() => { const m = new Map<string, string>(); callLogs.forEach(l => { const qId = (l as any).inboundQueueId, qName = (l as any).inboundQueueName; if (qId && qName) m.set(qId, qName); }); return Array.from(m.entries()).map(([id, name]) => ({ id, name })); }, [callLogs]);

  const filteredCallLogs = useMemo(() => {
    let f = [...callLogs];
    /* Date filter (day navigation) */
    if (selectedDate) {
      f = f.filter(l => { const d = new Date(l.startedAt || l.createdAt); return toDateStr(d) === selectedDate; });
    }
    if (browseSearchText) {
      const q = browseSearchText.toLowerCase();
      f = f.filter(l => l.phoneNumber?.toLowerCase().includes(q) || l.customerName?.toLowerCase().includes(q) || l.campaignName?.toLowerCase().includes(q) || l.recording?.agentName?.toLowerCase().includes(q) || l.mobileAgentName?.toLowerCase().includes(q) || l.recording?.summary?.toLowerCase().includes(q));
    }
    if (browseCampaignFilter) f = browseCampaignFilter === "__none__" ? f.filter(l => !l.campaignId) : f.filter(l => l.campaignId === browseCampaignFilter);
    if (browseDirectionFilter) f = f.filter(l => l.direction === browseDirectionFilter);
    if (browseQueueFilter) f = f.filter(l => (l as any).inboundQueueId === browseQueueFilter);
    if (browseStatusFilter) f = f.filter(l => l.status === browseStatusFilter);
    if (browseRecordingFilter === "recorded") f = f.filter(l => l.hasRecording);
    else if (browseRecordingFilter === "not_recorded") f = f.filter(l => !l.hasRecording);
    else if (browseRecordingFilter === "analyzed") f = f.filter(l => l.recording?.analysisStatus === "completed");
    else if (browseRecordingFilter === "transcribed") f = f.filter(l => l.recording?.transcriptionText);
    if (browseSentimentFilter) f = f.filter(l => l.recording?.sentiment === browseSentimentFilter);
    if (browseAgentFilter) f = f.filter(l => l.recording?.agentName === browseAgentFilter || l.mobileAgentName === browseAgentFilter);
    if (browseHasAlertsFilter) f = f.filter(l => l.recording?.alertKeywords && l.recording.alertKeywords.length > 0);
    if (browseMobileFilter) f = f.filter(l => l.isMobile);
    if (browseMinQuality) { const minQ = parseInt(browseMinQuality); if (!isNaN(minQ)) f = f.filter(l => l.recording?.qualityScore != null && l.recording.qualityScore >= minQ); }
    return f;
  }, [callLogs, selectedDate, browseSearchText, browseCampaignFilter, browseDirectionFilter, browseQueueFilter, browseStatusFilter, browseRecordingFilter, browseSentimentFilter, browseAgentFilter, browseHasAlertsFilter, browseMobileFilter, browseMinQuality]);

  const stats = useMemo(() => {
    const all = filteredCallLogs;
    const completed = all.filter(l => l.status === "completed").length;
    const withAlerts = all.filter(l => l.recording?.alertKeywords && l.recording.alertKeywords.length > 0).length;
    const qScores = all.filter(l => l.recording?.qualityScore != null).map(l => l.recording!.qualityScore!);
    const avgQ = qScores.length ? (qScores.reduce((a, b) => a + b, 0) / qScores.length).toFixed(1) : null;
    return { total: all.length, completed, withAlerts, avgQ };
  }, [filteredCallLogs]);

  const activeFilterCount = [browseCampaignFilter, browseDirectionFilter, browseStatusFilter, browseRecordingFilter, browseSentimentFilter, browseAgentFilter, browseHasAlertsFilter ? "y" : "", browseMobileFilter ? "y" : "", browseMinQuality, browseQueueFilter].filter(Boolean).length;

  const clearFilters = () => { setBrowseCampaignFilter(""); setBrowseDirectionFilter(""); setBrowseStatusFilter(""); setBrowseRecordingFilter(""); setBrowseSentimentFilter(""); setBrowseAgentFilter(""); setBrowseHasAlertsFilter(false); setBrowseMobileFilter(false); setBrowseMinQuality(""); setBrowseQueueFilter(""); };

  useEffect(() => {
    if (filteredCallLogs.length > 0 && (!selectedCallLogId || !filteredCallLogs.find(l => l.id === selectedCallLogId))) {
      setSelectedCallLogId(filteredCallLogs[0].id);
    } else if (filteredCallLogs.length === 0) {
      setSelectedCallLogId(null);
    }
  }, [filteredCallLogs, selectedCallLogId]);

  const selectedLog = selectedCallLogId ? filteredCallLogs.find(l => l.id === selectedCallLogId) ?? null : null;

  return (
    <div className="flex flex-col h-full bg-muted/20">

      {/* ── Top header ── */}
      <div className="bg-background border-b px-4 py-2.5 flex items-center gap-3 shrink-0" data-testid="calls-header">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <Phone className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-none" data-testid="text-page-title">{ca.pageTitle}</div>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-0 border border-border rounded-lg overflow-hidden shrink-0 ml-1">
          <button onClick={() => setActiveTab("browse")} data-testid="btn-tab-browse"
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${activeTab === "browse" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
            {ca.allCalls || "Hovory"}
          </button>
          <button onClick={() => setActiveTab("search")} data-testid="btn-tab-search"
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${activeTab === "search" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
            {ca.searchTranscripts || "Hľadaj"}
          </button>
        </div>

        {activeTab === "browse" && (
          <>
            {/* Week navigation strip */}
            <div className="flex items-center gap-1 mx-auto">
              <button onClick={() => setWeekOffset(w => w - 1)} data-testid="btn-week-prev"
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              {weekDays.map((d, i) => {
                const ds = toDateStr(d);
                const isToday = ds === toDateStr(new Date());
                const isSelected = ds === selectedDate;
                const dayCallCount = callLogs.filter(l => toDateStr(new Date(l.startedAt || l.createdAt)) === ds).length;
                return (
                  <button key={i} onClick={() => setSelectedDate(ds)} data-testid={`btn-day-${ds}`}
                    className={`flex flex-col items-center px-2.5 py-1 rounded-xl transition-all ${isSelected ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted text-muted-foreground"}`}>
                    <span className="text-[10px] font-medium">{DAY_NAMES[d.getDay()]}</span>
                    <span className={`text-sm font-bold leading-tight ${isSelected ? "text-primary-foreground" : isToday ? "text-primary" : ""}`}>{d.getDate()}</span>
                    <span className={`text-[9px] mt-0.5 ${isSelected ? "text-primary-foreground/70" : "text-muted-foreground/60"}`}>{dayCallCount || "–"}</span>
                  </button>
                );
              })}
              <button onClick={() => setWeekOffset(w => w + 1)} data-testid="btn-week-next"
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => { setWeekOffset(0); setSelectedDate(toDateStr(new Date())); }} data-testid="btn-today"
                className="ml-1 px-2.5 py-1 rounded-lg border border-border text-[10px] text-muted-foreground hover:bg-muted transition-colors flex items-center gap-1">
                <Calendar className="h-3 w-3" />{ca.today || "Dnes"}
              </button>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-3 shrink-0 text-xs">
              <span className="font-semibold">{stats.total}</span><span className="text-muted-foreground">{ca.calls || "hovorov"}</span>
              {stats.withAlerts > 0 && <span className="flex items-center gap-1 text-destructive font-medium"><AlertTriangle className="h-3 w-3" />{stats.withAlerts}</span>}
              {stats.avgQ && <span className="flex items-center gap-1 text-amber-500 font-medium"><Star className="h-3 w-3" />{stats.avgQ}</span>}
            </div>
          </>
        )}

        {activeTab === "search" && (
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder={ca.searchPlaceholder} className="pl-8 h-8 text-xs" value={searchInput}
                onChange={e => setSearchInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSearch()}
                data-testid="input-transcript-search" />
            </div>
            <Button size="sm" onClick={handleSearch} disabled={searchInput.trim().length < 2} data-testid="btn-search-transcripts">
              <Search className="h-3.5 w-3.5 mr-1" />{ca.search}
            </Button>
          </div>
        )}
      </div>

      {/* ── Browse mode ── */}
      {activeTab === "browse" && (
        <div className="flex flex-1 min-h-0">

          {/* Left: list */}
          <div className="w-[280px] shrink-0 bg-background border-r flex flex-col min-h-0">
            {/* Search + filter */}
            <div className="px-3 py-2 border-b space-y-1.5 shrink-0">
              <div className="flex gap-1.5">
                <div className="flex-1 flex items-center gap-2 bg-muted/60 rounded-lg px-2.5 py-1.5 text-xs">
                  <Search className="h-3 w-3 text-muted-foreground shrink-0" />
                  <input placeholder={ca.searchInCalls || "Hľadaj…"} value={browseSearchText}
                    onChange={e => setBrowseSearchText(e.target.value)}
                    className="bg-transparent outline-none flex-1 placeholder-muted-foreground text-foreground"
                    data-testid="input-browse-search" />
                </div>
                <button onClick={() => setShowFilters(!showFilters)} data-testid="btn-browse-filters"
                  className={`relative px-2.5 rounded-lg border text-xs transition-colors ${showFilters || activeFilterCount > 0 ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center font-bold">{activeFilterCount}</span>
                  )}
                </button>
              </div>

              {showFilters && (
                <div className="space-y-2 pb-1">
                  <div className="grid grid-cols-2 gap-1">
                    <Select value={browseDirectionFilter || "all"} onValueChange={v => setBrowseDirectionFilter(v === "all" ? "" : v)}>
                      <SelectTrigger className="h-7 text-[10px]" data-testid="select-browse-direction"><SelectValue placeholder={ca.direction} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{ca.allDirections}</SelectItem>
                        <SelectItem value="inbound">{ca.inbound}</SelectItem>
                        <SelectItem value="outbound">{ca.outbound}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={browseStatusFilter || "all"} onValueChange={v => setBrowseStatusFilter(v === "all" ? "" : v)}>
                      <SelectTrigger className="h-7 text-[10px]" data-testid="select-browse-status"><SelectValue placeholder={ca.status} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{ca.allStatuses}</SelectItem>
                        <SelectItem value="completed">{ca.statusCompleted}</SelectItem>
                        <SelectItem value="no_answer">{ca.statusNoAnswer}</SelectItem>
                        <SelectItem value="failed">{ca.statusFailed}</SelectItem>
                        <SelectItem value="busy">{ca.statusBusy}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={browseSentimentFilter || "all"} onValueChange={v => setBrowseSentimentFilter(v === "all" ? "" : v)}>
                      <SelectTrigger className="h-7 text-[10px]" data-testid="select-browse-sentiment"><SelectValue placeholder={ca.sentiment} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{ca.allSentiments}</SelectItem>
                        <SelectItem value="positive">{ca.positive}</SelectItem>
                        <SelectItem value="neutral">{ca.neutral}</SelectItem>
                        <SelectItem value="negative">{ca.negative}</SelectItem>
                        <SelectItem value="angry">{ca.angry}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={browseRecordingFilter || "all"} onValueChange={v => setBrowseRecordingFilter(v === "all" ? "" : v)}>
                      <SelectTrigger className="h-7 text-[10px]" data-testid="select-browse-recording"><SelectValue placeholder={ca.recording} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{ca.allRecordings}</SelectItem>
                        <SelectItem value="recorded">{ca.withRecording}</SelectItem>
                        <SelectItem value="not_recorded">{ca.withoutRecording}</SelectItem>
                        <SelectItem value="analyzed">{ca.analyzed}</SelectItem>
                        <SelectItem value="transcribed">{ca.withTranscript}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {(uniqueCampaigns.length > 0 || campaignsList.length > 0) && (
                    <Select value={browseCampaignFilter || "all"} onValueChange={v => setBrowseCampaignFilter(v === "all" ? "" : v)}>
                      <SelectTrigger className="h-7 text-[10px] w-full" data-testid="select-browse-campaign"><SelectValue placeholder={ca.campaign} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{ca.allCampaigns}</SelectItem>
                        <SelectItem value="__none__">{ca.noCampaign}</SelectItem>
                        {(uniqueCampaigns.length > 0 ? uniqueCampaigns : campaignsList).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  {uniqueAgents.length > 0 && (
                    <Select value={browseAgentFilter || "all"} onValueChange={v => setBrowseAgentFilter(v === "all" ? "" : v)}>
                      <SelectTrigger className="h-7 text-[10px] w-full" data-testid="select-browse-agent"><SelectValue placeholder={ca.agent} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{ca.allAgents}</SelectItem>
                        {uniqueAgents.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
                        <input type="checkbox" checked={browseHasAlertsFilter} onChange={e => setBrowseHasAlertsFilter(e.target.checked)} className="h-3 w-3" data-testid="checkbox-has-alerts" />
                        {ca.withAlerts}
                      </label>
                      <label className="flex items-center gap-1.5 text-[10px] text-violet-600 dark:text-violet-400 cursor-pointer font-medium">
                        <input type="checkbox" checked={browseMobileFilter} onChange={e => setBrowseMobileFilter(e.target.checked)} className="h-3 w-3 accent-violet-600" data-testid="checkbox-mobile-filter" />
                        <Smartphone className="h-3 w-3" />
                        INDEXUS Connect
                      </label>
                    </div>
                    {activeFilterCount > 0 && (
                      <button onClick={clearFilters} className="text-[10px] text-primary hover:underline" data-testid="btn-clear-browse-filters">
                        {ca.clearFilters}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Call list */}
            <div className="flex-1 overflow-y-auto divide-y divide-border/50">
              {logsLoading && (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /><span className="text-xs">{ca.loadingCalls}</span>
                </div>
              )}
              {!logsLoading && filteredCallLogs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground px-4 text-center">
                  <Phone className="h-8 w-8 mb-2 opacity-25" />
                  <p className="text-xs font-medium">{ca.noCalls}</p>
                  {activeFilterCount > 0 && (
                    <button onClick={clearFilters} className="mt-3 text-[10px] text-primary hover:underline flex items-center gap-1">
                      <X className="h-3 w-3" />{ca.clearFilters}
                    </button>
                  )}
                </div>
              )}
              {!logsLoading && filteredCallLogs.map(log => (
                <CallRowItem key={log.id} log={log} isSelected={selectedCallLogId === log.id}
                  onClick={() => setSelectedCallLogId(log.id)} locale={locale} ca={ca} />
              ))}
            </div>
          </div>

          {/* Right: detail */}
          <div className="flex-1 min-h-0 flex flex-col bg-background">
            {selectedLog
              ? <AnalysisDetail key={selectedLog.id} log={selectedLog} ca={ca} locale={locale} searchText={browseSearchText} />
              : (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                  <Brain className="h-12 w-12 mb-4 opacity-20" />
                  <p className="text-sm font-medium">{ca.callAnalysis}</p>
                  <p className="text-xs mt-1">{ca.selectCallForAnalysis || "Vyber hovor zo zoznamu"}</p>
                </div>
              )}
          </div>
        </div>
      )}

      {/* ── Search mode ── */}
      {activeTab === "search" && (
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Search filters */}
          <div className="px-4 py-2 border-b bg-background shrink-0 flex items-center gap-3 flex-wrap">
            <Select value={sentimentFilter || "all"} onValueChange={v => setSentimentFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-sentiment-filter"><SelectValue placeholder={ca.allSentiments} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ca.allSentiments}</SelectItem>
                <SelectItem value="positive">{ca.positive}</SelectItem>
                <SelectItem value="neutral">{ca.neutral}</SelectItem>
                <SelectItem value="negative">{ca.negative}</SelectItem>
                <SelectItem value="angry">{ca.angry}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant={hasAlertsFilter ? "default" : "outline"} size="sm" className="h-8 gap-1"
              onClick={() => setHasAlertsFilter(!hasAlertsFilter)} data-testid="btn-filter-alerts">
              <AlertTriangle className="h-3 w-3" /><span className="text-xs">{ca.withAlerts}</span>
            </Button>
            {(sentimentFilter || hasAlertsFilter) && (
              <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={() => { setSentimentFilter(""); setHasAlertsFilter(false); }} data-testid="btn-clear-filters">
                <X className="h-3 w-3" /><span className="text-xs">{ca.clearFilters}</span>
              </Button>
            )}
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-3">
              {!searchQuery && (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Search className="h-12 w-12 mb-4 opacity-20" />
                  <p className="text-sm font-medium">{ca.enterSearchTerm}</p>
                  <p className="text-xs mt-1">{ca.searchDescription}</p>
                </div>
              )}
              {searchQuery && isLoading && (
                <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" /><span className="text-sm text-muted-foreground">{ca.searching}</span></div>
              )}
              {searchQuery && !isLoading && results.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <FileText className="h-12 w-12 mb-4 opacity-20" />
                  <p className="text-sm font-medium">{ca.noSearchResults}</p>
                  <p className="text-xs mt-1">{ca.noSearchResultsFor} "{searchQuery}"</p>
                </div>
              )}
              {searchQuery && !isLoading && results.length > 0 && (
                <>
                  <p className="text-xs text-muted-foreground">{results.length} {ca.resultsFor} "{searchQuery}"{isFetching && <Loader2 className="h-3 w-3 animate-spin inline ml-1" />}</p>
                  {results.map(r => <ResultCard key={r.id} result={r} query={searchQuery} />)}
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

export default function TranscriptSearchPage() {
  return <TranscriptSearchContent />;
}
