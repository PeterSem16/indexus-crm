# Výsledok read-only kontroly historických návrhov v Microsoft 365

## Rozsah a pôvod dôkazov

Používateľ osobitne schválil **iba čítanie** Microsoft 365. Oprávnený
operátor následne spustil kontrolu priamo na externom CORPCRM01 a vrátil
anonymizovaný súhrn. Agent nepristupoval na server cez SSH a nečítal tokeny,
adresátov, telá správ ani súkromný report. Nešlo o nasadenie aplikácie.

Posledné spustenie použilo pripnutý operátorský commit
`0220e8d8b147913bc594ad9b36e16199bee44643`; operátor potvrdil úspešné
kontrolné súčty všetkých piatich spúšťaných zdrojových súborov.
Konečný odtlačok výsledku:

```text
c31317fb4c168653643931c8b05960a74bc2a4b0b342adf3954ab18c28dae1c6
```

Presný čas kontroly, lokálne ID záznamov a providerové kandidátske časy sú
iba v súkromnom reporte na CORPCRM01:
`/var/tmp/indexus-ms365.sspztm/candidates.json`. Tento súbor nie je určený
na vloženie do chatu alebo zverejnenie.

Kontrolovaná pôvodná dávka obsahuje **38 nepriradených aplikačných záznamov
pre 34 kliník**. Samostatný už priradený záznam z predchádzajúceho
individuálneho auditu nebol do dávky zahrnutý. Read-only kontrola nevyžadovala
ani nevytvorila priradenie tejto dávky k Mission.

## Konečné zistenia

| Kontrola | Počet |
| --- | ---: |
| Kontrolované aplikačné záznamy | 38 |
| Kliniky v dávke | 34 |
| Úspešne načítané vyhľadania konverzácií v povolených Sent Items | 38 |
| Záznamy s nájdenou odoslanou položkou | 38 |
| Z toho po filtri rovnakej konverzácie a predmetu | 38 |
| Z toho po filtri rovnakého `from` a povoleného `sender` | 38 |
| Z toho po filtri úplných To/CC/BCC a platného providerového času | 38 |
| Z toho s presne rovnakým telom ako v aplikácii | 0 |
| Záznamy vyžadujúce obsahové overenie rozdielneho tela | 38 |
| Jednoznačné úplné strojové zhody | 0 |
| Preukázané konkrétne časy odoslania | 0 |
| Časy ponechané neznáme | 38 |
| Databázové zápisy | 0 |

Ide o po sebe idúce filtre nad tými istými položkami. Počet 38 pri
jednotlivom filtri znamená, že každý aplikačný záznam má **aspoň jedného**
takého kandidáta. **Nie je to dôkaz 38 rôznych transmisii ani jedinečnosti
kandidáta pre každý záznam.** `uniqueCandidates: 0` označuje nulový počet
úplných presných zhôd, nie nulový počet odoslaných e-mailov.

Konečný dôvod pri všetkých záznamoch:
`EXACT_BODY_DIFFERENCE_REQUIRES_REVIEW`.
Predchádzajúca kontrola mala aj dve sieťové chyby; konečná kontrola prešla
všetkých 38 vyhľadaní a nevrátila žiadny sieťový chybový dôvod.

## Čo zostáva nepreukázané

Rozdiel tela môže súvisieť s úpravou HTML pri spracovaní Microsoft 365,
ale tento súhrn **nepreukazuje**, že ide iba o formátovanie. Obsah sa
nevyžiadal do chatu a žiadna normalizácia nebola použitá ako náhrada dôkazu.

Zhodné uložené adresy a identita odosielania nie sú nezávislým potvrdením
historickej príslušnosti adresátov ku klinike. Zhoda konverzácie, predmetu,
odosielateľa a adresátov bez obsahového overenia účelu/príloh nestačí
na označenie providerovej položky za konkrétny návrh z aplikačného záznamu.
Zistené hashe príloh sú pozorované vlastnosti kandidáta, nie nezávisle
preskúmané očakávané hashe pôvodného návrhu.

## Rozhodnutie

Read-only preverenie celej dávky je vykonané s výsledkom **nepreukázané**.
`sent_at`, provider, externé ID, `campaign_id`, `created_at`, pôvodný autor,
Status List a automatizácie neboli zmenené. Neboli odoslané e-maily,
obnovené/zapísané tokeny ani použité náhradné dátumy z `created_at`.

**Nenavrhuje sa aplikovať žiadny timestamp backfill**, keďže nie je žiadny
`verified` výsledok. Všetkých 38 časov zostáva neznámych. Toto rozhodnutie
neznamená, že návrhy neboli odoslané alebo že kandidátske providerové časy
sú nesprávne; znamená, že ich príslušnosť ku konkrétnemu návrhu nie je
dostatočne doložená.

Ak sa má pokračovať nad tento nejednoznačný výsledok, oprávnený kontrolór
musí lokálne preskúmať kandidátske telá a originálne prílohy/účel, historickú
klinickú identitu aj prípadné duplicitné transmisie. Až po jednoznačnom
preukázaní možno podľa [postupu](verify-mission-proposal-times.md) predložiť
cielený auditovaný návrh opravy s novým odtlačkom a samostatným súhlasom
na zápis. Tento výsledok takýto zápis ani rozšírenie prístupu neoprávňuje.
