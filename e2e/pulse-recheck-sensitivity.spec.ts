import { test, expect } from "@playwright/test";
import { DEVICE_CHANGE_CONFIRM_MS, NETWORK_CHANGE_CONFIRM_MS } from "../client/src/features/nexus-pulse-preflight/recheck-policy";

test.beforeEach(async ({ page }) => {
  test.setTimeout(45000);
  for (const [module, body] of [
    ["auth-context", 'const user={id:"sensitivity-test",role:"admin"};export function useAuth(){return {user}}'],
    ["permissions-context", "export function usePermissions(){return {isLoading:false,canAccessModule:()=>true}}"],
    ["call-context", 'export { useCall } from "/test-fixtures/pulse-connection-state.tsx";'],
    ["sip-context", 'export { useSip } from "/test-fixtures/pulse-connection-state.tsx";'],
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
    w.testOnline = true;
    Object.defineProperty(navigator, "onLine", { get: () => w.testOnline, configurable: true });
    w.micPermission = Object.assign(new EventTarget(), { state: "granted" });
    const query = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = async (descriptor: any) => descriptor.name === "microphone" ? w.micPermission : query(descriptor);
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

test("a healthy default-output switch does not require testing; subsequent loss of that output does", async ({ page }) => {
  await page.evaluate(() => {
    const w = window as any;
    w.devices = w.devices.map((device: any) => device.deviceId === "default" ? { ...device, groupId: "desk", label: "desk" } : device);
    navigator.mediaDevices.dispatchEvent(new Event("devicechange"));
  });
  await page.waitForTimeout(DEVICE_CHANGE_CONFIRM_MS + 200);
  await expect(page.getByTestId("nexus-pulse-recheck-intro")).toHaveCount(0);
  await page.evaluate(() => {
    const w = window as any;
    w.devices = w.devices.filter((device: any) => device.deviceId !== "desk");
    navigator.mediaDevices.dispatchEvent(new Event("devicechange"));
  });
  await expect(page.getByTestId("nexus-pulse-recheck-intro")).toBeVisible();
});

test("brief and sustained healthy transport switches do not invalidate", async ({ page }) => {
  await page.clock.install();
  await page.evaluate(() => {
    const w = window as any;
    w.fakeNetwork.type = "ethernet";
    w.fakeNetwork.dispatchEvent(new Event("change"));
    w.fakeNetwork.type = "wifi";
    w.fakeNetwork.dispatchEvent(new Event("change"));
  });
  await page.clock.runFor(NETWORK_CHANGE_CONFIRM_MS + 250);
  await expect(page.getByTestId("nexus-pulse-recheck-intro")).toHaveCount(0);
  await page.evaluate(() => {
    const w = window as any;
    w.fakeNetwork.type = "ethernet";
    w.fakeNetwork.dispatchEvent(new Event("change"));
  });
  await page.clock.runFor(NETWORK_CHANGE_CONFIRM_MS + 250);
  await expect(page.getByTestId("nexus-pulse-recheck-intro")).toHaveCount(0);
});

test("short offline periods and a noncritical media interruption preserve readiness", async ({ page }) => {
  await page.clock.install();
  await page.evaluate(() => {
    (window as any).testOnline = false;
    window.dispatchEvent(new Event("offline"));
    window.dispatchEvent(new Event("nexus-pulse-ready"));
    window.dispatchEvent(new CustomEvent("nexus-pulse-media-interrupted", { detail: { episodeId: "brief-network" } }));
  });
  await page.clock.runFor(12000);
  await expect(page.getByTestId("nexus-pulse-recheck-intro")).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem("nexus-pulse-ready-v2:sensitivity-test"))).toBe("1");
  await page.evaluate(() => {
    (window as any).testOnline = true;
    window.dispatchEvent(new Event("online"));
  });
  await page.clock.runFor(NETWORK_CHANGE_CONFIRM_MS + 500);
  await expect(page.getByTestId("nexus-pulse-recheck-intro")).toHaveCount(0);
});

test("confirmed prolonged offline status requires a fresh check", async ({ page }) => {
  await page.clock.install();
  await page.evaluate(() => {
    (window as any).testOnline = false;
    window.dispatchEvent(new Event("offline"));
  });
  await page.clock.runFor(NETWORK_CHANGE_CONFIRM_MS - 1000);
  await expect(page.getByTestId("nexus-pulse-recheck-intro")).toHaveCount(0);
  await page.clock.runFor(1200);
  await expect(page.getByTestId("nexus-pulse-recheck-intro")).toBeVisible();
});

test("SIP registration must be lost for 30 seconds, not a transient reconnect", async ({ page }) => {
  await page.clock.install();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("test-sip", { detail: false })));
  await page.waitForTimeout(50);
  await page.clock.runFor(15000);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("test-sip", { detail: true })));
  await page.clock.runFor(35000);
  await expect(page.getByTestId("nexus-pulse-recheck-intro")).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("test-sip", { detail: false })));
  await page.waitForTimeout(50);
  await page.clock.runFor(30100);
  await expect(page.getByTestId("nexus-pulse-recheck-intro")).toBeVisible();
});

test("removing an unused audio output does not interrupt work", async ({ page }) => {
  await page.evaluate(() => {
    const w = window as any;
    w.devices = w.devices.filter((device: any) => device.deviceId !== "desk");
    navigator.mediaDevices.dispatchEvent(new Event("devicechange"));
  });
  await page.waitForTimeout(DEVICE_CHANGE_CONFIRM_MS + 200);
  await expect(page.getByTestId("nexus-pulse-recheck-intro")).toHaveCount(0);
});

test("critical media checks wait for call and wrap-up; validated recovery cancels them", async ({ page }) => {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("test-call", { detail: "active" })));
  await page.waitForTimeout(50);
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("nexus-pulse-media-interrupted", { detail: { episodeId: "recovered" } }));
    window.dispatchEvent(new CustomEvent("nexus-pulse-media-critical", { detail: { episodeId: "recovered" } }));
  });
  await expect(page.getByTestId("nexus-pulse-recheck-intro")).toHaveCount(0);
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("nexus-pulse-media-recovered", { detail: { episodeId: "recovered" } }));
    window.dispatchEvent(new CustomEvent("test-call", { detail: "idle" }));
  });
  await page.waitForTimeout(700);
  await expect(page.getByTestId("nexus-pulse-recheck-intro")).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem("nexus-pulse-ready-v2:sensitivity-test"))).toBe("1");
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("test-call", { detail: "active" })));
  await page.waitForTimeout(50);
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("nexus-pulse-media-critical", { detail: { episodeId: "fatal" } }));
    window.dispatchEvent(new CustomEvent("nexus-pulse-work-protection", { detail: { protected: true } }));
    window.dispatchEvent(new CustomEvent("test-call", { detail: "idle" }));
  });
  await page.waitForTimeout(700);
  await expect(page.getByTestId("nexus-pulse-recheck-intro")).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("nexus-pulse-work-protection", { detail: { protected: false } })));
  await expect(page.getByTestId("nexus-pulse-recheck-intro")).toBeVisible();
});

test("revoked microphone permission is a fatal fault", async ({ page }) => {
  await page.evaluate(() => {
    const permission = (window as any).micPermission;
    permission.state = "denied";
    permission.dispatchEvent(new Event("change"));
  });
  await expect(page.getByTestId("nexus-pulse-recheck-intro")).toBeVisible();
});
