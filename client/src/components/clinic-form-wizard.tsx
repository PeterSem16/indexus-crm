import { useState, useEffect, useRef } from "react";
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
import { REGIONS_BY_COUNTRY, getAutoRegion } from "@/lib/regions";
import {
  Stethoscope, MapPin, ExternalLink, Navigation, Loader2, Search, Trash2, Plus, Network,
  Users, Save, X, UserPlus, Handshake, UserCheck, GraduationCap, Phone, Mail,
  Clock, ArrowRight, ArrowRightLeft, History, FileText, MessageSquare, Megaphone, PhoneCall,
  CalendarDays, FileSignature, Newspaper, CheckCircle2, CircleDot, Circle,
  Building2, ScrollText, Target, ShieldCheck, Ban, HelpCircle, ChevronRight,
  ChevronDown,
} from "lucide-react";
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
import { InstitutionPersonnelManager } from "@/components/institution-personnel-panel";
import EntityCampaignTimeline from "@/components/campaigns/EntityCampaignTimeline";
import { getQueryFn } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Settings as SettingsIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DateTimePicker } from "@/components/ui/date-time-picker";

interface ClinicFormData {
  name: string;
  doctorTitle: string;
  doctorFirstName: string;
  doctorLastName: string;
  address: string;
  city: string;
  postalCode: string;
  countryCode: string;
  region: string;
  phone: string;
  email: string;
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
}

function ClinicPersonnelTab({ clinicId, clinicName }: { clinicId: string; clinicName: string }) {
  const { t } = useI18n();
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
                      {row.category_name && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{row.category_name}</Badge>
                      )}
                      {row.is_primary && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-800 border-amber-300">{(t.common as any).primary || "Primary"}</Badge>
                      )}
                      {row.source === "legacy_link" && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-700">Link</Badge>
                      )}
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

