# INDEXUS AI Router – živé testovacie overenie

**Výsledok: 10 úspešných kontrol, 0 zlyhaní, 0 vynechaných.**

- Čas protokolu: **2026-11-11 16:18:59 UTC**.
- Prostredie: vývojový INDEXUS, nie CORPCRM01.
- Poskytovateľský host klienta: `api.openai.com`.
- Model vo všetkých týchto testoch: `gpt-4o`.
- Router konfigurácia: `phase-1`, existujúci OpenAI adaptér a prázdne prepisy.
- Skutočné SDK volania bez stubovaného fetch/SDK; najviac 10 volaní,
  `maxRetries: 0`, timeout 45 sekúnd na požiadavku.
- Vstupy: výhradne syntetické. Žiadna databáza, zákaznícke súbory,
  automatizačné udalosti, e-maily, SMS ani produkčné nastavenia.

## Výsledky

| Scenár | Legacy cesta | Router cesta | Overený výsledok |
|---|---:|---:|---|
| Chat Completions JSON object | 1 318 ms | 839 ms | Parsovateľný JSON a správne hodnoty |
| Chat Completions strict JSON Schema | 604 ms | 783 ms | Platná schéma, presné kľúče a typy |
| Responses text | 1 198 ms | 940 ms | Dokončená odpoveď a správny JSON |
| Responses obrázok | 981 ms | 1 075 ms | Správna farba syntetického PNG |
| Responses PDF | 1 147 ms | 993 ms | Správna referencia, suma a mena z PDF |

Časy sú jednorazové pozorovania, nie benchmark alebo sľub výkonu.
Pri každom scenári sa validovala očakávaná štruktúra a obsah a porovnali sa
parsované výsledky legacy/routed. Nevyžaduje sa všeobecná textová
deterministickosť modelov.

## Opakovanie

```bash
npx --no-install tsx script/ai-router-live-check.ts --live
```

Spúšťať iba vo vybranom testovacom prostredí s oprávneným OpenAI prístupom.
Ide o platené API volania. Príkaz bez `--live` nič neodosiela.
Pri autentifikačnej, transportnej alebo limitnej chybe sa ďalšie volania
zastavia. Report obsahuje iba bezpečné technické výsledky a časy.

## Hranice dôkazu

Tento protokol dopĺňa pôvodných 65 stubovaných/regresných kontrol; nenahrádza
ich a nerobí z nich 75 rovnakých testov. Potvrdzuje päť živých kontraktov
na jednom modeli a dvoch prístupových cestách.

Nepotvrdzuje všetkých 72 migrovaných miest, ostatné modely, živé audio
prepisy/TTS, streamovanie, veľké alebo poškodené prílohy, kompletné CRM
workflow, prihlásené UI ani produkčnú sieť/dostupnosť.
Syntetické PDF a obrázok boli poslané priamo v Responses požiadavke;
nešlo o kompletný upload pipeline aplikácie.

## Ďalšie hranice

Produkčné nasadenie nie je týmto schválené ani vykonané.
Interný server nie je pripojený a fallback zostáva vypnutý.
[Gateway kontrakt](ai-gateway-contract-v1-proposal.md) je iba návrh pre dohodu
oboch strán. Audio Analyzer 1.6 a Voice Studio zostali nedotknuté.
