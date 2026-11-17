# email.sentiment – návrh testovacej trasy a záťaže

**Len návrh na technické overenie a schválenie. Nič z tohto dokumentu nebolo
vykonané.** Produkčná Gateway, Ollama, tokeny, routy a `email.monitoring`
zostávajú bez zmeny.

## 1. Aktuálny stav

AI tím potvrdil funkčnosť testovacej Gateway na loopback porte 8771,
adaptéra 8792 a modelu `indexus-email-sentiment:4b`. Tri lokálne scenáre
majú podľa dodaného podkladu výsledok 3 PASS / 0 FAIL. Vzdialená testovacia
trasa z CORPCRM01 zatiaľ nie je schválená.

Pôvodných 18 správ a ich čiastkové referencie sú už súčasťou regresného
balíka. Netreba ich opakovane vyžadovať. Pôvodný Python `SYSTEM_PROMPT`
nie je v podkladoch; CRM testy používajú existujúci CRM prompt, nie jeho
domyslenú kópiu z AI servera.

## 2. Návrh SSH trasy

### Preferovaná architektúra

Izolovaný testovací klient na CORPCRM01 → HTTPS so zachovanou validáciou
certifikátu → lokálne viazaný SSH forward → osobitný testovací TLS vstup
na AI serveri → testovacia Gateway HTTP 8771 → adaptér 8792 → Ollama.

Existujúci CRM Gateway adaptér vyžaduje HTTPS. Priame vloženie
`http://127.0.0.1:<forwarded-port>` do jeho konfigurácie teda nie je
schváleným ani technicky kompatibilným riešením. Šifrovaný SSH tunel sám
osebe nemení protokol, ktorý vidí HTTP klient.

Preferujeme zachovať existujúcu HTTPS ochranu a pripraviť osobitný
testovací TLS vstup, nie povoľovať HTTP pre spoločný adaptér.
Jeho vytvorenie alebo zmena testovacej služby **vyžaduje ďalšie schválenie**;
nejde o už existujúci endpoint. Konkrétne porty, meno certifikátu a
spôsob tunelovania musí potvrdiť AI tím.

### Požadované ochrany

- SSH spojenie iniciovať len z CORPCRM01 cez existujúci schválený účet
  a správu kľúčov. Nežiadať kľúč ani token cez chat.
- Overiť a pripnúť host key. Žiadne `StrictHostKeyChecking=no`,
  agent forwarding alebo verejne viazaný forward.
- Forward viazať výhradne na loopback a serverové oprávnenie obmedziť
  na konkrétny testovací cieľ; žiadny dynamický alebo reverzný verejný proxy.
- Nepovoliť listener 8771 na LAN a nemeniť firewall bez osobitného súhlasu.
- TLS musí overovať schválené meno certifikátu a dôveryhodnú CA.
  Žiadne `rejectUnauthorized=false`, `NODE_TLS_REJECT_UNAUTHORIZED=0`
  alebo `curl -k`. Nedomýšľať certifikát ani DNS meno.
- Ak je potrebné lokálne mapovanie mena na tunel, navrhnúť ho len pre
  testovací proces, so zachovaným SNI a validáciou mena. Nemeniť globálny
  DNS alebo `/etc/hosts` produkčného servera.
- Zachovať Bearer autentifikáciu testovacej Gateway. Platnosť produkčného
  tokenu na testovacej Gateway sa nesmie predpokladať a produkčný token
  sa nemení. Poverenia sa neposielajú do Replitu a nezapisujú do reportu.
- Použiť iba in-memory konfiguráciu izolovaného Routera, nikdy uložený
  produkčný route alebo globálnu base URL.

### Poradie budúceho technického overenia

1. Schváliť konkrétnu trasu, TLS riešenie, účty, ciele a spôsob ukončenia.
2. Po súhlase overiť SSH host key, viazanie iba na loopback, TLS meno/CA
   a jednoznačné smerovanie výhradne na testovaciu službu.
3. Bez inferencie overiť readiness, models a capabilities a odmietnutie
   neplatnej autentifikácie; pri žiadnom teste nesmie uniknúť token.
4. V izolovanom Routeri vykonať schválený sériový regresný profil.
5. Ukončiť dočasný tunel/TLS wrapper podľa schváleného vlastníctva,
   potvrdiť zánik iba jeho listenerov a porovnať produkčné nastavenia.

Alternatívou pri neuskutočniteľnom TLS riešení by bola explicitne schválená,
úzko ohraničená zmena iba testovacieho klienta. Taká výnimka sa teraz
neimplementuje a nesmie rozvoľniť spoločný runtime alebo `email.monitoring`.

## 3. Návrh konečného testovacieho profilu

**Nejde o súhlas na vykonanie. Žiadne súbežné modelové volania sa teraz
nespúšťajú.** Aj po schválení trasy musí AI tím osobitne schváliť tento
profil alebo jeho presnú upravenú verziu.

