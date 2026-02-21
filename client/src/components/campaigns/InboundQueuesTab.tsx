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
  Activity,
  UserPlus,
  UserMinus,
  Settings,
  ChevronDown,
  ChevronUp,
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
  announcePosition: boolean;
  announceWaitTime: boolean;
  announceFrequency: number;
  serviceLevelTarget: number;
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
  user: { id: string; username: string; name: string; role: string } | null;
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
  { value: "transfer", label: "Transfer" },
];

const COUNTRIES = ["SK", "CZ", "HU", "RO", "IT", "DE", "US"];

export function InboundQueuesTab() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingQueue, setEditingQueue] = useState<InboundQueue | null>(null);
  const [expandedQueue, setExpandedQueue] = useState<string | null>(null);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState<string | null>(null);
  const [newMemberUserId, setNewMemberUserId] = useState("");
  const [newMemberPenalty, setNewMemberPenalty] = useState(0);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    countryCode: "SK",
    didNumber: "",
    strategy: "round-robin",
    maxWaitTime: 300,
    wrapUpTime: 30,
    maxQueueSize: 50,
    priority: 1,
    overflowAction: "voicemail",
    overflowTarget: "",
    announcePosition: true,
    announceWaitTime: true,
    announceFrequency: 30,
    serviceLevelTarget: 20,
    isActive: true,
  });

  const { data: queues = [], isLoading } = useQuery<InboundQueue[]>({
    queryKey: ["/api/inbound-queues"],
  });

  const { data: allUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbound-queues"] });
      setShowAddMemberDialog(null);
      setNewMemberUserId("");
      setNewMemberPenalty(0);
      toast({ title: "Member added" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => apiRequest("DELETE", `/api/queue-members/${memberId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbound-queues"] });
      toast({ title: "Member removed" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "", description: "", countryCode: "SK", didNumber: "",
      strategy: "round-robin", maxWaitTime: 300, wrapUpTime: 30,
      maxQueueSize: 50, priority: 1, overflowAction: "voicemail",
      overflowTarget: "", announcePosition: true, announceWaitTime: true,
      announceFrequency: 30, serviceLevelTarget: 20, isActive: true,
    });
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
      overflowAction: queue.overflowAction,
      overflowTarget: queue.overflowTarget || "",
      announcePosition: queue.announcePosition,
      announceWaitTime: queue.announceWaitTime,
      announceFrequency: queue.announceFrequency,
      serviceLevelTarget: queue.serviceLevelTarget,
      isActive: queue.isActive,
    });
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

  const strategyLabel = (s: string) => STRATEGIES.find(st => st.value === s)?.label || s;

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
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-queue-form">
          <DialogHeader>
            <DialogTitle>{editingQueue ? "Edit Queue" : "Create Queue"}</DialogTitle>
          </DialogHeader>
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
            <div>
              <Label>Overflow Action</Label>
              <Select value={formData.overflowAction} onValueChange={v => setFormData(f => ({ ...f, overflowAction: v }))}>
                <SelectTrigger data-testid="select-overflow-action"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OVERFLOW_ACTIONS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {formData.overflowAction === "transfer" && (
              <div>
                <Label>Transfer Target</Label>
                <Input value={formData.overflowTarget} onChange={e => setFormData(f => ({ ...f, overflowTarget: e.target.value }))} placeholder="Phone number or extension" data-testid="input-overflow-target" />
              </div>
            )}
            <div className="col-span-2 flex gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={formData.announcePosition} onCheckedChange={v => setFormData(f => ({ ...f, announcePosition: v }))} data-testid="switch-announce-position" />
                <Label>Announce Position</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={formData.announceWaitTime} onCheckedChange={v => setFormData(f => ({ ...f, announceWaitTime: v }))} data-testid="switch-announce-wait" />
                <Label>Announce Wait Time</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={formData.isActive} onCheckedChange={v => setFormData(f => ({ ...f, isActive: v }))} data-testid="switch-queue-active" />
                <Label>Active</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
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
                    <SelectItem key={u.id} value={u.id}>{u.name || u.username}</SelectItem>
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
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => apiRequest("DELETE", `/api/queue-members/${memberId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbound-queues"] });
      toast({ title: "Member removed" });
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
                    {member.user?.name || member.user?.username || "Unknown"}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${statusColor(member.agentStatus)}`} />
                    <span className="text-sm capitalize">{member.agentStatus}</span>
                  </div>
                </TableCell>
                <TableCell>{member.penalty}</TableCell>
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
