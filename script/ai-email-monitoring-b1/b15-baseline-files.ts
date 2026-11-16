/** Read-only selection of the actual B1.4 evidence. Never rerun a baseline or guess the latest one. */
import fs from "node:fs";
import path from "node:path";
import { validateB15Baselines } from "./b15-pilot";

export function findB14Baseline(root: string, uid: number, b13: any, source: any) {
  const safe = (file: string, directory: boolean) => {
    const st = fs.lstatSync(file);
    if (st.isSymbolicLink() || st.uid !== uid || (st.mode & 0o077) ||
      (directory ? !st.isDirectory() : !st.isFile() || st.size > 2 * 1024 * 1024))
      throw Error("B15_B14_BASELINE_UNSAFE");
  };
  if (!fs.existsSync(root)) throw Error("B15_B14_BASELINE_NOT_FOUND");
  safe(root, true);
  const names = fs.readdirSync(root).filter(n => /^B14-run-[A-Za-z0-9]+$/.test(n));
  if (names.length > 200) throw Error("B15_TOO_MANY_B14_REPORTS");
  const reports = new Map<string, { file: string; report: any; validated: ReturnType<typeof validateB15Baselines> }>();
  for (const name of names.sort()) {
    const dir = path.join(root, name), file = path.join(dir, "evidence.json");
    safe(dir, true);
    if (!fs.existsSync(file)) continue;
    safe(file, false);
    let report;
    try { report = JSON.parse(fs.readFileSync(file, "utf8")); }
    catch { throw Error("B15_B14_BASELINE_JSON_INVALID"); }
    if (report.phase !== "B1.4") throw Error("B15_B14_BASELINE_PHASE_INVALID");
    if (report.complete !== true) continue;
    const validated = validateB15Baselines(b13, report, source);
    reports.set(validated.previous.sha256, { file, report, validated });
  }
  if (!reports.size) throw Error("B15_B14_BASELINE_NOT_FOUND");
  if (reports.size !== 1) throw Error("B15_B14_BASELINE_AMBIGUOUS");
  return [...reports.values()][0];
}
