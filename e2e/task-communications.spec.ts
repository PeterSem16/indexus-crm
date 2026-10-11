import { test, expect, type Page } from "@playwright/test";
import { translations } from "../client/src/i18n/translations";
const c = translations.en.taskCommunication;
test.setTimeout(90_000); // Real CRM imports can cold-transform slowly in the preview environment.
const users = [
  { id: "viewer", fullName: "Test Agent", username: "agent" },
  { id: "a", fullName: "Test Colleague A", username: "colleague-a" },
  { id: "b", fullName: "Test Colleague B", username: "colleague-b" },
];
const tasks = [
  { id: "task-one", title: "First real-source request", description: "Original authored request", createdByUserId: "viewer", assignedUserId: "a", status: "pending", boState: "waiting_agent", tags: ["group_id:bo", "group:Back Office", "back_office"], requestRecipients: { userIds: ["b"], typeId: "change_data", typeName: "change_data" }, attachments: [], createdAt: "2026-10-10T08:00:00Z" },
  { id: "task-two", title: "Second request", description: "Second original content", createdByUserId: "viewer", assignedUserId: "b", status: "in_progress", tags: [], requestRecipients: { userIds: ["b"] }, attachments: [], createdAt: "2026-10-10T07:00:00Z" },
];
test("Inbox excludes other authors and changes its request scope with the Mission", async ({ page }) => {
  await setup(page);
  await page.route("**/api/tasks/created?missionId=*", async route => {
    const mission = new URL(route.request().url()).searchParams.get("missionId");
    await route.fulfill({ json: [
      { ...tasks[1], id: mission, title: `Own request in ${mission}` },
      { ...tasks[1], id: "foreign", createdByUserId: "a", title: "Another agent's request" },
    ] });
  });
  await page.route("**/api/agent/bo-questions?missionId=*", route => route.fulfill({ json: [] }));
  await page.route("**/api/tasks/mission-*/comments", route => route.fulfill({ json: [] }));
  await page.goto("/test-fixtures/task-communications.html?scope");
  await expect(page.getByText("Own request in mission-one").first()).toBeVisible();
  await expect(page.getByText("Another agent's request")).toHaveCount(0);
  await page.getByTestId("switch-mission").evaluate((button: HTMLButtonElement) => button.click());
  await expect(page.getByText("Own request in mission-two").first()).toBeVisible();
  await expect(page.getByText("Own request in mission-one")).toHaveCount(0);
  await expect(page.getByText("Another agent's request")).toHaveCount(0);
});
async function setup(page: Page) {
  const currentTasks: any[] = structuredClone(tasks);
  const unread: Record<string, number> = { a: 1, b: 0 };
  let chatSocket: any;
  const comments: Record<string, any[]> = { "task-one": [{ id: "question", taskId: "task-one", userId: "a", kind: "question", content: "Please clarify", createdAt: "2026-10-10T09:00:00Z" }], "task-two": [] };
  const messages: Record<string, any[]> = { a: [{ id: "initial-a", senderId: "a", receiverId: "viewer", content: "Private A message", createdAt: "2026-10-10T09:00:00Z" }], b: [] };
  const routes = [{ id: "change_data", name: "change_data", groupIds: ["bo"], userIds: ["a"], enabled: true }, { id: "other", name: "other", groupIds: [], userIds: [], enabled: false }];
  let deliveries = true;
  const writes: { url: string; body: any }[] = [];
  const socketWrites: any[] = [];
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/**", async route => {
    const request = route.request();
    const url = new URL(request.url()).pathname;
    const method = request.method();
    let data: unknown = [];
    if (method !== "GET") writes.push({ url, body: request.headers()["content-type"]?.includes("application/json") ? request.postDataJSON() : null });
    if (url === "/api/auth/me") data = { user: { ...users[0], role: "admin", isActive: true, assignedCountries: ["SK"], locale: "en" } };
    else if (url === "/api/users") data = users.map(person => ({ ...person, role: "user", isActive: true }));
    else if (url === "/api/campaigns") data = [{ id: "mission-chat", name: "Chat permissions Mission", type: "outbound", status: "active", channel: "phone", countryCodes: ["SK"], tags: [], createdAt: "2026-10-10T09:00:00Z" }];
    else if (url === "/api/campaigns/mission-chat/agents") data = [{ id: "assignment", userId: "viewer", campaignId: "mission-chat", chatUserIds: ["a"] }];
    else if (url === "/api/campaigns/batch-stats") data = {};
    else if (url === "/api/task-settings/access") data = { canManage: true };
    else if (url === "/api/tasks/created") data = currentTasks;
    else if (url === "/api/agent/bo-questions") data = currentTasks.filter(task => task.boState === "waiting_agent" && task.tags.includes("back_office")).map(task => ({
      task, question: { id: "question", content: "Please clarify", userId: "a", userName: users[1].fullName, createdAt: "2026-10-10T09:00:00Z" }, comments: comments[task.id],
    }));
    else if (url === "/api/tasks/attachments" && method === "POST") data = { id: "upload-one", name: "document.pdf", type: "application/pdf", size: 9, url: "/api/tasks/attachments/upload-one" };
    else if (url === "/api/tasks/people") data = users;
    else if (url === "/api/task-settings/users") data = { configured: false, allowedUserIds: [], users: users.map(user => ({ ...user, isActive: true, email: null, avatarUrl: null })), updatedAt: null };
    else if (url === "/api/chat/people") data = users.slice(1);
    else if (url === "/api/chat/conversations") data = Object.entries(messages).filter(([, rows]) => rows.length).map(([id, rows]) => ({ partnerId: id, partner: users.find(user => user.id === id), unreadCount: unread[id], lastMessage: rows.at(-1) }));
    else if (url.endsWith("/call-forwarding")) data = { enabled: false, number: null };
    else if (url.startsWith("/api/chat/messages/")) data = messages[url.split("/").at(-1)!] || [];
    else if (url === "/api/tasks/assignment-options") data = { users: users.slice(1), groups: [{ id: "bo", name: "Back Office" }, { id: "it", name: "IT" }], canResolve: true };
    else if (url === "/api/task-groups" || url === "/api/task-settings/groups") data = [{ id: "bo", name: "Back Office", members: [users[1]], memberCount: 1, memberIds: ["a"] }];
    else if (url === "/api/task-request-types" && method === "GET") data = routes;
    else if (/\/api\/task-request-types\/[^/]+/.test(url) && method === "PUT") {
      const id = url.split("/").at(-1)!;
      const row = routes.find(row => row.id === id)!; Object.assign(row, request.postDataJSON()); data = row;
    } else if (url === "/api/task-request-types" && method === "POST") {
      data = { id: "new-type", ...request.postDataJSON() }; routes.push(data as any);
    } else if (url.startsWith("/api/task-request-types/") && method === "DELETE") {
      routes.splice(routes.findIndex(row => row.id === url.split("/").at(-1)), 1);
      await route.fulfill({ status: 204 }); return;
    } else if (/\/api\/tasks\/[^/]+\/comments/.test(url)) {
      const id = url.split("/")[3];
      if (method === "POST") comments[id].push({ id: `comment-${comments[id].length}`, userId: "viewer", content: request.postDataJSON().content, kind: "comment", createdAt: new Date().toISOString() });
      data = method === "GET" ? comments[id] : comments[id].at(-1);
    } else if (/\/api\/agent\/bo-questions\/[^/]+\/answer/.test(url)) {
      const id = url.split("/")[4];
      comments[id].push({ id: "answer", userId: "viewer", content: request.postDataJSON().content, kind: "answer", createdAt: new Date().toISOString() });
      data = comments[id].at(-1);
    }
    await route.fulfill({ json: data });
  });
  await page.routeWebSocket("**/ws/chat", socket => {
    chatSocket = socket;
    socket.onMessage(raw => {
      const message = JSON.parse(raw.toString());
      socketWrites.push(message);
      if (message.type === "auth") {
        socket.send(JSON.stringify({ type: "auth_success", userId: "viewer" }));
        socket.send(JSON.stringify({ type: "presence_update", onlineUsers: users }));
      } else if (message.type === "mark_read") {
        unread[message.senderId] = 0;
        socket.send(JSON.stringify({ type: "read_confirmed", senderId: message.senderId }));
      } else if (message.type === "chat_message" && deliveries) {
        const saved = { id: `sent-${messages[message.receiverId].length}`, senderId: "viewer", receiverId: message.receiverId, content: message.content, attachments: message.attachments || [], isRead: false, createdAt: new Date().toISOString() };
        messages[message.receiverId].push(saved);
        socket.send(JSON.stringify({ type: "message_sent", message: saved, clientMessageId: message.clientMessageId }));
      }
    });
  });
  return { writes, socketWrites, errors, currentTasks, comments, messages, emitChat: (payload: unknown) => chatSocket.send(JSON.stringify(payload)), setDeliveries: (value: boolean) => { deliveries = value; },
    incoming: (partnerId: string, content = "New private message", socketDelivery = true) => {
      const message = { id: `incoming-${partnerId}-${messages[partnerId].length}`, senderId: partnerId, receiverId: "viewer", content, createdAt: new Date().toISOString() };
      messages[partnerId].push(message); unread[partnerId]++;
      if (socketDelivery) chatSocket.send(JSON.stringify({ type: "new_message", message, sender: users.find(user => user.id === partnerId) }));
    },
  };
}
test("real communication center separates histories, retains per-thread drafts and answers BO questions", async ({ page }) => {
  test.setTimeout(90_000); // Cold Vite transforms the real CRM component graph.
  const state = await setup(page);
  await page.goto("/test-fixtures/task-communications.html");
  await expect(page.getByText("Original authored request")).toHaveCount(0);
  await page.getByTestId("inbox-tab-back-office").click();
  await expect(page.getByText("Original authored request")).toBeVisible();
  const taskDraft = page.getByRole("textbox", { name: c.taskMessage });
  await taskDraft.fill("Task one draft");
  await page.getByRole("button", { name: new RegExp(c.myRequests) }).click();
  await page.getByRole("button", { name: /Second request/ }).click();
  await expect(taskDraft).toHaveValue("");
  await taskDraft.fill("Task two draft");
  await page.getByTestId("inbox-tab-back-office").click();
  await page.locator(".center-task-list").getByRole("button", { name: /First real-source request/ }).click();
  await expect(taskDraft).toHaveValue("Task one draft");
  await page.getByRole("button", { name: c.addComment }).click();
  await expect(taskDraft).toHaveValue("");
  expect(state.writes.filter(write => write.url.includes("/answer"))).toEqual([{ url: "/api/agent/bo-questions/task-one/answer", body: { content: "Task one draft" } }]);
  await page.getByTestId("pulse-communication-center").getByRole("button", { name: new RegExp(c.directMessages) }).click();
  await page.locator(".icp-roster").getByRole("button", { name: /Test Colleague A/ }).click();
  await expect(page.locator(".icp-thread").getByText("Private A message", { exact: true })).toBeVisible();
  const direct = page.locator(".icp-root textarea");
  await direct.fill("Private A draft");
  await page.locator(".icp-roster").getByRole("button", { name: /Test Colleague B/ }).click();
  await expect(direct).toHaveValue("");
  await direct.fill("Private B draft");
  await page.locator(".icp-roster").getByRole("button", { name: /Test Colleague A/ }).click();
  await expect(direct).toHaveValue("Private A draft");
  await page.getByRole("button", { name: c.send, exact: true }).click();
  await expect(direct).toHaveValue("");
  await expect(page.locator(".icp-thread").getByText("Private A draft", { exact: true })).toBeVisible();
  const outgoing = await page.locator(".icp-thread .icp-message.is-own").last().boundingBox();
  const incoming = await page.locator(".icp-thread .icp-message.is-other").first().boundingBox();
  expect(outgoing!.x).toBeGreaterThan(incoming!.x);
  await page.screenshot({ path: "test-results/personal-inbox-chat-desktop.png" });
  await page.getByRole("button", { name: new RegExp(c.myRequests) }).click();
  await expect(page.locator(".center-detail").getByText("Private A draft", { exact: true })).toHaveCount(0);
  expect(state.errors).toEqual([]);
});
test("failed chat confirmation does not discard the draft", async ({ page }) => {
  const state = await setup(page);
  state.setDeliveries(false);
  await page.goto("/test-fixtures/task-communications.html");
  await page.getByTestId("pulse-communication-center").getByRole("button", { name: new RegExp(c.directMessages) }).click();
  await page.locator(".icp-roster").getByRole("button", { name: /Test Colleague A/ }).click();
  const draft = page.locator(".icp-root textarea");
  await draft.fill("Keep this unconfirmed draft");
  await page.getByRole("button", { name: c.send, exact: true }).click();
  await expect(draft).toHaveValue("Keep this unconfirmed draft");
  await expect(page.getByRole("button", { name: c.send, exact: true })).toBeDisabled();
  expect(state.errors).toEqual([]);
});
test("mobile private chat highlights online presence and keeps bubbles and sending within view", async ({ page }) => {
  const state = await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/test-fixtures/task-communications.html");
  await page.getByTestId("pulse-communication-center").getByRole("button", { name: new RegExp(c.directMessages) }).click();
  await page.locator(".icp-roster").getByRole("button", { name: /Test Colleague A/ }).click();
  await expect(page.locator(".icp-chat-person i.online")).toHaveCount(1);
  const composer = page.locator(".icp-root textarea");
  await composer.fill("Mobile reply");
  await page.getByRole("button", { name: c.send, exact: true }).click();
  await expect(composer).toHaveValue("");
  const bubble = page.locator(".icp-thread .icp-message.is-own").last();
  await expect(bubble).toContainText("Mobile reply");
  const bounds = await bubble.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "test-results/personal-inbox-chat-mobile.png" });
  expect(state.errors).toEqual([]);
});
test("Inbox tab switches preserve the same grey backdrop and dialog without remounting", async ({ page }) => {
  const state = await setup(page);
  await page.goto("/test-fixtures/task-communications.html");
  const dialog = page.getByTestId("pulse-communication-center");
  const backdrop = page.getByTestId("pulse-inbox-backdrop");
  await expect(dialog).toBeVisible();
  await expect(backdrop).toBeVisible();
  await dialog.evaluate(node => { node.dataset.sameDialog = "yes"; });
  await backdrop.evaluate(node => { node.dataset.sameBackdrop = "yes"; });
  const colour = await backdrop.evaluate(node => getComputedStyle(node).backgroundColor);
  const width = await page.evaluate(() => document.documentElement.clientWidth);
  for (let cycle = 0; cycle < 2; cycle++) {
    for (const label of [translations.en.backOffice.title, c.directMessages, c.myRequests]) {
      await dialog.locator(".center-tabs").getByRole("button", { name: new RegExp(label) }).click();
      await expect(dialog).toHaveAttribute("data-same-dialog", "yes");
      await expect(backdrop).toHaveAttribute("data-same-backdrop", "yes");
      await expect(backdrop).toBeVisible();
      expect(await backdrop.evaluate(node => getComputedStyle(node).backgroundColor)).toBe(colour);
      expect(await page.evaluate(() => document.documentElement.clientWidth)).toBe(width);
    }
  }
  await page.getByTestId("inbox-tab-back-office").click();
  await page.screenshot({ path: "test-results/inbox-back-office-stable-backdrop.png" });
  await page.mouse.click(2, 2);
  await expect(dialog).toBeVisible();
  await dialog.locator(".center-tabs").getByRole("button", { name: new RegExp(c.myRequests) }).click();
  await page.mouse.click(2, 2);
  await expect(dialog).toHaveCount(0);
  expect(state.errors).toEqual([]);
});

