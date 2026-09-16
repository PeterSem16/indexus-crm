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

- `persons` — všetky netajné stĺpce z `collaborators`, údaje o adresách a
  `collaborator_other_data` v JSON stĺpcoch a súhrnné príznaky kampane.
- `campaign_requests` — jeden riadok na request, stav, email použitý v kampani,
  dátumy odoslania/otvorenia/odovzdania/schválenia a odoslané dáta.
- `field_audit` — každý formulárom odoslaný údaj. Obsahuje príznaky:
  `obtained_in_campaign`, `changed_in_submission`,
  `updated_by_this_campaign` a aktuálnu hodnotu v databáze.
- `campaign_changes` — jeden riadok na pole, ktoré aplikácia pri odovzdaní
  zaznamenala ako zmenené; obsahuje pôvodnú a novú hodnotu, cieľové pole,
  hodnotu zapisovanú pri schválení a výsledok porovnania s databázou.
- `field_snapshots` — read-only kontrola riadkov z `contact_field_snapshots`
  pre `campaign_id` danej kampane. Ak je list prázdny, pre kampaň nebol nájdený
  žiadny delta-tracking snapshot.
- `addresses` — všetky adresné riadky osoby.
- `other_data` — riadky z `collaborator_other_data`.
- `summary` — počty a identifikácia kampane.
- `README` — význam stĺpcov a limity exportu.

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