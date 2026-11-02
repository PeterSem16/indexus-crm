import { test } from "node:test";
import assert from "node:assert/strict";
import { storage } from "../storage";
import { buildMissionEmail, missionSystemSender, sendMissionEmail } from "./mission-email-scheduler";
import { pool } from "../db";
import express from "express";
import { registerMissionReportGet } from "./mission-report-sources";
import { computeMissionFunnel } from "./mission-funnel";
import { emptyFunnelConfig } from "../../shared/mission-funnel";

test("Graph sends Excel from exactly the country's connected INDEXUS system mailbox", async t => {
  const requests: { url: string; body: any }[] = [];
  t.mock.method(storage, "getCountrySystemSettingsByCountry", async (country: string) => ({
    systemEmailAddress: `indexus-${country.toLowerCase()}@example.test`,
  }));
  t.mock.method(storage, "getSystemMs365Connection", async (country: string) => ({
    email: `indexus-${country.toLowerCase()}@example.test`, isConnected: true,
    accessToken: "fake-unit-token", tokenExpiresAt: new Date("2099-01-01"), refreshToken: null,
  }));
  t.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    requests.push({ url: String(url), body: JSON.parse(String(options.body)) });
    return new Response(null, { status: 202 });
  });
  const file = { name: "report.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", contentBytes: "UEs=" };
  for (const country of ["SK", "CZ", "HU", "RO", "IT", "DE"]) {
    assert.equal((await missionSystemSender(country)).connected, true);
    await sendMissionEmail(country, "self@example.test", "Test report", "<p>Report</p>", [file]);
    const sent = requests.at(-1)!;
    assert.ok(sent.url.includes(encodeURIComponent(`indexus-${country.toLowerCase()}@example.test`)));
    assert.equal(sent.body.message.from.emailAddress.address, `indexus-${country.toLowerCase()}@example.test`);
    assert.deepEqual(sent.body.message.toRecipients, [{ emailAddress: { address: "self@example.test" } }]);
    assert.deepEqual(sent.body.message.attachments, [{ "@odata.type": "#microsoft.graph.fileAttachment", ...file }]);
    assert.equal(sent.body.saveToSentItems, true);
  }
});
test("disconnected, stale or missing country sender never borrows a personal mailbox or contacts Graph", async t => {
  let connected = false, email = "system@example.test";
  t.mock.method(storage, "getCountrySystemSettingsByCountry", async () => ({ systemEmailAddress: email }));
  t.mock.method(storage, "getSystemMs365Connection", async () => ({
    email: "system@example.test", isConnected: connected, accessToken: "fake-unit-token",
    tokenExpiresAt: new Date("2099-01-01"),
  }));
  let calls = 0; t.mock.method(globalThis, "fetch", async () => { calls++; throw Error("Network forbidden"); });
  for (const state of [0, 1, 2]) {
    connected = state > 0; email = state === 1 ? "stale-personal@example.test" : state === 2 ? "" : "system@example.test";
    assert.equal((await missionSystemSender("SK")).connected, false);
    await assert.rejects(sendMissionEmail("SK", "self@example.test", "Test", "<p>Test</p>"), /System mailbox unavailable/);
  }
  assert.equal(calls, 0);
});
test("real build attaches Excel only when enabled and shares the native report period", async t => {
  t.mock.method(pool, "query", async () => ({ rows: [{
    role: "admin", assigned_countries: ["SK"], country_codes: ["SK"], assigned: true,
    module_read: true, module_edit: true, name: "Mission", settings: {},
  }] }));
  const app = express();
  const report = { ...computeMissionFunnel({ config: emptyFunnelConfig(), clinics: [], enrollments: [], events: [], states: [], calls: [], items: [] }),
    missionName: "Mission", canConfigure: true };
  registerMissionReportGet(app, "/funnel", (_req, _res, next) => next(), "funnel", (_req, res) => { res.json(report); });
  registerMissionReportGet(app, "/performance", (_req, _res, next) => next(), "performance", (req, res) => {
    assert.equal(req.query.from, "2026-10-31T23:00:00.000Z");
    assert.equal(req.query.to, "2026-11-01T22:59:59.999Z");
    res.json([]);
  });
  const options = { recipientUserIds: ["self"], externalEmails: [], frequency: "daily" as const, weekday: 1, monthDay: 1, country: "SK",
    locale: "sk" as const, enabled: false, sendTime: "08:00", includeExcel: false };
  const now = new Date("2026-11-02T07:00:00Z");
  assert.deepEqual((await buildMissionEmail("self", "mission", options, now)).attachments, []);
  const built = await buildMissionEmail("self", "mission", { ...options, includeExcel: true }, now);
  assert.equal(built.attachments.length, 1); assert.match(built.attachments[0].name, /\.xlsx$/);
});
