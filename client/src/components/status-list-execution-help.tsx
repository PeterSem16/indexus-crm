import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getStatusListExecutionCopy } from "@/i18n/status-list-execution-copy";
export type StatusListExecutionIssue = { automationId: string; eventKey: string; status: string; createdAt: string; itemLabel?: string };
export function StatusListExecutionHelp({ locale, mode, issues = [], onOpen }: {
  locale: string; mode: "immediate" | "batch"; issues?: StatusListExecutionIssue[]; onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const copy = getStatusListExecutionCopy(locale);
  return <>
    <Button type="button" variant="ghost" size="sm" className="h-auto whitespace-normal text-left text-[10px] text-muted-foreground"
      onClick={() => { onOpen?.(); setOpen(true); }} data-testid="status-list-execution-help">
      {mode === "batch" ? copy.batch : copy.immediate}
      {issues.length > 0 && <span className="ml-1 rounded bg-destructive/10 px-1 text-destructive" title={copy.failed}>{issues.length}</span>}
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{copy.title}</DialogTitle><DialogDescription className="whitespace-pre-line leading-relaxed text-left">{`${copy.help}\n\n${copy.closing}`}</DialogDescription></DialogHeader>
        {issues.length > 0 && <div className="space-y-2 rounded-md border border-destructive/30 p-3">
          <p className="text-sm font-semibold text-destructive">{copy.failed}</p>
          {issues.map(issue => <div key={`${issue.automationId}:${issue.eventKey}`} className="text-xs">
            <p>{issue.itemLabel || copy.failed} — {issue.status === "failed" ? copy.failedState : copy.uncertainState}</p>
            <p className="text-muted-foreground">{new Date(issue.createdAt).toLocaleString(locale)}</p>
          </div>)}
        </div>}
      </DialogContent>
    </Dialog>
  </>;
}
