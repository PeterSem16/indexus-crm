import { db } from "./db";
import { scheduledReports, users, campaigns } from "@shared/schema";
import { eq, lte, and, inArray } from "drizzle-orm";
import { log } from "./index";

const countryTimezoneMap: Record<string, string> = {
  SK: 'Europe/Bratislava',
  CZ: 'Europe/Prague',
  HU: 'Europe/Budapest',
  RO: 'Europe/Bucharest',
  IT: 'Europe/Rome',
  DE: 'Europe/Berlin',
  US: 'America/New_York',
};

function getTimezoneForCountryCodes(countryCodes: string[] | null): string {
  if (!countryCodes || countryCodes.length === 0) return 'Europe/Bratislava';
  return countryTimezoneMap[countryCodes[0]] || 'Europe/Bratislava';
}

function localTimeToUtc(year: number, month: number, day: number, hours: number, minutes: number, timezone: string): Date {
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
  const utcGuess = new Date(dateStr + 'Z');
  const guessInTzStr = utcGuess.toLocaleString('en-US', { timeZone: timezone });
  const guessInTzLocal = new Date(guessInTzStr);
  const offsetMs = guessInTzLocal.getTime() - utcGuess.getTime();
  return new Date(utcGuess.getTime() - offsetMs);
}

export function computeNextRunAtUtc(sendTime: string, timezone: string): Date {
  const [hours, minutes] = sendTime.split(':').map(Number);
  const now = new Date();

  const nowInTzParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const parts: Record<string, string> = {};
  for (const p of nowInTzParts) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  const nowHour = parseInt(parts.hour, 10);
  const nowMinute = parseInt(parts.minute, 10);
  const nowYear = parseInt(parts.year, 10);
  const nowMonth = parseInt(parts.month, 10);
  const nowDay = parseInt(parts.day, 10);

  let targetYear = nowYear;
  let targetMonth = nowMonth;
  let targetDay = nowDay;

  if (hours < nowHour || (hours === nowHour && minutes <= nowMinute)) {
    const tomorrow = new Date(now.getTime() + 86400000);
    const tomorrowParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour12: false,
    }).formatToParts(tomorrow);
    const tp: Record<string, string> = {};
    for (const p of tomorrowParts) {
      if (p.type !== 'literal') tp[p.type] = p.value;
    }
    targetYear = parseInt(tp.year, 10);
    targetMonth = parseInt(tp.month, 10);
    targetDay = parseInt(tp.day, 10);
  }

  return localTimeToUtc(targetYear, targetMonth, targetDay, hours, minutes, timezone);
}

export function computeNextRunAfterExecution(sendTime: string, timezone: string, executedAt: Date): Date {
  const [hours, minutes] = sendTime.split(':').map(Number);

  const tomorrow = new Date(executedAt.getTime() + 86400000);

  const tomorrowParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour12: false,
  }).formatToParts(tomorrow);
  const tp: Record<string, string> = {};
  for (const p of tomorrowParts) {
    if (p.type !== 'literal') tp[p.type] = p.value;
  }

  return localTimeToUtc(parseInt(tp.year, 10), parseInt(tp.month, 10), parseInt(tp.day, 10), hours, minutes, timezone);
}

