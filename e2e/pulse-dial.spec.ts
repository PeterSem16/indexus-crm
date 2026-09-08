import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const entryPoints = [
  {
    testId: "btn-call-from-canvas",
    source: "client/src/pages/agent-workspace.tsx",
  },
  {
    testId: "btn-quick-call",
    source: "client/src/pages/agent-workspace.tsx",
  },
  {
    testId: "btn-call-phone1",
    source: "client/src/components/clinic-form-wizard.tsx",
  },
  {
    testId: "btn-mobile-call-",
    selector: '[data-testid="btn-mobile-call-phone"]',
    source: "client/src/components/mobile-agent-workspace.tsx",
  },
] as const;

test("all NEXUS Pulse contact call actions dispatch while SIP is reconnecting", async ({
  page,
}) => {
  await page.goto("/test-fixtures/pulse-dial.html");
  await expect(page.getByTestId("sip-state")).toHaveText("reconnecting");

  for (let index = 0; index < entryPoints.length; index += 1) {
    const entryPoint = entryPoints[index];
    await page.locator(entryPoint.selector ?? `[data-testid="${entryPoint.testId}"]`).click();
    await expect
      .poll(() => page.evaluate(() => window.pulseDialRequests.length))
      .toBe(index + 1);
  }
});

test("a rejected central dial request produces a visible error response", async ({ page }) => {
  await page.goto("/test-fixtures/pulse-dial.html");
  await page.evaluate(() => {
    window.failNextPulseDial = true;
  });
  await page.getByTestId("btn-call-from-canvas").click();

  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveText("Dial request failed");
  expect(await page.evaluate(() => window.pulseDialRequests)).toEqual([]);
});

test("browser selectors remain wired through the registration-independent dispatcher", async () => {
  const workspace = await readFile("client/src/pages/agent-workspace.tsx", "utf8");
  expect(workspace).toContain("createPulseDialEntryPoints");
  expect(workspace).toContain("<PulseMainDialButton");
  expect(workspace).toContain("<PulseQuickDialButton");
  expect(workspace).toMatch(
    /<MobileAgentWorkspace[\s\S]{0,1200}onMakeCall=\{pulseDialEntryPoints\.mobile\}/,
  );
  expect(workspace).toMatch(
    /<CommunicationCanvas[\s\S]{0,1200}onMakeCall=\{pulseDialEntryPoints\.main\}[\s\S]{0,200}onClinicMakeCall=\{pulseDialEntryPoints\.clinic\}/,
  );
  expect(workspace).toMatch(
    /case "call":[\s\S]{0,500}requestPulseDial\(pulseDialEntryPoints\.quick, phoneToCall\)/,
  );
  expect(workspace).not.toMatch(/phoneToCall\s*&&\s*isSipRegistered/);
  expect(workspace).not.toMatch(/isSipRegistered\s*&&\s*onMakeCall/);

  const clinic = await readFile("client/src/components/clinic-form-wizard.tsx", "utf8");
  expect(clinic).toContain("<PulseClinicDialButton");

  const mobile = await readFile("client/src/components/mobile-agent-workspace.tsx", "utf8");
  expect(mobile).toContain("<PulseMobileDialButton");
  expect(mobile).not.toMatch(/disabled=\{!isSipRegistered\}/);
});