import {createRoot} from "react-dom/client";
import {useState} from "react";
import {StatusListWorkspace} from "@/components/status-list-workspace";
import {StatusListQuestionStudio} from "@/components/status-list-question-studio";
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
const studioNavigation=new URLSearchParams(location.search).has("subquestion") ?
  {itemId:"group",questionId:"q1",nonce:1} : undefined;
const setup=optionGroup ? <StatusListOptionSourcePanel campaignId="mission" locale={locale} targetGroupId={target}/> :
  <StatusListBackgroundSourcePanel campaignId="mission" locale={locale}/>;
function ManagementWorkspace() {
  const [selected,setSelected]=useState("group");
  const [creating,setCreating]=useState(false);
  const items=[{id:"group",label:"Provider reachability",stepId:"provider",parentId:null,sortOrder:0,confirmationType:"info",
    itemType:"step",isHidden:true,required:false,questions:studioNavigation ?
      [{id:"q1",questionText:"Provider question",fieldType:"text",automations:[]}] : [],automations:[]}];
  return <StatusListWorkspace campaignId="mission" locale={locale} items={items} selectedId={selected}
    onSelect={setSelected} navigation={studioNavigation} onAddStep={()=>setCreating(true)} addStepLabel="Create"
    tools={null} coverage={null} definition={(id,questionId,controls)=>new URLSearchParams(location.search).has("studio") ?
      <StatusListQuestionStudio campaignId="mission" locale={locale} item={items.find(item=>item.id===id)}
        questionId={questionId} allItems={items} canonicalOptions={[]} resolvedPhase={null}
        onSelectItem={setSelected} onSelectQuestion={()=>{}} renderActions={()=>null} renderChildren={()=>null}
        renderSource={controls.source} onDirtyChange={controls.onDirtyChange} onDeleted={()=>{}}/> :
      <div data-testid="management-content-editor" data-group={id}
        data-creating={creating}>{creating?"Creating custom question":id}</div>}/>;
}
if(new URLSearchParams(location.search).has("dark"))document.documentElement.classList.add("dark");
queryClient.setDefaultOptions({queries:{retry:false}});
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={queryClient}>
  <I18nProvider userCountries={[( {sk:"SK",cs:"CZ",hu:"HU",ro:"RO",it:"IT",de:"DE",en:"GB"} as Record<string,string>)[locale]]}>
    <TooltipProvider><StatusListConfirmProvider locale={locale}>
      <main className="mx-auto max-w-3xl space-y-4 p-3">
        {new URLSearchParams(location.search).has("workspace") ? <ManagementWorkspace/> : nested ? <form data-testid="outer-editor-form" onSubmit={event=>{
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
