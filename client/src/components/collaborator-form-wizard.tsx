import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PhoneNumberField } from "@/components/phone-number-field";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { COUNTRIES, VISIT_SUBJECTS, VISIT_PLACE_OPTIONS, REWARD_TYPES as SERVICE_TYPES } from "@shared/schema";
import type { Collaborator, Hospital, SafeUser, HealthInsurance, Role, CollaboratorActivity } from "@shared/schema";
import { ChevronLeft, ChevronRight, Check, User, Phone, CreditCard, Building2, Smartphone, MapPin, FileText, History, Plus, Pencil, Trash2, Clock, Activity, Upload, Download, Eye, ChevronDown, ChevronUp, Copy, X, Wifi, Play, Pause, PhoneCall, PhoneIncoming, PhoneOutgoing, PhoneMissed, Calendar, BarChart3, Sparkles, Loader2, Network, Hospital as HospitalIcon, Stethoscope, Star, FolderOpen, File, FileUp, Search, UserCheck, GraduationCap } from "lucide-react";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ClinicFormSheet } from "@/components/clinic-form-wizard";
import { HospitalEditDrawer } from "@/pages/hospitals";
import { CollaboratorPositionsBlock } from "@/components/collaborator-positions-block";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import type { CollaboratorAddress, CollaboratorAgreement, BillingDetails } from "@shared/schema";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";
import { getCountryFlag } from "@/lib/countries";
import { REGIONS_BY_COUNTRY, DISTRICTS_BY_REGION, getAutoRegion, getAutoDistrict, getDistrictsForRegion, getGeoLabels } from "@/lib/regions";
import { SuggestRegionButton } from "@/components/suggest-region-button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useModuleFieldPermissions } from "@/components/ui/permission-field";

const COLLABORATOR_TYPES = [
  { value: "doctor", labelKey: "doctor" },
  { value: "nurse", labelKey: "nurse" },
  { value: "resident", labelKey: "resident" },
  { value: "callCenter", labelKey: "callCenter" },
  { value: "headNurse", labelKey: "headNurse" },
  { value: "bm", labelKey: "bm" },
  { value: "vedono", labelKey: "vedono" },
  { value: "external", labelKey: "external" },
  { value: "representative", labelKey: "representative" },
  { value: "other", labelKey: "other" },
] as const;

const MARITAL_STATUSES = [
  { value: "single", labelKey: "single" },
  { value: "married", labelKey: "married" },
  { value: "divorced", labelKey: "divorced" },
  { value: "widowed", labelKey: "widowed" },
] as const;

const PROFESSIONAL_CLASSIFICATIONS = [
  { value: "gynecology_specialists", labelKey: "gynecologySpecialists" },
  { value: "general_practitioners", labelKey: "generalPractitioners" },
  { value: "chief_physicians", labelKey: "chiefPhysicians" },
  { value: "medical_directors", labelKey: "medicalDirectors" },
  { value: "specialized_midwives", labelKey: "specializedMidwives" },
  { value: "charge_midwives", labelKey: "chargeMidwives" },
  { value: "midwives_no_specialization", labelKey: "midwivesNoSpecialization" },
  { value: "head_nurses", labelKey: "headNurses" },
  { value: "surgical_nurses", labelKey: "surgicalNurses" },
  { value: "general_nurses_no_spec", labelKey: "generalNursesNoSpec" },
  { value: "internal_medicine_nurses", labelKey: "internalMedicineNurses" },
  { value: "practical_nurses", labelKey: "practicalNurses" },
  { value: "healthcare_assistants", labelKey: "healthcareAssistants" },
] as const;

const EDUCATION_LEVELS = [
  { value: "A", labelKey: "noEducation" },
  { value: "B", labelKey: "incompletePrimary" },
  { value: "C", labelKey: "primary" },
  { value: "D", labelKey: "lowerSecondary" },
  { value: "E", labelKey: "lowerSecondaryVocational" },
  { value: "H", labelKey: "secondaryVocationalCertificate" },
  { value: "J", labelKey: "secondaryWithoutCertificateOrExam" },
  { value: "K", labelKey: "upperSecondaryGeneral" },
  { value: "L", labelKey: "upperSecondaryVocationalWithCertAndExam" },
  { value: "M", labelKey: "upperSecondaryVocationalExamOnly" },
  { value: "N", labelKey: "higherVocational" },
  { value: "P", labelKey: "higherVocationalConservatory" },
  { value: "R", labelKey: "bachelorDegree" },
  { value: "T", labelKey: "masterDegree" },
  { value: "V", labelKey: "doctoralDegree" },
] as const;

