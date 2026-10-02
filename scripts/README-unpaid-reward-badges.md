# Obmedzenie badge „nevyplatená odmena“ podľa Excelu

Skript `limit-unpaid-reward-badges-from-excel.cjs` mení **iba** viditeľnosť badge na osobe (`collaborators.unpaid_reward_badge_eligible`). Stav jednotlivých odmien a história úkonov zostávajú nezmenené. Zoznam sa berie **iba z prvého hárka**, zo stĺpca `Osobné číslo`; pre kontrolu zhody mena sa používa stĺpec `Meno`.

## Pred spustením na Ubuntu

1. Nasadiť aktuálnu aplikáciu. Jej štartovacia migrácia pridá stĺpec viditeľnosti. Existujúcim osobám do spustenia skriptu ponechá doterajší stav; novo založeným osobám je badge štandardne skrytý.
2. Excel nahrať **mimo verejného adresára aplikácie**, napríklad do privátneho adresára operátora s oprávneniami `0700` a so súborom `0600`. Nepridávať Excel do Gitu ani do `/var/www/indexus-crm/attached_assets`.
3. Spustiť **iba náhľad**, najprv pre holé legacy ID:

   ```bash
   cd /var/www/indexus-crm
   umask 077
   node scripts/limit-unpaid-reward-badges-from-excel.cjs \
     --xlsx /ABSOLUTNA/PRIVATE/CESTA/odbery.xlsx \
     --id-format plain \
     --report /ABSOLUTNA/PRIVATE/CESTA/review-plain.json
   ```

   Ak sa ID ukladajú ako `cbc_12345`, použiť druhý náhľad s `--id-format cbc` a iným názvom reportu. Skript načíta `DATABASE_URL` z prostredia alebo iba tento jeden riadok z `/var/www/indexus-crm/.env`; hodnotu hesla nevypisuje.

4. Pred akýmkoľvek zápisom skontrolovať `database`, `uniqueExcelIds`, `matched`, `unmatchedExcelIds`, `ambiguousLegacyIds`, `nameMismatches`, `conflictingExcelNames`, `alternativeFormatMatches` a `badgeFlagsToHide`. Report obsahuje interné ID a musí zostať privátny. Ak sa neoverí **každé** ID z Excelu jedným kanonickým záznamom a menom, **nespúšťať zápis**; chýba overené prepojenie ISCBC ↔ CRM.

5. Zápis je zámerne oddelený. Vyžaduje sa presný názov databázy, počet spárovaných osôb a `planHash` zo schváleného náhľadu, plus nový privátny súbor zálohy:

   ```bash
   node scripts/limit-unpaid-reward-badges-from-excel.cjs \
     --xlsx /ABSOLUTNA/PRIVATE/CESTA/odbery.xlsx \
     --id-format plain \
     --commit \
     --expect-database NAZOV_DB_Z_NAHLADU \
     --expect-matched POCET_Z_NAHLADU \
     --confirm-hash HASH_Z_NAHLADU \
     --backup /ABSOLUTNA/PRIVATE/CESTA/badge-before.json
   ```

   Nepoužiť ukážkové hodnoty v príkaze. Záloha zachová pôvodný príznak viditeľnosti pre každú osobu. Zápis prebieha v jednej transakcii a pri nezhode kontrol sa zruší.

6. Po zmene načítať znova Persons aj Nexus Pulse; ich predtým otvorené karty môžu držať starú odpoveď. Rovnaký náhľad má teraz ukázať `badgeFlagsToHide: 0` a `badgeFlagsToEnable: 0`. Ak sa objaví nečakaný stav, ponechať privátnu zálohu a najprv vyžiadať kontrolovaný obnovovací postup; **neupravovať** `reward_paid` ani `reward_paid_at`.

Nástroj nevie spustiť príkaz na CORPCRM01 zo vzdialeného vývojového prostredia; náhľad musí spustiť operátor priamo v Ubuntu konzole. Hodnoty z výstupu pre kontrolu je možné odovzdať bez prihlasovacích údajov a bez obsahu privátneho reportu.