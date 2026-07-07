# Sumár testovania Caller ID pri presmerovaní hovorov — podklad pre SLOVANET support

**Zákazník:** Cord Blood Center / INDEXUS CRM
**Náš SIP systém (Asterisk):** `10.1.2.112` (User-Agent: `INDEXUS-Asterisk`)
**SLOVANET SIP gateway:** `195.28.88.42` (peer `SLOVANET-VGW`)
**Medzičlánok (ViciDial/DialLog):** `10.9.33.2` (Server: `DialLog.Dialer`, Asterisk 13.21.0-vici)
**Dátum testovania:** 05.07.2026
**Testovací cieľ (mobil agenta):** `0948519438`

---

## 1. Zhrnutie problému (v jednej vete)

Pri **presmerovaní prichádzajúceho hovoru** na mobil agenta platí:
- ak je **CLI (číslo volajúceho) SLOVENSKÉ**, hovor dostane **`486 Busy Here`** a **neprepojí sa**,
- ak je **CLI ZAHRANIČNÉ**, hovor **normálne zvoní a prepojí sa**.

Cieľové číslo `0948519438` je pritom **voľné** — v tom istom čase naň prejde iný (zahraničný) hovor. `486` teda **nie je skutočné obsadenie**.

---

## 2. Topológia hovoru (presmerovanie = hairpin späť k SLOVANET)

```
volajúci  →  SLOVANET (195.28.88.42)  →  DialLog/ViciDial (10.9.33.2)
          →  náš Asterisk (10.1.2.112)  →  späť na SLOVANET/DialLog  →  mobil 0948519438
```

Prichádzajúci aj odchádzajúci (presmerovaný) leg idú cez **ten istý SLOVANET trunk**. Odmietnutie `486` prichádza späť **z 195.28.88.42**, resp. od `DialLog.Dialer` (10.9.33.2).

---

## 3. Výsledky testov (prehľad)

| Dátum a čas (05.07.2026) | CLI volajúceho | Typ CLI | Cieľ | Výsledok |
|---|---|---|---|---|
| 16:40:33 | `0491723627488` | zahraničné (DE) | 0948519438 | **zvoní / progress (OK)** |
| 16:41:xx | `0421911163316` | slovenské | 0948519438 | `486` / „Everyone is busy/congested" |
| 17:21–17:23 | `0421911163316` / `0491723627488` | SK vs zahr. | 0948519438 | SK → `486`, zahr. → progress |
| ~18:08:01 | `+421911163316` | slovenské | 0948519438 | 180 → 183 → **`486 Busy here`** (plný SIP trace nižšie) |
| 20:42:xx | prázdne/anonymné | slovenské | 0948519438 | „busy/congested" |
| 22:05:10 | `0232399030` (naše vlastné DID) | slovenské | 0948519438 | **`486 Busy Here` z `195.28.88.42`** |

**Vyskúšali sme všetky formáty slovenského CLI** — medzinárodný `+421…`, s nulou `0421…`, národný mobilný `09…`, naše vlastné pevné DID `02…` (0232399030), aj **anonymné/prázdne** — a **všetky dostali `486`**. Zahraničné číslo (`049…` / DE) v rovnakom nastavení **prechádza**.

---

## 4. Kľúčové výpisy z Asterisk konzoly (verbatim)

### 4a. Reálny slovenský volajúci `+421911163316` → `486 Busy here` (plný SIP trace, ~18:08:01)

