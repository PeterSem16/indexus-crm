import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Link } from "wouter";
import { useI18n } from "@/i18n/I18nProvider";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Mail,
  MailOpen,
  Reply,
  ReplyAll,
  Forward,
  Loader2,
  AlertCircle,
  AlertTriangle,
  PenSquare,
  X,
  Paperclip,
  ChevronLeft,
  ChevronRight,
  Settings,
  User,
  Search,
  UserCheck,
  Flame,
  ShieldAlert,
  Upload,
  ArrowRight,
  Zap,
  MessageSquare,
  Network,
  ListTodo,
  MessagesSquare,
  Circle,
  Clock,
  AlertOctagon,
  CheckCircle2,
  XCircle,
  Trash2,
  Send,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  CircleDashed,
  Star,
  CalendarDays,
  CalendarRange,
  FilterX,
  ArrowUpDown,
  ArrowUpAZ,
  ArrowDownAZ,
  Tag,
  Plus,
  Briefcase,
  Hourglass,
  Palette,
  Type,
  LayoutList,
  Sliders,
  UserCircle,
  Download,
  Shield,
  Users,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  FileText,
  Sparkles,
  Languages,
  Volume2,
  VolumeX,
  Check,
  History,
  Globe,
  AtSign,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import EmailEditor, { EmailRecipientInput } from "@/components/nexus/email-editor";

import NexusSidebar, { ACCOUNT_ICONS, AccountIcon, type AccountIconConfig } from "@/components/nexus/nexus-sidebar";
import type {
  Mailbox,
  MailFolder,
  EmailMessage,
  EmailSignature,
  Task,
  ChatConversation,
  SmsMessage,
  NexusTab,
  TaskFilter,
  SmsFilter,
} from "@/components/nexus/nexus-types";
import { typeColors } from "@/components/nexus/nexus-types";

const priorityIcons: Record<string, React.ReactNode> = {
  low: <Circle className="h-3 w-3 text-slate-400" />,
  medium: <Circle className="h-3 w-3 text-blue-500" />,
  high: <AlertOctagon className="h-3 w-3 text-orange-500" />,
  urgent: <AlertOctagon className="h-3 w-3 text-red-500" />,
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="h-3 w-3 text-slate-400" />,
  in_progress: <CircleDashed className="h-3 w-3 text-blue-500" />,
  completed: <CheckCircle2 className="h-3 w-3 text-emerald-500" />,
  cancelled: <XCircle className="h-3 w-3 text-red-500" />,
};

function stripHtmlTags(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style,iframe,object,embed").forEach(el => el.remove());
  return doc.body.innerHTML;
}

