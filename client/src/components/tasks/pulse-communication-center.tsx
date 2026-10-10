import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, MessageSquareText, Send, Clock3, Users, UserRound, LockKeyhole } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/auth-context";
import { useChatContext } from "@/contexts/chat-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Task, TaskComment, ChatMessage } from "@shared/schema";
import { requestTypeLabel } from "./request-routing-model";
import "./task-communications.css";
import { TaskAttachmentList } from "./task-attachments";
import type { TaskAttachment } from "@shared/task-attachments";

type Person = { id: string; fullName: string | null; username: string; avatarUrl?: string | null };
type Conversation = { partnerId: string; partner: Person | null; unreadCount: number; lastMessage: ChatMessage };
const personName = (person?: Person | null) => person?.fullName || person?.username || "";
function commentAttachments(comment: TaskComment): TaskAttachment[] {
  const metadata = comment.metadata;
  return metadata && typeof metadata === "object" && "attachments" in metadata && Array.isArray(metadata.attachments)
    ? metadata.attachments as TaskAttachment[] : [];
}
function stateKey(task: Task) {
  if (task.status === "cancelled") return "cancelled";
  if (task.status === "completed" || task.boState === "done") return "completed";
  if (task.boState === "waiting_agent") return "waiting_agent";
  if (task.status === "in_progress" || task.boState === "in_progress") return "in_progress";
  return "pending";
}
export function PulseCommunicationCenter({ open, onOpenChange, onNewRequest, onTaskViewed }: {
  open: boolean; onOpenChange: (value: boolean) => void; onNewRequest: () => void; onTaskViewed?: (task: Task) => void;
}) {
  const { t, locale } = useI18n();
  const c = t.taskCommunication;
  const { user } = useAuth();
  const chat = useChatContext();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [mode, setMode] = useState<"tasks" | "direct">("tasks");
  const [taskId, setTaskId] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [search, setSearch] = useState("");
  const [colleagueSearch, setColleagueSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [taskDrafts, setTaskDrafts] = useState<Record<string, string>>({});
  const [directDrafts, setDirectDrafts] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const pendingSend = useRef<{ id: string; partnerId: string; text: string; timeout: ReturnType<typeof setTimeout> } | null>(null);
  const messageEnd = useRef<HTMLDivElement>(null);
  const stamp = (date?: string | Date | null) => {
    if (!date) return "";
    const value = typeof date === "string" ? new Date(date) : date;
    return Number.isFinite(value.getTime()) ? new Intl.DateTimeFormat(locale, {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bratislava",
    }).format(value) : "";
  };
  const tasks = useQuery<Task[]>({
    queryKey: ["/api/tasks/created", user?.id], queryFn: async () => (await apiRequest("GET", "/api/tasks/created")).json(),
    enabled: open && !!user?.id, staleTime: 0, refetchInterval: open ? 15000 : false,
  });
  const people = useQuery<Person[]>({
    queryKey: ["/api/tasks/people", user?.id], queryFn: async () => (await apiRequest("GET", "/api/tasks/people")).json(), enabled: open,
  });
  const colleagues = useQuery<Person[]>({
    queryKey: ["/api/chat/people", user?.id], queryFn: async () => (await apiRequest("GET", "/api/chat/people")).json(), enabled: open && mode === "direct",
  });
  const conversations = useQuery<Conversation[]>({
    queryKey: ["/api/chat/conversations", user?.id], queryFn: async () => (await apiRequest("GET", "/api/chat/conversations")).json(),
    enabled: open, staleTime: 0, refetchInterval: open ? 15000 : false,
  });
  const statusLabel = (task: Task) => stateKey(task) === "waiting_agent" ? t.backOffice.stateWaitingAgent : t.tasks.statuses[stateKey(task) as keyof typeof t.tasks.statuses];
  const handler = (task: Task) => {
    const groups = task.tags.filter(tag => tag.startsWith("group:")).map(tag => tag.slice(6));
    const ids = task.requestRecipients?.userIds || (groups.length ? [] : [task.assignedUserId]);
    return [...groups, ...ids.map(id => personName(people.data?.find(person => person.id === id))).filter(Boolean)].join(" · ");
  };
  const shown = (tasks.data || []).filter(task => (filter === "all" || stateKey(task) === filter)
    && `${task.title} ${handler(task)} ${task.requestRecipients?.typeName || ""}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const task = shown.find(row => row.id === taskId) || shown[0];
  const comments = useQuery<TaskComment[]>({
    queryKey: ["/api/tasks", user?.id, task?.id, "comments"], queryFn: async () => (await apiRequest("GET", `/api/tasks/${encodeURIComponent(task!.id)}/comments`)).json(),
    enabled: open && mode === "tasks" && !!task?.id, staleTime: 0, refetchInterval: open && mode === "tasks" ? 10000 : false,
  });
  useEffect(() => {
    if (open && mode === "tasks" && task && comments.isSuccess) onTaskViewed?.(task);
  }, [open, mode, task, comments.isSuccess, onTaskViewed]);
  const directory = useMemo(() => {
    const result = new Map<string, Person>();
    (conversations.data || []).forEach(thread => { if (thread.partner) result.set(thread.partnerId, thread.partner); });
    (colleagues.data || []).forEach(person => result.set(person.id, person));
    return [...result.values()];
  }, [conversations.data, colleagues.data]);
  const shownPeople = directory.filter(person => `${personName(person)} ${person.username}`.toLocaleLowerCase().includes(colleagueSearch.toLocaleLowerCase()));
  const partner = shownPeople.find(person => person.id === partnerId) || shownPeople[0];
  const messages = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat/messages", user?.id, partner?.id], queryFn: async () => (await apiRequest("GET", `/api/chat/messages/${encodeURIComponent(partner!.id)}?limit=200`)).json(),
    enabled: open && mode === "direct" && !!partner?.id, staleTime: 0, refetchInterval: open && mode === "direct" ? 10000 : false,
  });
  useEffect(() => {
    chat.setCommunicationView(open, open && mode === "direct" ? partner?.id || null : null);
    return () => chat.setCommunicationView(false, null);
  }, [open, mode, partner?.id, chat.setCommunicationView]);
  useEffect(() => {
    if (open && mode === "direct" && partner?.id && messages.isSuccess) {
      chat.markAsRead(partner.id);
      void qc.invalidateQueries({ queryKey: ["/api/chat/conversations", user?.id] });
      messageEnd.current?.scrollIntoView({ block: "end" });
    }
  }, [open, mode, partner?.id, messages.dataUpdatedAt, chat.markAsRead, qc, user?.id]);
  useEffect(() => {
    if (open) { setSearch(""); setColleagueSearch(""); setFilter("all"); }
  }, [open]);
  useEffect(() => {
    setTaskDrafts({}); setDirectDrafts({}); setTaskId(""); setPartnerId("");
    if (pendingSend.current) clearTimeout(pendingSend.current.timeout);
    pendingSend.current = null; setSending(false);
  }, [user?.id]);
  useEffect(() => {
    const invalidate = () => {
      void qc.invalidateQueries({ queryKey: ["/api/chat/messages", user?.id] });
      void qc.invalidateQueries({ queryKey: ["/api/chat/conversations", user?.id] });
    };
    const delivered = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const pending = pendingSend.current;
      if (pending && detail.clientMessageId === pending.id) {
        clearTimeout(pending.timeout); pendingSend.current = null; setSending(false);
        setDirectDrafts(previous => previous[pending.partnerId]?.trim() === pending.text ? { ...previous, [pending.partnerId]: "" } : previous);
      }
      invalidate();
    };
    const failed = (event: Event) => {
      const pending = pendingSend.current;
      if (!pending || (event as CustomEvent).detail.clientMessageId !== pending.id) return;
      clearTimeout(pending.timeout); pendingSend.current = null; setSending(false);
      toast({ title: c.saveFailed, variant: "destructive" }); invalidate();
    };
    window.addEventListener("chat_new_message", invalidate);
    window.addEventListener("chat_delivery_confirmed", delivered);
    window.addEventListener("chat_delivery_error", failed);
    return () => {
      window.removeEventListener("chat_new_message", invalidate);
      window.removeEventListener("chat_delivery_confirmed", delivered);
      window.removeEventListener("chat_delivery_error", failed);
    };
  }, [qc, user?.id, c.saveFailed, toast]);
  useEffect(() => () => { if (pendingSend.current) clearTimeout(pendingSend.current.timeout); }, []);
  const commentMutation = useMutation({
    mutationFn: async ({ id, text, answer }: { id: string; text: string; answer: boolean }) => {
      return apiRequest("POST", answer ? `/api/agent/bo-questions/${encodeURIComponent(id)}/answer` : `/api/tasks/${encodeURIComponent(id)}/comments`, { content: text });
    },
    onSuccess: (_data, variables) => {
      setTaskDrafts(previous => previous[variables.id]?.trim() === variables.text ? { ...previous, [variables.id]: "" } : previous);
      void qc.invalidateQueries({ queryKey: ["/api/tasks"] });
      void qc.invalidateQueries({ queryKey: ["/api/tasks/created"] });
      void qc.invalidateQueries({ queryKey: ["/api/agent/bo-questions"] });
    },
    onError: () => toast({ title: c.saveFailed, variant: "destructive" }),
  });
  const sendTask = () => {
    const text = task && (taskDrafts[task.id] || "").trim();
    if (!task || !text || commentMutation.isPending || comments.isError) return;
    commentMutation.mutate({ id: task.id, text, answer: task.boState === "waiting_agent" && task.tags.includes("back_office") });
  };
  const sendDirect = () => {
    const text = partner && (directDrafts[partner.id] || "").trim();
    if (!partner || !text || sending || !chat.isConnected || messages.isError) return;
    const id = crypto.randomUUID();
    if (!chat.sendMessage(partner.id, text, id)) { toast({ title: c.offlineHint, variant: "destructive" }); return; }
    const timeout = setTimeout(() => {
      pendingSend.current = null; setSending(false);
      toast({ title: c.saveFailed, variant: "destructive" });
      void qc.invalidateQueries({ queryKey: ["/api/chat/messages", user?.id] });
    }, 15000);
    pendingSend.current = { id, partnerId: partner.id, text, timeout }; setSending(true);
  };
  const unread = (id: string) => Math.max(chat.unreadCounts.get(id) || 0, conversations.data?.find(thread => thread.partnerId === id)?.unreadCount || 0);
  const unreadTotal = directory.reduce((sum, person) => sum + unread(person.id), 0);
  const error = (retry: () => unknown) => <div className="pulse-empty" role="alert">{c.loadFailed}<button className="pulse-btn ml-2" onClick={() => { retry(); }}>{t.common.refresh}</button></div>;
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="pulse-live z-[10021] w-[calc(100vw-24px)] max-w-[1240px] sm:max-w-[1240px] h-[calc(100dvh-32px)] max-h-[900px] p-0 gap-0 border-0 bg-[#eaf1f6]" data-testid="pulse-communication-center">
      <DialogTitle className="sr-only">{c.centerTitle}</DialogTitle><DialogDescription className="sr-only">{c.centerSubtitle}</DialogDescription>
      <div className="pulse-frame">
        <div className="pulse-top"><div className="pulse-brand">NEXUS <b>PULSE</b></div></div>
        <section className="pulse-content">
          <header className="pulse-heading"><div><h1>{c.centerTitle}</h1><p>{c.centerSubtitle}</p></div><button className="pulse-btn primary" onClick={onNewRequest}><Plus size={14}/>{c.newRequest}</button></header>
          <div className="center-tabs">
            <button className={mode === "tasks" ? "selected" : ""} aria-pressed={mode === "tasks"} onClick={() => setMode("tasks")}><MessageSquareText size={15}/>{c.myRequests}<span>{tasks.data?.length || 0}</span></button>
            <button className={mode === "direct" ? "selected" : ""} aria-pressed={mode === "direct"} onClick={() => setMode("direct")}><UserRound size={15}/>{c.directMessages}{unreadTotal > 0 && <span>{unreadTotal}</span>}</button>
            <div className="center-scope"><LockKeyhole size={12}/>{mode === "tasks" ? c.taskScope : c.privateScope}</div>
          </div>
          {mode === "tasks" ? <div className="center-grid">
            <aside className="center-list pulse-panel"><div className="center-list-head"><div className="center-search"><Search size={14}/><input aria-label={t.tasks.searchPlaceholder} placeholder={t.tasks.searchPlaceholder} value={search} onChange={event => setSearch(event.target.value)}/></div>
              <select className="pulse-select center-filter" aria-label={t.common.status} value={filter} onChange={event => setFilter(event.target.value)}><option value="all">{t.common.all}</option>
                {Object.entries(t.tasks.statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}<option value="waiting_agent">{t.backOffice.stateWaitingAgent}</option>
              </select></div>
              <div className="center-task-list">{tasks.isLoading ? <div className="pulse-empty">{t.common.loading}</div> : tasks.isError ? error(() => tasks.refetch()) : shown.map(row => <button key={row.id} className={`center-task-item ${task?.id === row.id ? "is-current" : ""}`} onClick={() => setTaskId(row.id)}>
                <div className="center-item-top"><span className={`status-dot ${stateKey(row) === "completed" ? "done" : stateKey(row) === "in_progress" ? "active" : ""}`}/><span className="status-name">{statusLabel(row)}</span><time className="center-time">{stamp(row.createdAt)}</time></div>
                <strong>{row.title}</strong><div className="center-handler"><Users size={12}/>{handler(row)}</div>
              </button>)}
                {!tasks.isLoading && !tasks.isError && !shown.length && <div className="pulse-empty">{c.noRequests}{(search || filter !== "all") && <button className="pulse-btn mt-2" onClick={() => { setSearch(""); setFilter("all"); }}>{c.clearFilters}</button>}</div>}
              </div>
            </aside>
            {task && !tasks.isError ? <section className="center-detail pulse-panel">
              <header className="center-detail-head"><div><div className="pulse-eyebrow">{requestTypeLabel({ id: task.requestRecipients?.typeId, name: task.requestRecipients?.typeName }, t)}</div><h2>{task.title}</h2>
                <div className="center-meta"><span className="status-pill">{statusLabel(task)}</span><span><Users size={13}/>{t.quickCreate.assignedTo}: {handler(task)}</span>{task.dueDate && <span><Clock3 size={13}/>{stamp(task.dueDate)}</span>}</div>
              </div></header>
              <div className="center-detail-scroll">
                <div className="center-section-title">{t.tasks.originalRequest}</div><div className="authored-request">{task.description || task.title}</div>
                <TaskAttachmentList attachments={task.attachments || []}/>
                <div className="center-section-title mt-4">{c.history}</div><div className="history-list">
                  <div className="history-event"><Clock3 size={14} className="history-icon"/><div><b>{c.created}</b><small>{stamp(task.createdAt)}</small></div></div>
                  {task.workStartedAt && <div className="history-event"><Clock3 size={14} className="history-icon"/><div><b>{t.tasks.inProgress}</b><small>{stamp(task.workStartedAt)}</small></div></div>}
                  {task.resolvedAt && <div className="history-event"><Clock3 size={14} className="history-icon"/><div><b>{t.tasks.completed}</b><small>{personName(people.data?.find(person => person.id === task.resolvedByUserId))} · {stamp(task.resolvedAt)}</small></div></div>}
                  {(comments.data || []).filter(comment => comment.kind === "state_change").map(comment => <div className="history-event" key={comment.id}><Clock3 size={14} className="history-icon"/><div><b>{comment.content}</b><small>{personName(people.data?.find(person => person.id === comment.userId))} · {stamp(comment.createdAt)}</small></div></div>)}
                </div>
                {task.resolution && <div className="authored-request mt-3">{task.resolution}</div>}
                <div className="center-discussion-title"><div><div className="center-section-title">{c.discussion}</div><span>{c.discussionHint}</span></div></div>
                <div className="task-comments">{comments.isLoading ? <span className="pulse-note">{t.common.loading}</span> : comments.isError ? error(() => comments.refetch()) : <>
                  {(comments.data || []).filter(comment => comment.kind !== "state_change").map(comment => <div key={comment.id} className={`comment-row ${comment.userId === user?.id ? "mine" : ""}`}><div className="comment-avatar"><UserRound size={12}/></div>
                    <div className="comment-bubble"><div><b>{personName(people.data?.find(person => person.id === comment.userId))}</b><time>{stamp(comment.createdAt)}</time></div><p>{comment.content}</p>
                      <TaskAttachmentList attachments={commentAttachments(comment)}/>
                    </div>
                  </div>)}
                  {!(comments.data || []).some(comment => comment.kind !== "state_change") && <div className="pulse-note">{c.noComments}</div>}
                </>}</div>
              </div>
              <form className="center-compose" onSubmit={event => { event.preventDefault(); sendTask(); }}><textarea aria-label={c.taskMessage} placeholder={c.taskMessage} maxLength={10000} rows={2} value={taskDrafts[task.id] || ""} onChange={event => setTaskDrafts(previous => ({ ...previous, [task.id]: event.target.value }))}/>
                <button className="pulse-btn primary" disabled={!taskDrafts[task.id]?.trim() || commentMutation.isPending || comments.isError || comments.isLoading}><Send size={14}/>{c.addComment}</button>
              </form>
            </section> : <div className="center-detail pulse-panel"><div className="pulse-empty">{c.noRequests}</div></div>}
          </div> : <div className="direct-grid">
            <aside className="direct-people pulse-panel"><div className="pulse-label p-3">{c.colleagues}</div><div className="center-search direct-search"><Search size={14}/><input aria-label={t.common.search} placeholder={t.common.search} value={colleagueSearch} onChange={event => setColleagueSearch(event.target.value)}/></div>
              {colleagues.isLoading || conversations.isLoading ? <div className="pulse-empty">{t.common.loading}</div> : colleagues.isError || conversations.isError ? error(() => { void colleagues.refetch(); void conversations.refetch(); }) : shownPeople.map(person => <button key={person.id} className={`person-row ${partner?.id === person.id ? "selected" : ""}`} onClick={() => setPartnerId(person.id)}>
                <span className="person-avatar">{personName(person).slice(0, 1)}</span><span className={`online-dot ${chat.onlineUsers.some(online => online.id === person.id) ? "" : "offline"}`}/><span className="person-info"><b>{personName(person)}</b><small>{conversations.data?.find(thread => thread.partnerId === person.id)?.lastMessage?.content || ""}</small></span>{unread(person.id) > 0 && <i className="person-unread">{unread(person.id)}</i>}
              </button>)}
              {!colleagues.isLoading && !conversations.isLoading && !shownPeople.length && <div className="pulse-empty">{t.common.noResults}</div>}
            </aside>
            {partner ? <section className="direct-detail pulse-panel"><header className="direct-head"><div className="person-avatar">{personName(partner).slice(0, 1)}</div><div><b>{personName(partner)}</b></div><span className="private-badge"><LockKeyhole size={12}/>{c.privateScope}</span></header>
              <div className="direct-thread"><div className="direct-system-note">{c.privateHint}</div>
                {messages.isLoading ? <span className="pulse-note">{t.common.loading}</span> : messages.isError ? error(() => messages.refetch()) : (messages.data || []).map(message => <div key={message.id} className={`direct-message ${message.senderId === user?.id ? "mine" : ""}`}><div>{message.content}</div><time>{stamp(message.createdAt)}</time></div>)}
                <div ref={messageEnd}/>
              </div>
              {!chat.isConnected && <div className="pulse-note px-3 pb-2" role="status">{c.offlineHint}</div>}
              <form className="center-compose" onSubmit={event => { event.preventDefault(); sendDirect(); }}><textarea aria-label={c.privateMessage} placeholder={c.privateMessage} maxLength={10000} rows={2} value={directDrafts[partner.id] || ""} onChange={event => setDirectDrafts(previous => ({ ...previous, [partner.id]: event.target.value }))}/>
                <button className="pulse-btn primary" disabled={!directDrafts[partner.id]?.trim() || sending || !chat.isConnected || messages.isError || messages.isLoading}><Send size={14}/>{c.send}</button>
              </form>
            </section> : <div className="pulse-panel pulse-empty">{t.common.noResults}</div>}
          </div>}
        </section>
      </div>
    </DialogContent>
  </Dialog>;
}
