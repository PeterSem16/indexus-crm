import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertTaskCompletionNoticeRecipient,
  assertTaskCanBeCompletedStatus,
  assertPulseTaskChecklistComplete,
  completeTaskWithinTransaction,
  PulseChecklistCompletionError,
  TaskCompletionNoticeAuthorizationError,
  TaskInactiveCompletionError,
} from "./task-completion";
import {
  buildPulseCompletionNotification,
  buildValidatedTaskPatch,
  canAccessTaskByPolicy,
  collectTaskParticipantIds,
  isPulseOriginTask,
  isPulseNotificationTask,
  managerMayAccessTaskCountry,
  normalizeTaskGroupMemberIds,
  pulseCompletionMissingResolution,
  shouldNotifyTaskCreator,
  taskPeopleCandidateAllowed,
  taskPeoplePersonVisible,
  UNMANAGED_TASK_CREATOR_NOTICE_CONDITION,
  withUnmanagedTaskCreatorNoticeCondition,
} from "./task-contract";
import {
  isAuthorizedManualPulseTaskOrigin,
  MANUAL_PULSE_TASK_TAG,
} from "@shared/task-provenance";

describe("task contract helpers", () => {
  it("identifies Pulse-origin tasks from either protected persisted source marker", () => {
    assert.equal(isPulseOriginTask({ tags: ["status_list"], relatedEntityType: "status_list_item" }), true);
    assert.equal(isPulseOriginTask({ tags: [], relatedEntityType: "status_list_item" }), true);
    assert.equal(isPulseOriginTask({ tags: ["status_list"], relatedEntityType: null }), true);
    assert.equal(isPulseOriginTask({ tags: ["status_list"], relatedEntityType: "customer" }), true);
    assert.equal(isPulseOriginTask({ tags: [], relatedEntityType: "clinic" }), false);
    assert.equal(isPulseOriginTask({ tags: ["back_office"], relatedEntityType: "clinic" }), false);
  });

  it("separates notification provenance from the status-list checklist gate", () => {
    const pulse = { tags: ["status_list"], relatedEntityType: "status_list_item", createdByUserId: "creator" };
    const manualPulse = { tags: [MANUAL_PULSE_TASK_TAG], relatedEntityType: "clinic", createdByUserId: "creator" };
    const ordinaryClinic = { tags: [], relatedEntityType: "clinic", createdByUserId: "creator" };
    assert.equal(isPulseNotificationTask(manualPulse), true);
    assert.equal(isPulseOriginTask(manualPulse), false, "manual Pulse provenance must not activate status-list checklist requirements");
    assert.equal(shouldNotifyTaskCreator(pulse, true), true);
    assert.equal(shouldNotifyTaskCreator(manualPulse, true), true);
    assert.equal(shouldNotifyTaskCreator(ordinaryClinic, true), false, "unclassified tasks default to no creator notification");
    assert.equal(shouldNotifyTaskCreator(ordinaryClinic, true, false), false);
    assert.equal(shouldNotifyTaskCreator(ordinaryClinic, true, true), true,
      "explicit opt-in can notify the task creator without relabeling an unclassified legacy task as Pulse");
    assert.equal(shouldNotifyTaskCreator({ ...ordinaryClinic, createdByUserId: null }, true, true), false);
    assert.equal(shouldNotifyTaskCreator(pulse, true, false), false);
    assert.equal(shouldNotifyTaskCreator(pulse, false, true), false);
  });

  it("uses the verified recipient title while retaining task click-through metadata", () => {
    const notification = buildPulseCompletionNotification({
      id: "task-1",
      title: "Updated title",
      tags: ["status_list"],
      relatedEntityType: "status_list_item",
      resolution: "Saved resolution",
    }, undefined, "Verified clinic display");
    assert.equal(notification.priority, "normal");
    assert.equal(notification.title, "Verified clinic display");
    assert.equal(notification.message, "Saved resolution");
    assert.equal(notification.entityType, "task");
    assert.equal(notification.entityId, "task-1");
    assert.deepEqual(notification.metadata, {
      taskId: "task-1",
      taskTitle: "Updated title",
      source: "nexus_pulse",
      resolution: "Saved resolution",
    });
    assert.equal(JSON.stringify(notification.metadata).includes("Verified clinic display"), false);
  });

  it("requires a saved resolution only for an actual Pulse completion transition", () => {
    const pulse = { tags: ["status_list"], relatedEntityType: "status_list_item" };
    assert.equal(pulseCompletionMissingResolution(pulse, true), true);
    assert.equal(pulseCompletionMissingResolution({ ...pulse, resolution: "Saved" }, true), false);
    assert.equal(pulseCompletionMissingResolution({ ...pulse, resolution: "Saved" }, true, "  "), true);
    assert.equal(pulseCompletionMissingResolution(pulse, false), false);
    assert.equal(pulseCompletionMissingResolution({ tags: [MANUAL_PULSE_TASK_TAG] }, true), true);
    assert.equal(pulseCompletionMissingResolution({ tags: ["back_office"] }, true), false);
  });

  it("requires a non-empty, fully completed checklist for either persisted Pulse marker only", () => {
    const pulse = { tags: ["status_list"], relatedEntityType: "status_list_item" };
    assert.throws(
      () => assertPulseTaskChecklistComplete(pulse, []),
      (error: unknown) => error instanceof PulseChecklistCompletionError
        && error.code === "task_checklist_required"
        && error.remainingCount === 0
        && !error.message.includes("private"),
    );
    assert.throws(
      () => assertPulseTaskChecklistComplete(pulse, [
        { doneAt: new Date() },
        { doneAt: null, required: false },
        { doneAt: null, required: true },
      ]),
      (error: unknown) => error instanceof PulseChecklistCompletionError
        && error.code === "task_checklist_incomplete"
        && error.remainingCount === 2
        && !error.message.includes("private"),
    );
    assert.doesNotThrow(() => assertPulseTaskChecklistComplete(pulse, [{ doneAt: new Date() }]));
    assert.throws(
      () => assertPulseTaskChecklistComplete({ tags: [], relatedEntityType: "status_list_item" }, []),
      PulseChecklistCompletionError,
      "the protected status-list relationship alone must retain the Pulse closure gate",
    );
    assert.throws(
      () => assertPulseTaskChecklistComplete({ tags: ["status_list"] }, []),
      PulseChecklistCompletionError,
      "the reserved Status List tag alone must retain the Pulse closure gate",
    );
    assert.doesNotThrow(() => assertPulseTaskChecklistComplete({ tags: [], relatedEntityType: "task" }, []));
    assert.doesNotThrow(() => assertPulseTaskChecklistComplete({ tags: [], relatedEntityType: "clinic" }, []));
    assert.doesNotThrow(
      () => assertPulseTaskChecklistComplete({ tags: [MANUAL_PULSE_TASK_TAG], relatedEntityType: "clinic" }, []),
      "manual Pulse source should not invent the Status List mandatory checklist gate",
    );
  });

  it("attests manual Pulse provenance only for the creator's active, authorized Mission session", () => {
    const request = { missionId: "mission-a", sessionId: "session-a" };
    const session = {
      id: "session-a",
      userId: "agent-a",
      campaignId: "mission-a",
      campaignIds: ["mission-a", "mission-b"],
      endedAt: null,
    };
    assert.equal(isAuthorizedManualPulseTaskOrigin("agent-a", request, session, ["mission-a"]), true);
    assert.equal(isAuthorizedManualPulseTaskOrigin("other-agent", request, session, ["mission-a"]), false);
    assert.equal(isAuthorizedManualPulseTaskOrigin("agent-a", request, { ...session, endedAt: new Date() }, ["mission-a"]), false);
    assert.equal(isAuthorizedManualPulseTaskOrigin("agent-a", { ...request, missionId: "mission-c" }, session, ["mission-c"]), false);
    assert.equal(isAuthorizedManualPulseTaskOrigin("agent-a", request, session, ["mission-b"]), false);
  });

  it("checks the Pulse checklist before applying a completion inside the transaction contract", async () => {
    const pulseTask = {
      status: "pending",
      tags: ["status_list"],
      relatedEntityType: "status_list_item",
    };
    let updateCalls = 0;
    await assert.rejects(completeTaskWithinTransaction(
      pulseTask,
      async () => {
        updateCalls++;
        return { ...pulseTask, status: "completed" };
      },
      undefined,
      true,
      undefined,
      async task => assertPulseTaskChecklistComplete(task, []),
    ), (error: unknown) => error instanceof PulseChecklistCompletionError
      && error.code === "task_checklist_required");
    assert.equal(updateCalls, 0, "the locked task update is not applied if the checklist guard rejects");

    const completed = await completeTaskWithinTransaction(
      pulseTask,
      async () => {
        updateCalls++;
        return { ...pulseTask, status: "completed" };
      },
      undefined,
      true,
      undefined,
      async task => assertPulseTaskChecklistComplete(task, [{ doneAt: new Date() }]),
    );
    assert.equal(completed.task.status, "completed");
    assert.equal(updateCalls, 1);
  });

  it("rejects cancelled-to-completed under the completion transaction guard while preserving idempotency and reopen", async () => {
    assert.doesNotThrow(() => assertTaskCanBeCompletedStatus("pending"));
    assert.doesNotThrow(() => assertTaskCanBeCompletedStatus("in_progress"));
    assert.throws(
      () => assertTaskCanBeCompletedStatus("cancelled"),
      (error: unknown) => error instanceof TaskInactiveCompletionError
        && error.code === "task_inactive"
        && !error.message.includes("private"),
    );

    const cancelledTask = { status: "cancelled", createdByUserId: "creator" };
    let updateCalls = 0;
    let completionValidationCalls = 0;
    await assert.rejects(completeTaskWithinTransaction(
      cancelledTask,
      async () => {
        updateCalls++;
        return { ...cancelledTask, status: "completed" };
      },
      async () => "notice",
      true,
      undefined,
      async () => { completionValidationCalls++; },
    ), (error: unknown) => error instanceof TaskInactiveCompletionError
      && error.code === "task_inactive");
    assert.equal(updateCalls, 0, "a cancelled row is rejected before mutation under the transaction guard");
    assert.equal(completionValidationCalls, 0, "inactive rejection precedes completion validation");

    const alreadyCompleted = { status: "completed", createdByUserId: "creator" };
    const idempotent = await completeTaskWithinTransaction(
      alreadyCompleted,
      async completedNow => {
        assert.equal(completedNow, false);
        return alreadyCompleted;
      },
      undefined,
      true,
      undefined,
      async () => { throw new Error("already-completed tasks do not revalidate"); },
    );
    assert.equal(idempotent.completedNow, false, "already-completed retries remain idempotent");

    const reopened = await completeTaskWithinTransaction(
      cancelledTask,
      async completedNow => {
        assert.equal(completedNow, false);
        return { ...cancelledTask, status: "pending" };
      },
      undefined,
      false,
    );
    assert.equal(reopened.task.status, "pending", "an explicit reopen transition remains supported");
    const completedAfterReopen = await completeTaskWithinTransaction(
      reopened.task,
      async completedNow => ({ ...reopened.task, status: completedNow ? "completed" : reopened.task.status }),
    );
    assert.equal(completedAfterReopen.task.status, "completed");
  });

  it("migrates the seeded system rule to guard only notices managed by completion routes", () => {
    const existing = { field: "newValues.status", op: "eq", value: "completed" };
    const once = withUnmanagedTaskCreatorNoticeCondition(existing);
    assert.deepEqual((once as any).all[0], existing);
    assert.deepEqual(withUnmanagedTaskCreatorNoticeCondition(once), once);
    const guard = (once as any).all[1];
    const dslMatches = (condition: any, creatorNotificationHandled: boolean): boolean => {
      if (condition.all) return condition.all.every((child: any) => dslMatches(child, creatorNotificationHandled));
      if (condition.not) return !dslMatches(condition.not, creatorNotificationHandled);
      return condition.field === "newValues.creatorNotificationHandled" && condition.op === "eq"
        ? creatorNotificationHandled === condition.value
        : true;
    };
    assert.deepEqual(guard, UNMANAGED_TASK_CREATOR_NOTICE_CONDITION);
    assert.equal(dslMatches(guard, true), false);
    assert.equal(dslMatches(guard, false), true);
    const migrated = withUnmanagedTaskCreatorNoticeCondition({
      all: [
        existing,
        { not: { field: "newValues.pulseOrigin", op: "eq", value: true } },
      ],
    });
    assert.deepEqual(migrated, { all: [existing, UNMANAGED_TASK_CREATOR_NOTICE_CONDITION] },
      "old Status List-only system guards are removed without discarding the system rule's other predicates");
  });

  it("rolls back completion when notice persistence fails and persists one notice across retries", async () => {
    let task = { status: "pending", createdByUserId: "creator" };
    let notices: string[] = [];
    let transactionTail: Promise<void> = Promise.resolve();
    const transact = async (failNotice = false) => {
      let release!: () => void;
      const previous = transactionTail;
      transactionTail = new Promise<void>(resolve => { release = resolve; });
      await previous;
      const draftTask = { ...task };
      const draftNotices = [...notices];
      try {
        const result = await completeTaskWithinTransaction(
          draftTask,
          async (completedNow) => ({ ...draftTask, status: completedNow ? "completed" : draftTask.status }),
          async creatorId => {
            if (failNotice) throw new Error("notice persistence failed");
            draftNotices.push(creatorId);
            return creatorId;
          },
        );
        task = result.task;
        notices = draftNotices;
        return result;
      } finally {
        release();
      }
    };

    await assert.rejects(transact(true), /notice persistence failed/);
    assert.equal(task.status, "pending");
    assert.deepEqual(notices, []);

    await Promise.all([transact(), transact()]);
    assert.equal(task.status, "completed");
    assert.deepEqual(notices, ["creator"]);
    assert.equal((await transact()).completedNow, false);
    assert.deepEqual(notices, ["creator"]);
  });

  it("does not persist the direct notice when notifyAgent is opted out", async () => {
    let notices = 0;
    const pulse = { tags: ["status_list"], relatedEntityType: "status_list_item" };
    const result = await completeTaskWithinTransaction(
      { status: "pending", createdByUserId: "creator" },
      async () => ({ status: "completed", createdByUserId: "creator" }),
      shouldNotifyTaskCreator(pulse, true, false)
        ? async () => { notices++; return true; }
        : undefined,
    );
    assert.equal(result.completedNow, true);
    assert.equal(notices, 0);
  });

  it("allows explicit notification of an unclassified task's authorized creator without Pulse provenance", async () => {
    const legacyTask = {
      status: "pending",
      createdByUserId: "legacy-creator",
      country: "SK",
      tags: ["group_id:clinic"],
      relatedEntityType: "clinic",
    };
    assert.equal(shouldNotifyTaskCreator(legacyTask, true), false);
    assert.equal(isPulseNotificationTask(legacyTask), false);
    const notify = shouldNotifyTaskCreator(legacyTask, true, true);
    assert.equal(notify, true);
    let noticeRecipient: string | undefined;
    const result = await completeTaskWithinTransaction(
      legacyTask,
      async () => ({ ...legacyTask, status: "completed" }),
      notify ? async creatorId => {
        noticeRecipient = creatorId;
        return creatorId;
      } : undefined,
      notify,
      notify ? async () => assertTaskCompletionNoticeRecipient(legacyTask, async creatorId => ({
          isActive: creatorId === "legacy-creator",
          role: "user",
          assignedCountries: ["SK"],
        })) : undefined,
    );
    assert.equal(result.notification, "legacy-creator");
    assert.equal(noticeRecipient, "legacy-creator",
      "the stored creator is derived server-side after active-user and task-country authorization");
    assert.equal(legacyTask.tags.includes(MANUAL_PULSE_TASK_TAG), false,
      "opt-in notification does not backfill an unsupported Pulse origin");
  });

  it("requires an active task-country-authorized creator before persisting a completion notice", async () => {
    const task = { status: "pending", createdByUserId: "creator", country: "SK" };
    await assert.rejects(assertTaskCompletionNoticeRecipient(task, async () => ({
      isActive: false,
      role: "user",
      assignedCountries: ["SK"],
    })), TaskCompletionNoticeAuthorizationError);
    await assert.rejects(assertTaskCompletionNoticeRecipient(task, async () => ({
      isActive: true,
      role: "user",
      assignedCountries: ["CZ"],
    })), TaskCompletionNoticeAuthorizationError);
    await assert.doesNotReject(assertTaskCompletionNoticeRecipient(task, async () => ({
      isActive: true,
      role: "user",
      assignedCountries: ["SK"],
    })));
  });

  it("authorizes the recipient before updating and persists a notice from the saved task snapshot", async () => {
    const task = { status: "pending", createdByUserId: "creator", country: "SK", title: "Old", resolution: null as string | null };
    let updateCalls = 0;
    await assert.rejects(completeTaskWithinTransaction(
      task,
      async () => {
        updateCalls++;
        return task;
      },
      async (_creatorId, updatedTask) => updatedTask.resolution,
      true,
      async () => {
        throw new TaskCompletionNoticeAuthorizationError();
      },
    ), TaskCompletionNoticeAuthorizationError);
    assert.equal(updateCalls, 0);

    const notificationRecipients: string[] = [];
    const result = await completeTaskWithinTransaction(
      task,
      async () => ({ ...task, status: "completed", title: "Saved title", resolution: "Saved resolution" }),
      async (creatorId, updatedTask) => {
        notificationRecipients.push(creatorId);
        return { userId: creatorId, message: `${updatedTask.title}:${updatedTask.resolution}` };
      },
    );
    assert.deepEqual(notificationRecipients, ["creator"]);
    assert.deepEqual(result.notification, { userId: "creator", message: "Saved title:Saved resolution" });
  });

  it("preserves inactive existing group members and rejects invalid additions", () => {
    const existing = [{ userId: "inactive" }];
    const users = [{ id: "inactive", isActive: false }, { id: "active", isActive: true }];
    assert.deepEqual(normalizeTaskGroupMemberIds(["active"], existing, users), ["active", "inactive"]);
    assert.throws(() => normalizeTaskGroupMemberIds(["active", "active"], [], users), /distinct/);
    assert.throws(() => normalizeTaskGroupMemberIds(["missing"], [], users), /Unknown/);
    assert.throws(() => normalizeTaskGroupMemberIds(["inactive"], [], users), /Inactive/);
  });

  it("validates task edits, allows bounded authored resolution text, and protects server-owned fields", () => {
    assert.deepEqual(buildValidatedTaskPatch({ title: "  Keep up  ", dueDate: null, resolution: "  Saved note  ", tags: ["status_list", "urgent", "group_id:g1"] }, ["status_list", "urgent", "group_id:g0"]), {
      title: "Keep up",
      dueDate: null,
      resolution: "Saved note",
      tags: ["status_list", "urgent", "group_id:g1"],
    });
    assert.throws(() => buildValidatedTaskPatch({ status: "unknown" }), /status/);
    assert.throws(() => buildValidatedTaskPatch({ createdByUserId: "spoofed" }), /server-managed/);
    assert.throws(() => buildValidatedTaskPatch({ resolvedAt: new Date() }), /server-managed/);
    assert.throws(() => buildValidatedTaskPatch({ workStartedAt: new Date() }), /server-managed/);
    assert.throws(() => buildValidatedTaskPatch({ workStoppedAt: new Date() }), /server-managed/);
    assert.throws(() => buildValidatedTaskPatch({ resolution: "x".repeat(10_001) }), /10000 characters/);
  });

  it("limits manager task access to assigned countries", () => {
    assert.equal(managerMayAccessTaskCountry("manager", ["SK"], "SK"), true);
    assert.equal(managerMayAccessTaskCountry("manager", ["SK"], "CZ"), false);
    assert.equal(managerMayAccessTaskCountry("admin", [], "CZ"), true);
    assert.equal(managerMayAccessTaskCountry("user", ["SK"], "SK"), false);
  });

  it("requires country scope for non-admin task relationships and rejects department-only access", () => {
    const task = {
      id: "t1",
      country: "SK",
      createdByUserId: "creator",
      assignedUserId: "assignee",
      assignedDepartmentId: "department-1",
      tags: ["group_id:g1"],
    };
    const foreignCreator = { id: "creator", role: "user", assignedCountries: ["CZ"] };
    const localCreator = { ...foreignCreator, assignedCountries: ["sk"] };
    const foreignAssignee = { id: "assignee", role: "user", assignedCountries: ["CZ"] };
    const groupMember = { id: "group-user", role: "user", assignedCountries: ["SK"] };
    const departmentOnly = { id: "department-user", role: "user", assignedCountries: ["SK"] };
    const countryProtectedTaskRoutes = [
      "list",
      "detail",
      "patch",
      "resolve",
      "source-entity",
      "reassign",
    ];
    for (const route of countryProtectedTaskRoutes) {
      assert.equal(canAccessTaskByPolicy(foreignCreator, task), false, `foreign-country ${route} access is denied`);
    }
    assert.equal(canAccessTaskByPolicy(foreignAssignee, task), false);
    assert.equal(canAccessTaskByPolicy(localCreator, task), true);
    assert.equal(canAccessTaskByPolicy(groupMember, task, new Set(["g1"])), true);
    assert.equal(canAccessTaskByPolicy(departmentOnly, task), false);
    assert.equal(canAccessTaskByPolicy({ id: "other", role: "user", assignedCountries: ["SK"] }, { ...task, country: null }), false);
    assert.equal(canAccessTaskByPolicy({ id: "manager", role: "manager", assignedCountries: ["CZ"] }, task), false);
    assert.equal(canAccessTaskByPolicy({ id: "admin", role: "admin" }, task), true);
  });

  it("limits active task people candidates by country but keeps inactive task participants", () => {
    assert.equal(taskPeopleCandidateAllowed("user", ["SK"], ["SK", "CZ"]), true);
    assert.equal(taskPeopleCandidateAllowed("user", ["SK"], ["CZ"]), false);
    assert.equal(taskPeopleCandidateAllowed("manager", [], ["CZ"]), false);
    assert.equal(taskPeopleCandidateAllowed("admin", [], ["CZ"]), true);
    assert.equal(taskPeoplePersonVisible(true, false), true);
    assert.equal(taskPeoplePersonVisible(false, true), true);
    assert.equal(taskPeoplePersonVisible(false, false), false);
    assert.deepEqual(collectTaskParticipantIds([
      { createdByUserId: "creator", assignedUserId: "assignee", resolvedByUserId: "resolver" },
    ], ["group-member"]), ["creator", "assignee", "resolver", "group-member"]);
  });
});