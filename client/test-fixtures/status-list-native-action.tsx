import { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@/i18n";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { StatusListServiceActionEditor } from "@/components/status-list-service-action-editor";
import type { SavedStatusListAction } from "@/lib/status-list-action-draft";
import "@/index.css";
import "@/components/tasks/task-modal-modern.css";
import "@/pages/automations-workspace.css";
import "@/components/automation-block-editor.css";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const actionType = new URLSearchParams(location.search).get("action") || "notify_role";
const savedActions: Record<string, SavedStatusListAction> = {
  notify_role: {
    id: "legacy-notify", actionType: "notify_role", serviceActionConfig: null, sortOrder: 0,
    emailRecipients: [], targetRole: "role:supervisor", taskDescription: "Manager notice", conditionField: null, conditionOperator: null, conditionValue: null, conditionJson: null,
  },
  send_email_group: {
    id: "native-email", actionType: "send_email_group", serviceActionConfig: {
      emailActionVersion: 2, senderMode: "personal", to: "ops@example.invalid", subject: "Campaign update",
      body: "<p>Original content</p>", toTargets: [], ccTargets: [], bccTargets: [],
    }, sortOrder: 0,
  },
  send_sms: {
    id: "native-sms", actionType: "send_sms", serviceActionConfig: {
      smsActionVersion: 2, to: ["+421900123456"], text: "Reminder", provider: "default", kind: "transactional",
    }, sortOrder: 0,
  },
  assign_task: {
    id: "native-task", actionType: "assign_task", serviceActionConfig: {
      title: "Call the contact", description: "Confirm the registration", taskText: "Follow up with the contact.",
      recipients: [{ kind: "user", id: "manager-17" }], priority: "medium",
    }, sortOrder: 0,
  },
};
const action = savedActions[actionType] || savedActions.notify_role;
function Fixture() {
  const [saved, setSaved] = useState<unknown>(null);
  const [dirty, setDirty] = useState(false);
  return <>
    <Dialog open>
      <DialogContent className="task-modern-modal p-0" style={{ width: "min(1100px, calc(100vw - 1rem))", maxWidth: 1100, maxHeight: "95dvh", overflowY: "auto" }} data-testid="status-list-parent-modal">
        <StatusListServiceActionEditor
          campaignId="42" itemId="12" automation={action} initialActionType={action.actionType} initialStage="details"
          locale="en" sourceLabel="Campaign registration" presentation="inline"
          translate={key => key}
          actions={[
            { value: "assign_task", label: "Create task", help: "" },
            { value: "notify_role", label: "Notify user", help: "" },
            { value: "send_email_group", label: "Email a group", help: "" },
            { value: "notify_email", label: "Send email", help: "" },
            { value: "send_contact_email", label: "Email contact", help: "" },
            { value: "send_sms", label: "Send SMS", help: "" },
            { value: "set_callback", label: "Set callback", help: "" },
          ]}
          roleFallbacks={[]} countries={[{ value: "SK", label: "Slovakia" }]} deadlines={[]} priorities={[]} taskTemplates={[]}
          variables={[
            { token: "{{event.country}}", label: "Event country" },
            { token: "{{contact.email}}", label: "Contact email" },
            { token: "{{contact.name}}", label: "Contact name" },
            { token: "{{campaign.name}}", label: "Campaign name" },
            { token: "{{user.id}}", label: "Saving manager" },
            { token: "{{analysis.summary}}", label: "Unsupported analysis context" },
          ]}
          conditionFields={[]} onSaved={() => setSaved("saved")} onCancel={() => undefined} onDirtyChange={setDirty}
        />
      </DialogContent>
    </Dialog>
    <output data-testid="fixture-saved">{JSON.stringify(saved)}</output>
    <output data-testid="fixture-dirty">{String(dirty)}</output>
  </>;
}
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}><I18nProvider><Fixture /></I18nProvider></QueryClientProvider>,
);
