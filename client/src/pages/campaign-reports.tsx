import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { useI18n } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format, subDays, startOfWeek, startOfMonth, startOfYear, subMonths, subWeeks } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ArrowLeft, Download, Mail, FileSpreadsheet, Users, Phone, BarChart3,
  Loader2, Calendar, ChevronDown, ChevronRight, Clock, TrendingUp,
  Coffee, Headphones, MessageSquare, WrapText, Timer, Activity,
  User, Zap, Target, AlertTriangle, CalendarClock, Trash2, Plus, Power, Pencil, Send
} from "lucide-react";
import type { Campaign } from "@shared/schema";

interface BreakSummaryItem {
  type: string;
  count: number;
  totalFormatted: string;
}

interface SessionDetail {
  sessionId: string;
  login: string | null;
  logout: string | null;
  status: string;
  workTime: number;
  breakTime: number;
  callTime: number;
  callCount: number;
  emailTime: number;
  emailCount: number;
  smsTime: number;
  smsCount: number;
  wrapUpTime: number;
  contactsHandled: number;
  duration: number;
  breakCount: number;
}

interface OperatorStat {
  operatorId: string;
  operator: string;
  operatorEmail: string;
  operatorRole: string;
  period: string;
  sessionsCount: number;
  firstLogin: string | null;
  lastLogout: string | null;
  totalLoginTime: number;
  totalLoginTimeFormatted: string;
  totalWorkTime: number;
  totalBreakTime: number;
  totalCallTime: number;
  totalEmailTime: number;
  totalSmsTime: number;
  totalWrapUpTime: number;
  contactsHandled: number;
  callCount: number;
  emailCount: number;
  smsCount: number;
  longestSession: number;
  shortestSession: number;
  totalActiveTime: number;
  totalActiveTimeFormatted: string;
  utilization: number;
  totalWorkTimeFormatted: string;
  totalBreakTimeFormatted: string;
  totalCallTimeFormatted: string;
  totalEmailTimeFormatted: string;
  totalSmsTimeFormatted: string;
  totalWrapUpTimeFormatted: string;
  longestSessionFormatted: string;
  shortestSessionFormatted: string;
  avgSessionDuration: string;
  avgCallDuration: string;
  breakSummary: BreakSummaryItem[];
  sessionDetails: SessionDetail[];
}

interface CallListItem {
  id: string;
  type: string;
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
  subject: string;
  recipient: string;
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

const DATE_FMT = "yyyy-MM-dd";

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
  const [groupBy, setGroupBy] = useState("total");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState("");
  const [selectedUserEmails, setSelectedUserEmails] = useState<string[]>([]);
  const [expandedOperators, setExpandedOperators] = useState<Set<string>>(new Set());
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [schedReportTypes, setSchedReportTypes] = useState<string[]>(['operator-stats']);
  const [schedRecipientIds, setSchedRecipientIds] = useState<string[]>([]);
  const [schedSendTime, setSchedSendTime] = useState("08:00");
  const [schedDateRange, setSchedDateRange] = useState("yesterday");
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [quickDateOpen, setQuickDateOpen] = useState(false);

  const today = format(new Date(), DATE_FMT);

