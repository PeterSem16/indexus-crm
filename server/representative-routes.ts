// ============================================================
// Representative Assignment Routes
// Priradenie reprezentanta ku klinike s históriou platnosti.
// ============================================================
import type { Express, Request, Response, NextFunction } from "express";
import { db, pool } from "./db";
import { eq, and, isNull, lte, or, gt, inArray, desc, sql } from "drizzle-orm";
import {
  clinicRepresentativeAssignments,
  hospitalRepresentativeAssignments,
  clinics,
  hospitals,
  collaborators,
  contactAssignments,
  users,
  roles,
  userRoles,
} from "@shared/schema";
import {
  matchesMedicalPartnerRules,
  matchesMedicalPartnerSearch,
  previewSelectionMatches,
  validateMedicalPartnerRules,
  type MedicalPartnerEntity,
  type MedicalPartnerFilterRule,
} from "@shared/medical-partner-filter";
import { COUNTRIES } from "@shared/schema";
import { createHash } from "node:crypto";

// ── Auth helpers ─────────────────────────────────────────────────────────────
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session?.user) return res.status(401).json({ message: "Unauthorized" });
  next();
};

const requireManagerOrAdmin = (req: Request, res: Response, next: NextFunction) => {
  const role = req.session?.user?.role;
  if (role !== "admin" && role !== "manager") {
    return res.status(403).json({ message: "Requires manager or admin role" });
  }
  next();
};

type BulkCriteria = {
  country?: string;
  countries?: string[];
  region?: string | string[];
  district?: string | string[];
  city?: string | string[];
  currentRepresentativeId?: string | null;
  isActive?: boolean;
  filterRules?: unknown;
  search?: string;
  countryScope?: unknown;
};

type BulkSelectionInput = {
  entity: MedicalPartnerEntity;
  criteria: BulkCriteria;
  explicitIds?: string[];
  fromUserId?: string;
  req: Request;
};

const OPERATING_COUNTRIES = new Set(COUNTRIES.map((country) => country.code));

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseStringList(value: unknown, name: string): string[] | undefined {
  if (value === undefined) return undefined;
  const list = Array.isArray(value) ? value : [value];
  if (list.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`${name} must contain non-empty strings`);
  }
  return list as string[];
}

function parseCriteria(raw: unknown): BulkCriteria {
  if (raw === undefined) return {};
  if (!isObject(raw)) throw new Error("criteria must be an object");
  const allowed = new Set([
    "country", "countries", "region", "district", "city", "currentRepresentativeId",
    "isActive", "filterRules", "search", "countryScope",
  ]);
  for (const key of Object.keys(raw)) {
    if (!allowed.has(key)) throw new Error(`Unsupported criteria field: ${key}`);
  }
  if (raw.country !== undefined && (typeof raw.country !== "string" || !raw.country.trim())) {
    throw new Error("criteria.country must be a non-empty string");
  }
  if (raw.isActive !== undefined && typeof raw.isActive !== "boolean") {
    throw new Error("criteria.isActive must be a boolean");
  }
  if (
    raw.currentRepresentativeId !== undefined
    && raw.currentRepresentativeId !== null
    && (typeof raw.currentRepresentativeId !== "string" || !raw.currentRepresentativeId.trim())
  ) {
    throw new Error("criteria.currentRepresentativeId must be a string or null");
  }
  const criteria: BulkCriteria = {
    country: raw.country as string | undefined,
    countries: parseStringList(raw.countries, "criteria.countries"),
    region: Array.isArray(raw.region)
      ? parseStringList(raw.region, "criteria.region")
      : raw.region as string | undefined,
    district: Array.isArray(raw.district)
      ? parseStringList(raw.district, "criteria.district")
      : raw.district as string | undefined,
    city: Array.isArray(raw.city)
      ? parseStringList(raw.city, "criteria.city")
      : raw.city as string | undefined,
    currentRepresentativeId: raw.currentRepresentativeId as string | null | undefined,
    isActive: raw.isActive as boolean | undefined,
    filterRules: raw.filterRules,
    search: raw.search as string | undefined,
    countryScope: raw.countryScope,
  };
  for (const [name, value] of [["region", criteria.region], ["district", criteria.district], ["city", criteria.city]] as const) {
    if (value !== undefined) {
      const values = Array.isArray(value) ? value : [value];
      if (values.some((item) => typeof item !== "string" || !item.trim())) {
        throw new Error(`criteria.${name} must contain non-empty strings`);
      }
    }
  }
  if (criteria.search !== undefined && typeof criteria.search !== "string") {
    throw new Error("criteria.search must be a string");
  }
  return criteria;
}

function parseCountryCodes(value: unknown, name: string): string[] | undefined {
  const list = parseStringList(value, name);
  if (!list) return undefined;
  const normalized = [...new Set(list.map((country) => country.toUpperCase()))];
  const invalid = normalized.filter((country) => !OPERATING_COUNTRIES.has(country));
  if (invalid.length) throw new Error(`${name} contains unsupported country code(s): ${invalid.join(", ")}`);
  return normalized;
}

function countryScopeForRequest(req: Request, requested: unknown): string[] | undefined {
  const requestedCodes = parseCountryCodes(requested, "criteria.countryScope");
  const assigned = req.session.user?.assignedCountries;
  const assignedCodes = req.session.user?.role !== "admin" && Array.isArray(assigned) && assigned.length
    ? parseCountryCodes(assigned, "user.assignedCountries")
    : undefined;
  if (!assignedCodes) return requestedCodes;
  if (!requestedCodes) return assignedCodes;
  return requestedCodes.filter((country) => assignedCodes.includes(country));
}

