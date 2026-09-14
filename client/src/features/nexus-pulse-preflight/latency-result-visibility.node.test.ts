import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

test("the actual diagnostic result filter retains latency, jitter, and unavailable results", () => {
  const source = readFileSync(new URL("./PulseDiagnostics.tsx", import.meta.url), "utf8");
  const expression = source.match(/const mainResults = (.*);/)?.[1];
  assert.ok(expression, "Locate the production results filter");
  for (const state of ["pass", "warn", "fail"]) {
    const latency = { key: "latency", state, detail: "Latency: 42 ms · Jitter: 6 ms (4/4)" };
    const visible = runInNewContext(expression, { finalResults: [
      latency, { key: "network" }, { key: "devices" },
    ] });
    assert.equal(visible.length, 1);
    assert.equal(visible[0], latency);
  }
  const unavailable = { key: "latency", state: "warn", detail: "Latency unavailable" };
  assert.equal(runInNewContext(expression, { finalResults: [unavailable] })[0], unavailable);
});