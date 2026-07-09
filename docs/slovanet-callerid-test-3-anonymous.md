# E-mail pre SLOVANET — test č. 3 (Diversion + P-Asserted-Identity)

**Predmet:** Trunk 0232399030 — presmerované hovory sa už spájajú (486 vyriešené), ale volanému sa zobrazuje „anonymný hovor"

---

Dobrý deň,

nadväzujeme na predchádzajúcu komunikáciu ohľadom prezentácie čísla volajúceho pri presmerovaných hovoroch cez náš trunk 0232399030 (server 212.55.232.229). Implementovali sme vaše odporúčanie č. 3 (Diversion hlavička) a doplnili sme aj P-Asserted-Identity. Výsledky testov z 09.07.2026:

## Aktuálny stav

Do každého presmerovaného hovoru posielame:

- `From:` pôvodné číslo volajúceho (napr. `0903282745`)
- `Diversion: <sip:0232399030@212.55.232.229>;reason=unconditional;privacy=off`
- `P-Asserted-Identity: <sip:0232399030@212.55.232.229>`

**Pozitívne:** Po doplnení P-Asserted-Identity sa hovory spájajú **hneď na prvý pokus** — zmizli aj odmietnutia 486, aj potreba opakovaného pokusu pri zahraničných číslach. ✅

**Problém:** Volanému sa napriek `privacy=off` zobrazuje **„anonymný hovor"** — nezobrazí sa ani pôvodné číslo volajúceho, ani naše číslo 0232399030. CLIP teda potláča niekto na trase (vaša brána alebo partnerský operátor).

## Testy z 09.07.2026

### Test 1 — SK volajúci (08:33), UNIQUEID 1783578812.12
Volajúci `0903282745` (Orange) → 0232399030 → presmerovanie na `0948519438` (O2).
Hovor sa spojil hneď, na cieli „anonymný hovor".

### Test 2 — SK volajúci + P-Asserted-Identity (~08:45)
Rovnaká trasa, doplnená hlavička P-Asserted-Identity. Hovor sa spojil, stále „anonymný hovor".

```
NoOp("SIP/mediagtw-00000018", "OUTBOUND FROM NEW ASTERISK EXTEN=0948519438 CID="0903282745" <0903282745>")
SIPAddHeader("SIP/mediagtw-00000018", "Diversion: <sip:0232399030@212.55.232.229>;reason=unconditional;privacy=off")
SIPAddHeader("SIP/mediagtw-00000018", "P-Asserted-Identity: <sip:0232399030@212.55.232.229>")
Dial("SIP/mediagtw-00000018", "SIP/SLOVANET-VGW/0948519438,,tToR")
-- SIP/SLOVANET-VGW-00000019 is ringing
```

### Test 3 — zahraničný volajúci (08:51:35), UNIQUEID 1783579895.100
Volajúci `+49 172 3627488` (Nemecko) → 0232399030 → presmerovanie na `0948519438` (O2).
Hovor sa spojil **na prvý pokus** (predtým prvý pokus končil 486), na cieli opäť „anonymný hovor".

```
NoOp(... "INDEXUS OVERRIDE TO MEDIAGTW DID=0232399030 FROM=0491723627488 UNIQUEID=1783579895.100")
NoOp("SIP/mediagtw-0000001e", "OUTBOUND FROM NEW ASTERISK EXTEN=0948519438 CID="00491723627488" <00491723627488>")
SIPAddHeader("SIP/mediagtw-0000001e", "Diversion: <sip:0232399030@212.55.232.229>;reason=unconditional;privacy=off")
SIPAddHeader("SIP/mediagtw-0000001e", "P-Asserted-Identity: <sip:0232399030@212.55.232.229>")
Dial("SIP/mediagtw-0000001e", "SIP/SLOVANET-VGW/0948519438,,tToR")
-- SIP/SLOVANET-VGW-0000001f answered SIP/mediagtw-0000001e
```

### Pre porovnanie — staršie testy z 08.07.2026 večer (ešte bez P-Asserted-Identity)
- CLI `0911163316` (T-Mobile) → opakované 486, UNIQUEID `1783539699.1285`
- CLI `00491723627488` → prvý pokus 486, druhý pokus spojený, UNIQUEID `1783540474.1297`

## Prosba

1. Viete preveriť, či vaša brána / partnerský operátor prenáša hlavičky From, Diversion a P-Asserted-Identity až k volanému a **prečo sa CLI potláča napriek `privacy=off`**?
2. Vedeli by ste zrealizovať avizovaný test z vašej O2 SIM karty?
3. Ak partner vyžaduje pre zobrazenie pôvodného CLI inú formu prezentácie (iný formát hlavičiek, whitelisting nášho trunku a pod.), prosíme o informáciu, čo máme upraviť.

Z našej strany je konfigurácia hotová a hovory sa spájajú spoľahlivo — ostáva len doriešiť zobrazenie čísla volajúceho.

Ďakujeme za súčinnosť.

S pozdravom
