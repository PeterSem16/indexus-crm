/**
 * Deterministic RTP health simulation.
 *
 * Run with:
 *   npx tsx client/src/lib/sip-audio-health.test.ts
 */

import assert from "node:assert/strict";
import { classifyAudioRtpStats, type AudioRtpStats } from "./sip-audio-health";

const stats = (overrides: Partial<AudioRtpStats>): AudioRtpStats => ({
  inboundPackets: 0,
  outboundPackets: 0,
  inboundBytes: 0,
  outboundBytes: 0,
  ...overrides,
});

const scenarios: Array<[string, AudioRtpStats, string]> = [
  ["zero RTP flow", stats({}), "no-flow"],
  ["one-way browser to Asterisk", stats({ outboundPackets: 80, outboundBytes: 6400 }), "outbound-only"],
  ["one-way Asterisk to browser", stats({ inboundPackets: 80, inboundBytes: 6400 }), "inbound-only"],
  ["healthy bidirectional RTP flow", stats({
    inboundPackets: 80,
    inboundBytes: 6400,
    outboundPackets: 80,
    outboundBytes: 6400,
  }), "healthy"],
];

let passed = 0;
for (const [name, sample, expected] of scenarios) {
  assert.equal(classifyAudioRtpStats(sample), expected, name);
  console.log(`  ✓ ${name} → ${expected}`);
  passed++;
}

// Silence/comfort-noise counters must not be treated as a working audio flow.
assert.equal(
  classifyAudioRtpStats(stats({ inboundPackets: 1, outboundPackets: 1 })),
  "no-flow",
  "packets without bytes are not a valid audio flow",
);
console.log("  ✓ packets without bytes → no-flow");
passed++;

console.log(`\n${passed} RTP simulations passed`);