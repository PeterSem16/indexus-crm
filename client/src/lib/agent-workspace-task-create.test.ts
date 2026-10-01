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
    assert.deepEqual(payload.tags, ["group_id:group-1"]);
    assert.equal("createdByUserId" in payload, false);
    assert.equal(payload.tags?.includes("nexus_pulse_manual"), false);
  });
});