  const quickDatePresets = useMemo(() => [
    { label: cr?.today || 'Today', from: today, to: today },
    { label: cr?.yesterday || 'Yesterday', from: format(subDays(new Date(), 1), DATE_FMT), to: format(subDays(new Date(), 1), DATE_FMT) },
    { label: cr?.last7days || 'Last 7 days', from: format(subDays(new Date(), 7), DATE_FMT), to: today },
    { label: cr?.thisWeek || 'This week', from: format(startOfWeek(new Date(), { weekStartsOn: 1 }), DATE_FMT), to: today },
    { label: cr?.lastWeek || 'Last week', from: format(startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }), DATE_FMT), to: format(subDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 1), DATE_FMT) },
    { label: cr?.thisMonth || 'This month', from: format(startOfMonth(new Date()), DATE_FMT), to: today },
    { label: cr?.lastMonth || 'Last month', from: format(startOfMonth(subMonths(new Date(), 1)), DATE_FMT), to: format(subDays(startOfMonth(new Date()), 1), DATE_FMT) },
    { label: cr?.last30days || 'Last 30 days', from: format(subDays(new Date(), 30), DATE_FMT), to: today },
    { label: cr?.last90days || 'Last 90 days', from: format(subDays(new Date(), 90), DATE_FMT), to: today },
    { label: cr?.thisYear || 'This year', from: format(startOfYear(new Date()), DATE_FMT), to: today },
    { label: cr?.allTime || 'All time', from: '', to: '' },
  ], [cr, today]);

  const applyQuickDate = (from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
    setQuickDateOpen(false);
  };

  const activePresetLabel = useMemo(() => {
    const match = quickDatePresets.find(p => p.from === dateFrom && p.to === dateTo);
    return match?.label || null;
  }, [dateFrom, dateTo, quickDatePresets]);

  const buildQueryParams = () => {
    const p: Record<string, string> = {};
    if (dateFrom) p.dateFrom = dateFrom;
    if (dateTo) p.dateTo = dateTo;
    if (selectedAgent && selectedAgent !== 'all') p.agentId = selectedAgent;
    if (groupBy && groupBy !== 'total') p.groupBy = groupBy;
    return new URLSearchParams(p).toString();
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

  const { data: allUsers = [] } = useQuery<Array<{ id: string; email: string; fullName: string; firstName: string; lastName: string; role: string }>>({
    queryKey: ["/api/users"],
    enabled: emailDialogOpen || scheduleDialogOpen,
  });

  const { data: scheduledReportsList = [] } = useQuery<Array<{
    id: string; reportTypes: string[]; recipientUserIds: string[]; sendTime: string;
    dateRangeType: string; enabled: boolean; lastRunAt: string | null; nextRunAt: string | null;
  }>>({
    queryKey: ["/api/campaigns", campaignId, "scheduled-reports"],
    enabled: !!campaignId,
  });

  const createScheduleMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/campaigns/${campaignId}/scheduled-reports`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "scheduled-reports"] });
      toast({ title: "Scheduled report created" });
      setScheduleDialogOpen(false);
      setSchedRecipientIds([]);
      setSchedReportTypes(['operator-stats']);
      setSchedSendTime("08:00");
      setSchedDateRange("yesterday");
    },
    onError: () => toast({ title: "Failed to create schedule", variant: "destructive" }),
  });

  const toggleScheduleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const res = await apiRequest("PATCH", `/api/scheduled-reports/${id}`, { enabled });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "scheduled-reports"] }),
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/scheduled-reports/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "scheduled-reports"] });
      toast({ title: "Schedule deleted" });
    },
  });

  const updateScheduleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/scheduled-reports/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "scheduled-reports"] });
      toast({ title: cr?.scheduleUpdated || "Schedule updated" });
      setScheduleDialogOpen(false);
      setEditingScheduleId(null);
      setSchedRecipientIds([]);
      setSchedReportTypes(['operator-stats']);
      setSchedSendTime("08:00");
      setSchedDateRange("yesterday");
    },
    onError: () => toast({ title: cr?.updateFailed || "Failed to update schedule", variant: "destructive" }),
  });

  const sendNowMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/scheduled-reports/${id}/send-now`);
      return res.json();
    },
    onSuccess: (data: any) => {
      const successCount = data.results?.filter((r: any) => r.success).length || 0;
      const totalCount = data.results?.length || 0;
      toast({ title: cr?.reportsSentNow || "Reports sent", description: `${successCount}/${totalCount} ${cr?.reportsSentSuccessfully || 'reports sent successfully'} (${data.dateFrom} - ${data.dateTo})` });
    },
    onError: () => toast({ title: cr?.sendNowFailed || "Failed to send reports", variant: "destructive" }),
  });

  const openEditSchedule = (sched: typeof scheduledReportsList[0]) => {
    setEditingScheduleId(sched.id);
    setSchedReportTypes([...sched.reportTypes]);
    setSchedRecipientIds([...sched.recipientUserIds]);
    setSchedSendTime(sched.sendTime);
    setSchedDateRange(sched.dateRangeType);
    setScheduleDialogOpen(true);
  };

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
          groupBy: activeTab === 'operator-stats' && groupBy !== 'total' ? groupBy : undefined,
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
      const recipientEmails = [...selectedUserEmails];
      if (emailRecipient && !recipientEmails.includes(emailRecipient)) recipientEmails.push(emailRecipient);
      const res = await apiRequest("POST", `/api/campaigns/${campaignId}/reports/send-email`, {
        reportType: activeTab,
        recipientEmails,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        agentId: selectedAgent !== 'all' ? selectedAgent : undefined,
        groupBy: activeTab === 'operator-stats' && groupBy !== 'total' ? groupBy : undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: cr.emailSent });
      setEmailDialogOpen(false);
      setEmailRecipient("");
      setSelectedUserEmails([]);
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

  const formatDateShort = (iso: string) => {
    if (!iso) return '-';
    try {
      return format(new Date(iso), "dd.MM.yyyy HH:mm");
    } catch {
      return iso;
    }
  };

  const formatDurationLocal = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0:00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const toggleOperator = (key: string) => {
    setExpandedOperators(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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
      completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      answered: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      no_answer: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      busy: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
      initiated: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      ringing: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  const UtilizationBar = ({ value }: { value: number }) => {
    const color = value >= 80 ? 'bg-green-500' : value >= 50 ? 'bg-yellow-500' : 'bg-red-500';
    return (
      <div className="flex items-center gap-2 min-w-[100px]">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
        </div>
        <span className="text-xs font-semibold w-10 text-right">{value}%</span>
      </div>
    );
  };

  const StatMini = ({ icon: Icon, label, value, color = "text-foreground" }: { icon: any; label: string; value: string; color?: string }) => (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
      <Icon className={`h-4 w-4 ${color}`} />
      <div>
        <p className="text-[10px] text-muted-foreground leading-none">{label}</p>
        <p className={`text-sm font-semibold ${color}`}>{value}</p>
      </div>
    </div>
  );

  const isLoading = activeTab === 'operator-stats' ? loadingOps : activeTab === 'call-list' ? loadingCalls : loadingAnalysis;
  const hasData = activeTab === 'operator-stats' ? operatorStats.length > 0 : activeTab === 'call-list' ? callList.length > 0 : callAnalysis.length > 0;

  const totalSummary = useMemo(() => {
    if (operatorStats.length === 0) return null;
    const totals = operatorStats.reduce((acc, s) => ({
      sessions: acc.sessions + s.sessionsCount,
      loginTime: acc.loginTime + (s.totalLoginTime || 0),
      workTime: acc.workTime + s.totalWorkTime,
      breakTime: acc.breakTime + s.totalBreakTime,
      callTime: acc.callTime + s.totalCallTime,
      emailTime: acc.emailTime + s.totalEmailTime,
      smsTime: acc.smsTime + s.totalSmsTime,
      wrapUpTime: acc.wrapUpTime + s.totalWrapUpTime,
      contacts: acc.contacts + s.contactsHandled,
      callCount: acc.callCount + (s.callCount || 0),
      emailCount: acc.emailCount + (s.emailCount || 0),
      smsCount: acc.smsCount + (s.smsCount || 0),
      operators: acc.operators,
    }), { sessions: 0, loginTime: 0, workTime: 0, breakTime: 0, callTime: 0, emailTime: 0, smsTime: 0, wrapUpTime: 0, contacts: 0, callCount: 0, emailCount: 0, smsCount: 0, operators: new Set(operatorStats.map(s => s.operatorId)).size });
    return totals;
  }, [operatorStats]);

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href={`/campaigns/${campaignId}`}>
            <Button variant="ghost" size="icon" data-testid="btn-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">{cr.title}</h1>
            <p className="text-sm text-muted-foreground">{campaign?.name || ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => handleExport('csv')} disabled={!hasData} data-testid="btn-export-csv">
            <Download className="h-4 w-4 mr-1" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('xlsx')} disabled={!hasData} data-testid="btn-export-xls">
            <FileSpreadsheet className="h-4 w-4 mr-1" />
            XLSX
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEmailDialogOpen(true)} disabled={!hasData} data-testid="btn-send-email">
            <Mail className="h-4 w-4 mr-1" />
            Email
          </Button>
        </div>
      </div>

      {/* Modern Filters Card */}
      <Card className="border-2 border-dashed border-muted-foreground/20" data-testid="card-filters">
        <CardContent className="pt-5 pb-4">
          <div className="flex flex-col gap-4">
            {/* Quick date presets */}
            <div className="flex items-center gap-2 flex-wrap">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground mr-1">{cr?.quickDates || 'Quick:'}</span>
              <div className="flex flex-wrap gap-1.5">
                {quickDatePresets.slice(0, 6).map((preset, i) => (
                  <Button
                    key={i}
                    variant={activePresetLabel === preset.label ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs px-2.5 rounded-full"
                    onClick={() => applyQuickDate(preset.from, preset.to)}
                    data-testid={`btn-preset-${i}`}
                  >
                    {preset.label}
                  </Button>
                ))}
                <Popover open={quickDateOpen} onOpenChange={setQuickDateOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 text-xs px-2.5 rounded-full" data-testid="btn-more-presets">
                      {cr?.more || 'More'} <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-1" align="start">
                    {quickDatePresets.slice(6).map((preset, i) => (
                      <button
                        key={i}
                        className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-muted transition-colors"
                        onClick={() => applyQuickDate(preset.from, preset.to)}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            {/* Custom date + agent + groupBy filters */}
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium">{cr.dateFrom}</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="w-[155px] h-9"
                  data-testid="input-date-from"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">{cr.dateTo}</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="w-[155px] h-9"
                  data-testid="input-date-to"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">{cr.filterByAgent}</Label>
                <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                  <SelectTrigger className="w-[200px] h-9" data-testid="select-agent">
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
              {activeTab === 'operator-stats' && (
                <div className="space-y-1">
                  <Label className="text-xs font-medium">{cr?.groupBy || 'Group by'}</Label>
                  <Select value={groupBy} onValueChange={setGroupBy}>
                    <SelectTrigger className="w-[160px] h-9" data-testid="select-group-by">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="total">{cr?.groupTotal || 'Total'}</SelectItem>
                      <SelectItem value="day">{cr?.groupDay || 'Day'}</SelectItem>
                      <SelectItem value="week">{cr?.groupWeek || 'Week'}</SelectItem>
                      <SelectItem value="month">{cr?.groupMonth || 'Month'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {(dateFrom || dateTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-xs text-muted-foreground"
                  onClick={() => { setDateFrom(''); setDateTo(''); }}
                  data-testid="btn-clear-dates"
                >
                  {cr?.clearDates || 'Clear'}
                </Button>
              )}
            </div>
            {activePresetLabel && (
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="text-xs">
                  <Calendar className="h-3 w-3 mr-1" />
                  {activePresetLabel}
                  {dateFrom && dateTo ? ` (${dateFrom} → ${dateTo})` : ''}
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3" data-testid="tabs-reports">
          <TabsTrigger value="operator-stats" className="gap-1.5" data-testid="tab-operator-stats">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">{cr.operatorStats}</span>
          </TabsTrigger>
          <TabsTrigger value="call-list" className="gap-1.5" data-testid="tab-call-list">
            <Phone className="h-4 w-4" />
            <span className="hidden sm:inline">{cr.callList}</span>
          </TabsTrigger>
          <TabsTrigger value="call-analysis" className="gap-1.5" data-testid="tab-call-analysis">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">{cr.callAnalysis}</span>
          </TabsTrigger>
        </TabsList>

        {/* ============ OPERATOR STATS TAB ============ */}
        <TabsContent value="operator-stats" className="mt-4 space-y-4">
          {/* Summary Cards */}
          {totalSummary && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-10 gap-2">
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <Users className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">{cr?.totalOperators || 'Operators'}</p>
                    <p className="text-sm font-medium">{totalSummary.operators}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                    <Activity className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">{cr?.sessions || 'Sessions'}</p>
                    <p className="text-sm font-medium">{totalSummary.sessions}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                    <Timer className="h-4 w-4 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">{cr?.totalLoginTime || 'Login Time'}</p>
                    <p className="text-sm font-medium">{formatDurationLocal(totalSummary.loginTime)}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                    <Clock className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">{cr.totalWorkTime}</p>
                    <p className="text-sm font-medium">{formatDurationLocal(totalSummary.workTime)}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                    <Coffee className="h-4 w-4 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">{cr.totalBreakTime}</p>
                    <p className="text-sm font-medium">{formatDurationLocal(totalSummary.breakTime)}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                    <Headphones className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">{cr.totalCallTime} ({totalSummary.callCount})</p>
                    <p className="text-sm font-medium">{formatDurationLocal(totalSummary.callTime)}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <Mail className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">{cr.totalEmailTime} ({totalSummary.emailCount})</p>
                    <p className="text-sm font-medium">{formatDurationLocal(totalSummary.emailTime)}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/30">
                    <MessageSquare className="h-4 w-4 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">{cr.totalSmsTime} ({totalSummary.smsCount})</p>
                    <p className="text-sm font-medium">{formatDurationLocal(totalSummary.smsTime)}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                    <WrapText className="h-4 w-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">{cr.totalWrapUpTime}</p>
                    <p className="text-sm font-medium">{formatDurationLocal(totalSummary.wrapUpTime)}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900/30">
                    <Target className="h-4 w-4 text-rose-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">{cr.contactsHandled}</p>
                    <p className="text-sm font-medium">{totalSummary.contacts}</p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-5 w-5" />
                {cr.operatorStats}
              </CardTitle>
              <CardDescription>{cr.operatorStatsDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingOps ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : operatorStats.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="font-medium">{cr.noData}</p>
                  <p className="text-sm">{cr.noDataDesc}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {operatorStats.map((stat, i) => {
                    const key = `${stat.operatorId}__${stat.period}`;
                    const isExpanded = expandedOperators.has(key);
                    return (
                      <Collapsible key={key} open={isExpanded} onOpenChange={() => toggleOperator(key)}>
                        <div className={`border rounded-lg transition-colors ${isExpanded ? 'border-primary/30 bg-muted/20' : 'hover:bg-muted/10'}`} data-testid={`row-operator-${i}`}>
                          {/* Operator Header Row */}
                          <CollapsibleTrigger className="w-full">
                            <div className="flex items-center gap-3 p-3 cursor-pointer">
                              <div className="flex items-center gap-2 min-w-[200px]">
                                {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                <div className="p-1.5 rounded-full bg-primary/10">
                                  <User className="h-4 w-4 text-primary" />
                                </div>
                                <div className="text-left">
                                  <p className="font-semibold text-sm">{stat.operator}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {stat.period !== 'total' && <span className="mr-2">{stat.period.startsWith('W') ? `Week ${stat.period.slice(1)}` : stat.period}</span>}
                                    {stat.operatorEmail && <span>{stat.operatorEmail}</span>}
                                  </p>
                                </div>
                              </div>
                              <div className="flex-1 flex items-center gap-4 flex-wrap justify-end">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Badge variant="secondary" className="gap-1 text-xs">
                                        <Activity className="h-3 w-3" />
                                        {stat.sessionsCount}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>{cr?.sessions || 'Sessions'}</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Badge variant="outline" className="gap-1 text-xs text-blue-600">
                                        <Clock className="h-3 w-3" />
                                        {stat.totalWorkTimeFormatted}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>{cr.totalWorkTime}</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Badge variant="outline" className="gap-1 text-xs text-green-600">
                                        <Headphones className="h-3 w-3" />
                                        {stat.totalCallTimeFormatted}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>{cr.totalCallTime}</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Badge variant="outline" className="gap-1 text-xs text-yellow-600">
                                        <Coffee className="h-3 w-3" />
                                        {stat.totalBreakTimeFormatted}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>{cr.totalBreakTime}</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Badge variant="outline" className="gap-1 text-xs text-blue-500">
                                        <Mail className="h-3 w-3" />
                                        {stat.totalEmailTimeFormatted}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>{cr.totalEmailTime} ({stat.emailCount || 0})</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Badge variant="outline" className="gap-1 text-xs text-purple-600">
                                        <MessageSquare className="h-3 w-3" />
                                        {stat.totalSmsTimeFormatted}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>{cr.totalSmsTime} ({stat.smsCount || 0})</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <span className="text-sm font-semibold">{stat.contactsHandled} {cr?.contacts || 'contacts'}</span>
                                <UtilizationBar value={stat.utilization} />
                              </div>
                            </div>
                          </CollapsibleTrigger>

                          {/* Expanded Details */}
                          <CollapsibleContent>
                            <div className="px-4 pb-4 space-y-4 border-t pt-4">
                              {/* Time breakdown mini cards */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                                <StatMini icon={Clock} label={cr.totalWorkTime} value={stat.totalWorkTimeFormatted} color="text-blue-600" />
                                <StatMini icon={Zap} label={cr?.activeTime || 'Active'} value={stat.totalActiveTimeFormatted} color="text-emerald-600" />
                                <StatMini icon={Coffee} label={cr.totalBreakTime} value={stat.totalBreakTimeFormatted} color="text-yellow-600" />
                                <StatMini icon={Headphones} label={cr.totalCallTime} value={stat.totalCallTimeFormatted} color="text-green-600" />
                                <StatMini icon={MessageSquare} label={cr.totalEmailTime} value={stat.totalEmailTimeFormatted} color="text-blue-500" />
                                <StatMini icon={MessageSquare} label={cr.totalSmsTime} value={stat.totalSmsTimeFormatted} color="text-purple-600" />
                                <StatMini icon={WrapText} label={cr.totalWrapUpTime} value={stat.totalWrapUpTimeFormatted} color="text-orange-600" />
                                <StatMini icon={Timer} label={cr.avgCallDuration} value={stat.avgCallDuration} color="text-teal-600" />
                              </div>

                              {/* Session metrics */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <StatMini icon={TrendingUp} label={cr?.longestSession || 'Longest session'} value={stat.longestSessionFormatted} />
                                <StatMini icon={Timer} label={cr?.shortestSession || 'Shortest session'} value={stat.shortestSessionFormatted} />
                                <StatMini icon={Activity} label={cr?.avgSession || 'Avg session'} value={stat.avgSessionDuration} />
                                <StatMini icon={Target} label={cr?.utilization || 'Utilization'} value={`${stat.utilization}%`} color={stat.utilization >= 70 ? 'text-green-600' : 'text-red-600'} />
                              </div>

                              {/* Login / Logout */}
                              <div className="flex flex-wrap gap-3 text-xs">
                                <span className="text-muted-foreground">
                                  {cr?.firstLogin || 'First login'}: <span className="font-medium text-foreground">{formatDateShort(stat.firstLogin || '')}</span>
                                </span>
                                <span className="text-muted-foreground">
                                  {cr?.lastLogout || 'Last logout'}: <span className="font-medium text-foreground">{formatDateShort(stat.lastLogout || '')}</span>
                                </span>
                              </div>

                              {/* Break details */}
                              {stat.breakSummary.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-2">{cr?.breakDetails || 'Break details'}</p>
                                  <div className="flex flex-wrap gap-2">
                                    {stat.breakSummary.map((b, bi) => (
                                      <Badge key={bi} variant="outline" className="gap-1 text-xs text-yellow-700">
                                        <Coffee className="h-3 w-3" />
                                        {b.type}: {b.count}x ({b.totalFormatted})
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Individual sessions table */}
                              {stat.sessionDetails.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-2">{cr?.sessionLog || 'Session log'} ({stat.sessionDetails.length})</p>
                                  <ScrollArea className="w-full">
                                    <div className="min-w-[800px]">
                                      <table className="w-full text-xs" data-testid={`table-sessions-${stat.operatorId}`}>
                                        <thead>
                                          <tr className="border-b bg-muted/40">
                                            <th className="text-left p-1.5 font-medium">{cr?.login || 'Login'}</th>
                                            <th className="text-left p-1.5 font-medium">{cr?.logout || 'Logout'}</th>
                                            <th className="text-center p-1.5 font-medium">{cr?.status || 'Status'}</th>
                                            <th className="text-center p-1.5 font-medium">{cr.totalWorkTime}</th>
                                            <th className="text-center p-1.5 font-medium">{cr.totalBreakTime}</th>
                                            <th className="text-center p-1.5 font-medium">{cr.totalCallTime}</th>
                                            <th className="text-center p-1.5 font-medium">{cr.totalEmailTime}</th>
                                            <th className="text-center p-1.5 font-medium">{cr.totalSmsTime}</th>
                                            <th className="text-center p-1.5 font-medium">{cr.totalWrapUpTime}</th>
                                            <th className="text-center p-1.5 font-medium">{cr.contactsHandled}</th>
                                            <th className="text-center p-1.5 font-medium">{cr?.breaks || 'Breaks'}</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {stat.sessionDetails.map((sd, si) => (
                                            <tr key={sd.sessionId} className="border-b hover:bg-muted/20">
                                              <td className="p-1.5">{formatDateShort(sd.login || '')}</td>
                                              <td className="p-1.5">{formatDateShort(sd.logout || '')}</td>
                                              <td className="p-1.5 text-center">
                                                <Badge variant="outline" className="text-[10px]">{sd.status}</Badge>
                                              </td>
                                              <td className="p-1.5 text-center font-mono">{formatDurationLocal(sd.workTime)}</td>
                                              <td className="p-1.5 text-center font-mono text-yellow-600">{formatDurationLocal(sd.breakTime)}</td>
                                              <td className="p-1.5 text-center font-mono text-green-600">{formatDurationLocal(sd.callTime)} <span className="text-muted-foreground">({sd.callCount || 0})</span></td>
                                              <td className="p-1.5 text-center font-mono text-blue-600">{formatDurationLocal(sd.emailTime)} <span className="text-muted-foreground">({sd.emailCount || 0})</span></td>
                                              <td className="p-1.5 text-center font-mono text-purple-600">{formatDurationLocal(sd.smsTime)} <span className="text-muted-foreground">({sd.smsCount || 0})</span></td>
                                              <td className="p-1.5 text-center font-mono text-orange-600">{formatDurationLocal(sd.wrapUpTime)}</td>
                                              <td className="p-1.5 text-center font-semibold">{sd.contactsHandled}</td>
                                              <td className="p-1.5 text-center">{sd.breakCount}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </ScrollArea>
                                </div>
                              )}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ CALL LIST TAB ============ */}
        <TabsContent value="call-list" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    {cr.callList}
                  </CardTitle>
                  <CardDescription>{cr.callListDesc}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {callList.length > 0 && (
                    <>
                      <Badge variant="secondary">
                        <Phone className="h-3 w-3 mr-1" />
                        {callList.filter(c => c.type === 'call').length}
                      </Badge>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        <Mail className="h-3 w-3 mr-1" />
                        {callList.filter(c => c.type === 'email').length}
                      </Badge>
                      <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                        <MessageSquare className="h-3 w-3 mr-1" />
                        {callList.filter(c => c.type === 'sms').length}
                      </Badge>
                    </>
                  )}
                </div>
              </div>
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
                          <th className="text-center p-2 font-medium w-10">{cr?.type || 'Type'}</th>
                          <th className="text-left p-2 font-medium">{cr.agent}</th>
                          <th className="text-left p-2 font-medium">{cr.customer}</th>
                          <th className="text-left p-2 font-medium">{cr.phoneNumber}</th>
                          <th className="text-center p-2 font-medium">{cr.direction}</th>
                          <th className="text-center p-2 font-medium">{cr.status}</th>
                          <th className="text-center p-2 font-medium">{cr.startedAt}</th>
                          <th className="text-center p-2 font-medium">{cr.ringTime}</th>
                          <th className="text-center p-2 font-medium">{cr.talkTime}</th>
                          <th className="text-center p-2 font-medium">{cr.totalDuration}</th>
                          <th className="text-center p-2 font-medium">{cr?.hungUpBy || 'Hung up'}</th>
                          <th className="text-left p-2 font-medium">{cr?.subjectOrNotes || 'Details'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {callList.map((call) => (
                          <tr key={call.id} className={`border-b hover:bg-muted/30 ${call.type === 'email' ? 'bg-blue-50/30 dark:bg-blue-950/20' : call.type === 'sms' ? 'bg-green-50/30 dark:bg-green-950/20' : ''}`} data-testid={`row-event-${call.id}`}>
                            <td className="p-2 text-center">
                              {call.type === 'call' ? (
                                <Phone className="h-4 w-4 mx-auto text-orange-500" />
                              ) : call.type === 'email' ? (
                                <Mail className="h-4 w-4 mx-auto text-blue-500" />
                              ) : call.type === 'sms' ? (
                                <MessageSquare className="h-4 w-4 mx-auto text-green-500" />
                              ) : (
                                <MessageSquare className="h-4 w-4 mx-auto text-muted-foreground" />
                              )}
                            </td>
                            <td className="p-2 font-medium">{call.agent || '-'}</td>
                            <td className="p-2">{call.customer}</td>
                            <td className="p-2 font-mono text-xs">{call.phoneNumber || call.recipient || '-'}</td>
                            <td className="p-2 text-center">
                              <Badge variant={call.direction === 'inbound' ? 'secondary' : 'outline'}>
                                {call.direction === 'inbound' ? (cr.inbound || 'In') : (cr.outbound || 'Out')}
                              </Badge>
                            </td>
                            <td className="p-2 text-center"><StatusBadge status={call.status} /></td>
                            <td className="p-2 text-center text-xs">{formatDateTime(call.startedAt)}</td>
                            <td className="p-2 text-center font-mono text-xs">
                              {call.type === 'call' ? call.ringTimeFormatted : '—'}
                            </td>
                            <td className="p-2 text-center font-mono text-xs font-semibold text-green-600">
                              {call.type === 'call' ? call.talkTimeFormatted : '—'}
                            </td>
                            <td className="p-2 text-center font-mono text-xs">
                              {call.type === 'call' ? call.totalDurationFormatted : '—'}
                            </td>
                            <td className="p-2 text-center text-xs">
                              {call.type === 'call' && call.hungUpBy ? (
                                <Badge variant="outline" className="text-[10px]">{call.hungUpBy}</Badge>
                              ) : '-'}
                            </td>
                            <td className="p-2 text-xs max-w-[250px] truncate" title={call.subject || call.notes}>
                              {call.type === 'email' ? (
                                <span className="text-blue-600 dark:text-blue-400">{call.subject || call.notes || '-'}</span>
                              ) : call.type === 'sms' ? (
                                <span className="text-green-600 dark:text-green-400">{call.notes || '-'}</span>
                              ) : (
                                call.notes || '-'
                              )}
                            </td>
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

        {/* ============ CALL ANALYSIS TAB ============ */}
        <TabsContent value="call-analysis" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    {cr.callAnalysis}
                  </CardTitle>
                  <CardDescription>{cr.callAnalysisDesc}</CardDescription>
                </div>
                {callAnalysis.length > 0 && (
                  <Badge variant="secondary">{callAnalysis.length} {cr?.records || 'records'}</Badge>
                )}
              </div>
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
                  <div className="min-w-[1500px]">
                    <table className="w-full text-sm" data-testid="table-call-analysis">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-2 font-medium">{cr.agent}</th>
                          <th className="text-left p-2 font-medium">{cr.customer}</th>
                          <th className="text-left p-2 font-medium">{cr.phoneNumber}</th>
                          <th className="text-center p-2 font-medium">{cr.totalDuration}</th>
                          <th className="text-center p-2 font-medium">{cr?.analysisStatus || 'Analysis'}</th>
                          <th className="text-center p-2 font-medium">{cr.sentiment}</th>
                          <th className="text-center p-2 font-medium">{cr.qualityScore}</th>
                          <th className="text-center p-2 font-medium">{cr.scriptCompliance}</th>
                          <th className="text-left p-2 font-medium">{cr.keyTopics}</th>
                          <th className="text-left p-2 font-medium">{cr?.actionItems || 'Action items'}</th>
                          <th className="text-left p-2 font-medium">{cr.alertKeywords}</th>
                          <th className="text-left p-2 font-medium">{cr.summary}</th>
                          <th className="text-left p-2 font-medium">{cr.complianceNotes}</th>
                          <th className="text-center p-2 font-medium">{cr.startedAt}</th>
                          <th className="text-center p-2 font-medium">{cr?.analyzedAt || 'Analyzed'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {callAnalysis.map((rec) => (
                          <tr key={rec.id} className="border-b hover:bg-muted/30" data-testid={`row-analysis-${rec.id}`}>
                            <td className="p-2 font-medium">{rec.agent}</td>
                            <td className="p-2">{rec.customer}</td>
                            <td className="p-2 font-mono text-xs">{rec.phoneNumber}</td>
                            <td className="p-2 text-center font-mono text-xs">{rec.durationFormatted}</td>
                            <td className="p-2 text-center">
                              <Badge variant={rec.analysisStatus === 'completed' ? 'secondary' : 'outline'} className="text-[10px]">
                                {rec.analysisStatus}
                              </Badge>
                            </td>
                            <td className="p-2 text-center"><SentimentBadge sentiment={rec.sentiment} /></td>
                            <td className="p-2 text-center"><ScoreBadge score={rec.qualityScore} /></td>
                            <td className="p-2 text-center"><ScoreBadge score={rec.scriptComplianceScore} /></td>
                            <td className="p-2 text-xs max-w-[180px] truncate" title={rec.keyTopics}>{rec.keyTopics || '-'}</td>
                            <td className="p-2 text-xs max-w-[150px] truncate" title={rec.actionItems}>{rec.actionItems || '-'}</td>
                            <td className="p-2 text-xs max-w-[150px]">
                              {rec.alertKeywords ? (
                                <span className="text-red-600 font-medium flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  {rec.alertKeywords}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="p-2 text-xs max-w-[200px] truncate" title={rec.summary}>{rec.summary || '-'}</td>
                            <td className="p-2 text-xs max-w-[150px] truncate" title={rec.complianceNotes}>{rec.complianceNotes || '-'}</td>
                            <td className="p-2 text-center text-xs">{formatDateTime(rec.createdAt)}</td>
                            <td className="p-2 text-center text-xs">{formatDateTime(rec.analyzedAt)}</td>
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
      </Tabs>

      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={(open) => { setEmailDialogOpen(open); if (!open) { setSelectedUserEmails([]); setEmailRecipient(""); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {cr.sendEmail}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-medium">{cr?.selectRecipients || 'Select recipients'}</Label>
              <ScrollArea className="max-h-48 border rounded-md">
                <div className="p-2 space-y-0.5">
                  {allUsers.filter(u => u.email).map(u => {
                    const isSelected = selectedUserEmails.includes(u.email);
                    return (
                      <div
                        key={u.id}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'}`}
                        onClick={() => setSelectedUserEmails(prev => isSelected ? prev.filter(e => e !== u.email) : [...prev, u.email])}
                        data-testid={`user-recipient-${u.id}`}
                      >
                        <Checkbox
                          checked={isSelected}
                          onClick={(e) => e.stopPropagation()}
                          onCheckedChange={(checked) => setSelectedUserEmails(prev => checked ? [...prev, u.email] : prev.filter(e => e !== u.email))}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{u.fullName || `${u.firstName} ${u.lastName}`}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0">{u.role}</Badge>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              {selectedUserEmails.length > 0 && (
                <p className="text-xs text-muted-foreground">{selectedUserEmails.length} {cr?.recipientsSelected || 'selected'}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">{cr?.additionalEmail || 'Additional email'}</Label>
              <Input
                type="email"
                value={emailRecipient}
                onChange={e => setEmailRecipient(e.target.value)}
                placeholder="email@example.com"
                data-testid="input-email-recipient"
              />
            </div>
            <div className="p-3 bg-muted/50 rounded-lg space-y-1">
              <p className="text-xs text-muted-foreground">{cr.emailSubject}:</p>
              <p className="text-sm font-medium">{campaign?.name || ''} - {activeTab === 'operator-stats' ? cr.operatorStats : activeTab === 'call-list' ? cr.callList : cr.callAnalysis}</p>
              {dateFrom && dateTo && (
                <p className="text-xs text-muted-foreground">{dateFrom} → {dateTo}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" data-testid="btn-cancel-email">{cr.cancel}</Button>
            </DialogClose>
            <Button
              onClick={() => emailMutation.mutate()}
              disabled={(selectedUserEmails.length === 0 && !emailRecipient) || emailMutation.isPending}
              data-testid="btn-send-email-confirm"
            >
              {emailMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Mail className="h-4 w-4 mr-1" />}
              {cr.send}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scheduled Reports Section */}
      <Card className="mt-4">
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarClock className="h-4 w-4" />
              {cr?.scheduledReports || 'Scheduled Reports'}
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => setScheduleDialogOpen(true)} data-testid="btn-add-schedule">
              <Plus className="h-3 w-3 mr-1" />
              {cr?.addSchedule || 'Add Schedule'}
            </Button>
          </div>
        </CardHeader>
        {scheduledReportsList.length > 0 && (
          <CardContent className="px-4 pb-3 pt-0">
            <div className="space-y-2">
              {scheduledReportsList.map(sched => (
                <div key={sched.id} className={`flex items-center gap-3 p-2 rounded-lg border text-xs ${sched.enabled ? 'bg-background' : 'bg-muted/30 opacity-60'}`} data-testid={`schedule-${sched.id}`}>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 shrink-0"
                    onClick={() => toggleScheduleMutation.mutate({ id: sched.id, enabled: !sched.enabled })}
                    data-testid={`toggle-schedule-${sched.id}`}
                  >
                    <Power className={`h-3 w-3 ${sched.enabled ? 'text-green-500' : 'text-muted-foreground'}`} />
                  </Button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">{sched.sendTime}</Badge>
                      {sched.reportTypes.map(rt => (
                        <Badge key={rt} variant="secondary" className="text-[10px]">
                          {rt === 'operator-stats' ? (cr?.operatorStats || 'Operator Stats') : rt === 'call-list' ? (cr?.callList || 'Call List') : (cr?.callAnalysis || 'Call Analysis')}
                        </Badge>
                      ))}
                      <Badge variant="outline" className="text-[10px]">
                        {sched.dateRangeType === 'yesterday' ? (cr?.yesterday || 'Yesterday') : sched.dateRangeType === 'last7days' ? (cr?.last7Days || 'Last 7 days') : (cr?.last30Days || 'Last 30 days')}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {sched.recipientUserIds.length} {cr?.recipients || 'recipients'}
                      {sched.lastRunAt && ` · ${cr?.lastRun || 'Last run'}: ${new Date(sched.lastRunAt).toLocaleString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => sendNowMutation.mutate(sched.id)}
                            disabled={sendNowMutation.isPending}
                            data-testid={`sendnow-schedule-${sched.id}`}
                          >
                            {sendNowMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{cr?.sendNow || 'Send Now'}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => openEditSchedule(sched)}
                            data-testid={`edit-schedule-${sched.id}`}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{cr?.editSchedule || 'Edit'}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={() => deleteScheduleMutation.mutate(sched.id)}
                      data-testid={`delete-schedule-${sched.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Schedule Dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={(open) => { setScheduleDialogOpen(open); if (!open) { setSchedRecipientIds([]); setEditingScheduleId(null); setSchedReportTypes(['operator-stats']); setSchedSendTime("08:00"); setSchedDateRange("yesterday"); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5" />
              {editingScheduleId ? (cr?.editSchedule || 'Edit Scheduled Report') : (cr?.createSchedule || 'Create Scheduled Report')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-medium">{cr?.reportType || 'Report Types'}</Label>
              <div className="flex gap-2 flex-wrap">
                {(['operator-stats', 'call-list', 'call-analysis'] as const).map(rt => {
                  const isSelected = schedReportTypes.includes(rt);
                  return (
                    <div
                      key={rt}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded border cursor-pointer text-xs ${isSelected ? 'bg-primary/10 border-primary/30' : 'hover:bg-muted/50'}`}
                      onClick={() => setSchedReportTypes(prev => isSelected ? prev.filter(r => r !== rt) : [...prev, rt])}
                    >
                      <Checkbox checked={isSelected} onClick={(e) => e.stopPropagation()} onCheckedChange={(checked) => setSchedReportTypes(prev => checked ? [...prev, rt] : prev.filter(r => r !== rt))} />
                      <span>{rt === 'operator-stats' ? (cr?.operatorStats || 'Operator Stats') : rt === 'call-list' ? (cr?.callList || 'Call List') : (cr?.callAnalysis || 'Call Analysis')}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-medium">{cr?.sendTime || 'Send Time'}</Label>
                <Input type="time" value={schedSendTime} onChange={e => setSchedSendTime(e.target.value)} data-testid="input-schedule-time" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">{cr?.dateRange || 'Date Range'}</Label>
                <Select value={schedDateRange} onValueChange={setSchedDateRange}>
                  <SelectTrigger data-testid="select-schedule-range"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yesterday">{cr?.yesterday || 'Yesterday'}</SelectItem>
                    <SelectItem value="last7days">{cr?.last7Days || 'Last 7 days'}</SelectItem>
                    <SelectItem value="last30days">{cr?.last30Days || 'Last 30 days'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">{cr?.selectRecipients || 'Select Recipients'}</Label>
              <ScrollArea className="max-h-40 border rounded-md">
                <div className="p-2 space-y-0.5">
                  {allUsers.filter(u => u.email).map(u => {
                    const isSelected = schedRecipientIds.includes(u.id);
                    return (
                      <div
                        key={u.id}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'}`}
                        onClick={() => setSchedRecipientIds(prev => isSelected ? prev.filter(id => id !== u.id) : [...prev, u.id])}
                      >
                        <Checkbox
                          checked={isSelected}
                          onClick={(e) => e.stopPropagation()}
                          onCheckedChange={(checked) => setSchedRecipientIds(prev => checked ? [...prev, u.id] : prev.filter(id => id !== u.id))}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{u.fullName || `${u.firstName} ${u.lastName}`}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0">{u.role}</Badge>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              {schedRecipientIds.length > 0 && (
                <p className="text-xs text-muted-foreground">{schedRecipientIds.length} {cr?.recipientsSelected || 'selected'}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{cr?.cancel || 'Cancel'}</Button>
            </DialogClose>
            <Button
              onClick={() => {
                const payload = {
                  reportTypes: schedReportTypes,
                  recipientUserIds: schedRecipientIds,
                  sendTime: schedSendTime,
                  dateRangeType: schedDateRange,
                };
                if (editingScheduleId) {
                  updateScheduleMutation.mutate({ id: editingScheduleId, data: payload });
                } else {
                  createScheduleMutation.mutate(payload);
                }
              }}
              disabled={schedReportTypes.length === 0 || schedRecipientIds.length === 0 || createScheduleMutation.isPending || updateScheduleMutation.isPending}
              data-testid="btn-create-schedule"
            >
              {(createScheduleMutation.isPending || updateScheduleMutation.isPending) ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CalendarClock className="h-4 w-4 mr-1" />}
              {editingScheduleId ? (cr?.saveChanges || 'Save Changes') : (cr?.createSchedule || 'Create Schedule')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}