test("request recipients stay collapsed until adding a group or colleague and preserve selection", async ({ page }) => {
  const state = await setup(page);
  await page.goto("/test-fixtures/task-communications.html?recipients");
  const picker = page.getByTestId("request-recipients");
  const toggle = page.getByTestId("toggle-request-recipients");
  await expect(picker).toContainText("Back Office");
  await expect(picker).toContainText("Test Colleague A");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(picker.getByRole("checkbox")).toHaveCount(0);
  await expect(picker.getByRole("textbox")).toHaveCount(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await picker.getByRole("checkbox", { name: "IT", exact: true }).check();
  await picker.getByRole("checkbox", { name: "Test Colleague B", exact: true }).check();
  await picker.getByRole("textbox").fill("Colleague");
  await toggle.click();
  await expect(picker.getByRole("checkbox")).toHaveCount(0);
  await expect(picker).toContainText("IT");
  await expect(picker).toContainText("Test Colleague B");
  await page.screenshot({ path: "test-results/request-recipients-collapsed.png" });
  await toggle.click();
  await expect(picker.getByRole("textbox")).toHaveValue("");
  await expect(picker.getByRole("checkbox", { name: "Back Office", exact: true })).toBeChecked();
  await expect(picker.getByRole("checkbox", { name: "IT", exact: true })).toBeChecked();
  await expect(picker.getByRole("checkbox", { name: "Test Colleague B", exact: true })).toBeChecked();
  expect(state.errors).toEqual([]);
});

test("live Tasks settings save group/user combinations, create and delete request types", async ({ page }) => {
  const state = await setup(page);
  await page.goto("/test-fixtures/task-communications.html?settings");
  await page.getByTestId("tab-request-routing").click();
  await expect(page.getByRole("heading", { name: c.routingTitle, level: 1 })).toBeVisible();
  await page.getByTestId("toggle-request-recipients").click();
  await page.getByRole("checkbox", { name: "IT", exact: true }).check();
  await page.getByRole("checkbox", { name: "Test Colleague B", exact: true }).check();
  await page.getByRole("button", { name: translations.en.common.save, exact: true }).click();
  await expect.poll(() => state.writes.find(write => write.url === "/api/task-request-types/change_data")?.body).toMatchObject({ groupIds: ["bo", "it"], userIds: ["a", "b"] });
  await page.getByRole("button", { name: c.addType }).click();
  await page.locator("#request-type-name").fill("New authored request type");
  await page.getByRole("button", { name: translations.en.common.save, exact: true }).click();
  await expect(page.getByRole("button", { name: /New authored request type/ })).toBeVisible();
  await page.getByRole("button", { name: translations.en.common.delete, exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: translations.en.common.delete, exact: true }).click();
  await expect(page.getByRole("button", { name: /New authored request type/ })).toHaveCount(0);
  expect(state.errors).toEqual([]);
});
for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
  test(`center controls remain reachable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    const state = await setup(page);
    await page.setViewportSize(viewport);
    await page.goto("/test-fixtures/task-communications.html");
    await page.getByTestId("inbox-tab-back-office").click();
    const center = page.getByTestId("pulse-communication-center");
    await expect(page.getByText("Original authored request")).toBeVisible();
    const composer = page.getByRole("textbox", { name: c.taskMessage });
    await composer.scrollIntoViewIfNeeded();
    const bounds = await center.boundingBox();
    const inputBounds = await composer.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
    expect(inputBounds!.y + inputBounds!.height).toBeLessThanOrEqual(viewport.height);
    await page.screenshot({ path: `test-results/task-center-${viewport.width}.png` });
    expect(state.errors).toEqual([]);
  });
}
test("toolbar follows My Shift and retains task alerts until viewed, with live unread chat", async ({ page }) => {
  test.setTimeout(90_000);
  const state = await setup(page);
  await page.goto("/test-fixtures/task-communications.html?toolbar");
  const trigger = page.getByTestId("btn-toolbar-communication-center");
  await expect(trigger).toContainText("Inbox");
  await expect(trigger).not.toContainText("Pulse Inbox");
  await expect(page.getByTestId("btn-open-my-activity").locator("xpath=following-sibling::*[1]")).toHaveAttribute("data-testid", "btn-toolbar-communication-center");
  await expect(page.getByTestId("communication-updates-chat")).toContainText("1");
  await expect(page.getByTestId("communication-updates-progress")).toHaveCount(0);
  await expect(page.getByTestId("communication-updates-completed")).toHaveCount(0);
  await page.waitForFunction(() => !!localStorage.getItem("pulse-communication-seen:viewer"));
  state.currentTasks[0].status = "in_progress";
  state.currentTasks[1].status = "completed";
  await expect(page.getByTestId("communication-updates-progress")).toContainText("1", { timeout: 12000 });
  await expect(page.getByTestId("communication-updates-completed")).toContainText("1");
  await page.screenshot({ path: "test-results/communication-toolbar-updates.png" });
  await page.reload();
  await expect(page.getByTestId("communication-updates-progress")).toContainText("1");
  await expect(page.getByTestId("communication-updates-completed")).toContainText("1");
  await trigger.locator(".pta-communication-label").click();
  await expect(page.getByRole("heading", { name: "Pulse Inbox", level: 1 })).toBeVisible();
  await expect(page.getByTestId("communication-updates-completed")).toHaveCount(0);
  await expect(page.getByTestId("communication-updates-progress")).toContainText("1");
  await page.getByTestId("inbox-tab-back-office").click();
  await expect(page.getByTestId("communication-updates-progress")).toHaveCount(0);
  await page.getByTestId("pulse-communication-center").getByRole("button", { name: new RegExp(c.directMessages) }).click();
  await page.locator(".icp-roster").getByRole("button", { name: /Test Colleague A/ }).click();
  await expect(page.getByTestId("communication-updates-chat")).toHaveCount(0);
  await expect(page.getByTestId("communication-updates-back-office")).toContainText("1");
  state.incoming("b");
  await expect(page.getByTestId("communication-updates-chat")).toContainText("1");
  await expect(page.getByTestId("communication-updates-dot")).toHaveCount(1);
  await page.locator(".icp-roster").getByRole("button", { name: /Test Colleague B/ }).click();
  await expect(page.getByTestId("communication-updates-chat")).toHaveCount(0);
  expect(state.errors).toEqual([]);
});

test("shared Omni chat sends attachment-only messages and distinguishes incoming replies and read receipts", async ({ page }) => {
  const state = await setup(page);
  await page.goto("/test-fixtures/task-communications.html?omni");
  await page.getByRole("button", { name: new RegExp("Notification: " + c.directMessages) }).click();
  await expect(page).toHaveURL(/\/email\?tab=chats&partner=a/);
  await expect(page.locator(".icp-thread").getByText("Private A message", { exact: true })).toBeVisible();
  await page.getByTestId("input-task-attachment-files").setInputFiles({ name: "document.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-test") });
  await expect(page.getByTestId("chip-task-attachment-0")).toBeVisible();
  await page.getByRole("button", { name: c.send, exact: true }).click();
  await expect(page.locator(".icp-thread").getByRole("link", { name: /document.pdf/ })).toHaveAttribute("href", "/api/tasks/attachments/upload-one");
  await expect(page.getByTestId("chip-task-attachment-0")).toHaveCount(0);
  const colors = await page.locator(".icp-message").evaluateAll(rows => rows.map(row => getComputedStyle(row).backgroundColor));
  expect(new Set(colors).size).toBe(2);
  const own = page.locator(".icp-message.is-own");
  await expect(own).not.toContainText(translations.en.taskCommunication.read);
  state.emitChat({ type: "messages_read", readBy: "a" });
  await expect(own).toContainText(translations.en.taskCommunication.read);
  await page.screenshot({ path: "test-results/shared-omni-chat.png" });
  expect(state.errors).toEqual([]);
});

for (const theme of ["pulse", "omni"]) {
  test(`${theme} open chat renders successive incoming messages immediately without replacing the draft`, async ({ page }) => {
    const state = await setup(page);
    await page.goto(`/test-fixtures/task-communications.html${theme === "omni" ? "?omni" : ""}`);
    if (theme === "pulse") {
      await page.evaluate(() => { document.documentElement.dataset.agentFullscreen = "true"; });
      await page.getByTestId("pulse-communication-center").getByRole("button", { name: new RegExp(c.directMessages) }).click();
    }
    await page.locator(".icp-roster").getByRole("button", { name: /Test Colleague A/ }).click();
    const composer = page.locator(".icp-compose textarea");
    await expect(page.locator(".icp-thread")).toContainText("Private A message");
    await composer.fill("Keep my unfinished reply");
    state.incoming("a", "First live question");
    state.incoming("a", "Second live question");
    await expect(page.locator(".icp-thread").getByText("First live question", { exact: true })).toHaveCount(1, { timeout: 2000 });
    await expect(page.locator(".icp-thread").getByText("Second live question", { exact: true })).toHaveCount(1, { timeout: 2000 });
    state.incoming("b", "Other colleague private question");
    await expect(page.locator(".icp-thread")).not.toContainText("Other colleague private question");
    await expect(composer).toHaveValue("Keep my unfinished reply");
    expect(await composer.evaluate(element => getComputedStyle(element).fontSize)).toBe("18px");
    expect(await page.locator(".icp-message p").first().evaluate(element => getComputedStyle(element).fontSize)).toBe("16px");
    await page.screenshot({ path: `test-results/${theme}-live-readable-chat.png` });
    expect(state.errors).toEqual([]);
  });
  test(`${theme} updated roster reconciles every missed message into the open conversation`, async ({ page }) => {
    const state = await setup(page);
    await page.goto(`/test-fixtures/task-communications.html${theme === "omni" ? "?omni" : ""}`);
    if (theme === "pulse") await page.getByTestId("pulse-communication-center").getByRole("button", { name: new RegExp(c.directMessages) }).click();
    await page.locator(".icp-roster").getByRole("button", { name: /Test Colleague A/ }).click();
    await expect(page.locator(".icp-thread")).toContainText("Private A message");
    state.incoming("a", "Missed socket first question", false);
    state.incoming("a", "Newest roster question", false);
    state.emitChat({ type: "read_confirmed", senderId: "b" });
    await expect(page.locator(".icp-thread").getByText("Newest roster question", { exact: true })).toHaveCount(1, { timeout: 2000 });
    await expect(page.locator(".icp-thread").getByText("Missed socket first question", { exact: true })).toHaveCount(1, { timeout: 2000 });
    expect(state.errors).toEqual([]);
  });
}
test("collapsed Omni conversation rail shows each person's avatar or initials and keeps chat selection", async ({ page }) => {
  const state = await setup(page);
  await page.route("**/test-avatar-a.svg", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#318478"/><circle cx="20" cy="15" r="7" fill="white"/><path d="M8 38a12 12 0 0 1 24 0" fill="white"/></svg>' }));
  await page.goto("/test-fixtures/task-communications.html?omni&rail");
  const first = page.getByTestId("chat-collapsed-a");
  const second = page.getByTestId("chat-collapsed-b");
  await expect(first.getByRole("img")).toHaveAttribute("src", "/test-avatar-a.svg");
  await expect(first).toContainText("2");
  await expect(second).toContainText("TC");
  await first.click();
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".icp-thread")).toContainText("Private A message");
  await second.click();
  await expect(second).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".icp-chat-person")).toContainText("Test Colleague B");
  await page.screenshot({ path: "test-results/omni-collapsed-person-avatars.png" });
  expect(state.errors).toEqual([]);
});

test("expanded Omni conversation list uses real avatars and initials rather than chat icons", async ({ page }) => {
  const state = await setup(page);
  await page.route("**/test-avatar-a.svg", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#318478"/></svg>' }));
  await page.goto("/test-fixtures/task-communications.html?omni&rail&expanded");
  const first = page.getByTestId("chat-conversation-a");
  const second = page.getByTestId("chat-conversation-b");
  await expect(first.getByRole("img")).toHaveAttribute("src", "/test-avatar-a.svg");
  await expect(second).toContainText("TC");
  await second.click();
  await expect(page.locator(".icp-chat-person")).toContainText("Test Colleague B");
  await page.screenshot({ path: "test-results/omni-expanded-chat-avatars.png" });
  expect(state.errors).toEqual([]);
});

for (const theme of ["pulse", "omni"]) {
  test(`${theme} chat has large reply text, quick emojis, avatar unread badges and expiring typing`, async ({ page }) => {
    const state = await setup(page);
    await page.goto(`/test-fixtures/task-communications.html${theme === "omni" ? "?omni" : ""}`);
    if (theme === "pulse") {
      await page.evaluate(() => document.documentElement.dataset.agentFullscreen = "true");
      await page.getByTestId("pulse-communication-center").getByRole("button", { name: new RegExp(c.directMessages) }).click();
    }
    await page.locator(".icp-roster").getByRole("button", { name: /Test Colleague A/ }).click();
    const input = page.locator(".icp-compose textarea");
    expect(await input.evaluate(node => getComputedStyle(node).fontSize)).toBe("18px");
    await input.fill("Thank you ");
    await page.getByRole("button", { name: c.emojiThanks, exact: true }).click();
    await expect(input).toHaveValue("Thank you 🙏");
    await expect.poll(() => state.socketWrites.filter(message => message.type === "typing" && message.receiverId === "a" && message.isTyping).length).toBeGreaterThan(0);
    await page.getByRole("button", { name: c.send, exact: true }).click();
    await expect(input).toHaveValue("");
    await expect(page.locator(".icp-thread")).toContainText("Thank you 🙏");
    await expect.poll(() => state.socketWrites.some(message => message.type === "typing" && message.receiverId === "a" && !message.isTyping)).toBe(true);
    state.incoming("b", "Unread question in another conversation");
    const badge = page.getByTestId("chat-avatar-unread-b");
    await expect(badge).toContainText("1");
    state.emitChat({ type: "user_typing", userId: "b", isTyping: true });
    await expect(page.locator(".icp-typing")).toHaveCount(0);
    state.emitChat({ type: "user_typing", userId: "a", isTyping: true });
    await expect(page.locator(".icp-typing[role=status]")).toContainText("Test Colleague A");
    await expect(page.locator(".icp-typing-dots i")).toHaveCount(3);
    await page.screenshot({ path: `test-results/${theme}-chat-typing-emoji-unread.png` });
    await expect(page.locator(".icp-typing")).toHaveCount(0, { timeout: 8000 });
    await page.locator(".icp-roster").getByRole("button", { name: /Test Colleague B/ }).click();
    await expect(badge).toHaveCount(0);
    expect(state.errors).toEqual([]);
  });

  test(`${theme} ambient chat cues sound once per delivery, only after send confirmation and obey persistent mute`, async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).chatCues = [];
      window.addEventListener("chat_sound_played", event => (window as any).chatCues.push((event as CustomEvent).detail.kind));
    });
    const state = await setup(page);
    await page.goto(`/test-fixtures/task-communications.html${theme === "omni" ? "?omni" : ""}`);
    if (theme === "pulse") await page.getByTestId("pulse-communication-center").getByRole("button", { name: new RegExp(c.directMessages) }).click();
    await page.locator(".icp-roster").getByRole("button", { name: /Test Colleague A/ }).click();
    state.incoming("a", "Audible incoming question");
    await expect.poll(() => page.evaluate(() => (window as any).chatCues)).toEqual(["receive"]);
    state.emitChat({ type: "new_message", message: state.messages.a.at(-1), sender: users[1] });
    await page.locator(".icp-compose textarea").fill("Confirmed audible reply");
    await page.getByRole("button", { name: c.send, exact: true }).click();
    await expect.poll(() => page.evaluate(() => (window as any).chatCues)).toEqual(["receive", "send"]);
    state.emitChat({ type: "message_sent", message: state.messages.a.at(-1), clientMessageId: "duplicate-ack" });
    await page.getByTestId("chat-thread-sound-toggle").click();
    await expect(page.getByTestId("chat-sound-toggle")).toHaveAttribute("aria-pressed", "true");
    state.incoming("a", "Muted question still appears");
    await expect(page.locator(".icp-thread")).toContainText("Muted question still appears");
    await page.locator(".icp-compose textarea").fill("Muted reply");
    await page.getByRole("button", { name: c.send, exact: true }).click();
    await expect(page.locator(".icp-thread")).toContainText("Muted reply");
    expect(await page.evaluate(() => (window as any).chatCues)).toEqual(["receive", "send"]);
    await page.reload();
    if (theme === "pulse") await page.getByTestId("pulse-communication-center").getByRole("button", { name: new RegExp(c.directMessages) }).click();
    await expect(page.getByTestId("chat-sound-toggle")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("chat-sound-toggle").click();
    await page.locator(".icp-roster").getByRole("button", { name: /Test Colleague A/ }).click();
    state.setDeliveries(false);
    await page.locator(".icp-compose textarea").fill("Unconfirmed silent reply");
    await page.getByRole("button", { name: c.send, exact: true }).click();
    await expect(page.locator(".icp-compose textarea")).toHaveValue("Unconfirmed silent reply");
    expect(await page.evaluate(() => (window as any).chatCues)).toEqual([]);
    expect(state.errors).toEqual([]);
  });
}

test("ordinary INDEXUS shows saved and live private chats on Nexus Omni without any Pulse session", async ({ page }) => {
  const state = await setup(page);
  await page.goto("/test-fixtures/task-communications.html?indexus");
  await expect(page.getByTestId("ordinary-indexus")).toBeVisible();
  const badge = page.getByTestId("nexus-omni-unread-chat");
  await expect(badge).toContainText("1");
  state.incoming("b", "Message for a colleague outside Pulse");
  await expect(badge).toContainText("2");
  await page.getByTestId("nav-nexus-omni").click();
  await expect(page).toHaveURL(/\/email\?tab=chats/);
  await page.locator(".icp-roster").getByRole("button", { name: /Test Colleague B/ }).click();
  await expect(page.locator(".icp-thread")).toContainText("Message for a colleague outside Pulse");
  await expect(badge).toContainText("1");
  await page.locator(".icp-roster").getByRole("button", { name: /Test Colleague A/ }).click();
  await expect(badge).toHaveCount(0);
  await page.screenshot({ path: "test-results/indexus-global-private-chat.png" });
  expect(state.errors).toEqual([]);
});
for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
  test(`Mission team redesign keeps independent agent policies, search and footer usable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const state = await setup(page);
    await page.goto("/test-fixtures/task-communications.html?mission-chat");
    await page.getByTestId("button-assign-agents-mission-chat").click();
    await expect(page.getByRole("heading", { name: c.peopleAssignmentTitle })).toBeVisible();
    const assignment = page.getByTestId("mission-agent-assignment-picker");
    await page.getByTestId("input-search-agents").fill("Test Colleague B");
    await page.getByTestId("checkbox-agent-b").check();
    await page.getByTestId("input-search-agents").fill("missing-person-name");
    await expect(assignment).toContainText(c.peopleNoResults);
    await expect(assignment.locator(".mission-assignment-selected")).toContainText("Test Colleague B");
    await page.getByTestId("input-search-agents").fill("");
    await page.getByTestId("button-toggle-role-__legacy__user").click();
    await expect(page.getByTestId("checkbox-agent-viewer")).toBeChecked();
    const agent = page.getByTestId("mission-chat-agent");
    const mode = page.getByTestId("mission-chat-mode");
    await agent.selectOption("b");
    await expect(mode).toHaveValue("default");
    await mode.selectOption("selected");
    await expect(page.getByTestId("mission-agent-chat-settings")).toContainText(c.missionChatNone);
    await expect(page.getByTestId("mission-chat-colleague-b")).toHaveCount(0);
    await page.getByTestId("mission-chat-colleague-a").check();
    await agent.selectOption("viewer");
    await expect(page.getByTestId("mission-chat-colleague-a")).toBeChecked();
    await expect(page.getByTestId("mission-chat-colleague-b")).not.toBeChecked();
    await agent.selectOption("b");
    await expect(page.getByTestId("mission-chat-colleague-a")).toBeChecked();
    const save = page.getByTestId("button-save-agents");
    const bounds = await save.boundingBox();
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await page.screenshot({ path: `test-results/mission-people-redesign-${viewport.width}.png` });
    await mode.selectOption("default");
    await mode.selectOption("selected");
    await save.click();
    await expect.poll(() => state.writes.find(write => write.url === "/api/campaigns/mission-chat/agents")?.body)
      .toMatchObject({ userIds: ["viewer", "b"], chatSelections: { viewer: ["a"], b: [] } });
    expect(state.errors).toEqual([]);
  });
}

