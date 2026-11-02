import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import { registerMissionEmailScheduleRoutes } from "./mission-email-schedule-routes";
import { scheduleFixture } from "./mission-email-scheduler.test";
const input = { recipientUserIds: ["recipient"], sendTime: "08:00", enabled: false, frequency: "weekly", weekday: 1, monthDay: 1, country: "SK", locale: "sk" };
async function setup(options: Parameters<typeof scheduleFixture>[0] = {}) {
  const f = scheduleFixture(options), app = express(); app.use(express.json());
  registerMissionEmailScheduleRoutes(app, (req, res, next) => {
    if (!req.headers["x-test-user"]) return res.status(401).json({ error: "unauthenticated" });
    (req as any).session = { user: { id: req.headers["x-test-user"] } }; next();
  }, f.database, { build: f.dependencies.build as any, mailboxReady: async () => false });
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
    assert.equal((await f.request(`${base}/schedule`, "PATCH", { ...input, frequency: "monthly", monthDay: 31 })).status, 200);
    assert.equal(f.schedule.delivery_options.monthDay, 31);
    assert.equal((await f.request(base.replace("mission/", "foreign/") + "/schedule", "DELETE")).status, 404);
    assert.equal((await f.request(`${base}/schedule`, "DELETE")).status, 200);
    assert.equal(f.sends.length, 0);
  } finally { await f.close(); }
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
