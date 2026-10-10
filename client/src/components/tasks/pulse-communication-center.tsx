import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, MessageSquareText, Send, Clock3, Users, UserRound, LockKeyhole } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useI18n } from "@/i18n";
import { useAuth } from "@/contexts/auth-context";
import { useChatContext } from "@/contexts/chat-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Task, TaskComment } from "@shared/schema";
import { requestTypeLabel } from "./request-routing-model";
import "./task-communications.css";
import { TaskAttachmentList } from "./task-attachments";
import type { TaskAttachment } from "@shared/task-attachments";
import { InternalChatPanel, type InternalChatDraftSnapshot } from "@/components/chat/InternalChatPanel";
import { BackOfficeQuestionsInbox } from "@/components/back-office-questions-inbox";
import { isCompletionEvent, taskHistoryComments, taskResolverId } from "./task-history-model";

type Person = { id: string; fullName: string | null; username: string; avatarUrl?: string | null };
type Conversation = { partnerId: string; unreadCount: number };
const personName = (person?: Person | null) => person?.fullName?.trim() || person?.username || "";
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
  const [mode, setMode] = useState<"tasks" | "backOffice" | "direct">("tasks");
  const [boEntityOpen, setBoEntityOpen] = useState(false);
  const [taskId, setTaskId] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [taskDrafts, setTaskDrafts] = useState<Record<string, string>>({});
  const [directDrafts, setDirectDrafts] = useState<Record<string, InternalChatDraftSnapshot>>({});
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
  const questions = useQuery<{ task: Task }[]>({
    queryKey: ["/api/agent/bo-questions", user?.id],
    queryFn: async () => (await apiRequest("GET", "/api/agent/bo-questions")).json(),
    enabled: open && !!user?.id, staleTime: 0, refetchInterval: open ? 10000 : false,
  });
  const allTasks = Array.from(new Map([...(tasks.data || []), ...(questions.data || []).map(item => item.task)]
    .map(task => [task.id, task])).values());
  const ordinaryTasks = allTasks.filter(task => !task.tags?.includes("back_office"));
  const backOfficeTasks = allTasks.filter(task => task.tags?.includes("back_office"));
  const people = useQuery<Person[]>({
    queryKey: ["/api/tasks/people", user?.id], queryFn: async () => (await apiRequest("GET", "/api/tasks/people")).json(), enabled: open,
  });
  const conversations = useQuery<Conversation[]>({
    queryKey: ["/api/chat/conversations", user?.id],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/chat/conversations");
      if (!response.ok) throw new Error(`Conversation request failed (${response.status})`);
      return response.json();
    },
    enabled: open && !!user?.id, staleTime: 0, refetchInterval: open ? 15000 : false,
  });
  const statusLabel = (task: Task) => stateKey(task) === "waiting_agent" ? t.backOffice.stateWaitingAgent : t.tasks.statuses[stateKey(task) as keyof typeof t.tasks.statuses];
  const handler = (task: Task) => {
    const groups = task.tags.filter(tag => tag.startsWith("group:")).map(tag => tag.slice(6));
    const ids = task.requestRecipients?.userIds || (groups.length ? [] : [task.assignedUserId]);
    return [...groups, ...ids.map(id => personName(people.data?.find(person => person.id === id))).filter(Boolean)].join(" · ");
  };
  const shown = (mode === "backOffice" ? backOfficeTasks : ordinaryTasks).filter(task => (filter === "all" || stateKey(task) === filter)
    && `${task.title} ${handler(task)} ${task.requestRecipients?.typeName || ""}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const task = shown.find(row => row.id === taskId) || shown[0];
  const comments = useQuery<TaskComment[]>({
    queryKey: ["/api/tasks", user?.id, task?.id, "comments"], queryFn: async () => (await apiRequest("GET", `/api/tasks/${encodeURIComponent(task!.id)}/comments`)).json(),
    enabled: open && mode !== "direct" && !!task?.id, staleTime: 0, refetchInterval: open && mode !== "direct" ? 10000 : false,
  });
  useEffect(() => {
    if (open && mode !== "direct" && task && comments.isSuccess) onTaskViewed?.(task);
  }, [open, mode, task, comments.isSuccess, onTaskViewed]);
  useEffect(() => {
    if (open) { setSearch(""); setFilter("all"); }
  }, [open]);
  useEffect(() => {
    const openBackOffice = () => {
      setMode("backOffice");
      setTaskId("");
    };
    window.addEventListener("pulse_inbox_back_office", openBackOffice);
    return () => window.removeEventListener("pulse_inbox_back_office", openBackOffice);
  }, []);
  useEffect(() => {
    setTaskDrafts({}); setDirectDrafts({}); setTaskId(""); setPartnerId("");
  }, [user?.id]);
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
  const unreadTotal = (conversations.data || []).reduce((sum, thread) =>
    sum + Math.max(chat.unreadCounts.get(thread.partnerId) || 0, thread.unreadCount || 0), 0);
  const error = (retry: () => unknown) => <div className="pulse-empty" role="alert">{c.loadFailed}<button className="pulse-btn ml-2" onClick={() => { retry(); }}>{t.common.refresh}</button></div>;
  const resolverId = task ? taskResolverId(task, comments.data || []) : null;
  const resolverName = personName(people.data?.find(person => person.id === resolverId)) || t.common.unknown;
  return <Dialog modal={mode !== "backOffice"} open={open} onOpenChange={onOpenChange}>
    <DialogContent onInteractOutside={event => { if (mode === "backOffice") event.preventDefault(); }} className={`${boEntityOpen ? "invisible" : ""} pulse-live pulse-center-dialog z-[10021] w-[calc(100vw-24px)] max-w-[1240px] sm:max-w-[1240px] h-[calc(100dvh-32px)] max-h-[900px] p-0 gap-0 border-0 bg-[#eaf1f6]`} data-testid="pulse-communication-center">
      <DialogTitle className="sr-only">{c.centerTitle}</DialogTitle><DialogDescription className="sr-only">{c.centerSubtitle}</DialogDescription>
      <div className="pulse-frame">
        <div className="pulse-top"><div className="pulse-brand">NEXUS <b>PULSE</b></div></div>
        <section className="pulse-content">
          <header className="pulse-heading"><div><h1>{c.centerTitle}</h1><p>{c.centerSubtitle}</p></div><button className="pulse-btn primary" onClick={onNewRequest}><Plus size={14}/>{c.newRequest}</button></header>
          <div className="center-tabs">
            <button className={mode === "tasks" ? "selected" : ""} aria-pressed={mode === "tasks"} onClick={() => setMode("tasks")}><MessageSquareText size={15}/>{c.myRequests}<span>{ordinaryTasks.length}</span></button>
            <button className={mode === "backOffice" ? "selected" : ""} aria-pressed={mode === "backOffice"} onClick={() => setMode("backOffice")} data-testid="inbox-tab-back-office"><Users size={15}/>{t.backOffice.title}<span>{backOfficeTasks.length}</span></button>
            <button className={mode === "direct" ? "selected" : ""} aria-pressed={mode === "direct"} onClick={() => setMode("direct")}><UserRound size={15}/>{c.directMessages}{unreadTotal > 0 && <span>{unreadTotal}</span>}</button>
            <div className="center-scope"><LockKeyhole size={12}/>{mode !== "direct" ? c.taskScope : c.privateScope}</div>
          </div>
          {mode !== "direct" && <div className="center-grid">
            <aside className="center-list pulse-panel"><div className="center-list-head"><div className="center-search"><Search size={14}/><input aria-label={t.tasks.searchPlaceholder} placeholder={t.tasks.searchPlaceholder} value={search} onChange={event => setSearch(event.target.value)}/></div>
              <select className="pulse-select center-filter" aria-label={t.common.status} value={filter} onChange={event => setFilter(event.target.value)}><option value="all">{t.common.all}</option>
                {Object.entries(t.tasks.statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}<option value="waiting_agent">{t.backOffice.stateWaitingAgent}</option>
              </select></div>
              {mode === "backOffice" && <BackOfficeQuestionsInbox onEntityOpenChange={setBoEntityOpen} />}
              <div className="center-task-list">{tasks.isLoading || questions.isLoading ? <div className="pulse-empty">{t.common.loading}</div> : tasks.isError || questions.isError ? error(() => { void tasks.refetch(); void questions.refetch(); }) : shown.map(row => <button key={row.id} className={`center-task-item ${task?.id === row.id ? "is-current" : ""}`} onClick={() => setTaskId(row.id)}>
                <div className="center-item-top"><span className={`status-dot status-${stateKey(row)}`}/><span className={`status-name status-${stateKey(row)}`}>{statusLabel(row)}</span><time className="center-time">{stamp(row.createdAt)}</time></div>
                <strong>{row.title}</strong><div className="center-handler"><Users size={12}/>{handler(row)}</div>
              </button>)}
                {!tasks.isLoading && !tasks.isError && !shown.length && <div className="pulse-empty">{c.noRequests}{(search || filter !== "all") && <button className="pulse-btn mt-2" onClick={() => { setSearch(""); setFilter("all"); }}>{c.clearFilters}</button>}</div>}
              </div>
            </aside>
            {task && !tasks.isError ? <section className="center-detail pulse-panel">
              <header className="center-detail-head"><div><div className="pulse-eyebrow">{requestTypeLabel({ id: task.requestRecipients?.typeId, name: task.requestRecipients?.typeName }, t)}</div><h2>{task.title}</h2>
                 <div className="center-meta"><span className="status-pill" data-status={stateKey(task)}>{statusLabel(task)}</span><span><Users size={13}/>{t.quickCreate.assignedTo}: {handler(task)}</span>{task.dueDate && <span><Clock3 size={13}/>{stamp(task.dueDate)}</span>}</div>
              </div></header>
              <div className="center-detail-scroll">
                <div className="center-section-title">{t.tasks.originalRequest}</div><div className="authored-request">{task.description || task.title}</div>
                <TaskAttachmentList attachments={task.attachments || []}/>
                <div className="center-section-title mt-4">{c.history}</div><div className="history-list">
                   <div className="history-event history-created"><Clock3 size={14} className="history-icon"/><div><b>{c.created}</b><small>{stamp(task.createdAt)}</small></div></div>
                   {task.workStartedAt && <div className="history-event history-in-progress"><Clock3 size={14} className="history-icon"/><div><b>{t.tasks.inProgress}</b><small>{stamp(task.workStartedAt)}</small></div></div>}
                    {task.resolvedAt && <div className="history-event history-completed"><Clock3 size={14} className="history-icon"/><div><b>{t.tasks.completed}</b><small>{resolverName} · {stamp(task.resolvedAt)}</small></div></div>}
                    {taskHistoryComments(task, comments.data || []).map(comment => {
                      const completion = isCompletionEvent(task, comment);
                     const label = comment.content.toLocaleLowerCase();
                      const tone = completion ? "history-completed" : label.includes(t.tasks.inProgress.toLocaleLowerCase()) ? "history-in-progress"
                       : label.includes(t.tasks.completed.toLocaleLowerCase()) ? "history-completed"
                         : label.includes(t.backOffice.stateWaitingAgent.toLocaleLowerCase()) ? "history-waiting-agent"
                           : label.includes(t.tasks.statuses.cancelled.toLocaleLowerCase()) ? "history-cancelled"
                             : label.includes(t.tasks.statuses.pending.toLocaleLowerCase()) ? "history-created" : "";
                      return <div className={`history-event ${tone}`} key={comment.id}><Clock3 size={14} className="history-icon"/><div><b>{completion ? t.tasks.completed : comment.content}</b><small>{personName(people.data?.find(person => person.id === comment.userId))} · {stamp(comment.createdAt)}</small></div></div>;
                   })}
                </div>
                 {task.resolution && <div className="authored-request mt-3" data-testid="task-resolution"><div className="font-semibold mb-1">{t.tasks.resolvedBy}: {resolverName}</div><div>{task.resolution}</div></div>}
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
          </div>}
          <div className={`pulse-direct-host flex-1 min-h-0 ${mode === "direct" ? "flex" : "hidden"}`}>
            <InternalChatPanel
              theme="pulse"
              active={open && mode === "direct"}
              initialPartnerId={partnerId || null}
              onPartnerChange={id => setPartnerId(id || "")}
              persistedDrafts={directDrafts}
              onPersistedDraftsChange={setDirectDrafts}
            />
          </div>
        </section>
      </div>
    </DialogContent>
  </Dialog>;
}
