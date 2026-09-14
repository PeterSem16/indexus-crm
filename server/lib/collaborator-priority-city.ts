import { normalizeCityLocation, type NormalizedCityLocation } from "@shared/priority-city";

export interface CollaboratorPriorityAddress {
  id: string;
  collaboratorId: string;
  addressType: string;
  city: string | null;
  countryCode: string | null;
  createdAt: Date | string | number | null;
}

const ADDRESS_TYPE_PRIORITY: Record<string, number> = {
  permanent: 0,
  work: 1,
  correspondence: 2,
  company: 3,
};

function timestamp(value: CollaboratorPriorityAddress["createdAt"]): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
  }
  return Number.MAX_SAFE_INTEGER;
}

/**
 * Address types are the only collaborator location source.  Permanent wins
 * over work/correspondence/company; ties are stable by creation time and id
 * instead of depending on database row order.
 */
export function selectPrimaryCollaboratorAddress(
  addresses: ReadonlyArray<CollaboratorPriorityAddress>,
): CollaboratorPriorityAddress | null {
  if (addresses.length === 0) return null;
  return [...addresses].sort((left, right) => {
    const typeDelta = (ADDRESS_TYPE_PRIORITY[left.addressType] ?? 4)
      - (ADDRESS_TYPE_PRIORITY[right.addressType] ?? 4);
    if (typeDelta !== 0) return typeDelta;
    const createdDelta = timestamp(left.createdAt) - timestamp(right.createdAt);
    if (createdDelta !== 0) return createdDelta;
    return left.id.localeCompare(right.id);
  })[0] || null;
}

export function normalizeCollaboratorPriorityCity(
  addresses: ReadonlyArray<CollaboratorPriorityAddress>,
): NormalizedCityLocation | null {
  const address = selectPrimaryCollaboratorAddress(addresses);
  return address ? normalizeCityLocation(address.countryCode, address.city) : null;
}