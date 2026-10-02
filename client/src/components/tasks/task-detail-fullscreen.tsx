import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Minimize2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import "./task-detail-fullscreen.css";
import { TaskModalArtwork } from "@/components/tasks/task-modal-artwork";

export function TaskDetailFullscreen({
  open, onOpenChange, children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const inlineSlot = useRef<HTMLDivElement>(null);
  const [contentNode] = useState(() => {
    const node = document.createElement("div");
    node.className = "task-detail-preserved-content";
    return node;
  });
  // Move the same portal host, rather than remounting the task's editors.
  // Unsaved checklist notes and other local component state survive resizing.
  useLayoutEffect(() => {
    if (!open) inlineSlot.current?.appendChild(contentNode);
  }, [open, contentNode]);
  useLayoutEffect(() => () => { contentNode.remove(); }, [contentNode]);
  return (
    <>
    <div ref={inlineSlot} className="task-detail-inline-slot" style={{ display: open ? "none" : "flex" }} />
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="task-detail-fullscreen-modal nexus-signal-tasks"
        overlayClassName="task-detail-fullscreen-overlay"
        data-testid="dialog-task-fullscreen"
        aria-describedby={undefined}
        hideCloseButton
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          contentNode.querySelector<HTMLButtonElement>('[data-testid="button-task-maximize"]')?.focus();
        }}
      >
        <div className="task-detail-fullscreen-toolbar">
          <div className="task-detail-fullscreen-heading">
            <TaskModalArtwork variant="detail" compact />
            <DialogTitle className="text-sm">{t.tasks.task}</DialogTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            data-testid="button-task-minimize"
            aria-label={t.nexusOmni.exitFullscreen}
          >
            <Minimize2 className="mr-2 h-4 w-4" />
            {t.nexusOmni.settings.minimize}
          </Button>
        </div>
        <div className="task-detail-fullscreen-content" ref={node => { if (node) node.appendChild(contentNode); }} />
      </DialogContent>
    </Dialog>
    {createPortal(children, contentNode)}
    </>
  );
}