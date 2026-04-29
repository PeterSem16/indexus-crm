import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Search, Building2, FileText, Award, Gift, ListChecks, FileEdit, MapPin, Navigation, ExternalLink, Database, Loader2, Globe, Stethoscope, RefreshCw, ChevronLeft, ChevronRight, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown, ArrowRight, Filter, X, Download, FileSpreadsheet, Target, UserCheck, UserX, GraduationCap, Users, ListFilter, Activity, ShieldCheck, ShieldOff, Hospital, Settings, StickyNote, Star, Phone, Mail, Smartphone, UserPlus, Save, Network, User, Baby, Calendar } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import EntityCampaignTimeline from "@/components/campaigns/EntityCampaignTimeline";
import { ClinicFormSheet } from "@/components/clinic-form-wizard";
import { CollaboratorsContent } from "@/pages/collaborators";
import { EntityFilter, type FilterRule, type FilterField, type FilterPreset } from "@/components/shared/EntityFilter";
import { InstitutionPersonnelPanel, InstitutionPersonnelManager } from "@/components/institution-personnel-panel";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/i18n";
import { usePermissions } from "@/contexts/permissions-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { useCountryFilter } from "@/contexts/country-filter-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getCountryFlag, getCountryName } from "@/lib/countries";
import { REGIONS_BY_COUNTRY, DISTRICTS_BY_REGION, getAutoRegion, getAutoDistrict, getDistrictsForRegion, getGeoLabels } from "@/lib/regions";
import { SuggestRegionButton } from "@/components/suggest-region-button";
import { EnrichFromWebDialog } from "@/components/enrich-from-web-dialog";
import type { Hospital as HospitalType, Laboratory, SafeUser, Clinic } from "@shared/schema";
import { COUNTRIES } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

interface HospitalFormData {
  isActive: boolean;
  name: string;
  fullName: string;
  streetNumber: string;
  representativeId: string;
  city: string;
  laboratoryId: string;
  postalCode: string;
  autoRecruiting: boolean;
  region: string;
  district: string;
  responsiblePersonId: string;
  countryCode: string;
  contactPerson: string;
  svetZdravia: boolean;
  latitude: string;
  longitude: string;
}

const defaultFormData: HospitalFormData = {
  isActive: true,
  name: "",
  fullName: "",
  streetNumber: "",
  representativeId: "",
  city: "",
  laboratoryId: "",
  postalCode: "",
  autoRecruiting: false,
  region: "",
  district: "",
  responsiblePersonId: "",
  countryCode: "",
  contactPerson: "",
  svetZdravia: false,
  latitude: "",
  longitude: "",
};

function getLocalizedCategoryName(cat: any, locale: string): string {
  const localeMap: Record<string, string | null> = {
    sk: cat.nameSk || cat.name_sk, cs: cat.nameCs || cat.name_cs, en: cat.nameEn || cat.name_en,
    hu: cat.nameHu || cat.name_hu, ro: cat.nameRo || cat.name_ro, it: cat.nameIt || cat.name_it, de: cat.nameDe || cat.name_de,
  };
  return localeMap[locale] || cat.name || "";
}

function PersonnelTabContent({ entityType, entityId, entityName }: { entityType: string; entityId: string; entityName: string }) {
  const { t, locale } = useI18n();
  const { data: personnelData, isLoading } = useQuery<any>({
    queryKey: ["/api/institutions", entityType, entityId, "personnel"],
    queryFn: () => fetch(`/api/institutions/${entityType}/${entityId}/personnel`, { credentials: "include" }).then(r => r.json()),
  });
  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["/api/mpn/categories"],
  });

  if (isLoading) {
    return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>;
  }

  const assigned: any[] = personnelData?.assigned || [];
  const legacy: any[] = personnelData?.legacy || [];
  const allPersonnel = [...assigned, ...legacy];

  if (allPersonnel.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm">{(t as any).medicalPartnerNetwork?.noPersonnel || "No personnel assigned"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="personnel-tab-content">
      <div className="flex items-center gap-2 mb-4">
        <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800">
          <Users className="h-3 w-3 mr-1" />
          {allPersonnel.length}
        </Badge>
        <span className="text-sm text-muted-foreground">{(t as any).medicalPartnerNetwork?.personnelAssigned || "personnel assigned"}</span>
      </div>
      {allPersonnel.map((row: any) => {
        const fullName = `${row.title_before || ""} ${row.first_name || ""} ${row.last_name || ""} ${row.title_after || ""}`.trim();
        return (
          <div key={row.assignment_id || row.person_id} className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow" data-testid={`personnel-row-${row.assignment_id || row.person_id}`}>
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
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800 inline-flex items-center gap-1" title={names} data-testid={`badge-hospital-personnel-recommended-by-${row.person_id}`}>
                      <UserCheck className="h-2.5 w-2.5" />
                      {label}
                    </Badge>
                  );
                })()}
                {row.category_name && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">{
                    row.category_id
                      ? getLocalizedCategoryName(categories.find((c: any) => c.id === row.category_id) || { name: row.category_name }, locale)
                      : row.category_name
                  }</Badge>
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
  );
}


