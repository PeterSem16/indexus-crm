import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import type { Translations } from "@/i18n";
import {
  ClipboardList, Clock, AlertTriangle, CheckCircle2, Loader2, Check,
  ChevronRight, Zap, Building2, PhoneIncoming, Inbox, Wrench, HelpCircle,
  MessageSquare, CornerDownLeft, Activity, Send, Hand, User, Phone, Mail,
  MapPin, ExternalLink, Stethoscope,
  Trophy, PartyPopper, Sparkles, X, CalendarClock, Hourglass,
} from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { format, isToday, isTomorrow, isPast, formatDistanceToNow } from "date-fns";
import { enUS, sk, cs, hu, ro, it, de } from "date-fns/locale";
import { EntityDetailDrawer, type EntityRef } from "./entity-detail-drawer";
import { UserAvatar } from "./user-avatar";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";

const DF_LOCALES: Record<string, typeof enUS> = { en: enUS, sk, cs, hu, ro, it, de };
function dfLocale(locale: string) {
  return DF_LOCALES[locale] || enUS;
}

type BOState = "received" | "in_progress" | "waiting_agent" | "done";

type BOCustomerMini = {
  id: string;
  firstName: string | null;
  lastName: string | null;
} | null;

type BOCustomerFull = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  country: string | null;
  city: string | null;
} | null;

type BOTask = {
  task: {
    id: string;
    title: string;
    description: string | null;
    dueDate: string | null;
    priority: string;
    status: string;
    boState: BOState | null;
    assignedUserId: string;
    createdByUserId: string | null;
    customerId: string | null;
    country: string | null;
    relatedEntityType: string | null;
    relatedEntityId: string | null;
    tags: string[];
    createdAt: string;
  };
  confirmation: {
    id: string;
    confirmedAt: string;
    confirmedByUserId: string;
    note: string | null;
  } | null;
  customer?: BOCustomerMini;
};

export type ThreadComment = {
  id: string;
  userId: string;
  content: string;
  kind: "comment" | "question" | "answer" | "state_change";
  metadata: any;
  createdAt: string;
  userName: string | null;
  avatarUrl?: string | null;
};

export type ThreadData = {
  task: BOTask["task"];
  comments: ThreadComment[];
  confirmation: BOTask["confirmation"];
  creator: { id: string; fullName: string; avatarUrl?: string | null } | null;
  customer?: BOCustomerFull;
  reason?: string | null;
  clinic?: { id: string; name: string } | null;
  hospital?: { id: string; name: string } | null;
};

const PRIORITY_CONFIG: Record<string, { color: string; dot: string; border: string; tint: string }> = {
  urgent: { color: "text-rose-600 dark:text-rose-400", dot: "bg-rose-500", border: "border-l-rose-500", tint: "bg-rose-50/50 dark:bg-rose-950/20" },
  high: { color: "text-orange-500 dark:text-orange-400", dot: "bg-orange-500", border: "border-l-orange-500", tint: "bg-orange-50/40 dark:bg-orange-950/15" },
  medium: { color: "text-yellow-600 dark:text-yellow-400", dot: "bg-yellow-500", border: "border-l-yellow-500", tint: "" },
  low: { color: "text-muted-foreground", dot: "bg-muted-foreground", border: "border-l-slate-300 dark:border-l-slate-600", tint: "" },
};

const STATE_CONFIG: Record<BOState, {
  icon: typeof Inbox;
  headBg: string;
  headText: string;
  dot: string;
  cardRing: string;
  badge: string;
}> = {
  received: {
    icon: Inbox,
    headBg: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900",
    headText: "text-blue-700 dark:text-blue-300",
    dot: "bg-blue-500",
    cardRing: "hover:border-blue-300 dark:hover:border-blue-800",
    badge: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
  },
  in_progress: {
    icon: Wrench,
    headBg: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900",
    headText: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
    cardRing: "hover:border-amber-300 dark:hover:border-amber-800",
    badge: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
  },
  waiting_agent: {
    icon: HelpCircle,
    headBg: "bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-900",
    headText: "text-purple-700 dark:text-purple-300",
    dot: "bg-purple-500",
    cardRing: "hover:border-purple-300 dark:hover:border-purple-800",
    badge: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300",
  },
  done: {
    icon: CheckCircle2,
    headBg: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900",
    headText: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
    cardRing: "hover:border-emerald-300 dark:hover:border-emerald-800",
    badge: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
  },
};

const KIND_CONFIG: Record<ThreadComment["kind"], { icon: typeof MessageSquare; color: string; ring: string }> = {
  comment: { icon: MessageSquare, color: "text-muted-foreground", ring: "bg-muted-foreground/40" },
  question: { icon: HelpCircle, color: "text-purple-600 dark:text-purple-400", ring: "bg-purple-500" },
  answer: { icon: CornerDownLeft, color: "text-blue-600 dark:text-blue-400", ring: "bg-blue-500" },
  state_change: { icon: Activity, color: "text-emerald-600 dark:text-emerald-400", ring: "bg-emerald-500" },
};

const COLUMN_ORDER: BOState[] = ["received", "in_progress", "waiting_agent", "done"];

