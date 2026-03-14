import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Link } from "wouter";

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
  RefreshCw,
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
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import Editor from "react-simple-wysiwyg";

import NexusSidebar, { ACCOUNT_ICONS, type AccountIconConfig } from "@/components/nexus/nexus-sidebar";
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

export default function EmailClientPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<NexusTab>("email");
  const [selectedMailbox, setSelectedMailbox] = useState<string>("personal");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedChat, _setSelectedChat] = useState<ChatConversation | null>(null);
  const [selectedSms, setSelectedSms] = useState<SmsMessage | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyMode, setReplyMode] = useState<"reply" | "replyAll" | "forward" | null>(null);
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
  const [settingsTab, setSettingsTab] = useState<"accounts" | "messages" | "compose" | "tags" | "appearance">("messages");
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
    return saved ? JSON.parse(saved) : {
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
    };
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
  const [composeData, setComposeData] = useState({ to: "", cc: "", bcc: "", subject: "", body: "", importance: "normal" as string, tagId: null as number | null });
  const [signatureHtml, setSignatureHtml] = useState("");
  const [signatureActive, setSignatureActive] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchMailbox, setSearchMailbox] = useState<string>("all");
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

  const { data: foldersData, isLoading: foldersLoading, refetch: refetchFolders } = useQuery<{ connected: boolean; folders: MailFolder[]; inboxId?: string | null }>({
    queryKey: ["/api/users", user?.id, "ms365-folders", selectedMailbox],
    queryFn: () => fetch(`/api/users/${user?.id}/ms365-folders?mailbox=${selectedMailbox}`).then(r => r.json()),
    enabled: !!user?.id && !!selectedMailbox,
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
    queryFn: () => {
      return fetch(`/api/users/${user?.id}/ms365-folder-messages/${selectedFolderId}?mailbox=${selectedMailbox}&top=${pageSize}&skip=${page * pageSize}`).then(r => r.json());
    },
    enabled: !!user?.id && !!selectedFolderId && activeTab === "email",
  });

  useEffect(() => {
    if (messagesData?.emails) {
      if (page === 0) {
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

  const { data: emailDetail, isLoading: detailLoading } = useQuery<EmailMessage>({
    queryKey: ["/api/users", user?.id, "ms365-email", selectedEmail?.id, selectedMailbox],
    queryFn: () => fetch(`/api/users/${user?.id}/ms365-email/${selectedEmail?.id}?mailbox=${selectedMailbox}`).then(r => r.json()),
    enabled: !!user?.id && !!selectedEmail?.id,
  });

  const { data: signatureData } = useQuery<EmailSignature>({
    queryKey: ["/api/users", user?.id, "email-signatures", selectedMailbox],
    queryFn: () => fetch(`/api/users/${user?.id}/email-signatures/${selectedMailbox}`).then(r => r.json()),
    enabled: !!user?.id && !!selectedMailbox,
  });

  const currentMailboxEmail = selectedMailbox === "personal"
    ? mailboxes.find(m => m.type === "personal")?.email
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
    queryKey: ["/api/users", user?.id, "ms365-search-emails", debouncedSearchQuery, searchMailbox],
    queryFn: async () => {
      if (!debouncedSearchQuery || debouncedSearchQuery.trim().length < 2) return [];
      const mailboxesToSearch = searchMailbox === "all"
        ? mailboxes.map(m => m.type === "personal" ? "personal" : m.email)
        : [searchMailbox];
      const results: { emails: EmailMessage[]; mailbox: string }[] = [];
      for (const mbx of mailboxesToSearch) {
        try {
          const response = await fetch(`/api/users/${user?.id}/ms365-search-emails?q=${encodeURIComponent(debouncedSearchQuery)}&mailbox=${mbx}&top=50`);
          const data = await response.json();
          results.push({
            emails: data.emails || [],
            mailbox: mbx === "personal" ? (mailboxes.find(m => m.type === "personal")?.email || "Osobná schránka") : mbx
          });
        } catch {
          results.push({ emails: [], mailbox: mbx });
        }
      }
      return results;
    },
    enabled: !!user?.id && isSearching && !!debouncedSearchQuery && debouncedSearchQuery.trim().length >= 2,
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
    setIsSearching(false);
  };

  const sendEmailMutation = useMutation({
    mutationFn: async (data: { to: string[]; cc?: string[]; bcc?: string[]; subject: string; body: string; mailboxEmail: string }) => {
      return apiRequest("POST", `/api/users/${user?.id}/ms365-send-email`, data);
    },
    onSuccess: () => {
      toast({ title: "Odoslané", description: "Správa bola úspešne odoslaná" });
      setComposeOpen(false);
      setComposeData({ to: "", cc: "", bcc: "", subject: "", body: "", importance: "normal", tagId: null });
      setAttachments([]);
      refetchMessages();
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa odoslať správu", variant: "destructive" });
    },
  });

  const replyMutation = useMutation({
    mutationFn: async (data: { emailId: string; body: string; replyAll: boolean; mailboxEmail: string }) => {
      return apiRequest("POST", `/api/users/${user?.id}/ms365-reply/${data.emailId}`, data);
    },
    onSuccess: () => {
      toast({ title: "Odoslané", description: "Odpoveď bola úspešne odoslaná" });
      setReplyMode(null);
      setComposeData({ to: "", cc: "", bcc: "", subject: "", body: "", importance: "normal", tagId: null });
      refetchMessages();
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa odoslať odpoveď", variant: "destructive" });
    },
  });

  const forwardMutation = useMutation({
    mutationFn: async (data: { emailId: string; to: string[]; body: string; mailboxEmail: string }) => {
      return apiRequest("POST", `/api/users/${user?.id}/ms365-forward/${data.emailId}`, data);
    },
    onSuccess: () => {
      toast({ title: "Odoslané", description: "Správa bola úspešne preposlaná" });
      setReplyMode(null);
      setComposeData({ to: "", cc: "", bcc: "", subject: "", body: "", importance: "normal", tagId: null });
      refetchMessages();
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa preposlať správu", variant: "destructive" });
    },
  });

  const deleteEmailMutation = useMutation({
    mutationFn: async (emailId: string) => {
      return apiRequest("DELETE", `/api/users/${user?.id}/ms365-email/${emailId}?mailbox=${selectedMailbox}`);
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
    mutationFn: async ({ emailId, isRead }: { emailId: string; isRead: boolean }) => {
      return apiRequest("PATCH", `/api/users/${user?.id}/ms365-email/${emailId}/read-status?mailbox=${selectedMailbox}`, { isRead });
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
    mutationFn: async (data: { htmlContent: string; isActive: boolean }) => {
      return apiRequest("PUT", `/api/users/${user?.id}/email-signatures/${selectedMailbox}`, data);
    },
    onSuccess: () => {
      toast({ title: "Uložené", description: "Podpis bol uložený" });
      setSignatureDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/users", user?.id, "email-signatures", selectedMailbox] });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa uložiť podpis", variant: "destructive" });
    },
  });

  const folders = foldersData?.folders || [];
  const loadAllEmails = async () => {
    if (!user?.id || !selectedFolderId || loadingAll) return;
    setLoadingAll(true);
    try {
      let allEmails: EmailMessage[] = [...accumulatedEmails];
      let skip = allEmails.length;
      const batchSize = 500;
      while (skip < serverTotalCount) {
        const res = await fetch(`/api/users/${user.id}/ms365-folder-messages/${selectedFolderId}?mailbox=${selectedMailbox}&top=${batchSize}&skip=${skip}`);
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
    if (selectedChatId && chatsData) {
      const chat = chatsData.find(c => c.id === selectedChatId);
      _setSelectedChat(chat || null);
    } else {
      _setSelectedChat(null);
    }
  }, [selectedChatId, chatsData]);

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
    const mailbox = selectedMailbox;
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
      const mailbox = selectedMailbox;
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

  const handleSendEmail = () => {
    const toList = composeData.to.split(",").map(e => e.trim()).filter(Boolean);
    const ccList = composeData.cc ? composeData.cc.split(",").map(e => e.trim()).filter(Boolean) : [];
    const bccList = composeData.bcc ? composeData.bcc.split(",").map(e => e.trim()).filter(Boolean) : [];
    if (toList.length === 0) {
      toast({ title: "Chyba", description: "Zadajte príjemcu", variant: "destructive" });
      return;
    }
    sendEmailMutation.mutate({
      to: toList, cc: ccList, bcc: bccList,
      subject: composeData.subject, body: composeData.body,
      mailboxEmail: selectedMailbox,
      importance: composeData.importance !== "normal" ? composeData.importance : undefined,
    } as any);
  };

  const handleReply = () => {
    if (!selectedEmail) return;
    replyMutation.mutate({
      emailId: selectedEmail.id, body: composeData.body,
      replyAll: replyMode === "replyAll", mailboxEmail: selectedMailbox,
    });
  };

  const handleForward = () => {
    if (!selectedEmail) return;
    const toList = composeData.to.split(",").map(e => e.trim()).filter(Boolean);
    if (toList.length === 0) {
      toast({ title: "Chyba", description: "Zadajte príjemcu", variant: "destructive" });
      return;
    }
    forwardMutation.mutate({
      emailId: selectedEmail.id, to: toList,
      body: composeData.body, mailboxEmail: selectedMailbox,
    });
  };

  const openSignatureEditor = () => {
    console.log("[SETTINGS] Opening NEW Airmail-style settings dialog v2");
    setSignatureHtml(signatureData?.htmlContent || "");
    setSignatureActive(signatureData?.isActive !== false);
    setSettingsTab("messages");
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
        <span>Prihláste sa pre prístup do NEXUS</span>
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
            <h1 className="text-3xl font-bold tracking-tight">NEXUS</h1>
            <p className="text-muted-foreground">Komunikačné centrum</p>
          </div>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mail className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">MS365 nie je pripojený</p>
            <p className="text-muted-foreground mb-4">Pre použitie NEXUS pripojte svoj MS365 účet</p>
            <Button onClick={() => window.location.href = "/ms365"} data-testid="button-connect-ms365">
              Pripojiť MS365
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tabConfig: { key: NexusTab; label: string; icon: React.ReactNode; badge?: number; badgeColor?: string }[] = [
    { key: "email", label: "Email", icon: <Mail className="h-4 w-4" />, badge: totalUnreadEmails > 0 ? totalUnreadEmails : undefined, badgeColor: "bg-blue-500" },
    { key: "sms", label: "SMS", icon: <MessageSquare className="h-4 w-4" />, badge: smsInboundUnread > 0 ? smsInboundUnread : undefined, badgeColor: "bg-cyan-500" },
    { key: "tasks", label: "Úlohy", icon: <ListTodo className="h-4 w-4" />, badge: pendingTasks > 0 ? pendingTasks : undefined, badgeColor: "bg-amber-500" },
    { key: "chats", label: "Chaty", icon: <MessagesSquare className="h-4 w-4" />, badge: unreadChats > 0 ? unreadChats : undefined, badgeColor: "bg-violet-500" },
    { key: "teams", label: "Teams", icon: <MessagesSquare className="h-4 w-4" />, badgeColor: "bg-indigo-500" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
            <Network className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">NEXUS</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          {activeTab === "email" && (
            <Button variant="outline" size="icon" onClick={openSignatureEditor} data-testid="button-signature">
              <Settings className="h-4 w-4" />
            </Button>
          )}
          {activeTab === "email" && (
            <Button onClick={() => { setComposeOpen(true); setReplyMode(null); setComposeData({ to: "", cc: "", bcc: "", subject: "", body: "", importance: "normal", tagId: null }); setAttachments([]); }} data-testid="button-compose">
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

      <div className="flex gap-2 h-[calc(100vh-230px)] transition-all duration-300">
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
            <Card className="transition-all duration-300 w-[30%] min-w-[320px] max-w-[420px] shrink-0">
              <CardHeader className="py-1.5 px-3 space-y-0 border-b">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-semibold">{isSearching ? `Výsledky: "${debouncedSearchQuery}"` : currentFolderName}</span>
                    {!isSearching && (
                      <Badge variant="secondary" className="text-[10px]">
                        {activeFilterCount > 0 ? `${filteredEmails.length}/${emails.length}` : emails.length}
                      </Badge>
                    )}
                    {isSearching && searchResults && (
                      <Badge variant="secondary" className="text-[10px]">{searchResults.reduce((acc, r) => acc + r.emails.length, 0)}</Badge>
                    )}
                  </div>
                  {!isSearching && (
                    <div className="flex items-center gap-0.5">
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
                    <ScrollArea className="h-[calc(100vh-380px)]">
                      <div className="divide-y">
                        {searchResults.map((result) => (
                          result.emails.length > 0 && (
                            <div key={result.mailbox}>
                              {searchResults.length > 1 && (
                                <div className="px-3 py-1 bg-muted/50 border-b">
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{result.mailbox}</span>
                                </div>
                              )}
                              {result.emails.map(email => (
                                <div
                                  key={email.id}
                                  className={`relative group w-full text-left px-3 py-2.5 transition-all hover:bg-accent/50 cursor-pointer ${
                                    selectedEmail?.id === email.id ? "bg-accent" : ""
                                  } ${!email.isRead ? "font-medium" : ""}`}
                                  onClick={() => setSelectedEmail(email)}
                                  onDoubleClick={() => { setSelectedEmail(email); setModalEmail(email); }}
                                  data-testid={`search-email-item-${email.id}`}
                                >
                                  <div className="flex items-start gap-2.5">
                                    {emailPrefs.unreadIndicator && (
                                      <span className={`h-2 w-2 rounded-full shrink-0 mt-2 ${!email.isRead ? "bg-blue-500" : "bg-transparent"}`} />
                                    )}
                                    {emailPrefs.showSenderInitials && (
                                      <div className="h-7 w-7 rounded-full bg-gradient-to-br from-muted to-muted-foreground/20 flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0 mt-0.5">
                                        {(email.from?.emailAddress?.name || email.from?.emailAddress?.address || "?").substring(0, 2).toUpperCase()}
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between gap-1">
                                        <span className={`text-sm truncate ${!email.isRead && emailPrefs.highlightUnread ? "font-bold" : ""}`}>
                                          {email.from?.emailAddress?.name || email.from?.emailAddress?.address || "Neznámy"}
                                        </span>
                                        <div className="flex items-center gap-1 shrink-0">
                                          {emailPrefs.previewAttachmentIcons && email.hasAttachments && <Paperclip className="h-3 w-3 text-muted-foreground" />}
                                          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                            {format(new Date(email.receivedDateTime), "d.M. HH:mm")}
                                          </span>
                                        </div>
                                      </div>
                                      <p className={`text-xs truncate ${!email.isRead && emailPrefs.highlightUnread ? "font-semibold" : "text-muted-foreground"}`}>
                                        {email.subject || "(Bez predmetu)"}
                                      </p>
                                      {emailPrefs.previewLines > 0 && (
                                        <p className={`text-[11px] text-muted-foreground break-words ${emailPrefs.previewLines === 1 ? "line-clamp-1" : "line-clamp-2"}`}>{email.bodyPreview}</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
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
                  <ScrollArea className="h-[calc(100vh-380px)]">
                    <div className="divide-y">
                      {emailsPage.map((email) => (
                        <div
                          key={email.id}
                          className={`relative group w-full text-left px-3 py-2.5 transition-all hover:bg-accent/50 cursor-pointer ${
                            selectedEmail?.id === email.id ? "bg-accent" : ""
                          } ${!email.isRead ? "font-medium" : ""}`}
                          onClick={() => setSelectedEmail(email)}
                          onDoubleClick={() => { setSelectedEmail(email); setModalEmail(email); }}
                          data-testid={`email-item-${email.id}`}
                        >
                          <button
                            className="absolute top-1.5 right-1.5 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-background/80 transition-all z-10"
                            onClick={(e) => { e.stopPropagation(); toggleReadMutation.mutate({ emailId: email.id, isRead: !email.isRead }); }}
                            title={email.isRead ? "Označiť ako neprečítané" : "Označiť ako prečítané"}
                            data-testid={`toggle-read-${email.id}`}
                          >
                            {!email.isRead ? <Eye className="h-3.5 w-3.5 text-muted-foreground" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                          </button>
                          <div className="flex items-start gap-2.5">
                            <div className="flex flex-col items-center gap-0.5 mt-1.5 shrink-0">
                              {emailPrefs.unreadIndicator && (
                                <span className={`h-2 w-2 rounded-full ${!email.isRead ? "bg-blue-500" : "bg-transparent"}`} />
                              )}
                              {emailPrefs.showAccountIcons && currentMailboxEmail && mailboxColorMap[currentMailboxEmail] && (
                                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: mailboxColorMap[currentMailboxEmail] }} />
                              )}
                            </div>
                            {emailPrefs.showSenderInitials && (
                              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-muted to-muted-foreground/20 flex items-center justify-center text-[11px] font-bold text-muted-foreground shrink-0 mt-0.5">
                                {(email.from?.emailAddress?.name || email.from?.emailAddress?.address || "?").substring(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className={`text-sm truncate ${!email.isRead && emailPrefs.highlightUnread ? "font-bold" : ""}`}>
                                  {email.from?.emailAddress?.name || email.from?.emailAddress?.address || "Neznámy"}
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                  {emailPrefs.previewAttachmentIcons && email.hasAttachments && <Paperclip className="h-3 w-3 text-muted-foreground" />}
                                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                    {format(new Date(email.receivedDateTime), "d.M. HH:mm")}
                                  </span>
                                </div>
                              </div>
                              <p className={`text-xs truncate ${!email.isRead && emailPrefs.highlightUnread ? "font-semibold" : "text-muted-foreground"}`}>
                                {email.subject || "(Bez predmetu)"}
                              </p>
                              {emailPrefs.previewLines > 0 && (
                                <p className={`text-[11px] text-muted-foreground break-words ${emailPrefs.previewLines === 1 ? "line-clamp-1" : "line-clamp-2"}`}>{email.bodyPreview}</p>
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
                      ))}
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
            <Card className="transition-all duration-300 flex-1 min-w-0">
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
                  <ScrollArea className="h-[calc(100vh-360px)]">
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
                  <ScrollArea className="h-[calc(100vh-360px)]">
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
          <Card className="transition-all duration-300 flex-1 min-w-0">
            <CardContent className="p-0 h-full">
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <MessagesSquare className="h-16 w-16 mb-4 opacity-30" />
                <p className="text-xl font-semibold mb-2">Microsoft Teams</p>
                <p className="text-sm text-center max-w-md">
                  Integrácia s Microsoft Teams je pripravovaná. Po aktivácii tu uvidíte Teams konverzácie, kanály a správy priamo v NEXUS klientovi.
                </p>
                <Badge variant="outline" className="mt-4 text-indigo-600 border-indigo-300">
                  Pripravuje sa
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenSquare className="h-5 w-5" />
              Nová správa
            </DialogTitle>
            <DialogDescription>
              Odoslať z: {mailboxes.find(m => (m.type === "personal" ? "personal" : m.email) === selectedMailbox)?.email || selectedMailbox}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Komu (viac adries oddeľte čiarkou)" value={composeData.to} onChange={(e) => setComposeData({ ...composeData, to: e.target.value })} data-testid="input-compose-to" />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Cc" value={composeData.cc} onChange={(e) => setComposeData({ ...composeData, cc: e.target.value })} data-testid="input-compose-cc" />
              <Input placeholder="Bcc" value={composeData.bcc} onChange={(e) => setComposeData({ ...composeData, bcc: e.target.value })} data-testid="input-compose-bcc" />
            </div>
            <Input placeholder="Predmet" value={composeData.subject} onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })} data-testid="input-compose-subject" />
            <div className="border rounded-md">
              <Editor value={composeData.body} onChange={(e) => setComposeData({ ...composeData, body: e.target.value })} style={{ minHeight: "200px" }} data-testid="editor-compose-body" />
            </div>
            <div className="space-y-2">
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} multiple className="hidden" />
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} data-testid="button-add-attachment">
                <Upload className="h-4 w-4 mr-2" />
                Pridať prílohu
              </Button>
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {attachments.map((file, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1 pr-1">
                      <Paperclip className="h-3 w-3" />
                      <span className="max-w-32 truncate">{file.name}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-4 w-4 ml-1" onClick={() => removeAttachment(index)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
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
          <DialogFooter>
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
              <Button variant="ghost" size="icon" onClick={() => { setReplyMode("reply"); setComposeData({ ...composeData, body: "" }); }} data-testid="button-reply">
                <Reply className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => { setReplyMode("replyAll"); setComposeData({ ...composeData, body: "" }); }} data-testid="button-reply-all">
                <ReplyAll className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => { setReplyMode("forward"); setComposeData({ to: "", cc: "", bcc: "", subject: `Fwd: ${emailDetail.subject}`, body: "" }); }} data-testid="button-forward">
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
              <Button variant="ghost" size="icon" onClick={() => deleteEmailMutation.mutate(emailDetail.id)} data-testid="button-delete">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="text-sm">
            <p><span className="text-muted-foreground">Od:</span> {emailDetail.from?.emailAddress?.name} &lt;{emailDetail.from?.emailAddress?.address}&gt;</p>
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

        {emailDetail.attachmentsList && emailDetail.attachmentsList.filter((a: any) => !a.isInline).length > 0 && (
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

        {replyMode ? (
          <div className="flex-1 p-4 space-y-4 overflow-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">
                {replyMode === "reply" && "Odpoveď"}
                {replyMode === "replyAll" && "Odpoveď všetkým"}
                {replyMode === "forward" && "Preposlať"}
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setReplyMode(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {replyMode === "forward" && (
              <Input placeholder="Komu" value={composeData.to} onChange={(e) => setComposeData({ ...composeData, to: e.target.value })} data-testid="input-forward-to" />
            )}
            <div className="border rounded-md">
              <Editor value={composeData.body} onChange={(e) => setComposeData({ ...composeData, body: e.target.value })} style={{ minHeight: "150px" }} data-testid="editor-reply-body" />
            </div>
            <div className="flex justify-end">
              <Button onClick={replyMode === "forward" ? handleForward : handleReply} disabled={replyMutation.isPending || forwardMutation.isPending} data-testid="button-send-reply">
                {(replyMutation.isPending || forwardMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Send className="h-4 w-4 mr-2" />
                Odoslať
              </Button>
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="p-4">
              {emailDetail.body?.contentType === "html" ? (
                <div className="prose dark:prose-invert max-w-none [&_img]:max-w-full [&_img]:h-auto" dangerouslySetInnerHTML={{ __html: processHtmlForImages(emailDetail.body.content, emailDetail.id, emailDetail.attachmentsList) }} />
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-sm">{emailDetail.body?.content || emailDetail.bodyPreview}</pre>
              )}
            </div>
          </ScrollArea>
        )}
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
              <p className="text-sm whitespace-pre-wrap">{selectedSms.content}</p>
            </div>
          </div>
        </ScrollArea>
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
            <p className="text-sm whitespace-pre-wrap">{selectedTask.description || "Bez popisu"}</p>
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
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setReplyMode("reply"); setComposeData({ ...composeData, body: "" }); setModalEmail(null); }} data-testid="modal-reply">
                        <Reply className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Odpovedať</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setReplyMode("replyAll"); setComposeData({ ...composeData, body: "" }); setModalEmail(null); }} data-testid="modal-reply-all">
                        <ReplyAll className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Odpovedať všetkým</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setReplyMode("forward"); setComposeData({ to: "", cc: "", bcc: "", subject: `Fwd: ${detail.subject}`, body: "" }); setModalEmail(null); }} data-testid="modal-forward">
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
                          toggleReadMutation.mutate({ emailId: detail.id, isRead: !detail.isRead });
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
            <div className="p-5">
              {detail.body?.contentType === "html" ? (
                <div className="prose dark:prose-invert max-w-none [&_img]:max-w-full [&_img]:h-auto" dangerouslySetInnerHTML={{ __html: processHtmlForImages(detail.body.content, detail.id, detail.attachmentsList) }} />
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-sm">{detail.body?.content || detail.bodyPreview}</pre>
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
                      <span className="text-white leading-none">{selectedIcon ? selectedIcon.emoji : "📧"}</span>
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
                          className={`h-7 w-7 rounded-md flex items-center justify-center text-sm transition-all hover:scale-110 ${cfg.icon === icon.key ? "ring-2 ring-primary bg-primary/10" : "hover:bg-accent"}`}
                          title={icon.label}
                          data-testid={`account-icon-${mb.id}-${icon.key}`}
                        >
                          {icon.emoji}
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

    if (settingsTab === "compose") {
      return (
        <div>
          <h2 className="text-lg font-semibold mb-1">Písanie</h2>
          <p className="text-sm text-muted-foreground mb-4">Nastavenia podpisu a písania emailov.</p>

          <SectionTitle>Podpis</SectionTitle>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Switch id="signature-active" checked={signatureActive} onCheckedChange={(c) => setSignatureActive(!!c)} />
              <label htmlFor="signature-active" className="text-sm font-medium">Aktívny podpis</label>
            </div>
            <p className="text-[12px] text-muted-foreground">Podpis sa automaticky pridá na koniec každého nového emailu a odpovede.</p>
            <div className="border rounded-lg overflow-hidden">
              <Editor value={signatureHtml} onChange={(e) => setSignatureHtml(e.target.value)} style={{ minHeight: "180px" }} data-testid="editor-signature" />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => saveSignatureMutation.mutate({ htmlContent: signatureHtml, isActive: signatureActive })} disabled={saveSignatureMutation.isPending} data-testid="button-save-signature">
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
