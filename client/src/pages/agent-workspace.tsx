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
  ChevronLeft,
  ChevronRight,
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
  sipPhone,
}: { 
  status: AgentStatus; 
  onStatusChange: (status: AgentStatus) => void;
  stats: { calls: number; emails: number; sms: number };
  workTime: string;
  sipPhone: React.ReactNode;
}) {
  const config = STATUS_CONFIG[status];

  return (
    <div className="h-16 border-b bg-gradient-to-r from-card via-card to-muted/30 flex items-center justify-between px-6 gap-6 shadow-sm">
      <div className="flex items-center gap-6">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              className="gap-2 border-2 shadow-sm hover:shadow-md transition-shadow" 
              data-testid="dropdown-agent-status"
            >
              <span className={`h-3 w-3 rounded-full ${config.color} animate-pulse`} />
              {config.icon}
              <span className="font-medium">{config.label}</span>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {Object.entries(STATUS_CONFIG).map(([key, value]) => (
              <DropdownMenuItem
                key={key}
                onClick={() => onStatusChange(key as AgentStatus)}
                className="gap-3 py-2"
                data-testid={`menu-item-status-${key}`}
              >
                <span className={`h-3 w-3 rounded-full ${value.color}`} />
                {value.icon}
                <span className="font-medium">{value.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50">
          <Clock className="h-4 w-4 text-primary" />
          <span className="font-mono text-sm font-semibold" data-testid="text-work-time">{workTime}</span>
        </div>

        <Separator orientation="vertical" className="h-8" />

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/30" data-testid="stat-calls">
            <Phone className="h-4 w-4 text-blue-500" />
            <span className="font-bold text-blue-600 dark:text-blue-400">{stats.calls}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-950/30" data-testid="stat-emails">
            <Mail className="h-4 w-4 text-green-500" />
            <span className="font-bold text-green-600 dark:text-green-400">{stats.emails}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-950/30" data-testid="stat-sms">
            <MessageSquare className="h-4 w-4 text-orange-500" />
            <span className="font-bold text-orange-600 dark:text-orange-400">{stats.sms}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {sipPhone}
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
    <div className="w-72 border-r bg-gradient-to-b from-card to-muted/20 flex flex-col h-full">
      <div className="p-4 border-b bg-card/80 backdrop-blur-sm">
        <h3 className="font-bold text-base flex items-center gap-2 text-primary">
          <Users className="h-5 w-5" />
          Kampane
        </h3>
        <div className="mt-3 flex items-center gap-2">
          <Checkbox
            id="show-assigned"
            checked={showOnlyAssigned}
            onCheckedChange={(checked) => onToggleAssigned(!!checked)}
            data-testid="checkbox-show-assigned"
          />
          <Label htmlFor="show-assigned" className="text-sm cursor-pointer font-medium">
            Len priradené
          </Label>
        </div>
        <div className="mt-3">
          <Select value={channelFilter} onValueChange={setChannelFilter}>
            <SelectTrigger className="h-9 text-sm bg-background" data-testid="select-channel-filter">
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
        <div className="p-3 space-y-2">
          {filteredCampaigns.map((campaign) => {
            const channelInfo = CHANNEL_CONFIG[campaign.channel as keyof typeof CHANNEL_CONFIG] || CHANNEL_CONFIG.phone;
            const ChannelIcon = channelInfo.icon;
            const isSelected = selectedCampaignId === campaign.id;
            return (
              <div
                key={campaign.id}
                className={`
                  p-3 rounded-xl cursor-pointer transition-all duration-200
                  ${isSelected 
                    ? "bg-primary text-primary-foreground shadow-lg scale-[1.02]" 
                    : "bg-card hover:bg-muted/80 hover:shadow-md border border-transparent hover:border-border"
                  }
                `}
                onClick={() => onSelectCampaign(campaign.id)}
                data-testid={`btn-queue-${campaign.id}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${isSelected ? "bg-primary-foreground/20" : "bg-muted"}`}>
                      <ChannelIcon className={`h-4 w-4 ${isSelected ? "text-primary-foreground" : channelInfo.color}`} />
                    </div>
                    <div>
                      <p className={`font-semibold text-sm truncate max-w-[140px] ${isSelected ? "" : ""}`}>
                        {campaign.name}
                      </p>
                      <p className={`text-xs ${isSelected ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {campaign.status === "active" ? "Aktívna" : "Pozastavená"}
                      </p>
                    </div>
                  </div>
                  <Badge 
                    variant={isSelected ? "secondary" : "outline"} 
                    className={`${isSelected ? "bg-primary-foreground/20 text-primary-foreground border-0" : ""}`}
                  >
                    {campaign.contactCount}
                  </Badge>
                </div>
              </div>
            );
          })}
          {filteredCampaigns.length === 0 && (
            <div className="text-center py-8">
              <Users className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">Žiadne aktívne kampane</p>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t bg-card/80 backdrop-blur-sm">
        <div className="p-4">
          <h3 className="font-semibold text-sm flex items-center gap-2 mb-3 text-muted-foreground">
            <History className="h-4 w-4" />
            História
          </h3>
        </div>
        
        <ScrollArea className="h-36">
          <div className="px-4 pb-4 space-y-2">
            {contactHistory.map((item) => (
              <div key={item.id} className="text-xs p-2.5 rounded-lg bg-muted/50 border border-border/50">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`p-1 rounded ${item.type === "call" ? "bg-blue-100 dark:bg-blue-950" : item.type === "email" ? "bg-green-100 dark:bg-green-950" : "bg-orange-100 dark:bg-orange-950"}`}>
                    {item.type === "call" && <Phone className="h-3 w-3 text-blue-500" />}
                    {item.type === "email" && <Mail className="h-3 w-3 text-green-500" />}
                    {item.type === "sms" && <MessageSquare className="h-3 w-3 text-orange-500" />}
                  </div>
                  <span className="text-muted-foreground font-medium">
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
    </div>
  );
}

function ContactCard({ contact }: { contact: Customer | null }) {
  if (!contact) {
    return (
      <Card className="mb-4 border-dashed border-2">
        <CardContent className="py-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
            <User className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="text-muted-foreground font-medium">Vyberte kontakt z fronty</p>
          <p className="text-sm text-muted-foreground/70 mt-1">alebo načítajte ďalší kontakt</p>
        </CardContent>
      </Card>
    );
  }

  const leadScore = (contact as any).leadScore || 0;
  const stars = Math.round(leadScore / 20);

  return (
    <Card className="mb-4 overflow-hidden" data-testid="card-contact">
      <div className="h-2 bg-gradient-to-r from-primary via-primary/80 to-primary/60" />
      <CardContent className="py-5">
        <div className="flex items-start gap-5">
          <Avatar className="h-16 w-16 ring-4 ring-primary/20">
            <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-xl font-bold">
              {contact.firstName?.[0]}{contact.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight" data-testid="text-contact-name">
                  {contact.firstName} {contact.lastName}
                </h2>
                <Badge variant="secondary" className="mt-1">{contact.status || "Nový"}</Badge>
              </div>
              <div className="flex items-center gap-0.5 bg-muted/50 px-2 py-1 rounded-lg">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`h-5 w-5 ${i < stars ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                <Phone className="h-4 w-4 text-blue-500" />
                <span className="font-medium text-sm" data-testid="text-contact-phone">{contact.phone || "—"}</span>
              </div>
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-green-50 dark:bg-green-950/30">
                <Mail className="h-4 w-4 text-green-500" />
                <span className="font-medium text-sm truncate" data-testid="text-contact-email">{contact.email || "—"}</span>
              </div>
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{contact.city || "—"}</span>
              </div>
              <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50">
                <Building className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{contact.country || "SK"}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ScriptElement {
  id: string;
  type: string;
  label: string;
  content?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
}

interface ScriptStep {
  id: string;
  title: string;
  elements: ScriptElement[];
  isEndStep: boolean;
}

interface ParsedScript {
  version: number;
  steps: ScriptStep[];
}

function ScriptViewer({ script }: { script: string | null }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedValues, setSelectedValues] = useState<Record<string, string>>({});

  if (!script) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Pre túto kampaň nie je definovaný scenár</p>
      </div>
    );
  }

  let parsedScript: ParsedScript | null = null;
  try {
    parsedScript = JSON.parse(script);
  } catch (e) {
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

  if (!parsedScript || !parsedScript.steps || parsedScript.steps.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Scenár neobsahuje žiadne kroky</p>
      </div>
    );
  }

  const currentStep = parsedScript.steps[currentStepIndex];
  const totalSteps = parsedScript.steps.length;

  const handleValueChange = (elementId: string, value: string) => {
    setSelectedValues(prev => ({ ...prev, [elementId]: value }));
  };

  const goToNextStep = () => {
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const goToPrevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  return (
    <div className="flex flex-col h-[300px]">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-normal">
            Krok {currentStepIndex + 1} z {totalSteps}
          </Badge>
          <span className="font-medium text-sm">{currentStep.title}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={goToPrevStep}
            disabled={currentStepIndex === 0}
            data-testid="btn-script-prev"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={goToNextStep}
            disabled={currentStepIndex === totalSteps - 1}
            data-testid="btn-script-next"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {currentStep.elements.map((element) => (
            <div key={element.id} className="space-y-2">
              {element.type === "heading" && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <h4 className="font-semibold text-primary text-sm">{element.label}</h4>
                  {element.content && (
                    <p className="mt-1 text-foreground">{element.content}</p>
                  )}
                </div>
              )}
              
              {element.type === "text" && (
                <div className="space-y-1">
                  <label className="text-sm font-medium">{element.label}</label>
                  <div className="p-2 rounded bg-muted/50 text-sm">
                    {element.content || "..."}
                  </div>
                </div>
              )}
              
              {element.type === "select" && element.options && (
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1">
                    {element.label}
                    {element.required && <span className="text-destructive">*</span>}
                  </label>
                  <Select
                    value={selectedValues[element.id] || "_none"}
                    onValueChange={(v) => handleValueChange(element.id, v)}
                  >
                    <SelectTrigger className="w-full" data-testid={`select-script-${element.id}`}>
                      <SelectValue placeholder="Vyberte možnosť" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Vyberte možnosť</SelectItem>
                      {element.options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {element.type === "outcome" && element.options && (
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1">
                    {element.label}
                    {element.required && <span className="text-destructive">*</span>}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {element.options.map((opt) => (
                      <Button
                        key={opt.value}
                        variant={selectedValues[element.id] === opt.value ? "default" : "outline"}
                        size="sm"
                        className="justify-start"
                        onClick={() => handleValueChange(element.id, opt.value)}
                        data-testid={`btn-script-outcome-${opt.value}`}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              
              {element.type === "checkbox" && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={element.id}
                    checked={selectedValues[element.id] === "true"}
                    onCheckedChange={(checked) => handleValueChange(element.id, checked ? "true" : "false")}
                    data-testid={`checkbox-script-${element.id}`}
                  />
                  <Label htmlFor={element.id} className="text-sm">{element.label}</Label>
                </div>
              )}
              
              {element.type === "input" && (
                <div className="space-y-1">
                  <label className="text-sm font-medium flex items-center gap-1">
                    {element.label}
                    {element.required && <span className="text-destructive">*</span>}
                  </label>
                  <Input
                    value={selectedValues[element.id] || ""}
                    onChange={(e) => handleValueChange(element.id, e.target.value)}
                    placeholder={element.content || ""}
                    data-testid={`input-script-${element.id}`}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
      
      {currentStep.isEndStep && (
        <div className="px-4 py-2 border-t bg-green-50 dark:bg-green-950/20 text-center">
          <span className="text-sm text-green-600 dark:text-green-400 font-medium">
            Toto je konečný krok scenára
          </span>
        </div>
      )}
      
      <div className="flex gap-1 px-4 py-2 border-t">
        {parsedScript.steps.map((step, idx) => (
          <button
            key={step.id}
            onClick={() => setCurrentStepIndex(idx)}
            className={`flex-1 h-1.5 rounded-full transition-colors ${
              idx === currentStepIndex
                ? "bg-primary"
                : idx < currentStepIndex
                ? "bg-primary/50"
                : "bg-muted"
            }`}
          />
        ))}
      </div>
    </div>
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
    <Card className="overflow-hidden border-2 border-dashed border-muted-foreground/20">
      <CardHeader className="py-3 bg-gradient-to-r from-muted/50 to-transparent">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-primary" />
          Výsledok hovoru
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {DISPOSITION_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant="outline"
              size="sm"
              className={`gap-2 h-11 justify-start ${option.color} transition-all hover:scale-[1.02] hover:shadow-md`}
              onClick={() => onDisposition(option.value)}
              disabled={disabled}
              data-testid={`btn-disposition-${option.value}`}
            >
              {option.icon}
              <span className="font-medium">{option.label}</span>
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
    <Card className="overflow-hidden">
      <CardHeader className="py-3 bg-muted/30">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Headphones className="h-4 w-4 text-primary" />
          Rýchle akcie
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCall}
            disabled={!contact?.phone}
            className="gap-2 h-12 flex-col bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-950/40"
            data-testid="btn-quick-call"
          >
            <Phone className="h-5 w-5 text-blue-500" />
            <span className="text-xs">Volať</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onEmail}
            disabled={!contact?.email}
            className="gap-2 h-12 flex-col bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-950/40"
            data-testid="btn-quick-email"
          >
            <Mail className="h-5 w-5 text-green-500" />
            <span className="text-xs">Email</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onSms}
            disabled={!contact?.phone}
            className="gap-2 h-12 flex-col bg-orange-50/50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-950/40"
            data-testid="btn-quick-sms"
          >
            <MessageSquare className="h-5 w-5 text-orange-500" />
            <span className="text-xs">SMS</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onTask}
            disabled={!contact}
            className="gap-2 h-12 flex-col bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-950/40"
            data-testid="btn-quick-task"
          >
            <CalendarPlus className="h-5 w-5 text-purple-500" />
            <span className="text-xs">Úloha</span>
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
    <Card className="overflow-hidden">
      <CardHeader className="py-3 bg-muted/30">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-amber-500" />
          Poznámky k hovoru
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        {notes && (
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-sm">
            <pre className="whitespace-pre-wrap font-sans text-foreground">{notes}</pre>
          </div>
        )}
        <Textarea
          placeholder="Napíšte poznámku..."
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          rows={3}
          className="bg-background"
          data-testid="input-call-notes"
        />
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={!newNote.trim()}
          className="w-full gap-2"
          data-testid="btn-add-note"
        >
          <StickyNote className="h-4 w-4" />
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
  const [showOnlyAssigned, setShowOnlyAssigned] = useState(false);

  const allowedRoles = ["callCenter", "admin"];
  const hasRoleAccess = user && allowedRoles.includes(user.role);

  // Check country-based access
  const { data: workspaceAccess = [] } = useQuery<any[]>({
    queryKey: ["/api/agent-workspace-access/current"],
    enabled: !!hasRoleAccess,
  });

  const allowedCountries = useMemo(() => {
    return workspaceAccess.map((a: any) => a.countryCode);
  }, [workspaceAccess]);

  // Admin has full access; regular callCenter users need country assignment
  const hasAccess = user && hasRoleAccess && (user.role === "admin" || allowedCountries.length > 0);

  useEffect(() => {
    if (user && hasRoleAccess && !hasAccess && workspaceAccess !== undefined) {
      setLocation("/");
    }
  }, [user, hasRoleAccess, hasAccess, setLocation, workspaceAccess]);

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

  const baseCampaigns = showOnlyAssigned ? assignedCampaigns : allCampaigns;

  // Filter campaigns based on country access (admin sees all, others see only allowed countries)
  const campaigns = useMemo(() => {
    if (user?.role === "admin") return baseCampaigns;
    if (allowedCountries.length === 0) return [];
    return baseCampaigns.filter((c) => {
      // If campaign has no country codes, show it (generic campaign)
      if (!c.countryCodes || c.countryCodes.length === 0) return true;
      // Show if user has access to at least one of the campaign's countries
      return c.countryCodes.some((code: string) => allowedCountries.includes(code));
    });
  }, [baseCampaigns, allowedCountries, user?.role]);

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

  const sipPhoneComponent = (
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
  );

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] -m-6 bg-gradient-to-br from-background via-background to-muted/20">
      <AgentStatusBar
        status={agentStatus}
        onStatusChange={handleStatusChange}
        stats={stats}
        workTime={workTime}
        sipPhone={sipPhoneComponent}
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

        <div className="flex-1 overflow-auto p-6">
          <ContactCard contact={currentContact} />

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4 p-1 bg-muted/50">
              <TabsTrigger value="script" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-script">
                <FileText className="h-4 w-4" />
                Script
              </TabsTrigger>
              <TabsTrigger value="email" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-email">
                <Mail className="h-4 w-4" />
                Email
              </TabsTrigger>
              <TabsTrigger value="sms" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-sms">
                <MessageSquare className="h-4 w-4" />
                SMS
              </TabsTrigger>
            </TabsList>

            <Card className="overflow-hidden">
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

          <div className="mt-6">
            <DispositionPanel
              onDisposition={handleDisposition}
              disabled={!currentContact}
            />
          </div>

          {!currentContact && selectedCampaignId && (
            <div className="mt-6 text-center">
              <Button onClick={handleNextContact} size="lg" className="gap-2 shadow-lg hover:shadow-xl transition-shadow" data-testid="btn-next-contact">
                <SkipForward className="h-5 w-5" />
                Načítať ďalší kontakt
              </Button>
            </div>
          )}
        </div>

        <div className="w-80 border-l bg-gradient-to-b from-card to-muted/20 p-4 space-y-4 overflow-auto">
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
