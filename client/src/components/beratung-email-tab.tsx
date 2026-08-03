/**
 * Beratung Email Monitor Tab
 * Used inside the Configurator page → Notifications & Automations area.
 */

import { useState } from "react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, RefreshCw, ChevronDown, ChevronRight, Mail, Send, Languages, CheckCircle2, Clock, AlertCircle, X, Plus, Wifi, WifiOff, Mic, Filter } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  attachment_summaries?: Array<{ name: string; contentType: string; hasText: boolean; isAudio: boolean; transcription?: string | null }>;
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
  if (status === "forwarded") return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"><CheckCircle2 className="h-3 w-3 mr-1" />{b.statusForwarded}</Badge>;
  if (status === "translated") return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"><Languages className="h-3 w-3 mr-1" />{b.statusTranslated}</Badge>;
  return <Badge variant="outline" className="text-muted-foreground"><Clock className="h-3 w-3 mr-1" />{b.statusNew}</Badge>;
}

// ─── Email row ────────────────────────────────────────────────────────────────

function EmailRow({ email, autoProcess }: { email: BeratungEmail; autoProcess: boolean }) {
  const { t } = useI18n();
  const b = t.beratung;
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<BeratungEmail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const translateMut = useMutation({
    mutationFn: () => apiRequest("POST", `/api/beratung/emails/${email.id}/translate`).then(r => r.json()),
    onSuccess: () => {
      toast({ title: b.translateSuccess });
      queryClient.invalidateQueries({ queryKey: ["/api/beratung/emails"] });
      setDetail(null); // will reload
    },
    onError: () => toast({ title: b.translateError, variant: "destructive" }),
  });

  const forwardMut = useMutation({
    mutationFn: () => apiRequest("POST", `/api/beratung/emails/${email.id}/forward`).then(r => r.json()),
    onSuccess: () => {
      toast({ title: b.forwardSuccess });
      queryClient.invalidateQueries({ queryKey: ["/api/beratung/emails"] });
      setDetail(null);
    },
    onError: () => toast({ title: b.forwardError, variant: "destructive" }),
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
    ? new Date(email.received_at).toLocaleString("sk-SK", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <Collapsible open={open} onOpenChange={handleOpen}>
      <CollapsibleTrigger asChild>
        <TableRow className="cursor-pointer hover:bg-muted/50 select-none">
          <TableCell className="w-6">
            {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </TableCell>
          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{receivedStr}</TableCell>
          <TableCell className="max-w-[200px]">
            <div className="text-sm font-medium truncate">{email.from_name || email.from_address}</div>
            <div className="text-xs text-muted-foreground truncate">{email.from_address}</div>
          </TableCell>
          <TableCell className="max-w-[300px]">
            <span className="text-sm truncate block">{email.subject || "(bez predmetu)"}</span>
            {email.has_attachments && (
              <span className="text-xs text-muted-foreground">{email.attachment_count} príloha/y</span>
            )}
          </TableCell>
          <TableCell><StatusBadge status={email.status} /></TableCell>
          <TableCell className="text-right">
            {!autoProcess && (
              <div className="flex gap-1 justify-end" onClick={e => e.stopPropagation()}>
                {email.status === "new" && (
                  <Button size="sm" variant="outline" onClick={() => translateMut.mutate()} disabled={translateMut.isPending}>
                    {translateMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Languages className="h-3 w-3" />}
                    <span className="ml-1 hidden sm:inline">{b.analyzeBtn}</span>
                  </Button>
                )}
                {(email.status === "translated" || email.status === "new") && (
                  <Button size="sm" onClick={() => forwardMut.mutate()} disabled={forwardMut.isPending}>
                    {forwardMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    <span className="ml-1 hidden sm:inline">{b.forwardBtn}</span>
                  </Button>
                )}
              </div>
            )}
          </TableCell>
        </TableRow>
      </CollapsibleTrigger>

      <CollapsibleContent asChild>
        <tr>
          <td colSpan={6} className="p-0">
            <div className="bg-muted/30 border-t px-6 py-4">
              {loadingDetail ? (
                <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {b.loading}</div>
              ) : (
                <>
                  {/* Audio transcription panel — voicemail from A1 Mobilbox etc. */}
                  {detail?.audio_transcription && (
                    <div className="mb-4 p-3 rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-700">
                      <div className="text-xs font-semibold mb-2 flex items-center gap-1 text-amber-800 dark:text-amber-300">
                        <Mic className="h-3 w-3" /> {b.audioTranscription}
                      </div>
                      <div className="text-sm whitespace-pre-wrap break-words text-amber-900 dark:text-amber-200">{detail.audio_transcription}</div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Original — plain text, no dangerouslySetInnerHTML */}
                    <div>
                      <div className="text-xs font-semibold mb-2 flex items-center gap-1">🇩🇪 {b.original}</div>
                      <div className="text-sm bg-background rounded border p-3 max-h-60 overflow-y-auto whitespace-pre-wrap break-words">
                        {detail?.body_text || (detail?.body_html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || ""}
                      </div>
                    </div>

                    {/* SK */}
                    <div>
                      <div className="text-xs font-semibold mb-2 flex items-center gap-1">🇸🇰 {b.translationSk}</div>
                      {detail?.translated_sk ? (
                        <div className="text-sm bg-background rounded border p-3 max-h-60 overflow-y-auto whitespace-pre-wrap">{detail.translated_sk}</div>
                      ) : (
                        <div className="text-sm text-muted-foreground italic p-3 border rounded">{b.notYetTranslated}</div>
                      )}
                    </div>

                    {/* CS */}
                    <div>
                      <div className="text-xs font-semibold mb-2 flex items-center gap-1">🇨🇿 {b.translationCs}</div>
                      {detail?.translated_cs ? (
                        <div className="text-sm bg-background rounded border p-3 max-h-60 overflow-y-auto whitespace-pre-wrap">{detail.translated_cs}</div>
                      ) : (
                        <div className="text-sm text-muted-foreground italic p-3 border rounded">{b.notYetTranslated}</div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Attachment list */}
              {email.attachment_count > 0 && email.attachment_summaries?.length && (
                <div className="mt-3 flex gap-2 flex-wrap">
                  {email.attachment_summaries.map((att, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {att.isAudio ? <Mic className="h-3 w-3 mr-1" /> : "📎"} {att.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </td>
        </tr>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Settings panel ───────────────────────────────────────────────────────────

function SettingsPanel({ settings, onSaved }: { settings: BeratungSettings; onSaved: () => void }) {
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
      apiRequest("PATCH", "/api/beratung/settings", { forward_to: forwardTo, auto_process: autoProcess, sender_filters: senderFilters }).then(r => r.json()),
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
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) return;
    if (forwardTo.includes(email)) return;
    setForwardTo([...forwardTo, email]);
    setNewEmail("");
  };

  return (
    <div className="space-y-6">
      {/* Connection status */}
      <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
        {settings.has_token ? (
          <><Wifi className="h-4 w-4 text-green-500" /><span className="text-sm text-green-600 dark:text-green-400">{b.connected}</span></>
        ) : (
          <><WifiOff className="h-4 w-4 text-destructive" /><span className="text-sm text-destructive">{b.notConnected}</span></>
        )}
        <div className="ml-auto">
          <Button size="sm" variant="outline" onClick={() => connectMut.mutate()} disabled={connectMut.isPending}>
            {connectMut.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Wifi className="h-3 w-3 mr-1" />}
            {b.reconnectBtn}
          </Button>
        </div>
      </div>

      {/* Last checked */}
      {settings.last_checked_at && (
        <p className="text-xs text-muted-foreground">
          {b.lastChecked}: {new Date(settings.last_checked_at).toLocaleString("sk-SK")}
        </p>
      )}

      <Separator />

      {/* Forward-to list */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">{b.forwardTo}</Label>
        <p className="text-xs text-muted-foreground">{b.forwardToHint}</p>
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
            <Badge key={email} variant="secondary" className="text-xs flex items-center gap-1">
              {email}
              <button onClick={() => setForwardTo(forwardTo.filter(e => e !== email))} className="ml-1 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {forwardTo.length === 0 && <span className="text-xs text-muted-foreground">{b.noRecipients}</span>}
        </div>
      </div>

      <Separator />

      {/* Sender filters */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold flex items-center gap-1"><Filter className="h-3.5 w-3.5" /> {b.senderFilters}</Label>
        <p className="text-xs text-muted-foreground">{b.senderFiltersHint}</p>
        <div className="flex gap-2">
          <Input
            placeholder={b.senderFilterPlaceholder}
            value={newFilter}
            onChange={e => setNewFilter(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") {
                const v = newFilter.trim();
                if (v && !senderFilters.includes(v)) { setSenderFilters([...senderFilters, v]); setNewFilter(""); }
              }
            }}
            className="max-w-xs"
          />
          <Button size="sm" variant="outline" onClick={() => {
            const v = newFilter.trim();
            if (v && !senderFilters.includes(v)) { setSenderFilters([...senderFilters, v]); setNewFilter(""); }
          }}><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {senderFilters.map(f => (
            <Badge key={f} variant="outline" className="text-xs flex items-center gap-1 border-amber-400 text-amber-700 dark:text-amber-400">
              <Filter className="h-3 w-3" /> {f}
              <button onClick={() => setSenderFilters(senderFilters.filter(x => x !== f))} className="ml-1 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {senderFilters.length === 0 && <span className="text-xs text-muted-foreground">{b.noSenderFilters}</span>}
        </div>
      </div>

      <Separator />

      {/* Auto-process toggle */}
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

      <div className="flex justify-end">
        <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
          {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {b.saveSettings}
        </Button>
      </div>
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export function BeratungEmailTab() {
  const { t } = useI18n();
  const b = t.beratung;
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const emailsQuery = useQuery<{ emails: BeratungEmail[]; total: number; page: number; limit: number }>({
    queryKey: ["/api/beratung/emails", page, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "25" });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/beratung/emails?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const settingsQuery = useQuery<BeratungSettings>({
    queryKey: ["/api/beratung/settings"],
    queryFn: async () => {
      const res = await fetch("/api/beratung/settings", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 60_000,
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
  const autoProcess = settingsQuery.data?.auto_process || false;

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-semibold text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            beratung@cordbloodcenter.com
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">{b.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {autoProcess && (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs">
              <CheckCircle2 className="h-3 w-3 mr-1" />{b.autoActive}
            </Badge>
          )}
          <Button size="sm" variant="outline" onClick={() => fetchMut.mutate()} disabled={fetchMut.isPending}>
            {fetchMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            {b.fetchNow}
          </Button>
        </div>
      </div>

      {/* Two-column layout: email list + settings */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Email list (2/3) */}
        <div className="xl:col-span-2 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{b.emailList}</span>
            <span className="text-xs text-muted-foreground">({total} {b.total})</span>
            <div className="ml-auto flex gap-1">
              {["", "new", "translated", "forwarded"].map(s => (
                <Button
                  key={s}
                  size="sm"
                  variant={statusFilter === s ? "default" : "outline"}
                  className="text-xs h-7 px-2"
                  onClick={() => { setStatusFilter(s); setPage(1); }}
                >
                  {s === "" ? b.filterAll : s === "new" ? b.statusNew : s === "translated" ? b.statusTranslated : b.statusForwarded}
                </Button>
              ))}
            </div>
          </div>

          {emailsQuery.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> {b.loading}
            </div>
          ) : emails.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">{b.noEmails}</div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-6" />
                    <TableHead className="text-xs">{b.colReceived}</TableHead>
                    <TableHead className="text-xs">{b.colFrom}</TableHead>
                    <TableHead className="text-xs">{b.colSubject}</TableHead>
                    <TableHead className="text-xs">{b.colStatus}</TableHead>
                    <TableHead className="text-xs text-right">{b.colActions}</TableHead>
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

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</Button>
              <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
              <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>›</Button>
            </div>
          )}
        </div>

        {/* Settings (1/3) */}
        <div>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{b.settingsTitle}</CardTitle>
              <CardDescription className="text-xs">{b.settingsDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              {settingsQuery.isLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {b.loading}</div>
              ) : (
                <SettingsPanel
                  settings={settingsQuery.data || { forward_to: [], auto_process: false, last_checked_at: null, has_token: false }}
                  onSaved={() => {
                    queryClient.invalidateQueries({ queryKey: ["/api/beratung/settings"] });
                    queryClient.invalidateQueries({ queryKey: ["/api/beratung/emails"] });
                  }}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
