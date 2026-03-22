import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { COUNTRIES, WORLD_COUNTRIES } from "@shared/schema";
import { CLIENT_STATUSES } from "@shared/schema";
import type { Customer, ComplaintType, CooperationType, VipStatus, HealthInsurance } from "@shared/schema";
import { CalendarIcon, Copy, PhoneCall, User, MapPin, Briefcase, Building2, FileText, Globe, Heart, Baby, ChevronRight, CheckCircle2, Circle, Stethoscope } from "lucide-react";
import { CallCustomerButton } from "@/components/sip-phone";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";
import { EmbeddedPotentialCaseForm } from "./potential-case-form";
import { useModuleFieldPermissions } from "@/components/ui/permission-field";
import { PhoneNumberField } from "@/components/phone-number-field";

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
  titleBefore: z.string().optional(),
  firstName: z.string().min(2, "Meno je povinné"),
  lastName: z.string().min(2, "Priezvisko je povinné"),
  maidenName: z.string().optional(),
  titleAfter: z.string().optional(),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  mobile2: z.string().optional(),
  otherContact: z.string().optional(),
  email: z.string().email("Nesprávny formát emailu"),
  email2: z.string().optional(),
  nationalId: z.string().optional(),
  idCardNumber: z.string().optional(),
  dateOfBirth: z.date().optional().nullable(),
  newsletter: z.boolean().default(false),
  complaintTypeId: z.string().optional(),
  cooperationTypeId: z.string().optional(),
  vipStatusId: z.string().optional(),
  country: z.string().min(1, "Krajina je povinná"),
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
    message: "Nesprávny formát IBAN",
  }),
  bankCode: z.string().optional(),
  bankName: z.string().optional(),
  bankSwift: z.string().optional(),
  healthInsuranceId: z.string().optional(),
  clientStatus: z.string().default("potential"),
  status: z.enum(["active", "pending", "inactive"]),
  serviceType: z.enum(["cord_blood", "cord_tissue", "both"]).optional(),
  notes: z.string().optional(),
  gynecologistName: z.string().optional(),
  gynecologistPhone: z.string().optional(),
  gynecologistEmail: z.string().optional(),
  expectedDeliveryDate: z.date().optional().nullable(),
  registrationSource: z.string().optional(),
});

export type CustomerFormData = z.infer<typeof customerFormSchema>;

const PIPELINE_STAGES = [
  { key: "potential", label: "Potenciálny", color: "bg-blue-500", textColor: "text-blue-700 dark:text-blue-300", bgLight: "bg-blue-50 dark:bg-blue-950/30", borderColor: "border-blue-300 dark:border-blue-700" },
  { key: "acquired", label: "Získaný", color: "bg-emerald-500", textColor: "text-emerald-700 dark:text-emerald-300", bgLight: "bg-emerald-50 dark:bg-emerald-950/30", borderColor: "border-emerald-300 dark:border-emerald-700" },
  { key: "terminated", label: "Ukončený", color: "bg-red-500", textColor: "text-red-700 dark:text-red-300", bgLight: "bg-red-50 dark:bg-red-950/30", borderColor: "border-red-300 dark:border-red-700" },
];

const SECTIONS = [
  { id: "status", label: "Stav", icon: CheckCircle2 },
  { id: "personal", label: "Osobné údaje", icon: User },
  { id: "contact", label: "Kontakt", icon: PhoneCall },
  { id: "addresses", label: "Adresy", icon: MapPin },
  { id: "pregnancy", label: "Tehotenstvo", icon: Baby },
  { id: "marketing", label: "Marketing", icon: Briefcase },
  { id: "finance", label: "Financie", icon: Building2 },
  { id: "notes", label: "Poznámky", icon: FileText },
  { id: "case", label: "Case", icon: Heart },
];

function SectionHeader({ icon: Icon, title, badge }: { icon: any; title: string; badge?: any }) {
  return (
    <div className="flex items-center gap-2.5 pb-3 mb-4 border-b">
      <div className="p-1.5 rounded-md bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {badge}
    </div>
  );
}

