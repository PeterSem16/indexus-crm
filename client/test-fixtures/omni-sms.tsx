import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { AuthProvider } from "@/contexts/auth-context";
import { I18nProvider } from "@/i18n";
import { OmniSmsWorkspace } from "@/components/nexus/omni-sms/OmniSmsWorkspace";
import "@/index.css";

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <I18nProvider>
        <main className="flex h-[100dvh] min-h-0 p-3">
          <OmniSmsWorkspace />
        </main>
      </I18nProvider>
    </AuthProvider>
  </QueryClientProvider>,
);
