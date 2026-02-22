import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Phone, PhoneIncoming, PhoneMissed, PhoneOff, Clock, Users, BarChart3, TrendingUp, AlertTriangle, CheckCircle2, XCircle, Timer, Download } from "lucide-react";
import { format } from "date-fns";
import { sk } from "date-fns/locale";

function formatDuration(seconds: number): string {
  if (!seconds) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDurationLong(seconds: number): string {
  if (!seconds) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

const statusLabels: Record<string, string> = {
  queued: "Vo fronte",
  ringing: "Zvoní",
  answered: "Zodvihnutý",
  completed: "Dokončený",
  abandoned: "Zmeškaný",
  timeout: "Časový limit",
  overflow: "Presmerovanie",
};

const abandonReasonLabels: Record<string, string> = {
  caller_hangup: "Volajúci zavesil",
  timeout: "Prekročený čas čakania",
  overflow: "Presmerovanie (preplnenie)",
};

const statusColors: Record<string, string> = {
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  answered: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  abandoned: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  timeout: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  overflow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  queued: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  ringing: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

export function InboundReportsTab() {
  const [selectedQueueId, setSelectedQueueId] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [activeTab, setActiveTab] = useState("dashboard");

  const queueIdParam = selectedQueueId === "all" ? "" : selectedQueueId;
  const fromParam = dateFrom ? new Date(dateFrom).toISOString() : "";
  const toParam = dateTo ? new Date(dateTo + "T23:59:59").toISOString() : "";

  const { data: queues = [] } = useQuery<any[]>({
    queryKey: ["/api/inbound-queues"],
  });

  const { data: summary, isLoading: summaryLoading } = useQuery<any>({
    queryKey: ["/api/inbound-reports/summary", queueIdParam, fromParam, toParam],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (queueIdParam) params.set("queueId", queueIdParam);
      if (fromParam) params.set("from", fromParam);
      if (toParam) params.set("to", toParam);
      const res = await fetch(`/api/inbound-reports/summary?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json();
    },
  });

  const { data: missedCalls = [], isLoading: missedLoading } = useQuery<any[]>({
    queryKey: ["/api/inbound-reports/missed-calls", queueIdParam, fromParam, toParam],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (queueIdParam) params.set("queueId", queueIdParam);
      if (fromParam) params.set("from", fromParam);
      if (toParam) params.set("to", toParam);
      const res = await fetch(`/api/inbound-reports/missed-calls?${params}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: hourlyStats = [], isLoading: hourlyLoading } = useQuery<any[]>({
    queryKey: ["/api/inbound-reports/hourly", queueIdParam, fromParam, toParam],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (queueIdParam) params.set("queueId", queueIdParam);
      if (fromParam) params.set("from", fromParam);
      if (toParam) params.set("to", toParam);
      const res = await fetch(`/api/inbound-reports/hourly?${params}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: agentStats = [], isLoading: agentsLoading } = useQuery<any[]>({
    queryKey: ["/api/inbound-reports/agents", queueIdParam, fromParam, toParam],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (queueIdParam) params.set("queueId", queueIdParam);
      if (fromParam) params.set("from", fromParam);
      if (toParam) params.set("to", toParam);
      const res = await fetch(`/api/inbound-reports/agents?${params}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: allCallsData, isLoading: allCallsLoading } = useQuery<any>({
    queryKey: ["/api/inbound-reports/all-calls", queueIdParam, fromParam, toParam],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (queueIdParam) params.set("queueId", queueIdParam);
      if (fromParam) params.set("from", fromParam);
      if (toParam) params.set("to", toParam);
      params.set("limit", "500");
      const res = await fetch(`/api/inbound-reports/all-calls?${params}`, { credentials: "include" });
      if (!res.ok) return { data: [], total: 0 };
      return res.json();
    },
  });

  const maxHourlyTotal = useMemo(() => {
    return Math.max(...hourlyStats.map((h: any) => h.total), 1);
  }, [hourlyStats]);

  const exportMissedCallsCsv = () => {
    const headers = ["Dátum", "Číslo volajúceho", "Zákazník", "Fronta", "DID", "Status", "Dôvod", "Čakanie (s)", "Pozícia"];
    const rows = missedCalls.map((c: any) => [
      c.enteredQueueAt ? format(new Date(c.enteredQueueAt), "dd.MM.yyyy HH:mm:ss", { locale: sk }) : "",
      c.callerNumber,
      c.customerName || "",
      c.queueName || "",
      c.didNumber || "",
      statusLabels[c.status] || c.status,
      abandonReasonLabels[c.abandonReason] || c.abandonReason || "",
      c.waitDurationSeconds || 0,
      c.queuePosition || "",
    ]);
    const csv = [headers, ...rows].map(r => r.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zmeskane-hovory-${dateFrom}-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAllCallsCsv = () => {
    if (!allCallsData?.data) return;
    const headers = ["Dátum", "Číslo", "Zákazník", "Fronta", "DID", "Agent", "Status", "Čakanie (s)", "Hovor (s)", "Pozícia"];
    const rows = allCallsData.data.map((c: any) => [
      c.enteredQueueAt ? format(new Date(c.enteredQueueAt), "dd.MM.yyyy HH:mm:ss", { locale: sk }) : "",
      c.callerNumber,
      c.customerName || "",
      c.queueName || "",
      c.didNumber || "",
      c.agentName || "",
      statusLabels[c.status] || c.status,
      c.waitDurationSeconds || 0,
      c.talkDurationSeconds || 0,
      c.queuePosition || "",
    ]);
    const csv = [headers, ...rows].map(r => r.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inbound-hovory-${dateFrom}-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium whitespace-nowrap">Fronta:</label>
          <Select value={selectedQueueId} onValueChange={setSelectedQueueId}>
            <SelectTrigger className="w-[220px]" data-testid="select-report-queue">
              <SelectValue placeholder="Všetky fronty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všetky fronty</SelectItem>
              {queues.map((q: any) => (
                <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Od:</label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-[160px]" data-testid="input-date-from" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Do:</label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-[160px]" data-testid="input-date-to" />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dashboard" className="gap-2" data-testid="tab-report-dashboard">
            <BarChart3 className="h-4 w-4" />
            SLA Dashboard
          </TabsTrigger>
          <TabsTrigger value="missed" className="gap-2" data-testid="tab-report-missed">
            <PhoneMissed className="h-4 w-4" />
            Zmeškané hovory
          </TabsTrigger>
          <TabsTrigger value="all-calls" className="gap-2" data-testid="tab-report-all-calls">
            <Phone className="h-4 w-4" />
            Všetky hovory
          </TabsTrigger>
          <TabsTrigger value="agents" className="gap-2" data-testid="tab-report-agents">
            <Users className="h-4 w-4" />
            Agenti
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6 mt-4">
          {summaryLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : summary ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Phone className="h-4 w-4" />
                      Celkom hovorov
                    </div>
                    <div className="text-2xl font-bold" data-testid="text-total-calls">{summary.totalCalls}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Zodvihnuté
                    </div>
                    <div className="text-2xl font-bold text-green-600" data-testid="text-answered-calls">{summary.answeredCalls}</div>
                    <div className="text-xs text-muted-foreground">{summary.answerRate}% úspešnosť</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <XCircle className="h-4 w-4 text-red-500" />
                      Zmeškané
                    </div>
                    <div className="text-2xl font-bold text-red-600" data-testid="text-abandoned-calls">{summary.abandonedCalls}</div>
                    <div className="text-xs text-muted-foreground">{summary.abandonRate}% zmeškaných</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                      SLA
                    </div>
                    <div className={`text-2xl font-bold ${summary.serviceLevel >= 80 ? "text-green-600" : summary.serviceLevel >= 60 ? "text-yellow-600" : "text-red-600"}`} data-testid="text-sla-level">
                      {summary.serviceLevel}%
                    </div>
                    <div className="text-xs text-muted-foreground">Cieľ: ≤{summary.serviceLevelTarget}s</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Clock className="h-4 w-4" />
                      Priem. čakanie
                    </div>
                    <div className="text-2xl font-bold" data-testid="text-avg-wait">{formatDuration(summary.avgWaitTime)}</div>
                    <div className="text-xs text-muted-foreground">Max: {formatDuration(summary.maxWaitTime)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Timer className="h-4 w-4" />
                      Priem. hovor
                    </div>
                    <div className="text-2xl font-bold" data-testid="text-avg-talk">{formatDuration(summary.avgTalkTime)}</div>
                  </CardContent>
                </Card>
              </div>

              {summary.timedOutCalls > 0 || summary.overflowedCalls > 0 ? (
                <div className="flex gap-4">
                  {summary.timedOutCalls > 0 && (
                    <Card className="border-orange-200 dark:border-orange-800">
                      <CardContent className="p-4 flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5 text-orange-500" />
                        <div>
                          <div className="font-medium">Timeout</div>
                          <div className="text-sm text-muted-foreground">{summary.timedOutCalls} hovorov prekročilo čas čakania</div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {summary.overflowedCalls > 0 && (
                    <Card className="border-yellow-200 dark:border-yellow-800">
                      <CardContent className="p-4 flex items-center gap-3">
                        <PhoneOff className="h-5 w-5 text-yellow-500" />
                        <div>
                          <div className="font-medium">Overflow</div>
                          <div className="text-sm text-muted-foreground">{summary.overflowedCalls} hovorov presmerovaných</div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : null}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Rozdelenie hovorov podľa hodiny</CardTitle>
                </CardHeader>
                <CardContent>
                  {hourlyLoading ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : (
                    <div className="space-y-1">
                      {hourlyStats.map((h: any) => (
                        <div key={h.hour} className="flex items-center gap-2 text-sm">
                          <span className="w-12 text-right text-muted-foreground font-mono">{h.label}</span>
                          <div className="flex-1 flex items-center gap-1 h-5">
                            {h.answered > 0 && (
                              <div
                                className="bg-green-500 rounded-sm h-full transition-all"
                                style={{ width: `${(h.answered / maxHourlyTotal) * 100}%`, minWidth: h.answered > 0 ? "4px" : "0" }}
                                title={`Zodvihnuté: ${h.answered}`}
                              />
                            )}
                            {h.abandoned > 0 && (
                              <div
                                className="bg-red-500 rounded-sm h-full transition-all"
                                style={{ width: `${(h.abandoned / maxHourlyTotal) * 100}%`, minWidth: h.abandoned > 0 ? "4px" : "0" }}
                                title={`Zmeškané: ${h.abandoned}`}
                              />
                            )}
                            {(h.total - h.answered - h.abandoned) > 0 && (
                              <div
                                className="bg-yellow-500 rounded-sm h-full transition-all"
                                style={{ width: `${((h.total - h.answered - h.abandoned) / maxHourlyTotal) * 100}%`, minWidth: "4px" }}
                                title={`Ostatné: ${h.total - h.answered - h.abandoned}`}
                              />
                            )}
                          </div>
                          <span className="w-8 text-right text-xs text-muted-foreground">{h.total}</span>
                        </div>
                      ))}
                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-green-500" /> Zodvihnuté</div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-red-500" /> Zmeškané</div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-yellow-500" /> Ostatné</div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">Žiadne dáta pre zvolené obdobie</div>
          )}
        </TabsContent>

        <TabsContent value="missed" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <PhoneMissed className="h-5 w-5 text-red-500" />
              Zmeškané hovory ({missedCalls.length})
            </h3>
            <Button variant="outline" size="sm" onClick={exportMissedCallsCsv} disabled={missedCalls.length === 0} data-testid="button-export-missed">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          {missedLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : missedCalls.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Žiadne zmeškané hovory v zvolenom období</div>
          ) : (
            <div className="border rounded-lg overflow-auto max-h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dátum a čas</TableHead>
                    <TableHead>Číslo volajúceho</TableHead>
                    <TableHead>Zákazník</TableHead>
                    <TableHead>Fronta</TableHead>
                    <TableHead>DID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Dôvod</TableHead>
                    <TableHead>Čakanie</TableHead>
                    <TableHead>Pozícia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {missedCalls.map((call: any) => (
                    <TableRow key={call.id} data-testid={`row-missed-${call.id}`}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {call.enteredQueueAt ? format(new Date(call.enteredQueueAt), "dd.MM.yyyy HH:mm:ss", { locale: sk }) : "-"}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{call.callerNumber}</TableCell>
                      <TableCell className="text-sm">{call.customerName || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-sm">{call.queueName || "—"}</TableCell>
                      <TableCell className="text-sm font-mono">{call.didNumber || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColors[call.status] || ""}>
                          {statusLabels[call.status] || call.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{abandonReasonLabels[call.abandonReason] || call.abandonReason || "—"}</TableCell>
                      <TableCell className="text-sm font-mono">{formatDuration(call.waitDurationSeconds || 0)}</TableCell>
                      <TableCell className="text-sm text-center">{call.queuePosition || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="all-calls" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <PhoneIncoming className="h-5 w-5 text-blue-500" />
              Všetky prichádzajúce hovory ({allCallsData?.total || 0})
            </h3>
            <Button variant="outline" size="sm" onClick={exportAllCallsCsv} disabled={!allCallsData?.data?.length} data-testid="button-export-all-calls">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          {allCallsLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : !allCallsData?.data?.length ? (
            <div className="text-center py-12 text-muted-foreground">Žiadne hovory v zvolenom období</div>
          ) : (
            <div className="border rounded-lg overflow-auto max-h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dátum a čas</TableHead>
                    <TableHead>Číslo volajúceho</TableHead>
                    <TableHead>Zákazník</TableHead>
                    <TableHead>Fronta</TableHead>
                    <TableHead>DID</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Čakanie</TableHead>
                    <TableHead>Hovor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allCallsData.data.map((call: any) => (
                    <TableRow key={call.id} data-testid={`row-call-${call.id}`}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {call.enteredQueueAt ? format(new Date(call.enteredQueueAt), "dd.MM.yyyy HH:mm:ss", { locale: sk }) : "-"}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{call.callerNumber}</TableCell>
                      <TableCell className="text-sm">{call.customerName || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-sm">{call.queueName || "—"}</TableCell>
                      <TableCell className="text-sm font-mono">{call.didNumber || "—"}</TableCell>
                      <TableCell className="text-sm">{call.agentName || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColors[call.status] || ""}>
                          {statusLabels[call.status] || call.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-mono">{formatDuration(call.waitDurationSeconds || 0)}</TableCell>
                      <TableCell className="text-sm font-mono">{formatDuration(call.talkDurationSeconds || 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="agents" className="space-y-4 mt-4">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-500" />
            Výkon agentov
          </h3>

          {agentsLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : agentStats.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Žiadne dáta o agentoch v zvolenom období</div>
          ) : (
            <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead className="text-center">Celkom hovorov</TableHead>
                    <TableHead className="text-center">Zodvihnuté</TableHead>
                    <TableHead className="text-center">Zmeškané</TableHead>
                    <TableHead className="text-center">Úspešnosť</TableHead>
                    <TableHead className="text-center">Priem. čakanie</TableHead>
                    <TableHead className="text-center">Priem. hovor</TableHead>
                    <TableHead className="text-center">Celk. čas hovoru</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agentStats.map((agent: any) => (
                    <TableRow key={agent.agentId} data-testid={`row-agent-${agent.agentId}`}>
                      <TableCell className="font-medium">{agent.agentName}</TableCell>
                      <TableCell className="text-center">{agent.totalCalls}</TableCell>
                      <TableCell className="text-center text-green-600 font-medium">{agent.answeredCalls}</TableCell>
                      <TableCell className="text-center text-red-600 font-medium">{agent.abandonedCalls}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={
                          agent.answerRate >= 90 ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" :
                          agent.answerRate >= 70 ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" :
                          "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                        }>
                          {agent.answerRate}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm">{formatDuration(agent.avgWaitTime)}</TableCell>
                      <TableCell className="text-center font-mono text-sm">{formatDuration(agent.avgTalkTime)}</TableCell>
                      <TableCell className="text-center font-mono text-sm">{formatDurationLong(agent.totalTalkTime)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
