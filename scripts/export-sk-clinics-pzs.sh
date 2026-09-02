#!/usr/bin/env bash
#
# Export slovenských kliník s vyplneným PZS kódom a všetkých ich prepojených
# osôb/personálu. Spúšťa sa priamo na Ubuntu serveri s lokálnym PostgreSQL.
#
# Použitie:
#   bash scripts/export-sk-clinics-pzs.sh
#   bash scripts/export-sk-clinics-pzs.sh /home/user/exports/clinics
#
# Ak DATABASE_URL nie je v prostredí, načíta sa iba z /var/www/indexus-crm/.env
# (alebo z APP_DIR/.env). Hodnota sa nikdy nevypisuje.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(cd -- "$SCRIPT_DIR/.." && pwd)}"
OUT_DIR="${1:-"$APP_DIR/export-sk-clinics-pzs-$(date +%Y%m%d_%H%M%S)"}"
mkdir -p "$OUT_DIR"

if ! command -v psql >/dev/null 2>&1; then
  echo "Chyba: psql nie je nainštalované." >&2
  exit 1
fi

DATABASE_URL="${DATABASE_URL:-}"
if [[ -z "$DATABASE_URL" ]]; then
  ENV_FILE="$APP_DIR/.env"
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "Chyba: DATABASE_URL nie je v prostredí a súbor $ENV_FILE neexistuje." >&2
    exit 1
  fi
  DATABASE_URL="$(
    node -e '
      const fs = require("fs");
      const line = fs.readFileSync(process.argv[1], "utf8")
        .split(/\r?\n/)
        .find(x => x.startsWith("DATABASE_URL="));
      if (line) {
        let value = line.slice("DATABASE_URL=".length).trim();
        if ((value.startsWith("\"") && value.endsWith("\"")) ||
            (value.startsWith("'"'"'") && value.endsWith("'"'"'"))) {
          value = value.slice(1, -1);
        }
        process.stdout.write(value);
      }
    ' "$ENV_FILE"
  )"
fi

if [[ -z "$DATABASE_URL" ]]; then
  echo "Chyba: DATABASE_URL je prázdne." >&2
  exit 1
fi

CLINICS_FILE="$OUT_DIR/clinics.csv"
PERSONNEL_FILE="$OUT_DIR/personnel.csv"
ASSIGNMENTS_FILE="$OUT_DIR/personnel_assignments.csv"
ADDRESSES_FILE="$OUT_DIR/personnel_addresses.csv"
CHANNELS_FILE="$OUT_DIR/personnel_channels.csv"
OTHER_DATA_FILE="$OUT_DIR/personnel_other_data.csv"
AGREEMENTS_FILE="$OUT_DIR/personnel_agreements.csv"

# Zober všetky stĺpce collaborators okrem credential hashu. Výstup tak ostane
# úplný aj po pridaní nového ne-citlivého stĺpca do tabuľky.
PERSON_COLUMNS="$(
  psql "$DATABASE_URL" -Atq -v ON_ERROR_STOP=1 -c "
    SELECT string_agg(
      format('p.%I AS %I', column_name, column_name),
      ', ' ORDER BY ordinal_position
    )
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'collaborators'
      AND column_name <> 'mobile_password_hash'
  "
)"

if [[ -z "$PERSON_COLUMNS" ]]; then
  echo "Chyba: tabuľka collaborators nemá dostupné stĺpce." >&2
  exit 1
fi

export_query() {
  local output="$1"
  psql "$DATABASE_URL" --csv -v ON_ERROR_STOP=1 \
    -v person_columns="$PERSON_COLUMNS" -f - > "$output"
}

export_query "$CLINICS_FILE" <<'SQL'
  SELECT c.*
  FROM public.clinics c
  WHERE upper(trim(coalesce(c.country_code, ''))) = 'SK'
    AND nullif(trim(c.pzs_code), '') IS NOT NULL
  ORDER BY c.name, c.id
SQL

# Jeden riadok za každé prepojenie osoba–klinika. Zahrnuté sú aj staršie
# väzby cez collaborators.clinic_id / clinic_ids, ak nemajú contact_assignment.
export_query "$PERSONNEL_FILE" <<'SQL'
  WITH eligible_clinics AS (
    SELECT c.id, c.name, c.pzs_code
    FROM public.clinics c
    WHERE upper(trim(coalesce(c.country_code, ''))) = 'SK'
      AND nullif(trim(c.pzs_code), '') IS NOT NULL
  ),
  links AS (
    SELECT
      c.id AS clinic_id, c.name AS clinic_name, c.pzs_code,
      ca.person_id, ca.id AS assignment_id, 'contact_assignment' AS link_source
    FROM eligible_clinics c
    JOIN public.contact_assignments ca
      ON ca.entity_type = 'clinic' AND ca.entity_id = c.id
    UNION ALL
    SELECT
      c.id AS clinic_id, c.name AS clinic_name, c.pzs_code,
      p.id AS person_id, NULL::text AS assignment_id, 'legacy_clinic_link' AS link_source
    FROM eligible_clinics c
    JOIN public.collaborators p
      ON p.clinic_id = c.id OR c.id = ANY(coalesce(p.clinic_ids, ARRAY[]::text[]))
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.contact_assignments ca
      WHERE ca.entity_type = 'clinic'
        AND ca.entity_id = c.id
        AND ca.person_id = p.id
    )
  )
  SELECT
    l.clinic_id, l.clinic_name, l.pzs_code,
    l.link_source, l.assignment_id,
    :person_columns
  FROM links l
  JOIN public.collaborators p ON p.id = l.person_id
  ORDER BY l.clinic_name, p.last_name, p.first_name, p.id
SQL

