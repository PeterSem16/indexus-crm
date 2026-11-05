import { useEffect, useRef, useState } from "react";
import { AlertCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

type ExportMessage = { id: string; mailbox: string; subject: string };
type Copy = {
  sendZip: string; sendZipDescription: string; recipient: string; subject: string; body: string;
  sender: string; confirmSend: string; sending: string; cancel: string; sendSuccess: string;
  invalidDelivery: string; exportLimit: string; exportBusy: string; exportError: string;
  sendError: string; emailExportLimit: string;
};

export function OmniSearchExportEmailDialog({
  open, onOpenChange, messages, sender, copy, onSuccess,
  format,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: ExportMessage[];
  sender: string;
  copy: Copy;
  onSuccess: () => void;
  format: "eml" | "msg";
}) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submissionLock = useRef(false);

  useEffect(() => {
    if (open) {
      setTo("");
      setSubject("");
      setBody("");
      setError("");
    }
  }, [open]);

  const send = async () => {
    if (submissionLock.current || !sender || !messages.length) return;
    submissionLock.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/nexus/search-export", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          messages,
          delivery: { to: to.trim(), subject, body },
        }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        const code = result?.error;
        setError(code === "email_export_limit"
          ? copy.emailExportLimit
          : code === "export_limit" ? copy.exportLimit
          : code === "invalid_delivery" ? copy.invalidDelivery
            : code === "export_busy" ? copy.exportBusy : copy.sendError);
        return;
      }
      const result = await response.json().catch(() => ({}));
      if (response.status !== 202 || result?.sent !== true) {
        setError(copy.sendError);
        return;
      }
      onSuccess();
      onOpenChange(false);
    } catch {
      setError(copy.sendError);
    } finally {
      submissionLock.current = false;
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={next => { if (!busy) onOpenChange(next); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{copy.sendZip}</DialogTitle>
          <DialogDescription>{copy.sendZipDescription} ({messages.length})</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
            {copy.emailExportLimit}
          </p>
          <div className="rounded-lg border bg-muted/35 px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{copy.sender}</div>
            <div data-testid="search-export-sender" className="mt-0.5 truncate text-sm font-medium">{sender || "—"}</div>
          </div>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium">{copy.recipient}</span>
            <Input data-testid="search-export-recipient" type="email" required maxLength={254} disabled={busy} value={to} onChange={event => setTo(event.target.value)} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium">{copy.subject}</span>
            <Input data-testid="search-export-subject" maxLength={200} disabled={busy} value={subject} onChange={event => setSubject(event.target.value)} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium">{copy.body}</span>
            <Textarea data-testid="search-export-body" maxLength={20000} disabled={busy} value={body} onChange={event => setBody(event.target.value)} rows={4} />
          </label>
          {error && (
            <div role="alert" className="flex gap-2 rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{error}</span>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>{copy.cancel}</Button>
          <Button
            type="button"
            data-testid="confirm-send-search-export"
            disabled={busy || !sender || !to.trim() || !subject.trim() || !messages.length}
            onClick={() => void send()}
          >
            <Send className="mr-2 h-4 w-4" /> {busy ? copy.sending : copy.confirmSend}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
