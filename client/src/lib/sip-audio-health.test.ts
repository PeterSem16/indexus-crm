/**
 * Deterministic RTP health simulation.
 *
 * Run with:
 *   npx tsx client/src/lib/sip-audio-health.test.ts
 */

import assert from "node:assert/strict";
import { audioRtpDelta, classifyAudioRtpStats, type AudioRtpStats } from "./sip-audio-health";

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

const baseline = stats({
  inboundPackets: 100,
  outboundPackets: 120,
  inboundBytes: 16_000,
  outboundBytes: 19_200,
});

assert.equal(
  classifyAudioRtpStats(audioRtpDelta(baseline, stats({
    inboundPackets: 110,
    outboundPackets: 130,
    inboundBytes: 17_600,
    outboundBytes: 20_800,
  }))),
  "healthy",
  "growing counters in both directions are healthy",
);
console.log("  ✓ bidirectional RTP counter growth → healthy");
passed++;

assert.equal(
  classifyAudioRtpStats(audioRtpDelta(baseline, stats({
    ...baseline,
    outboundPackets: 130,
    outboundBytes: 20_800,
  }))),
  "outbound-only",
  "stalled inbound counters must be detected even when cumulative counters are nonzero",
);
console.log("  ✓ stalled inbound RTP counters → outbound-only");
passed++;

assert.deepEqual(
  audioRtpDelta(baseline, stats({
    inboundPackets: 1,
    outboundPackets: 1,
    inboundBytes: 1,
    outboundBytes: 1,
  })),
  stats({}),
  "counter resets after ICE recovery must not create negative deltas",
);
console.log("  ✓ RTP counter reset → zero delta");
passed++;

console.log(`\n${passed} RTP simulations passed`);