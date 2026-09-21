import { useRef, useState } from "react";
import { AlertTriangle, Loader2, Play, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/i18n/I18nProvider";
import { getAgentBreakIcon } from "@/lib/agent-break-icons";
import "./agent-break-dialog.css";

interface AgentBreakDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  icon?: string | null;
  color?: string | null;
  elapsedSeconds: number;
  expectedMinutes: number | null | undefined;
  onEndBreak: () => Promise<boolean>;
}

function formatTime(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  return [Math.floor(value / 3600), Math.floor(value / 60) % 60, value % 60]
    .map(part => String(part).padStart(2, "0")).join(":");
}

export function AgentBreakDialog({
  open, onOpenChange, name, icon, color, elapsedSeconds, expectedMinutes, onEndBreak,
}: AgentBreakDialogProps) {
  const { t } = useI18n();
  const copy = t.agentWorkspace.breakModal;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const submitting = useRef(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const seconds = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0;
  const expectedSeconds = expectedMinutes && expectedMinutes > 0 ? expectedMinutes * 60 : null;
  const exceeded = expectedSeconds !== null && seconds > expectedSeconds;
  const hideLabel = `${copy.hide} · ${copy.continues}`;
  const BreakIcon = getAgentBreakIcon(icon);
  const breakColor = color || "#EAB308";

  const finish = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError(false);
    try {
      if (await onEndBreak()) onOpenChange(false);
      else setError(true);
    } catch {
      setError(true);
    } finally {
      submitting.current = false;
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className={`agent-break-dialog ${exceeded ? "agent-break-dialog--overdue" : ""}`}
        overlayClassName="agent-break-dialog-overlay"
        data-testid="agent-break-dialog"
        onOpenAutoFocus={event => {
          // Opening the dialog must not make a second Enter accidentally resume work.
          event.preventDefault();
          closeButton.current?.focus();
        }}
        onCloseAutoFocus={event => {
          const status = document.querySelector<HTMLButtonElement>('[data-testid="dropdown-agent-status"]');
          if (status) {
            event.preventDefault();
            status.focus();
          }
        }}
      >
        <div className="abd-topline">
          <span><i aria-hidden="true" />{copy.inProgress}</span>
          <button ref={closeButton} type="button" className="abd-close" onClick={() => onOpenChange(false)} aria-label={hideLabel} title={hideLabel} data-testid="button-hide-break-dialog">
            <X size={18} />
          </button>
        </div>
        <div className="abd-hero">
          <div
            className="abd-icon"
            style={{ backgroundColor: `${breakColor}18`, borderColor: `${breakColor}45`, color: breakColor }}
          >
            <BreakIcon size={27} aria-hidden="true" />
          </div>
          <DialogTitle className="abd-title">{name}</DialogTitle>
          <DialogDescription className="abd-description">{copy.subtitle}</DialogDescription>
          <strong className="abd-clock" role="timer" aria-label={copy.elapsed} data-testid="text-break-time">{formatTime(seconds)}</strong>
          <span className="abd-clock-caption">{copy.elapsed}</span>
        </div>
        <div className="abd-timing">
          {expectedSeconds !== null ? (
            <>
              <div className="abd-time-row"><span>{copy.recommendedDuration}</span><b>{copy.minutes.replace("{count}", String(expectedMinutes))}</b></div>
              <progress value={Math.min(seconds, expectedSeconds)} max={expectedSeconds} aria-label={copy.recommendedDuration} />
              {exceeded ? (
                <div className="abd-warning" role="status" data-testid="badge-break-exceeded">
                  <AlertTriangle size={17} aria-hidden="true" />
                  <div><strong>{copy.exceeded}</strong><span>{copy.exceededBy.replace("{time}", formatTime(seconds - expectedSeconds))}</span></div>
                </div>
              ) : (
                <div className="abd-time-row abd-remaining"><span>{copy.remaining}</span><b>{formatTime(expectedSeconds - seconds)}</b></div>
              )}
            </>
          ) : <p className="abd-no-recommendation">{copy.noRecommendation}</p>}
        </div>
        <div className="abd-actions">
          {error && <p className="abd-error" role="alert" data-testid="break-end-error">{copy.endError}</p>}
          <button type="button" className="abd-primary" onClick={finish} disabled={pending} aria-busy={pending} data-testid="button-end-break">
            {pending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Play size={16} fill="currentColor" aria-hidden="true" />}
            {pending ? copy.finishing : copy.finish}
          </button>
          <button type="button" className="abd-secondary" onClick={() => onOpenChange(false)}>{copy.hide} <span>· {copy.continues}</span></button>
        </div>
        <div className="abd-footnote">{copy.footer}</div>
      </DialogContent>
    </Dialog>
  );
}