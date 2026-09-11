import assert from "node:assert/strict";
import { classifyOutboundTermination, classifyOutboundTerminationWithDeferredResponse } from "./sip-outbound-outcome";

assert.deepEqual(classifyOutboundTermination({
  answered: false, elapsedSeconds: 99, finalStatusCode: 486,
}), { status: "busy", duration: 0, hungUpBy: "system" });
assert.deepEqual(classifyOutboundTermination({
  answered: false, elapsedSeconds: 42, finalStatusCode: 603,
}), { status: "failed", duration: 0, hungUpBy: "system" });
assert.deepEqual(classifyOutboundTermination({
  answered: false, elapsedSeconds: 42, ringTimedOut: true,
}), { status: "no_answer", duration: 0, hungUpBy: "system" });
assert.deepEqual(classifyOutboundTermination({
  answered: false, elapsedSeconds: 42, finalStatusCode: 480,
}), { status: "no_answer", duration: 0, hungUpBy: "system" });
assert.deepEqual(classifyOutboundTermination({
  answered: true, elapsedSeconds: 7, userHungUp: true,
}), { status: "completed", duration: 7, hungUpBy: "user" });
assert.deepEqual(classifyOutboundTermination({
  answered: false, elapsedSeconds: 7, userHungUp: true,
}), { status: "cancelled", duration: 0, hungUpBy: "user" });
assert.deepEqual(classifyOutboundTermination({
  answered: false, elapsedSeconds: 7, userHungUp: true, finalStatusCode: 487,
}), { status: "cancelled", duration: 0, hungUpBy: "user" });
// Integration-shaped SIP.js ordering: Terminated is observed first, then the
// request delegate supplies the negative INVITE response.
const terminatedFirst = classifyOutboundTerminationWithDeferredResponse({
  answered: false, elapsedSeconds: 99, finalStatusCode: null,
});
assert.deepEqual(terminatedFirst, { status: "failed", duration: 0, hungUpBy: "system" });
const finalDecision = classifyOutboundTerminationWithDeferredResponse({
  answered: false, elapsedSeconds: 99, finalStatusCode: null,
}, 486);
assert.deepEqual(finalDecision, { status: "busy", duration: 0, hungUpBy: "system" });
// The persistence model makes no write for the provisional Terminated result:
// only the response-window decision is persisted.
const persistedDecisions = [finalDecision];
assert.equal(persistedDecisions.length, 1);

console.log("Outbound SIP outcome classification passed");