/**
 * Claims one inbound call for the lifetime of the current agent session.
 *
 * A queue notification can be replayed while the browser is accepting its SIP
 * invitation. Once the agent has clicked Accept, that replay must never create
 * a second popup for the same server call id.
 */
export function claimInboundCall(claimedCallIds: Set<string>, callId: string): boolean {
  if (claimedCallIds.has(callId)) return false;
  claimedCallIds.add(callId);
  return true;
}

export function releaseInboundCallClaim(claimedCallIds: Set<string>, callId: string): void {
  claimedCallIds.delete(callId);
}

export function shouldIgnoreInboundCallNotification(claimedCallIds: ReadonlySet<string>, callId: string): boolean {
  return claimedCallIds.has(callId);
}