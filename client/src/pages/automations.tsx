import { taskSalutationFields } from "@shared/task-template-variables";
import { ACTIVITY_TEMPLATE_FIELDS } from "@shared/automation-activity-context";
import { isAnalysisServiceEvent, analysisResultTrigger, analysisResultLabel, analysisResultDescription, communicationEventTrigger, legacyNegativeTriggerLabel } from "@shared/automation-analysis-triggers";
import { activityTemplateLabel } from "@shared/automation-activity-template-copy";
import { automationElseActions, automationExecutableActions, automationBranchIssue } from "@shared/automation-branches";
import { AutomationBlockEditor, AutomationBlockActions } from "@/components/automation-block-editor";
import { COMMUNICATION_SOURCE_FIELDS } from "@shared/automation-communication-context";
import { communicationVariableLabels } from "@/i18n/automation-communication-variable-copy";
import { getNoMatchCopy } from "@/i18n/automation-no-match-copy";
import { contentSignalLabels } from "@/i18n/automation-content-signal-copy";
import { getForwardCopy } from "@/i18n/automation-forward-copy";
import { AutomationForwardActionEditor } from "@/components/automation-forward-action-editor";
import { AutomationRecordEntryEditor } from "@/components/automation-record-entry-editor";
import { AutomationConditionReferencePicker } from "@/components/automation-condition-reference-picker";
import { getRecordEntryCopy } from "@/i18n/automation-record-entry-copy";
import { conditionChoiceSource } from "@shared/automation-condition-catalog";
import { useAuth } from "@/contexts/auth-context";
import { emailActionIssues } from "@shared/automation-email-action";
import { forwardActionIssues } from "@shared/automation-forward-action";
import { useState, useMemo, useEffect, useRef, Fragment, lazy, Suspense } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, History, Settings2, X, Sparkles, UsersRound, UserRound, Building2, Mail, Bell, AlertTriangle, Type, Hash, CalendarDays, ListFilter, ToggleLeft, CircleHelp, Equal, EqualNot, ArrowUp, ArrowDown, Search, TextCursorInput, CircleDashed, CircleCheck, ArrowRightLeft, ArrowRight, ArrowLeft, ListX } from "lucide-react";
import { useI18n } from "@/i18n";
import { AutomationDraftAssistant } from "@/components/automation-draft-assistant";
import { AutomationServiceCatalog, type ServiceCatalogData, type ServiceId, type InboundService } from "@/components/automation-service-catalog";
import { serviceVisual } from "@/components/automation-service-visuals";
import { AUTOMATION_TRIGGER_PRESETS, type AutomationTriggerPreset } from "@/lib/automation-trigger-presets";
import { getCommunicationAnalysisCopy } from "@/lib/communication-analysis-copy";
import { AutomationEligibilityDiagnostic } from "@/components/automation-eligibility-diagnostic";
import { AutomationAttachmentResults } from "@/components/automation-attachment-results";
import { getUnifiedAutomationCopy, analysisChannelLabel } from "@/lib/automation-unified-copy";
import { createAnalysisServiceDraft, createMetricServiceDraft, ANALYSIS_RESULT_FIELDS, type AnalysisServiceId } from "@/lib/automation-unified-service";
import { AutomationTextSearchEditor } from "@/components/automation-text-search-editor";
import { analysisConfigIssues } from "@shared/automation-analysis";
import { getMetricAlertLabel } from "@/components/notification-alert-copy";
import { SENTIMENT_CHANNELS, readSentimentSources, withSentimentSources, type AutomationCondition, type SentimentChannel } from "@/lib/sentiment-source-conditions";
import { SentimentSourcePicker } from "@/components/sentiment-source-picker";
import { AutomationTriggerContext, triggerPresetIcons } from "@/components/automation-trigger-context";
import { NotificationRulesManager } from "@/components/notification-center";
import { TaskModalArtwork } from "@/components/tasks/task-modal-artwork";
import { AutomationRuleBasics } from "@/components/automation-rule-basics";
import { AutomationChoicePicker } from "@/components/automation-choice-picker";
import { AutomationTaskAssignmentFilter } from "@/components/automation-task-assignment-filter";
import { AutomationCreateTaskAction } from "@/components/automation-create-task-action";
import { AutomationSendEmailAction } from "@/components/automation-send-email-action";
import { AutomationRecipientTargetSelect } from "@/components/automation-recipient-target-select";
import { AutomationSendSmsAction } from "@/components/automation-send-sms-action";
import { AutomationNotifyUserAction } from "@/components/automation-notify-user-action";
import { AutomationUpdateRecordAction } from "@/components/automation-update-record-action";
import { AutomationRecordTagAction, RecordTagConditionInput } from "@/components/automation-record-tag-action";
import { AutomationAssignOwnerAction } from "@/components/automation-assign-owner-action";
import { assignOwnerIssues } from "@shared/automation-assign-owner";
import { RecordTagsBrowser } from "@/components/record-tags-browser";
import { getAutomationRecordTagCopy } from "@/i18n/automation-record-tag-copy";
import { tagActionIssues } from "@shared/automation-record-tags";
import { getUpdateRecordCopy } from "@/i18n/automation-update-record-copy";
import { getSmsActionCopy } from "@/i18n/automation-sms-copy";
import { AutomationStepHelp } from "@/components/automation-step-help";
import { AutomationRuleExecutionSettings } from "@/components/automation-rule-execution-settings";
import { AutomationFlowPreview } from "@/components/automation-flow-preview";
import { getFlowchartCopy } from "@/i18n/automation-flowchart-copy";
import { getConditionChoiceCopy } from "@/i18n/automation-condition-choice-copy";
import { getFlowExtraLabels } from "@/i18n/automation-flow-labels";
import { conditionValueOptions, usesConditionChoices, SENTIMENT_OPTIONS, TONE_OPTIONS } from "@/lib/automation-condition-options";
import { TaskCreateDatePicker } from "@/components/tasks/task-create-controls";
import { isTaskAssignmentTriggerTarget, type TaskAssignmentTriggerTarget } from "@shared/task-automation";
import { getLeadSearchCopy, leadSearchEventLabel, LEAD_SEARCH_EVENTS, LEAD_SEARCH_FIELDS, leadCampaignSelectionValid } from "@shared/automation-lead-search";
import { AutomationLeadCampaignPicker, type LeadCampaignOption } from "@/components/automation-lead-campaign-picker";
import "./automations-workspace.css";
import { AutomationRulesOverview } from "@/components/automation-rules-overview";
import { AutomationRunHistory } from "@/components/automation-run-history";
import type { Locale } from "@/i18n";

const AlertRulesManager = lazy(() => import("@/components/automation-alert-rules").then(m => ({ default: m.AlertRulesManager })));

const triggerModuleIcons: Record<string, typeof Bell> = {
  customer: UserRound,
  task: History,
  communication: Mail,
  contract: Settings2,
  hospital: Building2,
  clinic: Building2,
  collaborator: UsersRound,
  invoice: History,
  call: Bell,
};
const triggerEventIcons: Record<string, typeof Bell> = {
  created: Plus, updated: Settings2, status_changed: AlertTriangle,
  "task.assigned": UsersRound, "task.completed": History, "task.overdue": Bell,
  "email.received": Mail, "sms.received": Bell, "sentiment.negative": Sparkles,
  "contract.completed": History, "contract.cancelled": X,
  "call.assigned": UsersRound, "call.answered": Bell, "call.completed": History,
  "call.abandoned": AlertTriangle, "call.timeout": AlertTriangle,
  "outbound.started": Plus, "outbound.answered": Bell,
  "outbound.completed": History, "outbound.unanswered": AlertTriangle,
};
const conditionFieldIcons: Record<string, typeof CircleHelp> = {
  string: Type,
  number: Hash,
  date: CalendarDays,
  enum: ListFilter,
  list: ListFilter,
  boolean: ToggleLeft,
};
const conditionOperatorIcons: Record<string, typeof CircleHelp> = {
  eq: Equal, neq: EqualNot, gt: ArrowUp, gte: ArrowUp, lt: ArrowDown, lte: ArrowDown,
  in: ListFilter, not_in: ListX, contains: Search, starts_with: TextCursorInput,
  is_null: CircleDashed, is_not_null: CircleCheck, changed: ArrowRightLeft,
  changed_to: ArrowRight, changed_from: ArrowLeft,
};
const activityTemplateLabelKeys: Record<string, string> = {
  actorUserId: "from",
  assignedUserId: "to",
  assignedDepartmentId: "to",
  taskGroupIds: "to",
  occurredAt: "time",
  createdAt: "created",
  updatedAt: "updated",
  dueDate: "due",
  priority: "priority",
  status: "status",
  eventType: "event",
  id: "id",
  title: "subject",
  campaignId: "mission",
  customerId: "to",
  value: "value",
  metricType: "subject",
  contractNumber: "subject",
  invoiceNumber: "subject",
};
const activityTemplateVariables = (locale: Locale) => ACTIVITY_TEMPLATE_FIELDS.map(({ value }) => {
  const key = value.slice("activity.".length);
  return { value, label: activityTemplateLabel(locale, activityTemplateLabelKeys[key] || key) };
});

type Rule = {
  id: string;
  createdByUserId?: string | null;
  name: string;
  description: string | null;
  module: string;
  countryCode: string | null;
  countryCodes?: string[] | null;
  enabled: boolean;
  isSystem: boolean;
  trigger: any;
  conditions: any;
  actions: any[];
  rateLimitPerHour: number | null;
  consecutiveErrorCount?: number;
  lastErrorAt?: string | null;
  lastErrorMessage?: string | null;
  disabledReason?: string | null;
  autoDisableThreshold?: number;
  updatedAt: string;
};

type Run = {
  id: string;
  ruleId: string;
  status: string;
  skippedReason: string | null;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
};

type Catalog = Omit<ServiceCatalogData, "eventTypes" | "actionTypes"> & {
  modules: { value: string; label: string }[];
  eventTypes: { value: string; label: string; availableIn: string[]; changeSnapshot: boolean }[];
  actionTypes: (ServiceCatalogData["actionTypes"][number] & { configSchema: Record<string, string> })[];
  operators: { value: string; label: string; arity: number; availableIn: string[] }[];
  fields: Record<string, { value: string; label: string; type: string; options?: string[] }[]>;
  fieldsByEvent: Record<string, Record<string, Catalog["fields"][string]>>;
  recipients: { value: string; label: string; actions: string[]; modules: string[] }[];
  recipientTemplatesByEvent: Record<string, Record<string, string[]>>;
  countries: { value: string; label: string }[];
  schedule?: { perRecordModules: string[]; maxMatches: number };
};

type UserOpt = { id: string; fullName: string; email: string; role?: string };
type TaskGroupOpt = { id: string; name: string; displayAlias?: string | null; color?: string | null; isBackOffice?: boolean; members?: { userId: string }[] };
type RoleOpt = { id: string; name: string; description?: string | null; isActive?: boolean };

type LeafCondition = { field: string; op: string; value?: any };
type ConditionField = Catalog["fields"][string][number] & { optionLabels?: Record<string, string>; help?: string };
type GroupCondition = { all?: ConditionNode[]; any?: ConditionNode[]; not?: ConditionNode };
type ConditionNode = LeafCondition | GroupCondition;
const hasChannelCondition = (node: ConditionNode | null): boolean => {
  if (!node) return false;
  if ("all" in node && node.all) return node.all.some(hasChannelCondition);
  if ("any" in node && node.any) return node.any.some(hasChannelCondition);
  if ("not" in node && node.not) return hasChannelCondition(node.not);
  return (node as LeafCondition).field === "newValues.type";
};

type ActionNode = { type: string; config: Record<string, any> };

type RuleDraft = {
  name: string;
  description: string;
  module: string;
  countryCode: string | null;
  countryCodes: string[] | null;
  enabled: boolean;
  trigger:
    | { type: "event"; entityType: string; eventType: string; assignmentTarget?: TaskAssignmentTriggerTarget; analysis?: any; metric?: any; legacySource?: any; noMatchRuleId?: string; noMatchActions?: ActionNode[]; leadCampaignIds?: number[] }
    | { type: "schedule"; interval: string; mode?: "once" | "per_record" };
  conditions: ConditionNode | null;
  actions: ActionNode[];
  rateLimitPerHour: number | null;
};
type EventTriggerDraft = Extract<RuleDraft["trigger"], { type: "event" }>;

const EMPTY_DRAFT = (): RuleDraft => ({
  name: "",
  description: "",
  module: "task",
  countryCode: null,
  countryCodes: null,
  enabled: false,
  trigger: { type: "event", entityType: "task", eventType: "status_changed" },
  conditions: null,
  actions: [],
  rateLimitPerHour: null,
});

const isNegativeSentimentRule = (draft: RuleDraft) =>
  draft.module === "communication" && draft.trigger.type === "event" && draft.trigger.eventType === "sentiment.negative";

function chooseTriggerPreset(draft: RuleDraft, preset: AutomationTriggerPreset): RuleDraft {
  const wasSentiment = isNegativeSentimentRule(draft);
  const nextSentiment = preset.id === "negativeSentiment";
  const previous = wasSentiment ? readSentimentSources(draft.conditions as AutomationCondition | null) : null;
  const existingCommunication = !wasSentiment && draft.module === "communication"
    ? readSentimentSources(draft.conditions as AutomationCondition | null) : null;
  return {
    ...draft,
    module: preset.module,
    trigger: { type: "event", entityType: preset.module, eventType: preset.eventType },
    conditions: nextSentiment
      ? (wasSentiment && previous?.editable
          ? withSentimentSources(previous.channels, previous.extra)
          : existingCommunication?.editable
            ? withSentimentSources(existingCommunication.channels, existingCommunication.extra)
            : withSentimentSources(SENTIMENT_CHANNELS, draft.conditions as AutomationCondition | null)) as ConditionNode
      : wasSentiment && previous?.editable ? previous.extra as ConditionNode | null : draft.conditions,
  };
}

