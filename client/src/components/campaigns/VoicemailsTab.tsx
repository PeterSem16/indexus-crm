import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Plus,
  Pencil,
  Trash2,
  Play,
  Square,
  Voicemail,
  Mail,
  MailOpen,
  Archive,
  Phone,
  Search,
  Loader2,
  Inbox,
  Clock,
  CheckCircle2,
  FileText,
  Settings,
  X,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface VoicemailBox {
  id: string;
  name: string;
  description: string | null;
  extension: string | null;
  countryCode: string | null;
  greetingMessageId: string | null;
  greetingFilePath: string | null;
  maxDurationSeconds: number;
  emailNotification: boolean;
  notifyEmails: string[] | null;
  transcriptionEnabled: boolean;
  pin: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface VoicemailMessage {
  id: string;
  boxId: string;
  queueId: string | null;
  didNumber: string | null;
  callerNumber: string;
  callerName: string | null;
  customerId: string | null;
  recordingPath: string | null;
  durationSeconds: number;
  status: string;
  transcriptText: string | null;
  transcriptStatus: string | null;
  readAt: string | null;
  createdAt: string;
}

interface VoicemailStats {
  total: number;
  unread: number;
  read: number;
  archived: number;
}

const COUNTRIES = ["SK", "CZ", "HU", "RO", "IT", "DE", "US"];

interface BoxFormData {
  name: string;
  description: string;
  extension: string;
  countryCode: string;
  maxDurationSeconds: number;
  emailNotification: boolean;
  notifyEmails: string;
  transcriptionEnabled: boolean;
  pin: string;
  isActive: boolean;
}

const defaultBoxForm: BoxFormData = {
  name: "",
  description: "",
  extension: "",
  countryCode: "SK",
  maxDurationSeconds: 120,
  emailNotification: false,
  notifyEmails: "",
  transcriptionEnabled: false,
  pin: "",
  isActive: true,
};

export function VoicemailsTab() {
  const [activeTab, setActiveTab] = useState("messages");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
      <div className="px-6 pt-4">
        <TabsList>
          <TabsTrigger value="messages" className="gap-2" data-testid="tab-voicemail-messages">
            <Inbox className="h-4 w-4" />
            Inbox
          </TabsTrigger>
          <TabsTrigger value="boxes" className="gap-2" data-testid="tab-voicemail-boxes">
            <Settings className="h-4 w-4" />
            Mailboxes
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="messages" className="flex-1 overflow-auto p-6 mt-0">
        <VoicemailInbox />
      </TabsContent>
      <TabsContent value="boxes" className="flex-1 overflow-auto p-6 mt-0">
        <VoicemailBoxesManager />
      </TabsContent>
    </Tabs>
  );
}

