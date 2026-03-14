import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Link } from "wouter";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Inbox,
  Send,
  FileText,
  Trash2,
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
  Columns3,
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
  Calendar as CalendarIcon,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import Editor from "react-simple-wysiwyg";

import NexusSidebar from "@/components/nexus/nexus-sidebar";
import type {
  Mailbox,
  MailFolder,
  EmailMessage,
  EmailSignature,
  Task,
  ChatConversation,
  SmsMessage,
  UnifiedMessage,
  ColumnConfig,
  SidebarChannel,
} from "@/components/nexus/nexus-types";
import { typeColors } from "@/components/nexus/nexus-types";

const defaultColumns: ColumnConfig[] = [
  { id: "status", label: "Stav", visible: true, order: 0 },
  { id: "type", label: "Typ", visible: true, order: 1 },
  { id: "from", label: "Od/Komu", visible: true, order: 2 },
  { id: "subject", label: "Predmet/Názov", visible: true, order: 3 },
  { id: "date", label: "Dátum", visible: true, order: 4 },
  { id: "attachments", label: "Prílohy", visible: true, order: 5 },
  { id: "priority", label: "Priorita", visible: false, order: 6 },
  { id: "preview", label: "Náhľad", visible: true, order: 7 },
];

const priorityIcons: Record<string, React.ReactNode> = {
  low: <Circle className="h-3 w-3 text-slate-400" />,
  medium: <Circle className="h-3 w-3 text-blue-500" />,
  high: <AlertOctagon className="h-3 w-3 text-orange-500" />,
  urgent: <AlertOctagon className="h-3 w-3 text-red-500" />,
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="h-3 w-3 text-slate-400" />,
  in_progress: <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />,
  completed: <CheckCircle2 className="h-3 w-3 text-emerald-500" />,
  cancelled: <XCircle className="h-3 w-3 text-red-500" />,
};

function getChannelInfo(channel: SidebarChannel, folders?: MailFolder[]): { title: string; icon: React.ReactNode } {
  switch (channel) {
    case "all": return { title: "Všetka komunikácia", icon: <Inbox className="h-4 w-4" /> };
    case "unread": return { title: "Neprečítané", icon: <MailOpen className="h-4 w-4" /> };
    case "email-inbox": return { title: "Doručená pošta", icon: <Inbox className="h-4 w-4 text-blue-600" /> };
    case "sms-all": return { title: "Všetky SMS", icon: <MessageSquare className="h-4 w-4 text-cyan-600" /> };
    case "sms-inbound": return { title: "Prijaté SMS", icon: <MessageSquare className="h-4 w-4 text-cyan-600" /> };
    case "sms-outbound": return { title: "Odoslané SMS", icon: <MessageSquare className="h-4 w-4 text-emerald-600" /> };
    case "tasks": return { title: "Úlohy", icon: <ListTodo className="h-4 w-4 text-emerald-600" /> };
    case "chats": return { title: "Interné chaty", icon: <MessagesSquare className="h-4 w-4 text-violet-600" /> };
    default: {
      if (channel.startsWith("email-folder-") && folders) {
        const folderId = channel.replace("email-folder-", "");
        const folder = folders.find(f => f.id === folderId);
        return { title: folder?.displayName || "Email priečinok", icon: <Mail className="h-4 w-4 text-blue-600" /> };
      }
      return { title: "Správy", icon: <Inbox className="h-4 w-4" /> };
    }
  }
}

