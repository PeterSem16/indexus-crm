import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, History, RefreshCw } from "lucide-react";
import type { WallboardAlarmHistoryEntry } from "@shared/wallboard-alarm-history";
import type { WallboardAlarmType } from "@shared/wallboard-alarms";
import { useI18n } from "@/i18n/I18nProvider";
import { formatWallboardDuration } from "@/components/wallboard/wallboard";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import "./WallboardAlarms.css";

type HistoryResponse = { items: WallboardAlarmHistoryEntry[]; retentionDays: number; truncated: boolean };
type HistoryDays = 1 | 7 | 30;

export interface WallboardAlarmHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId?: string | null;
  persistenceError?: boolean;
}

function typeLabel(type: WallboardAlarmType, a: ReturnType<typeof useI18n>["t"]["wallboard"]["alarm"]) {
  return {
    no_calls: a.typeNoCalls, min_online: a.typeMinOnline, min_available: a.typeMinAvailable,
    max_break: a.typeMaxBreak, long_break: a.typeLongBreak, queue_wait: a.typeQueueWait,
  }[type];
}

function displayTime(value: string | null, locale: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  return new Intl.DateTimeFormat(locale, { timeZone: "Europe/Bratislava", dateStyle: "short", timeStyle: "medium" }).format(new Date(value));
}

function elapsed(startedAt: string, lastObservedAt: string) {
  const start = Date.parse(startedAt);
  const last = Date.parse(lastObservedAt);
  return Number.isFinite(start) && Number.isFinite(last) ? formatWallboardDuration(Math.max(0, Math.floor((last - start) / 1000))) : "—";
}

function historyCopy(locale: string, retentionDays: number) {
  const language = locale.split("-")[0];
  const copy = {
    en: { endNotRecorded: "End not recorded", retention: `History is retained for up to ${retentionDays} days and limited to the latest 1,000 records.` },
    sk: { endNotRecorded: "Koniec nebol zaznamenaný", retention: `História sa uchováva najviac ${retentionDays} dní a je obmedzená na posledných 1 000 záznamov.` },
    cs: { endNotRecorded: "Konec nebyl zaznamenán", retention: `Historie se uchovává nejvýše ${retentionDays} dní a je omezena na posledních 1 000 záznamů.` },
    hu: { endNotRecorded: "A befejezés nincs rögzítve", retention: `Az előzmények legfeljebb ${retentionDays} napig és a legutóbbi 1 000 rekordig maradnak meg.` },
    ro: { endNotRecorded: "Final neînregistrat", retention: `Istoricul este păstrat până la ${retentionDays} de zile și este limitat la cele mai recente 1.000 de înregistrări.` },
    it: { endNotRecorded: "Fine non registrata", retention: `La cronologia viene conservata fino a ${retentionDays} giorni ed è limitata agli ultimi 1.000 record.` },
    de: { endNotRecorded: "Ende nicht aufgezeichnet", retention: `Der Verlauf wird bis zu ${retentionDays} Tage und höchstens für die letzten 1.000 Einträge aufbewahrt.` },
  } as const;
  return copy[language as keyof typeof copy] ?? copy.en;
}

