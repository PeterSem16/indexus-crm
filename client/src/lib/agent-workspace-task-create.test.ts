import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAgentWorkspaceTaskCreatePayload } from "./agent-workspace-task-create";

describe("Agent Workspace task creation request", () => {
  it("sends Mission/session provenance evidence without selecting the task creator", () => {
    const payload = buildAgentWorkspaceTaskCreatePayload({
      title: "Manual Pulse task",
      description: "Task details",
      priority: "medium",
      relatedEntityType: "clinic",
      relatedEntityId: "clinic-1",
      country: "SK",
      groupId: "group-1",
      attachments: [],
    }, "assignee-1", {
      missionId: "mission-1",
      sessionId: "session-1",
    });

    assert.deepEqual(payload.pulseOrigin, { missionId: "mission-1", sessionId: "session-1" });
    assert.equal(payload.relatedEntityType, "clinic");
    assert.equal(payload.groupId, "group-1");
    assert.equal(payload.assignedUserId, undefined);
    assert.equal(payload.createdByUserId, undefined);
    assert.equal("tags" in payload, false);
  });
  it("creates a personal task without any group routing or creator overrides", () => {
    const payload = buildAgentWorkspaceTaskCreatePayload({
      title: "Personal task", description: "", priority: "medium", attachments: [],
    }, "person-1", { missionId: "mission-1", sessionId: "session-1" });
    assert.equal(payload.assignedUserId, "person-1");
    assert.equal("groupId" in payload, false);
    assert.equal("tags" in payload, false);
    assert.equal("createdByUserId" in payload, false);
  });
  it("creates a group task with no client-selected nominal assignee", () => {
    const payload = buildAgentWorkspaceTaskCreatePayload({
      title: "Group task", description: "", priority: "medium", groupId: "it", attachments: [],
    }, undefined, { missionId: "mission-1", sessionId: "session-1" });
    assert.equal(payload.groupId, "it");
    assert.equal("assignedUserId" in payload, false);
  });
});