import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { COUNTRIES, WORLD_COUNTRIES, CLIENT_STATUSES } from "@shared/schema";
import type { Customer, ComplaintType, CooperationType, VipStatus, HealthInsurance } from "@shared/schema";
import { ChevronLeft, ChevronRight, Check, User, Phone, MapPin, BarChart3, Building2, ClipboardCheck, CalendarIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

function validateIBAN(iban: string): boolean {
  if (!iban) return true;
  const cleaned = iban.replace(/\s/g, "").toUpperCase();
  if (cleaned.length < 15 || cleaned.length > 34) return false;
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(cleaned)) return false;
  const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);
  const numericString = rearranged.split("").map(char => {
    const code = char.charCodeAt(0);
    return code >= 65 && code <= 90 ? (code - 55).toString() : char;
  }).join("");
  let remainder = "";
  for (const digit of numericString) {
    remainder = (parseInt(remainder + digit, 10) % 97).toString();
  }
  return parseInt(remainder, 10) === 1;
}

const customerFormSchema = z.object({
  titleBefore: z.string().optional(),
  firstName: z.string().min(2, "Required"),
  lastName: z.string().min(2, "Required"),
  maidenName: z.string().optional(),
  titleAfter: z.string().optional(),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  mobile2: z.string().optional(),
  otherContact: z.string().optional(),
  email: z.string().email("Invalid email"),
  email2: z.string().optional(),
  nationalId: z.string().optional(),
  idCardNumber: z.string().optional(),
  dateOfBirthDay: z.number().nullable().optional(),
  dateOfBirthMonth: z.number().nullable().optional(),
  dateOfBirthYear: z.number().nullable().optional(),
  newsletter: z.boolean().default(false),
  complaintTypeId: z.string().optional(),
  cooperationTypeId: z.string().optional(),
  vipStatusId: z.string().optional(),
  country: z.string().min(1, "Required"),
  city: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  region: z.string().optional(),
  useCorrespondenceAddress: z.boolean().default(false),
  corrName: z.string().optional(),
  corrAddress: z.string().optional(),
  corrCity: z.string().optional(),
  corrPostalCode: z.string().optional(),
  corrRegion: z.string().optional(),
  corrCountry: z.string().optional(),
  bankAccount: z.string().optional().refine((val) => !val || validateIBAN(val), {
    message: "Invalid IBAN format",
  }),
  bankCode: z.string().optional(),
  bankName: z.string().optional(),
  bankSwift: z.string().optional(),
  healthInsuranceId: z.string().optional(),
  clientStatus: z.string().default("potential"),
  status: z.enum(["active", "pending", "inactive"]),
  serviceType: z.enum(["cord_blood", "cord_tissue", "both"]).optional(),
  notes: z.string().optional(),
});

type CustomerFormData = z.infer<typeof customerFormSchema>;

interface CustomerFormWizardProps {
  initialData?: Customer | null;
  onSubmit: (data: CustomerFormData) => void;
  isLoading?: boolean;
  onCancel?: () => void;
}

const WIZARD_STEPS = [
  { id: "personal", icon: User },
  { id: "contact", icon: Phone },
  { id: "address", icon: MapPin },
  { id: "marketing", icon: BarChart3, isOptional: true },
  { id: "banking", icon: Building2, isOptional: true },
  { id: "review", icon: ClipboardCheck },
];

