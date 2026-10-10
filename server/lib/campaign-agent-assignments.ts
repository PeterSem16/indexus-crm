import { and, eq, inArray } from "drizzle-orm";
import { campaignAgents, campaigns, type CampaignAgent } from "@shared/schema";
import type { db as applicationDatabase } from "../db";

export async function updateMissionAgentAssignments(
  database: typeof applicationDatabase, campaignId: string, userIds: string[],
  assignedBy?: string, chatSelections?: Record<string, string[] | null>,
): Promise<CampaignAgent[]> {
  return database.transaction(async tx => {
    // Lock the Mission even when it has no agents, serializing replacement saves.
    await tx.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.id, campaignId)).for("update");
    const existing = await tx.select().from(campaignAgents)
      .where(eq(campaignAgents.campaignId, campaignId)).for("update");
    const wanted = new Set(userIds);
    const removedIds = existing.filter(row => !wanted.has(row.userId)).map(row => row.id);
    if (removedIds.length) await tx.delete(campaignAgents).where(inArray(campaignAgents.id, removedIds));
    for (const userId of wanted) {
      const previous = existing.find(row => row.userId === userId);
      const explicit = chatSelections && Object.prototype.hasOwnProperty.call(chatSelections, userId);
      if (previous) {
        if (explicit) await tx.update(campaignAgents).set({ chatUserIds: chatSelections![userId] })
          .where(and(eq(campaignAgents.campaignId, campaignId), eq(campaignAgents.userId, userId)));
      } else {
        await tx.insert(campaignAgents).values({
          campaignId, userId, role: "agent", assignedBy: assignedBy || null,
          chatUserIds: explicit ? chatSelections![userId] : null,
        });
      }
    }
    return tx.select().from(campaignAgents).where(eq(campaignAgents.campaignId, campaignId));
  });
}
