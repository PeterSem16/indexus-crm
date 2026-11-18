/** Offline handoff only: no models, network, production imports or writes. */
import fs from "node:fs";
import path from "node:path";
import { acceptanceCorpus } from "./corpus";
import { originalBoundaries } from "./source";
import { THREE_SERVICE_CANDIDATE_ROUTES } from "../../server/lib/ai/three-services-profile";

const root = process.cwd();
const directory = path.join(root, "generated-artifacts/internal-ai-three-services");
fs.mkdirSync(directory, { recursive: true });
const markdown = fs.readFileSync(path.join(root, "docs/internal-ai-three-services-handoff.md"), "utf8");
const corpus = acceptanceCorpus();
const payload = {
  status: "PREPARED_NOT_EXECUTED", verdict: "NOT_READY", externalCalls: 0,
  productionChanges: false, candidateRoutes: THREE_SERVICE_CANDIDATE_ROUTES,
  sourceHashes: originalBoundaries(root).hashes,
  languages: ["SK", "CZ", "RO", "ENG", "DE", "IT", "HU"],
  plannedCases: corpus.length, maxInferenceAttempts: 80, cases: corpus,
};
const json = JSON.stringify(payload, null, 2) + "\n";
fs.writeFileSync(path.join(directory, "acceptance-81.json"), json);
const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const download = (mime: string, value: string) =>
  `data:${mime};base64,${Buffer.from(value).toString("base64")}`;
const html = `<!doctype html><html lang="sk"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>INDEXUS — tri služby cez existujúcu internú AI</title>
<style>body{font:16px/1.6 system-ui,sans-serif;color:#172b41;background:#f3f5f8;margin:0}
main{max-width:1080px;margin:auto;padding:36px 24px}h1{line-height:1.2}.notice{background:#fff1d4;border-left:5px solid #ae7211;padding:20px}
nav{display:flex;gap:12px;flex-wrap:wrap;margin:24px 0}a{background:#163c63;color:white;padding:12px 18px;border-radius:8px;text-decoration:none}
pre{background:white;border:1px solid #dce2e9;padding:24px;white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.65 ui-monospace,monospace}
small{color:#52677b}</style><main><small>INDEXUS / interná AI / presný rozsah dodaného zadania</small>
<h1>Tri existujúce služby.<br>Rovnaké API spojenie ako email.monitoring.</h1>
<p>email.summary · task.checklist · task.resolution</p>
<div class="notice"><b>NOT READY na produkčnú aktiváciu.</b><br>
Pripravená integrácia a 81 testovacích prípadov pre SK, CZ, RO, ENG, DE, IT, HU.
Živý modelový beh z CORPCRM01 zatiaľ nebol vykonaný. Produkčné routy neboli zmenené.</div>
<nav><a download="INDEXUS-zadanie-tri-sluzby.md" href="${download("text/markdown", markdown)}">Stiahnuť technické zadanie</a>
<a download="INDEXUS-akceptacia-81.json" href="${download("application/json", json)}">Stiahnuť 81 testovacích prípadov</a></nav>
<pre>${escape(markdown)}</pre></main></html>`;
fs.writeFileSync(path.join(directory, "INDEXUS-interny-AI-tim.html"), html);
console.log(JSON.stringify({ preparedCases: corpus.length, externalCalls: 0, verdict: "NOT_READY" }));
