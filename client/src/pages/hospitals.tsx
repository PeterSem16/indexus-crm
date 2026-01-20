import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Search, Building2, FileText, Award, Gift, ListChecks, FileEdit, MapPin, Navigation, ExternalLink, Database, Loader2, Globe, Stethoscope, RefreshCw, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Filter, X, Download, FileSpreadsheet } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { HospitalFormWizard } from "@/components/hospital-form-wizard";
import { ClinicFormWizard } from "@/components/clinic-form-wizard";
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
import type { Hospital, Laboratory, SafeUser, Clinic } from "@shared/schema";
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

function HospitalForm({
  hospital,
  onClose,
  onSuccess,
}: {
  hospital?: Hospital;
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
        <TabsList className="grid w-full grid-cols-4">
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
  const [clinicCountryTab, setClinicCountryTab] = useState<string>("ALL");
  const [countryTab, setCountryTab] = useState<string>("ALL");
  
  // Clinic pagination
  const [clinicPage, setClinicPage] = useState(1);
  const clinicPageSize = 30;
  
  // Clinic filters
  const [clinicCityFilter, setClinicCityFilter] = useState("");
  const [clinicStatusFilter, setClinicStatusFilter] = useState<string>("all");
  const [clinicHasWebsite, setClinicHasWebsite] = useState<string>("all");
  const [showClinicFilters, setShowClinicFilters] = useState(false);
  
  // Clinic sorting
  const [clinicSortField, setClinicSortField] = useState<string>("name");
  const [clinicSortDirection, setClinicSortDirection] = useState<"asc" | "desc">("asc");

  // Hospital pagination
  const [hospitalPage, setHospitalPage] = useState(1);
  const hospitalPageSize = 30;
  
  // Hospital filters
  const [hospitalCityFilter, setHospitalCityFilter] = useState("");
  const [hospitalStatusFilter, setHospitalStatusFilter] = useState<string>("all");
  const [showHospitalFilters, setShowHospitalFilters] = useState(false);
  
  // Hospital sorting
  const [hospitalSortField, setHospitalSortField] = useState<string>("name");
  const [hospitalSortDirection, setHospitalSortDirection] = useState<"asc" | "desc">("asc");

  const isAdmin = user?.role === "admin";

  const { data: hospitals = [], isLoading } = useQuery<Hospital[]>({
    queryKey: ["/api/hospitals", selectedCountries.join(",")],
    queryFn: async () => {
      const params = selectedCountries.length > 0 ? `?countries=${selectedCountries.join(",")}` : "";
      const res = await fetch(`/api/hospitals${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch hospitals");
      return res.json();
    },
  });

  const { data: users = [] } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
  });

  const { data: laboratories = [] } = useQuery<Laboratory[]>({
    queryKey: ["/api/config/laboratories"],
  });

  const { data: clinics = [], isLoading: isLoadingClinics, refetch: refetchClinics } = useQuery<Clinic[]>({
    queryKey: ["/api/clinics", selectedCountries.join(",")],
    queryFn: async () => {
      const params = selectedCountries.length > 0 ? `?countries=${selectedCountries.join(",")}` : "";
      const res = await fetch(`/api/clinics${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch clinics");
      return res.json();
    },
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

  const countryCounts = hospitals.reduce((acc, h) => {
    acc[h.countryCode] = (acc[h.countryCode] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const clinicCountryCounts = clinics.reduce((acc, c) => {
    acc[c.countryCode] = (acc[c.countryCode] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const filteredAndSortedClinics = (() => {
    // First filter
    let result = clinics.filter((clinic) => {
      const matchesCountry = clinicCountryTab === "ALL" || clinic.countryCode === clinicCountryTab;
      const matchesSearch = 
        clinic.name.toLowerCase().includes(clinicSearchQuery.toLowerCase()) ||
        clinic.doctorName?.toLowerCase().includes(clinicSearchQuery.toLowerCase()) ||
        clinic.city?.toLowerCase().includes(clinicSearchQuery.toLowerCase()) ||
        clinic.address?.toLowerCase().includes(clinicSearchQuery.toLowerCase());
      const matchesCity = !clinicCityFilter || clinic.city?.toLowerCase().includes(clinicCityFilter.toLowerCase());
      const matchesStatus = clinicStatusFilter === "all" || 
        (clinicStatusFilter === "active" && clinic.isActive) ||
        (clinicStatusFilter === "inactive" && !clinic.isActive);
      const matchesWebsite = clinicHasWebsite === "all" ||
        (clinicHasWebsite === "yes" && clinic.website) ||
        (clinicHasWebsite === "no" && !clinic.website);
      return matchesCountry && matchesSearch && matchesCity && matchesStatus && matchesWebsite;
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
          aVal = (a.doctorName || "").toLowerCase();
          bVal = (b.doctorName || "").toLowerCase();
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
  
  const totalClinicPages = Math.ceil(filteredAndSortedClinics.length / clinicPageSize);
  const paginatedClinics = filteredAndSortedClinics.slice(
    (clinicPage - 1) * clinicPageSize,
    clinicPage * clinicPageSize
  );
  
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
    setClinicCountryTab("ALL");
    setClinicPage(1);
  };
  
  const hasActiveClinicFilters = clinicSearchQuery || clinicCityFilter || clinicStatusFilter !== "all" || clinicHasWebsite !== "all" || clinicCountryTab !== "ALL";

  // Filtered and sorted hospitals
  const filteredAndSortedHospitals = (() => {
    // First filter
    let result = hospitals.filter((hospital) => {
      const matchesCountry = countryTab === "ALL" || hospital.countryCode === countryTab;
      const matchesSearch = 
        hospital.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        hospital.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        hospital.region?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        hospital.streetNumber?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCity = !hospitalCityFilter || hospital.city?.toLowerCase().includes(hospitalCityFilter.toLowerCase());
      const matchesStatus = hospitalStatusFilter === "all" || 
        (hospitalStatusFilter === "active" && hospital.isActive) ||
        (hospitalStatusFilter === "inactive" && !hospital.isActive);
      return matchesCountry && matchesSearch && matchesCity && matchesStatus;
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
  
  const totalHospitalPages = Math.ceil(filteredAndSortedHospitals.length / hospitalPageSize);
  const paginatedHospitals = filteredAndSortedHospitals.slice(
    (hospitalPage - 1) * hospitalPageSize,
    hospitalPage * hospitalPageSize
  );
  
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

  const handleEdit = (hospital: Hospital) => {
    setSelectedHospital(hospital);
    setIsFormOpen(true);
  };

  const handleDelete = (hospital: Hospital) => {
    setHospitalToDelete(hospital);
    setIsDeleteOpen(true);
  };

  const handleAddNew = () => {
    setSelectedHospital(undefined);
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
      cell: (clinic: Clinic) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{clinic.name}</span>
          {!clinic.isActive && (
            <Badge variant="secondary">{t.common.inactive}</Badge>
          )}
        </div>
      ),
    },
    {
      key: "doctorName",
      header: <SortableHeader field="doctorName" label={t.clinics.doctorName} />,
      cell: (clinic: Clinic) => clinic.doctorName || "-",
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
      key: "phone",
      header: t.clinics.phone,
      cell: (clinic: Clinic) => clinic.phone || "-",
    },
    {
      key: "actions",
      header: t.common.actions,
      cell: (clinic: Clinic) => (
        <div className="flex items-center gap-2">
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
      cell: (hospital: Hospital) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{hospital.name}</span>
          {!hospital.isActive && (
            <Badge variant="secondary">{t.common.inactive}</Badge>
          )}
        </div>
      ),
    },
    {
      key: "country",
      header: <HospitalSortableHeader field="country" label={t.common.country} />,
      cell: (hospital: Hospital) => (
        <span>
          {getCountryFlag(hospital.countryCode)} {getCountryName(hospital.countryCode)}
        </span>
      ),
    },
    {
      key: "city",
      header: <HospitalSortableHeader field="city" label={t.hospitals.city} />,
      cell: (hospital: Hospital) => hospital.city || "-",
    },
    {
      key: "laboratory",
      header: t.hospitals.laboratory,
      cell: (hospital: Hospital) => getLabName(hospital.laboratoryId),
    },
    {
      key: "representative",
      header: t.hospitals.representative,
      cell: (hospital: Hospital) => getUserName(hospital.representativeId),
    },
    {
      key: "actions",
      header: t.common.actions,
      cell: (hospital: Hospital) => (
        <div className="flex items-center gap-2">
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
            <CardHeader className="pb-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    {t.hospitals.title}
                  </CardTitle>
                  <CardDescription>{t.hospitals.description}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={showHospitalFilters ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowHospitalFilters(!showHospitalFilters)}
                    data-testid="button-toggle-hospital-filters"
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    {t.common.filter}
                    {hasActiveHospitalFilters && (
                      <Badge variant="secondary" className="ml-2">!</Badge>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportToCsv(filteredAndSortedHospitals, 'hospitals', hospitalExportColumns)}
                    data-testid="button-export-hospitals-csv"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportToExcel(filteredAndSortedHospitals, 'hospitals', hospitalExportColumns)}
                    data-testid="button-export-hospitals-excel"
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Excel
                  </Button>
                  {canAdd("hospitals") && (
                    <Button onClick={handleAddNew} data-testid="button-add-hospital">
                      <Plus className="h-4 w-4 mr-2" />
                      {t.hospitals.addHospital}
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Country tabs */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={countryTab === "ALL" ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setCountryTab("ALL"); handleHospitalFilterChange(); }}
                  data-testid="tab-country-all"
                >
                  {t.common.all}
                  <Badge variant="secondary" className="ml-2">{hospitals.length}</Badge>
                </Button>
                {COUNTRIES.map((country) => {
                  const count = countryCounts[country.code] || 0;
                  if (count === 0) return null;
                  return (
                    <Button
                      key={country.code}
                      variant={countryTab === country.code ? "default" : "outline"}
                      size="sm"
                      onClick={() => { setCountryTab(country.code); handleHospitalFilterChange(); }}
                      data-testid={`tab-country-${country.code}`}
                    >
                      {country.flag} {country.code}
                      <Badge variant="secondary" className="ml-2">{count}</Badge>
                    </Button>
                  );
                })}
              </div>
              
              {/* Search and filters */}
              <div className="flex items-center gap-4">
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
                {hasActiveHospitalFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearHospitalFilters}
                    data-testid="button-clear-hospital-filters"
                  >
                    <X className="h-4 w-4 mr-1" />
                    {t.common.clearFilters}
                  </Button>
                )}
                <div className="text-sm text-muted-foreground whitespace-nowrap">
                  {filteredAndSortedHospitals.length} z {hospitals.length} {t.common.records}
                </div>
              </div>
              
              {/* Advanced filters */}
              {showHospitalFilters && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t.hospitals.city}</label>
                    <Input
                      placeholder={t.clinics.filterByCity}
                      value={hospitalCityFilter}
                      onChange={(e) => { setHospitalCityFilter(e.target.value); handleHospitalFilterChange(); }}
                      data-testid="input-filter-hospital-city"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t.common.status}</label>
                    <select
                      value={hospitalStatusFilter}
                      onChange={(e) => { setHospitalStatusFilter(e.target.value); handleHospitalFilterChange(); }}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                      data-testid="select-filter-hospital-status"
                    >
                      <option value="all">{t.common.all}</option>
                      <option value="active">{t.common.active}</option>
                      <option value="inactive">{t.common.inactive}</option>
                    </select>
                  </div>
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
                        {t.common.showing} {((hospitalPage - 1) * hospitalPageSize) + 1} - {Math.min(hospitalPage * hospitalPageSize, filteredAndSortedHospitals.length)} {t.common.of} {filteredAndSortedHospitals.length}
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
            <CardHeader className="pb-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Stethoscope className="h-5 w-5" />
                    {t.clinics.title}
                  </CardTitle>
                  <CardDescription>{t.clinics.description}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={showClinicFilters ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowClinicFilters(!showClinicFilters)}
                    data-testid="button-toggle-clinic-filters"
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    {t.common.filter}
                    {hasActiveClinicFilters && (
                      <Badge variant="secondary" className="ml-2">!</Badge>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportToCsv(filteredAndSortedClinics, 'clinics', clinicExportColumns)}
                    data-testid="button-export-clinics-csv"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportToExcel(filteredAndSortedClinics, 'clinics', clinicExportColumns)}
                    data-testid="button-export-clinics-excel"
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Excel
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchClinics()}
                    data-testid="button-refresh-clinics"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {t.common.refresh}
                  </Button>
                  {canAdd("hospitals") && (
                    <Button onClick={handleAddNewClinic} data-testid="button-add-clinic">
                      <Plus className="h-4 w-4 mr-2" />
                      {t.clinics.addClinic}
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Country tabs */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={clinicCountryTab === "ALL" ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setClinicCountryTab("ALL"); handleClinicFilterChange(); }}
                  data-testid="tab-clinic-country-all"
                >
                  {t.common.all}
                  <Badge variant="secondary" className="ml-2">{clinics.length}</Badge>
                </Button>
                {COUNTRIES.map((country) => {
                  const count = clinicCountryCounts[country.code] || 0;
                  if (count === 0) return null;
                  return (
                    <Button
                      key={country.code}
                      variant={clinicCountryTab === country.code ? "default" : "outline"}
                      size="sm"
                      onClick={() => { setClinicCountryTab(country.code); handleClinicFilterChange(); }}
                      data-testid={`tab-clinic-country-${country.code}`}
                    >
                      {country.flag} {country.code}
                      <Badge variant="secondary" className="ml-2">{count}</Badge>
                    </Button>
                  );
                })}
              </div>
              
              {/* Search and filters panel */}
              <div className="flex items-center gap-4">
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
                {hasActiveClinicFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearClinicFilters}
                    data-testid="button-clear-clinic-filters"
                  >
                    <X className="h-4 w-4 mr-1" />
                    {t.common.clearFilters || "Zmazat filtre"}
                  </Button>
                )}
                <div className="text-sm text-muted-foreground whitespace-nowrap">
                  {filteredAndSortedClinics.length} z {clinics.length} {t.clinics.count}
                </div>
              </div>
              
              {/* Advanced filters */}
              {showClinicFilters && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t.clinics.city}</label>
                    <Input
                      placeholder={t.clinics.filterByCity}
                      value={clinicCityFilter}
                      onChange={(e) => { setClinicCityFilter(e.target.value); handleClinicFilterChange(); }}
                      data-testid="input-filter-clinic-city"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t.common.status}</label>
                    <select
                      value={clinicStatusFilter}
                      onChange={(e) => { setClinicStatusFilter(e.target.value); handleClinicFilterChange(); }}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                      data-testid="select-filter-clinic-status"
                    >
                      <option value="all">{t.common.all}</option>
                      <option value="active">{t.common.active}</option>
                      <option value="inactive">{t.common.inactive}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t.clinics.website}</label>
                    <select
                      value={clinicHasWebsite}
                      onChange={(e) => { setClinicHasWebsite(e.target.value); handleClinicFilterChange(); }}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                      data-testid="select-filter-clinic-website"
                    >
                      <option value="all">{t.common.all}</option>
                      <option value="yes">{t.clinics.hasWebsite || "S webom"}</option>
                      <option value="no">{t.clinics.noWebsite || "Bez webu"}</option>
                    </select>
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
                        {t.common.showing || "Zobrazujem"} {((clinicPage - 1) * clinicPageSize) + 1} - {Math.min(clinicPage * clinicPageSize, filteredAndSortedClinics.length)} {t.common.of || "z"} {filteredAndSortedClinics.length}
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
        <DialogContent className={!selectedHospital && useWizardForm ? "max-w-4xl max-h-[90vh] overflow-y-auto" : "max-w-2xl max-h-[90vh] overflow-y-auto"}>
          <DialogHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <DialogTitle>
                  {selectedHospital ? t.hospitals.editHospital : t.hospitals.addHospital}
                </DialogTitle>
                <DialogDescription>
                  {selectedHospital ? t.hospitals.editHospitalDesc : t.hospitals.addHospitalDesc}
                </DialogDescription>
              </div>
              {!selectedHospital && (
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
              )}
            </div>
          </DialogHeader>
          {!selectedHospital && useWizardForm ? (
            <HospitalFormWizard
              onSuccess={() => setIsFormOpen(false)}
              onCancel={() => setIsFormOpen(false)}
            />
          ) : (
            <HospitalForm
              hospital={selectedHospital}
              onClose={() => setIsFormOpen(false)}
              onSuccess={() => setIsFormOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

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

      <Dialog open={isClinicFormOpen} onOpenChange={setIsClinicFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5" />
              {selectedClinic ? t.clinics.editClinic : t.clinics.addClinic}
            </DialogTitle>
            <DialogDescription>
              {selectedClinic ? t.clinics.editClinic : t.clinics.addClinic}
            </DialogDescription>
          </DialogHeader>
          <ClinicFormWizard
            initialData={selectedClinic}
            onSuccess={() => setIsClinicFormOpen(false)}
            onCancel={() => setIsClinicFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

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
    </div>
  );
}
