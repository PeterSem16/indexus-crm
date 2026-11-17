# email.sentiment – záverečné overenie a rozhodnutie

Dátum: 17. 11. 2026. Pokračovanie existujúcej integrácie, nie nová implementácia.

## Rozhodnutie

**REVIEW_REQUIRED – zatiaľ nie READY_FOR_PILOT.**

Podklad AI tímu dokladá podľa jeho vyjadrenia tri úspešné lokálne scenáre
NORMAL, ANGRY a INJECTION cez testovaciu Gateway. Nedokladá kompletný beh
z CRM, pôvodných 18 prípadov cez CRM ani kapacitu pri súbežnej záťaži.
Tieto výsledky sa nesmú zlúčiť so syntetickými CRM testmi do jedného
údajne živého end-to-end výsledku.

## Čo je na základe nového podkladu doplnené

1. **Dôvod manuálneho posúdenia.** Známa odpoveď o manipulácii súhlasom
   sa zachováva od Gateway adaptéra cez SDK až po CRM výsledok ako
   `reason: possible_prompt_injection_affected_consent_classification`.
   Surový vendor text sa nekopíruje. Nepodporovaný dôvod je výslovne
   `unspecified`, nie vymyslené vysvetlenie.
2. **Súbežné požiadavky.** Natívny lokálny HTTP test posiela tri skutočne
   sa prekrývajúce požiadavky s rôznymi výsledkami. Kontroluje, že výsledok
   so súhlasom nezamení manuálne posúdenie alebo neutrálny výsledok.
3. **Výpadkové odpovede.** Osobitné syntetické odpovede pre nedostupný
   adaptér a Ollama preverujú pôvodnú obchodnú vetvu bez obchodných účinkov,
   retries alebo externého fallbacku. Skutočné služby sa nevypínajú.
4. **Hranica poznámky.** Testy pokrývajú 100, 101 a 1000 znakov a odmietnutie
   1001 znakov. CRM limit zostáva 1000; Gateway limit 100 je jeho podmnožina.
   Platná odpoveď do 100 znakov je kompatibilná. Rozdiel však treba pred
   pilotom výslovne dohodnúť, nie skryť orezaním textu alebo zmenou pravidiel.

Historický výsledok 131 PASS patrí predchádzajúcemu izolovanému vydaniu.
Aktuálny výsledok rozšírenej sady a merania sú odovzdané samostatne;
žiadny fixture test nie je považovaný za výsledok reálneho modelu.

## Nové výsledky CRM

- **136 PASS / 0 FAIL / 0 SKIP** v rozšírenej izolovanej sade:
  37 testov `email.sentiment` a 99 regresných kontrol.
- Striktná TypeScript kontrola zmeneného jadra prešla.
- Backendový produkčný bundle selektívnej zostavy prešiel; existujúce
  upozornenia na import.meta a duplicitné mapovacie kľúče zostali.
- Skutočný lokálny HTTP test meral zdieľaný 30-sekundový deadline.
  Nejde o meranie výkonu živého modelu; konkrétne merania sú v odovzdanom
  reporte a uchovanom TAP výstupe.
- Žiadny test nenahrádza pôvodných 18 prípadov. Nevznikol nový referenčný
  korpus vydávaný za pôvodné prípady AI tímu.

## Akceptačná tabuľka

| Kritérium | Stav | Dôkaz / chýbajúci podklad |
|---|---|---|
| Kompletná cesta CRM → testovacia Gateway → adaptér → Ollama | NEOVERENÉ | Chýba schválená dosiahnuteľná testovacia trasa z CORPCRM01. |
| Pôvodných 18 prípadov a referencií | NEOVERENÉ | Nie sú súčasťou odovzdaných súborov. Nenahrádzať ich vlastným korpusom. |
| Service-scoped model, pôvodný prompt, striktný parser | OVERENÉ IZOLovane | Existujúca integrácia a automatizované fixture testy. |
| Zachovanie REVIEW_REQUIRED aj známeho dôvodu | OVERENÉ IZOLovane | Skutočný CRM analyzátor, Router, SDK a natívny lokálny HTTP transport. |
| Zákaz obchodných akcií a cloud fallbacku pri chybe | OVERENÉ IZOLovane | Pôvodná obchodná vetva zo zdrojového kódu a zákaz externého adaptéra. |
| Celkový CRM deadline 30 sekúnd | OVERENÉ IZOLovane | Spoločný SDK deadline zahŕňajúci discovery, inferenciu a čítanie odpovede. |
| Prevádzková záťaž pri nezmenených ostatných službách | NEOVERENÉ | Chýba schválená súbežnosť, počet pokusov, kapacitný dôkaz a testovacie okno. |
| Sémantika hasRudeExpressions a otázka verzus skutočná výpoveď | REVIEW_REQUIRED | Potrebný pôvodný text a vopred odsúhlasené referencie. |
| Slovenský jazyk skutočných poznámok | NEOVERENÉ | Vyžaduje kontrolu živých modelových výstupov. |
| Spravovaný adaptér, interná autentifikácia, dohľad a rollback | NEOVERENÉ | Podklad stále uvádza adaptér ako testovací proces. |
| Produkčné smerovanie email.sentiment | NEAKTIVOVANÉ | Nebol vykonaný žiadny produkčný zásah. |

