import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "../src/i18n/I18nProvider";
import MissionFunnelReport from "../src/components/campaigns/MissionFunnelReport";
import "../src/index.css";

// Isolated development component harness, not a login bypass or production route.
const params = new URLSearchParams(location.search);
localStorage.setItem("indexus-language", params.get("locale") || "en");
if (params.has("dark")) document.documentElement.classList.add("dark");
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}><I18nProvider>
    <main className="min-h-screen bg-background p-4 text-foreground md:p-6">
      <MissionFunnelReport campaignId="fixture-mission" />
    </main>
  </I18nProvider></QueryClientProvider>,
);
