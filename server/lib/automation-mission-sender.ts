/** Resolve new sender modes using persisted Mission policy and the event actor.
 * Existing personal (= rule author) and system actions are deliberately unchanged.
 */
type SenderDeps = {
  campaign: (id: string) => Promise<any>;
  user: (id: string) => Promise<any>;
  session: (id: string) => Promise<any>;
  sharedMailboxes: (id: string) => Promise<any[]>;
};

export async function resolveAutomationMissionSender(config: any, context: any, deps: SenderDeps) {
  if (!["agent", "mission"].includes(config.senderMode)) return { config, sharedMailboxEmail: undefined };
  const campaignId = context.statusList?.campaignId || context.event?.newValues?.campaignId ||
    context.newValues?.campaignId || context.event?.oldValues?.campaignId || context.oldValues?.campaignId;
  if (typeof campaignId !== "string" || !campaignId)
    throw new Error("Configured sender requires a verified Mission");
  const campaign = await deps.campaign(campaignId);
  if (!campaign) throw new Error("Configured sender Mission was not found");
  const countries = typeof campaign.countryCodes === "string" ? campaign.countryCodes.split(",") : campaign.countryCodes || [];
  const country = context.event?.countryCode;
  if (!country || (countries.length && !countries.includes(country)))
    throw new Error("Configured sender country does not match the Mission");
  let settings = campaign.settings || {};
  if (typeof settings === "string") {
    try { settings = JSON.parse(settings); }
    catch { throw new Error("Configured Mission communication settings are invalid"); }
  }
  const mode = config.senderMode === "agent" ? "user" : settings.nexusPulseEmailMode || "user";
  if (!["system", "user", "custom"].includes(mode))
    throw new Error("Configured Mission email mode is invalid");
  if (mode === "system") return { config: { ...config, senderMode: "system" }, sharedMailboxEmail: undefined };

  // Never substitute the rule author, selected browser user, or an arbitrary logged-in agent.
  const actorId = context.event?.actorUserId || context.actorUserId;
  if (typeof actorId !== "string" || !actorId)
    throw new Error("Configured sender requires the agent who triggered the event");
  const [actor, session] = await Promise.all([deps.user(actorId), deps.session(actorId)]);
  if (!actor?.isActive || !session || session.endedAt ||
      ![...(session.campaignIds || []), session.campaignId].includes(campaignId))
    throw new Error("Configured sender requires an active agent shift in this Mission");

  let sharedMailboxEmail: string | undefined;
  if (mode === "custom") {
    const email = String(settings.nexusPulseEmailAddress || "").trim().toLowerCase();
    if (!/^[^@\s<>,;{}]+@[^@\s<>,;{}]+\.[^@\s<>,;{}]+$/.test(email))
      throw new Error("Configured Mission shared mailbox is missing or invalid");
    const mailboxes = await deps.sharedMailboxes(actorId);
    if (!mailboxes.some(mailbox => mailbox.isActive && mailbox.email?.trim().toLowerCase() === email))
      throw new Error("Configured Mission shared mailbox is not available to the triggering agent");
    sharedMailboxEmail = email;
  }
  return {
    // Keep the resolved actor separate from all client-configurable identities.
    config: { ...config, senderMode: "agent", includeSystemSignature: false },
    sharedMailboxEmail,
  };
}
