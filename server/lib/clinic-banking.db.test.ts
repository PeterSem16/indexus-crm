import assert from "node:assert/strict";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { pool } from "../db";
import { clinics, insertClinicSchema } from "../../shared/schema";

// Private transaction: creates no activity, automation, notification or retained clinic.
async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const tx = drizzle(client);
    const details = {
      bankAccountName: "Clinic banking fixture", bankAccountNumber: "19-8742637541",
      bankCode: "1200", bankAccountIban: "SK3112000000198742637541", swiftCode: "TESTSKBX",
    };
    const data = insertClinicSchema.parse({ name: "Banking isolated transaction", countryCode: "SK", ...details });
    const [created] = await tx.insert(clinics).values(data).returning();
    for (const [key, value] of Object.entries(details)) assert.equal(created[key as keyof typeof created], value);
    await tx.update(clinics).set({ notes: "Legacy client omitted banking fields" }).where(eq(clinics.id, created.id));
    const [preserved] = await tx.select().from(clinics).where(eq(clinics.id, created.id));
    assert.equal(preserved.bankAccountIban, details.bankAccountIban);
    assert.equal(preserved.bankAccountName, details.bankAccountName);
    await tx.update(clinics).set({ bankAccountName: "Updated clinic account", bankAccountIban: "CZ6508000000192000145399" }).where(eq(clinics.id, created.id));
    const [updated] = await tx.select().from(clinics).where(eq(clinics.id, created.id));
    assert.equal(updated.bankAccountName, "Updated clinic account");
    assert.equal(updated.bankAccountIban, "CZ6508000000192000145399", "Foreign contract accounts remain supported");
    const empty = Object.fromEntries(Object.keys(details).map(key => [key, null]));
    await tx.update(clinics).set(empty).where(eq(clinics.id, created.id));
    const [cleared] = await tx.select().from(clinics).where(eq(clinics.id, created.id));
    for (const key of Object.keys(details)) assert.equal(cleared[key as keyof typeof cleared], null);
    console.log("PASS: actual clinic schema persists, reads, updates, preserves omitted and clears banking fields");
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
