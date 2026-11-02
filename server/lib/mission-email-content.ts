import type { MissionFunnelReport } from "../../shared/mission-funnel";
import { missionEmailPeriod, missionWallClock, type MissionEmailOptions } from "../../shared/mission-email-schedule";
import { missionFunnelTranslations } from "../../client/src/i18n/mission-funnel-translations";
import type { MissionPerformanceRow } from "./mission-report-sources";

export const copies = {
  en: ["Mission summary", "New funnel milestones", "Agent performance", "Agent", "New calls", "Repeat calls", "Emails", "SMS", "Tasks", "Talk time", "Ring time", "Total time", "Dated attainments", "Without a reliable date", "Funnel counts first direct attainments in this period, not first-call cohorts. Undated or inferred attainments are excluded. Agent performance counts activity performed in the period.", "No activity", "Period"],
  sk: ["Súhrn Mission", "Nové dosiahnutia vo funneli", "Výkon agentov", "Agent", "Nové hovory", "Opakované hovory", "E-maily", "SMS", "Úlohy", "Čas hovoru", "Čas zvonenia", "Celkový čas", "Dosiahnutia s dátumom", "Bez spoľahlivého dátumu", "Funnel počíta prvé priame dosiahnutia v období, nie kohorty podľa prvého hovoru. Nedatované a odvodené dosiahnutia sú vylúčené. Výkon agentov počíta činnosť vykonanú v danom období.", "Bez aktivity", "Obdobie"],
  cs: ["Souhrn Mission", "Nová dosažení ve funnelu", "Výkon agentů", "Agent", "Nové hovory", "Opakované hovory", "E-maily", "SMS", "Úkoly", "Doba hovoru", "Doba vyzvánění", "Celkový čas", "Dosažení s datem", "Bez spolehlivého data", "Funnel počítá první přímá dosažení v období, nikoli kohorty podle prvního hovoru. Nedatovaná a odvozená dosažení jsou vyloučena. Výkon agentů počítá činnost provedenou v daném období.", "Bez aktivity", "Období"],
  hu: ["Mission összefoglaló", "Új tölcsérmérföldkövek", "Ügynöki teljesítmény", "Ügynök", "Új hívások", "Ismételt hívások", "E-mailek", "SMS", "Feladatok", "Beszédidő", "Csengési idő", "Teljes idő", "Dátumozott eredmények", "Megbízható dátum nélkül", "A tölcsér az időszak első közvetlen eredményeit számolja, nem az első hívás szerinti csoportokat. A dátum nélküli és következtetett eredmények kimaradnak. Az ügynöki teljesítmény az időszakban végzett tevékenységet mutatja.", "Nincs tevékenység", "Időszak"],
  ro: ["Rezumat Mission", "Etape noi în pâlnie", "Performanța agenților", "Agent", "Apeluri noi", "Apeluri repetate", "E-mailuri", "SMS", "Sarcini", "Timp de convorbire", "Timp de sonerie", "Timp total", "Realizări datate", "Fără dată sigură", "Pâlnia numără primele realizări directe din perioadă, nu cohortele după primul apel. Realizările nedatate și deduse sunt excluse. Performanța agenților măsoară activitatea efectuată în perioadă.", "Fără activitate", "Perioadă"],
  it: ["Riepilogo Mission", "Nuovi traguardi del funnel", "Prestazioni degli agenti", "Agente", "Nuove chiamate", "Chiamate ripetute", "Email", "SMS", "Attività", "Tempo di conversazione", "Tempo di squillo", "Tempo totale", "Traguardi datati", "Senza data attendibile", "Il funnel conta i primi traguardi diretti del periodo, non le coorti della prima chiamata. I traguardi senza data o dedotti sono esclusi. Le prestazioni degli agenti misurano le attività svolte nel periodo.", "Nessuna attività", "Periodo"],
  de: ["Mission-Zusammenfassung", "Neue Funnel-Meilensteine", "Agentenleistung", "Agent", "Neue Anrufe", "Wiederholte Anrufe", "E-Mails", "SMS", "Aufgaben", "Gesprächszeit", "Klingelzeit", "Gesamtzeit", "Datierte Ergebnisse", "Ohne zuverlässiges Datum", "Der Funnel zählt erste direkte Ergebnisse im Zeitraum, nicht Kohorten nach dem ersten Anruf. Undatierte und abgeleitete Ergebnisse sind ausgeschlossen. Die Agentenleistung zählt die im Zeitraum ausgeführten Aktivitäten.", "Keine Aktivität", "Zeitraum"],
} as const;
export const escapeMissionEmail = (value: unknown) => String(value ?? "").replace(/[&<>"']/g,
  char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const duration = (value: number) => {
  const seconds = Math.max(0, Math.round(Number(value) || 0));
  return `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
};
const displayDay = (day: string) => day.split("-").reverse().join(".");
/** Shared by HTML and Excel; never count inferred or undated evidence as dated. */
export function missionEmailFunnel(report: MissionFunnelReport, options: MissionEmailOptions, now = new Date()) {
  const copy = missionFunnelTranslations[options.locale];
  const period = missionEmailPeriod(options.frequency, now);
  return report.rows.filter(row => row.key !== "assigned").map(row => {
    let dated = 0, undated = 0;
    for (const member of row.members) {
      if (member.inferred) continue;
      let instant: Date | null = null;
      if (member.firstDate) {
        instant = /^\d{4}-\d{2}-\d{2}$/.test(member.firstDate)
          ? missionWallClock(member.firstDate, "00:00") : new Date(member.firstDate);
      }
      if (!instant || !Number.isFinite(instant.getTime())) undated++;
      else if (instant >= period.start && instant < period.end) dated++;
    }
    return [copy.stepLabels[row.key], row.total === null ? copy.unmeasured : dated, row.total === null ? copy.unmeasured : undated];
  });
}
export function renderMissionEmail(report: MissionFunnelReport, activity: MissionPerformanceRow[], options: MissionEmailOptions, now = new Date()) {
  const text = copies[options.locale], copy = missionFunnelTranslations[options.locale];
  const period = missionEmailPeriod(options.frequency, now);
  const table = (headers: readonly string[], rows: unknown[][]) => `<table role="table" style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr>${headers.map(header => `<th style="text-align:left;padding:9px;border-bottom:2px solid #d8e1e7">${escapeMissionEmail(header)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td style="padding:8px;border-bottom:1px solid #e9eef2">${escapeMissionEmail(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const funnel = missionEmailFunnel(report, options, now);
  const subject = `INDEXUS · ${text[0]} · ${report.missionName} · ${displayDay(period.from)} – ${displayDay(period.to)}`.replace(/[\r\n]/g, " ");
  const performance = activity.map(row => [row.agentName || copy.unmeasured, row.newCalls, row.repeatCalls, row.emails, row.sms,
    row.nonstandardTasks, duration(row.talkSeconds), duration(row.ringSeconds), duration(row.totalSeconds)]);
  const html = `<!doctype html><html lang="${options.locale}"><head><meta charset="utf-8"></head><body style="margin:0;background:#f3f6f8;color:#172635;font-family:Arial,sans-serif"><main style="max-width:1050px;margin:24px auto;padding:28px;background:#fff;border-radius:12px"><p style="color:#087e8b;font-weight:bold">INDEXUS · REPORTING</p><h1 style="font-size:24px">${escapeMissionEmail(report.missionName)}</h1><p>${escapeMissionEmail(text[16])}: ${displayDay(period.from)} – ${displayDay(period.to)} · Europe/Bratislava</p><p style="font-size:13px;color:#536270">${escapeMissionEmail(text[14])}</p><h2 style="font-size:18px">${escapeMissionEmail(text[1])}</h2>${table([copy.step, text[12], text[13]], funnel)}<h2 style="font-size:18px;margin-top:28px">${escapeMissionEmail(text[2])}</h2>${performance.length ? table(text.slice(3, 12), performance) : `<p>${escapeMissionEmail(text[15])}</p>`}</main></body></html>`;
  return { subject, html, from: displayDay(period.from), to: displayDay(period.to), period };
}
