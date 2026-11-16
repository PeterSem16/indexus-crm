/** Read-only selection of the actual B1.4 evidence. Never rerun a baseline or guess the latest one. */
import fs from "node:fs";
import path from "node:path";
import { validateB15Baselines } from "./b15-pilot";

export function findB14Baseline(root: string, uid: number, b13: any, source: any) {
  return findVerifiedBaseline(root, uid, { phase: "B1.4", directoryPrefix: "B14", errorPrefix: "B15_B14",
    validate(report) {
      const validated = validateB15Baselines(b13, report, source);
      return { ...validated, sha256: validated.previous.sha256 };
    } });
}
export function findVerifiedBaseline<T extends { sha256: string }>(root: string, uid: number, definition: {
  phase: string; directoryPrefix: string; errorPrefix: string; validate: (report: any) => T;
}) {
  const fail = (suffix: string): never => { throw Error(definition.errorPrefix + "_" + suffix); };
  const safe = (file: string, directory: boolean) => {
    const st = fs.lstatSync(file);
    if (st.isSymbolicLink() || st.uid !== uid || (st.mode & 0o077) ||
      (directory ? !st.isDirectory() : !st.isFile() || st.size > 2 * 1024 * 1024))
      fail("BASELINE_UNSAFE");
  };
  if (!fs.existsSync(root)) fail("BASELINE_NOT_FOUND");
  safe(root, true);
  const pattern = new RegExp("^" + definition.directoryPrefix + "-run-[A-Za-z0-9]+$");
  const names = fs.readdirSync(root).filter(n => pattern.test(n));
  if (names.length > 200) fail("TOO_MANY_REPORTS");
  const reports = new Map<string, { file: string; report: any; validated: T }>();
  for (const name of names.sort()) {
    const dir = path.join(root, name), file = path.join(dir, "evidence.json");
    safe(dir, true);
    if (!fs.existsSync(file)) continue;
    safe(file, false);
    let report;
    try { report = JSON.parse(fs.readFileSync(file, "utf8")); }
    catch { fail("BASELINE_JSON_INVALID"); }
    if (report.phase !== definition.phase) fail("BASELINE_PHASE_INVALID");
    if (report.complete !== true) continue;
    const validated = definition.validate(report);
    reports.set(validated.sha256, { file, report, validated });
  }
  if (!reports.size) fail("BASELINE_NOT_FOUND");
  if (reports.size !== 1) fail("BASELINE_AMBIGUOUS");
  return [...reports.values()][0];
}
