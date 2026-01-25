import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { COUNTRIES, WORLD_COUNTRIES } from "@shared/schema";
import { CLIENT_STATUSES } from "@shared/schema";
import type { Customer, ComplaintType, CooperationType, VipStatus, HealthInsurance } from "@shared/schema";
import { CalendarIcon, Copy, PhoneCall } from "lucide-react";
import { CallCustomerButton } from "@/components/sip-phone";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";
import { EmbeddedPotentialCaseForm } from "./potential-case-form";
import { useModuleFieldPermissions } from "@/components/ui/permission-field";
import { PhoneNumberField } from "@/components/phone-number-field";

// Validation helpers
function validateSlovakNationalId(id: string): boolean {
  if (!id) return true;
  const cleaned = id.replace(/\//g, "");
  if (cleaned.length !== 9 && cleaned.length !== 10) return false;
  if (!/^\d+$/.test(cleaned)) return false;
  if (cleaned.length === 10) {
    return parseInt(cleaned, 10) % 11 === 0;
  }
  return true;
}

function validateCzechNationalId(id: string): boolean {
  return validateSlovakNationalId(id);
}

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
  // Tab Klientka - Personal info
  titleBefore: z.string().optional(),
  firstName: z.string().min(2, "Meno je povinne"),
  lastName: z.string().min(2, "Priezvisko je povinne"),
  maidenName: z.string().optional(),
  titleAfter: z.string().optional(),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  mobile2: z.string().optional(),
  otherContact: z.string().optional(),
  email: z.string().email("Nespravny format emailu"),
  email2: z.string().optional(),
  nationalId: z.string().optional(),
  idCardNumber: z.string().optional(),
  dateOfBirth: z.date().optional().nullable(),
  newsletter: z.boolean().default(false),
  
  // Tab Marketing
  complaintTypeId: z.string().optional(),
  cooperationTypeId: z.string().optional(),
  vipStatusId: z.string().optional(),
  
  // Tab Adresy - Permanent address
  country: z.string().min(1, "Krajina je povinna"),
  city: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  region: z.string().optional(),
  
  // Correspondence address
  useCorrespondenceAddress: z.boolean().default(false),
  corrName: z.string().optional(),
  corrAddress: z.string().optional(),
  corrCity: z.string().optional(),
  corrPostalCode: z.string().optional(),
  corrRegion: z.string().optional(),
  corrCountry: z.string().optional(),
  
  // Tab Ine - Banking & Health insurance
  bankAccount: z.string().optional().refine((val) => !val || validateIBAN(val), {
    message: "Nespravny format IBAN",
  }),
  bankCode: z.string().optional(),
  bankName: z.string().optional(),
  bankSwift: z.string().optional(),
  healthInsuranceId: z.string().optional(),
  
  // Status fields
  clientStatus: z.string().default("potential"),
  status: z.enum(["active", "pending", "inactive"]),
  serviceType: z.enum(["cord_blood", "cord_tissue", "both"]).optional(),
  notes: z.string().optional(),
});

export type CustomerFormData = z.infer<typeof customerFormSchema>;

interface CustomerFormProps {
  initialData?: Customer;
  onSubmit: (data: CustomerFormData) => void;
  isLoading?: boolean;
  onCancel: () => void;
}

