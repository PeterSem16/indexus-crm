import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/auth-context";
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
import { useSidebar } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Hash,
  Megaphone,
  ArrowRight,
  CircleDot,
  Info,
  Zap,
  Ban,
  Heart,
  Bell,
  Flag,
  Target,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
  Home,
  Globe,
  Briefcase,
  Gift,
  Volume2,
  VolumeX,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Paperclip,
  X,
  File as FileIcon,
  Maximize2,
  Filter,
  ArrowUpDown,
  ListTodo,
  Pencil,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSip } from "@/contexts/sip-context";
import { format } from "date-fns";
import { sk } from "date-fns/locale";
import { useAgentSession } from "@/contexts/agent-session-context";
import { CustomerDetailsContent } from "@/pages/customers";
import { CustomerForm, type CustomerFormData } from "@/components/customer-form";
import type { Campaign, Customer, CampaignContact, CampaignDisposition, AgentBreakType } from "@shared/schema";

type AgentStatus = "available" | "busy" | "break" | "wrap_up" | "offline";

type ChannelType = "phone" | "email" | "sms" | "mixed";

interface EnrichedCampaignContact extends CampaignContact {
  customer: Customer | null;
}

interface TaskItem {
  id: string;
  contact: Customer;
  campaignId: string;
  campaignName: string;
  campaignContactId: string | null;
  channel: ChannelType;
  startedAt: Date;
  status: "active" | "waiting" | "wrap_up";
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

interface TimelineEntry {
  id: string;
  type: "call" | "email" | "sms" | "note" | "system";
  direction?: "inbound" | "outbound";
  timestamp: Date;
  content: string;
  details?: string;
  status?: string;
}

function getStatusConfig(t: any): Record<AgentStatus, { label: string; color: string; icon: React.ReactNode }> {
  return {
    available: { label: t.agentSession.statusAvailable, color: "bg-green-500", icon: <Headphones className="h-4 w-4" /> },
    busy: { label: t.agentSession.statusBusy, color: "bg-red-500", icon: <PhoneCall className="h-4 w-4" /> },
    break: { label: t.agentSession.statusBreak, color: "bg-yellow-500", icon: <Coffee className="h-4 w-4" /> },
    wrap_up: { label: t.agentSession.statusWrapUp, color: "bg-blue-500", icon: <FileText className="h-4 w-4" /> },
    offline: { label: t.agentSession.statusOffline, color: "bg-gray-500", icon: <PhoneOff className="h-4 w-4" /> },
  };
}


const CHANNEL_CONFIG: Record<ChannelType, { icon: typeof Phone; label: string; color: string; bg: string }> = {
  phone: { icon: Phone, label: "Telefón", color: "text-blue-500", bg: "bg-blue-500" },
  email: { icon: Mail, label: "Email", color: "text-green-500", bg: "bg-green-500" },
  sms: { icon: MessageSquare, label: "SMS", color: "text-orange-500", bg: "bg-orange-500" },
  mixed: { icon: Users, label: "Mix", color: "text-purple-500", bg: "bg-purple-500" },
};

const DISPOSITION_ICON_MAP: Record<string, typeof Phone> = {
  ThumbsUp, ThumbsDown, CalendarPlus, PhoneOff, AlertCircle, XCircle, Phone, Clock,
  Calendar, MessageSquare, FileText, Info, User, Mail, Star, Zap, CheckCircle,
  Send, Ban, Heart, Bell, Flag, Target, Eye, EyeOff, UserCheck, UserX, Users,
  Home, MapPin, Globe, Briefcase, Gift, Volume2, VolumeX, CircleDot,
};

const DISPOSITION_COLOR_MAP: Record<string, string> = {
  green: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  orange: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  red: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  gray: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  purple: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
};

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

function TopBar({
  status,
  onStatusChange,
  stats,
  workTime,
  breakTypes,
  activeBreakName,
  breakTime,
  onStartBreak,
  onEndBreak,
  isOnBreak,
  onEndSession,
  isSessionActive,
  t,
}: {
  status: AgentStatus;
  onStatusChange: (status: AgentStatus) => void;
  stats: { calls: number; emails: number; sms: number };
  workTime: string;
  breakTypes: AgentBreakType[];
  activeBreakName: string | null;
  breakTime: string;
  onStartBreak: (breakTypeId: string) => void;
  onEndBreak: () => void;
  isOnBreak: boolean;
  onEndSession: () => void;
  isSessionActive: boolean;
  t: any;
}) {
  const STATUS_CONFIG = getStatusConfig(t);
  const config = STATUS_CONFIG[status];

  return (
    <div className="h-14 border-b bg-card flex items-center justify-between px-4 gap-4 shrink-0">
      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="gap-2"
              data-testid="dropdown-agent-status"
            >
              <span className={`h-2.5 w-2.5 rounded-full ${config.color} ${status === "available" ? "animate-pulse" : ""}`} />
              {config.icon}
              <span className="font-medium text-sm">{config.label}</span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {(["available", "busy", "wrap_up"] as AgentStatus[]).map((key) => {
              const value = STATUS_CONFIG[key];
              return (
                <DropdownMenuItem
                  key={key}
                  onClick={() => onStatusChange(key)}
                  className="gap-3 py-2"
                  data-testid={`menu-item-status-${key}`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${value.color}`} />
                  {value.icon}
                  <span className="font-medium">{value.label}</span>
                </DropdownMenuItem>
              );
            })}
            <Separator className="my-1" />
            {breakTypes.length > 0 && (
              <>
                <div className="px-2 py-1 text-xs text-muted-foreground font-medium">{t.agentSession.breaks}</div>
                {breakTypes.map((bt) => (
                  <DropdownMenuItem
                    key={bt.id}
                    onClick={() => onStartBreak(bt.id)}
                    className="gap-3 py-2"
                    data-testid={`menu-item-break-${bt.id}`}
                  >
                    <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
                    <Coffee className="h-4 w-4" />
                    <span className="font-medium">{bt.name}</span>
                    {bt.maxDurationMinutes && (
                      <span className="ml-auto text-xs text-muted-foreground">{bt.maxDurationMinutes}m</span>
                    )}
                  </DropdownMenuItem>
                ))}
                <Separator className="my-1" />
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {isOnBreak && activeBreakName && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1.5 text-yellow-700 dark:text-yellow-300" data-testid="badge-break-active">
              <Coffee className="h-3 w-3" />
              {activeBreakName}
              <span className="font-mono text-xs">{breakTime}</span>
            </Badge>
            <Button variant="outline" size="sm" onClick={onEndBreak} data-testid="button-end-break">
              <Play className="h-3.5 w-3.5 mr-1" />
              {t.agentSession.continueWork}
            </Button>
          </div>
        )}

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/50">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-semibold" data-testid="text-work-time">{workTime}</span>
        </div>

        <Separator orientation="vertical" className="h-7" />

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs" data-testid="stat-calls">
            <Phone className="h-3.5 w-3.5 text-blue-500" />
            <span className="font-bold text-blue-600 dark:text-blue-400">{stats.calls}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs" data-testid="stat-emails">
            <Mail className="h-3.5 w-3.5 text-green-500" />
            <span className="font-bold text-green-600 dark:text-green-400">{stats.emails}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs" data-testid="stat-sms">
            <MessageSquare className="h-3.5 w-3.5 text-orange-500" />
            <span className="font-bold text-orange-600 dark:text-orange-400">{stats.sms}</span>
          </div>
        </div>
      </div>

      {isSessionActive && (
        <Button variant="outline" size="sm" onClick={onEndSession} data-testid="button-end-session" className="text-destructive border-destructive/30">
          <PhoneOff className="h-3.5 w-3.5 mr-1.5" />
          {t.agentSession.endShift}
        </Button>
      )}
    </div>
  );
}

function TaskListPanel({
  tasks,
  activeTaskId,
  onSelectTask,
  campaigns,
  selectedCampaignId,
  onSelectCampaign,
  showOnlyAssigned,
  onToggleAssigned,
  channelFilter,
  onChannelFilterChange,
  onLoadNextContact,
  isLoadingContact,
  campaignContacts,
  onSelectCampaignContact,
  currentUserId,
  onOpenContactsModal,
  isAutoMode,
  onToggleAutoMode,
  autoCountdown,
  onOpenTasksModal,
}: {
  tasks: TaskItem[];
  activeTaskId: string | null;
  onSelectTask: (task: TaskItem) => void;
  campaigns: { id: string; name: string; contactCount: number; status: string; channel: string }[];
  selectedCampaignId: string | null;
  onSelectCampaign: (id: string) => void;
  showOnlyAssigned: boolean;
  onToggleAssigned: (value: boolean) => void;
  channelFilter: string;
  onChannelFilterChange: (v: string) => void;
  onLoadNextContact: () => void;
  isLoadingContact: boolean;
  campaignContacts: EnrichedCampaignContact[];
  onSelectCampaignContact: (contact: EnrichedCampaignContact) => void;
  currentUserId?: string;
  isAutoMode: boolean;
  onToggleAutoMode: () => void;
  autoCountdown: number | null;
  onOpenContactsModal: () => void;
  onOpenTasksModal: () => void;
}) {
  const filteredCampaigns = useMemo(() => {
    if (channelFilter === "all") return campaigns;
    return campaigns.filter((c) => c.channel === channelFilter);
  }, [campaigns, channelFilter]);

  return (
    <div className="w-72 border-r bg-card flex flex-col h-full shrink-0">
      <div className="p-3 border-b space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Headphones className="h-4 w-4 text-primary" />
            Pracovný priestor
          </h3>
          {tasks.length > 0 && (
            <Badge variant="secondary">{tasks.length}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
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
        <Select value={channelFilter} onValueChange={onChannelFilterChange}>
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

      {tasks.length > 0 && (
        <div className="border-b">
          <div className="px-3 py-2 flex items-center justify-between gap-1">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Aktívne úlohy ({tasks.length})
            </span>
            <Button size="icon" variant="ghost" onClick={onOpenTasksModal} data-testid="btn-maximize-tasks">
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <ScrollArea className="max-h-48">
            <div className="px-2 pb-2 space-y-1">
              {tasks.map((task) => {
                const chConfig = CHANNEL_CONFIG[task.channel];
                const ChIcon = chConfig.icon;
                const isActive = activeTaskId === task.id;
                const elapsed = Math.floor((Date.now() - task.startedAt.getTime()) / 1000);
                const mins = Math.floor(elapsed / 60);

                return (
                  <div
                    key={task.id}
                    className={`
                      flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer transition-colors
                      ${isActive
                        ? "bg-primary/10 border border-primary/30"
                        : "hover-elevate"
                      }
                    `}
                    onClick={() => onSelectTask(task)}
                    data-testid={`task-item-${task.id}`}
                  >
                    <div className="relative shrink-0">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="text-xs bg-muted">
                          {task.contact.firstName?.[0]}{task.contact.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full ${chConfig.bg} flex items-center justify-center`}>
                        <ChIcon className="h-2.5 w-2.5 text-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {task.contact.firstName} {task.contact.lastName}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {task.campaignName}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <span className="text-[10px] text-muted-foreground">{mins}m</span>
                      {task.status === "active" && (
                        <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}

      <div className="px-3 py-2">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Kampane
        </span>
      </div>
      <ScrollArea className="flex-1">
        <div className="px-2 pb-2 space-y-1">
          {filteredCampaigns.map((campaign) => {
            const chConfig = CHANNEL_CONFIG[campaign.channel as ChannelType] || CHANNEL_CONFIG.phone;
            const ChIcon = chConfig.icon;
            const isSelected = selectedCampaignId === campaign.id;

            return (
              <div
                key={campaign.id}
                className={`
                  flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer transition-colors
                  ${isSelected
                    ? "bg-primary text-primary-foreground"
                    : "hover-elevate"
                  }
                `}
                onClick={() => onSelectCampaign(campaign.id)}
                data-testid={`btn-queue-${campaign.id}`}
              >
                <div className={`p-1.5 rounded-md ${isSelected ? "bg-primary-foreground/20" : "bg-muted"}`}>
                  <ChIcon className={`h-3.5 w-3.5 ${isSelected ? "text-primary-foreground" : chConfig.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{campaign.name}</p>
                  <p className={`text-[10px] ${isSelected ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {campaign.status === "active" ? "Aktívna" : "Pozastavená"}
                  </p>
                </div>
                <Badge
                  variant={isSelected ? "secondary" : "outline"}
                  className={isSelected ? "bg-primary-foreground/20 text-primary-foreground border-0" : ""}
                >
                  {campaign.contactCount}
                </Badge>
              </div>
            );
          })}
          {filteredCampaigns.length === 0 && (
            <div className="text-center py-6">
              <Megaphone className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">Žiadne kampane</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {selectedCampaignId && (
        <div className="border-t flex flex-col flex-1 min-h-0">
          <div
            className="px-3 py-2 flex items-center justify-between gap-1 rounded-md mx-1 mt-1"
            data-testid="contacts-header"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Kontakty ({campaignContacts.length})
              </span>
              <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onOpenContactsModal(); }} data-testid="btn-maximize-contacts"><Maximize2 className="h-3.5 w-3.5" /></Button>
            </div>
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              {autoCountdown !== null && (
                <Badge variant="secondary" className="text-[10px] font-mono">
                  {autoCountdown}s
                </Badge>
              )}
              <Button size="sm" variant={isAutoMode ? "default" : "ghost"} onClick={onToggleAutoMode} className={`text-xs gap-1 ${isAutoMode ? "bg-green-600 text-white" : ""}`} data-testid="btn-auto-mode">
                {isAutoMode ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                Auto
              </Button>
              <Button size="sm" variant="ghost" onClick={onLoadNextContact} disabled={isLoadingContact || campaignContacts.length === 0 || isAutoMode} className="text-xs gap-1" data-testid="btn-next-contact">
                {isLoadingContact ? <Loader2 className="h-3 w-3 animate-spin" /> : <SkipForward className="h-3 w-3" />}
                Ďalší
              </Button>
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="px-2 pb-2 space-y-1">
              {(() => {
                const now = new Date();
                const isDue = (cc: EnrichedCampaignContact) => cc.callbackDate && new Date(cc.callbackDate) <= now;
                const isMine = (cc: EnrichedCampaignContact) => cc.assignedTo === currentUserId;
                const isTeam = (cc: EnrichedCampaignContact) => !cc.assignedTo;
                const isCallback = (cc: EnrichedCampaignContact) => cc.status === "callback_scheduled";

                const sortByDate = (a: EnrichedCampaignContact, b: EnrichedCampaignContact) => {
                  const aDate = a.callbackDate ? new Date(a.callbackDate).getTime() : Infinity;
                  const bDate = b.callbackDate ? new Date(b.callbackDate).getTime() : Infinity;
                  return aDate - bDate;
                };

                const myDueCallbacks = campaignContacts.filter(cc => isCallback(cc) && isMine(cc) && isDue(cc)).sort(sortByDate);
                const teamDueCallbacks = campaignContacts.filter(cc => isCallback(cc) && isTeam(cc) && isDue(cc)).sort(sortByDate);
                const myUpcomingCallbacks = campaignContacts.filter(cc => isCallback(cc) && isMine(cc) && !isDue(cc)).sort(sortByDate);
                const teamUpcomingCallbacks = campaignContacts.filter(cc => isCallback(cc) && isTeam(cc) && !isDue(cc)).sort(sortByDate);
                const pendingContacts = campaignContacts.filter(cc => cc.status === "pending");
                const otherCallbacks = campaignContacts.filter(cc => isCallback(cc) && cc.assignedTo && cc.assignedTo !== currentUserId).sort(sortByDate);

                const sortedContacts = [
                  ...myDueCallbacks,
                  ...teamDueCallbacks,
                  ...myUpcomingCallbacks,
                  ...teamUpcomingCallbacks,
                  ...pendingContacts,
                  ...otherCallbacks,
                ];

                const myCallbackCount = myDueCallbacks.length;
                const teamCallbackCount = teamDueCallbacks.length;

                if (sortedContacts.length === 0) {
                  return (
                    <div className="text-center py-6">
                      <Users className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                      <p className="text-xs text-muted-foreground">Žiadne čakajúce kontakty</p>
                    </div>
                  );
                }

                return (
                  <>
                    {(myCallbackCount > 0 || teamCallbackCount > 0) && (
                      <div className="flex flex-wrap items-center gap-1.5 px-1 pb-1.5">
                        {myCallbackCount > 0 && (
                          <Badge variant="default" className="text-[9px] gap-1 bg-purple-500 text-white">
                            <User className="h-2.5 w-2.5" />
                            {myCallbackCount} moje
                          </Badge>
                        )}
                        {teamCallbackCount > 0 && (
                          <Badge variant="default" className="text-[9px] gap-1 bg-blue-500 text-white">
                            <Users className="h-2.5 w-2.5" />
                            {teamCallbackCount} tímové
                          </Badge>
                        )}
                      </div>
                    )}
                    {sortedContacts.map((cc) => {
                      const cust = cc.customer;
                      if (!cust) return null;
                      const isCallback = cc.status === "callback_scheduled";
                      const isDueCallback = isCallback && cc.callbackDate && new Date(cc.callbackDate) <= now;
                      const isMyCallback = isCallback && cc.assignedTo === currentUserId;
                      const isTeamCallback = isCallback && !cc.assignedTo;
                      const callbackDateStr = cc.callbackDate ? format(new Date(cc.callbackDate), "dd.MM. HH:mm") : null;

                      let ringClass = "";
                      if (isDueCallback && isMyCallback) ringClass = "ring-1 ring-purple-400 dark:ring-purple-600 bg-purple-50/50 dark:bg-purple-950/20";
                      else if (isDueCallback && isTeamCallback) ringClass = "ring-1 ring-blue-400 dark:ring-blue-600 bg-blue-50/50 dark:bg-blue-950/20";
                      else if (isCallback) ringClass = "bg-muted/30";

                      return (
                        <div
                          key={cc.id}
                          className={`flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer hover-elevate ${ringClass}`}
                          onClick={() => onSelectCampaignContact(cc)}
                          data-testid={`contact-item-${cc.id}`}
                        >
                          <div className="relative shrink-0">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className={`text-xs ${isDueCallback && isMyCallback ? "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300" : isDueCallback ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300" : "bg-muted"}`}>
                                {cust.firstName?.[0]}{cust.lastName?.[0]}
                              </AvatarFallback>
                            </Avatar>
                            {isCallback && (
                              <div className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full flex items-center justify-center ${isMyCallback ? "bg-purple-500" : "bg-blue-500"}`}>
                                {isMyCallback ? <User className="h-2.5 w-2.5 text-white" /> : <Users className="h-2.5 w-2.5 text-white" />}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {cust.firstName} {cust.lastName}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {cust.phone || cust.email || "—"}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-0.5 shrink-0">
                            {isCallback && (
                              <Badge variant={isDueCallback ? "default" : "outline"} className={`text-[9px] px-1 py-0 ${isDueCallback && isMyCallback ? "bg-purple-500 text-white" : isDueCallback ? "bg-blue-500 text-white" : ""}`}>
                                {isDueCallback ? "Zavolať!" : isMyCallback ? "Môj CB" : "Tím CB"}
                              </Badge>
                            )}
                            {callbackDateStr && (
                              <span className={`text-[9px] ${isDueCallback ? (isMyCallback ? "text-purple-600 dark:text-purple-400" : "text-blue-600 dark:text-blue-400") + " font-medium" : "text-muted-foreground"}`}>
                                {callbackDateStr}
                              </span>
                            )}
                            {cc.attemptCount > 0 && (
                              <span className="text-[9px] text-muted-foreground">
                                {cc.attemptCount}x
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </>
                );
              })()}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

function ScriptViewer({ script }: { script: string | null }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedValues, setSelectedValues] = useState<Record<string, string>>({});

  if (!script) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Pre túto kampaň nie je definovaný scenár</p>
        </div>
      </div>
    );
  }

  let parsedScript: ParsedScript | null = null;
  try {
    parsedScript = JSON.parse(script);
  } catch {
    const lines = script.split("\n");
    return (
      <ScrollArea className="flex-1">
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
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Scenár neobsahuje žiadne kroky</p>
        </div>
      </div>
    );
  }

  const currentStep = parsedScript.steps[currentStepIndex];
  const totalSteps = parsedScript.steps.length;

  const handleValueChange = (elementId: string, value: string) => {
    setSelectedValues(prev => ({ ...prev, [elementId]: value }));
  };

  return (
    <div className="flex flex-col flex-1">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-normal text-xs">
            {currentStepIndex + 1}/{totalSteps}
          </Badge>
          <span className="font-medium text-sm">{currentStep.title}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentStepIndex(Math.max(0, currentStepIndex - 1))}
            disabled={currentStepIndex === 0}
            data-testid="btn-script-prev"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentStepIndex(Math.min(totalSteps - 1, currentStepIndex + 1))}
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
                    <p className="mt-1 text-foreground text-sm">{element.content}</p>
                  )}
                </div>
              )}
              {element.type === "text" && (
                <div className="space-y-1">
                  <label className="text-sm font-medium">{element.label}</label>
                  <div className="p-2 rounded-md bg-muted/50 text-sm">{element.content || "..."}</div>
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
                    <SelectTrigger data-testid={`select-script-${element.id}`}>
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
          <span className="text-xs text-green-600 dark:text-green-400 font-medium">
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

function CommunicationCanvas({
  contact,
  campaign,
  activeChannel,
  onChannelChange,
  timeline,
  onSendEmail,
  onSendSms,
  isSendingEmail,
  isSendingSms,
  onMakeCall,
  isSipRegistered,
  onOpenScriptModal,
  onUpdateContact,
  isUpdatingContact,
}: {
  contact: Customer | null;
  campaign: Campaign | null;
  activeChannel: string;
  onChannelChange: (ch: string) => void;
  timeline: TimelineEntry[];
  onSendEmail: (data: { subject: string; body: string; attachments?: { name: string; contentBase64: string; contentType: string }[] }) => void;
  onSendSms: (message: string) => void;
  isSendingEmail: boolean;
  isSendingSms: boolean;
  onMakeCall?: (phoneNumber: string) => void;
  isSipRegistered?: boolean;
  onOpenScriptModal: () => void;
  onUpdateContact?: (data: CustomerFormData) => void;
  isUpdatingContact?: boolean;
}) {
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [smsMessage, setSmsMessage] = useState("");
  const [emailAttachments, setEmailAttachments] = useState<File[]>([]);
  const [phoneSubTab, setPhoneSubTab] = useState<"card" | "details">("card");

  useEffect(() => {
    setPhoneSubTab("card");
  }, [contact?.id]);

  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timelineEndRef = useRef<HTMLDivElement>(null);

  const language = contact?.country === "CZ" ? "cs" : contact?.country === "HU" ? "hu" : contact?.country === "RO" ? "ro" : contact?.country === "IT" ? "it" : contact?.country === "DE" ? "de" : contact?.country === "US" ? "en" : "sk";
  const { data: emailTemplates = [] } = useQuery<{ id: string; name: string; subject: string | null; content: string; contentHtml: string | null }[]>({
    queryKey: ["/api/message-templates", "email", language],
    queryFn: async () => {
      const res = await fetch(`/api/message-templates?type=email&isActive=true&language=${language}`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: !!contact,
  });

  const replaceTemplateVars = (content: string): string => {
    if (!content || !contact) return content;
    const replacements: Record<string, string> = {
      "{{customer.firstName}}": contact.firstName || "",
      "{{customer.lastName}}": contact.lastName || "",
      "{{customer.fullName}}": `${contact.firstName || ""} ${contact.lastName || ""}`.trim(),
      "{{customer.email}}": contact.email || "",
      "{{customer.phone}}": contact.phone || "",
      "{{customer.address}}": contact.address || "",
      "{{customer.city}}": contact.city || "",
      "{{customer.postalCode}}": contact.postalCode || "",
      "{{customer.country}}": contact.country || "",
    };
    let result = content;
    for (const [key, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), value);
    }
    return result;
  };

  const handleSelectTemplate = (templateId: string) => {
    const template = emailTemplates.find(t => t.id === templateId);
    if (template) {
      const subject = replaceTemplateVars(template.subject || "");
      const content = replaceTemplateVars(template.contentHtml || template.content || "");
      setEmailSubject(subject);
      setEmailBody(content);
      if (editorRef.current) editorRef.current.innerHTML = content;
      fetch(`/api/message-templates/${templateId}/use`, { method: "POST", credentials: "include" });
    }
  };

  useEffect(() => {
    timelineEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [timeline.length]);

  const handleSendEmail = async () => {
    const body = editorRef.current?.innerHTML || emailBody;
    if (emailSubject && body) {
      let attachmentData: { name: string; contentBase64: string; contentType: string }[] = [];
      if (emailAttachments.length > 0) {
        attachmentData = await Promise.all(
          emailAttachments.map(async (file) => {
            const buffer = await file.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            let binary = "";
            for (let i = 0; i < bytes.length; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            return {
              name: file.name,
              contentBase64: btoa(binary),
              contentType: file.type || "application/octet-stream",
            };
          })
        );
      }
      onSendEmail({ subject: emailSubject, body, attachments: attachmentData.length > 0 ? attachmentData : undefined });
      setEmailSubject("");
      setEmailBody("");
      setEmailAttachments([]);
      if (editorRef.current) editorRef.current.innerHTML = "";
    }
  };

  const execFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const handleAddAttachments = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setEmailAttachments(prev => [...prev, ...Array.from(files)]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => {
    setEmailAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSendSms = () => {
    if (smsMessage) {
      onSendSms(smsMessage);
      setSmsMessage("");
    }
  };

  const smsCharCount = smsMessage.length;
  const smsCount = Math.ceil(smsCharCount / 160) || 1;

  if (!contact) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/10">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-muted/30 flex items-center justify-center">
            <Headphones className="h-10 w-10 text-muted-foreground/30" />
          </div>
          <h3 className="font-semibold text-lg mb-2 text-muted-foreground">Pripravený na prácu</h3>
          <p className="text-sm text-muted-foreground/70">
            Vyberte kampaň a načítajte kontakt pre začatie komunikácie
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="h-12 border-b bg-card flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span className="font-semibold text-sm" data-testid="text-canvas-contact-name">
              {contact.firstName} {contact.lastName}
            </span>
          </div>
          {campaign && (
            <>
              <Separator orientation="vertical" className="h-5" />
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Megaphone className="h-3.5 w-3.5" />
                <span className="text-xs">{campaign.name}</span>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          {contact.phone && (
            <>
              <span className="text-xs text-muted-foreground px-2">{contact.phone}</span>
              {isSipRegistered && onMakeCall && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onMakeCall(contact.phone!)}
                  data-testid="btn-call-from-canvas"
                  title="Zavolať"
                >
                  <Phone className="h-4 w-4 text-green-600" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="border-b bg-card">
        <div className="flex">
          <button
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeChannel === "phone"
                ? "border-blue-500 text-blue-600 dark:text-blue-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onChannelChange("phone")}
            data-testid="tab-phone"
          >
            <Phone className="h-3.5 w-3.5" />
            HOVOR
          </button>
          <button
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeChannel === "script"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onChannelChange("script")}
            data-testid="tab-script"
          >
            <FileText className="h-3.5 w-3.5" />
            SCRIPT
          </button>
          <button
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeChannel === "email"
                ? "border-green-500 text-green-600 dark:text-green-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onChannelChange("email")}
            data-testid="tab-email"
          >
            <Mail className="h-3.5 w-3.5" />
            EMAIL
          </button>
          <button
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeChannel === "sms"
                ? "border-orange-500 text-orange-600 dark:text-orange-400"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onChannelChange("sms")}
            data-testid="tab-sms"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            SMS
          </button>
        </div>
      </div>

      <div className="border-b bg-muted/30 px-4 py-1.5 flex items-center gap-4 flex-wrap text-xs" data-testid="contact-info-bar">
        <div className="flex items-center gap-1.5">
          <User className="h-3 w-3 text-muted-foreground" />
          <span className="font-medium">{contact.firstName} {contact.lastName}</span>
        </div>
        {contact.phone && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Phone className="h-3 w-3" />
            <span>{contact.phone}</span>
          </div>
        )}
        {contact.email && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Mail className="h-3 w-3" />
            <span>{contact.email}</span>
          </div>
        )}
        {contact.country && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Globe className="h-3 w-3" />
            <span>{contact.country}</span>
          </div>
        )}
        {contact.notes && (
          <div className="flex items-center gap-1.5 text-muted-foreground truncate max-w-[200px]">
            <FileText className="h-3 w-3 shrink-0" />
            <span className="truncate">{contact.notes.split("\n")[0]}</span>
          </div>
        )}
      </div>

      {activeChannel === "script" && (
        <div className="flex flex-col flex-1 relative">
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-2 right-2 z-10"
            onClick={onOpenScriptModal}
            data-testid="btn-maximize-script"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          <ScriptViewer script={campaign?.script || null} />
        </div>
      )}

      {activeChannel === "phone" && (
        <div className="flex-1 flex flex-col">
          <div className="border-b bg-card/50 flex items-center">
            <button
              className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium border-b-2 transition-colors ${
                phoneSubTab === "card"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setPhoneSubTab("card")}
              data-testid="subtab-customer-card"
            >
              <Pencil className="h-3 w-3" />
              Karta zákazníka
            </button>
            <button
              className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium border-b-2 transition-colors ${
                phoneSubTab === "details"
                  ? "border-purple-500 text-purple-600 dark:text-purple-400"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setPhoneSubTab("details")}
              data-testid="subtab-customer-details"
            >
              <Eye className="h-3 w-3" />
              Detail zákazníka
            </button>
          </div>

          {phoneSubTab === "card" && contact && (
            <ScrollArea className="flex-1">
              <div className="p-4">
                <CustomerForm
                  key={contact.id}
                  initialData={contact}
                  onSubmit={(data) => onUpdateContact?.(data)}
                  isLoading={isUpdatingContact}
                  onCancel={() => setPhoneSubTab("details")}
                />
              </div>
            </ScrollArea>
          )}

          {phoneSubTab === "details" && contact && (
            <ScrollArea className="flex-1">
              <div className="p-4">
                <CustomerDetailsContent customer={contact} onEdit={() => {}} compact />
              </div>
            </ScrollArea>
          )}
        </div>
      )}

      {activeChannel === "email" && (
        <div className="flex-1 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-3">
              {timeline.filter(e => e.type === "email").map((entry) => (
                <div key={entry.id} className={`flex ${entry.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-lg p-3 ${
                    entry.direction === "outbound"
                      ? "bg-green-100 dark:bg-green-950/40 text-green-900 dark:text-green-100"
                      : "bg-muted"
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Mail className="h-3 w-3" />
                      <span className="text-xs font-medium">{entry.content}</span>
                    </div>
                    {entry.details && (
                      <p className="text-xs opacity-80">{entry.details}</p>
                    )}
                    <span className="text-[10px] opacity-60 mt-1 block">
                      {format(entry.timestamp, "HH:mm", { locale: sk })}
                    </span>
                  </div>
                </div>
              ))}
              {timeline.filter(e => e.type === "email").length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Mail className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">Žiadne emaily</p>
                </div>
              )}
            </div>
          </ScrollArea>
          <div className="border-t bg-card">
            <div className="p-3 space-y-2">
              {emailTemplates.length > 0 && (
                <Select onValueChange={handleSelectTemplate}>
                  <SelectTrigger data-testid="select-email-template" className="text-sm">
                    <SelectValue placeholder="Vybrať šablónu" />
                  </SelectTrigger>
                  <SelectContent>
                    {emailTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Input
                placeholder="Predmet emailu"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                disabled={isSendingEmail}
                data-testid="input-email-subject"
              />
              <div className="border rounded-md overflow-visible">
                <div className="flex items-center gap-0.5 p-1.5 border-b bg-muted/30 flex-wrap">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => execFormat("bold")}
                    data-testid="btn-format-bold"
                    title="Tučné"
                  >
                    <Bold className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => execFormat("italic")}
                    data-testid="btn-format-italic"
                    title="Kurzíva"
                  >
                    <Italic className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => execFormat("underline")}
                    data-testid="btn-format-underline"
                    title="Podčiarknuté"
                  >
                    <Underline className="h-3.5 w-3.5" />
                  </Button>
                  <Separator orientation="vertical" className="h-5 mx-1" />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => execFormat("insertUnorderedList")}
                    data-testid="btn-format-ul"
                    title="Odrážkový zoznam"
                  >
                    <List className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => execFormat("insertOrderedList")}
                    data-testid="btn-format-ol"
                    title="Číslovaný zoznam"
                  >
                    <ListOrdered className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div
                  ref={editorRef}
                  contentEditable={!isSendingEmail}
                  className="min-h-[120px] max-h-[200px] overflow-y-auto p-3 text-sm focus:outline-none"
                  data-testid="input-email-body"
                  onInput={() => {
                    setEmailBody(editorRef.current?.innerHTML || "");
                  }}
                  style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                  suppressContentEditableWarning
                />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleAddAttachments}
                data-testid="input-email-attachments"
              />
              {emailAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {emailAttachments.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      className="flex items-center gap-1.5 bg-muted rounded-md px-2 py-1 text-xs"
                      data-testid={`attachment-item-${idx}`}
                    >
                      <FileIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate max-w-[140px]">{file.name}</span>
                      <span className="text-muted-foreground shrink-0">({formatFileSize(file.size)})</span>
                      <button
                        onClick={() => removeAttachment(idx)}
                        className="ml-0.5 text-muted-foreground hover:text-destructive"
                        data-testid={`btn-remove-attachment-${idx}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSendingEmail}
                  className="gap-1.5"
                  data-testid="btn-add-attachment"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  Príloha
                </Button>
                <Button
                  onClick={handleSendEmail}
                  disabled={!emailSubject || !(editorRef.current?.innerHTML || emailBody) || isSendingEmail}
                  className="gap-2"
                  data-testid="btn-send-email"
                >
                  {isSendingEmail ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Odoslať
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeChannel === "sms" && (
        <div className="flex-1 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-3">
              {timeline.filter(e => e.type === "sms").map((entry) => (
                <div key={entry.id} className={`flex ${entry.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-lg p-3 ${
                    entry.direction === "outbound"
                      ? "bg-orange-100 dark:bg-orange-950/40 text-orange-900 dark:text-orange-100"
                      : "bg-muted"
                  }`}>
                    <p className="text-sm">{entry.content}</p>
                    <span className="text-[10px] opacity-60 mt-1 block">
                      {format(entry.timestamp, "HH:mm", { locale: sk })}
                    </span>
                  </div>
                </div>
              ))}
              {timeline.filter(e => e.type === "sms").length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">Žiadne SMS správy</p>
                </div>
              )}
            </div>
          </ScrollArea>
          <div className="border-t p-4 bg-card">
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Textarea
                  placeholder="Text SMS správy..."
                  value={smsMessage}
                  onChange={(e) => setSmsMessage(e.target.value)}
                  disabled={isSendingSms}
                  rows={2}
                  data-testid="input-sms-message"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground px-1">
                  <span>{smsCharCount} znakov</span>
                  <span>{smsCount} SMS</span>
                </div>
              </div>
              <Button
                onClick={handleSendSms}
                disabled={!smsMessage || isSendingSms}
                size="icon"
                className="self-start mt-0.5"
                data-testid="btn-send-sms"
              >
                {isSendingSms ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function CustomerInfoPanel({
  contact,
  campaign,
  callNotes,
  onAddNote,
  onDisposition,
  onQuickAction,
  rightTab,
  onRightTabChange,
  contactHistory,
  dispositions,
  currentUserId,
  onOpenDispositionModal,
}: {
  contact: Customer | null;
  campaign: Campaign | null;
  callNotes: string;
  onAddNote: (note: string) => void;
  onDisposition: (value: string, parentCode?: string, callbackDateTime?: string, callbackAssignedTo?: string | null) => void;
  onQuickAction: (action: string) => void;
  rightTab: string;
  onRightTabChange: (tab: string) => void;
  contactHistory: ContactHistory[];
  dispositions: CampaignDisposition[];
  currentUserId?: string;
  onOpenDispositionModal: () => void;
}) {
  const [newNote, setNewNote] = useState("");
  const [selectedParentDisposition, setSelectedParentDisposition] = useState<string | null>(null);
  const [callbackDate, setCallbackDate] = useState<string>("");
  const [callbackTime, setCallbackTime] = useState<string>("09:00");
  const [callbackAssignMode, setCallbackAssignMode] = useState<"me" | "all">("me");

  const handleAddNote = () => {
    if (newNote.trim()) {
      onAddNote(newNote);
      setNewNote("");
    }
  };

  if (!contact) {
    return (
      <div className="w-64 border-l bg-card flex items-center justify-center shrink-0">
        <div className="text-center p-6">
          <User className="h-10 w-10 mx-auto mb-3 text-muted-foreground/20" />
          <p className="text-xs text-muted-foreground">Žiadny kontakt</p>
        </div>
      </div>
    );
  }

  const leadScore = (contact as any).leadScore || 0;
  const stars = Math.round(leadScore / 20);

  return (
    <div className="w-64 border-l bg-card flex flex-col shrink-0">
      <div className="p-3 border-b">
        <div className="flex items-start gap-2.5">
          <Avatar className="h-10 w-10 ring-2 ring-primary/20 shrink-0">
            <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground font-bold text-xs">
              {contact.firstName?.[0]}{contact.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h2 className="font-bold text-sm truncate" data-testid="text-contact-name">
              {contact.firstName} {contact.lastName}
            </h2>
            <div className="flex items-center gap-1.5 mt-1">
              <Badge variant="secondary" className="text-[10px]">
                {contact.status || "Nový"}
              </Badge>
              <div className="flex items-center gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`h-2.5 w-2.5 ${i < stars ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/20"}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b">
        <div className="flex">
          <button
            className={`flex-1 py-2 text-[10px] font-semibold uppercase tracking-wider border-b-2 transition-colors ${
              rightTab === "actions"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onRightTabChange("actions")}
            data-testid="tab-actions"
          >
            Akcie
          </button>
          <button
            className={`flex-1 py-2 text-[10px] font-semibold uppercase tracking-wider border-b-2 transition-colors ${
              rightTab === "profile"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onRightTabChange("profile")}
            data-testid="tab-profile"
          >
            Profil
          </button>
          <button
            className={`flex-1 py-2 text-[10px] font-semibold uppercase tracking-wider border-b-2 transition-colors ${
              rightTab === "history"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onRightTabChange("history")}
            data-testid="tab-history"
          >
            História
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {rightTab === "profile" && (
          <div className="p-3 space-y-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 p-2.5 rounded-md bg-blue-50 dark:bg-blue-950/30">
                <Phone className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                <span className="text-sm font-medium truncate" data-testid="text-contact-phone">
                  {contact.phone || "—"}
                </span>
              </div>
              <div className="flex items-center gap-2.5 p-2.5 rounded-md bg-green-50 dark:bg-green-950/30">
                <Mail className="h-3.5 w-3.5 text-green-500 shrink-0" />
                <span className="text-sm truncate" data-testid="text-contact-email">
                  {contact.email || "—"}
                </span>
              </div>
              <div className="flex items-center gap-2.5 p-2.5 rounded-md bg-muted/50">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm">{[contact.address, contact.city].filter(Boolean).join(", ") || "—"}</span>
              </div>
              <div className="flex items-center gap-2.5 p-2.5 rounded-md bg-muted/50">
                <Building className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm">{contact.country || "SK"}</span>
              </div>
            </div>

            {campaign && (
              <div className="pt-2 border-t">
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Kampaň
                </h4>
                <div className="p-2.5 rounded-md bg-muted/50">
                  <p className="text-sm font-medium">{campaign.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{campaign.type} / {campaign.channel}</p>
                </div>
              </div>
            )}

            <div className="pt-2 border-t">
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <StickyNote className="h-3 w-3" />
                Poznámky
              </h4>
              {callNotes && (
                <div className="p-2.5 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-sm mb-2">
                  <pre className="whitespace-pre-wrap font-sans text-foreground text-xs">{callNotes}</pre>
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="Poznámka..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
                  className="text-xs"
                  data-testid="input-call-notes"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleAddNote}
                  disabled={!newNote.trim()}
                  data-testid="btn-add-note"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {rightTab === "history" && (
          <div className="p-3 space-y-2">
            {contactHistory.length === 0 && (
              <div className="text-center py-8">
                <History className="h-8 w-8 mx-auto mb-2 text-muted-foreground/20" />
                <p className="text-xs text-muted-foreground">Žiadna história komunikácie</p>
              </div>
            )}
            {contactHistory.map((item) => (
              <div key={item.id} className="flex items-start gap-2.5 p-2.5 rounded-md bg-muted/30">
                <div className={`p-1 rounded-full shrink-0 mt-0.5 ${
                  item.type === "call" ? "bg-blue-100 dark:bg-blue-950/40" :
                  item.type === "email" ? "bg-green-100 dark:bg-green-950/40" :
                  "bg-orange-100 dark:bg-orange-950/40"
                }`}>
                  {item.type === "call" && <Phone className="h-3 w-3 text-blue-500" />}
                  {item.type === "email" && <Mail className="h-3 w-3 text-green-500" />}
                  {item.type === "sms" && <MessageSquare className="h-3 w-3 text-orange-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium capitalize">{item.type}</span>
                    <Badge variant="outline" className="text-[10px] py-0 px-1">
                      {item.direction === "inbound" ? "Prichádz." : "Odchádz."}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {format(new Date(item.date), "d.M.yyyy HH:mm", { locale: sk })}
                  </p>
                  {item.notes && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">{item.notes}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {rightTab === "actions" && (
          <div className="p-3 space-y-3">
            <div>
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Zap className="h-3 w-3" />
                Rýchle akcie
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onQuickAction("call")}
                  disabled={!contact.phone}
                  className="gap-1.5 justify-start"
                  data-testid="btn-quick-call"
                >
                  <Phone className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-xs">Volať</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onQuickAction("email")}
                  disabled={!contact.email}
                  className="gap-1.5 justify-start"
                  data-testid="btn-quick-email"
                >
                  <Mail className="h-3.5 w-3.5 text-green-500" />
                  <span className="text-xs">Email</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onQuickAction("sms")}
                  disabled={!contact.phone}
                  className="gap-1.5 justify-start"
                  data-testid="btn-quick-sms"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-orange-500" />
                  <span className="text-xs">SMS</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onQuickAction("task")}
                  className="gap-1.5 justify-start"
                  data-testid="btn-quick-task"
                >
                  <CalendarPlus className="h-3.5 w-3.5 text-purple-500" />
                  <span className="text-xs">Úloha</span>
                </Button>
              </div>
            </div>

            <Separator />

            <div>
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                  {selectedParentDisposition ? "Podkategória" : "Výsledok kontaktu"}
                </h4>
                <Button size="icon" variant="ghost" onClick={onOpenDispositionModal} data-testid="btn-maximize-disposition">
                  <Maximize2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {dispositions.length === 0 ? (
                <div className="text-center py-4">
                  <Info className="h-6 w-6 mx-auto text-muted-foreground/30 mb-1" />
                  <p className="text-xs text-muted-foreground">Žiadne výsledky kontaktu definované pre túto kampaň</p>
                </div>
              ) : selectedParentDisposition ? (
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={() => {
                      setSelectedParentDisposition(null);
                      setCallbackDate("");
                      setCallbackTime("09:00");
                    }}
                    data-testid="btn-disposition-back"
                  >
                    <ChevronLeft className="h-3 w-3" />
                    Späť
                  </Button>
                  {(() => {
                    const parent = dispositions.find(d => d.id === selectedParentDisposition);
                    const children = dispositions.filter(d => d.parentId === selectedParentDisposition && d.isActive);
                    
                    if (parent?.actionType === "callback") {
                      const cbAssignTo = callbackAssignMode === "me" && currentUserId ? currentUserId : null;
                      return (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[11px] text-muted-foreground">Dátum</label>
                              <Input
                                type="date"
                                value={callbackDate}
                                onChange={(e) => setCallbackDate(e.target.value)}
                                min={new Date().toISOString().split("T")[0]}
                                data-testid="input-callback-date"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] text-muted-foreground">Čas</label>
                              <Input
                                type="time"
                                value={callbackTime}
                                onChange={(e) => setCallbackTime(e.target.value)}
                                data-testid="input-callback-time"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-[11px] text-muted-foreground">Priradiť komu</label>
                            <div className="flex gap-1 mt-1">
                              <Button
                                size="sm"
                                variant={callbackAssignMode === "me" ? "default" : "outline"}
                                className="flex-1 gap-1 text-xs"
                                onClick={() => setCallbackAssignMode("me")}
                                disabled={!currentUserId}
                                data-testid="btn-callback-assign-me"
                              >
                                <User className="h-3 w-3" />
                                Mne
                              </Button>
                              <Button
                                size="sm"
                                variant={callbackAssignMode === "all" ? "default" : "outline"}
                                className="flex-1 gap-1 text-xs"
                                onClick={() => setCallbackAssignMode("all")}
                                data-testid="btn-callback-assign-all"
                              >
                                <Users className="h-3 w-3" />
                                Všetkým
                              </Button>
                            </div>
                          </div>
                          {children.length > 0 && (
                            <div className="grid grid-cols-1 gap-1">
                              {children.map((child) => {
                                const IconComp = DISPOSITION_ICON_MAP[child.icon || ""] || CircleDot;
                                const colorClass = DISPOSITION_COLOR_MAP[child.color || "gray"] || DISPOSITION_COLOR_MAP.gray;
                                return (
                                  <Button
                                    key={child.id}
                                    variant="outline"
                                    size="sm"
                                    className={`gap-2 justify-start ${colorClass}`}
                                    onClick={() => onDisposition(child.code, parent?.code, callbackDate && callbackTime ? `${callbackDate}T${callbackTime}` : undefined, cbAssignTo)}
                                    data-testid={`btn-disposition-${child.code}`}
                                  >
                                    <IconComp className="h-4 w-4" />
                                    <span className="text-xs font-medium">{child.name}</span>
                                  </Button>
                                );
                              })}
                            </div>
                          )}
                          <Button
                            size="sm"
                            className="w-full"
                            disabled={!callbackDate}
                            onClick={() => onDisposition(parent!.code, undefined, callbackDate && callbackTime ? `${callbackDate}T${callbackTime}` : undefined, cbAssignTo)}
                            data-testid="btn-disposition-confirm-callback"
                          >
                            <CalendarPlus className="h-4 w-4 mr-1" />
                            Potvrdiť preplánovanie
                          </Button>
                        </div>
                      );
                    }
                    
                    if (children.length > 0) {
                      return (
                        <div className="grid grid-cols-1 gap-1.5">
                          {children.map((child) => {
                            const IconComp = DISPOSITION_ICON_MAP[child.icon || ""] || CircleDot;
                            const colorClass = DISPOSITION_COLOR_MAP[child.color || "gray"] || DISPOSITION_COLOR_MAP.gray;
                            return (
                              <Button
                                key={child.id}
                                variant="outline"
                                size="sm"
                                className={`gap-2 justify-start ${colorClass}`}
                                onClick={() => onDisposition(child.code, parent?.code)}
                                data-testid={`btn-disposition-${child.code}`}
                              >
                                <IconComp className="h-4 w-4" />
                                <span className="text-xs font-medium">{child.name}</span>
                              </Button>
                            );
                          })}
                        </div>
                      );
                    }
                    
                    return null;
                  })()}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-1.5">
                  {dispositions.filter(d => !d.parentId && d.isActive).map((disp) => {
                    const IconComp = DISPOSITION_ICON_MAP[disp.icon || ""] || CircleDot;
                    const colorClass = DISPOSITION_COLOR_MAP[disp.color || "gray"] || DISPOSITION_COLOR_MAP.gray;
                    const children = dispositions.filter(d => d.parentId === disp.id && d.isActive);
                    const hasChildren = children.length > 0;
                    const isCallback = disp.actionType === "callback";
                    
                    return (
                      <Button
                        key={disp.id}
                        variant="outline"
                        size="sm"
                        className={`gap-2 justify-start ${colorClass}`}
                        onClick={() => {
                          if (hasChildren || isCallback) {
                            setSelectedParentDisposition(disp.id);
                            if (isCallback) {
                              const tomorrow = new Date();
                              tomorrow.setDate(tomorrow.getDate() + 1);
                              setCallbackDate(tomorrow.toISOString().split("T")[0]);
                            }
                          } else {
                            onDisposition(disp.code);
                          }
                        }}
                        data-testid={`btn-disposition-${disp.code}`}
                      >
                        <IconComp className="h-4 w-4" />
                        <span className="text-xs font-medium flex-1 text-left">{disp.name}</span>
                        {(hasChildren || isCallback) && <ChevronRight className="h-3 w-3 opacity-50" />}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export default function AgentWorkspacePage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const { makeCall, isRegistered: isSipRegistered } = useSip();
  const [, setLocation] = useLocation();
  const { open: sidebarOpen, setOpen: setSidebarOpen } = useSidebar();
  const prevSidebarOpenRef = useRef(sidebarOpen);

  const agentSession = useAgentSession();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [currentContact, setCurrentContact] = useState<Customer | null>(null);
  const [currentCampaignContactId, setCurrentCampaignContactId] = useState<string | null>(null);
  const [sessionLoginOpen, setSessionLoginOpen] = useState(true);
  const [activeChannel, setActiveChannel] = useState("phone");
  const [rightTab, setRightTab] = useState("actions");
  const [callNotes, setCallNotes] = useState("");
  const [channelFilter, setChannelFilter] = useState("all");
  const [stats, setStats] = useState({ calls: 0, emails: 0, sms: 0 });
  const [showOnlyAssigned, setShowOnlyAssigned] = useState(false);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [autoCountdown, setAutoCountdown] = useState<number | null>(null);
  const autoTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [contactsModalOpen, setContactsModalOpen] = useState(false);
  const [tasksModalOpen, setTasksModalOpen] = useState(false);
  const [dispositionModalOpen, setDispositionModalOpen] = useState(false);
  const [modalSelectedParent, setModalSelectedParent] = useState<string | null>(null);
  const [modalCallbackDate, setModalCallbackDate] = useState("");
  const [modalCallbackTime, setModalCallbackTime] = useState("09:00");
  const [modalCallbackAssign, setModalCallbackAssign] = useState<"me" | "all">("me");
  const [scriptModalOpen, setScriptModalOpen] = useState(false);
  const [modalFilter, setModalFilter] = useState<"all" | "my_callbacks" | "team_callbacks" | "pending" | "due">("all");
  const [modalSort, setModalSort] = useState<"callback_asc" | "name_asc" | "attempts_desc">("callback_asc");
  const [modalSearch, setModalSearch] = useState("");

  const allowedRoles = ["callCenter", "admin"];
  const hasRoleAccess = user && allowedRoles.includes(user.role);

  const { data: workspaceAccess = [] } = useQuery<any[]>({
    queryKey: ["/api/agent-workspace-access/current"],
    enabled: !!hasRoleAccess,
  });

  const allowedCountries = useMemo(() => {
    return workspaceAccess.map((a: any) => a.countryCode);
  }, [workspaceAccess]);

  const hasAccess = user && hasRoleAccess && (user.role === "admin" || allowedCountries.length > 0);

  useEffect(() => {
    if (user && hasRoleAccess && !hasAccess && workspaceAccess !== undefined) {
      setLocation("/");
    }
  }, [user, hasRoleAccess, hasAccess, setLocation, workspaceAccess]);

  useEffect(() => {
    if (hasAccess && !agentSession.isSessionActive && !agentSession.isLoading) {
      setSessionLoginOpen(true);
    }
  }, [hasAccess, agentSession.isSessionActive, agentSession.isLoading]);

  useEffect(() => {
    if (agentSession.isSessionActive) {
      prevSidebarOpenRef.current = sidebarOpen;
      setSidebarOpen(false);
      document.documentElement.setAttribute('data-agent-fullscreen', 'true');
    } else {
      document.documentElement.removeAttribute('data-agent-fullscreen');
    }
  }, [agentSession.isSessionActive]);

  useEffect(() => {
    return () => {
      setSidebarOpen(prevSidebarOpenRef.current);
      document.documentElement.removeAttribute('data-agent-fullscreen');
    };
  }, []);

  const { data: allCampaigns = [] } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
    enabled: !!hasAccess,
  });

  const { data: assignedCampaigns = [] } = useQuery<Campaign[]>({
    queryKey: ["/api/user/assigned-campaigns"],
    enabled: !!hasAccess,
  });

  const baseCampaigns = showOnlyAssigned ? assignedCampaigns : allCampaigns;

  const campaigns = useMemo(() => {
    if (user?.role === "admin") return baseCampaigns;
    if (allowedCountries.length === 0) return [];
    return baseCampaigns.filter((c) => {
      if (!c.countryCodes || c.countryCodes.length === 0) return true;
      return c.countryCodes.some((code: string) => allowedCountries.includes(code));
    });
  }, [baseCampaigns, allowedCountries, user?.role]);

  const { data: campaignDispositions = [] } = useQuery<CampaignDisposition[]>({
    queryKey: ["/api/campaigns", selectedCampaignId, "dispositions"],
    enabled: !!selectedCampaignId,
  });

  const { data: rawCampaignContacts = [] } = useQuery<EnrichedCampaignContact[]>({
    queryKey: ["/api/campaigns", selectedCampaignId, "contacts"],
    enabled: !!selectedCampaignId && !!hasAccess,
  });

  const pendingCampaignContacts = useMemo(() => {
    return rawCampaignContacts.filter(
      (cc) => cc.customer && (cc.status === "pending" || cc.status === "callback_scheduled")
    );
  }, [rawCampaignContacts]);

  const selectedCampaign = useMemo(() => {
    return campaigns.find((c) => c.id === selectedCampaignId) || null;
  }, [campaigns, selectedCampaignId]);

  const campaignAutoSettings = useMemo(() => {
    if (!selectedCampaign?.settings) return { autoMode: false, autoDelaySeconds: 5, contactSortField: "createdAt", contactSortOrder: "desc" };
    try {
      const s = JSON.parse(selectedCampaign.settings);
      return {
        autoMode: !!s.autoMode,
        autoDelaySeconds: s.autoDelaySeconds || 5,
        contactSortField: s.contactSortField || "createdAt",
        contactSortOrder: s.contactSortOrder || "desc",
      };
    } catch { return { autoMode: false, autoDelaySeconds: 5, contactSortField: "createdAt", contactSortOrder: "desc" }; }
  }, [selectedCampaign]);

  const sortedPendingContacts = useMemo(() => {
    if (!campaignAutoSettings.autoMode) return pendingCampaignContacts;
    const field = campaignAutoSettings.contactSortField;
    const order = campaignAutoSettings.contactSortOrder;
    return [...pendingCampaignContacts].sort((a, b) => {
      let aVal: any, bVal: any;
      if (field === "dateOfBirth") {
        aVal = a.customer?.dateOfBirth ? new Date(a.customer.dateOfBirth).getTime() : 0;
        bVal = b.customer?.dateOfBirth ? new Date(b.customer.dateOfBirth).getTime() : 0;
      } else if (field === "priorityScore") {
        aVal = (a as any).priorityScore || 0;
        bVal = (b as any).priorityScore || 0;
      } else {
        aVal = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        bVal = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      }
      return order === "desc" ? bVal - aVal : aVal - bVal;
    });
  }, [pendingCampaignContacts, campaignAutoSettings]);

  const { data: campaignContactCounts = {} } = useQuery<Record<string, { total: number; pending: number }>>({
    queryKey: ["/api/campaigns/contact-counts"],
    enabled: !!hasAccess,
  });

  const activeCampaigns = useMemo(() => {
    return campaigns
      .filter((c) => c.status === "active" || c.status === "paused")
      .map((c) => ({
        id: c.id,
        name: c.name,
        contactCount: campaignContactCounts[c.id]?.pending ?? 0,
        status: c.status,
        channel: c.channel || "phone",
      }));
  }, [campaigns, campaignContactCounts]);

  const { data: customerMessages = [] } = useQuery<any[]>({
    queryKey: ["/api/customers", currentContact?.id, "messages"],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${currentContact!.id}/messages`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: !!currentContact?.id,
  });

  const contactHistory: ContactHistory[] = useMemo(() => {
    return customerMessages.map((msg: any) => ({
      id: msg.id,
      type: msg.type === "sms" ? "sms" as const : "email" as const,
      direction: msg.direction as "inbound" | "outbound",
      date: msg.createdAt || msg.sentAt || new Date().toISOString(),
      status: msg.status || "sent",
      notes: msg.subject || msg.content?.substring(0, 80),
    }));
  }, [customerMessages]);

  useEffect(() => {
    if (autoTimerRef.current) {
      clearInterval(autoTimerRef.current);
      autoTimerRef.current = null;
    }
    if (!isAutoMode || currentContact || sortedPendingContacts.length === 0) {
      setAutoCountdown(null);
      return;
    }
    const delay = campaignAutoSettings.autoDelaySeconds;
    setAutoCountdown(delay);
    let remaining = delay;
    autoTimerRef.current = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        if (autoTimerRef.current) clearInterval(autoTimerRef.current);
        autoTimerRef.current = null;
        setAutoCountdown(null);
        const next = sortedPendingContacts[0];
        if (next?.customer) {
          setCurrentCampaignContactId(next.id);
          loadContact(next.customer);
        }
      } else {
        setAutoCountdown(remaining);
      }
    }, 1000);
    return () => { if (autoTimerRef.current) clearInterval(autoTimerRef.current); };
  }, [isAutoMode, currentContact, sortedPendingContacts, campaignAutoSettings.autoDelaySeconds]);

  useEffect(() => {
    setIsAutoMode(false);
    setAutoCountdown(null);
  }, [selectedCampaignId]);

  const dispositionMutation = useMutation({
    mutationFn: async (data: { contactId: string; campaignId: string; disposition: string; notes: string; callbackDateTime?: string; parentCode?: string; callbackAssignedTo?: string | null }) => {
      const disp = campaignDispositions.find(d => d.code === data.disposition) 
        || campaignDispositions.find(d => d.code === data.parentCode);
      
      const actionStatusMap: Record<string, string> = {
        callback: "callback_scheduled",
        dnd: "not_interested",
        complete: "completed",
        convert: "contacted",
        none: "contacted",
      };
      const newStatus = actionStatusMap[disp?.actionType || "none"] || "contacted";
      
      const updateData: Record<string, any> = {
        status: newStatus,
        lastContactedAt: new Date().toISOString(),
        notes: data.notes || undefined,
        result: data.disposition,
      };
      
      if (data.callbackDateTime && disp?.actionType === "callback") {
        updateData.callbackDate = data.callbackDateTime;
        updateData.status = "callback_scheduled";
        updateData.assignedTo = data.callbackAssignedTo || null;
      }
      
      const res = await apiRequest("PATCH", `/api/campaigns/${data.campaignId}/contacts/${data.contactId}`, updateData);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Chyba pri aktualizácii kontaktu");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", selectedCampaignId, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns/contact-counts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/callbacks"] });
    },
    onError: (error: Error) => {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    },
  });

  const handleDisposition = (value: string, parentCode?: string, callbackDateTime?: string, callbackAssignedTo?: string | null) => {
    const disp = campaignDispositions.find(d => d.code === value)
      || campaignDispositions.find(d => d.code === parentCode);

    const assignLabel = callbackAssignedTo ? "osobný" : "pre všetkých";
    setTimeline((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}`,
        type: "system",
        timestamp: new Date(),
        content: `Výsledok: ${disp?.name || value}`,
        details: `Kontakt ukončený - ${disp?.name || value}${callbackDateTime ? ` (callback ${assignLabel}: ${callbackDateTime})` : ""}`,
      },
    ]);

    if (currentCampaignContactId && selectedCampaignId) {
      dispositionMutation.mutate({
        contactId: currentCampaignContactId,
        campaignId: selectedCampaignId,
        disposition: value,
        notes: callNotes,
        callbackDateTime,
        parentCode,
        callbackAssignedTo,
      });
    }

    toast({
      title: "Kontakt ukončený",
      description: `Výsledok: ${disp?.name || value}`,
    });

    setAgentStatus("wrap_up");

    if (activeTaskId) {
      setTasks((prev) => prev.filter((t) => t.id !== activeTaskId));
      setActiveTaskId(null);
    }

    setCurrentContact(null);
    setCurrentCampaignContactId(null);
    setCallNotes("");
    setTimeline([]);
    setActiveChannel("phone");

    setTimeout(() => {
      setAgentStatus("available");
    }, 3000);
  };

  const sendEmailMutation = useMutation({
    mutationFn: async (data: { to: string; subject: string; body: string; attachments?: { name: string; contentBase64: string; contentType: string }[]; customerId?: string }) => {
      const res = await apiRequest("POST", "/api/ms365/send-email-from-mailbox", {
        to: data.to,
        subject: data.subject,
        body: data.body,
        isHtml: true,
        attachments: data.attachments,
        customerId: data.customerId,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Chyba pri odosielaní emailu");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      toast({
        title: "Email odoslaný",
        description: `Email bol úspešne odoslaný na ${currentContact?.email}`,
      });
      setStats((prev) => ({ ...prev, emails: prev.emails + 1 }));
      setTimeline((prev) => [
        ...prev,
        {
          id: `email-${Date.now()}`,
          type: "email",
          direction: "outbound",
          timestamp: new Date(),
          content: variables.subject,
          details: variables.body.substring(0, 100),
        },
      ]);
      if (variables.customerId) {
        queryClient.invalidateQueries({ queryKey: ["/api/customers", variables.customerId, "messages"] });
        queryClient.invalidateQueries({ queryKey: ["/api/customers", variables.customerId, "activity-logs"] });
      }
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
    mutationFn: async (data: { number: string; text: string; customerId?: string }) => {
      const res = await apiRequest("POST", "/api/bulkgate/send", {
        number: data.number,
        text: data.text,
        country: currentContact?.country || "SK",
        customerId: data.customerId,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Chyba pri odosielaní SMS");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      toast({
        title: "SMS odoslaná",
        description: `SMS bola úspešne odoslaná na ${currentContact?.phone}`,
      });
      setStats((prev) => ({ ...prev, sms: prev.sms + 1 }));
      setTimeline((prev) => [
        ...prev,
        {
          id: `sms-${Date.now()}`,
          type: "sms",
          direction: "outbound",
          timestamp: new Date(),
          content: variables.text,
        },
      ]);
      if (variables.customerId) {
        queryClient.invalidateQueries({ queryKey: ["/api/customers", variables.customerId, "messages"] });
        queryClient.invalidateQueries({ queryKey: ["/api/customers", variables.customerId, "activity-logs"] });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Chyba",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateContactMutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      if (!currentContact) throw new Error("No contact");
      const serializedData = {
        ...data,
        dateOfBirth: data.dateOfBirth ? data.dateOfBirth.toISOString() : null,
      };
      return apiRequest("PATCH", `/api/customers/${currentContact.id}`, serializedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      if (currentContact?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/customers", currentContact.id] });
      }
      toast({ title: "Zákazník aktualizovaný" });
    },
    onError: () => {
      toast({ title: "Chyba pri aktualizácii zákazníka", variant: "destructive" });
    },
  });

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

  const handleToggleAutoMode = () => {
    if (!campaignAutoSettings.autoMode) {
      toast({ title: "Automatický režim", description: "Táto kampaň nemá povolený automatický režim. Nastavte ho v nastaveniach kampane.", variant: "destructive" });
      return;
    }
    setIsAutoMode(prev => !prev);
  };

  const handleStatusChange = async (newStatus: AgentStatus) => {
    try {
      if (agentSession.activeBreak) {
        await agentSession.endBreak();
      }
      await agentSession.updateStatus(newStatus);
      const STATUS_CONFIG = getStatusConfig(t);
      toast({
        title: STATUS_CONFIG[newStatus].label,
        description: `${STATUS_CONFIG[newStatus].label}`,
      });
    } catch (error) {
      toast({ title: t.agentSession.shiftError, description: t.agentSession.shiftStartError, variant: "destructive" });
    }
  };

  const handleStartBreak = async (breakTypeId: string) => {
    try {
      await agentSession.startBreak(breakTypeId);
      toast({ title: t.agentSession.statusBreak, description: t.agentSession.statusBreak });
    } catch (error) {
      toast({ title: t.agentSession.shiftError, description: t.agentSession.breakError, variant: "destructive" });
    }
  };

  const handleEndBreak = async () => {
    try {
      await agentSession.endBreak();
      toast({ title: t.agentSession.continueWork, description: t.agentSession.continueWork });
    } catch (error) {
      toast({ title: t.agentSession.shiftError, description: t.agentSession.breakEndError, variant: "destructive" });
    }
  };

  const handleStartSession = async () => {
    try {
      await agentSession.startSession(selectedCampaignId);
      setSessionLoginOpen(false);
      toast({ title: t.agentSession.shiftStarted, description: t.agentSession.shiftStartedDesc });
    } catch (error) {
      toast({ title: t.agentSession.shiftError, description: t.agentSession.shiftStartError, variant: "destructive" });
    }
  };

  const handleEndSession = async () => {
    try {
      await agentSession.endSession();
      setSidebarOpen(prevSidebarOpenRef.current);
      setSessionLoginOpen(true);
      setCurrentContact(null);
      setCurrentCampaignContactId(null);
      setTasks([]);
      setActiveTaskId(null);
      setTimeline([]);
      toast({ title: t.agentSession.shiftEnded, description: t.agentSession.shiftEndedDesc });
    } catch (error) {
      toast({ title: t.agentSession.shiftError, description: t.agentSession.shiftEndError, variant: "destructive" });
    }
  };

  const handleSendEmail = (data: { subject: string; body: string; attachments?: { name: string; contentBase64: string; contentType: string }[] }) => {
    if (!currentContact?.email) {
      toast({ title: "Chyba", description: "Kontakt nemá zadaný email", variant: "destructive" });
      return;
    }
    sendEmailMutation.mutate({
      to: currentContact.email,
      subject: data.subject,
      body: data.body,
      attachments: data.attachments,
      customerId: currentContact.id,
    });
  };

  const handleSendSms = (message: string) => {
    if (!currentContact?.phone) {
      toast({ title: "Chyba", description: "Kontakt nemá zadané telefónne číslo", variant: "destructive" });
      return;
    }
    sendSmsMutation.mutate({ number: currentContact.phone, text: message, customerId: currentContact.id });
  };

  const handleAddNote = (note: string) => {
    setCallNotes((prev) => prev + (prev ? "\n" : "") + note);
    setTimeline((prev) => [
      ...prev,
      {
        id: `note-${Date.now()}`,
        type: "note",
        timestamp: new Date(),
        content: note,
      },
    ]);
  };

  const loadContact = (customer: Customer) => {
    setCurrentContact(customer);
    agentSession.updateStatus("busy").catch(() => {});
    setCallNotes("");
    setActiveChannel("phone");
    setRightTab("actions");

    const campaignChannel = (selectedCampaign?.channel || "phone") as ChannelType;
    const newTask: TaskItem = {
      id: `task-${Date.now()}`,
      contact: customer,
      campaignId: selectedCampaignId!,
      campaignName: selectedCampaign?.name || "",
      campaignContactId: currentCampaignContactId,
      channel: campaignChannel,
      startedAt: new Date(),
      status: "active",
    };
    setTasks((prev) => [...prev, newTask]);
    setActiveTaskId(newTask.id);

    setTimeline([
      {
        id: `sys-start-${Date.now()}`,
        type: "system",
        timestamp: new Date(),
        content: `Konverzácia začatá s ${customer.firstName} ${customer.lastName}`,
        details: `Kampaň: ${selectedCampaign?.name || ""}`,
      },
    ]);
  };

  const handleNextContact = () => {
    if (sortedPendingContacts.length > 0) {
      const nextEnriched = sortedPendingContacts[0];
      if (nextEnriched.customer) {
        setCurrentCampaignContactId(nextEnriched.id);
        loadContact(nextEnriched.customer);
      }
    }
  };

  const handleSelectCampaignContact = (enrichedContact: EnrichedCampaignContact) => {
    if (enrichedContact.customer) {
      setCurrentCampaignContactId(enrichedContact.id);
      loadContact(enrichedContact.customer);
    }
  };

  const handleSelectTask = (task: TaskItem) => {
    setActiveTaskId(task.id);
    setCurrentContact(task.contact);
    setSelectedCampaignId(task.campaignId);
    setCurrentCampaignContactId(task.campaignContactId);
  };

  const handleMakeCall = (phoneNumber: string) => {
    if (makeCall && currentContact) {
      const customerName = `${currentContact.firstName || ""} ${currentContact.lastName || ""}`.trim();
      makeCall({
        phoneNumber,
        customerId: currentContact.id,
        customerName: customerName || undefined,
      });
      setStats((prev) => ({ ...prev, calls: prev.calls + 1 }));
      setTimeline((prev) => [
        ...prev,
        {
          id: `call-${Date.now()}`,
          type: "call",
          direction: "outbound",
          timestamp: new Date(),
          content: `Hovor na ${phoneNumber}`,
        },
      ]);
    }
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case "call":
        setActiveChannel("phone");
        if (currentContact?.phone && isSipRegistered) {
          handleMakeCall(currentContact.phone);
        }
        break;
      case "email":
        setActiveChannel("email");
        break;
      case "sms":
        setActiveChannel("sms");
        break;
      case "task":
        toast({
          title: "Úloha",
          description: "Vytvorenie úlohy - pripravuje sa",
        });
        break;
    }
  };

  const activeBreakName = agentSession.activeBreak
    ? agentSession.breakTypes.find(bt => bt.id === agentSession.activeBreak?.breakTypeId)?.name || t.agentSession.statusBreak
    : null;

  return (
    <div className={`flex flex-col ${agentSession.isSessionActive ? "h-[calc(100vh-3.5rem)]" : "h-[calc(100vh-8rem)] -m-6"}`}>
      <Dialog open={sessionLoginOpen && !agentSession.isSessionActive} onOpenChange={(open) => { if (!open) { setSessionLoginOpen(false); setLocation("/"); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Headphones className="h-5 w-5" />
              {t.agentSession.shiftLogin}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              {t.agentSession.shiftLoginDesc}
            </p>
            <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
              <Avatar className="h-10 w-10">
                {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={`${user.firstName} ${user.lastName}`} />}
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-muted-foreground">{user?.role === "admin" ? t.agentSession.administrator : t.agentSession.operator}</p>
              </div>
            </div>
            <Button
              className="w-full gap-2"
              onClick={handleStartSession}
              data-testid="button-start-session"
            >
              <Play className="h-4 w-4" />
              {t.agentSession.startShift}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <TopBar
        status={agentSession.status}
        onStatusChange={handleStatusChange}
        stats={stats}
        workTime={agentSession.workTime}
        breakTypes={agentSession.breakTypes}
        activeBreakName={activeBreakName}
        breakTime={agentSession.breakTime}
        onStartBreak={handleStartBreak}
        onEndBreak={handleEndBreak}
        isOnBreak={!!agentSession.activeBreak}
        onEndSession={handleEndSession}
        isSessionActive={agentSession.isSessionActive}
        t={t}
      />

      <div className="flex flex-1 overflow-hidden">
        <TaskListPanel
          tasks={tasks}
          activeTaskId={activeTaskId}
          onSelectTask={handleSelectTask}
          campaigns={activeCampaigns}
          selectedCampaignId={selectedCampaignId}
          onSelectCampaign={setSelectedCampaignId}
          showOnlyAssigned={showOnlyAssigned}
          onToggleAssigned={setShowOnlyAssigned}
          channelFilter={channelFilter}
          onChannelFilterChange={setChannelFilter}
          onLoadNextContact={handleNextContact}
          isLoadingContact={false}
          campaignContacts={sortedPendingContacts}
          onSelectCampaignContact={handleSelectCampaignContact}
          currentUserId={user?.id}
          isAutoMode={isAutoMode}
          onToggleAutoMode={handleToggleAutoMode}
          autoCountdown={autoCountdown}
          onOpenContactsModal={() => { setModalFilter("all"); setModalSearch(""); setContactsModalOpen(true); }}
          onOpenTasksModal={() => setTasksModalOpen(true)}
        />

        <CommunicationCanvas
          contact={currentContact}
          campaign={selectedCampaign}
          activeChannel={activeChannel}
          onChannelChange={setActiveChannel}
          timeline={timeline}
          onSendEmail={handleSendEmail}
          onSendSms={handleSendSms}
          isSendingEmail={sendEmailMutation.isPending}
          isSendingSms={sendSmsMutation.isPending}
          onMakeCall={handleMakeCall}
          isSipRegistered={isSipRegistered}
          onOpenScriptModal={() => setScriptModalOpen(true)}
          onUpdateContact={(data) => updateContactMutation.mutate(data)}
          isUpdatingContact={updateContactMutation.isPending}
        />

        <CustomerInfoPanel
          contact={currentContact}
          campaign={selectedCampaign}
          callNotes={callNotes}
          onAddNote={handleAddNote}
          onDisposition={handleDisposition}
          onQuickAction={handleQuickAction}
          rightTab={rightTab}
          onRightTabChange={setRightTab}
          contactHistory={contactHistory}
          dispositions={campaignDispositions}
          currentUserId={user?.id}
          onOpenDispositionModal={() => setDispositionModalOpen(true)}
        />
      </div>

      <Dialog open={contactsModalOpen} onOpenChange={setContactsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Kontakty kampane
              {selectedCampaign && (
                <Badge variant="secondary" className="ml-2">{selectedCampaign.name}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-2 pb-3 border-b">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Hľadať meno, telefón, email..."
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
                className="h-9 text-sm"
                data-testid="input-modal-search"
              />
            </div>
            <Select value={modalFilter} onValueChange={(v) => setModalFilter(v as typeof modalFilter)}>
              <SelectTrigger className="w-[180px] h-9 text-xs" data-testid="select-modal-filter">
                <Filter className="h-3 w-3 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všetky kontakty</SelectItem>
                <SelectItem value="my_callbacks">Moje preplánované</SelectItem>
                <SelectItem value="team_callbacks">Tímové preplánované</SelectItem>
                <SelectItem value="due">Splatné teraz</SelectItem>
                <SelectItem value="pending">Čakajúce (nové)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={modalSort} onValueChange={(v) => setModalSort(v as typeof modalSort)}>
              <SelectTrigger className="w-[170px] h-9 text-xs" data-testid="select-modal-sort">
                <ArrowUpDown className="h-3 w-3 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="callback_asc">Callback (najskôr)</SelectItem>
                <SelectItem value="name_asc">Meno (A-Z)</SelectItem>
                <SelectItem value="attempts_desc">Pokusov (najviac)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="flex-1 -mx-6 px-6">
            {(() => {
              const now = new Date();
              let filtered = sortedPendingContacts.filter(cc => {
                const cust = cc.customer;
                if (!cust) return false;
                if (modalSearch) {
                  const q = modalSearch.toLowerCase();
                  const match = [cust.firstName, cust.lastName, cust.phone, cust.email]
                    .filter(Boolean).join(" ").toLowerCase().includes(q);
                  if (!match) return false;
                }
                const isCallback = cc.status === "callback_scheduled";
                const isDue = cc.callbackDate && new Date(cc.callbackDate) <= now;
                const isMine = cc.assignedTo === user?.id;
                const isTeam = !cc.assignedTo;
                switch (modalFilter) {
                  case "my_callbacks": return isCallback && isMine;
                  case "team_callbacks": return isCallback && isTeam;
                  case "due": return isCallback && isDue;
                  case "pending": return cc.status === "pending";
                  default: return true;
                }
              });

              filtered = [...filtered].sort((a, b) => {
                switch (modalSort) {
                  case "callback_asc": {
                    const aDate = a.callbackDate ? new Date(a.callbackDate).getTime() : Infinity;
                    const bDate = b.callbackDate ? new Date(b.callbackDate).getTime() : Infinity;
                    return aDate - bDate;
                  }
                  case "name_asc": {
                    const aName = `${a.customer?.firstName || ""} ${a.customer?.lastName || ""}`.trim();
                    const bName = `${b.customer?.firstName || ""} ${b.customer?.lastName || ""}`.trim();
                    return aName.localeCompare(bName, "sk");
                  }
                  case "attempts_desc":
                    return (b.attemptCount || 0) - (a.attemptCount || 0);
                  default:
                    return 0;
                }
              });

              if (filtered.length === 0) {
                return (
                  <div className="text-center py-12">
                    <Users className="h-10 w-10 mx-auto text-muted-foreground/20 mb-3" />
                    <p className="text-sm text-muted-foreground">Žiadne kontakty zodpovedajúce filtru</p>
                  </div>
                );
              }

              return (
                <div className="space-y-1 py-2">
                  <div className="text-xs text-muted-foreground px-1 pb-2">
                    {filtered.length} {filtered.length === 1 ? "kontakt" : filtered.length < 5 ? "kontakty" : "kontaktov"}
                  </div>
                  {filtered.map((cc) => {
                    const cust = cc.customer;
                    if (!cust) return null;
                    const isCallback = cc.status === "callback_scheduled";
                    const isDueCallback = isCallback && cc.callbackDate && new Date(cc.callbackDate) <= now;
                    const isMyCallback = isCallback && cc.assignedTo === user?.id;
                    const isTeamCallback = isCallback && !cc.assignedTo;
                    const callbackDateStr = cc.callbackDate ? format(new Date(cc.callbackDate), "dd.MM.yyyy HH:mm") : null;

                    let rowClass = "";
                    if (isDueCallback && isMyCallback) rowClass = "ring-1 ring-purple-400 dark:ring-purple-600 bg-purple-50/50 dark:bg-purple-950/20";
                    else if (isDueCallback && isTeamCallback) rowClass = "ring-1 ring-blue-400 dark:ring-blue-600 bg-blue-50/50 dark:bg-blue-950/20";
                    else if (isCallback) rowClass = "bg-muted/30";

                    return (
                      <div
                        key={cc.id}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer hover-elevate ${rowClass}`}
                        onClick={() => {
                          handleSelectCampaignContact(cc);
                          setContactsModalOpen(false);
                        }}
                        data-testid={`modal-contact-${cc.id}`}
                      >
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarFallback className={`text-xs ${isDueCallback && isMyCallback ? "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300" : isDueCallback ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300" : "bg-muted"}`}>
                            {cust.firstName?.[0]}{cust.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{cust.firstName} {cust.lastName}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {cust.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {cust.phone}
                              </span>
                            )}
                            {cust.email && (
                              <span className="flex items-center gap-1 truncate">
                                <Mail className="h-3 w-3 shrink-0" />
                                {cust.email}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isCallback && (
                            <Badge variant={isDueCallback ? "default" : "outline"} className={`text-[10px] ${isDueCallback && isMyCallback ? "bg-purple-500 text-white" : isDueCallback ? "bg-blue-500 text-white" : ""}`}>
                              {isDueCallback ? "Zavolať!" : isMyCallback ? "Môj CB" : isTeamCallback ? "Tím CB" : "CB"}
                            </Badge>
                          )}
                          {callbackDateStr && (
                            <span className={`text-[10px] ${isDueCallback ? (isMyCallback ? "text-purple-600 dark:text-purple-400" : "text-blue-600 dark:text-blue-400") + " font-medium" : "text-muted-foreground"}`}>
                              <Calendar className="h-3 w-3 inline mr-0.5" />
                              {callbackDateStr}
                            </span>
                          )}
                          {cc.attemptCount > 0 && (
                            <Badge variant="outline" className="text-[10px]">
                              {cc.attemptCount}x
                            </Badge>
                          )}
                          {cc.status === "pending" && (
                            <Badge variant="secondary" className="text-[10px]">Nový</Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={tasksModalOpen} onOpenChange={setTasksModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListTodo className="h-5 w-5 text-primary" />
              Aktívne úlohy
              <Badge variant="secondary" className="ml-2">{tasks.length}</Badge>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 -mx-6 px-6">
            {tasks.length === 0 ? (
              <div className="text-center py-12">
                <ListTodo className="h-10 w-10 mx-auto text-muted-foreground/20 mb-3" />
                <p className="text-sm text-muted-foreground">Žiadne aktívne úlohy</p>
              </div>
            ) : (
              <div className="space-y-1 py-2">
                {tasks.map((task) => {
                  const chConfig = CHANNEL_CONFIG[task.channel];
                  const ChIcon = chConfig.icon;
                  const isActive = activeTaskId === task.id;
                  const elapsed = Math.floor((Date.now() - task.startedAt.getTime()) / 1000);
                  const mins = Math.floor(elapsed / 60);
                  const secs = elapsed % 60;
                  return (
                    <div
                      key={task.id}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer hover-elevate ${isActive ? "ring-1 ring-primary bg-primary/5" : ""}`}
                      onClick={() => { handleSelectTask(task); setTasksModalOpen(false); }}
                      data-testid={`modal-task-${task.id}`}
                    >
                      <div className="relative shrink-0">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="text-xs bg-muted">
                            {task.contact.firstName?.[0]}{task.contact.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full ${chConfig.bg} flex items-center justify-center`}>
                          <ChIcon className="h-2.5 w-2.5 text-white" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{task.contact.firstName} {task.contact.lastName}</p>
                        <p className="text-xs text-muted-foreground">{task.campaignName}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-[10px] font-mono">{mins}:{secs.toString().padStart(2, "0")}</Badge>
                        {task.status === "active" && <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={dispositionModalOpen} onOpenChange={(open) => { setDispositionModalOpen(open); if (!open) { setModalSelectedParent(null); setModalCallbackDate(""); setModalCallbackTime("09:00"); setModalCallbackAssign("me"); } }}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              {modalSelectedParent ? "Podkategória" : "Výsledok kontaktu"}
              {currentContact && (
                <Badge variant="secondary" className="ml-2">{currentContact.firstName} {currentContact.lastName}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="py-4 space-y-3">
              {campaignDispositions.length === 0 ? (
                <div className="text-center py-12">
                  <Target className="h-10 w-10 mx-auto text-muted-foreground/20 mb-3" />
                  <p className="text-sm text-muted-foreground">Žiadne výsledky kontaktu definované</p>
                </div>
              ) : modalSelectedParent ? (() => {
                const parent = campaignDispositions.find(d => d.id === modalSelectedParent);
                const children = campaignDispositions.filter(d => d.parentId === modalSelectedParent && d.isActive);
                const cbAssignTo = modalCallbackAssign === "me" && user?.id ? user.id : null;

                return (
                  <div className="space-y-3">
                    <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => { setModalSelectedParent(null); setModalCallbackDate(""); setModalCallbackTime("09:00"); }} data-testid="btn-modal-disposition-back">
                      <ChevronLeft className="h-3 w-3" />
                      Späť
                    </Button>
                    {parent?.actionType === "callback" && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground">Dátum</label>
                            <Input type="date" value={modalCallbackDate} onChange={(e) => setModalCallbackDate(e.target.value)} min={new Date().toISOString().split("T")[0]} data-testid="input-modal-callback-date" />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Čas</label>
                            <Input type="time" value={modalCallbackTime} onChange={(e) => setModalCallbackTime(e.target.value)} data-testid="input-modal-callback-time" />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Priradiť komu</label>
                          <div className="flex gap-2 mt-1">
                            <Button size="sm" variant={modalCallbackAssign === "me" ? "default" : "outline"} className="flex-1 gap-1 text-xs" onClick={() => setModalCallbackAssign("me")} disabled={!user?.id} data-testid="btn-modal-cb-assign-me">
                              <User className="h-3 w-3" />
                              Mne
                            </Button>
                            <Button size="sm" variant={modalCallbackAssign === "all" ? "default" : "outline"} className="flex-1 gap-1 text-xs" onClick={() => setModalCallbackAssign("all")} data-testid="btn-modal-cb-assign-all">
                              <Users className="h-3 w-3" />
                              Všetkým
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                    {children.length > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        {children.map((child) => {
                          const IconComp = DISPOSITION_ICON_MAP[child.icon || ""] || CircleDot;
                          const colorClass = DISPOSITION_COLOR_MAP[child.color || "gray"] || DISPOSITION_COLOR_MAP.gray;
                          return (
                            <Button key={child.id} variant="outline" className={`gap-2 justify-start py-3 ${colorClass}`} onClick={() => { handleDisposition(child.code, parent?.code, parent?.actionType === "callback" && modalCallbackDate && modalCallbackTime ? `${modalCallbackDate}T${modalCallbackTime}` : undefined, parent?.actionType === "callback" ? cbAssignTo : undefined); setDispositionModalOpen(false); setModalSelectedParent(null); }} data-testid={`modal-disposition-${child.code}`}>
                              <IconComp className="h-4 w-4" />
                              <span className="text-sm font-medium">{child.name}</span>
                            </Button>
                          );
                        })}
                      </div>
                    )}
                    {parent?.actionType === "callback" && (
                      <Button className="w-full" disabled={!modalCallbackDate} onClick={() => { handleDisposition(parent!.code, undefined, modalCallbackDate && modalCallbackTime ? `${modalCallbackDate}T${modalCallbackTime}` : undefined, cbAssignTo); setDispositionModalOpen(false); setModalSelectedParent(null); }} data-testid="btn-modal-disposition-confirm-callback">
                        <CalendarPlus className="h-4 w-4 mr-1" />
                        Potvrdiť preplánovanie
                      </Button>
                    )}
                  </div>
                );
              })() : (
                <div className="grid grid-cols-2 gap-2">
                  {campaignDispositions.filter(d => !d.parentId && d.isActive).map((disp) => {
                    const IconComp = DISPOSITION_ICON_MAP[disp.icon || ""] || CircleDot;
                    const colorClass = DISPOSITION_COLOR_MAP[disp.color || "gray"] || DISPOSITION_COLOR_MAP.gray;
                    const children = campaignDispositions.filter(d => d.parentId === disp.id && d.isActive);
                    const hasChildren = children.length > 0;
                    const isCallback = disp.actionType === "callback";
                    return (
                      <Button key={disp.id} variant="outline" className={`gap-2 justify-start py-4 ${colorClass}`} onClick={() => {
                        if (hasChildren || isCallback) {
                          setModalSelectedParent(disp.id);
                          if (isCallback) {
                            const tomorrow = new Date();
                            tomorrow.setDate(tomorrow.getDate() + 1);
                            setModalCallbackDate(tomorrow.toISOString().split("T")[0]);
                          }
                        } else {
                          handleDisposition(disp.code);
                          setDispositionModalOpen(false);
                        }
                      }} data-testid={`modal-disposition-${disp.code}`}>
                        <IconComp className="h-5 w-5" />
                        <span className="text-sm font-medium flex-1 text-left">{disp.name}</span>
                        {(hasChildren || isCallback) && <ChevronRight className="h-4 w-4 opacity-50" />}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={scriptModalOpen} onOpenChange={setScriptModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Scenár kampane
              {selectedCampaign && (
                <Badge variant="secondary" className="ml-2">{selectedCampaign.name}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 -mx-6 px-6">
            <div className="h-full max-h-[65vh]">
              <ScriptViewer script={selectedCampaign?.script || null} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
