import { useState, useEffect, useRef, useMemo } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { COUNTRIES } from "@shared/schema";
import type { Clinic } from "@shared/schema";
import { REGIONS_BY_COUNTRY, DISTRICTS_BY_REGION, getAutoRegion, getAutoDistrict, getDistrictsForRegion, getGeoLabels } from "@/lib/regions";
import { SuggestRegionButton } from "@/components/suggest-region-button";
import {
  Stethoscope, MapPin, ExternalLink, Navigation, Loader2, Search, Trash2, Plus, Network,
  Users, Save, X, UserPlus, Handshake, UserCheck, GraduationCap, Phone, Mail,
  Clock, ArrowRight, ArrowRightLeft, History, FileText, MessageSquare, Megaphone, PhoneCall,
  CalendarDays, FileSignature, Newspaper, CheckCircle2, CircleDot, Circle,
  Building2, ScrollText, Target, ShieldCheck, Ban, HelpCircle, ChevronRight,
  ChevronDown, ChevronUp, Send, Upload,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { COUNTRY_TO_LOCALE } from "@/i18n/translations";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getCountryFlag } from "@/lib/countries";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { CallCustomerButton } from "@/components/sip-phone";
import { InstitutionPersonnelManager, CbcActivityBadgesForRow } from "@/components/institution-personnel-panel";
import { CollaboratorFormWizard } from "@/components/collaborator-form-wizard";
import EntityCampaignTimeline from "@/components/campaigns/EntityCampaignTimeline";
import { getQueryFn } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { PhoneNumberField } from "@/components/phone-number-field";
import { Wand2 } from "lucide-react";

interface ClinicFormData {
  name: string;
  doctorTitle: string;
  doctorFirstName: string;
  doctorLastName: string;
  idZz: string;
  pzsCode: string;
  pzsName: string;
  ico: string;
  address: string;
  street: string;
  streetNumber: string;
  orientationNumber: string;
  city: string;
  postalCode: string;
  countryCode: string;
  region: string;
  district: string;
  phone: string;
  phone2: string;
  phone3: string;
  email: string;
  email2: string;
  email3: string;
  website: string;
  latitude: string;
  longitude: string;
  isActive: boolean;
  notes: string;
  leadSource: string;
  leadSourceDate: string;
  leadSourceNotes: string;
  conferenceName: string;
  conferenceDate: string;
  isReferredByDoctor: boolean;
  isFromConference: boolean;
  initialStatus: string;
  interestCooperation: string;
  interestContract: string;
  contractStatus: string;
  lastCallResult: string;
  lastCallNote: string;
  nextContactDate: string;
  contractSentDate: string;
  contractReturnedDate: string;
  hasFlyers: boolean;
  flyersSentDate: string;
  flyersLocation: string;
}

const LEAD_SOURCE_TYPES = ["new_contact", "former_collaborator", "current_collaborator", "doctor_referral", "conference"] as const;
type LeadSourceType = typeof LEAD_SOURCE_TYPES[number];

const MAIN_SOURCE_TYPES: LeadSourceType[] = ["new_contact", "former_collaborator", "current_collaborator"];

const LEAD_SOURCE_ICONS: Record<LeadSourceType, typeof UserPlus> = {
  new_contact: UserPlus,
  former_collaborator: Users,
  current_collaborator: Handshake,
  doctor_referral: UserCheck,
  conference: GraduationCap,
};

const LEAD_SOURCE_COLORS: Record<LeadSourceType, string> = {
  new_contact: "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300",
  former_collaborator: "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-300",
  current_collaborator: "bg-green-50 border-green-200 text-green-700 dark:bg-green-950 dark:border-green-800 dark:text-green-300",
  doctor_referral: "bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-950 dark:border-purple-800 dark:text-purple-300",
  conference: "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-300",
};

const LEAD_SOURCE_ICON_BG: Record<LeadSourceType, string> = {
  new_contact: "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400",
  former_collaborator: "bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-400",
  current_collaborator: "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400",
  doctor_referral: "bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400",
  conference: "bg-rose-100 text-rose-600 dark:bg-rose-900 dark:text-rose-400",
};

type PipelineValue =
  | "initial:active_contract" | "initial:former" | "initial:not_contacted"
  | "coop:unknown" | "coop:interested" | "coop:not_interested"
  | "contract_int:unknown" | "contract_int:interested" | "contract_int:not_interested"
  | "contract:active" | "contract:none"
  | "";

interface PipelineOption {
  value: PipelineValue;
  labelKey: string;
  icon: typeof Circle;
  stage: number;
  sentiment: "positive" | "negative" | "neutral";
  color: string;
}

interface PipelineCategory {
  key: string;
  labelKey: string;
  icon: typeof Circle;
  options: PipelineOption[];
}

const PIPELINE_CATEGORIES: PipelineCategory[] = [
  {
    key: "initial", labelKey: "initialStatus", icon: CircleDot,
    options: [
      { value: "initial:not_contacted", labelKey: "notContacted", icon: Circle, stage: 1, sentiment: "neutral", color: "text-gray-500" },
      { value: "initial:former", labelKey: "formerCollaborator", icon: Users, stage: 1, sentiment: "neutral", color: "text-amber-600" },
      { value: "initial:active_contract", labelKey: "activeContract", icon: ShieldCheck, stage: 5, sentiment: "positive", color: "text-green-600" },
    ],
  },
  {
    key: "cooperation", labelKey: "cooperationInterest", icon: Handshake,
    options: [
      { value: "coop:unknown", labelKey: "unknown", icon: HelpCircle, stage: 2, sentiment: "neutral", color: "text-gray-500" },
      { value: "coop:interested", labelKey: "interested", icon: CheckCircle2, stage: 3, sentiment: "positive", color: "text-green-600" },
      { value: "coop:not_interested", labelKey: "notInterested", icon: Ban, stage: 3, sentiment: "negative", color: "text-red-500" },
    ],
  },
  {
    key: "contract_interest", labelKey: "contractInterest", icon: FileSignature,
    options: [
      { value: "contract_int:unknown", labelKey: "unknown", icon: HelpCircle, stage: 3, sentiment: "neutral", color: "text-gray-500" },
      { value: "contract_int:interested", labelKey: "interested", icon: CheckCircle2, stage: 4, sentiment: "positive", color: "text-green-600" },
      { value: "contract_int:not_interested", labelKey: "notInterested", icon: Ban, stage: 4, sentiment: "negative", color: "text-red-500" },
    ],
  },
  {
    key: "contract_status", labelKey: "contractStatus", icon: ScrollText,
    options: [
      { value: "contract:none", labelKey: "noContract", icon: ScrollText, stage: 4, sentiment: "neutral", color: "text-gray-500" },
      { value: "contract:active", labelKey: "activeContract", icon: ShieldCheck, stage: 5, sentiment: "positive", color: "text-green-600" },
    ],
  },
];

const ALL_PIPELINE_OPTIONS = PIPELINE_CATEGORIES.flatMap(c => c.options);

function pipelineValueToDbFields(val: PipelineValue) {
  const fields = { initialStatus: "", interestCooperation: "", interestContract: "", contractStatus: "" };
  if (!val) return fields;
  const [cat, opt] = val.split(":");
  if (cat === "initial") fields.initialStatus = opt;
  else if (cat === "coop") fields.interestCooperation = opt;
  else if (cat === "contract_int") fields.interestContract = opt;
  else if (cat === "contract") fields.contractStatus = opt;
  return fields;
}

function dbFieldsToPipelineValue(d: ClinicFormData): PipelineValue {
  if (d.contractStatus) return `contract:${d.contractStatus}` as PipelineValue;
  if (d.interestContract) return `contract_int:${d.interestContract}` as PipelineValue;
  if (d.interestCooperation) return `coop:${d.interestCooperation}` as PipelineValue;
  if (d.initialStatus) return `initial:${d.initialStatus}` as PipelineValue;
  return "";
}

function getSelectedPipelineOption(val: PipelineValue): PipelineOption | null {
  if (!val) return null;
  return ALL_PIPELINE_OPTIONS.find(o => o.value === val) || null;
}

function getSelectedPipelineCategory(val: PipelineValue): PipelineCategory | null {
  if (!val) return null;
  return PIPELINE_CATEGORIES.find(c => c.options.some(o => o.value === val)) || null;
}

const PROGRESS_STAGES = [
  { key: "contact", labelKey: "contact", icon: UserPlus },
  { key: "referral", labelKey: "referral", icon: UserCheck },
  { key: "cooperation", labelKey: "cooperation", icon: Handshake },
  { key: "contract_interest", labelKey: "contract", icon: FileSignature },
  { key: "partner", labelKey: "partner", icon: ShieldCheck },
];

function getProgressState(formData: ClinicFormData, hasReferral: boolean) {
  const pipelineVal = dbFieldsToPipelineValue(formData);
  const opt = getSelectedPipelineOption(pipelineVal);
  const hasLeadSource = !!formData.leadSource;
  const stage = opt?.stage || 0;
  const isNegative = opt?.sentiment === "negative";

  return PROGRESS_STAGES.map((ps, idx) => {
    const stageNum = idx + 1;
    if (ps.key === "contact") {
      return { ...ps, status: hasLeadSource ? "done" as const : "pending" as const };
    }
    if (ps.key === "referral") {
      return { ...ps, status: hasReferral ? "done" as const : "pending" as const };
    }
    if (isNegative && stageNum === stage) {
      return { ...ps, status: "negative" as const };
    }
    if (stageNum <= stage) {
      return { ...ps, status: "done" as const };
    }
    return { ...ps, status: "pending" as const };
  });
}

function getDoctorFullName(d: { doctorTitle?: string; doctorFirstName?: string; doctorLastName?: string; doctorName?: string } | null | undefined) {
  if (!d) return "";
  const parts = [d.doctorTitle, d.doctorFirstName, d.doctorLastName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : (d.doctorName || "");
}

interface ClinicFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Clinic | null;
  onSuccess: () => void;
  mode?: "sheet" | "inline";
  prefillData?: Partial<ClinicFormData>;
  onCreated?: (clinic: { id: string; name: string; doctorTitle?: string | null; doctorFirstName?: string | null; doctorLastName?: string | null; doctorName?: string | null }) => void | Promise<void>;
}

