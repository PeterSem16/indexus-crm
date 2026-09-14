import type { DiagnosticState } from "./diagnostics";

export type PulsePresentationState = {
  isBeginning: boolean;
  showHeader: boolean;
  showStatusBanner: boolean;
  showDetails: boolean;
  showRetry: boolean;
  showContinue: boolean;
};

/** A small runtime seam used by the dialog and regression tests; it never alters readiness gating. */
export function getPulsePresentationState(state: DiagnosticState, running: boolean, runCompleted: boolean, canContinue: boolean, hasValidReadiness = false): PulsePresentationState {
  const isBeginning = state === "idle" && !running && !runCompleted && !hasValidReadiness;
  return {
    isBeginning,
    showHeader: !isBeginning,
    showStatusBanner: !isBeginning && (running || runCompleted || canContinue),
    showDetails: !isBeginning && (running || runCompleted),
    showRetry: !isBeginning && !running,
    showContinue: !running && canContinue,
  };
}