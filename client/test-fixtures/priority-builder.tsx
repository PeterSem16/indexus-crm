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

const contactDefaults = {
  customerId: null, hospitalId: null, clinicId: null, collaboratorId: null,
  notes: null, dispositionCode: null, dispositionChecklistCodes: null,
  lastAttemptAt: null, callbackDate: null, callbackNote: null,
  contactedAt: null, completedAt: null, currentScriptStepId: null,
  callbackStatusListItemId: null,
};
function withContactDefaults(input: Array<Omit<PriorityContact, keyof typeof contactDefaults> & Partial<PriorityContact>>): PriorityContact[] {
  return input.map(contact => ({ ...contactDefaults, ...contact }));
}

const contacts = withContactDefaults([
  {
    id: "referral-1",
    campaignId: "priority-fixture",
    contactType: "customer",
    status: "pending",
    assignedTo: null,
    attemptCount: 0,
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
    attemptCount: 0,
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
]);

// The original eight-contact pool above intentionally remains the fixture for
// the existing queue regression suite. Rich search coverage opts in explicitly
// with ?rich-search=1 so those assertions keep their stable data set.
const richSearchContacts = withContactDefaults([
  {
    id: "rich-hospital-1",
    campaignId: "priority-rich-search",
    contactType: "hospital",
    status: "pending",
    assignedTo: null,
    attemptCount: 0,
    priorityScore: 110,
    createdAt: new Date("2026-02-01T08:00:00.000Z"),
    updatedAt: new Date("2026-02-01T08:00:00.000Z"),
    hasReferral: true,
    hospital: {
      name: "Fakultná nemocnica Trnava",
      contactPerson: "Jana Kováčová",
      phone: "+421 33 551 4400",
      email: "kontakt@fntrnava.example.org",
      city: "Trnava",
      countryCode: "SK",
    },
  },
  {
    id: "rich-clinic-semanova",
    campaignId: "priority-rich-search",
    contactType: "clinic",
    status: "pending",
    assignedTo: null,
    attemptCount: 0,
    priorityScore: 100,
    createdAt: new Date("2026-02-04T08:00:00.000Z"),
    updatedAt: new Date("2026-02-04T08:00:00.000Z"),
    clinic: {
      name: "ALLATURA",
      doctorName: "MUDr. Eva Semanová",
      doctorTitle: "MUDr.",
      doctorFirstName: "Eva",
      doctorLastName: "Semanová",
      phone: "+421 33 555 1100",
      phone2: "+421 33 555 2200",
      phone3: "+421 33 555 3300",
      email: "eva.semanova@allatura.example.org",
      email2: "recepcia@allatura.example.org",
      email3: "uctaren@allatura.example.org",
      city: "Trnava",
      countryCode: "SK",
    },
  },
  {
    id: "rich-customer-mobile2",
    campaignId: "priority-rich-search",
    contactType: "customer",
    status: "pending",
    assignedTo: null,
    attemptCount: 0,
    priorityScore: 90,
    createdAt: new Date("2026-02-03T08:00:00.000Z"),
    updatedAt: new Date("2026-02-03T08:00:00.000Z"),
    customer: {
      firstName: "Mária",
      lastName: "Mobilová",
      companyName: "Allatura Supplies",
      phone: "+421 948 100 101",
      mobile2: "+421 948 200 202",
      email: "maria.mobilova@example.org",
      email2: "office@example.org",
      city: "Nitra",
      country: "SK",
    },
  },
  {
    id: "rich-collaborator-1",
    campaignId: "priority-rich-search",
    contactType: "collaborator",
    status: "callback_scheduled",
    assignedTo: "agent-fixture",
    attemptCount: 2,
    priorityScore: 80,
    callbackDate: tomorrowAtNine,
    createdAt: new Date("2026-02-02T08:00:00.000Z"),
    updatedAt: new Date("2026-02-02T08:00:00.000Z"),
    collaborator: {
      titleBefore: "PharmDr.",
      firstName: "Tomáš",
      middleName: "Ján",
      lastName: "Spolupracovník",
      titleAfter: "PhD.",
      workplaceName: "Allatura Partner",
      professionalClassification: "farmaceut",
      phone: "+421 905 700 800",
      mobile: "+421 905 700 801",
      mobile2: "+421 905 700 802",
      email: "tomas.spolupracovnik@example.org",
      city: "Bratislava",
      countryCode: "SK",
      // Deliberately looks sensitive and unique, but is not part of the
      // public contact-search projection.
      mobilePasswordHash: "fixture-mobile-password-hash-do-not-search-7f4c",
    } as PriorityContact["collaborator"] & { mobilePasswordHash: string },
  },
]);

const manyCityNames = [
  "Bratislava", "Žilina", "Košice", "Banská Bystrica", "Prešov", "Nitra", "Trenčín", "Trnava", "Poprad", "Martin",
  "Prague", "Brno", "Ostrava", "České Budějovice", "Karlovy Vary", "Hradec Králové", "Pardubice", "Olomouc", "Liberec", "Ústí nad Labem",
  "Vienna", "Salzburg", "Innsbruck", "Klagenfurt", "Sankt Pölten", "Wels", "Dornbirn", "Wiener Neustadt", "Eisenstadt", "Bregenz",
  "Budapest", "Debrecen", "Szeged", "Miskolc", "Pécs", "Győr", "Nyíregyháza", "Kecskemét", "Székesfehérvár", "Szombathely",
  "Warsaw", "Kraków", "Łódź", "Wrocław", "Poznań", "Gdańsk", "Szczecin", "Bydgoszcz", "Lublin", "Białystok",
  "Berlin", "Hamburg", "Munich", "Cologne", "Frankfurt am Main", "Stuttgart", "Düsseldorf", "Leipzig", "Dortmund", "Nuremberg",
  "Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes", "Strasbourg", "Montpellier", "Bordeaux", "Saint-Étienne",
  "Rome", "Milan", "Naples", "Turin", "Palermo", "Genoa", "Bologna", "Florence", "Bari", "Catania",
  "Madrid", "Barcelona", "Valencia", "Seville", "Zaragoza", "Málaga", "Murcia", "Palma de Mallorca", "Las Palmas de Gran Canaria", "Santa Cruz de Tenerife",
  "Lisbon", "Porto", "Amadora", "Braga", "Coimbra", "Funchal", "Setúbal", "Almada", "Aveiro", "Vila Nova de Gaia",
  "Amsterdam", "Rotterdam", "The Hague", "Utrecht", "Eindhoven", "Groningen", "Tilburg", "Almere", "Breda", "Nijmegen",
  "Brussels", "Antwerp", "Ghent", "Charleroi", "Liège", "Bruges", "Namur", "Leuven", "Mons", "Mechelen",
  "Copenhagen", "Aarhus", "Odense", "Aalborg", "Esbjerg", "Randers", "Kolding", "Horsens", "Vejle", "Roskilde",
  "Stockholm", "Gothenburg", "Malmö", "Uppsala", "Västerås", "Örebro", "Linköping", "Helsingborg", "Jönköping", "Norrköping",
  "Oslo", "Bergen", "Trondheim", "Stavanger", "Drammen", "Fredrikstad", "Kristiansand", "Sandnes", "Tromsø", "Ålesund",
  "Helsinki", "Espoo", "Tampere", "Vantaa", "Oulu", "Turku", "Jyväskylä", "Lahti", "Kuopio", "Pori",
  "Dublin", "Cork", "Limerick", "Galway", "Waterford", "Drogheda", "Dundalk", "Swords", "Kilkenny", "Ennis",
  "Athens", "Thessaloniki", "Patras", "Heraklion", "Larissa", "Volos", "Ioannina", "Chania", "Kalamata", "Rhodes",
  "London", "Birmingham", "Liverpool", "Manchester", "Leeds", "Bristol", "Sheffield", "Edinburgh", "Glasgow", "Cardiff",
  "Zagreb", "Split", "Rijeka", "Osijek", "Zadar", "Pula", "Dubrovnik", "Varaždin", "Šibenik", "Slavonski Brod",
  "Ljubljana", "Maribor", "Celje", "Kranj", "Koper", "Novo Mesto", "Velenje", "Ptuj", "Kamnik", "Jesenice",
  "Bucharest", "Cluj-Napoca", "Timișoara", "Iași", "Constanța", "Craiova", "Brașov", "Galați", "Ploiești", "Oradea",
  "Sofia", "Plovdiv", "Varna", "Burgas", "Ruse", "Stara Zagora", "Pleven", "Sliven", "Dobrich", "Shumen",
  "Istanbul", "Ankara", "Izmir", "Bursa", "Antalya", "Adana", "Konya", "Gaziantep", "Mersin", "Diyarbakır",
  "Kyiv", "Lviv", "Odesa", "Kharkiv", "Dnipro", "Vinnytsia", "Poltava", "Chernihiv", "Chernivtsi", "Uzhhorod",
  "Reykjavík", "Luxembourg", "San Marino", "Monaco", "Andorra la Vella",
].slice(0, 225).map((city, index) => ({ city, country: ["SK", "CZ", "AT", "HU", "PL", "DE", "FR", "IT", "ES", "PT", "NL", "BE", "DK", "SE", "NO", "FI", "IE", "GR", "GB", "HR", "SI", "RO", "BG", "TR", "UA"][index % 25] }));

const manyCityContacts = withContactDefaults(manyCityNames.map(({ city, country }, index) => ({
  id: `many-city-${String(index + 1).padStart(3, "0")}`,
  campaignId: "priority-many-cities",
  contactType: "customer",
  status: "pending",
  assignedTo: null,
  attemptCount: 0,
  priorityScore: 300 - index,
  createdAt: new Date(`2026-03-${String((index % 28) + 1).padStart(2, "0")}T08:00:00.000Z`),
  updatedAt: new Date(`2026-03-${String((index % 28) + 1).padStart(2, "0")}T08:00:00.000Z`),
  customer: { firstName: "City", lastName: `Contact ${index + 1}`, city, country },
})));

const selectedFixtureContacts = new URLSearchParams(window.location.search).get("many-cities") === "1"
  ? manyCityContacts
  : new URLSearchParams(window.location.search).get("rich-search") === "1"
  ? richSearchContacts
  : contacts;
const fixtureCountry = new URLSearchParams(window.location.search).get("country");
const fixtureCountries = fixtureCountry ? [fixtureCountry] : [];

function Fixture() {
  const [open, setOpen] = useState(true);
  const [fixtureContacts, setFixtureContacts] = useState(selectedFixtureContacts);
  const [auto, setAuto] = useState(false);
  const [nextCalls, setNextCalls] = useState(0);
  const [nextContactId, setNextContactId] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");

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
            onSelectContact={contact => setSelectedContactId(contact.id)}
          />
        </DialogContent>
      </Dialog>
      <output data-testid="priority-fixture-next-calls">{nextCalls}</output>
      <output data-testid="priority-fixture-next-contact">{nextContactId}</output>
      <output data-testid="priority-fixture-auto">{String(auto)}</output>
      <output data-testid="priority-fixture-selected-contact">{selectedContactId}</output>
    </>
  );
}

createRoot(document.getElementById("priority-builder-root")!).render(
  <QueryClientProvider client={queryClient}>
    <I18nProvider userCountries={fixtureCountries}>
      <Fixture />
    </I18nProvider>
  </QueryClientProvider>,
);