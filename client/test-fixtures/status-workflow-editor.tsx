import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { StatusListWorkflowEditor } from "@/components/status-list-workflow-editor";
import { StatusListConfirmProvider } from "@/components/status-list-confirm";
import "@/index.css";

if (!import.meta.env.DEV) throw new Error("Development-only test fixture");
const locale = new URLSearchParams(location.search).get("locale") || "sk";
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <StatusListConfirmProvider><div style={{ padding: 30 }}><StatusListWorkflowEditor campaignId="workflow-test" locale={locale}/></div></StatusListConfirmProvider>
  </QueryClientProvider>,
);
