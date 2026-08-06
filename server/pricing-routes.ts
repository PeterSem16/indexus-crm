// ============================================================
// Pricing Engine V2 — API routes (/api/pricing/*)
// Read endpoints: any authenticated user.
// Management endpoints (status changes, overrides): pricing
// administrators only (admin role OR RBAC module "pricing").
// ============================================================
import type { Express, Request, Response, NextFunction } from "express";
import multer from "multer";
import { db } from "./db";
import { eq, and, inArray, desc, asc } from "drizzle-orm";
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
  pricingCostItems,
  pricingMarginSnapshots,
  pricingMarginOtps,
  users,
  userRoles,
  roleModulePermissions,
  exchangeRates,
  inflationRates,
} from "@shared/schema";
import { sql } from "drizzle-orm";
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

  // ── Export price list as a reimportable XLSX template ─────────────────────
  app.get("/api/pricing/price-lists/:id/export", requireAuth, requirePricingAdmin, async (req, res) => {
    const bundle = await loadPriceListBundle(req.params.id);
    if (!bundle) return res.status(404).json({ message: "Price list not found" });

    // load cost rows + items pinned to this price list
    const [costRows, allCostItems] = await Promise.all([
      db.select().from(pricingProductCosts)
        .where(eq(pricingProductCosts.priceListId, req.params.id)),
      db.select().from(pricingCostItems),
    ]);
    const itemsByRow = new Map<string, typeof allCostItems>();
    for (const item of allCostItems) {
      const cr = costRows.find((r) => r.id === item.costRowId);
      if (!cr) continue;
      if (!itemsByRow.has(item.costRowId)) itemsByRow.set(item.costRowId, []);
      itemsByRow.get(item.costRowId)!.push(item);
    }

    const xlsxPkg = await import("xlsx");
    const XLSX: any = (xlsxPkg as any).default ?? xlsxPkg;
    const wb = XLSX.utils.book_new();

    const pl = bundle.priceList;
    const prodById = new Map(bundle.products.map((p: any) => [p.id, p]));
    const compById = new Map(bundle.components.map((c: any) => [c.id, c]));

    // --- Meta ---
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Field", "Value"],
      ["name", pl.name],
      ["countryCode", pl.countryCode],
      ["currency", pl.currency],
      ["fxRateToEur", pl.fxRateToEur ?? ""],
      ["storageYearOptions", (pl.storageYearOptions ?? []).join(",")],
      ["#HINT", "Do not change Field names. Import creates a new DRAFT price list."],
    ]), "Meta");

    // --- CollectionPrices ---
    const cpRows: any[][] = [["Type", "Code", "Name", "Price", "MaxDiscountPct", "Note"]];
    for (const cp of bundle.collectionPrices) {
      const prod = cp.productId ? prodById.get(cp.productId) : null;
      const comp = cp.componentId ? compById.get(cp.componentId) : null;
      cpRows.push([
        prod ? "Product" : "Component",
        (prod ?? comp)?.code ?? "",
        (prod ?? comp)?.name ?? "",
        parseFloat(cp.price),
        cp.maxCollectionDiscountPct ? parseFloat(cp.maxCollectionDiscountPct) : "",
        cp.note ?? "",
      ]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cpRows), "CollectionPrices");

    // --- StoragePrices ---
    const spRows: any[][] = [["Type", "Code", "Name", "Years", "Price"]];
    for (const sp of bundle.storagePrices) {
      const prod = sp.productId ? prodById.get(sp.productId) : null;
      const comp = sp.componentId ? compById.get(sp.componentId) : null;
      spRows.push([
        prod ? "Product" : "Component",
        (prod ?? comp)?.code ?? "",
        (prod ?? comp)?.name ?? "",
        sp.years,
        parseFloat(sp.price),
      ]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(spRows), "StoragePrices");

    // --- StorageDiscounts ---
    const sdRows: any[][] = [["Years", "DiscountPct"]];
    for (const sd of bundle.storageDiscounts) sdRows.push([sd.years, parseFloat(sd.discountPct)]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sdRows), "StorageDiscounts");

    // --- Installments ---
    const ipRows: any[][] = [["Installments", "SurchargePct"]];
    for (const ip of bundle.installmentPlans) ipRows.push([ip.installments, parseFloat(ip.surchargePct)]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ipRows), "Installments");

    // --- IncompleteRules ---
    const irRows: any[][] = [["OrderedProductCode", "CollectedMask", "ResultLabel", "CollectionPrice", "StoragePricesJSON", "IsOverride", "Note"]];
    for (const ir of bundle.incompleteRules) {
      const prod = prodById.get(ir.orderedProductId);
      irRows.push([
        prod?.code ?? ir.orderedProductId,
        ir.collectedMask,
        ir.resultLabel,
        parseFloat(ir.collectionPrice),
        ir.storagePrices ? JSON.stringify(ir.storagePrices) : "",
        ir.isOverride ? "TRUE" : "FALSE",
        ir.note ?? "",
      ]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(irRows), "IncompleteRules");

    // --- AdjustmentRules ---
    const arRows: any[][] = [["RuleType", "Amount", "Pct", "AppliesTo", "Note", "Enabled", "VolumeOperator", "VolumeMinMl", "VolumeMaxMl"]];
    for (const ar of bundle.adjustmentRules) {
      arRows.push([
        ar.ruleType,
        ar.amount ? parseFloat(ar.amount) : "",
        ar.pct ? parseFloat(ar.pct) : "",
        ar.appliesTo ?? "",
        ar.note ?? "",
        ar.enabled !== false ? "TRUE" : "FALSE",
        (ar as any).volumeOperator ?? "",
        (ar as any).volumeMinMl ? parseFloat((ar as any).volumeMinMl) : "",
        (ar as any).volumeMaxMl ? parseFloat((ar as any).volumeMaxMl) : "",
      ]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(arRows), "AdjustmentRules");

    // --- Costs (if any) ---
    if (costRows.length > 0) {
      const maxItems = Math.max(0, ...costRows.map((r) => (itemsByRow.get(r.id) ?? []).length));
      const costHeader = ["ProductLabel", "GrossRevenueEUR", "TotalCostEUR", "ReziaEUR", "Note"];
      for (let i = 1; i <= maxItems; i++) costHeader.push(`Item${i}_Label`, `Item${i}_Amount`);
      const costData: any[][] = [costHeader];
      for (const cr of costRows) {
        const items = (itemsByRow.get(cr.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder);
        const row: any[] = [
          cr.productLabel,
          cr.grossRevenueEur ? parseFloat(cr.grossRevenueEur) : "",
          cr.totalCostEur ? parseFloat(cr.totalCostEur) : "",
          cr.reziaEur ? parseFloat(cr.reziaEur) : "",
          cr.note ?? "",
        ];
        for (const item of items) row.push(item.label, parseFloat(item.amountEur));
        costData.push(row);
      }
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(costData), "Costs");
    }

    const buf: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const safeName = pl.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="cennik-${pl.countryCode}-${safeName}.xlsx"`);
    res.send(buf);
  });

  // ── Import price list from XLSX template (creates new draft) ─────────────
  const uploadPricingTemplate = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

  app.post("/api/pricing/import-template", requireAuth, requirePricingAdmin, uploadPricingTemplate.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    try {
      const xlsxPkg = await import("xlsx");
      const XLSX: any = (xlsxPkg as any).default ?? xlsxPkg;
      const wb = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheet = (name: string): any[][] => {
        if (!wb.Sheets[name]) return [];
        return XLSX.utils.sheet_to_json<any[]>(wb.Sheets[name], { header: 1, raw: false, defval: "" }) as any[][];
      };
      const parseNum = (v: any): number | null => {
        if (v === "" || v === null || v === undefined) return null;
        const n = parseFloat(String(v));
        return Number.isFinite(n) ? n : null;
      };

      // Meta
      const meta: Record<string, string> = {};
      for (const [k, v] of sheet("Meta").slice(1)) {
        if (k && !String(k).startsWith("#")) meta[String(k)] = String(v ?? "");
      }
      if (!meta.countryCode || !meta.currency) return res.status(400).json({ message: "Meta sheet is missing countryCode or currency" });

      const [allProducts, allComponents] = await Promise.all([
        db.select().from(pricingProducts),
        db.select().from(pricingComponents),
      ]);
      const prodByCode = new Map(allProducts.map((p) => [p.code.toUpperCase(), p]));
      const compByCode = new Map(allComponents.map((c) => [c.code.toUpperCase(), c]));

      const storageYearOptions = meta.storageYearOptions
        ? meta.storageYearOptions.split(",").map((s) => parseInt(s.trim())).filter((n) => Number.isInteger(n) && n > 0)
        : null;

      const sessionUser = (req.session as any)?.user;
      const [newList] = await db.insert(pricingPriceLists).values({
        countryCode: meta.countryCode.toUpperCase(),
        currency: meta.currency.toUpperCase(),
        name: meta.name || `${meta.countryCode} Import ${new Date().toLocaleDateString("sk-SK")}`,
        fxRateToEur: meta.fxRateToEur || null,
        status: "draft",
        storageYearOptions: storageYearOptions?.length ? storageYearOptions : null,
        note: `Imported from template by ${sessionUser?.name ?? sessionUser?.email ?? "user"}`,
      }).returning();

      // CollectionPrices
      for (const [type, code, , priceStr, maxDiscStr, noteStr] of sheet("CollectionPrices").slice(1)) {
        if (!code || !priceStr) continue;
        const price = parseNum(priceStr); if (price === null) continue;
        const prod = String(type) === "Product" ? prodByCode.get(String(code).toUpperCase()) : null;
        const comp = String(type) !== "Product" ? compByCode.get(String(code).toUpperCase()) : null;
        if (!prod && !comp) continue;
        const maxDisc = parseNum(maxDiscStr);
        await db.insert(pricingCollectionPrices).values({
          priceListId: newList.id, productId: prod?.id ?? null, componentId: comp?.id ?? null,
          price: String(price), maxCollectionDiscountPct: maxDisc != null ? String(maxDisc) : null,
          note: String(noteStr || "") || null,
        });
      }

      // StoragePrices
      for (const [type, code, , yearsStr, priceStr] of sheet("StoragePrices").slice(1)) {
        if (!code || !priceStr || !yearsStr) continue;
        const price = parseNum(priceStr); const years = parseInt(String(yearsStr));
        if (price === null || !Number.isInteger(years) || years <= 0) continue;
        const prod = String(type) === "Product" ? prodByCode.get(String(code).toUpperCase()) : null;
        const comp = String(type) !== "Product" ? compByCode.get(String(code).toUpperCase()) : null;
        if (!prod && !comp) continue;
        await db.insert(pricingStoragePrices).values({
          priceListId: newList.id, productId: prod?.id ?? null, componentId: comp?.id ?? null, years, price: String(price),
        });
      }

      // StorageDiscounts
      for (const [yearsStr, pctStr] of sheet("StorageDiscounts").slice(1)) {
        if (!yearsStr || !pctStr) continue;
        const years = parseInt(String(yearsStr)); const pct = parseNum(pctStr);
        if (!Number.isInteger(years) || years <= 0 || pct === null) continue;
        await db.insert(pricingStorageDiscounts).values({ priceListId: newList.id, years, discountPct: String(pct) });
      }

      // Installments
      for (const [instStr, pctStr] of sheet("Installments").slice(1)) {
        if (!instStr || !pctStr) continue;
        const installments = parseInt(String(instStr)); const pct = parseNum(pctStr);
        if (!Number.isInteger(installments) || installments <= 0 || pct === null) continue;
        await db.insert(pricingInstallmentPlans).values({ priceListId: newList.id, installments, surchargePct: String(pct) });
      }

      // IncompleteRules
      for (const [prodCode, mask, label, cpStr, spJson, isOverride, noteStr] of sheet("IncompleteRules").slice(1)) {
        if (!prodCode || !cpStr) continue;
        const prod = prodByCode.get(String(prodCode).toUpperCase()); if (!prod) continue;
        const cp = parseNum(cpStr); if (cp === null) continue;
        let storagePrices: Record<string, number> | null = null;
        try { storagePrices = spJson && String(spJson) !== "" ? JSON.parse(String(spJson)) : null; } catch { /* ignore */ }
        await db.insert(pricingIncompleteRules).values({
          priceListId: newList.id, orderedProductId: prod.id,
          collectedMask: String(mask ?? ""), resultLabel: String(label ?? mask ?? ""),
          collectionPrice: String(cp), storagePrices,
          isOverride: String(isOverride).toUpperCase() === "TRUE", note: String(noteStr || "") || null,
        }).onConflictDoNothing();
      }

      // AdjustmentRules
      for (const [ruleType, amtStr, pctStr, appliesTo, noteStr, enabled, volOp, volMin, volMax] of sheet("AdjustmentRules").slice(1)) {
        if (!ruleType) continue;
        await db.insert(pricingAdjustmentRules).values({
          priceListId: newList.id, ruleType: String(ruleType),
          amount: parseNum(amtStr) != null ? String(parseNum(amtStr)) : null,
          pct: parseNum(pctStr) != null ? String(parseNum(pctStr)) : null,
          appliesTo: String(appliesTo || "") || null, note: String(noteStr || "") || null,
          enabled: String(enabled).toUpperCase() !== "FALSE",
          volumeOperator: String(volOp || "") || null,
          volumeMinMl: parseNum(volMin) != null ? String(parseNum(volMin)) : null,
          volumeMaxMl: parseNum(volMax) != null ? String(parseNum(volMax)) : null,
        });
      }

      // Costs
      for (const row of sheet("Costs").slice(1)) {
        if (!row[0]) continue;
        const [labelStr, grossStr, totalStr, reziaStr, noteStr, ...itemPairs] = row;
        const [costRow] = await db.insert(pricingProductCosts).values({
          countryCode: meta.countryCode.toUpperCase(), productLabel: String(labelStr),
          grossRevenueEur: parseNum(grossStr) != null ? String(parseNum(grossStr)) : null,
          totalCostEur: parseNum(totalStr) != null ? String(parseNum(totalStr)) : null,
          reziaEur: parseNum(reziaStr) != null ? String(parseNum(reziaStr)) : null,
          note: String(noteStr || "") || null, priceListId: newList.id,
        }).returning();
        for (let i = 0; i < itemPairs.length; i += 2) {
          const iLabel = String(itemPairs[i] ?? ""); const iAmt = parseNum(itemPairs[i + 1]);
          if (!iLabel || iAmt === null) continue;
          await db.insert(pricingCostItems).values({ costRowId: costRow.id, label: iLabel, amountEur: String(iAmt), sortOrder: Math.floor(i / 2) });
        }
      }

      res.json({ ok: true, priceListId: newList.id, name: newList.name });
    } catch (e: any) {
      console.error("[import-template]", e);
      res.status(500).json({ message: e.message });
    }
  });

  // costs contain margins — pricing administrators only
  // ?priceListId=xxx → rows for that list; omit → global/current rows (price_list_id IS NULL)
  app.get("/api/pricing/costs", requireAuth, requirePricingAdmin, async (req, res) => {
    const plid = (req.query.priceListId as string | undefined) ?? null;
    const rows = plid
      ? await db.select().from(pricingProductCosts)
          .where(eq(pricingProductCosts.priceListId, plid))
          .orderBy(pricingProductCosts.countryCode)
      : await db.select().from(pricingProductCosts)
          .where(sql`price_list_id IS NULL`)
          .orderBy(pricingProductCosts.countryCode);
    res.json(rows);
  });

  // ── Margin tab OTP guard ──────────────────────────────────────────────────

  const requireMarginSession = (req: Request, res: Response, next: NextFunction) => {
    const verifiedAt = (req.session as any)?.marginOtpVerifiedAt as number | undefined;
    if (!verifiedAt || Date.now() - verifiedAt > 2 * 60 * 60 * 1000) {
      return res.status(403).json({ message: "Margin session expired. Please verify OTP again." });
    }
    next();
  };

  // Initialize cost rows for a specific price list from its collection prices
  app.post("/api/pricing/margin/init-from-list/:priceListId", requireAuth, requirePricingAdmin, requireMarginSession, async (req, res) => {
    try {
      const listId = req.params.priceListId;
      const bundle = await loadPriceListBundle(listId);
      if (!bundle) return res.status(404).json({ message: "Price list not found" });
      const { priceList, products, collectionPrices } = bundle;
      const created: string[] = [];
      for (const product of products) {
        const cp = collectionPrices.find((p) => p.productId === product.id && !p.componentId);
        if (!cp) continue;
        const grossEur = parseFloat(cp.price) / (parseFloat(priceList.fxRateToEur ?? "1") || 1);
        await db.execute(sql`
          INSERT INTO pricing_product_costs (id, country_code, product_label, gross_revenue_eur, price_list_id)
          VALUES (gen_random_uuid(), ${priceList.countryCode}, ${product.name}, ${grossEur.toFixed(2)}, ${listId})
          ON CONFLICT ON CONSTRAINT uq_ppc_country_label_pricelist DO NOTHING
        `);
        created.push(product.code);
      }
      res.json({ ok: true, products: created, countryCode: priceList.countryCode });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

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

  // ── Cost items (breakdown of direct costs per product row) ──────────────
  // Helper: recompute total_cost_eur = -(sum of items) on the parent row
  async function recomputeTotalCost(costRowId: string) {
    await db.execute(sql`
      UPDATE pricing_product_costs
      SET total_cost_eur = -(
        SELECT COALESCE(SUM(amount_eur), 0) FROM pricing_cost_items WHERE cost_row_id = ${costRowId}
      )
      WHERE id = ${costRowId}
    `);
  }

  // List all cost items (requires margin session)
  app.get("/api/pricing/cost-items", requireAuth, requirePricingAdmin, requireMarginSession, async (_req, res) => {
    const items = await db.select().from(pricingCostItems).orderBy(pricingCostItems.sortOrder);
    res.json(items);
  });

  // Add a cost item to a cost row
  app.post("/api/pricing/costs/:id/items", requireAuth, requirePricingAdmin, requireMarginSession, async (req, res) => {
    const { label, amountEur } = req.body as { label?: string; amountEur?: number };
    const amount = Number(amountEur ?? 0);
    if (!Number.isFinite(amount)) return res.status(400).json({ message: "amountEur must be a finite number" });
    const [parent] = await db.select({ id: pricingProductCosts.id }).from(pricingProductCosts).where(eq(pricingProductCosts.id, req.params.id));
    if (!parent) return res.status(404).json({ message: "Cost row not found" });
    const existing = await db.select({ sortOrder: pricingCostItems.sortOrder }).from(pricingCostItems).where(eq(pricingCostItems.costRowId, req.params.id));
    const maxSort = existing.length ? Math.max(...existing.map((i) => i.sortOrder)) : 0;
    const [item] = await db.insert(pricingCostItems).values({
      costRowId: req.params.id, label: label ?? "", amountEur: String(amount), sortOrder: maxSort + 1,
    }).returning();
    await recomputeTotalCost(req.params.id);
    res.json(item);
  });

  // Update label or amount of a cost item
  app.patch("/api/pricing/cost-items/:itemId", requireAuth, requirePricingAdmin, requireMarginSession, async (req, res) => {
    const { label, amountEur } = req.body as { label?: string; amountEur?: number };
    if (amountEur !== undefined && !Number.isFinite(Number(amountEur))) {
      return res.status(400).json({ message: "amountEur must be a finite number" });
    }
    const [existing] = await db.select().from(pricingCostItems).where(eq(pricingCostItems.id, req.params.itemId));
    if (!existing) return res.status(404).json({ message: "Cost item not found" });
    const updates: Record<string, string> = {};
    if (label !== undefined) updates.label = label;
    if (amountEur !== undefined) updates.amountEur = String(Number(amountEur));
    const [updated] = await db.update(pricingCostItems).set(updates).where(eq(pricingCostItems.id, req.params.itemId)).returning();
    await recomputeTotalCost(existing.costRowId);
    res.json(updated);
  });

  // Delete a cost item
  app.delete("/api/pricing/cost-items/:itemId", requireAuth, requirePricingAdmin, requireMarginSession, async (req, res) => {
    const [existing] = await db.select().from(pricingCostItems).where(eq(pricingCostItems.id, req.params.itemId));
    if (!existing) return res.status(404).json({ message: "Cost item not found" });
    await db.delete(pricingCostItems).where(eq(pricingCostItems.id, req.params.itemId));
    await recomputeTotalCost(existing.costRowId);
    res.json({ ok: true });
  });

  // Take a margin snapshot — records current state of all cost rows for trend charts
  app.post("/api/pricing/margin/snapshot", requireAuth, requirePricingAdmin, requireMarginSession, async (req, res) => {
    try {
      const note = (req.body as { note?: string }).note ?? null;
      const costs = await db.select().from(pricingProductCosts).orderBy(pricingProductCosts.countryCode);
      if (costs.length === 0) return res.json({ ok: true, count: 0 });
      await db.insert(pricingMarginSnapshots).values(
        costs.map((c) => ({
          costRowId: c.id,
          productLabel: c.productLabel,
          countryCode: c.countryCode,
          grossRevenueEur: c.grossRevenueEur,
          totalCostEur: c.totalCostEur,
          reziaEur: c.reziaEur,
          note,
        }))
      );
      res.json({ ok: true, count: costs.length });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Return historical margin snapshots for trend charts
  app.get("/api/pricing/margin/snapshots", requireAuth, requirePricingAdmin, requireMarginSession, async (_req, res) => {
    const rows = await db.select().from(pricingMarginSnapshots).orderBy(asc(pricingMarginSnapshots.snapshotDate));
    res.json(rows);
  });

  // Return price list history data for price trend charts (no margin session needed)
  app.get("/api/pricing/trend", requireAuth, async (_req, res) => {
    try {
      const [lists, prices, products] = await Promise.all([
        db.select().from(pricingPriceLists).orderBy(asc(pricingPriceLists.validFrom)),
        db.select().from(pricingCollectionPrices),
        db.select().from(pricingProducts),
      ]);
      res.json({ lists, prices, products });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
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
