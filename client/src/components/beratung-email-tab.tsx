/**
 * Beratung Email Monitor Tab
 * Tabs: Správy | Nastavenia
 */

import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, RefreshCw, ChevronDown, ChevronRight,
  Mail, Send, Languages, CheckCircle2, Clock, AlertCircle,
  X, Plus, Wifi, WifiOff, Mic, Filter, Search, RotateCcw,
  Settings, Inbox, Paperclip, Eye, EyeOff, KeyRound, ListChecks,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActivityLogEntry {
  id: string;
  action: "forwarded" | "analyzed" | "reanalyzed" | "fetched";
  mode: "manual" | "auto";
  email_id: string | null;
  email_subject: string | null;
  actor_user_id: string | null;
  detail: string | null;
  created_at: string;
}

interface AttachmentSummary {
  name: string;
  contentType: string;
  hasText: boolean;
  isAudio: boolean;
  transcription?: string | null;
  aiSummary?: string | null;
}

interface BeratungEmail {
  id: string;
  graph_message_id: string;
  subject: string | null;
  from_address: string;
  from_name: string | null;
  received_at: string;
  body_html?: string | null;
  body_text?: string | null;
  translated_cs?: string | null;
  translated_sk?: string | null;
  has_attachments: boolean;
  attachment_count: number;
  attachment_summaries?: AttachmentSummary[];
  audio_transcription?: string | null;
  status: "new" | "translated" | "forwarded";
  forwarded_at?: string | null;
}

interface BeratungSettings {
  forward_to: string[];
  auto_process: boolean;
  sender_filters: string[];
  last_checked_at: string | null;
  has_token: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function senderInitials(name: string | null, address: string): string {
  const src = name || address;
  const parts = src.trim().split(/[\s@]/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.substring(0, 2).toUpperCase();
}

function senderColor(address: string): string {
  const colors = [
    "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500",
    "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-orange-500",
  ];
  let h = 0;
  for (let i = 0; i < address.length; i++) h = (h * 31 + address.charCodeAt(i)) & 0xFFFFFF;
  return colors[Math.abs(h) % colors.length];
}

function formatDate(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const isThisYear = d.getFullYear() === now.getFullYear();
  const time = d.toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" });
  if (isToday) return { date: "", time };
  if (isThisYear) return { date: d.toLocaleDateString("sk-SK", { day: "numeric", month: "short" }), time };
  return { date: d.toLocaleDateString("sk-SK", { day: "numeric", month: "numeric", year: "2-digit" }), time };
}

// ─── Email card row ───────────────────────────────────────────────────────────

function EmailCard({ email, autoProcess }: { email: BeratungEmail; autoProcess: boolean }) {
  const { t } = useI18n();
  const b = t.beratung;
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<BeratungEmail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/beratung/emails"] });
  }, []);

  const translateMut = useMutation({
    mutationFn: () => apiRequest("POST", `/api/beratung/emails/${email.id}/translate`).then(r => r.json()),
    onSuccess: () => { toast({ title: b.translateSuccess }); invalidate(); setDetail(null); },
    onError: () => toast({ title: b.translateError, variant: "destructive" }),
  });

  const forwardMut = useMutation({
    mutationFn: () => apiRequest("POST", `/api/beratung/emails/${email.id}/forward`).then(r => r.json()),
    onSuccess: () => { toast({ title: b.forwardSuccess }); invalidate(); setDetail(null); },
    onError: () => toast({ title: b.forwardError, variant: "destructive" }),
  });

