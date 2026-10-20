import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusListWorkflowDiagnostics } from "@/components/status-list-workflow-diagnostics";
import { MEDICAL_PARTNER_AUDIT_CAMPAIGN } from "@shared/status-list-transition-audit";
import "@/index.css";
import "@/components/status-list-workspace.css";

if (!import.meta.env.DEV) throw new Error("Development-only test fixture");
const locale = new URLSearchParams(location.search).get("locale") || "sk";
if (new URLSearchParams(location.search).has("dark")) document.documentElement.classList.add("dark");
const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <main className="slw" style={{ padding: 20 }}>
      <StatusListWorkflowDiagnostics campaignId={MEDICAL_PARTNER_AUDIT_CAMPAIGN} locale={locale}/>
    </main>
  </QueryClientProvider>,
);
