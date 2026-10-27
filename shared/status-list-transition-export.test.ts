import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import {
  compareTransitionExports, transitionExportPayload, verifyTransitionExport, canonicalTransitionJson,
  type TransitionExport,
} from "./status-list-transition-export";

if (!globalThis.crypto) Object.defineProperty(globalThis, "crypto", { value: webcrypto });
const campaignId = "a65e7775-885c-4413-b2be-e63c92decd3d";
const recordId = "7a72d71b-33b3-4d08-a394-602e9f71dc0d";
const now = Date.parse("2026-10-20T12:00:00.000Z");
function seal(value: TransitionExport) {
  value.fingerprint = createHash("sha256").update(transitionExportPayload(value)).digest("hex");
  return value;
}
export function fixture(): TransitionExport {
  return seal({
    format: "indexus-transition-inventory-v1", campaignId, capturedAt: new Date(now).toISOString(),
    source: { instance: "a".repeat(64), commit: "b".repeat(40), runtime: "production", productionIdentityVerified: false },
    records: [{ kind: "campaign", id: campaignId, digest: "c".repeat(64) }, { kind: "item", id: recordId, digest: "d".repeat(64) }],
    dependencies: [
      { owner: campaignId, kind: "schema", target: null, state: "present", digest: "e".repeat(64) },
      { owner: campaignId, kind: "executor", target: null, state: "unknown", digest: null },
    ],
    unknowns: ["source_identity"], activationAllowed: false, fingerprint: "0".repeat(64),
  });
}
const value = fixture();
assert.deepEqual(await verifyTransitionExport(value), value);
assert.equal(canonicalTransitionJson({ b: 1, a: { d: 3, c: 2 } }), canonicalTransitionJson({ a: { c: 2, d: 3 }, b: 1 }));
await assert.rejects(() => verifyTransitionExport({ ...value, fingerprint: "0".repeat(64) }), /integrity/);
await assert.rejects(() => verifyTransitionExport({ ...value, activationAllowed: true }));
await assert.rejects(() => verifyTransitionExport({ ...value, recipients: ["private@example.test"] }));
const duplicate = structuredClone(value);
duplicate.records.push(duplicate.records[0]);
await assert.rejects(() => verifyTransitionExport(seal(duplicate)));
const incomplete = structuredClone(value);
incomplete.dependencies = [];
await assert.rejects(() => verifyTransitionExport(seal(incomplete)));
await assert.rejects(() => verifyTransitionExport({ ...value, source: { ...value.source, productionIdentityVerified: true } }));
const unchanged = compareTransitionExports(value, value, now);
assert.deepEqual(unchanged.changes, []);
assert.equal(unchanged.approvalValid, false);
assert.equal(unchanged.activationAllowed, false);
assert.ok(unchanged.blockers.includes("unknown"));
assert.ok(unchanged.blockers.includes("dependencies"));
assert.ok(compareTransitionExports(value, null, now).blockers.includes("baseline_missing"));
assert.ok(compareTransitionExports(value, value, now + 900001).blockers.includes("stale"));
assert.ok(compareTransitionExports(value, value, now - 60001).blockers.includes("clock"));
const next = structuredClone(value);
next.records[1].digest = "f".repeat(64);
next.records.push({ kind: "automation", id: "2d2cdb47-78e2-4110-bb7f-2004ef0dacfc", digest: "f".repeat(64) });
next.dependencies[1].state = "missing";
const changed = compareTransitionExports(next, value, now);
assert.ok(changed.blockers.includes("configuration_changed"));
assert.ok(changed.changes.some(row => row.kind === "item" && row.change === "changed"));
assert.ok(changed.changes.some(row => row.kind === "automation" && row.change === "added"));
assert.ok(changed.changes.some(row => row.kind === "dependency:executor" && row.change === "changed"));
assert.ok(compareTransitionExports(value, next, now).changes.some(row => row.change === "removed"));
next.source.instance = "f".repeat(64);
assert.ok(compareTransitionExports(next, value, now).blockers.includes("source_changed"));
next.campaignId = "7a72d71b-33b3-4d08-a394-602e9f71dc0d";
assert.ok(compareTransitionExports(next, value, now).blockers.includes("campaign_changed"));
next.capturedAt = new Date(now - 1).toISOString();
assert.ok(compareTransitionExports(next, value, now).blockers.includes("out_of_order"));
console.log("Transition export integrity, strict redaction, dependency diff, freshness, provenance and fail-closed checks passed.");
