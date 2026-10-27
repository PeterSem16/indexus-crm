import { expect, test, type Page } from "@playwright/test";

const fixture = "/test-fixtures/status-list-recap.html";
const plan = {
  readOnly: true, mode: "immediate",
  actions: [{ id: "callback", sourceLabel: "Testovací krok", actionType: "set_callback", condition: "matched" }],
};

async function intercept(page: Page, preview: unknown = plan) {
  const writes: string[] = [];
  const requests: unknown[] = [];
  const commits: any[] = [];
  await page.route("**/api/**", async route => {
    const request = route.request();
    if (request.url().endsWith("/confirmation-preview")) {
      requests.push(request.postDataJSON());
      await route.fulfill({ json: preview });
    } else {
      if (!["GET", "HEAD"].includes(request.method())) writes.push(request.url());
      if (request.url().endsWith("/commit")) commits.push(request.postDataJSON());
      const path=new URL(request.url()).pathname;
      await route.fulfill({ json:path.endsWith("/status-list-workflows") ? {rules:[],catalog:[]} :
        path.endsWith("/sources") || path.endsWith("/option-sources") ? {sources:[],catalog:[],coordinators:[]} : [] });
    }
  });
  return { writes, requests, commits };
}

for (const mode of ["immediate", "batch"]) {
  test(`${mode}: opening and cancelling cannot commit callback changes`, async ({ page }) => {
    const captured = await intercept(page, { ...plan, mode });
    await page.goto(`${fixture}?mode=${mode}`);
    await page.getByTestId("review").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByTestId("status-list-recap-callback-date")).toContainText("18. júna 2027");
    await expect(dialog.getByTestId("status-list-recap-callback-date")).toContainText("14:30");
    await expect(dialog).toContainText("Poznámka ku callbacku");
    expect(captured.writes).toEqual([]);
    await dialog.getByRole("button", { name: "Zrušiť", exact: true }).click();
    await expect(page.getByTestId("result")).toHaveText("cancelled");
    expect(captured.writes).toEqual([]);
    expect(captured.requests).toEqual([{
      changes: [{ kind: "item", id: "step", value: true }],
      manualActionIds: mode === "immediate" ? ["callback"] : [],
    }]);
  });

  test(`${mode}: only explicit confirmation resolves the commit once`, async ({ page }) => {
    const captured = await intercept(page, { ...plan, mode });
    await page.goto(`${fixture}?mode=${mode}`);
    await page.getByTestId("review").click();
    const confirm = page.getByTestId("status-list-recap-confirm");
    await expect(confirm).toBeEnabled();
    expect(captured.writes).toEqual([]);
    await confirm.click();
    await expect(page.getByTestId("result")).toHaveText("confirmed");
    expect(captured.writes).toHaveLength(1);
  });
}

