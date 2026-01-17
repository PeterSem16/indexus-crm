import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Search, Building2, FileText, Award, Gift, ListChecks, FileEdit, MapPin, Navigation, ExternalLink, Database, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { HospitalFormWizard } from "@/components/hospital-form-wizard";
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
import type { Hospital, Laboratory, SafeUser } from "@shared/schema";
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
      toast({ title: "Geolokácia nie je podporovaná vo vašom prehliadači", variant: "destructive" });
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
        toast({ title: "GPS súradnice boli načítané" });
      },
      (error) => {
        setIsLoadingLocation(false);
        let message = "Nepodarilo sa získať polohu";
        if (error.code === error.PERMISSION_DENIED) {
          message = "Prístup k polohe bol zamietnutý";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          message = "Poloha nie je dostupná";
        } else if (error.code === error.TIMEOUT) {
          message = "Časový limit vypršal";
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
            Základné
          </TabsTrigger>
          <TabsTrigger value="address" data-testid="tab-form-address">
            <MapPin className="h-4 w-4 mr-2" />
            Adresa
          </TabsTrigger>
          <TabsTrigger value="contacts" data-testid="tab-form-contacts">
            <FileText className="h-4 w-4 mr-2" />
            Kontakty
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-form-settings">
            <ListChecks className="h-4 w-4 mr-2" />
            Nastavenia
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
              <Label className="text-base font-medium">GPS súradnice</Label>
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
                  {isLoadingLocation ? "Načítavam..." : "Načítať polohu"}
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
                    Zobraziť na mape
                  </Button>
                )}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="latitude">Zemepisná šírka (Latitude)</Label>
                <Input
                  id="latitude"
                  type="number"
                  step="0.0000001"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                  placeholder="napr. 48.7164"
                  data-testid="input-hospital-latitude"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="longitude">Zemepisná dĺžka (Longitude)</Label>
                <Input
                  id="longitude"
                  type="number"
                  step="0.0000001"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                  placeholder="napr. 21.2611"
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
            Otvoriť v Google Maps
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
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState<Hospital | undefined>();
  const [hospitalToDelete, setHospitalToDelete] = useState<Hospital | null>(null);
  const [activeTab, setActiveTab] = useState("hospital");
  const [useWizardForm, setUseWizardForm] = useState(true);

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
        title: "Nemocnice nasadené",
        description: `Vytvorené: ${data.inserted}, Preskočené: ${data.skipped} (celkom ${data.total})`,
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Chyba pri nasadzovaní", 
        description: error.message || "Nepodarilo sa nasadiť nemocnice",
        variant: "destructive" 
      });
    },
  });

  const filteredHospitals = hospitals.filter((hospital) =>
    hospital.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    hospital.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    hospital.region?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  const columns = [
    {
      key: "name",
      header: t.hospitals.name,
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
      header: t.common.country,
      cell: (hospital: Hospital) => (
        <span>
          {getCountryFlag(hospital.countryCode)} {getCountryName(hospital.countryCode)}
        </span>
      ),
    },
    {
      key: "city",
      header: t.hospitals.city,
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
              {seedAllMutation.isPending ? "Nasadzujem..." : "Nasadiť všetky krajiny"}
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
            <CardHeader className="pb-4">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t.hospitals.searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-hospitals"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredHospitals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t.hospitals.noHospitals}
                </div>
              ) : (
                <DataTable 
                  columns={columns} 
                  data={filteredHospitals} 
                  getRowKey={(hospital) => hospital.id}
                />
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
    </div>
  );
}
