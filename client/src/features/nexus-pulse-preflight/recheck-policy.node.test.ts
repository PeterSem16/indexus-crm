import assert from "node:assert/strict";
import { normalizeAudioDeviceSnapshot as snapshot } from "./diagnostics";
import { hasMeaningfulAudioDeviceChange as changed, networkTransport } from "./recheck-policy";

const headset = [
  { kind: "audioinput" as const, deviceId: "mic", groupId: "usb", label: "Headset microphone" },
  { kind: "audiooutput" as const, deviceId: "speaker", groupId: "usb", label: "Headset speaker" },
  { kind: "audiooutput" as const, deviceId: "default", groupId: "usb", label: "Headset speaker" },
  { kind: "audiooutput" as const, deviceId: "desk", groupId: "desk", label: "Desk speaker" },
];
const baseline = snapshot(headset);
assert.equal(changed(baseline, snapshot([...headset].reverse())), false);
assert.equal(changed(baseline, snapshot(headset.map(device => ({ ...device, label: "Renamed device" })))), false);
assert.equal(changed(baseline, snapshot(headset.map(device => ({ ...device, label: "", groupId: "" })))), false);
assert.equal(changed(baseline, snapshot(headset.map(device => ({ ...device, groupId: device.groupId + "-session" })))), false);
assert.equal(changed(baseline, snapshot(headset.map(device => ({ ...device, deviceId: "", groupId: "", label: "" })))), false);
assert.equal(changed(baseline, null), false);
assert.equal(changed(baseline, snapshot(headset.filter(device => device.deviceId !== "mic"))), true);
assert.equal(changed(baseline, snapshot(headset.map(device => device.deviceId === "mic" ? { ...device, deviceId: "new-mic" } : device))), true);
assert.equal(changed(baseline, snapshot(headset.map(device => device.deviceId === "default" ? { ...device, groupId: "desk", label: "Desk speaker" } : device))), true);
assert.equal(changed(baseline, snapshot([])), true);
const defaultBefore = snapshot([{ kind: "audiooutput", deviceId: "default", groupId: "usb", label: "Headset" }]);
const defaultAfter = snapshot([{ kind: "audiooutput", deviceId: "default", groupId: "desk", label: "Desk" }]);
assert.equal(changed(defaultBefore, defaultAfter), true);
assert.equal(networkTransport(undefined), null);
assert.equal(networkTransport("4g"), null);
assert.equal(networkTransport("unknown"), null);
assert.equal(networkTransport("wifi"), "wifi");
assert.equal(networkTransport("ethernet"), "ethernet");
console.log("Pulse recheck policy: stable/hidden metadata, real devices/default output and physical transport checks passed.");
