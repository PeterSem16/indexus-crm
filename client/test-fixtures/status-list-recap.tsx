import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { useStatusListActionRecap } from "@/components/use-status-list-action-recap";
import { ReschedulePopover } from "@/pages/agent-workspace";
import { StatusListQuickOptionIcon } from "@/components/status-list-quick-option-icons";
import { apiRequest } from "@/lib/queryClient";
import { translations } from "@/i18n/translations";
import { StatusListWorkspace, type WorkspaceItem } from "@/components/status-list-workspace";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@/i18n";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StatusListConfirmProvider } from "@/components/status-list-confirm";
import "@/index.css";

const params = new URLSearchParams(location.search);
if (!import.meta.env.DEV) throw new Error("Development-only test fixture");
const locale = (params.get("locale") || "sk") as keyof typeof translations;
const callbackDate = params.get("date") || "2027-06-18T14:30";
const mode = params.get("mode") === "batch" ? "batch" : "immediate";
const items = [{ id: "step", previewActions: true }];

function Fixture() {
  const [contactId, setContactId] = useState("contact-a");
  const [result, setResult] = useState("idle");
  const recap = useStatusListActionRecap({ campaignId: "fixture-mission", contactId, locale, items, mode });
  const review = async () => {
    const reviewedContact = contactId;
    const draft = {callbackDate,callbackNote:"Poznámka ku callbacku"};
    setResult("reviewing");
    const accepted = await recap.confirm([{ kind: "item", id: "step", value: true }], true,
      mode === "immediate" && !params.has("step") ? ["callback"] : [],
      params.has("server-details") ? {} : { callback: draft },
      params.has("step") ? {actionId:"callback",onChange:detail=>Object.assign(draft,detail)} : undefined);
    if (!accepted) { setResult("cancelled"); return; }
    // Deliberately intercepted by Playwright. No real contact or sending route.
    await apiRequest("PUT", `/api/test-fixtures/${reviewedContact}/commit`, { callbackDate:draft.callbackDate,callbackNote:draft.callbackNote, mode });
    setResult("confirmed");
  };
  useEffect(() => {
    document.documentElement.classList.toggle("dark", params.has("dark"));
    if (params.has("auto")) void review();
  }, []);
  return <main style={{ padding: 24 }}>
    <button data-testid="review" onClick={() => void review()}>Review</button>
    <button id="change-contact" onClick={() => setContactId("contact-b")}>Change contact</button>
    <output data-testid="result">{result}</output>
    <div data-testid="legacy-question-icon"><StatusListQuickOptionIcon name="Clock" color="indigo" /></div>
    <div data-testid="custom-subquestion-icon"><StatusListQuickOptionIcon name="Baby" color="#4f8178" /></div>
    {recap.dialog}
  </main>;
}

function RescheduleFixture() {
  const [saved, setSaved] = useState<unknown>(null);
  const [invalid, setInvalid] = useState(false);
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 3);
  tomorrow.setUTCHours(10, 0, 0, 0);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", params.has("dark"));
    if (params.has("auto")) document.querySelector<HTMLButtonElement>('[data-testid="btn-scheduled-reschedule-scheduled"]')?.click();
  }, []);
  return <main style={{ padding: 24, maxWidth: 480, margin: "0 auto", textAlign: "right" }}>
    <ReschedulePopover
      item={{ id: "scheduled", campaignId: "fixture-mission", campaignContactId: "contact-a",
        scheduledAt: tomorrow.toISOString(), contactName: "Testovací kontakt", notes: "Poznámka ku callbacku" } as any}
      t={translations[locale]} locale={locale}
      onInvalid={() => setInvalid(true)}
      onReschedule={(id, campaignId, date) => setSaved({ id, campaignId, date })}
    />
    <output data-testid="rescheduled">{JSON.stringify(saved)}</output>
    <output data-testid="invalid">{String(invalid)}</output>
  </main>;
}

const outlineItems:WorkspaceItem[]=[
  {id:"visible-step",label:"Visible step",stepId:"1",parentId:null,sortOrder:0,required:false,confirmationType:"checkbox",automations:[],questions:[]},
  {id:"hidden-step",label:"Hidden step",stepId:"2",parentId:null,sortOrder:1,required:false,confirmationType:"checkbox",isHidden:true,automations:[],
    questions:[{id:"hidden-question",questionText:"Hidden question",automations:[]}]},
];
function OutlineFixture() {
  const [selectedId,setSelectedId]=useState("visible-step");
  const [client]=useState(()=>new QueryClient({defaultOptions:{queries:{retry:false}}}));
  useEffect(()=>{document.documentElement.classList.toggle("dark",params.has("dark"));},[]);
  return <QueryClientProvider client={client}><StatusListWorkspace campaignId="outline-fixture" locale="en" items={outlineItems}
    selectedId={selectedId} onSelect={setSelectedId} definition={<div>Configuration</div>} tools={null} coverage={null}/></QueryClientProvider>;
}
createRoot(document.getElementById("root")!).render(
  <I18nProvider userCountries={["SK"]}><TooltipProvider><StatusListConfirmProvider>
    {params.has("outline") ? <OutlineFixture /> : params.has("reschedule") ? <RescheduleFixture /> : <Fixture />}
  </StatusListConfirmProvider></TooltipProvider></I18nProvider>,
);
