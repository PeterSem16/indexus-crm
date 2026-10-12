---
name: Automation notification editing
description: User-required modal, variable and template behavior for THEN Notify a user.
---

THEN „Notify a user“ má editor nadpisu a správy v samostatnom modálnom okne,
premenné pre obe polia a základné šablóny. Pomoc musí výslovne povedať,
že ide o interné upozornenie pod zvončekom a v centre notifikácií,
nie o e-mail, SMS, mobilný push alebo vytvorenie Tasku.

**Why:** Používateľ požiadal o vysvetlenie miesta zobrazenia a následne
o premenné, modálne okno a šablóny podobne ako pri Taskoch a e-mailoch.

**How to apply:** Šablóny notifikácií sú samostatný textový typ v Configuratore.
Výber vytvára upraviteľnú kópiu v pravidle; úpravy alebo vymazanie katalógu
nesmú prepísať uloženú kópiu. Zrušenie modálneho editora nesmie meniť rodičovský
draft. Premenné ponúkať podľa konkrétneho WHEN a nepodporované hodnoty jasne
označiť. Nové striktné vykresľovanie zapínať po vedomom použití editora,
nie pri zmene priority alebo obyčajnom uložení staršieho pravidla.

Používateľ požaduje prehľadné dva stĺpce a rovnaký dizajn modálneho
okna ako pri e-mailoch a Taskoch.

**Why:** Pôvodné úzke okno bolo neprehľadné a jeho vlastná vyššia vrstva
prekryla portálové výbery jazyka a šablóny.

**How to apply:** Zachovať spoločný systém vrstiev vnorených Task modálov,
na desktope oddeliť obsah od šablón a premenných a na mobile použiť jeden
stĺpec. Regresné testy musia načítať skutočné triedy rodičovského okna
pravidla, nie približný alebo chybne pomenovaný náhradný štýl.

Podmienky pôvodných pravidiel upozornení nemajú od používateľa vyžadovať JSON:
použiť zrozumiteľné výbery v spoločnom dizajne automatizácií. E-mail a SMS
vysvetliť a ponúknuť ako akcie všeobecných automatizácií, nie ako funkčné
prepínače v starom internom notifikačnom vykonávači.

**Why:** Používateľ žiada jednoduché, hravé ovládanie a dovolil presunúť
analýzu sentimentu/obsahu do všeobecných automatizácií. Staré uložené príznaky
kanálov samy neznamenajú, že vykonávač skutočne odosiela e-mail alebo SMS.

**How to apply:** Nikdy automaticky nemigrovať, nevypínať ani nerozširovať
existujúce pravidlá. Prechod otvorí nezávislý pozastavený návrh; externých
príjemcov treba vedome skontrolovať. Neznáme staré podmienky zachovať,
nie potichu zahodiť. Rozlišovať prijatie správy od dokončenej uloženej
analýzy, aby neutrálna správa so zámerom zrušenia nebola stratená ani
nevznikali predčasné alebo duplicitné akcie.
