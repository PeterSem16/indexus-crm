import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/auth-context";
import { CHART_PALETTE } from "@/lib/chart-colors";
import { 
  ArrowLeft, Users, Settings, BarChart3, FileText, 
  Play, Pause, CheckCircle, CheckCircle2, Clock, Phone, PhoneMissed, User, Calendar,
  RefreshCw, Download, Filter, MoreHorizontal, Trash2, CheckCheck,
  Copy, Save, ScrollText, History, ArrowRight, Mail, MessageSquare, FileEdit, Package, Shield,
  Plus, ChevronDown, ChevronLeft, ChevronRight, ListChecks, Upload, FileUp, AlertTriangle,
  ThumbsUp, ThumbsDown, CalendarPlus, PhoneOff, AlertCircle, XCircle, Zap, Star,
  CircleDot, Info, Heart, Ban, Bell, Send, Target, Flag, Eye, EyeOff,
  Volume2, VolumeX, UserCheck, UserX, Briefcase, Gift, Home, MapPin, Globe,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DataTable, type SortConfig } from "@/components/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type Campaign, type CampaignContact, type Customer, COUNTRIES, type OperatorScript, operatorScriptSchema, type CampaignDisposition, DISPOSITION_ACTION_TYPES } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ScriptBuilder } from "@/components/script-builder";
import { ScriptRunner } from "@/components/script-runner";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CriteriaBuilder, type CriteriaGroup, criteriaToDescription } from "@/components/criteria-builder";
import { ScheduleEditor, type ScheduleConfig, getDefaultScheduleConfig } from "@/components/schedule-editor";
import { CampaignContactsFilter, type CampaignContactFilters, applyContactFilters } from "@/components/campaign-contacts-filter";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const ICON_PICKER_SET: { name: string; icon: LucideIcon }[] = [
  { name: "Phone", icon: Phone },
  { name: "PhoneOff", icon: PhoneOff },
  { name: "Mail", icon: Mail },
  { name: "MessageSquare", icon: MessageSquare },
  { name: "Send", icon: Send },
  { name: "ThumbsUp", icon: ThumbsUp },
  { name: "ThumbsDown", icon: ThumbsDown },
  { name: "CheckCircle", icon: CheckCircle },
  { name: "XCircle", icon: XCircle },
  { name: "AlertCircle", icon: AlertCircle },
  { name: "Ban", icon: Ban },
  { name: "Clock", icon: Clock },
  { name: "Calendar", icon: Calendar },
  { name: "CalendarPlus", icon: CalendarPlus },
  { name: "Star", icon: Star },
  { name: "Heart", icon: Heart },
  { name: "Zap", icon: Zap },
  { name: "Bell", icon: Bell },
  { name: "Info", icon: Info },
  { name: "Flag", icon: Flag },
  { name: "Target", icon: Target },
  { name: "Eye", icon: Eye },
  { name: "EyeOff", icon: EyeOff },
  { name: "User", icon: User },
  { name: "UserCheck", icon: UserCheck },
  { name: "UserX", icon: UserX },
  { name: "Users", icon: Users },
  { name: "Home", icon: Home },
  { name: "MapPin", icon: MapPin },
  { name: "Globe", icon: Globe },
  { name: "Briefcase", icon: Briefcase },
  { name: "Gift", icon: Gift },
  { name: "FileText", icon: FileText },
  { name: "Volume2", icon: Volume2 },
  { name: "VolumeX", icon: VolumeX },
  { name: "CircleDot", icon: CircleDot },
];

const ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  ICON_PICKER_SET.map(i => [i.name, i.icon])
);

type EnrichedContact = CampaignContact & { customer?: Customer };

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  paused: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const CONTACT_STATUS_COLORS: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  contacted: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  no_answer: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  callback_scheduled: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  not_interested: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
};

