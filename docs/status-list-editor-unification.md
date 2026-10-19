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
| Interné pravidlá odpovedí | Existujúci editor WHEN / IF / THEN / ELSE; samostatný vykonávací mechanizmus zostáva zachovaný. |
| Systémové zdroje otázok | Prenesené z vloženého formulára do postupu Zdroj → Odpoveď → Vyhodnocovanie → Kontrola. |
| Systémové zdroje skupín možností | Rovnaký postup, vrátane mapovania výsledkov, osôb, kanálov a časových limitov. |

Pri zdrojoch zostávajú rovnaké API, typová kompatibilita, kontext vybranej
otázky/skupiny a pravidlá baseline/recovery. Vytvorenie chýbajúcej možnosti
„čaká sa“ je naďalej samostatný výslovne potvrdený úkon. Neuložený návrh
zdroja je chránený pri opustení kroku aj pracovného priestoru.

## Zostávajúce aktívne výnimky

- Rýchle možnosti majú svoj osobitný inline editor; ich servisné akcie ešte
  používajú `AutomationForm`, na rozdiel od akcií otázok. Ich zjednotenie má
  zachovať zmysel výsledkových tlačidiel a existujúce správanie, nie pridávať
  ďalšie callback funkcie.
- Import dispozícií a aplikovanie CLA/CLB šablón sú osobitné nástroje s vlastnými
  dialógmi. Ich prípadná prestavba musí zachovať potvrdenie dopadu na existujúci
  Status List; nemá meniť alebo automaticky aplikovať obsah šablón.

Tento zoznam nie je povolením uvedené výnimky automaticky prerobiť ani meniť
prevádzkové pravidlá. Ďalšie pokračovanie má nadväzovať na zjednocovanie
existujúceho rozhrania, nie na poslednú doplnkovú funkciu.
