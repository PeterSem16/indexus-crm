import {createRoot} from "react-dom/client";
import {QueryClientProvider} from "@tanstack/react-query";
import {queryClient} from "@/lib/queryClient";
import {I18nProvider} from "@/i18n/I18nProvider";
import {TooltipProvider} from "@/components/ui/tooltip";
import {StatusListConfirmProvider} from "@/components/status-list-confirm";
import {StatusListBackgroundSourcePanel} from "@/components/status-list-background-source-panel";
import {StatusListOptionSourcePanel} from "@/components/status-list-option-source-panel";
import {StatusListAgentBackground} from "@/components/status-list-agent-background";
import {StatusListServiceActionEditor} from "@/components/status-list-service-action-editor";
import "../src/index.css";
const locale=new URLSearchParams(location.search).get("locale")||"sk";
const optionGroup=new URLSearchParams(location.search).has("option-group");
const nested=new URLSearchParams(location.search).has("nested");
const target=new URLSearchParams(location.search).get("target")||"group";
const setup=optionGroup ? <StatusListOptionSourcePanel campaignId="mission" locale={locale} targetGroupId={target}/> :
  <StatusListBackgroundSourcePanel campaignId="mission" locale={locale}/>;
if(new URLSearchParams(location.search).has("dark"))document.documentElement.classList.add("dark");
queryClient.setDefaultOptions({queries:{retry:false}});
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={queryClient}>
  <I18nProvider userCountries={[( {sk:"SK",cs:"CZ",hu:"HU",ro:"RO",it:"IT",de:"DE",en:"GB"} as Record<string,string>)[locale]]}>
    <TooltipProvider><StatusListConfirmProvider locale={locale}>
      <main className="mx-auto max-w-3xl space-y-4 p-3">
        {nested ? <form data-testid="outer-editor-form" onSubmit={event=>{
          event.preventDefault();document.documentElement.dataset.outerSubmits=String(Number(document.documentElement.dataset.outerSubmits||0)+1);
        }}>{setup}</form> : setup}
        <StatusListAgentBackground campaignId="mission" contactId="contact" locale={locale}/>
        <StatusListServiceActionEditor campaignId="mission" itemId="option-unreached" locale={locale}
          initialActionType="set_callback" sourceLabel="Unreached" translate={key=>key} presentation="inline"
          actions={[{value:"set_callback",label:"Callback",help:""}]} roleFallbacks={[]} countries={[]} deadlines={[]}
          priorities={[]} taskTemplates={[]} variables={[]} conditionFields={[]} onSaved={()=>{}} onCancel={()=>{}}/>
      </main>
    </StatusListConfirmProvider></TooltipProvider>
  </I18nProvider>
</QueryClientProvider>);
