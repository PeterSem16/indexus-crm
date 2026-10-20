# Status List — kontrola pripravenosti a simulácia bez účinkov

## Umiestnenie a rozsah

V pracovnom priestore Status Listu otvorte **Testovanie a história**.
Kontrola prechodu je samostatná od existujúceho testu interného pravidla
a od histórie skutočných vykonaní.

Žiadne tlačidlo v **časti výpočtovej simulácie** neaktivuje pravidlá, nevytvára kandidátske
pravidlá, nemení odpovede, neplánuje skutočný callback ani neodosiela správu.
Výsledky simulácie sa nezapisujú medzi skutočné vykonania.

## Dva odlišné zdroje

- **Aktuálna konfigurácia:** čítanie databázy prostredia, v ktorom je aplikácia
  otvorená. Vývojová databáza nie je produkčná. Obnovenie načíta nový konzistentný
  konfiguračný snímok a zneplatní starý zobrazený výsledok.
- **Overená produkčná inventúra:** historický operátorský výpis Medical Partner
  Cooperation z 20. októbra 2026. Dostupný iba pri presnej identite tejto Mission.
  Nie je živým pripojením na CORPCRM01 ani dôkazom dnešnej konfigurácie.

Inventúra neobsahuje karty kontaktov, ich odpovede, texty správ, adresy
príjemcov, tokeny ani heslá. Konfiguračné odtlačky nie sú schválenie prechodu.
Odtlačok aktuálnej konfigurácie nepokrýva všetky externé závislosti; ich
overenie zostáva výslovne otvorenou bezpečnostnou bránou.

## Ako interpretovať skúšku

1. Vyberte zdroj údajov.
2. Vyberte jednu položku ako hypotetické potvrdenie.
3. Zadajte počet všetkých záznamov hovorov kontaktu.
4. Vyberte časový scenár a spustite výpočet.
5. Porovnajte pôvodný model a navrhovaný model.

Ostatné položky sa pri tejto udalosti nespúšťajú. Hraničná matica vyhodnocuje
každý riadok ako samostatné potvrdenie jeho vlastnej položky, nie ako jednu
udalosť spúšťajúcu celú kampaň.

**Zhoda modelov nie je zhoda dvoch vykonávacích mechanizmov.**
Navrhovaný model používa výpočtový kalendár; nejde o aktívny nový servisný
vykonávač. Skúška nepreukazuje doručenie, reťazenie, súbežnosť ani bezpečné
prevzatie čakajúcich udalostí.

Neznáma alebo neplatná podmienka sa označí ako nepodporovaná, nikdy ako „vždy“.
Podporovaný podmnožinový formát je explicitné AND/OR s číselnými podmienkami
`call_count` a operátormi `<`, `>`, `=`, `!=`, `>=`, `<=`.

## Medical Partner Cooperation

- Inventúra zachytáva 10 pôvodných akcií.
- Email MPN-05c je na výslovnú žiadosť používateľa vynechaný z prevodu.
  Samostatný callback MPN-05c zostáva zahrnutý.
- Vynechanie aktuálnej konfigurácie sa uplatní iba pri presnej Mission,
  identite akcie a nezmenenom odtlačku potvrdeného emailu. Zmena jeho
  konfigurácie vyžaduje nové posúdenie.
- Osem akcií zahŕňa callback; jedna ďalšia je nepodporované `notify_role`.
- MPN-01a: počet hovorov `< 1`; MPN-01b a MPN-02b: počet hovorov `> 1`.
  Pri presne jednom hovore nevyhovuje žiadna z týchto podmienok.
- Počet hovorov nie je počet po sebe idúcich neúspešných pokusov a nie je
  obmedzený na danú Mission. Žlté poznámky nemajú byť súčasťou tohto prevodu.
- Pôvodný kalendár používa pondelok–piatok bez sviatkov, Europe/Bratislava
  a predvolene 09:00. Platný ručný termín má prednosť. Existujúci callback
  sa prepisuje; kontakt sa priraďuje konajúcemu agentovi.
- Overená pôvodná serverová cesta nemá vykonávač `notify_role`. Vytvorenie
  funkčného upozornenia je nové správanie, nie verný prevod existujúcej akcie.

## Samostatné živé riadenie callbackov

Nad simuláciou je samostatné riadenie vlastníctva. Nasadenie, otvorenie stránky,
obnovenie aj GET požiadavky nemenia vlastníka a nevytvárajú kandidátov.
Podporovaná je iba presná Medical Partner Cooperation a jej osem pôvodných
callbackových akcií. Zvyšné dve akcie zostávajú pôvodné: email bez príjemcov
a `notify_role` bez nového vykonávača. Nevzniká nové upozorňovanie ani správanie
zo žltých poznámok.

Server číta aktuálnu databázu vlastného prostredia. Historický vzor, operátorský
export ani údaje poslané prehliadačom nemôžu schváliť prechod. Odtlačok zahŕňa
živú konfiguráciu, referencie, interné pravidlá, systémové zdroje a identitu DB
vrátane schémy. Aktívne/neznáme interné pravidlá, systémové zdroje, iné akcie,
nezhodné pôvodné parametre, chýbajúce referencie alebo čakajúce callbackové
udalosti prepnutie blokujú. Nenačítaná či neplatná odpoveď nie je stav „pripravené“.

