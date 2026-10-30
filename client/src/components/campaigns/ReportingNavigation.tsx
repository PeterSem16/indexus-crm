import { BarChart3, Building2, ClipboardList, FileCheck2, Gauge, Hospital, ListChecks, MessageCircle, TrendingUp, Users } from "lucide-react";
import type { MissionReportingCopy } from "@/i18n/reporting-translations";
import "./reporting.css";

export type ReportingRoot = "overview" | "mission-funnel";
export type ReportingReport =
  | "report-overview"
  | "report-kpi"
  | "report-status-list"
  | "report-mission-funnel"
  | "report-productivity"
  | "report-data-quality"
  | "report-clinic-kpis"
  | "report-hospital-plan"
  | "report-comm-review"
  | "report-kpi-snapshots";

interface ReportingNavigationProps {
  rootValue: ReportingRoot;
  activeReport: ReportingReport;
  onRootChange: (root: ReportingRoot) => void;
  onReportChange: (report: ReportingReport) => void;
  copy: MissionReportingCopy;
}

const rootIds: Record<ReportingRoot, string> = {
  overview: "reporting-group-overview",
  "mission-funnel": "reporting-group-mission-funnel",
};

export function ReportingNavigation({
  rootValue,
  activeReport,
  onRootChange,
  onReportChange,
  copy,
}: ReportingNavigationProps) {
  const groups = {
    overview: [
      { key: "report-overview", label: copy.overviewSummary, icon: BarChart3 },
  { key: "report-kpi", label: copy.kpiTargets, icon: BarChart3 },
      { key: "report-status-list", label: copy.statusList, icon: ListChecks },
    ],
    "mission-funnel": [
      { key: "report-mission-funnel", label: copy.missionFunnel, icon: TrendingUp },
      { key: "report-productivity", label: copy.agentProductivity, icon: Gauge },
      { key: "report-data-quality", label: copy.dataQuality, icon: ClipboardList },
      { key: "report-clinic-kpis", label: copy.clinics, icon: Building2 },
      { key: "report-hospital-plan", label: copy.hospitals, icon: Hospital },
      { key: "report-comm-review", label: copy.communications, icon: MessageCircle },
      { key: "report-kpi-snapshots", label: copy.trends, icon: FileCheck2 },
    ],
  } satisfies Record<ReportingRoot, { key: ReportingReport; label: string; icon: typeof BarChart3 }[]>;

  return (
    <nav aria-label={copy.overview + " / " + copy.missionFunnel} className="space-y-3" data-testid="reporting-navigation">
      <div className="reporting-root-switch" role="group" aria-label={copy.overview + " / " + copy.missionFunnel}>
        <button
          type="button"
          className="reporting-root-button"
          aria-pressed={rootValue === "overview"}
          data-testid={rootIds.overview}
          onClick={() => onRootChange("overview")}
        >
          <BarChart3 className="h-4 w-4" />
          <span>{copy.overview}</span>
        </button>
        <button
          type="button"
          className="reporting-root-button"
          aria-pressed={rootValue === "mission-funnel"}
          data-testid={rootIds["mission-funnel"]}
          onClick={() => onRootChange("mission-funnel")}
        >
          <TrendingUp className="h-4 w-4" />
          <span>{copy.missionFunnel}</span>
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        {rootValue === "overview" ? copy.overviewDescription : copy.missionDescription}
      </p>

      <div className="reporting-child-grid" role="group" aria-label={rootValue === "overview" ? copy.overview : copy.missionFunnel}>
        {groups[rootValue].map(({ key, label, icon: Icon }) => {
          const testIdSuffix = key.replace("report-", "");
          return (
            <button
              key={key}
              type="button"
              className="reporting-child-button"
              aria-current={activeReport === key ? "page" : undefined}
              data-testid={`tab-${key}`}
              onClick={() => onReportChange(key)}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
              <span className="sr-only">, {testIdSuffix}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
