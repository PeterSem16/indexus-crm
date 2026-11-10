import { useEffect, useState } from "react";
import { History, ShieldCheck, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";
import { canApplyContactLoad, contactLoadPage, contactLoadErrorCopy } from "./contact-load-model";
import type { ContactLoadsController } from "./use-contact-loads";

export function ContactLoadHistoryButton({ controller }: { controller: ContactLoadsController }) {
  const { t } = useI18n();
  return <div className="flex flex-wrap gap-1">
    <Button variant="ghost" size="sm" onClick={controller.openHistory} data-testid="button-contact-load-history">
      <History className="mr-1.5 h-4 w-4" />{t.contactLoads.history}
    </Button>
    {controller.preview && <Button variant="outline" size="sm" onClick={controller.openReview}>{t.contactLoads.title}</Button>}
  </div>;
}

export function ContactLoadReview({ controller: c }: { controller: ContactLoadsController }) {
  const { t, locale } = useI18n();
  const s = t.contactLoads;
  const [confirmed, setConfirmed] = useState(false);
  const [page, setPage] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { setConfirmed(false); setPage(0); }, [c.preview?.id, c.reviewOpen]);
  useEffect(() => {
    if (!c.reviewOpen) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [c.reviewOpen]);
  const preview = c.preview;
  const pages = Math.max(1, Math.ceil(Math.min(5000, preview?.items.length || 0) / 50));
  const formatDate = (value: string) => {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleString(locale) : "—";
  };
  const statusLabel = (status: string) => status === "applied" ? s.applied : status === "undone" ? s.undone : s.previewStatus;
  return <>
    <Dialog open={c.reviewOpen} onOpenChange={open => { if (!open) c.closeReview(); }}>
      <DialogContent hideCloseButton={c.busy || c.ambiguous} className="max-w-3xl max-h-[90dvh] overflow-y-auto" onEscapeKeyDown={e => { if (c.busy || c.ambiguous) e.preventDefault(); }} onInteractOutside={e => { if (c.busy || c.ambiguous) e.preventDefault(); }}>
        <DialogHeader><DialogTitle>{s.title}</DialogTitle><DialogDescription>{s.preview}</DialogDescription></DialogHeader>
        <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><p>{s.safety}</p>
        </div>
        {c.busy && !preview && <div className="space-y-3" role="status" aria-label={s.loading}><p className="text-sm text-muted-foreground">{s.loading}</p>{[0,1,2].map(n => <div key={n} className="h-10 animate-pulse rounded-md bg-muted" />)}</div>}
        {c.error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{c.error}</p>}
        {preview && <>
          <div className="flex flex-wrap gap-3 rounded-lg border p-4">
            {(["new", "existing", "invalid"] as const).map(key => <div className="min-w-[100px] flex-1" key={key}><p className="text-xs text-muted-foreground">{s[key]}</p><p className={`text-2xl font-semibold tabular-nums ${key === "invalid" && preview.counts.invalid ? "text-destructive" : ""}`}>{preview.counts[key]}</p></div>)}
          </div>
          <p className="text-xs text-muted-foreground">{s.previewStatus} · {formatDate(preview.createdAt)} · {preview.source === "file" ? s.file : s.crm}</p>
          {preview.counts.invalid > 0 && <p role="alert" className="flex gap-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4 shrink-0" />{s.invalidError}</p>}
          {!canApplyContactLoad(preview, now) && preview.counts.invalid === 0 && !c.ambiguous && <p role="alert" className="text-sm text-destructive">{s.stale}</p>}
          <p className="text-xs text-muted-foreground">{s.pagination}</p>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{[s.row,s.name,s.country,s.result].map(label => <th key={label} className="px-3 py-2 font-medium">{label}</th>)}</tr></thead>
              <tbody>{contactLoadPage(preview, page).map((item, index) => <tr key={`${item.row}-${index}`} className="border-t align-top">
                <td className="px-3 py-2 tabular-nums">{item.row}</td><td className="px-3 py-2 break-words">{item.name || "—"}</td><td className="px-3 py-2">{item.country || "—"}</td>
                <td className="max-w-xs px-3 py-2"><Badge variant={item.disposition === "invalid" ? "destructive" : "secondary"}>{s[item.disposition]}</Badge>{item.disposition === "invalid" && <p className="mt-1 text-xs text-muted-foreground">{s.invalidRow}</p>}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <div className="flex items-center justify-end gap-2 text-xs"><Button aria-label={s.previous} size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button><span className="tabular-nums">{page + 1} / {pages}</span><Button aria-label={s.next} size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button></div>
          <label className="flex items-start gap-3 rounded-md border p-3 text-sm"><Checkbox checked={confirmed} onCheckedChange={value => setConfirmed(value === true)} disabled={c.busy} className="mt-0.5" /><span>{s.confirm}</span></label>
        </>}
        {c.busy && preview && <p role="status" className="text-sm text-muted-foreground">{s.working}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" disabled={c.busy || c.ambiguous} onClick={c.closeReview}>{s.close}</Button>
          {!preview && c.error && <Button disabled={c.busy} onClick={c.retryPreview}>{s.retry}</Button>}
          {preview && <Button data-testid="button-apply-contact-load" disabled={c.busy || c.blocked || !confirmed || (!c.ambiguous && !canApplyContactLoad(preview, now))} onClick={() => void c.apply()}>{c.ambiguous ? s.retry : preview.counts.new === 0 ? s.noop : s.apply}</Button>}
        </div>
      </DialogContent>
    </Dialog>
    <Dialog open={c.historyOpen && !c.reviewOpen} onOpenChange={open => { if (!open) c.closeHistory(); }}>
      <DialogContent hideCloseButton={c.busy} className="max-w-3xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{s.history}</DialogTitle><DialogDescription>{s.undoSafety}</DialogDescription></DialogHeader>
        {c.notice && <p role="status" className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">{c.notice}</p>}
        {c.error && <p role="alert" className="text-sm text-destructive">{c.error}</p>}
        {c.busy && <p role="status" className="text-sm text-muted-foreground">{s.working}</p>}
        <Button className="self-start" variant="outline" size="sm" onClick={() => { void c.history.refetch(); }} disabled={c.history.isFetching || c.busy}>{s.refresh}</Button>
        {c.history.isLoading && <div className="space-y-2">{[0,1,2].map(n => <div key={n} className="h-20 rounded-md bg-muted animate-pulse" />)}</div>}
        {c.history.isError && <div role="alert" className="rounded-md border p-4 text-sm"><p>{contactLoadErrorCopy(c.history.error, s)}</p><Button className="mt-2" variant="outline" onClick={() => { void c.history.refetch(); }}>{s.retry}</Button></div>}
        {!c.history.isLoading && !c.history.isError && !c.history.data?.batches.length && <div className="rounded-lg border border-dashed p-8 text-center"><History className="mx-auto mb-3 h-7 w-7 text-muted-foreground" /><p className="text-sm text-muted-foreground">{s.empty}</p></div>}
        <div className="space-y-3">{c.history.data?.batches.map(batch => <article key={batch.id} className="rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><div className="text-sm font-medium">{batch.source === "file" ? s.file : s.crm} · {formatDate(batch.createdAt)}</div><Badge variant="secondary">{statusLabel(batch.status)}</Badge></div>
          <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{batch.id}</p>
          <p className="mt-2 text-xs text-muted-foreground">{s.new}: {batch.counts.new} · {s.existing}: {batch.counts.existing} · {s.invalid}: {batch.counts.invalid}{batch.added !== undefined && ` · ${s.added}: ${batch.added}`}</p>
          {batch.appliedAt && <p className="mt-1 text-xs text-muted-foreground">{s.applied}: {formatDate(batch.appliedAt)}</p>}
          {batch.undo && <p className="mt-2 text-sm">{s.removed}: {batch.undo.removed} · {s.protected}: {batch.undo.protected}</p>}
          {batch.status === "preview" && <p className="mt-2 text-xs text-muted-foreground">{s.resume}</p>}
          {batch.status === "applied" && <Button variant="outline" size="sm" className="mt-3" disabled={c.busy} onClick={() => void c.reviewUndo(batch.id)}>{s.undo}</Button>}
          {c.undoReview?.id === batch.id && <section className="mt-4 space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4" aria-label={s.undoTitle}>
            <h3 className="font-medium">{s.undoTitle}</h3><p className="text-sm text-muted-foreground">{s.undoSafety}</p>
            <dl className="flex flex-wrap gap-x-6 gap-y-2">{(["removable", "protected", "missing"] as const).map(key => <div key={key}><dt className="text-xs text-muted-foreground">{s[key]}</dt><dd className="text-xl font-semibold tabular-nums">{c.undoReview!.counts[key]}</dd></div>)}</dl>
            <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={c.busy} onClick={c.cancelUndo}>{s.close}</Button><Button data-testid="button-confirm-contact-load-undo" variant="destructive" disabled={c.busy} onClick={() => void c.undo()}>{s.undoConfirm}</Button></div>
          </section>}
        </article>)}</div>
        <Button variant="outline" disabled={c.busy} onClick={c.closeHistory}>{s.close}</Button>
      </DialogContent>
    </Dialog>
  </>;
}
