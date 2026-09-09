import assert from "node:assert/strict";
import { isInterruptedUnhold } from "./sip-hold";

const session = (isHeld: boolean, desiredHeld: boolean | undefined) => ({
  __isHeld: isHeld,
  __desiredHeld: desiredHeld,
}) as any;

assert.equal(isInterruptedUnhold(session(false, false)), false, "an active call must use media recovery, not MOH recovery");
assert.equal(isInterruptedUnhold(session(true, true)), false, "an intentional hold must stay held");
assert.equal(isInterruptedUnhold(session(true, undefined)), false, "an unknown hold intent must not auto-unhold");
assert.equal(isInterruptedUnhold(session(true, false)), true, "only an interrupted unhold may run hold recovery");

console.log("SIP hold recovery intent tests passed");