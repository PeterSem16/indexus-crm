import { normalizeCallBrowsePhone } from "./call-browse-phone";

export type CallRecordingEntityType = "customer" | "clinic" | "hospital" | "collaborator";

export interface CallRecordingEntity {
  id: string;
  type: CallRecordingEntityType;
  name: string | null;
}

export interface CallRecordingCampaignContact {
  id: string;
  campaignId: string;
  contactType: string | null;
  customerId: string | null;
  clinicId: string | null;
  hospitalId: string | null;
  collaboratorId: string | null;
}

export interface CallRecordingResolvedCustomer {
  customerId: string | null;
  customerName: string | null;
  entityType: CallRecordingEntityType | null;
}

const CONTACT_TYPE_TO_ENTITY: Record<string, CallRecordingEntityType> = {
  customer: "customer",
  clinic: "clinic",
  hospital: "hospital",
  collaborator: "collaborator",
};

const CONTACT_FIELD_BY_TYPE: Record<CallRecordingEntityType, keyof CallRecordingCampaignContact> = {
  customer: "customerId",
  clinic: "clinicId",
  hospital: "hospitalId",
  collaborator: "collaboratorId",
};

/**
 * Resolve a recording label only from the call-log identity and its exact,
 * campaign-consistent contact link. A multipart display name is never needed
 * here; ambiguous or contradictory polymorphic IDs intentionally resolve null.
 */
export function resolveCallRecordingCustomer(input: {
  callLogCustomerId: string | null;
  callLogCampaignId: string | null;
  callLogCampaignContactId: string | null;
  campaignContact?: CallRecordingCampaignContact | null;
  entities: readonly CallRecordingEntity[];
}): CallRecordingResolvedCustomer {
  const { callLogCustomerId, callLogCampaignId, callLogCampaignContactId } = input;
  const contact = input.campaignContact;
  const contactIsExact = !!contact &&
    !!callLogCampaignContactId &&
    contact.id === callLogCampaignContactId &&
    (!callLogCampaignId || contact.campaignId === callLogCampaignId);

  let targetId = callLogCustomerId;
  let targetType: CallRecordingEntityType | null = null;

  if (contactIsExact && contact) {
    const linkedEntities = (Object.entries(CONTACT_FIELD_BY_TYPE) as Array<
      [CallRecordingEntityType, keyof CallRecordingCampaignContact]
    >).flatMap(([type, field]) => {
      const id = contact[field];
      return typeof id === "string" && id ? [{ type, id }] : [];
    });
    if (callLogCustomerId) {
      const exactLinks = linkedEntities.filter(link => link.id === callLogCustomerId);
      if (exactLinks.length !== 1) return { customerId: null, customerName: null, entityType: null };
      targetType = exactLinks[0].type;
      targetId = exactLinks[0].id;
    } else {
      const declaredType = CONTACT_TYPE_TO_ENTITY[(contact.contactType || "").toLowerCase()];
      const declaredField = declaredType ? CONTACT_FIELD_BY_TYPE[declaredType] : null;
      const declaredId = declaredField ? contact[declaredField] : null;
      if (declaredType && typeof declaredId === "string" && declaredId) {
        targetType = declaredType;
        targetId = declaredId;
      } else if (linkedEntities.length === 1) {
        targetType = linkedEntities[0].type;
        targetId = linkedEntities[0].id;
      } else {
        return { customerId: null, customerName: null, entityType: null };
      }
    }
  }

  if (!targetId) return { customerId: null, customerName: null, entityType: null };

  const matches = input.entities.filter(entity => entity.id === targetId);
  const typedMatches = targetType
    ? matches.filter(entity => entity.type === targetType)
    : matches;
  if (typedMatches.length !== 1) {
    return { customerId: null, customerName: null, entityType: null };
  }

  return {
    customerId: typedMatches[0].id,
    customerName: typedMatches[0].name?.trim() || null,
    entityType: typedMatches[0].type,
  };
}

/**
 * Compare caller-provided and call-log phones only when both can be normalized
 * with the same trusted country context. Unknown local numbers are not rejected.
 */
export function callRecordingPhoneMatches(
  callLogPhone: string | null | undefined,
  submittedPhone: string | null | undefined,
  countryCode?: string | null,
): boolean {
  if (!callLogPhone || !submittedPhone) return true;
  const authoritative = normalizeCallBrowsePhone(callLogPhone, countryCode);
  const submitted = normalizeCallBrowsePhone(submittedPhone, countryCode);
  return !authoritative || !submitted || authoritative === submitted;
}

export function callRecordingUploadConflict(
  existingRecordingId: string | null | undefined,
): boolean {
  return !!existingRecordingId;
}