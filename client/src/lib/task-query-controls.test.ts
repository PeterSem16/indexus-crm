import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chooseTaskGroupForSave, clampTaskPage, filterTasksByDate, getFreshTaskById, getTaskGroupId, getTaskPresetRange, isPulseNotificationTask, isPulseStatusListTask, matchesTaskPeopleAndSearch, requiresPulseResolutionForCompletion, sortTasks } from "./task-query-controls";
import { MANUAL_PULSE_TASK_TAG } from "@shared/task-provenance";

describe("task query controls", () => {
  it("uses a Monday-based local week and month boundaries", () => {
    const date = new Date(2025, 2, 30, 12);
    assert.deepEqual(getTaskPresetRange("week", date), { from: "2025-03-24", to: "2025-03-30" });
    assert.deepEqual(getTaskPresetRange("month", date), { from: "2025-03-01", to: "2025-03-31" });
  });

  it("uses Bratislava calendar dates across the spring DST change", () => {
    assert.deepEqual(getTaskPresetRange("today", new Date("2025-03-30T22:30:00.000Z")), { from: "2025-03-31", to: "2025-03-31" });
    assert.deepEqual(filterTasksByDate([
      { id: "before", createdAt: "2025-03-30T00:30:00.000Z" },
      { id: "after", createdAt: "2025-03-30T22:30:00.000Z" },
    ], { preset: "custom", basis: "created", range: { from: "2025-03-30", to: "2025-03-30" } }).map(task => task.id), ["before"]);
  });

  it("filters inclusive ranges on the chosen date basis without mutating tasks", () => {
    const tasks = [
      { id: "b", createdAt: "2025-01-02T12:00:00", dueDate: "2025-01-08", title: "Z" },
      { id: "a", createdAt: "2025-01-01T12:00:00", dueDate: null, title: "A" },
    ];
    const original = [...tasks];
    assert.deepEqual(filterTasksByDate(tasks, { preset: "custom", basis: "due", range: { from: "2025-01-08", to: "2025-01-08" } }), [tasks[0]]);
    assert.deepEqual(sortTasks(tasks, "title", "asc").map(task => task.id), ["a", "b"]);
    assert.deepEqual(sortTasks(tasks, "created", "desc").map(task => task.id), ["b", "a"]);
    assert.deepEqual(tasks, original);
  });

  it("sorts priority in both directions and leaves missing dates deterministic", () => {
    const tasks = [
      { id: "low", priority: "low" },
      { id: "urgent", priority: "urgent" },
      { id: "middle", priority: "medium" },
    ];
    assert.deepEqual(sortTasks(tasks, "priority", "desc").map(task => task.id), ["urgent", "middle", "low"]);
    assert.deepEqual(sortTasks(tasks, "priority", "asc").map(task => task.id), ["low", "middle", "urgent"]);
  });

  it("recognizes Pulse status-list provenance", () => {
    assert.equal(isPulseStatusListTask({ relatedEntityType: "status_list_item" }), true);
    assert.equal(isPulseStatusListTask({ tags: ["status_list"] }), true);
  });

  it("recognizes validated manual Pulse notification provenance without the Status List gate", () => {
    const manualPulseTask = { status: "pending", relatedEntityType: "clinic", tags: [MANUAL_PULSE_TASK_TAG] };
    assert.equal(isPulseStatusListTask(manualPulseTask), false);
    assert.equal(isPulseNotificationTask(manualPulseTask), true);
    assert.equal(requiresPulseResolutionForCompletion(manualPulseTask, "completed", "  "), true);
    assert.equal(isPulseNotificationTask({ relatedEntityType: "clinic", tags: [] }), false);
  });

  it("requires a resolution only for a new Pulse completion transition", () => {
    const pulseTask = { status: "pending", tags: ["status_list"] };
    assert.equal(requiresPulseResolutionForCompletion(pulseTask, "completed", "  "), true);
    assert.equal(requiresPulseResolutionForCompletion(pulseTask, "completed", "Fixed"), false);
    assert.equal(requiresPulseResolutionForCompletion({ ...pulseTask, status: "completed" }, "completed", ""), false);
    assert.equal(requiresPulseResolutionForCompletion({ status: "pending" }, "completed", ""), false);
  });

  it("searches title, description, assignee, creator and resolver and applies creator/resolver filters", () => {
    const people = [
      { id: "a", fullName: "Ada Lovelace", username: "ada" },
      { id: "b", fullName: "Grace Hopper", username: "grace" },
      { id: "c", fullName: "Lin Chen", username: "lin" },
    ];
    const task = { title: "Review", description: "Renew the file", assignedUserId: "a", createdByUserId: "b", resolvedByUserId: "c" };
    const opts = { people };
    assert.equal(matchesTaskPeopleAndSearch(task, { ...opts, query: "renew" }), true);
    assert.equal(matchesTaskPeopleAndSearch(task, { ...opts, query: "ada" }), true);
    assert.equal(matchesTaskPeopleAndSearch(task, { ...opts, query: "grace" }), true);
    assert.equal(matchesTaskPeopleAndSearch(task, { ...opts, query: "lin" }), true);
    assert.equal(matchesTaskPeopleAndSearch(task, { ...opts, creatorId: "b" }), true);
    assert.equal(matchesTaskPeopleAndSearch(task, { ...opts, creatorId: "a" }), false);
    assert.equal(matchesTaskPeopleAndSearch(task, { ...opts, resolverId: "c" }), true);
    assert.equal(matchesTaskPeopleAndSearch(task, { ...opts, resolverId: "b" }), false);
  });

  it("only clamps the shared pager while Tasks is active", () => {
    assert.equal(clampTaskPage(4, 1, "email"), 4);
    assert.equal(clampTaskPage(4, 1, "sms"), 4);
    assert.equal(clampTaskPage(4, 1, "tasks"), 0);
  });

  it("uses the latest task and avoids overwriting an untouched group form with stale tags", () => {
    const latest = { id: "task-1", tags: ["status_list", "group_id:latest"] };
    assert.equal(getFreshTaskById([latest], "task-1"), latest);
    assert.equal(getFreshTaskById([latest], "missing"), null);
    assert.equal(getTaskGroupId(latest.tags), "latest");
    assert.equal(chooseTaskGroupForSave(latest.tags, "stale", false), "latest");
    assert.equal(chooseTaskGroupForSave(latest.tags, "chosen", true), "chosen");
  });
});