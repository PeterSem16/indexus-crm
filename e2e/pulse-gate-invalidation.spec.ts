import { test, expect } from "@playwright/test";

test("network invalidation discards a completed run and requires a fresh test without replacing workspace", async ({ page }) => {
  await page.route("**/contexts/auth-context.tsx*", route => route.fulfill({
    contentType: "application/javascript",
    body: 'const user={id:"gate-test",role:"admin"};export function useAuth(){return {user}}',
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
    body: "export function useSip(){return {isRegistered:true}}",
  }));
  // Exercise the real provider lifecycle with a stateful diagnostic substitute:
  // just like the real component, completion survives hiding unless remounted.
  await page.route("**/nexus-pulse-preflight/PulseDiagnostics.tsx*", route => route.fulfill({
    contentType: "application/javascript",
    body: `import React,{useState} from "/node_modules/.vite/deps/react.js";
      export function PulseDiagnostics(p){
        const [done,setDone]=useState(false);
        if(!p.open)return null;
        return React.createElement("div",{"data-testid":"test-diagnostics"},
          React.createElement("span",{"data-testid":"run-state"},done?"OLD READY":p.autoStartRequest?"FRESH RUN":"INITIAL"),
          React.createElement("button",{onClick:()=>{setDone(true);p.onReady()}},"Complete fixture test"));
      }`,
  }));
  await page.addInitScript(() => sessionStorage.setItem("nexus-pulse-ready-v2:gate-test", "1"));
  await page.goto("/test-fixtures/pulse-gate.html");
  await expect(page.getByTestId("workspace-retained")).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("nexus-pulse-open")));
  await page.getByRole("button", { name: "Complete fixture test" }).click();
  await expect(page.getByTestId("test-diagnostics")).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.getByTestId("nexus-pulse-recheck-intro")).toBeVisible();
  await expect(page.getByText("OLD READY", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("test-diagnostics")).toHaveCount(0);
  await expect(page.getByTestId("workspace-retained")).toBeAttached();
  expect(await page.evaluate(() => sessionStorage.getItem("nexus-pulse-ready-v2:gate-test"))).toBeNull();
  await page.screenshot({ path: "/tmp/pulse-required-recheck.png", animations: "disabled" });
  await page.getByTestId("button-pulse-start-required-recheck").click();
  await expect(page.getByTestId("run-state")).toHaveText("FRESH RUN");
  await page.getByRole("button", { name: "Complete fixture test" }).click();
  // A subsequent change must discard the second completed result too.
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("nexus-pulse-media-critical", { detail: { episodeId: "fixture-change" } })));
  await expect(page.getByTestId("nexus-pulse-recheck-intro")).toBeVisible();
  await page.getByTestId("button-pulse-start-required-recheck").click();
  await expect(page.getByTestId("run-state")).toHaveText("FRESH RUN");
});