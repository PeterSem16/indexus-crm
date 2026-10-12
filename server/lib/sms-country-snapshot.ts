import { pool } from "../db";
import { countrySupported } from "./omni-sms-policy";
import type { InsertCommunicationMessage } from "@shared/schema";

export async function snapshotSmsCountry(message: InsertCommunicationMessage): Promise<string | undefined> {
  if (message.type !== "sms") return undefined;
  if (countrySupported(message.countryCode)) return message.countryCode;
  if (message.provider === "smstools") return "SK";
  const result = await pool.query(`
    SELECT COALESCE(cu.country,cl.country_code,ho.country_code,co.country_code,
      CASE WHEN cardinality(ca.country_codes)=1 THEN ca.country_codes[1] END) AS country
    FROM (SELECT 1) seed
    LEFT JOIN customers cu ON cu.id=CASE WHEN $1='customer' THEN COALESCE($2,$3) WHEN $1 IS NULL THEN $3 END
    LEFT JOIN clinics cl ON $1='clinic' AND cl.id=$2
    LEFT JOIN hospitals ho ON $1='hospital' AND ho.id=$2
    LEFT JOIN collaborators co ON $1='collaborator' AND co.id=$2
    LEFT JOIN campaigns ca ON ca.id=$4`,
  [message.entityType || null, message.entityId || null, message.customerId || null, message.campaignId || null]);
  return countrySupported(result.rows[0]?.country) ? result.rows[0].country : undefined;
}
