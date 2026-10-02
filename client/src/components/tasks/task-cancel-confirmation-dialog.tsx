import { useRef, useState } from "react";
import { AlertTriangle, Check, LoaderCircle, Sparkles, X } from "lucide-react";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import "@/components/tasks/task-cancel-confirmation-dialog.css";

type Props = {
  open: boolean;
  taskId: string | null;
  taskTitle: string;
  submitting?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (taskId: string) => Promise<boolean>;
};

export function TaskCancelConfirmationDialog({
  open,
  taskId,
  taskTitle,
  submitting = false,
  onOpenChange,
  onConfirm,
}: Props) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const confirmingRef = useRef(false);
  const busy = submitting || confirming;

  const confirmCancellation = async () => {
    if (!taskId || busy || confirmingRef.current) return;
    confirmingRef.current = true;
    setConfirming(true);
    try {
      const succeeded = await onConfirm(taskId);
      if (succeeded) onOpenChange(false);
    } catch {
      // Keep the confirmation open so the user can retry after a failed request.
    } finally {
      confirmingRef.current = false;
      setConfirming(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!busy) onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        className="task-cancel-dialog-content"
        overlayClassName="task-cancel-dialog-overlay"
        hideCloseButton
        data-testid="dialog-cancel-task"
        onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }}
        onPointerDownOutside={(event) => { if (busy) event.preventDefault(); }}
      >
        <button
          type="button"
          className="task-cancel-dialog-close"
          aria-label={t.common.close}
          disabled={busy}
          onClick={() => onOpenChange(false)}
          data-testid="button-close-cancel-task"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="task-cancel-art" aria-hidden="true">
          <span className="task-cancel-art__orbit task-cancel-art__orbit--one" />
          <span className="task-cancel-art__orbit task-cancel-art__orbit--two" />
          <span className="task-cancel-art__spark task-cancel-art__spark--one"><Sparkles /></span>
          <span className="task-cancel-art__spark task-cancel-art__spark--two"><Check /></span>
          <div className="task-cancel-art__sheet">
            <span className="task-cancel-art__sheet-line" />
            <span className="task-cancel-art__sheet-line task-cancel-art__sheet-line--short" />
            <span className="task-cancel-art__sheet-line" />
            <span className="task-cancel-art__seal"><AlertTriangle /></span>
          </div>
          <span className="task-cancel-art__confetti task-cancel-art__confetti--one" />
          <span className="task-cancel-art__confetti task-cancel-art__confetti--two" />
        </div>

        <DialogHeader className="task-cancel-dialog-header">
          <span className="task-cancel-dialog-kicker">{t.tasks.cancelConfirmKicker}</span>
          <DialogTitle>{t.tasks.cancelConfirmHeading}</DialogTitle>
          <DialogDescription data-testid="task-cancel-consequence">{t.tasks.cancelConfirmBody}</DialogDescription>
        </DialogHeader>

        <div className="task-cancel-task-context">
          <span className="task-cancel-task-context__dot" />
          <span className="task-cancel-task-context__title">{taskTitle}</span>
        </div>
        <p className="task-cancel-dialog-question">{t.tasks.cancelConfirmQuestion}</p>

        <div className="task-cancel-dialog-actions">
          <Button
            type="button"
            variant="outline"
            className="task-cancel-keep-button"
            disabled={busy}
            onClick={() => onOpenChange(false)}
            data-testid="button-keep-task"
          >
            {t.tasks.cancelConfirmKeep}
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="task-cancel-confirm-button"
            disabled={busy || !taskId}
            onClick={confirmCancellation}
            data-testid="button-confirm-cancel-task"
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
            {t.tasks.cancelConfirmAction}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}