const PARTNER_CATEGORIES = [
  { value: "key_opinion_leader", label: "Key Opinion Leader (KOL)", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  { value: "strategic_partner", label: "Strategic Partner", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "referral_source", label: "Referral Source", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" },
  { value: "training_partner", label: "Training Partner", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  { value: "hospital_director", label: "Hospital Director", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200" },
  { value: "department_head", label: "Department Head", color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200" },
  { value: "department_doctor", label: "Department Doctor", color: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200" },
  { value: "chief_physician", label: "Chief Physician (Primár)", color: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200" },
  { value: "attending_physician", label: "Attending Physician (Sekundár)", color: "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200" },
  { value: "gynecologist", label: "Gynecologist", color: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900 dark:text-fuchsia-200" },
  { value: "obstetrician", label: "Obstetrician", color: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200" },
  { value: "neonatologist", label: "Neonatologist", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  { value: "pediatrician", label: "Pediatrician", color: "bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-200" },
  { value: "head_nurse", label: "Head Nurse", color: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200" },
  { value: "nurse", label: "Nurse", color: "bg-pink-50 text-pink-700 dark:bg-pink-950 dark:text-pink-300" },
  { value: "delivery_midwife", label: "Delivery Midwife", color: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200" },
  { value: "midwife", label: "Midwife", color: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300" },
  { value: "ambulant_gynecologist", label: "Ambulatory Gynecologist", color: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200" },
  { value: "anesthesiologist", label: "Anesthesiologist", color: "bg-neutral-100 text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200" },
  { value: "surgeon", label: "Surgeon", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  { value: "hematologist", label: "Hematologist", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  { value: "oncologist", label: "Oncologist", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  { value: "general_practitioner", label: "General Practitioner", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "pharmacist", label: "Pharmacist", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" },
  { value: "laboratory_specialist", label: "Laboratory Specialist", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "department_nurse", label: "Department Nurse", color: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200" },
  { value: "neonatology_head", label: "Head of Neonatology", color: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200" },
  { value: "neonatology_doctor", label: "Neonatology Doctor", color: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200" },
  { value: "neonatology_nurse", label: "Neonatology Nurse", color: "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300" },
  { value: "prenatal_instructor", label: "Prenatal Instructor", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  { value: "doula", label: "Doula", color: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900 dark:text-fuchsia-200" },
  { value: "lactation_consultant", label: "Lactation Consultant", color: "bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-200" },
  { value: "other_medical", label: "Other Medical Professional", color: "bg-stone-100 text-stone-800 dark:bg-stone-900 dark:text-stone-200" },
  { value: "active_prospect", label: "Active Prospect", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "inactive_prospect", label: "Inactive Prospect", color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200" },
] as const;

const POSITION_SCOPE_BADGE: Record<string, { label: string; className: string }> = {
  hospital: { label: "Hospital", className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800" },
  clinic: { label: "Clinic", className: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800" },
  independent: { label: "Independent", className: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800" },
};

function getLocalizedCatName(cat: any, locale: string): string {
  const localeMap: Record<string, string | null> = {
    sk: cat.nameSk || cat.name_sk, cs: cat.nameCs || cat.name_cs, en: cat.nameEn || cat.name_en,
    hu: cat.nameHu || cat.name_hu, ro: cat.nameRo || cat.name_ro, it: cat.nameIt || cat.name_it, de: cat.nameDe || cat.name_de,
  };
  return localeMap[locale] || cat.name || "";
}

function PartnerCategoryField({ value, onChange, collaboratorId, t, scopeFilter }: {
  value: string;
  onChange: (val: string) => void;
  collaboratorId?: string;
  t: any;
  scopeFilter?: string;
}) {
  const { locale } = useI18n();
  const categoriesQuery = useQuery<any[]>({
    queryKey: ["/api/mpn/categories"],
  });
  const categories = useMemo(() => {
    const all = categoriesQuery.data || [];
    if (!scopeFilter) return all;
    return all.filter((c: any) => (c.entityScope || c.entity_scope) === scopeFilter);
  }, [categoriesQuery.data, scopeFilter]);

  return (
    <div className="space-y-2">
      <Label>{(t as any).medicalPartnerNetwork?.position || "Position"}</Label>
      <Select
        value={value || "_none"}
        onValueChange={(val) => onChange(val === "_none" ? "" : val)}
      >
        <SelectTrigger data-testid="wizard-select-partner-category">
          <SelectValue placeholder={(t as any).medicalPartnerNetwork?.position || "Position"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_none">{t.common.noData}</SelectItem>
          {categories.filter((c: any) => c.isActive !== false && c.is_active !== false).map((cat: any) => {
            const scope = cat.entityScope || cat.entity_scope || "hospital";
            const scopeStyle = POSITION_SCOPE_BADGE[scope] || POSITION_SCOPE_BADGE.hospital;
            const catName = getLocalizedCatName(cat, locale);
            return (
              <SelectItem key={cat.id} value={cat.id}>
                <div className="flex items-center gap-2">
                  <span>{catName}</span>
                  <span className={`inline-flex text-[9px] px-1.5 py-0 rounded-full border font-medium ${scopeStyle.className}`}>
                    {scopeStyle.label}
                  </span>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}

interface CollaboratorFormData {
  legacyId: string;
  countryCode: string;
  countryCodes: string[]; // Multiple countries
  titleBefore: string;
  firstName: string;
  middleName: string;
  lastName: string;
  maidenName: string;
  titleAfter: string;
  birthNumber: string;
  birthDay: number;
  birthMonth: number;
  birthYear: number;
  birthPlace: string;
  healthInsuranceId: string;
  maritalStatus: string;
  professionalClassification: string;
  highestEducation: string;
  workplaceName: string;
  isManager: boolean;
  collaboratorType: string;
  partnerCategory: string;
  agreementType: string;
  cbcActivities: string[];
  phone: string;
  mobile: string;
  mobile2: string;
  otherContact: string;
  email: string;
  bankAccountIban: string;
  swiftCode: string;
  clientContact: boolean;
  representativeId: string; // Legacy
  representativeIds: string[]; // Multiple representatives
  isActive: boolean;
  svetZdravia: boolean;
  companyName: string;
  ico: string;
  dic: string;
  icDph: string;
  companyIban: string;
  companySwift: string;
  monthRewards: boolean;
  rewardType: string; // 'fixed' | 'percentage' | ''
  fixedRewardAmount: string;
  fixedRewardCurrency: string;
  percentageRewards: Record<string, string>; // countryCode -> percentage
  note: string;
  hospitalId: string;
  hospitalIds: string[];
  // Lead source / referral (mirrors clinics)
  leadSource: string;
  leadSourceDate: string;
  leadSourceNotes: string;
  conferenceName: string;
  conferenceDate: string;
  isReferredByDoctor: boolean;
  isFromConference: boolean;
}

interface CollaboratorFormWizardProps {
  initialData?: Collaborator | null;
  onSuccess: () => void;
  onCancel?: () => void;
  positionScopeFilter?: string;
  hideSvetZdravia?: boolean;
  prefillData?: Partial<CollaboratorFormData>;
  onCreated?: (collab: { id: string }) => void | Promise<void>;
}

// Pending address for Add mode (before collaborator is saved)
interface PendingAddress {
  id: string; // temporary local ID
  addressType: string;
  name: string;
  streetNumber: string;
  city: string;
  postalCode: string;
  country: string;
}

// Pending agreement for Add mode (before collaborator is saved)
interface PendingAgreement {
  id: string; // temporary local ID
  billingCompanyId: string;
  contractNumber: string;
  agreementForm: string;
  validFromDay: number | null;
  validFromMonth: number | null;
  validFromYear: number | null;
  validToDay: number | null;
  validToMonth: number | null;
  validToYear: number | null;
  agreementSentDay: number | null;
  agreementSentMonth: number | null;
  agreementSentYear: number | null;
  agreementReturnedDay: number | null;
  agreementReturnedMonth: number | null;
  agreementReturnedYear: number | null;
  isValid: boolean;
  questionnaireReturned: boolean;
  socialInsuranceRegistrationDay: number | null;
  socialInsuranceRegistrationMonth: number | null;
  socialInsuranceRegistrationYear: number | null;
  socialInsuranceCancelDay: number | null;
  socialInsuranceCancelMonth: number | null;
  socialInsuranceCancelYear: number | null;
  note: string;
  notes: string;
}

const WIZARD_STEPS = [
  { id: "personal", icon: User },
  { id: "contact", icon: Phone },
  { id: "banking", icon: CreditCard },
  { id: "agreements", icon: FileText },
  { id: "documents", icon: FolderOpen },
  { id: "actions", icon: Activity },
  { id: "history", icon: History },
  { id: "medicalNetwork", icon: Network },
  { id: "mobile", icon: Smartphone },
];

const INSTITUTION_COLORS = [
  { bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-800", accent: "bg-blue-500", text: "text-blue-700 dark:text-blue-300", badge: "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200" },
  { bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800", accent: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300", badge: "bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200" },
  { bg: "bg-violet-50 dark:bg-violet-950/30", border: "border-violet-200 dark:border-violet-800", accent: "bg-violet-500", text: "text-violet-700 dark:text-violet-300", badge: "bg-violet-100 dark:bg-violet-900 text-violet-800 dark:text-violet-200" },
  { bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800", accent: "bg-amber-500", text: "text-amber-700 dark:text-amber-300", badge: "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200" },
  { bg: "bg-rose-50 dark:bg-rose-950/30", border: "border-rose-200 dark:border-rose-800", accent: "bg-rose-500", text: "text-rose-700 dark:text-rose-300", badge: "bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200" },
  { bg: "bg-cyan-50 dark:bg-cyan-950/30", border: "border-cyan-200 dark:border-cyan-800", accent: "bg-cyan-500", text: "text-cyan-700 dark:text-cyan-300", badge: "bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-200" },
  { bg: "bg-orange-50 dark:bg-orange-950/30", border: "border-orange-200 dark:border-orange-800", accent: "bg-orange-500", text: "text-orange-700 dark:text-orange-300", badge: "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200" },
  { bg: "bg-indigo-50 dark:bg-indigo-950/30", border: "border-indigo-200 dark:border-indigo-800", accent: "bg-indigo-500", text: "text-indigo-700 dark:text-indigo-300", badge: "bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200" },
];

function getColorIndexForEntity(entityId: string): number {
  let hash = 0;
  for (let i = 0; i < entityId.length; i++) {
    hash = ((hash << 5) - hash) + entityId.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % INSTITUTION_COLORS.length;
}

function getLocalizedCategoryName(cat: any, locale: string): string {
  const localeFieldMap: Record<string, string> = { en: "nameEn", sk: "nameSk", cs: "nameCs", hu: "nameHu", ro: "nameRo", it: "nameIt", de: "nameDe" };
  const field = localeFieldMap[locale];
  if (field && cat[field]) return cat[field];
  return cat.name || "";
}

function MedicalNetworkContent({ personId, personName }: { personId: string; personName: string }) {
  const { toast } = useToast();
  const { t, locale } = useI18n();
  const mpnT = (t as any).medicalPartnerNetwork || {};
  const mn = (() => {
    const dict: Record<string, Record<string, string>> = {
      sk: { save: "Uložiť", saved: "Zaradenie aktualizované", saveError: "Chyba pri ukladaní", loadError: "Chyba pri načítaní", loadErrorDesc: "Nepodarilo sa načítať zaradenia. Skúste to znova neskôr.", subcategory: "Podkategória", note: "Poznámka", noAssignment: "Žiadne zaradenie", noAssignmentDesc: "nie je zaradený/á v žiadnej nemocnici ani ambulancii. Zaradenie je možné pridať cez záložku Personál v karte nemocnice alebo ambulancie.", hospital: "Nemocnica", clinic: "Ambulancia", category: "Kategória", department: "Oddelenie", position: "Pozícia", role: "Rola", from: "Od", to: "Do", active: "aktívne", inactive: "Neaktívne zaradenia", cancel: "Zrušiť", assignment_1: "zaradenie", assignment_few: "zaradenia", assignment_many: "zaradení" },
      cs: { save: "Uložit", saved: "Zařazení aktualizováno", saveError: "Chyba při ukládání", loadError: "Chyba při načítání", loadErrorDesc: "Nepodařilo se načíst zařazení. Zkuste to znovu později.", subcategory: "Podkategorie", note: "Poznámka", noAssignment: "Žádné zařazení", noAssignmentDesc: "není zařazen/a v žádné nemocnici ani ambulanci. Zařazení je možné přidat přes záložku Personál v kartě nemocnice nebo ambulance.", hospital: "Nemocnice", clinic: "Ambulance", category: "Kategorie", department: "Oddělení", position: "Pozice", role: "Role", from: "Od", to: "Do", active: "aktivní", inactive: "Neaktivní zařazení", cancel: "Zrušit", assignment_1: "zařazení", assignment_few: "zařazení", assignment_many: "zařazení" },
      en: { save: "Save", saved: "Assignment updated", saveError: "Error saving", loadError: "Failed to load", loadErrorDesc: "Could not load assignments. Please try again later.", subcategory: "Subcategory", note: "Note", noAssignment: "No assignments", noAssignmentDesc: "is not assigned to any hospital or clinic. You can add an assignment via the Personnel tab in the hospital or clinic card.", hospital: "Hospital", clinic: "Clinic", category: "Category", department: "Department", position: "Position", role: "Role", from: "From", to: "To", active: "active", inactive: "Inactive assignments", cancel: "Cancel", assignment_1: "assignment", assignment_few: "assignments", assignment_many: "assignments" },
      hu: { save: "Mentés", saved: "Hozzárendelés frissítve", saveError: "Mentési hiba", loadError: "Betöltési hiba", loadErrorDesc: "Nem sikerült betölteni a hozzárendeléseket. Próbálja újra később.", subcategory: "Alkategória", note: "Megjegyzés", noAssignment: "Nincs hozzárendelés", noAssignmentDesc: "nincs hozzárendelve egyetlen kórházhoz vagy rendelőhöz sem. Hozzárendelést a kórház vagy rendelő kártyájának Személyzet fülén lehet hozzáadni.", hospital: "Kórház", clinic: "Rendelő", category: "Kategória", department: "Osztály", position: "Pozíció", role: "Szerep", from: "Tól", to: "Ig", active: "aktív", inactive: "Inaktív hozzárendelések", cancel: "Mégse", assignment_1: "hozzárendelés", assignment_few: "hozzárendelés", assignment_many: "hozzárendelés" },
      ro: { save: "Salvează", saved: "Atribuire actualizată", saveError: "Eroare la salvare", loadError: "Eroare la încărcare", loadErrorDesc: "Nu s-au putut încărca atribuirile. Încercați din nou mai târziu.", subcategory: "Subcategorie", note: "Notă", noAssignment: "Fără atribuiri", noAssignmentDesc: "nu este atribuit la niciun spital sau clinică. Puteți adăuga o atribuire prin fila Personal din cardul spitalului sau clinicii.", hospital: "Spital", clinic: "Clinică", category: "Categorie", department: "Departament", position: "Poziție", role: "Rol", from: "De la", to: "Până la", active: "activ", inactive: "Atribuiri inactive", cancel: "Anulează", assignment_1: "atribuire", assignment_few: "atribuiri", assignment_many: "atribuiri" },
      it: { save: "Salva", saved: "Assegnazione aggiornata", saveError: "Errore durante il salvataggio", loadError: "Errore di caricamento", loadErrorDesc: "Impossibile caricare le assegnazioni. Riprovare più tardi.", subcategory: "Sottocategoria", note: "Nota", noAssignment: "Nessuna assegnazione", noAssignmentDesc: "non è assegnato a nessun ospedale o clinica. Puoi aggiungere un'assegnazione tramite la scheda Personale nella scheda dell'ospedale o della clinica.", hospital: "Ospedale", clinic: "Clinica", category: "Categoria", department: "Reparto", position: "Posizione", role: "Ruolo", from: "Da", to: "A", active: "attivo", inactive: "Assegnazioni inattive", cancel: "Annulla", assignment_1: "assegnazione", assignment_few: "assegnazioni", assignment_many: "assegnazioni" },
      de: { save: "Speichern", saved: "Zuordnung aktualisiert", saveError: "Fehler beim Speichern", loadError: "Fehler beim Laden", loadErrorDesc: "Zuordnungen konnten nicht geladen werden. Bitte später erneut versuchen.", subcategory: "Unterkategorie", note: "Notiz", noAssignment: "Keine Zuordnungen", noAssignmentDesc: "ist keinem Krankenhaus oder keiner Praxis zugeordnet. Eine Zuordnung kann über den Reiter Personal in der Krankenhaus- oder Praxiskarte hinzugefügt werden.", hospital: "Krankenhaus", clinic: "Praxis", category: "Kategorie", department: "Abteilung", position: "Position", role: "Rolle", from: "Von", to: "Bis", active: "aktiv", inactive: "Inaktive Zuordnungen", cancel: "Abbrechen", assignment_1: "Zuordnung", assignment_few: "Zuordnungen", assignment_many: "Zuordnungen" },
    };
    return dict[locale] || dict.en;
  })();
  const pluralAssignment = (n: number) => n === 1 ? mn.assignment_1 : (n < 5 ? mn.assignment_few : mn.assignment_many);
  const localizePosition = (a: any) => {
    if (a.category_id) {
      const cat = (categoriesQuery.data || []).find((c: any) => c.id === a.category_id);
      if (cat) return getLocalizedCategoryName(cat, locale);
    }
    return a.position || "";
  };
  const { data: assignments, isLoading, isError } = useQuery<any[]>({
    queryKey: ["/api/mpn/person", personId, "assignments"],
    queryFn: async () => {
      const res = await fetch(`/api/mpn/person/${personId}/assignments`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch assignments");
      return res.json();
    },
    enabled: !!personId,
  });

  const categoriesQuery = useQuery<any[]>({
    queryKey: ["/api/mpn/categories"],
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{
    department: string; position: string; role: string;
    categoryId: string; notes: string; isPrimary: boolean; isActive: boolean;
  }>({ department: "", position: "", role: "", categoryId: "", notes: "", isPrimary: false, isActive: true });
  const [saving, setSaving] = useState(false);
  const [entityDrawer, setEntityDrawer] = useState<{ type: "hospital" | "clinic"; id: string; name: string } | null>(null);
  const { data: entityDetail, isLoading: entityLoading } = useQuery<any>({
    queryKey: [entityDrawer ? `/api/${entityDrawer.type === "hospital" ? "hospitals" : "clinics"}/${entityDrawer.id}` : "_none"],
    enabled: !!entityDrawer,
  });

  const startEdit = (a: any) => {
    setEditingId(a.id);
    setEditData({
      department: a.department || "",
      position: a.position || "",
      role: a.role || "",
      categoryId: a.category_id || "",
      notes: a.notes || "",
      isPrimary: !!a.is_primary,
      isActive: a.is_active !== false,
    });
  };

  const cancelEdit = () => { setEditingId(null); };

  const saveEdit = async (assignment: any) => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/institutions/${assignment.entity_type}/${assignment.entity_id}/personnel/${assignment.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            department: editData.department || null,
            position: editData.position || null,
            role: editData.role || null,
            categoryId: editData.categoryId && editData.categoryId !== "_none" ? editData.categoryId : null,
            notes: editData.notes || null,
            isPrimary: editData.isPrimary,
            isActive: editData.isActive,
          }),
        }
      );
      if (!res.ok) throw new Error("Failed to update");
      toast({ title: mn.saved });
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/mpn/person", personId, "assignments"] });
    } catch {
      toast({ title: mn.saveError, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center mb-4">
          <Network className="h-8 w-8 text-red-400" />
        </div>
        <h3 className="font-medium text-lg mb-1">{mn.loadError}</h3>
        <p className="text-sm text-muted-foreground">{mn.loadErrorDesc}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => (
          <div key={i} className="rounded-lg border p-4 space-y-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!assignments || assignments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Network className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-medium text-lg mb-1">{mn.noAssignment}</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          {personName} {mn.noAssignmentDesc}
        </p>
      </div>
    );
  }

  const activeAssignments = assignments.filter((a: any) => a.is_active !== false);
  const inactiveAssignments = assignments.filter((a: any) => a.is_active === false);

  const renderAssignmentCard = (assignment: any) => {
    const colors = INSTITUTION_COLORS[getColorIndexForEntity(assignment.entity_id)];
    const isHospitalType = assignment.entity_type === "hospital";
    const EntityIcon = isHospitalType ? HospitalIcon : Building2;
    const isEditing = editingId === assignment.id;

    return (
      <div
        key={assignment.id}
        className={cn("relative rounded-lg border-2 overflow-hidden transition-all", colors.border, colors.bg, !isEditing && "cursor-pointer hover:shadow-md hover:border-primary/40")}
        data-testid={`medical-network-card-${assignment.id}`}
        onClick={(e) => {
          if (isEditing) return;
          const target = e.target as HTMLElement;
          if (target.closest("button")) return;
          if (assignment.entity_type === "hospital" || assignment.entity_type === "clinic") {
            setEntityDrawer({ type: assignment.entity_type, id: assignment.entity_id, name: assignment.entity_name });
          }
        }}
      >
        <div className={cn("absolute left-0 top-0 bottom-0 w-1.5", colors.accent)} />
        <div className="pl-5 pr-4 py-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={cn("shrink-0 w-9 h-9 rounded-lg flex items-center justify-center", colors.badge)}>
                <EntityIcon className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <h4 className="font-semibold text-sm leading-tight truncate" data-testid={`medical-network-name-${assignment.id}`}>
                  {assignment.entity_name || "—"}
                </h4>
                {assignment.entity_city && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3" />
                    {assignment.entity_city}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Badge variant="outline" className={cn("text-[10px] font-medium px-1.5 py-0", colors.badge)}>
                {isHospitalType ? mn.hospital : mn.clinic}
              </Badge>
            </div>
          </div>

          {isEditing ? (
            <div className="space-y-3 mt-1">
              <div className="space-y-1">
                <Label className="text-xs">{mpnT?.position || "Position"}</Label>
                <Select value={editData.categoryId || "_none"} onValueChange={v => setEditData({ ...editData, categoryId: v })}>
                  <SelectTrigger className="h-8 text-xs" data-testid={`medical-network-edit-category-${assignment.id}`}>
                    <SelectValue placeholder="-" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— {t.common?.none || "None"} —</SelectItem>
                    {(categoriesQuery.data || []).map((cat: any) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <span className="flex items-center gap-2">
                          {getLocalizedCategoryName ? getLocalizedCategoryName(cat, locale) : cat.name}
                          {cat.entityScope && <Badge variant="outline" className={`text-[9px] px-1.5 py-0 leading-tight ${cat.entityScope === 'hospital' ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800' : cat.entityScope === 'clinic' ? 'bg-green-50 text-green-600 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800' : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'}`}>{cat.entityScope === 'hospital' ? 'Hospital' : cat.entityScope === 'clinic' ? 'Clinic' : 'Independent'}</Badge>}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{mpnT?.notes || "Notes"}</Label>
                <Textarea
                  value={editData.notes}
                  onChange={e => setEditData({ ...editData, notes: e.target.value })}
                  placeholder={mpnT?.notesPlaceholder || "Note..."}
                  className="text-xs min-h-[60px]"
                  data-testid={`medical-network-edit-notes-${assignment.id}`}
                />
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={editData.isActive}
                    onCheckedChange={(v: boolean) => setEditData({ ...editData, isActive: v })}
                    data-testid={`medical-network-edit-active-${assignment.id}`}
                  />
                  {t.common?.active || "Active"}
                </label>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  className="h-7 text-xs px-3"
                  onClick={() => saveEdit(assignment)}
                  disabled={saving}
                  data-testid={`medical-network-save-${assignment.id}`}
                >
                  {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                  {mn.save}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-3"
                  onClick={cancelEdit}
                  disabled={saving}
                  data-testid={`medical-network-cancel-${assignment.id}`}
                >
                  {mn.cancel}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                {assignment.category_name && (
                  <div>
                    <span className="text-muted-foreground">{mn.category}:</span>
                    <span className="ml-1 font-medium">{(() => { const cat = (categoriesQuery.data || []).find((c: any) => c.id === assignment.category_id); return cat ? getLocalizedCategoryName(cat, locale) : assignment.category_name; })()}</span>
                  </div>
                )}
                {assignment.department && (
                  <div>
                    <span className="text-muted-foreground">{mn.department}:</span>
                    <span className="ml-1 font-medium">{assignment.department}</span>
                  </div>
                )}
                {assignment.position && (
                  <div>
                    <span className="text-muted-foreground">{mn.position}:</span>
                    <span className="ml-1 font-medium">{localizePosition(assignment)}</span>
                  </div>
                )}
                {assignment.role && (
                  <div>
                    <span className="text-muted-foreground">{mn.role}:</span>
                    <span className="ml-1 font-medium">{assignment.role}</span>
                  </div>
                )}
                {assignment.subcategory && (
                  <div>
                    <span className="text-muted-foreground">{mn.subcategory}:</span>
                    <span className="ml-1 font-medium">{assignment.subcategory}</span>
                  </div>
                )}
              </div>

              {assignment.notes && (
                <div className="mt-2.5 text-xs bg-white/60 dark:bg-black/20 rounded px-2.5 py-1.5 border border-dashed border-muted-foreground/20">
                  <span className="text-muted-foreground">{mn.note}: </span>
                  <span>{assignment.notes}</span>
                </div>
              )}

              {(assignment.start_date || assignment.end_date) && (
                <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {assignment.start_date && <span>{mn.from}: {new Date(assignment.start_date).toLocaleDateString(locale === "en" ? "en-GB" : `${locale}-${locale.toUpperCase()}`)}</span>}
                  {assignment.end_date && <span>{mn.to}: {new Date(assignment.end_date).toLocaleDateString(locale === "en" ? "en-GB" : `${locale}-${locale.toUpperCase()}`)}</span>}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4" data-testid="medical-network-tab">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {assignments.length} {pluralAssignment(assignments.length)}
          </Badge>
          {activeAssignments.length > 0 && (
            <Badge variant="outline" className="text-xs text-green-600 border-green-300">
              {activeAssignments.length} {mn.active}
            </Badge>
          )}
        </div>
      </div>

      {activeAssignments.length > 0 && (
        <div className="space-y-3">
          {activeAssignments.map((a: any) => renderAssignmentCard(a))}
        </div>
      )}

      {inactiveAssignments.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-2">{mn.inactive}</h4>
          {inactiveAssignments.map((a: any) => (
            <div key={a.id} className="opacity-50">
              {renderAssignmentCard(a)}
            </div>
          ))}
        </div>
      )}

      {entityDrawer && entityLoading && (
        <Sheet open={true} onOpenChange={() => setEntityDrawer(null)}>
          <SheetContent className="sm:max-w-xl">
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          </SheetContent>
        </Sheet>
      )}
      {entityDrawer && !entityLoading && entityDetail && entityDrawer.type === "clinic" && (
        <ClinicFormSheet
          open={true}
          onOpenChange={(open) => { if (!open) setEntityDrawer(null); }}
          initialData={entityDetail}
          onSuccess={() => {
            setEntityDrawer(null);
            queryClient.invalidateQueries({ queryKey: ["/api/mpn/person", personId, "assignments"] });
          }}
        />
      )}
      {entityDrawer && !entityLoading && entityDetail && entityDrawer.type === "hospital" && (
        <HospitalEditDrawer
          hospital={entityDetail}
          onClose={() => setEntityDrawer(null)}
          onSuccess={() => {
            setEntityDrawer(null);
            queryClient.invalidateQueries({ queryKey: ["/api/mpn/person", personId, "assignments"] });
          }}
        />
      )}
    </div>
  );
}

// Pending Addresses component for Add mode
function PendingAddressesContent({ 
  pendingAddresses, 
  setPendingAddresses, 
  countryCode,
  collaboratorName,
  t 
}: { 
  pendingAddresses: PendingAddress[]; 
  setPendingAddresses: (addresses: PendingAddress[]) => void;
  countryCode: string;
  collaboratorName: string;
  t: any;
}) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  
  const toggleSection = (type: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  };

  const getAddressByType = (type: string) => pendingAddresses.find(a => a.addressType === type);

  const updateAddress = (type: string, field: keyof PendingAddress, value: string) => {
    const existing = pendingAddresses.find(a => a.addressType === type);
    if (existing) {
      setPendingAddresses(pendingAddresses.map(a => 
        a.addressType === type ? { ...a, [field]: value } : a
      ));
    } else {
      setPendingAddresses([...pendingAddresses, {
        id: `pending-${type}-${Date.now()}`,
        addressType: type,
        name: field === "name" ? value : "",
        streetNumber: field === "streetNumber" ? value : "",
        city: field === "city" ? value : "",
        postalCode: field === "postalCode" ? value : "",
        country: field === "country" ? value : countryCode,
      }]);
    }
  };

  const copyName = (type: string) => {
    updateAddress(type, "name", collaboratorName);
  };

  return (
    <div className="space-y-4">
      {NON_COMPANY_ADDRESS_TYPES.map(({ value, labelKey }) => {
        const address = getAddressByType(value);
        const isExpanded = expandedSections.has(value);
        
        return (
          <Collapsible key={value} open={isExpanded} onOpenChange={() => toggleSection(value)}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover-elevate">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span className="font-medium">
                        {(t.collaborators.addressTabs as Record<string, string>)[labelKey]}
                      </span>
                      {address && (address.city || address.streetNumber) && (
                        <Badge variant="outline" className="ml-2">
                          {address.city || address.streetNumber || t.common.filled}
                        </Badge>
                      )}
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>{t.collaborators.fields.name || "Name"}</Label>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6"
                        onClick={() => copyName(value)}
                        data-testid={`button-copy-name-${value}`}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <Input
                      value={address?.name || ""}
                      onChange={(e) => updateAddress(value, "name", e.target.value)}
                      data-testid={`input-pending-address-name-${value}`}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t.collaborators.fields.streetNumber}</Label>
                      <Input
                        value={address?.streetNumber || ""}
                        onChange={(e) => updateAddress(value, "streetNumber", e.target.value)}
                        data-testid={`input-pending-address-street-${value}`}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t.collaborators.fields.city}</Label>
                      <Input
                        value={address?.city || ""}
                        onChange={(e) => updateAddress(value, "city", e.target.value)}
                        data-testid={`input-pending-address-city-${value}`}
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t.collaborators.fields.postalCode}</Label>
                      <Input
                        value={address?.postalCode || ""}
                        onChange={(e) => updateAddress(value, "postalCode", e.target.value)}
                        data-testid={`input-pending-address-postal-${value}`}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t.collaborators.fields.country}</Label>
                      <Select
                        value={address?.country || countryCode}
                        onValueChange={(val) => updateAddress(value, "country", val)}
                      >
                        <SelectTrigger data-testid={`select-pending-address-country-${value}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COUNTRIES.map((country) => (
                            <SelectItem key={country.code} value={country.code}>
                              {getCountryFlag(country.code)} {country.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
    </div>
  );
}

// Hospitals & Clinics Multi-Select with search and badges
function HospitalsMultiSelect({
  hospitals,
  selectedIds,
  onChange,
  label,
  t
}: {
  hospitals: Hospital[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  label: string;
  t: any;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  
  const filteredList = searchQuery
    ? hospitals.filter(h => h.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : hospitals;

  const selectedHospitals = hospitals.filter(h => selectedIds.includes(h.id));

  const handleToggle = (id: string, checked: boolean) => {
    if (checked) {
      onChange([...selectedIds, id]);
    } else {
      onChange(selectedIds.filter(i => i !== id));
    }
  };

  const handleRemove = (id: string) => {
    onChange(selectedIds.filter(i => i !== id));
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between font-normal"
            data-testid="wizard-select-collaborator-hospitals"
          >
            {selectedIds.length > 0
              ? `${selectedIds.length} ${t.common?.selected || "selected"}`
              : t.common?.noData || "None"}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-3">
          <div className="space-y-3">
            <Input
              placeholder={t.common?.search || "Search..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8"
              data-testid="input-search-hospitals"
            />
            <div className="max-h-48 overflow-y-auto space-y-1">
              {filteredList.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  {t.common?.noData || "No hospitals found"}
                </p>
              ) : (
                filteredList.map((h) => (
                  <div key={h.id} className="flex items-center gap-2 py-1">
                    <Checkbox
                      id={`hospital-${h.id}`}
                      checked={selectedIds.includes(h.id)}
                      onCheckedChange={(checked) => handleToggle(h.id, !!checked)}
                    />
                    <label htmlFor={`hospital-${h.id}`} className="text-sm cursor-pointer flex-1 truncate">
                      {h.name}
                    </label>
                  </div>
                ))
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {selectedHospitals.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {selectedHospitals.map((h) => (
            <Badge key={h.id} variant="secondary" className="gap-1 text-xs">
              {h.name}
              <X 
                className="h-3 w-3 cursor-pointer hover:text-destructive" 
                onClick={() => handleRemove(h.id)}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// Hospitals/Clinics card-style selector with searchable add popover
function HospitalsCardsSelect({
  hospitals,
  selectedIds,
  onChange,
  label,
  t,
  locale,
}: {
  hospitals: Hospital[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  label: string;
  t: any;
  locale: string;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [open, setOpen] = useState(false);

  const selectedHospitals = hospitals.filter(h => selectedIds.includes(h.id));
  const availableHospitals = hospitals.filter(h => !selectedIds.includes(h.id));
  const filteredAvailable = searchQuery
    ? availableHospitals.filter(h => h.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : availableHospitals;

  const handleAdd = (id: string) => {
    onChange([...selectedIds, id]);
  };
  const handleRemove = (id: string) => {
    onChange(selectedIds.filter(i => i !== id));
  };

  const addLabel: Record<string, string> = {
    sk: "Pridať nemocnicu / ambulanciu",
    cs: "Přidat nemocnici / ambulanci",
    en: "Add hospital / clinic",
    hu: "Kórház / rendelő hozzáadása",
    ro: "Adaugă spital / clinică",
    it: "Aggiungi ospedale / clinica",
    de: "Krankenhaus / Praxis hinzufügen",
  };
  const emptyLabel: Record<string, string> = {
    sk: "Žiadne pridané",
    cs: "Žádné přidané",
    en: "None added",
    hu: "Nincs hozzáadva",
    ro: "Niciuna adăugată",
    it: "Nessuno aggiunto",
    de: "Keine hinzugefügt",
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs"
              data-testid="button-add-hospital-card"
            >
              <Plus className="h-3.5 w-3.5" />
              {addLabel[locale] || addLabel.en}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3" align="end">
            <div className="space-y-3">
              <Input
                placeholder={t.common?.search || "Search..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8"
                data-testid="input-search-hospitals-cards"
              />
              <div className="max-h-60 overflow-y-auto space-y-1">
                {filteredAvailable.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    {t.common?.noData || "No hospitals found"}
                  </p>
                ) : (
                  filteredAvailable.map((h) => (
                    <button
                      type="button"
                      key={h.id}
                      onClick={() => {
                        handleAdd(h.id);
                        setSearchQuery("");
                      }}
                      className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted truncate"
                      data-testid={`option-add-hospital-${h.id}`}
                    >
                      {h.name}
                    </button>
                  ))
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {selectedHospitals.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          {emptyLabel[locale] || emptyLabel.en}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {selectedHospitals.map((h) => {
            const colorIdx = getColorIndexForEntity(h.id);
            const c = INSTITUTION_COLORS[colorIdx];
            const typeStr = String((h as any).hospitalType || (h as any).type || "").toLowerCase();
            const isClinic = typeStr.includes("clinic") || typeStr.includes("ambul");
            const Icon = isClinic ? Stethoscope : HospitalIcon;
            const city = (h as any).city || "";
            return (
              <div
                key={h.id}
                className={cn("relative rounded-lg border p-3 flex items-start gap-2.5", c.bg, c.border)}
                data-testid={`card-hospital-${h.id}`}
              >
                <div className={cn("h-8 w-8 rounded-md flex items-center justify-center shrink-0", c.accent)}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0 pr-6">
                  <div className={cn("text-sm font-medium truncate", c.text)} title={h.name}>
                    {h.name}
                  </div>
                  {city && (
                    <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {city}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(h.id)}
                  className="absolute top-1.5 right-1.5 h-5 w-5 rounded hover:bg-background/60 flex items-center justify-center text-muted-foreground hover:text-destructive"
                  data-testid={`button-remove-hospital-${h.id}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Representatives Multi-Select with search and badges
function RepresentativesMultiSelect({
  users,
  selectedIds,
  onChange,
  label,
  t
}: {
  users: SafeUser[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  label: string;
  t: any;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  
  const filteredList = searchQuery
    ? users.filter(u => u.fullName.toLowerCase().includes(searchQuery.toLowerCase()))
    : users;

  const selectedUsers = users.filter(u => selectedIds.includes(u.id));

  const handleToggle = (id: string, checked: boolean) => {
    if (checked) {
      onChange([...selectedIds, id]);
    } else {
      onChange(selectedIds.filter(i => i !== id));
    }
  };

  const handleRemove = (id: string) => {
    onChange(selectedIds.filter(i => i !== id));
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between font-normal"
            data-testid="wizard-select-collaborator-representatives"
          >
            {selectedIds.length > 0
              ? `${selectedIds.length} ${t.common.selected}`
              : t.common.noData}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-3">
          <div className="space-y-3">
            <Input
              placeholder={t.common.search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8"
              data-testid="input-search-representatives"
            />
            <div className="max-h-48 overflow-y-auto space-y-1">
              {filteredList.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  {t.common.noData}
                </p>
              ) : (
                filteredList.map((u) => (
                  <div key={u.id} className="flex items-center gap-2 py-1">
                    <Checkbox
                      id={`rep-${u.id}`}
                      checked={selectedIds.includes(u.id)}
                      onCheckedChange={(checked) => handleToggle(u.id, !!checked)}
                    />
                    <label htmlFor={`rep-${u.id}`} className="text-sm cursor-pointer flex-1 truncate">
                      {u.fullName}
                    </label>
                  </div>
                ))
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {selectedUsers.map((u) => (
            <Badge key={u.id} variant="secondary" className="gap-1 text-xs">
              {u.fullName}
              <X 
                className="h-3 w-3 cursor-pointer hover:text-destructive" 
                onClick={() => handleRemove(u.id)}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// Pending Agreements component for Add mode
function PendingAgreementsContent({ 
  pendingAgreements, 
  setPendingAgreements,
  countryCode,
  t 
}: { 
  pendingAgreements: PendingAgreement[]; 
  setPendingAgreements: (agreements: PendingAgreement[]) => void;
  countryCode: string;
  t: any;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const { data: billingCompanies = [] } = useQuery<BillingDetails[]>({
    queryKey: ["/api/billing-details", countryCode],
    queryFn: async () => {
      const res = await fetch(`/api/billing-details?country=${countryCode}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!countryCode,
  });

  const AGREEMENT_FORM_TYPES = [
    { value: "dohoda_o_vykonani_prace", labelKey: "dohoda_o_vykonani_prace" },
    { value: "zmluva_o_dielo_podnikatel", labelKey: "zmluva_o_dielo_podnikatel" },
    { value: "zmluva_o_dielo_fyzicka_osoba", labelKey: "zmluva_o_dielo_fyzicka_osoba" },
  ];

  const formatDate = (day: number | null, month: number | null, year: number | null) => {
    if (!day || !month || !year) return t.common.noData;
    return `${day}.${month}.${year}`;
  };

  const isAgreementExpired = (day: number | null | undefined, month: number | null | undefined, year: number | null | undefined) => {
    if (!day || !month || !year) return false;
    const validToDate = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return validToDate < today;
  };

  const getBillingCompanyName = (id: string | null) => {
    if (!id) return t.common.noData;
    return billingCompanies.find((bc) => bc.id === id)?.companyName || t.common.noData;
  };

  const handleDelete = (id: string) => {
    setPendingAgreements(pendingAgreements.filter(a => a.id !== id));
  };

  if (isAdding || editingId) {
    const editingAgreement = editingId ? pendingAgreements.find(a => a.id === editingId) : undefined;
    return (
      <PendingAgreementForm
        agreement={editingAgreement}
        billingCompanies={billingCompanies}
        agreementFormTypes={AGREEMENT_FORM_TYPES}
        onSave={(agreement) => {
          if (editingId) {
            setPendingAgreements(pendingAgreements.map(a => a.id === editingId ? agreement : a));
          } else {
            setPendingAgreements([...pendingAgreements, { ...agreement, id: `pending-${Date.now()}` }]);
          }
          setIsAdding(false);
          setEditingId(null);
        }}
        onCancel={() => {
          setIsAdding(false);
          setEditingId(null);
        }}
        t={t}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setIsAdding(true)} data-testid="button-add-pending-agreement">
          <Plus className="h-4 w-4 mr-2" />
          {t.common.add}
        </Button>
      </div>
      {pendingAgreements.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">{t.common.noData}</div>
      ) : (
        <div className="space-y-2">
          {pendingAgreements.map((agreement) => (
            <Card key={agreement.id}>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">{t.collaborators?.fields?.billingCompany}: </span>
                        {getBillingCompanyName(agreement.billingCompanyId)}
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t.collaborators?.fields?.contractNumber}: </span>
                        {agreement.contractNumber || t.common.noData}
                      </div>
                      <div>
                        {isAgreementExpired(agreement.validToDay, agreement.validToMonth, agreement.validToYear) ? (
                          <Badge variant="destructive">
                            {t.collaborators.expiredAgreement}
                          </Badge>
                        ) : (
                          <Badge variant={agreement.isValid ? "default" : "secondary"}>
                            {agreement.isValid ? t.common.active : t.common.inactive}
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button size="icon" variant="ghost" onClick={() => setEditingId(agreement.id)} data-testid={`button-edit-pending-agreement-${agreement.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(agreement.id)} data-testid={`button-delete-pending-agreement-${agreement.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">{t.collaborators?.fields?.validFrom}: </span>
                      {formatDate(agreement.validFromDay, agreement.validFromMonth, agreement.validFromYear)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t.collaborators?.fields?.validTo}: </span>
                      {formatDate(agreement.validToDay, agreement.validToMonth, agreement.validToYear)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Pending Agreement Form for Add mode
function PendingAgreementForm({
  agreement,
  billingCompanies,
  agreementFormTypes,
  onSave,
  onCancel,
  t,
}: {
  agreement?: PendingAgreement;
  billingCompanies: BillingDetails[];
  agreementFormTypes: { value: string; labelKey: string }[];
  onSave: (agreement: PendingAgreement) => void;
  onCancel: () => void;
  t: any;
}) {
  const [formData, setFormData] = useState<Omit<PendingAgreement, "id">>({
    billingCompanyId: agreement?.billingCompanyId || "",
    contractNumber: agreement?.contractNumber || "",
    agreementForm: agreement?.agreementForm || "",
    validFromDay: agreement?.validFromDay || null,
    validFromMonth: agreement?.validFromMonth || null,
    validFromYear: agreement?.validFromYear || null,
    validToDay: agreement?.validToDay || null,
    validToMonth: agreement?.validToMonth || null,
    validToYear: agreement?.validToYear || null,
    agreementSentDay: agreement?.agreementSentDay || null,
    agreementSentMonth: agreement?.agreementSentMonth || null,
    agreementSentYear: agreement?.agreementSentYear || null,
    agreementReturnedDay: agreement?.agreementReturnedDay || null,
    agreementReturnedMonth: agreement?.agreementReturnedMonth || null,
    agreementReturnedYear: agreement?.agreementReturnedYear || null,
    isValid: agreement?.isValid ?? true,
    questionnaireReturned: (agreement as any)?.questionnaireReturned ?? false,
    socialInsuranceRegistrationDay: (agreement as any)?.socialInsuranceRegistrationDay || null,
    socialInsuranceRegistrationMonth: (agreement as any)?.socialInsuranceRegistrationMonth || null,
    socialInsuranceRegistrationYear: (agreement as any)?.socialInsuranceRegistrationYear || null,
    socialInsuranceCancelDay: (agreement as any)?.socialInsuranceCancelDay || null,
    socialInsuranceCancelMonth: (agreement as any)?.socialInsuranceCancelMonth || null,
    socialInsuranceCancelYear: (agreement as any)?.socialInsuranceCancelYear || null,
    note: (agreement as any)?.note || "",
    notes: agreement?.notes || "",
  });

  const setToday = (prefix: "validFrom" | "validTo" | "agreementSent" | "agreementReturned" | "socialInsuranceRegistration" | "socialInsuranceCancel") => {
    const today = new Date();
    setFormData({
      ...formData,
      [`${prefix}Day`]: today.getDate(),
      [`${prefix}Month`]: today.getMonth() + 1,
      [`${prefix}Year`]: today.getFullYear(),
    });
  };

  const handleSubmit = () => {
    onSave({
      id: agreement?.id || `pending-${Date.now()}`,
      ...formData,
    });
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t.collaborators?.fields?.billingCompany}</Label>
            <Select
              value={formData.billingCompanyId}
              onValueChange={(val) => setFormData({ ...formData, billingCompanyId: val })}
            >
              <SelectTrigger data-testid="select-pending-billing-company">
                <SelectValue placeholder={t.collaborators?.fields?.billingCompany} />
              </SelectTrigger>
              <SelectContent>
                {billingCompanies.map((bc) => (
                  <SelectItem key={bc.id} value={bc.id}>{bc.companyName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t.collaborators?.fields?.contractNumber}</Label>
            <Input
              value={formData.contractNumber}
              onChange={(e) => setFormData({ ...formData, contractNumber: e.target.value })}
              data-testid="input-pending-contract-number"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t.collaborators?.agreementFormTypes?.label || "Agreement Form"}</Label>
            <Select
              value={formData.agreementForm}
              onValueChange={(val) => setFormData({ ...formData, agreementForm: val })}
            >
              <SelectTrigger data-testid="select-pending-agreement-form">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {agreementFormTypes.map((af) => (
                  <SelectItem key={af.value} value={af.value}>
                    {(t.collaborators?.agreementFormTypes as Record<string, string>)?.[af.labelKey] || af.labelKey}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 flex items-center gap-2 pt-6">
            <Switch
              checked={formData.isValid}
              onCheckedChange={(val) => setFormData({ ...formData, isValid: val })}
              data-testid="switch-pending-is-valid"
            />
            <Label>{t.common.active}</Label>
          </div>
        </div>

        <Separator />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>{t.collaborators?.fields?.validFrom}</Label>
              <Button type="button" variant="ghost" size="sm" onClick={() => setToday("validFrom")} data-testid="button-pending-today-valid-from">
                {t.common?.today || "Today"}
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Input
                type="number"
                placeholder={t.common?.day || "Day"}
                value={formData.validFromDay || ""}
                onChange={(e) => setFormData({ ...formData, validFromDay: e.target.value ? parseInt(e.target.value) : null })}
                data-testid="input-pending-valid-from-day"
              />
              <Input
                type="number"
                placeholder={t.common?.month || "Month"}
                value={formData.validFromMonth || ""}
                onChange={(e) => setFormData({ ...formData, validFromMonth: e.target.value ? parseInt(e.target.value) : null })}
                data-testid="input-pending-valid-from-month"
              />
              <Input
                type="number"
                placeholder={t.common?.year || "Year"}
                value={formData.validFromYear || ""}
                onChange={(e) => setFormData({ ...formData, validFromYear: e.target.value ? parseInt(e.target.value) : null })}
                data-testid="input-pending-valid-from-year"
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>{t.collaborators?.fields?.validTo}</Label>
              <Button type="button" variant="ghost" size="sm" onClick={() => setToday("validTo")} data-testid="button-pending-today-valid-to">
                {t.common?.today || "Today"}
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Input
                type="number"
                placeholder={t.common?.day || "Day"}
                value={formData.validToDay || ""}
                onChange={(e) => setFormData({ ...formData, validToDay: e.target.value ? parseInt(e.target.value) : null })}
                data-testid="input-pending-valid-to-day"
              />
              <Input
                type="number"
                placeholder={t.common?.month || "Month"}
                value={formData.validToMonth || ""}
                onChange={(e) => setFormData({ ...formData, validToMonth: e.target.value ? parseInt(e.target.value) : null })}
                data-testid="input-pending-valid-to-month"
              />
              <Input
                type="number"
                placeholder={t.common?.year || "Year"}
                value={formData.validToYear || ""}
                onChange={(e) => setFormData({ ...formData, validToYear: e.target.value ? parseInt(e.target.value) : null })}
                data-testid="input-pending-valid-to-year"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center space-x-2">
            <Switch
              checked={formData.isValid}
              onCheckedChange={(checked) => setFormData({ ...formData, isValid: checked })}
              data-testid="switch-pending-is-valid"
            />
            <Label>{t.collaborators?.fields?.isValid || "Platná"}</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              checked={formData.questionnaireReturned}
              onCheckedChange={(checked) => setFormData({ ...formData, questionnaireReturned: checked })}
              data-testid="switch-pending-questionnaire-returned"
            />
            <Label>{t.collaborators?.fields?.questionnaireReturned || "Dotazník vrátený"}</Label>
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t.collaborators?.fields?.note || "Poznámka"}</Label>
          <Textarea
            value={formData.note}
            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
            data-testid="textarea-pending-agreement-note"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} data-testid="button-pending-agreement-cancel">
            {t.common.cancel}
          </Button>
          <Button onClick={handleSubmit} data-testid="button-pending-agreement-save">
            {t.common.save}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DateFields({
  label,
  dayValue,
  monthValue,
  yearValue,
  onDayChange,
  onMonthChange,
  onYearChange,
  testIdPrefix,
  t,
}: {
  label: string;
  dayValue: number;
  monthValue: number;
  yearValue: number;
  onDayChange: (val: number) => void;
  onMonthChange: (val: number) => void;
  onYearChange: (val: number) => void;
  testIdPrefix: string;
  t: any;
}) {
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Select
          value={dayValue?.toString() || ""}
          onValueChange={(v) => onDayChange(parseInt(v))}
        >
          <SelectTrigger className="w-[80px]" data-testid={`wizard-select-${testIdPrefix}-day`}>
            <SelectValue placeholder={t.collaborators.fields.day} />
          </SelectTrigger>
          <SelectContent>
            {days.map((d) => (
              <SelectItem key={d} value={d.toString()}>
                {d.toString().padStart(2, "0")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={monthValue?.toString() || ""}
          onValueChange={(v) => onMonthChange(parseInt(v))}
        >
          <SelectTrigger className="w-[100px]" data-testid={`wizard-select-${testIdPrefix}-month`}>
            <SelectValue placeholder={t.collaborators.fields.month} />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m} value={m.toString()}>
                {m.toString().padStart(2, "0")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={yearValue?.toString() || ""}
          onValueChange={(v) => onYearChange(parseInt(v))}
        >
          <SelectTrigger className="w-[100px]" data-testid={`wizard-select-${testIdPrefix}-year`}>
            <SelectValue placeholder={t.collaborators.fields.year} />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={y.toString()}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// Address types
const ADDRESS_TYPES = [
  { value: "permanent", labelKey: "permanent" },
  { value: "correspondence", labelKey: "correspondence" },
  { value: "work", labelKey: "work" },
  { value: "company", labelKey: "company" },
];

// Reward types
const REWARD_TYPES = [
  { value: "per_sample", labelKey: "perSample" },
  { value: "monthly", labelKey: "monthly" },
  { value: "quarterly", labelKey: "quarterly" },
  { value: "annual", labelKey: "annual" },
  { value: "one_time", labelKey: "oneTime" },
];

// Non-company address types for collapsible display
const NON_COMPANY_ADDRESS_TYPES = [
  { value: "permanent", labelKey: "permanent" },
  { value: "correspondence", labelKey: "correspondence" },
  { value: "work", labelKey: "work" },
];

// Addresses Tab Content Component (for non-company addresses only)
function AddressesTabContent({ collaboratorId, countryCode, collaboratorName, t }: { collaboratorId: string; countryCode: string; collaboratorName?: string; t: any }) {
  const { toast } = useToast();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  
  const { data: addresses = [], isLoading } = useQuery<CollaboratorAddress[]>({
    queryKey: ["/api/collaborators", collaboratorId, "addresses"],
    queryFn: async () => {
      const res = await fetch(`/api/collaborators/${collaboratorId}/addresses`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!collaboratorId,
  });

  const toggleSection = (type: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  };

  const getAddressByType = (type: string) => addresses.find(a => a.addressType === type);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {NON_COMPANY_ADDRESS_TYPES.map(({ value, labelKey }) => {
        const address = getAddressByType(value);
        const isExpanded = expandedSections.has(value);
        
        return (
          <Collapsible key={value} open={isExpanded} onOpenChange={() => toggleSection(value)}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover-elevate">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span className="font-medium">
                        {(t.collaborators.addressTabs as Record<string, string>)[labelKey]}
                      </span>
                      {address && (
                        <Badge variant="outline" className="ml-2">
                          {address.city || address.streetNumber || t.common.filled}
                        </Badge>
                      )}
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <AddressForm 
                    collaboratorId={collaboratorId} 
                    addressType={value}
                    existingAddress={address}
                    collaboratorName={collaboratorName}
                    parentCountryCode={countryCode}
                    t={t}
                  />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
    </div>
  );
}

// Company Address Form Component (inline display)
function CompanyAddressForm({ collaboratorId, parentCountryCode, t }: { collaboratorId: string; parentCountryCode?: string; t: any }) {
  const { toast } = useToast();
  
  const { data: addresses = [] } = useQuery<CollaboratorAddress[]>({
    queryKey: ["/api/collaborators", collaboratorId, "addresses"],
    queryFn: async () => {
      const res = await fetch(`/api/collaborators/${collaboratorId}/addresses`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!collaboratorId,
  });

  const companyAddress = addresses.find(a => a.addressType === "company");
  
  const [formData, setFormData] = useState({
    streetNumber: companyAddress?.streetNumber || "",
    city: companyAddress?.city || "",
    postalCode: companyAddress?.postalCode || "",
    region: companyAddress?.region || "",
    district: (companyAddress as any)?.district || "",
    countryCode: companyAddress?.countryCode || parentCountryCode || "SK",
  });

  useEffect(() => {
    if (companyAddress) {
      setFormData({
        streetNumber: companyAddress.streetNumber || "",
        city: companyAddress.city || "",
        postalCode: companyAddress.postalCode || "",
        region: companyAddress.region || "",
        district: (companyAddress as any).district || "",
        countryCode: companyAddress.countryCode || parentCountryCode || "SK",
      });
    }
  }, [companyAddress]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (companyAddress) {
        return apiRequest("PUT", `/api/collaborators/${collaboratorId}/addresses/${companyAddress.id}`, { ...data, addressType: "company" });
      }
      return apiRequest("POST", `/api/collaborators/${collaboratorId}/addresses`, { ...data, addressType: "company" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collaborators", collaboratorId, "addresses"] });
      toast({ title: t.success.saved });
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  const regions = REGIONS_BY_COUNTRY[formData.countryCode] || [];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t.collaborators.fields.streetNumber}</Label>
          <Input
            value={formData.streetNumber}
            onChange={(e) => setFormData({ ...formData, streetNumber: e.target.value })}
            data-testid="wizard-input-company-address-street"
          />
        </div>
        <div className="space-y-2">
          <Label>{t.collaborators.fields.city}</Label>
          <Input
            value={formData.city}
            onChange={(e) => { const newCity = e.target.value; const newRegion = getAutoRegion(formData.countryCode, newCity); const newDistrict = getAutoDistrict(formData.countryCode, newCity); setFormData({ ...formData, city: newCity, region: newRegion || formData.region, district: newDistrict || formData.district }); }}
            data-testid="wizard-input-company-address-city"
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t.collaborators.fields.postalCode}</Label>
          <Input
            value={formData.postalCode}
            onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
            data-testid="wizard-input-company-address-zip"
          />
        </div>
        <div className="space-y-2">
          <Label>{t.common?.country || "Country"}</Label>
          <Select value={formData.countryCode} onValueChange={(v) => { const newRegion = getAutoRegion(v, formData.city); const newDistrict = getAutoDistrict(v, formData.city); setFormData({ ...formData, countryCode: v, region: newRegion || "", district: newDistrict || "" }); }}>
            <SelectTrigger data-testid="select-company-address-country"><SelectValue /></SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c: any) => (
                <SelectItem key={c.code} value={c.code}>{getCountryFlag(c.code)} {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{getGeoLabels(formData.countryCode).region}</Label>
          <div className="flex items-center gap-1">
            <Select value={formData.region || ""} onValueChange={(value) => setFormData({ ...formData, region: value, district: "" })}>
              <SelectTrigger data-testid="select-company-address-region"><SelectValue placeholder={getGeoLabels(formData.countryCode).region} /></SelectTrigger>
              <SelectContent>
                {regions.map((r: string) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
                {formData.region && !regions.includes(formData.region) && (
                  <SelectItem value={formData.region}>{formData.region}</SelectItem>
                )}
              </SelectContent>
            </Select>
            <SuggestRegionButton
              countryCode={formData.countryCode}
              city={formData.city}
              streetNumber={formData.streetNumber}
              postalCode={formData.postalCode}
              size="icon"
              onSuggestion={(region, district) => setFormData({ ...formData, region, district })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>{getGeoLabels(formData.countryCode).district}</Label>
          <Select value={formData.district || ""} onValueChange={(value) => setFormData({ ...formData, district: value })}>
            <SelectTrigger data-testid="select-company-address-district"><SelectValue placeholder={getGeoLabels(formData.countryCode).district} /></SelectTrigger>
            <SelectContent>
              {getDistrictsForRegion(formData.countryCode, formData.region, formData.district).map((d: string) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate(formData)} disabled={saveMutation.isPending} data-testid="button-save-company-address">
          {saveMutation.isPending ? t.common.loading : t.common.save}
        </Button>
      </div>
    </div>
  );
}

// Address Form Component
function AddressForm({ collaboratorId, addressType, existingAddress, collaboratorName, parentCountryCode, t }: { 
  collaboratorId: string; 
  addressType: string; 
  existingAddress?: CollaboratorAddress;
  collaboratorName?: string;
  parentCountryCode?: string;
  t: any;
}) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: existingAddress?.name || "",
    streetNumber: existingAddress?.streetNumber || "",
    city: existingAddress?.city || "",
    postalCode: existingAddress?.postalCode || "",
    region: existingAddress?.region || "",
    district: (existingAddress as any)?.district || "",
    countryCode: existingAddress?.countryCode || parentCountryCode || "SK",
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (existingAddress) {
        return apiRequest("PUT", `/api/collaborators/${collaboratorId}/addresses/${existingAddress.id}`, { ...data, addressType });
      }
      return apiRequest("POST", `/api/collaborators/${collaboratorId}/addresses`, { ...data, addressType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collaborators", collaboratorId, "addresses"] });
      toast({ title: t.success.saved });
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  const copyCollaboratorName = () => {
    if (collaboratorName) {
      setFormData({ ...formData, name: collaboratorName });
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t.collaborators.fields.name}</Label>
            {collaboratorName && (
              <Button type="button" variant="ghost" size="sm" onClick={copyCollaboratorName} data-testid={`button-copy-name-${addressType}`}>
                <Copy className="h-3 w-3 mr-1" />
                {t.common.copy}
              </Button>
            )}
          </div>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            data-testid={`input-address-${addressType}-name`}
            placeholder={collaboratorName || ""}
          />
        </div>
        <div className="space-y-2">
          <Label>{t.collaborators.fields.streetNumber}</Label>
          <Input
            value={formData.streetNumber}
            onChange={(e) => setFormData({ ...formData, streetNumber: e.target.value })}
            data-testid={`input-address-${addressType}-street`}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t.collaborators.fields.city}</Label>
          <Input
            value={formData.city}
            onChange={(e) => { const newCity = e.target.value; const newRegion = getAutoRegion(formData.countryCode, newCity); const newDistrict = getAutoDistrict(formData.countryCode, newCity); setFormData({ ...formData, city: newCity, region: newRegion || formData.region, district: newDistrict || formData.district }); }}
            data-testid={`input-address-${addressType}-city`}
          />
        </div>
        <div className="space-y-2">
          <Label>{t.collaborators.fields.postalCode}</Label>
          <Input
            value={formData.postalCode}
            onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
            data-testid={`input-address-${addressType}-zip`}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t.common?.country || "Country"}</Label>
          <Select value={formData.countryCode} onValueChange={(v) => { const newRegion = getAutoRegion(v, formData.city); const newDistrict = getAutoDistrict(v, formData.city); setFormData({ ...formData, countryCode: v, region: newRegion || "", district: newDistrict || "" }); }}>
            <SelectTrigger data-testid={`select-address-${addressType}-country`}><SelectValue /></SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c: any) => (
                <SelectItem key={c.code} value={c.code}>{getCountryFlag(c.code)} {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{getGeoLabels(formData.countryCode).region}</Label>
          <div className="flex items-center gap-1">
            <Select value={formData.region || ""} onValueChange={(value) => setFormData({ ...formData, region: value, district: "" })}>
              <SelectTrigger data-testid={`select-address-${addressType}-region`}><SelectValue placeholder={getGeoLabels(formData.countryCode).region} /></SelectTrigger>
              <SelectContent>
                {(REGIONS_BY_COUNTRY[formData.countryCode] || []).map((r: string) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
                {formData.region && !(REGIONS_BY_COUNTRY[formData.countryCode] || []).includes(formData.region) && (
                  <SelectItem value={formData.region}>{formData.region}</SelectItem>
                )}
              </SelectContent>
            </Select>
            <SuggestRegionButton
              countryCode={formData.countryCode}
              city={formData.city}
              streetNumber={formData.streetNumber}
              postalCode={formData.postalCode}
              size="icon"
              onSuggestion={(region, district) => setFormData({ ...formData, region, district })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>{getGeoLabels(formData.countryCode).district}</Label>
          <Select value={formData.district || ""} onValueChange={(value) => setFormData({ ...formData, district: value })}>
            <SelectTrigger data-testid={`select-address-${addressType}-district`}><SelectValue placeholder={getGeoLabels(formData.countryCode).district} /></SelectTrigger>
            <SelectContent>
              {getDistrictsForRegion(formData.countryCode, formData.region, formData.district).map((d: string) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate(formData)} disabled={saveMutation.isPending} data-testid={`button-save-address-${addressType}`}>
          {saveMutation.isPending ? t.common.loading : t.common.save}
        </Button>
      </div>
    </div>
  );
}

function ActionsTabContent({ collaboratorId, t }: { collaboratorId: string; t: any }) {
  const { data: activities = [], isLoading } = useQuery<CollaboratorActivity[]>({
    queryKey: ["/api/collaborators", collaboratorId, "activities"],
    queryFn: async () => {
      const res = await fetch(`/api/collaborators/${collaboratorId}/activities`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!collaboratorId,
  });

  const formatDate = (date: string | Date | null) => {
    if (!date) return "-";
    const d = new Date(date);
    return d.toLocaleDateString("sk");
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div>
      {activities.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground" data-testid="text-no-activities">{t.common.noData}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="table-activities">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2 font-medium">Typ dohody</th>
                <th className="text-left p-2 font-medium">Číslo zmluvy</th>
                <th className="text-left p-2 font-medium">Dátum úkonu</th>
                <th className="text-left p-2 font-medium">Číslo CBU</th>
                <th className="text-left p-2 font-medium">Odmena</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((act) => (
                <tr key={act.id} className="border-b hover:bg-muted/50" data-testid={`row-activity-${act.id}`}>
                  <td className="p-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      {act.name || "-"}
                    </span>
                  </td>
                  <td className="p-2 text-muted-foreground">{act.internalNote || "-"}</td>
                  <td className="p-2">{formatDate(act.dueDate)}</td>
                  <td className="p-2 font-mono text-xs">{act.publicNote || "-"}</td>
                  <td className="p-2">
                    {act.amount ? (
                      <span className="text-green-600 dark:text-green-400">
                        {act.amount} {act.currency || ""}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 text-xs text-muted-foreground" data-testid="text-activities-count">
            {activities.length} {activities.length === 1 ? "záznam" : activities.length < 5 ? "záznamy" : "záznamov"}
          </div>
        </div>
      )}
    </div>
  );
}

// Agreements Tab Content Component
function AgreementsTabContent({ collaboratorId, collaboratorCountry, t }: { collaboratorId: string; collaboratorCountry: string; t: any }) {
  const { toast } = useToast();
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  
  const { data: agreements = [] } = useQuery<CollaboratorAgreement[]>({
    queryKey: ["/api/collaborators", collaboratorId, "agreements"],
    queryFn: async () => {
      const res = await fetch(`/api/collaborators/${collaboratorId}/agreements`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!collaboratorId,
  });

  const { data: billingCompanies = [] } = useQuery<BillingDetails[]>({
    queryKey: ["/api/billing-details", collaboratorCountry],
    queryFn: async () => {
      const res = await fetch(`/api/billing-details?country=${collaboratorCountry}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!collaboratorCountry,
  });

  const deleteMutation = useMutation({
    mutationFn: (agreementId: string) => {
      return apiRequest("DELETE", `/api/collaborators/${collaboratorId}/agreements/${agreementId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collaborators", collaboratorId, "agreements"] });
      toast({ title: t.success.deleted });
    },
    onError: () => {
      toast({ title: t.errors.deleteFailed, variant: "destructive" });
    },
  });

  const handleFileUpload = async (agreementId: string, file: File) => {
    setUploadingFile(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);
      
      const response = await fetch(`/api/collaborators/${collaboratorId}/agreements/${agreementId}/upload`, {
        method: "POST",
        credentials: "include",
        body: formDataUpload,
      });
      
      if (!response.ok) throw new Error(t.errors.uploadFailed);
      
      queryClient.invalidateQueries({ queryKey: ["/api/collaborators", collaboratorId, "agreements"] });
      toast({ title: t.success.saved });
    } catch (error) {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    } finally {
      setUploadingFile(false);
    }
  };

  const formatDate = (day: number | null, month: number | null, year: number | null) => {
    if (!day || !month || !year) return t.common.noData;
    return `${day}.${month}.${year}`;
  };

  const isAgreementExpired = (day: number | null | undefined, month: number | null | undefined, year: number | null | undefined) => {
    if (!day || !month || !year) return false;
    const validToDate = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return validToDate < today;
  };

  const getBillingCompanyName = (id: string | null) => {
    if (!id) return t.common.noData;
    return billingCompanies.find((bc) => bc.id === id)?.companyName || t.common.noData;
  };

  if (isAddingNew || editingId) {
    return (
      <AgreementForm
        collaboratorId={collaboratorId}
        editingId={editingId}
        agreement={editingId ? agreements.find(a => a.id === editingId) : undefined}
        billingCompanies={billingCompanies}
        onCancel={() => {
          setIsAddingNew(false);
          setEditingId(null);
        }}
        onSuccess={() => {
          setIsAddingNew(false);
          setEditingId(null);
        }}
        t={t}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setIsAddingNew(true)} data-testid="button-add-agreement">
          <Plus className="h-4 w-4 mr-2" />
          {t.common.add}
        </Button>
      </div>
      {agreements.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">{t.common.noData}</div>
      ) : (
        <div className="space-y-2">
          {agreements.map((agreement) => (
            <Card key={agreement.id}>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">{t.collaborators?.fields?.billingCompany}: </span>
                        {getBillingCompanyName(agreement.billingCompanyId)}
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t.collaborators?.fields?.contractNumber}: </span>
                        {agreement.contractNumber || t.common.noData}
                      </div>
                      <div>
                        {isAgreementExpired(agreement.validToDay, agreement.validToMonth, agreement.validToYear) ? (
                          <Badge variant="destructive">
                            {t.collaborators.expiredAgreement}
                          </Badge>
                        ) : (
                          <Badge variant={agreement.isValid ? "default" : "secondary"}>
                            {agreement.isValid ? t.common.active : t.common.inactive}
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button size="icon" variant="ghost" onClick={() => setEditingId(agreement.id)} data-testid={`button-edit-agreement-${agreement.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(agreement.id)} data-testid={`button-delete-agreement-${agreement.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">{t.collaborators?.fields?.validFrom}: </span>
                      {formatDate(agreement.validFromDay, agreement.validFromMonth, agreement.validFromYear)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t.collaborators?.fields?.validTo}: </span>
                      {formatDate(agreement.validToDay, agreement.validToMonth, agreement.validToYear)}
                    </div>
                  </div>
                  {(agreement as any).rewardTypes && (agreement as any).rewardTypes.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {(agreement as any).rewardTypes.map((rt: string) => (
                        <Badge key={rt} variant="outline" className="text-xs">
                          {t.collaborators?.rewardTypes?.[SERVICE_TYPES.find(s => s.value === rt)?.labelKey || ""] || rt}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-4 pt-2 border-t">
                    <div className="flex items-center gap-2">
                      {agreement.fileName ? (
                        <>
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{agreement.fileName}</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => window.open(`/api/collaborators/${collaboratorId}/agreements/${agreement.id}/file`, "_blank")}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => window.open(`/api/collaborators/${collaboratorId}/agreements/${agreement.id}/download`, "_blank")}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">{t.collaborators.noFile}</span>
                      )}
                    </div>
                    <div>
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(agreement.id, file);
                          }}
                          disabled={uploadingFile}
                        />
                        <Button variant="outline" size="sm" disabled={uploadingFile} asChild>
                          <span>
                            <Upload className="h-4 w-4 mr-2" />
                            {uploadingFile ? t.common.loading : t.collaborators.uploadAgreement}
                          </span>
                        </Button>
                      </label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Agreement Form Types
const AGREEMENT_FORM_TYPES = [
  { value: "dohoda_o_vykonani_prace", labelKey: "dohodaOVykonaniPrace" },
  { value: "zmluva_o_dielo_podnikatel", labelKey: "zmluvaODieloPodnikatel" },
  { value: "zmluva_o_dielo_fyzicka_osoba", labelKey: "zmluvaODieloFyzickaOsoba" },
] as const;

// Agreement Form Component
function AgreementForm({ collaboratorId, editingId, agreement, billingCompanies, onCancel, onSuccess, t }: {
  collaboratorId: string;
  editingId: string | null;
  agreement?: CollaboratorAgreement;
  billingCompanies: BillingDetails[];
  onCancel: () => void;
  onSuccess: () => void;
  t: any;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [formData, setFormData] = useState({
    billingCompanyId: agreement?.billingCompanyId || "",
    contractNumber: agreement?.contractNumber || "",
    agreementForm: agreement?.agreementForm || "",
    validFromDay: agreement?.validFromDay,
    validFromMonth: agreement?.validFromMonth,
    validFromYear: agreement?.validFromYear,
    validToDay: agreement?.validToDay,
    validToMonth: agreement?.validToMonth,
    validToYear: agreement?.validToYear,
    agreementSentDay: agreement?.agreementSentDay,
    agreementSentMonth: agreement?.agreementSentMonth,
    agreementSentYear: agreement?.agreementSentYear,
    agreementReturnedDay: agreement?.agreementReturnedDay,
    agreementReturnedMonth: agreement?.agreementReturnedMonth,
    agreementReturnedYear: agreement?.agreementReturnedYear,
    isValid: agreement?.isValid ?? true,
    questionnaireReturned: (agreement as any)?.questionnaireReturned ?? false,
    socialInsuranceRegistrationDay: (agreement as any)?.socialInsuranceRegistrationDay,
    socialInsuranceRegistrationMonth: (agreement as any)?.socialInsuranceRegistrationMonth,
    socialInsuranceRegistrationYear: (agreement as any)?.socialInsuranceRegistrationYear,
    socialInsuranceCancelDay: (agreement as any)?.socialInsuranceCancelDay,
    socialInsuranceCancelMonth: (agreement as any)?.socialInsuranceCancelMonth,
    socialInsuranceCancelYear: (agreement as any)?.socialInsuranceCancelYear,
    note: (agreement as any)?.note || "",
    notes: (agreement as any)?.notes || "",
    rewardTypes: (agreement as any)?.rewardTypes || [] as string[],
  });

  const saveMutation = useMutation({
    mutationFn: (data: typeof formData) => {
      if (editingId) {
        return apiRequest("PUT", `/api/collaborators/${collaboratorId}/agreements/${editingId}`, data);
      }
      return apiRequest("POST", `/api/collaborators/${collaboratorId}/agreements`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collaborators", collaboratorId, "agreements"] });
      toast({ title: t.success.saved });
      onSuccess();
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  const setToday = (field: "validFrom" | "validTo" | "agreementSent" | "agreementReturned" | "socialInsuranceRegistration" | "socialInsuranceCancel") => {
    const today = new Date();
    const updates: any = {
      [`${field}Day`]: today.getDate(),
      [`${field}Month`]: today.getMonth() + 1,
      [`${field}Year`]: today.getFullYear(),
    };
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const setEndOfYear = (sourceYear?: number | null) => {
    const year = sourceYear || new Date().getFullYear();
    setFormData(prev => ({ ...prev, validToDay: 31, validToMonth: 12, validToYear: year }));
  };

  const handleFileUpload = async (file: File) => {
    if (!editingId) {
      return;
    }
    setUploadingFile(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);
      
      const response = await fetch(`/api/collaborators/${collaboratorId}/agreements/${editingId}/upload`, {
        method: "POST",
        credentials: "include",
        body: formDataUpload,
      });
      
      if (!response.ok) throw new Error();
      
      queryClient.invalidateQueries({ queryKey: ["/api/collaborators", collaboratorId, "agreements"] });
      toast({ title: t.success.saved });
    } catch (error) {
      toast({ title: t.errors.uploadFailed, variant: "destructive" });
    } finally {
      setUploadingFile(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>{t.collaborators?.fields?.billingCompany}</Label>
          <Select
            value={formData.billingCompanyId || "_none"}
            onValueChange={(value) => setFormData({ ...formData, billingCompanyId: value === "_none" ? "" : value })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t.collaborators?.fields?.billingCompany} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">{t.common?.noData}</SelectItem>
              {billingCompanies.map((bc) => (
                <SelectItem key={bc.id} value={bc.id}>{bc.companyName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t.collaborators?.fields?.contractNumber}</Label>
          <Input
            value={formData.contractNumber || ""}
            onChange={(e) => setFormData({ ...formData, contractNumber: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t.collaborators?.fields?.agreementForm}</Label>
        <Select
          value={formData.agreementForm || "_none"}
          onValueChange={(value) => setFormData({ ...formData, agreementForm: value === "_none" ? "" : value })}
        >
          <SelectTrigger data-testid="select-agreement-form">
            <SelectValue placeholder={t.collaborators?.fields?.agreementForm} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">{t.common?.noData}</SelectItem>
            {AGREEMENT_FORM_TYPES.map((af) => (
              <SelectItem key={af.value} value={af.value}>
                {(t.collaborators.agreementFormTypes as Record<string, string>)[af.labelKey]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t.collaborators?.fields?.validFrom}</Label>
            <Button type="button" variant="ghost" size="sm" onClick={() => setToday("validFrom")} data-testid="button-today-valid-from">
              {t.common.today}
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder={t.collaborators.fields.day}
              value={formData.validFromDay || ""}
              onChange={(e) => setFormData({ ...formData, validFromDay: parseInt(e.target.value) || undefined })}
              className="w-20"
            />
            <Input
              type="number"
              placeholder={t.collaborators.fields.month}
              value={formData.validFromMonth || ""}
              onChange={(e) => setFormData({ ...formData, validFromMonth: parseInt(e.target.value) || undefined })}
              className="w-20"
            />
            <Input
              type="number"
              placeholder={t.collaborators.fields.year}
              value={formData.validFromYear || ""}
              onChange={(e) => setFormData({ ...formData, validFromYear: parseInt(e.target.value) || undefined })}
              className="w-24"
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t.collaborators?.fields?.validTo}</Label>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEndOfYear(formData.validFromYear)} data-testid="button-end-of-year">
              {t.common.endOfYear}
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder={t.collaborators.fields.day}
              value={formData.validToDay || ""}
              onChange={(e) => setFormData({ ...formData, validToDay: parseInt(e.target.value) || undefined })}
              className="w-20"
            />
            <Input
              type="number"
              placeholder={t.collaborators.fields.month}
              value={formData.validToMonth || ""}
              onChange={(e) => setFormData({ ...formData, validToMonth: parseInt(e.target.value) || undefined })}
              className="w-20"
            />
            <Input
              type="number"
              placeholder={t.collaborators.fields.year}
              value={formData.validToYear || ""}
              onChange={(e) => setFormData({ ...formData, validToYear: parseInt(e.target.value) || undefined })}
              className="w-24"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t.collaborators?.fields?.agreementSent}</Label>
            <Button type="button" variant="ghost" size="sm" onClick={() => setToday("agreementSent")} data-testid="button-today-agreement-sent">
              {t.common.today}
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder={t.collaborators.fields.day}
              value={formData.agreementSentDay || ""}
              onChange={(e) => setFormData({ ...formData, agreementSentDay: parseInt(e.target.value) || undefined })}
              className="w-20"
              data-testid="input-agreement-sent-day"
            />
            <Input
              type="number"
              placeholder={t.collaborators.fields.month}
              value={formData.agreementSentMonth || ""}
              onChange={(e) => setFormData({ ...formData, agreementSentMonth: parseInt(e.target.value) || undefined })}
              className="w-20"
              data-testid="input-agreement-sent-month"
            />
            <Input
              type="number"
              placeholder={t.collaborators.fields.year}
              value={formData.agreementSentYear || ""}
              onChange={(e) => setFormData({ ...formData, agreementSentYear: parseInt(e.target.value) || undefined })}
              className="w-24"
              data-testid="input-agreement-sent-year"
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t.collaborators?.fields?.agreementReturned}</Label>
            <Button type="button" variant="ghost" size="sm" onClick={() => setToday("agreementReturned")} data-testid="button-today-agreement-returned">
              {t.common.today}
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder={t.collaborators.fields.day}
              value={formData.agreementReturnedDay || ""}
              onChange={(e) => setFormData({ ...formData, agreementReturnedDay: parseInt(e.target.value) || undefined })}
              className="w-20"
              data-testid="input-agreement-returned-day"
            />
            <Input
              type="number"
              placeholder={t.collaborators.fields.month}
              value={formData.agreementReturnedMonth || ""}
              onChange={(e) => setFormData({ ...formData, agreementReturnedMonth: parseInt(e.target.value) || undefined })}
              className="w-20"
              data-testid="input-agreement-returned-month"
            />
            <Input
              type="number"
              placeholder={t.collaborators.fields.year}
              value={formData.agreementReturnedYear || ""}
              onChange={(e) => setFormData({ ...formData, agreementReturnedYear: parseInt(e.target.value) || undefined })}
              className="w-24"
              data-testid="input-agreement-returned-year"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex items-center space-x-2">
          <Switch
            checked={formData.isValid}
            onCheckedChange={(checked) => setFormData({ ...formData, isValid: checked })}
            data-testid="switch-agreement-is-valid"
          />
          <Label>{t.collaborators?.fields?.isValid}</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            checked={formData.questionnaireReturned}
            onCheckedChange={(checked) => setFormData({ ...formData, questionnaireReturned: checked })}
            data-testid="switch-agreement-questionnaire-returned"
          />
          <Label>{t.collaborators?.fields?.questionnaireReturned || "Dotazník vrátený"}</Label>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t.collaborators?.fields?.socialInsuranceRegistration || "Registrácia soc. poisťovňa"}</Label>
            <Button type="button" variant="ghost" size="sm" onClick={() => setToday("socialInsuranceRegistration" as any)} data-testid="button-today-social-insurance-reg">
              {t.common.today}
            </Button>
          </div>
          <div className="flex gap-2">
            <Input type="number" placeholder={t.collaborators.fields.day} value={formData.socialInsuranceRegistrationDay || ""} onChange={(e) => setFormData({ ...formData, socialInsuranceRegistrationDay: parseInt(e.target.value) || undefined })} className="w-20" data-testid="input-social-insurance-reg-day" />
            <Input type="number" placeholder={t.collaborators.fields.month} value={formData.socialInsuranceRegistrationMonth || ""} onChange={(e) => setFormData({ ...formData, socialInsuranceRegistrationMonth: parseInt(e.target.value) || undefined })} className="w-20" data-testid="input-social-insurance-reg-month" />
            <Input type="number" placeholder={t.collaborators.fields.year} value={formData.socialInsuranceRegistrationYear || ""} onChange={(e) => setFormData({ ...formData, socialInsuranceRegistrationYear: parseInt(e.target.value) || undefined })} className="w-24" data-testid="input-social-insurance-reg-year" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t.collaborators?.fields?.socialInsuranceCancel || "Odhlásenie soc. poisťovňa"}</Label>
            <Button type="button" variant="ghost" size="sm" onClick={() => setToday("socialInsuranceCancel" as any)} data-testid="button-today-social-insurance-cancel">
              {t.common.today}
            </Button>
          </div>
          <div className="flex gap-2">
            <Input type="number" placeholder={t.collaborators.fields.day} value={formData.socialInsuranceCancelDay || ""} onChange={(e) => setFormData({ ...formData, socialInsuranceCancelDay: parseInt(e.target.value) || undefined })} className="w-20" data-testid="input-social-insurance-cancel-day" />
            <Input type="number" placeholder={t.collaborators.fields.month} value={formData.socialInsuranceCancelMonth || ""} onChange={(e) => setFormData({ ...formData, socialInsuranceCancelMonth: parseInt(e.target.value) || undefined })} className="w-20" data-testid="input-social-insurance-cancel-month" />
            <Input type="number" placeholder={t.collaborators.fields.year} value={formData.socialInsuranceCancelYear || ""} onChange={(e) => setFormData({ ...formData, socialInsuranceCancelYear: parseInt(e.target.value) || undefined })} className="w-24" data-testid="input-social-insurance-cancel-year" />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold">{t.collaborators?.fields?.rewardTypes || "Typy služieb"}</Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
          {SERVICE_TYPES.map((rt) => (
            <label
              key={rt.value}
              className="flex items-center gap-2 cursor-pointer text-xs py-0.5 hover:bg-muted/50 rounded px-1"
              data-testid={`checkbox-reward-${rt.value}`}
            >
              <input
                type="checkbox"
                checked={(formData.rewardTypes as string[]).includes(rt.value)}
                onChange={() => {
                  const current = formData.rewardTypes as string[];
                  const updated = current.includes(rt.value)
                    ? current.filter((r: string) => r !== rt.value)
                    : [...current, rt.value];
                  setFormData({ ...formData, rewardTypes: updated });
                }}
                className="h-3.5 w-3.5 rounded border-gray-300"
              />
              {t.collaborators?.rewardTypes?.[rt.labelKey] || rt.value}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t.collaborators?.fields?.note || "Poznámka"}</Label>
        <Textarea
          value={formData.note}
          onChange={(e) => setFormData({ ...formData, note: e.target.value })}
          placeholder={t.collaborators?.fields?.note || "Poznámka k dohode"}
          className="min-h-[80px]"
          data-testid="textarea-agreement-note"
        />
      </div>

      {editingId && (
        <div className="space-y-2">
          <Label>{t.collaborators?.uploadAgreement}</Label>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFile}
              data-testid="button-upload-agreement"
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploadingFile ? t.common.loading : t.collaborators?.selectFile}
            </Button>
            {agreement?.fileName && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <FileText className="h-4 w-4" />
                {agreement.fileName}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          {t.common.cancel}
        </Button>
        <Button onClick={() => saveMutation.mutate(formData)} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? t.common.loading : t.common.save}
        </Button>
      </div>
    </div>
  );
}

// History Tab Content Component
interface ActivityLog {
  id: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  details: string | null;
  createdAt: Date;
}

function ConnectActivityTab({ collaboratorId, locale, t }: { collaboratorId: string; locale: string; t: any }) {
  const [activeTab, setActiveTab] = useState<"calls" | "visits" | "stats">("calls");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { data: activity, isLoading } = useQuery<any>({
    queryKey: ["/api/collaborators", collaboratorId, "connect-activity"],
    queryFn: async () => {
      const res = await fetch(`/api/collaborators/${collaboratorId}/connect-activity?limit=100`, {
        credentials: "include"
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!collaboratorId,
  });

  const formatDuration = (seconds: number) => {
    if (!seconds) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(locale === "sk" ? "sk-SK" : locale === "cs" ? "cs-CZ" : locale === "hu" ? "hu-HU" : locale === "ro" ? "ro-RO" : locale === "it" ? "it-IT" : locale === "de" ? "de-DE" : "en-US", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit"
      });
    } catch { return dateStr; }
  };

  const getVisitSubject = (code: string | null) => {
    if (!code) return "-";
    const subject = VISIT_SUBJECTS.find(s => s.code === code);
    if (!subject) return code;
    return (subject as any)[locale] || subject.en;
  };

  const getVisitPlace = (code: string | null) => {
    if (!code) return "-";
    const place = VISIT_PLACE_OPTIONS.find(p => p.code === code);
    if (!place) return code;
    return (place as any)[locale] || place.en;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      completed: "default", answered: "default",
      initiated: "secondary", ringing: "secondary", in_progress: "secondary", scheduled: "secondary",
      failed: "destructive", no_answer: "destructive", busy: "destructive", cancelled: "destructive",
      not_realized: "destructive",
    };
    const labels: Record<string, string> = {
      completed: t.collaborators.connectTab?.statusCompleted || "Completed",
      answered: t.collaborators.connectTab?.statusAnswered || "Answered",
      initiated: t.collaborators.connectTab?.statusInitiated || "Initiated",
      ringing: t.collaborators.connectTab?.statusRinging || "Ringing",
      in_progress: t.collaborators.connectTab?.statusInProgress || "In Progress",
      scheduled: t.collaborators.connectTab?.statusScheduled || "Scheduled",
      failed: t.collaborators.connectTab?.statusFailed || "Failed",
      no_answer: t.collaborators.connectTab?.statusNoAnswer || "No Answer",
      busy: t.collaborators.connectTab?.statusBusy || "Busy",
      cancelled: t.collaborators.connectTab?.statusCancelled || "Cancelled",
      not_realized: t.collaborators.connectTab?.statusNotRealized || "Not Realized",
    };
    return (
      <Badge variant={variants[status] || "outline"} data-testid={`badge-call-status-${status}`}>
        {labels[status] || status}
      </Badge>
    );
  };

  const playRecording = (recordingId: string) => {
    if (playingId === recordingId) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(`/api/call-recordings/${recordingId}/stream`);
    audio.onended = () => setPlayingId(null);
    audio.play();
    audioRef.current = audio;
    setPlayingId(recordingId);
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const formatTotalDuration = (seconds: number) => {
    if (!seconds) return "0h 0m";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Wifi className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">{t.collaborators.connectTab?.noData || "No INDEXUS Connect activity found"}</p>
      </div>
    );
  }

  const stats = activity.stats || {};
  const calls = activity.calls || [];
  const visits = activity.visits || [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border p-3 text-center" data-testid="stat-total-calls">
          <PhoneCall className="h-5 w-5 mx-auto mb-1 text-blue-500" />
          <div className="text-2xl font-bold">{stats.totalCalls || 0}</div>
          <div className="text-xs text-muted-foreground">{t.collaborators.connectTab?.totalCalls || "Calls"}</div>
        </div>
        <div className="rounded-lg border p-3 text-center" data-testid="stat-call-duration">
          <Clock className="h-5 w-5 mx-auto mb-1 text-green-500" />
          <div className="text-2xl font-bold">{formatTotalDuration(stats.totalCallDuration || 0)}</div>
          <div className="text-xs text-muted-foreground">{t.collaborators.connectTab?.totalDuration || "Call Time"}</div>
        </div>
        <div className="rounded-lg border p-3 text-center" data-testid="stat-total-visits">
          <MapPin className="h-5 w-5 mx-auto mb-1 text-orange-500" />
          <div className="text-2xl font-bold">{stats.totalVisits || 0}</div>
          <div className="text-xs text-muted-foreground">{t.collaborators.connectTab?.totalVisits || "Visits"}</div>
        </div>
        <div className="rounded-lg border p-3 text-center" data-testid="stat-completed-visits">
          <Check className="h-5 w-5 mx-auto mb-1 text-emerald-500" />
          <div className="text-2xl font-bold">{stats.completedVisits || 0}</div>
          <div className="text-xs text-muted-foreground">{t.collaborators.connectTab?.completedVisits || "Completed"}</div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="w-full">
          <TabsTrigger value="calls" className="flex-1" data-testid="tab-connect-calls">
            <Phone className="h-4 w-4 mr-1" />
            {t.collaborators.connectTab?.callsTab || "Calls"} ({calls.length})
          </TabsTrigger>
          <TabsTrigger value="visits" className="flex-1" data-testid="tab-connect-visits">
            <MapPin className="h-4 w-4 mr-1" />
            {t.collaborators.connectTab?.visitsTab || "Visits"} ({visits.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calls" className="mt-3">
          {calls.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>{t.collaborators.connectTab?.noCalls || "No calls recorded yet"}</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {calls.map((call: any) => (
                <div key={call.id} className="rounded-lg border p-3 space-y-2" data-testid={`call-log-${call.id}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {call.direction === "inbound" ? (
                        <PhoneIncoming className="h-4 w-4 text-blue-500" />
                      ) : (
                        <PhoneOutgoing className="h-4 w-4 text-green-500" />
                      )}
                      <span className="font-medium" data-testid={`call-phone-${call.id}`}>{call.phoneNumber}</span>
                      {getStatusBadge(call.status)}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{formatDuration(call.durationSeconds || 0)}</span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(call.startedAt)}
                    {call.callerIdName && <span className="ml-2">({call.callerIdName})</span>}
                  </div>
                  {call.notes && (
                    <div className="text-xs text-muted-foreground italic">{call.notes}</div>
                  )}
                  {call.recordings && call.recordings.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {call.recordings.map((rec: any) => (
                        <Button
                          key={rec.id}
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => playRecording(rec.id)}
                          data-testid={`btn-play-recording-${rec.id}`}
                        >
                          {playingId === rec.id ? (
                            <Pause className="h-3 w-3" />
                          ) : (
                            <Play className="h-3 w-3" />
                          )}
                          {playingId === rec.id
                            ? (t.collaborators.connectTab?.pause || "Pause")
                            : (t.collaborators.connectTab?.play || "Play")}
                          {rec.sentiment && (
                            <Badge variant="outline" className="ml-1 text-[10px] h-4">
                              {rec.sentiment}
                            </Badge>
                          )}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="visits" className="mt-3">
          {visits.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>{t.collaborators.connectTab?.noVisits || "No visits recorded yet"}</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {visits.map((visit: any) => (
                <div key={visit.id} className="rounded-lg border p-3 space-y-1" data-testid={`visit-log-${visit.id}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-orange-500" />
                      <span className="font-medium text-sm">{getVisitSubject(visit.subject || visit.visitType)}</span>
                      {getStatusBadge(visit.status || "scheduled")}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                    <span>{formatDate(visit.startTime)}</span>
                    {visit.hospitalName && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {visit.hospitalName}
                      </span>
                    )}
                    {visit.place && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {getVisitPlace(visit.place)}
                      </span>
                    )}
                  </div>
                  {visit.locationAddress && (
                    <div className="text-xs text-muted-foreground">{visit.locationAddress}</div>
                  )}
                  {visit.remark && (
                    <div className="text-xs text-muted-foreground italic mt-1">{visit.remark}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function HistoryTabContent({ collaboratorId, t }: { collaboratorId: string; t: any }) {
  const { data: activityLogs = [], isLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/activity-logs", "collaborator", collaboratorId],
    queryFn: async () => {
      const res = await fetch(`/api/activity-logs?entityType=collaborator&entityId=${collaboratorId}`, { 
        credentials: "include" 
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!collaboratorId,
  });

  const { data: users = [] } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
  });

  const { data: hospitals = [] } = useQuery<any[]>({
    queryKey: ["/api/hospitals/lookup"],
  });

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user ? user.fullName : userId;
  };

  const getHospitalName = (hospitalId: string) => {
    const hospital = hospitals.find(h => h.id === hospitalId);
    return hospital ? hospital.name : hospitalId;
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "create": return <Plus className="h-4 w-4 text-green-500" />;
      case "update": return <Pencil className="h-4 w-4 text-blue-500" />;
      case "delete": return <Trash2 className="h-4 w-4 text-red-500" />;
      default: return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "create": return t.collaborators.history?.actionTypes?.created || t.collaborators.actions.created;
      case "update": return t.collaborators.history?.actionTypes?.updated || t.collaborators.actions.updated;
      default: return action;
    }
  };

  const formatFieldValue = (value: any, field?: string): string => {
    if (value === null || value === undefined || value === "") return "-";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    
    // Translate IDs to readable names
    if (field === "representativeId" && typeof value === "string" && value) {
      return getUserName(value);
    }
    if (field === "hospitalId" && typeof value === "string" && value) {
      return getHospitalName(value);
    }
    if (field === "hospitalIds" && Array.isArray(value)) {
      return value.map(id => getHospitalName(id)).join(", ") || "-";
    }
    
    if (Array.isArray(value)) return value.join(", ") || "-";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  const formatDetails = (details: string | null, action: string) => {
    if (!details) return null;
    
    try {
      const parsed = JSON.parse(details);
      const items: string[] = [];
      
      // Handle update with changes object
      if ((action === "update" || action === "update_mobile_credentials") && parsed.changes) {
        const changes = parsed.changes;
        
        for (const [field, change] of Object.entries(changes)) {
          const ch = change as { from?: any; to?: any };
          const fieldLabel = t.collaborators?.fields?.[field as keyof typeof t.collaborators.fields] || 
                            t.collaborators?.mobileApp?.[field as keyof typeof t.collaborators.mobileApp] || 
                            field;
          const fromValue = formatFieldValue(ch.from, field);
          const toValue = formatFieldValue(ch.to, field);
          
          if (ch.from !== undefined && ch.to !== undefined) {
            items.push(`${fieldLabel}: "${fromValue}" -> "${toValue}"`);
          } else if (ch.to !== undefined) {
            items.push(`${fieldLabel}: "${toValue}"`);
          }
        }
        return items.length > 0 ? items : null;
      }
      
      // Handle mobile credentials update
      if (action.includes("mobile") || parsed.mobileAppEnabled !== undefined) {
        if (parsed.mobileAppEnabled !== undefined) {
          items.push(`Mobile App: ${parsed.mobileAppEnabled ? "Enabled" : "Disabled"}`);
        }
        if (parsed.mobileUsername) {
          items.push(`Username: ${parsed.mobileUsername}`);
        }
        if (parsed.passwordChanged) {
          items.push(`Password: Changed`);
        }
        return items.length > 0 ? items : null;
      }
      
      // Handle create with agreementType
      if (action === "create" && parsed.agreementType) {
        return [`${t.collaborators?.tabs?.agreements || "Agreement"}: ${parsed.agreementType}`];
      }
      
      // Handle any other parsed object with fields
      if (typeof parsed === "object" && !parsed.message) {
        for (const [key, value] of Object.entries(parsed)) {
          if (key !== "changes" && value !== undefined && value !== null) {
            const fieldLabel = t.collaborators?.fields?.[key as keyof typeof t.collaborators.fields] || key;
            items.push(`${fieldLabel}: ${formatFieldValue(value)}`);
          }
        }
        if (items.length > 0) return items;
      }
      
      // Handle message
      if (parsed.message) {
        return [parsed.message];
      }
      
      return null;
    } catch {
      return [details];
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activityLogs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {t.collaborators.history?.noHistory || t.common.noData}
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
      <div className="space-y-6">
        {activityLogs.map((log) => (
          <div key={log.id} className="relative pl-10">
            <div className="absolute left-2 w-5 h-5 rounded-full bg-background border-2 border-border flex items-center justify-center">
              {getActionIcon(log.action)}
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">{getActionLabel(log.action)}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
              {(() => {
                const detailItems = formatDetails(log.details, log.action);
                if (detailItems && detailItems.length > 0) {
                  return (
                    <ul className="text-sm text-muted-foreground list-disc list-inside space-y-0.5">
                      {detailItems.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  );
                }
                return null;
              })()}
              {log.userId && (
                <p className="text-xs text-muted-foreground mt-2">
                  {t.collaborators.actions.by}: {getUserName(log.userId)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function computeSKIban(accountNumber: string, bankCode: string): string {
  const acc = accountNumber.replace(/[\s\-]/g, "");
  const bk = bankCode.replace(/[\s\-]/g, "");
  if (bk.length !== 4 || acc.length < 1 || acc.length > 10) return "";
  const paddedAcc = acc.padStart(10, "0");
  const bban = bk + "00" + paddedAcc;
  const rearranged = bban + "281200";
  let remainder = BigInt(rearranged) % 97n;
  const checkDigits = String(98n - remainder).padStart(2, "0");
  return `SK${checkDigits}${bban}`;
}

function BankAccountSection({ bankAccountIban, swiftCode, onIbanChange, onSwiftChange, countryCode, isHidden, isReadonly, t }: {
  bankAccountIban: string; swiftCode: string; onIbanChange: (v: string) => void; onSwiftChange: (v: string) => void;
  countryCode: string; isHidden: (f: string) => boolean; isReadonly: (f: string) => boolean; t: any;
}) {
  const [localAccount, setLocalAccount] = useState("");
  const [localBankCode, setLocalBankCode] = useState("");

  const handleConvert = () => {
    const iban = computeSKIban(localAccount, localBankCode);
    if (iban) onIbanChange(iban);
  };

  return (
    <>
      <div className="p-4 border rounded-lg space-y-3 bg-muted/30">
        <Label className="text-sm font-medium">{t.collaborators?.fields?.accountAndBankCode || "Account number and bank code"}</Label>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t.collaborators?.fields?.accountNumber || "Account Number"}</Label>
            <Input
              value={localAccount}
              onChange={(e) => setLocalAccount(e.target.value.replace(/[^0-9\-]/g, ""))}
              placeholder="1234567890"
              data-testid="wizard-input-account-number"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t.collaborators?.fields?.bankCode || "Bank Code"}</Label>
            <Input
              value={localBankCode}
              onChange={(e) => setLocalBankCode(e.target.value.replace(/[^0-9]/g, "").substring(0, 4))}
              placeholder="0200"
              maxLength={4}
              data-testid="wizard-input-bank-code"
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="secondary"
              onClick={handleConvert}
              disabled={!localAccount || localBankCode.length !== 4}
              className="w-full"
              data-testid="btn-convert-iban"
            >
              {t.collaborators?.fields?.calculateIban || "Calculate IBAN"}
            </Button>
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {!isHidden("bank_account") && (
          <div className="space-y-2">
            <Label>{t.collaborators.fields.bankAccountIban}</Label>
            <Input
              value={bankAccountIban}
              onChange={(e) => onIbanChange(e.target.value)}
              placeholder="SK..."
              data-testid="wizard-input-collaborator-iban"
              disabled={isReadonly("bank_account")}
              className={isReadonly("bank_account") ? "bg-muted" : ""}
            />
          </div>
        )}
        {!isHidden("bank_account") && (
          <div className="space-y-2">
            <Label>{t.collaborators.fields.swiftCode}</Label>
            <Input
              value={swiftCode}
              onChange={(e) => onSwiftChange(e.target.value)}
              data-testid="wizard-input-collaborator-swift"
              disabled={isReadonly("bank_account")}
              className={isReadonly("bank_account") ? "bg-muted" : ""}
            />
          </div>
        )}
      </div>
    </>
  );
}

function DocumentsPanel({ collaboratorId, t }: { collaboratorId: string; t: any }) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docNote, setDocNote] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: documents = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/collaborators", collaboratorId, "documents"],
    queryFn: async () => {
      const res = await fetch(`/api/collaborators/${collaboratorId}/documents`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!collaboratorId,
  });

  const handleUpload = async (file: globalThis.File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (docNote.trim()) fd.append("note", docNote.trim());
      const res = await fetch(`/api/collaborators/${collaboratorId}/documents`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) throw new Error("Upload failed");
      queryClient.invalidateQueries({ queryKey: ["/api/collaborators", collaboratorId, "documents"] });
      setDocNote("");
      toast({ title: t.collaborators?.fields?.documentUploaded || "Document uploaded" });
    } catch (err) {
      toast({ title: t.common?.error || "Error", description: (err as any).message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (docId: string) => {
    try {
      const res = await fetch(`/api/collaborators/${collaboratorId}/documents/${docId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
      queryClient.invalidateQueries({ queryKey: ["/api/collaborators", collaboratorId, "documents"] });
      toast({ title: t.collaborators?.fields?.documentDeleted || "Document deleted" });
    } catch (err) {
      toast({ title: t.common?.error || "Error", variant: "destructive" });
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mime: string | null) => {
    if (mime?.startsWith("image/")) return <Eye className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  return (
    <div className="space-y-4">
      <div className="p-4 border-2 border-dashed rounded-lg space-y-3">
        <div className="flex items-center gap-2">
          <FileUp className="h-5 w-5 text-muted-foreground" />
          <Label className="font-medium">{t.collaborators?.fields?.uploadDocument || "Upload document"}</Label>
        </div>
        <div className="space-y-2">
          <Input
            value={docNote}
            onChange={(e) => setDocNote(e.target.value)}
            placeholder={t.collaborators?.fields?.documentNote || "Note (optional)"}
            data-testid="input-doc-note"
          />
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) handleUpload(e.target.files[0]);
          }}
          data-testid="input-doc-file"
        />
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full gap-2"
          data-testid="btn-upload-doc"
        >
          <Upload className="h-4 w-4" />
          {uploading ? (t.common?.uploading || "Uploading...") : (t.collaborators?.fields?.selectFile || "Select file")}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <FolderOpen className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{t.collaborators?.fields?.noDocuments || "No documents"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc: any) => (
            <div key={doc.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors" data-testid={`doc-row-${doc.id}`}>
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                {getFileIcon(doc.mimeType)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.originalName}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{doc.fileSize ? formatSize(doc.fileSize) : ""}</span>
                  <span>•</span>
                  <span>{new Date(doc.createdAt).toLocaleDateString("sk-SK")} {new Date(doc.createdAt).toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                {doc.note && <p className="text-xs text-muted-foreground italic mt-0.5">{doc.note}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    window.open(`/api/collaborators/${collaboratorId}/documents/${doc.id}/download`, "_blank");
                  }}
                  title={t.common?.download || "Stiahnuť"}
                  data-testid={`btn-download-doc-${doc.id}`}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => fileInputRef.current?.click()}
                  title={t.collaborators?.fields?.reupload || "Nahrať znova"}
                  data-testid={`btn-reupload-doc-${doc.id}`}
                >
                  <Upload className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(doc.id)}
                  title={t.common?.delete || "Vymazať"}
                  data-testid={`btn-delete-doc-${doc.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CollaboratorFormWizard({ initialData, onSuccess, onCancel, positionScopeFilter, hideSvetZdravia, prefillData, onCreated }: CollaboratorFormWizardProps) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const { isHidden, isReadonly } = useModuleFieldPermissions("collaborators");
  
  const isEditMode = !!initialData;
  
  const wizardSteps = isEditMode 
    ? WIZARD_STEPS 
    : WIZARD_STEPS.filter(step => step.id !== "history" && step.id !== "connect" && step.id !== "actions" && step.id !== "medicalNetwork" && step.id !== "documents");
  
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  
  // Pending data for Add mode (saved after collaborator is created)
  const [pendingAddresses, setPendingAddresses] = useState<PendingAddress[]>([]);
  const [pendingAgreements, setPendingAgreements] = useState<PendingAgreement[]>([]);
  
  const [mobileCredentials, setMobileCredentials] = useState({
    mobileAppEnabled: initialData?.mobileAppEnabled ?? false,
    mobileUsername: initialData?.mobileUsername ?? "",
    mobilePassword: "",
    mobilePasswordConfirm: "",
    mobileWebrtcEnabled: initialData?.mobileWebrtcEnabled ?? false,
    mobileSipExtensionId: initialData?.mobileSipExtensionId ?? "",
    mobileCallRecording: initialData?.mobileCallRecording ?? true,
    outboundCallerId: (initialData as any)?.outboundCallerId ?? "",
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialData?.avatarUrl || null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const { data: networkMemberships = [] } = useQuery<any[]>({
    queryKey: ["/api/hospital-network-memberships"],
  });
  const collabNetworks = initialData?.id ? networkMemberships.filter((m: any) => m.collaborator_id === initialData.id).map((m: any) => m.network_name).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i) : [];

  const [formData, setFormData] = useState<CollaboratorFormData>(() =>
    initialData
      ? {
          legacyId: initialData.legacyId || "",
          countryCode: initialData.countryCode,
          countryCodes: initialData.countryCodes || [initialData.countryCode],
          titleBefore: initialData.titleBefore || "",
          firstName: initialData.firstName,
          middleName: (initialData as any).middleName || "",
          lastName: initialData.lastName,
          maidenName: initialData.maidenName || "",
          titleAfter: initialData.titleAfter || "",
          birthNumber: initialData.birthNumber || "",
          birthDay: initialData.birthDay || 0,
          birthMonth: initialData.birthMonth || 0,
          birthYear: initialData.birthYear || 0,
          birthPlace: initialData.birthPlace || "",
          healthInsuranceId: initialData.healthInsuranceId || "",
          maritalStatus: initialData.maritalStatus || "",
          professionalClassification: initialData.professionalClassification || "",
          highestEducation: initialData.highestEducation || "",
          workplaceName: initialData.workplaceName || "",
          isManager: initialData.isManager || false,
          collaboratorType: initialData.collaboratorType || "",
          partnerCategory: initialData.partnerCategory || "",
          agreementType: (initialData as any).agreementType || "",
          cbcActivities: Array.isArray((initialData as any).cbcActivities) ? (initialData as any).cbcActivities : [],
          phone: initialData.phone || "",
          mobile: initialData.mobile || "",
          mobile2: initialData.mobile2 || "",
          otherContact: initialData.otherContact || "",
          email: initialData.email || "",
          bankAccountIban: initialData.bankAccountIban || "",
          swiftCode: initialData.swiftCode || "",
          clientContact: initialData.clientContact,
          representativeId: initialData.representativeId || "",
          representativeIds: (initialData as any).representativeIds || [],
          isActive: initialData.isActive,
          svetZdravia: initialData.svetZdravia,
          companyName: initialData.companyName || "",
          ico: initialData.ico || "",
          dic: initialData.dic || "",
          icDph: initialData.icDph || "",
          companyIban: initialData.companyIban || "",
          companySwift: initialData.companySwift || "",
          monthRewards: initialData.monthRewards,
          rewardType: (initialData as any).rewardType || "",
          fixedRewardAmount: (initialData as any).fixedRewardAmount || "",
          fixedRewardCurrency: (initialData as any).fixedRewardCurrency || "EUR",
          percentageRewards: (initialData as any).percentageRewards || {},
          note: initialData.note || "",
          hospitalId: initialData.hospitalId || "",
          hospitalIds: initialData.hospitalIds || [],
          leadSource: (initialData as any).leadSource || "",
          leadSourceDate: (initialData as any).leadSourceDate ? new Date((initialData as any).leadSourceDate).toISOString() : "",
          leadSourceNotes: (initialData as any).leadSourceNotes || "",
          conferenceName: (initialData as any).conferenceName || "",
          conferenceDate: (initialData as any).conferenceDate ? new Date((initialData as any).conferenceDate).toISOString() : "",
          isReferredByDoctor: !!(initialData as any).isReferredByDoctor,
          isFromConference: !!(initialData as any).isFromConference,
        }
      : {
          legacyId: "",
          countryCode: "",
          countryCodes: [],
          titleBefore: "",
          firstName: "",
          middleName: "",
          lastName: "",
          maidenName: "",
          titleAfter: "",
          birthNumber: "",
          birthDay: 0,
          birthMonth: 0,
          birthYear: 0,
          birthPlace: "",
          healthInsuranceId: "",
          maritalStatus: "",
          professionalClassification: "",
          highestEducation: "",
          workplaceName: "",
          isManager: false,
          collaboratorType: "",
          partnerCategory: "",
          agreementType: "",
          cbcActivities: [],
          phone: "",
          mobile: "",
          mobile2: "",
          otherContact: "",
          email: "",
          bankAccountIban: "",
          swiftCode: "",
          clientContact: false,
          representativeId: "",
          representativeIds: [],
          isActive: true,
          svetZdravia: false,
          companyName: "",
          ico: "",
          dic: "",
          icDph: "",
          companyIban: "",
          companySwift: "",
          monthRewards: false,
          rewardType: "",
          fixedRewardAmount: "",
          fixedRewardCurrency: "EUR",
          percentageRewards: {},
          note: "",
          hospitalId: "",
          hospitalIds: [],
          leadSource: "",
          leadSourceDate: "",
          leadSourceNotes: "",
          conferenceName: "",
          conferenceDate: "",
          isReferredByDoctor: false,
          isFromConference: false,
          ...(prefillData || {}),
        }
  );

  const { data: users = [] } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
  });

  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
  });

  const { data: healthInsurances = [] } = useQuery<HealthInsurance[]>({
    queryKey: ["/api/config/health-insurance"],
  });

  const { data: hospitals = [] } = useQuery<any[]>({
    queryKey: ["/api/hospitals/lookup"],
  });

  const { data: availableSipExtensions = [] } = useQuery<any[]>({
    queryKey: ["/api/sip-extensions/available-for-mobile", formData.countryCode],
    queryFn: async () => {
      const res = await fetch(`/api/sip-extensions/available-for-mobile?countryCode=${formData.countryCode}`);
      if (!res.ok) throw new Error("Failed to fetch SIP extensions");
      return res.json();
    },
    enabled: !!formData.countryCode && mobileCredentials.mobileWebrtcEnabled,
  });

  // Get representative role IDs
  const representativeRoleIds = roles
    .filter(r => r.name.toLowerCase().includes("representative") || r.name.toLowerCase().includes("reprezentant") || r.name.toLowerCase().includes("representant"))
    .map(r => r.id);

  // Filter users to only show representatives (users with representative role)
  const representativeUsers = users.filter(u => 
    u.roleId && representativeRoleIds.includes(u.roleId)
  );

  const filteredHealthInsurances = formData.countryCode
    ? healthInsurances.filter((hi) => hi.countryCode === formData.countryCode)
    : healthInsurances;

  // Filter hospitals by collaborator's assigned countries (countryCodes)
  const filteredHospitals = formData.countryCodes && formData.countryCodes.length > 0
    ? hospitals.filter((h) => formData.countryCodes.includes(h.countryCode))
    : formData.countryCode
      ? hospitals.filter((h) => h.countryCode === formData.countryCode)
      : hospitals;

  // ===== Referral system (mirrors clinics, but targets persons/collaborators) =====
  type CollabRefRow = { id: string; collaboratorId: string; referringCollaboratorId: string; referralType: string; referringCollaborator: any | null };
  type ReverseRefRow = { id: string; collaboratorId: string; referringCollaboratorId: string; referralType: string; collaborator: any | null };

  const { data: existingCollabReferrals } = useQuery<CollabRefRow[]>({
    queryKey: ["/api/collaborator-referrals", initialData?.id],
    enabled: !!initialData?.id,
  });
  const { data: reverseCollabReferrals } = useQuery<ReverseRefRow[]>({
    queryKey: ["/api/collaborator-referred-by-me", initialData?.id],
    enabled: !!initialData?.id,
  });

  const formatPersonName = (p: any): string => {
    if (!p) return "";
    const parts = [p.titleBefore, p.firstName, p.lastName].filter(Boolean);
    const name = parts.join(" ").trim();
    return p.titleAfter ? `${name}, ${p.titleAfter}` : name;
  };

  // referralType: 'doctor_referral' (recommended-by) | 'conference'
  const [referrals, setReferrals] = useState<Array<{ personId: string; personName: string; referralType: string }>>([]);
  // suggests = reverse referrals this person has made (referralType 'doctor_suggests')
  const [suggestsReferrals, setSuggestsReferrals] = useState<Array<{ personId: string; personName: string }>>([]);
  const [referralSearch, setReferralSearch] = useState("");
  const [suggestsSearch, setSuggestsSearch] = useState("");
  const [confReferralSearch, setConfReferralSearch] = useState("");
  const [nestedPersonForm, setNestedPersonForm] = useState<{ direction: "recommendedBy" | "suggests" | "conference"; lastName: string } | null>(null);
  const userEditedReferralsRef = useRef(false);

  useEffect(() => {
    if (userEditedReferralsRef.current) return;
    if (existingCollabReferrals) {
      setReferrals(
        existingCollabReferrals
          .filter(r => r.referringCollaborator && (r.referralType === "doctor_referral" || r.referralType === "doctor_suggests" || r.referralType === "conference"))
          .map(r => ({
            personId: String(r.referringCollaboratorId),
            personName: formatPersonName(r.referringCollaborator),
            referralType: r.referralType,
          }))
      );
    }
  }, [existingCollabReferrals]);

  useEffect(() => {
    if (userEditedReferralsRef.current) return;
    if (reverseCollabReferrals) {
      setSuggestsReferrals(
        reverseCollabReferrals
          .filter(r => r.collaborator && r.referralType === "doctor_suggests")
          .map(r => ({
            personId: String(r.collaboratorId),
            personName: formatPersonName(r.collaborator),
          }))
      );
    }
  }, [reverseCollabReferrals]);

  // Search collaborators on demand (server-side filter)
  const personSearchQuery = (referralSearch || suggestsSearch || confReferralSearch).trim();
  const { data: personSearchResults = [] } = useQuery<any[]>({
    queryKey: ["/api/collaborators/lookup", personSearchQuery, formData.countryCode],
    queryFn: async () => {
      if (personSearchQuery.length < 2) return [];
      const params = new URLSearchParams({ q: personSearchQuery, limit: "20" });
      if (formData.countryCode) params.set("countries", formData.countryCode);
      const res = await fetch(`/api/collaborators/lookup?${params.toString()}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: personSearchQuery.length >= 2,
  });

  const filterPersonsExcluding = (searchStr: string, excludeIds: Set<string>) => {
    if (!searchStr || searchStr.length < 2) return [];
    return personSearchResults.filter((p: any) => {
      if (initialData && String(p.id) === String(initialData.id)) return false;
      return !excludeIds.has(String(p.id));
    });
  };

  const recommendedExcludeIds = new Set(referrals.filter(r => r.referralType === "doctor_referral" || r.referralType === "doctor_suggests").map(r => r.personId));
  const conferenceExcludeIds = new Set(referrals.filter(r => r.referralType === "conference").map(r => r.personId));
  const suggestsExcludeIds = new Set(suggestsReferrals.map(r => r.personId));

  const filteredPersonsRecommended = filterPersonsExcluding(referralSearch, recommendedExcludeIds);
  const filteredPersonsConference = filterPersonsExcluding(confReferralSearch, conferenceExcludeIds);
  const filteredPersonsSuggests = filterPersonsExcluding(suggestsSearch, suggestsExcludeIds);

  const addRecommendedReferral = (person: any, type: "doctor_referral" | "conference") => {
    userEditedReferralsRef.current = true;
    setReferrals(prev => [...prev, { personId: String(person.id), personName: formatPersonName(person), referralType: type }]);
    if (type === "doctor_referral") setReferralSearch("");
    else setConfReferralSearch("");
  };
  const removeRecommendedReferral = (personId: string, type: string) => {
    userEditedReferralsRef.current = true;
    setReferrals(prev => prev.filter(r => !(r.personId === personId && r.referralType === type)));
  };
  const addSuggestsReferral = (person: any) => {
    userEditedReferralsRef.current = true;
    setSuggestsReferrals(prev => [...prev, { personId: String(person.id), personName: formatPersonName(person) }]);
    setSuggestsSearch("");
  };
  const removeSuggestsReferral = (personId: string) => {
    userEditedReferralsRef.current = true;
    setSuggestsReferrals(prev => prev.filter(r => r.personId !== personId));
  };

  const handleNestedPersonCreated = async (newPerson: { id: string; titleBefore?: string | null; firstName?: string | null; lastName?: string | null; titleAfter?: string | null }) => {
    if (!newPerson?.id || !nestedPersonForm) return;
    userEditedReferralsRef.current = true;
    const personName = formatPersonName(newPerson) || newPerson.lastName || "";
    const direction = nestedPersonForm.direction;
    if (direction === "suggests") {
      setSuggestsReferrals(prev => [...prev, { personId: String(newPerson.id), personName }]);
    } else if (direction === "conference") {
      setReferrals(prev => [...prev, { personId: String(newPerson.id), personName, referralType: "conference" }]);
    } else {
      setReferrals(prev => [...prev, { personId: String(newPerson.id), personName, referralType: "doctor_referral" }]);
    }
    queryClient.invalidateQueries({ queryKey: ["/api/collaborators"] });
    queryClient.invalidateQueries({ queryKey: ["/api/collaborators/lookup"] });
    setReferralSearch(""); setSuggestsSearch(""); setConfReferralSearch("");
  };

  const doctorReferrals = referrals.filter(r => r.referralType === "doctor_referral" || r.referralType === "doctor_suggests");
  const conferenceReferrals = referrals.filter(r => r.referralType === "conference");

  const saveMutation = useMutation({
    mutationFn: async (data: CollaboratorFormData) => {
      console.log("[Wizard] mutationFn starting, data:", data);
      console.log("[Wizard] initialData:", initialData);
      let collaboratorId: string;
      
      try {
        if (initialData) {
          console.log("[Wizard] Calling PUT /api/collaborators/" + initialData.id);
          await apiRequest("PUT", `/api/collaborators/${initialData.id}`, data);
          collaboratorId = initialData.id;
        } else {
          console.log("[Wizard] Calling POST /api/collaborators");
          const response = await apiRequest("POST", "/api/collaborators", data);
          const newCollaborator = await response.json();
          collaboratorId = newCollaborator.id;
          console.log("[Wizard] Created collaborator with id:", collaboratorId);
          if (onCreated) {
            try { await onCreated({ id: collaboratorId }); } catch (e) { console.error("[Wizard] onCreated callback failed:", e); }
          }
          
          // Save pending addresses for new collaborator
          for (const address of pendingAddresses) {
            if (address.streetNumber || address.city || address.postalCode || address.name) {
              await apiRequest("POST", `/api/collaborators/${collaboratorId}/addresses`, {
                addressType: address.addressType,
                name: address.name,
                streetNumber: address.streetNumber,
                city: address.city,
                postalCode: address.postalCode,
                country: address.country,
              });
            }
          }
          
          // Save pending agreements for new collaborator
          for (const agreement of pendingAgreements) {
            await apiRequest("POST", `/api/collaborators/${collaboratorId}/agreements`, {
              billingCompanyId: agreement.billingCompanyId || null,
              contractNumber: agreement.contractNumber,
              agreementForm: agreement.agreementForm,
              validFromDay: agreement.validFromDay,
              validFromMonth: agreement.validFromMonth,
              validFromYear: agreement.validFromYear,
              validToDay: agreement.validToDay,
              validToMonth: agreement.validToMonth,
              validToYear: agreement.validToYear,
              agreementSentDay: agreement.agreementSentDay,
              agreementSentMonth: agreement.agreementSentMonth,
              agreementSentYear: agreement.agreementSentYear,
              agreementReturnedDay: agreement.agreementReturnedDay,
              agreementReturnedMonth: agreement.agreementReturnedMonth,
              agreementReturnedYear: agreement.agreementReturnedYear,
              isValid: agreement.isValid,
              notes: agreement.notes,
            });
          }
        }
      } catch (apiError) {
        console.error("[Wizard] API request failed:", apiError);
        throw apiError;
      }
      
      // Save mobile credentials if enabled or if previously enabled
      if (mobileCredentials.mobileAppEnabled || initialData?.mobileAppEnabled) {
        const mobileData: any = {
          mobileAppEnabled: mobileCredentials.mobileAppEnabled,
        };
        
        if (mobileCredentials.mobileAppEnabled) {
          mobileData.mobileUsername = mobileCredentials.mobileUsername;
          if (mobileCredentials.mobilePassword) {
            mobileData.mobilePassword = mobileCredentials.mobilePassword;
          }
          mobileData.mobileWebrtcEnabled = mobileCredentials.mobileWebrtcEnabled;
          mobileData.mobileSipExtensionId = mobileCredentials.mobileSipExtensionId || null;
          mobileData.mobileCallRecording = mobileCredentials.mobileCallRecording;
          mobileData.outboundCallerId = mobileCredentials.outboundCallerId || null;
        } else {
          mobileData.mobileWebrtcEnabled = false;
          mobileData.mobileSipExtensionId = null;
          mobileData.mobileCallRecording = true;
          mobileData.outboundCallerId = null;
        }
        
        await apiRequest("PUT", `/api/collaborators/${collaboratorId}/mobile-credentials`, mobileData);
      }

      // Sync collaborator referrals (forward + reverse): delete old, insert current selection
      try {
        if (existingCollabReferrals && Array.isArray(existingCollabReferrals)) {
          for (const old of existingCollabReferrals) {
            await apiRequest("DELETE", `/api/collaborator-referrals/${old.id}`);
          }
        }
        if (reverseCollabReferrals && Array.isArray(reverseCollabReferrals)) {
          for (const old of reverseCollabReferrals) {
            if (old.referralType === "doctor_suggests") {
              await apiRequest("DELETE", `/api/collaborator-referrals/${old.id}`);
            }
          }
        }
        for (const ref of referrals) {
          await apiRequest("POST", "/api/collaborator-referrals", {
            collaboratorId,
            referringCollaboratorId: ref.personId,
            referralType: ref.referralType,
            conferenceName: ref.referralType === "conference" ? (data.conferenceName || null) : null,
            conferenceDate: ref.referralType === "conference" && data.conferenceDate ? data.conferenceDate : null,
          });
        }
        for (const ref of suggestsReferrals) {
          await apiRequest("POST", "/api/collaborator-referrals", {
            collaboratorId: ref.personId,
            referringCollaboratorId: collaboratorId,
            referralType: "doctor_suggests",
          });
        }
      } catch (refErr) {
        console.error("[Wizard] Saving collaborator referrals failed:", refErr);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collaborators"] });
      queryClient.invalidateQueries({ queryKey: ["/api/collaborators/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/collaborator-referrals"] });
      // Invalidate activity logs for this collaborator
      if (initialData?.id) {
        queryClient.invalidateQueries({ queryKey: ["/api/activity-logs", "collaborator", initialData.id] });
      }
      toast({ title: t.success.saved });
      onSuccess();
    },
    onError: (error: any) => {
      console.error("[Wizard] Save error:", error);
      const errorMessage = error?.message || error?.toString() || t.errors.saveFailed;
      toast({ title: errorMessage, variant: "destructive" });
    },
  });

  const progress = ((currentStep + 1) / wizardSteps.length) * 100;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === wizardSteps.length - 1;
  const currentStepId = wizardSteps[currentStep]?.id;

  const validateCurrentStep = (): boolean => {
    switch (currentStepId) {
      case "personal":
        return !!formData.firstName && !!formData.lastName && formData.countryCodes.length > 0;
      case "mobile":
        if (mobileCredentials.mobileAppEnabled) {
          if (!mobileCredentials.mobileUsername) {
            toast({ title: t.collaborators.mobileApp.usernameRequired, variant: "destructive" });
            return false;
          }
          if (!initialData?.mobilePasswordHash && !mobileCredentials.mobilePassword) {
            toast({ title: t.collaborators.mobileApp.passwordRequired, variant: "destructive" });
            return false;
          }
          if (mobileCredentials.mobilePassword && mobileCredentials.mobilePassword !== mobileCredentials.mobilePasswordConfirm) {
            toast({ title: t.collaborators.mobileApp.passwordMismatch, variant: "destructive" });
            return false;
          }
        }
        return true;
      default:
        return true;
    }
  };

  const isSaveStep = currentStepId === "mobile";
  
  const handleNext = () => {
    console.log("[Wizard] handleNext called, currentStep:", currentStep, "isSaveStep:", isSaveStep, "wizardSteps.length:", wizardSteps.length);
    
    const isValid = validateCurrentStep();
    console.log("[Wizard] validateCurrentStep result:", isValid);
    
    if (!isValid) {
      return;
    }
    
    setCompletedSteps(prev => new Set(Array.from(prev).concat(currentStep)));
    
    // Save on mobile step (step 6), which is the last step
    if (isSaveStep) {
      console.log("[Wizard] Calling saveMutation.mutate with formData:", formData);
      saveMutation.mutate(formData);
      // Mutation onSuccess will call onSuccess() to close dialog
      return;
    } else {
      console.log("[Wizard] Moving to next step:", currentStep + 1);
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleStepClick = (index: number) => {
    if (index === currentStep) {
      return;
    }
    
    // When editing existing collaborator, allow clicking on any step
    if (initialData) {
      setCurrentStep(index);
      return;
    }
    
    // For new collaborators, require completing previous steps
    if (index < currentStep) {
      setCurrentStep(index);
    } else {
      for (let i = 0; i < index; i++) {
        if (!completedSteps.has(i)) {
          toast({ title: t.wizard.completePreviousSteps, variant: "destructive" });
          return;
        }
      }
      setCurrentStep(index);
    }
  };

  const getStepTitle = (stepId: string): string => {
    const steps = t.wizard.steps;
    const stepTitles: Record<string, string> = {
      personal: steps.personalInfo,
      contact: steps.contactDetails,
      banking: steps.banking,
      companyAddress: t.collaborators.tabs.companyAndAddresses,
      agreements: t.collaborators.tabs.agreements,
      documents: t.collaborators?.tabs?.documents || "Dokumenty",
      actions: t.collaborators.tabs.actions || "Úkony",
      history: t.collaborators.tabs.history,
      connect: t.common.indexusConnect,
      medicalNetwork: (() => { const d: Record<string, string> = { sk: "Zdravotnícke zariadenia", cs: "Zdravotnická zařízení", en: "Healthcare Facilities", hu: "Egészségügyi intézmények", ro: "Unități sanitare", it: "Strutture sanitarie", de: "Gesundheitseinrichtungen" }; return d[locale] || "Healthcare Facilities"; })(),
      mobile: steps.mobile,
    };
    return stepTitles[stepId] || stepId;
  };

  const getStepDescription = (stepId: string): string => {
    const steps = t.wizard.steps;
    const stepDescs: Record<string, string> = {
      personal: steps.personalInfoDesc,
      contact: steps.contactDetailsDesc,
      banking: steps.bankingDesc,
      companyAddress: t.collaborators.companyAddressesDescription,
      agreements: t.collaborators.agreementsDescription,
      documents: t.collaborators?.documentsDescription || "Dokumenty priradené k spolupracovníkovi",
      actions: t.collaborators.actionsDesc || "Prehľad úkonov spolupracovníka",
      history: t.collaborators.historyDescription,
      connect: t.collaborators.connectDescription || "Call history, visits and activities from INDEXUS Connect",
      medicalNetwork: (() => { const d: Record<string, string> = { sk: "Prehľad nemocníc a ambulancií kde je spolupracovník zaradený", cs: "Přehled nemocnic a ambulancí, kde je spolupracovník zařazen", en: "Overview of hospitals and clinics where the collaborator is assigned", hu: "A munkatárs hozzárendelt kórházainak és rendelőinek áttekintése", ro: "Prezentare generală a spitalelor și clinicilor în care este atribuit colaboratorul", it: "Panoramica degli ospedali e delle cliniche in cui è assegnato il collaboratore", de: "Übersicht der Krankenhäuser und Praxen, denen der Mitarbeiter zugeordnet ist" }; return d[locale] || "Medical Network"; })(),
      mobile: steps.mobileDesc,
    };
    return stepDescs[stepId] || "";
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !initialData?.id) return;
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await fetch(`/api/collaborators/${initialData.id}/avatar`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setAvatarUrl(data.avatarUrl);
      }
    } catch (err) {
      console.error("Avatar upload failed:", err);
    } finally {
      setAvatarUploading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStepId) {
      case "personal":
        return (
          <div className="space-y-4">
            <CollaboratorPositionsBlock
              personId={initialData?.id}
              personCountryCodes={formData.countryCodes}
              t={t}
              locale={locale}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t.collaborators.fields.country} *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                      data-testid="wizard-select-collaborator-country"
                    >
                      {formData.countryCodes.length > 0 ? (
                        <span className="flex flex-wrap gap-1">
                          {formData.countryCodes.map((code) => (
                            <Badge key={code} variant="secondary" className="text-xs">
                              {getCountryFlag(code)} {code}
                            </Badge>
                          ))}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{t.collaborators.fields.country}</span>
                      )}
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-2" align="start">
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {COUNTRIES.map((country) => {
                        const isChecked = formData.countryCodes.includes(country.code);
                        return (
                          <div
                            key={country.code}
                            className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                            onClick={() => {
                              let newCountryCodes: string[];
                              if (isChecked) {
                                newCountryCodes = formData.countryCodes.filter(c => c !== country.code);
                              } else {
                                newCountryCodes = [...formData.countryCodes, country.code];
                              }
                              const primaryCountry = newCountryCodes[0] || "";
                              setFormData({ 
                                ...formData, 
                                countryCodes: newCountryCodes,
                                countryCode: primaryCountry,
                                healthInsuranceId: primaryCountry !== formData.countryCode ? "" : formData.healthInsuranceId,
                                hospitalId: primaryCountry !== formData.countryCode ? "" : formData.hospitalId,
                              });
                            }}
                            data-testid={`checkbox-country-${country.code}`}
                          >
                            <Checkbox checked={isChecked} />
                            <span>{getCountryFlag(country.code)} {country.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{(() => {
                const d: Record<string, string> = { sk: "Činnosti pre CBC", cs: "Činnosti pro CBC", en: "Activities for CBC", hu: "Tevékenységek a CBC-hez", ro: "Activități pentru CBC", it: "Attività per CBC", de: "Aktivitäten für CBC" };
                return d[locale] || "Activities for CBC";
              })()}</Label>
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const labels: Record<string, Record<string, string>> = {
                    sampling_kits: { sk: "Odberové sady", cs: "Odběrové sady", en: "Sampling kits", hu: "Mintavételi készletek", ro: "Truse de prelevare", it: "Kit di prelievo", de: "Probenahme-Sets" },
                    employee_agreements: { sk: "Dohody so zamestnancami", cs: "Dohody se zaměstnanci", en: "Employee agreements", hu: "Munkavállalói megállapodások", ro: "Acorduri cu angajații", it: "Accordi con i dipendenti", de: "Mitarbeitervereinbarungen" },
                    nonconforming_work: { sk: "Nezhodné práce", cs: "Neshodné práce", en: "Nonconforming work", hu: "Nem megfelelő munka", ro: "Lucrări neconforme", it: "Lavori non conformi", de: "Nicht konforme Arbeiten" },
                    invoicing: { sk: "Fakturácia", cs: "Fakturace", en: "Invoicing", hu: "Számlázás", ro: "Facturare", it: "Fatturazione", de: "Rechnungsstellung" },
                    sampling_device_docs: { sk: "Dokumentácia odberového zariadenia", cs: "Dokumentace odběrového zařízení", en: "Sampling device documentation", hu: "Mintavevő eszköz dokumentációja", ro: "Documentația dispozitivului de prelevare", it: "Documentazione del dispositivo di prelievo", de: "Dokumentation des Probenahmegeräts" },
                    other: { sk: "Iné", cs: "Jiné", en: "Other", hu: "Egyéb", ro: "Altele", it: "Altro", de: "Sonstiges" },
                  };
                  const order = ["sampling_kits", "employee_agreements", "nonconforming_work", "invoicing", "sampling_device_docs", "other"];
                  return order.map((code) => {
                    const selected = formData.cbcActivities.includes(code);
                    const label = labels[code][locale] || labels[code].en;
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => {
                          const next = selected
                            ? formData.cbcActivities.filter((c) => c !== code)
                            : [...formData.cbcActivities, code];
                          setFormData({ ...formData, cbcActivities: next });
                        }}
                        className={cn(
                          "px-3 py-1.5 rounded-full border text-xs font-medium transition-all",
                          selected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-muted bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        )}
                        data-testid={`btn-cbc-activity-${code}`}
                      >
                        {label}
                      </button>
                    );
                  });
                })()}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                {isEditMode && (
                  <Collapsible className="contents">
                    <CollapsibleTrigger asChild>
                      <Button type="button" variant="ghost" size="sm" className="gap-2 text-sm text-muted-foreground hover:text-foreground" data-testid="toggle-legacy-fields">
                        <ChevronRight className="h-4 w-4 transition-transform [[data-state=open]_&]:rotate-90" />
                        {((): string => {
                          const d: Record<string, string> = { sk: "Legacy údaje", cs: "Legacy údaje", en: "Legacy fields", hu: "Legacy mezők", ro: "Câmpuri legacy", it: "Campi legacy", de: "Legacy-Felder" };
                          return d[locale] || "Legacy fields";
                        })()}
                        {(initialData as any)?.dataSource === 'iscbc' && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                            ISCBC
                          </Badge>
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="basis-full order-last w-full">
                      <div className="grid gap-4 sm:grid-cols-2 pt-2">
                                        {!isHidden("legacy_id") && (
                                          <div className="space-y-2">
                                            <Label>{t.collaborators.legacyId}</Label>
                                            <Input
                                              value={formData.legacyId}
                                              onChange={(e) => setFormData({ ...formData, legacyId: e.target.value })}
                                              placeholder={t.collaborators.legacyId}
                                              data-testid="wizard-input-collaborator-legacy-id"
                                              disabled={isReadonly("legacy_id")}
                                              className={isReadonly("legacy_id") ? "bg-muted" : ""}
                                            />
                                          </div>
                                        )}
                                        <div className="space-y-2">
                                          <Label>{t.collaborators?.fields?.legacyType || "Legacy Type"}</Label>
                                          <Select
                                            value={formData.collaboratorType || "_none"}
                                            onValueChange={(value) => setFormData({ ...formData, collaboratorType: value === "_none" ? "" : value })}
                                            disabled={isEditMode}
                                          >
                                            <SelectTrigger data-testid="wizard-select-collaborator-type" className="bg-muted opacity-70">
                                              <SelectValue placeholder={t.collaborators?.fields?.legacyType || "Legacy Type"} />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="_none">{t.common.noData}</SelectItem>
                                              {COLLABORATOR_TYPES.map((ct) => (
                                                <SelectItem key={ct.value} value={ct.value}>
                                                  {(t.collaborators.types as Record<string, string>)[ct.labelKey]}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                <Collapsible className="contents">
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" className="gap-2 text-sm text-muted-foreground hover:text-foreground" data-testid="toggle-agreement-type">
                      <ChevronRight className="h-4 w-4 transition-transform [[data-state=open]_&]:rotate-90" />
                      {t.collaborators?.fields?.agreementType || "Typ dohody"}
                      {formData.agreementType && (
                        <Badge variant="outline" className={cn(
                          "text-[10px] px-1.5 py-0",
                          formData.agreementType === "DOVP" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-amber-50 text-amber-700 border-amber-200"
                        )}>{formData.agreementType}</Badge>
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="basis-full order-last w-full">
                    <div className="pt-2">
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, agreementType: formData.agreementType === "DOVP" ? "" : "DOVP" })}
                                        className={cn(
                                          "flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all",
                                          formData.agreementType === "DOVP"
                                            ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-400 shadow-sm"
                                            : "border-muted hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 text-muted-foreground"
                                        )}
                                        data-testid="btn-agreement-type-dovp"
                                      >
                                        <div className={cn(
                                          "h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                                          formData.agreementType === "DOVP"
                                            ? "bg-blue-500 text-white"
                                            : "bg-muted-foreground/10 text-muted-foreground"
                                        )}>D</div>
                                        <div className="text-left">
                                          <div className="leading-tight">DOVP</div>
                                          <div className={cn("text-[10px] font-normal leading-tight", formData.agreementType === "DOVP" ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground")}>
                                            {t.collaborators?.fields?.agreementDOVP || "Dohoda o vykonaní práce"}
                                          </div>
                                        </div>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, agreementType: formData.agreementType === "ZOD" ? "" : "ZOD" })}
                                        className={cn(
                                          "flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all",
                                          formData.agreementType === "ZOD"
                                            ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-400 shadow-sm"
                                            : "border-muted hover:border-amber-300 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 text-muted-foreground"
                                        )}
                                        data-testid="btn-agreement-type-zod"
                                      >
                                        <div className={cn(
                                          "h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                                          formData.agreementType === "ZOD"
                                            ? "bg-amber-500 text-white"
                                            : "bg-muted-foreground/10 text-muted-foreground"
                                        )}>Z</div>
                                        <div className="text-left">
                                          <div className="leading-tight">ZOD</div>
                                          <div className={cn("text-[10px] font-normal leading-tight", formData.agreementType === "ZOD" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                                            {t.collaborators?.fields?.agreementZOD || "Zmluva o dielo"}
                                          </div>
                                        </div>
                                      </button>
                                    </div>
                                  </div>
                  </CollapsibleContent>
                </Collapsible>

                <Collapsible className="contents">
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" className="gap-2 text-sm text-muted-foreground hover:text-foreground" data-testid="toggle-lead-source">
                      <ChevronRight className="h-4 w-4 transition-transform [[data-state=open]_&]:rotate-90" />
                      <UserCheck className="h-4 w-4" />
                      {(t.clinics as any).leadSource || "Zdroj kontaktu"}
                      {formData.isReferredByDoctor && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800">
                          {((t.clinics as any).leadSourceTypes?.doctor_referral) || "Odporúčanie od lekára"}
                        </Badge>
                      )}
                      {formData.isFromConference && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800">
                          {((t.clinics as any).leadSourceTypes?.conference) || "Konferencia"}
                        </Badge>
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="basis-full order-last w-full">
                    <div className="pt-2 space-y-3">
                                  {(() => {
                                    const tx = (t.clinics as any) || {};
                                    const txtRecommendedBy = tx.hasBeenRecommendedBy || tx.recommendedByDoctors || "The Medical Partner has been recommended by following medical partners:";
                                    const txtSuggests = tx.hasSuggestedPartners || tx.suggestsDoctors || "The Medical Partner has suggested following potential medical partners:";
                                    const txtPersonNotFound = tx.doctorNotInDatabase || "Doctor not found in database? Add new:";
                                    const txtAddNew = tx.addNewDoctor || "Add new doctor";
                                    const txtSelectPerson = tx.selectDoctor || "Select doctor from database";
                                    const txtNoReferrals = tx.noReferrals || "No referring doctors added";
                                    const openNestedForm = (direction: "recommendedBy" | "suggests" | "conference", searchValue: string) => {
                                      setNestedPersonForm({ direction, lastName: searchValue });
                                    };

                                    return (
                                      <div className="space-y-3">
                                        {/* DOCTOR REFERRAL TILE */}
                                        <div
                                          className={cn(
                                            "border rounded-lg px-3 py-2.5 transition-all cursor-pointer",
                                            formData.isReferredByDoctor
                                              ? "border-2 shadow-sm border-purple-500 bg-purple-50/50 dark:bg-purple-950/30"
                                              : "hover:bg-muted/50 border-border"
                                          )}
                                          onClick={() => setFormData({ ...formData, isReferredByDoctor: !formData.isReferredByDoctor })}
                                          data-testid="card-collab-doctor-referral"
                                        >
                                          <div className="flex items-center gap-3">
                                            <div className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300">
                                              <UserCheck className="h-4 w-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <div className="font-medium text-sm">{tx.leadSourceTypes?.doctor_referral || "Odporúčanie od lekára"}</div>
                                            </div>
                                            <Checkbox
                                              checked={formData.isReferredByDoctor}
                                              onCheckedChange={(checked) => setFormData({ ...formData, isReferredByDoctor: !!checked })}
                                              className="shrink-0"
                                              onClick={(e) => e.stopPropagation()}
                                              data-testid="checkbox-collab-doctor-referral"
                                            />
                                          </div>
                                        </div>

                                        {formData.isReferredByDoctor && (
                                          <div className="ml-3 pl-3 border-l-2 border-purple-200 dark:border-purple-800 space-y-3">
                                            {/* RECOMMENDED-BY box */}
                                            <div className="border rounded-lg p-3 bg-purple-50/30 dark:bg-purple-950/10 space-y-2">
                                              <div className="flex items-center gap-2 text-xs font-medium text-purple-700 dark:text-purple-300">
                                                <UserCheck className="h-3.5 w-3.5" />
                                                <span>{txtRecommendedBy}</span>
                                              </div>
                                              {doctorReferrals.length > 0 && (
                                                <div className="space-y-1.5">
                                                  {doctorReferrals.map((ref) => (
                                                    <div key={ref.personId} className="flex items-center justify-between px-3 py-1.5 border rounded-lg bg-white dark:bg-background">
                                                      <div className="flex items-center gap-2">
                                                        <UserCheck className="h-3.5 w-3.5 text-purple-500" />
                                                        <span className="text-sm font-medium">{ref.personName}</span>
                                                      </div>
                                                      <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeRecommendedReferral(ref.personId, ref.referralType)} data-testid={`remove-collab-referral-${ref.personId}`}>
                                                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                                      </Button>
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
                                              <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                  value={referralSearch}
                                                  onChange={(e) => setReferralSearch(e.target.value)}
                                                  placeholder={txtSelectPerson}
                                                  className="pl-9 h-9 bg-white dark:bg-background"
                                                  data-testid="input-collab-referral-search"
                                                />
                                              </div>
                                              {referralSearch.length >= 2 && filteredPersonsRecommended.length > 0 && (
                                                <div className="border rounded-lg max-h-40 overflow-y-auto bg-white dark:bg-background">
                                                  {filteredPersonsRecommended.slice(0, 10).map((person: any) => (
                                                    <div key={person.id} className="flex items-center justify-between p-2 hover:bg-muted/50 cursor-pointer" onClick={() => addRecommendedReferral(person, "doctor_referral")} data-testid={`collab-referral-option-${person.id}`}>
                                                      <div>
                                                        <span className="font-medium text-sm">{formatPersonName(person)}</span>
                                                        {person.collaboratorType && <span className="text-xs text-muted-foreground ml-2">{person.collaboratorType}</span>}
                                                      </div>
                                                      <Plus className="h-4 w-4 text-muted-foreground" />
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
                                              {referralSearch.length >= 2 && filteredPersonsRecommended.length === 0 && (
                                                <div className="space-y-2">
                                                  <p className="text-xs text-muted-foreground">{txtPersonNotFound}</p>
                                                  <Button type="button" variant="outline" size="sm" className="text-xs gap-1" onClick={() => openNestedForm("recommendedBy", referralSearch)} data-testid="button-add-new-person-recommended">
                                                    <Plus className="h-3 w-3" /> {txtAddNew}
                                                  </Button>
                                                </div>
                                              )}
                                              {doctorReferrals.length === 0 && referralSearch.length < 2 && (
                                                <p className="text-xs text-muted-foreground italic pl-1">{txtNoReferrals}</p>
                                              )}
                                            </div>

                                            {/* SUGGESTS box (reverse direction) */}
                                            <div className="border rounded-lg p-3 bg-emerald-50/30 dark:bg-emerald-950/10 space-y-2">
                                              <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                                <ChevronRight className="h-3.5 w-3.5" />
                                                <span>{txtSuggests}</span>
                                              </div>
                                              {suggestsReferrals.length > 0 && (
                                                <div className="space-y-1.5">
                                                  {suggestsReferrals.map((ref) => (
                                                    <div key={ref.personId} className="flex items-center justify-between px-3 py-1.5 border rounded-lg bg-white dark:bg-background">
                                                      <div className="flex items-center gap-2">
                                                        <ChevronRight className="h-3.5 w-3.5 text-emerald-500" />
                                                        <span className="text-sm font-medium">{ref.personName}</span>
                                                      </div>
                                                      <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeSuggestsReferral(ref.personId)} data-testid={`remove-collab-suggests-${ref.personId}`}>
                                                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                                      </Button>
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
                                              <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                  value={suggestsSearch}
                                                  onChange={(e) => setSuggestsSearch(e.target.value)}
                                                  placeholder={txtSelectPerson}
                                                  className="pl-9 h-9 bg-white dark:bg-background"
                                                  data-testid="input-collab-suggests-search"
                                                />
                                              </div>
                                              {suggestsSearch.length >= 2 && filteredPersonsSuggests.length > 0 && (
                                                <div className="border rounded-lg max-h-40 overflow-y-auto bg-white dark:bg-background">
                                                  {filteredPersonsSuggests.slice(0, 10).map((person: any) => (
                                                    <div key={person.id} className="flex items-center justify-between p-2 hover:bg-muted/50 cursor-pointer" onClick={() => addSuggestsReferral(person)} data-testid={`collab-suggests-option-${person.id}`}>
                                                      <div>
                                                        <span className="font-medium text-sm">{formatPersonName(person)}</span>
                                                        {person.collaboratorType && <span className="text-xs text-muted-foreground ml-2">{person.collaboratorType}</span>}
                                                      </div>
                                                      <Plus className="h-4 w-4 text-muted-foreground" />
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
                                              {suggestsSearch.length >= 2 && filteredPersonsSuggests.length === 0 && (
                                                <div className="space-y-2">
                                                  <p className="text-xs text-muted-foreground">{txtPersonNotFound}</p>
                                                  <Button type="button" variant="outline" size="sm" className="text-xs gap-1" onClick={() => openNestedForm("suggests", suggestsSearch)} data-testid="button-add-new-person-suggests">
                                                    <Plus className="h-3 w-3" /> {txtAddNew}
                                                  </Button>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )}

                                        {/* CONFERENCE TILE */}
                                        <div
                                          className={cn(
                                            "border rounded-lg px-3 py-2.5 transition-all cursor-pointer",
                                            formData.isFromConference
                                              ? "border-2 shadow-sm border-rose-500 bg-rose-50/50 dark:bg-rose-950/30"
                                              : "hover:bg-muted/50 border-border"
                                          )}
                                          onClick={() => setFormData({ ...formData, isFromConference: !formData.isFromConference })}
                                          data-testid="card-collab-conference"
                                        >
                                          <div className="flex items-center gap-3">
                                            <div className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 bg-rose-100 dark:bg-rose-900 text-rose-600 dark:text-rose-300">
                                              <GraduationCap className="h-4 w-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <div className="font-medium text-sm">{tx.leadSourceTypes?.conference || "Konferencia / Seminár"}</div>
                                            </div>
                                            <Checkbox
                                              checked={formData.isFromConference}
                                              onCheckedChange={(checked) => setFormData({ ...formData, isFromConference: !!checked })}
                                              className="shrink-0"
                                              onClick={(e) => e.stopPropagation()}
                                              data-testid="checkbox-collab-conference"
                                            />
                                          </div>
                                        </div>
                                        {formData.isFromConference && (
                                          <div className="ml-3 pl-3 border-l-2 border-rose-200 dark:border-rose-800 space-y-2">
                                            <div className="grid gap-3 sm:grid-cols-2">
                                              <div className="space-y-1">
                                                <Label className="text-xs">{tx.conferenceName || "Názov konferencie"}</Label>
                                                <Input
                                                  value={formData.conferenceName}
                                                  onChange={(e) => setFormData({ ...formData, conferenceName: e.target.value })}
                                                  placeholder={tx.conferenceName || "Názov konferencie"}
                                                  className="h-9"
                                                  data-testid="input-collab-conference-name"
                                                />
                                              </div>
                                              <div className="space-y-1">
                                                <Label className="text-xs">{tx.conferenceDate || "Dátum konferencie"}</Label>
                                                <DateTimePicker
                                                  value={formData.conferenceDate}
                                                  onChange={(v) => setFormData({ ...formData, conferenceDate: v })}
                                                  countryCode={formData.countryCode || "SK"}
                                                  includeTime={false}
                                                  data-testid="input-collab-conference-date"
                                                />
                                              </div>
                                            </div>
                                            <Separator className="my-1" />
                                            <Label className="text-xs">{tx.referringDoctors || "Stretnutia s osobami na konferencii"}</Label>
                                            {conferenceReferrals.length > 0 && (
                                              <div className="space-y-1.5">
                                                {conferenceReferrals.map((ref) => (
                                                  <div key={ref.personId} className="flex items-center justify-between px-3 py-1.5 border rounded-lg bg-rose-50/50 dark:bg-rose-950/30">
                                                    <div className="flex items-center gap-2">
                                                      <GraduationCap className="h-3.5 w-3.5 text-rose-500" />
                                                      <span className="text-sm font-medium">{ref.personName}</span>
                                                    </div>
                                                    <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeRecommendedReferral(ref.personId, "conference")} data-testid={`remove-collab-conf-referral-${ref.personId}`}>
                                                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                                    </Button>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                            <div className="relative">
                                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                              <Input
                                                value={confReferralSearch}
                                                onChange={(e) => setConfReferralSearch(e.target.value)}
                                                placeholder={txtSelectPerson}
                                                className="pl-9 h-9"
                                                data-testid="input-collab-conf-referral-search"
                                              />
                                            </div>
                                            {confReferralSearch.length >= 2 && filteredPersonsConference.length > 0 && (
                                              <div className="border rounded-lg max-h-40 overflow-y-auto">
                                                {filteredPersonsConference.slice(0, 10).map((person: any) => (
                                                  <div key={person.id} className="flex items-center justify-between p-2 hover:bg-muted/50 cursor-pointer" onClick={() => addRecommendedReferral(person, "conference")} data-testid={`collab-conf-referral-option-${person.id}`}>
                                                    <div>
                                                      <span className="font-medium text-sm">{formatPersonName(person)}</span>
                                                      {person.collaboratorType && <span className="text-xs text-muted-foreground ml-2">{person.collaboratorType}</span>}
                                                    </div>
                                                    <Plus className="h-4 w-4 text-muted-foreground" />
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                            {confReferralSearch.length >= 2 && filteredPersonsConference.length === 0 && (
                                              <div className="space-y-2">
                                                <p className="text-xs text-muted-foreground">{txtPersonNotFound}</p>
                                                <Button type="button" variant="outline" size="sm" className="text-xs gap-1" onClick={() => openNestedForm("conference", confReferralSearch)} data-testid="button-add-new-person-conference">
                                                  <Plus className="h-3 w-3" /> {txtAddNew}
                                                </Button>
                                              </div>
                                            )}
                                            {conferenceReferrals.length === 0 && confReferralSearch.length < 2 && (
                                              <p className="text-xs text-muted-foreground italic pl-1">{txtNoReferrals}</p>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}

                                  {(formData.isReferredByDoctor || formData.isFromConference) && (
                                    <>
                                      <Separator />
                                      <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="space-y-1">
                                          <Label className="text-xs">{(t.clinics as any).leadSourceDate || "Dátum kontaktu"}</Label>
                                          <DateTimePicker
                                            value={formData.leadSourceDate}
                                            onChange={(v) => setFormData({ ...formData, leadSourceDate: v })}
                                            countryCode={formData.countryCode || "SK"}
                                            includeTime={false}
                                            data-testid="input-collab-lead-source-date"
                                          />
                                        </div>
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs">{(t.clinics as any).leadSourceNotes || "Poznámky k zdroju"}</Label>
                                        <Textarea
                                          value={formData.leadSourceNotes}
                                          onChange={(e) => setFormData({ ...formData, leadSourceNotes: e.target.value })}
                                          placeholder={(t.clinics as any).leadSourceNotes || "Poznámky k zdroju"}
                                          rows={2}
                                          data-testid="input-collab-lead-source-notes"
                                        />
                                      </div>
                                    </>
                                  )}
                  </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
              {!isHidden("title_before") && (
                <div className="space-y-2">
                  <Label>{t.collaborators.fields.titleBefore}</Label>
                  <Input
                    value={formData.titleBefore}
                    onChange={(e) => setFormData({ ...formData, titleBefore: e.target.value })}
                    data-testid="wizard-input-collaborator-title-before"
                    disabled={isReadonly("title_before")}
                    className={isReadonly("title_before") ? "bg-muted" : ""}
                  />
                </div>
              )}
              {!isHidden("first_name") && (
                <div className="space-y-2">
                  <Label>{t.collaborators.fields.firstName} *</Label>
                  <Input
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    data-testid="wizard-input-collaborator-firstname"
                    disabled={isReadonly("first_name")}
                    className={isReadonly("first_name") ? "bg-muted" : ""}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>{t.collaborators?.fields?.middleName || "Middle Name"}</Label>
                <Input
                  value={formData.middleName}
                  onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
                  data-testid="wizard-input-collaborator-middlename"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {!isHidden("last_name") && (
                <div className="space-y-2">
                  <Label>{t.collaborators.fields.lastName} *</Label>
                  <Input
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    data-testid="wizard-input-collaborator-lastname"
                    disabled={isReadonly("last_name")}
                    className={isReadonly("last_name") ? "bg-muted" : ""}
                  />
                </div>
              )}
              {!isHidden("maiden_name") && (
                <div className="space-y-2">
                  <Label>{t.collaborators.fields.maidenName}</Label>
                  <Input
                    value={formData.maidenName}
                    onChange={(e) => setFormData({ ...formData, maidenName: e.target.value })}
                    data-testid="wizard-input-collaborator-maidenname"
                    disabled={isReadonly("maiden_name")}
                    className={isReadonly("maiden_name") ? "bg-muted" : ""}
                  />
                </div>
              )}
              {!isHidden("title_after") && (
                <div className="space-y-2">
                  <Label>{t.collaborators.fields.titleAfter}</Label>
                  <Input
                    value={formData.titleAfter}
                    onChange={(e) => setFormData({ ...formData, titleAfter: e.target.value })}
                    data-testid="wizard-input-collaborator-title-after"
                    disabled={isReadonly("title_after")}
                    className={isReadonly("title_after") ? "bg-muted" : ""}
                  />
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>{t.collaborators?.fields?.birthNumber || "Birth Number"}</Label>
                <Input
                  value={formData.birthNumber}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9/]/g, "");
                    setFormData((prev) => {
                      const updated = { ...prev, birthNumber: val };
                      const digits = val.replace("/", "");
                      if (digits.length >= 6) {
                        let yearPart = parseInt(digits.substring(0, 2), 10);
                        let monthPart = parseInt(digits.substring(2, 4), 10);
                        const dayPart = parseInt(digits.substring(4, 6), 10);
                        if (monthPart > 50) monthPart -= 50;
                        if (monthPart > 20) monthPart -= 20;
                        const fullYear = digits.length >= 10 ? (yearPart < 54 ? 2000 + yearPart : 1900 + yearPart) : (yearPart < 54 ? 2000 + yearPart : 1900 + yearPart);
                        if (monthPart >= 1 && monthPart <= 12 && dayPart >= 1 && dayPart <= 31) {
                          updated.birthYear = fullYear;
                          updated.birthMonth = monthPart;
                          updated.birthDay = dayPart;
                        }
                      }
                      return updated;
                    });
                  }}
                  placeholder="XXXXXX/XXXX"
                  data-testid="wizard-input-collaborator-birth-number"
                />
              </div>
              {!isHidden("date_of_birth") && (
                <DateFields
                  label={t.collaborators.fields.birthDate}
                  dayValue={formData.birthDay}
                  monthValue={formData.birthMonth}
                  yearValue={formData.birthYear}
                  onDayChange={(val) => setFormData({ ...formData, birthDay: val })}
                  onMonthChange={(val) => setFormData({ ...formData, birthMonth: val })}
                  onYearChange={(val) => setFormData({ ...formData, birthYear: val })}
                  testIdPrefix="birth"
                  t={t}
                />
              )}
              <div className="space-y-2">
                <Label>{t.collaborators.fields.birthPlace}</Label>
                <Input
                  value={formData.birthPlace}
                  onChange={(e) => setFormData({ ...formData, birthPlace: e.target.value })}
                  data-testid="wizard-input-collaborator-birth-place"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t.collaborators.fields.healthInsurance}</Label>
                <Select
                  value={formData.healthInsuranceId || "_none"}
                  onValueChange={(value) => setFormData({ ...formData, healthInsuranceId: value === "_none" ? "" : value })}
                >
                  <SelectTrigger data-testid="wizard-select-collaborator-insurance">
                    <SelectValue placeholder={t.collaborators.fields.healthInsurance} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">{t.common.noData}</SelectItem>
                    {filteredHealthInsurances.map((hi) => (
                      <SelectItem key={hi.id} value={hi.id}>{hi.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t.collaborators.fields.maritalStatus}</Label>
                <Select
                  value={formData.maritalStatus || "_none"}
                  onValueChange={(value) => setFormData({ ...formData, maritalStatus: value === "_none" ? "" : value })}
                >
                  <SelectTrigger data-testid="wizard-select-collaborator-marital">
                    <SelectValue placeholder={t.collaborators.fields.maritalStatus} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">{t.common.noData}</SelectItem>
                    {MARITAL_STATUSES.map((ms) => (
                      <SelectItem key={ms.value} value={ms.value}>
                        {(t.collaborators.maritalStatuses as Record<string, string>)[ms.labelKey]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t.collaborators.fields.professionalClassification}</Label>
                <Select
                  value={formData.professionalClassification || "_none"}
                  onValueChange={(value) => setFormData({ ...formData, professionalClassification: value === "_none" ? "" : value })}
                >
                  <SelectTrigger data-testid="wizard-select-professional-classification">
                    <SelectValue placeholder={t.collaborators.fields.professionalClassification} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">{t.common.noData}</SelectItem>
                    {PROFESSIONAL_CLASSIFICATIONS.map((pc) => (
                      <SelectItem key={pc.value} value={pc.value}>
                        {(t.collaborators.professionalClassifications as Record<string, string>)[pc.labelKey] || pc.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t.collaborators.fields.highestEducation}</Label>
                <Select
                  value={formData.highestEducation || "_none"}
                  onValueChange={(value) => setFormData({ ...formData, highestEducation: value === "_none" ? "" : value })}
                >
                  <SelectTrigger data-testid="wizard-select-highest-education">
                    <SelectValue placeholder={t.collaborators.fields.highestEducation} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">{t.common.noData}</SelectItem>
                    {EDUCATION_LEVELS.map((el) => (
                      <SelectItem key={el.value} value={el.value}>
                        {(t.collaborators.educationLevels as Record<string, string>)[el.labelKey] || el.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>{t.collaborators.fields.workplaceName}</Label>
                <Input
                  value={formData.workplaceName}
                  onChange={(e) => setFormData({ ...formData, workplaceName: e.target.value })}
                  placeholder={t.collaborators.fields.workplaceName}
                  data-testid="wizard-input-workplace-name"
                />
                <p className="text-xs text-muted-foreground">{t.collaborators.fields.workplaceNameDesc}</p>
              </div>
              <div className="flex items-center space-x-2 pt-2 sm:col-span-2">
                <Switch
                  checked={formData.isManager}
                  onCheckedChange={(checked) => setFormData({ ...formData, isManager: checked })}
                  data-testid="wizard-switch-is-manager"
                />
                <Label>{t.collaborators.fields.isManager}</Label>
              </div>
            </div>

            {!isHidden("is_active") && (
              <div className="flex items-center space-x-2 pt-2">
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  data-testid="wizard-switch-collaborator-active"
                  disabled={isReadonly("is_active")}
                />
                <Label>{t.collaborators.fields.active}</Label>
              </div>
            )}
          </div>
        );

      case "contact":
        return (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {!isHidden("phone") && (
                <div className="space-y-2">
                  <Label>{t.collaborators.fields.phone}</Label>
                  <PhoneNumberField
                    value={formData.phone}
                    onChange={(value) => setFormData({ ...formData, phone: value })}
                    defaultCountryCode={formData.countryCode || "SK"}
                    data-testid="wizard-input-collaborator-phone"
                    disabled={isReadonly("phone")}
                  />
                </div>
              )}
              {!isHidden("mobile") && (
                <div className="space-y-2">
                  <Label>{t.collaborators.fields.mobile}</Label>
                  <PhoneNumberField
                    value={formData.mobile}
                    onChange={(value) => setFormData({ ...formData, mobile: value })}
                    defaultCountryCode={formData.countryCode || "SK"}
                    data-testid="wizard-input-collaborator-mobile"
                    disabled={isReadonly("mobile")}
                  />
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t.collaborators.fields.mobile2}</Label>
                <PhoneNumberField
                  value={formData.mobile2}
                  onChange={(value) => setFormData({ ...formData, mobile2: value })}
                  defaultCountryCode={formData.countryCode || "SK"}
                  data-testid="wizard-input-collaborator-mobile2"
                />
              </div>
              {!isHidden("email") && (
                <div className="space-y-2">
                  <Label>{t.collaborators.fields.email}</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    data-testid="wizard-input-collaborator-email"
                    disabled={isReadonly("email")}
                    className={isReadonly("email") ? "bg-muted" : ""}
                  />
                </div>
              )}
            </div>

            <Separator className="my-4" />

            <div>
              <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {t.collaborators.tabs.addresses}
              </h4>
              {initialData ? (
                <AddressesTabContent
                  collaboratorId={initialData.id}
                  countryCode={initialData.countryCode}
                  collaboratorName={`${initialData.firstName} ${initialData.lastName}`}
                  t={t}
                />
              ) : (
                <PendingAddressesContent
                  pendingAddresses={pendingAddresses}
                  setPendingAddresses={setPendingAddresses}
                  countryCode={formData.countryCode}
                  collaboratorName={`${formData.firstName} ${formData.lastName}`}
                  t={t}
                />
              )}

              <Collapsible className="mt-3">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="w-full flex items-center justify-between rounded-lg bg-muted/40 hover:bg-muted/60 px-4 py-3 text-left transition-colors"
                    data-testid="toggle-company-address"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {t.collaborators.addressTabs.company}
                    </span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-4 pt-3 px-1">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {!isHidden("company_name") && (
                        <div className="space-y-2">
                          <Label>{t.collaborators.fields.companyName}</Label>
                          <Input
                            value={formData.companyName}
                            onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                            data-testid="wizard-input-collaborator-company-name"
                            disabled={isReadonly("company_name")}
                            className={isReadonly("company_name") ? "bg-muted" : ""}
                          />
                        </div>
                      )}
                      {!isHidden("company_ico") && (
                        <div className="space-y-2">
                          <Label>{t.collaborators.fields.ico}</Label>
                          <Input
                            value={formData.ico}
                            onChange={(e) => setFormData({ ...formData, ico: e.target.value })}
                            data-testid="wizard-input-collaborator-ico"
                            disabled={isReadonly("company_ico")}
                            className={isReadonly("company_ico") ? "bg-muted" : ""}
                          />
                        </div>
                      )}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      {!isHidden("company_dic") && (
                        <div className="space-y-2">
                          <Label>{t.collaborators.fields.dic}</Label>
                          <Input
                            value={formData.dic}
                            onChange={(e) => setFormData({ ...formData, dic: e.target.value })}
                            data-testid="wizard-input-collaborator-dic"
                            disabled={isReadonly("company_dic")}
                            className={isReadonly("company_dic") ? "bg-muted" : ""}
                          />
                        </div>
                      )}
                      {!isHidden("company_ic_dph") && (
                        <div className="space-y-2">
                          <Label>{t.collaborators.fields.icDph}</Label>
                          <Input
                            value={formData.icDph}
                            onChange={(e) => setFormData({ ...formData, icDph: e.target.value })}
                            data-testid="wizard-input-collaborator-icdph"
                            disabled={isReadonly("company_ic_dph")}
                            className={isReadonly("company_ic_dph") ? "bg-muted" : ""}
                          />
                        </div>
                      )}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      {!isHidden("bank_account") && (
                        <div className="space-y-2">
                          <Label>{t.collaborators.fields.companyIban}</Label>
                          <Input
                            value={formData.companyIban}
                            onChange={(e) => setFormData({ ...formData, companyIban: e.target.value })}
                            data-testid="wizard-input-collaborator-company-iban"
                            disabled={isReadonly("bank_account")}
                            className={isReadonly("bank_account") ? "bg-muted" : ""}
                          />
                        </div>
                      )}
                      {!isHidden("bank_account") && (
                        <div className="space-y-2">
                          <Label>{t.collaborators.fields.companySwift}</Label>
                          <Input
                            value={formData.companySwift}
                            onChange={(e) => setFormData({ ...formData, companySwift: e.target.value })}
                            data-testid="wizard-input-collaborator-company-swift"
                            disabled={isReadonly("bank_account")}
                            className={isReadonly("bank_account") ? "bg-muted" : ""}
                          />
                        </div>
                      )}
                    </div>

                    {initialData && (
                      <div className="pt-2">
                        <h5 className="text-sm font-medium mb-3 flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          {t.collaborators.addressTabs.company}
                        </h5>
                        <CompanyAddressForm collaboratorId={initialData.id} parentCountryCode={initialData.countryCode} t={t} />
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>
        );

      case "banking":
        return (
          <div className="space-y-4">
            <BankAccountSection
              bankAccountIban={formData.bankAccountIban}
              swiftCode={formData.swiftCode}
              onIbanChange={(val) => setFormData({ ...formData, bankAccountIban: val })}
              onSwiftChange={(val) => setFormData({ ...formData, swiftCode: val })}
              countryCode={formData.countryCode}
              isHidden={isHidden}
              isReadonly={isReadonly}
              t={t}
            />

            <Separator className="my-4" />

            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.clientContact}
                  onCheckedChange={(checked) => setFormData({ ...formData, clientContact: checked })}
                  data-testid="wizard-switch-collaborator-client-contact"
                />
                <Label>{t.collaborators.fields.clientContact}</Label>
              </div>
              {!positionScopeFilter && !hideSvetZdravia && (
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.svetZdravia}
                    onCheckedChange={(checked) => setFormData({ ...formData, svetZdravia: checked })}
                    data-testid="wizard-switch-collaborator-svet-zdravia"
                  />
                  <Label>{t.collaborators.fields.svetZdravia}</Label>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.monthRewards}
                  onCheckedChange={(checked) => {
                    setFormData({ 
                      ...formData, 
                      monthRewards: checked,
                      rewardType: checked ? formData.rewardType || "fixed" : ""
                    });
                  }}
                  data-testid="wizard-switch-collaborator-month-rewards"
                />
                <Label>{t.collaborators.fields.monthRewards}</Label>
              </div>
            </div>

            {formData.monthRewards && (
              <div className="mt-4 p-4 border rounded-lg space-y-4">
                <Label className="text-base font-medium">{t.collaborators?.fields?.rewardSettings || "Reward Settings"}</Label>
                
                <div className="flex gap-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="reward-fixed"
                      name="rewardType"
                      value="fixed"
                      checked={formData.rewardType === "fixed"}
                      onChange={() => setFormData({ ...formData, rewardType: "fixed" })}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="reward-fixed">{t.collaborators?.fields?.fixedAmount || "Fixed Amount"}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="reward-percentage"
                      name="rewardType"
                      value="percentage"
                      checked={formData.rewardType === "percentage"}
                      onChange={() => setFormData({ ...formData, rewardType: "percentage" })}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="reward-percentage">{t.collaborators?.fields?.percentageRate || "Percentage Rate"}</Label>
                  </div>
                </div>

                {formData.rewardType === "fixed" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t.collaborators?.fields?.fixedAmount || "Amount"}</Label>
                      <Input
                        type="number"
                        value={formData.fixedRewardAmount}
                        onChange={(e) => setFormData({ ...formData, fixedRewardAmount: e.target.value })}
                        placeholder="0.00"
                        data-testid="wizard-input-fixed-reward-amount"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t.collaborators?.fields?.currency || "Currency"}</Label>
                      <Select
                        value={formData.fixedRewardCurrency}
                        onValueChange={(value) => setFormData({ ...formData, fixedRewardCurrency: value })}
                      >
                        <SelectTrigger data-testid="wizard-select-reward-currency">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="CZK">CZK</SelectItem>
                          <SelectItem value="HUF">HUF</SelectItem>
                          <SelectItem value="RON">RON</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {formData.rewardType === "percentage" && (
                  <div className="space-y-3">
                    <Label>{t.collaborators?.fields?.percentageByCountry || "Percentage by Country"}</Label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {(formData.countryCodes.length > 0 ? formData.countryCodes : [formData.countryCode]).filter(Boolean).map((cc) => {
                        const country = COUNTRIES.find(c => c.code === cc);
                        return (
                          <div key={cc} className="flex items-center gap-2">
                            <span className="text-lg">{getCountryFlag(cc)}</span>
                            <span className="text-sm min-w-[80px]">{country?.name || cc}</span>
                            <Input
                              type="number"
                              value={formData.percentageRewards[cc] || ""}
                              onChange={(e) => setFormData({ 
                                ...formData, 
                                percentageRewards: { ...formData.percentageRewards, [cc]: e.target.value }
                              })}
                              placeholder="0"
                              className="w-20"
                              data-testid={`wizard-input-percentage-${cc}`}
                            />
                            <span className="text-sm text-muted-foreground">%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case "agreements":
        return initialData ? (
          <AgreementsTabContent collaboratorId={initialData.id} collaboratorCountry={initialData.countryCode} t={t} />
        ) : (
          <PendingAgreementsContent
            pendingAgreements={pendingAgreements}
            setPendingAgreements={setPendingAgreements}
            countryCode={formData.countryCode}
            t={t}
          />
        );

      case "documents":
        return initialData ? (
          <DocumentsPanel collaboratorId={initialData.id} t={t} />
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t.wizard?.completePreviousSteps || "Najprv uložte spolupracovníka"}</p>
          </div>
        );
      
      case "actions":
        return initialData ? (
          <ActionsTabContent collaboratorId={initialData.id} t={t} />
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Activity className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t.wizard?.completePreviousSteps || "Najprv uložte spolupracovníka"}</p>
          </div>
        );

      case "history":
        return initialData ? (
          <div className="space-y-6">
            <HistoryTabContent collaboratorId={initialData.id} t={t} />
            <Separator className="my-2" />
            <ConnectActivityTab collaboratorId={initialData.id} locale={locale} t={t} />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <History className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t.wizard.completePreviousSteps}</p>
          </div>
        );

      case "medicalNetwork":
        return initialData ? (
          <MedicalNetworkContent
            personId={initialData.id}
            personName={`${initialData.titleBefore || ""} ${initialData.firstName} ${initialData.lastName}`.trim()}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Network className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t.wizard?.completePreviousSteps || "Najprv uložte spolupracovníka"}</p>
          </div>
        );
      
      case "mobile":
        return (
          <div className="space-y-6">
            {initialData?.id && (
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                <div className="relative">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-16 h-16 rounded-full object-cover border-2 border-muted" />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border-2 border-muted">
                      <User className="h-8 w-8 text-primary/60" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-sm">Avatar</h4>
                  <p className="text-xs text-muted-foreground mb-2">JPEG, PNG, max 2MB</p>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90">
                    {avatarUploading ? "..." : (avatarUrl ? "Change" : "Upload")}
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={avatarUploading} />
                  </label>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
              <Smartphone className="h-6 w-6 text-muted-foreground" />
              <div>
                <h4 className="font-medium">{t.collaborators.mobileApp.title}</h4>
                <p className="text-sm text-muted-foreground">
                  {t.collaborators.mobileApp.description}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={mobileCredentials.mobileAppEnabled}
                  onCheckedChange={(checked) => setMobileCredentials({ ...mobileCredentials, mobileAppEnabled: checked })}
                  data-testid="wizard-switch-mobile-app-enabled"
                />
                <Label>{t.collaborators.mobileApp.enabled}</Label>
              </div>

              {mobileCredentials.mobileAppEnabled && (
                <div className="space-y-4 pl-8 border-l-2 border-muted">
                  <div className="space-y-2">
                    <Label>{t.collaborators.mobileApp.username}</Label>
                    <Input
                      value={mobileCredentials.mobileUsername}
                      onChange={(e) => setMobileCredentials({ ...mobileCredentials, mobileUsername: e.target.value })}
                      placeholder={t.collaborators.mobileApp.usernamePlaceholder}
                      data-testid="wizard-input-mobile-username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.collaborators.mobileApp.password}</Label>
                    <Input
                      type="password"
                      value={mobileCredentials.mobilePassword}
                      onChange={(e) => setMobileCredentials({ ...mobileCredentials, mobilePassword: e.target.value })}
                      placeholder={initialData?.mobilePasswordHash ? t.collaborators.mobileApp.passwordPlaceholderExisting : t.collaborators.mobileApp.passwordPlaceholder}
                      data-testid="wizard-input-mobile-password"
                    />
                  </div>
                  {mobileCredentials.mobilePassword && (
                    <div className="space-y-2">
                      <Label>{t.collaborators.mobileApp.passwordConfirm}</Label>
                      <Input
                        type="password"
                        value={mobileCredentials.mobilePasswordConfirm}
                        onChange={(e) => setMobileCredentials({ ...mobileCredentials, mobilePasswordConfirm: e.target.value })}
                        placeholder={t.collaborators.mobileApp.passwordConfirmPlaceholder}
                        data-testid="wizard-input-mobile-password-confirm"
                      />
                      {mobileCredentials.mobilePassword !== mobileCredentials.mobilePasswordConfirm && mobileCredentials.mobilePasswordConfirm && (
                        <p className="text-sm text-destructive">{t.collaborators.mobileApp.passwordMismatch}</p>
                      )}
                    </div>
                  )}

                  <div className="mt-6 pt-6 border-t border-muted">
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 mb-4">
                      <Phone className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <h4 className="font-medium text-sm">{t.collaborators.mobileApp.webrtcTitle}</h4>
                        <p className="text-xs text-muted-foreground">{t.collaborators.mobileApp.webrtcDescription}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={mobileCredentials.mobileWebrtcEnabled}
                          onCheckedChange={(checked) => setMobileCredentials({ ...mobileCredentials, mobileWebrtcEnabled: checked })}
                          data-testid="wizard-switch-webrtc-enabled"
                        />
                        <Label>{t.collaborators.mobileApp.webrtcEnabled}</Label>
                      </div>

                      {mobileCredentials.mobileWebrtcEnabled && (
                        <div className="space-y-4 pl-8 border-l-2 border-muted">
                          <div className="space-y-2">
                            <Label>{t.collaborators.mobileApp.sipExtension}</Label>
                            <Select
                              value={mobileCredentials.mobileSipExtensionId || ""}
                              onValueChange={(value) => setMobileCredentials({ ...mobileCredentials, mobileSipExtensionId: value === "__none__" ? "" : value })}
                            >
                              <SelectTrigger data-testid="wizard-select-sip-extension">
                                <SelectValue placeholder={t.collaborators.mobileApp.sipExtensionPlaceholder} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">{t.collaborators.mobileApp.sipExtensionNone}</SelectItem>
                                {initialData?.mobileSipExtensionId && !availableSipExtensions.find((e: any) => e.id === initialData.mobileSipExtensionId) && (
                                  <SelectItem value={initialData.mobileSipExtensionId}>
                                    {t.collaborators.mobileApp.assignedExtension}
                                  </SelectItem>
                                )}
                                {availableSipExtensions.map((ext: any) => (
                                  <SelectItem key={ext.id} value={ext.id}>
                                    {ext.extension} ({ext.sipUsername})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>{t.collaborators.mobileApp?.outboundCallerId || 'Outbound Caller ID'}</Label>
                            <Input
                              value={mobileCredentials.outboundCallerId}
                              onChange={(e) => setMobileCredentials({ ...mobileCredentials, outboundCallerId: e.target.value })}
                              placeholder={t.collaborators.mobileApp?.outboundCallerIdPlaceholder || '+421 XXX XXX XXX'}
                              data-testid="wizard-input-outbound-caller-id"
                            />
                            <p className="text-xs text-muted-foreground">{t.collaborators.mobileApp?.outboundCallerIdDesc || 'Phone number presented as caller ID for outbound calls from the mobile app'}</p>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={mobileCredentials.mobileCallRecording}
                              onCheckedChange={(checked) => setMobileCredentials({ ...mobileCredentials, mobileCallRecording: checked })}
                              data-testid="wizard-switch-call-recording"
                            />
                            <div>
                              <Label>{t.collaborators.mobileApp.callRecording}</Label>
                              <p className="text-xs text-muted-foreground">{t.collaborators.mobileApp.callRecordingDesc}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const currentStepInfo = wizardSteps[currentStep];
  const StepIcon = currentStepInfo?.icon || User;

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 flex items-center justify-between px-5 py-3.5 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <User className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold">
              {isEditMode
                ? `${initialData?.firstName} ${initialData?.lastName}`
                : t.collaborators.addPerson}
              {isEditMode && (initialData as any)?.dataSource === 'iscbc' && (
                <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                  ISCBC
                </Badge>
              )}
              {collabNetworks.map((netName: string) => (
                <Badge key={netName} className="ml-2 text-[10px] px-1.5 py-0 font-bold bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/60 dark:text-amber-300 dark:border-amber-700" data-testid="badge-collaborator-network-header">
                  <Network className="h-2.5 w-2.5 mr-0.5" />
                  {netName}
                </Badge>
              ))}
              {(() => {
                const recBy = referrals.filter(r => r.referralType === "doctor_referral" || r.referralType === "doctor_suggests");
                if (recBy.length === 0) return null;
                const names = recBy.map(r => r.personName).join(", ");
                const tx = (t.clinics as any) || {};
                let label: string;
                if (recBy.length === 1) {
                  const fullName = recBy[0].personName;
                  const lastWord = fullName.split(" ").pop() || "";
                  const isFemale = /(ová|á)$/.test(lastWord);
                  const tpl = (isFemale ? tx.recommendedByFemale : tx.recommendedByMale) || "Recommended by {name}";
                  label = tpl.replace("{name}", fullName);
                } else {
                  const tpl = tx.recommendedByMultiple || "Recommended by: {names}";
                  label = tpl.replace("{names}", names);
                }
                return (
                  <Badge
                    variant="outline"
                    className="ml-2 text-[10px] px-1.5 py-0 bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800 inline-flex items-center gap-1 align-middle"
                    title={names}
                    data-testid="badge-collaborator-recommended-by"
                  >
                    <UserCheck className="h-2.5 w-2.5" />
                    {label}
                  </Badge>
                );
              })()}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isEditMode
                ? ((): string => {
                    const d: Record<string, string> = {
                      sk: "Upraviť osobu",
                      cs: "Upravit osobu",
                      en: "Edit Person",
                      hu: "Személy szerkesztése",
                      ro: "Editează persoana",
                      it: "Modifica persona",
                      de: "Person bearbeiten",
                    };
                    return d[locale] || "Edit Person";
                  })()
                : t.collaborators.addPerson}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onCancel} data-testid="wizard-button-close">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="w-48 border-r bg-muted/20 flex flex-col py-2 shrink-0 overflow-auto">
          {wizardSteps.map((step, index) => {
            const isCompleted = completedSteps.has(index);
            const isCurrent = index === currentStep;
            const isClickable = isEditMode || index <= currentStep || isCompleted || completedSteps.has(index - 1);
            const Icon = step.icon;

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => handleStepClick(index)}
                disabled={!isClickable}
                className={cn(
                  "flex items-center gap-2.5 px-4 py-2 text-sm transition-colors text-left",
                  isCurrent && "bg-primary/10 text-primary font-medium border-r-2 border-primary",
                  !isCurrent && isClickable && "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  !isClickable && "cursor-not-allowed opacity-40 text-muted-foreground"
                )}
                data-testid={`wizard-step-${step.id}`}
              >
                <Icon className={cn("h-4 w-4 shrink-0", isCurrent && "text-primary")} />
                <span className="truncate">{getStepTitle(step.id)}</span>
              </button>
            );
          })}
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <div className="shrink-0 px-6 py-3 border-b bg-background">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <StepIcon className="h-4 w-4 text-primary" />
              {getStepTitle(currentStepInfo.id)}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {getStepDescription(currentStepInfo.id)}
            </p>
          </div>

          <div className="flex-1 overflow-auto p-6">
            {renderStepContent()}
          </div>

          <div className="shrink-0 border-t bg-background/95 backdrop-blur-sm px-6 py-3 flex items-center justify-end shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onCancel} data-testid="wizard-button-cancel">
                {t.common.cancel}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => saveMutation.mutate(formData)}
                disabled={saveMutation.isPending}
                className="shadow-md"
                data-testid="wizard-button-save"
              >
                {saveMutation.isPending ? t.common.loading : t.common.save}
              </Button>
              {false && !isLastStep && (
                <Button size="sm" variant={isEditMode ? "outline" : "default"} onClick={handleNext} disabled={saveMutation.isPending} data-testid="wizard-button-next">
                  {t.wizard.next}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
              {false && isLastStep && !isEditMode && (
                <Button size="sm" onClick={handleNext} disabled={saveMutation.isPending} data-testid="wizard-button-next">
                  {saveMutation.isPending ? t.common.loading : t.wizard.complete}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {nestedPersonForm && (
        <Sheet open={true} onOpenChange={(open) => { if (!open) setNestedPersonForm(null); }}>
          <SheetContent side="right" className="w-full sm:max-w-3xl p-0 overflow-hidden">
            <SheetHeader className="px-6 py-4 border-b">
              <SheetTitle>{(t.clinics as any).addNewDoctor || "Add new"}</SheetTitle>
            </SheetHeader>
            <div className="h-[calc(100vh-65px)] overflow-hidden">
              <CollaboratorFormWizard
                prefillData={{ lastName: nestedPersonForm.lastName, countryCode: formData.countryCode || "SK" }}
                onSuccess={() => setNestedPersonForm(null)}
                onCancel={() => setNestedPersonForm(null)}
                onCreated={async (created) => { await handleNestedPersonCreated(created as any); }}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
