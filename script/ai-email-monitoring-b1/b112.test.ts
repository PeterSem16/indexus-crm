import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { Client } from "pg";
import { B112_CASES, executeB112 } from "./b112-pilot";
import { analyzeSource } from "./source.cjs";
import { snapshot } from "../ai-gateway-b4-pilot.cjs";
import { DEFAULT_AI_SETTINGS } from "../../server/lib/ai/settings-policy";
import { AI_SERVICES } from "../../server/lib/ai/service-catalog";
import { EMAIL_MONITORING_PROFILE as profile } from "../../server/lib/ai/email-monitoring-profile";

const reference = snapshot({ version: 1, value: DEFAULT_AI_SETTINGS }, Object.keys(AI_SERVICES));
const source = analyzeSource(path.resolve("server/lib/email-monitoring-service.ts"));
for (const mode of ["original", "final", "final-mismatch", "final-supplement"] as const)
test(`seven-case ${mode} preserves raw/parser identity and round-trips nine fields through PostgreSQL`, async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 8000 });
  let posts = 0, claimed = 0, saved: any;
  await db.connect();
  try {
    const report = await executeB112({ database: db, source, reference, token: "SYNTHETIC_B112_TOKEN",
      readSnapshot: async () => reference, claimOnce() { claimed++; }, save(r) { saved = r; },
      completeSeven: mode !== "original",
      fetch: async (input) => {
        const url = String(input);
        if (url.endsWith("health/ready")) return new Response(null);
        if (url.endsWith("v1/models")) return Response.json({ object: "list", data: [{ id: profile.model }] });
        if (url.endsWith("indexus/v1/capabilities")) return Response.json({ apiVersion: "1", models: [{
          id: profile.model, revision: "SYNTHETIC", operations: ["chat.completions"], inputModalities: ["text"],
          outputFormats: ["json_object"], streaming: false, maxInputTokens: 8192, maxOutputTokens: 200,
        }] });
        assert.equal(url, "https://ai.cordbloodcenter.com/gateway/v1/chat/completions");
        const row = B112_CASES[posts++];
        const content = { sentiment: "neutral", hasInappropriateContent: false, hasAngryTone: false,
          hasRudeExpressions: false, wantsToCancel: false, wantsConsent: false, doesNotAcceptContract: false,
          alertLevel: "none", note: "Syntetický výsledok, nie výstup živého modelu.", ...row.expected };
        if (mode === "final-mismatch" && row.id === "B112-01") content.alertLevel = "warning";
        if (mode === "final-supplement" && row.id === "B112-06") content.doesNotAcceptContract = true;
        return Response.json({ id: row.id, object: "chat.completion", model: profile.model, choices: [{
          index: 0, finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(content) },
        }] });
      },
    });
    assert.equal(posts, 7); assert.equal(claimed, 1);
    assert.equal(report.complete, true);
    assert.equal(report.inferenceAttempts, 7);
    assert.equal(report.persistence, "SEVEN_TEMP_TABLE_ROUNDTRIPS_VERIFIED");
    assert.equal(report.verdict, mode.startsWith("final-") ? "NOT_READY" : "REVIEW_REQUIRED");
    if (mode.startsWith("final-")) assert.equal(report.error, "B112_CLASSIFICATION_FAILED");
    assert.equal(report.productionActivation, "NOT_PERFORMED");
    assert.equal(saved, report);
    assert.ok(report.rows.every((row: any) => row.rawMatchesParser && row.persistence.nineFieldSnapshot));
    assert.equal((await db.query("SELECT to_regclass('pg_temp.indexus_email_monitoring_b1') AS name")).rows[0].name, null);
  } finally { await db.end(); }
});
test("failed one-shot marker stops before a database write or inference", async () => {
  let queries = 0, fetches = 0;
  const result = await executeB112({ token: "SYNTHETIC", source, reference,
    database: { query: async () => { queries++; } } as any, readSnapshot: async () => reference,
    claimOnce() { throw Error("B112_ALREADY_STARTED"); }, save() {},
    fetch: async () => { fetches++; return new Response(); },
  });
  assert.equal(result.verdict, "NOT_READY"); assert.equal(result.error, "B112_ALREADY_STARTED");
  assert.equal(queries, 0); assert.equal(fetches, 0);
});

for (const invalid of ["semantic", "missing-field"] as const) {
  test(`a ${invalid} failure stops after the first simulated inference and rolls back PostgreSQL`, async () => {
    const db = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 8000 });
    let posts = 0;
    await db.connect();
    try {
      const report = await executeB112({ database: db, source, reference, token: "SYNTHETIC_B112_TOKEN",
        readSnapshot: async () => reference, claimOnce() {}, save() {},
        fetch: async (input) => {
          const url = String(input);
          if (url.endsWith("health/ready")) return new Response(null);
          if (url.endsWith("v1/models")) return Response.json({ object: "list", data: [{ id: profile.model }] });
          if (url.endsWith("indexus/v1/capabilities")) return Response.json({ apiVersion: "1", models: [{
            id: profile.model, revision: "SYNTHETIC", operations: ["chat.completions"], inputModalities: ["text"],
            outputFormats: ["json_object"], streaming: false, maxInputTokens: 8192, maxOutputTokens: 200,
          }] });
          posts++;
          const content: any = { sentiment: "neutral", hasInappropriateContent: false, hasAngryTone: false,
            hasRudeExpressions: false, wantsToCancel: true, wantsConsent: false, doesNotAcceptContract: false,
            alertLevel: invalid === "semantic" ? "warning" : "critical", note: "Syntetická odpoveď." };
          if (invalid === "missing-field") delete content.wantsConsent;
          return Response.json({ id: "SYNTHETIC", object: "chat.completion", model: profile.model, choices: [{
            index: 0, finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(content) },
          }] });
        },
      });
      assert.equal(posts, 1);
      assert.equal(report.inferenceAttempts, 1);
      assert.equal(report.verdict, "NOT_READY");
      assert.equal(report.complete, false);
      assert.equal(report.rows.length, 1);
      assert.equal(report.persistence, "NOT_VERIFIED");
      assert.equal(report.productionActivation, "NOT_PERFORMED");
      assert.equal((await db.query("SELECT to_regclass('pg_temp.indexus_email_monitoring_b1') AS name")).rows[0].name, null);
    } finally { await db.end(); }
  });
}
