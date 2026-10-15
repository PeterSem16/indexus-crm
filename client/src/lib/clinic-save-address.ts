type ClinicAddress = {
  address?: string | null;
  street?: string | null;
  streetNumber?: string | null;
  orientationNumber?: string | null;
};

/** Verification, linking and unrelated edits must not normalize a saved address. */
export function clinicSaveAddress(draft: ClinicAddress, original: ClinicAddress): string | null {
  const parts = ["street", "streetNumber", "orientationNumber"] as const;
  if (parts.every(key => (draft[key] || "") === (original[key] || ""))) {
    return draft.address || null;
  }
  const number = [draft.streetNumber, draft.orientationNumber].filter(Boolean).join("/");
  return [draft.street, number].filter(Boolean).join(" ").trim() || null;
}