test("timestamps and local wall times show Bratislava time, independently of browser timezone", async ({ page }) => {
  await intercept(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${fixture}?date=${encodeURIComponent("2027-06-18T12:30:00Z")}`);
  await page.getByTestId("review").click();
  await expect(page.getByTestId("status-list-recap-callback-date")).toContainText("14:30");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("result")).toHaveText("cancelled");
});

test("changing contact while reviewing rejects the old confirmation", async ({ page }) => {
  const captured = await intercept(page);
  await page.goto(fixture);
  await page.getByTestId("review").click();
  await expect(page.getByTestId("status-list-recap-confirm")).toBeEnabled();
  await page.evaluate(() => document.getElementById("change-contact")!.click());
  await expect(page.getByTestId("result")).toHaveText("cancelled");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(captured.writes).toEqual([]);
});

test("an invalid preview cannot unlock confirmation", async ({ page }) => {
  const captured = await intercept(page, { ...plan, readOnly: false });
  await page.goto(fixture);
  await page.getByTestId("review").click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByTestId("status-list-recap-confirm")).toBeDisabled();
  expect(captured.writes).toEqual([]);
});

for (const width of [1100, 390]) {
  test(`first step confirmation includes editable callback and task recipient at ${width}px`, async ({ page }) => {
    await page.setViewportSize({width,height:844});
    const captured=await intercept(page,{...plan,actions:[...plan.actions,
      {id:"task",sourceLabel:"Testovací krok",actionType:"assign_task",condition:"matched",targetLabel:"Back Office SK"}]});
    await page.goto(`${fixture}?step`);
    await page.getByTestId("review").click();
    await expect(page.getByTestId("status-list-recap-action-summary")).toBeInViewport();
    await expect(page.getByTestId("status-list-recap-action-summary")).toContainText("18. júna 2027");
    await expect(page.getByTestId("status-list-recap-action-summary")).toContainText("Back Office SK");
    await expect(page.getByTestId("status-list-recap-callback-date")).toContainText("14:30");
    await expect(page.getByTestId("status-list-recap-task-target")).toContainText("Back Office SK");
    await expect(page.getByTestId("status-list-recap-callback-editor")).toBeVisible();
    const picker=`status-list-recap-callback-callback`;
    await expect(page.getByTestId(`${picker}-day`)).toBeVisible();
    await expect(page.getByTestId(`${picker}-hour`)).toHaveValue("14");
    await expect(page.getByTestId(`${picker}-minute`)).toHaveValue("30");
    const offeredDays=await page.getByTestId(`${picker}-day`).locator("option").evaluateAll(options=>options.map(option=>(option as HTMLOptionElement).value));
    expect(offeredDays).not.toContain("19");
    expect(offeredDays).not.toContain("20");
    expect(offeredDays).toContain("21");
    await page.getByTestId(`${picker}-day`).selectOption("21");
    await expect(page.getByTestId("status-list-recap-action-summary")).toContainText("21. júna 2027");
    await expect(page.getByTestId("status-list-recap-callback-date")).toContainText("21. júna 2027");
    await page.getByRole("textbox",{name:"Poznámka k hovoru",exact:true}).fill("Upravená poznámka");
    await expect(page.getByTestId("status-list-recap-callback-date")).toContainText("Upravená poznámka");
    await expect(page.locator('[data-testid="status-list-recap-callback-editor"] [role="grid"]')).toHaveCount(0);
    expect(captured.writes).toEqual([]);
    await page.screenshot({path:`/tmp/status-list-first-step-${width}.jpg`});
    await page.getByTestId("status-list-recap-confirm").click();
    await expect(page.getByTestId("result")).toHaveText("confirmed");
    expect(captured.commits).toEqual([{callbackDate:"2027-06-21T12:30:00.000Z",callbackNote:"Upravená poznámka",mode:"immediate"}]);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test(`approved recap stays within a ${width}px viewport and renders saved icon colors`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await intercept(page);
    await page.goto(fixture);
    await expect(page.getByTestId("legacy-question-icon").locator("svg")).toHaveCSS("color", "rgb(99, 102, 241)");
    await expect(page.getByTestId("custom-subquestion-icon").locator("svg")).toHaveCSS("color", "rgb(79, 129, 120)");
    await page.getByTestId("review").click();
    await expect(page.getByTestId("status-list-recap-confirm")).toBeEnabled();
    const bounds = await page.getByRole("dialog").boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
    const heading = await page.locator(".sl-recap-header").boundingBox();
    const icon = await page.locator(".sl-recap-mark").boundingBox();
    expect(icon!.x - heading!.x).toBeGreaterThanOrEqual(20);
    await expect(page.getByTestId("status-list-recap-confirm")).toBeInViewport();
  });

  test(`real reschedule component cancels safely and commits only on save at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await intercept(page);
    await page.goto(`${fixture}?reschedule`);
    await page.getByTestId("btn-scheduled-reschedule-scheduled").click();
    await expect(page.getByTestId("btn-confirm-reschedule-scheduled")).toBeVisible();
    await expect(page.getByTestId("rescheduled")).toHaveText("null");
    await page.getByRole("button", { name: "Zrušiť", exact: true }).click();
    await expect(page.getByTestId("rescheduled")).toHaveText("null");
    await page.getByTestId("btn-scheduled-reschedule-scheduled").click();
    await page.getByTestId("btn-confirm-reschedule-scheduled").click();
    await expect(page.getByTestId("invalid")).toHaveText("false");
    await expect(page.getByTestId("rescheduled")).not.toHaveText("null");
    const saved = JSON.parse((await page.getByTestId("rescheduled").textContent())!);
    expect(saved.id).toBe("contact-a");
    expect(saved.campaignId).toBe("fixture-mission");
    expect(Date.parse(saved.date)).toBeGreaterThan(Date.now());
  });
}

test("ordinary step preview displays server callback metadata without manual action IDs",async({page})=>{
  const captured=await intercept(page,{...plan,actions:[{...plan.actions[0],callbackDate:"2027-06-18T14:30"}]});
  await page.goto(`${fixture}?step&server-details`);
  await page.getByTestId("review").click();
  await expect(page.getByTestId("status-list-recap-callback-date")).toContainText("18. júna 2027");
  expect(captured.requests).toEqual([{changes:[{kind:"item",id:"step",value:true}],manualActionIds:[]}]);
  expect(captured.writes).toEqual([]);
});

for(const dark of [false,true]) {
  test(`selected and hidden rows remain distinct (${dark?"dark":"light"})`,async({page})=>{
    await intercept(page);
    await page.goto(`${fixture}?outline${dark?"&dark":""}`);
    const visible=page.getByTestId("status-list-select-visible-step");
    const hidden=page.getByTestId("status-list-select-hidden-step");
    await expect(visible).toHaveAttribute("aria-current","true");
    const blue=await visible.locator("..").evaluate(el=>getComputedStyle(el).backgroundColor);
    await expect(hidden.locator("..")).toHaveCSS("border-top-style","dashed");
    expect(await hidden.locator("..").evaluate(el=>getComputedStyle(el).backgroundColor)).not.toBe(blue);
    await hidden.click();
    await expect(hidden).toHaveAttribute("aria-current","true");
    await expect(hidden.locator("..")).toHaveAttribute("data-hidden","true");
    await expect(hidden.locator("..")).toHaveCSS("border-top-style","solid");
    await expect(hidden.locator("..").locator(".slw-visibility")).toHaveClass(/is-hidden/);
    expect(await hidden.locator("..").evaluate(el=>getComputedStyle(el).backgroundColor)).toBe(blue);
    await page.getByTestId("status-list-expand-hidden-step").click();
    const question=page.getByTestId("status-list-select-question-hidden-question");
    await question.click();
    await expect(question).toHaveAttribute("aria-current","true");
    await expect(hidden).not.toHaveAttribute("aria-current","true");
    await expect(page.getByTestId("status-list-question-row-hidden-question")).toHaveAttribute("data-hidden","true");
    await page.screenshot({path:`/tmp/status-list-selection-${dark?"dark":"light"}.jpg`});
  });
}
