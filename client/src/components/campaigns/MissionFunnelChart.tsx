import type { FunnelRow, FunnelStep } from "../../../../shared/mission-funnel";
import type { MissionFunnelCopy } from "@/i18n/mission-funnel-translations";

interface Props {
  rows: FunnelRow[];
  copy: MissionFunnelCopy;
  locale: string;
  selectedStep: FunnelStep | null;
  onSelectStep: (step: FunnelStep) => void;
}

const PRIMARY_PATH: FunnelStep[] = [
  "dialed", "connected", "qualified", "agreed", "wantsContract",
  "email", "wantsToSign", "sent", "received", "returned", "validated",
];
const STEPS_WITHOUT_CONTRACT: FunnelStep[] = ["withoutContract"];
const COMBINED_OUTCOMES: FunnelStep[] = ["cooperating", "materials"];
const COLORS = ["#3C7686", "#3C7686", "#4A8D9E", "#4A8D9E", "#61A9BD", "#61A9BD", "#71B7C8", "#71B7C8", "#8CCEDE", "#8CCEDE", "#8CCEDE"];
const SVG_WIDTH = 520;
const SVG_HEIGHT = 24;
const SVG_CENTER = SVG_WIDTH / 2;
const MAX_BAR_WIDTH = 480;

function formatCount(value: number | null, locale: string, unmeasured: string) {
  return value == null ? unmeasured : value.toLocaleString(locale);
}

function formatPercent(value: number | null, locale: string) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)}%`;
}

function FunnelStepButton({
  row,
  copy,
  locale,
  maxCount,
  color,
  selected,
  onSelect,
}: {
  row: FunnelRow;
  copy: MissionFunnelCopy;
  locale: string;
  maxCount: number;
  color: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const label = copy.stepLabels[row.key];
  const totalText = formatCount(row.total, locale, copy.unmeasured);
  const directText = formatCount(row.direct, locale, copy.unmeasured);
  const inferredText = formatCount(row.inferred, locale, copy.unmeasured);
  const totalWidth = row.total != null && row.total > 0 ? (row.total / maxCount) * MAX_BAR_WIDTH : 0;
  const patternId = `mission-funnel-unknown-${row.key}`;
  const ariaLabel = `${label}. ${copy.total}: ${totalText}. ${copy.direct}: ${directText}. ${copy.inferred}: ${inferredText}. ${copy.previous}: ${formatPercent(row.previousPercent, locale)}. ${copy.qualified}: ${formatPercent(row.qualifiedPercent, locale)}. ${copy.clickToDrilldown}`;

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={selected}
      onClick={onSelect}
      data-testid={`mission-funnel-chart-step-${row.key}`}
      data-value={row.total == null ? "unmeasured" : String(row.total)}
      className={`group block w-full rounded-lg border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4 ${
        selected ? "border-teal-700/50 bg-teal-700/[0.07] dark:border-teal-300/40 dark:bg-teal-300/[0.07]" : "border-transparent hover:border-border hover:bg-muted/35"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="font-semibold text-sm text-foreground">{label}</span>
        <span className="font-mono text-sm font-semibold tabular-nums text-foreground">{totalText}</span>
      </div>
      <svg className="mt-2 block h-6 w-full overflow-visible" viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <pattern id={patternId} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="8" height="8" fill="hsl(var(--muted))" />
            <line x1="0" y1="0" x2="0" y2="8" stroke="hsl(var(--muted-foreground))" strokeOpacity=".48" strokeWidth="2" />
          </pattern>
        </defs>
        <path d={`M${SVG_CENTER - MAX_BAR_WIDTH / 2},3 H${SVG_CENTER + MAX_BAR_WIDTH / 2} V21 H${SVG_CENTER - MAX_BAR_WIDTH / 2} Z`}
          fill="hsl(var(--muted) / .62)" />
        {row.total == null ? (
          <path d={`M${SVG_CENTER - MAX_BAR_WIDTH / 2},3 H${SVG_CENTER + MAX_BAR_WIDTH / 2} V21 H${SVG_CENTER - MAX_BAR_WIDTH / 2} Z`}
            fill={`url(#${patternId})`} stroke="hsl(var(--border))" strokeWidth="1" />
        ) : row.total === 0 ? (
          <line x1={SVG_CENTER} y1="2" x2={SVG_CENTER} y2="22" stroke="hsl(var(--muted-foreground))" strokeWidth="2" />
        ) : (
          <rect x={SVG_CENTER - totalWidth / 2} y="3" width={totalWidth} height="18" fill={color} />
        )}
      </svg>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] leading-snug text-muted-foreground sm:grid-cols-4">
        <span>{copy.direct}: <b className="font-mono font-medium tabular-nums text-foreground">{directText}</b></span>
        <span className="inline-flex items-center gap-1">
          <i aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-[2px] border border-[#3C7686]/50 bg-[repeating-linear-gradient(135deg,#3C7686_0_1px,transparent_1px_4px)]" />
          <span>{copy.inferred}: <b className="font-mono font-medium tabular-nums text-foreground">{inferredText}</b></span>
        </span>
        <span>{copy.previous}: <b className="font-mono font-medium tabular-nums text-foreground">{formatPercent(row.previousPercent, locale)}</b></span>
        <span>{copy.qualified}: <b className="font-mono font-medium tabular-nums text-foreground">{formatPercent(row.qualifiedPercent, locale)}</b></span>
      </div>
    </button>
  );
}

