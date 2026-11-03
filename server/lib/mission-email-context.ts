import type { Pool } from "pg";
import type { CommunicationMessage, InsertCommunicationMessage } from "../../shared/schema";
import { access } from "./mission-funnel-routes";
import { isMs365SendEvidence, type Ms365SendEvidence } from "./ms365-send-evidence";
import { emailPurposeSchema, emailFunnelStepsSchema, type EmailTemplateSnapshot } from "../../shared/email-purpose";

const entities = {
  customer: { table: "customers", country: "country" },
  clinic: { table: "clinics", country: "country_code" },
  hospital: { table: "hospitals", country: "country_code" },
  collaborator: { table: "collaborators", country: "country_code" },
} as const;

/** Validate the saved Mission/entity link before provider delivery. Never
 * choose an arbitrary Mission from the contact's memberships. */
export async function resolveMissionEmailContext(
  db: Pick<Pool, "query" | "connect">, userId: string, body: Record<string, unknown>,
) {
  const campaignId = body.campaignId == null || body.campaignId === "" ? null : body.campaignId;
  const entityId = body.entityId ?? body.customerId ?? null;
  const rawType = body.entityType ?? body.contactType ?? "customer";
  const type = rawType === "person" ? "collaborator" : rawType;
  const invalid: () => never = () => { throw new Error("invalid_mission_email_context"); };
  if (campaignId !== null && (typeof campaignId !== "string" || !entityId)) invalid();
  if (body.entityId != null && body.customerId != null && body.entityId !== body.customerId) invalid();
  if (body.entityType != null && body.contactType != null &&
      body.entityType !== (body.contactType === "person" ? "collaborator" : body.contactType)) invalid();
  if (typeof type !== "string" || !Object.hasOwn(entities, type) ||
      entityId !== null && (typeof entityId !== "string" || !entityId)) invalid();
  const entityType = type as keyof typeof entities;
  let countryCode: string | null = null;
  if (entityId) {
    const spec = entities[entityType];
    const { rows } = await db.query(`SELECT ${spec.country} AS country_code FROM ${spec.table} WHERE id=$1`, [entityId]);
    countryCode = rows[0]?.country_code;
    if (!countryCode) invalid();
  }
  if (body.campaignCountryCode != null && (typeof body.campaignCountryCode !== "string" ||
      !body.campaignCountryCode || countryCode && countryCode !== body.campaignCountryCode)) invalid();
  countryCode ??= typeof body.campaignCountryCode === "string" ? body.campaignCountryCode : null;
  if (body.useSystemMailbox === true && !countryCode) invalid();
  let emailTemplate: EmailTemplateSnapshot | undefined;
  if (body.emailTemplateId != null && body.emailTemplateId !== "") {
    if (typeof body.emailTemplateId !== "string") invalid();
    const { rows } = await db.query(`SELECT id,name,type,is_active,country_codes,email_purpose,email_funnel_steps
      FROM message_templates WHERE id=$1`, [body.emailTemplateId]);
    const template = rows[0];
    const purpose = emailPurposeSchema.safeParse(template?.email_purpose);
    if (!template || template.type !== "email" || template.is_active !== true ||
        !purpose.success || !Array.isArray(template.country_codes) ||
        template.country_codes.length > 0 && (!countryCode || !template.country_codes.includes(countryCode)))
      invalid();
    emailTemplate = { id: template.id, name: template.name, purpose: purpose.data };
    if (template.email_funnel_steps != null) {
      const steps = emailFunnelStepsSchema.safeParse(template.email_funnel_steps);
      if (!steps.success) invalid();
      emailTemplate.funnelSteps = [...steps.data];
    }
  }

  if (campaignId === null) {
    if (countryCode) {
      const { rows } = await db.query("SELECT role,assigned_countries FROM users WHERE id=$1 AND is_active", [userId]);
      if (!rows[0] || rows[0].role !== "admin" && !rows[0].assigned_countries?.includes(countryCode)) invalid();
    }
    return { campaignId: null, entityType: entityId ? entityType : null, entityId,
      countryCode, campaignContactId: null, ...(emailTemplate ? { emailTemplate } : {}) };
  }
  const user = await access(userId, campaignId as string, db);
  if (!user?.canRead || !countryCode || !user.country_codes?.includes(countryCode) ||
      !user.admin && !user.countries.includes(countryCode))
    throw new Error("invalid_mission_email_context");
  const { rows } = await db.query(`SELECT id FROM campaign_contacts
    WHERE campaign_id=$1 AND contact_type=$3
      AND CASE contact_type WHEN 'clinic' THEN clinic_id WHEN 'hospital' THEN hospital_id
        WHEN 'collaborator' THEN collaborator_id WHEN 'customer' THEN customer_id END=$2
    ORDER BY id`, [campaignId, entityId, entityType]);
  if (rows.length !== 1) throw new Error("invalid_mission_email_context");
  return { campaignId: campaignId as string, campaignContactId: rows[0].id as string,
    entityType, entityId, countryCode, ...(emailTemplate ? { emailTemplate } : {}) };
}

