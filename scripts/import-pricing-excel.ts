// ============================================================
// One-time seed importer: Cennik nekompletnych odberov 2026
// Parses the pricing workbook and seeds Pricing Engine V2 tables.
// Idempotent: wipes and re-inserts pricing data (safe to re-run
// while no customers are linked to price lists).
// Run: npx tsx scripts/import-pricing-excel.ts
// ============================================================
import xlsxPkg from "xlsx";
const XLSX: any = (xlsxPkg as any).readFile ? xlsxPkg : (xlsxPkg as any).default;
import { db, pool } from "../server/db";
import {
  pricingComponents, pricingProducts, pricingProductComponents,
  pricingPriceLists, pricingCollectionPrices, pricingStoragePrices,
  pricingStorageDiscounts, pricingInstallmentPlans, pricingIncompleteRules,
  pricingAdjustmentRules, pricingProductCosts, roles, roleModulePermissions,
} from "../shared/schema";
import { eq, and } from "drizzle-orm";

const FILE = "attached_assets/Cennik_nekompletnych_odberov_2026_PAUSAL_2026_01_23_1785222719703.xlsx";

const COMPONENTS = [
  { code: "CB", name: "Cord blood", sortOrder: 1 },
  { code: "PB", name: "Placental blood", sortOrder: 2 },
  { code: "T_CB", name: "Cord tissue (CB contract)", sortOrder: 3 },
  { code: "T_PB", name: "Cord tissue (PB contract)", sortOrder: 4 },
  { code: "PL", name: "Placenta", sortOrder: 5 },
];
const PRODUCTS = [
  { code: "CLASSIC", name: "Classic", components: ["CB"], sortOrder: 1 },
  { code: "PREMIUM", name: "Premium", components: ["CB", "PB"], sortOrder: 2 },
  { code: "CLASSIC_T", name: "Classic+Tissue", components: ["CB", "T_CB"], sortOrder: 3 },
  { code: "PREMIUM_T", name: "Premium+Tissue", components: ["CB", "PB", "T_PB"], sortOrder: 4 },
  { code: "PLACENTA", name: "Placenta", components: ["CB", "PB", "T_PB", "PL"], sortOrder: 5 },
];
// component order used for header columns in country sheets (cols 1..5)
const SHEET_COMPONENT_ORDER = ["CB", "PB", "T_CB", "T_PB", "PL"];
// ordered-product label in matrix col0 → product code
const PRODUCT_LABELS: Record<string, string> = {
  "classic": "CLASSIC", "premium": "PREMIUM",
  "classic+tissue": "CLASSIC_T", "premium+tissue": "PREMIUM_T",
  "placenta": "PLACENTA",
};
// header product columns (row2 cols1-5)
const HEADER_PRODUCTS = ["CLASSIC", "PREMIUM", "CLASSIC_T", "PREMIUM_T", "PLACENTA"];

const COUNTRY_SHEETS: Record<string, { country: string; currency: string }> = {
  SK: { country: "SK", currency: "EUR" },
  CZ: { country: "CZ", currency: "CZK" },
  RO: { country: "RO", currency: "RON" },
  HU: { country: "HU", currency: "HUF" },
  AT: { country: "AT", currency: "EUR" },
  ITA: { country: "IT", currency: "EUR" },
};

const num = (v: any): number | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/[€]|Kč|Ft|RON|\s|\u00a0/g, "").replace(/,/g, "");
  if (s === "" || s === "-") return null;
  const x = parseFloat(s);
  return Number.isFinite(x) ? x : null;
};
const pct = (v: any): number | null => {
  const m = String(v ?? "").match(/([\d.]+)\s*%/);
  return m ? parseFloat(m[1]) : null;
};
const yearsFromLabel = (v: any): number | null => {
  const m = String(v ?? "").match(/(\d+)\s*YEAR/i);
  return m ? parseInt(m[1]) : null;
};

