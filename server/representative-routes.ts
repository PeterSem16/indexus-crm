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
  users,
  roles,
  userRoles,
} from "@shared/schema";

// ── Auth helpers ─────────────────────────────────────────────────────────────
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
  next();
};

const requireManagerOrAdmin = (req: Request, res: Response, next: NextFunction) => {
  const role = req.session?.role;
  if (role !== "admin" && role !== "manager") {
    return res.status(403).json({ message: "Requires manager or admin role" });
  }
  next();
};

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
          assignedBy: req.session!.userId,
          assignmentType: "manual",
          note: note ?? null,
        })
        .returning();

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

  // ── POST /api/clinics/bulk-assign-representative
  // Hromadné priradenie podľa kritérií.
  // Body: { userId, criteria: { country?, region?, district?, currentRepresentativeId?, isActive? },
  //         clinicIds?, validFrom?, note?, dryRun? }
  app.post("/api/clinics/bulk-assign-representative", requireAuth, requireManagerOrAdmin, async (req, res) => {
    try {
      const {
        userId,
        criteria = {},
        clinicIds: explicitClinicIds,
        validFrom,
        note,
        dryRun = false,
      } = req.body as {
        userId: string;
        criteria?: {
          country?: string;
          region?: string | string[];
          district?: string | string[];
          currentRepresentativeId?: string | null;
          isActive?: boolean;
        };
        clinicIds?: string[];
        validFrom?: string;
        note?: string;
        dryRun?: boolean;
      };

      if (!userId) return res.status(400).json({ message: "userId is required" });

      const now = new Date();
      const effectiveFrom = validFrom ? new Date(validFrom) : now;

      let targetClinicIds: string[];

      if (explicitClinicIds && explicitClinicIds.length > 0) {
        targetClinicIds = explicitClinicIds;
      } else {
        // Zostroj WHERE podmienku na kliniky
        let clinicFilter: any = undefined;

        if (criteria.isActive !== undefined) {
          clinicFilter = and(clinicFilter, eq(clinics.isActive, criteria.isActive));
        }
        if (criteria.country) {
          clinicFilter = and(clinicFilter, eq(clinics.countryCode, criteria.country));
        }
        if (criteria.region) {
          const regions = Array.isArray(criteria.region) ? criteria.region : [criteria.region];
          if (regions.length === 1) {
            clinicFilter = and(clinicFilter, eq(clinics.region, regions[0]));
          } else {
            clinicFilter = and(clinicFilter, inArray(clinics.region, regions));
          }
        }
        if (criteria.district) {
          const districts = Array.isArray(criteria.district) ? criteria.district : [criteria.district];
          if (districts.length === 1) {
            clinicFilter = and(clinicFilter, eq(clinics.district, districts[0]));
          } else {
            clinicFilter = and(clinicFilter, inArray(clinics.district, districts));
          }
        }

        const allClinics = await db
          .select({ id: clinics.id })
          .from(clinics)
          .where(clinicFilter ?? undefined);

        let allIds = allClinics.map((c) => c.id);

        // Filtruj podľa currentRepresentativeId
        if (criteria.currentRepresentativeId !== undefined) {
          const activeAssignments = await db
            .select({ clinicId: clinicRepresentativeAssignments.clinicId, userId: clinicRepresentativeAssignments.userId })
            .from(clinicRepresentativeAssignments)
            .where(
              and(
                inArray(clinicRepresentativeAssignments.clinicId, allIds),
                isNull(clinicRepresentativeAssignments.validTo)
              )
            );

          const assignedMap = new Map(activeAssignments.map((a) => [a.clinicId, a.userId]));

          if (criteria.currentRepresentativeId === null) {
            // Iba kliniky BEZ aktuálneho reprezentanta
            allIds = allIds.filter((id) => !assignedMap.has(id));
          } else {
            // Iba kliniky S konkrétnym reprezentantom
            allIds = allIds.filter((id) => assignedMap.get(id) === criteria.currentRepresentativeId);
          }
        }

        targetClinicIds = allIds;
      }

      if (dryRun) {
        return res.json({ affected: targetClinicIds.length, skipped: 0, clinicIds: targetClinicIds, dryRun: true });
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
          assignedBy: req.session!.userId,
          assignmentType: criteria.district
            ? "bulk_district"
            : criteria.region
            ? "bulk_region"
            : "manual",
          note: note ?? null,
        }));

        await db.insert(clinicRepresentativeAssignments).values(insertValues);
        affected = targetClinicIds.length;
      }

      res.json({ affected, skipped, clinicIds: targetClinicIds });
    } catch (e: any) {
      console.error("[representatives] POST /api/clinics/bulk-assign-representative", e);
      res.status(500).json({ message: e.message });
    }
  });

  // ── POST /api/clinics/swap-representative
  // Rýchla výmena: presunie kliniky od jedného reprezentanta k inému.
  // Body: { fromUserId, toUserId, clinicIds?, validFrom?, note? }
  app.post("/api/clinics/swap-representative", requireAuth, requireManagerOrAdmin, async (req, res) => {
    try {
      const { fromUserId, toUserId, clinicIds: explicitClinicIds, validFrom, note } = req.body as {
        fromUserId: string;
        toUserId: string;
        clinicIds?: string[];
        validFrom?: string;
        note?: string;
      };

      if (!fromUserId || !toUserId) {
        return res.status(400).json({ message: "fromUserId and toUserId are required" });
      }
      if (fromUserId === toUserId) {
        return res.status(400).json({ message: "fromUserId and toUserId must be different" });
      }

      const now = new Date();
      const effectiveFrom = validFrom ? new Date(validFrom) : now;

      // Zisti kliniky fromUserId (aktívne priradenia)
      const activeAssignments = await db
        .select({ clinicId: clinicRepresentativeAssignments.clinicId })
        .from(clinicRepresentativeAssignments)
        .where(
          and(
            eq(clinicRepresentativeAssignments.userId, fromUserId),
            isNull(clinicRepresentativeAssignments.validTo)
          )
        );

      let targetClinicIds = activeAssignments.map((a) => a.clinicId);

      if (explicitClinicIds && explicitClinicIds.length > 0) {
        // Filtruj len na explicitne zadané + musia patriť fromUserId
        const fromSet = new Set(targetClinicIds);
        targetClinicIds = explicitClinicIds.filter((id) => fromSet.has(id));
      }

      if (targetClinicIds.length === 0) {
        return res.json({ swapped: 0 });
      }

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
        assignedBy: req.session!.userId,
        assignmentType: "swap" as const,
        note: note ?? null,
      }));

      await db.insert(clinicRepresentativeAssignments).values(insertValues);

      res.json({ swapped: targetClinicIds.length, clinicIds: targetClinicIds });
    } catch (e: any) {
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
        assignedBy: req.session!.userId, assignmentType: "manual", note: note ?? null,
      }).returning();
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
      const { userId, criteria = {}, hospitalIds: explicitIds, validFrom, note, dryRun = false } = req.body as {
        userId: string; criteria?: { country?: string; region?: string | string[]; district?: string | string[]; currentRepresentativeId?: string | null; isActive?: boolean };
        hospitalIds?: string[]; validFrom?: string; note?: string; dryRun?: boolean;
      };
      if (!userId) return res.status(400).json({ message: "userId is required" });
      const effectiveFrom = validFrom ? new Date(validFrom) : new Date();

      let targetIds: string[];
      if (explicitIds?.length) {
        targetIds = explicitIds;
      } else {
        let filter: any = undefined;
        if (criteria.isActive !== undefined) filter = and(filter, eq(hospitals.isActive, criteria.isActive));
        if (criteria.country) filter = and(filter, eq(hospitals.countryCode, criteria.country));
        if (criteria.region) {
          const regions = Array.isArray(criteria.region) ? criteria.region : [criteria.region];
          filter = and(filter, regions.length === 1 ? eq(hospitals.region, regions[0]) : inArray(hospitals.region, regions));
        }
        if (criteria.district) {
          const districts = Array.isArray(criteria.district) ? criteria.district : [criteria.district];
          filter = and(filter, districts.length === 1 ? eq(hospitals.district, districts[0]) : inArray(hospitals.district, districts));
        }
        const all = await db.select({ id: hospitals.id }).from(hospitals).where(filter ?? undefined);
        targetIds = all.map(h => h.id);
        if (criteria.currentRepresentativeId !== undefined) {
          const active = await db.select({ hospitalId: hospitalRepresentativeAssignments.hospitalId, userId: hospitalRepresentativeAssignments.userId })
            .from(hospitalRepresentativeAssignments)
            .where(and(inArray(hospitalRepresentativeAssignments.hospitalId, targetIds), isNull(hospitalRepresentativeAssignments.validTo)));
          const activeMap = new Map(active.map(a => [a.hospitalId, a.userId]));
          targetIds = criteria.currentRepresentativeId === null
            ? targetIds.filter(id => !activeMap.has(id))
            : targetIds.filter(id => activeMap.get(id) === criteria.currentRepresentativeId);
        }
      }

      if (dryRun) return res.json({ affected: targetIds.length, hospitalIds: targetIds, dryRun: true });
      if (targetIds.length > 0) {
        await db.update(hospitalRepresentativeAssignments).set({ validTo: effectiveFrom })
          .where(and(inArray(hospitalRepresentativeAssignments.hospitalId, targetIds), isNull(hospitalRepresentativeAssignments.validTo)));
        await db.insert(hospitalRepresentativeAssignments).values(
          targetIds.map(hospitalId => ({ hospitalId, userId, validFrom: effectiveFrom, validTo: null as null, assignedBy: req.session!.userId, assignmentType: "manual", note: note ?? null }))
        );
      }
      res.json({ affected: targetIds.length, hospitalIds: targetIds });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── POST /api/hospitals/swap-representative
  app.post("/api/hospitals/swap-representative", requireAuth, requireManagerOrAdmin, async (req, res) => {
    try {
      const { fromUserId, toUserId, hospitalIds: explicitIds, validFrom, note } = req.body as { fromUserId: string; toUserId: string; hospitalIds?: string[]; validFrom?: string; note?: string };
      if (!fromUserId || !toUserId) return res.status(400).json({ message: "fromUserId and toUserId are required" });
      if (fromUserId === toUserId) return res.status(400).json({ message: "Must be different users" });
      const effectiveFrom = validFrom ? new Date(validFrom) : new Date();
      const active = await db.select({ hospitalId: hospitalRepresentativeAssignments.hospitalId })
        .from(hospitalRepresentativeAssignments)
        .where(and(eq(hospitalRepresentativeAssignments.userId, fromUserId), isNull(hospitalRepresentativeAssignments.validTo)));
      let targetIds = active.map(a => a.hospitalId);
      if (explicitIds?.length) targetIds = explicitIds.filter(id => new Set(targetIds).has(id));
      if (!targetIds.length) return res.json({ swapped: 0 });
      await db.update(hospitalRepresentativeAssignments).set({ validTo: effectiveFrom })
        .where(and(inArray(hospitalRepresentativeAssignments.hospitalId, targetIds), eq(hospitalRepresentativeAssignments.userId, fromUserId), isNull(hospitalRepresentativeAssignments.validTo)));
      await db.insert(hospitalRepresentativeAssignments).values(
        targetIds.map(hospitalId => ({ hospitalId, userId: toUserId, validFrom: effectiveFrom, validTo: null as null, assignedBy: req.session!.userId, assignmentType: "swap" as const, note: note ?? null }))
      );
      res.json({ swapped: targetIds.length, hospitalIds: targetIds });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });
}
