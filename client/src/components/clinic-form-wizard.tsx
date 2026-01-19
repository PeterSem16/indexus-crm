import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
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
import { COUNTRIES } from "@shared/schema";
import type { Clinic } from "@shared/schema";
import { ChevronLeft, ChevronRight, Check, Stethoscope, MapPin, Globe, Settings, ExternalLink, Navigation, Loader2 } from "lucide-react";
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

interface ClinicFormWizardProps {
  initialData?: Clinic | null;
  onSuccess: () => void;
  onCancel?: () => void;
}

const WIZARD_STEPS = [
  { id: "basic", icon: Stethoscope },
  { id: "address", icon: MapPin },
  { id: "web", icon: Globe },
  { id: "settings", icon: Settings },
  { id: "review", icon: Check },
];

export function ClinicFormWizard({ initialData, onSuccess, onCancel }: ClinicFormWizardProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
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
        }
  );

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
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    return `https://${url}`;
  };

  const saveMutation = useMutation({
    mutationFn: (data: ClinicFormData) => {
      if (initialData) {
        return apiRequest("PUT", `/api/clinics/${initialData.id}`, data);
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

  const progress = ((currentStep + 1) / WIZARD_STEPS.length) * 100;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === WIZARD_STEPS.length - 1;

  const validateCurrentStep = (): boolean => {
    switch (currentStep) {
      case 0:
        return !!formData.name && !!formData.countryCode;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (!validateCurrentStep()) {
      toast({ title: t.errors.required, variant: "destructive" });
      return;
    }
    
    setCompletedSteps(prev => new Set(Array.from(prev).concat(currentStep)));
    
    if (isLastStep) {
      saveMutation.mutate(formData);
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleStepClick = (index: number) => {
    if (index < currentStep) {
      setCurrentStep(index);
    } else if (index === currentStep) {
      return;
    } else {
      for (let i = 0; i < index; i++) {
        if (!completedSteps.has(i)) {
          toast({ title: "Najskor dokoncite predchadzajuce kroky", variant: "destructive" });
          return;
        }
      }
      setCurrentStep(index);
    }
  };

  const getStepTitle = (stepId: string): string => {
    const stepTitles: Record<string, string> = {
      basic: t.clinics.steps?.basic || t.clinics.name || "Zakladne udaje",
      address: t.clinics.steps?.address || t.clinics.address || "Adresa",
      web: t.clinics.steps?.web || t.clinics.website || "Web a kontakt",
      settings: t.clinics.steps?.settings || t.settings?.title || "Nastavenia",
      review: t.clinics.steps?.review || "Suhrn",
    };
    return stepTitles[stepId] || stepId;
  };

  const getStepDescription = (stepId: string): string => {
    const stepDescs: Record<string, string> = {
      basic: t.clinics.stepsDesc?.basic || "Nazov a lekar",
      address: t.clinics.stepsDesc?.address || "Adresa a GPS suradnice",
      web: t.clinics.stepsDesc?.web || "Webova stranka a kontakty",
      settings: t.clinics.stepsDesc?.settings || "Aktivny stav a poznamky",
      review: t.clinics.stepsDesc?.review || "Skontrolujte udaje",
    };
    return stepDescs[stepId] || "";
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t.clinics.name} *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t.clinics.name}
                  data-testid="wizard-input-clinic-name"
                />
              </div>
              <div className="space-y-2">
                <Label>{t.clinics.doctorName}</Label>
                <Input
                  value={formData.doctorName}
                  onChange={(e) => setFormData({ ...formData, doctorName: e.target.value })}
                  placeholder={t.clinics.doctorName}
                  data-testid="wizard-input-clinic-doctor"
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
                  <SelectTrigger data-testid="wizard-select-clinic-country">
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
        );

      case 1:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t.clinics.address}</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder={t.clinics.address}
                data-testid="wizard-input-clinic-address"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t.clinics.city}</Label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder={t.clinics.city}
                  data-testid="wizard-input-clinic-city"
                />
              </div>
              <div className="space-y-2">
                <Label>{t.clinics.postalCode}</Label>
                <Input
                  value={formData.postalCode}
                  onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                  placeholder={t.clinics.postalCode}
                  data-testid="wizard-input-clinic-postal"
                />
              </div>
            </div>
            <Separator className="my-4" />
            <div className="space-y-2">
              <Label>{t.clinics.gpsCoordinates || "GPS suradnice"}</Label>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">{t.clinics.latitude || "Zemepisna sirka"}</Label>
                  <Input
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                    placeholder="48.1486"
                    data-testid="wizard-input-clinic-lat"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">{t.clinics.longitude || "Zemepisna dlzka"}</Label>
                  <Input
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                    placeholder="17.1077"
                    data-testid="wizard-input-clinic-lng"
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
                  data-testid="wizard-button-get-gps"
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
                    data-testid="wizard-button-show-map"
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    {t.clinics.showOnMap || "Zobrazit na mape"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t.clinics.website}</Label>
              <div className="flex gap-2">
                <Input
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="www.example.com"
                  className="flex-1"
                  data-testid="wizard-input-clinic-website"
                />
                {formData.website && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => window.open(getWebsiteUrl(formData.website), "_blank")}
                    data-testid="wizard-button-open-website"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {formData.website && (
                <div className="mt-4 border rounded-lg overflow-hidden">
                  <div className="bg-muted p-2 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t.clinics.websitePreview || "Nahled webovej stranky"}</span>
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
                    className="w-full h-64 border-0"
                    title="Website preview"
                    sandbox="allow-scripts allow-same-origin"
                  />
                </div>
              )}
            </div>
            <Separator className="my-4" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t.clinics.phone}</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder={t.clinics.phone}
                  data-testid="wizard-input-clinic-phone"
                />
              </div>
              <div className="space-y-2">
                <Label>{t.clinics.email}</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder={t.clinics.email}
                  data-testid="wizard-input-clinic-email"
                />
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label>{t.clinics.isActive || "Aktivna ambulancia"}</Label>
                <p className="text-sm text-muted-foreground">{t.clinics.isActiveDesc || "Ambulancia je aktivna a zobrazuje sa v zoznamoch"}</p>
              </div>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                data-testid="wizard-switch-clinic-active"
              />
            </div>
            <div className="space-y-2">
              <Label>{t.clinics.notes}</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={t.clinics.notes}
                rows={4}
                data-testid="wizard-input-clinic-notes"
              />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Stethoscope className="h-5 w-5 text-primary" />
                <h4 className="font-semibold">{t.clinics.steps?.basic || "Zakladne udaje"}</h4>
              </div>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t.clinics.name}:</span>
                  <span className="font-medium">{formData.name}</span>
                </div>
                {formData.doctorName && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.clinics.doctorName}:</span>
                    <span className="font-medium">{formData.doctorName}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t.common.country}:</span>
                  <span className="font-medium">{getCountryFlag(formData.countryCode)} {formData.countryCode}</span>
                </div>
              </div>
            </div>

            <div className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-5 w-5 text-primary" />
                <h4 className="font-semibold">{t.clinics.steps?.address || "Adresa"}</h4>
              </div>
              <div className="grid gap-2 text-sm">
                {formData.address && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.clinics.address}:</span>
                    <span className="font-medium">{formData.address}</span>
                  </div>
                )}
                {formData.city && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.clinics.city}:</span>
                    <span className="font-medium">{formData.city}</span>
                  </div>
                )}
                {formData.postalCode && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.clinics.postalCode}:</span>
                    <span className="font-medium">{formData.postalCode}</span>
                  </div>
                )}
                {formData.latitude && formData.longitude && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">GPS:</span>
                    <span className="font-medium">{formData.latitude}, {formData.longitude}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="h-5 w-5 text-primary" />
                <h4 className="font-semibold">{t.clinics.steps?.web || "Web a kontakt"}</h4>
              </div>
              <div className="grid gap-2 text-sm">
                {formData.website && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t.clinics.website}:</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="p-0 h-auto"
                      onClick={() => window.open(getWebsiteUrl(formData.website), "_blank")}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      {t.clinics.openWebsite || "Otvorit"}
                    </Button>
                  </div>
                )}
                {formData.phone && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.clinics.phone}:</span>
                    <span className="font-medium">{formData.phone}</span>
                  </div>
                )}
                {formData.email && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.clinics.email}:</span>
                    <span className="font-medium">{formData.email}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Settings className="h-5 w-5 text-primary" />
                <h4 className="font-semibold">{t.clinics.steps?.settings || "Nastavenia"}</h4>
              </div>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">{t.common.status}:</span>
                  <Badge variant={formData.isActive ? "default" : "secondary"}>
                    {formData.isActive ? t.common.active : t.common.inactive}
                  </Badge>
                </div>
                {formData.notes && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.clinics.notes}:</span>
                    <span className="font-medium text-right max-w-[200px] truncate">{formData.notes}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <Card className="border-0 shadow-none">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between mb-4">
            {WIZARD_STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === currentStep;
              const isCompleted = completedSteps.has(index);
              
              return (
                <div
                  key={step.id}
                  className="flex flex-col items-center flex-1 cursor-pointer"
                  onClick={() => handleStepClick(index)}
                >
                  <div
                    className={cn(
                      "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all",
                      isActive && "border-primary bg-primary text-primary-foreground",
                      isCompleted && !isActive && "border-primary bg-primary/10 text-primary",
                      !isActive && !isCompleted && "border-muted-foreground/30 text-muted-foreground"
                    )}
                  >
                    {isCompleted && !isActive ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <span className={cn(
                    "text-xs mt-1 text-center hidden sm:block",
                    isActive ? "text-primary font-medium" : "text-muted-foreground"
                  )}>
                    {getStepTitle(step.id)}
                  </span>
                </div>
              );
            })}
          </div>
          <Progress value={progress} className="h-1" />
        </CardHeader>
        
        <CardContent className="pt-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">{getStepTitle(WIZARD_STEPS[currentStep].id)}</h3>
            <p className="text-sm text-muted-foreground">{getStepDescription(WIZARD_STEPS[currentStep].id)}</p>
          </div>
          {renderStepContent()}
        </CardContent>
        
        <CardFooter className="flex justify-between pt-4 border-t">
          <div>
            {onCancel && (
              <Button type="button" variant="ghost" onClick={onCancel} data-testid="wizard-button-cancel">
                {t.common.cancel}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {!isFirstStep && (
              <Button type="button" variant="outline" onClick={handlePrevious} data-testid="wizard-button-previous">
                <ChevronLeft className="h-4 w-4 mr-1" />
                {t.common.previous || "Spat"}
              </Button>
            )}
            <Button 
              onClick={handleNext} 
              disabled={saveMutation.isPending}
              data-testid="wizard-button-next"
            >
              {isLastStep ? (
                saveMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t.common.saving || "Ukladam..."}
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    {t.common.save}
                  </>
                )
              ) : (
                <>
                  {t.common.next || "Dalej"}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </CardFooter>
      </Card>

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
