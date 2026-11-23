(async function runThreeLiveSummaries() {
  const previous = window.indexusEmailTest;
  if (previous && !(previous.status === "stopped_do_not_repeat" &&
      Array.isArray(previous.results) && previous.results.length === 0))
    throw Error("Predchádzajúci beh mohol vytvoriť úlohu. Generovanie neopakujem.");
  const run = window.indexusEmailTest = { startedAt: new Date().toISOString(), results: [] };
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
      stop("Sumarizácia nie je pripravená na internú AI. Nastavenia sa nezmenili.");
    const m = await get("/api/configurator/ai/maintenance");
    if (m.mode !== "running" || !(m.workers?.alive > 0) ||
        m.workers.unsupported !== 0 || m.workers.confirmed !== m.workers.alive)
      stop("AI worker nie je pripravený.");
    const stamp = JSON.stringify([c.version, c.gateway, c.services, m.version]);
    if (baseline && baseline !== stamp) stop("Konfigurácia sa počas testu zmenila.");
    baseline = stamp; run.configuredRoute = route;
  };
  try {
    const { user } = await get("/api/auth/me");
    if (!user?.id) stop("Najprv sa prihlás.");
    const base = "/api/users/" + encodeURIComponent(user.id);
    await check();
    const boxes = await get(base + "/ms365-available-mailboxes");
    if (!Array.isArray(boxes) || !boxes.length) stop("Chýba pripojená schránka.");
    console.table(boxes.map((b, i) => ({ číslo: i + 1, schránka: b.email })));
    const savedBox = boxes.findIndex(b => b.email.trim().toLowerCase() === previous?.mailbox);
    const pick = savedBox >= 0 ? String(savedBox + 1) : window.prompt("Číslo schránky z tabuľky:", "1");
    if (!/^\d+$/.test(pick || "") || !boxes[Number(pick) - 1]) stop("Výber zrušený alebo neplatný.");
    const box = boxes[Number(pick) - 1], mailbox = box.email.trim().toLowerCase();
    const language = previous?.language || window.prompt("Jazyk: sk, cs, en, hu, ro, it, de", "sk");
    if (!["sk", "cs", "en", "hu", "ro", "it", "de"].includes(language)) stop("Neplatný jazyk.");
    run.mailbox = mailbox; run.language = language;
    const history = async id => {
      const h = await get("/api/ai/jobs?" + new URLSearchParams({
        service: "email.summary", entityId: id, mailbox, locale: language, limit: "50" }));
      if (!Array.isArray(h.jobs)) stop("Neplatná história úloh.");
      return h.jobs.length;
    };
    const list = await get(base + "/ms365-recent-emails?" + new URLSearchParams({
      mailbox: box.id === "personal" ? "personal" : mailbox, top: "10" }));
    if (!list.connected || !Array.isArray(list.emails)) stop("Schránka nie je dostupná.");
    const emails = list.emails;
    const checked = await Promise.all(emails.map(async e => ({ email: e, used: !!(await history(e.id)) })));
    const selected = checked.filter(e => !e.used).slice(0, 3).map(e => e.email);
    if (selected.length !== 3 || selected.some(e => !e?.id) || new Set(selected.map(e => e.id)).size !== 3)
      stop("V posledných 10 správach nie sú 3 rôzne e-maily bez AI úlohy. Nič som nespustil.");
    console.log("Predchádzajúce úlohy preskočené:", checked.filter(e => e.used).length);
    console.table(selected.map((e, i) => ({ číslo: i + 1, predmet: e.subject })));
    if (!window.confirm("Analyzovať tieto 3 reálne e-maily internou AI?\n" +
        selected.map(e => e.subject).join("\n") +
        "\nUložia sa AI úlohy a zhrnutia. Žiadny e-mail sa neodošle.")) stop("Zrušené.");
    for (const e of selected) {
      await check();
      if (await history(e.id)) stop("Medzitým vznikla úloha. Neopakujem.");
      const row = { emailId: e.id, subject: e.subject, startedAt: new Date().toISOString(), status: "unknown" };
      run.results.push(row);
      const r = await fetch(base + "/ms365-ai-summary", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId: e.id, mailbox, language }) });
      row.httpStatus = r.status;
      const data = await r.json(); row.jobId = data.jobId;
      if (r.status !== 202 || !/^[a-f0-9-]{36}$/i.test(row.jobId || "")) stop("Prijatie úlohy neoverené.");
      const deadline = Date.now() + 15 * 60_000;
      let job = data.job;
      for (;;) {
        if (job?.id !== row.jobId || job.service !== "email.summary" ||
            job.entityType !== "email" || job.entityId !== e.id ||
            !Number.isInteger(job.attempts) || job.attempts < 0 || job.attempts > 1 ||
            !["pending", "processing", "completed", "failed"].includes(job.status)) stop("Neplatná identita alebo stav úlohy.");
        row.job = job; row.status = job.status;
        if (job.status === "failed") stop("AI úloha zlyhala: " + job.errorCode);
        if (job.status === "completed") break;
        if (Date.now() > deadline) stop("Čakanie skončilo; úloha môže stále bežať.");
        await new Promise(resolve => setTimeout(resolve, 3000));
        job = (await get("/api/ai/jobs/" + encodeURIComponent(row.jobId))).job;
      }
      if (job.attempts !== 1 || !job.result?.summary?.trim()) stop("Chýba zhrnutie.");
      row.summary = job.result.summary; row.finishedAt = new Date().toISOString();
      console.log("E-mail:", row.subject, "\nZhrnutie:", row.summary);
    }
    await check(); run.status = "completed_review_pending";
  } catch (e) {
    run.status = "stopped_do_not_repeat"; run.error = e.message;
    console.error("STOP — nespúšťaj znovu:", run.error);
  } finally {
    run.finishedAt = new Date().toISOString();
    console.table(run.results.map(r => ({ predmet: r.subject, stav: r.status, jobId: r.jobId })));
    console.log("Výsledky: window.indexusEmailTest", run);
  }
})();
