import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/auth-context";
import { useSip } from "@/contexts/sip-context";
import { SipPhone } from "@/components/sip-phone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Mail,
  MessageSquare,
  Clock,
  Users,
  CheckCircle,
  XCircle,
  Pause,
  Play,
  Coffee,
  ChevronDown,
  Send,
  Star,
  Calendar,
  FileText,
  History,
  User,
  Building,
  MapPin,
  AlertCircle,
  SkipForward,
  ThumbsUp,
  ThumbsDown,
  CalendarPlus,
  StickyNote,
  Headphones,
  Loader2,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { sk } from "date-fns/locale";
import type { Campaign, Customer } from "@shared/schema";

type AgentStatus = "available" | "busy" | "break" | "wrap_up" | "offline";

interface QueueItem {
  id: string;
  campaignId: string;
  campaignName: string;
  customerId: string;
  customerName: string;
  phone: string;
  email: string;
  priority: number;
  attempts: number;
  lastAttempt: string | null;
}

interface ContactHistory {
  id: string;
  type: "call" | "email" | "sms";
  direction: "inbound" | "outbound";
  date: string;
  duration?: number;
  status: string;
  notes?: string;
}

const STATUS_CONFIG: Record<AgentStatus, { label: string; color: string; icon: React.ReactNode }> = {
  available: { label: "Dostupný", color: "bg-green-500", icon: <Headphones className="h-4 w-4" /> },
  busy: { label: "Obsadený", color: "bg-red-500", icon: <PhoneCall className="h-4 w-4" /> },
  break: { label: "Prestávka", color: "bg-yellow-500", icon: <Coffee className="h-4 w-4" /> },
  wrap_up: { label: "Spracovanie", color: "bg-blue-500", icon: <FileText className="h-4 w-4" /> },
  offline: { label: "Offline", color: "bg-gray-500", icon: <PhoneOff className="h-4 w-4" /> },
};

const DISPOSITION_OPTIONS = [
  { value: "interested", label: "Záujem", icon: <ThumbsUp className="h-4 w-4" />, color: "bg-green-100 text-green-800 hover:bg-green-200" },
  { value: "callback", label: "Zavolať neskôr", icon: <CalendarPlus className="h-4 w-4" />, color: "bg-blue-100 text-blue-800 hover:bg-blue-200" },
  { value: "not_interested", label: "Nezáujem", icon: <ThumbsDown className="h-4 w-4" />, color: "bg-orange-100 text-orange-800 hover:bg-orange-200" },
  { value: "no_answer", label: "Nedvíha", icon: <PhoneOff className="h-4 w-4" />, color: "bg-gray-100 text-gray-800 hover:bg-gray-200" },
  { value: "wrong_number", label: "Zlé číslo", icon: <AlertCircle className="h-4 w-4" />, color: "bg-red-100 text-red-800 hover:bg-red-200" },
  { value: "dnd", label: "Nevolať", icon: <XCircle className="h-4 w-4" />, color: "bg-red-100 text-red-800 hover:bg-red-200" },
];

