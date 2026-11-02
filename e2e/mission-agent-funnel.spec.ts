import { test, expect, type Page } from "@playwright/test";
import * as XLSX from "xlsx";
import { emptyFunnelConfig, funnelSources } from "../shared/mission-funnel";
import { computeMissionFunnel, type FunnelInput } from "../server/lib/mission-funnel";
import { computeMissionAgentFunnel } from "../server/lib/mission-agent-funnel";

const agents = [
  { id: "a", name: "Alpha" }, { id: "b", name: "Beta" }, { id: "c", name: "Gamma" }, { id: "zero", name: "Delta" },
];
function reportFixture(empty = false) {
  const config = emptyFunnelConfig();
  for (const key of funnelSources) config.sources[key] = [key];
  const input: FunnelInput = {
    config, items: funnelSources.map(id => ({ id, label: id, stepId: id, parentId: null })),
    clinics: [], enrollments: [], events: [], calls: [], states: [],
  };
  for (let i = 0; i < (empty ? 0 : 13); i++) {
    const clinicId = `clinic-${i}`, contactId = `contact-${i}`;
    input.clinics.push({ id: clinicId, name: `Clinic ${String(i).padStart(2, "0")}`, representativeId: "representative", referred: true });
    input.enrollments.push({ id: contactId, clinicId });
    input.calls.push({
      id: `call-${i}`, clinicId, contactId, actorId: i === 12 ? null : "a", direction: "outbound",
      status: "completed", at: "2026-09-01T10:00:00Z", attemptAt: "2026-09-01T10:00:00Z",
      answeredAt: "2026-09-01T10:00:05Z", duration: 30,
    });
    if (i === 12) {
      input.states.push(...["agreed", "proposalAccepted", "validated"].map(itemId => ({ contactId, itemId, at: "2026-09-04T10:00:00Z" })));
    } else {
      input.events.push(...["qualified", "agreed", "proposalAccepted", "validated"].map((itemId, index) => ({
        id: `${contactId}-${itemId}`, contactId, itemId, confirmed: true,
        at: `2026-09-0${index + 2}T10:00:00Z`, actorId: index === 3 ? "c" : "b",
      })));
    }
  }
  const computed = computeMissionFunnel(input);
  return { ...computed, agentComparison: computeMissionAgentFunnel(computed.rows, agents),
    missionName: "Agent Comparison Test", canConfigure: false };
}
async function fixture(page: Page, { locale = "en", dark = false, empty = false } = {}) {
  const calls: { method: string; url: string }[] = [], errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const report = reportFixture(empty);
  await page.route("**/api/**", route => {
    const request = route.request();
    calls.push({ method: request.method(), url: request.url() });
    return route.fulfill({ json: report });
  });
  await page.goto(`/test-fixtures/mission-funnel.html?locale=${locale}${dark ? "&dark" : ""}`);
  await expect(page.getByTestId("mission-agent-funnel")).toBeVisible();
  return { calls, errors, report };
}
function agentRow(page: Page, name: string) {
  return page.getByTestId("mission-agent-funnel-matrix").getByRole("row").filter({
    has: page.getByRole("button", { name, exact: true }),
  });
}

test("same report provides both attribution views, safe rates, unknown authors and read-only evidence", async ({ page }) => {
  const { calls, errors } = await fixture(page);
  const section = page.getByTestId("mission-agent-funnel");
  const alpha = agentRow(page, "Alpha");
  await expect(alpha).toBeVisible();
  await alpha.locator('[data-testid$="-cooperating"]').click();
  const evidence = page.getByTestId("mission-agent-funnel-evidence");
  await expect(evidence).toContainText("Alpha");
  await expect(evidence).toContainText("Clinic 00");
  await expect(evidence).toContainText("Gamma");
  await expect(evidence.locator("tbody tr")).toHaveCount(10);
  await page.getByTestId("mission-agent-funnel-next-page").click();
  await expect(evidence.locator("tbody tr")).toHaveCount(2);
  await page.getByTestId("mission-agent-funnel-clinic-search").fill("Clinic 05");
  await expect(evidence.locator("tbody tr")).toHaveCount(1);
  await expect(evidence).toContainText("Clinic 05");
  await page.getByTestId("mission-agent-funnel-tab-contribution").click();
  await expect(page.getByTestId("mission-agent-funnel-clinic-search")).not.toBeVisible();
  await agentRow(page, "Gamma").locator('[data-testid$="-cooperating"]').click();
  await expect(evidence).toContainText("Gamma");
  await expect(evidence).toContainText("92.3%");
  await expect(evidence).not.toContainText("vs previous");
  await expect(section).toContainText("Unknown caller / author");
  await expect(agentRow(page, "Delta")).toBeVisible();
  expect(calls.every(call => call.method === "GET")).toBe(true);
  expect(errors).toEqual([]);
});

test("selected cohort uses the real funnel and contribution does not imply sequential retention", async ({ page }) => {
  const { errors } = await fixture(page);
  const chart = page.getByTestId("mission-agent-funnel-selected-chart");
  await chart.locator("summary").click();
  await expect(chart.locator("svg").first()).toBeVisible();
  await chart.getByTestId("mission-funnel-chart-step-cooperating").click();
  await expect(page.getByTestId("mission-agent-funnel-evidence")).toContainText("Clinic 00");
  await page.getByTestId("mission-agent-funnel-tab-contribution").click();
  await expect(chart).not.toBeVisible();
  expect(errors).toEqual([]);
});

