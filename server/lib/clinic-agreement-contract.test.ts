import assert from "node:assert/strict";
import { test } from "node:test";
import { agreementCreateSchema, agreementPatchSchema, agreementDatesValid, agreementFilename, agreementFileExtension } from "./clinic-agreement-contract";

test("agreement dates are real calendar dates, date-only, bounded and explicit clears work", () => {
  assert.ok(agreementCreateSchema.safeParse({ title: "Agreement", validFrom: "2026-10-04", validTo: "" }).success);
  for (const value of ["2026-02-30", "2026-13-01", "2026-10-04T00:00:00Z", "bad"])
    assert.equal(agreementPatchSchema.safeParse({ validFrom: value }).success, false);
  assert.equal(agreementPatchSchema.parse({ validTo: "" }).validTo, null);
  assert.equal(agreementDatesValid("2026-10-05", "2026-10-04"), false);
  assert.equal(agreementDatesValid(null, "2026-10-04"), true);
  assert.equal(agreementPatchSchema.safeParse({}).success, false);
  assert.equal(agreementPatchSchema.safeParse({ active: "false" }).success, false);
  assert.equal(agreementPatchSchema.safeParse({ storageKey: "../../secret" }).success, false);
});
test("file signatures and controlled extensions prevent spoofed executable public uploads", () => {
  assert.equal(agreementFileExtension("application/pdf", Buffer.from("%PDF-1.4\n")), ".pdf");
  assert.equal(agreementFileExtension("application/pdf", Buffer.from("<html>script</html>")), null);
  assert.equal(agreementFileExtension("image/png", Buffer.from([137,80,78,71,13,10,26,10])), ".png");
  assert.equal(agreementFileExtension("application/msword", Buffer.from([208,207,17,224,161,177,26,225])), ".doc");
  assert.equal(agreementFileExtension("text/html", Buffer.from("%PDF-1.4")), null);
  assert.equal(agreementFilename("../../agreement\r\n.pdf"), "agreement.pdf");
  assert.equal(agreementFilename("C:\\private\\agreement.pdf"), "agreement.pdf");
});