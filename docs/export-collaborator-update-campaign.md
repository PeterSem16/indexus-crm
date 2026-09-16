# Export osôb z kampane na aktualizáciu údajov

Skript `scripts/export-collaborator-update-campaign.cjs` vytvorí read-only
`.xlsx` export všetkých reálnych osôb zaradených do jednej kampane
`collaborator_update_campaigns`.

Skript nič nemení v databáze. Používa PostgreSQL transakciu
`BEGIN TRANSACTION READ ONLY` a počas behu nevykonáva `INSERT`, `UPDATE` ani
`DELETE`.

## Spustenie na Ubuntu

Spúšťaj ho z koreňa produkčného checkoutu, typicky:

```bash
cd /var/www/indexus-crm
umask 077

node scripts/export-collaborator-update-campaign.cjs \
  --campaign-name "JMHZ kaman na update udajov" \
  --output /tmp/jmhz-collaborator-export.xlsx
```

Ak názov nie je jednoznačný alebo obsahuje preklep, najprv použi presné ID
kampane:

```bash
node scripts/export-collaborator-update-campaign.cjs \
  --campaign-id "<ID_KAMPANE>" \
  --output /tmp/collaborator-campaign-export.xlsx
```

Skript načíta `DATABASE_URL` z environmentu. Ak tam nie je, prečíta iba riadok
`DATABASE_URL` zo súboru `/var/www/indexus-crm/.env`. Hodnota sa nevypisuje.
Alternatívny súbor možno určiť cez `CRM_ENV_FILE`.

Testovací recipienti s tokenom začínajúcim `test-` sa štandardne vynechávajú.
Ak ich treba zahrnúť na kontrolu kampane, pridaj:

```bash
node scripts/export-collaborator-update-campaign.cjs \
  --campaign-id "<ID_KAMPANE>" \
  --include-tests \
  --output /tmp/collaborator-campaign-with-tests.xlsx
```

## Obsah XLSX

Export má iba dva listy:

- `persons` — vždy jeden riadok na jedného osloveného spolupracovníka.
  Obsahuje aktuálne údaje z `collaborators`, explicitné `iscbc_legacy_id`,
  údaje o kampani a JSON stĺpce s adresami, ostatnými údajmi, dohodami,
  snapshotmi a detailmi kampanijných requestov. ID nemocníc, kliník a
  reprezentantov sú nahradené ich názvami.
- `summary` — identifikácia kampane, počty requestov/osôb/zmien a kontrola
  nájdených `contact_field_snapshots`.

Stĺpce z hlavnej tabuľky, ktoré nemajú vyplnenú hodnotu ani pri jednom
exportovanom spolupracovníkovi, sa do listu `persons` nezaradia. Tým zostane
výsledný list kratší bez straty vyplnených údajov.

Dátum narodenia je zoradený logicky v susedných stĺpcoch
`birth_day`, `birth_month`, `birth_year`. Kódy v `highest_education` sa
nahrádzajú celým popisom dosiahnutého vzdelania.

Rovnaké pravidlo platí aj pre ostatné známe kódové hodnoty. Export prekladá
typ spolupracovníka, rodinný stav, odborné zaradenie, typ dohody, typ odmeny,
CBC aktivity, jazyk, krajinu, zdroj údajov, režim nahrávania, typ adresy a
stav kampane. Preklady sa používajú aj vo vnorených JSON stĺpcoch. Hodnoty,
ktoré nie sú v známom číselníku, zostávajú bez zmeny.

V hlavnom liste sa používajú farby:

- žltá bunka — hodnota aktualizovaná cez kampaň,
- zelená bunka — nová hodnota doplnená cez kampaň.

Legenda je zároveň v liste `summary`.

JMHZ polia `birthCountry` a `educationRequired` sú označené ako
`request_only`, pretože ich aktuálny schvaľovací flow uchováva iba v requeste a
nezapisuje ich do karty spolupracovníka. Pri schválených JMHZ poliach sa
zohľadňuje aj mapovanie na interné hodnoty karty, napríklad vzdelanie na kód
`A` až `V`.

## Bezpečná práca so súborom

Export obsahuje osobné údaje a podľa evidencie spolupracovníka môže obsahovať
aj bankový účet. Vytvor ho do adresára s obmedzeným prístupom, napríklad
`/tmp` po nastavení `umask 077`, a po prevzatí ho odstráň:

```bash
ls -l /tmp/jmhz-collaborator-export.xlsx
sha256sum /tmp/jmhz-collaborator-export.xlsx

# Po bezpečnom prenose do schváleného úložiska:
rm -f /tmp/jmhz-collaborator-export.xlsx
```

Skript neexportuje request tokeny, pretože sú to prístupové odkazy na verejný
formulár. Neexportuje ani `mobile_password_hash`; v `persons` je iba príznak
`mobile_password_hash_present`. XLSX neposielaj cez verejný link ani do
nešifrovaného zdieľaného priečinka.

Po otvorení v Exceli skontroluj najmä list `summary`, počet osôb a počet
schválených requestov. Ak je hodnota bunky dlhšia než limit Excelu, skript ju
označí ako `TRUNCATED` a počet takých buniek uvedie v `summary`.