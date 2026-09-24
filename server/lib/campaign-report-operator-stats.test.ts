import assert from "node:assert/strict";
import test from "node:test";
import {
  addCampaignCallsToOperatorStats,
  callHandledContactIncrement,
  reportCallAnalysisSeconds,
  reportCallListTalkSeconds,
  reportCallRingSeconds,
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

test("ring time covers answered and unanswered attempts and respects the call-time limit", () => {
  assert.equal(reportCallRingSeconds({
    id: "answered", userId: "agent", status: "completed",
    startedAt: "2026-01-02T10:00:00Z", answeredAt: "2026-01-02T10:00:12.900Z",
    endedAt: "2026-01-02T10:01:00Z", metadata: JSON.stringify({ maxRingSeconds: 30 }),
  }), 12);
  assert.equal(reportCallRingSeconds({
    id: "late-answer", userId: "agent", status: "completed",
    startedAt: "2026-01-02T10:00:00Z", answeredAt: "2026-01-02T10:00:44Z",
    endedAt: "2026-01-02T10:01:00Z", metadata: JSON.stringify({ maxRingSeconds: 30 }),
  }), 30);
  assert.equal(reportCallRingSeconds({
    id: "no-answer", userId: "agent", status: "no_answer",
    startedAt: "2026-01-02T10:00:00Z", answeredAt: null,
    endedAt: "2026-01-02T10:00:31Z", metadata: JSON.stringify({ maxRingSeconds: 30 }),
  }), 30);
});

test("ring time fails closed for missing or invalid timestamps without inventing live elapsed time", () => {
  assert.equal(reportCallRingSeconds({
    id: "still-ringing", userId: "agent", status: "ringing",
    startedAt: "2026-01-02T10:00:00Z", answeredAt: null, endedAt: null,
  }), 0);
  assert.equal(reportCallRingSeconds({
    id: "clock-skew", userId: "agent", status: "failed",
    startedAt: "2026-01-02T10:00:10Z", answeredAt: null,
    endedAt: "2026-01-02T10:00:00Z", metadata: "{invalid",
  }), 0);
});

test("forwarded answered, no-answer, and busy attempts use answer evidence for talk time", () => {
  const rows: Record<string, any> = {};
  const calls = [
    {
      id: "answered", userId: "agent", status: "completed", isForwarded: true,
      startedAt: "2026-01-02T10:00:00Z", answeredAt: "2026-01-02T10:00:17Z",
      endedAt: "2026-01-02T10:01:02Z",
    },
    {
      id: "completed-without-answer", userId: "agent", status: "completed", isForwarded: true,
      startedAt: "2026-01-02T10:02:00Z", answeredAt: null,
      endedAt: "2026-01-02T10:02:31Z",
    },
    {
      id: "no-answer", userId: "agent", status: "no_answer", isForwarded: true,
      startedAt: "2026-01-02T10:03:00Z", answeredAt: null,
      endedAt: "2026-01-02T10:03:25Z",
    },
    {
      id: "busy", userId: "agent", status: "busy", isForwarded: true,
      startedAt: "2026-01-02T10:04:00Z", answeredAt: null,
      endedAt: "2026-01-02T10:04:06Z",
    },
  ];

  addCampaignCallsToOperatorStats(rows, calls, [], "total", createRow);

  assert.equal(rows.agent__total.callCount, 4);
  assert.equal(rows.agent__total.totalCallTime, 45);
  assert.equal(reportCallTalkSeconds(calls[0]), 45);
  assert.equal(reportCallTalkSeconds(calls[1]), 0);
  assert.equal(reportCallTalkSeconds(calls[2]), 0);
  assert.equal(reportCallTalkSeconds(calls[3]), 0);
});

test("operator aggregation retains completed non-forwarded calls without answer evidence", () => {
  const rows: Record<string, any> = {};
  const call = {
    id: "completed-no-answer", userId: "agent", status: "completed", isForwarded: false,
    startedAt: "2026-01-02T10:00:00Z", answeredAt: null,
    endedAt: "2026-01-02T10:00:30Z",
  };

  addCampaignCallsToOperatorStats(rows, [call], [], "total", createRow);

  assert.equal(rows.agent__total.callCount, 1);
  assert.equal(rows.agent__total.totalCallTime, 30);
  assert.equal(reportCallTalkSeconds(call), 30);
});

test("analysis and call-list integrations reject forwarded recording and elapsed durations", () => {
  const unanswered = {
    id: "unanswered", userId: "agent", status: "completed", isForwarded: true,
    startedAt: "2026-01-02T10:00:00Z", answeredAt: null,
    endedAt: "2026-01-02T10:01:20Z", durationSeconds: 80,
  };
  const answered = {
    ...unanswered, id: "answered", answeredAt: "2026-01-02T10:00:25Z", durationSeconds: 55,
  };

  assert.equal(reportCallAnalysisSeconds(unanswered, 80), 0);
  assert.equal(reportCallListTalkSeconds(unanswered), 0);
  assert.equal(reportCallTalkSeconds(unanswered), 0);
  assert.equal(reportCallAnalysisSeconds(answered, 80), 55);
  assert.equal(reportCallListTalkSeconds(answered), 55);
});

test("forwarded fractional boundaries use canonical floor duration consistently", () => {
  const canonical = {
    id: "fractional", userId: "agent", status: "completed", isForwarded: true,
    startedAt: "2026-01-02T10:00:00.000Z", answeredAt: "2026-01-02T10:00:00.100Z",
    endedAt: "2026-01-02T10:00:01.999Z", durationSeconds: 1,
  };
  const legacy = { ...canonical, id: "fractional-legacy", durationSeconds: null };
  const rows: Record<string, any> = {};

  addCampaignCallsToOperatorStats(rows, [canonical], [], "total", createRow);

  assert.equal(reportCallTalkSeconds(canonical), 1);
  assert.equal(reportCallAnalysisSeconds(canonical, 99), 1);
  assert.equal(reportCallListTalkSeconds(canonical), 1);
  assert.equal(rows.agent__total.totalCallTime, 1);
  assert.equal(reportCallTalkSeconds(legacy), 1);
});

test("focused forwarded integration preserves legacy non-forwarded report durations", () => {
  const legacy = {
    id: "legacy", userId: "agent", status: "completed", isForwarded: false,
    startedAt: "2026-01-02T10:00:00Z", answeredAt: null,
    endedAt: "2026-01-02T10:00:30Z",
  };

  assert.equal(reportCallAnalysisSeconds(legacy, 24), 24);
  assert.equal(reportCallListTalkSeconds(legacy), 30);
});

test("updated duplicate canonical rows replace stale observations without merging timestamps", () => {
  const stale = {
    id: "canonical", userId: "agent", status: "ringing", isForwarded: true,
    startedAt: "2026-01-01T23:59:50Z", answeredAt: null, endedAt: null,
  };
  const completed = {
    id: "canonical", userId: "agent", status: "completed", isForwarded: true,
    startedAt: "2026-01-02T00:00:00Z", answeredAt: "2026-01-02T00:00:12Z",
    endedAt: "2026-01-02T00:00:52Z",
    metadata: JSON.stringify({ dispositionDurationSeconds: 9 }),
  };

  for (const calls of [[stale, completed], [completed, stale]]) {
    const rows: Record<string, any> = {};
    addCampaignCallsToOperatorStats(rows, calls, [], "day", createRow);
    assert.deepEqual(Object.keys(rows), ["agent__2026-01-02"]);
    assert.equal(rows["agent__2026-01-02"].callCount, 1);
    assert.equal(rows["agent__2026-01-02"].totalCallTime, 40);
    assert.equal(rows["agent__2026-01-02"].totalDispositionTime, 9);
    assert.equal(rows["agent__2026-01-02"].dispositionCount, 1);
  }
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

test("restart-overlapped session history updates only the resumed real session", () => {
  const rows: Record<string, any> = {
    agent__total: {
      ...createRow("agent", "total"),
      sessionsCount: 2,
      totalLoginTime: 3600,
      sessionDetails: [
        {
          sessionId: "before-restart", contactsHandled: 0, callCount: 0, callTime: 0,
          emailCount: 0, smsCount: 0,
        },
        {
          sessionId: "resumed", contactsHandled: 0, callCount: 0, callTime: 0,
          emailCount: 0, smsCount: 0,
        },
      ],
    },
  };
  const sessions = [
    {
      id: "before-restart", userId: "agent", status: "offline",
      startedAt: "2026-01-02T10:00:00Z", endedAt: "2026-01-02T11:00:00Z",
    },
    {
      id: "resumed", userId: "agent", status: "offline",
      startedAt: "2026-01-02T10:30:00Z", endedAt: "2026-01-02T11:00:00Z",
    },
  ];
  const call = {
    id: "after-restart", userId: "agent", status: "completed", isForwarded: true,
    startedAt: "2026-01-02T10:35:00Z", answeredAt: "2026-01-02T10:35:08Z",
    endedAt: "2026-01-02T10:35:38Z",
  };

  addCampaignCallsToOperatorStats(rows, [call, call], sessions, "total", createRow);

  assert.equal(rows.agent__total.sessionsCount, 2);
  assert.equal(rows.agent__total.totalLoginTime, 3600);
  assert.equal(rows.agent__total.totalCallTime, 30);
  assert.equal(rows.agent__total.callCount, 1);
  assert.equal(rows.agent__total.sessionDetails[0].callCount, 0);
  assert.equal(rows.agent__total.sessionDetails[0].callTime, 0);
  assert.equal(rows.agent__total.sessionDetails[1].callCount, 1);
  assert.equal(rows.agent__total.sessionDetails[1].callTime, 30);
});