/** Mission exception is opt-in; malformed or legacy settings never grant it. */
export function missionAllowsClinicAgreementEditing(value: unknown): boolean {
  try {
    const settings = typeof value === "string" ? JSON.parse(value) : value;
    return settings?.readOnlyContactCards === true &&
      settings?.readOnlyExceptions?.agreements === true;
  } catch {
    return false;
  }
}

export function canEditClinicAgreements(
  serverCanManage: boolean | undefined,
  readOnly: boolean,
  allowReadOnlyEdit: boolean,
): boolean {
  return serverCanManage === true && (!readOnly || allowReadOnlyEdit === true);
}
