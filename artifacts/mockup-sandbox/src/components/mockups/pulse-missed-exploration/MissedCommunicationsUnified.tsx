import { Unified } from "./Unified";

/**
 * Canonical handoff frame for the approved Missed communications layout.
 *
 * The existing Unified component is the approved, interaction-complete mockup.
 * This named wrapper gives the paired My Shift handoff its own stable preview
 * route without touching the original reference frame.
 */
export function MissedCommunicationsUnified() {
  return <Unified />;
}

export default MissedCommunicationsUnified;