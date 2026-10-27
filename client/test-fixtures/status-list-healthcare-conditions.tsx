/// <reference types="vite/client" />
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { StatusListWorkflowDialog } from "../src/components/status-list-workflow-dialog";
import { StatusListServiceActionConditions } from "../src/components/status-list-service-action-conditions";
import { healthcareActionConditionFields } from "../src/components/status-list-healthcare-condition-fields";
import { statusListActionDraft, statusListActionPayload, type StatusListActionDraft } from "../src/lib/status-list-action-draft";
import { statusListWorkflowSchema, type StatusListWorkflow, type WorkflowCatalogItem } from "../../shared/status-list-workflow";
import "../src/index.css";

if (!import.meta.env.DEV) throw Error("Development-only fixture");
const locale = new URLSearchParams(location.search).get("locale") || "sk";
const catalog:WorkflowCatalogItem[] = [
  {id:"unreachable",kind:"item",label:"Unreachable",fieldType:"checkbox",hidden:true,writable:false,backgroundSource:"healthcare_reachability"},
  {id:"target",kind:"item",label:"Follow-up",fieldType:"checkbox",hidden:false,writable:true},
];
function Fixture(){
  const [open,setOpen]=useState(true);
  const [rule,setRule]=useState<StatusListWorkflow>({
    name:"Five failures",enabled:true,source:{kind:"item",id:"unreachable"},sourceValue:true,trigger:"background_transition",logic:"and",
    conditions:[{field:"healthcare.state",op:"equals",value:"unreachable"},{field:"healthcare.failed_attempts",op:"gte",value:"5"}],
    thenActions:[{type:"confirm_step",target:{kind:"item",id:"target"}}],elseActions:[],
  });
  const [draft,setDraft]=useState<StatusListActionDraft>(()=>({...statusListActionDraft(undefined,"send_email"),conditionMode:"compound",
    conditionRules:[{field:"healthcare.state",op:"eq",value:"unreachable"},{field:"healthcare.failed_attempts",op:"gte",value:"5"}]}));
  const [saved,setSaved]=useState("");
  return <main className="mx-auto max-w-4xl p-4">
    <StatusListWorkflowDialog open={open} draft={rule} catalog={catalog} campaignId="mission" locale={locale}
      editing pending={false} validation="" onUpdate={patch=>setRule(current=>({...current,...patch}))} onClose={()=>setOpen(false)}
      onSave={()=>{setSaved(JSON.stringify(statusListWorkflowSchema.parse(rule)));setOpen(false);}}/>
    <output data-testid="saved-workflow">{saved}</output>
    <StatusListServiceActionConditions draft={draft} setDraft={setDraft} locale={locale} conditionFields={healthcareActionConditionFields}
      countries={[]} hospitals={[]} clinics={[]}/>
    <output data-testid="service-condition-payload">{String(statusListActionPayload(draft).conditionJson || "")}</output>
  </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
