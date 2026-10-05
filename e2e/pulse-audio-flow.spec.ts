import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/contexts/sip-context.tsx*", route => route.fulfill({
    contentType: "application/javascript",
    body: "export function useSip(){return {isRegistered:true,ensureRegistered:async()=>true}}",
  }));
  await page.route("**/api/**", route => route.abort());
  await page.route("**/api/users/*/ms365-connection", route => route.fulfill({
    json: { isConnected: true, hasTokens: true },
  }));
  await page.route("**/nexus-pulse-preflight/diagnostics.ts*", route => {
    if (route.request().url().includes("real-flow=1")) return route.continue();
    return route.fulfill({
      contentType: "application/javascript",
      body: `export * from "/src/features/nexus-pulse-preflight/diagnostics.ts?real-flow=1";
        export const gatherIce=async()=>({ok:true,hasPublicCandidate:true,pathType:"relay"});
        export const measureSameOriginLatency=async()=>({latency:20,jitter:2,samples:4});`,
    });
  });
  await page.addInitScript(() => {
    localStorage.setItem("locale", "en");
    const w = window as any;
    w.micAcquisitions = 0;
    navigator.mediaDevices.getUserMedia = async () => {
      w.micAcquisitions++;
      const track = { label: "Test headset", getSettings: () => ({ deviceId: "input" }), stop() {} };
      return { getAudioTracks: () => [track], getTracks: () => [track] } as any;
    };
    navigator.mediaDevices.enumerateDevices = async () => [
      { kind: "audioinput", deviceId: "input", groupId: "headset", label: "Test microphone" },
      { kind: "audiooutput", deviceId: "output", groupId: "headset", label: "Test headphones" },
    ] as MediaDeviceInfo[];
    class TestAudioContext {
      state = "running";
      sampleRate = 48000;
      currentTime = 0;
      destination = {};
      async resume() {}
      async close() { this.state = "closed"; }
      createMediaStreamSource() { return { connect() {} }; }
      createAnalyser() {
        const started = performance.now();
        return {
          fftSize: 1024, frequencyBinCount: 512, smoothingTimeConstant: 0,
          // Speaking starts late, after the former 2.5-second test expired.
          getByteTimeDomainData(data: Uint8Array) { data.fill(performance.now() - started > 3300 ? 160 : 128); },
          getByteFrequencyData(data: Uint8Array) { data.fill(100); },
        };
      }
      createBuffer(_channels: number, length: number) { return { getChannelData: () => new Float32Array(length) }; }
      createBufferSource() {
        const source = { buffer: null, onended: null as null | (() => void), connect() {}, start() { queueMicrotask(() => source.onended?.()); } };
        return source;
      }
      createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
      createOscillator() {
        const source = { frequency: { value: 0 }, onended: null as null | (() => void), connect() {}, start() {}, stop() { queueMicrotask(() => source.onended?.()); } };
        return source;
      }
    }
    w.AudioContext = TestAudioContext;
  });
});

test("one modal auto-starts once, accepts late speech and preserves the run through speaker confirmation", async ({ page }) => {
  test.setTimeout(45000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/test-fixtures/pulse-readiness.html?autostart=1");
  const step = page.getByTestId("pulse-focused-step");
  await expect(step).toHaveAttribute("data-step", "microphone");
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(step).toHaveAttribute("data-step", "output", { timeout: 12000 });
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(page.getByTestId("button-pulse-start")).toHaveCount(0);
  await page.getByRole("button", { name: /Play test sound/i }).click();
  await expect(page.getByTestId("pulse-heard-sound-icon")).toBeVisible();
  await page.screenshot({ path: "/tmp/pulse-single-speaker.png", animations: "disabled" });
  await page.getByRole("button", { name: /I heard the test sound/i }).click();
  await expect(step).toHaveAttribute("data-step", "progress");
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(page.getByTestId("nexus-pulse-completion-dialog")).toBeVisible({ timeout: 12000 });
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).micAcquisitions)).toBe(1);
  await page.getByTestId("button-pulse-completion-results").click();
  await expect(page.getByTestId("nexus-pulse-completion-dialog")).toHaveCount(0);
  await expect(page.getByTestId("button-pulse-continue")).toBeVisible();
  await page.getByTestId("button-pulse-continue").click();
  await expect(page.getByTestId("returned-to-indexus")).toBeVisible();
  expect(errors).toEqual([]);
});

test("negative speaker confirmation still blocks readiness in the single modal", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/test-fixtures/pulse-readiness.html?autostart=1");
  await expect(page.getByTestId("pulse-focused-step")).toHaveAttribute("data-step", "output", { timeout: 12000 });
  await page.getByRole("button", { name: /Play test sound/i }).click();
  await expect(page.getByTestId("pulse-heard-sound-icon")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/pulse-single-speaker-mobile.png", animations: "disabled" });
  await page.getByRole("button", { name: /I did not hear the sound/i }).click();
  await expect(page.getByTestId("pulse-focused-step")).toHaveCount(0, { timeout: 12000 });
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(page.getByTestId("button-pulse-continue")).toHaveCount(0);
  await expect(page.getByTestId("nexus-pulse-completion-dialog")).toHaveCount(0);
});
