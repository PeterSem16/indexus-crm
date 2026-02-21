import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Search, FileText, Star, AlertTriangle, Download, ChevronDown, ChevronUp, Loader2, Phone, User, Megaphone, Clock, Filter, X, PhoneIncoming, PhoneOutgoing, PhoneMissed, Mic, MicOff, Brain, List, Calendar, UserCircle, Activity, Tag, BarChart3, SlidersHorizontal, ListChecks, ClipboardList, ShieldCheck, CheckCircle2, ShieldAlert, ClipboardCheck, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useI18n } from "@/i18n";
import { CallRecordingPlayer, type PlaybackState } from "@/components/call-recording-player";

const LOCALE_MAP: Record<string, string> = { en: 'en-US', sk: 'sk-SK', cs: 'cs-CZ', hu: 'hu-HU', ro: 'ro-RO', it: 'it-IT', de: 'de-DE' };

interface TranscriptResult {
  id: string;
  callLogId: string;
  customerId: string | null;
  customerName: string | null;
  agentName: string | null;
  campaignName: string | null;
  phoneNumber: string | null;
  durationSeconds: number | null;
  sentiment: string | null;
  qualityScore: number | null;
  scriptComplianceScore: number | null;
  summary: string | null;
  alertKeywords: string[] | null;
  keyTopics: string[] | null;
  actionItems: string[] | null;
  complianceNotes: string | null;
  scriptComplianceDetails: string | null;
  transcriptionText: string;
  createdAt: string;
}

interface CallLogEntry {
  id: string;
  userId: string;
  customerId: string | null;
  campaignId: string | null;
  phoneNumber: string;
  direction: string;
  status: string;
  startedAt: string;
  durationSeconds: number | null;
  notes: string | null;
  createdAt: string;
  customerName: string | null;
  campaignName: string | null;
  hasRecording: boolean;
  recording: {
    id: string;
    analysisStatus: string | null;
    transcriptionText: string | null;
    sentiment: string | null;
    qualityScore: number | null;
    scriptComplianceScore: number | null;
    summary: string | null;
    alertKeywords: string[] | null;
    keyTopics: string[] | null;
    actionItems: string[] | null;
    complianceNotes: string | null;
    scriptComplianceDetails: string | null;
    customerName: string | null;
    agentName: string | null;
    campaignName: string | null;
  } | null;
}

interface CampaignBasic {
  id: string;
  name: string;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "\u2014";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function highlightText(text: string, query: string): JSX.Element {
  if (!query.trim()) return <span>{text}</span>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded-sm font-medium">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
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
        if (chunk.length >= 80) {
          segments.push(chunk.trim());
          chunk = "";
        }
      }
      if (chunk.trim()) segments.push(chunk.trim());
    } else if (line.length > 150) {
      const words = line.split(/\s+/);
      let chunk = "";
      for (const w of words) {
        if (chunk.length + w.length > 100 && chunk.length > 0) {
          segments.push(chunk.trim());
          chunk = "";
        }
        chunk += (chunk ? " " : "") + w;
      }
      if (chunk.trim()) segments.push(chunk.trim());
    } else {
      segments.push(line);
    }
  }
  return segments.length > 0 ? segments : [text];
}

