// ============================================================
// Pricing Engine V2 — API routes (/api/pricing/*)
// Read endpoints: any authenticated user.
// Management endpoints (status changes, overrides): pricing
// administrators only (admin role OR RBAC module "pricing").
// ============================================================
import type { Express, Request, Response, NextFunction } from "express";
import { db } from "./db";
import { eq, and, inArray, desc } from "drizzle-orm";
import {
  pricingComponents,
  pricingProducts,
  pricingProductComponents,
  pricingPriceLists,
  pricingCollectionPrices,
  pricingStoragePrices,
  pricingStorageDiscounts,
  pricingInstallmentPlans,
  pricingIncompleteRules,
  pricingAdjustmentRules,
  pricingProductCosts,
  pricingMarginOtps,
  users,
  userRoles,
  roleModulePermissions,
  exchangeRates,
  inflationRates,
} from "@shared/schema";
import { calculatePrice, type PriceListBundle, type CalculationInput } from "./pricing-engine";

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!(req.session as any)?.user) return res.status(401).json({ message: "Unauthorized" });
  next();
};

async function canManagePricing(sessionUser: any): Promise<boolean> {
  if (!sessionUser) return false;
  if (sessionUser.role === "admin") return true;
  try {
    const [u] = await db.select({ roleId: users.roleId }).from(users).where(eq(users.id, sessionUser.id));
    const extraRoles = await db.select({ roleId: userRoles.roleId }).from(userRoles).where(eq(userRoles.userId, sessionUser.id));
    const roleIds = [u?.roleId, ...extraRoles.map((r) => r.roleId)].filter(Boolean) as string[];
    if (!roleIds.length) return false;
    const perms = await db
      .select()
      .from(roleModulePermissions)
      .where(and(inArray(roleModulePermissions.roleId, roleIds), eq(roleModulePermissions.moduleKey, "pricing")));
    return perms.some((p) => p.access === "visible" && p.canEdit);
  } catch {
    return false;
  }
}

const requirePricingAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const sessionUser = (req.session as any)?.user;
  if (!(await canManagePricing(sessionUser))) {
    return res.status(403).json({ message: "Pricing administrator role required" });
  }
  next();
};

export async function loadPriceListBundle(priceListId: string): Promise<PriceListBundle | null> {
  const [priceList] = await db.select().from(pricingPriceLists).where(eq(pricingPriceLists.id, priceListId));
  if (!priceList) return null;
  const [products, components, productComponents, collectionPrices, storagePrices, storageDiscounts, installmentPlans, incompleteRules, adjustmentRules] = await Promise.all([
    db.select().from(pricingProducts),
    db.select().from(pricingComponents),
    db.select().from(pricingProductComponents),
    db.select().from(pricingCollectionPrices).where(eq(pricingCollectionPrices.priceListId, priceListId)),
    db.select().from(pricingStoragePrices).where(eq(pricingStoragePrices.priceListId, priceListId)),
    db.select().from(pricingStorageDiscounts).where(eq(pricingStorageDiscounts.priceListId, priceListId)),
    db.select().from(pricingInstallmentPlans).where(eq(pricingInstallmentPlans.priceListId, priceListId)),
    db.select().from(pricingIncompleteRules).where(eq(pricingIncompleteRules.priceListId, priceListId)),
    db.select().from(pricingAdjustmentRules).where(eq(pricingAdjustmentRules.priceListId, priceListId)),
  ]);
  return {
    priceList: {
      id: priceList.id,
      countryCode: priceList.countryCode,
      currency: priceList.currency,
      name: priceList.name,
      fxRateToEur: priceList.fxRateToEur,
      storageYearOptions: priceList.storageYearOptions as number[] | null,
    },
    products: products.map((p) => ({ id: p.id, code: p.code, name: p.name })),
    components: components.sort((a, b) => a.sortOrder - b.sortOrder).map((c) => ({ id: c.id, code: c.code, name: c.name })),
    productComponents,
    collectionPrices: collectionPrices.map((cp) => ({
      id: cp.id,
      productId: cp.productId,
      componentId: cp.componentId,
      price: cp.price,
      maxCollectionDiscountPct: cp.maxCollectionDiscountPct,
      note: cp.note,
    })),
    storagePrices,
    storageDiscounts,
    installmentPlans,
    incompleteRules: incompleteRules.map((r) => ({
      id: r.id,
      orderedProductId: r.orderedProductId,
      collectedMask: r.collectedMask,
      resultLabel: r.resultLabel,
      collectionPrice: r.collectionPrice,
      storagePrices: r.storagePrices as Record<string, number> | null,
      isOverride: r.isOverride,
      note: r.note,
    })),
    adjustmentRules,
  };
}

