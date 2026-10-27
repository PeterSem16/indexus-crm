import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient as client } from "@/lib/queryClient";
import { I18nProvider } from "@/i18n";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CampaignStatusListBuilder } from "@/components/campaign-status-list-builder";
import "@/index.css";

if (!import.meta.env.DEV) throw new Error("Development-only test fixture");
const parameters = new URLSearchParams(location.search);
if (parameters.has("dark")) document.documentElement.classList.add("dark");
const country = ({ en: "GB", sk: "SK", cs: "CZ", hu: "HU", ro: "RO", it: "IT", de: "DE" } as Record<string, string>)[parameters.get("locale") || "sk"];
const countries = [country || "SK"];
client.setDefaultOptions({ ...client.getDefaultOptions(), queries: { ...client.getDefaultOptions().queries, retry: false } });
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}><I18nProvider userCountries={countries}><TooltipProvider>
    <main className="min-h-screen bg-background p-3 text-foreground sm:p-6"><CampaignStatusListBuilder campaignId="11111111-1111-4111-8111-111111111111"/></main>
  </TooltipProvider></I18nProvider></QueryClientProvider>,
);
