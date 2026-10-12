import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { I18nProvider } from "@/i18n";
import { SystemMailboxCheckPanel } from "@/components/system-mailbox-check-panel";
import "@/index.css";

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <I18nProvider>
      <main className="mx-auto max-w-xl p-4">
        <SystemMailboxCheckPanel countryCode="SK" connected connectionKey="fixture" />
      </main>
    </I18nProvider>
  </QueryClientProvider>
);