export_query "$ASSIGNMENTS_FILE" <<'SQL'
  WITH eligible_clinics AS (
    SELECT c.id
    FROM public.clinics c
    WHERE upper(trim(coalesce(c.country_code, ''))) = 'SK'
      AND nullif(trim(c.pzs_code), '') IS NOT NULL
  ),
  linked_people AS (
    SELECT ca.person_id
    FROM public.contact_assignments ca
    JOIN eligible_clinics c ON c.id = ca.entity_id
    WHERE ca.entity_type = 'clinic'
    UNION
    SELECT p.id
    FROM public.collaborators p
    JOIN eligible_clinics c
      ON p.clinic_id = c.id OR c.id = ANY(coalesce(p.clinic_ids, ARRAY[]::text[]))
  )
  SELECT ca.id AS assignment_id, ca.entity_type, ca.entity_id AS clinic_id,
         ca.person_id, ca.category_id, ca.department, ca.position, ca.role,
         ca.subcategory, ca.is_primary, ca.notes, ca.is_active,
         ca.start_date, ca.end_date, ca.cbc_activity_codes,
         ca.created_at, ca.updated_at
  FROM public.contact_assignments ca
  JOIN eligible_clinics c ON c.id = ca.entity_id
  WHERE ca.entity_type = 'clinic'
  ORDER BY ca.entity_id, ca.person_id, ca.id
SQL

export_query "$ADDRESSES_FILE" <<'SQL'
  WITH eligible_clinics AS (
    SELECT c.id
    FROM public.clinics c
    WHERE upper(trim(coalesce(c.country_code, ''))) = 'SK'
      AND nullif(trim(c.pzs_code), '') IS NOT NULL
  ),
  linked_people AS (
    SELECT ca.person_id
    FROM public.contact_assignments ca
    JOIN eligible_clinics c ON c.id = ca.entity_id
    WHERE ca.entity_type = 'clinic'
    UNION
    SELECT p.id
    FROM public.collaborators p
    JOIN eligible_clinics c
      ON p.clinic_id = c.id OR c.id = ANY(coalesce(p.clinic_ids, ARRAY[]::text[]))
  )
  SELECT a.*
  FROM public.collaborator_addresses a
  JOIN linked_people lp ON lp.person_id = a.collaborator_id
  ORDER BY a.collaborator_id, a.address_type, a.id
SQL

export_query "$CHANNELS_FILE" <<'SQL'
  WITH eligible_clinics AS (
    SELECT c.id
    FROM public.clinics c
    WHERE upper(trim(coalesce(c.country_code, ''))) = 'SK'
      AND nullif(trim(c.pzs_code), '') IS NOT NULL
  ),
  linked_people AS (
    SELECT ca.person_id
    FROM public.contact_assignments ca
    JOIN eligible_clinics c ON c.id = ca.entity_id
    WHERE ca.entity_type = 'clinic'
    UNION
    SELECT p.id
    FROM public.collaborators p
    JOIN eligible_clinics c
      ON p.clinic_id = c.id OR c.id = ANY(coalesce(p.clinic_ids, ARRAY[]::text[]))
  )
  SELECT ch.*
  FROM public.contact_channels ch
  JOIN linked_people lp ON lp.person_id = ch.person_id
  ORDER BY ch.person_id, ch.channel_type, ch.id
SQL

export_query "$OTHER_DATA_FILE" <<'SQL'
  WITH eligible_clinics AS (
    SELECT c.id
    FROM public.clinics c
    WHERE upper(trim(coalesce(c.country_code, ''))) = 'SK'
      AND nullif(trim(c.pzs_code), '') IS NOT NULL
  ),
  linked_people AS (
    SELECT ca.person_id
    FROM public.contact_assignments ca
    JOIN eligible_clinics c ON c.id = ca.entity_id
    WHERE ca.entity_type = 'clinic'
    UNION
    SELECT p.id
    FROM public.collaborators p
    JOIN eligible_clinics c
      ON p.clinic_id = c.id OR c.id = ANY(coalesce(p.clinic_ids, ARRAY[]::text[]))
  )
  SELECT od.*
  FROM public.collaborator_other_data od
  JOIN linked_people lp ON lp.person_id = od.collaborator_id
  ORDER BY od.collaborator_id, od.id
SQL

export_query "$AGREEMENTS_FILE" <<'SQL'
  WITH eligible_clinics AS (
    SELECT c.id
    FROM public.clinics c
    WHERE upper(trim(coalesce(c.country_code, ''))) = 'SK'
      AND nullif(trim(c.pzs_code), '') IS NOT NULL
  ),
  linked_people AS (
    SELECT ca.person_id
    FROM public.contact_assignments ca
    JOIN eligible_clinics c ON c.id = ca.entity_id
    WHERE ca.entity_type = 'clinic'
    UNION
    SELECT p.id
    FROM public.collaborators p
    JOIN eligible_clinics c
      ON p.clinic_id = c.id OR c.id = ANY(coalesce(p.clinic_ids, ARRAY[]::text[]))
  )
  SELECT ag.*
  FROM public.collaborator_agreements ag
  JOIN linked_people lp ON lp.person_id = ag.collaborator_id
  ORDER BY ag.collaborator_id, ag.id
SQL

echo "Export dokončený: $OUT_DIR"
for file in \
  "$CLINICS_FILE" \
  "$PERSONNEL_FILE" \
  "$ASSIGNMENTS_FILE" \
  "$ADDRESSES_FILE" \
  "$CHANNELS_FILE" \
  "$OTHER_DATA_FILE" \
  "$AGREEMENTS_FILE"; do
  printf '  %-34s %s riadkov\n' "$(basename "$file")" "$(( $(wc -l < "$file") - 1 ))"
done
echo "Poznámka: mobile_password_hash nebol exportovaný."