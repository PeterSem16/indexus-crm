import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { PhoneNumberField } from "@/components/phone-number-field";
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
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { COUNTRIES } from "@shared/schema";
import type { Collaborator, Hospital, SafeUser, HealthInsurance } from "@shared/schema";
import { ChevronLeft, ChevronRight, Check, User, Phone, CreditCard, Building2, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";
import { getCountryFlag } from "@/lib/countries";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useModuleFieldPermissions } from "@/components/ui/permission-field";

const COLLABORATOR_TYPES = [
  { value: "doctor", labelKey: "doctor" },
  { value: "nurse", labelKey: "nurse" },
  { value: "midwife", labelKey: "midwife" },
  { value: "assistant", labelKey: "assistant" },
  { value: "other", labelKey: "other" },
] as const;

const MARITAL_STATUSES = [
  { value: "single", labelKey: "single" },
  { value: "married", labelKey: "married" },
  { value: "divorced", labelKey: "divorced" },
  { value: "widowed", labelKey: "widowed" },
] as const;

interface CollaboratorFormData {
  legacyId: string;
  countryCode: string;
  titleBefore: string;
  firstName: string;
  lastName: string;
  maidenName: string;
  titleAfter: string;
  birthNumber: string;
  birthDay: number;
  birthMonth: number;
  birthYear: number;
  birthPlace: string;
  healthInsuranceId: string;
  maritalStatus: string;
  collaboratorType: string;
  phone: string;
  mobile: string;
  mobile2: string;
  otherContact: string;
  email: string;
  bankAccountIban: string;
  swiftCode: string;
  clientContact: boolean;
  representativeId: string;
  isActive: boolean;
  svetZdravia: boolean;
  companyName: string;
  ico: string;
  dic: string;
  icDph: string;
  companyIban: string;
  companySwift: string;
  monthRewards: boolean;
  note: string;
  hospitalId: string;
}

interface CollaboratorFormWizardProps {
  initialData?: Collaborator | null;
  onSuccess: () => void;
  onCancel?: () => void;
}

const WIZARD_STEPS = [
  { id: "personal", icon: User },
  { id: "contact", icon: Phone },
  { id: "banking", icon: CreditCard },
  { id: "company", icon: Building2 },
  { id: "mobile", icon: Smartphone },
];

