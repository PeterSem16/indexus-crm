// ============================================================
// Pricing Engine V2 — pure price computation with line items
// Input: a loaded price-list bundle + the calculation request.
// Output: itemized breakdown (collection + storage + rules),
// each line with a human-readable reason (audit trail).
// ============================================================

export interface PriceListBundle {
  priceList: {
    id: string;
    countryCode: string;
    currency: string;
    name: string;
    fxRateToEur: string | null;
    storageYearOptions: number[] | null;
  };
  products: Array<{ id: string; code: string; name: string }>;
  components: Array<{ id: string; code: string; name: string }>;
  productComponents: Array<{ productId: string; componentId: string }>;
  collectionPrices: Array<{ productId: string | null; componentId: string | null; price: string; note: string | null }>;
  storagePrices: Array<{ productId: string | null; componentId: string | null; years: number; price: string }>;
  storageDiscounts: Array<{ years: number; discountPct: string }>;
  installmentPlans: Array<{ installments: number; surchargePct: string }>;
  incompleteRules: Array<{
    id?: string;
    orderedProductId: string;
    collectedMask: string;
    resultLabel: string;
    collectionPrice: string;
    storagePrices: Record<string, number> | null;
    isOverride: boolean;
    note: string | null;
  }>;
  adjustmentRules: Array<{ ruleType: string; amount: string | null; pct: string | null; appliesTo?: string | null; note: string | null }>;
}

export interface CalculationInput {
  productCode: string;            // ordered product, e.g. PREMIUM_T
  storageYears: number;           // 1 | 5 | 10 | 20 (must be in storageYearOptions)
  installments?: number;          // default 1
  collected?: string[];           // component codes actually collected; undefined = complete collection
  contaminated?: string[];        // collected but contaminated component codes
  lowVolume?: boolean;            // blood volume < 20ml
}

export interface PriceLineItem {
  kind: "collection" | "storage" | "discount" | "surcharge" | "flat_fee";
  label: string;
  amount: number;        // in list currency, negative for discounts
  currency: string;
  reason: string;        // audit trail — why this line exists
}

export interface CalculationResult {
  priceListId: string;
  countryCode: string;
  currency: string;
  orderedProduct: string;
  effectiveProduct: string;     // discounted product label (matrix result) or ordered product
  collectedMask: string;
  lineItems: PriceLineItem[];
  totalCollection: number;
  totalStorage: number;
  total: number;
  totalEur: number | null;
  warnings: string[];
}

export function normalizeMask(codes: string[], allComponentCodes: string[]): string {
  const order = new Map(allComponentCodes.map((c, i) => [c, i]));
  return [...new Set(codes)]
    .filter((c) => order.has(c))
    .sort((a, b) => (order.get(a)! - order.get(b)!))
    .join("+");
}

const n = (v: string | number | null | undefined): number => {
  if (v === null || v === undefined) return 0;
  const x = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(x) ? x : 0;
};
const round2 = (x: number) => Math.round(x * 100) / 100;

