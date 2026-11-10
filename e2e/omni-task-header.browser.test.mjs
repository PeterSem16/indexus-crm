// Exercise the real application bundle against isolated HTTP fixtures.
// Never changes database data, installs an auth bypass, or calls Microsoft 365.
import assert from "node:assert/strict";
import express from "express";
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const app = express(), dist = resolve(process.env.OMNI_TEST_DIST || "dist/public");
app.use(express.static(dist));
app.use((_, res) => res.sendFile(resolve(dist, "index.html")));
const server = app.listen(0, "127.0.0.1");
await new Promise(r => server.on("listening", r));
const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
const page = await context.newPage();
page.setDefaultTimeout(15_000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const user = { id: "task-header-viewer", username: "header-viewer", fullName: "Task Header Test",
  email: "header@example.test", role: "admin", isActive: true, assignedCountries: ["SK"], language: "en" };
const tasks = Array.from({ length: 47 }, (_, i) => ({
  id: `header-task-${i}`, title: `Header test request ${i + 1}`, description: "Isolated test data",
  assignedUserId: i < 31 || i > 44 ? user.id : "other",
  createdByUserId: user.id, status: i > 44 ? "completed" : "pending", priority: "medium",
  tags: i >= 31 && i <= 44 ? ["group_id:office"] : [], attachments: [],
  createdAt: "2026-11-10T08:00:00Z", dueDate: null,
}));
let groups = [
  { id: "office", name: "Back Office", isBackOffice: true, color: "#f97316", members: [{ userId: user.id }] },
  { id: "empty", name: "Case review — requests from partners with a very long name", color: "#0d9488", members: [{ userId: user.id }] },
  { id: "private", name: "Not a member", members: [{ userId: "other" }] },
];
await page.route("**/api/**", async route => {
  const path = new URL(route.request().url()).pathname;
  let data = [];
  if (path === "/api/auth/me") data = { user };
  else if (path === "/api/tasks") data = tasks;
  else if (path === "/api/task-groups") data = groups;
  else if (path === "/api/tasks/people") data = [user, { id: "other", fullName: "Other operator", username: "other" }];
  else if (path === "/api/tasks/assignment-options") data = { users: [user], groups, canResolve: true };
  else if (path === "/api/task-settings/access") data = { canManage: true };
  else if (path === "/api/task-settings/users") data = { configured: false, allowedUserIds: [], users: [user] };
  else if (path.includes("ms365-connection")) data = { connected: true, isConnected: true };
  else if (path.includes("ms365-available-mailboxes")) data = [{ id: "personal", email: user.email, type: "personal", displayName: user.fullName }];
  else if (path.includes("ms365-unread-counts")) data = { connected: false, counts: [] };
  else if (path === "/api/omni-sms/unread") data = { count: 0 };
  else if (path === "/api/omni-sms/access") data = { isAdmin: false, grants: [], countries: [], gateways: [] };
  else if (path === "/api/nexus/mailbox-groups") data = { groups: [], revision: 0 };
  await route.fulfill({ json: data });
});
const url = `http://127.0.0.1:${server.address().port}/email?tab=tasks&filter=open&view=my`;
const header = page.locator(".tasks-refined");
const count = () => page.getByTestId("task-queue-count").innerText();
const assertFits = async () => {
  const measurements = await header.evaluate(el => {
    const outer = el.getBoundingClientRect();
    return [...el.querySelectorAll("button, .tasks-count")].map(child => {
      const r = child.getBoundingClientRect();
      return r.width && r.height ? { left: r.left - outer.left, right: outer.right - r.right } : null;
    }).filter(Boolean);
  });
  assert(measurements.every(r => r.left >= -1 && r.right >= -1), "Header controls must fit the queue");
};
try {
  await page.goto(url);
  await page.getByTestId("task-subtab-group-office").waitFor();
  assert.equal(await count(), "31");
  assert.equal(await header.locator(".bg-blue-500, .bg-amber-500, .rounded-full").count(), 0);
  assert.equal(await page.getByTestId("task-subtab-back-office").count(), 0, "No duplicate Back Office tab");
  assert.equal(await page.getByTestId("task-subtab-group-private").count(), 0, "Membership still controls group visibility");
  assert.equal(await page.getByTestId("task-subtab-group-empty").locator(".tasks-count").innerText(), "0");
  await page.getByTestId("task-page-next").click();
  assert.match(await page.getByTestId("task-page-number").innerText(), /^2/);
  await page.getByTestId("task-subtab-all").click();
  assert.equal(await count(), "45");
  assert.match(await page.getByTestId("task-page-number").innerText(), /^1/);
  await page.getByTestId("task-subtab-group-office").click();
  assert.equal(await count(), "14");
  assert.equal(await page.getByTestId("task-subtab-group-office").getAttribute("aria-pressed"), "true");
  await page.getByTestId("task-subtab-group-empty").click();
  assert.equal(await count(), "0");
  await page.getByTestId("task-subtab-my").click();
  await assertFits();
  assert(await header.locator(".tasks-scope-label").evaluateAll(labels =>
    labels.every(el => el.scrollWidth <= el.clientWidth + 1)), "Translated scope names must stay readable");
  await mkdir("generated-artifacts/omni-tasks-panel", { recursive: true });
  await page.screenshot({ path: "generated-artifacts/omni-tasks-panel/live-light.png" });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  const darkCountContrast = await page.getByTestId("task-subtab-my").locator(".tasks-count").evaluate(el => {
    const ctx = document.createElement("canvas").getContext("2d");
    const pixel = color => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data]; };
    const fg = pixel(getComputedStyle(el).color);
    const panel = pixel(getComputedStyle(el.closest(".tasks-refined")).backgroundColor);
    const overlay = pixel(getComputedStyle(el).backgroundColor), alpha = overlay[3] / 255;
    const bg = panel.map((v, i) => i < 3 ? overlay[i] * alpha + v * (1 - alpha) : 255);
    const luminance = rgb => rgb.slice(0, 3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    return (Math.max(luminance(fg), luminance(bg)) + .05) / (Math.min(luminance(fg), luminance(bg)) + .05);
  });
  assert(darkCountContrast >= 4.5, `Dark count contrast: ${darkCountContrast}`);
  await page.screenshot({ path: "generated-artifacts/omni-tasks-panel/live-dark.png" });
  await page.evaluate(() => document.documentElement.classList.remove("dark"));
  await page.getByTestId("btn-task-filters").click();
  await page.getByTestId("task-filters-popover").waitFor();
  await page.keyboard.press("Escape");
  await page.getByTestId("task-subtab-reporting").click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("task-mobile-filter").click();
  await page.getByRole("option", { name: /^(Completed|Dokončené)$/ }).click();
  assert.equal(await count(), "2");
  await assertFits();
  await page.screenshot({ path: "generated-artifacts/omni-tasks-panel/live-mobile.png" });
  // Exercise the alternate aggregate Back Office branch, not just a member tab.
  groups = groups.map(group => group.id === "office" ? { ...group, members: [] } : group);
  await page.goto(url);
  await page.getByTestId("task-subtab-back-office").waitFor();
  await page.getByTestId("task-subtab-back-office").click();
  assert.equal(await count(), "14");
  await assertFits();
  assert.deepEqual(errors, []);
  console.log("PASS real Tasks header: API counts, scopes, page reset, zero/long-name groups, membership, aggregate Back Office, filters, Reporting, themes and mobile");
} catch (error) {
  console.error("Browser errors:", errors);
  console.error((await page.locator("body").innerText()).slice(-2000));
  throw error;
} finally {
  await browser.close();
  await new Promise(r => server.close(r));
}
