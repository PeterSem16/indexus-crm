import assert from "node:assert/strict";
import test from "node:test";
import { shouldFinalizeAcwBeforeExplicitDial } from "./pulse-dial-request";

test("explicit dial finalizes an ended call with active ACW", () => {
  assert.equal(shouldFinalizeAcwBeforeExplicitDial("ended", Date.now()), true);
});

test("explicit dial does not finalize a live call", () => {
  for (const state of ["connecting", "ringing", "active", "on_hold"]) {
    assert.equal(shouldFinalizeAcwBeforeExplicitDial(state, Date.now()), false);
  }
});

test("ended call without ACW is not treated as the explicit ACW transition", () => {
  assert.equal(shouldFinalizeAcwBeforeExplicitDial("ended", null), false);
});

test("idle state never triggers ACW finalization", () => {
  assert.equal(shouldFinalizeAcwBeforeExplicitDial("idle", Date.now()), false);
});