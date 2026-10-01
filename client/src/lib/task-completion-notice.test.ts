import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  acknowledgeTaskCompletionNotice,
  dispatchTaskCompletionNoticeOnce,
  getAcknowledgedTaskCompletionNoticeIds,
  mergeTaskCompletionNotices,
  setActiveTaskCompletionNoticeUser,
  type TaskCompletionNotification,
} from "./task-completion-notice";

function notification(
  id: string,
  overrides: Partial<TaskCompletionNotification> = {},
): TaskCompletionNotification {
  return {
    id,
    userId: "agent-a",
    type: "back_office_resolved",
    title: `Saved task ${id}`,
    entityType: "task",
    entityId: `task-${id}`,
    metadata: { taskId: `task-${id}`, taskTitle: `Saved task ${id}`, source: "nexus_pulse" },
    isRead: false,
    isDismissed: false,
    createdAt: "2025-04-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("task completion notice merging", () => {
  it("merges a persisted offline notice and duplicate live deliveries into one saved notice", () => {
    const savedNotice = notification("notice-1", {
      metadata: {
        taskId: "task-1",
        taskTitle: "Saved title",
        resolution: "Confirmed server resolution",
        source: "nexus_pulse",
      },
    });
    const merged = mergeTaskCompletionNotices([], [savedNotice, savedNotice], "agent-a");

    assert.equal(merged.length, 1);
    assert.deepEqual({
      id: "notice-1",
      taskId: "task-1",
      taskTitle: "Saved title",
      resolution: "Confirmed server resolution",
      source: "nexus_pulse",
    }, {
      id: merged[0].id,
      taskId: merged[0].taskId,
      taskTitle: merged[0].taskTitle,
      resolution: merged[0].resolution,
      source: merged[0].source,
    });
  });

  it("uses the Pulse notification title as the entity heading and keeps task title as context", () => {
    const merged = mergeTaskCompletionNotices([], [
      notification("clinic-task", {
        title: "Clinic Alpha",
        entityId: "entity-task-42",
        metadata: {
          taskId: "entity-task-42",
          taskTitle: "Update address",
          source: "nexus_pulse",
        },
      }),
    ], "agent-a");

    assert.deepEqual({
      heading: merged[0].entityTitle,
      taskContext: merged[0].taskTitle,
      taskId: merged[0].taskId,
    }, {
      heading: "Clinic Alpha",
      taskContext: "Update address",
      taskId: "entity-task-42",
    });
  });

  it("keeps an ordinary completion's verified entity name as its primary heading", () => {
    const [notice] = mergeTaskCompletionNotices([], [
      notification("ordinary-client", {
        title: "CARE s.r.o. Gynekológia",
        metadata: {
          taskId: "task-ordinary",
          taskTitle: "SL: Healthcare Provider Assignment",
          source: "back_office",
        },
      }),
    ], "agent-a");

    assert.equal(notice.entityTitle, "CARE s.r.o. Gynekológia");
    assert.equal(notice.taskTitle, "SL: Healthcare Provider Assignment");
    assert.equal(notice.source, "other");
  });

  it("falls back to either legacy task title or notification title", () => {
    const onlyTaskTitle = mergeTaskCompletionNotices([], [
      notification("legacy-task-title", {
        title: null,
        metadata: { taskId: "task-legacy-1", taskTitle: "Legacy task", source: "nexus_pulse" },
      }),
    ], "agent-a")[0];
    const onlyNotificationTitle = mergeTaskCompletionNotices([], [
      notification("legacy-notification-title", {
        metadata: { taskId: "task-legacy-2", source: "nexus_pulse" },
      }),
    ], "agent-a")[0];

    assert.equal(onlyTaskTitle.entityTitle, "Legacy task");
    assert.equal(onlyTaskTitle.taskTitle, "Legacy task");
    assert.equal(onlyNotificationTitle.entityTitle, "Saved task legacy-notification-title");
    assert.equal(onlyNotificationTitle.taskTitle, "Saved task legacy-notification-title");
  });

  it("does not re-add a read or dismissed notice from an updated server snapshot", () => {
    const visible = mergeTaskCompletionNotices([], [notification("notice-1")], "agent-a");
    assert.deepEqual(mergeTaskCompletionNotices(visible, [notification("notice-1", { isRead: true })], "agent-a"), []);
    assert.deepEqual(mergeTaskCompletionNotices(visible, [notification("notice-1", { isDismissed: true })], "agent-a"), []);
  });

  it("does not restore an acknowledged notice from stale cache data", () => {
    const notice = notification("notice-1");
    const acknowledged = new Set(["notice-1"]);
    assert.deepEqual(mergeTaskCompletionNotices([], [notice], "agent-a", acknowledged), []);
  });

  it("isolates notices across authenticated user boundaries", () => {
    const previousUserNotice = mergeTaskCompletionNotices([], [notification("notice-1")], "agent-a");
    assert.deepEqual(mergeTaskCompletionNotices(previousUserNotice, [notification("notice-2")], "agent-b"), []);
    assert.equal(mergeTaskCompletionNotices([], [notification("notice-1", { userId: "agent-b" })], "agent-b").length, 1);
  });

  it("uses the source field rather than guessing Pulse from other task completion metadata", () => {
    const pulse = mergeTaskCompletionNotices([], [notification("pulse")], "agent-a");
    const other = mergeTaskCompletionNotices([], [
      notification("other", { metadata: { taskId: "task-other", taskTitle: "Other task" } }),
    ], "agent-a");
    assert.equal(pulse[0].source, "nexus_pulse");
    assert.equal(other[0].source, "other");
  });

  it("ignores unrelated notification types and non-task entities", () => {
    assert.deepEqual(mergeTaskCompletionNotices([], [
      notification("automation", { type: "automation_completed" }),
      notification("email", { entityType: "email" }),
    ], "agent-a"), []);
    assert.equal(mergeTaskCompletionNotices([], [
      notification("case-variant", { entityType: "Task" }),
    ], "agent-a").length, 1);
  });
});

