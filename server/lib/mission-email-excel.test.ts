import { test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { computeMissionFunnel } from "./mission-funnel";
import { emptyFunnelConfig } from "../../shared/mission-funnel";
import { buildMissionEmailExcel } from "./mission-email-excel";
import { missionEmailFunnel } from "./mission-email-content";

const config = emptyFunnelConfig(); config.sources.qualified = ["q"];
const report = { ...computeMissionFunnel({
  config, clinics: [{ id: "secret-clinic-id", name: "Private clinic", representativeId: null, referred: false }],
  enrollments: [{ id: "contact", clinicId: "secret-clinic-id" }],
  items: [{ id: "q", stepId: "q", label: "Qualified", parentId: null }],
  events: [{ id: "event", contactId: "contact", itemId: "q", confirmed: true, at: "2026-11-01T10:00:00Z" }],
  states: [], calls: [],
}, {}, new Date(), { allMilestones: true }), missionName: "=HYPERLINK(\"bad\")", canConfigure: true };
const now = new Date("2026-11-02T07:00:00Z");
const activity = [{ agentId: "secret-user-id", agentName: "+Unsafe formula", newCalls: 3, repeatCalls: 2,
  emails: 4, sms: 1, nonstandardTasks: 5, talkSeconds: 90000, ringSeconds: 60, totalSeconds: 90060 }];
test("all seven Excel reports match email funnel counts, contain both reports and exclude clinic IDs/identity", () => {
  for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"] as const) {
    const options = { frequency: "daily" as const, weekday: 1, monthDay: 1, country: "SK", locale };
    const file = buildMissionEmailExcel(report, activity, options, now);
    assert.match(file.name, /2026-11-01_2026-11-01\.xlsx$/);
    assert.match(file.contentType, /spreadsheetml/);
    const buffer = Buffer.from(file.contentBytes, "base64");
    assert.equal(buffer.subarray(0, 2).toString(), "PK");
    const book = XLSX.read(buffer, { type: "buffer", cellNF: true });
    assert.equal(book.SheetNames.length, 3);
    const [summary, funnel, agents] = book.SheetNames.map(name => book.Sheets[name]);
    assert.equal(summary.B1.t, "s"); assert.equal(summary.B1.f, undefined);
    assert.equal(summary.B1.v, report.missionName);
    assert.equal(summary.B2.t, "n"); assert.equal(summary.B2.z, "dd.mm.yyyy");
    assert.deepEqual(XLSX.utils.sheet_to_json(funnel, { header: 1 }).slice(1), missionEmailFunnel(report, options, now));
    assert.equal(agents.A2.t, "s"); assert.equal(agents.A2.f, undefined);
    assert.equal(agents.B2.t, "n"); assert.equal(agents.B2.v, 3);
    assert.equal(agents.G2.t, "n"); assert.equal(agents.G2.z, "[h]:mm:ss");
    assert.equal(agents.G2.v, 90000 / 86400);
    assert.doesNotMatch(JSON.stringify(book.Sheets), /secret-clinic-id|Private clinic|secret-user-id/);
  }
});
test("weekly/monthly attachments use the exact reporting period and empty activity remains a valid sheet", () => {
  for (const frequency of ["weekly", "monthly"] as const) {
    const file = buildMissionEmailExcel(report, [], { frequency, weekday: 1, monthDay: 1, country: "SK", locale: "sk" }, now);
    assert.match(file.name, frequency === "weekly" ? /2026-10-26_2026-11-01/ : /2026-10-01_2026-10-31/);
    const book = XLSX.read(Buffer.from(file.contentBytes, "base64"), { type: "buffer" });
    assert.equal(XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[2]], { header: 1 }).length, 1);
  }
});
