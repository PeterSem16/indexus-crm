import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Archive, CalendarClock, ChevronDown, ChevronRight, FileClock, FilePenLine, FileText, ListChecks, Loader2, Mail, MessageSquareText, RotateCw, Search, Trash2, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/contexts/auth-context";
import { actionDisplayName, activityDetailEntries, moduleDisplayName } from "./record-activity-display";

type EventRow = { id: string; action: string; module: string; actor: string | null; createdAt: string; details: Record<string, unknown> | null };
type EventPage = { events: EventRow[]; nextCursor: string | null };
type Props = { recordType: "clinic" | "hospital"; recordId?: string | number | null; campaignId?: string };

async function parsePage(response: Response): Promise<EventPage> {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<EventPage>;
}

function actionStyle(action: string) {
  const key = action.toLowerCase();
  if (key.includes("callback")) return {
    icon: <CalendarClock className="h-3.5 w-3.5" />,
    className: "border-violet-300/70 bg-violet-100/70 text-violet-900 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200",
  };
  if (key.includes("email")) return {
    icon: <Mail className="h-3.5 w-3.5" />,
    className: "border-sky-300/70 bg-sky-100/70 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200",
  };
  if (key.includes("sms")) return {
    icon: <MessageSquareText className="h-3.5 w-3.5" />,
    className: "border-teal-300/70 bg-teal-100/70 text-teal-900 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-200",
  };
  if (key.includes("status") && !key.includes("background") && !key.includes("action") && !key.includes("answer")) return {
    icon: <ListChecks className="h-3.5 w-3.5" />,
    className: "border-indigo-300/70 bg-indigo-100/70 text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200",
  };
  if (key.includes("background") || key.includes("action") || key.includes("answer")) return {
    icon: <Zap className="h-3.5 w-3.5" />,
    className: "border-amber-300/70 bg-amber-100/70 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
  };
  if (key.includes("archiv")) return {
    icon: <Archive className="h-3.5 w-3.5" />,
    className: "border-violet-300/70 bg-violet-100/70 text-violet-900 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200",
  };
  if (key.includes("delet")) return {
    icon: <Trash2 className="h-3.5 w-3.5" />,
    className: "border-rose-300/70 bg-rose-100/70 text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200",
  };
  if (key.includes("added") || key.includes("version")) return {
    icon: <FileText className="h-3.5 w-3.5" />,
    className: "border-sky-300/70 bg-sky-100/70 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200",
  };
  if (key.includes("updated")) return {
    icon: <FilePenLine className="h-3.5 w-3.5" />,
    className: "border-emerald-300/70 bg-emerald-100/70 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
  };
  return {
    icon: <FileClock className="h-3.5 w-3.5" />,
    className: "border-primary/20 bg-primary/10 text-primary",
  };
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
    const displayAction = actionDisplayName(row.action, locale, tx.unknownAction, row.details?.actionType);
    const displayModule = moduleDisplayName(row.module, locale, tx.module);
    const visibleDetails = activityDetailEntries(row.details, locale, tx.before, tx.after).flat().join(" ");
    const text = `${row.actor || ""} ${displayAction} ${displayModule} ${visibleDetails}`.toLocaleLowerCase();
    const parsedDay = new Date(row.createdAt);
    const day = Number.isNaN(parsedDay.getTime()) ? "" : new Intl.DateTimeFormat("en-CA", { timeZone:"Europe/Bratislava",year:"numeric",month:"2-digit",day:"2-digit" }).format(parsedDay);
    return (!search || text.includes(search.toLocaleLowerCase())) && (!module || row.module === module) &&
      (!action || row.action === action) && (!from || day >= from) && (!to || day <= to);
  });

  const actionLabel = (value: string) => actionDisplayName(value, locale, tx.unknownAction);
  const dateTime = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? tx.unknownAction : new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone:"Europe/Bratislava" }).format(date);
  };

  return <>
    <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={!recordId} onClick={() => setOpen(true)}>
      <Activity className="h-3.5 w-3.5" />{tx.history}
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent hideCloseButton className="z-[10051] flex max-h-[min(88dvh,860px)] w-[min(1100px,calc(100vw-24px))] max-w-none flex-col gap-0 overflow-hidden p-0" style={{ width: "min(1100px, calc(100vw - 24px))", maxWidth: "min(1100px, calc(100vw - 24px))" }} overlayClassName="z-[10050]">
        <DialogHeader className="relative shrink-0 border-b px-5 py-4 pr-12">
          <DialogClose asChild><Button type="button" variant="ghost" size="icon" className="absolute right-3 top-3" aria-label={tx.close}><X className="h-4 w-4" /></Button></DialogClose>
          <DialogTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4 text-primary" />{tx.history}</DialogTitle>
          <DialogDescription>{tx.coverageNote}</DialogDescription>
        </DialogHeader>
         <div className="grid shrink-0 gap-2 border-b bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative sm:col-span-2 lg:col-span-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input aria-label={tx.searchActivity} value={search} onChange={event => setSearch(event.target.value)} className="pl-8" placeholder={tx.searchActivity} /></div>
           <select aria-label={tx.module} className="h-9 rounded-md border bg-background px-2 text-sm" value={module} onChange={event => setModule(event.target.value)}><option value="">{tx.allModules}</option>{modules.map(item => <option key={item} value={item}>{moduleDisplayName(item, locale, tx.module)}</option>)}</select>
          <select aria-label={tx.action} className="h-9 rounded-md border bg-background px-2 text-sm" value={action} onChange={event => setAction(event.target.value)}><option value="">{tx.allActions}</option>{actions.map(item => <option key={item} value={item}>{actionLabel(item)}</option>)}</select>
          <Input aria-label={tx.fromDate} type="date" value={from} onChange={event => setFrom(event.target.value)} />
          <Input aria-label={tx.toDate} type="date" value={to} onChange={event => setTo(event.target.value)} />
        </div>
         <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5" aria-live="polite">
          {loading && rows.length === 0 && <div className="grid gap-3" aria-label={tx.loading}>{[0, 1, 2].map(item => <div key={item} className="h-[76px] animate-pulse rounded-lg border bg-muted/40" />)}</div>}
          {error && <div role="alert" className="rounded-md border border-destructive/30 p-4 text-sm"><p className="mb-3">{tx.activityError}</p><Button variant="outline" size="sm" onClick={() => void load(cursor, rows.length === 0)}><RotateCw className="mr-2 h-4 w-4" />{t.clinics.agreements.retry}</Button></div>}
          {!loading && !error && rows.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">{tx.activityEmpty}</p>}
          {rows.length > 0 && filteredRows.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">{tx.noResults}</p>}
           <ol className="relative space-y-2 before:absolute before:bottom-4 before:left-[1.125rem] before:top-4 before:w-px before:bg-border/80">
            {filteredRows.map(row => {
              const isExpanded = expanded.includes(row.id);
               const details = activityDetailEntries(row.details, locale, tx.before, tx.after);
               const visual = actionStyle(typeof row.details?.actionType === "string" ? row.details.actionType : row.action);
               return <li key={row.id} className="relative rounded-xl border bg-card shadow-sm shadow-foreground/[0.025] transition-[border-color,background-color,box-shadow] duration-200 hover:border-primary/25 hover:bg-muted/[0.12] motion-reduce:transition-none">
                 <button type="button" className="relative flex w-full items-start gap-3 rounded-xl p-3 text-left outline-none transition-colors hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:gap-4 sm:p-4 motion-reduce:transition-none" aria-expanded={isExpanded} onClick={() => setExpanded(value => isExpanded ? value.filter(id => id !== row.id) : [...value, row.id])}>
                   <span className={`relative z-[1] mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border shadow-sm ${visual.className}`}>{visual.icon}</span>
                   <span className="min-w-0 flex-1">
                     <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                       <b className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold leading-4 ${visual.className}`}>{actionDisplayName(row.action, locale, tx.unknownAction, row.details?.actionType)}</b>
                       <span className="rounded-full border border-border/70 bg-muted/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{moduleDisplayName(row.module, locale, tx.module)}</span>
                     </span>
                     <span className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                       <span className="font-medium text-foreground/70">{row.actor || "—"}</span><span aria-hidden="true">·</span><time dateTime={row.createdAt}>{dateTime(row.createdAt)}</time>
                     </span>
                   </span>
                   <span className="mt-2 shrink-0 text-muted-foreground">{isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</span>
                </button>
                 {isExpanded && <div className="animate-in fade-in slide-in-from-top-1 border-t bg-muted/20 px-4 py-3 text-xs duration-150 motion-reduce:animate-none sm:px-[4.5rem]">
                   {details.length ? <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">{details.map(([key, value], index) => <div key={`${key}-${index}`} className="min-w-0"><dt className="mb-1 text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">{key}</dt><dd className="break-words text-sm leading-relaxed text-foreground/90">{value}</dd></div>)}</dl> : <p className="text-muted-foreground">{tx.noDetails}</p>}
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
