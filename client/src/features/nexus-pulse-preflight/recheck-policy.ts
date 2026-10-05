import type { AudioDeviceSnapshot } from "./diagnostics";

export const DEVICE_CHANGE_CONFIRM_MS = 1200;
export const NETWORK_CHANGE_CONFIRM_MS = 1200;

const aliases = new Set(["default", "communications"]);
type AudioDevice = AudioDeviceSnapshot["devices"][number];

function physicalIdentities(devices: AudioDevice[]) {
  return [...new Set(devices.filter(device => !aliases.has(device.deviceId))
    .map(device => `${device.kind}:${device.deviceId}`))].sort();
}

function aliasTarget(alias: AudioDevice, devices: AudioDevice[]) {
  const physical = devices.filter(device => device.kind === alias.kind && !aliases.has(device.deviceId));
  const grouped = alias.groupId ? physical.filter(device => device.groupId === alias.groupId) : [];
  if (grouped.length === 1) return `device:${grouped[0].deviceId}`;
  const labeled = (grouped.length ? grouped : physical).filter(device => alias.label && device.label === alias.label);
  if (labeled.length === 1) return `device:${labeled[0].deviceId}`;
  // Alias-only inventories can still reveal a real default-output switch.
  return alias.groupId ? `group:${alias.groupId}` : null;
}

/** Labels/group IDs may be hidden or revealed when the mic opens/closes.
 * Compare physical IDs, and resolve default aliases to their physical target.
 * Unknown/permission-masked inventories are not evidence of a device change.
 */
export function hasMeaningfulAudioDeviceChange(
  baseline: AudioDeviceSnapshot | null,
  current: AudioDeviceSnapshot | null,
) {
  if (!baseline || !current || baseline.version !== current.version) return false;
  if ([...baseline.devices, ...current.devices].some(device => !device.deviceId)) return false;
  if (JSON.stringify(physicalIdentities(baseline.devices)) !== JSON.stringify(physicalIdentities(current.devices))) return true;
  for (const previous of baseline.devices.filter(device => aliases.has(device.deviceId))) {
    const next = current.devices.find(device => device.kind === previous.kind && device.deviceId === previous.deviceId);
    if (!next) continue;
    const before = aliasTarget(previous, baseline.devices);
    const after = aliasTarget(next, current.devices);
    if (before && after && before !== after) return true;
  }
  return false;
}

/** effectiveType/rtt/downlink describe estimates, not a changed network.
 * Chrome updates them during ordinary API requests. Only a known physical
 * transport switch qualifies; offline and actual media failures are separate.
 */
export function networkTransport(type: unknown): string | null {
  const value = typeof type === "string" ? type.toLowerCase() : "";
  return ["ethernet", "wifi", "cellular", "bluetooth", "wimax"].includes(value) ? value : null;
}
