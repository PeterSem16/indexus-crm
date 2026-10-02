import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { communicationMessages } from "../../shared/schema";

type IncomingSms = typeof communicationMessages.$inferInsert;

/** Persist a provider callback once, including when two workers receive it simultaneously. */
export async function storeInboundSmsOnce(
  provider: "bulkgate" | "smstools",
  values: IncomingSms,
) {
  const create = async (tx: any) => {
    if (values.externalId) {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${provider}-inbound:${values.externalId}`}, 0))`);
      const [existing] = await tx.select({ id: communicationMessages.id })
        .from(communicationMessages)
        .where(and(
          eq(communicationMessages.provider, provider),
          eq(communicationMessages.direction, "inbound"),
          eq(communicationMessages.externalId, values.externalId),
        ))
        .limit(1);
      if (existing) return null;
    }
    const [created] = await tx.insert(communicationMessages)
      .values({ ...values, provider, direction: "inbound" })
      .onConflictDoNothing()
      .returning();
    return created || null;
  };
  return values.externalId ? db.transaction(create) : create(db);
}