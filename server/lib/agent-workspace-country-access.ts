export interface AgentWorkspaceCountryAccessInput {
  role: string | null | undefined;
  workspaceCountryCodes: readonly string[];
  campaignCountryCodes: readonly string[] | null | undefined;
}

/**
 * Mirrors the workspace campaign filter exactly. Workspace assignments are
 * authoritative; users.assignedCountries is deliberately not consulted here.
 * Admins, agents with no workspace rows, and campaigns with no country scope
 * retain the existing unrestricted behavior.
 */
export function canAgentReadCampaignByWorkspaceCountry({
  role,
  workspaceCountryCodes,
  campaignCountryCodes,
}: AgentWorkspaceCountryAccessInput): boolean {
  if (role === "admin") return true;
  if (workspaceCountryCodes.length === 0) return true;
  if (!campaignCountryCodes || campaignCountryCodes.length === 0) return true;
  return campaignCountryCodes.some(countryCode => workspaceCountryCodes.includes(countryCode));
}