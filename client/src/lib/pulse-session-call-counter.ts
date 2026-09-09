export type PulseCallCountTracker = {
  wasConnected: boolean;
  counted: boolean;
};

export const EMPTY_PULSE_CALL_COUNT_TRACKER: PulseCallCountTracker = {
  wasConnected: false,
  counted: false,
};

export function advancePulseCallCountTracker(
  tracker: PulseCallCountTracker,
  previousState: string,
  currentState: string,
): { tracker: PulseCallCountTracker; increment: boolean } {
  let next = tracker;
  const startsCall = ["connecting", "ringing", "active", "on_hold"].includes(currentState)
    && (previousState === "idle" || previousState === "ended");
  if (startsCall) next = { wasConnected: false, counted: false };
  if (currentState === "active" || currentState === "on_hold") {
    next = { ...next, wasConnected: true };
  }

  const increment = (currentState === "ended" || currentState === "idle")
    && next.wasConnected
    && !next.counted;
  if (increment) next = { ...next, counted: true };
  if (currentState === "idle") next = { ...next, wasConnected: false };

  return { tracker: next, increment };
}