// Browser-only fixtures: no app authentication bypass and no real mailbox calls.
// Run against the running dev app: node script/test-sidebar-notification-badges.cjs
const { chromium } = require("playwright");
const assert = require("node:assert/strict");

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const base = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://127.0.0.1:5000";
  let counts = { sms: 37, email: 8, chat: 1, task: 1 };
  let connected = true;
  let emailRequests = 0;
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let body = [];
    if (path === "/api/auth/me") body = { user: { id: "badge-test", fullName: "Sidebar Test", username: "badge-test", role: "admin", assignedCountries: ["SK"], language: "sk" } };
    else if (path === "/api/omni-sms/unread") body = { unread: counts.sms };
    else if (path.endsWith("/ms365-unread-counts")) {
      emailRequests++;
      body = { connected, totalUnread: counts.email, counts: [] };
    }
    else if (path === "/api/tasks/my") body = Array.from({ length: counts.task }, (_, i) => ({ id: `task-${i}`, title: "Fixture", status: "pending" }));
    else if (path.startsWith("/api/chat/conversations")) body = [{ partnerId: "fixture-colleague", unreadCount: counts.chat }];
    else if (path === "/api/notifications/unread-count") body = { count: 0 };
    else if (path.includes("/ms365-mailboxes")) body = { connected: false, mailboxes: [] };
    else if (path.includes("/ms365-folders")) body = { connected: false, folders: [] };
    else if (path.includes("/ms365") || path.includes("connection")) body = { connected: false, emails: [] };
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
  });
  const badge = kind => page.getByTestId(`nexus-omni-unread-${kind}`);
  async function load() {
    errors.length = 0;
    await page.goto(`${base}/sidebar-badge-browser-test`);
    await page.getByTestId("nav-nexus-omni").waitFor({ timeout: 30000 });
    await page.waitForTimeout(500);
  }
  try {
    await load();
    for (const [kind, text, href] of [
      ["sms", "37", "/email?tab=sms"],
      ["chat", "1", "/email?tab=chats"],
      ["email", "8", "/email?tab=email"],
    ]) {
      assert.equal(await badge(kind).innerText(), text);
      assert.equal(await badge(kind).getAttribute("href"), href);
      assert.equal(await badge(kind).locator("svg").count(), 1);
      assert.match(await badge(kind).getAttribute("aria-label"), new RegExp(text));
    }
    assert.equal(await page.getByTestId("button-open-my-tasks").getAttribute("href"), "/email?tab=tasks&filter=open&view=my");
    assert.equal(emailRequests, 1, "sidebar and header share one email query");
    assert.equal(await page.locator("a a").count(), 0, "no nested navigation links");
    assert.deepEqual(errors, []);
    for (const theme of ["light", "dark"]) {
      await page.evaluate(dark => document.documentElement.classList.toggle("dark", dark), theme === "dark");
      await page.screenshot({ path: `/tmp/sidebar-badges-${theme}.png` });
      const fits = await page.locator(".sidebar-omni-counts").evaluate(el => {
        const row = el.parentElement.getBoundingClientRect();
        return [...el.children].every(child => {
          const b = child.getBoundingClientRect();
          return b.x >= row.x && b.right <= row.right && b.height > 0;
        });
      });
      assert.ok(fits, `${theme}: all badges fit the native sidebar`);
    }
    counts = { sms: 128, email: 500, chat: 104, task: 142 };
    await load();
    for (const kind of ["sms", "chat", "email"]) assert.equal(await badge(kind).innerText(), "99+");
    assert.equal(await page.getByTestId("button-open-my-tasks").innerText(), "99+");
    assert.match(await badge("email").getAttribute("aria-label"), /500/);
    const overflow = await page.locator(".sidebar-omni-counts").evaluate(el => el.getBoundingClientRect().right > el.parentElement.getBoundingClientRect().right + 1);
    assert.equal(overflow, false);
    await page.setViewportSize({ width: 390, height: 844 });
    // On mobile the sidebar is closed by default; restore desktop for zero state.
    await page.setViewportSize({ width: 1280, height: 900 });
    counts = { sms: 0, email: 0, chat: 0, task: 0 };
    connected = false;
    await load();
    assert.equal(await page.locator(".sidebar-count-pill").count(), 0, "zero/disconnected badges are hidden");
    assert.deepEqual(errors, []);
    console.log("PASS: real sidebar, four icons, live-query binding, per-type links, shared fetch, zero/disconnected, 99+, light/dark and native width.");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