function VoicemailInbox() {
  const { toast } = useToast();
  const [filterBox, setFilterBox] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { data: boxes = [] } = useQuery<VoicemailBox[]>({
    queryKey: ["/api/voicemail-boxes"],
  });

  const { data: messages = [], isLoading } = useQuery<VoicemailMessage[]>({
    queryKey: ["/api/voicemail-messages", filterBox, filterStatus, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterBox !== "all") params.append("boxId", filterBox);
      if (filterStatus !== "all") params.append("status", filterStatus);
      if (searchTerm) params.append("search", searchTerm);
      const res = await fetch(`/api/voicemail-messages?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: stats } = useQuery<VoicemailStats>({
    queryKey: ["/api/voicemail-stats", filterBox],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterBox !== "all") params.append("boxId", filterBox);
      const res = await fetch(`/api/voicemail-stats?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/voicemail-messages/${id}`, { status: "read" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voicemail-messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/voicemail-stats"] });
    },
  });

  const batchStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      return apiRequest("PATCH", "/api/voicemail-messages/batch-status", { ids, status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voicemail-messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/voicemail-stats"] });
      setSelectedIds(new Set());
      toast({ title: "Messages updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/voicemail-messages/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voicemail-messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/voicemail-stats"] });
      toast({ title: "Message deleted" });
    },
  });

  const togglePlay = (id: string) => {
    if (playingId === id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(`/api/voicemail-messages/${id}/audio`);
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => {
      setPlayingId(null);
      toast({ title: "Error", description: "Could not play recording", variant: "destructive" });
    };
    audioRef.current = audio;
    audio.play();
    setPlayingId(id);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === messages.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(messages.map(m => m.id)));
    }
  };

  const getBoxName = (boxId: string) => {
    return boxes.find(b => b.id === boxId)?.name || "Unknown";
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleRowClick = (msg: VoicemailMessage) => {
    if (expandedId === msg.id) {
      setExpandedId(null);
    } else {
      setExpandedId(msg.id);
      if (msg.status === "unread") {
        markReadMutation.mutate(msg.id);
      }
    }
  };

  return (
    <div className="space-y-4">
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <Card data-testid="stat-total">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Voicemail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-unread">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                <Mail className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.unread}</p>
                <p className="text-xs text-muted-foreground">Unread</p>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-read">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <MailOpen className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.read}</p>
                <p className="text-xs text-muted-foreground">Read</p>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-archived">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                <Archive className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.archived}</p>
                <p className="text-xs text-muted-foreground">Archived</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search caller..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-voicemail"
                />
              </div>
              <Select value={filterBox} onValueChange={setFilterBox}>
                <SelectTrigger className="w-48" data-testid="select-filter-box">
                  <SelectValue placeholder="All Mailboxes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Mailboxes</SelectItem>
                  {boxes.map(box => (
                    <SelectItem key={box.id} value={box.id}>{box.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-36" data-testid="select-filter-status">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="unread">Unread</SelectItem>
                  <SelectItem value="read">Read</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => batchStatusMutation.mutate({ ids: Array.from(selectedIds), status: "read" })}
                  data-testid="button-batch-read"
                >
                  <MailOpen className="h-4 w-4 mr-1" />
                  Mark Read
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => batchStatusMutation.mutate({ ids: Array.from(selectedIds), status: "archived" })}
                  data-testid="button-batch-archive"
                >
                  <Archive className="h-4 w-4 mr-1" />
                  Archive
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Voicemail className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-lg font-medium">No voicemail messages</p>
              <p className="text-sm">Messages will appear here when callers leave voicemails</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === messages.length && messages.length > 0}
                      onChange={selectAll}
                      className="rounded"
                      data-testid="checkbox-select-all"
                    />
                  </TableHead>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Caller</TableHead>
                  <TableHead>Mailbox</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {messages.map((msg) => (
                  <>
                    <TableRow
                      key={msg.id}
                      className={`cursor-pointer ${msg.status === "unread" ? "font-semibold bg-primary/5" : ""}`}
                      onClick={() => handleRowClick(msg)}
                      data-testid={`row-voicemail-${msg.id}`}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(msg.id)}
                          onChange={() => toggleSelect(msg.id)}
                          className="rounded"
                          data-testid={`checkbox-voicemail-${msg.id}`}
                        />
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {msg.recordingPath && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => togglePlay(msg.id)}
                            data-testid={`button-play-${msg.id}`}
                          >
                            {playingId === msg.id ? (
                              <Square className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            <span>{msg.callerNumber}</span>
                          </div>
                          {msg.callerName && (
                            <span className="text-xs text-muted-foreground">{msg.callerName}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{getBoxName(msg.boxId)}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {formatDuration(msg.durationSeconds)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {format(new Date(msg.createdAt), "dd.MM.yyyy HH:mm")}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={msg.status === "unread" ? "destructive" : msg.status === "archived" ? "secondary" : "default"}
                          data-testid={`badge-status-${msg.id}`}
                        >
                          {msg.status === "unread" && <Mail className="h-3 w-3 mr-1" />}
                          {msg.status === "read" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {msg.status === "archived" && <Archive className="h-3 w-3 mr-1" />}
                          {msg.status}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1">
                          {msg.status !== "archived" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => batchStatusMutation.mutate({ ids: [msg.id], status: "archived" })}
                              data-testid={`button-archive-${msg.id}`}
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            onClick={() => deleteMutation.mutate(msg.id)}
                            data-testid={`button-delete-msg-${msg.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedId === msg.id && (
                      <TableRow key={`${msg.id}-detail`}>
                        <TableCell colSpan={8} className="bg-muted/30 p-4">
                          <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Caller:</span>{" "}
                                {msg.callerNumber} {msg.callerName && `(${msg.callerName})`}
                              </div>
                              <div>
                                <span className="text-muted-foreground">DID:</span>{" "}
                                {msg.didNumber || "N/A"}
                              </div>
                              <div>
                                <span className="text-muted-foreground">Duration:</span>{" "}
                                {formatDuration(msg.durationSeconds)}
                              </div>
                            </div>
                            {msg.transcriptText && (
                              <div className="mt-2">
                                <div className="flex items-center gap-2 mb-1">
                                  <FileText className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm font-medium">Transcript</span>
                                  {msg.transcriptStatus && (
                                    <Badge variant="outline" className="text-xs">
                                      {msg.transcriptStatus}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground bg-background rounded p-3 border">
                                  {msg.transcriptText}
                                </p>
                              </div>
                            )}
                            {!msg.transcriptText && msg.transcriptStatus === "pending" && (
                              <div className="text-sm text-muted-foreground italic">
                                Transcription pending...
                              </div>
                            )}
                            {msg.recordingPath && (
                              <div className="mt-2">
                                <audio
                                  controls
                                  src={`/api/voicemail-messages/${msg.id}/audio`}
                                  className="w-full max-w-md"
                                  data-testid={`audio-player-${msg.id}`}
                                />
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function VoicemailBoxesManager() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBox, setEditingBox] = useState<VoicemailBox | null>(null);
  const [formData, setFormData] = useState<BoxFormData>(defaultBoxForm);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: boxes = [], isLoading } = useQuery<VoicemailBox[]>({
    queryKey: ["/api/voicemail-boxes"],
  });

  const { data: ivrMessages = [] } = useQuery<any[]>({
    queryKey: ["/api/ivr-messages"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: BoxFormData) => {
      return apiRequest("POST", "/api/voicemail-boxes", {
        ...data,
        notifyEmails: data.notifyEmails ? data.notifyEmails.split(",").map(e => e.trim()).filter(Boolean) : [],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voicemail-boxes"] });
      closeDialog();
      toast({ title: "Voicemail box created" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: BoxFormData }) => {
      return apiRequest("PUT", `/api/voicemail-boxes/${id}`, {
        ...data,
        notifyEmails: data.notifyEmails ? data.notifyEmails.split(",").map(e => e.trim()).filter(Boolean) : [],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voicemail-boxes"] });
      closeDialog();
      toast({ title: "Voicemail box updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/voicemail-boxes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voicemail-boxes"] });
      setDeleteConfirmId(null);
      toast({ title: "Voicemail box deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const openCreate = () => {
    setEditingBox(null);
    setFormData(defaultBoxForm);
    setDialogOpen(true);
  };

  const openEdit = (box: VoicemailBox) => {
    setEditingBox(box);
    setFormData({
      name: box.name,
      description: box.description || "",
      extension: box.extension || "",
      countryCode: box.countryCode || "SK",
      maxDurationSeconds: box.maxDurationSeconds,
      emailNotification: box.emailNotification,
      notifyEmails: (box.notifyEmails || []).join(", "),
      transcriptionEnabled: box.transcriptionEnabled,
      pin: box.pin || "",
      isActive: box.isActive,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingBox(null);
    setFormData(defaultBoxForm);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (editingBox) {
      updateMutation.mutate({ id: editingBox.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Voicemail Mailboxes</h3>
          <p className="text-sm text-muted-foreground">Manage voicemail boxes for inbound queues</p>
        </div>
        <Button onClick={openCreate} data-testid="button-create-box">
          <Plus className="h-4 w-4 mr-2" />
          New Mailbox
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : boxes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Voicemail className="h-12 w-12 mb-3 opacity-50" />
            <p className="text-lg font-medium">No voicemail boxes</p>
            <p className="text-sm">Create a mailbox to start receiving voicemails</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {boxes.map((box) => (
            <Card key={box.id} className={!box.isActive ? "opacity-60" : ""} data-testid={`card-box-${box.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Voicemail className="h-4 w-4" />
                    {box.name}
                  </CardTitle>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(box)} data-testid={`button-edit-box-${box.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setDeleteConfirmId(box.id)}
                      data-testid={`button-delete-box-${box.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {box.description && (
                  <p className="text-sm text-muted-foreground">{box.description}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {box.extension && (
                    <Badge variant="outline">Ext: {box.extension}</Badge>
                  )}
                  {box.countryCode && (
                    <Badge variant="outline">{box.countryCode}</Badge>
                  )}
                  <Badge variant={box.isActive ? "default" : "secondary"}>
                    {box.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-1 pt-1">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    Max {box.maxDurationSeconds}s
                  </div>
                  {box.emailNotification && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3 w-3" />
                      Email notifications
                    </div>
                  )}
                  {box.transcriptionEnabled && (
                    <div className="flex items-center gap-2">
                      <FileText className="h-3 w-3" />
                      Transcription enabled
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Voicemail Box</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete the mailbox and all its messages. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingBox ? "Edit Mailbox" : "Create Mailbox"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Sales Voicemail"
                data-testid="input-box-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Voicemail box for sales department"
                rows={2}
                data-testid="input-box-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Extension</Label>
                <Input
                  value={formData.extension}
                  onChange={(e) => setFormData({ ...formData, extension: e.target.value })}
                  placeholder="100"
                  data-testid="input-box-extension"
                />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Select value={formData.countryCode} onValueChange={(v) => setFormData({ ...formData, countryCode: v })}>
                  <SelectTrigger data-testid="select-box-country">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Max Recording Duration (seconds)</Label>
              <Input
                type="number"
                value={formData.maxDurationSeconds}
                onChange={(e) => setFormData({ ...formData, maxDurationSeconds: parseInt(e.target.value) || 120 })}
                data-testid="input-box-max-duration"
              />
            </div>
            <div className="space-y-2">
              <Label>Access PIN</Label>
              <Input
                value={formData.pin}
                onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                placeholder="1234"
                type="password"
                data-testid="input-box-pin"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Email Notification</Label>
                <p className="text-xs text-muted-foreground">Send email when new voicemail arrives</p>
              </div>
              <Switch
                checked={formData.emailNotification}
                onCheckedChange={(v) => setFormData({ ...formData, emailNotification: v })}
                data-testid="switch-email-notification"
              />
            </div>
            {formData.emailNotification && (
              <div className="space-y-2">
                <Label>Notification Emails</Label>
                <Input
                  value={formData.notifyEmails}
                  onChange={(e) => setFormData({ ...formData, notifyEmails: e.target.value })}
                  placeholder="admin@example.com, manager@example.com"
                  data-testid="input-notify-emails"
                />
                <p className="text-xs text-muted-foreground">Comma-separated email addresses</p>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <Label>Transcription</Label>
                <p className="text-xs text-muted-foreground">Automatically transcribe voicemail messages</p>
              </div>
              <Switch
                checked={formData.transcriptionEnabled}
                onCheckedChange={(v) => setFormData({ ...formData, transcriptionEnabled: v })}
                data-testid="switch-transcription"
              />
            </div>
            {editingBox && (
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(v) => setFormData({ ...formData, isActive: v })}
                  data-testid="switch-active"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} data-testid="button-cancel-box">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-box"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingBox ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