export async function resolveActivePriceList(countryCode: string): Promise<string | null> {
  const lists = await db
    .select({ id: pricingPriceLists.id })
    .from(pricingPriceLists)
    .where(and(eq(pricingPriceLists.countryCode, countryCode), eq(pricingPriceLists.status, "active")))
    .orderBy(desc(pricingPriceLists.validFrom))
    .limit(1);
  return lists[0]?.id ?? null;
}

export function registerPricingRoutes(app: Express) {
  // live FX rate lookup (NBS exchange_rates table) — used by the copy-dialog preview
  app.get("/api/pricing/fx-rate/:currency", requireAuth, async (req, res) => {
    const currency = req.params.currency.toUpperCase();
    if (currency === "EUR") return res.json({ currency: "EUR", rate: "1.0000", rateDate: null });
    const [row] = await db.select().from(exchangeRates)
      .where(eq(exchangeRates.currencyCode, currency))
      .orderBy(desc(exchangeRates.rateDate))
      .limit(1);
    if (!row) return res.status(404).json({ message: `No exchange rate found for ${currency}` });
    res.json({ currency: row.currencyCode, rate: row.rate, rateDate: row.rateDate });
  });

  // inflation-rate lookup for a country + year — used by the copy-dialog preview
  app.get("/api/pricing/inflation-rate/:countryCode/:year", requireAuth, async (req, res) => {
    const year = parseInt(req.params.year, 10);
    if (!Number.isInteger(year) || year < 1900 || year > 2100) return res.status(400).json({ message: "Invalid year" });
    const [row] = await db.select().from(inflationRates)
      .where(and(eq(inflationRates.country, req.params.countryCode.toUpperCase()), eq(inflationRates.year, year)));
    if (!row) return res.status(404).json({ message: `No inflation data for ${req.params.countryCode} ${year}` });
    res.json({ country: row.country, year: row.year, rate: row.rate, source: row.source });
  });

  app.get("/api/pricing/components", requireAuth, async (_req, res) => {
    res.json(await db.select().from(pricingComponents).orderBy(pricingComponents.sortOrder));
  });

  app.get("/api/pricing/products", requireAuth, async (_req, res) => {
    const [products, links, components] = await Promise.all([
      db.select().from(pricingProducts).orderBy(pricingProducts.sortOrder),
      db.select().from(pricingProductComponents),
      db.select().from(pricingComponents),
    ]);
    const compById = new Map(components.map((c) => [c.id, c.code]));
    res.json(products.map((p) => ({
      ...p,
      componentCodes: links.filter((l) => l.productId === p.id).map((l) => compById.get(l.componentId)).filter(Boolean),
    })));
  });

  app.get("/api/pricing/price-lists", requireAuth, async (req, res) => {
    const country = req.query.country as string | undefined;
    const rows = country
      ? await db.select().from(pricingPriceLists).where(eq(pricingPriceLists.countryCode, country)).orderBy(desc(pricingPriceLists.validFrom))
      : await db.select().from(pricingPriceLists).orderBy(pricingPriceLists.countryCode, desc(pricingPriceLists.validFrom));
    res.json(rows);
  });

  app.get("/api/pricing/price-lists/:id", requireAuth, async (req, res) => {
    const bundle = await loadPriceListBundle(req.params.id);
    if (!bundle) return res.status(404).json({ message: "Price list not found" });
    res.json(bundle);
  });

  // costs contain margins — pricing administrators only
  app.get("/api/pricing/costs", requireAuth, requirePricingAdmin, async (_req, res) => {
    res.json(await db.select().from(pricingProductCosts).orderBy(pricingProductCosts.countryCode));
  });

  // ── Margin tab OTP guard ──────────────────────────────────────────────────

  const requireMarginSession = (req: Request, res: Response, next: NextFunction) => {
    const verifiedAt = (req.session as any)?.marginOtpVerifiedAt as number | undefined;
    if (!verifiedAt || Date.now() - verifiedAt > 2 * 60 * 60 * 1000) {
      return res.status(403).json({ message: "Margin session expired. Please verify OTP again." });
    }
    next();
  };

  // Check if current session has a valid margin OTP
  app.get("/api/pricing/margin/session", requireAuth, requirePricingAdmin, (req, res) => {
    const verifiedAt = (req.session as any)?.marginOtpVerifiedAt as number | undefined;
    const valid = !!verifiedAt && Date.now() - verifiedAt <= 2 * 60 * 60 * 1000;
    res.json({ verified: valid, verifiedAt: valid ? verifiedAt : null });
  });

  // Request a 6-digit OTP for margin tab access
  app.post("/api/pricing/margin/request-otp", requireAuth, requirePricingAdmin, async (req, res) => {
    const sessionUser = (req.session as any)?.user;
    if (!sessionUser?.email) {
      return res.status(400).json({ message: "User email not available for OTP delivery" });
    }

    const otpCode = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Invalidate old OTPs for this user
    await db.delete(pricingMarginOtps).where(eq(pricingMarginOtps.userId, sessionUser.id));
    await db.insert(pricingMarginOtps).values({ userId: sessionUser.id, otpCode, expiresAt });

    const subject = `Margin Access Code: ${otpCode}`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px;">
      <div style="background:linear-gradient(135deg,#3730a3,#4f46e5);border-radius:16px;padding:24px;color:#fff;text-align:center;margin-bottom:20px;">
        <h2 style="margin:0 0 8px;font-size:20px;">🔐 Margin Tab Access</h2>
        <p style="margin:0;opacity:.85;font-size:13px;">One-time verification code</p>
      </div>
      <div style="background:#f5f3ff;border:2px solid #c4b5fd;border-radius:12px;padding:20px;text-align:center;margin-bottom:16px;">
        <span style="font-size:40px;font-weight:900;letter-spacing:12px;color:#4f46e5;">${otpCode}</span>
      </div>
      <p style="color:#6b7280;font-size:12px;text-align:center;">Valid for 10 minutes · Do not share this code</p>
    </div>`;

    let emailSent = false;

    // Try system MS365 connections first
    try {
      const { storage } = await import("./storage");
      const allConns = await storage.getAllSystemMs365Connections();
      for (const sc of allConns) {
        if (emailSent || !sc.isConnected) continue;
        try {
          const { getValidAccessToken, sendEmail: sendMs365 } = await import("./lib/ms365");
          const { decryptTokenSafe, encryptTokenWithMarker } = await import("./lib/token-crypto");
          const tokenResult = await getValidAccessToken(
            sc.accessToken ? decryptTokenSafe(sc.accessToken) : null,
            sc.tokenExpiresAt,
            sc.refreshToken ? decryptTokenSafe(sc.refreshToken) : null,
          );
          if (tokenResult) {
            if (tokenResult.refreshed) {
              await storage.updateSystemMs365Connection(sc.countryCode, {
                accessToken: encryptTokenWithMarker(tokenResult.accessToken),
                refreshToken: tokenResult.refreshToken ? encryptTokenWithMarker(tokenResult.refreshToken) : sc.refreshToken,
                tokenExpiresAt: tokenResult.expiresOn,
              });
            }
            await sendMs365(tokenResult.accessToken, [sessionUser.email], subject, html, true);
            emailSent = true;
          }
        } catch { /* try next */ }
      }
    } catch { /* fallback */ }

    // Fallback to SendGrid / basic email
    if (!emailSent) {
      try {
        const { sendEmail } = await import("./email");
        emailSent = await sendEmail({ to: sessionUser.email, subject, html });
      } catch { /* ignore */ }
    }

    console.log(`[Margin OTP] generated for user ${sessionUser.id} (${sessionUser.email}), sent=${emailSent}`);
    res.json({ ok: true, emailSent });
  });

  // Verify OTP and establish a margin session
  app.post("/api/pricing/margin/verify-otp", requireAuth, requirePricingAdmin, async (req, res) => {
    const { code } = req.body as { code?: string };
    if (!code || typeof code !== "string") {
      return res.status(400).json({ message: "code is required" });
    }
    const sessionUser = (req.session as any)?.user;
    const otps = await db.select().from(pricingMarginOtps).where(eq(pricingMarginOtps.userId, sessionUser.id));
    const now = new Date();
    const valid = otps.find((o) => o.otpCode === code && new Date(o.expiresAt) > now && !o.usedAt);
    if (!valid) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }
    await db.update(pricingMarginOtps).set({ usedAt: now }).where(eq(pricingMarginOtps.id, valid.id));
    (req.session as any).marginOtpVerifiedAt = Date.now();
    res.json({ ok: true });
  });

  // Update réžia for a cost row (requires pricing admin + active margin session)
  app.patch("/api/pricing/costs/:id", requireAuth, requirePricingAdmin, requireMarginSession, async (req, res) => {
    const { reziaEur } = req.body as { reziaEur?: number | null };
    if (reziaEur !== null && reziaEur !== undefined && (!Number.isFinite(reziaEur) || reziaEur < 0)) {
      return res.status(400).json({ message: "reziaEur must be a non-negative number or null" });
    }
    const [updated] = await db
      .update(pricingProductCosts)
      .set({ reziaEur: reziaEur == null ? null : String(reziaEur) })
      .where(eq(pricingProductCosts.id, req.params.id))
      .returning();
    if (!updated) return res.status(404).json({ message: "Cost row not found" });
    res.json(updated);
  });

  // price calculation with itemized breakdown (audit trail)
  app.post("/api/pricing/calculate", requireAuth, async (req, res) => {
    try {
      const { priceListId, countryCode, collectionDiscountPct, ...calcRest } = req.body as { priceListId?: string; countryCode?: string; collectionDiscountPct?: number } & CalculationInput;
      const calc = { ...calcRest, ...(collectionDiscountPct != null ? { collectionDiscountPct } : {}) } as CalculationInput;
      let listId = priceListId ?? null;
      if (!listId && countryCode) listId = await resolveActivePriceList(countryCode);
      if (!listId) return res.status(400).json({ message: "priceListId or countryCode with an active price list is required" });
      const bundle = await loadPriceListBundle(listId);
      if (!bundle) return res.status(404).json({ message: "Price list not found" });
      if (!calc.productCode || !calc.storageYears) return res.status(400).json({ message: "productCode and storageYears are required" });
      res.json(calculatePrice(bundle, calc));
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // status workflow draft -> active -> archived (pricing administrator only)
  app.post("/api/pricing/price-lists/:id/status", requireAuth, requirePricingAdmin, async (req, res) => {
    const { status } = req.body as { status: string };
    if (!["draft", "active", "archived"].includes(status)) return res.status(400).json({ message: "Invalid status" });
    const [list] = await db.select().from(pricingPriceLists).where(eq(pricingPriceLists.id, req.params.id));
    if (!list) return res.status(404).json({ message: "Price list not found" });
    const sessionUser = (req.session as any).user;
    if (status === "active") {
      // only one active list per country: archive the previous one
      await db
        .update(pricingPriceLists)
        .set({ status: "archived" })
        .where(and(eq(pricingPriceLists.countryCode, list.countryCode), eq(pricingPriceLists.status, "active")));
    }
    const [updated] = await db
      .update(pricingPriceLists)
      .set(status === "active" ? { status, approvedBy: sessionUser.id, approvedAt: new Date() } : { status })
      .where(eq(pricingPriceLists.id, req.params.id))
      .returning();
    res.json(updated);
  });

  // duplicate a price list into a new draft (pricing administrator only)
  app.post("/api/pricing/price-lists/:id/duplicate", requireAuth, requirePricingAdmin, async (req, res) => {
    const {
      name,
      fxRateMode,
      fxRateToEur: fxRateFixed,
      inflationYear,
      inflationApply,
    } = req.body as {
      name?: string;
      fxRateMode?: "live" | "fixed";
      fxRateToEur?: number | null;
      inflationYear?: number | null;
      inflationApply?: boolean;
    };
    const [src] = await db.select().from(pricingPriceLists).where(eq(pricingPriceLists.id, req.params.id));
    if (!src) return res.status(404).json({ message: "Price list not found" });
    const sessionUser = (req.session as any).user;
    const srcId = src.id;

    // resolve FX rate
    const resolvedFxMode = fxRateMode ?? "fixed";
    let resolvedFxRate: string | null = src.fxRateToEur;
    let fxRateDate: string | null = null;
    if (resolvedFxMode === "live" && src.currency !== "EUR") {
      const [row] = await db.select().from(exchangeRates)
        .where(eq(exchangeRates.currencyCode, src.currency))
        .orderBy(desc(exchangeRates.rateDate))
        .limit(1);
      if (!row) return res.status(400).json({ message: `No live exchange rate available for ${src.currency}` });
      resolvedFxRate = row.rate;
      fxRateDate = row.rateDate;
    } else if (resolvedFxMode === "fixed" && fxRateFixed != null) {
      if (!Number.isFinite(fxRateFixed) || fxRateFixed <= 0) {
        return res.status(400).json({ message: "fxRateToEur must be a positive number" });
      }
      resolvedFxRate = String(fxRateFixed);
    }

    // resolve inflation rate
    let resolvedInflationPct: string | null = null;
    let resolvedInflationYear: number | null = null;
    if (inflationYear != null) {
      if (!Number.isInteger(inflationYear) || inflationYear < 1900 || inflationYear > 2100) {
        return res.status(400).json({ message: "Invalid inflationYear" });
      }
      const [row] = await db.select().from(inflationRates)
        .where(and(eq(inflationRates.country, src.countryCode), eq(inflationRates.year, inflationYear)));
      if (!row) return res.status(400).json({ message: `No inflation data found for ${src.countryCode} ${inflationYear}` });
      resolvedInflationPct = row.rate;
      resolvedInflationYear = inflationYear;
    }

    // inflation multiplier applied to prices (only when inflationApply=true and a rate was resolved)
    const applyInflation = !!inflationApply && resolvedInflationPct != null;
    const inflMultiplier = applyInflation ? 1 + parseFloat(resolvedInflationPct!) / 100 : 1;
    const bumpPrice = (p: string) => applyInflation ? String(parseFloat(p) * inflMultiplier) : p;

    const [cps, sps, sds, ips, irs, ars] = await Promise.all([
      db.select().from(pricingCollectionPrices).where(eq(pricingCollectionPrices.priceListId, srcId)),
      db.select().from(pricingStoragePrices).where(eq(pricingStoragePrices.priceListId, srcId)),
      db.select().from(pricingStorageDiscounts).where(eq(pricingStorageDiscounts.priceListId, srcId)),
      db.select().from(pricingInstallmentPlans).where(eq(pricingInstallmentPlans.priceListId, srcId)),
      db.select().from(pricingIncompleteRules).where(eq(pricingIncompleteRules.priceListId, srcId)),
      db.select().from(pricingAdjustmentRules).where(eq(pricingAdjustmentRules.priceListId, srcId)),
    ]);
    const copy = await db.transaction(async (tx) => {
      const [created] = await tx.insert(pricingPriceLists).values({
        countryCode: src.countryCode,
        currency: src.currency,
        name: name?.trim() || `${src.name} (kópia)`,
        status: "draft",
        validFrom: src.validFrom, // column is NOT NULL; drafts keep the source date until activation
        fxRateToEur: resolvedFxRate,
        fxRateMode: resolvedFxMode,
        inflationRatePct: resolvedInflationPct,
        inflationYear: resolvedInflationYear,
        inflationApply: applyInflation,
        storageYearOptions: src.storageYearOptions,
        note: fxRateDate ? `FX kurz z NBS dňa ${fxRateDate}` : src.note,
        createdBy: sessionUser?.id ?? null,
      }).returning();
      const strip = ({ id: _id, priceListId: _pl, ...rest }: any) => ({ ...rest, priceListId: created.id });
      if (cps.length) await tx.insert(pricingCollectionPrices).values(
        cps.map((r) => ({ ...strip(r), price: bumpPrice(r.price) }))
      );
      if (sps.length) await tx.insert(pricingStoragePrices).values(
        sps.map((r) => ({ ...strip(r), price: bumpPrice(r.price) }))
      );
      if (sds.length) await tx.insert(pricingStorageDiscounts).values(sds.map(strip));
      if (ips.length) await tx.insert(pricingInstallmentPlans).values(ips.map(strip));
      if (irs.length) await tx.insert(pricingIncompleteRules).values(irs.map(strip));
      if (ars.length) await tx.insert(pricingAdjustmentRules).values(ars.map(strip));
      return created;
    });
    res.json(copy);
  });

  // delete a DRAFT price list entirely, incl. all child rows (pricing administrator only)
  app.delete("/api/pricing/price-lists/:id", requireAuth, requirePricingAdmin, async (req, res) => {
    const [list] = await db.select().from(pricingPriceLists).where(eq(pricingPriceLists.id, req.params.id));
    if (!list) return res.status(404).json({ message: "Price list not found" });
    if (list.status !== "draft") return res.status(400).json({ message: "Only draft price lists can be deleted" });
    await db.transaction(async (tx) => {
      await tx.delete(pricingCollectionPrices).where(eq(pricingCollectionPrices.priceListId, list.id));
      await tx.delete(pricingStoragePrices).where(eq(pricingStoragePrices.priceListId, list.id));
      await tx.delete(pricingStorageDiscounts).where(eq(pricingStorageDiscounts.priceListId, list.id));
      await tx.delete(pricingInstallmentPlans).where(eq(pricingInstallmentPlans.priceListId, list.id));
      await tx.delete(pricingIncompleteRules).where(eq(pricingIncompleteRules.priceListId, list.id));
      await tx.delete(pricingAdjustmentRules).where(eq(pricingAdjustmentRules.priceListId, list.id));
      await tx.delete(pricingPriceLists).where(eq(pricingPriceLists.id, list.id));
    });
    res.json({ ok: true });
  });

  // manual price edits on a DRAFT price list (pricing administrator only)
  app.patch("/api/pricing/price-lists/:id/prices", requireAuth, requirePricingAdmin, async (req, res) => {
    const {
      collection = [], storage = [], discounts = [], installments = [], rules = [],
      addDiscounts = [], removeDiscounts = [], addInstallments = [], removeInstallments = [],
      maxDiscounts = [],
    } = req.body as {
      collection?: Array<{ id: string; price: number }>;
      storage?: Array<{ id: string; price: number }>;
      discounts?: Array<{ id: string; discountPct: number }>;
      installments?: Array<{ id: string; surchargePct: number }>;
      addDiscounts?: Array<{ years: number; discountPct: number }>;
      removeDiscounts?: string[];
      addInstallments?: Array<{ installments: number; surchargePct: number }>;
      removeInstallments?: string[];
      maxDiscounts?: Array<{ id: string; maxDiscountPct: number | null }>; // set/clear max collection discount per row
      rules?: Array<{ id: string; enabled?: boolean; amount?: number | null; pct?: number | null; appliesTo?: string | null; volumeOperator?: string | null; volumeMinMl?: number | null; volumeMaxMl?: number | null }>;
    };
    const [list] = await db.select().from(pricingPriceLists).where(eq(pricingPriceLists.id, req.params.id));
    if (!list) return res.status(404).json({ message: "Price list not found" });
    if (list.status !== "draft") return res.status(400).json({ message: "Only draft price lists can be edited" });
    if ([...collection, ...storage].some((r) => !r?.id || !Number.isFinite(r.price))) {
      return res.status(400).json({ message: "Each row needs an id and a finite price" });
    }
    if (discounts.some((r) => !r?.id || !Number.isFinite(r.discountPct))) {
      return res.status(400).json({ message: "Each discount row needs an id and a finite discountPct" });
    }
    if (installments.some((r) => !r?.id || !Number.isFinite(r.surchargePct))) {
      return res.status(400).json({ message: "Each installment row needs an id and a finite surchargePct" });
    }
    if (addDiscounts.some((r) => !Number.isInteger(r?.years) || r.years <= 0 || !Number.isFinite(r?.discountPct))) {
      return res.status(400).json({ message: "New discounts need a positive integer years and a finite discountPct" });
    }
    if (addInstallments.some((r) => !Number.isInteger(r?.installments) || r.installments <= 0 || !Number.isFinite(r?.surchargePct))) {
      return res.status(400).json({ message: "New installment plans need a positive integer count and a finite surchargePct" });
    }
    if (maxDiscounts.some((r) => !r?.id || (r.maxDiscountPct !== null && (!Number.isFinite(r.maxDiscountPct) || r.maxDiscountPct < 0 || r.maxDiscountPct > 100)))) {
      return res.status(400).json({ message: "maxDiscounts: each row needs an id and a maxDiscountPct between 0–100 or null" });
    }
    // enforce per-component hard caps: PL (Placenta) → max 5 %, all others → max 10 %
    if (maxDiscounts.some((r) => r.maxDiscountPct !== null && r.maxDiscountPct > 0)) {
      const cpIds = maxDiscounts.filter((r) => r.maxDiscountPct !== null).map((r) => r.id);
      const cpRows = cpIds.length ? await db.select({ id: pricingCollectionPrices.id, componentId: pricingCollectionPrices.componentId })
        .from(pricingCollectionPrices)
        .where(and(eq(pricingCollectionPrices.priceListId, list.id), inArray(pricingCollectionPrices.id, cpIds))) : [];
      const compIds = cpRows.map((r) => r.componentId).filter(Boolean) as string[];
      const comps = compIds.length ? await db.select({ id: pricingComponents.id, code: pricingComponents.code })
        .from(pricingComponents).where(inArray(pricingComponents.id, compIds)) : [];
      const codeByCompId = new Map(comps.map((c) => [c.id, c.code]));
      const cpById = new Map(cpRows.map((r) => [r.id, r]));
      for (const r of maxDiscounts) {
        if (r.maxDiscountPct === null) continue;
        const cp = cpById.get(r.id);
        const code = cp?.componentId ? codeByCompId.get(cp.componentId) : null;
        const hardMax = code === "PL" ? 5 : 10;
        if (r.maxDiscountPct > hardMax) {
          return res.status(400).json({ message: `Max collection discount for ${code ?? "this product row"} cannot exceed ${hardMax}%` });
        }
      }
    }
    if ([...removeDiscounts, ...removeInstallments].some((id) => typeof id !== "string" || !id)) {
      return res.status(400).json({ message: "remove lists must contain row ids" });
    }
    // duplicate years/installment counts would make engine lookups non-deterministic
    if (addDiscounts.length) {
      const existing = await db.select().from(pricingStorageDiscounts).where(eq(pricingStorageDiscounts.priceListId, list.id));
      const kept = new Set(existing.filter((d) => !removeDiscounts.includes(d.id)).map((d) => d.years));
      for (const r of addDiscounts) {
        if (kept.has(r.years)) return res.status(400).json({ message: `A prepaid discount for ${r.years} years already exists` });
        kept.add(r.years);
      }
    }
    if (addInstallments.length) {
      const existing = await db.select().from(pricingInstallmentPlans).where(eq(pricingInstallmentPlans.priceListId, list.id));
      const kept = new Set(existing.filter((p) => !removeInstallments.includes(p.id)).map((p) => p.installments));
      for (const r of addInstallments) {
        if (kept.has(r.installments)) return res.status(400).json({ message: `An installment plan with ${r.installments} installments already exists` });
        kept.add(r.installments);
      }
    }
    const finiteOrNull = (v: unknown) => v === undefined || v === null || Number.isFinite(v);
    if (rules.some((r) => !r?.id || !finiteOrNull(r.amount) || !finiteOrNull(r.pct)
      || (r.enabled !== undefined && typeof r.enabled !== "boolean")
      || (r.appliesTo !== undefined && r.appliesTo !== null && typeof r.appliesTo !== "string")
      || (r.volumeOperator !== undefined && r.volumeOperator !== null && !["lt", "gt", "between"].includes(r.volumeOperator))
      || !finiteOrNull(r.volumeMinMl) || !finiteOrNull(r.volumeMaxMl))) {
      return res.status(400).json({ message: "Each rule row needs an id; amount/pct/volume thresholds must be finite numbers or null; volumeOperator must be lt/gt/between" });
    }
    for (const r of rules) {
      if (r.volumeOperator === "between" && (r.volumeMinMl == null || r.volumeMaxMl == null)) {
        return res.status(400).json({ message: "volumeOperator 'between' requires both volumeMinMl and volumeMaxMl" });
      }
      if (r.volumeOperator === "lt" && r.volumeMaxMl == null) {
        return res.status(400).json({ message: "volumeOperator 'lt' requires volumeMaxMl" });
      }
      if (r.volumeOperator === "gt" && r.volumeMinMl == null) {
        return res.status(400).json({ message: "volumeOperator 'gt' requires volumeMinMl" });
      }
      if (r.volumeOperator === "between" && r.volumeMinMl != null && r.volumeMaxMl != null && Number(r.volumeMinMl) >= Number(r.volumeMaxMl)) {
        return res.status(400).json({ message: "volumeMinMl must be lower than volumeMaxMl" });
      }
    }
    await db.transaction(async (tx) => {
      for (const r of collection) {
        await tx.update(pricingCollectionPrices)
          .set({ price: String(r.price) })
          .where(and(eq(pricingCollectionPrices.id, r.id), eq(pricingCollectionPrices.priceListId, list.id)));
      }
      for (const r of storage) {
        await tx.update(pricingStoragePrices)
          .set({ price: String(r.price) })
          .where(and(eq(pricingStoragePrices.id, r.id), eq(pricingStoragePrices.priceListId, list.id)));
      }
      for (const r of discounts) {
        await tx.update(pricingStorageDiscounts)
          .set({ discountPct: String(r.discountPct) })
          .where(and(eq(pricingStorageDiscounts.id, r.id), eq(pricingStorageDiscounts.priceListId, list.id)));
      }
      for (const r of installments) {
        await tx.update(pricingInstallmentPlans)
          .set({ surchargePct: String(r.surchargePct) })
          .where(and(eq(pricingInstallmentPlans.id, r.id), eq(pricingInstallmentPlans.priceListId, list.id)));
      }
      for (const id of removeDiscounts) {
        await tx.delete(pricingStorageDiscounts)
          .where(and(eq(pricingStorageDiscounts.id, id), eq(pricingStorageDiscounts.priceListId, list.id)));
      }
      for (const id of removeInstallments) {
        await tx.delete(pricingInstallmentPlans)
          .where(and(eq(pricingInstallmentPlans.id, id), eq(pricingInstallmentPlans.priceListId, list.id)));
      }
      if (addDiscounts.length) {
        await tx.insert(pricingStorageDiscounts).values(addDiscounts.map((r) => ({ priceListId: list.id, years: r.years, discountPct: String(r.discountPct) })));
      }
      if (addInstallments.length) {
        await tx.insert(pricingInstallmentPlans).values(addInstallments.map((r) => ({ priceListId: list.id, installments: r.installments, surchargePct: String(r.surchargePct) })));
      }
      for (const r of maxDiscounts) {
        await tx.update(pricingCollectionPrices)
          .set({ maxCollectionDiscountPct: r.maxDiscountPct === null ? null : String(r.maxDiscountPct) })
          .where(and(eq(pricingCollectionPrices.id, r.id), eq(pricingCollectionPrices.priceListId, list.id)));
      }
      for (const r of rules) {
        await tx.update(pricingAdjustmentRules)
          .set({
            ...(r.enabled !== undefined ? { enabled: r.enabled } : {}),
            ...(r.amount !== undefined ? { amount: r.amount === null ? null : String(r.amount) } : {}),
            ...(r.pct !== undefined ? { pct: r.pct === null ? null : String(r.pct) } : {}),
            ...(r.appliesTo !== undefined ? { appliesTo: r.appliesTo === "" ? null : r.appliesTo } : {}),
            ...(r.volumeOperator !== undefined ? { volumeOperator: r.volumeOperator } : {}),
            ...(r.volumeMinMl !== undefined ? { volumeMinMl: r.volumeMinMl === null ? null : String(r.volumeMinMl) } : {}),
            ...(r.volumeMaxMl !== undefined ? { volumeMaxMl: r.volumeMaxMl === null ? null : String(r.volumeMaxMl) } : {}),
          })
          .where(and(eq(pricingAdjustmentRules.id, r.id), eq(pricingAdjustmentRules.priceListId, list.id)));
      }
    });
    res.json({ ok: true, updated: collection.length + storage.length + discounts.length + installments.length + rules.length + maxDiscounts.length });
  });

  // add a new custom incomplete-collection row (draft only; note optional)
  app.post("/api/pricing/price-lists/:id/incomplete-rules", requireAuth, requirePricingAdmin, async (req, res) => {
    const { orderedProductId, collectedMask, collectionPrice, storagePrices, note } = req.body as {
      orderedProductId?: string; collectedMask?: string; collectionPrice?: number;
      storagePrices?: Record<string, number>; note?: string;
    };
    const [list] = await db.select().from(pricingPriceLists).where(eq(pricingPriceLists.id, req.params.id));
    if (!list) return res.status(404).json({ message: "Price list not found" });
    if (list.status !== "draft") return res.status(400).json({ message: "Only draft price lists can be edited" });
    if (!orderedProductId || typeof orderedProductId !== "string") return res.status(400).json({ message: "orderedProductId required" });
    if (typeof collectedMask !== "string") return res.status(400).json({ message: "collectedMask must be a string" });
    if (!Number.isFinite(collectionPrice)) return res.status(400).json({ message: "collectionPrice must be a finite number" });
    if (storagePrices !== undefined && (typeof storagePrices !== "object" || storagePrices === null || Object.values(storagePrices).some((v) => !Number.isFinite(v)))) {
      return res.status(400).json({ message: "storagePrices must be a map of finite numbers" });
    }
    const masks = collectedMask.split("+").filter(Boolean);
    const resultLabel = masks.length === 0 ? "Nothing collected" : masks.join(" + ");
    try {
      const [inserted] = await db.insert(pricingIncompleteRules).values({
        priceListId: list.id,
        orderedProductId,
        collectedMask,
        resultLabel,
        collectionPrice: String(collectionPrice),
        storagePrices: storagePrices ?? null,
        isOverride: false,
        note: note ?? null,
      }).returning();
      res.json(inserted);
    } catch (e: any) {
      if (e?.code === "23505") return res.status(409).json({ message: "A rule with this component combination already exists" });
      throw e;
    }
  });

  // manual override of one matrix row (pricing administrator only, note required)
  app.patch("/api/pricing/incomplete-rules/:id", requireAuth, requirePricingAdmin, async (req, res) => {
    const { collectionPrice, storagePrices, note } = req.body as { collectionPrice?: number; storagePrices?: Record<string, number>; note?: string };
    if (!note) return res.status(400).json({ message: "A note explaining the override is required" });
    if (collectionPrice !== undefined && !Number.isFinite(collectionPrice)) {
      return res.status(400).json({ message: "collectionPrice must be a finite number" });
    }
    if (storagePrices !== undefined && (typeof storagePrices !== "object" || storagePrices === null || Object.values(storagePrices).some((v) => !Number.isFinite(v)))) {
      return res.status(400).json({ message: "storagePrices must be a map of finite numbers" });
    }
    const [updated] = await db
      .update(pricingIncompleteRules)
      .set({
        ...(collectionPrice !== undefined ? { collectionPrice: String(collectionPrice) } : {}),
        ...(storagePrices !== undefined ? { storagePrices } : {}),
        isOverride: true,
        note,
      })
      .where(eq(pricingIncompleteRules.id, req.params.id))
      .returning();
    if (!updated) return res.status(404).json({ message: "Rule not found" });
    res.json(updated);
  });
}
