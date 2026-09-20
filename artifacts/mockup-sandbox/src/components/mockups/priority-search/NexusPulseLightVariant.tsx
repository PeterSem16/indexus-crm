import { PulseOriginalRedesign } from "./PulseOriginalRedesign";
import "./nexus-pulse-light-variant.css";

/**
 * Color-only Nexus Pulse treatment for the production Contact ordering UI.
 * Structure and interactive behavior stay owned by the extracted component.
 */
export function NexusPulseLightVariant() {
  return (
    <div className="nexus-pulse-light-variant">
      <PulseOriginalRedesign showSearchCount />
    </div>
  );
}

export default NexusPulseLightVariant;