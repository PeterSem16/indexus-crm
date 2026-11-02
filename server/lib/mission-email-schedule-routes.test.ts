import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import { registerMissionEmailScheduleRoutes } from "./mission-email-schedule-routes";
import { scheduleFixture } from "./mission-email-scheduler.test";
const input = { recipientUserIds: ["recipient"], sendTime: "08:00", enabled: false, frequency: "weekly", weekday: 1, monthDay: 1, country: "SK", locale: "sk" };
async function setup(options: Parameters<typeof scheduleFixture>[0] = {}, extra: Partial<NonNullable<Parameters<typeof registerMissionEmailScheduleRoutes>[3]>> = {}) {
  const f = scheduleFixture(options), app = express(); app.use(express.json());
  registerMissionEmailScheduleRoutes(app, (req, res, next) => {
    if (!req.headers["x-test-user"]) return res.status(401).json({ error: "unauthenticated" });
    (req as any).session = { user: { id: req.headers["x-test-user"] } }; next();
  }, f.database, { build: f.dependencies.build as any, send: f.dependencies.send,
    sender: async (country: string) => ({ country, email: "indexus-system@example.test", connected: true }),
    mailboxReady: async () => false, ...extra });
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  return { ...f, close: () => new Promise<void>(resolve => { server.close(resolve as any); server.closeAllConnections(); }),
    request: (path: string, method = "GET", body?: any, user: string | null = "owner") => fetch(base + path, {
      method, headers: { "Content-Type": "application/json", ...(user ? { "x-test-user": user } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }) };
}
const base = "/api/campaigns/mission/mission-report-schedules";
test("schedule API denies anonymous and unauthorized managers", async () => {
  const f = await setup({ unauthorized: "owner" });
  try {
    assert.equal((await f.request(base, "GET", undefined, null)).status, 401);
    assert.equal((await f.request(base, "POST", input)).status, 403);
  } finally { await f.close(); }
});
test("create/edit/pause/delete are bound to the Mission and never send mail", async () => {
  const f = await setup();
  try {
    assert.equal((await f.request(base, "POST", input)).status, 201);
    assert.equal(f.schedule.delivery_options.frequency, "weekly"); assert.equal(f.schedule.next_run_at, null);
    assert.equal((await f.request(`${base}/schedule`, "PATCH", { ...input, frequency: "monthly", monthDay: 31, includeExcel: true })).status, 200);
    assert.equal(f.schedule.delivery_options.monthDay, 31);
    assert.equal(f.schedule.delivery_options.includeExcel, true);
    assert.equal((await f.request(base.replace("mission/", "foreign/") + "/schedule", "DELETE")).status, 404);
    assert.equal((await f.request(`${base}/schedule`, "DELETE")).status, 200);
    assert.equal(f.sends.length, 0);
  } finally { await f.close(); }
});
test("schedule list shows only country system sender metadata and self test destination, not tokens", async () => {
  const f = await setup();
  try {
    const response = await f.request(base), data = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(data.senders, [{ country: "SK", email: "indexus-system@example.test", connected: true }]);
    assert.equal(data.testRecipientEmail, "recipient@example.test");
    assert.doesNotMatch(JSON.stringify(data), /accessToken|refreshToken/);
    assert.equal(f.sends.length, 0);
  } finally { await f.close(); }
});
const testId = "0a2e4b32-654d-47cd-a1df-3cc5e722c243";
test("explicit test sends only to self, supports paused plans and does not consume or advance a scheduled delivery", async () => {
  const f = await setup({ enabled: false });
  try {
    const before = f.schedule.next_run_at;
    const response = await f.request(`${base}/schedule/test-email`, "POST", { requestId: testId });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "sent", to: "recipient@example.test",
      from: "indexus-system@example.test", attachmentIncluded: false });
    assert.equal(f.sends.length, 1);
    assert.equal(f.sends[0][0], "SK");
    assert.equal(f.sends[0][2], "[TEST] Report");
    assert.ok([...f.ledger.keys()][0].startsWith(`test:owner:${testId}:owner`));
    assert.equal(f.schedule.next_run_at, before);
    assert.equal(f.schedule.last_run_at, undefined);
    assert.ok(!f.queries.some(sql => sql.includes("last_run_at=$2")));
    assert.equal((await f.request(`${base}/schedule/test-email`, "POST", { requestId: testId })).status, 200);
    assert.equal(f.sends.length, 1, "repeated HTTP request cannot send twice");
  } finally { await f.close(); }
});
test("test cannot override recipient, sender, attachments, country or Mission; requires authorization", async () => {
  const f = await setup();
  try {
    const endpoint = `${base}/schedule/test-email`;
    for (const body of [{ requestId: "bad" }, { requestId: testId, to: "outside@example.test" },
      { requestId: testId, country: "IT" }, { requestId: testId, from: "personal@example.test" },
      { requestId: testId, attachments: [] }])
      assert.equal((await f.request(endpoint, "POST", body)).status, 400);
    assert.equal((await f.request(endpoint, "POST", { requestId: testId }, null)).status, 401);
    assert.equal((await f.request(endpoint.replace("/mission/", "/foreign/"), "POST", { requestId: testId })).status, 404);
    assert.equal(f.sends.length, 0);
    const denied = await setup({ unauthorized: "owner" });
    try { assert.equal((await denied.request(endpoint, "POST", { requestId: testId })).status, 403); }
    finally { await denied.close(); }
  } finally { await f.close(); }
});
test("Excel attachments are passed intact to test send from the persisted configuration", async () => {
  const attachments = [{ name: "report.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", contentBytes: "UEs=" }];
  const f = await setup({}, { build: (async (_user, _mission, options) => {
    assert.equal(options.includeExcel, true);
    return { ...await scheduleFixture().dependencies.build(), attachments };
  }) as any });
  try {
    f.schedule.delivery_options.includeExcel = true;
    const result = await f.request(`${base}/schedule/test-email`, "POST", { requestId: testId });
    assert.equal(result.status, 200); assert.equal((await result.json()).attachmentIncluded, true);
    assert.deepEqual(f.sends[0][4], attachments);
  } finally { await f.close(); }
});
test("uncertain Graph delivery is never retried and disconnected system mailbox never sends", async () => {
  let attempted = 0;
  const f = await setup({}, { send: async () => { attempted++; throw new Error("Timeout with sensitive provider content"); } });
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await f.request(`${base}/schedule/test-email`, "POST", { requestId: testId });
      assert.equal(result.status, 409); assert.equal((await result.json()).error, "test_delivery_unconfirmed");
    }
    assert.equal(attempted, 1);
  } finally { await f.close(); }
  const disconnected = await setup({}, { sender: async country => ({ country, email: null, connected: false }) });
  try {
    const result = await disconnected.request(`${base}/schedule/test-email`, "POST", { requestId: testId });
    assert.equal(result.status, 409); assert.equal((await result.json()).error, "system_mailbox_unavailable");
    assert.equal(disconnected.sends.length, 0);
  } finally { await disconnected.close(); }
});
test("test sending has a three-per-minute actor quota, and a busy schedule cannot send", async () => {
  const f = await setup();
  try {
    for (let index = 0; index < 4; index++) {
      const result = await f.request(`${base}/schedule/test-email`, "POST", { requestId: testId.slice(0, -1) + index });
      assert.equal(result.status, index < 3 ? 200 : 429);
    }
    assert.equal(f.sends.length, 3);
  } finally { await f.close(); }
  const busy = await setup({ lock: false });
  try {
    const result = await busy.request(`${base}/schedule/test-email`, "POST", { requestId: testId });
    assert.equal(result.status, 409); assert.equal((await result.json()).error, "schedule_busy");
    assert.equal(busy.sends.length, 0);
  } finally { await busy.close(); }
});
test("preview renders without invoking delivery or modifying the delivery ledger", async () => {
  const f = await setup();
  try {
    const result = await f.request(`${base}/schedule/preview`, "POST", {});
    assert.equal(result.status, 200); assert.equal((await result.json()).html, "<p>Report</p>");
    assert.equal(f.sends.length, 0); assert.equal(f.ledger.size, 0);
  } finally { await f.close(); }
});
test("invalid schedule, external addresses, revoked recipients and wrong country are rejected", async () => {
  const f = await setup({ unauthorized: "recipient" });
  try {
    assert.equal((await f.request(base, "POST", { ...input, sendTime: "24:00" })).status, 400);
    assert.equal((await f.request(base, "POST", { ...input, externalEmails: ["external@example.test"] })).status, 400);
    assert.equal((await f.request(base, "POST", { ...input, country: "CZ" })).status, 400);
    assert.equal((await f.request(base, "POST", input)).status, 400);
  } finally { await f.close(); }
});
test("a disconnected sender cannot be enabled; legacy APIs cannot modify or send new reports", async () => {
  const f = await setup();
  try {
    const result = await f.request(base, "POST", { ...input, enabled: true });
    assert.equal(result.status, 409); assert.equal((await result.json()).error, "system_mailbox_unavailable");
    for (const path of ["/api/scheduled-reports/schedule", "/api/scheduled-reports/schedule/send-now"])
      assert.equal((await f.request(path, "POST", {})).status, 403);
    assert.equal((await f.request("/api/campaigns/mission/scheduled-reports", "POST", { reportTypes: ["mission_insights"] })).status, 403);
  } finally { await f.close(); }
});
