import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COUNTRIES } from "@/lib/countries";
import type { Role } from "@shared/schema";
import { ChevronLeft, ChevronRight, Check, User, Shield, MapPin, Phone, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useModuleFieldPermissions } from "@/components/ui/permission-field";

const userFormSchema = z.object({
  username: z.string().min(3, "Používateľské meno musí mať aspoň 3 znaky"),
  email: z.string().email("Neplatná emailová adresa"),
  fullName: z.string().min(2, "Meno je povinné"),
  password: z.string().min(6, "Heslo musí mať aspoň 6 znakov"),
  role: z.enum(["admin", "manager", "user"]),
  roleId: z.string().optional(),
  isActive: z.boolean(),
  assignedCountries: z.array(z.string()).min(1, "Vyberte aspoň jednu krajinu"),
  sipEnabled: z.boolean().optional(),
  sipExtension: z.string().optional(),
  sipPassword: z.string().optional(),
  sipDisplayName: z.string().optional(),
});

type UserFormData = z.infer<typeof userFormSchema>;

interface UserFormWizardProps {
  onSuccess: () => void;
  onCancel?: () => void;
}

const WIZARD_STEPS = [
  { id: "profile", icon: User, title: "Profil", description: "Základné údaje používateľa" },
  { id: "access", icon: Shield, title: "Prístupy", description: "Rola a oprávnenia" },
  { id: "countries", icon: MapPin, title: "Krajiny", description: "Pridelené krajiny" },
  { id: "sip", icon: Phone, title: "SIP telefónia", description: "Nastavenie telefónu" },
  { id: "review", icon: ClipboardCheck, title: "Súhrn", description: "Kontrola údajov" },
];

