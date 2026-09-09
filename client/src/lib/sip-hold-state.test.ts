import assert from "node:assert/strict";
import { endSessionBounded, isHeldCallRecoveryCandidate, recoverHeldSessionMedia, restartSessionMedia, shouldAttemptHeldCallRecovery, unhold } from "./sip-hold";

const session = (isHeld: boolean, desiredHeld: boolean | undefined) => ({
  __isHeld: isHeld,
  __desiredHeld: desiredHeld,
}) as any;

assert.equal(isHeldCallRecoveryCandidate(session(false, false)), false, "an active call must use media recovery, not held-call recovery");
assert.equal(isHeldCallRecoveryCandidate(session(true, true)), true, "a network-interrupted intentional hold must be recoverable");
assert.equal(isHeldCallRecoveryCandidate(session(true, undefined)), false, "an unknown hold intent must not be changed automatically");
assert.equal(isHeldCallRecoveryCandidate(session(true, false)), true, "an interrupted unhold must be recoverable");
assert.equal(shouldAttemptHeldCallRecovery(0, 0, 100), true, "the first held-call recovery attempt is allowed");
assert.equal(shouldAttemptHeldCallRecovery(1, 200, 100), false, "recovery waits for its convergence grace period");
assert.equal(shouldAttemptHeldCallRecovery(2, 0, 100), false, "held-call recovery is bounded");

(globalThis as any).window = globalThis;
const inviteDelegates: any[] = [];
const raceSession: any = {
  state: "Established",
  __isHeld: true,
  __desiredHeld: true,
  __holdIntentVersion: 1,
  sessionDescriptionHandler: {
    peerConnection: {
      restartIce() {},
      getSenders() { return [{ track: { kind: "audio", enabled: false } }]; },
    },
  },
  stateChange: { addListener() {}, removeListener() {} },
  invite(options: any) {
    inviteDelegates.push(options.requestDelegate);
    return Promise.resolve();
  },
};
const heldRecovery = recoverHeldSessionMedia(raceSession);
await new Promise((resolve) => setTimeout(resolve, 0));
const manualUnhold = unhold(raceSession);
assert.equal(raceSession.__desiredHeld, false, "manual unhold records its newer intent synchronously");
inviteDelegates[0].onAccept();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(raceSession.__desiredHeld, false, "completed held recovery must not overwrite manual unhold intent");
inviteDelegates[1].onAccept();
await Promise.all([heldRecovery, manualUnhold]);
assert.equal(raceSession.__isHeld, false, "queued manual unhold completes physically");
assert.equal(raceSession.__desiredHeld, false, "physical and desired hold state remain aligned");

const mutedTrack = { kind: "audio", enabled: false };
const mediaDelegates: any[] = [];
const mutedSession: any = {
  state: "Established",
  __isHeld: false,
  __desiredHeld: false,
  sessionDescriptionHandler: {
    peerConnection: {
      restartIce() {},
      getSenders() { return [{ track: mutedTrack }]; },
    },
  },
  stateChange: { addListener() {}, removeListener() {} },
  invite(options: any) {
    mediaDelegates.push(options.requestDelegate);
    return Promise.resolve();
  },
};
const mutedRecovery = restartSessionMedia(mutedSession);
await new Promise((resolve) => setTimeout(resolve, 0));
mediaDelegates[0].onAccept();
await mutedRecovery;
assert.equal(mutedTrack.enabled, false, "media recovery must preserve explicit microphone mute");

const lateOfferListeners = new Set<(state: string) => void>();
let lateOfferCancelCount = 0;
let lateOfferByeCount = 0;
const acceptedLateOfferSession: any = {
  state: "Establishing",
  _dialog: {},
  stateChange: {
    addListener(listener: (state: string) => void) { lateOfferListeners.add(listener); },
    removeListener(listener: (state: string) => void) { lateOfferListeners.delete(listener); },
  },
  cancel() { lateOfferCancelCount++; },
  bye() { lateOfferByeCount++; },
};
const acceptedLateOfferEnd = endSessionBounded(acceptedLateOfferSession, 5);
await new Promise((resolve) => setTimeout(resolve, 10));
assert.equal(lateOfferCancelCount, 0, "an accepted late-offer dialog must never receive CANCEL");
acceptedLateOfferSession.state = "Established";
lateOfferListeners.forEach((listener) => listener("Established"));
await acceptedLateOfferEnd;
assert.equal(lateOfferCancelCount, 0, "settled accepted dialog still must not receive CANCEL");
assert.equal(lateOfferByeCount, 1, "accepted late-offer hangup sends exactly one BYE after negotiation");

let stalledEstablishedByeCount = 0;
let stalledEstablishedCancelCount = 0;
const stalledEstablishedSession: any = {
  state: "Established",
  _dialog: {},
  __sipOperationQueue: new Promise<void>(() => {}),
  stateChange: { addListener() {}, removeListener() {} },
  cancel() { stalledEstablishedCancelCount++; },
  bye() { stalledEstablishedByeCount++; },
};
await endSessionBounded(stalledEstablishedSession, 5);
assert.equal(stalledEstablishedCancelCount, 0, "an established dialog is never cancelled");
assert.equal(stalledEstablishedByeCount, 1, "emergency termination bypasses a stalled SIP operation with one BYE");
await endSessionBounded(stalledEstablishedSession, 5);
assert.equal(stalledEstablishedByeCount, 1, "repeated termination requests cannot send duplicate BYE");

console.log("SIP hold recovery intent tests passed");