function DateDropdowns({ form, fieldName, label }: { form: any; fieldName: string; label: string }) {
  const currentDate = form.watch(fieldName) || null;
  const currentYear = currentDate ? new Date(currentDate).getFullYear() : undefined;
  const currentMonth = currentDate ? new Date(currentDate).getMonth() : undefined;
  const currentDay = currentDate ? new Date(currentDate).getDate() : undefined;
  const years = Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i);
  const futureYears = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() + i + 1);
  const allYears = fieldName === "expectedDeliveryDate" ? [...futureYears.reverse(), ...years] : years;
  const months = Array.from({ length: 12 }, (_, i) => ({ value: i, label: (i + 1).toString() }));
  const getDaysInMonth = (year?: number, month?: number) => {
    if (year === undefined || month === undefined) return 31;
    return new Date(year, month + 1, 0).getDate();
  };
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const handleDateChange = (type: 'day' | 'month' | 'year', value: string) => {
    const numValue = parseInt(value);
    let newDate = currentDate ? new Date(currentDate) : new Date();
    if (type === 'year') newDate.setFullYear(numValue);
    else if (type === 'month') {
      newDate.setMonth(numValue);
      const maxDay = getDaysInMonth(newDate.getFullYear(), numValue);
      if (newDate.getDate() > maxDay) newDate.setDate(maxDay);
    } else if (type === 'day') newDate.setDate(numValue);
    form.setValue(fieldName, newDate);
  };

  return (
    <FormItem className="flex flex-col">
      <FormLabel>{label}</FormLabel>
      <div className="flex gap-1.5">
        <Select value={currentDay?.toString() || ""} onValueChange={(val) => handleDateChange('day', val)}>
          <SelectTrigger className="w-[65px]" data-testid={`select-${fieldName}-day`}><SelectValue placeholder="D" /></SelectTrigger>
          <SelectContent>{days.map((day: number) => (<SelectItem key={day} value={day.toString()}>{day}</SelectItem>))}</SelectContent>
        </Select>
        <Select value={currentMonth?.toString() || ""} onValueChange={(val) => handleDateChange('month', val)}>
          <SelectTrigger className="w-[65px]" data-testid={`select-${fieldName}-month`}><SelectValue placeholder="M" /></SelectTrigger>
          <SelectContent>{months.map((m: any) => (<SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>))}</SelectContent>
        </Select>
        <Select value={currentYear?.toString() || ""} onValueChange={(val) => handleDateChange('year', val)}>
          <SelectTrigger className="w-[80px]" data-testid={`select-${fieldName}-year`}><SelectValue placeholder="Y" /></SelectTrigger>
          <SelectContent>{allYears.map((y: number) => (<SelectItem key={y} value={y.toString()}>{y}</SelectItem>))}</SelectContent>
        </Select>
      </div>
    </FormItem>
  );
}

interface CustomerFormProps {
  initialData?: Customer;
  onSubmit: (data: CustomerFormData) => void;
  isLoading?: boolean;
  onCancel: () => void;
  useCardLayout?: boolean;
}