## Blokátory živého testu

- Adresa `127.0.0.1:8771` patrí AI serveru; z CORPCRM01 ani Replitu neznamená
  prístup na túto Gateway. Podklad výslovne uvádza, že vzdialená trasa
  zatiaľ nie je pripravená.
- Nie je dodaná schválená HTTPS testovacia URL alebo presný schválený
  bezpečný tunel. Nevymýšľať verejný prefix, neotvárať port 8771
  a nepoužiť produkčný port 8770 namiesto testovacieho.
- Existujúci adaptér vyžaduje HTTPS. Ak navrhovaný tunel končí lokálnym
  HTTP, bez osobitne schváleného riešenia ho nemožno iba vložiť do
  konfigurácie alebo kvôli nemu rozvoľniť spoločné bezpečnostné pravidlá.
- Nie je dodaný pôvodný 18-prípadový korpus vrátane referencií a identifikácie
  jediného schváleného manuálneho posúdenia. Všetky očakávania musia byť
  stanovené pred inferenciou.
- Samostatná testovacia Gateway zdieľa s produkčnou cestou Ollama.
  Oddelenie portov samo osebe neznamená oddelenie výpočtovej kapacity.
  Záťažový profil a bezpečné okno musí potvrdiť AI tím.
- Nové odovzdanie neznamená povolenie vypnúť adaptér/Ollama používané
  produkciou kvôli fault testu. Ostré výpadkové scenáre vyžadujú izolovaný
  upstream alebo osobitne schválený postup bez zásahu do iných služieb.

## Úpravy a dohody požadované od AI tímu

1. Sprístupniť iba schválenú testovaciu trasu s autentifikáciou a rovnakým
   discovery/Chat Completions kontraktom ako existujúci interný adaptér.
   Zmeny produkčného tokenu, procesu 8770 ani jeho súboru nie sú povolené.
2. Potvrdiť pevný slovník `reason_code`. Súčasný dokumentovaný dôvod je
   podporený aj spätne kompatibilným presným mapovaním správy; nové dôvody
   sa nesmú preberať ako ľubovoľný zákaznícky text.
3. Dohodnúť limit poznámky. CRM vie prijať 100 znakov bez zmeny;
   testovanie musí odhaliť odmietnutie alebo skrátenie dlhšej poznámky
   na AI strane. Slovenský jazyk zostáva požiadavkou CRM.
4. Doložiť presné znenie prípadu ANGRY. Existujúci CRM prompt oddeľuje hnev
   od hrubých/nezdvorilých výrazov; samotná nespokojnosť tieto dva príznaky
   automaticky nestotožňuje. Bez úplného textu nemožno tento konkrétny výsledok
   vyhlásiť za správny ani svojvoľne zmeniť referenciu.
5. Pred pilotom pripraviť spravovanú službu adaptéra, chránenú internú
   komunikáciu, readiness, bezpečné logovanie, alerty, obmedzenie súbežnosti
   a test obnovy/rollbacku. Nemerané hodnoty kapacity zostávajú neznáme.

## Návrh bezpečného pilotu po splnení kritérií

1. Najprv jeden osobitne schválený, operátorsky spustený syntetický test
   z CORPCRM01 s izolovaným Routerom. Nemeniť uložené routy alebo
   administratívne nastavenia Gateway.
2. Spustiť nezmenených 18 referenčných prípadov, uložiť oddelene surovú
   klasifikáciu a výsledok CRM parsera, HTTP stav, trvanie, známy dôvod
   manuálneho posúdenia a technické zlyhania. Záznamy chrániť pred
   neoprávneným čítaním; tokeny ani hlavičky do reportu nepatria.
3. Až po úspešnom jednovláknovom teste vykonať dohodnutý konečný záťažový
   profil. Nepridávať retries, automatický cloud fallback ani svojvoľné
   zahriatie modelu. Pozorovanie ostatných služieb musí mať reálny dôkaz,
   nestačí tvrdenie o samostatnom porte.
4. V izolovanej testovacej infraštruktúre overiť neplatný token, nepovolený
   model, timeout, chybný/neúplný JSON a schválené výpadkové scenáre.
   V každom rizikovom stave sa musia zablokovať závislé obchodné akcie.
5. Výsledky vyhodnotiť voči referenciám vrátane manuálneho posúdenia
   slovenských poznámok a citlivých klasifikácií. Až potom možno predložiť
   nový verdikt READY_FOR_PILOT používateľovi.
6. Produkčný pilot nie je týmto povolený. Jeho budúci postup musí presne
   uviesť service-only zmenu a návrat na pôvodný route snapshot bez zmeny
   `email.monitoring`, spoločného endpointu alebo tokenu. Existujúci Router
   má service-level smerovanie; bez ďalšej implementácie nesľubovať
   percentuálny canary alebo per-mailbox rozdelenie.

**Nezmenené hranice:** žiadna zmena produkčného `main.py`, reštart 8770,
úprava tokenu, modelu `email.monitoring`, smerovania iných služieb alebo
automatická aktivácia `email.sentiment`.
