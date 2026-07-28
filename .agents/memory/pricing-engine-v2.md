---
name: Pricing Engine V2 (Products 2)
description: Country price lists + incomplete-collection matrix module; decisions and workbook quirks
---
Decisions (approved 28.7.2026, see docs/analyza-cennik-produkty.txt):
- Will FULLY replace the old products module eventually (variant A); engine must always return itemized line items for BO/contracts/invoicing.
- Price lists managed EXCLUSIVELY by the "Pricing Administrator" role (RBAC module `pricing`); workflow draft → active → archived (activating archives the previous active list per country).
- Grandfathering: customers keep a reference to the price-list version they were billed by (pricing_customer_price_lists); historical lists are never deleted.
- HU contract specifics handled via matrix-row overrides (isOverride + mandatory note), not per-country regimes.

**Why component-based:** prices for incomplete collections (failed collection/contamination) are only derivable when a product is a set of components (CB, PB, T_CB, T_PB, PL) with standalone prices.

Rules semantics: LOW_VOLUME is component-conditional (`applies_to`, e.g. CB+PB) — do not apply unconditionally; CONTAMINATION = 100% off the contaminated component's collection fee; storage is always charged by REALLY stored components; nothing collected = FLAT_FEE only.

Workbook quirks (Cennik nekompletnych odberov 2026): ITA sheet has NEGATIVE standalone PL prices (imported as-is with warnings, old ceny "nereflektuju cenovu politiku"); storage-year options differ per country (SK/RO/IT 1/10/20, CZ/AT 1/5/10); prepay storage discounts differ (HU 40/50% contractual vs standard 15/25%).

Seed importer `scripts/import-pricing-excel.ts` WIPES all pricing_* tables and reseeds — safe only while no customers reference price lists; it self-validates 4 price calculations against workbook numbers.
