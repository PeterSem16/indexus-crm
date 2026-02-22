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
  Music,
  Volume2,
  Play,
  Square,
  AlertTriangle,
  User,
  Settings2,
  Megaphone,
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
  isActive: boolean;
  stats?: { waiting: number; active: number; agents: number };
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

const STRATEGIES = [
  { value: "round-robin", label: "Round Robin" },
  { value: "least-calls", label: "Least Calls" },
  { value: "longest-idle", label: "Longest Idle" },
  { value: "skills-based", label: "Skills Based" },
  { value: "random", label: "Random" },
];

const OVERFLOW_ACTIONS = [
  { value: "voicemail", label: "Voicemail" },
  { value: "hangup", label: "Hangup" },
  { value: "transfer", label: "Transfer to Number" },
  { value: "queue", label: "Route to Queue" },
  { value: "user_pjsip", label: "Transfer to User (PJSIP Phone)" },
];

const AFTER_HOURS_ACTIONS = [
  { value: "voicemail", label: "Voicemail" },
  { value: "hangup", label: "Hang up" },
  { value: "transfer", label: "Transfer to number" },
  { value: "queue", label: "Route to another Queue" },
  { value: "user_pjsip", label: "Transfer to User (PJSIP Phone)" },
];

const DAYS_OF_WEEK = [
  { value: "1", label: "Mon" },
  { value: "2", label: "Tue" },
  { value: "3", label: "Wed" },
  { value: "4", label: "Thu" },
  { value: "5", label: "Fri" },
  { value: "6", label: "Sat" },
  { value: "0", label: "Sun" },
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
  didNumber: string;
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
  isActive: boolean;
}