export function CustomerFormWizard({ initialData, onSubmit, isLoading, onCancel }: CustomerFormWizardProps) {
  const { t } = useI18n();
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const { data: complaintTypes = [] } = useQuery<ComplaintType[]>({
    queryKey: ["/api/config/complaint-types"],
  });
  
  const { data: cooperationTypes = [] } = useQuery<CooperationType[]>({
    queryKey: ["/api/config/cooperation-types"],
  });
  
  const { data: vipStatuses = [] } = useQuery<VipStatus[]>({
    queryKey: ["/api/config/vip-statuses"],
  });
  
  const { data: healthInsuranceCompanies = [] } = useQuery<HealthInsurance[]>({
    queryKey: ["/api/config/health-insurance"],
  });

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      titleBefore: initialData?.titleBefore || "",
      firstName: initialData?.firstName || "",
      lastName: initialData?.lastName || "",
      maidenName: initialData?.maidenName || "",
      titleAfter: initialData?.titleAfter || "",
      phone: initialData?.phone || "",
      mobile: initialData?.mobile || "",
      mobile2: initialData?.mobile2 || "",
      otherContact: initialData?.otherContact || "",
      email: initialData?.email || "",
      email2: initialData?.email2 || "",
      nationalId: initialData?.nationalId || "",
      idCardNumber: initialData?.idCardNumber || "",
      dateOfBirthDay: initialData?.dateOfBirth ? new Date(initialData.dateOfBirth).getDate() : null,
      dateOfBirthMonth: initialData?.dateOfBirth ? new Date(initialData.dateOfBirth).getMonth() + 1 : null,
      dateOfBirthYear: initialData?.dateOfBirth ? new Date(initialData.dateOfBirth).getFullYear() : null,
      newsletter: initialData?.newsletter || false,
      complaintTypeId: initialData?.complaintTypeId || "",
      cooperationTypeId: initialData?.cooperationTypeId || "",
      vipStatusId: initialData?.vipStatusId || "",
      country: initialData?.country || "",
      city: initialData?.city || "",
      address: initialData?.address || "",
      postalCode: initialData?.postalCode || "",
      region: initialData?.region || "",
      useCorrespondenceAddress: initialData?.useCorrespondenceAddress || false,
      corrName: initialData?.corrName || "",
      corrAddress: initialData?.corrAddress || "",
      corrCity: initialData?.corrCity || "",
      corrPostalCode: initialData?.corrPostalCode || "",
      corrRegion: initialData?.corrRegion || "",
      corrCountry: initialData?.corrCountry || "",
      bankAccount: initialData?.bankAccount || "",
      bankCode: initialData?.bankCode || "",
      bankName: initialData?.bankName || "",
      bankSwift: initialData?.bankSwift || "",
      healthInsuranceId: initialData?.healthInsuranceId || "",
      clientStatus: initialData?.clientStatus || "potential",
      status: (initialData?.status as any) || "pending",
      serviceType: (initialData?.serviceType as any) || undefined,
      notes: initialData?.notes || "",
    },
  });

  const selectedCountry = form.watch("country");
  const useCorrespondenceAddress = form.watch("useCorrespondenceAddress");
  const formValues = form.watch();
  
  const filteredHealthInsurance = healthInsuranceCompanies.filter(
    hi => hi.countryCode === selectedCountry || !selectedCountry
  );

  const progress = ((currentStep + 1) / WIZARD_STEPS.length) * 100;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === WIZARD_STEPS.length - 1;

  const validateCurrentStep = async (): Promise<boolean> => {
    let fieldsToValidate: (keyof CustomerFormData)[] = [];
    
    switch (currentStep) {
      case 0:
        fieldsToValidate = ["firstName", "lastName", "email"];
        break;
      case 1:
        fieldsToValidate = [];
        break;
      case 2:
        fieldsToValidate = ["country"];
        break;
      case 3:
      case 4:
        fieldsToValidate = [];
        break;
      case 5:
        fieldsToValidate = ["firstName", "lastName", "email", "country", "status"];
        break;
    }
    
    if (fieldsToValidate.length === 0) return true;
    
    const result = await form.trigger(fieldsToValidate);
    return result;
  };

  const handleNext = async () => {
    const isValid = await validateCurrentStep();
    if (!isValid) return;
    
    setCompletedSteps(prev => new Set(Array.from(prev).concat(currentStep)));
    
    if (isLastStep) {
      form.handleSubmit(onSubmit)();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    if (WIZARD_STEPS[currentStep]?.isOptional && !isLastStep) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleStepClick = (index: number) => {
    if (index < currentStep || completedSteps.has(index) || completedSteps.has(index - 1)) {
      setCurrentStep(index);
    }
  };

  const getStepTitle = (stepId: string): string => {
    const stepTitles: Record<string, string> = {
      personal: t.wizard?.steps?.personalInfo || "Personal Info",
      contact: t.wizard?.steps?.contactDetails || "Contact Details",
      address: t.wizard?.steps?.address || "Address",
      marketing: t.wizard?.steps?.marketing || "Marketing",
      banking: t.wizard?.steps?.banking || "Banking",
      review: t.wizard?.steps?.review || "Review",
    };
    return stepTitles[stepId] || stepId;
  };

  const getStepDescription = (stepId: string): string => {
    const stepDescs: Record<string, string> = {
      personal: t.wizard?.steps?.personalInfoDesc || "Basic information about the client",
      contact: t.wizard?.steps?.contactDetailsDesc || "Phone numbers and email addresses",
      address: t.wizard?.steps?.addressDesc || "Permanent and correspondence address",
      marketing: t.wizard?.steps?.marketingDesc || "Marketing preferences and classifications",
      banking: t.wizard?.steps?.bankingDesc || "Bank account and health insurance",
      review: t.wizard?.steps?.reviewDesc || "Review and confirm all information",
    };
    return stepDescs[stepId] || "";
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="titleBefore"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.customers.fields.title}</FormLabel>
                    <FormControl>
                      <Input placeholder="Ing., Mgr., ..." {...field} data-testid="wizard-input-title-before" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.customers.firstName} *</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="wizard-input-firstname" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.customers.lastName} *</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="wizard-input-lastname" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="maidenName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.customers.fields.maidenName}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="wizard-input-maiden-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="titleAfter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.customers.fields.titleAfter}</FormLabel>
                    <FormControl>
                      <Input placeholder="PhD., MBA, ..." {...field} data-testid="wizard-input-title-after" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.customers.email} *</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} data-testid="wizard-input-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="nationalId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.customers.fields.nationalId}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="wizard-input-national-id" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="space-y-2">
                <Label>{t.customers.fields.dateOfBirth}</Label>
                <div className="flex gap-2">
                  <FormField
                    control={form.control}
                    name="dateOfBirthDay"
                    render={({ field }) => {
                      const yearVal = form.watch("dateOfBirthYear");
                      const monthVal = form.watch("dateOfBirthMonth");
                      const getDaysInMonth = (year?: number | null, month?: number | null) => {
                        if (!year || !month) return 31;
                        return new Date(year, month, 0).getDate();
                      };
                      const daysInMonth = getDaysInMonth(yearVal, monthVal);
                      const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
                      return (
                        <Select
                          value={field.value?.toString() || "_none"}
                          onValueChange={(val) => field.onChange(val === "_none" ? null : parseInt(val))}
                        >
                          <SelectTrigger className="w-[80px]" data-testid="wizard-select-dob-day">
                            <SelectValue placeholder={t.collaborators?.fields?.day || "Day"} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">-</SelectItem>
                            {days.map((day) => (
                              <SelectItem key={day} value={day.toString()}>{day}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      );
                    }}
                  />
                  <FormField
                    control={form.control}
                    name="dateOfBirthMonth"
                    render={({ field }) => {
                      const months = Array.from({ length: 12 }, (_, i) => i + 1);
                      return (
                        <Select
                          value={field.value?.toString() || "_none"}
                          onValueChange={(val) => field.onChange(val === "_none" ? null : parseInt(val))}
                        >
                          <SelectTrigger className="w-[80px]" data-testid="wizard-select-dob-month">
                            <SelectValue placeholder={t.collaborators?.fields?.month || "Month"} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">-</SelectItem>
                            {months.map((month) => (
                              <SelectItem key={month} value={month.toString()}>{month}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      );
                    }}
                  />
                  <FormField
                    control={form.control}
                    name="dateOfBirthYear"
                    render={({ field }) => {
                      const currentYear = new Date().getFullYear();
                      const years = Array.from({ length: 120 }, (_, i) => currentYear - i);
                      return (
                        <Select
                          value={field.value?.toString() || "_none"}
                          onValueChange={(val) => field.onChange(val === "_none" ? null : parseInt(val))}
                        >
                          <SelectTrigger className="w-[90px]" data-testid="wizard-select-dob-year">
                            <SelectValue placeholder={t.collaborators?.fields?.year || "Year"} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">-</SelectItem>
                            {years.map((year) => (
                              <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      );
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.customers.phone}</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="+421..." {...field} data-testid="wizard-input-phone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="mobile"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.customers.fields.mobile}</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="+421..." {...field} data-testid="wizard-input-mobile" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="mobile2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.customers.fields.mobile2}</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="+421..." {...field} data-testid="wizard-input-mobile2" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="otherContact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.customers.fields.otherContact}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="wizard-input-other-contact" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.customers.fields.email2}</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} data-testid="wizard-input-email2" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h4 className="font-medium mb-4">{t.customers.fields.permanentAddress}</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.customers.fields.street}</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="wizard-input-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.customers.city}</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="wizard-input-city" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3 mt-4">
                <FormField
                  control={form.control}
                  name="postalCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.customers.postalCode}</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="wizard-input-postal-code" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="region"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.customers.fields.region}</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="wizard-input-region" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.customers.country} *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="wizard-select-country">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {WORLD_COUNTRIES.map((c) => (
                            <SelectItem key={c.code} value={c.code}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            <FormField
              control={form.control}
              name="useCorrespondenceAddress"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="wizard-checkbox-correspondence"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>{t.customers.fields.useCorrespondenceAddress}</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            {useCorrespondenceAddress && (
              <div className="space-y-4 border-l-2 border-primary/20 pl-4">
                <h4 className="font-medium">{t.customers.fields.correspondenceAddress}</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="corrName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.customers.fields.recipientName}</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="wizard-input-corr-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="corrAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.customers.fields.street}</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="wizard-input-corr-address" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="corrCity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.customers.city}</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="wizard-input-corr-city" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="corrPostalCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.customers.postalCode}</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="wizard-input-corr-postal-code" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="corrCountry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.customers.country}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="wizard-select-corr-country">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {WORLD_COUNTRIES.map((c) => (
                              <SelectItem key={c.code} value={c.code}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="complaintTypeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.customers.fields.complaintType}</FormLabel>
                  <Select onValueChange={(val) => field.onChange(val === "__none__" ? null : val)} defaultValue={field.value || "__none__"}>
                    <FormControl>
                      <SelectTrigger data-testid="wizard-select-complaint-type">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">{t.customers.none}</SelectItem>
                      {complaintTypes.filter(ct => ct.isActive).map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cooperationTypeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.customers.fields.cooperationType}</FormLabel>
                  <Select onValueChange={(val) => field.onChange(val === "__none__" ? null : val)} defaultValue={field.value || "__none__"}>
                    <FormControl>
                      <SelectTrigger data-testid="wizard-select-cooperation-type">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">{t.customers.none}</SelectItem>
                      {cooperationTypes.filter(ct => ct.isActive).map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="vipStatusId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.customers.fields.vipStatus}</FormLabel>
                  <Select onValueChange={(val) => field.onChange(val === "__none__" ? null : val)} defaultValue={field.value || "__none__"}>
                    <FormControl>
                      <SelectTrigger data-testid="wizard-select-vip-status">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">{t.customers.none}</SelectItem>
                      {vipStatuses.filter(vs => vs.isActive).map((status) => (
                        <SelectItem key={status.id} value={status.id}>
                          {status.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="newsletter"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="wizard-checkbox-newsletter"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>{t.customers.fields.newsletter}</FormLabel>
                    <FormDescription>{t.customers.fields.newsletterDescription}</FormDescription>
                  </div>
                </FormItem>
              )}
            />
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h4 className="font-medium mb-4">{t.customers.fields.bankDetails}</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="bankAccount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.customers.fields.bankAccount}</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="wizard-input-bank-account" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bankCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.customers.fields.bankCode}</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="wizard-input-bank-code" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 mt-4">
                <FormField
                  control={form.control}
                  name="bankName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.customers.fields.bankName}</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="wizard-input-bank-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bankSwift"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.customers.fields.swift}</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="wizard-input-bank-swift" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-medium mb-4">{t.customers.fields.healthInsurance}</h4>
              <FormField
                control={form.control}
                name="healthInsuranceId"
                render={({ field }) => (
                  <FormItem>
                    <Select onValueChange={(val) => field.onChange(val === "__none__" ? null : val)} defaultValue={field.value || "__none__"}>
                      <FormControl>
                        <SelectTrigger data-testid="wizard-select-health-insurance">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">{t.customers.none}</SelectItem>
                        {filteredHealthInsurance.filter(hi => hi.isActive).map((ins) => (
                          <SelectItem key={ins.id} value={ins.id}>
                            {ins.name} ({ins.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-4">
                <h4 className="font-medium">{t.wizard?.steps?.personalInfo || "Personal Info"}</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.customers.firstName}:</span>
                    <span className="font-medium">{formValues.firstName} {formValues.lastName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.customers.email}:</span>
                    <span className="font-medium">{formValues.email}</span>
                  </div>
                  {formValues.phone && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t.customers.phone}:</span>
                      <span className="font-medium">{formValues.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">{t.wizard?.steps?.address || "Address"}</h4>
                <div className="space-y-2 text-sm">
                  {formValues.address && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t.customers.fields.street}:</span>
                      <span className="font-medium">{formValues.address}</span>
                    </div>
                  )}
                  {formValues.city && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t.customers.city}:</span>
                      <span className="font-medium">{formValues.city}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t.customers.country}:</span>
                    <span className="font-medium">
                      {WORLD_COUNTRIES.find(c => c.code === formValues.country)?.name || formValues.country}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="clientStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.customers.fields.clientStatus}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="wizard-select-client-status">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="potential">{t.customers.clientStatuses?.potential || "Potential"}</SelectItem>
                        <SelectItem value="acquired">{t.customers.clientStatuses?.acquired || "Acquired"}</SelectItem>
                        <SelectItem value="terminated">{t.customers.clientStatuses?.terminated || "Terminated"}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.customers.status}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="wizard-select-status">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">{t.customers.statuses.active}</SelectItem>
                        <SelectItem value="pending">{t.customers.statuses.pending}</SelectItem>
                        <SelectItem value="inactive">{t.customers.statuses.inactive}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="serviceType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.customers.serviceType}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="wizard-select-service-type">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="cord_blood">{t.customers.serviceTypes.cordBlood}</SelectItem>
                      <SelectItem value="cord_tissue">{t.customers.serviceTypes.cordTissue}</SelectItem>
                      <SelectItem value="both">{t.customers.serviceTypes.both}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.customers.notes}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t.customers.fields.notesPlaceholder}
                      className="resize-none"
                      rows={3}
                      {...field}
                      data-testid="wizard-textarea-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        );

      default:
        return null;
    }
  };

  const currentStepInfo = WIZARD_STEPS[currentStep];
  const StepIcon = currentStepInfo?.icon || User;

  return (
    <Form {...form}>
      <form onSubmit={(e) => e.preventDefault()}>
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
                {currentStepInfo.isOptional && (
                  <Badge variant="outline" className="text-xs">
                    {t.wizard?.optional || "Optional"}
                  </Badge>
                )}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {getStepDescription(currentStepInfo.id)}
              </p>
            </div>
            
            <div className="min-h-[300px]">
              {renderStepContent()}
            </div>
          </CardContent>

          <CardFooter className="flex flex-wrap justify-between gap-2 border-t pt-4">
            <div>
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isLoading}
                  data-testid="wizard-cancel"
                >
                  {t.wizard?.cancel || "Cancel"}
                </Button>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handlePrevious}
                disabled={isFirstStep || isLoading}
                data-testid="wizard-previous"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                {t.wizard?.previous || "Previous"}
              </Button>
              
              {currentStepInfo.isOptional && !isLastStep && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleSkip}
                  disabled={isLoading}
                  data-testid="wizard-skip"
                >
                  {t.wizard?.skip || "Skip"}
                </Button>
              )}
              
              <Button
                type="button"
                onClick={handleNext}
                disabled={isLoading}
                data-testid="wizard-next"
              >
                {isLastStep ? (isLoading ? t.customers.fields.saving : t.wizard?.complete || "Complete") : t.wizard?.next || "Next"}
                {!isLastStep && <ChevronRight className="h-4 w-4 ml-1" />}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}

export type { CustomerFormData };
