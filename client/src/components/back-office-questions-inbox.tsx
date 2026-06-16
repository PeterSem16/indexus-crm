import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import { HelpCircle, Loader2, CornerDownLeft, ChevronDown, ChevronUp, Send, User, ExternalLink, Phone, Mail, MapPin } from "lucide-react";
import { format } from "date-fns";

type BOQuestion = {
  task: {
    id: string;
    title: string;
    description: string | null;
    country: string | null;
  };
  question: {
    id: string;
    content: string;
    createdAt: string;
    userId: string;
    userName: string | null;
  } | null;
  customer?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    mobile: string | null;
    email: string | null;
    country: string | null;
    city: string | null;
  } | null;
};

function customerName(c: { firstName: string | null; lastName: string | null } | null | undefined): string {
  if (!c) return "";
  return [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
}

function openContact(customerId: string) {
  window.open(`/customers?view=${encodeURIComponent(customerId)}`, "_blank", "noopener,noreferrer");
}

function QuestionItem({ item }: { item: BOQuestion }) {
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
    },
    onError: () => toast({ title: t.backOffice.toastAnswerError, variant: "destructive" }),
  });

  const custName = customerName(item.customer);
  const phone = item.customer?.phone || item.customer?.mobile;
  const location = [item.customer?.city, item.customer?.country].filter(Boolean).join(", ");

  return (
    <div className="rounded-lg border border-purple-200 dark:border-purple-900 bg-card p-2.5 space-y-2" data-testid={`bo-question-${item.task.id}`}>
      <div className="flex items-start gap-2">
        <HelpCircle className="h-3.5 w-3.5 text-purple-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium leading-snug">{item.task.title}</div>
          {item.question && (
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {item.question.userName && <span className="text-[10px] text-muted-foreground">{item.question.userName}</span>}
              <span className="text-[10px] text-muted-foreground">· {format(new Date(item.question.createdAt), "d.M. HH:mm")}</span>
              {item.task.country && <span className="text-[10px] text-muted-foreground">· {item.task.country}</span>}
            </div>
          )}
        </div>
      </div>

      {item.customer && (
        <div className="rounded-md border bg-muted/30 p-2" data-testid={`bo-question-customer-${item.task.id}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] font-medium flex items-center gap-1" data-testid={`text-bo-question-customer-name-${item.task.id}`}>
                <User className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="truncate">{custName || "—"}</span>
              </div>
              <div className="mt-0.5 space-y-0.5 text-[10px] text-muted-foreground">
                {phone && (
                  <div className="flex items-center gap-1">
                    <Phone className="h-2.5 w-2.5 shrink-0" /> <span className="truncate">{phone}</span>
                  </div>
                )}
                {item.customer.email && (
                  <div className="flex items-center gap-1">
                    <Mail className="h-2.5 w-2.5 shrink-0" /> <span className="truncate">{item.customer.email}</span>
                  </div>
                )}
                {location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-2.5 w-2.5 shrink-0" /> <span className="truncate">{location}</span>
                  </div>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-[10px] px-2 shrink-0"
              onClick={() => openContact(item.customer!.id)}
              data-testid={`btn-bo-question-open-contact-${item.task.id}`}
            >
              <ExternalLink className="h-3 w-3" /> {t.backOffice.openContact}
            </Button>
          </div>
        </div>
      )}

      {item.task.description && (
        <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap break-words" data-testid={`text-bo-question-description-${item.task.id}`}>
          {item.task.description}
        </p>
      )}

      {item.question && (
        <p className="text-xs leading-relaxed bg-purple-50 dark:bg-purple-950/20 rounded p-2 whitespace-pre-wrap break-words" data-testid={`text-bo-question-${item.task.id}`}>
          {item.question.content}
        </p>
      )}
      <Textarea
        className="text-xs min-h-[52px] resize-none"
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
  );
}

export function BackOfficeQuestionsInbox() {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(false);

  const { data: questions = [] } = useQuery<BOQuestion[]>({
    queryKey: ["/api/agent/bo-questions"],
    queryFn: () => apiRequest("GET", "/api/agent/bo-questions").then(r => r.json()),
    refetchInterval: 20000,
  });

  if (questions.length === 0) return null;

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
            <QuestionItem key={item.task.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