function StatsCard({ 
  title, 
  value, 
  description, 
  icon: Icon 
}: { 
  title: string; 
  value: string | number; 
  description?: string;
  icon: any;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function CriteriaCard({ campaign }: { campaign: Campaign }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [criteria, setCriteria] = useState<CriteriaGroup[]>(() => {
    try {
      return campaign.criteria ? JSON.parse(campaign.criteria) : [];
    } catch {
      return [];
    }
  });
  const [hasChanges, setHasChanges] = useState(false);

  const saveCriteriaMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/campaigns/${campaign.id}`, {
        criteria: JSON.stringify(criteria),
      });
    },
    onSuccess: () => {
      toast({ title: t.campaigns.detail.settingsSaved });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaign.id] });
    },
    onError: () => {
      toast({ title: t.campaigns.detail.error, variant: "destructive" });
    },
  });

  const handleCriteriaChange = (newCriteria: CriteriaGroup[]) => {
    setCriteria(newCriteria);
    setHasChanges(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle>{t.campaigns.detail.targetCriteria}</CardTitle>
            <CardDescription>
              {t.campaigns.detail.targetCriteriaDesc}
            </CardDescription>
          </div>
          {hasChanges && (
            <Button
              onClick={() => saveCriteriaMutation.mutate()}
              disabled={saveCriteriaMutation.isPending}
              data-testid="button-save-criteria"
            >
              {saveCriteriaMutation.isPending ? t.campaigns.detail.saving : t.common.save}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <CriteriaBuilder
          criteria={criteria}
          onChange={handleCriteriaChange}
          readonly={campaign.status !== "draft"}
        />
      </CardContent>
    </Card>
  );
}

function AutoModeCard({ campaign }: { campaign: Campaign }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [autoMode, setAutoMode] = useState(false);
  const [autoDelaySeconds, setAutoDelaySeconds] = useState(5);
  const [contactSortField, setContactSortField] = useState("createdAt");
  const [contactSortOrder, setContactSortOrder] = useState("desc");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    try {
      if (campaign.settings) {
        const s = JSON.parse(campaign.settings);
        setAutoMode(!!s.autoMode);
        setAutoDelaySeconds(s.autoDelaySeconds || 5);
        setContactSortField(s.contactSortField || "createdAt");
        setContactSortOrder(s.contactSortOrder || "desc");
      }
    } catch {}
  }, [campaign.settings]);

  const saveAutoModeMutation = useMutation({
    mutationFn: async () => {
      let existing: Record<string, any> = {};
      try {
        if (campaign.settings) existing = JSON.parse(campaign.settings);
      } catch {}
      const merged = { ...existing, autoMode, autoDelaySeconds, contactSortField, contactSortOrder };
      return apiRequest("PATCH", `/api/campaigns/${campaign.id}`, {
        settings: JSON.stringify(merged),
      });
    },
    onSuccess: () => {
      toast({ title: t.campaigns.detail.settingsSaved });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaign.id] });
    },
    onError: () => {
      toast({ title: t.campaigns.detail.error, variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle>{t.campaigns.detail.autoMode}</CardTitle>
            <CardDescription>
              {t.campaigns.detail.autoModeDesc}
            </CardDescription>
          </div>
          {hasChanges && (
            <Button
              onClick={() => saveAutoModeMutation.mutate()}
              disabled={saveAutoModeMutation.isPending}
              data-testid="button-save-auto-mode"
            >
              {saveAutoModeMutation.isPending ? t.campaigns.detail.saving : t.common.save}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Switch
            checked={autoMode}
            onCheckedChange={(checked) => { setAutoMode(checked); setHasChanges(true); }}
            data-testid="switch-auto-mode"
          />
          <Label className="text-sm font-medium">{t.campaigns.detail.autoMode}</Label>
        </div>
        {autoMode && (
          <div className="space-y-4 pl-1">
            <div className="space-y-1.5">
              <Label className="text-sm">Oneskorenie (sekundy)</Label>
              <Input
                type="number"
                min={1}
                max={120}
                value={autoDelaySeconds}
                onChange={(e) => { setAutoDelaySeconds(parseInt(e.target.value) || 5); setHasChanges(true); }}
                className="w-32"
                data-testid="input-auto-delay"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t.campaigns.detail.sortContactsBy}</Label>
              <Select value={contactSortField} onValueChange={(v) => { setContactSortField(v); setHasChanges(true); }}>
                <SelectTrigger className="w-64" data-testid="select-sort-field">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">{t.campaigns.detail.sortByCreatedAt}</SelectItem>
                  <SelectItem value="dateOfBirth">{t.campaigns.detail.sortByDateOfBirth}</SelectItem>
                  <SelectItem value="priorityScore">{t.campaigns.detail.priority}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{t.campaigns.detail.sortDirection}</Label>
              <Select value={contactSortOrder} onValueChange={(v) => { setContactSortOrder(v); setHasChanges(true); }}>
                <SelectTrigger className="w-64" data-testid="select-sort-order">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">{t.campaigns.detail.sortDesc}</SelectItem>
                  <SelectItem value="asc">{t.campaigns.detail.sortAsc}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SchedulingCard({ campaign }: { campaign: Campaign }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [schedule, setSchedule] = useState<ScheduleConfig>(() => {
    try {
      return campaign.settings ? JSON.parse(campaign.settings) : getDefaultScheduleConfig();
    } catch {
      return getDefaultScheduleConfig();
    }
  });
  const [hasChanges, setHasChanges] = useState(false);

  const saveScheduleMutation = useMutation({
    mutationFn: async () => {
      let existing: Record<string, any> = {};
      try {
        if (campaign.settings) existing = JSON.parse(campaign.settings);
      } catch {}
      const merged = { ...existing, ...schedule };
      return apiRequest("PATCH", `/api/campaigns/${campaign.id}`, {
        settings: JSON.stringify(merged),
      });
    },
    onSuccess: () => {
      toast({ title: t.campaigns.detail.scheduleSaved });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaign.id] });
    },
    onError: () => {
      toast({ title: t.campaigns.detail.scheduleError, variant: "destructive" });
    },
  });

  const handleScheduleChange = (newSchedule: ScheduleConfig) => {
    setSchedule(newSchedule);
    setHasChanges(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle>{t.campaigns.detail.scheduling}</CardTitle>
            <CardDescription>
              {t.campaigns.detail.schedulingDesc}
            </CardDescription>
          </div>
          {hasChanges && (
            <Button
              onClick={() => saveScheduleMutation.mutate()}
              disabled={saveScheduleMutation.isPending}
              data-testid="button-save-schedule"
            >
              {saveScheduleMutation.isPending ? t.campaigns.detail.saving : t.common.save}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScheduleEditor
          schedule={schedule}
          onChange={handleScheduleChange}
          readonly={false}
        />
      </CardContent>
    </Card>
  );
}

function KpiTargetField({ 
  icon: Icon, label, description, hint, value, onChange, unit, min = 0, max = 999, testId 
}: {
  icon: any; label: string; description: string; hint: string;
  value: number; onChange: (v: number) => void; unit?: string;
  min?: number; max?: number; testId: string;
}) {
  return (
    <div className="space-y-1.5 p-4 rounded-lg border bg-muted/20">
      <Label className="text-sm font-medium flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" />
        {label}
      </Label>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="flex items-center gap-2 pt-1">
        <Input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value) || 0)}
          className="w-28"
          data-testid={testId}
        />
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
      <p className="text-xs text-muted-foreground/70 italic">{hint}</p>
    </div>
  );
}

function KpiTargetsCard({ campaign }: { campaign: Campaign }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [targets, setTargets] = useState({
    campaignTotalContactsTarget: 0,
    campaignCompletionTarget: 0,
    campaignConversionTarget: 0,
    campaignRevenueTarget: 0,
    campaignDurationDays: 0,
    agentDailyCallsTarget: 0,
    agentDailyContactsTarget: 0,
    agentDailySuccessTarget: 0,
    agentConversionRateTarget: 0,
    agentAvgCallDurationTarget: 0,
    agentMaxIdleMinutes: 0,
    agentCallbackComplianceTarget: 0,
  });
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    try {
      if (campaign.settings) {
        const s = JSON.parse(campaign.settings);
        if (s.kpiTargets) {
          setTargets(prev => ({ ...prev, ...s.kpiTargets }));
        }
      }
    } catch {}
  }, [campaign.settings]);

  const saveKpiMutation = useMutation({
    mutationFn: async () => {
      let existing: Record<string, any> = {};
      try {
        if (campaign.settings) existing = JSON.parse(campaign.settings);
      } catch {}
      const merged = { ...existing, kpiTargets: targets };
      return apiRequest("PATCH", `/api/campaigns/${campaign.id}`, {
        settings: JSON.stringify(merged),
      });
    },
    onSuccess: () => {
      toast({ title: t.campaigns.detail.settingsSaved });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaign.id] });
    },
    onError: () => {
      toast({ title: t.campaigns.detail.error, variant: "destructive" });
    },
  });

  const updateTarget = (key: string, value: number) => {
    setTargets(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Target className="w-5 h-5" />
            {t.campaigns.detail.kpiTargets}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t.campaigns.detail.kpiTotalContactsDesc}
          </p>
        </div>
        {hasChanges && (
          <Button
            onClick={() => saveKpiMutation.mutate()}
            disabled={saveKpiMutation.isPending}
            data-testid="button-save-kpi"
          >
            {saveKpiMutation.isPending ? t.campaigns.detail.saving : t.common.save}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="w-5 h-5" />
            {t.campaigns.detail.kpiTargets}
          </CardTitle>
          <CardDescription>
            {t.campaigns.detail.kpiTotalContactsDesc}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <KpiTargetField
              icon={Users}
              label={t.campaigns.detail.kpiTotalContacts}
              description={t.campaigns.detail.kpiTotalContactsDesc}
              hint=""
              value={targets.campaignTotalContactsTarget}
              onChange={(v) => updateTarget("campaignTotalContactsTarget", v)}
              unit=""
              max={100000}
              testId="input-campaign-total-contacts"
            />
            <KpiTargetField
              icon={CheckCircle}
              label={t.campaigns.detail.completionRate}
              description={t.campaigns.detail.completionRateDesc}
              hint=""
              value={targets.campaignCompletionTarget}
              onChange={(v) => updateTarget("campaignCompletionTarget", v)}
              unit="%"
              max={100}
              testId="input-campaign-completion"
            />
            <KpiTargetField
              icon={Target}
              label={t.campaigns.detail.kpiMinConversionRate}
              description={t.campaigns.detail.kpiMinConversionRateDesc}
              hint=""
              value={targets.campaignConversionTarget}
              onChange={(v) => updateTarget("campaignConversionTarget", v)}
              unit="%"
              max={100}
              testId="input-campaign-conversion"
            />
            <KpiTargetField
              icon={Flag}
              label={t.campaigns.detail.kpiTargetRevenue}
              description={t.campaigns.detail.kpiTargetRevenueDesc}
              hint=""
              value={targets.campaignRevenueTarget}
              onChange={(v) => updateTarget("campaignRevenueTarget", v)}
              unit="EUR"
              max={10000000}
              testId="input-campaign-revenue"
            />
            <KpiTargetField
              icon={Calendar}
              label={t.campaigns.detail.kpiPlannedDuration}
              description={t.campaigns.detail.kpiPlannedDurationDesc}
              hint={t.campaigns.detail.kpiPlannedDurationHint}
              value={targets.campaignDurationDays}
              onChange={(v) => updateTarget("campaignDurationDays", v)}
              unit={t.common.days}
              max={365}
              testId="input-campaign-duration"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="w-5 h-5" />
            {t.campaigns.detail.operator}
          </CardTitle>
          <CardDescription>
            {t.campaigns.detail.kpiDailyCallTarget}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <KpiTargetField
              icon={Phone}
              label={t.campaigns.detail.kpiDailyCallTarget}
              description={t.campaigns.detail.kpiDailyCallTargetDesc}
              hint=""
              value={targets.agentDailyCallsTarget}
              onChange={(v) => updateTarget("agentDailyCallsTarget", v)}
              unit=""
              max={500}
              testId="input-agent-daily-calls"
            />
            <KpiTargetField
              icon={UserCheck}
              label={t.campaigns.detail.kpiDailyContactTarget}
              description={t.campaigns.detail.kpiDailyContactTargetDesc}
              hint=""
              value={targets.agentDailyContactsTarget}
              onChange={(v) => updateTarget("agentDailyContactsTarget", v)}
              unit=""
              max={500}
              testId="input-agent-daily-contacts"
            />
            <KpiTargetField
              icon={Star}
              label={t.campaigns.detail.kpiDailyConversionTarget}
              description={t.campaigns.detail.kpiDailyConversionTargetDesc}
              hint=""
              value={targets.agentDailySuccessTarget}
              onChange={(v) => updateTarget("agentDailySuccessTarget", v)}
              unit=""
              max={100}
              testId="input-agent-daily-success"
            />
            <KpiTargetField
              icon={Target}
              label={t.campaigns.detail.kpiMinConversionRate}
              description={t.campaigns.detail.kpiMinConversionRateDesc}
              hint=""
              value={targets.agentConversionRateTarget}
              onChange={(v) => updateTarget("agentConversionRateTarget", v)}
              unit="%"
              max={100}
              testId="input-agent-conversion-rate"
            />
            <KpiTargetField
              icon={Clock}
              label={t.campaigns.detail.kpiAvgCallDuration}
              description={t.campaigns.detail.kpiAvgCallDurationDesc}
              hint=""
              value={targets.agentAvgCallDurationTarget}
              onChange={(v) => updateTarget("agentAvgCallDurationTarget", v)}
              unit=""
              max={60}
              testId="input-agent-avg-call-duration"
            />
            <KpiTargetField
              icon={Clock}
              label={t.campaigns.detail.kpiMaxIdleTime}
              description={t.campaigns.detail.kpiMaxIdleTimeDesc}
              hint={t.campaigns.detail.kpiMaxIdleTimeHint}
              value={targets.agentMaxIdleMinutes}
              onChange={(v) => updateTarget("agentMaxIdleMinutes", v)}
              unit=""
              max={30}
              testId="input-agent-max-idle"
            />
            <KpiTargetField
              icon={CalendarPlus}
              label={t.campaigns.detail.callbackScheduled}
              description={t.campaigns.detail.callbackScheduledDesc}
              hint=""
              value={targets.agentCallbackComplianceTarget}
              onChange={(v) => updateTarget("agentCallbackComplianceTarget", v)}
              unit="%"
              max={100}
              testId="input-agent-callback-compliance"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const ACTION_TYPE_COLORS: Record<string, string> = {
  callback: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  dnd: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  complete: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  convert: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  none: "bg-muted text-muted-foreground",
};

function DispositionsTab({ campaignId, embedded }: { campaignId: string; embedded?: boolean }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const [newDisp, setNewDisp] = useState({ name: "", code: "", icon: "", color: "#6b7280", actionType: "none" });

  const { data: dispositions = [], isLoading } = useQuery<CampaignDisposition[]>({
    queryKey: ["/api/campaigns", campaignId, "dispositions"],
    enabled: !!campaignId,
  });

  const parents = dispositions.filter(d => !d.parentId).sort((a, b) => a.sortOrder - b.sortOrder);
  const childrenMap = dispositions.reduce((acc, d) => {
    if (d.parentId) {
      if (!acc[d.parentId]) acc[d.parentId] = [];
      acc[d.parentId].push(d);
    }
    return acc;
  }, {} as Record<string, CampaignDisposition[]>);

  const toggleExpand = (id: string) => {
    setExpandedParents(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const seedMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/campaigns/${campaignId}/dispositions/seed`),
    onSuccess: () => {
      toast({ title: t.campaigns.detail.dispDefaultsCreated });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "dispositions"] });
    },
    onError: () => toast({ title: t.campaigns.detail.error, variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/campaigns/${campaignId}/dispositions`, data),
    onSuccess: () => {
      toast({ title: t.campaigns.detail.dispCreated });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "dispositions"] });
      setShowAddForm(false);
      setAddingSubFor(null);
      setNewDisp({ name: "", code: "", icon: "", color: "#6b7280", actionType: "none" });
    },
    onError: () => toast({ title: t.campaigns.detail.dispCreateError, variant: "destructive" }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest("PATCH", `/api/campaigns/${campaignId}/dispositions/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "dispositions"] });
    },
    onError: () => toast({ title: t.campaigns.detail.error, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/campaigns/${campaignId}/dispositions/${id}`),
    onSuccess: () => {
      toast({ title: t.campaigns.detail.dispDeleted });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "dispositions"] });
    },
    onError: () => toast({ title: t.campaigns.detail.dispDeleteError, variant: "destructive" }),
  });

  const handleCreate = (parentId?: string) => {
    if (!newDisp.name || !newDisp.code) return;
    createMutation.mutate({
      campaignId,
      parentId: parentId || null,
      name: newDisp.name,
      code: newDisp.code,
      icon: newDisp.icon || null,
      color: newDisp.color || null,
      actionType: newDisp.actionType,
    });
  };

  const renderAddForm = (parentId?: string) => (
    <div className="flex flex-wrap items-end gap-2 p-3 rounded-md border bg-muted/30" data-testid="disposition-add-form">
      <div className="space-y-1">
        <Label className="text-xs">{t.campaigns.detail.dispName}</Label>
        <Input
          value={newDisp.name}
          onChange={e => setNewDisp(p => ({ ...p, name: e.target.value }))}
          placeholder={t.campaigns.detail.dispName}
          className="w-40"
          data-testid="input-disposition-name"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t.common.code}</Label>
        <Input
          value={newDisp.code}
          onChange={e => setNewDisp(p => ({ ...p, code: e.target.value }))}
          placeholder="kod"
          className="w-32"
          data-testid="input-disposition-code"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t.campaigns.detail.dispSelectIcon}</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-28 gap-2 justify-start" data-testid="input-disposition-icon">
              {newDisp.icon && ICON_MAP[newDisp.icon] ? (() => {
                const Ic = ICON_MAP[newDisp.icon];
                return <Ic className="h-4 w-4 shrink-0" />;
              })() : <CircleDot className="h-4 w-4 shrink-0 opacity-40" />}
              <span className="text-xs truncate">{newDisp.icon || t.common.select}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2" align="start">
            <div className="grid grid-cols-6 gap-1" data-testid="icon-picker-grid">
              {ICON_PICKER_SET.map(({ name, icon: Ic }) => (
                <Button
                  key={name}
                  size="icon"
                  variant={newDisp.icon === name ? "default" : "ghost"}
                  onClick={() => setNewDisp(p => ({ ...p, icon: name }))}
                  title={name}
                  data-testid={`icon-pick-${name}`}
                >
                  <Ic className="h-4 w-4" />
                </Button>
              ))}
            </div>
            {newDisp.icon && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-1"
                onClick={() => setNewDisp(p => ({ ...p, icon: "" }))}
                data-testid="button-clear-icon"
              >
                {t.common.clear}
              </Button>
            )}
          </PopoverContent>
        </Popover>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t.common.status}</Label>
        <Input
          type="color"
          value={newDisp.color}
          onChange={e => setNewDisp(p => ({ ...p, color: e.target.value }))}
          className="w-14"
          data-testid="input-disposition-color"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t.common.actions}</Label>
        <Select value={newDisp.actionType} onValueChange={v => setNewDisp(p => ({ ...p, actionType: v }))}>
          <SelectTrigger className="w-32" data-testid="select-disposition-action">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DISPOSITION_ACTION_TYPES.map(at => {
              const actionLabels: Record<string, string> = {
                none: t.campaigns.detail.dispActionNone,
                callback: t.campaigns.detail.dispActionCallback,
                dnd: t.campaigns.detail.dispActionDnd,
                complete: t.campaigns.detail.dispActionComplete,
                convert: t.campaigns.detail.dispActionConvert,
              };
              return (
                <SelectItem key={at} value={at}>{actionLabels[at] || at}</SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
      <Button
        size="sm"
        onClick={() => handleCreate(parentId)}
        disabled={createMutation.isPending || !newDisp.name || !newDisp.code}
        data-testid="button-save-disposition"
      >
        {createMutation.isPending ? "..." : t.campaigns.detail.dispSave}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => { setShowAddForm(false); setAddingSubFor(null); }}
        data-testid="button-cancel-disposition"
      >
        {t.campaigns.detail.cancel}
      </Button>
    </div>
  );

  const content = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold" data-testid="text-dispositions-title">{t.campaigns.detail.dispTitle}</h3>
          <p className="text-sm text-muted-foreground">{t.campaigns.detail.dispTitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {dispositions.length === 0 && (
            <Button
              variant="outline"
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              data-testid="button-seed-dispositions"
            >
              <ListChecks className="w-4 h-4 mr-2" />
              {seedMutation.isPending ? t.campaigns.detail.dispLoadDefaultsLoading : t.campaigns.detail.dispLoadDefaults}
            </Button>
          )}
          <Button
            onClick={() => { setShowAddForm(true); setAddingSubFor(null); setNewDisp({ name: "", code: "", icon: "", color: "#6b7280", actionType: "none" }); }}
            data-testid="button-add-disposition"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t.campaigns.detail.dispAddResult}
          </Button>
        </div>
      </div>

      {showAddForm && !addingSubFor && renderAddForm()}

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <RefreshCw className="w-5 h-5 animate-spin" />
        </div>
      ) : parents.length === 0 && !showAddForm ? (
        <div className="text-center py-12 text-muted-foreground" data-testid="text-no-dispositions">
          {t.campaigns.detail.noDataAvailable}
        </div>
      ) : (
        <div className="space-y-3">
          {parents.map(parent => {
            const children = (childrenMap[parent.id] || []).sort((a, b) => a.sortOrder - b.sortOrder);
            const isExpanded = expandedParents.has(parent.id);
            return (
              <Card key={parent.id} data-testid={`card-disposition-${parent.id}`}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    {children.length > 0 && (
                      <Button size="icon" variant="ghost" onClick={() => toggleExpand(parent.id)} data-testid={`button-expand-${parent.id}`}>
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </Button>
                    )}
                    {(() => {
                      const ParentIcon = ICON_MAP[parent.icon || ""] || CircleDot;
                      return <ParentIcon className="w-4 h-4 shrink-0" style={parent.color ? { color: parent.color } : undefined} />;
                    })()}
                    <div className="flex-1 min-w-0">
                      <span className={`font-medium ${!parent.isActive ? "line-through text-muted-foreground" : ""}`} data-testid={`text-disposition-name-${parent.id}`}>
                        {parent.name}
                      </span>
                      <span className="ml-2 text-xs text-muted-foreground">{parent.code}</span>
                    </div>
                    <Badge className={ACTION_TYPE_COLORS[parent.actionType] || ACTION_TYPE_COLORS.none} data-testid={`badge-action-${parent.id}`}>
                      {parent.actionType}
                    </Badge>
                    <Switch
                      checked={parent.isActive}
                      onCheckedChange={checked => toggleActiveMutation.mutate({ id: parent.id, isActive: checked })}
                      data-testid={`switch-active-${parent.id}`}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => { setAddingSubFor(parent.id); setShowAddForm(false); setNewDisp({ name: "", code: "", icon: "", color: parent.color || "#6b7280", actionType: "none" }); }}
                      data-testid={`button-add-sub-${parent.id}`}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(parent.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-disposition-${parent.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {addingSubFor === parent.id && (
                    <div className="mt-3">
                      {renderAddForm(parent.id)}
                    </div>
                  )}

                  {isExpanded && children.length > 0 && (
                    <div className="mt-3 ml-8 space-y-2">
                      {children.map(child => (
                        <div key={child.id} className="flex flex-wrap items-center gap-3 p-2 rounded-md border" data-testid={`row-disposition-${child.id}`}>
                          {(() => {
                            const ChildIcon = ICON_MAP[child.icon || ""] || CircleDot;
                            return <ChildIcon className="w-3.5 h-3.5 shrink-0" style={child.color ? { color: child.color } : undefined} />;
                          })()}
                          <div className="flex-1 min-w-0">
                            <span className={`text-sm ${!child.isActive ? "line-through text-muted-foreground" : ""}`} data-testid={`text-disposition-name-${child.id}`}>
                              {child.name}
                            </span>
                            <span className="ml-2 text-xs text-muted-foreground">{child.code}</span>
                          </div>
                          {child.actionType !== "none" && (
                            <Badge className={ACTION_TYPE_COLORS[child.actionType] || ACTION_TYPE_COLORS.none}>
                              {child.actionType}
                            </Badge>
                          )}
                          <Switch
                            checked={child.isActive}
                            onCheckedChange={checked => toggleActiveMutation.mutate({ id: child.id, isActive: checked })}
                            data-testid={`switch-active-${child.id}`}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteMutation.mutate(child.id)}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-disposition-${child.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  if (embedded) return content;
  return <TabsContent value="dispositions" className="space-y-4">{content}</TabsContent>;
}

export default function CampaignDetailPage() {
  const [, params] = useRoute("/campaigns/:id");
  const campaignId = params?.id || "";
  const { t } = useI18n();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [settingsSubTab, setSettingsSubTab] = useState("general");
  const [contactFilters, setContactFilters] = useState<CampaignContactFilters>({});
  const [selectedContact, setSelectedContact] = useState<EnrichedContact | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [scriptContent, setScriptContent] = useState<string>("");
  const [scriptModified, setScriptModified] = useState(false);
  const [structuredScript, setStructuredScript] = useState<OperatorScript | null>(null);
  const [scriptMode, setScriptMode] = useState<"builder" | "preview" | "legacy">("builder");
  const [structuredScriptModified, setStructuredScriptModified] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; duplicates?: number; updated?: number; errors: string[]; importedContactIds?: string[] } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importPhase, setImportPhase] = useState<"upload" | "processing" | null>(null);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [showRequeueDialog, setShowRequeueDialog] = useState(false);
  const [requeueDispositions, setRequeueDispositions] = useState<Set<string>>(new Set());
  const [requeueStatuses, setRequeueStatuses] = useState<Set<string>>(new Set());
  const [requeueCallbackFrom, setRequeueCallbackFrom] = useState("");
  const [requeueCallbackTo, setRequeueCallbackTo] = useState("");
  const [requeuePage, setRequeuePage] = useState(0);
  const REQUEUE_PAGE_SIZE = 20;

  const { data: campaign, isLoading: loadingCampaign } = useQuery<Campaign>({
    queryKey: ["/api/campaigns", campaignId],
    enabled: !!campaignId,
  });

  const { data: contacts = [], isLoading: loadingContacts } = useQuery<EnrichedContact[]>({
    queryKey: ["/api/campaigns", campaignId, "contacts"],
    enabled: !!campaignId,
  });

  const { data: stats } = useQuery<{
    totalContacts: number;
    pendingContacts: number;
    contactedContacts: number;
    completedContacts: number;
    failedContacts: number;
    noAnswerContacts: number;
    callbackContacts: number;
    notInterestedContacts: number;
  }>({
    queryKey: ["/api/campaigns", campaignId, "stats"],
    enabled: !!campaignId,
  });

  const { data: agentStatsData = [], isError: agentStatsError, error: agentStatsErrorMsg, isLoading: agentStatsLoading } = useQuery<Array<{
    userId: string;
    name: string;
    avatarUrl: string | null;
    totalContacts: number;
    contactedToday: number;
    completedTotal: number;
    completedToday: number;
    noAnswerTotal: number;
    callbackTotal: number;
    notInterestedTotal: number;
    failedTotal: number;
    totalDispositions: number;
    dispositionsToday: number;
    avgAttemptsPerContact: number;
    lastActiveAt: string | null;
  }>>({
    queryKey: ["/api/campaigns", campaignId, "agent-stats"],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/agent-stats`, { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to fetch agent stats: ${res.status}`);
      return res.json();
    },
    enabled: !!campaignId,
    refetchInterval: 30000,
    staleTime: 0,
    retry: 3,
    retryDelay: 1000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const selectedCustomerId = selectedContact?.customerId;
  
  const { data: contactActivityLogs = [] } = useQuery<Array<{
    id: string;
    action: string;
    entityName: string | null;
    details: any;
    createdAt: string;
  }>>({
    queryKey: ["/api/customers", selectedCustomerId, "activity-logs"],
    enabled: !!selectedCustomerId,
  });

  const { data: pipelineStages = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/pipeline-stages"],
  });

  const { data: campaignAgents = [] } = useQuery<Array<{ id: string; userId: string; campaignId: string }>>({
    queryKey: ["/api/campaigns", campaignId, "agents"],
    enabled: !!campaignId,
  });

  const { data: allUsers = [] } = useQuery<Array<{ id: string; fullName: string; role: string; roleId: string | null }>>({
    queryKey: ["/api/users"],
  });

  const { data: roles = [] } = useQuery<Array<{ id: string; name: string; legacyRole: string | null }>>({
    queryKey: ["/api/roles"],
  });

  const { data: campaignDispositions = [] } = useQuery<CampaignDisposition[]>({
    queryKey: ["/api/campaigns", campaignId, "dispositions"],
    enabled: !!campaignId,
  });

  const dispositionMap = useMemo(() => {
    const map: Record<string, { name: string; color: string; icon: string; actionType: string }> = {};
    for (const d of campaignDispositions) {
      map[d.code] = { name: d.name, color: d.color || "gray", icon: d.icon || "", actionType: d.actionType };
    }
    return map;
  }, [campaignDispositions]);

  const callCenterRoleId = roles.find(r => r.name === "Call Center")?.id;
  const callCenterUsers = allUsers.filter(u => u.role === "admin" || (callCenterRoleId && u.roleId === callCenterRoleId));
  const assignedAgentIds = campaignAgents.map(a => a.userId);

  const getStageName = (stageId: string) => {
    const stage = pipelineStages.find(s => s.id === stageId);
    return stage?.name || stageId;
  };

  const generateContactsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/campaigns/${campaignId}/generate-contacts`);
    },
    onSuccess: (data: any) => {
      toast({
        title: t.campaigns.detail.contactsGenerated,
        description: `${data.count}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "stats"] });
    },
    onError: () => {
      toast({
        title: t.campaigns.detail.error,
        variant: "destructive",
      });
    },
  });

  const deleteImportMutation = useMutation({
    mutationFn: async (contactIds: string[]) => {
      return apiRequest("POST", `/api/campaigns/${campaignId}/contacts/delete-batch`, { contactIds });
    },
    onSuccess: (data: any) => {
      setImportResult(null);
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "stats"] });
      toast({ title: t.campaigns.detail.importDeleted, description: `${data.deleted}` });
    },
    onError: () => {
      toast({ title: t.campaigns.detail.error, description: t.campaigns.detail.importDeleteError, variant: "destructive" });
    },
  });

  const importContactsMutation = useMutation({
    mutationFn: async (file: File) => {
      setImportProgress(0);
      setImportPhase("upload");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("updateExisting", String(updateExisting));
      return new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `/api/campaigns/${campaignId}/contacts/import`);
        xhr.withCredentials = true;
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setImportProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.upload.onload = () => {
          setImportProgress(100);
          setImportPhase("processing");
        };
        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(data);
            } else {
              reject(new Error(data.error || t.campaigns.detail.importFailed));
            }
          } catch { reject(new Error(t.campaigns.detail.importFailed)); }
        };
        xhr.onerror = () => reject(new Error(t.campaigns.detail.networkError));
        xhr.send(formData);
      });
    },
    onSuccess: (data) => {
      setImportPhase(null);
      setImportProgress(0);
      setImportResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "stats"] });
      toast({
        title: t.campaigns.detail.importCompleted,
        description: `${data.created} / ${data.skipped}`,
      });
    },
    onError: (err: any) => {
      setImportPhase(null);
      setImportProgress(0);
      toast({ title: t.campaigns.detail.importError, description: err.message, variant: "destructive" });
    },
  });

  const updateContactMutation = useMutation({
    mutationFn: async ({ contactId, data }: { contactId: string; data: any }) => {
      return apiRequest("PATCH", `/api/campaigns/${campaignId}/contacts/${contactId}`, data);
    },
    onSuccess: () => {
      toast({ title: t.campaigns.detail.contactUpdated });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "stats"] });
      setSelectedContact(null);
    },
    onError: () => {
      toast({ title: t.campaigns.detail.error, description: t.campaigns.detail.contactUpdateError, variant: "destructive" });
    },
  });

  const updateAgentsMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      return apiRequest("POST", `/api/campaigns/${campaignId}/agents`, { userIds });
    },
    onSuccess: () => {
      toast({ title: t.campaigns.detail.operatorsUpdated });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "agents"] });
    },
    onError: () => {
      toast({ title: t.campaigns.detail.error, description: t.campaigns.detail.operatorsError, variant: "destructive" });
    },
  });

  const updateCampaignStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      return apiRequest("PATCH", `/api/campaigns/${campaignId}`, { status: newStatus });
    },
    onSuccess: () => {
      toast({ title: t.campaigns.detail.statusUpdated });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
    },
    onError: () => {
      toast({ title: t.campaigns.detail.error, description: t.campaigns.detail.statusUpdateError, variant: "destructive" });
    },
  });

  const cloneCampaignMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/campaigns/${campaignId}/clone`, {});
    },
    onSuccess: (newCampaign: any) => {
      toast({ title: t.campaigns.detail.statusUpdated });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      window.location.href = `/campaigns/${newCampaign.id}`;
    },
    onError: () => {
      toast({ title: t.campaigns.detail.error, variant: "destructive" });
    },
  });

  const saveAsTemplateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/campaigns/${campaignId}/save-as-template`, {});
    },
    onSuccess: () => {
      toast({ title: t.campaigns.detail.settingsSaved });
      queryClient.invalidateQueries({ queryKey: ["/api/campaign-templates"] });
    },
    onError: () => {
      toast({ title: t.campaigns.detail.error, description: t.campaigns.detail.settingsError, variant: "destructive" });
    },
  });

  const bulkUpdateContactsMutation = useMutation({
    mutationFn: async ({ contactIds, data }: { contactIds: string[]; data: any }) => {
      return apiRequest("POST", `/api/campaigns/${campaignId}/contacts/bulk-update`, { contactIds, ...data });
    },
    onSuccess: (data: any) => {
      toast({ title: t.campaigns.detail.contactUpdated, description: `${data.count || selectedContacts.size}` });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "stats"] });
      setSelectedContacts(new Set());
    },
    onError: () => {
      toast({ title: t.campaigns.detail.error, description: t.campaigns.detail.contactUpdateError, variant: "destructive" });
    },
  });

  const requeueMatchingContacts = useMemo(() => {
    if (!showRequeueDialog) return [];
    return contacts.filter((c: any) => {
      if (c.status === "pending") return false;

      if (requeueStatuses.size > 0 && !requeueStatuses.has(c.status)) return false;

      if (requeueDispositions.size > 0) {
        if (!c.dispositionCode || !requeueDispositions.has(c.dispositionCode)) return false;
      }

      if (requeueCallbackFrom || requeueCallbackTo) {
        if (!c.callbackDate) return false;
        const cbDate = new Date(c.callbackDate);
        if (requeueCallbackFrom && cbDate < new Date(requeueCallbackFrom)) return false;
        if (requeueCallbackTo) {
          const toDate = new Date(requeueCallbackTo);
          toDate.setHours(23, 59, 59, 999);
          if (cbDate > toDate) return false;
        }
      }

      return true;
    });
  }, [contacts, showRequeueDialog, requeueStatuses, requeueDispositions, requeueCallbackFrom, requeueCallbackTo]);

  useEffect(() => {
    if (requeueMatchingContacts.length > 0) {
      const maxPage = Math.ceil(requeueMatchingContacts.length / REQUEUE_PAGE_SIZE) - 1;
      if (requeuePage > maxPage) {
        setRequeuePage(maxPage);
      }
    } else {
      setRequeuePage(0);
    }
  }, [requeueMatchingContacts.length, requeuePage]);

  const requeueMutation = useMutation({
    mutationFn: async (contactIds: string[]) => {
      const res = await apiRequest("POST", `/api/campaigns/${campaignId}/contacts/bulk-update`, {
        contactIds,
        requeue: true,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: t.campaigns.detail.requeueTitle, description: `${data.count}` });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "stats"] });
      setShowRequeueDialog(false);
      setRequeueDispositions(new Set());
      setRequeueStatuses(new Set());
      setRequeueCallbackFrom("");
      setRequeueCallbackTo("");
    },
    onError: () => {
      toast({ title: t.campaigns.detail.error, variant: "destructive" });
    },
  });

  const saveScriptMutation = useMutation({
    mutationFn: async (script: string) => {
      return apiRequest("PATCH", `/api/campaigns/${campaignId}`, { script });
    },
    onSuccess: () => {
      toast({ title: t.campaigns.detail.settingsSaved });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId] });
      setScriptModified(false);
    },
    onError: () => {
      toast({ title: t.campaigns.detail.error, description: t.campaigns.detail.settingsError, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (campaign?.script !== undefined) {
      const scriptValue = campaign.script || "";
      setScriptContent(scriptValue);
      setScriptModified(false);
      
      // Try to parse as structured script
      try {
        if (scriptValue.startsWith("{")) {
          const parsed = JSON.parse(scriptValue);
          const validated = operatorScriptSchema.safeParse(parsed);
          if (validated.success) {
            setStructuredScript(validated.data);
            setScriptMode("builder");
          } else {
            // Invalid JSON structure, keep as legacy but init empty structured
            setStructuredScript({ version: 1, steps: [] });
            setScriptMode("legacy");
          }
        } else if (scriptValue.trim()) {
          // Plain text script - keep in legacy mode
          setStructuredScript({ version: 1, steps: [] });
          setScriptMode("legacy");
        } else {
          // Empty script - start fresh in builder mode
          setStructuredScript({ version: 1, steps: [] });
          setScriptMode("builder");
        }
      } catch {
        // JSON parse error, keep as legacy
        setStructuredScript({ version: 1, steps: [] });
        setScriptMode("legacy");
      }
      setStructuredScriptModified(false);
    }
  }, [campaign?.script]);

  const handleBulkStatusUpdate = (newStatus: string) => {
    if (selectedContacts.size === 0) return;
    bulkUpdateContactsMutation.mutate({ 
      contactIds: Array.from(selectedContacts), 
      data: { status: newStatus } 
    });
  };

  const handleExportContacts = () => {
    const dataToExport = selectedContacts.size > 0
      ? filteredContacts.filter((c: any) => selectedContacts.has(c.id))
      : filteredContacts;
    
    const headers = [t.common.firstName, t.common.lastName, t.common.email, t.common.phone, t.common.status, t.campaigns.detail.result, t.common.code, t.campaigns.detail.attempts, t.campaigns.detail.lastAttempt, t.campaigns.detail.country];
    const rows = dataToExport.map((c: any) => [
      c.customer?.firstName || "",
      c.customer?.lastName || "",
      c.customer?.email || "",
      c.customer?.phone || "",
      (t.campaigns.contactStatuses as Record<string, string>)[c.status] || c.status,
      c.dispositionCode ? (dispositionMap[c.dispositionCode]?.name || c.dispositionCode) : "",
      c.dispositionCode || "",
      c.attemptCount || 0,
      c.lastAttemptAt ? format(new Date(c.lastAttemptAt), "yyyy-MM-dd HH:mm") : "",
      c.customer?.country || "",
    ]);
    
    const csvContent = [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `campaign-${campaign?.name || campaignId}-contacts.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: t.campaigns.detail.exportContacts, description: `${dataToExport.length}` });
  };

  if (loadingCampaign) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-6">
        <p>Campaign not found</p>
        <Link href="/campaigns">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Campaigns
          </Button>
        </Link>
      </div>
    );
  }

  const filteredContacts = applyContactFilters(contacts as any, contactFilters);

  const progressPercentage = stats 
    ? ((stats.completedContacts + stats.notInterestedContacts) / Math.max(stats.totalContacts, 1)) * 100
    : 0;

  const contactColumns = [
    {
      key: "customer",
      header: t.campaigns.detail.contacts,
      sortable: true,
      sortValue: (contact: EnrichedContact) => contact.customer ? `${contact.customer.lastName} ${contact.customer.firstName}` : "",
      cell: (contact: EnrichedContact) => (
        <div>
          <div className="font-medium">
            {contact.customer ? `${contact.customer.firstName} ${contact.customer.lastName}` : t.campaigns.detail.unknownContact}
          </div>
          <div className="text-sm text-muted-foreground">
            {contact.customer?.phone || contact.customer?.email || "-"}
          </div>
        </div>
      ),
    },
    {
      key: "country",
      header: t.campaigns.detail.country,
      sortable: true,
      sortValue: (contact: EnrichedContact) => contact.customer?.country || "",
      cell: (contact: EnrichedContact) => {
        const countryCode = contact.customer?.country;
        if (!countryCode) return <span>-</span>;
        const countryData = COUNTRIES[countryCode as keyof typeof COUNTRIES] as { name: string } | undefined;
        return <span>{countryData?.name || countryCode}</span>;
      },
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortValue: (contact: EnrichedContact) => contact.status,
      cell: (contact: EnrichedContact) => {
        const STATUS_SK: Record<string, string> = {
          pending: t.campaigns.contactStatuses.pending,
          contacted: t.campaigns.contactStatuses.contacted,
          completed: t.campaigns.contactStatuses.completed,
          failed: t.campaigns.contactStatuses.failed,
          no_answer: t.campaigns.contactStatuses.no_answer,
          callback_scheduled: t.campaigns.contactStatuses.callback_scheduled,
          not_interested: t.campaigns.contactStatuses.not_interested,
        };
        return (
          <Badge className={CONTACT_STATUS_COLORS[contact.status] || ""}>
            {STATUS_SK[contact.status] || contact.status.replace("_", " ")}
          </Badge>
        );
      },
    },
    {
      key: "attemptCount",
      header: t.campaigns.detail.attempts,
      sortable: true,
      sortValue: (contact: EnrichedContact) => contact.attemptCount || 0,
      cell: (contact: EnrichedContact) => (
        <span>{contact.attemptCount || 0}</span>
      ),
    },
    {
      key: "lastAttemptAt",
      header: t.campaigns.detail.lastAttempt,
      sortable: true,
      sortValue: (contact: EnrichedContact) => contact.lastAttemptAt ? new Date(contact.lastAttemptAt) : null,
      cell: (contact: EnrichedContact) => (
        <span>
          {contact.lastAttemptAt ? format(new Date(contact.lastAttemptAt), "dd.MM.yyyy HH:mm") : "-"}
        </span>
      ),
    },
    {
      key: "priorityScore",
      header: t.campaigns.detail.priority,
      sortable: true,
      sortValue: (contact: EnrichedContact) => contact.priorityScore || 0,
      cell: (contact: EnrichedContact) => {
        const score = contact.priorityScore || 50;
        const colors = score >= 75 
          ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
          : score >= 50 
          ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
          : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
        return (
          <Badge variant="outline" className={colors}>
            {score >= 75 ? t.campaigns.detail.priorityHigh : score >= 50 ? t.campaigns.detail.priorityMedium : t.campaigns.detail.priorityLow}
          </Badge>
        );
      },
    },
    {
      key: "assignedTo",
      header: t.campaigns.detail.operator,
      sortable: true,
      sortValue: (contact: EnrichedContact) => {
        const agent = allUsers.find(u => u.id === contact.assignedTo);
        return agent?.fullName || contact.assignedTo || "";
      },
      cell: (contact: EnrichedContact) => {
        if (!contact.assignedTo) return <span className="text-muted-foreground">-</span>;
        const agent = allUsers.find(u => u.id === contact.assignedTo);
        return (
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-muted-foreground" />
            <span>{agent?.fullName || contact.assignedTo}</span>
          </div>
        );
      },
    },
    {
      key: "disposition",
      header: t.campaigns.detail.result,
      sortable: true,
      sortValue: (contact: EnrichedContact) => {
        const dc = (contact as any).dispositionCode;
        return dc ? (dispositionMap[dc]?.name || dc) : "";
      },
      cell: (contact: EnrichedContact) => {
        const dc = (contact as any).dispositionCode;
        const disp = dc ? dispositionMap[dc] : null;
        const hasCallback = contact.status === "callback_scheduled" && contact.callbackDate;
        const hasNotes = contact.notes && contact.notes.trim().length > 0;

        const colorClasses: Record<string, string> = {
          green: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
          blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
          orange: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
          red: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
          yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
          gray: "bg-muted text-muted-foreground",
        };

        if (!disp && !hasCallback && !hasNotes) {
          return <span className="text-muted-foreground">-</span>;
        }
        return (
          <div className="space-y-1 max-w-[220px]">
            {disp && (
              <Badge variant="secondary" className={`text-xs ${colorClasses[disp.color] || colorClasses.gray}`} data-testid={`badge-disposition-${dc}`}>
                {disp.name}
              </Badge>
            )}
            {hasCallback && (
              <div className="flex items-center gap-1 text-xs">
                <CalendarPlus className="w-3 h-3 text-blue-500" />
                <span>{format(new Date(contact.callbackDate!), "dd.MM. HH:mm")}</span>
              </div>
            )}
            {hasNotes && (
              <p className="text-xs text-muted-foreground truncate" title={contact.notes!}>
                {contact.notes}
              </p>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/campaigns">
          <Button variant="ghost" size="icon" data-testid="button-back-campaigns">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">{campaign.name}</h1>
            <Badge className={STATUS_COLORS[campaign.status]}>
              {t.campaigns.statuses[campaign.status as keyof typeof t.campaigns.statuses] || campaign.status}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {campaign.description || ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {campaign.status === "draft" && (
            <Button 
              onClick={() => updateCampaignStatusMutation.mutate("active")}
              data-testid="button-activate-campaign"
            >
              <Play className="w-4 h-4 mr-2" />
              {t.campaigns.statuses.active}
            </Button>
          )}
          {campaign.status === "active" && (
            <Button 
              variant="outline"
              onClick={() => updateCampaignStatusMutation.mutate("paused")}
              data-testid="button-pause-campaign"
            >
              <Pause className="w-4 h-4 mr-2" />
              {t.campaigns.statuses.paused}
            </Button>
          )}
          {campaign.status === "paused" && (
            <Button 
              onClick={() => updateCampaignStatusMutation.mutate("active")}
              data-testid="button-resume-campaign"
            >
              <Play className="w-4 h-4 mr-2" />
              {t.campaigns.statuses.active}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" data-testid="button-campaign-more">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={() => cloneCampaignMutation.mutate()}
                disabled={cloneCampaignMutation.isPending}
                data-testid="button-clone-campaign"
              >
                <Copy className="w-4 h-4 mr-2" />
                {t.common.copy}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => saveAsTemplateMutation.mutate()}
                disabled={saveAsTemplateMutation.isPending}
                data-testid="button-save-as-template"
              >
                <Save className="w-4 h-4 mr-2" />
                {t.common.save}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">
            <FileText className="w-4 h-4 mr-2" />
            {t.campaigns.detail.overview}
          </TabsTrigger>
          <TabsTrigger value="contacts" data-testid="tab-contacts">
            <Users className="w-4 h-4 mr-2" />
            {t.campaigns.detail.contacts}
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">
            <Settings className="w-4 h-4 mr-2" />
            {t.campaigns.detail.settings}
          </TabsTrigger>
          <TabsTrigger value="reporting" data-testid="tab-reporting">
            <BarChart3 className="w-4 h-4 mr-2" />
            {t.campaigns.detail.reporting}
          </TabsTrigger>
          <TabsTrigger value="script" data-testid="tab-script">
            <ScrollText className="w-4 h-4 mr-2" />
            {t.campaigns.detail.script}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title={t.campaigns.detail.totalContacts}
              value={stats?.totalContacts || 0}
              icon={Users}
            />
            <StatsCard
              title={t.campaigns.detail.pendingContacts}
              value={stats?.pendingContacts || 0}
              description={`${((stats?.pendingContacts || 0) / Math.max(stats?.totalContacts || 1, 1) * 100).toFixed(1)}%`}
              icon={Clock}
            />
            <StatsCard
              title={t.campaigns.detail.completedContacts}
              value={stats?.completedContacts || 0}
              description={`${((stats?.completedContacts || 0) / Math.max(stats?.totalContacts || 1, 1) * 100).toFixed(1)}%`}
              icon={CheckCircle}
            />
            <StatsCard
              title={t.campaigns.detail.callbackScheduled}
              value={stats?.callbackContacts || 0}
              icon={Phone}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t.campaigns.detail.progress}</CardTitle>
              <CardDescription>
                {stats?.completedContacts || 0} / {stats?.totalContacts || 0}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={progressPercentage} className="h-3" />
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t.campaigns.detail.campaignSummary}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t.campaigns.type}</span>
                  <Badge variant="outline">{campaign.type}</Badge>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t.campaigns.detail.country}</span>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {campaign.countryCodes?.map(code => (
                      <Badge key={code} variant="secondary" className="text-xs">
                        {COUNTRIES.find(c => c.code === code)?.flag} {code}
                      </Badge>
                    ))}
                    {(!campaign.countryCodes || campaign.countryCodes.length === 0) && (
                      <span>{t.common.allCountries}</span>
                    )}
                  </div>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t.campaigns.startDate}</span>
                  <span>{campaign.startDate ? format(new Date(campaign.startDate), "PP") : "-"}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t.campaigns.endDate}</span>
                  <span>{campaign.endDate ? format(new Date(campaign.endDate), "PP") : "-"}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t.campaigns.detail.statusDistribution}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    {t.campaigns.contactStatuses.completed}
                  </span>
                  <span className="font-medium">{stats?.completedContacts || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    {t.campaigns.contactStatuses.contacted}
                  </span>
                  <span className="font-medium">{stats?.contactedContacts || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    {t.campaigns.contactStatuses.no_answer}
                  </span>
                  <span className="font-medium">{stats?.noAnswerContacts || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-purple-500" />
                    {t.campaigns.contactStatuses.callback_scheduled}
                  </span>
                  <span className="font-medium">{stats?.callbackContacts || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gray-500" />
                    {t.campaigns.contactStatuses.not_interested}
                  </span>
                  <span className="font-medium">{stats?.notInterestedContacts || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    {t.campaigns.contactStatuses.failed}
                  </span>
                  <span className="font-medium">{stats?.failedContacts || 0}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="contacts" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <CampaignContactsFilter
                filters={contactFilters}
                onFiltersChange={setContactFilters}
                onClear={() => setContactFilters({})}
                countryCodes={campaign.countryCodes || []}
              />
              {selectedContacts.size > 0 && (
                <div className="flex items-center gap-2 pl-2 border-l">
                  <span className="text-sm font-medium">
                    {selectedContacts.size} {t.campaigns.detail.selected}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" data-testid="button-bulk-actions">
                        <MoreHorizontal className="w-4 h-4 mr-2" />
                        {t.campaigns.detail.bulkActions}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => handleBulkStatusUpdate("completed")} data-testid="menu-bulk-completed">
                        <CheckCheck className="w-4 h-4 mr-2" />
                        {t.campaigns.detail.markCompleted}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleBulkStatusUpdate("not_interested")} data-testid="menu-bulk-not-interested">
                        <Trash2 className="w-4 h-4 mr-2" />
                        {t.campaigns.detail.markNotInterested}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleBulkStatusUpdate("pending")} data-testid="menu-bulk-pending">
                        <Clock className="w-4 h-4 mr-2" />
                        {t.campaigns.detail.resetPending}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setSelectedContacts(new Set())} data-testid="menu-clear-selection">
                        {t.campaigns.detail.clearSelection}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {filteredContacts.length} / {contacts.length} kontaktov
              </span>
              <Button
                className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-amber-600 dark:from-amber-600 dark:to-orange-600 dark:border-amber-700"
                onClick={() => {
                  setRequeueDispositions(new Set());
                  setRequeueStatuses(new Set());
                  setRequeueCallbackFrom("");
                  setRequeueCallbackTo("");
                  setShowRequeueDialog(true);
                }}
                data-testid="button-requeue-contacts"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {t.campaigns.detail.requeueButton}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setImportFile(null);
                  setImportResult(null);
                  setShowImportDialog(true);
                }}
                data-testid="button-import-contacts"
              >
                <Upload className="w-4 h-4 mr-2" />
                Import
              </Button>
              <Button
                variant="outline"
                onClick={() => generateContactsMutation.mutate()}
                disabled={generateContactsMutation.isPending}
                data-testid="button-generate-contacts"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${generateContactsMutation.isPending ? "animate-spin" : ""}`} />
                {t.campaigns.detail.generateContacts}
              </Button>
              <Button 
                variant="outline" 
                onClick={handleExportContacts}
                data-testid="button-export-contacts"
              >
                <Download className="w-4 h-4 mr-2" />
                {selectedContacts.size > 0 ? `Export (${selectedContacts.size})` : "Export"}
              </Button>
            </div>
          </div>

          {loadingContacts ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <DataTable
              columns={contactColumns}
              data={filteredContacts as EnrichedContact[]}
              getRowKey={(contact) => contact.id}
              onRowClick={(contact) => setSelectedContact(contact)}
              selectable
              selectedKeys={selectedContacts}
              onSelectionChange={setSelectedContacts}
              sortConfig={sortConfig}
              onSortChange={setSortConfig}
            />
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Tabs value={settingsSubTab} onValueChange={setSettingsSubTab}>
            <TabsList>
              <TabsTrigger value="general" data-testid="subtab-general">
                <Settings className="w-4 h-4 mr-2" />
                {t.campaigns.detail.general}
              </TabsTrigger>
              <TabsTrigger value="scheduling" data-testid="subtab-scheduling">
                <Clock className="w-4 h-4 mr-2" />
                {t.campaigns.detail.scheduling}
              </TabsTrigger>
              <TabsTrigger value="operators" data-testid="subtab-operators">
                <Shield className="w-4 h-4 mr-2" />
                {t.campaigns.detail.operator}
              </TabsTrigger>
              <TabsTrigger value="dispositions" data-testid="subtab-dispositions">
                <CheckCheck className="w-4 h-4 mr-2" />
                {t.campaigns.detail.dispositions}
              </TabsTrigger>
              <TabsTrigger value="kpi" data-testid="subtab-kpi">
                <Target className="w-4 h-4 mr-2" />
                {t.campaigns.detail.kpiTargets}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t.campaigns.detail.defaultAgentTab}</CardTitle>
                  <CardDescription>
                    {t.campaigns.detail.defaultAgentTabDesc}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Select 
                    value={campaign.defaultActiveTab || "phone"} 
                    onValueChange={(v) => {
                      apiRequest("PATCH", `/api/campaigns/${campaign.id}`, { defaultActiveTab: v })
                        .then(() => {
                          toast({ title: t.campaigns.detail.settingsSaved });
                          queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaign.id] });
                        })
                        .catch(() => toast({ title: t.campaigns.detail.error, variant: "destructive" }));
                    }}
                  >
                    <SelectTrigger className="w-64" data-testid="select-default-active-tab">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="phone">{t.campaigns.detail.phone}</SelectItem>
                      <SelectItem value="script">{t.campaigns.detail.script}</SelectItem>
                      <SelectItem value="email">{t.campaigns.detail.email}</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <AutoModeCard campaign={campaign} />
              <CriteriaCard campaign={campaign} />
            </TabsContent>

            <TabsContent value="scheduling" className="space-y-6">
              <SchedulingCard campaign={campaign} />
            </TabsContent>

            <TabsContent value="operators" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    {t.campaigns.detail.assignedOperators}
                  </CardTitle>
                  <CardDescription>
                    {t.campaigns.detail.assignedOperatorsDesc}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {callCenterUsers.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        {t.campaigns.detail.noOperatorsAvailable}
                      </p>
                    ) : (
                      <div className="grid gap-3">
                        {callCenterUsers.map((user) => {
                          const isAssigned = assignedAgentIds.includes(user.id);
                          return (
                            <div 
                              key={user.id} 
                              className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${isAssigned ? 'bg-primary/5 border-primary/20' : 'bg-muted/30'}`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isAssigned ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                  <User className="w-5 h-5" />
                                </div>
                                <div>
                                  <p className="font-medium">{user.fullName}</p>
                                  <p className="text-sm text-muted-foreground">{roles.find(r => r.id === user.roleId)?.name || user.role}</p>
                                </div>
                              </div>
                              <Button
                                variant={isAssigned ? "default" : "outline"}
                                size="sm"
                                onClick={() => {
                                  const newAgentIds = isAssigned
                                    ? assignedAgentIds.filter(id => id !== user.id)
                                    : [...assignedAgentIds, user.id];
                                  updateAgentsMutation.mutate(newAgentIds);
                                }}
                                disabled={updateAgentsMutation.isPending}
                                data-testid={`button-toggle-agent-settings-${user.id}`}
                              >
                                {isAssigned ? (
                                  <>
                                    <CheckCheck className="w-4 h-4 mr-2" />
                                    {t.campaigns.detail.assigned}
                                  </>
                                ) : (
                                  t.campaigns.detail.assign
                                )}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              {assignedAgentIds.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>{t.campaigns.detail.campaignSummary}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-sm">
                        {assignedAgentIds.length} {t.campaigns.detail.operator}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {t.campaigns.detail.assignedOperators}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="dispositions" className="space-y-4">
              <DispositionsTab campaignId={campaignId} embedded />
            </TabsContent>

            <TabsContent value="kpi" className="space-y-6">
              <KpiTargetsCard campaign={campaign} />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="reporting" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title={t.campaigns.detail.contactRate}
              value={`${((stats?.contactedContacts || 0) / Math.max(stats?.totalContacts || 1, 1) * 100).toFixed(1)}%`}
              description={`${t.campaigns.contactStatuses.contacted} / ${t.campaigns.detail.totalContacts}`}
              icon={Phone}
            />
            <StatsCard
              title={t.campaigns.detail.completionRate}
              value={`${((stats?.completedContacts || 0) / Math.max(stats?.totalContacts || 1, 1) * 100).toFixed(1)}%`}
              description={`${t.campaigns.detail.completedContacts} / ${t.campaigns.detail.totalContacts}`}
              icon={CheckCircle}
            />
            <StatsCard
              title={t.campaigns.detail.conversionRate}
              value={`${(((stats?.completedContacts || 0) / Math.max((stats?.contactedContacts || 0) + (stats?.completedContacts || 0), 1)) * 100).toFixed(1)}%`}
              description={`${t.campaigns.detail.completedContacts} / ${t.campaigns.contactStatuses.contacted}`}
              icon={Users}
            />
            <StatsCard
              title={t.campaigns.detail.avgAttempts}
              value={contacts.length > 0 
                ? (contacts.reduce((sum, c) => sum + (c.attemptCount || 0), 0) / contacts.length).toFixed(1)
                : "0"
              }
              description={t.campaigns.detail.contacts}
              icon={RefreshCw}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
                    <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t.campaigns.detail.successful}</p>
                    <p className="text-2xl font-bold">{stats?.completedContacts || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                    <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t.campaigns.detail.pendingContacts}</p>
                    <p className="text-2xl font-bold">{stats?.pendingContacts || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30">
                    <Phone className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t.campaigns.contactStatuses.no_answer}</p>
                    <p className="text-2xl font-bold">{stats?.noAnswerContacts || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-800">
                    <Users className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t.campaigns.detail.notInterested}</p>
                    <p className="text-2xl font-bold">{stats?.notInterestedContacts || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t.campaigns.detail.statusDistribution}</CardTitle>
              </CardHeader>
              <CardContent>
                {stats && stats.totalContacts > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: t.campaigns.contactStatuses.pending, value: stats.pendingContacts || 0, color: CHART_PALETTE[3] },
                          { name: t.campaigns.contactStatuses.contacted, value: stats.contactedContacts || 0, color: CHART_PALETTE[1] },
                          { name: t.campaigns.contactStatuses.completed, value: stats.completedContacts || 0, color: CHART_PALETTE[0] },
                          { name: t.campaigns.contactStatuses.no_answer, value: stats.noAnswerContacts || 0, color: CHART_PALETTE[2] },
                          { name: t.campaigns.contactStatuses.not_interested, value: stats.notInterestedContacts || 0, color: CHART_PALETTE[4] },
                          { name: t.campaigns.contactStatuses.failed, value: stats.failedContacts || 0, color: CHART_PALETTE[6] },
                        ].filter(d => d.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {[
                          { color: CHART_PALETTE[3] },
                          { color: CHART_PALETTE[1] },
                          { color: CHART_PALETTE[0] },
                          { color: CHART_PALETTE[2] },
                          { color: CHART_PALETTE[4] },
                          { color: CHART_PALETTE[6] },
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    {t.campaigns.detail.noDataAvailable}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t.campaigns.detail.attemptDistribution}</CardTitle>
              </CardHeader>
              <CardContent>
                {contacts.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart
                      data={(() => {
                        const attemptCounts: Record<number, number> = {};
                        contacts.forEach(c => {
                          const attempts = c.attemptCount || 0;
                          attemptCounts[attempts] = (attemptCounts[attempts] || 0) + 1;
                        });
                        return Object.entries(attemptCounts)
                          .map(([attempts, count]) => ({
                            attempts: `${attempts} pokusov`,
                            count,
                          }))
                          .sort((a, b) => parseInt(a.attempts) - parseInt(b.attempts));
                      })()}
                      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                      <XAxis dataKey="attempts" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    {t.campaigns.detail.noDataAvailable}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle>{t.campaigns.detail.campaignSummary}</CardTitle>
              </div>
              <Button variant="outline" data-testid="button-export-report">
                <Download className="w-4 h-4 mr-2" />
                {t.campaigns.detail.exportReport}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t.campaigns.detail.totalContacts}</p>
                  <p className="text-2xl font-bold">{stats?.totalContacts || 0}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t.campaigns.detail.successRate}</p>
                  <p className="text-2xl font-bold">
                    {((stats?.completedContacts || 0) / Math.max(stats?.totalContacts || 1, 1) * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t.campaigns.detail.pendingContacts}</p>
                  <p className="text-2xl font-bold">{stats?.pendingContacts || 0}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t.campaigns.detail.callbackScheduled}</p>
                  <p className="text-2xl font-bold">{stats?.callbackContacts || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {(() => {
            let kpiTargets: Record<string, number> = {};
            try {
              if (campaign.settings) {
                const s = JSON.parse(campaign.settings);
                if (s.kpiTargets) kpiTargets = s.kpiTargets;
              }
            } catch {}
            const hasAnyTarget = Object.values(kpiTargets).some(v => v > 0);
            if (!hasAnyTarget) return null;

            const totalContacts = stats?.totalContacts || 0;
            const completedContacts = stats?.completedContacts || 0;
            const contactedContacts = stats?.contactedContacts || 0;
            const processedContacts = completedContacts + contactedContacts + (stats?.noAnswerContacts || 0) + (stats?.notInterestedContacts || 0) + (stats?.failedContacts || 0);
            const completionPct = totalContacts > 0 ? (processedContacts / totalContacts * 100) : 0;
            const conversionPct = processedContacts > 0 ? (completedContacts / processedContacts * 100) : 0;

            const campaignKpis = [
              { key: "campaignTotalContactsTarget", label: t.campaigns.detail.totalContacts, current: totalContacts, unit: "" },
              { key: "campaignCompletionTarget", label: t.campaigns.detail.completionRate, current: parseFloat(completionPct.toFixed(1)), unit: "%" },
              { key: "campaignConversionTarget", label: t.campaigns.detail.conversionRate, current: parseFloat(conversionPct.toFixed(1)), unit: "%" },
            ].filter(k => (kpiTargets[k.key] || 0) > 0);

            return (
              <Card data-testid="card-kpi-tracking">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    {t.campaigns.detail.kpiTracking}
                  </CardTitle>
                  <CardDescription>
                    {t.campaigns.detail.kpiTrackingDesc}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {campaignKpis.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" />
                        {t.campaigns.detail.kpiTargets}
                      </h4>
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {campaignKpis.map(kpi => {
                          const target = kpiTargets[kpi.key] || 0;
                          const pct = target > 0 ? Math.min((kpi.current / target) * 100, 100) : 0;
                          const status = pct >= 100 ? "text-green-600 dark:text-green-400" : pct >= 70 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400";
                          const bgStatus = pct >= 100 ? "bg-green-500" : pct >= 70 ? "bg-yellow-500" : "bg-red-500";
                          return (
                            <div key={kpi.key} className="p-4 rounded-lg border space-y-3" data-testid={`kpi-progress-${kpi.key}`}>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium">{kpi.label}</span>
                                <span className={`text-sm font-bold ${status}`}>{pct.toFixed(0)}%</span>
                              </div>
                              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${bgStatus}`} style={{ width: `${pct}%` }} />
                              </div>
                              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                <span>{t.campaigns.detail.current}: {kpi.current}{kpi.unit}</span>
                                <span>{t.campaigns.detail.target}: {target}{kpi.unit}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {(kpiTargets.campaignRevenueTarget || 0) > 0 && (
                    <div className="p-4 rounded-lg border space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium flex items-center gap-2">
                          <Flag className="w-4 h-4 text-muted-foreground" />
                          {t.campaigns.detail.targetRevenue}
                        </span>
                        <span className="text-sm font-bold text-muted-foreground">
                          {(kpiTargets.campaignRevenueTarget || 0).toLocaleString("sk-SK")} EUR
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t.campaigns.detail.revenueTrackingDesc}
                      </p>
                    </div>
                  )}

                  {(kpiTargets.agentDailyCallsTarget || 0) > 0 && (
                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <User className="w-4 h-4" />
                        {t.campaigns.detail.dailyOperatorTargets}
                      </h4>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {[
                          { key: "agentDailyCallsTarget", label: t.campaigns.detail.callsPerDay, icon: Phone },
                          { key: "agentDailyContactsTarget", label: t.campaigns.detail.contactsPerDay, icon: UserCheck },
                          { key: "agentDailySuccessTarget", label: t.campaigns.detail.conversionsPerDay, icon: Star },
                          { key: "agentConversionRateTarget", label: t.campaigns.detail.conversionRate, icon: Target, unit: "%" },
                          { key: "agentAvgCallDurationTarget", label: t.campaigns.detail.kpiAvgCallDuration, icon: Clock, unit: " min" },
                          { key: "agentMaxIdleMinutes", label: t.campaigns.detail.kpiMaxIdleTime, icon: Clock, unit: " min" },
                          { key: "agentCallbackComplianceTarget", label: t.campaigns.detail.dispActionCallback, icon: CalendarPlus, unit: "%" },
                        ].filter(k => (kpiTargets[k.key] || 0) > 0).map(kpi => {
                          const IconComp = kpi.icon;
                          return (
                            <div key={kpi.key} className="p-3 rounded-lg border flex items-center gap-3" data-testid={`kpi-agent-${kpi.key}`}>
                              <IconComp className="w-4 h-4 text-primary shrink-0" />
                              <div>
                                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                                <p className="text-sm font-bold">{kpiTargets[kpi.key]}{kpi.unit || ""}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {(kpiTargets.campaignDurationDays || 0) > 0 && (
                    <div className="p-4 rounded-lg border bg-muted/30">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{t.campaigns.detail.kpiPlannedDuration}:</span>
                        <span className="font-semibold">{kpiTargets.campaignDurationDays} {t.campaigns.detail.workingDays}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}

          <Card data-testid="card-agent-performance">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                {t.campaigns.detail.operatorPerformance}
              </CardTitle>
              <CardDescription>
                {t.campaigns.detail.operatorPerformanceDesc}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {agentStatsLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin" />
                  <p className="text-sm">{t.campaigns.detail.loadingOperatorStats}</p>
                </div>
              ) : agentStatsError ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50 text-destructive" />
                  <p className="text-sm">{t.campaigns.detail.operatorStatsError}</p>
                  <p className="text-xs mt-1">{agentStatsErrorMsg?.message || t.campaigns.detail.refreshPage}</p>
                </div>
              ) : agentStatsData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{t.campaigns.detail.noDataAvailable}</p>
                  <p className="text-xs mt-1">{t.campaigns.detail.operatorAssignmentDesc}</p>
                </div>
              ) : (() => {
                  const kpiTgts: Record<string, number> = {};
                  try {
                    if (campaign.settings) {
                      const s = JSON.parse(campaign.settings);
                      if (s.kpiTargets) Object.assign(kpiTgts, s.kpiTargets);
                    }
                  } catch {}

                  return (<>{agentStatsData.map(agent => {
                    const dailyContactsTarget = kpiTgts.agentDailyContactsTarget || 0;
                    const dailyCallsTarget = kpiTgts.agentDailyCallsTarget || 0;
                    const dailySuccessTarget = kpiTgts.agentDailySuccessTarget || 0;
                    const conversionTarget = kpiTgts.agentConversionRateTarget || 0;

                    const contactedTodayPct = dailyContactsTarget > 0 
                      ? Math.min((agent.contactedToday / dailyContactsTarget) * 100, 100) : 0;
                    const dispositionsTodayPct = dailyCallsTarget > 0 
                      ? Math.min((agent.dispositionsToday / dailyCallsTarget) * 100, 100) : 0;
                    const completedTodayPct = dailySuccessTarget > 0 
                      ? Math.min((agent.completedToday / dailySuccessTarget) * 100, 100) : 0;

                    const processedTotal = agent.completedTotal + agent.noAnswerTotal + agent.notInterestedTotal + agent.failedTotal;
                    const conversionPct = processedTotal > 0 ? ((agent.completedTotal / processedTotal) * 100) : 0;
                    const conversionFulfillPct = conversionTarget > 0 ? Math.min((conversionPct / conversionTarget) * 100, 100) : 0;

                    const hasAnyDailyTarget = dailyContactsTarget > 0 || dailyCallsTarget > 0 || dailySuccessTarget > 0 || conversionTarget > 0;

                    const getBarColor = (pct: number) =>
                      pct >= 100 ? "bg-green-500" : pct >= 70 ? "bg-yellow-500" : pct >= 30 ? "bg-orange-500" : "bg-red-500";
                    const getTextColor = (pct: number) =>
                      pct >= 100 ? "text-green-600 dark:text-green-400" : pct >= 70 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400";

                    return (
                      <div key={agent.userId} className="p-4 rounded-lg border space-y-3" data-testid={`agent-perf-card-${agent.userId}`}>
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              {agent.avatarUrl && <AvatarImage src={agent.avatarUrl} alt={agent.name} />}
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {agent.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-semibold" data-testid={`text-agent-perf-name-${agent.userId}`}>{agent.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {agent.totalContacts} kontaktov celkom
                                {agent.lastActiveAt && ` · Posledná aktivita: ${new Date(agent.lastActiveAt).toLocaleDateString("sk-SK")} ${new Date(agent.lastActiveAt).toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" })}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <Badge variant="secondary" className="text-xs">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              {agent.completedTotal} {t.campaigns.detail.successful}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              <PhoneMissed className="w-3 h-3 mr-1" />
                              {agent.noAnswerTotal} {t.campaigns.contactStatuses.no_answer}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              <CalendarPlus className="w-3 h-3 mr-1" />
                              {agent.callbackTotal} callback
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              <Ban className="w-3 h-3 mr-1" />
                              {agent.notInterestedTotal} {t.campaigns.detail.notInterested}
                            </Badge>
                          </div>
                        </div>

                        {hasAnyDailyTarget && (
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            {dailyContactsTarget > 0 && (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs text-muted-foreground">Kontakty dnes</span>
                                  <span className={`text-xs font-bold ${getTextColor(contactedTodayPct)}`}>
                                    {agent.contactedToday}/{dailyContactsTarget}
                                  </span>
                                </div>
                                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div className={`h-full rounded-full transition-all ${getBarColor(contactedTodayPct)}`} style={{ width: `${contactedTodayPct}%` }} />
                                </div>
                              </div>
                            )}
                            {dailyCallsTarget > 0 && (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs text-muted-foreground">{t.campaigns.detail.dispositionsToday}</span>
                                  <span className={`text-xs font-bold ${getTextColor(dispositionsTodayPct)}`}>
                                    {agent.dispositionsToday}/{dailyCallsTarget}
                                  </span>
                                </div>
                                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div className={`h-full rounded-full transition-all ${getBarColor(dispositionsTodayPct)}`} style={{ width: `${dispositionsTodayPct}%` }} />
                                </div>
                              </div>
                            )}
                            {dailySuccessTarget > 0 && (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs text-muted-foreground">Konverzie dnes</span>
                                  <span className={`text-xs font-bold ${getTextColor(completedTodayPct)}`}>
                                    {agent.completedToday}/{dailySuccessTarget}
                                  </span>
                                </div>
                                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div className={`h-full rounded-full transition-all ${getBarColor(completedTodayPct)}`} style={{ width: `${completedTodayPct}%` }} />
                                </div>
                              </div>
                            )}
                            {conversionTarget > 0 && (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs text-muted-foreground">{t.campaigns.detail.conversionRate}</span>
                                  <span className={`text-xs font-bold ${getTextColor(conversionFulfillPct)}`}>
                                    {conversionPct.toFixed(1)}%/{conversionTarget}%
                                  </span>
                                </div>
                                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div className={`h-full rounded-full transition-all ${getBarColor(conversionFulfillPct)}`} style={{ width: `${conversionFulfillPct}%` }} />
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="grid gap-4 md:grid-cols-5 text-center pt-2 border-t">
                          <div>
                            <p className="text-lg font-bold">{agent.totalContacts}</p>
                            <p className="text-xs text-muted-foreground">{t.campaigns.detail.contacts}</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold">{agent.totalDispositions}</p>
                            <p className="text-xs text-muted-foreground">{t.campaigns.detail.dispositions}</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold">{agent.dispositionsToday}</p>
                            <p className="text-xs text-muted-foreground">{t.campaigns.detail.kpiDailyCallTarget}</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold">{agent.avgAttemptsPerContact}</p>
                            <p className="text-xs text-muted-foreground">{t.campaigns.detail.avgAttempts}</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold">{processedTotal > 0 ? conversionPct.toFixed(0) : 0}%</p>
                            <p className="text-xs text-muted-foreground">{t.campaigns.detail.conversionRate}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}</>);
                })()}
              </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="script" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ScrollText className="w-5 h-5" />
                  {t.campaigns.detail.scriptBuilder}
                </CardTitle>
                <CardDescription>
                  {t.campaigns.detail.scriptBuilder}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={scriptMode}
                  onValueChange={(v) => setScriptMode(v as "builder" | "preview" | "legacy")}
                >
                  <SelectTrigger className="w-40" data-testid="select-script-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="builder">Editor</SelectItem>
                    <SelectItem value="preview">{t.campaigns.detail.preview}</SelectItem>
                    <SelectItem value="legacy">{t.campaigns.detail.textMode}</SelectItem>
                  </SelectContent>
                </Select>
                {scriptMode !== "legacy" && (
                  <Button
                    onClick={() => {
                      if (structuredScript) {
                        saveScriptMutation.mutate(JSON.stringify(structuredScript));
                        setStructuredScriptModified(false);
                      }
                    }}
                    disabled={!structuredScriptModified || saveScriptMutation.isPending}
                    data-testid="button-save-structured-script"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saveScriptMutation.isPending ? t.campaigns.detail.saving : t.common.save}
                  </Button>
                )}
                {scriptMode === "legacy" && (
                  <Button
                    onClick={() => saveScriptMutation.mutate(scriptContent)}
                    disabled={!scriptModified || saveScriptMutation.isPending}
                    data-testid="button-save-script"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saveScriptMutation.isPending ? t.campaigns.detail.saving : t.common.save}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {scriptMode === "builder" && (
                <div className="min-h-[500px]">
                  <ScriptBuilder
                    script={structuredScript}
                    onChange={(newScript) => {
                      setStructuredScript(newScript);
                      setStructuredScriptModified(true);
                    }}
                    isSaving={saveScriptMutation.isPending}
                  />
                  {structuredScriptModified && (
                    <div className="mt-4 flex items-center gap-2">
                      <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-900/20">
                        {t.campaigns.detail.saving}
                      </Badge>
                    </div>
                  )}
                </div>
              )}
              
              {scriptMode === "preview" && structuredScript && (
                <div className="min-h-[500px]">
                  <ScriptRunner
                    script={structuredScript}
                    onComplete={(session) => {
                      toast({ 
                        title: t.campaigns.detail.settingsSaved, 
                        description: `${session.responses.length}` 
                      });
                    }}
                  />
                </div>
              )}
              
              {scriptMode === "legacy" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="script-editor">{t.campaigns.detail.scriptBuilder}</Label>
                    <Textarea
                      id="script-editor"
                      placeholder={t.campaigns.detail.scriptBuilder}
                      value={scriptContent.startsWith("{") ? "" : scriptContent}
                      onChange={(e) => {
                        setScriptContent(e.target.value);
                        setScriptModified(true);
                      }}
                      className="min-h-[400px] font-mono text-sm"
                      data-testid="textarea-script"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {scriptModified && (
                      <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-900/20">
                        {t.campaigns.detail.saving}
                      </Badge>
                    )}
                    {!scriptModified && scriptContent && !scriptContent.startsWith("{") && (
                      <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20">
                        {t.common.saved}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          {scriptMode === "builder" && (
            <Card>
              <CardHeader>
                <CardTitle>{t.campaigns.detail.scriptGuideTitle}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                  <li>{t.campaigns.detail.scriptGuideSteps}</li>
                  <li>{t.campaigns.detail.scriptGuideHeadings}</li>
                  <li>{t.campaigns.detail.scriptGuideSelect}</li>
                  <li>{t.campaigns.detail.scriptGuideCheckbox}</li>
                  <li>{t.campaigns.detail.scriptGuideText}</li>
                  <li>{t.campaigns.detail.scriptGuideNotes}</li>
                  <li>{t.campaigns.detail.scriptGuideOutcome}</li>
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>

      </Tabs>

      <Dialog open={!!selectedContact} onOpenChange={() => setSelectedContact(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.campaigns.detail.contactDetail}</DialogTitle>
            <DialogDescription>
              {selectedContact?.customer 
                ? `${selectedContact.customer.firstName} ${selectedContact.customer.lastName}`
                : t.campaigns.detail.unknownContact
              }
            </DialogDescription>
          </DialogHeader>
          {selectedContact && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge className={CONTACT_STATUS_COLORS[selectedContact.status]}>
                    {t.campaigns.contactStatuses[selectedContact.status as keyof typeof t.campaigns.contactStatuses] || selectedContact.status}
                  </Badge>
                </div>
                {(selectedContact as any).dispositionCode && dispositionMap[(selectedContact as any).dispositionCode] && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t.campaigns.detail.result}</span>
                    <Badge variant="secondary" className={`text-xs ${
                      {
                        green: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
                        blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
                        orange: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
                        red: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
                        yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
                        gray: "bg-muted text-muted-foreground",
                      }[dispositionMap[(selectedContact as any).dispositionCode]?.color] || "bg-muted text-muted-foreground"
                    }`}>
                      {dispositionMap[(selectedContact as any).dispositionCode]?.name}
                    </Badge>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t.campaigns.detail.attempts}</span>
                  <span>{selectedContact.attemptCount || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t.campaigns.detail.phone}</span>
                  <span>{selectedContact.customer?.phone || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t.campaigns.detail.email}</span>
                  <span>{selectedContact.customer?.email || "-"}</span>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <label className="text-sm font-medium">{t.campaigns.detail.changeStatus}</label>
                <Select
                  value={selectedContact.status}
                  onValueChange={(value) => {
                    updateContactMutation.mutate({
                      contactId: selectedContact.id,
                      data: { status: value },
                    });
                  }}
                >
                  <SelectTrigger data-testid="select-update-contact-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">{t.campaigns.contactStatuses.pending}</SelectItem>
                    <SelectItem value="contacted">{t.campaigns.contactStatuses.contacted}</SelectItem>
                    <SelectItem value="completed">{t.campaigns.contactStatuses.completed}</SelectItem>
                    <SelectItem value="no_answer">{t.campaigns.contactStatuses.no_answer}</SelectItem>
                    <SelectItem value="callback_scheduled">{t.campaigns.contactStatuses.callback_scheduled}</SelectItem>
                    <SelectItem value="not_interested">{t.campaigns.contactStatuses.not_interested}</SelectItem>
                    <SelectItem value="failed">{t.campaigns.contactStatuses.failed}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <label className="text-sm font-medium">{t.campaigns.detail.customerHistory}</label>
                </div>
                <ScrollArea className="h-48 rounded-md border p-2">
                  {contactActivityLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">{t.campaigns.detail.noHistory}</p>
                  ) : (
                    <div className="space-y-2">
                      {contactActivityLogs.slice(0, 10).map((log) => {
                        const details = log.details || {};
                        const getActionLabel = (action: string) => {
                          const labels: Record<string, string> = {
                            create: t.campaigns.detail.created,
                            update: t.campaigns.detail.updated,
                            delete: t.campaigns.detail.remove,
                            pipeline_move: "Pipeline",
                            stage_changed: "Pipeline",
                            campaign_joined: t.campaigns.detail.campaignJoined,
                            campaign_left: t.campaigns.detail.campaignLeft,
                            email_sent: t.campaigns.detail.emailSent,
                            sms_sent: t.campaigns.detail.smsSent,
                            note_added: t.campaigns.detail.noteAdded,
                          };
                          return labels[action] || action;
                        };
                        
                        const getActionIcon = (action: string) => {
                          if (action === "pipeline_move" || action === "stage_changed") return ArrowRight;
                          if (action === "campaign_joined" || action === "campaign_left") return Users;
                          if (action === "email_sent") return Mail;
                          if (action === "sms_sent") return MessageSquare;
                          if (action === "note_added") return FileEdit;
                          if (action === "update") return FileEdit;
                          return Clock;
                        };
                        
                        const Icon = getActionIcon(log.action);
                        
                        return (
                          <div key={log.id} className="flex items-start gap-2 text-xs p-2 rounded bg-muted/50">
                            <Icon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium">{getActionLabel(log.action)}</p>
                              {(log.action === "pipeline_move" || log.action === "stage_changed") && (
                                <div className="flex items-center gap-1 mt-1">
                                  <Badge variant="outline" className="text-[10px] px-1 py-0">{details.fromStageName || (details.fromStageId ? getStageName(details.fromStageId) : "—")}</Badge>
                                  <ArrowRight className="h-2.5 w-2.5" />
                                  <Badge className="text-[10px] px-1 py-0 bg-cyan-600 text-white">{details.toStageName || (details.toStageId ? getStageName(details.toStageId) : "—")}</Badge>
                                </div>
                              )}
                              {log.action === "campaign_joined" && details.campaignName && (
                                <p className="text-muted-foreground">{details.campaignName}</p>
                              )}
                              <p className="text-muted-foreground">{format(new Date(log.createdAt), "dd.MM.yyyy HH:mm")}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showImportDialog} onOpenChange={(open) => { if (!open) { setShowImportDialog(false); setImportFile(null); setImportResult(null); setUpdateExisting(false); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.campaigns.detail.importContacts}</DialogTitle>
            <DialogDescription>
              {t.campaigns.detail.importContacts}
            </DialogDescription>
          </DialogHeader>

          {importResult ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">{t.campaigns.detail.importCompleted}</p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Vytvorených: {importResult.created} kontaktov
                    {(importResult.updated || 0) > 0 && `, aktualizovaných: ${importResult.updated}`}
                    {(importResult.duplicates || 0) > 0 && `, duplikátov: ${importResult.duplicates}`}
                    {importResult.skipped > 0 && `, preskočených: ${importResult.skipped}`}
                  </p>
                </div>
              </div>
              {importResult.errors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    Chyby ({importResult.errors.length})
                  </p>
                  <ScrollArea className="h-32">
                    <div className="space-y-1">
                      {importResult.errors.map((err, i) => (
                        <p key={i} className="text-xs text-muted-foreground">{err}</p>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
              <div className="flex justify-between gap-2 flex-wrap">
                {importResult.importedContactIds && importResult.importedContactIds.length > 0 && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (importResult.importedContactIds) {
                        deleteImportMutation.mutate(importResult.importedContactIds);
                      }
                    }}
                    disabled={deleteImportMutation.isPending}
                    data-testid="button-delete-last-import"
                  >
                    {deleteImportMutation.isPending ? (
                      <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />{t.campaigns.detail.deleting}</>
                    ) : (
                      <><Trash2 className="w-4 h-4 mr-2" />{t.campaigns.detail.deleteLastImport} ({importResult.importedContactIds.length})</>
                    )}
                  </Button>
                )}
                <Button onClick={() => { setShowImportDialog(false); setImportFile(null); setImportResult(null); }} data-testid="button-close-import">
                  {t.campaigns.detail.close}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div
                className={`relative border-2 border-dashed rounded-md p-8 text-center transition-colors ${
                  isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files[0];
                  if (file) setImportFile(file);
                }}
                data-testid="dropzone-import"
              >
                {importFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileUp className="h-8 w-8 text-primary" />
                    <p className="text-sm font-medium">{importFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(importFile.size / 1024).toFixed(1)} KB
                    </p>
                    <Button variant="outline" size="sm" onClick={() => setImportFile(null)} data-testid="button-remove-file">
                      {t.campaigns.detail.remove}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm font-medium">{t.campaigns.detail.dragFileHere}</p>
                    <p className="text-xs text-muted-foreground">{t.campaigns.detail.orClickToSelect}</p>
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setImportFile(file);
                      }}
                      data-testid="input-import-file"
                      style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    window.open("/api/campaigns/contacts/import-template", "_blank");
                  }}
                  data-testid="button-download-template"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {t.campaigns.detail.downloadSampleCsv}
                </Button>
              </div>

              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs font-medium mb-2">{t.campaigns.detail.expectedColumns}:</p>
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      "meno", "priezvisko", "telefon", "telefon_2",
                      "email", "krajina", "datum_ocakavaneho_porodu", "extra_pole_1", "extra_pole_2"
                    ].map(col => (
                      <span key={col} className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">{col}</span>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    <strong>krajina</strong> (SK, CZ, HU, RO, IT, DE, US) &middot; <strong>datum</strong> (YYYY-MM-DD, DD.MM.YYYY, DD/MM/YYYY)
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t.campaigns.detail.supportedFormats}
                  </p>
                </CardContent>
              </Card>

              <label className="flex items-center gap-2 cursor-pointer" data-testid="checkbox-update-existing">
                <input
                  type="checkbox"
                  checked={updateExisting}
                  onChange={(e) => setUpdateExisting(e.target.checked)}
                  className="rounded border-muted-foreground/50"
                />
                <span className="text-sm">{t.campaigns.detail.updateExisting}</span>
              </label>

              {importPhase && (
                <div className="space-y-2" data-testid="import-progress">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{importPhase === "upload" ? t.campaigns.detail.uploadingFile : t.campaigns.detail.processingContacts}</span>
                    <span>{importPhase === "upload" ? `${importProgress}%` : ""}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    {importPhase === "upload" ? (
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-300"
                        style={{ width: `${importProgress}%` }}
                      />
                    ) : (
                      <div className="h-full rounded-full bg-primary animate-pulse w-full" />
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowImportDialog(false)} disabled={importContactsMutation.isPending} data-testid="button-cancel-import">
                  {t.campaigns.detail.cancel}
                </Button>
                <Button
                  onClick={() => { if (importFile) importContactsMutation.mutate(importFile); }}
                  disabled={!importFile || importContactsMutation.isPending}
                  data-testid="button-start-import"
                >
                  {importContactsMutation.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      {t.campaigns.detail.importing}
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      {t.campaigns.detail.import}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showRequeueDialog} onOpenChange={(open) => { setShowRequeueDialog(open); if (!open) setRequeuePage(0); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-amber-500" />
              {t.campaigns.detail.requeueTitle}
            </DialogTitle>
            <DialogDescription>
              {t.campaigns.detail.requeueDesc}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 overflow-y-auto pr-2" style={{ maxHeight: "calc(90vh - 200px)" }}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3 p-4 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-amber-500" />
                    <label className="text-sm font-semibold">{t.campaigns.detail.requeueByStatus}</label>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { value: "contacted", label: t.campaigns.contactStatuses.contacted },
                      { value: "completed", label: t.campaigns.contactStatuses.completed },
                      { value: "failed", label: t.campaigns.contactStatuses.failed },
                      { value: "no_answer", label: t.campaigns.contactStatuses.no_answer },
                      { value: "callback_scheduled", label: t.campaigns.contactStatuses.callback_scheduled },
                      { value: "not_interested", label: t.campaigns.contactStatuses.not_interested },
                    ].map(s => (
                      <Badge
                        key={s.value}
                        variant={requeueStatuses.has(s.value) ? "default" : "outline"}
                        className={`cursor-pointer select-none ${requeueStatuses.has(s.value) ? "bg-amber-500 text-white dark:bg-amber-600" : ""}`}
                        onClick={() => {
                          setRequeueStatuses(prev => {
                            const next = new Set(prev);
                            next.has(s.value) ? next.delete(s.value) : next.add(s.value);
                            return next;
                          });
                          setRequeuePage(0);
                        }}
                        data-testid={`requeue-status-${s.value}`}
                      >
                        {requeueStatuses.has(s.value) && <CheckCircle className="w-3 h-3 mr-1" />}
                        {s.label}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{t.campaigns.detail.requeueEmptyStatus}</p>
                </div>

                <div className="space-y-3 p-4 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-amber-500" />
                    <label className="text-sm font-semibold">{t.campaigns.detail.requeueByCallback}</label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">{t.campaigns.detail.from}</label>
                      <Input
                        type="date"
                        value={requeueCallbackFrom}
                        onChange={(e) => { setRequeueCallbackFrom(e.target.value); setRequeuePage(0); }}
                        data-testid="requeue-callback-from"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">{t.campaigns.detail.to}</label>
                      <Input
                        type="date"
                        value={requeueCallbackTo}
                        onChange={(e) => { setRequeueCallbackTo(e.target.value); setRequeuePage(0); }}
                        data-testid="requeue-callback-to"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-4 rounded-lg border">
                <div className="flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-amber-500" />
                  <label className="text-sm font-semibold">{t.campaigns.detail.requeueByDisposition}</label>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {campaignDispositions.filter(d => !d.parentId).map(d => {
                    const colorMap: Record<string, string> = {
                      green: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-green-300 dark:border-green-700",
                      blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-300 dark:border-blue-700",
                      orange: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border-orange-300 dark:border-orange-700",
                      red: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-300 dark:border-red-700",
                      yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700",
                      gray: "",
                    };
                    const children = campaignDispositions.filter(ch => ch.parentId === d.id);
                    const allCodes = [d.code, ...children.map(ch => ch.code)];
                    const isSelected = allCodes.some(code => requeueDispositions.has(code));
                    return (
                      <Badge
                        key={d.id}
                        variant={isSelected ? "default" : "outline"}
                        className={`cursor-pointer select-none ${isSelected ? "bg-amber-500 text-white dark:bg-amber-600 border-amber-600" : colorMap[d.color || "gray"] || ""}`}
                        onClick={() => {
                          setRequeueDispositions(prev => {
                            const next = new Set(prev);
                            if (isSelected) {
                              allCodes.forEach(code => next.delete(code));
                            } else {
                              allCodes.forEach(code => next.add(code));
                            }
                            return next;
                          });
                          setRequeuePage(0);
                        }}
                        data-testid={`requeue-disp-${d.code}`}
                      >
                        {isSelected && <CheckCircle className="w-3 h-3 mr-1 shrink-0" />}
                        {d.name}
                        {children.length > 0 && <span className="opacity-60 ml-1">+{children.length}</span>}
                      </Badge>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">{t.campaigns.detail.requeueEmptyDisp}</p>
              </div>

              <div className="rounded-lg border">
                <div className="flex items-center justify-between p-3 border-b bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{t.campaigns.detail.requeueMatchingContacts}</span>
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                      {requeueMatchingContacts.length}
                    </Badge>
                  </div>
                  {requeueMatchingContacts.length > REQUEUE_PAGE_SIZE && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={requeuePage === 0}
                        onClick={() => setRequeuePage(p => Math.max(0, p - 1))}
                        data-testid="requeue-prev-page"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </Button>
                      <span className="text-xs text-muted-foreground px-2">
                        {requeuePage + 1} / {Math.ceil(requeueMatchingContacts.length / REQUEUE_PAGE_SIZE)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={(requeuePage + 1) * REQUEUE_PAGE_SIZE >= requeueMatchingContacts.length}
                        onClick={() => setRequeuePage(p => p + 1)}
                        data-testid="requeue-next-page"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
                {requeueMatchingContacts.length > 0 ? (
                  <div className="divide-y max-h-[200px] overflow-y-auto">
                    {requeueMatchingContacts
                      .slice(requeuePage * REQUEUE_PAGE_SIZE, (requeuePage + 1) * REQUEUE_PAGE_SIZE)
                      .map((c: any) => (
                        <div key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
                          <span className="font-medium">
                            {c.customer?.firstName} {c.customer?.lastName}
                          </span>
                          <div className="flex items-center gap-2">
                            {c.dispositionCode && (
                              <Badge variant="outline" className="text-xs">
                                {dispositionMap[c.dispositionCode]?.name || c.dispositionCode}
                              </Badge>
                            )}
                            <Badge variant="secondary" className="text-xs">
                              {(t.campaigns.contactStatuses as Record<string, string>)[c.status] || c.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    {t.campaigns.detail.noDataAvailable}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

          <Separator />
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-muted-foreground">
              {t.campaigns.detail.requeueStatusReset}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowRequeueDialog(false)} data-testid="button-requeue-cancel">
                {t.campaigns.detail.cancel}
              </Button>
              <Button
                className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-amber-600 dark:from-amber-600 dark:to-orange-600"
                disabled={requeueMatchingContacts.length === 0 || requeueMutation.isPending}
                onClick={() => {
                  requeueMutation.mutate(requeueMatchingContacts.map((c: any) => c.id));
                }}
                data-testid="button-requeue-confirm"
              >
                {requeueMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    {t.campaigns.detail.requeueProcessing}
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {t.campaigns.detail.requeueConfirm} ({requeueMatchingContacts.length})
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
