import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Check, CheckCircle2, ChevronLeft, Loader2, Sparkles } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { isPulseNotificationTask, isPulseStatusListTask } from "@/lib/task-query-controls";
import { TaskModalArtwork } from "./task-modal-artwork";
import "./task-resolution-dialog.css";

export interface TaskResolutionDialogTask {
  id: string | number;
  title: string;
  description?: string | null;
  tags?: string[] | null;
  relatedEntityType?: string | null;
  createdByUserId?: string | null;
}

interface ChecklistItem { id: string | number; label: string; required: boolean; doneAt: string | null; doneByUserId: string | number | null; note: string | null; position: number; }
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskResolutionDialogTask | null;
  resolution: string;
  onResolutionChange: (text: string) => void;
  onConfirm: () => void;
  saving: boolean;
  resolutionTestId?: string;
  notifyAgent?: boolean;
  onNotifyAgentChange?: (value: boolean) => void;
}

export function TaskResolutionDialog({
  open, onOpenChange, task, resolution, onResolutionChange, onConfirm, saving,
  resolutionTestId = "input-resolve-resolution", notifyAgent, onNotifyAgentChange,
}: Props) {
  const { locale, t } = useI18n();
  const copy = t.tasks.resolutionDialog;
  const taskId = task?.id;
  const pulse = isPulseStatusListTask(task || {});
  const defaultNotifyAgent = isPulseNotificationTask(task || {});
  const [draftState, setDraftState] = useState<
    "idle" | "loading" | "generated" | "preserved" | "unavailable" | "failed" | "checklist-error" | "no-completed-steps"
  >("idle");
  const [draftRequested, setDraftRequested] = useState(false);
  const generation = useRef(0);
  const draftController = useRef<AbortController | null>(null);
  const editedByUser = useRef(false);
  const draftPrefilled = useRef(false);
  const checklistQuery = useQuery<ChecklistItem[]>({
    queryKey: ["/api/tasks", taskId, "checklist"],
    enabled: open && taskId != null,
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/tasks/${encodeURIComponent(String(taskId))}/checklist`, { credentials: "include", signal });
      if (!response.ok) throw new Error("checklist-request-failed");
      const body: unknown = await response.json();
      if (!Array.isArray(body)) throw new Error("invalid-checklist-response");
      return body as ChecklistItem[];
    },
  });

  useEffect(() => {
    if (!open) {
      generation.current++;
      draftController.current?.abort();
      draftController.current = null;
      setDraftState("idle");
      setDraftRequested(false);
      editedByUser.current = false;
      draftPrefilled.current = false;
      return;
    }
    ++generation.current;
    draftController.current?.abort();
    setDraftState("idle");
    setDraftRequested(false);
    editedByUser.current = resolution.trim().length > 0;
    draftPrefilled.current = false;
    if (open && taskId != null) void checklistQuery.refetch();
    // Refresh persisted evidence for ordinary and Pulse tasks before drafting.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, taskId, pulse]);

  const items = checklistQuery.data ?? [];
  const checklistLoading = open && taskId != null && (checklistQuery.isLoading || checklistQuery.isFetching);
  const checklistError = open && taskId != null && checklistQuery.isError && !checklistLoading;
  const doneCount = items.filter((item) => !!item.doneAt).length;
  const remaining = Math.max(0, items.length - doneCount);
  const gateLoaded = !checklistLoading && !checklistError;
  const gatePasses = !pulse || (gateLoaded && items.length > 0 && remaining === 0);
  const canDraft = open && taskId != null && gateLoaded && doneCount > 0 && (!pulse || gatePasses);
  const requestDraft = useCallback(async () => {
    if (!task || !canDraft || draftController.current) return;
    const id = generation.current;
    const controller = new AbortController();
    draftController.current = controller;
    setDraftState("loading");
    setDraftRequested(true);
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(String(task.id))}/resolution-draft`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }), signal: controller.signal,
      });
      if (id !== generation.current || controller.signal.aborted) return;
      if (!response.ok) { setDraftState("failed"); return; }
      const result = await response.json() as { status?: string; draft?: string };
      if (id !== generation.current || controller.signal.aborted) return;
      if (result.status === "generated" && typeof result.draft === "string") {
        if (!editedByUser.current && !draftPrefilled.current) {
          onResolutionChange(result.draft);
          draftPrefilled.current = true;
          setDraftState("generated");
        } else {
          setDraftState("preserved");
        }
      } else if (result.status === "unavailable") setDraftState("unavailable");
      else setDraftState("failed");
    } catch {
      if (id === generation.current && !controller.signal.aborted) setDraftState("failed");
    } finally {
      if (draftController.current === controller) draftController.current = null;
    }
  }, [task, canDraft, locale, onResolutionChange]);

  useEffect(() => {
    if (!open || taskId == null || checklistLoading || draftRequested) return;
    setDraftRequested(true);
    if (checklistError) {
      setDraftState("checklist-error");
      return;
    }
    if (doneCount === 0) {
      setDraftState("no-completed-steps");
      return;
    }
    if (pulse && !gatePasses) return;
    void requestDraft();
  }, [checklistError, checklistLoading, doneCount, draftRequested, gatePasses, open, pulse, requestDraft, taskId]);

  const close = (next: boolean) => { if (saving && !next) return; onOpenChange(next); };
  const returnToChecklist = () => {
    if (saving) return;
    onOpenChange(false);
    window.setTimeout(() => {
      const section = document.querySelector<HTMLElement>(`[data-testid="checklist-${CSS.escape(String(task?.id ?? ""))}"]`);
      const focusable = section?.querySelector<HTMLElement>("button, [tabindex]");
      if (focusable) focusable.focus();
      else if (section) { section.tabIndex = -1; section.focus(); }
    }, 80);
  };
  const retryChecklist = () => {
    const id = generation.current;
    setDraftRequested(true);
    setDraftState("idle");
    void checklistQuery.refetch().then(result => {
      if (id !== generation.current) return;
      if (result.isError) {
        setDraftState("checklist-error");
        return;
      }
      setDraftRequested(false);
    });
  };
  const showDraftStatus = open && taskId != null && !checklistLoading && draftState !== "idle";

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent id="dialog-task-resolution" data-testid="dialog-task-resolution" className="task-modern-modal task-resolution-dialog w-[calc(100vw-24px)] max-w-[520px] p-0" overlayClassName="task-modern-modal-overlay" hideCloseButton={saving}>
        <TaskModalArtwork variant="resolve" compact />
        <DialogHeader className="border-b border-border px-5 py-5 text-left sm:px-6">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.12em] text-primary">
            <CheckCircle2 className="h-4 w-4" />{copy.title}
          </div>
          <DialogTitle className="text-xl">{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <div className="task-modern-modal-body space-y-4">
          {task && <div className="task-resolution-dialog__task"><h3 className="font-semibold leading-snug">{task.title}</h3>{task.description && <p className="mt-1.5 whitespace-pre-wrap text-sm text-muted-foreground">{task.description}</p>}</div>}
          {pulse && <section id="resolution-checklist-gate" data-testid="resolution-checklist-gate" className="task-resolution-dialog__gate" aria-live="polite">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{copy.checklist}</h3>
              {!checklistLoading && !checklistError && items.length > 0 && <span className="text-xs tabular-nums text-muted-foreground">{doneCount} / {items.length}</span>}
            </div>
            {checklistLoading ? <p className="text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />{copy.loading}</p>
              : checklistError ? <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-destructive"><span><AlertCircle className="mr-1.5 inline h-4 w-4" />{copy.loadError}</span><Button variant="outline" size="sm" disabled={saving || checklistLoading} onClick={() => void checklistQuery.refetch()}>{copy.retry}</Button></div>
              : items.length === 0 ? <p className="text-sm text-muted-foreground">{copy.empty}</p>
              : <><div className="task-resolution-dialog__progress" role="progressbar" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={doneCount}><span style={{ transform: `scaleX(${doneCount / items.length})` }} /></div><p className={`mt-2 text-sm ${remaining ? "text-muted-foreground" : "font-medium text-foreground"}`}>{remaining ? copy.remaining.replace("{count}", String(remaining)) : <><Check className="mr-1 inline h-4 w-4 text-primary" />{copy.complete}</>}</p></>}
            {pulse && <Button type="button" variant="ghost" size="sm" className="mt-1 h-auto px-0 text-primary" onClick={returnToChecklist} disabled={saving}><ChevronLeft className="mr-1 h-4 w-4" />{copy.returnToChecklist}</Button>}
          </section>}
          <div className="space-y-2">
            <label htmlFor={resolutionTestId} className="text-sm font-semibold">{copy.resolution}</label>
            {showDraftStatus && <section
              className={`task-resolution-ai-status task-resolution-ai-status--${draftState}`}
              data-testid="resolution-ai-status"
              role={draftState === "failed" || draftState === "checklist-error" ? "alert" : "status"}
              aria-live={draftState === "failed" || draftState === "checklist-error" ? "assertive" : "polite"}
              aria-busy={draftState === "loading"}
            >
              <div className="task-resolution-ai-status__message">
                <span className="task-resolution-ai-status__icon" aria-hidden="true">
                  {draftState === "loading" ? <Sparkles className="h-4 w-4" /> :
                    draftState === "generated" || draftState === "preserved" ? <Check className="h-4 w-4" /> :
                    draftState === "failed" || draftState === "checklist-error" ? <AlertCircle className="h-4 w-4" /> :
                    <Sparkles className="h-4 w-4" />}
                </span>
                <div className="min-w-0">
                  <p className="task-resolution-ai-status__title">
                    {draftState === "loading" ? copy.drafting :
                      draftState === "generated" ? copy.draftReady :
                      draftState === "preserved" ? copy.draftPreserved :
                      draftState === "unavailable" ? copy.draftUnavailable :
                      draftState === "failed" ? copy.draftFailed :
                      draftState === "checklist-error" ? copy.checklistDraftError :
                      copy.draftNoCompletedSteps}
                  </p>
                  {draftState === "loading" && <p className="task-resolution-ai-status__hint">{copy.draftingHint}</p>}
                  {draftState === "loading" && <div className="task-resolution-ai-status__rail" aria-hidden="true"><span /></div>}
                </div>
              </div>
              {(draftState === "failed" || draftState === "unavailable") &&
                <Button type="button" variant="outline" size="sm" data-testid="button-resolution-draft-retry" onClick={() => void requestDraft()} disabled={saving}>
                  <Sparkles className="mr-2 h-4 w-4" />{copy.retry}
                </Button>}
              {draftState === "checklist-error" && !pulse &&
                <Button type="button" variant="outline" size="sm" data-testid="button-resolution-checklist-retry" onClick={retryChecklist} disabled={saving || checklistLoading}>
                  <Sparkles className="mr-2 h-4 w-4" />{copy.retry}
                </Button>}
            </section>}
            <Textarea id={resolutionTestId} data-testid={resolutionTestId} value={resolution} onChange={(event) => { editedByUser.current = true; onResolutionChange(event.target.value); }} placeholder={copy.placeholder} rows={5} disabled={saving} className="task-resolution-dialog__textarea min-h-[120px] resize-y" />
          </div>
          {task?.createdByUserId && onNotifyAgentChange && <div className="flex items-start gap-2.5 rounded-lg border border-border px-3 py-3">
            <Checkbox id="task-notify-agent" data-testid="task-notify-agent" checked={notifyAgent ?? defaultNotifyAgent} onCheckedChange={(checked) => onNotifyAgentChange(checked === true)} disabled={saving} />
            <label htmlFor="task-notify-agent" className="cursor-pointer"><span className="block text-sm font-medium">{copy.notify}</span><span className="mt-0.5 block text-xs text-muted-foreground">{copy.notifyHint}</span></label>
          </div>}
        </div>
        <DialogFooter className="task-modern-modal-footer">
          <Button type="button" variant="outline" onClick={() => close(false)} disabled={saving}>{copy.cancel}</Button>
          <Button type="button" data-testid="resolve-confirm" onClick={onConfirm} disabled={saving || !task || !resolution.trim() || !gatePasses || (pulse && (checklistLoading || checklistError))}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}{copy.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TaskResolutionDialog;