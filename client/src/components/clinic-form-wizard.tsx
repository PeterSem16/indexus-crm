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

const INITIAL_STATUS_OPTIONS = [
  { value: "active_contract", label: "Aktívna zmluva", labelKey: "activeContract", icon: ShieldCheck, color: "text-green-600 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800" },
  { value: "former_collaborator", label: "V minulosti spolupracujúci", labelKey: "formerCollaborator", icon: Users, color: "text-amber-600 bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800" },
  { value: "not_contacted", label: "Neoslovený", labelKey: "notContacted", icon: Circle, color: "text-gray-600 bg-gray-50 dark:bg-gray-950 border-gray-200 dark:border-gray-800" },
];

const INTEREST_OPTIONS = [
  { value: "unknown", label: "Neznáme", labelKey: "unknown", icon: HelpCircle, color: "text-gray-500 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700" },
  { value: "interested", label: "Záujem", labelKey: "interested", icon: CheckCircle2, color: "text-green-600 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800" },
  { value: "not_interested", label: "Nezáujem", labelKey: "notInterested", icon: Ban, color: "text-red-500 bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800" },
];

const CONTRACT_STATUS_OPTIONS = [
  { value: "active_contract", label: "Aktívna zmluva", labelKey: "activeContractStatus", icon: ShieldCheck, color: "text-green-600 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800" },
  { value: "no_contract", label: "Bez zmluvy", labelKey: "noContract", icon: ScrollText, color: "text-gray-500 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700" },
];

