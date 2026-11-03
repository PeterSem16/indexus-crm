/** Stable stage IDs; email classification uses names, not milestone mutations. */
export const funnelSteps = [
  "assigned", "dialed", "connected", "qualified", "agreed", "wantsContract",
  "withoutContract", "email", "wantsToSign", "sent", "received", "returned",
  "validated", "cooperating", "packageSent", "materials",
] as const;
export type FunnelStep = typeof funnelSteps[number];
