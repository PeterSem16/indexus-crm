import * as XLSX from "xlsx";
import type { MissionFunnelReport } from "../../shared/mission-funnel";
import { missionEmailPeriod, type MissionEmailOptions } from "../../shared/mission-email-schedule";
import { exportDate, exportDuration, type ExportCell } from "../../client/src/components/campaigns/mission-export-value";
import { missionFunnelTranslations } from "../../client/src/i18n/mission-funnel-translations";
import { copies, missionEmailFunnel } from "./mission-email-content";
import type { MissionPerformanceRow } from "./mission-report-sources";

export interface MissionEmailAttachment { name: string; contentType: string; contentBytes: string }
export function buildMissionEmailExcel(report: MissionFunnelReport, activity: MissionPerformanceRow[], options: MissionEmailOptions, now = new Date()): MissionEmailAttachment {
  const text = copies[options.locale], copy = missionFunnelTranslations[options.locale];
  const period = missionEmailPeriod(options.frequency, now);
  const workbook = XLSX.utils.book_new();
  const sheet = (name: string, rows: ExportCell[][], widths: number[]) => {
    const cells = rows.map(row => row.map(value => typeof value === "object"
      ? { t: "n" as const, v: value.value, z: value.format } : value));
    const result = XLSX.utils.aoa_to_sheet(cells);
    result["!cols"] = widths.map(wch => ({ wch }));
    XLSX.utils.book_append_sheet(workbook, result, name.slice(0, 31));
  };
  sheet(text[0], [
    ["INDEXUS", report.missionName],
    [text[16], exportDate(period.from), exportDate(period.to)],
    ["Europe/Bratislava", options.country],
    [text[14]],
  ], [48, 30, 25]);
  sheet(text[1], [[copy.step, text[12], text[13]], ...missionEmailFunnel(report, options, now)], [46, 25, 29]);
  sheet(text[2], [text.slice(3, 12) as unknown as string[], ...activity.map(row => [
    row.agentName || copy.unmeasured, row.newCalls, row.repeatCalls, row.emails, row.sms, row.nonstandardTasks,
    exportDuration(row.talkSeconds), exportDuration(row.ringSeconds), exportDuration(row.totalSeconds),
  ])], [32, 20, 20, 18, 14, 20, 22, 22, 22]);
  const buffer: Buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer", compression: true });
  // Inline Graph attachments must fit its small-message request limit.
  if (buffer.length > 2 * 1024 * 1024) throw new Error("Mission Excel attachment too large");
  return { name: `INDEXUS-Mission-${period.from}_${period.to}.xlsx`,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    contentBytes: buffer.toString("base64") };
}
