import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import { HelpCircle, Loader2, CornerDownLeft, ChevronDown, ChevronUp, ChevronRight, Send, User, ExternalLink, Phone, Mail, MapPin, Building2, Clock, MessageSquare, Zap, Stethoscope } from "lucide-react";
import { format } from "date-fns";
import { Timeline, type ThreadData, type ThreadComment } from "./back-office-panel";

type BOQuestion = {
  task: ThreadData["task"];
  question: {
    id: string;
    content: string;
    createdAt: string;
    userId: string;
    userName: string | null;
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

function openContact(customerId: string) {
  window.open(`/customers?view=${encodeURIComponent(customerId)}`, "_blank", "noopener,noreferrer");
}

function QuestionTile({ item, onClick }: { item: BOQuestion; onClick: () => void }) {
  const custName = customerName(item.customer);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-lg border border-purple-200 dark:border-purple-900 bg-card p-2.5 transition-all hover:border-purple-400 dark:hover:border-purple-700 hover:shadow-sm active:scale-[0.99]"
      data-testid={`bo-question-${item.task.id}`}
    >
      <div className="flex items-start gap-2">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/40 shrink-0 mt-0.5">
          <HelpCircle className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium leading-snug truncate" data-testid={`text-bo-question-title-${item.task.id}`}>{item.task.title}</div>
          {custName && (
            <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground" data-testid={`text-bo-question-customer-name-${item.task.id}`}>
              <User className="h-2.5 w-2.5 shrink-0" /> <span className="truncate">{custName}</span>
            </div>
          )}
          {item.question && (
            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-snug">{item.question.content}</p>
          )}
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {item.question?.userName && <span className="text-[10px] text-muted-foreground">{item.question.userName}</span>}
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

  const answerMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/agent/bo-questions/${item.task.id}/answer`, { content: answer }).then(r => r.json()),
    onSuccess: () => {
      setAnswer("");
      queryClient.invalidateQueries({ queryKey: ["/api/agent/bo-questions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/back-office/tasks"] });
      toast({ title: t.backOffice.toastAnswerSent });
      onClose();
    },
    onError: () => toast({ title: t.backOffice.toastAnswerError, variant: "destructive" }),
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
        <div className="p-5 space-y-5">
          {item.customer ? (
            <div className="rounded-lg border bg-muted/20 p-3" data-testid="bo-question-customer-card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">{t.backOffice.customerLabel}</div>
                  <div className="text-sm font-medium flex items-center gap-1.5" data-testid="text-bo-question-detail-customer-name">
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{custName || "—"}</span>
                  </div>
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
                  onClick={() => openContact(item.customer!.id)}
                  data-testid="btn-bo-question-open-contact"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> {t.backOffice.openContact}
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground italic" data-testid="text-bo-question-no-customer">{t.backOffice.noCustomer}</div>
          )}

          {(item.reason || item.clinic || item.hospital) && (
            <div className="space-y-2">
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
              {(item.clinic || item.hospital) && (
                <div className="flex flex-col gap-1 text-xs">
                  {item.clinic && (
                    <div className="flex items-center gap-1.5" data-testid="text-bo-question-clinic">
                      <Stethoscope className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="text-muted-foreground">{t.backOffice.clinicLabel}:</span>
                      <span className="truncate font-medium">{item.clinic.name}</span>
                    </div>
                  )}
                  {item.hospital && (
                    <div className="flex items-center gap-1.5" data-testid="text-bo-question-hospital">
                      <Building2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="text-muted-foreground">{t.backOffice.hospitalLabel}:</span>
                      <span className="truncate font-medium">{item.hospital.name}</span>
                    </div>
                  )}
                </div>
              )}
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
              </div>
              <div className="rounded-lg border border-purple-200 dark:border-purple-900 bg-purple-50 dark:bg-purple-950/20 p-3">
                {item.question.userName && <div className="text-[10px] text-muted-foreground mb-1">{item.question.userName}</div>}
                <p className="text-xs leading-relaxed whitespace-pre-wrap break-words" data-testid="text-bo-question-detail-content">{item.question.content}</p>
              </div>
            </div>
          )}

          <div>
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2.5" data-testid="text-bo-question-history-label">{t.backOffice.historyLabel}</div>
            <Timeline thread={thread} />
          </div>

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
      </ScrollArea>
    </>
  );
}

export function BackOfficeQuestionsInbox() {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const { data: questions = [] } = useQuery<BOQuestion[]>({
    queryKey: ["/api/agent/bo-questions"],
    queryFn: () => apiRequest("GET", "/api/agent/bo-questions").then(r => r.json()),
    refetchInterval: 20000,
  });

  if (questions.length === 0) return null;

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
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-500 text-white">{questions.length}</span>
        {collapsed ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto" /> : <ChevronUp className="h-3.5 w-3.5 text-muted-foreground ml-auto" />}
      </button>
      {!collapsed && (
        <div className="px-2 pb-2 space-y-2 max-h-[40vh] overflow-y-auto">
          {questions.map(item => (
            <QuestionTile key={item.task.id} item={item} onClick={() => setOpenTaskId(item.task.id)} />
          ))}
        </div>
      )}

      <Sheet open={!!activeItem} onOpenChange={(o) => { if (!o) setOpenTaskId(null); }}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg p-0 gap-0 overflow-hidden flex flex-col"
          data-testid="drawer-bo-question-detail"
        >
          <SheetTitle className="sr-only">{activeItem?.task.title || t.backOffice.questionsInboxTitle}</SheetTitle>
          {activeItem && <QuestionDrawerContent item={activeItem} onClose={() => setOpenTaskId(null)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}
