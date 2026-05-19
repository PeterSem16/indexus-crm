import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Search, FileText, AlertTriangle, Download, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Loader2, Phone, Megaphone, Filter, X, PhoneIncoming, PhoneOutgoing, PhoneMissed, Mic, MicOff, Brain, Calendar, UserCircle, Tag, BarChart3, SlidersHorizontal, ListChecks, ClipboardList, CheckCircle2, ShieldAlert, ClipboardCheck, Sparkles, Star, StarOff, Smartphone, XCircle, MessageSquare, Circle, CheckSquare, PackageOpen } from "lucide-react";
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
  mobileAgentName: string | null; mobileOutboundCallerId: string | null; isImportant: boolean;
  campaignContactId: string | null; answeredAt: string | null; endedAt: string | null;
  hungUpBy: string | null; inboundQueueId: string | null; inboundQueueName: string | null;
  dispositionCode: string | null; contactType: string | null; entityName: string | null;
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

function DonutChart({ value, max = 10, color, label, sub }: { value: number; max?: number; color: string; label: string; sub: string }) {
  const r = 36, c = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);
  return (
    <div className="flex flex-col items-center gap-2" data-testid={`donut-${label}`}>
      <div className="relative">
        <svg viewBox="0 0 100 100" className="w-[88px] h-[88px]">
          <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/25" />
          <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={`${pct * c} ${c}`} strokeLinecap="round" transform="rotate(-90 50 50)"
            style={{ filter: `drop-shadow(0 0 4px ${color}55)` }} />
          <text x="50" y="45" textAnchor="middle" fontSize="18" fontWeight="800" fill={color}>{value}</text>
          <text x="50" y="60" textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.5">/{max}</text>
        </svg>
      </div>
      <div className="text-center leading-tight">
        <div className="text-xs font-bold text-foreground">{label}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>
      </div>
    </div>
  );
}