export function CustomerForm({ initialData, onSubmit, isLoading, onCancel, useCardLayout = false }: CustomerFormProps) {
  const { t } = useI18n();
  const [activeSection, setActiveSection] = useState("status");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { isHidden, isReadonly } = useModuleFieldPermissions("customers");
  const { toast } = useToast();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: t.customers.fields.copiedToClipboard });
  };

  const { data: complaintTypes = [] } = useQuery<ComplaintType[]>({ queryKey: ["/api/config/complaint-types"] });
  const { data: cooperationTypes = [] } = useQuery<CooperationType[]>({ queryKey: ["/api/config/cooperation-types"] });
  const { data: vipStatuses = [] } = useQuery<VipStatus[]>({ queryKey: ["/api/config/vip-statuses"] });
  const { data: healthInsuranceCompanies = [] } = useQuery<HealthInsurance[]>({ queryKey: ["/api/config/health-insurance"] });

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
      gynecologistName: (initialData as any)?.gynecologistName || "",
      gynecologistPhone: (initialData as any)?.gynecologistPhone || "",
      gynecologistEmail: (initialData as any)?.gynecologistEmail || "",
      expectedDeliveryDate: (initialData as any)?.expectedDeliveryDate ? new Date((initialData as any).expectedDeliveryDate) : undefined,
      registrationSource: (initialData as any)?.registrationSource || "",
    },
  });

  const useCorrespondenceAddress = form.watch("useCorrespondenceAddress");
  const selectedCountry = form.watch("country");
  const clientStatus = form.watch("clientStatus");
  const registrationSource = form.watch("registrationSource");

  const filteredHealthInsurance = healthInsuranceCompanies.filter(
    hi => hi.countryCode === selectedCountry || !selectedCountry
  );

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const el = document.getElementById(`section-${sectionId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const visibleSections = SECTIONS.filter(s => {
    if (s.id === "case") return initialData?.clientStatus === "acquired";
    return true;
  });

  const isWebFormRegistration = registrationSource === "web_form" || (initialData as any)?.registrationSource === "web_form";

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
        {isWebFormRegistration && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-b border-green-200 dark:border-green-800 shrink-0">
            <Globe className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-green-700 dark:text-green-300">Registrácia z webového formulára</span>
            {(initialData as any)?.registrationDate && (
              <span className="text-xs text-green-600/70 dark:text-green-400/70 ml-auto">
                {new Date((initialData as any).registrationDate).toLocaleDateString("sk-SK")}
              </span>
            )}
          </div>
        )}

        <div className="flex flex-1 min-h-0">
          <div className="w-44 border-r bg-muted/20 flex flex-col py-3 shrink-0 overflow-y-auto">
            {visibleSections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => scrollToSection(section.id)}
                  className={cn(
                    "flex items-center gap-2.5 px-4 py-2 text-sm transition-colors text-left",
                    activeSection === section.id
                      ? "bg-primary/10 text-primary font-medium border-r-2 border-primary"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                  data-testid={`nav-section-${section.id}`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{section.label}</span>
                </button>
              );
            })}
          </div>

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-5 space-y-8"
            onScroll={() => {
              if (!scrollRef.current) return;
              const container = scrollRef.current;
              const sections = visibleSections.map(s => ({
                id: s.id,
                el: document.getElementById(`section-${s.id}`)
              })).filter(s => s.el);
              for (let i = sections.length - 1; i >= 0; i--) {
                const rect = sections[i].el!.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();
                if (rect.top <= containerRect.top + 80) {
                  setActiveSection(sections[i].id);
                  break;
                }
              }
            }}
          >
            <div id="section-status">
              <SectionHeader icon={CheckCircle2} title="Stav klienta" />

              <div className="flex items-center gap-1 mb-5">
                {PIPELINE_STAGES.map((stage, idx) => {
                  const isActive = clientStatus === stage.key;
                  const stageIdx = PIPELINE_STAGES.findIndex(s => s.key === clientStatus);
                  const isPast = idx < stageIdx;
                  return (
                    <div key={stage.key} className="flex items-center flex-1">
                      <button
                        type="button"
                        onClick={() => form.setValue("clientStatus", stage.key)}
                        className={cn(
                          "flex-1 relative flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border-2 transition-all text-sm font-medium cursor-pointer",
                          isActive
                            ? `${stage.bgLight} ${stage.borderColor} ${stage.textColor} shadow-sm`
                            : isPast
                              ? "bg-muted/50 border-muted-foreground/20 text-muted-foreground"
                              : "bg-background border-border text-muted-foreground/60 hover:border-muted-foreground/40"
                        )}
                        data-testid={`pipeline-stage-${stage.key}`}
                      >
                        {isActive ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0" />
                        ) : isPast ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 opacity-50" />
                        ) : (
                          <Circle className="h-4 w-4 shrink-0 opacity-40" />
                        )}
                        {stage.label}
                      </button>
                      {idx < PIPELINE_STAGES.length - 1 && (
                        <ChevronRight className="h-4 w-4 text-muted-foreground/30 shrink-0 mx-0.5" />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.customers.status}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="active">{t.customers.active}</SelectItem>
                        <SelectItem value="pending">{t.customers.pending}</SelectItem>
                        <SelectItem value="inactive">{t.customers.inactive}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="serviceType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.customers.fields?.serviceType || "Typ služby"}</FormLabel>
                    <Select onValueChange={(val) => field.onChange(val === "__none__" ? null : val)} defaultValue={field.value || "__none__"}>
                      <FormControl><SelectTrigger data-testid="select-service-type"><SelectValue placeholder={t.customers.none} /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">{t.customers.none}</SelectItem>
                        <SelectItem value="cord_blood">{t.customers.serviceTypes?.cordBlood || "Pupočníková krv"}</SelectItem>
                        <SelectItem value="cord_tissue">{t.customers.serviceTypes?.cordTissue || "Pupočníkové tkanivo"}</SelectItem>
                        <SelectItem value="both">{t.customers.serviceTypes?.both || "Oboje"}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="registrationSource" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zdroj registrácie</FormLabel>
                    <Select onValueChange={(val) => field.onChange(val === "__none__" ? "" : val)} defaultValue={field.value || "__none__"}>
                      <FormControl><SelectTrigger data-testid="select-registration-source"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Neuvedené</SelectItem>
                        <SelectItem value="web_form">Webový formulár</SelectItem>
                        <SelectItem value="phone">Telefonicky</SelectItem>
                        <SelectItem value="email">Emailom</SelectItem>
                        <SelectItem value="in_person">Osobne</SelectItem>
                        <SelectItem value="referral">Odporúčanie</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                {!isHidden("newsletter") && (
                  <FormField control={form.control} name="newsletter" render={({ field }) => (
                    <FormItem className="flex flex-row items-end space-x-3 space-y-0 pb-1">
                      <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-newsletter" disabled={isReadonly("newsletter")} /></FormControl>
                      <div className="space-y-1 leading-none"><FormLabel className="text-sm">{t.customers.fields.newsletter}</FormLabel></div>
                    </FormItem>
                  )} />
                )}
              </div>

              {initialData && (
                <div className="mt-4 pt-3 border-t">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">{t.customers.fields.clientId}</label>
                      <div className="flex items-center gap-1">
                        <Input value={initialData.id} readOnly className="bg-muted cursor-not-allowed text-xs h-8" data-testid="input-client-id" />
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => copyToClipboard(initialData.id)} data-testid="button-copy-client-id"><Copy className="h-3 w-3" /></Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">{t.customers.fields.internalId}</label>
                      <div className="flex items-center gap-1">
                        <Input value={initialData.internalId || ""} readOnly className="bg-muted cursor-not-allowed text-xs h-8" placeholder="-" data-testid="input-internal-id" />
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => copyToClipboard(initialData.internalId || "")} disabled={!initialData.internalId} data-testid="button-copy-internal-id"><Copy className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div id="section-personal">
              <SectionHeader icon={User} title={t.customers.tabs.client} />
              <div className="grid grid-cols-2 gap-4">
                {!isHidden("first_name") && (
                  <FormField control={form.control} name="firstName" render={({ field }) => (
                    <FormItem><FormLabel>{t.customers.firstName} *</FormLabel><FormControl><Input {...field} data-testid="input-firstname" disabled={isReadonly("first_name")} className={`font-semibold ${isReadonly("first_name") ? "bg-muted" : ""}`} /></FormControl><FormMessage /></FormItem>
                  )} />
                )}
                {!isHidden("last_name") && (
                  <FormField control={form.control} name="lastName" render={({ field }) => (
                    <FormItem><FormLabel>{t.customers.lastName} *</FormLabel><FormControl><Input {...field} data-testid="input-lastname" disabled={isReadonly("last_name")} className={`font-semibold ${isReadonly("last_name") ? "bg-muted" : ""}`} /></FormControl><FormMessage /></FormItem>
                  )} />
                )}
                {!isHidden("title_before") && (
                  <FormField control={form.control} name="titleBefore" render={({ field }) => (
                    <FormItem><FormLabel>{t.customers.fields.title}</FormLabel><FormControl><Input placeholder="Ing., Mgr., ..." {...field} data-testid="input-title-before" disabled={isReadonly("title_before")} className={isReadonly("title_before") ? "bg-muted" : ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                )}
                {!isHidden("title_after") && (
                  <FormField control={form.control} name="titleAfter" render={({ field }) => (
                    <FormItem><FormLabel>{t.customers.fields.titleAfter}</FormLabel><FormControl><Input placeholder="PhD., MBA, ..." {...field} data-testid="input-title-after" disabled={isReadonly("title_after")} className={isReadonly("title_after") ? "bg-muted" : ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                )}
                {!isHidden("maiden_name") && (
                  <FormField control={form.control} name="maidenName" render={({ field }) => (
                    <FormItem><FormLabel>{t.customers.fields.maidenName}</FormLabel><FormControl><Input {...field} data-testid="input-maiden-name" disabled={isReadonly("maiden_name")} className={isReadonly("maiden_name") ? "bg-muted" : ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                )}
                <DateDropdowns form={form} fieldName="dateOfBirth" label={t.customers.fields.dateOfBirth} />
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4 pt-3 border-t">
                {!isHidden("national_id") && (
                  <FormField control={form.control} name="nationalId" render={({ field }) => (
                    <FormItem><FormLabel>{t.customers.fields.nationalId}</FormLabel><FormControl><Input placeholder="xxxxxx/xxxx" {...field} data-testid="input-national-id" disabled={isReadonly("national_id")} className={isReadonly("national_id") ? "bg-muted" : ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                )}
                {!isHidden("id_card_number") && (
                  <FormField control={form.control} name="idCardNumber" render={({ field }) => (
                    <FormItem><FormLabel>{t.customers.fields.idCardNumber}</FormLabel><FormControl><Input {...field} data-testid="input-id-card" disabled={isReadonly("id_card_number")} className={isReadonly("id_card_number") ? "bg-muted" : ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                )}
              </div>
            </div>

            <div id="section-contact">
              <SectionHeader icon={PhoneCall} title={`${t.customers.phone} & ${t.customers.email}`} />
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {!isHidden("phone") && (
                    <FormField control={form.control} name="phone" render={({ field }) => (
                      <FormItem><FormLabel>{t.customers.phone}</FormLabel>
                        <div className="flex gap-2"><FormControl><PhoneNumberField value={field.value} onChange={field.onChange} defaultCountryCode={form.watch("country") || "SK"} data-testid="input-phone" disabled={isReadonly("phone")} /></FormControl>
                          {initialData?.id && field.value && <CallCustomerButton phoneNumber={field.value} customerId={initialData.id} customerName={`${initialData.firstName} ${initialData.lastName}`} leadScore={initialData.leadScore} clientStatus={initialData.clientStatus} variant="icon" />}
                        </div><FormMessage />
                      </FormItem>
                    )} />
                  )}
                  {!isHidden("mobile") && (
                    <FormField control={form.control} name="mobile" render={({ field }) => (
                      <FormItem><FormLabel>{t.customers.fields.mobile}</FormLabel>
                        <div className="flex gap-2"><FormControl><PhoneNumberField value={field.value} onChange={field.onChange} defaultCountryCode={form.watch("country") || "SK"} data-testid="input-mobile" disabled={isReadonly("mobile")} /></FormControl>
                          {initialData?.id && field.value && <CallCustomerButton phoneNumber={field.value} customerId={initialData.id} customerName={`${initialData.firstName} ${initialData.lastName}`} leadScore={initialData.leadScore} clientStatus={initialData.clientStatus} variant="icon" />}
                        </div><FormMessage />
                      </FormItem>
                    )} />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {!isHidden("mobile_2") && (
                    <FormField control={form.control} name="mobile2" render={({ field }) => (
                      <FormItem><FormLabel>{t.customers.fields.mobile2}</FormLabel>
                        <div className="flex gap-2"><FormControl><PhoneNumberField value={field.value} onChange={field.onChange} defaultCountryCode={form.watch("country") || "SK"} data-testid="input-mobile2" disabled={isReadonly("mobile_2")} /></FormControl>
                          {initialData?.id && field.value && <CallCustomerButton phoneNumber={field.value} customerId={initialData.id} customerName={`${initialData.firstName} ${initialData.lastName}`} leadScore={initialData.leadScore} clientStatus={initialData.clientStatus} variant="icon" />}
                        </div><FormMessage />
                      </FormItem>
                    )} />
                  )}
                  <FormField control={form.control} name="otherContact" render={({ field }) => (
                    <FormItem><FormLabel>{t.customers.fields.otherContact}</FormLabel><FormControl><Input {...field} data-testid="input-other-contact" /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                  {!isHidden("email") && (
                    <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem><FormLabel>{t.customers.email} *</FormLabel><FormControl><Input type="email" {...field} data-testid="input-customer-email" disabled={isReadonly("email")} className={isReadonly("email") ? "bg-muted" : ""} /></FormControl><FormMessage /></FormItem>
                    )} />
                  )}
                  {!isHidden("email_2") && (
                    <FormField control={form.control} name="email2" render={({ field }) => (
                      <FormItem><FormLabel>{t.customers.fields.email2}</FormLabel><FormControl><Input type="email" {...field} data-testid="input-email2" disabled={isReadonly("email_2")} className={isReadonly("email_2") ? "bg-muted" : ""} /></FormControl><FormMessage /></FormItem>
                    )} />
                  )}
                </div>
              </div>
            </div>

            <div id="section-addresses">
              <SectionHeader icon={MapPin} title={t.customers.tabs.addresses} />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">{t.customers.fields.permanentAddress}</p>
              <div className="grid grid-cols-2 gap-4">
                {!isHidden("address") && (
                  <FormField control={form.control} name="address" render={({ field }) => (
                    <FormItem><FormLabel>{t.customers.fields.street}</FormLabel><FormControl><Input {...field} data-testid="input-address" disabled={isReadonly("address")} className={isReadonly("address") ? "bg-muted" : ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                )}
                {!isHidden("city") && (
                  <FormField control={form.control} name="city" render={({ field }) => (
                    <FormItem><FormLabel>{t.customers.city}</FormLabel><FormControl><Input {...field} data-testid="input-city" disabled={isReadonly("city")} className={isReadonly("city") ? "bg-muted" : ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                )}
                {!isHidden("postal_code") && (
                  <FormField control={form.control} name="postalCode" render={({ field }) => (
                    <FormItem><FormLabel>{t.customers.postalCode}</FormLabel><FormControl><Input {...field} data-testid="input-postal-code" disabled={isReadonly("postal_code")} className={isReadonly("postal_code") ? "bg-muted" : ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                )}
                {!isHidden("region") && (
                  <FormField control={form.control} name="region" render={({ field }) => (
                    <FormItem><FormLabel>{t.customers.fields.region}</FormLabel><FormControl><Input {...field} data-testid="input-region" disabled={isReadonly("region")} className={isReadonly("region") ? "bg-muted" : ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                )}
                {!isHidden("country") && (
                  <FormField control={form.control} name="country" render={({ field }) => (
                    <FormItem><FormLabel>{t.customers.country} *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isReadonly("country")}>
                        <FormControl><SelectTrigger data-testid="select-country" className={isReadonly("country") ? "bg-muted" : ""}><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>{WORLD_COUNTRIES.map((c) => (<SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>))}</SelectContent>
                      </Select><FormMessage />
                    </FormItem>
                  )} />
                )}
              </div>

              <FormField control={form.control} name="useCorrespondenceAddress" render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 mt-4">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-use-correspondence" /></FormControl>
                  <div className="space-y-1 leading-none"><FormLabel>{t.customers.fields.useCorrespondenceAddress}</FormLabel></div>
                </FormItem>
              )} />

              {useCorrespondenceAddress && (
                <div className="mt-4 pt-3 border-t space-y-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t.customers.fields.correspondenceAddress}</p>
                  <FormField control={form.control} name="corrName" render={({ field }) => (
                    <FormItem><FormLabel>{t.customers.fields.recipientName}</FormLabel><FormControl><Input {...field} data-testid="input-corr-name" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="corrAddress" render={({ field }) => (<FormItem><FormLabel>{t.customers.fields.street}</FormLabel><FormControl><Input {...field} data-testid="input-corr-address" /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="corrCity" render={({ field }) => (<FormItem><FormLabel>{t.customers.city}</FormLabel><FormControl><Input {...field} data-testid="input-corr-city" /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="corrPostalCode" render={({ field }) => (<FormItem><FormLabel>{t.customers.postalCode}</FormLabel><FormControl><Input {...field} data-testid="input-corr-postal-code" /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="corrRegion" render={({ field }) => (<FormItem><FormLabel>{t.customers.fields.region}</FormLabel><FormControl><Input {...field} data-testid="input-corr-region" /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="corrCountry" render={({ field }) => (
                      <FormItem><FormLabel>{t.customers.country}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger data-testid="select-corr-country"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>{WORLD_COUNTRIES.map((c) => (<SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>))}</SelectContent>
                        </Select><FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>
              )}
            </div>

            <div id="section-pregnancy">
              <SectionHeader
                icon={Baby}
                title="Tehotenstvo / Gynekológ"
                badge={
                  (initialData as any)?.gynecologistName || (initialData as any)?.expectedDeliveryDate ? (
                    <Badge variant="outline" className="bg-pink-50 dark:bg-pink-950/30 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800 text-xs">
                      <Stethoscope className="h-3 w-3 mr-1" />
                      Vyplnené
                    </Badge>
                  ) : null
                }
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="gynecologistName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gynekológ - meno</FormLabel>
                    <FormControl><Input placeholder="MUDr. ..." {...field} data-testid="input-gynecologist-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="gynecologistPhone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gynekológ - telefón</FormLabel>
                    <FormControl><PhoneNumberField value={field.value} onChange={field.onChange} defaultCountryCode={selectedCountry || "SK"} data-testid="input-gynecologist-phone" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="gynecologistEmail" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gynekológ - email</FormLabel>
                    <FormControl><Input type="email" placeholder="gynekololog@..." {...field} data-testid="input-gynecologist-email" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <DateDropdowns form={form} fieldName="expectedDeliveryDate" label="Predpokladaný dátum pôrodu" />
              </div>
            </div>

            <div id="section-marketing">
              <SectionHeader icon={Briefcase} title={t.customers.tabs.marketing} />
              <div className="grid grid-cols-2 gap-4">
                {!isHidden("complaint_type") && (
                  <FormField control={form.control} name="complaintTypeId" render={({ field }) => (
                    <FormItem><FormLabel>{t.customers.fields.complaintType}</FormLabel>
                      <Select onValueChange={(val) => field.onChange(val === "__none__" ? null : val)} defaultValue={field.value || "__none__"} disabled={isReadonly("complaint_type")}>
                        <FormControl><SelectTrigger data-testid="select-complaint-type" className={isReadonly("complaint_type") ? "bg-muted" : ""}><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">{t.customers.none}</SelectItem>
                          {complaintTypes.filter(ct => ct.isActive).map((type) => (<SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>))}
                        </SelectContent>
                      </Select><FormMessage />
                    </FormItem>
                  )} />
                )}
                {!isHidden("cooperation_type") && (
                  <FormField control={form.control} name="cooperationTypeId" render={({ field }) => (
                    <FormItem><FormLabel>{t.customers.fields.cooperationType}</FormLabel>
                      <Select onValueChange={(val) => field.onChange(val === "__none__" ? null : val)} defaultValue={field.value || "__none__"} disabled={isReadonly("cooperation_type")}>
                        <FormControl><SelectTrigger data-testid="select-cooperation-type" className={isReadonly("cooperation_type") ? "bg-muted" : ""}><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">{t.customers.none}</SelectItem>
                          {cooperationTypes.filter(ct => ct.isActive).map((type) => (<SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>))}
                        </SelectContent>
                      </Select><FormMessage />
                    </FormItem>
                  )} />
                )}
                {!isHidden("vip_status") && (
                  <FormField control={form.control} name="vipStatusId" render={({ field }) => (
                    <FormItem><FormLabel>{t.customers.fields.vipStatus}</FormLabel>
                      <Select onValueChange={(val) => field.onChange(val === "__none__" ? null : val)} defaultValue={field.value || "__none__"} disabled={isReadonly("vip_status")}>
                        <FormControl><SelectTrigger data-testid="select-vip-status" className={isReadonly("vip_status") ? "bg-muted" : ""}><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">{t.customers.none}</SelectItem>
                          {vipStatuses.filter(s => s.isActive).map((status) => (<SelectItem key={status.id} value={status.id}>{status.name}</SelectItem>))}
                        </SelectContent>
                      </Select><FormMessage />
                    </FormItem>
                  )} />
                )}
              </div>
            </div>

            <div id="section-finance">
              <SectionHeader icon={Building2} title="Financie" />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">{t.customers.fields.bankDetails}</p>
              <div className="grid grid-cols-2 gap-4">
                {!isHidden("bank_account") && (
                  <FormField control={form.control} name="bankAccount" render={({ field }) => (
                    <FormItem><FormLabel>{t.customers.fields.bankAccount}</FormLabel><FormControl><Input {...field} data-testid="input-bank-account" disabled={isReadonly("bank_account")} className={isReadonly("bank_account") ? "bg-muted" : ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                )}
                {!isHidden("bank_account") && (
                  <FormField control={form.control} name="bankCode" render={({ field }) => (
                    <FormItem><FormLabel>{t.customers.fields.bankCode}</FormLabel><FormControl><Input {...field} data-testid="input-bank-code" disabled={isReadonly("bank_account")} className={isReadonly("bank_account") ? "bg-muted" : ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                )}
                {!isHidden("bank_account") && (
                  <FormField control={form.control} name="bankName" render={({ field }) => (
                    <FormItem><FormLabel>{t.customers.fields.bankName}</FormLabel><FormControl><Input {...field} data-testid="input-bank-name" disabled={isReadonly("bank_account")} className={isReadonly("bank_account") ? "bg-muted" : ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                )}
                {!isHidden("bank_account") && (
                  <FormField control={form.control} name="bankSwift" render={({ field }) => (
                    <FormItem><FormLabel>{t.customers.fields.swift}</FormLabel><FormControl><Input {...field} data-testid="input-bank-swift" disabled={isReadonly("bank_account")} className={isReadonly("bank_account") ? "bg-muted" : ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                )}
              </div>

              {!isHidden("health_insurance") && (
                <div className="mt-4 pt-3 border-t">
                  <FormField control={form.control} name="healthInsuranceId" render={({ field }) => (
                    <FormItem><FormLabel>{t.customers.fields.healthInsurance}</FormLabel>
                      <Select onValueChange={(val) => field.onChange(val === "__none__" ? null : val)} defaultValue={field.value || "__none__"} disabled={isReadonly("health_insurance")}>
                        <FormControl><SelectTrigger data-testid="select-health-insurance" className={isReadonly("health_insurance") ? "bg-muted" : ""}><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">{t.customers.none}</SelectItem>
                          {filteredHealthInsurance.filter(hi => hi.isActive).map((insurance) => (<SelectItem key={insurance.id} value={insurance.id}>{insurance.name} ({insurance.code})</SelectItem>))}
                        </SelectContent>
                      </Select>
                      <FormDescription>{filteredHealthInsurance.length === 0 && selectedCountry && t.customers.fields.noInsuranceConfigured}</FormDescription><FormMessage />
                    </FormItem>
                  )} />
                </div>
              )}
            </div>

            <div id="section-notes">
              <SectionHeader icon={FileText} title="Poznámky" />
              {!isHidden("notes") && (
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem><FormLabel>{t.customers.notes}</FormLabel><FormControl><Textarea placeholder={t.customers.fields.notesPlaceholder} className={`resize-none ${isReadonly("notes") ? "bg-muted" : ""}`} rows={4} {...field} data-testid="textarea-notes" disabled={isReadonly("notes")} /></FormControl><FormMessage /></FormItem>
                )} />
              )}
            </div>

            {initialData?.clientStatus === "acquired" && initialData && (
              <div id="section-case">
                <SectionHeader icon={Heart} title="Case" />
                <EmbeddedPotentialCaseForm customer={initialData} />
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 bg-background/95 backdrop-blur-sm border-t px-5 py-3 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel-customer">
            {t.common.cancel}
          </Button>
          <Button type="submit" disabled={isLoading} data-testid="button-submit-customer">
            {isLoading ? t.customers.fields.saving : initialData ? t.customers.fields.update : t.customers.fields.createClient}
          </Button>
        </div>
      </form>
    </Form>
  );
}
