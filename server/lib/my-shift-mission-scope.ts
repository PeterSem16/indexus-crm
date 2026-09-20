export function activityBelongsToMission(
  details: string | null | undefined,
  campaignId: string,
): boolean {
  if (!details || !campaignId) return false;
  try {
    const parsed = JSON.parse(details);
    return parsed?.campaignId === campaignId;
  } catch {
    return false;
  }
}