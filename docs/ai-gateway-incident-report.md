# INDEXUS AI Gateway – technický report incidentu fázy A

**Stav: fáza A úspešne dokončená na CORPCRM01 podľa dodaného produkčného
výsledku. `RUNTIME_READY_OPENAI_ONLY_AWAITING_ADMIN_TESTS`.
Ďalší apply ani fáza B nie sú povolené.**

Tento dokument je aktuálny súhrnný report. Predchádzajúce realizačné bloky
a kontrolné súčty v starších dokumentoch sa na nový pokus nepoužijú.
Výsledok schválenej realizácie je doplnený v častiach 4 a 10.
Časti 8 a 9 zachovávajú historický postup pred realizáciou; teraz ich
neopakovať. Runtime a boot ciele už zámerne existujú, takže starý audit
neaplikovaného stavu už nie je vhodnou kontrolou úspešného nasadenia.

## 1. Rozsah a bezpečnostné hranice

- Žiadny ďalší `--apply`, reštart INDEXUS, fáza B ani inferencia.
- Zachovať 65 OpenAI routov, bez modelových overrides a bez aktivácie Gateway.
- Zachovať všetky tri súkromné zálohy, pôvodný token, `.env`, Git HEAD a produkčný build.
- Nepripájať sa z Replitu cez SSH. Produkčné čítacie príkazy vykonáva operátor
  v konzole CORPCRM01 ako `seman`.
- Dočasný tooling/test staging môže vzniknúť v `/tmp`; konfigurácia produkcie,
  databáza ani obsah záloh sa pri diagnostike nemenia. Bežné systémové logy
  môžu prirodzene vzniknúť.

## 2. Dva odlišné incidenty

### Prvý incident: vyhľadanie runuser

Potvrdené priamo sondou na CORPCRM01:

- `PATH=/usr/bin:/bin` -> `runuser` sa nespustil, ENOENT.
- Úplný systémový PATH vrátane sbin -> exit 0.
- Opravené obidve miesta: test nainštalovaného loadera aj následný syntetický
  test pri audite.

Pôvodná výnimka nebola zachovaná, ale chybný test by na tomto hoste nemohol
úspešne prejsť. Predchádzajúci rollback bol následne nezávisle overený:
`ROLLBACK_READ_ONLY_VERIFIED`, zachovaná konfigurácia a 65 OpenAI routov.

Overená staršia záloha:

```text
/var/www/indexus-crm/data/.ai-gateway-private/attempt-3b283b6f-f741-4eec-861b-d6cfcd6ee05e
```

### Druhý incident: chýbajúca závislosť testov v záložnom balíku

Posledný produkčný výstup:

```text
OPERATION_STOPPED
OPERATOR_COMMAND_FAILED
```

Nová záloha:

```text
/var/www/indexus-crm/data/.ai-gateway-private/attempt-69eff27f-e7d0-4d62-a7d1-37620c159054
```

**Presná lokálne reprodukovaná chyba:** do runtime testov bol pridaný test
konzolového launcheru. Tieto testy helper spúšťa zo záložného balíka, ktorý
obsahuje presne sedem súborov. Launcher `script/ai-gateway-preflight-console.sh`
medzi nimi nie je.

Konkrétny príkaz vykonávaný vo `verifyBackup`:

```text
/usr/bin/node --test /var/www/indexus-crm/data/.ai-gateway-private/attempt-69eff27f-e7d0-4d62-a7d1-37620c159054/bundle/script/ai-gateway-production.test.cjs /var/www/indexus-crm/data/.ai-gateway-private/attempt-69eff27f-e7d0-4d62-a7d1-37620c159054/bundle/script/ai-gateway-preflight.test.cjs
```

Pri lokálnom skopírovaní presne týchto siedmich zdrojov tento príkaz skončil
exit 1: 101 testov prešlo, jeden zlyhal. Zlyhal test:

```text
console launcher accepts only read-only modes and forwards the exact backup to root staging
```

Vnútorný Bash skončil exit 127, pretože launcher neexistoval.
V pracovnom repozitári existoval, takže pôvodná lokálna sada tento problém
nezachytila. Táto chyba bola zavedená doplnením testu pri úprave helpera.

