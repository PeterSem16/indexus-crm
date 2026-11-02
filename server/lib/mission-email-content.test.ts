import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMissionFunnel } from "./mission-funnel";
import { emptyFunnelConfig } from "../../shared/mission-funnel";
import { renderMissionEmail } from "./mission-email-content";
const config = emptyFunnelConfig(); config.sources.qualified = ["q"];
const data = {
  config, clinics: [{ id: "private-clinic-id", name: "Private clinic identity", representativeId: null, referred: false }],
  enrollments: [{ id: "contact", clinicId: "private-clinic-id" }], items: [{ id: "q", stepId: "q", label: "Qualified", parentId: null }],
  events: [{ id: "event", contactId: "contact", itemId: "q", confirmed: true, at: "2026-11-01T10:00:00Z" }],
  states: [], calls: [],
};
const options = { frequency: "daily" as const, weekday: 1, monthDay: 1, country: "SK", locale: "sk" as const };
test("email first attainments are not restricted by a first-call cohort", () => {
  assert.equal(computeMissionFunnel(data).rows.find(row => row.key === "qualified")?.total, 0);
  const report = computeMissionFunnel(data, {}, new Date(), { allMilestones: true });
  assert.equal(report.rows.find(row => row.key === "qualified")?.total, 1);
});
test("all seven email locales include both reports, escape names, and omit clinic identity", () => {
  const projected = computeMissionFunnel(data, {}, new Date(), { allMilestones: true });
  const report = { ...projected, missionName: '<img src=x onerror="alert(1)">', canConfigure: true };
  const activity = [{ agentId: "user", agentName: "<script>bad</script>", newCalls: 3, repeatCalls: 2,
    emails: 5, sms: 1, nonstandardTasks: 4, talkSeconds: 3600, ringSeconds: 60, totalSeconds: 3660 }];
  for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"] as const) {
    const result = renderMissionEmail(report, activity, { ...options, locale }, new Date("2026-11-02T07:00Z"));
    assert.equal((result.html.match(/<table /g) || []).length, 2);
    assert.ok(result.html.includes("1:01:00"));
    assert.ok(result.html.includes("&lt;script&gt;"));
    assert.ok(!result.html.includes("<script>")); assert.ok(!result.html.includes("<img"));
    assert.ok(!result.html.includes("private-clinic-id")); assert.ok(!result.html.includes("Private clinic identity"));
    assert.ok(!result.html.includes("undefined"));
  }
});
test("email counts dated direct evidence once, excluding inferred and outside-period evidence", () => {
  const projected = computeMissionFunnel(data, {}, new Date(), { allMilestones: true });
  const row = projected.rows.find(item => item.key === "qualified")!;
  row.members.push({ ...row.members[0], id: "old", firstDate: "2026-10-01T10:00Z" },
    { ...row.members[0], id: "inferred", inferred: true }, { ...row.members[0], id: "undated", firstDate: null });
  const result = renderMissionEmail({ ...projected, missionName: "Mission", canConfigure: true }, [], options, new Date("2026-11-02T07:00Z"));
  assert.match(result.html, /Kvalifikované<\/td><td[^>]*>1<\/td><td[^>]*>1<\/td>/);
});
