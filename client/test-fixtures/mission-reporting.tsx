import { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, useI18n } from "../src/i18n/I18nProvider";
import MissionFunnelReport from "../src/components/campaigns/MissionFunnelReport";
import CampaignAgentProductivity from "../src/components/campaigns/CampaignAgentProductivity";
import CampaignDataQuality from "../src/components/campaigns/CampaignDataQuality";
import CampaignClinicKPIs from "../src/components/campaigns/CampaignClinicKPIs";
import CampaignHospitalPlan from "../src/components/campaigns/CampaignHospitalPlan";
import CampaignCommunicationReview from "../src/components/campaigns/CampaignCommunicationReview";
import CampaignKpiSnapshots from "../src/components/campaigns/CampaignKpiSnapshots";
import { ReportingNavigation, type ReportingReport, type ReportingRoot } from "../src/components/campaigns/ReportingNavigation";
import { ReportingPeriodProvider, ReportingPeriodControls } from "../src/components/campaigns/reporting-period";
import { useStatusListReport } from "../src/components/campaigns/use-status-list-report";
import "../src/index.css";

// Development-only composition of production reporting components, with API
// interception in Playwright; not an application route or authentication bypass.
const params = new URLSearchParams(location.search);
if (params.has("dark")) document.documentElement.classList.add("dark");
function StatusListProbe() {
  const { query, exportUrl } = useStatusListReport<{ totalContacts: number }>("fixture-mission");
  return <section><output data-testid="status-list-result">{query.data?.totalContacts ?? 0}</output><a href={exportUrl} data-testid="status-list-export">CSV</a></section>;
}
function Reports() {
  const { t } = useI18n();
  const [missionId, setMissionId] = useState("fixture-mission");
  const [root, setRoot] = useState<ReportingRoot>("mission-funnel");
  const [active, setActive] = useState<ReportingReport>("report-mission-funnel");
  return <ReportingPeriodProvider campaignId={missionId}>
    <button data-testid="fixture-change-mission" onClick={() => setMissionId("second-mission")}>Change Mission</button>
    <ReportingPeriodControls />
    <ReportingNavigation rootValue={root} activeReport={active} copy={t.missionReporting}
      onRootChange={next => { setRoot(next); setActive(next === "overview" ? "report-overview" : "report-mission-funnel"); }}
      onReportChange={setActive} />
    <div data-testid="reporting-active-report">
      {active === "report-mission-funnel" && <MissionFunnelReport campaignId={missionId} />}
      {active === "report-productivity" && <CampaignAgentProductivity campaignId={missionId} />}
      {active === "report-data-quality" && <CampaignDataQuality campaignId={missionId} />}
      {active === "report-clinic-kpis" && <CampaignClinicKPIs campaignId={missionId} />}
      {active === "report-hospital-plan" && <CampaignHospitalPlan campaignId={missionId} />}
      {active === "report-comm-review" && <CampaignCommunicationReview campaignId={missionId} />}
      {active === "report-kpi-snapshots" && <CampaignKpiSnapshots campaignId={missionId} />}
      {active === "report-status-list" && <StatusListProbe />}
    </div>
  </ReportingPeriodProvider>;
}
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}><I18nProvider>
    <main className="mx-auto min-h-screen max-w-7xl space-y-4 bg-background p-4 text-foreground"><Reports /></main>
  </I18nProvider></QueryClientProvider>,
);
