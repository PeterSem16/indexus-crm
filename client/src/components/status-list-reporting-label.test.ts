import assert from "node:assert/strict";
import test from "node:test";
import { statusListReportingLabel } from "./status-list-reporting-label";

test("canonical reporting labels are translated and never expose the machine key", () => {
  assert.equal(statusListReportingLabel("acquisition_contacted", "en"), "First contact made");
  assert.equal(statusListReportingLabel("acquisition_contacted", "sk-SK"), "Oslovená (prvý kontakt)");
  assert.equal(statusListReportingLabel("contract_signed", "de"), "Vertrag unterzeichnet");
  assert.equal(statusListReportingLabel("retention_active", "it"), "Cooperazione attiva");
});

test("unknown canonical keys stay readable without changing their stored association", () => {
  assert.equal(statusListReportingLabel("new_status_key", "en"), "New Status Key");
});