Ide o preukázaný blokátor pôvodného balíka. Produkčné prehratie presného
archivovaného príkazu a jeho bezpečné zhrnutie zabezpečí nová diagnostika.
Bez jej výsledku netvrdíme, že poznáme prípadný ďalší skorší problém
produkčného prostredia.

## 3. Prečo výstup nepotvrdzuje automatický rollback

Pôvodný flow mal toto poradie:

```text
preflight -> backup -> verifyBackup -> try(install, loader test, restart, ...)
```

`verifyBackup` bol mimo vetvy, ktorá vykonáva automatický rollback.
Zlyhanie tu preto vracia všeobecnú chybu bez `APPLY_FAILED_ROLLBACK_VERIFIED`.
Nie je to samo osebe dôkaz, že rollback zlyhal; podľa reprodukcie sa
realizácia ešte nedostala k zmene živého runtime.

Tento záver musí pre produkciu potvrdiť manifest a porovnanie aktuálneho
stavu. Novú zálohu nepoužívať na manuálny rollback, kým jej overenie
neprešlo. Obe existujúce zálohy sa zachovávajú bez prepisovania.

## 4. Aktuálny stav produkcie po úspešnej fáze A

Zdrojom je dodaný úplný výsledný JSON apply a zakončenie schváleného bloku
`PHASE_A_FINISHED_STOP_BEFORE_PHASE_B`. Upload obsahuje iba koniec preflightu,
nie úplný úvodný audit či raw PM2 výpis. Výsledky nižšie rozlišujú priame
polia JSON od kontrol, ktoré musel overený helper úspešne dokončiť.

| Oblasť | Výsledok | Dôkaz |
|---|---|---|
| Fáza A | úspešná | konečný status v JSON |
| PM2/indexus-crm | online, cielený reštart prešiel | úspešné `verifyRuntime`/`verifyFinal` pred dokončením; nový PID nebol vypísaný |
| OpenAI routy | 65, routy nezmenené | `openaiRoutes:65`, `routesChanged:false` |
| Interné routy / overrides | 0 / 0 | úspešný finálny `assertRoutes`; kompletný aktuálny zoznam nie je v tomto uploade |
| Gateway v administrácii | vypnutá | povinná finálna kontrola `assertRoutes` |
| Runtime loader/config | nainštalované a overené | povinný loader test a kontrola nainštalovaných hashov |
| Ecosystem | schválene pridaný preload | povinné overenie; netvrdíme, že ecosystem zostal bajtovo nezmenený |
| PM2 prostredie a ostatné procesy | zachované podľa kontrol helpera | úspešné porovnanie runtime a PM2 dumpov; raw dump sa nezverejňuje |
| `.env` / pôvodný token | nezmenené | `originalDotenvUnchanged:true`, `originalTokenUnchanged:true` |
| Systemd boot jednotka | enabled, staticky overená, nespustená | `startup:enabled_static_verified_not_started` |
| Nová záloha | vytvorená, balík overený pred inštaláciou | identifikátor v časti 10; úspešný priechod `verifyBackup` |
| Rollback počas úspešného pokusu | nebol potrebný | normálny úspešný koniec, nie vetva obnovy |

Neoverené zostávajú reboot, prihlásené UI a Gateway konektivita/inferencia
cez administráciu INDEXUS. Úspešná fáza A nie je aktiváciou Gateway.

## 5. Vykonaná oprava

1. Test konzolového launcheru bol presunutý z runtime sady do samostatného
   `script/ai-gateway-release.test.cjs`.
2. Release sada vytvorí nový izolovaný adresár obsahujúci výhradne sedem
   položiek rollback manifestu a spustí v ňom úplné runtime/preflight testy.
   Launcher sa doň zámerne nepridáva.
3. Zachovaný sedemsúborový kontrakt a čitateľnosť pôvodných záloh.
   Ich obsah sa neprepisuje.
4. Zlyhanie overovania zálohy má teraz bezpečný samostatný výsledok:
   `BACKUP_VERIFICATION_FAILED_NO_RUNTIME_CHANGES`, konkrétny krok a bezpečný
   kód. Inštalácia ani automatický rollback z neovereného balíka sa nespustia.
5. Pridaný read-only režim `--inspect-attempt`, ktorý porovná neaplikovaný
   pokus s jeho snapshotom a použije tokenový dôkaz zo staršej overenej zálohy.
