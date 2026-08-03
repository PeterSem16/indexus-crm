---
name: Pricing Engine V2 (Products 2)
description: Country price lists + incomplete-collection matrix; current implementation state and next steps
---

**Full status doc:** `docs/PRICING_ENGINE_V2_STATUS.md` — read that before any V2 work.

## What is DONE (Fázy 1 + 2)
- DB schema: all `pricing_*` tables including `pricing_customer_price_lists` (grandfathering)
- Engine (`server/pricing-engine.ts`): pure TS, itemized line items, all rules, per-component + per-product sales/BO discounts with max-cap validation
- API (`server/pricing-routes.ts`): full CRUD for price lists, calculate endpoint, incomplete-rules POST
- Importer: `scripts/import-pricing-excel.ts` — wipes + reseeds, self-validates 4 calcs; safe only while no customers reference price lists
- UI (`client/src/pages/pricing.tsx`): Cenníky / Matica / Kalkulačka tabs fully working
  - Matica tab shows DRAFT lists too (country tabs + secondary list picker when active+draft coexist)
  - Calculator installment dropdown uses ONLY plans from the current price list (not hardcoded)
  - Sales/BO discount sliders: product-level + per-component, each capped by maxCollectionDiscountPct

## Key decisions (approved 28.7.2026, NON-NEGOTIABLE)
- Variant A: new module will FULLY replace old Products/Configurator (not parallel forever)
- Pricing Admin role only; workflow draft→active→archived
- Grandfathering: customer always linked to the price-list version they were billed by
- HU specifics via matrix overrides (isOverride+note), not special regime
- Same engine used BOTH at collection-result entry (BO) AND invoicing

## Next steps (Fáza 3 + 4)
- **"Nový rok" button**: create draft copy of active list with storage prices × inflation rate (AT/IT: only if rate > 5%)
- **Replace old Products module**: add `pricing_price_list_id` + `pricing_product_code` to customer_products, contract_instance_products, invoices, deal_products; migration table old-product → V2 code; disable old Products/Configurator tabs once validated
- **Grandfathering auto-save**: when agent saves a customer + product, auto-link to current active price list of their country
- **BO integration**: show pricing calc on BO task based on customer's stored price list + actual collection result
- **Historical price list import**: import 2024 version of the workbook so existing customers can be grandfathered

## Workbook quirks
- ITA: NEGATIVE standalone PL prices (imported as-is with warning)
- Storage year options differ: SK/RO/IT = 1/10/20, CZ/AT = 1/5/10
- Prepay discounts: HU = 40%/50% (contractual), others = 15%/25%
- AT/IT inflation: only apply if annual rate > 5% (contractual condition)
