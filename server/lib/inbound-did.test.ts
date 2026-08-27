import assert from "node:assert/strict";
import {
  groupActiveQueueDids,
  inboundDidCandidates,
  normalizeInboundDid,
  resolveInboundDid,
} from "./inbound-did";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`  ✗ ${name}`);
    console.log(`    ${(error as Error).message}`);
  }
}

console.log("Inbound DID routing");

test("prefers CBC_DID over a Gosub dialplan extension", () => {
  assert.equal(resolveInboundDid({
    channelVariable: "421940682394",
    stasisArgument: null,
    dialplanExtension: "s",
  }), "421940682394");
});

test("uses the explicit Stasis DID when CBC_DID is unavailable", () => {
  assert.equal(resolveInboundDid({
    channelVariable: null,
    stasisArgument: "+421 940 682 394",
    dialplanExtension: "s",
  }), "421940682394");
});

test("falls back to the original dialplan extension for legacy trunks", () => {
  assert.equal(resolveInboundDid({
    channelVariable: null,
    stasisArgument: null,
    dialplanExtension: "0232399030",
  }), "0232399030");
});

test("normalizes SIP and international DID formats", () => {
  assert.equal(normalizeInboundDid("sip:+421940682394@sipt1.ims.o2bs.sk"), "421940682394");
  assert.equal(normalizeInboundDid("00421940682394"), "421940682394");
});

test("matches stored DID variants without changing local numbers", () => {
  assert.deepEqual(inboundDidCandidates("+421940682394"), [
    "421940682394",
    "+421940682394",
    "00421940682394",
  ]);
  assert.deepEqual(inboundDidCandidates("0232399030"), [
    "0232399030",
    "+0232399030",
    "000232399030",
  ]);
});

test("keeps multiple active DIDs on one agent queue", () => {
  const grouped = groupActiveQueueDids([
    { didNumber: "0232399030", targetQueueId: "queue-1", name: "Legacy DID", isActive: true },
    { didNumber: "421940682394", targetQueueId: "queue-1", name: "O2 DID", isActive: true },
    { didNumber: "421000000000", targetQueueId: "queue-1", name: "Disabled", isActive: false },
    { didNumber: "421111111111", targetQueueId: null, name: "Unassigned", isActive: true },
  ]);

  assert.deepEqual(grouped.get("queue-1")?.map(route => route.didNumber), [
    "0232399030",
    "421940682394",
  ]);
  assert.equal(grouped.size, 1);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);