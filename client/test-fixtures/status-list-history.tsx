import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { StatusListServiceActionConditions } from "@/components/status-list-service-action-conditions";
import { StatusListWorkflowDialog } from "@/components/status-list-workflow-dialog";
import { StatusListHelp } from "@/components/status-list-help";
import { statusListHistoryMetadata } from "@/components/status-list-history-copy";
import { statusListActionDraft, statusListActionPayload } from "@/lib/status-list-action-draft";
import type { StatusListWorkflow } from "@shared/status-list-workflow";
import "@/index.css";
import "@/components/status-list-service-action-editor.css";

function Fixture() {
  const locale = new URLSearchParams(location.search).get("locale") || "sk";
  const [draft, setDraft] = useState(() => statusListActionDraft());
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [rule, setRule] = useState<StatusListWorkflow>({
    name: "History rule", enabled: true, source: { kind: "item", id: "source" }, trigger: "agent_confirmation",
    logic: "and", conditions: [{ field: "history.outreach_attempted", op: "equals", value: true }],
    thenActions: [{ type: "confirm_step", target: { kind: "item", id: "target" } }], elseActions: [],
  });
  return <main style={{ padding: 20, maxWidth: 1000 }}>
    <StatusListHelp locale={locale}/>
    <button data-testid="workflow-open" onClick={() => setWorkflowOpen(true)}>Workflow</button>
    <div className="slsae"><StatusListServiceActionConditions draft={draft} setDraft={setDraft} locale={locale}
      conditionFields={statusListHistoryMetadata()} countries={[]} clinics={[]} hospitals={[]}/></div>
    <output data-testid="payload">{JSON.stringify(statusListActionPayload(draft))}</output>
    <output data-testid="workflow-payload">{JSON.stringify(rule)}</output>
    <StatusListWorkflowDialog open={workflowOpen} draft={rule} catalog={[
      { kind: "item", id: "source", label: "Source", fieldType: "checkbox", hidden: false, writable: true },
      { kind: "item", id: "target", label: "Target", fieldType: "checkbox", hidden: false, writable: true },
    ]} campaignId="mission-test" locale={locale} editing={false} pending={false} validation=""
      onUpdate={patch => setRule(previous => ({ ...previous, ...patch }))} onClose={() => setWorkflowOpen(false)} onSave={() => setWorkflowOpen(false)}/>
  </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
