import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, Check, CheckCheck, MessageCircle, Paperclip, RefreshCw, Search, Send, Wifi, WifiOff } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { useChatContext } from "@/contexts/chat-context";
import { useI18n } from "@/i18n";
import { apiRequest } from "@/lib/queryClient";
import { TaskAttachmentList, TaskAttachmentPicker } from "../tasks/task-attachments";
import type { TaskAttachment } from "@shared/task-attachments";
import type { ChatMessage } from "@shared/schema";
import "./internal-chat-panel.css";

type Person = { id: string; fullName: string | null; username: string; avatarUrl?: string | null };
type Conversation = { partnerId: string; partner: Person; unreadCount: number; lastMessage: ChatMessage | null };
type Draft = { text: string; attachments: TaskAttachment[]; busy: boolean; uploadError: boolean };
export type InternalChatDraftSnapshot = { text: string; attachments: TaskAttachment[] };
type PendingSend = { partnerId: string; text: string; attachments: TaskAttachment[]; sentAt: number };
type Props = {
  initialPartnerId?: string | null;
  active?: boolean;
  onPartnerChange?: (partnerId: string | null) => void;
  persistedDrafts?: Record<string, InternalChatDraftSnapshot>;
  onPersistedDraftsChange?: (drafts: Record<string, InternalChatDraftSnapshot>) => void;
};
type ExtendedSend = (receiverId: string, content: string, clientMessageId?: string, attachments?: TaskAttachment[]) => boolean;
const BRATISLAVA_TZ = "Europe/Bratislava";
type DatePart = Intl.DateTimeFormatPart["type"];
let communicationViewOwner: object | null = null;

async function loadJson<T>(url: string): Promise<T> {
  const response = await apiRequest("GET", url);
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<T>;
}

