import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { DateRange } from "react-day-picker";
import { useI18n } from "@/i18n";
import { TaskCreateDatePicker } from "@/components/tasks/task-create-controls";
import { reportingTranslations } from "@/i18n/reporting-translations";
import {
  reportingBounds, reportingPreset, reportingPresets,
  type ReportingPeriod, type ReportingPreset,
} from "../../../../shared/reporting-period";
import "./mission-funnel-report.css";

interface PeriodValue extends ReportingPeriod {
  setFrom: (from: string) => void;
  setTo: (to: string) => void;
  setPeriod: (period: ReportingPeriod) => void;
  fromISO: string;
  toISO: string;
  valid: boolean;
  preset: ReportingPreset | "custom";
  applyPreset: (preset: ReportingPreset) => void;
}
const ReportingContext = createContext<PeriodValue | null>(null);
export function ReportingPeriodProvider({ campaignId, children }: { campaignId: string; children: ReactNode }) {
  const [saved, setSaved] = useState({ campaignId, from: "", to: "", preset: "allTime" as ReportingPreset | "custom" });
  // A different Mission never receives even one render of the previous range.
  const period = saved.campaignId === campaignId ? saved : { campaignId, from: "", to: "", preset: "allTime" as const };
  const { from, to, preset } = period;
  const bounds = useMemo(() => reportingBounds({ from, to }), [from, to]);
  const setPeriod = (next: ReportingPeriod) => setSaved({ campaignId, ...next, preset: "custom" });
  return <ReportingContext.Provider value={{
    from, to, preset, ...bounds, setPeriod,
    setFrom: value => setPeriod({ from: value, to }),
    setTo: value => setPeriod({ from, to: value }),
    applyPreset: value => setSaved({ campaignId, ...reportingPreset(value), preset: value }),
  }}>{children}</ReportingContext.Provider>;
}
export const useOptionalReportingPeriod = () => useContext(ReportingContext);

export function useReportingDateRange(defaultFrom: Date, defaultTo: Date) {
  const shared = useOptionalReportingPeriod();
  const [local, setLocal] = useState<DateRange>({ from: defaultFrom, to: defaultTo });
  const day = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  const localBounds = reportingBounds({ from: local.from ? day(local.from) : "", to: local.to ? day(local.to) : "" });
  const range: DateRange = shared ? {
    from: new Date(`${shared.from || "1970-01-01"}T12:00:00`),
    to: new Date(`${shared.to || "9999-12-31"}T12:00:00`),
  } : local;
  return {
    range, isShared: !!shared,
    fromISO: shared?.fromISO ?? localBounds.fromISO,
    toISO: shared?.toISO ?? localBounds.toISO,
    valid: shared?.valid ?? localBounds.valid,
    setRange: (next: DateRange) => shared ? shared.setPeriod({
      from: next.from ? day(next.from) : "", to: next.to ? day(next.to) : "",
    }) : setLocal(next),
  };
}

export function ReportingPeriodControls() {
  const period = useOptionalReportingPeriod();
  const { locale } = useI18n();
  const copy = reportingTranslations[locale];
  if (!period) return null;
  return <section data-testid="reporting-period" className="mission-funnel-report rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
    <div className="mb-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{copy.period}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{copy.sharedPeriodHint}</p>
    </div>
    <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label={copy.period}>
      {reportingPresets.map(preset => <button key={preset} type="button"
        data-testid={`reporting-preset-${preset}`} aria-pressed={period.preset === preset}
        onClick={() => period.applyPreset(preset)}
        className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${period.preset === preset ? "border-teal-700/40 bg-teal-700/10 text-teal-900 dark:border-teal-300/40 dark:text-teal-200" : "border-border bg-background hover:bg-muted"}`}>
        {copy[preset]}
      </button>)}
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div data-testid="mission-funnel-from-wrapper">
        <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{copy.from}</span>
        <TaskCreateDatePicker value={period.from} onChange={period.setFrom} locale={locale} label={copy.from} clearLabel={copy.clearDate} pastYears={30} />
      </div>
      <div data-testid="mission-funnel-to-wrapper">
        <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{copy.to}</span>
        <TaskCreateDatePicker value={period.to} onChange={period.setTo} locale={locale} label={copy.to} clearLabel={copy.clearDate} pastYears={30} />
      </div>
    </div>
    {!period.valid && <p role="alert" className="mt-3 text-sm text-destructive">{copy.invalidRange}</p>}
  </section>;
}