function getClinicPipelineBadge(clinic: Clinic | ClinicFormData) {
  const d = clinic as any;
  if (d.contractStatus === "active_contract") return { label: "Aktívna zmluva", color: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200 dark:border-green-700" };
  if (d.interestContract === "interested") return { label: "Záujem o zmluvu", color: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900 dark:text-emerald-200 dark:border-emerald-700" };
  if (d.interestContract === "not_interested") return { label: "Nezáujem o zmluvu", color: "bg-red-100 text-red-700 border-red-300 dark:bg-red-900 dark:text-red-200 dark:border-red-700" };
  if (d.interestCooperation === "interested") return { label: "Záujem o spoluprácu", color: "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900 dark:text-sky-200 dark:border-sky-700" };
  if (d.interestCooperation === "not_interested") return { label: "Nezáujem o spoluprácu", color: "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900 dark:text-orange-200 dark:border-orange-700" };
  if (d.initialStatus === "active_contract") return { label: "Aktívna zmluva (pôvodná)", color: "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900 dark:text-teal-200 dark:border-teal-700" };
  if (d.initialStatus === "former_collaborator") return { label: "Bývalý spolupracovník", color: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900 dark:text-amber-200 dark:border-amber-700" };
  if (d.initialStatus === "not_contacted") return { label: "Neoslovený", color: "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600" };
  return null;
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
      name: data.name,
      doctorTitle: dTitle,
      doctorFirstName: dFirst,
      doctorLastName: dLast,
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

  const { data: allClinics } = useQuery<Clinic[]>({
    queryKey: ["/api/clinics"],
  });

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

  const pipelineBadge = getClinicPipelineBadge(formData);

  const StatusOptionCard = ({ option, selected, onSelect }: { option: typeof INITIAL_STATUS_OPTIONS[0]; selected: boolean; onSelect: () => void }) => {
    const Icon = option.icon;
    return (
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-all w-full",
          selected ? cn("border-2 shadow-sm ring-1 ring-primary/20", option.color) : "border-border hover:bg-muted/50"
        )}
        data-testid={`status-option-${option.value}`}
      >
        <Icon className={cn("h-4 w-4 shrink-0", selected ? "" : "text-muted-foreground")} />
        <span className={cn("text-sm font-medium", selected ? "" : "text-foreground")}>{option.label}</span>
        {selected && <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-primary shrink-0" />}
      </button>
    );
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[720px] sm:max-w-[720px] overflow-y-auto p-0">
          <SheetHeader className="px-6 pt-5 pb-3">
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
            </SheetTitle>
          </SheetHeader>

          {initialData && (
            <div className="mx-6 mb-2 space-y-2" data-testid="clinic-status-bar">
              <div className="flex items-center gap-2 flex-wrap">
                {pipelineBadge && (
                  <div className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border", pipelineBadge.color)}>
                    <Target className="h-3 w-3" />
                    {pipelineBadge.label}
                  </div>
                )}
                {formData.isReferredByDoctor && (
                  <div className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border", LEAD_SOURCE_COLORS.doctor_referral)}>
                    <UserCheck className="h-3 w-3" />
                    {t.clinics.leadSourceTypes?.doctor_referral || "Doctor referral"}
                  </div>
                )}
                {formData.isFromConference && (
                  <div className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border", LEAD_SOURCE_COLORS.conference)}>
                    <GraduationCap className="h-3 w-3" />
                    {t.clinics.leadSourceTypes?.conference || "Conference"}
                  </div>
                )}
                <div className="flex items-center gap-1 ml-auto shrink-0">
                  {initialData.email && (
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
                  {initialData.phone && (
                    <CallCustomerButton phoneNumber={initialData.phone} customerName={doctorFullName || initialData.name} variant="icon" />
                  )}
                </div>
              </div>
              {(() => {
                const docRefs = existingReferrals?.filter(r => r.referringClinic && r.referralType === "doctor_referral")?.map(r => r.referringClinic!) || [];
                const confRefs = existingReferrals?.filter(r => r.referringClinic && r.referralType === "conference")?.map(r => r.referringClinic!) || [];
                return (
                  <>
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
                  </>
                );
              })()}
            </div>
          )}

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
            <TabsContent value="source" className="space-y-5 mt-4 pb-4">
              {/* Pipeline Status Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-md bg-indigo-100 dark:bg-indigo-900">
                    <Target className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h3 className="text-sm font-semibold tracking-wide">Pipeline Status</h3>
                </div>

                <div className="space-y-3 pl-1">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Počiatočný status</Label>
                    <div className="grid gap-1.5">
                      {INITIAL_STATUS_OPTIONS.map((opt) => (
                        <StatusOptionCard key={opt.value} option={opt} selected={formData.initialStatus === opt.value}
                          onSelect={() => setFormData({ ...formData, initialStatus: formData.initialStatus === opt.value ? "" : opt.value })} />
                      ))}
                    </div>
                  </div>

                  <Separator className="my-3" />

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Záujem o spoluprácu</Label>
                    <div className="grid gap-1.5">
                      {INTEREST_OPTIONS.map((opt) => (
                        <StatusOptionCard key={opt.value} option={opt} selected={formData.interestCooperation === opt.value}
                          onSelect={() => setFormData({ ...formData, interestCooperation: formData.interestCooperation === opt.value ? "" : opt.value })} />
                      ))}
                    </div>
                  </div>

                  <Separator className="my-3" />

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Záujem o zmluvnú spoluprácu</Label>
                    <div className="grid gap-1.5">
                      {INTEREST_OPTIONS.map((opt) => (
                        <StatusOptionCard key={`contract-${opt.value}`} option={opt} selected={formData.interestContract === opt.value}
                          onSelect={() => setFormData({ ...formData, interestContract: formData.interestContract === opt.value ? "" : opt.value })} />
                      ))}
                    </div>
                  </div>

                  <Separator className="my-3" />

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Status Contract Medical Partner</Label>
                    <div className="grid gap-1.5">
                      {CONTRACT_STATUS_OPTIONS.map((opt) => (
                        <StatusOptionCard key={opt.value} option={opt} selected={formData.contractStatus === opt.value}
                          onSelect={() => setFormData({ ...formData, contractStatus: formData.contractStatus === opt.value ? "" : opt.value })} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Lead Source (origin) */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-900">
                    <CircleDot className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-sm font-semibold tracking-wide">{t.clinics.leadSource}</h3>
                </div>

                <RadioGroup value={formData.leadSource} onValueChange={(value) => setFormData({ ...formData, leadSource: value })} className="grid gap-1.5 pl-1">
                  {MAIN_SOURCE_TYPES.map((type) => {
                    const Icon = LEAD_SOURCE_ICONS[type];
                    const selected = formData.leadSource === type;
                    return (
                      <div key={type} className={cn("flex items-center gap-3 px-3 py-2.5 border rounded-lg cursor-pointer transition-all", selected ? cn("border-2 shadow-sm", LEAD_SOURCE_COLORS[type]) : "hover:bg-muted/50 border-border")}
                        onClick={() => setFormData({ ...formData, leadSource: type })} >
                        <div className={cn("flex items-center justify-center w-8 h-8 rounded-lg shrink-0", LEAD_SOURCE_ICON_BG[type])}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{t.clinics.leadSourceTypes?.[type] || type}</div>
                          <div className="text-xs text-muted-foreground">{t.clinics.leadSourceDesc?.[type] || ""}</div>
                        </div>
                        <RadioGroupItem value={type} id={`source-${type}`} data-testid={`radio-source-${type}`} className="shrink-0" />
                      </div>
                    );
                  })}
                </RadioGroup>
                {formData.leadSource && (
                  <Button type="button" variant="ghost" size="sm" className="text-muted-foreground text-xs" onClick={() => setFormData({ ...formData, leadSource: "" })} data-testid="button-clear-source">
                    <X className="h-3 w-3 mr-1" /> {t.common.clear || "Zrusit"}
                  </Button>
                )}

                {/* Doctor Referral checkbox */}
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

                {/* Conference checkbox */}
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

              {/* Call/Contract tracking block */}
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

              {/* Contract dates */}
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

              {/* Flyers section */}
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
