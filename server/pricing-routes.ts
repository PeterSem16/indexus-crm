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
  users,
  userRoles,
  roleModulePermissions,
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
    collectionPrices,
    storagePrices,
    storageDiscounts,
    installmentPlans,
    incompleteRules: incompleteRules.map((r) => ({
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

  app.get("/api/pricing/costs", requireAuth, async (_req, res) => {
    res.json(await db.select().from(pricingProductCosts).orderBy(pricingProductCosts.countryCode));
  });

  // price calculation with itemized breakdown (audit trail)
  app.post("/api/pricing/calculate", requireAuth, async (req, res) => {
    try {
      const { priceListId, countryCode, ...calc } = req.body as { priceListId?: string; countryCode?: string } & CalculationInput;
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

  // manual override of one matrix row (pricing administrator only, note required)
  app.patch("/api/pricing/incomplete-rules/:id", requireAuth, requirePricingAdmin, async (req, res) => {
    const { collectionPrice, storagePrices, note } = req.body as { collectionPrice?: number; storagePrices?: Record<string, number>; note?: string };
    if (!note) return res.status(400).json({ message: "A note explaining the override is required" });
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
