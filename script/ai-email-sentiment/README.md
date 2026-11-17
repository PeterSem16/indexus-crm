# Regresný testovací balík email.sentiment

Balík rozširuje existujúcu integráciu. Neobsahuje nový produkčný adaptér,
nezapína model a nemení sieťové smerovanie.

## Obsah

- `regression-corpus.ts`: pôvodných 18 dodaných správ, spoločný predmet
  `Syntetický test` a výhradne dodané čiastkové referencie.
- `regression-evaluator.ts`: čisté vyhodnotenie štruktúry, dodaných polí,
  ručnej kontroly poznámok a bezpečného odmietnutia.
- `regression.test.ts`: nezávislé testy vyhodnocovania a menovateľov.
- `test-configuration.ts`: existujúca izolovaná konfigurácia Routera
  so syntetickým tokenom, bez DB a reálnych poverení.
- `corpus.ts`: starší osempoložkový syntetický fixture korpus; **nie je
  náhradou pôvodných 18 prípadov**.

Transportné testy sú v `server/lib/ai/email-sentiment.test.ts`. Používajú
pôvodný CRM analyzátor a natívny HTTP transport s lokálnym fixture serverom.
Zahŕňajú všetkých 18 dodaných vstupov a samostatnú vetvu K12 cez HTTP 422.
Predmet a telo po existujúcom CRM predspracovaní sa kontrolujú presne.

## Spustenie nezávislých kontrol

Z koreňa projektu:

```bash
npx tsx --test \
  script/ai-email-sentiment/regression.test.ts \
  server/lib/ai/email-sentiment.test.ts
```

Tieto kontroly neposielajú nič na interný AI server. Prípadné prekrývajúce
sa požiadavky v lokálnom HTTP fixture teste nie sú súbežné modelové inferencie.
Nejde o živé hodnotenie presnosti modelu ani záťažový test Ollama.

## Pravidlá hodnotenia

1. Každá klasifikácia musí mať presne deväť správne typovaných polí.
2. Hodnotová zhoda sa hodnotí iba na dodaných čiastkových referenciách.
   Napríklad K08 nepredpisuje `wantsConsent`, sentiment ani hnev.
3. K04 navyše vylučuje `angry`, ale nepredpisuje jednu z ostatných troch
   povolených hodnôt sentimentu.
4. K12 môže mať platnú klasifikáciu s `wantsConsent=false` alebo samostatné
   bezpečné odmietnutie. `SAFE_REJECTION` má `classificationValid=false`,
   nula hodnotených klasifikačných polí a nikdy sa neprepočíta na deväť
   úspešných polí alebo na vymyslené `wantsConsent=false`.
5. Slovenský jazyk šiestich lokalizačných poznámok a význam poznámky K09
   vyžadujú skutočné manuálne posúdenie. Bez neho zostáva REVIEW_REQUIRED,
   nie heuristicky potvrdený jazyk alebo úspech.
6. Menovateľ je všetkých 18 prípadov. Vynechanie, duplicitný prípad, technická
   chyba alebo neschválené manuálne posúdenie sa nesmú skryť.
7. Syntetické deväťpolové odpovede v testoch sú iba vstupy testu kódu.
   Nie sú novými gold referenciami ani nameranými odpoveďami modelu.
8. `completeAndAccepted` je výsledok čiastkového regresného vyhodnotenia,
   nie verdikt READY_FOR_PILOT. Nezahŕňa sieť, prevádzku, celkovú kvalitu
   poznámok ani vplyv na ostatné služby.

Používateľ prijal nezávislé kontroly 80 PASS / 0 FAIL / 0 SKIP.
Aktuálny technický návrh a plán sekvenčnej regresie:
`docs/email-sentiment-test-proposals.md`. Ide o 18 prípadov, súbežnosť
1, žiadne opakovania, warmup ani fallback, až po schválení a overení trasy.
Fáza B a produkčné zapnutie nie sú povolené. Existujúca fixture konfigurácia
nie je živý klient a nesmie sa zameniť za skutočné HTTPS overenie.

Pôvodný kontrakt note neobsahuje nový 100-znakový limit. Gateway musí
zachovať platné dlhšie poznámky bez orezania; nový limit sa nedohaduje
zmenou očakávaní ani parsera. Aktuálny parser má vlastnú ochranu 1000,
ktorá sa v tejto dokumentačnej úlohe nemení.

Žiadny dokument ani prijaté fixture testy nie sú povolením vytvoriť
tunel, meniť produkciu alebo vykonať živú inferenciu bez schválenej trasy.
