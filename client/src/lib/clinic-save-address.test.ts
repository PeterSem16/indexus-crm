import assert from "node:assert/strict";
import { clinicSaveAddress } from "./clinic-save-address";

const original = {
  address: "9. mája 438/15, Turčianske Teplice, Turčianske Teplice, ZA, SK",
  street: "9. mája", streetNumber: "438", orientationNumber: "15",
};
assert.equal(clinicSaveAddress({ ...original }, original), original.address);
assert.equal(clinicSaveAddress({ ...original, streetNumber: "439" }, original), "9. mája 439/15");
assert.equal(clinicSaveAddress({ ...original, street: "", streetNumber: "", orientationNumber: "" }, original), null);
assert.equal(clinicSaveAddress({ address: "Legacy free-text address" }, { address: "Legacy free-text address" }), "Legacy free-text address");
assert.equal(clinicSaveAddress({ street: "New street", streetNumber: "4", orientationNumber: "2" }, {}), "New street 4/2");
assert.equal(clinicSaveAddress({ address: "Manually changed free text" }, { address: "Original" }), "Manually changed free text");
console.log("clinic save address: passed");