export default function AutomationsPage() {
  const { toast } = useToast();
  const { t, locale } = useI18n();
  const [editing, setEditing] = useState<Rule | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newService, setNewService] = useState<ServiceId | null>(null);
  const [historyFor, setHistoryFor] = useState<Rule | null>(null);
  const [flowFor, setFlowFor] = useState<Rule | null>(null);
  const [showTagOverview, setShowTagOverview] = useState(false);
  const [prefillDraft, setPrefillDraft] = useState<RuleDraft | null>(null);

  // Prefill from URL params (e.g. when arriving from Status Management "⚡ Create automation")
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("prefillStatusCode");
    const name = params.get("prefillStatusName") || code;
    const cat = params.get("prefillStatusCategory");
    if (!code && !cat) return;
    const draft: RuleDraft = {
      name: name ? `Pri statuse: ${name}` : "Pri zmene statusu",
      description: "Automaticky vytvorené zo Status Management",
      module: "customer",
      countryCode: null,
      countryCodes: null,
      enabled: true,
      trigger: { type: "event", entityType: "customer", eventType: "updated" },
      conditions: code
        ? { all: [{ field: "newValues.lastCallResult", op: "changed_to", value: code }] }
        : { all: [{ field: "newValues.lastDispositionCategory", op: "eq", value: cat }] },
      actions: [
        { type: "notify_user", config: { notificationActionVersion: 2, userId: "{{newValues.assignedUserId}}", title: name || "Status zmena", message: "Klient: {{newValues.firstName}} {{newValues.lastName}}" } },
      ],
      rateLimitPerHour: null,
    };
    setPrefillDraft(draft);
    setShowCreate(true);
    // clear URL so refresh doesn't re-open
    window.history.replaceState({}, "", "/automations");
  }, []);

  const [topTab, setTopTab] = useState<"assistant" | "services" | "rules" | "runs">(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    return tab === "notifications" ? "rules"
      : tab === "assistant" || tab === "rules" || tab === "runs" ? tab : "services";
  });
  useEffect(() => {
    const url = new URL(window.location.href);
    if (topTab === "services") url.searchParams.delete("tab");
    else url.searchParams.set("tab", topTab);
    url.searchParams.delete("section");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, [topTab]);
  const rulesQ = useQuery<Rule[]>({ queryKey: ["/api/automation/rules"] });
  const catalogQ = useQuery<Catalog>({ queryKey: ["/api/automation/catalog"] });
  const leadCampaignsQ = useQuery<LeadCampaignOption[]>({
    queryKey: ["/api/automation/lead-campaigns"],
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const response = await fetch("/api/automation/lead-campaigns", { credentials: "include" });
      if (!response.ok) throw new Error("Could not load search campaigns");
      return response.json();
    },
  });
  const usersQ = useQuery<UserOpt[]>({ queryKey: ["/api/automation/users"] });
  const departmentsQ = useQuery<Array<{ id: string; name: string }>>({ queryKey: ["/api/departments"] });
  const taskGroupsQ = useQuery<TaskGroupOpt[]>({ queryKey: ["/api/task-groups"] });
  const rolesQ = useQuery<RoleOpt[]>({ queryKey: ["/api/roles"] });

  const createMut = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/automation/rules", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation/rules"] });
      setShowCreate(false);
      toast({ title: "Rule created" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/automation/rules/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation/rules"] });
      setEditing(null);
      toast({ title: "Saved" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/automation/rules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation/rules"] });
      toast({ title: "Deleted" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  const legacyDraftMut = useMutation({
    mutationFn: async ({ kind, id }: { kind: "notification" | "metric"; id: string }) =>
      apiRequest("POST", `/api/automation/legacy/${kind}/${id}/draft`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation/rules"] });
      toast({ title: getUnifiedAutomationCopy(locale).reviewSuccess });
    },
    onError: () => toast({ title: getUnifiedAutomationCopy(locale).reviewError, variant: "destructive" }),
  });
  const activateReviewedMut = useMutation({
    mutationFn: async (rule: Rule) => apiRequest("POST", `/api/automation/rules/${rule.id}/activate-reviewed`),
    onSuccess: (_result, rule) => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation/rules"] });
      queryClient.invalidateQueries({ queryKey: [rule.trigger?.legacySource?.kind === "metric" ? "/api/alert-rules" : "/api/notification-rules"] });
      toast({ title: getUnifiedAutomationCopy(locale).activateSuccess });
    },
    onError: () => toast({ title: getUnifiedAutomationCopy(locale).activateError, variant: "destructive" }),
  });

  const toggleEnabled = (rule: Rule) =>
    updateMut.mutate({ id: rule.id, data: { enabled: !rule.enabled } });

  const resetErrorsMut = useMutation({
    mutationFn: async (rule: Rule) => apiRequest("POST", `/api/automation/rules/${rule.id}/reset-errors`, { reEnable: !!rule.disabledReason }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/automation/rules"] }),
    onError: (error: Error) => toast({ title: t.automationOverview.failed, description: error.message, variant: "destructive" }),
  });

  const onSave = (draft: RuleDraft) => {
    if (editing) updateMut.mutate({ id: editing.id, data: draft });
    else createMut.mutate(draft);
  };

  return (
    <div className="space-y-6 automation-workspace">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="text-page-title">
            <Settings2 className="h-6 w-6" />
            {t.automationOverview.automationTitle}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setShowTagOverview(true)} data-testid="button-record-tag-overview">
          {getAutomationRecordTagCopy(locale).overview}
        </Button>
        <Button onClick={() => { setNewService(null); setShowCreate(true); }} data-testid="button-create-rule">
          <Plus className="h-4 w-4 mr-2" />
          {t.automationServices.choose}
        </Button>
        </div>
      </div>

      <Tabs value={topTab} onValueChange={(v) => setTopTab(v as any)}>
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="services" data-testid="tab-automation-services">{t.automationServices.servicesTab}</TabsTrigger>
          <TabsTrigger value="assistant" data-testid="tab-automation-assistant">
            <Sparkles className="h-3.5 w-3.5 mr-1" />{t.automationDraft.button}
          </TabsTrigger>
          <TabsTrigger value="rules" data-testid="tab-rules">{t.automationOverview.rules}</TabsTrigger>
          <TabsTrigger value="runs" data-testid="tab-runs">
            <History className="h-3.5 w-3.5 mr-1" /> {t.automationOverview.history}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="pt-4">
          {catalogQ.isLoading && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
          {catalogQ.isError && <p className="text-sm text-destructive">{String(catalogQ.error)}</p>}
          {catalogQ.data && <AutomationServiceCatalog catalog={catalogQ.data} onSelectTrigger={(preset) => {
            const unified = getUnifiedAutomationCopy(locale);
            const title = preset.id === "contentAnalysis" ? getCommunicationAnalysisCopy(locale).analysisTitle
              : preset.id === "attachmentAnalysis" ? unified.attachment
                : preset.id === "metricMonitor" ? unified.metric
                  : t.automationServices.triggerPresets.labels[preset.id];
            setNewService(null);
            const draft = preset.id === "contentAnalysis" || preset.id === "attachmentAnalysis"
              ? createAnalysisServiceDraft(preset.id === "attachmentAnalysis" ? "attachment_analysis" : "communication_analysis", title,
                preset.id === "attachmentAnalysis" ? unified.attachmentInfo : getCommunicationAnalysisCopy(locale).analysisDescription)
              : preset.id === "metricMonitor"
                ? createMetricServiceDraft({
                  name: title, description: unified.metricInfo, metricType: catalogQ.data?.metricTypes?.[0]?.value || "pending_lab_results",
                  checkFrequency: "daily", cooldownMinutes: 60, threshold: 0,
                })
                : chooseTriggerPreset({
              ...EMPTY_DRAFT(),
              name: title,
              enabled: true,
              actions: [{ type: "notify_user", config: { notificationActionVersion: 2, title } }],
            }, preset);
            setPrefillDraft(draft);
            setShowCreate(true);
          }} onSelectAnalysis={(id: AnalysisServiceId) => {
            const unified = getUnifiedAutomationCopy(locale);
            setNewService(null);
            if (id === "metric_monitor") {
              const metric = catalogQ.data?.metricTypes?.[0]?.value || "pending_lab_results";
              setPrefillDraft(createMetricServiceDraft({
                name: unified.metric, description: unified.metricInfo, metricType: metric,
                checkFrequency: "daily", cooldownMinutes: 60, threshold: 0,
              }));
            } else {
              setPrefillDraft(createAnalysisServiceDraft(id, id === "communication_analysis" ? unified.communication : unified.attachment,
                id === "communication_analysis" ? unified.communicationInfo : unified.attachmentInfo));
            }
            setShowCreate(true);
          }} onSelect={(service) => {
            setPrefillDraft(null);
            setNewService(service);
            setShowCreate(true);
          }} onSelectInbound={(service: InboundService) => {
            setNewService(null);
            setPrefillDraft({
              ...EMPTY_DRAFT(),
              name: t.automationServices.inboundNames[service.id],
              description: t.automationServices.inboundDescriptions[service.id],
              module: "call",
              trigger: { type: "event", entityType: "call", eventType: service.eventType },
              conditions: service.conditions,
              actions: [{ type: service.actionType, config: { ...service.config } }],
            });
            setShowCreate(true);
          }} onSelectOutbound={(service: InboundService) => {
            setNewService(null);
            setPrefillDraft({
              ...EMPTY_DRAFT(),
              name: t.automationServices.outboundNames[service.id as keyof typeof t.automationServices.outboundNames],
              description: t.automationServices.outboundDescriptions[service.id as keyof typeof t.automationServices.outboundDescriptions],
              module: "call",
              trigger: { type: "event", entityType: "call", eventType: service.eventType },
              conditions: service.conditions,
              actions: [{ type: service.actionType, config: { ...service.config } }],
            });
            setShowCreate(true);
          }} />}
        </TabsContent>

        <TabsContent value="assistant" className="pt-4">
          <AutomationDraftAssistant />
        </TabsContent>

        <TabsContent value="rules" className="pt-4">
          <AutomationRulesOverview
            rules={rulesQ.data || []} catalog={catalogQ.data}
            leadCampaigns={leadCampaignsQ.data || []}
            loading={rulesQ.isLoading || catalogQ.isLoading} error={rulesQ.isError || catalogQ.isError}
            busy={updateMut.isPending || deleteMut.isPending || resetErrorsMut.isPending || activateReviewedMut.isPending}
            onRetry={() => { void rulesQ.refetch(); void catalogQ.refetch(); }}
            onCreate={() => { setNewService(null); setShowCreate(true); }}
            onToggle={toggleEnabled} onEdit={setEditing} onFlow={setFlowFor} onHistory={setHistoryFor}
            onReset={rule => resetErrorsMut.mutate(rule)}
            onReview={rule => { if (window.confirm(getUnifiedAutomationCopy(locale).confirmReviewedActivation)) activateReviewedMut.mutate(rule); }}
            onDelete={rule => { if (!rule.isSystem && window.confirm(t.automationOverview.confirmDelete.replace("{name}", rule.name))) deleteMut.mutate(rule.id); }}
          >
            <section className="space-y-5 border-t border-border/70 pt-7" data-testid="legacy-rules-review">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">INDEXUS / {t.automationOverview.rules}</p>
                <h2 className="mt-1 text-xl font-semibold">{t.automationServices.managed.heading}</h2>
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{getUnifiedAutomationCopy(locale).reviewHint}</p>
              </div>
              <NotificationRulesManager
                onConvertForReview={(rule) => legacyDraftMut.mutate({ kind: "notification", id: rule.id })}
              />
              <Suspense fallback={<div className="h-24 animate-pulse rounded-xl bg-muted/70" />}>
                <AlertRulesManager onConvertForReview={(rule) => legacyDraftMut.mutate({ kind: "metric", id: rule.id })} />
              </Suspense>
            </section>
          </AutomationRulesOverview>
        </TabsContent>

        <TabsContent value="runs" className="pt-4">
          <AutomationRunHistory rules={rulesQ.data || []} catalog={catalogQ.data}
            onBack={() => setTopTab("rules")}
            onOpenRule={rule => { setTopTab("rules"); setEditing(rule); }} />
        </TabsContent>
      </Tabs>

      {(editing || showCreate) && catalogQ.data && (
        <RuleEditor
          open={!!editing || showCreate}
          rule={editing}
          initialDraft={prefillDraft}
          initialService={newService}
          catalog={catalogQ.data}
          users={usersQ.data || []}
          departments={departmentsQ.data || []}
          taskGroups={taskGroupsQ.data || []}
          roles={rolesQ.data || []}
          rules={rulesQ.data || []}
          onClose={() => {
            setEditing(null);
            setShowCreate(false);
            setPrefillDraft(null);
            setNewService(null);
          }}
          onSave={onSave}
          saving={createMut.isPending || updateMut.isPending}
        />
      )}

      <Dialog open={!!flowFor} onOpenChange={open => !open && setFlowFor(null)}>
        <DialogContent className="task-modern-modal automation-saved-flow-dialog max-w-5xl h-[90dvh] overflow-hidden p-0" overlayClassName="task-modern-modal-overlay">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-3">
            <DialogTitle>{getFlowchartCopy(locale).preview}</DialogTitle>
            <DialogDescription>{getFlowchartCopy(locale).definitionNotice}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6" data-testid="saved-flow-scroll">
          {flowFor && catalogQ.data && <AutomationFlowPreview
            rule={(rulesQ.data || []).find(rule => rule.id === flowFor.id) || flowFor}
            catalog={catalogQ.data} users={usersQ.data || []} taskGroups={taskGroupsQ.data || []} rules={rulesQ.data || []}
            roles={rolesQ.data || []} departments={departmentsQ.data || []} leadCampaigns={leadCampaignsQ.data || []} />}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showTagOverview} onOpenChange={setShowTagOverview}>
        <DialogContent className="task-modern-modal max-w-4xl max-h-[90dvh] overflow-y-auto" overlayClassName="task-modern-modal-overlay">
          <TaskModalArtwork variant="detail" />
          <DialogHeader><DialogTitle>{getAutomationRecordTagCopy(locale).overview}</DialogTitle></DialogHeader>
          <div className="task-modern-modal-body"><RecordTagsBrowser /></div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!historyFor} onOpenChange={(o) => !o && setHistoryFor(null)}>
        <DialogContent className="automation-history-dialog max-w-6xl max-h-[90dvh] overflow-y-auto p-0" overlayClassName="task-modern-modal-overlay">
          <DialogHeader>
            <DialogTitle>{t.automationOverview.history}: {historyFor?.name}</DialogTitle>
            <DialogDescription>{t.automationOverview.historySubtitle}</DialogDescription>
          </DialogHeader>
          {historyFor && <AutomationRunHistory rules={rulesQ.data || []} catalog={catalogQ.data} ruleId={historyFor.id} compact
            onOpenRule={rule => { setHistoryFor(null); setEditing(rule); }} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ============================================================
   Rule editor — Builder + live flowchart tabs
   ============================================================ */
export function RuleEditor({
  open,
  rule,
  initialDraft,
  initialService,
  catalog,
  users,
  departments,
  taskGroups,
  roles,
  onClose,
  onSave,
  saving,
  rules,
}: {
  open: boolean;
  rule: Rule | null;
  initialDraft?: RuleDraft | null;
  initialService?: ServiceId | null;
  catalog: Catalog;
  users: UserOpt[];
  departments?: Array<{ id: string; name: string }>;
  taskGroups: TaskGroupOpt[];
  roles: RoleOpt[];
  onClose: () => void;
  onSave: (draft: RuleDraft) => void;
  saving: boolean;
  rules: Rule[];
}) {
  const { toast } = useToast();
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const noMatchCopy = getNoMatchCopy(locale);
  const countryNames = useMemo(() => new Intl.DisplayNames([locale], { type: "region" }), [locale]);
  const { data: analysisMailboxes = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/automation/analysis-mailboxes"], enabled: open,
  });
  const leadCopy = getLeadSearchCopy(locale);
  const [emailDraftInvalidByAction, setEmailDraftInvalidByAction] = useState<Record<number, boolean>>({});
  const [draft, setDraft] = useState<RuleDraft>(() =>
    rule
      ? {
          name: rule.name,
          description: rule.description || "",
          module: rule.module,
          countryCode: rule.countryCode,
          countryCodes: rule.countryCodes ?? (rule.countryCode ? [rule.countryCode] : null),
          enabled: rule.enabled,
          trigger: rule.trigger || { type: "event", entityType: rule.module, eventType: "updated" },
          conditions: rule.conditions || null,
          actions: rule.actions || [],
          rateLimitPerHour: rule.rateLimitPerHour,
        }
      : (initialDraft || EMPTY_DRAFT())
  );
  const leadCampaignsQ = useQuery<LeadCampaignOption[]>({
    queryKey: ["/api/automation/lead-campaigns"],
    enabled: open && draft.module === "lead_search",
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: open && draft.module === "lead_search" ? 60_000 : false,
    queryFn: async () => {
      const response = await fetch("/api/automation/lead-campaigns", { credentials: "include" });
      if (!response.ok) throw new Error("Could not load search campaigns");
      return response.json();
    },
  });
  const [selectedService, setSelectedService] = useState<ServiceId | null>(initialService || null);
  const [tab, setTab] = useState<string>("builder");
  const [showTest, setShowTest] = useState(false);
  const [expandedStep, setExpandedStepState] = useState<number | null>(null);
  const blockSnapshot = useRef<RuleDraft | null>(null);
  const [editingAction, setEditingAction] = useState<string | null>(null);
  const [elseSearch, setElseSearch] = useState("");
  const [pendingElseMode, setPendingElseMode] = useState<"link" | null>(null);
  const setExpandedStep = (step: number | null) => {
    if (step !== null && expandedStep === null) {
      blockSnapshot.current = structuredClone(draft);
      setEditingAction(null);
      setElseSearch("");
      setPendingElseMode(null);
    }
    setExpandedStepState(step);
  };
  const cancelBlock = () => {
    if (blockSnapshot.current) setDraft(blockSnapshot.current);
    blockSnapshot.current = null;
    setEmailDraftInvalidByAction({});
    setEditingAction(null);
    setSourceResetNotice(false);
    setExpandedStepState(null);
    setPendingElseMode(null);
  };
  const applyBlock = () => {
    blockSnapshot.current = null;
    setEditingAction(null);
    setExpandedStepState(null);
    setPendingElseMode(null);
  };
  const [inspectorTab, setInspectorTab] = useState<"summary" | "test">("summary");
  const [sourceResetNotice, setSourceResetNotice] = useState(false);
  const scheduleMode = draft.trigger.type === "schedule" ? draft.trigger.mode || "once" : null;
  const [schedulePreview, setSchedulePreview] = useState<{
    status: "idle" | "pending" | "ready" | "error";
    matchedCount?: number;
    overLimit?: boolean;
    maxMatches?: number;
  }>({ status: "idle" });

  const selectService = (service: ServiceId) => {
    const option = catalog.actionTypes.find(a => a.value === service);
    if (!option) return;
    const module = option.availableIn.includes("task") ? "task" : option.availableIn[0];
    const eventType = catalog.eventTypes.find(e => e.availableIn.includes(module))?.value;
    if (!module || !eventType) return;
    const next: RuleDraft = {
      ...EMPTY_DRAFT(), module,
      trigger: { type: "event", entityType: module, eventType },
      actions: [{ type: service, config: service === "send_email" ? { emailActionVersion: 2, senderMode: "personal" } : {} }],
    };
    setDraft(next);
    setSelectedService(service);
    setExpandedStepState(null);
  };

  useEffect(() => {
    if (initialService && !rule && !initialDraft) selectService(initialService);
  }, [initialService]);

  const selectedEvent = draft.trigger.type === "event" ? draft.trigger.eventType : "schedule.tick";
  const leadCampaignIds = draft.trigger.type === "event" && Array.isArray(draft.trigger.leadCampaignIds)
    ? draft.trigger.leadCampaignIds : [];
  const leadCampaigns = leadCampaignsQ.data || [];
  const leadCampaignsExist = leadCampaignIds.every(id => leadCampaigns.some(campaign => campaign.id === id));
  const leadSelectionValid = draft.module !== "lead_search" ||
    (leadCampaignSelectionValid(leadCampaignIds) && leadCampaignsExist && !leadCampaignsQ.isLoading && !leadCampaignsQ.isError);
  const eventTrigger = (module: string, eventType: string): EventTriggerDraft => ({
    type: "event" as const, entityType: module, eventType,
    ...(module === "lead_search" && draft.trigger.type === "event" && draft.module === module && draft.trigger.leadCampaignIds
      ? { leadCampaignIds: draft.trigger.leadCampaignIds } : {}),
  });
  const analysisConfig = draft.trigger.type === "event" ? draft.trigger.analysis : undefined;
  const selectedPreset = draft.trigger.type === "event"
    ? draft.module === "metric" ? AUTOMATION_TRIGGER_PRESETS.find(preset => preset.id === "metricMonitor")
      : selectedEvent === "communication.received" && analysisConfig?.analyzeAttachments
        ? AUTOMATION_TRIGGER_PRESETS.find(preset => preset.id === "attachmentAnalysis")
        : selectedEvent === "communication.received" && analysisConfig
          ? AUTOMATION_TRIGGER_PRESETS.find(preset => preset.id === "contentAnalysis")
          : AUTOMATION_TRIGGER_PRESETS.find(preset => preset.module === draft.module && preset.eventType === selectedEvent)
    : undefined;
  const sentimentRule = isNegativeSentimentRule(draft);
  const sentimentSources = sentimentRule ? readSentimentSources(draft.conditions as AutomationCondition | null) : null;
  const visibleConditions = sentimentSources?.editable ? sentimentSources.extra as ConditionNode | null : draft.conditions;
  const updateConditions = (conditions: ConditionNode | null) => setDraft({
    ...draft,
    conditions: sentimentSources?.editable
      ? withSentimentSources(sentimentSources.channels, conditions as AutomationCondition | null) as ConditionNode
      : conditions,
  });
  const resetSourceConditions = () => {
    if (draft.conditions) setSourceResetNotice(true);
    return null;
  };
  const toggleSentimentSource = (channel: SentimentChannel) => {
    if (!sentimentSources?.editable) return;
    const next = sentimentSources.channels.includes(channel)
      ? sentimentSources.channels.filter(source => source !== channel)
      : [...sentimentSources.channels, channel];
    if (!next.length) return;
    setDraft({ ...draft, conditions: withSentimentSources(next, sentimentSources.extra) as ConditionNode });
  };
  const updateAnalysisConfig = (patch: Record<string, any>) => {
    if (draft.trigger.type !== "event") return;
    setDraft({ ...draft, trigger: { ...draft.trigger, analysis: { ...draft.trigger.analysis, ...patch } } });
  };
  const noMatchTargets = rules.filter(target => target.id !== rule?.id && target.module === draft.module &&
    target.createdByUserId === (rule?.createdByUserId || user?.id) &&
    target.trigger?.type === "event" && target.trigger?.analysis);
  const configuredNoMatchRuleId = draft.trigger.type === "event" ? draft.trigger.noMatchRuleId : undefined;
  const noMatchControl = draft.module === "communication" && draft.trigger.type === "event" && analysisConfig ? (
    <div className="rounded-xl border bg-muted/30 p-4 space-y-2 mb-4" data-testid="automation-no-match">
      <Label>{noMatchCopy.title}</Label>
      <Select value={configuredNoMatchRuleId || "__stop__"} onValueChange={value => {
        if (draft.trigger.type !== "event") return;
        const { noMatchRuleId: _previous, ...trigger } = draft.trigger;
        setDraft({ ...draft, trigger: value === "__stop__" ? trigger : { ...trigger, noMatchRuleId: value } });
      }}>
        <SelectTrigger aria-label={noMatchCopy.title}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__stop__">{noMatchCopy.stop}</SelectItem>
          {configuredNoMatchRuleId && !noMatchTargets.some(target => target.id === configuredNoMatchRuleId) &&
            <SelectItem value={configuredNoMatchRuleId} disabled>{noMatchCopy.unavailable}</SelectItem>}
          {noMatchTargets.map(target => <SelectItem key={target.id} value={target.id}>{noMatchCopy.evaluate} · {target.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{noMatchCopy.help}</p>
    </div>
  ) : null;
  const updateMetricConfig = (patch: Record<string, any>) => {
    if (draft.trigger.type !== "event") return;
    setDraft({ ...draft, trigger: { ...draft.trigger, metric: { ...draft.trigger.metric, ...patch } } });
  };
  const analysisFields = ANALYSIS_RESULT_FIELDS.map(value => ({
    value,
    label: value.replace(/^analysis\./, "").replace(/[A-Z]/g, letter => ` ${letter.toLowerCase()}`),
    type: ["analysis.wantsToCancel", "analysis.hasInvoice", "analysis.mentionsInvoice", "analysis.hasComplaint",
      "analysis.needsReply", "analysis.isUrgent", "analysis.isThankYou", "analysis.requestsCallback",
      "analysis.textMatched", "analysis.textContentMatched", "analysis.textAttachmentsMatched"].includes(value) ? "boolean"
      : ["analysis.invoiceCount", "analysis.attachmentCount", "analysis.failedAttachmentCount", "analysis.textMatchCount"].includes(value) ? "number"
        : ["analysis.sentiment", "analysis.tone"].includes(value) ? "enum" : "string",
    options: value === "analysis.sentiment" ? SENTIMENT_OPTIONS
      : value === "analysis.tone" ? TONE_OPTIONS : undefined,
  }));
  const fieldsForModule = [
    ...(catalog.fieldsByEvent?.[draft.module]?.[selectedEvent] || []),
    ...(draft.module === "communication" && analysisConfig ? analysisFields : []),
    ...(draft.module === "communication" && analysisConfig ? COMMUNICATION_SOURCE_FIELDS : []),
    ...(draft.module === "metric" ? [{ value: "newValues.value", label: "Metric value", type: "number" }] : []),
    ...(draft.module === "lead_search" ? LEAD_SEARCH_FIELDS.map(field => ({
      value: `newValues.${field.key}`, label: leadCopy[field.key], type: field.type,
    })) : []),
  ].filter((field, index, fields) => fields.findIndex(other => other.value === field.value) === index)
    .map(field => ({ ...field, label: contentSignalLabels(locale)[field.value] || communicationVariableLabels(locale)[field.value] || field.label }));
  const schedulePreviewInput = useMemo(() => JSON.stringify({
    module: draft.module,
    trigger: draft.trigger.type === "schedule"
      ? { ...draft.trigger, mode: draft.trigger.mode || "once" }
      : draft.trigger,
    conditions: draft.conditions,
    countryCodes: draft.countryCodes?.length ? draft.countryCodes : null,
    actions: draft.actions,
  }), [draft.module, draft.trigger, draft.conditions, draft.countryCodes, draft.actions]);
  useEffect(() => {
    if (!open || draft.trigger.type !== "schedule" || scheduleMode !== "per_record") {
      setSchedulePreview({ status: "idle" });
      return;
    }
    let current = true;
    setSchedulePreview({ status: "pending" });
    const timeout = window.setTimeout(async () => {
      try {
        const response = await apiRequest("POST", "/api/automation/schedule-preview", JSON.parse(schedulePreviewInput));
        const data = await response.json();
        if (!current) return;
        if (!Number.isFinite(data?.matchedCount) || data.matchedCount < 0 ||
          !Number.isFinite(data?.maxMatches) || data.maxMatches < 0 || typeof data?.overLimit !== "boolean") {
          throw new Error("Invalid schedule preview response");
        }
        setSchedulePreview({
          status: "ready",
          matchedCount: data.matchedCount,
          overLimit: Boolean(data.overLimit),
          maxMatches: data.maxMatches,
        });
      } catch {
        if (current) setSchedulePreview({ status: "error" });
      }
    }, 350);
    return () => {
      current = false;
      window.clearTimeout(timeout);
    };
  }, [open, draft.trigger.type, scheduleMode, schedulePreviewInput]);
  const fieldsForConditions = selectedPreset && selectedPreset.id !== "contentAnalysis" && draft.module === "communication" && !hasChannelCondition(visibleConditions)
    ? fieldsForModule.filter(field => field.value !== "newValues.type")
    : fieldsForModule;
  const eventsForModule = [
    ...catalog.eventTypes.filter(e => e.availableIn.includes(draft.module)),
    ...(draft.module === "lead_search" ? LEAD_SEARCH_EVENTS.filter(value =>
      !catalog.eventTypes.some(event => event.value === value && event.availableIn.includes("lead_search")),
    ).map(value => ({
      value, label: leadSearchEventLabel(locale, value) || value, availableIn: ["lead_search"], changeSnapshot: false,
    })) : []),
    ...(draft.module === "metric" && !catalog.eventTypes.some(event => event.value === "metric.threshold")
      ? [{ value: "metric.threshold", label: getUnifiedAutomationCopy(locale).metric, availableIn: ["metric"], changeSnapshot: false }]
      : []),
    ...(draft.module === "communication" && draft.trigger.type === "event" && draft.trigger.analysis &&
      !catalog.eventTypes.some(event => event.value === "communication.received")
      ? [{ value: "communication.received", label: getCommunicationAnalysisCopy(locale).analysisTitle, availableIn: ["communication"], changeSnapshot: false }]
      : []),
  ];
  const editorModules = [
    ...catalog.modules,
    ...(!catalog.modules.some(module => module.value === "metric") ? [{ value: "metric", label: getUnifiedAutomationCopy(locale).metric }] : []),
    ...(!catalog.modules.some(module => module.value === "lead_search") ? [{ value: "lead_search", label: leadCopy.module }] : []),
  ];
  const actionsForModule = catalog.actionTypes.filter(a => a.availableIn.includes(draft.module));
  if (draft.module === "metric" && !actionsForModule.some(action => action.value === "notify_user")) {
    const notifyAction = catalog.actionTypes.find(action => action.value === "notify_user");
    if (notifyAction) actionsForModule.push(notifyAction);
  }
  const operatorsForModule = [
    ...catalog.operators.filter(operator => operator.availableIn.includes(draft.module)),
    ...(draft.module === "metric" && !catalog.operators.some(operator => operator.value === "gte" && operator.availableIn.includes("metric"))
      ? [{ ...(catalog.operators.find(operator => operator.value === "gte") || { value: "gte", label: "at least", arity: 1 }), availableIn: ["metric"] }]
      : []),
  ];
  const moduleNames = (ids: string[]) => ids.map(id => {
    const fallback = id === "collaborator" ? t.automationCatalog.collaborator
      : id === "communication" ? t.automationServices.triggerPresets.moduleLabel
      : id === "metric" ? getUnifiedAutomationCopy(locale).metric
      : id === "lead_search" ? leadCopy.module
      : catalog.modules.find(m => m.value === id)?.label || id;
    return t.automationServices.editorCatalog.moduleLabels[id] ||
      (getUpdateRecordCopy(locale).entity as Record<string, string>)[id] || fallback;
  }).join(", ");
  const eventLabel = (event: Catalog["eventTypes"][number]) => {
    const leadSearchLabel = leadSearchEventLabel(locale, event.value);
    if (leadSearchLabel) return leadSearchLabel;
    if (event.value === "sentiment.negative") return legacyNegativeTriggerLabel(locale);
    const resultLabel = analysisResultLabel(locale, event.value);
    if (resultLabel) return resultLabel;
    if (event.value === "contract.completed") return t.automationCatalog.contractCompleted;
    if (event.value === "contract.cancelled") return t.automationCatalog.contractCancelled;
    const preset = event.value === "communication.received" && analysisConfig?.analyzeAttachments
      ? AUTOMATION_TRIGGER_PRESETS.find(item => item.id === "attachmentAnalysis")
      : AUTOMATION_TRIGGER_PRESETS.find(preset => preset.module === draft.module && preset.eventType === event.value);
    return preset ? preset.id === "contentAnalysis" ? getCommunicationAnalysisCopy(locale).analysisTitle
      : preset.id === "attachmentAnalysis" ? getUnifiedAutomationCopy(locale).attachment
        : preset.id === "metricMonitor" ? getUnifiedAutomationCopy(locale).metric
          : t.automationServices.triggerPresets.labels[preset.id] : t.automationServices.editorCatalog.eventLabels[event.value] || event.label;
  };
  const eventDescription = (event: Catalog["eventTypes"][number]) =>
    draft.module === "lead_search" ? leadCopy.help :
    analysisResultTrigger(event.value) ? analysisResultDescription(locale, event.value) :
    event.value === "communication.analyzed" ? getCommunicationAnalysisCopy(locale).analysisDescription :
    (draft.module === "task" ? t.automationServices.taskRules.eventDescriptions[event.value] : undefined) ||
    t.automationServices.editorCatalog.eventDescriptions[event.value] || t.automationServices.editorCatalog.eventDescriptionFallback;
  const fieldLabel = (field: { value: string; label: string }) => {
    if (draft.module === "lead_search") {
      const key = field.value.replace(/^newValues\./, "");
      if (LEAD_SEARCH_FIELDS.some(item => item.key === key)) return leadCopy[key as keyof typeof leadCopy];
    }
    const flowLabel = getFlowExtraLabels(locale)[field.value];
    if (flowLabel) return flowLabel;
    const analysisLabel = draft.module === "communication" ? field.value === "countryCode" ? getCommunicationAnalysisCopy(locale).countryCode
      : getCommunicationAnalysisCopy(locale).fieldLabels[field.value] : undefined;
    if (analysisLabel) return analysisLabel;
    return field.value.endsWith(".tags") ? field.value.startsWith("oldValues.")
      ? getAutomationRecordTagCopy(locale).previousTags : getAutomationRecordTagCopy(locale).tags :
    (draft.module === "task" ? t.automationServices.taskRules.fieldLabels[field.value] : undefined) ||
    t.automationServices.editorCatalog.fieldLabels[field.value] ||
    (getUpdateRecordCopy(locale).field as Record<string, string>)[field.value.split(".").pop() || field.value] || field.label;
  };
  const conditionFields: ConditionField[] = fieldsForConditions.map(field => {
    const localized: ConditionField = { ...field, label: fieldLabel(field),
      optionLabels: {
        ...Object.fromEntries(catalog.countries.map(country => [country.value, country.label])),
        ...t.customers.statuses,
        ...t.customers.clientStatuses,
        ...t.tasks.statuses,
        ...t.tasks.priorities,
        ...getUpdateRecordCopy(locale).entity,
        cord_blood: t.customers.serviceTypes.cordBlood,
        cord_tissue: t.customers.serviceTypes.cordTissue,
        both: t.customers.serviceTypes.both,
        ...getCommunicationAnalysisCopy(locale).optionLabels,
        ...getConditionChoiceCopy(locale).values,
      } };
    if (["countryCode", "newValues.countryCode", "newValues.country", "communication.countryCode", "oldValues.country", "oldValues.countryCode"].includes(field.value))
      localized.options = catalog.countries.map(country => country.value);
    if (["newValues.assignedUserId", "newValues.createdByUserId", "newValues.resolvedByUserId", "newValues.agentId", "newValues.assignedAgentId"].includes(field.value)) {
      return { ...localized, options: users.map(user => user.id),
        optionLabels: Object.fromEntries(users.map(user => [user.id, user.fullName || user.email || user.id])) };
    }
    if (draft.module === "communication") {
      return { ...localized,
        ...(selectedEvent === "communication.analyzed" && field.value === "newValues.type" ? { options: ["email", "sms"] } : {}),
        ...(field.value === "newValues.sentiment" ? { options: SENTIMENT_OPTIONS } : {}) };
    }
    if (draft.module !== "task") return localized;
    if (["newValues.assignedUserId", "newValues.createdByUserId", "newValues.resolvedByUserId"].includes(field.value)) {
      return { ...localized, type: "enum", options: users.map(user => user.id),
        optionLabels: Object.fromEntries(users.map(user => [user.id, user.fullName || user.email || user.id])) };
    }
    if (field.value === "newValues.assignedDepartmentId") {
      return { ...localized, type: "enum", options: (departments || []).map(department => department.id),
        optionLabels: Object.fromEntries((departments || []).map(department => [department.id, department.name])) };
    }
    if (["newValues.taskGroupIds", "newValues.resolvedByGroupIds"].includes(field.value)) {
      return { ...localized, options: taskGroups.map(group => group.id),
        optionLabels: Object.fromEntries(taskGroups.map(group => [group.id, group.displayAlias || group.name])),
        help: field.value === "newValues.resolvedByGroupIds" ? t.automationServices.taskRules.resolverGroupHint : undefined };
    }
    if (field.value === "newValues.priority") return { ...localized, optionLabels: t.tasks.priorities };
    if (field.value === "newValues.status") return { ...localized, optionLabels: t.tasks.statuses };
    if (field.value === "newValues.resolvedAt") localized.help = t.automationServices.taskRules.resolvedAtHint;
    return localized;
  });
  const triggerTypeControl = (
    <div>
      <Label>Trigger type</Label>
      <Select
        value={draft.trigger.type}
        onValueChange={(v) => {
          if (v === "schedule") {
            setDraft({ ...draft, conditions: resetSourceConditions(), trigger: { type: "schedule", interval: "hourly" } });
          } else {
            setDraft({
              ...draft,
              conditions: resetSourceConditions(),
              trigger: eventTrigger(draft.module, eventsForModule[0]?.value || "updated"),
            });
          }
        }}
      >
        <SelectTrigger data-testid="select-trigger-type" className="w-64"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="event">Event</SelectItem>
          <SelectItem value="schedule">Schedule (recurring)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
  const eventControls = (
    <div className="space-y-5">
      <fieldset>
        <div role="group" aria-label={t.automationServices.editor.sourceLabel}
          className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {editorModules.map((module) => {
            const Icon = triggerModuleIcons[module.value] || Bell;
            const active = draft.module === module.value;
            return (
              <button
                key={module.value}
                type="button"
                aria-pressed={active}
                aria-label={moduleNames([module.value])}
                data-testid={`select-module-${module.value}`}
                onClick={() => {
                  const nextEvent = module.value === "lead_search" ? LEAD_SEARCH_EVENTS[0] :
                    catalog.eventTypes.find(event => event.value === selectedEvent && event.availableIn.includes(module.value))?.value ||
                    (module.value === "metric" ? "metric.threshold"
                      : module.value === "communication" && draft.trigger.type === "event" && draft.trigger.analysis ? "communication.received"
                        : catalog.eventTypes.find(event => event.availableIn.includes(module.value))?.value) || "updated";
                  setDraft({
                    ...draft,
                    conditions: resetSourceConditions(),
                    module: module.value,
                    trigger: eventTrigger(module.value, nextEvent),
                  });
                }}
                className={`flex min-h-14 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-muted/60"}`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/70">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="truncate">{moduleNames([module.value])}</span>
              </button>
            );
          })}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-medium">{t.automationServices.editor.eventLabel}</legend>
        <p className="mb-2 mt-1 text-xs text-muted-foreground">{t.automationServices.editor.eventHelp}</p>
        <div role="group" aria-label={t.automationServices.editor.eventLabel}
          className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
          {eventsForModule.map((event) => {
            const Icon = triggerEventIcons[event.value] || (analysisResultTrigger(event.value) ? Sparkles : Bell);
            const active = selectedEvent === event.value;
            return (
              <button
                key={event.value}
                type="button"
                aria-pressed={active}
                aria-label={`${eventLabel(event)}. ${eventDescription(event)}`}
                data-testid={`select-event-${event.value}`}
                onClick={() => setDraft({
                  ...draft,
                  conditions: resetSourceConditions(),
                  trigger: draft.module === "communication" ? communicationEventTrigger(event.value, analysisConfig) as EventTriggerDraft
                    : eventTrigger(draft.module, event.value),
                })}
                className={`flex min-h-[76px] items-start gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-muted/60"}`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/70">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{eventLabel(event)}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{eventDescription(event)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
  const invalidCondition = (node: ConditionNode | null): boolean => {
    if (!node) return false;
    if ("not" in node && node.not) return invalidCondition(node.not);
    if ("all" in node && node.all) return node.all.some(invalidCondition);
    if ("any" in node && node.any) return node.any.some(invalidCondition);
    const leaf = node as LeafCondition;
    const field = fieldsForModule.find(f => f.value === leaf.field);
    if (field?.type === "tags") return !["contains", "not_contains"].includes(leaf.op) ||
      typeof leaf.value !== "string" || !leaf.value.trim();
    return !field || !operatorsForModule.some(op => op.value === leaf.op &&
      op.value !== "not_contains" &&
      (field.type !== "list" || ["in", "not_in", "is_null", "is_not_null"].includes(op.value)) &&
      (!op.value.startsWith("changed") || eventsForModule.some(e => e.value === selectedEvent && e.changeSnapshot)) &&
      (!["gt", "gte", "lt", "lte"].includes(op.value) || ["date", "number"].includes(field.type)) &&
      (!["in", "not_in"].includes(op.value) || field.type !== "boolean") &&
      (!["contains", "starts_with"].includes(op.value) || field.type === "string" || (field.type === "list" && op.value === "contains")));
  };
  const hasConditionLeaf = (node: ConditionNode | null): boolean => {
    if (!node) return false;
    if ("field" in node) return Boolean(node.field && node.op);
    if (node.not) return hasConditionLeaf(node.not);
    return Boolean(node.all?.some(hasConditionLeaf) || node.any?.some(hasConditionLeaf));
  };
  const draftEventType = draft.trigger.type === "event" ? draft.trigger.eventType : null;
  const incompatible = automationExecutableActions(draft).some(a => !actionsForModule.some(option => option.value === a.type)) ||
    Boolean(automationBranchIssue(draft.trigger)) ||
    (Boolean(analysisConfig) && analysisConfigIssues(analysisConfig).length > 0) ||
    (draft.trigger.type === "event" && draft.trigger.assignmentTarget != null &&
      !isTaskAssignmentTriggerTarget(draft.trigger.assignmentTarget)) ||
    (draftEventType !== null && !eventsForModule.some(e => e.value === draftEventType)) ||
    invalidCondition(draft.conditions);
  const hasExternalSend = draft.actions.some(action => action.type.startsWith("send_"));
  const onceCountryUnsafe = draft.trigger.type === "schedule" && scheduleMode === "once" &&
    hasExternalSend && (draft.countryCodes?.length ?? 0) !== 1;
  const onceConditionsUnsafe = draft.trigger.type === "schedule" && scheduleMode === "once" && Boolean(draft.conditions);
  const perRecordUnsafe = draft.trigger.type === "schedule" && scheduleMode === "per_record" &&
    (!hasConditionLeaf(draft.conditions) || schedulePreview.status !== "ready" || Boolean(schedulePreview.overLimit) ||
      (schedulePreview.matchedCount ?? 0) > (schedulePreview.maxMatches ?? 0));
  const scheduleUnsafe = onceCountryUnsafe || onceConditionsUnsafe || perRecordUnsafe;

  const emailActionInvalid = (candidate: RuleDraft) => {
    const eventType = candidate.trigger?.type === "event" ? candidate.trigger.eventType : "schedule.tick";
    const fields = [
      ...(catalog.fields?.[candidate.module] || []),
      ...(catalog.fieldsByEvent?.[candidate.module]?.[eventType] || []),
      ...taskSalutationFields(candidate.module, eventType),
      ...ACTIVITY_TEMPLATE_FIELDS,
    ];
    const supportedFields = new Set(fields.map((field) => field.value.replace(/^{{|}}$/g, "")));
    const supportedRecipients = new Set((catalog.recipientTemplatesByEvent?.[candidate.module]?.[eventType] || [])
      .map((field: string) => field.replace(/^{{|}}$/g, "")));
    const checkTokens = (content: string, supported: Set<string>) => {
      const matcher = /{{\s*([^{}]+?)\s*}}/g;
      let match: RegExpExecArray | null;
      while ((match = matcher.exec(content)) !== null) if (!supported.has(match[1].trim())) return false;
      return true;
    };
    return automationExecutableActions(candidate).some((action) => {
      if (action.type === "forward_message")
        return forwardActionIssues(action.config).length > 0;
      if (action.type === "assign_user")
        return action.config?.assignOwnerVersion !== 2 || assignOwnerIssues(action.config, candidate.module).length > 0;
      if (["add_tag", "remove_tag"].includes(action.type))
        return action.config?.recordTagActionVersion !== 2 || tagActionIssues(action.config, candidate.module).length > 0;
      if (action.type !== "send_email" || action.config?.emailActionVersion !== 2) return false;
      const config = action.config || {};
      if (emailActionIssues(config).length) return true;
      if (!String(config.subject ?? "").trim() || !String(config.body ?? "").trim()) return true;
      return !checkTokens(`${config.subject}\n${config.body}`, supportedFields) ||
        !["to", "cc", "bcc"].every((field) => checkTokens(String(config[field] ?? ""), supportedRecipients));
    });
  };
  const hasInvalidEmailDraft = automationExecutableActions(draft).some((action, index) =>
    ["send_email", "send_sms", "forward_message", "update_entity", "add_tag", "remove_tag", "assign_user"].includes(action.type) && emailDraftInvalidByAction[index]);
  const emailActionsInvalid = emailActionInvalid(draft) || hasInvalidEmailDraft;
  const actionNeedsDone = editingAction !== null && editingAction !== "forward_message";
  const recordEmailDraftValidity = (index: number, invalid: boolean) =>
    setEmailDraftInvalidByAction(current => current[index] === invalid ? current : { ...current, [index]: invalid });

  const blockCopy = t.automationBlockEditor;
  const elseActions = automationElseActions(draft.trigger) as ActionNode[];
  const elseMode = pendingElseMode || (draft.trigger.type === "event" && draft.trigger.noMatchActions !== undefined ? "actions"
    : configuredNoMatchRuleId ? "link" : "stop");
  const setElseMode = (mode: string) => {
    if (draft.trigger.type !== "event") return;
    setPendingElseMode(mode === "link" ? "link" : null);
    const { noMatchRuleId: _ruleId, noMatchActions: _actions, ...trigger } = draft.trigger;
    setDraft({ ...draft, trigger: { ...trigger,
      ...(mode === "actions" ? { noMatchActions: elseActions } : {}),
      ...(mode === "link" && configuredNoMatchRuleId ? { noMatchRuleId: configuredNoMatchRuleId } : {}),
    } });
  };
  const actionList = (branch: "then" | "else") => <AutomationBlockActions
    actions={branch === "then" ? draft.actions : elseActions}
    options={actionsForModule.map(option => ({ value: option.value,
      label: (t.automationServices.names as Record<string, string>)[option.value] || option.label }))}
    onEditingChange={setEditingAction}
    createAction={type => ({ type, config: type === "send_email" ? { emailActionVersion: 2, senderMode: "personal" }
      : type === "notify_user" ? { notificationActionVersion: 2 }
      : type === "forward_message" ? { forwardActionVersion: 1, destination: "back_office", mode: "attachments", selection: "invoice" }
      : type === "record_analysis" ? { recordEntryVersion: 1, targetType: "auto", lookup: "sender", mode: "history", title: getRecordEntryCopy(locale).defaultTitle, note: "{{analysis.summary}}" }
      : type === "create_task" && analysisConfig ? { analysisAttachments: "invoice" } : {} })}
    onChange={actions => {
      setEmailDraftInvalidByAction({});
      if (branch === "then") setDraft({ ...draft, actions });
      else if (draft.trigger.type === "event") setDraft({ ...draft, trigger: { ...draft.trigger, noMatchActions: actions } });
    }}
    renderEditor={(action, index, change, remove) => <ActionEditor
      action={action} index={index} sourceModule={draft.module}
      scheduleMode={draft.trigger.type === "schedule" ? scheduleMode || undefined : undefined}
      actionTypes={catalog.actionTypes} supportedActions={actionsForModule.map(option => option.value)}
      recipientTemplates={catalog.recipientTemplatesByEvent?.[draft.module]?.[selectedEvent] || []}
      availableVariables={[...fieldsForConditions, ...taskSalutationFields(draft.module, selectedEvent), ...activityTemplateVariables(locale)].map(({ value, label }) => ({ value, label }))}
      users={users} departments={departments || []} taskGroups={taskGroups} roles={roles}
      countryCodes={draft.countryCodes?.filter((code): code is string => Boolean(code)) || (typeof draft.countryCode === "string" ? [draft.countryCode] : [])}
      ruleId={rule?.id} onEmailDraftValidityChange={invalid => recordEmailDraftValidity(branch === "then" ? index : draft.actions.length + index, invalid)}
      onChange={change} onRemove={remove}/>}
  />;

  const submit = () => {
    if (!leadSelectionValid) return;
    let payload = draft;
    if (isNegativeSentimentRule(payload)) {
      const parsed = readSentimentSources(payload.conditions as AutomationCondition | null);
      if (parsed.editable) payload = { ...payload, conditions: withSentimentSources(parsed.channels, parsed.extra) as ConditionNode };
    }
    if (emailActionInvalid(payload) || hasInvalidEmailDraft) return;
    if (payload.trigger?.type === "schedule") {
      const mode = payload.trigger.mode || "once";
      if (mode !== "once" && mode !== "per_record") {
        toast({ title: t.automationServices.workspace.previewMustBeSafe, variant: "destructive" });
        return;
      }
      const sendsExternally = (payload.actions || []).some((action: ActionNode) => action.type.startsWith("send_"));
      if (mode === "once" && sendsExternally && (payload.countryCodes?.length ?? 0) !== 1) {
        toast({ title: t.automationServices.workspace.onceCountryRequired, variant: "destructive" });
        return;
      }
      if (mode === "once" && payload.conditions) {
        toast({ title: t.automationServices.workspace.onceNoConditions, variant: "destructive" });
        return;
      }
      if (mode === "per_record" && !hasConditionLeaf(payload.conditions)) {
        toast({ title: t.automationServices.workspace.conditionsRequired, variant: "destructive" });
        return;
      }
      if (mode === "per_record" && scheduleUnsafe) {
        toast({ title: t.automationServices.workspace.previewMustBeSafe, variant: "destructive" });
        return;
      }
      if (mode === "per_record") {
        const payloadPreviewInput = JSON.stringify({
          module: payload.module,
          trigger: { type: "schedule", interval: payload.trigger.interval, mode },
          conditions: payload.conditions,
          countryCodes: payload.countryCodes?.length ? payload.countryCodes : null,
          actions: payload.actions,
        });
        if (payloadPreviewInput !== schedulePreviewInput) {
          toast({ title: t.automationServices.workspace.previewMustBeSafe, variant: "destructive" });
          return;
        }
      }
      payload = { ...payload, trigger: { ...payload.trigger, mode } };
    }
    payload = {
      ...payload,
      countryCodes: payload.countryCodes?.length ? payload.countryCodes : null,
      countryCode: null,
    };
    onSave(payload);
  };

  if (!rule && !initialDraft && !selectedService) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="task-modern-modal automation-service-dialog" overlayClassName="task-modern-modal-overlay">
          <TaskModalArtwork variant="create" />
          <DialogHeader><DialogTitle>{t.automationServices.choose}</DialogTitle></DialogHeader>
          <AutomationServiceCatalog catalog={catalog} compact onSelect={selectService} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="task-modern-modal automation-editor-dialog automation-rule-dialog automation-compact-editor max-w-6xl max-h-[88vh]" overlayClassName="task-modern-modal-overlay">
        <TaskModalArtwork variant={rule ? "edit" : "create"} />
        <DialogHeader>
          <div className="automation-workspace-header">
            <div>
              <p className="automation-workspace-eyebrow">{t.automationServices.workspace.ruleLabel}</p>
              <DialogTitle>{rule ? `${t.automationServices.workspace.editRule}: ${rule.name}` : t.automationServices.workspace.newRule}</DialogTitle>
            </div>
          </div>
          {!rule && !initialDraft && selectedService && (
            <DialogDescription>
              {t.automationServices.selected}: {t.automationServices.names[selectedService] || catalog.actionTypes.find(a => a.value === selectedService)?.label || selectedService}
              <Button variant="ghost" className="h-auto px-2 underline" onClick={() => setSelectedService(null)}>
                {t.automationServices.back}
              </Button>
            </DialogDescription>
          )}
        </DialogHeader>

        <Tabs className="automation-editor-tabs" value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="builder" data-testid="tab-builder">Builder</TabsTrigger>
            <TabsTrigger value="flowchart" data-testid="tab-flowchart">{getFlowchartCopy(locale).preview}</TabsTrigger>
          </TabsList>

          <TabsContent value="builder" className="space-y-4 pt-4">
            <div className="automation-workspace" data-testid="automation-workspace">
              <div className="automation-workspace-main">
                <AutomationRuleBasics name={draft.name} description={draft.description}
                  countryCodes={draft.countryCodes} countries={catalog.countries}
                  onNameChange={name => setDraft({ ...draft, name })}
                  onDescriptionChange={description => setDraft({ ...draft, description })}
                  onCountriesChange={countryCodes => setDraft({ ...draft, countryCode: null, countryCodes })} />

                <div className="automation-flow">
                  <div className="automation-flow-spine" aria-hidden="true" />
                <section className="automation-step automation-step-when automation-flow-node" data-testid="rule-source-event">
                  <div className="automation-step-heading">
                    <span className="automation-step-number">01</span>
                    <span className="automation-step-icon" aria-hidden="true"><Bell size={15} /></span>
                      <button type="button" className="automation-step-toggle" aria-expanded={expandedStep === 0}
                        aria-controls="automation-step-when-body" onClick={() => setExpandedStep(expandedStep === 0 ? null : 0)}>
                        <h2>{t.automationServices.workspace.when}</h2><p>{draft.trigger.type === "event"
                          ? `${eventLabel(eventsForModule.find(event => event.value === selectedEvent) || eventsForModule[0] || { value: selectedEvent, label: selectedEvent, availableIn: [], changeSnapshot: false })}${draft.module === "lead_search" && leadCampaignIds.length ? ` · ${leadCampaignIds.map(id => leadCampaigns.find(campaign => campaign.id === id)?.name || `${leadCopy.missing} (${id})`).join(", ")}` : ""}`
                          : t.automationServices.workspace.scheduleModeLabel}</p>
                      </button>
                    <AutomationStepHelp step="when" copy={t.automationEditorHelp} />
                    {draft.module === "call" && <AutomationStepHelp step="call" copy={t.automationEditorHelp} />}
                    <div className="automation-trigger-switch" role="group" aria-label={t.automationServices.workspace.triggerType}>
                      <button type="button" className={draft.trigger.type === "event" ? "active" : ""} aria-pressed={draft.trigger.type === "event"}
                        onClick={() => {
                          if (draft.conditions) setSourceResetNotice(true);
                          setDraft({ ...draft, conditions: null, trigger: { type: "event", entityType: draft.module, eventType: eventsForModule[0]?.value || "updated" } });
                          setExpandedStep(0);
                        }}><Bell className="h-3.5 w-3.5" aria-hidden="true" />{t.automationServices.workspace.eventMode}</button>
                      <button type="button" className={draft.trigger.type === "schedule" ? "active" : ""} aria-pressed={draft.trigger.type === "schedule"}
                        onClick={() => {
                          if (draft.conditions) setSourceResetNotice(true);
                          setDraft({ ...draft, conditions: null, trigger: { type: "schedule", interval: "hourly", mode: "once" } });
                          setExpandedStep(0);
                        }}><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />{t.automationServices.workspace.scheduleModeLabel}</button>
                    </div>
                  </div>
                  <AutomationBlockEditor open={expandedStep === 0} title={t.automationServices.workspace.when}
                    onCancel={cancelBlock} onApply={applyBlock} disabled={Boolean(analysisConfig && analysisConfigIssues(analysisConfig).length) || !leadSelectionValid}>
                  {expandedStep === 0 && <div id="automation-step-when-body">
                    <div className="automation-trigger-switch">
                      <Button type="button" variant={draft.trigger.type === "event" ? "default" : "outline"} onClick={() => {
                        if (draft.conditions) setSourceResetNotice(true);
                        setDraft({ ...draft, conditions: null, trigger: eventTrigger(draft.module, eventsForModule[0]?.value || "updated") });
                      }}>{t.automationServices.workspace.eventMode}</Button>
                      <Button type="button" variant={draft.trigger.type === "schedule" ? "default" : "outline"} onClick={() => {
                        if (draft.conditions) setSourceResetNotice(true);
                        setDraft({ ...draft, conditions: null, trigger: { type: "schedule", interval: "hourly", mode: "once" } });
                      }}>{t.automationServices.workspace.scheduleModeLabel}</Button>
                    </div>
                  {draft.trigger.type === "event" ? (
                    <div className="automation-trigger-controls">
                      <div>
                        <Label>{t.automationServices.editor.sourceLabel}</Label>
                        <Select value={draft.module} onValueChange={module => {
                           const nextEvent = module === "lead_search" ? LEAD_SEARCH_EVENTS[0] :
                             catalog.eventTypes.find(event => event.value === selectedEvent && event.availableIn.includes(module))?.value
                            || catalog.eventTypes.find(event => event.availableIn.includes(module))?.value || "updated";
                          if (draft.conditions) setSourceResetNotice(true);
                           setDraft({ ...draft, module, conditions: null, trigger: eventTrigger(module, nextEvent) });
                        }}>
                          <SelectTrigger data-testid="select-module"><SelectValue /></SelectTrigger>
                          <SelectContent className="automation-rule-select-content">{editorModules.map(module => <SelectItem key={module.value} value={module.value} data-testid={`select-module-${module.value}`}>{moduleNames([module.value])}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>{t.automationServices.editor.eventLabel}</Label>
                        <Select value={selectedEvent} onValueChange={eventType => {
                          if (draft.conditions) setSourceResetNotice(true);
                           setDraft({ ...draft, conditions: null, trigger: draft.module === "communication"
                            ? communicationEventTrigger(eventType, analysisConfig) as EventTriggerDraft
                             : eventTrigger(draft.module, eventType) });
                        }}>
                          <SelectTrigger data-testid="select-event"><SelectValue /></SelectTrigger>
                          <SelectContent className="automation-rule-select-content">{eventsForModule.map(event => {
                             const Icon = triggerEventIcons[event.value] || (analysisResultTrigger(event.value) ? Sparkles : Bell);
                            return <SelectItem key={event.value} value={event.value} textValue={eventLabel(event)} data-testid={`select-event-${event.value}`}>
                              <span className="flex items-center gap-2"><Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />{eventLabel(event)}</span>
                            </SelectItem>;
                          })}</SelectContent>
                        </Select>
                        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground" data-testid="task-event-description">
                          {eventDescription(eventsForModule.find(event => event.value === selectedEvent) || { value: selectedEvent, label: selectedEvent, availableIn: [], changeSnapshot: false })}
                        </p>
                      </div>
                      {draft.module === "task" && selectedEvent === "task.assigned" && <AutomationTaskAssignmentFilter
                        target={draft.trigger.assignmentTarget}
                        groups={taskGroups.map(group => ({ value: group.id, label: group.displayAlias || group.name }))}
                        users={users.map(user => ({ value: user.id, label: user.fullName || user.email || user.id }))}
                        onChange={assignmentTarget => setDraft({ ...draft, trigger: { type: "event", entityType: "task", eventType: "task.assigned", assignmentTarget } })} />}
                      {draft.module === "lead_search" && <AutomationLeadCampaignPicker
                        locale={locale} value={leadCampaignIds} campaigns={leadCampaigns}
                        loading={leadCampaignsQ.isLoading} error={leadCampaignsQ.isError}
                        retryLabel={t.automationOverview.retry}
                        onRetry={() => { void leadCampaignsQ.refetch(); }}
                        onChange={ids => setDraft({ ...draft, trigger: { ...eventTrigger("lead_search", selectedEvent), leadCampaignIds: ids } })}
                      />}
                    </div>
                  ) : (
                    <div className="automation-trigger-controls automation-schedule-controls">
                      <div>
                        <Label>{t.automationServices.workspace.scheduleMode}</Label>
                        <Select value={scheduleMode || "once"} onValueChange={(mode: "once" | "per_record") => {
                          if (draft.conditions) setSourceResetNotice(true);
                          setDraft({
                            ...draft,
                            module: mode === "per_record" && !catalog.schedule?.perRecordModules.includes(draft.module)
                              ? catalog.schedule?.perRecordModules[0] || draft.module : draft.module,
                            conditions: null,
                            trigger: { type: "schedule", interval: draft.trigger.type === "schedule" ? draft.trigger.interval : "hourly", mode },
                          });
                        }}>
                          <SelectTrigger data-testid="select-schedule-mode"><SelectValue /></SelectTrigger>
                          <SelectContent className="automation-rule-select-content">
                            <SelectItem value="once">{t.automationServices.workspace.once}</SelectItem>
                            <SelectItem value="per_record">{t.automationServices.workspace.perRecord}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {scheduleMode === "per_record" && <div>
                        <Label>{t.automationServices.editor.sourceLabel}</Label>
                        <Select value={draft.module} onValueChange={module => {
                          if (draft.conditions) setSourceResetNotice(true);
                          setDraft({ ...draft, module, conditions: null });
                        }}>
                          <SelectTrigger data-testid="select-module"><SelectValue /></SelectTrigger>
                          <SelectContent className="automation-rule-select-content">{catalog.modules.filter(module =>
                            catalog.schedule?.perRecordModules.includes(module.value)
                          ).map(module => <SelectItem key={module.value} value={module.value}>{moduleNames([module.value])}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>}
                      <div>
                        <Label>{t.automationServices.workspace.interval}</Label>
                        <Select value={draft.trigger.interval} onValueChange={interval => setDraft({
                          ...draft,
                          trigger: { type: "schedule", interval, mode: scheduleMode || "once" },
                        })}>
                          <SelectTrigger data-testid="select-schedule-interval"><SelectValue /></SelectTrigger>
                          <SelectContent className="automation-rule-select-content">
                            <SelectItem value="every_5_min">Every 5 minutes</SelectItem><SelectItem value="every_15_min">Every 15 minutes</SelectItem>
                            <SelectItem value="every_30_min">Every 30 minutes</SelectItem><SelectItem value="hourly">Every hour</SelectItem>
                            <SelectItem value="every_6_hours">Every 6 hours</SelectItem><SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                  {draft.trigger.type === "schedule" && <div className={`automation-schedule-note ${scheduleMode === "per_record" ? "warning" : ""}`}>
                    {scheduleMode === "once"
                      ? t.automationServices.workspace.onceHelp
                      : t.automationServices.workspace.perRecordHelp}
                  </div>}
                  {draft.trigger.type === "schedule" && scheduleMode === "once" && hasExternalSend && (
                    <p className="automation-validation" role="alert">{t.automationServices.workspace.onceCountryRequired}</p>
                  )}
                  {sourceResetNotice && <p className="automation-reset-notice" role="status">{t.automationServices.editor.conditionsReset}</p>}
                  {selectedPreset && <AutomationTriggerContext preset={selectedPreset} copy={t.automationServices.triggerPresets} />}
                  {draft.trigger.type === "event" && draft.module === "communication" && isAnalysisServiceEvent(draft.trigger.eventType) && draft.trigger.analysis && (
                    <section className="space-y-4 rounded-xl border border-primary/25 bg-primary/[0.035] p-4" data-testid="communication-analysis-config">
                      <div>
                        <h3 className="text-sm font-semibold">{selectedPreset?.id === "attachmentAnalysis" ? getUnifiedAutomationCopy(locale).attachment : getCommunicationAnalysisCopy(locale).analysisTitle}</h3>
                         <p className="mt-1 text-xs text-muted-foreground">{analysisResultTrigger(selectedEvent)
                           ? analysisResultDescription(locale, selectedEvent) : getCommunicationAnalysisCopy(locale).analysisWhen}</p>
                        <p className="mt-1 text-xs font-medium text-primary">{getUnifiedAutomationCopy(locale).paused}</p>
                      </div>
                      <div className="space-y-2">
                        <Label>{getUnifiedAutomationCopy(locale).channels}</Label>
                        <div className="flex flex-wrap gap-2">
                          {(["email", "sms", "voice", "task", "chat"] as const).map(channel => {
                            const checked = (draft.trigger.type === "event" && draft.trigger.analysis?.channels || []).includes(channel);
                            return <label key={channel} className="flex cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
                              <Checkbox checked={checked} onCheckedChange={value => {
                                const current = draft.trigger.type === "event" ? draft.trigger.analysis?.channels || [] : [];
                                if (!value && current.length === 1) return;
                                updateAnalysisConfig({ channels: value ? [...current, channel] : current.filter((item: string) => item !== channel) });
                              }} />
                              <span>{analysisChannelLabel(locale, channel)}</span>
                            </label>;
                          })}
                        </div>
                      </div>
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="space-y-2">
                          <Label>{getUnifiedAutomationCopy(locale).owners}</Label>
                          <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border bg-background p-2">
                            <label className="flex cursor-pointer items-center gap-2 rounded-md p-2 text-sm hover:bg-muted">
                              <Checkbox checked={analysisConfig?.mailboxMode !== "selected" && !(analysisConfig?.mailboxUserIds || []).length}
                                onCheckedChange={checked => updateAnalysisConfig({ mailboxMode: checked ? "all" : "selected", mailboxUserIds: [] })} />
                              {getUnifiedAutomationCopy(locale).allOwners}
                            </label>
                            {analysisMailboxes.map(user => <label key={user.id} className="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-muted">
                              <Checkbox checked={(analysisConfig?.mailboxUserIds || []).includes(user.id)}
                                onCheckedChange={checked => {
                                  const selected = draft.trigger.type === "event" ? draft.trigger.analysis?.mailboxUserIds || [] : [];
                                  updateAnalysisConfig({ mailboxMode: "selected", mailboxUserIds: checked ? [...selected, user.id] : selected.filter((id: string) => id !== user.id) });
                                }} />
                              <span className="min-w-0 block truncate text-sm">{user.name}</span>
                            </label>)}
                            {!analysisMailboxes.length && <p className="p-2 text-xs text-muted-foreground">{getUnifiedAutomationCopy(locale).noOwnersAvailable}</p>}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="analysis-senders">{getUnifiedAutomationCopy(locale).senderEmails}</Label>
                          <Textarea id="analysis-senders" rows={3} placeholder={getUnifiedAutomationCopy(locale).senderHint}
                          value={(analysisConfig?.senderEmails || []).join(", ")}
                            onChange={event => updateAnalysisConfig({ senderEmails: event.target.value.split(/[,\n]/).map(value => value.trim()).filter(Boolean) })} />
                        </div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="flex min-h-12 items-center gap-3 rounded-lg border bg-background px-3 py-2 text-sm">
                          <Switch checked={draft.trigger.analysis.analyzeContent !== false} disabled={Boolean(analysisResultTrigger(selectedEvent))} onCheckedChange={analyzeContent => updateAnalysisConfig({ analyzeContent })} />
                          {getUnifiedAutomationCopy(locale).content}
                        </label>
                        <label className="flex min-h-12 items-center gap-3 rounded-lg border bg-background px-3 py-2 text-sm">
                          <Switch checked={!!draft.trigger.analysis.analyzeAttachments} onCheckedChange={analyzeAttachments => updateAnalysisConfig({ analyzeAttachments })} />
                          {getUnifiedAutomationCopy(locale).attachments}
                        </label>
                      </div>
                      {draft.trigger.analysis.analyzeAttachments && (
                        <p className="text-xs text-muted-foreground">{getUnifiedAutomationCopy(locale).attachmentFormats}</p>
                      )}
                      <AutomationTextSearchEditor value={draft.trigger.analysis.textSearch}
                        onChange={textSearch => updateAnalysisConfig({ textSearch })}
                        contentEnabled={draft.trigger.analysis.analyzeContent === true}
                        attachmentsEnabled={draft.trigger.analysis.analyzeAttachments === true} />
                    </section>
                  )}
                  {draft.trigger.type === "event" && draft.module === "metric" && draft.trigger.eventType === "metric.threshold" && draft.trigger.metric && (
                    <section className="space-y-4 rounded-xl border border-primary/25 bg-primary/[0.035] p-4" data-testid="metric-monitor-config">
                      <div><h3 className="text-sm font-semibold">{getUnifiedAutomationCopy(locale).metric}</h3><p className="mt-1 text-xs text-muted-foreground">{getUnifiedAutomationCopy(locale).metricInfo}</p><p className="mt-1 text-xs font-medium text-primary">{getUnifiedAutomationCopy(locale).paused}</p></div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2"><Label>{getUnifiedAutomationCopy(locale).metricValue}</Label>
                          <Select value={draft.trigger.metric.metricType} onValueChange={metricType => updateMetricConfig({ metricType })}>
                            <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                              {(catalog.metricTypes || []).map(metric => <SelectItem key={metric.value} value={metric.value}>{getMetricAlertLabel(metric.value, locale) || metric.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2"><Label>{getUnifiedAutomationCopy(locale).frequency}</Label>
                          <Select value={draft.trigger.metric.checkFrequency || "daily"} onValueChange={checkFrequency => updateMetricConfig({ checkFrequency })}>
                            <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                              <SelectItem value="hourly">{getUnifiedAutomationCopy(locale).hourly}</SelectItem>
                              <SelectItem value="every_6_hours">{getUnifiedAutomationCopy(locale).everySixHours}</SelectItem>
                              <SelectItem value="daily">{getUnifiedAutomationCopy(locale).daily}</SelectItem>
                              <SelectItem value="weekly">{getUnifiedAutomationCopy(locale).weekly}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2"><Label htmlFor="metric-threshold">{getUnifiedAutomationCopy(locale).threshold}</Label>
                          <Input id="metric-threshold" type="number" value={(draft.conditions as LeafCondition | null)?.value ?? 0}
                            onChange={event => updateConditions({ field: "newValues.value", op: "gte", value: Number(event.target.value) })} />
                        </div>
                        <div className="space-y-2"><Label htmlFor="metric-cooldown">{getUnifiedAutomationCopy(locale).cooldown}</Label>
                          <Input id="metric-cooldown" type="number" min={1} value={draft.trigger.metric.cooldownMinutes ?? 60}
                            onChange={event => updateMetricConfig({ cooldownMinutes: Math.max(1, Number(event.target.value)) })} />
                        </div>
                      </div>
                    </section>
                  )}
                  {sentimentRule && (sentimentSources?.editable
                      ? <SentimentSourcePicker selected={sentimentSources.channels} onToggle={toggleSentimentSource} copy={t.automationServices.sentimentSources} />
                    : <p className="automation-reset-notice">{t.automationServices.sentimentSources.advancedSelection}</p>)}
                  </div>}
                  </AutomationBlockEditor>
                </section>

                <div className="automation-logic-grid">
                  <section className="automation-step automation-step-if automation-flow-node" data-testid="automation-if-step">
                    <div className="automation-step-heading">
                      <span className="automation-step-number">02</span>
                      <span className="automation-step-icon" aria-hidden="true"><ListFilter size={15} /></span>
                      <button type="button" className="automation-step-toggle" aria-expanded={expandedStep === 1}
                        aria-controls="automation-step-if-body" onClick={() => setExpandedStep(expandedStep === 1 ? null : 1)}>
                        <h2>{t.automationServices.workspace.if}</h2><p>{hasConditionLeaf(draft.conditions)
                          ? t.automationServices.workspace.conditionsAdded
                          : t.automationServices.workspace.noConditions}</p>
                      </button>
                      <AutomationStepHelp step="if" copy={t.automationEditorHelp} />
                      {scheduleMode === "once" && draft.trigger.type === "schedule"
                        ? <>{draft.conditions && <Button size="sm" variant="ghost" onClick={() => updateConditions(null)}>
                            <X className="h-3.5 w-3.5 mr-1" />{t.automationServices.workspace.remove}
                          </Button>}<span className="automation-muted-note">{t.automationServices.workspace.noIfOnce}</span></>
                        : visibleConditions
                          ? <Button size="sm" variant="ghost" onClick={() => updateConditions(null)}><X className="h-3.5 w-3.5 mr-1" />{t.automationServices.workspace.remove}</Button>
                          : <Button size="sm" variant="outline" onClick={() => {
                              updateConditions({ all: [{ field: (sentimentRule ? fieldsForConditions.find(field => field.value === "newValues.sentiment") : null)?.value || fieldsForConditions[0]?.value || "", op: "eq", value: "" }] });
                              setExpandedStep(1);
                            }}
                            disabled={!fieldsForConditions.length} data-testid="button-add-conditions"><Plus className="h-3.5 w-3.5 mr-1" />{t.automationServices.conditionEditor.addCondition}</Button>}
                    </div>
                    <AutomationBlockEditor open={expandedStep === 1} title={t.automationServices.workspace.if}
                      onCancel={cancelBlock} onApply={applyBlock} disabled={invalidCondition(draft.conditions)}>
                    {expandedStep === 1 && <div id="automation-step-if-body">{draft.trigger.type === "schedule" && scheduleMode === "once" ? <p className="automation-inline-note">{t.automationServices.workspace.noIfOnce}</p> : <>
                      {!fieldsForConditions.length && <p className="automation-inline-note">{t.automationCatalog.noFields}</p>}
                      {invalidCondition(draft.conditions) && <p className="automation-validation">{t.automationCatalog.unavailableHere}</p>}
                      {scheduleMode === "per_record" && !hasConditionLeaf(draft.conditions) && <p className="automation-validation">{t.automationServices.workspace.conditionsRequired}</p>}
                      {visibleConditions && <ConditionsEditor
                        node={visibleConditions}
                        fields={conditionFields}
                        sourceModule={draft.module} countryCodes={draft.countryCodes?.filter((code): code is string => Boolean(code)) || (typeof draft.countryCode === "string" ? [draft.countryCode] : [])}
                        eventType={selectedEvent}
                        operators={operatorsForModule.filter(op =>
                          (!op.value.startsWith("changed") || eventsForModule.some(event => event.value === selectedEvent && event.changeSnapshot)))}
                        onChange={updateConditions}
                      />}
                    </>}</div>}
                    </AutomationBlockEditor>
                  </section>
                  <section className="automation-step automation-step-then automation-flow-node" data-testid="automation-then-step">
                    <span className="automation-branch-label">{blockCopy.yes}</span>
                    <div className="automation-step-heading">
                      <span className="automation-step-number">03</span>
                      <span className="automation-step-icon" aria-hidden="true"><Sparkles size={15} /></span>
                      <button type="button" className="automation-step-toggle" aria-expanded={expandedStep === 2}
                        aria-controls="automation-step-then-body" onClick={() => setExpandedStep(expandedStep === 2 ? null : 2)}>
                        <h2>{t.automationServices.workspace.then}</h2><p>{draft.actions.length} · {t.automationServices.workspace.actionCount} · {draft.actions.map(action => (t.automationServices.names as Record<string, string>)[action.type] || catalog.actionTypes.find(option => option.value === action.type)?.label || action.type).join(" → ")}</p>
                      </button>
                      <AutomationStepHelp step="then" copy={t.automationEditorHelp} />
                      <Button size="sm" variant="outline" onClick={() => setExpandedStep(2)}
                        data-testid="button-add-action"><Settings2 className="h-3.5 w-3.5 mr-1" />{blockCopy.edit}</Button>
                    </div>
                    <AutomationBlockEditor open={expandedStep === 2} title={t.automationServices.workspace.then}
                      onCancel={cancelBlock} onApply={applyBlock} disabled={actionNeedsDone || emailActionsInvalid || incompatible}>
                      {expandedStep === 2 && actionList("then")}
                    </AutomationBlockEditor>
                  </section>
                  <section className="automation-step automation-step-else automation-flow-node" data-testid="automation-else-step">
                    <span className="automation-branch-label">{blockCopy.no}</span>
                    <div className="automation-step-heading">
                      <span className="automation-step-number">04</span>
                      <button type="button" className="automation-step-toggle" onClick={() => setExpandedStep(3)} data-testid="button-edit-else">
                        <h2>{blockCopy.else}</h2><p>{elseMode === "actions" ? `${elseActions.length} · ${t.automationServices.workspace.actionCount}`
                          : elseMode === "link" ? `${blockCopy.link} · ${rules.find(target => target.id === configuredNoMatchRuleId)?.name || noMatchCopy.unavailable}` : blockCopy.stop}</p>
                      </button>
                      <Button size="sm" variant="outline" onClick={() => setExpandedStep(3)}>{blockCopy.edit}</Button>
                    </div>
                    <AutomationBlockEditor open={expandedStep === 3} title={blockCopy.else} onCancel={cancelBlock} onApply={applyBlock}
                      disabled={actionNeedsDone || emailActionsInvalid || Boolean(automationBranchIssue(draft.trigger)) ||
                        (elseMode === "link" && !configuredNoMatchRuleId)}>
                      {expandedStep === 3 && (draft.trigger.type === "schedule" ? <p>{blockCopy.schedule}</p> : <>
                        <div className="automation-else-modes">
                          {(["stop", "actions", ...(analysisConfig ? ["link"] : [])] as string[]).map(mode => <label key={mode}>
                            <input type="radio" name="automation-else-mode" checked={elseMode === mode} disabled={mode === "link" && !noMatchTargets.length}
                              onChange={() => setElseMode(mode)}/>
                            <span>{mode === "stop" ? blockCopy.stop : mode === "actions" ? blockCopy.actions : blockCopy.link}</span>
                          </label>)}
                        </div>
                        {elseMode === "actions" && actionList("else")}
                        {elseMode === "link" && <div className="space-y-3">
                          <Input placeholder={blockCopy.search} value={elseSearch} onChange={event => setElseSearch(event.target.value)}/>
                          {noMatchTargets.filter(target => target.name.toLocaleLowerCase().includes(elseSearch.toLocaleLowerCase())).map(target =>
                            <Button type="button" className="w-full justify-start" variant={configuredNoMatchRuleId === target.id ? "default" : "outline"} key={target.id}
                              onClick={() => { if (draft.trigger.type === "event") setDraft({ ...draft, trigger: { ...draft.trigger, noMatchRuleId: target.id } }); }}>{target.name}</Button>)}
                          {!noMatchTargets.length && <p>{blockCopy.unavailable}</p>}
                          <p className="text-xs text-muted-foreground">{blockCopy.linkHelp}</p>
                        </div>}
                        <p className="text-xs text-muted-foreground mt-4">{blockCopy.unknown}</p>
                      </>)}
                    </AutomationBlockEditor>
                  </section>
                </div>
                </div>
                {onceCountryUnsafe && <p className="automation-validation" role="alert">{t.automationServices.workspace.onceCountryRequired}</p>}
                <section className="automation-advanced">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-sm">{blockCopy.settings}</strong>
                    <Button type="button" variant="outline" size="sm" onClick={() => setExpandedStep(4)}>{blockCopy.edit}</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{draft.enabled ? blockCopy.stateOn : blockCopy.stateOff} · {draft.rateLimitPerHour || "∞"}</p>
                  <AutomationBlockEditor open={expandedStep === 4} title={blockCopy.settings}
                    onCancel={cancelBlock} onApply={applyBlock}>
                    <AutomationRuleExecutionSettings rateLimit={draft.rateLimitPerHour} enabled={draft.enabled} disabled={scheduleUnsafe || incompatible}
                      onRateLimitChange={rateLimitPerHour => setDraft({ ...draft, rateLimitPerHour })}
                      onEnabledChange={enabled => setDraft({ ...draft, enabled })} />
                  </AutomationBlockEditor>
                </section>
              </div>
              <details open className="automation-preview-panel" data-testid="automation-preview-panel">
                <summary>{t.automationServices.workspace.preview}</summary>
              <aside className="automation-preview-rail">
                <div className="automation-preview-card">
                  <div className="automation-preview-title"><h2>{inspectorTab === "summary" ? t.automationServices.workspace.preview : t.automationServices.workspace.dryRun}</h2><Sparkles size={17} /></div>
                  <div className="automation-inspector-tabs" role="group" aria-label={t.automationServices.workspace.preview}>
                    <button type="button" aria-pressed={inspectorTab === "summary"} className={inspectorTab === "summary" ? "active" : ""}
                      onClick={() => setInspectorTab("summary")}>{t.automationServices.workspace.preview}</button>
                    <button type="button" aria-pressed={inspectorTab === "test"} className={inspectorTab === "test" ? "active" : ""}
                      onClick={() => setInspectorTab("test")}>{t.automationServices.workspace.dryRun}</button>
                  </div>
                  {inspectorTab === "summary" ? <>
                  <strong className="automation-preview-name">{draft.name || t.automationServices.workspace.unnamedRule}</strong>
                  <p className="automation-preview-country">{draft.countryCodes?.length
                    ? draft.countryCodes.map(code => countryNames.of(code) || code).join(" · ")
                    : t.automationServices.editor.allCountries}</p>
                  <div className="automation-preview-flow">
                    <div className="automation-effect-node cause"><span className="automation-effect-dot">01</span><div><small>{t.automationServices.workspace.when}</small><b>{draft.trigger.type === "event"
                      ? eventLabel(eventsForModule.find(event => event.value === selectedEvent) || eventsForModule[0] || { value: selectedEvent, label: selectedEvent, availableIn: [], changeSnapshot: false })
                      : t.automationServices.workspace.scheduleModeLabel}</b><em>{draft.module && moduleNames([draft.module])}</em></div></div>
                    <div className="automation-effect-connector" aria-hidden="true"><span /></div>
                    <div className="automation-effect-node filter"><span className="automation-effect-dot">02</span><div><small>{t.automationServices.workspace.if}</small><b>{scheduleMode === "once" && draft.trigger.type === "schedule"
                      ? t.automationServices.workspace.noIfOnce
                      : hasConditionLeaf(draft.conditions) ? t.automationServices.workspace.conditionsAdded : t.automationServices.workspace.noConditions}</b></div></div>
                    <div className="automation-effect-connector" aria-hidden="true"><span /></div>
                    <div className="automation-preview-branches">
                      <div className="automation-effect-node outcome"><span className="automation-effect-dot">03</span><div><small>{blockCopy.yes}</small><b>{draft.actions.length} · {t.automationServices.workspace.actionCount}</b></div></div>
                      <div className="automation-effect-node outcome"><span className="automation-effect-dot">04</span><div><small>{blockCopy.no}</small><b>{elseMode === "actions" ? `${elseActions.length} · ${t.automationServices.workspace.actionCount}` : elseMode === "link" ? blockCopy.link : blockCopy.stop}</b></div></div>
                    </div>
                  </div>
                  {draft.trigger.type === "schedule" && scheduleMode === "per_record" && (
                    <section className={`automation-preview-status ${schedulePreview.status === "error" || schedulePreview.overLimit ||
                      (schedulePreview.matchedCount ?? 0) > (schedulePreview.maxMatches ?? 0) ? "unsafe" : ""}`} aria-live="polite">
                      <strong>{t.automationServices.workspace.schedulePreview}</strong>
                      {schedulePreview.status === "pending" && <p>{t.automationServices.workspace.previewPending}</p>}
                      {schedulePreview.status === "error" && <p>{t.automationServices.workspace.previewError}</p>}
                      {schedulePreview.status === "ready" && (
                        <p>{t.automationServices.workspace.previewCount
                          .replace("{count}", String(schedulePreview.matchedCount))
                          .replace("{max}", String(schedulePreview.maxMatches))}
                          {(schedulePreview.overLimit || (schedulePreview.matchedCount ?? 0) > (schedulePreview.maxMatches ?? 0))
                            ? ` ${t.automationServices.workspace.previewOverLimit}` : ""}
                        </p>
                      )}
                      <p className="automation-serious-warning">{t.automationServices.workspace.matchWarning}</p>
                    </section>
                  )}
                  <Badge className={draft.enabled && !scheduleUnsafe ? "automation-enabled-badge" : "automation-paused-badge"}>
                    {draft.enabled && !scheduleUnsafe ? t.automationServices.workspace.enabled : t.automationServices.workspace.paused}
                  </Badge>
                  {scheduleUnsafe && <p className="automation-validation">{t.automationServices.workspace.previewMustBeSafe}</p>}
                  </> : <div className="automation-inspector-test">
                    <p>{!rule ? t.automationServices.workspace.dryRunSaveFirst : draft.trigger.type !== "event"
                      ? t.automationServices.workspace.dryRunEventOnly : t.automationServices.workspace.dryRunHint}</p>
                    <Button type="button" variant="outline" onClick={() => setShowTest(true)}
                      disabled={!rule || draft.trigger.type !== "event"} data-testid="button-open-dryrun-inspector">
                      {t.automationServices.workspace.dryRun}
                    </Button>
                  </div>}
                </div>
              </aside>
              </details>
            </div>
            {false && <div className="automation-legacy-builder" aria-hidden="true">
            <p className="text-xs text-muted-foreground">{t.automationCatalog.statusListPending}</p>
            {/* Basics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Name *</Label>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="e.g. Notify manager when high-priority task created"
                  data-testid="input-rule-name"
                />
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                <Label>{t.automationServices.editor.countryScope}</Label>
                <p className="mt-1 text-xs text-muted-foreground">{t.automationServices.editor.countryScopeHelp}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={!draft.countryCodes?.length ? "default" : "outline"}
                    aria-pressed={!draft.countryCodes?.length}
                    onClick={() => setDraft({ ...draft, countryCode: null, countryCodes: null })}
                    data-testid="select-country-all"
                  >
                    {t.automationServices.editor.allCountries}
                  </Button>
                  {catalog.countries.map((country) => {
                    const selected = draft.countryCodes?.includes(country.value) ?? false;
                    const regionCode = country.value.trim().toUpperCase();
                    const localizedName = countryNames.of(regionCode);
                    const countryLabel = localizedName && localizedName.toUpperCase() !== regionCode
                      ? localizedName
                      : country.label;
                    return (
                      <Button
                        key={country.value}
                        type="button"
                        size="sm"
                        variant={selected ? "secondary" : "outline"}
                        aria-pressed={selected}
                        onClick={() => {
                          const next = selected
                            ? (draft.countryCodes || []).filter(code => code !== country.value)
                            : [...(draft.countryCodes || []), country.value];
                          setDraft({ ...draft, countryCode: null, countryCodes: next.length ? next : null });
                        }}
                        data-testid={`select-country-${country.value}`}
                      >
                        {countryLabel}
                      </Button>
                    );
                  })}
                </div>
              </div>
              <div className="md:col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  rows={2}
                  data-testid="textarea-rule-description"
                />
              </div>
            </div>

            {draft.trigger.type === "event" && (
              <Card data-testid="rule-source-event">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">{t.automationServices.editor.sourceLabel}</CardTitle>
                  <CardDescription>{t.automationServices.editor.sourceHelp}</CardDescription>
                </CardHeader>
                <CardContent>{eventControls}</CardContent>
              </Card>
            )}

            {/* Trigger */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{t.automationServices.editor.whenServiceRuns}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {triggerTypeControl}

                 {draft.trigger.type === "event" && (
                   <div className="space-y-3" data-testid="rule-trigger-presets">
                      <div>
                        <Label>{t.automationServices.triggerPresets.heading}</Label>
                        <p className="mt-1 text-xs text-muted-foreground">{t.automationServices.triggerPresets.info}</p>
                      </div>
                     <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                        {AUTOMATION_TRIGGER_PRESETS.filter(preset =>
                          catalog.eventTypes.some(event => event.value === preset.eventType && event.availableIn.includes(preset.module)) ||
                          preset.id === "attachmentAnalysis" || preset.id === "metricMonitor" ||
                          (preset.id === "contentAnalysis" && !!analysisConfig)
                       ).map((preset: AutomationTriggerPreset) => {
                          const Icon = triggerPresetIcons[preset.id];
                          const active = draft.module === preset.module && selectedEvent === preset.eventType &&
                            (preset.id === "attachmentAnalysis" ? !!analysisConfig?.analyzeAttachments
                              : preset.id === "contentAnalysis" ? !!analysisConfig && !analysisConfig.analyzeAttachments
                                : true);
                         return (
                           <button key={preset.id} type="button" aria-pressed={active}
                             className={`flex min-h-14 min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-muted/60"}`}
                              onClick={() => {
                                 let next = chooseTriggerPreset(draft, preset);
                                 if (preset.id === "contentAnalysis" || preset.id === "attachmentAnalysis") {
                                   const unified = getUnifiedAutomationCopy(locale);
                                   const title = preset.id === "attachmentAnalysis" ? unified.attachment : getCommunicationAnalysisCopy(locale).analysisTitle;
                                   const analysisDraft = createAnalysisServiceDraft(
                                     preset.id === "attachmentAnalysis" ? "attachment_analysis" : "communication_analysis",
                                     title,
                                     preset.id === "attachmentAnalysis" ? unified.attachmentInfo : getCommunicationAnalysisCopy(locale).analysisDescription,
                                   );
                                   next = { ...next, module: analysisDraft.module, enabled: false, trigger: analysisDraft.trigger };
                                 } else if (preset.id === "metricMonitor") {
                                   const unified = getUnifiedAutomationCopy(locale);
                                   const metricDraft = createMetricServiceDraft({
                                     name: unified.metric, description: unified.metricInfo,
                                     metricType: catalog.metricTypes?.[0]?.value || "pending_lab_results",
                                     checkFrequency: "daily", cooldownMinutes: 60, threshold: 0,
                                   });
                                   next = { ...next, module: metricDraft.module, enabled: false, trigger: metricDraft.trigger, conditions: metricDraft.conditions };
                                 }
                                if (preset.id !== "negativeSentiment" &&
                                  (draft.module !== preset.module || selectedEvent !== preset.eventType) && draft.conditions) {
                                  setSourceResetNotice(true);
                                  next.conditions = null;
                                }
                                setDraft(next);
                              }}
                             data-testid={`select-trigger-preset-${preset.id}`}>
                             <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                              <span>{preset.id === "contentAnalysis" ? getCommunicationAnalysisCopy(locale).analysisTitle
                                : preset.id === "attachmentAnalysis" ? getUnifiedAutomationCopy(locale).attachment
                                  : preset.id === "metricMonitor" ? getUnifiedAutomationCopy(locale).metric
                                    : t.automationServices.triggerPresets.labels[preset.id]}</span>
                           </button>
                         );
                       })}
                     </div>
                   </div>
                 )}

                  {sourceResetNotice && (
                    <div role="status" className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-foreground">
                      {t.automationServices.editor.conditionsReset}
                    </div>
                  )}
                  {selectedPreset && <AutomationTriggerContext preset={selectedPreset!} copy={t.automationServices.triggerPresets} />}
                 {sentimentRule && (
                   sentimentSources?.editable
                      ? <SentimentSourcePicker selected={sentimentSources!.channels} onToggle={toggleSentimentSource} copy={t.automationServices.sentimentSources} />
                     : <p className="rounded-md border border-amber-400/40 bg-amber-500/5 p-3 text-xs text-foreground">{t.automationServices.sentimentSources.advancedSelection}</p>
                 )}
                 {draft.trigger.type === "schedule" && (
                  <div>
                    <Label>Run interval</Label>
                    <Select
                      value={(draft.trigger as any).interval}
                      onValueChange={(v) =>
                        setDraft({ ...draft, trigger: { type: "schedule", interval: v } })
                      }
                    >
                      <SelectTrigger data-testid="select-schedule-interval" className="w-64"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="every_5_min">Every 5 minutes</SelectItem>
                        <SelectItem value="every_15_min">Every 15 minutes</SelectItem>
                        <SelectItem value="every_30_min">Every 30 minutes</SelectItem>
                        <SelectItem value="hourly">Every hour</SelectItem>
                        <SelectItem value="every_6_hours">Every 6 hours</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-2">
                      Schedule triggers fire on a recurring tick. Conditions still apply against the chosen module's data.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Conditions */}
             <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Only if (Conditions)</CardTitle>
                 {!visibleConditions ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!fieldsForConditions.length}
                     onClick={() => updateConditions({ all: [{
                       field: (sentimentRule ? fieldsForConditions.find(field => field.value === "newValues.sentiment") : null)?.value || fieldsForConditions[0].value,
                       op: "eq", value: "",
                     }] })}
                    data-testid="button-add-conditions"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add conditions
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                     onClick={() => updateConditions(null)}
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    Remove
                  </Button>
                )}
              </CardHeader>
              {!fieldsForConditions.length && <p className="px-6 pb-3 text-xs text-muted-foreground">{t.automationCatalog.noFields}</p>}
              {invalidCondition(draft.conditions) && <p className="px-6 pb-3 text-xs text-destructive">{t.automationCatalog.unavailableHere}</p>}
               {visibleConditions && (
                <CardContent>
                  <ConditionsEditor
                      node={visibleConditions!}
                    fields={conditionFields}
                    sourceModule={draft.module} countryCodes={(draft.countryCodes?.filter((code): code is string => Boolean(code)) || (typeof draft.countryCode === "string" ? [draft.countryCode] : [])) as string[]}
                    eventType={selectedEvent}
                    operators={operatorsForModule.filter(op =>
                      (!op.value.startsWith("changed") || eventsForModule.some(e => e.value === selectedEvent && e.changeSnapshot)))}
                     onChange={updateConditions}
                  />
                </CardContent>
              )}
            </Card>

            {/* Actions */}
            {noMatchControl}
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Then do (Actions)</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      actions: [...draft.actions, { type: "notify_user", config: { notificationActionVersion: 2 } }],
                    })
                  }
                  data-testid="button-add-action"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add action
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {draft.actions.length === 0 && (
                  <div className="text-xs text-muted-foreground">No actions yet.</div>
                )}
                {draft.actions.map((a, i) => (
                  <ActionEditor
                    key={i}
                    sourceModule={draft.module}
                    scheduleMode={draft.trigger.type === "schedule" ? scheduleMode || undefined : undefined}
                    action={a}
                    index={i}
                    actionTypes={catalog.actionTypes}
                    supportedActions={actionsForModule.map(a => a.value)}
                    recipientTemplates={catalog.recipientTemplatesByEvent?.[draft.module]?.[selectedEvent] || []}
                    availableVariables={[...fieldsForConditions, ...taskSalutationFields(draft.module, selectedEvent), ...activityTemplateVariables(locale)].map(({ value, label }) => ({ value, label }))}
                    users={users}
                    departments={departments || []}
                    taskGroups={taskGroups}
                    roles={roles}
                    countryCodes={draft.countryCodes?.filter((code): code is string => Boolean(code)) || (typeof draft.countryCode === "string" ? [draft.countryCode] : [])}
                    onEmailDraftValidityChange={invalid => recordEmailDraftValidity(i, invalid)}
                    ruleId={rule?.id}
                    onChange={(updated) => {
                      const next = [...draft.actions];
                      next[i] = updated;
                      setDraft({ ...draft, actions: next });
                    }}
                    onRemove={() => {
                      const next = [...draft.actions];
                      next.splice(i, 1);
                      setDraft({ ...draft, actions: next });
                    }}
                  />
                ))}
                {incompatible && <p className="text-xs text-destructive">{t.automationCatalog.unavailableHere}</p>}
              </CardContent>
            </Card>

            {/* Advanced */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Advanced</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <AutomationRuleExecutionSettings rateLimit={draft.rateLimitPerHour} enabled={draft.enabled}
                  onRateLimitChange={rateLimitPerHour => setDraft({ ...draft, rateLimitPerHour })}
                  onEnabledChange={enabled => setDraft({ ...draft, enabled })} />
              </CardContent>
            </Card>
            </div>}
          </TabsContent>

          <TabsContent value="flowchart" className="pt-4">
            <AutomationFlowPreview rule={draft} catalog={catalog} users={users}
              taskGroups={taskGroups} roles={roles} departments={departments || []} rules={rules} leadCampaigns={leadCampaigns} />
          </TabsContent>
        </Tabs>

        {rule && <AutomationEligibilityDiagnostic key={`${rule.id}:${rule.updatedAt}`} rules={[rule]} ruleId={rule.id}/>}
        <DialogFooter className="task-modern-modal-footer automation-dialog-footer">
          <Button
            variant="outline"
            onClick={() => setShowTest(true)}
            disabled={!rule || draft.trigger.type !== "event"}
            title={!rule ? t.automationServices.workspace.dryRunSaveFirst : draft.trigger.type !== "event"
              ? t.automationServices.workspace.dryRunEventOnly : t.automationServices.workspace.dryRunHint}
            data-testid="button-open-dryrun"
          >
            {t.automationServices.workspace.dryRun}
          </Button>
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose}>{t.common.cancel}</Button>
          <Button onClick={submit} disabled={saving || scheduleUnsafe || incompatible || emailActionsInvalid || !leadSelectionValid} data-testid="button-save-rule">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t.automationServices.workspace.save}
          </Button>
        </DialogFooter>
      </DialogContent>

      {rule && (
        <DryRunDialog
          open={showTest}
          rule={rule}
          draft={draft}
          onClose={() => setShowTest(false)}
        />
      )}
    </Dialog>
  );
}

/* ----------------- Dry-run dialog ----------------- */
function DryRunDialog({
  open,
  rule,
  draft,
  onClose,
}: {
  open: boolean;
  rule: Rule;
  draft: RuleDraft;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const sampleDefault = JSON.stringify(
    {
      entityType: rule.module,
      entityId: "sample-id-123",
      eventType: (draft.trigger as any).eventType || "updated",
      newValues: { status: "in_progress", title: "Sample task" },
      oldValues: { status: "pending", title: "Sample task" },
      countryCode: rule.countryCode || "SK",
    },
    null,
    2,
  );
  const [sampleText, setSampleText] = useState(sampleDefault);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (open) {
      setSampleText(sampleDefault);
      setResult(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rule.id]);

  const runTest = async () => {
    let sampleEvent: any;
    try {
      sampleEvent = JSON.parse(sampleText);
    } catch (e: any) {
      toast({ title: "Invalid JSON", description: e.message, variant: "destructive" });
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      const res = await apiRequest("POST", `/api/automation/rules/${rule.id}/test`, { sampleEvent });
      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      toast({ title: "Dry-run failed", description: e?.message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="task-modern-modal task-modern-modal--nested automation-dryrun-dialog max-w-3xl max-h-[90vh] overflow-y-auto" overlayClassName="task-modern-modal-overlay task-modern-modal-overlay--nested">
        <TaskModalArtwork variant="detail" />
        <DialogHeader>
          <DialogTitle>Dry-run: {rule.name}</DialogTitle>
          <DialogDescription>
            Test conditions and see rendered action configs WITHOUT executing actions or writing to run history.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Sample event (JSON)</Label>
            <Textarea
              rows={10}
              className="text-xs font-mono"
              value={sampleText}
              onChange={(e) => setSampleText(e.target.value)}
              data-testid="textarea-dryrun-sample"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Tweak <code>newValues</code> / <code>oldValues</code> to simulate different field changes. The
              engine evaluates conditions against this payload.
            </p>
          </div>

          <Button onClick={runTest} disabled={running} data-testid="button-run-dryrun">
            {running && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Run dry-run
          </Button>

          {result && (
            <div className="space-y-3 border-t pt-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Conditions:</span>
                <Badge variant={result.conditionMet ? "default" : "secondary"} data-testid="badge-condition-result">
                  {result.branch === "else" ? t.automationBlockEditor.else : result.conditionMet === null
                    ? t.automationBlockEditor.unknown : result.conditionMet ? t.automationBlockEditor.yes : t.automationBlockEditor.stop}
                </Badge>
              </div>

              <div>
                <div className="text-sm font-semibold mb-1">
                  {t.automationBlockEditor.order} ({result.actions?.length || 0})
                </div>
                <div className="space-y-2">
                  {(result.actions || []).map((a: any, i: number) => (
                    <div key={i} className="border rounded p-2 bg-muted/30" data-testid={`dryrun-action-${i}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px]">#{i + 1}</Badge>
                        <span className="text-xs font-mono font-semibold">{a.type}</span>
                      </div>
                      <pre className="text-[10px] bg-background p-2 rounded overflow-auto">
                        {JSON.stringify(a.rendered, null, 2)}
                      </pre>
                    </div>
                  ))}
                  {(!result.actions || result.actions.length === 0) && (
                    <div className="text-xs text-muted-foreground italic">No actions configured.</div>
                  )}
                </div>
              </div>

              <details>
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  Raw evaluation context (for debugging templates)
                </summary>
                <pre className="text-[10px] bg-muted p-2 rounded overflow-auto max-h-60 mt-1">
                  {JSON.stringify(result.ctx, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>

        <DialogFooter className="task-modern-modal-footer">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------- Conditions ----------------- */
function ConditionsEditor({
  node,
  fields,
  operators,
  onChange,
  depth = 0,
  sourceModule = "",
  eventType = "",
  countryCodes = [],
}: {
  node: ConditionNode;
  fields: ConditionField[];
  operators: Catalog["operators"];
  onChange: (n: ConditionNode) => void;
  depth?: number;
  sourceModule?: string;
  eventType?: string;
  countryCodes?: string[];
}) {
  const { t, locale } = useI18n();
  const copy = t.automationServices.conditionEditor;
  const isGroup = "all" in (node as any) || "any" in (node as any);
  const isNot = "not" in (node as any);

  if (isNot) {
    return (
      <div className={`border-l-4 border-rose-300 dark:border-rose-700 pl-3 py-1 space-y-2`}>
        <div className="flex items-center gap-2 text-xs font-medium">
          {copy.not}
          <Button size="sm" variant="ghost" onClick={() => onChange((node as any).not)} className="h-6 text-xs">
            {copy.unwrapNot}
          </Button>
        </div>
        <ConditionsEditor
          node={(node as any).not}
          fields={fields}
          operators={operators}
          onChange={(c) => onChange({ not: c })}
          depth={depth + 1}
          sourceModule={sourceModule} eventType={eventType} countryCodes={countryCodes}
        />
      </div>
    );
  }

  if (isGroup) {
    const isAll = "all" in (node as any);
    const items: ConditionNode[] = (node as any)[isAll ? "all" : "any"];
    const update = (next: ConditionNode[]) =>
      onChange(isAll ? { all: next } : { any: next });

    return (
      <div className={`border-l-4 ${isAll ? "border-blue-300 dark:border-blue-700" : "border-amber-300 dark:border-amber-700"} pl-3 py-1 space-y-2`}>
        <div className="flex items-center gap-2 text-xs">
          <Select
            value={isAll ? "all" : "any"}
            onValueChange={(v) => onChange(v === "all" ? { all: items } : { any: items })}
          >
            <SelectTrigger aria-label={copy.conditionMode} className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{copy.allOf}</SelectItem>
              <SelectItem value="any">{copy.anyOf}</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" className="h-7 text-xs"
            aria-label={copy.addCondition}
            onClick={() => update([...items, { field: fields[0]?.value || "", op: "eq", value: "" }])}>
            <Plus className="h-3 w-3 mr-1" /> {copy.addCondition}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs"
            aria-label={copy.addGroup}
            onClick={() => update([...items, { all: [{ field: fields[0]?.value || "", op: "eq", value: "" }] }])}>
            <Plus className="h-3 w-3 mr-1" /> {copy.addGroup}
          </Button>
          {depth > 0 && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" aria-label={copy.wrapNot}
              onClick={() => onChange({ not: node })}>
              {copy.wrapNot}
            </Button>
          )}
        </div>
        {items.length === 0 && <div className="text-xs text-muted-foreground">{copy.emptyGroup}</div>}
        {items.map((child, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="flex-1">
              <ConditionsEditor
                node={child}
                fields={fields}
                operators={operators}
                onChange={(c) => {
                  const next = [...items];
                  next[i] = c;
                  update(next);
                }}
                depth={depth + 1}
                sourceModule={sourceModule} eventType={eventType} countryCodes={countryCodes}
              />
            </div>
            <Button size="icon" variant="ghost" className="h-7 w-7"
              onClick={() => {
                const next = [...items];
                next.splice(i, 1);
                update(next);
              }}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    );
  }

  // Leaf
  const leaf = node as LeafCondition;
  const fieldMeta = fields.find((f) => f.value === leaf.field);
  const eligibleOperators = operators.filter(o => {
    const type = fieldMeta?.type || "";
    if (type === "tags") return ["contains", "not_contains"].includes(o.value);
    if (o.value === "not_contains") return false;
    return (type !== "list" || ["in", "not_in", "is_null", "is_not_null"].includes(o.value)) &&
      (!["gt", "gte", "lt", "lte"].includes(o.value) || ["date", "number"].includes(type)) &&
      (!["in", "not_in"].includes(o.value) || !["boolean", "date"].includes(type)) &&
      (!["contains", "starts_with"].includes(o.value) || type === "string" || (type === "list" && o.value === "contains"));
  });
  const selectedOp = eligibleOperators.some(operator => operator.value === leaf.op)
    ? leaf.op
    : eligibleOperators[0]?.value || "eq";
  const opMeta = eligibleOperators.find((operator) => operator.value === selectedOp);
  const chooseField = (value: string) => {
    const nextField = fields.find(field => field.value === value);
    const nextOperators = operators.filter(operator =>
      nextField?.type === "tags" ? ["contains", "not_contains"].includes(operator.value) :
      operator.value !== "not_contains" &&
      (nextField?.type !== "list" || ["in", "not_in", "is_null", "is_not_null"].includes(operator.value)) &&
      (!["gt", "gte", "lt", "lte"].includes(operator.value) || ["date", "number"].includes(nextField?.type || "")) &&
      (!["in", "not_in"].includes(operator.value) || !["boolean", "date"].includes(nextField?.type || "")) &&
      (!["contains", "starts_with"].includes(operator.value) || nextField?.type === "string" || (nextField?.type === "list" && operator.value === "contains")));
    const nextOp = nextOperators.some(operator => operator.value === leaf.op) ? leaf.op : nextOperators[0]?.value || "eq";
    onChange({ field: value, op: nextOp, value: nextField?.type === "boolean" ? false : ["in", "not_in"].includes(nextOp) || nextField?.type === "list" ? [] : "" });
  };
  const setValue = (value: any) => onChange({ ...leaf, op: selectedOp, value });
  const listValue = Array.isArray(leaf.value) ? leaf.value.map(String) : [];
  const choiceCopy = getConditionChoiceCopy(locale);
  const valueOptions = fieldMeta ? conditionValueOptions(fieldMeta, leaf.value, choiceCopy.saved) : [];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={leaf.field} onValueChange={chooseField}>
        <SelectTrigger aria-label={copy.field} className="h-9 w-56 text-xs"><SelectValue placeholder={copy.chooseField} /></SelectTrigger>
        <SelectContent className="automation-rule-select-content max-h-80 w-[min(28rem,calc(100vw-2rem))]">
          {fields.map((f) => (
            <SelectItem key={f.value} value={f.value} textValue={f.label} className="min-h-9 whitespace-normal py-2">
              <span className="flex min-w-0 items-center gap-2">
                {(() => {
                  const Icon = f.options ? ListFilter : conditionFieldIcons[f.type] || CircleHelp;
                  return <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />;
                })()}
                <span className="leading-5">{f.label}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={selectedOp} onValueChange={(v) => onChange({ ...leaf, op: v, value:
        ["in", "not_in"].includes(v)
          ? (Array.isArray(leaf.value) ? leaf.value : String(leaf.value ?? "").split(",").map(x => x.trim()).filter(Boolean))
          : fieldMeta?.type === "list" ? (Array.isArray(leaf.value) ? leaf.value : [])
          : (Array.isArray(leaf.value) ? leaf.value[0] ?? "" : leaf.value) })}>
        <SelectTrigger aria-label={copy.operator} className="h-9 w-44 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent className="automation-rule-select-content max-h-80 w-[min(28rem,calc(100vw-2rem))]">
          {eligibleOperators.map((o) => (
            <SelectItem key={o.value} value={o.value} textValue={fieldMeta?.type === "tags"
              ? o.value === "contains" ? getAutomationRecordTagCopy(locale).hasTag : getAutomationRecordTagCopy(locale).doesNotHaveTag
              : copy.operators[o.value] || o.label} className="min-h-9 whitespace-normal py-2">
              <span className="flex min-w-0 items-center gap-2">
                {(() => {
                  const Icon = conditionOperatorIcons[o.value] || CircleHelp;
                  return <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />;
                })()}
                <span className="leading-5">{fieldMeta?.type === "tags"
                  ? o.value === "contains" ? getAutomationRecordTagCopy(locale).hasTag : getAutomationRecordTagCopy(locale).doesNotHaveTag
                  : copy.operators[o.value] || o.label}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {opMeta && opMeta.arity > 0 && (
        fieldMeta?.type === "tags" ? <RecordTagConditionInput entityType={sourceModule} countryCodes={countryCodes}
          value={typeof leaf.value === "string" ? leaf.value : ""} onChange={value => onChange({ ...leaf, op: selectedOp, value })} /> :
        fieldMeta && !fieldMeta.options && conditionChoiceSource(sourceModule, leaf.field) &&
          !["contains", "starts_with"].includes(selectedOp) ? (
          <div className="min-w-0 w-64 max-w-full">
            <AutomationConditionReferencePicker field={leaf.field} module={sourceModule} eventType={eventType}
              countryCodes={countryCodes}
              value={Array.isArray(leaf.value) ? leaf.value.map(String) : leaf.value == null ? "" : String(leaf.value)}
              multiple={fieldMeta.type === "list" || ["in", "not_in"].includes(selectedOp)}
              onChange={value => setValue(fieldMeta.type === "number"
                ? Array.isArray(value) ? value.map(Number) : Number(value) : value)} />
          </div>
        ) :
        usesConditionChoices(fieldMeta, selectedOp) && (fieldMeta?.type === "list" || ["in", "not_in"].includes(selectedOp)) ? (
          <AutomationChoicePicker
            options={valueOptions}
            values={listValue} onChange={setValue} label={copy.value} placeholder={copy.chooseValue}
            testId="condition-multiple-values" />
        ) : usesConditionChoices(fieldMeta, selectedOp) ? (
          <Select value={String(leaf.value ?? "")} onValueChange={setValue}>
            <SelectTrigger aria-label={copy.value} className="h-9 w-44 text-xs"><SelectValue placeholder={copy.chooseValue} /></SelectTrigger>
            <SelectContent className="automation-rule-select-content max-h-80 z-[10050]">
              {valueOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : fieldMeta?.type === "boolean" ? (
          <Select value={String(leaf.value ?? "")} onValueChange={(v) => onChange({ ...leaf, value: v === "true" })}>
            <SelectTrigger aria-label={copy.value} className="h-9 w-32 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent className="automation-rule-select-content">
              <SelectItem value="true">{t.automationServices.editor.yes}</SelectItem>
              <SelectItem value="false">{t.automationServices.editor.no}</SelectItem>
            </SelectContent>
          </Select>
        ) : fieldMeta?.type === "date" && !["in", "not_in"].includes(selectedOp) ? (
          <TaskCreateDatePicker
            value={String(leaf.value ?? "")}
            onChange={setValue}
            locale={locale}
            label={copy.value}
            clearLabel={t.common.clear}
          />
        ) : (
          <Input
            aria-label={copy.value}
            className="h-9 w-44 text-xs"
            type={["in", "not_in"].includes(selectedOp) ? "text" : fieldMeta?.type === "number" ? "number" : "text"}
            value={Array.isArray(leaf.value) ? leaf.value.join(", ") : String(leaf.value ?? "")}
            onChange={(e) => setValue(["in", "not_in"].includes(selectedOp)
              ? e.target.value.split(",").map(v => v.trim()).filter(Boolean)
                .map(value => fieldMeta?.type === "number" ? Number(value) : value)
              : fieldMeta?.type === "number" && e.target.value !== "" ? Number(e.target.value) : e.target.value)}
            placeholder={fieldMeta?.type === "list" ? t.automationServices.editor.listValueHint : t.automationServices.editor.valuePlaceholder}
          />
        )
      )}
      {fieldMeta?.help && <p className="w-full text-xs leading-relaxed text-muted-foreground">{fieldMeta.help}</p>}
      {opMeta && opMeta.arity > 0 && usesConditionChoices(fieldMeta, selectedOp) && !fieldMeta?.help &&
        <p className="w-full text-xs leading-relaxed text-muted-foreground">{
          fieldMeta?.type === "list" || ["in", "not_in"].includes(selectedOp) ? choiceCopy.choose : choiceCopy.chooseOne
        }</p>}
    </div>
  );
}

/* ----------------- Actions ----------------- */
/** Shared destination selector for every service that actually addresses people. */
function ActionEditor({
  action,
  sourceModule,
  scheduleMode,
  index,
  actionTypes,
  supportedActions,
  recipientTemplates,
  availableVariables,
  users,
  departments,
  taskGroups,
  roles,
  countryCodes,
  ruleId,
  onChange,
  onRemove,
  onEmailDraftValidityChange,
}: {
  action: ActionNode;
  sourceModule: string;
  scheduleMode?: "once" | "per_record";
  index: number;
  actionTypes: Catalog["actionTypes"];
  supportedActions: string[];
  recipientTemplates: string[];
  availableVariables: Array<{ value: string; label: string }>;
  users: UserOpt[];
  departments?: Array<{ id: string; name: string }>;
  taskGroups: TaskGroupOpt[];
  roles: RoleOpt[];
  countryCodes: string[];
  ruleId?: string;
  onChange: (a: ActionNode) => void;
  onRemove: () => void;
  onEmailDraftValidityChange?: (invalid: boolean) => void;
}) {
  const { t, locale } = useI18n();
  const setCfg = (k: string, v: any) => onChange({ ...action, config: { ...action.config, [k]: v } });
  const notifyEditorApplyIntent = useRef(false);
  const changeNotifyConfig = (config: Record<string, any>) => {
    const previous = action.config;
    const semanticChanges = Array.from(new Set([...Object.keys(previous), ...Object.keys(config)]))
      .filter(key => key !== "notificationActionVersion" && JSON.stringify(previous[key]) !== JSON.stringify(config[key]));
    const nextConfig = { ...config };
    if (previous.notificationActionVersion !== 2 && config.notificationActionVersion === 2 &&
      !notifyEditorApplyIntent.current && semanticChanges.every(key => key === "priority")) {
      delete nextConfig.notificationActionVersion;
    }
    notifyEditorApplyIntent.current = false;
    onChange({ ...action, config: nextConfig });
  };

  const userOptions = useMemo(
    () => [
      ...(recipientTemplates.includes("newValues.assignedUserId")
        ? [{ id: "{{newValues.assignedUserId}}", label: `→ ${t.automationCatalog.taskAssignee}` }] : []),
      ...(recipientTemplates.includes("newValues.createdByUserId")
        ? [{ id: "{{newValues.createdByUserId}}", label: `→ ${t.automationCatalog.taskCreator}` }] : []),
      ...(recipientTemplates.includes("newValues.agentId")
        ? [{ id: "{{newValues.agentId}}", label: `→ ${t.automationServices.inboundNames.assigned_notice}` }] : []),
      ...(recipientTemplates.includes("newValues.assignedAgentId")
        ? [{ id: "{{newValues.assignedAgentId}}", label: `→ ${t.automationServices.inboundNames.missed_agent_notice}` }] : []),
      ...users.map((u) => ({ id: u.id, label: `${u.fullName} (${u.email})` })),
    ],
    [users, recipientTemplates, t.automationCatalog.taskAssignee, t.automationCatalog.taskCreator, t.automationServices.inboundNames.assigned_notice, t.automationServices.inboundNames.missed_agent_notice]
  );

  return (
    <div className="min-w-0 border rounded-md p-3 space-y-2 bg-muted/30">
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <Badge variant="secondary">#{index + 1}</Badge>
        {(() => { const visual = serviceVisual(action.type); const Icon = visual.icon; return (
          <span className={`rounded-md p-1.5 ${visual.tile} ${visual.accent}`}><Icon className="h-4 w-4" /></span>
        ); })()}
        <Select value={action.type} onValueChange={(v) => onChange({ type: v, config: v === "record_analysis"
          ? { recordEntryVersion: 1, targetType: "auto", lookup: "sender", mode: "history", title: getRecordEntryCopy(locale).defaultTitle, note: "{{analysis.summary}}" }
          : v === "forward_message" ? { forwardActionVersion: 1, destination: "back_office", mode: "attachments", selection: "invoice" } : v === "send_email" ? { emailActionVersion: 2, senderMode: "personal" } : v === "notify_user" ? { notificationActionVersion: 2 } : v === "create_task" && availableVariables.some(variable => variable.value.startsWith("analysis.")) ? { analysisAttachments: "invoice" } : {} })}>
          <SelectTrigger aria-label={t.automationServices.conditionEditor.action}
            className="h-9 w-56 max-w-full min-w-0 text-xs [&>span]:truncate" data-testid={`select-action-type-${index}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="automation-rule-select-content max-h-80 w-[min(28rem,calc(100vw-2rem))]">
            {actionTypes.map((a) => (
              <SelectItem key={a.value} value={a.value} disabled={!supportedActions.includes(a.value)}>
                <span className="inline-flex min-h-9 items-center gap-2 py-1">
                  {(() => { const visual = serviceVisual(a.value); const Icon = visual.icon; return (
                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md ${visual.tile} ${visual.accent}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                  ); })()}
                  <span className="whitespace-normal leading-5">
                    {a.value === "record_analysis" ? getRecordEntryCopy(locale).actionLabel : a.value === "forward_message" ? getForwardCopy(locale).heading : a.value === "send_sms" ? getSmsActionCopy(locale).heading : t.automationServices.names[a.value as keyof typeof t.automationServices.names] || a.label}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onRemove} data-testid={`button-remove-action-${index}`}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t.automationServices.conditionEditor.availabilityHint}</p>
      {!supportedActions.includes(action.type) &&
        <p className="text-xs text-destructive">{t.automationCatalog.unavailableHere}</p>}

      {action.type === "notify_user" && <div className="space-y-3 text-xs">
        <div className="rounded-md border bg-background p-2" data-testid={`notify-user-help-${index}`}>
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="font-medium">{t.automationEditorHelp.notifyTitle}</span>
            <AutomationStepHelp step="notify" copy={t.automationEditorHelp} />
          </div>
          <p className="mt-1 leading-relaxed text-muted-foreground">{t.automationEditorHelp.notify[0]}</p>
        </div>
        <div onClickCapture={event => {
          const target = event.target as HTMLElement;
          if (target.closest(`[data-testid="notify-user-apply-${index}"]`)) notifyEditorApplyIntent.current = true;
        }}>
          <AutomationNotifyUserAction
            config={action.config}
            onChange={changeNotifyConfig}
            availableVariables={availableVariables}
            sourceModule={sourceModule}
            index={index}
            recipientSelector={<AutomationRecipientTargetSelect mode="notify" config={action.config} userOptions={userOptions}
              groups={taskGroups} roles={roles} onChange={(config) => onChange({ ...action, config })} index={index} />}
          />
        </div>
      </div>}

      {action.type === "create_task" && (
        <AutomationCreateTaskAction
          config={action.config}
          onChange={(config) => onChange({ ...action, config })}
          users={users.map((user) => ({ id: user.id, label: `${user.fullName} (${user.email})` }))}
          groups={taskGroups}
          roles={roles}
          availableVariables={availableVariables}
          sourceModule={sourceModule}
          testId={`create-task-action-${index}`}
        />
      )}

      {action.type === "send_email" && <AutomationSendEmailAction
        onDraftValidityChange={onEmailDraftValidityChange}
        config={action.config}
        onChange={(config) => onChange({ ...action, config })}
        users={users}
        groups={taskGroups}
        roles={roles}
        countryCodes={countryCodes}
        ruleId={ruleId}
        availableVariables={availableVariables}
        sourceModule={sourceModule}
        recipientTemplates={recipientTemplates}
        testId={`send-email-action-${index}`}
      />}

      {action.type === "send_sms" && (
        <AutomationSendSmsAction
          config={action.config}
          onChange={(config) => onChange({ ...action, config })}
          availableVariables={availableVariables}
          sourceModule={sourceModule}
          countryCodes={countryCodes}
          testId={`send-sms-action-${index}`}
          onDraftValidityChange={onEmailDraftValidityChange}
        />
      )}

      {action.type === "forward_message" && <AutomationForwardActionEditor config={action.config || {}} users={users}
        taskGroups={taskGroups} onChange={config => onChange({ ...action, config })}
        onDraftValidityChange={onEmailDraftValidityChange} />}
      {action.type === "record_analysis" && <AutomationRecordEntryEditor value={action.config as any}
        onChange={config => onChange({ ...action, config })} availableVariables={availableVariables}
        ruleId={ruleId} countries={countryCodes} taskGroups={taskGroups} />}

      {action.type === "webhook" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
          <div className="md:col-span-3 flex items-center gap-2">
            <span className="text-sm font-medium">{t.automationEditorHelp.webhookTitle}</span>
            <AutomationStepHelp step="webhook" copy={t.automationEditorHelp} />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">URL</Label>
            <Input
              className="h-8 text-xs"
              value={action.config.url || ""}
              onChange={(e) => setCfg("url", e.target.value)}
              placeholder="https://example.com/hooks/automation"
              data-testid={`input-webhook-url-${index}`}
            />
          </div>
          <div>
            <Label className="text-xs">Method</Label>
            <Select value={action.config.method || "POST"} onValueChange={(v) => setCfg("method", v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="PATCH">PATCH</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-3">
            <Label className="text-xs">Body (JSON, leave empty for default event payload)</Label>
            <Textarea
              rows={3}
              className="text-xs font-mono"
              value={typeof action.config.body === "string" ? action.config.body : action.config.body ? JSON.stringify(action.config.body, null, 2) : ""}
              onChange={(e) => {
                const v = e.target.value;
                if (!v.trim()) { setCfg("body", undefined); return; }
                try { setCfg("body", JSON.parse(v)); } catch { setCfg("body", v); }
              }}
              placeholder={'{"event":"{{event.eventType}}","id":"{{entityId}}"}'}
            />
          </div>
        </div>
      )}

      {(action.type === "add_tag" || action.type === "remove_tag") && (
        <AutomationRecordTagAction config={action.config} sourceModule={sourceModule}
          mode={action.type === "add_tag" ? "add" : "remove"} scheduleMode={scheduleMode}
          index={index} countryCodes={countryCodes} onDraftValidityChange={onEmailDraftValidityChange}
          onChange={config => onChange({ ...action, config })} />
      )}

      {action.type === "assign_user" && (
        <AutomationAssignOwnerAction config={action.config} sourceModule={sourceModule}
          countryCodes={countryCodes} index={index} onChange={config => onChange({ ...action, config })}
          scheduleMode={scheduleMode} onDraftValidityChange={onEmailDraftValidityChange} />
      )}

      {action.type === "update_entity" && (
        <AutomationUpdateRecordAction config={action.config} sourceModule={sourceModule}
          scheduleMode={scheduleMode}
          index={index} availableVariables={availableVariables} countryCodes={countryCodes}
          onDraftValidityChange={onEmailDraftValidityChange}
          onChange={config => onChange({ ...action, config })} />
      )}
    </div>
  );
}

/* ----------------- Run history ----------------- */
function RunHistory({ ruleId }: { ruleId: string }) {
  const runsQ = useQuery<Run[]>({ queryKey: ["/api/automation/runs", { ruleId }] });
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const detailQ = useQuery<any>({
    queryKey: ["/api/automation/runs", selectedRun],
    enabled: !!selectedRun,
  });

  if (runsQ.isLoading)
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );

  return (
    <div className="space-y-3 max-h-[500px] overflow-auto">
      <div className="text-xs text-muted-foreground">{(runsQ.data || []).length} run(s)</div>
      {(runsQ.data || []).length === 0 && (
        <div className="text-center text-muted-foreground py-8 text-sm">No runs yet.</div>
      )}
      {(runsQ.data || []).map((run) => (
        <div key={run.id} className="border rounded-md p-2 text-xs" data-testid={`row-run-${run.id}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  run.status === "success" ? "default" : run.status === "failed" ? "destructive" : "secondary"
                }
              >
                {run.status}
              </Badge>
              {run.skippedReason && <Badge variant="outline">{run.skippedReason}</Badge>}
              <span className="text-muted-foreground">{new Date(run.startedAt).toLocaleString()}</span>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setSelectedRun(selectedRun === run.id ? null : run.id)}>
              {selectedRun === run.id ? "Hide" : "Detail"}
            </Button>
          </div>
          {run.error && <div className="text-red-500 mt-1">{run.error}</div>}
          {selectedRun === run.id && detailQ.data && (
            detailQ.data.attachmentAnalysis ? <AutomationAttachmentResults activity={detailQ.data.attachmentAnalysis} /> :
            <pre className="mt-2 bg-muted p-2 rounded overflow-auto text-[11px]">
              {JSON.stringify(detailQ.data, null, 2)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}

/* ----------------- Global runs view (top-level Runs tab) ----------------- */
function GlobalRunsView({ rules }: { rules: Rule[] }) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [ruleFilter, setRuleFilter] = useState<string>("all");
  const [selectedRun, setSelectedRun] = useState<string | null>(null);

  const queryKey = ruleFilter === "all"
    ? ["/api/automation/runs"]
    : ["/api/automation/runs", { ruleId: ruleFilter }];
  const runsQ = useQuery<Run[]>({ queryKey, refetchInterval: 5000 });

  const detailQ = useQuery<any>({
    queryKey: ["/api/automation/runs", selectedRun],
    enabled: !!selectedRun,
  });

  const ruleNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const r of rules) m[r.id] = r.name;
    return m;
  }, [rules]);

  const filtered = useMemo(() => {
    const list = runsQ.data || [];
    if (statusFilter === "all") return list;
    return list.filter((r) => r.status === statusFilter);
  }, [runsQ.data, statusFilter]);

  const stats = useMemo(() => {
    const list = runsQ.data || [];
    const acc = { total: list.length, success: 0, failed: 0, skipped: 0, running: 0, totalMs: 0, finishedCount: 0 };
    for (const r of list) {
      if (r.status === "success") acc.success++;
      else if (r.status === "failed") acc.failed++;
      else if (r.status === "skipped") acc.skipped++;
      else if (r.status === "running") acc.running++;
      if (r.finishedAt) {
        acc.totalMs += new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime();
        acc.finishedCount++;
      }
    }
    const denom = acc.success + acc.failed;
    const successRate = denom > 0 ? Math.round((acc.success / denom) * 100) : null;
    const avgMs = acc.finishedCount > 0 ? Math.round(acc.totalMs / acc.finishedCount) : null;
    return { ...acc, successRate, avgMs };
  }, [runsQ.data]);

  const sparklineRuns = useMemo(() => (runsQ.data || []).slice(0, 50).reverse(), [runsQ.data]);

  const perRuleStats = useMemo(() => {
    const list = runsQ.data || [];
    const m: Record<string, { name: string; success: number; failed: number; total: number }> = {};
    for (const r of list) {
      const name = ruleNameById[r.ruleId] || r.ruleId.slice(0, 8);
      if (!m[r.ruleId]) m[r.ruleId] = { name, success: 0, failed: 0, total: 0 };
      m[r.ruleId].total++;
      if (r.status === "success") m[r.ruleId].success++;
      else if (r.status === "failed") m[r.ruleId].failed++;
    }
    return Object.entries(m)
      .map(([id, v]) => ({ id, ...v, rate: v.success + v.failed > 0 ? Math.round((v.success / (v.success + v.failed)) * 100) : null }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [runsQ.data, ruleNameById]);

  const dotColor = (s: string) => {
    if (s === "success") return "bg-green-500";
    if (s === "failed") return "bg-red-500";
    if (s === "skipped") return "bg-gray-400";
    if (s === "running") return "bg-blue-400 animate-pulse";
    return "bg-yellow-500";
  };

  const fmtDuration = (start: string, end: string | null) => {
    if (!end) return "—";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
  };

  const statusVariant = (s: string): "default" | "destructive" | "secondary" | "outline" => {
    if (s === "success") return "default";
    if (s === "failed") return "destructive";
    if (s === "skipped") return "outline";
    return "secondary";
  };

  return (
    <div className="space-y-3">
      {/* Stats summary */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <div className="border rounded-md p-2" data-testid="stat-total">
          <div className="text-[10px] uppercase text-muted-foreground">Total</div>
          <div className="text-lg font-semibold">{stats.total}</div>
        </div>
        <div className="border rounded-md p-2" data-testid="stat-success">
          <div className="text-[10px] uppercase text-green-600">Success</div>
          <div className="text-lg font-semibold text-green-600">{stats.success}</div>
        </div>
        <div className="border rounded-md p-2" data-testid="stat-failed">
          <div className="text-[10px] uppercase text-red-600">Failed</div>
          <div className="text-lg font-semibold text-red-600">{stats.failed}</div>
        </div>
        <div className="border rounded-md p-2" data-testid="stat-skipped">
          <div className="text-[10px] uppercase text-muted-foreground">Skipped</div>
          <div className="text-lg font-semibold">{stats.skipped}</div>
        </div>
        <div className="border rounded-md p-2" data-testid="stat-success-rate">
          <div className="text-[10px] uppercase text-muted-foreground">Success rate</div>
          <div className="text-lg font-semibold">{stats.successRate !== null ? `${stats.successRate}%` : "—"}</div>
        </div>
        <div className="border rounded-md p-2" data-testid="stat-avg-duration">
          <div className="text-[10px] uppercase text-muted-foreground">Avg duration</div>
          <div className="text-lg font-semibold">
            {stats.avgMs !== null ? (stats.avgMs < 1000 ? `${stats.avgMs}ms` : `${(stats.avgMs / 1000).toFixed(2)}s`) : "—"}
          </div>
        </div>
      </div>

      {/* Sparkline of last 50 runs */}
      {sparklineRuns.length > 0 && (
        <div className="border rounded-md p-2">
          <div className="text-[10px] uppercase text-muted-foreground mb-1">Recent runs (oldest → newest)</div>
          <div className="flex items-center gap-[2px]" data-testid="sparkline-runs">
            {sparklineRuns.map((r) => (
              <div
                key={r.id}
                className={`h-5 w-2 rounded-sm cursor-pointer ${dotColor(r.status)}`}
                title={`${r.status} · ${new Date(r.startedAt).toLocaleString()}${r.error ? ` · ${r.error}` : ""}`}
                onClick={() => setSelectedRun(r.id)}
                data-testid={`spark-${r.id}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Per-rule top 8 */}
      {perRuleStats.length > 1 && (
        <div className="border rounded-md p-2">
          <div className="text-[10px] uppercase text-muted-foreground mb-1">Top rules by activity</div>
          <div className="space-y-1">
            {perRuleStats.map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-xs" data-testid={`perrule-${r.id}`}>
                <div className="flex-1 truncate font-medium">{r.name}</div>
                <div className="text-muted-foreground tabular-nums">
                  {r.success}✓ {r.failed}✗ / {r.total}
                </div>
                <div className="w-24 h-2 bg-muted rounded overflow-hidden flex">
                  {r.success > 0 && <div className="h-full bg-green-500" style={{ width: `${(r.success / r.total) * 100}%` }} />}
                  {r.failed > 0 && <div className="h-full bg-red-500" style={{ width: `${(r.failed / r.total) * 100}%` }} />}
                </div>
                <div className="w-12 text-right tabular-nums text-muted-foreground">
                  {r.rate !== null ? `${r.rate}%` : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40" data-testid="select-runs-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="skipped">Skipped</SelectItem>
              <SelectItem value="running">Running</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Rule</Label>
          <Select value={ruleFilter} onValueChange={setRuleFilter}>
            <SelectTrigger className="w-64" data-testid="select-runs-rule">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All rules</SelectItem>
              {rules.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          {runsQ.isFetching && <Loader2 className="h-3 w-3 animate-spin" />}
          <span data-testid="text-runs-count">{filtered.length} run(s) · auto-refresh 5s</span>
        </div>
      </div>

      {runsQ.isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 text-sm border rounded-md">
          No runs match the current filters.
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Rule</th>
                <th className="px-3 py-2">Started</th>
                <th className="px-3 py-2">Duration</th>
                <th className="px-3 py-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((run) => {
                const expanded = selectedRun === run.id;
                return (
                  <Fragment key={run.id}>
                    <tr className="border-t hover:bg-muted/30" data-testid={`row-globalrun-${run.id}`}>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-1">
                          <Badge variant={statusVariant(run.status)} data-testid={`badge-status-${run.id}`}>
                            {run.status}
                          </Badge>
                          {run.skippedReason && (
                            <Badge variant="outline" className="text-[10px]">{run.skippedReason}</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-medium" data-testid={`text-rule-${run.id}`}>
                        {ruleNameById[run.ruleId] || (
                          <span className="text-muted-foreground italic">{run.ruleId.slice(0, 8)}…</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {new Date(run.startedAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {fmtDuration(run.startedAt, run.finishedAt)}
                      </td>
                      <td className="px-3 py-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedRun(expanded ? null : run.id)}
                          data-testid={`button-toggle-${run.id}`}
                        >
                          {expanded ? "Hide" : "View"}
                        </Button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="border-t bg-muted/20">
                        <td colSpan={5} className="px-3 py-3">
                          {run.error && (
                            <div className="text-red-500 mb-2 text-[11px]">Error: {run.error}</div>
                          )}
                          {detailQ.isLoading ? (
                            <div className="flex justify-center py-4">
                              <Loader2 className="h-4 w-4 animate-spin" />
                            </div>
                          ) : detailQ.data ? (
                            <div className="space-y-3">
                              {detailQ.data.attachmentAnalysis && <AutomationAttachmentResults activity={detailQ.data.attachmentAnalysis} />}
                              {detailQ.data.event && (
                                <div>
                                  <div className="font-semibold text-[11px] mb-1">Trigger event</div>
                                  <div className="text-[11px] text-muted-foreground">
                                    {detailQ.data.event.module} · {detailQ.data.event.entityType} · {detailQ.data.event.eventType}
                                    {detailQ.data.event.entityId ? ` · id=${detailQ.data.event.entityId}` : ""}
                                  </div>
                                </div>
                              )}
                              {Array.isArray(detailQ.data.actions) && detailQ.data.actions.length > 0 && (
                                <div>
                                  <div className="font-semibold text-[11px] mb-1">Actions</div>
                                  <div className="space-y-1">
                                    {detailQ.data.actions.map((a: any) => (
                                      <div key={a.id} className="flex items-center gap-2 text-[11px]">
                                        <Badge variant={statusVariant(a.status)} className="text-[10px]">
                                          {a.status}
                                        </Badge>
                                        <span className="font-mono">#{a.actionIndex} {a.actionType}</span>
                                        {a.error && <span className="text-red-500">{a.error}</span>}
                                        {a.output && (
                                          <span className="text-muted-foreground truncate">
                                            → {JSON.stringify(a.output).slice(0, 100)}
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {!detailQ.data.attachmentAnalysis && <details>
                                <summary className="cursor-pointer text-[11px] text-muted-foreground">Raw JSON</summary>
                                <pre className="mt-1 bg-background p-2 rounded overflow-auto text-[10px] max-h-72">
                                  {JSON.stringify(detailQ.data, null, 2)}
                                </pre>
                              </details>}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
