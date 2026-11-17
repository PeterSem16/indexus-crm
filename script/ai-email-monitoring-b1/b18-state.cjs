"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const fail = code => { throw Error(code); };
function readResume(file, { home, uid, alive = pid => {
  try { process.kill(pid, 0); return true; }
  catch (e) { if (e.code === "ESRCH") return false; throw e; }
} }) {
  if (!fs.existsSync(file)) fail("B18_RESUME_FILE_NOT_FOUND");
  const st = fs.lstatSync(file), real = fs.realpathSync(file);
  if (!st.isFile() || st.isSymbolicLink() || st.uid !== uid || (st.mode & 0o077) ||
    st.size > 8 * 1024 * 1024 || !real.startsWith(fs.realpathSync(home) + path.sep) ||
    path.basename(real) !== "B18_evidence_final.json") fail("B18_RESUME_FILE_UNSAFE");
  const text = fs.readFileSync(real, "utf8");
  let report;
  try { report = JSON.parse(text); } catch { fail("B18_RESUME_JSON_INVALID"); }
  if (!Number.isSafeInteger(report.executionProcess?.pid) || report.executionProcess.pid <= 1)
    fail("B18_RESUME_PROCESS_ID_REQUIRED");
  if (alive(report.executionProcess.pid)) fail("B18_ORIGINAL_PROCESS_STILL_RUNNING");
  if (report.complete === true) fail("B18_RUN_ALREADY_COMPLETE");
  return { file: real, report, sha256: crypto.createHash("sha256").update(text).digest("hex") };
}
function claimRun(marker, resume, uid) {
  if (resume) {
    if (!fs.existsSync(marker)) fail("B18_ORIGINAL_MARKER_REQUIRED");
    const st = fs.lstatSync(marker);
    if (!st.isFile() || st.isSymbolicLink() || st.uid !== uid || (st.mode & 0o077))
      fail("B18_ORIGINAL_MARKER_REQUIRED");
  }
  const target = resume ? marker + "-resume-" + resume.sha256 + ".started" : marker;
  try { fs.writeFileSync(target, new Date().toISOString(), { mode: 0o600, flag: "wx" }); }
  catch (e) { fail(e.code === "EEXIST" ? "B12_RUN_ALREADY_STARTED" : "B12_MARKER_WRITE_FAILED"); }
}
module.exports = { readResume, claimRun };
