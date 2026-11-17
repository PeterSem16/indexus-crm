import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { and, eq, sql } from "drizzle-orm";
import { communicationMessages, clinics, hospitals, collaborators } from "../../shared/schema";
import { createEmailMonitoringRecorder, monitoringSnapshot, readMonitoringSnapshot } from "./email-monitoring-record";
const analysis = { sentiment: "neutral" as const, hasInappropriateContent: false, hasAngryTone: false,
  hasRudeExpressions: false, wantsToCancel: false, wantsConsent: false, doesNotAcceptContract: false,
  alertLevel: "none" as const, note: "Informačná správa bez požiadavky na zmenu služby." };
function harness(existing: boolean, failSave = false) {
  const counts = { inference: 0, save: 0, crmWrites: 0 };
  let snapshot: unknown = null;
  const recorder = createEmailMonitoringRecorder({
    read: async s => readMonitoringSnapshot(snapshot, s),
    save: async (s, a) => { counts.save++; if (failSave && counts.save === 1) throw Error("SYNTHETIC_OUTAGE");
      snapshot = monitoringSnapshot(s, a); return { detail: readMonitoringSnapshot(snapshot, s)!, created: true }; },
  });
  const context: any = { and, eq, sql, communicationMessages, clinics, hospitals, collaborators,
    processedEmailsMap: {}, emailMonitoringRecorder: recorder,
    analyzeEmailContent: async () => { counts.inference++; return analysis; },
    console: { log() {}, error() {} },
    storage: { findCustomersByEmail: async () => [], updateUserMs365Connection: async () => {
      throw Error("UNEXPECTED_TOKEN_WRITE"); } },
    db: { select: () => ({ from: (table: any) => ({ where: () => ({ limit: async () =>
      table === communicationMessages && existing ? [{ id: "SYNTHETIC-UNLINKED-CRM-ROW" }] : [] }) }) }) },
    storeInboundEmailOnce: async () => { counts.crmWrites++; throw Error("NO_CRM_CONTACT"); },
    require: (name: string) => {
      if (name === "./token-crypto") return { decryptTokenSafe: () => "SYNTHETIC" };
      if (name === "./ms365") return {
        getValidAccessToken: async () => ({ accessToken: "SYNTHETIC" }),
        getRecentEmails: async () => [{ id: "SYNTHETIC-MESSAGE", subject: "Synthetic", bodyPreview: "Synthetic email content.",
          from: { emailAddress: { address: "sender@example.test" } }, body: { contentType: "text", content: "Synthetic email content." } }],
      };
      throw Error("UNEXPECTED_DEPENDENCY");
    },
  };
  const source = fs.readFileSync("server/lib/email-monitoring-service.ts", "utf8");
  const start = source.indexOf("async function checkUserEmails("), end = source.indexOf("// Helper: same link-to-contact", start);
  assert.ok(start > 0 && end > start);
  vm.runInNewContext(ts.transpile(source.slice(start, end) + "\nglobalThis.check = checkUserEmails;",
    { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }), context);
  return { counts, context, saved: () => snapshot,
    poll: () => context.check("SYNTHETIC-OWNER", { email: "agent@example.test", accessToken: "SYNTHETIC" }) };
}
for (const existing of [false, true]) test(`real personal poll persists with ${existing ? "an existing unlinked row" : "no CRM contact"}`, async () => {
  const h = harness(existing); await h.poll(); await h.poll();
  assert.equal(h.counts.inference, 1); assert.equal(h.counts.save, 1);
  assert.equal(h.counts.crmWrites, 0);
  assert.equal((h.saved() as any).analysis.note, analysis.note);
  assert.equal(Object.keys(h.context.processedEmailsMap).length, 1);
});
test("real personal poll does not mark a failed save as processed or call the model again on retry", async () => {
  const h = harness(true, true); await h.poll();
  assert.equal(Object.keys(h.context.processedEmailsMap).length, 0);
  await h.poll();
  assert.equal(h.counts.inference, 1); assert.equal(h.counts.save, 2);
  assert.equal(Object.keys(h.context.processedEmailsMap).length, 1);
});
