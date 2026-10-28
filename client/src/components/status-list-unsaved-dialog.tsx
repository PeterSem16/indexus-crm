import { AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { STATUS_LIST_DIALOG_FRAME_CLASS } from "@/components/status-list-dialog-frame";
import "@/components/status-list-unsaved-dialog.css";

export type StatusListUnsavedDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  cancelLabel: string;
  confirmLabel: string;
  onConfirm: () => void;
};

export function StatusListUnsavedDialog({
  open,
  onOpenChange,
  title,
  description,
  cancelLabel,
  confirmLabel,
  onConfirm,
}: StatusListUnsavedDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${STATUS_LIST_DIALOG_FRAME_CLASS} sl-unsaved-dialog sl-agent-dialog-frame z-[10070]`}
        overlayClassName="z-[10060]"
        data-testid="batch-nav-guard-dialog"
      >
        <DialogHeader className="sl-unsaved-header">
          <div className="sl-unsaved-heading">
            <div className="sl-unsaved-mark" aria-hidden="true">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="sl-unsaved-title">{title}</DialogTitle>
              <DialogDescription className="sl-unsaved-description">{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="sl-unsaved-footer">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="batch-nav-guard-cancel"
          >
            {cancelLabel}
          </Button>
          <Button
            className="sl-unsaved-confirm"
            onClick={onConfirm}
            data-testid="batch-nav-guard-confirm"
          >
            {confirmLabel}
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