const CL_SECTION_PALETTE = [
  { dot: "#6366f1", bg: "bg-indigo-50 dark:bg-indigo-950/20", text: "text-indigo-700 dark:text-indigo-300", pill: "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300" },
  { dot: "#8b5cf6", bg: "bg-violet-50 dark:bg-violet-950/20", text: "text-violet-700 dark:text-violet-300", pill: "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300" },
  { dot: "#10b981", bg: "bg-emerald-50 dark:bg-emerald-950/20", text: "text-emerald-700 dark:text-emerald-300", pill: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" },
  { dot: "#f59e0b", bg: "bg-amber-50 dark:bg-amber-950/20", text: "text-amber-700 dark:text-amber-300", pill: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" },
  { dot: "#0ea5e9", bg: "bg-sky-50 dark:bg-sky-950/20", text: "text-sky-700 dark:text-sky-300", pill: "bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300" },
];

function ChecklistResponsePanel({ sections, ca }: { sections: any[]; ca: Record<string, any> }) {
  const [filter, setFilter] = useState<"all" | "done" | "todo">("all");

  const allFlatItems: Array<{ item: any; secIdx: number; secTitle: string }> = sections.flatMap((sec, si) => {
    const items = [...(sec.items || []), ...(sec.subsections || []).flatMap((sub: any) => sub.items || [])];
    return items.map(item => ({ item, secIdx: si, secTitle: sec.title || "" }));
  });

  if (!allFlatItems.length) return null;

  const isDone = (item: any) => item.checked || item.answer === "yes" || (item.type === "text" && item.value?.trim());
  const doneCount = allFlatItems.filter(({ item }) => isDone(item)).length;
  const totalCount = allFlatItems.length;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const secStats = sections.map((sec, si) => {
    const items = [...(sec.items || []), ...(sec.subsections || []).flatMap((sub: any) => sub.items || [])];
    const done = items.filter(i => isDone(i)).length;
    return { title: sec.title || `Sekcia ${si + 1}`, done, total: items.length, idx: si };
  });

  const filtered = allFlatItems.filter(({ item }) => {
    if (filter === "done") return isDone(item);
    if (filter === "todo") return !isDone(item);
    return true;
  });

  return (
    <div className="bg-background border border-border rounded-xl overflow-hidden" data-testid="section-checklist-response">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
              <ClipboardCheck className="h-3 w-3 text-indigo-500" />
            </div>
            <span className="text-xs font-semibold">{ca.checklistLabel || "SOP Checklist"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-black" style={{ color: pct >= 70 ? "#10b981" : pct >= 40 ? "#f59e0b" : "#6366f1" }}>{pct}%</span>
            <span className="text-[10px] text-muted-foreground">{doneCount}/{totalCount}</span>
          </div>
        </div>
        {/* Section pills */}
        <div className="flex flex-wrap gap-1">
          {secStats.map((s, i) => {
            const pal = CL_SECTION_PALETTE[i % CL_SECTION_PALETTE.length];
            return (
              <span key={i} className={`text-[9px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${pal.pill}`}>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: pal.dot }} />
                {s.title}
                <span className="opacity-60">{s.done}/{s.total}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex border-b border-border">
        {([["all", `Všetky (${totalCount})`], ["done", `✓ Splnené (${doneCount})`], ["todo", `○ Čakajú (${totalCount - doneCount})`]] as const).map(([f, label]) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`flex-1 py-1.5 text-[10px] font-semibold transition-colors ${filter === f ? "bg-indigo-600 text-white" : "text-muted-foreground hover:bg-muted"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Items */}
      <div className="divide-y divide-border/60">
        {filtered.map(({ item, secIdx, secTitle }, idx) => {
          const pal = CL_SECTION_PALETTE[secIdx % CL_SECTION_PALETTE.length];
          const isChecked = item.checked || item.answer === "yes";
          const isNo = item.answer === "no";
          const hasText = item.type === "text" && item.value?.trim();
          return (
            <div key={idx} className={`flex items-start gap-2.5 px-3 py-2.5 ${isChecked ? "bg-emerald-50/40 dark:bg-emerald-950/10" : ""}`} data-testid={`cl-item-${secIdx}-${idx}`}>
              <span className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ background: pal.dot }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <span className={`text-xs leading-relaxed ${isNo ? "line-through text-muted-foreground" : "text-foreground"}`}>{item.label}</span>
                  {isChecked && (
                    <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500 text-white">
                      <CheckCircle2 className="h-2.5 w-2.5" />Splnené
                    </span>
                  )}
                  {isNo && (
                    <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
                      <XCircle className="h-2.5 w-2.5" />Nie
                    </span>
                  )}
                  {!isChecked && !isNo && hasText && (
                    <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                      <MessageSquare className="h-2.5 w-2.5" />Poznámka
                    </span>
                  )}
                </div>
                {hasText && (
                  <div className="mt-0.5 text-[10px] bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded italic inline-block">„{item.value}"</div>
                )}
                {item.note?.trim() && (
                  <div className="mt-0.5 text-[10px] text-muted-foreground italic">📝 {item.note}</div>
                )}
                {secTitle && <div className={`text-[9px] mt-0.5 font-medium ${pal.text}`}>{secTitle}</div>}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">Žiadne položky</div>
        )}
      </div>
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
        {log.isImportant && <span className="text-[9px] bg-amber-100 dark:bg-amber-900/30 text-amber-500 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Star className="h-2 w-2 fill-amber-400" /></span>}
        {rec?.qualityScore != null && <span className="text-[9px] bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full">★ {rec.qualityScore}</span>}
        {log.campaignName && <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full truncate max-w-[90px]">{log.campaignName}</span>}
      </div>
    </div>
  );
}

const SENTIMENT_SCORE: Record<string, number> = { positive: 9, neutral: 6, negative: 3, angry: 1 };
const SENTIMENT_COLOR: Record<string, string> = { positive: "#10b981", neutral: "#0ea5e9", negative: "#f59e0b", angry: "#ef4444" };

function AnalysisDetail({ log, ca, locale, searchText, onImportantToggle }: { log: CallLogEntry; ca: Record<string, any>; locale: string; searchText?: string; onImportantToggle?: (id: string, val: boolean) => void }) {
  const [tab, setTab] = useState<"analysis" | "transcript">("analysis");
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);
  const [isImportant, setIsImportant] = useState(log.isImportant);
  const [togglingImportant, setTogglingImportant] = useState(false);
  const toggleImportant = async () => {
    setTogglingImportant(true);
    const next = !isImportant;
    try {
      await fetch(`/api/call-logs/${log.id}/important`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isImportant: next }) });
      setIsImportant(next);
      onImportantToggle?.(log.id, next);
    } finally { setTogglingImportant(false); }
  };
  const rec = log.recording;
  const dateStr = new Date(log.startedAt || log.createdAt).toLocaleString(LOCALE_MAP[locale] || "en-US", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const sc = rec?.sentiment ? SENTIMENT_CFG[rec.sentiment] : null;
  const sentimentLabels: Record<string, string> = { positive: ca.positive, neutral: ca.neutral, negative: ca.negative, angry: ca.angry };
  const alerts = rec?.alertKeywords ?? [];
  const topics = rec?.keyTopics ?? [];
  const actionItems = rec?.actionItems ?? [];
  const sentScore = rec?.sentiment ? (SENTIMENT_SCORE[rec.sentiment] ?? 5) : null;
  const sentColor = rec?.sentiment ? (SENTIMENT_COLOR[rec.sentiment] ?? "#94a3b8") : "#94a3b8";
  const hasScores = rec?.qualityScore != null || rec?.scriptComplianceScore != null || sentScore != null;

  const { data: checklistData } = useQuery<{ sections: any[]; savedAt: string } | null>({
    queryKey: ["/api/call-logs", log.id, "checklist-response"],
    queryFn: async () => {
      const res = await fetch(`/api/call-logs/${log.id}/checklist-response`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!log.id,
  });

  const handleExport = (fmt: string) => { if (rec?.id) window.open(`/api/call-recordings/${rec.id}/export-transcript?format=${fmt}`, "_blank"); };

  return (
    <div className="flex flex-col h-full" data-testid={`analysis-detail-${log.id}`}>

      {/* ── Header ── */}
      <div className="px-5 pt-4 pb-3 border-b bg-background shrink-0 space-y-3">
        {/* Row 1: Identity + sentiment + star */}
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-base shrink-0 shadow-sm ${log.direction === "inbound" ? "bg-gradient-to-br from-emerald-400 to-emerald-600" : "bg-gradient-to-br from-sky-400 to-sky-600"}`}>
            {log.entityName ? <Tag className="h-5 w-5" /> : (log.customerName || log.phoneNumber)[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            {/* Name + phone */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold truncate">{log.entityName || log.customerName || log.phoneNumber}</span>
              {log.entityName && log.customerName && <span className="text-[10px] text-muted-foreground">({log.customerName})</span>}
              {log.customerName && !log.entityName && <span className="text-[10px] text-muted-foreground">{log.phoneNumber}</span>}
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${log.direction === "inbound" ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400"}`}>
                {log.direction === "inbound" ? <PhoneIncoming className="h-2.5 w-2.5" /> : <PhoneOutgoing className="h-2.5 w-2.5" />}
                {log.direction === "inbound" ? ca.inbound : ca.outbound}
              </span>
              {log.isMobile && <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400"><Smartphone className="h-2.5 w-2.5" />Connect</span>}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{dateStr}</div>
          </div>
          {/* Sentiment + star */}
          <div className="flex items-center gap-2 shrink-0">
            {sc && rec?.sentiment && (
              <div className={`px-3 py-1.5 rounded-xl ${sc.bg} text-center min-w-[60px]`} data-testid={`sentiment-badge-${log.id}`}>
                <div className={`text-xs font-bold ${sc.text}`}>{sentimentLabels[rec.sentiment] || rec.sentiment}</div>
                <div className="text-[9px] text-muted-foreground mt-0.5">{ca.sentiment}</div>
              </div>
            )}
            <button onClick={toggleImportant} disabled={togglingImportant}
              title={isImportant ? "Odznačiť ako dôležitý" : "Označiť ako dôležitý"}
              data-testid={`btn-important-${log.id}`}
              className={`p-2 rounded-xl transition-all ${isImportant ? "bg-amber-100 dark:bg-amber-900/30 text-amber-500 hover:bg-amber-200" : "text-muted-foreground hover:bg-muted hover:text-amber-500"}`}>
              {togglingImportant ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className={`h-4 w-4 ${isImportant ? "fill-amber-400 text-amber-500" : ""}`} />}
            </button>
          </div>
        </div>

        {/* Row 2: Campaign / Agent / Entity / Queue chips */}
        {(log.campaignName || rec?.agentName || log.mobileAgentName || log.entityName || log.inboundQueueName || log.contactType) && (
          <div className="flex flex-wrap gap-1.5">
            {log.campaignName && (
              <div className="flex items-center gap-1.5 bg-primary/8 dark:bg-primary/10 border border-primary/20 rounded-lg px-2.5 py-1">
                <Megaphone className="h-3 w-3 text-primary shrink-0" />
                <span className="text-[11px] font-medium text-primary truncate max-w-[180px]">{log.campaignName}</span>
              </div>
            )}
            {(rec?.agentName || log.mobileAgentName) && (
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1">
                <UserCircle className="h-3 w-3 text-slate-500 shrink-0" />
                <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">{rec?.agentName || log.mobileAgentName}</span>
              </div>
            )}
            {log.entityName && (
              <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 border ${log.contactType === "clinic" ? "bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-700" : "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-700"}`}>
                <Tag className={`h-3 w-3 shrink-0 ${log.contactType === "clinic" ? "text-teal-600 dark:text-teal-400" : "text-indigo-600 dark:text-indigo-400"}`} />
                <span className={`text-[11px] font-medium ${log.contactType === "clinic" ? "text-teal-700 dark:text-teal-300" : "text-indigo-700 dark:text-indigo-300"}`}>{log.entityName}</span>
                <span className={`text-[9px] ${log.contactType === "clinic" ? "text-teal-500" : "text-indigo-400"}`}>{log.contactType === "clinic" ? "Ambulancia" : "Nemocnica"}</span>
              </div>
            )}
            {log.inboundQueueName && (
              <div className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg px-2.5 py-1">
                <Phone className="h-3 w-3 text-orange-500 shrink-0" />
                <span className="text-[11px] font-medium text-orange-700 dark:text-orange-300">{log.inboundQueueName}</span>
              </div>
            )}
          </div>
        )}

        {/* Row 3: Timing breakdown */}
        {(() => {
          const ringS = log.answeredAt && log.startedAt ? Math.max(0, Math.round((new Date(log.answeredAt).getTime() - new Date(log.startedAt).getTime()) / 1000)) : null;
          const talkS = log.endedAt && log.answeredAt ? Math.max(0, Math.round((new Date(log.endedAt).getTime() - new Date(log.answeredAt).getTime()) / 1000)) : null;
          const totalS = log.durationSeconds;
          const hasAny = ringS != null || talkS != null || totalS;
          if (!hasAny) return null;
          return (
            <div className="flex items-center gap-2 flex-wrap">
              {ringS != null && (
                <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800 rounded-lg px-2.5 py-1.5 min-w-[80px]">
                  <div className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-800 flex items-center justify-center shrink-0">
                    <Phone className="h-2.5 w-2.5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <div className="text-[9px] text-muted-foreground leading-none">Čakanie</div>
                    <div className="text-[11px] font-bold text-amber-700 dark:text-amber-300 leading-tight">{formatDuration(ringS)}</div>
                  </div>
                </div>
              )}
              {talkS != null && (
                <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-800 rounded-lg px-2.5 py-1.5 min-w-[80px]">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-800 flex items-center justify-center shrink-0">
                    <Mic className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-[9px] text-muted-foreground leading-none">Rozhovor</div>
                    <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 leading-tight">{formatDuration(talkS)}</div>
                  </div>
                </div>
              )}
              {totalS != null && totalS > 0 && (
                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 min-w-[80px]">
                  <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                    <BarChart3 className="h-2.5 w-2.5 text-slate-500" />
                  </div>
                  <div>
                    <div className="text-[9px] text-muted-foreground leading-none">Celkovo</div>
                    <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 leading-tight">{formatDuration(totalS)}</div>
                  </div>
                </div>
              )}
              {log.hungUpBy && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground ml-1">
                  <XCircle className="h-3 w-3 text-destructive/60" />
                  <span>Zavesil: <span className="font-medium text-foreground">{log.hungUpBy === "customer" ? "Zákazník" : log.hungUpBy === "user" ? "Agent" : log.hungUpBy}</span></span>
                </div>
              )}
            </div>
          );
        })()}

        {/* Row 4: Disposition */}
        {log.dispositionCode && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 rounded-lg px-3 py-1.5">
              <ClipboardCheck className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
              <div>
                <div className="text-[9px] text-violet-500 dark:text-violet-400 leading-none">Výsledok hovoru</div>
                <div className="text-[11px] font-bold text-violet-700 dark:text-violet-300 leading-tight">{log.dispositionCode}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Player strip + Checklist (below header) ── */}
      <div className="px-5 pt-3 pb-2 border-b border-border shrink-0">
        {/* Player strip (Variant B style) */}
        {log.hasRecording ? (
          <div className="rounded-xl border border-border overflow-hidden" data-testid={`player-${log.id}`}>
            <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-violet-500 shadow-sm" style={{ boxShadow: "0 0 5px #8b5cf688" }} />
                  <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400">{rec?.agentName || ca.agent || "Agent"}</span>
                </div>
                <div className="w-px h-3 bg-border" />
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm" style={{ boxShadow: "0 0 5px #10b98188" }} />
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">{log.customerName || ca.customer || "Zákazník"}</span>
                </div>
              </div>
              <span className="text-[9px] text-muted-foreground">{formatDuration(log.durationSeconds)}</span>
            </div>
            <div className="px-3 py-2 bg-background">
              <CallRecordingPlayer
                callLogId={log.id}
                compact
                onTimeUpdate={setPlaybackState}
                agentLabel={rec?.agentName || ca.agent}
                customerLabel={log.customerName || ca.customer}
              />
            </div>
          </div>
        ) : (
          <div className="mt-3 bg-muted/30 rounded-xl border border-dashed border-border px-3 py-2.5 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <MicOff className="h-3.5 w-3.5" />{ca.withoutRecording}
          </div>
        )}

        {/* ── SOP Checklist (shown regardless of analysis status) ── */}
        {checklistData?.sections && checklistData.sections.length > 0 && (
          <div className="pt-3">
            <ChecklistResponsePanel sections={checklistData.sections} ca={ca} />
          </div>
        )}
      </div>

      {/* ── Tabs + content ── */}
      {rec && rec.analysisStatus === "completed" ? (
        <>
          <div className="px-5 pt-3 shrink-0">
            <div className="flex gap-0 border border-border rounded-xl overflow-hidden w-fit bg-background">
              {(["analysis", "transcript"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} data-testid={`tab-${t}-${log.id}`}
                  className={`px-4 py-1.5 text-xs font-medium transition-colors ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                  {t === "analysis"
                    ? <span className="flex items-center gap-1.5"><Brain className="h-3 w-3" />{ca.callAnalysis || "AI Analýza"}</span>
                    : <span className="flex items-center gap-1.5"><FileText className="h-3 w-3" />{ca.showTranscript || "Prepis"}</span>}
                </button>
              ))}
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="px-5 py-4 space-y-3 pb-6">
              {tab === "analysis" && (
                <>
                  {/* ── Donut score charts ── */}
                  {hasScores && (
                    <div className="bg-gradient-to-br from-background to-muted/30 border border-border rounded-xl p-4" data-testid={`section-scores-${log.id}`}>
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">{ca.callAnalysis || "Výsledky analýzy"}</div>
                      <div className="flex justify-around items-center">
                        {rec.qualityScore != null && (
                          <DonutChart value={rec.qualityScore} color="#6366f1" label={ca.quality || "Kvalita"} sub="Quality Score" />
                        )}
                        {rec.scriptComplianceScore != null && (
                          <DonutChart value={rec.scriptComplianceScore} color="#10b981" label={ca.script || "Skript"} sub="Script Score" />
                        )}
                        {sentScore != null && rec.sentiment && (
                          <DonutChart value={sentScore} color={sentColor} label={ca.customerLabel || "Zákazník"} sub={sentimentLabels[rec.sentiment] || rec.sentiment} />
                        )}
                      </div>
                      {/* Score bars below donuts */}
                      <div className="mt-4 space-y-2 border-t border-border pt-3">
                        {rec.qualityScore != null && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground w-16 shrink-0">{ca.quality || "Kvalita"}</span>
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${(rec.qualityScore / 10) * 100}%` }} />
                            </div>
                            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 w-6 text-right">{rec.qualityScore}</span>
                          </div>
                        )}
                        {rec.scriptComplianceScore != null && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground w-16 shrink-0">{ca.script || "Skript"}</span>
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(rec.scriptComplianceScore / 10) * 100}%` }} />
                            </div>
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 w-6 text-right">{rec.scriptComplianceScore}</span>
                          </div>
                        )}
                        {sentScore != null && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground w-16 shrink-0">{ca.customerLabel || "Zákazník"}</span>
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${(sentScore / 10) * 100}%`, backgroundColor: sentColor }} />
                            </div>
                            <span className="text-[10px] font-bold w-6 text-right" style={{ color: sentColor }}>{sentScore}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── Alert keywords ── */}
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

                  {/* ── AI Summary ── */}
                  {rec.summary && (
                    <div className="bg-background border border-border rounded-xl p-4" data-testid={`section-summary-${log.id}`}>
                      <div className="flex items-center gap-2 mb-2.5">
                        <div className="w-5 h-5 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center shrink-0">
                          <Brain className="h-3 w-3 text-purple-500" />
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground">{ca.summaryLabel || "AI Zhrnutie"}</span>
                      </div>
                      <p className="text-sm leading-relaxed text-foreground">{rec.summary}</p>
                    </div>
                  )}

                  {/* ── Script compliance detail ── */}
                  {rec.scriptComplianceDetails && (
                    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-xl p-4" data-testid={`section-script-${log.id}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <ClipboardCheck className="h-4 w-4 text-blue-500" />
                        <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">{ca.scriptComplianceLabel || "Dodržanie skriptu"}</span>
                      </div>
                      <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">{rec.scriptComplianceDetails}</p>
                    </div>
                  )}

                  {/* ── Topics ── */}
                  {topics.length > 0 && (
                    <div className="bg-background border border-border rounded-xl p-3.5" data-testid={`section-topics-${log.id}`}>
                      <div className="flex items-center gap-1.5 mb-2.5">
                        <Tag className="h-3.5 w-3.5 text-indigo-500" />
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{ca.topicsLabel || "Kľúčové témy"}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {topics.map((t, i) => (
                          <Badge key={i} variant="outline" className="text-xs bg-primary/5 border-primary/20" data-testid={`badge-topic-${log.id}-${i}`}>{t}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Action items (Úlohy) ── */}
                  {actionItems.length > 0 && (
                    <div className="bg-background border border-border rounded-xl p-4" data-testid={`section-actions-${log.id}`}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-5 h-5 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                          <ListChecks className="h-3 w-3 text-emerald-500" />
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground">{ca.actionItemsLabel || "Úlohy na splnenie"}</span>
                        <span className="ml-auto text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full">{actionItems.length}</span>
                      </div>
                      <ul className="space-y-2">
                        {actionItems.map((item, i) => (
                          <li key={i} className="flex items-start gap-2.5 group" data-testid={`action-item-${log.id}-${i}`}>
                            <div className="w-5 h-5 rounded-md bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                              <CheckSquare className="h-3 w-3 text-emerald-500" />
                            </div>
                            <span className="text-xs text-foreground leading-relaxed flex-1">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* ── Compliance notes ── */}
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
  const [browseImportantFilter, setBrowseImportantFilter] = useState(false);
  const [showBulkDownload, setShowBulkDownload] = useState(false);
  const [bdDateFrom, setBdDateFrom] = useState(toDateStr(new Date()));
  const [bdDateTo, setBdDateTo] = useState(toDateStr(new Date()));
  const [bdTimeFrom, setBdTimeFrom] = useState("");
  const [bdTimeTo, setBdTimeTo] = useState("");
  const [bdCampaign, setBdCampaign] = useState("");
  const [bdAgent, setBdAgent] = useState("");
  const [bdDirection, setBdDirection] = useState("");
  const [bdImportantOnly, setBdImportantOnly] = useState(false);
  const [bdDownloading, setBdDownloading] = useState(false);
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
  const uniqueAgentUsers = useMemo(() => { const m = new Map<string, string>(); callLogs.forEach(l => { const name = (l.recording as any)?.agentName || l.mobileAgentName; if (l.userId && name) m.set(l.userId, name); }); return Array.from(m.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)); }, [callLogs]);
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
    if (browseImportantFilter) f = f.filter(l => l.isImportant);
    return f;
  }, [callLogs, selectedDate, browseSearchText, browseCampaignFilter, browseDirectionFilter, browseQueueFilter, browseStatusFilter, browseRecordingFilter, browseSentimentFilter, browseAgentFilter, browseHasAlertsFilter, browseMobileFilter, browseMinQuality, browseImportantFilter]);

  const stats = useMemo(() => {
    const all = filteredCallLogs;
    const completed = all.filter(l => l.status === "completed").length;
    const withAlerts = all.filter(l => l.recording?.alertKeywords && l.recording.alertKeywords.length > 0).length;
    const qScores = all.filter(l => l.recording?.qualityScore != null).map(l => l.recording!.qualityScore!);
    const avgQ = qScores.length ? (qScores.reduce((a, b) => a + b, 0) / qScores.length).toFixed(1) : null;
    return { total: all.length, completed, withAlerts, avgQ };
  }, [filteredCallLogs]);

  const activeFilterCount = [browseCampaignFilter, browseDirectionFilter, browseStatusFilter, browseRecordingFilter, browseSentimentFilter, browseAgentFilter, browseHasAlertsFilter ? "y" : "", browseMobileFilter ? "y" : "", browseMinQuality, browseQueueFilter, browseImportantFilter ? "y" : ""].filter(Boolean).length;

  const clearFilters = () => { setBrowseCampaignFilter(""); setBrowseDirectionFilter(""); setBrowseStatusFilter(""); setBrowseRecordingFilter(""); setBrowseSentimentFilter(""); setBrowseAgentFilter(""); setBrowseHasAlertsFilter(false); setBrowseMobileFilter(false); setBrowseMinQuality(""); setBrowseQueueFilter(""); setBrowseImportantFilter(false); };

  const handleBulkDownload = async () => {
    setBdDownloading(true);
    try {
      const res = await fetch("/api/call-recordings/bulk-download", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importantOnly: bdImportantOnly, dateFrom: bdDateFrom || undefined, dateTo: bdDateTo || undefined, timeFrom: bdTimeFrom || undefined, timeTo: bdTimeTo || undefined, campaignId: bdCampaign || undefined, agentId: bdAgent || undefined, direction: bdDirection || undefined }),
      });
      if (!res.ok) { const e = await res.json(); alert(e.error || "Chyba pri sťahovaní"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `hovory_${Date.now()}.zip`; a.click();
      URL.revokeObjectURL(url);
      setShowBulkDownload(false);
    } finally { setBdDownloading(false); }
  };

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
              <button onClick={() => setShowBulkDownload(true)} data-testid="btn-bulk-download"
                className="ml-1 flex items-center gap-1 px-2 py-1 rounded-lg border border-border text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                <PackageOpen className="h-3 w-3" />Hromadné stiahnutie
              </button>
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
                      <label className="flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400 cursor-pointer font-medium">
                        <input type="checkbox" checked={browseImportantFilter} onChange={e => setBrowseImportantFilter(e.target.checked)} className="h-3 w-3 accent-amber-500" data-testid="checkbox-important-filter" />
                        <Star className="h-3 w-3 fill-amber-400" />
                        Dôležité
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
              ? <AnalysisDetail key={selectedLog.id} log={selectedLog} ca={ca} locale={locale} searchText={browseSearchText} onImportantToggle={(id, val) => { /* optimistic update handled inside */ }} />
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

      {/* ── Bulk Download Modal ── */}
      <Dialog open={showBulkDownload} onOpenChange={setShowBulkDownload}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><PackageOpen className="h-5 w-5 text-primary" />Hromadné stiahnutie nahrávok</DialogTitle>
            <DialogDescription className="text-xs">Stiahni nahrávky ako ZIP archív (max. 200 hovorov). Filtre sú voliteľné.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Dátum od</label>
                <Input type="date" value={bdDateFrom} onChange={e => setBdDateFrom(e.target.value)} className="h-8 text-xs" data-testid="input-bd-date-from" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Dátum do</label>
                <Input type="date" value={bdDateTo} onChange={e => setBdDateTo(e.target.value)} className="h-8 text-xs" data-testid="input-bd-date-to" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Čas od</label>
                <Input type="time" value={bdTimeFrom} onChange={e => setBdTimeFrom(e.target.value)} className="h-8 text-xs" data-testid="input-bd-time-from" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Čas do</label>
                <Input type="time" value={bdTimeTo} onChange={e => setBdTimeTo(e.target.value)} className="h-8 text-xs" data-testid="input-bd-time-to" />
              </div>
            </div>
            {campaignsList.length > 0 && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Kampaň</label>
                <Select value={bdCampaign || "all"} onValueChange={v => setBdCampaign(v === "all" ? "" : v)}>
                  <SelectTrigger className="h-8 text-xs" data-testid="select-bd-campaign"><SelectValue placeholder="Všetky kampane" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Všetky kampane</SelectItem>
                    {campaignsList.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {uniqueAgentUsers.length > 0 && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Agent</label>
                <Select value={bdAgent || "all"} onValueChange={v => setBdAgent(v === "all" ? "" : v)}>
                  <SelectTrigger className="h-8 text-xs" data-testid="select-bd-agent"><SelectValue placeholder="Všetci agenti" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Všetci agenti</SelectItem>
                    {uniqueAgentUsers.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Smer hovoru</label>
              <Select value={bdDirection || "all"} onValueChange={v => setBdDirection(v === "all" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs" data-testid="select-bd-direction"><SelectValue placeholder="Všetky smery" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Všetky smery</SelectItem>
                  <SelectItem value="inbound">Príchodzí</SelectItem>
                  <SelectItem value="outbound">Odchodzí</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
              <input type="checkbox" checked={bdImportantOnly} onChange={e => setBdImportantOnly(e.target.checked)} className="h-3.5 w-3.5 accent-amber-500" data-testid="checkbox-bd-important" />
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
              <span className="text-amber-600 dark:text-amber-400 font-medium">Iba dôležité hovory</span>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setShowBulkDownload(false)}>Zrušiť</Button>
            <Button size="sm" onClick={handleBulkDownload} disabled={bdDownloading} data-testid="btn-bd-download" className="gap-1.5">
              {bdDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {bdDownloading ? "Sťahujem…" : "Stiahnuť ZIP"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function TranscriptSearchPage() {
  return <TranscriptSearchContent />;
}