6. Diagnostika preverí aj systemd cez `systemctl show`, bez start/stop,
   a bezpečne zhrnie prehratie testov starého balíka bez výpisu raw TAP.
7. Čerstvý preflight sa spustí až po úspešnom overení neaplikovaného stavu.

Oprava nemení loader, práva tokenu, runtime politiku, modelový kontrakt,
produkčné piny, routy ani Gateway flag.

## 6. Overenie opravy

V pracovnom prostredí vykonané:

```bash
node --test \
  script/ai-gateway-production.test.cjs \
  script/ai-gateway-preflight.test.cjs \
  script/diagnose-ai-gateway-readonly.test.cjs \
  script/ai-gateway-release.test.cjs
```

Výsledok: **123 testov, 123 úspešných, 0 zlyhaní, 0 preskočených**.
Súčasťou je aj reálne spustenie runtime/preflight sady z izolovanej kópie
presne sedemsúborového artefaktu.

Pokryté sú: zastavenie pred runtime pri zlom balíku, zachovanie bezpečnej
diagnostiky, nezávislé porovnanie oboch záloh, odmietnutie čiastočnej
mutácie, neočakávanej aktívnej systemd jednotky, sanitizácia výsledkov
a zákaz apply/rollback v konzolovom launcheri.

## 7. Zdroj a kontrolné súčty

Publikované iba do `ops/ai-gateway-runtime-preparation-20261112`:

```text
2273b581395872fcd2040ab1f3975c815b136549
```

GitHub main zostal `52902d20b5bad42c60d543f365d33badae647f05`.
Po publikovaní bola overená bajtová zhoda všetkých šiestich zmenených/pridaných
zdrojov s GitHub stromom.

```text
510b56a7de59a8269c25e7629e638afb88e17691e3739e9dc4b407d97a6c48e0  script/ai-gateway-production.cjs
12ab915632d770059c6bccfbbd2862390479b1df0f31169e2d7e5d6d22463eae  script/lib/ai-gateway-policy.cjs
dee110afc6839de8e329828bb3dae6467775fd7bad3fb9c71ab55551d8ba34e4  script/lib/ai-gateway-host.cjs
763ae2451923696da555e7deb7ab100a212e02c2fc9c229046d6f136c676c828  script/ai-gateway-production.test.cjs
33af3aaff20605583f9152fcad2abe61ec0cef4c4ebe771e43f0cf7d87aa0fac  ops/ai-gateway/preload.cjs
8d4742c58ce035282d3d813b72038e0cf1b7ab7c2382ff60b92d1126b703c688  script/lib/ai-gateway-preflight.cjs
44d0f16556d89e72ce3a09465ae800ba89b13b7150934e25f94eeacfa0de8b40  script/ai-gateway-preflight.test.cjs
b4ef4c6592327486b5d80630039cee7d047ea04955340fdf55f36e15ab83a607  script/ai-gateway-preflight-console.sh
6c475b8906e28fd35420b2f5c06ffc2ec23cf63ffef8f5081373751fc41d3d54  script/ai-gateway-release.test.cjs
```

## 8. Historický čítací blok pred realizáciou – teraz neopakovať

Blok patril do konzoly CORPCRM01 ako `seman`, pred runtime inštaláciou.
Nie je určený na opakovanie po úspešnej fáze A.
Nič neaplikuje, nevykonáva rollback, nemení PM2/systemd/DB konfiguráciu a
nespúšťa inferencie. Overí oba archívy, aktuálny stav a prehrá iba syntetické
testy archivovaného balíka; testovacie súbory môžu vzniknúť v `/tmp`.
Ak je baseline neporušený, nasleduje preflight s tromi schválenými Gateway GET.

