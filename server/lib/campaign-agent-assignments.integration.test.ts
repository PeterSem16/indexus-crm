import { strict as assert } from "node:assert";
import { test } from "node:test";
import { campaignAgents, campaigns } from "@shared/schema";
import { eq } from "drizzle-orm";
import { createIsolatedCloneDatabase } from "./clone-campaign.pg-test-helper";
import { updateMissionAgentAssignments } from "./campaign-agent-assignments";
import { buildChatPolicy, chatPairAllowed } from "./chat-partner-policy";

test("Mission assignments persist chat selections while preserving assignment identity and role", async () => {
  const isolated = await createIsolatedCloneDatabase();
  try {
    const db = isolated.db;
    await db.insert(campaigns).values({ id: "mission", name: "Chat settings test" });
    await db.insert(campaignAgents).values({
      id: "old-assignment", campaignId: "mission", userId: "a", role: "supervisor",
      assignedBy: "original-manager", chatUserIds: ["b"],
    });
    let rows = await updateMissionAgentAssignments(db, "mission", ["a", "c"], "manager");
    assert.equal(rows.find(row => row.userId === "a")!.id, "old-assignment");
    assert.equal(rows.find(row => row.userId === "a")!.role, "supervisor");
    assert.equal(rows.find(row => row.userId === "a")!.assignedBy, "original-manager");
    assert.deepEqual(rows.find(row => row.userId === "a")!.chatUserIds, ["b"]);
    assert.equal(rows.find(row => row.userId === "c")!.chatUserIds, null);
    rows = await updateMissionAgentAssignments(db, "mission", ["a", "c"], "manager", { a: [] });
    assert.equal(chatPairAllowed(buildChatPolicy(rows), "a", "b"), false);
    rows = await updateMissionAgentAssignments(db, "mission", ["a"], "manager", { a: ["b", "c"] });
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0].chatUserIds, ["b", "c"]);
    rows = await updateMissionAgentAssignments(db, "mission", ["a"], "manager", { a: null });
    assert.equal(rows[0].chatUserIds, null);
    assert.equal(chatPairAllowed(buildChatPolicy(rows), "a", "d"), true);
    await updateMissionAgentAssignments(db, "mission", [], "manager");
    assert.equal((await db.select().from(campaignAgents).where(eq(campaignAgents.campaignId, "mission"))).length, 0);
  } finally { await isolated.close(); }
});
