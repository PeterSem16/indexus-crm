import { test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { emptyFunnelConfig, funnelSteps, funnelExceptions, type MissionFunnelReport } from "../../../../shared/mission-funnel";
import { missionFunnelTranslations } from "../../i18n/mission-funnel-translations";
import { funnelExportTranslations } from "../../i18n/mission-funnel-export-translations";
import { buildFunnelExport, funnelExportCsv, funnelExportXlsx, funnelExportFilename } from "./mission-funnel-export";

const members = Array.from({ length: 13 }, (_, index) => ({
  id: `clinic-${index}`, name: index === 0 ? '=HYPERLINK("unsafe")' : `Klinika Číslo ${index}`,
  firstDate: "2026-09-02", evidenceDate: "2026-09-03T12:00:00Z", inferred: index === 1,
  basis: "history" as const, returnDate: null,
}));
const report: MissionFunnelReport = {
  version: "v04", generatedAt: "2026-10-30T12:00:00Z", timezone: "Europe/Bratislava",
  missionName: "Test Mission", canConfigure: false, config: emptyFunnelConfig(), items: [],
  rows: funnelSteps.map((key, index) => ({ key, total: index === 0 ? 13 : null, direct: index === 0 ? 12 : null,
    inferred: index === 0 ? 1 : null, previousPercent: null, qualifiedPercent: null, members: index === 0 ? members : [] })),
  exceptions: funnelExceptions.map((key, index) => ({ key, measurable: index !== 0, members: index === 1 ? [members[1]] : [] })),
  quality: { clinics: 13, cohort: 13, withoutAttempt: 0, provisional: 0, orphanCalls: 0, duplicateEnrollments: 0, stateOnly: 0, unknownProposal: 0 },
};
const copy = missionFunnelTranslations.sk, labels = funnelExportTranslations.sk;
const filters = { from: "2026-09-01", to: "2026-09-30", referral: "yes" as const };
const tables = buildFunnelExport(report, copy, labels, filters);

test("exports all steps and all evidence, not only the first UI page; unmapped is never zero", () => {
  assert.equal(tables.length, 5);
  assert.equal(tables[1].rows.length, funnelSteps.length + 1);
  assert.equal(tables[2].rows.length, 14);
  assert.equal(tables[1].rows[1][1], 13);
  assert.equal(tables[1].rows[2][1], copy.unmeasured);
  assert.ok(tables[0].rows.some(row => row[1] === filters.from));
  assert.ok(tables[0].rows.some(row => row[1] === copy.referralYes));
  assert.ok(tables[4].rows.some(row => row[0] === copy.noPeriodAssigned));
});
test("CSV keeps UTF-8, quoting and formula defenses while retaining numeric values", () => {
  const csv = funnelExportCsv(tables);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes("Klinika Číslo 12"));
  assert.ok(csv.includes(`"'=HYPERLINK(""unsafe"")"`));
  assert.ok(csv.includes("\r\n"));
  const hostile = funnelExportCsv([{ name: "Test", rows: [[" \t+SUM(1)", "-text", "@formula", "a;\"b\nc", -2]] }]);
  assert.ok(hostile.includes(`"' \t+SUM(1)"`));
  assert.ok(hostile.includes(`"a;""b\nc"`));
  assert.ok(hostile.includes(`;"-2"`));
});
test("Excel is a real readable five-sheet workbook with numeric counts and non-executable text cells", async () => {
  const bytes = await funnelExportXlsx(tables);
  const workbook = XLSX.read(bytes, { type: "array" });
  assert.equal(workbook.SheetNames.length, 5);
  assert.equal(new Set(workbook.SheetNames).size, 5);
  const summary = workbook.Sheets[workbook.SheetNames[1]];
  assert.equal(summary.B2.v, 13);
  assert.equal(summary.B2.t, "n");
  assert.equal(summary.B3.v, copy.unmeasured);
  const evidence = workbook.Sheets[workbook.SheetNames[2]];
  assert.equal(evidence.C2.v, members[0].name);
  assert.equal(evidence.C2.t, "s");
  assert.equal(evidence.C2.f, undefined);
  assert.equal(evidence.C14.v, members[12].name);
});
test("safe filenames preserve selected scope and export labels exist in every language", () => {
  assert.equal(funnelExportFilename("../mission", filters), "mission-funnel____mission_2026-09-01_2026-09-30_yes");
  for (const copy of Object.values(funnelExportTranslations)) {
    assert.deepEqual(Object.keys(copy), Object.keys(labels));
    assert.ok(Object.values(copy).every(text => text.trim()));
  }
});
