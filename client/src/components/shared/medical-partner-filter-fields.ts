import {
  Activity,
  Award,
  Calendar,
  Database,
  FileText,
  Globe,
  GraduationCap,
  Hospital,
  ListChecks,
  ListFilter,
  Mail,
  MapPin,
  Navigation,
  Network,
  Phone,
  ShieldCheck,
  Stethoscope,
  StickyNote,
  Target,
  User,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import type { FilterField, FilterPreset } from "./EntityFilter";
import { COUNTRIES } from "@shared/schema";

type FilterUser = {
  id: string;
  name?: string | null;
  fullName?: string | null;
  username?: string | null;
  email?: string | null;
};

type FilterLaboratory = {
  id: string;
  name: string;
};

export type MedicalPartnerFilterEntity = "clinic" | "hospital";

function countryOptions(sk: boolean) {
  return COUNTRIES.map((country) => ({
    value: country.code,
    label:
      sk
        ? ({
            SK: "Slovensko",
            CZ: "Česko",
            AT: "Rakúsko",
            HU: "Maďarsko",
            RO: "Rumunsko",
            IT: "Taliansko",
            DE: "Nemecko",
            US: "USA",
            CH: "Švajčiarsko",
          } as Record<string, string>)[country.code] || country.name
        : ({
            SK: "Slovakia",
            CZ: "Czechia",
            AT: "Austria",
            HU: "Hungary",
            RO: "Romania",
            IT: "Italy",
            DE: "Germany",
            US: "USA",
            CH: "Switzerland",
          } as Record<string, string>)[country.code] || country.name,
  }));
}

function booleanOptions(sk: boolean) {
  return [
    { value: "true", label: sk ? "Áno" : "Yes" },
    { value: "false", label: sk ? "Nie" : "No" },
  ];
}

export function getMedicalPartnerFilterFields(
  entity: MedicalPartnerFilterEntity,
  locale: string | undefined,
  users: FilterUser[] = [],
  laboratories: FilterLaboratory[] = [],
): FilterField[] {
  const sk = locale === "sk";
  const COUNTRY_OPTIONS = countryOptions(sk);
  const BOOL_OPTIONS = booleanOptions(sk);
  const userOptions = users.map((u) => ({
    value: u.id,
    label: u.name || u.fullName || u.username || u.email || u.id,
  }));

  if (entity === "hospital") {
    return [
      { key: "country", label: sk ? "Krajina" : "Country", type: "multiselect", icon: Globe, options: COUNTRY_OPTIONS },
      { key: "status", label: sk ? "Status" : "Status", type: "select", icon: Activity, options: [
        { value: "active", label: sk ? "Aktívna" : "Active" },
        { value: "inactive", label: sk ? "Neaktívna" : "Inactive" },
      ] },
      { key: "personnel", label: sk ? "Personál" : "Personnel", type: "select", icon: Users, options: [
        { value: "with", label: sk ? "S personálom" : "With personnel" },
        { value: "without", label: sk ? "Bez personálu" : "Without personnel" },
      ] },
      { key: "name", label: sk ? "Názov" : "Name", type: "text", icon: Hospital },
      { key: "fullName", label: sk ? "Plný názov" : "Full Name", type: "text", icon: Hospital },
      { key: "city", label: sk ? "Mesto" : "City", type: "text", icon: MapPin },
      { key: "region", label: sk ? "Kraj" : "Region", type: "text", icon: MapPin },
      { key: "district", label: sk ? "Okres" : "District", type: "text", icon: MapPin },
      { key: "postalCode", label: sk ? "PSČ" : "Postal Code", type: "text", icon: MapPin },
      { key: "streetNumber", label: sk ? "Ulica" : "Street", type: "text", icon: MapPin },
      { key: "contactPerson", label: sk ? "Kontaktná osoba" : "Contact Person", type: "text", icon: User },
      { key: "phone", label: sk ? "Telefón" : "Phone", type: "text", icon: Phone },
      { key: "email", label: "Email", type: "text", icon: Mail },
      { key: "svetZdravia", label: "Svet Zdravia", type: "select", icon: Network, options: BOOL_OPTIONS },
      { key: "autoRecruiting", label: sk ? "Auto recruiting" : "Auto Recruiting", type: "select", icon: UserPlus, options: BOOL_OPTIONS },
      { key: "representativeId", label: sk ? "Reprezentant" : "Representative", type: "select", icon: User, options: userOptions },
      { key: "responsiblePersonId", label: sk ? "Zodpovedná osoba" : "Responsible Person", type: "select", icon: ShieldCheck, options: userOptions },
      { key: "laboratoryId", label: sk ? "Laboratórium" : "Laboratory", type: "select", icon: Database, options: laboratories.map((l) => ({ value: l.id, label: l.name })) },
      { key: "tags", label: sk ? "Tagy" : "Tags", type: "text", icon: ListFilter },
      { key: "dataSource", label: sk ? "Pôvod" : "Data Source", type: "text", icon: Database },
      { key: "createdByCollaboratorId", label: sk ? "Pridal (collaborator)" : "Created by (collaborator)", type: "text", icon: UserPlus },
      { key: "legacyId", label: sk ? "Legacy ID" : "Legacy ID", type: "text", icon: FileText },
      { key: "hasPhone", label: sk ? "Má telefón" : "Has Phone", type: "select", icon: Phone, options: BOOL_OPTIONS },
      { key: "hasEmail", label: sk ? "Má email" : "Has Email", type: "select", icon: Mail, options: BOOL_OPTIONS },
      { key: "hasGps", label: sk ? "Má GPS" : "Has GPS", type: "select", icon: Navigation, options: BOOL_OPTIONS },
    ];
  }

  const PIPELINE_OPTIONS = [
    { value: "no_status", label: sk ? "Bez statusu" : "No Status" },
    { value: "initial:not_contacted", label: sk ? "Nekontaktovaná" : "Not Contacted" },
    { value: "initial:former", label: sk ? "Bývalá" : "Former" },
    { value: "initial:active_contract", label: sk ? "Aktívna zmluva (init)" : "Active Contract (init)" },
    { value: "coop:unknown", label: sk ? "Spolupráca: neznáma" : "Coop: Unknown" },
    { value: "coop:interested", label: sk ? "Spolupráca: záujem" : "Coop: Interested" },
    { value: "coop:not_interested", label: sk ? "Spolupráca: bez záujmu" : "Coop: Not Interested" },
    { value: "contract_int:unknown", label: sk ? "Zmluva-záujem: neznámy" : "Contract Int: Unknown" },
    { value: "contract_int:interested", label: sk ? "Zmluva-záujem: áno" : "Contract Int: Interested" },
    { value: "contract_int:not_interested", label: sk ? "Zmluva-záujem: nie" : "Contract Int: Not Interested" },
    { value: "contract:none", label: sk ? "Bez zmluvy" : "No Contract" },
    { value: "contract:active", label: sk ? "Aktívna zmluva" : "Active Contract" },
  ];

  return [
    { key: "country", label: sk ? "Krajina" : "Country", type: "multiselect", icon: Globe, options: COUNTRY_OPTIONS },
    { key: "status", label: sk ? "Status" : "Status", type: "select", icon: Activity, options: [
      { value: "active", label: sk ? "Aktívna" : "Active" },
      { value: "inactive", label: sk ? "Neaktívna" : "Inactive" },
    ] },
    { key: "pipeline", label: sk ? "Pipeline status" : "Pipeline Status", type: "select", icon: ListChecks, options: PIPELINE_OPTIONS },
    { key: "name", label: sk ? "Názov" : "Name", type: "text", icon: Stethoscope },
    { key: "doctorName", label: sk ? "Doktor" : "Doctor Name", type: "text", icon: User },
    { key: "doctorTitle", label: sk ? "Titul doktora" : "Doctor Title", type: "text", icon: GraduationCap },
    { key: "doctorFirstName", label: sk ? "Krstné meno doktora" : "Doctor First Name", type: "text", icon: User },
    { key: "doctorLastName", label: sk ? "Priezvisko doktora" : "Doctor Last Name", type: "text", icon: User },
    { key: "ico", label: "IČO", type: "text", icon: FileText },
    { key: "pzsCode", label: sk ? "Kód PZS" : "PZS Code", type: "text", icon: FileText },
    { key: "pzsName", label: sk ? "Názov PZS" : "PZS Name", type: "text", icon: FileText },
    { key: "idZz", label: "ID ZZ", type: "text", icon: FileText },
    { key: "city", label: sk ? "Mesto" : "City", type: "text", icon: MapPin },
    { key: "region", label: sk ? "Kraj" : "Region", type: "text", icon: MapPin },
    { key: "district", label: sk ? "Okres" : "District", type: "text", icon: MapPin },
    { key: "street", label: sk ? "Ulica" : "Street", type: "text", icon: MapPin },
    { key: "streetNumber", label: sk ? "Číslo ulice" : "Street Number", type: "text", icon: MapPin },
    { key: "postalCode", label: sk ? "PSČ" : "Postal Code", type: "text", icon: MapPin },
    { key: "address", label: sk ? "Adresa" : "Address", type: "text", icon: MapPin },
    { key: "phone", label: sk ? "Telefón" : "Phone", type: "text", icon: Phone },
    { key: "phone2", label: sk ? "Telefón 2" : "Phone 2", type: "text", icon: Phone },
    { key: "phone3", label: sk ? "Telefón 3" : "Phone 3", type: "text", icon: Phone },
    { key: "email", label: "Email", type: "text", icon: Mail },
    { key: "email2", label: "Email 2", type: "text", icon: Mail },
    { key: "email3", label: "Email 3", type: "text", icon: Mail },
    { key: "website", label: sk ? "Webstránka" : "Website", type: "text", icon: Globe },
    { key: "hasWebsite", label: sk ? "Má webstránku" : "Has Website", type: "select", icon: Globe, options: BOOL_OPTIONS },
    { key: "hasPhone", label: sk ? "Má telefón" : "Has Phone", type: "select", icon: Phone, options: BOOL_OPTIONS },
    { key: "hasEmail", label: sk ? "Má email" : "Has Email", type: "select", icon: Mail, options: BOOL_OPTIONS },
    { key: "hasGps", label: sk ? "Má GPS" : "Has GPS", type: "select", icon: Navigation, options: BOOL_OPTIONS },
    { key: "isReferredByDoctor", label: sk ? "Doporučená lekárom" : "Referred by Doctor", type: "select", icon: UserCheck, options: BOOL_OPTIONS },
    { key: "isFromConference", label: sk ? "Z konferencie" : "From Conference", type: "select", icon: Award, options: BOOL_OPTIONS },
    { key: "conferenceName", label: sk ? "Názov konferencie" : "Conference Name", type: "text", icon: Award },
    { key: "initialStatus", label: sk ? "Initial Status" : "Initial Status", type: "select", icon: ListChecks, options: [
      { value: "not_contacted", label: sk ? "Nekontaktovaná" : "Not Contacted" },
      { value: "former", label: sk ? "Bývalá" : "Former" },
      { value: "active_contract", label: sk ? "Aktívna zmluva" : "Active Contract" },
    ] },
    { key: "interestCooperation", label: sk ? "Záujem o spoluprácu" : "Cooperation Interest", type: "select", icon: ListChecks, options: [
      { value: "unknown", label: sk ? "Neznámy" : "Unknown" },
      { value: "interested", label: sk ? "Záujem" : "Interested" },
      { value: "not_interested", label: sk ? "Bez záujmu" : "Not Interested" },
    ] },
    { key: "interestContract", label: sk ? "Záujem o zmluvu" : "Contract Interest", type: "select", icon: ListChecks, options: [
      { value: "unknown", label: sk ? "Neznámy" : "Unknown" },
      { value: "interested", label: sk ? "Záujem" : "Interested" },
      { value: "not_interested", label: sk ? "Bez záujmu" : "Not Interested" },
    ] },
    { key: "contractStatus", label: sk ? "Status zmluvy" : "Contract Status", type: "select", icon: FileText, options: [
      { value: "none", label: sk ? "Žiadna" : "None" },
      { value: "active", label: sk ? "Aktívna" : "Active" },
    ] },
    { key: "lastCallResult", label: sk ? "Posledný hovor" : "Last Call Result", type: "text", icon: Phone },
    { key: "lastCallNote", label: sk ? "Poznámka k hovoru" : "Last Call Note", type: "text", icon: StickyNote },
    { key: "leadSource", label: sk ? "Zdroj leadu" : "Lead Source", type: "text", icon: Target },
    { key: "leadSourceNotes", label: sk ? "Poznámky k zdroju" : "Lead Source Notes", type: "text", icon: StickyNote },
    { key: "leadSourceDate", label: sk ? "Dátum zdroja" : "Lead Source Date", type: "text", icon: Calendar },
    { key: "conferenceDate", label: sk ? "Dátum konferencie" : "Conference Date", type: "text", icon: Calendar },
    { key: "nextContactDate", label: sk ? "Najbližší kontakt" : "Next Contact Date", type: "text", icon: Calendar },
    { key: "contractSentDate", label: sk ? "Zmluva odoslaná" : "Contract Sent Date", type: "text", icon: Calendar },
    { key: "contractReturnedDate", label: sk ? "Zmluva vrátená" : "Contract Returned Date", type: "text", icon: Calendar },
    { key: "hasFlyers", label: sk ? "Letáky" : "Has Flyers", type: "select", icon: FileText, options: BOOL_OPTIONS },
    { key: "flyersSentDate", label: sk ? "Letáky odoslané" : "Flyers Sent Date", type: "text", icon: Calendar },
    { key: "flyersLocation", label: sk ? "Umiestnenie letákov" : "Flyers Location", type: "text", icon: MapPin },
    { key: "doctorPositionCategoryId", label: sk ? "Kategória pozície" : "Doctor Position Category", type: "text", icon: GraduationCap },
    { key: "orientationNumber", label: sk ? "Orientačné číslo" : "Orientation Number", type: "text", icon: MapPin },
    { key: "tags", label: sk ? "Tagy" : "Tags", type: "text", icon: ListFilter },
    { key: "notes", label: sk ? "Poznámky" : "Notes", type: "text", icon: StickyNote },
    { key: "legacyId", label: "Legacy ID", type: "text", icon: FileText },
    { key: "representativeId", label: sk ? "Reprezentant" : "Representative", type: "select", icon: User, options: userOptions },
  ];
}

export function getMedicalPartnerFilterPresets(
  entity: MedicalPartnerFilterEntity,
  locale: string | undefined,
): FilterPreset[] {
  const sk = locale === "sk";
  if (entity === "hospital") {
    return [
      { id: "active", label: sk ? "Iba aktívne" : "Active only", rules: [{ id: "p-active", conjunction: "and", field: "status", op: "is", value: "active" }] },
      { id: "with-personnel", label: sk ? "S personálom" : "With personnel", rules: [{ id: "p-pers", conjunction: "and", field: "personnel", op: "is", value: "with" }] },
      { id: "svet-zdravia", label: "Svet Zdravia", rules: [{ id: "p-sz", conjunction: "and", field: "svetZdravia", op: "is", value: "true" }] },
      { id: "no-email", label: sk ? "Bez emailu" : "Missing email", rules: [{ id: "p-noem", conjunction: "and", field: "hasEmail", op: "is", value: "false" }] },
    ];
  }
  return [
    { id: "active", label: sk ? "Iba aktívne" : "Active only", rules: [{ id: "p-active", conjunction: "and", field: "status", op: "is", value: "active" }] },
    { id: "active-contract", label: sk ? "Aktívna zmluva" : "Active contract", rules: [{ id: "p-ac", conjunction: "and", field: "pipeline", op: "is", value: "contract:active" }] },
    { id: "interested", label: sk ? "Záujem o spoluprácu" : "Interested in coop", rules: [{ id: "p-int", conjunction: "and", field: "interestCooperation", op: "is", value: "interested" }] },
    { id: "no-status", label: sk ? "Bez statusu" : "No status", rules: [{ id: "p-ns", conjunction: "and", field: "pipeline", op: "is", value: "no_status" }] },
    { id: "from-conference", label: sk ? "Z konferencie" : "From conference", rules: [{ id: "p-conf", conjunction: "and", field: "isFromConference", op: "is", value: "true" }] },
  ];
}
