import type { AgentFunnelResult, MissionFunnelReport, FunnelStep } from "../../../../shared/mission-funnel";
import type { MissionFunnelCopy } from "@/i18n/mission-funnel-translations";
import type { MissionAgentFunnelTranslation } from "./mission-agent-funnel-translations";
import type { FunnelExportTable } from "./mission-funnel-export";
import { exportDate, type ExportCell } from "./mission-export-value";

export type AgentFunnelExportMode = "cohort" | "contribution";
export type AgentFunnelExportFilters = { from: string; to: string; referral: "all" | "yes" | "no" };
const steps: FunnelStep[] = [
  "dialed", "connected", "qualified", "agreed", "wantsContract", "email", "wantsToSign", "sent",
  "received", "returned", "validated", "withoutContract", "cooperating", "materials",
];

const labelAgent = (agent: AgentFunnelResult, unknown: string) => agent.agentName || unknown;

/** Builds the complete, unsearched export for the selected view from the report snapshot. */
export function makeAgentFunnelExport(
  report: MissionFunnelReport,
  mode: AgentFunnelExportMode,
  filters: AgentFunnelExportFilters,
  copy: MissionFunnelCopy,
  labels: MissionAgentFunnelTranslation,
  options: { step?: FunnelStep; agentId?: string | null; includeStepSheets?: boolean } = {},
): FunnelExportTable[] {
  const results = (report.agentComparison?.[mode] ?? []).filter(agent =>
    !Object.prototype.hasOwnProperty.call(options, "agentId") || agent.agentId === options.agentId);
  const selectedSteps = options.step ? steps.filter(step => step === options.step) : steps;
  const namesById = new Map<string, string>();
  for (const view of [report.agentComparison?.cohort ?? [], report.agentComparison?.contribution ?? []]) {
    for (const agent of view) if (agent.agentId && agent.agentName) namesById.set(agent.agentId, agent.agentName);
  }
  const proofAuthor = (member: AgentFunnelResult["rows"][number]["members"][number]) => {
    if (member.inferred || (member.basis !== "call" && member.basis !== "history") || !member.actorId) return labels.unknownProofAuthor;
    return namesById.get(member.actorId) ?? labels.unknownProofAuthor;
  };
  const metricHeaders = [
    labels.agent, labels.clinicCount, labels.stage, labels.total, labels.direct, labels.inferred,
    `${copy.previous} (%)`, `${copy.qualified} (%)`, `${labels.missionShare} (%)`,
    `${labels.cohortRateBasis} (%)`,
  ];
  const summaryRows: (string | number)[][] = [
    [labels.mode, mode === "cohort" ? labels.cohortLabel : labels.contributionLabel],
    ...(options.step ? [[labels.stage, copy.stepLabels[options.step]]] : []),
    metricHeaders,
  ];
  for (const agent of results) {
    for (const step of selectedSteps) {
      const metric = agent.rows.find(row => row.key === step);
      if (!metric) continue;
      const called = agent.rows.find(row => row.key === "dialed")?.total ?? null;
      summaryRows.push([
        labelAgent(agent, labels.unknownAgent),
        agent.clinicCount,
        copy.stepLabels[step],
        metric.total ?? labels.unmeasured,
        metric.direct ?? labels.unmeasured,
        metric.inferred ?? labels.unmeasured,
        metric.previousPercent ?? labels.unmeasured,
        metric.qualifiedPercent ?? labels.unmeasured,
        metric.missionPercent ?? labels.unmeasured,
        mode === "cohort" && metric.total !== null && called !== null && called > 0
          ? metric.total / called * 100 : labels.unmeasured,
      ]);
    }
  }
  const evidenceRows: ExportCell[][] = [
    [labels.agent, labels.stage, copy.clinic, labels.firstDate, labels.evidenceDate, labels.basis, labels.proofAuthor, labels.inferredEvidence],
    ...results.flatMap(agent => agent.rows
      .filter(metric => selectedSteps.includes(metric.key))
      .flatMap(metric => metric.members.map(member => [
        labelAgent(agent, labels.unknownAgent),
        copy.stepLabels[metric.key],
        member.name,
        exportDate(member.firstDate),
        exportDate(member.evidenceDate),
        copy.basisLabels[member.basis] ?? member.basis,
        proofAuthor(member),
        member.inferred ? copy.yes : copy.no,
      ]))),
  ];
  const metadataRows: ExportCell[][] = [
    [labels.mode, mode === "cohort" ? labels.cohortLabel : labels.contributionLabel],
    [copy.title, report.missionName],
    [labels.from, exportDate(filters.from) || labels.allTime],
    [labels.to, exportDate(filters.to) || labels.allTime],
    [labels.referral, filters.referral === "yes" ? copy.referralYes : filters.referral === "no" ? copy.referralNo : copy.referralAll],
    [labels.generated, exportDate(report.generatedAt)],
    [labels.timezone, report.timezone],
    ...(options.step ? [[labels.stage, copy.stepLabels[options.step]]] : []),
    ...(Object.prototype.hasOwnProperty.call(options, "agentId")
      ? [[labels.agent, results[0] ? labelAgent(results[0], labels.unknownAgent) : labels.unknownAgent]] : []),
    ...labels.helpParagraphs.map((paragraph, index) => [`${labels.helpTitle} ${index + 1}`, paragraph]),
  ];
  const tables: FunnelExportTable[] = [
    { name: labels.summarySheet, rows: summaryRows },
    { name: labels.evidenceSheet, rows: evidenceRows },
    { name: labels.metadataSheet, rows: metadataRows },
  ];
  if (!options.step && options.includeStepSheets !== false) {
    for (const step of steps) tables.push({
      name: copy.stepLabels[step],
      rows: [evidenceRows[0], ...evidenceRows.slice(1).filter(row => row[1] === copy.stepLabels[step])],
    });
  }
  return tables;
}
