import type { Pool } from "pg";
import { access } from "./mission-funnel-routes";

/** Validate the saved Mission/entity link before provider delivery. Never
 * choose an arbitrary Mission from the contact's memberships. */
export async function resolveMissionEmailContext(
  db: Pick<Pool, "query" | "connect">, userId: string, body: Record<string, unknown>,
) {
  if (body.campaignId == null || body.campaignId === "") return {};
  if (typeof body.campaignId !== "string" || typeof body.customerId !== "string")
    throw new Error("invalid_mission_email_context");
  const user = await access(userId, body.campaignId, db);
  if (!user?.canRead || body.campaignCountryCode != null &&
      (!user.country_codes?.includes(String(body.campaignCountryCode)) ||
       !user.admin && !user.countries.includes(String(body.campaignCountryCode))))
    throw new Error("invalid_mission_email_context");
  const type = body.contactType === "person" ? "collaborator" : body.contactType || "customer";
  if (!["clinic", "hospital", "collaborator", "customer"].includes(String(type)))
    throw new Error("invalid_mission_email_context");
  const { rows } = await db.query(`SELECT id FROM campaign_contacts
    WHERE campaign_id=$1 AND contact_type=$3
      AND CASE contact_type WHEN 'clinic' THEN clinic_id WHEN 'hospital' THEN hospital_id
        WHEN 'collaborator' THEN collaborator_id WHEN 'customer' THEN customer_id END=$2
    ORDER BY id LIMIT 1`, [body.campaignId, body.customerId, type]);
  if (!rows.length) throw new Error("invalid_mission_email_context");
  return { campaignId: body.campaignId, campaignContactId: rows[0].id as string };
}
