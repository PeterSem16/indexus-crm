import { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { AuthProvider } from "@/contexts/auth-context";
import { I18nProvider } from "@/i18n";
import { AutomationCreateTaskAction } from "@/components/automation-create-task-action";
import { AutomationNotifyUserAction } from "@/components/automation-notify-user-action";
import { AutomationSendEmailAction } from "@/components/automation-send-email-action";
import { AutomationSendSmsAction } from "@/components/automation-send-sms-action";
import { ANALYSIS_FIELDS } from "@shared/automation-analysis";
import { COMMUNICATION_SOURCE_FIELDS } from "@shared/automation-communication-context";
import { ACTIVITY_TEMPLATE_FIELDS } from "@shared/automation-activity-context";
import "@/index.css";
import "@/components/tasks/task-modal-modern.css";

function Fixture() {
  const [type, setType] = useState("email");
  const [source, setSource] = useState("communication");
  const [config, setConfig] = useState<Record<string, any>>({ emailActionVersion: 2, userId: "fixture-user", title: "", message: "", body: "", smsActionVersion: 2, smsType: "sms" });
  const availableVariables = [...(source === "communication" ? [...ANALYSIS_FIELDS, ...COMMUNICATION_SOURCE_FIELDS] : []), ...ACTIVITY_TEMPLATE_FIELDS].map(({ value, label }) => ({ value, label }));
  const common = { config, onChange: setConfig, availableVariables, sourceModule: source, testId: "catalog",
    users: [{ id: "fixture-user", label: "Fixture", fullName: "Fixture", email: "fixture@example.test" }], groups: [], roles: [], recipientTemplates: [] };
  return <main className="mx-auto max-w-5xl space-y-5 p-5">
    <nav className="flex gap-3">{["email", "task", "notification", "sms"].map(item => <button key={item} data-testid={`type-${item}`} onClick={() => { setType(item); setConfig({ emailActionVersion: 2, smsActionVersion: 2, userId: "fixture-user" }); }}>{item}</button>)}</nav>
    <nav className="flex gap-3">{["communication", "task", "call", "clinic"].map(item => <button key={item} data-testid={`source-${item}`} onClick={() => setSource(item)}>{item}</button>)}</nav>
    {type === "email" && <AutomationSendEmailAction {...common} countryCodes={["SK"]} />}
    {type === "task" && <AutomationCreateTaskAction {...common} />}
    {type === "notification" && <AutomationNotifyUserAction {...common} index={0} recipientSelector={<span>Fixture recipient</span>} />}
    {type === "sms" && <AutomationSendSmsAction {...common} countryCodes={["SK"]} />}
    <pre data-testid="saved-config">{JSON.stringify(config)}</pre>
  </main>;
}
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}><AuthProvider><I18nProvider><Fixture /></I18nProvider></AuthProvider></QueryClientProvider>,
);
