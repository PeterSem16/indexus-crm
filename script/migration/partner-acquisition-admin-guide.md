# Partner Acquisition — Návod pre správcu kampane

## Kompletný postup: od vytvorenia po spustenie

---

## KROK 1: Otvorenie kampane

1. V menu kliknite na **Campaigns** (NEXUS Pulse)
2. Nájdite kampaň **"Partner Acquisition — Collaborator Onboarding"**
3. Kliknite na ňu — otvorí sa detail kampane
4. Kampaň je v stave **Draft** — ešte nie je aktívna

---

## KROK 2: Nastavenie krajín

1. Prejdite na tab **Settings** (Nastavenia)
2. V sekcii **Countries** (Krajiny) vyberte krajiny, pre ktoré kampaň beží
   - SK, CZ, HU, RO, IT, DE — podľa potreby
3. Uložte zmeny

---

## KROK 3: Priradenie operátorov

1. V tabe **Settings** → sekcia **Operators** (Operátori)
2. Kliknite **Add Operator** (Pridať operátora)
3. Pre každého agenta nastavte:
   - **Krajiny** — ktoré krajiny bude obslúhovať
   - **Workload Weight** — záťaž (100 = normálna, 50 = polovičná)
   - **Max kontaktov za deň** — napr. 50
4. Uložte zmeny

---

## KROK 4: Nahranie kontaktov

Kontakty sa dajú pridať troma spôsobmi:

### Spôsob A: Import z CSV/Excel (odporúčaný pre prvé nahratie)

1. Prejdite na tab **Contacts** (Kontakty)
2. Kliknite **Import**
3. Nahrajte CSV/Excel súbor s kontaktmi
4. Namapujte stĺpce:
   - Meno, Priezvisko, Telefón, Email, Mesto, Krajina
5. Potvrďte import
6. Systém vytvorí kontakty v stave **Pending** (Čakajúci)

### Spôsob B: Criteria Builder (automatický výber z databázy)

1. V tabe **Settings** → **Contacts** → **Contact Criteria**
2. Nastavte filtrovacie pravidlá, napr.:
   - Typ: Collaborator (Spolupracovník)
   - Krajina: SK
   - Status: nie je aktívny partner
3. Kliknite **Sync Contacts** — systém automaticky natiahne zodpovedajúce kontakty

### Spôsob C: Manuálne pridanie

1. V tabe **Contacts** kliknite **Add Contact**
2. Vyhľadajte kontakt v databáze
3. Priraďte ho ku kampani

---

## KROK 5: Nastavenie fáz kampane

Kampaň má 8 preddefinovaných fáz. Pre každú fázu:

1. Prejdite na tab **Phases** (Fázy)
2. Uvidíte 8 fáz v stave **Draft**:

| # | Fáza | Typ | Čo sa deje |
|---|------|-----|------------|
| 1 | Outreach — Email 1 / List 1 | Email | Prvé oslovenie |
| 2 | Contact — Call 1 | Phone | Prvý telefonát |
| 3 | Interest Qualification — Call 2 + Email 2 | Phone | Kvalifikácia záujmu |
| 4 | Agreement — Call 3 + List 3 | Phone | Dohoda o spolupráci |
| 5 | Contract Return Control — Call 4 | Phone | Kontrola zmluvy |
| 6 | Onboarding — Call 5 | Phone | Onboarding partnera |
| 7 | Material Confirmation — Call 6 | Phone | Potvrdenie materiálov |
| 8 | Retention / Reactivation | Phone | Dlhodobý follow-up |

---

## KROK 6: Spustenie Fázy 1 (Outreach)

### 6.1 Aktivácia kampane

1. V hornej časti detail kampane kliknite na **Activate** (alebo zmeňte status na **Active**)
2. Kampaň sa zmení z Draft na Active

### 6.2 Aktivácia Fázy 1

1. V tabe **Phases** nájdite fázu **"Outreach — Email 1 / List 1"**
2. Kliknite na **Activate Phase** (Aktivovať fázu)
3. Systém priradí všetky nahraté kontakty do Fázy 1
4. Kontakty sa zobrazia operátorom v Agent Workspace

### 6.3 Čo robia operátori vo Fáze 1

- Operátor otvorí Agent Workspace → vyberie kampaň
- Systém mu priradí kontakt
- Operátor odošle Email 1 alebo zadá odoslanie List 1
- Vyberie dispozíciu **"Email 1 odoslaný"**
- Systém automaticky nastaví callback na **2 pracovné dni**

---

## KROK 7: Prechod do Fázy 2 (Contact — Call 1)

### 7.1 Vyhodnotenie Fázy 1

Po tom, čo väčšina kontaktov v Fáze 1 bola oslovená:

1. V tabe **Phases** nájdite Fázu 1
2. Kliknite **Evaluate** (Vyhodnotiť)
3. Systém označí kontakty podľa ich poslednej dispozície

### 7.2 Transition (Prechod) kontaktov

1. Pri Fáze 1 kliknite **Transition** (Presunúť)
2. Nastavte:
   - **Target Phase**: Fáza 2 (Contact — Call 1)
   - **Include results**: Email 1 odoslaný (email1_sent)
3. Kliknite **Execute Transition**
4. Kontakty s odoslaným emailom sa presunú do Fázy 2

### 7.3 Aktivácia Fázy 2

1. Kliknite na **Activate Phase** pri Fáze 2
2. Operátori teraz uvidia tieto kontakty v Agent Workspace
3. Operátor zavolá kontakt (Call 1) a vyberie výsledok:
   - **Termín dohodnutý** → callback podľa dohody
   - **Nedostupný** → callback ďalší pracovný deň
   - **Odmietnutie** → callback 6 mesiacov

