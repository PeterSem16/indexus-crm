import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusListBackgroundDiagnostics } from "@/components/status-list-background-diagnostics";
import { StatusListWorkflowEditor } from "@/components/status-list-workflow-editor";
import { StatusListConfirmProvider } from "@/components/status-list-confirm";
import "@/index.css";
import "@/components/status-list-workspace.css";

const params = new URLSearchParams(location.search);
const locale = params.get("locale") || "sk";
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}><StatusListConfirmProvider locale={locale}>
    <main style={{ maxWidth: 1100, padding: 20 }}>
      <StatusListBackgroundDiagnostics campaignId="fixture" locale={locale} groupId={params.get("groupId") || undefined}/>
      <StatusListWorkflowEditor campaignId="fixture" locale={locale} showBackgroundSources={false}/>
    </main>
  </StatusListConfirmProvider></QueryClientProvider>,
);
