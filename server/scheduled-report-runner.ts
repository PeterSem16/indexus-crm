import { db } from "./db";
import { scheduledReports, users } from "@shared/schema";
import { eq, lte, and } from "drizzle-orm";
import { log } from "./index";

async function runDueReports() {
  try {
    const now = new Date();
    const dueReports = await db.select().from(scheduledReports)
      .where(and(
        eq(scheduledReports.enabled, true),
        lte(scheduledReports.nextRunAt, now)
      ));

    for (const report of dueReports) {
      try {
        const recipientUsers = await db.select({ email: users.email })
          .from(users)
          .where(
            // @ts-ignore - inArray works with arrays
            require('drizzle-orm').inArray(users.id, report.recipientUserIds)
          );

        const recipientEmails = recipientUsers.map(u => u.email).filter(Boolean);
        if (recipientEmails.length === 0) {
          log(`Scheduled report ${report.id}: no valid recipient emails`, "scheduler");
          continue;
        }

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
              log(`Scheduled report ${report.id}: sent ${reportType} to ${recipientEmails.length} recipients`, "scheduler");
            } else {
              log(`Scheduled report ${report.id}: failed to send ${reportType}: ${response.statusText}`, "scheduler");
            }
          } catch (err) {
            log(`Scheduled report ${report.id}: error sending ${reportType}: ${err}`, "scheduler");
          }
        }

        const [hours, minutes] = report.sendTime.split(':').map(Number);
        const nextRun = new Date(now);
        nextRun.setDate(nextRun.getDate() + 1);
        nextRun.setHours(hours, minutes, 0, 0);

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
