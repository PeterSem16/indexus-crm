export type MissedCallMatch = {
  entityType: "customer" | "hospital" | "clinic" | "collaborator";
  id: string;
  name?: string;
  phone?: string;
  subtype?: string;
};

export type MissedCallCardResolution =
  | { kind: "match"; match: MissedCallMatch }
  | { kind: "ambiguous"; matches: MissedCallMatch[] }
  | { kind: "none" };

export type InboundSelectionContext = {
  callId?: string;
  campaignId?: string;
  campaignName?: string;
  callerNumber?: string;
};

/**
 * Historical missed-call selections open a card only. They must not inherit
 * the live inbound task context used by an accepted call.
 */
export function getInboundSelectionContext(
  missedCallId: string | undefined,
  liveContext: InboundSelectionContext,
): InboundSelectionContext | undefined {
  return missedCallId ? undefined : liveContext;
}

/**
 * Resolve the identity to use when opening a missed call. A persisted customer
 * identity is authoritative; phone lookup is only safe when it yields one
 * entity, since a number can belong to several entity types.
 */
export function resolveMissedCallCardTarget(
  customerId: string | number | null | undefined,
  phone: string,
  matches: MissedCallMatch[],
): MissedCallCardResolution {
  if (customerId !== null && customerId !== undefined && String(customerId).length > 0) {
    return {
      kind: "match",
      match: { entityType: "customer", id: String(customerId), name: "", phone },
    };
  }
  if (matches.length === 1) return { kind: "match", match: matches[0] };
  if (matches.length > 1) return { kind: "ambiguous", matches };
  return { kind: "none" };
}