import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { Dialog, DialogContent } from "../src/components/ui/dialog";
import PriorityBuilder, { PRIORITY_BUILDER_DIALOG_CLASS_NAME } from "../src/components/agent/PriorityBuilder";
import {
  queryClient,
} from "../src/lib/queryClient";
import { I18nProvider } from "../src/i18n";
import type { PriorityContact } from "../src/components/agent/priority-builder";
import { buildPriorityQueueWithFallback, parsePriorityView, DEFAULT_PRIORITY_VIEW, PRIORITY_BUILDER_MODULE } from "../src/components/agent/priority-builder";
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
    customer: { firstName: "Melichar", lastName: "SRO", city: "Zilina", country: "SK" },
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
    customer: { firstName: "Tes AmbuMed", lastName: "Partner", city: "Bratislava", country: "SK" },
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
    customer: { firstName: "Tes Klinika", lastName: "Medifem X", city: "Prague", country: "CZ" },
  },
  {
    id: "scheduled-2",
    campaignId: "priority-fixture",
    contactType: "customer",
    status: "callback_scheduled",
    assignedTo: "other-agent",
    // Exercise the UI's unknown-count state separately from an explicit zero.
    attemptCount: undefined as unknown as number,
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
    customer: { firstName: "Tes Centrum", lastName: "CarePoint", city: "Brno", country: "CZ" },
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
    customer: { firstName: "Tes Ambulancia", lastName: "Femina", city: "Vienna", country: "AT" },
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
    customer: { firstName: "Tes Ambulancia", lastName: "Medis", city: "Bratislava", country: "SK" },
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
    customer: { firstName: "Tes Centrum", lastName: "Zena Plus", city: "Nitra", country: "SK" },
  },
];

function Fixture() {
  const [open, setOpen] = useState(true);
  const [fixtureContacts, setFixtureContacts] = useState(contacts);
  const [auto, setAuto] = useState(false);
  const [nextCalls, setNextCalls] = useState(0);
  const [nextContactId, setNextContactId] = useState("");

  useEffect(() => {
    const fixtureWindow = window as Window & { priorityFixtureAddCity?: () => void };
    fixtureWindow.priorityFixtureAddCity = () => setFixtureContacts(current => [...current, {
      ...contacts[0],
      id: "new-city-contact",
      hasReferral: false,
      priorityScore: 15,
      customer: { firstName: "Nové mesto", lastName: "Fixture", city: "Trnava", country: "SK" },
    }]);
    return () => { delete fixtureWindow.priorityFixtureAddCity; };
  }, []);

  return (
    <>
      <div data-testid="priority-fixture-background" className="h-full" />
      {!open && <p data-testid="priority-fixture-closed">Priority builder closed</p>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          overlayClassName="!bg-[rgba(29,25,23,0.74)]"
          className={PRIORITY_BUILDER_DIALOG_CLASS_NAME}
        >
          <PriorityBuilder
            className="h-full min-h-0 flex-1 rounded-none border-0"
            contacts={fixtureContacts}
            currentUserId="agent-fixture"
            onClose={() => setOpen(false)}
            isAutoMode={auto}
            onToggleAutoMode={() => setAuto(value => !value)}
            onNextContact={() => {
              // Parent-owned queue reads the persisted shared cache, not the local editor draft.
              const persisted = queryClient.getQueryData<Array<{ isDefault: boolean; filters: string }>>(["/api/saved-searches", PRIORITY_BUILDER_MODULE]);
              const active = persisted?.find(view => view.isDefault);
              const view = active ? parsePriorityView(JSON.parse(active.filters)) || DEFAULT_PRIORITY_VIEW : DEFAULT_PRIORITY_VIEW;
              const next = buildPriorityQueueWithFallback(fixtureContacts, view, "agent-fixture")[0];
              setNextCalls(value => value + 1);
              setNextContactId(next?.contact.id || "");
            }}
            onSelectContact={() => undefined}
          />
        </DialogContent>
      </Dialog>
      <output data-testid="priority-fixture-next-calls">{nextCalls}</output>
      <output data-testid="priority-fixture-next-contact">{nextContactId}</output>
      <output data-testid="priority-fixture-auto">{String(auto)}</output>
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