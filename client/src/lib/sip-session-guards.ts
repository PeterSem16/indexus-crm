export function isCorrelatedInboundHangup(input: {
  eventCallId: string;
  activeCallId?: string;
  activeDirection?: string;
  activeSession: unknown;
  currentSession: unknown;
  finalizerSession: unknown;
}): boolean {
  return Boolean(
    input.eventCallId &&
    input.activeCallId &&
    input.eventCallId === input.activeCallId &&
    input.activeDirection === "inbound" &&
    input.activeSession &&
    input.activeSession === input.currentSession &&
    input.activeSession === input.finalizerSession
  );
}

export function shouldCancelAfterRingGrace(input: {
  sameSession: boolean;
  sessionState: string;
}): boolean {
  return input.sameSession &&
    input.sessionState !== "Established" &&
    input.sessionState !== "Terminated";
}

export function shouldRecoverOutboundMediaAfterAnswer(input: {
  ringDurationMs: number;
  earlyIceDegraded: boolean;
  postAnswerBidirectionalRtp: boolean;
  sessionState: string;
  isHeld: boolean;
  recoveryAttempted: boolean;
}): boolean {
  if (
    input.sessionState !== "Established" ||
    input.isHeld ||
    input.recoveryAttempted ||
    input.postAnswerBidirectionalRtp
  ) return false;

  return input.earlyIceDegraded || input.ringDurationMs >= 10_000;
}