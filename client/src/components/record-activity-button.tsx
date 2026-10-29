import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, ChevronDown, ChevronRight, Loader2, RotateCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/contexts/auth-context";

type EventRow = { id: string; action: string; module: string; actor: string | null; createdAt: string; details: Record<string, unknown> | null };
type EventPage = { events: EventRow[]; nextCursor: string | null };
type Props = { recordType: "clinic" | "hospital"; recordId?: string | number | null; campaignId?: string };

async function parsePage(response: Response): Promise<EventPage> {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<EventPage>;
}

function safeScalar(value: unknown): string | null {
  if (typeof value === "string") return value.length > 1200 ? `${value.slice(0, 1200)}…` : value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function asObject(value: unknown): Record<string, unknown> | null {
  let candidate = value;
  if (typeof candidate === "string" && candidate.length < 12000 && /^[\s]*\{/.test(candidate)) {
    try { candidate = JSON.parse(candidate) as unknown; } catch { return null; }
  }
  return candidate && typeof candidate === "object" && !Array.isArray(candidate) ? candidate as Record<string, unknown> : null;
}

function isSensitiveKey(key: string) {
  return /password|token|secret|email|phone|address|credential|authorization/i.test(key);
}

export function RecordActivityButton({ recordType, recordId, campaignId }: Props) {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const userScope = String(user?.id ?? "anonymous");
  const tx = t.agreementWorkspace as Required<typeof t.agreementWorkspace>;
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<EventRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [module, setModule] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  const requestRef = useRef<AbortController | null>(null);

  const baseUrl = useMemo(() => {
    if (!recordId) return "";
    const params = new URLSearchParams();
    if (campaignId) params.set("campaignId", campaignId);
    return `/api/${recordType === "clinic" ? "clinics" : "hospitals"}/${encodeURIComponent(String(recordId))}/record-activity${params.size ? `?${params}` : ""}`;
  }, [recordType, recordId, campaignId, userScope]);

  const load = async (next?: string | null, reset = false) => {
    if (!baseUrl) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true); setError(false);
    try {
      const url = new URL(baseUrl, window.location.origin);
      if (next) url.searchParams.set("before", next);
      const page = await parsePage(await fetch(url, { credentials: "include", signal: controller.signal }));
      if (controller.signal.aborted) return;
      setRows(current => reset ? page.events : [...current, ...page.events.filter(event => !current.some(row => row.id === event.id))]);
      setCursor(page.nextCursor);
    } catch {
      if (!controller.signal.aborted) setError(true);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    if (open) { setRows([]); setCursor(null); setSearch(""); setModule(""); setAction(""); setFrom(""); setTo(""); void load(null, true); }
    else requestRef.current?.abort();
    return () => requestRef.current?.abort();
  }, [open, baseUrl, userScope]);

  const modules = Array.from(new Set(rows.map(row => row.module).filter(Boolean)));
  const actions = Array.from(new Set(rows.map(row => row.action).filter(Boolean)));
  const filteredRows = rows.filter(row => {
    const text = `${row.actor || ""} ${row.action} ${row.module} ${JSON.stringify(row.details || {})}`.toLocaleLowerCase();
    const day = new Intl.DateTimeFormat("en-CA", { timeZone:"Europe/Bratislava",year:"numeric",month:"2-digit",day:"2-digit" }).format(new Date(row.createdAt));
    return (!search || text.includes(search.toLocaleLowerCase())) && (!module || row.module === module) &&
      (!action || row.action === action) && (!from || day >= from) && (!to || day <= to);
  });

  const actionLabel = (value: string) => {
    const known: Record<string, string> = {
      agreement_added: tx.eventAgreementAdded,
      agreement_version_added: tx.eventVersionAdded,
      agreement_updated: tx.eventAgreementUpdated,
      agreement_archived: tx.eventAgreementArchived,
      agreement_file_deletion_requested: tx.eventFileDeletionRequested,
      agreement_file_deleted: tx.eventFileDeleted,
    };
    return known[value.toLowerCase()] || value.replaceAll("_"," ");
  };
  const dateTime = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone:"Europe/Bratislava" }).format(date);
  };
  const detailEntries = (details: Record<string, unknown> | null) => Object.entries(details || {}).filter(([key]) => !isSensitiveKey(key)).flatMap(([key, raw]) => {
    const value = asObject(raw) || raw;
    const simple = safeScalar(value);
    if (simple !== null) return [[key, simple] as const];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const change = value as Record<string, unknown>;
      if (key === "before" || key === "after") {
        return Object.entries(change).filter(([field]) => !isSensitiveKey(field)).flatMap(([field, fieldValue]) => {
          const fieldText = safeScalar(asObject(fieldValue) || fieldValue);
          return fieldText === null ? [] : [[`${tx[key]} · ${field}`, fieldText] as const];
        });
      }
      const beforeObject = asObject(change.before);
      const afterObject = asObject(change.after);
      if (beforeObject || afterObject) {
        const fields = Array.from(new Set([...Object.keys(beforeObject || {}), ...Object.keys(afterObject || {})])).filter(field => !isSensitiveKey(field));
        return fields.flatMap(field => {
          const before = safeScalar(beforeObject?.[field]);
          const after = safeScalar(afterObject?.[field]);
          if (before === null && after === null) return [];
          return [[`${key} · ${field}`, `${tx.before}: ${before ?? "—"} · ${tx.after}: ${after ?? "—"}`] as const];
        });
      }
    }
    return [];
  });

  return <>
    <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={!recordId} onClick={() => setOpen(true)}>
      <Activity className="h-3.5 w-3.5" />{tx.history}
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent hideCloseButton className="z-[10051] flex max-h-[min(88dvh,860px)] w-[min(900px,calc(100vw-24px))] max-w-none flex-col gap-0 overflow-hidden p-0" overlayClassName="z-[10050]">
        <DialogHeader className="relative shrink-0 border-b px-5 py-4 pr-12">
          <DialogClose asChild><Button type="button" variant="ghost" size="icon" className="absolute right-3 top-3" aria-label={tx.close}><X className="h-4 w-4" /></Button></DialogClose>
          <DialogTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4 text-primary" />{tx.history}</DialogTitle>
          <DialogDescription>{tx.coverageNote}</DialogDescription>
        </DialogHeader>
        <div className="grid shrink-0 gap-2 border-b bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative sm:col-span-2 lg:col-span-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input aria-label={tx.searchActivity} value={search} onChange={event => setSearch(event.target.value)} className="pl-8" placeholder={tx.searchActivity} /></div>
          <select aria-label={tx.module} className="h-9 rounded-md border bg-background px-2 text-sm" value={module} onChange={event => setModule(event.target.value)}><option value="">{tx.allModules}</option>{modules.map(item => <option key={item} value={item}>{item}</option>)}</select>
          <select aria-label={tx.action} className="h-9 rounded-md border bg-background px-2 text-sm" value={action} onChange={event => setAction(event.target.value)}><option value="">{tx.allActions}</option>{actions.map(item => <option key={item} value={item}>{actionLabel(item)}</option>)}</select>
          <Input aria-label={tx.fromDate} type="date" value={from} onChange={event => setFrom(event.target.value)} />
          <Input aria-label={tx.toDate} type="date" value={to} onChange={event => setTo(event.target.value)} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4" aria-live="polite">
          {loading && rows.length === 0 && <div className="grid gap-3" aria-label={tx.loading}>{[0, 1, 2].map(item => <div key={item} className="h-[76px] animate-pulse rounded-lg border bg-muted/40" />)}</div>}
          {error && <div role="alert" className="rounded-md border border-destructive/30 p-4 text-sm"><p className="mb-3">{tx.activityError}</p><Button variant="outline" size="sm" onClick={() => void load(cursor, rows.length === 0)}><RotateCw className="mr-2 h-4 w-4" />{t.clinics.agreements.retry}</Button></div>}
          {!loading && !error && rows.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">{tx.activityEmpty}</p>}
          {rows.length > 0 && filteredRows.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">{tx.noResults}</p>}
          <ol className="space-y-2">
            {filteredRows.map(row => {
              const isExpanded = expanded.includes(row.id);
              const details = detailEntries(row.details);
              return <li key={row.id} className="rounded-lg border bg-card">
                <button type="button" className="flex w-full items-start gap-3 p-3 text-left hover:bg-muted/30" aria-expanded={isExpanded} onClick={() => setExpanded(value => isExpanded ? value.filter(id => id !== row.id) : [...value, row.id])}>
                  {isExpanded ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                  <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-x-2 gap-y-1"><b className="text-sm">{actionLabel(row.action)}</b><span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{row.module || tx.module}</span></span><span className="mt-1 block text-xs text-muted-foreground">{row.actor || "—"} · {dateTime(row.createdAt)}</span></span>
                </button>
                {isExpanded && <div className="border-t bg-muted/10 px-10 py-3 text-xs">
                  {details.length ? <dl className="grid gap-2 sm:grid-cols-2">{details.map(([key, value]) => <div key={key} className="min-w-0"><dt className="font-medium text-muted-foreground">{key}</dt><dd className="break-words">{value}</dd></div>)}</dl> : <p className="text-muted-foreground">{tx.noDetails}</p>}
                </div>}
              </li>;
            })}
          </ol>
          {cursor && !error && <div className="flex justify-center py-4"><Button variant="outline" onClick={() => void load(cursor)} disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{tx.loadMore}</Button></div>}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
