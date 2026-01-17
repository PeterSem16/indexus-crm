import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { COUNTRIES } from "@shared/schema";
import type { Hospital, Laboratory, SafeUser } from "@shared/schema";
import { ChevronLeft, ChevronRight, Check, Building2, MapPin, Users, Settings, ExternalLink } from "lucide-react";
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
import { useModuleFieldPermissions } from "@/components/ui/permission-field";

interface HospitalFormData {
  legacyId: string;
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

interface HospitalFormWizardProps {
  initialData?: Hospital | null;
  onSuccess: () => void;
  onCancel?: () => void;
}

const WIZARD_STEPS = [
  { id: "basic", icon: Building2 },
  { id: "address", icon: MapPin },
  { id: "contacts", icon: Users },
  { id: "settings", icon: Settings },
  { id: "review", icon: Check },
];

export function HospitalFormWizard({ initialData, onSuccess, onCancel }: HospitalFormWizardProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const { isHidden, isReadonly } = useModuleFieldPermissions("hospitals");
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  
  const [formData, setFormData] = useState<HospitalFormData>(() =>
    initialData
      ? {
          legacyId: initialData.legacyId || "",
          isActive: initialData.isActive,
          name: initialData.name,
          fullName: initialData.fullName || "",
          streetNumber: initialData.streetNumber || "",
          representativeId: initialData.representativeId || "",
          city: initialData.city || "",
          laboratoryId: initialData.laboratoryId || "",
          postalCode: initialData.postalCode || "",
          autoRecruiting: initialData.autoRecruiting,
          region: initialData.region || "",
          responsiblePersonId: initialData.responsiblePersonId || "",
          countryCode: initialData.countryCode,
          contactPerson: initialData.contactPerson || "",
          svetZdravia: initialData.svetZdravia,
          latitude: initialData.latitude || "",
          longitude: initialData.longitude || "",
        }
      : {
          legacyId: "",
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
        }
  );
  
  const [showMapDialog, setShowMapDialog] = useState(false);

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
      if (initialData) {
        return apiRequest("PUT", `/api/hospitals/${initialData.id}`, data);
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
          toast({ title: t.wizard?.completeStepsFirst || "Please complete previous steps first", variant: "destructive" });
          return;
        }
      }
      setCurrentStep(index);
    }
  };

  const getStepTitle = (stepId: string): string => {
    const steps = t.wizard?.steps as Record<string, string> | undefined;
    const stepTitles: Record<string, string> = {
      basic: steps?.basic || t.hospitals?.title || "Basic Info",
      address: steps?.address || t.customers?.fields?.street || "Address",
      contacts: steps?.contacts || t.hospitals?.contactPerson || "Contacts",
      settings: steps?.settings || t.settings?.title || "Settings",
      review: steps?.review || "Review",
    };
    return stepTitles[stepId] || stepId;
  };

  const getStepDescription = (stepId: string): string => {
    const steps = t.wizard?.steps as Record<string, string> | undefined;
    const stepDescs: Record<string, string> = {
      basic: steps?.basicDesc || "Hospital name and country",
      address: steps?.addressDesc || "Location details",
      contacts: steps?.contactsDesc || "Contact persons",
      settings: steps?.settingsDesc || "Hospital settings",
      review: steps?.reviewDesc || "Review and confirm",
    };
    return stepDescs[stepId] || "";
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {!isHidden("legacy_id") && (
                <div className="space-y-2">
                  <Label>{t.hospitals.legacyId}</Label>
                  <Input
                    value={formData.legacyId}
                    onChange={(e) => setFormData({ ...formData, legacyId: e.target.value })}
                    placeholder={t.hospitals.legacyId}
                    data-testid="wizard-input-hospital-legacy-id"
                    disabled={isReadonly("legacy_id")}
                    className={isReadonly("legacy_id") ? "bg-muted" : ""}
                  />
                </div>
              )}
              {!isHidden("name") && (
                <div className="space-y-2">
                  <Label>{t.hospitals.name} *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t.hospitals.name}
                    data-testid="wizard-input-hospital-name"
                    disabled={isReadonly("name")}
                    className={isReadonly("name") ? "bg-muted" : ""}
                  />
                </div>
              )}
              {!isHidden("full_name") && (
                <div className="space-y-2">
                  <Label>{t.hospitals.fullName}</Label>
                  <Input
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder={t.hospitals.fullName}
                    data-testid="wizard-input-hospital-fullname"
                    disabled={isReadonly("full_name")}
                    className={isReadonly("full_name") ? "bg-muted" : ""}
                  />
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {!isHidden("country_code") && (
                <div className="space-y-2">
                  <Label>{t.common.country} *</Label>
                  <Select
                    value={formData.countryCode}
                    onValueChange={(value) => setFormData({ ...formData, countryCode: value, laboratoryId: "" })}
                    disabled={isReadonly("country_code")}
                  >
                    <SelectTrigger data-testid="wizard-select-hospital-country" className={isReadonly("country_code") ? "bg-muted" : ""}>
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
              )}
              {!isHidden("laboratory") && (
                <div className="space-y-2">
                  <Label>{t.hospitals.laboratory}</Label>
                  <Select
                    value={formData.laboratoryId || "_none"}
                    onValueChange={(value) => setFormData({ ...formData, laboratoryId: value === "_none" ? "" : value })}
                    disabled={isReadonly("laboratory")}
                  >
                    <SelectTrigger data-testid="wizard-select-hospital-laboratory" className={isReadonly("laboratory") ? "bg-muted" : ""}>
                      <SelectValue placeholder={t.hospitals.laboratory} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">{t.common.noData}</SelectItem>
                      {filteredLaboratories.map((lab) => (
                        <SelectItem key={lab.id} value={lab.id}>{lab.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {!isHidden("street_number") && (
                <div className="space-y-2">
                  <Label>{t.hospitals.streetNumber}</Label>
                  <Input
                    value={formData.streetNumber}
                    onChange={(e) => setFormData({ ...formData, streetNumber: e.target.value })}
                    placeholder={t.hospitals.streetNumber}
                    data-testid="wizard-input-hospital-street"
                    disabled={isReadonly("street_number")}
                    className={isReadonly("street_number") ? "bg-muted" : ""}
                  />
                </div>
              )}
              {!isHidden("city") && (
                <div className="space-y-2">
                  <Label>{t.hospitals.city}</Label>
                  <Input
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder={t.hospitals.city}
                    data-testid="wizard-input-hospital-city"
                    disabled={isReadonly("city")}
                    className={isReadonly("city") ? "bg-muted" : ""}
                  />
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {!isHidden("postal_code") && (
                <div className="space-y-2">
                  <Label>{t.hospitals.postalCode}</Label>
                  <Input
                    value={formData.postalCode}
                    onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                    placeholder={t.hospitals.postalCode}
                    data-testid="wizard-input-hospital-postalcode"
                    disabled={isReadonly("postal_code")}
                    className={isReadonly("postal_code") ? "bg-muted" : ""}
                  />
                </div>
              )}
              {!isHidden("region") && (
                <div className="space-y-2">
                  <Label>{t.hospitals.region}</Label>
                  <Input
                    value={formData.region}
                    onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                    placeholder={t.hospitals.region}
                    data-testid="wizard-input-hospital-region"
                    disabled={isReadonly("region")}
                    className={isReadonly("region") ? "bg-muted" : ""}
                  />
                </div>
              )}
            </div>

            <Separator className="my-4" />
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">GPS súradnice</Label>
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
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Zemepisná šírka (Latitude)</Label>
                  <Input
                    type="number"
                    step="0.0000001"
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                    placeholder="napr. 48.7164"
                    data-testid="wizard-input-hospital-latitude"
                    disabled={isReadonly("latitude")}
                    className={isReadonly("latitude") ? "bg-muted" : ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Zemepisná dĺžka (Longitude)</Label>
                  <Input
                    type="number"
                    step="0.0000001"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                    placeholder="napr. 21.2611"
                    data-testid="wizard-input-hospital-longitude"
                    disabled={isReadonly("longitude")}
                    className={isReadonly("longitude") ? "bg-muted" : ""}
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            {!isHidden("contact_person") && (
              <div className="space-y-2">
                <Label>{t.hospitals.contactPerson}</Label>
                <Input
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  placeholder={t.hospitals.contactPerson}
                  data-testid="wizard-input-hospital-contact"
                  disabled={isReadonly("contact_person")}
                  className={isReadonly("contact_person") ? "bg-muted" : ""}
                />
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {!isHidden("representative") && (
                <div className="space-y-2">
                  <Label>{t.hospitals.representative}</Label>
                  <Select
                    value={formData.representativeId || "_none"}
                    onValueChange={(value) => setFormData({ ...formData, representativeId: value === "_none" ? "" : value })}
                    disabled={isReadonly("representative")}
                  >
                    <SelectTrigger data-testid="wizard-select-hospital-representative" className={isReadonly("representative") ? "bg-muted" : ""}>
                      <SelectValue placeholder={t.hospitals.representative} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">{t.common.noData}</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>{user.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {!isHidden("responsible_person") && (
                <div className="space-y-2">
                  <Label>{t.hospitals.responsiblePerson}</Label>
                  <Select
                    value={formData.responsiblePersonId || "_none"}
                    onValueChange={(value) => setFormData({ ...formData, responsiblePersonId: value === "_none" ? "" : value })}
                    disabled={isReadonly("responsible_person")}
                  >
                    <SelectTrigger data-testid="wizard-select-hospital-responsible" className={isReadonly("responsible_person") ? "bg-muted" : ""}>
                      <SelectValue placeholder={t.hospitals.responsiblePerson} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">{t.common.noData}</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>{user.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            {!isHidden("is_active") && (
              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  data-testid="wizard-switch-hospital-active"
                  disabled={isReadonly("is_active")}
                />
                <Label htmlFor="isActive">{t.common.active}</Label>
              </div>
            )}
            {!isHidden("auto_recruiting") && (
              <div className="flex items-center space-x-2">
                <Switch
                  id="autoRecruiting"
                  checked={formData.autoRecruiting}
                  onCheckedChange={(checked) => setFormData({ ...formData, autoRecruiting: checked })}
                  data-testid="wizard-switch-hospital-autorecruiting"
                  disabled={isReadonly("auto_recruiting")}
                />
                <Label htmlFor="autoRecruiting">{t.hospitals.autoRecruiting}</Label>
              </div>
            )}
            {!isHidden("svet_zdravia") && (
              <div className="flex items-center space-x-2">
                <Switch
                  id="svetZdravia"
                  checked={formData.svetZdravia}
                  onCheckedChange={(checked) => setFormData({ ...formData, svetZdravia: checked })}
                  data-testid="wizard-switch-hospital-svetzdravia"
                  disabled={isReadonly("svet_zdravia")}
                />
                <Label htmlFor="svetZdravia">{t.hospitals.svetZdravia}</Label>
              </div>
            )}
          </div>
        );

      case 4:
        const countryName = COUNTRIES.find(c => c.code === formData.countryCode)?.name || formData.countryCode;
        const labName = laboratories.find(l => l.id === formData.laboratoryId)?.name || "-";
        const repName = users.find(u => u.id === formData.representativeId)?.fullName || "-";
        const respName = users.find(u => u.id === formData.responsiblePersonId)?.fullName || "-";
        
        return (
          <div className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-4">
                <h4 className="font-medium">{getStepTitle("basic")}</h4>
                <div className="space-y-2 text-sm">
                  {formData.legacyId && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t.hospitals.legacyId}:</span>
                      <span className="font-medium">{formData.legacyId}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.hospitals.name}:</span>
                    <span className="font-medium">{formData.name}</span>
                  </div>
                  {formData.fullName && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t.hospitals.fullName}:</span>
                      <span className="font-medium">{formData.fullName}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.common.country}:</span>
                    <span className="font-medium">{countryName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.hospitals.laboratory}:</span>
                    <span className="font-medium">{labName}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">{getStepTitle("address")}</h4>
                <div className="space-y-2 text-sm">
                  {formData.streetNumber && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t.hospitals.streetNumber}:</span>
                      <span className="font-medium">{formData.streetNumber}</span>
                    </div>
                  )}
                  {formData.city && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t.hospitals.city}:</span>
                      <span className="font-medium">{formData.city}</span>
                    </div>
                  )}
                  {formData.postalCode && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t.hospitals.postalCode}:</span>
                      <span className="font-medium">{formData.postalCode}</span>
                    </div>
                  )}
                  {formData.region && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t.hospitals.region}:</span>
                      <span className="font-medium">{formData.region}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-4">
                <h4 className="font-medium">{getStepTitle("contacts")}</h4>
                <div className="space-y-2 text-sm">
                  {formData.contactPerson && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t.hospitals.contactPerson}:</span>
                      <span className="font-medium">{formData.contactPerson}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.hospitals.representative}:</span>
                    <span className="font-medium">{repName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.hospitals.responsiblePerson}:</span>
                    <span className="font-medium">{respName}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">{getStepTitle("settings")}</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.common.active}:</span>
                    <Badge variant={formData.isActive ? "default" : "secondary"}>
                      {formData.isActive ? t.common.yes : t.common.no}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.hospitals.autoRecruiting}:</span>
                    <Badge variant={formData.autoRecruiting ? "default" : "secondary"}>
                      {formData.autoRecruiting ? t.common.yes : t.common.no}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.hospitals.svetZdravia}:</span>
                    <Badge variant={formData.svetZdravia ? "default" : "secondary"}>
                      {formData.svetZdravia ? t.common.yes : t.common.no}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const currentStepInfo = WIZARD_STEPS[currentStep];
  const StepIcon = currentStepInfo?.icon || Building2;

  return (
    <>
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {t.wizard?.stepOf?.replace("{current}", String(currentStep + 1)).replace("{total}", String(WIZARD_STEPS.length)) || `Step ${currentStep + 1} of ${WIZARD_STEPS.length}`}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="flex flex-wrap gap-2 pt-4">
          {WIZARD_STEPS.map((step, index) => {
            const isCompleted = completedSteps.has(index);
            const isCurrent = index === currentStep;
            const isClickable = index < currentStep || isCompleted || completedSteps.has(index - 1);
            const Icon = step.icon;
            
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => handleStepClick(index)}
                disabled={!isClickable}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                  isCurrent && "bg-primary text-primary-foreground",
                  isCompleted && !isCurrent && "bg-primary/10 text-primary",
                  !isCurrent && !isCompleted && "bg-muted text-muted-foreground",
                  isClickable && !isCurrent && "hover-elevate cursor-pointer",
                  !isClickable && "cursor-not-allowed opacity-50"
                )}
                data-testid={`wizard-step-${step.id}`}
              >
                <span className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs",
                  isCurrent && "bg-primary-foreground text-primary",
                  isCompleted && !isCurrent && "bg-primary text-primary-foreground",
                  !isCurrent && !isCompleted && "bg-muted-foreground/20"
                )}>
                  {isCompleted ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                </span>
                <span className="hidden md:inline">{getStepTitle(step.id)}</span>
              </button>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="border-b pb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <StepIcon className="h-5 w-5" />
            {getStepTitle(currentStepInfo.id)}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {getStepDescription(currentStepInfo.id)}
          </p>
        </div>
        
        <div className="min-h-[250px]">
          {renderStepContent()}
        </div>
      </CardContent>

      <CardFooter className="flex justify-between gap-2 border-t pt-4">
        <div>
          {onCancel && (
            <Button variant="ghost" onClick={onCancel} data-testid="wizard-button-cancel">
              {t.common.cancel}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {!isFirstStep && (
            <Button variant="outline" onClick={handlePrevious} data-testid="wizard-button-previous">
              <ChevronLeft className="h-4 w-4 mr-1" />
              {t.wizard?.previous || "Previous"}
            </Button>
          )}
          <Button onClick={handleNext} disabled={saveMutation.isPending} data-testid="wizard-button-next">
            {isLastStep ? (
              saveMutation.isPending ? t.common.loading : (t.wizard?.complete || t.common.save)
            ) : (
              <>
                {t.wizard?.next || "Next"}
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
