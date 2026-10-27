import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { campaignContacts } from "../../shared/schema";
import { isEligibleScheduledCampaignCallback } from "../../shared/scheduled-callback";

type CallbackWrite = {
  campaignId: string;
  campaignContactId: string;
  policy?: string | null;
  expectedAutomaticDate?: string | null;
  fields: Partial<typeof campaignContacts.$inferInsert>;
};

/** Serialize the decision with the write. Checking before an UPDATE lets two
 * concurrent "keep existing" actions both replace the initially empty callback.
 * The same pending-status definition as Queue includes overdue and legacy rows,
 * but excludes terminal rows with an old, stale callbackDate.
 */
export async function writeStatusListCallback(input: CallbackWrite) {
  const policy = input.policy ?? "replace";
  if (policy !== "replace" && policy !== "keep_existing") throw new Error("Invalid callback replacement policy");
  return db.transaction(async tx => {
    const scope = and(
      eq(campaignContacts.id, input.campaignContactId),
      eq(campaignContacts.campaignId, input.campaignId),
    );
    const [existing] = await tx.select({
      status: campaignContacts.status,
      callbackDate: campaignContacts.callbackDate,
    }).from(campaignContacts).where(scope).for("update");
    if (!existing) throw new Error("Callback contact no longer belongs to the Mission");
    if (policy === "keep_existing" && isEligibleScheduledCampaignCallback(existing.status, existing.callbackDate) &&
      (!input.expectedAutomaticDate || existing.callbackDate!.toISOString() !== input.expectedAutomaticDate)) {
      return { callbackDate: existing.callbackDate!.toISOString(), keptExisting: true };
    }
    const [saved] = await tx.update(campaignContacts).set(input.fields).where(scope)
      .returning({ callbackDate: campaignContacts.callbackDate });
    if (!saved?.callbackDate) throw new Error("Callback write did not persist a date");
    return { callbackDate: saved.callbackDate.toISOString(), keptExisting: false };
  });
}
