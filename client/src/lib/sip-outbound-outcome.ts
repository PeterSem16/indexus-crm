export type OutboundTerminationStatus = "completed" | "failed" | "busy" | "no_answer" | "cancelled";

export interface OutboundTerminationInput {
  answered: boolean;
  elapsedSeconds: number;
  ringTimedOut?: boolean;
  userHungUp?: boolean;
  remoteHangup?: boolean;
  mediaInterrupted?: boolean;
  finalStatusCode?: number | null;
}

export interface OutboundTerminationResult {
  status: OutboundTerminationStatus;
  duration: number;
  hungUpBy: "user" | "customer" | "system";
}

/** Models SIP.js' ordering where Terminated can precede requestDelegate.onReject. */
export function classifyOutboundTerminationWithDeferredResponse(
  input: OutboundTerminationInput,
  deferredStatusCode?: number | null,
): OutboundTerminationResult {
  return classifyOutboundTermination({
    ...input,
    finalStatusCode: deferredStatusCode ?? input.finalStatusCode,
  });
}

/** Purely classify the final outcome; in particular, never infer answered from stale timing. */
export function classifyOutboundTermination(input: OutboundTerminationInput): OutboundTerminationResult {
  const code = input.finalStatusCode || 0;
  if (!input.answered) {
    if (input.ringTimedOut) return { status: "no_answer", duration: 0, hungUpBy: "system" };
    if (input.userHungUp) return { status: "cancelled", duration: 0, hungUpBy: "user" };
    if (code === 486 || code === 600) return { status: "busy", duration: 0, hungUpBy: "system" };
    if (code === 408 || code === 480 || code === 487) return { status: "no_answer", duration: 0, hungUpBy: "system" };
    // 4xx/5xx/6xx final responses are rejected attempts, not customer calls.
    return { status: "failed", duration: 0, hungUpBy: "system" };
  }

  const duration = Math.max(0, Math.floor(input.elapsedSeconds));
  return {
    status: "completed",
    duration,
    hungUpBy: input.userHungUp ? "user" : input.remoteHangup ? "customer" : input.mediaInterrupted ? "system" : "customer",
  };
}