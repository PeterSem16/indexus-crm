import { test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { emptyFunnelConfig, funnelSources, type MissionFunnelReport } from "../../../../shared/mission-funnel";
import { computeMissionFunnel } from "../../../../server/lib/mission-funnel";
import { computeMissionAgentFunnel } from "../../../../server/lib/mission-agent-funnel";
import { missionFunnelTranslations } from "../../i18n/mission-funnel-translations";
import { agentFunnelTranslations } from "./mission-agent-funnel-translations";
import { makeAgentFunnelExport } from "./mission-agent-funnel-export";
import { buildFunnelExport, funnelExportCsv, funnelExportXlsx } from "./mission-funnel-export";
import { funnelExportTranslations } from "../../i18n/mission-funnel-export-translations";
import { exportCellText } from "./mission-export-value";

function fixture(): MissionFunnelReport {
  const config = emptyFunnelConfig();
  for (const source of funnelSources) config.sources[source] = [source];
  const computed = computeMissionFunnel({
    config, items: [], clinics: [{ id: "clinic", name: "=CLINIC()", representativeId: "rep", referred: true }],
    enrollments: [{ id: "enroll", clinicId: "clinic" }], states: [],
    calls: [{ id: "call", actorId: "first", clinicId: "clinic", contactId: "enroll", direction: "outbound",
      status: "completed", at: "2026-09-01T10:00:00Z", answeredAt: "2026-09-01T10:00:01Z", duration: 30 }],
    events: ["agreed", "proposalAccepted", "validated"].map((itemId, index) => ({
      id: itemId, contactId: "enroll", itemId, confirmed: true, at: `2026-09-0${index + 2}T10:00:00Z`, actorId: "closer",
    })),
  });
  return { ...computed, missionName: "Test Mission", canConfigure: false,
    agentComparison: computeMissionAgentFunnel(computed.rows, [{ id: "first", name: "+FIRST" }, { id: "closer", name: "Closer" }]) };
}
const filters = { from: "2026-09-01", to: "2026-09-01", referral: "yes" as const };

test("agent comparison translations have complete matching keys and localized manual paragraphs", () => {
  const keys = Object.keys(agentFunnelTranslations.en).sort();
  for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"] as const) {
    const copy = agentFunnelTranslations[locale];
    assert.deepEqual(Object.keys(copy).sort(), keys, locale);
    assert.ok(Object.values(copy).every(value => typeof value === "string" ? value.trim().length > 0 : Array.isArray(value)), locale);
    assert.ok(copy.helpParagraphs.length >= 6, locale);
    assert.ok(copy.helpParagraphs.every(value => value.length > 60), locale);
    if (locale !== "en") for (let index = 0; index < copy.helpParagraphs.length; index++) {
      assert.notEqual(copy.helpParagraphs[index], agentFunnelTranslations.en.helpParagraphs[index], `${locale}.${index}`);
    }
  }
});

test("agent export preserves counts, direct/inferred split, exact proof authors and selected cohort filters", () => {
  const report = fixture();
  const copy = missionFunnelTranslations.en, labels = agentFunnelTranslations.en;
  const tables = makeAgentFunnelExport(report, "cohort", filters, copy, labels);
  assert.equal(tables.length, 17);
  const cooperative = tables[0].rows.find(row => row[0] === "+FIRST" && row[2] === copy.stepLabels.cooperating)!;
  assert.equal(cooperative[3], 1);
  assert.equal(cooperative[4], 1);
  assert.equal(cooperative[5], 0);
  assert.equal(cooperative[9], 100);
  const proof = tables[1].rows.find(row => row[1] === copy.stepLabels.cooperating)!;
  assert.equal(proof[0], "+FIRST");
  assert.equal(proof[6], "Closer");
  const inferredProof = tables[1].rows.find(row => row[1] === copy.stepLabels.email)!;
  assert.equal(inferredProof[3], "");
  assert.equal(inferredProof[6], labels.unknownProofAuthor);
  assert.ok(tables[2].rows.some(row => row[0] === labels.from && exportCellText(row[1]) === "01.09.2026"));
  assert.ok(tables[2].rows.some(row => row[0] === labels.timezone && row[1] === "Europe/Bratislava"));
  assert.equal(tables[1].rows.some(row => row[1] === copy.stepLabels.assigned), false);
});

test("contribution export does not imply previous-step or qualification conversion", () => {
  const labels = agentFunnelTranslations.en, copy = missionFunnelTranslations.en;
  const tables = makeAgentFunnelExport(fixture(), "contribution", filters, copy, labels);
  const proof = tables[0].rows.find(row => row[0] === "Closer" && row[2] === copy.stepLabels.cooperating)!;
  assert.deepEqual(proof.slice(6), [labels.unmeasured, labels.unmeasured, 100, labels.unmeasured]);
});

test("CSV escapes spreadsheet formulas and XLSX keeps text as text, with no active formulas", async () => {
  const tables = makeAgentFunnelExport(fixture(), "cohort", filters, missionFunnelTranslations.en, agentFunnelTranslations.en);
  const csv = funnelExportCsv(tables);
  assert.ok(csv.includes("'+FIRST"));
  assert.ok(csv.includes("'=CLINIC()"));
  const workbook = XLSX.read(await funnelExportXlsx(tables), { type: "array" });
  assert.equal(workbook.SheetNames.length, 17);
  for (const sheet of Object.values(workbook.Sheets)) for (const [address, cell] of Object.entries(sheet)) {
    if (address.startsWith("!")) continue;
    assert.equal(cell.f, undefined);
  }
  const evidence = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[1]], { header: 1 }) as unknown[][];
  assert.ok(evidence.some(row => row.includes("=CLINIC()")));
  assert.ok(evidence.every(row => !row.includes("clinic") && !row.includes(agentFunnelTranslations.en.clinicId)));
});
test("individual steps and agents are explicit, including unknown; names never fall back to IDs", () => {
  const report = fixture(), copy = missionFunnelTranslations.en, labels = agentFunnelTranslations.en;
  const tables = makeAgentFunnelExport(report, "contribution", filters, copy, labels, { step: "cooperating", agentId: "closer" });
  assert.equal(tables.length, 3);
  assert.equal(tables[0].rows.filter(row => row.length === 10).length, 2);
  assert.equal(tables[1].rows.length, 2);
  assert.equal(tables[1].rows[1][0], "Closer");
  assert.equal(tables[1].rows[1][1], copy.stepLabels.cooperating);
  assert.equal(makeAgentFunnelExport(report, "cohort", filters, copy, labels, { step: "cooperating", agentId: null })[1].rows.length, 1);
  const nameless = structuredClone(report);
  for (const mode of ["cohort", "contribution"] as const) for (const agent of nameless.agentComparison![mode]) agent.agentName = null;
  const text = funnelExportCsv(makeAgentFunnelExport(nameless, "cohort", filters, copy, labels));
  assert.ok(!text.includes('"first"') && !text.includes('"closer"') && !text.includes('"clinic"'));
});
test("complete Mission workbook includes both agent performance views and true proof authors", () => {
  const tables = buildFunnelExport(fixture(), missionFunnelTranslations.en, funnelExportTranslations.en, filters);
  assert.equal(tables.length, 26);
  const text = funnelExportCsv(tables);
  assert.ok(text.includes(agentFunnelTranslations.en.cohortLabel));
  assert.ok(text.includes(agentFunnelTranslations.en.contributionLabel));
  assert.ok(text.includes("Closer"));
  assert.ok(!text.includes('"clinic"'));
});
