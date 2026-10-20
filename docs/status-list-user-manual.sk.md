# Status List — používateľský manuál

Tento návod je dostupný aj priamo v aplikácii cez **Pomoc a manuál**
v hlavičke Status Listu a v okne šablón. Interaktívna verzia obsahuje
osem kapitol, vyhľadávanie a preklady do všetkých siedmich jazykov.
Otvorenie návodu nemení konfiguráciu a nespúšťa akcie.

## 1. Kde začať

Otvorte **Mission → Nastavenia → Status List**:

- **Obsah:** kroky, doplňujúce otázky a rýchle tlačidlá.
- **Pravidlá:** automatizačné pravidlá.
- **Testy:** kontrola a dostupná diagnostika.
- **Nástroje:** banky šablón a importy.

Najprv určte, čo má agent vidieť, akú odpoveď potrebujete a čo má
nasledovať. Tvorba obsahu a konfigurácia automatických akcií sú
samostatné kroky. Začnite malou sadou a overte ju pred širším použitím.

## 2. Skratky a účel šablón

| Označenie | Účel |
| --- | --- |
| CL | Označenie checklistovej vetvy v názvoch šablón. |
| CLA / CL A | **Akvizícia:** získanie nového partnera od prvého kontaktu cez záujem a zmluvu po úvodné materiály. |
| CLB / CL B | **Retencia:** následná starostlivosť o existujúceho partnera, pravidelný kontakt a materiály. |
| MPN | **Medical Partner Network:** banka stavov a otázok o kontakte, spolupráci, zmluve a materiáloch siete medicínskych partnerov. Zahŕňa aj doplnenia dokumentu ambulantného gynekológa v04. |

**CLM nie je samostatná dostupná šablóna.** Výber obsahuje CLA, CLB a MPN.
Sú to banky obsahu, nie tri automaticky aktívne procesy.

**KO** = koordinátor; **BO** = Back Office; **SYS** = systémové označenie;
**DB Admin** = správca databázy; **HP** = poskytovateľ zdravotnej starostlivosti.
Rola v banke opisuje zamýšľanú zodpovednosť. Sama nenastavuje oprávnenia,
príjemcu úlohy ani vykonávanie na pozadí.

## 3. Krok, otázka a rýchle tlačidlo

**Krok** možno potvrdiť alebo rozvetviť. **Doplňujúca otázka** zbiera
konkrétnu odpoveď, napríklad návrh nového kontaktu. Podradené položky
rozbaľte šípkou; hierarchia zostáva zachovaná.

**Rýchle tlačidlo** je vizuálne odlíšená skratka pre častú voľbu,
napríklad preplánovanie hovoru. Nie je automaticky povinnou otázkou.
Názov tlačidla sám nevytvorí callback: rozhoduje uložená konfigurácia.

Fázy Akvizícia, Zmluva a Retencia organizujú obsah pre agenta.
Filter rýchlych tlačidiel ukazuje príslušné voľby. Filtre Viditeľné/Skryté
menia zobrazenie; skrytie položky neznamená vypnutie pravidla.

## 4. Použitie šablóny

1. V **Nástrojoch** otvorte šablóny a vyberte CLA, CLB alebo MPN.
2. Označte konkrétne kroky. Každá banka si počas otvorenia okna
   uchováva vlastný výber. Kontrola a použitie sa týkajú aktuálnej banky.
3. **Vybrať všetko** vyberá kroky, nie všetky akcie. Navrhnuté akcie
   rozbaľte a označte samostatne.
4. Potrební rodičia vybraných podkrokov sa zahrnú automaticky.
   Doplňujúce otázky patria k vybranému kroku.
5. V **Kontrole** prečítajte položky, rodičov, akcie a upozornenia.
6. Existujúci kód znamená **pridanie ďalšej položky**, nie zlúčenie
   ani aktualizáciu pôvodnej. Nechcené doplnenie odznačte po návrate.
7. Použitie vyžaduje výslovné potvrdenie. **Výsledok** ukazuje
   skutočne uložené kroky, akcie a otázky.
8. Pri čiastočnej chybe použite **Opakovať**; editor nadväzuje
   na potvrdené zápisy.

Import sám neposiela komunikáciu ani nemení karty ambulancií.
Mení však konfiguráciu Mission: vybrané akcie môžu reagovať
na neskoršie potvrdenia. Zmena banky spätne nemení staršie importy.

## 5. Úprava obsahu

V Obsahu vyberte položku v ľavom prehľade. Upravte názov, typ,
viditeľnosť, fázu a dostupné nastavenia a uložte zmenu.
Pri doplňujúcej otázke nastavte typ odpovede; poradie upravujte šípkami.

Mapovanie stavu ambulancie sa uplatňuje pri potvrdení príslušného
kroku pre ambulanciu. Samotné uloženie editora neprepíše jej stav.
Návrh nového kontaktu je odpoveď na overenie správcom, nie automatický
prepis telefónu.

Pri systémovo vyhodnocovaných položkách nastavte zdroj a podmienky
osobitne. Skrytie otázky samo nespustí vyhodnocovanie.

## 6. Automatizácia: čo naozaj funguje

Odlišujte **pôvodné akcie na potvrdenie** od **nových pravidiel**.
Nové pravidlo pôvodné akcie automaticky nenahradí. Skontrolujte
obe miesta, aby udalosť nevyvolala tú istú akciu dvakrát.

Pri pravidle nastavte:

- **KEDY:** zdroj udalosti;
- **AK:** podmienky;
- **POTOM**, prípadne **INAK:** vykonané akcie.

Skontrolujte zapnutie, cieľový záznam, príjemcu, skupinu, krajinu
a termín podľa použitej akcie.

Pokyny „+6 pracovných dní“, „po piatich pokusoch“ či „o mesiac“
môžu byť iba procesným opisom. Text, skrytý stav, rola ani SYS
nevytvárajú počítadlo, časovač, callback alebo eskaláciu.
Správanie musí zabezpečovať podporovaná, nastavená akcia alebo pravidlo.
Pri nesúlade textu a parametrov si funkčnosť nechajte preveriť;
neodhadujte ju podľa opisu.

## 7. Overenie a riešenie problémov

V Testoch a diagnostike skontrolujte konfiguráciu a podmienky.
Overte náhľad pre agenta, viditeľnosť, povinnosť odpovedí,
rodičovské väzby, príjemcov a termíny.
**Kontrola konfigurácie nie je dôkazom doručenia správy.**

Pred živým použitím overte celý priechod na bezpečnom testovacom
kontakte vrátane úlohy, callbacku alebo histórie.
Skutočné potvrdenie môže spustiť komunikáciu. Nepoužívajte
na pokusy reálne kontakty bez súhlasu.

- Chýba položka: skontrolujte fázu, viditeľnosť, hľadanie a rozbalenie rodiča.
- Chýba akcia: skontrolujte udalosť, podmienky, zapnutie, pôvodné akcie a diagnostiku.
- Opakovaný import celej banky nie je oprava: pridáva ďalšie položky.

## 8. Príklad: nesprávne číslo

V MPN vyberte **MPN-03e — Nesprávne číslo**. Zahrnie sa rodič
MPN-03 aj textová otázka na návrh kontaktu. Skontrolujte existujúce
kódy a použite iba potrebné doplnenie.

Agent zapíše odpoveď a prípadný návrh. Správca databázy ho má overiť.
Ak chcete automatickú úlohu pre správcu, nastavte a otestujte jej
akciu: samotné označenie DB Admin alebo text pokynu ju nezaručuje.
Nakoniec skontrolujte agentov náhľad.