Správca Mission musí mať prístup ku všetkým jej krajinám. Pred oboma smermi
prepnutia musí znovu skontrolovať živý stav, napísať presný názov Mission a
potvrdiť, že operátor overil súkromnú zálohu, návratový postup a rovnakú verziu
na **všetkých** produkčných pracovníkoch. Toto je priznanie správcu, nie
automatický dôkaz, že aplikácia zálohu vytvorila alebo overila.

POST znovu overí celý stav, očakávaného vlastníka a odtlačok. Má spoločný
transakčný zámok so zachytávaním a spracovaním udalostí a dočasné zámky nad
konfiguračnými tabuľkami, takže medzi poslednou kontrolou a commitom nemôže
prebehnúť nepozorovaná úprava. Dvaja schvaľujúci nemôžu schváliť dve prepnutia
z rovnakého pôvodného stavu. Pri konflikte sa kontrola opakuje; UI si nenechá
staré potvrdenie pre nový odtlačok.

Pri prechode sa uložia revidované kandidátske definície bez kopírovania kontaktov,
odpovedí či komunikácie. Kompatibilný vlastník používa tieto definície; pôvodný
vlastník používa živé pôvodné akcie. Obaja majú spoločný transakčný zápis callbacku
a trvalú deduplikáciu, nie dve súbežne aktívne kópie. Uložená pôvodná konfigurácia
sa nemaže ani nevypína. Zmena zdroja po schválení zablokuje nové kompatibilné
vykonanie, kým sa nesúlad nevyrieši.

### Trvalé udalosti a obnova

Nové používateľské potvrdenie v tejto Mission a jeho podporované callbackové
udalosti vznikajú v **jednej** transakcii. Rovnaké potvrdenie a akcia majú jedinú
identitu aj cez zmenu vlastníka. Do obálky sa zachytí pôvodca, počet všetkých
hovorov kontaktu, konfigurácia, termín a poznámka. Ručné „vykonať teraz“ používa
samostatnú identitu požiadavky; opakovanie tej istej identity nevytvorí ďalší
callback a zachováva pôvodné obídenie automatickej podmienky.

Spracovateľ zapisuje kontakt, históriu a dokončenie udalosti v jednej transakcii.
Pád pred commitom všetko vráti späť; pád po commite nemožno považovať za nové
vykonanie. Obnova kontroluje čakajúce udalosti každých päť sekúnd. Viacerí
pracovníci používajú databázové zámky a poradie udalostí toho istého kontaktu.
Pri prechodnej chybe zostáva udalosť čakajúca a bráni prepnutiu; neskrýva sa ako
úspešná. Nevykonávajú sa staré potvrdenia ani spätné dopĺňanie minulých udalostí.

Politika zachovania existujúceho callbacku je úplný no-op vrátane času úpravy,
pôvodcu, poznámky, zdroja a histórie. Návrat na pôvodného vlastníka používa rovnaké
brány a audit. Neobnovuje starú databázu a nemení už vytvorené callbacky.

### Postup po nasadení na CORPCRM01

1. Operátor overí zálohu a možnosť návratu; všetky procesy aktualizuje na rovnakú
   dokončenú verziu a reštartuje ich. Nepoužívať zmiešané staré a nové procesy.
2. Štart aplikácie vytvorí potrebné tabuľky idempotentne. `db:push` nie je potrebné.
   Vlastníctvo je stále pôvodné; kandidáti nevznikajú pri štarte.
3. Otvoriť príslušnú Mission → Status List → Testovanie a história. Živý panel
   na CORPCRM01 teraz číta produkciu, nie vývojový či historický snímok.
4. Ak sú zobrazené blokátory, neprepínať. Vyhodnotiť ich skutočný obsah bez
   mazania čakajúcich udalostí alebo obchádzania kontrol.
5. Pri pripravenom stave výslovne schváliť kompatibilného vlastníka a overiť
   nový stav aj audit. Nasadenie samo tento krok nerobí.
6. Na dohodnutom bezpečnom testovacom kontakte overiť výsledok v Queue a histórii.
   Kompletná prihlásená produkčná cesta tu vo vývoji nebola overená.

## Čo samotná simulácia stále nepreukazuje

Modelový výpočet sám neoveruje:

- rovnocennosť vykonávačov všetkých rodín servisných akcií;
- jediného vlastníka vykonania a trvalú deduplikáciu;
- rozpracované a odložené vykonania;
- referencie a externé závislosti;
- aktuálny produkčný konfiguračný odtlačok a bezpečné transakčné prepnutie.

Simulácia tieto brány neobchádza. Skutočné podporované prepnutie patrí výhradne
samostatnému živému panelu s aktuálnym serverovým overením.

## Technické kontroly

```bash
npx tsx shared/status-list-transition.test.ts
npx tsx server/lib/status-list-transition-inventory.test.ts
npx tsx server/lib/status-list-transition-route.test.ts
npx tsx server/lib/status-list-callback-compatible.test.ts
npx tsx server/lib/status-list-callback-transition.db.test.ts
npx playwright test --config e2e/status-transition.config.ts
npx playwright test --config e2e/status-callback-transition.config.ts
```

API používa existujúce oprávnenie správcu Mission, odpoveď `no-store`
a konzistentnú transakciu iba na čítanie ukončenú `ROLLBACK`.
