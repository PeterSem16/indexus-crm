const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { build } = require("esbuild");
const postcss = require("postcss");
const tailwind = require("tailwindcss");
const autoprefixer = require("autoprefixer");
const { chromium, expect } = require("@playwright/test");

// Isolated real-hook/real-dialog regression. Only useAuth is substituted at
// bundle time; production auth and native browser fetch are left unchanged.
const ROOT = process.cwd();
const screenshots = path.join(ROOT, ".local/screenshots");
const harness = `
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { FixtureAuthProvider } from "@/contexts/auth-context";
import { I18nProvider } from "@/i18n/I18nProvider";
import { useTaskSettingsAccess } from "@/hooks/use-task-settings-access";
import { TaskGroupsDialog } from "@/components/tasks/task-groups-dialog";
import "@/index.css";

function Fixture() {
  const [open, setOpen] = useState(true);
  const access = useTaskSettingsAccess();
  Object.assign(window.__settings, {
    reopen: () => setOpen(true),
    invalidate: () => queryClient.invalidateQueries({ queryKey: ["/api/task-settings/access"] }),
    invalidateAssignment: () => queryClient.invalidateQueries({ queryKey: ["/api/task-settings/users"] }),
    observers: () => queryClient.getQueryCache().getAll()
      .map(query => ({ key: query.queryKey, observers: query.getObserversCount() })),
  });
  return <>
    <output data-testid="access-state">{JSON.stringify({ ...access, open })}</output>
    <TaskGroupsDialog open={open} onOpenChange={setOpen} />
  </>;
}
createRoot(document.getElementById("root")).render(
  <FixtureAuthProvider>
    <I18nProvider userCountries={["US"]}>
      <QueryClientProvider client={queryClient}><Fixture /></QueryClientProvider>
    </I18nProvider>
  </FixtureAuthProvider>
);
`;
const authStub = `
import React, { createContext, useContext, useState } from "react";
const Auth = createContext(null);
export function FixtureAuthProvider({ children }) {
  const [user, setUser] = useState(window.__settings.user);
  window.__settings.setUser = setUser;
  return <Auth.Provider value={{ user }}>{children}</Auth.Provider>;
}
export function useAuth() { return useContext(Auth); }
`;
const user = { id: "fixture-admin", username: "fixture", fullName: "Fixture Administrator", role: "user" };
const assignmentUsers = [
  { ...user, email: "fixture@example.test", avatarUrl: null, isActive: true },
  { id: "user-elodie", username: "elodie", fullName: "Élodie Alvarez", email: "elodie@example.test", avatarUrl: null, isActive: true },
  { id: "user-zoe", username: "zoe", fullName: "Zoë Accent", email: "zoe@example.test", avatarUrl: null, isActive: true },
  { id: "user-inactive", username: "retired", fullName: "Inactive User", email: "retired@example.test", avatarUrl: null, isActive: false },
];
const groups = [{
  id: "fixture-group", name: "Authorized settings group", description: "Browser regression fixture",
  color: "#3b82f6", members: [], sortOrder: 0,
}];