function AgentStatusBar({ 
  status, 
  onStatusChange,
  stats,
  workTime,
}: { 
  status: AgentStatus; 
  onStatusChange: (status: AgentStatus) => void;
  stats: { calls: number; emails: number; sms: number };
  workTime: string;
}) {
  const config = STATUS_CONFIG[status];

  return (
    <div className="h-14 border-b bg-card flex items-center justify-between px-4 gap-4">
      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2" data-testid="dropdown-agent-status">
              <span className={`h-2 w-2 rounded-full ${config.color}`} />
              {config.icon}
              {config.label}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {Object.entries(STATUS_CONFIG).map(([key, value]) => (
              <DropdownMenuItem
                key={key}
                onClick={() => onStatusChange(key as AgentStatus)}
                className="gap-2"
                data-testid={`menu-item-status-${key}`}
              >
                <span className={`h-2 w-2 rounded-full ${value.color}`} />
                {value.icon}
                {value.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="h-8" />

        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span className="font-mono text-sm" data-testid="text-work-time">{workTime}</span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2" data-testid="stat-calls">
          <Phone className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">{stats.calls}</span>
          <span className="text-muted-foreground text-sm">hovorov</span>
        </div>
        <div className="flex items-center gap-2" data-testid="stat-emails">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">{stats.emails}</span>
          <span className="text-muted-foreground text-sm">emailov</span>
        </div>
        <div className="flex items-center gap-2" data-testid="stat-sms">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">{stats.sms}</span>
          <span className="text-muted-foreground text-sm">SMS</span>
        </div>
      </div>
    </div>
  );
}

const CHANNEL_CONFIG = {
  phone: { icon: Phone, label: "Telefón", color: "text-blue-500" },
  email: { icon: Mail, label: "Email", color: "text-green-500" },
  sms: { icon: MessageSquare, label: "SMS", color: "text-orange-500" },
  mixed: { icon: Users, label: "Mix", color: "text-purple-500" },
};

function QueuePanel({
  campaigns,
  selectedCampaignId,
  onSelectCampaign,
  contactHistory,
  showOnlyAssigned,
  onToggleAssigned,
}: {
  campaigns: { id: string; name: string; contactCount: number; status: string; channel: string }[];
  selectedCampaignId: string | null;
  onSelectCampaign: (id: string) => void;
  contactHistory: ContactHistory[];
  showOnlyAssigned: boolean;
  onToggleAssigned: (value: boolean) => void;
}) {
  const [channelFilter, setChannelFilter] = useState<string>("all");
  
  const filteredCampaigns = useMemo(() => {
    if (channelFilter === "all") return campaigns;
    return campaigns.filter((c) => c.channel === channelFilter);
  }, [campaigns, channelFilter]);

  return (
    <div className="w-60 border-r bg-card flex flex-col h-full">
      <div className="p-3 border-b">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Users className="h-4 w-4" />
          Fronty
        </h3>
        <div className="mt-2 flex items-center gap-2">
          <Checkbox
            id="show-assigned"
            checked={showOnlyAssigned}
            onCheckedChange={(checked) => onToggleAssigned(!!checked)}
            data-testid="checkbox-show-assigned"
          />
          <Label htmlFor="show-assigned" className="text-xs cursor-pointer">
            Len priradené
          </Label>
        </div>
        <div className="mt-2">
          <Select value={channelFilter} onValueChange={setChannelFilter}>
            <SelectTrigger className="h-8 text-xs" data-testid="select-channel-filter">
              <SelectValue placeholder="Všetky kanály" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všetky kanály</SelectItem>
              <SelectItem value="phone">Telefón</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
              <SelectItem value="mixed">Zmiešané</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filteredCampaigns.map((campaign) => {
            const channelInfo = CHANNEL_CONFIG[campaign.channel as keyof typeof CHANNEL_CONFIG] || CHANNEL_CONFIG.phone;
            const ChannelIcon = channelInfo.icon;
            return (
              <Button
                key={campaign.id}
                variant={selectedCampaignId === campaign.id ? "secondary" : "ghost"}
                className="w-full justify-between h-auto py-2 px-3"
                onClick={() => onSelectCampaign(campaign.id)}
                data-testid={`btn-queue-${campaign.id}`}
              >
                <div className="flex flex-col items-start">
                  <div className="flex items-center gap-1">
                    <ChannelIcon className={`h-3 w-3 ${channelInfo.color}`} />
                    <span className="text-sm font-medium truncate max-w-[120px]">{campaign.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {campaign.status === "active" ? "Aktívna" : "Pozastavená"}
                  </span>
                </div>
                <Badge variant="secondary" className="ml-2">
                  {campaign.contactCount}
                </Badge>
              </Button>
            );
          })}
          {filteredCampaigns.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Žiadne aktívne fronty
            </p>
          )}
        </div>
      </ScrollArea>

      <Separator />

      <div className="p-3 border-t">
        <h3 className="font-semibold text-sm flex items-center gap-2 mb-2">
          <History className="h-4 w-4" />
          História kontaktu
        </h3>
      </div>
      
      <ScrollArea className="h-48">
        <div className="p-2 space-y-2">
          {contactHistory.map((item) => (
            <div key={item.id} className="text-xs p-2 rounded bg-muted/50">
              <div className="flex items-center gap-2 mb-1">
                {item.type === "call" && <Phone className="h-3 w-3" />}
                {item.type === "email" && <Mail className="h-3 w-3" />}
                {item.type === "sms" && <MessageSquare className="h-3 w-3" />}
                <span className="text-muted-foreground">
                  {format(new Date(item.date), "d.M. HH:mm", { locale: sk })}
                </span>
              </div>
              <p className="text-muted-foreground truncate">{item.notes || item.status}</p>
            </div>
          ))}
          {contactHistory.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Žiadna história
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function ContactCard({ contact }: { contact: Customer | null }) {
  if (!contact) {
    return (
      <Card className="mb-4">
        <CardContent className="py-8 text-center text-muted-foreground">
          <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Vyberte kontakt z fronty</p>
        </CardContent>
      </Card>
    );
  }

  const leadScore = (contact as any).leadScore || 0;
  const stars = Math.round(leadScore / 20);

  return (
    <Card className="mb-4" data-testid="card-contact">
      <CardContent className="py-4">
        <div className="flex items-start gap-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="bg-primary/10 text-primary text-lg">
              {contact.firstName?.[0]}{contact.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold" data-testid="text-contact-name">
                {contact.firstName} {contact.lastName}
              </h2>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${i < stars ? "text-yellow-500 fill-yellow-500" : "text-muted"}`}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-3">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span data-testid="text-contact-phone">{contact.phone || "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="truncate" data-testid="text-contact-email">{contact.email || "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{contact.city || "—"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Building className="h-4 w-4 text-muted-foreground" />
                <Badge variant="outline">{contact.status || "Nový"}</Badge>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ScriptViewer({ script }: { script: string | null }) {
  if (!script) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Pre túto kampaň nie je definovaný scenár</p>
      </div>
    );
  }

  const lines = script.split("\n");

  return (
    <ScrollArea className="h-[300px]">
      <div className="p-4 prose prose-sm dark:prose-invert max-w-none">
        {lines.map((line, i) => (
          <p key={i} className="mb-2">{line || "\u00A0"}</p>
        ))}
      </div>
    </ScrollArea>
  );
}

function EmailComposer({ contact, onSend, isLoading }: { contact: Customer | null; onSend: (data: { subject: string; body: string }) => void; isLoading?: boolean }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const handleSend = () => {
    if (subject && body) {
      onSend({ subject, body });
      setSubject("");
      setBody("");
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <Input
          placeholder="Predmet"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          disabled={!contact || isLoading}
          data-testid="input-email-subject"
        />
      </div>
      <div className="space-y-2">
        <Textarea
          placeholder="Text emailu..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={!contact || isLoading}
          rows={8}
          data-testid="input-email-body"
        />
      </div>
      <Button
        onClick={handleSend}
        disabled={!contact || !subject || !body || isLoading}
        className="w-full"
        data-testid="btn-send-email"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Send className="h-4 w-4 mr-2" />
        )}
        {isLoading ? "Odosielam..." : "Odoslať email"}
      </Button>
    </div>
  );
}

function SmsComposer({ contact, onSend, isLoading }: { contact: Customer | null; onSend: (message: string) => void; isLoading?: boolean }) {
  const [message, setMessage] = useState("");
  const charCount = message.length;
  const smsCount = Math.ceil(charCount / 160) || 1;

  const handleSend = () => {
    if (message) {
      onSend(message);
      setMessage("");
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <Textarea
          placeholder="Text SMS správy..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={!contact || isLoading}
          rows={6}
          data-testid="input-sms-message"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{charCount} znakov</span>
          <span>{smsCount} SMS</span>
        </div>
      </div>
      <Button
        onClick={handleSend}
        disabled={!contact || !message || isLoading}
        className="w-full"
        data-testid="btn-send-sms"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Send className="h-4 w-4 mr-2" />
        )}
        {isLoading ? "Odosielam..." : "Odoslať SMS"}
      </Button>
    </div>
  );
}

function DispositionPanel({ 
  onDisposition, 
  disabled 
}: { 
  onDisposition: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-medium">Výsledok hovoru</CardTitle>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="flex flex-wrap gap-2">
          {DISPOSITION_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant="outline"
              size="sm"
              className={`gap-1 ${option.color}`}
              onClick={() => onDisposition(option.value)}
              disabled={disabled}
              data-testid={`btn-disposition-${option.value}`}
            >
              {option.icon}
              {option.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActionsPanel({ 
  contact,
  onCall,
  onEmail,
  onSms,
  onTask,
}: {
  contact: Customer | null;
  onCall: () => void;
  onEmail: () => void;
  onSms: () => void;
  onTask: () => void;
}) {
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-medium">Rýchle akcie</CardTitle>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCall}
            disabled={!contact?.phone}
            className="gap-1"
            data-testid="btn-quick-call"
          >
            <Phone className="h-4 w-4" />
            Volať
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onEmail}
            disabled={!contact?.email}
            className="gap-1"
            data-testid="btn-quick-email"
          >
            <Mail className="h-4 w-4" />
            Email
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onSms}
            disabled={!contact?.phone}
            className="gap-1"
            data-testid="btn-quick-sms"
          >
            <MessageSquare className="h-4 w-4" />
            SMS
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onTask}
            disabled={!contact}
            className="gap-1"
            data-testid="btn-quick-task"
          >
            <CalendarPlus className="h-4 w-4" />
            Úloha
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NotesPanel({ 
  notes, 
  onAddNote 
}: { 
  notes: string; 
  onAddNote: (note: string) => void;
}) {
  const [newNote, setNewNote] = useState("");

  const handleAdd = () => {
    if (newNote.trim()) {
      onAddNote(newNote);
      setNewNote("");
    }
  };

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <StickyNote className="h-4 w-4" />
          Poznámky k hovoru
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-3 space-y-2">
        <Textarea
          placeholder="Pridať poznámku..."
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          rows={3}
          data-testid="input-call-notes"
        />
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={!newNote.trim()}
          className="w-full"
          data-testid="btn-add-note"
        >
          Pridať poznámku
        </Button>
      </CardContent>
    </Card>
  );
}

export default function AgentWorkspacePage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const sipContext = useSip();
  const [, setLocation] = useLocation();

  const [agentStatus, setAgentStatus] = useState<AgentStatus>("available");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [currentContact, setCurrentContact] = useState<Customer | null>(null);
  const [workTime, setWorkTime] = useState("00:00:00");
  const [startTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState("script");
  const [callNotes, setCallNotes] = useState("");

  const [stats, setStats] = useState({ calls: 0, emails: 0, sms: 0 });
  const [showOnlyAssigned, setShowOnlyAssigned] = useState(true);

  const allowedRoles = ["callCenter", "admin"];
  const hasAccess = user && allowedRoles.includes(user.role);

  useEffect(() => {
    if (user && !hasAccess) {
      setLocation("/");
    }
  }, [user, hasAccess, setLocation]);

  useEffect(() => {
    if (!hasAccess) return;
    const interval = setInterval(() => {
      const diff = Math.floor((new Date().getTime() - startTime.getTime()) / 1000);
      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;
      setWorkTime(
        `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, hasAccess]);

  const { data: allCampaigns = [] } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
    enabled: !!hasAccess,
  });

  const { data: assignedCampaigns = [] } = useQuery<Campaign[]>({
    queryKey: ["/api/user/assigned-campaigns"],
    enabled: !!hasAccess,
  });

  const campaigns = showOnlyAssigned ? assignedCampaigns : allCampaigns;

  const activeCampaigns = useMemo(() => {
    return campaigns
      .filter((c) => c.status === "active" || c.status === "paused")
      .map((c) => ({
        id: c.id,
        name: c.name,
        contactCount: 0,
        status: c.status,
        channel: c.channel || "phone",
      }));
  }, [campaigns]);

  const selectedCampaign = useMemo(() => {
    return campaigns.find((c) => c.id === selectedCampaignId);
  }, [campaigns, selectedCampaignId]);

  const { data: campaignContacts = [] } = useQuery<Customer[]>({
    queryKey: [`/api/campaigns/${selectedCampaignId}/contacts`],
    enabled: !!selectedCampaignId && !!hasAccess,
  });

  const contactHistory: ContactHistory[] = useMemo(() => {
    return [];
  }, [currentContact]);

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="p-6 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h2 className="text-lg font-semibold mb-2">Prístup zamietnutý</h2>
          <p className="text-muted-foreground">
            Táto stránka je dostupná len pre operátorov call centra.
          </p>
        </Card>
      </div>
    );
  }

  const handleStatusChange = (status: AgentStatus) => {
    setAgentStatus(status);
    toast({
      title: "Status zmenený",
      description: `Váš status je teraz: ${STATUS_CONFIG[status].label}`,
    });
  };

  const handleDisposition = (value: string) => {
    const option = DISPOSITION_OPTIONS.find((o) => o.value === value);
    toast({
      title: "Hovor ukončený",
      description: `Výsledok: ${option?.label}`,
    });
    setAgentStatus("wrap_up");
    setCurrentContact(null);
    setCallNotes("");

    setTimeout(() => {
      setAgentStatus("available");
    }, 3000);
  };

  const sendEmailMutation = useMutation({
    mutationFn: async (data: { to: string; subject: string; body: string }) => {
      const res = await apiRequest("POST", "/api/ms365/send-email-from-mailbox", {
        to: data.to,
        subject: data.subject,
        body: data.body,
        isHtml: true,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Chyba pri odosielaní emailu");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Email odoslaný",
        description: `Email bol úspešne odoslaný na ${currentContact?.email}`,
      });
      setStats((prev) => ({ ...prev, emails: prev.emails + 1 }));
    },
    onError: (error: Error) => {
      toast({
        title: "Chyba",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const sendSmsMutation = useMutation({
    mutationFn: async (data: { number: string; text: string }) => {
      const res = await apiRequest("POST", "/api/bulkgate/send", {
        number: data.number,
        text: data.text,
        country: currentContact?.country || "SK",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Chyba pri odosielaní SMS");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "SMS odoslaná",
        description: `SMS bola úspešne odoslaná na ${currentContact?.phone}`,
      });
      setStats((prev) => ({ ...prev, sms: prev.sms + 1 }));
    },
    onError: (error: Error) => {
      toast({
        title: "Chyba",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSendEmail = (data: { subject: string; body: string }) => {
    if (!currentContact?.email) {
      toast({
        title: "Chyba",
        description: "Kontakt nemá zadaný email",
        variant: "destructive",
      });
      return;
    }
    sendEmailMutation.mutate({
      to: currentContact.email,
      subject: data.subject,
      body: data.body,
    });
  };

  const handleSendSms = (message: string) => {
    if (!currentContact?.phone) {
      toast({
        title: "Chyba",
        description: "Kontakt nemá zadané telefónne číslo",
        variant: "destructive",
      });
      return;
    }
    sendSmsMutation.mutate({
      number: currentContact.phone,
      text: message,
    });
  };

  const handleAddNote = (note: string) => {
    setCallNotes((prev) => prev + (prev ? "\n" : "") + note);
  };

  const handleNextContact = () => {
    if (campaignContacts.length > 0) {
      const nextContact = campaignContacts[0];
      setCurrentContact(nextContact);
      setAgentStatus("busy");
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] -m-6">
      <AgentStatusBar
        status={agentStatus}
        onStatusChange={handleStatusChange}
        stats={stats}
        workTime={workTime}
      />

      <div className="flex flex-1 overflow-hidden">
        <QueuePanel
          campaigns={activeCampaigns}
          selectedCampaignId={selectedCampaignId}
          onSelectCampaign={setSelectedCampaignId}
          contactHistory={contactHistory}
          showOnlyAssigned={showOnlyAssigned}
          onToggleAssigned={setShowOnlyAssigned}
        />

        <div className="flex-1 overflow-auto p-4">
          <ContactCard contact={currentContact} />

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="script" className="gap-2" data-testid="tab-script">
                <FileText className="h-4 w-4" />
                Script
              </TabsTrigger>
              <TabsTrigger value="email" className="gap-2" data-testid="tab-email">
                <Mail className="h-4 w-4" />
                Email
              </TabsTrigger>
              <TabsTrigger value="sms" className="gap-2" data-testid="tab-sms">
                <MessageSquare className="h-4 w-4" />
                SMS
              </TabsTrigger>
            </TabsList>

            <Card>
              <TabsContent value="script" className="m-0">
                <ScriptViewer script={selectedCampaign?.script || null} />
              </TabsContent>
              <TabsContent value="email" className="m-0">
                <EmailComposer contact={currentContact} onSend={handleSendEmail} isLoading={sendEmailMutation.isPending} />
              </TabsContent>
              <TabsContent value="sms" className="m-0">
                <SmsComposer contact={currentContact} onSend={handleSendSms} isLoading={sendSmsMutation.isPending} />
              </TabsContent>
            </Card>
          </Tabs>

          <div className="mt-4">
            <DispositionPanel
              onDisposition={handleDisposition}
              disabled={!currentContact}
            />
          </div>

          {!currentContact && selectedCampaignId && (
            <div className="mt-4 text-center">
              <Button onClick={handleNextContact} size="lg" className="gap-2" data-testid="btn-next-contact">
                <SkipForward className="h-5 w-5" />
                Načítať ďalší kontakt
              </Button>
            </div>
          )}
        </div>

        <div className="w-80 border-l bg-card p-4 space-y-4 overflow-auto">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Phone className="h-4 w-4" />
                SIP Telefón
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <SipPhone
                compact={true}
                initialNumber={currentContact?.phone || ""}
                userId={user?.id}
                customerId={currentContact?.id}
                campaignId={selectedCampaignId || undefined}
                customerName={currentContact ? `${currentContact.firstName} ${currentContact.lastName}` : undefined}
                hideSettingsAndRegistration={true}
                onCallStart={() => {
                  setAgentStatus("busy");
                  setStats((prev) => ({ ...prev, calls: prev.calls + 1 }));
                }}
                onCallEnd={() => {
                  setAgentStatus("wrap_up");
                }}
              />
            </CardContent>
          </Card>

          <QuickActionsPanel
            contact={currentContact}
            onCall={() => {}}
            onEmail={() => setActiveTab("email")}
            onSms={() => setActiveTab("sms")}
            onTask={() => {
              toast({
                title: "Úloha",
                description: "Vytvorenie úlohy - pripravuje sa",
              });
            }}
          />

          <NotesPanel notes={callNotes} onAddNote={handleAddNote} />
        </div>
      </div>
    </div>
  );
}
