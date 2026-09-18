import assert from "node:assert/strict";
import test from "node:test";
import {
  addCampaignCallsToOperatorStats,
  callHandledContactIncrement,
  reportCallTalkSeconds,
} from "./campaign-report-operator-stats";

const createRow = (userId: string, period: string) => ({
  operatorId: userId, period, sessionsCount: 0, firstLogin: null, lastLogout: null,
  totalLoginTime: 0, totalWorkTime: 0, totalBreakTime: 0, totalCallTime: 0,
  totalEmailTime: 0, totalSmsTime: 0, totalWrapUpTime: 0, contactsHandled: 0,
  callCount: 0, emailCount: 0, smsCount: 0, totalDispositionTime: 0,
  dispositionCount: 0, totalFormDispositionTime: 0, formDispositionCount: 0,
  sessionDetails: [],
});

test("no-session and outside-session calls are reported without fabricated login time", () => {
  const rows: Record<string, any> = {};
  const sessions = [{
    id: "s1", userId: "agent", status: "offline",
    startedAt: "2026-01-02T10:00:00Z", endedAt: "2026-01-02T10:30:00Z",
  }];
  const calls = [
    { id: "no-session", userId: "mobile", status: "completed", startedAt: "2026-01-02T09:00:00Z", answeredAt: "2026-01-02T09:00:10Z", endedAt: "2026-01-02T09:01:10Z" },
    { id: "outside", userId: "agent", status: "completed", startedAt: "2026-01-02T11:00:00Z", answeredAt: "2026-01-02T11:00:20Z", endedAt: "2026-01-02T11:02:20Z" },
  ];
  addCampaignCallsToOperatorStats(rows, calls, sessions, "total", createRow);
  assert.equal(rows.mobile__total.sessionsCount, 0);
  assert.equal(rows.mobile__total.firstLogin, null);
  assert.equal(rows.mobile__total.totalCallTime, 60);
  assert.equal(rows.agent__total.totalCallTime, 120);
});

test("duplicate rows are counted once and timings use answered-to-ended", () => {
  const rows: Record<string, any> = {};
  const call = { id: "same", userId: "agent", status: "completed", startedAt: "2026-01-02T10:00:00Z", answeredAt: "2026-01-02T10:00:30Z", endedAt: "2026-01-02T10:01:45Z" };
  addCampaignCallsToOperatorStats(rows, [call, call], [], "day", createRow);
  assert.equal(rows["agent__2026-01-02"].callCount, 1);
  assert.equal(rows["agent__2026-01-02"].totalCallTime, 75);
  assert.equal(reportCallTalkSeconds(call), 75);
});

test("session disposition contacts are not counted again by their call log", () => {
  const rows: Record<string, any> = {
    agent__total: {
      ...createRow("agent", "total"),
      sessionsCount: 1,
      contactsHandled: 1,
      sessionDetails: [{
        sessionId: "s1", contactsHandled: 1, callCount: 0, callTime: 0,
        emailCount: 0, smsCount: 0,
      }],
    },
  };
  const session = { id: "s1", userId: "agent", status: "offline", startedAt: "2026-01-02T10:00:00Z", endedAt: "2026-01-02T11:00:00Z", contactsHandled: 1 };
  const call = {
    id: "c1", userId: "agent", status: "completed",
    startedAt: "2026-01-02T10:05:00Z", answeredAt: "2026-01-02T10:05:05Z",
    endedAt: "2026-01-02T10:06:05Z",
    metadata: JSON.stringify({ dispositionDurationSeconds: 12, dispositionFormDurationSeconds: 7 }),
  };
  addCampaignCallsToOperatorStats(rows, [call], [session], "total", createRow);
  assert.equal(rows.agent__total.contactsHandled, 1);
  assert.equal(rows.agent__total.callCount, 1);
  assert.equal(rows.agent__total.sessionDetails[0].callCount, 1);
  assert.equal(rows.agent__total.sessionDetails[0].callTime, 60);
  assert.equal(rows.agent__total.totalDispositionTime, 12);
  assert.equal(rows.agent__total.totalFormDispositionTime, 7);
  assert.equal(callHandledContactIncrement(call, [session], new Map()), 0);
});

test("agent and date filtering inputs remain isolated before aggregation", () => {
  const all = [
    { id: "wanted", userId: "a", campaignId: "mission-a", status: "completed", startedAt: "2026-02-03T10:00:00Z", answeredAt: "2026-02-03T10:00:05Z", endedAt: "2026-02-03T10:00:15Z" },
    { id: "wrong-agent", userId: "b", campaignId: "mission-a", status: "completed", startedAt: "2026-02-03T10:00:00Z", answeredAt: null, endedAt: null },
    { id: "wrong-date", userId: "a", campaignId: "mission-a", status: "completed", startedAt: "2026-03-03T10:00:00Z", answeredAt: null, endedAt: null },
    { id: "other-mission-same-customer", userId: "a", campaignId: "mission-b", status: "completed", startedAt: "2026-02-03T10:00:00Z", answeredAt: null, endedAt: null },
  ];
  const selected = all.filter(call => call.campaignId === "mission-a" && call.userId === "a"
    && call.startedAt >= "2026-02-01" && call.startedAt <= "2026-02-28T23:59:59Z");
  const rows: Record<string, any> = {};
  addCampaignCallsToOperatorStats(rows, selected, [], "total", createRow);
  assert.equal(rows.a__total.callCount, 1);
});