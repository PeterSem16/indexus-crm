"use strict";
// Browser-only execution. Generator/import never accesses a mailbox or calls AI.
async function runThreeLiveSummaries() {
  if (window.__indexusThreeLiveSummariesStarted) throw Error("TEST_ALREADY_STARTED_DO_NOT_REPEAT");
  window.__indexusThreeLiveSummariesStarted = true;
  const run = window.indexusThreeLiveSummaries = {
    startedAt: new Date().toISOString(), status: "preflight", planned: 3, results: [], current: null,
    sourceEvidence: "Existing mailbox list API; worker independently reloads Graph by emailId. Not a wire capture.",
  };
  const fail = code => { throw Error(code); };
  const get = async url => {
    const r = await fetch(url, { credentials: "same-origin", cache: "no-store" });
    if (r.status !== 200) fail("READ_HTTP_" + r.status);
    return r.json();
  };
  const plain = text => String(text || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 5000);
  const source = email => ({
    emailSubject: email.subject || "",
    emailBody: plain(email.body?.content || email.bodyPreview),
    emailFrom: email.from?.emailAddress?.name || email.from?.emailAddress?.address || "",
  });
  let baseline, mailbox, language, base;
  const check = async () => {
    const c = await get("/api/configurator/ai"), m = await get("/api/configurator/ai/maintenance");
    const route = c.services?.find(s => s.id === "email.summary")?.route;
    run.observedRoute = route || null;
    if (c.runtime?.mode !== "routed" || !c.runtime.production || c.runtime.replit ||
        !c.runtime.serverAllowed || !c.gateway?.enabled || c.queue?.ready !== true)
      fail("PRODUCTION_INTERNAL_QUEUE_NOT_READY");
    if (!route?.enabled || route.provider !== "internal" || !route.model)
      fail("EMAIL_SUMMARY_NOT_INTERNAL_NO_SETTINGS_CHANGED");
    if (m.mode !== "running" || !Number.isSafeInteger(m.version) || !(m.workers?.alive > 0) ||
        m.workers.unsupported !== 0 || m.workers.confirmed !== m.workers.alive)
      fail("MAINTENANCE_OR_WORKER_NOT_READY");
    if (!Number.isSafeInteger(c.version)) fail("INVALID_CONFIGURATION");
    const snapshot = JSON.stringify({ version: c.version, gateway: c.gateway, services: c.services,
      maintenanceVersion: m.version });
    if (baseline && baseline !== snapshot) fail("CONFIGURATION_OR_MAINTENANCE_CHANGED");
    baseline = snapshot; run.configurationVersion = c.version; run.maintenanceVersion = m.version;
  };
  const history = async emailId => {
    const h = await get("/api/ai/jobs?" + new URLSearchParams({
      service: "email.summary", entityId: emailId, mailbox, locale: language, limit: "50",
    }));
    if (!Array.isArray(h.jobs)) fail("INVALID_JOB_HISTORY");
    return h.jobs;
  };
  try {
    const { user } = await get("/api/auth/me");
    if (!user?.id) fail("LOGIN_REQUIRED");
    base = "/api/users/" + encodeURIComponent(user.id);
    await check();
    const boxes = await get(base + "/ms365-available-mailboxes");
    if (!Array.isArray(boxes) || !boxes.length || boxes.some(b => typeof b.email !== "string" || !b.email))
      fail("NO_CONNECTED_MAILBOX");
    console.table(boxes.map((b, i) => ({ number: i + 1, mailbox: b.email, type: b.type })));
    const boxChoice = boxes.length === 1 ? "1" :
      window.prompt("Číslo schránky z tabuľky:", String(Math.max(0, boxes.findIndex(b => b.isDefault)) + 1));
    if (boxChoice === null) fail("CANCELLED_BEFORE_INFERENCE");
    if (!/^\d+$/.test(boxChoice.trim()) || !boxes[Number(boxChoice) - 1]) fail("INVALID_MAILBOX_SELECTION");
    mailbox = boxes[Number(boxChoice) - 1].email.trim().toLowerCase(); run.mailbox = mailbox;
    const chosenLanguage = window.prompt("Jazyk troch zhrnutí: sk, cs, en, hu, ro, it, de", "sk");
    if (chosenLanguage === null) fail("CANCELLED_BEFORE_INFERENCE");
    language = chosenLanguage.trim().toLowerCase();
    if (!["sk", "cs", "en", "hu", "ro", "it", "de"].includes(language)) fail("INVALID_LANGUAGE");
    run.language = language;
    const listUrl = base + "/ms365-recent-emails?" + new URLSearchParams({ mailbox, top: "10" });
    const listing = await get(listUrl);
    if (listing.connected !== true || !Array.isArray(listing.emails)) fail("MAILBOX_NOT_CONNECTED");
    const messages = listing.emails;
    if (messages.length < 3 || messages.some(e => typeof e.id !== "string" || !e.id) ||
        new Set(messages.map(e => e.id)).size !== messages.length) fail("THREE_DISTINCT_MESSAGES_REQUIRED");
    const rows = [];
    for (let i = 0; i < messages.length; i++) rows.push({
      number: i + 1, subject: messages[i].subject, received: messages[i].receivedDateTime,
      fresh: (await history(messages[i].id)).length === 0,
    });
    console.table(rows);
    const defaults = rows.filter(r => r.fresh).slice(0, 3).map(r => r.number);
    if (defaults.length !== 3) fail("NOT_ENOUGH_UNTESTED_MESSAGES_IN_LATEST_TEN");
    const choice = window.prompt("Vyber presne 3 rôzne čísla e-mailov, napr. 1,2,3:", defaults.join(","));
    if (choice === null) fail("CANCELLED_BEFORE_INFERENCE");
    if (!/^\s*\d+\s*,\s*\d+\s*,\s*\d+\s*$/.test(choice)) fail("SELECT_EXACTLY_THREE_MESSAGES");
    const numbers = choice.split(",").map(Number);
    if (new Set(numbers).size !== 3 || numbers.some(n => !rows[n - 1]?.fresh))
      fail("SELECT_THREE_DISTINCT_UNTESTED_MESSAGES");
    const selected = numbers.map(n => messages[n - 1]);
    if (!window.confirm(`Vytvoriť 3 AI zhrnutia skutočných správ zo schránky ${mailbox} v jazyku ${language}?\n` +
        selected.map((e, i) => `${i + 1}. ${e.subject || "(bez predmetu)"}`).join("\n") +
        "\nSpracuje sa obsah týchto správ a uložia sa AI úlohy a výsledky. Pošta sa neodošle.")) fail("CANCELLED_BEFORE_INFERENCE");
    for (const email of selected) if ((await history(email.id)).length) fail("JOB_APPEARED_BEFORE_TEST");
    run.status = "running";
    const seen = new Set();
    for (const email of selected) {
      await check();
      if ((await history(email.id)).length) fail("EXISTING_JOB_NO_AUTOMATIC_RETRY");
      const row = { case: run.results.length + 1, emailId: email.id, source: source(email),
        language, startedAt: new Date().toISOString(), status: "outcome_unknown", jobId: null };
      run.results.push(row); run.current = row;
      // Only saved identity is submitted. Server obtains the actual content from Graph.
      const response = await fetch(base + "/ms365-ai-summary", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId: email.id, mailbox, language }),
      });
      row.admissionHttpStatus = response.status;
      const admitted = await response.json();
      row.jobId = typeof admitted?.jobId === "string" ? admitted.jobId : null;
      if (response.status !== 202) {
        row.errorCode = /^[a-z][a-z0-9_]{0,79}$/.test(admitted?.errorCode || "") ? admitted.errorCode : null;
        fail("EXPECTED_ASYNC_202_NO_AUTOMATIC_RETRY");
      }
      if (!/^[a-f0-9-]{36}$/i.test(row.jobId || "") || seen.has(row.jobId)) fail("INVALID_OR_DUPLICATE_JOB");
      seen.add(row.jobId);
      let job = admitted.job;
      const until = Date.now() + 15 * 60_000;
      for (;;) {
        if (!job || job.id !== row.jobId || job.service !== "email.summary" || job.entityType !== "email" ||
            job.entityId !== email.id || !Number.isInteger(job.attempts) || job.attempts < 0 || job.attempts > 1 ||
            !["pending", "processing", "completed", "failed"].includes(job.status)) fail("UNEXPECTED_JOB");
        row.job = job;
        if (job.status === "failed") { row.status = "failed"; fail("JOB_FAILED_NO_AUTOMATIC_RETRY"); }
        if (job.status === "completed") break;
        if (Date.now() >= until) fail("OBSERVER_TIMEOUT_JOB_NOT_CANCELLED_DO_NOT_REPEAT");
        await new Promise(resolve => setTimeout(resolve, 3000));
        job = (await get("/api/ai/jobs/" + encodeURIComponent(row.jobId))).job;
      }
      if (job.attempts !== 1 || typeof job.result?.summary !== "string" || !job.result.summary.trim())
        fail("MISSING_RESULT_OR_UNEXPECTED_ATTEMPTS");
      row.output = job.result.summary;
      row.gatewayOutputPath = null;
      row.sourceVerifiedAgainstWorkerInput = false;
      row.languageAndMeaningVerified = false;
      row.finishedAt = new Date().toISOString(); row.status = "completed";
      row.seconds = Math.round((Date.parse(row.finishedAt) - Date.parse(row.startedAt)) / 1000);
      run.current = null; console.log(JSON.stringify(row));
    }
    await check();
    run.status = "three_live_summaries_completed_review_pending";
  } catch (e) {
    run.status = "stopped_do_not_repeat"; run.error = e instanceof Error ? e.message : "LIVE_SUMMARY_TEST_FAILED";
    if (run.current) run.current.observerStoppedAt = new Date().toISOString();
    console.error("STOP; DO NOT REPEAT:", run.error);
  } finally {
    run.finishedAt = new Date().toISOString();
    console.table(run.results.map(r => ({ case: r.case, status: r.status, jobId: r.jobId, seconds: r.seconds })));
    console.log("Export obsahuje skutočné texty. Pred zdieľaním anonymizuj osobné údaje.");
    console.log("copy(JSON.stringify(window.indexusThreeLiveSummaries, null, 2))");
  }
  return run;
}
function browserScript() {
  return "(" + runThreeLiveSummaries.toString() +
    ")().catch(e => console.error('STOP; DO NOT REPEAT:', e.message));\n";
}
module.exports = { runThreeLiveSummaries, browserScript };
if (require.main === module) process.stdout.write(browserScript());