function messageValue<T>(message: ChatMessage, key: string): T | undefined {
  return (message as unknown as Record<string, unknown>)[key] as T | undefined;
}
function personName(person: Person): string {
  return person.fullName?.trim() || person.username;
}
function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase() || "?";
}
function getDate(message?: ChatMessage | null): Date | null {
  if (!message) return null;
  const value = messageValue<string | Date>(message, "createdAt")
    || messageValue<string | Date>(message, "timestamp")
    || messageValue<string | Date>(message, "sentAt");
  const date = value instanceof Date ? value : new Date(value || "");
  return Number.isNaN(date.getTime()) ? null : date;
}
function dayKey(date: Date, locale: string): string {
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone: BRATISLAVA_TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const value = (type: DatePart) => parts.find(part => part.type === type)?.value || "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}
function dayLabel(date: Date, locale: string): string {
  const formatter = new Intl.DateTimeFormat(locale, { timeZone: BRATISLAVA_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  const todayParts = formatter.formatToParts(new Date());
  const part = (type: DatePart) => Number(todayParts.find(item => item.type === type)?.value);
  const yesterday = new Date(Date.UTC(part("year"), part("month") - 1, part("day") - 1));
  const today = dayKey(new Date(), locale);
  const yesterdayKey = dayKey(yesterday, locale);
  const key = dayKey(date, locale);
  if (key === today) return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(0, "day");
  if (key === yesterdayKey) return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-1, "day");
  const dateParts = formatter.formatToParts(date);
  const currentYear = part("year");
  const messageYear = Number(dateParts.find(item => item.type === "year")?.value);
  return new Intl.DateTimeFormat(locale, {
    timeZone: BRATISLAVA_TZ,
    month: "long",
    day: "numeric",
    year: messageYear === currentYear ? undefined : "numeric",
  }).format(date);
}
function messageKey(message: ChatMessage, index: number): string {
  const id = messageValue<string | number>(message, "id");
  const clientId = messageValue<string>(message, "clientMessageId");
  return id !== undefined && id !== null ? `id:${id}` : clientId ? `client:${clientId}` : `fallback:${index}:${getDate(message)?.getTime() || 0}`;
}
function mergeMessageLists(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const merged = new Map<string, ChatMessage>();
  [...existing, ...incoming].forEach((message, index) => {
    const id = messageValue<string | number>(message, "id");
    const clientId = messageValue<string>(message, "clientMessageId");
    const key = id !== undefined && id !== null
      ? `id:${id}`
      : clientId
        ? `client:${clientId}`
        : `fallback:${messageValue<string>(message, "senderId") || ""}:${getDate(message)?.getTime() || index}:${messageValue<string>(message, "content") || ""}`;
    const previous = merged.get(key);
    merged.set(key, previous ? {
      ...previous,
      ...message,
      isRead: messageValue<boolean>(previous, "isRead") === true || messageValue<boolean>(message, "isRead") === true,
    } as ChatMessage : message);
  });
  return Array.from(merged.values()).sort((a, b) => (getDate(a)?.getTime() || 0) - (getDate(b)?.getTime() || 0));
}
function formatTime(date: Date | null, locale: string): string {
  return date ? new Intl.DateTimeFormat(locale, {
    timeZone: BRATISLAVA_TZ,
    hour: "numeric",
    minute: "2-digit",
  }).format(date) : "";
}

export function InternalChatPanel({
  initialPartnerId, active = true, onPartnerChange, persistedDrafts, onPersistedDraftsChange,
}: Props) {
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const chat = useChatContext();
  const sendChatMessage = chat.sendMessage as ExtendedSend;
  const [activeId, setActiveId] = useState<string | null>(initialPartnerId || null);
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    const restored: Record<string, Draft> = {};
    Object.entries(persistedDrafts || {}).forEach(([id, draft]) => {
      restored[id] = { text: draft.text, attachments: draft.attachments, busy: false, uploadError: false };
    });
    return restored;
  });
  const [messagesByPartner, setMessagesByPartner] = useState<Record<string, ChatMessage[]>>({});
  const [pending, setPending] = useState<Record<string, PendingSend>>({});
  const [deliveryError, setDeliveryError] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const [isVisible, setIsVisible] = useState(() => typeof document === "undefined" || !document.hidden);
  const [windowFocused, setWindowFocused] = useState(() => typeof document === "undefined" || document.hasFocus());
  const threadRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingPartner = useRef<string | null>(null);
  const activeIdRef = useRef(activeId);
  const pendingRef = useRef(pending);
  const threadVisibleRef = useRef(false);
  const deliverySnapshotsRef = useRef<Record<string, PendingSend>>({});
  const onPartnerChangeRef = useRef(onPartnerChange);
  const onPersistedDraftsChangeRef = useRef(onPersistedDraftsChange);
  const persistedDraftsRef = useRef(persistedDrafts);
  const draftsRef = useRef(drafts);
  const communicationClaimRef = useRef<object>({});
  activeIdRef.current = activeId;
  pendingRef.current = pending;
  onPartnerChangeRef.current = onPartnerChange;
  onPersistedDraftsChangeRef.current = onPersistedDraftsChange;
  draftsRef.current = drafts;
  useEffect(() => {
    if (persistedDraftsRef.current === persistedDrafts) return;
    persistedDraftsRef.current = persistedDrafts;
    const restored: Record<string, Draft> = {};
    Object.entries(persistedDrafts || {}).forEach(([id, draft]) => {
      restored[id] = { text: draft.text, attachments: draft.attachments, busy: false, uploadError: false };
    });
    draftsRef.current = restored;
    setDrafts(restored);
  }, [persistedDrafts]);

  const peopleQuery = useQuery({
    queryKey: ["/api/chat/people", user?.id],
    queryFn: () => loadJson<Person[]>("/api/chat/people"),
    enabled: !!user?.id && active,
    retry: false,
    refetchInterval: active ? 30_000 : false,
    refetchOnWindowFocus: true,
  });
  const conversationsQuery = useQuery({
    queryKey: ["/api/chat/conversations", user?.id],
    queryFn: () => loadJson<Conversation[]>("/api/chat/conversations"),
    enabled: !!user?.id && active,
    retry: false,
    refetchInterval: active ? 30_000 : false,
    refetchOnWindowFocus: true,
  });
  const people = peopleQuery.data || [];
  const conversations = conversationsQuery.data || [];
  const peopleById = useMemo(() => new Map(people.map(person => [person.id, person])), [people]);
  const directory = useMemo(() => {
    const records = new Map<string, Person>();
    people.forEach(person => records.set(person.id, person));
    conversations.forEach(conversation => {
      if (!records.has(conversation.partnerId)) records.set(conversation.partnerId, conversation.partner);
    });
    return Array.from(records.values());
  }, [people, conversations]);
  const conversationsById = useMemo(() => new Map(conversations.map(item => [item.partnerId, item])), [conversations]);
  const partner = activeId
    ? peopleById.get(activeId) || conversationsById.get(activeId)?.partner
    : undefined;
  const messagesQuery = useQuery({
    queryKey: ["/api/chat/messages", user?.id, activeId],
    queryFn: () => loadJson<ChatMessage[]>(`/api/chat/messages/${encodeURIComponent(activeId!)}?limit=200`),
    enabled: !!user?.id && active && !!activeId && !!partner,
    retry: false,
    refetchInterval: active ? 30_000 : false,
    refetchOnWindowFocus: true,
  });
  const onlineIds = useMemo(() => new Set(chat.onlineUsers.map(person => person.id)), [chat.onlineUsers]);
  const filteredPeople = useMemo(() => directory
    .filter(person => `${personName(person)} ${person.username}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => {
      const onlineDifference = Number(onlineIds.has(b.id)) - Number(onlineIds.has(a.id));
      if (onlineDifference) return onlineDifference;
      const aTime = getDate(conversationsById.get(a.id)?.lastMessage)?.getTime() || 0;
      const bTime = getDate(conversationsById.get(b.id)?.lastMessage)?.getTime() || 0;
      return bTime - aTime || personName(a).localeCompare(personName(b));
    }), [directory, search, onlineIds, conversationsById]);
  const activeDraft: Draft | null = activeId
    ? drafts[activeId] || { text: "", attachments: [], busy: false, uploadError: false }
    : null;
  const visibleMessages = activeId ? messagesByPartner[activeId] || messagesQuery.data || [] : [];
  const threadLoaded = active && !!activeId && !!partner && messagesQuery.isSuccess;
  const threadVisible = !!threadLoaded && isVisible && windowFocused;
  threadVisibleRef.current = threadVisible;
  const hasPendingForActive = !!activeId && Object.values(pending).some(item => item.partnerId === activeId);
  const sendBlocked = !activeId || !activeDraft || !chat.isConnected || activeDraft.busy || activeDraft.uploadError
    || messagesQuery.isPending || messagesQuery.isError || hasPendingForActive
    || (!activeDraft.text.trim() && !activeDraft.attachments.length);

  const mergeMessages = useCallback((partnerId: string, incoming: ChatMessage[]) => {
    setMessagesByPartner(previous => ({
      ...previous,
      [partnerId]: mergeMessageLists(previous[partnerId] || [], incoming),
    }));
  }, []);
  const mergeMessage = useCallback((partnerId: string, message: ChatMessage) => {
    mergeMessages(partnerId, [message]);
    if (active) void queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations", user?.id] });
  }, [active, mergeMessages, queryClient, user?.id]);
  const refetchChatData = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["/api/chat/people", user?.id] });
    void queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations", user?.id] });
    if (active && activeIdRef.current) void queryClient.invalidateQueries({ queryKey: ["/api/chat/messages", user?.id, activeIdRef.current] });
  }, [active, queryClient, user?.id]);

  useEffect(() => {
    const onVisibility = () => setIsVisible(!document.hidden);
    const onFocus = () => { setWindowFocused(true); if (active) refetchChatData(); };
    const onBlur = () => setWindowFocused(false);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
    };
  }, [active, refetchChatData]);
  useEffect(() => {
    if (initialPartnerId !== undefined && initialPartnerId !== activeIdRef.current) setActiveId(initialPartnerId || null);
  }, [initialPartnerId]);
  useEffect(() => {
    onPartnerChangeRef.current?.(activeId);
  }, [activeId]);
  useEffect(() => {
    const onOpen = (event: Event) => {
      const id = (event as CustomEvent<{ partnerId?: string }>).detail?.partnerId;
      if (active && id) setActiveId(id);
    };
    window.addEventListener("chat_open_conversation", onOpen);
    return () => window.removeEventListener("chat_open_conversation", onOpen);
  }, [active]);
  useEffect(() => {
    if (active && activeId && peopleQuery.isSuccess && conversationsQuery.isSuccess && !partner) setActiveId(null);
  }, [active, activeId, peopleQuery.isSuccess, conversationsQuery.isSuccess, partner]);
  useEffect(() => {
    if (active && threadVisible && activeId) {
      communicationViewOwner = communicationClaimRef.current;
      chat.setCommunicationView(true, activeId);
    } else if (communicationViewOwner === communicationClaimRef.current) {
      communicationViewOwner = null;
      chat.setCommunicationView(false, null);
    }
    return () => {
      if (communicationViewOwner === communicationClaimRef.current) {
        communicationViewOwner = null;
        chat.setCommunicationView(false, null);
      }
    };
  }, [active, threadVisible, activeId, chat.setCommunicationView]);
  useEffect(() => {
    if (!threadVisible || !activeId) return;
    chat.markAsRead(activeId);
    void queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations", user?.id] });
  }, [threadVisible, activeId, messagesQuery.dataUpdatedAt, chat.markAsRead, queryClient, user?.id]);
  useEffect(() => {
    if (messagesQuery.data && activeId) mergeMessages(activeId, messagesQuery.data);
  }, [messagesQuery.data, activeId, mergeMessages]);

  useEffect(() => {
    const onNewMessage = (event: Event) => {
      const detail = (event as CustomEvent<{ message: ChatMessage; partnerId: string }>).detail;
      if (!active || !detail?.message || !detail.partnerId) return;
      mergeMessage(detail.partnerId, detail.message);
      if (activeIdRef.current === detail.partnerId && threadVisibleRef.current) chat.markAsRead(detail.partnerId);
    };
    const onDelivered = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: ChatMessage; clientMessageId?: string }>).detail;
      if (!detail?.clientMessageId) return;
      const queued = pendingRef.current[detail.clientMessageId] || deliverySnapshotsRef.current[detail.clientMessageId];
      if (!queued) return;
      if (detail.message) mergeMessage(queued.partnerId, detail.message);
      delete deliverySnapshotsRef.current[detail.clientMessageId];
      const nextDrafts = (() => {
        const previous = draftsRef.current;
        const draft = previous[queued.partnerId] || { text: "", attachments: [], busy: false, uploadError: false };
        const textMatches = draft.text === queued.text;
        const filesMatch = draft.attachments.length === queued.attachments.length
          && draft.attachments.every((file, index) => file.url === queued.attachments[index]?.url);
        return {
          ...previous,
          [queued.partnerId]: {
            ...draft,
            text: textMatches ? "" : draft.text,
            attachments: filesMatch ? [] : draft.attachments,
          },
        };
      })();
      commitDrafts(nextDrafts);
      const nextPending = { ...pendingRef.current };
      delete nextPending[detail.clientMessageId];
      pendingRef.current = nextPending;
      setPending(nextPending);
      setDeliveryError(false);
    };
    const onDeliveryError = (event: Event) => {
      const id = (event as CustomEvent<{ clientMessageId?: string }>).detail?.clientMessageId;
      if (id) {
        const nextPending = { ...pendingRef.current };
        delete nextPending[id];
        pendingRef.current = nextPending;
        setPending(nextPending);
        delete deliverySnapshotsRef.current[id];
      }
      setDeliveryError(true);
    };
    const onMessagesRead = (event: Event) => {
      const readBy = (event as CustomEvent<{ readBy?: string }>).detail?.readBy;
      const partnerId = activeIdRef.current;
      if (!active || !readBy || !partnerId || readBy !== partnerId) return;
      const markCurrentDeliveredRead = (messages: ChatMessage[]) => messages.map(message => {
          if (messageValue<string>(message, "senderId") !== user?.id) return message;
          return { ...message, isRead: true } as ChatMessage;
      });
      setMessagesByPartner(previous => ({ ...previous, [partnerId]: markCurrentDeliveredRead(previous[partnerId] || []) }));
      queryClient.setQueryData<ChatMessage[]>(["/api/chat/messages", user?.id, partnerId], previous =>
        previous ? markCurrentDeliveredRead(previous) : previous);
    };
    const onTyping = (event: Event) => {
      const detail = (event as CustomEvent<{ userId: string; isTyping: boolean }>).detail;
      if (active && detail?.userId) setTypingUsers(previous => ({ ...previous, [detail.userId]: !!detail.isTyping }));
    };
    window.addEventListener("chat_new_message", onNewMessage);
    window.addEventListener("chat_delivery_confirmed", onDelivered);
    window.addEventListener("chat_delivery_error", onDeliveryError);
    window.addEventListener("chat_messages_read", onMessagesRead);
    window.addEventListener("chat_user_typing", onTyping);
    return () => {
      window.removeEventListener("chat_new_message", onNewMessage);
      window.removeEventListener("chat_delivery_confirmed", onDelivered);
      window.removeEventListener("chat_delivery_error", onDeliveryError);
      window.removeEventListener("chat_messages_read", onMessagesRead);
      window.removeEventListener("chat_user_typing", onTyping);
    };
  }, [active, mergeMessage, isVisible, windowFocused, user?.id, chat.markAsRead, queryClient]);
  useEffect(() => {
    if (threadLoaded && threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [threadLoaded, visibleMessages.length]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      const expired = Object.entries(pendingRef.current).filter(([, item]) => Date.now() - item.sentAt > 15_000);
      if (expired.length) {
        const nextPending = { ...pendingRef.current };
        expired.forEach(([id]) => delete nextPending[id]);
        pendingRef.current = nextPending;
        setPending(nextPending);
        setDeliveryError(true);
      }
      Object.entries(deliverySnapshotsRef.current).forEach(([id, snapshot]) => {
        if (Date.now() - snapshot.sentAt > 10 * 60_000) delete deliverySnapshotsRef.current[id];
      });
    }, 2500);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => () => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (typingPartner.current) chat.sendTypingIndicator(typingPartner.current, false);
  }, [chat.sendTypingIndicator]);
  useEffect(() => {
    if (active || !typingPartner.current) return;
    chat.sendTypingIndicator(typingPartner.current, false);
    typingPartner.current = null;
    if (typingTimer.current) clearTimeout(typingTimer.current);
  }, [active, chat.sendTypingIndicator]);
  useEffect(() => {
    if (!typingPartner.current || typingPartner.current === activeId) return;
    chat.sendTypingIndicator(typingPartner.current, false);
    typingPartner.current = null;
    if (typingTimer.current) clearTimeout(typingTimer.current);
  }, [activeId, chat.sendTypingIndicator]);

  const commitDrafts = (next: Record<string, Draft>) => {
    draftsRef.current = next;
    setDrafts(next);
    const snapshot: Record<string, InternalChatDraftSnapshot> = {};
    Object.entries(next).forEach(([id, draft]) => { snapshot[id] = { text: draft.text, attachments: draft.attachments }; });
    persistedDraftsRef.current = snapshot;
    onPersistedDraftsChangeRef.current?.(snapshot);
  };
  const updateDraftFor = (partnerId: string, patch: Partial<Draft>) => {
    const previous = draftsRef.current;
    commitDrafts({
      ...previous,
      [partnerId]: { ...(previous[partnerId] || { text: "", attachments: [], busy: false, uploadError: false }), ...patch },
    });
  };
  const changeText = (text: string) => {
    if (!activeId) return;
    updateDraftFor(activeId, { text });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (text.trim()) {
      if (typingPartner.current && typingPartner.current !== activeId) chat.sendTypingIndicator(typingPartner.current, false);
      typingPartner.current = activeId;
      chat.sendTypingIndicator(activeId, true);
      const recipientId = activeId;
      typingTimer.current = setTimeout(() => {
        chat.sendTypingIndicator(recipientId, false);
        if (typingPartner.current === recipientId) typingPartner.current = null;
      }, 1800);
    } else {
      chat.sendTypingIndicator(activeId, false);
      typingPartner.current = null;
    }
  };
  const send = () => {
    if (sendBlocked || !activeId || !activeDraft) return;
    const clientMessageId = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    const text = activeDraft.text;
    const attachments = [...activeDraft.attachments];
    const nextPending = {
      ...pendingRef.current,
      [clientMessageId]: { partnerId: activeId, text, attachments, sentAt: Date.now() },
    };
    deliverySnapshotsRef.current[clientMessageId] = nextPending[clientMessageId];
    pendingRef.current = nextPending;
    setPending(nextPending);
    if (!sendChatMessage(activeId, text, clientMessageId, attachments)) {
      const reverted = { ...pendingRef.current };
      delete reverted[clientMessageId];
      delete deliverySnapshotsRef.current[clientMessageId];
      pendingRef.current = reverted;
      setPending(reverted);
      setDeliveryError(true);
      return;
    }
    setDeliveryError(false);
    chat.sendTypingIndicator(activeId, false);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingPartner.current = null;
  };

  const copy = t.taskCommunication;
  const omni = t.nexusOmni.chats;
  const onlineLabel = omni.online;
  const offlineLabel = omni.offline;
  const noMessagesLabel = omni.noMessages;
  const selectLabel = omni.selectConversation;
  const privateHint = copy.privateHint;
  const loadFailed = copy.loadFailed;
  const emptyText = (message: ChatMessage | null | undefined) =>
    message && messageValue<TaskAttachment[]>(message, "attachments")?.length ? copy.attachmentOnly : "";
  const unreadFor = (id: string) => chat.unreadCounts.get(id) || conversationsById.get(id)?.unreadCount || 0;
  const pickerPartnerId = activeId;

  const renderMessages = () => {
    if (messagesQuery.isPending) return <div className="icp-loading" aria-label={t.common.loading}><span /><span /><span /></div>;
    if (messagesQuery.isError) return <div className="icp-state"><AlertCircle /><p>{loadFailed}</p><button type="button" onClick={() => void messagesQuery.refetch()}><RefreshCw />{t.common.refresh}</button></div>;
    if (!visibleMessages.length) return <div className="icp-empty"><MessageCircle /><strong>{noMessagesLabel}</strong><span>{privateHint}</span></div>;
    let previousDay = "";
    return visibleMessages.map((message, index) => {
      const own = messageValue<string>(message, "senderId") === user?.id;
      const date = getDate(message);
      const day = date ? dayKey(date, locale) : `unknown-${index}`;
      const showDay = day !== previousDay;
      previousDay = day;
      const attachments = messageValue<TaskAttachment[]>(message, "attachments") || [];
      const content = messageValue<string>(message, "content") || "";
      const id = messageValue<string | number>(message, "id");
      const messageId = id !== undefined && id !== null ? String(id) : messageKey(message, index);
      const isRead = messageValue<boolean>(message, "isRead") === true;
      return <div key={messageId}>
        {showDay && date && <div className="icp-day"><span>{dayLabel(date, locale)}</span></div>}
        <article className={`icp-message ${own ? "is-own" : "is-other"}`}>
          <div className="icp-message-meta"><b>{own ? user?.fullName?.trim() || user?.username : personName(partner!)}</b><time>{formatTime(date, locale)}</time></div>
          {content && <p>{content}</p>}
          <TaskAttachmentList attachments={attachments} className="icp-message-files" />
          {own && <div className="icp-receipt">{isRead ? <><CheckCheck />{copy.read}</> : <><Check />{copy.sent}</>}</div>}
        </article>
      </div>;
    });
  };

  const rosterLoading = peopleQuery.isPending && conversationsQuery.isPending;
  const rosterHasData = peopleQuery.isSuccess || conversationsQuery.isSuccess;
  const retryRoster = () => {
    if (peopleQuery.isError) void peopleQuery.refetch();
    if (conversationsQuery.isError) void conversationsQuery.refetch();
  };

  return <section className="pulse-live icp-root" aria-label={copy.directMessages}>
    <div className={`icp-shell ${activeId ? "has-active" : ""}`}>
      <aside className="icp-sidebar">
        <header className="icp-side-head">
          <div><span className="icp-kicker">{copy.inboxLabel}</span><h2>{copy.directMessages}</h2></div>
          <span className={`icp-connection ${chat.isConnected ? "connected" : ""}`} title={chat.isConnected ? copy.connected : copy.disconnected} aria-label={chat.isConnected ? copy.connected : copy.disconnected}>
            {chat.isConnected ? <Wifi /> : <WifiOff />}
          </span>
        </header>
        <label className="icp-search"><Search /><input value={search} onChange={event => setSearch(event.target.value)} placeholder={copy.searchColleagues} aria-label={copy.searchColleagues} /></label>
        <div className="icp-roster" role="group" aria-label={copy.colleagues}>
          {rosterLoading && <div className="icp-roster-state" aria-label={t.common.loading}><span /><span /><span /></div>}
          {(peopleQuery.isError || conversationsQuery.isError) && <div className="icp-state compact"><AlertCircle /><p>{loadFailed}</p><button type="button" onClick={retryRoster}><RefreshCw />{t.common.refresh}</button></div>}
          {rosterHasData && filteredPeople.length === 0 && <div className="icp-roster-empty">{search ? t.common.noResults : selectLabel}</div>}
          {filteredPeople.map(person => {
            const name = personName(person);
            const online = onlineIds.has(person.id);
            const unread = unreadFor(person.id);
            const lastMessage = conversationsById.get(person.id)?.lastMessage;
            const preview = lastMessage ? messageValue<string>(lastMessage, "content") || emptyText(lastMessage) : person.username;
            return <button type="button" key={person.id} onClick={() => { setActiveId(person.id); setDeliveryError(false); }} className={`icp-person ${activeId === person.id ? "selected" : ""}`} aria-current={activeId === person.id ? "true" : undefined}>
              <span className="icp-avatar">{person.avatarUrl ? <img src={person.avatarUrl} alt="" /> : initials(name)}<i className={online ? "online" : ""} /></span>
              <span className="icp-person-copy">
                <span className="icp-person-top"><b>{name}</b><time>{formatTime(getDate(lastMessage), locale)}</time></span>
                <span className="icp-person-bottom"><i className={online ? "online" : ""}>{online ? onlineLabel : offlineLabel}</i><span>{preview.slice(0, 48)}</span></span>
              </span>
              {unread > 0 && <em className="icp-unread">{unread > 99 ? "99+" : unread}</em>}
            </button>;
          })}
        </div>
      </aside>
      <main className="icp-conversation">
        {!activeId || !partner ? <div className="icp-welcome">
          <span className="icp-welcome-mark"><MessageCircle /></span>
          <span className="icp-kicker">{copy.privateLabel}</span>
          <h2>{selectLabel}</h2>
          <p>{privateHint}</p>
        </div> : <>
          <header className="icp-chat-head">
            <button type="button" className="icp-back" onClick={() => setActiveId(null)} aria-label={copy.backToColleagues}><ArrowLeft /></button>
            <span className="icp-avatar large">{partner.avatarUrl ? <img src={partner.avatarUrl} alt="" /> : initials(personName(partner))}<i className={onlineIds.has(partner.id) ? "online" : ""} /></span>
            <div className="icp-chat-person"><b>{personName(partner)}</b><span><i className={onlineIds.has(partner.id) ? "online" : ""} />{onlineIds.has(partner.id) ? onlineLabel : offlineLabel}</span></div>
            <span className="icp-private-tag">{copy.privateLabel}</span>
          </header>
          <div className="icp-thread" ref={threadRef} aria-live="polite">
            {renderMessages()}
            {typingUsers[partner.id] && <div className="icp-typing"><span className="icp-typing-dots"><i /><i /><i /></span><span>{personName(partner)} {omni.typing}</span></div>}
            {hasPendingForActive && <div className="icp-pending-label">{copy.sending}</div>}
          </div>
          <div className="icp-compose">
            {!chat.isConnected && <div className="icp-notice"><WifiOff />{copy.offlineHint}<button type="button" onClick={refetchChatData}>{t.common.refresh}</button></div>}
            {deliveryError && <div className="icp-notice error"><AlertCircle />{copy.saveFailed}</div>}
            <TaskAttachmentPicker
              key={pickerPartnerId}
              attachments={activeDraft?.attachments || []}
              onChange={attachments => { if (pickerPartnerId) updateDraftFor(pickerPartnerId, { attachments }); }}
              onBusyChange={busy => { if (pickerPartnerId) updateDraftFor(pickerPartnerId, { busy }); }}
              onErrorChange={uploadError => { if (pickerPartnerId) updateDraftFor(pickerPartnerId, { uploadError }); }}
              disabled={!pickerPartnerId}
            />
            <div className="icp-compose-row">
              <textarea value={activeDraft?.text || ""} onChange={event => changeText(event.target.value)} onKeyDown={event => {
                if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); }
              }} placeholder={omni.typeMessage} rows={2} aria-label={omni.typeMessage} />
              <button type="button" className="icp-send" onClick={send} disabled={sendBlocked}><Send />{copy.send}</button>
            </div>
            <div className="icp-compose-foot"><span><Paperclip />{copy.messagesOutsideTasks}</span><span>{copy.enterToSend} · {copy.shiftEnterNewLine}</span></div>
          </div>
        </>}
      </main>
    </div>
  </section>;
}
