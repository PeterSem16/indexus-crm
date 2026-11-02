import type { MissionFunnelReport, FunnelMember, FunnelStep, FunnelException } from "../../../../shared/mission-funnel";
import type { MissionFunnelCopy } from "@/i18n/mission-funnel-translations";
import type { FunnelExportCopy } from "@/i18n/mission-funnel-export-translations";
import { exportDate, exportCellText, type ExportCell } from "./mission-export-value";
import { makeAgentFunnelExport } from "./mission-agent-funnel-export";
import { agentFunnelTranslations } from "./mission-agent-funnel-translations";

type Cell = ExportCell;
export interface FunnelExportTable { name: string; rows: Cell[][] }
export function buildFunnelExport(report: MissionFunnelReport, copy: MissionFunnelCopy, labels: FunnelExportCopy,
  filters: { from: string; to: string; referral: "all" | "yes" | "no" },
  options: { step?: FunnelStep; exception?: FunnelException; locale?: string } = {}): FunnelExportTable[] {
  const count = (value: number | null) => value ?? copy.unmeasured;
  const locale = options.locale as keyof typeof agentFunnelTranslations;
  const agentLabels = agentFunnelTranslations[locale] ?? agentFunnelTranslations.en;
  const authors = new Map<string, string>();
  for (const view of [report.agentComparison?.cohort ?? [], report.agentComparison?.contribution ?? []])
    for (const agent of view) if (agent.agentId && agent.agentName) authors.set(agent.agentId, agent.agentName);
  const memberHeader = [copy.step, copy.clinic, copy.firstDate, copy.evidenceDate, copy.basis, copy.inferredLabel, copy.returnDate, agentLabels.proofAuthor];
  const member = (label: string, item: FunnelMember): Cell[] => [
    label, item.name, exportDate(item.firstDate), exportDate(item.evidenceDate),
    copy.basisLabels[item.basis] ?? item.basis, item.inferred ? copy.yes : copy.no, exportDate(item.returnDate),
    !item.inferred && (item.basis === "call" || item.basis === "history") && item.actorId
      ? authors.get(item.actorId) ?? agentLabels.unknownProofAuthor : agentLabels.unknownProofAuthor,
  ];
  const qualityKeys = ["clinics", "cohort", "withoutAttempt", "provisional", "orphanCalls", "duplicateEnrollments", "stateOnly", "unknownProposal"] as const;
  const rows = options.step ? report.rows.filter(row => row.key === options.step) : report.rows;
  const exceptions = options.exception ? report.exceptions.filter(row => row.key === options.exception) : report.exceptions;
  const tables: FunnelExportTable[] = [
    { name: labels.metadata, rows: [
      [labels.field, labels.value], [copy.title, report.missionName], ["INDEXUS · REPORTING", report.version],
      [copy.from, exportDate(filters.from) || labels.allTime], [copy.to, exportDate(filters.to) || labels.allTime],
      [copy.referral, filters.referral === "yes" ? copy.referralYes : filters.referral === "no" ? copy.referralNo : copy.referralAll],
      [copy.generated, exportDate(report.generatedAt)], [copy.timezone, report.timezone],
      ...(options.step ? [[copy.step, copy.stepLabels[options.step]]] : []),
      [copy.assignedNote], [copy.refusedWindow], [copy.unreachableRule],
      [copy.firstDialCaveat], [copy.firstCallHelp], [copy.missingDateHelp], [copy.inferenceHelp],
      [copy.configurationSavedNote],
      ...Object.entries(report.config.sources).map(([source, ids]) => [
        copy.sourceLabels[source as keyof typeof copy.sourceLabels],
        ids.map(id => report.items.find(item => item.id === id)?.label ?? copy.unmeasured).join("; ") || copy.unmeasured,
      ]),
    ] },
    { name: labels.summary, rows: [
      [copy.step, copy.total, copy.direct, copy.inferred, `${copy.previous} (%)`, `${copy.qualified} (%)`],
      ...rows.map(row => [copy.stepLabels[row.key], count(row.total), count(row.direct), count(row.inferred), count(row.previousPercent), count(row.qualifiedPercent)]),
    ] },
    { name: labels.evidence, rows: [memberHeader, ...rows.flatMap(row => row.members.map(item => member(copy.stepLabels[row.key], item)))] },
    { name: labels.exceptions, rows: [
      [copy.exceptions, copy.total],
      ...exceptions.map(row => [copy.exceptionLabels[row.key], row.measurable ? row.members.length : copy.unmeasured]),
      [], memberHeader, ...exceptions.flatMap(row => row.members.map(item => member(copy.exceptionLabels[row.key], item))),
    ] },
    { name: labels.quality, rows: [[copy.noPeriodAssigned], [labels.field, labels.value], ...qualityKeys.map(key => [copy[key], report.quality[key]])] },
  ];
  if (options.step || options.exception) return options.exception
    ? [tables[0], tables[3]] : tables.slice(0, 3);
  for (const row of report.rows) tables.push({
    name: copy.stepLabels[row.key],
    rows: [memberHeader, ...row.members.map(item => member(copy.stepLabels[row.key], item))],
  });
  if (report.agentComparison) {
    for (const mode of ["cohort", "contribution"] as const) {
      const modeLabel = mode === "cohort" ? agentLabels.cohortLabel : agentLabels.contributionLabel;
      tables.push(...makeAgentFunnelExport(report, mode, filters, copy, agentLabels, { includeStepSheets: false })
        .map(table => ({ ...table, name: `${modeLabel} · ${table.name}` })));
    }
  }
  return tables;
}

/** Quote every CSV cell and neutralize spreadsheet formula execution in text. */
export function funnelExportCsv(tables: FunnelExportTable[]) {
  const cell = (value: Cell) => {
    const text = typeof value === "string" && /^[\s\uFEFF]*[=+\-@]/.test(value) ? `'${value}` : exportCellText(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  return "\uFEFF" + tables.flatMap(table => [[table.name], ...table.rows, []])
    .map(row => row.map(cell).join(";")).join("\r\n");
}
export async function funnelExportXlsx(tables: FunnelExportTable[]) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  for (const [index, table] of tables.entries()) {
    const sheet = XLSX.utils.aoa_to_sheet(table.rows.map(row => row.map(value =>
      typeof value === "object" ? { t: "n", v: value.value, z: value.format } : value)));
    const widths: { wch: number }[] = [];
    for (const row of table.rows) for (const [column, value] of row.entries()) {
      widths[column] = { wch: Math.min(65, Math.max(widths[column]?.wch ?? 14, exportCellText(value).length + 2)) };
    }
    sheet["!cols"] = widths;
    XLSX.utils.book_append_sheet(workbook, sheet, `${index + 1} ${table.name}`.replace(/[\\/?*[\]:]/g, "").slice(0, 31));
  }
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}
export function funnelExportFilename(campaignId: string, filters: { from: string; to: string; referral: string }) {
  return `mission-funnel_${campaignId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80)}_${filters.from || "all"}_${filters.to || "all"}_${filters.referral}`;
}
