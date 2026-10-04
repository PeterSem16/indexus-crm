import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "../src/i18n/I18nProvider";
import { AuthProvider } from "../src/contexts/auth-context";
import { ClinicFormSheet } from "../src/components/clinic-form-wizard";
import { TooltipProvider } from "../src/components/ui/tooltip";
import "../src/index.css";

// Development-only native component harness, not an application route or auth bypass.
const params = new URLSearchParams(location.search);
const client = new QueryClient({ defaultOptions: { queries: { retry: false, queryFn: async ({ queryKey }) => {
  const response = await fetch(String(queryKey[0]), { credentials: "include" });
  if (!response.ok) throw Error("Fixture API failed");
  return response.json();
} } } });
const user = { id: "fixture-agent", role: "admin", assignedCountries: ["SK"] };
client.setQueryData(["/api/auth/me"], { user });
const clinic = { id: "fixture-clinic", name: "Agreement test clinic", countryCode: "SK", isActive: true };
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}><AuthProvider><I18nProvider><TooltipProvider>
    <div data-pulse-fullscreen={params.has("readonly") ? "true" : undefined} style={{ height: "100vh" }}>
      <ClinicFormSheet open onOpenChange={() => {}} onSuccess={() => {}}
        initialData={params.has("unsaved") ? null : clinic as any}
        readOnly={params.has("readonly")} mode={params.has("sheet") || params.has("unsaved") ? "sheet" : "inline"} />
    </div>
  </TooltipProvider></I18nProvider></AuthProvider></QueryClientProvider>,
);