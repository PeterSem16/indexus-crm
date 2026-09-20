import { PulseOriginalRedesign } from "./PulseOriginalRedesign";
import "./pulse-midnight-calm-variant.css";

/**
 * A softer midnight treatment of the priority builder.
 * The original builder remains the single owner of ordering, queue, and
 * persistence state; this component only changes the visual frame.
 */
export function PulseMidnightCalmVariant() {
  return (
    <div className="pulse-midnight-calm-variant">
      <PulseOriginalRedesign showSearchCount />
    </div>
  );
}

export default PulseMidnightCalmVariant;