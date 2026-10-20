# Status List — kontrola pripravenosti a simulácia bez účinkov

## Umiestnenie a rozsah

V pracovnom priestore Status Listu otvorte **Testovanie a história**.
Kontrola prechodu je samostatná od existujúceho testu interného pravidla
a od histórie skutočných vykonaní.

Žiadne tlačidlo v tejto kontrole neaktivuje pravidlá, nevytvára kandidátske
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

## Prečo aktivácia zostáva zablokovaná

Pred prechodom treba doplniť a overiť:

- rovnocenný nový vykonávač servisných akcií;
- jediného vlastníka vykonania a trvalú deduplikáciu;
- rozpracované a odložené vykonania;
- referencie a externé závislosti;
- aktuálny produkčný konfiguračný odtlačok a bezpečné transakčné prepnutie.

Tento nástroj tieto brány neobchádza. Chýbajúce tabuľky automaticky nevytvára,
pôvodné pravidlá nevypína a historické udalosti neprehráva.

## Technické kontroly

```bash
npx tsx shared/status-list-transition.test.ts
npx tsx server/lib/status-list-transition-inventory.test.ts
npx tsx server/lib/status-list-transition-route.test.ts
npx playwright test --config e2e/status-transition.config.ts
```

API používa existujúce oprávnenie správcu Mission, odpoveď `no-store`
a konzistentnú transakciu iba na čítanie ukončenú `ROLLBACK`.
