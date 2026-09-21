export function resolveShiftLoginCampaignIds(selectedCampaignIds: readonly string[]): string[] {
  return Array.from(new Set(selectedCampaignIds));
}