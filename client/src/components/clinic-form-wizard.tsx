import { useState, useEffect } from "react";
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
import { Stethoscope, MapPin, ExternalLink, Navigation, Loader2, Search, Trash2, Plus, Users, Save, X, UserPlus, Handshake, UserCheck, GraduationCap, Phone, Mail } from "lucide-react";
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
  doctorName: string;
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
  const [activeTab, setActiveTab] = useState("basic");
  const [showMapDialog, setShowMapDialog] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  const buildFormData = (data: Clinic | null | undefined): ClinicFormData => {
    if (!data) return {
      name: "", doctorName: "", address: "", city: "", postalCode: "", countryCode: "",
      phone: "", email: "", website: "", latitude: "", longitude: "", isActive: true,
      notes: "", leadSource: "", leadSourceDate: "", leadSourceNotes: "", conferenceName: "",
      conferenceDate: "", isReferredByDoctor: false, isFromConference: false,
    };
    const oldSource = data.leadSource || "";
    const isOldDoctorRef = oldSource === "doctor_referral";
    const isOldConference = oldSource === "conference";
    const mainSource = (isOldDoctorRef || isOldConference) ? "" : oldSource;
    return {
      name: data.name, doctorName: data.doctorName || "", address: data.address || "",
      city: data.city || "", postalCode: data.postalCode || "", countryCode: data.countryCode,
      phone: data.phone || "", email: data.email || "", website: data.website || "",
      latitude: data.latitude || "", longitude: data.longitude || "", isActive: data.isActive,
      notes: data.notes || "", leadSource: mainSource,
      leadSourceDate: data.leadSourceDate ? new Date(data.leadSourceDate).toISOString().split("T")[0] : "",
      leadSourceNotes: data.leadSourceNotes || "", conferenceName: data.conferenceName || "",
      conferenceDate: data.conferenceDate ? new Date(data.conferenceDate).toISOString().split("T")[0] : "",
      isReferredByDoctor: data.isReferredByDoctor ?? isOldDoctorRef,
      isFromConference: data.isFromConference ?? isOldConference,
    };
  };
  const [formData, setFormData] = useState<ClinicFormData>(() => buildFormData(initialData));

  const { data: allClinics } = useQuery<Clinic[]>({
    queryKey: ["/api/clinics"],
  });

  const { data: existingReferrals } = useQuery<Array<{ id: string; clinicId: string; referringClinicId: string; referringClinic: Clinic | null }>>({
    queryKey: ["/api/clinic-referrals", initialData?.id],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!initialData?.id && open,
  });

  const [referrals, setReferrals] = useState<Array<{ clinicId: number; clinicName: string; referralType: string }>>([]);
  const [referralSearch, setReferralSearch] = useState("");

  useEffect(() => {
    if (open) {
      setActiveTab("basic");
      setReferrals([]);
      setReferralSearch("");
      setShowMapDialog(false);
      setIsLoadingLocation(false);
      setFormData(buildFormData(initialData));
    }
  }, [open, initialData?.id]);

  const filteredClinics = allClinics?.filter((c) => {
    if (!referralSearch) return false;
    if (initialData && c.id === initialData.id) return false;
    if (referrals.some((r) => r.clinicId === c.id)) return false;
    const search = referralSearch.toLowerCase();
    return (
      c.name.toLowerCase().includes(search) ||
      (c.doctorName && c.doctorName.toLowerCase().includes(search)) ||
      (c.city && c.city.toLowerCase().includes(search))
    );
  }) || [];

  const addReferral = (clinic: Clinic) => {
    setReferrals([...referrals, { clinicId: clinic.id, clinicName: `${clinic.doctorName || ""} - ${clinic.name}`, referralType: "doctor_referral" }]);
    setReferralSearch("");
  };

  const removeReferral = (clinicId: number) => {
    setReferrals(referrals.filter((r) => r.clinicId !== clinicId));
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: t.clinics.gpsNotSupported || "GPS nie je podporovane", variant: "destructive" });
      return;
    }
    setIsLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData({
          ...formData,
          latitude: position.coords.latitude.toFixed(7),
          longitude: position.coords.longitude.toFixed(7),
        });
        setIsLoadingLocation(false);
        toast({ title: t.clinics.gpsLoaded || "GPS suradnice boli nacitane" });
      },
      (error) => {
        setIsLoadingLocation(false);
        let message = t.clinics.gpsError || "Nepodarilo sa ziskat polohu";
        if (error.code === error.PERMISSION_DENIED) {
          message = t.clinics.gpsPermissionDenied || "Pristup k polohe bol zamietnuty";
        }
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

  const saveMutation = useMutation({
    mutationFn: async (data: ClinicFormData) => {
      const payload = {
        ...data,
        leadSourceDate: data.leadSourceDate ? new Date(data.leadSourceDate).toISOString() : null,
        conferenceDate: data.conferenceDate && data.isFromConference ? new Date(data.conferenceDate).toISOString() : null,
        leadSource: data.leadSource || null,
        leadSourceNotes: data.leadSourceNotes || null,
        conferenceName: data.isFromConference ? (data.conferenceName || null) : null,
        isReferredByDoctor: data.isReferredByDoctor,
        isFromConference: data.isFromConference,
      };
      let res;
      if (initialData) {
        res = await apiRequest("PUT", `/api/clinics/${initialData.id}`, payload);
      } else {
        res = await apiRequest("POST", "/api/clinics", payload);
      }
      const savedClinic = await res.json();
      if (referrals.length > 0 && savedClinic?.id) {
        for (const ref of referrals) {
          await apiRequest("POST", `/api/clinics/${savedClinic.id}/referrals`, {
            referringClinicId: ref.clinicId,
            referralType: ref.referralType,
          });
        }
      }
      return savedClinic;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinics"] });
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

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[680px] sm:max-w-[680px] overflow-y-auto p-0">
          <SheetHeader className="px-6 pt-6 pb-2">
            <SheetTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5" />
              {initialData ? t.clinics.editClinic : t.clinics.addClinic}
            </SheetTitle>
          </SheetHeader>

          {initialData && (formData.leadSource || formData.isReferredByDoctor || formData.isFromConference) && (() => {
            const sourceType = MAIN_SOURCE_TYPES.includes(formData.leadSource as LeadSourceType) ? formData.leadSource as LeadSourceType : null;
            const referringDoctors = existingReferrals?.filter(r => r.referringClinic)?.map(r => r.referringClinic!) || [];
            return (
              <div className="mx-6 mt-2 mb-1 space-y-1.5" data-testid="clinic-status-bar">
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-1.5 flex-wrap min-w-0">
                    {sourceType && (() => {
                      const Icon = LEAD_SOURCE_ICONS[sourceType];
                      return (
                        <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", LEAD_SOURCE_COLORS[sourceType])}>
                          <Icon className="h-3.5 w-3.5" />
                          {t.clinics.leadSourceTypes?.[sourceType] || sourceType}
                        </div>
                      );
                    })()}
                    {formData.isReferredByDoctor && (
                      <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", LEAD_SOURCE_COLORS.doctor_referral)}>
                        <UserCheck className="h-3.5 w-3.5" />
                        {t.clinics.leadSourceTypes?.doctor_referral || "Doctor referral"}
                      </div>
                    )}
                    {formData.isFromConference && (
                      <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", LEAD_SOURCE_COLORS.conference)}>
                        <GraduationCap className="h-3.5 w-3.5" />
                        {t.clinics.leadSourceTypes?.conference || "Conference"}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {initialData.email && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              data-testid="button-clinic-email"
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
                      <CallCustomerButton phoneNumber={initialData.phone} customerName={initialData.doctorName || initialData.name} variant="icon" />
                    )}
                  </div>
                </div>
                {formData.isReferredByDoctor && referringDoctors.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground pl-1">
                    <span className="font-medium">{t.clinics.referredBy}:</span>
                    {referringDoctors.map((doc) => (
                      <Badge key={doc.id} variant="secondary" className="text-xs py-0 px-1.5">
                        {doc.doctorName || doc.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="px-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic" data-testid="tab-clinic-basic">
                {t.clinics.steps?.basic || "Zakladne"}
              </TabsTrigger>
              <TabsTrigger value="source" data-testid="tab-clinic-source">
                {t.clinics.steps?.source || "Zdroj"}
              </TabsTrigger>
              <TabsTrigger value="address" data-testid="tab-clinic-address">
                {t.clinics.steps?.address || "Adresa"}
              </TabsTrigger>
              <TabsTrigger value="settings" data-testid="tab-clinic-settings">
                {t.clinics.steps?.settings || "Nastavenia"}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4 pb-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t.clinics.name} *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t.clinics.name}
                    data-testid="input-clinic-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t.clinics.doctorName}</Label>
                  <Input
                    value={formData.doctorName}
                    onChange={(e) => setFormData({ ...formData, doctorName: e.target.value })}
                    placeholder={t.clinics.doctorName}
                    data-testid="input-clinic-doctor"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t.common.country} *</Label>
                  <Select
                    value={formData.countryCode}
                    onValueChange={(value) => setFormData({ ...formData, countryCode: value })}
                  >
                    <SelectTrigger data-testid="select-clinic-country">
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

              <Separator />

              <div className="space-y-2">
                <Label>{t.clinics.website}</Label>
                <div className="flex gap-2">
                  <Input
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="www.example.com"
                    className="flex-1"
                    data-testid="input-clinic-website"
                  />
                  {formData.website && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => window.open(getWebsiteUrl(formData.website), "_blank")}
                      data-testid="button-open-website"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t.clinics.phone}</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder={t.clinics.phone}
                    data-testid="input-clinic-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t.clinics.email}</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder={t.clinics.email}
                    data-testid="input-clinic-email"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="source" className="space-y-5 mt-4 pb-4">
              <div className="space-y-3">
                <Label className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t.clinics.leadSource}</Label>
                <RadioGroup
                  value={formData.leadSource}
                  onValueChange={(value) => setFormData({ ...formData, leadSource: value })}
                  className="grid gap-2"
                >
                  {MAIN_SOURCE_TYPES.map((type) => {
                    const Icon = LEAD_SOURCE_ICONS[type];
                    const selected = formData.leadSource === type;
                    return (
                      <div
                        key={type}
                        className={cn(
                          "flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all",
                          selected ? cn("border-2 shadow-sm", LEAD_SOURCE_COLORS[type]) : "hover:bg-muted/50 border-border"
                        )}
                        onClick={() => setFormData({ ...formData, leadSource: type })}
                      >
                        <div className={cn("flex items-center justify-center w-9 h-9 rounded-lg shrink-0", LEAD_SOURCE_ICON_BG[type])}>
                          <Icon className="h-4.5 w-4.5" />
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground text-xs"
                    onClick={() => setFormData({ ...formData, leadSource: "" })}
                    data-testid="button-clear-source"
                  >
                    <X className="h-3 w-3 mr-1" />
                    {t.common.clear || "Zrusit"}
                  </Button>
                )}
              </div>

              {formData.leadSource && (
                <>
                  <Separator />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-sm">{t.clinics.leadSourceDate}</Label>
                      <DateTimePicker
                        value={formData.leadSourceDate}
                        onChange={(v) => setFormData({ ...formData, leadSourceDate: v })}
                        countryCode={formData.countryCode || "SK"}
                        includeTime={false}
                        data-testid="input-lead-source-date"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">{t.clinics.leadSourceNotes}</Label>
                    <Textarea
                      value={formData.leadSourceNotes}
                      onChange={(e) => setFormData({ ...formData, leadSourceNotes: e.target.value })}
                      placeholder={t.clinics.leadSourceNotes}
                      rows={2}
                      data-testid="input-lead-source-notes"
                    />
                  </div>
                </>
              )}

              <Separator />

              <div className="space-y-3">
                <Label className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {t.clinics.referredBy || "Referral"}
                </Label>

                <div
                  className={cn(
                    "border rounded-xl p-3 transition-all cursor-pointer",
                    formData.isReferredByDoctor ? cn("border-2 shadow-sm", LEAD_SOURCE_COLORS.doctor_referral) : "hover:bg-muted/50 border-border"
                  )}
                  onClick={() => setFormData({ ...formData, isReferredByDoctor: !formData.isReferredByDoctor })}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("flex items-center justify-center w-9 h-9 rounded-lg shrink-0", LEAD_SOURCE_ICON_BG.doctor_referral)}>
                      <UserCheck className="h-4.5 w-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{t.clinics.leadSourceTypes?.doctor_referral || "Doctor referral"}</div>
                      <div className="text-xs text-muted-foreground">{t.clinics.leadSourceDesc?.doctor_referral || ""}</div>
                    </div>
                    <Checkbox
                      checked={formData.isReferredByDoctor}
                      onCheckedChange={(checked) => setFormData({ ...formData, isReferredByDoctor: !!checked })}
                      data-testid="checkbox-doctor-referral"
                      className="shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>

                {formData.isReferredByDoctor && (
                  <div className="ml-4 pl-4 border-l-2 border-purple-200 dark:border-purple-800 space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={referralSearch}
                        onChange={(e) => setReferralSearch(e.target.value)}
                        placeholder={t.clinics.selectDoctor}
                        className="pl-9"
                        data-testid="input-referral-search"
                      />
                    </div>
                    {referralSearch && filteredClinics.length > 0 && (
                      <div className="border rounded-lg max-h-40 overflow-y-auto">
                        {filteredClinics.slice(0, 10).map((clinic) => (
                          <div
                            key={clinic.id}
                            className="flex items-center justify-between p-2 hover:bg-muted/50 cursor-pointer"
                            onClick={() => addReferral(clinic)}
                            data-testid={`referral-option-${clinic.id}`}
                          >
                            <div>
                              <span className="font-medium text-sm">{clinic.doctorName || clinic.name}</span>
                              <span className="text-sm text-muted-foreground ml-2">{clinic.city || ""}</span>
                            </div>
                            <Plus className="h-4 w-4 text-muted-foreground" />
                          </div>
                        ))}
                      </div>
                    )}
                    {referrals.length > 0 ? (
                      <div className="space-y-2">
                        {referrals.map((ref) => (
                          <div key={ref.clinicId} className="flex items-center justify-between p-2 border rounded-lg bg-purple-50/50 dark:bg-purple-950/30">
                            <div className="flex items-center gap-2">
                              <UserCheck className="h-4 w-4 text-purple-500" />
                              <span className="text-sm font-medium">{ref.clinicName}</span>
                            </div>
                            <Button type="button" variant="ghost" size="sm" onClick={() => removeReferral(ref.clinicId)} data-testid={`remove-referral-${ref.clinicId}`}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">{t.clinics.noReferrals}</p>
                    )}
                  </div>
                )}

                <div
                  className={cn(
                    "border rounded-xl p-3 transition-all cursor-pointer",
                    formData.isFromConference ? cn("border-2 shadow-sm", LEAD_SOURCE_COLORS.conference) : "hover:bg-muted/50 border-border"
                  )}
                  onClick={() => setFormData({ ...formData, isFromConference: !formData.isFromConference })}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("flex items-center justify-center w-9 h-9 rounded-lg shrink-0", LEAD_SOURCE_ICON_BG.conference)}>
                      <GraduationCap className="h-4.5 w-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{t.clinics.leadSourceTypes?.conference || "Conference / Seminar"}</div>
                      <div className="text-xs text-muted-foreground">{t.clinics.leadSourceDesc?.conference || ""}</div>
                    </div>
                    <Checkbox
                      checked={formData.isFromConference}
                      onCheckedChange={(checked) => setFormData({ ...formData, isFromConference: !!checked })}
                      data-testid="checkbox-conference"
                      className="shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>

                {formData.isFromConference && (
                  <div className="ml-4 pl-4 border-l-2 border-rose-200 dark:border-rose-800 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-sm">{t.clinics.conferenceName}</Label>
                        <Input
                          value={formData.conferenceName}
                          onChange={(e) => setFormData({ ...formData, conferenceName: e.target.value })}
                          placeholder={t.clinics.conferenceName}
                          data-testid="input-conference-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">{t.clinics.conferenceDate}</Label>
                        <DateTimePicker
                          value={formData.conferenceDate}
                          onChange={(v) => setFormData({ ...formData, conferenceDate: v })}
                          countryCode={formData.countryCode || "SK"}
                          includeTime={false}
                          data-testid="input-conference-date"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="address" className="space-y-4 mt-4 pb-4">
              <div className="space-y-2">
                <Label>{t.clinics.address}</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder={t.clinics.address}
                  data-testid="input-clinic-address"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t.clinics.city}</Label>
                  <Input
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder={t.clinics.city}
                    data-testid="input-clinic-city"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t.clinics.postalCode}</Label>
                  <Input
                    value={formData.postalCode}
                    onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                    placeholder={t.clinics.postalCode}
                    data-testid="input-clinic-postal"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>{t.clinics.gpsCoordinates || "GPS suradnice"}</Label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">{t.clinics.latitude || "Zemepisna sirka"}</Label>
                    <Input
                      value={formData.latitude}
                      onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                      placeholder="48.1486"
                      data-testid="input-clinic-lat"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">{t.clinics.longitude || "Zemepisna dlzka"}</Label>
                    <Input
                      value={formData.longitude}
                      onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                      placeholder="17.1077"
                      data-testid="input-clinic-lng"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGetCurrentLocation}
                    disabled={isLoadingLocation}
                    data-testid="button-get-gps"
                  >
                    {isLoadingLocation ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Navigation className="h-4 w-4 mr-2" />
                    )}
                    {t.clinics.getCurrentLocation || "Ziskat aktualnu polohu"}
                  </Button>
                  {formData.latitude && formData.longitude && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowMapDialog(true)}
                      data-testid="button-show-map"
                    >
                      <MapPin className="h-4 w-4 mr-2" />
                      {t.clinics.showOnMap || "Zobrazit na mape"}
                    </Button>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4 mt-4 pb-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label>{t.clinics.isActive || "Aktivna ambulancia"}</Label>
                  <p className="text-sm text-muted-foreground">{t.clinics.isActiveDesc || "Ambulancia je aktivna a zobrazuje sa v zoznamoch"}</p>
                </div>
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  data-testid="switch-clinic-active"
                />
              </div>
              <div className="space-y-2">
                <Label>{t.clinics.notes}</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder={t.clinics.notes}
                  rows={6}
                  data-testid="input-clinic-notes"
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="sticky bottom-0 bg-background border-t px-6 py-4 flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel-clinic"
            >
              {t.common.cancel}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              data-testid="button-save-clinic"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
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
            <Button
              variant="outline"
              onClick={() => window.open(`https://www.google.com/maps?q=${formData.latitude},${formData.longitude}`, "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Google Maps
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}