export function ClinicFormSheet({ open, onOpenChange, initialData, onSuccess, mode = "sheet" }: ClinicFormSheetProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("source");
  const [showMapDialog, setShowMapDialog] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [pipelineMenuOpen, setPipelineMenuOpen] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const buildFormData = (data: Clinic | null | undefined): ClinicFormData => {
    if (!data) return {
      name: "", doctorTitle: "", doctorFirstName: "", doctorLastName: "",
      address: "", city: "", postalCode: "", countryCode: "", region: "",
      phone: "", email: "", website: "", latitude: "", longitude: "", isActive: true,
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
      address: data.address || "", city: data.city || "", postalCode: data.postalCode || "",
      countryCode: data.countryCode, region: (data as any).region || "", phone: data.phone || "", email: data.email || "",
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
  const [formData, setFormData] = useState<ClinicFormData>(() => buildFormData(initialData));

  const { data: allClinics } = useQuery<any[]>({ queryKey: ["/api/clinics/lookup"] });

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
  const [showNewDoctorForm, setShowNewDoctorForm] = useState<"recommendedBy" | "suggests" | null>(null);
  const [newDoctorData, setNewDoctorData] = useState({ title: "", firstName: "", lastName: "", clinicName: "", city: "", countryCode: formData.countryCode || "SK" });
  const userEditedReferralsRef = useRef(false);

  useEffect(() => {
    if (open) {
      setActiveTab("source");
      setReferrals([]);
      setSuggestsReferrals([]);
      setReferralSearch("");
      setSuggestsSearch("");
      setConfReferralSearch("");
      setShowNewDoctorForm(null);
      setNewDoctorData({ title: "", firstName: "", lastName: "", clinicName: "", city: "", countryCode: formData.countryCode || "SK" });
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

  const createNewDoctorAndAdd = async (direction: "recommendedBy" | "suggests") => {
    const { title, firstName, lastName, clinicName, city, countryCode } = newDoctorData;
    if (!lastName || !clinicName) {
      toast({ title: "Please fill in at least last name and clinic name", variant: "destructive" });
      return;
    }
    try {
      const doctorName = [title, firstName, lastName].filter(Boolean).join(" ");
      const res = await apiRequest("POST", "/api/clinics", {
        name: clinicName,
        doctorTitle: title || null,
        doctorFirstName: firstName || null,
        doctorLastName: lastName || null,
        doctorName: doctorName || null,
        city: city || null,
        countryCode: countryCode || formData.countryCode || "SK",
        leadSource: "new_contact",
      });
      const newClinic = await res.json();
      if (newClinic?.id) {
        userEditedReferralsRef.current = true;
        const displayName = doctorName || clinicName;
        if (direction === "recommendedBy") {
          setReferrals([...referrals, { clinicId: String(newClinic.id), clinicName: displayName, referralType: "doctor_referral" }]);
        } else {
          setSuggestsReferrals([...suggestsReferrals, { clinicId: String(newClinic.id), clinicName: displayName }]);
        }
        queryClient.invalidateQueries({ queryKey: ["/api/clinics"] });
        queryClient.invalidateQueries({ queryKey: ["/api/clinics/lookup"] });
        setNewDoctorData({ title: "", firstName: "", lastName: "", clinicName: "", city: "", countryCode: formData.countryCode || "SK" });
        setShowNewDoctorForm(null);
        toast({ title: t.success.saved });
      }
    } catch (e: any) {
      toast({ title: "Error creating doctor", description: e.message, variant: "destructive" });
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
      const payload = {
        name: data.name,
        doctorTitle: data.doctorTitle || null,
        doctorFirstName: data.doctorFirstName || null,
        doctorLastName: data.doctorLastName || null,
        doctorName: [data.doctorTitle, data.doctorFirstName, data.doctorLastName].filter(Boolean).join(" ") || null,
        address: data.address || null,
        city: data.city || null,
        postalCode: data.postalCode || null,
        countryCode: data.countryCode || "SK",
        region: data.region || null,
        phone: data.phone || null,
        email: data.email || null,
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
      return savedClinic;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinics"] });
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
    { key: "source", icon: CircleDot, label: t.clinics.steps?.source || "Lead Source" },
    { key: "basic", icon: Building2, label: t.clinics.steps?.basic || "Info" },
    { key: "address", icon: MapPin, label: t.clinics.steps?.address || "Address" },
    { key: "settings", icon: SettingsIcon, label: t.clinics.steps?.settings || "Settings" },
    { key: "history", icon: History, label: t.clinics.steps?.history || "History" },
    { key: "personnel", icon: Users, label: (t as any).medicalPartnerNetwork?.personnel || "Personnel" },
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
                            onOpenChange(false);
                            setLocation(`/email?${params.toString()}`);
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


          {mode === "inline" ? (
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
                                selected ? cn("border-2 shadow-sm", LEAD_SOURCE_COLORS[type]) : "hover:bg-muted/50 border-border",
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
                      <div className="grid gap-x-3 gap-y-2 grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-[11px]">{t.clinics.name} *</Label>
                          <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder={t.clinics.name} className="h-8 text-sm" data-testid="input-clinic-name" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">{t.common.country} *</Label>
                          <Select value={formData.countryCode} onValueChange={(value) => { const newRegion = getAutoRegion(value, formData.city); setFormData({ ...formData, countryCode: value, region: newRegion || "" }); }}>
                            <SelectTrigger data-testid="select-clinic-country" className="h-8 text-sm"><SelectValue placeholder={t.common.country} /></SelectTrigger>
                            <SelectContent>
                              {COUNTRIES.map((country) => (
                                <SelectItem key={country.code} value={country.code}>{getCountryFlag(country.code)} {country.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">{t.hospitals.region}</Label>
                          <Select value={formData.region || ""} onValueChange={(value) => setFormData({ ...formData, region: value })}>
                            <SelectTrigger data-testid="select-clinic-region" className="h-8 text-sm"><SelectValue placeholder={t.hospitals.region} /></SelectTrigger>
                            <SelectContent>
                              {(REGIONS_BY_COUNTRY[formData.countryCode] || []).map((r: string) => (
                                <SelectItem key={r} value={r}>{r}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
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
                        <div className="space-y-1">
                          <Label className="text-[11px]">{t.clinics.phone}</Label>
                          <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder={t.clinics.phone} className="h-8 text-sm" data-testid="input-clinic-phone" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">{t.clinics.email}</Label>
                          <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder={t.clinics.email} className="h-8 text-sm" data-testid="input-clinic-email" />
                        </div>
                      </div>
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
                      <div className="space-y-1">
                        <Label className="text-[11px]">{t.clinics.address}</Label>
                        <Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder={t.clinics.address} className="h-8 text-sm" data-testid="input-clinic-address" />
                      </div>
                      <div className="grid gap-x-3 gap-y-2 grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-[11px]">{t.clinics.city}</Label>
                          <Input value={formData.city} onChange={(e) => { const newCity = e.target.value; const newRegion = getAutoRegion(formData.countryCode, newCity); setFormData({ ...formData, city: newCity, region: newRegion || formData.region }); }} placeholder={t.clinics.city} className="h-8 text-sm" data-testid="input-clinic-city" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">{t.clinics.postalCode}</Label>
                          <Input value={formData.postalCode} onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })} placeholder={t.clinics.postalCode} className="h-8 text-sm" data-testid="input-clinic-postal" />
                        </div>
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
                        Hovory & Zmluva
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
                        <Label className="text-[11px]">Poznámka</Label>
                        <Textarea value={formData.lastCallNote} onChange={(e) => setFormData({ ...formData, lastCallNote: e.target.value })} placeholder="Poznámka z hovoru" rows={2} className="text-sm" data-testid="input-last-call-note" />
                      </div>
                      <Separator className="my-1" />
                      <div className="grid gap-x-3 gap-y-2 grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-[11px]">Zmluva odoslaná</Label>
                          <DateTimePicker value={formData.contractSentDate} onChange={(v) => setFormData({ ...formData, contractSentDate: v })} countryCode={formData.countryCode || "SK"} includeTime={false} data-testid="input-contract-sent-date" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">Zmluva vrátená</Label>
                          <DateTimePicker value={formData.contractReturnedDate} onChange={(v) => setFormData({ ...formData, contractReturnedDate: v })} countryCode={formData.countryCode || "SK"} includeTime={false} data-testid="input-contract-returned-date" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="lg:col-span-2">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
                        <div className="p-1 rounded-md bg-gray-100 dark:bg-gray-800"><FileText className="h-3 w-3 text-gray-600 dark:text-gray-400" /></div>
                        {t.clinics.steps?.settings || "Settings"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-xs">{t.clinics.isActive || "Aktívna"}</Label>
                          <p className="text-[10px] text-muted-foreground">{t.clinics.isActiveDesc || "Clinic is active"}</p>
                        </div>
                        <Switch checked={formData.isActive} onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })} data-testid="switch-clinic-active" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">{t.clinics.notes}</Label>
                        <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder={t.clinics.notes} rows={2} className="text-sm" data-testid="input-clinic-notes" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="px-6">
            <TabsList className={cn("grid w-full h-auto p-1 gap-0.5", initialData ? "grid-cols-6" : "grid-cols-4")}>
              <TabsTrigger value="source" data-testid="tab-clinic-source" className="text-xs px-2 py-1.5 data-[state=active]:shadow-sm">
                <CircleDot className="h-3 w-3 mr-1 hidden sm:inline" />
                {t.clinics.steps?.source || "Lead Source"}
              </TabsTrigger>
              <TabsTrigger value="basic" data-testid="tab-clinic-basic" className="text-xs px-2 py-1.5 data-[state=active]:shadow-sm">
                <Building2 className="h-3 w-3 mr-1 hidden sm:inline" />
                {t.clinics.steps?.basic || "Info"}
              </TabsTrigger>
              <TabsTrigger value="address" data-testid="tab-clinic-address" className="text-xs px-2 py-1.5 data-[state=active]:shadow-sm">
                <MapPin className="h-3 w-3 mr-1 hidden sm:inline" />
                {t.clinics.steps?.address || "Address"}
              </TabsTrigger>
              {initialData && (
                <TabsTrigger value="history" data-testid="tab-clinic-history" className="text-xs px-2 py-1.5 data-[state=active]:shadow-sm">
                  <History className="h-3 w-3 mr-1 hidden sm:inline" />
                  {t.clinics.steps?.history || "History"}
                </TabsTrigger>
              )}
              <TabsTrigger value="settings" data-testid="tab-clinic-settings" className="text-xs px-2 py-1.5 data-[state=active]:shadow-sm">
                <FileText className="h-3 w-3 mr-1 hidden sm:inline" />
                {t.clinics.steps?.settings || "Settings"}
              </TabsTrigger>
              {initialData && (
                <TabsTrigger value="personnel" data-testid="tab-clinic-personnel" className="text-xs px-2 py-1.5 data-[state=active]:shadow-sm">
                  <Users className="h-3 w-3 mr-1 hidden sm:inline" />
                  {(t as any).medicalPartnerNetwork?.personnel || "Personnel"}
                </TabsTrigger>
              )}
            </TabsList>

            {/* ===== LEAD SOURCE TAB ===== */}
            <TabsContent value="source" className="space-y-4 mt-4 pb-4">
              {/* Lead Source cards — clicking opens pipeline submenu */}
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
                        <button
                          type="button"
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 border rounded-lg cursor-pointer transition-all w-full text-left",
                            selected ? cn("border-2 shadow-sm", LEAD_SOURCE_COLORS[type]) : "hover:bg-muted/50 border-border",
                            isExpanded && "rounded-b-none"
                          )}
                          onClick={() => {
                            if (selected) {
                              setPipelineMenuOpen(!pipelineMenuOpen);
                              setExpandedCategory(null);
                            } else {
                              setFormData(prev => ({ ...prev, leadSource: type }));
                              setPipelineMenuOpen(true);
                              setExpandedCategory(null);
                            }
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

                        {/* Pipeline submenu — opens below selected lead source */}
                        {isExpanded && (
                          <div className="border border-t-0 rounded-b-lg bg-muted/20 dark:bg-muted/10 overflow-hidden" data-testid="pipeline-submenu">
                            {PIPELINE_CATEGORIES.map((cat) => {
                              const CatIcon = cat.icon;
                              const isCatExpanded = expandedCategory === cat.key;
                              const selectedInCat = cat.options.find(o => o.value === currentPipelineValue);
                              return (
                                <div key={cat.key}>
                                  <button
                                    type="button"
                                    className={cn(
                                      "flex items-center gap-2.5 w-full px-4 py-2.5 text-left transition-all hover:bg-muted/50",
                                      isCatExpanded && "bg-muted/40",
                                      selectedInCat && "bg-primary/5"
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
                                      )}>
                                        {(t.clinics as any).pipeline?.[selectedInCat.labelKey] || selectedInCat.labelKey}
                                      </span>
                                    )}
                                    <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0", isCatExpanded && "rotate-90")} />
                                  </button>

                                  {isCatExpanded && (
                                    <div className="px-4 pb-2 pt-1 space-y-1">
                                      {cat.options.map((opt) => {
                                        const OptIcon = opt.icon;
                                        const isSelected = currentPipelineValue === opt.value;
                                        return (
                                          <button
                                            key={opt.value}
                                            type="button"
                                            className={cn(
                                              "flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-left transition-all",
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
                    setPipelineMenuOpen(false);
                    setExpandedCategory(null);
                  }} data-testid="button-clear-source">
                    <X className="h-3 w-3 mr-1" /> {(t.clinics as any).pipeline?.clearSelection || t.common.clear || "Clear"}
                  </Button>
                )}
              </div>

              <Separator />

              {/* Doctor Referral & Conference */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex items-center justify-center w-6 h-6 rounded-md bg-purple-100 dark:bg-purple-900">
                    <UserCheck className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="text-sm font-semibold tracking-wide">{(t.clinics as any).pipeline?.referralAndConference || "Referral & Conference"}</h3>
                </div>

                {/* Doctor Referral */}
                <div className={cn("border rounded-lg px-3 py-2.5 transition-all cursor-pointer", formData.isReferredByDoctor ? cn("border-2 shadow-sm", LEAD_SOURCE_COLORS.doctor_referral) : "hover:bg-muted/50 border-border")}
                  onClick={() => setFormData({ ...formData, isReferredByDoctor: !formData.isReferredByDoctor })} >
                  <div className="flex items-center gap-3">
                    <div className={cn("flex items-center justify-center w-8 h-8 rounded-lg shrink-0", LEAD_SOURCE_ICON_BG.doctor_referral)}>
                      <UserCheck className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{t.clinics.leadSourceTypes?.doctor_referral || "Doctor referral"}</div>
                    </div>
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
                            {showNewDoctorForm !== "recommendedBy" ? (
                              <Button type="button" variant="outline" size="sm" className="text-xs gap-1" onClick={() => { setShowNewDoctorForm("recommendedBy"); setNewDoctorData({ title: "", firstName: "", lastName: "", clinicName: "", city: "", countryCode: formData.countryCode || "SK" }); }} data-testid="button-add-new-doctor-recommended">
                                <UserPlus className="h-3.5 w-3.5" /> {(t.clinics as any).addNewDoctor || "Add new doctor"}
                              </Button>
                            ) : (
                              <div className="border rounded-lg p-3 bg-white dark:bg-background space-y-2">
                                <div className="grid gap-2 grid-cols-3">
                                  <Input value={newDoctorData.title} onChange={(e) => setNewDoctorData({ ...newDoctorData, title: e.target.value })} placeholder="MUDr." className="h-8 text-xs" />
                                  <Input value={newDoctorData.firstName} onChange={(e) => setNewDoctorData({ ...newDoctorData, firstName: e.target.value })} placeholder={t.clinics.doctorFirstName || "First name"} className="h-8 text-xs" />
                                  <Input value={newDoctorData.lastName} onChange={(e) => setNewDoctorData({ ...newDoctorData, lastName: e.target.value })} placeholder={t.clinics.doctorLastName || "Last name *"} className="h-8 text-xs" />
                                </div>
                                <div className="grid gap-2 grid-cols-2">
                                  <Input value={newDoctorData.clinicName} onChange={(e) => setNewDoctorData({ ...newDoctorData, clinicName: e.target.value })} placeholder={t.clinics.name + " *"} className="h-8 text-xs" />
                                  <Input value={newDoctorData.city} onChange={(e) => setNewDoctorData({ ...newDoctorData, city: e.target.value })} placeholder={t.clinics.city || "City"} className="h-8 text-xs" />
                                </div>
                                <div className="flex gap-2">
                                  <Button type="button" size="sm" className="h-7 text-xs gap-1" onClick={() => createNewDoctorAndAdd("recommendedBy")}><Plus className="h-3 w-3" /> {t.common.save || "Save"}</Button>
                                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowNewDoctorForm(null)}>{t.common.cancel || "Cancel"}</Button>
                                </div>
                              </div>
                            )}
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
                            {showNewDoctorForm !== "suggests" ? (
                              <Button type="button" variant="outline" size="sm" className="text-xs gap-1" onClick={() => { setShowNewDoctorForm("suggests"); setNewDoctorData({ title: "", firstName: "", lastName: "", clinicName: "", city: "", countryCode: formData.countryCode || "SK" }); }} data-testid="button-add-new-doctor-suggests">
                                <UserPlus className="h-3.5 w-3.5" /> {(t.clinics as any).addNewDoctor || "Add new doctor"}
                              </Button>
                            ) : (
                              <div className="border rounded-lg p-3 bg-white dark:bg-background space-y-2">
                                <div className="grid gap-2 grid-cols-3">
                                  <Input value={newDoctorData.title} onChange={(e) => setNewDoctorData({ ...newDoctorData, title: e.target.value })} placeholder="MUDr." className="h-8 text-xs" />
                                  <Input value={newDoctorData.firstName} onChange={(e) => setNewDoctorData({ ...newDoctorData, firstName: e.target.value })} placeholder={t.clinics.doctorFirstName || "First name"} className="h-8 text-xs" />
                                  <Input value={newDoctorData.lastName} onChange={(e) => setNewDoctorData({ ...newDoctorData, lastName: e.target.value })} placeholder={t.clinics.doctorLastName || "Last name *"} className="h-8 text-xs" />
                                </div>
                                <div className="grid gap-2 grid-cols-2">
                                  <Input value={newDoctorData.clinicName} onChange={(e) => setNewDoctorData({ ...newDoctorData, clinicName: e.target.value })} placeholder={t.clinics.name + " *"} className="h-8 text-xs" />
                                  <Input value={newDoctorData.city} onChange={(e) => setNewDoctorData({ ...newDoctorData, city: e.target.value })} placeholder={t.clinics.city || "City"} className="h-8 text-xs" />
                                </div>
                                <div className="flex gap-2">
                                  <Button type="button" size="sm" className="h-7 text-xs gap-1" onClick={() => createNewDoctorAndAdd("suggests")}><Plus className="h-3 w-3" /> {t.common.save || "Save"}</Button>
                                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowNewDoctorForm(null)}>{t.common.cancel || "Cancel"}</Button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Conference */}
                <div className={cn("border rounded-lg px-3 py-2.5 transition-all cursor-pointer", formData.isFromConference ? cn("border-2 shadow-sm", LEAD_SOURCE_COLORS.conference) : "hover:bg-muted/50 border-border")}
                  onClick={() => setFormData({ ...formData, isFromConference: !formData.isFromConference })} >
                  <div className="flex items-center gap-3">
                    <div className={cn("flex items-center justify-center w-8 h-8 rounded-lg shrink-0", LEAD_SOURCE_ICON_BG.conference)}>
                      <GraduationCap className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{t.clinics.leadSourceTypes?.conference || "Conference / Seminar"}</div>
                    </div>
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
                            <div>
                              <span className="font-medium text-sm">{getDoctorFullName(clinic as any) || clinic.name}</span>
                              <span className="text-sm text-muted-foreground ml-2">{clinic.city || ""}</span>
                            </div>
                            <Plus className="h-4 w-4 text-muted-foreground" />
                          </div>
                        ))}
                      </div>
                    )}
                    {conferenceReferrals.length > 0 ? (
                      <div className="space-y-1.5">
                        {conferenceReferrals.map((ref) => (
                          <div key={ref.clinicId} className="flex items-center justify-between px-3 py-1.5 border rounded-lg bg-rose-50/50 dark:bg-rose-950/30">
                            <div className="flex items-center gap-2">
                              <GraduationCap className="h-3.5 w-3.5 text-rose-500" />
                              <span className="text-sm font-medium">{ref.clinicName}</span>
                            </div>
                            <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeReferral(ref.clinicId)} data-testid={`remove-conf-referral-${ref.clinicId}`}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic pl-1">{t.clinics.noReferrals}</p>
                    )}
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
            </TabsContent>

            {/* ===== BASIC INFO TAB ===== */}
            <TabsContent value="basic" className="space-y-5 mt-4 pb-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-900">
                    <Building2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-sm font-semibold tracking-wide">{t.clinics.sections?.clinic || 'Clinic'}</h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 pl-1">
                  <div className="space-y-1">
                    <Label className="text-xs">{t.clinics.name} *</Label>
                    <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder={t.clinics.name} className="h-9" data-testid="input-clinic-name" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t.common.country} *</Label>
                    <Select value={formData.countryCode} onValueChange={(value) => setFormData({ ...formData, countryCode: value })}>
                      <SelectTrigger data-testid="select-clinic-country" className="h-9">
                        <SelectValue placeholder={t.common.country} />
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
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-md bg-purple-100 dark:bg-purple-900">
                    <Stethoscope className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="text-sm font-semibold tracking-wide">{t.clinics.sections?.doctor || 'Doctor'}</h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-3 pl-1">
                  <div className="space-y-1">
                    <Label className="text-xs">{t.common.title || "Title"}</Label>
                    <Input value={formData.doctorTitle} onChange={(e) => setFormData({ ...formData, doctorTitle: e.target.value })} placeholder="MUDr." className="h-9" data-testid="input-doctor-title" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t.clinics.sections?.firstName || "First name"}</Label>
                    <Input value={formData.doctorFirstName} onChange={(e) => setFormData({ ...formData, doctorFirstName: e.target.value })} placeholder={t.clinics.sections?.firstName || "First name"} className="h-9" data-testid="input-doctor-firstname" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t.common.lastName || "Last name"}</Label>
                    <Input value={formData.doctorLastName} onChange={(e) => setFormData({ ...formData, doctorLastName: e.target.value })} placeholder={t.common.lastName || "Last name"} className="h-9" data-testid="input-doctor-lastname" />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-md bg-sky-100 dark:bg-sky-900">
                    <Phone className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                  </div>
                  <h3 className="text-sm font-semibold tracking-wide">{t.clinics.sections?.contact || 'Contact'}</h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 pl-1">
                  <div className="space-y-1">
                    <Label className="text-xs">{t.clinics.phone}</Label>
                    <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder={t.clinics.phone} className="h-9" data-testid="input-clinic-phone" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t.clinics.email}</Label>
                    <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder={t.clinics.email} className="h-9" data-testid="input-clinic-email" />
                  </div>
                </div>
                <div className="space-y-1 pl-1">
                  <Label className="text-xs">{t.clinics.website}</Label>
                  <div className="flex gap-2">
                    <Input value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} placeholder="www.example.com" className="flex-1 h-9" data-testid="input-clinic-website" />
                    {formData.website && (
                      <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => window.open(getWebsiteUrl(formData.website), "_blank")} data-testid="button-open-website">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-md bg-emerald-100 dark:bg-emerald-900">
                    <PhoneCall className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="text-sm font-semibold tracking-wide">{t.clinics.sections?.callsAndContact || 'Calls & Contact'}</h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 pl-1">
                  <div className="space-y-1">
                    <Label className="text-xs">{(t.clinics as any).lastCallResult || "Last call result"}</Label>
                    <Input value={formData.lastCallResult} onChange={(e) => setFormData({ ...formData, lastCallResult: e.target.value })} placeholder={(t.clinics as any).lastCallResult || "Last call result"} className="h-9" data-testid="input-last-call-result" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t.clinics.sections?.nextContactDate || "Next contact date"}</Label>
                    <DateTimePicker value={formData.nextContactDate} onChange={(v) => setFormData({ ...formData, nextContactDate: v })} countryCode={formData.countryCode || "SK"} includeTime={false} data-testid="input-next-contact-date" />
                  </div>
                </div>
                <div className="space-y-1 pl-1">
                  <Label className="text-xs">Poznámka z hovoru</Label>
                  <Textarea value={formData.lastCallNote} onChange={(e) => setFormData({ ...formData, lastCallNote: e.target.value })} placeholder="Poznámka z posledného hovoru" rows={2} className="text-sm" data-testid="input-last-call-note" />
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-md bg-amber-100 dark:bg-amber-900">
                    <FileSignature className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <h3 className="text-sm font-semibold tracking-wide">Zmluva</h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 pl-1">
                  <div className="space-y-1">
                    <Label className="text-xs">Dátum odoslania zmluvy</Label>
                    <DateTimePicker value={formData.contractSentDate} onChange={(v) => setFormData({ ...formData, contractSentDate: v })} countryCode={formData.countryCode || "SK"} includeTime={false} data-testid="input-contract-sent-date" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Dátum vrátenia zmluvy</Label>
                    <DateTimePicker value={formData.contractReturnedDate} onChange={(v) => setFormData({ ...formData, contractReturnedDate: v })} countryCode={formData.countryCode || "SK"} includeTime={false} data-testid="input-contract-returned-date" />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-md bg-rose-100 dark:bg-rose-900">
                    <Newspaper className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                  </div>
                  <h3 className="text-sm font-semibold tracking-wide">Letáky & Postery</h3>
                </div>
                <div className="pl-1 space-y-2">
                  <div className={cn("flex items-center gap-3 px-3 py-2.5 border rounded-lg cursor-pointer transition-all",
                    formData.hasFlyers ? "border-2 shadow-sm bg-rose-50 border-rose-200 dark:bg-rose-950 dark:border-rose-800" : "hover:bg-muted/50 border-border"
                  )} onClick={() => setFormData({ ...formData, hasFlyers: !formData.hasFlyers })}>
                    <Checkbox checked={formData.hasFlyers} onCheckedChange={(checked) => setFormData({ ...formData, hasFlyers: !!checked })} data-testid="checkbox-flyers" onClick={(e) => e.stopPropagation()} />
                    <span className="text-sm font-medium">Umiestnenie letákov / posterov</span>
                  </div>
                  {formData.hasFlyers && (
                    <div className="ml-3 pl-3 border-l-2 border-rose-200 dark:border-rose-800 space-y-2">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Dátum odoslania</Label>
                          <DateTimePicker value={formData.flyersSentDate} onChange={(v) => setFormData({ ...formData, flyersSentDate: v })} countryCode={formData.countryCode || "SK"} includeTime={false} data-testid="input-flyers-sent-date" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Umiestnenie</Label>
                          <Input value={formData.flyersLocation} onChange={(e) => setFormData({ ...formData, flyersLocation: e.target.value })} placeholder="Kde boli umiestnené" className="h-9" data-testid="input-flyers-location" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ===== ADDRESS TAB ===== */}
            <TabsContent value="address" className="space-y-4 mt-4 pb-4">
              <div className="space-y-1">
                <Label className="text-xs">{t.clinics.address}</Label>
                <Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder={t.clinics.address} className="h-9" data-testid="input-clinic-address" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">{t.clinics.city}</Label>
                  <Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} placeholder={t.clinics.city} className="h-9" data-testid="input-clinic-city" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t.clinics.postalCode}</Label>
                  <Input value={formData.postalCode} onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })} placeholder={t.clinics.postalCode} className="h-9" data-testid="input-clinic-postal" />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-xs">{t.clinics.gpsCoordinates || "GPS suradnice"}</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">{t.clinics.latitude || "Zemepisna sirka"}</Label>
                    <Input value={formData.latitude} onChange={(e) => setFormData({ ...formData, latitude: e.target.value })} placeholder="48.1486" className="h-9" data-testid="input-clinic-lat" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">{t.clinics.longitude || "Longitude"}</Label>
                    <Input value={formData.longitude} onChange={(e) => setFormData({ ...formData, longitude: e.target.value })} placeholder="17.1077" className="h-9" data-testid="input-clinic-lng" />
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <Button type="button" variant="outline" size="sm" onClick={handleGetCurrentLocation} disabled={isLoadingLocation} data-testid="button-get-gps">
                    {isLoadingLocation ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Navigation className="h-4 w-4 mr-2" />}
                    {t.clinics.getCurrentLocation || "Get current location"}
                  </Button>
                  {formData.latitude && formData.longitude && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowMapDialog(true)} data-testid="button-show-map">
                      <MapPin className="h-4 w-4 mr-2" />
                      {t.clinics.showOnMap || "Show on map"}
                    </Button>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ===== SETTINGS TAB ===== */}
            <TabsContent value="settings" className="space-y-4 mt-4 pb-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label>{t.clinics.isActive || "Active clinic"}</Label>
                  <p className="text-sm text-muted-foreground">{t.clinics.isActiveDesc || "Clinic is active and shown in lists"}</p>
                </div>
                <Switch checked={formData.isActive} onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })} data-testid="switch-clinic-active" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t.clinics.notes}</Label>
                <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder={t.clinics.notes} rows={6} data-testid="input-clinic-notes" />
              </div>
            </TabsContent>

            {/* ===== HISTORY TAB ===== */}
            {initialData && (
              <TabsContent value="history" className="mt-4 pb-4" data-testid="tab-content-history">
                {eventsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
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
                            <div className={cn("relative z-10 flex items-center justify-center w-6 h-6 rounded-full shrink-0 -ml-6", iconColor)}>
                              <IconComp className="h-3 w-3" />
                            </div>
                            <div className="flex-1 min-w-0 pt-0.5">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium leading-tight">{event.title}</p>
                                  {event.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{event.description}</p>}
                                </div>
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
              </TabsContent>
            )}
            {initialData && (
              <TabsContent value="personnel" className="space-y-4 mt-4 pb-4">
                <ClinicPersonnelTab clinicId={initialData.id} clinicName={initialData.name} />
              </TabsContent>
            )}
          </Tabs>
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-clinic">
              {t.common.cancel}
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-clinic">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {t.common.save}
            </Button>
          </div>
    </>
  );

  const mapDialog = (
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
  );

  if (mode === "inline") {
    return (
      <div className="flex flex-col h-full overflow-y-auto">
        {formContent}
        {mapDialog}
      </div>
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
                              onOpenChange(false);
                              setLocation(`/email?${params.toString()}`);
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
                {activeTab === "source" && (
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
                              <button type="button" className={cn("flex items-center gap-3 px-3 py-2.5 border rounded-lg cursor-pointer transition-all w-full text-left", selected ? cn("border-2 shadow-sm", LEAD_SOURCE_COLORS[type]) : "hover:bg-muted/50 border-border", isExpanded && "rounded-b-none")}
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
                                  {showNewDoctorForm !== "recommendedBy" ? (
                                    <Button type="button" variant="outline" size="sm" className="text-xs gap-1" onClick={() => { setShowNewDoctorForm("recommendedBy"); setNewDoctorData({ title: "", firstName: "", lastName: "", clinicName: "", city: "", countryCode: formData.countryCode || "SK" }); }} data-testid="button-add-new-doctor-recommended">
                                      <UserPlus className="h-3.5 w-3.5" /> {(t.clinics as any).addNewDoctor || "Add new doctor"}
                                    </Button>
                                  ) : (
                                    <div className="border rounded-lg p-3 bg-white dark:bg-background space-y-2">
                                      <div className="grid gap-2 grid-cols-3">
                                        <Input value={newDoctorData.title} onChange={(e) => setNewDoctorData({ ...newDoctorData, title: e.target.value })} placeholder="MUDr." className="h-8 text-xs" data-testid="input-new-doctor-title" />
                                        <Input value={newDoctorData.firstName} onChange={(e) => setNewDoctorData({ ...newDoctorData, firstName: e.target.value })} placeholder={t.clinics.doctorFirstName || "First name"} className="h-8 text-xs" data-testid="input-new-doctor-firstname" />
                                        <Input value={newDoctorData.lastName} onChange={(e) => setNewDoctorData({ ...newDoctorData, lastName: e.target.value })} placeholder={t.clinics.doctorLastName || "Last name *"} className="h-8 text-xs" data-testid="input-new-doctor-lastname" />
                                      </div>
                                      <div className="grid gap-2 grid-cols-2">
                                        <Input value={newDoctorData.clinicName} onChange={(e) => setNewDoctorData({ ...newDoctorData, clinicName: e.target.value })} placeholder={t.clinics.name + " *" || "Clinic name *"} className="h-8 text-xs" data-testid="input-new-doctor-clinic" />
                                        <Input value={newDoctorData.city} onChange={(e) => setNewDoctorData({ ...newDoctorData, city: e.target.value })} placeholder={t.clinics.city || "City"} className="h-8 text-xs" data-testid="input-new-doctor-city" />
                                      </div>
                                      <div className="flex gap-2">
                                        <Button type="button" size="sm" className="h-7 text-xs gap-1" onClick={() => createNewDoctorAndAdd("recommendedBy")} data-testid="button-save-new-doctor-recommended">
                                          <Plus className="h-3 w-3" /> {t.common.save || "Save"}
                                        </Button>
                                        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowNewDoctorForm(null)} data-testid="button-cancel-new-doctor">
                                          {t.common.cancel || "Cancel"}
                                        </Button>
                                      </div>
                                    </div>
                                  )}
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
                                  {showNewDoctorForm !== "suggests" ? (
                                    <Button type="button" variant="outline" size="sm" className="text-xs gap-1" onClick={() => { setShowNewDoctorForm("suggests"); setNewDoctorData({ title: "", firstName: "", lastName: "", clinicName: "", city: "", countryCode: formData.countryCode || "SK" }); }} data-testid="button-add-new-doctor-suggests">
                                      <UserPlus className="h-3.5 w-3.5" /> {(t.clinics as any).addNewDoctor || "Add new doctor"}
                                    </Button>
                                  ) : (
                                    <div className="border rounded-lg p-3 bg-white dark:bg-background space-y-2">
                                      <div className="grid gap-2 grid-cols-3">
                                        <Input value={newDoctorData.title} onChange={(e) => setNewDoctorData({ ...newDoctorData, title: e.target.value })} placeholder="MUDr." className="h-8 text-xs" data-testid="input-new-doctor-title-s" />
                                        <Input value={newDoctorData.firstName} onChange={(e) => setNewDoctorData({ ...newDoctorData, firstName: e.target.value })} placeholder={t.clinics.doctorFirstName || "First name"} className="h-8 text-xs" data-testid="input-new-doctor-firstname-s" />
                                        <Input value={newDoctorData.lastName} onChange={(e) => setNewDoctorData({ ...newDoctorData, lastName: e.target.value })} placeholder={t.clinics.doctorLastName || "Last name *"} className="h-8 text-xs" data-testid="input-new-doctor-lastname-s" />
                                      </div>
                                      <div className="grid gap-2 grid-cols-2">
                                        <Input value={newDoctorData.clinicName} onChange={(e) => setNewDoctorData({ ...newDoctorData, clinicName: e.target.value })} placeholder={t.clinics.name + " *" || "Clinic name *"} className="h-8 text-xs" data-testid="input-new-doctor-clinic-s" />
                                        <Input value={newDoctorData.city} onChange={(e) => setNewDoctorData({ ...newDoctorData, city: e.target.value })} placeholder={t.clinics.city || "City"} className="h-8 text-xs" data-testid="input-new-doctor-city-s" />
                                      </div>
                                      <div className="flex gap-2">
                                        <Button type="button" size="sm" className="h-7 text-xs gap-1" onClick={() => createNewDoctorAndAdd("suggests")} data-testid="button-save-new-doctor-suggests">
                                          <Plus className="h-3 w-3" /> {t.common.save || "Save"}
                                        </Button>
                                        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowNewDoctorForm(null)} data-testid="button-cancel-new-doctor-s">
                                          {t.common.cancel || "Cancel"}
                                        </Button>
                                      </div>
                                    </div>
                                  )}
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
                    {formData.leadSource && (
                      <>
                        <Separator />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1"><Label className="text-xs">{t.clinics.leadSourceDate}</Label><DateTimePicker value={formData.leadSourceDate} onChange={(v) => setFormData({ ...formData, leadSourceDate: v })} countryCode={formData.countryCode || "SK"} includeTime={false} data-testid="input-lead-source-date" /></div>
                        </div>
                        <div className="space-y-1"><Label className="text-xs">{t.clinics.leadSourceNotes}</Label><Textarea value={formData.leadSourceNotes} onChange={(e) => setFormData({ ...formData, leadSourceNotes: e.target.value })} placeholder={t.clinics.leadSourceNotes} rows={2} data-testid="input-lead-source-notes" /></div>
                      </>
                    )}
                  </div>
                )}

                {activeTab === "basic" && (
                  <div className="space-y-5 pb-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2"><div className="flex items-center justify-center w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-900"><Building2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /></div><h3 className="text-sm font-semibold tracking-wide">{t.clinics.sections?.clinic || 'Clinic'}</h3></div>
                      <div className="grid gap-3 sm:grid-cols-2 pl-1">
                        <div className="space-y-1"><Label className="text-xs">{t.clinics.name} *</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder={t.clinics.name} className="h-9" data-testid="input-clinic-name" /></div>
                        <div className="space-y-1"><Label className="text-xs">{t.common.country} *</Label>
                          <Select value={formData.countryCode} onValueChange={(value) => setFormData({ ...formData, countryCode: value })}>
                            <SelectTrigger data-testid="select-clinic-country" className="h-9"><SelectValue placeholder={t.common.country} /></SelectTrigger>
                            <SelectContent>{COUNTRIES.map((country) => (<SelectItem key={country.code} value={country.code}>{getCountryFlag(country.code)} {country.name}</SelectItem>))}</SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-3">
                      <div className="flex items-center gap-2"><div className="flex items-center justify-center w-6 h-6 rounded-md bg-purple-100 dark:bg-purple-900"><Stethoscope className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" /></div><h3 className="text-sm font-semibold tracking-wide">{t.clinics.sections?.doctor || 'Doctor'}</h3></div>
                      <div className="grid gap-3 sm:grid-cols-3 pl-1">
                        <div className="space-y-1"><Label className="text-xs">{t.common.title || "Title"}</Label><Input value={formData.doctorTitle} onChange={(e) => setFormData({ ...formData, doctorTitle: e.target.value })} placeholder="MUDr." className="h-9" data-testid="input-doctor-title" /></div>
                        <div className="space-y-1"><Label className="text-xs">{t.clinics.sections?.firstName || "First name"}</Label><Input value={formData.doctorFirstName} onChange={(e) => setFormData({ ...formData, doctorFirstName: e.target.value })} placeholder={t.clinics.sections?.firstName || "First name"} className="h-9" data-testid="input-doctor-firstname" /></div>
                        <div className="space-y-1"><Label className="text-xs">{t.common.lastName || "Last name"}</Label><Input value={formData.doctorLastName} onChange={(e) => setFormData({ ...formData, doctorLastName: e.target.value })} placeholder={t.common.lastName || "Last name"} className="h-9" data-testid="input-doctor-lastname" /></div>
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-3">
                      <div className="flex items-center gap-2"><div className="flex items-center justify-center w-6 h-6 rounded-md bg-sky-100 dark:bg-sky-900"><Phone className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" /></div><h3 className="text-sm font-semibold tracking-wide">{t.clinics.sections?.contact || 'Contact'}</h3></div>
                      <div className="grid gap-3 sm:grid-cols-2 pl-1">
                        <div className="space-y-1"><Label className="text-xs">{t.clinics.phone}</Label><Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder={t.clinics.phone} className="h-9" data-testid="input-clinic-phone" /></div>
                        <div className="space-y-1"><Label className="text-xs">{t.clinics.email}</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder={t.clinics.email} className="h-9" data-testid="input-clinic-email" /></div>
                      </div>
                      <div className="space-y-1 pl-1"><Label className="text-xs">{t.clinics.website}</Label>
                        <div className="flex gap-2">
                          <Input value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} placeholder="www.example.com" className="flex-1 h-9" data-testid="input-clinic-website" />
                          {formData.website && (<Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => window.open(getWebsiteUrl(formData.website), "_blank")} data-testid="button-open-website"><ExternalLink className="h-4 w-4" /></Button>)}
                        </div>
                      </div>
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
                      <div className="flex items-center gap-2"><div className="flex items-center justify-center w-6 h-6 rounded-md bg-amber-100 dark:bg-amber-900"><FileSignature className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" /></div><h3 className="text-sm font-semibold tracking-wide">Zmluva</h3></div>
                      <div className="grid gap-3 sm:grid-cols-2 pl-1">
                        <div className="space-y-1"><Label className="text-xs">Dátum odoslania zmluvy</Label><DateTimePicker value={formData.contractSentDate} onChange={(v) => setFormData({ ...formData, contractSentDate: v })} countryCode={formData.countryCode || "SK"} includeTime={false} data-testid="input-contract-sent-date" /></div>
                        <div className="space-y-1"><Label className="text-xs">Dátum vrátenia zmluvy</Label><DateTimePicker value={formData.contractReturnedDate} onChange={(v) => setFormData({ ...formData, contractReturnedDate: v })} countryCode={formData.countryCode || "SK"} includeTime={false} data-testid="input-contract-returned-date" /></div>
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-3">
                      <div className="flex items-center gap-2"><div className="flex items-center justify-center w-6 h-6 rounded-md bg-rose-100 dark:bg-rose-900"><Newspaper className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" /></div><h3 className="text-sm font-semibold tracking-wide">Letáky & Postery</h3></div>
                      <div className="pl-1 space-y-2">
                        <div className={cn("flex items-center gap-3 px-3 py-2.5 border rounded-lg cursor-pointer transition-all", formData.hasFlyers ? "border-2 shadow-sm bg-rose-50 border-rose-200 dark:bg-rose-950 dark:border-rose-800" : "hover:bg-muted/50 border-border")} onClick={() => setFormData({ ...formData, hasFlyers: !formData.hasFlyers })}>
                          <Checkbox checked={formData.hasFlyers} onCheckedChange={(checked) => setFormData({ ...formData, hasFlyers: !!checked })} data-testid="checkbox-flyers" onClick={(e) => e.stopPropagation()} />
                          <span className="text-sm font-medium">Umiestnenie letákov / posterov</span>
                        </div>
                        {formData.hasFlyers && (
                          <div className="ml-3 pl-3 border-l-2 border-rose-200 dark:border-rose-800 space-y-2">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="space-y-1"><Label className="text-xs">Dátum odoslania</Label><DateTimePicker value={formData.flyersSentDate} onChange={(v) => setFormData({ ...formData, flyersSentDate: v })} countryCode={formData.countryCode || "SK"} includeTime={false} data-testid="input-flyers-sent-date" /></div>
                              <div className="space-y-1"><Label className="text-xs">Umiestnenie</Label><Input value={formData.flyersLocation} onChange={(e) => setFormData({ ...formData, flyersLocation: e.target.value })} placeholder="Kde boli umiestnené" className="h-9" data-testid="input-flyers-location" /></div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "address" && (
                  <div className="space-y-4 pb-4">
                    <div className="space-y-1"><Label className="text-xs">{t.clinics.address}</Label><Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder={t.clinics.address} className="h-9" data-testid="input-clinic-address" /></div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1"><Label className="text-xs">{t.clinics.city}</Label><Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} placeholder={t.clinics.city} className="h-9" data-testid="input-clinic-city" /></div>
                      <div className="space-y-1"><Label className="text-xs">{t.clinics.postalCode}</Label><Input value={formData.postalCode} onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })} placeholder={t.clinics.postalCode} className="h-9" data-testid="input-clinic-postal" /></div>
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

                {activeTab === "settings" && (
                  <div className="space-y-4 pb-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div><Label>{t.clinics.isActive || "Active clinic"}</Label><p className="text-sm text-muted-foreground">{t.clinics.isActiveDesc || "Clinic is active and shown in lists"}</p></div>
                      <Switch checked={formData.isActive} onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })} data-testid="switch-clinic-active" />
                    </div>
                    <div className="space-y-1"><Label className="text-xs">{t.clinics.notes}</Label><Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder={t.clinics.notes} rows={6} data-testid="input-clinic-notes" /></div>
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

                {activeTab === "personnel" && (
                  <InstitutionPersonnelManager entityType="clinic" entityId={initialData.id} entityName={initialData.name} countryCode={initialData.countryCode} />
                )}

                {activeTab === "campaigns" && (
                  <EntityCampaignTimeline entityType="clinic" entityId={initialData.id} entityName={initialData.name} />
                )}
              </div>
            </div>

            <div className="shrink-0 border-t bg-muted/30 px-5 py-3 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-clinic-drawer">{t.common.cancel}</Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-clinic-drawer">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                {t.common.save}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
        {mapDialog}
      </>
    );
  }

  const clinicAddTabs = [
    { key: "source", icon: CircleDot, label: t.clinics.steps?.source || "Lead Source" },
    { key: "basic", icon: Building2, label: t.clinics.steps?.basic || "Info" },
    { key: "address", icon: MapPin, label: t.clinics.steps?.address || "Address" },
    { key: "settings", icon: SettingsIcon, label: t.clinics.steps?.settings || "Settings" },
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
              {activeTab === "source" && (
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
                            <button type="button" className={cn("flex items-center gap-3 px-3 py-2.5 border rounded-lg cursor-pointer transition-all w-full text-left", selected ? cn("border-2 shadow-sm", LEAD_SOURCE_COLORS[type]) : "hover:bg-muted/50 border-border", isExpanded && "rounded-b-none")}
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
                      <div className="ml-3 pl-3 border-l-2 border-purple-200 dark:border-purple-800 space-y-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input value={referralSearch} onChange={(e) => setReferralSearch(e.target.value)} placeholder={t.clinics.selectDoctor} className="pl-9 h-9" data-testid="input-add-referral-search" />
                        </div>
                        {referralSearch && filteredClinics.length > 0 && (
                          <div className="border rounded-lg max-h-36 overflow-y-auto">
                            {filteredClinics.slice(0, 10).map((clinic) => (
                              <div key={clinic.id} className="flex items-center justify-between p-2 hover:bg-muted/50 cursor-pointer" onClick={() => addReferral(clinic, "doctor_referral")}>
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
                                <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeReferral(ref.clinicId)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                              </div>
                            ))}
                          </div>
                        ) : (<p className="text-xs text-muted-foreground italic pl-1">{t.clinics.noReferrals}</p>)}
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
                    <div className="flex items-center gap-2"><div className="flex items-center justify-center w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-900"><Building2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /></div><h3 className="text-sm font-semibold tracking-wide">{t.clinics.sections?.clinic || 'Clinic'}</h3></div>
                    <div className="grid gap-3 sm:grid-cols-2 pl-1">
                      <div className="space-y-1"><Label className="text-xs">{t.clinics.name} *</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder={t.clinics.name} className="h-9" data-testid="input-add-clinic-name" /></div>
                      <div className="space-y-1"><Label className="text-xs">{t.common.country} *</Label>
                        <Select value={formData.countryCode} onValueChange={(value) => setFormData({ ...formData, countryCode: value })}>
                          <SelectTrigger className="h-9" data-testid="select-add-clinic-country"><SelectValue placeholder={t.common.country} /></SelectTrigger>
                          <SelectContent>{COUNTRIES.map((country) => (<SelectItem key={country.code} value={country.code}>{getCountryFlag(country.code)} {country.name}</SelectItem>))}</SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center gap-2"><div className="flex items-center justify-center w-6 h-6 rounded-md bg-purple-100 dark:bg-purple-900"><Stethoscope className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" /></div><h3 className="text-sm font-semibold tracking-wide">Lekar</h3></div>
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
                      <div className="space-y-1"><Label className="text-xs">{t.clinics.phone}</Label><Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder={t.clinics.phone} className="h-9" data-testid="input-add-clinic-phone" /></div>
                      <div className="space-y-1"><Label className="text-xs">{t.clinics.email}</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder={t.clinics.email} className="h-9" data-testid="input-add-clinic-email" /></div>
                    </div>
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
                    <div className="space-y-1"><Label className="text-xs">{t.clinics.address}</Label><Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder={t.clinics.address} className="h-9" data-testid="input-add-clinic-address" /></div>
                    <div className="space-y-1"><Label className="text-xs">{t.clinics.city}</Label><Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} placeholder={t.clinics.city} className="h-9" data-testid="input-add-clinic-city" /></div>
                    <div className="space-y-1"><Label className="text-xs">{t.clinics.postalCode}</Label><Input value={formData.postalCode} onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })} placeholder={t.clinics.postalCode} className="h-9" data-testid="input-add-clinic-postalcode" /></div>
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

              {activeTab === "settings" && (
                <div className="space-y-4 pb-4">
                  <div className="flex items-center space-x-2">
                    <Switch checked={formData.isActive} onCheckedChange={(v) => setFormData({ ...formData, isActive: v })} data-testid="switch-add-clinic-active" />
                    <Label>{t.common.active}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch checked={formData.hasFlyers} onCheckedChange={(v) => setFormData({ ...formData, hasFlyers: v })} data-testid="switch-add-clinic-flyers" />
                    <Label>{(t.clinics as any).hasFlyers || "Has flyers/posters"}</Label>
                  </div>
                  {formData.hasFlyers && (
                    <div className="ml-8 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1"><Label className="text-xs">{(t.clinics as any).flyersSentDate || "Flyers sent date"}</Label><DateTimePicker value={formData.flyersSentDate} onChange={(v) => setFormData({ ...formData, flyersSentDate: v })} countryCode={formData.countryCode || "SK"} includeTime={false} /></div>
                        <div className="space-y-1"><Label className="text-xs">{(t.clinics as any).flyersLocation || "Flyers location"}</Label><Input value={formData.flyersLocation} onChange={(e) => setFormData({ ...formData, flyersLocation: e.target.value })} className="h-9" /></div>
                      </div>
                    </div>
                  )}
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
    </>
  );
}