test("Mission agent drawer saves per-agent Inbox colleagues and can explicitly disable chat", async ({ page }) => {
  const state = await setup(page);
  await page.goto("/test-fixtures/task-communications.html?mission-chat");
  await page.getByTestId("button-assign-agents-mission-chat").click();
  const settings = page.getByTestId("mission-agent-chat-settings");
  await expect(settings).toBeVisible();
  await expect(page.getByTestId("mission-chat-agent")).toHaveValue("viewer");
  await expect(page.getByTestId("mission-chat-mode")).toHaveValue("selected");
  await expect(page.getByTestId("mission-chat-colleague-a")).toBeChecked();
  await page.getByTestId("mission-chat-colleague-b").check();
  await page.getByTestId("button-save-agents").click();
  await expect.poll(() => state.writes.find(write => write.url === "/api/campaigns/mission-chat/agents")?.body)
    .toMatchObject({ userIds: ["viewer"], chatSelections: { viewer: ["a", "b"] } });
  await page.getByTestId("button-assign-agents-mission-chat").click();
  await expect(page.getByTestId("mission-chat-colleague-a")).toBeChecked();
  await page.getByTestId("mission-chat-colleague-a").uncheck();
  await page.getByTestId("button-save-agents").click();
  await expect.poll(() => state.writes.filter(write => write.url === "/api/campaigns/mission-chat/agents").at(-1)?.body)
    .toMatchObject({ chatSelections: { viewer: [] } });
  expect(state.errors).toEqual([]);
});

