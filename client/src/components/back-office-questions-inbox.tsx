import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { HelpCircle, Loader2, CornerDownLeft, ChevronDown, ChevronUp, Send } from "lucide-react";
import { format } from "date-fns";

type BOQuestion = {
  task: {
    id: string;
    title: string;
    country: string | null;
  };
  question: {
    id: string;
    content: string;
    createdAt: string;
    userId: string;
    userName: string | null;
  } | null;
};

function QuestionItem({ item }: { item: BOQuestion }) {
  const { toast } = useToast();
  const [answer, setAnswer] = useState("");

  const answerMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/agent/bo-questions/${item.task.id}/answer`, { content: answer }).then(r => r.json()),
    onSuccess: () => {
      setAnswer("");
      queryClient.invalidateQueries({ queryKey: ["/api/agent/bo-questions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/back-office/tasks"] });
      toast({ title: "Odpoveď odoslaná do Back Office" });
    },
    onError: () => toast({ title: "Chyba pri odosielaní odpovede", variant: "destructive" }),
  });

  return (
    <div className="rounded-lg border border-purple-200 dark:border-purple-900 bg-card p-2.5 space-y-2" data-testid={`bo-question-${item.task.id}`}>
      <div className="flex items-start gap-2">
        <HelpCircle className="h-3.5 w-3.5 text-purple-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium leading-snug">{item.task.title}</div>
          {item.question && (
            <div className="flex items-center gap-1.5 mt-0.5">
              {item.question.userName && <span className="text-[10px] text-muted-foreground">{item.question.userName}</span>}
              <span className="text-[10px] text-muted-foreground">· {format(new Date(item.question.createdAt), "d.M. HH:mm")}</span>
              {item.task.country && <span className="text-[10px] text-muted-foreground">· {item.task.country}</span>}
            </div>
          )}
        </div>
      </div>
      {item.question && (
        <p className="text-xs leading-relaxed bg-purple-50 dark:bg-purple-950/20 rounded p-2 whitespace-pre-wrap break-words" data-testid={`text-bo-question-${item.task.id}`}>
          {item.question.content}
        </p>
      )}
      <Textarea
        className="text-xs min-h-[52px] resize-none"
        placeholder="Napíšte odpoveď pre Back Office..."
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
        Odpovedať
      </Button>
    </div>
  );
}

export function BackOfficeQuestionsInbox() {
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
        <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">Otázky z Back Office</span>
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
