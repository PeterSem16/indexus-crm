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
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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
  const [activeTab, setActiveTab] = useState("klientka");
  
  // Fetch configuration data
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
          <TabsList className="grid w-full grid-cols-4 gap-1">
            <TabsTrigger value="klientka" data-testid="tab-klientka">Klientka</TabsTrigger>
            <TabsTrigger value="marketing" data-testid="tab-marketing">Marketing</TabsTrigger>
            <TabsTrigger value="adresy" data-testid="tab-adresy">Adresy</TabsTrigger>
            <TabsTrigger value="ine" data-testid="tab-ine">Ine</TabsTrigger>
          </TabsList>
          
          {/* Tab Klientka - Personal Info */}
          <TabsContent value="klientka" className="space-y-4 mt-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="titleBefore"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titul pred menom</FormLabel>
                    <FormControl>
                      <Input placeholder="Ing., Mgr., ..." {...field} data-testid="input-title-before" />
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
                    <FormLabel>Krstne meno *</FormLabel>
                    <FormControl>
                      <Input placeholder="Jana" {...field} data-testid="input-firstname" />
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
                    <FormLabel>Priezvisko *</FormLabel>
                    <FormControl>
                      <Input placeholder="Novakova" {...field} data-testid="input-lastname" />
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
                    <FormLabel>Rodne meno</FormLabel>
                    <FormControl>
                      <Input placeholder="Rodne priezvisko" {...field} data-testid="input-maiden-name" />
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
                    <FormLabel>Titul za menom</FormLabel>
                    <FormControl>
                      <Input placeholder="PhD., MBA, ..." {...field} data-testid="input-title-after" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Datum narodenia</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                            data-testid="input-date-of-birth"
                          >
                            {field.value ? format(field.value, "dd.MM.yyyy") : "Vyberte datum"}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value || undefined}
                          onSelect={field.onChange}
                          disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefonne cislo</FormLabel>
                    <FormControl>
                      <Input placeholder="+421 2 1234 5678" {...field} data-testid="input-phone" />
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
                    <FormLabel>Mobil</FormLabel>
                    <FormControl>
                      <Input placeholder="+421 9xx xxx xxx" {...field} data-testid="input-mobile" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="mobile2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mobil 2</FormLabel>
                    <FormControl>
                      <Input placeholder="+421 9xx xxx xxx" {...field} data-testid="input-mobile2" />
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
                    <FormLabel>Iny kontakt</FormLabel>
                    <FormControl>
                      <Input placeholder="Iny kontakt" {...field} data-testid="input-other-contact" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="jana@email.sk" {...field} data-testid="input-customer-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email 2</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="druhy@email.sk" {...field} data-testid="input-email2" />
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
                    <FormLabel>Rodne cislo</FormLabel>
                    <FormControl>
                      <Input placeholder="xxxxxx/xxxx" {...field} data-testid="input-national-id" />
                    </FormControl>
                    <FormDescription>Format: xxxxxx/xxxx</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="idCardNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cislo obcianskeho preukazu</FormLabel>
                    <FormControl>
                      <Input placeholder="AB123456" {...field} data-testid="input-id-card" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Obeznik (newsletter)</FormLabel>
                    <FormDescription>Suhlasi s prijmanim marketingovych materialov</FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="clientStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status klienta</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-client-status">
                          <SelectValue placeholder="Vyberte status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CLIENT_STATUSES.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
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
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-status">
                          <SelectValue placeholder="Vyberte status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Aktivny</SelectItem>
                        <SelectItem value="pending">Cakajuci</SelectItem>
                        <SelectItem value="inactive">Neaktivny</SelectItem>
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
                  <FormLabel>Typ sluzby</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-service-type">
                        <SelectValue placeholder="Vyberte sluzbu" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="cord_blood">Pupocnikova krv</SelectItem>
                      <SelectItem value="cord_tissue">Pupocnikove tkanivo</SelectItem>
                      <SelectItem value="both">Obe</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>

          {/* Tab Marketing */}
          <TabsContent value="marketing" className="space-y-4 mt-4">
            <FormField
              control={form.control}
              name="complaintTypeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Staznosti</FormLabel>
                  <Select onValueChange={(val) => field.onChange(val === "__none__" ? null : val)} defaultValue={field.value || "__none__"}>
                    <FormControl>
                      <SelectTrigger data-testid="select-complaint-type">
                        <SelectValue placeholder="Vyberte typ staznosti" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Ziadna</SelectItem>
                      {complaintTypes.filter(t => t.isActive).map((type) => (
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
                  <FormLabel>Spolupraca</FormLabel>
                  <Select onValueChange={(val) => field.onChange(val === "__none__" ? null : val)} defaultValue={field.value || "__none__"}>
                    <FormControl>
                      <SelectTrigger data-testid="select-cooperation-type">
                        <SelectValue placeholder="Vyberte typ spoluprace" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Ziadna</SelectItem>
                      {cooperationTypes.filter(t => t.isActive).map((type) => (
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
                  <FormLabel>VIP Status</FormLabel>
                  <Select onValueChange={(val) => field.onChange(val === "__none__" ? null : val)} defaultValue={field.value || "__none__"}>
                    <FormControl>
                      <SelectTrigger data-testid="select-vip-status">
                        <SelectValue placeholder="Vyberte VIP status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Ziadny</SelectItem>
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
          </TabsContent>

          {/* Tab Adresy - Addresses */}
          <TabsContent value="adresy" className="space-y-4 mt-4">
            <h3 className="text-lg font-medium">Trvale bydlisko</h3>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ulica a cislo</FormLabel>
                    <FormControl>
                      <Input placeholder="Hlavna 123" {...field} data-testid="input-address" />
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
                    <FormLabel>Mesto</FormLabel>
                    <FormControl>
                      <Input placeholder="Bratislava" {...field} data-testid="input-city" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="postalCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PSC</FormLabel>
                    <FormControl>
                      <Input placeholder="811 01" {...field} data-testid="input-postal-code" />
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
                    <FormLabel>Oblast</FormLabel>
                    <FormControl>
                      <Input placeholder="Bratislavsky kraj" {...field} data-testid="input-region" />
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
                    <FormLabel>Krajina *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-country">
                          <SelectValue placeholder="Vyberte krajinu" />
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
                    <FormLabel>Pouzit inu adresu na korespondanciu</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            {useCorrespondenceAddress && (
              <>
                <h3 className="text-lg font-medium mt-6">Korespondencna adresa</h3>
                
                <FormField
                  control={form.control}
                  name="corrName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Meno</FormLabel>
                      <FormControl>
                        <Input placeholder="Meno prijemcu" {...field} data-testid="input-corr-name" />
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
                        <FormLabel>Ulica a cislo domu</FormLabel>
                        <FormControl>
                          <Input placeholder="Ulica 456" {...field} data-testid="input-corr-address" />
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
                        <FormLabel>Mesto</FormLabel>
                        <FormControl>
                          <Input placeholder="Kosice" {...field} data-testid="input-corr-city" />
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
                        <FormLabel>PSC</FormLabel>
                        <FormControl>
                          <Input placeholder="040 01" {...field} data-testid="input-corr-postal-code" />
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
                        <FormLabel>Oblast</FormLabel>
                        <FormControl>
                          <Input placeholder="Kosicky kraj" {...field} data-testid="input-corr-region" />
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
                        <FormLabel>Krajina</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-corr-country">
                              <SelectValue placeholder="Vyberte krajinu" />
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
            <h3 className="text-lg font-medium">Bankove udaje</h3>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="bankAccount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bankovy ucet (IBAN)</FormLabel>
                    <FormControl>
                      <Input placeholder="SK31 1200 0000 1987 4263 7541" {...field} data-testid="input-bank-account" />
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
                    <FormLabel>Kod banky</FormLabel>
                    <FormControl>
                      <Input placeholder="1200" {...field} data-testid="input-bank-code" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="bankName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Banka</FormLabel>
                    <FormControl>
                      <Input placeholder="Slovenska sporitelna" {...field} data-testid="input-bank-name" />
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
                    <FormLabel>SWIFT kod</FormLabel>
                    <FormControl>
                      <Input placeholder="GIBASKBX" {...field} data-testid="input-bank-swift" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <h3 className="text-lg font-medium mt-6">Zdravotna poistovna</h3>
            
            <FormField
              control={form.control}
              name="healthInsuranceId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Zdravotna poistovna</FormLabel>
                  <Select onValueChange={(val) => field.onChange(val === "__none__" ? null : val)} defaultValue={field.value || "__none__"}>
                    <FormControl>
                      <SelectTrigger data-testid="select-health-insurance">
                        <SelectValue placeholder="Vyberte poistovnu" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Ziadna</SelectItem>
                      {filteredHealthInsurance.filter(hi => hi.isActive).map((insurance) => (
                        <SelectItem key={insurance.id} value={insurance.id}>
                          {insurance.name} ({insurance.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {filteredHealthInsurance.length === 0 && selectedCountry && 
                      "Ziadne poistovne nakonfigurovane pre vybratú krajinu"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <h3 className="text-lg font-medium mt-6">Poznamky</h3>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Poznamky</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Dalsie poznamky o klientovi..."
                      className="resize-none"
                      rows={3}
                      {...field} 
                      data-testid="textarea-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
            data-testid="button-cancel-customer"
          >
            Zrusit
          </Button>
          <Button 
            type="submit" 
            disabled={isLoading}
            data-testid="button-submit-customer"
          >
            {isLoading ? "Uklada sa..." : initialData ? "Aktualizovat" : "Vytvorit klienta"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
