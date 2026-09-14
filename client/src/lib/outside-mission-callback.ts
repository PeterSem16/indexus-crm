export interface OutsideMissionCallbackDialInput {
  phone: string | null | undefined;
  customerId?: string | number | null;
  customerName?: string | null;
}

export interface OutsideMissionCallbackDialMetadata {
  phoneNumber: string;
  customerId?: string;
  customerName?: string;
  campaignId?: undefined;
  campaignContactId?: undefined;
  campaignName?: undefined;
  isOutsideMission: true;
}

/**
 * Build the identity used when an inbound callback is called outside a
 * Mission.  In particular, do not let the currently selected Mission leak
 * into the deferred SIP call metadata.
 */
export function buildOutsideMissionCallbackDialMetadata(
  input: OutsideMissionCallbackDialInput,
): OutsideMissionCallbackDialMetadata | null {
  const phoneNumber = String(input.phone || "").trim();
  if (!phoneNumber) return null;

  const customerId = input.customerId == null || String(input.customerId).trim() === ""
    ? undefined
    : String(input.customerId);
  const customerName = input.customerName?.trim() || undefined;

  return {
    phoneNumber,
    customerId,
    customerName,
    campaignId: undefined,
    campaignContactId: undefined,
    campaignName: undefined,
    isOutsideMission: true,
  };
}