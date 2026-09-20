import { PulseOriginalRedesign } from "./PulseOriginalRedesign";
import "./pulse-dark-variant.css";

/**
 * Pulse Dark is a visual variant of the original priority builder.
 * The source component remains the owner of every queue, ordering, and
 * persistence interaction; this shell only supplies the alternate art
 * direction.
 */
export function PulseDarkVariant() {
  return (
    <div className="pulse-dark-variant">
      <PulseOriginalRedesign showSearchCount />
    </div>
  );
}

export default PulseDarkVariant;