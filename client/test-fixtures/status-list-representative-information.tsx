import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../src/lib/queryClient";
import { I18nProvider } from "../src/i18n/I18nProvider";
import { StatusListBackgroundSourcePanel } from "../src/components/status-list-background-source-panel";
import { StatusListRepresentativeInformationPanel } from "../src/components/status-list-representative-information";
import { StatusListHelp } from "../src/components/status-list-help";
import { useStatusListWorkflowContact } from "../src/hooks/use-status-list-workflow-contact";
import { StatusListConfirmProvider } from "../src/components/status-list-confirm";
import { useStatusListRepresentativeChecks } from "../src/hooks/use-status-list-representative-checks";
import { useStatusListActionRecap } from "../src/components/use-status-list-action-recap";
import "../src/index.css";

function Fixture() {
  const params=new URLSearchParams(location.search);
  const [contactId,setContactId] = useState(params.get("contact") || "assigned");
  const locale = params.get("locale") || "sk";
  const [active,setActive]=useState(false);
  const runtime=params.has("runtime");
  const query = useStatusListWorkflowContact("mission", contactId);
  const recap=useStatusListActionRecap({campaignId:"mission",contactId,locale,items:[],mode:params.get("mode")==="batch"?"batch":"immediate"});
  const checks=useStatusListRepresentativeChecks({campaignId:"mission",contactId,data:query.data,pulseActive:active,
    enabled:runtime,locale,review:recap.confirmPrepared});
  return <main className="mx-auto max-w-3xl p-3">
    {params.has("dismissal") && <button data-testid="fixture-switch-record" onClick={()=>setContactId(id=>id==="assigned"?"unassigned":"assigned")}>Switch record</button>}
    {runtime && <button data-testid="fixture-toggle-status-list" onClick={()=>setActive(value=>!value)}>Toggle Status List</button>}
    <StatusListRepresentativeInformationPanel scopeKey={`mission:${contactId}`} locale={locale} information={runtime?checks.information:query.data?.representativeInformation || []}
      onReview={runtime?checks.onReview:undefined} busy={checks.busy}/>
    {recap.dialog}
    <StatusListHelp locale={locale} section="answerSources"/>
    <StatusListBackgroundSourcePanel campaignId="mission" locale={locale} hideOptionSources/>
  </main>;
}
const locale = new URLSearchParams(location.search).get("locale") || "sk";
const country = ({ sk: "SK", cs: "CZ", hu: "HU", ro: "RO", it: "IT", de: "DE", en: "GB" } as Record<string, string>)[locale];
queryClient.setDefaultOptions({ queries: { retry: false } });
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={queryClient}>
  <I18nProvider userCountries={[country]}><StatusListConfirmProvider locale={locale}><Fixture/></StatusListConfirmProvider></I18nProvider>
</QueryClientProvider>);
