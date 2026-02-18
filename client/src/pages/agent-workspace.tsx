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
  ListChecks,
  Pencil,
  UserCircle,
  Mic,
  MicOff,
  LogOut,
  Grid3X3,
  CalendarClock,
  PhoneForwarded,
  MailPlus,
  MessageSquarePlus,
  RotateCcw,
  Trash2,
  AlertTriangle,
  ExternalLink,
  Inbox,
  Reply,
  Forward,
  Search,
  HelpCircle,
  BookOpen,
  ChevronUp,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSip } from "@/contexts/sip-context";
import { useCall } from "@/contexts/call-context";
import { format } from "date-fns";
import { sk } from "date-fns/locale";
import { useAgentSession } from "@/contexts/agent-session-context";
import { CustomerDetailsContent } from "@/pages/customers";
import { StatusBadge } from "@/components/status-badge";
import { CustomerForm, type CustomerFormData } from "@/components/customer-form";
import type { Campaign, Customer, CampaignContact, CampaignDisposition, AgentBreakType } from "@shared/schema";
import { DISPOSITION_NAME_TRANSLATIONS } from "@shared/schema";

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
  type: "call" | "email" | "sms" | "disposition";
  direction?: "inbound" | "outbound";
  date: string;
  duration?: number;
  status?: string;
  statusCode?: string;
  notes?: string;
  agentName?: string;
  agentId?: string;
  content?: string;
  details?: string;
  campaignName?: string;
  campaignId?: string;
  action?: string;
  previousStatus?: string;
  newStatus?: string;
  htmlBody?: string;
  fullContent?: string;
  recipientEmail?: string;
  recipientPhone?: string;
}

interface TimelineEntry {
  id: string;
  type: "call" | "email" | "sms" | "note" | "system";
  direction?: "inbound" | "outbound";
  timestamp: Date;
  content: string;
  details?: string;
  status?: string;
  htmlBody?: string;
  fullContent?: string;
  agentName?: string;
  recipientEmail?: string;
  recipientPhone?: string;
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
  label?: string;
  content?: string;
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string; nextStepId?: string }[];
}

interface ScriptStep {
  id: string;
  title: string;
  description?: string;
  elements: ScriptElement[];
  isEndStep?: boolean;
  nextStepId?: string;
}