```bash
(
  set -euo pipefail
  test "$(id -un)" = seman
  REV=2273b581395872fcd2040ab1f3975c815b136549
  APP=/var/www/indexus-crm
  BACKUP=/var/www/indexus-crm/data/.ai-gateway-private/attempt-69eff27f-e7d0-4d62-a7d1-37620c159054
  BASELINE=/var/www/indexus-crm/data/.ai-gateway-private/attempt-3b283b6f-f741-4eec-861b-d6cfcd6ee05e
  export GIT_SSH_COMMAND="$(git -C "$APP" config --get core.sshCommand)"
  test -n "$GIT_SSH_COMMAND"
  ORIGIN="$(git -C "$APP" remote get-url origin)"
  SRC="$(mktemp -d /tmp/indexus-gateway-source.XXXXXX)"
  trap 'rm -rf -- "$SRC"' EXIT
  git -c init.templateDir= -c core.hooksPath=/dev/null init --quiet "$SRC"
  git -C "$SRC" remote add origin "$ORIGIN"
  git -C "$SRC" config remote.origin.promisor true
  git -C "$SRC" config remote.origin.partialclonefilter blob:none
  git -C "$SRC" -c core.hooksPath=/dev/null fetch --quiet --depth=1 \
    --filter=blob:none origin "$REV"
  test "$(git -C "$SRC" rev-parse FETCH_HEAD)" = "$REV"
  git -C "$SRC" -c core.hooksPath=/dev/null checkout --quiet FETCH_HEAD -- \
    script/ai-gateway-preflight-console.sh
  printf '%s  %s\n' \
    b4ef4c6592327486b5d80630039cee7d047ea04955340fdf55f36e15ab83a607 \
    "$SRC/script/ai-gateway-preflight-console.sh" | sha256sum --check --status
  PREFLIGHT_REV="$REV" PREFLIGHT_SOURCE="$SRC" \
    PREFLIGHT_MODE=inspect-attempt PREFLIGHT_BACKUP="$BACKUP" \
    PREFLIGHT_BASELINE_BACKUP="$BASELINE" \
    bash "$SRC/script/ai-gateway-preflight-console.sh"
)
```

Očakávané sú dva bezpečné JSON reporty:

1. `UNAPPLIED_ATTEMPT_READ_ONLY_VERIFIED`: pôvodné súbory a PM2 sú zachované,
   runtime/boot ciele neprítomné, systemd nová jednotka neregistrovaná,
   65 OpenAI routov, Gateway off. `rollbackNeededForRuntime:false`.
   V `bundle.replay` je pri reprodukcii starej chyby očakávaný exit 1 a
   `missingLauncherFailureReproduced:true`. Toto je zámerné prehratie
   chybnej starej sady, nie zlyhanie opravených release testov.
2. `READY`: nový úplný preflight, vrátane `unchangedAfterChecks.passed:true`.

Ak je stav `ATTEMPT_REQUIRES_REVIEW`, nič neopravovať automaticky. Výstup
obsahuje bezpečné `blockedBy` a dostupné príznaky. Preflight sa po takomto
výsledku automaticky nespustí. Neposielať celý manifest, snapshot, dump ani token.

## 9. Historický bezpečný postup úspešnej realizácie – neopakovať

Nasledujúci postup bol podkladom pre následné výslovné schválenie fázy A
vrátane jedného plánovaného reštartu. Používateľ potvrdil audit
`UNAPPLIED_ATTEMPT_READ_ONLY_VERIFIED`, `READY` a sedem overených SHA-256;
schválený staging bol `/tmp/indexus-gateway-tools.K45AIM`.
Realizačný blok znovu kontroloval integritu, audit a preflight pred apply.
Tento zoznam je historický, nie nový pokyn vykonať nasadenie.

1. Najprv vyhodnotiť oba produkčné JSON reporty z časti 8 a aktualizovať
   aktuálny stav v tomto reporte. Bez nich incident nie je uzavretý.
2. Ak sa potvrdí neaplikovaný baseline, rollback nie je potrebný. Zálohy
   ponechať súkromné a nedotknuté. Ak je odchýlka, pripraviť samostatnú
   opravu/rollback podľa konkrétnej odchýlky, bez automatického zásahu.
3. Predložiť výsledky na samostatné schválenie opakovania iba fázy A.
4. Po schválení použiť výhradne nový `toolDirectory` z reportov a znova
   overiť všetkých sedem SHA-256 a nezmenené východisko. Nepoužiť starý staging.
5. Povolený budúci rozsah fázy A: nová súkromná záloha na `/dev/sdb1`,
   reálne overenie samostatného rollback balíka, runtime loader/config,
   minimálny preload v ecosystem/PM2, jeden cielený reštart INDEXUS,
   overenie zachovaného prostredia/routov, PM2 dump bez tokenu a boot
   registrácia bez štartu systemd jednotky a bez rebootu.