```
    -- PJSIP/trunk-sk-endpoint-00000060 is ringing
<--- Received SIP response (554 bytes) from UDP:10.9.33.2:5060 --->
SIP/2.0 180 Ringing
From: "+421911163316" <sip:+421911163316@10.9.33.2>;tag=91ab04a0-...
To: <sip:0948519438@10.9.33.2>;tag=as77d1470e
Call-ID: 5d1b839d-d9a5-4109-b3a6-bd200eaaa904
CSeq: 18492 INVITE
Server: DialLog.Dialer

<--- Received SIP response (865 bytes) from UDP:10.9.33.2:5060 --->
SIP/2.0 183 Session Progress
From: "+421911163316" <sip:+421911163316@10.9.33.2>;tag=91ab04a0-...
To: <sip:0948519438@10.9.33.2>;tag=as77d1470e
Server: DialLog.Dialer
Content-Type: application/sdp
...
o=root 6677496 6677496 IN IP4 10.9.33.2
s=Asterisk PBX 13.21.0-vici
c=IN IP4 10.9.33.2
m=audio 12980 RTP/AVP 0 8 101

<--- Received SIP response (514 bytes) from UDP:10.9.33.2:5060 --->
SIP/2.0 486 Busy here
From: "+421911163316" <sip:+421911163316@10.9.33.2>;tag=91ab04a0-...
To: <sip:0948519438@10.9.33.2>;tag=as77d1470e
Call-ID: 5d1b839d-d9a5-4109-b3a6-bd200eaaa904
CSeq: 18492 INVITE
Server: DialLog.Dialer
Content-Length: 0

  == Everyone is busy/congested at this time (1:1/0/0)
```

> **Dôležité:** `183 Session Progress` obsahuje **reálne SDP** (RTP audio), t.j. hovor sa reálne smeruje ďalej a `486` prichádza **downstream**, nie ako predbežné odmietnutie. `486` **nemá** hlavičku `Q.850 Reason` — čo je typické pre **policy/screening reject**, nie pre skutočnú obsadenosť.

### 4b. Naše vlastné DID `0232399030` → `486 Busy Here` priamo z `195.28.88.42` (22:05:10)

```
 -- Executing [0232399030@from-sk-inbound:1] NoOp("SIP/SLOVANET-VGW-000000c4",
        "INDEXUS OVERRIDE TO MEDIAGTW DID=0232399030 FROM=0421911163316 ...") 
    -- Executing [...:4] Set("...", "__DID_Date=05-07-2026 22:05:10")
    ...
    -- Executing [0948519438@from-mediagtw:3] NoOp("...",
        "FROM-MEDIAGTW: keeping CID=0232399030 for dest=0948519438")
    -- Executing [0948519438@from-mediagtw:4] Dial("...",
        "SIP/SLOVANET-VGW/0948519438,,tToR")
    -- Called SIP/SLOVANET-VGW/0948519438
    -- SIP/SLOVANET-VGW-000000c7 is ringing
    -- SIP/SLOVANET-VGW-000000c7 is making progress ...
    -- Got SIP response 486 "Busy Here" back from 195.28.88.42:5060
    -- SIP/SLOVANET-VGW-000000c7 is busy
  == Everyone is busy/congested at this time (1:1/0/0)
```

> Aj **naše vlastné, nami vlastnené číslo** `0232399030` (bratislavské pevné 02) dostane `486` priamo z `195.28.88.42`.

### 4c. Kontrast — zahraničné číslo `0491723627488` (DE) prechádza (16:40:33)

```
    -- Executing [0232399030@from-sk-trunk:1] NoOp("PJSIP/trunk-sk-endpoint-00000036",
        "INBOUND from SK trunk DID=0232399030 CID="" <0491723627488>")
    ...
    -- Executing [421948519438@from-internal-sk:4] ExecIf("...",
        "1?Set(CALLERID(num)=0491723627488)")
    -- Dial(PJSIP/0948519438@trunk-sk-endpoint,60)
    -- PJSIP/trunk-sk-endpoint-00000037 is ringing
    -- PJSIP/trunk-sk-endpoint-00000037 is making progress ...
    (zvoní — bez okamžitého 486)
```

### 4d. Slovenský volajúci `0421911163316` v tom istom slede → `486` (16:41 / 17:21)

```
    -- Executing [421948519438@from-internal-sk:4] ExecIf("...",
        "1?Set(CALLERID(num)=0421911163316)")
    -- Dial(PJSIP/0948519438@trunk-sk-endpoint,60)
    -- PJSIP/trunk-sk-endpoint-00000039 is ringing
    -- PJSIP/trunk-sk-endpoint-00000039 is making progress ...
  == Everyone is busy/congested at this time (1:1/0/0)
    -- Hangup(...)
```

---

## 5. Konfigurácia nášho SK trunku (`pjsip show endpoint trunk-sk-endpoint`)