export function WallboardAlarmHistory({ open, onOpenChange, campaignId = null, persistenceError = false }: WallboardAlarmHistoryProps) {
  const { t, locale } = useI18n();
  const a = t.wallboard.alarm;
  const h = a.history;
  const [days, setDays] = useState<HistoryDays>(7);
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const copy = historyCopy(locale, data?.retentionDays ?? 30);

  const load = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const generation = ++generationRef.current;
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 10_000);
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams({ days: String(days) });
      if (campaignId) params.set("campaignId", campaignId);
      const response = await fetch(`/api/wallboard/alarm-history?${params.toString()}`, {
        credentials: "same-origin", headers: { Accept: "application/json" }, signal: controller.signal,
      });
      if (!response.ok) throw new Error("Alarm history request failed");
      const next = await response.json() as HistoryResponse;
      if (generation === generationRef.current) setData(next);
    } catch {
      if ((!controller.signal.aborted || timedOut) && generation === generationRef.current) setError(true);
    } finally {
      window.clearTimeout(timeout);
      if (generation === generationRef.current) setLoading(false);
    }
  }, [campaignId, days]);

  useEffect(() => {
    generationRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    setData(null);
    setError(false);
  }, [campaignId, days, open]);

  useEffect(() => {
    if (!open) return;
    void load();
    const poll = window.setInterval(() => void load(), 15_000);
    return () => {
      window.clearInterval(poll);
      generationRef.current += 1;
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, [open, load]);

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="wb-alarm-dialog wb-history-dialog" aria-describedby="wb-alarm-history-description" data-testid="wallboard-alarm-history-dialog">
      <DialogHeader>
        <DialogTitle>{h.title}</DialogTitle>
        <DialogDescription id="wb-alarm-history-description">{h.description}</DialogDescription>
      </DialogHeader>
      <div className="wb-history-toolbar">
        <div className="wb-history-filters" role="group" aria-label={h.range}>
          {([1, 7, 30] as HistoryDays[]).map(value => <button key={value} type="button" data-active={days === value || undefined} onClick={() => setDays(value)} data-testid={`wallboard-alarm-history-days-${value}`}>{value} {h.days}</button>)}
        </div>
        <button className="wb-alarm-button" type="button" onClick={() => void load()} disabled={loading} data-testid="wallboard-alarm-history-retry"><RefreshCw size={13} aria-hidden="true" /> {h.refresh}</button>
      </div>
      {persistenceError && <p className="wb-history-warning" role="alert"><AlertTriangle size={14} aria-hidden="true" /> {h.persistenceWarning}</p>}
      {data?.truncated && <p className="wb-history-warning" role="status"><AlertTriangle size={14} aria-hidden="true" /> {h.truncated}</p>}
      <p className="wb-history-disclosure">{h.openOnly}</p>
      <div className="wb-history-scroll">
        {loading && !data ? <div className="wb-history-loading" aria-label={a.loading}><span /><span /><span /></div> : error ? <div className="wb-history-state wb-history-error" role="alert"><b>{h.loadError}</b><button type="button" onClick={() => void load()}>{h.retry}</button></div> : data?.items.length === 0 ? <div className="wb-history-state"><History size={21} aria-hidden="true" /><b>{h.empty}</b><span>{h.emptyDescription}</span></div> : <div className="wb-history-list" data-testid="wallboard-alarm-history-list">
          {data?.items.map(item => <article className="wb-history-item" key={`${item.incidentId}-${item.revision}`} data-testid="wallboard-alarm-history-item">
            <header><strong>{typeLabel(item.type, a)}</strong><span>{h.threshold}: {item.threshold}</span></header>
            <dl>
              <div><dt>{h.started}</dt><dd>{displayTime(item.startedAt, locale)}</dd></div>
              <div><dt>{h.lastObserved}</dt><dd>{displayTime(item.lastObservedAt, locale)}</dd></div>
              <div><dt>{h.duration}</dt><dd>{elapsed(item.startedAt, item.lastObservedAt)}</dd></div>
              <div><dt>{h.acknowledgedAt}</dt><dd>{displayTime(item.acknowledgedAt, locale)}</dd></div>
              <div><dt>{h.mutedAt}</dt><dd>{displayTime(item.mutedAt, locale)}</dd></div>
              <div><dt>{h.mutedUntil}</dt><dd>{displayTime(item.mutedUntil, locale)}</dd></div>
              <div><dt>{h.ended}</dt><dd>{item.endedAt ? `${displayTime(item.endedAt, locale)} · ${item.endReason ? h.endReasons[item.endReason] : "—"}` : copy.endNotRecorded}</dd></div>
            </dl>
          </article>)}
        </div>}
      </div>
      <footer className="wb-history-retention">{copy.retention}</footer>
    </DialogContent>
  </Dialog>;
}