export function calculatePrice(bundle: PriceListBundle, input: CalculationInput): CalculationResult {
  const { priceList } = bundle;
  const currency = priceList.currency;
  const warnings: string[] = [];
  const lineItems: PriceLineItem[] = [];

  const product = bundle.products.find((p) => p.code === input.productCode);
  if (!product) throw new Error(`Unknown product code: ${input.productCode}`);

  const componentCodes = bundle.components.map((c) => c.code);
  const productComponentIds = bundle.productComponents
    .filter((pc) => pc.productId === product.id)
    .map((pc) => pc.componentId);
  const productComponentCodes = bundle.components
    .filter((c) => productComponentIds.includes(c.id))
    .map((c) => c.code);

  const yearOptions = priceList.storageYearOptions ?? [];
  if (yearOptions.length && !yearOptions.includes(input.storageYears)) {
    warnings.push(`Storage duration ${input.storageYears}y is not a standard option for ${priceList.countryCode} (${yearOptions.join("/")}).`);
  }

  // --- determine collected set ---
  const isComplete = input.collected === undefined;
  const collectedRaw = isComplete ? productComponentCodes : input.collected!;
  const outside = collectedRaw.filter((c) => !productComponentCodes.includes(c));
  if (outside.length) warnings.push(`Collected components not part of ordered product were ignored: ${outside.join(", ")}`);
  const collected = collectedRaw.filter((c) => productComponentCodes.includes(c));
  const mask = normalizeMask(collected, componentCodes);
  const fullMask = normalizeMask(productComponentCodes, componentCodes);

  const rules = bundle.adjustmentRules;
  const flatFeeRule = rules.find((r) => r.ruleType === "FLAT_FEE");
  const lowVolumeRule = rules.find((r) => r.ruleType === "LOW_VOLUME");
  const contaminationRule = rules.find((r) => r.ruleType === "CONTAMINATION");

  let effectiveLabel = product.name;
  let collectionPrice = 0;
  let storagePrice = 0;
  let storageSource: Record<string, number> | null = null;

  if (mask === "") {
    // nothing collected → flat fee only
    const fee = n(flatFeeRule?.amount);
    lineItems.push({
      kind: "flat_fee",
      label: "Flat fee — failed collection",
      amount: fee,
      currency,
      reason: flatFeeRule
        ? `No component was collected — flat fee per price list ${priceList.name}.`
        : `No FLAT_FEE rule configured for ${priceList.name}; fee = 0.`,
    });
    if (!flatFeeRule) warnings.push("Missing FLAT_FEE rule in price list.");
    effectiveLabel = "FLAT FEE";
  } else {
    // find matrix rule (also covers the complete case — matrix includes the full-product row)
    const rule = bundle.incompleteRules.find(
      (r) => r.orderedProductId === product.id && r.collectedMask === mask,
    );
    if (rule) {
      effectiveLabel = rule.resultLabel;
      collectionPrice = n(rule.collectionPrice);
      storageSource = rule.storagePrices ?? null;
      lineItems.push({
        kind: "collection",
        label: `Collection — ${rule.resultLabel}`,
        amount: collectionPrice,
        currency,
        reason: mask === fullMask
          ? `Complete collection of ${product.name}.`
          : `Incomplete collection (${mask} of ${fullMask}) — matrix row "${rule.resultLabel}"${rule.isOverride ? " (manual override" + (rule.note ? `: ${rule.note}` : "") + ")" : ""}.`,
      });
    } else {
      // fallback: sum standalone component prices
      warnings.push(`No matrix row for ${product.code} / ${mask} — price composed from standalone component prices.`);
      for (const code of mask.split("+")) {
        const comp = bundle.components.find((c) => c.code === code)!;
        const cp = bundle.collectionPrices.find((p) => p.componentId === comp.id);
        if (!cp) { warnings.push(`Missing standalone collection price for component ${code}.`); continue; }
        lineItems.push({
          kind: "collection",
          label: `Collection — ${comp.name}`,
          amount: n(cp.price),
          currency,
          reason: `Standalone component price (no matrix row found).`,
        });
        collectionPrice += n(cp.price);
      }
      effectiveLabel = mask;
    }

    // contamination: 100% discount from collection fee of the contaminated component(s)
    for (const code of input.contaminated ?? []) {
      if (!collected.includes(code)) { warnings.push(`Contaminated component ${code} was not among collected — ignored.`); continue; }
      const comp = bundle.components.find((c) => c.code === code);
      const cp = comp ? bundle.collectionPrices.find((p) => p.componentId === comp.id) : undefined;
      const pct = contaminationRule ? n(contaminationRule.pct) : 100;
      const base = n(cp?.price);
      const discount = round2(-base * pct / 100);
      lineItems.push({
        kind: "discount",
        label: `Contamination — ${code}`,
        amount: discount,
        currency,
        reason: `CONTAMINATION rule: ${pct}% discount from collection fee of contaminated component ${code} (base ${base} ${currency}).`,
      });
      if (!cp) warnings.push(`No standalone collection price for contaminated component ${code} — discount computed as 0.`);
    }

    // low volume (<20ml) fixed discount — only if the rule's target blood
    // component(s) were actually collected (workbook: "collection of blood
    // (CB+PB) <20ml" / "collection CB <20ml" — component-conditional)
    if (input.lowVolume) {
      const appliesToCodes = lowVolumeRule?.appliesTo ? lowVolumeRule.appliesTo.split("+") : null;
      const applicable = appliesToCodes ? appliesToCodes.some((c) => collected.includes(c)) : true;
      if (lowVolumeRule && !appliesToCodes) warnings.push("LOW_VOLUME rule has no appliesTo component condition — applied unconditionally.");
      if (!applicable) {
        warnings.push(`LOW_VOLUME requested but none of the rule's target components (${lowVolumeRule!.appliesTo}) were collected — discount not applied.`);
      } else {
        const amt = n(lowVolumeRule?.amount);
        lineItems.push({
          kind: "discount",
          label: "Low volume (<20 ml)",
          amount: -amt,
          currency,
          reason: lowVolumeRule
            ? `LOW_VOLUME rule: fixed discount ${amt} ${currency} for blood volume under 20 ml (applies to ${lowVolumeRule.appliesTo ?? "any component"}).`
            : "No LOW_VOLUME rule configured; discount = 0.",
        });
        if (!lowVolumeRule) warnings.push("Missing LOW_VOLUME rule in price list.");
      }
    }

    // --- storage: always by REALLY stored components (contamination does not affect storage) ---
    const storedMask = normalizeMask(
      collected.filter((c) => !(input.contaminated ?? []).includes(c)),
      componentCodes,
    );
    let storageBase = 0;
    let storageReason = "";
    if (storageSource && storageSource[String(input.storageYears)] !== undefined && storedMask === mask) {
      storageBase = n(storageSource[String(input.storageYears)]);
      storageReason = `Matrix row "${effectiveLabel}" storage price for ${input.storageYears} year(s); stored components: ${storedMask || "none"}.`;
    } else if (storedMask === "") {
      storageBase = 0;
      storageReason = "No component is actually stored — storage fee is 0.";
    } else {
      // compose from matrix row of stored mask, else standalone component storage prices
      const storedRule = bundle.incompleteRules.find(
        (r) => r.orderedProductId === product.id && r.collectedMask === storedMask,
      );
      if (storedRule && storedRule.storagePrices && storedRule.storagePrices[String(input.storageYears)] !== undefined) {
        storageBase = n(storedRule.storagePrices[String(input.storageYears)]);
        storageReason = `Storage by really stored components (${storedMask}) via matrix row "${storedRule.resultLabel}" for ${input.storageYears} year(s).`;
      } else {
        for (const code of storedMask ? storedMask.split("+") : []) {
          const comp = bundle.components.find((c) => c.code === code)!;
          const sp = bundle.storagePrices.find((p) => p.componentId === comp.id && p.years === 1);
          if (!sp) { warnings.push(`Missing 1-year storage price for component ${code}.`); continue; }
          storageBase += n(sp.price) * input.storageYears;
        }
        const disc = bundle.storageDiscounts.find((d) => d.years === input.storageYears);
        if (disc) storageBase = storageBase * (1 - n(disc.discountPct) / 100);
        storageBase = round2(storageBase);
        storageReason = `Composed from standalone component yearly storage prices × ${input.storageYears}y${storageSource ? "" : " (no matrix storage data)"}, prepay discount applied if configured.`;
        warnings.push(`Storage for ${storedMask}/${input.storageYears}y composed from component prices — verify against price list.`);
      }
    }
    storagePrice = storageBase;
    lineItems.push({
      kind: "storage",
      label: `Storage — ${input.storageYears} year(s)`,
      amount: storagePrice,
      currency,
      reason: storageReason,
    });
  }

  // installment surcharge (applies to collection portion)
  const installments = input.installments ?? 1;
  const plan = bundle.installmentPlans.find((p) => p.installments === installments);
  if (installments > 1) {
    if (!plan) warnings.push(`Installment plan ${installments}× is not configured for ${priceList.countryCode}.`);
    const pct = n(plan?.surchargePct);
    if (pct !== 0) {
      const surcharge = round2(collectionPrice * pct / 100);
      lineItems.push({
        kind: "surcharge",
        label: `Installments ${installments}× surcharge`,
        amount: surcharge,
        currency,
        reason: `Installment plan ${installments}× carries a ${pct}% surcharge on the collection price.`,
      });
    }
  }

  const totalCollection = round2(lineItems.filter((l) => ["collection", "discount", "surcharge", "flat_fee"].includes(l.kind)).reduce((s, l) => s + l.amount, 0));
  const totalStorage = round2(lineItems.filter((l) => l.kind === "storage").reduce((s, l) => s + l.amount, 0));
  const total = round2(totalCollection + totalStorage);
  const fx = n(priceList.fxRateToEur);
  const totalEur = fx > 0 ? round2(total / fx) : null;

  return {
    priceListId: priceList.id,
    countryCode: priceList.countryCode,
    currency,
    orderedProduct: product.code,
    effectiveProduct: effectiveLabel,
    collectedMask: mask,
    lineItems,
    totalCollection,
    totalStorage,
    total,
    totalEur,
    warnings,
  };
}
