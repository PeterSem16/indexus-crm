export interface InboundDidSources {
  channelVariable?: string | null;
  stasisArgument?: string | null;
  dialplanExtension?: string | null;
}

export interface QueueDidRoute {
  didNumber: string;
  targetQueueId: string | null;
  name: string | null;
  isActive: boolean;
}

export function normalizeInboundDid(value: string | null | undefined): string {
  if (!value) return "";

  let candidate = value.trim();
  if (!candidate) return "";

  candidate = candidate.replace(/^sip:/i, "").split("@")[0];
  const cleaned = candidate.replace(/[^\d+]/g, "");
  if (!cleaned) return "";
  if (cleaned.startsWith("+")) return cleaned.slice(1);
  if (cleaned.startsWith("00")) return cleaned.slice(2);
  return cleaned;
}

export function resolveInboundDid(sources: InboundDidSources): string {
  for (const source of [
    sources.channelVariable,
    sources.stasisArgument,
    sources.dialplanExtension,
  ]) {
    const normalized = normalizeInboundDid(source);
    if (normalized) return normalized;
  }
  return "";
}

export function inboundDidCandidates(value: string | null | undefined): string[] {
  const normalized = normalizeInboundDid(value);
  if (!normalized) return [];

  const candidates = new Set<string>([normalized]);
  if (normalized.length >= 7) {
    candidates.add(`+${normalized}`);
    candidates.add(`00${normalized}`);
  }
  return [...candidates];
}

export function groupActiveQueueDids<T extends QueueDidRoute>(routes: T[]): Map<string, T[]> {
  const didsByQueue = new Map<string, T[]>();
  for (const route of routes) {
    if (!route.isActive || !route.targetQueueId) continue;
    const existing = didsByQueue.get(route.targetQueueId) || [];
    existing.push(route);
    didsByQueue.set(route.targetQueueId, existing);
  }
  return didsByQueue;
}

export function extractSipIdentityNumber(value: string | null | undefined): string {
  if (!value) return "";
  const sipMatch = value.match(/sips?:\s*([+]?\d+)/i);
  if (sipMatch?.[1]) return sipMatch[1];
  const phoneMatch = value.match(/([+]?\d[\d\s().-]{5,}\d)/);
  return phoneMatch?.[1]?.replace(/[^\d+]/g, "") || "";
}

export function resolveInboundCallerNumber(sources: {
  assertedIdentity?: string | null;
  preferredIdentity?: string | null;
  remotePartyId?: string | null;
  preservedCaller?: string | null;
  channelCaller?: string | null;
}): string {
  for (const source of [
    sources.assertedIdentity,
    sources.preferredIdentity,
    sources.remotePartyId,
    sources.preservedCaller,
    sources.channelCaller,
  ]) {
    const extracted = extractSipIdentityNumber(source);
    if (extracted) return extracted;
  }
  return "unknown";
}