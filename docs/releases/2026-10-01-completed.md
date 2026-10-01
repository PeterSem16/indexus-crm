# Dokončené zmeny – pripravené vydanie 2026-10-01

Samostatná vetva: `release/2026-10-01-tasks`.
Základ: `1060a63c3bc3f3613b81c6d5c16c78bb879d3275` z GitHub `main`.
Ide o prípravu vydania, nie o vykonané nasadenie na CORPCRM01.

## Rozsah

- Zosúladené taskové okná, ovládanie, checklisty, poznámky, AI návrh riešenia,
  priradenie, skupiny, filtre, meranie času a fullscreen detail.
- Prílohy v Tasks, Nexus Omni, Pulse a QuickCreate; súkromné uloženie
  a autorizovaný náhľad/stiahnutie.
- Upozornenie zadávateľa pri dokončení: nové overené ručné Pulse úlohy majú
  voľbu predvolene zapnutú, staršie neklasifikované úlohy umožňujú explicitné
  zapnutie. Ručný Pulse pôvod nezapína Status List obmedzenia checklistu.
- Dokončovacie API vlastní rozhodnutie o upozornení. Systémové pravidlo rešpektuje
  toto rozhodnutie vrátane vypnutia; používateľské pravidlá sa neprepisujú.
- Inbox dokončených úloh zobrazuje overený názov klienta, náhľad riešenia
  a zatvorenie upozornenia bez presmerovania do úlohy.
- Obnovené súvisiace storage metódy, modelové polia a kontroly prístupu.
  Vymazanie komentára vyžaduje prístup k rodičovskej úlohe aj vlastníctvo/admin rolu.
- Dokončené email HTML zobrazenie a jazykové úpravy pre EN, SK, CS, HU, RO, IT, DE.

Rozpracované globálne automatizácie, ich engine/scheduler, vývojová konfigurácia,
mockupy, pracovné súbory, súkromné prílohy a celá vývojová história nie sú zahrnuté.

## Overenie oddelenej verzie

- Finálny `npm run build`: úspešný.
- 33 jednotkových/kontraktových testov vrátane auditu všetkých siedmich jazykov:
  úspešné.
- 5 regresných testov skutočného DELETE handlera komentárov: úspešné.
- 69 taskových browser scenárov: úspešné; po celom behu boli dva opravené
  scenáre QuickCreate a persistovaného inboxu samostatne overené znova.
- 3 email HTML browser scenáre: desktop light, mobile light, mobile dark.
- Nezávislá kontrola taskového rozsahu a autorizácie: PASS.

Browser testy používajú skutočné komponenty s testovacími API dátami.
Živá prihlásená relácia ani produkčný Pulse neboli overované.

## Pred budúcim nasadením

1. Skontrolovať a zachovať lokálne zmeny na CORPCRM01. Nerobiť slepý pull celej
   vývojovej vetvy ani prepis súborov s necommitnutými produkčnými opravami.
2. Zálohovať databázu. Startup používa idempotentné CREATE/ALTER pre taskové
   tabuľky a stĺpce; DB účet musí mať potrebné DDL oprávnenia. Chyba tejto migrácie
   zámerne zastaví štart namiesto spustenia nekompatibilnej aplikácie.
3. Zabezpečiť trvalý zapisovateľný a zálohovaný súkromný adresár
   `path.dirname(DATA_ROOT)/private-task-attachments`, mimo verejných mountov.
4. Neboli pridané nové npm závislosti.
5. Vetvu najprv skontrolovať proti uvedenému základu; tento dokument ani príprava
   Git vetvy nepredstavujú súhlas so spustením produkčného nasadenia.