import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/auth-context";
import { I18nProvider } from "@/i18n";
import { AutomationEligibilityDiagnostic } from "@/components/automation-eligibility-diagnostic";
import "@/index.css";

if (!import.meta.env.DEV) throw new Error("Development-only test fixture");
const country = new URLSearchParams(location.search).get("country") || "SK";
const countries = [country];
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}><AuthProvider>
    <I18nProvider selectedCountries={countries}>
      <main className="p-8"><AutomationEligibilityDiagnostic rules={[{
        id: "fixture-analysis", name: "Fixture analysis", module: "communication",
        trigger: { type: "event", eventType: "communication.received", analysis: { analyzeText: true } },
      } as any]} /></main>
    </I18nProvider>
  </AuthProvider></QueryClientProvider>,
);
