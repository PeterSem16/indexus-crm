import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Phone,
  Plus,
  Pencil,
  Trash2,
  Users,
  PhoneIncoming,
  Clock,
  UserPlus,
  UserMinus,
  ChevronDown,
  ChevronUp,
  Music,
  Volume2,
  Play,
  Square,
  AlertTriangle,
  User,
  UserX,
  Settings2,
  Megaphone,
  Mail,
  MessageSquare,
  HelpCircle,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface InboundQueue {
  id: string;
  name: string;
  description: string | null;
  countryCode: string | null;
  didNumber: string | null;
  strategy: string;
  maxWaitTime: number;
  wrapUpTime: number;
  maxQueueSize: number;
  priority: number;
  welcomeMessageId: string | null;
  holdMusicId: string | null;
  overflowAction: string;
  overflowTarget: string | null;
  overflowUserId: string | null;
  overflowVoicemailBoxId: string | null;
  overflowMessageId: string | null;
  announcePosition: boolean;
  announceWaitTime: boolean;
  announceFrequency: number;
  announcePositionMessageId: string | null;
  announceWaitTimeMessageId: string | null;
  serviceLevelTarget: number;
  activeFrom: string | null;
  activeTo: string | null;
  activeDays: string[] | null;
  timezone: string;
  afterHoursAction: string;
  afterHoursTarget: string | null;
  afterHoursMessageId: string | null;
  afterHoursVoicemailBoxId: string | null;
  noAgentsAction: string;
  noAgentsTarget: string | null;
  noAgentsMessageId: string | null;
  noAgentsVoicemailBoxId: string | null;
  noAgentsUserId: string | null;
  emailEnabled: boolean;
  emailAccountId: string | null;
  smsEnabled: boolean;
  smsPhoneNumber: string | null;
  recordCalls: boolean;
  isActive: boolean;
  stats?: { waiting: number; active: number; agents: number };
  dids?: { didNumber: string; name: string | null; isActive: boolean }[];
}

interface QueueMemberWithUser {
  id: string;
  queueId: string;
  userId: string;
  penalty: number;
  skills: string[];
  isActive: boolean;
  user: { id: string; username: string; fullName: string; role: string; sipExtension?: string } | null;
  agentStatus: string;
  callsHandled: number;
}

const STRATEGY_VALUES = ["round-robin", "least-calls", "longest-idle", "skills-based", "random"] as const;
const OVERFLOW_ACTION_VALUES = ["voicemail", "hangup", "transfer", "queue", "user_pjsip", "announcement"] as const;
const AFTER_HOURS_ACTION_VALUES = ["voicemail", "hangup", "transfer", "queue", "user_pjsip", "announcement"] as const;
const NO_AGENTS_ACTION_VALUES = ["wait", "voicemail", "hangup", "transfer", "queue", "user_pjsip", "announcement"] as const;

const DAYS_OF_WEEK = [
  { value: "1", key: "mon" },
  { value: "2", key: "tue" },
  { value: "3", key: "wed" },
  { value: "4", key: "thu" },
  { value: "5", key: "fri" },
  { value: "6", key: "sat" },
  { value: "0", key: "sun" },
];

const TIMEZONES = [
  "Europe/Bratislava",
  "Europe/Prague",
  "Europe/Budapest",
  "Europe/Bucharest",
  "Europe/Rome",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "UTC",
];

const COUNTRIES = ["SK", "CZ", "HU", "RO", "IT", "DE", "US"];

interface FormData {
  name: string;
  description: string;
  countryCode: string;
  strategy: string;
  maxWaitTime: number;
  wrapUpTime: number;
  maxQueueSize: number;
  priority: number;
  welcomeMessageId: string | null;
  holdMusicId: string | null;
  overflowAction: string;
  overflowTarget: string;
  overflowUserId: string | null;
  overflowVoicemailBoxId: string | null;
  overflowMessageId: string | null;
  announcePosition: boolean;
  announceWaitTime: boolean;
  announceFrequency: number;
  announcePositionMessageId: string | null;
  announceWaitTimeMessageId: string | null;
  serviceLevelTarget: number;
  activeFrom: string | null;
  activeTo: string | null;
  activeDays: string[];
  timezone: string;
  afterHoursAction: string;
  afterHoursTarget: string;
  afterHoursMessageId: string | null;
  afterHoursVoicemailBoxId: string | null;
  noAgentsAction: string;
  noAgentsTarget: string;
  noAgentsMessageId: string | null;
  noAgentsVoicemailBoxId: string | null;
  noAgentsUserId: string | null;
  emailEnabled: boolean;
  emailAccountId: string | null;
  smsEnabled: boolean;
  smsPhoneNumber: string | null;
  recordCalls: boolean;
  isActive: boolean;
}

const defaultFormData: FormData = {
  name: "", description: "", countryCode: "SK",
  strategy: "round-robin", maxWaitTime: 300, wrapUpTime: 30,
  maxQueueSize: 50, priority: 1, welcomeMessageId: null, holdMusicId: null,
  overflowAction: "voicemail", overflowTarget: "", overflowUserId: null, overflowVoicemailBoxId: null, overflowMessageId: null,
  announcePosition: true, announceWaitTime: true,
  announceFrequency: 30, announcePositionMessageId: null, announceWaitTimeMessageId: null,
  serviceLevelTarget: 20,
  activeFrom: "", activeTo: "", activeDays: ["1", "2", "3", "4", "5"],
  timezone: "Europe/Bratislava", afterHoursAction: "voicemail",
  afterHoursTarget: "", afterHoursMessageId: null, afterHoursVoicemailBoxId: null,
  noAgentsAction: "wait", noAgentsTarget: "", noAgentsMessageId: null, noAgentsVoicemailBoxId: null, noAgentsUserId: null,
  emailEnabled: false, emailAccountId: null, smsEnabled: false, smsPhoneNumber: null,
  recordCalls: false, isActive: true,
};

