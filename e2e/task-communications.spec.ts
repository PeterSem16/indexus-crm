import { test, expect, type Page } from "@playwright/test";
import { translations } from "../client/src/i18n/translations";
const c = translations.en.taskCommunication;
const users = [
  { id: "viewer", fullName: "Test Agent", username: "agent" },
  { id: "a", fullName: "Test Colleague A", username: "colleague-a" },
  { id: "b", fullName: "Test Colleague B", username: "colleague-b" },
];
const tasks = [
  { id: "task-one", title: "First real-source request", description: "Original authored request", createdByUserId: "viewer", assignedUserId: "a", status: "pending", boState: "waiting_agent", tags: ["group_id:bo", "group:Back Office", "back_office"], requestRecipients: { userIds: ["b"], typeId: "change_data", typeName: "change_data" }, attachments: [], createdAt: "2026-10-10T08:00:00Z" },
  { id: "task-two", title: "Second request", description: "Second original content", createdByUserId: "viewer", assignedUserId: "b", status: "in_progress", tags: [], requestRecipients: { userIds: ["b"] }, attachments: [], createdAt: "2026-10-10T07:00:00Z" },
];
async function setup(page: Page) {
  const currentTasks: any[] = structuredClone(tasks);
  const unread: Record<string, number> = { a: 1, b: 0 };
  let chatSocket: any;
  const comments: Record<string, any[]> = { "task-one": [{ id: "question", taskId: "task-one", userId: "a", kind: "question", content: "Please clarify", createdAt: "2026-10-10T09:00:00Z" }], "task-two": [] };
  const messages: Record<string, any[]> = { a: [{ id: "initial-a", senderId: "a", receiverId: "viewer", content: "Private A message", createdAt: "2026-10-10T09:00:00Z" }], b: [] };
  const routes = [{ id: "change_data", name: "change_data", groupIds: ["bo"], userIds: ["a"], enabled: true }, { id: "other", name: "other", groupIds: [], userIds: [], enabled: false }];
  let deliveries = true;
  const writes: { url: string; body: any }[] = [];
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
  return { writes, errors, currentTasks, comments, messages, emitChat: (payload: unknown) => chatSocket.send(JSON.stringify(payload)), setDeliveries: (value: boolean) => { deliveries = value; },
    incoming: (partnerId: string) => {
      const message = { id: "incoming-new", senderId: partnerId, receiverId: "viewer", content: "New private message", createdAt: new Date().toISOString() };
      messages[partnerId].push(message); unread[partnerId]++;
      chatSocket.send(JSON.stringify({ type: "new_message", message, sender: users.find(user => user.id === partnerId) }));
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
test("live Tasks settings save group/user combinations, create and delete request types", async ({ page }) => {
  const state = await setup(page);
  await page.goto("/test-fixtures/task-communications.html?settings");
  await page.getByTestId("tab-request-routing").click();
  await expect(page.getByRole("heading", { name: c.routingTitle, level: 1 })).toBeVisible();
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
