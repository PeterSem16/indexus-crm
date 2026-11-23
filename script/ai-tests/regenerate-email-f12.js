(async function regenerateSameSavedEmail() {
  // The source is selected explicitly; this script never chooses another message.
  const previous = window.indexusEmailRegeneration;
  if (previous?.status === "running") throw Error("Test už beží. Počkaj na výsledok.");
  const sourceId = window.prompt("ID pôvodnej dokončenej úlohy:",
    previous?.sourceJobId || window.indexusSingleEmailTest?.results?.[0]?.jobId || "");
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(sourceId || ""))
    throw Error("Neplatné ID úlohy. Nič sa nespustilo.");
  const run = window.indexusEmailRegeneration = {
    sourceJobId: sourceId, startedAt: new Date().toISOString(), status: "running", postAttempted: false,
  };
  const stop = message => { throw Error(message); };
  const get = async path => {
    const response = await fetch(path, { credentials: "same-origin", cache: "no-store" });
    if (response.status !== 200) stop("GET HTTP " + response.status + "; nič neopakujem automaticky.");
    return response.json();
  };
  let baseline;
  const check = async () => {
    const c = await get("/api/configurator/ai"), m = await get("/api/configurator/ai/maintenance");
    const route = c.services?.find(s => s.id === "email.summary")?.route;
    if (c.runtime?.mode !== "routed" || !c.runtime.production || c.runtime.replit ||
        !c.runtime.serverAllowed || !c.gateway?.enabled || !c.queue?.ready ||
        route?.provider !== "internal" || !route.enabled || !route.model ||
        m.mode !== "running" || !(m.workers?.alive > 0) ||
        m.workers.unsupported !== 0 || m.workers.confirmed !== m.workers.alive)
      stop("Interná sumarizácia alebo worker nie sú pripravené. Nič nemením.");
    const stamp = JSON.stringify([c.version, c.gateway, c.services, m.version]);
    if (baseline && stamp !== baseline) stop("Konfigurácia sa počas testu zmenila.");
    baseline = stamp; run.configuredRoute = route;
  };
  const sourcePath = "/api/ai/jobs/" + encodeURIComponent(sourceId);
  const path = sourcePath + "/regeneration";
  try {
    const source = (await get(sourcePath)).job;
    if (source?.id !== sourceId || source.service !== "email.summary" ||
        source.entityType !== "email" || source.status !== "completed" ||
        typeof source.result?.summary !== "string" || !source.result.summary.trim())
      stop("Pôvodná dokončená sumarizácia nie je dostupná.");
    run.original = source;
    const originalSnapshot = JSON.stringify(source);
    let admission = await get(path); // Also verifies deployment; GET can never create a job.
    if (admission.sourceJobId !== sourceId) stop("Nesprávna identita pôvodnej úlohy.");
    run.resumed = !!admission.job;
    if (run.resumed) console.log("Načítavam existujúci nadväzujúci beh; nové generovanie nespúšťam.");
    if (!admission.job) {
      await check();
      if (!window.confirm("Vytvoriť JEDNO nové zhrnutie TOHO ISTÉHO e-mailu?\n" +
          "Pôvodný výsledok zostane zachovaný. Žiadny e-mail sa neodošle.")) stop("Zrušené bez generovania.");
      await check();
      run.postAttempted = true; // Retain uncertain admission; never automatically resend.
      const response = await fetch(path, { method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body: "{}" });
      if (response.status !== 202) stop("POST HTTP " + response.status + "; prijatie neoverené.");
      admission = await response.json();
    }
    const jobId = admission.jobId;
    if (admission.sourceJobId !== sourceId || jobId === sourceId ||
        !/^[a-f0-9-]{36}$/i.test(jobId || "")) stop("Nová úloha nemá overenú samostatnú identitu.");
    run.jobId = jobId;
    let job = admission.job;
    const deadline = Date.now() + 15 * 60_000;
    for (;;) {
      if (job?.id !== jobId || job.service !== source.service ||
          job.entityType !== "email" || job.entityId !== source.entityId ||
          !Number.isInteger(job.attempts) || job.attempts < 0 || job.attempts > 1 ||
          !["pending", "processing", "completed", "failed"].includes(job.status))
        stop("Neplatná identita alebo stav novej úlohy.");
      run.job = job;
      if (job.status === "failed") stop("Nová úloha zlyhala: " + job.errorCode + ". Neopakujem generovanie.");
      if (job.status === "completed") break;
      if (Date.now() >= deadline) stop("Čakanie skončilo; úloha môže stále bežať.");
      await new Promise(resolve => setTimeout(resolve, 3000));
      job = (await get("/api/ai/jobs/" + encodeURIComponent(jobId))).job;
    }
    if (job.attempts !== 1 || typeof job.result?.summary !== "string" ||
        !job.result.summary.trim()) stop("Chýba nové zhrnutie.");
    if (JSON.stringify((await get(sourcePath)).job) !== originalSnapshot)
      stop("Pôvodná úloha sa zmenila; výsledok vyžaduje kontrolu.");
    if (baseline) await check();
    run.status = "completed_review_pending";
    console.log("PÔVODNÉ ZHRNUTIE:", source.result.summary);
    console.log("NOVÉ ZHRNUTIE:", job.result.summary);
    console.table([
      { výsledok: "pôvodný", jobId: source.id, stav: source.status },
      { výsledok: "nový", jobId, stav: job.status },
    ]);
  } catch (error) {
    run.status = "stopped_review_required"; run.error = error.message;
    console.error("STOP:", run.error,
      "\nŽiadne automatické opakovanie. Ďalšie spustenie najprv iba načíta existujúci nový beh.");
  } finally {
    run.finishedAt = new Date().toISOString();
    console.log("Výsledok: window.indexusEmailRegeneration", run);
  }
})();
