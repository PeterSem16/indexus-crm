import { test, expect } from "@playwright/test";
import { DEVICE_CHANGE_CONFIRM_MS, NETWORK_CHANGE_CONFIRM_MS } from "../client/src/features/nexus-pulse-preflight/recheck-policy";

test.beforeEach(async ({ page }) => {
  test.setTimeout(45000);
  for (const [module, body] of [
    ["auth-context", 'const user={id:"sensitivity-test",role:"admin"};export function useAuth(){return {user}}'],
    ["permissions-context", "export function usePermissions(){return {isLoading:false,canAccessModule:()=>true}}"],
    ["call-context", 'export function useCall(){return {callState:"idle"}}'],
    ["sip-context", "export function useSip(){return {isRegistered:true}}"],
  ]) {
    await page.route(`**/contexts/${module}.tsx*`, route => route.fulfill({ contentType: "application/javascript", body }));
  }
  await page.route("**/nexus-pulse-preflight/PulseDiagnostics.tsx*", route => route.fulfill({
    contentType: "application/javascript",
    body: 'export { PulseDiagnostics } from "/test-fixtures/pulse-gate-diagnostics.tsx";',
  }));
  await page.addInitScript(() => {
    const w = window as any;
    localStorage.setItem("locale", "en");
    w.fakeNetwork = Object.assign(new EventTarget(), { type: "wifi", effectiveType: "4g", rtt: 50, downlink: 10 });
    Object.defineProperty(navigator, "connection", { value: w.fakeNetwork, configurable: true });
    w.deviceReads = 0;
    w.devices = [
      { kind: "audioinput", deviceId: "mic", groupId: "usb", label: "usb" },
      { kind: "audiooutput", deviceId: "headphones", groupId: "usb", label: "usb" },
      { kind: "audiooutput", deviceId: "default", groupId: "usb", label: "usb" },
      { kind: "audiooutput", deviceId: "desk", groupId: "desk", label: "desk" },
    ];
    sessionStorage.setItem("nexus-pulse-ready-v2:sensitivity-test", "1");
    sessionStorage.setItem("nexus-pulse-audio-devices-v1:sensitivity-test", JSON.stringify({ version: 1, devices: w.devices }));
    navigator.mediaDevices.enumerateDevices = async () => { w.deviceReads++; return w.devices.map((device: any) => ({ ...device })); };
  });
  await page.goto("/test-fixtures/pulse-gate.html");
  await expect(page.getByTestId("workspace-retained")).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect.poll(() => page.evaluate(() => (window as any).deviceReads)).toBeGreaterThan(0);
});

test("ordinary request-quality updates and device metadata changes do not invalidate readiness", async ({ page }) => {
  const reasons: string[] = [];
  page.on("console", message => { if (message.text().includes("Readiness recheck requested")) reasons.push(message.text()); });
  await page.evaluate(() => {
    const w = window as any;
    for (let index = 0; index < 20; index++) {
      Object.assign(w.fakeNetwork, { rtt: 50 + index * 30, downlink: 2 + index, effectiveType: index % 2 ? "3g" : "4g" });
      w.fakeNetwork.dispatchEvent(new Event("change"));
    }
    // A browser which exposes only RTT/effectiveType cannot identify a transport switch.
    delete w.fakeNetwork.type;
    w.fakeNetwork.dispatchEvent(new Event("change"));
    w.devices = w.devices.map((device: any) => ({ ...device, label: "", groupId: "" }));
    navigator.mediaDevices.dispatchEvent(new Event("devicechange"));
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(DEVICE_CHANGE_CONFIRM_MS + 250);
  await expect(page.getByTestId("nexus-pulse-recheck-intro")).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem("nexus-pulse-ready-v2:sensitivity-test"))).toBe("1");
  expect(reasons).toEqual([]);
});

test("a transient missing device does not invalidate, but confirmed removal does", async ({ page }) => {
  const reads = await page.evaluate(() => {
    const w = window as any;
    w.originalDevices = w.devices;
    const reads = w.deviceReads;
    w.devices = w.devices.filter((device: any) => device.deviceId !== "mic");
    navigator.mediaDevices.dispatchEvent(new Event("devicechange"));
    return reads;
  });
  await expect.poll(() => page.evaluate(() => (window as any).deviceReads)).toBeGreaterThan(reads);
  await page.evaluate(() => {
    // Repeated focus/actions must not bypass the confirmation interval.
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("pageshow"));
  });
  await expect(page.getByTestId("nexus-pulse-recheck-intro")).toHaveCount(0);
  await page.evaluate(() => {
    const w = window as any;
    w.devices = w.originalDevices;
    navigator.mediaDevices.dispatchEvent(new Event("devicechange"));
  });
  await page.waitForTimeout(DEVICE_CHANGE_CONFIRM_MS + 250);
  await expect(page.getByTestId("nexus-pulse-recheck-intro")).toHaveCount(0);
  await page.evaluate(() => {
    const w = window as any;
    w.devices = w.devices.filter((device: any) => device.deviceId !== "mic");
    navigator.mediaDevices.dispatchEvent(new Event("devicechange"));
  });
  await expect(page.getByTestId("nexus-pulse-recheck-intro")).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("nexus-pulse-ready-v2:sensitivity-test"))).toBeNull();
});

test("a confirmed default-output switch still requests a device check", async ({ page }) => {
  await page.evaluate(() => {
    const w = window as any;
    w.devices = w.devices.map((device: any) => device.deviceId === "default" ? { ...device, groupId: "desk", label: "desk" } : device);
    navigator.mediaDevices.dispatchEvent(new Event("devicechange"));
  });
  await expect(page.getByTestId("nexus-pulse-recheck-intro")).toBeVisible();
});

test("brief transport oscillation is ignored but a sustained physical switch invalidates", async ({ page }) => {
  await page.evaluate(() => {
    const w = window as any;
    w.fakeNetwork.type = "ethernet";
    w.fakeNetwork.dispatchEvent(new Event("change"));
    w.fakeNetwork.type = "wifi";
    w.fakeNetwork.dispatchEvent(new Event("change"));
  });
  await page.waitForTimeout(NETWORK_CHANGE_CONFIRM_MS + 250);
  await expect(page.getByTestId("nexus-pulse-recheck-intro")).toHaveCount(0);
  await page.evaluate(() => {
    const w = window as any;
    w.fakeNetwork.type = "ethernet";
    w.fakeNetwork.dispatchEvent(new Event("change"));
  });
  await expect(page.getByTestId("nexus-pulse-recheck-intro")).toBeVisible();
});
