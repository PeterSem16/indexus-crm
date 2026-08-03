# Pricing Engine V2 — Stavový dokument

> Aktualizované: 3. 8. 2026  
> Podklad: `docs/analyza-cennik-produkty.txt` (analýza schválená 28. 7. 2026)  
> Súbor údržby: `.agents/memory/pricing-engine-v2.md`

---

## 1. Čo je Pricing Engine V2

Nový modul nahradí pôvodný modul **Products / Configurator**. Základná myšlienka: cena sa neskladá z „produktu", ale z **komponentov** (CB, PB, T\_CB, T\_PB, PL). Produkt je len pomenovaná množina komponentov; každá cena je odvoditeľná z kombinácie (komponenty × krajina × cenník × dĺžka skladovania × splátky × stav odberu). Tým sa dá automaticky vypočítať cena pre **akúkoľvek kombináciu nekompletného odberu** — to pôvodný modul nevie.

### Rozhodnutia (schválené, nemenné)

| # | Rozhodnutie |
|---|---|
| A | Nový modul **úplne nahradí** pôvodný Products modul (nie paralelne navždy) |
| B | Cenníky spravuje výhradne rola **Pricing Administrator** — nikto iný |
| C | **Grandfathering**: zákazník má vždy odkaz na verziu cenníka, podľa ktorej bol fakturovaný; historické cenníky sa nemažú |
| D | HU špecifiká sa riešia **override-mi v matici**, nie špeciálnym režimom |
| E | Nákladový hárok (marža) je súčasťou modulu od začiatku |
| F | Rovnaký engine sa použije **v oboch bodoch**: pri zápise výsledku odberu (BO/koordinátor) aj pri fakturácii |

---

## 2. Čo je hotové ✅

### 2.1 Dátový model (Fáza 1 — HOTOVO)
Nové tabuľky v databáze (prefix `pricing_*`), nedotýkajú sa pôvodných:

| Tabuľka | Popis |
|---|---|
| `pricing_products` | Produkty V2 (CLASSIC, PREMIUM, CLASSIC\_T, PREMIUM\_T, PLACENTA…) |
| `pricing_components` | Komponenty (CB, PB, T\_CB, T\_PB, PL) s poradím |
| `pricing_product_components` | Väzba produkt ↔ komponent |
| `pricing_price_lists` | Cenník per krajina + verzia (status: draft/active/archived), mena, FX kurz, inflačná sadzba, platnosť od |
| `pricing_collection_prices` | Cena odberu per produkt alebo komponent × cenník + `maxCollectionDiscountPct` |
| `pricing_storage_prices` | Cena skladného per produkt/komponent × rok × cenník |
| `pricing_storage_discounts` | Zľavy za predplatenie (10r./20r.) per cenník |
| `pricing_installment_plans` | Splátkové schémy per cenník (počet splátok + prirážka %) |
| `pricing_incomplete_rules` | Matica nekompletných odberov per cenník × produkt × maska komponentov |
| `pricing_adjustment_rules` | Pravidlá LOW\_VOLUME / CONTAMINATION / FLAT\_FEE per cenník |
| `pricing_product_costs` | Nákladové ceny (interné, pre maržu) |
| `pricing_customer_price_lists` | Grandfathering — zákazník ↔ verzia cenníka |

### 2.2 Výpočtový engine (`server/pricing-engine.ts`) — HOTOVO
Čisté TS funkcie bez DB závislostí, vždy vrátia **položkový rozpis** (line items) s odôvodnením:
- ✅ Nájde riadok v matici nekompletných odberov (alebo skladá zo standalone cien komponentov ako fallback)
- ✅ Aplikuje pravidlá: LOW\_VOLUME (s komponentovou podmienkou `appliesTo`), CONTAMINATION (100 % zľava z odberu kontaminovanej zložky), FLAT\_FEE (nič sa neodobralo)
- ✅ Skladné podľa reálne uskladnených komponentov + zľavy za predplatenie
- ✅ Splátkové schémy (prirážka %)
- ✅ FX prepočet na EUR
- ✅ Manuálna **zľava na odber produktu** (sales/BO, validovaná voči `maxCollectionDiscountPct`, audit trail)
- ✅ Manuálna **zľava na odber per komponent** (sales/BO, validovaná voči max per komponent, audit trail)

### 2.3 API (`server/pricing-routes.ts`) — HOTOVO
| Endpoint | Stav |
|---|---|
| `GET /api/pricing/products` | ✅ |
| `GET /api/pricing/components` | ✅ |
| `GET /api/pricing/price-lists` | ✅ (filter kraj/status) |
| `GET /api/pricing/price-lists/:id` | ✅ (celý bundle) |
| `POST /api/pricing/price-lists/:id/status` | ✅ draft→active→archived (+ archivuje predošlý aktívny) |
| `POST /api/pricing/price-lists/:id/duplicate` | ✅ |
| `DELETE /api/pricing/price-lists/:id` | ✅ (len draft) |
| `PATCH /api/pricing/price-lists/:id/prices` | ✅ (hromadná úprava + validácia stropov zliav) |
| `POST /api/pricing/price-lists/:id/incomplete-rules` | ✅ (pridanie nového riadku matice) |
| `POST /api/pricing/calculate` | ✅ (kalkulačka, vrátane komponentových zliav) |
| `GET /api/pricing/fx-rate/:currency` | ✅ (živý kurz z NBS) |
| `GET /api/pricing/inflation-rate/:countryCode/:year` | ✅ |
| `GET /api/pricing/costs` | ✅ (len Pricing Admin) |

