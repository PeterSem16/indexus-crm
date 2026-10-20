# Status List: prevod existujúcich nastavení do jednotného editora

Tento prehľad sleduje **rozhranie**, nie pridávanie nových automatizačných
schopností. `status-list-automation-roadmap.md` je širšia funkčná roadmapa a
neurčuje automaticky poradie tejto prestavby.

## Dohodnuté hranice

- Postupne preniesť existujúce nastavenia do spoločného natívneho rozhrania.
- Umiestnenie do Acquisition / Contract / Retention a viditeľnosť sú prvé.
- Nevkladať celé staré formuláre pod nové nadpisy.
- Zachovať existujúce vykonávacie mechanizmy, uložené pravidlá a dáta.
- Uloženie konfigurácie nie je potvrdením odpovede ani opätovným spustením akcií.
- Doplnková úprava callbacku nemení dohodnuté poradie prestavby.
- Bez produkčného nasadenia a bez prenosu nesúvisiacich rozpracovaných zmien.

## Aktívne rozhranie

| Oblasť | Stav rozhrania |
| --- | --- |
| Umiestnenie a viditeľnosť | Spoločný krok otázkového editora. |
| Obsah otázky alebo podotázky | Spoločný otázkový editor vrátane vytvárania. |
| Typ odpovede a väzby | Vlastné zamerané kroky spoločného editora. |
| Servisné akcie otázok | Zoznam akcií a zameraný editor akcie. |
| Servisné akcie rýchlych možností | Rovnaký editor akcií, vložený priamo do osobitného editora výsledkového tlačidla; skratky status/callback otvoria parametre. |
| Vzhľad rýchlych možností | Voliteľná kurátorovaná Lucide ikona pred textom, rovnaký výber pri vytvorení aj úprave a živý náhľad; bez ikony je podporovaný pôvodný vzhľad. |
| Import dispozícií | Zameraný postup Výber → Kontrola → Výsledok; explicitné potvrdenie ukazuje nové kroky, zhodné kódy a skutočný rozsah kopírovania. |
| CLA/CLB/MPN šablóny | Zameraný postup Výber → Kontrola → Výsledok; samostatný výber krokov a akcií, automatické zahrnutie potrebných predkov, kontrola duplicitných kódov a výslovné potvrdenie prírastkov. |
| Interné pravidlá odpovedí | Existujúci editor WHEN / IF / THEN / ELSE; samostatný vykonávací mechanizmus zostáva zachovaný. |
| Systémové zdroje otázok | Prenesené z vloženého formulára do postupu Zdroj → Odpoveď → Vyhodnocovanie → Kontrola. |
| Systémové zdroje skupín možností | Rovnaký postup, vrátane mapovania výsledkov, osôb, kanálov a časových limitov. |

Pri zdrojoch zostávajú rovnaké API, typová kompatibilita, kontext vybranej
otázky/skupiny a pravidlá baseline/recovery. Vytvorenie chýbajúcej možnosti
„čaká sa“ je naďalej samostatný výslovne potvrdený úkon. Neuložený návrh
zdroja je chránený pri opustení kroku aj pracovného priestoru.

## Rozsah šablón

Šablóny zostávajú samostatným nástrojom, nie otázkou ani servisnou akciou.
Používajú pôvodné API pre pridanie krokov, ich voliteľných akcií a skutočných
podotázok. Výber sa zachováva osobitne pre CLA, CLB a MPN. Pred zápisom
sa kontroluje konkrétny plán a duplicitné kódy; existujúce dáta sa nemenia.
Rodičia sa pridávajú pred potomkami vrátane viacúrovňových väzieb.
Čiastočné výsledky rozlišujú vytvorený krok od dokončenia jeho akcií
a otázok. Opakovanie v tom istom otvorenom editore preskakuje potvrdené
prírastky, nie neisté výsledky po strate spojenia alebo obnovení stránky.

Žlté doplnenia používateľovho dokumentu Medical Partner Outpatient
Gynecologist v04 sú zapracované do existujúcej MPN banky: tri nové
odpovede dostupnosti kontaktu, dve pododpovede zvažovania spolupráce
a textová otázka na návrh nového kontaktu pri nesprávnom čísle.
Návrh kontaktu sa ukladá ako odpoveď Status Listu, nie prepis karty
ambulancie. Pokyny o piatich pokusoch, šiestich pracovných dňoch,
mesiaci a týždni sú obsahom šablóny; import neinštaluje nový vyhodnocovač
dostupnosti ani plánovacie pravidlá na existujúcich Mission.

Import naďalej používa pôvodné vytváranie jednotlivých krokov: kopíruje len
kód, názov a popis, s nepovinným rádio potvrdením, bez fázy a bez prenosu
akcií alebo rodičovských väzieb. Existujúce kroky sa nenahrádzajú. Pri
čiastočnom zlyhaní je viditeľný počet potvrdených prírastkov a tie sa pri
opakovaní v otvorenom editore neposielajú znova.

Tento zoznam nie je povolením automaticky meniť
prevádzkové pravidlá. Ďalšie pokračovanie má nadväzovať na zjednocovanie
existujúceho rozhrania, nie na poslednú doplnkovú funkciu.