```
Endpoint:  trunk-sk-endpoint                     Not in use   0 of inf
   Aor:  trunk-sk-aor
   Contact:  trunk-sk-aor/sip:10.9.33.2:5060     Avail  RTT 24.086 ms
   Identify:  trunk-sk-identify/trunk-sk-endpoint   Match: 10.9.33.2/32

 allow                : (ulaw|alaw)
 context              : from-sk-trunk
 from_domain          : 10.9.33.2
 from_user            :            (prázdne)
 media_address        : 10.1.2.112
 callerid             : <unknown>
 callerid_privacy     : allowed_not_screened
 send_pai             : false
 send_rpid            : false
 send_diversion       : true
 stir_shaken          : no
 trust_id_outbound    : false
```

Na strane nášho Asterisku pri presmerovaní nastavujeme `CALLERID(num)` = číslo pôvodného volajúceho (viď dialplan `from-internal-sk`). Trunk je registrovaný a dostupný (`Avail`, RTT ~24 ms).

---

## 6. Čo z toho vyplýva (naša analýza)

1. `486` **nie je skutočné obsadenie** — cieľový mobil `0948519438` je voľný a **zahraničný** hovor naň v rovnakom čase **zvoní**.
2. Priebeh **180 → 183 s reálnym SDP → 486** znamená, že hovor sa reálne smeruje ďalej a odmietnutie prichádza **downstream** (za vaším gateway-om / u terminujúceho operátora).
3. **Jediná premenná** medzi úspechom a zlyhaním je **pôvod/formát CLI** — slovenské CLI zlyháva, zahraničné prechádza.
4. **Všetky** slovenské formáty CLI (`+421…`, `0421…`, `09…`, vlastné DID `02…`, aj anonymné) → `486`.
5. Najpravdepodobnejšia príčina: **kontrola/validácia CLI (anti-spoofing / CLIP screening)** na vašej strane, resp. u terminujúceho mobilného operátora — slovenské CLI prezentované cez tento trunk/gateway je vyhodnotené ako neautorizované.

---

## 7. Naše otázky a požiadavky na SLOVANET

1. **Prečo** dostávame `486 Busy Here` pri **slovenskom CLI**, kým **zahraničné CLI** cez ten istý trunk **prechádza**? Ide o CLI-screening / anti-spoofing na vašej strane alebo u terminujúceho operátora?
2. Prosíme **povoliť „CLIP no-screening"** na našom trunku (`trunk-sk-endpoint`, identifikovaný cez IP `10.9.33.2`), aby sme pri presmerovaní mohli prezentovať **skutočné slovenské číslo volajúceho**.
3. Alternatívne prosíme **autorizovať naše vlastné čísla** (DID, napr. `+421 2 3239 xxxx` / `0232399030`) ako **povolené odchádzajúce CLI** na tomto trunku.
4. **Ktoré číslo** máte pre tento trunk zaevidované ako **povolené odchádzajúce CLI**? (aby sme ho vedeli prezentovať)
5. Honorujete prezentáciu identity cez **P-Asserted-Identity (PAI)** / **RPID** až po terminujúceho operátora? (vieme ich posielať)
6. Ak sa slovenské CLI na tomto trunku prezentovať nedá, prosíme o **presmerovanie SK→SK hovorov cez trunk/routu, ktorá prezentáciu slovenských CLI povoľuje**.

---

## 8. Referenčné identifikátory pre dohľadanie vo vašich logoch

- Náš Asterisk IP: `10.1.2.112` (User-Agent `INDEXUS-Asterisk`)
- Váš gateway: `195.28.88.42` (`SLOVANET-VGW`), DialLog/ViciDial: `10.9.33.2` (`DialLog.Dialer`)
- Príklad Call-ID zlyhaného hovoru (`+421911163316` → `486`): `5d1b839d-d9a5-4109-b3a6-bd200eaaa904`, `CSeq 18492 INVITE`
- Testovaný cieľ: `0948519438`; testované CLI: `+421911163316`, `0421911163316`, `0232399030`, `0491723627488`
- Dátum a časy testov: **05.07.2026**, cca **16:40 – 22:05** (SELČ)