### 2.4 Import z Excelu (`scripts/import-pricing-excel.ts`) — HOTOVO
- Importuje všetky krajiny (SK, CZ, HU, RO, IT, DE/AT) z `Cennik_nekompletnych_odberov_2026_*.xlsx`
- Wipe + reseed (bezpečné pokiaľ žiaden zákazník neodkazuje na cenník)
- Self-validácia: 4 kontrolné výpočty voči excelovým číslam
- Spúšťanie: `npx tsx scripts/import-pricing-excel.ts`

### 2.5 UI (`client/src/pages/pricing.tsx`) — HOTOVO (Fáza 2)
**Tab Cenníky:**
- ✅ Zoznam cenníkov s tab-filtrami per krajina (SK / CZ / HU / RO / IT / DE)
- ✅ Detail cenníka: ceny odberov produktov + komponentov (inline edit v draft režime)
- ✅ Ceny skladného per rok
- ✅ Splátkové plány (pridať / odobrať)
- ✅ Pravidlá úprav (FLAT\_FEE / CONTAMINATION / LOW\_VOLUME) so `appliesTo` multi-výberom (checkboxy)
- ✅ **Max. zľava na odber** per produkt / komponent (strop pre sales/BO): PL → max 5 %, ostatné → max 10 %, enforced client + server
- ✅ Workflow: draft → aktívny → archivovaný; kópia cenníka
- ✅ FX kurz sekcia (živý NBS / fixný)

**Tab Matica:**
- ✅ Zobrazenie matice nekompletných odberov per produkt (všetky kombinácie)
- ✅ Zobrazuje aj **draft cenníky** (nielen aktívne) — prepínač per krajina + per cenník ak je viac verzií
- ✅ **Nová kombinácia** — dialog na pridanie chýbajúceho riadku matice (len na draft cenníku, len Pricing Admin)
- ✅ Inline edit cien riadku matice
- ✅ Pravidlá úprav (FLAT\_FEE, CONTAMINATION, LOW\_VOLUME)

**Tab Kalkulačka:**
- ✅ Výber krajiny, produktu, odobratých komponentov (chip toggle)
- ✅ Kontaminácia per komponent (☣ toggle)
- ✅ LOW\_VOLUME prepínač (s opisom podmienky z cenníka)
- ✅ Roky skladovania
- ✅ **Splátkové plány**: dropdown zobrazuje **iba plány z aktívneho cenníka** danej krajiny (nie hardcoded 1/2/3/4/6/12) + prirážku % vedľa každej možnosti
- ✅ **Zľava na odber produktu** (slider 0 → max %) — zobrazí sa len ak je max > 0
- ✅ **Zľavy na odber komponentov** (slider per komponent 0 → max %) — zobrazí sa len ak komponent má nastavený max; sekcia "Sales / Back-office discounts"
- ✅ Výsledok: položkový rozpis + celková suma + inštalmentový harmonogram + tlačidlo Kopírovať

---

## 3. Čo NIE JE hotové — Ďalšie kroky 🔜

### Fáza 3 — Verziovanie a inflačná indexácia