function assertPageGates() {
  const omni = fs.readFileSync(path.join(ROOT, "client/src/pages/email-client.tsx"), "utf8");
  assert.match(omni, /canManage:\s*canManageTaskSettings[\s\S]*?=\s*useTaskSettingsAccess\(\)/);
  assert.match(omni, /if \(params\.get\("taskSettings"\) === "1"\) \{\s*if \(taskSettingsAccessPending\) return;[\s\S]*?setTaskGroupsDialogOpen\(canManageTaskSettings\);[\s\S]*?params\.delete\("taskSettings"\)/);
  assert.match(omni, /\{canManageTaskSettings && <Button[^\n]*data-testid="btn-task-groups-nexus"/);
  assert.match(omni, /<TaskGroupsDialog open=\{taskGroupsDialogOpen && canManageTaskSettings\}/);
  const legacy = fs.readFileSync(path.join(ROOT, "client/src/pages/task-groups.tsx"), "utf8");
  assert.match(legacy, /const \{ canManage, isPending \} = useTaskSettingsAccess\(\)/);
  assert.match(legacy, /if \(isPending\) return null/);
  assert.match(legacy, /<Redirect to=\{canManage \? "\/email\?tab=tasks&taskSettings=1" : "\/email\?tab=tasks"\}/);
}

async function compile() {
  const result = await build({
    stdin: { contents: harness, resolveDir: ROOT, sourcefile: "task-settings-browser-fixture.tsx", loader: "tsx" },
    bundle: true, write: false, outfile: "/tmp/task-settings-browser-fixture.js",
    platform: "browser", format: "iife", jsx: "automatic", target: ["es2020"],
    alias: { "@": path.join(ROOT, "client/src") },
    plugins: [{
      name: "fixture-auth-only",
      setup(builder) {
        builder.onResolve({ filter: /(?:@\/contexts\/auth-context|\/contexts\/auth-context)$/ },
          () => ({ path: "auth-fixture", namespace: "fixture-auth" }));
        builder.onLoad({ filter: /.*/, namespace: "fixture-auth" },
          () => ({ contents: authStub, loader: "tsx", resolveDir: ROOT }));
      },
    }],
  });
  const rawCSS = result.outputFiles.find(file => file.path.endsWith(".css"));
  assert.ok(rawCSS, "Bundle must include the real dialog's shared CSS.");
  const css = await postcss([
    tailwind({ config: path.join(ROOT, "tailwind.config.ts") }), autoprefixer(),
  ]).process(rawCSS.text, { from: path.join(ROOT, "client/src/index.css") });
  return { js: result.outputFiles.find(file => file.path.endsWith(".js")).text, css: css.css };
}

async function main() {
  assertPageGates();
  console.log("PASS source gates: Omni gear, URL pending/permission gate, dialog mount, legacy redirect");
  const compiled = await compile();
  const server = http.createServer((req, res) => {
    if (req.url === "/fixture.js" || req.url === "/fixture.css") {
      const js = req.url.endsWith(".js");
      res.writeHead(200, { "Content-Type": js ? "text/javascript" : "text/css" });
      return res.end(js ? compiled.js : compiled.css);
    }
    if (req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/html" });
      return res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
    }
    res.writeHead(404);
    res.end("Unexpected fixture request");
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const allPageErrors = [];
  const unexpectedRequests = [];
  const reportedBugs = [];
  let browser;
  let cases = 0;
  try {
    browser = await chromium.launch({
      headless: true, executablePath: process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium",
      args: ["--no-sandbox"],
    });
    async function fixture(response = { body: { canManage: true } }, authUser = user, options = {}) {
      const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
      page.on("pageerror", error => allPageErrors.push(error.message));
      const requests = [];
      const pending = [];
      const state = {
        response,
        assignment: options.assignment || {
          configured: false, allowedUserIds: [], users: assignmentUsers, updatedAt: null,
        },
        assignmentGetFailures: options.assignmentGetFailures || 0,
        puts: [],
        putResponses: [...(options.putResponses || [])],
      };
      await page.route("**/api/**", async route => {
        const request = route.request();
        const pathname = new URL(request.url()).pathname;
        const requestUrl = new URL(request.url());
        requests.push({ path: pathname, search: requestUrl.search, method: request.method(), body: request.postDataJSON() });
        let reply;
        if (pathname === "/api/task-settings/access" && request.method() === "GET") {
          reply = state.response;
          if (reply.defer) reply = await new Promise(resolve => pending.push(resolve));
        } else if (pathname === "/api/task-settings/groups" && request.method() === "GET") {
          reply = { body: groups };
        } else if (pathname === "/api/task-settings/users" && request.method() === "GET") {
          if (state.assignmentGetFailures > 0) {
            state.assignmentGetFailures--;
            reply = { status: 503, body: { error: "Assignment settings temporarily unavailable" } };
          } else reply = { body: state.assignment };
        } else if (pathname === "/api/task-settings/users" && request.method() === "PUT") {
          const body = request.postDataJSON();
          state.puts.push(body);
          reply = state.putResponses.shift();
          if (!reply) {
            state.assignment = {
              configured: true,
              allowedUserIds: body.allowedUserIds,
              users: assignmentUsers,
              updatedAt: "2025-01-02T03:04:05.000Z",
            };
            reply = { body: state.assignment };
          }
        } else if (pathname === "/api/users" && request.method() === "GET") {
          reply = { body: assignmentUsers };
        } else {
          unexpectedRequests.push(`${request.method()} ${pathname}`);
          reply = { status: 500, body: { error: "Unexpected fixture API request" } };
        }
        await route.fulfill({
          status: reply.status || 200, contentType: "application/json",
          body: JSON.stringify(reply.body),
        });
      });
      await page.addInitScript(user => { window.__settings = { user }; }, authUser);
      await page.goto(origin);
      await page.getByTestId("access-state").waitFor();
      return { page, requests, pending, state };
    }
    const managementRequests = requests => requests.filter(request => request.path !== "/api/task-settings/access");
    async function denied(page) {
      await expect(page.getByTestId("access-state")).toHaveText(JSON.stringify({
        canManage: false, isPending: false, open: false,
      }));
      await expect(page.getByTestId("dialog-task-groups")).toHaveCount(0);
    }
    async function ready(page) {
      await expect(page.getByTestId("dialog-task-groups")).toBeVisible();
      await expect(page.getByTestId("text-group-name-fixture-group")).toHaveText(groups[0].name);
    }
    async function test(name, run) {
      await run();
      cases++;
      console.log(`PASS ${name}`);
    }
    await test("pending access never mounts editor or fetches management data", async () => {
      const { page, requests, pending } = await fixture({ defer: true });
      await expect(page.getByTestId("access-state")).toHaveText(JSON.stringify({
        canManage: false, isPending: true, open: true,
      }));
      await expect.poll(() => pending.length).toBe(1);
      await expect(page.getByTestId("dialog-task-groups")).toHaveCount(0);
      assert.deepEqual(managementRequests(requests), []);
      pending.shift()({ body: { canManage: false } });
      await denied(page);
      assert.deepEqual(managementRequests(requests), []);
      await page.close();
    });
    for (const [name, response] of [
      ["denied", { body: { canManage: false } }],
      ["HTTP 403", { status: 403, body: { error: "Administrator access required" } }],
      ["HTTP 503", { status: 503, body: { error: "Settings service unavailable" } }],
      ["non-boolean authority", { body: { canManage: "true" } }],
    ]) {
      await test(`${name} fails closed without user/group management requests`, async () => {
        const { page, requests } = await fixture(response, { ...user, role: "admin" });
        await denied(page);
        await page.evaluate(() => window.__settings.reopen());
        await denied(page);
        assert.deepEqual(managementRequests(requests), []);
        assert.equal(requests.filter(request => request.path === "/api/task-settings/access").length, 1);
        await page.close();
      });
    }
    await test("first save can explicitly approve all existing active users without toggling", async () => {
      const { page, state } = await fixture();
      await ready(page);
      await page.getByTestId("tab-assigned-users").click();
      await expect(page.getByTestId("text-assignment-selected-count")).toHaveText("3 selected");
      await expect(page.getByTestId("btn-save-assignment-users")).toBeEnabled();
      await page.getByTestId("btn-save-assignment-users").click();
      await expect(page.getByTestId("btn-save-assignment-users")).toBeDisabled();
      assert.equal(state.puts.length, 1);
      assert.equal(state.puts[0].allowedUserIds.length, 3);
      assert.equal(state.puts[0].expectedUpdatedAt, null);
      assert.equal(state.assignment.configured, true);
      await page.close();
    });
    await test("assignment defaults, normalized search, staged selection, dirty-close guard, and groups CRUD remain reachable", async () => {
      const { page, requests, state } = await fixture();
      await ready(page);
      await expect.poll(() => managementRequests(requests).length).toBe(3);
      assert.deepEqual(managementRequests(requests).map(request => request.path).sort(),
        ["/api/task-settings/groups", "/api/task-settings/users", "/api/users"]);
      assert.ok(requests.filter(request => request.path.startsWith("/api/task-settings/") || request.path === "/api/users")
        .every(request => request.search === ""), "User-scoped API calls must keep stable endpoint URLs.");
      const assignedUsersTab = page.getByTestId("tab-assigned-users");
      await assignedUsersTab.click();
      const selectedCount = page.getByTestId("text-assignment-selected-count");
      await expect(selectedCount).toHaveText("3 selected");
      for (const term of ["ÉLODIE", "alvarez", "elodie@example.test", "ELODIE"]) {
        await page.getByTestId("input-assignment-user-search").fill(term);
        await expect(page.getByTestId("assignment-user-user-elodie")).toBeVisible();
        await expect(page.getByTestId("assignment-user-user-zoe")).toHaveCount(0);
        await expect(selectedCount).toHaveText("3 selected");
      }
      const inactive = page.getByTestId("assignment-user-user-inactive");
      await page.getByTestId("input-assignment-user-search").fill("retired");
      await expect(inactive).toHaveAttribute("aria-disabled", "true");
      await inactive.click({ force: true });
      await expect(selectedCount).toHaveText("3 selected");

      // Stage a change, filter away and back, and force a settings rerender/refetch.
      await page.getByTestId("input-assignment-user-search").fill("");
      await page.getByTestId("assignment-user-user-zoe").click();
      await expect(selectedCount).toHaveText("2 selected");
      await page.getByTestId("input-assignment-user-search").fill("fixture");
      await expect(page.getByTestId("assignment-user-fixture-admin")).toHaveAttribute("aria-pressed", "true");
      await page.evaluate(() => window.__settings.invalidateAssignment());
      await expect.poll(() => requests.filter(request => request.path === "/api/task-settings/users" && request.method === "GET").length).toBe(2);
      await page.getByTestId("input-assignment-user-search").fill("");
      await expect(page.getByTestId("assignment-user-user-zoe")).toHaveAttribute("aria-pressed", "false");
      await expect(selectedCount).toHaveText("2 selected");

      // Dirty assignment changes must be confirmed before closing; cancelling keeps the draft.
      await page.getByTestId("dialog-task-groups").getByRole("button", { name: "Close" }).click();
      const discardAction = page.getByRole("button", { name: "Discard changes" });
      if (await discardAction.count()) {
        await expect(discardAction).toBeVisible();
        await page.getByRole("button", { name: "Cancel" }).click();
        await expect(page.getByTestId("dialog-task-groups")).toBeVisible();
        await expect(selectedCount).toHaveText("2 selected");
      } else {
        reportedBugs.push("Closing task settings with a dirty assignment draft closes immediately without a discard confirmation, losing the staged draft.");
        await page.evaluate(() => window.__settings.reopen());
        await ready(page);
        await page.getByTestId("tab-assigned-users").click();
        await expect(selectedCount).toHaveText("3 selected");
        await page.getByTestId("assignment-user-user-zoe").click();
        await expect(selectedCount).toHaveText("2 selected");
      }
      await page.getByTestId("btn-save-assignment-users").click();
      await expect.poll(() => state.puts.length).toBe(1);
      assert.deepEqual(state.puts[0], {
        allowedUserIds: ["fixture-admin", "user-elodie"],
        expectedUpdatedAt: null,
      }, "Save must send the exact staged allow-list and snapshot version.");
      await expect(selectedCount).toHaveText("2 selected");
      await page.getByTestId("dialog-task-groups").getByRole("button", { name: "Close" }).click();
      await expect(page.getByTestId("dialog-task-groups")).toHaveCount(0);
      await page.evaluate(() => window.__settings.reopen());
      await ready(page);
      await page.getByTestId("tab-assigned-users").click();
      await expect(selectedCount).toHaveText("2 selected");
      await expect(page.getByTestId("assignment-user-user-zoe")).toHaveAttribute("aria-pressed", "false");

      // The footer remains in the viewport at the requested desktop and phone dimensions.
      const assignmentSearch = page.getByTestId("input-assignment-user-search");
      const assignmentList = page.getByTestId("assignment-user-list");
      const assignmentRows = ["fixture-admin", "user-elodie", "user-zoe"]
        .map(id => page.getByTestId(`assignment-user-${id}`));
      for (const viewport of [{ width: 900, height: 700 }, { width: 390, height: 700 }]) {
        await page.setViewportSize(viewport);
        const dialogBox = await page.getByTestId("dialog-task-groups").boundingBox();
        const footerBox = await page.getByTestId("dialog-task-groups").locator(".task-modern-modal-footer").boundingBox();
        const searchBox = await assignmentSearch.boundingBox();
        const listBox = await assignmentList.boundingBox();
        fs.mkdirSync(screenshots, { recursive: true });
        await page.screenshot({
          path: path.join(screenshots, `task-settings-assigned-users-${viewport.width}x${viewport.height}.png`),
          animations: "disabled",
        });
        assert.ok(dialogBox && footerBox && searchBox && listBox,
          `Assigned-user controls and list must render at ${viewport.width}x${viewport.height}.`);
        assert.ok(searchBox.y >= dialogBox.y && searchBox.y + searchBox.height <= footerBox.y,
          `The user search must be visible above the footer at ${viewport.width}x${viewport.height}.`);
        assert.ok(listBox.y >= dialogBox.y && listBox.y + listBox.height <= footerBox.y,
          `The user list must fit above the footer at ${viewport.width}x${viewport.height}: ${JSON.stringify({ dialogBox, listBox, footerBox })}.`);
        for (const row of assignmentRows) {
          await expect(row).toBeVisible();
          const rowBox = await row.boundingBox();
          assert.ok(rowBox && rowBox.y >= dialogBox.y && rowBox.y + rowBox.height <= footerBox.y,
            `Several user checkbox rows must be visible above the footer at ${viewport.width}x${viewport.height}: ${JSON.stringify({ rowBox, listBox, footerBox })}.`);
        }
        for (const controlId of ["btn-save-assignment-users", "btn-cancel-assignment-users"]) {
          const controlBox = await page.getByTestId(controlId).boundingBox();
          assert.ok(controlBox && controlBox.y >= 0 && controlBox.y + controlBox.height <= viewport.height,
            `${controlId} must fit within ${viewport.width}x${viewport.height}.`);
        }
      }
      await page.getByTestId("tab-task-groups").click();
      await expect(page.getByTestId("task-group-card-fixture-group")).toBeVisible();
      await page.getByTestId("btn-edit-group-fixture-group").click();
      await expect(page.getByTestId("input-group-name")).toBeVisible();
      await page.getByTestId("btn-cancel-group").click();
      await page.getByTestId("btn-delete-group-fixture-group").click();
      await expect(page.getByRole("alertdialog")).toBeVisible();
      await page.getByRole("button", { name: "Cancel" }).click();
      await page.getByTestId("btn-create-group").click();
      await expect(page.getByTestId("input-group-name")).toBeVisible();
      await expect(page.getByTestId(`member-toggle-${user.id}`)).toBeVisible();
      await page.close();
    });
    await test("deliberate empty assignment save warns and sends an explicit empty list", async () => {
      const { page, state } = await fixture();
      await ready(page);
      await page.getByTestId("tab-assigned-users").click();
      await expect(page.getByTestId("text-assignment-selected-count")).toHaveText("3 selected");
      await page.getByTestId("btn-clear-assigned-users").click();
      await expect(page.getByRole("alert").filter({ hasText: "No users are selected" })).toBeVisible();
      await expect(page.getByTestId("btn-save-assignment-users")).toBeEnabled();
      await page.getByTestId("btn-save-assignment-users").click();
      await expect.poll(() => state.puts.length).toBe(1);
      assert.deepEqual(state.puts[0], { allowedUserIds: [], expectedUpdatedAt: null });
      await expect(page.getByTestId("text-assignment-selected-count")).toHaveText("0 selected");
      await expect(page.getByRole("alert").filter({ hasText: "No users are selected" })).toBeVisible();
      await page.close();
    });
    await test("assignment settings load failure retries successfully", async () => {
      const { page, requests } = await fixture({ body: { canManage: true } }, user, { assignmentGetFailures: 1 });
      await ready(page);
      await page.getByTestId("tab-assigned-users").click();
      await expect(page.getByTestId("btn-retry-assignment-settings")).toBeVisible();
      await page.getByTestId("btn-retry-assignment-settings").click();
      await expect(page.getByTestId("text-assignment-selected-count")).toHaveText("3 selected");
      assert.equal(requests.filter(request => request.path === "/api/task-settings/users" && request.method === "GET").length, 2);
      await page.close();
    });
    await test("user-scoped settings keep stable endpoint URLs across authenticated users", async () => {
      const { page, requests } = await fixture();
      await ready(page);
      await expect.poll(() => requests.filter(request => request.path === "/api/task-settings/users" && request.method === "GET").length).toBe(1);
      await page.evaluate(() => window.__settings.setUser({
        id: "second-admin", username: "second", fullName: "Second Administrator", role: "user",
      }));
      await expect.poll(() => requests.filter(request => request.path === "/api/task-settings/users" && request.method === "GET").length).toBe(2);
      await expect.poll(() => requests.filter(request => request.path === "/api/task-settings/access" && request.method === "GET").length).toBe(2);
      assert.ok(requests.filter(request => request.path.startsWith("/api/task-settings/"))
        .every(request => request.search === ""), "Authenticated-user scoping belongs to query identity, not API URL parameters.");
      await page.close();
    });
    await test("save errors retain draft for retry; 409 refresh retains draft and adopts latest version", async () => {
      const saveFailure = { status: 503, body: { error: "Temporary save failure" } };
      const conflict = { status: 409, body: { error: "Settings changed" } };
      const latest = {
        configured: true,
        allowedUserIds: ["fixture-admin", "user-zoe"],
        users: assignmentUsers,
        updatedAt: "2025-02-03T04:05:06.000Z",
      };
      const { page, state } = await fixture({ body: { canManage: true } }, user, {
        assignment: {
          configured: true,
          allowedUserIds: ["fixture-admin", "user-elodie"],
          users: assignmentUsers,
          updatedAt: "2025-01-01T00:00:00.000Z",
        },
        putResponses: [saveFailure, conflict],
      });
      await ready(page);
      await page.getByTestId("tab-assigned-users").click();
      await page.getByTestId("assignment-user-user-zoe").click();
      await page.getByTestId("btn-save-assignment-users").click();
      await expect(page.getByRole("alert").filter({ hasText: "Temporary save failure" })).toBeVisible();
      await expect(page.getByTestId("text-assignment-selected-count")).toHaveText("3 selected");
      assert.deepEqual(state.puts[0], {
        allowedUserIds: ["fixture-admin", "user-elodie", "user-zoe"],
        expectedUpdatedAt: "2025-01-01T00:00:00.000Z",
      }, "A failed save must retain the exact draft and allow retry.");
      await page.getByTestId("btn-save-assignment-users").click();
      await expect(page.getByRole("alert").filter({ hasText: "changed since you loaded" })).toBeVisible();
      await expect(page.getByTestId("text-assignment-selected-count")).toHaveText("3 selected");
      assert.deepEqual(state.puts[1], state.puts[0]);
      state.assignment = latest;
      await page.getByRole("button", { name: "Refresh latest settings" }).click();
      await expect(page.getByTestId("text-assignment-selected-count")).toHaveText("3 selected");
      await page.getByTestId("btn-save-assignment-users").click();
      await expect.poll(() => state.puts.length).toBe(3);
      assert.deepEqual(state.puts[2], {
        allowedUserIds: ["fixture-admin", "user-elodie", "user-zoe"],
        expectedUpdatedAt: latest.updatedAt,
      }, "After conflict refresh, retry must preserve the draft and use the refreshed version.");
      await page.close();
    });
    for (const [name, response] of [
      ["permission denial", { body: { canManage: false } }],
      ["access endpoint error", { status: 403, body: { error: "Access revoked" } }],
    ]) {
      await test(`invalidation after ${name} unmounts dirty editor and management observers`, async () => {
        const { page, requests, state } = await fixture();
        await ready(page);
        await page.getByTestId("btn-create-group").click();
        await page.getByTestId("input-group-name").fill("Unsaved privileged state");
        const before = managementRequests(requests).length;
        state.response = response;
        await page.evaluate(() => window.__settings.invalidate());
        await denied(page);
        await expect(page.getByTestId("input-group-name")).toHaveCount(0);
        const observers = await page.evaluate(() => window.__settings.observers());
        for (const entry of observers.filter(entry => ["/api/task-settings/groups", "/api/task-settings/users", "/api/users"].includes(entry.key[0]))) {
          assert.equal(entry.observers, 0, "Privileged queries must have no mounted observers after revocation");
        }
        await page.evaluate(() => window.__settings.reopen());
        await denied(page);
        assert.equal(managementRequests(requests).length, before);
        assert.equal(requests.filter(request => request.path === "/api/task-settings/access").length, 2);
        await page.screenshot({ path: path.join(screenshots, `task-settings-revoked-${response.status || 200}.png`), animations: "disabled" });
        await page.close();
      });
    }
    await test("signed-out user never requests access or management data", async () => {
      const { page, requests } = await fixture(undefined, null);
      await denied(page);
      assert.deepEqual(requests, []);
      await page.close();
    });
    await test("sign-out unmounts an already-authorized dialog despite cached permission", async () => {
      const { page, requests } = await fixture();
      await ready(page);
      const before = requests.length;
      await page.evaluate(() => window.__settings.setUser(null));
      await denied(page);
      assert.equal(requests.length, before);
      await page.close();
    });
    assert.deepEqual(allPageErrors, [], "No browser pageerrors are allowed.");
    assert.deepEqual(unexpectedRequests, [], "No unexpected management endpoints or mutations are allowed.");
    console.log(`Task settings access checks completed: ${cases} browser cases + source gates; 0 pageerrors; 0 unexpected API requests.`);
    console.log("Screenshots: .local/screenshots/task-settings-assigned-users-{900x700,390x700}.png and revoked-access captures.");
    if (reportedBugs.length) {
      for (const bug of reportedBugs) console.error(`BUG: ${bug}`);
      process.exitCode = 1;
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });