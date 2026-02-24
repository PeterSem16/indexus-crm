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
  Volume2,
  Play,
  Square,
  AlertTriangle,
  User,
  UserX,
  Megaphone,
  Mail,
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
  overflowIvrMenuId: string | null;
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
  noAgentsIvrMenuId: string | null;
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

const STRATEGY_VALUES = ["round-robin", "least-calls", "longest-idle", "skills-based", "random", "ring-all"] as const;
const OVERFLOW_ACTION_VALUES = ["voicemail", "hangup", "transfer", "queue", "user_pjsip", "announcement", "ivr"] as const;
const AFTER_HOURS_ACTION_VALUES = ["voicemail", "hangup", "transfer", "queue", "user_pjsip", "announcement"] as const;
const NO_AGENTS_ACTION_VALUES = ["wait", "voicemail", "hangup", "transfer", "queue", "user_pjsip", "announcement", "ivr"] as const;

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
  overflowIvrMenuId: string | null;
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
  noAgentsIvrMenuId: string | null;
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
  overflowAction: "voicemail", overflowTarget: "", overflowUserId: null, overflowVoicemailBoxId: null, overflowMessageId: null, overflowIvrMenuId: null,
  announcePosition: true, announceWaitTime: true,
  announceFrequency: 30, announcePositionMessageId: null, announceWaitTimeMessageId: null,
  serviceLevelTarget: 20,
  activeFrom: "", activeTo: "", activeDays: ["1", "2", "3", "4", "5"],
  timezone: "Europe/Bratislava", afterHoursAction: "voicemail",
  afterHoursTarget: "", afterHoursMessageId: null, afterHoursVoicemailBoxId: null,
  noAgentsAction: "wait", noAgentsTarget: "", noAgentsMessageId: null, noAgentsVoicemailBoxId: null, noAgentsUserId: null, noAgentsIvrMenuId: null,
  emailEnabled: false, emailAccountId: null, smsEnabled: false, smsPhoneNumber: null,
  recordCalls: false, isActive: true,
};


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

  const { data: ivrMenusList = [] } = useQuery<any[]>({
    queryKey: ["/api/ivr-menus"],
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
      "ring-all": iq.ringAll,
    };
    return map[s] || s;
  };

  const overflowActionLabel = (v: string) => {
    const map: Record<string, string> = {
      voicemail: iq.voicemail,
      hangup: iq.hangup,
      transfer: tx.transferToNumber,
      queue: tx.routeToQueue,
      user_pjsip: tx.transferToUser,
      announcement: tx.playAnnouncement,
      ivr: tx.routeToIvr || "IVR menu",
    };
    return map[v] || v;
  };

  const afterHoursActionLabel = (v: string) => overflowActionLabel(v);

  const noAgentsActionLabel = (v: string) => {
    if (v === "wait") return tx.waitInQueue;
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

  const AudioSelector = ({ label, helpText, value, onChange, messages }: {
    label: string;
    helpText?: string;
    value: string | null;
    onChange: (v: string | null) => void;
    messages: any[];
  }) => (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <div className="flex gap-2">
        <Select value={value || "__none__"} onValueChange={v => onChange(v === "__none__" ? null : v)}>
          <SelectTrigger className="flex-1"><SelectValue placeholder={tx.none} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">{tx.none}</SelectItem>
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
      {helpText && <p className="text-xs text-muted-foreground/70 italic">{helpText}</p>}
    </div>
  );

  return (
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
          <div className="text-center py-8 text-muted-foreground">{tx.loading}</div>
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
                          onClick={() => { if (confirm(tx.confirmDelete)) deleteMutation.mutate(queue.id); }}
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
              <TabsList>
                <TabsTrigger value="general" data-testid="tab-queue-general">
                  {tx.tabGeneral}
                </TabsTrigger>
                <TabsTrigger value="audio" data-testid="tab-queue-audio">
                  {tx.tabAudio}
                </TabsTrigger>
                <TabsTrigger value="overflow" data-testid="tab-queue-overflow">
                  {tx.tabOverflow}
                </TabsTrigger>
                <TabsTrigger value="hours" data-testid="tab-queue-hours">
                  {tx.tabHours}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="mt-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  <div className="col-span-1 md:col-span-2 space-y-1.5">
                    <Label className="text-sm">{iq.queueName} <span className="text-destructive">*</span></Label>
                    <Input value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} data-testid="input-queue-name" />
                    <p className="text-xs text-muted-foreground/70 italic">{tx.helpName}</p>
                  </div>
                  <div className="col-span-1 md:col-span-2 space-y-1.5">
                    <Label className="text-sm">{iq.description}</Label>
                    <Textarea value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} data-testid="input-queue-description" />
                    <p className="text-xs text-muted-foreground/70 italic">{tx.helpDescription}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">{tx.country}</Label>
                    <Select value={formData.countryCode} onValueChange={v => setFormData(f => ({ ...f, countryCode: v }))}>
                      <SelectTrigger data-testid="select-queue-country"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground/70 italic">{tx.helpCountry}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">{iq.strategy}</Label>
                    <Select value={formData.strategy} onValueChange={v => setFormData(f => ({ ...f, strategy: v }))}>
                      <SelectTrigger data-testid="select-queue-strategy"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STRATEGY_VALUES.map(s => <SelectItem key={s} value={s}>{strategyLabel(s)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground/70 italic">{tx.helpStrategy}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">{iq.priority}</Label>
                    <Input type="number" min={1} max={10} value={formData.priority} onChange={e => setFormData(f => ({ ...f, priority: parseInt(e.target.value) || 1 }))} data-testid="input-queue-priority" />
                    <p className="text-xs text-muted-foreground/70 italic">{tx.helpPriority}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">{iq.maxWaitTime}</Label>
                    <Input type="number" min={10} value={formData.maxWaitTime} onChange={e => setFormData(f => ({ ...f, maxWaitTime: parseInt(e.target.value) || 300 }))} data-testid="input-max-wait" />
                    <p className="text-xs text-muted-foreground/70 italic">{tx.helpMaxWaitTime}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">{iq.wrapUpTime}</Label>
                    <Input type="number" min={0} value={formData.wrapUpTime} onChange={e => setFormData(f => ({ ...f, wrapUpTime: parseInt(e.target.value) || 30 }))} data-testid="input-wrap-up-time" />
                    <p className="text-xs text-muted-foreground/70 italic">{tx.helpWrapUpTime}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">{iq.maxQueueSize}</Label>
                    <Input type="number" min={1} value={formData.maxQueueSize} onChange={e => setFormData(f => ({ ...f, maxQueueSize: parseInt(e.target.value) || 50 }))} data-testid="input-max-size" />
                    <p className="text-xs text-muted-foreground/70 italic">{tx.helpMaxQueueSize}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">{iq.serviceLevelTarget}</Label>
                    <Input type="number" min={1} value={formData.serviceLevelTarget} onChange={e => setFormData(f => ({ ...f, serviceLevelTarget: parseInt(e.target.value) || 20 }))} data-testid="input-sla-target" />
                    <p className="text-xs text-muted-foreground/70 italic">{tx.helpSlaTarget}</p>
                  </div>

                  <div className="col-span-1 md:col-span-2 flex flex-wrap gap-x-8 gap-y-3 py-3 px-4 rounded-lg bg-muted/30">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <Switch checked={formData.recordCalls} onCheckedChange={v => setFormData(f => ({ ...f, recordCalls: v }))} data-testid="switch-queue-record" />
                        <Label className="text-sm">{tx.recordCalls}</Label>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 ml-11">{tx.helpRecordCalls}</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <Switch checked={formData.isActive} onCheckedChange={v => setFormData(f => ({ ...f, isActive: v }))} data-testid="switch-queue-active" />
                        <Label className="text-sm">{tx.isActive}</Label>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 ml-11">{tx.helpIsActive}</p>
                    </div>
                  </div>
                </div>

                <div className="border-b pb-1">
                  <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <UserX className="h-4 w-4" />
                    {tx.noAgentsRule}
                  </h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm">{tx.noAgentsAction}</Label>
                    <Select value={formData.noAgentsAction} onValueChange={v => setFormData(f => ({ ...f, noAgentsAction: v }))}>
                      <SelectTrigger data-testid="select-no-agents-action"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {NO_AGENTS_ACTION_VALUES.map(a => <SelectItem key={a} value={a}>{noAgentsActionLabel(a)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground/70 italic">{tx.helpNoAgentsAction}</p>
                  </div>
                  {(formData.noAgentsAction === "transfer" || formData.noAgentsAction === "queue") && (
                    <div className="space-y-1.5">
                      <Label className="text-sm">{formData.noAgentsAction === "queue" ? tx.routeToQueue : tx.transferToNumber}</Label>
                      {formData.noAgentsAction === "queue" ? (
                        <Select value={formData.noAgentsTarget || "__none__"} onValueChange={v => setFormData(f => ({ ...f, noAgentsTarget: v === "__none__" ? "" : v }))}>
                          <SelectTrigger data-testid="select-no-agents-queue"><SelectValue placeholder={tx.none} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">{tx.none}</SelectItem>
                            {queues.filter(q => !editingQueue || q.id !== editingQueue.id).map(q => (
                              <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input value={formData.noAgentsTarget} onChange={e => setFormData(f => ({ ...f, noAgentsTarget: e.target.value }))} placeholder={tx.transferToNumber} data-testid="input-no-agents-target" />
                      )}
                      <p className="text-xs text-muted-foreground/70 italic">{tx.helpNoAgentsTarget}</p>
                    </div>
                  )}
                  {formData.noAgentsAction === "user_pjsip" && (
                    <div className="space-y-1.5">
                      <Label className="text-sm">{tx.transferToUser}</Label>
                      <Select value={formData.noAgentsUserId || "__none__"} onValueChange={v => setFormData(f => ({ ...f, noAgentsUserId: v === "__none__" ? null : v }))}>
                        <SelectTrigger data-testid="select-no-agents-user"><SelectValue placeholder={tx.none} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{tx.none}</SelectItem>
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
                      <p className="text-xs text-muted-foreground/70 italic">{tx.helpNoAgentsUser}</p>
                    </div>
                  )}
                  {formData.noAgentsAction === "voicemail" && (
                    <div className="space-y-1.5">
                      <Label className="text-sm">{iq.voicemail}</Label>
                      <Select value={formData.noAgentsVoicemailBoxId || "__none__"} onValueChange={v => setFormData(f => ({ ...f, noAgentsVoicemailBoxId: v === "__none__" ? null : v }))}>
                        <SelectTrigger data-testid="select-no-agents-voicemail-box"><SelectValue placeholder={tx.none} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{tx.none}</SelectItem>
                          {voicemailBoxes.filter((b: any) => b.isActive).map((b: any) => (
                            <SelectItem key={b.id} value={b.id}>{b.name}{b.extension ? ` (${b.extension})` : ""}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground/70 italic">{tx.helpNoAgentsVoicemail}</p>
                    </div>
                  )}
                  {formData.noAgentsAction === "announcement" && (
                    <div className="space-y-1.5">
                      <Label className="text-sm">{tx.announcementAudio}</Label>
                      <Select value={formData.noAgentsMessageId || "__none__"} onValueChange={v => setFormData(f => ({ ...f, noAgentsMessageId: v === "__none__" ? null : v }))}>
                        <SelectTrigger data-testid="select-no-agents-announcement"><SelectValue placeholder={tx.none} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{tx.none}</SelectItem>
                          {ivrMessages.filter((m: any) => m.type === "announcement" || m.type === "ivr_prompt").map((m: any) => (
                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground/70 italic">{tx.helpNoAgentsAnnouncement}</p>
                    </div>
                  )}
                  {formData.noAgentsAction === "ivr" && (
                    <div className="space-y-1.5">
                      <Label className="text-sm">{tx.ivrMenu || "IVR menu"}</Label>
                      <Select value={formData.noAgentsIvrMenuId || "__none__"} onValueChange={v => setFormData(f => ({ ...f, noAgentsIvrMenuId: v === "__none__" ? null : v }))}>
                        <SelectTrigger data-testid="select-no-agents-ivr-menu"><SelectValue placeholder={tx.none} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{tx.none}</SelectItem>
                          {ivrMenusList.map((m: any) => (
                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground italic">{tx.helpNoAgentsIvr || "Volajúci bude presmerovaný do IVR menu"}</p>
                    </div>
                  )}
                  {formData.noAgentsAction !== "announcement" && formData.noAgentsAction !== "ivr" && (
                    <AudioSelector
                      label={tx.noAgentsMessage}
                      helpText={tx.helpNoAgentsMessage}
                      value={formData.noAgentsMessageId}
                      onChange={v => setFormData(f => ({ ...f, noAgentsMessageId: v }))}
                      messages={ivrMessages.filter((m: any) => m.isActive)}
                    />
                  )}
                </div>

                <div className="border-b pb-1">
                  <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {tx.channels}
                  </h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <Switch checked={formData.emailEnabled} onCheckedChange={v => setFormData(f => ({ ...f, emailEnabled: v }))} data-testid="switch-email-enabled" />
                        <Label className="text-sm">{tx.emailEnabled}</Label>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 ml-11">{tx.helpEmailEnabled}</p>
                    </div>
                    {formData.emailEnabled && (
                      <div className="space-y-1.5">
                        <Label className="text-sm">{tx.emailAccount}</Label>
                        <Input value={formData.emailAccountId || ""} onChange={e => setFormData(f => ({ ...f, emailAccountId: e.target.value || null }))} placeholder={tx.emailAccount} data-testid="input-email-account" />
                        <p className="text-xs text-muted-foreground/70 italic">{tx.helpEmailAccount}</p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <Switch checked={formData.smsEnabled} onCheckedChange={v => setFormData(f => ({ ...f, smsEnabled: v }))} data-testid="switch-sms-enabled" />
                        <Label className="text-sm">{tx.smsEnabled}</Label>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 ml-11">{tx.helpSmsEnabled}</p>
                    </div>
                    {formData.smsEnabled && (
                      <div className="space-y-1.5">
                        <Label className="text-sm">{tx.smsPhone}</Label>
                        <Input value={formData.smsPhoneNumber || ""} onChange={e => setFormData(f => ({ ...f, smsPhoneNumber: e.target.value || null }))} placeholder={tx.smsPhone} data-testid="input-sms-phone" />
                        <p className="text-xs text-muted-foreground/70 italic">{tx.helpSmsPhone}</p>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="audio" className="mt-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  <AudioSelector
                    label={tx.welcomeGreeting}
                    helpText={tx.helpWelcomeMessage}
                    value={formData.welcomeMessageId}
                    onChange={v => setFormData(f => ({ ...f, welcomeMessageId: v }))}
                    messages={welcomeMessages}
                  />
                  <AudioSelector
                    label={tx.holdMusic}
                    helpText={tx.helpHoldMusic}
                    value={formData.holdMusicId}
                    onChange={v => setFormData(f => ({ ...f, holdMusicId: v }))}
                    messages={holdMusicMessages}
                  />
                </div>

                <div className="border-b pb-1">
                  <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Megaphone className="h-4 w-4" />
                    {tx.audioAnnouncements}
                  </h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <Switch checked={formData.announcePosition} onCheckedChange={v => setFormData(f => ({ ...f, announcePosition: v }))} data-testid="switch-announce-position" />
                        <Label className="text-sm">{iq.announcePosition}</Label>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 ml-11">{tx.helpAnnouncePosition}</p>
                    </div>
                    {formData.announcePosition && (
                      <AudioSelector
                        label={tx.positionMessage}
                        helpText={tx.helpPositionMessage}
                        value={formData.announcePositionMessageId}
                        onChange={v => setFormData(f => ({ ...f, announcePositionMessageId: v }))}
                        messages={announceMessages}
                      />
                    )}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <Switch checked={formData.announceWaitTime} onCheckedChange={v => setFormData(f => ({ ...f, announceWaitTime: v }))} data-testid="switch-announce-wait" />
                        <Label className="text-sm">{iq.announceWaitTime}</Label>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 ml-11">{tx.helpAnnounceWaitTime}</p>
                    </div>
                    {formData.announceWaitTime && (
                      <AudioSelector
                        label={tx.waitTimeMessage}
                        helpText={tx.helpWaitTimeMessage}
                        value={formData.announceWaitTimeMessageId}
                        onChange={v => setFormData(f => ({ ...f, announceWaitTimeMessageId: v }))}
                        messages={announceMessages}
                      />
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">{tx.announceFrequency}</Label>
                    <Input type="number" min={10} max={300} value={formData.announceFrequency} onChange={e => setFormData(f => ({ ...f, announceFrequency: parseInt(e.target.value) || 30 }))} data-testid="input-announce-freq" />
                    <p className="text-xs text-muted-foreground/70 italic">{tx.helpAnnounceFrequency}</p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground border-t pt-3">
                  {tx.audioNote}
                </p>
              </TabsContent>

              <TabsContent value="overflow" className="mt-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm">{iq.overflowAction}</Label>
                    <Select value={formData.overflowAction} onValueChange={v => setFormData(f => ({ ...f, overflowAction: v }))}>
                      <SelectTrigger data-testid="select-overflow-action"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {OVERFLOW_ACTION_VALUES.map(a => <SelectItem key={a} value={a}>{overflowActionLabel(a)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground/70 italic">{tx.helpOverflowAction}</p>
                  </div>
                  {formData.overflowAction === "transfer" && (
                    <div className="space-y-1.5">
                      <Label className="text-sm">{tx.transferToNumber}</Label>
                      <Input value={formData.overflowTarget} onChange={e => setFormData(f => ({ ...f, overflowTarget: e.target.value }))} placeholder={tx.transferToNumber} data-testid="input-overflow-target" />
                      <p className="text-xs text-muted-foreground/70 italic">{tx.helpOverflowTarget}</p>
                    </div>
                  )}
                  {formData.overflowAction === "queue" && (
                    <div className="space-y-1.5">
                      <Label className="text-sm">{tx.routeToQueue}</Label>
                      <Select value={formData.overflowTarget || "__none__"} onValueChange={v => setFormData(f => ({ ...f, overflowTarget: v === "__none__" ? "" : v }))}>
                        <SelectTrigger data-testid="select-overflow-queue"><SelectValue placeholder={tx.none} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{tx.none}</SelectItem>
                          {queues.filter(q => !editingQueue || q.id !== editingQueue.id).map(q => (
                            <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground/70 italic">{tx.helpOverflowTarget}</p>
                    </div>
                  )}
                  {formData.overflowAction === "user_pjsip" && (
                    <div className="space-y-1.5">
                      <Label className="text-sm">{tx.transferToUser}</Label>
                      <Select value={formData.overflowUserId || "__none__"} onValueChange={v => setFormData(f => ({ ...f, overflowUserId: v === "__none__" ? null : v }))}>
                        <SelectTrigger data-testid="select-overflow-user"><SelectValue placeholder={tx.none} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{tx.none}</SelectItem>
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
                      <p className="text-xs text-muted-foreground/70 italic">{tx.helpOverflowUser}</p>
                    </div>
                  )}
                  {formData.overflowAction === "voicemail" && (
                    <div className="space-y-1.5">
                      <Label className="text-sm">{iq.voicemail}</Label>
                      <Select value={formData.overflowVoicemailBoxId || "__none__"} onValueChange={v => setFormData(f => ({ ...f, overflowVoicemailBoxId: v === "__none__" ? null : v }))}>
                        <SelectTrigger data-testid="select-overflow-voicemail-box"><SelectValue placeholder={tx.none} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{tx.none}</SelectItem>
                          {voicemailBoxes.filter((b: any) => b.isActive).map((b: any) => (
                            <SelectItem key={b.id} value={b.id}>{b.name}{b.extension ? ` (${b.extension})` : ""}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground/70 italic">{tx.helpOverflowVoicemail}</p>
                    </div>
                  )}
                  {formData.overflowAction === "announcement" && (
                    <div className="space-y-1.5">
                      <Label className="text-sm">{tx.announcementAudio}</Label>
                      <Select value={formData.overflowMessageId || "__none__"} onValueChange={v => setFormData(f => ({ ...f, overflowMessageId: v === "__none__" ? null : v }))}>
                        <SelectTrigger data-testid="select-overflow-announcement"><SelectValue placeholder={tx.none} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{tx.none}</SelectItem>
                          {ivrMessages.filter((m: any) => m.type === "announcement" || m.type === "ivr_prompt").map((m: any) => (
                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground/70 italic">{tx.helpOverflowAnnouncement}</p>
                    </div>
                  )}
                  {formData.overflowAction === "ivr" && (
                    <div className="space-y-1.5">
                      <Label className="text-sm">{tx.ivrMenu || "IVR menu"}</Label>
                      <Select value={formData.overflowIvrMenuId || "__none__"} onValueChange={v => setFormData(f => ({ ...f, overflowIvrMenuId: v === "__none__" ? null : v }))}>
                        <SelectTrigger data-testid="select-overflow-ivr-menu"><SelectValue placeholder={tx.none} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{tx.none}</SelectItem>
                          {ivrMenusList.map((m: any) => (
                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground italic">{tx.helpOverflowIvr || "Volajúci bude presmerovaný do IVR menu"}</p>
                    </div>
                  )}
                </div>

                {formData.overflowAction === "user_pjsip" && pjsipUsers.length === 0 && (
                  <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      {tx.noSipUsersWarning}
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="hours" className="mt-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm">{tx.activeFrom}</Label>
                    <Input type="time" value={formData.activeFrom || ""} onChange={e => setFormData(f => ({ ...f, activeFrom: e.target.value || null }))} data-testid="input-active-from" />
                    <p className="text-xs text-muted-foreground/70 italic">{tx.helpActiveFrom}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">{tx.activeTo}</Label>
                    <Input type="time" value={formData.activeTo || ""} onChange={e => setFormData(f => ({ ...f, activeTo: e.target.value || null }))} data-testid="input-active-to" />
                    <p className="text-xs text-muted-foreground/70 italic">{tx.helpActiveTo}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">{tx.timezone}</Label>
                    <Select value={formData.timezone} onValueChange={v => setFormData(f => ({ ...f, timezone: v }))}>
                      <SelectTrigger data-testid="select-timezone"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground/70 italic">{tx.helpTimezone}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">{tx.activeDays}</Label>
                    <div className="flex gap-1 flex-wrap">
                      {DAYS_OF_WEEK.map(day => (
                        <Button
                          key={day.value}
                          type="button"
                          size="sm"
                          variant={formData.activeDays.includes(day.value) ? "default" : "outline"}
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
                          {(tx as any)[`day${day.key.charAt(0).toUpperCase() + day.key.slice(1)}`] || day.key}
                        </Button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground/70 italic">{tx.helpActiveDays}</p>
                  </div>
                </div>

                {(formData.activeFrom || formData.activeTo) && (
                  <>
                    <div className="border-b pb-1">
                      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {tx.afterHoursHandling}
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-sm">{tx.afterHoursAction}</Label>
                        <Select value={formData.afterHoursAction} onValueChange={v => setFormData(f => ({ ...f, afterHoursAction: v }))}>
                          <SelectTrigger data-testid="select-after-hours-action"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {AFTER_HOURS_ACTION_VALUES.map(a => <SelectItem key={a} value={a}>{afterHoursActionLabel(a)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground/70 italic">{tx.helpAfterHoursAction}</p>
                      </div>
                      {(formData.afterHoursAction === "transfer" || formData.afterHoursAction === "queue") && (
                        <div className="space-y-1.5">
                          <Label className="text-sm">{formData.afterHoursAction === "queue" ? tx.routeToQueue : tx.transferToNumber}</Label>
                          {formData.afterHoursAction === "queue" ? (
                            <Select value={formData.afterHoursTarget || "__none__"} onValueChange={v => setFormData(f => ({ ...f, afterHoursTarget: v === "__none__" ? "" : v }))}>
                              <SelectTrigger data-testid="select-after-hours-queue"><SelectValue placeholder={tx.none} /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">{tx.none}</SelectItem>
                                {queues.filter(q => !editingQueue || q.id !== editingQueue.id).map(q => (
                                  <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input value={formData.afterHoursTarget} onChange={e => setFormData(f => ({ ...f, afterHoursTarget: e.target.value }))} placeholder={tx.transferToNumber} data-testid="input-after-hours-target" />
                          )}
                          <p className="text-xs text-muted-foreground/70 italic">{tx.helpAfterHoursTarget}</p>
                        </div>
                      )}
                      {formData.afterHoursAction === "user_pjsip" && (
                        <div className="space-y-1.5">
                          <Label className="text-sm">{tx.transferToUser}</Label>
                          <Select value={formData.afterHoursTarget || "__none__"} onValueChange={v => setFormData(f => ({ ...f, afterHoursTarget: v === "__none__" ? "" : v }))}>
                            <SelectTrigger data-testid="select-after-hours-user"><SelectValue placeholder={tx.none} /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">{tx.none}</SelectItem>
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
                          <p className="text-xs text-muted-foreground/70 italic">{tx.helpAfterHoursTarget}</p>
                        </div>
                      )}
                      {formData.afterHoursAction === "voicemail" && (
                        <div className="space-y-1.5">
                          <Label className="text-sm">{iq.voicemail}</Label>
                          <Select value={formData.afterHoursVoicemailBoxId || "__none__"} onValueChange={v => setFormData(f => ({ ...f, afterHoursVoicemailBoxId: v === "__none__" ? null : v }))}>
                            <SelectTrigger data-testid="select-after-hours-voicemail-box"><SelectValue placeholder={tx.none} /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">{tx.none}</SelectItem>
                              {voicemailBoxes.filter((b: any) => b.isActive).map((b: any) => (
                                <SelectItem key={b.id} value={b.id}>{b.name}{b.extension ? ` (${b.extension})` : ""}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground/70 italic">{tx.helpAfterHoursVoicemail}</p>
                        </div>
                      )}
                      <AudioSelector
                        label={tx.afterHoursMessage}
                        helpText={tx.helpAfterHoursMessage}
                        value={formData.afterHoursMessageId}
                        onChange={v => setFormData(f => ({ ...f, afterHoursMessageId: v }))}
                        messages={ivrMessages.filter((m: any) => m.isActive)}
                      />
                    </div>
                  </>
                )}

              </TabsContent>
            </Tabs>

            <DialogFooter className="border-t pt-4">
              <Button variant="outline" onClick={() => { setShowCreateDialog(false); setEditingQueue(null); }} data-testid="btn-cancel-queue">
                {tx.cancel}
              </Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="btn-save-queue">
                {editingQueue ? tx.update : tx.create}
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
              <div className="space-y-1.5">
                <Label className="text-sm">{tx.agent}</Label>
                <Select value={newMemberUserId} onValueChange={setNewMemberUserId}>
                  <SelectTrigger data-testid="select-member-user"><SelectValue placeholder={tx.agent} /></SelectTrigger>
                  <SelectContent>
                    {sipUsers.map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>{u.fullName || u.username}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">{tx.memberPriority}</Label>
                <Input type="number" min={0} max={10} value={newMemberPenalty} onChange={e => setNewMemberPenalty(parseInt(e.target.value) || 0)} data-testid="input-member-penalty" />
                <p className="text-xs text-muted-foreground/70 italic">{tx.memberPriorityHelp}</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddMemberDialog(null)} data-testid="btn-cancel-member">{tx.cancel}</Button>
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

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      available: tx.statusAvailable,
      busy: tx.statusBusy,
      break: tx.statusBreak,
      wrap_up: tx.statusWrapUp,
      offline: tx.statusOffline,
    };
    return map[status] || status;
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
              <TableHead>{tx.agent}</TableHead>
              <TableHead>{tx.sipExtension}</TableHead>
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
                    <span className="text-xs text-muted-foreground">{tx.notConfigured}</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${statusColor(member.agentStatus)}`} />
                    <span className="text-sm">{statusLabel(member.agentStatus)}</span>
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
                    onClick={() => { if (confirm(tx.confirmRemoveMember)) removeMemberMutation.mutate(member.id); }}
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
