import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "../src/i18n";
import BulkAssignPage from "../src/pages/bulk-assign";
import "../src/index.css";

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}><I18nProvider>
    <div className="p-6"><BulkAssignPage /></div>
  </I18nProvider></QueryClientProvider>,
);