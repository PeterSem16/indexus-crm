export type PhoneEntityMatch = {
  entityType: string;
  id: string;
};

export type RememberedPhoneCard = {
  entityType: string;
  entityId: string;
  lastSelectedAt?: string;
};

/**
 * A remembered card is advisory only. It can be used when, and only when,
 * the current lookup still returns that same entity for the calling number.
 */
export function getRememberedPhoneCard<T extends PhoneEntityMatch>(
  matches: T[],
  preference: RememberedPhoneCard | null | undefined,
): T | undefined {
  if (!preference) return undefined;
  return matches.find(
    (match) =>
      match.entityType === preference.entityType &&
      String(match.id) === String(preference.entityId),
  );
}

export function orderPhoneMatchesWithRememberedCard<T extends PhoneEntityMatch>(
  matches: T[],
  remembered: T | undefined,
): T[] {
  if (!remembered) return matches;
  return [
    remembered,
    ...matches.filter(
      (match) =>
        match.entityType !== remembered.entityType ||
        String(match.id) !== String(remembered.id),
    ),
  ];
}