export type MissionEmailContext = Awaited<ReturnType<typeof resolveMissionEmailContext>>;

/** Only persisted columns; campaignContactId is validation evidence, not a message column. */
export function missionEmailFields(context: MissionEmailContext) {
  return { campaignId: context.campaignId, entityType: context.entityType, entityId: context.entityId,
    countryCode: context.countryCode, customerId: context.entityId,
    direction: "outbound", provider: "ms365" };
}

/** Persist the verified envelope before transport, including an explicit null Mission
 * for standalone compose. Failure to save must prevent provider delivery. */
export async function deliverAttributedEmail<T>(
  store: {
    createCommunicationMessage(data: InsertCommunicationMessage): Promise<{ id: string }>;
    updateCommunicationMessage(id: string, data: Partial<CommunicationMessage>): Promise<unknown>;
  },
  context: MissionEmailContext,
  message: { userId: string; subject: string; content: string; recipientEmail: string; metadata?: string },
  send: () => Promise<T>,
) {
  const originalMetadata = JSON.parse(message.metadata || "{}");
  if (!originalMetadata || typeof originalMetadata !== "object" || Array.isArray(originalMetadata))
    throw new Error("invalid_email_metadata");
  // Overwrite rather than merge caller-authored attribution. Purpose and template
  // identity are a frozen server-read snapshot, not a subject/body heuristic.
  originalMetadata.missionEmail = {
    version: 1, campaignId: context.campaignId,
    campaignContactId: context.campaignContactId, entityType: context.entityType,
    entityId: context.entityId, countryCode: context.countryCode,
    templateId: context.emailTemplate?.id ?? null,
    templateName: context.emailTemplate?.name ?? null,
    purpose: context.emailTemplate?.purpose ?? "unspecified",
    ...(context.emailTemplate?.funnelSteps !== undefined
      ? { funnelSteps: [...context.emailTemplate.funnelSteps] } : {}),
  };
  const envelope = {
    ...message, ...missionEmailFields(context), type: "email", status: "pending",
    metadata: JSON.stringify(originalMetadata),
    sentAt: null, externalId: null,
  };
  const record = await store.createCommunicationMessage(envelope);
  let result: T;
  try { result = await send(); }
  catch (error) {
    const uncertain = (error as { deliveryUncertain?: boolean })?.deliveryUncertain === true;
    const evidence = (error as { sendEvidence?: Partial<Ms365SendEvidence> })?.sendEvidence;
    await store.updateCommunicationMessage(record.id, {
      status: uncertain ? "pending" : "failed", sentAt: null,
      ...(evidence?.externalId ? { externalId: evidence.externalId } : {}),
      ...(uncertain || evidence ? { metadata: JSON.stringify({
        ...originalMetadata, ...(uncertain ? { deliveryState: "unknown" } : {}),
        ...(evidence ? { sendEvidence: evidence, conversationId: evidence.conversationId } : {}),
      }) } : {}),
    });
    throw error;
  }
  const acceptedAt = new Date();
  const receipt = isMs365SendEvidence(result) ? result : null;
  const receiptTime = receipt ? Date.parse(receipt.sentAt) : NaN;
  const sentAt = Number.isFinite(receiptTime) && receiptTime > 0 &&
    receiptTime <= acceptedAt.getTime() + 60_000 ? new Date(receiptTime) : acceptedAt;
  const conversationId = result && typeof result === "object" && "conversationId" in result
    ? result.conversationId : undefined;
  const metadata = { ...originalMetadata,
    ...(typeof conversationId === "string" || conversationId === null ? { conversationId } : {}),
    sendEvidence: receipt ?? { acceptedAt: acceptedAt.toISOString(), sentAt: sentAt.toISOString(),
      sentAtSource: "transport_accepted_at" },
  };
  const patch = { status: "sent", sentAt, metadata: JSON.stringify(metadata),
    ...(receipt?.externalId ? { externalId: receipt.externalId } : {}) };
  // Retrying this idempotent DB update is safe; retrying transport is not.
  for (let attempt = 0; ; attempt++) {
    try { await store.updateCommunicationMessage(record.id, patch); break; }
    catch {
      if (attempt === 2) {
        const error = new Error("email_accepted_evidence_save_failed");
        Object.assign(error, { deliveryUncertain: true, deliveryAccepted: true });
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  return { messageId: record.id, result };
}
