const assert = require("node:assert/strict");
const { build } = require("esbuild");
const { chromium } = require("@playwright/test");
const path = require("node:path");

async function main() {
  const compiled = await build({
    stdin: { contents: `
      import React, { useState } from "react";
      import { createRoot } from "react-dom/client";
      import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
      import { I18nProvider } from "@/i18n/I18nProvider";
      import { useAIJobHistory } from "@/hooks/use-ai-job";
      import { EmailSummaryJob } from "@/components/nexus/EmailSummaryJob";
      const fixture = window.fixture;
      const nativeFetch = window.fetch.bind(window);
      window.fetch = (input, init) => {
        if (typeof input !== "string" || !input.startsWith("/api/ai/jobs?")) return nativeFetch(input, init);
        const params = new URL(input, "https://fixture.invalid").searchParams;
        const id = params.get("entityId");
        fixture.reads.push(id);
        if (fixture.denied) return Promise.resolve(Response.json({errorCode:"forbidden"},{status:403}));
        if (params.get("mailbox") !== "personal" || params.get("locale") !== "sk") throw Error("incorrect scope");
        return Promise.resolve(Response.json({ jobs: fixture.jobs[id] ? [fixture.jobs[id]] : [] }));
      };
      function Fixture() {
        const [id, setId] = useState("email-a");
        const [opened, setOpened] = useState("");
        const query = useAIJobHistory({ownerId:"synthetic-owner",entityId:id,service:"email.summary",mailbox:"personal",locale:"sk"});
        fixture.switchTo = id => { setOpened(""); setId(id); };
        fixture.refresh = () => query.refetch();
        fixture.accept = job => query.acceptJob(job);
        return <><EmailSummaryJob job={query.isError ? null : query.data?.jobs[0]} retrying={false}
          onOpen={summary=>setOpened(id+":"+summary)} onRetry={()=>fixture.retries++}/>
          <output data-testid="opened">{opened}</output></>;
      }
      const client = new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false}}});
      createRoot(document.getElementById("root")).render(<I18nProvider userCountries={["SK"]}>
        <QueryClientProvider client={client}><Fixture/></QueryClientProvider></I18nProvider>);
    `, sourcefile: "summary-job-fixture.tsx", loader: "tsx", resolveDir: process.cwd() },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
    alias: { "@": path.join(process.cwd(), "client/src"), "@shared": path.join(process.cwd(), "shared") },
  });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium",
    args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.setContent("<html><body><div id='root'></div></body></html>");
    await page.clock.install();
    await page.evaluate(() => {
      const job = (id, state) => ({ id: id + "-job", service: "email.summary", entityType: "email",
        entityId: id, status: state, attempts: 1, maxAttempts: 3, result: null,
        errorCode: null, createdAt: new Date().toISOString(), startedAt: null, finishedAt: null });
      window.fixture = { reads: [], retries: 0, jobs: { "email-a": job("email-a", "pending"), "email-b": job("email-b", "failed") } };
    });
    await page.addScriptTag({ content: compiled.outputFiles[0].text });
    await page.locator('[data-job-state="pending"]').waitFor();
    await page.evaluate(() => { window.fixture.jobs["email-a"].status = "processing"; });
    await page.clock.fastForward(5100);
    await page.locator('[data-job-state="processing"]').waitFor();
    await page.evaluate(() => { window.fixture.jobs["email-a"].status = "completed";
      window.fixture.jobs["email-a"].result = { summary: "<p>Synthetic private A summary.</p>" }; });
    await page.clock.fastForward(5100);
    await page.locator('[data-job-state="completed"]').waitFor();
    assert.equal(await page.getByTestId("opened").textContent(), "");
    await page.getByTestId("email-summary-job").locator("button").click();
    assert.match(await page.getByTestId("opened").textContent(), /^email-a:/);
    const count = await page.evaluate(() => window.fixture.reads.length);
    await page.clock.fastForward(16000);
    assert.equal(await page.evaluate(() => window.fixture.reads.length), count);
    await page.evaluate(() => window.fixture.switchTo("email-b"));
    await page.locator('[data-job-state="failed"]').waitFor();
    assert.equal(await page.getByTestId("opened").textContent(), "");
    await page.getByTestId("email-summary-job").locator("button").click();
    assert.equal(await page.evaluate(() => window.fixture.retries), 1);
    assert.equal(await page.evaluate(() => { try { window.fixture.accept(window.fixture.jobs["email-a"]); return false; } catch { return true; } }), true);
    await page.evaluate(() => { window.fixture.jobs["email-b"].attempts = 3; window.fixture.refresh(); });
    await page.waitForFunction(() => document.querySelector('[data-testid="email-summary-job"] button')?.disabled === true);
    await page.evaluate(() => { window.fixture.denied = true; window.fixture.refresh(); });
    await page.getByTestId("email-summary-job").waitFor({ state: "hidden" });
    const deniedCount = await page.evaluate(() => window.fixture.reads.length);
    await page.clock.fastForward(16000);
    assert.equal(await page.evaluate(() => window.fixture.reads.length), deniedCount);
    assert.deepEqual(errors, []);
    console.log("Email-summary browser checks passed: four states, read-only recovery, explicit result opening, source switching, retry limits, identity guard and stopped polling after completion/permission loss.");
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