| Fáza | Súbežnosť | Požiadavky | Intervaly | Maximálne trvanie |
|---|---:|---:|---|---:|
| Pasívna východisková kontrola | 0 testovacích inferencií | 0 | existujúca telemetria každých 5 s | 5 min |
| A: pôvodný regresný korpus | 1 | presne 18 | min. 1 s po ukončení predchádzajúcej | 10 min |
| Kontrola pred zvýšením záťaže | 0 | 0 | vyhodnotenie A a telemetrie | 1 min |
| B: obmedzený súbeh | najviac 2 | presne 6 v troch dvojiciach | min. 2 s po ukončení celej dvojice | 2 min |
| Pasívna následná kontrola | 0 | 0 | existujúca telemetria každých 5 s | 5 min |

Celý profil má pevný strop **25 minút**, z toho najviac **24 modelových
pokusov**. Discovery/auth kontroly sú samostatne evidované HTTP operácie,
nie inferencie. Neexistujú dodatočné zahrievacie požiadavky ani retries.

Pre fázu B navrhujeme dvojice K01/EN, K03/K06 a K09/K12. Sú to osobitne
plánované záťažové pokusy s vlastnými identifikátormi, nie automatické
opakovanie nepodarenej regresie. Ich odpovede sa nemiešajú s pôvodným
18-prípadovým regresným výsledkom.

Každá inferencia má jeden celkový deadline **30 000 ms** od vstupu
izolovaného CRM klienta do request cesty vrátane discovery a čítania
odpovede. Plán meria aj pozorovanú réžiu návratu po abort; nepovolí nový
30-sekundový limit na každý endpoint.

### Stop podmienky

- Akákoľvek nečakaná produkčná chyba, timeout alebo zmena dostupnosti
  `email.monitoring`: okamžite zastaviť spúšťanie ďalších pokusov.
- Ak nie je možné sledovať vplyv na `email.monitoring`, fázu B nezačať.
- Nárast jeho porovnateľnej P95 latencie o viac než 20 % oproti vopred
  uloženému východisku, ak je dostupných aspoň 20 relevantných meraní.
  Pri nedostatočných dátach nezamieňať neznámy dopad za nulový; B nepovoliť
  bez iného vopred schváleného dôkazu izolovanej kapacity.
- Akékoľvek nové OOM, kritický zdrojový alarm alebo neobvyklý nárast
  produkčného backlogu oproti vopred zdokumentovanej hranici: stop.
- Akýkoľvek timeout, transportná chyba, 5xx, neplatný JSON alebo nečakaná
  klasifikačná odchýlka vo fáze A: B nezačať.
- Falošný súhlas, falošná výpoveď alebo obchodný účinok pri chybe:
  okamžitý stop bez ďalšej inferencie.
- K12 REVIEW_REQUIRED je povolené bezpečné odmietnutie, nie technický
  úspech deväťpoľovej odpovede ani automatická stop príčina.
- Pri stop nevykonávať retries. Už rozbehnuté požiadavky zrušiť alebo
  ohraničiť ich zostávajúcim deadline, zaznamenať neisté upstream dokončenie
  a nespúšťať nový pokus za účelom získania chýbajúceho výsledku.
- Ak sa prekročí časový alebo početný strop fázy/profilu, ďalšie prípady
  ostávajú nevykonané a výsledok nie je úplný.

### Monitoring vplyvu

Pasívne zaznamenávať iba už dostupné a schválené metriky: úspešnosť,
timeouty a end-to-end trvanie `email.monitoring`, backlog/pending prácu,
latencie a frontu Gateway/Ollama a pamäť/akcelerátor podľa dostupnej
telemetrie. Uchovať časové okná a východisko, nie obsah e-mailov alebo tokeny.

Nevytvárať kontrolné zákaznícke inferencie na `email.monitoring` a nemeniť
jeho intervaly kvôli benchmarku. Ak v okne nie je relevantná aktivita
alebo pozorovateľnosť, vplyv ostáva **NEOVERENÝ**, nie „bez dopadu“.

Oddelená Gateway zdieľa Ollama a nezaručuje nezmenenú produkčnú odozvu.
Ak AI tím nevie zaručiť bezpečný kapacitný profil, súbeh sa môže testovať
iba na samostatných schválených výpočtových zdrojoch; inak fázu B nevykonať.

## 4. Zostávajúce blokátory

1. Technicky overená a výslovne schválená sieťová/TLS trasa.
2. Potvrdená autentifikácia testovacej Gateway a spôsob bezpečného načítania
   poverení bez zmeny produkčného tokenu.
3. Schválený záťažový profil, okno, telemetria a stop hranice.
4. Skutočný 18-prípadový výsledok z CRM a manuálne posúdenie potrebných
   poznámok; tieto odpovede zatiaľ nie sú k dispozícii.
5. Dohoda o poznámke (Gateway 100, CRM 1000), prevádzkové zabezpečenie
   adaptéra a rollback pred budúcim pilotom.

Korpus už **nie je blokátorom**. Sieťový návrh a záťažový návrh zostávajú
neschválené; aktuálny verdikt naďalej **REVIEW_REQUIRED**.