const defaultFormData: FormData = {
  name: "", description: "", countryCode: "SK", didNumber: "",
  strategy: "round-robin", maxWaitTime: 300, wrapUpTime: 30,
  maxQueueSize: 50, priority: 1, welcomeMessageId: null, holdMusicId: null,
  overflowAction: "voicemail", overflowTarget: "", overflowUserId: null,
  announcePosition: true, announceWaitTime: true,
  announceFrequency: 30, announcePositionMessageId: null, announceWaitTimeMessageId: null,
  serviceLevelTarget: 20,
  activeFrom: "", activeTo: "", activeDays: ["1", "2", "3", "4", "5"],
  timezone: "Europe/Bratislava", afterHoursAction: "voicemail",
  afterHoursTarget: "", afterHoursMessageId: null,
  isActive: true,
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

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/inbound-queues", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbound-queues"] });
      setShowCreateDialog(false);
      resetForm();
      toast({ title: "Queue created successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PUT", `/api/inbound-queues/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbound-queues"] });
      setEditingQueue(null);
      resetForm();
      toast({ title: "Queue updated successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/inbound-queues/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbound-queues"] });
      toast({ title: "Queue deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
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
      toast({ title: "Member added" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
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
      didNumber: queue.didNumber || "",
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
      isActive: queue.isActive,
    });
    setFormTab("general");
    setEditingQueue(queue);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({ title: "Error", description: "Queue name is required", variant: "destructive" });
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

  const strategyLabel = (s: string) => STRATEGIES.find(st => st.value === s)?.label || s;

  const AudioSelector = ({ label, value, onChange, messages, description }: {
    label: string;
    value: string | null;
    onChange: (v: string | null) => void;
    messages: any[];
    description?: string;
  }) => (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Select value={value || "__none__"} onValueChange={v => onChange(v === "__none__" ? null : v)}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="None" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None</SelectItem>
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold" data-testid="text-inbound-queues-title">
            Inbound Queues
          </h3>
          <p className="text-sm text-muted-foreground">
            Manage inbound call queues and agent assignments
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowCreateDialog(true); }} data-testid="btn-create-queue">
          <Plus className="h-4 w-4 mr-2" />
          Create Queue
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : queues.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <PhoneIncoming className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No inbound queues configured yet</p>
            <Button className="mt-4" onClick={() => { resetForm(); setShowCreateDialog(true); }} data-testid="btn-create-first-queue">
              <Plus className="h-4 w-4 mr-2" />
              Create First Queue
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
                      <div className="flex items-center gap-2 mt-1">
                        {queue.didNumber && (
                          <Badge variant="outline" className="text-xs" data-testid={`badge-did-${queue.id}`}>
                            <Phone className="h-3 w-3 mr-1" />
                            {queue.didNumber}
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
                          <Badge variant="destructive" className="text-xs">Inactive</Badge>
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
                        <div className="text-xs text-muted-foreground">Waiting</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-green-600" data-testid={`text-active-${queue.id}`}>
                          {queue.stats?.active || 0}
                        </div>
                        <div className="text-xs text-muted-foreground">Active</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold" data-testid={`text-agents-${queue.id}`}>
                          {queue.stats?.agents || 0}
                        </div>
                        <div className="text-xs text-muted-foreground">Agents</div>
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
                        onClick={() => { if (confirm("Delete this queue?")) deleteMutation.mutate(queue.id); }}
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
            <DialogTitle className="text-lg">{editingQueue ? "Edit Queue" : "Create Queue"}</DialogTitle>
          </DialogHeader>

          <Tabs value={formTab} onValueChange={setFormTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="general" className="flex items-center gap-1.5 text-xs">
                <Settings2 className="h-3.5 w-3.5" />
                General
              </TabsTrigger>
              <TabsTrigger value="audio" className="flex items-center gap-1.5 text-xs">
                <Volume2 className="h-3.5 w-3.5" />
                Audio & Announcements
              </TabsTrigger>
              <TabsTrigger value="overflow" className="flex items-center gap-1.5 text-xs">
                <AlertTriangle className="h-3.5 w-3.5" />
                Overflow & Routing
              </TabsTrigger>
              <TabsTrigger value="hours" className="flex items-center gap-1.5 text-xs">
                <Clock className="h-3.5 w-3.5" />
                Business Hours
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Name *</Label>
                  <Input value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} data-testid="input-queue-name" />
                </div>
                <div className="col-span-2">
                  <Label>Description</Label>
                  <Textarea value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} data-testid="input-queue-description" />
                </div>
                <div>
                  <Label>DID Number</Label>
                  <Input value={formData.didNumber} onChange={e => setFormData(f => ({ ...f, didNumber: e.target.value }))} placeholder="+421..." data-testid="input-queue-did" />
                </div>
                <div>
                  <Label>Country</Label>
                  <Select value={formData.countryCode} onValueChange={v => setFormData(f => ({ ...f, countryCode: v }))}>
                    <SelectTrigger data-testid="select-queue-country"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Routing Strategy</Label>
                  <Select value={formData.strategy} onValueChange={v => setFormData(f => ({ ...f, strategy: v }))}>
                    <SelectTrigger data-testid="select-queue-strategy"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STRATEGIES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Priority</Label>
                  <Input type="number" min={1} max={10} value={formData.priority} onChange={e => setFormData(f => ({ ...f, priority: parseInt(e.target.value) || 1 }))} data-testid="input-queue-priority" />
                </div>
                <div>
                  <Label>Max Wait Time (sec)</Label>
                  <Input type="number" min={10} value={formData.maxWaitTime} onChange={e => setFormData(f => ({ ...f, maxWaitTime: parseInt(e.target.value) || 300 }))} data-testid="input-max-wait" />
                </div>
                <div>
                  <Label>Wrap-Up Time (sec)</Label>
                  <Input type="number" min={0} value={formData.wrapUpTime} onChange={e => setFormData(f => ({ ...f, wrapUpTime: parseInt(e.target.value) || 30 }))} data-testid="input-wrap-up-time" />
                </div>
                <div>
                  <Label>Max Queue Size</Label>
                  <Input type="number" min={1} value={formData.maxQueueSize} onChange={e => setFormData(f => ({ ...f, maxQueueSize: parseInt(e.target.value) || 50 }))} data-testid="input-max-size" />
                </div>
                <div>
                  <Label>SLA Target (sec)</Label>
                  <Input type="number" min={1} value={formData.serviceLevelTarget} onChange={e => setFormData(f => ({ ...f, serviceLevelTarget: parseInt(e.target.value) || 20 }))} data-testid="input-sla-target" />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <Switch checked={formData.isActive} onCheckedChange={v => setFormData(f => ({ ...f, isActive: v }))} data-testid="switch-queue-active" />
                  <Label>Active</Label>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="audio" className="mt-4 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <AudioSelector
                  label="Welcome Greeting"
                  value={formData.welcomeMessageId}
                  onChange={v => setFormData(f => ({ ...f, welcomeMessageId: v }))}
                  messages={welcomeMessages}
                  description="Audio played when caller enters queue"
                />
                <AudioSelector
                  label="Music on Hold"
                  value={formData.holdMusicId}
                  onChange={v => setFormData(f => ({ ...f, holdMusicId: v }))}
                  messages={holdMusicMessages}
                  description="Music played while caller waits"
                />
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Megaphone className="h-4 w-4" />
                  Queue Announcements
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Switch checked={formData.announcePosition} onCheckedChange={v => setFormData(f => ({ ...f, announcePosition: v }))} data-testid="switch-announce-position" />
                      <Label>Announce Position in Queue</Label>
                    </div>
                    {formData.announcePosition && (
                      <AudioSelector
                        label="Position Announcement Voice"
                        value={formData.announcePositionMessageId}
                        onChange={v => setFormData(f => ({ ...f, announcePositionMessageId: v }))}
                        messages={announceMessages}
                        description="Voice message for 'You are number X in queue'"
                      />
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Switch checked={formData.announceWaitTime} onCheckedChange={v => setFormData(f => ({ ...f, announceWaitTime: v }))} data-testid="switch-announce-wait" />
                      <Label>Announce Estimated Wait Time</Label>
                    </div>
                    {formData.announceWaitTime && (
                      <AudioSelector
                        label="Wait Time Announcement Voice"
                        value={formData.announceWaitTimeMessageId}
                        onChange={v => setFormData(f => ({ ...f, announceWaitTimeMessageId: v }))}
                        messages={announceMessages}
                        description="Voice message for 'Estimated wait time is X minutes'"
                      />
                    )}
                  </div>
                  <div>
                    <Label>Announce Frequency (sec)</Label>
                    <Input type="number" min={10} max={300} value={formData.announceFrequency} onChange={e => setFormData(f => ({ ...f, announceFrequency: parseInt(e.target.value) || 30 }))} data-testid="input-announce-freq" />
                    <p className="text-xs text-muted-foreground mt-1">How often to announce position/wait time</p>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground border-t pt-3">
                Manage audio files in the IVR Audio tab. Create welcome greetings, hold music, and announcements there.
              </p>
            </TabsContent>

            <TabsContent value="overflow" className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Overflow Action</Label>
                  <Select value={formData.overflowAction} onValueChange={v => setFormData(f => ({ ...f, overflowAction: v }))}>
                    <SelectTrigger data-testid="select-overflow-action"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {OVERFLOW_ACTIONS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">What happens when max wait time is exceeded or queue is full</p>
                </div>
                {formData.overflowAction === "transfer" && (
                  <div>
                    <Label>Transfer Target</Label>
                    <Input value={formData.overflowTarget} onChange={e => setFormData(f => ({ ...f, overflowTarget: e.target.value }))} placeholder="Phone number or extension" data-testid="input-overflow-target" />
                  </div>
                )}
                {formData.overflowAction === "queue" && (
                  <div>
                    <Label>Target Queue</Label>
                    <Select value={formData.overflowTarget || "__none__"} onValueChange={v => setFormData(f => ({ ...f, overflowTarget: v === "__none__" ? "" : v }))}>
                      <SelectTrigger data-testid="select-overflow-queue"><SelectValue placeholder="Select queue" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {queues.filter(q => !editingQueue || q.id !== editingQueue.id).map(q => (
                          <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {formData.overflowAction === "user_pjsip" && (
                  <div>
                    <Label>Transfer to User (PJSIP Phone)</Label>
                    <Select value={formData.overflowUserId || "__none__"} onValueChange={v => setFormData(f => ({ ...f, overflowUserId: v === "__none__" ? null : v }))}>
                      <SelectTrigger data-testid="select-overflow-user"><SelectValue placeholder="Select user..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
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
                    <p className="text-xs text-muted-foreground mt-1">Call will be transferred directly to this user's SIP phone</p>
                  </div>
                )}
              </div>

              {formData.overflowAction === "user_pjsip" && pjsipUsers.length === 0 && (
                <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    No users have SIP phone configured. Go to User Management to enable SIP and set an extension for users.
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="hours" className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Active From</Label>
                  <Input type="time" value={formData.activeFrom || ""} onChange={e => setFormData(f => ({ ...f, activeFrom: e.target.value || null }))} data-testid="input-active-from" />
                  <p className="text-xs text-muted-foreground mt-1">Leave empty for 24/7 operation</p>
                </div>
                <div>
                  <Label>Active To</Label>
                  <Input type="time" value={formData.activeTo || ""} onChange={e => setFormData(f => ({ ...f, activeTo: e.target.value || null }))} data-testid="input-active-to" />
                </div>
                <div>
                  <Label>Timezone</Label>
                  <Select value={formData.timezone} onValueChange={v => setFormData(f => ({ ...f, timezone: v }))}>
                    <SelectTrigger data-testid="select-timezone"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Active Days</Label>
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
                        {day.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {(formData.activeFrom || formData.activeTo) && (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    After-Hours Handling
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>After-Hours Action</Label>
                      <Select value={formData.afterHoursAction} onValueChange={v => setFormData(f => ({ ...f, afterHoursAction: v }))}>
                        <SelectTrigger data-testid="select-after-hours-action"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {AFTER_HOURS_ACTIONS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">What happens when calls arrive outside business hours</p>
                    </div>
                    {(formData.afterHoursAction === "transfer" || formData.afterHoursAction === "queue") && (
                      <div>
                        <Label>{formData.afterHoursAction === "queue" ? "Target Queue" : "Transfer Target"}</Label>
                        {formData.afterHoursAction === "queue" ? (
                          <Select value={formData.afterHoursTarget || "__none__"} onValueChange={v => setFormData(f => ({ ...f, afterHoursTarget: v === "__none__" ? "" : v }))}>
                            <SelectTrigger data-testid="select-after-hours-queue"><SelectValue placeholder="Select queue" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">None</SelectItem>
                              {queues.filter(q => !editingQueue || q.id !== editingQueue.id).map(q => (
                                <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input value={formData.afterHoursTarget} onChange={e => setFormData(f => ({ ...f, afterHoursTarget: e.target.value }))} placeholder="Phone number or extension" data-testid="input-after-hours-target" />
                        )}
                      </div>
                    )}
                    {formData.afterHoursAction === "user_pjsip" && (
                      <div>
                        <Label>Transfer to User (PJSIP Phone)</Label>
                        <Select value={formData.afterHoursTarget || "__none__"} onValueChange={v => setFormData(f => ({ ...f, afterHoursTarget: v === "__none__" ? "" : v }))}>
                          <SelectTrigger data-testid="select-after-hours-user"><SelectValue placeholder="Select user..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
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
                    <div>
                      <AudioSelector
                        label="After-Hours Message"
                        value={formData.afterHoursMessageId}
                        onChange={v => setFormData(f => ({ ...f, afterHoursMessageId: v }))}
                        messages={ivrMessages.filter((m: any) => m.isActive)}
                        description="Audio played before executing after-hours action"
                      />
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); setEditingQueue(null); }} data-testid="btn-cancel-queue">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="btn-save-queue">
              {editingQueue ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showAddMemberDialog} onOpenChange={(o) => { if (!o) setShowAddMemberDialog(null); }}>
        <DialogContent data-testid="dialog-add-member">
          <DialogHeader>
            <DialogTitle>Add Agent to Queue</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Agent</Label>
              <Select value={newMemberUserId} onValueChange={setNewMemberUserId}>
                <SelectTrigger data-testid="select-member-user"><SelectValue placeholder="Select agent..." /></SelectTrigger>
                <SelectContent>
                  {sipUsers.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>{u.fullName || u.username}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority (lower = higher priority)</Label>
              <Input type="number" min={0} max={10} value={newMemberPenalty} onChange={e => setNewMemberPenalty(parseInt(e.target.value) || 0)} data-testid="input-member-penalty" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMemberDialog(null)} data-testid="btn-cancel-member">Cancel</Button>
            <Button
              disabled={!newMemberUserId || addMemberMutation.isPending}
              onClick={() => {
                if (showAddMemberDialog) {
                  addMemberMutation.mutate({ queueId: showAddMemberDialog, data: { userId: newMemberUserId, penalty: newMemberPenalty } });
                }
              }}
              data-testid="btn-save-member"
            >
              Add
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
  const { toast } = useToast();

  const { data: queueDetail } = useQuery<any>({
    queryKey: ["/api/inbound-queues", queueId],
    refetchInterval: 5000,
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => apiRequest("DELETE", `/api/queue-members/${memberId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbound-queues"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inbound-queues", queueId] });
      toast({ title: "Member removed" });
    },
  });

  const updateMemberMutation = useMutation({
    mutationFn: ({ memberId, data }: { memberId: string; data: { penalty: number } }) =>
      apiRequest("PUT", `/api/queue-members/${memberId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbound-queues", queueId] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
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
          Queue Members ({members.length})
        </h4>
        <Button size="sm" variant="outline" onClick={onAddMember} data-testid={`btn-add-member-${queueId}`}>
          <UserPlus className="h-3 w-3 mr-1" />
          Add Agent
        </Button>
      </div>

      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No agents assigned to this queue</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead>SIP Extension</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Calls Handled</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <span data-testid={`text-member-name-${member.id}`}>
                    {member.user?.fullName || member.user?.username || "Unknown"}
                  </span>
                </TableCell>
                <TableCell>
                  {member.user?.sipExtension ? (
                    <Badge variant="outline" className="text-xs font-mono">
                      <Phone className="h-3 w-3 mr-1" />
                      {member.user.sipExtension}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not configured</span>
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
                    onClick={() => { if (confirm("Remove this agent?")) removeMemberMutation.mutate(member.id); }}
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