async function main() {
  const wb = XLSX.readFile(FILE);
  const sheet = (n: string) => XLSX.utils.sheet_to_json<any[]>(wb.Sheets[n], { header: 1, raw: false }) as any[][];

  // ---- wipe pricing data (phase 1: no FKs into these tables yet) ----
  for (const t of ["pricing_incomplete_rules","pricing_adjustment_rules","pricing_collection_prices","pricing_storage_prices","pricing_storage_discounts","pricing_installment_plans","pricing_product_costs","pricing_price_lists","pricing_product_components","pricing_products","pricing_components"]) {
    await pool.query(`DELETE FROM ${t}`);
  }

  // ---- components + products ----
  const compIds: Record<string, string> = {};
  for (const c of COMPONENTS) {
    const [row] = await db.insert(pricingComponents).values(c).returning();
    compIds[c.code] = row.id;
  }
  const prodIds: Record<string, string> = {};
  for (const p of PRODUCTS) {
    const [row] = await db.insert(pricingProducts).values({ code: p.code, name: p.name, sortOrder: p.sortOrder }).returning();
    prodIds[p.code] = row.id;
    for (const cc of p.components) {
      await db.insert(pricingProductComponents).values({ productId: row.id, componentId: compIds[cc] });
    }
  }

  // ---- inflation + FX from STORAGE PRICE (current PY block) ----
  const sp = sheet("STORAGE PRICE");
  const metaByCountry: Record<string, { inflation: number | null; fx: number | null }> = {};
  for (const r of sp.slice(0, 23)) {
    const c = String(r?.[0] ?? "").trim();
    const key = c === "IT" ? "IT" : c;
    if (["SK","RO","HU","CZ","AT","IT"].includes(key) && r[9] !== undefined) {
      metaByCountry[key] = { inflation: pct(r[9]), fx: num(r[10]) };
    }
  }

  // ---- installments per country from COLLECTION PRICE "New prices" block ----
  const cp = sheet("COLLECTION PRICE");
  const newIdx = cp.findIndex((r) => String(r?.[0] ?? "").toLowerCase().includes("new") && String(r?.[0] ?? "").includes("2025"));
  const installmentsByCountry: Record<string, number[]> = {};
  let cur: string | null = null;
  for (const r of cp.slice(newIdx + 2)) {
    const c0 = String(r?.[0] ?? "").trim();
    if (["SK","RO","HU","CZ","AT","IT"].includes(c0)) cur = c0;
    const inst = num(r?.[1]);
    if (cur && inst !== null && inst > 0 && Number.isInteger(inst)) {
      (installmentsByCountry[cur] ??= []).push(inst);
    }
    if (c0 && !["SK","RO","HU","CZ","AT","IT"].includes(c0) && !c0.startsWith("New")) break;
  }

  // ---- historical 2024 price lists (collection-only, archived) ----
  const oldBlock = cp.slice(2, newIdx);
  let oldCountry: string | null = null;
  const list2024: Record<string, Record<string, number>> = {};
  for (const r of oldBlock) {
    const c0 = String(r?.[0] ?? "").trim();
    if (["SK","RO","HU","CZ","AT","IT"].includes(c0)) oldCountry = c0;
    if (!oldCountry) continue;
    const inst = num(r?.[1]);
    if (inst === 1) {
      const prices: Record<string, number> = {};
      HEADER_PRODUCTS.forEach((pc, i) => {
        const v = num(r[2 + i]);
        if (v !== null && v > 0) prices[pc] = v;
      });
      if (Object.keys(prices).length) list2024[oldCountry] = prices;
    }
  }
  for (const [country, prices] of Object.entries(list2024)) {
    const currency = country === "CZ" ? "CZK" : country === "RO" ? "RON" : country === "HU" ? "HUF" : "EUR";
    const [pl] = await db.insert(pricingPriceLists).values({
      countryCode: country, currency, name: `${country} 2024`, validFrom: "2024-01-01",
      status: "archived", note: "Historical price list imported from workbook (collection prices only) — grandfathering reference.",
      fxRateToEur: metaByCountry[country]?.fx != null ? String(metaByCountry[country]!.fx) : null,
    }).returning();
    for (const [pc, v] of Object.entries(prices)) {
      await db.insert(pricingCollectionPrices).values({ priceListId: pl.id, productId: prodIds[pc], price: String(v) });
    }
  }

  // ---- active price lists from country sheets ----
  const checks: Array<{ country: string; listId: string }> = [];
  for (const [sheetName, info] of Object.entries(COUNTRY_SHEETS)) {
    const rows = sheet(sheetName);
    const meta = metaByCountry[info.country] ?? { inflation: null, fx: null };

    // storage year labels for header block (rows 4-6, label in col 6)
    const headerYears: Array<{ row: number; years: number }> = [];
    for (let i = 3; i <= 7; i++) {
      const y = String(rows[i]?.[6] ?? "").match(/(\d+)\s*Year/i);
      if (y) headerYears.push({ row: i, years: parseInt(y[1]) });
    }
    // matrix storage year columns from row 11 (cols 8,9,10)
    const matrixYearCols: Array<{ col: number; years: number }> = [];
    for (const col of [8, 9, 10]) {
      const y = yearsFromLabel(rows[11]?.[col]);
      if (y) matrixYearCols.push({ col, years: y });
    }
    const yearOptions = [1, ...matrixYearCols.map((m) => m.years).filter((y) => y !== 1)].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);

    const [pl] = await db.insert(pricingPriceLists).values({
      countryCode: info.country, currency: info.currency,
      name: `${info.country} 2025/2026`, validFrom: "2025-01-01", status: "active",
      inflationRatePct: meta.inflation != null ? String(meta.inflation) : null,
      inflationCondition: ["AT","IT"].includes(info.country) ? "Annual indexation applies only when annual inflation exceeds 5%" : null,
      fxRateToEur: meta.fx != null ? String(meta.fx) : null,
      storageYearOptions: yearOptions,
      note: `Imported from workbook sheet ${sheetName} (PRICE LIST from 1.1.2025).`,
    }).returning();
    checks.push({ country: info.country, listId: pl.id });

    // header product prices: collection (row3) + storage (rows with year labels)
    for (let i = 0; i < HEADER_PRODUCTS.length; i++) {
      const collV = num(rows[3]?.[1 + i]);
      if (collV !== null && collV < 0) console.warn(`[import] WARN negative header collection price ${collV} for ${HEADER_PRODUCTS[i]} in ${sheetName}`);
      if (collV !== null) {
        await db.insert(pricingCollectionPrices).values({ priceListId: pl.id, productId: prodIds[HEADER_PRODUCTS[i]], price: String(collV) });
      }
      for (const hy of headerYears) {
        const v = num(rows[hy.row]?.[1 + i]);
        if (v !== null && v < 0) console.warn(`[import] WARN negative header storage price ${v} for ${HEADER_PRODUCTS[i]}/${hy.years}y in ${sheetName}`);
        if (v !== null) {
          await db.insert(pricingStoragePrices).values({ priceListId: pl.id, productId: prodIds[HEADER_PRODUCTS[i]], years: hy.years, price: String(v) });
        }
      }
    }

    // standalone component prices: row10 collection, row11 storage 1y
    for (let i = 0; i < SHEET_COMPONENT_ORDER.length; i++) {
      const cc = SHEET_COMPONENT_ORDER[i];
      const collV = num(rows[10]?.[1 + i]);
      if (collV !== null && collV < 0) console.warn(`[import] WARN negative component collection price ${collV} for ${cc} in ${sheetName}`);
      if (collV !== null) {
        await db.insert(pricingCollectionPrices).values({ priceListId: pl.id, componentId: compIds[cc], price: String(collV) });
      }
      const stV = num(rows[11]?.[1 + i]);
      if (stV !== null && stV < 0) console.warn(`[import] WARN negative component storage price ${stV} for ${cc} in ${sheetName}`);
      if (stV !== null) {
        await db.insert(pricingStoragePrices).values({ priceListId: pl.id, componentId: compIds[cc], years: 1, price: String(stV) });
      }
    }

    // prepay storage discounts: row10 cols 9,10 labels "15% discount", years from row11 same col
    for (const col of [9, 10]) {
      const p = pct(rows[10]?.[col]);
      const y = yearsFromLabel(rows[11]?.[col]);
      if (p != null && y != null) {
        await db.insert(pricingStorageDiscounts).values({ priceListId: pl.id, years: y, discountPct: String(p) });
      }
    }

    // installments
    for (const inst of installmentsByCountry[info.country] ?? [1]) {
      await db.insert(pricingInstallmentPlans).values({ priceListId: pl.id, installments: inst, surchargePct: "0" });
    }

    // matrix rows (from row 12 until a "*" note row)
    for (let i = 12; i < rows.length; i++) {
      const r = rows[i];
      const label = String(r?.[0] ?? "").trim();
      if (!label) continue;
      if (label.startsWith("*")) break;
      const flags = [1, 2, 3, 4, 5].map((c) => String(r[c] ?? "").toUpperCase() === "TRUE");
      const isFlat = /FLAAT|FLAT|ALL PRODUC/i.test(label) || (String(r[6] ?? "").toUpperCase() === "ALL" && flags.every((f) => !f));
      if (isFlat) {
        const fee = num(r[7]);
        if (fee !== null) {
          await db.insert(pricingAdjustmentRules).values({ priceListId: pl.id, ruleType: "FLAT_FEE", amount: String(fee), note: String(r[11] ?? r[6] ?? "") || null });
        }
        continue;
      }
      const productCode = PRODUCT_LABELS[label.toLowerCase()];
      if (!productCode) continue;
      const maskCodes = SHEET_COMPONENT_ORDER.filter((_, idx) => flags[idx]);
      const mask = maskCodes.join("+");
      const storagePrices: Record<string, number> = {};
      for (const mc of matrixYearCols) {
        const v = num(r[mc.col]);
        if (v !== null) storagePrices[String(mc.years)] = v;
      }
      const collV = num(r[7]);
      if (collV === null) continue;
      const note = r[11] ? String(r[11]) : null;
      await db.insert(pricingIncompleteRules).values({
        priceListId: pl.id, orderedProductId: prodIds[productCode],
        collectedMask: mask, resultLabel: String(r[6] ?? mask),
        collectionPrice: String(collV), storagePrices,
        isOverride: !!note, note,
      }).onConflictDoNothing();
    }

    // global rules: LOW_VOLUME + CONTAMINATION from footnotes
    const foot = rows.map((r) => String(r?.[0] ?? "")).filter((s) => s.startsWith("*")).join(" | ");
    const lv = foot.match(/discount\s+([\d\s.,]+)\s*(€|EUR|RON|Kč|CZK|Ft|HUF)/i);
    if (lv) {
      // component condition, e.g. "collection of blood (CB+PB) <20ml" or "collection CB <20ml"
      const at = foot.match(/collection[^<]*?\(?((?:CB|PB)(?:\s*\+\s*(?:CB|PB))*)\)?\s*<\s*20\s*ml/i);
      const appliesTo = at ? at[1].replace(/\s/g, "") : "CB";
      await db.insert(pricingAdjustmentRules).values({ priceListId: pl.id, ruleType: "LOW_VOLUME", amount: String(num(lv[1])), appliesTo, note: `Blood collection < 20 ml — fixed discount (workbook footnote: applies to ${appliesTo}).` });
    }
    await db.insert(pricingAdjustmentRules).values({ priceListId: pl.id, ruleType: "CONTAMINATION", pct: "100", note: "Contamination = 100% discount from collection fee of contaminated item (workbook footnote)." });
  }

  // ---- cost sheet ----
  const cost = sheet("cost");
  const countryCols: Array<{ country: string; col: number }> = [];
  (cost[1] ?? []).forEach((v: any, col: number) => {
    const c = String(v ?? "").trim();
    if (["SK","RO","CZ","HU","AT","ITA"].includes(c)) countryCols.push({ country: c === "ITA" ? "IT" : c, col });
  });
  const grossRow = cost.find((r) => String(r?.[0] ?? "").startsWith("Gross revenue"));
  const totalRow = cost.find((r) => String(r?.[0] ?? "").trim() === "TOTAL COST");
  const labelRow = cost[2] ?? [];
  for (let gi = 0; gi < countryCols.length; gi++) {
    const start = countryCols[gi].col;
    const end = gi + 1 < countryCols.length ? countryCols[gi + 1].col : labelRow.length;
    for (let col = start; col < end; col++) {
      const label = String(labelRow[col] ?? "").trim();
      if (!label) continue;
      const gross = num(grossRow?.[col]);
      const total = num(totalRow?.[col]);
      if (gross === null && total === null) continue;
      await db.insert(pricingProductCosts).values({
        countryCode: countryCols[gi].country, productLabel: label,
        grossRevenueEur: gross != null ? String(gross) : null,
        totalCostEur: total != null ? String(total) : null,
      }).onConflictDoNothing();
    }
  }

  // ---- Pricing Administrator role + module permission ----
  let [role] = await db.select().from(roles).where(eq(roles.name, "Pricing Administrator"));
  if (!role) {
    [role] = await db.insert(roles).values({
      name: "Pricing Administrator",
      description: "Exclusive management of price lists for all countries (create, edit, approve, activate). No other role may modify price lists.",
      department: "finance", legacyRole: "user", isSystem: true,
    }).returning();
  }
  const [perm] = await db.select().from(roleModulePermissions).where(and(eq(roleModulePermissions.roleId, role.id), eq(roleModulePermissions.moduleKey, "pricing")));
  if (!perm) {
    await db.insert(roleModulePermissions).values({ roleId: role.id, moduleKey: "pricing", access: "visible", canAdd: true, canEdit: true });
  }

  // ---- validation against workbook ----
  const { loadPriceListBundle } = await import("../server/pricing-routes");
  const { calculatePrice } = await import("../server/pricing-engine");
  const expect = async (listCountry: string, input: any, expTotal: number, what: string) => {
    const listId = checks.find((c) => c.country === listCountry)!.listId;
    const bundle = (await loadPriceListBundle(listId))!;
    const res = calculatePrice(bundle, input);
    const ok = Math.abs(res.total - expTotal) < 0.01;
    console.log(`${ok ? "OK " : "FAIL"} ${listCountry} ${what}: got ${res.total} expected ${expTotal}${ok ? "" : " :: " + JSON.stringify(res.lineItems)}`);
    return ok;
  };
  let allOk = true;
  // SK: complete Premium 10y = 1600 + 818.30 (matrix row CB+PB is Premium full? full Premium mask CB+PB storage 818.27 header) 
  allOk = (await expect("SK", { productCode: "PREMIUM", storageYears: 10 }, 1600 + 818.27, "Premium complete 10y")) && allOk;
  // SK: Premium+Tissue ordered, only CB collected → 1400 + 713.06 (10y)
  allOk = (await expect("SK", { productCode: "PREMIUM_T", storageYears: 10, collected: ["CB"] }, 1400 + 713.06, "Premium+T only CB 10y")) && allOk;
  // SK: nothing collected → flat fee 500
  allOk = (await expect("SK", { productCode: "PREMIUM", storageYears: 10, collected: [] }, 500, "flat fee")) && allOk;
  // CZ: Premium+Tissue, only PB+T(PB) → 30000 + 9085.50 (5y)
  allOk = (await expect("CZ", { productCode: "PREMIUM_T", storageYears: 5, collected: ["PB", "T_PB"] }, 30000 + 9085.5, "PB+T(PB) 5y")) && allOk;
  console.log(allOk ? "VALIDATION PASSED" : "VALIDATION HAD FAILURES");

  const counts = await pool.query(`
    SELECT (SELECT count(*) FROM pricing_price_lists) lists,
           (SELECT count(*) FROM pricing_incomplete_rules) rules,
           (SELECT count(*) FROM pricing_collection_prices) coll,
           (SELECT count(*) FROM pricing_storage_prices) stor,
           (SELECT count(*) FROM pricing_adjustment_rules) adj,
           (SELECT count(*) FROM pricing_product_costs) costs
  `);
  console.log("COUNTS:", counts.rows[0]);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