test("BO alert opens its tab and direct message thread stays below its header", async ({ page }) => {
  test.setTimeout(90_000); // The first real-component fixture may cold-transform the CRM graph.
  const state = await setup(page);
  await page.goto("/test-fixtures/task-communications.html?toolbar");
  await page.getByTestId("communication-updates-back-office").click();
  await expect(page.getByTestId("inbox-tab-back-office")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("pulse-communication-center").getByRole("button", { name: new RegExp(c.directMessages) }).click();
  await page.locator(".icp-roster").getByRole("button", { name: /Test Colleague A/ }).click();
  const head = await page.locator(".icp-chat-head").boundingBox();
  const thread = await page.locator(".icp-thread").boundingBox();
  const compose = await page.locator(".icp-compose").boundingBox();
  expect(thread!.height).toBeGreaterThan(100);
  expect(thread!.y).toBeGreaterThanOrEqual(head!.y + head!.height - 1);
  expect(compose!.y).toBeGreaterThanOrEqual(thread!.y + thread!.height - 1);
  await expect(page.locator(".icp-thread").getByText("Private A message", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/inbox-direct-message-layout.png" });
  expect(state.errors).toEqual([]);
});

for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
  test(`fullscreen Pulse retains populated chat and composer at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    test.setTimeout(90_000);
    const state = await setup(page);
    await page.setViewportSize(viewport);
    state.messages.a = Array.from({ length: 40 }, (_, index) => ({
      id: `history-${index}`, senderId: index % 2 ? "viewer" : "a", receiverId: index % 2 ? "a" : "viewer",
      content: `Full history message ${index + 1}: a sufficiently long private conversation to require actual scrolling.`,
      createdAt: new Date(Date.UTC(2026, 9, 10, 9, index)).toISOString(),
    }));
    await page.goto("/test-fixtures/task-communications.html");
    await page.evaluate(() => document.documentElement.setAttribute("data-agent-fullscreen", "true"));
    await expect(page.locator("html")).toHaveAttribute("data-agent-fullscreen", "true");
    await page.getByTestId("pulse-communication-center").getByRole("button", { name: new RegExp(c.directMessages) }).click();
    await page.locator(".icp-roster").getByRole("button", { name: /Test Colleague A/ }).click();
    await expect(page.locator(".icp-thread .icp-message")).toHaveCount(40);
    const thread = await page.locator(".icp-thread").boundingBox();
    expect(thread!.height).toBeGreaterThan(150);
    await expect(page.locator(".icp-chat-head")).toBeVisible();
    await expect(page.getByRole("heading", { name: c.centerTitle, level: 1 })).toBeVisible();
    const head = await page.locator(".icp-chat-head").boundingBox();
    const compose = await page.locator(".icp-compose").boundingBox();
    expect(thread!.y).toBeGreaterThanOrEqual(head!.y + head!.height - 1);
    expect(compose!.y + compose!.height).toBeLessThanOrEqual(viewport.height);
    expect(compose!.y).toBeGreaterThanOrEqual(thread!.y + thread!.height - 1);
    await expect.poll(() => page.locator(".icp-thread").evaluate(element =>
      element.scrollHeight - element.clientHeight - element.scrollTop)).toBeLessThan(3);
    await page.locator(".icp-thread").evaluate(element => { element.scrollTop = 0; });
    await expect.poll(() => page.locator(".icp-thread").evaluate(element => element.scrollTop)).toBe(0);
    await page.locator(".icp-root textarea").fill("Fullscreen message remains usable");
    await page.getByRole("button", { name: c.send, exact: true }).click();
    await expect(page.locator(".icp-thread .icp-message")).toHaveCount(41);
    await page.screenshot({ path: `test-results/fullscreen-chat-${viewport.width}.png` });
    expect(state.errors).toEqual([]);
  });
}

test("completed task shows one history event and one resolution with its actual resolver", async ({ page }) => {
  test.setTimeout(90_000);
  const state = await setup(page);
  const resolution = "Corrected the contact details and verified the result.";
  Object.assign(state.currentTasks[1], {
    status: "completed", resolution, resolvedByUserId: "a", resolvedAt: "2026-10-10T09:00:00Z",
  });
  state.comments["task-two"] = [
    { id: "completed-event", taskId: "task-two", userId: "a", kind: "state_change", content: resolution,
      metadata: { fromState: "in_progress", toState: "completed" }, createdAt: "2026-10-10T09:00:00.020Z" },
    { id: "earlier-comment", taskId: "task-two", userId: "b", kind: "comment", content: "Ordinary discussion remains intact.", createdAt: "2026-10-10T08:30:00Z" },
  ];
  await page.goto("/test-fixtures/task-communications.html");
  await page.evaluate(() => document.documentElement.setAttribute("data-agent-fullscreen", "true"));
  await expect(page.locator(".center-detail-head")).toBeVisible();
  await expect(page.locator(".center-detail").getByText(resolution, { exact: true })).toHaveCount(1);
  await expect(page.locator(".history-event.history-completed")).toHaveCount(1);
  await expect(page.locator(".history-event.history-completed")).not.toContainText(resolution);
  await expect(page.getByTestId("task-resolution")).toContainText(`${translations.en.tasks.resolvedBy}: Test Colleague A`);
  await expect(page.locator(".task-comments")).toContainText("Ordinary discussion remains intact.");
  await page.screenshot({ path: "test-results/task-resolution-once.png" });
  expect(state.errors).toEqual([]);
});
