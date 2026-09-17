import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sidebarSource = readFileSync(new URL("./app-sidebar.tsx", import.meta.url), "utf8");
const networkSource = readFileSync(new URL("../pages/medical-partner-network.tsx", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const updatesSource = readFileSync(new URL("../pages/collaborator-updates.tsx", import.meta.url), "utf8");

describe("Healthcare Network navigation structure", () => {
  it("keeps Hospitals as the first item inside Healthcare Network and removes moved pages", () => {
    const subItemsStart = sidebarSource.indexOf("const mpnSubItems = [");
    const hospitalsItem = sidebarSource.indexOf('url: "/hospitals"', subItemsStart);
    const myClinicsItem = sidebarSource.indexOf('url: "/my-clinics"', subItemsStart);
    const networkItem = sidebarSource.indexOf('url: "/medical-partner-network"', subItemsStart);
    expect(hospitalsItem).toBeGreaterThan(subItemsStart);
    expect(hospitalsItem).toBeLessThan(myClinicsItem);
    expect(hospitalsItem).toBeLessThan(networkItem);
    expect(sidebarSource).not.toContain('href="/hospitals"');
    expect(sidebarSource).not.toContain('url: "/collaborator-updates"');
    expect(sidebarSource).not.toContain('url: "/bulk-assign"');
  });

  it("exposes moved pages as permission-aware Healthcare Network settings tabs", () => {
    expect(networkSource).toContain('value="data-updates"');
    expect(networkSource).toContain('value="bulk-assign"');
    expect(networkSource).toContain('user?.role === "admin" && canAccessModule("collaborators")');
    expect(networkSource).toContain('user?.role === "admin" || user?.role === "manager"');
    expect(networkSource).toContain("<CollaboratorUpdatesPage embedded />");
    expect(networkSource).toContain("<BulkAssignPage embedded />");
  });

  it("activates the Settings tab for a supported nested-tab deep link", () => {
    expect(networkSource).toContain('get("mpnSettingsTab")');
    expect(networkSource).toContain('return nested === "categories" || nested === "data-updates" || nested === "bulk-assign" ? "settings" : "network";');
    expect(networkSource).toContain("window.history.pushState");
    expect(networkSource).toContain('params.set("mpnSettingsTab", "categories")');
  });

  it("redirects legacy pages to canonical settings URLs", () => {
    expect(appSource).toContain('<LegacyMedicalPartnerSettingsRedirect tab="data-updates" />');
    expect(appSource).toContain('<LegacyMedicalPartnerSettingsRedirect tab="bulk-assign" />');
  });

  it("preserves canonical settings and unrelated query parameters after OAuth cleanup", () => {
    expect(updatesSource).toContain('["sender_connected", "sender_error", "campaign"].forEach((key) => p.delete(key));');
    expect(updatesSource).toContain('`${window.location.pathname}${query ? `?${query}` : ""}`');
  });
});