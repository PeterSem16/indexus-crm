import { taskSalutationFields } from "@shared/task-template-variables";
import { emailActionIssues } from "@shared/automation-email-action";
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
import { AutomationSendSmsAction } from "@/components/automation-send-sms-action";
import { AutomationNotifyUserAction } from "@/components/automation-notify-user-action";
import { getSmsActionCopy } from "@/i18n/automation-sms-copy";
import { AutomationStepHelp } from "@/components/automation-step-help";
import { AutomationRuleExecutionSettings } from "@/components/automation-rule-execution-settings";
import { TaskCreateDatePicker } from "@/components/tasks/task-create-controls";
import { isTaskAssignmentTriggerTarget, type TaskAssignmentTriggerTarget } from "@shared/task-automation";
import "./automations-workspace.css";

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

type Rule = {
  id: string;
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
    | { type: "event"; entityType: string; eventType: string; assignmentTarget?: TaskAssignmentTriggerTarget }
    | { type: "schedule"; interval: string; mode?: "once" | "per_record" };
  conditions: ConditionNode | null;
  actions: ActionNode[];
  rateLimitPerHour: number | null;
};

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

  const [topTab, setTopTab] = useState<"assistant" | "services" | "rules" | "runs" | "notifications">(
    new URLSearchParams(window.location.search).get("tab") === "notifications" ? "notifications"
      : "services");
  const [managedTab, setManagedTab] = useState<"notification-rules" | "alert-rules">(
    new URLSearchParams(window.location.search).get("section") === "alert-rules" ? "alert-rules" : "notification-rules");
  useEffect(() => {
    const url = new URL(window.location.href);
    if (topTab === "notifications") {
      url.searchParams.set("tab", "notifications");
      url.searchParams.set("section", managedTab);
    } else {
      url.searchParams.delete("tab");
      url.searchParams.delete("section");
    }
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, [topTab, managedTab]);
  const rulesQ = useQuery<Rule[]>({ queryKey: ["/api/automation/rules"] });
  const catalogQ = useQuery<Catalog>({ queryKey: ["/api/automation/catalog"] });
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

  const toggleEnabled = (rule: Rule) =>
    updateMut.mutate({ id: rule.id, data: { enabled: !rule.enabled } });

  const onSave = (draft: RuleDraft) => {
    if (editing) updateMut.mutate({ id: editing.id, data: draft });
    else createMut.mutate(draft);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="text-page-title">
            <Settings2 className="h-6 w-6" />
            Automations
          </h1>
        </div>
        <Button onClick={() => { setNewService(null); setShowCreate(true); }} data-testid="button-create-rule">
          <Plus className="h-4 w-4 mr-2" />
          {t.automationServices.choose}
        </Button>
      </div>

      <Tabs value={topTab} onValueChange={(v) => setTopTab(v as any)}>
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="services" data-testid="tab-automation-services">{t.automationServices.servicesTab}</TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-automation-notifications">
            <Bell className="h-3.5 w-3.5 mr-1" />{t.automationServices.managed.heading}
          </TabsTrigger>
          <TabsTrigger value="assistant" data-testid="tab-automation-assistant">
            <Sparkles className="h-3.5 w-3.5 mr-1" />{t.automationDraft.button}
          </TabsTrigger>
          <TabsTrigger value="rules" data-testid="tab-rules">Rules</TabsTrigger>
          <TabsTrigger value="runs" data-testid="tab-runs">
            <History className="h-3.5 w-3.5 mr-1" /> Run history
          </TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="pt-4">
          {catalogQ.isLoading && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
          {catalogQ.isError && <p className="text-sm text-destructive">{String(catalogQ.error)}</p>}
          {catalogQ.data && <AutomationServiceCatalog catalog={catalogQ.data} onManage={(id) => {
            setManagedTab(id === "metric_alerts" ? "alert-rules" : "notification-rules");
            setTopTab("notifications");
          }} onSelectTrigger={(preset) => {
            setNewService(null);
            setPrefillDraft(chooseTriggerPreset({
              ...EMPTY_DRAFT(),
              name: t.automationServices.triggerPresets.labels[preset.id],
              actions: [{ type: "notify_user", config: { notificationActionVersion: 2, title: t.automationServices.triggerPresets.labels[preset.id] } }],
            }, preset));
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

        <TabsContent value="notifications" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t.automationServices.managed.heading}</CardTitle>
              <CardDescription>{t.automationServices.managed.info}</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={managedTab} onValueChange={(value) => setManagedTab(value as typeof managedTab)}>
                <TabsList className="h-auto flex-wrap justify-start">
                  <TabsTrigger value="notification-rules" data-testid="subtab-notification-rules">
                    <Bell className="h-4 w-4 mr-2" />{t.automationServices.managed.notificationTitle}
                  </TabsTrigger>
                  <TabsTrigger value="alert-rules" data-testid="subtab-alert-rules">
                    <AlertTriangle className="h-4 w-4 mr-2" />{t.automationServices.managed.alertTitle}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="notification-rules"><NotificationRulesManager /></TabsContent>
                <TabsContent value="alert-rules">
                  <Suspense fallback={<Loader2 className="h-6 w-6 animate-spin" />}><AlertRulesManager /></Suspense>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assistant" className="pt-4">
          <AutomationDraftAssistant />
        </TabsContent>

        <TabsContent value="rules" className="pt-4">
      {rulesQ.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(rulesQ.data || []).map((rule) => (
            <Card key={rule.id} data-testid={`card-rule-${rule.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {rule.name}
                      {rule.isSystem && <Badge variant="secondary">system</Badge>}
                      {!rule.enabled && <Badge variant="outline">disabled</Badge>}
                      {rule.disabledReason && (
                        <Badge variant="destructive" data-testid={`badge-auto-disabled-${rule.id}`}>
                          auto-disabled
                        </Badge>
                      )}
                      {!rule.disabledReason && (rule.consecutiveErrorCount ?? 0) > 0 && (
                        <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400" data-testid={`badge-error-count-${rule.id}`}>
                          {rule.consecutiveErrorCount} err
                        </Badge>
                      )}
                    </CardTitle>
                    {rule.description && (
                      <CardDescription className="mt-1">{rule.description}</CardDescription>
                    )}
                    {rule.disabledReason && (
                      <CardDescription className="mt-1 text-destructive text-xs" data-testid={`text-disabled-reason-${rule.id}`}>
                        {rule.disabledReason}
                      </CardDescription>
                    )}
                    {!rule.disabledReason && rule.lastErrorMessage && (
                      <CardDescription className="mt-1 text-amber-600 dark:text-amber-400 text-xs" data-testid={`text-last-error-${rule.id}`}>
                        Posledná chyba: {rule.lastErrorMessage}
                      </CardDescription>
                    )}
                  </div>
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={() => toggleEnabled(rule)}
                    data-testid={`switch-enabled-${rule.id}`}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline">module: {rule.module}</Badge>
                  {(rule.countryCodes?.length ? rule.countryCodes : rule.countryCode ? [rule.countryCode] : []).map(code =>
                    <Badge key={code} variant="outline">{catalogQ.data?.countries.find(country => country.value === code)?.label || code}</Badge>)}
                  {rule.trigger?.eventType && (
                    <Badge variant="outline">on: {rule.trigger.eventType}</Badge>
                  )}
                  <Badge variant="outline">{(rule.actions || []).length} action(s)</Badge>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(rule)} data-testid={`button-edit-${rule.id}`}>
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setHistoryFor(rule)} data-testid={`button-history-${rule.id}`}>
                    <History className="h-3.5 w-3.5 mr-1" />
                    Runs
                  </Button>
                  {(rule.disabledReason || (rule.consecutiveErrorCount ?? 0) > 0) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await apiRequest(
                          "POST",
                          `/api/automation/rules/${rule.id}/reset-errors`,
                          { reEnable: !!rule.disabledReason },
                        );
                        queryClient.invalidateQueries({ queryKey: ["/api/automation/rules"] });
                      }}
                      data-testid={`button-reset-errors-${rule.id}`}
                    >
                      Reset errors
                    </Button>
                  )}
                  {!rule.isSystem && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (confirm(`Delete "${rule.name}"?`)) deleteMut.mutate(rule.id);
                      }}
                      data-testid={`button-delete-${rule.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {(rulesQ.data || []).length === 0 && (
            <div className="col-span-full text-center text-muted-foreground py-12">
              No rules yet. Click <strong>New rule</strong> to create your first automation.
            </div>
          )}
        </div>
      )}
        </TabsContent>

        <TabsContent value="runs" className="pt-4">
          <GlobalRunsView rules={rulesQ.data || []} />
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

      <Dialog open={!!historyFor} onOpenChange={(o) => !o && setHistoryFor(null)}>
        <DialogContent className="task-modern-modal automation-history-dialog max-w-3xl" overlayClassName="task-modern-modal-overlay">
          <TaskModalArtwork variant="detail" />
          <DialogHeader>
            <DialogTitle>Run history: {historyFor?.name}</DialogTitle>
          </DialogHeader>
          {historyFor && <div className="task-modern-modal-body"><RunHistory ruleId={historyFor.id} /></div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ============================================================
   Rule editor — Builder + JSON tabs
   ============================================================ */
function RuleEditor({
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
}) {
  const { toast } = useToast();
  const { t, locale } = useI18n();
  const countryNames = useMemo(() => new Intl.DisplayNames([locale], { type: "region" }), [locale]);
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
  const [selectedService, setSelectedService] = useState<ServiceId | null>(initialService || null);
  const [jsonText, setJsonText] = useState(() => JSON.stringify(draft, null, 2));
  const [tab, setTab] = useState<string>("builder");
  const [showTest, setShowTest] = useState(false);
  const [expandedStep, setExpandedStep] = useState<number | null>(0);
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
    setJsonText(JSON.stringify(next, null, 2));
    setSelectedService(service);
    setExpandedStep(0);
  };

  useEffect(() => {
    if (initialService && !rule && !initialDraft) selectService(initialService);
  }, [initialService]);

  useEffect(() => {
    if (tab === "json") setJsonText(JSON.stringify(draft, null, 2));
  }, [tab]);

  const selectedEvent = draft.trigger.type === "event" ? draft.trigger.eventType : "schedule.tick";
  const selectedPreset = draft.trigger.type === "event"
    ? AUTOMATION_TRIGGER_PRESETS.find(preset => preset.module === draft.module && preset.eventType === selectedEvent)
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
  const fieldsForModule = catalog.fieldsByEvent?.[draft.module]?.[selectedEvent] || [];
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
  const fieldsForConditions = selectedPreset && draft.module === "communication" && !hasChannelCondition(visibleConditions)
    ? fieldsForModule.filter(field => field.value !== "newValues.type")
    : fieldsForModule;
  const eventsForModule = catalog.eventTypes.filter(e => e.availableIn.includes(draft.module));
  const actionsForModule = catalog.actionTypes.filter(a =>
    a.availableIn.includes(draft.module) &&
    (draft.trigger.type !== "schedule" || scheduleMode === "per_record" ||
      !["update_entity", "assign_user", "add_tag", "remove_tag"].includes(a.value)));
  const moduleNames = (ids: string[]) => ids.map(id => {
    const fallback = id === "collaborator" ? t.automationCatalog.collaborator
      : id === "communication" ? t.automationServices.triggerPresets.moduleLabel
      : catalog.modules.find(m => m.value === id)?.label || id;
    return t.automationServices.editorCatalog.moduleLabels[id] || fallback;
  }).join(", ");
  const eventLabel = (event: Catalog["eventTypes"][number]) =>
    event.value === "contract.completed" ? t.automationCatalog.contractCompleted :
    event.value === "contract.cancelled" ? t.automationCatalog.contractCancelled :
    AUTOMATION_TRIGGER_PRESETS.find(preset => preset.module === draft.module && preset.eventType === event.value)
      ? t.automationServices.triggerPresets.labels[AUTOMATION_TRIGGER_PRESETS.find(preset => preset.module === draft.module && preset.eventType === event.value)!.id]
      : t.automationServices.editorCatalog.eventLabels[event.value] || event.label;
  const eventDescription = (event: Catalog["eventTypes"][number]) =>
    (draft.module === "task" ? t.automationServices.taskRules.eventDescriptions[event.value] : undefined) ||
    t.automationServices.editorCatalog.eventDescriptions[event.value] || t.automationServices.editorCatalog.eventDescriptionFallback;
  const fieldLabel = (field: { value: string; label: string }) =>
    (draft.module === "task" ? t.automationServices.taskRules.fieldLabels[field.value] : undefined) ||
    t.automationServices.editorCatalog.fieldLabels[field.value] || field.label;
  const conditionFields: ConditionField[] = fieldsForConditions.map(field => {
    const localized: ConditionField = { ...field, label: fieldLabel(field) };
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
              trigger: { type: "event", entityType: draft.module, eventType: eventsForModule[0]?.value || "updated" },
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
          {catalog.modules.map((module) => {
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
                  const nextEvent = catalog.eventTypes.find(event => event.value === selectedEvent && event.availableIn.includes(module.value))?.value ||
                    catalog.eventTypes.find(event => event.availableIn.includes(module.value))?.value || "updated";
                  setDraft({
                    ...draft,
                    conditions: resetSourceConditions(),
                    module: module.value,
                    trigger: { type: "event", entityType: module.value, eventType: nextEvent },
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
            const Icon = triggerEventIcons[event.value] || Bell;
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
                  trigger: { type: "event", entityType: draft.module, eventType: event.value },
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
    return !field || !catalog.operators.some(op => op.value === leaf.op && op.availableIn.includes(draft.module) &&
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
  const incompatible = draft.actions.some(a => !actionsForModule.some(option => option.value === a.type)) ||
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
    return (candidate.actions || []).some((action) => {
      if (action.type !== "send_email" || action.config?.emailActionVersion !== 2) return false;
      const config = action.config || {};
      if (emailActionIssues(config).length) return true;
      if (!String(config.subject ?? "").trim() || !String(config.body ?? "").trim()) return true;
      return !checkTokens(`${config.subject}\n${config.body}`, supportedFields) ||
        !["to", "cc", "bcc"].every((field) => checkTokens(String(config[field] ?? ""), supportedRecipients));
    });
  };
  const hasInvalidEmailDraft = tab !== "json" && draft.actions.some((action, index) =>
    (action.type === "send_email" || action.type === "send_sms") && emailDraftInvalidByAction[index]);
  const emailActionsInvalid = emailActionInvalid(draft) || hasInvalidEmailDraft;
  const recordEmailDraftValidity = (index: number, invalid: boolean) =>
    setEmailDraftInvalidByAction(current => current[index] === invalid ? current : { ...current, [index]: invalid });

  const submit = () => {
    let payload = draft;
    if (tab === "json") {
      try {
        payload = JSON.parse(jsonText);
      } catch (e: any) {
        toast({ title: "Invalid JSON", description: e.message, variant: "destructive" });
        return;
      }
    }
    if (tab !== "json" && isNegativeSentimentRule(payload)) {
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
      <DialogContent className="task-modern-modal automation-editor-dialog automation-rule-dialog max-w-6xl max-h-[88vh]" overlayClassName="task-modern-modal-overlay">
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
            <TabsTrigger value="json" data-testid="tab-json">JSON</TabsTrigger>
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
                          ? eventLabel(eventsForModule.find(event => event.value === selectedEvent) || eventsForModule[0] || { value: selectedEvent, label: selectedEvent, availableIn: [], changeSnapshot: false })
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
                  {expandedStep === 0 && <div id="automation-step-when-body">
                  {draft.trigger.type === "event" ? (
                    <div className="automation-trigger-controls">
                      <div>
                        <Label>{t.automationServices.editor.sourceLabel}</Label>
                        <Select value={draft.module} onValueChange={module => {
                          const nextEvent = catalog.eventTypes.find(event => event.value === selectedEvent && event.availableIn.includes(module))?.value
                            || catalog.eventTypes.find(event => event.availableIn.includes(module))?.value || "updated";
                          if (draft.conditions) setSourceResetNotice(true);
                          setDraft({ ...draft, module, conditions: null, trigger: { type: "event", entityType: module, eventType: nextEvent } });
                        }}>
                          <SelectTrigger data-testid="select-module"><SelectValue /></SelectTrigger>
                          <SelectContent className="automation-rule-select-content">{catalog.modules.map(module => <SelectItem key={module.value} value={module.value} data-testid={`select-module-${module.value}`}>{moduleNames([module.value])}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>{t.automationServices.editor.eventLabel}</Label>
                        <Select value={selectedEvent} onValueChange={eventType => {
                          if (draft.conditions) setSourceResetNotice(true);
                          setDraft({ ...draft, conditions: null, trigger: { type: "event", entityType: draft.module, eventType } });
                        }}>
                          <SelectTrigger data-testid="select-event"><SelectValue /></SelectTrigger>
                          <SelectContent className="automation-rule-select-content">{eventsForModule.map(event => {
                            const Icon = triggerEventIcons[event.value] || Bell;
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
                  {sentimentRule && (sentimentSources?.editable
                      ? <SentimentSourcePicker selected={sentimentSources.channels} onToggle={toggleSentimentSource} copy={t.automationServices.sentimentSources} />
                    : <p className="automation-reset-notice">{t.automationServices.sentimentSources.advancedSelection}</p>)}
                  </div>}
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
                    {expandedStep === 1 && <div id="automation-step-if-body">{draft.trigger.type === "schedule" && scheduleMode === "once" ? <p className="automation-inline-note">{t.automationServices.workspace.noIfOnce}</p> : <>
                      {!fieldsForConditions.length && <p className="automation-inline-note">{t.automationCatalog.noFields}</p>}
                      {invalidCondition(draft.conditions) && <p className="automation-validation">{t.automationCatalog.unavailableHere}</p>}
                      {scheduleMode === "per_record" && !hasConditionLeaf(draft.conditions) && <p className="automation-validation">{t.automationServices.workspace.conditionsRequired}</p>}
                      {visibleConditions && <ConditionsEditor
                        node={visibleConditions}
                        fields={conditionFields}
                        operators={catalog.operators.filter(op => op.availableIn.includes(draft.module) &&
                          (!op.value.startsWith("changed") || eventsForModule.some(event => event.value === selectedEvent && event.changeSnapshot)))}
                        onChange={updateConditions}
                      />}
                    </>}</div>}
                  </section>
                  <section className="automation-step automation-step-then automation-flow-node" data-testid="automation-then-step">
                    <div className="automation-step-heading">
                      <span className="automation-step-number">03</span>
                      <span className="automation-step-icon" aria-hidden="true"><Sparkles size={15} /></span>
                      <button type="button" className="automation-step-toggle" aria-expanded={expandedStep === 2}
                        aria-controls="automation-step-then-body" onClick={() => setExpandedStep(expandedStep === 2 ? null : 2)}>
                        <h2>{t.automationServices.workspace.then}</h2><p>{draft.actions.length} · {t.automationServices.workspace.actionCount}</p>
                      </button>
                      <AutomationStepHelp step="then" copy={t.automationEditorHelp} />
                      <Button size="sm" variant="outline" onClick={() => {
                        setDraft({ ...draft, actions: [...draft.actions, { type: "notify_user", config: { notificationActionVersion: 2 } }] });
                        setExpandedStep(2);
                      }}
                        data-testid="button-add-action"><Plus className="h-3.5 w-3.5 mr-1" />{t.automationServices.workspace.addAction}</Button>
                    </div>
                    {expandedStep === 2 && <div id="automation-step-then-body">
                    <div className="automation-actions">
                      {draft.actions.length === 0 && <p className="automation-inline-note">{t.automationServices.workspace.noActions}</p>}
                      {draft.actions.map((action, index) => <ActionEditor key={index} action={action} index={index}
                        actionTypes={catalog.actionTypes} supportedActions={actionsForModule.map(option => option.value)}
                        recipientTemplates={catalog.recipientTemplatesByEvent?.[draft.module]?.[selectedEvent] || []}
                        availableVariables={[...fieldsForConditions, ...taskSalutationFields(draft.module, selectedEvent)].map(({ value, label }) => ({ value, label }))}
                        users={users} departments={departments || []} taskGroups={taskGroups} roles={roles}
                        countryCodes={draft.countryCodes || (draft.countryCode ? [draft.countryCode] : [])} ruleId={rule?.id}
                        onEmailDraftValidityChange={invalid => recordEmailDraftValidity(index, invalid)}
                        onChange={updated => { const next = [...draft.actions]; next[index] = updated; setDraft({ ...draft, actions: next }); }}
                        onRemove={() => { const next = [...draft.actions]; next.splice(index, 1); setDraft({ ...draft, actions: next }); }} />)}
                    </div>
                    {incompatible && <p className="automation-validation">{t.automationCatalog.unavailableHere}</p>}
                    </div>}
                  </section>
                </div>
                </div>
                {onceCountryUnsafe && <p className="automation-validation" role="alert">{t.automationServices.workspace.onceCountryRequired}</p>}
                <section className="automation-advanced">
                  <AutomationRuleExecutionSettings rateLimit={draft.rateLimitPerHour} enabled={draft.enabled} disabled={scheduleUnsafe || incompatible}
                    onRateLimitChange={rateLimitPerHour => setDraft({ ...draft, rateLimitPerHour })}
                    onEnabledChange={enabled => setDraft({ ...draft, enabled })} />
                </section>
              </div>
              <details className="automation-preview-panel" data-testid="automation-preview-panel">
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
                    <div className="automation-effect-node outcome"><span className="automation-effect-dot">03</span><div><small>{t.automationServices.workspace.then}</small><b>{draft.actions.length} · {t.automationServices.workspace.actionCount}</b></div></div>
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
                         catalog.eventTypes.some(event => event.value === preset.eventType && event.availableIn.includes(preset.module))
                       ).map((preset: AutomationTriggerPreset) => {
                          const Icon = triggerPresetIcons[preset.id];
                         const active = draft.module === preset.module && selectedEvent === preset.eventType;
                         return (
                           <button key={preset.id} type="button" aria-pressed={active}
                             className={`flex min-h-14 min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-muted/60"}`}
                              onClick={() => {
                                const next = chooseTriggerPreset(draft, preset);
                                if (preset.id !== "negativeSentiment" &&
                                  (draft.module !== preset.module || selectedEvent !== preset.eventType) && draft.conditions) {
                                  setSourceResetNotice(true);
                                  next.conditions = null;
                                }
                                setDraft(next);
                              }}
                             data-testid={`select-trigger-preset-${preset.id}`}>
                             <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                             <span>{t.automationServices.triggerPresets.labels[preset.id]}</span>
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
                    operators={catalog.operators.filter(op =>
                      op.availableIn.includes(draft.module) &&
                      (!op.value.startsWith("changed") || eventsForModule.some(e => e.value === selectedEvent && e.changeSnapshot)))}
                     onChange={updateConditions}
                  />
                </CardContent>
              )}
            </Card>

            {/* Actions */}
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
                    action={a}
                    index={i}
                    actionTypes={catalog.actionTypes}
                    supportedActions={actionsForModule.map(a => a.value)}
                    recipientTemplates={catalog.recipientTemplatesByEvent?.[draft.module]?.[selectedEvent] || []}
                    availableVariables={[...fieldsForConditions, ...taskSalutationFields(draft.module, selectedEvent)].map(({ value, label }) => ({ value, label }))}
                    users={users}
                    departments={departments || []}
                    taskGroups={taskGroups}
                    roles={roles}
                    countryCodes={draft.countryCodes || (draft.countryCode ? [draft.countryCode] : [])}
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

          <TabsContent value="json" className="pt-4">
            <Label>Rule JSON</Label>
            <Textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              className="font-mono text-xs h-[420px]"
              data-testid="textarea-rule-json"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Edits made here override the Builder tab on save. Templates use{" "}
              <code>{`{{newValues.fieldName}}`}</code> / <code>{`{{oldValues.fieldName}}`}</code>.
            </p>
          </TabsContent>
        </Tabs>

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
          <Button onClick={submit} disabled={saving || scheduleUnsafe || incompatible || emailActionsInvalid} data-testid="button-save-rule">
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
                  {result.conditionMet ? "MATCH (actions would fire)" : "NO MATCH (rule skipped)"}
                </Badge>
              </div>

              <div>
                <div className="text-sm font-semibold mb-1">
                  Actions ({result.actions?.length || 0}) {result.conditionMet ? "would execute" : "(suppressed)"}
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
}: {
  node: ConditionNode;
  fields: ConditionField[];
  operators: Catalog["operators"];
  onChange: (n: ConditionNode) => void;
  depth?: number;
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
      (nextField?.type !== "list" || ["in", "not_in", "is_null", "is_not_null"].includes(operator.value)) &&
      (!["gt", "gte", "lt", "lte"].includes(operator.value) || ["date", "number"].includes(nextField?.type || "")) &&
      (!["in", "not_in"].includes(operator.value) || !["boolean", "date"].includes(nextField?.type || "")) &&
      (!["contains", "starts_with"].includes(operator.value) || nextField?.type === "string" || (nextField?.type === "list" && operator.value === "contains")));
    const nextOp = nextOperators.some(operator => operator.value === leaf.op) ? leaf.op : nextOperators[0]?.value || "eq";
    onChange({ field: value, op: nextOp, value: nextField?.type === "boolean" ? false : ["in", "not_in"].includes(nextOp) || nextField?.type === "list" ? [] : "" });
  };
  const setValue = (value: any) => onChange({ ...leaf, op: selectedOp, value });
  const listValue = Array.isArray(leaf.value) ? leaf.value.map(String) : [];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={leaf.field} onValueChange={chooseField}>
        <SelectTrigger aria-label={copy.field} className="h-9 w-56 text-xs"><SelectValue placeholder={copy.chooseField} /></SelectTrigger>
        <SelectContent className="automation-rule-select-content max-h-80 w-[min(28rem,calc(100vw-2rem))]">
          {fields.map((f) => (
            <SelectItem key={f.value} value={f.value} textValue={f.label} className="min-h-9 whitespace-normal py-2">
              <span className="flex min-w-0 items-center gap-2">
                {(() => {
                  const Icon = conditionFieldIcons[f.type] || CircleHelp;
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
            <SelectItem key={o.value} value={o.value} textValue={copy.operators[o.value] || o.label} className="min-h-9 whitespace-normal py-2">
              <span className="flex min-w-0 items-center gap-2">
                {(() => {
                  const Icon = conditionOperatorIcons[o.value] || CircleHelp;
                  return <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />;
                })()}
                <span className="leading-5">{copy.operators[o.value] || o.label}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {opMeta && opMeta.arity > 0 && (
        fieldMeta?.options && (fieldMeta.type === "list" || ["in", "not_in"].includes(selectedOp)) ? (
          <AutomationChoicePicker
            options={fieldMeta.options.map(value => ({ value, label: fieldMeta.optionLabels?.[value] || value }))}
            values={listValue} onChange={setValue} label={copy.value} placeholder={copy.chooseValue} />
        ) : fieldMeta?.type === "enum" && fieldMeta.options ? (
          <Select value={String(leaf.value ?? "")} onValueChange={(v) => onChange({ ...leaf, value: v })}>
            <SelectTrigger aria-label={copy.value} className="h-9 w-44 text-xs"><SelectValue placeholder={copy.chooseValue} /></SelectTrigger>
            <SelectContent className="automation-rule-select-content max-h-80 z-[10050]">
              {fieldMeta.options.map((o) => (
                <SelectItem key={o} value={o}>{fieldMeta.optionLabels?.[o] || o}</SelectItem>
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
    </div>
  );
}

/* ----------------- Actions ----------------- */
/** Shared destination selector for every service that actually addresses people. */
function RecipientTargetSelect({
  mode, config, userOptions, departments = [], groups, roles, onChange, index,
}: {
  mode: "task" | "notify" | "email";
  config: Record<string, any>;
  userOptions: { id: string; label: string }[];
  departments?: { id: string; name: string }[];
  groups: TaskGroupOpt[];
  roles: RoleOpt[];
  onChange: (config: Record<string, any>) => void;
  index: number;
}) {
  const { t } = useI18n();
  const labels = t.automationServices.routing;
  const value = config.taskGroupId ? `group:${config.taskGroupId}`
    : config.targetRole ? `role:${config.targetRole.replace(/^role:/, "")}`
    : mode === "email" ? "address"
    : config.assignedDepartmentId ? `department:${config.assignedDepartmentId}`
    : mode === "notify" && config.userIds?.length ? "multi"
    : (mode === "task" ? config.assignedUserId : config.userId)
      ? `user:${mode === "task" ? config.assignedUserId : config.userId}`
    : "";
  const choose = (selected: string) => {
    if (selected === "multi") return;
    const { assignedUserId, assignee_user_id, assignedDepartmentId, assignee_department_id,
      userId, userIds, taskGroupId, targetRole, to, ...rest } = config;
    const [kind, ...parts] = selected.split(":");
    const id = parts.join(":");
    if (kind === "group") onChange({ ...rest, taskGroupId: id });
    else if (kind === "role") onChange({ ...rest, targetRole: `role:${id}` });
    else if (kind === "department") onChange({ ...rest, assignedDepartmentId: id });
    else if (kind === "user") onChange({ ...rest, [mode === "task" ? "assignedUserId" : "userId"]: id });
    else if (kind === "address") onChange({ ...rest, to: "" });
  };
  const group = groups.find(g => g.id === config.taskGroupId);
  return (
    <div className={mode === "email" ? "md:col-span-2" : ""}>
      <Label className="text-xs">{labels.recipient}</Label>
      <Select value={value} onValueChange={choose}>
        <SelectTrigger className="h-9 text-xs" data-testid={`select-recipient-target-${index}`}>
          <SelectValue placeholder={labels.choose} />
        </SelectTrigger>
        <SelectContent className="automation-rule-select-content">
          {mode === "email" && <SelectItem value="address"><span className="inline-flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-emerald-600" />{labels.emailAddress}</span></SelectItem>}
          {mode !== "email" && userOptions.length > 0 && <>
            <div className="px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">{labels.users}</div>
            {mode === "notify" && config.userIds?.length > 0 &&
              <SelectItem value="multi">{labels.users} ({config.userIds.length})</SelectItem>}
            {userOptions.map(u => <SelectItem key={u.id} value={`user:${u.id}`}>
              <span className="inline-flex items-center gap-2"><UserRound className="h-3.5 w-3.5 text-blue-600" />{u.label}</span>
            </SelectItem>)}
          </>}
          {mode === "task" && departments.length > 0 && <>
            <div className="px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">{labels.departments}</div>
            {departments.map(d => <SelectItem key={d.id} value={`department:${d.id}`}>
              <span className="inline-flex items-center gap-2"><Building2 className="h-3.5 w-3.5 text-cyan-600" />{d.name}</span>
            </SelectItem>)}
          </>}
          <div className="px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">{labels.groups}</div>
          {groups.map(g => <SelectItem key={g.id} value={`group:${g.id}`}>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: g.color || "#3b82f6" }} />
              {g.displayAlias || g.name} <span className="text-muted-foreground">({g.members?.length || 0})</span>
              {g.isBackOffice && <Badge variant="secondary" className="text-[9px]">{labels.backOffice}</Badge>}
            </span>
          </SelectItem>)}
          <div className="px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">{labels.roles}</div>
          {roles.filter(r => r.isActive !== false).map(r => <SelectItem key={r.id} value={`role:${r.name}`}>
            <span className="inline-flex items-center gap-2"><UsersRound className="h-3.5 w-3.5 shrink-0 text-violet-600" />{r.name}{r.description && <span className="max-w-56 truncate text-muted-foreground" title={r.description}>— {r.description}</span>}</span>
          </SelectItem>)}
        </SelectContent>
      </Select>
      {mode === "task" && group?.isBackOffice && <p className="mt-1 text-[11px] text-muted-foreground">{labels.sharedTask}</p>}
      {mode === "task" && group && !group.isBackOffice && <p className="mt-1 text-[11px] text-muted-foreground">{labels.memberTasks}</p>}
      {mode === "email" && (config.taskGroupId || config.targetRole) && <p className="mt-1 text-[11px] text-muted-foreground">{labels.memberEmail}</p>}
    </div>
  );
}

function ActionEditor({
  action,
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
        <Select value={action.type} onValueChange={(v) => onChange({ type: v, config: v === "send_email" ? { emailActionVersion: 2, senderMode: "personal" } : v === "notify_user" ? { notificationActionVersion: 2 } : {} })}>
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
                    {a.value === "send_sms" ? getSmsActionCopy(locale).heading : t.automationServices.names[a.value as keyof typeof t.automationServices.names] || a.label}
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
            index={index}
            recipientSelector={<RecipientTargetSelect mode="notify" config={action.config} userOptions={userOptions}
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
        recipientTemplates={recipientTemplates}
        testId={`send-email-action-${index}`}
      />}

      {action.type === "send_sms" && (
        <AutomationSendSmsAction
          config={action.config}
          onChange={(config) => onChange({ ...action, config })}
          availableVariables={availableVariables}
          countryCodes={countryCodes}
          testId={`send-sms-action-${index}`}
          onDraftValidityChange={onEmailDraftValidityChange}
        />
      )}

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
          <div>
            <Label className="text-xs">Entity type</Label>
            <Select value={action.config.entityType || ""} onValueChange={(v) => setCfg("entityType", v)}>
              <SelectTrigger className="h-8 text-xs" data-testid={`select-tag-entity-type-${index}`}>
                <SelectValue placeholder="(use event entityType)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="task">Task</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="hospital">Hospital</SelectItem>
                <SelectItem value="clinic">Clinic</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Entity ID (template ok)</Label>
            <Input
              className="h-8 text-xs"
              value={action.config.entityId || ""}
              onChange={(e) => setCfg("entityId", e.target.value)}
              placeholder="{{entityId}}"
              data-testid={`input-tag-entity-id-${index}`}
            />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Tags (comma-separated)</Label>
            <Input
              className="h-8 text-xs"
              value={Array.isArray(action.config.tags) ? action.config.tags.join(", ") : (action.config.tags || "")}
              onChange={(e) => setCfg("tags", e.target.value)}
              placeholder="vip, urgent, follow-up"
              data-testid={`input-tag-tags-${index}`}
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              {action.type === "add_tag" ? "Tags are deduplicated against existing ones." : "Tags removed (case-insensitive match)."}
            </p>
          </div>
        </div>
      )}

      {action.type === "assign_user" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
          <div>
            <Label className="text-xs">Entity type</Label>
            <Select value={action.config.entityType || ""} onValueChange={(v) => setCfg("entityType", v)}>
              <SelectTrigger className="h-8 text-xs" data-testid={`select-assign-entity-type-${index}`}>
                <SelectValue placeholder="(use event entityType)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="task">Task</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="hospital">Hospital</SelectItem>
                <SelectItem value="clinic">Clinic</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Strategy</Label>
            <Select value={action.config.strategy || "round_robin"} onValueChange={(v) => setCfg("strategy", v)}>
              <SelectTrigger className="h-8 text-xs" data-testid={`select-assign-strategy-${index}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="round_robin">Round-robin</SelectItem>
                <SelectItem value="least_loaded">Least loaded</SelectItem>
                <SelectItem value="random">Random</SelectItem>
                <SelectItem value="specific">Specific user</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Entity ID (template ok)</Label>
            <Input
              className="h-8 text-xs"
              value={action.config.entityId || ""}
              onChange={(e) => setCfg("entityId", e.target.value)}
              placeholder="{{entityId}}"
              data-testid={`input-assign-entity-id-${index}`}
            />
          </div>
          {action.config.strategy === "specific" ? (
            <div>
              <Label className="text-xs">User</Label>
              <Select value={action.config.userId || ""} onValueChange={(v) => setCfg("userId", v)}>
                <SelectTrigger className="h-8 text-xs" data-testid={`select-assign-userid-${index}`}>
                  <SelectValue placeholder="pick user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.fullName} ({u.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div>
              <Label className="text-xs">Eligible user IDs (CSV; empty = all active)</Label>
              <Input
                className="h-8 text-xs"
                value={Array.isArray(action.config.userIds) ? action.config.userIds.join(", ") : (action.config.userIds || "")}
                onChange={(e) => setCfg("userIds", e.target.value)}
                placeholder="user-id-1, user-id-2"
                data-testid={`input-assign-userids-${index}`}
              />
            </div>
          )}
          <div>
            <Label className="text-xs">Role filter (optional)</Label>
            <Input
              className="h-8 text-xs"
              value={action.config.roleFilter || ""}
              onChange={(e) => setCfg("roleFilter", e.target.value)}
              placeholder="agent, manager"
              data-testid={`input-assign-role-${index}`}
            />
          </div>
          <div>
            <Label className="text-xs">Country filter (CSV ISO codes, optional)</Label>
            <Input
              className="h-8 text-xs"
              value={Array.isArray(action.config.countryFilter) ? action.config.countryFilter.join(", ") : (action.config.countryFilter || "")}
              onChange={(e) => setCfg("countryFilter", e.target.value)}
              placeholder="SK, CZ"
              data-testid={`input-assign-country-${index}`}
            />
          </div>
        </div>
      )}

      {action.type === "update_entity" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
          <div>
            <Label className="text-xs">Entity type</Label>
            <Select value={action.config.entityType || ""} onValueChange={(v) => setCfg("entityType", v)}>
              <SelectTrigger className="h-8 text-xs" data-testid={`select-update-entity-type-${index}`}>
                <SelectValue placeholder="(use event entityType)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="task">Task</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="hospital">Hospital</SelectItem>
                <SelectItem value="clinic">Clinic</SelectItem>
                <SelectItem value="invoice">Invoice</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Entity ID (template ok)</Label>
            <Input
              className="h-8 text-xs"
              value={action.config.entityId || ""}
              onChange={(e) => setCfg("entityId", e.target.value)}
              placeholder="{{entityId}}"
              data-testid={`input-update-entity-id-${index}`}
            />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Fields to set (JSON object)</Label>
            <Textarea
              rows={4}
              className="text-xs font-mono"
              value={action.config.fields ? JSON.stringify(action.config.fields, null, 2) : ""}
              onChange={(e) => {
                const v = e.target.value;
                if (!v.trim()) { setCfg("fields", undefined); return; }
                try { setCfg("fields", JSON.parse(v)); } catch { /* keep last valid */ }
              }}
              placeholder={'{"status":"completed","assignedUserId":"{{newValues.assignedUserId}}"}'}
              data-testid={`textarea-update-fields-${index}`}
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Allowed fields per type: task = status, priority, assignedUserId, assignedDepartmentId, dueDate, title, description, completedAt;
              customer = status, leadScore, assignedUserId, notes, stage, country;
              hospital/clinic = status, notes, isActive; invoice = status, paidDate, notes.
              Other fields are silently ignored.
            </p>
          </div>
        </div>
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
                              <details>
                                <summary className="cursor-pointer text-[11px] text-muted-foreground">Raw JSON</summary>
                                <pre className="mt-1 bg-background p-2 rounded overflow-auto text-[10px] max-h-72">
                                  {JSON.stringify(detailQ.data, null, 2)}
                                </pre>
                              </details>
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