export function CustomerForm({ initialData, onSubmit, isLoading, onCancel }: CustomerFormProps) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("klientka");
  
  // Field permissions for customers module
  const { isHidden, isReadonly } = useModuleFieldPermissions("customers");
  
  // Fetch configuration data
  const { toast } = useToast();
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: t.customers.fields.copiedToClipboard });
  };
  
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
      dateOfBirth: initialData?.dateOfBirth ? new Date(initialData.dateOfBirth) : undefined,
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

  const useCorrespondenceAddress = form.watch("useCorrespondenceAddress");
  const selectedCountry = form.watch("country");
  
  // Filter health insurance by selected country
  const filteredHealthInsurance = healthInsuranceCompanies.filter(
    hi => hi.countryCode === selectedCountry || !selectedCountry
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={`grid w-full ${initialData?.clientStatus === "acquired" ? "grid-cols-5" : "grid-cols-4"} gap-1`}>
            <TabsTrigger value="klientka" data-testid="tab-klientka">{t.customers.tabs.client}</TabsTrigger>
            <TabsTrigger value="adresy" data-testid="tab-adresy">{t.customers.tabs.addresses}</TabsTrigger>
            <TabsTrigger value="marketing" data-testid="tab-marketing">{t.customers.tabs.marketing}</TabsTrigger>
            <TabsTrigger value="ine" data-testid="tab-ine">{t.customers.tabs.other}</TabsTrigger>
            {initialData?.clientStatus === "acquired" && (
              <TabsTrigger value="case" data-testid="tab-case">Case</TabsTrigger>
            )}
          </TabsList>
          
          {/* Tab Klientka - Personal Info */}
          <TabsContent value="klientka" className="space-y-4 mt-4">
            <div className="grid gap-4 sm:grid-cols-3">
              {!isHidden("title_before") && (
                <FormField
                  control={form.control}
                  name="titleBefore"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.customers.fields.title}</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Ing., Mgr., ..." 
                          {...field} 
                          data-testid="input-title-before"
                          disabled={isReadonly("title_before")}
                          className={isReadonly("title_before") ? "bg-muted" : ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {!isHidden("first_name") && (
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.customers.firstName} *</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          data-testid="input-firstname" 
                          disabled={isReadonly("first_name")}
                          className={`font-bold ${isReadonly("first_name") ? "bg-muted" : ""}`}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {!isHidden("last_name") && (
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.customers.lastName} *</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          data-testid="input-lastname"
                          disabled={isReadonly("last_name")}
                          className={`font-bold ${isReadonly("last_name") ? "bg-muted" : ""}`}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
            
            <div className="grid gap-4 sm:grid-cols-3">
              {!isHidden("maiden_name") && (
                <FormField
                  control={form.control}
                  name="maidenName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.customers.fields.maidenName}</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          data-testid="input-maiden-name"
                          disabled={isReadonly("maiden_name")}
                          className={isReadonly("maiden_name") ? "bg-muted" : ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {!isHidden("title_after") && (
                <FormField
                  control={form.control}
                  name="titleAfter"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.customers.fields.titleAfter}</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="PhD., MBA, ..." 
                          {...field} 
                          data-testid="input-title-after"
                          disabled={isReadonly("title_after")}
                          className={isReadonly("title_after") ? "bg-muted" : ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => {
                  const currentDate = field.value || null;
                  const currentYear = currentDate ? currentDate.getFullYear() : undefined;
                  const currentMonth = currentDate ? currentDate.getMonth() : undefined;
                  const currentDay = currentDate ? currentDate.getDate() : undefined;
                  
                  const years = Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i);
                  const months = [
                    { value: 0, label: "1" },
                    { value: 1, label: "2" },
                    { value: 2, label: "3" },
                    { value: 3, label: "4" },
                    { value: 4, label: "5" },
                    { value: 5, label: "6" },
                    { value: 6, label: "7" },
                    { value: 7, label: "8" },
                    { value: 8, label: "9" },
                    { value: 9, label: "10" },
                    { value: 10, label: "11" },
                    { value: 11, label: "12" },
                  ];
                  
                  const getDaysInMonth = (year?: number, month?: number) => {
                    if (year === undefined || month === undefined) return 31;
                    return new Date(year, month + 1, 0).getDate();
                  };
                  
                  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
                  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
                  
                  const handleDateChange = (type: 'day' | 'month' | 'year', value: string) => {
                    const numValue = parseInt(value);
                    let newDate = currentDate ? new Date(currentDate) : new Date();
                    
                    if (type === 'year') {
                      newDate.setFullYear(numValue);
                    } else if (type === 'month') {
                      newDate.setMonth(numValue);
                      const maxDay = getDaysInMonth(newDate.getFullYear(), numValue);
                      if (newDate.getDate() > maxDay) {
                        newDate.setDate(maxDay);
                      }
                    } else if (type === 'day') {
                      newDate.setDate(numValue);
                    }
                    
                    field.onChange(newDate);
                  };
                  
                  return (
                    <FormItem className="flex flex-col">
                      <FormLabel>{t.customers.fields.dateOfBirth}</FormLabel>
                      <div className="flex gap-2">
                        <Select
                          value={currentDay?.toString() || ""}
                          onValueChange={(val) => handleDateChange('day', val)}
                        >
                          <SelectTrigger className="w-[80px]" data-testid="select-dob-day">
                            <SelectValue placeholder="Day" />
                          </SelectTrigger>
                          <SelectContent>
                            {days.map((day) => (
                              <SelectItem key={day} value={day.toString()}>
                                {day}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={currentMonth?.toString() || ""}
                          onValueChange={(val) => handleDateChange('month', val)}
                        >
                          <SelectTrigger className="w-[90px]" data-testid="select-dob-month">
                            <SelectValue placeholder="Month" />
                          </SelectTrigger>
                          <SelectContent>
                            {months.map((month) => (
                              <SelectItem key={month.value} value={month.value.toString()}>
                                {month.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={currentYear?.toString() || ""}
                          onValueChange={(val) => handleDateChange('year', val)}
                        >
                          <SelectTrigger className="w-[90px]" data-testid="select-dob-year">
                            <SelectValue placeholder="Year" />
                          </SelectTrigger>
                          <SelectContent>
                            {years.map((year) => (
                              <SelectItem key={year} value={year.toString()}>
                                {year}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {!isHidden("phone") && (
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.customers.phone}</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <PhoneNumberField 
                            value={field.value}
                            onChange={field.onChange}
                            defaultCountryCode={form.watch("country") || "SK"}
                            data-testid="input-phone"
                            disabled={isReadonly("phone")}
                          />
                        </FormControl>
                        {initialData?.id && field.value && (
                          <CallCustomerButton 
                            phoneNumber={field.value}
                            customerId={initialData.id}
                            customerName={`${initialData.firstName} ${initialData.lastName}`}
                            leadScore={initialData.leadScore}
                            clientStatus={initialData.clientStatus}
                            variant="icon"
                          />
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {!isHidden("mobile") && (
                <FormField
                  control={form.control}
                  name="mobile"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.customers.fields.mobile}</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <PhoneNumberField 
                            value={field.value}
                            onChange={field.onChange}
                            defaultCountryCode={form.watch("country") || "SK"}
                            data-testid="input-mobile"
                            disabled={isReadonly("mobile")}
                          />
                        </FormControl>
                        {initialData?.id && field.value && (
                          <CallCustomerButton 
                            phoneNumber={field.value}
                            customerId={initialData.id}
                            customerName={`${initialData.firstName} ${initialData.lastName}`}
                            leadScore={initialData.leadScore}
                            clientStatus={initialData.clientStatus}
                            variant="icon"
                          />
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {!isHidden("mobile_2") && (
                <FormField
                  control={form.control}
                  name="mobile2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.customers.fields.mobile2}</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <PhoneNumberField 
                            value={field.value}
                            onChange={field.onChange}
                            defaultCountryCode={form.watch("country") || "SK"}
                            data-testid="input-mobile2"
                            disabled={isReadonly("mobile_2")}
                          />
                        </FormControl>
                        {initialData?.id && field.value && (
                          <CallCustomerButton 
                            phoneNumber={field.value}
                            customerId={initialData.id}
                            customerName={`${initialData.firstName} ${initialData.lastName}`}
                            leadScore={initialData.leadScore}
                            clientStatus={initialData.clientStatus}
                            variant="icon"
                          />
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="otherContact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.customers.fields.otherContact}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-other-contact" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {!isHidden("email") && (
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.customers.email} *</FormLabel>
                      <FormControl>
                        <Input 
                          type="email" 
                          {...field} 
                          data-testid="input-customer-email"
                          disabled={isReadonly("email")}
                          className={isReadonly("email") ? "bg-muted" : ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {!isHidden("email_2") && (
                <FormField
                  control={form.control}
                  name="email2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.customers.fields.email2}</FormLabel>
                      <FormControl>
                        <Input 
                          type="email" 
                          {...field} 
                          data-testid="input-email2"
                          disabled={isReadonly("email_2")}
                          className={isReadonly("email_2") ? "bg-muted" : ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {!isHidden("national_id") && (
                <FormField
                  control={form.control}
                  name="nationalId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.customers.fields.nationalId}</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="xxxxxx/xxxx" 
                          {...field} 
                          data-testid="input-national-id"
                          disabled={isReadonly("national_id")}
                          className={isReadonly("national_id") ? "bg-muted" : ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {!isHidden("id_card_number") && (
                <FormField
                  control={form.control}
                  name="idCardNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.customers.fields.idCardNumber}</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          data-testid="input-id-card"
                          disabled={isReadonly("id_card_number")}
                          className={isReadonly("id_card_number") ? "bg-muted" : ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {!isHidden("newsletter") && (
              <FormField
                control={form.control}
                name="newsletter"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-newsletter"
                        disabled={isReadonly("newsletter")}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>{t.customers.fields.newsletter}</FormLabel>
                      <FormDescription>{t.customers.fields.newsletterDescription}</FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            )}

            {/* ID Fields (read-only, shown when editing) */}
            {initialData && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t.customers.fields.clientId}</label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={initialData.id}
                      readOnly
                      className="bg-muted cursor-not-allowed"
                      data-testid="input-client-id"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(initialData.id)}
                      data-testid="button-copy-client-id"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t.customers.fields.internalId}</label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={initialData.internalId || ""}
                      readOnly
                      className="bg-muted cursor-not-allowed"
                      placeholder="-"
                      data-testid="input-internal-id"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(initialData.internalId || "")}
                      disabled={!initialData.internalId}
                      data-testid="button-copy-internal-id"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {!isHidden("client_status") && (
                <FormField
                  control={form.control}
                  name="clientStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.customers.fields.clientStatus}</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                        disabled={isReadonly("client_status")}
                      >
                        <FormControl>
                          <SelectTrigger 
                            data-testid="select-client-status"
                            className={isReadonly("client_status") ? "bg-muted" : ""}
                          >
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
              )}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.customers.status}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-status">
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
                      <SelectTrigger data-testid="select-service-type">
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
          </TabsContent>

          {/* Tab Marketing */}
          <TabsContent value="marketing" className="space-y-4 mt-4">
            {!isHidden("complaint_type") && (
              <FormField
                control={form.control}
                name="complaintTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.customers.fields.complaintType}</FormLabel>
                    <Select 
                      onValueChange={(val) => field.onChange(val === "__none__" ? null : val)} 
                      defaultValue={field.value || "__none__"}
                      disabled={isReadonly("complaint_type")}
                    >
                      <FormControl>
                        <SelectTrigger 
                          data-testid="select-complaint-type"
                          className={isReadonly("complaint_type") ? "bg-muted" : ""}
                        >
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
            )}

            {!isHidden("cooperation_type") && (
              <FormField
                control={form.control}
                name="cooperationTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.customers.fields.cooperationType}</FormLabel>
                    <Select 
                      onValueChange={(val) => field.onChange(val === "__none__" ? null : val)} 
                      defaultValue={field.value || "__none__"}
                      disabled={isReadonly("cooperation_type")}
                    >
                      <FormControl>
                        <SelectTrigger 
                          data-testid="select-cooperation-type"
                          className={isReadonly("cooperation_type") ? "bg-muted" : ""}
                        >
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
            )}

            {!isHidden("vip_status") && (
              <FormField
                control={form.control}
                name="vipStatusId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.customers.fields.vipStatus}</FormLabel>
                    <Select 
                      onValueChange={(val) => field.onChange(val === "__none__" ? null : val)} 
                      defaultValue={field.value || "__none__"}
                      disabled={isReadonly("vip_status")}
                    >
                      <FormControl>
                        <SelectTrigger 
                          data-testid="select-vip-status"
                          className={isReadonly("vip_status") ? "bg-muted" : ""}
                        >
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">{t.customers.none}</SelectItem>
                        {vipStatuses.filter(s => s.isActive).map((status) => (
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
            )}
          </TabsContent>

          {/* Tab Adresy - Addresses */}
          <TabsContent value="adresy" className="space-y-4 mt-4">
            <h3 className="text-lg font-medium">{t.customers.fields.permanentAddress}</h3>
            
            <div className="grid gap-4 sm:grid-cols-2">
              {!isHidden("address") && (
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.customers.fields.street}</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          data-testid="input-address"
                          disabled={isReadonly("address")}
                          className={isReadonly("address") ? "bg-muted" : ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {!isHidden("city") && (
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.customers.city}</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          data-testid="input-city"
                          disabled={isReadonly("city")}
                          className={isReadonly("city") ? "bg-muted" : ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {!isHidden("postal_code") && (
                <FormField
                  control={form.control}
                  name="postalCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.customers.postalCode}</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          data-testid="input-postal-code"
                          disabled={isReadonly("postal_code")}
                          className={isReadonly("postal_code") ? "bg-muted" : ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {!isHidden("region") && (
                <FormField
                  control={form.control}
                  name="region"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.customers.fields.region}</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          data-testid="input-region"
                          disabled={isReadonly("region")}
                          className={isReadonly("region") ? "bg-muted" : ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {!isHidden("country") && (
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.customers.country} *</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                        disabled={isReadonly("country")}
                      >
                        <FormControl>
                          <SelectTrigger 
                            data-testid="select-country"
                            className={isReadonly("country") ? "bg-muted" : ""}
                          >
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {WORLD_COUNTRIES.map((country) => (
                            <SelectItem key={country.code} value={country.code}>
                              {country.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <FormField
              control={form.control}
              name="useCorrespondenceAddress"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 mt-6">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="checkbox-use-correspondence"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>{t.customers.fields.useCorrespondenceAddress}</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            {useCorrespondenceAddress && (
              <>
                <h3 className="text-lg font-medium mt-6">{t.customers.fields.correspondenceAddress}</h3>
                
                <FormField
                  control={form.control}
                  name="corrName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.customers.fields.recipientName}</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-corr-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="corrAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.customers.fields.street}</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-corr-address" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="corrCity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.customers.city}</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-corr-city" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="corrPostalCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.customers.postalCode}</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-corr-postal-code" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="corrRegion"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.customers.fields.region}</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-corr-region" />
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
                            <SelectTrigger data-testid="select-corr-country">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {WORLD_COUNTRIES.map((country) => (
                              <SelectItem key={country.code} value={country.code}>
                                {country.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}
          </TabsContent>

          {/* Tab Ine - Banking & Health Insurance */}
          <TabsContent value="ine" className="space-y-4 mt-4">
            <h3 className="text-lg font-medium">{t.customers.fields.bankDetails}</h3>
            
            <div className="grid gap-4 sm:grid-cols-2">
              {!isHidden("bank_account") && (
                <FormField
                  control={form.control}
                  name="bankAccount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.customers.fields.bankAccount}</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          data-testid="input-bank-account"
                          disabled={isReadonly("bank_account")}
                          className={isReadonly("bank_account") ? "bg-muted" : ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {!isHidden("bank_account") && (
                <FormField
                  control={form.control}
                  name="bankCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.customers.fields.bankCode}</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          data-testid="input-bank-code"
                          disabled={isReadonly("bank_account")}
                          className={isReadonly("bank_account") ? "bg-muted" : ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {!isHidden("bank_account") && (
                <FormField
                  control={form.control}
                  name="bankName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.customers.fields.bankName}</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          data-testid="input-bank-name"
                          disabled={isReadonly("bank_account")}
                          className={isReadonly("bank_account") ? "bg-muted" : ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {!isHidden("bank_account") && (
                <FormField
                  control={form.control}
                  name="bankSwift"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.customers.fields.swift}</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          data-testid="input-bank-swift"
                          disabled={isReadonly("bank_account")}
                          className={isReadonly("bank_account") ? "bg-muted" : ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {!isHidden("health_insurance") && (
              <>
                <h3 className="text-lg font-medium mt-6">{t.customers.fields.healthInsurance}</h3>
                
                <FormField
                  control={form.control}
                  name="healthInsuranceId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.customers.fields.healthInsurance}</FormLabel>
                      <Select 
                        onValueChange={(val) => field.onChange(val === "__none__" ? null : val)} 
                        defaultValue={field.value || "__none__"}
                        disabled={isReadonly("health_insurance")}
                      >
                        <FormControl>
                          <SelectTrigger 
                            data-testid="select-health-insurance"
                            className={isReadonly("health_insurance") ? "bg-muted" : ""}
                          >
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">{t.customers.none}</SelectItem>
                          {filteredHealthInsurance.filter(hi => hi.isActive).map((insurance) => (
                            <SelectItem key={insurance.id} value={insurance.id}>
                              {insurance.name} ({insurance.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {filteredHealthInsurance.length === 0 && selectedCountry && 
                          t.customers.fields.noInsuranceConfigured}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {!isHidden("notes") && (
              <>
                <h3 className="text-lg font-medium mt-6">{t.customers.fields.notesSection}</h3>
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.customers.notes}</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder={t.customers.fields.notesPlaceholder}
                          className={`resize-none ${isReadonly("notes") ? "bg-muted" : ""}`}
                          rows={3}
                          {...field} 
                          data-testid="textarea-notes"
                          disabled={isReadonly("notes")}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
          </TabsContent>

          {/* Tab Case - Potential Client Case data (only for acquired customers) */}
          {initialData?.clientStatus === "acquired" && initialData && (
            <TabsContent value="case" className="mt-4">
              <EmbeddedPotentialCaseForm customer={initialData} />
            </TabsContent>
          )}
        </Tabs>

        <div className="sticky bottom-0 left-0 right-0 z-[999] bg-background/95 backdrop-blur-sm border-t px-4 py-3 -mx-6 -mb-4 mt-4 flex justify-end gap-3 flex-wrap">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
            data-testid="button-cancel-customer"
          >
            {t.common.cancel}
          </Button>
          <Button 
            type="submit" 
            disabled={isLoading}
            data-testid="button-submit-customer"
          >
            {isLoading ? t.customers.fields.saving : initialData ? t.customers.fields.update : t.customers.fields.createClient}
          </Button>
        </div>
      </form>
    </Form>
  );
}
