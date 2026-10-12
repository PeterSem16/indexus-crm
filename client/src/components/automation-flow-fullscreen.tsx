import { useRef, useState, type ReactNode } from "react";
import { Maximize2, Minimize2, X } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { AutomationFlowFullscreenCopy } from "@/i18n/automation-flow-fullscreen-copy";
import "./automation-flow-fullscreen.css";

type AutomationFlowFullscreenProps = {
  title: string;
  copy: AutomationFlowFullscreenCopy;
  children: ReactNode;
};

export function AutomationFlowFullscreen({
  title,
  copy,
  children,
}: AutomationFlowFullscreenProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="automation-flow-viewer">
      <Dialog open={open} onOpenChange={setOpen}>
        <div className="automation-flow-viewer__inline-toolbar">
          <DialogTrigger asChild>
            <button
              ref={triggerRef}
              type="button"
              className="automation-flow-viewer__maximize"
              aria-haspopup="dialog"
            >
              <Maximize2 aria-hidden="true" />
              <span>{copy.maximize}</span>
            </button>
          </DialogTrigger>
        </div>
        {children}
        <DialogContent
          hideCloseButton
          overlayClassName="automation-flow-viewer__overlay"
          className="automation-flow-viewer__dialog"
          onKeyDownCapture={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          }}
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            window.requestAnimationFrame(() => triggerRef.current?.focus());
          }}
        >
          <header className="automation-flow-viewer__toolbar">
            <div className="automation-flow-viewer__heading">
              <DialogTitle className="automation-flow-viewer__title">
                {title}
              </DialogTitle>
              <DialogDescription className="automation-flow-viewer__description">
                {copy.dialogDescription}
              </DialogDescription>
            </div>
            <div className="automation-flow-viewer__actions">
              <DialogClose asChild>
                <button type="button" className="automation-flow-viewer__action">
                  <Minimize2 aria-hidden="true" />
                  <span>{copy.restore}</span>
                </button>
              </DialogClose>
              <DialogClose asChild>
                <button
                  type="button"
                  className="automation-flow-viewer__action automation-flow-viewer__action--close"
                  aria-label={copy.close}
                >
                  <X aria-hidden="true" />
                  <span>{copy.close}</span>
                </button>
              </DialogClose>
            </div>
          </header>
          <div className="automation-flow-viewer__scroll" tabIndex={0} aria-label={copy.dialogDescription}>
            {children}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
