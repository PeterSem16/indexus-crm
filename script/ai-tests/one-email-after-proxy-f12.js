(async function runOneNewSummary() {
  const original = window.indexusEmailTest, previous = window.indexusSingleEmailTest;
  if (previous && !(previous.status === "stopped_do_not_repeat" &&
      Array.isArray(previous.results) && previous.results.length === 0))
    throw Error("Tento test už mohol vytvoriť úlohu. Neopakujem.");
  const run = window.indexusSingleEmailTest = { startedAt: new Date().toISOString(), results: [] };
  const stop = message => { throw Error(message); };
  const get = async url => {
    const r = await fetch(url, { credentials: "same-origin", cache: "no-store" });
    if (r.status !== 200) stop("GET HTTP " + r.status);
    return r.json();
  };
  let baseline;
  const check = async () => {
    const c = await get("/api/configurator/ai");
    const route = c.services?.find(s => s.id === "email.summary")?.route;
    if (c.runtime?.mode !== "routed" || !c.runtime.production || c.runtime.replit ||
        !c.runtime.serverAllowed || !c.gateway?.enabled || !c.queue?.ready ||
        route?.provider !== "internal" || !route.enabled || !route.model)
      stop("Interná sumarizácia nie je pripravená. Nič nemením.");
    const m = await get("/api/configurator/ai/maintenance");
    if (m.mode !== "running" || !(m.workers?.alive > 0) ||
        m.workers.unsupported !== 0 || m.workers.confirmed !== m.workers.alive)
      stop("AI worker nie je pripravený.");
    const stamp = JSON.stringify([c.version, c.gateway, c.services, m.version]);
    if (baseline && baseline !== stamp) stop("Konfigurácia sa počas testu zmenila.");
    baseline = stamp; run.configuredRoute = route;
  };
  try {
    if (original && !["completed_review_pending", "stopped_do_not_repeat"].includes(original.status))
      stop("Pôvodný test ešte môže bežať.");
    const { user } = await get("/api/auth/me");
    if (!user?.id) stop("Najprv sa prihlás do produkčného INDEXUS-u.");
    const base = "/api/users/" + encodeURIComponent(user.id);
    await check();
    const boxes = await get(base + "/ms365-available-mailboxes");
    if (!Array.isArray(boxes) || !boxes.length) stop("Chýba pripojená schránka.");
    console.table(boxes.map((b, i) => ({ číslo: i + 1, schránka: b.email })));
    const saved = original || previous;
    const savedBox = boxes.findIndex(b => b.email.trim().toLowerCase() === saved?.mailbox);
    const pick = savedBox >= 0 ? String(savedBox + 1) : window.prompt("Číslo schránky z tabuľky:", "1");
    if (!/^\d+$/.test(pick || "") || !boxes[Number(pick) - 1]) stop("Neplatný výber.");
    const box = boxes[Number(pick) - 1], mailbox = box.email.trim().toLowerCase();
    const language = saved?.language || window.prompt("Jazyk: sk, cs, en, hu, ro, it, de", "sk");
    if (!["sk", "cs", "en", "hu", "ro", "it", "de"].includes(language)) stop("Neplatný jazyk.");
    run.mailbox = mailbox; run.language = language;
    const history = async id => {
      const h = await get("/api/ai/jobs?" + new URLSearchParams({
        service: "email.summary", entityId: id, mailbox, limit: "50" }));
      if (!Array.isArray(h.jobs)) stop("Neplatná história.");
      return h.jobs.length;
    };
    const list = await get(base + "/ms365-recent-emails?" + new URLSearchParams({
      mailbox: box.id === "personal" ? "personal" : mailbox, top: "10" }));
    if (!list.connected || !Array.isArray(list.emails)) stop("Schránka nie je dostupná.");
    const oldIds = new Set((original?.results || []).map(r => r.emailId));
    let email;
    for (const e of list.emails) {
      if (e?.id && !oldIds.has(e.id) && !(await history(e.id))) { email = e; break; }
    }
    if (!email) stop("V posledných 10 správach nie je nový e-mail bez AI úlohy.");
    if (!window.confirm("Vytvoriť JEDNO nové zhrnutie internou AI?\n" + email.subject +
        "\nPôvodné výsledky zostanú zachované. Žiadny e-mail sa neodošle.")) stop("Zrušené.");
    await check();
    if (await history(email.id)) stop("Medzitým vznikla úloha. Neopakujem.");
    const row = { emailId: email.id, subject: email.subject, startedAt: new Date().toISOString(), status: "unknown" };
    run.results.push(row);
    const r = await fetch(base + "/ms365-ai-summary", {
      method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailId: email.id, mailbox, language }) });
    row.httpStatus = r.status;
    const data = await r.json(); row.jobId = data.jobId;
    if (r.status !== 202 || !/^[a-f0-9-]{36}$/i.test(row.jobId || "")) stop("Prijatie úlohy neoverené. Neopakuj test.");
    const deadline = Date.now() + 15 * 60_000;
    let job = data.job;
    for (;;) {
      if (job?.id !== row.jobId || job.service !== "email.summary" ||
          job.entityType !== "email" || job.entityId !== email.id ||
          !Number.isInteger(job.attempts) || job.attempts < 0 || job.attempts > 1 ||
          !["pending", "processing", "completed", "failed"].includes(job.status)) stop("Neplatná identita alebo stav úlohy.");
      row.job = job; row.status = job.status;
      if (job.status === "failed") stop("AI úloha zlyhala: " + job.errorCode);
      if (job.status === "completed") break;
      if (Date.now() > deadline) stop("Čakanie skončilo; úloha môže stále bežať. Neopakuj test.");
      await new Promise(resolve => setTimeout(resolve, 3000));
      job = (await get("/api/ai/jobs/" + encodeURIComponent(row.jobId))).job;
    }
    if (job.attempts !== 1 || !job.result?.summary?.trim()) stop("Chýba zhrnutie.");
    row.summary = job.result.summary; row.finishedAt = new Date().toISOString();
    row.elapsedSeconds = (Date.parse(row.finishedAt) - Date.parse(row.startedAt)) / 1000;
    console.log("NOVÉ ZHRNUTIE:", row.subject, "\n", row.summary);
    await check(); run.status = "completed_review_pending";
  } catch (e) {
    run.status = "stopped_do_not_repeat"; run.error = e.message;
    console.error("STOP — nespúšťaj znovu:", run.error);
  } finally {
    run.finishedAt = new Date().toISOString();
    console.table(run.results.map(r => ({ stav: r.status, jobId: r.jobId, sekundy: r.elapsedSeconds })));
    console.log("Výsledok: window.indexusSingleEmailTest", run);
  }
})();
