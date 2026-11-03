import {createRoot} from "react-dom/client";
import {useEffect} from "react";
import {QueryClientProvider} from "@tanstack/react-query";
import {queryClient} from "@/lib/queryClient";
import {AuthProvider} from "@/contexts/auth-context";
import {I18nProvider} from "@/i18n";
import {MessageTemplatesTab} from "@/pages/configurator";
import "@/index.css";

function Fixture() {
  useEffect(()=>{
    if(new URLSearchParams(window.location.search).has("open")) {
      document.querySelector<HTMLButtonElement>('[data-testid="button-add-template"]')?.click();
    }
  },[]);
  return <MessageTemplatesTab />;
}

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <AuthProvider><I18nProvider><Fixture /></I18nProvider></AuthProvider>
  </QueryClientProvider>,
);
