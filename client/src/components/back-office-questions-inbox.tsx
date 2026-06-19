import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import { HelpCircle, Loader2, CornerDownLeft, ChevronDown, ChevronUp, ChevronRight, Send, User, ExternalLink, Phone, Mail, MapPin, Building2, Clock, MessageSquare, Zap, Stethoscope, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { format } from "date-fns";
import { Timeline, BoAttachmentComposer, type ThreadData, type ThreadComment, type BoAttachment } from "./back-office-panel";
import { SendProcessingOverlay } from "./send-processing-animation";
import { EntityDetailDrawer, type EntityRef } from "./entity-detail-drawer";
import { UserAvatar } from "./user-avatar";

type ResolvedItem = {
  id: string;
  taskTitle: string;
  resolution: string | null;
  customerName: string | null;
  at: number;
};

function ResolvedCard({ item, onDismiss }: { item: ResolvedItem; onDismiss: () => void }) {
  return (
    <div
      className="relative rounded-lg border-2 border-emerald-400 dark:border-emerald-600 bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100 dark:from-emerald-950/50 dark:via-teal-950/30 dark:to-emerald-950/40 p-3 overflow-hidden animate-bo-resolved-in animate-bo-resolved-shimmer"
      data-testid={`bo-resolved-card-${item.id}`}
    >
      <div className="absolute -top-3 -right-3 w-16 h-16 rounded-full bg-emerald-300/30 dark:bg-emerald-600/20 blur-xl pointer-events-none" />
      <div className="absolute -bottom-2 -left-2 w-12 h-12 rounded-full bg-teal-300/30 dark:bg-teal-600/20 blur-lg pointer-events-none" />
      <div className="relative flex items-start gap-2.5">
        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/70 border-2 border-emerald-400 dark:border-emerald-600 shrink-0">
          <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" style={{ width: 18, height: 18 }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[9px] font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-widest mb-0.5">
            ✅ Back Office vyriešil
          </div>
          {item.customerName && (
            <div className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-200 mb-0.5 flex items-center gap-1">
              <User className="shrink-0" style={{ width: 10, height: 10 }} />
              {item.customerName}
            </div>
          )}
          <div className="text-xs font-semibold text-foreground leading-snug">{item.taskTitle}</div>
          {item.resolution && (
            <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-1 leading-relaxed line-clamp-2 italic">
              „{item.resolution}"
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5"
          data-testid={`btn-dismiss-bo-resolved-${item.id}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

type BOQuestion = {
  task: ThreadData["task"];
  question: {
    id: string;
    content: string;
    createdAt: string;
    userId: string;
    userName: string | null;
    avatarUrl?: string | null;
    highPriority?: boolean;
  } | null;
  customer?: ThreadData["customer"];
  comments?: ThreadComment[];
  creator?: ThreadData["creator"];
  reason?: string | null;
  clinic?: { id: string; name: string } | null;
  hospital?: { id: string; name: string } | null;
};

function customerName(c: { firstName: string | null; lastName: string | null } | null | undefined): string {
  if (!c) return "";
  return [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
}

function QuestionTile({ item, onClick }: { item: BOQuestion; onClick: () => void }) {
  const { t } = useI18n();
  const custName = customerName(item.customer);
  const urgent = !!item.question?.highPriority;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-lg border p-2.5 transition-all hover:shadow-sm active:scale-[0.99] ${urgent ? "border-2 border-rose-400 dark:border-rose-600 bg-rose-50/60 dark:bg-rose-950/20 animate-bo-urgent" : "border-purple-200 dark:border-purple-900 bg-card hover:border-purple-400 dark:hover:border-purple-700"}`}
      data-testid={`bo-question-${item.task.id}`}
    >
      <div className="flex items-start gap-2">
        <span className={`flex items-center justify-center w-6 h-6 rounded-full shrink-0 mt-0.5 ${urgent ? "bg-rose-100 dark:bg-rose-900/40" : "bg-purple-100 dark:bg-purple-900/40"}`}>
          {urgent
            ? <AlertTriangle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
            : <HelpCircle className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />}
        </span>
        <div className="flex-1 min-w-0">
          {urgent && (
            <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-600 text-white animate-bo-blink mb-1" data-testid={`badge-bo-urgent-${item.task.id}`}>
              <AlertTriangle className="h-2.5 w-2.5" /> {t.backOffice.urgentBadge}
            </span>
          )}
          {(custName || item.hospital?.name || item.clinic?.name) && (
            <div className="mb-1" data-testid={`text-bo-question-customer-name-${item.task.id}`}>
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 border border-purple-200 dark:border-purple-800 max-w-full">
                <User className="h-3 w-3 shrink-0 text-purple-600 dark:text-purple-400" />
                <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 truncate">
                  {custName || item.hospital?.name || item.clinic?.name}
                </span>
              </div>
            </div>
          )}
          <div className="text-xs font-medium leading-snug truncate" data-testid={`text-bo-question-title-${item.task.id}`}>{item.task.title}</div>
          {item.question && (
            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-snug">{item.question.content}</p>
          )}
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {item.question?.userName && (
              <span className="flex items-center gap-1 min-w-0">
                <UserAvatar name={item.question.userName} avatarUrl={item.question.avatarUrl} className="h-4 w-4" testId={`avatar-question-author-${item.task.id}`} />
                <span className="text-[10px] text-muted-foreground truncate">{item.question.userName}</span>
              </span>
            )}
            {item.question && <span className="text-[10px] text-muted-foreground">· {format(new Date(item.question.createdAt), "d.M. HH:mm")}</span>}
            {item.task.country && <span className="text-[10px] text-muted-foreground">· {item.task.country}</span>}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 self-center" />
      </div>
    </button>
  );
}

function QuestionDrawerContent({ item, onClose }: { item: BOQuestion; onClose: () => void }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [answer, setAnswer] = useState("");
  const [answerAttachments, setAnswerAttachments] = useState<BoAttachment[]>([]);
  const [sendFx, setSendFx] = useState<null | "sending" | "done">(null);
  const fxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (fxTimer.current) clearTimeout(fxTimer.current); }, []);
  const [detailEntity, setDetailEntity] = useState<EntityRef | null>(null);

  const answerMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/agent/bo-questions/${item.task.id}/answer`, { content: answer, attachments: answerAttachments }).then(r => r.json()),
    onMutate: () => setSendFx("sending"),
    onSuccess: () => {
      setAnswer("");
      setAnswerAttachments([]);
      queryClient.invalidateQueries({ queryKey: ["/api/agent/bo-questions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/back-office/tasks"] });
      toast({ title: t.backOffice.toastAnswerSent });
      setSendFx("done");
      fxTimer.current = setTimeout(() => { setSendFx(null); onClose(); }, 1400);
    },
    onError: () => { setSendFx(null); toast({ title: t.backOffice.toastAnswerError, variant: "destructive" }); },
  });

  const custName = customerName(item.customer);
  const phone = item.customer?.phone || item.customer?.mobile;
  const location = [item.customer?.city, item.customer?.country].filter(Boolean).join(", ");
  const thread: ThreadData = {
    task: item.task,
    comments: item.comments ?? [],
    confirmation: null,
    creator: item.creator ?? null,
    customer: item.customer ?? undefined,
    reason: item.reason ?? null,
    clinic: item.clinic ?? null,
    hospital: item.hospital ?? null,
  };

  return (
    <>
      <div className="pl-5 pr-12 py-4 border-b bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-900">
        <h3 className="text-sm font-semibold leading-snug text-purple-900 dark:text-purple-100 break-words" data-testid="text-bo-question-detail-title">{item.task.title}</h3>
        <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
            <HelpCircle className="h-3 w-3" /> {t.backOffice.kindQuestion}
          </span>
          {item.task.country && (
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium bg-background/60 text-muted-foreground">
              <Building2 className="h-3 w-3" /> {item.task.country}
            </span>
          )}
          {item.question && (
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium bg-background/60 text-muted-foreground">
              <Clock className="h-3 w-3" /> {format(new Date(item.question.createdAt), "d.M.yyyy HH:mm")}
            </span>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-x-6 gap-y-6 items-start">
            <div className="space-y-5 lg:border-r lg:border-border lg:pr-6 min-w-0">
              {(item.customer || item.hospital || item.clinic) ? (
                <div className="space-y-2">
                  {item.customer && (
                    <div className="rounded-lg border bg-muted/20 p-3" data-testid="bo-question-customer-card">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">{t.backOffice.customerLabel}</div>
                          <button
                            type="button"
                            onClick={() => setDetailEntity({ type: "customer", id: item.customer!.id })}
                            className="text-sm font-medium flex items-center gap-1.5 text-primary hover:underline text-left min-w-0 max-w-full"
                            data-testid="link-bo-question-detail-customer-name"
                          >
                            <User className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{custName || "—"}</span>
                          </button>
                          <div className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                            {phone && (
                              <a href={`tel:${phone}`} className="flex items-center gap-1.5 hover:text-foreground" data-testid="link-bo-question-customer-phone">
                                <Phone className="h-3 w-3 shrink-0" /> <span className="truncate">{phone}</span>
                              </a>
                            )}
                            {item.customer.email && (
                              <a href={`mailto:${item.customer.email}`} className="flex items-center gap-1.5 hover:text-foreground" data-testid="link-bo-question-customer-email">
                                <Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{item.customer.email}</span>
                              </a>
                            )}
                            {location && (
                              <div className="flex items-center gap-1.5" data-testid="text-bo-question-customer-location">
                                <MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{location}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 shrink-0"
                          onClick={() => setDetailEntity({ type: "customer", id: item.customer!.id })}
                          data-testid="btn-bo-question-open-contact"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> {t.backOffice.openContact}
                        </Button>
                      </div>
                    </div>
                  )}

                  {(item.hospital || item.clinic) && (
                    <div className="rounded-lg border bg-muted/20 p-3 space-y-1.5" data-testid="bo-question-entity-card">
                      {item.hospital && (
                        <div className="flex items-center gap-1.5 text-xs min-w-0" data-testid="text-bo-question-hospital">
                          <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="text-muted-foreground shrink-0">{t.backOffice.hospitalLabel}:</span>
                          <button
                            type="button"
                            onClick={() => setDetailEntity({ type: "hospital", id: item.hospital!.id })}
                            className="font-medium text-primary hover:underline truncate text-left min-w-0"
                            data-testid="link-bo-question-hospital"
                          >
                            {item.hospital.name}
                          </button>
                        </div>
                      )}
                      {item.clinic && (
                        <div className="flex items-center gap-1.5 text-xs min-w-0" data-testid="text-bo-question-clinic">
                          <Stethoscope className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="text-muted-foreground shrink-0">{t.backOffice.clinicLabel}:</span>
                          <button
                            type="button"
                            onClick={() => setDetailEntity({ type: "clinic", id: item.clinic!.id })}
                            className="font-medium text-primary hover:underline truncate text-left min-w-0"
                            data-testid="link-bo-question-clinic"
                          >
                            {item.clinic.name}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic" data-testid="text-bo-question-no-customer">{t.backOffice.noCustomer}</div>
              )}

              {item.reason && (
                <div>
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{t.backOffice.reasonLabel}</div>
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"
                    data-testid="badge-bo-question-reason"
                  >
                    <Zap className="h-3 w-3" /> {item.reason}
                  </span>
                </div>
              )}

              {item.task.description && (
                <div>
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{t.backOffice.descriptionLabel}</div>
                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap break-words" data-testid="text-bo-question-detail-description">{item.task.description}</p>
                </div>
              )}

              {item.question && (
                <div>
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                    <MessageSquare className="h-3 w-3" /> {t.backOffice.questionForAgent}
                    {item.question.highPriority && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-600 text-white animate-bo-blink" data-testid="badge-bo-question-detail-urgent">
                        <AlertTriangle className="h-2.5 w-2.5" /> {t.backOffice.urgentBadge}
                      </span>
                    )}
                  </div>
                  <div className={`rounded-lg border p-3 ${item.question.highPriority ? "border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/20" : "border-purple-200 dark:border-purple-900 bg-purple-50 dark:bg-purple-950/20"}`}>
                    {item.question.userName && (
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <UserAvatar name={item.question.userName} avatarUrl={item.question.avatarUrl} className="h-5 w-5" testId="avatar-question-detail-author" />
                        <div className="text-[10px] text-muted-foreground">{item.question.userName}</div>
                      </div>
                    )}
                    <p className="text-xs leading-relaxed whitespace-pre-wrap break-words" data-testid="text-bo-question-detail-content">{item.question.content}</p>
                  </div>
                </div>
              )}

              <div>
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2.5" data-testid="text-bo-question-history-label">{t.backOffice.historyLabel}</div>
                <Timeline thread={thread} />
              </div>
            </div>

            <div className="space-y-3 min-w-0">
              <div className="rounded-lg border border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/10 p-3 space-y-2">
                <div className="text-[11px] font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wide flex items-center gap-1.5">
                  <CornerDownLeft className="h-3.5 w-3.5" /> {t.backOffice.answerButton}
                </div>
                <Textarea
                  className="text-xs min-h-[90px] resize-none bg-background"
                  placeholder={t.backOffice.answerPlaceholder}
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  data-testid={`textarea-bo-answer-${item.task.id}`}
                />
                <BoAttachmentComposer
                  taskId={item.task.id}
                  attachments={answerAttachments}
                  onChange={setAnswerAttachments}
                  disabled={answerMutation.isPending}
                />
                <Button
                  size="sm"
                  className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={() => answerMutation.mutate()}
                  disabled={answerMutation.isPending || !answer.trim()}
                  data-testid={`btn-bo-answer-${item.task.id}`}
                >
                  {answerMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  {t.backOffice.answerButton}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>

      <SendProcessingOverlay
        open={!!sendFx}
        status={sendFx === "done" ? "done" : "sending"}
        sendingLabel={t.backOffice.sendingLabel}
        doneLabel={t.backOffice.sentForProcessing}
      />
      <EntityDetailDrawer entity={detailEntity} onClose={() => setDetailEntity(null)} />
    </>
  );
}

export function BackOfficeQuestionsInbox() {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [resolvedItems, setResolvedItems] = useState<ResolvedItem[]>([]);

  const { data: questions = [] } = useQuery<BOQuestion[]>({
    queryKey: ["/api/agent/bo-questions"],
    queryFn: () => apiRequest("GET", "/api/agent/bo-questions").then(r => r.json()),
    refetchInterval: 20000,
  });

  useEffect(() => {
    const handler = (e: Event) => {
      const notif = (e as CustomEvent).detail;
      if (!notif) return;
      setResolvedItems(prev => {
        const id = notif.id || String(Date.now());
        if (prev.some(r => r.id === id)) return prev;
        return [...prev, {
          id,
          taskTitle: notif.metadata?.taskTitle || notif.title || "Úloha",
          resolution: notif.metadata?.resolution || null,
          customerName: notif.metadata?.customerName || null,
          at: Date.now(),
        }];
      });
    };
    window.addEventListener("indexus:bo-resolved", handler);
    return () => window.removeEventListener("indexus:bo-resolved", handler);
  }, []);

  useEffect(() => {
    if (resolvedItems.length === 0) return;
    const id = setInterval(() => {
      const cutoff = Date.now() - 120_000;
      setResolvedItems(prev => prev.filter(r => r.at > cutoff));
    }, 10_000);
    return () => clearInterval(id);
  }, [resolvedItems.length]);

  if (questions.length === 0 && resolvedItems.length === 0) return null;

  const hasUrgent = questions.some(q => !!q.question?.highPriority);
  const activeItem = openTaskId ? questions.find(q => q.task.id === openTaskId) || null : null;

  return (
    <div className="border-b bg-purple-50/40 dark:bg-purple-950/10 shrink-0" data-testid="bo-questions-inbox">
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-2 px-3 py-2"
        data-testid="btn-toggle-bo-questions"
      >
        <CornerDownLeft className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
        <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">{t.backOffice.questionsInboxTitle}</span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white ${hasUrgent ? "bg-rose-500 animate-bo-blink" : "bg-purple-500"}`}>{questions.length}</span>
        {collapsed ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto" /> : <ChevronUp className="h-3.5 w-3.5 text-muted-foreground ml-auto" />}
      </button>
      {!collapsed && (
        <div className="px-2 pb-2 space-y-2 max-h-[40vh] overflow-y-auto">
          {resolvedItems.map(item => (
            <ResolvedCard
              key={item.id}
              item={item}
              onDismiss={() => setResolvedItems(prev => prev.filter(r => r.id !== item.id))}
            />
          ))}
          {questions.map(item => (
            <QuestionTile key={item.task.id} item={item} onClick={() => setOpenTaskId(item.task.id)} />
          ))}
        </div>
      )}

      <Sheet open={!!activeItem} onOpenChange={(o) => { if (!o) setOpenTaskId(null); }}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl lg:max-w-4xl xl:max-w-5xl p-0 gap-0 overflow-hidden flex flex-col"
          data-testid="drawer-bo-question-detail"
        >
          <SheetTitle className="sr-only">{activeItem?.task.title || t.backOffice.questionsInboxTitle}</SheetTitle>
          {activeItem && <QuestionDrawerContent item={activeItem} onClose={() => setOpenTaskId(null)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}
