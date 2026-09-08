export type AudioRtpHealth =
  | "healthy"
  | "no-flow"
  | "inbound-only"
  | "outbound-only";

export interface AudioRtpStats {
  inboundPackets: number;
  outboundPackets: number;
  inboundBytes: number;
  outboundBytes: number;
}

export function audioRtpDelta(
  previous: AudioRtpStats,
  current: AudioRtpStats,
): AudioRtpStats {
  return {
    inboundPackets: Math.max(0, current.inboundPackets - previous.inboundPackets),
    outboundPackets: Math.max(0, current.outboundPackets - previous.outboundPackets),
    inboundBytes: Math.max(0, current.inboundBytes - previous.inboundBytes),
    outboundBytes: Math.max(0, current.outboundBytes - previous.outboundBytes),
  };
}

/**
 * Classifies the media direction independently from SIP signaling.
 *
 * A call can be SIP-established while one of these directions is missing,
 * which is why this must use WebRTC RTP counters rather than session state.
 */
export function classifyAudioRtpStats(stats: AudioRtpStats): AudioRtpHealth {
  const hasInbound = stats.inboundPackets > 0 && stats.inboundBytes > 0;
  const hasOutbound = stats.outboundPackets > 0 && stats.outboundBytes > 0;

  if (hasInbound && hasOutbound) return "healthy";
  if (hasInbound) return "inbound-only";
  if (hasOutbound) return "outbound-only";
  return "no-flow";
}