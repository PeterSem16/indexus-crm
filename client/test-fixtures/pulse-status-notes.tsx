import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { CallProvider } from "../src/contexts/call-context";
import { CommunicationCanvas, CustomerInfoPanel } from "../src/pages/agent-workspace";
import { AuthProvider } from "../src/contexts/auth-context";
import { I18nProvider } from "../src/i18n";
import { PulseToastScope } from "../src/hooks/use-toast";
import { queryClient } from "../src/lib/queryClient";
import "../src/index.css";

document.documentElement.setAttribute("data-agent-fullscreen", "true");

const contact = {
  id: "contact-1",
  firstName: "Regression",
  lastName: "Contact",
  fullName: "Regression Contact",
  email: "regression@example.test",
  phone: "+421900000001",
  country: "SK",
};

const campaign = {
  id: "campaign-1",
  name: "Pulse notes regression",
  settings: JSON.stringify({ statusListMode: "batch", showScript: false }),
  script: null,
};

const history = [
  {
    id: "history-confirmation",
    type: "disposition" as const,
    action: "status_list_confirmation",
    date: "2025-01-01T10:00:00.000Z",
    content: "Retention parent confirmed",
    agentName: "Test Agent",
    campaignName: "Pulse notes regression",
    metadata: {
      itemLabel: "Retention parent",
      itemDescription: "Parent step description",
      itemNote: "Parent note from server",
      confirmed: true,
    },
  },
  {
    id: "history-note-update",
    type: "disposition" as const,
    action: "status_list_note_update",
    date: "2025-01-02T11:15:00.000Z",
    content: "Retention parent note updated",
    agentName: "Test Agent",
    campaignName: "Pulse notes regression",
    metadata: {
      itemLabel: "Retention parent",
      itemNote: "Edited historical note",
    },
  },
  {
    id: "history-note-clear",
    type: "disposition" as const,
    action: "status_list_note_update",
    date: "2025-01-03T12:30:00.000Z",
    content: "Retention parent note cleared",
    agentName: "Test Agent",
    campaignName: "Pulse notes regression",
    metadata: {
      itemLabel: "Retention parent",
      itemNote: null,
    },
  },
];

function CanvasFixture() {
  const [open, setOpen] = useState(true);

  return (
    <div className="h-screen w-screen overflow-hidden bg-background">
      <div className="flex h-full min-h-0">
        {open ? (
          <CallProvider>
            <div className="flex min-w-0 flex-1">
              <CommunicationCanvas
                contact={contact as any}
                campaign={campaign as any}
                activeChannel="checklist"
                onChannelChange={() => {}}
                timeline={[]}
                onSendEmail={async () => true}
                onSendSms={() => {}}
                isSendingEmail={false}
                isSendingSms={false}
                onOpenScriptModal={() => {}}
                campaignContactId="campaign-contact-1"
                contactCountry="SK"
                contactHistory={[]}
                onOpenHistoryDetail={() => {}}
                onBatchUnsavedCountChange={() => {}}
                onClearContact={() => setOpen(false)}
              />
              <CustomerInfoPanel
                {...({
                  contact: contact as any,
                  campaign: campaign as any,
                  callNotes: "",
                  onAddNote: async () => {},
                  onDisposition: () => {},
                  onQuickAction: () => {},
                  rightTab: "history",
                  onRightTabChange: () => {},
                  contactHistory: history,
                  dispositions: [],
                  currentUserId: "agent-1",
                  onOpenDispositionModal: () => {},
                  callState: "idle",
                  callDuration: 0,
                  ringDuration: 0,
                  hungUpBy: null,
                  onEndCall: () => {},
                  onOpenDispositionFromCall: () => {},
                  isMuted: false,
                  isOnHold: false,
                  volume: 80,
                  micVolume: 100,
                  onToggleMute: () => {},
                  onToggleHold: () => {},
                  onSendDtmf: () => {},
                  onVolumeChange: () => {},
                  onMicVolumeChange: () => {},
                  callerNumber: contact.phone,
                  onEditCustomer: () => {},
                  onViewCustomer: () => {},
                  onOpenHistoryDetail: () => {},
                  onCloseCallAfterStatusList: () => {},
                  isStatusListMode: true,
                  campaignContactId: "campaign-contact-1",
                } as any)}
              />
            </div>
          </CallProvider>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <button
              type="button"
              className="rounded-md border px-4 py-2 text-sm"
              data-testid="fixture-reopen"
              onClick={() => setOpen(true)}
            >
              Reopen status list
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Fixture() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <I18nProvider userCountries={["SK"]}>
          <PulseToastScope>
            <CanvasFixture />
          </PulseToastScope>
        </I18nProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);