# Finálny produkčný preflight – iba čítanie

Používateľ akceptoval prípravnú fázu a schválil iba produkčný preflight.
Nasadenie, zmena PM2 konfigurácie a reštart INDEXUS naďalej vyžadujú
samostatné schválenie po vyhodnotení jeho výsledku.

## Čo je nové oproti pôvodnému helperu

Pôvodný `--preflight` nekontaktoval Gateway a vracal technický stav.
Aktuálny režim vracia presne `READY` alebo `BLOCKED`, kontroluje živý PM2
stav a všetkých 65 routov a overuje Gateway tromi autentifikovanými GET:

1. `https://ai.cordbloodcenter.com/gateway/health/ready`
2. `https://ai.cordbloodcenter.com/gateway/v1/models`
3. `https://ai.cordbloodcenter.com/gateway/indexus/v1/capabilities`

Lokálne overenie aktualizovaných nástrojov: **96/96 testov prešlo**
(vrátane 20 nových preflight testov). Žiadny z týchto testov nekontaktoval
produkciu ani skutočnú Gateway.

Token číta iba proces na CORPCRM01 z existujúceho root-only súboru.
Hodnota sa nevypíše, nevloží do shell argumentov, prostredia PM2 ani do reportu.
TLS certifikát musí byť platný; presmerovania sa nesledujú.
Sú kontrolované schéma, verzia API a deklarovaná dostupnosť modelu
`indexus-document-audio:latest` pre text a `json_object`.

Neodosiela sa žiadny POST ani obsah kontaktov, nespúšťa sa inferencia a nemení
sa administrátorská DB konfigurácia. Bežné sieťové, sudo a prístupové logy
kontrol môžu prirodzene vzniknúť; nejde o zmeny konfigurácie aplikácie.

## Význam výsledku

`READY` znamená, že preflight v danom okamihu splnil kontrolované predpoklady
pre ďalšie schvaľovanie. **Nie je to `GATEWAY_READY_OPENAI_ACTIVE` ani povolenie
na automatické spustenie realizácie.** Gateway v INDEXUS zostáva vypnutá
a všetkých 65 routov musí zostať OpenAI bez modelových overrides.

`BLOCKED` obsahuje `blockedAt` a bezpečný `blockedBy`.
Pri odchýlke sa nesmú automaticky upraviť očakávané PID, hashe, práva alebo routy.
Operátor má poslať nesenzitívny JSON na vyhodnotenie.

Počas GET kontrol sa kontroluje, či sa nezmenil worker, environment identity,
`.env`, token, backend, routy alebo DB konfigurácia.
Nejde o simuláciu 65 živých OpenAI volaní; overuje sa autoritatívna konfigurácia.

## Záloha a rollback v read-only preflighte

Kontroluje sa schválený mount `/dev/sdb1`, rw príznak a minimálna voľná kapacita,
ACL, kolízie, prípadný existujúci súkromný adresár a operation lock,
dostupnosť kompletného rollback balíka, syntax jeho zdrojov a syntetický loader.

**Záloha sa teraz nevytvára, zápis na backup disk sa neskúša a rollback sa
nevykonáva.** Výstup tieto limity uvádza explicitne. Skutočný diskový zápis,
integrita vytvorenej zálohy, neprístupnosť pre službu/webserver a spustiteľnosť
skopírovaného rollback balíka sa musia znovu overiť po samostatnom súhlase,
ešte pred reštartom aplikácie.

## Bezpečné doručenie príkazov

Operátor je prihlásený ako `seman`. Existujúce SSH oprávnenie k GitHubu
sa použije iba na stiahnutie pripnutého tooling commitu do dočasného adresára.
Produkčný checkout sa nepoužije na fetch, checkout, pull ani build.

Root proces cez sudo vytvorí iba nový dočasný staging adresár nástrojov v `/tmp`,
skopíruje sedem presne určených súborov a overí ich SHA-256 oproti manifestu
uvedenému v odovzdanom príkaze. Nespúšťa rootom kód z používateľom
zapisovateľného stagingu. Sudo je potrebné kvôli root-only tokenu a úplnej
kontrole procesov; práva produkčného tokenu sa nezmierňujú.

Dočasné tooling súbory nie sú zmenou produkčnej konfigurácie. Root staging
sa ponechá na presnej ceste `toolDirectory` uvedenej v JSON, aby sa po
vyhodnotení dal zostaviť presný budúci realizačný príkaz. Neobsahuje token,
OpenAI kľúč, DB snapshot ani vytvorenú zálohu.

## Neschválený budúci realizačný krok

Po vyhodnotení `READY` a samostatnom súhlase môže byť na konkrétny overený
`toolDirectory` naviazaný tento tvar príkazu:

```bash
sudo env -i PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin HOME=/root \
  /usr/bin/node "$TOOLS/script/ai-gateway-production.cjs" \
  --apply --approve CORPCRM01_GATEWAY_RUNTIME_CHANGE_APPROVED
```

**Teraz sa nesmie spustiť.** `TOOLS` musí byť konkrétny overený root staging
z preflightu, nie používateľom zapisovateľná kópia. Ak staging zanikne,
treba zopakovať bezpečné doručenie a preflight.

Plánovaný rozsah:

- súkromná záloha a kompletný vykonateľný rollback na `/dev/sdb1`;
- nový `/etc/indexus-ai-runtime/` root:seman 0750, jeho JSON 0640 a loader 0644;
- iba doplnenie preload argumentov do existujúceho ecosystemu a PM2 aplikácie;
- jeden cielený reštart `indexus-crm`, bez zásahu do root PM2;
- overené PM2 dump/backup súbory bez Gateway tokenu;
- nová `pm2-seman.service`, enabled bez spustenia služby a bez rebootu;
- žiadna zmena pôvodného `.env`, pôvodného tokenu alebo 65 OpenAI routov.

Tento runtime helper sám ešte nezapína Gateway v DB a zámerne končí
`RUNTIME_READY_OPENAI_ONLY_AWAITING_ADMIN_TESTS`.
Na finálny cieľ zostáva samostatný prihlásený administračný krok a schválené
syntetické text/JSON smoke testy pri stále nezmenených OpenAI routoch.

## Neschválený budúci rollback krok

Presná súkromná backup cesta vznikne až pri realizácii a bude v jej výsledku
`backup`. Neslobodno hádať adresár ani automaticky vyberať „najnovšiu“ zálohu.
Po dosadení tejto konkrétnej cesty bude príkaz:

```bash
sudo env -i PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin HOME=/root \
  /usr/bin/node "$BACKUP/rollback.cjs" \
  --approve CORPCRM01_GATEWAY_ROLLBACK_APPROVED
```

Rollback obnoví pôvodné Node argumenty, ecosystem a PM2 dump/backup, odstráni iba
nové vlastné súbory/jednotku a overí dostupnosť CRM a pôvodné OpenAI routy.
Ak bol medzičasom cez administráciu zapnutý DB flag Gateway, treba ho
cez tú istú administráciu vypnúť; helper neobchádza prihlásenie, nemení DB
ani nemaže audit. Pri zapnutom DB flagu vráti výslovné upozornenie
`ROLLBACK_RUNTIME_RESTORED_GATEWAY_DB_DISABLE_REQUIRED`.