---

## KROK 8: Prechod do Fázy 3 (Interest Qualification)

### 8.1 Vyhodnotenie Fázy 2

1. **Evaluate** Fázu 2

### 8.2 Transition kontaktov

1. **Transition** z Fázy 2 do Fázy 3:
   - **Include**: Termín dohodnutý (appointment_set), Záujem potvrdený (interest_confirmed)
   - Kontakty s odmietnutím ostávajú v systéme s 6M callbackom
2. **Activate** Fázu 3

### 8.3 Čo robia operátori

- Call 2 v dohodnutom termíne
- Ak záujem → ihneď Email 2 s detailmi
- Callback o 1 týždeň na Call 3

---

## KROK 9: Prechod do Fázy 4 (Agreement)

### 9.1 Transition z Fázy 3

1. **Evaluate** → **Transition**:
   - **Include**: Záujem potvrdený, Info odoslané
2. **Activate** Fázu 4

### 9.2 Čo robia operátori

- Call 3 — potvrdiť záujem, zodpovedať otázky
- Ak súhlasí → odoslať List 3 so zmluvou
- Callback o 1 týždeň

---

## KROK 10: Prechod do Fázy 5 (Contract Return Control)

### 10.1 Transition z Fázy 4

1. **Include**: Súhlas so spoluprácou (cooperation_agreed), Zmluva odoslaná (contract_sent)
2. **Activate** Fázu 5

### 10.2 Čo robia operátori

- Call 4 — overiť doručenie zmluvy
- Ak nedoručená → Call 4.a → nová kópia
- Ak bez údajov → Call 4.b → doplniť telefonicky
- Ak kompletná → validácia

---

## KROK 11: Prechod do Fázy 6 (Onboarding)

### 11.1 Transition z Fázy 5

1. **Include**: Zmluva validovaná (contract_validated)
2. **Activate** Fázu 6

### 11.2 Čo robia operátori

- Call 5 — next working day po validácii
- Potvrdiť prijatie zmluvy
- Ponúknuť materiály

---

## KROK 12: Prechod do Fázy 7 (Material Confirmation)

### 12.1 Transition z Fázy 6

1. **Include**: Onboarding potvrdený (onboarding_confirmed), Materiály odoslané (materials_sent)
2. Kontakty bez záujmu o materiály (active_no_materials) → priamo do Fázy 8
3. **Activate** Fázu 7

### 12.2 Čo robia operátori

- Call 6 — overiť doručenie materiálov
- Callback o 1 týždeň ak nedoručené

---

## KROK 13: Prechod do Fázy 8 (Retention)

### 13.1 Transition z Fázy 7

1. **Include**: Materiály doručené (materials_delivered)
2. **Activate** Fázu 8

### 13.2 Dlhodobý follow-up

- Každé 3 mesiace automatický callback
- Udržiavanie vzťahu s partnerom

---

## Monitoring a reporting

### Priebežné sledovanie

1. V tabe **Dashboard** (Prehľad) vidíte:
   - Celkový počet kontaktov
   - Koľko je v každej fáze
   - Konverzný pomer
   - Výkon operátorov

2. V tabe **Phases** vidíte pre každú fázu:
   - Koľko kontaktov je pending / contacted / completed
   - Úspešnosť fázy

### KPI na sledovanie

| Metrika | Cieľ |
|---------|------|
| Email 1 → Call 1 (kontakt) | 80%+ kontaktov oslovených |
| Call 1 → Call 2 (termín) | 40-50% dohodnutý termín |
| Call 2 → Call 3 (záujem) | 30-40% potvrdený záujem |
| Call 3 → Zmluva (súhlas) | 50-60% súhlas so zmluvou |
| Zmluva → Validácia | 80%+ validných zmlúv |
| Onboarding → Materiály | 70%+ chce materiály |

---

## Pravidlá pre správcu

1. **Neaktivujte viac fáz naraz** — vždy dokončite jednu fázu pred prechodom na ďalšiu
2. **Evaluate pred Transition** — vždy najprv vyhodnoťte, potom presúvajte
3. **Odmietnuté kontakty nechajte v systéme** — majú 6M callback, neodstraňujte ich
4. **Sledujte KPI** — ak konverzia klesá, zistite prečo (zlý čas volania, chýbajúca referencia, atď.)
5. **Komunikujte s operátormi** — pravidelne ich informujte o výsledkoch a zmenách
6. **Fáza 5 je kritická** — zmluvy vyžadujú pozornosť, nedoručená zmluva nie je odmietnutie

---

## Rýchly prehľad

```
KROK 1:  Otvorte kampaň
KROK 2:  Nastavte krajiny
KROK 3:  Priraďte operátorov
KROK 4:  Nahrajte kontakty (CSV / Criteria / Manuálne)
KROK 5:  Skontrolujte fázy
KROK 6:  Activate kampaň → Activate Fáza 1 → Operátori posielajú emaily
KROK 7:  Evaluate Fáza 1 → Transition do Fázy 2 → Activate → Call 1
KROK 8:  Evaluate Fáza 2 → Transition do Fázy 3 → Activate → Call 2 + Email 2
KROK 9:  Evaluate Fáza 3 → Transition do Fázy 4 → Activate → Call 3 + List 3
KROK 10: Evaluate Fáza 4 → Transition do Fázy 5 → Activate → Call 4
KROK 11: Evaluate Fáza 5 → Transition do Fázy 6 → Activate → Call 5
KROK 12: Evaluate Fáza 6 → Transition do Fázy 7 → Activate → Call 6
KROK 13: Evaluate Fáza 7 → Transition do Fázy 8 → Activate → Follow-up
```

Každý prechod medzi fázami je: **Evaluate → Transition → Activate**