export default function EmailClientPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedMailbox, setSelectedMailbox] = useState<string>("personal");
  const [selectedChannel, setSelectedChannel] = useState<SidebarChannel>("all");
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedChat, setSelectedChat] = useState<ChatConversation | null>(null);
  const [selectedSms, setSelectedSms] = useState<SmsMessage | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyMode, setReplyMode] = useState<"reply" | "replyAll" | "forward" | null>(null);
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 200;
  const [expandedMessage, setExpandedMessage] = useState<UnifiedMessage | null>(null);
  const [accumulatedEmails, setAccumulatedEmails] = useState<EmailMessage[]>([]);
  const [serverTotalCount, setServerTotalCount] = useState(0);

  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem("nexus-email-columns");
    return saved ? JSON.parse(saved) : defaultColumns;
  });

  const [attachments, setAttachments] = useState<File[]>([]);

  const [composeData, setComposeData] = useState({
    to: "",
    cc: "",
    bcc: "",
    subject: "",
    body: "",
  });

  const [signatureHtml, setSignatureHtml] = useState("");
  const [signatureActive, setSignatureActive] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchMailbox, setSearchMailbox] = useState<string>("all");

  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);
  const [filterHasAttachment, setFilterHasAttachment] = useState(false);
  const [filterDateFrom, setFilterDateFrom] = useState<Date | undefined>(undefined);
  const [filterDateTo, setFilterDateTo] = useState<Date | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
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

  const emailFolderId = (() => {
    if (selectedChannel === "email-inbox" || selectedChannel === "all" || selectedChannel === "unread") {
      return foldersData?.inboxId || null;
    }
    if (selectedChannel.startsWith("email-folder-")) {
      return selectedChannel.replace("email-folder-", "");
    }
    return null;
  })();

  const shouldFetchEmails = selectedChannel === "all" || selectedChannel === "unread" || selectedChannel === "email-inbox" || selectedChannel.startsWith("email-folder-");

  const { data: messagesData, isLoading: messagesLoading, isFetching: messagesFetching, refetch: refetchMessages } = useQuery<{ connected: boolean; emails: EmailMessage[]; totalCount: number }>({
    queryKey: ["/api/users", user?.id, "ms365-folder-messages", emailFolderId, selectedMailbox, page, selectedChannel],
    queryFn: () => {
      return fetch(`/api/users/${user?.id}/ms365-folder-messages/${emailFolderId}?mailbox=${selectedMailbox}&top=${pageSize}&skip=${page * pageSize}`).then(r => r.json());
    },
    enabled: !!user?.id && !!emailFolderId && shouldFetchEmails,
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

  useEffect(() => {
    setPage(0);
    setAccumulatedEmails([]);
    setServerTotalCount(0);
    setSelectedEmail(null);
    setSelectedTask(null);
    setSelectedChat(null);
    setSelectedSms(null);
  }, [selectedChannel, selectedMailbox]);

  const { data: tasksData, isLoading: tasksLoading, refetch: refetchTasks } = useQuery<Task[]>({
    queryKey: ["/api/tasks", user?.id],
    queryFn: () => fetch(`/api/tasks?assignedUserId=${user?.id}`).then(r => r.json()),
    enabled: !!user?.id,
  });

  const { data: chatsData, isLoading: chatsLoading, refetch: refetchChats } = useQuery<any[]>({
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
      setSelectedTask(null);
      setSelectedChat(null);
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
      setComposeData({ to: "", cc: "", bcc: "", subject: "", body: "" });
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
      setComposeData({ to: "", cc: "", bcc: "", subject: "", body: "" });
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
      setComposeData({ to: "", cc: "", bcc: "", subject: "", body: "" });
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
  const emails = accumulatedEmails;
  const totalCount = serverTotalCount;

  const visibleColumns = columns.filter(c => c.visible).sort((a, b) => a.order - b.order);

  const totalUnreadEmails = folders.find(f => f.wellKnownName === "inbox" || f.displayName === "Inbox")?.unreadItemCount || 0;

  const unifiedMessages: UnifiedMessage[] = [];

  const showEmails = selectedChannel === "all" || selectedChannel === "unread" || selectedChannel === "email-inbox" || selectedChannel.startsWith("email-folder-");
  const showTasks = selectedChannel === "all" || selectedChannel === "unread" || selectedChannel === "tasks";
  const showChats = selectedChannel === "all" || selectedChannel === "unread" || selectedChannel === "chats";
  const showSms = selectedChannel === "all" || selectedChannel === "unread" || selectedChannel.startsWith("sms");

  if (showEmails) {
    for (const email of emails) {
      if (selectedChannel === "unread" && email.isRead) continue;
      unifiedMessages.push({
        id: `email-${email.id}`,
        type: "email",
        title: email.subject || "(Bez predmetu)",
        preview: email.bodyPreview || "",
        timestamp: email.receivedDateTime,
        isUnread: !email.isRead,
        from: email.from?.emailAddress?.name || email.from?.emailAddress?.address || "Neznámy",
        hasAttachments: email.hasAttachments,
        priority: email.importance,
        originalData: email,
      });
    }
  }

  if (showTasks && tasksData) {
    for (const task of tasksData) {
      const isTaskUnread = task.status === "pending";
      if (selectedChannel === "unread" && !isTaskUnread) continue;
      unifiedMessages.push({
        id: `task-${task.id}`,
        type: "task",
        title: task.title,
        preview: task.description || "",
        timestamp: task.updatedAt || task.createdAt,
        isUnread: isTaskUnread,
        priority: task.priority,
        status: task.status,
        originalData: task,
      });
    }
  }

  if (showChats && chatsData) {
    for (const chat of chatsData) {
      const isChatUnread = chat.unreadCount > 0;
      if (selectedChannel === "unread" && !isChatUnread) continue;
      unifiedMessages.push({
        id: `chat-${chat.id}`,
        type: "chat",
        title: chat.participantName || "Konverzácia",
        preview: chat.lastMessage || "",
        timestamp: chat.lastMessageAt,
        isUnread: isChatUnread,
        originalData: chat,
      });
    }
  }

  if (showSms && smsData) {
    for (const sms of smsData) {
      if (selectedChannel === "sms-inbound" && sms.direction !== "inbound") continue;
      if (selectedChannel === "sms-outbound" && sms.direction !== "outbound") continue;

      const isSmsUnread = sms.direction === "inbound" && sms.deliveryStatus !== "read";
      if (selectedChannel === "unread" && !isSmsUnread) continue;

      const customerName = sms.customer
        ? `${sms.customer.firstName} ${sms.customer.lastName}`
        : (sms.direction === "inbound" ? sms.senderPhone : sms.recipientPhone) || "Neznámy";

      unifiedMessages.push({
        id: `sms-${sms.id}`,
        type: "sms",
        title: sms.direction === "inbound" ? `SMS od ${customerName}` : `SMS pre ${customerName}`,
        preview: sms.content || "",
        timestamp: sms.sentAt || sms.createdAt,
        isUnread: isSmsUnread,
        direction: sms.direction,
        from: customerName,
        originalData: sms,
        aiAlertLevel: sms.aiAlertLevel,
        aiHasAngryTone: sms.aiHasAngryTone,
        aiWantsToCancel: sms.aiWantsToCancel,
      });
    }
  }

  let filteredMessages = unifiedMessages.filter(msg => {
    if (filterUnreadOnly && !msg.isUnread) return false;
    if (filterHasAttachment && !msg.hasAttachments) return false;
    if (filterDateFrom) {
      const msgDate = new Date(msg.timestamp);
      const fromDate = new Date(filterDateFrom);
      fromDate.setHours(0, 0, 0, 0);
      if (msgDate < fromDate) return false;
    }
    if (filterDateTo) {
      const msgDate = new Date(msg.timestamp);
      const toDate = new Date(filterDateTo);
      toDate.setHours(23, 59, 59, 999);
      if (msgDate > toDate) return false;
    }
    return true;
  });

  filteredMessages.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return sortOrder === "newest" ? timeB - timeA : timeA - timeB;
  });

  const totalFilteredMessages = filteredMessages.length;
  const totalLocalPages = Math.ceil(totalFilteredMessages / localPageSize);
  const paginatedMessages = filteredMessages.slice(localPage * localPageSize, (localPage + 1) * localPageSize);

  useEffect(() => {
    setLocalPage(0);
  }, [filterUnreadOnly, filterHasAttachment, filterDateFrom, filterDateTo, sortOrder, selectedChannel]);

  const handleSendEmail = () => {
    const toList = composeData.to.split(",").map(e => e.trim()).filter(Boolean);
    const ccList = composeData.cc ? composeData.cc.split(",").map(e => e.trim()).filter(Boolean) : [];
    const bccList = composeData.bcc ? composeData.bcc.split(",").map(e => e.trim()).filter(Boolean) : [];

    if (toList.length === 0) {
      toast({ title: "Chyba", description: "Zadajte príjemcu", variant: "destructive" });
      return;
    }

    sendEmailMutation.mutate({
      to: toList,
      cc: ccList,
      bcc: bccList,
      subject: composeData.subject,
      body: composeData.body,
      mailboxEmail: selectedMailbox,
    });
  };

  const handleReply = () => {
    if (!selectedEmail) return;
    replyMutation.mutate({
      emailId: selectedEmail.id,
      body: composeData.body,
      replyAll: replyMode === "replyAll",
      mailboxEmail: selectedMailbox,
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
      emailId: selectedEmail.id,
      to: toList,
      body: composeData.body,
      mailboxEmail: selectedMailbox,
    });
  };

  const openSignatureEditor = () => {
    setSignatureHtml(signatureData?.htmlContent || "");
    setSignatureActive(signatureData?.isActive !== false);
    setSignatureDialogOpen(true);
  };

  const toggleColumn = (columnId: string) => {
    const newColumns = columns.map(c =>
      c.id === columnId ? { ...c, visible: !c.visible } : c
    );
    setColumns(newColumns);
    localStorage.setItem("nexus-email-columns", JSON.stringify(newColumns));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments(prev => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const selectUnifiedMessage = (msg: UnifiedMessage) => {
    setSelectedEmail(null);
    setSelectedTask(null);
    setSelectedChat(null);
    setSelectedSms(null);

    if (msg.type === "email") {
      setSelectedEmail(msg.originalData as EmailMessage);
    } else if (msg.type === "task") {
      setSelectedTask(msg.originalData as Task);
    } else if (msg.type === "chat") {
      setSelectedChat(msg.originalData as ChatConversation);
    } else if (msg.type === "sms") {
      setSelectedSms(msg.originalData as SmsMessage);
    }
  };

  const getTypeIcon = (type: "email" | "task" | "chat" | "sms") => {
    switch (type) {
      case "email": return <Mail className="h-4 w-4" />;
      case "task": return <ListTodo className="h-4 w-4" />;
      case "chat": return <MessagesSquare className="h-4 w-4" />;
      case "sms": return <MessageSquare className="h-4 w-4" />;
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

  const channelInfo = getChannelInfo(selectedChannel, folders);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
            <Network className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              NEXUS
              <Badge variant="outline" className="text-xs font-normal">Komunikačné centrum</Badge>
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedMailbox} onValueChange={(v) => { setSelectedMailbox(v); setSelectedChannel("all"); setSelectedEmail(null); setPage(0); }}>
            <SelectTrigger className="w-56" data-testid="select-mailbox">
              <SelectValue placeholder="Vyberte schránku" />
            </SelectTrigger>
            <SelectContent>
              {mailboxes.map((mb) => (
                <SelectItem key={mb.id} value={mb.type === "personal" ? "personal" : mb.email}>
                  <div className="flex items-center gap-2">
                    {mb.type === "personal" ? <User className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                    <span>{mb.displayName || mb.email}</span>
                    {mb.isDefault && <Badge variant="secondary" className="text-xs">Predvolená</Badge>}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" data-testid="button-columns">
                <Columns3 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Viditeľné stĺpce</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columns.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={col.visible}
                  onCheckedChange={() => toggleColumn(col.id)}
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="icon" onClick={() => { setPage(0); setAccumulatedEmails([]); refetchFolders(); refetchMessages(); refetchTasks(); refetchChats(); refetchSms(); }} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={openSignatureEditor} data-testid="button-signature">
            <Settings className="h-4 w-4" />
          </Button>
          <Button onClick={() => { setComposeOpen(true); setReplyMode(null); setComposeData({ to: "", cc: "", bcc: "", subject: "", body: "" }); setAttachments([]); }} data-testid="button-compose">
            <PenSquare className="h-4 w-4 mr-2" />
            Nová správa
          </Button>
        </div>
      </div>

      <Card className="p-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Hľadať vo všetkých správach..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
              data-testid="input-search"
            />
          </div>
          <Button onClick={handleSearch} disabled={searchQuery.trim().length < 2} data-testid="button-search">
            <Search className="h-4 w-4 mr-2" />
            Hľadať
          </Button>
          {isSearching && (
            <Button variant="outline" onClick={clearSearch} data-testid="button-clear-search">
              <X className="h-4 w-4 mr-2" />
              Zrušiť
            </Button>
          )}
        </div>
      </Card>

      <div className="flex gap-2 h-[calc(100vh-260px)] transition-all duration-300">
        {isSidebarHidden && (
          <div className="flex flex-col items-center pt-2 shrink-0">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsSidebarHidden(false)}
              data-testid="button-show-sidebar"
              title="Zobraziť kanály"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {!isSidebarHidden && (
          <NexusSidebar
            selectedChannel={selectedChannel}
            onSelectChannel={setSelectedChannel}
            folders={folders}
            foldersLoading={foldersLoading}
            smsData={smsData}
            tasksData={tasksData}
            chatsData={chatsData}
            totalUnreadEmails={totalUnreadEmails}
            onHide={() => setIsSidebarHidden(true)}
          />
        )}

        <Card className="transition-all duration-300 w-[30%] min-w-[320px] max-w-[420px] shrink-0">
          <CardHeader className="py-2 px-3 space-y-1 border-b">
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-2">
                {channelInfo.icon}
                <span className="text-sm font-semibold">{channelInfo.title}</span>
                <Badge variant="secondary" className="text-[10px]">{totalFilteredMessages}</Badge>
              </div>
              <div className="flex items-center gap-0.5">
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={localPage === 0} onClick={() => setLocalPage(p => p - 1)} data-testid="button-page-prev">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-[11px] min-w-[40px] text-center text-muted-foreground">{totalLocalPages > 0 ? `${localPage + 1}/${totalLocalPages}` : "0/0"}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={localPage >= totalLocalPages - 1} onClick={() => setLocalPage(p => p + 1)} data-testid="button-page-next">
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-1 flex-wrap">
              <Button
                variant={filterUnreadOnly ? "default" : "outline"}
                size="sm"
                className="text-[11px] h-7 gap-0.5"
                onClick={() => setFilterUnreadOnly(!filterUnreadOnly)}
                data-testid="filter-unread"
              >
                <MailOpen className="h-3 w-3" />
                Neprečítané
              </Button>

              <Button
                variant={filterHasAttachment ? "default" : "outline"}
                size="sm"
                className="text-[11px] h-7 gap-0.5"
                onClick={() => setFilterHasAttachment(!filterHasAttachment)}
                data-testid="filter-attachment"
              >
                <Paperclip className="h-3 w-3" />
                Prílohy
              </Button>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={`text-[11px] h-7 gap-0.5 ${filterDateFrom || filterDateTo ? "border-primary" : ""}`} data-testid="filter-date">
                    <CalendarIcon className="h-3 w-3" />
                    {filterDateFrom || filterDateTo ? (
                      <>
                        {filterDateFrom ? format(filterDateFrom, "d.M.") : "..."} - {filterDateTo ? format(filterDateTo, "d.M.") : "..."}
                      </>
                    ) : "Dátum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3" align="start">
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Od</label>
                      <input
                        type="date"
                        className="w-full px-2 py-1 text-sm border rounded"
                        value={filterDateFrom ? format(filterDateFrom, "yyyy-MM-dd") : ""}
                        onChange={(e) => setFilterDateFrom(e.target.value ? new Date(e.target.value) : undefined)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Do</label>
                      <input
                        type="date"
                        className="w-full px-2 py-1 text-sm border rounded"
                        value={filterDateTo ? format(filterDateTo, "yyyy-MM-dd") : ""}
                        onChange={(e) => setFilterDateTo(e.target.value ? new Date(e.target.value) : undefined)}
                      />
                    </div>
                    {(filterDateFrom || filterDateTo) && (
                      <Button variant="ghost" size="sm" className="w-full h-7 text-xs" onClick={() => { setFilterDateFrom(undefined); setFilterDateTo(undefined); }}>
                        Vymazať
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              <Button
                variant="outline"
                size="sm"
                className="text-[11px] h-7 gap-0.5"
                onClick={() => setSortOrder(sortOrder === "newest" ? "oldest" : "newest")}
                data-testid="sort-toggle"
              >
                {sortOrder === "newest" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
                {sortOrder === "newest" ? "Najnovšie" : "Najstaršie"}
              </Button>

              {(filterUnreadOnly || filterHasAttachment || filterDateFrom || filterDateTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[11px] h-7 text-muted-foreground"
                  onClick={() => {
                    setFilterUnreadOnly(false);
                    setFilterHasAttachment(false);
                    setFilterDateFrom(undefined);
                    setFilterDateTo(undefined);
                  }}
                  data-testid="clear-filters"
                >
                  <X className="h-3 w-3 mr-1" />
                  Vymazať
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {(messagesLoading || tasksLoading || chatsLoading || smsLoading) ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : paginatedMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Network className="h-8 w-8 mb-2 opacity-50" />
                <span className="text-sm">{filterUnreadOnly || filterHasAttachment || filterDateFrom || filterDateTo ? "Žiadne správy zodpovedajú filtrom" : "Žiadne správy"}</span>
              </div>
            ) : (
              <ScrollArea className="h-[calc(100vh-380px)]">
                <div className="divide-y">
                  {paginatedMessages.map((msg) => (
                    <button
                      key={msg.id}
                      onClick={() => selectUnifiedMessage(msg)}
                      onDoubleClick={() => { selectUnifiedMessage(msg); setExpandedMessage(msg); }}
                      className={`w-full text-left px-3 py-2.5 transition-all hover:bg-accent/50 ${
                        (selectedEmail?.id && msg.id === `email-${selectedEmail.id}`) ||
                        (selectedTask?.id && msg.id === `task-${selectedTask.id}`) ||
                        (selectedChat?.id && msg.id === `chat-${selectedChat.id}`) ||
                        (selectedSms?.id && msg.id === `sms-${selectedSms.id}`)
                          ? "bg-accent" : ""
                      } ${msg.isUnread ? "font-medium" : ""}`}
                      title="Dvojklik pre zväčšený náhľad"
                      data-testid={`message-item-${msg.id}`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="flex flex-col items-center gap-1 mt-1 shrink-0">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${msg.isUnread ? typeColors[msg.type].dot : "bg-transparent"}`} />
                        </div>
                        {visibleColumns.find(c => c.id === "type") && (
                          <div className={`p-1.5 rounded-md ${typeColors[msg.type].bg} mt-0.5 shrink-0`}>
                            {getTypeIcon(msg.type)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            {visibleColumns.find(c => c.id === "from") && (
                              <span className={`text-sm truncate ${msg.isUnread ? "font-bold" : ""}`}>
                                {msg.from || msg.title}
                              </span>
                            )}
                            <div className="flex items-center gap-1 shrink-0">
                              {visibleColumns.find(c => c.id === "attachments") && msg.hasAttachments && (
                                <Paperclip className="h-3 w-3 text-muted-foreground" />
                              )}
                              {visibleColumns.find(c => c.id === "date") && (
                                <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                  {format(new Date(msg.timestamp), "d.M. HH:mm")}
                                </span>
                              )}
                            </div>
                          </div>
                          {visibleColumns.find(c => c.id === "subject") && (
                            <p className={`text-xs truncate ${msg.isUnread ? "font-semibold" : "text-muted-foreground"}`}>
                              {msg.title}
                            </p>
                          )}
                          {visibleColumns.find(c => c.id === "preview") && (
                            <p className="text-[11px] text-muted-foreground truncate">{msg.preview}</p>
                          )}
                          {(msg.type === "task" || (msg.type === "sms" && msg.aiAlertLevel && msg.aiAlertLevel !== "none")) && (
                            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                              {msg.type === "task" && msg.priority && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 gap-0.5">
                                  {priorityIcons[msg.priority]}
                                  {msg.priority}
                                </Badge>
                              )}
                              {msg.type === "task" && msg.status && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 gap-0.5">
                                  {statusIcons[msg.status]}
                                  {msg.status}
                                </Badge>
                              )}
                              {msg.type === "sms" && msg.aiAlertLevel && msg.aiAlertLevel !== "none" && (
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1 py-0 h-4 gap-0.5 ${
                                    msg.aiAlertLevel === "critical"
                                      ? "border-red-500 text-red-600 bg-red-50 dark:bg-red-950"
                                      : "border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950"
                                  }`}
                                >
                                  {msg.aiAlertLevel === "critical" ? <ShieldAlert className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                                  {msg.aiHasAngryTone && "Nahnevaný"}
                                  {msg.aiWantsToCancel && "Zrušenie"}
                                  {!msg.aiHasAngryTone && !msg.aiWantsToCancel && (msg.aiAlertLevel === "critical" ? "Kritické" : "Upozornenie")}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                  {totalCount > emails.length && shouldFetchEmails && (
                    <div className="p-3 text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1"
                        onClick={() => setPage(p => p + 1)}
                        disabled={messagesFetching}
                        data-testid="button-load-more"
                      >
                        {messagesFetching && <Loader2 className="h-3 w-3 animate-spin" />}
                        Načítať ďalšie ({emails.length} z {totalCount})
                      </Button>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card className="transition-all duration-300 flex-1 min-w-0">
          <CardContent className="p-0 h-full">
            {detailLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : emailDetail && selectedEmail ? (
              <div className="flex flex-col h-full">
                <div className="p-4 border-b space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`${typeColors.email.bg} ${typeColors.email.text}`}>
                        <Mail className="h-3 w-3 mr-1" />Email
                      </Badge>
                      <h2 className="text-lg font-semibold">{emailDetail.subject || "(Bez predmetu)"}</h2>
                    </div>
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
                      <Button variant="ghost" size="icon" onClick={() => deleteEmailMutation.mutate(emailDetail.id)} data-testid="button-delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm">
                    <p><span className="text-muted-foreground">Od:</span> {emailDetail.from?.emailAddress?.name} &lt;{emailDetail.from?.emailAddress?.address}&gt;</p>
                    <p><span className="text-muted-foreground">Komu:</span> {emailDetail.toRecipients?.map(r => r.emailAddress?.address).join(", ")}</p>
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
                </div>

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
                      <Input
                        placeholder="Komu"
                        value={composeData.to}
                        onChange={(e) => setComposeData({ ...composeData, to: e.target.value })}
                        data-testid="input-forward-to"
                      />
                    )}
                    <div className="border rounded-md">
                      <Editor
                        value={composeData.body}
                        onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
                        style={{ minHeight: "150px" }}
                        data-testid="editor-reply-body"
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button
                        onClick={replyMode === "forward" ? handleForward : handleReply}
                        disabled={replyMutation.isPending || forwardMutation.isPending}
                        data-testid="button-send-reply"
                      >
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
                        <div
                          className="prose dark:prose-invert max-w-none"
                          dangerouslySetInnerHTML={{ __html: emailDetail.body.content }}
                        />
                      ) : (
                        <pre className="whitespace-pre-wrap font-sans text-sm">
                          {emailDetail.body?.content || emailDetail.bodyPreview}
                        </pre>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </div>
            ) : selectedTask ? (
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
            ) : selectedChat ? (
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
            ) : selectedSms ? (
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
                          <ArrowRight className="h-3 w-3 rotate-180" />
                          Prijatá
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-400">
                          <ArrowRight className="h-3 w-3" />
                          Odoslaná
                        </Badge>
                      )}
                      {selectedSms.deliveryStatus && (
                        <Badge variant="outline" className="text-xs">{selectedSms.deliveryStatus}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-sm">
                    <p>
                      <span className="text-muted-foreground">
                        {selectedSms.direction === "inbound" ? "Od:" : "Pre:"}
                      </span>{" "}
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
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Network className="h-12 w-12 mb-4 opacity-50" />
                <p className="font-medium">NEXUS</p>
                <p className="text-sm">Vyberte správu pre zobrazenie detailu</p>
              </div>
            )}
          </CardContent>
        </Card>
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
            <Input
              placeholder="Komu (viac adries oddeľte čiarkou)"
              value={composeData.to}
              onChange={(e) => setComposeData({ ...composeData, to: e.target.value })}
              data-testid="input-compose-to"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Cc"
                value={composeData.cc}
                onChange={(e) => setComposeData({ ...composeData, cc: e.target.value })}
                data-testid="input-compose-cc"
              />
              <Input
                placeholder="Bcc"
                value={composeData.bcc}
                onChange={(e) => setComposeData({ ...composeData, bcc: e.target.value })}
                data-testid="input-compose-bcc"
              />
            </div>
            <Input
              placeholder="Predmet"
              value={composeData.subject}
              onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
              data-testid="input-compose-subject"
            />
            <div className="border rounded-md">
              <Editor
                value={composeData.body}
                onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
                style={{ minHeight: "200px" }}
                data-testid="editor-compose-body"
              />
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nastavenie podpisu</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox id="signature-active" checked={signatureActive} onCheckedChange={(c) => setSignatureActive(!!c)} />
              <label htmlFor="signature-active" className="text-sm">Aktívny podpis</label>
            </div>
            <div className="border rounded-md">
              <Editor value={signatureHtml} onChange={(e) => setSignatureHtml(e.target.value)} style={{ minHeight: "200px" }} data-testid="editor-signature" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignatureDialogOpen(false)}>Zrušiť</Button>
            <Button onClick={() => saveSignatureMutation.mutate({ htmlContent: signatureHtml, isActive: signatureActive })} disabled={saveSignatureMutation.isPending} data-testid="button-save-signature">
              {saveSignatureMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Uložiť podpis
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!expandedMessage} onOpenChange={(open) => { if (!open) setExpandedMessage(null); }}>
        <DialogContent className="sm:max-w-[900px] h-[85vh] flex flex-col p-0 gap-0" data-testid="dialog-expanded-message">
          <DialogHeader className="p-4 pb-3 border-b">
            <DialogTitle className="flex items-center gap-3">
              {expandedMessage && (
                <>
                  <div className={`p-2 rounded ${typeColors[expandedMessage.type]?.bg || ""}`}>
                    {getTypeIcon(expandedMessage.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold truncate">{expandedMessage.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {expandedMessage.from && (
                        <span className="text-xs text-muted-foreground">{expandedMessage.from}</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(expandedMessage.timestamp), "d. MMMM yyyy, HH:mm")}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </DialogTitle>
            <DialogDescription className="sr-only">Detail správy</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-4">
            {expandedMessage?.type === "email" && emailDetail ? (
              <div className="space-y-4">
                <div className="text-sm space-y-1">
                  <p><span className="text-muted-foreground">Od:</span> {emailDetail.from?.emailAddress?.name} &lt;{emailDetail.from?.emailAddress?.address}&gt;</p>
                  <p><span className="text-muted-foreground">Komu:</span> {emailDetail.toRecipients?.map((r: any) => r.emailAddress?.address).join(", ")}</p>
                  {(emailDetail as any).ccRecipients?.length > 0 && (
                    <p><span className="text-muted-foreground">Kópia:</span> {(emailDetail as any).ccRecipients?.map((r: any) => r.emailAddress?.address).join(", ")}</p>
                  )}
                </div>
                {emailDetail.hasAttachments && (emailDetail as any).attachments?.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    {(emailDetail as any).attachments?.map((att: any, i: number) => (
                      <Badge key={i} variant="outline" className="gap-1">
                        <FileText className="h-3 w-3" />
                        {att.name}
                      </Badge>
                    ))}
                  </div>
                )}
                <div
                  className="prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: emailDetail.body?.content || "" }}
                />
              </div>
            ) : expandedMessage?.type === "task" && selectedTask ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
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
                {selectedTask.dueDate && (
                  <p className="text-sm text-muted-foreground">
                    Termín: {format(new Date(selectedTask.dueDate), "d. MMMM yyyy")}
                  </p>
                )}
                <p className="text-sm whitespace-pre-wrap">{selectedTask.description || "Bez popisu"}</p>
              </div>
            ) : expandedMessage?.type === "chat" && selectedChat ? (
              <div className="space-y-4">
                <p className="text-sm font-medium">{selectedChat.participantName}</p>
                <p className="text-sm">{selectedChat.lastMessage}</p>
              </div>
            ) : expandedMessage?.type === "sms" ? (
              <div className="space-y-4">
                <p className="text-sm whitespace-pre-wrap">{expandedMessage.preview}</p>
                {expandedMessage.aiAlertLevel && expandedMessage.aiAlertLevel !== "none" && (
                  <Badge variant="outline" className={`gap-1 ${
                    expandedMessage.aiAlertLevel === "critical"
                      ? "border-red-500 text-red-600"
                      : "border-amber-500 text-amber-600"
                  }`}>
                    {expandedMessage.aiAlertLevel === "critical" ? <ShieldAlert className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                    {expandedMessage.aiHasAngryTone && "Nahnevaný tón"}
                    {expandedMessage.aiWantsToCancel && "Chce zrušiť"}
                  </Badge>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Načítavam...
              </div>
            )}
          </div>
          <div className="p-3 border-t flex items-center justify-between gap-2">
            {expandedMessage?.type === "email" && (
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => { setReplyMode("reply"); setComposeOpen(true); setExpandedMessage(null); }} data-testid="button-expanded-reply">
                  <Reply className="h-4 w-4 mr-1" />Odpovedať
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setReplyMode("replyAll"); setComposeOpen(true); setExpandedMessage(null); }} data-testid="button-expanded-reply-all">
                  <ReplyAll className="h-4 w-4 mr-1" />Odpovedať všetkým
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setReplyMode("forward"); setComposeData({ to: "", cc: "", bcc: "", subject: `Fwd: ${expandedMessage?.title}`, body: "" }); setComposeOpen(true); setExpandedMessage(null); }} data-testid="button-expanded-forward">
                  <Forward className="h-4 w-4 mr-1" />Preposlať
                </Button>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => setExpandedMessage(null)} data-testid="button-expanded-close">
              Zavrieť
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
