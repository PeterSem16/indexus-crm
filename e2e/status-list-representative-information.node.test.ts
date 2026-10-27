import assert from "node:assert/strict";
import test from "node:test";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import { statusListRepresentativeInformationTranslations as messages } from "../client/src/i18n/status-list-representative-information-copy";
import { getStatusListBackgroundCopy } from "../client/src/components/status-list-background-copy";
import { getRepresentativeCheckCopy } from "../client/src/i18n/status-list-representative-check-copy";
import { getStatusListRecapCopy } from "../client/src/components/status-list-recap-copy";
import { getRepresentativeNoticeCopy } from "../client/src/components/status-list-representative-notice-copy";

test("coordinator information: seven languages, states, mobile/dark, read-only opening and editor persistence", async () => {
  const server = await createServer({ configFile: "vite.config.ts", logLevel: "error",
    cacheDir: "/tmp/indexus-representative-information-vite-cache",
    server: { host: "127.0.0.1", port: 4186, strictPort: true } });
  await server.listen();
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const writes: any[] = [];
    let sources: any[] = [];
    let runtime=false,queued=0,executed=false,assigned=false,rejectConfirm=false;
    let runtimeConfig={enabled:true,trigger:"pulse_open",behavior:"confirm"};
    const proposal={questionId:"q",fingerprint:"a".repeat(64),preview:{readOnly:true,mode:"immediate",actions:[
      {id:"task",sourceLabel:"Coordinator check",actionType:"assign_task",condition:"matched",targetLabel:"Back Office"},
      {id:"mail",sourceLabel:"Coordinator check",actionType:"send_email",condition:"matched"},
    ]}};
    const catalog = [{ id: "q", kind: "question", label: "Coordinator check", fieldType: "yes_no",
      hidden: true, writable: true, parentId: "item", systemSourceEligible: true }];
    await page.route("**/api/**", async route => {
      const request = route.request(), path = new URL(request.url()).pathname;
      if (request.method() === "GET") {
        if (path.endsWith("/sources")) return route.fulfill({ json: { sources, catalog } });
        if (path.includes("/contacts/")) {
          const contact = path.split("/contacts/")[1].split("/")[0];
          return route.fulfill({ json: { answers: {}, catalog, runs: [],
            representativeChecks:runtime?[{questionId:"q",config:runtimeConfig}]:[],
            representativeInformation: contact === "disabled" ? [] : [{
            questionId: "q", label: "Coordinator check", state: contact, representativeName: contact === "assigned" ? "Test Coordinator" : null,
          }] } });
        }
        return route.fulfill({ json: { rules: [], catalog } });
      }
      writes.push({ path, method: request.method(), body: request.postDataJSON() });
      if(path.endsWith("/representative-check")){
        const body=request.postDataJSON();
        if(body.confirm && rejectConfirm)return route.fulfill({status:409,json:{error:"preview_changed"}});
        if(!runtimeConfig.enabled || body.trigger!==runtimeConfig.trigger)return route.fulfill({json:{information:[],reviews:[]}});
        if((body.confirm || runtimeConfig.behavior==="automatic" && !body.statusOnly) && !assigned && !queued)queued++;
        const available=!assigned && !queued && runtimeConfig.behavior==="confirm";
        return route.fulfill({json:{information:[{questionId:"q",label:"Coordinator check",
          state:assigned?"assigned":"unassigned",representativeName:assigned?"New Coordinator":null,
          actionState:assigned?"none":queued?executed?"done":"pending":available?"available":"none"}],
          reviews:available?[proposal]:[]}});
      }
      if (request.method() === "PUT") sources = [{ questionId: "q", ...request.postDataJSON() }];
      if (request.method() === "DELETE") sources = [];
      return route.fulfill({ json: { ok: true } });
    });
    const visit = async (locale: string, state = "assigned") => {
      await page.goto(`http://127.0.0.1:4186/test-fixtures/status-list-representative-information.html?locale=${locale}&contact=${state}`, { waitUntil: "domcontentloaded", timeout: 90000 });
    };
    for (const locale of Object.keys(messages)) {
      await visit(locale);
      const panel = page.getByTestId("status-list-representative-information");
      await expect(panel).toContainText(messages[locale].assigned);
      await expect(panel).toContainText("Test Coordinator");
      await expect(panel.getByRole("button",{name:getRepresentativeNoticeCopy(locale).dismiss})).toBeVisible();
      await expect(panel).not.toContainText(getRepresentativeCheckCopy(locale).reviewActions);
    }
    for (const state of ["unassigned", "unknown"]) {
      await visit("sk", state);
      await expect(page.locator(`[data-state="${state}"]`)).toContainText(messages.sk[state as "unassigned" | "unknown"]);
      await expect(page.getByTestId("status-list-representative-information")).not.toContainText("Test Coordinator");
    }
    await visit("sk", "disabled");
    await expect(page.getByTestId("status-list-background-sources")).toBeVisible();
    await expect(page.getByTestId("status-list-representative-information")).toHaveCount(0);
    assert.equal(writes.length, 0, "Opening and reading never runs actions or writes answers");
    await page.goto("http://127.0.0.1:4186/test-fixtures/status-list-representative-information.html?locale=sk&contact=unassigned&dismissal");
    const notice=page.getByTestId("status-list-representative-information");
    await notice.getByRole("button",{name:getRepresentativeNoticeCopy("sk").dismiss}).click();
    await expect(notice.getByRole("button",{name:getRepresentativeNoticeCopy("sk").restore})).toBeVisible();
    await expect(notice.locator('[data-state="unassigned"]')).toHaveCount(0);
    await page.getByTestId("fixture-switch-record").click();
    await expect(notice.locator('[data-state="assigned"]')).toBeVisible();
    await notice.getByRole("button",{name:getRepresentativeNoticeCopy("sk").dismiss}).click();
    await notice.getByRole("button",{name:getRepresentativeNoticeCopy("sk").restore}).click();
    await expect(notice.locator('[data-state="assigned"]')).toBeVisible();

    await page.getByTestId("status-list-background-sources").getByRole("button", { name: getStatusListBackgroundCopy("sk").add, exact: true }).click();
    await page.getByTestId("background-source-kind").selectOption("representative_information");
    await expect(page.getByTestId("representative-check-settings")).toContainText("Assigned representative");
    await expect(page.getByTestId("representative-check-enabled")).toBeChecked();
    await expect(page.getByTestId("representative-check-trigger")).toHaveValue("pulse_open");
    await expect(page.getByTestId("representative-check-behavior")).toHaveValue("confirm");
    await page.getByTestId("source-editor-stage-evaluation").click();
    await expect(page.getByTestId("background-source-hidden")).toBeChecked();
    await page.getByTestId("source-editor-stage-review").click();
    await page.getByTestId("source-editor-save").click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    assert.deepEqual(writes.at(-1)?.body, { source: "representative_assigned", hidden: true, showInformation: true,
      check:{enabled:true,trigger:"pulse_open",behavior:"confirm"} });
    await page.getByTestId("status-list-background-sources").getByRole("button", { name: getStatusListBackgroundCopy("sk").edit, exact: true }).click();
    await expect(page.getByTestId("background-source-kind")).toHaveValue("representative_information");
    await page.keyboard.press("Escape");

    await page.getByTestId("status-list-help-open").click();
    await expect(page.getByTestId("representative-information-manual")).toContainText(getRepresentativeCheckCopy("sk").reopening);
    await page.getByTestId("status-list-help-close").click();
    await visit("sk", "unassigned");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await expect(page.getByTestId("status-list-representative-information")).toContainText(messages.sk.unassigned);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "No mobile overflow");
    await page.screenshot({ path: "/tmp/status-list-representative-information-mobile.jpg" });

    // The actual runtime hook and shared recap: explicit open, cancel, confirm and dedup.
    runtime=true;
    await visit("sk","unassigned");
    await page.goto(`http://127.0.0.1:4186/test-fixtures/status-list-representative-information.html?locale=sk&contact=unassigned&runtime=1`);
    await expect(page.getByTestId("fixture-toggle-status-list")).toBeVisible();
    await expect(page.getByTestId("status-list-representative-information")).toHaveCount(0);
    await page.getByTestId("fixture-toggle-status-list").click();
    const reviewButton=()=>page.getByTestId("status-list-representative-information").getByRole("button",{name:getRepresentativeCheckCopy("sk").reviewActions});
    await reviewButton().click();
    await expect(page.getByTestId("status-list-action-recap")).toContainText("Back Office");
    await expect(page.locator(".sl-recap-action")).toHaveCount(2);
    assert.equal(queued,0,"Recap is a preview, not an execution");
    await page.getByRole("button",{name:getStatusListRecapCopy("sk").cancel,exact:true}).click();
    assert.equal(queued,0,"Cancellation has no effects");
    await reviewButton().click();
    assigned=true;rejectConfirm=true;
    await page.getByTestId("status-list-recap-confirm").click();
    await expect(page.getByTestId("status-list-representative-information")).toContainText("New Coordinator");
    assert.equal(queued,0,"Changed assignment refuses the reviewed plan");
    assigned=false;rejectConfirm=false;
    await page.getByTestId("fixture-toggle-status-list").click();
    await page.getByTestId("fixture-toggle-status-list").click();
    await reviewButton().click();
    await page.getByTestId("status-list-recap-confirm").click();
    await expect(page.getByTestId("representative-action-status-pending")).toBeVisible();
    assert.equal(queued,1);
    executed=true;
    await page.getByTestId("fixture-toggle-status-list").click();
    await page.getByTestId("fixture-toggle-status-list").click();
    await expect(page.getByTestId("representative-action-status-done")).toBeVisible();
    await expect(reviewButton()).toHaveCount(0);
    assert.equal(queued,1,"Reopening does not execute the effects again");
    // Card-open automatic and information-only are explicit and independent.
    runtimeConfig={enabled:true,trigger:"card_open",behavior:"automatic"};queued=0;executed=false;
    await page.reload();
    await expect(page.getByTestId("representative-action-status-pending")).toBeVisible();
    assert.equal(queued,1,"Card-open automatic does not require opening the Status List");
    runtimeConfig={enabled:true,trigger:"card_open",behavior:"information"};queued=0;
    await page.reload();
    await expect(page.getByTestId("status-list-representative-information")).toContainText(messages.sk.unassigned);
    assert.equal(queued,0);
    runtimeConfig={enabled:false,trigger:"pulse_open",behavior:"automatic"};
    await page.reload();await page.getByTestId("fixture-toggle-status-list").click();
    await expect(page.getByTestId("status-list-representative-information")).toHaveCount(0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await server.close(); }
});
