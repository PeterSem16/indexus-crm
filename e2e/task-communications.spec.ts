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
    if (method !== "GET") writes.push({ url, body: request.postDataJSON() });
    if (url === "/api/auth/me") data = { user: { ...users[0], role: "admin", isActive: true, assignedCountries: ["SK"], locale: "en" } };
    else if (url === "/api/task-settings/access") data = { canManage: true };
    else if (url === "/api/tasks/created") data = tasks;
    else if (url === "/api/tasks/people") data = users;
    else if (url === "/api/task-settings/users") data = { configured: false, allowedUserIds: [], users: users.map(user => ({ ...user, isActive: true, email: null, avatarUrl: null })), updatedAt: null };
    else if (url === "/api/chat/people") data = users.slice(1);
    else if (url === "/api/chat/conversations") data = [{ partnerId: "a", partner: users[1], unreadCount: 1, lastMessage: messages.a.at(-1) }];
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
    socket.onMessage(raw => {
      const message = JSON.parse(raw.toString());
      if (message.type === "auth") {
        socket.send(JSON.stringify({ type: "auth_success", userId: "viewer" }));
        socket.send(JSON.stringify({ type: "presence_update", onlineUsers: users }));
      } else if (message.type === "chat_message" && deliveries) {
        const saved = { id: `sent-${messages[message.receiverId].length}`, senderId: "viewer", receiverId: message.receiverId, content: message.content, createdAt: new Date().toISOString() };
        messages[message.receiverId].push(saved);
        socket.send(JSON.stringify({ type: "message_sent", message: saved, clientMessageId: message.clientMessageId }));
      }
    });
  });
  return { writes, errors, setDeliveries: (value: boolean) => { deliveries = value; } };
}
test("real communication center separates histories, retains per-thread drafts and answers BO questions", async ({ page }) => {
  const state = await setup(page);
  await page.goto("/test-fixtures/task-communications.html");
  await expect(page.getByText("Original authored request")).toBeVisible();
  const taskDraft = page.getByRole("textbox", { name: c.taskMessage });
  await taskDraft.fill("Task one draft");
  await page.getByRole("button", { name: /Second request/ }).click();
  await expect(taskDraft).toHaveValue("");
  await taskDraft.fill("Task two draft");
  await page.getByRole("button", { name: /First real-source request/ }).click();
  await expect(taskDraft).toHaveValue("Task one draft");
  await page.getByRole("button", { name: c.addComment }).click();
  await expect(taskDraft).toHaveValue("");
  expect(state.writes.filter(write => write.url.includes("/answer"))).toEqual([{ url: "/api/agent/bo-questions/task-one/answer", body: { content: "Task one draft" } }]);
  await page.getByRole("button", { name: new RegExp(c.directMessages) }).click();
  await expect(page.locator(".direct-thread").getByText("Private A message", { exact: true })).toBeVisible();
  const direct = page.getByRole("textbox", { name: c.privateMessage });
  await direct.fill("Private A draft");
  await page.getByRole("button", { name: /Test Colleague B/ }).click();
  await expect(direct).toHaveValue("");
  await direct.fill("Private B draft");
  await page.getByRole("button", { name: /Test Colleague A/ }).click();
  await expect(direct).toHaveValue("Private A draft");
  await page.getByRole("button", { name: c.send, exact: true }).click();
  await expect(direct).toHaveValue("");
  await expect(page.locator(".direct-thread").getByText("Private A draft", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: new RegExp(c.myRequests) }).click();
  await expect(page.getByText("Private A draft", { exact: true })).toHaveCount(0);
  expect(state.errors).toEqual([]);
});
test("failed chat confirmation does not discard the draft", async ({ page }) => {
  const state = await setup(page);
  state.setDeliveries(false);
  await page.goto("/test-fixtures/task-communications.html");
  await page.getByRole("button", { name: new RegExp(c.directMessages) }).click();
  const draft = page.getByRole("textbox", { name: c.privateMessage });
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
