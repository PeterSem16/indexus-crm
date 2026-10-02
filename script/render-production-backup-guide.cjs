#!/usr/bin/env node
// Self-contained operator guide. Embeds only the reviewed helper, never configuration.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const zlib = require("node:zlib");

function render(source) {
  const hash = crypto.createHash("sha256").update(source).digest("hex");
  const payload = zlib.gzipSync(source).toString("base64");
  const command = `bash <<'INDEXUS_BACKUP'
set -euo pipefail
umask 077
cd /var/www/indexus-crm
node <<'INDEXUS_INSTALL'
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
if (os.userInfo().username !== 'seman' || os.hostname().split('.')[0].toUpperCase() !== 'CORPCRM01')
  throw new Error('Spustite iba ako seman na CORPCRM01.');
const home = os.homedir();
const dir = path.join(home, 'indexus-operator');
const homeStat = fs.lstatSync(home);
if (homeStat.isSymbolicLink() || !homeStat.isDirectory() || homeStat.uid !== process.getuid())
  throw new Error('Neocakavany domovsky priecinok.');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, {mode: 0o700});
const stat = fs.lstatSync(dir);
if (stat.isSymbolicLink() || !stat.isDirectory() || stat.uid !== process.getuid() || (stat.mode & 0o077))
  throw new Error('Operator priecinok musi byt sukromny (700), vlastneny operatorom a bez symlinku.');
const content = zlib.gunzipSync(Buffer.from('${payload}', 'base64'));
if (crypto.createHash('sha256').update(content).digest('hex') !== '${hash}')
  throw new Error('Kontrolny sucet skriptu nesuhlasi. Nic nebolo spustene.');
const file = path.join(dir, 'backup-consolidated-production.cjs');
const existing = fs.lstatSync(file, {throwIfNoEntry: false});
if (existing && (!existing.isFile() || existing.isSymbolicLink() || existing.uid !== process.getuid()))
  throw new Error('Neocakavany ciel skriptu.');
const temp = file + '.tmp-' + process.pid;
fs.writeFileSync(temp, content, {mode: 0o600, flag: 'wx'});
fs.renameSync(temp, file);
console.log('Skript zalohy: kontrolny sucet overeny.');
INDEXUS_INSTALL
node "$HOME/indexus-operator/backup-consolidated-production.cjs" --backup
INDEXUS_BACKUP`;
  const escape = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return `<!doctype html><html lang="sk"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>INDEXUS — bezpečná záloha CORPCRM01</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f5f6f8;color:#202124;font:15px/1.65 system-ui,sans-serif}
main{max-width:960px;margin:36px auto;padding:32px;background:white;border:1px solid #e3e5e8;border-radius:16px}
h1{font-size:28px;line-height:1.25;margin:12px 0}h2{font-size:20px;margin-top:30px}
.brand{color:#be123c;font-weight:700;letter-spacing:.08em}.notice{padding:16px;border:1px solid #ecd4a8;background:#fff9ed;border-radius:10px}
.muted{color:#647080}.badge{font-size:13px;border:1px solid #ddd;border-radius:20px;padding:5px 12px;display:inline-block}
button{border:0;border-radius:9px;background:#c8102e;color:white;padding:12px 18px;font:600 15px system-ui;cursor:pointer}
button:focus-visible{outline:3px solid #283f85;outline-offset:3px}
pre{padding:18px;background:#f6f7f9;border:1px solid #e3e5e8;border-radius:10px;white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.5 ui-monospace,monospace;max-height:420px;overflow:auto}
code{overflow-wrap:anywhere}li{margin:6px 0}#copy-status{margin-left:12px;color:#52606d}summary{cursor:pointer;font-weight:600}
@media(max-width:650px){main{margin:12px;padding:20px}h1{font-size:24px}}
</style></head><body><main>
<div class="brand">INDEXUS / CORPCRM01</div>
<h1>Záloha pred konsolidovaným nasadením</h1>
<span class="badge">Iba záloha • bez nasadenia a reštartu</span>
<p>Tento krok nemení bežiacu aplikáciu, jej Git stav ani databázu. Skript vytvorí súkromnú zálohu v
<code>~/indexus-backups/časová-pečiatka</code>. Počas zálohovania nespúšťajte iné nasadenie, build, inštaláciu balíkov ani zmeny konfigurácie.</p>
<h2>Čo záloha obsahuje</h2><ul>
<li>Kód vrátane lokálnych opráv, necommitnutých súborov a <code>.git</code>.</li>
<li>Pôvodný <code>dist</code> a <code>node_modules</code> pre návrat bez nového zostavovania.</li>
<li>Konfiguráciu a súkromný záznam PM2; prihlasovacie údaje sa nevypisujú do konzoly.</li>
<li>Konzistentný PostgreSQL dump aktívnej databázy aplikácie.</li>
<li>Kontrolné súčty, overenie archívu a čitateľnosti katalógu databázového dumpu.</li>
</ul>
<div class="notice"><strong>Dôležité:</strong> Súbory v <code>data</code>, <code>uploads</code>,
<code>attached_assets</code>, <code>runtime</code>, <code>server/data</code> a <code>server/uploads</code>
nie sú v tomto archíve. Ani experimentálne <code>artifacts</code>/<code>design</code>.
Dáta a prílohy zostávajú na mieste a pri návrate aplikácie ich nebudeme prepisovať.
Toto nie je úplná havarijná záloha celého servera.
Zálohu <strong>neposielajte do chatu, na GitHub ani do verejného priečinka</strong> — obsahuje súkromnú konfiguráciu a údaje.</div>
<h2>1. Spustite zálohu</h2>
<p>Na počítači otvorte tento návod, skopírujte celý blok a vložte ho do konzoly CORPCRM01 ako používateľ
<code>seman</code>. Blok najprv overí odtlačok vloženého skriptu a potom vykoná iba zálohu.</p>
<button id="copy-command" type="button">Skopírovať príkaz zálohy</button><span id="copy-status" role="status"></span>
<pre id="command">${escape(command)}</pre>
<h2>2. Pošlite iba výsledok z konzoly</h2>
<p>Úspešný koniec má tento tvar:</p>
<pre>SUCCESS=true HEAD=… FINGERPRINT=… COUNT=…
BACKUP=/home/seman/indexus-backups/… ARCHIVE=true DATABASE=true
NOT_INCLUDED=…</pre>
<p>Pošlite tieto riadky. Ak sa zobrazí <code>BACKUP FAILED</code>, zastavte sa a pošlite iba túto správu.
Súkromné logy, <code>.env</code>, PM2 JSON ani databázový dump neposielajte.</p>
<h2>Nasadenie a návrat</h2>
<p>Až po overení zálohy a odtlačku aktuálnych produkčných opráv pripravíme pripnutý Git balík,
jeho kontrolu v oddelenom prostredí a presné príkazy návratu. Zatiaľ nespúšťajte <code>git pull</code>,
<code>git reset</code>, <code>git clean</code>, <code>db:push</code> ani reštart PM2.</p>
<p>Návrat aplikácie obnoví overený pôvodný build a potrebný kód/závislosti; stará databáza sa
<strong>automaticky neobnovuje</strong>, aby sa nestratili záznamy vytvorené po nasadení.
Obnova databázy vyžaduje samostatné rozhodnutie a odstavenie zápisov. Kontrola dumpu tu overuje
jeho formát a katalóg, nie skúšobné obnovenie celej databázy.</p>
<details><summary>Zdroj zálohovacieho skriptu na kontrolu</summary><pre>${escape(source.toString("utf8"))}</pre></details>
<p class="muted">SHA-256 skriptu: <code>${hash}</code><br>
Návod je samostatný súbor bez externých zdrojov a sieťových požiadaviek.</p>
</main><script>
document.getElementById('copy-command').onclick=async function(){
const text=document.getElementById('command').textContent,status=document.getElementById('copy-status');
try{if(!navigator.clipboard)throw Error('clipboard');await navigator.clipboard.writeText(text)}
catch(e){const area=document.createElement('textarea');area.value=text;area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();const ok=document.execCommand('copy');area.remove();if(!ok){status.textContent='Označte a skopírujte celý blok ručne.';return}}
status.textContent='Skopírované. Vložte do konzoly CORPCRM01.';
};
</script></body></html>`;
}
if (require.main === module) {
  const root = path.resolve(__dirname, "..");
  const source = fs.readFileSync(path.join(__dirname, "backup-consolidated-production.cjs"));
  const dest = path.join(root, "attached_assets", "INDEXUS-CORPCRM01-zaloha.html");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, render(source));
  console.log("Guide generated: attached_assets/INDEXUS-CORPCRM01-zaloha.html");
}
module.exports = { render };