# SLOVANET – výsledok testovacích hovorov PO úprave formátu CLI (07.07.2026)

## Zhrnutie
Podľa vášho odporúčania sme upravili formát čísla volajúceho (CLI), ktoré posielame
na váš trunk pri presmerovaných hovoroch. Slovenské čísla teraz posielame v národnom
tvare (napr. `0911163316`) namiesto pôvodného chybného tvaru `0421911163316`.

Urobili sme dva testovacie hovory. **Úprava formátu funguje** – von ide správne
`0911163316`. Napriek tomu slovenský hovor stále dostáva **486 „Busy Here"**, kým
zahraničný hovor po tej istej ceste normálne zvoní.

---

## HOVOR 1 – zahraničný volajúci (DE) – PREPOJENÝ (zvonilo)
- Dátum a čas (miestny): **07.07.2026 20:23:46**
- Číslo volajúceho (prezentované von): **0491723627488**
- Pôvodne volané číslo (DID): **0232399030**
- Hovor presmerovaný na: **0948519438**
- UNIQUEID (na bráne, kde je terminovaný SLOVANET trunk): **1783448626.1996**
- UNIQUEID (mediagtw): **1783448626.510**
- Výsledok: 180 Ringing → 183 Session Progress → **zvonilo** (bez 486)

## HOVOR 2 – slovenský volajúci – ODMIETNUTÝ (486)
- Dátum a čas (miestny): **07.07.2026 20:30:40**
- Číslo volajúceho ako prišlo od vás na vstup (inbound): **0421911163316**
- Číslo volajúceho po úprave (prezentované von): **0911163316**  ← správny národný tvar
- Pôvodne volané číslo (DID): **0232399030**
- Hovor presmerovaný na: **0948519438**
- UNIQUEID (na bráne, kde je terminovaný SLOVANET trunk): **1783449040.2017**
- UNIQUEID (mediagtw): **1783449040.534**
- Výsledok: 180 Ringing → 183 Session Progress → **486 „Busy Here" z 195.28.88.42:5060**

---

## Kľúčové zistenie
- Formát je teraz správny (`0911163316`), a hovor aj tak padá na **486**.
  → Chybný formát teda **nie je** (jedinou) príčinou.
- Jediný rozdiel medzi hovorom, ktorý zvoní, a hovorom, ktorý padá, je,
  či je číslo volajúceho **slovenské** alebo **zahraničné**.
- 486 sa vracia z **195.28.88.42** – podľa vášho predchádzajúceho e-mailu je to
  zariadenie DialLog/ViciDial, teda odmietnutie zrejme vzniká ešte pred vašou
  hlasovou bránou `212.55.232.229`.

## Prosba / otázky
1. Môžete si prosím tieto dva hovory pozrieť podľa uvedených časov a UNIQUEID
   a potvrdiť, kde presne vzniká 486 (na DialLog boxe `195.28.88.42` alebo ďalej
   na vašej bráne `212.55.232.229`)?
2. Keďže prezentujeme skutočné slovenské číslo volajúceho zákazníka (ktoré nie je
   naše), nie je odmietané pri kontrole CLI / anti-spoofingu? Potrebujeme, aby ste
   povolili **CLIP no-screening** alebo autorizovali naše číslo(a) ako povolené
   odchádzajúce CLI na tomto trunku?
3. Alebo máme radšej pri presmerovaní posielať **naše vlastné DID** `0232399030`
   (národne) resp. `00421232399030` (medzinárodne)? Ak áno, potvrďte prosím, či
   toto číslo je na trunku autorizované ako odchádzajúce CLI.

Ďakujeme.