function TeamsPanel({ userId }: { userId?: string }) {
  const [selectedTeamsChatId, setSelectedTeamsChatId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [teamsView, setTeamsView] = useState<"chats" | "teams">("chats");
  const [chatInput, setChatInput] = useState("");
  const { toast } = useToast();

  const { data: chatsData, isLoading: chatsLoading, error: chatsError } = useQuery<{ connected: boolean; chats: any[]; error?: string | null; requiredPermissions?: string[] }>({
    queryKey: [`/api/users/${userId}/teams-chats`],
    enabled: !!userId && teamsView === "chats",
    retry: 1,
  });

  const { data: teamsData, isLoading: teamsLoading, error: teamsError } = useQuery<{ connected: boolean; teams: any[]; error?: string | null; requiredPermissions?: string[] }>({
    queryKey: [`/api/users/${userId}/teams-joined`],
    enabled: !!userId && teamsView === "teams",
    retry: 1,
  });

  const { data: channelsData } = useQuery<{ connected: boolean; channels: any[] }>({
    queryKey: [`/api/users/${userId}/teams/${selectedTeamId}/channels`],
    enabled: !!userId && !!selectedTeamId,
  });

  const { data: chatMsgsData, isLoading: msgsLoading, refetch: refetchMsgs } = useQuery<{ connected: boolean; messages: any[] }>({
    queryKey: [`/api/users/${userId}/teams-chats/${selectedTeamsChatId}/messages`],
    enabled: !!userId && !!selectedTeamsChatId,
  });

  const { data: channelMsgsData } = useQuery<{ connected: boolean; messages: any[] }>({
    queryKey: [`/api/users/${userId}/teams/${selectedTeamId}/channels/${selectedChannelId}/messages`],
    enabled: !!userId && !!selectedTeamId && !!selectedChannelId,
  });

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", `/api/users/${userId}/teams-chats/${selectedTeamsChatId}/messages`, { content });
    },
    onSuccess: () => {
      setChatInput("");
      refetchMsgs();
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa odoslať správu", variant: "destructive" });
    },
  });

  const permError = chatsData?.error === "missing_permissions" || teamsData?.error === "missing_permissions";
  const requiredPerms = chatsData?.requiredPermissions || teamsData?.requiredPermissions || [];

  if (permError) {
    return (
      <Card className="transition-all duration-300 flex-1 min-w-0">
        <CardContent className="p-0 h-full">
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
            <Shield className="h-16 w-16 mb-4 opacity-30 text-indigo-400" />
            <p className="text-xl font-semibold mb-2">Chýbajúce oprávnenia</p>
            <p className="text-sm text-center max-w-md mb-4">
              Na prístup k Microsoft Teams konverzáciám je potrebné pridať oprávnenia do Azure AD registrácie aplikácie.
            </p>
            <div className="bg-muted/50 rounded-lg p-4 max-w-md w-full">
              <p className="text-xs font-semibold mb-2 uppercase tracking-wider">Potrebné oprávnenia (delegated):</p>
              <div className="space-y-1.5">
                {["Chat.Read", "Chat.ReadWrite", "ChannelMessage.Read.All", "Team.ReadBasic.All", "User.Read"].map(p => (
                  <div key={p} className="flex items-center gap-2 text-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                    <code className="bg-background px-1.5 py-0.5 rounded font-mono text-[11px]">{p}</code>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">
                Prejdite do Azure Portal → App registrations → vaša aplikácia → API permissions → Add a permission → Microsoft Graph → Delegated permissions → pridajte vyššie uvedené oprávnenia → kliknite "Grant admin consent".
              </p>
              <p className="text-[11px] text-muted-foreground mt-2">
                Po pridaní oprávnení sa odhláste a znova prihláste do NEXUS.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const chats = chatsData?.chats || [];
  const teams = teamsData?.teams || [];
  const channels = channelsData?.channels || [];
  const chatMessages = chatMsgsData?.messages || [];
  const channelMessages = channelMsgsData?.messages || [];
  const selectedTeam = teams.find(t => t.id === selectedTeamId);

  return (
    <>
      <Card className="transition-all duration-300 w-[30%] min-w-[280px] max-w-[380px] shrink-0">
        <CardContent className="p-0 h-full flex flex-col">
          <div className="p-3 border-b">
            <div className="flex gap-1">
              <Button variant={teamsView === "chats" ? "default" : "outline"} size="sm" className="flex-1 text-xs" onClick={() => { setTeamsView("chats"); setSelectedTeamId(null); setSelectedChannelId(null); }} data-testid="teams-view-chats">
                <MessagesSquare className="h-3.5 w-3.5 mr-1" />Chaty
              </Button>
              <Button variant={teamsView === "teams" ? "default" : "outline"} size="sm" className="flex-1 text-xs" onClick={() => { setTeamsView("teams"); setSelectedTeamsChatId(null); }} data-testid="teams-view-teams">
                <Users className="h-3.5 w-3.5 mr-1" />Tímy
              </Button>
            </div>
          </div>
          <ScrollArea className="flex-1">
            {teamsView === "chats" && (
              <div className="divide-y">
                {chatsLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : chats.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <MessagesSquare className="h-8 w-8 mb-2 opacity-30" />
                    <span className="text-xs">{chatsError ? `Chyba: ${chatsError.message}` : chatsData?.error ? `Chyba: ${chatsData.error}` : chatsData?.connected === false ? "MS365 nie je pripojený" : "Žiadne Teams chaty"}</span>
                  </div>
                ) : chats.map(chat => (
                  <button
                    key={chat.id}
                    className={`w-full text-left px-3 py-2.5 transition-all hover:bg-accent/50 ${selectedTeamsChatId === chat.id ? "bg-accent" : ""}`}
                    onClick={() => setSelectedTeamsChatId(chat.id)}
                    data-testid={`teams-chat-${chat.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                        {chat.chatType === "group" ? <Users className="h-4 w-4 text-indigo-600" /> : <User className="h-4 w-4 text-indigo-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{chat.topic}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {chat.chatType === "oneOnOne" ? "Priamy chat" : chat.chatType === "group" ? "Skupinový chat" : chat.chatType}
                          {chat.lastUpdatedDateTime && ` · ${format(new Date(chat.lastUpdatedDateTime), "d.M. HH:mm")}`}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {teamsView === "teams" && !selectedTeamId && (
              <div className="divide-y">
                {teamsLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : teams.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Users className="h-8 w-8 mb-2 opacity-30" />
                    <span className="text-xs">{teamsError ? `Chyba: ${teamsError.message}` : teamsData?.error ? `Chyba: ${teamsData.error}` : teamsData?.connected === false ? "MS365 nie je pripojený" : "Žiadne tímy"}</span>
                  </div>
                ) : teams.map(team => (
                  <button
                    key={team.id}
                    className="w-full text-left px-3 py-2.5 transition-all hover:bg-accent/50"
                    onClick={() => setSelectedTeamId(team.id)}
                    data-testid={`teams-team-${team.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                        <Users className="h-4 w-4 text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{team.displayName}</p>
                        {team.description && <p className="text-[11px] text-muted-foreground truncate">{team.description}</p>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {teamsView === "teams" && selectedTeamId && (
              <div>
                <button className="w-full text-left px-3 py-2 text-xs text-muted-foreground hover:bg-accent/50 flex items-center gap-1" onClick={() => { setSelectedTeamId(null); setSelectedChannelId(null); }}>
                  <ChevronLeft className="h-3 w-3" /> Späť na tímy
                </button>
                <div className="px-3 py-1.5 border-b">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{selectedTeam?.displayName} - Kanály</p>
                </div>
                <div className="divide-y">
                  {channels.map(ch => (
                    <button
                      key={ch.id}
                      className={`w-full text-left px-3 py-2 transition-all hover:bg-accent/50 ${selectedChannelId === ch.id ? "bg-accent" : ""}`}
                      onClick={() => setSelectedChannelId(ch.id)}
                      data-testid={`teams-channel-${ch.id}`}
                    >
                      <p className="text-sm font-medium truncate"># {ch.displayName}</p>
                      {ch.description && <p className="text-[11px] text-muted-foreground truncate">{ch.description}</p>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
      <Card className="transition-all duration-300 flex-1 min-w-0">
        <CardContent className="p-0 h-full">
          {selectedTeamsChatId ? (
            msgsLoading ? (
              <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="p-3 border-b flex items-center gap-2">
                  <Badge className="bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300">
                    <MessagesSquare className="h-3 w-3 mr-1" />Teams Chat
                  </Badge>
                  <span className="text-sm font-semibold truncate">{chats.find(c => c.id === selectedTeamsChatId)?.topic || "Chat"}</span>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-3">
                    {chatMessages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <MessagesSquare className="h-8 w-8 mb-2 opacity-30" />
                        <span className="text-xs">Žiadne správy</span>
                      </div>
                    ) : [...chatMessages].reverse().map(msg => (
                      <div key={msg.id} className="flex gap-2">
                        <div className="h-7 w-7 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-[10px] font-bold text-indigo-700 shrink-0 mt-0.5">
                          {(msg.from || "?").substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs font-semibold">{msg.from}</span>
                            <span className="text-[10px] text-muted-foreground">{format(new Date(msg.createdDateTime), "d.M. HH:mm")}</span>
                          </div>
                          {msg.contentType === "html" ? (
                            <div className="text-sm mt-0.5 prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: stripHtmlTags(msg.body) }} />
                          ) : (
                            <p className="text-sm mt-0.5" style={{ overflowWrap: "anywhere" }}>{msg.body}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="p-3 border-t flex gap-2">
                  <Input
                    placeholder="Napíšte správu..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && chatInput.trim()) sendMutation.mutate(chatInput.trim()); }}
                    data-testid="teams-chat-input"
                  />
                  <Button size="sm" disabled={!chatInput.trim() || sendMutation.isPending} onClick={() => chatInput.trim() && sendMutation.mutate(chatInput.trim())} data-testid="teams-chat-send">
                    {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )
          ) : selectedChannelId ? (
            <div className="flex flex-col h-full">
              <div className="p-3 border-b flex items-center gap-2">
                <Badge className="bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300">
                  <Users className="h-3 w-3 mr-1" />{selectedTeam?.displayName}
                </Badge>
                <span className="text-sm font-semibold truncate">#{channels.find(c => c.id === selectedChannelId)?.displayName}</span>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-3">
                  {channelMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <MessagesSquare className="h-8 w-8 mb-2 opacity-30" />
                      <span className="text-xs">Žiadne správy v kanáli</span>
                    </div>
                  ) : [...channelMessages].reverse().map(msg => (
                    <div key={msg.id} className="flex gap-2">
                      <div className="h-7 w-7 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-[10px] font-bold text-indigo-700 shrink-0 mt-0.5">
                        {(msg.from || "?").substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-semibold">{msg.from}</span>
                          <span className="text-[10px] text-muted-foreground">{format(new Date(msg.createdDateTime), "d.M. HH:mm")}</span>
                        </div>
                        {msg.subject && <p className="text-xs font-medium text-muted-foreground">{msg.subject}</p>}
                        {msg.contentType === "html" ? (
                          <div className="text-sm mt-0.5 prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: stripHtmlTags(msg.body) }} />
                        ) : (
                          <p className="text-sm mt-0.5" style={{ overflowWrap: "anywhere" }}>{msg.body}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessagesSquare className="h-12 w-12 mb-4 opacity-30" />
              <p className="font-medium">Microsoft Teams</p>
              <p className="text-sm">Vyberte konverzáciu alebo kanál</p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export default function EmailClientPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<NexusTab>("email");
  const [selectedMailbox, setSelectedMailbox] = useState<string>("personal");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedChat, _setSelectedChat] = useState<ChatConversation | null>(null);
  const [selectedSms, setSelectedSms] = useState<SmsMessage | null>(null);
  const [smsReplyText, setSmsReplyText] = useState("");
  const [smsReplySending, setSmsReplySending] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeFullscreen, setComposeFullscreen] = useState(false);
  const [replyMode, setReplyMode] = useState<"reply" | "replyAll" | "forward" | null>(null);
  const [replyFieldsExpanded, setReplyFieldsExpanded] = useState(false);
  const [aiSuggestLoading, setAiSuggestLoading] = useState(false);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiSuggestCounter, setAiSuggestCounter] = useState(0);
  const aiInsertBodyRef = useRef<string | null>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiModalContent, setAiModalContent] = useState("");
  const [aiModalType, setAiModalType] = useState<"reply" | "summary">("reply");
  const [aiTranslating, setAiTranslating] = useState(false);
  const [sendProgress, setSendProgress] = useState<{ active: boolean; progress: number; status: "sending" | "done" | "error" }>({ active: false, progress: 0, status: "sending" });
  const prevEmailCountRef = useRef<number>(-1);
  const prevMailboxContextRef = useRef<string>("");
  const sendProgressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [aiTranslationKey, setAiTranslationKey] = useState(0);
  const [detailFullscreen, setDetailFullscreen] = useState(false);
  const [replyModalFullscreen, setReplyModalFullscreen] = useState(false);
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 200;
  const [accumulatedEmails, setAccumulatedEmails] = useState<EmailMessage[]>([]);
  const [serverTotalCount, setServerTotalCount] = useState(0);

  const [smsFilter, setSmsFilter] = useState<SmsFilter>("all");
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  const [emailFilters, setEmailFilters] = useState({
    unreadOnly: false,
    hasAttachments: false,
    important: false,
    today: false,
    thisWeek: false,
  });
  const [modalEmail, setModalEmail] = useState<EmailMessage | null>(null);
  const [emailSort, setEmailSort] = useState<"date-desc" | "date-asc" | "sender-asc" | "sender-desc" | "subject-asc" | "subject-desc">("date-desc");
  const [listSearchQuery, setListSearchQuery] = useState("");
  const [listSearchOpen, setListSearchOpen] = useState(false);
  const [filterByTagId, setFilterByTagId] = useState<string | null>(null);
  const [tagPickerEmailId, setTagPickerEmailId] = useState<string | null>(null);
  const [settingsTab, setSettingsTab] = useState<"accounts" | "messages" | "compose" | "tags" | "appearance" | "ai" | "notifications">("messages");
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6B7280");
  const [loadingAll, setLoadingAll] = useState(false);
  const [defaultTagsInitialized, setDefaultTagsInitialized] = useState(false);

  const [accountConfigs, setAccountConfigs] = useState<Record<string, { icon: string; color: string; enabled: boolean }>>(() => {
    const saved = localStorage.getItem("nexus-account-configs");
    return saved ? JSON.parse(saved) : {};
  });

  const updateAccountConfig = (email: string, config: { icon: string; color: string; enabled: boolean }) => {
    setAccountConfigs(prev => {
      const next = { ...prev, [email]: config };
      localStorage.setItem("nexus-account-configs", JSON.stringify(next));
      return next;
    });
  };

  const [emailPrefs, setEmailPrefs] = useState(() => {
    const saved = localStorage.getItem("nexus-email-prefs");
    const defaults = {
      showAccountIcons: true,
      highlightUnread: true,
      unreadIndicator: true,
      showTags: true,
      previewAttachmentIcons: true,
      previewLines: 1,
      defaultSort: "date-desc",
      showAllRecipients: false,
      expandBodyMessages: true,
      attachmentsBeforeContent: false,
      autoLoadImages: true,
      showSenderInitials: true,
      groupByDate: false,
      aiEnabled: true,
      aiLanguageMode: "email" as "email" | "user",
      aiUserLanguage: "sk",
      soundOnSend: true,
      soundOnReceive: true,
      pollingEnabled: true,
      pollingInterval: 30,
    };
    return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
  });

  const updateEmailPref = (key: string, value: any) => {
    setEmailPrefs((prev: any) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem("nexus-email-prefs", JSON.stringify(next));
      return next;
    });
  };

  const toggleEmailFilter = (key: keyof typeof emailFilters) => {
    setEmailFilters(prev => {
      const next = { ...prev, [key]: !prev[key] };
      if (key === "today" && next.today) next.thisWeek = false;
      if (key === "thisWeek" && next.thisWeek) next.today = false;
      return next;
    });
    setLocalPage(0);
  };

  const activeFilterCount = Object.values(emailFilters).filter(Boolean).length;

  const [attachments, setAttachments] = useState<File[]>([]);
  const [composeData, setComposeData] = useState({ to: "", cc: "", bcc: "", subject: "", body: "", importance: "normal" as string, tagId: null as number | null, replyTo: "" });
  const [signatureHtml, setSignatureHtml] = useState("");
  const [signatureActive, setSignatureActive] = useState(true);
  const [sigEditMailbox, setSigEditMailbox] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchMailbox, setSearchMailbox] = useState<string>("all");
  const [smartSearchOpen, setSmartSearchOpen] = useState(false);
  const [smartSearchQuery, setSmartSearchQuery] = useState("");
  const [smartSearchMailbox, setSmartSearchMailbox] = useState<string>("all");
  const smartSearchInputRef = useRef<HTMLInputElement>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("nexus-recent-searches") || "[]"); } catch { return []; }
  });
  const [searchDateFrom, setSearchDateFrom] = useState("");
  const [searchDateTo, setSearchDateTo] = useState("");
  const [searchPanelExpanded, setSearchPanelExpanded] = useState(false);
  const [listPanelExpanded, setListPanelExpanded] = useState(false);
  const [nexusFullscreen, setNexusFullscreen] = useState(false);
  const [localPage, setLocalPage] = useState(0);
  const localPageSize = 25;

  const [isSidebarHidden, setIsSidebarHidden] = useState(() => {
    const saved = localStorage.getItem("nexus-sidebar-hidden");
    return saved === "true";
  });

  useEffect(() => {
    localStorage.setItem("nexus-sidebar-hidden", String(isSidebarHidden));
  }, [isSidebarHidden]);

  const { data: mailboxes = [], isLoading: mailboxesLoading } = useQuery<Mailbox[]>({
    queryKey: ["/api/users", user?.id, "ms365-available-mailboxes"],
    queryFn: () => fetch(`/api/users/${user?.id}/ms365-available-mailboxes`).then(r => r.json()),
    enabled: !!user?.id,
  });

  const effectiveMailbox = selectedMailbox === "all" ? "personal" : selectedMailbox;

  const { data: foldersData, isLoading: foldersLoading, refetch: refetchFolders } = useQuery<{ connected: boolean; folders: MailFolder[]; inboxId?: string | null }>({
    queryKey: ["/api/users", user?.id, "ms365-folders", effectiveMailbox],
    queryFn: () => fetch(`/api/users/${user?.id}/ms365-folders?mailbox=${effectiveMailbox}`).then(r => r.json()),
    enabled: !!user?.id && !!effectiveMailbox,
  });

  const { data: allMailboxFoldersData } = useQuery<Record<string, MailFolder[]>>({
    queryKey: ["/api/users", user?.id, "ms365-folders-all-mailboxes", mailboxes.map(m => m.email).join(",")],
    queryFn: async () => {
      const result: Record<string, MailFolder[]> = {};
      for (const mb of mailboxes) {
        const mbKey = mb.type === "personal" ? "personal" : mb.email;
        try {
          const data = await fetch(`/api/users/${user?.id}/ms365-folders?mailbox=${mbKey}`).then(r => r.json());
          result[mbKey] = data.folders || [];
        } catch { result[mbKey] = []; }
      }
      return result;
    },
    enabled: !!user?.id && selectedMailbox === "all" && mailboxes.length > 1,
    staleTime: 60000,
  });

  useEffect(() => {
    if (foldersData?.inboxId && !selectedFolderId) {
      setSelectedFolderId(foldersData.inboxId);
    }
  }, [foldersData?.inboxId, selectedFolderId]);

  const handleSelectFolder = (folderId: string) => {
    if (folderId === selectedFolderId) {
      setPage(0);
      setAccumulatedEmails([]);
      setServerTotalCount(0);
      refetchMessages();
    } else {
      setSelectedFolderId(folderId);
      setPage(0);
      setAccumulatedEmails([]);
      setServerTotalCount(0);
      setSelectedEmail(null);
    }
  };

  const { data: messagesData, isLoading: messagesLoading, isFetching: messagesFetching, refetch: refetchMessages } = useQuery<{ connected: boolean; emails: EmailMessage[]; totalCount: number }>({
    queryKey: ["/api/users", user?.id, "ms365-folder-messages", selectedFolderId, selectedMailbox, page],
    queryFn: async () => {
      if (selectedMailbox === "all" && mailboxes.length > 1) {
        const selectedFolderObj = folders.find(f => f.id === selectedFolderId);
        const selectedFolderName = selectedFolderObj?.displayName || "Inbox";
        const perMb = Math.max(10, Math.floor(pageSize / mailboxes.length));
        const perMbSkip = Math.floor((page * pageSize) / mailboxes.length);
        const results = await Promise.all(
          mailboxes.map(async (mb) => {
            const mbParam = mb.type === "personal" ? "personal" : mb.email;
            try {
              const foldersRes = await fetch(`/api/users/${user?.id}/ms365-folders?mailbox=${mbParam}`);
              const foldersJson = await foldersRes.json();
              const mbFolders: MailFolder[] = foldersJson.folders || [];
              const matchedFolder = mbFolders.find(f => f.displayName === selectedFolderName) || mbFolders.find(f => f.id === foldersJson.inboxId);
              const targetFolderId = matchedFolder?.id || foldersJson.inboxId;
              if (!targetFolderId) return { connected: false, emails: [], totalCount: 0 };
              const msgsRes = await fetch(`/api/users/${user?.id}/ms365-folder-messages/${targetFolderId}?mailbox=${mbParam}&top=${perMb}&skip=${perMbSkip}`);
              const data = await msgsRes.json();
              return {
                ...data,
                emails: (data.emails || []).map((e: any) => ({ ...e, _mailboxEmail: mb.email })),
              };
            } catch {
              return { connected: false, emails: [], totalCount: 0 };
            }
          })
        );
        const allEmails = results.flatMap(r => r.emails || []);
        allEmails.sort((a: any, b: any) => new Date(b.receivedDateTime).getTime() - new Date(a.receivedDateTime).getTime());
        const totalCount = results.reduce((sum, r) => sum + (r.totalCount || 0), 0);
        return { connected: true, emails: allEmails, totalCount };
      }
      return fetch(`/api/users/${user?.id}/ms365-folder-messages/${selectedFolderId}?mailbox=${effectiveMailbox}&top=${pageSize}&skip=${page * pageSize}`).then(r => r.json());
    },
    enabled: !!user?.id && !!selectedFolderId && activeTab === "email",
    refetchInterval: emailPrefs.pollingEnabled ? emailPrefs.pollingInterval * 1000 : false,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    const contextKey = `${selectedMailbox}-${selectedFolderId}-${page}`;
    if (contextKey !== prevMailboxContextRef.current) {
      prevEmailCountRef.current = -1;
      prevMailboxContextRef.current = contextKey;
    }
  }, [selectedMailbox, selectedFolderId, page]);

  useEffect(() => {
    if (messagesData?.emails) {
      if (page === 0) {
        const currentUnreadCount = messagesData.emails.filter((e: any) => !e.isRead).length;
        const prevCount = prevEmailCountRef.current;
        if (prevCount >= 0 && currentUnreadCount > prevCount && emailPrefs.soundOnReceive) {
          playSound("receive");
        }
        prevEmailCountRef.current = currentUnreadCount;
        setAccumulatedEmails(messagesData.emails);
      } else {
        setAccumulatedEmails(prev => {
          const existingIds = new Set(prev.map(e => e.id));
          const newEmails = messagesData.emails.filter(e => !existingIds.has(e.id));
          return [...prev, ...newEmails];
        });
      }
      setServerTotalCount(messagesData.totalCount || 0);
    }
  }, [messagesData, page]);

  const { data: tasksData, isLoading: tasksLoading, refetch: refetchTasks } = useQuery<Task[]>({
    queryKey: ["/api/tasks", user?.id],
    queryFn: () => fetch(`/api/tasks?assignedUserId=${user?.id}`).then(r => r.json()),
    enabled: !!user?.id,
  });

  const { data: chatsData, isLoading: chatsLoading, refetch: refetchChats } = useQuery<ChatConversation[]>({
    queryKey: ["/api/users", user?.id, "chat-conversations"],
    queryFn: async () => {
      const response = await fetch(`/api/users/${user?.id}/chat-messages`);
      const messages = await response.json();
      const conversations = new Map<string, ChatConversation>();
      for (const msg of (messages || [])) {
        const partnerId = msg.senderId === user?.id ? msg.receiverId : msg.senderId;
        const existing = conversations.get(partnerId);
        if (!existing || new Date(msg.createdAt) > new Date(existing.lastMessageAt)) {
          conversations.set(partnerId, {
            id: partnerId,
            participantId: partnerId,
            participantName: partnerId,
            lastMessage: msg.content,
            lastMessageAt: msg.createdAt,
            unreadCount: msg.senderId !== user?.id && !msg.isRead ? 1 : 0,
          });
        } else if (msg.senderId !== user?.id && !msg.isRead) {
          existing.unreadCount++;
        }
      }
      return Array.from(conversations.values());
    },
    enabled: !!user?.id,
  });

  const { data: smsData, isLoading: smsLoading, refetch: refetchSms } = useQuery<SmsMessage[]>({
    queryKey: ["/api/sms-messages"],
    queryFn: () => fetch("/api/sms-messages").then(r => r.json()),
    enabled: !!user?.id,
  });

  const getMailboxParam = (email?: string | null) => {
    if (!email) return effectiveMailbox;
    const mb = mailboxes.find(m => m.email === email);
    return mb?.type === "personal" ? "personal" : email;
  };

  const emailDetailMailbox = selectedEmail?._mailboxEmail
    ? getMailboxParam(selectedEmail._mailboxEmail)
    : effectiveMailbox;

  const { data: emailDetail, isLoading: detailLoading } = useQuery<EmailMessage>({
    queryKey: ["/api/users", user?.id, "ms365-email", selectedEmail?.id, emailDetailMailbox],
    queryFn: () => fetch(`/api/users/${user?.id}/ms365-email/${selectedEmail?.id}?mailbox=${emailDetailMailbox}`).then(r => r.json()),
    enabled: !!user?.id && !!selectedEmail?.id,
  });

  const { data: signatureData } = useQuery<EmailSignature>({
    queryKey: ["/api/users", user?.id, "email-signatures", effectiveMailbox],
    queryFn: () => fetch(`/api/users/${user?.id}/email-signatures/${effectiveMailbox}`).then(r => r.json()),
    enabled: !!user?.id && !!effectiveMailbox,
  });

  const { data: allSignatures = [] } = useQuery<EmailSignature[]>({
    queryKey: ["/api/users", user?.id, "email-signatures"],
    queryFn: () => fetch(`/api/users/${user?.id}/email-signatures`).then(r => r.json()),
    enabled: !!user?.id,
  });

  const currentMailboxEmail = selectedMailbox === "personal"
    ? mailboxes.find(m => m.type === "personal")?.email
    : selectedMailbox === "all"
      ? (selectedEmail?._mailboxEmail || mailboxes.find(m => m.type === "personal")?.email || null)
      : selectedMailbox;

  const { data: userTags = [] } = useQuery<any[]>({
    queryKey: ["/api/users", user?.id, "email-tags"],
    queryFn: () => fetch(`/api/users/${user?.id}/email-tags`).then(r => r.json()),
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (user?.id && userTags.length === 0 && !defaultTagsInitialized) {
      setDefaultTagsInitialized(true);
      fetch(`/api/users/${user.id}/email-tags/init-defaults`, { method: "POST", headers: { "Content-Type": "application/json" } })
        .then(r => r.json())
        .then(() => queryClient.invalidateQueries({ queryKey: ["/api/users", user.id, "email-tags"] }))
        .catch(() => {});
    }
  }, [user?.id, userTags.length, defaultTagsInitialized]);

  const { data: tagAssignments = [] } = useQuery<any[]>({
    queryKey: ["/api/users", user?.id, "email-tag-assignments", currentMailboxEmail],
    queryFn: () => fetch(`/api/users/${user?.id}/email-tag-assignments?mailbox=${encodeURIComponent(currentMailboxEmail!)}`).then(r => r.json()),
    enabled: !!user?.id && !!currentMailboxEmail,
  });

  const assignTagMutation = useMutation({
    mutationFn: async (data: { emailId: string; tagId: string; mailboxEmail: string }) => {
      return apiRequest("POST", `/api/users/${user?.id}/email-tag-assignments`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id, "email-tag-assignments"] });
    },
  });

  const removeTagMutation = useMutation({
    mutationFn: async (data: { emailId: string; tagId: string; mailboxEmail: string }) => {
      return apiRequest("DELETE", `/api/users/${user?.id}/email-tag-assignments`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id, "email-tag-assignments"] });
    },
  });

  const createTagMutation = useMutation({
    mutationFn: async (data: { name: string; color: string; icon?: string }) => {
      return apiRequest("POST", `/api/users/${user?.id}/email-tags`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id, "email-tags"] });
      toast({ title: "Tag vytvorený" });
    },
  });

  const deleteTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      return apiRequest("DELETE", `/api/users/${user?.id}/email-tags/${tagId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id, "email-tags"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id, "email-tag-assignments"] });
      toast({ title: "Tag zmazaný" });
    },
  });

  const updateTagMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; color?: string; icon?: string }) => {
      return apiRequest("PATCH", `/api/users/${user?.id}/email-tags/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id, "email-tags"] });
    },
  });

  const { data: mailboxColorsList = [] } = useQuery<any[]>({
    queryKey: ["/api/users", user?.id, "mailbox-colors"],
    queryFn: () => fetch(`/api/users/${user?.id}/mailbox-colors`).then(r => r.json()),
    enabled: !!user?.id,
  });

  const mailboxColorMap: Record<string, string> = {};
  mailboxColorsList.forEach((mc: any) => { mailboxColorMap[mc.mailboxEmail] = mc.color; });

  const sidebarMailboxes: AccountIconConfig[] = mailboxes
    .filter(mb => {
      const cfg = accountConfigs[mb.email];
      return cfg ? cfg.enabled !== false : true;
    })
    .map(mb => ({
      email: mb.email,
      displayName: mb.displayName || mb.email,
      icon: accountConfigs[mb.email]?.icon || "mail",
      color: accountConfigs[mb.email]?.color || mailboxColorMap[mb.email] || "#6B7280",
      type: mb.type,
      isDefault: mb.isDefault,
    }));

  const handleSidebarMailboxSelect = (mbKey: string) => {
    setSelectedMailbox(mbKey);
    setSelectedFolderId(null);
    setSelectedEmail(null);
    setPage(0);
    setAccumulatedEmails([]);
  };

  const getAccountTint = (emailAddr?: string | null): string | undefined => {
    if (!emailAddr) return undefined;
    const cfg = accountConfigs[emailAddr];
    const hex = cfg?.color || mailboxColorMap[emailAddr];
    if (!hex) return undefined;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, 0.06)`;
  };

  const upsertMailboxColorMutation = useMutation({
    mutationFn: async (data: { mailboxEmail: string; color: string }) => {
      return apiRequest("PUT", `/api/users/${user?.id}/mailbox-colors`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id, "mailbox-colors"] });
    },
  });

  const getEmailTags = (emailId: string) => {
    return tagAssignments.filter(a => a.emailId === emailId).map(a => a.tag);
  };

  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const { data: searchResults, isLoading: searchLoading } = useQuery<{ emails: EmailMessage[]; mailbox: string }[]>({
    queryKey: ["/api/users", user?.id, "ms365-search-emails", debouncedSearchQuery, searchMailbox, searchDateFrom, searchDateTo],
    queryFn: async () => {
      const hasQuery = debouncedSearchQuery && debouncedSearchQuery.trim().length >= 2;
      const hasDate = searchDateFrom || searchDateTo;
      if (!hasQuery && !hasDate) return [];
      const mailboxesToSearch = searchMailbox === "all"
        ? mailboxes.map(m => m.type === "personal" ? "personal" : m.email)
        : [searchMailbox];
      const results: { emails: EmailMessage[]; mailbox: string }[] = [];
      for (const mbx of mailboxesToSearch) {
        try {
          const params = new URLSearchParams();
          if (hasQuery) params.set("q", debouncedSearchQuery);
          params.set("mailbox", mbx);
          params.set("fetchAll", "true");
          if (searchDateFrom) params.set("dateFrom", searchDateFrom);
          if (searchDateTo) params.set("dateTo", searchDateTo);
          const response = await fetch(`/api/users/${user?.id}/ms365-search-emails?${params.toString()}`);
          const data = await response.json();
          const actualEmail = mbx === "personal" ? (mailboxes.find(m => m.type === "personal")?.email || mbx) : mbx;
          const taggedEmails = (data.emails || []).map((e: EmailMessage) => ({ ...e, _mailboxEmail: actualEmail }));
          results.push({
            emails: taggedEmails,
            mailbox: actualEmail
          });
        } catch {
          results.push({ emails: [], mailbox: mbx });
        }
      }
      return results;
    },
    enabled: !!user?.id && isSearching && (
      (!!debouncedSearchQuery && debouncedSearchQuery.trim().length >= 2) || !!searchDateFrom || !!searchDateTo
    ),
  });

  const handleSearch = () => {
    if (searchQuery.trim().length >= 2) {
      setDebouncedSearchQuery(searchQuery.trim());
      setIsSearching(true);
      setSelectedEmail(null);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setDebouncedSearchQuery("");
    setSearchDateFrom("");
    setSearchDateTo("");
    setIsSearching(false);
    setSearchPanelExpanded(false);
  };

  const sendEmailMutation = useMutation({
    mutationFn: async (data: { to: string[]; cc?: string[]; bcc?: string[]; subject: string; body: string; mailboxEmail: string; attachments?: Array<{ name: string; contentType: string; contentBytes: string }> }) => {
      startSendProgress();
      return apiRequest("POST", `/api/users/${user?.id}/ms365-send-email`, data);
    },
    onSuccess: () => {
      completeSendProgress(true);
      setComposeOpen(false);
      setComposeFullscreen(false);
      setComposeData({ to: "", cc: "", bcc: "", subject: "", body: "", importance: "normal", tagId: null, replyTo: "" });
      setAttachments([]);
      refetchMessages();
    },
    onError: () => {
      completeSendProgress(false);
      toast({ title: "Chyba", description: "Nepodarilo sa odoslať správu", variant: "destructive" });
    },
  });

  const replyMutation = useMutation({
    mutationFn: async (data: { emailId: string; body: string; replyAll: boolean; mailboxEmail: string; cc?: string[]; bcc?: string[]; attachments?: Array<{ name: string; contentType: string; contentBytes: string }> }) => {
      startSendProgress();
      return apiRequest("POST", `/api/users/${user?.id}/ms365-reply/${data.emailId}`, data);
    },
    onSuccess: () => {
      completeSendProgress(true);
      setReplyMode(null);
      setReplyFieldsExpanded(false);
      setReplyModalFullscreen(false);
      setComposeData({ to: "", cc: "", bcc: "", subject: "", body: "", importance: "normal", tagId: null, replyTo: "" });
      setAttachments([]);
      refetchMessages();
    },
    onError: () => {
      completeSendProgress(false);
      toast({ title: "Chyba", description: "Nepodarilo sa odoslať odpoveď", variant: "destructive" });
    },
  });

  const forwardMutation = useMutation({
    mutationFn: async (data: { emailId: string; to: string[]; body: string; mailboxEmail: string; cc?: string[]; bcc?: string[]; attachments?: Array<{ name: string; contentType: string; contentBytes: string }> }) => {
      startSendProgress();
      return apiRequest("POST", `/api/users/${user?.id}/ms365-forward/${data.emailId}`, data);
    },
    onSuccess: () => {
      completeSendProgress(true);
      setReplyMode(null);
      setReplyFieldsExpanded(false);
      setReplyModalFullscreen(false);
      setComposeData({ to: "", cc: "", bcc: "", subject: "", body: "", importance: "normal", tagId: null, replyTo: "" });
      setAttachments([]);
      refetchMessages();
    },
    onError: () => {
      completeSendProgress(false);
      toast({ title: "Chyba", description: "Nepodarilo sa preposlať správu", variant: "destructive" });
    },
  });

  const deleteEmailMutation = useMutation({
    mutationFn: async (emailId: string) => {
      return apiRequest("DELETE", `/api/users/${user?.id}/ms365-email/${emailId}?mailbox=${emailDetailMailbox}`);
    },
    onSuccess: () => {
      toast({ title: "Zmazané", description: "Správa bola odstránená" });
      setSelectedEmail(null);
      refetchMessages();
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa zmazať správu", variant: "destructive" });
    },
  });

  const toggleReadMutation = useMutation({
    mutationFn: async ({ emailId, isRead, mailbox }: { emailId: string; isRead: boolean; mailbox?: string }) => {
      const mb = mailbox || emailDetailMailbox;
      return apiRequest("PATCH", `/api/users/${user?.id}/ms365-email/${emailId}/read-status?mailbox=${mb}`, { isRead });
    },
    onSuccess: (_data, variables) => {
      toast({
        title: variables.isRead ? "Označené ako prečítané" : "Označené ako neprečítané",
      });
      setAccumulatedEmails(prev => prev.map(e =>
        e.id === variables.emailId ? { ...e, isRead: variables.isRead } : e
      ));
      if (selectedEmail?.id === variables.emailId) {
        setSelectedEmail(prev => prev ? { ...prev, isRead: variables.isRead } : null);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id, "ms365-email", variables.emailId] });
      refetchFolders();
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa zmeniť stav prečítania", variant: "destructive" });
    },
  });

  const saveSignatureMutation = useMutation({
    mutationFn: async (data: { htmlContent: string; isActive: boolean; mailboxEmail?: string }) => {
      const mbx = data.mailboxEmail || effectiveMailbox;
      return apiRequest("PUT", `/api/users/${user?.id}/email-signatures/${mbx}`, { htmlContent: data.htmlContent, isActive: data.isActive });
    },
    onSuccess: () => {
      toast({ title: "Uložené", description: "Podpis bol uložený" });
      queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id, "email-signatures"] });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa uložiť podpis", variant: "destructive" });
    },
  });

  const rawFolders = foldersData?.folders || [];
  const folders = (() => {
    if (selectedMailbox !== "all" || !allMailboxFoldersData) return rawFolders;
    const wkNameMap: Record<string, string> = {
      "Inbox": "inbox", "Doručená pošta": "inbox",
      "Sent Items": "sentitems", "Odoslané": "sentitems", "Odoslaná pošta": "sentitems",
      "Drafts": "drafts", "Koncepty": "drafts",
      "Junk Email": "junkemail", "Spam": "junkemail", "Nevyžiadaná pošta": "junkemail",
      "Deleted Items": "deleteditems", "Kôš": "deleteditems", "Odstránené položky": "deleteditems",
      "Archive": "archive", "Archív": "archive",
    };
    const getWK = (f: MailFolder) => f.wellKnownName || wkNameMap[f.displayName] || null;
    const otherMbFolders = Object.entries(allMailboxFoldersData).filter(([k]) => k !== "personal").flatMap(([, v]) => v);
    return rawFolders.map(f => {
      const wk = getWK(f);
      if (!wk) return f;
      let extraUnread = 0;
      let extraTotal = 0;
      for (const of2 of otherMbFolders) {
        const wk2 = getWK(of2);
        if (wk2 === wk) {
          extraUnread += of2.unreadItemCount || 0;
          extraTotal += of2.totalItemCount || 0;
        }
      }
      if (extraUnread === 0 && extraTotal === 0) return f;
      return { ...f, unreadItemCount: (f.unreadItemCount || 0) + extraUnread, totalItemCount: (f.totalItemCount || 0) + extraTotal };
    });
  })();
  const loadAllEmails = async () => {
    if (!user?.id || !selectedFolderId || loadingAll) return;
    setLoadingAll(true);
    try {
      let allEmails: EmailMessage[] = [...accumulatedEmails];
      let skip = allEmails.length;
      const batchSize = 500;
      while (skip < serverTotalCount) {
        const res = await fetch(`/api/users/${user.id}/ms365-folder-messages/${selectedFolderId}?mailbox=${effectiveMailbox}&top=${batchSize}&skip=${skip}`);
        const data = await res.json();
        if (!data.emails || data.emails.length === 0) break;
        const existingIds = new Set(allEmails.map(e => e.id));
        const newBatch = data.emails.filter((e: EmailMessage) => !existingIds.has(e.id));
        allEmails = [...allEmails, ...newBatch];
        skip += data.emails.length;
        setAccumulatedEmails([...allEmails]);
        setServerTotalCount(data.totalCount || allEmails.length);
      }
      toast({ title: `Načítaných ${allEmails.length} emailov` });
    } catch (error) {
      toast({ title: "Chyba pri načítaní", description: "Nepodarilo sa načítať všetky emaily", variant: "destructive" });
    } finally {
      setLoadingAll(false);
    }
  };

  const emails = accumulatedEmails;
  const totalCount = serverTotalCount;
  const totalUnreadEmails = folders.find(f => f.wellKnownName === "inbox" || f.displayName === "Inbox")?.unreadItemCount || 0;

  const smsInboundUnread = smsData?.filter(s => s.direction === "inbound" && s.deliveryStatus !== "read")?.length || 0;
  const pendingTasks = tasksData?.filter(t => t.status === "pending")?.length || 0;
  const unreadChats = chatsData?.reduce((acc, c) => acc + (c.unreadCount || 0), 0) || 0;

  const filteredSms = (smsData || []).filter(sms => {
    if (smsFilter === "inbound") return sms.direction === "inbound";
    if (smsFilter === "outbound") return sms.direction === "outbound";
    return true;
  });

  const filteredTasks = (tasksData || []).filter(task => {
    if (taskFilter === "all") return true;
    return task.status === taskFilter;
  });

  const currentFolderName = folders.find(f => f.id === selectedFolderId)?.displayName || "Email";

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);

  const filteredEmails = emails.filter(email => {
    if (emailFilters.unreadOnly && email.isRead) return false;
    if (emailFilters.hasAttachments && !email.hasAttachments) return false;
    if (emailFilters.important && email.importance !== "high") return false;
    if (emailFilters.today) {
      const d = new Date(email.receivedDateTime);
      if (d < todayStart) return false;
    }
    if (emailFilters.thisWeek) {
      const d = new Date(email.receivedDateTime);
      if (d < weekStart) return false;
    }
    if (listSearchQuery.trim()) {
      const q = listSearchQuery.toLowerCase();
      const matchSubject = (email.subject || "").toLowerCase().includes(q);
      const matchSender = (email.from?.emailAddress?.name || "").toLowerCase().includes(q) || (email.from?.emailAddress?.address || "").toLowerCase().includes(q);
      const matchPreview = (email.bodyPreview || "").toLowerCase().includes(q);
      if (!matchSubject && !matchSender && !matchPreview) return false;
    }
    if (filterByTagId) {
      const emailTags = getEmailTags(email.id);
      if (!emailTags.some((t: any) => t.id === filterByTagId)) return false;
    }
    return true;
  });

  const sortedFilteredEmails = [...filteredEmails].sort((a, b) => {
    switch (emailSort) {
      case "date-desc": return new Date(b.receivedDateTime).getTime() - new Date(a.receivedDateTime).getTime();
      case "date-asc": return new Date(a.receivedDateTime).getTime() - new Date(b.receivedDateTime).getTime();
      case "sender-asc": return (a.from?.emailAddress?.name || "").localeCompare(b.from?.emailAddress?.name || "");
      case "sender-desc": return (b.from?.emailAddress?.name || "").localeCompare(a.from?.emailAddress?.name || "");
      case "subject-asc": return (a.subject || "").localeCompare(b.subject || "");
      case "subject-desc": return (b.subject || "").localeCompare(a.subject || "");
      default: return 0;
    }
  });

  const emailsPage = sortedFilteredEmails.slice(localPage * localPageSize, (localPage + 1) * localPageSize);
  const totalEmailPages = Math.ceil(filteredEmails.length / localPageSize);

  const smsPage = filteredSms.slice(localPage * localPageSize, (localPage + 1) * localPageSize);
  const totalSmsPages = Math.ceil(filteredSms.length / localPageSize);

  const tasksPage = filteredTasks.slice(localPage * localPageSize, (localPage + 1) * localPageSize);
  const totalTaskPages = Math.ceil(filteredTasks.length / localPageSize);

  useEffect(() => {
    setLocalPage(0);
  }, [activeTab, selectedFolderId, smsFilter, taskFilter]);

  useEffect(() => {
    setSelectedEmail(null);
    setSelectedTask(null);
    _setSelectedChat(null);
    setSelectedChatId(null);
    setSelectedSms(null);
  }, [activeTab]);

  useEffect(() => {
    setReplyMode(null);
    setReplyFieldsExpanded(false);
    setDetailFullscreen(false);
    setComposeData(prev => ({ ...prev, to: "", cc: "", bcc: "", subject: "", body: "", replyTo: "" }));
  }, [selectedEmail?.id]);

  useEffect(() => {
    if (selectedChatId && chatsData) {
      const chat = chatsData.find(c => c.id === selectedChatId);
      _setSelectedChat(chat || null);
    } else {
      _setSelectedChat(null);
    }
  }, [selectedChatId, chatsData]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSmartSearchOpen(true);
        setTimeout(() => smartSearchInputRef.current?.focus(), 100);
      }
      if (e.key === "Escape" && smartSearchOpen) {
        setSmartSearchOpen(false);
      }
      if (e.key === "Escape" && !smartSearchOpen && nexusFullscreen) {
        setNexusFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [smartSearchOpen, activeTab, nexusFullscreen]);

  const getSmartSuggestions = () => {
    const suggestions: { label: string; query: string; icon: string; type: "sender" | "domain" | "subject" | "date" | "recent" | "attachment" }[] = [];

    if (selectedEmail) {
      const senderEmail = selectedEmail.from?.emailAddress?.address || "";
      const senderName = selectedEmail.from?.emailAddress?.name || "";
      const domain = senderEmail.split("@")[1] || "";
      const subject = selectedEmail.subject || "";

      if (senderEmail) {
        suggestions.push({ label: `Emaily od ${senderName || senderEmail}`, query: `from:${senderEmail}`, icon: "user", type: "sender" });
      }
      if (domain && !["gmail.com", "outlook.com", "hotmail.com", "yahoo.com"].includes(domain)) {
        suggestions.push({ label: `Emaily z domény @${domain}`, query: domain, icon: "globe", type: "domain" });
      }
      if (subject) {
        const cleanSubject = subject.replace(/^(Re|Fwd|Odp|FW|RE|Fw):\s*/gi, "").trim();
        if (cleanSubject.length > 3) {
          suggestions.push({ label: `Konverzácia: "${cleanSubject.substring(0, 40)}${cleanSubject.length > 40 ? "..." : ""}"`, query: cleanSubject, icon: "message", type: "subject" });
        }
        const keywords = cleanSubject.split(/\s+/).filter(w => w.length > 4);
        if (keywords.length > 0) {
          const kw = keywords[0];
          suggestions.push({ label: `Hľadať "${kw}"`, query: kw, icon: "tag", type: "subject" });
        }
      }
      if (selectedEmail.hasAttachments) {
        suggestions.push({ label: "Emaily s prílohami od tohto odosielateľa", query: `from:${senderEmail} hasAttachments:true`, icon: "paperclip", type: "attachment" });
      }
    }

    suggestions.push({ label: "Emaily s prílohami", query: "hasAttachments:true", icon: "paperclip", type: "attachment" });
    suggestions.push({ label: "Dôležité emaily", query: "importance:high", icon: "flame", type: "date" });

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const weekAgo = new Date(today.getTime() - 7 * 86400000).toISOString().split("T")[0];
    const monthAgo = new Date(today.getTime() - 30 * 86400000).toISOString().split("T")[0];
    suggestions.push({ label: `Dnešné emaily (${todayStr})`, query: `__date:${todayStr}:${todayStr}`, icon: "calendar", type: "date" });
    suggestions.push({ label: "Emaily za posledný týždeň", query: `__date:${weekAgo}:${todayStr}`, icon: "calendar", type: "date" });
    suggestions.push({ label: "Emaily za posledný mesiac", query: `__date:${monthAgo}:${todayStr}`, icon: "calendar", type: "date" });

    return suggestions;
  };

  const addRecentSearch = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return;
    setRecentSearches(prev => {
      const updated = [trimmed, ...prev.filter(s => s !== trimmed)].slice(0, 10);
      localStorage.setItem("nexus-recent-searches", JSON.stringify(updated));
      return updated;
    });
  };

  const executeSmartSearch = (query: string, mailboxOverride?: string, dateFromOverride?: string, dateToOverride?: string) => {
    let trimmed = query.trim();
    let df = dateFromOverride !== undefined ? dateFromOverride : searchDateFrom;
    let dt = dateToOverride !== undefined ? dateToOverride : searchDateTo;

    const dateMatch = trimmed.match(/^__date:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/);
    if (dateMatch) {
      df = dateMatch[1];
      dt = dateMatch[2];
      trimmed = "";
    }

    const hasDate = df || dt;
    if ((!trimmed || trimmed.length < 2) && !hasDate) return;
    if (trimmed && trimmed.length >= 2) addRecentSearch(trimmed);
    setSearchQuery(trimmed);
    setDebouncedSearchQuery(trimmed);
    setSearchDateFrom(df);
    setSearchDateTo(dt);
    setSearchMailbox(mailboxOverride || smartSearchMailbox);
    setIsSearching(true);
    setSelectedEmail(null);
    setSmartSearchOpen(false);
    setSmartSearchQuery("");
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem("nexus-recent-searches");
  };

  const highlightSearchMatch = (text: string, query: string) => {
    if (!query || query.length < 2 || !text) return text;
    const cleanQuery = query.replace(/^(from:|hasAttachments:|importance:)\S*\s*/gi, "").trim();
    if (!cleanQuery || cleanQuery.length < 2) return text;
    try {
      const escaped = cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const parts = text.split(new RegExp(`(${escaped})`, "gi"));
      if (parts.length === 1) return text;
      return parts.map((part, i) =>
        part.toLowerCase() === cleanQuery.toLowerCase()
          ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 text-foreground rounded-sm px-0.5">{part}</mark>
          : part
      );
    } catch {
      return text;
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments(prev => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const downloadAttachment = (emailId: string, attachmentId: string, fileName: string) => {
    const mailbox = emailDetailMailbox;
    const url = `/api/users/${user?.id}/ms365-email/${emailId}/attachments/${attachmentId}?mailbox=${encodeURIComponent(mailbox)}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
  };

  const processHtmlForImages = (html: string, emailId: string, attachmentsList?: any[]) => {
    if (!html) return html;
    let processed = html;
    if (attachmentsList && attachmentsList.length > 0) {
      const mailbox = emailDetailMailbox;
      const inlineAtts = attachmentsList.filter(a => a.isInline);
      inlineAtts.forEach(att => {
        const inlineUrl = `/api/users/${user?.id}/ms365-email/${emailId}/attachment-inline/${att.id}?mailbox=${encodeURIComponent(mailbox)}`;
        if (att.contentId) {
          const cidEscaped = att.contentId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const cidPattern = new RegExp(`src=["']cid:${cidEscaped}["']`, 'gi');
          processed = processed.replace(cidPattern, `src="${inlineUrl}"`);
        }
        const nameEscaped = att.name?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') || '';
        if (nameEscaped) {
          const cidNamePattern = new RegExp(`src=["']cid:${nameEscaped}["']`, 'gi');
          processed = processed.replace(cidNamePattern, `src="${inlineUrl}"`);
        }
      });
    }
    return processed;
  };

  const knownEmails = (() => {
    const map = new Map<string, { name?: string; address: string }>();
    accumulatedEmails.forEach(email => {
      const addr = email.from?.emailAddress?.address;
      if (addr && !map.has(addr.toLowerCase())) {
        map.set(addr.toLowerCase(), { name: email.from?.emailAddress?.name || undefined, address: addr });
      }
      email.toRecipients?.forEach((r: any) => {
        const a = r.emailAddress?.address;
        if (a && !map.has(a.toLowerCase())) {
          map.set(a.toLowerCase(), { name: r.emailAddress?.name || undefined, address: a });
        }
      });
      email.ccRecipients?.forEach((r: any) => {
        const a = r.emailAddress?.address;
        if (a && !map.has(a.toLowerCase())) {
          map.set(a.toLowerCase(), { name: r.emailAddress?.name || undefined, address: a });
        }
      });
    });
    return Array.from(map.values());
  })();

  const getSignatureForCompose = (forMailbox?: string) => {
    const mbx = forMailbox || effectiveMailbox;
    const sig = allSignatures.find((s: EmailSignature) => s.mailboxEmail === mbx);
    if (sig?.isActive && sig?.htmlContent) {
      return sig.htmlContent;
    }
    if (signatureData?.isActive && signatureData?.htmlContent) {
      return signatureData.htmlContent;
    }
    return undefined;
  };

  const handleSendEmail = async () => {
    const toList = composeData.to.split(",").map(e => e.trim()).filter(Boolean);
    const ccList = composeData.cc ? composeData.cc.split(",").map(e => e.trim()).filter(Boolean) : [];
    const bccList = composeData.bcc ? composeData.bcc.split(",").map(e => e.trim()).filter(Boolean) : [];
    if (toList.length === 0) {
      toast({ title: "Chyba", description: "Zadajte príjemcu", variant: "destructive" });
      return;
    }
    const attData = attachments.length > 0 ? await filesToBase64(attachments) : undefined;
    sendEmailMutation.mutate({
      to: toList, cc: ccList, bcc: bccList,
      subject: composeData.subject, body: composeData.body,
      mailboxEmail: effectiveMailbox,
      importance: composeData.importance !== "normal" ? composeData.importance : undefined,
      attachments: attData,
    } as any);
  };

  const getMyMailboxEmails = () => {
    return mailboxes.map(m => m.email?.toLowerCase()).filter(Boolean) as string[];
  };

  const setupReplyCompose = (mode: "reply" | "replyAll" | "forward", detail: any) => {
    setReplyFieldsExpanded(false);
    setAttachments([]);
    const myEmails = getMyMailboxEmails();

    if (mode === "reply") {
      setComposeData({
        to: detail.from?.emailAddress?.address || "",
        cc: "", bcc: "",
        subject: `Re: ${(detail.subject || "").replace(/^Re:\s*/i, "")}`,
        body: "", importance: "normal", tagId: null, replyTo: "",
      });
    } else if (mode === "replyAll") {
      const allTo = [
        detail.from?.emailAddress?.address,
        ...(detail.toRecipients?.map((r: any) => r.emailAddress?.address) || []),
      ].filter(Boolean).map((e: string) => e.toLowerCase());
      const deduped = [...new Set(allTo)].filter(e => !myEmails.includes(e));
      const ccAll = (detail.ccRecipients?.map((r: any) => r.emailAddress?.address) || [])
        .filter(Boolean).map((e: string) => e.toLowerCase());
      const ccDeduped = [...new Set(ccAll)].filter(e => !myEmails.includes(e) && !deduped.includes(e));
      setComposeData({
        to: deduped.join(", "),
        cc: ccDeduped.join(", "),
        bcc: "",
        subject: `Re: ${(detail.subject || "").replace(/^Re:\s*/i, "")}`,
        body: "", importance: "normal", tagId: null, replyTo: "",
      });
    } else {
      setComposeData({
        to: "", cc: "", bcc: "",
        subject: `Fwd: ${(detail.subject || "").replace(/^Fwd:\s*/i, "")}`,
        body: "", importance: "normal", tagId: null, replyTo: "",
      });
    }
    setReplyMode(mode);
  };

  const filesToBase64 = async (files: File[]): Promise<Array<{ name: string; contentType: string; contentBytes: string }>> => {
    const results = [];
    for (const file of files) {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      results.push({ name: file.name, contentType: file.type || "application/octet-stream", contentBytes: base64 });
    }
    return results;
  };

  const handleReply = async () => {
    if (!selectedEmail) return;
    const ccList = composeData.cc.split(",").map(e => e.trim()).filter(Boolean);
    const bccList = composeData.bcc.split(",").map(e => e.trim()).filter(Boolean);
    const attData = attachments.length > 0 ? await filesToBase64(attachments) : undefined;
    replyMutation.mutate({
      emailId: selectedEmail.id, body: composeData.body,
      replyAll: replyMode === "replyAll", mailboxEmail: emailDetailMailbox,
      cc: ccList.length > 0 ? ccList : undefined,
      bcc: bccList.length > 0 ? bccList : undefined,
      attachments: attData,
    });
  };

  const handleForward = async () => {
    if (!selectedEmail) return;
    const toList = composeData.to.split(",").map(e => e.trim()).filter(Boolean);
    if (toList.length === 0) {
      toast({ title: "Chyba", description: "Zadajte príjemcu", variant: "destructive" });
      return;
    }
    const ccList = composeData.cc.split(",").map(e => e.trim()).filter(Boolean);
    const bccList = composeData.bcc.split(",").map(e => e.trim()).filter(Boolean);
    const attData = attachments.length > 0 ? await filesToBase64(attachments) : undefined;
    forwardMutation.mutate({
      emailId: selectedEmail.id, to: toList,
      body: composeData.body, mailboxEmail: emailDetailMailbox,
      cc: ccList.length > 0 ? ccList : undefined,
      bcc: bccList.length > 0 ? bccList : undefined,
      attachments: attData,
    });
  };

  const getAiLanguage = () => {
    if (emailPrefs.aiLanguageMode === "user") return emailPrefs.aiUserLanguage || "sk";
    return "auto";
  };

  const handleAiSuggestReply = async () => {
    if (!selectedEmail || !emailDetail || !emailPrefs.aiEnabled) return;
    setAiSuggestLoading(true);
    try {
      const lang = getAiLanguage();
      const res = await apiRequest("POST", `/api/users/${user?.id}/ms365-ai-suggest-reply`, {
        emailSubject: emailDetail.subject || "",
        emailBody: emailDetail.body?.content || emailDetail.bodyPreview || "",
        emailFrom: emailDetail.from?.emailAddress?.name || emailDetail.from?.emailAddress?.address || "",
        language: lang,
      });
      const data = await res.json();
      if (data.suggestion) {
        setAiModalContent(data.suggestion);
        setAiModalType("reply");
        setAiModalOpen(true);
      }
    } catch (err) {
      toast({ title: "Chyba", description: "Nepodarilo sa vygenerovať AI návrh", variant: "destructive" });
    } finally {
      setAiSuggestLoading(false);
    }
  };

  const handleAiSummary = async () => {
    if (!selectedEmail || !emailDetail || !emailPrefs.aiEnabled) return;
    setAiSummaryLoading(true);
    try {
      const lang = getAiLanguage();
      const res = await apiRequest("POST", `/api/users/${user?.id}/ms365-ai-summary`, {
        emailSubject: emailDetail.subject || "",
        emailBody: emailDetail.body?.content || emailDetail.bodyPreview || "",
        emailFrom: emailDetail.from?.emailAddress?.name || emailDetail.from?.emailAddress?.address || "",
        language: lang,
      });
      const data = await res.json();
      if (data.summary) {
        setAiModalContent(data.summary);
        setAiModalType("summary");
        setAiModalOpen(true);
      }
    } catch (err) {
      toast({ title: "Chyba", description: "Nepodarilo sa vygenerovať zhrnutie", variant: "destructive" });
    } finally {
      setAiSummaryLoading(false);
    }
  };

  const handleAiModalInsert = () => {
    const signatureForMailbox = getSignatureForCompose();
    const sigBlock = signatureForMailbox
      ? '<p><br></p><p><br></p><p><br></p><div class="email-signature">' + signatureForMailbox + '</div>'
      : '';
    const newBody = aiModalContent + sigBlock;
    aiInsertBodyRef.current = newBody;
    setAiSuggestCounter(prev => prev + 1);
    setReplyMode(prev => prev || "reply");
    setAiModalOpen(false);
  };

  const handleAiTranslate = async (targetLang: string) => {
    if (!aiModalContent || aiTranslating) return;
    setAiTranslating(true);
    try {
      const res = await apiRequest("POST", `/api/users/${user?.id}/ms365-ai-translate`, {
        content: aiModalContent,
        targetLanguage: targetLang,
      });
      const data = await res.json();
      if (data.translated) {
        setAiModalContent(data.translated);
        setAiTranslationKey(prev => prev + 1);
      }
    } catch {
      toast({ title: "Chyba", description: "Nepodarilo sa preložiť obsah", variant: "destructive" });
    } finally {
      setAiTranslating(false);
    }
  };

  const AI_LANGUAGES = [
    { code: "sk", label: "Slovenčina" },
    { code: "cs", label: "Čeština" },
    { code: "en", label: "English" },
    { code: "de", label: "Deutsch" },
    { code: "hu", label: "Magyar" },
    { code: "ro", label: "Română" },
    { code: "pl", label: "Polski" },
    { code: "it", label: "Italiano" },
    { code: "fr", label: "Français" },
    { code: "es", label: "Español" },
  ];

  const playSound = (type: "send" | "receive") => {
    try {
      const ctx = new AudioContext();
      if (type === "send") {
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(880, ctx.currentTime);
        osc1.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.1);
        gain1.gain.setValueAtTime(0.15, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 0.3);
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(1320, ctx.currentTime + 0.1);
        osc2.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.2);
        gain2.gain.setValueAtTime(0, ctx.currentTime);
        gain2.gain.setValueAtTime(0.12, ctx.currentTime + 0.1);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(ctx.currentTime + 0.1);
        osc2.stop(ctx.currentTime + 0.4);
      } else {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(587, ctx.currentTime);
        osc.frequency.setValueAtTime(784, ctx.currentTime + 0.15);
        osc.frequency.setValueAtTime(1047, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
      }
    } catch {}
  };

  const startSendProgress = () => {
    if (sendHideTimeoutRef.current) {
      clearTimeout(sendHideTimeoutRef.current);
      sendHideTimeoutRef.current = null;
    }
    setSendProgress({ active: true, progress: 0, status: "sending" });
    let p = 0;
    if (sendProgressTimerRef.current) clearInterval(sendProgressTimerRef.current);
    sendProgressTimerRef.current = setInterval(() => {
      p += Math.random() * 15 + 5;
      if (p >= 90) p = 90;
      setSendProgress(prev => ({ ...prev, progress: p }));
    }, 200);
  };

  const completeSendProgress = (success: boolean) => {
    if (sendProgressTimerRef.current) {
      clearInterval(sendProgressTimerRef.current);
      sendProgressTimerRef.current = null;
    }
    if (sendHideTimeoutRef.current) {
      clearTimeout(sendHideTimeoutRef.current);
      sendHideTimeoutRef.current = null;
    }
    setSendProgress({ active: true, progress: 100, status: success ? "done" : "error" });
    if (success && emailPrefs.soundOnSend) playSound("send");
    sendHideTimeoutRef.current = setTimeout(() => {
      setSendProgress({ active: false, progress: 0, status: "sending" });
      sendHideTimeoutRef.current = null;
    }, success ? 2000 : 3000);
  };

  const openSignatureEditor = () => {
    const mbxKey = effectiveMailbox || (mailboxes[0]?.type === "personal" ? "personal" : mailboxes[0]?.email) || "";
    const sig = allSignatures.find((s: EmailSignature) => s.mailboxEmail === mbxKey);
    setSignatureHtml(sig?.htmlContent || signatureData?.htmlContent || "");
    setSignatureActive(sig?.isActive !== false);
    setSigEditMailbox(mbxKey);
    setSettingsTab("compose");
    setSignatureDialogOpen(true);
  };

  const handleRefresh = () => {
    if (activeTab === "email") {
      setPage(0);
      setAccumulatedEmails([]);
      refetchFolders();
      refetchMessages();
    } else if (activeTab === "sms") {
      refetchSms();
    } else if (activeTab === "tasks") {
      refetchTasks();
    } else if (activeTab === "chats") {
      refetchChats();
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-96">
        <AlertCircle className="h-8 w-8 text-muted-foreground mr-2" />
        <span>{t.nexusOmni.loginRequired}</span>
      </div>
    );
  }

  if (mailboxes.length === 0 && !mailboxesLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <Network className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t.nexusOmni.connectMs365}</h1>
            <p className="text-muted-foreground">{t.nexusOmni.connectMs365Desc}</p>
          </div>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mail className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">{t.nexusOmni.teams.notConnected}</p>
            <p className="text-muted-foreground mb-4">{t.nexusOmni.connectMs365Desc}</p>
            <Button onClick={() => window.location.href = "/ms365"} data-testid="button-connect-ms365">
              {t.nexusOmni.connectMs365}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tabConfig: { key: NexusTab; label: string; icon: React.ReactNode; badge?: number; badgeColor?: string }[] = [
    { key: "email", label: t.nexusOmni.tabs.email, icon: <Mail className="h-4 w-4" />, badge: totalUnreadEmails > 0 ? totalUnreadEmails : undefined, badgeColor: "bg-blue-500" },
    { key: "sms", label: t.nexusOmni.tabs.sms, icon: <MessageSquare className="h-4 w-4" />, badge: smsInboundUnread > 0 ? smsInboundUnread : undefined, badgeColor: "bg-cyan-500" },
    { key: "tasks", label: t.nexusOmni.tabs.tasks, icon: <ListTodo className="h-4 w-4" />, badge: pendingTasks > 0 ? pendingTasks : undefined, badgeColor: "bg-amber-500" },
    { key: "chats", label: t.nexusOmni.tabs.chats, icon: <MessagesSquare className="h-4 w-4" />, badge: unreadChats > 0 ? unreadChats : undefined, badgeColor: "bg-violet-500" },
    { key: "teams", label: t.nexusOmni.tabs.teams, icon: <MessagesSquare className="h-4 w-4" />, badgeColor: "bg-indigo-500" },
  ];

  return (
    <div className={cn(
      nexusFullscreen
        ? "fixed inset-0 z-50 bg-background flex flex-col p-3 pt-1 gap-2 overflow-hidden"
        : "space-y-3 mt-1"
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg",
            nexusFullscreen ? "h-8 w-8" : "h-10 w-10"
          )}>
            <Network className={nexusFullscreen ? "h-4 w-4 text-primary-foreground" : "h-5 w-5 text-primary-foreground"} />
          </div>
          <div>
            <h1 className={nexusFullscreen ? "text-lg font-bold tracking-tight" : "text-2xl font-bold tracking-tight"}>{t.nexusOmni.title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setSmartSearchOpen(true); setTimeout(() => smartSearchInputRef.current?.focus(), 100); }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground transition-all text-sm cursor-pointer"
            data-testid="button-smart-search"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{t.nexusOmni.search.searchInEmails}...</span>
            <kbd className="hidden md:inline-flex items-center gap-0.5 rounded border bg-muted px-1.5 text-[10px] font-mono text-muted-foreground">
              Ctrl K
            </kbd>
          </button>
          {activeTab === "email" && (
            <Button variant="outline" size="icon" onClick={openSignatureEditor} data-testid="button-signature">
              <Settings className="h-4 w-4" />
            </Button>
          )}
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setNexusFullscreen(prev => !prev)}
                  data-testid="button-nexus-fullscreen"
                >
                  {nexusFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">{nexusFullscreen ? t.nexusOmni.exitFullscreen : t.nexusOmni.fullscreen}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {activeTab === "email" && (
            <Button onClick={() => { setComposeOpen(true); setReplyMode(null); setComposeData({ to: "", cc: "", bcc: "", subject: "", body: "", importance: "normal", tagId: null, replyTo: "" }); setAttachments([]); }} data-testid="button-compose">
              <PenSquare className="h-4 w-4 mr-2" />
              Nová správa
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border" data-testid="nexus-tabs">
        {tabConfig.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === tab.key
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            }`}
            data-testid={`tab-${tab.key}`}
          >
            <span className={activeTab === tab.key ? typeColors[tab.key].accent : ""}>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <Badge className={`${tab.badgeColor} text-white text-[10px] h-5 min-w-[20px] px-1.5`}>
                {tab.badge}
              </Badge>
            )}
          </button>
        ))}
      </div>

      <div className={cn("flex gap-2 transition-all duration-300", nexusFullscreen ? "flex-1 min-h-0" : "h-[calc(100vh-230px)]")}>
        <NexusSidebar
          activeTab={activeTab}
          selectedFolderId={selectedFolderId}
          onSelectFolder={handleSelectFolder}
          folders={folders}
          foldersLoading={foldersLoading}
          smsFilter={smsFilter}
          onSmsFilterChange={setSmsFilter}
          taskFilter={taskFilter}
          onTaskFilterChange={setTaskFilter}
          smsData={smsData}
          tasksData={tasksData}
          chatsData={chatsData}
          totalUnreadEmails={totalUnreadEmails}
          selectedChatId={selectedChatId}
          onSelectChat={setSelectedChatId}
          collapsed={isSidebarHidden}
          onToggleCollapse={() => setIsSidebarHidden(prev => !prev)}
          mailboxes={sidebarMailboxes}
          selectedMailbox={selectedMailbox}
          onSelectMailbox={handleSidebarMailboxSelect}
        />

        {activeTab === "email" && (
          <>
            <Card className={cn("transition-all duration-300 shrink-0 overflow-hidden",
              (isSearching && searchPanelExpanded) || (!isSearching && listPanelExpanded)
                ? "flex-1 min-w-[400px]"
                : "w-[30%] min-w-[320px] max-w-[420px]"
            )}>
              <CardHeader className="py-1.5 px-3 space-y-0 border-b">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-semibold">{isSearching ? `Výsledky: ${debouncedSearchQuery ? `"${debouncedSearchQuery}"` : ""}${(searchDateFrom || searchDateTo) ? ` ${searchDateFrom || "..."} — ${searchDateTo || "..."}` : ""}`.trim() : currentFolderName}</span>
                    {!isSearching && (
                      <Badge variant="secondary" className="text-[10px]">
                        {activeFilterCount > 0 ? `${filteredEmails.length}/${emails.length}` : emails.length}
                      </Badge>
                    )}
                    {isSearching && searchResults && (
                      <Badge variant="secondary" className="text-[10px]">{searchResults.reduce((acc, r) => acc + r.emails.length, 0)}</Badge>
                    )}
                    {isSearching && (
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={clearSearch}
                              className="p-1 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                              data-testid="button-clear-search"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs">Zrušiť vyhľadávanie</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  {isSearching && (
                    <div className="flex items-center gap-0.5">
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => setSearchPanelExpanded(prev => !prev)}
                              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all"
                              data-testid="button-expand-search"
                            >
                              {searchPanelExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs">{searchPanelExpanded ? "Zmenšiť panel" : "Maximalizovať panel"}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  )}
                  {!isSearching && (
                    <div className="flex items-center gap-0.5">
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => setListPanelExpanded(prev => !prev)}
                              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all"
                              data-testid="button-expand-list"
                            >
                              {listPanelExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs">{listPanelExpanded ? "Zmenšiť panel" : "Maximalizovať panel"}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Button variant="ghost" size="icon" className="h-6 w-6" disabled={localPage === 0} onClick={() => setLocalPage(p => p - 1)} data-testid="button-page-prev">
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      <span className="text-[10px] min-w-[36px] text-center text-muted-foreground tabular-nums">{totalEmailPages > 0 ? `${localPage + 1}/${totalEmailPages}` : "0/0"}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" disabled={localPage >= totalEmailPages - 1} onClick={() => setLocalPage(p => p + 1)} data-testid="button-page-next">
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
                {!isSearching && (
                  <TooltipProvider delayDuration={200}>
                    <div className="flex items-center gap-0.5 pt-1 border-t mt-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => { setListSearchOpen(!listSearchOpen); if (listSearchOpen) { setListSearchQuery(""); } }}
                            className={`p-1.5 rounded-md transition-all ${listSearchOpen ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"}`}
                            data-testid="filter-search"
                          >
                            <Search className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">Hľadať v zozname</TooltipContent>
                      </Tooltip>
                      <DropdownMenu>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                              <button
                                className={`p-1.5 rounded-md transition-all ${emailSort !== "date-desc" ? "bg-violet-100 dark:bg-violet-900/40 text-violet-600" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"}`}
                                data-testid="filter-sort"
                              >
                                <ArrowUpDown className="h-3.5 w-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs">Radenie</TooltipContent>
                        </Tooltip>
                        <DropdownMenuContent align="start" className="w-48">
                          <DropdownMenuItem onClick={() => setEmailSort("date-desc")} className={emailSort === "date-desc" ? "bg-accent" : ""}>
                            <ArrowDown className="h-3.5 w-3.5 mr-2" />Dátum (najnovšie)
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEmailSort("date-asc")} className={emailSort === "date-asc" ? "bg-accent" : ""}>
                            <ArrowUp className="h-3.5 w-3.5 mr-2" />Dátum (najstaršie)
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setEmailSort("sender-asc")} className={emailSort === "sender-asc" ? "bg-accent" : ""}>
                            <ArrowUpAZ className="h-3.5 w-3.5 mr-2" />Odosielateľ (A→Z)
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEmailSort("sender-desc")} className={emailSort === "sender-desc" ? "bg-accent" : ""}>
                            <ArrowDownAZ className="h-3.5 w-3.5 mr-2" />Odosielateľ (Z→A)
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setEmailSort("subject-asc")} className={emailSort === "subject-asc" ? "bg-accent" : ""}>
                            <ArrowUpAZ className="h-3.5 w-3.5 mr-2" />Predmet (A→Z)
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEmailSort("subject-desc")} className={emailSort === "subject-desc" ? "bg-accent" : ""}>
                            <ArrowDownAZ className="h-3.5 w-3.5 mr-2" />Predmet (Z→A)
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <div className="w-px h-4 bg-border mx-0.5" />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => toggleEmailFilter("unreadOnly")}
                            className={`p-1.5 rounded-md transition-all ${emailFilters.unreadOnly ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"}`}
                            data-testid="filter-unread"
                          >
                            <MailOpen className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">Neprečítané</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => toggleEmailFilter("hasAttachments")}
                            className={`p-1.5 rounded-md transition-all ${emailFilters.hasAttachments ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"}`}
                            data-testid="filter-attachments"
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">S prílohami</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => toggleEmailFilter("important")}
                            className={`p-1.5 rounded-md transition-all ${emailFilters.important ? "bg-amber-100 dark:bg-amber-900/40 text-amber-600" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"}`}
                            data-testid="filter-important"
                          >
                            <Star className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">Dôležité</TooltipContent>
                      </Tooltip>
                      <div className="w-px h-4 bg-border mx-0.5" />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => toggleEmailFilter("today")}
                            className={`p-1.5 rounded-md transition-all ${emailFilters.today ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"}`}
                            data-testid="filter-today"
                          >
                            <CalendarDays className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">Dnes</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => toggleEmailFilter("thisWeek")}
                            className={`p-1.5 rounded-md transition-all ${emailFilters.thisWeek ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"}`}
                            data-testid="filter-this-week"
                          >
                            <CalendarRange className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">Tento týždeň</TooltipContent>
                      </Tooltip>
                      <div className="w-px h-4 bg-border mx-0.5" />
                      <DropdownMenu>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                              <button
                                className={`p-1.5 rounded-md transition-all ${filterByTagId ? "bg-purple-100 dark:bg-purple-900/40 text-purple-600" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"}`}
                                data-testid="filter-tag"
                              >
                                <Tag className="h-3.5 w-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs">Filtrovať podľa tagu</TooltipContent>
                        </Tooltip>
                        <DropdownMenuContent align="start" className="w-44">
                          <DropdownMenuItem onClick={() => setFilterByTagId(null)} className={!filterByTagId ? "bg-accent" : ""}>
                            <Tag className="h-3.5 w-3.5 mr-2" />Všetky
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {userTags.map((tag: any) => (
                            <DropdownMenuItem key={tag.id} onClick={() => setFilterByTagId(tag.id)} className={filterByTagId === tag.id ? "bg-accent" : ""}>
                              <span className="h-2.5 w-2.5 rounded-full mr-2 shrink-0" style={{ backgroundColor: tag.color }} />
                              {tag.name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {(activeFilterCount > 0 || filterByTagId || listSearchQuery || emailSort !== "date-desc") && (
                        <>
                          <div className="w-px h-4 bg-border mx-0.5" />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => { setEmailFilters({ unreadOnly: false, hasAttachments: false, important: false, today: false, thisWeek: false }); setFilterByTagId(null); setListSearchQuery(""); setListSearchOpen(false); setEmailSort("date-desc"); }}
                                className="p-1.5 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
                                data-testid="filter-clear"
                              >
                                <FilterX className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">Zrušiť všetko</TooltipContent>
                          </Tooltip>
                        </>
                      )}
                    </div>
                  </TooltipProvider>
                )}
                {listSearchOpen && !isSearching && (
                  <div className="px-2 pb-1.5 pt-1 border-t">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Hľadať v zozname..."
                        value={listSearchQuery}
                        onChange={(e) => { setListSearchQuery(e.target.value); setLocalPage(0); }}
                        className="h-7 text-xs pl-7 pr-7"
                        autoFocus
                        data-testid="input-list-search"
                      />
                      {listSearchQuery && (
                        <button onClick={() => setListSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {isSearching ? (
                  searchLoading ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
                  ) : !searchResults || searchResults.every(r => r.emails.length === 0) ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Search className="h-8 w-8 mb-2 opacity-50" />
                      <span className="text-sm">Žiadne výsledky pre "{debouncedSearchQuery}"</span>
                    </div>
                  ) : (
                    <ScrollArea className={nexusFullscreen ? "h-[calc(100vh-180px)]" : "h-[calc(100vh-380px)]"}>
                      <div className="divide-y">
                        {searchResults.map((result) => (
                          result.emails.length > 0 && (
                            <div key={result.mailbox}>
                              {searchResults.length > 1 && (
                                <div className="px-3 py-1 bg-muted/50 border-b flex items-center gap-1.5">
                                  {(() => {
                                    const hdrColor = accountConfigs[result.mailbox]?.color || mailboxColorMap[result.mailbox] || undefined;
                                    return hdrColor ? <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: hdrColor }} /> : null;
                                  })()}
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{result.mailbox}</span>
                                </div>
                              )}
                              {result.emails.map(email => {
                                const srTintBg = email._mailboxEmail ? getAccountTint(email._mailboxEmail) : undefined;
                                const srAcctColor = email._mailboxEmail
                                  ? (accountConfigs[email._mailboxEmail]?.color || mailboxColorMap[email._mailboxEmail] || "#6B7280")
                                  : null;
                                return (
                                <div
                                  key={email.id}
                                  className={`relative group w-full text-left px-3 py-2.5 transition-all hover:bg-accent/50 cursor-pointer overflow-hidden ${
                                    selectedEmail?.id === email.id ? "bg-accent" : ""
                                  } ${!email.isRead ? "font-medium" : ""}`}
                                  onClick={() => setSelectedEmail(email)}
                                  onDoubleClick={() => { setSelectedEmail(email); setModalEmail(email); }}
                                  data-testid={`search-email-item-${email.id}`}
                                  style={srTintBg && selectedEmail?.id !== email.id ? { backgroundColor: srTintBg } : undefined}
                                >
                                  {srAcctColor && (
                                    <span className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-sm" style={{ backgroundColor: srAcctColor }} />
                                  )}
                                  <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", overflow: "hidden", width: "100%" }}>
                                    {emailPrefs.unreadIndicator && (
                                      <span className={`${!email.isRead ? "bg-blue-500" : "bg-transparent"}`} style={{ height: 8, width: 8, borderRadius: "50%", marginTop: 6, flexShrink: 0 }} />
                                    )}
                                    {emailPrefs.showSenderInitials && (
                                      <div style={{ height: 36, width: 36, minWidth: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }} className="bg-gradient-to-br from-muted to-muted-foreground/20 text-muted-foreground">
                                        {(email.from?.emailAddress?.name || email.from?.emailAddress?.address || "?").substring(0, 2).toUpperCase()}
                                      </div>
                                    )}
                                    <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                                        <span className={`${!email.isRead && emailPrefs.highlightUnread ? "font-bold" : "font-medium"}`} style={{ fontSize: 13, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                                          {highlightSearchMatch(email.from?.emailAddress?.name || email.from?.emailAddress?.address || "Neznámy", debouncedSearchQuery)}
                                        </span>
                                        <span style={{ fontSize: 11, whiteSpace: "nowrap", flexShrink: 0 }} className="text-muted-foreground">
                                          {format(new Date(email.receivedDateTime), "d.M. HH:mm")}
                                        </span>
                                      </div>
                                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2, overflow: "hidden" }}>
                                        <p className={`${!email.isRead && emailPrefs.highlightUnread ? "font-semibold" : "text-muted-foreground"}`} style={{ fontSize: 12, lineHeight: 1.2, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>
                                          {highlightSearchMatch(email.subject || "(Bez predmetu)", debouncedSearchQuery)}
                                        </p>
                                        {emailPrefs.previewAttachmentIcons && email.hasAttachments && <Paperclip className="text-muted-foreground/70" style={{ height: 14, width: 14, flexShrink: 0 }} />}
                                        {srAcctColor && (
                                          <span
                                            style={{ height: 20, width: 20, minWidth: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: srAcctColor, flexShrink: 0 }}
                                            title={mailboxes.find(m => m.email === email._mailboxEmail)?.displayName || email._mailboxEmail}
                                          >
                                            <AccountIcon iconKey={accountConfigs[email._mailboxEmail!]?.icon || "mail"} className="h-3 w-3 text-white" />
                                          </span>
                                        )}
                                      </div>
                                      {emailPrefs.previewLines > 0 && email.bodyPreview && (
                                        <p style={{ fontSize: 11, marginTop: 2, lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: "2px 0 0" }} className="text-muted-foreground">
                                          {highlightSearchMatch(email.bodyPreview, debouncedSearchQuery)}
                                        </p>
                                      )}
                                      {emailPrefs.showTags && getEmailTags(email.id).length > 0 && (
                                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                          {getEmailTags(email.id).map((tag: any) => (
                                            <span key={tag.id} className="inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0 rounded-full text-white" style={{ backgroundColor: tag.color }}>
                                              {tag.name}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                );
                              })}
                            </div>
                          )
                        ))}
                      </div>
                    </ScrollArea>
                  )
                ) : messagesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : emailsPage.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Mail className="h-8 w-8 mb-2 opacity-50" />
                    <span className="text-sm">Žiadne emaily</span>
                  </div>
                ) : (
                  <>
                  <ScrollArea className={nexusFullscreen ? "h-[calc(100vh-180px)]" : "h-[calc(100vh-380px)]"} style={{ overflowX: "hidden" }}>
                    <div className="divide-y" style={{ overflowX: "hidden", maxWidth: "100%" }}>
                      {emailsPage.map((email) => {
                        const tintBg = selectedMailbox === "all" && email._mailboxEmail
                          ? getAccountTint(email._mailboxEmail)
                          : undefined;
                        const acctColor = email._mailboxEmail
                          ? (accountConfigs[email._mailboxEmail]?.color || mailboxColorMap[email._mailboxEmail] || "#6B7280")
                          : null;
                        return (
                        <div
                          key={email.id}
                          className={`relative group w-full text-left px-3 py-2.5 transition-all hover:bg-accent/50 cursor-pointer overflow-hidden ${
                            selectedEmail?.id === email.id ? "bg-accent" : ""
                          } ${!email.isRead ? "font-medium" : ""}`}
                          onClick={() => setSelectedEmail(email)}
                          onDoubleClick={() => { setSelectedEmail(email); setModalEmail(email); }}
                          data-testid={`email-item-${email.id}`}
                          style={tintBg && selectedEmail?.id !== email.id ? { backgroundColor: tintBg } : undefined}
                        >
                          {selectedMailbox === "all" && acctColor && (
                            <span className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-sm" style={{ backgroundColor: acctColor }} />
                          )}
                          <button
                            className="absolute top-1.5 right-1.5 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-background/80 transition-all z-10"
                            onClick={(e) => { e.stopPropagation(); toggleReadMutation.mutate({ emailId: email.id, isRead: !email.isRead, mailbox: email._mailboxEmail ? getMailboxParam(email._mailboxEmail) : undefined }); }}
                            title={email.isRead ? "Označiť ako neprečítané" : "Označiť ako prečítané"}
                            data-testid={`toggle-read-${email.id}`}
                          >
                            {!email.isRead ? <Eye className="h-3.5 w-3.5 text-muted-foreground" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                          </button>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", overflow: "hidden", width: "100%" }}>
                            {emailPrefs.unreadIndicator && (
                              <span className={`shrink-0 ${!email.isRead ? "bg-blue-500" : "bg-transparent"}`} style={{ height: 8, width: 8, borderRadius: "50%", marginTop: 6, flexShrink: 0 }} />
                            )}
                            {emailPrefs.showSenderInitials && (
                              <div style={{ height: 36, width: 36, minWidth: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }} className="bg-gradient-to-br from-muted to-muted-foreground/20 text-muted-foreground">
                                {(email.from?.emailAddress?.name || email.from?.emailAddress?.address || "?").substring(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                                <span className={`${!email.isRead && emailPrefs.highlightUnread ? "font-bold" : "font-medium"}`} style={{ fontSize: 13, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                                  {email.from?.emailAddress?.name || email.from?.emailAddress?.address || "Neznámy"}
                                </span>
                                <span style={{ fontSize: 11, whiteSpace: "nowrap", flexShrink: 0 }} className="text-muted-foreground">
                                  {format(new Date(email.receivedDateTime), "d.M. HH:mm")}
                                </span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2, overflow: "hidden" }}>
                                <p className={`${!email.isRead && emailPrefs.highlightUnread ? "font-semibold" : "text-muted-foreground"}`} style={{ fontSize: 12, lineHeight: 1.2, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>
                                  {email.subject || "(Bez predmetu)"}
                                </p>
                                {email.hasAttachments && <Paperclip className="text-muted-foreground/70" style={{ height: 14, width: 14, flexShrink: 0 }} />}
                                {selectedMailbox === "all" && acctColor && (
                                  <span
                                    style={{ height: 20, width: 20, minWidth: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: acctColor, flexShrink: 0 }}
                                    title={mailboxes.find(m => m.email === email._mailboxEmail)?.displayName || email._mailboxEmail}
                                  >
                                    <AccountIcon iconKey={accountConfigs[email._mailboxEmail!]?.icon || "mail"} className="h-3 w-3 text-white" />
                                  </span>
                                )}
                              </div>
                              {emailPrefs.previewLines > 0 && email.bodyPreview && (
                                emailPrefs.previewLines === 1 ? (
                                  <p style={{ fontSize: 11, marginTop: 2, lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: "2px 0 0" }} className="text-muted-foreground">{email.bodyPreview}</p>
                                ) : (
                                  <p style={{ fontSize: 11, marginTop: 2, lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, wordBreak: "break-word", margin: "2px 0 0" }} className="text-muted-foreground">{email.bodyPreview}</p>
                                )
                              )}
                              {emailPrefs.showTags && getEmailTags(email.id).length > 0 && (
                                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                  {getEmailTags(email.id).map((tag: any) => (
                                    <span key={tag.id} className="inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0 rounded-full text-white" style={{ backgroundColor: tag.color }}>
                                      {tag.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                  {totalCount > emails.length && (
                    <div className="p-2 border-t bg-background text-center space-y-1">
                      <div className="flex items-center justify-center gap-2">
                        <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => setPage(p => p + 1)} disabled={messagesFetching || loadingAll} data-testid="button-load-more">
                          {messagesFetching && !loadingAll && <Loader2 className="h-3 w-3 animate-spin" />}
                          Načítať ďalšie ({emails.length} z {totalCount})
                        </Button>
                        <Button variant="default" size="sm" className="text-xs gap-1" onClick={loadAllEmails} disabled={messagesFetching || loadingAll} data-testid="button-load-all">
                          {loadingAll && <Loader2 className="h-3 w-3 animate-spin" />}
                          Načítať všetko
                        </Button>
                      </div>
                      {loadingAll && (
                        <p className="text-[10px] text-muted-foreground">Načítava sa... {emails.length} z {totalCount}</p>
                      )}
                    </div>
                  )}
                  </>
                )}
              </CardContent>
            </Card>
            <Card className={`transition-all duration-300 ${detailFullscreen ? "fixed inset-0 z-50 rounded-none" : "flex-1 min-w-0"}`}>
              <CardContent className="p-0 h-full">
                {renderEmailDetail()}
              </CardContent>
            </Card>
          </>
        )}

        {activeTab === "sms" && (
          <>
            <Card className="transition-all duration-300 w-[30%] min-w-[320px] max-w-[420px] shrink-0">
              <CardHeader className="py-2 px-3 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-cyan-600" />
                    <span className="text-sm font-semibold">{smsFilter === "all" ? "Všetky SMS" : smsFilter === "inbound" ? "Prijaté SMS" : "Odoslané SMS"}</span>
                    <Badge variant="secondary" className="text-[10px]">{filteredSms.length}</Badge>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={localPage === 0} onClick={() => setLocalPage(p => p - 1)} data-testid="sms-page-prev">
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-[11px] min-w-[40px] text-center text-muted-foreground">{totalSmsPages > 0 ? `${localPage + 1}/${totalSmsPages}` : "0/0"}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={localPage >= totalSmsPages - 1} onClick={() => setLocalPage(p => p + 1)} data-testid="sms-page-next">
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {smsLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : smsPage.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
                    <span className="text-sm">Žiadne SMS</span>
                  </div>
                ) : (
                  <ScrollArea className={nexusFullscreen ? "h-[calc(100vh-160px)]" : "h-[calc(100vh-360px)]"}>
                    <div className="divide-y">
                      {smsPage.map(sms => {
                        const customerName = sms.customer
                          ? `${sms.customer.firstName} ${sms.customer.lastName}`
                          : (sms.direction === "inbound" ? sms.senderPhone : sms.recipientPhone) || "Neznámy";
                        const isUnread = sms.direction === "inbound" && sms.deliveryStatus !== "read";
                        return (
                          <div
                            key={sms.id}
                            className={`w-full text-left px-3 py-2.5 transition-all hover:bg-accent/50 cursor-pointer ${
                              selectedSms?.id === sms.id ? "bg-accent" : ""
                            } ${isUnread ? "font-medium" : ""}`}
                            onClick={() => { setSelectedSms(sms); setSelectedEmail(null); setSelectedTask(null); _setSelectedChat(null); }}
                            data-testid={`sms-item-${sms.id}`}
                          >
                            <div className="flex items-start gap-2.5">
                              <span className={`h-2 w-2 rounded-full shrink-0 mt-2 ${isUnread ? "bg-cyan-500" : "bg-transparent"}`} />
                              <div className={`p-1 rounded-md ${sms.direction === "inbound" ? "bg-cyan-50 dark:bg-cyan-950/30" : "bg-emerald-50 dark:bg-emerald-950/30"} shrink-0`}>
                                {sms.direction === "inbound" ? <ArrowDown className="h-3.5 w-3.5 text-cyan-600" /> : <ArrowUp className="h-3.5 w-3.5 text-emerald-600" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <span className={`text-sm truncate ${isUnread ? "font-bold" : ""}`}>{customerName}</span>
                                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                    {format(new Date(sms.sentAt || sms.createdAt), "d.M. HH:mm")}
                                  </span>
                                </div>
                                <p className="text-[11px] text-muted-foreground truncate">{sms.content}</p>
                                {sms.aiAlertLevel && sms.aiAlertLevel !== "none" && (
                                  <Badge variant="outline" className={`mt-0.5 text-[10px] px-1 py-0 h-4 ${
                                    sms.aiAlertLevel === "critical" ? "border-red-500 text-red-600" : "border-amber-500 text-amber-600"
                                  }`}>
                                    {sms.aiAlertLevel === "critical" ? <ShieldAlert className="h-3 w-3 mr-0.5" /> : <AlertTriangle className="h-3 w-3 mr-0.5" />}
                                    {sms.aiHasAngryTone && "Nahnevaný"}
                                    {sms.aiWantsToCancel && "Zrušenie"}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
            <Card className="transition-all duration-300 flex-1 min-w-0">
              <CardContent className="p-0 h-full">
                {renderSmsDetail()}
              </CardContent>
            </Card>
          </>
        )}

        {activeTab === "tasks" && (
          <>
            <Card className="transition-all duration-300 w-[30%] min-w-[320px] max-w-[420px] shrink-0">
              <CardHeader className="py-2 px-3 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ListTodo className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-semibold">{taskFilter === "all" ? "Všetky úlohy" : taskFilter === "pending" ? "Čakajúce" : taskFilter === "in_progress" ? "Rozpracované" : taskFilter === "completed" ? "Dokončené" : "Zrušené"}</span>
                    <Badge variant="secondary" className="text-[10px]">{filteredTasks.length}</Badge>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={localPage === 0} onClick={() => setLocalPage(p => p - 1)} data-testid="task-page-prev">
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-[11px] min-w-[40px] text-center text-muted-foreground">{totalTaskPages > 0 ? `${localPage + 1}/${totalTaskPages}` : "0/0"}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={localPage >= totalTaskPages - 1} onClick={() => setLocalPage(p => p + 1)} data-testid="task-page-next">
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {tasksLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : tasksPage.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <ListTodo className="h-8 w-8 mb-2 opacity-50" />
                    <span className="text-sm">Žiadne úlohy</span>
                  </div>
                ) : (
                  <ScrollArea className={nexusFullscreen ? "h-[calc(100vh-160px)]" : "h-[calc(100vh-360px)]"}>
                    <div className="divide-y">
                      {tasksPage.map(task => (
                        <div
                          key={task.id}
                          className={`w-full text-left px-3 py-2.5 transition-all hover:bg-accent/50 cursor-pointer ${
                            selectedTask?.id === task.id ? "bg-accent" : ""
                          } ${task.status === "pending" ? "font-medium" : ""}`}
                          onClick={() => { setSelectedTask(task); setSelectedEmail(null); setSelectedSms(null); _setSelectedChat(null); }}
                          data-testid={`task-item-${task.id}`}
                        >
                          <div className="flex items-start gap-2.5">
                            <span className="mt-1 shrink-0">{statusIcons[task.status]}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-sm truncate font-medium">{task.title}</span>
                                <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                  {format(new Date(task.updatedAt || task.createdAt), "d.M. HH:mm")}
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground truncate">{task.description || "Bez popisu"}</p>
                              <div className="flex items-center gap-1 mt-0.5">
                                {task.priority && (
                                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 gap-0.5">
                                    {priorityIcons[task.priority]}
                                    {task.priority}
                                  </Badge>
                                )}
                                {task.dueDate && (
                                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 gap-0.5">
                                    <Clock className="h-3 w-3" />
                                    {format(new Date(task.dueDate), "d.M.")}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
            <Card className="transition-all duration-300 flex-1 min-w-0">
              <CardContent className="p-0 h-full">
                {renderTaskDetail()}
              </CardContent>
            </Card>
          </>
        )}

        {activeTab === "chats" && (
          <>
            <Card className="transition-all duration-300 flex-1 min-w-0">
              <CardContent className="p-0 h-full">
                {selectedChat ? (
                  <div className="flex flex-col h-full">
                    <div className="p-4 border-b">
                      <div className="flex items-center gap-2">
                        <Badge className={`${typeColors.chat.bg} ${typeColors.chat.text}`}>
                          <MessagesSquare className="h-3 w-3 mr-1" />Chat
                        </Badge>
                        <h2 className="text-lg font-semibold">{selectedChat.participantName}</h2>
                      </div>
                    </div>
                    <ScrollArea className="flex-1">
                      <div className="p-4">
                        <p className="text-sm text-muted-foreground">Posledná správa:</p>
                        <p className="text-sm mt-1">{selectedChat.lastMessage}</p>
                      </div>
                    </ScrollArea>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <MessagesSquare className="h-12 w-12 mb-4 opacity-50" />
                    <p className="font-medium">Interné chaty</p>
                    <p className="text-sm">Vyberte konverzáciu v postrannom paneli</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {activeTab === "teams" && (
          <TeamsPanel userId={user?.id} />
        )}
      </div>

      <Dialog open={smartSearchOpen} onOpenChange={setSmartSearchOpen}>
        <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden" data-testid="smart-search-dialog">
          <DialogHeader className="sr-only">
            <DialogTitle>{t.nexusOmni.search.searchInEmails}</DialogTitle>
            <DialogDescription>{t.nexusOmni.search.placeholder}</DialogDescription>
          </DialogHeader>
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={smartSearchInputRef}
                placeholder="Hľadať v emailoch, SMS, úlohách, chatoch..."
                value={smartSearchQuery}
                onChange={(e) => setSmartSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") executeSmartSearch(smartSearchQuery); }}
                className="pl-10 pr-4 h-10 text-sm"
                autoFocus
                data-testid="input-smart-search"
              />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-muted-foreground shrink-0">Schránka:</span>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setSmartSearchMailbox("all")}
                  className={cn("px-2 py-0.5 rounded text-xs transition-all", smartSearchMailbox === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent")}
                  data-testid="smart-search-mailbox-all"
                >
                  Všetky
                </button>
                {mailboxes.map(m => {
                  const key = m.type === "personal" ? "personal" : m.email;
                  const mbColor = accountConfigs[m.email]?.color || mailboxColorMap[m.email] || undefined;
                  return (
                    <button
                      key={key}
                      onClick={() => setSmartSearchMailbox(key)}
                      className={cn("px-2 py-0.5 rounded text-xs transition-all truncate max-w-32 flex items-center gap-1", smartSearchMailbox === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent")}
                      data-testid={`smart-search-mailbox-${key}`}
                    >
                      {mbColor && <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: mbColor }} />}
                      {m.email.split("@")[0]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                Dátum:
              </span>
              <div className="flex items-center gap-1.5 flex-1">
                <input
                  type="date"
                  value={searchDateFrom}
                  onChange={(e) => setSearchDateFrom(e.target.value)}
                  className="h-7 px-2 text-xs rounded border bg-background text-foreground flex-1 min-w-0"
                  data-testid="search-date-from"
                />
                <span className="text-xs text-muted-foreground">—</span>
                <input
                  type="date"
                  value={searchDateTo}
                  onChange={(e) => setSearchDateTo(e.target.value)}
                  className="h-7 px-2 text-xs rounded border bg-background text-foreground flex-1 min-w-0"
                  data-testid="search-date-to"
                />
                {(searchDateFrom || searchDateTo) && (
                  <button
                    onClick={() => { setSearchDateFrom(""); setSearchDateTo(""); }}
                    className="h-7 w-7 flex items-center justify-center rounded border bg-muted text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
                    data-testid="clear-date-filter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <ScrollArea className="max-h-[400px]">
            <div className="p-2">
              {smartSearchQuery.trim().length >= 2 && (
                <>
                <button
                  onClick={() => executeSmartSearch(smartSearchQuery)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent transition-all text-left group"
                  data-testid="smart-search-execute"
                >
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Mail className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">Hľadať v emailoch "{smartSearchQuery}"</p>
                    <p className="text-xs text-muted-foreground">Prehľadať {smartSearchMailbox === "all" ? "všetky schránky" : smartSearchMailbox}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </button>

                {(() => {
                  const q = smartSearchQuery.toLowerCase().trim();
                  const matchedEmails = accumulatedEmails.filter(e =>
                    (e.subject || "").toLowerCase().includes(q) ||
                    (e.from?.emailAddress?.name || "").toLowerCase().includes(q) ||
                    (e.from?.emailAddress?.address || "").toLowerCase().includes(q) ||
                    (e.bodyPreview || "").toLowerCase().includes(q)
                  ).slice(0, 5);
                  const matchedSms = (smsData || []).filter(s => {
                    const phone = s.direction === "inbound" ? s.senderPhone : s.recipientPhone;
                    const custName = s.customer ? `${s.customer.firstName} ${s.customer.lastName}` : "";
                    return (s.content || "").toLowerCase().includes(q) || (phone || "").includes(q) || custName.toLowerCase().includes(q);
                  }).slice(0, 5);
                  const matchedTasks = (tasksData || []).filter(t =>
                    (t.title || "").toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q)
                  ).slice(0, 5);
                  const matchedChats = (chatsData || []).filter(c =>
                    (c.participantName || "").toLowerCase().includes(q) || (c.lastMessage || "").toLowerCase().includes(q)
                  ).slice(0, 5);
                  return (
                    <>
                      {matchedEmails.length > 0 && (
                        <>
                          <div className="px-3 py-1 mt-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" /> Emaily ({matchedEmails.length})
                            </span>
                          </div>
                          {matchedEmails.map(email => {
                            const emColor = email._mailboxEmail ? (accountConfigs[email._mailboxEmail]?.color || mailboxColorMap[email._mailboxEmail] || undefined) : undefined;
                            const emTint = email._mailboxEmail ? getAccountTint(email._mailboxEmail) : undefined;
                            return (
                            <button
                              key={email.id}
                              onClick={() => { setActiveTab("email"); setSelectedEmail(email); setSmartSearchOpen(false); setSmartSearchQuery(""); }}
                              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition-all text-left group relative overflow-hidden"
                              style={emTint ? { backgroundColor: emTint } : undefined}
                              data-testid={`search-email-quick-${email.id}`}
                            >
                              {emColor && <span className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-sm" style={{ backgroundColor: emColor }} />}
                              <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: emColor || "hsl(var(--muted))" }}>
                                <AccountIcon iconKey={email._mailboxEmail ? (accountConfigs[email._mailboxEmail]?.icon || "mail") : "mail"} className="h-3.5 w-3.5 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm truncate">{email.from?.emailAddress?.name || email.from?.emailAddress?.address || "Neznámy"}</p>
                                <p className="text-[11px] text-muted-foreground truncate">{email.subject || "(Bez predmetu)"}</p>
                              </div>
                              <span className="text-[10px] text-muted-foreground shrink-0">{format(new Date(email.receivedDateTime), "d.M. HH:mm")}</span>
                            </button>
                            );
                          })}
                        </>
                      )}
                      {matchedSms.length > 0 && (
                        <>
                          <div className="px-3 py-1 mt-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" /> SMS ({matchedSms.length})
                            </span>
                          </div>
                          {matchedSms.map(sms => (
                            <button
                              key={sms.id}
                              onClick={() => { setActiveTab("sms"); setSelectedSms(sms); setSmartSearchOpen(false); setSmartSearchQuery(""); }}
                              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition-all text-left group"
                              data-testid={`search-sms-${sms.id}`}
                            >
                              <div className="h-8 w-8 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center shrink-0">
                                <MessageSquare className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm truncate">{sms.customer ? `${sms.customer.firstName} ${sms.customer.lastName}` : (sms.direction === "inbound" ? sms.senderPhone : sms.recipientPhone)}</p>
                                <p className="text-[11px] text-muted-foreground truncate">{sms.content}</p>
                              </div>
                              <span className="text-[10px] text-muted-foreground shrink-0">{format(new Date(sms.createdAt), "d.M. HH:mm")}</span>
                            </button>
                          ))}
                        </>
                      )}
                      {matchedTasks.length > 0 && (
                        <>
                          <div className="px-3 py-1 mt-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                              <ListTodo className="h-3 w-3" /> Úlohy ({matchedTasks.length})
                            </span>
                          </div>
                          {matchedTasks.map(task => (
                            <button
                              key={task.id}
                              onClick={() => { setActiveTab("tasks"); setSelectedTask(task); setSmartSearchOpen(false); setSmartSearchQuery(""); }}
                              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition-all text-left group"
                              data-testid={`search-task-${task.id}`}
                            >
                              <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                                <ListTodo className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm truncate">{task.title}</p>
                                <p className="text-[11px] text-muted-foreground truncate">{task.description || task.status}</p>
                              </div>
                              <Badge variant="secondary" className="text-[10px] shrink-0">{task.status === "pending" ? "Čakajúca" : task.status === "completed" ? "Hotová" : task.status}</Badge>
                            </button>
                          ))}
                        </>
                      )}
                      {matchedChats.length > 0 && (
                        <>
                          <div className="px-3 py-1 mt-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                              <MessagesSquare className="h-3 w-3" /> Chaty ({matchedChats.length})
                            </span>
                          </div>
                          {matchedChats.map(chat => (
                            <button
                              key={chat.id}
                              onClick={() => { setActiveTab("chats"); _setSelectedChat(chat); setSmartSearchOpen(false); setSmartSearchQuery(""); }}
                              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition-all text-left group"
                              data-testid={`search-chat-${chat.id}`}
                            >
                              <div className="h-8 w-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                                <MessagesSquare className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm truncate">{chat.participantName}</p>
                                <p className="text-[11px] text-muted-foreground truncate">{chat.lastMessage}</p>
                              </div>
                              <span className="text-[10px] text-muted-foreground shrink-0">{format(new Date(chat.lastMessageAt), "d.M. HH:mm")}</span>
                            </button>
                          ))}
                        </>
                      )}
                    </>
                  );
                })()}
                </>
              )}

              {selectedEmail && smartSearchQuery.length === 0 && (
                <>
                  <div className="px-3 py-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3" />
                      Návrhy na základe otvoreného emailu
                    </span>
                  </div>
                  {getSmartSuggestions().map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => executeSmartSearch(suggestion.query)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition-all text-left group"
                      data-testid={`smart-suggestion-${idx}`}
                    >
                      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                        suggestion.type === "sender" ? "bg-blue-100 dark:bg-blue-900/30" :
                        suggestion.type === "domain" ? "bg-purple-100 dark:bg-purple-900/30" :
                        suggestion.type === "subject" ? "bg-amber-100 dark:bg-amber-900/30" :
                        suggestion.type === "attachment" ? "bg-green-100 dark:bg-green-900/30" :
                        suggestion.type === "date" ? "bg-indigo-100 dark:bg-indigo-900/30" :
                        "bg-muted"
                      )}>
                        {suggestion.icon === "user" && <User className={cn("h-4 w-4", "text-blue-600 dark:text-blue-400")} />}
                        {suggestion.icon === "globe" && <Globe className={cn("h-4 w-4", "text-purple-600 dark:text-purple-400")} />}
                        {suggestion.icon === "message" && <Mail className={cn("h-4 w-4", "text-amber-600 dark:text-amber-400")} />}
                        {suggestion.icon === "tag" && <Tag className={cn("h-4 w-4", "text-amber-600 dark:text-amber-400")} />}
                        {suggestion.icon === "paperclip" && <Paperclip className={cn("h-4 w-4", "text-green-600 dark:text-green-400")} />}
                        {suggestion.icon === "flame" && <Flame className={cn("h-4 w-4", "text-red-600 dark:text-red-400")} />}
                        {suggestion.icon === "calendar" && <CalendarDays className={cn("h-4 w-4", "text-indigo-600 dark:text-indigo-400")} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{suggestion.label}</p>
                        {!suggestion.query.startsWith("__date:") && <p className="text-[11px] text-muted-foreground truncate">{suggestion.query}</p>}
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </>
              )}

              {!selectedEmail && smartSearchQuery.length === 0 && (
                <>
                  <div className="px-3 py-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Zap className="h-3 w-3" />
                      Rýchle vyhľadávanie
                    </span>
                  </div>
                  <button
                    onClick={() => executeSmartSearch("hasAttachments:true")}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition-all text-left group"
                    data-testid="quick-search-attachments"
                  >
                    <div className="h-8 w-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                      <Paperclip className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <p className="text-sm">Emaily s prílohami</p>
                  </button>
                  <button
                    onClick={() => executeSmartSearch("importance:high")}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition-all text-left group"
                    data-testid="quick-search-important"
                  >
                    <div className="h-8 w-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                      <Flame className="h-4 w-4 text-red-600 dark:text-red-400" />
                    </div>
                    <p className="text-sm">Dôležité emaily</p>
                  </button>
                  {(() => {
                    const today = new Date();
                    const todayStr = today.toISOString().split("T")[0];
                    const weekAgo = new Date(today.getTime() - 7 * 86400000).toISOString().split("T")[0];
                    const monthAgo = new Date(today.getTime() - 30 * 86400000).toISOString().split("T")[0];
                    return (
                      <>
                        <button onClick={() => executeSmartSearch(`__date:${todayStr}:${todayStr}`)} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition-all text-left group" data-testid="quick-search-today">
                          <div className="h-8 w-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0"><CalendarDays className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /></div>
                          <p className="text-sm">Dnešné emaily</p>
                        </button>
                        <button onClick={() => executeSmartSearch(`__date:${weekAgo}:${todayStr}`)} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition-all text-left group" data-testid="quick-search-week">
                          <div className="h-8 w-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0"><CalendarRange className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /></div>
                          <p className="text-sm">Posledný týždeň</p>
                        </button>
                        <button onClick={() => executeSmartSearch(`__date:${monthAgo}:${todayStr}`)} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition-all text-left group" data-testid="quick-search-month">
                          <div className="h-8 w-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0"><CalendarRange className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /></div>
                          <p className="text-sm">Posledný mesiac</p>
                        </button>
                      </>
                    );
                  })()}
                </>
              )}

              {recentSearches.length > 0 && smartSearchQuery.length === 0 && (
                <>
                  <div className="px-3 py-1.5 mt-2 flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <History className="h-3 w-3" />
                      Posledné vyhľadávania
                    </span>
                    <button onClick={clearRecentSearches} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors" data-testid="clear-recent-searches">
                      Vymazať
                    </button>
                  </div>
                  {recentSearches.map((recent, idx) => (
                    <button
                      key={idx}
                      onClick={() => executeSmartSearch(recent)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition-all text-left group"
                      data-testid={`recent-search-${idx}`}
                    >
                      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <History className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="text-sm truncate flex-1">{recent}</p>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </>
              )}

              {smartSearchQuery.trim().length > 0 && smartSearchQuery.trim().length < 2 && (
                <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                  <Search className="h-6 w-6 mb-2 opacity-40" />
                  <p className="text-sm">Zadajte aspoň 2 znaky</p>
                </div>
              )}

              {smartSearchQuery.trim().length >= 2 && (
                <>
                  {getSmartSuggestions().filter(s => s.label.toLowerCase().includes(smartSearchQuery.toLowerCase()) || s.query.toLowerCase().includes(smartSearchQuery.toLowerCase())).map((suggestion, idx) => (
                    <button
                      key={`filtered-${idx}`}
                      onClick={() => executeSmartSearch(suggestion.query)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition-all text-left group"
                      data-testid={`filtered-suggestion-${idx}`}
                    >
                      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Sparkles className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{suggestion.label}</p>
                      </div>
                    </button>
                  ))}

                  {recentSearches.filter(r => r.toLowerCase().includes(smartSearchQuery.toLowerCase())).map((recent, idx) => (
                    <button
                      key={`recent-filtered-${idx}`}
                      onClick={() => executeSmartSearch(recent)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition-all text-left group"
                      data-testid={`recent-filtered-${idx}`}
                    >
                      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <History className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="text-sm truncate flex-1">{recent}</p>
                    </button>
                  ))}
                </>
              )}
            </div>
          </ScrollArea>

          <div className="px-4 py-2 border-t bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-muted border rounded text-[9px]">↵</kbd> Hľadať</span>
              <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 bg-muted border rounded text-[9px]">Esc</kbd> Zavrieť</span>
            </div>
            {isSearching && (
              <button
                onClick={() => { clearSearch(); setSmartSearchOpen(false); }}
                className="text-xs text-primary hover:underline"
                data-testid="clear-active-search"
              >
                Zrušiť aktívne vyhľadávanie
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={composeOpen} onOpenChange={(open) => { setComposeOpen(open); if (!open) setComposeFullscreen(false); }}>
        <DialogContent className={cn(
          "flex flex-col gap-0 p-0",
          composeFullscreen
            ? "max-w-[100vw] w-[100vw] h-[100vh] max-h-[100vh] rounded-none"
            : "max-w-3xl w-[90vw] max-h-[85vh]"
        )}>
          <DialogHeader className="px-4 py-3 border-b shrink-0">
            <div className="flex items-center justify-between pr-8">
              <DialogTitle className="flex items-center gap-2">
                <PenSquare className="h-5 w-5" />
                Nová správa
              </DialogTitle>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setComposeFullscreen(f => !f)} title={composeFullscreen ? "Zmenšiť" : "Na celú obrazovku"}>
                {composeFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
            <DialogDescription className="text-xs">
              Odoslať z: {mailboxes.find(m => (m.type === "personal" ? "personal" : m.email) === effectiveMailbox)?.email || effectiveMailbox}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-4 space-y-3">
            <EmailRecipientInput
              placeholder="Komu (viac adries oddeľte čiarkou)"
              value={composeData.to}
              onChange={(v) => setComposeData({ ...composeData, to: v })}
              knownEmails={knownEmails}
              data-testid="input-compose-to"
            />
            <div className="grid grid-cols-2 gap-2">
              <EmailRecipientInput placeholder="Cc" value={composeData.cc} onChange={(v) => setComposeData({ ...composeData, cc: v })} knownEmails={knownEmails} data-testid="input-compose-cc" />
              <EmailRecipientInput placeholder="Bcc" value={composeData.bcc} onChange={(v) => setComposeData({ ...composeData, bcc: v })} knownEmails={knownEmails} data-testid="input-compose-bcc" />
            </div>
            <Input placeholder="Predmet" value={composeData.subject} onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })} data-testid="input-compose-subject" />
            <EmailEditor
              key={composeOpen ? "compose-open" : "compose-closed"}
              initialContent={composeData.body}
              onChange={(html) => setComposeData(prev => ({ ...prev, body: html }))}
              signatureHtml={getSignatureForCompose()}
              placeholder="Napíšte správu..."
              minHeight={composeFullscreen ? "400px" : "200px"}
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              data-testid="editor-compose-body"
            />
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Dôležitosť:</span>
                <Select value={composeData.importance} onValueChange={(v) => setComposeData({ ...composeData, importance: v })}>
                  <SelectTrigger className="w-32 h-8 text-xs" data-testid="select-importance">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Nízka</SelectItem>
                    <SelectItem value="normal">Normálna</SelectItem>
                    <SelectItem value="high">Vysoká</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Tag:</span>
                <Select value={composeData.tagId?.toString() || "none"} onValueChange={(v) => setComposeData({ ...composeData, tagId: v === "none" ? null : parseInt(v) })}>
                  <SelectTrigger className="w-36 h-8 text-xs" data-testid="select-compose-tag">
                    <SelectValue placeholder="Žiadny" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Žiadny tag</SelectItem>
                    {userTags.map((tag: any) => (
                      <SelectItem key={tag.id} value={tag.id.toString()}>
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                          {tag.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="px-4 py-3 border-t shrink-0">
            <Button variant="outline" onClick={() => setComposeOpen(false)}>Zrušiť</Button>
            <Button onClick={handleSendEmail} disabled={sendEmailMutation.isPending} data-testid="button-send-compose">
              {sendEmailMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Send className="h-4 w-4 mr-2" />
              Odoslať
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={signatureDialogOpen} onOpenChange={setSignatureDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] p-0 gap-0 overflow-hidden">
          <div className="flex h-[75vh]">
            <div className="w-48 border-r bg-muted/30 flex flex-col py-2 shrink-0">
              <DialogHeader className="px-4 pb-3 pt-2">
                <DialogTitle className="text-base">Nastavenia</DialogTitle>
              </DialogHeader>
              {[
                { key: "accounts" as const, label: "Účty", icon: <UserCircle className="h-4 w-4" /> },
                { key: "messages" as const, label: "Správy", icon: <LayoutList className="h-4 w-4" /> },
                { key: "compose" as const, label: "Písanie", icon: <Type className="h-4 w-4" /> },
                { key: "tags" as const, label: "Tagy", icon: <Tag className="h-4 w-4" /> },
                { key: "ai" as const, label: "AI Asistent", icon: <Sparkles className="h-4 w-4" /> },
                { key: "notifications" as const, label: "Notifikácie", icon: <Volume2 className="h-4 w-4" /> },
                { key: "appearance" as const, label: "Vzhľad", icon: <Palette className="h-4 w-4" /> },
              ].map(item => (
                <button
                  key={item.key}
                  onClick={() => setSettingsTab(item.key)}
                  className={`flex items-center gap-2.5 px-4 py-2 text-sm transition-colors text-left ${settingsTab === item.key ? "bg-primary/10 text-primary font-medium border-r-2 border-primary" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"}`}
                  data-testid={`settings-nav-${item.key}`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-auto p-6">
              {renderSettingsContent()}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {renderEmailModal()}

      <Dialog open={aiModalOpen} onOpenChange={setAiModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col" data-testid="ai-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              {aiModalType === "reply" ? "AI Generovať odpoveď" : "AI Zhrnutie konverzácie"}
            </DialogTitle>
            <DialogDescription>
              {aiModalType === "reply" ? "Skontrolujte a upravte navrhovanú odpoveď pred vložením." : "Skontrolujte a upravte zhrnutie pred vložením do odpovede."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 px-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" disabled={aiTranslating} className="gap-1.5" data-testid="ai-translate-btn">
                  {aiTranslating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Languages className="h-3.5 w-3.5" />}
                  Preložiť
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-44 p-1" align="start" side="bottom" sideOffset={4}>
                <div className="space-y-0.5">
                  {AI_LANGUAGES.map(lang => (
                    <button
                      key={lang.code}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm hover:bg-accent transition-colors text-left"
                      onClick={() => handleAiTranslate(lang.code)}
                      data-testid={`ai-translate-${lang.code}`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            {aiTranslating && <span className="text-xs text-muted-foreground animate-pulse">Prebieha preklad...</span>}
          </div>
          <div className="flex-1 overflow-auto min-h-0">
            <EmailEditor
              key={`ai-modal-${aiModalType}-${aiTranslationKey}`}
              initialContent={aiModalContent}
              onChange={(html) => setAiModalContent(html)}
              placeholder="Upravte AI obsah..."
              minHeight="200px"
              showAttachments={false}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setAiModalOpen(false)} data-testid="ai-modal-cancel">
              Zavrieť
            </Button>
            <Button onClick={handleAiModalInsert} data-testid="ai-modal-insert">
              <Plus className="h-4 w-4 mr-2" />
              Pridať do odpovede
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {sendProgress.active && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-4 fade-in duration-300" data-testid="send-progress-overlay">
          <div className="bg-background/95 backdrop-blur-md border shadow-2xl rounded-xl px-6 py-4 min-w-[320px] max-w-[400px]">
            <div className="flex items-center gap-3 mb-3">
              {sendProgress.status === "sending" && (
                <>
                  <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Odosielam správu...</p>
                    <p className="text-xs text-muted-foreground">Prosím čakajte</p>
                  </div>
                </>
              )}
              {sendProgress.status === "done" && (
                <>
                  <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                    <Check className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">Správa odoslaná</p>
                    <p className="text-xs text-muted-foreground">Email bol úspešne doručený</p>
                  </div>
                </>
              )}
              {sendProgress.status === "error" && (
                <>
                  <div className="h-8 w-8 rounded-full bg-red-500/10 flex items-center justify-center">
                    <XCircle className="h-4 w-4 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-red-600 dark:text-red-400">Odoslanie zlyhalo</p>
                    <p className="text-xs text-muted-foreground">Skúste to znova</p>
                  </div>
                </>
              )}
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300 ease-out",
                  sendProgress.status === "sending" && "bg-blue-500",
                  sendProgress.status === "done" && "bg-green-500",
                  sendProgress.status === "error" && "bg-red-500",
                )}
                style={{ width: `${sendProgress.progress}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function renderEmailDetail() {
    if (detailLoading) {
      return <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin" /></div>;
    }
    if (!emailDetail || !selectedEmail) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
          <Mail className="h-12 w-12 mb-4 opacity-50" />
          <p className="font-medium">Email</p>
          <p className="text-sm">Vyberte email pre zobrazenie detailu</p>
        </div>
      );
    }
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b space-y-2">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-lg font-semibold flex-1 min-w-0">{emailDetail.subject || "(Bez predmetu)"}</h2>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="icon" onClick={() => setupReplyCompose("reply", emailDetail)} data-testid="button-reply">
                <Reply className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setupReplyCompose("replyAll", emailDetail)} data-testid="button-reply-all">
                <ReplyAll className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setupReplyCompose("forward", emailDetail)} data-testid="button-forward">
                <Forward className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost" size="icon"
                onClick={() => toggleReadMutation.mutate({ emailId: emailDetail.id, isRead: !emailDetail.isRead })}
                disabled={toggleReadMutation.isPending}
                title={emailDetail.isRead ? "Označiť ako neprečítané" : "Označiť ako prečítané"}
                data-testid="button-toggle-read"
              >
                {emailDetail.isRead ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              {emailPrefs.aiEnabled && (
                <Button
                  variant="ghost" size="icon"
                  onClick={handleAiSummary}
                  disabled={aiSummaryLoading}
                  title="Súhrn emailu"
                  data-testid="button-email-summary"
                >
                  {aiSummaryLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-blue-500" />}
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => deleteEmailMutation.mutate(emailDetail.id)} data-testid="button-delete">
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setDetailFullscreen(f => !f)} data-testid="button-fullscreen" title={detailFullscreen ? "Zmenšiť" : "Maximalizovať"}>
                {detailFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="text-sm">
            <p className="flex items-center gap-1.5 flex-wrap">
              <span className="text-muted-foreground">Od:</span>
              <span>{emailDetail.from?.emailAddress?.name} &lt;{emailDetail.from?.emailAddress?.address}&gt;</span>
              {emailDetail.from?.emailAddress?.address && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => executeSmartSearch(`from:${emailDetail.from.emailAddress.address}`, "all")}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors text-[11px]"
                        data-testid="quick-search-sender"
                      >
                        <Search className="h-3 w-3" />
                        Ďalšie
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">Zobraziť ďalšie emaily od tohto odosielateľa</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </p>
            <p><span className="text-muted-foreground">Komu:</span> {emailDetail.toRecipients?.map(r => r.emailAddress?.address).join(", ")}</p>
            {emailPrefs.showAllRecipients && emailDetail.ccRecipients && emailDetail.ccRecipients.length > 0 && (
              <p><span className="text-muted-foreground">CC:</span> {emailDetail.ccRecipients.map((r: any) => r.emailAddress?.address).join(", ")}</p>
            )}
            <p className="text-muted-foreground text-xs mt-1">
              {format(new Date(emailDetail.receivedDateTime), "d. MMMM yyyy, HH:mm")}
            </p>
          </div>

          {emailDetail.linkedCustomer && (
            <Link
              href={`/customers?view=${emailDetail.linkedCustomer.id}`}
              className="flex items-center gap-2 mt-2 p-2 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md hover:bg-green-100 dark:hover:bg-green-900 transition-colors cursor-pointer"
              data-testid="link-customer-detail"
            >
              <UserCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-sm text-green-700 dark:text-green-300">Priradené k zákazníkovi:</span>
              <span className="text-sm font-medium text-green-700 dark:text-green-300">
                {emailDetail.linkedCustomer.firstName} {emailDetail.linkedCustomer.lastName}
              </span>
              <span className="text-sm text-green-600 dark:text-green-400">({emailDetail.linkedCustomer.email})</span>
            </Link>
          )}

          {(emailDetail as any).aiAnalysis && (emailDetail as any).aiAnalysis.alertLevel !== "none" && (
            <div
              className={`flex items-start gap-3 mt-2 p-3 rounded-md border ${
                (emailDetail as any).aiAnalysis.alertLevel === "critical"
                  ? "bg-red-50 dark:bg-red-950 border-red-300 dark:border-red-800"
                  : "bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-800"
              }`}
              data-testid="ai-analysis-alert"
            >
              {(emailDetail as any).aiAnalysis.alertLevel === "critical" ? (
                <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold">
                    {(emailDetail as any).aiAnalysis.alertLevel === "critical" ? "Kritické upozornenie" : "Upozornenie"}
                  </span>
                  {(emailDetail as any).aiAnalysis.hasAngryTone && (
                    <Badge variant="outline" className="text-xs border-orange-400 text-orange-600">
                      <Flame className="h-3 w-3 mr-1" />Nahnevaný
                    </Badge>
                  )}
                  {(emailDetail as any).aiAnalysis.wantsToCancel && (
                    <Badge variant="outline" className="text-xs border-red-500 text-red-600">Zrušenie zmluvy</Badge>
                  )}
                  {(emailDetail as any).aiAnalysis.wantsConsent && (
                    <Badge variant="outline" className="text-xs border-green-500 text-green-600">Súhlas</Badge>
                  )}
                </div>
                {(emailDetail as any).aiAnalysis.pipelineActionTaken && (
                  <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-700">
                        Presun do: {(emailDetail as any).aiAnalysis.pipelineStageName}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {getEmailTags(emailDetail.id).map((tag: any) => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full text-white cursor-pointer hover:opacity-80 transition-opacity"
                style={{ backgroundColor: tag.color }}
                onClick={() => currentMailboxEmail && removeTagMutation.mutate({ emailId: emailDetail.id, tagId: tag.id, mailboxEmail: currentMailboxEmail })}
                title="Kliknite pre odstránenie"
                data-testid={`email-tag-${tag.id}`}
              >
                {tag.name}
                <X className="h-2.5 w-2.5" />
              </span>
            ))}
            <Popover open={tagPickerEmailId === emailDetail.id} onOpenChange={(open) => setTagPickerEmailId(open ? emailDetail.id : null)}>
              <PopoverTrigger asChild>
                <button
                  className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  data-testid="button-add-tag"
                >
                  <Tag className="h-2.5 w-2.5" />
                  Tag
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-44 p-1" align="start">
                <div className="space-y-0.5">
                  {userTags.filter((tag: any) => !getEmailTags(emailDetail.id).some((et: any) => et.id === tag.id)).map((tag: any) => (
                    <button
                      key={tag.id}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-accent transition-colors text-left"
                      onClick={() => {
                        if (currentMailboxEmail) {
                          assignTagMutation.mutate({ emailId: emailDetail.id, tagId: tag.id, mailboxEmail: currentMailboxEmail });
                        }
                        setTagPickerEmailId(null);
                      }}
                      data-testid={`assign-tag-${tag.id}`}
                    >
                      <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                      {tag.name}
                    </button>
                  ))}
                  {userTags.filter((tag: any) => !getEmailTags(emailDetail.id).some((et: any) => et.id === tag.id)).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">Všetky tagy priradené</p>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {emailPrefs.attachmentsBeforeContent && emailDetail.attachmentsList && emailDetail.attachmentsList.filter((a: any) => !a.isInline).length > 0 && (
          <div className="px-4 py-2 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
              <Paperclip className="h-3 w-3" />
              Prílohy ({emailDetail.attachmentsList.filter((a: any) => !a.isInline).length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {emailDetail.attachmentsList.filter((a: any) => !a.isInline).map((att: any) => (
                <button
                  key={att.id}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-muted/50 hover:bg-accent transition-colors text-xs"
                  onClick={() => downloadAttachment(emailDetail.id, att.id, att.name)}
                  data-testid={`attachment-download-${att.id}`}
                >
                  <Download className="h-3 w-3 text-muted-foreground" />
                  <span className="max-w-40 truncate">{att.name}</span>
                  <span className="text-muted-foreground">({formatFileSize(att.size)})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {replyMode && (
          <Dialog open={!!replyMode} onOpenChange={(open) => { if (!open) { setReplyMode(null); setReplyFieldsExpanded(false); setReplyModalFullscreen(false); } }}>
            <DialogContent className={cn(
              "flex flex-col gap-0 p-0",
              replyModalFullscreen
                ? "max-w-[100vw] w-[100vw] h-[100vh] max-h-[100vh] rounded-none"
                : "max-w-3xl w-[90vw] max-h-[85vh]"
            )}>
              <DialogHeader className="px-4 py-3 border-b shrink-0">
                <div className="flex items-center justify-between pr-8">
                  <DialogTitle className="text-base">
                    {replyMode === "reply" && "Odpoveď"}
                    {replyMode === "replyAll" && "Odpoveď všetkým"}
                    {replyMode === "forward" && "Preposlať"}
                  </DialogTitle>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setReplyModalFullscreen(f => !f)} title={replyModalFullscreen ? "Zmenšiť" : "Na celú obrazovku"}>
                    {replyModalFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </Button>
                </div>
                <DialogDescription className="sr-only">
                  {replyMode === "reply" ? "Odpoveď na email" : replyMode === "replyAll" ? "Odpoveď všetkým" : "Preposlať email"}
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-auto p-4 space-y-2">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground w-16 shrink-0">Pre:</span>
                    <div className="flex-1">
                      <EmailRecipientInput
                        placeholder="Komu (viac adries oddeľte čiarkou)"
                        value={composeData.to}
                        onChange={(v) => setComposeData({ ...composeData, to: v })}
                        knownEmails={knownEmails}
                        data-testid="input-reply-to"
                      />
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setReplyFieldsExpanded(!replyFieldsExpanded)} title={replyFieldsExpanded ? "Skryť polia" : "Kópia, Skrytá, Reply To"}>
                      {replyFieldsExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  {replyFieldsExpanded && (
                    <>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground w-16 shrink-0">Kópia:</span>
                        <div className="flex-1">
                          <EmailRecipientInput
                            placeholder="Cc"
                            value={composeData.cc}
                            onChange={(v) => setComposeData({ ...composeData, cc: v })}
                            knownEmails={knownEmails}
                            data-testid="input-reply-cc"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground w-16 shrink-0">Skrytá:</span>
                        <div className="flex-1">
                          <EmailRecipientInput
                            placeholder="Bcc"
                            value={composeData.bcc}
                            onChange={(v) => setComposeData({ ...composeData, bcc: v })}
                            knownEmails={knownEmails}
                            data-testid="input-reply-bcc"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground w-16 shrink-0">Reply To:</span>
                        <div className="flex-1">
                          <Input
                            placeholder="Reply-To adresa"
                            value={composeData.replyTo || ""}
                            onChange={(e) => setComposeData({ ...composeData, replyTo: e.target.value })}
                            data-testid="input-reply-replyto"
                          />
                        </div>
                      </div>
                    </>
                  )}
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground w-16 shrink-0">Predmet:</span>
                    <Input
                      placeholder="Predmet"
                      value={composeData.subject}
                      onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                      className="flex-1"
                      data-testid="input-reply-subject"
                    />
                  </div>
                </div>
                <EmailEditor
                  key={`reply-${replyMode}-${selectedEmail?.id}-${aiSuggestCounter}`}
                  initialContent={(() => {
                    if (aiInsertBodyRef.current !== null) {
                      const val = aiInsertBodyRef.current;
                      aiInsertBodyRef.current = null;
                      return val;
                    }
                    return composeData.body;
                  })()}
                  onChange={(html) => setComposeData(prev => ({ ...prev, body: html }))}
                  signatureHtml={getSignatureForCompose()}
                  placeholder="Napíšte odpoveď..."
                  minHeight={replyModalFullscreen ? "300px" : "200px"}
                  attachments={attachments}
                  onAttachmentsChange={setAttachments}
                  showAttachments={true}
                  onAiSuggest={emailPrefs.aiEnabled ? handleAiSuggestReply : undefined}
                  onAiSummary={emailPrefs.aiEnabled ? handleAiSummary : undefined}
                  aiLoading={aiSuggestLoading}
                  aiSummaryLoading={aiSummaryLoading}
                />
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-muted-foreground mb-2">
                    {format(new Date(emailDetail.receivedDateTime), "d. MMMM yyyy, HH:mm")}, {emailDetail.from?.emailAddress?.name || emailDetail.from?.emailAddress?.address} napísal(a):
                  </p>
                  <div className="pl-3 border-l-2 border-muted-foreground/30 max-h-60 overflow-auto">
                    {emailDetail.body?.contentType === "html" ? (
                      <div className="prose dark:prose-invert max-w-none text-sm opacity-70 overflow-hidden [&_img]:max-w-full [&_img]:h-auto [&_table]:table-fixed [&_table]:w-full [&_td]:break-words [&_a]:break-all [&_*]:max-w-full" style={{ overflowWrap: "break-word", wordBreak: "break-word" }} dangerouslySetInnerHTML={{ __html: processHtmlForImages(emailDetail.body.content, emailDetail.id, emailDetail.attachmentsList) }} />
                    ) : (
                      <pre className="whitespace-pre-wrap font-sans text-sm opacity-70" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>{emailDetail.body?.content || emailDetail.bodyPreview}</pre>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter className="px-4 py-3 border-t shrink-0">
                <Button onClick={replyMode === "forward" ? handleForward : handleReply} disabled={replyMutation.isPending || forwardMutation.isPending} data-testid="button-send-reply">
                  {(replyMutation.isPending || forwardMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Send className="h-4 w-4 mr-2" />
                  Odoslať
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        <ScrollArea className="flex-1">
          <div className="p-4 overflow-hidden">
            {emailDetail.body?.contentType === "html" ? (
              <div className="prose dark:prose-invert max-w-none overflow-hidden [&_img]:max-w-full [&_img]:h-auto [&_table]:table-fixed [&_table]:w-full [&_td]:break-words [&_a]:break-all [&_*]:max-w-full" style={{ overflowWrap: "break-word", wordBreak: "break-word" }} dangerouslySetInnerHTML={{ __html: processHtmlForImages(emailDetail.body.content, emailDetail.id, emailDetail.attachmentsList) }} />
            ) : (
              <pre className="whitespace-pre-wrap font-sans text-sm" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>{emailDetail.body?.content || emailDetail.bodyPreview}</pre>
            )}
          </div>
          {!emailPrefs.attachmentsBeforeContent && emailDetail.attachmentsList && emailDetail.attachmentsList.filter((a: any) => !a.isInline).length > 0 && (
            <div className="px-4 py-2 border-t">
              <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                <Paperclip className="h-3 w-3" />
                Prílohy ({emailDetail.attachmentsList.filter((a: any) => !a.isInline).length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {emailDetail.attachmentsList.filter((a: any) => !a.isInline).map((att: any) => (
                  <button
                    key={att.id}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-muted/50 hover:bg-accent transition-colors text-xs"
                    onClick={() => downloadAttachment(emailDetail.id, att.id, att.name)}
                    data-testid={`attachment-download-${att.id}`}
                  >
                    <Download className="h-3 w-3 text-muted-foreground" />
                    <span className="max-w-40 truncate">{att.name}</span>
                    <span className="text-muted-foreground">({formatFileSize(att.size)})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </ScrollArea>
      </div>
    );
  }

  function renderSmsDetail() {
    if (!selectedSms) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
          <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
          <p className="font-medium">SMS</p>
          <p className="text-sm">Vyberte SMS pre zobrazenie detailu</p>
        </div>
      );
    }
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`${typeColors.sms.bg} ${typeColors.sms.text}`}>
                <MessageSquare className="h-3 w-3 mr-1" />
                {selectedSms.direction === "inbound" ? "Prijatá SMS" : "Odoslaná SMS"}
              </Badge>
              <h2 className="text-lg font-semibold">
                {selectedSms.customer
                  ? `${selectedSms.customer.firstName} ${selectedSms.customer.lastName}`
                  : (selectedSms.direction === "inbound" ? selectedSms.senderPhone : selectedSms.recipientPhone)}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {selectedSms.direction === "inbound" ? (
                <Badge variant="outline" className="gap-1 text-cyan-600 border-cyan-400">
                  <ArrowRight className="h-3 w-3 rotate-180" />Prijatá
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-400">
                  <ArrowRight className="h-3 w-3" />Odoslaná
                </Badge>
              )}
              {selectedSms.deliveryStatus && (
                <Badge variant="outline" className="text-xs">{selectedSms.deliveryStatus}</Badge>
              )}
            </div>
          </div>
          <div className="text-sm">
            <p>
              <span className="text-muted-foreground">{selectedSms.direction === "inbound" ? "Od:" : "Pre:"}</span>{" "}
              {selectedSms.direction === "inbound" ? selectedSms.senderPhone : selectedSms.recipientPhone}
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              {format(new Date(selectedSms.sentAt || selectedSms.createdAt), "d. MMMM yyyy, HH:mm")}
            </p>
          </div>

          {selectedSms.customer?.id && (
            <Link
              href={`/customers?view=${selectedSms.customer.id}`}
              className="flex items-center gap-2 mt-2 p-2 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md hover:bg-green-100 dark:hover:bg-green-900 transition-colors cursor-pointer"
              data-testid="sms-link-customer-detail"
            >
              <UserCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-sm text-green-700 dark:text-green-300">Priradené k zákazníkovi:</span>
              <span className="text-sm font-medium text-green-700 dark:text-green-300">
                {selectedSms.customer.firstName} {selectedSms.customer.lastName}
              </span>
            </Link>
          )}

          {selectedSms.aiAnalyzed && selectedSms.aiAlertLevel && selectedSms.aiAlertLevel !== "none" && (
            <div
              className={`flex items-start gap-3 mt-3 p-3 rounded-md border ${
                selectedSms.aiAlertLevel === "critical"
                  ? "bg-red-50 dark:bg-red-950 border-red-300 dark:border-red-800"
                  : "bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-800"
              }`}
              data-testid="sms-ai-analysis-alert"
            >
              {selectedSms.aiAlertLevel === "critical" ? (
                <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold">
                    {selectedSms.aiAlertLevel === "critical" ? "Kritické upozornenie" : "Upozornenie"}
                  </span>
                  {selectedSms.aiHasAngryTone && (
                    <Badge variant="outline" className="text-xs border-orange-400 text-orange-600">
                      <Flame className="h-3 w-3 mr-1" />Nahnevaný
                    </Badge>
                  )}
                  {selectedSms.aiHasRudeExpressions && (
                    <Badge variant="outline" className="text-xs border-purple-400 text-purple-600">Hrubé výrazy</Badge>
                  )}
                  {selectedSms.aiWantsToCancel && (
                    <Badge variant="outline" className="text-xs border-red-500 text-red-600">Zrušenie zmluvy</Badge>
                  )}
                  {selectedSms.aiWantsConsent && (
                    <Badge variant="outline" className="text-xs border-green-500 text-green-600">Súhlas</Badge>
                  )}
                  {selectedSms.aiDoesNotAcceptContract && (
                    <Badge variant="outline" className="text-xs border-red-500 text-red-600">Odmietnutie zmluvy</Badge>
                  )}
                </div>
                {selectedSms.aiAnalysisNote && (
                  <p className="text-xs text-muted-foreground mt-1">{selectedSms.aiAnalysisNote}</p>
                )}
              </div>
            </div>
          )}
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4">
            <div className={`p-4 rounded-lg ${selectedSms.direction === "inbound" ? "bg-cyan-50 dark:bg-cyan-950/30" : "bg-slate-50 dark:bg-slate-900"}`}>
              <p className="text-sm whitespace-pre-wrap" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>{selectedSms.content}</p>
            </div>
          </div>
        </ScrollArea>
        {(() => {
          const replyPhone = selectedSms.direction === "inbound" ? selectedSms.senderPhone : selectedSms.recipientPhone;
          if (!replyPhone) return null;
          return (
            <div className="p-3 border-t flex gap-2" data-testid="sms-reply-bar">
              <Input
                placeholder={`Odpovedať na ${replyPhone}...`}
                value={smsReplyText}
                onChange={(e) => setSmsReplyText(e.target.value)}
                maxLength={160}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && smsReplyText.trim() && !smsReplySending) {
                    e.preventDefault();
                    setSmsReplySending(true);
                    fetch("/api/send-sms", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ to: replyPhone, message: smsReplyText.trim(), customerId: selectedSms.customer?.id || null }),
                    })
                      .then(r => r.json())
                      .then(data => {
                        if (data.error) throw new Error(data.error);
                        toast({ title: "SMS odoslaná", description: `Správa odoslaná na ${replyPhone}` });
                        setSmsReplyText("");
                      })
                      .catch(err => toast({ title: "Chyba", description: err.message, variant: "destructive" }))
                      .finally(() => setSmsReplySending(false));
                  }
                }}
                data-testid="sms-reply-input"
              />
              <Button
                size="sm"
                disabled={!smsReplyText.trim() || smsReplySending}
                onClick={() => {
                  if (!smsReplyText.trim() || smsReplySending) return;
                  setSmsReplySending(true);
                  fetch("/api/send-sms", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ to: replyPhone, message: smsReplyText.trim(), customerId: selectedSms.customer?.id || null }),
                  })
                    .then(r => r.json())
                    .then(data => {
                      if (data.error) throw new Error(data.error);
                      toast({ title: "SMS odoslaná", description: `Správa odoslaná na ${replyPhone}` });
                      setSmsReplyText("");
                    })
                    .catch(err => toast({ title: "Chyba", description: err.message, variant: "destructive" }))
                    .finally(() => setSmsReplySending(false));
                }}
                data-testid="sms-reply-send"
              >
                {smsReplySending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          );
        })()}
      </div>
    );
  }

  function renderTaskDetail() {
    if (!selectedTask) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
          <ListTodo className="h-12 w-12 mb-4 opacity-50" />
          <p className="font-medium">Úlohy</p>
          <p className="text-sm">Vyberte úlohu pre zobrazenie detailu</p>
        </div>
      );
    }
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`${typeColors.task.bg} ${typeColors.task.text}`}>
                <ListTodo className="h-3 w-3 mr-1" />Úloha
              </Badge>
              <h2 className="text-lg font-semibold">{selectedTask.title}</h2>
            </div>
            <div className="flex items-center gap-2">
              {selectedTask.priority && (
                <Badge variant="outline" className="gap-1">
                  {priorityIcons[selectedTask.priority]}
                  {selectedTask.priority}
                </Badge>
              )}
              <Badge variant="outline" className="gap-1">
                {statusIcons[selectedTask.status]}
                {selectedTask.status}
              </Badge>
            </div>
          </div>
          {selectedTask.dueDate && (
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Termín: {format(new Date(selectedTask.dueDate), "d. MMMM yyyy")}
            </p>
          )}
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4">
            <p className="text-sm whitespace-pre-wrap" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>{selectedTask.description || "Bez popisu"}</p>
          </div>
        </ScrollArea>
      </div>
    );
  }

  function renderEmailModal() {
    if (!modalEmail) return null;

    const detail = emailDetail?.id === modalEmail.id ? emailDetail : modalEmail;

    return (
      <Dialog open={!!modalEmail} onOpenChange={(open) => { if (!open) setModalEmail(null); }}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 gap-0" data-testid="email-modal">
          <div className="px-5 py-4 border-b space-y-3 shrink-0">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-lg font-semibold flex-1 min-w-0 pr-8">{detail.subject || "(Bez predmetu)"}</h2>
              <div className="flex items-center gap-1 shrink-0">
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setupReplyCompose("reply", detail); setModalEmail(null); }} data-testid="modal-reply">
                        <Reply className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Odpovedať</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setupReplyCompose("replyAll", detail); setModalEmail(null); }} data-testid="modal-reply-all">
                        <ReplyAll className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Odpovedať všetkým</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setupReplyCompose("forward", detail); setModalEmail(null); }} data-testid="modal-forward">
                        <Forward className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Preposlať</TooltipContent>
                  </Tooltip>
                  <div className="w-px h-5 bg-border mx-0.5" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => {
                          toggleReadMutation.mutate({ emailId: detail.id, isRead: !detail.isRead, mailbox: detail._mailboxEmail ? getMailboxParam(detail._mailboxEmail) : undefined });
                          setModalEmail(prev => prev ? { ...prev, isRead: !prev.isRead } : null);
                        }}
                        disabled={toggleReadMutation.isPending}
                        data-testid="modal-toggle-read"
                      >
                        {detail.isRead ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{detail.isRead ? "Označiť ako neprečítané" : "Označiť ako prečítané"}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { deleteEmailMutation.mutate(detail.id); setModalEmail(null); }} data-testid="modal-delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Zmazať</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            <div className="text-sm space-y-0.5">
              <p>
                <span className="text-muted-foreground">Od:</span>{" "}
                <span className="font-medium">{detail.from?.emailAddress?.name}</span>{" "}
                <span className="text-muted-foreground">&lt;{detail.from?.emailAddress?.address}&gt;</span>
              </p>
              <p>
                <span className="text-muted-foreground">Komu:</span>{" "}
                {detail.toRecipients?.map(r => r.emailAddress?.address).join(", ")}
              </p>
              {detail.ccRecipients && detail.ccRecipients.length > 0 && (
                <p>
                  <span className="text-muted-foreground">Cc:</span>{" "}
                  {detail.ccRecipients.map(r => r.emailAddress?.address).join(", ")}
                </p>
              )}
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-muted-foreground">
                  {format(new Date(detail.receivedDateTime), "d. MMMM yyyy, HH:mm")}
                </span>
                {detail.hasAttachments && (
                  <Badge variant="outline" className="text-[10px] gap-1 h-5">
                    <Paperclip className="h-3 w-3" />Prílohy
                  </Badge>
                )}
                {detail.importance === "high" && (
                  <Badge variant="outline" className="text-[10px] gap-1 h-5 border-amber-400 text-amber-600">
                    <Star className="h-3 w-3" />Dôležité
                  </Badge>
                )}
                <Badge variant={detail.isRead ? "secondary" : "default"} className="text-[10px] h-5">
                  {detail.isRead ? "Prečítané" : "Neprečítané"}
                </Badge>
              </div>
            </div>

            {detail.linkedCustomer && (
              <Link
                href={`/customers?view=${detail.linkedCustomer.id}`}
                className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md hover:bg-green-100 dark:hover:bg-green-900 transition-colors cursor-pointer"
                onClick={() => setModalEmail(null)}
                data-testid="modal-link-customer"
              >
                <UserCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-sm text-green-700 dark:text-green-300">
                  {detail.linkedCustomer.firstName} {detail.linkedCustomer.lastName}
                </span>
                <span className="text-sm text-green-600 dark:text-green-400">({detail.linkedCustomer.email})</span>
              </Link>
            )}

            {(detail as any).aiAnalysis && (detail as any).aiAnalysis.alertLevel !== "none" && (
              <div
                className={`flex items-start gap-3 p-3 rounded-md border ${
                  (detail as any).aiAnalysis.alertLevel === "critical"
                    ? "bg-red-50 dark:bg-red-950 border-red-300 dark:border-red-800"
                    : "bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-800"
                }`}
              >
                {(detail as any).aiAnalysis.alertLevel === "critical" ? (
                  <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">
                      {(detail as any).aiAnalysis.alertLevel === "critical" ? "Kritické upozornenie" : "Upozornenie"}
                    </span>
                    {(detail as any).aiAnalysis.hasAngryTone && (
                      <Badge variant="outline" className="text-xs border-orange-400 text-orange-600">
                        <Flame className="h-3 w-3 mr-1" />Nahnevaný
                      </Badge>
                    )}
                    {(detail as any).aiAnalysis.wantsToCancel && (
                      <Badge variant="outline" className="text-xs border-red-500 text-red-600">Zrušenie</Badge>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          {detail.attachmentsList && detail.attachmentsList.filter((a: any) => !a.isInline).length > 0 && (
            <div className="px-5 py-2 border-t">
              <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                <Paperclip className="h-3 w-3" />
                Prílohy ({detail.attachmentsList.filter((a: any) => !a.isInline).length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {detail.attachmentsList.filter((a: any) => !a.isInline).map((att: any) => (
                  <button
                    key={att.id}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-muted/50 hover:bg-accent transition-colors text-xs"
                    onClick={() => downloadAttachment(detail.id, att.id, att.name)}
                    data-testid={`modal-attachment-${att.id}`}
                  >
                    <Download className="h-3 w-3 text-muted-foreground" />
                    <span className="max-w-40 truncate">{att.name}</span>
                    <span className="text-muted-foreground">({formatFileSize(att.size)})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-5 overflow-hidden">
              {detail.body?.contentType === "html" ? (
                <div className="prose dark:prose-invert max-w-none overflow-hidden [&_img]:max-w-full [&_img]:h-auto [&_table]:table-fixed [&_table]:w-full [&_td]:break-words [&_a]:break-all [&_*]:max-w-full" style={{ overflowWrap: "break-word", wordBreak: "break-word" }} dangerouslySetInnerHTML={{ __html: processHtmlForImages(detail.body.content, detail.id, detail.attachmentsList) }} />
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-sm" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>{detail.body?.content || detail.bodyPreview}</pre>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    );
  }

  function renderSettingsContent() {
    const TAG_COLORS = ["#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899", "#6B7280", "#0EA5E9", "#14B8A6", "#F97316"];
    const ACCOUNT_COLORS = ["#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#0EA5E9", "#14B8A6", "#F97316", "#6366F1", "#84CC16", "#6B7280"];

    const SettingRow = ({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) => (
      <div className="flex items-center justify-between gap-4 py-2.5">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{label}</p>
          {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
        </div>
        <div className="shrink-0">{children}</div>
      </div>
    );

    const SectionTitle = ({ children }: { children: React.ReactNode }) => (
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-4 first:mt-0">{children}</h3>
    );

    if (settingsTab === "accounts") {
      return (
        <div>
          <h2 className="text-lg font-semibold mb-1">Účty</h2>
          <p className="text-sm text-muted-foreground mb-4">Pripojené emailové účty, ikony a farby pre bočný panel.</p>
          <div className="space-y-4">
            {mailboxes.map((mb) => {
              const mbEmail = mb.email;
              const currentColor = mailboxColorMap[mbEmail] || null;
              const cfg = accountConfigs[mbEmail] || { icon: "mail", color: currentColor || "#6B7280", enabled: true };
              const selectedIcon = ACCOUNT_ICONS.find(i => i.key === cfg.icon);
              return (
                <div key={mb.id} className="p-3 rounded-lg border hover:bg-accent/30 transition-colors space-y-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="h-8 w-8 rounded-full shrink-0 flex items-center justify-center text-sm shadow-sm"
                      style={{ backgroundColor: cfg.color || "#6B7280" }}
                    >
                      <AccountIcon iconKey={cfg.icon} className="h-4 w-4 text-white" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{mb.displayName || mb.email}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{mb.email}</p>
                    </div>
                    <Badge variant={mb.type === "personal" ? "default" : "secondary"} className="text-[10px] shrink-0">
                      {mb.type === "personal" ? "Osobná" : "Zdieľaná"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-1.5">Ikona v bočnom paneli</p>
                    <div className="flex flex-wrap gap-1">
                      {ACCOUNT_ICONS.map(icon => (
                        <button
                          key={icon.key}
                          onClick={() => updateAccountConfig(mbEmail, { ...cfg, icon: icon.key })}
                          className={`h-7 w-7 rounded-md flex items-center justify-center transition-all hover:scale-110 ${cfg.icon === icon.key ? "ring-2 ring-primary bg-primary/10" : "hover:bg-accent"}`}
                          title={icon.label}
                          data-testid={`account-icon-${mb.id}-${icon.key}`}
                        >
                          <AccountIcon iconKey={icon.key} className="h-4 w-4 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-1.5">Farba účtu</p>
                    <div className="flex items-center gap-1">
                      {ACCOUNT_COLORS.map(color => (
                        <button
                          key={color}
                          onClick={() => {
                            updateAccountConfig(mbEmail, { ...cfg, color });
                            upsertMailboxColorMutation.mutate({ mailboxEmail: mbEmail, color });
                          }}
                          className={`h-5 w-5 rounded-full transition-all hover:scale-110 ${cfg.color === color ? "ring-2 ring-offset-2 ring-primary" : ""}`}
                          style={{ backgroundColor: color }}
                          data-testid={`account-color-${mb.id}-${color}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
            {mailboxes.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Mail className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Žiadne pripojené účty</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (settingsTab === "messages") {
      return (
        <div>
          <h2 className="text-lg font-semibold mb-1">Správy</h2>
          <p className="text-sm text-muted-foreground mb-4">Nastavenia zobrazenia zoznamu a detailu emailov.</p>

          <SectionTitle>Zoznam správ</SectionTitle>
          <div className="divide-y">
            <SettingRow label="Iniciály odosielateľa" description="Zobrazí kruhový avatar s iniciálami v zozname">
              <Switch checked={emailPrefs.showSenderInitials} onCheckedChange={(v) => updateEmailPref("showSenderInitials", v)} />
            </SettingRow>
            <SettingRow label="Ikony účtov" description="Farebná bodka podľa priradenia účtu">
              <Switch checked={emailPrefs.showAccountIcons} onCheckedChange={(v) => updateEmailPref("showAccountIcons", v)} />
            </SettingRow>
            <SettingRow label="Zvýrazniť neprečítané" description="Tučné písmo pre neprečítané správy">
              <Switch checked={emailPrefs.highlightUnread} onCheckedChange={(v) => updateEmailPref("highlightUnread", v)} />
            </SettingRow>
            <SettingRow label="Indikátor neprečítaných" description="Modrá bodka pri neprečítaných správach">
              <Switch checked={emailPrefs.unreadIndicator} onCheckedChange={(v) => updateEmailPref("unreadIndicator", v)} />
            </SettingRow>
            <SettingRow label="Zobraziť tagy" description="Farebné štítky v zozname správ">
              <Switch checked={emailPrefs.showTags} onCheckedChange={(v) => updateEmailPref("showTags", v)} />
            </SettingRow>
            <SettingRow label="Ikony príloh" description="Ikona spinky pri správach s prílohami">
              <Switch checked={emailPrefs.previewAttachmentIcons} onCheckedChange={(v) => updateEmailPref("previewAttachmentIcons", v)} />
            </SettingRow>
            <SettingRow label="Zoskupovať podľa dátumu" description="Oddeliť správy podľa dní">
              <Switch checked={emailPrefs.groupByDate} onCheckedChange={(v) => updateEmailPref("groupByDate", v)} />
            </SettingRow>
            <SettingRow label="Riadky náhľadu" description="Počet riadkov textu náhľadu v zozname">
              <Select value={String(emailPrefs.previewLines)} onValueChange={(v) => updateEmailPref("previewLines", parseInt(v))}>
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Žiadny</SelectItem>
                  <SelectItem value="1">1 riadok</SelectItem>
                  <SelectItem value="2">2 riadky</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>
            <SettingRow label="Predvolené radenie" description="Predvolené zoradenie emailov">
              <Select value={emailPrefs.defaultSort} onValueChange={(v) => { updateEmailPref("defaultSort", v); setEmailSort(v as any); }}>
                <SelectTrigger className="w-40 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-desc">Dátum (najnovšie)</SelectItem>
                  <SelectItem value="date-asc">Dátum (najstaršie)</SelectItem>
                  <SelectItem value="sender-asc">Odosielateľ (A→Z)</SelectItem>
                  <SelectItem value="sender-desc">Odosielateľ (Z→A)</SelectItem>
                  <SelectItem value="subject-asc">Predmet (A→Z)</SelectItem>
                  <SelectItem value="subject-desc">Predmet (Z→A)</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>
          </div>

          <SectionTitle>Detail správy</SectionTitle>
          <div className="divide-y">
            <SettingRow label="Automaticky nahrať obrázky" description="Načítať vzdialené obrázky v tele emailu">
              <Switch checked={emailPrefs.autoLoadImages} onCheckedChange={(v) => updateEmailPref("autoLoadImages", v)} />
            </SettingRow>
            <SettingRow label="Zobraziť všetkých príjemcov" description="V detaile zobraziť CC a BCC príjemcov">
              <Switch checked={emailPrefs.showAllRecipients} onCheckedChange={(v) => updateEmailPref("showAllRecipients", v)} />
            </SettingRow>
            <SettingRow label="Rozbalené telo správy" description="Automaticky zobraziť celý obsah emailu">
              <Switch checked={emailPrefs.expandBodyMessages} onCheckedChange={(v) => updateEmailPref("expandBodyMessages", v)} />
            </SettingRow>
            <SettingRow label="Prílohy pred obsahom" description="Zobraziť prílohy nad telom emailu">
              <Switch checked={emailPrefs.attachmentsBeforeContent} onCheckedChange={(v) => updateEmailPref("attachmentsBeforeContent", v)} />
            </SettingRow>
          </div>

        </div>
      );
    }

    if (settingsTab === "ai") {
      return (
        <div>
          <h2 className="text-lg font-semibold mb-1">AI Asistent</h2>
          <p className="text-sm text-muted-foreground mb-4">Nastavenia umelej inteligencie pre emailovú komunikáciu.</p>

          <SectionTitle>Základné nastavenia</SectionTitle>
          <div className="divide-y">
            <SettingRow label="Povoliť AI" description="Zapnúť AI funkcie (odpoveď, zhrnutie, preklad)">
              <Switch checked={emailPrefs.aiEnabled} onCheckedChange={(v) => updateEmailPref("aiEnabled", v)} />
            </SettingRow>
          </div>

          {emailPrefs.aiEnabled && (
            <>
              <SectionTitle>Jazyk AI odpovede</SectionTitle>
              <div className="divide-y">
                <SettingRow label="Režim jazyka" description="V akom jazyku má AI generovať odpovede a zhrnutia">
                  <Select value={emailPrefs.aiLanguageMode} onValueChange={(v) => updateEmailPref("aiLanguageMode", v)}>
                    <SelectTrigger className="w-52 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Jazyk emailovej správy</SelectItem>
                      <SelectItem value="user">Preklad do zvoleného jazyka</SelectItem>
                    </SelectContent>
                  </Select>
                </SettingRow>
                {emailPrefs.aiLanguageMode === "user" && (
                  <SettingRow label="Cieľový jazyk" description="Do akého jazyka preložiť AI výstup">
                    <Select value={emailPrefs.aiUserLanguage} onValueChange={(v) => updateEmailPref("aiUserLanguage", v)}>
                      <SelectTrigger className="w-40 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sk">Slovenčina</SelectItem>
                        <SelectItem value="cs">Čeština</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="de">Deutsch</SelectItem>
                        <SelectItem value="hu">Magyar</SelectItem>
                        <SelectItem value="ro">Română</SelectItem>
                        <SelectItem value="pl">Polski</SelectItem>
                        <SelectItem value="it">Italiano</SelectItem>
                        <SelectItem value="fr">Français</SelectItem>
                        <SelectItem value="es">Español</SelectItem>
                      </SelectContent>
                    </Select>
                  </SettingRow>
                )}
              </div>
            </>
          )}
        </div>
      );
    }

    if (settingsTab === "notifications") {
      return (
        <div>
          <h2 className="text-lg font-semibold mb-1">Notifikácie a zvuky</h2>
          <p className="text-sm text-muted-foreground mb-4">Nastavenia zvukových notifikácií a automatickej kontroly pošty.</p>

          <SectionTitle>Zvuky</SectionTitle>
          <div className="divide-y">
            <SettingRow label="Zvuk odoslania" description="Prehrať zvuk po úspešnom odoslaní emailu">
              <Switch checked={emailPrefs.soundOnSend} onCheckedChange={(v) => updateEmailPref("soundOnSend", v)} />
            </SettingRow>
            <SettingRow label="Zvuk prijatia" description="Prehrať zvuk pri doručení nového emailu">
              <Switch checked={emailPrefs.soundOnReceive} onCheckedChange={(v) => updateEmailPref("soundOnReceive", v)} />
            </SettingRow>
          </div>

          <SectionTitle>Kontrola pošty</SectionTitle>
          <div className="divide-y">
            <SettingRow label="Automatická kontrola" description="Pravidelne kontrolovať novú poštu">
              <Switch checked={emailPrefs.pollingEnabled} onCheckedChange={(v) => updateEmailPref("pollingEnabled", v)} />
            </SettingRow>
            {emailPrefs.pollingEnabled && (
              <SettingRow label="Interval kontroly" description="Ako často kontrolovať novú poštu">
                <Select value={String(emailPrefs.pollingInterval)} onValueChange={(v) => updateEmailPref("pollingInterval", parseInt(v))}>
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">Každých 5 sekúnd</SelectItem>
                    <SelectItem value="10">Každých 10 sekúnd</SelectItem>
                    <SelectItem value="15">Každých 15 sekúnd</SelectItem>
                    <SelectItem value="30">Každých 30 sekúnd</SelectItem>
                    <SelectItem value="60">Každú minútu</SelectItem>
                    <SelectItem value="120">Každé 2 minúty</SelectItem>
                    <SelectItem value="300">Každých 5 minút</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>
            )}
          </div>
        </div>
      );
    }

    if (settingsTab === "compose") {
      const sigMailboxes = mailboxes.map(m => ({
        key: m.type === "personal" ? "personal" : m.email,
        label: m.email,
        type: m.type,
      }));
      const activeSigMailbox = sigEditMailbox || sigMailboxes[0]?.key || "";
      const currentSig = allSignatures.find((s: EmailSignature) => s.mailboxEmail === activeSigMailbox);

      const loadSigForMailbox = (mbxKey: string) => {
        setSigEditMailbox(mbxKey);
        const sig = allSignatures.find((s: EmailSignature) => s.mailboxEmail === mbxKey);
        setSignatureHtml(sig?.htmlContent || "");
        setSignatureActive(sig?.isActive !== false);
      };

      return (
        <div>
          <h2 className="text-lg font-semibold mb-1">Písanie</h2>
          <p className="text-sm text-muted-foreground mb-4">Podpisy pre emailové účty. Každý účet môže mať vlastný podpis s obrázkami.</p>

          <SectionTitle>Emailový účet</SectionTitle>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {sigMailboxes.map(mb => {
              const hasSig = allSignatures.some((s: EmailSignature) => s.mailboxEmail === mb.key && s.htmlContent && s.isActive);
              return (
                <button
                  key={mb.key}
                  onClick={() => loadSigForMailbox(mb.key)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all",
                    activeSigMailbox === mb.key
                      ? "bg-primary/10 border-primary text-primary font-medium shadow-sm"
                      : "hover:bg-accent/50 border-border text-muted-foreground"
                  )}
                  data-testid={`sig-account-${mb.key}`}
                >
                  <Mail className="h-3.5 w-3.5" />
                  <span className="truncate max-w-48">{mb.label}</span>
                  {hasSig && <Check className="h-3 w-3 text-green-500" />}
                </button>
              );
            })}
          </div>

          <SectionTitle>Podpis pre {sigMailboxes.find(m => m.key === activeSigMailbox)?.label || activeSigMailbox}</SectionTitle>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Switch id="signature-active" checked={signatureActive} onCheckedChange={(c) => setSignatureActive(!!c)} />
              <label htmlFor="signature-active" className="text-sm font-medium">Aktívny podpis</label>
            </div>
            <p className="text-[12px] text-muted-foreground">Podpis sa automaticky pridá na koniec emailov odoslaných z tohto účtu. Môžete vložiť aj obrázky cez ikonu obrázka v paneli nástrojov.</p>
            <EmailEditor
              key={`sig-${activeSigMailbox}`}
              initialContent={signatureHtml}
              onChange={(html) => setSignatureHtml(html)}
              placeholder="Váš podpis... (použite ikonu obrázka pre vloženie loga)"
              minHeight="200px"
              showAttachments={false}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {currentSig ? "Posledná úprava: " + new Date(currentSig.updatedAt).toLocaleString("sk-SK") : "Žiadny podpis pre tento účet"}
              </p>
              <Button
                onClick={() => saveSignatureMutation.mutate({ htmlContent: signatureHtml, isActive: signatureActive, mailboxEmail: activeSigMailbox })}
                disabled={saveSignatureMutation.isPending}
                data-testid="button-save-signature"
              >
                {saveSignatureMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Uložiť podpis
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (settingsTab === "tags") {
      return (
        <div>
          <h2 className="text-lg font-semibold mb-1">Tagy</h2>
          <p className="text-sm text-muted-foreground mb-4">Vytvárajte a spravujte farebné tagy pre organizáciu emailov.</p>

          <div className="flex items-center gap-2 mb-4">
            <Input
              placeholder="Názov nového tagu..."
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              className="flex-1 h-9"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTagName.trim()) {
                  createTagMutation.mutate({ name: newTagName.trim(), color: newTagColor });
                  setNewTagName("");
                }
              }}
              data-testid="input-new-tag-name"
            />
            <Popover>
              <PopoverTrigger asChild>
                <button className="h-7 w-7 rounded-full shrink-0 ring-2 ring-offset-2 ring-muted hover:ring-primary transition-all" style={{ backgroundColor: newTagColor }} />
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="end">
                <div className="grid grid-cols-5 gap-1.5">
                  {TAG_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setNewTagColor(color)}
                      className={`h-7 w-7 rounded-full transition-all hover:scale-110 ${newTagColor === color ? "ring-2 ring-offset-2 ring-primary" : ""}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Button
              size="sm"
              onClick={() => {
                if (newTagName.trim()) {
                  createTagMutation.mutate({ name: newTagName.trim(), color: newTagColor });
                  setNewTagName("");
                }
              }}
              disabled={!newTagName.trim() || createTagMutation.isPending}
              data-testid="button-create-tag"
            >
              {createTagMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Pridať
            </Button>
          </div>

          <div className="space-y-1">
            {userTags.map((tag: any) => (
              <div key={tag.id} className="flex items-center gap-2.5 p-2.5 rounded-lg border hover:bg-accent/30 transition-colors group">
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="h-5 w-5 rounded-full shrink-0 hover:ring-2 hover:ring-offset-1 hover:ring-primary transition-all cursor-pointer" style={{ backgroundColor: tag.color }} title="Zmeniť farbu" />
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2" align="start">
                    <div className="grid grid-cols-5 gap-1.5">
                      {TAG_COLORS.map(color => (
                        <button
                          key={color}
                          onClick={() => updateTagMutation.mutate({ id: tag.id, color })}
                          className={`h-7 w-7 rounded-full transition-all hover:scale-110 ${tag.color === color ? "ring-2 ring-offset-2 ring-primary" : ""}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <span className="flex-1 text-sm font-medium">{tag.name}</span>
                {tag.isDefault && (
                  <Badge variant="secondary" className="text-[10px] h-5">Predvolený</Badge>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={() => deleteTagMutation.mutate(tag.id)}
                  data-testid={`delete-tag-${tag.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {userTags.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Tag className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Zatiaľ žiadne tagy</p>
                <p className="text-xs mt-1">Vytvorte si vlastné tagy pre organizáciu emailov</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (settingsTab === "appearance") {
      return (
        <div>
          <h2 className="text-lg font-semibold mb-1">Vzhľad</h2>
          <p className="text-sm text-muted-foreground mb-4">Prispôsobte si zobrazenie NEXUS klienta.</p>

          <SectionTitle>Rozloženie</SectionTitle>
          <div className="divide-y">
            <SettingRow label="Postranný panel" description="Zobraziť alebo skryť postranný panel s priečinkami">
              <Switch checked={!isSidebarHidden} onCheckedChange={(v) => { setIsSidebarHidden(!v); localStorage.setItem("nexus-sidebar-hidden", String(!v)); }} />
            </SettingRow>
          </div>

          <SectionTitle>Informácie</SectionTitle>
          <div className="rounded-lg border p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Aktuálny účet</span>
              <span className="font-medium">{currentMailboxEmail || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Načítaných emailov</span>
              <span className="font-medium">{emails.length} / {totalCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Priečinkov</span>
              <span className="font-medium">{folders.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tagov</span>
              <span className="font-medium">{userTags.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pripojených účtov</span>
              <span className="font-medium">{mailboxes.length}</span>
            </div>
          </div>
        </div>
      );
    }

    return null;
  }
}
