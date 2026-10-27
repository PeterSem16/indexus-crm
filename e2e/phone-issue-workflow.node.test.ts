import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import { phoneIssueText } from "../client/src/components/tasks/phone-issue-workflow";

test("real phone-issue task fields and verification workflow: seven locales, source gates, call confirmation and contact freshness", async () => {
  const vite = await createServer({
    configFile: false,
    root: "client",
    cacheDir: "/tmp/indexus-phone-issue-vite-cache",
    resolve: { alias: { "@": `${process.cwd()}/client/src`, "@shared": `${process.cwd()}/shared` } },
    esbuild: { jsx: "automatic" },
    server: { host: "127.0.0.1", port: 0 },
    logLevel: "error",
  });
  await vite.listen();
  const address = vite.httpServer!.address() as { port: number };
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/repl/tools/bin/chromium",
    args: ["--no-sandbox"],
  });
  const postedBodies: any[] = [];
  const postedUrls: string[] = [];
  const requestedContextUrls: string[] = [];
  const allApiUrls: string[] = [];
  const swapContextPolls = new Map<string, number>();
  let staleOnce = true;
  let verified = false;

  try {
    const page = await browser.newPage({ viewport: { width: 1040, height: 900 } });
    page.on("pageerror", error => console.error("Phone issue fixture:", error.message));
    await page.route("**/test-fixtures/phone-issue.html*", route => route.fulfill({
      contentType: "text/html",
      body: '<html><head></head><body><div id="root"></div><script type="module" src="/src/components/tasks/phone-issue-browser-fixture.tsx"></script></body></html>',
    }));
    await page.route("**/api/campaigns/*/phone-issues/context*", async route => {
      const url = new URL(route.request().url());
      allApiUrls.push(url.pathname);
      requestedContextUrls.push(url.href);
      const entityId = url.searchParams.get("entityId");
      if (entityId === "clinic-swap") await new Promise(resolve => setTimeout(resolve, 300));
      const pollCount = entityId === "clinic-swap"
        ? (swapContextPolls.set(entityId, (swapContextPolls.get(entityId) || 0) + 1), swapContextPolls.get(entityId)!)
        : 0;
      const pendingVerification = verified ? null
        : entityId === "clinic-no-call" ? { issueId: "issue-no-call", phone: "+421 222 000 010", callId: null }
        : entityId === "clinic-swap" ? { issueId: "issue-after-swap", phone: "+421 222 000 020", callId: pollCount < 3 ? null : "call-after-swap" }
        : null;
      const sourceAvailable = entityId !== "clinic-no-source";
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          phones: [
            { field: "phone", number: "+421 222 000 001" },
            { field: "phone2", number: "+421 222 000 002" },
          ],
          pendingVerification,
          sourceAvailable,
        }),
      });
    });
    await page.route("**/api/campaigns/*/phone-issues/verify", async route => {
      const body = route.request().postDataJSON();
      const url = new URL(route.request().url());
      allApiUrls.push(url.pathname);
      postedBodies.push(body);
      postedUrls.push(url.pathname);
      if (staleOnce) {
        staleOnce = false;
        await route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ code: "phone_issue_stale", error: "untrusted raw server detail" }) });
        return;
      }
      verified = true;
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ verified: true }) });
    });

    await page.goto(`http://127.0.0.1:${address.port}/test-fixtures/phone-issue.html`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await expect(page.getByTestId("fixture-query-status")).toContainText("ready");
    await expect(page.getByTestId("fixture-phone-card")).toContainText("Status List active");
    await expect(page.getByTestId("fixture-phone-card")).toContainText("disposition closed");
    await expect(page.getByTestId("phone-issue-contact-area")).toHaveCount(1);
    const reasonSelect = page.getByTestId("phone-issue-reason");
    const fieldSelect = page.getByTestId("phone-issue-field");
    const submit = page.getByTestId("fixture-submit-task");
    const payloadOutput = page.getByTestId("fixture-task-payload");

    await expect(submit).toBeDisabled();
    await reasonSelect.selectOption("wrong_person");
    await expect(submit).toBeDisabled();
    await fieldSelect.selectOption("phone2");
    await expect(submit).toBeEnabled();

    for (const locale of ["sk", "en", "cs", "hu", "ro", "it", "de"]) {
      await page.getByTestId("fixture-locale").selectOption(locale);
      for (const reason of ["wrong_person", "not_working", "verify"] as const) {
        await reasonSelect.selectOption(reason);
        await fieldSelect.selectOption("phone2");
        await expect(submit).toBeEnabled();
        await submit.click();
        const payload = JSON.parse(await payloadOutput.textContent() || "{}");
        assert.deepEqual(payload.phoneIssue, {
          reason,
          phoneField: "phone2",
          expectedNumber: "+421 222 000 002",
        }, `${locale}: ${reason} submits exact structured phone issue data`);
        assert.equal(payload.relatedEntityType, "clinic");
        assert.equal(payload.relatedEntityId, "clinic-hidden-source");
        assert.deepEqual(payload.pulseOrigin, { missionId: "mission-fixture", sessionId: "session-fixture" });
        assert.match(payload.description, new RegExp(phoneIssueText("reportedNumber", locale)));
        assert.match(payload.description, new RegExp(phoneIssueText(reason === "wrong_person" ? "wrongPerson" : reason === "not_working" ? "notWorking" : "verify", locale)));
        assert.ok(payload.description.includes("+421 222 000 002"));
      }
    }

    // Hidden-source configuration does not suppress the returned contact fields or task flow.
    assert.equal(await page.locator('[data-testid="phone-issue-task-fields"]').count(), 1);
    assert.equal(await fieldSelect.locator("option").count(), 3);
    assert.equal(await page.getByTestId("phone-issue-verification").count(), 0);
    assert.ok(requestedContextUrls.some(value => {
      const url = new URL(value);
      return url.pathname === "/api/campaigns/mission-fixture/phone-issues/context"
        && url.searchParams.get("sessionId") === "session-fixture"
        && url.searchParams.get("entityType") === "clinic"
        && url.searchParams.get("entityId") === "clinic-hidden-source";
    }), "context request uses the current Mission, session and healthcare entity");
    assert.ok(allApiUrls.every(path => path.includes("/phone-issues/")), "workflow does not inspect or depend on a hidden healthcare status source");

    await page.getByTestId("fixture-locale").selectOption("en");
    await page.getByTestId("fixture-entity").selectOption("clinic-no-source");
    await expect(page.getByTestId("fixture-query-status")).toContainText("ready");
    await reasonSelect.selectOption("wrong_person");
    await fieldSelect.selectOption("phone");
    await expect(submit).toBeDisabled();
    await expect(page.getByTestId("phone-issue-task-fields")).toContainText(phoneIssueText("noSource", "en"));
    await reasonSelect.selectOption("not_working");
    await expect(submit).toBeDisabled();
    await reasonSelect.selectOption("verify");
    await expect(submit).toBeEnabled();
    await submit.click();
    assert.equal(JSON.parse(await payloadOutput.textContent() || "{}").phoneIssue.reason, "verify");

    await page.getByTestId("fixture-entity").selectOption("clinic-no-call");
    await expect(page.getByTestId("phone-issue-verification")).toBeVisible();
    await expect(page.getByTestId("phone-issue-verification")).toContainText(phoneIssueText("waiting", "en"));
    const verifyButton = page.getByTestId("btn-confirm-phone-issue");
    await expect(verifyButton).toBeDisabled();
    await expect(page.getByTestId("phone-issue-confirm-checkbox")).toHaveCount(0);

    // The real phone-area slot remains available independently of the Status List
    // and disposition sheet. Swapping contact identity must reset old confirmation.
    await page.getByTestId("fixture-swap-contact").click();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId("phone-issue-verification")).toHaveCount(0);
    await expect(page.getByTestId("phone-issue-verification")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("phone-issue-verification")).toContainText("+421 222 000 020");
    await expect(page.getByTestId("btn-confirm-phone-issue")).toBeDisabled();
    await expect(page.getByTestId("phone-issue-verification")).toContainText(phoneIssueText("waiting", "en"));
    await expect(page.getByTestId("phone-issue-confirm-checkbox")).toHaveCount(0);
    // The server only returns the trusted call id after the polling pass completes.
    await expect(page.getByTestId("phone-issue-confirm-checkbox")).toBeVisible({ timeout: 7000 });
    await expect(page.getByTestId("phone-issue-contact-area")).toBeVisible();
    await page.getByTestId("phone-issue-confirm-checkbox").check();
    await expect(page.getByTestId("btn-confirm-phone-issue")).toBeEnabled();
    await page.setViewportSize({ width: 1040, height: 900 });
    await page.getByTestId("btn-confirm-phone-issue").click();
    await expect(page.getByRole("alert")).toContainText(phoneIssueText("errorStale", "en"));
    await expect(page.getByRole("alert")).not.toContainText("untrusted raw server detail");
    const expectedBody = {
      sessionId: "session-fixture",
      entityType: "clinic",
      entityId: "clinic-swap",
      issueId: "issue-after-swap",
      callId: "call-after-swap",
      expectedNumber: "+421 222 000 020",
    };
    assert.deepEqual(postedBodies[0], expectedBody, "verification sends only the exact current Mission/session/entity/issue/call/number context");
    assert.equal(postedUrls[0], "/api/campaigns/mission-fixture/phone-issues/verify", "verification POST is scoped to the current Mission");

    await expect(page.getByTestId("btn-confirm-phone-issue")).toBeEnabled();
    await page.getByTestId("btn-confirm-phone-issue").click();
    assert.deepEqual(postedBodies[1], expectedBody);
    assert.equal(postedUrls[1], "/api/campaigns/mission-fixture/phone-issues/verify");
    await expect(page.getByTestId("phone-issue-verification")).toContainText(phoneIssueText("success", "en"));
    assert.ok(postedBodies.every(body => !("answered" in body) && !("lastCallId" in body)), "confirmation never relies on a technical answered flag or client call heuristic");
    const desktopSource = await readFile("client/src/pages/agent-workspace.tsx", "utf8");
    const mobileSource = await readFile("client/src/components/mobile-agent-workspace.tsx", "utf8");
    assert.match(desktopSource, /phoneIssueContactArea=\{isMobile \? null : selectedPhoneIssueArea\}/, "desktop CommunicationCanvas receives the tested shared phone-area slot");
    assert.match(desktopSource, /\{phoneIssueContactArea\}/, "desktop renders the slot alongside the contact phone");
    assert.match(mobileSource, /phoneIssueContactArea=\{props\.phoneIssueContactArea\}/, "mobile contact info cards receive the same slot");
    assert.match(mobileSource, /\{phoneIssueContactArea\}/, "mobile renders the slot below its phone details");
    assert.doesNotMatch(desktopSource, /<PhoneIssueVerificationControl[\s\S]{0,400}dispositionModalOpen/, "verification is not mounted in the disposition sheet");
    await page.close();
  } finally {
    await browser.close();
    await new Promise<void>(resolve => vite.close().then(() => resolve()));
  }
});