describe("live completion notice dispatch", () => {
  it("deduplicates the same notification across concurrent hook mounts", () => {
    setActiveTaskCompletionNoticeUser(null);
    setActiveTaskCompletionNoticeUser("agent-a");
    let dispatchCount = 0;
    const dispatch = () => { dispatchCount++; };
    const savedNotice = notification("live-1");

    assert.equal(dispatchTaskCompletionNoticeOnce(savedNotice, "agent-a", dispatch), true);
    assert.equal(dispatchTaskCompletionNoticeOnce(savedNotice, "agent-a", dispatch), false);
    assert.equal(dispatchCount, 1);
  });

  it("does not dispatch read, dismissed, or other-user notifications", () => {
    setActiveTaskCompletionNoticeUser(null);
    setActiveTaskCompletionNoticeUser("agent-a");
    let dispatchCount = 0;
    const dispatch = () => { dispatchCount++; };

    assert.equal(dispatchTaskCompletionNoticeOnce(notification("read", { isRead: true }), "agent-a", dispatch), false);
    assert.equal(dispatchTaskCompletionNoticeOnce(notification("dismissed", { isDismissed: true }), "agent-a", dispatch), false);
    assert.equal(dispatchTaskCompletionNoticeOnce(notification("other-user", { userId: "agent-b" }), "agent-a", dispatch), false);
    assert.equal(dispatchCount, 0);
  });

  it("clears notification-id side-effect state when the authenticated user changes", () => {
    setActiveTaskCompletionNoticeUser(null);
    setActiveTaskCompletionNoticeUser("agent-a");
    const savedNotice = notification("same-id");
    let dispatchCount = 0;
    const dispatch = () => { dispatchCount++; };

    assert.equal(dispatchTaskCompletionNoticeOnce(savedNotice, "agent-a", dispatch), true);
    setActiveTaskCompletionNoticeUser("agent-b");
    assert.equal(dispatchTaskCompletionNoticeOnce(notification("same-id", { userId: "agent-b" }), "agent-b", dispatch), true);
    setActiveTaskCompletionNoticeUser("agent-a");
    assert.equal(dispatchTaskCompletionNoticeOnce(savedNotice, "agent-a", dispatch), true);
    assert.equal(dispatchCount, 3);
  });

  it("keeps a successful acknowledgement from returning through stale cache data after remount", () => {
    setActiveTaskCompletionNoticeUser(null);
    setActiveTaskCompletionNoticeUser("agent-a");
    acknowledgeTaskCompletionNotice("notice-1", "agent-a");

    assert.deepEqual(
      mergeTaskCompletionNotices([], [notification("notice-1")], "agent-a", getAcknowledgedTaskCompletionNoticeIds("agent-a")),
      [],
    );
    setActiveTaskCompletionNoticeUser("agent-b");
    assert.equal(getAcknowledgedTaskCompletionNoticeIds("agent-a").has("notice-1"), false);
  });

  it("bounds acknowledged notification IDs at 300 entries", () => {
    setActiveTaskCompletionNoticeUser(null);
    setActiveTaskCompletionNoticeUser("agent-a");
    for (let index = 0; index < 301; index++) {
      acknowledgeTaskCompletionNotice(`notice-${index}`, "agent-a");
    }

    const acknowledgedIds = getAcknowledgedTaskCompletionNoticeIds("agent-a");
    assert.equal(acknowledgedIds.size, 1);
    assert.equal(acknowledgedIds.has("notice-300"), true);
  });
});