| Úloha | Popis | Priorita |
|---|---|---|
| **Tlačidlo „Nový rok"** | Vytvorí draft kópiu aktívneho cenníka s indexovanými cenami skladného (vynásobí ceny inflačnou sadzbou cenníka). Pre AT/IT podmienka: len ak inflácia > 5 %. | Vysoká |
| **Zobrazenie histórie cenníkov** | V liste cenníkov per krajina zobraziť aj archivované verzie (skryté za toggle alebo záložka „História"). | Stredná |
| **EUR reporting** | V UI cenníka zobraziť ceny aj v EUR vedľa lokálnej meny (pre skupinový reporting). FX kurz je uložený. | Stredná |
| **Marža** | V UI zobraziť nákladovú cenu z `pricing_product_costs` a vypočítanú maržu per produkt/krajina. Kalkulačka môže voliteľne zobraziť aj maržu (len Pricing Admin). | Nízka |

### Fáza 4 — Nahradenie pôvodného modulu Products

Toto je najväčšia fáza. Existujúci modul má tieto väzby, ktoré treba preniesť:

| Pôvodná tabuľka / väzba | Čo treba urobiť |
|---|---|
| `customer_products` (zákazník ↔ produkt) | Pridať stĺpec `pricing_price_list_id` + `pricing_product_code`; pri novom zákazníkovi ukladať aj odkaz na aktívny cenník (grandfathering) |
| `contract_instance_products` + `priceSnapshot` | Nahradiť priceSnapshot JSON za `pricing_price_list_id` + uložený výsledok kalkulácie (line items JSON); engine vygeneruje rovnaký rozpis neskôr |
| `invoices.productId` | Pridať stĺpec `pricing_calc_snapshot` (JSON s položkovým rozpisom) vedľa stávajúceho productId počas prechodného obdobia |
| `deal_products` | Pridať odkaz na pricing produkt; dealová cena = výsledok kalkulácie |
| **UI: Zákazník — karta zákazníka** | Zobraziť objednaný produkt V2 (z pricing modulu) + cenu per komponent; pri zápise výsledku odberu (BO koordinátor) spustiť kalkuláciu a uložiť výsledok |
| **UI: Back Office** | Pri zobrazení BO úlohy zobraziť kalkuláciu ceny (pricing engine) na základe uloženého cenníka zákazníka a výsledku odberu |
| **UI: Faktúry** | Pri tvorbe faktúry použiť pricing engine na predvyplnenie položiek (collection + storage + zľavy) namiesto ručného zadávania |
| **UI: Pôvodný modul Products** | Po overení správnosti V2: schovať / vypnúť záložky pôvodného modulu (Products, Configurator, Product Sets) |

**Mapovacia tabuľka starý → nový produkt** (potrebná pre migráciu existujúcich zákazníkov):

| Pôvodný produkt | V2 kód |
|---|---|
| Classic | `CLASSIC` |
| Premium | `PREMIUM` |
| Classic + Tissue | `CLASSIC_T` |
| Premium + Tissue | `PREMIUM_T` |
| Placenta | `PLACENTA` |

### Ďalšie otvorené body

| Úloha | Popis |
|---|---|
| **Import historických cenníkov 2024** | Importovať aj predchádzajúcu verziu cenníka (valid\_from = 1.1.2024) aby grandfathering fungoval pre existujúcich zákazníkov od začiatku |
| **Validačná sada** | Rozšíriť self-validáciu importéra — pokryť všetkých 6 krajín a všetky typy pravidiel (kontaminácia, LOW\_VOLUME, FLAT\_FEE) |
| **Pricing Admin UI** | Správa rolí: priradiť rolu Pricing Administrator (dnes len cez DB); pridať do Users / Role management UI |
| **Notifikácia pri aktivácii** | Keď Pricing Admin aktivuje nový cenník, poslať e-mail / notifikáciu country manažérom že platí nový cenník od X dátumu |
| **Automatické grandfathering pri novom zákazníkovi** | Keď agent zapíše zákazníka + produkt, systém automaticky uloží aktuálny aktívny cenník krajiny zákazníka do `pricing_customer_price_lists` |

---

## 4. Technická poznámka — ako engine funguje

```
Vstup: countryCode, productCode, storageYears, installments?,
       collected[]?, contaminated[]?, lowVolume?,
       collectionDiscountPct?, componentDiscountPcts?{code: pct}

Postup:
  1. Nájdi riadok v pricing_incomplete_rules (orderedProduct × maska)
     → ak nenájde: sčítaj standalone ceny komponentov (fallback)
  2. Aplikuj per-komponentové zľavy (sales/BO, validácia voči max)
  3. Aplikuj product-level zľavu na odber (sales/BO)
  4. Kontaminácia: 100 % zľava z ceny odberu kontaminovanej zložky
  5. LOW_VOLUME: fixná zľava (len ak odobraté target komponenty)
  6. Žiadne komponenty → FLAT_FEE
  7. Skladné: reálne uskladnené komponenty × roky × cena
     + zľava za predplatenie (10r./20r.)
  8. FLAT_FEE / CONTAMINATION rules (percentuálne úpravy)
  9. Splátkový surcharge
 10. FX prepočet na EUR

Výstup: { lineItems[{kind, label, amount, currency, reason}],
          total, totalEur, warnings[], collectedMask, ... }
```

Všetky výpočty sú **auditovateľné** — každý `lineItem` má `reason` (prečo je táto položka v cene). To je požiadavka pre BO, zmluvy a fakturáciu.

---

## 5. Kde je kód

| Súbor | Obsah |
|---|---|
| `server/pricing-engine.ts` | Čistý výpočtový engine (bez DB) |
| `server/pricing-routes.ts` | Všetky `/api/pricing/*` endpointy + `loadPriceListBundle()` |
| `client/src/pages/pricing.tsx` | UI — záložky Cenníky / Matica / Kalkulačka |
| `scripts/import-pricing-excel.ts` | Import z Excel súboru |
| `shared/schema.ts` | DB schéma — tabuľky s prefixom `pricing_*` |
| `docs/analyza-cennik-produkty.txt` | Pôvodná analýza a rozhodnutia |

---

*Dokument je živý — aktualizovať pri každej ďalšej fáze.*