function priorityLabel(t: Translations, p: string): string {
  switch (p) {
    case "urgent": return t.backOffice.priorityUrgent;
    case "high": return t.backOffice.priorityHigh;
    case "low": return t.backOffice.priorityLow;
    default: return t.backOffice.priorityMedium;
  }
}

function stateLabel(t: Translations, s: BOState): string {
  switch (s) {
    case "received": return t.backOffice.stateReceived;
    case "in_progress": return t.backOffice.stateInProgress;
    case "waiting_agent": return t.backOffice.stateWaitingAgent;
    case "done": return t.backOffice.stateDone;
  }
}

function kindLabel(t: Translations, k: ThreadComment["kind"]): string {
  switch (k) {
    case "comment": return t.backOffice.kindComment;
    case "question": return t.backOffice.kindQuestion;
    case "answer": return t.backOffice.kindAnswer;
    case "state_change": return t.backOffice.kindStateChange;
  }
}

function customerName(c: { firstName: string | null; lastName: string | null } | null | undefined): string {
  if (!c) return "";
  return [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
}

function effectiveState(item: BOTask): BOState {
  if (item.task.status === "completed" || item.confirmation) return "done";
  const s = item.task.boState;
  if (s === "in_progress" || s === "waiting_agent" || s === "done") return s;
  return "received";
}

function getDueBadge(dueDate: string | null, isDone: boolean): { key: "overdue" | "today" | "tomorrow"; className: string } | null {
  if (isDone) return null;
  if (!dueDate) return null;
  const d = new Date(dueDate);
  if (isPast(d)) return { key: "overdue", className: "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400" };
  if (isToday(d)) return { key: "today", className: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" };
  if (isTomorrow(d)) return { key: "tomorrow", className: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" };
  return null;
}

function stateChangeContent(t: Translations, content: string): string {
  switch (content) {
    case "Úloha vybavená": return t.backOffice.eventTaskConfirmed;
    case "Prevzaté do vybavovania": return t.backOffice.eventTaskClaimed;
    default: return content;
  }
}

function KanbanCard({ item, onClick }: { item: BOTask; onClick: () => void }) {
  const { t } = useI18n();
  const { task } = item;
  const state = effectiveState(item);
  const pConfig = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const dueBadge = getDueBadge(task.dueDate, state === "done");
  const sConfig = STATE_CONFIG[state];
  const custName = customerName(item.customer);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-lg border border-l-4 ${pConfig.border} bg-card ${state === "done" ? "" : pConfig.tint} p-2.5 transition-colors shadow-sm hover-elevate ${sConfig.cardRing} ${state === "done" ? "opacity-60" : ""}`}
      data-testid={`bo-card-${task.id}`}
    >
      <div className="flex items-start gap-2">
        <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${pConfig.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <span className={`text-xs font-medium leading-snug ${state === "done" ? "line-through" : ""}`} data-testid={`text-bo-title-${task.id}`}>
              {task.title}
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
          </div>
          {custName && (
            <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground min-w-0" data-testid={`text-bo-customer-${task.id}`}>
              <User className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{custName}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {state === "waiting_agent" && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                <HelpCircle className="h-2.5 w-2.5" /> {t.backOffice.questionBadge}
              </span>
            )}
            {task.country && (
              <span className="text-[10px] text-muted-foreground font-medium">{task.country}</span>
            )}
            {dueBadge && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${dueBadge.className}`}>
                {dueBadge.key === "overdue" ? t.backOffice.dueOverdue : dueBadge.key === "today" ? t.backOffice.dueToday : t.backOffice.dueTomorrow}
              </span>
            )}
            {task.dueDate && state !== "done" && (
              <span className="text-[10px] text-muted-foreground">{format(new Date(task.dueDate), "d.M. HH:mm")}</span>
            )}
            {task.tags?.includes("status_list") && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">SL</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

export function Timeline({ thread }: { thread: ThreadData }) {
  const { t } = useI18n();
  const events: { id: string; ring: string; icon: typeof MessageSquare; color: string; label: string; who: string | null; avatarUrl?: string | null; at: string; content?: string }[] = [];

  events.push({
    id: "created",
    ring: "bg-blue-500",
    icon: Inbox,
    color: "text-blue-600 dark:text-blue-400",
    label: t.backOffice.taskReceivedEvent,
    who: thread.creator?.fullName ?? null,
    avatarUrl: thread.creator?.avatarUrl ?? null,
    at: thread.task.createdAt,
  });

  for (const c of thread.comments) {
    const cfg = KIND_CONFIG[c.kind] || KIND_CONFIG.comment;
    events.push({
      id: c.id,
      ring: cfg.ring,
      icon: cfg.icon,
      color: cfg.color,
      label: kindLabel(t, c.kind),
      who: c.userName,
      avatarUrl: c.avatarUrl ?? null,
      at: c.createdAt,
      content: c.kind === "state_change" ? stateChangeContent(t, c.content) : c.content,
    });
  }

  events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <div className="space-y-0">
      {events.map((e, idx) => {
        const Icon = e.icon;
        return (
          <div key={e.id} className="flex gap-2.5" data-testid={`timeline-event-${e.id}`}>
            <div className="flex flex-col items-center">
              <span className={`flex items-center justify-center w-5 h-5 rounded-full ${e.ring} text-white shrink-0`}>
                <Icon className="h-3 w-3" />
              </span>
              {idx < events.length - 1 && <span className="w-px flex-1 bg-border my-0.5" />}
            </div>
            <div className="pb-3 min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-xs font-medium ${e.color}`}>{e.label}</span>
                {e.who && (
                  <span className="flex items-center gap-1 min-w-0">
                    <UserAvatar name={e.who} avatarUrl={e.avatarUrl} className="h-4 w-4" testId={`avatar-timeline-${e.id}`} />
                    <span className="text-[10px] text-muted-foreground truncate">{e.who}</span>
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground ml-auto">{format(new Date(e.at), "d.M. HH:mm")}</span>
              </div>
              {e.content && <p className="text-xs mt-0.5 leading-relaxed whitespace-pre-wrap break-words">{e.content}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CustomerCard({ customer, onOpenEntity }: { customer: NonNullable<BOCustomerFull>; onOpenEntity: (e: EntityRef) => void }) {
  const { t } = useI18n();
  const name = customerName(customer);
  const phone = customer.phone || customer.mobile;
  const location = [customer.city, customer.country].filter(Boolean).join(", ");

  return (
    <div className="rounded-lg border bg-muted/20 p-3" data-testid="bo-customer-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">{t.backOffice.customerLabel}</div>
          <button
            type="button"
            onClick={() => onOpenEntity({ type: "customer", id: customer.id })}
            className="text-sm font-medium flex items-center gap-1.5 text-primary hover:underline text-left min-w-0 max-w-full"
            data-testid="link-bo-customer-name"
          >
            <User className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{name || "—"}</span>
          </button>
          <div className="mt-1.5 space-y-1 text-xs text-muted-foreground">
            {phone && (
              <a href={`tel:${phone}`} className="flex items-center gap-1.5 hover:text-foreground" data-testid="link-bo-customer-phone">
                <Phone className="h-3 w-3 shrink-0" /> <span className="truncate">{phone}</span>
              </a>
            )}
            {customer.email && (
              <a href={`mailto:${customer.email}`} className="flex items-center gap-1.5 hover:text-foreground" data-testid="link-bo-customer-email">
                <Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{customer.email}</span>
              </a>
            )}
            {location && (
              <div className="flex items-center gap-1.5" data-testid="text-bo-customer-location">
                <MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{location}</span>
              </div>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 shrink-0"
          onClick={() => onOpenEntity({ type: "customer", id: customer.id })}
          data-testid="btn-bo-open-contact"
        >
          <ExternalLink className="h-3.5 w-3.5" /> {t.backOffice.openContact}
        </Button>
      </div>
    </div>
  );
}

function BackOfficeTaskDetailContent({ taskId, open, onClose }: { taskId: string; open: boolean; onClose: () => void }) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [question, setQuestion] = useState("");
  const [confirmNote, setConfirmNote] = useState("");
  const [detailEntity, setDetailEntity] = useState<EntityRef | null>(null);
  const [recap, setRecap] = useState<{ createdAt: string; dueDate: string | null; completedAt: string } | null>(null);

  const threadKey = ["/api/back-office/tasks", taskId, "thread"];
  const { data: thread, isLoading } = useQuery<ThreadData>({
    queryKey: threadKey,
    queryFn: () => apiRequest("GET", `/api/back-office/tasks/${taskId}/thread`).then(r => r.json()),
    enabled: open && !!taskId,
    refetchInterval: open ? 10000 : false,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/back-office/tasks"] });
    queryClient.invalidateQueries({ queryKey: threadKey });
  };

  const claimMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/back-office/tasks/${taskId}/claim`).then(r => r.json()),
    onSuccess: () => { invalidate(); toast({ title: t.backOffice.toastClaimed }); },
    onError: () => toast({ title: t.backOffice.toastClaimError, variant: "destructive" }),
  });

  const noteMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/back-office/tasks/${taskId}/note`, { content: note }).then(r => r.json()),
    onSuccess: () => { setNote(""); invalidate(); toast({ title: t.backOffice.toastNoteAdded }); },
    onError: () => toast({ title: t.backOffice.toastNoteError, variant: "destructive" }),
  });

  const askMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/back-office/tasks/${taskId}/ask-agent`, { content: question }).then(r => r.json()),
    onSuccess: () => { setQuestion(""); invalidate(); toast({ title: t.backOffice.toastQuestionSent }); },
    onError: () => toast({ title: t.backOffice.toastQuestionError, variant: "destructive" }),
  });

  const confirmMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/back-office/tasks/${taskId}/confirm`, {
      note: confirmNote || null,
      statusListItemId: thread?.task.relatedEntityId || null,
    }).then(r => r.json()),
    onSuccess: (data: any) => {
      invalidate();
      toast({ title: t.backOffice.toastConfirmed });
      const tk = thread?.task;
      if (tk) {
        setRecap({
          createdAt: tk.createdAt,
          dueDate: tk.dueDate,
          completedAt: data?.confirmedAt || data?.confirmation?.confirmedAt || new Date().toISOString(),
        });
      } else {
        onClose();
      }
    },
    onError: () => toast({ title: t.backOffice.toastConfirmError, variant: "destructive" }),
  });

  const task = thread?.task;
  const state: BOState = task
    ? (task.status === "completed" || thread?.confirmation ? "done"
      : (task.boState === "in_progress" || task.boState === "waiting_agent" ? task.boState : "received"))
    : "received";
  const sConfig = STATE_CONFIG[state];
  const pConfig = task ? (PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium) : PRIORITY_CONFIG.medium;
  const StateIcon = sConfig.icon;

  return (
    <>
      {isLoading || !task ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> <span className="text-sm">{t.backOffice.loading}</span>
        </div>
      ) : (
        <>
          <div className={`pl-5 pr-12 py-4 border-b ${sConfig.headBg}`}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold leading-snug pr-6">{task.title}</h3>
              <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full font-semibold shrink-0 ${sConfig.badge}`}>
                <StateIcon className="h-3.5 w-3.5" /> {stateLabel(t, state)}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium bg-background/60 ${pConfig.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${pConfig.dot}`} /> {priorityLabel(t, task.priority)} {t.backOffice.prioritySuffix}
              </span>
              {task.country && (
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium bg-background/60 text-muted-foreground">
                  <Building2 className="h-3 w-3" /> {task.country}
                </span>
              )}
              {task.dueDate && (
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium bg-background/60 text-muted-foreground">
                  <Clock className="h-3 w-3" /> {format(new Date(task.dueDate), "d.M.yyyy HH:mm")}
                  {state !== "done" && isPast(new Date(task.dueDate)) && (
                    <span className="text-rose-500 font-semibold ml-1">({formatDistanceToNow(new Date(task.dueDate), { addSuffix: true, locale: dfLocale(locale) })})</span>
                  )}
                </span>
              )}
            </div>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-x-6 gap-y-6 items-start">
                <div className="space-y-5 lg:border-r lg:border-border lg:pr-6">
              {(thread?.customer || thread?.hospital || thread?.clinic) ? (
                <div className="space-y-2">
                  {thread?.customer && <CustomerCard customer={thread.customer} onOpenEntity={setDetailEntity} />}
                  {(thread?.hospital || thread?.clinic) && (
                    <div className="rounded-lg border bg-muted/20 p-3 space-y-1.5" data-testid="bo-entity-card">
                      {thread?.hospital && (
                        <div className="flex items-center gap-1.5 text-xs min-w-0" data-testid="text-bo-hospital">
                          <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="text-muted-foreground shrink-0">{t.backOffice.hospitalLabel}:</span>
                          <button
                            type="button"
                            onClick={() => setDetailEntity({ type: "hospital", id: thread.hospital!.id })}
                            className="font-medium text-primary hover:underline truncate text-left min-w-0"
                            data-testid="link-bo-hospital"
                          >
                            {thread.hospital.name}
                          </button>
                        </div>
                      )}
                      {thread?.clinic && (
                        <div className="flex items-center gap-1.5 text-xs min-w-0" data-testid="text-bo-clinic">
                          <Stethoscope className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="text-muted-foreground shrink-0">{t.backOffice.clinicLabel}:</span>
                          <button
                            type="button"
                            onClick={() => setDetailEntity({ type: "clinic", id: thread.clinic!.id })}
                            className="font-medium text-primary hover:underline truncate text-left min-w-0"
                            data-testid="link-bo-clinic"
                          >
                            {thread.clinic.name}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic" data-testid="text-bo-no-customer">{t.backOffice.noCustomer}</div>
              )}

              {task.description && (
                <div>
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{t.backOffice.descriptionLabel}</div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{task.description}</p>
                </div>
              )}

              {thread?.reason && (
                <div>
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{t.backOffice.reasonLabel}</div>
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"
                    data-testid="badge-bo-reason"
                  >
                    <Zap className="h-3 w-3" /> {thread.reason}
                  </span>
                </div>
              )}

              <div>
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">{t.backOffice.historyLabel}</div>
                {thread && <Timeline thread={thread} />}
              </div>
                </div>

                <div className="space-y-3">
              {state !== "done" && (
                <>
                  {state === "received" && (
                    <Button
                      className="w-full gap-2"
                      variant="outline"
                      onClick={() => claimMutation.mutate()}
                      disabled={claimMutation.isPending}
                      data-testid="btn-bo-claim"
                    >
                      {claimMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hand className="h-4 w-4" />}
                      {t.backOffice.claimButton}
                    </Button>
                  )}

                  <div className="rounded-lg border border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/20 p-3 space-y-2">
                    <div className="text-[11px] font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wide flex items-center gap-1.5">
                      <HelpCircle className="h-3.5 w-3.5" /> {t.backOffice.questionForAgent}
                    </div>
                    <p className="text-[10px] text-muted-foreground">{t.backOffice.questionHint}</p>
                    <Textarea
                      className="text-xs min-h-[56px] resize-none bg-background"
                      placeholder={t.backOffice.questionPlaceholder}
                      value={question}
                      onChange={e => setQuestion(e.target.value)}
                      data-testid="textarea-bo-question"
                    />
                    <Button
                      size="sm" className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white"
                      onClick={() => askMutation.mutate()}
                      disabled={askMutation.isPending || !question.trim()}
                      data-testid="btn-bo-ask-agent"
                    >
                      {askMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      {t.backOffice.sendQuestion}
                    </Button>
                  </div>

                  <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5" /> {t.backOffice.internalNote}
                    </div>
                    <Textarea
                      className="text-xs min-h-[56px] resize-none bg-background"
                      placeholder={t.backOffice.notePlaceholder}
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      data-testid="textarea-bo-note"
                    />
                    <Button
                      size="sm" variant="secondary" className="w-full gap-2"
                      onClick={() => noteMutation.mutate()}
                      disabled={noteMutation.isPending || !note.trim()}
                      data-testid="btn-bo-add-note"
                    >
                      {noteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
                      {t.backOffice.addNote}
                    </Button>
                  </div>

                  <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 space-y-2">
                    <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5" /> {t.backOffice.taskCompletion}
                    </div>
                    <Textarea
                      className="text-xs min-h-[56px] resize-none bg-background"
                      placeholder={t.backOffice.confirmNotePlaceholder}
                      value={confirmNote}
                      onChange={e => setConfirmNote(e.target.value)}
                      data-testid="textarea-bo-confirm-note"
                    />
                    <Button
                      className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => confirmMutation.mutate()}
                      disabled={confirmMutation.isPending}
                      data-testid="btn-bo-confirm-task"
                    >
                      {confirmMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      {t.backOffice.confirmButton}
                    </Button>
                  </div>
                </>
              )}

              {state === "done" && thread?.confirmation && (
                <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-3">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{t.backOffice.taskCompleted}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{format(new Date(thread.confirmation.confirmedAt), "d.M.yyyy HH:mm")}</span>
                  </div>
                  {thread.confirmation.note && <p className="text-xs text-muted-foreground mt-1.5">{thread.confirmation.note}</p>}
                </div>
              )}

              {state === "done" && !thread?.confirmation && (
                <div className="text-xs text-muted-foreground italic">{t.backOffice.taskCompleted}</div>
              )}
                </div>
              </div>
            </div>
          </ScrollArea>
        </>
      )}

      <EntityDetailDrawer entity={detailEntity} onClose={() => setDetailEntity(null)} />
      {recap && (
        <TaskCompletionRecap
          createdAt={recap.createdAt}
          dueDate={recap.dueDate}
          completedAt={recap.completedAt}
          t={t}
          onClose={() => { setRecap(null); onClose(); }}
        />
      )}
    </>
  );
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const parts: string[] = [];
  if (d > 0) { parts.push(`${d} d`); if (h > 0) parts.push(`${h} h`); }
  else if (h > 0) { parts.push(`${h} h`); if (m > 0) parts.push(`${m} min`); }
  else if (m > 0) { parts.push(`${m} min`); }
  else { parts.push(`${s} s`); }
  return parts.join(" ");
}

function TaskCompletionRecap({ createdAt, dueDate, completedAt, t, onClose }: {
  createdAt: string;
  dueDate: string | null;
  completedAt: string;
  t: Translations;
  onClose: () => void;
}) {
  const created = new Date(createdAt).getTime();
  const completed = new Date(completedAt).getTime();
  const durationMs = completed - created;
  const dueRaw = dueDate ? new Date(dueDate).getTime() : NaN;
  const due = Number.isFinite(dueRaw) ? dueRaw : null;
  const status: "onTime" | "overdue" | "none" = (due === null || !Number.isFinite(completed)) ? "none" : (completed <= due ? "onTime" : "overdue");
  const diffMs = due === null ? 0 : Math.abs(completed - due);

  const theme = status === "onTime"
    ? { grad: "from-emerald-500 to-green-600", Icon: Trophy, iconAnim: "animate-bounce", title: t.backOffice.recapOnTimeTitle, desc: t.backOffice.recapOnTimeDesc, badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800", badgeLabel: t.backOffice.recapAheadBy, BadgeIcon: PartyPopper }
    : status === "overdue"
    ? { grad: "from-amber-500 to-rose-600", Icon: AlertTriangle, iconAnim: "animate-pulse", title: t.backOffice.recapOverdueTitle, desc: t.backOffice.recapOverdueDesc, badge: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800", badgeLabel: t.backOffice.recapOverdueBy, BadgeIcon: AlertTriangle }
    : { grad: "from-sky-500 to-indigo-600", Icon: CheckCircle2, iconAnim: "", title: t.backOffice.recapNoDeadlineTitle, desc: t.backOffice.recapNoDeadlineDesc, badge: "", badgeLabel: "", BadgeIcon: CheckCircle2 };

  const { Icon, BadgeIcon } = theme;

  return (
    <DialogPrimitive.Root open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-[10030] bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          data-testid="overlay-bo-recap"
        />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-[10031] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border bg-background shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          data-testid="modal-bo-recap"
        >
          <div className={`relative overflow-hidden bg-gradient-to-br ${theme.grad} px-6 pt-8 pb-7 text-center text-white`}>
            {status === "onTime" && (
              <>
                <Sparkles className="absolute left-5 top-5 h-5 w-5 text-white/70 animate-pulse" />
                <Sparkles className="absolute right-8 top-10 h-4 w-4 text-white/60 animate-pulse [animation-delay:300ms]" />
                <Sparkles className="absolute left-10 bottom-4 h-3.5 w-3.5 text-white/50 animate-pulse [animation-delay:600ms]" />
              </>
            )}
            <DialogPrimitive.Close
              className="absolute right-3 top-3 rounded-full p-1.5 text-white/80 transition hover:bg-white/20 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              data-testid="btn-bo-recap-close-x"
              aria-label={t.backOffice.recapClose}
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
            <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-white/15 ring-8 ring-white/10">
              <Icon className={`h-10 w-10 ${theme.iconAnim}`} strokeWidth={2.2} />
            </div>
            <DialogPrimitive.Title className="text-xl font-bold tracking-tight" data-testid="text-bo-recap-title">{theme.title}</DialogPrimitive.Title>
            <p className="mx-auto mt-1 max-w-xs text-sm text-white/90">{theme.desc}</p>
          </div>

          <div className="space-y-3 px-6 py-5">
            <div className="flex items-center gap-3 rounded-xl border bg-muted/40 px-4 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Hourglass className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t.backOffice.recapDuration}</div>
                <div className="text-lg font-bold leading-tight" data-testid="text-bo-recap-duration">{formatDuration(durationMs)}</div>
              </div>
            </div>

            {status !== "none" && (
              <div className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold ${theme.badge}`} data-testid="badge-bo-recap-status">
                <BadgeIcon className="h-4 w-4" />
                <span>{theme.badgeLabel} {formatDuration(diffMs)}</span>
              </div>
            )}

            <div className="space-y-2 rounded-xl border px-4 py-3 text-sm">
              {dueDate && due !== null && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground"><CalendarClock className="h-4 w-4" /> {t.backOffice.recapDeadline}</span>
                  <span className="font-medium" data-testid="text-bo-recap-deadline">{format(new Date(dueDate), "d.M.yyyy HH:mm")}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground"><CheckCircle2 className="h-4 w-4" /> {t.backOffice.recapCompletedAt}</span>
                <span className="font-medium" data-testid="text-bo-recap-completed">{Number.isFinite(completed) ? format(new Date(completed), "d.M.yyyy HH:mm") : "—"}</span>
              </div>
            </div>

            <DialogPrimitive.Close asChild>
              <Button className="w-full gap-2" data-testid="btn-bo-recap-close">
                <Check className="h-4 w-4" /> {t.backOffice.recapClose}
              </Button>
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function BackOfficeTaskDrawer({ taskId, open, onClose, elevated = false }: { taskId: string | null; open: boolean; onClose: () => void; elevated?: boolean }) {
  const { t } = useI18n();
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        side="right"
        hideOverlay={elevated}
        onCloseAutoFocus={elevated ? (e) => e.preventDefault() : undefined}
        className={`w-full sm:max-w-xl lg:max-w-4xl xl:max-w-5xl p-0 gap-0 overflow-hidden flex flex-col ${elevated ? "z-[10020]" : ""}`}
        data-testid="drawer-bo-detail"
      >
        <SheetTitle className="sr-only">{t.backOffice.taskDetail}</SheetTitle>
        {open && taskId && <BackOfficeTaskDetailContent taskId={taskId} open={open} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

// ───────────────────── Agent SCORE / performance panel ─────────────────────
type ScoreRange = "week" | "month" | "3m" | "6m" | "year";

interface AgentScore {
  range: string;
  onTime: number;
  late: number;
  unknownCompleted: number;
  totalCompleted: number;
  openTotal: number;
  openOverdue: number;
  onTimeRate: number | null;
  trend: { label: string; onTime: number; late: number }[];
}

// Local i18n dict (same pattern as the status-list builder) to avoid touching the
// 25k-line translations.ts for a contained panel.
const SCORE_SL: Record<string, Record<string, string>> = {
  scoreTitle:     { sk: "Moje skóre", en: "My score", cs: "Moje skóre", hu: "Pontszámom", ro: "Scorul meu", it: "Il mio punteggio", de: "Meine Punktzahl" },
  rangeWeek:      { sk: "Týždeň", en: "Week", cs: "Týden", hu: "Hét", ro: "Săpt.", it: "Settim.", de: "Woche" },
  rangeMonth:     { sk: "Mesiac", en: "Month", cs: "Měsíc", hu: "Hónap", ro: "Lună", it: "Mese", de: "Monat" },
  range3m:        { sk: "3M", en: "3M", cs: "3M", hu: "3H", ro: "3L", it: "3M", de: "3M" },
  range6m:        { sk: "6M", en: "6M", cs: "6M", hu: "6H", ro: "6L", it: "6M", de: "6M" },
  rangeYear:      { sk: "Rok", en: "Year", cs: "Rok", hu: "Év", ro: "An", it: "Anno", de: "Jahr" },
  onTimeLbl:      { sk: "Načas", en: "On time", cs: "Včas", hu: "Időben", ro: "La timp", it: "In tempo", de: "Pünktlich" },
  lateLbl:        { sk: "Po termíne", en: "Late", cs: "Po termínu", hu: "Késve", ro: "Întârziat", it: "In ritardo", de: "Verspätet" },
  onTimeRateLbl:  { sk: "Úspešnosť načas", en: "On-time rate", cs: "Včasnost", hu: "Időben arány", ro: "Rată la timp", it: "Tasso puntualità", de: "Pünktlichkeit" },
  completedLbl:   { sk: "Dokončené", en: "Completed", cs: "Dokončené", hu: "Befejezve", ro: "Finalizate", it: "Completati", de: "Erledigt" },
  openOverdueLbl: { sk: "Otvorené po termíne", en: "Open overdue", cs: "Otevřené po termínu", hu: "Lejárt nyitott", ro: "Restante deschise", it: "Aperti scaduti", de: "Offen überfällig" },
  noData:         { sk: "Zatiaľ žiadne dáta", en: "No data yet", cs: "Zatím žádná data", hu: "Még nincs adat", ro: "Încă fără date", it: "Ancora nessun dato", de: "Noch keine Daten" },
  trendLbl:       { sk: "Vývoj", en: "Trend", cs: "Vývoj", hu: "Trend", ro: "Tendință", it: "Andamento", de: "Verlauf" },
  greatJob:       { sk: "Skvelá práca!", en: "Great job!", cs: "Skvělá práce!", hu: "Remek munka!", ro: "Excelent!", it: "Ottimo lavoro!", de: "Großartig!" },
  goodJob:        { sk: "Dobrá práca", en: "Good work", cs: "Dobrá práce", hu: "Jó munka", ro: "Bravo", it: "Buon lavoro", de: "Gute Arbeit" },
  keepGoing:      { sk: "Len tak ďalej", en: "Keep going", cs: "Jen tak dál", hu: "Így tovább", ro: "Continuă", it: "Continua così", de: "Weiter so" },
};
function scoreSl(key: string, locale: string): string {
  return SCORE_SL[key]?.[locale] ?? SCORE_SL[key]?.en ?? key;
}

function AgentScorePanel() {
  const { locale } = useI18n();
  const [range, setRange] = useState<ScoreRange>("week");

  const { data, isLoading } = useQuery<AgentScore>({
    queryKey: ["/api/back-office/agent-score", range],
    queryFn: () => apiRequest("GET", `/api/back-office/agent-score?range=${range}`).then(r => r.json()),
    refetchInterval: 30000,
  });

  const rate = data?.onTimeRate ?? null;
  const hasRated = ((data?.onTime ?? 0) + (data?.late ?? 0)) > 0;
  const tier: "great" | "good" | "keep" | null = rate == null ? null : rate >= 90 ? "great" : rate >= 70 ? "good" : "keep";
  const CelebIcon = tier === "great" ? PartyPopper : tier === "good" ? Trophy : Sparkles;
  const celebText = tier === "great" ? scoreSl("greatJob", locale) : tier === "good" ? scoreSl("goodJob", locale) : scoreSl("keepGoing", locale);

  const pieData = [
    { name: scoreSl("onTimeLbl", locale), value: data?.onTime ?? 0, color: "#10b981" },
    { name: scoreSl("lateLbl", locale), value: data?.late ?? 0, color: "#ef4444" },
  ];

  const RANGES: { key: ScoreRange; lblKey: string }[] = [
    { key: "week", lblKey: "rangeWeek" },
    { key: "month", lblKey: "rangeMonth" },
    { key: "3m", lblKey: "range3m" },
    { key: "6m", lblKey: "range6m" },
    { key: "year", lblKey: "rangeYear" },
  ];

  const hasTrend = !!data && data.trend.some(b => b.onTime + b.late > 0);

  return (
    <div className="hidden lg:flex w-72 xl:w-80 shrink-0 border-l bg-muted/10 flex-col h-full overflow-hidden" data-testid="agent-score-panel">
      <div className="px-3 py-2.5 border-b flex items-center gap-2 shrink-0">
        <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-sm font-semibold">{scoreSl("scoreTitle", locale)}</span>
        {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-auto" />}
      </div>

      <div className="flex flex-wrap gap-1 p-2 border-b shrink-0">
        {RANGES.map(r => (
          <button
            key={r.key}
            type="button"
            onClick={() => setRange(r.key)}
            data-testid={`btn-score-range-${r.key}`}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${range === r.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
          >
            {scoreSl(r.lblKey, locale)}
          </button>
        ))}
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-3">
          <div className="rounded-lg border bg-card p-3 text-center">
            {hasRated && tier ? (
              <>
                <CelebIcon className={`h-8 w-8 mx-auto mb-1 ${tier === "great" ? "text-amber-500" : tier === "good" ? "text-emerald-500" : "text-sky-500"}`} />
                <div className="text-3xl font-bold leading-none" data-testid="text-ontime-rate">{rate}%</div>
                <div className="text-[11px] text-muted-foreground mt-1">{scoreSl("onTimeRateLbl", locale)}</div>
                <div className="text-xs font-medium mt-1">{celebText}</div>
              </>
            ) : (
              <div className="py-4 text-xs text-muted-foreground">{scoreSl("noData", locale)}</div>
            )}
          </div>

          {hasRated && (
            <div className="rounded-lg border bg-card p-2">
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={36} outerRadius={52} paddingAngle={2}>
                      {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-3 text-[11px]">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />{scoreSl("onTimeLbl", locale)} {data?.onTime ?? 0}</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" />{scoreSl("lateLbl", locale)} {data?.late ?? 0}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border bg-card p-2 flex flex-col items-center" data-testid="stat-completed">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 mb-0.5" />
              <div className="text-lg font-bold leading-none">{data?.totalCompleted ?? 0}</div>
              <div className="text-[10px] text-muted-foreground text-center mt-0.5">{scoreSl("completedLbl", locale)}</div>
            </div>
            <div className="rounded-lg border bg-card p-2 flex flex-col items-center" data-testid="stat-open-overdue">
              <Hourglass className="h-4 w-4 text-rose-500 mb-0.5" />
              <div className="text-lg font-bold leading-none">{data?.openOverdue ?? 0}</div>
              <div className="text-[10px] text-muted-foreground text-center mt-0.5">{scoreSl("openOverdueLbl", locale)}</div>
            </div>
          </div>

          {hasTrend && (
            <div className="rounded-lg border bg-card p-2">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                <CalendarClock className="h-3 w-3" />{scoreSl("trendLbl", locale)}
              </div>
              <div className="h-28">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data!.trend} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                    <Tooltip />
                    <Bar dataKey="onTime" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="late" stackId="a" fill="#ef4444" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export function BackOfficePanel({ country, fullScreen, hasInboundQueues, allowInbound, onToggleAllowInbound }: { country?: string; fullScreen?: boolean; hasInboundQueues?: boolean; allowInbound?: boolean; onToggleAllowInbound?: () => void }) {
  const { t } = useI18n();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const { data: rawTasks = [], isLoading } = useQuery<BOTask[]>({
    queryKey: ["/api/back-office/tasks", country],
    queryFn: () => apiRequest("GET", `/api/back-office/tasks${country ? `?country=${country}` : ""}`).then(r => r.json()),
    refetchInterval: 15000,
  });

  const grouped: Record<BOState, BOTask[]> = { received: [], in_progress: [], waiting_agent: [], done: [] };
  for (const item of rawTasks) grouped[effectiveState(item)].push(item);

  const urgentCount = rawTasks.filter(i => i.task.priority === "urgent" && effectiveState(i) !== "done").length;
  const waitingCount = grouped.waiting_agent.length;

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <div className="px-4 py-2.5 border-b flex items-center gap-3 shrink-0">
        <ClipboardList className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-semibold">{t.backOffice.title}</span>
        {urgentCount > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white">
            <AlertTriangle className="h-3 w-3" /> {urgentCount} {t.backOffice.urgentLabel}
          </span>
        )}
        {waitingCount > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500 text-white">
            <HelpCircle className="h-3 w-3" /> {waitingCount} {t.backOffice.waitingLabel}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          {hasInboundQueues && onToggleAllowInbound && (
            <button
              type="button"
              onClick={onToggleAllowInbound}
              data-testid="toggle-allow-inbound-in-bo"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] font-medium transition-colors border ${allowInbound ? "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400" : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"}`}
            >
              <span className={`inline-flex items-center justify-center h-3.5 w-3.5 rounded border shrink-0 transition-colors ${allowInbound ? "bg-green-500 border-green-500" : "border-muted-foreground/40 bg-transparent"}`}>
                {allowInbound && (
                  <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5 text-white">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <PhoneIncoming className="h-3 w-3 shrink-0" />
              {t.backOffice.acceptInbound}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className="flex-1 min-h-0 overflow-x-auto">
        <div className="flex gap-3 p-3 h-full min-w-max">
          {COLUMN_ORDER.map(stateKey => {
            const cfg = STATE_CONFIG[stateKey];
            const Icon = cfg.icon;
            const items = grouped[stateKey];
            return (
              <div key={stateKey} className="flex flex-col w-72 shrink-0 h-full" data-testid={`bo-column-${stateKey}`}>
                <div className={`flex items-center gap-2 px-3 py-2 rounded-t-lg border ${cfg.headBg}`}>
                  <Icon className={`h-4 w-4 ${cfg.headText}`} />
                  <span className={`text-xs font-semibold ${cfg.headText}`}>{stateLabel(t, stateKey)}</span>
                  <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cfg.badge}`} data-testid={`count-${stateKey}`}>
                    {items.length}
                  </span>
                </div>
                <div className="flex-1 min-h-0 border border-t-0 rounded-b-lg bg-muted/20">
                  <ScrollArea className="h-full">
                    <div className="p-2 space-y-2">
                      {isLoading ? (
                        <div className="flex items-center justify-center py-6 text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : items.length === 0 ? (
                        <div className="text-center py-8 px-2">
                          <Icon className="h-6 w-6 mx-auto text-muted-foreground/25 mb-1.5" />
                          <p className="text-[11px] text-muted-foreground/70">{t.backOffice.noTasks}</p>
                        </div>
                      ) : (
                        items.map(item => (
                          <KanbanCard key={item.task.id} item={item} onClick={() => setSelectedTaskId(item.task.id)} />
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            );
          })}
        </div>
        </div>
        <AgentScorePanel />
      </div>

      <BackOfficeTaskDrawer
        taskId={selectedTaskId}
        open={!!selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
      />
    </div>
  );
}