interface ParsedScript {
  version: number;
  name?: string;
  description?: string;
  startStepId?: string;
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
  onOpenScheduledQueue,
  scheduledQueueCounts,
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
  onOpenScheduledQueue?: () => void;
  scheduledQueueCounts?: { total: number; overdue: number };
}) {
  const STATUS_CONFIG = getStatusConfig(t);
  const config = STATUS_CONFIG[status];

  return (
    <div className="shrink-0">
      {/* Row 1: Agent status bar */}
      <div className="h-12 border-b bg-card flex items-center justify-between px-4 gap-2">
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                data-testid="dropdown-agent-status"
              >
                <span className={`h-2 w-2 rounded-full ${config.color} ${status === "available" ? "animate-pulse" : ""}`} />
                {config.icon}
                <span className="font-medium text-xs">{config.label}</span>
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

          {isSessionActive && (
            <Button variant="outline" size="sm" onClick={onEndSession} data-testid="button-end-session" className="text-destructive border-destructive/30 gap-1">
              <LogOut className="h-3.5 w-3.5" />
              <span className="text-xs hidden xl:inline">{t.agentSession.endShift}</span>
            </Button>
          )}

          {isOnBreak && activeBreakName && (
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className="gap-1 text-yellow-700 dark:text-yellow-300" data-testid="badge-break-active">
                <Coffee className="h-3 w-3" />
                <span className="text-xs">{activeBreakName}</span>
                <span className="font-mono text-[10px]">{breakTime}</span>
              </Badge>
              <Button variant="outline" size="sm" onClick={onEndBreak} data-testid="button-end-break">
                <Play className="h-3 w-3 mr-1" />
                <span className="text-xs">{t.agentSession.continueWork}</span>
              </Button>
            </div>
          )}

          <Separator orientation="vertical" className="h-6 mx-1" />

          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted/50">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="font-mono text-[11px] font-semibold" data-testid="text-work-time">{workTime}</span>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1 text-xs" data-testid="stat-calls">
              <Phone className="h-3 w-3 text-blue-500" />
              <span className="font-bold text-blue-600 dark:text-blue-400">{stats.calls}</span>
            </div>
            <div className="flex items-center gap-1 text-xs" data-testid="stat-emails">
              <Mail className="h-3 w-3 text-green-500" />
              <span className="font-bold text-green-600 dark:text-green-400">{stats.emails}</span>
            </div>
            <div className="flex items-center gap-1 text-xs" data-testid="stat-sms">
              <MessageSquare className="h-3 w-3 text-orange-500" />
              <span className="font-bold text-orange-600 dark:text-orange-400">{stats.sms}</span>
            </div>
          </div>

          {onOpenScheduledQueue && (
            <>
              <Separator orientation="vertical" className="h-6 mx-1" />
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenScheduledQueue}
                className="gap-1.5 relative"
                data-testid="btn-open-scheduled-queue"
              >
                <CalendarClock className="h-3.5 w-3.5" />
                <span className="text-xs hidden xl:inline">Fronta</span>
                {scheduledQueueCounts && scheduledQueueCounts.total > 0 && (
                  <Badge
                    variant={scheduledQueueCounts.overdue > 0 ? "destructive" : "secondary"}
                    className="text-[9px] h-4 min-w-[16px] px-1 ml-0.5"
                    data-testid="badge-scheduled-total"
                  >
                    {scheduledQueueCounts.total}
                  </Badge>
                )}
                {scheduledQueueCounts && scheduledQueueCounts.overdue > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive" />
                  </span>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

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
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(new Set([0]));
  const [stepHistory, setStepHistory] = useState<number[]>([0]);

  useEffect(() => {
    setVisitedSteps(prev => {
      const next = new Set(prev);
      next.add(currentStepIndex);
      return next;
    });
  }, [currentStepIndex]);

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
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 p-6">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Scenár
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(100%-2rem)]">
                <div className="space-y-1.5">
                  {lines.map((line, i) => (
                    <p key={i} className="text-sm leading-relaxed text-foreground">{line || "\u00A0"}</p>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
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

  const stepIdToIndex: Record<string, number> = {};
  parsedScript.steps.forEach((s, i) => { stepIdToIndex[s.id] = i; });

  const hasIdBasedNav = parsedScript.steps.some(s => s.nextStepId || s.elements.some(el => el.options?.some(o => o.nextStepId)));

  const currentStep = parsedScript.steps[currentStepIndex];
  const totalSteps = parsedScript.steps.length;

  const handleValueChange = (elementId: string, value: string) => {
    setSelectedValues(prev => ({ ...prev, [elementId]: value }));
  };

  const navigateToStep = (idx: number) => {
    setStepHistory(prev => [...prev, idx]);
    setCurrentStepIndex(idx);
  };

  const handleStepClick = (idx: number) => {
    navigateToStep(idx);
  };

  const goBack = () => {
    if (stepHistory.length > 1) {
      const newHistory = [...stepHistory];
      newHistory.pop();
      const prevIdx = newHistory[newHistory.length - 1];
      setStepHistory(newHistory);
      setCurrentStepIndex(prevIdx);
    } else {
      setCurrentStepIndex(Math.max(0, currentStepIndex - 1));
    }
  };

  const goNext = () => {
    if (hasIdBasedNav) {
      for (const el of currentStep.elements) {
        if ((el.type === "radio" || el.type === "outcome") && el.options) {
          const selected = selectedValues[el.id];
          if (selected) {
            const opt = el.options.find(o => o.value === selected);
            if (opt?.nextStepId && stepIdToIndex[opt.nextStepId] !== undefined) {
              navigateToStep(stepIdToIndex[opt.nextStepId]);
              return;
            }
          }
        }
      }
      if (currentStep.nextStepId && stepIdToIndex[currentStep.nextStepId] !== undefined) {
        navigateToStep(stepIdToIndex[currentStep.nextStepId]);
        return;
      }
    }
    if (currentStepIndex < totalSteps - 1) {
      navigateToStep(currentStepIndex + 1);
    }
  };

  const renderElement = (element: ScriptElement) => {
    switch (element.type) {
      case "heading":
        return (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4">
              {element.label && <h4 className="font-semibold text-primary text-sm">{element.label}</h4>}
              {element.content && (
                <p className={`text-foreground text-sm leading-relaxed ${element.label ? "mt-1.5" : ""}`}>{element.content}</p>
              )}
            </CardContent>
          </Card>
        );

      case "paragraph":
        return (
          <Card className="bg-muted/30 border-border/50">
            <CardContent className="p-4">
              {element.label && (
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">{element.label}</label>
              )}
              <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{element.content || ""}</p>
            </CardContent>
          </Card>
        );

      case "text":
        return (
          <Card>
            <CardContent className="p-4">
              {element.label && (
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{element.label}</label>
              )}
              <p className={`text-sm leading-relaxed text-foreground ${element.label ? "mt-2" : ""}`}>{element.content || ""}</p>
            </CardContent>
          </Card>
        );

      case "select":
        if (!element.options) return null;
        return (
          <Card>
            <CardContent className="p-4 space-y-2">
              {element.label && (
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  {element.label}
                  {element.required && <span className="text-destructive">*</span>}
                </label>
              )}
              <Select
                value={selectedValues[element.id] || "_none"}
                onValueChange={(v) => handleValueChange(element.id, v)}
              >
                <SelectTrigger data-testid={`select-script-${element.id}`}>
                  <SelectValue placeholder={element.placeholder || "Vyberte možnosť"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">{element.placeholder || "Vyberte možnosť"}</SelectItem>
                  {element.options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        );

      case "radio":
        if (!element.options) return null;
        return (
          <Card>
            <CardContent className="p-4 space-y-3">
              {element.label && (
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  {element.label}
                  {element.required && <span className="text-destructive">*</span>}
                </label>
              )}
              <div className="space-y-2">
                {element.options.map((opt) => {
                  const isSelected = selectedValues[element.id] === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleValueChange(element.id, opt.value)}
                      className={`w-full text-left rounded-md p-3 flex items-center gap-3 border transition-colors ${
                        isSelected
                          ? "bg-primary/10 border-primary/40"
                          : "bg-card border-border/50 hover-elevate"
                      }`}
                      data-testid={`btn-script-radio-${opt.value}`}
                    >
                      <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                        isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"
                      }`}>
                        {isSelected && <div className="h-2 w-2 rounded-full bg-primary-foreground" />}
                      </div>
                      <span className={`text-sm ${isSelected ? "font-medium text-primary" : "text-foreground"}`}>{opt.label}</span>
                      {opt.nextStepId && isSelected && (
                        <ChevronRight className="h-4 w-4 ml-auto text-primary/60" />
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );

      case "outcome":
        if (!element.options) return null;
        return (
          <Card>
            <CardContent className="p-4 space-y-3">
              {element.label && (
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  {element.label}
                  {element.required && <span className="text-destructive">*</span>}
                </label>
              )}
              <div className="grid grid-cols-2 gap-2">
                {element.options.map((opt) => (
                  <Button
                    key={opt.value}
                    variant={selectedValues[element.id] === opt.value ? "default" : "outline"}
                    size="sm"
                    className="justify-start gap-2"
                    onClick={() => handleValueChange(element.id, opt.value)}
                    data-testid={`btn-script-outcome-${opt.value}`}
                  >
                    {selectedValues[element.id] === opt.value && <CheckCircle className="h-3.5 w-3.5" />}
                    {opt.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        );

      case "textarea":
        return (
          <Card>
            <CardContent className="p-4 space-y-2">
              {element.label && (
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  {element.label}
                  {element.required && <span className="text-destructive">*</span>}
                </label>
              )}
              <Textarea
                value={selectedValues[element.id] || ""}
                onChange={(e) => handleValueChange(element.id, e.target.value)}
                placeholder={element.placeholder || element.content || ""}
                className="min-h-[80px] resize-none text-sm"
                data-testid={`textarea-script-${element.id}`}
              />
            </CardContent>
          </Card>
        );

      case "checkbox":
        return (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  id={element.id}
                  checked={selectedValues[element.id] === "true"}
                  onCheckedChange={(checked) => handleValueChange(element.id, checked ? "true" : "false")}
                  data-testid={`checkbox-script-${element.id}`}
                />
                <Label htmlFor={element.id} className="text-sm cursor-pointer">{element.label}</Label>
              </div>
            </CardContent>
          </Card>
        );

      case "input":
        return (
          <Card>
            <CardContent className="p-4 space-y-2">
              {element.label && (
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  {element.label}
                  {element.required && <span className="text-destructive">*</span>}
                </label>
              )}
              <Input
                value={selectedValues[element.id] || ""}
                onChange={(e) => handleValueChange(element.id, e.target.value)}
                placeholder={element.placeholder || element.content || ""}
                data-testid={`input-script-${element.id}`}
              />
            </CardContent>
          </Card>
        );

      default:
        if (element.content || element.label) {
          return (
            <Card>
              <CardContent className="p-4">
                {element.label && (
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">{element.label}</label>
                )}
                {element.content && (
                  <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{element.content}</p>
                )}
              </CardContent>
            </Card>
          );
        }
        return null;
    }
  };

  return (
    <div className="flex flex-1 overflow-hidden relative">
      <div className="w-[25%] min-w-[180px] border-r flex flex-col bg-muted/20">
        <div className="p-3 border-b">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kroky</span>
            <Badge variant="secondary" className="text-[10px]" data-testid="badge-script-progress">
              {visitedSteps.size}/{totalSteps}
            </Badge>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {parsedScript.steps.map((step, idx) => (
              <button
                key={step.id}
                onClick={() => handleStepClick(idx)}
                className={`w-full text-left rounded-md p-2.5 transition-colors flex items-start gap-2.5 ${
                  idx === currentStepIndex
                    ? "bg-primary/10 border border-primary/30"
                    : "hover-elevate border border-transparent"
                }`}
                data-testid={`btn-script-step-${idx}`}
              >
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  idx === currentStepIndex
                    ? "bg-primary text-primary-foreground"
                    : visitedSteps.has(idx)
                    ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {visitedSteps.has(idx) && idx !== currentStepIndex ? (
                    <CheckCircle className="h-3.5 w-3.5" />
                  ) : (
                    idx + 1
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[11px] font-medium leading-tight truncate ${
                    idx === currentStepIndex ? "text-primary" : "text-foreground"
                  }`}>{step.title}</p>
                  {step.isEndStep && (
                    <Badge variant="secondary" className="text-[9px] mt-1 bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                      Koniec
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="w-[75%] flex flex-col">
        <div className="flex items-center justify-between px-4 py-2.5 border-b bg-card">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              {currentStepIndex + 1}
            </div>
            <span className="font-semibold text-sm truncate">{currentStep.title}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={goBack}
              disabled={currentStepIndex === 0 && stepHistory.length <= 1}
              data-testid="btn-script-prev"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={goNext}
              disabled={currentStepIndex === totalSteps - 1 && !currentStep.nextStepId}
              data-testid="btn-script-next"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-5 space-y-4">
            {currentStep.description && (
              <Card className="bg-muted/20 border-border/40">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground leading-relaxed italic">{currentStep.description}</p>
                </CardContent>
              </Card>
            )}
            {currentStep.elements.map((element) => (
              <div key={element.id}>
                {renderElement(element)}
              </div>
            ))}
          </div>
        </ScrollArea>

        {currentStep.isEndStep && (
          <div className="px-4 py-2.5 border-t bg-green-50 dark:bg-green-950/20 text-center">
            <div className="flex items-center justify-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                Toto je konečný krok scenára
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-3 right-3 z-10">
        <Badge variant="secondary" className="shadow-sm text-[10px] font-mono" data-testid="badge-script-floating-progress">
          {currentStepIndex + 1} / {totalSteps}
        </Badge>
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
  externalPhoneSubTab,
  callState,
  callDuration,
  ringDuration,
  hungUpBy,
  isMuted,
  isOnHold,
  volume,
  micVolume,
  onEndCall,
  onOpenDisposition,
  onToggleMute,
  onToggleHold,
  onSendDtmf,
  onVolumeChange,
  onMicVolumeChange,
  callerNumber,
  contactHistory,
  onOpenHistoryDetail,
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
  externalPhoneSubTab?: "card" | "details" | "history" | null;
  callState?: string;
  callDuration?: number;
  ringDuration?: number;
  hungUpBy?: "user" | "customer" | null;
  isMuted?: boolean;
  isOnHold?: boolean;
  volume?: number;
  micVolume?: number;
  onEndCall?: () => void;
  onOpenDisposition?: () => void;
  onToggleMute?: () => void;
  onToggleHold?: () => void;
  onSendDtmf?: (digit: string) => void;
  onVolumeChange?: (vol: number) => void;
  onMicVolumeChange?: (vol: number) => void;
  callerNumber?: string;
  contactHistory?: ContactHistory[];
  onOpenHistoryDetail?: (entry: TimelineEntry | ContactHistory) => void;
}) {
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [smsMessage, setSmsMessage] = useState("");
  const [emailAttachments, setEmailAttachments] = useState<File[]>([]);
  const [phoneSubTab, setPhoneSubTab] = useState<"card" | "details" | "history">(externalPhoneSubTab || "card");
  
  useEffect(() => {
    if (externalPhoneSubTab) {
      setPhoneSubTab(externalPhoneSubTab);
    }
  }, [externalPhoneSubTab]);

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

  const mergedHistory = useMemo(() => {
    const historyItems = (contactHistory || []);
    const timelineIds = new Set(timeline.map(t => t.id));
    const persistentAsTimeline: TimelineEntry[] = historyItems
      .filter(h => !timelineIds.has(h.id))
      .map(h => ({
        id: h.id,
        type: h.type === "disposition" ? "system" as const : h.type as TimelineEntry["type"],
        direction: h.direction,
        timestamp: new Date(h.date),
        content: h.content || h.notes || "",
        details: h.details || h.campaignName || "",
        status: h.status,
        htmlBody: h.htmlBody,
        fullContent: h.fullContent,
        agentName: h.agentName,
        recipientEmail: h.recipientEmail,
        recipientPhone: h.recipientPhone,
      }));
    const all = [...timeline, ...persistentAsTimeline];
    return {
      all: all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
      email: all.filter(e => e.type === "email").sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
      sms: all.filter(e => e.type === "sms").sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    };
  }, [timeline, contactHistory]);

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
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
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
        <StatusBadge status={(contact.status as any) || "pending"} className="text-[10px] h-5" />
        <Badge variant="outline" className="text-[10px] h-5">
          {contact.clientStatus === "acquired" ? "Acquired" : contact.clientStatus === "potential" ? "Prospect" : contact.clientStatus || "—"}
        </Badge>
      </div>

      {activeChannel === "script" && (
        <div className="flex flex-col flex-1 relative overflow-y-auto">
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
        <div className="flex-1 flex flex-col overflow-y-auto">
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
            <button
              className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium border-b-2 transition-colors ${
                phoneSubTab === "history"
                  ? "border-green-500 text-green-600 dark:text-green-400"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setPhoneSubTab("history")}
              data-testid="subtab-communication-history"
            >
              <History className="h-3 w-3" />
              História
            </button>
          </div>

          {(phoneSubTab === "card" || phoneSubTab === "details") && contact && contact.phone && isSipRegistered && onMakeCall && (
            <div className="border-b bg-muted/20 px-3 py-2 flex items-center gap-2 shrink-0" data-testid="phone-call-strip">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">{contact.phone}</span>
              {callState === "idle" || !callState ? (
                <Button
                  size="sm"
                  variant="default"
                  className="h-6 text-[10px] px-3 ml-auto bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => onMakeCall(contact.phone!)}
                  data-testid="btn-call-from-subtab"
                >
                  <Phone className="h-3 w-3 mr-1" />
                  Zavolať
                </Button>
              ) : callState === "connecting" || callState === "ringing" ? (
                <span className="text-[11px] text-yellow-600 dark:text-yellow-400 ml-auto flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                  {ringDuration ? `Vyzvánanie ${ringDuration}s` : "Pripájanie..."}
                </span>
              ) : callState === "active" || callState === "on_hold" ? (
                <span className="text-[11px] text-green-600 dark:text-green-400 ml-auto flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="font-mono tabular-nums">
                    {String(Math.floor((callDuration || 0) / 60)).padStart(2, "0")}:{String((callDuration || 0) % 60).padStart(2, "0")}
                  </span>
                  {callState === "on_hold" && <Badge variant="outline" className="text-[9px] h-4 px-1">HOLD</Badge>}
                </span>
              ) : callState === "ended" ? (
                <span className="text-[11px] text-red-500 ml-auto flex items-center gap-1.5 font-semibold">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  {hungUpBy === "customer" ? "Zákazník zavesil" : "Hovor ukončený"}
                </span>
              ) : null}
            </div>
          )}

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

          {phoneSubTab === "history" && contact && (
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-2">
                {mergedHistory.all.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p>Žiadna história komunikácie</p>
                  </div>
                ) : (
                  mergedHistory.all.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-start gap-3 p-2.5 rounded-md bg-muted/30 border border-border/50"
                        data-testid={`history-entry-${entry.id}`}
                      >
                        <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                          entry.type === "call" ? "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400" :
                          entry.type === "email" ? "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400" :
                          entry.type === "sms" ? "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400" :
                          entry.type === "note" ? "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400" :
                          "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                        }`}>
                          {entry.type === "call" && <PhoneCall className="h-3.5 w-3.5" />}
                          {entry.type === "email" && <Mail className="h-3.5 w-3.5" />}
                          {entry.type === "sms" && <MessageSquare className="h-3.5 w-3.5" />}
                          {entry.type === "note" && <FileText className="h-3.5 w-3.5" />}
                          {entry.type === "system" && <AlertCircle className="h-3.5 w-3.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-[10px] h-5 capitalize">
                              {entry.type === "call" ? "Hovor" : entry.type === "email" ? "Email" : entry.type === "sms" ? "SMS" : entry.type === "note" ? "Poznámka" : "Systém"}
                            </Badge>
                            {entry.direction && (
                              <Badge variant="secondary" className="text-[10px] h-5">
                                {entry.direction === "inbound" ? "Prichádzajúci" : "Odchádzajúci"}
                              </Badge>
                            )}
                            {entry.status && (
                              <Badge variant="secondary" className="text-[10px] h-5">
                                {entry.status}
                              </Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                              {format(new Date(entry.timestamp), "d.M.yyyy HH:mm", { locale: sk })}
                            </span>
                          </div>
                          <p className="text-xs text-foreground mt-1 line-clamp-2">{entry.content}</p>
                          {entry.details && (
                            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{entry.details}</p>
                          )}
                        </div>
                      </div>
                    ))
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      )}

      {activeChannel === "email" && (
        <div className="flex-1 flex overflow-hidden">
          <div className="w-[25%] min-w-[220px] max-w-[320px] border-r flex flex-col bg-muted/10">
            <div className="p-3 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Inbox className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">História emailov</span>
                </div>
                {mergedHistory.email.length > 0 && (
                  <Badge variant="secondary" className="text-[9px] h-4">{mergedHistory.email.length}</Badge>
                )}
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {mergedHistory.email.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <Mail className="h-8 w-8 mx-auto mb-3 opacity-15" />
                    <p className="text-xs font-medium">Žiadne emaily</p>
                    <p className="text-[10px] mt-1 opacity-60">Odoslané emaily sa zobrazia tu</p>
                  </div>
                ) : mergedHistory.email.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-md p-2.5 bg-card border border-border/40 cursor-pointer hover-elevate transition-colors group"
                    data-testid={`email-history-${entry.id}`}
                    onClick={() => onOpenHistoryDetail?.(entry as any)}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        {entry.direction === "outbound" ? (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
                            <Send className="h-2.5 w-2.5 text-green-600 dark:text-green-400" />
                          </div>
                        ) : (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40">
                            <Inbox className="h-2.5 w-2.5 text-blue-600 dark:text-blue-400" />
                          </div>
                        )}
                        <Badge variant={entry.direction === "outbound" ? "secondary" : "outline"} className="text-[8px] h-4">
                          {entry.direction === "outbound" ? "Odoslaný" : "Prijatý"}
                        </Badge>
                      </div>
                      <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-[11px] font-semibold line-clamp-1 leading-tight mb-1">{entry.content}</p>
                    {entry.details && (
                      <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">{entry.details?.replace(/<[^>]*>/g, '')}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 pt-1.5 border-t border-border/30">
                      <Clock className="h-2.5 w-2.5 text-muted-foreground/60" />
                      <span className="text-[9px] text-muted-foreground/80">
                        {format(entry.timestamp, "d.M.yyyy HH:mm", { locale: sk })}
                      </span>
                      {entry.agentName && (
                        <>
                          <span className="text-[9px] text-muted-foreground/40">|</span>
                          <UserCircle className="h-2.5 w-2.5 text-muted-foreground/60" />
                          <span className="text-[9px] text-muted-foreground/80 truncate">{entry.agentName}</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 flex flex-col p-4 space-y-3 overflow-y-auto">
              <div className="flex items-center gap-2 mb-1">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Nový email</span>
                {contact?.email && (
                  <Badge variant="secondary" className="text-[10px]">{contact.email}</Badge>
                )}
              </div>
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
              <div className="border rounded-md overflow-visible flex-1 flex flex-col">
                <div className="flex items-center gap-0.5 p-1.5 border-b bg-muted/30 flex-wrap">
                  <Button size="icon" variant="ghost" onClick={() => execFormat("bold")} data-testid="btn-format-bold" title="Tučné">
                    <Bold className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => execFormat("italic")} data-testid="btn-format-italic" title="Kurzíva">
                    <Italic className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => execFormat("underline")} data-testid="btn-format-underline" title="Podčiarknuté">
                    <Underline className="h-3.5 w-3.5" />
                  </Button>
                  <Separator orientation="vertical" className="h-5 mx-1" />
                  <Button size="icon" variant="ghost" onClick={() => execFormat("insertUnorderedList")} data-testid="btn-format-ul" title="Odrážkový zoznam">
                    <List className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => execFormat("insertOrderedList")} data-testid="btn-format-ol" title="Číslovaný zoznam">
                    <ListOrdered className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div
                  ref={editorRef}
                  contentEditable={!isSendingEmail}
                  className="flex-1 min-h-[180px] overflow-y-auto p-3 text-sm focus:outline-none"
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
            </div>
            <div className="border-t p-3 bg-card flex items-center justify-between gap-2">
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
      )}

      {activeChannel === "sms" && (
        <div className="flex-1 flex overflow-hidden">
          <div className="w-[25%] min-w-[220px] max-w-[320px] border-r flex flex-col bg-muted/10">
            <div className="p-3 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">História SMS</span>
                </div>
                {mergedHistory.sms.length > 0 && (
                  <Badge variant="secondary" className="text-[9px] h-4">{mergedHistory.sms.length}</Badge>
                )}
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {mergedHistory.sms.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-3 opacity-15" />
                    <p className="text-xs font-medium">Žiadne SMS</p>
                    <p className="text-[10px] mt-1 opacity-60">Odoslané SMS sa zobrazia tu</p>
                  </div>
                ) : mergedHistory.sms.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-md p-2.5 bg-card border border-border/40 cursor-pointer hover-elevate transition-colors group"
                    data-testid={`sms-history-${entry.id}`}
                    onClick={() => onOpenHistoryDetail?.(entry as any)}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        {entry.direction === "outbound" ? (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/40">
                            <Send className="h-2.5 w-2.5 text-orange-600 dark:text-orange-400" />
                          </div>
                        ) : (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40">
                            <Inbox className="h-2.5 w-2.5 text-blue-600 dark:text-blue-400" />
                          </div>
                        )}
                        <Badge variant={entry.direction === "outbound" ? "secondary" : "outline"} className="text-[8px] h-4">
                          {entry.direction === "outbound" ? "Odoslaná" : "Prijatá"}
                        </Badge>
                      </div>
                      <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-[11px] line-clamp-2 leading-relaxed">{entry.content || entry.fullContent}</p>
                    <div className="flex items-center gap-2 mt-2 pt-1.5 border-t border-border/30">
                      <Clock className="h-2.5 w-2.5 text-muted-foreground/60" />
                      <span className="text-[9px] text-muted-foreground/80">
                        {format(entry.timestamp, "d.M.yyyy HH:mm", { locale: sk })}
                      </span>
                      {entry.agentName && (
                        <>
                          <span className="text-[9px] text-muted-foreground/40">|</span>
                          <UserCircle className="h-2.5 w-2.5 text-muted-foreground/60" />
                          <span className="text-[9px] text-muted-foreground/80 truncate">{entry.agentName}</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 flex flex-col p-4 overflow-y-auto">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Nová SMS</span>
                {contact?.phone && (
                  <Badge variant="secondary" className="text-[10px]">{contact.phone}</Badge>
                )}
              </div>
            </div>
            <div className="border-t p-3 bg-card">
              <div className="flex gap-2">
                <div className="flex-1 space-y-1">
                  <Textarea
                    placeholder="Text SMS správy..."
                    value={smsMessage}
                    onChange={(e) => setSmsMessage(e.target.value)}
                    disabled={isSendingSms}
                    rows={3}
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
                  className="self-end mb-5"
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
  callState,
  callDuration,
  ringDuration,
  hungUpBy,
  onEndCall,
  onOpenDispositionFromCall,
  isMuted,
  isOnHold,
  volume,
  micVolume,
  onToggleMute,
  onToggleHold,
  onSendDtmf,
  onVolumeChange,
  onMicVolumeChange,
  callerNumber,
  onEditCustomer,
  onViewCustomer,
  onOpenHistoryDetail,
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
  callState: string;
  callDuration: number;
  ringDuration: number;
  hungUpBy: "user" | "customer" | null;
  onEndCall: () => void;
  onOpenDispositionFromCall: () => void;
  isMuted: boolean;
  isOnHold: boolean;
  volume: number;
  micVolume: number;
  onToggleMute: () => void;
  onToggleHold: () => void;
  onSendDtmf: (digit: string) => void;
  onVolumeChange: (vol: number) => void;
  onMicVolumeChange: (vol: number) => void;
  callerNumber: string;
  onEditCustomer: () => void;
  onViewCustomer: () => void;
  onOpenHistoryDetail?: (entry: ContactHistory) => void;
}) {
  const { t, locale } = useI18n();
  const [newNote, setNewNote] = useState("");
  const [showDialpad, setShowDialpad] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [historyTypeFilter, setHistoryTypeFilter] = useState("all");
  const [faqExpandedId, setFaqExpandedId] = useState<string | null>(null);
  const [faqSearchQuery, setFaqSearchQuery] = useState("");
  const [historyMaximized, setHistoryMaximized] = useState(false);
  const [faqMaximized, setFaqMaximized] = useState(false);
  const fmtTime = (sec: number) => `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}`;
  const dialPadButtons = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];
  const hasCall = callState === "connecting" || callState === "ringing" || callState === "active" || callState === "on_hold" || (callState === "ended" && hungUpBy);

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
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <h2 className="font-bold text-sm truncate flex-1" data-testid="text-contact-name">
                {contact.firstName} {contact.lastName}
              </h2>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                onClick={onEditCustomer}
                title="Upraviť zákazníka"
                data-testid="button-edit-customer"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                onClick={onViewCustomer}
                title="Detail zákazníka"
                data-testid="button-view-customer"
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
            </div>
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

      {hasCall && (
        <div className={`border-b px-3 py-2 space-y-2 ${
          (callState === "connecting" || callState === "ringing")
            ? "bg-green-50 dark:bg-green-950/30"
            : (callState === "active" || callState === "on_hold")
              ? "bg-blue-50 dark:bg-blue-950/30"
              : hungUpBy === "customer"
                ? "bg-red-50 dark:bg-red-950/30"
                : "bg-orange-50 dark:bg-orange-950/30"
        }`} data-testid="call-controls-card">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                (callState === "connecting" || callState === "ringing") ? "bg-green-500 animate-pulse" :
                (callState === "active") ? "bg-blue-500 animate-pulse" :
                (callState === "on_hold") ? "bg-orange-500" :
                "bg-red-500"
              }`} />
              <span className="text-xs font-semibold truncate">
                {(callState === "connecting") ? "Pripájanie..." :
                 (callState === "ringing") ? "Zvoní..." :
                 (callState === "on_hold") ? "Podržané" :
                 (callState === "ended" && hungUpBy === "customer") ? "Zákazník položil" :
                 (callState === "ended") ? "Hovor ukončený" :
                 "Aktívny hovor"}
              </span>
            </div>
            <span className="font-mono text-sm font-bold tabular-nums shrink-0">
              {(callState === "active" || callState === "on_hold") ? fmtTime(callDuration) :
               (callState === "connecting" || callState === "ringing") ? fmtTime(ringDuration) : ""}
            </span>
          </div>

          {callerNumber && (
            <div className="text-[11px] text-muted-foreground font-mono">{callerNumber}</div>
          )}

          {(callState === "active" || callState === "on_hold") && (
            <div className="flex items-center gap-1 flex-wrap">
              <Button
                size="icon"
                variant={isMuted ? "destructive" : "outline"}
                onClick={onToggleMute}
                data-testid="button-card-mute"
                title={isMuted ? "Zapnúť mikrofón" : "Stlmiť"}
              >
                {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>

              <Button
                size="icon"
                variant={isOnHold ? "secondary" : "outline"}
                onClick={onToggleHold}
                data-testid="button-card-hold"
                title={isOnHold ? "Obnoviť" : "Podržať"}
              >
                {isOnHold ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </Button>

              <Popover open={showDialpad} onOpenChange={setShowDialpad}>
                <PopoverTrigger asChild>
                  <Button size="icon" variant="outline" data-testid="button-card-dialpad" title="Klávesnica">
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2" align="center" side="left">
                  <div className="grid grid-cols-3 gap-1">
                    {dialPadButtons.map((digit) => (
                      <Button
                        key={digit}
                        variant="outline"
                        size="sm"
                        className="h-9 text-sm font-semibold"
                        onClick={() => onSendDtmf(digit)}
                        data-testid={`button-card-dtmf-${digit}`}
                      >
                        {digit}
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              <Popover open={showVolume} onOpenChange={setShowVolume}>
                <PopoverTrigger asChild>
                  <Button size="icon" variant="outline" data-testid="button-card-volume" title="Hlasitosť">
                    <Volume2 className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-3 space-y-3" align="center" side="left">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><Volume2 className="h-3 w-3" /> Reproduktor</span>
                      <span className="text-xs font-mono">{volume}%</span>
                    </div>
                    <Slider value={[volume]} onValueChange={([v]) => onVolumeChange(v)} max={100} step={1} data-testid="slider-card-speaker" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><Mic className="h-3 w-3" /> Mikrofón</span>
                      <span className="text-xs font-mono">{micVolume}%</span>
                    </div>
                    <Slider value={[micVolume]} onValueChange={([v]) => onMicVolumeChange(v)} max={100} step={1} data-testid="slider-card-mic" />
                  </div>
                </PopoverContent>
              </Popover>

              <Button
                size="sm"
                variant="destructive"
                onClick={() => { onEndCall(); onOpenDispositionFromCall(); }}
                className="gap-1 ml-auto"
                data-testid="button-card-end-call"
              >
                <PhoneOff className="h-3.5 w-3.5" />
                <span className="text-xs">Ukončiť</span>
              </Button>
            </div>
          )}

          {(callState === "connecting" || callState === "ringing") && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => { onEndCall(); onOpenDispositionFromCall(); }}
              className="w-full gap-1.5"
              data-testid="button-card-cancel-call"
            >
              <PhoneOff className="h-3.5 w-3.5" />
              Ukončiť hovor
            </Button>
          )}

          {callState === "ended" && hungUpBy && (
            <Button
              size="sm"
              variant="default"
              onClick={onOpenDispositionFromCall}
              className="w-full gap-1.5"
              data-testid="button-card-disposition"
            >
              <FileText className="h-3.5 w-3.5" />
              Zadať dispozíciu
            </Button>
          )}
        </div>
      )}

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
          <button
            className={`flex-1 py-2 text-[10px] font-semibold uppercase tracking-wider border-b-2 transition-colors ${
              rightTab === "faq"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onRightTabChange("faq")}
            data-testid="tab-faq"
          >
            FAQ
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

        {rightTab === "history" && (() => {
          const [histSearchQuery, setHistSearchQuery] = [historySearchQuery, setHistorySearchQuery];
          const [histTypeFilter, setHistTypeFilter] = [historyTypeFilter, setHistoryTypeFilter];

          const typeLabels: Record<string, string> = { all: "Všetko", call: "Hovory", email: "Emaily", sms: "SMS", disposition: "Dispozície" };
          const typeCounts = contactHistory.reduce((acc, item) => {
            acc[item.type] = (acc[item.type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          const filteredHistory = contactHistory.filter((item) => {
            if (histTypeFilter !== "all" && item.type !== histTypeFilter) return false;
            if (histSearchQuery.trim()) {
              const q = histSearchQuery.toLowerCase();
              const searchable = [
                item.content,
                item.notes,
                item.details?.replace(/<[^>]*>/g, ''),
                item.agentName,
                item.campaignName,
                (item as any).recipientEmail,
                (item as any).recipientPhone,
                (item as any).fullContent,
                item.status,
              ].filter(Boolean).join(" ").toLowerCase();
              if (!searchable.includes(q)) return false;
            }
            return true;
          });

          const highlightMatch = (text: string | undefined | null) => {
            if (!text || !histSearchQuery.trim()) return text || "";
            const q = histSearchQuery.trim();
            const idx = text.toLowerCase().indexOf(q.toLowerCase());
            if (idx === -1) return text;
            return (
              <>{text.substring(0, idx)}<mark className="bg-yellow-200 dark:bg-yellow-800 text-foreground rounded-sm px-0.5">{text.substring(idx, idx + q.length)}</mark>{text.substring(idx + q.length)}</>
            );
          };

          const renderHistoryContent = (isModal: boolean) => (
            <>
              <div className={`${isModal ? "p-4" : "p-2"} space-y-2 border-b`}>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${isModal ? "h-4 w-4" : "h-3.5 w-3.5"} text-muted-foreground`} />
                    <Input
                      value={histSearchQuery}
                      onChange={(e) => setHistorySearchQuery(e.target.value)}
                      placeholder="Hľadať v histórii..."
                      className={`${isModal ? "pl-9 h-9 text-sm" : "pl-8 h-8 text-xs"}`}
                      data-testid={isModal ? "input-history-search-modal" : "input-history-search"}
                    />
                    {histSearchQuery && (
                      <button
                        onClick={() => setHistorySearchQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  {!isModal && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setHistoryMaximized(true)}
                      data-testid="btn-history-maximize"
                      title="Maximalizovať históriu"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <div className="flex gap-1 flex-wrap">
                {["all", "call", "email", "sms", "disposition"].map((t) => {
                  const count = t === "all" ? contactHistory.length : (typeCounts[t] || 0);
                  if (t !== "all" && count === 0) return null;
                  const isActive = histTypeFilter === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setHistoryTypeFilter(t)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md ${isModal ? "text-xs" : "text-[10px]"} font-medium transition-colors ${
                        isActive
                          ? "bg-primary/10 text-primary border border-primary/30"
                          : "bg-muted/40 text-muted-foreground border border-transparent hover-elevate"
                      }`}
                      data-testid={`btn-history-filter-${t}`}
                    >
                      {t === "call" && <Phone className={isModal ? "h-3 w-3" : "h-2.5 w-2.5"} />}
                      {t === "email" && <Mail className={isModal ? "h-3 w-3" : "h-2.5 w-2.5"} />}
                      {t === "sms" && <MessageSquare className={isModal ? "h-3 w-3" : "h-2.5 w-2.5"} />}
                      {t === "disposition" && <ListChecks className={isModal ? "h-3 w-3" : "h-2.5 w-2.5"} />}
                      {typeLabels[t]}
                      <span className={`${isModal ? "text-[10px]" : "text-[9px]"} ${isActive ? "text-primary" : "text-muted-foreground/70"}`}>({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={`flex-1 overflow-auto ${isModal ? "max-h-[65vh]" : ""}`}>
              {filteredHistory.length === 0 && (
                <div className="text-center py-8">
                  {contactHistory.length === 0 ? (
                    <>
                      <History className="h-8 w-8 mx-auto mb-2 text-muted-foreground/20" />
                      <p className={`${isModal ? "text-sm" : "text-xs"} text-muted-foreground`}>Žiadna história komunikácie</p>
                    </>
                  ) : (
                    <>
                      <Search className="h-8 w-8 mx-auto mb-2 text-muted-foreground/20" />
                      <p className={`${isModal ? "text-sm" : "text-xs"} text-muted-foreground`}>Žiadne výsledky pre "{histSearchQuery}"</p>
                    </>
                  )}
                </div>
              )}

              {filteredHistory.length > 0 && (
                <div className={`${isModal ? "p-4 space-y-2" : "p-2 space-y-1.5"}`}>
                  {filteredHistory.map((item) => {
                    const isClickable = item.type === "email" || item.type === "sms";
                    const plainDetails = item.details?.replace(/<[^>]*>/g, '') || "";
                    const isCall = item.type === "call";
                    const contentText = item.content || item.notes || "";

                    return (
                      <div
                        key={item.id}
                        className={`rounded-md border border-border/40 overflow-visible transition-colors ${isClickable ? "cursor-pointer hover-elevate group" : ""}`}
                        data-testid={`history-item-${item.id}`}
                        onClick={() => { if (isClickable && onOpenHistoryDetail) onOpenHistoryDetail(item); }}
                      >
                        <div className={`flex items-start gap-2 ${isModal ? "p-3" : "p-2"}`}>
                          <div className={`flex ${isModal ? "h-8 w-8" : "h-6 w-6"} shrink-0 items-center justify-center rounded-full mt-0.5 ${
                            item.type === "call" ? "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400" :
                            item.type === "email" ? "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400" :
                            item.type === "sms" ? "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400" :
                            "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400"
                          }`}>
                            {item.type === "call" && <Phone className={isModal ? "h-4 w-4" : "h-3 w-3"} />}
                            {item.type === "email" && <Mail className={isModal ? "h-4 w-4" : "h-3 w-3"} />}
                            {item.type === "sms" && <MessageSquare className={isModal ? "h-4 w-4" : "h-3 w-3"} />}
                            {item.type === "disposition" && <ListChecks className={isModal ? "h-4 w-4" : "h-3 w-3"} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {item.direction && (
                                <span className={`${isModal ? "text-xs" : "text-[9px]"} font-medium ${item.direction === "outbound" ? "text-green-600 dark:text-green-400" : "text-blue-600 dark:text-blue-400"}`}>
                                  {item.direction === "inbound" ? "Prijatý" : "Odoslaný"}
                                </span>
                              )}
                              {item.type === "disposition" && (
                                <span className={`${isModal ? "text-xs" : "text-[9px]"} font-medium text-purple-600 dark:text-purple-400`}>Dispozícia</span>
                              )}
                              {item.status && (
                                <Badge variant="secondary" className={`${isModal ? "text-[10px] h-5" : "text-[9px] h-4"} px-1`}>{item.status}</Badge>
                              )}
                              <span className={`${isModal ? "text-xs" : "text-[9px]"} text-muted-foreground/70 ml-auto`}>
                                {format(new Date(item.date), isModal ? "d. MMMM yyyy, HH:mm" : "d.M. HH:mm", { locale: sk })}
                              </span>
                            </div>
                            <p className={`${isModal ? "text-sm mt-1" : "text-[11px] mt-0.5"} text-foreground ${isModal ? "" : "line-clamp-2"} leading-snug`}>
                              {highlightMatch(contentText) || "—"}
                            </p>
                            {plainDetails && (
                              <p className={`${isModal ? "text-xs mt-1" : "text-[10px] mt-0.5"} text-muted-foreground ${isModal ? "line-clamp-3" : "line-clamp-1"} leading-snug`}>
                                {highlightMatch(plainDetails)}
                              </p>
                            )}
                          </div>
                          {isClickable && (
                            <ExternalLink className={`${isModal ? "h-4 w-4" : "h-3 w-3"} text-muted-foreground/40 shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity`} />
                          )}
                        </div>
                        <div className={`flex items-center gap-2 ${isModal ? "px-3 pb-2 text-xs" : "px-2 pb-1.5 text-[9px]"} text-muted-foreground/60 flex-wrap`}>
                          {item.agentName && (
                            <span className="flex items-center gap-0.5">
                              <UserCircle className={isModal ? "h-3 w-3" : "h-2.5 w-2.5"} />
                              {item.agentName}
                            </span>
                          )}
                          {item.campaignName && (
                            <span className={`truncate ${isModal ? "max-w-[200px]" : "max-w-[120px]"}`} title={item.campaignName}>
                              {item.campaignName}
                            </span>
                          )}
                          {isCall && item.details && (
                            <span>{highlightMatch(item.details)}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {filteredHistory.length > 0 && (
              <div className={`${isModal ? "px-4 py-2" : "px-3 py-1.5"} border-t bg-muted/20 text-center`}>
                <span className={`${isModal ? "text-xs" : "text-[10px]"} text-muted-foreground`}>
                  {filteredHistory.length} {filteredHistory.length === 1 ? "záznam" : filteredHistory.length < 5 ? "záznamy" : "záznamov"}
                  {histSearchQuery && ` pre "${histSearchQuery}"`}
                </span>
              </div>
            )}
            </>
          );

          return (
          <>
            <div className="flex flex-col h-full">
              {renderHistoryContent(false)}
            </div>

            <Dialog open={historyMaximized} onOpenChange={setHistoryMaximized}>
              <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0">
                <div className="flex items-center justify-between px-5 py-3 border-b">
                  <div className="flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    <h2 className="text-base font-semibold" data-testid="text-history-modal-title">História komunikácie</h2>
                    {contact && (
                      <Badge variant="outline" className="text-xs ml-2">
                        {contact.firstName} {contact.lastName}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                  {renderHistoryContent(true)}
                </div>
              </DialogContent>
            </Dialog>
          </>
          );
        })()}

        {rightTab === "faq" && (() => {
          const sampleFaqData: Record<string, Array<{ id: string; question: string; answer: string; category: string }>> = {
            en: [
              { id: "1", question: "What is cord blood?", answer: "Cord blood is the blood that remains in the umbilical cord and placenta after birth. It contains stem cells that can be used to treat various diseases.", category: "General" },
              { id: "2", question: "Is the collection painful?", answer: "No, cord blood collection is completely painless for both the mother and the baby. It is performed after birth and after the umbilical cord is cut.", category: "Collection" },
              { id: "3", question: "How long can it be stored?", answer: "Stem cells from cord blood can be stored in cryopreservation virtually indefinitely. Studies confirm viability even after 25+ years.", category: "Storage" },
              { id: "4", question: "What diseases can be treated?", answer: "Stem cells from cord blood are used to treat more than 80 diseases including leukemia, lymphomas, anemia, metabolic disorders and immunodeficiencies.", category: "Treatment" },
              { id: "5", question: "How much does it cost?", answer: "The price depends on the chosen service package. The basic package starts from 990€. For more detailed pricing information, see the current price list or contact our advisor.", category: "Pricing" },
              { id: "6", question: "When should I decide?", answer: "Ideally, you should decide before week 34 of pregnancy so we have time to prepare all necessary documents and the collection kit. In urgent cases, we can arrange faster processing.", category: "Process" },
              { id: "7", question: "What if I have a cesarean section?", answer: "Cord blood collection is also possible with a cesarean section. The procedure is equally safe and painless. Inform your maternity hospital and our coordinator.", category: "Collection" },
              { id: "8", question: "Is it compatible for siblings?", answer: "Yes, cord blood is more likely to be compatible between siblings (25% full match). For the child itself, the match is 100%. Storing for one child can help the entire family.", category: "Treatment" },
            ],
            sk: [
              { id: "1", question: "Čo je pupočníková krv?", answer: "Pupočníková krv je krv, ktorá zostáva v pupočníku a placente po pôrode. Obsahuje kmeňové bunky, ktoré môžu byť použité na liečbu rôznych ochorení.", category: "Všeobecné" },
              { id: "2", question: "Je odber bolestivý?", answer: "Nie, odber pupočníkovej krvi je úplne bezbolestný pre matku aj dieťa. Vykonáva sa až po pôrode a prestrihnutí pupočníka.", category: "Odber" },
              { id: "3", question: "Ako dlho sa dá uchovávať?", answer: "Kmeňové bunky z pupočníkovej krvi je možné uchovávať v kryokonzervácii prakticky neobmedzene dlho. Štúdie potvrdzujú životaschopnosť aj po 25+ rokoch.", category: "Uchovávanie" },
              { id: "4", question: "Aké ochorenia sa dajú liečiť?", answer: "Kmeňové bunky z pupočníkovej krvi sa používajú na liečbu viac ako 80 ochorení vrátane leukémie, lymfómov, anemie, metabolických porúch a imunodeficiencií.", category: "Liečba" },
              { id: "5", question: "Koľko to stojí?", answer: "Cena závisí od zvoleného balíka služieb. Základný balík začína od 990€. Podrobnejšie informácie o cenách nájdete v aktuálnom cenníku alebo kontaktujte nášho poradcu.", category: "Cena" },
              { id: "6", question: "Kedy sa mám rozhodnúť?", answer: "Ideálne je rozhodnúť sa do 34. týždňa tehotenstva, aby sme stihli pripraviť všetky potrebné dokumenty a odberový set. V urgentných prípadoch vieme zabezpečiť aj rýchlejšie spracovanie.", category: "Proces" },
              { id: "7", question: "Čo ak mám cisársky rez?", answer: "Odber pupočníkovej krvi je možný aj pri cisárskom reze. Postup je rovnako bezpečný a bezbolestný. Informujte o tom vašu pôrodnicu a nášho koordinátora.", category: "Odber" },
              { id: "8", question: "Je to kompatibilné pre súrodencov?", answer: "Áno, pupočníková krv je s vyššou pravdepodobnosťou kompatibilná medzi súrodencami (25% plná zhoda). Pre samotné dieťa je zhoda 100%. Uchovanie pre jedného potomka môže pomôcť celej rodine.", category: "Liečba" },
            ],
            cs: [
              { id: "1", question: "Co je pupečníková krev?", answer: "Pupečníková krev je krev, která zůstává v pupečníku a placentě po porodu. Obsahuje kmenové buňky, které mohou být použity k léčbě různých onemocnění.", category: "Obecné" },
              { id: "2", question: "Je odběr bolestivý?", answer: "Ne, odběr pupečníkové krve je zcela bezbolestný pro matku i dítě. Provádí se až po porodu a přestřižení pupečníku.", category: "Odběr" },
              { id: "3", question: "Jak dlouho lze uchovávat?", answer: "Kmenové buňky z pupečníkové krve lze uchovávat v kryokonzervaci prakticky neomezeně dlouho. Studie potvrzují životaschopnost i po 25+ letech.", category: "Uchovávání" },
              { id: "4", question: "Jaká onemocnění lze léčit?", answer: "Kmenové buňky z pupečníkové krve se používají k léčbě více než 80 onemocnění včetně leukémie, lymfomů, anémie, metabolických poruch a imunodeficiencí.", category: "Léčba" },
              { id: "5", question: "Kolik to stojí?", answer: "Cena závisí na zvoleném balíčku služeb. Základní balíček začíná od 990€. Podrobnější informace o cenách najdete v aktuálním ceníku nebo kontaktujte našeho poradce.", category: "Cena" },
              { id: "6", question: "Kdy se mám rozhodnout?", answer: "Ideálně je rozhodnout se do 34. týdne těhotenství, abychom stihli připravit všechny potřebné dokumenty a odběrový set.", category: "Proces" },
              { id: "7", question: "Co když mám císařský řez?", answer: "Odběr pupečníkové krve je možný i při císařském řezu. Postup je stejně bezpečný a bezbolestný. Informujte o tom vaši porodnici a našeho koordinátora.", category: "Odběr" },
              { id: "8", question: "Je to kompatibilní pro sourozence?", answer: "Ano, pupečníková krev je s vyšší pravděpodobností kompatibilní mezi sourozenci (25% plná shoda). Pro samotné dítě je shoda 100%.", category: "Léčba" },
            ],
            hu: [
              { id: "1", question: "Mi az a köldökzsinórvér?", answer: "A köldökzsinórvér a születés után a köldökzsinórban és a méhlepényben maradó vér. Őssejteket tartalmaz, amelyek különböző betegségek kezelésére használhatók.", category: "Általános" },
              { id: "2", question: "Fájdalmas a gyűjtés?", answer: "Nem, a köldökzsinórvér gyűjtése teljesen fájdalommentes az anya és a baba számára egyaránt. A születés és a köldökzsinór elvágása után végzik.", category: "Gyűjtés" },
              { id: "3", question: "Meddig tárolható?", answer: "A köldökzsinórvérből nyert őssejtek kriőkonzerválással gyakorlatilag korlátlanul tárolhatók. Tanulmányok 25+ év után is igazolják az életképességet.", category: "Tárolás" },
              { id: "4", question: "Milyen betegségek kezelhetők?", answer: "A köldökzsinórvérből nyert őssejteket több mint 80 betegség kezelésére használják, beleértve a leukémiát, limfómákat, anémiát és immunhiányos állapotokat.", category: "Kezelés" },
              { id: "5", question: "Mennyibe kerül?", answer: "Az ár a választott szolgáltatási csomagtól függ. Az alapcsomag 990€-tól indul. Részletesebb árinformációkért tekintse meg az aktuális árlistát.", category: "Árazás" },
              { id: "6", question: "Mikor kell döntenem?", answer: "Ideális esetben a terhesség 34. hetéig kell dönteni, hogy legyen idő az összes szükséges dokumentum és gyűjtőkészlet előkészítésére.", category: "Folyamat" },
              { id: "7", question: "Mi van, ha császármetszésem lesz?", answer: "A köldökzsinórvér gyűjtése császármetszés esetén is lehetséges. Az eljárás ugyanolyan biztonságos és fájdalommentes.", category: "Gyűjtés" },
              { id: "8", question: "Kompatibilis a testvérek számára?", answer: "Igen, a köldökzsinórvér nagyobb valószínűséggel kompatibilis a testvérek között (25% teljes egyezés). A gyermek számára 100%-os az egyezés.", category: "Kezelés" },
            ],
            ro: [
              { id: "1", question: "Ce este sângele din cordonul ombilical?", answer: "Sângele din cordonul ombilical este sângele care rămâne în cordonul ombilical și placentă după naștere. Conține celule stem care pot fi folosite pentru tratarea diverselor boli.", category: "General" },
              { id: "2", question: "Este colectarea dureroasă?", answer: "Nu, colectarea sângelui din cordonul ombilical este complet nedureroasă atât pentru mamă, cât și pentru copil. Se efectuează după naștere.", category: "Colectare" },
              { id: "3", question: "Cât timp poate fi depozitat?", answer: "Celulele stem din sângele cordonului ombilical pot fi depozitate prin crioconservare practic la nesfârșit. Studiile confirmă viabilitatea chiar și după 25+ ani.", category: "Depozitare" },
              { id: "4", question: "Ce boli pot fi tratate?", answer: "Celulele stem sunt folosite pentru tratarea a peste 80 de boli, inclusiv leucemie, limfoame, anemie și imunodeficiențe.", category: "Tratament" },
              { id: "5", question: "Cât costă?", answer: "Prețul depinde de pachetul de servicii ales. Pachetul de bază pornește de la 990€.", category: "Prețuri" },
              { id: "6", question: "Când trebuie să mă decid?", answer: "Ideal este să vă decideți înainte de săptămâna 34 de sarcină pentru a avea timp să pregătim toate documentele necesare.", category: "Proces" },
              { id: "7", question: "Ce se întâmplă dacă am cezariană?", answer: "Colectarea sângelui din cordonul ombilical este posibilă și în cazul cezarianei. Procedura este la fel de sigură și nedureroasă.", category: "Colectare" },
              { id: "8", question: "Este compatibil pentru frați?", answer: "Da, sângele din cordonul ombilical este mai probabil compatibil între frați (25% potrivire completă). Pentru copil, potrivirea este de 100%.", category: "Tratament" },
            ],
            it: [
              { id: "1", question: "Cos'è il sangue del cordone ombelicale?", answer: "Il sangue del cordone ombelicale è il sangue che rimane nel cordone ombelicale e nella placenta dopo il parto. Contiene cellule staminali utilizzabili per il trattamento di varie malattie.", category: "Generale" },
              { id: "2", question: "La raccolta è dolorosa?", answer: "No, la raccolta del sangue del cordone ombelicale è completamente indolore sia per la madre che per il bambino. Viene eseguita dopo il parto.", category: "Raccolta" },
              { id: "3", question: "Per quanto tempo può essere conservato?", answer: "Le cellule staminali possono essere conservate in crioconservazione praticamente a tempo indeterminato. Gli studi confermano la vitalità anche dopo 25+ anni.", category: "Conservazione" },
              { id: "4", question: "Quali malattie possono essere trattate?", answer: "Le cellule staminali sono utilizzate per trattare oltre 80 malattie tra cui leucemia, linfomi, anemia e immunodeficienze.", category: "Trattamento" },
              { id: "5", question: "Quanto costa?", answer: "Il prezzo dipende dal pacchetto di servizi scelto. Il pacchetto base parte da 990€.", category: "Prezzi" },
              { id: "6", question: "Quando devo decidere?", answer: "Idealmente bisogna decidere entro la 34a settimana di gravidanza per avere tempo di preparare tutti i documenti necessari.", category: "Processo" },
              { id: "7", question: "E se ho un taglio cesareo?", answer: "La raccolta del sangue cordonale è possibile anche con taglio cesareo. La procedura è ugualmente sicura e indolore.", category: "Raccolta" },
              { id: "8", question: "È compatibile per i fratelli?", answer: "Sì, il sangue cordonale è più probabilmente compatibile tra fratelli (25% corrispondenza completa). Per il bambino stesso, la corrispondenza è del 100%.", category: "Trattamento" },
            ],
            de: [
              { id: "1", question: "Was ist Nabelschnurblut?", answer: "Nabelschnurblut ist das Blut, das nach der Geburt in der Nabelschnur und Plazenta verbleibt. Es enthält Stammzellen, die zur Behandlung verschiedener Krankheiten verwendet werden können.", category: "Allgemein" },
              { id: "2", question: "Ist die Entnahme schmerzhaft?", answer: "Nein, die Nabelschnurblutentnahme ist für Mutter und Kind völlig schmerzfrei. Sie wird nach der Geburt und dem Durchtrennen der Nabelschnur durchgeführt.", category: "Entnahme" },
              { id: "3", question: "Wie lange kann es gelagert werden?", answer: "Stammzellen aus Nabelschnurblut können durch Kryokonservierung praktisch unbegrenzt gelagert werden. Studien bestätigen die Lebensfähigkeit auch nach 25+ Jahren.", category: "Lagerung" },
              { id: "4", question: "Welche Krankheiten können behandelt werden?", answer: "Stammzellen aus Nabelschnurblut werden zur Behandlung von über 80 Krankheiten eingesetzt, darunter Leukämie, Lymphome, Anämie und Immundefizienzen.", category: "Behandlung" },
              { id: "5", question: "Was kostet es?", answer: "Der Preis hängt vom gewählten Servicepaket ab. Das Basispaket beginnt ab 990€.", category: "Preise" },
              { id: "6", question: "Wann muss ich mich entscheiden?", answer: "Idealerweise sollten Sie sich vor der 34. Schwangerschaftswoche entscheiden, damit genug Zeit bleibt, alle notwendigen Dokumente vorzubereiten.", category: "Prozess" },
              { id: "7", question: "Was ist bei einem Kaiserschnitt?", answer: "Die Nabelschnurblutentnahme ist auch bei einem Kaiserschnitt möglich. Das Verfahren ist ebenso sicher und schmerzfrei.", category: "Entnahme" },
              { id: "8", question: "Ist es für Geschwister kompatibel?", answer: "Ja, Nabelschnurblut ist mit höherer Wahrscheinlichkeit zwischen Geschwistern kompatibel (25% volle Übereinstimmung). Für das Kind selbst beträgt die Übereinstimmung 100%.", category: "Behandlung" },
            ],
          };
          const campaignFaqs = sampleFaqData[locale] || sampleFaqData.en;

          const [expandedFaqId, setExpandedFaqId] = [faqExpandedId, setFaqExpandedId];
          const [faqSearch, setFaqSearch] = [faqSearchQuery, setFaqSearchQuery];

          const categories = [...new Set(campaignFaqs.map(f => f.category))];
          const filteredFaqs = campaignFaqs.filter(f => {
            if (!faqSearch.trim()) return true;
            const q = faqSearch.toLowerCase();
            return f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q) || f.category.toLowerCase().includes(q);
          });
          const groupedFaqs = categories.map(cat => ({
            category: cat,
            items: filteredFaqs.filter(f => f.category === cat),
          })).filter(g => g.items.length > 0);

          const renderFaqContent = (isModal: boolean) => (
            <>
              <div className={isModal ? "p-4 border-b space-y-2" : "p-2 border-b space-y-1.5"}>
                <div className="flex items-center gap-2">
                  <BookOpen className={isModal ? "h-4 w-4 text-primary" : "h-3.5 w-3.5 text-primary"} />
                  <span className={isModal ? "text-xs font-semibold uppercase tracking-wider text-muted-foreground" : "text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"}>{t.campaigns.faq.frequentlyAsked}</span>
                  <Badge variant="secondary" className={isModal ? "text-xs ml-auto" : "text-[9px] h-4 px-1 ml-auto"}>{filteredFaqs.length}</Badge>
                  {!isModal && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setFaqMaximized(true)}
                      data-testid="btn-faq-maximize"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <div className="relative">
                  <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${isModal ? "h-4 w-4" : "h-3 w-3"} text-muted-foreground`} />
                  <Input
                    value={faqSearch}
                    onChange={(e) => setFaqSearchQuery(e.target.value)}
                    placeholder={t.campaigns.faq.searchPlaceholder}
                    className={isModal ? "pl-9 h-9 text-sm" : "pl-7 h-7 text-xs"}
                    data-testid={isModal ? "input-faq-search-modal" : "input-faq-search"}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                {filteredFaqs.length === 0 ? (
                  <div className="text-center py-8">
                    <HelpCircle className={isModal ? "h-12 w-12 mx-auto mb-3 text-muted-foreground/20" : "h-8 w-8 mx-auto mb-2 text-muted-foreground/20"} />
                    <p className={isModal ? "text-sm text-muted-foreground" : "text-xs text-muted-foreground"}>{t.campaigns.faq.noFaqs}</p>
                  </div>
                ) : (
                  <div className={isModal ? "p-4 space-y-5" : "p-2 space-y-3"}>
                    {groupedFaqs.map((group) => (
                      <div key={group.category}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <div className={isModal ? "h-2 w-2 rounded-full bg-primary/60" : "h-1.5 w-1.5 rounded-full bg-primary/60"} />
                          <span className={isModal ? "text-xs font-semibold text-muted-foreground uppercase tracking-wider" : "text-[10px] font-semibold text-muted-foreground uppercase tracking-wider"}>{group.category}</span>
                          <span className={isModal ? "text-[11px] text-muted-foreground/50" : "text-[9px] text-muted-foreground/50"}>({group.items.length})</span>
                        </div>
                        <div className={isModal ? "space-y-2" : "space-y-1"}>
                          {group.items.map((faq) => {
                            const isExpanded = expandedFaqId === faq.id;
                            return (
                              <div
                                key={faq.id}
                                className="rounded-md border border-border/40 overflow-visible"
                                data-testid={`faq-item-${faq.id}`}
                              >
                                <button
                                  onClick={() => setFaqExpandedId(isExpanded ? null : faq.id)}
                                  className={`w-full flex items-start gap-2 ${isModal ? "p-3" : "p-2"} text-left hover-elevate rounded-md`}
                                  data-testid={`btn-faq-toggle-${faq.id}`}
                                >
                                  <HelpCircle className={isModal ? "h-4.5 w-4.5 text-primary/70 shrink-0 mt-0.5" : "h-3.5 w-3.5 text-primary/70 shrink-0 mt-0.5"} />
                                  <span className={isModal ? "text-sm font-medium text-foreground flex-1 leading-snug" : "text-[11px] font-medium text-foreground flex-1 leading-snug"}>{faq.question}</span>
                                  {isExpanded ? (
                                    <ChevronUp className={isModal ? "h-4 w-4 text-muted-foreground shrink-0 mt-0.5" : "h-3 w-3 text-muted-foreground shrink-0 mt-0.5"} />
                                  ) : (
                                    <ChevronDown className={isModal ? "h-4 w-4 text-muted-foreground shrink-0 mt-0.5" : "h-3 w-3 text-muted-foreground shrink-0 mt-0.5"} />
                                  )}
                                </button>
                                {isExpanded && (
                                  <div className={isModal ? "px-3 pb-3 pt-1 ml-6" : "px-2 pb-2 pt-0.5 ml-5"}>
                                    <p className={isModal ? "text-sm text-muted-foreground leading-relaxed" : "text-[11px] text-muted-foreground leading-relaxed"}>{faq.answer}</p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          );

          return (
            <>
            <div className="flex flex-col h-full">
              {renderFaqContent(false)}
            </div>

            <Dialog open={faqMaximized} onOpenChange={setFaqMaximized}>
              <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0">
                <div className="flex items-center justify-between px-5 py-3 border-b">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    <h2 className="text-base font-semibold" data-testid="text-faq-modal-title">{t.campaigns.faq.frequentlyAsked}</h2>
                  </div>
                </div>
                <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                  {renderFaqContent(true)}
                </div>
              </DialogContent>
            </Dialog>
            </>
          );
        })()}

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
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

interface ScheduledItem {
  id: string;
  type: "callback" | "email" | "sms";
  contactId: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  campaignId: string;
  campaignName: string;
  scheduledAt: string;
  notes: string;
  status: string;
}

function ScheduledQueuePanel({
  open,
  onOpenChange,
  onOpenContact,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenContact?: (contactId: string, campaignId: string, campaignContactId: string, channel: "phone" | "email" | "sms") => void;
}) {
  const [filterType, setFilterType] = useState<"all" | "callback" | "email" | "sms">("all");
  const { toast } = useToast();

  const { data: scheduledItems = [], isLoading } = useQuery<ScheduledItem[]>({
    queryKey: ["/api/agent/scheduled-queue"],
    queryFn: async () => {
      const res = await fetch("/api/agent/scheduled-queue", { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: open,
    refetchInterval: open ? 30000 : false,
  });

  const filteredItems = useMemo(() => {
    if (filterType === "all") return scheduledItems;
    return scheduledItems.filter(item => item.type === filterType);
  }, [scheduledItems, filterType]);

  const { todayCount, overdueCount } = useMemo(() => {
    const now = new Date();
    const today = new Date();
    let tc = 0, oc = 0;
    for (const item of scheduledItems) {
      const d = new Date(item.scheduledAt);
      if (d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()) tc++;
      if (d < now) oc++;
    }
    return { todayCount: tc, overdueCount: oc };
  }, [scheduledItems]);

  const isOverdue = (scheduledAt: string) => new Date(scheduledAt) < new Date();

  const getTypeIcon = (type: string) => {
    if (type === "callback") return <PhoneForwarded className="h-4 w-4" />;
    if (type === "email") return <MailPlus className="h-4 w-4" />;
    return <MessageSquarePlus className="h-4 w-4" />;
  };

  const getTypeColor = (type: string) => {
    if (type === "callback") return "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400";
    if (type === "email") return "bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400";
    return "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400";
  };

  const getTypeLabel = (type: string) => {
    if (type === "callback") return "Spätné volanie";
    if (type === "email") return "Email";
    return "SMS";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <CalendarClock className="h-5 w-5 text-primary" />
            Naplánovaná fronta
            <Badge variant="secondary" className="text-[10px]" data-testid="badge-scheduled-total">
              {scheduledItems.length} celkom
            </Badge>
            {todayCount > 0 && (
              <Badge variant="secondary" className="text-[10px]" data-testid="badge-scheduled-today">
                {todayCount} dnes
              </Badge>
            )}
            {overdueCount > 0 && (
              <Badge variant="destructive" className="text-[10px] gap-1" data-testid="badge-scheduled-overdue">
                <AlertTriangle className="h-3 w-3" />
                {overdueCount} po termíne
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-1 pb-2">
          {(["all", "callback", "email", "sms"] as const).map(type => (
            <Button
              key={type}
              variant={filterType === type ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterType(type)}
              className="gap-1.5"
              data-testid={`btn-scheduled-filter-${type}`}
            >
              {type === "all" ? (
                <CalendarClock className="h-3.5 w-3.5" />
              ) : type === "callback" ? (
                <PhoneForwarded className="h-3.5 w-3.5" />
              ) : type === "email" ? (
                <MailPlus className="h-3.5 w-3.5" />
              ) : (
                <MessageSquarePlus className="h-3.5 w-3.5" />
              )}
              <span className="text-xs">
                {type === "all" ? "Všetko" : type === "callback" ? "Hovory" : type === "email" ? "Emaily" : "SMS"}
              </span>
              <Badge variant="secondary" className="text-[9px] ml-0.5">
                {type === "all" ? scheduledItems.length : scheduledItems.filter(i => i.type === type).length}
              </Badge>
            </Button>
          ))}
        </div>

        <ScrollArea className="flex-1 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarClock className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Žiadne naplánované položky</p>
            </div>
          ) : (
            <div className="space-y-2 pr-2">
              {filteredItems.map(item => {
                const itemOverdue = isOverdue(item.scheduledAt);
                return (
                <Card key={item.id} data-testid={`scheduled-item-${item.id}`} className={itemOverdue ? "border-destructive/50 bg-destructive/5" : ""}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${itemOverdue ? "bg-destructive/10 text-destructive" : getTypeColor(item.type)}`}>
                        {itemOverdue ? <AlertTriangle className="h-4 w-4" /> : getTypeIcon(item.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            className="text-sm font-medium truncate text-left hover:underline cursor-pointer"
                            data-testid={`text-scheduled-name-${item.id}`}
                            onClick={() => {
                              if (onOpenContact) {
                                const channel = item.type === "callback" ? "phone" : item.type;
                                onOpenContact(item.contactId, item.campaignId, item.id, channel as "phone" | "email" | "sms");
                                onOpenChange(false);
                              }
                            }}
                          >
                            {item.contactName || "Neznámy kontakt"}
                          </button>
                          <Badge variant="outline" className="text-[9px]">
                            {getTypeLabel(item.type)}
                          </Badge>
                          {itemOverdue && (
                            <Badge variant="destructive" className="text-[9px] gap-0.5">
                              <AlertTriangle className="h-2.5 w-2.5" />
                              Po termíne
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          {item.contactPhone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {item.contactPhone}
                            </span>
                          )}
                          {item.contactEmail && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {item.contactEmail}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Megaphone className="h-3 w-3" />
                            {item.campaignName}
                          </span>
                          <span className={`flex items-center gap-1 ${itemOverdue ? "text-destructive font-medium" : ""}`}>
                            <Calendar className="h-3 w-3" />
                            {format(new Date(item.scheduledAt), "d.M.yyyy HH:mm", { locale: sk })}
                          </span>
                        </div>
                        {item.notes && (
                          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{item.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {item.type === "callback" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Zavolať teraz"
                            data-testid={`btn-scheduled-call-${item.id}`}
                            onClick={() => {
                              if (onOpenContact) {
                                onOpenContact(item.contactId, item.campaignId, item.id, "phone");
                                onOpenChange(false);
                              }
                            }}
                          >
                            <PhoneCall className="h-4 w-4 text-blue-500" />
                          </Button>
                        )}
                        {(item.type === "email" || item.type === "sms") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Odoslať teraz"
                            data-testid={`btn-scheduled-send-${item.id}`}
                            onClick={() => {
                              if (onOpenContact) {
                                onOpenContact(item.contactId, item.campaignId, item.id, item.type as "email" | "sms");
                                onOpenChange(false);
                              }
                            }}
                          >
                            <Send className="h-4 w-4 text-green-500" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Preplánovať"
                          data-testid={`btn-scheduled-reschedule-${item.id}`}
                          onClick={() => {
                            toast({ title: "Preplánovanie", description: `Otvorte kalendár pre preplánovanie...` });
                          }}
                        >
                          <RotateCcw className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Zrušiť"
                          data-testid={`btn-scheduled-cancel-${item.id}`}
                          onClick={() => {
                            toast({ title: "Zrušené", description: `Položka bola zrušená.` });
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default function AgentWorkspacePage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const { makeCall, isRegistered: isSipRegistered } = useSip();
  const callContext = useCall();
  const [, setLocation] = useLocation();
  const { open: sidebarOpen, setOpen: setSidebarOpen } = useSidebar();
  const prevSidebarOpenRef = useRef(sidebarOpen);

  const agentSession = useAgentSession();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [currentContact, setCurrentContact] = useState<Customer | null>(null);
  const [currentCampaignContactId, setCurrentCampaignContactId] = useState<string | null>(null);
  const [disposedContactIds, setDisposedContactIds] = useState<Set<string>>(new Set());
  const [sessionLoginOpen, setSessionLoginOpen] = useState(true);
  const [activeChannel, setActiveChannel] = useState("phone");
  const [phoneSubTabOverride, setPhoneSubTabOverride] = useState<"card" | "details" | "history" | null>(null);
  const [rightTab, setRightTab] = useState("actions");
  const [callNotes, setCallNotes] = useState("");
  const [channelFilter, setChannelFilter] = useState("all");
  const [stats, setStats] = useState({ calls: 0, emails: 0, sms: 0 });
  const [showOnlyAssigned, setShowOnlyAssigned] = useState(false);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [scheduledQueueOpen, setScheduledQueueOpen] = useState(false);
  const [historyDetailModal, setHistoryDetailModal] = useState<TimelineEntry | ContactHistory | null>(null);
  const [autoCountdown, setAutoCountdown] = useState<number | null>(null);
  const autoTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [contactsModalOpen, setContactsModalOpen] = useState(false);
  const [tasksModalOpen, setTasksModalOpen] = useState(false);
  const [dispositionModalOpen, setDispositionModalOpen] = useState(false);
  const [dispositionChannelFilter, setDispositionChannelFilter] = useState<"phone" | "email" | "sms" | null>(null);
  const [modalSelectedParent, setModalSelectedParent] = useState<string | null>(null);
  const [modalCallbackDate, setModalCallbackDate] = useState("");
  const [modalCallbackTime, setModalCallbackTime] = useState("09:00");
  const [modalCallbackAssign, setModalCallbackAssign] = useState<"me" | "all">("me");
  const [scriptModalOpen, setScriptModalOpen] = useState(false);
  const [mandatoryDisposition, setMandatoryDisposition] = useState(false);
  const [callEndTimestamp, setCallEndTimestamp] = useState<number | null>(null);
  const prevCallStateRef = useRef(callContext.callState);
  const callWasActiveRef = useRef(false);
  const [ringDuration, setRingDuration] = useState(0);
  const ringTimerRef = useRef<NodeJS.Timeout | null>(null);
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

  const { data: scheduledQueueItems = [] } = useQuery<ScheduledItem[]>({
    queryKey: ["/api/agent/scheduled-queue", "badge"],
    queryFn: async () => {
      const res = await fetch("/api/agent/scheduled-queue", { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: !!hasAccess && agentSession.isSessionActive,
    refetchInterval: 60000,
  });

  const scheduledQueueCounts = useMemo(() => {
    const now = new Date();
    const overdue = scheduledQueueItems.filter(item => new Date(item.scheduledAt) < now);
    return { total: scheduledQueueItems.length, overdue: overdue.length };
  }, [scheduledQueueItems]);

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
      callContext.setPreventAutoReset(true);
    } else {
      document.documentElement.removeAttribute('data-agent-fullscreen');
      callContext.setPreventAutoReset(false);
    }
  }, [agentSession.isSessionActive]);

  useEffect(() => {
    return () => {
      setSidebarOpen(prevSidebarOpenRef.current);
      document.documentElement.removeAttribute('data-agent-fullscreen');
      callContext.setPreventAutoReset(false);
      if (ringTimerRef.current) {
        clearInterval(ringTimerRef.current);
        ringTimerRef.current = null;
      }
      if (autoTimerRef.current) {
        clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const curr = callContext.callState;
    if (curr === "connecting" || curr === "ringing") {
      callWasActiveRef.current = true;
      if (!ringTimerRef.current) {
        const startTime = Date.now();
        setRingDuration(0);
        ringTimerRef.current = setInterval(() => {
          setRingDuration(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);
      }
    }
    if (curr === "active" || curr === "on_hold") {
      callWasActiveRef.current = true;
      if (ringTimerRef.current) {
        clearInterval(ringTimerRef.current);
        ringTimerRef.current = null;
      }
    }
    if (callWasActiveRef.current && (curr === "ended" || curr === "idle")) {
      if (ringTimerRef.current) {
        clearInterval(ringTimerRef.current);
        ringTimerRef.current = null;
      }
      if (curr === "ended") {
        callWasActiveRef.current = false;
        if (currentContact && currentCampaignContactId) {
          setCallEndTimestamp(Date.now());
          setDispositionChannelFilter("phone");
          setMandatoryDisposition(true);
        }
      }
      if (curr === "idle") {
        callWasActiveRef.current = false;
        setRingDuration(0);
      }
    }
    prevCallStateRef.current = curr;
  }, [callContext.callState, currentContact, currentCampaignContactId]);

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
    const now = new Date();
    const isAvailable = (c: Campaign) => {
      if (c.status === "paused" || c.status === "draft" || c.status === "completed" || c.status === "cancelled") return false;
      if (c.startDate && new Date(c.startDate) > now) return false;
      if (c.endDate && new Date(c.endDate) < now) return false;
      return true;
    };
    const countryFilter = (c: Campaign) => {
      if (user?.role === "admin") return true;
      if (allowedCountries.length === 0) return false;
      if (!c.countryCodes || c.countryCodes.length === 0) return true;
      return c.countryCodes.some((code: string) => allowedCountries.includes(code));
    };
    return baseCampaigns.filter((c) => isAvailable(c) && countryFilter(c));
  }, [baseCampaigns, allowedCountries, user?.role]);

  const { data: campaignDispositions = [] } = useQuery<CampaignDisposition[]>({
    queryKey: ["/api/campaigns", selectedCampaignId, "dispositions"],
    enabled: !!selectedCampaignId,
  });

  const userLocale = useMemo(() => {
    const countryToLang: Record<string, string> = { SK: 'sk', CZ: 'cs', HU: 'hu', RO: 'ro', IT: 'it', DE: 'de', US: 'en' };
    if (user?.countries?.length) {
      return countryToLang[user.countries[0]] || locale;
    }
    return locale;
  }, [user?.countries, locale]);

  const getDispName = (disp: { code: string; name: string }) => {
    return DISPOSITION_NAME_TRANSLATIONS[disp.code]?.[userLocale] || disp.name;
  };

  const { data: rawCampaignContacts = [] } = useQuery<EnrichedCampaignContact[]>({
    queryKey: ["/api/campaigns", selectedCampaignId, "contacts"],
    enabled: !!selectedCampaignId && !!hasAccess,
  });

  const pendingCampaignContacts = useMemo(() => {
    return rawCampaignContacts.filter(
      (cc) => cc.customer && (cc.status === "pending" || cc.status === "callback_scheduled") && !disposedContactIds.has(cc.id)
    );
  }, [rawCampaignContacts, disposedContactIds]);

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

  const { data: persistentHistory = [] } = useQuery<any[]>({
    queryKey: ["/api/customers", currentContact?.id, "contact-history"],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${currentContact!.id}/contact-history`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: !!currentContact?.id,
    refetchInterval: 30000,
  });

  const contactHistory: ContactHistory[] = useMemo(() => {
    return persistentHistory.map((item: any) => ({
      id: item.id,
      type: item.type as ContactHistory["type"],
      direction: item.direction,
      date: item.timestamp || new Date().toISOString(),
      duration: item.duration,
      status: item.status,
      statusCode: item.statusCode,
      notes: item.notes,
      agentName: item.agentName,
      agentId: item.agentId,
      content: item.content,
      details: item.details,
      campaignName: item.campaignName,
      campaignId: item.campaignId,
      action: item.action,
      previousStatus: item.previousStatus,
      newStatus: item.newStatus,
    }));
  }, [persistentHistory]);

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
    mutationFn: async (data: { contactId: string; campaignId: string; disposition: string; notes: string; callbackDateTime?: string; parentCode?: string; callbackAssignedTo?: string | null; callMeta?: Record<string, any> }) => {
      const disp = campaignDispositions.find(d => d.code === data.disposition) 
        || campaignDispositions.find(d => d.code === data.parentCode);
      
      const actionStatusMap: Record<string, string> = {
        callback: "callback_scheduled",
        schedule_email: "callback_scheduled",
        schedule_sms: "callback_scheduled",
        dnd: "not_interested",
        complete: "completed",
        convert: "contacted",
        send_email: "contacted",
        send_sms: "contacted",
        none: "contacted",
      };
      const newStatus = actionStatusMap[disp?.actionType || "none"] || "contacted";
      
      const updateData: Record<string, any> = {
        status: newStatus,
        lastAttemptAt: new Date().toISOString(),
        notes: data.notes || undefined,
        dispositionCode: data.disposition,
        incrementAttempt: true,
        assignedTo: user?.id || null,
        callMeta: data.callMeta || undefined,
      };
      
      if (data.callbackDateTime && disp?.actionType === "callback") {
        updateData.callbackDate = data.callbackDateTime;
        updateData.status = "callback_scheduled";
        if (data.callbackAssignedTo) {
          updateData.assignedTo = data.callbackAssignedTo;
        }
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
      queryClient.invalidateQueries({ queryKey: ["/api/agent/scheduled-queue"] });
      if (currentContact?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/customers", currentContact.id, "contact-history"] });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    },
  });

  const handleDisposition = (value: string, parentCode?: string, callbackDateTime?: string, callbackAssignedTo?: string | null) => {
    const disp = campaignDispositions.find(d => d.code === value)
      || campaignDispositions.find(d => d.code === parentCode);

    const assignLabel = callbackAssignedTo ? "osobný" : "pre všetkých";
    const dispositionElapsed = callEndTimestamp ? Math.round((Date.now() - callEndTimestamp) / 1000) : undefined;
    const timing = callContext.callTiming;
    const callMeta = {
      ringDurationSeconds: timing.ringDurationSeconds,
      talkDurationSeconds: timing.talkDurationSeconds,
      dispositionDurationSeconds: dispositionElapsed || null,
      hungUpBy: timing.hungUpBy,
      ringStartTime: timing.ringStartTime ? new Date(timing.ringStartTime).toISOString() : null,
      callStartTime: timing.callStartTime ? new Date(timing.callStartTime).toISOString() : null,
      callEndTime: timing.callEndTime ? new Date(timing.callEndTime).toISOString() : null,
    };

    setTimeline((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}`,
        type: "system",
        timestamp: new Date(),
        content: `Výsledok: ${disp?.name || value}`,
        details: `Kontakt ukončený - ${disp?.name || value}${callbackDateTime ? ` (callback ${assignLabel}: ${callbackDateTime})` : ""}${timing.ringDurationSeconds ? ` | Ring: ${timing.ringDurationSeconds}s` : ""}${timing.talkDurationSeconds ? ` | Hovor: ${timing.talkDurationSeconds}s` : ""}${dispositionElapsed !== undefined ? ` | Dispozícia: ${dispositionElapsed}s` : ""}${timing.hungUpBy ? ` | Ukončil: ${timing.hungUpBy}` : ""}`,
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
        callMeta,
      });
    }

    toast({
      title: "Kontakt ukončený",
      description: `Výsledok: ${disp?.name || value}`,
    });

    setDispositionModalOpen(false);
    setModalSelectedParent(null);
    setMandatoryDisposition(false);
    setDispositionChannelFilter(null);
    setCallEndTimestamp(null);
    setRingDuration(0);
    callContext.resetCallTiming();
    callContext.setCallState("idle");
    callContext.setCallDuration(0);
    agentSession.updateStatus("wrap_up").catch(() => {});

    if (activeTaskId) {
      setTasks((prev) => prev.filter((t) => t.id !== activeTaskId));
      setActiveTaskId(null);
    }

    if (currentCampaignContactId) {
      setDisposedContactIds(prev => new Set(prev).add(currentCampaignContactId));
    }
    setCurrentContact(null);
    setCurrentCampaignContactId(null);
    setCallNotes("");
    setTimeline([]);
    setActiveChannel("phone");

    const isAuto = isAutoMode || campaignAutoSettings.autoMode;
    const wrapUpDelay = isAuto ? (campaignAutoSettings.autoDelaySeconds || 5) * 1000 : 2000;

    setTimeout(() => {
      agentSession.updateStatus("available").catch(() => {});
      if (isAuto) {
        handleNextContact();
      }
    }, wrapUpDelay);
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
        queryClient.invalidateQueries({ queryKey: ["/api/customers", variables.customerId, "contact-history"] });
      }
      if (currentCampaignContactId) {
        setDispositionChannelFilter("email");
        setDispositionModalOpen(true);
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
        queryClient.invalidateQueries({ queryKey: ["/api/customers", variables.customerId, "contact-history"] });
      }
      if (currentCampaignContactId) {
        setDispositionChannelFilter("sms");
        setDispositionModalOpen(true);
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
      if (callContext.callState !== "idle") {
        callContext.forceResetCallFn.current?.();
      } else {
        callContext.resetCallTiming();
        callContext.setCallInfo(null);
      }
      callWasActiveRef.current = false;
      prevCallStateRef.current = "idle";
      setDispositionModalOpen(false);
      setMandatoryDisposition(false);
      setCallEndTimestamp(null);
      setRingDuration(0);
      setCallNotes("");

      await agentSession.startSession(selectedCampaignId);
      setSessionLoginOpen(false);
      toast({ title: t.agentSession.shiftStarted, description: t.agentSession.shiftStartedDesc });
    } catch (error) {
      toast({ title: t.agentSession.shiftError, description: t.agentSession.shiftStartError, variant: "destructive" });
    }
  };

  const handleEndSession = async () => {
    try {
      callContext.forceResetCallFn.current?.();

      setDispositionModalOpen(false);
      setMandatoryDisposition(false);
      setCallEndTimestamp(null);
      setRingDuration(0);
      setCallNotes("");
      callWasActiveRef.current = false;
      prevCallStateRef.current = "idle";
      if (ringTimerRef.current) {
        clearInterval(ringTimerRef.current);
        ringTimerRef.current = null;
      }

      await agentSession.endSession();
      setSidebarOpen(prevSidebarOpenRef.current);
      setSessionLoginOpen(true);
      setCurrentContact(null);
      setCurrentCampaignContactId(null);
      setTasks([]);
      setActiveTaskId(null);
      setTimeline([]);
      setStats({ calls: 0, emails: 0, sms: 0 });
      setIsAutoMode(false);
      if (autoTimerRef.current) {
        clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
      setAutoCountdown(null);
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
    const defaultTab = selectedCampaign?.defaultActiveTab || "phone";
    setActiveChannel(defaultTab);
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

  const handleOpenScheduledContact = async (contactId: string, campaignId: string, campaignContactId: string, channel: "phone" | "email" | "sms") => {
    try {
      const res = await fetch(`/api/customers/${contactId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Customer not found");
      const customer = await res.json();

      if (selectedCampaignId !== campaignId) {
        setSelectedCampaignId(campaignId);
      }
      setCurrentCampaignContactId(campaignContactId);
      setCurrentContact(customer);
      agentSession.updateStatus("busy").catch(() => {});
      setCallNotes("");
      setActiveChannel(channel);
      setRightTab("actions");

      const campaign = campaigns?.find((c: any) => c.id === campaignId);
      const campaignChannel = (campaign?.channel || "phone") as ChannelType;
      const newTask: TaskItem = {
        id: `task-${Date.now()}`,
        contact: customer,
        campaignId,
        campaignName: campaign?.name || "",
        campaignContactId,
        channel: campaignChannel,
        startedAt: new Date(),
        status: "active",
      };
      setTasks((prev) => [...prev, newTask]);
      setActiveTaskId(newTask.id);

      setTimeline([
        {
          id: `start-${Date.now()}`,
          type: "note",
          timestamp: new Date(),
          content: `Kontakt otvorený z naplánovanej fronty (${channel === "phone" ? "spätné volanie" : channel})`,
        },
      ]);
    } catch (err) {
      toast({ title: "Chyba", description: "Nepodarilo sa načítať kontakt", variant: "destructive" });
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
        onOpenScheduledQueue={() => setScheduledQueueOpen(true)}
        scheduledQueueCounts={scheduledQueueCounts}
      />

      <div className="flex flex-1 overflow-hidden">
        <TaskListPanel
          tasks={tasks}
          activeTaskId={activeTaskId}
          onSelectTask={handleSelectTask}
          campaigns={activeCampaigns}
          selectedCampaignId={selectedCampaignId}
          onSelectCampaign={(id: string) => { setSelectedCampaignId(id); setDisposedContactIds(new Set()); }}
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
          externalPhoneSubTab={phoneSubTabOverride}
          callState={callContext.callState}
          callDuration={callContext.callDuration}
          ringDuration={ringDuration}
          hungUpBy={callContext.callTiming.hungUpBy}
          isMuted={callContext.isMuted}
          isOnHold={callContext.isOnHold}
          volume={callContext.volume}
          micVolume={callContext.micVolume}
          onEndCall={() => callContext.endCallFn.current?.()}
          onOpenDisposition={() => { setDispositionChannelFilter(null); setDispositionModalOpen(true); }}
          onToggleMute={() => callContext.toggleMuteFn.current?.()}
          onToggleHold={() => callContext.toggleHoldFn.current?.()}
          onSendDtmf={(digit) => callContext.sendDtmfFn.current?.(digit)}
          onVolumeChange={(vol) => callContext.onVolumeChangeFn.current?.(vol)}
          onMicVolumeChange={(vol) => callContext.onMicVolumeChangeFn.current?.(vol)}
          callerNumber={callContext.callInfo?.phoneNumber || ""}
          contactHistory={contactHistory}
          onOpenHistoryDetail={(entry) => setHistoryDetailModal(entry)}
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
          onOpenDispositionModal={() => { setDispositionChannelFilter(null); setDispositionModalOpen(true); }}
          callState={callContext.callState}
          callDuration={callContext.callDuration}
          ringDuration={ringDuration}
          hungUpBy={callContext.callTiming.hungUpBy}
          onEndCall={() => callContext.endCallFn.current?.()}
          onOpenDispositionFromCall={() => { setDispositionChannelFilter("phone"); setMandatoryDisposition(true); setDispositionModalOpen(true); }}
          isMuted={callContext.isMuted}
          isOnHold={callContext.isOnHold}
          volume={callContext.volume}
          micVolume={callContext.micVolume}
          onToggleMute={() => callContext.toggleMuteFn.current?.()}
          onToggleHold={() => callContext.toggleHoldFn.current?.()}
          onSendDtmf={(digit) => callContext.sendDtmfFn.current?.(digit)}
          onVolumeChange={(vol) => callContext.onVolumeChangeFn.current?.(vol)}
          onMicVolumeChange={(vol) => callContext.onMicVolumeChangeFn.current?.(vol)}
          callerNumber={callContext.callInfo?.phoneNumber || ""}
          onEditCustomer={() => { setActiveChannel("phone"); setPhoneSubTabOverride("card"); setTimeout(() => setPhoneSubTabOverride(null), 100); }}
          onViewCustomer={() => { setActiveChannel("phone"); setPhoneSubTabOverride("details"); setTimeout(() => setPhoneSubTabOverride(null), 100); }}
          onOpenHistoryDetail={(entry) => setHistoryDetailModal(entry)}
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

      <Dialog open={dispositionModalOpen} onOpenChange={(open) => { if (!open && mandatoryDisposition) return; setDispositionModalOpen(open); if (!open) { setModalSelectedParent(null); setModalCallbackDate(""); setModalCallbackTime("09:00"); setModalCallbackAssign("me"); setDispositionChannelFilter(null); } }}>
        <DialogContent className={`max-w-2xl max-h-[80vh] flex flex-col ${mandatoryDisposition ? "[&>button]:hidden" : ""}`} onPointerDownOutside={mandatoryDisposition ? (e) => e.preventDefault() : undefined} onEscapeKeyDown={mandatoryDisposition ? (e) => e.preventDefault() : undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              {modalSelectedParent ? "Podkategória" : dispositionChannelFilter === "phone" ? "Výsledok hovoru" : dispositionChannelFilter === "email" ? "Výsledok emailu" : dispositionChannelFilter === "sms" ? "Výsledok SMS" : mandatoryDisposition ? "Povinný výsledok hovoru" : "Výsledok kontaktu"}
              {currentContact && (
                <Badge variant="secondary" className="ml-2">{currentContact.firstName} {currentContact.lastName}</Badge>
              )}
            </DialogTitle>
            {mandatoryDisposition && (
              <p className="text-xs text-destructive mt-1">Vyberte výsledok hovoru pred pokračovaním</p>
            )}
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
                    {(parent?.actionType === "callback" || parent?.actionType === "schedule_email" || parent?.actionType === "schedule_sms") && (
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
                          const isScheduleType = parent?.actionType === "callback" || parent?.actionType === "schedule_email" || parent?.actionType === "schedule_sms";
                          return (
                            <Button key={child.id} variant="outline" className={`gap-2 justify-start py-3 ${colorClass}`} onClick={() => { handleDisposition(child.code, parent?.code, isScheduleType && modalCallbackDate && modalCallbackTime ? `${modalCallbackDate}T${modalCallbackTime}` : undefined, isScheduleType ? cbAssignTo : undefined); }} data-testid={`modal-disposition-${child.code}`}>
                              <IconComp className="h-4 w-4" />
                              <span className="text-sm font-medium">{getDispName(child)}</span>
                            </Button>
                          );
                        })}
                      </div>
                    )}
                    {(parent?.actionType === "callback" || parent?.actionType === "schedule_email" || parent?.actionType === "schedule_sms") && (
                      <Button className="w-full" disabled={!modalCallbackDate} onClick={() => { handleDisposition(parent!.code, undefined, modalCallbackDate && modalCallbackTime ? `${modalCallbackDate}T${modalCallbackTime}` : undefined, cbAssignTo); }} data-testid="btn-modal-disposition-confirm-callback">
                        <CalendarPlus className="h-4 w-4 mr-1" />
                        {parent?.actionType === "schedule_email" ? "Naplánovať email" : parent?.actionType === "schedule_sms" ? "Naplánovať SMS" : "Potvrdiť preplánovanie"}
                      </Button>
                    )}
                  </div>
                );
              })() : (
                <div className="grid grid-cols-2 gap-2">
                  {campaignDispositions.filter(d => {
                    if (d.parentId || !d.isActive) return false;
                    if (!dispositionChannelFilter) return true;
                    if (dispositionChannelFilter === "sms") {
                      return d.actionType === "send_sms" || d.actionType === "schedule_sms";
                    }
                    if (dispositionChannelFilter === "email") {
                      return d.actionType === "send_email" || d.actionType === "schedule_email";
                    }
                    return d.channel === dispositionChannelFilter;
                  }).map((disp) => {
                    const IconComp = DISPOSITION_ICON_MAP[disp.icon || ""] || CircleDot;
                    const colorClass = DISPOSITION_COLOR_MAP[disp.color || "gray"] || DISPOSITION_COLOR_MAP.gray;
                    const children = campaignDispositions.filter(d => d.parentId === disp.id && d.isActive);
                    const hasChildren = children.length > 0;
                    const isCallback = disp.actionType === "callback" || disp.actionType === "schedule_email" || disp.actionType === "schedule_sms";
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
                        }
                      }} data-testid={`modal-disposition-${disp.code}`}>
                        <IconComp className="h-5 w-5" />
                        <span className="text-sm font-medium flex-1 text-left">{getDispName(disp)}</span>
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

      <ScheduledQueuePanel open={scheduledQueueOpen} onOpenChange={setScheduledQueueOpen} onOpenContact={handleOpenScheduledContact} />

      <Dialog open={!!historyDetailModal} onOpenChange={(open) => !open && setHistoryDetailModal(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col p-0">
          {historyDetailModal && (() => {
            const entry = historyDetailModal;
            const isEmail = (entry as any).type === "email" || !!(entry as any).htmlBody;
            const isSms = (entry as any).type === "sms";
            const timestamp = (entry as any).timestamp instanceof Date
              ? (entry as any).timestamp
              : new Date((entry as any).timestamp || (entry as any).date);
            const htmlBody = (entry as any).htmlBody || (entry as any).details || "";
            const fullContent = (entry as any).fullContent || (entry as any).content || "";
            const direction = (entry as any).direction;
            const agentName = (entry as any).agentName;
            const status = (entry as any).status;
            const recipientEmail = (entry as any).recipientEmail;
            const recipientPhone = (entry as any).recipientPhone;
            const subject = isEmail ? ((entry as any).content || "Email") : null;

            return (
              <>
                <div className={`px-6 py-4 border-b ${isEmail ? "bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20" : "bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20"}`}>
                  <div className="flex items-start gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isEmail ? "bg-green-100 dark:bg-green-900/40" : "bg-orange-100 dark:bg-orange-900/40"}`}>
                      {isEmail ? (
                        direction === "outbound"
                          ? <Send className="h-5 w-5 text-green-600 dark:text-green-400" />
                          : <Inbox className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      ) : (
                        direction === "outbound"
                          ? <Send className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                          : <Inbox className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-base font-semibold" data-testid="text-history-detail-title">
                          {isEmail ? (subject || "Email") : "SMS správa"}
                        </h3>
                        <Badge variant={direction === "outbound" ? "secondary" : "outline"} className="text-[10px]">
                          {direction === "outbound" ? "Odoslaný" : "Prijatý"}
                        </Badge>
                        {status && (
                          <Badge variant="outline" className="text-[10px]">{status}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(timestamp, "d. MMMM yyyy, HH:mm:ss", { locale: sk })}
                        </span>
                        {agentName && (
                          <span className="flex items-center gap-1">
                            <UserCircle className="h-3 w-3" />
                            {agentName}
                          </span>
                        )}
                        {isEmail && recipientEmail && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {recipientEmail}
                          </span>
                        )}
                        {isSms && recipientPhone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {recipientPhone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-auto" style={{ maxHeight: "60vh" }}>
                  {isEmail && htmlBody ? (
                    <div className="p-2 h-full">
                      <iframe
                        ref={(iframe) => {
                          if (iframe) {
                            const tryResize = () => {
                              try {
                                const doc = iframe.contentDocument || iframe.contentWindow?.document;
                                if (doc?.body) {
                                  const h = Math.max(doc.body.scrollHeight + 40, 300);
                                  iframe.style.height = h + "px";
                                }
                              } catch {}
                            };
                            iframe.onload = tryResize;
                            setTimeout(tryResize, 200);
                            setTimeout(tryResize, 600);
                          }
                        }}
                        srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.6;color:#333;margin:16px;word-wrap:break-word}img{max-width:100%;height:auto}a{color:#1a73e8;text-decoration:none}table{border-collapse:collapse;max-width:100%}td,th{padding:4px 8px}pre{white-space:pre-wrap;word-wrap:break-word}@media(prefers-color-scheme:dark){body{color:#e0e0e0;background:#0a0a0a}a{color:#8ab4f8}}</style></head><body>${htmlBody.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/on\w+\s*=/gi, 'data-blocked=')}</body></html>`}
                        className="w-full border-0 rounded-md bg-white dark:bg-gray-950"
                        style={{ minHeight: "400px", width: "100%" }}
                        sandbox="allow-same-origin"
                        title="Email obsah"
                        data-testid="iframe-email-content"
                      />
                    </div>
                  ) : (
                    <div className="p-6">
                      <div className={`rounded-lg p-4 ${direction === "outbound" ? "bg-primary/5 border border-primary/10" : "bg-muted/30 border border-border/30"}`}>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap" data-testid="text-history-detail-content">
                          {isSms ? fullContent : (entry as any).content || ""}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
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
