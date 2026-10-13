import { useCallback, useEffect, useState } from "react";
import { FileText, FolderOpen, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { getRecordEntryCopy } from "@/i18n/automation-record-entry-copy";

type EntityType = "customer" | "clinic" | "hospital" | "collaborator";
type Attachment = { id: string; name: string; type?: string; size?: number };
type Entry = { id: string; title: string; note?: string | null; ruleName?: string | null; createdAt: string; attachments?: Attachment[] };
type Props = { entityType: EntityType; entityId: string; documentsOnly?: boolean };

function formatSize(size?: number) {
  if (!Number.isFinite(size)) return "";
  if ((size ?? 0) < 1024) return `${size} B`;
  return `${((size ?? 0) / 1024).toFixed(1)} KB`;
}

export function AutomationRecordEntriesPanel({ entityType, entityId, documentsOnly = false }: Props) {
  const { locale } = useI18n();
  const c = getRecordEntryCopy(locale);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/automation/records/${entityType}/${encodeURIComponent(entityId)}/entries`, { credentials: "include", signal });
      if (!res.ok) throw new Error("load failed");
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : Array.isArray(data?.entries) ? data.entries : []);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(true);
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [entityType, entityId]);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const files = entries.flatMap(entry => (entry.attachments || []).map(file => ({ ...file, entryTitle: entry.title, entryId: entry.id })));
  const date = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Bratislava" }).format(new Date(value));
  return <section className="rounded-lg border bg-card p-4" data-testid="automation-record-entries-panel">
    <div className="mb-3 flex items-center gap-2">
      {documentsOnly ? <FolderOpen className="h-4 w-4 text-muted-foreground" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
      <h3 className="text-sm font-semibold">{documentsOnly ? c.folder : c.entries}</h3>
    </div>
    {loading ? <div aria-label={c.load} className="space-y-3 py-1"><div className="h-3 w-2/5 animate-pulse rounded bg-muted" /><div className="h-3 w-4/5 animate-pulse rounded bg-muted" /><div className="h-3 w-3/5 animate-pulse rounded bg-muted" /></div>
      : error ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm"><span>{c.error}</span><Button type="button" size="sm" variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-3.5 w-3.5" />{c.retry}</Button></div>
        : documentsOnly ? files.length ? <ul className="divide-y">{files.map(file => <li key={`${file.entryId}-${file.id}`} className="flex min-w-0 items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
          <div className="flex min-w-0 items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-muted-foreground" /><div className="min-w-0"><p className="truncate text-sm font-medium">{file.name}</p><p className="truncate text-xs text-muted-foreground">{file.entryTitle}{file.size != null ? ` · ${formatSize(file.size)}` : ""}</p></div></div>
          <a className="shrink-0 text-xs font-medium text-primary underline-offset-4 hover:underline" href={`/api/automation/records/${entityType}/${encodeURIComponent(entityId)}/files/${encodeURIComponent(file.id)}`} target="_blank" rel="noreferrer">{c.file}</a>
        </li>)}</ul> : <p className="text-sm text-muted-foreground">{c.noneFiles}</p>
        : entries.length ? <div className="relative space-y-0 pl-5 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-border">{entries.map(entry => <article key={entry.id} className="relative border-b py-3 last:border-0 last:pb-0 first:pt-0">
          <span className="absolute -left-5 top-4 h-2.5 w-2.5 rounded-full border-2 border-primary bg-card first:top-1" />
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><h4 className="text-sm font-medium">{entry.title}</h4><time className="text-xs text-muted-foreground">{date(entry.createdAt)}</time></div>
          {entry.note && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{entry.note}</p>}
          {entry.ruleName && <p className="mt-1 text-xs text-muted-foreground">{c.by}: {entry.ruleName}</p>}
          {!!entry.attachments?.length && <ul className="mt-2 flex flex-wrap gap-2">{entry.attachments.map(file => <li key={file.id}><a className="inline-flex max-w-full items-center gap-1.5 rounded border px-2 py-1 text-xs hover:bg-muted" href={`/api/automation/records/${entityType}/${encodeURIComponent(entityId)}/files/${encodeURIComponent(file.id)}`} target="_blank" rel="noreferrer"><FolderOpen className="h-3 w-3 shrink-0" /><span className="truncate">{file.name}</span>{file.size != null && <span className="shrink-0 text-muted-foreground">{formatSize(file.size)}</span>}</a></li>)}</ul>}
        </article>)}</div> : <p className="text-sm text-muted-foreground">{c.none}</p>}
  </section>;
}
