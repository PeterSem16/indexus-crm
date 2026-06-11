import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import {
  ClipboardList, Clock, AlertTriangle, CheckCircle2, User,
  ExternalLink, Loader2, Check, X, ChevronRight, Zap,
  Calendar, Building2, Phone,
} from "lucide-react";
import { format, isToday, isTomorrow, isPast, formatDistanceToNow } from "date-fns";
import { sk } from "date-fns/locale";

type BOTask = {
  task: {
    id: string;
    title: string;
    description: string | null;
    dueDate: string | null;
    priority: string;
    status: string;
    assignedUserId: string;
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
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  urgent: { label: "Urgentná", color: "text-rose-600 dark:text-rose-400", dot: "bg-rose-500" },
  high: { label: "Vysoká", color: "text-orange-500 dark:text-orange-400", dot: "bg-orange-500" },
  medium: { label: "Stredná", color: "text-yellow-600 dark:text-yellow-400", dot: "bg-yellow-500" },
  low: { label: "Nízka", color: "text-muted-foreground", dot: "bg-muted-foreground" },
};

function getDueBadge(dueDate: string | null, status: string) {
  if (status === "completed") return { label: "Hotovo", className: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" };
  if (!dueDate) return null;
  const d = new Date(dueDate);
  if (isPast(d)) return { label: "Po termíne", className: "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400" };
  if (isToday(d)) return { label: "Dnes", className: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" };
  if (isTomorrow(d)) return { label: "Zajtra", className: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" };
  return null;
}

function TaskListItem({
  item,
  isSelected,
  onClick,
}: {
  item: BOTask;
  isSelected: boolean;
  onClick: () => void;
}) {
  const { task, confirmation } = item;
  const pConfig = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const dueBadge = getDueBadge(task.dueDate, task.status);
  const isDone = task.status === "completed" || !!confirmation;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left flex items-start gap-2.5 px-3 py-2.5 rounded-lg transition-colors border ${
        isSelected
          ? "bg-primary/5 border-primary/20"
          : "bg-card border-border hover:bg-muted/50"
      } ${isDone ? "opacity-60" : ""}`}
      data-testid={`bo-task-${task.id}`}
    >
      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${pConfig.dot}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1">
          <span className={`text-xs font-medium leading-tight ${isDone ? "line-through" : ""}`}>{task.title}</span>
          {isDone && <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />}
        </div>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {task.country && (
            <span className="text-[10px] text-muted-foreground font-medium">{task.country}</span>
          )}
          {dueBadge && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${dueBadge.className}`}>{dueBadge.label}</span>
          )}
          {task.dueDate && !isDone && (
            <span className="text-[10px] text-muted-foreground">
              {format(new Date(task.dueDate), "d.M. HH:mm")}
            </span>
          )}
          {task.tags?.includes("status_list") && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">SL</span>
          )}
        </div>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
    </button>
  );
}

