import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, pool } from "./db";
import { storage } from "./storage";
import { countrySystemSettings, systemMs365Connections } from "@shared/schema";

async function main() {
  const country = `Q${randomBytes(4).toString("hex")}`;
  try {
    await storage.upsertCountrySystemSettings({
      countryCode: country, systemEmailAddress: "old@example.invalid",
      systemEmailEnabled: false, alertsEnabled: false, notificationsEnabled: false,
      systemEmailSignature: "preserve-signature", systemEmailDisplayName: "preserve-name",
      systemSmsSenderValue: "preserve-sms",
    });
    await storage.createSystemMs365Connection({
      countryCode: country, email: "first@example.invalid", isConnected: true,
      accessToken: "ENC:synthetic-storage-test",
    });
    assert.equal((await storage.getCountrySystemSettingsByCountry(country))?.systemEmailAddress, "first@example.invalid");
    await storage.updateSystemMs365Connection(country, { email: "second@example.invalid" });
    const settings = await storage.getCountrySystemSettingsByCountry(country);
    assert.equal(settings?.systemEmailAddress, "second@example.invalid");
    assert.equal(settings?.systemEmailEnabled, false);
    assert.equal(settings?.alertsEnabled, false);
    assert.equal(settings?.notificationsEnabled, false);
    assert.equal(settings?.systemEmailSignature, "preserve-signature");
    assert.equal(settings?.systemEmailDisplayName, "preserve-name");
    assert.equal(settings?.systemSmsSenderValue, "preserve-sms");
    await storage.upsertCountrySystemSettings({ countryCode: country, systemEmailAddress: "stale@example.invalid" });
    assert.equal((await storage.getCountrySystemSettingsByCountry(country))?.systemEmailAddress, "second@example.invalid");
    assert.equal(await storage.updateSystemMs365Connection(country, {
      accessToken: "ENC:must-not-overwrite", email: "wrong@example.invalid",
    }, "wrong-expected-token"), undefined);
    assert.equal((await storage.getSystemMs365Connection(country))?.accessToken, "ENC:synthetic-storage-test");
    assert.equal((await storage.getCountrySystemSettingsByCountry(country))?.systemEmailAddress, "second@example.invalid");
    await Promise.all([
      storage.updateSystemMs365Connection(country, { email: "third@example.invalid" }),
      storage.upsertCountrySystemSettings({ countryCode: country, systemEmailAddress: "stale@example.invalid" }),
    ]);
    assert.equal((await storage.getCountrySystemSettingsByCountry(country))?.systemEmailAddress, "third@example.invalid");
    console.log("Real PostgreSQL storage: create/reconnect, preserved settings, stale save, concurrent save, guarded refresh PASSED");
  } finally {
    await db.delete(systemMs365Connections).where(eq(systemMs365Connections.countryCode, country));
    await db.delete(countrySystemSettings).where(eq(countrySystemSettings.countryCode, country));
    await pool.end();
  }
}
void main().catch(() => { console.error("Storage regression failed (details withheld)"); process.exitCode = 1; });