function HelpTooltip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs">
        <p className="text-xs">{text}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function InboundQueuesTab() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingQueue, setEditingQueue] = useState<InboundQueue | null>(null);
  const [expandedQueue, setExpandedQueue] = useState<string | null>(null);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState<string | null>(null);
  const [newMemberUserId, setNewMemberUserId] = useState("");
  const [newMemberPenalty, setNewMemberPenalty] = useState(0);
  const [formData, setFormData] = useState<FormData>({ ...defaultFormData });
  const [formTab, setFormTab] = useState("general");

  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioRef = useState<HTMLAudioElement | null>(null);

  const iq = t.campaigns.inboundQueues;
  const tx = iq as any;

  const { data: queues = [], isLoading } = useQuery<InboundQueue[]>({
    queryKey: ["/api/inbound-queues"],
    refetchInterval: 5000,
  });

  const { data: allUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  const { data: ivrMessages = [] } = useQuery<any[]>({
    queryKey: ["/api/ivr-messages"],
  });

  const { data: voicemailBoxes = [] } = useQuery<any[]>({
    queryKey: ["/api/voicemail-boxes"],
  });

  const welcomeMessages = ivrMessages.filter((m: any) => m.type === "welcome" && m.isActive);
  const holdMusicMessages = ivrMessages.filter((m: any) => m.type === "hold_music" && m.isActive);
  const announceMessages = ivrMessages.filter((m: any) => ["announcement", "position", "wait_time"].includes(m.type) && m.isActive);

  const playAudio = (id: string) => {
    if (playingAudioId === id) {
      audioRef[0]?.pause();
      setPlayingAudioId(null);
      return;
    }
    if (audioRef[0]) audioRef[0].pause();
    const audio = new Audio(`/api/ivr-messages/${id}/audio`);
    audio.onended = () => setPlayingAudioId(null);
    audio.play();
    audioRef[1](audio);
    setPlayingAudioId(id);
  };

  const strategyLabel = (s: string) => {
    const map: Record<string, string> = {
      "round-robin": iq.roundRobin,
      "least-calls": iq.leastCalls,
      "longest-idle": iq.longestIdle,
      "skills-based": iq.skillsBased,
      "random": iq.random,
    };
    return map[s] || s;
  };

  const overflowActionLabel = (v: string) => {
    const map: Record<string, string> = {
      voicemail: iq.voicemail,
      hangup: iq.hangup,
      transfer: tx.transferToNumber || "Transfer to Number",
      queue: tx.routeToQueue || "Route to Queue",
      user_pjsip: tx.transferToUser || "Transfer to User",
      announcement: tx.playAnnouncement || "Play Announcement",
    };
    return map[v] || v;
  };

  const afterHoursActionLabel = (v: string) => overflowActionLabel(v);

  const noAgentsActionLabel = (v: string) => {
    if (v === "wait") return tx.waitInQueue || "Wait in Queue";
    return overflowActionLabel(v);
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/inbound-queues", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbound-queues"] });
      setShowCreateDialog(false);
      resetForm();
      toast({ title: iq.createQueue });
    },
    onError: (err: any) => {
      toast({ title: t.common.error, description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PUT", `/api/inbound-queues/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbound-queues"] });
      setEditingQueue(null);
      resetForm();
      toast({ title: iq.editQueue });
    },
    onError: (err: any) => {
      toast({ title: t.common.error, description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/inbound-queues/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbound-queues"] });
      toast({ title: iq.deleteQueue });
    },
    onError: (err: any) => {
      toast({ title: t.common.error, description: err.message, variant: "destructive" });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: ({ queueId, data }: { queueId: string; data: any }) =>
      apiRequest("POST", `/api/inbound-queues/${queueId}/members`, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbound-queues"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inbound-queues", variables.queueId] });
      setShowAddMemberDialog(null);
      setNewMemberUserId("");
      setNewMemberPenalty(0);
      toast({ title: iq.addAgent });
    },
    onError: (err: any) => {
      toast({ title: t.common.error, description: err.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ ...defaultFormData });
    setFormTab("general");
  };

  const openEdit = (queue: InboundQueue) => {
    setFormData({
      name: queue.name,
      description: queue.description || "",
      countryCode: queue.countryCode || "SK",
      strategy: queue.strategy,
      maxWaitTime: queue.maxWaitTime,
      wrapUpTime: queue.wrapUpTime,
      maxQueueSize: queue.maxQueueSize,
      priority: queue.priority,
      welcomeMessageId: queue.welcomeMessageId || null,
      holdMusicId: queue.holdMusicId || null,
      overflowAction: queue.overflowAction,
      overflowTarget: queue.overflowTarget || "",
      overflowUserId: queue.overflowUserId || null,
      overflowVoicemailBoxId: queue.overflowVoicemailBoxId || null,
      overflowMessageId: queue.overflowMessageId || null,
      announcePosition: queue.announcePosition,
      announceWaitTime: queue.announceWaitTime,
      announceFrequency: queue.announceFrequency,
      announcePositionMessageId: queue.announcePositionMessageId || null,
      announceWaitTimeMessageId: queue.announceWaitTimeMessageId || null,
      serviceLevelTarget: queue.serviceLevelTarget,
      activeFrom: queue.activeFrom || "",
      activeTo: queue.activeTo || "",
      activeDays: queue.activeDays || ["1", "2", "3", "4", "5"],
      timezone: queue.timezone || "Europe/Bratislava",
      afterHoursAction: queue.afterHoursAction || "voicemail",
      afterHoursTarget: queue.afterHoursTarget || "",
      afterHoursMessageId: queue.afterHoursMessageId || null,
      afterHoursVoicemailBoxId: queue.afterHoursVoicemailBoxId || null,
      noAgentsAction: queue.noAgentsAction || "wait",
      noAgentsTarget: queue.noAgentsTarget || "",
      noAgentsMessageId: queue.noAgentsMessageId || null,
      noAgentsVoicemailBoxId: queue.noAgentsVoicemailBoxId || null,
      noAgentsUserId: queue.noAgentsUserId || null,
      emailEnabled: queue.emailEnabled ?? false,
      emailAccountId: queue.emailAccountId || null,
      smsEnabled: queue.smsEnabled ?? false,
      smsPhoneNumber: queue.smsPhoneNumber || null,
      recordCalls: queue.recordCalls ?? false,
      isActive: queue.isActive,
    });
    setFormTab("general");
    setEditingQueue(queue);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({ title: t.common.error, description: iq.queueName, variant: "destructive" });
      return;
    }

    if (editingQueue) {
      updateMutation.mutate({ id: editingQueue.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const sipUsers = allUsers.filter((u: any) => u.sipEnabled || ["agent", "operator"].includes(u.role));
  const pjsipUsers = allUsers.filter((u: any) => u.sipEnabled && u.sipExtension);

  const AudioSelector = ({ label, helpText, value, onChange, messages, description }: {
    label: string;
    helpText?: string;
    value: string | null;
    onChange: (v: string | null) => void;
    messages: any[];
    description?: string;
  }) => (
    <div>
      {helpText ? (
        <div className="flex items-center gap-1.5">
          <Label>{label}</Label>
          <HelpTooltip text={helpText} />
        </div>
      ) : (
        <Label>{label}</Label>
      )}
      <div className="flex gap-2">
        <Select value={value || "__none__"} onValueChange={v => onChange(v === "__none__" ? null : v)}>
          <SelectTrigger className="flex-1"><SelectValue placeholder={tx.none || "None"} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">{tx.none || "None"}</SelectItem>
            {messages.map((m: any) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name} ({m.language?.toUpperCase()})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {value && (
          <Button type="button" variant="ghost" size="icon" onClick={() => playAudio(value)}>
            {playingAudioId === value ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
        )}
      </div>
      {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
    </div>
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold" data-testid="text-inbound-queues-title">
              {iq.title}
            </h3>
            <p className="text-sm text-muted-foreground">
              {iq.description}
            </p>
          </div>
          <Button onClick={() => { resetForm(); setShowCreateDialog(true); }} data-testid="btn-create-queue">
            <Plus className="h-4 w-4 mr-2" />
            {iq.createQueue}
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">{tx.loading || t.common.loading}</div>
        ) : queues.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <PhoneIncoming className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{iq.noQueues}</p>
              <Button className="mt-4" onClick={() => { resetForm(); setShowCreateDialog(true); }} data-testid="btn-create-first-queue">
                <Plus className="h-4 w-4 mr-2" />
                {iq.createFirst}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {queues.map((queue) => (
              <Card key={queue.id} className={!queue.isActive ? "opacity-60" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <PhoneIncoming className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base" data-testid={`text-queue-name-${queue.id}`}>
                          {queue.name}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {queue.dids && queue.dids.length > 0 && queue.dids.map((d, i) => (
                            <Badge key={i} variant="outline" className={`text-xs ${!d.isActive ? "opacity-50" : ""}`} data-testid={`badge-did-${queue.id}-${i}`}>
                              <Phone className="h-3 w-3 mr-1" />
                              {d.didNumber}
                            </Badge>
                          ))}
                          {queue.recordCalls && (
                            <Badge variant="outline" className="text-xs text-red-600 border-red-300 dark:text-red-400 dark:border-red-800">
                              <span className="h-2 w-2 rounded-full bg-red-500 mr-1 animate-pulse" />
                              REC
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            {strategyLabel(queue.strategy)}
                          </Badge>
                          {queue.countryCode && (
                            <Badge variant="outline" className="text-xs">{queue.countryCode}</Badge>
                          )}
                          {queue.activeFrom && queue.activeTo && (
                            <Badge variant="outline" className="text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              {queue.activeFrom}–{queue.activeTo}
                            </Badge>
                          )}
                          {!queue.isActive && (
                            <Badge variant="destructive" className="text-xs">{iq.inactive}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-center">
                          <div className="font-semibold text-orange-600" data-testid={`text-waiting-${queue.id}`}>
                            {queue.stats?.waiting || 0}
                          </div>
                          <div className="text-xs text-muted-foreground">{iq.waiting}</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-green-600" data-testid={`text-active-${queue.id}`}>
                            {queue.stats?.active || 0}
                          </div>
                          <div className="text-xs text-muted-foreground">{iq.active}</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold" data-testid={`text-agents-${queue.id}`}>
                            {queue.stats?.agents || 0}
                          </div>
                          <div className="text-xs text-muted-foreground">{iq.agents}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(queue)} data-testid={`btn-edit-queue-${queue.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon"
                          onClick={() => setExpandedQueue(expandedQueue === queue.id ? null : queue.id)}
                          data-testid={`btn-expand-queue-${queue.id}`}
                        >
                          {expandedQueue === queue.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon"
                          onClick={() => { if (confirm(tx.confirmDelete || "Delete this queue?")) deleteMutation.mutate(queue.id); }}
                          data-testid={`btn-delete-queue-${queue.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                {expandedQueue === queue.id && (
                  <QueueDetailPanel
                    queueId={queue.id}
                    sipUsers={sipUsers}
                    onAddMember={() => setShowAddMemberDialog(queue.id)}
                  />
                )}
              </Card>
            ))}
          </div>
        )}

        <Dialog open={showCreateDialog || !!editingQueue} onOpenChange={(o) => { if (!o) { setShowCreateDialog(false); setEditingQueue(null); } }}>
          <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto" data-testid="dialog-queue-form">
            <DialogHeader>
              <DialogTitle className="text-lg">{editingQueue ? iq.editQueue : iq.createQueue}</DialogTitle>
            </DialogHeader>

            <Tabs value={formTab} onValueChange={setFormTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="general" className="flex items-center gap-1.5 text-xs">
                  <Settings2 className="h-3.5 w-3.5" />
                  {tx.tabGeneral || "General"}
                </TabsTrigger>
                <TabsTrigger value="audio" className="flex items-center gap-1.5 text-xs">
                  <Volume2 className="h-3.5 w-3.5" />
                  {tx.tabAudio || "Audio & Announcements"}
                </TabsTrigger>
                <TabsTrigger value="overflow" className="flex items-center gap-1.5 text-xs">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {tx.tabOverflow || "Overflow & Routing"}
                </TabsTrigger>
                <TabsTrigger value="hours" className="flex items-center gap-1.5 text-xs">
                  <Clock className="h-3.5 w-3.5" />
                  {tx.tabHours || "Business Hours"}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <div className="flex items-center gap-1.5">
                      <Label>{iq.queueName} *</Label>
                      <HelpTooltip text={tx.helpName || "Unique name to identify this queue"} />
                    </div>
                    <Input value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} data-testid="input-queue-name" />
                  </div>
                  <div className="col-span-2">
                    <div className="flex items-center gap-1.5">
                      <Label>{iq.description}</Label>
                      <HelpTooltip text={tx.helpDescription || "Optional description of the queue purpose"} />
                    </div>
                    <Textarea value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} data-testid="input-queue-description" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Label>{tx.country || t.common.country}</Label>
                      <HelpTooltip text={tx.helpCountry || "Country this queue serves"} />
                    </div>
                    <Select value={formData.countryCode} onValueChange={v => setFormData(f => ({ ...f, countryCode: v }))}>
                      <SelectTrigger data-testid="select-queue-country"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Label>{iq.strategy}</Label>
                      <HelpTooltip text={tx.helpStrategy || "How calls are distributed among agents"} />
                    </div>
                    <Select value={formData.strategy} onValueChange={v => setFormData(f => ({ ...f, strategy: v }))}>
                      <SelectTrigger data-testid="select-queue-strategy"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STRATEGY_VALUES.map(s => <SelectItem key={s} value={s}>{strategyLabel(s)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Label>{iq.priority}</Label>
                      <HelpTooltip text={tx.helpPriority || "Queue priority (1-10). Lower number = higher priority"} />
                    </div>
                    <Input type="number" min={1} max={10} value={formData.priority} onChange={e => setFormData(f => ({ ...f, priority: parseInt(e.target.value) || 1 }))} data-testid="input-queue-priority" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Label>{iq.maxWaitTime}</Label>
                      <HelpTooltip text={tx.helpMaxWaitTime || "Maximum time (seconds) a caller waits before overflow action"} />
                    </div>
                    <Input type="number" min={10} value={formData.maxWaitTime} onChange={e => setFormData(f => ({ ...f, maxWaitTime: parseInt(e.target.value) || 300 }))} data-testid="input-max-wait" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Label>{iq.wrapUpTime}</Label>
                      <HelpTooltip text={tx.helpWrapUpTime || "Time (seconds) after a call before agent gets next call"} />
                    </div>
                    <Input type="number" min={0} value={formData.wrapUpTime} onChange={e => setFormData(f => ({ ...f, wrapUpTime: parseInt(e.target.value) || 30 }))} data-testid="input-wrap-up-time" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Label>{iq.maxQueueSize}</Label>
                      <HelpTooltip text={tx.helpMaxQueueSize || "Maximum number of callers that can wait in queue"} />
                    </div>
                    <Input type="number" min={1} value={formData.maxQueueSize} onChange={e => setFormData(f => ({ ...f, maxQueueSize: parseInt(e.target.value) || 50 }))} data-testid="input-max-size" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Label>{iq.serviceLevelTarget}</Label>
                      <HelpTooltip text={tx.helpSlaTarget || "Target time (seconds) to answer calls for SLA reporting"} />
                    </div>
                    <Input type="number" min={1} value={formData.serviceLevelTarget} onChange={e => setFormData(f => ({ ...f, serviceLevelTarget: parseInt(e.target.value) || 20 }))} data-testid="input-sla-target" />
                  </div>
                  <div className="col-span-2 flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Switch checked={formData.recordCalls} onCheckedChange={v => setFormData(f => ({ ...f, recordCalls: v }))} data-testid="switch-queue-record" />
                      <div className="flex items-center gap-1.5">
                        <Label>{tx.helpRecordCalls || "Record Calls"}</Label>
                        <HelpTooltip text={tx.helpRecordCalls || "Automatically record all calls in this queue"} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={formData.isActive} onCheckedChange={v => setFormData(f => ({ ...f, isActive: v }))} data-testid="switch-queue-active" />
                      <div className="flex items-center gap-1.5">
                        <Label>{iq.active}</Label>
                        <HelpTooltip text={tx.helpIsActive || "Enable or disable this queue"} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <UserX className="h-4 w-4" />
                    {tx.helpNoAgentsAction || "No Agents Rule"}
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Label>{tx.helpNoAgentsAction || "No Agents Action"}</Label>
                        <HelpTooltip text={tx.helpNoAgentsAction || "What happens when no agents are available in the queue"} />
                      </div>
                      <Select value={formData.noAgentsAction} onValueChange={v => setFormData(f => ({ ...f, noAgentsAction: v }))}>
                        <SelectTrigger data-testid="select-no-agents-action"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {NO_AGENTS_ACTION_VALUES.map(a => <SelectItem key={a} value={a}>{noAgentsActionLabel(a)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {(formData.noAgentsAction === "transfer" || formData.noAgentsAction === "queue") && (
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Label>{formData.noAgentsAction === "queue" ? (tx.routeToQueue || "Target Queue") : (tx.transferToNumber || "Transfer Target")}</Label>
                          <HelpTooltip text={tx.helpNoAgentsTarget || "Target for the no-agents action"} />
                        </div>
                        {formData.noAgentsAction === "queue" ? (
                          <Select value={formData.noAgentsTarget || "__none__"} onValueChange={v => setFormData(f => ({ ...f, noAgentsTarget: v === "__none__" ? "" : v }))}>
                            <SelectTrigger data-testid="select-no-agents-queue"><SelectValue placeholder={tx.none || "None"} /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">{tx.none || "None"}</SelectItem>
                              {queues.filter(q => !editingQueue || q.id !== editingQueue.id).map(q => (
                                <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input value={formData.noAgentsTarget} onChange={e => setFormData(f => ({ ...f, noAgentsTarget: e.target.value }))} placeholder={tx.transferToNumber || "Phone number or extension"} data-testid="input-no-agents-target" />
                        )}
                      </div>
                    )}
                    {formData.noAgentsAction === "user_pjsip" && (
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Label>{tx.transferToUser || "Transfer to User"}</Label>
                          <HelpTooltip text={tx.helpNoAgentsUser || "Transfer to user's SIP phone when no agents available"} />
                        </div>
                        <Select value={formData.noAgentsUserId || "__none__"} onValueChange={v => setFormData(f => ({ ...f, noAgentsUserId: v === "__none__" ? null : v }))}>
                          <SelectTrigger data-testid="select-no-agents-user"><SelectValue placeholder={tx.none || "None"} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">{tx.none || "None"}</SelectItem>
                            {pjsipUsers.map((u: any) => (
                              <SelectItem key={u.id} value={u.id}>
                                <span className="flex items-center gap-2">
                                  <User className="h-3 w-3" />
                                  {u.fullName || u.username}
                                  <span className="text-muted-foreground">({u.sipExtension})</span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {formData.noAgentsAction === "voicemail" && (
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Label>{iq.voicemail}</Label>
                          <HelpTooltip text={tx.helpNoAgentsVoicemail || "Voicemail box to route callers to"} />
                        </div>
                        <Select value={formData.noAgentsVoicemailBoxId || "__none__"} onValueChange={v => setFormData(f => ({ ...f, noAgentsVoicemailBoxId: v === "__none__" ? null : v }))}>
                          <SelectTrigger data-testid="select-no-agents-voicemail-box"><SelectValue placeholder={tx.none || "None"} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">{tx.none || "None"}</SelectItem>
                            {voicemailBoxes.filter((b: any) => b.isActive).map((b: any) => (
                              <SelectItem key={b.id} value={b.id}>{b.name}{b.extension ? ` (${b.extension})` : ""}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {formData.noAgentsAction === "announcement" && (
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Label>{tx.playAnnouncement || "Announcement Audio"}</Label>
                          <HelpTooltip text={tx.helpNoAgentsAnnouncement || "Audio message to play before hanging up"} />
                        </div>
                        <Select value={formData.noAgentsMessageId || "__none__"} onValueChange={v => setFormData(f => ({ ...f, noAgentsMessageId: v === "__none__" ? null : v }))}>
                          <SelectTrigger data-testid="select-no-agents-announcement"><SelectValue placeholder={tx.none || "None"} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">{tx.none || "None"}</SelectItem>
                            {ivrMessages.filter((m: any) => m.type === "announcement" || m.type === "ivr_prompt").map((m: any) => (
                              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {formData.noAgentsAction !== "announcement" && (
                      <div>
                        <AudioSelector
                          label={tx.helpNoAgentsMessage || "No Agents Message"}
                          helpText={tx.helpNoAgentsMessage || "Audio played before executing no-agents action"}
                          value={formData.noAgentsMessageId}
                          onChange={v => setFormData(f => ({ ...f, noAgentsMessageId: v }))}
                          messages={ivrMessages.filter((m: any) => m.isActive)}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {tx.helpEmailEnabled || "Channels"}
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Switch checked={formData.emailEnabled} onCheckedChange={v => setFormData(f => ({ ...f, emailEnabled: v }))} data-testid="switch-email-enabled" />
                        <div className="flex items-center gap-1.5">
                          <Label>{tx.helpEmailEnabled || "Accept Email"}</Label>
                          <HelpTooltip text={tx.helpEmailEnabled || "Enable email channel for this queue"} />
                        </div>
                      </div>
                      {formData.emailEnabled && (
                        <div>
                          <div className="flex items-center gap-1.5">
                            <Label>{tx.helpEmailAccount || "Email Account"}</Label>
                            <HelpTooltip text={tx.helpEmailAccount || "Email account ID to receive emails"} />
                          </div>
                          <Input value={formData.emailAccountId || ""} onChange={e => setFormData(f => ({ ...f, emailAccountId: e.target.value || null }))} placeholder={tx.helpEmailAccount || "Email account ID"} data-testid="input-email-account" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Switch checked={formData.smsEnabled} onCheckedChange={v => setFormData(f => ({ ...f, smsEnabled: v }))} data-testid="switch-sms-enabled" />
                        <div className="flex items-center gap-1.5">
                          <Label>{tx.helpSmsEnabled || "Accept SMS"}</Label>
                          <HelpTooltip text={tx.helpSmsEnabled || "Enable SMS channel for this queue"} />
                        </div>
                      </div>
                      {formData.smsEnabled && (
                        <div>
                          <div className="flex items-center gap-1.5">
                            <Label>{tx.helpSmsPhone || "SMS Phone Number"}</Label>
                            <HelpTooltip text={tx.helpSmsPhone || "Phone number to receive SMS messages"} />
                          </div>
                          <Input value={formData.smsPhoneNumber || ""} onChange={e => setFormData(f => ({ ...f, smsPhoneNumber: e.target.value || null }))} placeholder={tx.helpSmsPhone || "Phone number for SMS"} data-testid="input-sms-phone" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="audio" className="mt-4 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <AudioSelector
                    label={tx.helpWelcomeMessage || "Welcome Greeting"}
                    helpText={tx.helpWelcomeMessage || "Audio played when caller enters queue"}
                    value={formData.welcomeMessageId}
                    onChange={v => setFormData(f => ({ ...f, welcomeMessageId: v }))}
                    messages={welcomeMessages}
                  />
                  <AudioSelector
                    label={tx.helpHoldMusic || "Music on Hold"}
                    helpText={tx.helpHoldMusic || "Music played while caller waits"}
                    value={formData.holdMusicId}
                    onChange={v => setFormData(f => ({ ...f, holdMusicId: v }))}
                    messages={holdMusicMessages}
                  />
                </div>

                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Megaphone className="h-4 w-4" />
                    {tx.audioAnnouncements || "Queue Announcements"}
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Switch checked={formData.announcePosition} onCheckedChange={v => setFormData(f => ({ ...f, announcePosition: v }))} data-testid="switch-announce-position" />
                        <div className="flex items-center gap-1.5">
                          <Label>{iq.announcePosition}</Label>
                          <HelpTooltip text={tx.helpAnnouncePosition || "Announce caller's position in queue"} />
                        </div>
                      </div>
                      {formData.announcePosition && (
                        <AudioSelector
                          label={tx.helpPositionMessage || "Position Announcement Voice"}
                          helpText={tx.helpPositionMessage || "Voice message for 'You are number X in queue'"}
                          value={formData.announcePositionMessageId}
                          onChange={v => setFormData(f => ({ ...f, announcePositionMessageId: v }))}
                          messages={announceMessages}
                        />
                      )}
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Switch checked={formData.announceWaitTime} onCheckedChange={v => setFormData(f => ({ ...f, announceWaitTime: v }))} data-testid="switch-announce-wait" />
                        <div className="flex items-center gap-1.5">
                          <Label>{iq.announceWaitTime}</Label>
                          <HelpTooltip text={tx.helpAnnounceWaitTime || "Announce estimated wait time to callers"} />
                        </div>
                      </div>
                      {formData.announceWaitTime && (
                        <AudioSelector
                          label={tx.helpWaitTimeMessage || "Wait Time Announcement Voice"}
                          helpText={tx.helpWaitTimeMessage || "Voice message for 'Estimated wait time is X minutes'"}
                          value={formData.announceWaitTimeMessageId}
                          onChange={v => setFormData(f => ({ ...f, announceWaitTimeMessageId: v }))}
                          messages={announceMessages}
                        />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Label>{tx.helpAnnounceFrequency || "Announce Frequency (sec)"}</Label>
                        <HelpTooltip text={tx.helpAnnounceFrequency || "How often to announce position/wait time"} />
                      </div>
                      <Input type="number" min={10} max={300} value={formData.announceFrequency} onChange={e => setFormData(f => ({ ...f, announceFrequency: parseInt(e.target.value) || 30 }))} data-testid="input-announce-freq" />
                    </div>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground border-t pt-3">
                  {tx.audioNote || "Manage audio files in the IVR Audio tab. Create welcome greetings, hold music, and announcements there."}
                </p>
              </TabsContent>

              <TabsContent value="overflow" className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Label>{iq.overflowAction}</Label>
                      <HelpTooltip text={tx.helpOverflowAction || "What happens when max wait time is exceeded or queue is full"} />
                    </div>
                    <Select value={formData.overflowAction} onValueChange={v => setFormData(f => ({ ...f, overflowAction: v }))}>
                      <SelectTrigger data-testid="select-overflow-action"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {OVERFLOW_ACTION_VALUES.map(a => <SelectItem key={a} value={a}>{overflowActionLabel(a)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.overflowAction === "transfer" && (
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Label>{tx.transferToNumber || "Transfer Target"}</Label>
                        <HelpTooltip text={tx.helpOverflowTarget || "Phone number or extension to transfer to"} />
                      </div>
                      <Input value={formData.overflowTarget} onChange={e => setFormData(f => ({ ...f, overflowTarget: e.target.value }))} placeholder={tx.transferToNumber || "Phone number or extension"} data-testid="input-overflow-target" />
                    </div>
                  )}
                  {formData.overflowAction === "queue" && (
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Label>{tx.routeToQueue || "Target Queue"}</Label>
                        <HelpTooltip text={tx.helpOverflowTarget || "Queue to route overflow calls to"} />
                      </div>
                      <Select value={formData.overflowTarget || "__none__"} onValueChange={v => setFormData(f => ({ ...f, overflowTarget: v === "__none__" ? "" : v }))}>
                        <SelectTrigger data-testid="select-overflow-queue"><SelectValue placeholder={tx.none || "None"} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{tx.none || "None"}</SelectItem>
                          {queues.filter(q => !editingQueue || q.id !== editingQueue.id).map(q => (
                            <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {formData.overflowAction === "user_pjsip" && (
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Label>{tx.transferToUser || "Transfer to User"}</Label>
                        <HelpTooltip text={tx.helpOverflowUser || "Call will be transferred directly to this user's SIP phone"} />
                      </div>
                      <Select value={formData.overflowUserId || "__none__"} onValueChange={v => setFormData(f => ({ ...f, overflowUserId: v === "__none__" ? null : v }))}>
                        <SelectTrigger data-testid="select-overflow-user"><SelectValue placeholder={tx.none || "None"} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{tx.none || "None"}</SelectItem>
                          {pjsipUsers.map((u: any) => (
                            <SelectItem key={u.id} value={u.id}>
                              <span className="flex items-center gap-2">
                                <User className="h-3 w-3" />
                                {u.fullName || u.username}
                                <span className="text-muted-foreground">({u.sipExtension})</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {formData.overflowAction === "voicemail" && (
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Label>{iq.voicemail}</Label>
                        <HelpTooltip text={tx.helpOverflowVoicemail || "Select which voicemail box to route callers to"} />
                      </div>
                      <Select value={formData.overflowVoicemailBoxId || "__none__"} onValueChange={v => setFormData(f => ({ ...f, overflowVoicemailBoxId: v === "__none__" ? null : v }))}>
                        <SelectTrigger data-testid="select-overflow-voicemail-box"><SelectValue placeholder={tx.none || "None"} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{tx.none || "None"}</SelectItem>
                          {voicemailBoxes.filter((b: any) => b.isActive).map((b: any) => (
                            <SelectItem key={b.id} value={b.id}>{b.name}{b.extension ? ` (${b.extension})` : ""}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {formData.overflowAction === "announcement" && (
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Label>{tx.playAnnouncement || "Announcement Audio"}</Label>
                        <HelpTooltip text={tx.helpOverflowAnnouncement || "Audio message to play before hanging up"} />
                      </div>
                      <Select value={formData.overflowMessageId || "__none__"} onValueChange={v => setFormData(f => ({ ...f, overflowMessageId: v === "__none__" ? null : v }))}>
                        <SelectTrigger data-testid="select-overflow-announcement"><SelectValue placeholder={tx.none || "None"} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{tx.none || "None"}</SelectItem>
                          {ivrMessages.filter((m: any) => m.type === "announcement" || m.type === "ivr_prompt").map((m: any) => (
                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {formData.overflowAction === "user_pjsip" && pjsipUsers.length === 0 && (
                  <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      {tx.helpOverflowUser || "No users have SIP phone configured. Go to User Management to enable SIP and set an extension for users."}
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="hours" className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Label>{tx.helpActiveFrom || "Active From"}</Label>
                      <HelpTooltip text={tx.helpActiveFrom || "Start time for business hours. Leave empty for 24/7 operation"} />
                    </div>
                    <Input type="time" value={formData.activeFrom || ""} onChange={e => setFormData(f => ({ ...f, activeFrom: e.target.value || null }))} data-testid="input-active-from" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Label>{tx.helpActiveTo || "Active To"}</Label>
                      <HelpTooltip text={tx.helpActiveTo || "End time for business hours"} />
                    </div>
                    <Input type="time" value={formData.activeTo || ""} onChange={e => setFormData(f => ({ ...f, activeTo: e.target.value || null }))} data-testid="input-active-to" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Label>{tx.helpTimezone || "Timezone"}</Label>
                      <HelpTooltip text={tx.helpTimezone || "Timezone for business hours schedule"} />
                    </div>
                    <Select value={formData.timezone} onValueChange={v => setFormData(f => ({ ...f, timezone: v }))}>
                      <SelectTrigger data-testid="select-timezone"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Label>{tx.helpActiveDays || "Active Days"}</Label>
                      <HelpTooltip text={tx.helpActiveDays || "Days of the week when the queue is active"} />
                    </div>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {DAYS_OF_WEEK.map(day => (
                        <Button
                          key={day.value}
                          type="button"
                          size="sm"
                          variant={formData.activeDays.includes(day.value) ? "default" : "outline"}
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            setFormData(f => ({
                              ...f,
                              activeDays: f.activeDays.includes(day.value)
                                ? f.activeDays.filter(d => d !== day.value)
                                : [...f.activeDays, day.value],
                            }));
                          }}
                          data-testid={`btn-day-${day.value}`}
                        >
                          {day.key}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                {(formData.activeFrom || formData.activeTo) && (
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {tx.helpAfterHoursAction || "After-Hours Handling"}
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Label>{tx.helpAfterHoursAction || "After-Hours Action"}</Label>
                          <HelpTooltip text={tx.helpAfterHoursAction || "What happens when calls arrive outside business hours"} />
                        </div>
                        <Select value={formData.afterHoursAction} onValueChange={v => setFormData(f => ({ ...f, afterHoursAction: v }))}>
                          <SelectTrigger data-testid="select-after-hours-action"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {AFTER_HOURS_ACTION_VALUES.map(a => <SelectItem key={a} value={a}>{afterHoursActionLabel(a)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      {(formData.afterHoursAction === "transfer" || formData.afterHoursAction === "queue") && (
                        <div>
                          <div className="flex items-center gap-1.5">
                            <Label>{formData.afterHoursAction === "queue" ? (tx.routeToQueue || "Target Queue") : (tx.transferToNumber || "Transfer Target")}</Label>
                            <HelpTooltip text={tx.helpAfterHoursTarget || "Target for after-hours routing"} />
                          </div>
                          {formData.afterHoursAction === "queue" ? (
                            <Select value={formData.afterHoursTarget || "__none__"} onValueChange={v => setFormData(f => ({ ...f, afterHoursTarget: v === "__none__" ? "" : v }))}>
                              <SelectTrigger data-testid="select-after-hours-queue"><SelectValue placeholder={tx.none || "None"} /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">{tx.none || "None"}</SelectItem>
                                {queues.filter(q => !editingQueue || q.id !== editingQueue.id).map(q => (
                                  <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input value={formData.afterHoursTarget} onChange={e => setFormData(f => ({ ...f, afterHoursTarget: e.target.value }))} placeholder={tx.transferToNumber || "Phone number or extension"} data-testid="input-after-hours-target" />
                          )}
                        </div>
                      )}
                      {formData.afterHoursAction === "user_pjsip" && (
                        <div>
                          <div className="flex items-center gap-1.5">
                            <Label>{tx.transferToUser || "Transfer to User"}</Label>
                            <HelpTooltip text={tx.helpAfterHoursTarget || "Transfer to user's SIP phone after hours"} />
                          </div>
                          <Select value={formData.afterHoursTarget || "__none__"} onValueChange={v => setFormData(f => ({ ...f, afterHoursTarget: v === "__none__" ? "" : v }))}>
                            <SelectTrigger data-testid="select-after-hours-user"><SelectValue placeholder={tx.none || "None"} /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">{tx.none || "None"}</SelectItem>
                              {pjsipUsers.map((u: any) => (
                                <SelectItem key={u.id} value={u.id}>
                                  <span className="flex items-center gap-2">
                                    <User className="h-3 w-3" />
                                    {u.fullName || u.username}
                                    <span className="text-muted-foreground">({u.sipExtension})</span>
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {formData.afterHoursAction === "voicemail" && (
                        <div>
                          <div className="flex items-center gap-1.5">
                            <Label>{iq.voicemail}</Label>
                            <HelpTooltip text={tx.helpAfterHoursVoicemail || "Voicemail box to route after-hours callers to"} />
                          </div>
                          <Select value={formData.afterHoursVoicemailBoxId || "__none__"} onValueChange={v => setFormData(f => ({ ...f, afterHoursVoicemailBoxId: v === "__none__" ? null : v }))}>
                            <SelectTrigger data-testid="select-after-hours-voicemail-box"><SelectValue placeholder={tx.none || "None"} /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">{tx.none || "None"}</SelectItem>
                              {voicemailBoxes.filter((b: any) => b.isActive).map((b: any) => (
                                <SelectItem key={b.id} value={b.id}>{b.name}{b.extension ? ` (${b.extension})` : ""}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div>
                        <AudioSelector
                          label={tx.helpAfterHoursMessage || "After-Hours Message"}
                          helpText={tx.helpAfterHoursMessage || "Audio played before executing after-hours action"}
                          value={formData.afterHoursMessageId}
                          onChange={v => setFormData(f => ({ ...f, afterHoursMessageId: v }))}
                          messages={ivrMessages.filter((m: any) => m.isActive)}
                        />
                      </div>
                    </div>
                  </div>
                )}

              </TabsContent>
            </Tabs>

            <DialogFooter className="border-t pt-4">
              <Button variant="outline" onClick={() => { setShowCreateDialog(false); setEditingQueue(null); }} data-testid="btn-cancel-queue">
                {tx.cancel || t.common.cancel}
              </Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="btn-save-queue">
                {editingQueue ? (tx.update || "Update") : (tx.create || "Create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!showAddMemberDialog} onOpenChange={(o) => { if (!o) setShowAddMemberDialog(null); }}>
          <DialogContent data-testid="dialog-add-member">
            <DialogHeader>
              <DialogTitle>{iq.addAgent}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-1.5">
                  <Label>{tx.agent || "Agent"}</Label>
                  <HelpTooltip text={tx.agent || "Select an agent to add to this queue"} />
                </div>
                <Select value={newMemberUserId} onValueChange={setNewMemberUserId}>
                  <SelectTrigger data-testid="select-member-user"><SelectValue placeholder={tx.agent || "Select agent..."} /></SelectTrigger>
                  <SelectContent>
                    {sipUsers.map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>{u.fullName || u.username}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <Label>{tx.memberPriority || "Priority"}</Label>
                  <HelpTooltip text={tx.memberPriorityHelp || "Lower value = higher priority (0-10)"} />
                </div>
                <Input type="number" min={0} max={10} value={newMemberPenalty} onChange={e => setNewMemberPenalty(parseInt(e.target.value) || 0)} data-testid="input-member-penalty" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddMemberDialog(null)} data-testid="btn-cancel-member">{tx.cancel || t.common.cancel}</Button>
              <Button
                disabled={!newMemberUserId || addMemberMutation.isPending}
                onClick={() => {
                  if (showAddMemberDialog) {
                    addMemberMutation.mutate({ queueId: showAddMemberDialog, data: { userId: newMemberUserId, penalty: newMemberPenalty } });
                  }
                }}
                data-testid="btn-save-member"
              >
                {iq.addAgent}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

function QueueDetailPanel({ queueId, sipUsers, onAddMember }: {
  queueId: string;
  sipUsers: any[];
  onAddMember: () => void;
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const iq = t.campaigns.inboundQueues;
  const tx = iq as any;

  const { data: queueDetail } = useQuery<any>({
    queryKey: ["/api/inbound-queues", queueId],
    refetchInterval: 5000,
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => apiRequest("DELETE", `/api/queue-members/${memberId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbound-queues"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inbound-queues", queueId] });
      toast({ title: iq.removeAgent });
    },
  });

  const updateMemberMutation = useMutation({
    mutationFn: ({ memberId, data }: { memberId: string; data: { penalty: number } }) =>
      apiRequest("PUT", `/api/queue-members/${memberId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbound-queues", queueId] });
    },
    onError: (err: any) => {
      toast({ title: t.common.error, description: err.message, variant: "destructive" });
    },
  });

  const members: QueueMemberWithUser[] = queueDetail?.members || [];

  const statusColor = (status: string) => {
    switch (status) {
      case "available": return "bg-green-500";
      case "busy": return "bg-red-500";
      case "break": return "bg-yellow-500";
      case "wrap_up": return "bg-orange-500";
      default: return "bg-gray-400";
    }
  };

  const changePriority = (memberId: string, currentPenalty: number, delta: number) => {
    const newPenalty = Math.max(0, Math.min(10, currentPenalty + delta));
    if (newPenalty !== currentPenalty) {
      updateMemberMutation.mutate({ memberId, data: { penalty: newPenalty } });
    }
  };

  return (
    <CardContent className="border-t pt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Users className="h-4 w-4" />
          {iq.queueMembers} ({members.length})
        </h4>
        <Button size="sm" variant="outline" onClick={onAddMember} data-testid={`btn-add-member-${queueId}`}>
          <UserPlus className="h-3 w-3 mr-1" />
          {iq.addAgent}
        </Button>
      </div>

      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">{iq.noMembers}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tx.agent || "Agent"}</TableHead>
              <TableHead>{tx.sipExtension || "SIP Extension"}</TableHead>
              <TableHead>{iq.agentStatus}</TableHead>
              <TableHead>{iq.priority}</TableHead>
              <TableHead>{iq.callsHandled}</TableHead>
              <TableHead className="w-[80px]">{t.common.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <span data-testid={`text-member-name-${member.id}`}>
                    {member.user?.fullName || member.user?.username || t.common.unknown}
                  </span>
                </TableCell>
                <TableCell>
                  {member.user?.sipExtension ? (
                    <Badge variant="outline" className="text-xs font-mono">
                      <Phone className="h-3 w-3 mr-1" />
                      {member.user.sipExtension}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">{tx.notConfigured || "Not configured"}</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${statusColor(member.agentStatus)}`} />
                    <span className="text-sm capitalize">{member.agentStatus}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={member.penalty <= 0 || updateMemberMutation.isPending}
                      onClick={() => changePriority(member.id, member.penalty, -1)}
                      data-testid={`btn-priority-down-${member.id}`}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center font-medium text-sm" data-testid={`text-priority-${member.id}`}>{member.penalty}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={member.penalty >= 10 || updateMemberMutation.isPending}
                      onClick={() => changePriority(member.id, member.penalty, 1)}
                      data-testid={`btn-priority-up-${member.id}`}
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell>{member.callsHandled}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon"
                    onClick={() => { if (confirm(tx.confirmRemoveMember || "Remove this agent?")) removeMemberMutation.mutate(member.id); }}
                    data-testid={`btn-remove-member-${member.id}`}
                  >
                    <UserMinus className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </CardContent>
  );
}
