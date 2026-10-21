import React from "react";
import { createRoot } from "react-dom/client";
import { StatusListAgentPreview } from "../src/components/status-list-agent-preview";
import "../src/index.css";

// Synthetic data only. This fixture never loads or writes a real Mission/contact.
const items = [
  {
    id: "demo-contact", stepId: "DEMO-01", label: "Oslovenie ambulancie",
    description: "Overenie záujmu o spoluprácu", tab: "acquisition", required: true,
    confirmationType: "checkbox", questions: [
      { id: "demo-yes-no", questionText: "Podarilo sa kontaktovať zodpovednú osobu?", fieldType: "yesno", groupName: "Kontakt" },
      { id: "demo-question", questionText: "Záujem o informácie", fieldType: "checkbox", groupName: "Kontakt" },
    ],
    automations: [{ id: "demo-email", actionType: "send_email_group" }],
  },
  {
    id: "demo-next", stepId: "DEMO-02", label: "Doplnenie informácií",
    tab: "acquisition", confirmationType: "checkbox", questions: [],
  },
  {
    id: "demo-option", stepId: "DEMO-OPT", label: "Nevolať",
    itemType: "option", confirmationType: "option", color: "#b45309", icon: "Phone",
    questions: [],
  },
];

createRoot(document.getElementById("root")!).render(
  <main style={{ minHeight: "100dvh", padding: 12, background: "#eef0f4", display: "flex", justifyContent: "center" }}>
    <section style={{ width: "100%", maxWidth: 480, height: "min(740px, calc(100dvh - 24px))", display: "flex", overflow: "hidden", borderRadius: 12, border: "1px solid #d8dde5" }}>
      <StatusListAgentPreview items={items} locale="sk" statusListMode="batch" />
    </section>
  </main>,
);