export function UserFormWizard({ onSuccess, onCancel }: UserFormWizardProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const { isHidden, isReadonly } = useModuleFieldPermissions("users");
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const form = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      username: "",
      email: "",
      fullName: "",
      password: "",
      role: "user",
      roleId: "",
      isActive: true,
      assignedCountries: [],
      sipEnabled: false,
      sipExtension: "",
      sipPassword: "",
      sipDisplayName: "",
    },
  });

  const { data: roles = [], isLoading: rolesLoading } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
  });

  const activeRoles = roles.filter(r => r.isActive);
  const systemRolesWithLegacy = activeRoles.filter(r => (r as any).legacyRole);
  const hasSystemRoles = systemRolesWithLegacy.length > 0;

  const createMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      const submitData = { ...data };
      if (submitData.roleId && hasSystemRoles) {
        const selectedRole = activeRoles.find(r => r.id === submitData.roleId);
        if (selectedRole && (selectedRole as any).legacyRole) {
          submitData.role = (selectedRole as any).legacyRole as "admin" | "manager" | "user";
        } else {
          submitData.role = "user";
        }
      }
      return apiRequest("POST", "/api/users", submitData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: t.success.created,
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: t.errors.saveFailed,
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const validateCurrentStep = async (): Promise<boolean> => {
    const fieldsToValidate: (keyof UserFormData)[] = [];
    
    switch (currentStep) {
      case 0:
        fieldsToValidate.push("fullName", "username", "email", "password");
        break;
      case 1:
        if (hasSystemRoles) {
          fieldsToValidate.push("roleId");
        }
        fieldsToValidate.push("isActive");
        break;
      case 2:
        fieldsToValidate.push("assignedCountries");
        break;
      case 3:
        break;
      case 4:
        return true;
    }

    const result = await form.trigger(fieldsToValidate);
    return result;
  };

  const handleNext = async () => {
    const isValid = await validateCurrentStep();
    if (!isValid) return;
    
    setCompletedSteps(prev => new Set(Array.from(prev).concat(currentStep)));
    
    if (currentStep === WIZARD_STEPS.length - 1) {
      const data = form.getValues();
      createMutation.mutate(data);
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleStepClick = (index: number) => {
    if (index < currentStep || completedSteps.has(index) || completedSteps.has(index - 1)) {
      setCurrentStep(index);
    }
  };

  const handleSelectAll = () => {
    form.setValue("assignedCountries", COUNTRIES.map(c => c.code));
  };

  const handleClearAll = () => {
    form.setValue("assignedCountries", []);
  };

  const progress = ((currentStep + 1) / WIZARD_STEPS.length) * 100;
  const currentStepData = WIZARD_STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === WIZARD_STEPS.length - 1;

  const renderProfileStep = () => (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {!isHidden("full_name") && (
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.users.fullName} *</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t.users.fullName}
                    {...field}
                    data-testid="wizard-input-fullname"
                    disabled={isReadonly("full_name")}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {!isHidden("username") && (
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.users.username} *</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t.users.username}
                    {...field}
                    data-testid="wizard-input-username"
                    disabled={isReadonly("username")}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {!isHidden("email") && (
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.common.email} *</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder={t.common.email}
                    {...field}
                    data-testid="wizard-input-email"
                    disabled={isReadonly("email")}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {!isHidden("password") && (
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.users.password} *</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder={t.users.enterPassword}
                    {...field}
                    data-testid="wizard-input-password"
                    disabled={isReadonly("password")}
                  />
                </FormControl>
                <FormDescription>Minimálne 6 znakov</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>
    </div>
  );

  const renderAccessStep = () => (
    <div className="space-y-4">
      {!isHidden("role") && (
        rolesLoading ? (
          <FormItem>
            <FormLabel>{t.users.role}</FormLabel>
            <div className="h-9 flex items-center text-sm text-muted-foreground">
              {t.common.loading}...
            </div>
          </FormItem>
        ) : hasSystemRoles ? (
          <FormField
            control={form.control}
            name="roleId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.users.role} *</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value || ""}
                  disabled={isReadonly("role")}
                >
                  <FormControl>
                    <SelectTrigger data-testid="wizard-select-role">
                      <SelectValue placeholder={t.users.selectRole} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {activeRoles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t.users.role} *</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                  disabled={isReadonly("role")}
                >
                  <FormControl>
                    <SelectTrigger data-testid="wizard-select-role">
                      <SelectValue placeholder={t.users.selectRole} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="admin">{t.users.roles.admin}</SelectItem>
                    <SelectItem value="manager">{t.users.roles.manager}</SelectItem>
                    <SelectItem value="user">{t.users.roles.user}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )
      )}

      {!isHidden("is_active") && (
        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="wizard-checkbox-active"
                  disabled={isReadonly("is_active")}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>{t.users.activeAccount}</FormLabel>
                <FormDescription>{t.users.activeAccountHint}</FormDescription>
              </div>
            </FormItem>
          )}
        />
      )}
    </div>
  );

  const renderCountriesStep = () => (
    <div className="space-y-4">
      {!isHidden("assigned_countries") && (
        <FormField
          control={form.control}
          name="assignedCountries"
          render={() => (
            <FormItem>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <FormLabel className="text-base">{t.users.assignedCountries} *</FormLabel>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                    data-testid="wizard-button-select-all"
                    disabled={isReadonly("assigned_countries")}
                  >
                    {t.users.selectAll}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleClearAll}
                    data-testid="wizard-button-clear-all"
                    disabled={isReadonly("assigned_countries")}
                  >
                    {t.users.clearAll}
                  </Button>
                </div>
              </div>
              <FormDescription className="mb-4">{t.users.selectCountriesHint}</FormDescription>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {COUNTRIES.map((country) => (
                  <FormField
                    key={country.code}
                    control={form.control}
                    name="assignedCountries"
                    render={({ field }) => (
                      <FormItem
                        className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 hover-elevate cursor-pointer"
                      >
                        <FormControl>
                          <Checkbox
                            checked={field.value?.includes(country.code)}
                            onCheckedChange={(checked) => {
                              return checked
                                ? field.onChange([...field.value, country.code])
                                : field.onChange(field.value?.filter((v) => v !== country.code));
                            }}
                            data-testid={`wizard-checkbox-country-${country.code}`}
                            disabled={isReadonly("assigned_countries")}
                          />
                        </FormControl>
                        <FormLabel className="flex items-center gap-2 font-normal cursor-pointer">
                          <span className="text-lg">{country.flag}</span>
                          <span>{country.name}</span>
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  );

  const renderSipStep = () => (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="sipEnabled"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <FormLabel className="text-base">Povoliť SIP telefón</FormLabel>
              <FormDescription>
                Aktivovať možnosť telefonovania pre tohto používateľa
              </FormDescription>
            </div>
            <FormControl>
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
                data-testid="wizard-switch-sip-enabled"
              />
            </FormControl>
          </FormItem>
        )}
      />

      {form.watch("sipEnabled") && (
        <div className="grid gap-4 sm:grid-cols-2 pl-4 border-l-2 border-primary/20">
          <FormField
            control={form.control}
            name="sipExtension"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Linka (Extension)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="1001"
                    {...field}
                    data-testid="wizard-input-sip-extension"
                  />
                </FormControl>
                <FormDescription>Číslo linky pridelené v Asterisk PBX</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="sipPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Heslo</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    {...field}
                    data-testid="wizard-input-sip-password"
                  />
                </FormControl>
                <FormDescription>Heslo pre autentifikáciu SIP linky</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="sipDisplayName"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Zobrazované meno (voliteľné)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Meno zobrazené pri hovore"
                    {...field}
                    data-testid="wizard-input-sip-display-name"
                  />
                </FormControl>
                <FormDescription>Meno ktoré sa zobrazí volanému</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </div>
  );

  const renderReviewStep = () => {
    const formValues = form.getValues();
    const selectedRole = hasSystemRoles
      ? activeRoles.find(r => r.id === formValues.roleId)
      : null;
    const roleName = selectedRole?.name || t.users.roles[formValues.role] || formValues.role;

    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <User className="h-4 w-4" />
            Profil
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">{t.users.fullName}</p>
              <p className="font-medium">{formValues.fullName || "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t.users.username}</p>
              <p className="font-medium">{formValues.username || "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t.common.email}</p>
              <p className="font-medium">{formValues.email || "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t.users.password}</p>
              <p className="font-medium">••••••••</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Prístupy
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">{t.users.role}</p>
              <p className="font-medium">{roleName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Stav</p>
              <Badge variant={formValues.isActive ? "default" : "secondary"}>
                {formValues.isActive ? t.common.active : t.common.inactive}
              </Badge>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Krajiny
          </h4>
          <div className="flex flex-wrap gap-2">
            {formValues.assignedCountries.length > 0 ? (
              formValues.assignedCountries.map(code => {
                const country = COUNTRIES.find(c => c.code === code);
                return country ? (
                  <Badge key={code} variant="outline">
                    {country.flag} {country.name}
                  </Badge>
                ) : null;
              })
            ) : (
              <p className="text-sm text-muted-foreground">Žiadne krajiny</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <Phone className="h-4 w-4" />
            SIP telefónia
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">SIP telefón</p>
              <Badge variant={formValues.sipEnabled ? "default" : "secondary"}>
                {formValues.sipEnabled ? "Povolený" : "Zakázaný"}
              </Badge>
            </div>
            {formValues.sipEnabled && (
              <>
                <div>
                  <p className="text-muted-foreground">Linka</p>
                  <p className="font-medium">{formValues.sipExtension || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Zobrazované meno</p>
                  <p className="font-medium">{formValues.sipDisplayName || "-"}</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderProfileStep();
      case 1:
        return renderAccessStep();
      case 2:
        return renderCountriesStep();
      case 3:
        return renderSipStep();
      case 4:
        return renderReviewStep();
      default:
        return null;
    }
  };

  return (
    <Form {...form}>
      <Card className="w-full border-0 shadow-none">
        <CardHeader className="pb-4 px-0">
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Krok {currentStep + 1} z {WIZARD_STEPS.length}</span>
              <span>{Math.round(progress)}% dokončené</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </CardHeader>

        <CardContent className="space-y-6 px-0">
          <div className="flex flex-wrap gap-2">
            {WIZARD_STEPS.map((step, index) => {
              const isCompleted = completedSteps.has(index);
              const isCurrent = index === currentStep;
              const isClickable = index < currentStep || isCompleted || completedSteps.has(index - 1);
              const StepIcon = step.icon;

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
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                    isCurrent && "bg-primary-foreground text-primary",
                    isCompleted && !isCurrent && "bg-primary text-primary-foreground",
                    !isCurrent && !isCompleted && "bg-muted-foreground/20"
                  )}>
                    {isCompleted ? <Check className="h-3 w-3" /> : <StepIcon className="h-3 w-3" />}
                  </span>
                  <span className="hidden sm:inline">{step.title}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-4">
            <div className="border-b pb-4">
              {(() => {
                const StepIcon = currentStepData.icon;
                return (
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <StepIcon className="h-5 w-5" />
                    {currentStepData.title}
                  </h3>
                );
              })()}
              {currentStepData.description && (
                <p className="text-sm text-muted-foreground mt-1">{currentStepData.description}</p>
              )}
            </div>

            <div className="min-h-[200px]">
              {renderStepContent()}
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-wrap justify-between gap-2 border-t pt-4 px-0">
          <div className="flex gap-2">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={createMutation.isPending}
                data-testid="wizard-cancel"
              >
                {t.common.cancel}
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handlePrevious}
              disabled={isFirstStep || createMutation.isPending}
              data-testid="wizard-previous"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Späť
            </Button>

            <Button
              type="button"
              onClick={handleNext}
              disabled={createMutation.isPending}
              data-testid="wizard-next"
            >
              {createMutation.isPending ? (
                t.users.saving
              ) : isLastStep ? (
                t.users.createUser
              ) : (
                <>
                  Ďalej
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </Form>
  );
}
