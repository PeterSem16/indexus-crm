/** Seven approved synthetic cases, not a new full-corpus regression. */
import assert from "node:assert/strict";
import { executeB12 } from "./b12-test";
import { emailMonitoringSchema } from "../../server/lib/ai/email-monitoring-contract";
import { createTestTable, verifyPersistence } from "./persistence";

export const B112_CASES = Object.freeze([
  { id: "B112-01", input: "Žiadam o ukončenie našej existujúcej zmluvy k najbližšiemu možnému dátumu.",
    expected: { wantsToCancel: true, alertLevel: "critical" } },
  { id: "B112-02", input: "Súhlasím s navrhnutým termínom stretnutia v utorok o 10:00.",
    expected: { wantsConsent: true, wantsToCancel: false, alertLevel: "none" } },
  { id: "B112-03", input: "Reklamujem nesprávne vyúčtovanie. Za rovnakú službu ste mi účtovali poplatok dvakrát. Prosím o opravu.",
    expected: { wantsToCancel: false, alertLevel: "critical" } },
  { id: "B112-04", input: "Zvažujem výpoveď našej zmluvy, ale zatiaľ som sa nerozhodol. Toto nie je pokyn na ukončenie služby.",
    expected: { wantsToCancel: false, wantsConsent: false, alertLevel: "warning" } },
  { id: "B112-05", input: "Vašu novú ponuku odmietam, nevyhovuje mi. Existujúcu službu si ponechávam a neruším ju.",
    expected: { wantsToCancel: false, wantsConsent: false, doesNotAcceptContract: true, alertLevel: "warning" } },
  { id: "B112-06", input: "Odvolávam svoj predchádzajúci súhlas s termínom stretnutia. Nový termín zatiaľ nepotvrdzujem.",
    expected: { wantsConsent: false, wantsToCancel: false, alertLevel: "none" } },
  { id: "B112-07", input: "Aký je postup podania výpovede zmluvy? Zatiaľ žiadnu výpoveď nepodávam, chcem len informácie.",
    expected: { wantsToCancel: false, wantsConsent: false, alertLevel: "none" } },
] as const);

export async function executeB112(options: Omit<Parameters<typeof executeB12>[0],
  "pilotCase" | "requestTimeoutMs" | "beforeInference"> & {
    database: Parameters<typeof createTestTable>[0];
    save: (report: any) => void;
    completeSeven?: boolean;
  }) {
  const report: any = { phase: "B1.12", verdict: "NOT_READY", complete: false, rows: [],
    inferenceAttempts: 0, productionRoutingWrites: 0, crmRecordWrites: 0,
    notifications: 0, persistence: "NOT_VERIFIED", error: null,
    noteReview: "REQUIRED", signedInUI: "NOT_VERIFIED",
    productionActivation: "NOT_PERFORMED", startedAtUtc: new Date().toISOString() };
  let transaction = false;
  try {
    options.claimOnce();
    await options.database.query("BEGIN");
    transaction = true;
    await createTestTable(options.database);
    for (const row of B112_CASES) {
      const item: any = { ...row, state: "STARTED" };
      report.rows.push(item);
      options.save(report);
      const execution = await executeB12({ ...options, claimOnce() {},
        requestTimeoutMs: 120_000,
        pilotCase: { ...row, phase: "B1.12" },
        beforeInference() { report.inferenceAttempts++; item.state = "INFERENCE_STARTED"; options.save(report); },
      });
      item.execution = execution;
      item.state = "COMPLETED";
      // The final authorized run completes all seven on classification mismatch,
      // but still stops on transport/schema/configuration failure. Never retry.
      if (execution.verdict !== "PASS" && !(options.completeSeven &&
          execution.error === "B12_SEMANTIC_MISMATCH" &&
          execution.production?.unchangedDuringCheck &&
          execution.production?.beforeMatchesOriginal && execution.production?.afterMatchesOriginal))
        throw Error("B112_INTEGRATION_CASE_FAILED");
      // Keep raw JSON and the application result distinct. No aliases/repair.
      assert.deepEqual(emailMonitoringSchema.parse(execution.modelJson), execution.result);
      item.rawMatchesParser = true;
      item.persistence = await verifyPersistence(options.database, row.id, execution.result);
      if (options.completeSeven) item.additionalChecks = row.id === "B112-06"
        ? [{ field: "doesNotAcceptContract", expected: false,
            actual: execution.result.doesNotAcceptContract,
            pass: execution.result.doesNotAcceptContract === false }]
        : [];
      options.save(report);
    }
    report.persistence = "SEVEN_TEMP_TABLE_ROUNDTRIPS_VERIFIED";
    report.complete = true;
    // Language and actual signed-in CRM UI are separate acceptance gates.
    report.verdict = report.rows.some((item: any) => item.execution.verdict !== "PASS" ||
      item.additionalChecks?.some((check: any) => !check.pass)) ? "NOT_READY" : "REVIEW_REQUIRED";
    if (report.verdict === "NOT_READY") report.error = "B112_CLASSIFICATION_FAILED";
  } catch (error: any) {
    report.error = /^B(?:112|12|11)_[A-Z0-9_]+$/.test(error?.message || "")
      ? error.message : "B112_VERIFICATION_FAILED";
  } finally {
    if (transaction) {
      try { await options.database.query("ROLLBACK"); }
      catch { report.error = "B112_TEST_TRANSACTION_CLEANUP_UNVERIFIED"; report.verdict = "NOT_READY"; }
    }
    report.finishedAtUtc = new Date().toISOString();
    options.save(report);
  }
  return report;
}