function valuesForCriteria(value: string | string[] | undefined): string[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

function validatePreviewIds(raw: unknown, name: string): string[] {
  if (!Array.isArray(raw) || raw.some((id) => typeof id !== "string" || !id.trim())) {
    throw new Error(`${name} must be an array of non-empty strings`);
  }
  return raw;
}

/**
 * Resolve the complete selection on the server.  It intentionally does not
 * use page/limit or a client-provided count, so preview and confirm operate
 * on the same full set.
 */
async function resolveBulkSelection(input: BulkSelectionInput): Promise<{
  ids: string[];
  rules: MedicalPartnerFilterRule[];
  scope: string[] | undefined;
}> {
  const { entity, criteria, explicitIds, fromUserId, req } = input;
  const rawRules = criteria.filterRules;
  const rules = validateMedicalPartnerRules(entity, rawRules);
  const scope = countryScopeForRequest(req, criteria.countryScope);
  const table = entity === "clinic" ? clinics : hospitals;
  const assignmentTable = entity === "clinic"
    ? clinicRepresentativeAssignments
    : hospitalRepresentativeAssignments;
  const assignmentKey = entity === "clinic"
    ? clinicRepresentativeAssignments.clinicId
    : hospitalRepresentativeAssignments.hospitalId;
  const activeAssignments = await db
    .select({ entityId: assignmentKey, userId: assignmentTable.userId })
    .from(assignmentTable)
    .where(isNull(assignmentTable.validTo));
  const representativeByEntity = new Map(
    activeAssignments.map((row) => [row.entityId, row.userId]),
  );

  const personnelRows = await db
    .select({ entityId: contactAssignments.entityId })
    .from(contactAssignments)
    .where(
      and(
        eq(contactAssignments.entityType, entity),
        eq(contactAssignments.isActive, true),
      ),
    );
  const personnelByEntity = new Set(personnelRows.map((row) => row.entityId));
  if (entity === "hospital") {
    const legacyRows = await db.select({
      hospitalId: collaborators.hospitalId,
      hospitalIds: collaborators.hospitalIds,
    }).from(collaborators);
    // Legacy links are part of the existing Hospitals personnel filter.  They
    // are included here without changing the clinic semantics.
    for (const row of legacyRows) {
      const linked = [
        row.hospitalId,
        ...(Array.isArray(row.hospitalIds) ? row.hospitalIds : []),
      ].filter(Boolean) as string[];
      for (const id of linked) {
        personnelByEntity.add(id);
      }
    }
  }

  const rows = await db.select().from(table);
  const countryValues = [
    ...valuesForCriteria(criteria.country),
    ...valuesForCriteria(criteria.countries),
  ].map((country) => country.toUpperCase());
  const regionValues = valuesForCriteria(criteria.region);
  const districtValues = valuesForCriteria(criteria.district);
  const cityValues = valuesForCriteria(criteria.city);
  const explicitSet = explicitIds ? new Set(explicitIds) : null;

  return {
    ids: rows
      .filter((row) => {
        const id = row.id;
        if (explicitSet && !explicitSet.has(id)) return false;
        if (scope && !scope.includes(row.countryCode)) return false;
        if (countryValues.length && !countryValues.includes(row.countryCode)) return false;
        if (criteria.isActive !== undefined && row.isActive !== criteria.isActive) return false;
        if (regionValues.length && !regionValues.includes(row.region || "")) return false;
        if (districtValues.length && !districtValues.includes(row.district || "")) return false;
        if (cityValues.length && !cityValues.includes(row.city || "")) return false;
        if (!matchesMedicalPartnerSearch(entity, row as Record<string, any>, criteria.search)) return false;
        const representativeId = representativeByEntity.get(id) ?? null;
        if (
          criteria.currentRepresentativeId !== undefined
          && representativeId !== criteria.currentRepresentativeId
        ) return false;
        if (fromUserId && representativeId !== fromUserId) return false;
        return matchesMedicalPartnerRules(entity, row as Record<string, any>, rules, {
          representativeId,
          hasPersonnel: personnelByEntity.has(id),
        });
      })
      .sort(),
    rules,
    scope,
  };
}

function bulkPreviewFingerprint(input: {
  entity: MedicalPartnerEntity;
  targetUserId: string;
  fromUserId?: string;
  criteria: BulkCriteria;
  rules: MedicalPartnerFilterRule[];
  scope: string[] | undefined;
  ids: string[];
}): string {
  const canonical = {
    entity: input.entity,
    targetUserId: input.targetUserId,
    fromUserId: input.fromUserId ?? null,
    criteria: {
      country: input.criteria.country ?? null,
      countries: input.criteria.countries ?? null,
      region: input.criteria.region ?? null,
      district: input.criteria.district ?? null,
      city: input.criteria.city ?? null,
      currentRepresentativeId: input.criteria.currentRepresentativeId ?? null,
      isActive: input.criteria.isActive ?? null,
      search: input.criteria.search ?? null,
      scope: input.scope ?? null,
      filterRules: input.rules,
    },
    ids: [...input.ids].sort(),
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

// ── Helper: assignment platné k danému dátumu ─────────────────────────────
function atTimeCondition(clinicIdVal: string, at?: string) {
  const ts = at ? new Date(at) : null;
  if (!ts || isNaN(ts.getTime())) {
    // aktuálne platné: valid_to IS NULL
    return and(
      eq(clinicRepresentativeAssignments.clinicId, clinicIdVal),
      isNull(clinicRepresentativeAssignments.validTo)
    );
  }
  // platné v čase `at`: valid_from <= at AND (valid_to IS NULL OR valid_to > at)
  return and(
    eq(clinicRepresentativeAssignments.clinicId, clinicIdVal),
    lte(clinicRepresentativeAssignments.validFrom, ts),
    or(
      isNull(clinicRepresentativeAssignments.validTo),
      gt(clinicRepresentativeAssignments.validTo, ts)
    )
  );
}

export function registerRepresentativeRoutes(
  app: Express,
  _requireAuthExternal?: (req: Request, res: Response, next: NextFunction) => void
) {

  // ── GET /api/representatives
  // Zoznam všetkých používateľov s rolou Representant.
  // Vracia id, name, email, počet aktuálne pridelených kliník.
  app.get("/api/representatives", requireAuth, async (req, res) => {
    try {
      // Zisti všetky roleId s názvom Representant/Representative
      const representantRoles = await db
        .select({ id: roles.id })
        .from(roles)
        .where(sql`lower(${roles.name}) IN ('representant', 'representative')`);

      const roleIds = representantRoles.map((r) => r.id);

      // Raw pool query — overená cesta, funguje s users.role_id (nullable FK)
      // aj s user_roles many-to-many; rovnaká logika ako Users stránka
      const { rows: reps } = roleIds.length > 0
        ? await pool.query<{ id: string; full_name: string | null; email: string | null }>(
            `SELECT DISTINCT u.id, u.full_name, u.email
             FROM users u
             LEFT JOIN user_roles ur ON ur.user_id = u.id
             WHERE u.is_active = true
               AND (u.role_id = ANY($1) OR ur.role_id = ANY($1))
             ORDER BY u.full_name`,
            [roleIds]
          )
        : { rows: [] as { id: string; full_name: string | null; email: string | null }[] };

      // Počet aktuálne pridelených kliník na reprezentanta
      const clinicCounts = await db
        .select({
          userId: clinicRepresentativeAssignments.userId,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(clinicRepresentativeAssignments)
        .where(isNull(clinicRepresentativeAssignments.validTo))
        .groupBy(clinicRepresentativeAssignments.userId);

      const countMap = new Map(clinicCounts.map((r) => [r.userId, r.count]));

      res.json(
        reps.map((u) => ({
          id: u.id,
          name: u.full_name ?? u.email ?? u.id,
          email: u.email,
          clinicCount: countMap.get(u.id) ?? 0,
        }))
      );
    } catch (e: any) {
      console.error("[representatives] GET /api/representatives", e);
      res.status(500).json({ message: e.message });
    }
  });

  // ── GET /api/clinics/:id/representative
  // Aktuálne priradenie (alebo k dátumu ?at=YYYY-MM-DD).
  app.get("/api/clinics/:id/representative", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const condition = atTimeCondition(id, req.query.at as string | undefined);

      const rows = await db
        .select({
          assignment: clinicRepresentativeAssignments,
          user: {
            id: users.id,
            fullName: users.fullName,
            email: users.email,
          },
        })
        .from(clinicRepresentativeAssignments)
        .leftJoin(users, eq(users.id, clinicRepresentativeAssignments.userId))
        .where(condition)
        .limit(1);

      if (rows.length === 0) return res.json({ assignment: null });

      res.json({ assignment: { ...rows[0].assignment, user: rows[0].user } });
    } catch (e: any) {
      console.error("[representatives] GET /api/clinics/:id/representative", e);
      res.status(500).json({ message: e.message });
    }
  });

  // ── GET /api/clinics/:id/representative/history
  // Kompletná história priradení (od najnovšieho).
  app.get("/api/clinics/:id/representative/history", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const rows = await db
        .select({
          assignment: clinicRepresentativeAssignments,
          user: { id: users.id, fullName: users.fullName, email: users.email },
        })
        .from(clinicRepresentativeAssignments)
        .leftJoin(users, eq(users.id, clinicRepresentativeAssignments.userId))
        .where(eq(clinicRepresentativeAssignments.clinicId, id))
        .orderBy(desc(clinicRepresentativeAssignments.validFrom));

      res.json(rows.map((r) => ({ ...r.assignment, user: r.user })));
    } catch (e: any) {
      console.error("[representatives] GET /api/clinics/:id/representative/history", e);
      res.status(500).json({ message: e.message });
    }
  });

  // ── POST /api/clinics/:id/representative
  // Priradí (alebo zmení) reprezentanta. Starú väzbu uzavrie, vytvorí novú.
  // Body: { userId, validFrom?, note? }
  app.post("/api/clinics/:id/representative", requireAuth, requireManagerOrAdmin, async (req, res) => {
    try {
      const { id: clinicId } = req.params;
      const { userId, validFrom, note } = req.body as {
        userId: string;
        validFrom?: string;
        note?: string;
      };

      if (!userId) return res.status(400).json({ message: "userId is required" });

      const now = new Date();
      const effectiveFrom = validFrom ? new Date(validFrom) : now;

      // Overenie, že klinika existuje
      const clinic = await db.select({ id: clinics.id }).from(clinics).where(eq(clinics.id, clinicId)).limit(1);
      if (!clinic.length) return res.status(404).json({ message: "Clinic not found" });

      // Overenie, že user existuje
      const user = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
      if (!user.length) return res.status(404).json({ message: "User not found" });

      // Uzavri existujúce aktívne priradenie (ak existuje)
      await db
        .update(clinicRepresentativeAssignments)
        .set({ validTo: effectiveFrom })
        .where(
          and(
            eq(clinicRepresentativeAssignments.clinicId, clinicId),
            isNull(clinicRepresentativeAssignments.validTo)
          )
        );

      // Vytvor nové priradenie
      const [created] = await db
        .insert(clinicRepresentativeAssignments)
        .values({
          clinicId,
          userId,
          validFrom: effectiveFrom,
          validTo: null,
          assignedBy: req.session!.user?.id,
          assignmentType: "manual",
          note: note ?? null,
        })
        .returning();

      // Sync priamo na clinic riadok (UI číta clinic.representativeId)
      await db.update(clinics).set({ representativeId: userId }).where(eq(clinics.id, clinicId));

      res.json({ assignment: created });
    } catch (e: any) {
      console.error("[representatives] POST /api/clinics/:id/representative", e);
      res.status(500).json({ message: e.message });
    }
  });

  // ── DELETE /api/clinics/:id/representative
  // Odoberie aktuálne priradenie (uzavrie valid_to = now()).
  app.delete("/api/clinics/:id/representative", requireAuth, requireManagerOrAdmin, async (req, res) => {
    try {
      const { id: clinicId } = req.params;
      const now = new Date();

      const updated = await db
        .update(clinicRepresentativeAssignments)
        .set({ validTo: now })
        .where(
          and(
            eq(clinicRepresentativeAssignments.clinicId, clinicId),
            isNull(clinicRepresentativeAssignments.validTo)
          )
        )
        .returning();

      if (!updated.length) return res.status(404).json({ message: "No active assignment found" });
      // Vymaž priamo z clinic riadku
      await db.update(clinics).set({ representativeId: null }).where(eq(clinics.id, clinicId));
      res.json({ ok: true });
    } catch (e: any) {
      console.error("[representatives] DELETE /api/clinics/:id/representative", e);
      res.status(500).json({ message: e.message });
    }
  });

  // ── GET /api/representatives/:userId/clinics
  // Kliniky v správe daného reprezentanta (aktuálne alebo k dátumu).
  // QueryParams: ?at=&country=&district=&region=&page=&limit=
  app.get("/api/representatives/:userId/clinics", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const { at, country, district, region, page = "1", limit = "50" } = req.query as Record<string, string>;

      const ts = at ? new Date(at) : null;
      const timeCondition = ts && !isNaN(ts.getTime())
        ? and(
            lte(clinicRepresentativeAssignments.validFrom, ts),
            or(isNull(clinicRepresentativeAssignments.validTo), gt(clinicRepresentativeAssignments.validTo, ts))
          )
        : isNull(clinicRepresentativeAssignments.validTo);

      const assignmentWhere = and(
        eq(clinicRepresentativeAssignments.userId, userId),
        timeCondition
      );

      // Zisti klinika IDs cez priradenia
      const assignments = await db
        .select({ clinicId: clinicRepresentativeAssignments.clinicId, validFrom: clinicRepresentativeAssignments.validFrom })
        .from(clinicRepresentativeAssignments)
        .where(assignmentWhere);

      if (!assignments.length) return res.json({ clinics: [], total: 0 });

      const clinicIds = assignments.map((a) => a.clinicId);
      const assignmentMap = new Map(assignments.map((a) => [a.clinicId, a.validFrom]));

      // Filtruj kliniky podľa country/district/region
      let clinicWhere = inArray(clinics.id, clinicIds);
      if (country) clinicWhere = and(clinicWhere, eq(clinics.countryCode, country))!;
      if (district) clinicWhere = and(clinicWhere, eq(clinics.district, district))!;
      if (region) clinicWhere = and(clinicWhere, eq(clinics.region, region))!;

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
      const offset = (pageNum - 1) * limitNum;

      const rows = await db
        .select({
          id: clinics.id,
          name: clinics.name,
          doctorName: clinics.doctorName,
          city: clinics.city,
          district: clinics.district,
          region: clinics.region,
          countryCode: clinics.countryCode,
          phone: clinics.phone,
          contractStatus: clinics.contractStatus,
          interestCooperation: clinics.interestCooperation,
          isActive: clinics.isActive,
        })
        .from(clinics)
        .where(clinicWhere)
        .orderBy(clinics.name)
        .limit(limitNum)
        .offset(offset);

      res.json({
        clinics: rows.map((c) => ({
          ...c,
          assignedSince: assignmentMap.get(c.id) ?? null,
        })),
        total: clinicIds.length,
      });
    } catch (e: any) {
      console.error("[representatives] GET /api/representatives/:userId/clinics", e);
      res.status(500).json({ message: e.message });
    }
  });

  // ── GET /api/clinics/distinct-cities is registered early in routes.ts (before /api/clinics/:id)

  // ── GET /api/hospitals/distinct-cities
  app.get("/api/hospitals/distinct-cities", requireAuth, async (req, res) => {
    try {
      const { countries, regions, districts } = req.query as Record<string, string>;
      const conditions: string[] = ["city IS NOT NULL", "city != ''"];
      const params: any[] = [];
      if (countries) {
        const arr = countries.split(",").filter(Boolean);
        params.push(arr);
        conditions.push(`country_code = ANY($${params.length})`);
      }
      if (regions) {
        const arr = regions.split(",").filter(Boolean);
        params.push(arr);
        conditions.push(`region = ANY($${params.length})`);
      }
      if (districts) {
        const arr = districts.split(",").filter(Boolean);
        params.push(arr);
        conditions.push(`district = ANY($${params.length})`);
      }
      const { rows } = await pool.query(
        `SELECT DISTINCT city FROM hospitals WHERE ${conditions.join(" AND ")} ORDER BY city`,
        params
      );
      res.json(rows.map((r: any) => r.city));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── POST /api/clinics/bulk-assign-representative
  // Hromadné priradenie podľa kritérií.  Both preview and confirm resolve the
  // complete selection server-side; confirm also verifies the preview IDs.
  app.post("/api/clinics/bulk-assign-representative", requireAuth, requireManagerOrAdmin, async (req, res) => {
    try {
      const body = isObject(req.body) ? req.body : {};
      const userId = body.userId;
      if (typeof userId !== "string" || !userId.trim()) {
        return res.status(400).json({ message: "userId is required" });
      }
      const criteria = parseCriteria(body.criteria);
      const explicitClinicIds = body.clinicIds === undefined
        ? undefined
        : validatePreviewIds(body.clinicIds, "clinicIds");
      const dryRun = body.dryRun === true;
      const previewIds = body.previewIds === undefined
        ? undefined
        : validatePreviewIds(body.previewIds, "previewIds");
      const now = new Date();
      const effectiveFrom = body.validFrom ? new Date(String(body.validFrom)) : now;
      if (isNaN(effectiveFrom.getTime())) return res.status(400).json({ message: "validFrom must be a valid date" });
      const selection = await resolveBulkSelection({
        entity: "clinic",
        criteria,
        explicitIds: explicitClinicIds,
        req,
      });
      const targetClinicIds = selection.ids;
      const previewFingerprint = bulkPreviewFingerprint({
        entity: "clinic",
        targetUserId: userId,
        criteria,
        rules: selection.rules,
        scope: selection.scope,
        ids: targetClinicIds,
      });
      if (dryRun) return res.json({
        affected: targetClinicIds.length,
        skipped: 0,
        clinicIds: targetClinicIds,
        previewIds: targetClinicIds,
        previewTargetUserId: userId,
        previewFingerprint,
        dryRun: true,
      });
      if (!previewIds) return res.status(400).json({ message: "A fresh preview is required before confirming" });
      if (typeof body.previewFingerprint !== "string" || body.previewFingerprint !== previewFingerprint) {
        return res.status(409).json({ message: "Preview metadata changed; run preview again" });
      }
      if (body.previewTargetUserId !== undefined && body.previewTargetUserId !== userId) {
        return res.status(409).json({ message: "Preview target representative changed; run preview again" });
      }
      if (!previewSelectionMatches(previewIds, targetClinicIds)) {
        return res.status(409).json({ message: "Preview is stale; run preview again" });
      }

      // Ostrý zápis — pre každú kliniku: uzavri starú väzbu + vytvor novú
      let affected = 0;
      let skipped = 0;

      // Batch: uzavri všetky aktívne priradenia naraz
      if (targetClinicIds.length > 0) {
        await db
          .update(clinicRepresentativeAssignments)
          .set({ validTo: effectiveFrom })
          .where(
            and(
              inArray(clinicRepresentativeAssignments.clinicId, targetClinicIds),
              isNull(clinicRepresentativeAssignments.validTo)
            )
          );

        // Batch insert nových priradení
        const insertValues = targetClinicIds.map((clinicId) => ({
          clinicId,
          userId,
          validFrom: effectiveFrom,
          validTo: null as null,
          assignedBy: req.session!.user?.id,
          assignmentType: criteria.district
             ? "bulk_district"
            : criteria.region
            ? "bulk_region"
            : "manual",
           note: typeof body.note === "string" ? body.note : null,
        }));

        await db.insert(clinicRepresentativeAssignments).values(insertValues);
        // Sync priamo na clinic riadky
        await db.update(clinics).set({ representativeId: userId }).where(inArray(clinics.id, targetClinicIds));
        affected = targetClinicIds.length;
      }

      res.json({ affected, skipped, clinicIds: targetClinicIds });
    } catch (e: any) {
      if (e instanceof Error && /filterRules|criteria|countryScope|clinicIds|previewIds|validFrom|Unsupported/.test(e.message)) {
        return res.status(400).json({ message: e.message });
      }
      console.error("[representatives] POST /api/clinics/bulk-assign-representative", e);
      res.status(500).json({ message: e.message });
    }
  });

  // ── POST /api/clinics/swap-representative
  // Rýchla výmena: presunie kliniky od jedného reprezentanta k inému.
  // Supports the same full criteria/preview contract as bulk assignment.
  app.post("/api/clinics/swap-representative", requireAuth, requireManagerOrAdmin, async (req, res) => {
    try {
      const body = isObject(req.body) ? req.body : {};
      const fromUserId = body.fromUserId;
      const toUserId = body.toUserId;
      if (typeof fromUserId !== "string" || !fromUserId || typeof toUserId !== "string" || !toUserId) {
        return res.status(400).json({ message: "fromUserId and toUserId are required" });
      }
      if (fromUserId === toUserId) {
        return res.status(400).json({ message: "fromUserId and toUserId must be different" });
      }
      const criteria = parseCriteria(body.criteria);
      const explicitClinicIds = body.clinicIds === undefined
        ? undefined
        : validatePreviewIds(body.clinicIds, "clinicIds");
      const dryRun = body.dryRun === true;
      const previewIds = body.previewIds === undefined
        ? undefined
        : validatePreviewIds(body.previewIds, "previewIds");
      const effectiveFrom = body.validFrom ? new Date(String(body.validFrom)) : new Date();
      if (isNaN(effectiveFrom.getTime())) return res.status(400).json({ message: "validFrom must be a valid date" });
      const selection = await resolveBulkSelection({
        entity: "clinic",
        criteria,
        explicitIds: explicitClinicIds,
        fromUserId,
        req,
      });
      const targetClinicIds = selection.ids;
      const previewFingerprint = bulkPreviewFingerprint({
        entity: "clinic",
        targetUserId: toUserId,
        fromUserId,
        criteria,
        rules: selection.rules,
        scope: selection.scope,
        ids: targetClinicIds,
      });
      if (dryRun) return res.json({
        swapped: targetClinicIds.length,
        affected: targetClinicIds.length,
        clinicIds: targetClinicIds,
        previewIds: targetClinicIds,
        previewTargetUserId: toUserId,
        previewFingerprint,
        dryRun: true,
      });
      if (!previewIds) return res.status(400).json({ message: "A fresh preview is required before confirming" });
      if (typeof body.previewFingerprint !== "string" || body.previewFingerprint !== previewFingerprint) {
        return res.status(409).json({ message: "Preview metadata changed; run preview again" });
      }
      if (body.previewTargetUserId !== undefined && body.previewTargetUserId !== toUserId) {
        return res.status(409).json({ message: "Preview target representative changed; run preview again" });
      }
      if (!previewSelectionMatches(previewIds, targetClinicIds)) {
        return res.status(409).json({ message: "Preview is stale; run preview again" });
      }
      if (targetClinicIds.length === 0) return res.json({ swapped: 0, clinicIds: [] });

      // Uzavri staré priradenia
      await db
        .update(clinicRepresentativeAssignments)
        .set({ validTo: effectiveFrom })
        .where(
          and(
            inArray(clinicRepresentativeAssignments.clinicId, targetClinicIds),
            eq(clinicRepresentativeAssignments.userId, fromUserId),
            isNull(clinicRepresentativeAssignments.validTo)
          )
        );

      // Vytvor nové priradenia pre toUserId
      const insertValues = targetClinicIds.map((clinicId) => ({
        clinicId,
        userId: toUserId,
        validFrom: effectiveFrom,
        validTo: null as null,
        assignedBy: req.session!.user?.id,
        assignmentType: "swap" as const,
         note: typeof body.note === "string" ? body.note : null,
      }));

      await db.insert(clinicRepresentativeAssignments).values(insertValues);
      // Sync priamo na clinic riadky
      await db.update(clinics).set({ representativeId: toUserId }).where(inArray(clinics.id, targetClinicIds));

      res.json({ swapped: targetClinicIds.length, clinicIds: targetClinicIds });
    } catch (e: any) {
      if (e instanceof Error && /filterRules|criteria|countryScope|clinicIds|previewIds|validFrom|Unsupported/.test(e.message)) {
        return res.status(400).json({ message: e.message });
      }
      console.error("[representatives] POST /api/clinics/swap-representative", e);
      res.status(500).json({ message: e.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // HOSPITAL routes — symetrické ku clinic routes, používajú hospital_representative_assignments
  // ═══════════════════════════════════════════════════════════════════════════

  // ── GET /api/hospitals/:id/representative
  app.get("/api/hospitals/:id/representative", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const at = req.query.at as string | undefined;
      const ts = at ? new Date(at) : null;
      const timeCondition = ts && !isNaN(ts.getTime())
        ? and(lte(hospitalRepresentativeAssignments.validFrom, ts), or(isNull(hospitalRepresentativeAssignments.validTo), gt(hospitalRepresentativeAssignments.validTo, ts)))
        : isNull(hospitalRepresentativeAssignments.validTo);
      const condition = and(eq(hospitalRepresentativeAssignments.hospitalId, id), timeCondition);
      const rows = await db.select({ assignment: hospitalRepresentativeAssignments, user: { id: users.id, fullName: users.fullName, email: users.email } })
        .from(hospitalRepresentativeAssignments).leftJoin(users, eq(users.id, hospitalRepresentativeAssignments.userId))
        .where(condition).limit(1);
      if (!rows.length) return res.json({ assignment: null });
      res.json({ assignment: { ...rows[0].assignment, user: rows[0].user } });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── GET /api/hospitals/:id/representative/history
  app.get("/api/hospitals/:id/representative/history", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const rows = await db.select({ assignment: hospitalRepresentativeAssignments, user: { id: users.id, fullName: users.fullName, email: users.email } })
        .from(hospitalRepresentativeAssignments).leftJoin(users, eq(users.id, hospitalRepresentativeAssignments.userId))
        .where(eq(hospitalRepresentativeAssignments.hospitalId, id))
        .orderBy(desc(hospitalRepresentativeAssignments.validFrom));
      res.json(rows.map(r => ({ ...r.assignment, user: r.user })));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── POST /api/hospitals/:id/representative
  app.post("/api/hospitals/:id/representative", requireAuth, requireManagerOrAdmin, async (req, res) => {
    try {
      const { id: hospitalId } = req.params;
      const { userId, validFrom, note } = req.body as { userId: string; validFrom?: string; note?: string };
      if (!userId) return res.status(400).json({ message: "userId is required" });
      const effectiveFrom = validFrom ? new Date(validFrom) : new Date();
      const hospital = await db.select({ id: hospitals.id }).from(hospitals).where(eq(hospitals.id, hospitalId)).limit(1);
      if (!hospital.length) return res.status(404).json({ message: "Hospital not found" });
      await db.update(hospitalRepresentativeAssignments).set({ validTo: effectiveFrom })
        .where(and(eq(hospitalRepresentativeAssignments.hospitalId, hospitalId), isNull(hospitalRepresentativeAssignments.validTo)));
      const [created] = await db.insert(hospitalRepresentativeAssignments).values({
        hospitalId, userId, validFrom: effectiveFrom, validTo: null,
        assignedBy: req.session!.user?.id, assignmentType: "manual", note: note ?? null,
      }).returning();
      // Sync priamo na hospital riadok
      await db.update(hospitals).set({ representativeId: userId }).where(eq(hospitals.id, hospitalId));
      res.json({ assignment: created });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── DELETE /api/hospitals/:id/representative
  app.delete("/api/hospitals/:id/representative", requireAuth, requireManagerOrAdmin, async (req, res) => {
    try {
      const { id: hospitalId } = req.params;
      const updated = await db.update(hospitalRepresentativeAssignments).set({ validTo: new Date() })
        .where(and(eq(hospitalRepresentativeAssignments.hospitalId, hospitalId), isNull(hospitalRepresentativeAssignments.validTo)))
        .returning();
      if (!updated.length) return res.status(404).json({ message: "No active assignment found" });
      // Vymaž priamo z hospital riadku
      await db.update(hospitals).set({ representativeId: null }).where(eq(hospitals.id, hospitalId));
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── GET /api/representatives/:userId/hospitals
  app.get("/api/representatives/:userId/hospitals", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const { at, page = "1", limit = "50" } = req.query as Record<string, string>;
      const ts = at ? new Date(at) : null;
      const timeCondition = ts && !isNaN(ts.getTime())
        ? and(lte(hospitalRepresentativeAssignments.validFrom, ts), or(isNull(hospitalRepresentativeAssignments.validTo), gt(hospitalRepresentativeAssignments.validTo, ts)))
        : isNull(hospitalRepresentativeAssignments.validTo);
      const assignments = await db.select({ hospitalId: hospitalRepresentativeAssignments.hospitalId, validFrom: hospitalRepresentativeAssignments.validFrom })
        .from(hospitalRepresentativeAssignments)
        .where(and(eq(hospitalRepresentativeAssignments.userId, userId), timeCondition));
      if (!assignments.length) return res.json({ hospitals: [], total: 0 });
      const hospitalIds = assignments.map(a => a.hospitalId);
      const assignmentMap = new Map(assignments.map(a => [a.hospitalId, a.validFrom]));
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
      const rows = await db.select({ id: hospitals.id, name: hospitals.name, city: hospitals.city, district: hospitals.district, region: hospitals.region, countryCode: hospitals.countryCode, phone: hospitals.phone, isActive: hospitals.isActive })
        .from(hospitals).where(inArray(hospitals.id, hospitalIds)).orderBy(hospitals.name).limit(limitNum).offset((pageNum - 1) * limitNum);
      res.json({ hospitals: rows.map(h => ({ ...h, assignedSince: assignmentMap.get(h.id) ?? null })), total: hospitalIds.length });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── POST /api/hospitals/bulk-assign-representative
  app.post("/api/hospitals/bulk-assign-representative", requireAuth, requireManagerOrAdmin, async (req, res) => {
    try {
      const body = isObject(req.body) ? req.body : {};
      const userId = body.userId;
      if (typeof userId !== "string" || !userId.trim()) {
        return res.status(400).json({ message: "userId is required" });
      }
      const criteria = parseCriteria(body.criteria);
      const explicitIds = body.hospitalIds === undefined
        ? undefined
        : validatePreviewIds(body.hospitalIds, "hospitalIds");
      const dryRun = body.dryRun === true;
      const previewIds = body.previewIds === undefined
        ? undefined
        : validatePreviewIds(body.previewIds, "previewIds");
      const effectiveFrom = body.validFrom ? new Date(String(body.validFrom)) : new Date();
      if (isNaN(effectiveFrom.getTime())) return res.status(400).json({ message: "validFrom must be a valid date" });
      const selection = await resolveBulkSelection({
        entity: "hospital",
        criteria,
        explicitIds,
        req,
      });
      const targetIds = selection.ids;
      const previewFingerprint = bulkPreviewFingerprint({
        entity: "hospital",
        targetUserId: userId,
        criteria,
        rules: selection.rules,
        scope: selection.scope,
        ids: targetIds,
      });
      if (dryRun) return res.json({
        affected: targetIds.length,
        hospitalIds: targetIds,
        previewIds: targetIds,
        previewTargetUserId: userId,
        previewFingerprint,
        dryRun: true,
      });
      if (!previewIds) return res.status(400).json({ message: "A fresh preview is required before confirming" });
      if (typeof body.previewFingerprint !== "string" || body.previewFingerprint !== previewFingerprint) {
        return res.status(409).json({ message: "Preview metadata changed; run preview again" });
      }
      if (body.previewTargetUserId !== undefined && body.previewTargetUserId !== userId) {
        return res.status(409).json({ message: "Preview target representative changed; run preview again" });
      }
      if (!previewSelectionMatches(previewIds, targetIds)) {
        return res.status(409).json({ message: "Preview is stale; run preview again" });
      }
      if (targetIds.length > 0) {
        await db.update(hospitalRepresentativeAssignments).set({ validTo: effectiveFrom })
          .where(and(inArray(hospitalRepresentativeAssignments.hospitalId, targetIds), isNull(hospitalRepresentativeAssignments.validTo)));
        await db.insert(hospitalRepresentativeAssignments).values(
          targetIds.map(hospitalId => ({
            hospitalId,
            userId,
            validFrom: effectiveFrom,
            validTo: null as null,
            assignedBy: req.session!.user?.id,
            assignmentType: "manual",
            note: typeof body.note === "string" ? body.note : null,
          }))
        );
        // Sync priamo na hospital riadky
        await db.update(hospitals).set({ representativeId: userId }).where(inArray(hospitals.id, targetIds));
      }
      res.json({ affected: targetIds.length, hospitalIds: targetIds });
    } catch (e: any) {
      if (e instanceof Error && /filterRules|criteria|countryScope|hospitalIds|previewIds|validFrom|Unsupported/.test(e.message)) {
        return res.status(400).json({ message: e.message });
      }
      res.status(500).json({ message: e.message });
    }
  });

  // ── POST /api/hospitals/swap-representative
  app.post("/api/hospitals/swap-representative", requireAuth, requireManagerOrAdmin, async (req, res) => {
    try {
      const body = isObject(req.body) ? req.body : {};
      const fromUserId = body.fromUserId;
      const toUserId = body.toUserId;
      if (typeof fromUserId !== "string" || !fromUserId || typeof toUserId !== "string" || !toUserId) {
        return res.status(400).json({ message: "fromUserId and toUserId are required" });
      }
      if (fromUserId === toUserId) return res.status(400).json({ message: "Must be different users" });
      const criteria = parseCriteria(body.criteria);
      const explicitIds = body.hospitalIds === undefined
        ? undefined
        : validatePreviewIds(body.hospitalIds, "hospitalIds");
      const dryRun = body.dryRun === true;
      const previewIds = body.previewIds === undefined
        ? undefined
        : validatePreviewIds(body.previewIds, "previewIds");
      const effectiveFrom = body.validFrom ? new Date(String(body.validFrom)) : new Date();
      if (isNaN(effectiveFrom.getTime())) return res.status(400).json({ message: "validFrom must be a valid date" });
      const selection = await resolveBulkSelection({
        entity: "hospital",
        criteria,
        explicitIds,
        fromUserId,
        req,
      });
      const targetIds = selection.ids;
      const previewFingerprint = bulkPreviewFingerprint({
        entity: "hospital",
        targetUserId: toUserId,
        fromUserId,
        criteria,
        rules: selection.rules,
        scope: selection.scope,
        ids: targetIds,
      });
      if (dryRun) return res.json({
        swapped: targetIds.length,
        affected: targetIds.length,
        hospitalIds: targetIds,
        previewIds: targetIds,
        previewTargetUserId: toUserId,
        previewFingerprint,
        dryRun: true,
      });
      if (!previewIds) return res.status(400).json({ message: "A fresh preview is required before confirming" });
      if (typeof body.previewFingerprint !== "string" || body.previewFingerprint !== previewFingerprint) {
        return res.status(409).json({ message: "Preview metadata changed; run preview again" });
      }
      if (body.previewTargetUserId !== undefined && body.previewTargetUserId !== toUserId) {
        return res.status(409).json({ message: "Preview target representative changed; run preview again" });
      }
      if (!previewSelectionMatches(previewIds, targetIds)) {
        return res.status(409).json({ message: "Preview is stale; run preview again" });
      }
      if (!targetIds.length) return res.json({ swapped: 0, hospitalIds: [] });
      await db.update(hospitalRepresentativeAssignments).set({ validTo: effectiveFrom })
        .where(and(inArray(hospitalRepresentativeAssignments.hospitalId, targetIds), eq(hospitalRepresentativeAssignments.userId, fromUserId), isNull(hospitalRepresentativeAssignments.validTo)));
      await db.insert(hospitalRepresentativeAssignments).values(
        targetIds.map(hospitalId => ({
          hospitalId,
          userId: toUserId,
          validFrom: effectiveFrom,
          validTo: null as null,
          assignedBy: req.session!.user?.id,
          assignmentType: "swap" as const,
          note: typeof body.note === "string" ? body.note : null,
        }))
      );
      // Sync priamo na hospital riadky
      await db.update(hospitals).set({ representativeId: toUserId }).where(inArray(hospitals.id, targetIds));
      res.json({ swapped: targetIds.length, hospitalIds: targetIds });
    } catch (e: any) {
      if (e instanceof Error && /filterRules|criteria|countryScope|hospitalIds|previewIds|validFrom|Unsupported/.test(e.message)) {
        return res.status(400).json({ message: e.message });
      }
      res.status(500).json({ message: e.message });
    }
  });
}
