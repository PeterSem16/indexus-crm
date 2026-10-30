import type { MissionFunnelReport, FunnelMember } from "../../../../shared/mission-funnel";
import type { MissionFunnelCopy } from "@/i18n/mission-funnel-translations";
import type { FunnelExportCopy } from "@/i18n/mission-funnel-export-translations";

type Cell = string | number;
export interface FunnelExportTable { name: string; rows: Cell[][] }
export function buildFunnelExport(report: MissionFunnelReport, copy: MissionFunnelCopy, labels: FunnelExportCopy,
  filters: { from: string; to: string; referral: "all" | "yes" | "no" }): FunnelExportTable[] {
  const count = (value: number | null) => value ?? copy.unmeasured;
  const memberHeader = [copy.step, labels.clinicId, copy.clinic, copy.firstDate, copy.evidenceDate, copy.basis, copy.inferredLabel, copy.returnDate];
  const member = (label: string, item: FunnelMember): Cell[] => [
    label, item.id, item.name, item.firstDate ?? "", item.evidenceDate ?? "",
    copy.basisLabels[item.basis] ?? item.basis, item.inferred ? copy.yes : copy.no, item.returnDate ?? "",
  ];
  const qualityKeys = ["clinics", "cohort", "withoutAttempt", "provisional", "orphanCalls", "duplicateEnrollments", "stateOnly", "unknownProposal"] as const;
  return [
    { name: labels.metadata, rows: [
      [labels.field, labels.value], [copy.title, report.missionName], ["INDEXUS · REPORTING", report.version],
      [copy.from, filters.from || labels.allTime], [copy.to, filters.to || labels.allTime],
      [copy.referral, filters.referral === "yes" ? copy.referralYes : filters.referral === "no" ? copy.referralNo : copy.referralAll],
      [copy.generated, report.generatedAt], [copy.timezone, report.timezone],
      [copy.assignedNote], [copy.refusedWindow], [copy.unreachableRule],
      [copy.firstDialCaveat], [copy.firstCallHelp], [copy.missingDateHelp], [copy.inferenceHelp],
      [copy.configurationSavedNote],
      ...Object.entries(report.config.sources).map(([source, ids]) => [
        copy.sourceLabels[source as keyof typeof copy.sourceLabels],
        ids.map(id => report.items.find(item => item.id === id)?.label ?? id).join("; ") || copy.unmeasured,
      ]),
    ] },
    { name: labels.summary, rows: [
      [copy.step, copy.total, copy.direct, copy.inferred, `${copy.previous} (%)`, `${copy.qualified} (%)`],
      ...report.rows.map(row => [copy.stepLabels[row.key], count(row.total), count(row.direct), count(row.inferred), count(row.previousPercent), count(row.qualifiedPercent)]),
    ] },
    { name: labels.evidence, rows: [memberHeader, ...report.rows.flatMap(row => row.members.map(item => member(copy.stepLabels[row.key], item)))] },
    { name: labels.exceptions, rows: [
      [copy.exceptions, copy.total],
      ...report.exceptions.map(row => [copy.exceptionLabels[row.key], row.measurable ? row.members.length : copy.unmeasured]),
      [], memberHeader, ...report.exceptions.flatMap(row => row.members.map(item => member(copy.exceptionLabels[row.key], item))),
    ] },
    { name: labels.quality, rows: [[copy.noPeriodAssigned], [labels.field, labels.value], ...qualityKeys.map(key => [copy[key], report.quality[key]])] },
  ];
}

/** Quote every CSV cell and neutralize spreadsheet formula execution in text. */
export function funnelExportCsv(tables: FunnelExportTable[]) {
  const cell = (value: Cell) => {
    const text = typeof value === "string" && /^[\s\uFEFF]*[=+\-@]/.test(value) ? `'${value}` : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  return "\uFEFF" + tables.flatMap(table => [[table.name], ...table.rows, []])
    .map(row => row.map(cell).join(";")).join("\r\n");
}
export async function funnelExportXlsx(tables: FunnelExportTable[]) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  for (const [index, table] of tables.entries()) {
    const sheet = XLSX.utils.aoa_to_sheet(table.rows);
    const widths: { wch: number }[] = [];
    for (const row of table.rows) for (const [column, value] of row.entries()) {
      widths[column] = { wch: Math.min(65, Math.max(widths[column]?.wch ?? 14, String(value).length + 2)) };
    }
    sheet["!cols"] = widths;
    XLSX.utils.book_append_sheet(workbook, sheet, `${index + 1} ${table.name}`.replace(/[\\/?*[\]:]/g, "").slice(0, 31));
  }
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}
export function funnelExportFilename(campaignId: string, filters: { from: string; to: string; referral: string }) {
  return `mission-funnel_${campaignId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80)}_${filters.from || "all"}_${filters.to || "all"}_${filters.referral}`;
}