async function runDueReports() {
  try {
    const now = new Date();
    const dueReports = await db.select().from(scheduledReports)
      .where(and(
        eq(scheduledReports.enabled, true),
        lte(scheduledReports.nextRunAt, now)
      ));

    if (dueReports.length > 0) {
      log(`Found ${dueReports.length} due report(s) to process`, "scheduler");
    }

    for (const report of dueReports) {
      try {
        log(`Processing scheduled report ${report.id} for campaign ${report.campaignId} (sendTime: ${report.sendTime})`, "scheduler");

        const hasUsers = report.recipientUserIds && report.recipientUserIds.length > 0;
        const hasExternal = report.externalEmails && report.externalEmails.length > 0;
        if (!hasUsers && !hasExternal) {
          log(`Scheduled report ${report.id}: no recipients configured`, "scheduler");
          continue;
        }

        let recipientEmails: string[] = [];
        if (hasUsers) {
          const recipientUsers = await db.select({ id: users.id, email: users.email })
            .from(users)
            .where(inArray(users.id, report.recipientUserIds));
          recipientEmails.push(...recipientUsers.map(u => u.email).filter(Boolean));
        }
        if (hasExternal) {
          recipientEmails.push(...report.externalEmails!.filter(Boolean));
        }
        recipientEmails = [...new Set(recipientEmails)];
        if (recipientEmails.length === 0) {
          log(`Scheduled report ${report.id}: no valid recipient emails found`, "scheduler");
          continue;
        }

        log(`Scheduled report ${report.id}: sending to ${recipientEmails.join(', ')}`, "scheduler");

        const localDateStr = (d: Date) => {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${day}`;
        };

        let dateFrom: string;
        let dateTo: string;
        const today = new Date();
        if (report.dateRangeType === 'yesterday') {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          dateFrom = localDateStr(yesterday);
          dateTo = localDateStr(yesterday);
        } else if (report.dateRangeType === 'last7days') {
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          const yesterdayD = new Date(today);
          yesterdayD.setDate(yesterdayD.getDate() - 1);
          dateFrom = localDateStr(weekAgo);
          dateTo = localDateStr(yesterdayD);
        } else if (report.dateRangeType === 'last30days') {
          const monthAgo = new Date(today);
          monthAgo.setDate(monthAgo.getDate() - 30);
          const yesterdayD = new Date(today);
          yesterdayD.setDate(yesterdayD.getDate() - 1);
          dateFrom = localDateStr(monthAgo);
          dateTo = localDateStr(yesterdayD);
        } else {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          dateFrom = localDateStr(yesterday);
          dateTo = localDateStr(yesterday);
        }

        log(`Scheduled report ${report.id}: date range ${dateFrom} to ${dateTo}`, "scheduler");

        for (const reportType of report.reportTypes) {
          try {
            const response = await fetch(`http://localhost:${process.env.PORT || 5000}/api/campaigns/${report.campaignId}/reports/send-email`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-scheduled-report': 'true' },
              body: JSON.stringify({
                reportType,
                recipientEmails,
                dateFrom,
                dateTo,
              }),
            });
            if (response.ok) {
              log(`Scheduled report ${report.id}: sent ${reportType} successfully`, "scheduler");
            } else {
              const errorBody = await response.text();
              log(`Scheduled report ${report.id}: failed to send ${reportType}: ${response.status} ${response.statusText} - ${errorBody}`, "scheduler");
            }
          } catch (err) {
            log(`Scheduled report ${report.id}: error sending ${reportType}: ${err}`, "scheduler");
          }
        }

        let timezone = 'Europe/Bratislava';
        try {
          const [campaign] = await db.select({ countryCodes: campaigns.countryCodes })
            .from(campaigns)
            .where(eq(campaigns.id, report.campaignId!));
          if (campaign) {
            timezone = getTimezoneForCountryCodes(campaign.countryCodes);
          }
        } catch (e) {
          log(`Scheduled report ${report.id}: could not fetch campaign timezone, using default`, "scheduler");
        }

        const nextRun = computeNextRunAfterExecution(report.sendTime, timezone, now);
        log(`Scheduled report ${report.id}: next run at ${nextRun.toISOString()} (${report.sendTime} ${timezone})`, "scheduler");

        await db.update(scheduledReports).set({
          lastRunAt: now,
          nextRunAt: nextRun,
          updatedAt: now,
        }).where(eq(scheduledReports.id, report.id));

      } catch (err) {
        log(`Scheduled report ${report.id}: execution error: ${err}`, "scheduler");
      }
    }
  } catch (error) {
    log(`Scheduled report runner error: ${error}`, "scheduler");
  }
}

export function startScheduledReportRunner(intervalMs = 60 * 1000) {
  log("Scheduled report runner started (checking every 60s)", "scheduler");
  setInterval(runDueReports, intervalMs);
  setTimeout(runDueReports, 5000);
}
