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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { COUNTRIES } from "@shared/schema";
import type { Clinic } from "@shared/schema";
import {
  Stethoscope, MapPin, ExternalLink, Navigation, Loader2, Search, Trash2, Plus,
  Users, Save, X, UserPlus, Handshake, UserCheck, GraduationCap, Phone, Mail,
  Clock, ArrowRightLeft, History, FileText, MessageSquare, Megaphone, PhoneCall,
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
import { getQueryFn } from "@/lib/queryClient";
import { useLocation } from "wouter";
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

export function ClinicFormSheet({ open, onOpenChange, initialData, onSuccess }: ClinicFormSheetProps) {
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
      address: "", city: "", postalCode: "", countryCode: "",
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
      countryCode: data.countryCode, phone: data.phone || "", email: data.email || "",
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

  const { data: allClinics } = useQuery<Clinic[]>({ queryKey: ["/api/clinics"] });

  const { data: existingReferrals } = useQuery<Array<{ id: string; clinicId: string; referringClinicId: string; referralType: string; referringClinic: Clinic | null }>>({
    queryKey: ["/api/clinic-referrals", initialData?.id],
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
  const [referralSearch, setReferralSearch] = useState("");
  const [confReferralSearch, setConfReferralSearch] = useState("");
  const referralsInitRef = useRef(false);
  const userEditedReferralsRef = useRef(false);

  useEffect(() => {
    if (open) {
      setActiveTab("source");
      setReferrals([]);
      setReferralSearch("");
      setConfReferralSearch("");
      setShowMapDialog(false);
      setIsLoadingLocation(false);
      setPipelineMenuOpen(false);
      setExpandedCategory(null);
      setFormData(buildFormData(initialData));
      referralsInitRef.current = false;
      userEditedReferralsRef.current = false;
    }
  }, [open, initialData?.id]);

  useEffect(() => {
    if (userEditedReferralsRef.current) return;
    if (existingReferrals && !referralsInitRef.current) {
      referralsInitRef.current = true;
      if (existingReferrals.length > 0) {
        setReferrals(existingReferrals.filter(r => r.referringClinic).map(r => ({
          clinicId: String(r.referringClinicId),
          clinicName: getDoctorFullName(r.referringClinic) || r.referringClinic?.name || "",
          referralType: r.referralType || "doctor_referral",
        })));
      }
    }
  }, [existingReferrals]);

  const filterClinicsFor = (searchStr: string) => {
    if (!searchStr) return [];
    return (allClinics?.filter((c) => {
      if (initialData && String(c.id) === String(initialData.id)) return false;
      if (referrals.some((r) => String(r.clinicId) === String(c.id))) return false;
      const s = searchStr.toLowerCase();
      const fullName = getDoctorFullName(c as any);
      return c.name.toLowerCase().includes(s) || fullName.toLowerCase().includes(s) || (c.doctorName && c.doctorName.toLowerCase().includes(s)) || (c.city && c.city.toLowerCase().includes(s));
    }) || []);
  };
  const filteredClinics = filterClinicsFor(referralSearch);
  const filteredClinicsConf = filterClinicsFor(confReferralSearch);

  const addReferral = (clinic: Clinic, type: string) => {
    userEditedReferralsRef.current = true;
    const displayName = getDoctorFullName(clinic as any) || clinic.name;
    setReferrals([...referrals, { clinicId: String(clinic.id), clinicName: displayName, referralType: type }]);
    if (type === "doctor_referral") setReferralSearch("");
    else setConfReferralSearch("");
  };

  const removeReferral = (clinicId: string) => {
    userEditedReferralsRef.current = true;
    setReferrals(referrals.filter((r) => r.clinicId !== clinicId));
  };

  const doctorReferrals = referrals.filter(r => r.referralType === "doctor_referral");
  const conferenceReferrals = referrals.filter(r => r.referralType === "conference");
  const hasAnyReferral = formData.isReferredByDoctor || formData.isFromConference || referrals.length > 0;

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: t.clinics.gpsNotSupported || "GPS nie je podporovane", variant: "destructive" });
      return;
    }
    setIsLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({ ...prev, latitude: position.coords.latitude.toFixed(7), longitude: position.coords.longitude.toFixed(7) }));
        setIsLoadingLocation(false);
        toast({ title: t.clinics.gpsLoaded || "GPS suradnice boli nacitane" });
      },
      (error) => {
        setIsLoadingLocation(false);
        let message = t.clinics.gpsError || "Nepodarilo sa ziskat polohu";
        if (error.code === error.PERMISSION_DENIED) message = t.clinics.gpsPermissionDenied || "Pristup k polohe bol zamietnuty";
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
        ...data,
        doctorName: [data.doctorTitle, data.doctorFirstName, data.doctorLastName].filter(Boolean).join(" ") || null,
        leadSourceDate: data.leadSourceDate ? new Date(data.leadSourceDate).toISOString() : null,
        conferenceDate: data.conferenceDate && data.isFromConference ? new Date(data.conferenceDate).toISOString() : null,
        leadSource: data.leadSource || null,
        leadSourceNotes: data.leadSourceNotes || null,
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
      }
      return savedClinic;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clinic-referrals"] });
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

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[720px] sm:max-w-[720px] overflow-y-auto p-0">
          <SheetHeader className="px-6 pt-5 pb-2">
            <SheetTitle className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                <Stethoscope className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-base">{initialData ? t.clinics.editClinic : t.clinics.addClinic}</span>
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
            </SheetTitle>
          </SheetHeader>

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

          {initialData && (() => {
            const docRefs = existingReferrals?.filter(r => r.referringClinic && r.referralType === "doctor_referral")?.map(r => r.referringClinic!) || [];
            const confRefs = existingReferrals?.filter(r => r.referringClinic && r.referralType === "conference")?.map(r => r.referringClinic!) || [];
            if (docRefs.length === 0 && confRefs.length === 0) return null;
            return (
              <div className="mx-6 mb-1 space-y-1">
                {docRefs.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                    <UserCheck className="h-3 w-3 text-purple-500" />
                    <span className="font-medium text-purple-600 dark:text-purple-400">{t.clinics.referredBy}:</span>
                    {docRefs.map((doc) => (
                      <Badge key={doc.id} variant="secondary" className="text-xs py-0 px-1.5">{getDoctorFullName(doc as any) || doc.name}</Badge>
                    ))}
                  </div>
                )}
                {confRefs.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                    <GraduationCap className="h-3 w-3 text-rose-500" />
                    <span className="font-medium text-rose-600 dark:text-rose-400">{t.clinics.leadSourceTypes?.conference || "Conference"}:</span>
                    {confRefs.map((doc) => (
                      <Badge key={doc.id} variant="secondary" className="text-xs py-0 px-1.5">{getDoctorFullName(doc as any) || doc.name}</Badge>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="px-6">
            <TabsList className={cn("grid w-full h-auto p-1 gap-0.5", initialData ? "grid-cols-5" : "grid-cols-4")}>
              <TabsTrigger value="source" data-testid="tab-clinic-source" className="text-xs px-2 py-1.5 data-[state=active]:shadow-sm">
                <CircleDot className="h-3 w-3 mr-1 hidden sm:inline" />
                {t.clinics.steps?.source || "Zdroj"}
              </TabsTrigger>
              <TabsTrigger value="basic" data-testid="tab-clinic-basic" className="text-xs px-2 py-1.5 data-[state=active]:shadow-sm">
                <Building2 className="h-3 w-3 mr-1 hidden sm:inline" />
                {t.clinics.steps?.basic || "Info"}
              </TabsTrigger>
              <TabsTrigger value="address" data-testid="tab-clinic-address" className="text-xs px-2 py-1.5 data-[state=active]:shadow-sm">
                <MapPin className="h-3 w-3 mr-1 hidden sm:inline" />
                {t.clinics.steps?.address || "Adresa"}
              </TabsTrigger>
              {initialData && (
                <TabsTrigger value="history" data-testid="tab-clinic-history" className="text-xs px-2 py-1.5 data-[state=active]:shadow-sm">
                  <History className="h-3 w-3 mr-1 hidden sm:inline" />
                  {t.clinics.steps?.history || "História"}
                </TabsTrigger>
              )}
              <TabsTrigger value="settings" data-testid="tab-clinic-settings" className="text-xs px-2 py-1.5 data-[state=active]:shadow-sm">
                <FileText className="h-3 w-3 mr-1 hidden sm:inline" />
                {t.clinics.steps?.settings || "Nastavenia"}
              </TabsTrigger>
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
                  <div className="ml-3 pl-3 border-l-2 border-purple-200 dark:border-purple-800 space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input value={referralSearch} onChange={(e) => setReferralSearch(e.target.value)} placeholder={t.clinics.selectDoctor} className="pl-9 h-9" data-testid="input-referral-search" />
                    </div>
                    {referralSearch && filteredClinics.length > 0 && (
                      <div className="border rounded-lg max-h-36 overflow-y-auto">
                        {filteredClinics.slice(0, 10).map((clinic) => (
                          <div key={clinic.id} className="flex items-center justify-between p-2 hover:bg-muted/50 cursor-pointer" onClick={() => addReferral(clinic, "doctor_referral")} data-testid={`referral-option-${clinic.id}`}>
                            <div>
                              <span className="font-medium text-sm">{getDoctorFullName(clinic as any) || clinic.name}</span>
                              <span className="text-sm text-muted-foreground ml-2">{clinic.city || ""}</span>
                            </div>
                            <Plus className="h-4 w-4 text-muted-foreground" />
                          </div>
                        ))}
                      </div>
                    )}
                    {doctorReferrals.length > 0 ? (
                      <div className="space-y-1.5">
                        {doctorReferrals.map((ref) => (
                          <div key={ref.clinicId} className="flex items-center justify-between px-3 py-1.5 border rounded-lg bg-purple-50/50 dark:bg-purple-950/30">
                            <div className="flex items-center gap-2">
                              <UserCheck className="h-3.5 w-3.5 text-purple-500" />
                              <span className="text-sm font-medium">{ref.clinicName}</span>
                            </div>
                            <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeReferral(ref.clinicId)} data-testid={`remove-referral-${ref.clinicId}`}>
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
                  <h3 className="text-sm font-semibold tracking-wide">Ambulancia</h3>
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
                  <h3 className="text-sm font-semibold tracking-wide">Lekár</h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-3 pl-1">
                  <div className="space-y-1">
                    <Label className="text-xs">Titul</Label>
                    <Input value={formData.doctorTitle} onChange={(e) => setFormData({ ...formData, doctorTitle: e.target.value })} placeholder="MUDr." className="h-9" data-testid="input-doctor-title" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Meno</Label>
                    <Input value={formData.doctorFirstName} onChange={(e) => setFormData({ ...formData, doctorFirstName: e.target.value })} placeholder="Meno" className="h-9" data-testid="input-doctor-firstname" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Priezvisko</Label>
                    <Input value={formData.doctorLastName} onChange={(e) => setFormData({ ...formData, doctorLastName: e.target.value })} placeholder="Priezvisko" className="h-9" data-testid="input-doctor-lastname" />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-md bg-sky-100 dark:bg-sky-900">
                    <Phone className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                  </div>
                  <h3 className="text-sm font-semibold tracking-wide">Kontakt</h3>
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
                  <h3 className="text-sm font-semibold tracking-wide">Hovory & Kontakt</h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 pl-1">
                  <div className="space-y-1">
                    <Label className="text-xs">Posledný výsledok hovoru</Label>
                    <Input value={formData.lastCallResult} onChange={(e) => setFormData({ ...formData, lastCallResult: e.target.value })} placeholder="Výsledok hovoru" className="h-9" data-testid="input-last-call-result" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Dátum ďalšieho kontaktu</Label>
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
                    <Label className="text-[11px] text-muted-foreground">{t.clinics.longitude || "Zemepisna dlzka"}</Label>
                    <Input value={formData.longitude} onChange={(e) => setFormData({ ...formData, longitude: e.target.value })} placeholder="17.1077" className="h-9" data-testid="input-clinic-lng" />
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <Button type="button" variant="outline" size="sm" onClick={handleGetCurrentLocation} disabled={isLoadingLocation} data-testid="button-get-gps">
                    {isLoadingLocation ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Navigation className="h-4 w-4 mr-2" />}
                    {t.clinics.getCurrentLocation || "Ziskat aktualnu polohu"}
                  </Button>
                  {formData.latitude && formData.longitude && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowMapDialog(true)} data-testid="button-show-map">
                      <MapPin className="h-4 w-4 mr-2" />
                      {t.clinics.showOnMap || "Zobrazit na mape"}
                    </Button>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ===== SETTINGS TAB ===== */}
            <TabsContent value="settings" className="space-y-4 mt-4 pb-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label>{t.clinics.isActive || "Aktivna ambulancia"}</Label>
                  <p className="text-sm text-muted-foreground">{t.clinics.isActiveDesc || "Ambulancia je aktivna a zobrazuje sa v zoznamoch"}</p>
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
                    <p className="text-sm text-muted-foreground">{t.clinics.noHistory || "Zatiaľ žiadna história"}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">{t.clinics.noHistoryDesc || "Udalosti sa začnú zaznamenávať po prvej zmene"}</p>
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
          </Tabs>

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
        </SheetContent>
      </Sheet>

      <Dialog open={showMapDialog} onOpenChange={setShowMapDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t.clinics.showOnMap || "Zobrazit na mape"}</DialogTitle>
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
    </>
  );
}
