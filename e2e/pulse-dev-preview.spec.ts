import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/contexts/auth-context.tsx*", route => route.fulfill({
    contentType: "application/javascript",
    body: 'export function useAuth(){return {user:{id:"ui-preview-test"}}}',
  }));
  await page.route("**/contexts/permissions-context.tsx*", route => route.fulfill({
    contentType: "application/javascript",
    body: "export function usePermissions(){return {isLoading:false,canAccessModule:()=>true}}",
  }));
  await page.route("**/contexts/call-context.tsx*", route => route.fulfill({
    contentType: "application/javascript",
    body: 'export function useCall(){return {callState:"idle"}}',
  }));
  await page.route("**/contexts/sip-context.tsx*", route => route.fulfill({
    contentType: "application/javascript",
    body: "export function useSip(){return {isRegistered:false,ensureRegistered:async()=>false}}",
  }));
});

test("explicit preview opens workspace without SIP, never writes readiness, and exit restores checks", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/test-fixtures/pulse-gate.html");
  await expect(page.getByTestId("workspace-retained")).toHaveCount(0);
  await expect(page.getByTestId("button-pulse-ui-preview")).toBeVisible();
  // Keep the real provider and diagnostics but substitute the fixture document
  // for the workspace route: no real calls, authentication, or CRM writes.
  await page.route("**/agent-workspace?pulse-ui-preview=1", async route => {
    const response = await route.fetch({ url: "http://127.0.0.1:4174/test-fixtures/pulse-gate.html" });
    await route.fulfill({ response, body: (await response.text()).replace('src="./pulse-gate.tsx"', 'src="/test-fixtures/pulse-gate.tsx"') });
  });
  await page.getByTestId("button-pulse-ui-preview").click();
  await expect(page).toHaveURL(/agent-workspace\?pulse-ui-preview=1/);
  await expect(page.getByTestId("pulse-dev-preview-banner")).toBeVisible();
  await expect(page.getByTestId("workspace-retained")).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.getByTestId("nexus-pulse-dialog")).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem("nexus-pulse-ready-v2:ui-preview-test"))).toBeNull();
  await page.goto("/test-fixtures/pulse-gate.html?pulse-ui-preview=1");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("button-pulse-exit-ui-preview")).toBeVisible();
  await page.screenshot({ path: "/tmp/pulse-dev-preview-mobile.png" });
  await page.getByTestId("button-pulse-exit-ui-preview").click();
  await expect(page.getByTestId("pulse-dev-preview-banner")).toHaveCount(0);
  await expect(page.getByTestId("workspace-retained")).toHaveCount(0);
  await expect(page.getByTestId("nexus-pulse-dialog")).toBeVisible();
  expect(errors).toEqual([]);
});

test("preview wrapper requires authentication and module permission", async ({ page }) => {
  await page.route("**/contexts/auth-context.tsx*", route => route.fulfill({
    contentType: "application/javascript", body: "export function useAuth(){return {user:null}}",
  }));
  await page.goto("/test-fixtures/pulse-gate.html?pulse-ui-preview=1");
  await expect(page.getByTestId("workspace-retained")).toBeVisible();
  await expect(page.getByTestId("pulse-dev-preview-banner")).toHaveCount(0);
  // The existing outer route remains responsible for login/permission denial;
  // the development wrapper must fall through to that unchanged normal flow.
  await page.route("**/contexts/auth-context.tsx*", route => route.fulfill({
    contentType: "application/javascript", body: 'export function useAuth(){return {user:{id:"ui-preview-test"}}}',
  }));
  await page.route("**/contexts/permissions-context.tsx*", route => route.fulfill({
    contentType: "application/javascript", body: "export function usePermissions(){return {isLoading:false,canAccessModule:()=>false}}",
  }));
  await page.reload();
  await expect(page.getByTestId("workspace-retained")).toBeVisible();
  await expect(page.getByTestId("pulse-dev-preview-banner")).toHaveCount(0);
});