  const reanalyzeMut = useMutation({
    mutationFn: () => apiRequest("POST", `/api/beratung/emails/${email.id}/reanalyze`).then(async r => {
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "Failed");
      return json;
    }),
    onSuccess: () => {
      toast({ title: b.reanalyzeSuccess });
      invalidate();
      setDetail(null);
    },
    onError: (err: any) => toast({
      title: b.reanalyzeError,
      description: err?.message,
      variant: "destructive",
    }),
  });

  const handleToggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !detail) {
      setLoadingDetail(true);
      try {
        const res = await fetch(`/api/beratung/emails/${email.id}`, { credentials: "include" });
        if (res.ok) setDetail(await res.json());
      } finally {
        setLoadingDetail(false);
      }
    }
  };

  const isProcessing = translateMut.isPending || forwardMut.isPending || reanalyzeMut.isPending;
  const hasAudio = email.attachment_summaries?.some(a => a.isAudio) || false;
  const audioAtts = detail?.attachment_summaries?.filter(a => a.isAudio) || [];
  const { date, time } = formatDate(email.received_at);

  const statusColors: Record<BeratungEmail["status"], string> = {
    forwarded: "bg-emerald-500",
    translated: "bg-blue-500",
    new: "bg-slate-300 dark:bg-slate-600",
  };

  // Body preview text
  const preview = email.body_text
    ? email.body_text.replace(/\s+/g, " ").trim().substring(0, 120)
    : "";

  return (
    <div className="group">
      {/* ── Card header (always visible) ─── */}
      <div
        className={`flex gap-3 px-4 py-3.5 cursor-pointer hover:bg-muted/40 transition-colors border-b relative
          ${email.status === "new" ? "bg-blue-50/30 dark:bg-blue-950/10" : ""}`}
        onClick={handleToggle}
      >
        {/* Status strip */}
        <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-tr rounded-br ${statusColors[email.status]}`} />

        {/* Avatar */}
        <div className={`shrink-0 w-9 h-9 rounded-full ${senderColor(email.from_address)} flex items-center justify-center text-white text-xs font-bold mt-0.5`}>
          {senderInitials(email.from_name, email.from_address)}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`text-sm font-semibold truncate ${email.status === "new" ? "text-foreground" : "text-muted-foreground"}`}>
                {email.from_name || email.from_address}
              </span>
              {email.status === "new" && (
                <span className="shrink-0 w-2 h-2 rounded-full bg-blue-500" title="Nový" />
              )}
            </div>

            {/* Right: time + status */}
            <div className="flex items-center gap-2 shrink-0">
              {hasAudio && <Mic className="h-3.5 w-3.5 text-amber-500" />}
              {email.has_attachments && !hasAudio && <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />}
              <div className="text-right">
                {date && <div className="text-xs text-muted-foreground">{date}</div>}
                <div className="text-xs text-muted-foreground">{time}</div>
              </div>
              {/* Status badge */}
              {email.status === "forwarded" && (
                <span className="hidden sm:flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="h-3 w-3" />{b.statusForwarded}
                </span>
              )}
              {email.status === "translated" && (
                <span className="hidden sm:flex items-center gap-1 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                  <Languages className="h-3 w-3" />{b.statusTranslated}
                </span>
              )}
              {email.status === "new" && (
                <span className="hidden sm:flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                  <Clock className="h-3 w-3" />{b.statusNew}
                </span>
              )}
              {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
            </div>
          </div>

          {/* Subject */}
          <div className={`text-sm mt-0.5 truncate ${email.status === "new" ? "font-medium" : ""}`}>
            {email.subject || "(bez predmetu)"}
          </div>

          {/* Preview + action row */}
          <div className="flex items-end justify-between gap-2 mt-1">
            {preview && (
              <p className="text-xs text-muted-foreground line-clamp-1 flex-1">{preview}</p>
            )}

            {/* Actions */}
            <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => reanalyzeMut.mutate()}
                disabled={isProcessing}
                title={b.reanalyzeBtn}
              >
                {reanalyzeMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
              </Button>
              {!autoProcess && email.status === "new" && (
                <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={() => translateMut.mutate()} disabled={isProcessing}>
                  {translateMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Languages className="h-3 w-3 mr-1" />}
                  {b.analyzeBtn}
                </Button>
              )}
              {!autoProcess && (email.status === "new" || email.status === "translated") && (
                <Button size="sm" className="h-6 text-xs px-2" onClick={() => forwardMut.mutate()} disabled={isProcessing}>
                  {forwardMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
                  {b.forwardBtn}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Expanded detail ─── */}
      {open && (
        <div className="border-b bg-muted/10 px-5 py-4 space-y-4">
          {loadingDetail ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> {b.loading}
            </div>
          ) : (
            <>
              {/* Audio / Voicemail block */}
              {audioAtts.length > 0 && (
                <div className="rounded-xl border-2 border-amber-300 dark:border-amber-600 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-100 dark:bg-amber-900/40 border-b border-amber-200 dark:border-amber-700">
                    <Mic className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                      🎙️ {b.audioTranscription}
                    </span>
                  </div>
                  {audioAtts.map((att, i) => (
                    <div key={i} className="px-4 py-3 bg-amber-50 dark:bg-amber-950/20 space-y-3">
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-400">{att.name}</p>

                      {att.aiSummary && (
                        <div className="rounded-lg bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-700 px-3 py-3">
                          <p className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-1.5">💡 {b.aiSummary}</p>
                          <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">{att.aiSummary}</p>
                        </div>
                      )}

                      {!att.aiSummary && !att.transcription && (
                        <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400 italic">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          Transkript nie je k dispozícii — kliknite &quot;Znovu analyzovať&quot; na prepis hlasovky.
                        </div>
                      )}

                      {att.transcription && (
                        <div>
                          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1.5">📝 {b.fullTranscript}</p>
                          <p className="text-sm whitespace-pre-wrap break-words text-amber-900 dark:text-amber-200 leading-relaxed bg-white dark:bg-amber-950/30 rounded p-2 border border-amber-200 dark:border-amber-800">
                            {att.transcription}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Translation columns */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {/* Original */}
                <div className="rounded-lg border overflow-hidden">
                  <div className="px-3 py-2 bg-muted/60 border-b text-xs font-semibold flex items-center gap-1">
                    🇩🇪 {b.original}
                  </div>
                  <div className="text-sm bg-background p-3 max-h-56 overflow-y-auto whitespace-pre-wrap break-words leading-relaxed text-foreground/90">
                    {detail?.body_text || (detail?.body_html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || "—"}
                  </div>
                </div>

                {/* SK */}
                <div className="rounded-lg border border-blue-200 dark:border-blue-800 overflow-hidden">
                  <div className="px-3 py-2 bg-blue-50 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-800 text-xs font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-1">
                    🇸🇰 {b.translationSk}
                  </div>
                  {detail?.translated_sk
                    ? <div className="text-sm bg-background p-3 max-h-56 overflow-y-auto whitespace-pre-wrap leading-relaxed">{detail.translated_sk}</div>
                    : <div className="text-sm text-muted-foreground italic p-3">{b.notYetTranslated}</div>
                  }
                </div>

                {/* CS */}
                <div className="rounded-lg border border-red-200 dark:border-red-800 overflow-hidden">
                  <div className="px-3 py-2 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-800 text-xs font-semibold text-red-800 dark:text-red-300 flex items-center gap-1">
                    🇨🇿 {b.translationCs}
                  </div>
                  {detail?.translated_cs
                    ? <div className="text-sm bg-background p-3 max-h-56 overflow-y-auto whitespace-pre-wrap leading-relaxed">{detail.translated_cs}</div>
                    : <div className="text-sm text-muted-foreground italic p-3">{b.notYetTranslated}</div>
                  }
                </div>
              </div>

              {/* Attachment chips */}
              {email.attachment_count > 0 && email.attachment_summaries && (
                <div className="flex gap-1.5 flex-wrap pt-1">
                  {email.attachment_summaries.map((att, i) => (
                    <Badge key={i} variant="secondary" className="text-xs gap-1 font-normal">
                      {att.isAudio ? <Mic className="h-3 w-3 text-amber-500" /> : <Paperclip className="h-3 w-3" />}
                      {att.name}
                    </Badge>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Settings tab ─────────────────────────────────────────────────────────────

// ─── Activity log tab ─────────────────────────────────────────────────────────

function ActivityLogTab() {
  const { t } = useI18n();
  const b = t.beratung;

  const logQuery = useQuery<ActivityLogEntry[]>({
    queryKey: ["/api/beratung/activity-log"],
    queryFn: async () => {
      const res = await fetch("/api/beratung/activity-log", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  const entries = logQuery.data || [];

  const actionMeta: Record<string, { label: string; cls: string }> = {
    forwarded: { label: b.actionForwarded, cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" },
    analyzed:  { label: b.actionAnalyzed,  cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
    reanalyzed:{ label: b.actionReanalyzed, cls: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400" },
    fetched:   { label: b.actionFetched,   cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{b.activityLog}</p>
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => logQuery.refetch()} disabled={logQuery.isFetching}>
          <RefreshCw className={`h-3.5 w-3.5 ${logQuery.isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {logQuery.isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-10 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-14">
          <Clock className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{b.logEmpty}</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden text-xs">
          {entries.map((entry, i) => {
            const meta = actionMeta[entry.action] ?? { label: entry.action, cls: "bg-muted text-muted-foreground" };
            return (
              <div key={entry.id} className={`flex items-center gap-2.5 px-3 py-2 ${i !== entries.length - 1 ? "border-b" : ""}`}>
                <Badge className={`${meta.cls} border-0 shrink-0 text-[10px] px-1.5 py-0 font-medium`}>{meta.label}</Badge>
                <Badge variant={entry.mode === "auto" ? "secondary" : "outline"} className="text-[10px] px-1.5 py-0 shrink-0">
                  {entry.mode === "auto" ? b.modeAuto : b.modeManual}
                </Badge>
                <span className="flex-1 text-muted-foreground truncate min-w-0">
                  {entry.email_subject || entry.detail || "—"}
                </span>
                <span className="text-muted-foreground/60 shrink-0 tabular-nums">
                  {new Date(entry.created_at).toLocaleString("sk-SK", {
                    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
                  })}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Settings tab ─────────────────────────────────────────────────────────────

function SettingsTab({ settings, onSaved }: { settings: BeratungSettings; onSaved: () => void }) {
  const { t } = useI18n();
  const b = t.beratung;
  const { toast } = useToast();
  const [forwardTo, setForwardTo] = useState<string[]>(settings.forward_to || []);
  const [newEmail, setNewEmail] = useState("");
  const [autoProcess, setAutoProcess] = useState(settings.auto_process);
  const [senderFilters, setSenderFilters] = useState<string[]>(settings.sender_filters || []);
  const [newFilter, setNewFilter] = useState("");
  const [filterPreviewCount, setFilterPreviewCount] = useState<number | null>(null);
  const [filterPreviewLoading, setFilterPreviewLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const aiStatusQuery = useQuery<{ ok: boolean; error: string | null; checkedAt: number }>({
    queryKey: ["/api/beratung/ai-status"],
    queryFn: async () => {
      const res = await fetch("/api/beratung/ai-status", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 5 * 60_000,
    refetchInterval: 6 * 60_000,
  });

  useEffect(() => {
    if (!newFilter.trim()) { setFilterPreviewCount(null); return; }
    setFilterPreviewLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/beratung/emails/filter-preview?q=${encodeURIComponent(newFilter.trim())}`, { credentials: "include" });
        const data = await res.json();
        setFilterPreviewCount(data.count ?? 0);
      } catch { setFilterPreviewCount(null); }
      setFilterPreviewLoading(false);
    }, 450);
    return () => clearTimeout(timer);
  }, [newFilter]);

  const saveMut = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", "/api/beratung/settings", {
        forward_to: forwardTo, auto_process: autoProcess, sender_filters: senderFilters,
      }).then(r => r.json()),
    onSuccess: () => { toast({ title: b.settingsSaved }); onSaved(); },
    onError: () => toast({ title: b.settingsError, variant: "destructive" }),
  });

  const connectMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/beratung/settings/connect", password ? { password } : {}).then(async r => {
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "Failed");
      return json;
    }),
    onSuccess: () => { toast({ title: b.connectSuccess }); setPassword(""); onSaved(); },
    onError: (err: any) => toast({ title: b.connectError, description: err?.message, variant: "destructive" }),
  });

  const disconnectMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/beratung/settings/disconnect").then(r => r.json()),
    onSuccess: () => { toast({ title: b.disconnectSuccess }); onSaved(); },
    onError: () => toast({ title: b.connectError, variant: "destructive" }),
  });

  const addEmail = () => {
    const v = newEmail.trim().toLowerCase();
    if (!v || !v.includes("@") || forwardTo.includes(v)) return;
    setForwardTo([...forwardTo, v]); setNewEmail("");
  };
  const addFilter = () => {
    const v = newFilter.trim();
    if (!v || senderFilters.includes(v)) return;
    setSenderFilters([...senderFilters, v]); setNewFilter("");
  };

  return (
    <div className="max-w-2xl space-y-5">

      {/* Connection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            {settings.has_token ? <Wifi className="h-4 w-4 text-emerald-500" /> : <WifiOff className="h-4 w-4 text-destructive" />}
            {b.settingsTitle}
          </CardTitle>
          <CardDescription className="text-xs">{b.settingsDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Password field */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5" />{b.passwordLabel}
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1 max-w-sm">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder={b.passwordPlaceholder}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && connectMut.mutate()}
                  className="pr-8 text-sm"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{b.passwordHint}</p>
          </div>

          {/* Status + action buttons */}
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
            <span className={`text-sm font-medium ${settings.has_token ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
              {settings.has_token ? b.connected : b.notConnected}
            </span>
            <div className="flex gap-2 ml-auto">
              {settings.has_token && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-destructive/50 text-destructive hover:bg-destructive/10"
                  onClick={() => disconnectMut.mutate()}
                  disabled={disconnectMut.isPending || connectMut.isPending}
                >
                  {disconnectMut.isPending
                    ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    : <WifiOff className="h-3 w-3 mr-1" />}
                  {b.disconnectBtn}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => connectMut.mutate()} disabled={connectMut.isPending || disconnectMut.isPending}>
                {connectMut.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Wifi className="h-3 w-3 mr-1" />}
                {b.reconnectBtn}
              </Button>
            </div>
          </div>
          {settings.last_checked_at && (
            <p className="text-xs text-muted-foreground">
              {b.lastChecked}: {new Date(settings.last_checked_at).toLocaleString("sk-SK")}
            </p>
          )}
          {/* AI status row */}
          <div className="flex items-center gap-2 pt-1">
            {aiStatusQuery.isLoading ? (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />{b.aiStatusChecking}
              </span>
            ) : aiStatusQuery.data ? (
              aiStatusQuery.data.ok ? (
                <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />{b.aiStatusOk}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs text-destructive font-medium">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {(aiStatusQuery.data.error === "insufficient_quota" || aiStatusQuery.data.error === "credit_balance_exhausted")
                    ? b.aiStatusNoCredit
                    : aiStatusQuery.data.error === "no_key"
                    ? b.aiStatusNoKey
                    : `${b.aiStatusError}: ${aiStatusQuery.data.error}`}
                </span>
              )
            ) : null}
            {aiStatusQuery.data && (
              <button
                className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                onClick={() => aiStatusQuery.refetch()}
              >
                {b.aiStatusRefresh}
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Forward recipients */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Send className="h-4 w-4" />{b.forwardTo}</CardTitle>
          <CardDescription className="text-xs">{b.forwardToHint}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="email@example.com" value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addEmail()} className="max-w-xs" />
            <Button size="sm" variant="outline" onClick={addEmail}><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {forwardTo.map(e => (
              <Badge key={e} variant="secondary" className="text-xs gap-1">
                {e}
                <button onClick={() => setForwardTo(forwardTo.filter(x => x !== e))} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
              </Badge>
            ))}
            {forwardTo.length === 0 && <span className="text-xs text-muted-foreground">{b.noRecipients}</span>}
          </div>
        </CardContent>
      </Card>

      {/* Sender filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Filter className="h-4 w-4" />{b.senderFilters}</CardTitle>
          <CardDescription className="text-xs">{b.senderFiltersHint}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Input placeholder={b.senderFilterPlaceholder} value={newFilter}
              onChange={e => setNewFilter(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addFilter()} className="max-w-xs" />
            <Button size="sm" variant="outline" onClick={addFilter}><Plus className="h-4 w-4" /></Button>
            {filterPreviewLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            {!filterPreviewLoading && filterPreviewCount !== null && (
              <span className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{filterPreviewCount}</span> {b.filterMatches}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {senderFilters.map(f => (
              <Badge key={f} variant="outline" className="text-xs gap-1 border-amber-400 text-amber-700 dark:text-amber-400">
                <Filter className="h-3 w-3" /> {f}
                <button onClick={() => setSenderFilters(senderFilters.filter(x => x !== f))} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
              </Badge>
            ))}
            {senderFilters.length === 0 && <span className="text-xs text-muted-foreground">{b.noSenderFilters}</span>}
          </div>
        </CardContent>
      </Card>

      {/* Auto-process */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-semibold">{b.autoProcess}</Label>
              <p className="text-xs text-muted-foreground mt-1">{b.autoProcessHint}</p>
            </div>
            <Switch checked={autoProcess} onCheckedChange={setAutoProcess} />
          </div>
          {autoProcess && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400">{b.autoProcessWarning}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
          {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {b.saveSettings}
        </Button>
      </div>
    </div>
  );
}

// ─── Email list tab ───────────────────────────────────────────────────────────

function EmailListTab({ autoProcess, settingsLoading }: { autoProcess: boolean; settingsLoading: boolean }) {
  const { t } = useI18n();
  const b = t.beratung;
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");

  const applySearch = () => { setQ(searchInput.trim()); setPage(1); };
  const clearSearch = () => { setSearchInput(""); setQ(""); setPage(1); };

  const emailsQuery = useQuery<{ emails: BeratungEmail[]; total: number; page: number; limit: number }>({
    queryKey: ["/api/beratung/emails", page, statusFilter, q],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "25" });
      if (statusFilter) params.set("status", statusFilter);
      if (q) params.set("q", q);
      const res = await fetch(`/api/beratung/emails?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const fetchMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/beratung/fetch").then(r => r.json()),
    onSuccess: (data) => {
      toast({ title: data.inserted > 0 ? `${b.fetchSuccess}: ${data.inserted}` : b.noNewEmails });
      queryClient.invalidateQueries({ queryKey: ["/api/beratung/emails"] });
      queryClient.invalidateQueries({ queryKey: ["/api/beratung/settings"] });
    },
    onError: () => toast({ title: b.fetchError, variant: "destructive" }),
  });

  const emails = emailsQuery.data?.emails || [];
  const total = emailsQuery.data?.total || 0;
  const limit = 25;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const statusMeta = [
    { key: "", label: b.filterAll },
    { key: "new", label: b.statusNew },
    { key: "translated", label: b.statusTranslated },
    { key: "forwarded", label: b.statusForwarded },
  ];

  return (
    <div className="space-y-3">
      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Search */}
        <div className="flex gap-1.5 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={b.searchPlaceholder}
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && applySearch()}
              className="pl-8 h-9 text-sm"
            />
          </div>
          {q ? (
            <Button size="sm" variant="ghost" className="h-9 px-2" onClick={clearSearch}>
              <X className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="h-9" onClick={applySearch}>
              {b.searchBtn}
            </Button>
          )}
        </div>

        {/* Right: filters + check now */}
        <div className="flex gap-1.5 items-center flex-wrap">
          {statusMeta.map(s => (
            <Button
              key={s.key}
              size="sm"
              variant={statusFilter === s.key ? "default" : "ghost"}
              className="h-8 px-3 text-xs"
              onClick={() => { setStatusFilter(s.key); setPage(1); }}
            >
              {s.label}
            </Button>
          ))}
          <div className="w-px h-5 bg-border mx-1" />
          <Button size="sm" variant="outline" onClick={() => fetchMut.mutate()} disabled={fetchMut.isPending} className="h-8">
            {fetchMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
            {b.fetchNow}
          </Button>
        </div>
      </div>

      {/* Count + active search indicator */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{total} {b.total}</span>
        {q && (
          <Badge variant="secondary" className="text-xs gap-1 font-normal">
            <Search className="h-3 w-3" />{q}
          </Badge>
        )}
      </div>

      {/* ── Email list ── */}
      {emailsQuery.isLoading || settingsLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-16 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" /> {b.loading}
        </div>
      ) : emails.length === 0 ? (
        <div className="text-center py-16">
          <Mail className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{b.noEmails}</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden bg-background shadow-sm">
          {emails.map(email => (
            <EmailCard key={email.id} email={email} autoProcess={autoProcess} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-1">
          <Button size="sm" variant="outline" className="h-8" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹ Predchádzajúca</Button>
          <span className="text-xs text-muted-foreground px-2">{page} / {totalPages}</span>
          <Button size="sm" variant="outline" className="h-8" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Ďalšia ›</Button>
        </div>
      )}
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export function BeratungEmailTab() {
  const { t } = useI18n();
  const b = t.beratung;

  const settingsQuery = useQuery<BeratungSettings>({
    queryKey: ["/api/beratung/settings"],
    queryFn: async () => {
      const res = await fetch("/api/beratung/settings", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 20_000,
    refetchInterval: 30_000,
  });

  const settings = settingsQuery.data;
  const autoProcess = settings?.auto_process || false;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Mail className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-sm leading-tight">beratung@cordbloodcenter.com</h3>
            <p className="text-xs text-muted-foreground">{b.description}</p>
          </div>
        </div>
        {autoProcess && (
          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 gap-1 ml-auto">
            <CheckCircle2 className="h-3 w-3" />{b.autoActive}
          </Badge>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="emails">
        <TabsList className="h-9">
          <TabsTrigger value="emails" className="gap-1.5 text-xs">
            <Inbox className="h-3.5 w-3.5" />{b.tabEmails}
          </TabsTrigger>
          <TabsTrigger value="log" className="gap-1.5 text-xs">
            <ListChecks className="h-3.5 w-3.5" />{b.tabLog}
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5 text-xs">
            <Settings className="h-3.5 w-3.5" />{b.tabSettings}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="emails" className="mt-4">
          <EmailListTab autoProcess={autoProcess} settingsLoading={settingsQuery.isLoading} />
        </TabsContent>

        <TabsContent value="log" className="mt-4">
          <ActivityLogTab />
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          {settingsQuery.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {b.loading}
            </div>
          ) : (
            <SettingsTab
              settings={settings || { forward_to: [], auto_process: false, sender_filters: [], last_checked_at: null, has_token: false }}
              onSaved={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/beratung/settings"] });
                queryClient.invalidateQueries({ queryKey: ["/api/beratung/emails"] });
              }}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
