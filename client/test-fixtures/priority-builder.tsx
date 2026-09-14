import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { Dialog, DialogContent } from "../src/components/ui/dialog";
import PriorityBuilder from "../src/components/agent/PriorityBuilder";
import {
  queryClient,
} from "../src/lib/queryClient";
import { I18nProvider } from "../src/i18n";
import type { PriorityContact } from "../src/components/agent/priority-builder";
import "../src/index.css";

document.documentElement.setAttribute("data-agent-fullscreen", "true");

const today = new Date();
const todayAtNine = new Date(today);
todayAtNine.setHours(9, 0, 0, 0);
const tomorrowAtNine = new Date(todayAtNine);
tomorrowAtNine.setDate(tomorrowAtNine.getDate() + 1);

const contacts: PriorityContact[] = [
  {
    id: "referral-1",
    campaignId: "priority-fixture",
    contactType: "customer",
    status: "pending",
    assignedTo: null,
    attemptCount: 2,
    priorityScore: 100,
    createdAt: new Date("2026-01-01T08:00:00.000Z"),
    updatedAt: new Date("2026-01-01T08:00:00.000Z"),
    hasReferral: true,
    customer: { firstName: "Melichar", lastName: "SRO" },
  },
  {
    id: "referral-2",
    campaignId: "priority-fixture",
    contactType: "customer",
    status: "pending",
    assignedTo: null,
    attemptCount: 1,
    priorityScore: 90,
    createdAt: new Date("2026-01-02T08:00:00.000Z"),
    updatedAt: new Date("2026-01-02T08:00:00.000Z"),
    hasReferral: true,
    customer: { firstName: "Tes AmbuMed", lastName: "Partner" },
  },
  {
    id: "scheduled-1",
    campaignId: "priority-fixture",
    contactType: "customer",
    status: "callback_scheduled",
    assignedTo: null,
    attemptCount: 0,
    priorityScore: 80,
    callbackDate: todayAtNine,
    createdAt: new Date("2026-01-03T08:00:00.000Z"),
    updatedAt: new Date("2026-01-03T08:00:00.000Z"),
    customer: { firstName: "Tes Klinika", lastName: "Medifem X" },
  },
  {
    id: "scheduled-2",
    campaignId: "priority-fixture",
    contactType: "customer",
    status: "callback_scheduled",
    assignedTo: "other-agent",
    attemptCount: 0,
    priorityScore: 70,
    callbackDate: tomorrowAtNine,
    createdAt: new Date("2026-01-04T08:00:00.000Z"),
    updatedAt: new Date("2026-01-04T08:00:00.000Z"),
    customer: { firstName: "Tes Zdravotné", lastName: "centrum Iris" },
  },
  {
    id: "new-1",
    campaignId: "priority-fixture",
    contactType: "customer",
    status: "pending",
    assignedTo: null,
    attemptCount: 0,
    priorityScore: 60,
    createdAt: new Date("2026-01-05T08:00:00.000Z"),
    updatedAt: new Date("2026-01-05T08:00:00.000Z"),
    customer: { firstName: "Tes Centrum", lastName: "CarePoint" },
  },
  {
    id: "new-2",
    campaignId: "priority-fixture",
    contactType: "customer",
    status: "pending",
    assignedTo: null,
    attemptCount: 0,
    priorityScore: 50,
    createdAt: new Date("2026-01-06T08:00:00.000Z"),
    updatedAt: new Date("2026-01-06T08:00:00.000Z"),
    customer: { firstName: "Tes Ambulancia", lastName: "Femina" },
  },
  {
    id: "mine-1",
    campaignId: "priority-fixture",
    contactType: "customer",
    status: "callback_scheduled",
    assignedTo: "agent-fixture",
    attemptCount: 0,
    priorityScore: 40,
    callbackDate: tomorrowAtNine,
    createdAt: new Date("2026-01-07T08:00:00.000Z"),
    updatedAt: new Date("2026-01-07T08:00:00.000Z"),
    customer: { firstName: "Tes Ambulancia", lastName: "Medis" },
  },
  {
    id: "missed-1",
    campaignId: "priority-fixture",
    contactType: "customer",
    status: "pending",
    assignedTo: null,
    attemptCount: 3,
    priorityScore: 30,
    createdAt: new Date("2026-01-08T08:00:00.000Z"),
    updatedAt: new Date("2026-01-08T08:00:00.000Z"),
    customer: { firstName: "Tes Centrum", lastName: "Zena Plus" },
  },
];

const dialogClassName =
  "!w-[min(880px,calc(100vw-52px))] !max-w-none !flex flex-col h-[min(532px,calc(100dvh-36px))] min-h-[500px] max-h-[calc(100dvh-36px)] overflow-hidden p-0 gap-0 !rounded-[9px] !border-0 !shadow-[0_22px_70px_rgba(27,22,19,0.35)] max-[680px]:!w-[calc(100vw-16px)] max-[680px]:!h-[calc(100dvh-16px)] max-[680px]:!min-h-0 max-[680px]:!max-h-none [&>button]:hidden";

function Fixture() {
  const [open, setOpen] = useState(true);

  return (
    <>
      <div data-testid="priority-fixture-background" className="h-full" />
      {!open && <p data-testid="priority-fixture-closed">Priority builder closed</p>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          overlayClassName="!bg-[rgba(29,25,23,0.74)]"
          className={dialogClassName}
        >
          <PriorityBuilder
            className="h-full min-h-0 flex-1 rounded-none border-0"
            contacts={contacts}
            currentUserId="agent-fixture"
            onClose={() => setOpen(false)}
            onSelectContact={() => undefined}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

createRoot(document.getElementById("priority-builder-root")!).render(
  <QueryClientProvider client={queryClient}>
    <I18nProvider userCountries={[]}>
      <Fixture />
    </I18nProvider>
  </QueryClientProvider>,
);