function TaskDetail({
  item,
  onConfirmed,
}: {
  item: BOTask;
  onConfirmed: () => void;
}) {
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const { task, confirmation } = item;
  const isDone = task.status === "completed" || !!confirmation;

  const confirmMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/back-office/tasks/${task.id}/confirm`, {
        note: note || null,
        statusListItemId: task.relatedEntityId || null,
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/back-office/tasks"] });
      toast({ title: "Úloha potvrdená ako splnená" });
      onConfirmed();
    },
    onError: () => toast({ title: "Chyba pri potvrdzovaní", variant: "destructive" }),
  });

  const pConfig = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const dueBadge = getDueBadge(task.dueDate, task.status);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-tight">{task.title}</h3>
          {isDone && (
            <Badge className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-0 text-[10px] shrink-0">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Splnené
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium bg-muted ${pConfig.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${pConfig.dot}`} />
            {pConfig.label} priorita
          </span>
          {task.country && (
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">
              <Building2 className="h-3 w-3" />
              {task.country}
            </span>
          )}
          {dueBadge && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${dueBadge.className}`}>{dueBadge.label}</span>
          )}
        </div>

        {task.dueDate && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>Termín: {format(new Date(task.dueDate), "d. MMMM yyyy HH:mm", { locale: sk })}</span>
            {!isDone && isPast(new Date(task.dueDate)) && (
              <span className="text-rose-500 font-medium">
                (pred {formatDistanceToNow(new Date(task.dueDate), { locale: sk })})
              </span>
            )}
          </div>
        )}
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-4">
          {task.description && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Popis úlohy</div>
              <p className="text-sm leading-relaxed">{task.description}</p>
            </div>
          )}

          {task.relatedEntityType && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Súvisí s</div>
              <div className="flex items-center gap-2 text-xs">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-muted-foreground">{task.relatedEntityType}</span>
                <span className="font-mono text-xs">{task.relatedEntityId}</span>
              </div>
            </div>
          )}

          {isDone && confirmation && (
            <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Úloha splnená</span>
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {format(new Date(confirmation.confirmedAt), "d.M.yyyy HH:mm")}
                </span>
              </div>
              {confirmation.note && (
                <p className="text-xs text-muted-foreground mt-1">{confirmation.note}</p>
              )}
            </div>
          )}

          {!isDone && (
            <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5" />
                Potvrdenie splnenia
              </div>
              <Textarea
                className="text-xs min-h-[70px] resize-none"
                placeholder="Poznámka k splneniu (voliteľné)..."
                value={note}
                onChange={e => setNote(e.target.value)}
                data-testid="textarea-bo-confirm-note"
              />
              <Button
                className="w-full gap-2"
                onClick={() => confirmMutation.mutate()}
                disabled={confirmMutation.isPending}
                data-testid="btn-bo-confirm-task"
              >
                {confirmMutation.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <CheckCircle2 className="h-4 w-4" />
                }
                Potvrdiť splnenie úlohy
              </Button>
            </div>
          )}

          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">História</div>
            <div className="space-y-1.5">
              <div className="flex items-start gap-2 text-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 mt-1.5 shrink-0" />
                <div>
                  <span className="text-muted-foreground">Vytvorená: </span>
                  <span>{format(new Date(task.createdAt), "d.M.yyyy HH:mm")}</span>
                </div>
              </div>
              {isDone && confirmation && (
                <div className="flex items-start gap-2 text-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <div>
                    <span className="text-emerald-600 font-medium">BO potvrdilo: </span>
                    <span>{format(new Date(confirmation.confirmedAt), "d.M.yyyy HH:mm")}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

export function BackOfficePanel({ country, fullScreen }: { country?: string; fullScreen?: boolean }) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [scope, setScope] = useState<"mine" | "team" | "all">("mine");
  const [filter, setFilter] = useState<"all" | "pending" | "done">("pending");

  const { data: rawTasks = [], isLoading } = useQuery<BOTask[]>({
    queryKey: ["/api/back-office/tasks", country, scope],
    queryFn: () =>
      apiRequest("GET", `/api/back-office/tasks?${country ? `country=${country}&` : ""}scope=${scope}`).then(r => r.json()),
    refetchInterval: 30000,
  });

  const tasks = rawTasks.filter(item => {
    if (filter === "pending") return item.task.status !== "completed" && !item.confirmation;
    if (filter === "done") return item.task.status === "completed" || !!item.confirmation;
    return true;
  });

  const urgentCount = rawTasks.filter(i => i.task.priority === "urgent" && i.task.status !== "completed" && !i.confirmation).length;
  const todayCount = rawTasks.filter(i => {
    const d = i.task.dueDate ? new Date(i.task.dueDate) : null;
    return d && isToday(d) && i.task.status !== "completed" && !i.confirmation;
  }).length;
  const doneCount = rawTasks.filter(i => i.task.status === "completed" || !!i.confirmation).length;

  const selectedItem = rawTasks.find(i => i.task.id === selectedTaskId) || null;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Inbox */}
      <div className="w-64 border-r flex flex-col shrink-0">
        <div className="px-3 py-2.5 border-b space-y-2">
          <div className="flex items-center gap-1.5">
            <ClipboardList className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-xs font-semibold">Back Office</span>
            {urgentCount > 0 && (
              <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500 text-white">{urgentCount}</span>
            )}
          </div>
          <div className="flex gap-1">
            {(["mine", "team", "all"] as const).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className={`flex-1 text-[10px] py-1 rounded font-medium transition-colors ${scope === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
              >
                {s === "mine" ? "Moje" : s === "team" ? "Tím" : "Všetky"}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {([
              { v: "all" as const, l: `Všetky (${rawTasks.length})` },
              { v: "pending" as const, l: `Čakajú (${rawTasks.length - doneCount})` },
              { v: "done" as const, l: `Hotovo (${doneCount})` },
            ]).map(f => (
              <button
                key={f.v}
                type="button"
                onClick={() => setFilter(f.v)}
                className={`flex-1 text-[9px] py-1 rounded transition-colors ${filter === f.v ? "bg-foreground/10 font-semibold" : "text-muted-foreground hover:bg-muted/50"}`}
              >
                {f.l}
              </button>
            ))}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-xs">Načítavam...</span>
              </div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="h-7 w-7 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">
                  {filter === "pending" ? "Žiadne čakajúce úlohy" : "Žiadne úlohy"}
                </p>
              </div>
            ) : (
              tasks.map(item => (
                <TaskListItem
                  key={item.task.id}
                  item={item}
                  isSelected={selectedTaskId === item.task.id}
                  onClick={() => setSelectedTaskId(item.task.id)}
                />
              ))
            )}
          </div>
        </ScrollArea>

        {/* Stats footer */}
        <div className="border-t px-3 py-2 bg-muted/20">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-rose-500" />
              {urgentCount} urgent
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-amber-500" />
              {todayCount} dnes
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              {doneCount} hotovo
            </span>
          </div>
        </div>
      </div>

      {/* Right: Detail */}
      <div className="flex-1 min-w-0">
        {selectedItem ? (
          <TaskDetail
            key={selectedItem.task.id}
            item={selectedItem}
            onConfirmed={() => setSelectedTaskId(null)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <ClipboardList className="h-10 w-10 opacity-20" />
            <p className="text-sm font-medium">Vyberte úlohu zo zoznamu</p>
            <p className="text-xs">
              {rawTasks.length - doneCount > 0
                ? `${rawTasks.length - doneCount} úloh čaká na spracovanie`
                : "Všetky úlohy sú splnené"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
