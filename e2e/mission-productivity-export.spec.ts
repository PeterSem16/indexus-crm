import { test, expect } from "@playwright/test";
import * as XLSX from "xlsx";
import { readFile } from "node:fs/promises";

test("Agent Performance exports real Excel daily dates/durations and readable safe CSV", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const activity = { agentId: "internal-agent", agentName: "=AGENT()", avatarUrl: null,
    newCalls: 2, repeatCalls: 1, emails: 1, sms: 1, nonstandardTasks: 1, scheduledPending: 0, scheduledOverdue: 0,
    twSeconds: 3600, talkSeconds: 86400, ringSeconds: 61, totalSeconds: 90061, prevTotalSeconds: 0, trendPct: null };
  await page.route("**/api/**", async route => {
    const url = route.request().url();
    const body = url.includes("/agent-productivity/daily")
      ? [{ ...activity, day: "2026-09-01" }]
      : url.includes("/agent-productivity?") ? [activity] : [];
    await route.fulfill({ json: body });
  });
  await page.goto("/test-fixtures/mission-funnel.html?productivity=1");
  await expect(page.getByTestId("button-export-xlsx")).toBeEnabled();
  const excelWaiting = page.waitForEvent("download");
  await page.getByTestId("button-export-xlsx").click();
  const excel = await excelWaiting;
  const workbook = XLSX.read(await readFile((await excel.path())!), { cellNF: true });
  expect(workbook.SheetNames).toHaveLength(2);
  const summary = workbook.Sheets[workbook.SheetNames[0]], daily = workbook.Sheets[workbook.SheetNames[1]];
  expect(summary.K2.t).toBe("n");
  expect(summary.K2.z).toBe("[h]:mm:ss");
  expect(summary.K2.v).toBe(90061 / 86400);
  expect(summary.A2.f).toBeUndefined();
  expect(daily.B2.t).toBe("n");
  expect(daily.B2.z).toBe("dd.mm.yyyy");
  const csvWaiting = page.waitForEvent("download");
  await page.getByTestId("button-export-csv").click();
  const csv = await csvWaiting;
  const text = await readFile((await csv.path())!, "utf8");
  expect(text).toContain("25:01:01");
  expect(text).toContain("01.09.2026");
  expect(text).toContain("'=AGENT()");
  expect(text).not.toContain("internal-agent");
  expect(errors).toEqual([]);
});
