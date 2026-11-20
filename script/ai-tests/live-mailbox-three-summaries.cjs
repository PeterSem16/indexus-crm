"use strict";
// Browser-only execution. Generator/import never accesses a mailbox or calls AI.
async function runThreeLiveSummaries(options = {}) {
  if (window.__indexusThreeLiveSummariesStarted) throw Error("TEST_ALREADY_STARTED_DO_NOT_REPEAT");
  window.__indexusThreeLiveSummariesStarted = true;
  const run = window.indexusThreeLiveSummaries = {
    startedAt: new Date().toISOString(), status: "preflight", planned: 3, results: [], current: null,
    sourceEvidence: "Existing mailbox list API; worker independently reloads Graph by emailId. Not a wire capture.",
    temporaryWindow: options.temporaryWindow === true,
    restoreStatus: options.temporaryWindow === true ? "not_switched" : "not_applicable",
    gatewayDrain: "unverified", backendDrain: "unverified",
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
  const canonical = v => JSON.stringify((function sort(x) {
    return Array.isArray(x) ? x.map(sort) : x && typeof x === "object"
      ? Object.fromEntries(Object.keys(x).sort().map(k => [k, sort(x[k])])) : x;
  })(v));
  const snapshot = c => ({ version: c.version, gateway: c.gateway, services: c.services });
  const summaryRoute = c => c.services?.find(s => s.id === "email.summary")?.route;
  const internalRoute = { provider: "internal", model: "indexus-ai-solaris:v1", enabled: true };
  const unload = event => { event.preventDefault(); event.returnValue = ""; };
  const wait = () => new Promise(resolve => setTimeout(resolve, 3000));
  let baseline, mailbox, language, base, original, owned, lastMaintenance;
  let preparing = run.temporaryWindow, switchAttempted = false, admissionUnknown = false;
  const write = async (path, method, body) => {
    const r = await fetch("/api/configurator/ai/" + path, { method,
      credentials: "same-origin", cache: "no-store",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (r.status !== 200) {
      let detail; try { detail = await r.json(); } catch {}
      run.lastWriteFailure = { endpoint: path, status: r.status,
        code: /^[a-z][a-z0-9_]{0,79}$/.test(detail?.code || "") ? detail.code : null };
      fail("WINDOW_" + path.toUpperCase() + "_HTTP_" + r.status + "_DO_NOT_REPEAT");
    }
    return r.json();
  };
  const idle = m => ["jobs", "inference"].every(queue =>
    ["pending", "processing"].every(status => Number.isSafeInteger(m.queues?.[queue]?.[status]) &&
      m.queues[queue][status] === 0));
  const fresh = c => {
    const s = c.gatewayCheck, age = Date.now() - Date.parse(s?.checkedAt);
    return s?.kind === "smoke" && s.state === "ready" && s.settingsVersion === c.version &&
      s.textVerified && s.jsonVerified && age >= 0 && age < 15 * 60_000 &&
      s.models?.some(m => m.id === internalRoute.model &&
        m.outputFormats?.includes("text") && m.outputFormats?.includes("json_object") &&
        (m.maxOutputTokens == null || m.maxOutputTokens >= 1500));
  };
  const check = async () => {
    const c = await get("/api/configurator/ai"), m = await get("/api/configurator/ai/maintenance");
    const route = c.services?.find(s => s.id === "email.summary")?.route;
    run.observedRoute = route || null;
    if (c.runtime?.mode !== "routed" || !c.runtime.production || c.runtime.replit ||
        !c.runtime.serverAllowed || !c.gateway?.enabled || c.queue?.ready !== true)
      fail("PRODUCTION_INTERNAL_QUEUE_NOT_READY");
    if (preparing) {
      const service = c.services?.find(s => s.id === "email.summary");
      if (canonical(route) !== canonical({ provider: "openai", model: null, enabled: true }) ||
          !service?.internalEligible || !service.models?.includes(internalRoute.model))
        fail("EXPECTED_ORIGINAL_OPENAI_SUMMARY_NO_SETTINGS_CHANGED");
    } else if (!route?.enabled || route.provider !== "internal" || !route.model)
      fail("EMAIL_SUMMARY_NOT_INTERNAL_NO_SETTINGS_CHANGED");
    if (m.mode !== "running" || !Number.isSafeInteger(m.version) || !(m.workers?.alive > 0) ||
        m.workers.unsupported !== 0 || m.workers.confirmed !== m.workers.alive)
      fail("MAINTENANCE_OR_WORKER_NOT_READY");
    if (!Number.isSafeInteger(c.version)) fail("INVALID_CONFIGURATION");
    if (owned && canonical(snapshot(c)) !== canonical(owned)) fail("FOREIGN_CONFIGURATION_CHANGE");
    if (owned && m.version !== run.originalMaintenanceVersion) fail("FOREIGN_MAINTENANCE_CHANGE");
    const fingerprint = canonical({ version: c.version, gateway: c.gateway, services: c.services,
      maintenanceVersion: m.version });
    if (baseline && baseline !== fingerprint) fail("CONFIGURATION_OR_MAINTENANCE_CHANGED");
    baseline = fingerprint; lastMaintenance = m;
    run.configurationVersion = c.version; run.maintenanceVersion = m.version;
    return c;
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
    const listMailbox = boxes[Number(boxChoice) - 1].id === "personal" ? "personal" : mailbox;
    const listUrl = base + "/ms365-recent-emails?" + new URLSearchParams({ mailbox: listMailbox, top: "10" });
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
        "\nSpracuje sa obsah týchto správ a uložia sa AI úlohy a výsledky. Pošta sa neodošle." +
        (run.temporaryWindow ? "\nCelá služba sumarizácie sa dočasne prepne na Solaris a potom vráti na OpenAI. " +
          "Najprv prebehne potrebná kontrola spojenia (text a JSON). Nezatváraj ani neobnovuj stránku." : "")))
      fail("CANCELLED_BEFORE_INFERENCE");
    for (const email of selected) if ((await history(email.id)).length) fail("JOB_APPEARED_BEFORE_TEST");
    if (run.temporaryWindow) {
      const before = await check();
      if (!idle(lastMaintenance)) fail("QUEUE_BUSY_BEFORE_WINDOW_NO_SWITCH");
      original = snapshot(before);
      run.originalRoute = summaryRoute(before);
      run.originalMaintenanceVersion = lastMaintenance.version;
      window.addEventListener("beforeunload", unload);
      if (!fresh(before)) {
        run.status = "checking_gateway"; run.smokeAttempted = true;
        console.log("PHASE=check_gateway");
        const tested = await write("test", "POST", { expectedVersion: before.version, kind: "smoke" });
        run.gatewayCheck = tested.gatewayCheck;
        if (canonical(snapshot(tested)) !== canonical(original) || !fresh(tested))
          fail("FRESH_SMOKE_NOT_VERIFIED_NO_SWITCH");
      }
      const current = await check();
      if (!idle(lastMaintenance) || !fresh(current)) fail("QUEUE_OR_SMOKE_CHANGED_NO_SWITCH");
      const expected = { ...original, version: original.version + 1,
        services: original.services.map(s => s.id === "email.summary" ? { ...s, route: internalRoute } : s) };
      run.status = "switch_outcome_unknown"; run.restoreStatus = "manual_verification_required";
      console.log("PHASE=switch_email_summary_to_solaris");
      switchAttempted = true;
      const switched = await write("route", "PUT", { expectedVersion: original.version,
        service: "email.summary", route: internalRoute, confirmInternal: true });
      if (canonical(snapshot(switched)) !== canonical(expected) ||
          canonical(snapshot(await get("/api/configurator/ai"))) !== canonical(expected))
        fail("SWITCH_READBACK_MISMATCH");
      owned = expected; run.switchedVersion = owned.version; preparing = false; baseline = null;
      await check();
    }
    run.status = "running";
    const seen = new Set();
    for (const email of selected) {
      await check();
      if ((await history(email.id)).length) fail("EXISTING_JOB_NO_AUTOMATIC_RETRY");
      const row = { case: run.results.length + 1, emailId: email.id, source: source(email),
        language, startedAt: new Date().toISOString(), status: "outcome_unknown", jobId: null };
      run.results.push(row); run.current = row;
      console.log("PHASE=summarize_email_" + row.case + "_of_3");
      admissionUnknown = true;
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
        admissionUnknown = false;
        if (job.status === "failed") { row.status = "failed"; fail("JOB_FAILED_NO_AUTOMATIC_RETRY"); }
        if (job.status === "completed") break;
        if (Date.now() >= until) fail("OBSERVER_TIMEOUT_JOB_NOT_CANCELLED_DO_NOT_REPEAT");
        await wait();
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
    if (owned) {
      try {
        console.log("PHASE=verify_jobs_before_restore");
        if (admissionUnknown) fail("UNKNOWN_ADMISSION_NO_AUTOMATIC_RESTORE");
        const ensureOwned = async () => {
          const c = await get("/api/configurator/ai");
          if (canonical(snapshot(c)) !== canonical(owned)) fail("FOREIGN_CONFIGURATION_NO_RESTORE");
          const m = await get("/api/configurator/ai/maintenance");
          if (m.mode !== "running" || m.version !== run.originalMaintenanceVersion)
            fail("MAINTENANCE_CHANGED_NO_RESTORE");
          return { c, m };
        };
        const until = Date.now() + 15 * 60_000;
        for (const row of run.results) {
          if (!row.jobId) fail("UNKNOWN_JOB_NO_AUTOMATIC_RESTORE");
          for (;;) {
            await ensureOwned();
            const j = (await get("/api/ai/jobs/" + encodeURIComponent(row.jobId))).job;
            if (j?.id !== row.jobId || j.service !== "email.summary" || j.entityId !== row.emailId ||
                j.entityType !== "email" || !["pending", "processing", "completed", "failed"].includes(j.status))
              fail("RESTORE_JOB_IDENTITY_MISMATCH");
            row.finalJobStatus = j.status;
            if (["completed", "failed"].includes(j.status)) break;
            if (Date.now() >= until) fail("JOBS_NOT_DRAINED_NO_RESTORE");
            await wait();
          }
        }
        let current;
        for (;;) {
          current = await ensureOwned();
          if (idle(current.m)) break;
          if (Date.now() >= until) fail("QUEUES_NOT_IDLE_NO_RESTORE");
          await wait();
        }
        run.status = "restore_outcome_unknown"; run.restoreAttempted = true;
        console.log("PHASE=restore_email_summary_to_openai");
        const restored = await write("route", "PUT", { expectedVersion: owned.version,
          service: "email.summary", route: run.originalRoute });
        const expected = { ...original, version: owned.version + 1 };
        if (canonical(snapshot(restored)) !== canonical(expected) ||
            canonical(snapshot(await get("/api/configurator/ai"))) !== canonical(expected))
          fail("RESTORE_READBACK_MISMATCH_DO_NOT_REPEAT");
        run.restoreStatus = "restored_verified"; run.restoredVersion = expected.version;
        console.log("PHASE=openai_restored_verified");
        run.status = run.error ? "test_stopped_original_route_restored" : "three_live_summaries_completed_openai_restored";
      } catch (e) {
        run.status = "manual_verification_required"; run.restoreStatus = "manual_verification_required";
        run.restoreError = e instanceof Error ? e.message : "RESTORE_NOT_VERIFIED";
      }
    } else if (switchAttempted) {
      run.status = "manual_verification_required"; run.restoreStatus = "manual_verification_required";
    }
    if (run.temporaryWindow && (!switchAttempted || run.restoreStatus === "restored_verified"))
      window.removeEventListener("beforeunload", unload);
    run.finishedAt = new Date().toISOString();
    console.table(run.results.map(r => ({ case: r.case, status: r.status, jobId: r.jobId, seconds: r.seconds })));
    console.log("Export obsahuje skutočné texty. Pred zdieľaním anonymizuj osobné údaje.");
    console.log(JSON.stringify(run, null, 2));
  }
  return run;
}
function browserScript(options = {}) {
  return "(" + runThreeLiveSummaries.toString() +
    ")(" + JSON.stringify(options) + ").catch(e => console.error('STOP; DO NOT REPEAT:', e.message));\n";
}
module.exports = { runThreeLiveSummaries, browserScript };
if (require.main === module) {
  if (process.argv.slice(2).some(a => a !== "--temporary-window") || process.argv.length > 3)
    throw Error("use_optional_temporary_window_flag");
  process.stdout.write(browserScript({ temporaryWindow: process.argv.includes("--temporary-window") }));
}