function FunnelSilhouetteStage({
  row,
  nextRow,
  copy,
  locale,
  maxCount,
  color,
  selected,
  onSelect,
}: {
  row: FunnelRow;
  nextRow?: FunnelRow;
  copy: MissionFunnelCopy;
  locale: string;
  maxCount: number;
  color: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const label = copy.stepLabels[row.key];
  const totalText = formatCount(row.total, locale, copy.unmeasured);
  const directText = formatCount(row.direct, locale, copy.unmeasured);
  const inferredText = formatCount(row.inferred, locale, copy.unmeasured);
  const topWidth = row.total != null && row.total > 0 ? row.total / maxCount * MAX_BAR_WIDTH : 0;
  const nextTotal = nextRow?.total;
  const bottomWidth = row.total != null && row.total > 0
    ? nextTotal == null ? topWidth : nextTotal / maxCount * MAX_BAR_WIDTH
    : 0;
  const patternId = `mission-funnel-stage-unknown-${row.key}`;
  const detailTitle = `${copy.direct}: ${directText} · ${copy.inferred}: ${inferredText} · ${copy.previous}: ${formatPercent(row.previousPercent, locale)} · ${copy.qualified}: ${formatPercent(row.qualifiedPercent, locale)}`;
  const ariaLabel = `${label}. ${copy.total}: ${totalText}. ${detailTitle}. ${copy.clickToDrilldown}`;

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={selected}
      title={detailTitle}
      onClick={onSelect}
      data-testid={`mission-funnel-chart-step-${row.key}`}
      data-value={row.total == null ? "unmeasured" : String(row.total)}
      className={`group grid w-full grid-cols-[minmax(78px,.9fr)_minmax(90px,1.7fr)_minmax(74px,.9fr)] items-stretch gap-2 rounded px-2 text-left transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[minmax(145px,1fr)_minmax(150px,2fr)_minmax(180px,1.2fr)] sm:gap-3 sm:px-3 ${
        selected ? "bg-teal-700/[0.08] dark:bg-teal-300/[0.08]" : "hover:bg-muted/45"
      }`}
    >
      <span className="min-w-0 self-center py-1">
        <span className="block break-words text-[11px] font-semibold leading-tight text-foreground sm:text-xs">{label}</span>
        <span className="mt-0.5 block font-mono text-[11px] font-semibold tabular-nums text-muted-foreground">{totalText}</span>
      </span>
      <svg className="block h-full min-h-9 w-full" viewBox={`0 0 ${SVG_WIDTH} 36`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <pattern id={patternId} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="8" height="8" fill="hsl(var(--muted) / .2)" />
            <line x1="0" y1="0" x2="0" y2="8" stroke="hsl(var(--muted-foreground))" strokeOpacity=".56" strokeWidth="2" />
          </pattern>
        </defs>
        {row.total == null ? (
          <path d={`M${SVG_CENTER - MAX_BAR_WIDTH / 2},0 H${SVG_CENTER + MAX_BAR_WIDTH / 2} V36 H${SVG_CENTER - MAX_BAR_WIDTH / 2} Z`}
            fill={`url(#${patternId})`} stroke="hsl(var(--border))" strokeWidth="1" />
        ) : row.total === 0 ? (
          <line x1={SVG_CENTER} y1="0" x2={SVG_CENTER} y2="36" stroke="hsl(var(--muted-foreground))" strokeWidth="1" strokeDasharray="2 3" />
        ) : (
          <path
            d={`M${SVG_CENTER - topWidth / 2},0 L${SVG_CENTER + topWidth / 2},0 L${SVG_CENTER + bottomWidth / 2},36 L${SVG_CENTER - bottomWidth / 2},36 Z`}
            fill={color}
          />
        )}
      </svg>
      <span className="min-w-0 self-center py-1 text-[9px] leading-tight text-muted-foreground sm:text-[10px]">
        <span className="block break-words">{copy.direct}: <b className="font-mono font-medium tabular-nums text-foreground">{directText}</b></span>
        <span className="block break-words">
          <i aria-hidden="true" className="mr-1 inline-block h-2 w-2 rounded-[2px] border border-[#3C7686]/50 bg-[repeating-linear-gradient(135deg,#3C7686_0_1px,transparent_1px_4px)] align-[-1px]" />
          {copy.inferred}: <b className="font-mono font-medium tabular-nums text-foreground">{inferredText}</b>
        </span>
      </span>
    </button>
  );
}

export default function MissionFunnelChart({ rows, copy, locale, selectedStep, onSelectStep }: Props) {
  const rowsByStep = new Map<FunnelStep, FunnelRow>(rows.map(row => [row.key, row] as const));
  const assigned = rowsByStep.get("assigned");
  const primaryRows = PRIMARY_PATH.map(step => rowsByStep.get(step)).filter((row): row is FunnelRow => Boolean(row));
  const branchRows = STEPS_WITHOUT_CONTRACT.map(step => rowsByStep.get(step)).filter((row): row is FunnelRow => Boolean(row));
  const combinedRows = COMBINED_OUTCOMES.map(step => rowsByStep.get(step)).filter((row): row is FunnelRow => Boolean(row));
  const maxCount = Math.max(1, ...rows
    .filter(row => row.key !== "assigned")
    .map(row => row.total)
    .filter((value): value is number => value != null));

  return (
    <section data-testid="mission-funnel-chart" aria-labelledby="mission-funnel-chart-heading" className="border-b border-border bg-card px-3 py-4 sm:px-5 sm:py-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 id="mission-funnel-chart-heading" className="text-sm font-semibold">{copy.chartTitle}</h3>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">{copy.chartIntro}</p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-muted-foreground" aria-label={copy.chartLegend}>
          <span className="inline-flex items-center gap-1.5"><i aria-hidden="true" className="h-3 w-3 rounded-sm bg-[#61A9BD]" />{copy.chartTotalLegend}</span>
          <span className="inline-flex items-center gap-1.5"><i aria-hidden="true" className="h-3 w-3 rounded-sm border border-muted-foreground/30 bg-[repeating-linear-gradient(135deg,hsl(var(--muted-foreground)/.65)_0_1px,hsl(var(--muted))_1px_4px)]" />{copy.chartUnknownLegend}</span>
          <span className="inline-flex items-center gap-1.5"><i aria-hidden="true" className="h-3 w-3 rounded-sm border border-[#3C7686]/50 bg-[repeating-linear-gradient(135deg,#3C7686_0_1px,transparent_1px_4px)]" />{copy.chartInferredLegend}</span>
        </div>
      </div>

      {assigned && (
        <div className="mb-4 rounded-lg border-2 border-dashed border-teal-700/35 bg-teal-700/[0.035] p-2 dark:border-teal-300/35 dark:bg-teal-300/[0.04]">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2 px-2 pt-1">
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-teal-900 dark:text-teal-200">{copy.chartAssignedCurrent}</p>
            <p className="text-[10px] text-muted-foreground">{copy.assignedNote}</p>
          </div>
          <FunnelStepButton row={assigned} copy={copy} locale={locale} maxCount={Math.max(1, assigned.total ?? 0)} color="#3C7686"
            selected={selectedStep === "assigned"} onSelect={() => onSelectStep("assigned")} />
        </div>
      )}

      <section className="rounded-lg border border-border/80 bg-background/45 p-2 sm:p-3" aria-label={copy.chartPrimaryPath}>
        <h4 className="mb-2 px-3 pt-1 text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">{copy.chartPrimaryPath}</h4>
        <div className="space-y-0">
          {primaryRows.map((row, index) => (
            <FunnelSilhouetteStage key={row.key} row={row} nextRow={primaryRows[index + 1]} copy={copy} locale={locale} maxCount={maxCount}
              color={COLORS[index] ?? COLORS[COLORS.length - 1]} selected={selectedStep === row.key}
              onSelect={() => onSelectStep(row.key)} />
          ))}
        </div>
      </section>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <section className="rounded-lg border border-border/80 bg-muted/15 p-2 sm:p-3" aria-label={copy.chartContractBranch}>
          <h4 className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">{copy.chartContractBranch}</h4>
          <div className="space-y-0.5">
            {branchRows.map(row => (
              <FunnelStepButton key={row.key} row={row} copy={copy} locale={locale} maxCount={maxCount} color="#61A9BD"
                selected={selectedStep === row.key} onSelect={() => onSelectStep(row.key)} />
            ))}
          </div>
        </section>
        <section className="rounded-lg border border-border/80 bg-muted/15 p-2 sm:p-3" aria-label={copy.chartCombinedOutcomes}>
          <h4 className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">{copy.chartCombinedOutcomes}</h4>
          <p className="px-3 pb-1 text-[11px] leading-relaxed text-muted-foreground">{copy.chartCombinedHelp}</p>
          <div className="space-y-0.5">
            {combinedRows.map(row => (
              <FunnelStepButton key={row.key} row={row} copy={copy} locale={locale} maxCount={maxCount} color="#8CCEDE"
                selected={selectedStep === row.key} onSelect={() => onSelectStep(row.key)} />
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
