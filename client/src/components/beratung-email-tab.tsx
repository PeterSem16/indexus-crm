/**
 * Beratung Email Monitor Tab
 * Used inside the Configurator page → Notifications & Automations area.
 * Tabs: Správy | Nastavenia
 */

import { useState, useCallback } from "react";
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
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Loader2, RefreshCw, ChevronDown, ChevronRight,
  Mail, Send, Languages, CheckCircle2, Clock, AlertCircle,
  X, Plus, Wifi, WifiOff, Mic, Filter, Search, RotateCcw, Settings, Inbox,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: BeratungEmail["status"] }) {
  const { t } = useI18n();
  const b = t.beratung;
  if (status === "forwarded") return (
    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 gap-1">
      <CheckCircle2 className="h-3 w-3" />{b.statusForwarded}
    </Badge>
  );
  if (status === "translated") return (
    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 gap-1">
      <Languages className="h-3 w-3" />{b.statusTranslated}
    </Badge>
  );
  return (
    <Badge variant="outline" className="text-muted-foreground gap-1">
      <Clock className="h-3 w-3" />{b.statusNew}
    </Badge>
  );
}

// ─── Email row ────────────────────────────────────────────────────────────────

function EmailRow({ email, autoProcess }: { email: BeratungEmail; autoProcess: boolean }) {
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
    onSuccess: () => {
      toast({ title: b.translateSuccess });
      invalidate();
      setDetail(null);
    },
    onError: () => toast({ title: b.translateError, variant: "destructive" }),
  });

  const forwardMut = useMutation({
    mutationFn: () => apiRequest("POST", `/api/beratung/emails/${email.id}/forward`).then(r => r.json()),
    onSuccess: () => {
      toast({ title: b.forwardSuccess });
      invalidate();
      setDetail(null);
    },
    onError: () => toast({ title: b.forwardError, variant: "destructive" }),
  });

  const reanalyzeMut = useMutation({
    mutationFn: () => apiRequest("POST", `/api/beratung/emails/${email.id}/reanalyze`).then(r => r.json()),
    onSuccess: () => {
      toast({ title: b.reanalyzeSuccess });
      invalidate();
      setDetail(null); // reload detail on next open
    },
    onError: () => toast({ title: b.reanalyzeError, variant: "destructive" }),
  });

  const handleOpen = async (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && !detail) {
      setLoadingDetail(true);
      try {
        const res = await fetch(`/api/beratung/emails/${email.id}`, { credentials: "include" });
        if (res.ok) setDetail(await res.json());
      } finally {
        setLoadingDetail(false);
      }
    }
  };

  const receivedStr = email.received_at
    ? new Date(email.received_at).toLocaleString("sk-SK", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "";

  const audioAtts = detail?.attachment_summaries?.filter(a => a.isAudio) || [];
  const isProcessing = translateMut.isPending || forwardMut.isPending || reanalyzeMut.isPending;

  return (
    <Collapsible open={open} onOpenChange={handleOpen}>
      <CollapsibleTrigger asChild>
        <TableRow className="cursor-pointer hover:bg-muted/50 select-none">
          <TableCell className="w-6 pl-3">
            {open
              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </TableCell>
          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{receivedStr}</TableCell>
          <TableCell className="max-w-[180px]">
            <div className="text-sm font-medium truncate">{email.from_name || email.from_address}</div>
            <div className="text-xs text-muted-foreground truncate">{email.from_address}</div>
          </TableCell>
          <TableCell className="max-w-[280px]">
            <span className="text-sm truncate block">{email.subject || "(bez predmetu)"}</span>
            {email.has_attachments && (
              <span className="text-xs text-muted-foreground">{email.attachment_count} príloha/y</span>
            )}
          </TableCell>
          <TableCell><StatusBadge status={email.status} /></TableCell>
          <TableCell className="text-right pr-3">
            <div className="flex gap-1 justify-end" onClick={e => e.stopPropagation()}>
              {/* Re-analyze — always available */}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => reanalyzeMut.mutate()}
                disabled={isProcessing}
                title={b.reanalyzeBtn}
              >
                {reanalyzeMut.isPending
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <RotateCcw className="h-3 w-3" />}
              </Button>

              {!autoProcess && (
                <>
                  {email.status === "new" && (
                    <Button size="sm" variant="outline" onClick={() => translateMut.mutate()} disabled={isProcessing}>
                      {translateMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Languages className="h-3 w-3" />}
                      <span className="ml-1 hidden sm:inline">{b.analyzeBtn}</span>
                    </Button>
                  )}
                  {(email.status === "translated" || email.status === "new") && (
                    <Button size="sm" onClick={() => forwardMut.mutate()} disabled={isProcessing}>
                      {forwardMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                      <span className="ml-1 hidden sm:inline">{b.forwardBtn}</span>
                    </Button>
                  )}
                </>
              )}
            </div>
          </TableCell>
        </TableRow>
      </CollapsibleTrigger>

      <CollapsibleContent asChild>
        <tr>
          <td colSpan={6} className="p-0">
            <div className="bg-muted/20 border-t border-b px-6 py-5 space-y-4">
              {loadingDetail ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> {b.loading}
                </div>
              ) : (
                <>
                  {/* ── Audio / Voicemail section ─────────────────────────── */}
                  {audioAtts.length > 0 && (
                    <div className="rounded-xl border-2 border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/25 overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-3 bg-amber-100 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-700">
                        <Mic className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                          🎙️ {b.audioTranscription}
                        </span>
                      </div>
                      {audioAtts.map((att, i) => (
                        <div key={i} className="px-4 py-4 space-y-3">
                          <div className="text-xs font-semibold text-amber-700 dark:text-amber-400">{att.name}</div>

                          {/* AI Summary */}
                          {att.aiSummary && (
                            <div className="rounded-lg bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-700 px-3 py-3">
                              <div className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-1.5">💡 {b.aiSummary}</div>
                              <div className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">{att.aiSummary}</div>
                            </div>
                          )}

                          {/* Full transcript */}
                          {att.transcription && (
                            <div>
                              <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1.5">📝 {b.fullTranscript}</div>
                              <div className="text-sm whitespace-pre-wrap break-words text-amber-900 dark:text-amber-200 leading-relaxed">
                                {att.transcription}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Translations grid ─────────────────────────────────── */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Original */}
                    <div className="rounded-lg border overflow-hidden">
                      <div className="px-3 py-2 bg-muted/60 border-b text-xs font-semibold flex items-center gap-1">🇩🇪 {b.original}</div>
                      <div className="text-sm bg-background p-3 max-h-64 overflow-y-auto whitespace-pre-wrap break-words leading-relaxed">
                        {detail?.body_text || (detail?.body_html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || ""}
                      </div>
                    </div>

                    {/* SK */}
                    <div className="rounded-lg border overflow-hidden">
                      <div className="px-3 py-2 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900 text-xs font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-1">🇸🇰 {b.translationSk}</div>
                      {detail?.translated_sk
                        ? <div className="text-sm bg-background p-3 max-h-64 overflow-y-auto whitespace-pre-wrap leading-relaxed">{detail.translated_sk}</div>
                        : <div className="text-sm text-muted-foreground italic p-3">{b.notYetTranslated}</div>
                      }
                    </div>

                    {/* CS */}
                    <div className="rounded-lg border overflow-hidden">
                      <div className="px-3 py-2 bg-red-50 dark:bg-red-950/20 border-b border-red-100 dark:border-red-900 text-xs font-semibold text-red-800 dark:text-red-300 flex items-center gap-1">🇨🇿 {b.translationCs}</div>
                      {detail?.translated_cs
                        ? <div className="text-sm bg-background p-3 max-h-64 overflow-y-auto whitespace-pre-wrap leading-relaxed">{detail.translated_cs}</div>
                        : <div className="text-sm text-muted-foreground italic p-3">{b.notYetTranslated}</div>
                      }
                    </div>
                  </div>

                  {/* Attachment chips */}
                  {email.attachment_count > 0 && email.attachment_summaries?.length && (
                    <div className="flex gap-2 flex-wrap pt-1">
                      {email.attachment_summaries.map((att, i) => (
                        <Badge key={i} variant="secondary" className="text-xs gap-1">
                          {att.isAudio ? <Mic className="h-3 w-3" /> : "📎"}
                          {att.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </td>
        </tr>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Settings tab ─────────────────────────────────────────────────────────────

function SettingsTab({
  settings,
  onSaved,
}: {
  settings: BeratungSettings;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const b = t.beratung;
  const { toast } = useToast();
  const [forwardTo, setForwardTo] = useState<string[]>(settings.forward_to || []);
  const [newEmail, setNewEmail] = useState("");
  const [autoProcess, setAutoProcess] = useState(settings.auto_process);
  const [senderFilters, setSenderFilters] = useState<string[]>(settings.sender_filters || []);
  const [newFilter, setNewFilter] = useState("");

  const saveMut = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", "/api/beratung/settings", {
        forward_to: forwardTo,
        auto_process: autoProcess,
        sender_filters: senderFilters,
      }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: b.settingsSaved });
      onSaved();
    },
    onError: () => toast({ title: b.settingsError, variant: "destructive" }),
  });

  const connectMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/beratung/settings/connect").then(r => r.json()),
    onSuccess: () => {
      toast({ title: b.connectSuccess });
      onSaved();
    },
    onError: (err: any) => toast({ title: b.connectError, description: err?.message, variant: "destructive" }),
  });

  const addEmail = () => {
    const v = newEmail.trim().toLowerCase();
    if (!v || !v.includes("@") || forwardTo.includes(v)) return;
    setForwardTo([...forwardTo, v]);
    setNewEmail("");
  };

  const addFilter = () => {
    const v = newFilter.trim();
    if (!v || senderFilters.includes(v)) return;
    setSenderFilters([...senderFilters, v]);
    setNewFilter("");
  };

  return (
    <div className="max-w-2xl space-y-8">

      {/* ── Connection ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            {settings.has_token
              ? <Wifi className="h-4 w-4 text-green-500" />
              : <WifiOff className="h-4 w-4 text-destructive" />}
            {b.settingsTitle}
          </CardTitle>
          <CardDescription className="text-xs">{b.settingsDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
            {settings.has_token ? (
              <span className="text-sm text-green-600 dark:text-green-400 font-medium">{b.connected}</span>
            ) : (
              <span className="text-sm text-destructive font-medium">{b.notConnected}</span>
            )}
            <Button size="sm" variant="outline" onClick={() => connectMut.mutate()} disabled={connectMut.isPending} className="ml-auto">
              {connectMut.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Wifi className="h-3 w-3 mr-1" />}
              {b.reconnectBtn}
            </Button>
          </div>
          {settings.last_checked_at && (
            <p className="text-xs text-muted-foreground">
              {b.lastChecked}: {new Date(settings.last_checked_at).toLocaleString("sk-SK")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Forward recipients ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Send className="h-4 w-4" />
            {b.forwardTo}
          </CardTitle>
          <CardDescription className="text-xs">{b.forwardToHint}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="email@example.com"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addEmail()}
              className="max-w-xs"
            />
            <Button size="sm" variant="outline" onClick={addEmail}><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {forwardTo.map(email => (
              <Badge key={email} variant="secondary" className="text-xs gap-1">
                {email}
                <button onClick={() => setForwardTo(forwardTo.filter(e => e !== email))} className="ml-0.5 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {forwardTo.length === 0 && <span className="text-xs text-muted-foreground">{b.noRecipients}</span>}
          </div>
        </CardContent>
      </Card>

      {/* ── Sender filters ─────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4" />
            {b.senderFilters}
          </CardTitle>
          <CardDescription className="text-xs">{b.senderFiltersHint}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder={b.senderFilterPlaceholder}
              value={newFilter}
              onChange={e => setNewFilter(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addFilter()}
              className="max-w-xs"
            />
            <Button size="sm" variant="outline" onClick={addFilter}><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {senderFilters.map(f => (
              <Badge key={f} variant="outline" className="text-xs gap-1 border-amber-400 text-amber-700 dark:text-amber-400">
                <Filter className="h-3 w-3" /> {f}
                <button onClick={() => setSenderFilters(senderFilters.filter(x => x !== f))} className="ml-0.5 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {senderFilters.length === 0 && <span className="text-xs text-muted-foreground">{b.noSenderFilters}</span>}
          </div>
        </CardContent>
      </Card>

      {/* ── Auto-process ───────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-6 space-y-4">
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

function EmailListTab({
  autoProcess,
  settingsLoading,
}: {
  autoProcess: boolean;
  settingsLoading: boolean;
}) {
  const { t } = useI18n();
  const b = t.beratung;
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [senderSearch, setSenderSearch] = useState("");
  const [senderInput, setSenderInput] = useState("");

  const emailsQuery = useQuery<{ emails: BeratungEmail[]; total: number; page: number; limit: number }>({
    queryKey: ["/api/beratung/emails", page, statusFilter, senderSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "25" });
      if (statusFilter) params.set("status", statusFilter);
      if (senderSearch) params.set("sender", senderSearch);
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

  const applySearch = () => {
    setSenderSearch(senderInput.trim());
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Sender search */}
        <div className="flex gap-1.5">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={b.senderSearch}
              value={senderInput}
              onChange={e => setSenderInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && applySearch()}
              className="pl-8 h-8 text-xs w-52"
            />
          </div>
          {senderSearch && (
            <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => {
              setSenderSearch("");
              setSenderInput("");
              setPage(1);
            }}>
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Status filter buttons */}
        <div className="flex gap-1 ml-auto flex-wrap">
          {(["", "new", "translated", "forwarded"] as const).map(s => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? "default" : "outline"}
              className="text-xs h-8 px-2.5"
              onClick={() => { setStatusFilter(s); setPage(1); }}
            >
              {s === "" ? b.filterAll : s === "new" ? b.statusNew : s === "translated" ? b.statusTranslated : b.statusForwarded}
            </Button>
          ))}
        </div>

        {/* Fetch now */}
        <Button size="sm" variant="outline" onClick={() => fetchMut.mutate()} disabled={fetchMut.isPending} className="h-8">
          {fetchMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
          {b.fetchNow}
        </Button>
      </div>

      {/* Count */}
      <div className="text-xs text-muted-foreground">
        {total} {b.total}
        {senderSearch && <span className="ml-1">· <span className="font-medium">{senderSearch}</span></span>}
      </div>

      {/* Table */}
      {emailsQuery.isLoading || settingsLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" /> {b.loading}
        </div>
      ) : emails.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">{b.noEmails}</div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-6 pl-3" />
                <TableHead className="text-xs">{b.colReceived}</TableHead>
                <TableHead className="text-xs">{b.colFrom}</TableHead>
                <TableHead className="text-xs">{b.colSubject}</TableHead>
                <TableHead className="text-xs">{b.colStatus}</TableHead>
                <TableHead className="text-xs text-right pr-3">{b.colActions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emails.map(email => (
                <EmailRow key={email.id} email={email} autoProcess={autoProcess} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</Button>
          <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
          <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>›</Button>
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
    staleTime: 60_000,
  });

  const settings = settingsQuery.data;
  const autoProcess = settings?.auto_process || false;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-blue-600" />
          <div>
            <h3 className="font-semibold text-base">beratung@cordbloodcenter.com</h3>
            <p className="text-xs text-muted-foreground">{b.description}</p>
          </div>
        </div>
        {autoProcess && (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs gap-1">
            <CheckCircle2 className="h-3 w-3" />{b.autoActive}
          </Badge>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="emails">
        <TabsList>
          <TabsTrigger value="emails" className="gap-1.5">
            <Inbox className="h-3.5 w-3.5" />
            {b.tabEmails}
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            {b.tabSettings}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="emails" className="mt-4">
          <EmailListTab autoProcess={autoProcess} settingsLoading={settingsQuery.isLoading} />
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          {settingsQuery.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {b.loading}</div>
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