export function HospitalEditDrawer({ hospital, onClose, onSuccess }: { hospital: HospitalType; onClose: () => void; onSuccess: () => void }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState("basic");
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [showMapDialog, setShowMapDialog] = useState(false);

  const [formData, setFormData] = useState<HospitalFormData>({
    isActive: hospital.isActive,
    name: hospital.name,
    fullName: hospital.fullName || "",
    streetNumber: hospital.streetNumber || "",
    representativeId: hospital.representativeId || "",
    city: hospital.city || "",
    laboratoryId: hospital.laboratoryId || "",
    postalCode: hospital.postalCode || "",
    autoRecruiting: hospital.autoRecruiting,
    region: hospital.region || "",
    district: hospital.district || "",
    responsiblePersonId: hospital.responsiblePersonId || "",
    countryCode: hospital.countryCode,
    contactPerson: hospital.contactPerson || "",
    svetZdravia: hospital.svetZdravia,
    latitude: hospital.latitude || "",
    longitude: hospital.longitude || "",
  });

  const { data: users = [] } = useQuery<SafeUser[]>({ queryKey: ["/api/users"] });
  const { data: laboratories = [] } = useQuery<Laboratory[]>({ queryKey: ["/api/config/laboratories"] });
  const filteredLaboratories = formData.countryCode ? laboratories.filter((lab) => lab.countryCode === formData.countryCode) : laboratories;

  const saveMutation = useMutation({
    mutationFn: (data: HospitalFormData) => apiRequest("PUT", `/api/hospitals/${hospital.id}`, data),
    onSuccess: (_res, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/hospitals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hospitals/stats"] });
      if (variables.svetZdravia) {
        queryClient.invalidateQueries({ queryKey: ["/api/hospital-network-memberships"] });
        queryClient.invalidateQueries({ queryKey: ["/api/hospital-networks"] });
      }
      toast({ title: t.success.saved });
      onSuccess();
    },
    onError: () => { toast({ title: t.errors.saveFailed, variant: "destructive" }); },
  });

  const handleSubmit = () => {
    if (!(formData.fullName || formData.name) || !formData.countryCode) {
      toast({ title: t.errors.required, variant: "destructive" });
      return;
    }
    const data = { ...formData };
    if (!data.name) data.name = data.fullName;
    saveMutation.mutate(data);
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) { toast({ title: t.clinics.gpsNotSupported, variant: "destructive" }); return; }
    setIsLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData({ ...formData, latitude: position.coords.latitude.toFixed(7), longitude: position.coords.longitude.toFixed(7) });
        setIsLoadingLocation(false);
        toast({ title: t.clinics.gpsLoaded });
      },
      (error) => {
        setIsLoadingLocation(false);
        toast({ title: error.code === error.PERMISSION_DENIED ? t.clinics.gpsPermissionDenied : t.clinics.gpsError, variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const { data: drawerNetworkMemberships = [] } = useQuery<any[]>({
    queryKey: ["/api/hospital-network-memberships"],
  });
  const hospitalNetworks = drawerNetworkMemberships.filter((m: any) => m.hospital_id === String(hospital.id)).map((m: any) => m.network_name).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i);

  const mpnT = (t as any).medicalPartnerNetwork || {};
  const [showLaboratory, setShowLaboratory] = useState(false);
  const sections = [
    { id: "basic", label: t.clinics.steps.basic, icon: Building2 },
    { id: "personnel", label: mpnT.personnel || "Personnel", icon: Users },
    { id: "campaigns", label: (t as any).campaigns?.title || "Campaigns", icon: Target },
  ];

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] animate-in fade-in duration-200" onClick={onClose} data-testid="hospital-edit-backdrop" />
      <div className="fixed inset-y-0 right-0 z-[51] w-[960px] max-w-[95vw] bg-background border-l shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
        <div className="shrink-0 flex items-center justify-between px-5 py-3.5 border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold" data-testid="text-hospital-drawer-name">{hospital.fullName || hospital.name}</h2>
                {hospitalNetworks.map((netName: string) => (
                  <Badge key={netName} className="text-[10px] px-1.5 py-0 font-bold bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/60 dark:text-amber-300 dark:border-amber-700" data-testid="badge-hospital-network-drawer">
                    <Network className="h-2.5 w-2.5 mr-0.5" />
                    {netName}
                  </Badge>
                ))}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0" data-testid="badge-hospital-drawer-country">
                  {getCountryFlag(hospital.countryCode)} {getCountryName(hospital.countryCode)}
                </Badge>
                {hospital.city && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{hospital.city}</Badge>}
                <Badge className={`text-[10px] px-1.5 py-0 ${hospital.isActive ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"}`}>
                  {hospital.isActive ? t.common.active : t.common.inactive}
                </Badge>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onClose} data-testid="button-close-hospital-drawer">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="w-44 border-r bg-muted/20 flex flex-col py-3 shrink-0 overflow-y-auto">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "flex items-center gap-2.5 px-4 py-2 text-sm transition-colors text-left",
                    activeSection === section.id
                      ? "bg-primary/10 text-primary font-medium border-r-2 border-primary"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                  data-testid={`nav-hospital-section-${section.id}`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{section.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {activeSection === "basic" && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="ed-fullName">{t.hospitals.fullName} *</Label>
                  <Input id="ed-fullName" value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value, name: e.target.value })} placeholder={t.hospitals.fullName} data-testid="input-ed-hospital-fullname" />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ed-country">{t.common.country} *</Label>
                    <Select value={formData.countryCode} onValueChange={(value) => {
                      const newRegion = getAutoRegion(value, formData.city);
                      const newDistrict = getAutoDistrict(value, formData.city);
                      setFormData({ ...formData, countryCode: value, laboratoryId: "", region: newRegion || formData.region, district: newDistrict || formData.district });
                    }}>
                      <SelectTrigger data-testid="select-ed-hospital-country"><SelectValue placeholder={t.common.country} /></SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((country) => (<SelectItem key={country.code} value={country.code}>{getCountryFlag(country.code)} {country.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> {t.clinics.steps.address}</h3>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>{t.hospitals.streetNumber}</Label>
                      <Input value={formData.streetNumber} onChange={(e) => setFormData({ ...formData, streetNumber: e.target.value })} data-testid="input-ed-hospital-street" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t.hospitals.city}</Label>
                      <Input value={formData.city} onChange={(e) => {
                        const newCity = e.target.value;
                        const newRegion = getAutoRegion(formData.countryCode, newCity);
                        const newDistrict = getAutoDistrict(formData.countryCode, newCity);
                        setFormData({ ...formData, city: newCity, region: newRegion || formData.region, district: newDistrict || formData.district });
                      }} data-testid="input-ed-hospital-city" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t.hospitals.postalCode}</Label>
                      <Input value={formData.postalCode} onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })} data-testid="input-ed-hospital-postalcode" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <div className="space-y-2 flex-1">
                      <Label>{getGeoLabels(formData.countryCode).region}</Label>
                      <Select value={formData.region || ""} onValueChange={(value) => setFormData({ ...formData, region: value, district: "" })}>
                        <SelectTrigger data-testid="select-ed-hospital-region"><SelectValue placeholder={getGeoLabels(formData.countryCode).region} /></SelectTrigger>
                        <SelectContent>
                          {(REGIONS_BY_COUNTRY[formData.countryCode] || []).map((r: string) => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                          {formData.region && !(REGIONS_BY_COUNTRY[formData.countryCode] || []).includes(formData.region) && (
                            <SelectItem value={formData.region}>{formData.region}</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="pt-6">
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
                  <div className="space-y-2 mt-3">
                    <Label>{getGeoLabels(formData.countryCode).district}</Label>
                    <Select value={formData.district || ""} onValueChange={(value) => setFormData({ ...formData, district: value })}>
                      <SelectTrigger data-testid="select-ed-hospital-district"><SelectValue placeholder={getGeoLabels(formData.countryCode).district} /></SelectTrigger>
                      <SelectContent>
                        {getDistrictsForRegion(formData.countryCode, formData.region, formData.district).map((d: string) => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-sm font-medium">{t.clinics.gpsCoordinates}</Label>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={handleGetCurrentLocation} disabled={isLoadingLocation} data-testid="button-ed-get-location">
                          <Navigation className={`h-4 w-4 mr-2 ${isLoadingLocation ? 'animate-spin' : ''}`} />
                          {isLoadingLocation ? t.common.loading : t.clinics.getCurrentLocation}
                        </Button>
                        {formData.latitude && formData.longitude && (
                          <Button type="button" variant="outline" size="sm" onClick={() => setShowMapDialog(true)} data-testid="button-ed-show-on-map">
                            <ExternalLink className="h-4 w-4 mr-2" />{t.clinics.showOnMap}
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{t.clinics.latitude}</Label>
                        <Input type="number" step="0.0000001" value={formData.latitude} onChange={(e) => setFormData({ ...formData, latitude: e.target.value })} placeholder="48.7164" data-testid="input-ed-hospital-latitude" />
                      </div>
                      <div className="space-y-2">
                        <Label>{t.clinics.longitude}</Label>
                        <Input type="number" step="0.0000001" value={formData.longitude} onChange={(e) => setFormData({ ...formData, longitude: e.target.value })} placeholder="21.2611" data-testid="input-ed-hospital-longitude" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2"><Settings className="h-3.5 w-3.5" /> {t.clinics.steps.settings}</h3>
                  <div className="flex flex-wrap gap-6">
                    <div className="flex items-center space-x-2">
                      <Switch id="ed-isActive" checked={formData.isActive} onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })} data-testid="switch-ed-hospital-active" />
                      <Label htmlFor="ed-isActive">{t.common.active}</Label>
                    </div>
                    
                  </div>
                </div>

                {showLaboratory ? (
                  <div className="border-t pt-4">
                    <div className="space-y-2">
                      <Label>{t.hospitals.laboratory}</Label>
                      <Select value={formData.laboratoryId || "_none"} onValueChange={(value) => setFormData({ ...formData, laboratoryId: value === "_none" ? "" : value })}>
                        <SelectTrigger data-testid="select-ed-hospital-laboratory"><SelectValue placeholder={t.hospitals.laboratory} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">{t.common.noData}</SelectItem>
                          {filteredLaboratories.map((lab) => (<SelectItem key={lab.id} value={lab.id}>{lab.name}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : (
                  <div className="border-t pt-3">
                    <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setShowLaboratory(true)} data-testid="button-show-laboratory">
                      <Database className="h-3 w-3 mr-1.5" /> {t.hospitals.laboratory}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {activeSection === "personnel" && (
              <InstitutionPersonnelManager entityType="hospital" entityId={hospital.id} entityName={hospital.fullName || hospital.name} countryCode={hospital.countryCode} />
            )}

            {activeSection === "campaigns" && (
              <EntityCampaignTimeline entityType="hospital" entityId={hospital.id} entityName={hospital.fullName || hospital.name} />
            )}
          </div>
        </div>

        <div className="shrink-0 border-t bg-muted/30 px-5 py-3 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-hospital-drawer">{t.common.cancel}</Button>
          <Button onClick={handleSubmit} disabled={saveMutation.isPending} data-testid="button-save-hospital-drawer">
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
            {t.common.save}
          </Button>
        </div>
      </div>

      <Dialog open={showMapDialog} onOpenChange={setShowMapDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {formData.name || t.hospitals.title} - {t.clinics.sections?.mapLocation || "Map location"}
            </DialogTitle>
          </DialogHeader>
          <div className="w-full h-[400px] rounded-lg overflow-hidden border">
            {formData.latitude && formData.longitude && (
              <iframe title="Hospital Location Map" width="100%" height="100%" frameBorder="0" style={{ border: 0 }}
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(formData.longitude) - 0.01}%2C${parseFloat(formData.latitude) - 0.01}%2C${parseFloat(formData.longitude) + 0.01}%2C${parseFloat(formData.latitude) + 0.01}&layer=mapnik&marker=${formData.latitude}%2C${formData.longitude}`}
                allowFullScreen />
            )}
          </div>
          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <span>GPS: {formData.latitude}, {formData.longitude}</span>
            <Button variant="outline" size="sm" onClick={() => window.open(`https://www.google.com/maps?q=${formData.latitude},${formData.longitude}`, '_blank')} data-testid="button-ed-open-google-maps">
              <ExternalLink className="h-4 w-4 mr-2" />{t.clinics.openInNewTab}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function HospitalAddDrawer({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState("basic");
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [showMapDialog, setShowMapDialog] = useState(false);
  const [formData, setFormData] = useState<HospitalFormData>(defaultFormData);
  const [showLaboratory, setShowLaboratory] = useState(false);

  const { data: users = [] } = useQuery<SafeUser[]>({ queryKey: ["/api/users"] });
  const { data: laboratories = [] } = useQuery<Laboratory[]>({ queryKey: ["/api/config/laboratories"] });
  const filteredLaboratories = formData.countryCode ? laboratories.filter((lab) => lab.countryCode === formData.countryCode) : laboratories;

  const saveMutation = useMutation({
    mutationFn: (data: HospitalFormData) => apiRequest("POST", "/api/hospitals", data),
    onSuccess: () => {
      toast({ title: t.success.saved });
      onSuccess();
    },
    onError: () => { toast({ title: t.errors.saveFailed, variant: "destructive" }); },
  });

  const handleSubmit = () => {
    if (!(formData.fullName || formData.name) || !formData.countryCode) {
      toast({ title: t.errors.required, variant: "destructive" });
      return;
    }
    const data = { ...formData };
    if (!data.name) data.name = data.fullName;
    saveMutation.mutate(data);
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) { toast({ title: t.clinics.gpsNotSupported, variant: "destructive" }); return; }
    setIsLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData({ ...formData, latitude: position.coords.latitude.toFixed(7), longitude: position.coords.longitude.toFixed(7) });
        setIsLoadingLocation(false);
        toast({ title: t.clinics.gpsLoaded });
      },
      (error) => {
        setIsLoadingLocation(false);
        toast({ title: error.code === error.PERMISSION_DENIED ? t.clinics.gpsPermissionDenied : t.clinics.gpsError, variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const mpnT = (t as any).medicalPartnerNetwork || {};
  const sections = [
    { id: "basic", label: t.clinics.steps.basic, icon: Building2 },
    { id: "personnel", label: mpnT.personnel || "Personnel", icon: Users },
    { id: "campaigns", label: (t as any).campaigns?.title || "Campaigns", icon: Target },
  ];

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] animate-in fade-in duration-200" onClick={onClose} data-testid="hospital-add-backdrop" />
      <div className="fixed inset-y-0 right-0 z-[51] w-[960px] max-w-[95vw] bg-background border-l shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
        <div className="shrink-0 flex items-center justify-between px-5 py-3.5 border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold" data-testid="text-hospital-add-drawer-title">{t.hospitals.addHospital}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{t.hospitals.addHospitalDesc}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onClose} data-testid="button-close-hospital-add-drawer">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="w-44 border-r bg-muted/20 flex flex-col py-3 shrink-0 overflow-y-auto">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "flex items-center gap-2.5 px-4 py-2 text-sm transition-colors text-left",
                    activeSection === section.id
                      ? "bg-primary/10 text-primary font-medium border-r-2 border-primary"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                  data-testid={`nav-hospital-add-section-${section.id}`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{section.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {activeSection === "basic" && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label>{t.hospitals.fullName} *</Label>
                  <Input value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value, name: e.target.value })} placeholder={t.hospitals.fullName} data-testid="input-hospital-fullname" />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t.common.country} *</Label>
                    <Select value={formData.countryCode} onValueChange={(value) => {
                      const newRegion = getAutoRegion(value, formData.city);
                      const newDistrict = getAutoDistrict(value, formData.city);
                      setFormData({ ...formData, countryCode: value, laboratoryId: "", region: newRegion || formData.region, district: newDistrict || formData.district });
                    }}>
                      <SelectTrigger data-testid="select-hospital-country"><SelectValue placeholder={t.common.country} /></SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((country) => (<SelectItem key={country.code} value={country.code}>{getCountryFlag(country.code)} {country.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> {t.clinics.steps.address}</h3>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>{t.hospitals.streetNumber}</Label>
                      <Input value={formData.streetNumber} onChange={(e) => setFormData({ ...formData, streetNumber: e.target.value })} data-testid="input-hospital-street" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t.hospitals.city}</Label>
                      <Input value={formData.city} onChange={(e) => {
                        const newCity = e.target.value;
                        const newRegion = getAutoRegion(formData.countryCode, newCity);
                        const newDistrict = getAutoDistrict(formData.countryCode, newCity);
                        setFormData({ ...formData, city: newCity, region: newRegion || formData.region, district: newDistrict || formData.district });
                      }} data-testid="input-hospital-city" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t.hospitals.postalCode}</Label>
                      <Input value={formData.postalCode} onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })} data-testid="input-hospital-postalcode" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <div className="space-y-2 flex-1">
                      <Label>{getGeoLabels(formData.countryCode).region}</Label>
                      <Select value={formData.region || ""} onValueChange={(value) => setFormData({ ...formData, region: value, district: "" })}>
                        <SelectTrigger data-testid="select-hospital-region"><SelectValue placeholder={getGeoLabels(formData.countryCode).region} /></SelectTrigger>
                        <SelectContent>
                          {(REGIONS_BY_COUNTRY[formData.countryCode] || []).map((r: string) => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                          {formData.region && !(REGIONS_BY_COUNTRY[formData.countryCode] || []).includes(formData.region) && (
                            <SelectItem value={formData.region}>{formData.region}</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="pt-6">
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
                  <div className="space-y-2 mt-3">
                    <Label>{getGeoLabels(formData.countryCode).district}</Label>
                    <Select value={formData.district || ""} onValueChange={(value) => setFormData({ ...formData, district: value })}>
                      <SelectTrigger data-testid="select-hospital-district"><SelectValue placeholder={getGeoLabels(formData.countryCode).district} /></SelectTrigger>
                      <SelectContent>
                        {getDistrictsForRegion(formData.countryCode, formData.region, formData.district).map((d: string) => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-sm font-medium">{t.clinics.gpsCoordinates}</Label>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={handleGetCurrentLocation} disabled={isLoadingLocation} data-testid="button-get-location">
                          {isLoadingLocation ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Navigation className="h-4 w-4 mr-2" />}
                          {t.clinics.getCurrentLocation}
                        </Button>
                        {formData.latitude && formData.longitude && (
                          <Button type="button" variant="outline" size="sm" onClick={() => setShowMapDialog(true)} data-testid="button-show-map">
                            <ExternalLink className="h-4 w-4 mr-2" />{t.clinics.showOnMap}
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{t.clinics.latitude}</Label>
                        <Input type="number" step="0.0000001" value={formData.latitude} onChange={(e) => setFormData({ ...formData, latitude: e.target.value })} placeholder="48.7164" data-testid="input-hospital-latitude" />
                      </div>
                      <div className="space-y-2">
                        <Label>{t.clinics.longitude}</Label>
                        <Input type="number" step="0.0000001" value={formData.longitude} onChange={(e) => setFormData({ ...formData, longitude: e.target.value })} placeholder="21.2611" data-testid="input-hospital-longitude" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2"><Settings className="h-3.5 w-3.5" /> {t.clinics.steps.settings}</h3>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Switch checked={formData.isActive} onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })} data-testid="switch-hospital-active" />
                      <Label>{t.common.active}</Label>
                    </div>
                  </div>
                </div>

                {showLaboratory ? (
                  <div className="border-t pt-4">
                    <div className="space-y-2">
                      <Label>{t.hospitals.laboratory}</Label>
                      <Select value={formData.laboratoryId || "_none"} onValueChange={(value) => setFormData({ ...formData, laboratoryId: value === "_none" ? "" : value })}>
                        <SelectTrigger data-testid="select-hospital-laboratory"><SelectValue placeholder={t.hospitals.laboratory} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">{t.common.noData}</SelectItem>
                          {filteredLaboratories.map((lab) => (<SelectItem key={lab.id} value={lab.id}>{lab.name}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : (
                  <div className="border-t pt-3">
                    <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setShowLaboratory(true)} data-testid="button-show-laboratory">
                      <Database className="h-3 w-3 mr-1.5" /> {t.hospitals.laboratory}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {activeSection === "personnel" && (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <Users className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-sm">{mpnT.noPersonnel || "Personnel can be added after saving."}</p>
              </div>
            )}

            {activeSection === "campaigns" && (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <Target className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-sm">{(t as any).campaigns?.noCampaigns || "Campaigns can be added after saving."}</p>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t bg-muted/30 px-5 py-3 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-hospital-add">{t.common.cancel}</Button>
          <Button onClick={handleSubmit} disabled={saveMutation.isPending} data-testid="button-save-hospital-add">
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
            {t.common.save}
          </Button>
        </div>
      </div>

      <Dialog open={showMapDialog} onOpenChange={setShowMapDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {formData.name || t.hospitals.title} - {t.clinics.sections?.mapLocation || "Map location"}
            </DialogTitle>
          </DialogHeader>
          <div className="w-full h-[400px] rounded-lg overflow-hidden border">
            {formData.latitude && formData.longitude && (
              <iframe title="Hospital Location Map" width="100%" height="100%" frameBorder="0" style={{ border: 0 }}
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(formData.longitude) - 0.01}%2C${parseFloat(formData.latitude) - 0.01}%2C${parseFloat(formData.longitude) + 0.01}%2C${parseFloat(formData.latitude) + 0.01}&layer=mapnik&marker=${formData.latitude}%2C${formData.longitude}`}
                allowFullScreen />
            )}
          </div>
          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <span>GPS: {formData.latitude}, {formData.longitude}</span>
            <Button variant="outline" size="sm" onClick={() => window.open(`https://www.google.com/maps?q=${formData.latitude},${formData.longitude}`, '_blank')} data-testid="button-open-google-maps">
              <ExternalLink className="h-4 w-4 mr-2" />{t.clinics.openInNewTab}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}


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
}

const defaultClinicFormData: ClinicFormData = {
  name: "",
  doctorName: "",
  address: "",
  city: "",
  postalCode: "",
  countryCode: "SK",
  phone: "",
  email: "",
  website: "",
  latitude: "",
  longitude: "",
  isActive: true,
  notes: "",
};

function ClinicForm({
  clinic,
  onClose,
  onSuccess,
}: {
  clinic?: Clinic;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [showWebsitePreview, setShowWebsitePreview] = useState(false);

  const [formData, setFormData] = useState<ClinicFormData>(() =>
    clinic
      ? {
          name: clinic.name,
          doctorName: clinic.doctorName || "",
          address: clinic.address || "",
          city: clinic.city || "",
          postalCode: clinic.postalCode || "",
          countryCode: clinic.countryCode,
          phone: clinic.phone || "",
          email: clinic.email || "",
          website: clinic.website || "",
          latitude: clinic.latitude || "",
          longitude: clinic.longitude || "",
          isActive: clinic.isActive,
          notes: clinic.notes || "",
        }
      : defaultClinicFormData
  );

  const saveMutation = useMutation({
    mutationFn: (data: ClinicFormData) => {
      if (clinic) {
        return apiRequest("PUT", `/api/clinics/${clinic.id}`, data);
      } else {
        return apiRequest("POST", "/api/clinics", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clinics/stats"] });
      toast({ title: t.success.saved });
      onSuccess();
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.countryCode) {
      toast({ title: t.errors.required, variant: "destructive" });
      return;
    }
    saveMutation.mutate(formData);
  };

  const getWebsiteUrl = (url: string) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    return `https://${url}`;
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">{t.clinics.name} *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={t.clinics.name}
              data-testid="input-clinic-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="doctorName">{t.clinics.doctorName}</Label>
            <Input
              id="doctorName"
              value={formData.doctorName}
              onChange={(e) => setFormData({ ...formData, doctorName: e.target.value })}
              placeholder={t.clinics.doctorName}
              data-testid="input-clinic-doctor"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="countryCode">{t.common.country} *</Label>
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
          <div className="space-y-2">
            <Label htmlFor="phone">{t.clinics.phone}</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder={t.clinics.phone}
              data-testid="input-clinic-phone"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email">{t.clinics.email}</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder={t.clinics.email}
              data-testid="input-clinic-email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">{t.clinics.website}</Label>
            <div className="flex gap-2">
              <Input
                id="website"
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
                  onClick={() => setShowWebsitePreview(true)}
                  data-testid="button-preview-website"
                >
                  <Globe className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="address">{t.clinics.address}</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder={t.clinics.address}
              data-testid="input-clinic-address"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">{t.clinics.city}</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder={t.clinics.city}
              data-testid="input-clinic-city"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="postalCode">{t.clinics.postalCode}</Label>
            <Input
              id="postalCode"
              value={formData.postalCode}
              onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
              placeholder={t.clinics.postalCode}
              data-testid="input-clinic-postalcode"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="latitude">{t.clinics.latitude}</Label>
            <Input
              id="latitude"
              type="number"
              step="0.0000001"
              value={formData.latitude}
              onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
              placeholder="48.7164"
              data-testid="input-clinic-latitude"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="longitude">{t.clinics.longitude}</Label>
            <Input
              id="longitude"
              type="number"
              step="0.0000001"
              value={formData.longitude}
              onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
              placeholder="21.2611"
              data-testid="input-clinic-longitude"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">{t.clinics.notes}</Label>
          <Input
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder={t.clinics.notes}
            data-testid="input-clinic-notes"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="isActive"
            checked={formData.isActive}
            onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
            data-testid="switch-clinic-active"
          />
          <Label htmlFor="isActive">{t.common.active}</Label>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel-clinic">
            {t.common.cancel}
          </Button>
          <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save-clinic">
            {saveMutation.isPending ? t.common.loading : t.common.save}
          </Button>
        </div>
      </form>

      {clinic && (
        <div className="mt-4">
          <EntityCampaignTimeline entityType="clinic" entityId={clinic.id} entityName={clinic.name} />
        </div>
      )}

      <Dialog open={showWebsitePreview} onOpenChange={setShowWebsitePreview}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              {t.clinics.website}: {formData.website}
            </DialogTitle>
          </DialogHeader>
          <div className="w-full h-[600px] rounded-lg overflow-hidden border">
            <iframe
              title="Website Preview"
              width="100%"
              height="100%"
              src={getWebsiteUrl(formData.website)}
              sandbox="allow-scripts allow-same-origin"
              className="bg-white"
            />
          </div>
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => window.open(getWebsiteUrl(formData.website), "_blank")}
              data-testid="button-open-website-new-tab"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {t.clinics.openWebsite}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function NetworkFormSheet({ open, onOpenChange, network, onSuccess }: { open: boolean; onOpenChange: (v: boolean) => void; network?: any; onSuccess: () => void }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const isEdit = !!network;
  const [form, setForm] = useState({
    name: "", fullName: "", countryCode: "SK", description: "", address: "", city: "",
    postalCode: "", region: "", phone: "", email: "", website: "", contactPerson: "",
  });

  useEffect(() => {
    if (network) {
      setForm({
        name: network.name || "", fullName: network.fullName || "", countryCode: network.countryCode || "SK",
        description: network.description || "", address: network.address || "", city: network.city || "",
        postalCode: network.postalCode || "", region: network.region || "", phone: network.phone || "",
        email: network.email || "", website: network.website || "", contactPerson: network.contactPerson || "",
      });
    } else {
      setForm({ name: "", fullName: "", countryCode: "SK", description: "", address: "", city: "",
        postalCode: "", region: "", phone: "", email: "", website: "", contactPerson: "" });
    }
  }, [network, open]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        await apiRequest("PATCH", `/api/hospital-networks/${network.id}`, form);
      } else {
        await apiRequest("POST", "/api/hospital-networks", form);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hospital-networks"] });
      toast({ title: t.success?.saved || "Saved" });
      onOpenChange(false);
      onSuccess();
    },
    onError: () => { toast({ title: t.errors?.saveFailed || "Error", variant: "destructive" }); },
  });

  const regions = REGIONS_BY_COUNTRY[form.countryCode] || [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[520px] sm:max-w-[520px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Network className="h-5 w-5 text-amber-600" />
            {isEdit ? (t.common?.edit || "Edit") : (t.common?.add || "Add")} - {t.hospitals?.tabs?.healthcareNetworks || "Healthcare Network"}
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          <div className="grid gap-3 grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">{t.common?.name || "Name"} *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Svet zdravia" data-testid="input-network-name" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t.hospitals?.fullName || "Full Name"}</Label>
              <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} data-testid="input-network-fullname" />
            </div>
          </div>
          <div className="grid gap-3 grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">{t.common?.country || "Country"} *</Label>
              <Select value={form.countryCode} onValueChange={(v) => { const newRegion = getAutoRegion(v, form.city); setForm({ ...form, countryCode: v, region: newRegion || "" }); }}>
                <SelectTrigger data-testid="select-network-country"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c: any) => (
                    <SelectItem key={c.code} value={c.code}>{getCountryFlag(c.code)} {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t.hospitals?.region || "Region"}</Label>
              <Select value={form.region || ""} onValueChange={(v) => setForm({ ...form, region: v })}>
                <SelectTrigger data-testid="select-network-region"><SelectValue placeholder={t.hospitals?.region || "Region"} /></SelectTrigger>
                <SelectContent>
                  {regions.map((r: string) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Separator />
          <div className="grid gap-3 grid-cols-2">
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">{t.hospitals?.streetNumber || "Address"}</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} data-testid="input-network-address" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t.hospitals?.city || "City"}</Label>
              <Input value={form.city} onChange={(e) => { const newCity = e.target.value; const newRegion = getAutoRegion(form.countryCode, newCity); setForm({ ...form, city: newCity, region: newRegion || form.region }); }} data-testid="input-network-city" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t.hospitals?.postalCode || "Postal Code"}</Label>
              <Input value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} data-testid="input-network-postalcode" />
            </div>
          </div>
          <Separator />
          <div className="grid gap-3 grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">{t.hospitals?.phone || "Phone"}</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="input-network-phone" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t.hospitals?.email || "Email"}</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" data-testid="input-network-email" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t.clinics?.website || "Website"}</Label>
              <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} data-testid="input-network-website" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t.hospitals?.contactPerson || "Contact Person"}</Label>
              <Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} data-testid="input-network-contact" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t.common?.description || "Description"}</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} data-testid="input-network-desc" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t.common?.cancel || "Cancel"}</Button>
            <Button onClick={() => saveMut.mutate()} disabled={!form.name || saveMut.isPending} data-testid="button-save-network">
              {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              {t.common?.save || "Save"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function HospitalNetworksTab() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { selectedCountries } = useCountryFilter();
  const [formOpen, setFormOpen] = useState(false);
  const [editNetwork, setEditNetwork] = useState<any>(null);
  const [addMemberOpen, setAddMemberOpen] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");

  const { data: networks = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/hospital-networks"],
  });

  const filtered = useMemo(() => {
    if (!selectedCountries.length) return networks;
    return networks.filter((n: any) => selectedCountries.includes(n.countryCode));
  }, [networks, selectedCountries]);

  const { data: allHospitals = [] } = useQuery<any[]>({ queryKey: ["/api/hospitals"] });
  const { data: allClinics = [] } = useQuery<any[]>({ queryKey: ["/api/clinics/lookup"] });
  const { data: allCollaborators = [] } = useQuery<any[]>({ queryKey: ["/api/collaborators"] });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/hospital-networks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hospital-networks"] });
      toast({ title: t.success?.deleted || "Deleted" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Network className="h-5 w-5 text-amber-600" />
          {t.hospitals.tabs.healthcareNetworks}
        </h3>
        <Button size="sm" onClick={() => { setEditNetwork(null); setFormOpen(true); }} data-testid="button-create-network">
          <Plus className="h-4 w-4 mr-1" />
          {t.common?.add || "Add"}
        </Button>
      </div>

      {isLoading && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}

      {!isLoading && filtered.length === 0 && (
        <Card>
          <CardContent className="text-center py-8 text-muted-foreground">
            {t.clinics.noNetworks || 'No healthcare networks'}
          </CardContent>
        </Card>
      )}

      {filtered.map((net: any) => (
        <NetworkCard key={net.id} network={net} allHospitals={allHospitals} allClinics={allClinics} allCollaborators={allCollaborators}
          onEdit={() => { setEditNetwork(net); setFormOpen(true); }}
          onDelete={() => deleteMut.mutate(net.id)}
          addMemberOpen={addMemberOpen} setAddMemberOpen={setAddMemberOpen}
          memberSearch={memberSearch} setMemberSearch={setMemberSearch}
        />
      ))}

      <NetworkFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        network={editNetwork}
        onSuccess={() => setEditNetwork(null)}
      />
    </div>
  );
}

function NetworkCard({ network, allHospitals, allClinics, allCollaborators, onEdit, onDelete, addMemberOpen, setAddMemberOpen, memberSearch, setMemberSearch }: any) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState("details");

  const { data: members = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/hospital-networks", network.id, "members"],
    queryFn: async () => {
      const res = await fetch(`/api/hospital-networks/${network.id}/members`, { credentials: "include" });
      return res.json();
    },
    enabled: expanded,
  });

  const addMemberMut = useMutation({
    mutationFn: async (data: { hospitalId?: string; clinicId?: string; collaboratorId?: string }) => {
      await apiRequest("POST", `/api/hospital-networks/${network.id}/members`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hospital-networks", network.id, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hospital-network-memberships"] });
      setAddMemberOpen(null); setMemberSearch("");
      toast({ title: t.success?.saved || "Saved" });
    },
    onError: (e: any) => {
      toast({ title: e.message || "Error", variant: "destructive" });
    },
  });

  const removeMemberMut = useMutation({
    mutationFn: async (memberId: string) => {
      await apiRequest("DELETE", `/api/hospital-network-members/${memberId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hospital-networks", network.id, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hospital-network-memberships"] });
      toast({ title: t.success?.deleted || "Removed" });
    },
  });

  const memberIds = new Set(members.map((m: any) => m.hospital_id || m.clinic_id || m.collaborator_id));
  const collabList = (allCollaborators?.data || allCollaborators || []);
  const s = memberSearch.toLowerCase();
  const filteredHospitals = s ? allHospitals.filter((h: any) =>
    !memberIds.has(String(h.id)) && h.countryCode === network.countryCode &&
    ((h.fullName || h.name)?.toLowerCase().includes(s) || h.city?.toLowerCase().includes(s))
  ).slice(0, 10) : [];
  const filteredClinics = s ? allClinics.filter((c: any) =>
    !memberIds.has(String(c.id)) && c.countryCode === network.countryCode &&
    (c.name?.toLowerCase().includes(s) || c.doctorName?.toLowerCase().includes(s) || c.city?.toLowerCase().includes(s))
  ).slice(0, 10) : [];
  const filteredCollaborators = s ? collabList.filter((co: any) =>
    !memberIds.has(String(co.id)) &&
    (`${co.titleBefore || ""} ${co.firstName || ""} ${co.lastName || ""}`.toLowerCase().includes(s) || co.email?.toLowerCase().includes(s))
  ).slice(0, 10) : [];

  const memberTypeIcon = (type: string) => {
    if (type === "hospital") return <Hospital className="h-4 w-4 text-blue-500" />;
    if (type === "clinic") return <Stethoscope className="h-4 w-4 text-emerald-500" />;
    return <User className="h-4 w-4 text-violet-500" />;
  };
  const memberTypeLabel = (type: string) => {
    if (type === "hospital") return t.clinics.memberHospital || "Hospital";
    if (type === "clinic") return t.clinics.memberClinic || "Clinic";
    return t.collaborators?.title || "Collaborator";
  };

  const hasDetails = network.address || network.city || network.phone || network.email || network.contactPerson || network.website || network.region;

  return (
    <Card>
      <CardHeader className="pb-3 cursor-pointer" onClick={() => setExpanded(!expanded)} data-testid={`toggle-network-${network.id}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <Network className="h-5 w-5 text-amber-600" />
            <div>
              <CardTitle className="text-base">{network.name}</CardTitle>
              {network.fullName && network.fullName !== network.name && (
                <p className="text-xs text-muted-foreground">{network.fullName}</p>
              )}
            </div>
            <Badge variant="outline" className="text-xs">{getCountryFlag(network.countryCode)} {network.countryCode}</Badge>
            {network.city && <span className="text-xs text-muted-foreground">• {network.city}</span>}
            {network.region && <span className="text-xs text-muted-foreground">• {network.region}</span>}
          </div>
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { if (!expanded) { setExpanded(true); setActiveTab("members"); } setAddMemberOpen(addMemberOpen === network.id ? null : network.id); }} data-testid={`button-add-member-${network.id}`}>
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} data-testid={`button-edit-network-${network.id}`}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={onDelete} data-testid={`button-delete-network-${network.id}`}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        {network.description && <p className="text-sm text-muted-foreground mt-1">{network.description}</p>}
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-8 mb-3">
              <TabsTrigger value="details" className="text-xs h-7 px-3" data-testid="tab-network-details">
                <Building2 className="h-3.5 w-3.5 mr-1" />{t.clinics?.steps?.basic || "Details"}
              </TabsTrigger>
              <TabsTrigger value="members" className="text-xs h-7 px-3" data-testid="tab-network-members">
                <Users className="h-3.5 w-3.5 mr-1" />{t.clinics?.members || "Members"} ({members.length})
              </TabsTrigger>
              <TabsTrigger value="personnel" className="text-xs h-7 px-3" data-testid="tab-network-personnel">
                <UserCheck className="h-3.5 w-3.5 mr-1" />{(t as any).medicalPartnerNetwork?.personnel || "Personnel"}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-0">
              {hasDetails ? (
                <div className="grid gap-x-6 gap-y-2 grid-cols-2 text-sm">
                  {network.contactPerson && (
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">{t.hospitals?.contactPerson || "Contact"}:</span>
                      <span className="font-medium">{network.contactPerson}</span>
                    </div>
                  )}
                  {network.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">{t.hospitals?.phone || "Phone"}:</span>
                      <a href={`tel:${network.phone}`} className="font-medium hover:underline">{network.phone}</a>
                    </div>
                  )}
                  {network.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">{t.hospitals?.email || "Email"}:</span>
                      <a href={`mailto:${network.email}`} className="font-medium hover:underline">{network.email}</a>
                    </div>
                  )}
                  {network.website && (
                    <div className="flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">{t.clinics?.website || "Web"}:</span>
                      <a href={network.website.startsWith("http") ? network.website : `https://${network.website}`} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">{network.website}</a>
                    </div>
                  )}
                  {(network.address || network.city) && (
                    <div className="flex items-center gap-2 col-span-2">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">{t.hospitals?.streetNumber || "Address"}:</span>
                      <span className="font-medium">{[network.address, network.city, network.postalCode].filter(Boolean).join(", ")}</span>
                    </div>
                  )}
                  {network.region && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">{t.hospitals?.region || "Region"}:</span>
                      <span className="font-medium">{network.region}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">{t.common?.noData || "No details yet. Click edit to add contact information."}</p>
              )}
            </TabsContent>

            <TabsContent value="members" className="mt-0">
              {addMemberOpen === network.id && (
                <div className="mb-3 p-3 bg-muted/50 rounded-lg border space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder={t.clinics.searchHospitalOrClinic || "Search hospital, clinic or collaborator..."}
                      className="pl-9 h-9"
                      data-testid="input-member-search"
                    />
                  </div>
                  {(filteredHospitals.length > 0 || filteredClinics.length > 0 || filteredCollaborators.length > 0) && (
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {filteredHospitals.map((h: any) => (
                        <button key={`h-${h.id}`} className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent text-sm text-left" onClick={() => addMemberMut.mutate({ hospitalId: String(h.id) })} data-testid={`add-hospital-${h.id}`}>
                          <Hospital className="h-4 w-4 text-blue-500 shrink-0" />
                          <span className="font-medium">{h.fullName || h.name}</span>
                          {h.city && <span className="text-muted-foreground">- {h.city}</span>}
                        </button>
                      ))}
                      {filteredClinics.map((c: any) => (
                        <button key={`c-${c.id}`} className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent text-sm text-left" onClick={() => addMemberMut.mutate({ clinicId: String(c.id) })} data-testid={`add-clinic-${c.id}`}>
                          <Stethoscope className="h-4 w-4 text-emerald-500 shrink-0" />
                          <span className="font-medium">{c.doctorName || c.name}</span>
                          {c.city && <span className="text-muted-foreground">- {c.city}</span>}
                        </button>
                      ))}
                      {filteredCollaborators.map((co: any) => (
                        <button key={`co-${co.id}`} className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent text-sm text-left" onClick={() => addMemberMut.mutate({ collaboratorId: String(co.id) })} data-testid={`add-collaborator-${co.id}`}>
                          <User className="h-4 w-4 text-violet-500 shrink-0" />
                          <span className="font-medium">{[co.titleBefore, co.firstName, co.lastName].filter(Boolean).join(" ")}</span>
                          <Badge variant="outline" className="text-[9px] px-1 py-0">{getCountryFlag(co.countryCode)} {co.countryCode}</Badge>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}

              {!isLoading && members.length === 0 && (
                <p className="text-sm text-muted-foreground">{t.clinics.noMembers || 'No members'}</p>
              )}

              {!isLoading && members.length > 0 && (
                <div className="space-y-1">
                  {members.map((m: any) => (
                    <div key={m.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 group">
                      <div className="flex items-center gap-2">
                        {memberTypeIcon(m.type)}
                        <span className="text-sm font-medium">{m.name}</span>
                        {m.city && <span className="text-xs text-muted-foreground">- {m.city}</span>}
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{memberTypeLabel(m.type)}</Badge>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => removeMemberMut.mutate(m.id)} data-testid={`remove-member-${m.id}`}>
                        <X className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="personnel" className="mt-0">
              <InstitutionPersonnelManager entityType="network" entityId={network.id} entityName={network.name} countryCode={network.countryCode} />
            </TabsContent>
          </Tabs>
        </CardContent>
      )}
    </Card>
  );
}

export default function HospitalsPage() {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const { selectedCountries } = useCountryFilter();
  const { canAdd, canEdit } = usePermissions();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [clinicSearchQuery, setClinicSearchQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isClinicFormOpen, setIsClinicFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isClinicDeleteOpen, setIsClinicDeleteOpen] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState<Hospital | undefined>();
  const [selectedClinic, setSelectedClinic] = useState<Clinic | undefined>();
  const [hospitalToDelete, setHospitalToDelete] = useState<Hospital | null>(null);
  const [clinicToDelete, setClinicToDelete] = useState<Clinic | null>(null);
  const [enrichTarget, setEnrichTarget] = useState<{ type: "clinic" | "hospital"; id: string; name: string; city?: string | null } | null>(null);
  const [activeTab, setActiveTab] = useState("networks");
  const [personnelEntity, setPersonnelEntity] = useState<{ type: "hospital" | "clinic"; id: string; name: string } | null>(null);
  const [clinicCountryTab, setClinicCountryTab] = useState<string>("ALL");
  const [countryTab, setCountryTab] = useState<string>("ALL");

  useEffect(() => {
    setCountryTab("ALL");
    setClinicCountryTab("ALL");
  }, [selectedCountries]);
  
  // Clinic pagination
  const [clinicPage, setClinicPage] = useState(1);
  const clinicPageSize = 50;
  const [debouncedClinicSearch, setDebouncedClinicSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedClinicSearch(clinicSearchQuery);
      setClinicPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [clinicSearchQuery]);
  
  // Clinic filters
  const [clinicCityFilter, setClinicCityFilter] = useState("");
  const [clinicStatusFilter, setClinicStatusFilter] = useState<string>("all");
  const [clinicHasWebsite, setClinicHasWebsite] = useState<string>("all");
  const [clinicPipelineFilter, setClinicPipelineFilter] = useState<string>("all");
  const [showClinicFilters, setShowClinicFilters] = useState(false);
  
  // Clinic sorting
  const [clinicSortField, setClinicSortField] = useState<string>("name");
  const [clinicSortDirection, setClinicSortDirection] = useState<"asc" | "desc">("asc");

  // Hospital pagination
  const [hospitalPage, setHospitalPage] = useState(1);
  const hospitalPageSize = 50;
  const [debouncedHospitalSearch, setDebouncedHospitalSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedHospitalSearch(searchQuery);
      setHospitalPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  // Hospital filters
  const [hospitalCityFilter, setHospitalCityFilter] = useState("");
  const [hospitalStatusFilter, setHospitalStatusFilter] = useState<string>("all");
  const [showHospitalFilters, setShowHospitalFilters] = useState(false);
  
  // Hospital sorting
  const [hospitalSortField, setHospitalSortField] = useState<string>("name");
  const [hospitalSortDirection, setHospitalSortDirection] = useState<"asc" | "desc">("asc");

  // ── Unified filter rules state (mirrors Persons / EntityFilter) ──────
  const [hospitalFilterRules, setHospitalFilterRules] = useState<FilterRule[]>([]);
  const [clinicFilterRules, setClinicFilterRules] = useState<FilterRule[]>([]);
  const [hospitalActiveView, setHospitalActiveView] = useState<{ id: string; name: string } | null>(null);
  const [clinicActiveView, setClinicActiveView] = useState<{ id: string; name: string } | null>(null);

  // Reset country rules when global country filter changes
  useEffect(() => {
    setHospitalFilterRules((prev) => prev.filter((r) => r.field !== "country"));
    setClinicFilterRules((prev) => prev.filter((r) => r.field !== "country"));
  }, [selectedCountries]);

  const getHospitalRuleValue = useCallback((field: string): string => {
    const r = hospitalFilterRules.find((x) => x.field === field && (x.op === "is" || x.op === "isAny"));
    if (!r) return "";
    return Array.isArray(r.value) ? r.value[0] || "" : r.value;
  }, [hospitalFilterRules]);

  const getClinicRuleValue = useCallback((field: string): string => {
    const r = clinicFilterRules.find((x) => x.field === field && (x.op === "is" || x.op === "isAny"));
    if (!r) return "";
    return Array.isArray(r.value) ? r.value[0] || "" : r.value;
  }, [clinicFilterRules]);

  const setHospitalSingleRule = useCallback((field: string, value: string) => {
    setHospitalFilterRules((prev) => {
      const next = prev.filter((r) => r.field !== field);
      if (value) next.push({ id: `r-${field}-${Date.now().toString(36)}`, conjunction: "and", field, op: "is", value });
      return next;
    });
    setHospitalPage(1);
  }, []);

  const setClinicSingleRule = useCallback((field: string, value: string) => {
    setClinicFilterRules((prev) => {
      const next = prev.filter((r) => r.field !== field);
      if (value) next.push({ id: `r-${field}-${Date.now().toString(36)}`, conjunction: "and", field, op: "is", value });
      return next;
    });
    setClinicPage(1);
  }, []);

  // Derived single-value getters (for stat-card highlighting + server params)
  const hFilterCountry = getHospitalRuleValue("country");
  const hFilterStatus = getHospitalRuleValue("status");
  const cFilterCountry = getClinicRuleValue("country");
  const cFilterStatus = getClinicRuleValue("status");
  const cFilterPipeline = getClinicRuleValue("pipeline");

  // Sync new rule state with legacy state used elsewhere (countryTab, status, etc.)
  useEffect(() => { setCountryTab(hFilterCountry || "ALL"); }, [hFilterCountry]);
  useEffect(() => { setHospitalStatusFilter(hFilterStatus || "all"); }, [hFilterStatus]);
  useEffect(() => { setClinicCountryTab(cFilterCountry || "ALL"); }, [cFilterCountry]);
  useEffect(() => { setClinicStatusFilter(cFilterStatus || "all"); }, [cFilterStatus]);
  useEffect(() => { setClinicPipelineFilter(cFilterPipeline || "all"); }, [cFilterPipeline]);

  const handleHospitalRulesChange = useCallback((newRules: FilterRule[]) => {
    setHospitalFilterRules(newRules);
    setHospitalPage(1);
  }, []);

  const handleClinicRulesChange = useCallback((newRules: FilterRule[]) => {
    setClinicFilterRules(newRules);
    setClinicPage(1);
  }, []);

  const isAdmin = user?.role === "admin";

  const sk = locale === "sk";

  const COUNTRY_OPTIONS = useMemo(() => ([
    { value: "SK", label: sk ? "Slovensko" : "Slovakia" },
    { value: "CZ", label: sk ? "Česko" : "Czechia" },
    { value: "AT", label: sk ? "Rakúsko" : "Austria" },
    { value: "HU", label: sk ? "Maďarsko" : "Hungary" },
    { value: "RO", label: sk ? "Rumunsko" : "Romania" },
    { value: "IT", label: sk ? "Taliansko" : "Italy" },
    { value: "DE", label: sk ? "Nemecko" : "Germany" },
    { value: "US", label: "USA" },
  ]), [sk]);

  const STATUS_OPTIONS = useMemo(() => ([
    { value: "active", label: sk ? "Aktívna" : "Active" },
    { value: "inactive", label: sk ? "Neaktívna" : "Inactive" },
  ]), [sk]);

  const BOOL_OPTIONS = useMemo(() => ([
    { value: "true", label: sk ? "Áno" : "Yes" },
    { value: "false", label: sk ? "Nie" : "No" },
  ]), [sk]);

  // ── Filter field definitions (full schema coverage) ────────────────
  const hospitalFilterFields: FilterField[] = useMemo(() => ([
    { key: "country", label: sk ? "Krajina" : "Country", type: "multiselect", icon: Globe, options: COUNTRY_OPTIONS },
    { key: "status", label: sk ? "Status" : "Status", type: "select", icon: Activity, options: STATUS_OPTIONS },
    { key: "personnel", label: sk ? "Personál" : "Personnel", type: "select", icon: Users, options: [
      { value: "with", label: sk ? "S personálom" : "With personnel" },
      { value: "without", label: sk ? "Bez personálu" : "Without personnel" },
    ]},
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
    { key: "representativeId", label: sk ? "Reprezentant" : "Representative", type: "select", icon: User,
      options: users.map((u) => ({ value: u.id, label: u.fullName || u.username || u.email || u.id })) },
    { key: "responsiblePersonId", label: sk ? "Zodpovedná osoba" : "Responsible Person", type: "select", icon: ShieldCheck,
      options: users.map((u) => ({ value: u.id, label: u.fullName || u.username || u.email || u.id })) },
    { key: "laboratoryId", label: sk ? "Laboratórium" : "Laboratory", type: "select", icon: Database,
      options: laboratories.map((l: any) => ({ value: l.id, label: l.name })) },
    { key: "tags", label: sk ? "Tagy" : "Tags", type: "text", icon: ListFilter },
    { key: "dataSource", label: sk ? "Pôvod" : "Data Source", type: "text", icon: Database },
    { key: "createdByCollaboratorId", label: sk ? "Pridal (collaborator)" : "Created by (collaborator)", type: "text", icon: UserPlus },
    { key: "legacyId", label: sk ? "Legacy ID" : "Legacy ID", type: "text", icon: FileText },
    { key: "hasPhone", label: sk ? "Má telefón" : "Has Phone", type: "select", icon: Phone, options: BOOL_OPTIONS },
    { key: "hasEmail", label: sk ? "Má email" : "Has Email", type: "select", icon: Mail, options: BOOL_OPTIONS },
    { key: "hasGps", label: sk ? "Má GPS" : "Has GPS", type: "select", icon: Navigation, options: BOOL_OPTIONS },
  ]), [sk, COUNTRY_OPTIONS, STATUS_OPTIONS, BOOL_OPTIONS, users, laboratories]);

  const PIPELINE_OPTIONS = useMemo(() => ([
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
  ]), [sk]);

  const clinicFilterFields: FilterField[] = useMemo(() => ([
    { key: "country", label: sk ? "Krajina" : "Country", type: "multiselect", icon: Globe, options: COUNTRY_OPTIONS },
    { key: "status", label: sk ? "Status" : "Status", type: "select", icon: Activity, options: STATUS_OPTIONS },
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
    ]},
    { key: "interestCooperation", label: sk ? "Záujem o spoluprácu" : "Cooperation Interest", type: "select", icon: ListChecks, options: [
      { value: "unknown", label: sk ? "Neznámy" : "Unknown" },
      { value: "interested", label: sk ? "Záujem" : "Interested" },
      { value: "not_interested", label: sk ? "Bez záujmu" : "Not Interested" },
    ]},
    { key: "interestContract", label: sk ? "Záujem o zmluvu" : "Contract Interest", type: "select", icon: ListChecks, options: [
      { value: "unknown", label: sk ? "Neznámy" : "Unknown" },
      { value: "interested", label: sk ? "Záujem" : "Interested" },
      { value: "not_interested", label: sk ? "Bez záujmu" : "Not Interested" },
    ]},
    { key: "contractStatus", label: sk ? "Status zmluvy" : "Contract Status", type: "select", icon: FileText, options: [
      { value: "none", label: sk ? "Žiadna" : "None" },
      { value: "active", label: sk ? "Aktívna" : "Active" },
    ]},
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
  ]), [sk, COUNTRY_OPTIONS, STATUS_OPTIONS, BOOL_OPTIONS, PIPELINE_OPTIONS]);

  const hospitalFilterPresets: FilterPreset[] = useMemo(() => ([
    { id: "active", label: sk ? "Iba aktívne" : "Active only", rules: [{ id: "p-active", conjunction: "and", field: "status", op: "is", value: "active" }] },
    { id: "with-personnel", label: sk ? "S personálom" : "With personnel", rules: [{ id: "p-pers", conjunction: "and", field: "personnel", op: "is", value: "with" }] },
    { id: "svet-zdravia", label: "Svet Zdravia", rules: [{ id: "p-sz", conjunction: "and", field: "svetZdravia", op: "is", value: "true" }] },
    { id: "no-email", label: sk ? "Bez emailu" : "Missing email", rules: [{ id: "p-noem", conjunction: "and", field: "hasEmail", op: "is", value: "false" }] },
  ]), [sk]);

  const clinicFilterPresets: FilterPreset[] = useMemo(() => ([
    { id: "active", label: sk ? "Iba aktívne" : "Active only", rules: [{ id: "p-active", conjunction: "and", field: "status", op: "is", value: "active" }] },
    { id: "active-contract", label: sk ? "Aktívna zmluva" : "Active contract", rules: [{ id: "p-ac", conjunction: "and", field: "pipeline", op: "is", value: "contract:active" }] },
    { id: "interested", label: sk ? "Záujem o spoluprácu" : "Interested in coop", rules: [{ id: "p-int", conjunction: "and", field: "interestCooperation", op: "is", value: "interested" }] },
    { id: "no-status", label: sk ? "Bez statusu" : "No status", rules: [{ id: "p-ns", conjunction: "and", field: "pipeline", op: "is", value: "no_status" }] },
    { id: "from-conference", label: sk ? "Z konferencie" : "From conference", rules: [{ id: "p-conf", conjunction: "and", field: "isFromConference", op: "is", value: "true" }] },
  ]), [sk]);

  const hospitalQueryParams: Record<string, any> = { page: hospitalPage, limit: hospitalPageSize };
  if (debouncedHospitalSearch) hospitalQueryParams.search = debouncedHospitalSearch;
  {
    const countryRule = hospitalFilterRules.find((r) => r.field === "country" && (r.op === "is" || r.op === "isAny"));
    const ruleVals = countryRule ? (Array.isArray(countryRule.value) ? countryRule.value.filter(Boolean) : (countryRule.value ? [countryRule.value] : [])) : [];
    if (ruleVals.length === 1) {
      hospitalQueryParams.country = ruleVals[0];
    } else if (ruleVals.length > 1) {
      hospitalQueryParams.countries = ruleVals.join(",");
    } else if (selectedCountries.length > 0) {
      hospitalQueryParams.countries = selectedCountries.join(",");
    }
  }
  const { data: hospitalsPaginatedResult, isLoading } = useQuery<{ data: HospitalType[], total: number }>({
    queryKey: ["/api/hospitals", hospitalQueryParams],
  });
  const hospitals = hospitalsPaginatedResult?.data || [];
  const serverHospitalsTotal = hospitalsPaginatedResult?.total || 0;

  const { data: users = [] } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
  });

  const { data: laboratories = [] } = useQuery<Laboratory[]>({
    queryKey: ["/api/config/laboratories"],
  });

  const clinicQueryParams: Record<string, any> = { page: clinicPage, limit: clinicPageSize };
  if (debouncedClinicSearch) clinicQueryParams.search = debouncedClinicSearch;
  {
    const countryRule = clinicFilterRules.find((r) => r.field === "country" && (r.op === "is" || r.op === "isAny"));
    const ruleVals = countryRule ? (Array.isArray(countryRule.value) ? countryRule.value.filter(Boolean) : (countryRule.value ? [countryRule.value] : [])) : [];
    if (ruleVals.length === 1) {
      clinicQueryParams.country = ruleVals[0];
    } else if (ruleVals.length > 1) {
      clinicQueryParams.countries = ruleVals.join(",");
    } else if (selectedCountries.length > 0) {
      clinicQueryParams.countries = selectedCountries.join(",");
    }
  }
  const { data: clinicsPaginatedResult, isLoading: isLoadingClinics, refetch: refetchClinics } = useQuery<{ data: Clinic[], total: number }>({
    queryKey: ["/api/clinics", clinicQueryParams],
  });
  const clinics = clinicsPaginatedResult?.data || [];
  const serverClinicsTotal = clinicsPaginatedResult?.total || 0;

  const { data: referralCounts } = useQuery<{ recommendedBy: Record<string, number>; recommends: Record<string, number> }>({
    queryKey: ["/api/clinic-referral-counts"],
  });
  const { data: personnelCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ["/api/mpn/entity-personnel-counts"],
  });

  const { data: networkMemberships = [] } = useQuery<any[]>({
    queryKey: ["/api/hospital-network-memberships"],
  });

  const hospitalNetworkMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const m of networkMemberships) {
      const key = m.hospital_id || m.clinic_id;
      if (key) {
        if (!map[key]) map[key] = [];
        if (!map[key].includes(m.network_name)) map[key].push(m.network_name);
      }
    }
    return map;
  }, [networkMemberships]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/hospitals/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hospitals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hospitals/stats"] });
      toast({ title: t.success.deleted });
      setIsDeleteOpen(false);
      setHospitalToDelete(null);
    },
    onError: () => {
      toast({ title: t.errors.deleteFailed, variant: "destructive" });
    },
  });

  const seedAllMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/hospitals/seed-all"),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/hospitals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hospitals/stats"] });
      toast({ 
        title: t.hospitals.seedSuccess,
        description: `${t.hospitals.seedCreated}: ${data.inserted}, ${t.hospitals.seedSkipped}: ${data.skipped} (${t.hospitals.seedTotal} ${data.total})`,
      });
    },
    onError: (error: any) => {
      toast({ 
        title: t.hospitals.seedError, 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const deleteClinicMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/clinics/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clinics/stats"] });
      toast({ title: t.success.deleted });
      setIsClinicDeleteOpen(false);
      setClinicToDelete(null);
    },
    onError: () => {
      toast({ title: t.errors.deleteFailed, variant: "destructive" });
    },
  });

  const clinicStatsParams: Record<string, any> = {};
  if (selectedCountries.length > 0) clinicStatsParams.countries = selectedCountries.join(",");
  const { data: serverClinicStats } = useQuery<{
    total: number;
    pipeline: Record<string, number>;
    noStatus: number;
    otherStatus: number;
    referralCount: number;
    conferenceCount: number;
    byCountry: Record<string, number>;
  }>({
    queryKey: ["/api/clinics/stats", clinicStatsParams],
  });

  const hospitalStatsParams: Record<string, any> = {};
  if (selectedCountries.length > 0) hospitalStatsParams.countries = selectedCountries.join(",");
  const { data: serverHospitalStats } = useQuery<{
    total: number;
    active: number;
    inactive: number;
    withPersonnel: number;
    withoutPersonnel: number;
    byCountry: Record<string, number>;
  }>({
    queryKey: ["/api/hospitals/stats", hospitalStatsParams],
  });

  const countryCounts = serverHospitalStats?.byCountry ?? hospitals.reduce((acc, h) => {
    acc[h.countryCode] = (acc[h.countryCode] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const clinicCountryCounts = serverClinicStats?.byCountry ?? clinics.reduce((acc, c) => {
    acc[c.countryCode] = (acc[c.countryCode] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const filteredAndSortedClinics = (() => {
    const isClinicHandledByServer = (r: FilterRule): boolean => {
      if (r.field !== "country") return false;
      if (r.op !== "is" && r.op !== "isAny") return false;
      if (Array.isArray(r.value)) return r.value.length === 1 && !!r.value[0];
      return !!r.value;
    };
    const cClientRules = clinicFilterRules.filter((r) => !isClinicHandledByServer(r));

    const matchClinicRule = (c: any, r: FilterRule): boolean => {
      const isEq = r.op === "is" || r.op === "isAny";
      const isNeq = r.op === "isNot";
      const contains = r.op === "contains";
      const isEmpty = r.op === "isEmpty";
      const isNotEmpty = r.op === "isNotEmpty";

      const get = (): string => {
        switch (r.field) {
          case "country": return c.countryCode || "";
          case "status": return c.isActive ? "active" : "inactive";
          case "pipeline": {
            if (c.contractStatus) return `contract:${c.contractStatus}`;
            if (c.interestContract) return `contract_int:${c.interestContract}`;
            if (c.interestCooperation) return `coop:${c.interestCooperation}`;
            if (c.initialStatus) return `initial:${c.initialStatus}`;
            return "no_status";
          }
          case "name": return c.name || "";
          case "doctorName": return c.doctorName || "";
          case "doctorTitle": return c.doctorTitle || "";
          case "doctorFirstName": return c.doctorFirstName || "";
          case "doctorLastName": return c.doctorLastName || "";
          case "ico": return c.ico || "";
          case "pzsCode": return c.pzsCode || "";
          case "pzsName": return c.pzsName || "";
          case "idZz": return c.idZz || "";
          case "city": return c.city || "";
          case "region": return c.region || "";
          case "district": return c.district || "";
          case "street": return c.street || "";
          case "streetNumber": return c.streetNumber || "";
          case "postalCode": return c.postalCode || "";
          case "address": return [c.street, c.streetNumber, c.city].filter(Boolean).join(" ");
          case "phone": return c.phone || "";
          case "phone2": return c.phone2 || "";
          case "phone3": return c.phone3 || "";
          case "email": return c.email || "";
          case "email2": return c.email2 || "";
          case "email3": return c.email3 || "";
          case "website": return c.website || "";
          case "hasWebsite": return c.website ? "true" : "false";
          case "hasPhone": return (c.phone || c.phone2 || c.phone3) ? "true" : "false";
          case "hasEmail": return (c.email || c.email2 || c.email3) ? "true" : "false";
          case "hasGps": return (c.gpsLat && c.gpsLng) ? "true" : "false";
          case "isReferredByDoctor": return c.isReferredByDoctor ? "true" : "false";
          case "isFromConference": return c.isFromConference ? "true" : "false";
          case "conferenceName": return c.conferenceName || "";
          case "initialStatus": return c.initialStatus || "";
          case "interestCooperation": return c.interestCooperation || "";
          case "interestContract": return c.interestContract || "";
          case "contractStatus": return c.contractStatus || "";
          case "lastCallResult": return c.lastCallResult || "";
          case "lastCallNote": return c.lastCallNote || "";
          case "leadSource": return c.leadSource || "";
          case "leadSourceNotes": return c.leadSourceNotes || "";
          case "leadSourceDate": return c.leadSourceDate ? String(c.leadSourceDate).slice(0, 10) : "";
          case "conferenceDate": return c.conferenceDate ? String(c.conferenceDate).slice(0, 10) : "";
          case "nextContactDate": return c.nextContactDate ? String(c.nextContactDate).slice(0, 10) : "";
          case "contractSentDate": return c.contractSentDate ? String(c.contractSentDate).slice(0, 10) : "";
          case "contractReturnedDate": return c.contractReturnedDate ? String(c.contractReturnedDate).slice(0, 10) : "";
          case "hasFlyers": return c.hasFlyers ? "true" : "false";
          case "flyersSentDate": return c.flyersSentDate ? String(c.flyersSentDate).slice(0, 10) : "";
          case "flyersLocation": return c.flyersLocation || "";
          case "doctorPositionCategoryId": return c.doctorPositionCategoryId || "";
          case "orientationNumber": return c.orientationNumber || "";
          case "tags": return Array.isArray(c.tags) ? c.tags.join(",") : (c.tags || "");
          case "notes": return c.notes || "";
          case "legacyId": return c.legacyId || "";
          default: return "";
        }
      };
      const fieldVal = String(get());
      const isBoolField = ["hasWebsite","hasPhone","hasEmail","hasGps","isReferredByDoctor","isFromConference","hasFlyers"].includes(r.field);
      if (isEmpty) return isBoolField ? fieldVal === "false" : !fieldVal;
      if (isNotEmpty) return isBoolField ? fieldVal === "true" : !!fieldVal;
      if (contains) {
        if (Array.isArray(r.value)) return r.value.some((v) => v && fieldVal.toLowerCase().includes(String(v).toLowerCase()));
        return r.value ? fieldVal.toLowerCase().includes(String(r.value).toLowerCase()) : true;
      }
      if (isEq) {
        if (Array.isArray(r.value)) return r.value.some((v) => v && fieldVal === v);
        return r.value ? fieldVal === r.value : true;
      }
      if (isNeq) {
        if (Array.isArray(r.value)) return r.value.every((v) => !v || fieldVal !== v);
        return r.value ? fieldVal !== r.value : true;
      }
      return true;
    };

    let result = clinics.filter((clinic) => cClientRules.every((r) => matchClinicRule(clinic as any, r)));
    
    // Then sort
    result.sort((a, b) => {
      let aVal: string | boolean = "";
      let bVal: string | boolean = "";
      
      switch (clinicSortField) {
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "city":
          aVal = (a.city || "").toLowerCase();
          bVal = (b.city || "").toLowerCase();
          break;
        case "doctorName":
          aVal = ((a as any).doctorLastName || a.doctorName || "").toLowerCase();
          bVal = ((b as any).doctorLastName || b.doctorName || "").toLowerCase();
          break;
        case "country":
          aVal = a.countryCode;
          bVal = b.countryCode;
          break;
        case "isActive":
          aVal = a.isActive;
          bVal = b.isActive;
          break;
        default:
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
      }
      
      if (aVal < bVal) return clinicSortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return clinicSortDirection === "asc" ? 1 : -1;
      return 0;
    });
    
    return result;
  })();
  
  const totalClinicPages = Math.ceil(serverClinicsTotal / clinicPageSize);
  const paginatedClinics = filteredAndSortedClinics;

  const pipelineStats = useMemo(() => {
    if (serverClinicStats) {
      return {
        stats: serverClinicStats.pipeline,
        noStatus: serverClinicStats.noStatus,
        otherStatus: serverClinicStats.otherStatus,
        referralCount: serverClinicStats.referralCount,
        conferenceCount: serverClinicStats.conferenceCount,
      };
    }
    return { stats: {} as Record<string, number>, noStatus: 0, otherStatus: 0, referralCount: 0, conferenceCount: 0 };
  }, [serverClinicStats]);
  
  // Reset page when filters change
  const handleClinicFilterChange = () => {
    setClinicPage(1);
  };
  
  const toggleClinicSort = (field: string) => {
    if (clinicSortField === field) {
      setClinicSortDirection(clinicSortDirection === "asc" ? "desc" : "asc");
    } else {
      setClinicSortField(field);
      setClinicSortDirection("asc");
    }
    setClinicPage(1);
  };
  
  const clearClinicFilters = () => {
    setClinicSearchQuery("");
    setClinicCityFilter("");
    setClinicStatusFilter("all");
    setClinicHasWebsite("all");
    setClinicPipelineFilter("all");
    setClinicCountryTab("ALL");
    setClinicPage(1);
  };
  
  const hasActiveClinicFilters = !!clinicSearchQuery || clinicFilterRules.length > 0 || clinicCountryTab !== "ALL";

  // Filtered and sorted hospitals (search + country done server-side)
  const filteredAndSortedHospitals = (() => {
    const isHospHandledByServer = (r: FilterRule): boolean => {
      if (r.field !== "country") return false;
      if (r.op !== "is" && r.op !== "isAny") return false;
      if (Array.isArray(r.value)) return r.value.length === 1 && !!r.value[0];
      return !!r.value;
    };
    const hClientRules = hospitalFilterRules.filter((r) => !isHospHandledByServer(r));

    const matchHospitalRule = (h: any, r: FilterRule): boolean => {
      const isEq = r.op === "is" || r.op === "isAny";
      const isNeq = r.op === "isNot";
      const contains = r.op === "contains";
      const isEmpty = r.op === "isEmpty";
      const isNotEmpty = r.op === "isNotEmpty";

      const get = (): string => {
        switch (r.field) {
          case "country": return h.countryCode || "";
          case "status": return h.isActive ? "active" : "inactive";
          case "personnel": {
            const cnt = personnelCounts?.[h.id] || 0;
            return cnt > 0 ? "with" : "without";
          }
          case "name": return h.name || "";
          case "fullName": return h.fullName || h.name || "";
          case "city": return h.city || "";
          case "region": return h.region || "";
          case "district": return h.district || "";
          case "postalCode": return h.postalCode || "";
          case "streetNumber": return h.streetNumber || h.street || "";
          case "contactPerson": return h.contactPerson || "";
          case "phone": return h.phone || "";
          case "email": return h.email || "";
          case "svetZdravia": return h.svetZdravia ? "true" : "false";
          case "autoRecruiting": return h.autoRecruiting ? "true" : "false";
          case "representativeId": return h.representativeId || "";
          case "responsiblePersonId": return h.responsiblePersonId || "";
          case "laboratoryId": return h.laboratoryId || "";
          case "tags": return Array.isArray(h.tags) ? h.tags.join(",") : (h.tags || "");
          case "dataSource": return h.dataSource || "";
          case "createdByCollaboratorId": return h.createdByCollaboratorId || "";
          case "legacyId": return h.legacyId || "";
          case "hasPhone": return h.phone ? "true" : "false";
          case "hasEmail": return h.email ? "true" : "false";
          case "hasGps": return (h.gpsLat && h.gpsLng) ? "true" : "false";
          default: return "";
        }
      };
      const fieldVal = String(get());
      const isBoolField = ["svetZdravia","autoRecruiting","hasPhone","hasEmail","hasGps"].includes(r.field);
      if (isEmpty) return isBoolField ? fieldVal === "false" : !fieldVal;
      if (isNotEmpty) return isBoolField ? fieldVal === "true" : !!fieldVal;
      if (contains) {
        if (Array.isArray(r.value)) return r.value.some((v) => v && fieldVal.toLowerCase().includes(String(v).toLowerCase()));
        return r.value ? fieldVal.toLowerCase().includes(String(r.value).toLowerCase()) : true;
      }
      if (isEq) {
        if (Array.isArray(r.value)) return r.value.some((v) => v && fieldVal === v);
        return r.value ? fieldVal === r.value : true;
      }
      if (isNeq) {
        if (Array.isArray(r.value)) return r.value.every((v) => !v || fieldVal !== v);
        return r.value ? fieldVal !== r.value : true;
      }
      return true;
    };

    let result = hospitals.filter((hospital) => hClientRules.every((r) => matchHospitalRule(hospital as any, r)));
    
    // Then sort
    result.sort((a, b) => {
      let aVal: any;
      let bVal: any;
      
      switch (hospitalSortField) {
        case "name":
          aVal = (a.fullName || a.name).toLowerCase();
          bVal = (b.fullName || b.name).toLowerCase();
          break;
        case "city":
          aVal = (a.city || "").toLowerCase();
          bVal = (b.city || "").toLowerCase();
          break;
        case "country":
          aVal = a.countryCode;
          bVal = b.countryCode;
          break;
        case "region":
          aVal = (a.region || "").toLowerCase();
          bVal = (b.region || "").toLowerCase();
          break;
        case "isActive":
          aVal = a.isActive;
          bVal = b.isActive;
          break;
        default:
          aVal = (a.fullName || a.name).toLowerCase();
          bVal = (b.fullName || b.name).toLowerCase();
      }
      
      if (aVal < bVal) return hospitalSortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return hospitalSortDirection === "asc" ? 1 : -1;
      return 0;
    });
    
    return result;
  })();
  
  const totalHospitalPages = Math.ceil(serverHospitalsTotal / hospitalPageSize);
  const paginatedHospitals = filteredAndSortedHospitals;
  
  // Reset page when filters change
  const handleHospitalFilterChange = () => {
    setHospitalPage(1);
  };
  
  const toggleHospitalSort = (field: string) => {
    if (hospitalSortField === field) {
      setHospitalSortDirection(hospitalSortDirection === "asc" ? "desc" : "asc");
    } else {
      setHospitalSortField(field);
      setHospitalSortDirection("asc");
    }
    setHospitalPage(1);
  };
  
  const clearHospitalFilters = () => {
    setSearchQuery("");
    setHospitalCityFilter("");
    setHospitalStatusFilter("all");
    setCountryTab("ALL");
    setHospitalPage(1);
  };
  
  const hasActiveHospitalFilters = !!searchQuery || hospitalFilterRules.length > 0 || countryTab !== "ALL";

  // Export functions
  const exportToCsv = useCallback((data: any[], filename: string, columns: { key: string; header: string }[]) => {
    const BOM = '\uFEFF';
    const headers = columns.map(c => c.header).join(',');
    const rows = data.map(item => 
      columns.map(c => {
        const value = c.key.split('.').reduce((obj, key) => obj?.[key], item) ?? '';
        const stringValue = String(value).replace(/"/g, '""');
        return `"${stringValue}"`;
      }).join(',')
    );
    const csv = BOM + [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
    toast({ title: t.common.exportSuccess });
  }, [t, toast]);

  const exportToExcel = useCallback((data: any[], filename: string, columns: { key: string; header: string }[]) => {
    const headers = columns.map(c => c.header);
    const rows = data.map(item => 
      columns.map(c => {
        const value = c.key.split('.').reduce((obj, key) => obj?.[key], item) ?? '';
        return String(value);
      })
    );
    
    // Create simple HTML table for Excel
    let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body><table>';
    html += '<tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr>';
    rows.forEach(row => {
      html += '<tr>' + row.map(cell => `<td>${cell}</td>`).join('') + '</tr>';
    });
    html += '</table></body></html>';
    
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.xls`;
    link.click();
    toast({ title: t.common.exportSuccess });
  }, [t, toast]);

  const hospitalExportColumns = [
    { key: 'name', header: t.hospitals.name },
    { key: 'fullName', header: t.hospitals.fullName },
    { key: 'countryCode', header: t.common.country },
    { key: 'city', header: t.hospitals.city },
    { key: 'region', header: t.hospitals.region },
    { key: 'streetNumber', header: t.hospitals.streetNumber },
    { key: 'postalCode', header: t.hospitals.postalCode },
    { key: 'contactPerson', header: t.hospitals.contactPerson },
    { key: 'isActive', header: t.common.status },
  ];

  const clinicExportColumns = [
    { key: 'name', header: t.clinics.name },
    { key: 'doctorName', header: t.clinics.doctorName },
    { key: 'countryCode', header: t.common.country },
    { key: 'city', header: t.clinics.city },
    { key: 'address', header: t.clinics.address },
    { key: 'phone', header: t.clinics.phone },
    { key: 'email', header: t.clinics.email },
    { key: 'website', header: t.clinics.website },
    { key: 'isActive', header: t.common.status },
  ];

  const getUserName = (userId: string | null) => {
    if (!userId) return "-";
    const user = users.find((u) => u.id === userId);
    return user?.fullName || "-";
  };

  const getLabName = (labId: string | null) => {
    if (!labId) return "-";
    const lab = laboratories.find((l) => l.id === labId);
    return lab?.name || "-";
  };

  const [editingHospital, setEditingHospital] = useState<Hospital | null>(null);

  const handleEdit = (hospital: HospitalType) => {
    setEditingHospital(hospital);
  };

  const handleDelete = (hospital: HospitalType) => {
    setHospitalToDelete(hospital);
    setIsDeleteOpen(true);
  };

  const handleAddNew = () => {
    setIsFormOpen(true);
  };

  const handleEditClinic = (clinic: Clinic) => {
    setSelectedClinic(clinic);
    setIsClinicFormOpen(true);
  };

  const handleDeleteClinic = (clinic: Clinic) => {
    setClinicToDelete(clinic);
    setIsClinicDeleteOpen(true);
  };

  const handleAddNewClinic = () => {
    setSelectedClinic(undefined);
    setIsClinicFormOpen(true);
  };

  const getWebsiteUrl = (url: string) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    return `https://${url}`;
  };

  const SortableHeader = ({ field, label }: { field: string; label: string }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 px-2 -ml-2 font-medium"
      onClick={() => toggleClinicSort(field)}
      data-testid={`sort-clinic-${field}`}
    >
      {label}
      {clinicSortField === field ? (
        clinicSortDirection === "asc" ? (
          <ArrowUp className="ml-1 h-3 w-3" />
        ) : (
          <ArrowDown className="ml-1 h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
      )}
    </Button>
  );

  const HospitalSortableHeader = ({ field, label }: { field: string; label: string }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 px-2 -ml-2 font-medium"
      onClick={() => toggleHospitalSort(field)}
      data-testid={`sort-hospital-${field}`}
    >
      {label}
      {hospitalSortField === field ? (
        hospitalSortDirection === "asc" ? (
          <ArrowUp className="ml-1 h-3 w-3" />
        ) : (
          <ArrowDown className="ml-1 h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
      )}
    </Button>
  );

  const clinicColumns = [
    {
      key: "name",
      header: <SortableHeader field="name" label={t.clinics.name} />,
      cell: (clinic: Clinic) => {
        const pCount = personnelCounts[`clinic:${clinic.id}`] || 0;
        const recommendedByCount = referralCounts?.recommendedBy?.[clinic.id] || 0;
        const recommendsCount = referralCounts?.recommends?.[clinic.id] || 0;
        const nets = hospitalNetworkMap[clinic.id] || [];
        return (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{clinic.name}</span>
            {nets.map((netName) => (
              <Badge key={netName} className="text-[10px] px-1.5 py-0 font-bold bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/60 dark:text-amber-300 dark:border-amber-700" data-testid={`badge-network-clinic-${clinic.id}`}>
                <Network className="h-2.5 w-2.5 mr-0.5" />
                {netName}
              </Badge>
            ))}
            {pCount > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5 bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800" data-testid={`badge-personnel-clinic-${clinic.id}`}>
                <Users className="h-2.5 w-2.5" />
                {pCount}
              </Badge>
            )}
            {!clinic.isActive && (
              <Badge variant="secondary">{t.common.inactive}</Badge>
            )}
            {recommendedByCount > 0 && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-purple-100 text-purple-700 border border-purple-300 dark:bg-purple-900/60 dark:text-purple-300 dark:border-purple-700" data-testid={`badge-recommended-by-${clinic.id}`}>
                <UserCheck className="h-2.5 w-2.5" />
                {(t.clinics as any).recommendedBy || "Recommended"} {recommendedByCount}
              </span>
            )}
            {recommendsCount > 0 && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-900/60 dark:text-emerald-300 dark:border-emerald-700" data-testid={`badge-recommends-${clinic.id}`}>
                <ArrowRight className="h-2.5 w-2.5" />
                {(t.clinics as any).recommendsOthers || "Recommends"} {recommendsCount}
              </span>
            )}
            {(clinic as any).isFromConference && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-rose-100 text-rose-700 border border-rose-300 dark:bg-rose-900/60 dark:text-rose-300 dark:border-rose-700" data-testid={`badge-conference-${clinic.id}`}>
                <GraduationCap className="h-2.5 w-2.5" />
                Conference
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "doctorName",
      header: <SortableHeader field="doctorName" label={t.clinics.doctorName} />,
      cell: (clinic: Clinic) => {
        const c = clinic as any;
        const parts = [c.doctorTitle, c.doctorFirstName, c.doctorLastName].filter(Boolean);
        return parts.length > 0 ? parts.join(" ") : (clinic.doctorName || "-");
      },
    },
    {
      key: "country",
      header: <SortableHeader field="country" label={t.common.country} />,
      cell: (clinic: Clinic) => (
        <span>
          {getCountryFlag(clinic.countryCode)} {getCountryName(clinic.countryCode)}
        </span>
      ),
    },
    {
      key: "city",
      header: <SortableHeader field="city" label={t.clinics.city} />,
      cell: (clinic: Clinic) => clinic.city || "-",
    },
    {
      key: "actions",
      header: t.common.actions,
      cell: (clinic: Clinic) => (
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setPersonnelEntity({ type: "clinic", id: clinic.id, name: clinic.name })}
            data-testid={`button-personnel-clinic-${clinic.id}`}
            title={(t as any).medicalPartnerNetwork?.personnel || "Personnel"}
          >
            <Users className="h-4 w-4" />
          </Button>
          {canEdit("hospitals") && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleEditClinic(clinic)}
              data-testid={`button-edit-clinic-${clinic.id}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {canEdit("hospitals") && (
            <Button
              size="icon"
              variant="ghost"
              title="Doplniť z webu"
              onClick={() => setEnrichTarget({ type: "clinic", id: clinic.id, name: clinic.name || "Klinika", city: clinic.city })}
              data-testid={`button-enrich-clinic-${clinic.id}`}
            >
              <Globe className="h-4 w-4" />
            </Button>
          )}
          {canEdit("hospitals") && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleDeleteClinic(clinic)}
              data-testid={`button-delete-clinic-${clinic.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const columns = [
    {
      key: "name",
      header: <HospitalSortableHeader field="name" label={t.hospitals.fullName || "Full Name"} />,
      cell: (hospital: HospitalType) => {
        const pCount = personnelCounts[`hospital:${hospital.id}`] || 0;
        const nets = hospitalNetworkMap[hospital.id] || [];
        return (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{(hospital.fullName && hospital.fullName !== "-" ? hospital.fullName : null) || (hospital.name && hospital.name !== "-" ? hospital.name : null) || "(unnamed)"}</span>
            {nets.map((netName) => (
              <Badge key={netName} className="text-[10px] px-1.5 py-0 font-bold bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/60 dark:text-amber-300 dark:border-amber-700" data-testid={`badge-network-${hospital.id}`}>
                <Network className="h-2.5 w-2.5 mr-0.5" />
                {netName}
              </Badge>
            ))}
            {pCount > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5 bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800" data-testid={`badge-personnel-hospital-${hospital.id}`}>
                <Users className="h-2.5 w-2.5" />
                {pCount}
              </Badge>
            )}
            {(hospital as any).dataSource === 'iscbc' && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                ISCBC
              </Badge>
            )}
            {!hospital.isActive && (
              <Badge variant="secondary">{t.common.inactive}</Badge>
            )}
          </div>
        );
      },
    },
    {
      key: "country",
      header: <HospitalSortableHeader field="country" label={t.common.country} />,
      cell: (hospital: HospitalType) => (
        <span>
          {getCountryFlag(hospital.countryCode)} {getCountryName(hospital.countryCode)}
        </span>
      ),
    },
    {
      key: "city",
      header: <HospitalSortableHeader field="city" label={t.hospitals.city} />,
      cell: (hospital: HospitalType) => hospital.city || "-",
    },
    {
      key: "region",
      header: <HospitalSortableHeader field="region" label={t.hospitals.region} />,
      cell: (hospital: HospitalType) => hospital.region || "-",
    },
    {
      key: "representative",
      header: t.hospitals.representative,
      cell: (hospital: HospitalType) => getUserName(hospital.representativeId),
    },
    {
      key: "actions",
      header: t.common.actions,
      cell: (hospital: HospitalType) => (
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setPersonnelEntity({ type: "hospital", id: hospital.id, name: hospital.fullName || hospital.name })}
            data-testid={`button-personnel-hospital-${hospital.id}`}
            title={(t as any).medicalPartnerNetwork?.personnel || "Personnel"}
          >
            <Users className="h-4 w-4" />
          </Button>
          {canEdit("hospitals") && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleEdit(hospital)}
              data-testid={`button-edit-hospital-${hospital.id}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {canEdit("hospitals") && (
            <Button
              size="icon"
              variant="ghost"
              title="Doplniť z webu"
              onClick={() => setEnrichTarget({ type: "hospital", id: hospital.id, name: hospital.name, city: hospital.city })}
              data-testid={`button-enrich-hospital-${hospital.id}`}
            >
              <Globe className="h-4 w-4" />
            </Button>
          )}
          {canEdit("hospitals") && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleDelete(hospital)}
              data-testid={`button-delete-hospital-${hospital.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t.nav?.hospitalsAndClinics || "Hospitals & Clinics & Collaborators"} description={t.hospitals.description} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="networks" data-testid="tab-networks">
            <Network className="h-4 w-4 mr-2" />
            {t.hospitals.tabs.healthcareNetworks}
          </TabsTrigger>
          <TabsTrigger value="hospital" data-testid="tab-hospital">
            <Building2 className="h-4 w-4 mr-2" />
            {t.hospitals.tabs.hospital}
          </TabsTrigger>
          <TabsTrigger value="clinics" data-testid="tab-clinics">
            <Stethoscope className="h-4 w-4 mr-2" />
            {t.hospitals.tabs.clinics}
          </TabsTrigger>
          <TabsTrigger value="midwifes" data-testid="tab-midwifes">
            <Baby className="h-4 w-4 mr-2" />
            {t.hospitals.tabs.midwifes || "Midwives"}
          </TabsTrigger>
        </TabsList>
        <div className="mt-1">
          <TabsList className="h-8 bg-muted/40 px-1">
            <TabsTrigger value="collaborators" data-testid="tab-collaborators" className="h-6 text-xs px-3">
              <Users className="h-3.5 w-3.5 mr-1.5" />
              {t.hospitals.tabs.persons || "Persons"}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="hospital" className="mt-6 space-y-4">
          {(() => {
            const sk = locale === "sk";
            const total = serverHospitalStats?.total ?? 0;
            const visible = filteredAndSortedHospitals?.length ?? (serverHospitalsTotal ?? total);
            return (
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between rounded-lg border bg-card px-4 py-3 shadow-sm">
                <div className="min-w-0 flex-1">
                  <h2 className="text-2xl font-semibold tracking-tight" data-testid="page-title-hospitals">
                    {t.hospitals.title}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5" data-testid="text-hospitals-count">
                    <span className="font-semibold text-foreground">{visible.toLocaleString(sk ? "sk-SK" : "en-US")}</span>
                    <span className="mx-1">{sk ? "z" : "of"}</span>
                    <span className="font-medium text-foreground">{total.toLocaleString(sk ? "sk-SK" : "en-US")}</span>
                    <span className="ml-1">{sk ? "nemocníc" : "hospitals"}</span>
                    {hasActiveHospitalFilters && (
                      <>
                        <span className="mx-2 text-muted-foreground/60">·</span>
                        <span className="inline-flex items-center gap-1 text-primary">
                          <ListFilter className="h-3 w-3" />
                          <span className="font-medium">{sk ? "filter aktívny" : "filter active"}</span>
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9 gap-1.5" data-testid="button-export-hospitals" title={sk ? "Exportovať" : "Export"}>
                        <Download className="h-4 w-4" />
                        <span>Export</span>
                        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={() => exportToCsv(filteredAndSortedHospitals, 'hospitals', hospitalExportColumns)} data-testid="button-export-hospitals-csv" className="gap-2">
                        <FileText className="h-4 w-4" />
                        <span>{(t.common as any).exportCsv || "Export CSV"}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => exportToExcel(filteredAndSortedHospitals, 'hospitals', hospitalExportColumns)} data-testid="button-export-hospitals-excel" className="gap-2">
                        <FileSpreadsheet className="h-4 w-4" />
                        <span>{(t.common as any).exportExcel || "Export Excel"}</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => { queryClient.invalidateQueries({ queryKey: ["/api/hospitals"] }); queryClient.invalidateQueries({ queryKey: ["/api/hospitals/stats"] }); }} data-testid="button-refresh-hospitals" title={t.common.refresh} aria-label={t.common.refresh}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  {canAdd("hospitals") && (
                    <Button onClick={handleAddNew} className="h-9 bg-red-700 hover:bg-red-800 text-white" size="sm" data-testid="button-add-hospital">
                      <Plus className="h-4 w-4 mr-1.5" />
                      {t.hospitals.addHospital}
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}
          <Card>
            <CardHeader className="pb-4 space-y-3">
              {serverHospitalStats && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" data-testid="hospitals-summary-bar">
                  <div className={`flex items-center gap-3 p-3 rounded-xl border shadow-sm cursor-pointer transition-all duration-200 ${
                    !hasActiveHospitalFilters
                      ? 'bg-gradient-to-br from-blue-50 to-blue-100/80 dark:from-blue-950/40 dark:to-blue-900/30 border-blue-300 dark:border-blue-700 ring-2 ring-blue-400/30'
                      : 'bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900 dark:to-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600'
                  }`} onClick={() => { setHospitalFilterRules((prev) => prev.filter((r) => r.field !== "status" && r.field !== "personnel")); setHospitalPage(1); }} data-testid="stat-hospitals-total">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-500/15 dark:bg-blue-500/20">
                      <Hospital className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-lg font-bold text-blue-700 dark:text-blue-300 leading-tight">{serverHospitalStats.total}</span>
                      <span className="text-[11px] text-muted-foreground leading-tight">{(t.common as any).total || "Total"}</span>
                    </div>
                  </div>

                  <div className={`flex items-center gap-3 p-3 rounded-xl border shadow-sm cursor-pointer transition-all duration-200 ${
                    hospitalStatusFilter === 'active'
                      ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/80 dark:from-emerald-950/40 dark:to-emerald-900/30 border-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-400/30'
                      : 'bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900 dark:to-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-600'
                  }`} onClick={() => { setHospitalSingleRule("status", hFilterStatus === "active" ? "" : "active"); }} data-testid="stat-hospitals-active">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-500/15 dark:bg-emerald-500/20">
                      <UserCheck className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300 leading-tight">{serverHospitalStats.active}</span>
                      <span className="text-[11px] text-muted-foreground leading-tight">{(t.collaborators as any)?.active || "Active"}</span>
                    </div>
                  </div>

                  <div className={`flex items-center gap-3 p-3 rounded-xl border shadow-sm cursor-pointer transition-all duration-200 ${
                    hospitalStatusFilter === 'inactive'
                      ? 'bg-gradient-to-br from-rose-50 to-rose-100/80 dark:from-rose-950/40 dark:to-rose-900/30 border-rose-300 dark:border-rose-700 ring-2 ring-rose-400/30'
                      : 'bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900 dark:to-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-rose-300 dark:hover:border-rose-600'
                  }`} onClick={() => { setHospitalSingleRule("status", hFilterStatus === "inactive" ? "" : "inactive"); }} data-testid="stat-hospitals-inactive">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-rose-500/15 dark:bg-rose-500/20">
                      <UserX className="h-4.5 w-4.5 text-rose-600 dark:text-rose-400" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-lg font-bold text-rose-700 dark:text-rose-300 leading-tight">{serverHospitalStats.inactive}</span>
                      <span className="text-[11px] text-muted-foreground leading-tight">{(t.collaborators as any)?.inactive || "Inactive"}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-xl border shadow-sm bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900 dark:to-slate-800/50 border-slate-200 dark:border-slate-700" data-testid="stat-hospitals-with-personnel">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-violet-500/15 dark:bg-violet-500/20">
                      <Users className="h-4.5 w-4.5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-lg font-bold text-violet-700 dark:text-violet-300 leading-tight">{serverHospitalStats.withPersonnel}</span>
                      <span className="text-[11px] text-muted-foreground leading-tight">{(t.hospitals as any)?.withPersonnel || "With Personnel"}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-xl border shadow-sm bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900 dark:to-slate-800/50 border-slate-200 dark:border-slate-700" data-testid="stat-hospitals-without-personnel">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-500/15 dark:bg-amber-500/20">
                      <ShieldOff className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-lg font-bold text-amber-700 dark:text-amber-300 leading-tight">{serverHospitalStats.withoutPersonnel}</span>
                      <span className="text-[11px] text-muted-foreground leading-tight">{(t.hospitals as any)?.withoutPersonnel || "No Personnel"}</span>
                    </div>
                  </div>
                </div>
              )}

              <EntityFilter
                searchQuery={searchQuery}
                onSearchChange={(q) => { setSearchQuery(q); setHospitalPage(1); }}
                searchPlaceholder={t.hospitals.searchPlaceholder}
                rules={hospitalFilterRules}
                onRulesChange={handleHospitalRulesChange}
                fields={hospitalFilterFields}
                presets={hospitalFilterPresets}
                totalCount={serverHospitalsTotal}
                visibleCount={paginatedHospitals.length}
                storageKey="entity-filter:hospitals"
                testId="filter-hospitals"
                locale={locale}
                showCountAlways
                onActiveViewChange={(v) => setHospitalActiveView(v ? { id: v.id, name: v.name } : null)}
                labels={{
                  search: t.hospitals.searchPlaceholder,
                  filter: t.common.filter,
                  clearAll: t.common.clearAll,
                }}
              />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredAndSortedHospitals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t.hospitals.noHospitals}
                </div>
              ) : (
                <>
                  <DataTable 
                    columns={columns} 
                    data={paginatedHospitals} 
                    getRowKey={(hospital) => hospital.id}
                  />
                  
                  {/* Pagination controls */}
                  {totalHospitalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <div className="text-sm text-muted-foreground">
                        {t.common.showing} {((hospitalPage - 1) * hospitalPageSize) + 1} - {Math.min(hospitalPage * hospitalPageSize, serverHospitalsTotal)} {t.common.of} {serverHospitalsTotal}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setHospitalPage(1)}
                          disabled={hospitalPage === 1}
                          data-testid="button-hospital-first-page"
                        >
                          {t.common.first}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setHospitalPage(hospitalPage - 1)}
                          disabled={hospitalPage === 1}
                          data-testid="button-hospital-prev-page"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm px-2">
                          {hospitalPage} / {totalHospitalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setHospitalPage(hospitalPage + 1)}
                          disabled={hospitalPage === totalHospitalPages}
                          data-testid="button-hospital-next-page"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setHospitalPage(totalHospitalPages)}
                          disabled={hospitalPage === totalHospitalPages}
                          data-testid="button-hospital-last-page"
                        >
                          {t.common.last}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clinics" className="mt-6 space-y-4">
          {(() => {
            const sk = locale === "sk";
            const total = serverClinicStats?.total ?? 0;
            const visible = filteredAndSortedClinics?.length ?? (serverClinicsTotal ?? total);
            return (
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between rounded-lg border bg-card px-4 py-3 shadow-sm">
                <div className="min-w-0 flex-1">
                  <h2 className="text-2xl font-semibold tracking-tight" data-testid="page-title-clinics">
                    {t.clinics.title}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5" data-testid="text-clinics-count">
                    <span className="font-semibold text-foreground">{visible.toLocaleString(sk ? "sk-SK" : "en-US")}</span>
                    <span className="mx-1">{sk ? "z" : "of"}</span>
                    <span className="font-medium text-foreground">{total.toLocaleString(sk ? "sk-SK" : "en-US")}</span>
                    <span className="ml-1">{sk ? "kliník" : "clinics"}</span>
                    {hasActiveClinicFilters && (
                      <>
                        <span className="mx-2 text-muted-foreground/60">·</span>
                        <span className="inline-flex items-center gap-1 text-primary">
                          <ListFilter className="h-3 w-3" />
                          <span className="font-medium">{sk ? "filter aktívny" : "filter active"}</span>
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9 gap-1.5" data-testid="button-export-clinics" title={sk ? "Exportovať" : "Export"}>
                        <Download className="h-4 w-4" />
                        <span>Export</span>
                        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={() => exportToCsv(filteredAndSortedClinics, 'clinics', clinicExportColumns)} data-testid="button-export-clinics-csv" className="gap-2">
                        <FileText className="h-4 w-4" />
                        <span>{(t.common as any).exportCsv || "Export CSV"}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => exportToExcel(filteredAndSortedClinics, 'clinics', clinicExportColumns)} data-testid="button-export-clinics-excel" className="gap-2">
                        <FileSpreadsheet className="h-4 w-4" />
                        <span>{(t.common as any).exportExcel || "Export Excel"}</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => { refetchClinics(); queryClient.invalidateQueries({ queryKey: ["/api/clinics/stats"] }); }} data-testid="button-refresh-clinics" title={t.common.refresh} aria-label={t.common.refresh}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  {canAdd("hospitals") && (
                    <Button onClick={handleAddNewClinic} className="h-9 bg-red-700 hover:bg-red-800 text-white" size="sm" data-testid="button-add-clinic">
                      <Plus className="h-4 w-4 mr-1.5" />
                      {t.clinics.addClinic}
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}
          <Card>
            <CardHeader className="pb-4 space-y-3">
              {serverClinicStats && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="clinics-summary-bar">
                  <div className={`flex items-center gap-3 p-3 rounded-xl border shadow-sm cursor-pointer transition-all duration-200 ${
                    !hasActiveClinicFilters
                      ? 'bg-gradient-to-br from-teal-50 to-teal-100/80 dark:from-teal-950/40 dark:to-teal-900/30 border-teal-300 dark:border-teal-700 ring-2 ring-teal-400/30'
                      : 'bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900 dark:to-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-600'
                  }`} onClick={() => { setClinicFilterRules((prev) => prev.filter((r) => r.field !== "pipeline" && r.field !== "status")); setClinicPage(1); }} data-testid="stat-clinics-total">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-teal-500/15 dark:bg-teal-500/20">
                      <Stethoscope className="h-4.5 w-4.5 text-teal-600 dark:text-teal-400" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-lg font-bold text-teal-700 dark:text-teal-300 leading-tight">{serverClinicStats.total}</span>
                      <span className="text-[11px] text-muted-foreground leading-tight">{(t.common as any).total || "Total"}</span>
                    </div>
                  </div>

                  <div className={`flex items-center gap-3 p-3 rounded-xl border shadow-sm cursor-pointer transition-all duration-200 ${
                    clinicPipelineFilter === 'contract:active'
                      ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/80 dark:from-emerald-950/40 dark:to-emerald-900/30 border-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-400/30'
                      : 'bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900 dark:to-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-600'
                  }`} onClick={() => { setClinicSingleRule("pipeline", cFilterPipeline === "contract:active" ? "" : "contract:active"); }} data-testid="stat-clinics-contracted">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-500/15 dark:bg-emerald-500/20">
                      <ShieldCheck className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300 leading-tight">{serverClinicStats.pipeline?.['contract:active'] || 0}</span>
                      <span className="text-[11px] text-muted-foreground leading-tight">{(t.clinics as any).pipeline?.activeContract || "Active Contract"}</span>
                    </div>
                  </div>

                  <div className={`flex items-center gap-3 p-3 rounded-xl border shadow-sm cursor-pointer transition-all duration-200 ${
                    clinicPipelineFilter === 'coop:interested'
                      ? 'bg-gradient-to-br from-blue-50 to-blue-100/80 dark:from-blue-950/40 dark:to-blue-900/30 border-blue-300 dark:border-blue-700 ring-2 ring-blue-400/30'
                      : 'bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900 dark:to-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600'
                  }`} onClick={() => { setClinicSingleRule("pipeline", cFilterPipeline === "coop:interested" ? "" : "coop:interested"); }} data-testid="stat-clinics-interested">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-500/15 dark:bg-blue-500/20">
                      <Activity className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-lg font-bold text-blue-700 dark:text-blue-300 leading-tight">{serverClinicStats.pipeline?.['coop:interested'] || 0}</span>
                      <span className="text-[11px] text-muted-foreground leading-tight">{(t.clinics as any).pipeline?.interested || "Interested"}</span>
                    </div>
                  </div>

                  <div className={`flex items-center gap-3 p-3 rounded-xl border shadow-sm cursor-pointer transition-all duration-200 ${
                    clinicPipelineFilter === 'initial:not_contacted'
                      ? 'bg-gradient-to-br from-slate-100 to-slate-200/80 dark:from-slate-800/60 dark:to-slate-700/40 border-slate-400 dark:border-slate-500 ring-2 ring-slate-400/30'
                      : 'bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900 dark:to-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
                  }`} onClick={() => { setClinicSingleRule("pipeline", cFilterPipeline === "initial:not_contacted" ? "" : "initial:not_contacted"); }} data-testid="stat-clinics-not-contacted">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-500/15 dark:bg-slate-500/20">
                      <ShieldOff className="h-4.5 w-4.5 text-slate-500 dark:text-slate-400" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-lg font-bold text-slate-600 dark:text-slate-300 leading-tight">{serverClinicStats.pipeline?.['initial:not_contacted'] || 0}</span>
                      <span className="text-[11px] text-muted-foreground leading-tight">{(t.clinics as any).pipeline?.notContacted || "Not Contacted"}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-xl border shadow-sm bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900 dark:to-slate-800/50 border-slate-200 dark:border-slate-700" data-testid="stat-clinics-recommended-by">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-purple-500/15 dark:bg-purple-500/20">
                      <UserCheck className="h-4.5 w-4.5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-lg font-bold text-purple-700 dark:text-purple-300 leading-tight">{Object.keys(referralCounts?.recommendedBy || {}).length}</span>
                      <span className="text-[11px] text-muted-foreground leading-tight">{(t.clinics as any).recommendedBy || "Recommended"}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-xl border shadow-sm bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900 dark:to-slate-800/50 border-slate-200 dark:border-slate-700" data-testid="stat-clinics-recommends">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-500/15 dark:bg-emerald-500/20">
                      <ArrowRight className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300 leading-tight">{Object.keys(referralCounts?.recommends || {}).length}</span>
                      <span className="text-[11px] text-muted-foreground leading-tight">{(t.clinics as any).recommendsOthers || "Recommends"}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-xl border shadow-sm bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900 dark:to-slate-800/50 border-slate-200 dark:border-slate-700" data-testid="stat-clinics-conferences">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-500/15 dark:bg-amber-500/20">
                      <GraduationCap className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-lg font-bold text-amber-700 dark:text-amber-300 leading-tight">{serverClinicStats.conferenceCount}</span>
                      <span className="text-[11px] text-muted-foreground leading-tight">Conferences</span>
                    </div>
                  </div>
                </div>
              )}

              <EntityFilter
                searchQuery={clinicSearchQuery}
                onSearchChange={(q) => { setClinicSearchQuery(q); setClinicPage(1); }}
                searchPlaceholder={t.clinics.searchPlaceholder}
                rules={clinicFilterRules}
                onRulesChange={handleClinicRulesChange}
                fields={clinicFilterFields}
                presets={clinicFilterPresets}
                totalCount={serverClinicsTotal}
                visibleCount={paginatedClinics.length}
                storageKey="entity-filter:clinics"
                testId="filter-clinics"
                locale={locale}
                showCountAlways
                onActiveViewChange={(v) => setClinicActiveView(v ? { id: v.id, name: v.name } : null)}
                labels={{
                  search: t.clinics.searchPlaceholder,
                  filter: t.common.filter,
                  clearAll: t.common.clearAll,
                }}
              />

              {/* Pipeline Summary Stats */}
              {filteredAndSortedClinics.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 p-3 bg-gradient-to-r from-slate-50 to-blue-50/50 dark:from-slate-900 dark:to-blue-950/30 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm" data-testid="pipeline-summary-bar">
                  <div className="flex items-center gap-1.5 mr-2">
                    <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-primary/10">
                      <Target className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-xs font-bold text-foreground">
                      {(t.clinics as any).pipelineSummary?.title || "Pipeline"}
                    </span>
                  </div>
                  {[
                    { val: "initial:not_contacted", color: "bg-gray-200/80 text-gray-800 border-gray-400 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-500", labelKey: "notContacted" },
                    { val: "initial:former", color: "bg-amber-200/80 text-amber-900 border-amber-400 dark:bg-amber-800 dark:text-amber-100 dark:border-amber-600", labelKey: "formerCollaborator" },
                    { val: "initial:active_contract", color: "bg-green-200/80 text-green-900 border-green-500 dark:bg-green-800 dark:text-green-100 dark:border-green-500", labelKey: "activeContract" },
                    { val: "coop:unknown", color: "bg-slate-200/80 text-slate-700 border-slate-400 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-500", labelKey: "unknown" },
                    { val: "coop:interested", color: "bg-emerald-200/80 text-emerald-900 border-emerald-500 dark:bg-emerald-800 dark:text-emerald-100 dark:border-emerald-500", labelKey: "interested" },
                    { val: "coop:not_interested", color: "bg-red-200/80 text-red-900 border-red-500 dark:bg-red-800 dark:text-red-100 dark:border-red-500", labelKey: "notInterested" },
                    { val: "contract_int:unknown", color: "bg-slate-200/80 text-slate-700 border-slate-400 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-500", labelKey: "unknown" },
                    { val: "contract_int:interested", color: "bg-blue-200/80 text-blue-900 border-blue-500 dark:bg-blue-800 dark:text-blue-100 dark:border-blue-500", labelKey: "interested" },
                    { val: "contract_int:not_interested", color: "bg-red-200/80 text-red-900 border-red-500 dark:bg-red-800 dark:text-red-100 dark:border-red-500", labelKey: "notInterested" },
                    { val: "contract:none", color: "bg-orange-200/80 text-orange-900 border-orange-500 dark:bg-orange-800 dark:text-orange-100 dark:border-orange-500", labelKey: "noContract" },
                    { val: "contract:active", color: "bg-green-300/80 text-green-900 border-green-600 dark:bg-green-700 dark:text-green-100 dark:border-green-400", labelKey: "activeContract" },
                  ].filter(s => pipelineStats.stats[s.val]).map(s => (
                    <Badge key={s.val} variant="outline" className={`text-[10px] px-2.5 py-1 font-bold border shadow-sm cursor-pointer hover:opacity-80 transition-opacity ${s.color}`} data-testid={`stat-${s.val}`}
                      onClick={() => { setClinicSingleRule("pipeline", cFilterPipeline === s.val ? "" : s.val); }}>
                      {(t.clinics as any).pipeline?.[s.labelKey] || s.labelKey} <span className="ml-1 font-black">{pipelineStats.stats[s.val]}</span>
                    </Badge>
                  ))}
                  {pipelineStats.otherStatus > 0 && (
                    <Badge variant="outline" className="text-[10px] px-2.5 py-1 font-bold border shadow-sm bg-yellow-200/80 text-yellow-900 border-yellow-500 dark:bg-yellow-800 dark:text-yellow-100 dark:border-yellow-500" data-testid="stat-other">
                      {t.common.other || "Other"} <span className="ml-1 font-black">{pipelineStats.otherStatus}</span>
                    </Badge>
                  )}
                  {pipelineStats.noStatus > 0 && (
                    <Badge variant="outline" className="text-[10px] px-2.5 py-1 font-bold border shadow-sm bg-gray-200/60 text-gray-600 border-gray-400 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-500 cursor-pointer hover:opacity-80 transition-opacity" data-testid="stat-no-status"
                      onClick={() => { setClinicSingleRule("pipeline", cFilterPipeline === "no_status" ? "" : "no_status"); }}>
                      {(t.clinics as any).pipelineSummary?.noStatus || "No status"} <span className="ml-1 font-black">{pipelineStats.noStatus}</span>
                    </Badge>
                  )}
                  <span className="text-muted-foreground/40 mx-0.5">|</span>
                  {Object.keys(referralCounts?.recommendedBy || {}).length > 0 && (
                    <Badge variant="outline" className="text-[10px] px-2.5 py-1 font-bold border shadow-sm bg-purple-200/80 text-purple-900 border-purple-500 dark:bg-purple-800 dark:text-purple-100 dark:border-purple-500" data-testid="stat-recommended-by">
                      <UserCheck className="h-3 w-3 mr-1" />
                      {(t.clinics as any).recommendedBy || "Recommended"} <span className="ml-1 font-black">{Object.keys(referralCounts?.recommendedBy || {}).length}</span>
                    </Badge>
                  )}
                  {Object.keys(referralCounts?.recommends || {}).length > 0 && (
                    <Badge variant="outline" className="text-[10px] px-2.5 py-1 font-bold border shadow-sm bg-emerald-200/80 text-emerald-900 border-emerald-500 dark:bg-emerald-800 dark:text-emerald-100 dark:border-emerald-500" data-testid="stat-recommends">
                      <ArrowRight className="h-3 w-3 mr-1" />
                      {(t.clinics as any).recommendsOthers || "Recommends"} <span className="ml-1 font-black">{Object.keys(referralCounts?.recommends || {}).length}</span>
                    </Badge>
                  )}
                  {pipelineStats.conferenceCount > 0 && (
                    <Badge variant="outline" className="text-[10px] px-2.5 py-1 font-bold border shadow-sm bg-rose-200/80 text-rose-900 border-rose-500 dark:bg-rose-800 dark:text-rose-100 dark:border-rose-500" data-testid="stat-conference">
                      <GraduationCap className="h-3 w-3 mr-1" />
                      Conference <span className="ml-1 font-black">{pipelineStats.conferenceCount}</span>
                    </Badge>
                  )}
                  <div className="ml-auto pl-2">
                    <Badge className="text-[10px] px-2.5 py-1 font-bold bg-primary/10 text-primary border-primary/30 hover:bg-primary/20" data-testid="stat-total">
                      {(t.clinics as any).pipelineSummary?.total || "Total"}: {serverClinicStats?.total ?? serverClinicsTotal}
                    </Badge>
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {isLoadingClinics ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredAndSortedClinics.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t.clinics.noClinics}
                </div>
              ) : (
                <>
                  <DataTable 
                    columns={clinicColumns} 
                    data={paginatedClinics} 
                    getRowKey={(clinic) => clinic.id}
                  />
                  
                  {/* Pagination controls */}
                  {totalClinicPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <div className="text-sm text-muted-foreground">
                        {t.common.showing || "Zobrazujem"} {((clinicPage - 1) * clinicPageSize) + 1} - {Math.min(clinicPage * clinicPageSize, serverClinicsTotal)} {t.common.of || "z"} {serverClinicsTotal}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setClinicPage(1)}
                          disabled={clinicPage === 1}
                          data-testid="button-clinic-first-page"
                        >
                          {t.common.first}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setClinicPage(clinicPage - 1)}
                          disabled={clinicPage === 1}
                          data-testid="button-clinic-prev-page"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm px-2">
                          {clinicPage} / {totalClinicPages}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setClinicPage(clinicPage + 1)}
                          disabled={clinicPage === totalClinicPages}
                          data-testid="button-clinic-next-page"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setClinicPage(totalClinicPages)}
                          disabled={clinicPage === totalClinicPages}
                          data-testid="button-clinic-last-page"
                        >
                          {t.common.last}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="midwifes" className="mt-6">
          <CollaboratorsContent embedded={true} positionScope="independent" addButtonLabel={t.hospitals.tabs.addMidwife || "Add Midwife"} showHeader headerTitle={t.hospitals.tabs.midwifes || "Midwifes"} headerCountWord={{ sk: "pôrodných asistentiek", en: "midwifes" }} />
        </TabsContent>

        <TabsContent value="collaborators" className="mt-6">
          <CollaboratorsContent embedded={true} excludeScope="independent" addButtonLabel={t.hospitals.tabs.addPerson || "Add Person"} showHeader headerTitle={t.hospitals.tabs.persons || "Persons"} headerCountWord={{ sk: "osôb", en: "persons" }} />
        </TabsContent>

        <TabsContent value="networks" className="mt-6">
          <HospitalNetworksTab />
        </TabsContent>
      </Tabs>

      {isFormOpen && (
        <HospitalAddDrawer
          onClose={() => setIsFormOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/hospitals"] });
            queryClient.invalidateQueries({ queryKey: ["/api/hospitals/stats"] });
            setIsFormOpen(false);
          }}
        />
      )}

      {editingHospital && (
        <HospitalEditDrawer
          hospital={editingHospital}
          onClose={() => setEditingHospital(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/hospitals"] });
            queryClient.invalidateQueries({ queryKey: ["/api/hospitals/stats"] });
            setEditingHospital(null);
          }}
        />
      )}

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.hospitals.deleteHospital}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.hospitals.deleteConfirm}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              {t.common.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => hospitalToDelete && deleteMutation.mutate(hospitalToDelete.id)}
              data-testid="button-confirm-delete"
            >
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ClinicFormSheet
        open={isClinicFormOpen}
        onOpenChange={setIsClinicFormOpen}
        initialData={selectedClinic}
        onSuccess={() => setIsClinicFormOpen(false)}
      />

      <AlertDialog open={isClinicDeleteOpen} onOpenChange={setIsClinicDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.clinics.deleteClinic}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.clinics.deleteConfirm}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-clinic">
              {t.common.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => clinicToDelete && deleteClinicMutation.mutate(clinicToDelete.id)}
              data-testid="button-confirm-delete-clinic"
            >
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {personnelEntity && (
        <InstitutionPersonnelPanel
          entityType={personnelEntity.type}
          entityId={personnelEntity.id}
          entityName={personnelEntity.name}
          open={!!personnelEntity}
          onOpenChange={(open) => { if (!open) setPersonnelEntity(null); }}
        />
      )}

      {enrichTarget && (
        <EnrichFromWebDialog
          open={!!enrichTarget}
          onOpenChange={(open) => { if (!open) setEnrichTarget(null); }}
          targetType={enrichTarget.type}
          targetId={enrichTarget.id}
          targetName={enrichTarget.name}
          targetCity={enrichTarget.city}
        />
      )}
    </div>
  );
}
