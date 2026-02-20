import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { useI18n } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft, Download, Mail, FileSpreadsheet, FileText, Users, Phone, BarChart3,
  Loader2, Filter, Calendar, Search, AlertTriangle, Clock, ChevronDown
} from "lucide-react";
import type { Campaign } from "@shared/schema";

interface OperatorStat {
  operator: string;
  sessionsCount: number;
  firstLogin: string | null;
  lastLogout: string | null;
  totalWorkTime: number;
  totalBreakTime: number;
  totalCallTime: number;
  totalEmailTime: number;
  totalSmsTime: number;
  totalWrapUpTime: number;
  contactsHandled: number;
  totalWorkTimeFormatted: string;
  totalBreakTimeFormatted: string;
  totalCallTimeFormatted: string;
  totalEmailTimeFormatted: string;
  totalSmsTimeFormatted: string;
  totalWrapUpTimeFormatted: string;
  avgCallDuration: string;
}

interface CallListItem {
  id: string;
  agent: string;
  customer: string;
  phoneNumber: string;
  direction: string;
  status: string;
  startedAt: string;
  answeredAt: string;
  endedAt: string;
  ringTimeSec: number;
  ringTimeFormatted: string;
  talkTimeSec: number;
  talkTimeFormatted: string;
  totalDurationSec: number;
  totalDurationFormatted: string;
  disposition: string;
  hungUpBy: string;
  notes: string;
}

interface CallAnalysisItem {
  id: string;
  callLogId: string;
  agent: string;
  customer: string;
  campaign: string;
  phoneNumber: string;
  durationSeconds: number;
  durationFormatted: string;
  analysisStatus: string;
  sentiment: string;
  qualityScore: number | null;
  scriptComplianceScore: number | null;
  summary: string;
  keyTopics: string;
  actionItems: string;
  alertKeywords: string;
  complianceNotes: string;
  transcriptionText: string;
  createdAt: string;
  analyzedAt: string;
}

interface AgentOption {
  id: string;
  name: string;
}