function ClinicPersonnelTab({ clinicId, clinicName }: { clinicId: string; clinicName: string }) {
  const { t, locale } = useI18n();
  const { data: personnelData, isLoading } = useQuery<any>({
    queryKey: ["/api/institutions", "clinic", clinicId, "personnel"],
    queryFn: () => fetch(`/api/institutions/clinic/${clinicId}/personnel`, { credentials: "include" }).then(r => r.json()),
  });

  if (isLoading) {
    return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>;
  }

  const assigned: any[] = personnelData?.assigned || [];
  const legacy: any[] = personnelData?.legacy || [];
  const allPersonnel = [...assigned, ...legacy];
  const clinicDoctor = personnelData?.clinicDoctor;

  return (
    <div className="space-y-4" data-testid="clinic-personnel-tab-content">
      {clinicDoctor && (
        <div className="rounded-xl border-2 border-teal-300 dark:border-teal-700 bg-gradient-to-br from-teal-50 to-white dark:from-teal-950/40 dark:to-background p-4 shadow-sm" data-testid="clinic-personnel-doctor">
          <div className="flex items-center gap-2 mb-3">
            <Stethoscope className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300">
              {(t as any).medicalPartnerNetwork?.primaryContact || "Primary Contact"}
            </span>
            <Badge className="text-[10px] px-1.5 py-0 bg-teal-600 text-white border-teal-700 dark:bg-teal-700">
              {(t as any).medicalPartnerNetwork?.doctor || "Doctor"}
            </Badge>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-teal-200 dark:bg-teal-800 flex items-center justify-center ring-2 ring-teal-400 dark:ring-teal-600 ring-offset-2 ring-offset-background">
              <Stethoscope className="h-6 w-6 text-teal-700 dark:text-teal-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-base text-foreground">{clinicDoctor.fullName}</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                {clinicDoctor.phone && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Phone className="h-3.5 w-3.5 text-teal-500" />
                    <span>{clinicDoctor.phone}</span>
                  </div>
                )}
                {clinicDoctor.email && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 text-teal-500" />
                    <span>{clinicDoctor.email}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {!clinicDoctor && allPersonnel.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{(t as any).medicalPartnerNetwork?.noPersonnel || "No personnel assigned"}</p>
        </div>
      )}

      {allPersonnel.length > 0 && (
        <>
          {clinicDoctor && <Separator />}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800">
                <Users className="h-3 w-3 mr-1" />
                {allPersonnel.length}
              </Badge>
              <span className="text-sm text-muted-foreground">{(t as any).medicalPartnerNetwork?.personnelAssigned || "personnel assigned"}</span>
            </div>
            {allPersonnel.map((row: any) => {
              const fullName = `${row.title_before || ""} ${row.first_name || ""} ${row.last_name || ""} ${row.title_after || ""}`.trim();
              return (
                <div key={row.assignment_id || row.person_id} className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow" data-testid={`clinic-personnel-row-${row.assignment_id || row.person_id}`}>
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center">
                    <Users className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{fullName || row.person_id}</span>
                      {Array.isArray(row.recommended_by) && row.recommended_by.length > 0 && (() => {
                        const tx = (t.clinics as any) || {};
                        const recBy = row.recommended_by as Array<{ personName: string }>;
                        const names = recBy.map((r) => r.personName).join(", ");
                        let label: string;
                        if (recBy.length === 1) {
                          const lastWord = recBy[0].personName.split(" ").pop() || "";
                          const isFemale = /(ová|á)$/.test(lastWord);
                          const tpl = (isFemale ? tx.recommendedByFemale : tx.recommendedByMale) || "Recommended by {name}";
                          label = tpl.replace("{name}", recBy[0].personName);
                        } else {
                          const tpl = tx.recommendedByMultiple || "Recommended by: {names}";
                          label = tpl.replace("{names}", names);
                        }
                        return (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800 inline-flex items-center gap-1" title={names} data-testid={`badge-clinic-personnel-recommended-by-${row.person_id}`}>
                            <UserCheck className="h-2.5 w-2.5" />
                            {label}
                          </Badge>
                        );
                      })()}
                      {row.category_name && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{row.category_name}</Badge>
                      )}
                      {row.is_primary && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-800 border-amber-300">{(t.common as any).primary || "Primary"}</Badge>
                      )}
                      {row.source === "legacy_link" && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-700">Link</Badge>
                      )}
                      <CbcActivityBadgesForRow row={row} locale={locale} testIdPrefix="badge-clinic-personnel-cbc" />
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {row.department && <span>{(t as any).medicalPartnerNetwork?.department || "Dept"}: {row.department}</span>}
                      {row.position && <span>{(t as any).medicalPartnerNetwork?.position || "Position"}: {row.position}</span>}
                      {row.role && <span>{(t as any).medicalPartnerNetwork?.role || "Role"}: {row.role}</span>}
                      {row.email && <span>{row.email}</span>}
                      {row.phone && <span>{row.phone}</span>}
                      {row.mobile && <span>{row.mobile}</span>}
                    </div>
                  </div>
                  <Badge variant={row.is_active !== false ? "default" : "secondary"} className="text-[10px] shrink-0">
                    {row.is_active !== false ? t.common.active : t.common.inactive}
                  </Badge>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function CallSlot({ phoneNumber, customerId, customerName }: { phoneNumber?: string; customerId?: string | number; customerName?: string }) {
  const trimmed = (phoneNumber || "").trim();
  if (trimmed) {
    return <CallCustomerButton phoneNumber={trimmed} customerId={customerId} customerName={customerName} variant="icon" />;
  }
  return (
    <Button type="button" size="icon" variant="ghost" disabled className="opacity-40" title="Najprv zadajte telefónne číslo" data-testid="button-call-customer-disabled">
      <PhoneCall className="h-4 w-4 text-muted-foreground" />
    </Button>
  );
}

export function ClinicFormWizard({ initialData, onSuccess, onCancel }: { initialData?: Clinic | null; onSuccess: () => void; onCancel?: () => void }) {
  return (
    <ClinicFormSheet
      open={true}
      onOpenChange={(open) => { if (!open && onCancel) onCancel(); if (!open && !onCancel) onSuccess(); }}
      initialData={initialData}
      onSuccess={onSuccess}
    />
  );
}

export function ClinicFormSheet({ open, onOpenChange, initialData, onSuccess, mode = "sheet", prefillData, onCreated }: ClinicFormSheetProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("basic");
  const [postalLookupLoading, setPostalLookupLoading] = useState(false);
  const [identifiersOpen, setIdentifiersOpen] = useState(false);
  const [showMapDialog, setShowMapDialog] = useState(false);
  const [emailComposeOpen, setEmailComposeOpen] = useState(false);
  const [selectedFromAccount, setSelectedFromAccount] = useState<string>("");
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [showCcField, setShowCcField] = useState(false);
  const [emailAttachment, setEmailAttachment] = useState<File | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [selectedTemplateCategory, setSelectedTemplateCategory] = useState<string>("");
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [pipelineMenuOpen, setPipelineMenuOpen] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showExtraContacts, setShowExtraContacts] = useState(false);
  const [savePersonDialogOpen, setSavePersonDialogOpen] = useState(false);

  const buildFormData = (data: Clinic | null | undefined): ClinicFormData => {
    if (!data) return {
      name: "", doctorTitle: "", doctorFirstName: "", doctorLastName: "",
      idZz: "", pzsCode: "", pzsName: "", ico: "",
      address: "", street: "", streetNumber: "", orientationNumber: "",
      city: "", postalCode: "", countryCode: "", region: "", district: "",
      phone: "", phone2: "", phone3: "", email: "", email2: "", email3: "", website: "", latitude: "", longitude: "", isActive: true,
      notes: "", leadSource: "", leadSourceDate: "", leadSourceNotes: "", conferenceName: "",
      conferenceDate: "", isReferredByDoctor: false, isFromConference: false,
      initialStatus: "", interestCooperation: "", interestContract: "", contractStatus: "",
      lastCallResult: "", lastCallNote: "", nextContactDate: "", contractSentDate: "",
      contractReturnedDate: "", hasFlyers: false, flyersSentDate: "", flyersLocation: "",
    };
    const oldSource = data.leadSource || "";
    const isOldDoctorRef = oldSource === "doctor_referral";
    const isOldConference = oldSource === "conference";
    const mainSource = (isOldDoctorRef || isOldConference) ? "" : oldSource;
    let dTitle = (data as any).doctorTitle || "";
    let dFirst = (data as any).doctorFirstName || "";
    let dLast = (data as any).doctorLastName || "";
    if (!dTitle && !dFirst && !dLast && data.doctorName) {
      const parts = data.doctorName.trim().split(/\s+/);
      const titlePrefixes = ["mudr.", "mudr", "rndr.", "rndr", "phdr.", "phdr", "ing.", "ing", "mgr.", "mgr", "judr.", "judr", "doc.", "doc", "prof.", "prof", "bc.", "bc", "mvdr.", "mvdr", "pharmdr.", "pharmdr", "paedr.", "paedr", "dr.", "dr"];
      if (parts.length >= 2 && titlePrefixes.includes(parts[0].toLowerCase())) {
        dTitle = parts[0];
        if (parts.length === 2) { dLast = parts[1]; }
        else { dFirst = parts[1]; dLast = parts.slice(2).join(" "); }
      } else if (parts.length === 1) {
        dLast = parts[0];
      } else {
        dFirst = parts[0];
        dLast = parts.slice(1).join(" ");
      }
    }
    return {
      name: data.name, doctorTitle: dTitle, doctorFirstName: dFirst, doctorLastName: dLast,
      idZz: (data as any).idZz || "", pzsCode: (data as any).pzsCode || "", pzsName: (data as any).pzsName || "", ico: (data as any).ico || "",
      address: data.address || "",
      street: (data as any).street || "",
      streetNumber: (data as any).streetNumber || "",
      orientationNumber: (data as any).orientationNumber || "",
      city: data.city || "", postalCode: data.postalCode || "",
      countryCode: data.countryCode, region: (data as any).region || "", district: (data as any).district || "",
      phone: data.phone || "", phone2: (data as any).phone2 || "", phone3: (data as any).phone3 || "",
      email: data.email || "", email2: (data as any).email2 || "", email3: (data as any).email3 || "",
      website: data.website || "", latitude: data.latitude || "", longitude: data.longitude || "",
      isActive: data.isActive, notes: data.notes || "", leadSource: mainSource,
      leadSourceDate: data.leadSourceDate ? new Date(data.leadSourceDate).toISOString().split("T")[0] : "",
      leadSourceNotes: data.leadSourceNotes || "", conferenceName: data.conferenceName || "",
      conferenceDate: data.conferenceDate ? new Date(data.conferenceDate).toISOString().split("T")[0] : "",
      isReferredByDoctor: data.isReferredByDoctor ?? isOldDoctorRef,
      isFromConference: data.isFromConference ?? isOldConference,
      initialStatus: (data as any).initialStatus || "",
      interestCooperation: (data as any).interestCooperation || "",
      interestContract: (data as any).interestContract || "",
      contractStatus: (data as any).contractStatus || "",
      lastCallResult: (data as any).lastCallResult || "",
      lastCallNote: (data as any).lastCallNote || "",
      nextContactDate: (data as any).nextContactDate ? new Date((data as any).nextContactDate).toISOString().split("T")[0] : "",
      contractSentDate: (data as any).contractSentDate ? new Date((data as any).contractSentDate).toISOString().split("T")[0] : "",
      contractReturnedDate: (data as any).contractReturnedDate ? new Date((data as any).contractReturnedDate).toISOString().split("T")[0] : "",
      hasFlyers: (data as any).hasFlyers ?? false,
      flyersSentDate: (data as any).flyersSentDate ? new Date((data as any).flyersSentDate).toISOString().split("T")[0] : "",
      flyersLocation: (data as any).flyersLocation || "",
    };
  };
  const [formData, setFormData] = useState<ClinicFormData>(() => ({ ...buildFormData(initialData), ...(prefillData || {}) }));

  const lookupPostalCode = async () => {
    if (!formData.city) {
      toast({ title: (t.clinics as any).postalLookupNeedsCity || "Najprv zadajte mesto", variant: "destructive" });
      return;
    }
    try {
      setPostalLookupLoading(true);
      const res = await apiRequest("POST", "/api/ai/lookup-postal-code", {
        countryCode: formData.countryCode || "SK",
        city: formData.city,
        street: formData.street || undefined,
      });
      const data = await res.json();
      if (data?.postalCode) {
        setFormData(prev => ({ ...prev, postalCode: data.postalCode }));
        toast({ title: (t.clinics as any).postalLookupOk || "PSČ doplnené" });
      } else {
        toast({ title: (t.clinics as any).postalLookupFail || "PSČ sa nepodarilo zistiť", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: e?.message || "Chyba pri vyhľadávaní PSČ", variant: "destructive" });
    } finally {
      setPostalLookupLoading(false);
    }
  };

  const { data: allClinics } = useQuery<any[]>({ queryKey: ["/api/clinics/lookup"] });

  const { data: sharedMailboxes = [] } = useQuery<{ id: string; email: string; displayName: string; isDefault: boolean }[]>({
    queryKey: ["/api/users", user?.id, "ms365-shared-mailboxes"],
    queryFn: async () => {
      if (!user?.id) return [];
      const res = await fetch(`/api/users/${user.id}/ms365-shared-mailboxes`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user?.id,
  });

  const { data: personalMs365 } = useQuery<{ email: string; displayName: string; hasTokens: boolean } | null>({
    queryKey: ["/api/users", user?.id, "ms365-connection"],
    queryFn: async () => {
      if (!user?.id) return null;
      const res = await fetch(`/api/users/${user.id}/ms365-connection`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user?.id,
  });

  const allEmailAccounts = useMemo(() => {
    const accounts: { id: string; email: string; displayName: string; type: "personal" | "shared"; isDefault: boolean }[] = [];
    if (personalMs365?.hasTokens && personalMs365?.email) {
      accounts.push({
        id: "personal",
        email: personalMs365.email,
        displayName: personalMs365.displayName || personalMs365.email,
        type: "personal",
        isDefault: false,
      });
    }
    sharedMailboxes.forEach((mb) => {
      accounts.push({
        id: mb.id,
        email: mb.email,
        displayName: mb.displayName || mb.email,
        type: "shared",
        isDefault: mb.isDefault,
      });
    });
    return accounts;
  }, [personalMs365, sharedMailboxes]);

  useEffect(() => {
    if (emailComposeOpen && allEmailAccounts.length > 0 && !selectedFromAccount) {
      const def = allEmailAccounts.find((m) => m.isDefault);
      if (def) setSelectedFromAccount(def.id);
      else if (allEmailAccounts[0]) setSelectedFromAccount(allEmailAccounts[0].id);
    }
  }, [emailComposeOpen, allEmailAccounts, selectedFromAccount]);

  const clinicLocale = useMemo(() => {
    const c = (initialData?.country || formData.country || "SK").toUpperCase();
    return (COUNTRY_TO_LOCALE as any)[c] || "sk";
  }, [initialData?.country, formData.country]);

  const { data: emailTemplates = [] } = useQuery<{ id: string; name: string; subject: string | null; content: string; contentHtml: string | null; categoryId: string | null; language: string | null }[]>({
    queryKey: ["/api/message-templates", "email", clinicLocale],
    queryFn: async () => {
      const res = await fetch(`/api/message-templates?type=email&isActive=true&language=${clinicLocale}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: emailComposeOpen,
  });

  const { data: templateCategories = [] } = useQuery<{ id: string; name: string; color?: string | null }[]>({
    queryKey: ["/api/template-categories"],
    queryFn: async () => {
      const res = await fetch(`/api/template-categories`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: emailComposeOpen,
  });

  const visibleEmailTemplates = useMemo(() => {
    if (!selectedTemplateCategory || selectedTemplateCategory === "__all__") return emailTemplates;
    if (selectedTemplateCategory === "__uncategorized__") return emailTemplates.filter((tpl) => !tpl.categoryId);
    return emailTemplates.filter((tpl) => tpl.categoryId === selectedTemplateCategory);
  }, [emailTemplates, selectedTemplateCategory]);

  const usedCategoryIds = useMemo(() => {
    const set = new Set<string>();
    emailTemplates.forEach((tpl) => { if (tpl.categoryId) set.add(tpl.categoryId); });
    return set;
  }, [emailTemplates]);

  const visibleCategories = useMemo(
    () => templateCategories.filter((c) => usedCategoryIds.has(c.id)),
    [templateCategories, usedCategoryIds],
  );

  const hasUncategorized = useMemo(
    () => emailTemplates.some((tpl) => !tpl.categoryId),
    [emailTemplates],
  );

  const { data: networkMembershipsSheet = [] } = useQuery<any[]>({
    queryKey: ["/api/hospital-network-memberships"],
  });
  const clinicNetworks = initialData?.id ? (networkMembershipsSheet.filter((m: any) => m.clinic_id === initialData.id).map((m: any) => m.network_name).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)) : [];

  const { data: existingReferrals } = useQuery<Array<{ id: string; clinicId: string; referringClinicId: string; referralType: string; referringClinic: Clinic | null }>>({
    queryKey: ["/api/clinic-referrals", initialData?.id],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!initialData?.id && open,
  });

  const { data: reverseReferrals } = useQuery<Array<{ id: string; clinicId: string; referringClinicId: string; referralType: string; clinic: Clinic | null }>>({
    queryKey: ["/api/clinic-referred-by-me", initialData?.id],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!initialData?.id && open,
  });

  interface ClinicEventItem {
    id: string; clinicId: string; eventType: string; title: string;
    description: string | null; metadata: any; createdBy: string | null;
    createdByName: string | null; createdAt: string;
  }
  const { data: clinicEventsData, isLoading: eventsLoading } = useQuery<ClinicEventItem[]>({
    queryKey: ["/api/clinic-events", initialData?.id],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!initialData?.id && open && activeTab === "history",
  });

  const [referrals, setReferrals] = useState<Array<{ clinicId: string; clinicName: string; referralType: string }>>([]);
  const [suggestsReferrals, setSuggestsReferrals] = useState<Array<{ clinicId: string; clinicName: string }>>([]);
  const [referralSearch, setReferralSearch] = useState("");
  const [suggestsSearch, setSuggestsSearch] = useState("");
  const [confReferralSearch, setConfReferralSearch] = useState("");
  const [nestedClinicForm, setNestedClinicForm] = useState<{ direction: "recommendedBy" | "suggests"; prefillName: string } | null>(null);
  const userEditedReferralsRef = useRef(false);

  useEffect(() => {
    if (open) {
      setActiveTab("basic");
      setReferrals([]);
      setSuggestsReferrals([]);
      setReferralSearch("");
      setSuggestsSearch("");
      setConfReferralSearch("");
      setNestedClinicForm(null);
      setShowMapDialog(false);
      setIsLoadingLocation(false);
      setPipelineMenuOpen(false);
      setExpandedCategory(null);
      setFormData(buildFormData(initialData));
      userEditedReferralsRef.current = false;
    }
  }, [open, initialData?.id]);

  useEffect(() => {
    if (!open) return;
    if (userEditedReferralsRef.current) return;
    if (existingReferrals) {
      setReferrals(existingReferrals.filter(r => r.referringClinic).map(r => ({
        clinicId: String(r.referringClinicId),
        clinicName: getDoctorFullName(r.referringClinic) || r.referringClinic?.name || "",
        referralType: r.referralType || "doctor_referral",
      })));
    }
  }, [existingReferrals, open]);

  useEffect(() => {
    if (!open) return;
    if (userEditedReferralsRef.current) return;
    if (reverseReferrals) {
      setSuggestsReferrals(reverseReferrals.filter(r => r.clinic).map(r => ({
        clinicId: String(r.clinicId),
        clinicName: getDoctorFullName(r.clinic) || r.clinic?.name || "",
      })));
    }
  }, [reverseReferrals, open]);

  const filterClinicsFor = (searchStr: string, excludeList?: Array<{ clinicId: string }>) => {
    if (!searchStr) return [];
    const excluded = excludeList || referrals;
    const currentCountry = formData.countryCode;
    return (allClinics?.filter((c) => {
      if (currentCountry && c.countryCode && c.countryCode !== currentCountry) return false;
      if (initialData && String(c.id) === String(initialData.id)) return false;
      if (excluded.some((r) => String(r.clinicId) === String(c.id))) return false;
      const s = searchStr.toLowerCase();
      const fullName = getDoctorFullName(c as any);
      return c.name.toLowerCase().includes(s) || fullName.toLowerCase().includes(s) || (c.doctorName && c.doctorName.toLowerCase().includes(s)) || (c.city && c.city.toLowerCase().includes(s));
    }) || []);
  };
  const filteredClinics = filterClinicsFor(referralSearch, referrals);
  const filteredClinicsSuggests = filterClinicsFor(suggestsSearch, suggestsReferrals);
  const filteredClinicsConf = filterClinicsFor(confReferralSearch);

  const addReferral = (clinic: Clinic, type: string) => {
    userEditedReferralsRef.current = true;
    const displayName = getDoctorFullName(clinic as any) || clinic.name;
    setReferrals([...referrals, { clinicId: String(clinic.id), clinicName: displayName, referralType: type }]);
    if (type === "doctor_referral") setReferralSearch("");
    else setConfReferralSearch("");
  };

  const addSuggestsReferral = (clinic: Clinic) => {
    userEditedReferralsRef.current = true;
    const displayName = getDoctorFullName(clinic as any) || clinic.name;
    setSuggestsReferrals([...suggestsReferrals, { clinicId: String(clinic.id), clinicName: displayName }]);
    setSuggestsSearch("");
  };

  const removeSuggestsReferral = (clinicId: string) => {
    userEditedReferralsRef.current = true;
    setSuggestsReferrals(suggestsReferrals.filter((r) => r.clinicId !== clinicId));
  };

  const removeReferral = (clinicId: string) => {
    userEditedReferralsRef.current = true;
    setReferrals(referrals.filter((r) => r.clinicId !== clinicId));
  };

  const handleNestedPersonCreatedForClinic = async (newPerson: any) => {
    if (!newPerson?.id || !nestedClinicForm) return;
    userEditedReferralsRef.current = true;
    const titleBefore = (newPerson.titleBefore || "").trim();
    const firstName = (newPerson.firstName || "").trim();
    const lastName = (newPerson.lastName || "").trim();
    const fullName = [titleBefore, firstName, lastName].filter(Boolean).join(" ").trim() || lastName || "";
    try {
      const res = await apiRequest("POST", "/api/clinics", {
        name: fullName || lastName || "Doctor",
        countryCode: formData.countryCode || newPerson.countryCode || "SK",
        doctorTitle: titleBefore || null,
        doctorFirstName: firstName || null,
        doctorLastName: lastName || null,
        clinicType: "doctor",
        isActive: true,
      });
      const stubClinic = await res.json();
      if (nestedClinicForm.direction === "recommendedBy") {
        setReferrals(prev => [...prev, { clinicId: String(stubClinic.id), clinicName: fullName, referralType: "doctor_referral" }]);
        setReferralSearch("");
      } else {
        setSuggestsReferrals(prev => [...prev, { clinicId: String(stubClinic.id), clinicName: fullName }]);
        setSuggestsSearch("");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/clinics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clinics/lookup"] });
      queryClient.invalidateQueries({ queryKey: ["/api/collaborators"] });
    } catch (e: any) {
      toast({ title: "Failed to link new doctor", description: e?.message, variant: "destructive" });
    }
  };

  const doctorReferrals = referrals.filter(r => r.referralType === "doctor_referral");
  const conferenceReferrals = referrals.filter(r => r.referralType === "conference");
  const hasAnyReferral = formData.isReferredByDoctor || formData.isFromConference || referrals.length > 0;

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: t.clinics.gpsNotSupported || "GPS is not supported", variant: "destructive" });
      return;
    }
    setIsLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({ ...prev, latitude: position.coords.latitude.toFixed(7), longitude: position.coords.longitude.toFixed(7) }));
        setIsLoadingLocation(false);
        toast({ title: t.clinics.gpsLoaded || "GPS coordinates loaded" });
      },
      (error) => {
        setIsLoadingLocation(false);
        let message = t.clinics.gpsError || "Could not get location";
        if (error.code === error.PERMISSION_DENIED) message = t.clinics.gpsPermissionDenied || "Location access denied";
        toast({ title: message, variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const getWebsiteUrl = (url: string) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `https://${url}`;
  };

  const doctorFullName = [formData.doctorTitle, formData.doctorFirstName, formData.doctorLastName].filter(Boolean).join(" ");

  const currentPipelineValue = dbFieldsToPipelineValue(formData);
  const currentPipelineOption = getSelectedPipelineOption(currentPipelineValue);
  const currentPipelineCategory = getSelectedPipelineCategory(currentPipelineValue);
  const progressStages = getProgressState(formData, hasAnyReferral);

  const selectPipelineOption = (val: PipelineValue) => {
    const isDeselect = currentPipelineValue === val;
    const fields = isDeselect
      ? { initialStatus: "", interestCooperation: "", interestContract: "", contractStatus: "" }
      : pipelineValueToDbFields(val);
    setFormData(prev => ({
      ...prev,
      initialStatus: fields.initialStatus,
      interestCooperation: fields.interestCooperation,
      interestContract: fields.interestContract,
      contractStatus: fields.contractStatus,
    }));
    setPipelineMenuOpen(false);
    setExpandedCategory(null);
  };

  const saveMutation = useMutation({
    mutationFn: async (data: ClinicFormData) => {
      const composedAddress = [
        [data.street, data.streetNumber, data.orientationNumber ? `/${data.orientationNumber}` : ""].filter(Boolean).join(" ").trim(),
      ].filter(Boolean).join(" ").trim();
      const payload = {
        name: data.name,
        doctorTitle: data.doctorTitle || null,
        doctorFirstName: data.doctorFirstName || null,
        doctorLastName: data.doctorLastName || null,
        doctorName: [data.doctorTitle, data.doctorFirstName, data.doctorLastName].filter(Boolean).join(" ") || null,
        idZz: data.idZz || null,
        pzsCode: data.pzsCode || null,
        pzsName: data.pzsName || null,
        ico: data.ico || null,
        address: composedAddress || data.address || null,
        street: data.street || null,
        streetNumber: data.streetNumber || null,
        orientationNumber: data.orientationNumber || null,
        city: data.city || null,
        postalCode: data.postalCode || null,
        countryCode: data.countryCode || "SK",
        region: data.region || null,
        district: data.district || null,
        phone: data.phone || null,
        phone2: data.phone2 || null,
        phone3: data.phone3 || null,
        email: data.email || null,
        email2: data.email2 || null,
        email3: data.email3 || null,
        website: data.website || null,
        latitude: data.latitude ? data.latitude : null,
        longitude: data.longitude ? data.longitude : null,
        isActive: data.isActive,
        notes: data.notes || null,
        leadSource: data.leadSource || null,
        leadSourceDate: data.leadSourceDate ? new Date(data.leadSourceDate).toISOString() : null,
        leadSourceNotes: data.leadSourceNotes || null,
        conferenceDate: data.conferenceDate && data.isFromConference ? new Date(data.conferenceDate).toISOString() : null,
        conferenceName: data.isFromConference ? (data.conferenceName || null) : null,
        isReferredByDoctor: data.isReferredByDoctor,
        isFromConference: data.isFromConference,
        initialStatus: data.initialStatus || null,
        interestCooperation: data.interestCooperation || null,
        interestContract: data.interestContract || null,
        contractStatus: data.contractStatus || null,
        lastCallResult: data.lastCallResult || null,
        lastCallNote: data.lastCallNote || null,
        nextContactDate: data.nextContactDate ? new Date(data.nextContactDate).toISOString() : null,
        contractSentDate: data.contractSentDate ? new Date(data.contractSentDate).toISOString() : null,
        contractReturnedDate: data.contractReturnedDate ? new Date(data.contractReturnedDate).toISOString() : null,
        hasFlyers: data.hasFlyers,
        flyersSentDate: data.hasFlyers && data.flyersSentDate ? new Date(data.flyersSentDate).toISOString() : null,
        flyersLocation: data.hasFlyers ? (data.flyersLocation || null) : null,
      };
      let res;
      if (initialData) {
        res = await apiRequest("PUT", `/api/clinics/${initialData.id}`, payload);
      } else {
        res = await apiRequest("POST", "/api/clinics", payload);
      }
      const savedClinic = await res.json();
      if (savedClinic?.id) {
        if (initialData && existingReferrals && existingReferrals.length > 0) {
          for (const old of existingReferrals) {
            await apiRequest("DELETE", `/api/clinic-referrals/${old.id}`);
          }
        }
        if (referrals.length > 0) {
          for (const ref of referrals) {
            await apiRequest("POST", "/api/clinic-referrals", {
              clinicId: savedClinic.id,
              referringClinicId: ref.clinicId,
              referralType: ref.referralType,
            });
          }
        }
        if (initialData && reverseReferrals && reverseReferrals.length > 0) {
          for (const old of reverseReferrals) {
            await apiRequest("DELETE", `/api/clinic-referrals/${old.id}`);
          }
        }
        if (suggestsReferrals.length > 0) {
          for (const ref of suggestsReferrals) {
            await apiRequest("POST", "/api/clinic-referrals", {
              clinicId: ref.clinicId,
              referringClinicId: savedClinic.id,
              referralType: "doctor_referral",
            });
          }
        }
      }
      if (savedClinic?.id && onCreated && !initialData) {
        try { await onCreated(savedClinic); } catch (e) { console.error("[ClinicFormSheet] onCreated callback failed:", e); }
      }
      return savedClinic;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clinics/lookup"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clinic-referrals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clinic-referral-counts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clinic-referred-by-me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clinic-events"] });
      toast({ title: t.success.saved });
      onSuccess();
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!formData.name || !formData.countryCode) {
      toast({ title: t.errors.required, variant: "destructive" });
      setActiveTab("basic");
      return;
    }
    saveMutation.mutate(formData);
  };

  const ProgressBar = () => {
    const stages = progressStages;
    return (
      <div className="flex items-center w-full gap-0" data-testid="clinic-progress-bar">
        {stages.map((stage, idx) => {
          const Icon = stage.icon;
          const isDone = stage.status === "done";
          const isNeg = stage.status === "negative";
          const isPending = stage.status === "pending";
          const dotColor = isDone
            ? "bg-green-500 text-white border-green-500"
            : isNeg
              ? "bg-red-500 text-white border-red-500"
              : "bg-background text-muted-foreground border-border";
          const lineColor = isDone ? "bg-green-400" : isNeg ? "bg-red-400" : "bg-border";
          return (
            <div key={stage.key} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center">
                <div className={cn("flex items-center justify-center w-6 h-6 rounded-full border-2 shrink-0 transition-all", dotColor)}>
                  <Icon className="h-3 w-3" />
                </div>
                <span className={cn("text-[9px] mt-0.5 font-medium whitespace-nowrap",
                  isDone ? "text-green-700 dark:text-green-400"
                    : isNeg ? "text-red-600 dark:text-red-400"
                      : "text-muted-foreground/60"
                )}>{(t.clinics as any).progress?.[stage.labelKey] || stage.labelKey}</span>
              </div>
              {idx < stages.length - 1 && (
                <div className={cn("h-0.5 flex-1 mx-1 rounded-full transition-all", lineColor)} />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const clinicEditTabs = [
    { key: "basic", icon: Building2, label: t.clinics.steps?.basic || "Info" },
    { key: "address", icon: MapPin, label: t.clinics.steps?.address || "Address" },
    { key: "referral", icon: CircleDot, label: t.clinics.steps.referral },
    { key: "history", icon: History, label: t.clinics.steps?.history || "History" },
    { key: "personnel", icon: Users, label: (t as any).personnel || "Personnel" },
    { key: "campaigns", icon: Megaphone, label: (t as any).campaigns?.title || "Campaigns" },
  ];

  const HeaderWrapper = mode === "inline" ? "div" : SheetHeader;
  const TitleWrapper = mode === "inline" ? "h3" : SheetTitle;

  const formContent = (
    <>
          <HeaderWrapper className="px-6 pt-5 pb-2">
            <TitleWrapper className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                <Stethoscope className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base">{initialData ? t.clinics.editClinic : t.clinics.addClinic}</span>
                  {clinicNetworks.map((netName: string) => (
                    <Badge key={netName} className="text-[10px] px-1.5 py-0 font-bold bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/60 dark:text-amber-300 dark:border-amber-700" data-testid="badge-clinic-network">
                      <Network className="h-2.5 w-2.5 mr-0.5" />
                      {netName}
                    </Badge>
                  ))}
                </div>
                {initialData && doctorFullName && (
                  <p className="text-xs text-muted-foreground font-normal truncate">{doctorFullName} • {initialData.name}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {initialData?.email && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" data-testid="button-clinic-email"
                          onClick={() => {
                            const params = new URLSearchParams();
                            if (initialData.email) params.set("compose", initialData.email);
                            params.set("contactSearch", initialData.email || initialData.phone || "");
                            const emails = [initialData.email].filter(Boolean) as string[]; setSelectedEmails(emails); setEmailComposeOpen(true);
                          }}
                        >
                          <Mail className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>{initialData.email}</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {initialData?.phone && (
                  <CallCustomerButton phoneNumber={initialData.phone} customerName={doctorFullName || initialData.name} variant="icon" />
                )}
              </div>
            </TitleWrapper>
          </HeaderWrapper>

          {/* Progress Bar */}
          <div className="mx-6 mb-1 px-2 py-2.5 rounded-lg bg-muted/40 border" data-testid="clinic-status-bar">
            <ProgressBar />
            {currentPipelineOption && (
              <div className="flex items-center justify-center mt-1.5">
                <div className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-semibold border",
                  currentPipelineOption.sentiment === "positive" ? "bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200 dark:border-green-700"
                    : currentPipelineOption.sentiment === "negative" ? "bg-red-100 text-red-700 border-red-300 dark:bg-red-900 dark:text-red-200 dark:border-red-700"
                      : "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
                )}>
                  {currentPipelineCategory && <span className="opacity-70">{(t.clinics as any).pipeline?.[currentPipelineCategory.labelKey] || currentPipelineCategory.labelKey}:</span>}
                  <span>{(t.clinics as any).pipeline?.[currentPipelineOption.labelKey] || currentPipelineOption.labelKey}</span>
                </div>
              </div>
            )}
            {/* Referral badges in progress bar area */}
            {(formData.isReferredByDoctor || formData.isFromConference) && (
              <div className="flex items-center justify-center gap-1.5 mt-1 flex-wrap">
                {formData.isReferredByDoctor && (
                  <div className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border", LEAD_SOURCE_COLORS.doctor_referral)}>
                    <UserCheck className="h-2.5 w-2.5" />
                    Referral
                  </div>
                )}
                {formData.isFromConference && (
                  <div className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border", LEAD_SOURCE_COLORS.conference)}>
                    <GraduationCap className="h-2.5 w-2.5" />
                    Conference
                  </div>
                )}
              </div>
            )}
          </div>


          {(
            <div className="px-4 pb-4">
              <div className="space-y-4 pt-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
                      <div className="p-1 rounded-md bg-blue-100 dark:bg-blue-900"><CircleDot className="h-3 w-3 text-blue-600 dark:text-blue-400" /></div>
                      {t.clinics.leadSource}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-1">
                    <div className="grid gap-1.5">
                      {MAIN_SOURCE_TYPES.map((type) => {
                        const Icon = LEAD_SOURCE_ICONS[type];
                        const selected = formData.leadSource === type;
                        const isExpanded = selected && pipelineMenuOpen;
                        return (
                          <div key={type}>
                            <button type="button"
                              className={cn("flex items-center gap-3 px-3 py-2.5 border rounded-lg cursor-pointer transition-all w-full text-left",
                                selected ? cn("border-2 shadow-sm", LEAD_SOURCE_COLORS[type]) : formData.leadSource ? "opacity-40 border-border hover:opacity-70" : "hover:bg-muted/50 border-border",
                                isExpanded && "rounded-b-none"
                              )}
                              onClick={() => {
                                if (selected) { setPipelineMenuOpen(!pipelineMenuOpen); setExpandedCategory(null); }
                                else { setFormData(prev => ({ ...prev, leadSource: type })); setPipelineMenuOpen(true); setExpandedCategory(null); }
                              }}
                              data-testid={`source-card-${type}`}
                            >
                              <div className={cn("flex items-center justify-center w-8 h-8 rounded-lg shrink-0", LEAD_SOURCE_ICON_BG[type])}>
                                <Icon className="h-4 w-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm">{t.clinics.leadSourceTypes?.[type] || type}</div>
                                {selected && currentPipelineOption && !isExpanded && (
                                  <div className={cn("text-xs mt-0.5 font-medium", currentPipelineOption.color)}>
                                    {(t.clinics as any).pipeline?.[currentPipelineCategory?.labelKey] || currentPipelineCategory?.labelKey}: {(t.clinics as any).pipeline?.[currentPipelineOption.labelKey] || currentPipelineOption.labelKey}
                                  </div>
                                )}
                              </div>
                              {selected && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <CheckCircle2 className="h-4 w-4 text-primary" />
                                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
                                </div>
                              )}
                            </button>
                            {isExpanded && (
                              <div className="border border-t-0 rounded-b-lg bg-muted/20 dark:bg-muted/10 overflow-hidden" data-testid="pipeline-submenu">
                                {PIPELINE_CATEGORIES.map((cat) => {
                                  const CatIcon = cat.icon;
                                  const isCatExpanded = expandedCategory === cat.key;
                                  const selectedInCat = cat.options.find(o => o.value === currentPipelineValue);
                                  return (
                                    <div key={cat.key}>
                                      <button type="button"
                                        className={cn("flex items-center gap-2.5 w-full px-4 py-2.5 text-left transition-all hover:bg-muted/50",
                                          isCatExpanded && "bg-muted/40", selectedInCat && "bg-primary/5"
                                        )}
                                        onClick={() => setExpandedCategory(isCatExpanded ? null : cat.key)}
                                        data-testid={`pipeline-cat-${cat.key}`}
                                      >
                                        <CatIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                                        <span className="text-sm font-medium flex-1">{(t.clinics as any).pipeline?.[cat.labelKey] || cat.labelKey}</span>
                                        {selectedInCat && (
                                          <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border",
                                            selectedInCat.sentiment === "positive" ? "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700"
                                              : selectedInCat.sentiment === "negative" ? "bg-red-100 text-red-600 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700"
                                                : "bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600"
                                          )}>{(t.clinics as any).pipeline?.[selectedInCat.labelKey] || selectedInCat.labelKey}</span>
                                        )}
                                        <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0", isCatExpanded && "rotate-90")} />
                                      </button>
                                      {isCatExpanded && (
                                        <div className="px-4 pb-2 pt-1 space-y-1">
                                          {cat.options.map((opt) => {
                                            const OptIcon = opt.icon;
                                            const isSelected = currentPipelineValue === opt.value;
                                            return (
                                              <button key={opt.value} type="button"
                                                className={cn("flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-left transition-all",
                                                  isSelected
                                                    ? opt.sentiment === "positive" ? "bg-green-100 border border-green-300 text-green-800 dark:bg-green-900/40 dark:border-green-700 dark:text-green-200"
                                                      : opt.sentiment === "negative" ? "bg-red-100 border border-red-300 text-red-700 dark:bg-red-900/40 dark:border-red-700 dark:text-red-200"
                                                        : "bg-primary/10 border border-primary/30 text-foreground"
                                                    : "hover:bg-muted/60 border border-transparent"
                                                )}
                                                onClick={() => selectPipelineOption(opt.value)}
                                                data-testid={`pipeline-opt-${opt.value}`}
                                              >
                                                <OptIcon className={cn("h-4 w-4 shrink-0", opt.color)} />
                                                <span className="text-sm font-medium flex-1">{(t.clinics as any).pipeline?.[opt.labelKey] || opt.labelKey}</span>
                                                {isSelected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {formData.leadSource && (
                      <Button type="button" variant="ghost" size="sm" className="text-muted-foreground text-xs" onClick={() => {
                        setFormData(prev => ({ ...prev, leadSource: "", initialStatus: "", interestCooperation: "", interestContract: "", contractStatus: "" }));
                        setPipelineMenuOpen(false); setExpandedCategory(null);
                      }} data-testid="button-clear-source">
                        <X className="h-3 w-3 mr-1" /> {(t.clinics as any).pipeline?.clearSelection || t.common.clear || "Clear"}
                      </Button>
                    )}
                    <Separator />
                    <div className="space-y-2">
                      <div className={cn("border rounded-lg px-3 py-2.5 transition-all cursor-pointer", formData.isReferredByDoctor ? cn("border-2 shadow-sm", LEAD_SOURCE_COLORS.doctor_referral) : "hover:bg-muted/50 border-border")}
                        onClick={() => setFormData({ ...formData, isReferredByDoctor: !formData.isReferredByDoctor })} >
                        <div className="flex items-center gap-3">
                          <div className={cn("flex items-center justify-center w-8 h-8 rounded-lg shrink-0", LEAD_SOURCE_ICON_BG.doctor_referral)}>
                            <UserCheck className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0"><div className="font-medium text-sm">{t.clinics.leadSourceTypes?.doctor_referral || "Doctor referral"}</div></div>
                          <Checkbox checked={formData.isReferredByDoctor} onCheckedChange={(checked) => setFormData({ ...formData, isReferredByDoctor: !!checked })} data-testid="checkbox-doctor-referral" className="shrink-0" onClick={(e) => e.stopPropagation()} />
                        </div>
                      </div>
                      {formData.isReferredByDoctor && (
                        <div className="ml-3 pl-3 border-l-2 border-purple-200 dark:border-purple-800 space-y-2">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input value={referralSearch} onChange={(e) => setReferralSearch(e.target.value)} placeholder={t.clinics.selectDoctor} className="pl-9 h-9" data-testid="input-referral-search" />
                          </div>
                          {referralSearch && filteredClinics.length > 0 && (
                            <div className="border rounded-lg max-h-36 overflow-y-auto">
                              {filteredClinics.slice(0, 10).map((clinic) => (
                                <div key={clinic.id} className="flex items-center justify-between p-2 hover:bg-muted/50 cursor-pointer" onClick={() => addReferral(clinic, "doctor_referral")} data-testid={`referral-option-${clinic.id}`}>
                                  <div><span className="font-medium text-sm">{getDoctorFullName(clinic as any) || clinic.name}</span><span className="text-sm text-muted-foreground ml-2">{clinic.city || ""}</span></div>
                                  <Plus className="h-4 w-4 text-muted-foreground" />
                                </div>
                              ))}
                            </div>
                          )}
                          {doctorReferrals.length > 0 ? (
                            <div className="space-y-1.5">
                              {doctorReferrals.map((ref) => (
                                <div key={ref.clinicId} className="flex items-center justify-between px-3 py-1.5 border rounded-lg bg-purple-50/50 dark:bg-purple-950/30">
                                  <div className="flex items-center gap-2"><UserCheck className="h-3.5 w-3.5 text-purple-500" /><span className="text-sm font-medium">{ref.clinicName}</span></div>
                                  <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeReferral(ref.clinicId)} data-testid={`remove-referral-${ref.clinicId}`}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                                </div>
                              ))}
                            </div>
                          ) : (<p className="text-xs text-muted-foreground italic pl-1">{t.clinics.noReferrals}</p>)}
                        </div>
                      )}
                      <div className={cn("border rounded-lg px-3 py-2.5 transition-all cursor-pointer", formData.isFromConference ? cn("border-2 shadow-sm", LEAD_SOURCE_COLORS.conference) : "hover:bg-muted/50 border-border")}
                        onClick={() => setFormData({ ...formData, isFromConference: !formData.isFromConference })} >
                        <div className="flex items-center gap-3">
                          <div className={cn("flex items-center justify-center w-8 h-8 rounded-lg shrink-0", LEAD_SOURCE_ICON_BG.conference)}>
                            <GraduationCap className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0"><div className="font-medium text-sm">{t.clinics.leadSourceTypes?.conference || "Conference / Seminar"}</div></div>
                          <Checkbox checked={formData.isFromConference} onCheckedChange={(checked) => setFormData({ ...formData, isFromConference: !!checked })} data-testid="checkbox-conference" className="shrink-0" onClick={(e) => e.stopPropagation()} />
                        </div>
                      </div>
                      {formData.isFromConference && (
                        <div className="ml-3 pl-3 border-l-2 border-rose-200 dark:border-rose-800 space-y-2">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                              <Label className="text-xs">{t.clinics.conferenceName}</Label>
                              <Input value={formData.conferenceName} onChange={(e) => setFormData({ ...formData, conferenceName: e.target.value })} placeholder={t.clinics.conferenceName} className="h-9" data-testid="input-conference-name" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">{t.clinics.conferenceDate}</Label>
                              <DateTimePicker value={formData.conferenceDate} onChange={(v) => setFormData({ ...formData, conferenceDate: v })} countryCode={formData.countryCode || "SK"} includeTime={false} data-testid="input-conference-date" />
                            </div>
                          </div>
                          <Separator className="my-1" />
                          <Label className="text-xs">{t.clinics.referringDoctors}</Label>
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input value={confReferralSearch} onChange={(e) => setConfReferralSearch(e.target.value)} placeholder={t.clinics.selectDoctor} className="pl-9 h-9" data-testid="input-conf-referral-search" />
                          </div>
                          {confReferralSearch && filteredClinicsConf.length > 0 && (
                            <div className="border rounded-lg max-h-36 overflow-y-auto">
                              {filteredClinicsConf.slice(0, 10).map((clinic) => (
                                <div key={clinic.id} className="flex items-center justify-between p-2 hover:bg-muted/50 cursor-pointer" onClick={() => addReferral(clinic, "conference")} data-testid={`conf-referral-option-${clinic.id}`}>
                                  <div><span className="font-medium text-sm">{getDoctorFullName(clinic as any) || clinic.name}</span><span className="text-sm text-muted-foreground ml-2">{clinic.city || ""}</span></div>
                                  <Plus className="h-4 w-4 text-muted-foreground" />
                                </div>
                              ))}
                            </div>
                          )}
                          {conferenceReferrals.length > 0 ? (
                            <div className="space-y-1.5">
                              {conferenceReferrals.map((ref) => (
                                <div key={ref.clinicId} className="flex items-center justify-between px-3 py-1.5 border rounded-lg bg-rose-50/50 dark:bg-rose-950/30">
                                  <div className="flex items-center gap-2"><GraduationCap className="h-3.5 w-3.5 text-rose-500" /><span className="text-sm font-medium">{ref.clinicName}</span></div>
                                  <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeReferral(ref.clinicId)} data-testid={`remove-conf-referral-${ref.clinicId}`}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                                </div>
                              ))}
                            </div>
                          ) : (<p className="text-xs text-muted-foreground italic pl-1">{t.clinics.noReferrals}</p>)}
                        </div>
                      )}
                    </div>
                    {formData.leadSource && (
                      <>
                        <Separator />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-xs">{t.clinics.leadSourceDate}</Label>
                            <DateTimePicker value={formData.leadSourceDate} onChange={(v) => setFormData({ ...formData, leadSourceDate: v })} countryCode={formData.countryCode || "SK"} includeTime={false} data-testid="input-lead-source-date" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{t.clinics.leadSourceNotes}</Label>
                          <Textarea value={formData.leadSourceNotes} onChange={(e) => setFormData({ ...formData, leadSourceNotes: e.target.value })} placeholder={t.clinics.leadSourceNotes} rows={2} data-testid="input-lead-source-notes" />
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
                        <div className="p-1 rounded-md bg-blue-100 dark:bg-blue-900"><Building2 className="h-3 w-3 text-blue-600 dark:text-blue-400" /></div>
                        {t.clinics.sections?.clinic || 'Clinic'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-1">
                      <div className="space-y-1">
                        <Label className="text-[11px]">{t.clinics.name} *</Label>
                        <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder={t.clinics.name} className="h-8 text-sm" data-testid="input-clinic-name" />
                      </div>
                      <Separator className="my-1" />
                      <div className="grid gap-x-3 gap-y-2 grid-cols-3">
                        <div className="space-y-1">
                          <Label className="text-[11px]">{t.common.title || "Title"}</Label>
                          <Input value={formData.doctorTitle} onChange={(e) => setFormData({ ...formData, doctorTitle: e.target.value })} placeholder="MUDr." className="h-8 text-sm" data-testid="input-doctor-title" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">{t.clinics.sections?.firstName || "First name"}</Label>
                          <Input value={formData.doctorFirstName} onChange={(e) => setFormData({ ...formData, doctorFirstName: e.target.value })} placeholder={t.clinics.sections?.firstName || "First name"} className="h-8 text-sm" data-testid="input-doctor-firstname" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">{t.common.lastName || "Last name"}</Label>
                          <Input value={formData.doctorLastName} onChange={(e) => setFormData({ ...formData, doctorLastName: e.target.value })} placeholder={t.common.lastName || "Last name"} className="h-8 text-sm" data-testid="input-doctor-lastname" />
                        </div>
                      </div>
                      {initialData?.id && (formData.doctorFirstName || formData.doctorLastName) && (
                        <div className="pt-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => setSavePersonDialogOpen(true)}
                            data-testid="button-save-doctor-as-person-compact"
                          >
                            <UserPlus className="h-3 w-3" />
                            {(t.clinics.sections as any)?.saveAsPerson || "Uložiť ako osobu"}
                          </Button>
                        </div>
                      )}
                      <Separator className="my-1" />
                      <Collapsible open={identifiersOpen} onOpenChange={setIdentifiersOpen}>
                        <CollapsibleTrigger asChild>
                          <button type="button" className="flex w-full items-center justify-between rounded-md px-2 py-1.5 hover-elevate active-elevate-2 text-xs font-medium text-muted-foreground" data-testid="toggle-inline-clinic-identifiers">
                            <span className="flex items-center gap-1.5"><HelpCircle className="h-3 w-3" />{t.clinics.additionalIdentifiers}</span>
                            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", identifiersOpen && "rotate-180")} />
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="grid gap-x-3 gap-y-2 grid-cols-3 pt-2">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1">
                                <Label className="text-[11px]">{t.clinics.idZz}</Label>
                                <TooltipProvider><Tooltip><TooltipTrigger asChild><HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent className="max-w-xs"><p>{t.clinics.idZzTip}</p></TooltipContent></Tooltip></TooltipProvider>
                              </div>
                              <Input value={formData.idZz} onChange={(e) => setFormData({ ...formData, idZz: e.target.value })} placeholder={t.clinics.idZz} className="h-8 text-sm" data-testid="input-inline-clinic-idzz" />
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1">
                                <Label className="text-[11px]">{t.clinics.pzsCode}</Label>
                                <TooltipProvider><Tooltip><TooltipTrigger asChild><HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent className="max-w-xs"><p>{t.clinics.pzsCodeTip}</p></TooltipContent></Tooltip></TooltipProvider>
                              </div>
                              <Input value={formData.pzsCode} onChange={(e) => setFormData({ ...formData, pzsCode: e.target.value })} placeholder={t.clinics.pzsCode} className="h-8 text-sm" data-testid="input-inline-clinic-pzscode" />
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1">
                                <Label className="text-[11px]">{t.clinics.pzsName}</Label>
                                <TooltipProvider><Tooltip><TooltipTrigger asChild><HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent className="max-w-xs"><p>{t.clinics.pzsNameTip}</p></TooltipContent></Tooltip></TooltipProvider>
                              </div>
                              <Input value={formData.pzsName} onChange={(e) => setFormData({ ...formData, pzsName: e.target.value })} placeholder={t.clinics.pzsName} className="h-8 text-sm" data-testid="input-inline-clinic-pzsname" />
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                      <div className="flex items-center justify-between border rounded-md px-3 py-2 mt-1">
                        <div>
                          <Label className="text-xs">{t.clinics.isActive || "Aktívna ambulancia"}</Label>
                          <p className="text-[10px] text-muted-foreground">{t.clinics.isActiveDesc || "Ambulancia je aktívna a zobrazuje sa v zoznamoch"}</p>
                        </div>
                        <Switch checked={formData.isActive} onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })} data-testid="switch-inline-clinic-active" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
                        <div className="p-1 rounded-md bg-sky-100 dark:bg-sky-900"><Phone className="h-3 w-3 text-sky-600 dark:text-sky-400" /></div>
                        {t.clinics.sections?.contact || 'Contact'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-1">
                      <div className="grid gap-x-3 gap-y-2 grid-cols-2">
                        <div className="space-y-2">
                          <div className="space-y-1">
                            <Label className="text-[11px]">{t.clinics.phone}</Label>
                            <div className="flex items-center gap-1">
                              <div className="flex-1 min-w-0"><PhoneNumberField value={formData.phone} onChange={(v) => setFormData({ ...formData, phone: v })} defaultCountryCode={formData.countryCode || "SK"} data-testid="input-clinic-phone" /></div>
                              <CallSlot phoneNumber={formData.phone} customerId={initialData?.id} customerName={doctorFullName || formData.name || initialData?.name} />
                            </div>
                          </div>
                          {(formData.phone2 || formData.email2 || formData.phone3 || formData.email3 || showExtraContacts) && (
                            <>
                              <div className="space-y-1">
                                <Label className="text-[11px]">{t.clinics.phone} 2</Label>
                                <div className="flex items-center gap-1">
                                  <div className="flex-1 min-w-0"><PhoneNumberField value={formData.phone2} onChange={(v) => setFormData({ ...formData, phone2: v })} defaultCountryCode={formData.countryCode || "SK"} data-testid="input-clinic-phone2" /></div>
                                  <CallSlot phoneNumber={formData.phone2} customerId={initialData?.id} customerName={doctorFullName || formData.name || initialData?.name} />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px]">{t.clinics.phone} 3</Label>
                                <div className="flex items-center gap-1">
                                  <div className="flex-1 min-w-0"><PhoneNumberField value={formData.phone3} onChange={(v) => setFormData({ ...formData, phone3: v })} defaultCountryCode={formData.countryCode || "SK"} data-testid="input-clinic-phone3" /></div>
                                  <CallSlot phoneNumber={formData.phone3} customerId={initialData?.id} customerName={doctorFullName || formData.name || initialData?.name} />
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="space-y-1">
                            <Label className="text-[11px]">{t.clinics.email}</Label>
                            <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder={t.clinics.email} className="h-8 text-sm" data-testid="input-clinic-email" />
                          </div>
                          {(formData.phone2 || formData.email2 || formData.phone3 || formData.email3 || showExtraContacts) && (
                            <>
                              <div className="space-y-1">
                                <Label className="text-[11px]">{t.clinics.email} 2</Label>
                                <Input type="email" value={formData.email2} onChange={(e) => setFormData({ ...formData, email2: e.target.value })} placeholder={`${t.clinics.email} 2`} className="h-8 text-sm" data-testid="input-clinic-email2" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px]">{t.clinics.email} 3</Label>
                                <Input type="email" value={formData.email3} onChange={(e) => setFormData({ ...formData, email3: e.target.value })} placeholder={`${t.clinics.email} 3`} className="h-8 text-sm" data-testid="input-clinic-email3" />
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      {!(formData.phone2 || formData.email2 || formData.phone3 || formData.email3 || showExtraContacts) && (
                        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowExtraContacts(true)} data-testid="button-show-extra-contacts">
                          <Plus className="h-3 w-3 mr-1" />
                          {(t.clinics.sections as any)?.addMoreContacts || "Pridať ďalší telefón / email"}
                        </Button>
                      )}
                      <div className="space-y-1">
                        <Label className="text-[11px]">{t.clinics.website}</Label>
                        <div className="flex gap-2">
                          <Input value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} placeholder="www.example.com" className="flex-1 h-8 text-sm" data-testid="input-clinic-website" />
                          {formData.website && (
                            <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => window.open(getWebsiteUrl(formData.website), "_blank")} data-testid="button-open-website">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
                        <div className="p-1 rounded-md bg-green-100 dark:bg-green-900"><MapPin className="h-3 w-3 text-green-600 dark:text-green-400" /></div>
                        {t.clinics.steps?.address || "Address"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-1">
                      <div className="grid gap-x-3 gap-y-2 grid-cols-1 sm:grid-cols-3">
                        <div className="space-y-1 sm:col-span-3">
                          <Label className="text-[11px]">{t.clinics.street}</Label>
                          <Input value={formData.street} onChange={(e) => setFormData({ ...formData, street: e.target.value })} placeholder={t.clinics.street} className="h-8 text-sm" data-testid="input-inline-clinic-street" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">{t.clinics.streetNumber}</Label>
                          <Input value={formData.streetNumber} onChange={(e) => setFormData({ ...formData, streetNumber: e.target.value })} placeholder="123" className="h-8 text-sm" data-testid="input-inline-clinic-street-number" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">{t.clinics.orientationNumber}</Label>
                          <Input value={formData.orientationNumber} onChange={(e) => setFormData({ ...formData, orientationNumber: e.target.value })} placeholder="4A" className="h-8 text-sm" data-testid="input-inline-clinic-orientation-number" />
                        </div>
                      </div>
                      <div className="grid gap-x-3 gap-y-2 grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-[11px]">{t.clinics.city}</Label>
                          <Input value={formData.city} onChange={(e) => { const newCity = e.target.value; const newRegion = getAutoRegion(formData.countryCode, newCity); const newDistrict = getAutoDistrict(formData.countryCode, newCity); setFormData({ ...formData, city: newCity, region: newRegion || formData.region, district: newDistrict || formData.district }); }} placeholder={t.clinics.city} className="h-8 text-sm" data-testid="input-clinic-city" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">{t.clinics.postalCode}</Label>
                          <div className="flex items-center gap-1">
                            <Input value={formData.postalCode} onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })} placeholder={t.clinics.postalCode} className="h-8 text-sm flex-1" data-testid="input-clinic-postal" />
                            <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={lookupPostalCode} disabled={postalLookupLoading || !formData.city} title={t.clinics.lookupPsc} data-testid="button-inline-lookup-psc">
                              {postalLookupLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <Label className="text-[11px]">{t.clinics.ico}</Label>
                          <TooltipProvider><Tooltip><TooltipTrigger asChild><HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent className="max-w-xs"><p>{t.clinics.icoTip}</p></TooltipContent></Tooltip></TooltipProvider>
                        </div>
                        <Input value={formData.ico} onChange={(e) => setFormData({ ...formData, ico: e.target.value })} placeholder={t.clinics.ico} className="h-8 text-sm" data-testid="input-inline-clinic-ico" />
                      </div>
                      <div className="grid gap-x-3 gap-y-2 grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-[11px]">{t.clinics.latitude || "Lat"}</Label>
                          <Input value={formData.latitude} onChange={(e) => setFormData({ ...formData, latitude: e.target.value })} placeholder="48.1486" className="h-8 text-sm" data-testid="input-clinic-lat" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">{t.clinics.longitude || "Lng"}</Label>
                          <Input value={formData.longitude} onChange={(e) => setFormData({ ...formData, longitude: e.target.value })} placeholder="17.1077" className="h-8 text-sm" data-testid="input-clinic-lng" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={handleGetCurrentLocation} disabled={isLoadingLocation} data-testid="button-get-gps">
                          {isLoadingLocation ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Navigation className="h-3 w-3 mr-1" />}
                          GPS
                        </Button>
                        {formData.latitude && formData.longitude && (
                          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowMapDialog(true)} data-testid="button-show-map">
                            <MapPin className="h-3 w-3 mr-1" />
                            {t.clinics.showOnMap || "Mapa"}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
                        <div className="p-1 rounded-md bg-emerald-100 dark:bg-emerald-900"><PhoneCall className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /></div>
                        {(t.clinics as any).callsAndContract || "Calls & Contract"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-1">
                      <div className="grid gap-x-3 gap-y-2 grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-[11px]">{(t.clinics as any).lastCallResult || "Last call result"}</Label>
                          <Input value={formData.lastCallResult} onChange={(e) => setFormData({ ...formData, lastCallResult: e.target.value })} placeholder={(t.clinics as any).lastCallResult || "Last call result"} className="h-8 text-sm" data-testid="input-last-call-result" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">{t.clinics.sections?.additionalContact || "Additional contact"}</Label>
                          <DateTimePicker value={formData.nextContactDate} onChange={(v) => setFormData({ ...formData, nextContactDate: v })} countryCode={formData.countryCode || "SK"} includeTime={false} data-testid="input-next-contact-date" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">{(t.clinics as any).note || (t as any).note || "Note"}</Label>
                        <Textarea value={formData.lastCallNote} onChange={(e) => setFormData({ ...formData, lastCallNote: e.target.value })} placeholder={(t.clinics as any).lastCallResult || "Call note"} rows={2} className="text-sm" data-testid="input-last-call-note" />
                      </div>
                      <Separator className="my-1" />
                      <div className="grid gap-x-3 gap-y-2 grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-[11px]">{(t.clinics as any).contractSent || "Contract sent"}</Label>
                          <DateTimePicker value={formData.contractSentDate} onChange={(v) => setFormData({ ...formData, contractSentDate: v })} countryCode={formData.countryCode || "SK"} includeTime={false} data-testid="input-contract-sent-date" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">{(t.clinics as any).contractReturned || "Contract returned"}</Label>
                          <DateTimePicker value={formData.contractReturnedDate} onChange={(v) => setFormData({ ...formData, contractReturnedDate: v })} countryCode={formData.countryCode || "SK"} includeTime={false} data-testid="input-contract-returned-date" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="lg:col-span-2">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
                        <div className="p-1 rounded-md bg-gray-100 dark:bg-gray-800"><FileText className="h-3 w-3 text-gray-600 dark:text-gray-400" /></div>
                        {t.clinics.notes}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-1">
                      <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder={t.clinics.notes} rows={3} className="text-sm" data-testid="input-clinic-notes" />
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}
          {referrals.length > 0 && (
            <div className="mx-6 mb-2 space-y-1.5" data-testid="referrals-summary">
              {doctorReferrals.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-purple-600 dark:text-purple-400">
                    <UserCheck className="h-3.5 w-3.5" />
                    <span>{t.clinics.leadSourceTypes?.doctor_referral || "Doctor referral"}:</span>
                  </div>
                  {doctorReferrals.map((ref) => (
                    <Badge key={ref.clinicId} variant="secondary" className="text-xs py-0.5 px-2 bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800">
                      {ref.clinicName}
                    </Badge>
                  ))}
                </div>
              )}
              {conferenceReferrals.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                    <GraduationCap className="h-3.5 w-3.5" />
                    <span>{t.clinics.leadSourceTypes?.conference || "Conference"}:</span>
                  </div>
                  {conferenceReferrals.map((ref) => (
                    <Badge key={ref.clinicId} variant="secondary" className="text-xs py-0.5 px-2 bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800">
                      {ref.clinicName}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="sticky bottom-0 bg-background border-t px-6 py-3 flex justify-between">
            {mode !== "inline" && (
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-clinic">
                {t.common.cancel}
              </Button>
            )}
            <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-clinic" className={mode === "inline" ? "ml-auto" : ""}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {t.common.save}
            </Button>
          </div>
    </>
  );

  const mapDialog = (
    <>
      <Dialog open={showMapDialog} onOpenChange={setShowMapDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t.clinics.showOnMap || "Show on map"}</DialogTitle>
          </DialogHeader>
          <div className="h-96 rounded-lg overflow-hidden">
            <iframe
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(formData.longitude) - 0.01},${Number(formData.latitude) - 0.01},${Number(formData.longitude) + 0.01},${Number(formData.latitude) + 0.01}&layer=mapnik&marker=${formData.latitude},${formData.longitude}`}
              className="w-full h-full border-0"
              title="Map"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => window.open(`https://www.google.com/maps?q=${formData.latitude},${formData.longitude}`, "_blank")}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Google Maps
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={emailComposeOpen} onOpenChange={(o) => {
        if (!o) {
          setEmailComposeOpen(false);
          setSelectedEmails([]);
          setEmailSubject("");
          setEmailMessage("");
          setEmailCc("");
          setShowCcField(false);
          setEmailAttachment(null);
        }
      }}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{(t.customers as any)?.details?.sendEmail || "Send email"}</DialogTitle>
          </DialogHeader>
          <div className="flex gap-6">
            <div className="w-2/5 space-y-4 border-r pr-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {(t.customers as any)?.details?.fromAccount || "From account"}
                </Label>
                <Select value={selectedFromAccount} onValueChange={setSelectedFromAccount}>
                  <SelectTrigger data-testid="select-from-account-clinic" className="text-sm">
                    <SelectValue placeholder={(t.customers as any)?.details?.selectAccount || "Select account"} />
                  </SelectTrigger>
                  <SelectContent>
                    {allEmailAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        <div className="flex items-center gap-2">
                          <span>{account.displayName}</span>
                          {account.type === "personal" && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              {(t.customers as any)?.details?.personalAccount || "Personal"}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {(t.configuration as any)?.templateCategory || "Template category"}
                </Label>
                <Select
                  value={selectedTemplateCategory}
                  onValueChange={(v) => setSelectedTemplateCategory(v)}
                  disabled={emailTemplates.length === 0}
                >
                  <SelectTrigger data-testid="select-template-category-clinic" className="text-sm">
                    <SelectValue placeholder={(t.configuration as any)?.selectCategory || "Select category"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">
                      {(t.common as any)?.all || "All"}
                    </SelectItem>
                    {visibleCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                    {hasUncategorized && (
                      <SelectItem value="__uncategorized__">
                        {(t.configuration as any)?.uncategorized || "Uncategorized"}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {(t.configuration as any)?.messageTemplates || "Template"}
                </Label>
                <Select
                  onValueChange={(templateId) => {
                    const template = visibleEmailTemplates.find((tpl) => tpl.id === templateId);
                    if (template) {
                      setEmailSubject(template.subject || "");
                      setEmailMessage(template.contentHtml || template.content || "");
                      fetch(`/api/message-templates/${templateId}/use`, { method: "POST", credentials: "include" });
                    }
                  }}
                  disabled={visibleEmailTemplates.length === 0}
                >
                  <SelectTrigger data-testid="select-email-template-clinic" className="text-sm">
                    <SelectValue placeholder={visibleEmailTemplates.length === 0
                      ? ((t.konfigurator as any)?.noMessageTemplates || "No templates")
                      : ((t.configuration as any)?.selectTemplate || "Select template")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {visibleEmailTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {(t.customers as any)?.details?.to || "To"}
                </Label>
                <div className="space-y-2">
                  {initialData?.email && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="clinic-email1"
                        checked={selectedEmails.includes(initialData.email)}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedEmails([...selectedEmails, initialData.email!]);
                          else setSelectedEmails(selectedEmails.filter((e) => e !== initialData.email));
                        }}
                        data-testid="checkbox-clinic-email-primary"
                      />
                      <Label htmlFor="clinic-email1" className="font-normal cursor-pointer text-sm truncate">
                        {initialData.email}
                      </Label>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {(t.customers as any)?.details?.cc || "CC"}
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCcField(!showCcField)}
                    className="h-5 px-1 text-xs"
                    data-testid="button-toggle-cc-clinic"
                  >
                    {showCcField ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </Button>
                </div>
                {showCcField && (
                  <Input
                    value={emailCc}
                    onChange={(e) => setEmailCc(e.target.value)}
                    placeholder={(t.customers as any)?.details?.ccPlaceholder || "email@example.com"}
                    className="text-sm"
                    data-testid="input-email-cc-clinic"
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {(t.customers as any)?.details?.attachment || "Attachment"}
                </Label>
                {!emailAttachment ? (
                  <label
                    htmlFor="clinic-email-attachment-input"
                    className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors"
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const file = e.dataTransfer.files?.[0];
                      if (file) setEmailAttachment(file);
                    }}
                    data-testid="dropzone-clinic-email-attachment"
                  >
                    <div className="flex flex-col items-center justify-center pt-2 pb-2">
                      <Upload className="w-6 h-6 mb-1 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground text-center">
                        <span className="font-medium text-primary">{(t.common as any)?.clickToUpload || "Click to upload"}</span>
                        {" "}{(t.common as any)?.orDragDrop || "or drag and drop"}
                      </p>
                    </div>
                    <input
                      id="clinic-email-attachment-input"
                      type="file"
                      className="hidden"
                      onChange={(e) => setEmailAttachment(e.target.files?.[0] || null)}
                      data-testid="input-clinic-email-attachment"
                    />
                  </label>
                ) : (
                  <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30">
                    <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{emailAttachment.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(emailAttachment.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 flex-shrink-0"
                      onClick={() => setEmailAttachment(null)}
                      data-testid="button-remove-clinic-attachment"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <div className="w-3/5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clinic-email-subject">{(t.customers as any)?.details?.subject || "Subject"}</Label>
                <Input
                  id="clinic-email-subject"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder={(t.customers as any)?.details?.emailSubjectPlaceholder || "Subject"}
                  data-testid="input-clinic-email-subject"
                />
              </div>
              <div className="space-y-2">
                <Label>{(t.customers as any)?.details?.message || "Message"}</Label>
                <div className="border rounded-md" data-testid="wysiwyg-clinic-email-message">
                  <ReactQuill
                    theme="snow"
                    value={emailMessage}
                    onChange={setEmailMessage}
                    placeholder={(t.customers as any)?.details?.writeEmailPlaceholder || "Write your email..."}
                    modules={{
                      toolbar: [
                        [{ 'header': [1, 2, 3, false] }],
                        ['bold', 'italic', 'underline', 'strike'],
                        [{ 'color': [] }, { 'background': [] }],
                        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                        ['link'],
                        ['clean'],
                      ],
                    }}
                    style={{ minHeight: '350px' }}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEmailComposeOpen(false);
                    setSelectedEmails([]);
                    setEmailSubject("");
                    setEmailMessage("");
                    setEmailCc("");
                    setShowCcField(false);
                    setEmailAttachment(null);
                  }}
                  data-testid="button-cancel-clinic-email"
                >
                  {t.common.cancel}
                </Button>
                <Button
                  onClick={async () => {
                    if (selectedEmails.length === 0 || !emailSubject || !emailMessage) {
                      toast({
                        title: t.common.error,
                        description: (t.customers as any)?.details?.fillAllFields || "Please fill in all fields",
                        variant: "destructive",
                      });
                      return;
                    }
                    setIsSendingEmail(true);
                    try {
                      let pcAttachments: Array<{ name: string; contentType: string; contentBase64: string }> = [];
                      if (emailAttachment) {
                        const fileBuffer = await emailAttachment.arrayBuffer();
                        const base64 = btoa(
                          new Uint8Array(fileBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
                        );
                        pcAttachments.push({
                          name: emailAttachment.name,
                          contentType: emailAttachment.type || 'application/octet-stream',
                          contentBase64: base64,
                        });
                      }
                      await apiRequest("POST", "/api/ms365/send-email-from-mailbox", {
                        to: selectedEmails,
                        subject: emailSubject,
                        body: emailMessage,
                        isHtml: true,
                        mailboxId: selectedFromAccount === "personal" ? null : selectedFromAccount || null,
                        cc: emailCc.trim() || undefined,
                        attachments: pcAttachments.length > 0 ? pcAttachments : undefined,
                      });
                      toast({
                        title: (t.customers as any)?.details?.emailSentSuccess || "Email sent",
                        description: (t.customers as any)?.details?.emailSentSuccessDesc || "Email was sent successfully",
                      });
                      setEmailComposeOpen(false);
                      setSelectedEmails([]);
                      setEmailSubject("");
                      setEmailMessage("");
                      setEmailCc("");
                      setShowCcField(false);
                      setEmailAttachment(null);
                    } catch (error) {
                      toast({
                        title: t.common.error,
                        description: (t.customers as any)?.details?.emailSendFailed || "Failed to send email",
                        variant: "destructive",
                      });
                    } finally {
                      setIsSendingEmail(false);
                    }
                  }}
                  disabled={selectedEmails.length === 0 || !emailSubject || !emailMessage || isSendingEmail}
                  data-testid="button-send-clinic-email"
                >
                  {isSendingEmail ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  {(t.customers as any)?.details?.sendEmail || "Send email"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );

  const editorBody = (
    <>
      <div className="shrink-0 mx-5 my-2 px-2 py-2.5 rounded-lg bg-muted/40 border" data-testid="clinic-status-bar-drawer">
        <ProgressBar />
        {currentPipelineOption && (
          <div className="flex items-center justify-center mt-1.5">
            <div className={cn(
              "inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-semibold border",
              currentPipelineOption.sentiment === "positive" ? "bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200 dark:border-green-700"
                : currentPipelineOption.sentiment === "negative" ? "bg-red-100 text-red-700 border-red-300 dark:bg-red-900 dark:text-red-200 dark:border-red-700"
                  : "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600"
            )}>
              {currentPipelineCategory && <span className="opacity-70">{(t.clinics as any).pipeline?.[currentPipelineCategory.labelKey] || currentPipelineCategory.labelKey}:</span>}
              <span>{(t.clinics as any).pipeline?.[currentPipelineOption.labelKey] || currentPipelineOption.labelKey}</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="w-44 border-r bg-muted/20 flex flex-col py-3 shrink-0 overflow-y-auto">
          {clinicEditTabs.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-2.5 px-4 py-2 mx-2 rounded-md text-sm transition-colors text-left",
                  isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
                data-testid={`tab-clinic-${tab.key}-drawer`}
              >
                <TabIcon className="h-4 w-4 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === "referral" && (
            <div className="space-y-4 pb-4">
              {false && <div className="space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex items-center justify-center w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-900">
                    <CircleDot className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-sm font-semibold tracking-wide">{t.clinics.leadSource}</h3>
                </div>
                <div className="grid gap-1.5">
                  {MAIN_SOURCE_TYPES.map((type) => {
                    const Icon = LEAD_SOURCE_ICONS[type];
                    const selected = formData.leadSource === type;
                    const isExpanded = selected && pipelineMenuOpen;
                    return (
                      <div key={type}>
                        <button type="button" className={cn("flex items-center gap-3 px-3 py-2.5 border rounded-lg cursor-pointer transition-all w-full text-left", selected ? cn("border-2 shadow-sm", LEAD_SOURCE_COLORS[type]) : formData.leadSource ? "opacity-40 border-border hover:opacity-70" : "hover:bg-muted/50 border-border", isExpanded && "rounded-b-none")}
                          onClick={() => { if (selected) { setPipelineMenuOpen(!pipelineMenuOpen); setExpandedCategory(null); } else { setFormData(prev => ({ ...prev, leadSource: type })); setPipelineMenuOpen(true); setExpandedCategory(null); } }} data-testid={`source-card-${type}`}>
                          <div className={cn("flex items-center justify-center w-8 h-8 rounded-lg shrink-0", LEAD_SOURCE_ICON_BG[type])}><Icon className="h-4 w-4" /></div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{t.clinics.leadSourceTypes?.[type] || type}</div>
                            {selected && currentPipelineOption && !isExpanded && (
                              <div className={cn("text-xs mt-0.5 font-medium", currentPipelineOption.color)}>
                                {(t.clinics as any).pipeline?.[currentPipelineCategory?.labelKey] || currentPipelineCategory?.labelKey}: {(t.clinics as any).pipeline?.[currentPipelineOption.labelKey] || currentPipelineOption.labelKey}
                              </div>
                            )}
                          </div>
                          {selected && (<div className="flex items-center gap-1.5 shrink-0"><CheckCircle2 className="h-4 w-4 text-primary" /><ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isExpanded && "rotate-180")} /></div>)}
                        </button>
                        {isExpanded && (
                          <div className="border border-t-0 rounded-b-lg bg-muted/20 dark:bg-muted/10 overflow-hidden" data-testid="pipeline-submenu">
                            {PIPELINE_CATEGORIES.map((cat) => {
                              const CatIcon = cat.icon;
                              const isCatExpanded = expandedCategory === cat.key;
                              const selectedInCat = cat.options.find(o => o.value === currentPipelineValue);
                              return (
                                <div key={cat.key}>
                                  <button type="button" className={cn("flex items-center gap-2.5 w-full px-4 py-2.5 text-left transition-all hover:bg-muted/50", isCatExpanded && "bg-muted/40", selectedInCat && "bg-primary/5")}
                                    onClick={() => setExpandedCategory(isCatExpanded ? null : cat.key)} data-testid={`pipeline-cat-${cat.key}`}>
                                    <CatIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <span className="text-sm font-medium flex-1">{(t.clinics as any).pipeline?.[cat.labelKey] || cat.labelKey}</span>
                                    {selectedInCat && (
                                      <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border",
                                        selectedInCat.sentiment === "positive" ? "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700"
                                          : selectedInCat.sentiment === "negative" ? "bg-red-100 text-red-600 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700"
                                            : "bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600"
                                      )}>{(t.clinics as any).pipeline?.[selectedInCat.labelKey] || selectedInCat.labelKey}</span>
                                    )}
                                    <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0", isCatExpanded && "rotate-90")} />
                                  </button>
                                  {isCatExpanded && (
                                    <div className="px-4 pb-2 pt-1 space-y-1">
                                      {cat.options.map((opt) => {
                                        const OptIcon = opt.icon;
                                        const isSelected = currentPipelineValue === opt.value;
                                        return (
                                          <button key={opt.value} type="button" className={cn("flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-left transition-all",
                                            isSelected ? opt.sentiment === "positive" ? "bg-green-100 border border-green-300 text-green-800 dark:bg-green-900/40 dark:border-green-700 dark:text-green-200"
                                              : opt.sentiment === "negative" ? "bg-red-100 border border-red-300 text-red-700 dark:bg-red-900/40 dark:border-red-700 dark:text-red-200"
                                                : "bg-primary/10 border border-primary/30 text-foreground" : "hover:bg-muted/60 border border-transparent"
                                          )} onClick={() => selectPipelineOption(opt.value)} data-testid={`pipeline-opt-${opt.value}`}>
                                            <OptIcon className={cn("h-4 w-4 shrink-0", opt.color)} />
                                            <span className="text-sm font-medium flex-1">{(t.clinics as any).pipeline?.[opt.labelKey] || opt.labelKey}</span>
                                            {isSelected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {formData.leadSource && (
                  <Button type="button" variant="ghost" size="sm" className="text-muted-foreground text-xs" onClick={() => {
                    setFormData(prev => ({ ...prev, leadSource: "", initialStatus: "", interestCooperation: "", interestContract: "", contractStatus: "" }));
                    setPipelineMenuOpen(false); setExpandedCategory(null);
                  }} data-testid="button-clear-source"><X className="h-3 w-3 mr-1" /> {(t.clinics as any).pipeline?.clearSelection || t.common.clear || "Clear"}</Button>
                )}
              </div>}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex items-center justify-center w-6 h-6 rounded-md bg-purple-100 dark:bg-purple-900"><UserCheck className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" /></div>
                  <h3 className="text-sm font-semibold tracking-wide">{(t.clinics as any).pipeline?.referralAndConference || "Referral & Conference"}</h3>
                </div>
                <div className={cn("border rounded-lg px-3 py-2.5 transition-all cursor-pointer", formData.isReferredByDoctor ? cn("border-2 shadow-sm", LEAD_SOURCE_COLORS.doctor_referral) : "hover:bg-muted/50 border-border")}
                  onClick={() => setFormData({ ...formData, isReferredByDoctor: !formData.isReferredByDoctor })}>
                  <div className="flex items-center gap-3">
                    <div className={cn("flex items-center justify-center w-8 h-8 rounded-lg shrink-0", LEAD_SOURCE_ICON_BG.doctor_referral)}><UserCheck className="h-4 w-4" /></div>
                    <div className="flex-1 min-w-0"><div className="font-medium text-sm">{t.clinics.leadSourceTypes?.doctor_referral || "Doctor referral"}</div></div>
                    <Checkbox checked={formData.isReferredByDoctor} onCheckedChange={(checked) => setFormData({ ...formData, isReferredByDoctor: !!checked })} data-testid="checkbox-doctor-referral" className="shrink-0" onClick={(e) => e.stopPropagation()} />
                  </div>
                </div>
                {formData.isReferredByDoctor && (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/30 dark:bg-purple-950/20 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                          {(t.clinics as any).hasBeenRecommendedBy || "The potential Medical Partner has been recommended by following medical partners:"}
                        </span>
                      </div>
                      {doctorReferrals.length > 0 && (
                        <div className="space-y-1.5 ml-6">
                          {doctorReferrals.map((ref) => (
                            <div key={ref.clinicId} className="flex items-center justify-between px-3 py-1.5 border rounded-lg bg-white dark:bg-background">
                              <div className="flex items-center gap-2"><UserCheck className="h-3.5 w-3.5 text-purple-500" /><span className="text-sm font-medium">{ref.clinicName}</span></div>
                              <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeReferral(ref.clinicId)} data-testid={`remove-referral-${ref.clinicId}`}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="ml-6">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input value={referralSearch} onChange={(e) => setReferralSearch(e.target.value)} placeholder={t.clinics.selectDoctor} className="pl-9 h-9" data-testid="input-referral-search" />
                        </div>
                        {referralSearch && filteredClinics.length > 0 && (
                          <div className="border rounded-lg max-h-36 overflow-y-auto mt-1">
                            {filteredClinics.slice(0, 10).map((clinic) => (
                              <div key={clinic.id} className="flex items-center justify-between p-2 hover:bg-muted/50 cursor-pointer" onClick={() => addReferral(clinic, "doctor_referral")} data-testid={`referral-option-${clinic.id}`}>
                                <div><span className="font-medium text-sm">{getDoctorFullName(clinic as any) || clinic.name}</span><span className="text-sm text-muted-foreground ml-2">{clinic.city || ""}</span></div>
                                <Plus className="h-4 w-4 text-muted-foreground" />
                              </div>
                            ))}
                          </div>
                        )}
                        {referralSearch && filteredClinics.length === 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-muted-foreground mb-2">{(t.clinics as any).doctorNotInDatabase || "Doctor not found in database? Add new:"}</p>
                            <Button type="button" variant="outline" size="sm" className="text-xs gap-1" onClick={() => setNestedClinicForm({ direction: "recommendedBy", prefillName: referralSearch })} data-testid="button-add-new-doctor-recommended">
                              <UserPlus className="h-3.5 w-3.5" /> {(t.clinics as any).addNewDoctor || "Add new doctor"}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <ArrowRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                          {(t.clinics as any).hasSuggestedPartners || "The Medical Partner has suggested following potential medical partners:"}
                        </span>
                      </div>
                      {suggestsReferrals.length > 0 && (
                        <div className="space-y-1.5 ml-6">
                          {suggestsReferrals.map((ref) => (
                            <div key={ref.clinicId} className="flex items-center justify-between px-3 py-1.5 border rounded-lg bg-white dark:bg-background">
                              <div className="flex items-center gap-2"><ArrowRight className="h-3.5 w-3.5 text-emerald-500" /><span className="text-sm font-medium">{ref.clinicName}</span></div>
                              <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeSuggestsReferral(ref.clinicId)} data-testid={`remove-suggests-${ref.clinicId}`}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="ml-6">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input value={suggestsSearch} onChange={(e) => setSuggestsSearch(e.target.value)} placeholder={t.clinics.selectDoctor} className="pl-9 h-9" data-testid="input-suggests-search" />
                        </div>
                        {suggestsSearch && filteredClinicsSuggests.length > 0 && (
                          <div className="border rounded-lg max-h-36 overflow-y-auto mt-1">
                            {filteredClinicsSuggests.slice(0, 10).map((clinic) => (
                              <div key={clinic.id} className="flex items-center justify-between p-2 hover:bg-muted/50 cursor-pointer" onClick={() => addSuggestsReferral(clinic)} data-testid={`suggests-option-${clinic.id}`}>
                                <div><span className="font-medium text-sm">{getDoctorFullName(clinic as any) || clinic.name}</span><span className="text-sm text-muted-foreground ml-2">{clinic.city || ""}</span></div>
                                <Plus className="h-4 w-4 text-muted-foreground" />
                              </div>
                            ))}
                          </div>
                        )}
                        {suggestsSearch && filteredClinicsSuggests.length === 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-muted-foreground mb-2">{(t.clinics as any).doctorNotInDatabase || "Doctor not found in database? Add new:"}</p>
                            <Button type="button" variant="outline" size="sm" className="text-xs gap-1" onClick={() => setNestedClinicForm({ direction: "suggests", prefillName: suggestsSearch })} data-testid="button-add-new-doctor-suggests">
                              <UserPlus className="h-3.5 w-3.5" /> {(t.clinics as any).addNewDoctor || "Add new doctor"}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                <div className={cn("border rounded-lg px-3 py-2.5 transition-all cursor-pointer", formData.isFromConference ? cn("border-2 shadow-sm", LEAD_SOURCE_COLORS.conference) : "hover:bg-muted/50 border-border")}
                  onClick={() => setFormData({ ...formData, isFromConference: !formData.isFromConference })}>
                  <div className="flex items-center gap-3">
                    <div className={cn("flex items-center justify-center w-8 h-8 rounded-lg shrink-0", LEAD_SOURCE_ICON_BG.conference)}><GraduationCap className="h-4 w-4" /></div>
                    <div className="flex-1 min-w-0"><div className="font-medium text-sm">{t.clinics.leadSourceTypes?.conference || "Conference / Seminar"}</div></div>
                    <Checkbox checked={formData.isFromConference} onCheckedChange={(checked) => setFormData({ ...formData, isFromConference: !!checked })} data-testid="checkbox-conference" className="shrink-0" onClick={(e) => e.stopPropagation()} />
                  </div>
                </div>
                {formData.isFromConference && (
                  <div className="ml-3 pl-3 border-l-2 border-rose-200 dark:border-rose-800 space-y-2">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1"><Label className="text-xs">{t.clinics.conferenceName}</Label><Input value={formData.conferenceName} onChange={(e) => setFormData({ ...formData, conferenceName: e.target.value })} placeholder={t.clinics.conferenceName} className="h-9" data-testid="input-conference-name" /></div>
                      <div className="space-y-1"><Label className="text-xs">{t.clinics.conferenceDate}</Label><DateTimePicker value={formData.conferenceDate} onChange={(v) => setFormData({ ...formData, conferenceDate: v })} countryCode={formData.countryCode || "SK"} includeTime={false} data-testid="input-conference-date" /></div>
                    </div>
                    <Separator className="my-1" />
                    <Label className="text-xs">{t.clinics.referringDoctors}</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input value={confReferralSearch} onChange={(e) => setConfReferralSearch(e.target.value)} placeholder={t.clinics.selectDoctor} className="pl-9 h-9" data-testid="input-conf-referral-search" />
                    </div>
                    {confReferralSearch && filteredClinicsConf.length > 0 && (
                      <div className="border rounded-lg max-h-36 overflow-y-auto">
                        {filteredClinicsConf.slice(0, 10).map((clinic) => (
                          <div key={clinic.id} className="flex items-center justify-between p-2 hover:bg-muted/50 cursor-pointer" onClick={() => addReferral(clinic, "conference")} data-testid={`conf-referral-option-${clinic.id}`}>
                            <div><span className="font-medium text-sm">{getDoctorFullName(clinic as any) || clinic.name}</span><span className="text-sm text-muted-foreground ml-2">{clinic.city || ""}</span></div>
                            <Plus className="h-4 w-4 text-muted-foreground" />
                          </div>
                        ))}
                      </div>
                    )}
                    {conferenceReferrals.length > 0 ? (
                      <div className="space-y-1.5">
                        {conferenceReferrals.map((ref) => (
                          <div key={ref.clinicId} className="flex items-center justify-between px-3 py-1.5 border rounded-lg bg-rose-50/50 dark:bg-rose-950/30">
                            <div className="flex items-center gap-2"><GraduationCap className="h-3.5 w-3.5 text-rose-500" /><span className="text-sm font-medium">{ref.clinicName}</span></div>
                            <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeReferral(ref.clinicId)} data-testid={`remove-conf-referral-${ref.clinicId}`}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                          </div>
                        ))}
                      </div>
                    ) : (<p className="text-xs text-muted-foreground italic pl-1">{t.clinics.noReferrals}</p>)}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "basic" && (
            <div className="space-y-5 pb-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2"><div className="flex items-center justify-center w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-900"><Building2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /></div><h3 className="text-sm font-semibold tracking-wide">{t.clinics.sections?.clinic || 'Klinika'}</h3></div>
                <div className="grid gap-3 sm:grid-cols-2 pl-1">
                  <div className="space-y-1"><Label className="text-xs">{t.clinics.name} *</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder={t.clinics.name} className="h-9" data-testid="input-clinic-name" /></div>
                  <div className="space-y-1"><Label className="text-xs">{t.common.country} *</Label>
                    <Select value={formData.countryCode} onValueChange={(value) => setFormData({ ...formData, countryCode: value })}>
                      <SelectTrigger data-testid="select-clinic-country" className="h-9"><SelectValue placeholder={t.common.country} /></SelectTrigger>
                      <SelectContent>{COUNTRIES.map((country) => (<SelectItem key={country.code} value={country.code}>{getCountryFlag(country.code)} {country.name}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                </div>
                <Collapsible open={identifiersOpen} onOpenChange={setIdentifiersOpen} className="pl-1">
                  <CollapsibleTrigger asChild>
                    <button type="button" className="flex w-full items-center justify-between rounded-md px-2 py-2 hover-elevate active-elevate-2 text-xs font-medium text-muted-foreground" data-testid="toggle-edit-clinic-identifiers">
                      <span className="flex items-center gap-2"><HelpCircle className="h-3.5 w-3.5" />{t.clinics.additionalIdentifiers}</span>
                      <ChevronDown className={cn("h-4 w-4 transition-transform", identifiersOpen && "rotate-180")} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="grid gap-3 sm:grid-cols-3 pt-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <Label className="text-xs">{t.clinics.idZz}</Label>
                          <TooltipProvider><Tooltip><TooltipTrigger asChild><HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent className="max-w-xs"><p>{t.clinics.idZzTip}</p></TooltipContent></Tooltip></TooltipProvider>
                        </div>
                        <Input value={formData.idZz} onChange={(e) => setFormData({ ...formData, idZz: e.target.value })} placeholder={t.clinics.idZz} className="h-9" data-testid="input-clinic-idzz" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <Label className="text-xs">{t.clinics.pzsCode}</Label>
                          <TooltipProvider><Tooltip><TooltipTrigger asChild><HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent className="max-w-xs"><p>{t.clinics.pzsCodeTip}</p></TooltipContent></Tooltip></TooltipProvider>
                        </div>
                        <Input value={formData.pzsCode} onChange={(e) => setFormData({ ...formData, pzsCode: e.target.value })} placeholder={t.clinics.pzsCode} className="h-9" data-testid="input-clinic-pzscode" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <Label className="text-xs">{t.clinics.pzsName}</Label>
                          <TooltipProvider><Tooltip><TooltipTrigger asChild><HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent className="max-w-xs"><p>{t.clinics.pzsNameTip}</p></TooltipContent></Tooltip></TooltipProvider>
                        </div>
                        <Input value={formData.pzsName} onChange={(e) => setFormData({ ...formData, pzsName: e.target.value })} placeholder={t.clinics.pzsName} className="h-9" data-testid="input-clinic-pzsname" />
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
                <div className="flex items-center justify-between p-3 border rounded-lg ml-1">
                  <div>
                    <Label className="text-xs">{t.clinics.isActive || "Aktívna ambulancia"}</Label>
                    <p className="text-[11px] text-muted-foreground">{t.clinics.isActiveDesc || "Ambulancia je aktívna a zobrazuje sa v zoznamoch"}</p>
                  </div>
                  <Switch checked={formData.isActive} onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })} data-testid="switch-clinic-active" />
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2"><div className="flex items-center justify-center w-6 h-6 rounded-md bg-sky-100 dark:bg-sky-900"><Phone className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" /></div><h3 className="text-sm font-semibold tracking-wide">{t.clinics.sections?.contact || 'Kontakt'}</h3></div>
                <div className="grid gap-3 sm:grid-cols-2 pl-1">
                  <div className="space-y-3">
                    <div className="space-y-1"><Label className="text-xs">{t.clinics.phone}</Label>
                      <div className="flex items-center gap-1">
                        <div className="flex-1 min-w-0"><PhoneNumberField value={formData.phone} onChange={(v) => setFormData({ ...formData, phone: v })} defaultCountryCode={formData.countryCode || "SK"} data-testid="input-clinic-phone" /></div>
                        <CallSlot phoneNumber={formData.phone} customerId={initialData?.id} customerName={doctorFullName || formData.name || initialData?.name} />
                      </div>
                    </div>
                    {(formData.phone2 || formData.email2 || formData.phone3 || formData.email3 || showExtraContacts) && (
                      <>
                        <div className="space-y-1"><Label className="text-xs">{t.clinics.phone} 2</Label>
                          <div className="flex items-center gap-1">
                            <div className="flex-1 min-w-0"><PhoneNumberField value={formData.phone2} onChange={(v) => setFormData({ ...formData, phone2: v })} defaultCountryCode={formData.countryCode || "SK"} data-testid="input-clinic-phone2" /></div>
                            <CallSlot phoneNumber={formData.phone2} customerId={initialData?.id} customerName={doctorFullName || formData.name || initialData?.name} />
                          </div>
                        </div>
                        <div className="space-y-1"><Label className="text-xs">{t.clinics.phone} 3</Label>
                          <div className="flex items-center gap-1">
                            <div className="flex-1 min-w-0"><PhoneNumberField value={formData.phone3} onChange={(v) => setFormData({ ...formData, phone3: v })} defaultCountryCode={formData.countryCode || "SK"} data-testid="input-clinic-phone3" /></div>
                            <CallSlot phoneNumber={formData.phone3} customerId={initialData?.id} customerName={doctorFullName || formData.name || initialData?.name} />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1"><Label className="text-xs">{t.clinics.email}</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder={t.clinics.email} className="h-9" data-testid="input-clinic-email" /></div>
                    {(formData.phone2 || formData.email2 || formData.phone3 || formData.email3 || showExtraContacts) && (
                      <>
                        <div className="space-y-1"><Label className="text-xs">{t.clinics.email} 2</Label><Input type="email" value={formData.email2} onChange={(e) => setFormData({ ...formData, email2: e.target.value })} placeholder={`${t.clinics.email} 2`} className="h-9" data-testid="input-clinic-email2" /></div>
                        <div className="space-y-1"><Label className="text-xs">{t.clinics.email} 3</Label><Input type="email" value={formData.email3} onChange={(e) => setFormData({ ...formData, email3: e.target.value })} placeholder={`${t.clinics.email} 3`} className="h-9" data-testid="input-clinic-email3" /></div>
                      </>
                    )}
                  </div>
                </div>
                {!(formData.phone2 || formData.email2 || formData.phone3 || formData.email3 || showExtraContacts) && (
                  <div className="pl-1">
                    <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowExtraContacts(true)} data-testid="button-show-extra-contacts-drawer">
                      <Plus className="h-3 w-3 mr-1" />
                      {(t.clinics as any).addExtraContacts || "Pridať ďalší telefón / email"}
                    </Button>
                  </div>
                )}
                <div className="space-y-1 pl-1"><Label className="text-xs">{t.clinics.website}</Label>
                  <div className="flex gap-2">
                    <Input value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} placeholder="www.example.com" className="flex-1 h-9" data-testid="input-clinic-website" />
                    {formData.website && (<Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => window.open(getWebsiteUrl(formData.website), "_blank")} data-testid="button-open-website"><ExternalLink className="h-4 w-4" /></Button>)}
                  </div>
                </div>
                <div className="space-y-1 pl-1"><Label className="text-xs">{t.clinics.notes}</Label><Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder={t.clinics.notes} rows={4} data-testid="input-clinic-notes" /></div>
              </div>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2"><div className="flex items-center justify-center w-6 h-6 rounded-md bg-emerald-100 dark:bg-emerald-900"><PhoneCall className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /></div><h3 className="text-sm font-semibold tracking-wide">{t.clinics.sections?.callsAndContact || 'Calls & Contact'}</h3></div>
                <div className="grid gap-3 sm:grid-cols-2 pl-1">
                  <div className="space-y-1"><Label className="text-xs">{(t.clinics as any).lastCallResult || "Last call result"}</Label><Input value={formData.lastCallResult} onChange={(e) => setFormData({ ...formData, lastCallResult: e.target.value })} placeholder={(t.clinics as any).lastCallResult || "Last call result"} className="h-9" data-testid="input-last-call-result" /></div>
                  <div className="space-y-1"><Label className="text-xs">{t.clinics.sections?.nextContactDate || "Next contact date"}</Label><DateTimePicker value={formData.nextContactDate} onChange={(v) => setFormData({ ...formData, nextContactDate: v })} countryCode={formData.countryCode || "SK"} includeTime={false} data-testid="input-next-contact-date" /></div>
                </div>
                <div className="space-y-1 pl-1"><Label className="text-xs">Poznámka z hovoru</Label><Textarea value={formData.lastCallNote} onChange={(e) => setFormData({ ...formData, lastCallNote: e.target.value })} placeholder="Poznámka z posledného hovoru" rows={2} className="text-sm" data-testid="input-last-call-note" /></div>
              </div>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex items-center justify-center w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-900">
                    <CircleDot className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-sm font-semibold tracking-wide">{t.clinics.leadSource}</h3>
                </div>
                <div className="grid gap-1.5 pl-1">
                  {MAIN_SOURCE_TYPES.map((type) => {
                    const Icon = LEAD_SOURCE_ICONS[type];
                    const selected = formData.leadSource === type;
                    const isExpanded = selected && pipelineMenuOpen;
                    return (
                      <div key={type}>
                        <button type="button" className={cn("flex items-center gap-3 px-3 py-2.5 border rounded-lg cursor-pointer transition-all w-full text-left", selected ? cn("border-2 shadow-sm", LEAD_SOURCE_COLORS[type]) : formData.leadSource ? "opacity-40 border-border hover:opacity-70" : "hover:bg-muted/50 border-border", isExpanded && "rounded-b-none")}
                          onClick={() => { if (selected) { setPipelineMenuOpen(!pipelineMenuOpen); setExpandedCategory(null); } else { setFormData(prev => ({ ...prev, leadSource: type })); setPipelineMenuOpen(true); setExpandedCategory(null); } }} data-testid={`source-card-basic-${type}`}>
                          <div className={cn("flex items-center justify-center w-8 h-8 rounded-lg shrink-0", LEAD_SOURCE_ICON_BG[type])}><Icon className="h-4 w-4" /></div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{t.clinics.leadSourceTypes?.[type] || type}</div>
                            {selected && currentPipelineOption && !isExpanded && (
                              <div className={cn("text-xs mt-0.5 font-medium", currentPipelineOption.color)}>
                                {(t.clinics as any).pipeline?.[currentPipelineCategory?.labelKey] || currentPipelineCategory?.labelKey}: {(t.clinics as any).pipeline?.[currentPipelineOption.labelKey] || currentPipelineOption.labelKey}
                              </div>
                            )}
                          </div>
                          {selected && (<div className="flex items-center gap-1.5 shrink-0"><CheckCircle2 className="h-4 w-4 text-primary" /><ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isExpanded && "rotate-180")} /></div>)}
                        </button>
                        {isExpanded && (
                          <div className="border border-t-0 rounded-b-lg bg-muted/20 dark:bg-muted/10 overflow-hidden">
                            {PIPELINE_CATEGORIES.map((cat) => {
                              const CatIcon = cat.icon;
                              const isCatExpanded = expandedCategory === cat.key;
                              const selectedInCat = cat.options.find(o => o.value === currentPipelineValue);
                              return (
                                <div key={cat.key}>
                                  <button type="button" className={cn("flex items-center gap-2.5 w-full px-4 py-2.5 text-left transition-all hover:bg-muted/50", isCatExpanded && "bg-muted/40", selectedInCat && "bg-primary/5")}
                                    onClick={() => setExpandedCategory(isCatExpanded ? null : cat.key)}>
                                    <CatIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <span className="text-sm font-medium flex-1">{(t.clinics as any).pipeline?.[cat.labelKey] || cat.labelKey}</span>
                                    {selectedInCat && (
                                      <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border",
                                        selectedInCat.sentiment === "positive" ? "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700"
                                          : selectedInCat.sentiment === "negative" ? "bg-red-100 text-red-600 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700"
                                            : "bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600"
                                      )}>{(t.clinics as any).pipeline?.[selectedInCat.labelKey] || selectedInCat.labelKey}</span>
                                    )}
                                    <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0", isCatExpanded && "rotate-90")} />
                                  </button>
                                  {isCatExpanded && (
                                    <div className="px-4 pb-2 pt-1 space-y-1">
                                      {cat.options.map((opt) => {
                                        const OptIcon = opt.icon;
                                        const isSelected = currentPipelineValue === opt.value;
                                        return (
                                          <button key={opt.value} type="button" className={cn("flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-left transition-all",
                                            isSelected ? opt.sentiment === "positive" ? "bg-green-100 border border-green-300 text-green-800 dark:bg-green-900/40 dark:border-green-700 dark:text-green-200"
                                              : opt.sentiment === "negative" ? "bg-red-100 border border-red-300 text-red-700 dark:bg-red-900/40 dark:border-red-700 dark:text-red-200"
                                                : "bg-primary/10 border border-primary/30 text-foreground" : "hover:bg-muted/60 border border-transparent"
                                          )} onClick={() => selectPipelineOption(opt.value)}>
                                            <OptIcon className={cn("h-4 w-4 shrink-0", opt.color)} />
                                            <span className="text-sm font-medium flex-1">{(t.clinics as any).pipeline?.[opt.labelKey] || opt.labelKey}</span>
                                            {isSelected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {formData.leadSource && (
                  <Button type="button" variant="ghost" size="sm" className="text-muted-foreground text-xs ml-1" onClick={() => {
                    setFormData(prev => ({ ...prev, leadSource: "", initialStatus: "", interestCooperation: "", interestContract: "", contractStatus: "" }));
                    setPipelineMenuOpen(false); setExpandedCategory(null);
                  }} data-testid="button-clear-source-basic"><X className="h-3 w-3 mr-1" /> {(t.clinics as any).pipeline?.clearSelection || t.common.clear || "Clear"}</Button>
                )}
                {formData.leadSource && (
                  <div className="grid gap-3 sm:grid-cols-2 pl-1">
                    <div className="space-y-1"><Label className="text-xs">{t.clinics.leadSourceDate}</Label><DateTimePicker value={formData.leadSourceDate} onChange={(v) => setFormData({ ...formData, leadSourceDate: v })} countryCode={formData.countryCode || "SK"} includeTime={false} data-testid="input-lead-source-date-basic" /></div>
                  </div>
                )}
                {formData.leadSource && (
                  <div className="space-y-1 pl-1"><Label className="text-xs">{t.clinics.leadSourceNotes}</Label><Textarea value={formData.leadSourceNotes} onChange={(e) => setFormData({ ...formData, leadSourceNotes: e.target.value })} placeholder={t.clinics.leadSourceNotes} rows={2} data-testid="input-lead-source-notes-basic" /></div>
                )}
              </div>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2"><div className="flex items-center justify-center w-6 h-6 rounded-md bg-amber-100 dark:bg-amber-900"><FileSignature className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" /></div><h3 className="text-sm font-semibold tracking-wide">{(t.clinics as any).contractTitle || "Contract"}</h3></div>
                <div className="grid gap-3 sm:grid-cols-2 pl-1">
                  <div className="space-y-1"><Label className="text-xs">{(t.clinics as any).contractSentDate || "Contract sent date"}</Label><DateTimePicker value={formData.contractSentDate} onChange={(v) => setFormData({ ...formData, contractSentDate: v })} countryCode={formData.countryCode || "SK"} includeTime={false} data-testid="input-contract-sent-date" /></div>
                  <div className="space-y-1"><Label className="text-xs">{(t.clinics as any).contractReturnedDate || "Contract returned date"}</Label><DateTimePicker value={formData.contractReturnedDate} onChange={(v) => setFormData({ ...formData, contractReturnedDate: v })} countryCode={formData.countryCode || "SK"} includeTime={false} data-testid="input-contract-returned-date" /></div>
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2"><div className="flex items-center justify-center w-6 h-6 rounded-md bg-rose-100 dark:bg-rose-900"><Newspaper className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" /></div><h3 className="text-sm font-semibold tracking-wide">{(t.clinics as any).flyersTitle || "Flyers & Posters"}</h3></div>
                <div className="pl-1 space-y-2">
                  <div className={cn("flex items-center gap-3 px-3 py-2.5 border rounded-lg cursor-pointer transition-all", formData.hasFlyers ? "border-2 shadow-sm bg-rose-50 border-rose-200 dark:bg-rose-950 dark:border-rose-800" : "hover:bg-muted/50 border-border")} onClick={() => setFormData({ ...formData, hasFlyers: !formData.hasFlyers })}>
                    <Checkbox checked={formData.hasFlyers} onCheckedChange={(checked) => setFormData({ ...formData, hasFlyers: !!checked })} data-testid="checkbox-flyers" onClick={(e) => e.stopPropagation()} />
                    <span className="text-sm font-medium">{(t.clinics as any).flyersPlacement || "Placement of flyers / posters"}</span>
                  </div>
                  {formData.hasFlyers && (
                    <div className="ml-3 pl-3 border-l-2 border-rose-200 dark:border-rose-800 space-y-2">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1"><Label className="text-xs">{(t.clinics as any).flyersSentDate || "Sent date"}</Label><DateTimePicker value={formData.flyersSentDate} onChange={(v) => setFormData({ ...formData, flyersSentDate: v })} countryCode={formData.countryCode || "SK"} includeTime={false} data-testid="input-flyers-sent-date" /></div>
                        <div className="space-y-1"><Label className="text-xs">{(t.clinics as any).flyersLocation || "Location"}</Label><Input value={formData.flyersLocation} onChange={(e) => setFormData({ ...formData, flyersLocation: e.target.value })} placeholder={(t.clinics as any).flyersLocationPlaceholder || "Where they were placed"} className="h-9" data-testid="input-flyers-location" /></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "address" && (
            <div className="space-y-4 pb-4">
              <div className="space-y-1">
                <Label className="text-xs">{t.common.country} *</Label>
                <Select value={formData.countryCode} onValueChange={(value) => { const newRegion = getAutoRegion(value, formData.city); const newDistrict = getAutoDistrict(value, formData.city); setFormData({ ...formData, countryCode: value, region: newRegion || "", district: newDistrict || "" }); }}>
                  <SelectTrigger data-testid="select-clinic-country" className="h-9"><SelectValue placeholder={t.common.country} /></SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((country) => (
                      <SelectItem key={country.code} value={country.code}>{getCountryFlag(country.code)} {country.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1 sm:col-span-3 md:col-span-1">
                  <Label className="text-xs">{t.clinics.street}</Label>
                  <Input value={formData.street} onChange={(e) => setFormData({ ...formData, street: e.target.value })} placeholder={t.clinics.street} className="h-9" data-testid="input-clinic-street" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t.clinics.streetNumber}</Label>
                  <Input value={formData.streetNumber} onChange={(e) => setFormData({ ...formData, streetNumber: e.target.value })} placeholder="123" className="h-9" data-testid="input-clinic-street-number" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t.clinics.orientationNumber}</Label>
                  <Input value={formData.orientationNumber} onChange={(e) => setFormData({ ...formData, orientationNumber: e.target.value })} placeholder="4A" className="h-9" data-testid="input-clinic-orientation-number" />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1"><Label className="text-xs">{t.clinics.city}</Label><Input value={formData.city} onChange={(e) => { const newCity = e.target.value; const newRegion = getAutoRegion(formData.countryCode, newCity); const newDistrict = getAutoDistrict(formData.countryCode, newCity); setFormData({ ...formData, city: newCity, region: newRegion || formData.region, district: newDistrict || formData.district }); }} placeholder={t.clinics.city} className="h-9" data-testid="input-clinic-city" /></div>
                <div className="space-y-1">
                  <Label className="text-xs">{t.clinics.postalCode}</Label>
                  <div className="flex items-center gap-1">
                    <Input value={formData.postalCode} onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })} placeholder={t.clinics.postalCode} className="h-9 flex-1" data-testid="input-clinic-postal" />
                    <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={lookupPostalCode} disabled={postalLookupLoading || !formData.city} title={t.clinics.lookupPsc} data-testid="button-lookup-psc">
                      {postalLookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <Label className="text-xs">{t.clinics.ico}</Label>
                  <TooltipProvider><Tooltip><TooltipTrigger asChild><HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent className="max-w-xs"><p>{t.clinics.icoTip}</p></TooltipContent></Tooltip></TooltipProvider>
                </div>
                <Input value={formData.ico} onChange={(e) => setFormData({ ...formData, ico: e.target.value })} placeholder={t.clinics.ico} className="h-9" data-testid="input-clinic-ico" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">{getGeoLabels(formData.countryCode).region}</Label>
                  <div className="flex items-center gap-1">
                    <Select value={formData.region || ""} onValueChange={(value) => setFormData({ ...formData, region: value, district: "" })}>
                      <SelectTrigger data-testid="select-clinic-region" className="h-9"><SelectValue placeholder={getGeoLabels(formData.countryCode).region} /></SelectTrigger>
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
                      streetNumber={[formData.street, [formData.streetNumber, formData.orientationNumber].filter(Boolean).join("/")].filter(Boolean).join(" ") || formData.address}
                      postalCode={formData.postalCode}
                      size="icon"
                      onSuggestion={(region, district) => setFormData({ ...formData, region, district })}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{getGeoLabels(formData.countryCode).district}</Label>
                  <Select value={formData.district || ""} onValueChange={(value) => setFormData({ ...formData, district: value })}>
                    <SelectTrigger data-testid="select-clinic-district" className="h-9"><SelectValue placeholder={getGeoLabels(formData.countryCode).district} /></SelectTrigger>
                    <SelectContent>
                      {getDistrictsForRegion(formData.countryCode, formData.region, formData.district).map((d: string) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label className="text-xs">{t.clinics.gpsCoordinates || "GPS suradnice"}</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1"><Label className="text-[11px] text-muted-foreground">{t.clinics.latitude || "Zemepisna sirka"}</Label><Input value={formData.latitude} onChange={(e) => setFormData({ ...formData, latitude: e.target.value })} placeholder="48.1486" className="h-9" data-testid="input-clinic-lat" /></div>
                  <div className="space-y-1"><Label className="text-[11px] text-muted-foreground">{t.clinics.longitude || "Longitude"}</Label><Input value={formData.longitude} onChange={(e) => setFormData({ ...formData, longitude: e.target.value })} placeholder="17.1077" className="h-9" data-testid="input-clinic-lng" /></div>
                </div>
                <div className="flex gap-2 mt-2">
                  <Button type="button" variant="outline" size="sm" onClick={handleGetCurrentLocation} disabled={isLoadingLocation} data-testid="button-get-gps">
                    {isLoadingLocation ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Navigation className="h-4 w-4 mr-2" />}
                    {t.clinics.getCurrentLocation || "Get current location"}
                  </Button>
                  {formData.latitude && formData.longitude && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowMapDialog(true)} data-testid="button-show-map"><MapPin className="h-4 w-4 mr-2" />{t.clinics.showOnMap || "Show on map"}</Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "history" && (
            <div className="pb-4" data-testid="tab-content-history-drawer">
              {eventsLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : !clinicEventsData || clinicEventsData.length === 0 ? (
                <div className="text-center py-12">
                  <History className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">{t.clinics.noHistory || "No history yet"}</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">{t.clinics.noHistoryDesc || "Events will be recorded after the first change"}</p>
                </div>
              ) : (
                <div className="relative pl-6" data-testid="clinic-history-timeline">
                  <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />
                  <div className="space-y-0">
                    {clinicEventsData.map((event) => {
                      const eventDate = new Date(event.createdAt);
                      const isToday = new Date().toDateString() === eventDate.toDateString();
                      const timeStr = eventDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                      const dateStr = isToday ? timeStr : `${eventDate.toLocaleDateString()} ${timeStr}`;
                      let IconComp = FileText;
                      let iconColor = "text-gray-500 bg-gray-100 dark:bg-gray-800";
                      if (event.eventType === "status_change") { IconComp = ArrowRightLeft; iconColor = "text-blue-500 bg-blue-50 dark:bg-blue-950"; }
                      else if (event.eventType === "referral_added") { IconComp = UserCheck; iconColor = "text-purple-500 bg-purple-50 dark:bg-purple-950"; }
                      else if (event.eventType === "referral_given") { IconComp = UserPlus; iconColor = "text-indigo-500 bg-indigo-50 dark:bg-indigo-950"; }
                      else if (event.eventType === "email_sent" || event.eventType === "email_received") { IconComp = Mail; iconColor = "text-sky-500 bg-sky-50 dark:bg-sky-950"; }
                      else if (event.eventType === "sms_sent" || event.eventType === "sms_received") { IconComp = MessageSquare; iconColor = "text-green-500 bg-green-50 dark:bg-green-950"; }
                      else if (event.eventType === "campaign") { IconComp = Megaphone; iconColor = "text-orange-500 bg-orange-50 dark:bg-orange-950"; }
                      else if (event.eventType === "call") { IconComp = PhoneCall; iconColor = "text-emerald-500 bg-emerald-50 dark:bg-emerald-950"; }
                      else if (event.eventType === "clinic_created") { IconComp = Plus; iconColor = "text-green-600 bg-green-50 dark:bg-green-950"; }
                      return (
                        <div key={event.id} className="relative flex gap-3 pb-5" data-testid={`history-event-${event.id}`}>
                          <div className={cn("relative z-10 flex items-center justify-center w-6 h-6 rounded-full shrink-0 -ml-6", iconColor)}><IconComp className="h-3 w-3" /></div>
                          <div className="flex-1 min-w-0 pt-0.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0"><p className="text-sm font-medium leading-tight">{event.title}</p>{event.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{event.description}</p>}</div>
                              <span className="text-[10px] text-muted-foreground/60 shrink-0 pt-0.5">{dateStr}</span>
                            </div>
                            {event.createdByName && <p className="text-[10px] text-muted-foreground/50 mt-0.5">{event.createdByName}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "personnel" && initialData && (
            <InstitutionPersonnelManager entityType="clinic" entityId={initialData.id} entityName={initialData.name} countryCode={initialData.countryCode} inlineMode={mode === "inline"} />
          )}

          {activeTab === "campaigns" && initialData && (
            <EntityCampaignTimeline entityType="clinic" entityId={initialData.id} entityName={initialData.name} />
          )}
        </div>
      </div>

      <div className="shrink-0 border-t bg-muted/30 px-5 py-3 flex items-center justify-end gap-2">
        {mode !== "inline" && (
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-clinic-drawer">{t.common.cancel}</Button>
        )}
        <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-clinic-drawer">
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
          {t.common.save}
        </Button>
      </div>
    </>
  );

  if (mode === "inline") {
    return (
      <>
        <div className="flex flex-col h-full overflow-hidden relative" data-testid="clinic-card-tabbed-inline">
          {editorBody}
        </div>
        {mapDialog}
        {nestedClinicForm && (
          <Sheet open={true} onOpenChange={(o) => { if (!o) setNestedClinicForm(null); }}>
            <SheetContent side="right" className="w-full sm:max-w-3xl p-0 overflow-hidden">
              <SheetHeader className="px-6 py-4 border-b">
                <SheetTitle>{(t.clinics as any).addNewDoctor || (t.collaborators as any).addPerson || "Add new doctor"}</SheetTitle>
              </SheetHeader>
              <div className="h-[calc(100vh-65px)] overflow-hidden">
                <CollaboratorFormWizard
                  prefillData={{ lastName: nestedClinicForm.prefillName, countryCode: formData.countryCode || "SK" }}
                  onSuccess={() => setNestedClinicForm(null)}
                  onCancel={() => setNestedClinicForm(null)}
                  onCreated={async (created) => { await handleNestedPersonCreatedForClinic(created); setNestedClinicForm(null); }}
                />
              </div>
            </SheetContent>
          </Sheet>
        )}
      </>
    );
  }

  if (initialData) {
    return (
      <>
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent className="w-[900px] sm:max-w-[900px] p-0 [&>button]:hidden" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="shrink-0 border-b px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                  <Stethoscope className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-semibold">{t.clinics.editClinic}</span>
                    {clinicNetworks.map((netName: string) => (
                      <Badge key={netName} className="text-[10px] px-1.5 py-0 font-bold bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/60 dark:text-amber-300 dark:border-amber-700" data-testid="badge-clinic-network-header">
                        <Network className="h-2.5 w-2.5 mr-0.5" />
                        {netName}
                      </Badge>
                    ))}
                  </div>
                  {doctorFullName && (
                    <p className="text-xs text-muted-foreground font-normal truncate">{doctorFullName} • {initialData.name}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-3">
                  {initialData.email && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" data-testid="button-clinic-email-drawer"
                            onClick={() => {
                              const params = new URLSearchParams();
                              if (initialData.email) params.set("compose", initialData.email);
                              params.set("contactSearch", initialData.email || initialData.phone || "");
                              const emails = [initialData.email].filter(Boolean) as string[]; setSelectedEmails(emails); setEmailComposeOpen(true);
                            }}
                          >
                            <Mail className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>{initialData.email}</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  {initialData.phone && (
                    <CallCustomerButton phoneNumber={initialData.phone} customerName={doctorFullName || initialData.name} variant="icon" />
                  )}
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => onOpenChange(false)} data-testid="button-close-clinic-drawer">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {editorBody}
          </SheetContent>
        </Sheet>
        {mapDialog}
        {nestedClinicForm && (
          <Sheet open={true} onOpenChange={(o) => { if (!o) setNestedClinicForm(null); }}>
            <SheetContent side="right" className="w-full sm:max-w-3xl p-0 overflow-hidden">
              <SheetHeader className="px-6 py-4 border-b">
                <SheetTitle>{(t.clinics as any).addNewDoctor || (t.collaborators as any).addPerson || "Add new doctor"}</SheetTitle>
              </SheetHeader>
              <div className="h-[calc(100vh-65px)] overflow-hidden">
                <CollaboratorFormWizard
                  prefillData={{ lastName: nestedClinicForm.prefillName, countryCode: formData.countryCode || "SK" }}
                  onSuccess={() => setNestedClinicForm(null)}
                  onCancel={() => setNestedClinicForm(null)}
                  onCreated={async (created) => { await handleNestedPersonCreatedForClinic(created); setNestedClinicForm(null); }}
                />
              </div>
            </SheetContent>
          </Sheet>
        )}
      </>
    );
  }

  const clinicAddTabs = [
    { key: "basic", icon: Building2, label: t.clinics.steps?.basic || "Info" },
    { key: "address", icon: MapPin, label: t.clinics.steps?.address || "Address" },
    { key: "referral", icon: CircleDot, label: t.clinics.steps.referral },
    { key: "history", icon: History, label: t.clinics.steps?.history || "History" },
    { key: "personnel", icon: Users, label: (t as any).personnel || "Personnel" },
    { key: "campaigns", icon: Megaphone, label: (t as any).campaigns?.title || "Campaigns" },
  ];

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[900px] sm:max-w-[900px] p-0 [&>button]:hidden" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="shrink-0 border-b px-5 py-3 flex items-center justify-between bg-muted/30">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10">
                <Stethoscope className="h-4.5 w-4.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold">{t.clinics.addClinic}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{(t.clinics as any).addClinicDesc || "Add a new clinic to the system"}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => onOpenChange(false)} data-testid="button-close-clinic-add-drawer">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-1 min-h-0">
            <div className="w-44 border-r bg-muted/20 flex flex-col py-3 shrink-0 overflow-y-auto">
              {clinicAddTabs.map((tab) => {
                const TabIcon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      "flex items-center gap-2.5 px-4 py-2 text-sm transition-colors text-left",
                      isActive ? "bg-primary/10 text-primary font-medium border-r-2 border-primary" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    )}
                    data-testid={`tab-clinic-add-${tab.key}`}
                  >
                    <TabIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {activeTab === "referral" && (
                <div className="space-y-4 pb-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex items-center justify-center w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-900">
                        <CircleDot className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <h3 className="text-sm font-semibold tracking-wide">{t.clinics.leadSource}</h3>
                    </div>
                    <div className="grid gap-1.5">
                      {MAIN_SOURCE_TYPES.map((type) => {
                        const Icon = LEAD_SOURCE_ICONS[type];
                        const selected = formData.leadSource === type;
                        const isExpanded = selected && pipelineMenuOpen;
                        return (
                          <div key={type}>
                            <button type="button" className={cn("flex items-center gap-3 px-3 py-2.5 border rounded-lg cursor-pointer transition-all w-full text-left", selected ? cn("border-2 shadow-sm", LEAD_SOURCE_COLORS[type]) : formData.leadSource ? "opacity-40 border-border hover:opacity-70" : "hover:bg-muted/50 border-border", isExpanded && "rounded-b-none")}
                              onClick={() => { if (selected) { setPipelineMenuOpen(!pipelineMenuOpen); setExpandedCategory(null); } else { setFormData(prev => ({ ...prev, leadSource: type })); setPipelineMenuOpen(true); setExpandedCategory(null); } }} data-testid={`source-card-add-${type}`}>
                              <div className={cn("flex items-center justify-center w-8 h-8 rounded-lg shrink-0", LEAD_SOURCE_ICON_BG[type])}><Icon className="h-4 w-4" /></div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm">{t.clinics.leadSourceTypes?.[type] || type}</div>
                                {selected && currentPipelineOption && !isExpanded && (
                                  <div className={cn("text-xs mt-0.5 font-medium", currentPipelineOption.color)}>
                                    {(t.clinics as any).pipeline?.[currentPipelineCategory?.labelKey] || currentPipelineCategory?.labelKey}: {(t.clinics as any).pipeline?.[currentPipelineOption.labelKey] || currentPipelineOption.labelKey}
                                  </div>
                                )}
                              </div>
                              {selected && (<div className="flex items-center gap-1.5 shrink-0"><CheckCircle2 className="h-4 w-4 text-primary" /><ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isExpanded && "rotate-180")} /></div>)}
                            </button>
                            {isExpanded && (
                              <div className="border border-t-0 rounded-b-lg bg-muted/20 dark:bg-muted/10 overflow-hidden">
                                {PIPELINE_CATEGORIES.map((cat) => {
                                  const CatIcon = cat.icon;
                                  const isCatExpanded = expandedCategory === cat.key;
                                  const selectedInCat = cat.options.find(o => o.value === currentPipelineValue);
                                  return (
                                    <div key={cat.key}>
                                      <button type="button" className={cn("flex items-center gap-2.5 w-full px-4 py-2.5 text-left transition-all hover:bg-muted/50", isCatExpanded && "bg-muted/40", selectedInCat && "bg-primary/5")}
                                        onClick={() => setExpandedCategory(isCatExpanded ? null : cat.key)}>
                                        <CatIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                                        <span className="text-sm font-medium flex-1">{(t.clinics as any).pipeline?.[cat.labelKey] || cat.labelKey}</span>
                                        {selectedInCat && (
                                          <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border",
                                            selectedInCat.sentiment === "positive" ? "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700"
                                              : selectedInCat.sentiment === "negative" ? "bg-red-100 text-red-600 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700"
                                                : "bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600"
                                          )}>{(t.clinics as any).pipeline?.[selectedInCat.labelKey] || selectedInCat.labelKey}</span>
                                        )}
                                        <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0", isCatExpanded && "rotate-90")} />
                                      </button>
                                      {isCatExpanded && (
                                        <div className="px-4 pb-2 pt-1 space-y-1">
                                          {cat.options.map((opt) => {
                                            const OptIcon = opt.icon;
                                            const isSelected = currentPipelineValue === opt.value;
                                            return (
                                              <button key={opt.value} type="button" className={cn("flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-left transition-all",
                                                isSelected ? opt.sentiment === "positive" ? "bg-green-100 border border-green-300 text-green-800 dark:bg-green-900/40 dark:border-green-700 dark:text-green-200"
                                                  : opt.sentiment === "negative" ? "bg-red-100 border border-red-300 text-red-700 dark:bg-red-900/40 dark:border-red-700 dark:text-red-200"
                                                    : "bg-primary/10 border border-primary/30 text-foreground" : "hover:bg-muted/60 border border-transparent"
                                              )} onClick={() => selectPipelineOption(opt.value)}>
                                                <OptIcon className={cn("h-4 w-4 shrink-0", opt.color)} />
                                                <span className="text-sm font-medium flex-1">{(t.clinics as any).pipeline?.[opt.labelKey] || opt.labelKey}</span>
                                                {isSelected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {formData.leadSource && (
                      <Button type="button" variant="ghost" size="sm" className="text-muted-foreground text-xs" onClick={() => {
                        setFormData(prev => ({ ...prev, leadSource: "", initialStatus: "", interestCooperation: "", interestContract: "", contractStatus: "" }));
                        setPipelineMenuOpen(false); setExpandedCategory(null);
                      }}><X className="h-3 w-3 mr-1" /> {(t.clinics as any).pipeline?.clearSelection || t.common.clear || "Clear"}</Button>
                    )}
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex items-center justify-center w-6 h-6 rounded-md bg-purple-100 dark:bg-purple-900"><UserCheck className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" /></div>
                      <h3 className="text-sm font-semibold tracking-wide">{(t.clinics as any).pipeline?.referralAndConference || "Referral & Conference"}</h3>
                    </div>
                    <div className={cn("border rounded-lg px-3 py-2.5 transition-all cursor-pointer", formData.isReferredByDoctor ? cn("border-2 shadow-sm", LEAD_SOURCE_COLORS.doctor_referral) : "hover:bg-muted/50 border-border")}
                      onClick={() => setFormData({ ...formData, isReferredByDoctor: !formData.isReferredByDoctor })}>
                      <div className="flex items-center gap-3">
                        <div className={cn("flex items-center justify-center w-8 h-8 rounded-lg shrink-0", LEAD_SOURCE_ICON_BG.doctor_referral)}><UserCheck className="h-4 w-4" /></div>
                        <div className="flex-1 min-w-0"><div className="font-medium text-sm">{t.clinics.leadSourceTypes?.doctor_referral || "Doctor referral"}</div></div>
                        <Checkbox checked={formData.isReferredByDoctor} onCheckedChange={(checked) => setFormData({ ...formData, isReferredByDoctor: !!checked })} className="shrink-0" onClick={(e) => e.stopPropagation()} />
                      </div>
                    </div>
                    {formData.isReferredByDoctor && (
                      <div className="space-y-4">
                        <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/30 dark:bg-purple-950/20 p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <UserCheck className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                              {(t.clinics as any).hasBeenRecommendedBy || "The potential Medical Partner has been recommended by following medical partners:"}
                            </span>
                          </div>
                          {doctorReferrals.length > 0 && (
                            <div className="space-y-1.5 ml-6">
                              {doctorReferrals.map((ref) => (
                                <div key={ref.clinicId} className="flex items-center justify-between px-3 py-1.5 border rounded-lg bg-white dark:bg-background">
                                  <div className="flex items-center gap-2"><UserCheck className="h-3.5 w-3.5 text-purple-500" /><span className="text-sm font-medium">{ref.clinicName}</span></div>
                                  <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeReferral(ref.clinicId)} data-testid={`remove-add-referral-${ref.clinicId}`}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="ml-6">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input value={referralSearch} onChange={(e) => setReferralSearch(e.target.value)} placeholder={t.clinics.selectDoctor} className="pl-9 h-9" data-testid="input-add-referral-search" />
                            </div>
                            {referralSearch && filteredClinics.length > 0 && (
                              <div className="border rounded-lg max-h-36 overflow-y-auto mt-1">
                                {filteredClinics.slice(0, 10).map((clinic) => (
                                  <div key={clinic.id} className="flex items-center justify-between p-2 hover:bg-muted/50 cursor-pointer" onClick={() => addReferral(clinic, "doctor_referral")} data-testid={`add-referral-option-${clinic.id}`}>
                                    <div><span className="font-medium text-sm">{getDoctorFullName(clinic as any) || clinic.name}</span><span className="text-sm text-muted-foreground ml-2">{clinic.city || ""}</span></div>
                                    <Plus className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                ))}
                              </div>
                            )}
                            {referralSearch && filteredClinics.length === 0 && (
                              <div className="mt-2">
                                <p className="text-xs text-muted-foreground mb-2">{(t.clinics as any).doctorNotInDatabase || "Doctor not found in database? Add new:"}</p>
                                <Button type="button" variant="outline" size="sm" className="text-xs gap-1" onClick={() => setNestedClinicForm({ direction: "recommendedBy", prefillName: referralSearch })} data-testid="button-add-new-doctor-recommended-add">
                                  <UserPlus className="h-3.5 w-3.5" /> {(t.clinics as any).addNewDoctor || "Add new doctor"}
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/20 p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
                            <span className="text-xs font-semibold text-green-700 dark:text-green-300">
                              {(t.clinics as any).hasSuggested || "The potential Medical Partner has suggested following medical partners:"}
                            </span>
                          </div>
                          {suggestsReferrals.length > 0 && (
                            <div className="space-y-1.5 ml-6">
                              {suggestsReferrals.map((ref) => (
                                <div key={ref.clinicId} className="flex items-center justify-between px-3 py-1.5 border rounded-lg bg-white dark:bg-background">
                                  <div className="flex items-center gap-2"><Users className="h-3.5 w-3.5 text-green-500" /><span className="text-sm font-medium">{ref.clinicName}</span></div>
                                  <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeSuggestsReferral(ref.clinicId)} data-testid={`remove-add-suggests-${ref.clinicId}`}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="ml-6">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input value={suggestsSearch} onChange={(e) => setSuggestsSearch(e.target.value)} placeholder={t.clinics.selectDoctor} className="pl-9 h-9" data-testid="input-add-suggests-search" />
                            </div>
                            {suggestsSearch && filteredClinicsSuggests.length > 0 && (
                              <div className="border rounded-lg max-h-36 overflow-y-auto mt-1">
                                {filteredClinicsSuggests.slice(0, 10).map((clinic) => (
                                  <div key={clinic.id} className="flex items-center justify-between p-2 hover:bg-muted/50 cursor-pointer" onClick={() => addSuggestsReferral(clinic)} data-testid={`add-suggests-option-${clinic.id}`}>
                                    <div><span className="font-medium text-sm">{getDoctorFullName(clinic as any) || clinic.name}</span><span className="text-sm text-muted-foreground ml-2">{clinic.city || ""}</span></div>
                                    <Plus className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                ))}
                              </div>
                            )}
                            {suggestsSearch && filteredClinicsSuggests.length === 0 && (
                              <div className="mt-2">
                                <p className="text-xs text-muted-foreground mb-2">{(t.clinics as any).doctorNotInDatabase || "Doctor not found in database? Add new:"}</p>
                                <Button type="button" variant="outline" size="sm" className="text-xs gap-1" onClick={() => setNestedClinicForm({ direction: "suggests", prefillName: suggestsSearch })} data-testid="button-add-new-doctor-suggests-add">
                                  <UserPlus className="h-3.5 w-3.5" /> {(t.clinics as any).addNewDoctor || "Add new doctor"}
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    <div className={cn("border rounded-lg px-3 py-2.5 transition-all cursor-pointer", formData.isFromConference ? cn("border-2 shadow-sm", LEAD_SOURCE_COLORS.conference) : "hover:bg-muted/50 border-border")}
                      onClick={() => setFormData({ ...formData, isFromConference: !formData.isFromConference })}>
                      <div className="flex items-center gap-3">
                        <div className={cn("flex items-center justify-center w-8 h-8 rounded-lg shrink-0", LEAD_SOURCE_ICON_BG.conference)}><GraduationCap className="h-4 w-4" /></div>
                        <div className="flex-1 min-w-0"><div className="font-medium text-sm">{t.clinics.leadSourceTypes?.conference || "Conference / Seminar"}</div></div>
                        <Checkbox checked={formData.isFromConference} onCheckedChange={(checked) => setFormData({ ...formData, isFromConference: !!checked })} className="shrink-0" onClick={(e) => e.stopPropagation()} />
                      </div>
                    </div>
                    {formData.isFromConference && (
                      <div className="ml-3 pl-3 border-l-2 border-rose-200 dark:border-rose-800 space-y-2">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1"><Label className="text-xs">{t.clinics.conferenceName}</Label><Input value={formData.conferenceName} onChange={(e) => setFormData({ ...formData, conferenceName: e.target.value })} placeholder={t.clinics.conferenceName} className="h-9" /></div>
                          <div className="space-y-1"><Label className="text-xs">{t.clinics.conferenceDate}</Label><DateTimePicker value={formData.conferenceDate} onChange={(v) => setFormData({ ...formData, conferenceDate: v })} countryCode={formData.countryCode || "SK"} includeTime={false} /></div>
                        </div>
                      </div>
                    )}
                  </div>
                  {formData.leadSource && (
                    <>
                      <Separator />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1"><Label className="text-xs">{t.clinics.leadSourceDate}</Label><DateTimePicker value={formData.leadSourceDate} onChange={(v) => setFormData({ ...formData, leadSourceDate: v })} countryCode={formData.countryCode || "SK"} includeTime={false} /></div>
                      </div>
                      <div className="space-y-1"><Label className="text-xs">{t.clinics.leadSourceNotes}</Label><Textarea value={formData.leadSourceNotes} onChange={(e) => setFormData({ ...formData, leadSourceNotes: e.target.value })} placeholder={t.clinics.leadSourceNotes} rows={2} /></div>
                    </>
                  )}
                </div>
              )}

              {activeTab === "basic" && (
                <div className="space-y-5 pb-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2"><div className="flex items-center justify-center w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-900"><Building2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /></div><h3 className="text-sm font-semibold tracking-wide">{t.clinics.sections?.clinic || 'Klinika'}</h3></div>
                    <div className="grid gap-3 sm:grid-cols-2 pl-1">
                      <div className="space-y-1"><Label className="text-xs">{t.clinics.name} *</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder={t.clinics.name} className="h-9" data-testid="input-add-clinic-name" /></div>
                      <div className="space-y-1"><Label className="text-xs">{t.common.country} *</Label>
                        <Select value={formData.countryCode} onValueChange={(value) => setFormData({ ...formData, countryCode: value })}>
                          <SelectTrigger className="h-9" data-testid="select-add-clinic-country"><SelectValue placeholder={t.common.country} /></SelectTrigger>
                          <SelectContent>{COUNTRIES.map((country) => (<SelectItem key={country.code} value={country.code}>{getCountryFlag(country.code)} {country.name}</SelectItem>))}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Collapsible open={identifiersOpen} onOpenChange={setIdentifiersOpen} className="pl-1">
                      <CollapsibleTrigger asChild>
                        <button type="button" className="flex w-full items-center justify-between rounded-md px-2 py-2 hover-elevate active-elevate-2 text-xs font-medium text-muted-foreground" data-testid="toggle-add-clinic-identifiers">
                          <span className="flex items-center gap-2"><HelpCircle className="h-3.5 w-3.5" />{t.clinics.additionalIdentifiers}</span>
                          <ChevronDown className={cn("h-4 w-4 transition-transform", identifiersOpen && "rotate-180")} />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="grid gap-3 sm:grid-cols-3 pt-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <Label className="text-xs">{t.clinics.idZz}</Label>
                              <TooltipProvider><Tooltip><TooltipTrigger asChild><HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent className="max-w-xs"><p>{t.clinics.idZzTip}</p></TooltipContent></Tooltip></TooltipProvider>
                            </div>
                            <Input value={formData.idZz} onChange={(e) => setFormData({ ...formData, idZz: e.target.value })} placeholder={t.clinics.idZz} className="h-9" data-testid="input-add-clinic-idzz" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <Label className="text-xs">{t.clinics.pzsCode}</Label>
                              <TooltipProvider><Tooltip><TooltipTrigger asChild><HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent className="max-w-xs"><p>{t.clinics.pzsCodeTip}</p></TooltipContent></Tooltip></TooltipProvider>
                            </div>
                            <Input value={formData.pzsCode} onChange={(e) => setFormData({ ...formData, pzsCode: e.target.value })} placeholder={t.clinics.pzsCode} className="h-9" data-testid="input-add-clinic-pzscode" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <Label className="text-xs">{t.clinics.pzsName}</Label>
                              <TooltipProvider><Tooltip><TooltipTrigger asChild><HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent className="max-w-xs"><p>{t.clinics.pzsNameTip}</p></TooltipContent></Tooltip></TooltipProvider>
                            </div>
                            <Input value={formData.pzsName} onChange={(e) => setFormData({ ...formData, pzsName: e.target.value })} placeholder={t.clinics.pzsName} className="h-9" data-testid="input-add-clinic-pzsname" />
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                    <div className="flex items-center justify-between p-3 border rounded-lg ml-1">
                      <div>
                        <Label className="text-xs">{t.clinics.isActive || "Aktívna ambulancia"}</Label>
                        <p className="text-[11px] text-muted-foreground">{t.clinics.isActiveDesc || "Ambulancia je aktívna a zobrazuje sa v zoznamoch"}</p>
                      </div>
                      <Switch checked={formData.isActive} onCheckedChange={(v) => setFormData({ ...formData, isActive: v })} data-testid="switch-add-clinic-active" />
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center gap-2"><div className="flex items-center justify-center w-6 h-6 rounded-md bg-purple-100 dark:bg-purple-900"><Stethoscope className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" /></div><h3 className="text-sm font-semibold tracking-wide">{t.clinics.sections?.doctor || 'Doctor'}</h3></div>
                    <div className="grid gap-3 sm:grid-cols-3 pl-1">
                      <div className="space-y-1"><Label className="text-xs">{t.common.title || "Title"}</Label><Input value={formData.doctorTitle} onChange={(e) => setFormData({ ...formData, doctorTitle: e.target.value })} placeholder="MUDr." className="h-9" data-testid="input-add-doctor-title" /></div>
                      <div className="space-y-1"><Label className="text-xs">{t.clinics.sections?.firstName || "First name"}</Label><Input value={formData.doctorFirstName} onChange={(e) => setFormData({ ...formData, doctorFirstName: e.target.value })} placeholder={t.clinics.sections?.firstName || "First name"} className="h-9" data-testid="input-add-doctor-firstname" /></div>
                      <div className="space-y-1"><Label className="text-xs">{t.common.lastName || "Last name"}</Label><Input value={formData.doctorLastName} onChange={(e) => setFormData({ ...formData, doctorLastName: e.target.value })} placeholder={t.common.lastName || "Last name"} className="h-9" data-testid="input-add-doctor-lastname" /></div>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center gap-2"><div className="flex items-center justify-center w-6 h-6 rounded-md bg-sky-100 dark:bg-sky-900"><Phone className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" /></div><h3 className="text-sm font-semibold tracking-wide">{t.clinics.sections?.contact || 'Contact'}</h3></div>
                    <div className="grid gap-3 sm:grid-cols-2 pl-1">
                      <div className="space-y-3">
                        <div className="space-y-1"><Label className="text-xs">{t.clinics.phone}</Label>
                          <div className="flex items-center gap-1">
                            <div className="flex-1 min-w-0"><PhoneNumberField value={formData.phone} onChange={(v) => setFormData({ ...formData, phone: v })} defaultCountryCode={formData.countryCode || "SK"} data-testid="input-add-clinic-phone" /></div>
                            <CallSlot phoneNumber={formData.phone} customerId={initialData?.id} customerName={doctorFullName || formData.name || initialData?.name} />
                          </div>
                        </div>
                        {(formData.phone2 || formData.email2 || formData.phone3 || formData.email3 || showExtraContacts) && (
                          <>
                            <div className="space-y-1"><Label className="text-xs">{t.clinics.phone} 2</Label>
                              <div className="flex items-center gap-1">
                                <div className="flex-1 min-w-0"><PhoneNumberField value={formData.phone2} onChange={(v) => setFormData({ ...formData, phone2: v })} defaultCountryCode={formData.countryCode || "SK"} data-testid="input-add-clinic-phone2" /></div>
                                <CallSlot phoneNumber={formData.phone2} customerId={initialData?.id} customerName={doctorFullName || formData.name || initialData?.name} />
                              </div>
                            </div>
                            <div className="space-y-1"><Label className="text-xs">{t.clinics.phone} 3</Label>
                              <div className="flex items-center gap-1">
                                <div className="flex-1 min-w-0"><PhoneNumberField value={formData.phone3} onChange={(v) => setFormData({ ...formData, phone3: v })} defaultCountryCode={formData.countryCode || "SK"} data-testid="input-add-clinic-phone3" /></div>
                                <CallSlot phoneNumber={formData.phone3} customerId={initialData?.id} customerName={doctorFullName || formData.name || initialData?.name} />
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="space-y-3">
                        <div className="space-y-1"><Label className="text-xs">{t.clinics.email}</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder={t.clinics.email} className="h-9" data-testid="input-add-clinic-email" /></div>
                        {(formData.phone2 || formData.email2 || formData.phone3 || formData.email3 || showExtraContacts) && (
                          <>
                            <div className="space-y-1"><Label className="text-xs">{t.clinics.email} 2</Label><Input type="email" value={formData.email2} onChange={(e) => setFormData({ ...formData, email2: e.target.value })} placeholder={`${t.clinics.email} 2`} className="h-9" data-testid="input-add-clinic-email2" /></div>
                            <div className="space-y-1"><Label className="text-xs">{t.clinics.email} 3</Label><Input type="email" value={formData.email3} onChange={(e) => setFormData({ ...formData, email3: e.target.value })} placeholder={`${t.clinics.email} 3`} className="h-9" data-testid="input-add-clinic-email3" /></div>
                          </>
                        )}
                      </div>
                    </div>
                    {!(formData.phone2 || formData.email2 || formData.phone3 || formData.email3 || showExtraContacts) && (
                      <div className="pl-1">
                        <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowExtraContacts(true)} data-testid="button-show-extra-contacts-add">
                          <Plus className="h-3 w-3 mr-1" />
                          {(t.clinics as any).addExtraContacts || "Pridať ďalší telefón / email"}
                        </Button>
                      </div>
                    )}
                    <div className="space-y-1 pl-1"><Label className="text-xs">{t.clinics.website}</Label>
                      <div className="flex gap-2">
                        <Input value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} placeholder="www.example.com" className="flex-1 h-9" data-testid="input-add-clinic-website" />
                        {formData.website && (<Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => window.open(getWebsiteUrl(formData.website), "_blank")}><ExternalLink className="h-4 w-4" /></Button>)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "address" && (
                <div className="space-y-4 pb-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1 sm:col-span-3 md:col-span-1">
                      <Label className="text-xs">{t.clinics.street}</Label>
                      <Input value={formData.street} onChange={(e) => setFormData({ ...formData, street: e.target.value })} placeholder={t.clinics.street} className="h-9" data-testid="input-add-clinic-street" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t.clinics.streetNumber}</Label>
                      <Input value={formData.streetNumber} onChange={(e) => setFormData({ ...formData, streetNumber: e.target.value })} placeholder="123" className="h-9" data-testid="input-add-clinic-street-number" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t.clinics.orientationNumber}</Label>
                      <Input value={formData.orientationNumber} onChange={(e) => setFormData({ ...formData, orientationNumber: e.target.value })} placeholder="4A" className="h-9" data-testid="input-add-clinic-orientation-number" />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1"><Label className="text-xs">{t.clinics.city}</Label><Input value={formData.city} onChange={(e) => { const newCity = e.target.value; const newRegion = getAutoRegion(formData.countryCode, newCity); const newDistrict = getAutoDistrict(formData.countryCode, newCity); setFormData({ ...formData, city: newCity, region: newRegion || formData.region, district: newDistrict || formData.district }); }} placeholder={t.clinics.city} className="h-9" data-testid="input-add-clinic-city" /></div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t.clinics.postalCode}</Label>
                      <div className="flex items-center gap-1">
                        <Input value={formData.postalCode} onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })} placeholder={t.clinics.postalCode} className="h-9 flex-1" data-testid="input-add-clinic-postalcode" />
                        <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={lookupPostalCode} disabled={postalLookupLoading || !formData.city} title={t.clinics.lookupPsc} data-testid="button-add-lookup-psc">
                          {postalLookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <Label className="text-xs">{t.clinics.ico}</Label>
                      <TooltipProvider><Tooltip><TooltipTrigger asChild><HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent className="max-w-xs"><p>{t.clinics.icoTip}</p></TooltipContent></Tooltip></TooltipProvider>
                    </div>
                    <Input value={formData.ico} onChange={(e) => setFormData({ ...formData, ico: e.target.value })} placeholder={t.clinics.ico} className="h-9" data-testid="input-add-clinic-ico" />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">{getGeoLabels(formData.countryCode).region}</Label>
                      <div className="flex items-center gap-1">
                        <Select value={formData.region || ""} onValueChange={(value) => setFormData({ ...formData, region: value, district: "" })}>
                          <SelectTrigger data-testid="select-add-clinic-region" className="h-9"><SelectValue placeholder={getGeoLabels(formData.countryCode).region} /></SelectTrigger>
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
                          streetNumber={[formData.street, [formData.streetNumber, formData.orientationNumber].filter(Boolean).join("/")].filter(Boolean).join(" ") || formData.address}
                          postalCode={formData.postalCode}
                          size="icon"
                          onSuggestion={(region, district) => setFormData({ ...formData, region, district })}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{getGeoLabels(formData.countryCode).district}</Label>
                      <Select value={formData.district || ""} onValueChange={(value) => setFormData({ ...formData, district: value })}>
                        <SelectTrigger data-testid="select-add-clinic-district" className="h-9"><SelectValue placeholder={getGeoLabels(formData.countryCode).district} /></SelectTrigger>
                        <SelectContent>
                          {getDistrictsForRegion(formData.countryCode, formData.region, formData.district).map((d: string) => (
                            <SelectItem key={d} value={d}>{d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-base font-medium">{t.clinics.gpsCoordinates}</Label>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={handleGetCurrentLocation} disabled={isLoadingLocation}>
                        <Navigation className={`h-4 w-4 mr-2 ${isLoadingLocation ? 'animate-spin' : ''}`} />
                        {isLoadingLocation ? t.common.loading : t.clinics.getCurrentLocation}
                      </Button>
                      {formData.latitude && formData.longitude && (
                        <Button type="button" variant="outline" size="sm" onClick={() => setShowMapDialog(true)}>
                          <ExternalLink className="h-4 w-4 mr-2" />{t.clinics.showOnMap}
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1"><Label className="text-xs">{t.clinics.latitude}</Label><Input type="number" step="0.0000001" value={formData.latitude} onChange={(e) => setFormData(prev => ({ ...prev, latitude: e.target.value }))} placeholder="48.7164" className="h-9" /></div>
                    <div className="space-y-1"><Label className="text-xs">{t.clinics.longitude}</Label><Input type="number" step="0.0000001" value={formData.longitude} onChange={(e) => setFormData(prev => ({ ...prev, longitude: e.target.value }))} placeholder="21.2611" className="h-9" /></div>
                  </div>
                  <div className="space-y-1"><Label className="text-xs">{t.clinics.notes}</Label><Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder={t.clinics.notes} rows={3} data-testid="input-add-clinic-notes" /></div>
                </div>
              )}

              {activeTab === "history" && (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <History className="h-10 w-10 mb-3 opacity-40" />
                  <p className="text-sm">{(t.clinics as any).noHistory || "History will be available after saving."}</p>
                </div>
              )}

              {activeTab === "personnel" && (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <Users className="h-10 w-10 mb-3 opacity-40" />
                  <p className="text-sm">{(t as any).medicalPartnerNetwork?.noPersonnel || "Personnel can be added after saving."}</p>
                </div>
              )}

              {activeTab === "campaigns" && (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <Megaphone className="h-10 w-10 mb-3 opacity-40" />
                  <p className="text-sm">{(t as any).campaigns?.noCampaigns || "Campaigns can be added after saving."}</p>
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 border-t bg-muted/30 px-5 py-3 flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-clinic-add">{t.common.cancel}</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-clinic-add">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
              {t.common.save}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      {mapDialog}
      {initialData?.id && (
        <SavePersonFromClinicDialog
          open={savePersonDialogOpen}
          onOpenChange={setSavePersonDialogOpen}
          clinic={initialData}
          formData={formData}
        />
      )}
      {nestedClinicForm && (
        <Sheet open={true} onOpenChange={(o) => { if (!o) setNestedClinicForm(null); }}>
          <SheetContent side="right" className="w-full sm:max-w-3xl p-0 overflow-hidden">
            <SheetHeader className="px-6 py-4 border-b">
              <SheetTitle>{(t.clinics as any).addNewDoctor || (t.collaborators as any).addPerson || "Add new doctor"}</SheetTitle>
            </SheetHeader>
            <div className="h-[calc(100vh-65px)] overflow-hidden">
              <CollaboratorFormWizard
                prefillData={{ lastName: nestedClinicForm.prefillName, countryCode: formData.countryCode || "SK" }}
                onSuccess={() => setNestedClinicForm(null)}
                onCancel={() => setNestedClinicForm(null)}
                onCreated={async (created) => { await handleNestedPersonCreatedForClinic(created); setNestedClinicForm(null); }}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}

function getLocalizedCategoryName(cat: any, locale: string): string {
  if (!cat) return "";
  const key = `name_${locale}`;
  return cat[key] || cat.name_en || cat.name || "";
}

function SavePersonFromClinicDialog({
  open,
  onOpenChange,
  clinic,
  formData,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinic: Clinic;
  formData: ClinicFormData;
}) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const [personData, setPersonData] = useState({
    titleBefore: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    mobile: "",
    categoryId: "",
    isPrimary: true,
  });

  useEffect(() => {
    if (open) {
      setPersonData({
        titleBefore: formData.doctorTitle || "",
        firstName: formData.doctorFirstName || "",
        lastName: formData.doctorLastName || "",
        email: formData.email || "",
        phone: formData.phone || "",
        mobile: "",
        categoryId: (clinic as any).doctorPositionCategoryId || "",
        isPrimary: true,
      });
    }
  }, [open, clinic.id]);

  const categoriesQuery = useQuery<any[]>({
    queryKey: ["/api/mpn/categories"],
    enabled: open,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const collab = await apiRequest("POST", "/api/collaborators", {
        titleBefore: personData.titleBefore.trim() || null,
        firstName: personData.firstName.trim(),
        lastName: personData.lastName.trim(),
        email: personData.email.trim() || null,
        phone: personData.phone.trim() || null,
        mobile: personData.mobile.trim() || null,
        countryCode: clinic.countryCode || "SK",
        collaboratorType: "doctor",
        isActive: true,
      });
      const collabData = await collab.json();

      const cat = (categoriesQuery.data || []).find((c: any) => c.id === personData.categoryId);
      const position = cat ? getLocalizedCategoryName(cat, locale) : null;

      try {
        await apiRequest("POST", `/api/institutions/clinic/${clinic.id}/personnel`, {
          personId: collabData.id,
          department: null,
          position,
          role: null,
          categoryId: personData.categoryId || null,
          isPrimary: personData.isPrimary,
        });
      } catch (assignErr: any) {
        const err: any = new Error(assignErr?.message || "Assignment failed");
        err.collaboratorCreated = true;
        err.collaboratorId = collabData.id;
        throw err;
      }

      return collabData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/institutions", "clinic", clinic.id, "personnel"] });
      queryClient.invalidateQueries({ queryKey: ["/api/collaborators"] });
      toast({ title: t.success?.saved || "Saved" });
      onOpenChange(false);
    },
    onError: (err: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/collaborators"] });
      if (err?.collaboratorCreated) {
        toast({
          title: t.success?.saved || "Person created",
          description: `Osoba bola uložená, ale priradenie k ambulancii zlyhalo: ${err.message}`,
          variant: "destructive",
        });
      } else {
        toast({ title: err?.message || "Error", variant: "destructive" });
      }
    },
  });

  const canSave = personData.firstName.trim().length > 0 && personData.lastName.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="dialog-title-save-person">
            <UserPlus className="h-5 w-5" />
            {(t.clinics.sections as any)?.saveAsPerson || "Uložiť ako osobu"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">{t.common.title || "Title"}</Label>
              <Input
                value={personData.titleBefore}
                onChange={(e) => setPersonData({ ...personData, titleBefore: e.target.value })}
                className="h-9"
                data-testid="input-person-title"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t.clinics.sections?.firstName || "First name"}</Label>
              <Input
                value={personData.firstName}
                onChange={(e) => setPersonData({ ...personData, firstName: e.target.value })}
                className="h-9"
                data-testid="input-person-firstname"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t.common.lastName || "Last name"}</Label>
              <Input
                value={personData.lastName}
                onChange={(e) => setPersonData({ ...personData, lastName: e.target.value })}
                className="h-9"
                data-testid="input-person-lastname"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">{t.clinics.email}</Label>
              <Input
                type="email"
                value={personData.email}
                onChange={(e) => setPersonData({ ...personData, email: e.target.value })}
                className="h-9"
                data-testid="input-person-email"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t.clinics.phone}</Label>
              <Input
                value={personData.phone}
                onChange={(e) => setPersonData({ ...personData, phone: e.target.value })}
                className="h-9"
                data-testid="input-person-phone"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{(t as any).medicalPartnerNetwork?.position || "Position"}</Label>
            <Select
              value={personData.categoryId}
              onValueChange={(v) => setPersonData({ ...personData, categoryId: v })}
            >
              <SelectTrigger className="h-9" data-testid="select-person-category">
                <SelectValue placeholder="-" />
              </SelectTrigger>
              <SelectContent>
                {(categoriesQuery.data || []).map((cat: any) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {getLocalizedCategoryName(cat, locale)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              id="person-is-primary"
              checked={personData.isPrimary}
              onCheckedChange={(v) => setPersonData({ ...personData, isPrimary: !!v })}
              data-testid="checkbox-person-primary"
            />
            <Label htmlFor="person-is-primary" className="text-sm cursor-pointer">
              {(t.common as any)?.primary || "Primary"}
            </Label>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-save-person">
            {t.common.cancel}
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!canSave || saveMutation.isPending}
            data-testid="button-confirm-save-person"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
            {t.common.save}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
