# INDEXUS – Odhad nákladov na AI tokeny

**Projekt:** INDEXUS CRM Lead Intelligence Platform  
**Dátum:** 20. apríl 2026  
**Predmet:** Mesačný odhad nákladov na AI služby (OpenAI, Gemini, Claude) pri spracovaní hovorov

---

## 1. Predpoklady kalkulácie

| Parameter | Hodnota |
|---|---|
| Počet hovorov mesačne | **2 000** |
| Priemerná dĺžka hovoru | 5 minút |
| Audio mesačne spolu | **10 000 minút** |
| Prepis (text) na hovor | ~750 slov ≈ 1 000 tokenov |
| LLM vstup na hovor (prepis + system prompt + kontext) | ~3 000 tokenov |
| LLM výstup na hovor (sumár + štruktúrované polia) | ~800 tokenov |
| **Mesačný objem textu spolu** | **6M input + 1,6M output tokenov** |

Cenníky vychádzajú zo zverejnených sadzieb OpenAI, Google a Anthropic platných k 04/2026.

---

## 2. Variant A — Post-call analýza (odporúčané pre štart)

Klasický flow: nahratý hovor → prepis → LLM analýza → uloženie štruktúrovaných údajov do CRM.

| Stack | Audio prepis | Text in (6M) | Text out (1,6M) | **Spolu / mes** |
|---|---|---|---|---|
| **Gemini 2.0 Flash** (native audio) | $1,44 | $0,45 | $0,48 | **~ $3** |
| **Gemini 1.5 Pro** (native audio) | ~$2 | ~$25 | ~$8 | **~ $35** |
| **OpenAI Whisper + GPT-4o-mini** | $60 | $0,90 | $0,96 | **~ $62** |
| **Whisper + Claude 3.5 Haiku** | $60 | $4,80 | $6,40 | **~ $71** |
| **OpenAI Whisper + GPT-4o** | $60 | $15 | $16 | **~ $91** |
| **Whisper + Claude Sonnet 4** | $60 | $18 | $24 | **~ $102** |
| **Whisper + Claude Opus 4** | $60 | $90 | $120 | **~ $270** |

---

## 3. Variant B — Real-time AI agent počas hovoru (drahé)

AI hovorí so zákazníkom živo (voice-to-voice).

| Stack | Odhad / mesiac |
|---|---|
| **Gemini 2.0 Flash Live** | ~ $300 – $500 |
| **OpenAI Realtime (gpt-4o-realtime)** | ~ $1 800 – $2 400 |

> Claude zatiaľ nemá natívne voice-to-voice API.

---

## 4. Variant C — Hybrid (live klasifikácia + post-call sumár)

Streaming prepis počas hovoru + ľahký LLM na rozhodnutia + plnohodnotná post-call analýza.

| Stack | Odhad / mesiac |
|---|---|
| Gemini Flash (streaming + sumár) | ~ $20 – $40 |
| Whisper streaming + GPT-4o-mini | ~ $150 – $250 |
| Whisper streaming + Claude Haiku/Sonnet mix | ~ $180 – $300 |

---

## 5. Porovnanie – kompletný rebríček (Variant A)

| Poradie | Stack | Cena / mes | Silné stránky |
|---|---|---|---|
| 1 | Gemini 2.0 Flash | **~ $3** | Najlacnejšie, native audio |
| 2 | Gemini 1.5 Pro | **~ $35** | Native audio, Pro kvalita |
| 3 | GPT-4o-mini + Whisper | **~ $62** | Overený OpenAI ekosystém |
| 4 | Claude 3.5 Haiku + Whisper | **~ $71** | Veľmi dobrá slovenčina |
| 5 | GPT-4o + Whisper | **~ $91** | Vyššia kvalita reasoningu |
| 6 | Claude Sonnet 4 + Whisper | **~ $102** | Najlepšie pre extrakciu medic. údajov, dlhý kontext |
| 7 | Claude Opus 4 + Whisper | **~ $270** | Top kvalita, drahé |

---

## 6. Odporúčanie pre INDEXUS

### Štart (MVP)
- **Gemini 2.0 Flash** (~$3/mes) alebo **GPT-4o-mini + Whisper** (~$62/mes).
- Nízke riziko, predvídateľné náklady, rýchla integrácia.

### Produkčná kvalita
- **Claude Sonnet 4 + Whisper** (~$102/mes) — najlepší kompromis pre štruktúrovanú extrakciu (zákazník, dispozícia, medical terms v SK/CS), 30-dňové prompt caching, kvalitný JSON output.
- Alebo **GPT-4o + Whisper** (~$91/mes).

### Optimalizácia nákladov (mix modelov)
- **Haiku** alebo **GPT-4o-mini** na klasifikáciu/dispozíciu hovoru.
- **Sonnet 4** alebo **GPT-4o** len na komplexnú sumarizáciu.
- Odhadovaná úspora: **30 – 50 %**.

### Realistický rozpočet
| Scenár | Mesačne |
|---|---|
| Lacný štart (Gemini Flash) | **~ $5 / mes** |
| Štandard (GPT-4o-mini / Haiku) | **~ $80 / mes** |
| Premium (Sonnet 4 / GPT-4o) | **~ $100 – $130 / mes** |
| Real-time AI asistent (Gemini Live) | **~ $400 / mes** |

> **Buffer:** počítať +30 % rezervu na retries, dlhšie hovory a kontextové prompty s históriou zákazníka.

---

## 7. Ďalšie odporúčania

1. **Prompt caching** — Anthropic aj OpenAI ponúkajú cache na opakovaný system prompt, šetrí 50-90 % vstupných tokenov.
2. **Štruktúrované výstupy (JSON mode)** — znižujú output tokeny aj chybovosť parsovania.
3. **Tier upgrade** — pri >1M tokenov denne sa oplatí požiadať o vyšší rate-limit tier (často aj zľava).
4. **Lokálny prepis (Whisper.cpp / Faster-Whisper)** — pre náročnejšie objemy hovorov môže ušetriť celých $60/mes na prepis.
5. **Monitoring** — pridať dashboard v INDEXUS Configuratore so živým prehľadom spotreby tokenov a nákladov.

---

*Dokument pripravený pre interné rozhodovanie. Ceny sú orientačné a môžu sa meniť podľa cenníkov poskytovateľov.*