6. Pri zlyhaní pred overením zálohy sa nesmie inštalovať ani reštartovať.
   Pri zlyhaní po začatí runtime inštalácie má helper použiť iba rollback
   balík nového pokusu, ktorý predtým úspešne overil.
7. Očakávaný koniec fázy A je
   `RUNTIME_READY_OPENAI_ONLY_AWAITING_ADMIN_TESTS`, nie aktivovaná Gateway.
   Požadovať nový backup identifikátor, zachovanie 65 routov, pôvodných
   tajomstiev a dostupnosti aplikácie.
8. Žiadne povolenie Gateway v administrácii, fáza B, inferencie alebo
   presmerovanie služby bez ďalšieho osobitného súhlasu.

Z Replitu sa na CORPCRM01 nevykonal žiadny príkaz. Schválenú realizáciu
vykonal operátor. Ďalší apply ani ručný rollback sa teraz nevykonáva.

## 10. Výsledok produkčnej realizácie fázy A

Dodané operátorom 2026-11-12:

```json
{
  "status": "RUNTIME_READY_OPENAI_ONLY_AWAITING_ADMIN_TESTS",
  "backup": "/var/www/indexus-crm/data/.ai-gateway-private/attempt-985f17e6-82ec-47ec-afb7-6242af5884f9",
  "openaiRoutes": 65,
  "routesChanged": false,
  "originalDotenvUnchanged": true,
  "originalTokenUnchanged": true,
  "gatewayRequests": 0,
  "startup": "enabled_static_verified_not_started",
  "rebootTest": "not_performed",
  "signedInUI": "not_verified",
  "gatewayConnectivity": "not_run",
  "gatewaySmoke": "not_run"
}
```

Konzola následne vypísala `PHASE_A_FINISHED_STOP_BEFORE_PHASE_B` a vrátila
operátora do shellu. V dodanom výsledku nie je hlásená chyba apply.

### Záloha a rollback

Nová súkromná záloha:

```text
/var/www/indexus-crm/data/.ai-gateway-private/attempt-985f17e6-82ec-47ec-afb7-6242af5884f9
```

Úspešné dokončenie je možné až po overení zálohy, ochrany pred čítaním
neoprávneným používateľom a testov samostatného rollback balíka.
Neznamená to, že bola nasimulovaná reálna obnova živej produkcie:
pri tomto úspešnom pokuse sa rollback nespúšťal.

Polia `actualBackupVerified:false` a `actualRollbackTested:false` vo
viditeľnom konci **preflightu** opisujú stav pred vytvorením tejto novej
zálohy. Nie sú výsledkom následného úspešného `verifyBackup` v apply.
Obe staršie zálohy sa nemažú; nový helper ich pri úspešnom apply neprepisuje.

### Sieťové kontroly a hranice overenia

- Preflight: TLS overené a tri Gateway GET s HTTP 200
  (`health/ready`, `v1/models`, `indexus/v1/capabilities`).
- Apply: `gatewayRequests:0`. Nie je to nulový počet GET za celú reláciu;
  ide o nulový počet požiadaviek v samotnej realizačnej fáze.
- Inferenčné testy sa nespúšťali. Model a deklarácia text/JSON kontraktu
  boli objavené GET kontrolami, nie úspešnou generáciou.
- Reboot nebol vykonaný; enabled boot jednotka zatiaľ nedokazuje
  úspešné spustenie po reštarte servera.
- Prihlásené UI a admin connectivity/smoke neboli overené.
- V aktuálnom uploade nie je nový PID, úplný PM2 stav ani celý úvodný audit.
  Neuvádzame ich ako samostatne získané výpisy.

### Uzavretie fázy A

Technický cieľ fázy A bol dosiahnutý: runtime je pripravený, existujúcich
65 routov zostáva na OpenAI a Gateway v administrácii zostáva vypnutá.
Nejde o stav `GATEWAY_READY_OPENAI_ACTIVE`.

**Zastaviť ďalšie produkčné zmeny. Fáza B nie je schválená.**
Rozsah administrátorských a integračných testov je pripravený v
[`docs/ai-gateway-phase-b-test-plan.md`](ai-gateway-phase-b-test-plan.md).
Plán prípravy nenahrádza výslovné schválenie ich produkčného vykonania.
