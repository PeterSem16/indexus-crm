import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "../src/i18n/I18nProvider";
import { AuthProvider } from "../src/contexts/auth-context";
import { CallProvider } from "../src/contexts/call-context";
import { CustomerInfoPanel } from "../src/pages/agent-workspace";
import "../src/index.css";
const params = new URLSearchParams(location.search);
const country = { sk: "SK", cs: "CZ", hu: "HU", ro: "RO", it: "IT", de: "DE" }[params.get("locale") || ""];
localStorage.setItem("locale", params.get("locale") || "en");
if (params.has("dark")) document.documentElement.classList.add("dark");
const history = [
  { id: "foreign", type: "disposition", campaignId: "fmo", campaignName: "FMO", date: "2026-10-29T07:55:00Z",
    action: "status_list_confirmation", metadata: { confirmed: false, itemLabel: "FMO historical option" } },
  { id: "callback", type: "disposition", campaignId: "medical", campaignName: "Medical Partner Cooperation", date: "2026-10-28T10:16:00Z",
    action: "callback_change", content: "callback_change", metadata: { callbackDate: "2026-10-29T08:37:00Z", callbackNote: "Discuss the proposal" } },
  { id: "step", type: "disposition", campaignId: "medical", campaignName: "Medical Partner Cooperation", date: "2026-10-01T09:28:00Z",
    action: "status_list_confirmation", metadata: { confirmed: true, itemLabel: "Contract proposal offered — considering", itemNote: "Review next week" } },
  { id: "unassigned", type: "email", date: "2026-10-01T09:27:00Z", content: "Legacy information email" },
  { id: "proposal", type: "email", campaignId: "medical", campaignName: "Medical Partner Cooperation",
    date: "2026-10-01T09:26:00Z", content: "Contract proposal email", status: "sent" },
];
const noop = () => {};
function Fixture() {
  const [mission, setMission] = useState("medical");
  const callbacks = Object.fromEntries(["onAddNote", "onDisposition", "onQuickAction", "onRightTabChange",
    "onOpenDispositionModal", "onEndCall", "onOpenDispositionFromCall", "onToggleMute", "onToggleHold",
    "onSendDtmf", "onVolumeChange", "onMicVolumeChange", "onEditCustomer", "onViewCustomer"].map(key => [key, noop]));
  return <div style={{ width: "min(100%, 440px)", height: "100dvh", margin: "0 auto" }}>
    <button data-testid="fixture-switch-mission" onClick={() => setMission(mission === "medical" ? "fmo" : "medical")}>Switch Mission</button>
    <CustomerInfoPanel {...callbacks as any} contact={{ id: "clinic", firstName: "Test", lastName: "Clinic", country: "SK" } as any}
      contactType="clinic" campaign={{ id: mission, name: mission === "medical" ? "Medical Partner Cooperation" : "FMO", settings: {} } as any}
      rightTab="history" callNotes="" contactHistory={history as any} dispositions={[]} currentUserId="agent"
      callState="idle" callDuration={0} ringDuration={0} hungUpBy={null} isMuted={false} isOnHold={false}
      volume={1} micVolume={1} callerNumber="" onOpenHistoryDetail={entry => { (window as any).openedHistoryEntry = entry.id; }} />
  </div>;
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
  <I18nProvider userCountries={country ? [country] : []}><AuthProvider><CallProvider><Fixture /></CallProvider></AuthProvider></I18nProvider>
</QueryClientProvider>);
