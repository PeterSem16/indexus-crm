import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QUICK_OPTION_ICON_NAMES, StatusListQuickOptionIcon, StatusListQuickOptionIconPicker } from "../components/status-list-quick-option-icons";
import { insertCampaignStatusListItemSchema } from "../../../shared/schema";

(globalThis as any).React = React;
let checks = 0;
const check = (condition: unknown, message: string) => { assert.ok(condition, message); checks++; };
for (const name of QUICK_OPTION_ICON_NAMES) {
  const html = renderToStaticMarkup(<StatusListQuickOptionIcon name={name} className="h-4 w-4"/>);
  check(html.includes("<svg") && html.includes('aria-hidden="true"') && html.includes('stroke-width="1.9"'), `${name} renders a decorative matching Lucide icon`);
}
for (const name of [null, undefined, "", "FutureIcon", "__proto__", "constructor", "<script>alert(1)</script>"]) {
  check(renderToStaticMarkup(<StatusListQuickOptionIcon name={name}/>) === "", "Unknown or absent icons never render arbitrary content");
}
for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"]) {
  for (const value of [null, "PhoneCall", "FutureIcon"]) {
    let changed = false;
    const html = renderToStaticMarkup(<StatusListQuickOptionIconPicker locale={locale} value={value} onChange={() => { changed = true; }}/>);
    check(!changed && html.includes('data-testid="quick-option-icon-PhoneCall"'), "Every language preserves the draft while rendering the same curated icon catalog");
    check((html.match(/aria-pressed="true"/g) || []).length === (value === "FutureIcon" ? 0 : 1), "Picker exposes accurate pressed state, including an unknown saved value");
    check(!html.includes("undefined") && !html.includes("[object Object]"), "All picker languages have complete labels");
  }
}
const base = { campaignId: "synthetic", stepId: "OPT-1", label: "Synthetic", itemType: "option" };
check(insertCampaignStatusListItemSchema.safeParse({ ...base, icon: "PhoneCall" }).success, "Create schema persists a selected icon");
check(insertCampaignStatusListItemSchema.safeParse({ ...base, icon: null }).success && insertCampaignStatusListItemSchema.safeParse(base).success, "Old no-icon buttons remain compatible");
check(!insertCampaignStatusListItemSchema.safeParse({ ...base, icon: "x".repeat(81) }).success, "Icon identifiers are bounded");
console.log(`Quick option icons: ${checks} assertions passed`);