function TranscriptWithPlayback({ text, searchText, playback }: { text: string; searchText?: string; playback?: PlaybackState | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLSpanElement>(null);

  const segments = useMemo(() => splitIntoSegments(text), [text]);

  const activeLineIdx = useMemo(() => {
    if (!playback || playback.duration <= 0 || playback.currentTime <= 0) return -1;
    const progress = Math.min(playback.currentTime / playback.duration, 1);
    return Math.min(Math.floor(progress * segments.length), segments.length - 1);
  }, [playback?.currentTime, playback?.duration, segments.length]);

  useEffect(() => {
    if (activeLineRef.current && activeLineIdx >= 0) {
      activeLineRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeLineIdx]);

  const renderSegment = (segment: string, idx: number) => {
    const isActive = idx === activeLineIdx;
    const isPast = activeLineIdx >= 0 && idx < activeLineIdx;
    const content = searchText ? highlightText(segment, searchText) : <span>{segment}</span>;
    return (
      <span
        key={idx}
        ref={isActive ? activeLineRef : undefined}
        className={`block py-0.5 px-1.5 rounded-sm transition-colors duration-200 ${isActive ? "bg-primary/15 border-l-2 border-primary font-medium" : isPast ? "text-muted-foreground" : ""}`}
        data-testid={`transcript-line-${idx}`}
      >
        {content}
      </span>
    );
  };

  return (
    <div ref={containerRef} className="bg-muted/40 rounded-md p-2">
      <div className="text-xs leading-relaxed">
        {segments.map(renderSegment)}
      </div>
    </div>
  );
}

function getSnippet(text: string, query: string, maxLen = 300): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return text.substring(0, maxLen) + (text.length > maxLen ? "..." : "");
  const start = Math.max(0, idx - 100);
  const end = Math.min(text.length, idx + query.length + 200);
  let snippet = text.substring(start, end);
  if (start > 0) snippet = "..." + snippet;
  if (end < text.length) snippet = snippet + "...";
  return snippet;
}

function SentimentBadge({ sentiment, labels }: { sentiment: string | null; labels?: Record<string, string> }) {
  if (!sentiment) return null;
  const config: Record<string, { cls: string }> = {
    positive: { cls: "text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-950/40" },
    neutral: { cls: "text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-950/40" },
    negative: { cls: "text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-950/40" },
    angry: { cls: "text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-950/40" },
  };
  const c = config[sentiment] || config.neutral;
  const label = labels?.[sentiment] || sentiment.charAt(0).toUpperCase() + sentiment.slice(1);
  return <Badge variant="secondary" className={`text-[10px] ${c.cls}`}>{label}</Badge>;
}

function ScoreBadge({ score, label }: { score: number | null; label: string }) {
  if (!score) return null;
  const color = score >= 8 ? "text-green-600 dark:text-green-400" : score >= 5 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400";
  return (
    <Badge variant="secondary" className="text-[10px] gap-1">
      <Star className={`h-2.5 w-2.5 ${color}`} />
      <span className={color}>{score}/10</span>
      <span className="text-muted-foreground ml-0.5">{label}</span>
    </Badge>
  );
}

function DirectionIcon({ direction, status }: { direction: string; status: string }) {
  if (status === "failed" || status === "no_answer" || status === "busy") {
    return <PhoneMissed className="h-4 w-4 text-destructive" />;
  }
  if (direction === "inbound") {
    return <PhoneIncoming className="h-4 w-4 text-green-600 dark:text-green-400" />;
  }
  return <PhoneOutgoing className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
}

function StatusBadge({ status, labels }: { status: string; labels?: Record<string, string> }) {
  const config: Record<string, { cls: string }> = {
    completed: { cls: "text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-950/40" },
    failed: { cls: "text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-950/40" },
    no_answer: { cls: "text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-950/40" },
    busy: { cls: "text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-950/40" },
    cancelled: { cls: "text-muted-foreground bg-muted" },
    initiated: { cls: "text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-950/40" },
    ringing: { cls: "text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-950/40" },
    answered: { cls: "text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-950/40" },
  };
  const c = config[status] || { cls: "text-muted-foreground bg-muted" };
  const label = labels?.[status] || status;
  return <Badge variant="secondary" className={`text-[10px] ${c.cls}`}>{label}</Badge>;
}

function CallAnalysisDialogContent({ recording, callId, ca, sentimentLabels }: { 
  recording: { id?: string; sentiment: string | null; qualityScore: number | null; scriptComplianceScore: number | null; summary: string | null; alertKeywords: string[] | null; keyTopics: string[] | null; actionItems: string[] | null; complianceNotes: string | null; scriptComplianceDetails: string | null; transcriptionText: string | null };
  callId: string; 
  ca: Record<string, any>;
  sentimentLabels: Record<string, string>;
}) {
  const [showTranscript, setShowTranscript] = useState(false);
  const sentimentConfig: Record<string, { cls: string; bg: string; icon: string }> = {
    positive: { cls: "text-green-700 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/30", icon: "text-green-500" },
    neutral: { cls: "text-blue-700 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/30", icon: "text-blue-500" },
    negative: { cls: "text-orange-700 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/30", icon: "text-orange-500" },
    angry: { cls: "text-red-700 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/30", icon: "text-red-500" },
  };
  const sentiment = recording.sentiment ?? "neutral";
  const sc = sentimentConfig[sentiment] || sentimentConfig.neutral;
  const qScore = recording.qualityScore ?? 0;
  const sScore = recording.scriptComplianceScore ?? 0;
  const qualityColor = qScore >= 8 ? "text-green-600 dark:text-green-400" : qScore >= 5 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400";
  const qualityBg = qScore >= 8 ? "bg-green-50 dark:bg-green-950/30" : qScore >= 5 ? "bg-yellow-50 dark:bg-yellow-950/30" : "bg-red-50 dark:bg-red-950/30";
  const qualityIcon = qScore >= 8 ? "text-green-500" : qScore >= 5 ? "text-yellow-500" : "text-red-500";
  const scriptColor = sScore >= 8 ? "text-green-600 dark:text-green-400" : sScore >= 5 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400";
  const scriptBg = sScore >= 8 ? "bg-green-50 dark:bg-green-950/30" : sScore >= 5 ? "bg-yellow-50 dark:bg-yellow-950/30" : "bg-red-50 dark:bg-red-950/30";
  const scriptIcon = sScore >= 8 ? "text-green-500" : sScore >= 5 ? "text-yellow-500" : "text-red-500";
  const alerts = recording.alertKeywords ?? [];
  const topics = recording.keyTopics ?? [];
  const actionItems = recording.actionItems ?? [];

  const handleExport = (format: string) => {
    if (recording.id) {
      window.open(`/api/call-recordings/${recording.id}/export-transcript?format=${format}`, "_blank");
    }
  };

  return (
    <div className="space-y-3" data-testid={`call-analysis-dialog-${callId}`}>
      <div className="grid grid-cols-3 gap-2">
        <div className={`rounded-md p-3 text-center ${sc.bg}`}>
          <Sparkles className={`h-5 w-5 mx-auto mb-1 ${sc.icon}`} />
          <div className={`text-sm font-semibold ${sc.cls}`}>{sentimentLabels[sentiment] || sentiment}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{ca.sentiment || "Sentiment"}</div>
        </div>
        {recording.qualityScore != null && (
          <div className={`rounded-md p-3 text-center ${qualityBg}`}>
            <Star className={`h-5 w-5 mx-auto mb-1 ${qualityIcon}`} />
            <div className={`text-lg font-bold ${qualityColor}`}>{recording.qualityScore}/10</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{ca.quality || "Quality"}</div>
          </div>
        )}
        {recording.scriptComplianceScore != null && (
          <div className={`rounded-md p-3 text-center ${scriptBg}`}>
            <ClipboardCheck className={`h-5 w-5 mx-auto mb-1 ${scriptIcon}`} />
            <div className={`text-lg font-bold ${scriptColor}`}>{recording.scriptComplianceScore}/10</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{ca.script || "Script"}</div>
          </div>
        )}
      </div>

      {alerts.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950/30 rounded-md p-3" data-testid={`section-alerts-${callId}`}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <ShieldAlert className="h-4 w-4 text-red-500" />
            <span className="text-sm font-medium text-red-700 dark:text-red-400">{ca.alerts || "Alerts"}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {alerts.map((alert, i) => (
              <Badge key={i} variant="destructive" className="text-xs" data-testid={`badge-alert-${callId}-${i}`}>{alert}</Badge>
            ))}
          </div>
        </div>
      )}

      {recording.summary && (
        <div className="bg-muted/40 rounded-md p-3" data-testid={`section-summary-${callId}`}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Brain className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium">{ca.summaryLabel || "Summary"}</span>
          </div>
          <p className="text-sm text-foreground leading-relaxed">{recording.summary}</p>
        </div>
      )}

      {recording.scriptComplianceDetails && (
        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-md p-3" data-testid={`section-script-compliance-${callId}`}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <ClipboardCheck className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-400">{ca.scriptComplianceLabel || "Script Compliance"}</span>
          </div>
          <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">{recording.scriptComplianceDetails}</p>
        </div>
      )}

      {topics.length > 0 && (
        <div className="bg-muted/40 rounded-md p-3" data-testid={`section-topics-${callId}`}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Tag className="h-4 w-4 text-indigo-500" />
            <span className="text-sm font-medium">{ca.topicsLabel || "Topics"}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {topics.map((topic, i) => (
              <Badge key={i} variant="outline" className="text-xs" data-testid={`badge-topic-${callId}-${i}`}>{topic}</Badge>
            ))}
          </div>
        </div>
      )}

      {actionItems.length > 0 && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-md p-3" data-testid={`section-action-items-${callId}`}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <ListChecks className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{ca.actionItemsLabel || "Action Items"}</span>
          </div>
          <ul className="space-y-1">
            {actionItems.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm" data-testid={`text-action-item-${callId}-${i}`}>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                <span className="text-emerald-700 dark:text-emerald-300">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {recording.complianceNotes && (
        <div className="bg-orange-50 dark:bg-orange-950/30 rounded-md p-3" data-testid={`section-compliance-${callId}`}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-medium text-orange-700 dark:text-orange-400">{ca.complianceLabel || "Compliance"}</span>
          </div>
          <p className="text-sm text-orange-700 dark:text-orange-300 leading-relaxed">{recording.complianceNotes}</p>
        </div>
      )}

      {recording.transcriptionText && (
        <div>
          <div className="flex items-center gap-1 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 justify-start gap-1.5 h-8"
              onClick={() => setShowTranscript(!showTranscript)}
              data-testid={`btn-toggle-transcript-${callId}`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="text-xs">{showTranscript ? (ca.hideTranscript || "Hide transcript") : (ca.showTranscript || "Show transcript")}</span>
              {showTranscript ? <ChevronUp className="h-3.5 w-3.5 ml-auto" /> : <ChevronDown className="h-3.5 w-3.5 ml-auto" />}
            </Button>
            {recording.id && (
              <>
                <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={() => handleExport("txt")} data-testid={`btn-export-txt-${callId}`}>
                  <Download className="h-3 w-3" />
                  <span className="text-xs">TXT</span>
                </Button>
                <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={() => handleExport("json")} data-testid={`btn-export-json-${callId}`}>
                  <Download className="h-3 w-3" />
                  <span className="text-xs">JSON</span>
                </Button>
              </>
            )}
          </div>
          {showTranscript && (
            <ScrollArea className="max-h-[250px] mt-1">
              <TranscriptWithPlayback text={recording.transcriptionText} />
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
}

function CallLogCard({ log, searchText }: { log: CallLogEntry; searchText?: string }) {
  const { t, locale } = useI18n();
  const ca = t.callAnalysis;
  const [expanded, setExpanded] = useState(false);
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);
  const dateStr = new Date(log.startedAt || log.createdAt).toLocaleString(LOCALE_MAP[locale] || 'en-US', {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const rec = log.recording;
  const hasTranscription = rec?.transcriptionText;

  const statusLabels: Record<string, string> = {
    completed: ca.statusCompleted, failed: ca.statusFailed, no_answer: ca.statusNoAnswer,
    busy: ca.statusBusy, cancelled: ca.statusCancelled, initiated: ca.statusInitiated,
    ringing: ca.statusRinging, answered: ca.statusAnswered,
  };

  const sentimentLabels: Record<string, string> = {
    positive: ca.positive, neutral: ca.neutral, negative: ca.negative, angry: ca.angry,
  };

  return (
    <Card className="p-3" data-testid={`call-log-${log.id}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <DirectionIcon direction={log.direction} status={log.status} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-medium flex items-center gap-1">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              {log.phoneNumber}
            </span>
            {log.customerName && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" />
                {log.customerName}
              </span>
            )}
            {log.campaignName && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Megaphone className="h-2.5 w-2.5" />
                {log.campaignName}
              </Badge>
            )}
            {rec?.agentName && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <UserCircle className="h-3 w-3" />
                {rec.agentName}
              </span>
            )}
            <StatusBadge status={log.status} labels={statusLabels} />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {dateStr}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {formatDuration(log.durationSeconds)}
            </span>
            {log.hasRecording ? (
              <Badge variant="secondary" className="text-[10px] gap-1 text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-950/40">
                <Mic className="h-2.5 w-2.5" />
                {ca.withRecording}
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px] gap-1 text-muted-foreground">
                <MicOff className="h-2.5 w-2.5" />
                {ca.withoutRecording}
              </Badge>
            )}
            {rec?.analysisStatus === "completed" && (
              <Badge variant="secondary" className="text-[10px] gap-1 text-purple-700 dark:text-purple-400 bg-purple-100 dark:bg-purple-950/40">
                <Brain className="h-2.5 w-2.5" />
                {ca.analyzed}
              </Badge>
            )}
            {rec?.analysisStatus === "processing" && (
              <Badge variant="secondary" className="text-[10px] gap-1 text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-950/40">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                {ca.processing}
              </Badge>
            )}
          </div>

          {log.hasRecording && (
            <CallRecordingPlayer callLogId={log.id} compact onTimeUpdate={setPlaybackState} />
          )}

          {rec && rec.analysisStatus === "completed" && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <SentimentBadge sentiment={rec.sentiment} labels={sentimentLabels} />
                <ScoreBadge score={rec.qualityScore} label={ca.quality} />
                <ScoreBadge score={rec.scriptComplianceScore} label={ca.script} />
                {rec.alertKeywords && rec.alertKeywords.length > 0 && (
                  <Badge variant="destructive" className="text-[10px] gap-1">
                    <AlertTriangle className="h-2.5 w-2.5" />
                    {rec.alertKeywords.length}
                  </Badge>
                )}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="icon" variant="ghost" data-testid={`btn-analysis-${log.id}`}>
                      <Brain className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        {ca.callAnalysis}
                      </DialogTitle>
                      <DialogDescription className="sr-only">{ca.callAnalysis}</DialogDescription>
                    </DialogHeader>
                    <CallAnalysisDialogContent recording={rec} callId={log.id} ca={ca} sentimentLabels={sentimentLabels} />
                  </DialogContent>
                </Dialog>
              </div>
              {hasTranscription && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1"
                    onClick={() => setExpanded(!expanded)}
                    data-testid={`btn-expand-transcript-${log.id}`}
                  >
                    {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    <span className="text-[11px]">{expanded ? ca.hideTranscript : ca.showTranscript}</span>
                  </Button>
                  {expanded && (
                    <ScrollArea className="max-h-[250px]">
                      <TranscriptWithPlayback text={rec.transcriptionText!} searchText={searchText} playback={playbackState} />
                    </ScrollArea>
                  )}
                </>
              )}
            </div>
          )}

          {log.notes && (
            <p className="text-xs text-muted-foreground mt-1 italic">{log.notes}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

function ResultCard({ result, query }: { result: TranscriptResult; query: string }) {
  const { t, locale } = useI18n();
  const ca = t.callAnalysis;
  const [expanded, setExpanded] = useState(false);
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);

  const handleExport = (format: string) => {
    window.open(`/api/call-recordings/${result.id}/export-transcript?format=${format}`, "_blank");
  };

  const snippet = getSnippet(result.transcriptionText, query);
  const dateStr = new Date(result.createdAt).toLocaleString(LOCALE_MAP[locale] || 'en-US', {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const sentimentLabels: Record<string, string> = {
    positive: ca.positive, neutral: ca.neutral, negative: ca.negative, angry: ca.angry,
  };

  return (
    <Card className="p-3" data-testid={`transcript-result-${result.id}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            {result.customerName && (
              <span className="text-sm font-medium flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                {result.customerName}
              </span>
            )}
            {result.phoneNumber && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {result.phoneNumber}
              </span>
            )}
            {result.agentName && (
              <Badge variant="outline" className="text-[10px]">{result.agentName}</Badge>
            )}
            {result.campaignName && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Megaphone className="h-2.5 w-2.5" />
                {result.campaignName}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap mb-2">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {dateStr}
            </span>
            <span className="text-[10px] text-muted-foreground">{formatDuration(result.durationSeconds)}</span>
            <SentimentBadge sentiment={result.sentiment} labels={sentimentLabels} />
            <ScoreBadge score={result.qualityScore} label={ca.quality} />
            <ScoreBadge score={result.scriptComplianceScore} label={ca.script} />
            {result.alertKeywords && result.alertKeywords.length > 0 && (
              <Badge variant="destructive" className="text-[10px] gap-1">
                <AlertTriangle className="h-2.5 w-2.5" />
                {result.alertKeywords.length} {ca.alerts}
              </Badge>
            )}
            <Dialog>
              <DialogTrigger asChild>
                <Button size="icon" variant="ghost" data-testid={`btn-analysis-result-${result.id}`}>
                  <Brain className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    {ca.callAnalysis}
                  </DialogTitle>
                  <DialogDescription className="sr-only">{ca.callAnalysis}</DialogDescription>
                </DialogHeader>
                <CallAnalysisDialogContent recording={result} callId={result.id} ca={ca} sentimentLabels={sentimentLabels} />
              </DialogContent>
            </Dialog>
          </div>

          {result.callLogId && (
            <div className="mb-2">
              <CallRecordingPlayer callLogId={result.callLogId} compact onTimeUpdate={setPlaybackState} />
            </div>
          )}

          {result.summary && (
            <p className="text-xs text-muted-foreground mb-2 leading-relaxed">{result.summary}</p>
          )}

          <div className="bg-muted/40 rounded-md p-2 mb-2">
            <p className="text-xs leading-relaxed">{highlightText(snippet, query)}</p>
          </div>

          <div className="flex items-center gap-1 flex-wrap">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1"
              onClick={() => setExpanded(!expanded)}
              data-testid={`btn-full-transcript-${result.id}`}
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              <span className="text-[11px]">{expanded ? ca.hideFullTranscript : ca.fullTranscript}</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1"
              onClick={() => handleExport("txt")}
              data-testid={`btn-export-txt-${result.id}`}
            >
              <Download className="h-3 w-3" />
              <span className="text-[11px]">TXT</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1"
              onClick={() => handleExport("json")}
              data-testid={`btn-export-json-${result.id}`}
            >
              <Download className="h-3 w-3" />
              <span className="text-[11px]">JSON</span>
            </Button>
          </div>

          {expanded && (
            <ScrollArea className="max-h-[300px] mt-2">
              <TranscriptWithPlayback text={result.transcriptionText} searchText={query} playback={playbackState} />
            </ScrollArea>
          )}
        </div>
      </div>
    </Card>
  );
}

function FilterChip({ label, active, onClick, icon: Icon }: { label: string; active: boolean; onClick: () => void; icon?: any }) {
  return (
    <Button
      variant={active ? "default" : "outline"}
      size="sm"
      className="h-7 gap-1 text-[11px]"
      onClick={onClick}
      data-testid={`filter-chip-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {label}
    </Button>
  );
}

function AnalysisPanel({ log, ca, locale, sentimentLabels, searchText }: { log: CallLogEntry; ca: Record<string, any>; locale: string; sentimentLabels: Record<string, string>; searchText?: string }) {
  const [playbackState, setPlaybackState] = useState<PlaybackState | null>(null);
  const rec = log.recording;
  const dateStr = new Date(log.startedAt || log.createdAt).toLocaleString(LOCALE_MAP[locale] || 'en-US', {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const sentimentConfig: Record<string, { cls: string; bg: string; icon: string }> = {
    positive: { cls: "text-green-700 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/30", icon: "text-green-500" },
    neutral: { cls: "text-blue-700 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/30", icon: "text-blue-500" },
    negative: { cls: "text-orange-700 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/30", icon: "text-orange-500" },
    angry: { cls: "text-red-700 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/30", icon: "text-red-500" },
  };

  const sentiment = rec?.sentiment ?? "neutral";
  const sc = sentimentConfig[sentiment] || sentimentConfig.neutral;
  const qScore = rec?.qualityScore ?? 0;
  const sScore = rec?.scriptComplianceScore ?? 0;
  const qualityColor = qScore >= 8 ? "text-green-600 dark:text-green-400" : qScore >= 5 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400";
  const qualityBg = qScore >= 8 ? "bg-green-50 dark:bg-green-950/30" : qScore >= 5 ? "bg-yellow-50 dark:bg-yellow-950/30" : "bg-red-50 dark:bg-red-950/30";
  const qualityIcon = qScore >= 8 ? "text-green-500" : qScore >= 5 ? "text-yellow-500" : "text-red-500";
  const scriptColor = sScore >= 8 ? "text-green-600 dark:text-green-400" : sScore >= 5 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400";
  const scriptBg = sScore >= 8 ? "bg-green-50 dark:bg-green-950/30" : sScore >= 5 ? "bg-yellow-50 dark:bg-yellow-950/30" : "bg-red-50 dark:bg-red-950/30";
  const scriptIcon = sScore >= 8 ? "text-green-500" : sScore >= 5 ? "text-yellow-500" : "text-red-500";
  const alerts = rec?.alertKeywords ?? [];
  const topics = rec?.keyTopics ?? [];
  const actionItems = rec?.actionItems ?? [];

  const handleExport = (format: string) => {
    if (rec?.id) {
      window.open(`/api/call-recordings/${rec.id}/export-transcript?format=${format}`, "_blank");
    }
  };

  return (
    <div className="space-y-3" data-testid={`analysis-panel-${log.id}`}>
      <div className="flex items-center gap-2 flex-wrap pb-2 border-b">
        <DirectionIcon direction={log.direction} status={log.status} />
        <span className="text-sm font-semibold">{log.phoneNumber}</span>
        {log.customerName && (
          <span className="text-sm text-muted-foreground">{log.customerName}</span>
        )}
        {log.campaignName && (
          <Badge variant="outline" className="text-[10px] gap-1">
            <Megaphone className="h-2.5 w-2.5" />
            {log.campaignName}
          </Badge>
        )}
        {rec?.agentName && (
          <Badge variant="outline" className="text-[10px] gap-1">
            <UserCircle className="h-2.5 w-2.5" />
            {rec.agentName}
          </Badge>
        )}
        <StatusBadge status={log.status} labels={{ completed: ca.statusCompleted, failed: ca.statusFailed, no_answer: ca.statusNoAnswer, busy: ca.statusBusy, cancelled: ca.statusCancelled, initiated: ca.statusInitiated, ringing: ca.statusRinging, answered: ca.statusAnswered }} />
        <span className="text-xs text-muted-foreground ml-auto">{dateStr}</span>
        <span className="text-xs text-muted-foreground">{formatDuration(log.durationSeconds)}</span>
      </div>

      {log.hasRecording && (
        <div className="py-1">
          <CallRecordingPlayer callLogId={log.id} compact onTimeUpdate={setPlaybackState} />
        </div>
      )}

      {rec && rec.analysisStatus === "completed" && (
        <div className="flex gap-4">
          <div className="flex-1 min-w-0 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className={`rounded-md p-2.5 text-center ${sc.bg}`}>
                <Sparkles className={`h-4 w-4 mx-auto mb-0.5 ${sc.icon}`} />
                <div className={`text-sm font-semibold ${sc.cls}`}>{sentimentLabels[sentiment] || sentiment}</div>
              </div>
              {rec.qualityScore != null && (
                <div className={`rounded-md p-2.5 text-center ${qualityBg}`}>
                  <Star className={`h-4 w-4 mx-auto mb-0.5 ${qualityIcon}`} />
                  <div className={`text-lg font-bold ${qualityColor}`}>{rec.qualityScore}/10</div>
                  <div className="text-[10px] text-muted-foreground">{ca.quality || "Quality"}</div>
                </div>
              )}
              {rec.scriptComplianceScore != null && (
                <div className={`rounded-md p-2.5 text-center ${scriptBg}`}>
                  <ClipboardCheck className={`h-4 w-4 mx-auto mb-0.5 ${scriptIcon}`} />
                  <div className={`text-lg font-bold ${scriptColor}`}>{rec.scriptComplianceScore}/10</div>
                  <div className="text-[10px] text-muted-foreground">{ca.script || "Script"}</div>
                </div>
              )}
            </div>

            {alerts.length > 0 && (
              <div className="bg-red-50 dark:bg-red-950/30 rounded-md p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <ShieldAlert className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium text-red-700 dark:text-red-400">{ca.alerts || "Alerts"}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {alerts.map((alert, i) => (
                    <Badge key={i} variant="destructive" className="text-xs">{alert}</Badge>
                  ))}
                </div>
              </div>
            )}

            {rec.summary && (
              <div className="bg-muted/40 rounded-md p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Brain className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-medium">{ca.summaryLabel || "Summary"}</span>
                </div>
                <p className="text-sm text-foreground leading-relaxed">{rec.summary}</p>
              </div>
            )}

            {rec.scriptComplianceDetails && (
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-md p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <ClipboardCheck className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-400">{ca.scriptComplianceLabel || "Script Compliance"}</span>
                </div>
                <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">{rec.scriptComplianceDetails}</p>
              </div>
            )}

            {topics.length > 0 && (
              <div className="bg-muted/40 rounded-md p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Tag className="h-4 w-4 text-indigo-500" />
                  <span className="text-sm font-medium">{ca.topicsLabel || "Topics"}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {topics.map((topic, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{topic}</Badge>
                  ))}
                </div>
              </div>
            )}

            {actionItems.length > 0 && (
              <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-md p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <ListChecks className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{ca.actionItemsLabel || "Action Items"}</span>
                </div>
                <ul className="space-y-1">
                  {actionItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                      <span className="text-emerald-700 dark:text-emerald-300">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {rec.complianceNotes && (
              <div className="bg-orange-50 dark:bg-orange-950/30 rounded-md p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium text-orange-700 dark:text-orange-400">{ca.complianceLabel || "Compliance"}</span>
                </div>
                <p className="text-sm text-orange-700 dark:text-orange-300 leading-relaxed">{rec.complianceNotes}</p>
              </div>
            )}
          </div>

          {rec.transcriptionText && (
            <div className="w-[45%] shrink-0 flex flex-col border-l pl-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{ca.showTranscript || "Transcript"}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => handleExport("txt")} data-testid={`btn-export-txt-panel-${log.id}`}>
                    <Download className="h-3 w-3" />
                    <span className="text-xs">TXT</span>
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => handleExport("json")} data-testid={`btn-export-json-panel-${log.id}`}>
                    <Download className="h-3 w-3" />
                    <span className="text-xs">JSON</span>
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap mb-2">
                <SentimentBadge sentiment={rec.sentiment} labels={sentimentLabels} />
                <ScoreBadge score={rec.qualityScore} label={ca.quality} />
                <ScoreBadge score={rec.scriptComplianceScore} label={ca.script} />
              </div>
              <ScrollArea className="flex-1">
                <TranscriptWithPlayback text={rec.transcriptionText} searchText={searchText} playback={playbackState} />
              </ScrollArea>
            </div>
          )}
        </div>
      )}

      {rec && rec.analysisStatus === "processing" && (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span className="text-sm">{ca.processing}</span>
        </div>
      )}

      {(!rec || (rec.analysisStatus !== "completed" && rec.analysisStatus !== "processing")) && !log.hasRecording && (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <MicOff className="h-8 w-8 mb-2 opacity-30" />
          <p className="text-xs">{ca.withoutRecording}</p>
        </div>
      )}

      {log.notes && (
        <div className="bg-muted/40 rounded-md p-3">
          <p className="text-xs text-muted-foreground italic">{log.notes}</p>
        </div>
      )}
    </div>
  );
}

function CompactCallRow({ log, isSelected, onClick, locale, ca }: { log: CallLogEntry; isSelected: boolean; onClick: () => void; locale: string; ca: Record<string, any> }) {
  const dateStr = new Date(log.startedAt || log.createdAt).toLocaleString(LOCALE_MAP[locale] || 'en-US', {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  const rec = log.recording;

  const sentimentLabels: Record<string, string> = {
    positive: ca.positive, neutral: ca.neutral, negative: ca.negative, angry: ca.angry,
  };

  return (
    <div
      className={`flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer transition-colors ${isSelected ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted/50"}`}
      onClick={onClick}
      data-testid={`compact-call-${log.id}`}
    >
      <div className="shrink-0">
        <DirectionIcon direction={log.direction} status={log.status} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium truncate">{log.customerName || log.phoneNumber}</span>
          {log.campaignName && (
            <Badge variant="outline" className="text-[9px] shrink-0 hidden sm:inline-flex">{log.campaignName}</Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] text-muted-foreground">{dateStr}</span>
          <span className="text-[10px] text-muted-foreground">{formatDuration(log.durationSeconds)}</span>
          {log.hasRecording && <Mic className="h-2.5 w-2.5 text-green-500 shrink-0" />}
          {rec?.analysisStatus === "completed" && <Brain className="h-2.5 w-2.5 text-purple-500 shrink-0" />}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <SentimentBadge sentiment={rec?.sentiment ?? null} labels={sentimentLabels} />
        {rec?.qualityScore != null && (
          <span className={`text-[10px] font-bold ${rec.qualityScore >= 8 ? "text-green-600 dark:text-green-400" : rec.qualityScore >= 5 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"}`}>
            {rec.qualityScore}/10
          </span>
        )}
      </div>
    </div>
  );
}

export function TranscriptSearchContent() {
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const ca = t.callAnalysis;
  const [activeTab, setActiveTab] = useState<"browse" | "search">("browse");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showBrowseFilters, setShowBrowseFilters] = useState(false);
  const [selectedCallLogId, setSelectedCallLogId] = useState<string | null>(null);

  const [sentimentFilter, setSentimentFilter] = useState<string>("");
  const [hasAlertsFilter, setHasAlertsFilter] = useState(false);

  const [browseCampaignFilter, setBrowseCampaignFilter] = useState<string>("");
  const [browseDirectionFilter, setBrowseDirectionFilter] = useState<string>("");
  const [browseStatusFilter, setBrowseStatusFilter] = useState<string>("");
  const [browseRecordingFilter, setBrowseRecordingFilter] = useState<string>("");
  const [browseSentimentFilter, setBrowseSentimentFilter] = useState<string>("");
  const [browseAgentFilter, setBrowseAgentFilter] = useState<string>("");
  const [browseHasAlertsFilter, setBrowseHasAlertsFilter] = useState(false);
  const [browseMinQuality, setBrowseMinQuality] = useState<string>("");
  const [browseMinScriptScore, setBrowseMinScriptScore] = useState<string>("");
  const [browseDateFrom, setBrowseDateFrom] = useState<string>("");
  const [browseDateTo, setBrowseDateTo] = useState<string>("");
  const [browseSearchText, setBrowseSearchText] = useState<string>("");

  const { data: callLogs = [], isLoading: logsLoading } = useQuery<CallLogEntry[]>({
    queryKey: ["/api/call-logs/browse"],
    queryFn: async () => {
      const res = await fetch("/api/call-logs/browse?limit=200", { credentials: "include" });
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
      const data = await res.json();
      return data.map((c: any) => ({ id: c.id, name: c.name }));
    },
  });

  const { data: results = [], isLoading, isFetching } = useQuery<TranscriptResult[]>({
    queryKey: ["/api/call-recordings/search/transcripts", { query: searchQuery, sentiment: sentimentFilter, hasAlerts: hasAlertsFilter }],
    queryFn: async () => {
      const params = new URLSearchParams({ query: searchQuery, limit: "50" });
      if (sentimentFilter) params.set("sentiment", sentimentFilter);
      if (hasAlertsFilter) params.set("hasAlerts", "true");
      const res = await fetch(`/api/call-recordings/search/transcripts?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: searchQuery.length >= 2 && activeTab === "search",
  });

  const handleSearch = useCallback(() => {
    if (searchInput.trim().length >= 2) {
      setSearchQuery(searchInput.trim());
    }
  }, [searchInput]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  }, [handleSearch]);

  const clearFilters = () => {
    setSentimentFilter("");
    setHasAlertsFilter(false);
  };

  const clearBrowseFilters = () => {
    setBrowseCampaignFilter("");
    setBrowseDirectionFilter("");
    setBrowseStatusFilter("");
    setBrowseRecordingFilter("");
    setBrowseSentimentFilter("");
    setBrowseAgentFilter("");
    setBrowseHasAlertsFilter(false);
    setBrowseMinQuality("");
    setBrowseMinScriptScore("");
    setBrowseDateFrom("");
    setBrowseDateTo("");
    setBrowseSearchText("");
  };

  const hasActiveFilters = sentimentFilter || hasAlertsFilter;

  const hasActiveBrowseFilters = browseCampaignFilter || browseDirectionFilter || browseStatusFilter ||
    browseRecordingFilter || browseSentimentFilter || browseAgentFilter || browseHasAlertsFilter ||
    browseMinQuality || browseMinScriptScore || browseDateFrom || browseDateTo || browseSearchText;

  const activeBrowseFilterCount = [
    browseCampaignFilter, browseDirectionFilter, browseStatusFilter,
    browseRecordingFilter, browseSentimentFilter, browseAgentFilter,
    browseHasAlertsFilter ? "yes" : "", browseMinQuality, browseMinScriptScore, browseDateFrom, browseDateTo, browseSearchText,
  ].filter(Boolean).length;

  const uniqueAgents = useMemo(() => {
    const agents = new Set<string>();
    callLogs.forEach(log => {
      if (log.recording?.agentName) agents.add(log.recording.agentName);
    });
    return Array.from(agents).sort();
  }, [callLogs]);

  const uniqueCampaignsInLogs = useMemo(() => {
    const camps = new Map<string, string>();
    callLogs.forEach(log => {
      if (log.campaignId && log.campaignName) {
        camps.set(log.campaignId, log.campaignName);
      }
    });
    return Array.from(camps.entries()).map(([id, name]) => ({ id, name }));
  }, [callLogs]);

  const filteredCallLogs = useMemo(() => {
    let filtered = [...callLogs];

    if (browseSearchText) {
      const q = browseSearchText.toLowerCase();
      filtered = filtered.filter(log =>
        log.phoneNumber?.toLowerCase().includes(q) ||
        log.customerName?.toLowerCase().includes(q) ||
        log.campaignName?.toLowerCase().includes(q) ||
        log.recording?.agentName?.toLowerCase().includes(q) ||
        log.recording?.transcriptionText?.toLowerCase().includes(q) ||
        log.recording?.summary?.toLowerCase().includes(q) ||
        log.notes?.toLowerCase().includes(q)
      );
    }

    if (browseCampaignFilter) {
      if (browseCampaignFilter === "__none__") {
        filtered = filtered.filter(log => !log.campaignId);
      } else {
        filtered = filtered.filter(log => log.campaignId === browseCampaignFilter);
      }
    }

    if (browseDirectionFilter) {
      filtered = filtered.filter(log => log.direction === browseDirectionFilter);
    }

    if (browseStatusFilter) {
      filtered = filtered.filter(log => log.status === browseStatusFilter);
    }

    if (browseRecordingFilter) {
      if (browseRecordingFilter === "recorded") {
        filtered = filtered.filter(log => log.hasRecording);
      } else if (browseRecordingFilter === "not_recorded") {
        filtered = filtered.filter(log => !log.hasRecording);
      } else if (browseRecordingFilter === "analyzed") {
        filtered = filtered.filter(log => log.recording?.analysisStatus === "completed");
      } else if (browseRecordingFilter === "transcribed") {
        filtered = filtered.filter(log => log.recording?.transcriptionText);
      }
    }

    if (browseSentimentFilter) {
      filtered = filtered.filter(log => log.recording?.sentiment === browseSentimentFilter);
    }

    if (browseAgentFilter) {
      filtered = filtered.filter(log => log.recording?.agentName === browseAgentFilter);
    }

    if (browseHasAlertsFilter) {
      filtered = filtered.filter(log => log.recording?.alertKeywords && log.recording.alertKeywords.length > 0);
    }

    if (browseMinQuality) {
      const minQ = parseInt(browseMinQuality);
      if (!isNaN(minQ)) {
        filtered = filtered.filter(log => log.recording?.qualityScore != null && log.recording.qualityScore >= minQ);
      }
    }

    if (browseMinScriptScore) {
      const minS = parseInt(browseMinScriptScore);
      if (!isNaN(minS)) {
        filtered = filtered.filter(log => log.recording?.scriptComplianceScore != null && log.recording.scriptComplianceScore >= minS);
      }
    }

    if (browseDateFrom) {
      const from = new Date(browseDateFrom);
      from.setHours(0, 0, 0, 0);
      filtered = filtered.filter(log => new Date(log.startedAt || log.createdAt) >= from);
    }

    if (browseDateTo) {
      const to = new Date(browseDateTo);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter(log => new Date(log.startedAt || log.createdAt) <= to);
    }

    return filtered;
  }, [callLogs, browseSearchText, browseCampaignFilter, browseDirectionFilter, browseStatusFilter,
    browseRecordingFilter, browseSentimentFilter, browseAgentFilter, browseHasAlertsFilter,
    browseMinQuality, browseMinScriptScore, browseDateFrom, browseDateTo]);

  const stats = useMemo(() => {
    const total = filteredCallLogs.length;
    const recorded = filteredCallLogs.filter(l => l.hasRecording).length;
    const analyzed = filteredCallLogs.filter(l => l.recording?.analysisStatus === "completed").length;
    const withAlerts = filteredCallLogs.filter(l => l.recording?.alertKeywords && l.recording.alertKeywords.length > 0).length;
    const avgQuality = filteredCallLogs.filter(l => l.recording?.qualityScore).reduce((sum, l) => sum + (l.recording?.qualityScore || 0), 0) / (filteredCallLogs.filter(l => l.recording?.qualityScore).length || 1);
    return { total, recorded, analyzed, withAlerts, avgQuality: Math.round(avgQuality * 10) / 10 };
  }, [filteredCallLogs]);

  useEffect(() => {
    if (filteredCallLogs.length > 0 && (!selectedCallLogId || !filteredCallLogs.find(l => l.id === selectedCallLogId))) {
      setSelectedCallLogId(filteredCallLogs[0].id);
    } else if (filteredCallLogs.length === 0) {
      setSelectedCallLogId(null);
    }
  }, [filteredCallLogs, selectedCallLogId]);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold" data-testid="text-page-title">{ca.pageTitle}</h1>
        </div>

        <div className="flex items-center gap-1 mb-3">
          <Button
            variant={activeTab === "browse" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("browse")}
            data-testid="btn-tab-browse"
          >
            <List className="h-4 w-4 mr-1" />
            {ca.allCalls}
          </Button>
          <Button
            variant={activeTab === "search" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("search")}
            data-testid="btn-tab-search"
          >
            <Search className="h-4 w-4 mr-1" />
            {ca.searchTranscripts}
          </Button>
        </div>

        {activeTab === "browse" && (
          <>
            <div className="flex items-center gap-2 mb-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder={ca.searchInCalls}
                  className="pl-8 h-8 text-xs"
                  value={browseSearchText}
                  onChange={(e) => setBrowseSearchText(e.target.value)}
                  data-testid="input-browse-search"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBrowseFilters(!showBrowseFilters)}
                className={`gap-1 ${hasActiveBrowseFilters ? "border-primary" : ""}`}
                data-testid="btn-browse-filters"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span className="text-xs">{ca.filters}</span>
                {activeBrowseFilterCount > 0 && (
                  <Badge variant="secondary" className="text-[9px] h-4 min-w-4 px-1">{activeBrowseFilterCount}</Badge>
                )}
              </Button>
              {hasActiveBrowseFilters && (
                <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={clearBrowseFilters} data-testid="btn-clear-browse-filters">
                  <X className="h-3 w-3" />
                  <span className="text-xs">{ca.clearFilters}</span>
                </Button>
              )}
            </div>

            {showBrowseFilters && (
              <div className="bg-muted/30 rounded-md p-3 mb-2 space-y-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Megaphone className="h-3.5 w-3.5 text-muted-foreground" />
                    <Select value={browseCampaignFilter} onValueChange={(v) => setBrowseCampaignFilter(v === "all" ? "" : v)}>
                      <SelectTrigger className="w-[180px] h-8 text-xs" data-testid="select-browse-campaign">
                        <SelectValue placeholder={ca.campaign} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{ca.allCampaigns}</SelectItem>
                        <SelectItem value="__none__">{ca.noCampaign}</SelectItem>
                        {(uniqueCampaignsInLogs.length > 0 ? uniqueCampaignsInLogs : campaignsList).map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                    <Select value={browseStatusFilter} onValueChange={(v) => setBrowseStatusFilter(v === "all" ? "" : v)}>
                      <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-browse-status">
                        <SelectValue placeholder={ca.status} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{ca.allStatuses}</SelectItem>
                        <SelectItem value="completed">{ca.statusCompleted}</SelectItem>
                        <SelectItem value="failed">{ca.statusFailed}</SelectItem>
                        <SelectItem value="no_answer">{ca.statusNoAnswer}</SelectItem>
                        <SelectItem value="busy">{ca.statusBusy}</SelectItem>
                        <SelectItem value="cancelled">{ca.statusCancelled}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <Select value={browseDirectionFilter} onValueChange={(v) => setBrowseDirectionFilter(v === "all" ? "" : v)}>
                      <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-browse-direction">
                        <SelectValue placeholder={ca.direction} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{ca.allDirections}</SelectItem>
                        <SelectItem value="outbound">{ca.outbound}</SelectItem>
                        <SelectItem value="inbound">{ca.inbound}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Mic className="h-3.5 w-3.5 text-muted-foreground" />
                    <Select value={browseRecordingFilter} onValueChange={(v) => setBrowseRecordingFilter(v === "all" ? "" : v)}>
                      <SelectTrigger className="w-[150px] h-8 text-xs" data-testid="select-browse-recording">
                        <SelectValue placeholder={ca.recording} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{ca.allRecordings}</SelectItem>
                        <SelectItem value="recorded">{ca.withRecording}</SelectItem>
                        <SelectItem value="not_recorded">{ca.withoutRecording}</SelectItem>
                        <SelectItem value="analyzed">{ca.analyzed}</SelectItem>
                        <SelectItem value="transcribed">{ca.withTranscript}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                    <Select value={browseSentimentFilter} onValueChange={(v) => setBrowseSentimentFilter(v === "all" ? "" : v)}>
                      <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-browse-sentiment">
                        <SelectValue placeholder={ca.sentiment} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{ca.allSentiments}</SelectItem>
                        <SelectItem value="positive">{ca.positive}</SelectItem>
                        <SelectItem value="neutral">{ca.neutral}</SelectItem>
                        <SelectItem value="negative">{ca.negative}</SelectItem>
                        <SelectItem value="angry">{ca.angry}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {uniqueAgents.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <UserCircle className="h-3.5 w-3.5 text-muted-foreground" />
                      <Select value={browseAgentFilter} onValueChange={(v) => setBrowseAgentFilter(v === "all" ? "" : v)}>
                        <SelectTrigger className="w-[160px] h-8 text-xs" data-testid="select-browse-agent">
                          <SelectValue placeholder={ca.agent} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{ca.allAgents}</SelectItem>
                          {uniqueAgents.map(a => (
                            <SelectItem key={a} value={a}>{a}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      type="date"
                      className="h-8 text-xs w-[140px]"
                      value={browseDateFrom}
                      onChange={(e) => setBrowseDateFrom(e.target.value)}
                      data-testid="input-date-from"
                    />
                    <span className="text-xs text-muted-foreground">{ca.dateTo}</span>
                    <Input
                      type="date"
                      className="h-8 text-xs w-[140px]"
                      value={browseDateTo}
                      onChange={(e) => setBrowseDateTo(e.target.value)}
                      data-testid="input-date-to"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                    <Select value={browseMinQuality} onValueChange={(v) => setBrowseMinQuality(v === "all" ? "" : v)}>
                      <SelectTrigger className="w-[150px] h-8 text-xs" data-testid="select-browse-quality">
                        <SelectValue placeholder={ca.minQuality} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{ca.allRecordings}</SelectItem>
                        <SelectItem value="8">8+ ({ca.excellent})</SelectItem>
                        <SelectItem value="6">6+ ({ca.good})</SelectItem>
                        <SelectItem value="4">4+ ({ca.average})</SelectItem>
                        <SelectItem value="1">1+ ({ca.poor})</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
                    <Select value={browseMinScriptScore} onValueChange={(v) => setBrowseMinScriptScore(v === "all" ? "" : v)}>
                      <SelectTrigger className="w-[150px] h-8 text-xs" data-testid="select-browse-script-score">
                        <SelectValue placeholder={ca.scriptComplianceLabel || "Script Score"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{ca.allRecordings}</SelectItem>
                        <SelectItem value="8">8+ ({ca.excellent})</SelectItem>
                        <SelectItem value="6">6+ ({ca.good})</SelectItem>
                        <SelectItem value="4">4+ ({ca.average})</SelectItem>
                        <SelectItem value="1">1+ ({ca.poor})</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <FilterChip
                    label={ca.withAlerts}
                    active={browseHasAlertsFilter}
                    onClick={() => setBrowseHasAlertsFilter(!browseHasAlertsFilter)}
                    icon={AlertTriangle}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span>{stats.total} {ca.calls}</span>
              <span>{stats.recorded} {ca.recorded}</span>
              <span>{stats.analyzed} {ca.analyzed}</span>
              {stats.withAlerts > 0 && (
                <span className="text-destructive flex items-center gap-0.5">
                  <AlertTriangle className="h-3 w-3" />
                  {stats.withAlerts} {ca.alerts}
                </span>
              )}
              {stats.analyzed > 0 && (
                <span className="flex items-center gap-0.5">
                  <Star className="h-3 w-3" />
                  {ca.avgQuality}: {stats.avgQuality}/10
                </span>
              )}
              {hasActiveBrowseFilters && callLogs.length !== filteredCallLogs.length && (
                <span className="text-primary font-medium">({ca.filtersActive}: {filteredCallLogs.length} {ca.of} {callLogs.length})</span>
              )}
            </div>
          </>
        )}

        {activeTab === "search" && (
          <>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-xl">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={ca.searchPlaceholder}
                  className="pl-9"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  data-testid="input-transcript-search"
                />
              </div>
              <Button onClick={handleSearch} disabled={searchInput.trim().length < 2} data-testid="btn-search-transcripts">
                <Search className="h-4 w-4 mr-1" />
                {ca.search}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowFilters(!showFilters)}
                className={hasActiveFilters ? "border-primary" : ""}
                data-testid="btn-toggle-filters"
              >
                <Filter className="h-4 w-4" />
              </Button>
            </div>

            {showFilters && (
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">{ca.sentiment}:</span>
                  <Select value={sentimentFilter} onValueChange={(v) => setSentimentFilter(v === "all" ? "" : v)}>
                    <SelectTrigger className="w-[130px] h-8 text-xs" data-testid="select-sentiment-filter">
                      <SelectValue placeholder={ca.allSentiments} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{ca.allSentiments}</SelectItem>
                      <SelectItem value="positive">{ca.positive}</SelectItem>
                      <SelectItem value="neutral">{ca.neutral}</SelectItem>
                      <SelectItem value="negative">{ca.negative}</SelectItem>
                      <SelectItem value="angry">{ca.angry}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant={hasAlertsFilter ? "default" : "outline"}
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() => setHasAlertsFilter(!hasAlertsFilter)}
                  data-testid="btn-filter-alerts"
                >
                  <AlertTriangle className="h-3 w-3" />
                  <span className="text-xs">{ca.withAlerts}</span>
                </Button>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={clearFilters} data-testid="btn-clear-filters">
                    <X className="h-3 w-3" />
                    <span className="text-xs">{ca.clearFilters}</span>
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {activeTab === "browse" && (
        <div className="flex flex-1 overflow-hidden">
          <div className="w-[30%] min-w-[280px] border-r flex flex-col">
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-0.5">
                {logsLoading && (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
                    <span className="text-sm text-muted-foreground">{ca.loadingCalls}</span>
                  </div>
                )}

                {!logsLoading && filteredCallLogs.length === 0 && !hasActiveBrowseFilters && (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <Phone className="h-12 w-12 mb-4 opacity-30" />
                    <p className="text-sm font-medium">{ca.noCalls}</p>
                    <p className="text-xs mt-1">{ca.noCallsDescription}</p>
                    <div className="mt-6 bg-muted/40 rounded-md p-4 max-w-md text-center">
                      <p className="text-xs leading-relaxed">{ca.noCallsHelp}</p>
                    </div>
                  </div>
                )}

                {!logsLoading && filteredCallLogs.length === 0 && hasActiveBrowseFilters && (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <Filter className="h-12 w-12 mb-4 opacity-30" />
                    <p className="text-sm font-medium">{ca.noResults}</p>
                    <Button variant="outline" size="sm" className="mt-4 gap-1" onClick={clearBrowseFilters}>
                      <X className="h-3 w-3" />
                      {ca.clearFilters}
                    </Button>
                  </div>
                )}

                {!logsLoading && filteredCallLogs.map((log) => (
                  <CompactCallRow
                    key={log.id}
                    log={log}
                    isSelected={selectedCallLogId === log.id}
                    onClick={() => setSelectedCallLogId(log.id)}
                    locale={locale}
                    ca={ca}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="flex-1 flex flex-col">
            <ScrollArea className="flex-1">
              <div className="p-4">
                {(() => {
                  const selectedLog = selectedCallLogId ? filteredCallLogs.find(l => l.id === selectedCallLogId) : null;
                  if (selectedLog) {
                    const sentimentLabels: Record<string, string> = {
                      positive: ca.positive, neutral: ca.neutral, negative: ca.negative, angry: ca.angry,
                    };
                    return <AnalysisPanel log={selectedLog} ca={ca} locale={locale} sentimentLabels={sentimentLabels} searchText={browseSearchText} />;
                  }
                  return (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                      <Brain className="h-12 w-12 mb-4 opacity-30" />
                      <p className="text-sm font-medium">{ca.callAnalysis}</p>
                      <p className="text-xs mt-1">{ca.selectCallForAnalysis || "Select a call to view analysis"}</p>
                    </div>
                  );
                })()}
              </div>
            </ScrollArea>
          </div>
        </div>
      )}

      {activeTab === "search" && (
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {!searchQuery && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Search className="h-12 w-12 mb-4 opacity-30" />
                <p className="text-sm font-medium">{ca.enterSearchTerm}</p>
                <p className="text-xs mt-1">{ca.searchDescription}</p>
              </div>
            )}

            {searchQuery && isLoading && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
                <span className="text-sm text-muted-foreground">{ca.searching}</span>
              </div>
            )}

            {searchQuery && !isLoading && results.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <FileText className="h-12 w-12 mb-4 opacity-30" />
                <p className="text-sm font-medium">{ca.noSearchResults}</p>
                <p className="text-xs mt-1">{ca.noSearchResultsFor} "{searchQuery}"</p>
              </div>
            )}

            {searchQuery && !isLoading && results.length > 0 && (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-muted-foreground">
                    {results.length} {ca.resultsFor} "{searchQuery}"
                    {isFetching && <Loader2 className="h-3 w-3 animate-spin inline ml-1" />}
                  </span>
                </div>
                {results.map((result) => (
                  <ResultCard key={result.id} result={result} query={searchQuery} />
                ))}
              </>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

export default function TranscriptSearchPage() {
  return <TranscriptSearchContent />;
}