function DateFields({
  label,
  dayValue,
  monthValue,
  yearValue,
  onDayChange,
  onMonthChange,
  onYearChange,
  testIdPrefix,
  t,
}: {
  label: string;
  dayValue: number;
  monthValue: number;
  yearValue: number;
  onDayChange: (val: number) => void;
  onMonthChange: (val: number) => void;
  onYearChange: (val: number) => void;
  testIdPrefix: string;
  t: any;
}) {
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Select
          value={dayValue?.toString() || ""}
          onValueChange={(v) => onDayChange(parseInt(v))}
        >
          <SelectTrigger className="w-[80px]" data-testid={`wizard-select-${testIdPrefix}-day`}>
            <SelectValue placeholder={t.collaborators?.fields?.day || "Day"} />
          </SelectTrigger>
          <SelectContent>
            {days.map((d) => (
              <SelectItem key={d} value={d.toString()}>
                {d.toString().padStart(2, "0")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={monthValue?.toString() || ""}
          onValueChange={(v) => onMonthChange(parseInt(v))}
        >
          <SelectTrigger className="w-[100px]" data-testid={`wizard-select-${testIdPrefix}-month`}>
            <SelectValue placeholder={t.collaborators?.fields?.month || "Month"} />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m} value={m.toString()}>
                {m.toString().padStart(2, "0")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={yearValue?.toString() || ""}
          onValueChange={(v) => onYearChange(parseInt(v))}
        >
          <SelectTrigger className="w-[100px]" data-testid={`wizard-select-${testIdPrefix}-year`}>
            <SelectValue placeholder={t.collaborators?.fields?.year || "Year"} />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={y.toString()}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function CollaboratorFormWizard({ initialData, onSuccess, onCancel }: CollaboratorFormWizardProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const { isHidden, isReadonly } = useModuleFieldPermissions("collaborators");
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  
  const [mobileCredentials, setMobileCredentials] = useState({
    mobileAppEnabled: initialData?.mobileAppEnabled ?? false,
    mobileUsername: initialData?.mobileUsername ?? "",
    mobilePassword: "",
    mobilePasswordConfirm: "",
  });

  const [formData, setFormData] = useState<CollaboratorFormData>(() =>
    initialData
      ? {
          legacyId: initialData.legacyId || "",
          countryCode: initialData.countryCode,
          titleBefore: initialData.titleBefore || "",
          firstName: initialData.firstName,
          lastName: initialData.lastName,
          maidenName: initialData.maidenName || "",
          titleAfter: initialData.titleAfter || "",
          birthNumber: initialData.birthNumber || "",
          birthDay: initialData.birthDay || 0,
          birthMonth: initialData.birthMonth || 0,
          birthYear: initialData.birthYear || 0,
          birthPlace: initialData.birthPlace || "",
          healthInsuranceId: initialData.healthInsuranceId || "",
          maritalStatus: initialData.maritalStatus || "",
          collaboratorType: initialData.collaboratorType || "",
          phone: initialData.phone || "",
          mobile: initialData.mobile || "",
          mobile2: initialData.mobile2 || "",
          otherContact: initialData.otherContact || "",
          email: initialData.email || "",
          bankAccountIban: initialData.bankAccountIban || "",
          swiftCode: initialData.swiftCode || "",
          clientContact: initialData.clientContact,
          representativeId: initialData.representativeId || "",
          isActive: initialData.isActive,
          svetZdravia: initialData.svetZdravia,
          companyName: initialData.companyName || "",
          ico: initialData.ico || "",
          dic: initialData.dic || "",
          icDph: initialData.icDph || "",
          companyIban: initialData.companyIban || "",
          companySwift: initialData.companySwift || "",
          monthRewards: initialData.monthRewards,
          note: initialData.note || "",
          hospitalId: initialData.hospitalId || "",
        }
      : {
          legacyId: "",
          countryCode: "",
          titleBefore: "",
          firstName: "",
          lastName: "",
          maidenName: "",
          titleAfter: "",
          birthNumber: "",
          birthDay: 0,
          birthMonth: 0,
          birthYear: 0,
          birthPlace: "",
          healthInsuranceId: "",
          maritalStatus: "",
          collaboratorType: "",
          phone: "",
          mobile: "",
          mobile2: "",
          otherContact: "",
          email: "",
          bankAccountIban: "",
          swiftCode: "",
          clientContact: false,
          representativeId: "",
          isActive: true,
          svetZdravia: false,
          companyName: "",
          ico: "",
          dic: "",
          icDph: "",
          companyIban: "",
          companySwift: "",
          monthRewards: false,
          note: "",
          hospitalId: "",
        }
  );

  const { data: users = [] } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
  });

  const { data: healthInsurances = [] } = useQuery<HealthInsurance[]>({
    queryKey: ["/api/config/health-insurance"],
  });

  const { data: hospitals = [] } = useQuery<Hospital[]>({
    queryKey: ["/api/hospitals"],
  });

  const filteredHealthInsurances = formData.countryCode
    ? healthInsurances.filter((hi) => hi.countryCode === formData.countryCode)
    : healthInsurances;

  const filteredHospitals = formData.countryCode
    ? hospitals.filter((h) => h.countryCode === formData.countryCode)
    : hospitals;

  const saveMutation = useMutation({
    mutationFn: async (data: CollaboratorFormData) => {
      let collaboratorId: string;
      
      if (initialData) {
        await apiRequest("PUT", `/api/collaborators/${initialData.id}`, data);
        collaboratorId = initialData.id;
      } else {
        const response = await apiRequest("POST", "/api/collaborators", data);
        const newCollaborator = await response.json();
        collaboratorId = newCollaborator.id;
      }
      
      // Save mobile credentials if enabled or if previously enabled
      if (mobileCredentials.mobileAppEnabled || initialData?.mobileAppEnabled) {
        const mobileData: { mobileAppEnabled: boolean; mobileUsername?: string; mobilePassword?: string } = {
          mobileAppEnabled: mobileCredentials.mobileAppEnabled,
        };
        
        if (mobileCredentials.mobileAppEnabled) {
          mobileData.mobileUsername = mobileCredentials.mobileUsername;
          if (mobileCredentials.mobilePassword) {
            mobileData.mobilePassword = mobileCredentials.mobilePassword;
          }
        }
        
        await apiRequest("PUT", `/api/collaborators/${collaboratorId}/mobile-credentials`, mobileData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collaborators"] });
      toast({ title: t.success.saved });
      onSuccess();
    },
    onError: (error: any) => {
      console.error("[Wizard] Save error:", error);
      const errorMessage = error?.message || error?.toString() || t.errors.saveFailed;
      toast({ title: errorMessage, variant: "destructive" });
    },
  });

  const progress = ((currentStep + 1) / WIZARD_STEPS.length) * 100;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === WIZARD_STEPS.length - 1;

  const validateCurrentStep = (): boolean => {
    switch (currentStep) {
      case 0:
        return !!formData.firstName && !!formData.lastName && !!formData.countryCode;
      case 4:
        if (mobileCredentials.mobileAppEnabled) {
          if (!mobileCredentials.mobileUsername) {
            toast({ title: t.collaborators?.mobileApp?.usernameRequired || "Username is required for mobile app access", variant: "destructive" });
            return false;
          }
          if (!initialData?.mobilePasswordHash && !mobileCredentials.mobilePassword) {
            toast({ title: t.collaborators?.mobileApp?.passwordRequired || "Password is required for mobile app access", variant: "destructive" });
            return false;
          }
          if (mobileCredentials.mobilePassword && mobileCredentials.mobilePassword !== mobileCredentials.mobilePasswordConfirm) {
            toast({ title: t.collaborators?.mobileApp?.passwordMismatch || "Passwords do not match", variant: "destructive" });
            return false;
          }
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    console.log("[Wizard] handleNext called, currentStep:", currentStep, "isLastStep:", isLastStep, "WIZARD_STEPS.length:", WIZARD_STEPS.length);
    
    const isValid = validateCurrentStep();
    console.log("[Wizard] validateCurrentStep result:", isValid);
    
    if (!isValid) {
      return;
    }
    
    setCompletedSteps(prev => new Set(Array.from(prev).concat(currentStep)));
    
    if (isLastStep) {
      console.log("[Wizard] Calling saveMutation.mutate with formData:", formData);
      saveMutation.mutate(formData);
    } else {
      console.log("[Wizard] Moving to next step:", currentStep + 1);
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
          toast({ title: "Please complete previous steps first", variant: "destructive" });
          return;
        }
      }
      setCurrentStep(index);
    }
  };

  const getStepTitle = (stepId: string): string => {
    const steps = t.wizard?.steps as Record<string, string> | undefined;
    const stepTitles: Record<string, string> = {
      personal: steps?.personalInfo || t.collaborators?.tabs?.collaborator || "Personal Info",
      contact: steps?.contactDetails || t.collaborators?.fields?.phone || "Contact",
      banking: steps?.banking || t.collaborators?.fields?.bankAccountIban || "Banking",
      company: steps?.company || t.collaborators?.fields?.companyName || "Company",
      mobile: steps?.mobile || "INDEXUS Connect",
    };
    return stepTitles[stepId] || stepId;
  };

  const getStepDescription = (stepId: string): string => {
    const steps = t.wizard?.steps as Record<string, string> | undefined;
    const stepDescs: Record<string, string> = {
      personal: steps?.personalInfoDesc || "Name and basic details",
      contact: steps?.contactDetailsDesc || "Phone, email, address",
      banking: steps?.bankingDesc || "Bank account details",
      company: steps?.companyDesc || "Company information (optional)",
      mobile: steps?.mobileDesc || "Mobile app access settings",
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
                  <Label>{t.collaborators.legacyId}</Label>
                  <Input
                    value={formData.legacyId}
                    onChange={(e) => setFormData({ ...formData, legacyId: e.target.value })}
                    placeholder={t.collaborators.legacyId}
                    data-testid="wizard-input-collaborator-legacy-id"
                    disabled={isReadonly("legacy_id")}
                    className={isReadonly("legacy_id") ? "bg-muted" : ""}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>{t.collaborators.fields.country} *</Label>
                <Select
                  value={formData.countryCode}
                  onValueChange={(value) => setFormData({ ...formData, countryCode: value, healthInsuranceId: "", hospitalId: "" })}
                >
                  <SelectTrigger data-testid="wizard-select-collaborator-country">
                    <SelectValue placeholder={t.collaborators.fields.country} />
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t.collaborators.fields.collaboratorType}</Label>
                <Select
                  value={formData.collaboratorType || "_none"}
                  onValueChange={(value) => setFormData({ ...formData, collaboratorType: value === "_none" ? "" : value })}
                >
                  <SelectTrigger data-testid="wizard-select-collaborator-type">
                    <SelectValue placeholder={t.collaborators.fields.collaboratorType} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">{t.common.noData}</SelectItem>
                    {COLLABORATOR_TYPES.map((ct) => (
                      <SelectItem key={ct.value} value={ct.value}>
                        {(t.collaborators.types as Record<string, string>)[ct.labelKey] || ct.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
              {!isHidden("title_before") && (
                <div className="space-y-2">
                  <Label>{t.collaborators.fields.titleBefore}</Label>
                  <Input
                    value={formData.titleBefore}
                    onChange={(e) => setFormData({ ...formData, titleBefore: e.target.value })}
                    data-testid="wizard-input-collaborator-title-before"
                    disabled={isReadonly("title_before")}
                    className={isReadonly("title_before") ? "bg-muted" : ""}
                  />
                </div>
              )}
              {!isHidden("first_name") && (
                <div className="space-y-2">
                  <Label>{t.collaborators.fields.firstName} *</Label>
                  <Input
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    data-testid="wizard-input-collaborator-firstname"
                    disabled={isReadonly("first_name")}
                    className={isReadonly("first_name") ? "bg-muted" : ""}
                  />
                </div>
              )}
              {!isHidden("last_name") && (
                <div className="space-y-2">
                  <Label>{t.collaborators.fields.lastName} *</Label>
                  <Input
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    data-testid="wizard-input-collaborator-lastname"
                    disabled={isReadonly("last_name")}
                    className={isReadonly("last_name") ? "bg-muted" : ""}
                  />
                </div>
              )}
              {!isHidden("title_after") && (
                <div className="space-y-2">
                  <Label>{t.collaborators.fields.titleAfter}</Label>
                  <Input
                    value={formData.titleAfter}
                    onChange={(e) => setFormData({ ...formData, titleAfter: e.target.value })}
                    data-testid="wizard-input-collaborator-title-after"
                    disabled={isReadonly("title_after")}
                    className={isReadonly("title_after") ? "bg-muted" : ""}
                  />
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {!isHidden("date_of_birth") && (
                <DateFields
                  label={t.collaborators.fields.birthDate}
                  dayValue={formData.birthDay}
                  monthValue={formData.birthMonth}
                  yearValue={formData.birthYear}
                  onDayChange={(val) => setFormData({ ...formData, birthDay: val })}
                  onMonthChange={(val) => setFormData({ ...formData, birthMonth: val })}
                  onYearChange={(val) => setFormData({ ...formData, birthYear: val })}
                  testIdPrefix="birth"
                  t={t}
                />
              )}
              <div className="space-y-2">
                <Label>{t.collaborators.fields.birthPlace}</Label>
                <Input
                  value={formData.birthPlace}
                  onChange={(e) => setFormData({ ...formData, birthPlace: e.target.value })}
                  data-testid="wizard-input-collaborator-birth-place"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t.collaborators.fields.healthInsurance}</Label>
                <Select
                  value={formData.healthInsuranceId || "_none"}
                  onValueChange={(value) => setFormData({ ...formData, healthInsuranceId: value === "_none" ? "" : value })}
                >
                  <SelectTrigger data-testid="wizard-select-collaborator-insurance">
                    <SelectValue placeholder={t.collaborators.fields.healthInsurance} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">{t.common.noData}</SelectItem>
                    {filteredHealthInsurances.map((hi) => (
                      <SelectItem key={hi.id} value={hi.id}>{hi.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t.collaborators.fields.maritalStatus}</Label>
                <Select
                  value={formData.maritalStatus || "_none"}
                  onValueChange={(value) => setFormData({ ...formData, maritalStatus: value === "_none" ? "" : value })}
                >
                  <SelectTrigger data-testid="wizard-select-collaborator-marital">
                    <SelectValue placeholder={t.collaborators.fields.maritalStatus} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">{t.common.noData}</SelectItem>
                    {MARITAL_STATUSES.map((ms) => (
                      <SelectItem key={ms.value} value={ms.value}>
                        {(t.collaborators.maritalStatuses as Record<string, string>)[ms.labelKey] || ms.value}
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
            <div className="grid gap-4 sm:grid-cols-2">
              {!isHidden("phone") && (
                <div className="space-y-2">
                  <Label>{t.collaborators.fields.phone}</Label>
                  <PhoneNumberField
                    value={formData.phone}
                    onChange={(value) => setFormData({ ...formData, phone: value })}
                    defaultCountryCode={formData.countryCode || "SK"}
                    data-testid="wizard-input-collaborator-phone"
                    disabled={isReadonly("phone")}
                  />
                </div>
              )}
              {!isHidden("mobile") && (
                <div className="space-y-2">
                  <Label>{t.collaborators.fields.mobile}</Label>
                  <PhoneNumberField
                    value={formData.mobile}
                    onChange={(value) => setFormData({ ...formData, mobile: value })}
                    defaultCountryCode={formData.countryCode || "SK"}
                    data-testid="wizard-input-collaborator-mobile"
                    disabled={isReadonly("mobile")}
                  />
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t.collaborators.fields.mobile2}</Label>
                <PhoneNumberField
                  value={formData.mobile2}
                  onChange={(value) => setFormData({ ...formData, mobile2: value })}
                  defaultCountryCode={formData.countryCode || "SK"}
                  data-testid="wizard-input-collaborator-mobile2"
                />
              </div>
              {!isHidden("email") && (
                <div className="space-y-2">
                  <Label>{t.collaborators.fields.email}</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    data-testid="wizard-input-collaborator-email"
                    disabled={isReadonly("email")}
                    className={isReadonly("email") ? "bg-muted" : ""}
                  />
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t.collaborators.fields.representative}</Label>
                <Select
                  value={formData.representativeId || "_none"}
                  onValueChange={(value) => setFormData({ ...formData, representativeId: value === "_none" ? "" : value })}
                >
                  <SelectTrigger data-testid="wizard-select-collaborator-representative">
                    <SelectValue placeholder={t.collaborators.fields.representative} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">{t.common.noData}</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>{user.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t.collaborators.fields.hospital}</Label>
                <Select
                  value={formData.hospitalId || "_none"}
                  onValueChange={(value) => setFormData({ ...formData, hospitalId: value === "_none" ? "" : value })}
                >
                  <SelectTrigger data-testid="wizard-select-collaborator-hospital">
                    <SelectValue placeholder={t.collaborators.fields.hospital} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">{t.common.noData}</SelectItem>
                    {filteredHospitals.map((h) => (
                      <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {!isHidden("bank_account") && (
                <div className="space-y-2">
                  <Label>{t.collaborators.fields.bankAccountIban}</Label>
                  <Input
                    value={formData.bankAccountIban}
                    onChange={(e) => setFormData({ ...formData, bankAccountIban: e.target.value })}
                    placeholder="SK..."
                    data-testid="wizard-input-collaborator-iban"
                    disabled={isReadonly("bank_account")}
                    className={isReadonly("bank_account") ? "bg-muted" : ""}
                  />
                </div>
              )}
              {!isHidden("bank_account") && (
                <div className="space-y-2">
                  <Label>{t.collaborators.fields.swiftCode}</Label>
                  <Input
                    value={formData.swiftCode}
                    onChange={(e) => setFormData({ ...formData, swiftCode: e.target.value })}
                    data-testid="wizard-input-collaborator-swift"
                    disabled={isReadonly("bank_account")}
                    className={isReadonly("bank_account") ? "bg-muted" : ""}
                  />
                </div>
              )}
            </div>

            <Separator className="my-4" />

            <div className="flex flex-wrap items-center gap-6">
              {!isHidden("is_active") && (
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                    data-testid="wizard-switch-collaborator-active"
                    disabled={isReadonly("is_active")}
                  />
                  <Label>{t.collaborators.fields.active}</Label>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.clientContact}
                  onCheckedChange={(checked) => setFormData({ ...formData, clientContact: checked })}
                  data-testid="wizard-switch-collaborator-client-contact"
                />
                <Label>{t.collaborators.fields.clientContact}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.svetZdravia}
                  onCheckedChange={(checked) => setFormData({ ...formData, svetZdravia: checked })}
                  data-testid="wizard-switch-collaborator-svet-zdravia"
                />
                <Label>{t.collaborators.fields.svetZdravia}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.monthRewards}
                  onCheckedChange={(checked) => setFormData({ ...formData, monthRewards: checked })}
                  data-testid="wizard-switch-collaborator-month-rewards"
                />
                <Label>{t.collaborators.fields.monthRewards}</Label>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{"Company information is optional"}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {!isHidden("company_name") && (
                <div className="space-y-2">
                  <Label>{t.collaborators.fields.companyName}</Label>
                  <Input
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    data-testid="wizard-input-collaborator-company-name"
                    disabled={isReadonly("company_name")}
                    className={isReadonly("company_name") ? "bg-muted" : ""}
                  />
                </div>
              )}
              {!isHidden("company_ico") && (
                <div className="space-y-2">
                  <Label>{t.collaborators.fields.ico}</Label>
                  <Input
                    value={formData.ico}
                    onChange={(e) => setFormData({ ...formData, ico: e.target.value })}
                    data-testid="wizard-input-collaborator-ico"
                    disabled={isReadonly("company_ico")}
                    className={isReadonly("company_ico") ? "bg-muted" : ""}
                  />
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {!isHidden("company_dic") && (
                <div className="space-y-2">
                  <Label>{t.collaborators.fields.dic}</Label>
                  <Input
                    value={formData.dic}
                    onChange={(e) => setFormData({ ...formData, dic: e.target.value })}
                    data-testid="wizard-input-collaborator-dic"
                    disabled={isReadonly("company_dic")}
                    className={isReadonly("company_dic") ? "bg-muted" : ""}
                  />
                </div>
              )}
              {!isHidden("company_ic_dph") && (
                <div className="space-y-2">
                  <Label>{t.collaborators.fields.icDph}</Label>
                  <Input
                    value={formData.icDph}
                    onChange={(e) => setFormData({ ...formData, icDph: e.target.value })}
                    data-testid="wizard-input-collaborator-icdph"
                    disabled={isReadonly("company_ic_dph")}
                    className={isReadonly("company_ic_dph") ? "bg-muted" : ""}
                  />
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {!isHidden("bank_account") && (
                <div className="space-y-2">
                  <Label>{t.collaborators.fields.companyIban}</Label>
                  <Input
                    value={formData.companyIban}
                    onChange={(e) => setFormData({ ...formData, companyIban: e.target.value })}
                    data-testid="wizard-input-collaborator-company-iban"
                    disabled={isReadonly("bank_account")}
                    className={isReadonly("bank_account") ? "bg-muted" : ""}
                  />
                </div>
              )}
              {!isHidden("bank_account") && (
                <div className="space-y-2">
                  <Label>{t.collaborators.fields.companySwift}</Label>
                  <Input
                    value={formData.companySwift}
                    onChange={(e) => setFormData({ ...formData, companySwift: e.target.value })}
                    data-testid="wizard-input-collaborator-company-swift"
                    disabled={isReadonly("bank_account")}
                    className={isReadonly("bank_account") ? "bg-muted" : ""}
                  />
                </div>
              )}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
              <Smartphone className="h-6 w-6 text-muted-foreground" />
              <div>
                <h4 className="font-medium">INDEXUS Connect</h4>
                <p className="text-sm text-muted-foreground">
                  {t.collaborators?.mobileApp?.description || "Configure mobile app access for field representatives"}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={mobileCredentials.mobileAppEnabled}
                  onCheckedChange={(checked) => setMobileCredentials({ ...mobileCredentials, mobileAppEnabled: checked })}
                  data-testid="wizard-switch-mobile-app-enabled"
                />
                <Label>{t.collaborators?.mobileApp?.enabled || "Enable mobile app access"}</Label>
              </div>

              {mobileCredentials.mobileAppEnabled && (
                <div className="space-y-4 pl-8 border-l-2 border-muted">
                  <div className="space-y-2">
                    <Label>{t.collaborators?.mobileApp?.username || "Username"}</Label>
                    <Input
                      value={mobileCredentials.mobileUsername}
                      onChange={(e) => setMobileCredentials({ ...mobileCredentials, mobileUsername: e.target.value })}
                      placeholder={t.collaborators?.mobileApp?.usernamePlaceholder || "Enter username for mobile app login"}
                      data-testid="wizard-input-mobile-username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.collaborators?.mobileApp?.password || "Password"}</Label>
                    <Input
                      type="password"
                      value={mobileCredentials.mobilePassword}
                      onChange={(e) => setMobileCredentials({ ...mobileCredentials, mobilePassword: e.target.value })}
                      placeholder={initialData?.mobilePasswordHash ? (t.collaborators?.mobileApp?.passwordPlaceholderExisting || "Leave blank to keep current password") : (t.collaborators?.mobileApp?.passwordPlaceholder || "Enter password for mobile app")}
                      data-testid="wizard-input-mobile-password"
                    />
                  </div>
                  {mobileCredentials.mobilePassword && (
                    <div className="space-y-2">
                      <Label>{t.collaborators?.mobileApp?.passwordConfirm || "Confirm Password"}</Label>
                      <Input
                        type="password"
                        value={mobileCredentials.mobilePasswordConfirm}
                        onChange={(e) => setMobileCredentials({ ...mobileCredentials, mobilePasswordConfirm: e.target.value })}
                        placeholder={t.collaborators?.mobileApp?.passwordConfirmPlaceholder || "Confirm password"}
                        data-testid="wizard-input-mobile-password-confirm"
                      />
                      {mobileCredentials.mobilePassword !== mobileCredentials.mobilePasswordConfirm && mobileCredentials.mobilePasswordConfirm && (
                        <p className="text-sm text-destructive">{t.collaborators?.mobileApp?.passwordMismatch || "Passwords do not match"}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const currentStepInfo = WIZARD_STEPS[currentStep];
  const StepIcon = currentStepInfo?.icon || User;

  return (
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
        
        <div className="min-h-[300px]">
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
  );
}
