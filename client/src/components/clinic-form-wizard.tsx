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
import { Stethoscope, MapPin, ExternalLink, Navigation, Loader2, Search, Trash2, Plus, Users, Save, X } from "lucide-react";
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
}

const LEAD_SOURCE_TYPES = ["former_collaborator", "current_collaborator", "doctor_referral", "conference"] as const;
type LeadSourceType = typeof LEAD_SOURCE_TYPES[number];

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
  const [activeTab, setActiveTab] = useState("basic");
  const [showMapDialog, setShowMapDialog] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  const [formData, setFormData] = useState<ClinicFormData>(() =>
    initialData
      ? {
          name: initialData.name,
          doctorName: initialData.doctorName || "",
          address: initialData.address || "",
          city: initialData.city || "",
          postalCode: initialData.postalCode || "",
          countryCode: initialData.countryCode,
          phone: initialData.phone || "",
          email: initialData.email || "",
          website: initialData.website || "",
          latitude: initialData.latitude || "",
          longitude: initialData.longitude || "",
          isActive: initialData.isActive,
          notes: initialData.notes || "",
          leadSource: initialData.leadSource || "",
          leadSourceDate: initialData.leadSourceDate ? new Date(initialData.leadSourceDate).toISOString().split("T")[0] : "",
          leadSourceNotes: initialData.leadSourceNotes || "",
          conferenceName: initialData.conferenceName || "",
          conferenceDate: initialData.conferenceDate ? new Date(initialData.conferenceDate).toISOString().split("T")[0] : "",
        }
      : {
          name: "",
          doctorName: "",
          address: "",
          city: "",
          postalCode: "",
          countryCode: "",
          phone: "",
          email: "",
          website: "",
          latitude: "",
          longitude: "",
          isActive: true,
          notes: "",
          leadSource: "",
          leadSourceDate: "",
          leadSourceNotes: "",
          conferenceName: "",
          conferenceDate: "",
        }
  );

  const { data: allClinics } = useQuery<Clinic[]>({
    queryKey: ["/api/clinics"],
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
      const data = initialData;
      setFormData(data ? {
        name: data.name,
        doctorName: data.doctorName || "",
        address: data.address || "",
        city: data.city || "",
        postalCode: data.postalCode || "",
        countryCode: data.countryCode,
        phone: data.phone || "",
        email: data.email || "",
        website: data.website || "",
        latitude: data.latitude || "",
        longitude: data.longitude || "",
        isActive: data.isActive,
        notes: data.notes || "",
        leadSource: data.leadSource || "",
        leadSourceDate: data.leadSourceDate ? new Date(data.leadSourceDate).toISOString().split("T")[0] : "",
        leadSourceNotes: data.leadSourceNotes || "",
        conferenceName: data.conferenceName || "",
        conferenceDate: data.conferenceDate ? new Date(data.conferenceDate).toISOString().split("T")[0] : "",
      } : {
        name: "", doctorName: "", address: "", city: "", postalCode: "", countryCode: "",
        phone: "", email: "", website: "", latitude: "", longitude: "",
        isActive: true, notes: "", leadSource: "", leadSourceDate: "", leadSourceNotes: "",
        conferenceName: "", conferenceDate: "",
      });
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
        conferenceDate: data.conferenceDate ? new Date(data.conferenceDate).toISOString() : null,
        leadSource: data.leadSource || null,
        leadSourceNotes: data.leadSourceNotes || null,
        conferenceName: data.conferenceName || null,
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
                {formData.website && (
                  <div className="mt-2 border rounded-lg overflow-hidden">
                    <div className="bg-muted p-2 flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{t.clinics.websitePreview || "Nahled"}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(getWebsiteUrl(formData.website), "_blank")}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        {t.clinics.openInNewTab || "Otvorit v novom okne"}
                      </Button>
                    </div>
                    <iframe
                      src={getWebsiteUrl(formData.website)}
                      className="w-full h-48 border-0"
                      title="Website preview"
                      sandbox="allow-scripts allow-same-origin"
                    />
                  </div>
                )}
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

            <TabsContent value="source" className="space-y-4 mt-4 pb-4">
              <div className="space-y-2">
                <Label>{t.clinics.leadSource}</Label>
                <RadioGroup
                  value={formData.leadSource}
                  onValueChange={(value) => setFormData({ ...formData, leadSource: value })}
                  className="grid gap-2"
                >
                  {LEAD_SOURCE_TYPES.map((type) => (
                    <div
                      key={type}
                      className={cn(
                        "flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-all",
                        formData.leadSource === type ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                      )}
                    >
                      <RadioGroupItem value={type} id={`source-${type}`} data-testid={`radio-source-${type}`} />
                      <Label htmlFor={`source-${type}`} className="flex-1 cursor-pointer">
                        <div className="font-medium">{t.clinics.leadSourceTypes?.[type as LeadSourceType] || type}</div>
                        <div className="text-sm text-muted-foreground">{t.clinics.leadSourceDesc?.[type as LeadSourceType] || ""}</div>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
                {formData.leadSource && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => setFormData({ ...formData, leadSource: "", leadSourceDate: "", leadSourceNotes: "", conferenceName: "", conferenceDate: "" })}
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
                      <Label>{t.clinics.leadSourceDate}</Label>
                      <Input
                        type="date"
                        value={formData.leadSourceDate}
                        onChange={(e) => setFormData({ ...formData, leadSourceDate: e.target.value })}
                        data-testid="input-lead-source-date"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t.clinics.leadSourceNotes}</Label>
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

              {formData.leadSource === "conference" && (
                <>
                  <Separator />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t.clinics.conferenceName}</Label>
                      <Input
                        value={formData.conferenceName}
                        onChange={(e) => setFormData({ ...formData, conferenceName: e.target.value })}
                        placeholder={t.clinics.conferenceName}
                        data-testid="input-conference-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t.clinics.conferenceDate}</Label>
                      <Input
                        type="date"
                        value={formData.conferenceDate}
                        onChange={(e) => setFormData({ ...formData, conferenceDate: e.target.value })}
                        data-testid="input-conference-date"
                      />
                    </div>
                  </div>
                </>
              )}

              {formData.leadSource === "doctor_referral" && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <Label>{t.clinics.referringDoctors}</Label>
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
                          <div key={ref.clinicId} className="flex items-center justify-between p-2 border rounded-lg bg-muted/30">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-primary" />
                              <span className="text-sm font-medium">{ref.clinicName}</span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeReferral(ref.clinicId)}
                              data-testid={`remove-referral-${ref.clinicId}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">{t.clinics.noReferrals}</p>
                    )}
                  </div>
                </>
              )}
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