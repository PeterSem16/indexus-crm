import { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { AuthProvider } from "@/contexts/auth-context";
import { I18nProvider } from "@/i18n";
import { RuleEditor } from "@/pages/automations";
import "@/index.css";

const catalog = {
  modules: [{ value: "communication", label: "Communication" }],
  eventTypes: [{ value: "email.received", label: "Email received", availableIn: ["communication"], changeSnapshot: false }],
  actionTypes: [{ value: "forward_message", label: "Forward email / SMS", availableIn: ["communication"], configSchema: {} }],
  operators: [], fields: { communication: [] }, fieldsByEvent: {}, recipients: [],
  recipientTemplatesByEvent: {}, countries: [{ value: "SK", label: "Slovakia" }],
};
const config = { forwardActionVersion: 1, destination: "back_office", mode: "whole", selection: "all", taskGroupId: "back-office" };
const initialDraft = {
  name: "Sender matching regression", description: "", module: "communication",
  countryCode: "SK", countryCodes: ["SK"], enabled: true,
  trigger: { type: "event", entityType: "communication", eventType: "email.received",
    ...(new URLSearchParams(location.search).has("else") ? { noMatchActions: [{ type: "forward_message", config }] } : {}) },
  conditions: null, actions: [{ type: "forward_message", config }], rateLimitPerHour: null,
};
function Fixture() {
  const [saved, setSaved] = useState<unknown>(null);
  return <>
    <RuleEditor open rule={null} initialDraft={initialDraft} catalog={catalog}
      users={[]} taskGroups={[{ id: "back-office", name: "Back Office", isBackOffice: true }]}
      roles={[]} rules={[]} saving={false} onClose={() => {}}
      onSave={setSaved} />
    <pre data-testid="saved-rule">{JSON.stringify(saved)}</pre>
  </>;
}
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}><AuthProvider><I18nProvider><Fixture /></I18nProvider></AuthProvider></QueryClientProvider>,
);