test("agent search and period switches preserve the server filters without writes", async ({ page }) => {
  const { calls, errors } = await fixture(page);
  const search = page.getByTestId("mission-agent-funnel-agent-search");
  await search.fill("Gamma");
  await expect(agentRow(page, "Gamma")).toBeVisible();
  await expect(agentRow(page, "Alpha")).not.toBeVisible();
  await page.getByTestId("reporting-preset-lastMonth").click();
  await expect(search).toHaveValue("");
  expect(calls.some(call => /[?&]from=\d{4}-\d{2}-\d{2}/.test(call.url))).toBe(true);
  expect(calls.every(call => call.method === "GET")).toBe(true);
  expect(errors).toEqual([]);
});

test("one download menu exports cohort/contribution metadata, counts and actual evidence as CSV/XLSX", async ({ page }) => {
  const { calls, errors } = await fixture(page);
  await page.getByTestId("mission-agent-funnel-download").click();
  const csvDownload = page.waitForEvent("download");
  await page.getByTestId("mission-agent-funnel-export-csv").click();
  const csv = await csvDownload;
  expect(csv.suggestedFilename()).toContain("_cohort.csv");
  const stream = (await csv.createReadStream())!;
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  expect(text).toContain("Alpha");
  expect(text).toContain("Gamma");
  expect(text).toContain("Clinic 00");
  expect(text).toContain("Europe/Bratislava");
  await page.getByTestId("mission-agent-funnel-tab-contribution").click();
  await expect(page.getByTestId("mission-agent-funnel-matrix")).toContainText("Gamma");
  await page.getByTestId("mission-agent-funnel-download").focus();
  await page.keyboard.press("Enter");
  const xlsxDownload = page.waitForEvent("download");
  await page.getByTestId("mission-agent-funnel-export-xlsx").click();
  const xlsx = await xlsxDownload;
  expect(xlsx.suggestedFilename()).toContain("_contribution.xlsx");
  const xlsxStream = (await xlsx.createReadStream())!;
  const bytes = [];
  for await (const chunk of xlsxStream) bytes.push(chunk);
  expect(Buffer.concat(bytes).subarray(0, 2).toString()).toBe("PK");
  expect(calls.every(call => call.method === "GET")).toBe(true);
  expect(errors).toEqual([]);
});

test("comparison, evidence and manual work on a short dark mobile screen without document overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 667 });
  const { errors } = await fixture(page, { locale: "sk", dark: true });
  await agentRow(page, "Alpha").locator('[data-testid$="-cooperating"]').click();
  await page.getByTestId("mission-agent-funnel-evidence").scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: "generated-artifacts/mission-funnel/agents-mobile-dark.jpg" });
  await page.getByTestId("mission-funnel-help").click();
  await page.getByTestId("mission-funnel-help-mobile-chapter").selectOption("agents");
  await expect(page.getByTestId("mission-funnel-help-content")).toContainText("agent");
  await page.keyboard.press("Escape");
  expect(errors).toEqual([]);
});

test("empty activity keeps zero distinct from unmeasured and offers no misleading success percentage", async ({ page }) => {
  const { errors } = await fixture(page, { empty: true });
  await agentRow(page, "Delta").locator('[data-testid$="-cooperating"]').click();
  const evidence = page.getByTestId("mission-agent-funnel-evidence");
  await expect(evidence).not.toContainText("100%");
  await expect(evidence.locator("tbody tr")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("agent comparison supports every configured report language", async ({ page }) => {
  for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"]) {
    const { errors } = await fixture(page, { locale });
    await page.getByTestId("mission-agent-funnel-tab-contribution").click();
    await expect(page.getByTestId("mission-agent-funnel-matrix")).toContainText("Gamma");
    if (locale !== "en") await expect(page.getByTestId("mission-agent-funnel")).not.toContainText("Clinic cohort");
    expect(errors).toEqual([]);
  }
});

test("explicit step and agent exports ignore matrix search and exclude clinic IDs", async ({ page }) => {
  const { errors, report } = await fixture(page);
  await page.getByTestId("mission-agent-funnel-export-step").selectOption("cooperating");
  await page.getByTestId("mission-agent-funnel-export-agent").selectOption("a");
  await page.getByTestId("mission-agent-funnel-agent-search").fill("no-such-agent");
  await page.getByTestId("mission-agent-funnel-download").click();
  const waiting = page.waitForEvent("download");
  await page.getByTestId("mission-agent-funnel-export-xlsx").click();
  const file = await waiting;
  expect(file.suggestedFilename()).toContain("_cohort_cooperating_agent.xlsx");
  const stream = (await file.createReadStream())!;
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const workbook = XLSX.read(Buffer.concat(chunks), { cellNF: true });
  expect(workbook.SheetNames).toHaveLength(3);
  const evidence = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[1]], { header: 1 }) as unknown[][];
  const expected = report.agentComparison!.cohort.find(agent => agent.agentId === "a")!.rows.find(row => row.key === "cooperating")!.members;
  expect(evidence).toHaveLength(expected.length + 1);
  expect(expected.length).toBeGreaterThan(10);
  expect(evidence.slice(1).every(row => row[0] === "Alpha")).toBe(true);
  expect(JSON.stringify(evidence)).not.toContain("Clinic ID");
  expect(JSON.stringify(evidence)).not.toContain('"clinic-');
  expect(errors).toEqual([]);
});
