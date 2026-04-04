import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Search, Building2, FileText, Award, Gift, ListChecks, FileEdit, MapPin, Navigation, ExternalLink, Database, Loader2, Globe, Stethoscope, RefreshCw, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Filter, X, Download, FileSpreadsheet, Target, UserCheck, UserX, GraduationCap, Users, ListFilter, Activity, ShieldCheck, ShieldOff, Hospital, Settings, StickyNote, Star, Phone, Mail, Smartphone, UserPlus, Save } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { HospitalFormWizard } from "@/components/hospital-form-wizard";
import EntityCampaignTimeline from "@/components/campaigns/EntityCampaignTimeline";
import { ClinicFormSheet } from "@/components/clinic-form-wizard";
import { CollaboratorsContent } from "@/pages/collaborators";
import { InstitutionPersonnelPanel, InstitutionPersonnelManager } from "@/components/institution-personnel-panel";
import { Button } from "@/components/ui/button";
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
  responsiblePersonId: "",
  countryCode: "",
  contactPerson: "",
  svetZdravia: false,
  latitude: "",
  longitude: "",
};

function PersonnelTabContent({ entityType, entityId, entityName }: { entityType: string; entityId: string; entityName: string }) {
  const { t } = useI18n();
  const { data: personnelData, isLoading } = useQuery<any>({
    queryKey: ["/api/institutions", entityType, entityId, "personnel"],
    queryFn: () => fetch(`/api/institutions/${entityType}/${entityId}/personnel`, { credentials: "include" }).then(r => r.json()),
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
  );
}

function HospitalEditDrawer({ hospital, onClose, onSuccess }: { hospital: HospitalType; onClose: () => void; onSuccess: () => void }) {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hospitals"] });
      toast({ title: t.success.saved });
      onSuccess();
    },
    onError: () => { toast({ title: t.errors.saveFailed, variant: "destructive" }); },
  });

  const handleSubmit = () => {
    if (!formData.name || !formData.countryCode) {
      toast({ title: t.errors.required, variant: "destructive" });
      return;
    }
    saveMutation.mutate(formData);
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
    { id: "address", label: t.clinics.steps.address, icon: MapPin },
    { id: "contacts", label: t.clinics.steps.web, icon: FileText },
    { id: "settings", label: t.clinics.steps.settings, icon: Settings },
    { id: "personnel", label: mpnT.personnel || "Personnel", icon: Users },
    { id: "campaigns", label: "Kampane", icon: Target },
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
              <h2 className="text-base font-semibold" data-testid="text-hospital-drawer-name">{hospital.name}</h2>
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
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ed-name">{t.hospitals.name} *</Label>
                    <Input id="ed-name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder={t.hospitals.name} data-testid="input-ed-hospital-name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ed-fullName">{t.hospitals.fullName}</Label>
                    <Input id="ed-fullName" value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} placeholder={t.hospitals.fullName} data-testid="input-ed-hospital-fullname" />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ed-country">{t.common.country} *</Label>
                    <Select value={formData.countryCode} onValueChange={(value) => setFormData({ ...formData, countryCode: value, laboratoryId: "" })}>
                      <SelectTrigger data-testid="select-ed-hospital-country"><SelectValue placeholder={t.common.country} /></SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((country) => (<SelectItem key={country.code} value={country.code}>{getCountryFlag(country.code)} {country.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ed-laboratory">{t.hospitals.laboratory}</Label>
                    <Select value={formData.laboratoryId || "_none"} onValueChange={(value) => setFormData({ ...formData, laboratoryId: value === "_none" ? "" : value })}>
                      <SelectTrigger data-testid="select-ed-hospital-laboratory"><SelectValue placeholder={t.hospitals.laboratory} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">{t.common.noData}</SelectItem>
                        {filteredLaboratories.map((lab) => (<SelectItem key={lab.id} value={lab.id}>{lab.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {activeSection === "address" && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>{t.hospitals.streetNumber}</Label>
                    <Input value={formData.streetNumber} onChange={(e) => setFormData({ ...formData, streetNumber: e.target.value })} data-testid="input-ed-hospital-street" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.hospitals.city}</Label>
                    <Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} data-testid="input-ed-hospital-city" />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.hospitals.postalCode}</Label>
                    <Input value={formData.postalCode} onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })} data-testid="input-ed-hospital-postalcode" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t.hospitals.region}</Label>
                  <Input value={formData.region} onChange={(e) => setFormData({ ...formData, region: e.target.value })} data-testid="input-ed-hospital-region" />
                </div>
                <div className="border-t pt-4 mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-base font-medium">{t.clinics.gpsCoordinates}</Label>
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
            )}

            {activeSection === "contacts" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t.hospitals.contactPerson}</Label>
                  <Input value={formData.contactPerson} onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })} data-testid="input-ed-hospital-contact" />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t.hospitals.representative}</Label>
                    <Select value={formData.representativeId || "_none"} onValueChange={(value) => setFormData({ ...formData, representativeId: value === "_none" ? "" : value })}>
                      <SelectTrigger data-testid="select-ed-hospital-representative"><SelectValue placeholder={t.hospitals.representative} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">{t.common.noData}</SelectItem>
                        {users.map((user) => (<SelectItem key={user.id} value={user.id}>{user.fullName}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t.hospitals.responsiblePerson}</Label>
                    <Select value={formData.responsiblePersonId || "_none"} onValueChange={(value) => setFormData({ ...formData, responsiblePersonId: value === "_none" ? "" : value })}>
                      <SelectTrigger data-testid="select-ed-hospital-responsible"><SelectValue placeholder={t.hospitals.responsiblePerson} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">{t.common.noData}</SelectItem>
                        {users.map((user) => (<SelectItem key={user.id} value={user.id}>{user.fullName}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {activeSection === "settings" && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch id="ed-isActive" checked={formData.isActive} onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })} data-testid="switch-ed-hospital-active" />
                  <Label htmlFor="ed-isActive">{t.common.active}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="ed-autoRecruiting" checked={formData.autoRecruiting} onCheckedChange={(checked) => setFormData({ ...formData, autoRecruiting: checked })} data-testid="switch-ed-hospital-autorecruiting" />
                  <Label htmlFor="ed-autoRecruiting">{t.hospitals.autoRecruiting}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="ed-svetZdravia" checked={formData.svetZdravia} onCheckedChange={(checked) => setFormData({ ...formData, svetZdravia: checked })} data-testid="switch-ed-hospital-svetzdravia" />
                  <Label htmlFor="ed-svetZdravia">{t.hospitals.svetZdravia}</Label>
                </div>
              </div>
            )}

            {activeSection === "personnel" && (
              <InstitutionPersonnelManager entityType="hospital" entityId={hospital.id} entityName={hospital.name} />
            )}

            {activeSection === "campaigns" && (
              <EntityCampaignTimeline entityType="hospital" entityId={hospital.id} entityName={hospital.name} />
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
              {formData.name || "Nemocnica"} - Poloha na mape
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

function HospitalForm({
  hospital,
  onClose,
  onSuccess,
}: {
  hospital?: HospitalType;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [formTab, setFormTab] = useState("basic");
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [showMapDialog, setShowMapDialog] = useState(false);
  
  const [formData, setFormData] = useState<HospitalFormData>(() =>
    hospital
      ? {
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
          responsiblePersonId: hospital.responsiblePersonId || "",
          countryCode: hospital.countryCode,
          contactPerson: hospital.contactPerson || "",
          svetZdravia: hospital.svetZdravia,
          latitude: hospital.latitude || "",
          longitude: hospital.longitude || "",
        }
      : defaultFormData
  );

  const { data: users = [] } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
  });

  const { data: laboratories = [] } = useQuery<Laboratory[]>({
    queryKey: ["/api/config/laboratories"],
  });

  const filteredLaboratories = formData.countryCode
    ? laboratories.filter((lab) => lab.countryCode === formData.countryCode)
    : laboratories;

  const saveMutation = useMutation({
    mutationFn: (data: HospitalFormData) => {
      if (hospital) {
        return apiRequest("PUT", `/api/hospitals/${hospital.id}`, data);
      } else {
        return apiRequest("POST", "/api/hospitals", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hospitals"] });
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

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: t.clinics.gpsNotSupported, variant: "destructive" });
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
        toast({ title: t.clinics.gpsLoaded });
      },
      (error) => {
        setIsLoadingLocation(false);
        let message = t.clinics.gpsError;
        if (error.code === error.PERMISSION_DENIED) {
          message = t.clinics.gpsPermissionDenied;
        }
        toast({ title: message, variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-4">
      <Tabs value={formTab} onValueChange={setFormTab}>
        <TabsList className={`grid w-full ${hospital ? 'grid-cols-6' : 'grid-cols-4'}`}>
          <TabsTrigger value="basic" data-testid="tab-form-basic">
            <Building2 className="h-4 w-4 mr-2" />
            {t.clinics.steps.basic}
          </TabsTrigger>
          <TabsTrigger value="address" data-testid="tab-form-address">
            <MapPin className="h-4 w-4 mr-2" />
            {t.clinics.steps.address}
          </TabsTrigger>
          <TabsTrigger value="contacts" data-testid="tab-form-contacts">
            <FileText className="h-4 w-4 mr-2" />
            {t.clinics.steps.web}
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-form-settings">
            <ListChecks className="h-4 w-4 mr-2" />
            {t.clinics.steps.settings}
          </TabsTrigger>
          {hospital && (
            <TabsTrigger value="campaigns" data-testid="tab-form-campaigns">
              <Target className="h-4 w-4 mr-2" />
              Kampane
            </TabsTrigger>
          )}
          {hospital && (
            <TabsTrigger value="personnel" data-testid="tab-form-personnel">
              <Users className="h-4 w-4 mr-2" />
              {(t as any).medicalPartnerNetwork?.personnel || "Personnel"}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="basic" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">{t.hospitals.name} *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t.hospitals.name}
                data-testid="input-hospital-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">{t.hospitals.fullName}</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder={t.hospitals.fullName}
                data-testid="input-hospital-fullname"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="countryCode">{t.common.country} *</Label>
              <Select
                value={formData.countryCode}
                onValueChange={(value) =>
                  setFormData({ ...formData, countryCode: value, laboratoryId: "" })
                }
              >
                <SelectTrigger data-testid="select-hospital-country">
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
              <Label htmlFor="laboratory">{t.hospitals.laboratory}</Label>
              <Select
                value={formData.laboratoryId || "_none"}
                onValueChange={(value) =>
                  setFormData({ ...formData, laboratoryId: value === "_none" ? "" : value })
                }
              >
                <SelectTrigger data-testid="select-hospital-laboratory">
                  <SelectValue placeholder={t.hospitals.laboratory} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">{t.common.noData}</SelectItem>
                  {filteredLaboratories.map((lab) => (
                    <SelectItem key={lab.id} value={lab.id}>
                      {lab.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="address" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="streetNumber">{t.hospitals.streetNumber}</Label>
              <Input
                id="streetNumber"
                value={formData.streetNumber}
                onChange={(e) => setFormData({ ...formData, streetNumber: e.target.value })}
                placeholder={t.hospitals.streetNumber}
                data-testid="input-hospital-street"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">{t.hospitals.city}</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder={t.hospitals.city}
                data-testid="input-hospital-city"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postalCode">{t.hospitals.postalCode}</Label>
              <Input
                id="postalCode"
                value={formData.postalCode}
                onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                placeholder={t.hospitals.postalCode}
                data-testid="input-hospital-postalcode"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="region">{t.hospitals.region}</Label>
            <Input
              id="region"
              value={formData.region}
              onChange={(e) => setFormData({ ...formData, region: e.target.value })}
              placeholder={t.hospitals.region}
              data-testid="input-hospital-region"
            />
          </div>

          <div className="border-t pt-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-base font-medium">{t.clinics.gpsCoordinates}</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGetCurrentLocation}
                  disabled={isLoadingLocation}
                  data-testid="button-get-location"
                >
                  <Navigation className={`h-4 w-4 mr-2 ${isLoadingLocation ? 'animate-spin' : ''}`} />
                  {isLoadingLocation ? t.common.loading : t.clinics.getCurrentLocation}
                </Button>
                {formData.latitude && formData.longitude && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowMapDialog(true)}
                    data-testid="button-show-on-map"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {t.clinics.showOnMap}
                  </Button>
                )}
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
                  data-testid="input-hospital-latitude"
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
                  data-testid="input-hospital-longitude"
                />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="contacts" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="contactPerson">{t.hospitals.contactPerson}</Label>
            <Input
              id="contactPerson"
              value={formData.contactPerson}
              onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
              placeholder={t.hospitals.contactPerson}
              data-testid="input-hospital-contact"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="representative">{t.hospitals.representative}</Label>
              <Select
                value={formData.representativeId || "_none"}
                onValueChange={(value) =>
                  setFormData({ ...formData, representativeId: value === "_none" ? "" : value })
                }
              >
                <SelectTrigger data-testid="select-hospital-representative">
                  <SelectValue placeholder={t.hospitals.representative} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">{t.common.noData}</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="responsiblePerson">{t.hospitals.responsiblePerson}</Label>
              <Select
                value={formData.responsiblePersonId || "_none"}
                onValueChange={(value) =>
                  setFormData({ ...formData, responsiblePersonId: value === "_none" ? "" : value })
                }
              >
                <SelectTrigger data-testid="select-hospital-responsible">
                  <SelectValue placeholder={t.hospitals.responsiblePerson} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">{t.common.noData}</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4 mt-4">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                data-testid="switch-hospital-active"
              />
              <Label htmlFor="isActive">{t.common.active}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="autoRecruiting"
                checked={formData.autoRecruiting}
                onCheckedChange={(checked) => setFormData({ ...formData, autoRecruiting: checked })}
                data-testid="switch-hospital-autorecruiting"
              />
              <Label htmlFor="autoRecruiting">{t.hospitals.autoRecruiting}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="svetZdravia"
                checked={formData.svetZdravia}
                onCheckedChange={(checked) => setFormData({ ...formData, svetZdravia: checked })}
                data-testid="switch-hospital-svetzdravia"
              />
              <Label htmlFor="svetZdravia">{t.hospitals.svetZdravia}</Label>
            </div>
          </div>
        </TabsContent>

        {hospital && (
          <TabsContent value="campaigns" className="space-y-4 mt-4">
            <EntityCampaignTimeline entityType="hospital" entityId={hospital.id} entityName={hospital.name} />
          </TabsContent>
        )}
        {hospital && (
          <TabsContent value="personnel" className="space-y-4 mt-4">
            <PersonnelTabContent entityType="hospital" entityId={hospital.id} entityName={hospital.name} />
          </TabsContent>
        )}
      </Tabs>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel">
          {t.common.cancel}
        </Button>
        <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save-hospital">
          {saveMutation.isPending ? t.common.loading : t.common.save}
        </Button>
      </div>
    </form>

    <Dialog open={showMapDialog} onOpenChange={setShowMapDialog}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            {formData.name || "Nemocnica"} - Poloha na mape
          </DialogTitle>
        </DialogHeader>
        <div className="w-full h-[400px] rounded-lg overflow-hidden border">
          {formData.latitude && formData.longitude && (
            <iframe
              title="Hospital Location Map"
              width="100%"
              height="100%"
              frameBorder="0"
              style={{ border: 0 }}
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(formData.longitude) - 0.01}%2C${parseFloat(formData.latitude) - 0.01}%2C${parseFloat(formData.longitude) + 0.01}%2C${parseFloat(formData.latitude) + 0.01}&layer=mapnik&marker=${formData.latitude}%2C${formData.longitude}`}
              allowFullScreen
            />
          )}
        </div>
        <div className="flex justify-between items-center text-sm text-muted-foreground">
          <span>GPS: {formData.latitude}, {formData.longitude}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`https://www.google.com/maps?q=${formData.latitude},${formData.longitude}`, '_blank')}
            data-testid="button-open-google-maps"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            {t.clinics.openInNewTab}
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

export default function HospitalsPage() {
  const { t } = useI18n();
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
  const [activeTab, setActiveTab] = useState("hospital");
  const [useWizardForm, setUseWizardForm] = useState(true);
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

  const isAdmin = user?.role === "admin";

  const hospitalQueryParams: Record<string, any> = { page: hospitalPage, limit: hospitalPageSize };
  if (debouncedHospitalSearch) hospitalQueryParams.search = debouncedHospitalSearch;
  if (countryTab !== "ALL") hospitalQueryParams.country = countryTab;
  if (selectedCountries.length > 0) hospitalQueryParams.countries = selectedCountries.join(",");
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
  if (clinicCountryTab !== "ALL") clinicQueryParams.country = clinicCountryTab;
  if (selectedCountries.length > 0) clinicQueryParams.countries = selectedCountries.join(",");
  const { data: clinicsPaginatedResult, isLoading: isLoadingClinics, refetch: refetchClinics } = useQuery<{ data: Clinic[], total: number }>({
    queryKey: ["/api/clinics", clinicQueryParams],
  });
  const clinics = clinicsPaginatedResult?.data || [];
  const serverClinicsTotal = clinicsPaginatedResult?.total || 0;

  const { data: personnelCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ["/api/mpn/entity-personnel-counts"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/hospitals/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hospitals"] });
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
    let result = clinics.filter((clinic) => {
      const matchesCity = !clinicCityFilter || clinic.city?.toLowerCase().includes(clinicCityFilter.toLowerCase());
      const matchesStatus = clinicStatusFilter === "all" || 
        (clinicStatusFilter === "active" && clinic.isActive) ||
        (clinicStatusFilter === "inactive" && !clinic.isActive);
      const matchesWebsite = clinicHasWebsite === "all" ||
        (clinicHasWebsite === "yes" && clinic.website) ||
        (clinicHasWebsite === "no" && !clinic.website);
      let matchesPipeline = true;
      if (clinicPipelineFilter !== "all") {
        const c = clinic as any;
        let pVal = "";
        if (c.contractStatus) pVal = `contract:${c.contractStatus}`;
        else if (c.interestContract) pVal = `contract_int:${c.interestContract}`;
        else if (c.interestCooperation) pVal = `coop:${c.interestCooperation}`;
        else if (c.initialStatus) pVal = `initial:${c.initialStatus}`;
        if (clinicPipelineFilter === "no_status") {
          matchesPipeline = !pVal;
        } else {
          matchesPipeline = pVal === clinicPipelineFilter;
        }
      }
      return matchesCity && matchesStatus && matchesWebsite && matchesPipeline;
    });
    
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
  
  const hasActiveClinicFilters = clinicSearchQuery || clinicCityFilter || clinicStatusFilter !== "all" || clinicHasWebsite !== "all" || clinicPipelineFilter !== "all" || clinicCountryTab !== "ALL";

  // Filtered and sorted hospitals (search + country done server-side)
  const filteredAndSortedHospitals = (() => {
    let result = hospitals.filter((hospital) => {
      const matchesCity = !hospitalCityFilter || hospital.city?.toLowerCase().includes(hospitalCityFilter.toLowerCase());
      const matchesStatus = hospitalStatusFilter === "all" || 
        (hospitalStatusFilter === "active" && hospital.isActive) ||
        (hospitalStatusFilter === "inactive" && !hospital.isActive);
      return matchesCity && matchesStatus;
    });
    
    // Then sort
    result.sort((a, b) => {
      let aVal: any;
      let bVal: any;
      
      switch (hospitalSortField) {
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "city":
          aVal = (a.city || "").toLowerCase();
          bVal = (b.city || "").toLowerCase();
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
  
  const hasActiveHospitalFilters = searchQuery || hospitalCityFilter || hospitalStatusFilter !== "all" || countryTab !== "ALL";

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
        return (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{clinic.name}</span>
            {pCount > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5 bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800" data-testid={`badge-personnel-clinic-${clinic.id}`}>
                <Users className="h-2.5 w-2.5" />
                {pCount}
              </Badge>
            )}
            {!clinic.isActive && (
              <Badge variant="secondary">{t.common.inactive}</Badge>
            )}
            {(clinic as any).isReferredByDoctor && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-purple-100 text-purple-700 border border-purple-300 dark:bg-purple-900/60 dark:text-purple-300 dark:border-purple-700" data-testid={`badge-referral-${clinic.id}`}>
                <UserCheck className="h-2.5 w-2.5" />
                Referral
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
      key: "website",
      header: t.clinics.website,
      cell: (clinic: Clinic) => 
        clinic.website ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.open(getWebsiteUrl(clinic.website || ""), "_blank")}
            data-testid={`link-clinic-website-${clinic.id}`}
          >
            <Globe className="h-4 w-4" />
          </Button>
        ) : "-",
    },
    {
      key: "pipelineStatus",
      header: (t.clinics as any).pipeline?.title || "Pipeline",
      cell: (clinic: Clinic) => {
        const c = clinic as any;
        let pVal = "";
        if (c.contractStatus) pVal = `contract:${c.contractStatus}`;
        else if (c.interestContract) pVal = `contract_int:${c.interestContract}`;
        else if (c.interestCooperation) pVal = `coop:${c.interestCooperation}`;
        else if (c.initialStatus) pVal = `initial:${c.initialStatus}`;
        if (!pVal) return <span className="text-muted-foreground text-xs">-</span>;
        const pipelineLabelMap: Record<string, { labelKey: string; color: string }> = {
          "initial:not_contacted": { labelKey: "notContacted", color: "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600" },
          "initial:former": { labelKey: "formerCollaborator", color: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900 dark:text-amber-300 dark:border-amber-700" },
          "initial:active_contract": { labelKey: "activeContract", color: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-300 dark:border-green-700" },
          "coop:unknown": { labelKey: "unknown", color: "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600" },
          "coop:interested": { labelKey: "interested", color: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900 dark:text-emerald-300 dark:border-emerald-700" },
          "coop:not_interested": { labelKey: "notInterested", color: "bg-red-100 text-red-700 border-red-300 dark:bg-red-900 dark:text-red-300 dark:border-red-700" },
          "contract_int:unknown": { labelKey: "unknown", color: "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600" },
          "contract_int:interested": { labelKey: "interested", color: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-700" },
          "contract_int:not_interested": { labelKey: "notInterested", color: "bg-red-100 text-red-700 border-red-300 dark:bg-red-900 dark:text-red-300 dark:border-red-700" },
          "contract:none": { labelKey: "noContract", color: "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900 dark:text-orange-300 dark:border-orange-700" },
          "contract:active": { labelKey: "activeContract", color: "bg-green-100 text-green-800 border-green-400 dark:bg-green-900 dark:text-green-200 dark:border-green-600" },
        };
        const info = pipelineLabelMap[pVal];
        if (!info) return <Badge variant="outline" className="text-[10px]">{pVal}</Badge>;
        return (
          <Badge variant="outline" className={`text-[10px] px-2 py-0.5 whitespace-nowrap font-semibold ${info.color}`} data-testid={`badge-pipeline-${clinic.id}`}>
            {(t.clinics as any).pipeline?.[info.labelKey] || info.labelKey}
          </Badge>
        );
      },
    },
    {
      key: "phone",
      header: t.clinics.phone,
      cell: (clinic: Clinic) => clinic.phone || "-",
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
      header: <HospitalSortableHeader field="name" label={t.hospitals.name} />,
      cell: (hospital: HospitalType) => {
        const pCount = personnelCounts[`hospital:${hospital.id}`] || 0;
        return (
          <div className="flex items-center gap-2">
            <span className="font-medium">{hospital.name}</span>
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
      key: "laboratory",
      header: t.hospitals.laboratory,
      cell: (hospital: HospitalType) => getLabName(hospital.laboratoryId),
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
            onClick={() => setPersonnelEntity({ type: "hospital", id: hospital.id, name: hospital.name })}
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
      <PageHeader title={t.hospitals.title} description={t.hospitals.description}>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button 
              variant="outline" 
              onClick={() => seedAllMutation.mutate()}
              disabled={seedAllMutation.isPending}
              data-testid="button-seed-all-hospitals"
            >
              {seedAllMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Database className="h-4 w-4 mr-2" />
              )}
              {seedAllMutation.isPending ? t.hospitals.seeding : t.hospitals.seedAll}
            </Button>
          )}
          {canAdd("hospitals") && (
            <Button onClick={handleAddNew} data-testid="button-add-hospital">
              <Plus className="h-4 w-4 mr-2" />
              {t.hospitals.addHospital}
            </Button>
          )}
        </div>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="hospital" data-testid="tab-hospital">
            <Building2 className="h-4 w-4 mr-2" />
            {t.hospitals.tabs.hospital}
          </TabsTrigger>
          <TabsTrigger value="clinics" data-testid="tab-clinics">
            <Stethoscope className="h-4 w-4 mr-2" />
            {t.hospitals.tabs.clinics}
          </TabsTrigger>
          <TabsTrigger value="collaborators" data-testid="tab-collaborators">
            <Users className="h-4 w-4 mr-2" />
            {t.nav?.collaborators || "Collaborators"}
          </TabsTrigger>
          <TabsTrigger value="agreements" data-testid="tab-agreements">
            <FileText className="h-4 w-4 mr-2" />
            {t.hospitals.tabs.agreements}
          </TabsTrigger>
          <TabsTrigger value="templates" data-testid="tab-templates">
            <FileText className="h-4 w-4 mr-2" />
            {t.hospitals.tabs.templates}
          </TabsTrigger>
          <TabsTrigger value="rewards" data-testid="tab-rewards">
            <Gift className="h-4 w-4 mr-2" />
            {t.hospitals.tabs.rewards}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hospital" className="mt-6">
          <Card>
            <CardHeader className="pb-4 space-y-3">
              {serverHospitalStats && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" data-testid="hospitals-summary-bar">
                  <div className={`flex items-center gap-3 p-3 rounded-xl border shadow-sm cursor-pointer transition-all duration-200 ${
                    !hasActiveHospitalFilters
                      ? 'bg-gradient-to-br from-blue-50 to-blue-100/80 dark:from-blue-950/40 dark:to-blue-900/30 border-blue-300 dark:border-blue-700 ring-2 ring-blue-400/30'
                      : 'bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900 dark:to-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600'
                  }`} onClick={() => { setHospitalStatusFilter("all"); handleHospitalFilterChange(); }} data-testid="stat-hospitals-total">
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
                  }`} onClick={() => { setHospitalStatusFilter(hospitalStatusFilter === 'active' ? 'all' : 'active'); handleHospitalFilterChange(); }} data-testid="stat-hospitals-active">
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
                  }`} onClick={() => { setHospitalStatusFilter(hospitalStatusFilter === 'inactive' ? 'all' : 'inactive'); handleHospitalFilterChange(); }} data-testid="stat-hospitals-inactive">
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
              {hasActiveHospitalFilters && (
                <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 rounded-lg border border-primary/20">
                  <ListFilter className="h-3.5 w-3.5 text-primary" />
                  <span className="text-sm font-medium text-primary">{serverHospitalsTotal} {(t.common as any).found || "found"}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportToCsv(filteredAndSortedHospitals, 'hospitals', hospitalExportColumns)}
                    data-testid="button-export-hospitals-csv"
                  >
                    <Download className="h-4 w-4 mr-1.5" />
                    Export CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportToExcel(filteredAndSortedHospitals, 'hospitals', hospitalExportColumns)}
                    data-testid="button-export-hospitals-excel"
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-1.5" />
                    Export Excel
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/hospitals"] })}
                    data-testid="button-refresh-hospitals"
                  >
                    <RefreshCw className="h-4 w-4 mr-1.5" />
                    {t.common.refresh}
                  </Button>
                  {canAdd("hospitals") && (
                    <Button onClick={handleAddNew} className="bg-red-700 hover:bg-red-800 text-white" data-testid="button-add-hospital">
                      <Plus className="h-4 w-4 mr-1.5" />
                      {t.hospitals.addHospital}
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t.hospitals.searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); handleHospitalFilterChange(); }}
                    className="pl-10"
                    data-testid="input-search-hospitals"
                  />
                </div>
                <Button
                  variant={showHospitalFilters ? "default" : "outline"}
                  size="default"
                  onClick={() => setShowHospitalFilters(!showHospitalFilters)}
                  className={showHospitalFilters ? "bg-red-700 hover:bg-red-800 text-white" : ""}
                  data-testid="button-toggle-hospital-filters"
                >
                  <Filter className="h-4 w-4 mr-1.5" />
                  {t.common.filter}
                </Button>
              </div>

              {showHospitalFilters && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-medium mb-1.5 block text-muted-foreground">{t.common.country}</label>
                      <Select value={countryTab} onValueChange={(val) => { setCountryTab(val); handleHospitalFilterChange(); }}>
                        <SelectTrigger data-testid="select-filter-hospital-country" className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">{t.common.all}</SelectItem>
                          {COUNTRIES.map((country) => {
                            const count = countryCounts[country.code] || 0;
                            if (count === 0) return null;
                            return (
                              <SelectItem key={country.code} value={country.code}>
                                {country.flag} {country.code} ({count})
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1.5 block text-muted-foreground">{t.common.status}</label>
                      <Select value={hospitalStatusFilter} onValueChange={(val) => { setHospitalStatusFilter(val); handleHospitalFilterChange(); }}>
                        <SelectTrigger data-testid="select-filter-hospital-status" className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t.common.all}</SelectItem>
                          <SelectItem value="active">{t.common.active}</SelectItem>
                          <SelectItem value="inactive">{t.common.inactive}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1.5 block text-muted-foreground">{t.hospitals.city}</label>
                      <Input
                        placeholder={t.clinics.filterByCity}
                        value={hospitalCityFilter}
                        onChange={(e) => { setHospitalCityFilter(e.target.value); handleHospitalFilterChange(); }}
                        className="h-9"
                        data-testid="input-filter-hospital-city"
                      />
                    </div>
                  </div>
                  {hasActiveHospitalFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearHospitalFilters}
                      className="text-xs"
                      data-testid="button-clear-hospital-filters"
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      {t.common.clearFilters}
                    </Button>
                  )}
                </div>
              )}
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

        <TabsContent value="clinics" className="mt-6">
          <Card>
            <CardHeader className="pb-4 space-y-3">
              {serverClinicStats && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="clinics-summary-bar">
                  <div className={`flex items-center gap-3 p-3 rounded-xl border shadow-sm cursor-pointer transition-all duration-200 ${
                    !hasActiveClinicFilters
                      ? 'bg-gradient-to-br from-teal-50 to-teal-100/80 dark:from-teal-950/40 dark:to-teal-900/30 border-teal-300 dark:border-teal-700 ring-2 ring-teal-400/30'
                      : 'bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900 dark:to-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-600'
                  }`} onClick={() => { setClinicPipelineFilter("all"); handleClinicFilterChange(); }} data-testid="stat-clinics-total">
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
                  }`} onClick={() => { setClinicPipelineFilter(clinicPipelineFilter === 'contract:active' ? 'all' : 'contract:active'); handleClinicFilterChange(); }} data-testid="stat-clinics-contracted">
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
                  }`} onClick={() => { setClinicPipelineFilter(clinicPipelineFilter === 'coop:interested' ? 'all' : 'coop:interested'); handleClinicFilterChange(); }} data-testid="stat-clinics-interested">
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
                  }`} onClick={() => { setClinicPipelineFilter(clinicPipelineFilter === 'initial:not_contacted' ? 'all' : 'initial:not_contacted'); handleClinicFilterChange(); }} data-testid="stat-clinics-not-contacted">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-500/15 dark:bg-slate-500/20">
                      <ShieldOff className="h-4.5 w-4.5 text-slate-500 dark:text-slate-400" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-lg font-bold text-slate-600 dark:text-slate-300 leading-tight">{serverClinicStats.pipeline?.['initial:not_contacted'] || 0}</span>
                      <span className="text-[11px] text-muted-foreground leading-tight">{(t.clinics as any).pipeline?.notContacted || "Not Contacted"}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-xl border shadow-sm bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900 dark:to-slate-800/50 border-slate-200 dark:border-slate-700" data-testid="stat-clinics-referrals">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-purple-500/15 dark:bg-purple-500/20">
                      <UserCheck className="h-4.5 w-4.5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-lg font-bold text-purple-700 dark:text-purple-300 leading-tight">{serverClinicStats.referralCount}</span>
                      <span className="text-[11px] text-muted-foreground leading-tight">Referrals</span>
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
              {hasActiveClinicFilters && (
                <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 rounded-lg border border-primary/20">
                  <ListFilter className="h-3.5 w-3.5 text-primary" />
                  <span className="text-sm font-medium text-primary">{serverClinicsTotal} {(t.common as any).found || "found"}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportToCsv(filteredAndSortedClinics, 'clinics', clinicExportColumns)}
                    data-testid="button-export-clinics-csv"
                  >
                    <Download className="h-4 w-4 mr-1.5" />
                    Export CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportToExcel(filteredAndSortedClinics, 'clinics', clinicExportColumns)}
                    data-testid="button-export-clinics-excel"
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-1.5" />
                    Export Excel
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchClinics()}
                    data-testid="button-refresh-clinics"
                  >
                    <RefreshCw className="h-4 w-4 mr-1.5" />
                    {t.common.refresh}
                  </Button>
                  {canAdd("hospitals") && (
                    <Button onClick={handleAddNewClinic} className="bg-red-700 hover:bg-red-800 text-white" data-testid="button-add-clinic">
                      <Plus className="h-4 w-4 mr-1.5" />
                      {t.clinics.addClinic}
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t.clinics.searchPlaceholder}
                    value={clinicSearchQuery}
                    onChange={(e) => { setClinicSearchQuery(e.target.value); handleClinicFilterChange(); }}
                    className="pl-10"
                    data-testid="input-search-clinics"
                  />
                </div>
                <Button
                  variant={showClinicFilters ? "default" : "outline"}
                  size="default"
                  onClick={() => setShowClinicFilters(!showClinicFilters)}
                  className={showClinicFilters ? "bg-red-700 hover:bg-red-800 text-white" : ""}
                  data-testid="button-toggle-clinic-filters"
                >
                  <Filter className="h-4 w-4 mr-1.5" />
                  {t.common.filter}
                </Button>
              </div>

              {showClinicFilters && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="text-xs font-medium mb-1.5 block text-muted-foreground">{t.common.country}</label>
                      <Select value={clinicCountryTab} onValueChange={(val) => { setClinicCountryTab(val); handleClinicFilterChange(); }}>
                        <SelectTrigger data-testid="select-filter-clinic-country" className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">{t.common.all}</SelectItem>
                          {COUNTRIES.map((country) => {
                            const count = clinicCountryCounts[country.code] || 0;
                            if (count === 0) return null;
                            return (
                              <SelectItem key={country.code} value={country.code}>
                                {country.flag} {country.code} ({count})
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1.5 block text-muted-foreground">{t.common.status}</label>
                      <Select value={clinicStatusFilter} onValueChange={(val) => { setClinicStatusFilter(val); handleClinicFilterChange(); }}>
                        <SelectTrigger data-testid="select-filter-clinic-status" className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t.common.all}</SelectItem>
                          <SelectItem value="active">{t.common.active}</SelectItem>
                          <SelectItem value="inactive">{t.common.inactive}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1.5 block text-muted-foreground">{(t.clinics as any).pipeline?.title || "Pipeline"}</label>
                      <Select value={clinicPipelineFilter} onValueChange={(val) => { setClinicPipelineFilter(val); handleClinicFilterChange(); }}>
                        <SelectTrigger data-testid="select-filter-clinic-pipeline" className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t.common.all}</SelectItem>
                          <SelectItem value="no_status">{(t.clinics as any).pipelineSummary?.noStatus || "No status"}</SelectItem>
                          <SelectItem value="initial:not_contacted">{(t.clinics as any).pipeline?.notContacted || "Not contacted"}</SelectItem>
                          <SelectItem value="initial:former">{(t.clinics as any).pipeline?.formerCollaborator || "Former collaborator"}</SelectItem>
                          <SelectItem value="initial:active_contract">{(t.clinics as any).pipeline?.activeContract || "Active contract"}</SelectItem>
                          <SelectItem value="coop:unknown">{(t.clinics as any).pipeline?.cooperationInterest || "Coop"}: {(t.clinics as any).pipeline?.unknown || "Unknown"}</SelectItem>
                          <SelectItem value="coop:interested">{(t.clinics as any).pipeline?.cooperationInterest || "Coop"}: {(t.clinics as any).pipeline?.interested || "Interested"}</SelectItem>
                          <SelectItem value="coop:not_interested">{(t.clinics as any).pipeline?.cooperationInterest || "Coop"}: {(t.clinics as any).pipeline?.notInterested || "Not interested"}</SelectItem>
                          <SelectItem value="contract_int:unknown">{(t.clinics as any).pipeline?.contractInterest || "Contract"}: {(t.clinics as any).pipeline?.unknown || "Unknown"}</SelectItem>
                          <SelectItem value="contract_int:interested">{(t.clinics as any).pipeline?.contractInterest || "Contract"}: {(t.clinics as any).pipeline?.interested || "Interested"}</SelectItem>
                          <SelectItem value="contract_int:not_interested">{(t.clinics as any).pipeline?.contractInterest || "Contract"}: {(t.clinics as any).pipeline?.notInterested || "Not interested"}</SelectItem>
                          <SelectItem value="contract:none">{(t.clinics as any).pipeline?.noContract || "No contract"}</SelectItem>
                          <SelectItem value="contract:active">{(t.clinics as any).pipeline?.activeContract || "Active contract"}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1.5 block text-muted-foreground">{t.clinics.website}</label>
                      <Select value={clinicHasWebsite} onValueChange={(val) => { setClinicHasWebsite(val); handleClinicFilterChange(); }}>
                        <SelectTrigger data-testid="select-filter-clinic-website" className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t.common.all}</SelectItem>
                          <SelectItem value="yes">{t.clinics.hasWebsite || "S webom"}</SelectItem>
                          <SelectItem value="no">{t.clinics.noWebsite || "Bez webu"}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => {}}
                    data-testid="button-advanced-clinic-filters"
                  >
                    <Filter className="h-3 w-3" />
                    <span>{t.clinics.filterByCity}</span>
                  </button>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="text-xs font-medium mb-1.5 block text-muted-foreground">{t.clinics.city}</label>
                      <Input
                        placeholder={t.clinics.filterByCity}
                        value={clinicCityFilter}
                        onChange={(e) => { setClinicCityFilter(e.target.value); handleClinicFilterChange(); }}
                        className="h-9"
                        data-testid="input-filter-clinic-city"
                      />
                    </div>
                  </div>

                  {hasActiveClinicFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearClinicFilters}
                      className="text-xs"
                      data-testid="button-clear-clinic-filters"
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      {t.common.clearFilters || "Clear filters"}
                    </Button>
                  )}
                </div>
              )}

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
                      onClick={() => { setClinicPipelineFilter(clinicPipelineFilter === s.val ? "all" : s.val); handleClinicFilterChange(); }}>
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
                      onClick={() => { setClinicPipelineFilter(clinicPipelineFilter === "no_status" ? "all" : "no_status"); handleClinicFilterChange(); }}>
                      {(t.clinics as any).pipelineSummary?.noStatus || "No status"} <span className="ml-1 font-black">{pipelineStats.noStatus}</span>
                    </Badge>
                  )}
                  <span className="text-muted-foreground/40 mx-0.5">|</span>
                  {pipelineStats.referralCount > 0 && (
                    <Badge variant="outline" className="text-[10px] px-2.5 py-1 font-bold border shadow-sm bg-purple-200/80 text-purple-900 border-purple-500 dark:bg-purple-800 dark:text-purple-100 dark:border-purple-500" data-testid="stat-referral">
                      <UserCheck className="h-3 w-3 mr-1" />
                      Referral <span className="ml-1 font-black">{pipelineStats.referralCount}</span>
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

        <TabsContent value="collaborators" className="mt-6">
          <CollaboratorsContent embedded={true} />
        </TabsContent>

        <TabsContent value="agreements" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t.hospitals.tabs.agreements}</CardTitle>
              <CardDescription>{t.hospitals.agreementsDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                {t.hospitals.comingSoon}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t.hospitals.tabs.templates}</CardTitle>
              <CardDescription>{t.hospitals.templatesDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                {t.hospitals.comingSoon}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rewards" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t.hospitals.tabs.rewards}</CardTitle>
              <CardDescription>{t.hospitals.rewardsDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                {t.hospitals.comingSoon}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className={useWizardForm ? "max-w-4xl max-h-[90vh] overflow-y-auto" : "max-w-2xl max-h-[90vh] overflow-y-auto"}>
          <DialogHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <DialogTitle>
                  {t.hospitals.addHospital}
                </DialogTitle>
                <DialogDescription>
                  {t.hospitals.addHospitalDesc}
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={useWizardForm ? "default" : "outline"}
                  size="sm"
                  onClick={() => setUseWizardForm(true)}
                  data-testid="button-wizard-mode"
                >
                  <ListChecks className="h-4 w-4 mr-1" />
                  Wizard
                </Button>
                <Button
                  variant={!useWizardForm ? "default" : "outline"}
                  size="sm"
                  onClick={() => setUseWizardForm(false)}
                  data-testid="button-simple-mode"
                >
                  <FileEdit className="h-4 w-4 mr-1" />
                  {t.common?.form || "Form"}
                </Button>
              </div>
            </div>
          </DialogHeader>
          {useWizardForm ? (
            <HospitalFormWizard
              onSuccess={() => setIsFormOpen(false)}
              onCancel={() => setIsFormOpen(false)}
            />
          ) : (
            <HospitalForm
              hospital={undefined}
              onClose={() => setIsFormOpen(false)}
              onSuccess={() => setIsFormOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {editingHospital && (
        <HospitalEditDrawer
          hospital={editingHospital}
          onClose={() => setEditingHospital(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/hospitals"] });
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
    </div>
  );
}