export default function CampaignReportsPage() {
  const { t, locale } = useI18n();
  const cr = t.campaignReports;
  const { toast } = useToast();
  const [, params] = useRoute("/campaigns/:id/reports");
  const campaignId = params?.id || "";

  const [activeTab, setActiveTab] = useState("operator-stats");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("all");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState("");

  const buildQueryParams = () => {
    const params: Record<string, string> = {};
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    if (selectedAgent && selectedAgent !== 'all') params.agentId = selectedAgent;
    return new URLSearchParams(params).toString();
  };

  const { data: campaign } = useQuery<Campaign>({
    queryKey: ["/api/campaigns", campaignId],
    enabled: !!campaignId,
  });

  const { data: agents = [] } = useQuery<AgentOption[]>({
    queryKey: ["/api/campaigns", campaignId, "reports", "agents"],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/reports/agents`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!campaignId,
  });

  const qp = buildQueryParams();
  const { data: operatorStats = [], isLoading: loadingOps } = useQuery<OperatorStat[]>({
    queryKey: ["/api/campaigns", campaignId, "reports", "operator-stats", qp],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/reports/operator-stats?${qp}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!campaignId && activeTab === "operator-stats",
  });

  const { data: callList = [], isLoading: loadingCalls } = useQuery<CallListItem[]>({
    queryKey: ["/api/campaigns", campaignId, "reports", "call-list", qp],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/reports/call-list?${qp}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!campaignId && activeTab === "call-list",
  });

  const { data: callAnalysis = [], isLoading: loadingAnalysis } = useQuery<CallAnalysisItem[]>({
    queryKey: ["/api/campaigns", campaignId, "reports", "call-analysis", qp],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/reports/call-analysis?${qp}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!campaignId && activeTab === "call-analysis",
  });

  const handleExport = async (fmt: 'csv' | 'xlsx') => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/reports/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          reportType: activeTab,
          format: fmt,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          agentId: selectedAgent !== 'all' ? selectedAgent : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Export failed' }));
        toast({ title: "Error", description: err.error, variant: "destructive" });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${campaign?.name || 'report'}_${activeTab}_${new Date().toISOString().split('T')[0]}.${fmt}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: "Error", description: "Export failed", variant: "destructive" });
    }
  };

  const emailMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/campaigns/${campaignId}/reports/send-email`, {
        reportType: activeTab,
        recipientEmail: emailRecipient,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        agentId: selectedAgent !== 'all' ? selectedAgent : undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: cr.emailSent });
      setEmailDialogOpen(false);
      setEmailRecipient("");
    },
    onError: () => {
      toast({ title: cr.emailFailed, variant: "destructive" });
    },
  });

  const formatDateTime = (iso: string) => {
    if (!iso) return '-';
    try {
      return format(new Date(iso), "dd.MM.yyyy HH:mm:ss");
    } catch {
      return iso;
    }
  };

  const SentimentBadge = ({ sentiment }: { sentiment: string }) => {
    const colors: Record<string, string> = {
      positive: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      neutral: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
      negative: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      angry: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    };
    return sentiment ? (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[sentiment] || colors.neutral}`}>
        {sentiment}
      </span>
    ) : <span className="text-muted-foreground text-xs">-</span>;
  };

  const ScoreBadge = ({ score, max = 10 }: { score: number | null; max?: number }) => {
    if (score === null || score === undefined) return <span className="text-muted-foreground text-xs">-</span>;
    const pct = (score / max) * 100;
    const color = pct >= 70 ? 'text-green-600' : pct >= 40 ? 'text-yellow-600' : 'text-red-600';
    return <span className={`font-semibold text-sm ${color}`}>{score}/{max}</span>;
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const colors: Record<string, string> = {
      completed: 'bg-green-100 text-green-800',
      answered: 'bg-blue-100 text-blue-800',
      failed: 'bg-red-100 text-red-800',
      no_answer: 'bg-yellow-100 text-yellow-800',
      busy: 'bg-orange-100 text-orange-800',
      cancelled: 'bg-gray-100 text-gray-800',
      initiated: 'bg-purple-100 text-purple-800',
      ringing: 'bg-cyan-100 text-cyan-800',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  const isLoading = activeTab === 'operator-stats' ? loadingOps : activeTab === 'call-list' ? loadingCalls : loadingAnalysis;
  const hasData = activeTab === 'operator-stats' ? operatorStats.length > 0 : activeTab === 'call-list' ? callList.length > 0 : callAnalysis.length > 0;

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href={`/campaigns/${campaignId}`}>
            <Button variant="ghost" size="icon" data-testid="btn-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">{cr.title}</h1>
            <p className="text-sm text-muted-foreground">{campaign?.name || ''} - {cr.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => handleExport('csv')} disabled={!hasData} data-testid="btn-export-csv">
            <Download className="h-4 w-4 mr-1" />
            {cr.exportCsv}
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('xlsx')} disabled={!hasData} data-testid="btn-export-xls">
            <FileSpreadsheet className="h-4 w-4 mr-1" />
            {cr.exportXls}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEmailDialogOpen(true)} disabled={!hasData} data-testid="btn-send-email">
            <Mail className="h-4 w-4 mr-1" />
            {cr.sendEmail}
          </Button>
        </div>
      </div>

      <Card data-testid="card-filters">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{cr.dateFrom}</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-[160px]" data-testid="input-date-from" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{cr.dateTo}</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-[160px]" data-testid="input-date-to" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{cr.filterByAgent}</Label>
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger className="w-[200px]" data-testid="select-agent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{cr.allAgents}</SelectItem>
                  {agents.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3" data-testid="tabs-reports">
          <TabsTrigger value="operator-stats" className="gap-1" data-testid="tab-operator-stats">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">{cr.operatorStats}</span>
          </TabsTrigger>
          <TabsTrigger value="call-list" className="gap-1" data-testid="tab-call-list">
            <Phone className="h-4 w-4" />
            <span className="hidden sm:inline">{cr.callList}</span>
          </TabsTrigger>
          <TabsTrigger value="call-analysis" className="gap-1" data-testid="tab-call-analysis">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">{cr.callAnalysis}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="operator-stats" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{cr.operatorStats}</CardTitle>
              <CardDescription>{cr.operatorStatsDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : operatorStats.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="font-medium">{cr.noData}</p>
                  <p className="text-sm">{cr.noDataDesc}</p>
                </div>
              ) : (
                <ScrollArea className="w-full">
                  <div className="min-w-[900px]">
                    <table className="w-full text-sm" data-testid="table-operator-stats">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-2 font-medium">{cr.operator}</th>
                          <th className="text-center p-2 font-medium">{cr.totalWorkTime}</th>
                          <th className="text-center p-2 font-medium">{cr.totalBreakTime}</th>
                          <th className="text-center p-2 font-medium">{cr.totalCallTime}</th>
                          <th className="text-center p-2 font-medium">{cr.totalEmailTime}</th>
                          <th className="text-center p-2 font-medium">{cr.totalSmsTime}</th>
                          <th className="text-center p-2 font-medium">{cr.totalWrapUpTime}</th>
                          <th className="text-center p-2 font-medium">{cr.contactsHandled}</th>
                          <th className="text-center p-2 font-medium">{cr.avgCallDuration}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {operatorStats.map((stat, i) => (
                          <tr key={i} className="border-b hover:bg-muted/30" data-testid={`row-operator-${i}`}>
                            <td className="p-2 font-medium">{stat.operator}</td>
                            <td className="p-2 text-center"><Badge variant="secondary">{stat.totalWorkTimeFormatted}</Badge></td>
                            <td className="p-2 text-center"><Badge variant="outline" className="text-yellow-600">{stat.totalBreakTimeFormatted}</Badge></td>
                            <td className="p-2 text-center"><Badge variant="outline" className="text-green-600">{stat.totalCallTimeFormatted}</Badge></td>
                            <td className="p-2 text-center"><Badge variant="outline" className="text-blue-600">{stat.totalEmailTimeFormatted}</Badge></td>
                            <td className="p-2 text-center"><Badge variant="outline" className="text-purple-600">{stat.totalSmsTimeFormatted}</Badge></td>
                            <td className="p-2 text-center"><Badge variant="outline" className="text-orange-600">{stat.totalWrapUpTimeFormatted}</Badge></td>
                            <td className="p-2 text-center font-semibold">{stat.contactsHandled}</td>
                            <td className="p-2 text-center">{stat.avgCallDuration}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="call-list" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{cr.callList}</CardTitle>
              <CardDescription>{cr.callListDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingCalls ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : callList.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Phone className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="font-medium">{cr.noData}</p>
                  <p className="text-sm">{cr.noDataDesc}</p>
                </div>
              ) : (
                <ScrollArea className="w-full">
                  <div className="min-w-[1200px]">
                    <table className="w-full text-sm" data-testid="table-call-list">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-2 font-medium">{cr.agent}</th>
                          <th className="text-left p-2 font-medium">{cr.customer}</th>
                          <th className="text-left p-2 font-medium">{cr.phoneNumber}</th>
                          <th className="text-center p-2 font-medium">{cr.direction}</th>
                          <th className="text-center p-2 font-medium">{cr.status}</th>
                          <th className="text-center p-2 font-medium">{cr.startedAt}</th>
                          <th className="text-center p-2 font-medium">{cr.ringTime}</th>
                          <th className="text-center p-2 font-medium">{cr.talkTime}</th>
                          <th className="text-center p-2 font-medium">{cr.totalDuration}</th>
                          <th className="text-center p-2 font-medium">{cr.disposition}</th>
                          <th className="text-left p-2 font-medium">{cr.notes}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {callList.map((call, i) => (
                          <tr key={call.id} className="border-b hover:bg-muted/30" data-testid={`row-call-${call.id}`}>
                            <td className="p-2">{call.agent}</td>
                            <td className="p-2">{call.customer}</td>
                            <td className="p-2 font-mono text-xs">{call.phoneNumber}</td>
                            <td className="p-2 text-center">
                              <Badge variant={call.direction === 'inbound' ? 'secondary' : 'outline'}>
                                {call.direction === 'inbound' ? cr.inbound : cr.outbound}
                              </Badge>
                            </td>
                            <td className="p-2 text-center"><StatusBadge status={call.status} /></td>
                            <td className="p-2 text-center text-xs">{formatDateTime(call.startedAt)}</td>
                            <td className="p-2 text-center font-mono text-xs">{call.ringTimeFormatted}</td>
                            <td className="p-2 text-center font-mono text-xs font-semibold">{call.talkTimeFormatted}</td>
                            <td className="p-2 text-center font-mono text-xs">{call.totalDurationFormatted}</td>
                            <td className="p-2 text-center">
                              {call.disposition ? <Badge variant="outline">{call.disposition}</Badge> : '-'}
                            </td>
                            <td className="p-2 text-xs max-w-[200px] truncate" title={call.notes}>{call.notes || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ScrollArea>
              )}
              {callList.length > 0 && (
                <p className="text-xs text-muted-foreground mt-3">{callList.length} {cr.reports.toLowerCase()}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="call-analysis" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{cr.callAnalysis}</CardTitle>
              <CardDescription>{cr.callAnalysisDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingAnalysis ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : callAnalysis.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="font-medium">{cr.noData}</p>
                  <p className="text-sm">{cr.noDataDesc}</p>
                </div>
              ) : (
                <ScrollArea className="w-full">
                  <div className="min-w-[1400px]">
                    <table className="w-full text-sm" data-testid="table-call-analysis">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-2 font-medium">{cr.agent}</th>
                          <th className="text-left p-2 font-medium">{cr.customer}</th>
                          <th className="text-left p-2 font-medium">{cr.phoneNumber}</th>
                          <th className="text-center p-2 font-medium">{cr.totalDuration}</th>
                          <th className="text-center p-2 font-medium">{cr.sentiment}</th>
                          <th className="text-center p-2 font-medium">{cr.qualityScore}</th>
                          <th className="text-center p-2 font-medium">{cr.scriptCompliance}</th>
                          <th className="text-left p-2 font-medium">{cr.keyTopics}</th>
                          <th className="text-left p-2 font-medium">{cr.alertKeywords}</th>
                          <th className="text-left p-2 font-medium">{cr.summary}</th>
                          <th className="text-left p-2 font-medium">{cr.complianceNotes}</th>
                          <th className="text-center p-2 font-medium">{cr.startedAt}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {callAnalysis.map((rec, i) => (
                          <tr key={rec.id} className="border-b hover:bg-muted/30" data-testid={`row-analysis-${rec.id}`}>
                            <td className="p-2">{rec.agent}</td>
                            <td className="p-2">{rec.customer}</td>
                            <td className="p-2 font-mono text-xs">{rec.phoneNumber}</td>
                            <td className="p-2 text-center font-mono text-xs">{rec.durationFormatted}</td>
                            <td className="p-2 text-center"><SentimentBadge sentiment={rec.sentiment} /></td>
                            <td className="p-2 text-center"><ScoreBadge score={rec.qualityScore} /></td>
                            <td className="p-2 text-center"><ScoreBadge score={rec.scriptComplianceScore} /></td>
                            <td className="p-2 text-xs max-w-[180px] truncate" title={rec.keyTopics}>{rec.keyTopics || '-'}</td>
                            <td className="p-2 text-xs max-w-[150px]">
                              {rec.alertKeywords ? (
                                <span className="text-red-600 font-medium">{rec.alertKeywords}</span>
                              ) : '-'}
                            </td>
                            <td className="p-2 text-xs max-w-[200px] truncate" title={rec.summary}>{rec.summary || '-'}</td>
                            <td className="p-2 text-xs max-w-[150px] truncate" title={rec.complianceNotes}>{rec.complianceNotes || '-'}</td>
                            <td className="p-2 text-center text-xs">{formatDateTime(rec.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ScrollArea>
              )}
              {callAnalysis.length > 0 && (
                <p className="text-xs text-muted-foreground mt-3">{callAnalysis.length} {cr.reports.toLowerCase()}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{cr.sendEmail}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{cr.emailRecipient}</Label>
              <Input
                type="email"
                value={emailRecipient}
                onChange={e => setEmailRecipient(e.target.value)}
                placeholder="email@example.com"
                data-testid="input-email-recipient"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {cr.emailSubject}: {campaign?.name || ''} - {activeTab.replace(/-/g, ' ')}
            </p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" data-testid="btn-cancel-email">{cr.cancel}</Button>
            </DialogClose>
            <Button
              onClick={() => emailMutation.mutate()}
              disabled={!emailRecipient || emailMutation.isPending}
              data-testid="btn-send-email-confirm"
            >
              {emailMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Mail className="h-4 w-4 mr-1" />}
              {cr.send}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
