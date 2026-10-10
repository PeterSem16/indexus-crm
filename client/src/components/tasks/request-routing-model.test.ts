import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultRecipients, recipientsAreAvailable, requestTypeLabel, toggleRecipient } from "./request-routing-model";
import { translations } from "@/i18n/translations";
import { taskCommunicationTranslations } from "@/i18n/task-communication-translations";
import { buildAgentWorkspaceTaskCreatePayload } from "@/lib/agent-workspace-task-create";

describe("Request routing and localization", () => {
  const type = { id: "custom", name: "Custom", groupIds: ["bo"], userIds: ["a"], enabled: true };
  it("prefills combinations without mutating the stored type", () => {
    const selected = defaultRecipients(type);
    selected.groupIds.push("it");
    assert.deepEqual(type.groupIds, ["bo"]);
    assert.deepEqual(defaultRecipients({ ...type, enabled: false }), { groupIds: [], userIds: [] });
  });
  it("manual changes keep the other recipient kind", () => {
    assert.deepEqual(toggleRecipient(defaultRecipients(type), "userIds", "b"), { groupIds: ["bo"], userIds: ["a", "b"] });
    assert.deepEqual(toggleRecipient(defaultRecipients(type), "groupIds", "bo"), { groupIds: [], userIds: ["a"] });
  });
  it("detects unavailable defaults instead of silently dropping them", () => {
    assert.ok(!recipientsAreAvailable(defaultRecipients(type), [{ id: "bo" }], []));
    assert.ok(recipientsAreAvailable(defaultRecipients(type), [{ id: "bo" }], [{ id: "a" }]));
  });
  it("builds one shared request payload, retaining content, attachments and Mission provenance", () => {
    const payload = buildAgentWorkspaceTaskCreatePayload({
      title: "My own title", description: "My authored message", priority: "high", attachments: [],
      recipients: defaultRecipients(type), requestTypeId: type.id,
    }, undefined, { missionId: "mission", sessionId: "session" });
    assert.deepEqual(payload.recipients, { groupIds: ["bo"], userIds: ["a"] });
    assert.equal(payload.title, "My own title");
    assert.equal(payload.description, "My authored message");
    assert.equal(payload.requestTypeId, "custom");
    assert.ok(!("assignedUserId" in payload));
    assert.deepEqual(payload.pulseOrigin, { missionId: "mission", sessionId: "session" });
  });
  it("provides complete copy in all seven languages and preserves authored custom names", () => {
    const keys = Object.keys(taskCommunicationTranslations.en).sort();
    for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"] as const) {
      assert.deepEqual(Object.keys(taskCommunicationTranslations[locale]).sort(), keys);
      assert.ok(Object.values(taskCommunicationTranslations[locale]).every(value => value.trim().length > 0));
      assert.equal(requestTypeLabel({ id: "change_data", name: "change_data" }, translations[locale]), translations[locale].quickCreate.catChangeData);
      assert.equal(requestTypeLabel(type, translations[locale]), "Custom");
    }
  });
});
