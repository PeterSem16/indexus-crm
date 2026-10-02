import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { communicationMessages } from "../../shared/schema";

type IncomingEmail = typeof communicationMessages.$inferInsert;

/** Reconcile personal/system mailbox ingestion before publishing workflow events. */
export async function storeInboundEmailOnce(externalId: string, values: IncomingEmail) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`inbound-email:${externalId}`}, 0))`);
    const [existing] = await tx.select({ id: communicationMessages.id })
      .from(communicationMessages)
      .where(and(
        eq(communicationMessages.externalId, externalId),
        eq(communicationMessages.direction, "inbound"),
        eq(communicationMessages.type, "email"),
      )).limit(1);
    if (existing) return null;
    const [created] = await tx.insert(communicationMessages)
      .values({ ...values, type: "email", direction: "inbound", externalId })
      .returning();
    return created || null;
  });
}