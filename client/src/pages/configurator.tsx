import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useI18n } from "@/i18n";
import { useCountryFilter } from "@/contexts/country-filter-context";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, FileText, Settings, Layout, Loader2, Palette } from "lucide-react";
import { COUNTRIES } from "@shared/schema";
import { InvoiceDesigner, InvoiceDesignerConfig } from "@/components/invoice-designer";
import type { ServiceConfiguration, InvoiceTemplate, InvoiceLayout } from "@shared/schema";

const serviceFormSchema = z.object({
  serviceCode: z.string().min(1, "Service code is required"),
  serviceName: z.string().min(1, "Service name is required"),
  description: z.string().optional(),
  countryCode: z.string().min(1, "Country is required"),
  isActive: z.boolean().default(true),
  basePrice: z.string().optional(),
  currency: z.string().default("EUR"),
  vatRate: z.string().optional(),
  processingDays: z.number().optional(),
  storageYears: z.number().optional(),
});

const templateFormSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  description: z.string().optional(),
  countryCode: z.string().min(1, "Country is required"),
  languageCode: z.string().default("en"),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  templateType: z.string().default("standard"),
  headerHtml: z.string().optional(),
  footerHtml: z.string().optional(),
  primaryColor: z.string().default("#6B2346"),
  showVat: z.boolean().default(true),
  showPaymentQr: z.boolean().default(false),
  paymentInstructions: z.string().optional(),
  legalText: z.string().optional(),
});

const layoutFormSchema = z.object({
  name: z.string().min(1, "Layout name is required"),
  countryCode: z.string().min(1, "Country is required"),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  paperSize: z.string().default("A4"),
  orientation: z.string().default("portrait"),
  marginTop: z.number().default(20),
  marginBottom: z.number().default(20),
  marginLeft: z.number().default(15),
  marginRight: z.number().default(15),
  fontSize: z.number().default(10),
  fontFamily: z.string().default("Arial"),
});

function ServiceConfigurationTab() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { selectedCountries } = useCountryFilter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceConfiguration | null>(null);

  const { data: services = [], isLoading } = useQuery<ServiceConfiguration[]>({
    queryKey: ["/api/configurator/services", selectedCountries.join(",")],
    queryFn: async () => {
      const params = selectedCountries.length > 0 ? `?countries=${selectedCountries.join(",")}` : "";
      const res = await fetch(`/api/configurator/services${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch services");
      return res.json();
    },
  });

  const form = useForm<z.infer<typeof serviceFormSchema>>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: {
      serviceCode: "",
      serviceName: "",
      description: "",
      countryCode: "",
      isActive: true,
      basePrice: "",
      currency: "EUR",
      vatRate: "",
      processingDays: undefined,
      storageYears: undefined,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: z.infer<typeof serviceFormSchema>) =>
      apiRequest("POST", "/api/configurator/services", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/configurator/services"] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: t.konfigurator.serviceCreated });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: z.infer<typeof serviceFormSchema> & { id: string }) =>
      apiRequest("PATCH", `/api/configurator/services/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/configurator/services"] });
      setIsDialogOpen(false);
      setEditingService(null);
      form.reset();
      toast({ title: t.konfigurator.serviceUpdated });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/configurator/services/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/configurator/services"] });
      toast({ title: t.konfigurator.serviceDeleted });
    },
  });

  const handleEdit = (service: ServiceConfiguration) => {
    setEditingService(service);
    form.reset({
      serviceCode: service.serviceCode,
      serviceName: service.serviceName,
      description: service.description || "",
      countryCode: service.countryCode,
      isActive: service.isActive,
      basePrice: service.basePrice || "",
      currency: service.currency,
      vatRate: service.vatRate || "",
      processingDays: service.processingDays || undefined,
      storageYears: service.storageYears || undefined,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (data: z.infer<typeof serviceFormSchema>) => {
    if (editingService) {
      updateMutation.mutate({ ...data, id: editingService.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const columns = [
    { 
      key: "serviceCode", 
      header: t.konfigurator.serviceCode,
      cell: (service: ServiceConfiguration) => service.serviceCode
    },
    { 
      key: "serviceName", 
      header: t.konfigurator.serviceName,
      cell: (service: ServiceConfiguration) => service.serviceName
    },
    { 
      key: "countryCode", 
      header: t.common.country,
      cell: (service: ServiceConfiguration) => service.countryCode
    },
    { 
      key: "basePrice", 
      header: t.konfigurator.basePrice,
      cell: (service: ServiceConfiguration) => 
        service.basePrice ? `${service.basePrice} ${service.currency}` : "-"
    },
    { 
      key: "isActive", 
      header: t.common.status,
      cell: (service: ServiceConfiguration) => (
        <Badge variant={service.isActive ? "default" : "secondary"}>
          {service.isActive ? t.common.active : t.common.inactive}
        </Badge>
      )
    },
    {
      key: "actions",
      header: t.common.actions,
      cell: (service: ServiceConfiguration) => (
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" onClick={() => handleEdit(service)} data-testid={`button-edit-service-${service.id}`}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(service.id)} data-testid={`button-delete-service-${service.id}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-muted-foreground">{t.konfigurator.servicesDescription}</p>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingService(null);
            form.reset();
          }
        }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-service">
              <Plus className="mr-2 h-4 w-4" />
              {t.konfigurator.addService}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingService ? t.konfigurator.editService : t.konfigurator.addService}</DialogTitle>
              <DialogDescription>{t.konfigurator.serviceFormDescription}</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="serviceCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.konfigurator.serviceCode}</FormLabel>
                        <FormControl>
                          <Input placeholder="CORD_BLOOD" {...field} data-testid="input-service-code" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="serviceName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.konfigurator.serviceName}</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-service-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.konfigurator.description}</FormLabel>
                      <FormControl>
                        <Textarea {...field} data-testid="input-service-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="countryCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.common.country}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-service-country">
                              <SelectValue placeholder={t.common.select} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {COUNTRIES.map((country) => (
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
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>{t.common.active}</FormLabel>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-service-active" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="basePrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.konfigurator.basePrice}</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} data-testid="input-service-price" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.konfigurator.currency}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-service-currency">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="CZK">CZK</SelectItem>
                            <SelectItem value="HUF">HUF</SelectItem>
                            <SelectItem value="RON">RON</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="vatRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.konfigurator.vatRate}</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="20" {...field} data-testid="input-service-vat" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="processingDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.konfigurator.processingDays}</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)} data-testid="input-processing-days" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="storageYears"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.konfigurator.storageYears}</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)} data-testid="input-storage-years" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    {t.common.cancel}
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-service">
                    {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t.common.save}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      <DataTable 
        columns={columns} 
        data={services} 
        getRowKey={(service) => service.id}
      />
    </div>
  );
}

function InvoiceTemplatesTab() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { selectedCountries } = useCountryFilter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<InvoiceTemplate | null>(null);

  const { data: templates = [], isLoading } = useQuery<InvoiceTemplate[]>({
    queryKey: ["/api/configurator/invoice-templates", selectedCountries.join(",")],
    queryFn: async () => {
      const params = selectedCountries.length > 0 ? `?countries=${selectedCountries.join(",")}` : "";
      const res = await fetch(`/api/configurator/invoice-templates${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch templates");
      return res.json();
    },
  });

  const form = useForm<z.infer<typeof templateFormSchema>>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: "",
      description: "",
      countryCode: "",
      languageCode: "en",
      isDefault: false,
      isActive: true,
      templateType: "standard",
      headerHtml: "",
      footerHtml: "",
      primaryColor: "#6B2346",
      showVat: true,
      showPaymentQr: false,
      paymentInstructions: "",
      legalText: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: z.infer<typeof templateFormSchema>) =>
      apiRequest("POST", "/api/configurator/invoice-templates", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/configurator/invoice-templates"] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: t.konfigurator.templateCreated });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: z.infer<typeof templateFormSchema> & { id: string }) =>
      apiRequest("PATCH", `/api/configurator/invoice-templates/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/configurator/invoice-templates"] });
      setIsDialogOpen(false);
      setEditingTemplate(null);
      form.reset();
      toast({ title: t.konfigurator.templateUpdated });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/configurator/invoice-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/configurator/invoice-templates"] });
      toast({ title: t.konfigurator.templateDeleted });
    },
  });

  const handleEdit = (template: InvoiceTemplate) => {
    setEditingTemplate(template);
    form.reset({
      name: template.name,
      description: template.description || "",
      countryCode: template.countryCode,
      languageCode: template.languageCode,
      isDefault: template.isDefault,
      isActive: template.isActive,
      templateType: template.templateType,
      headerHtml: template.headerHtml || "",
      footerHtml: template.footerHtml || "",
      primaryColor: template.primaryColor || "#6B2346",
      showVat: template.showVat,
      showPaymentQr: template.showPaymentQr,
      paymentInstructions: template.paymentInstructions || "",
      legalText: template.legalText || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (data: z.infer<typeof templateFormSchema>) => {
    if (editingTemplate) {
      updateMutation.mutate({ ...data, id: editingTemplate.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const columns = [
    { 
      key: "name", 
      header: t.common.name,
      cell: (template: InvoiceTemplate) => template.name
    },
    { 
      key: "countryCode", 
      header: t.common.country,
      cell: (template: InvoiceTemplate) => template.countryCode
    },
    { 
      key: "templateType", 
      header: t.konfigurator.templateType,
      cell: (template: InvoiceTemplate) => template.templateType
    },
    { 
      key: "isDefault", 
      header: t.konfigurator.default,
      cell: (template: InvoiceTemplate) => template.isDefault ? <Badge>{t.konfigurator.default}</Badge> : null
    },
    { 
      key: "isActive", 
      header: t.common.status,
      cell: (template: InvoiceTemplate) => (
        <Badge variant={template.isActive ? "default" : "secondary"}>
          {template.isActive ? t.common.active : t.common.inactive}
        </Badge>
      )
    },
    {
      key: "actions",
      header: t.common.actions,
      cell: (template: InvoiceTemplate) => (
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" onClick={() => handleEdit(template)} data-testid={`button-edit-template-${template.id}`}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(template.id)} data-testid={`button-delete-template-${template.id}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-muted-foreground">{t.konfigurator.templatesDescription}</p>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingTemplate(null);
            form.reset();
          }
        }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-template">
              <Plus className="mr-2 h-4 w-4" />
              {t.konfigurator.addTemplate}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? t.konfigurator.editTemplate : t.konfigurator.addTemplate}</DialogTitle>
              <DialogDescription>{t.konfigurator.templateFormDescription}</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.common.name}</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-template-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="templateType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.konfigurator.templateType}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-template-type">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="standard">{t.konfigurator.standard}</SelectItem>
                            <SelectItem value="proforma">{t.konfigurator.proforma}</SelectItem>
                            <SelectItem value="credit_note">{t.konfigurator.creditNote}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.konfigurator.description}</FormLabel>
                      <FormControl>
                        <Textarea {...field} data-testid="input-template-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="countryCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.common.country}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-template-country">
                              <SelectValue placeholder={t.common.select} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {COUNTRIES.map((country) => (
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
                  <FormField
                    control={form.control}
                    name="languageCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.konfigurator.language}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-template-language">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="sk">Slovak</SelectItem>
                            <SelectItem value="cs">Czech</SelectItem>
                            <SelectItem value="hu">Hungarian</SelectItem>
                            <SelectItem value="ro">Romanian</SelectItem>
                            <SelectItem value="it">Italian</SelectItem>
                            <SelectItem value="de">German</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <FormLabel>{t.common.active}</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-template-active" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="isDefault"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <FormLabel>{t.konfigurator.default}</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-template-default" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="showVat"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <FormLabel>{t.konfigurator.showVat}</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-template-vat" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="primaryColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.konfigurator.primaryColor}</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <Input type="color" {...field} className="w-16 h-9 p-1" data-testid="input-template-color" />
                          <Input {...field} className="flex-1" data-testid="input-template-color-hex" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paymentInstructions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.konfigurator.paymentInstructions}</FormLabel>
                      <FormControl>
                        <Textarea {...field} data-testid="input-payment-instructions" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="legalText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.konfigurator.legalText}</FormLabel>
                      <FormControl>
                        <Textarea {...field} data-testid="input-legal-text" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    {t.common.cancel}
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-template">
                    {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t.common.save}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      <DataTable 
        columns={columns} 
        data={templates} 
        getRowKey={(template) => template.id}
      />
    </div>
  );
}

function InvoiceEditorTab() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { selectedCountries } = useCountryFilter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLayout, setEditingLayout] = useState<InvoiceLayout | null>(null);
  const [designingLayout, setDesigningLayout] = useState<InvoiceLayout | null>(null);

  const { data: layouts = [], isLoading } = useQuery<InvoiceLayout[]>({
    queryKey: ["/api/configurator/invoice-layouts", selectedCountries.join(",")],
    queryFn: async () => {
      const params = selectedCountries.length > 0 ? `?countries=${selectedCountries.join(",")}` : "";
      const res = await fetch(`/api/configurator/invoice-layouts${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch layouts");
      return res.json();
    },
  });

  const form = useForm<z.infer<typeof layoutFormSchema>>({
    resolver: zodResolver(layoutFormSchema),
    defaultValues: {
      name: "",
      countryCode: "",
      isDefault: false,
      isActive: true,
      paperSize: "A4",
      orientation: "portrait",
      marginTop: 20,
      marginBottom: 20,
      marginLeft: 15,
      marginRight: 15,
      fontSize: 10,
      fontFamily: "Arial",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: z.infer<typeof layoutFormSchema>) =>
      apiRequest("POST", "/api/configurator/invoice-layouts", { ...data, layoutConfig: "{}" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/configurator/invoice-layouts"] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: t.konfigurator.layoutCreated });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: z.infer<typeof layoutFormSchema> & { id: string }) =>
      apiRequest("PATCH", `/api/configurator/invoice-layouts/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/configurator/invoice-layouts"] });
      setIsDialogOpen(false);
      setEditingLayout(null);
      form.reset();
      toast({ title: t.konfigurator.layoutUpdated });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/configurator/invoice-layouts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/configurator/invoice-layouts"] });
      toast({ title: t.konfigurator.layoutDeleted });
    },
  });

  const saveDesignMutation = useMutation({
    mutationFn: (data: { id: string; layoutConfig: string }) =>
      apiRequest("PATCH", `/api/configurator/invoice-layouts/${data.id}`, { layoutConfig: data.layoutConfig }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/configurator/invoice-layouts"] });
      setDesigningLayout(null);
      toast({ title: t.konfigurator.layoutUpdated });
    },
  });

  const handleDesign = (layout: InvoiceLayout) => {
    setDesigningLayout(layout);
  };

  const handleSaveDesign = (config: InvoiceDesignerConfig) => {
    if (designingLayout) {
      saveDesignMutation.mutate({
        id: designingLayout.id,
        layoutConfig: JSON.stringify(config),
      });
    }
  };

  const handleEdit = (layout: InvoiceLayout) => {
    setEditingLayout(layout);
    form.reset({
      name: layout.name,
      countryCode: layout.countryCode,
      isDefault: layout.isDefault,
      isActive: layout.isActive,
      paperSize: layout.paperSize,
      orientation: layout.orientation,
      marginTop: layout.marginTop || 20,
      marginBottom: layout.marginBottom || 20,
      marginLeft: layout.marginLeft || 15,
      marginRight: layout.marginRight || 15,
      fontSize: layout.fontSize || 10,
      fontFamily: layout.fontFamily || "Arial",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (data: z.infer<typeof layoutFormSchema>) => {
    if (editingLayout) {
      updateMutation.mutate({ ...data, id: editingLayout.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const columns = [
    { 
      key: "name", 
      header: t.common.name,
      cell: (layout: InvoiceLayout) => layout.name
    },
    { 
      key: "countryCode", 
      header: t.common.country,
      cell: (layout: InvoiceLayout) => layout.countryCode
    },
    { 
      key: "paperSize", 
      header: t.konfigurator.paperSize,
      cell: (layout: InvoiceLayout) => layout.paperSize
    },
    { 
      key: "orientation", 
      header: t.konfigurator.orientation,
      cell: (layout: InvoiceLayout) => layout.orientation
    },
    { 
      key: "isDefault", 
      header: t.konfigurator.default,
      cell: (layout: InvoiceLayout) => layout.isDefault ? <Badge>{t.konfigurator.default}</Badge> : null
    },
    { 
      key: "isActive", 
      header: t.common.status,
      cell: (layout: InvoiceLayout) => (
        <Badge variant={layout.isActive ? "default" : "secondary"}>
          {layout.isActive ? t.common.active : t.common.inactive}
        </Badge>
      )
    },
    {
      key: "actions",
      header: t.common.actions,
      cell: (layout: InvoiceLayout) => (
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" onClick={() => handleDesign(layout)} data-testid={`button-design-layout-${layout.id}`} title={t.konfigurator.designInvoice}>
            <Palette className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => handleEdit(layout)} data-testid={`button-edit-layout-${layout.id}`}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(layout.id)} data-testid={`button-delete-layout-${layout.id}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (designingLayout) {
    const initialConfig: InvoiceDesignerConfig | undefined = designingLayout.layoutConfig 
      ? (() => {
          try {
            return JSON.parse(designingLayout.layoutConfig);
          } catch {
            return undefined;
          }
        })()
      : undefined;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold">{t.konfigurator.designInvoice}: {designingLayout.name}</h3>
        </div>
        <InvoiceDesigner
          initialConfig={initialConfig}
          onSave={handleSaveDesign}
          onCancel={() => setDesigningLayout(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-muted-foreground">{t.konfigurator.layoutsDescription}</p>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingLayout(null);
            form.reset();
          }
        }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-layout">
              <Plus className="mr-2 h-4 w-4" />
              {t.konfigurator.addLayout}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingLayout ? t.konfigurator.editLayout : t.konfigurator.addLayout}</DialogTitle>
              <DialogDescription>{t.konfigurator.layoutFormDescription}</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.common.name}</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-layout-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="countryCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.common.country}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-layout-country">
                              <SelectValue placeholder={t.common.select} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {COUNTRIES.map((country) => (
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
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="paperSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.konfigurator.paperSize}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-paper-size">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="A4">A4</SelectItem>
                            <SelectItem value="A5">A5</SelectItem>
                            <SelectItem value="Letter">Letter</SelectItem>
                            <SelectItem value="Legal">Legal</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="orientation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.konfigurator.orientation}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-orientation">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="portrait">{t.konfigurator.portrait}</SelectItem>
                            <SelectItem value="landscape">{t.konfigurator.landscape}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="marginTop"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.konfigurator.marginTop}</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} data-testid="input-margin-top" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="marginBottom"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.konfigurator.marginBottom}</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} data-testid="input-margin-bottom" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="marginLeft"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.konfigurator.marginLeft}</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} data-testid="input-margin-left" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="marginRight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.konfigurator.marginRight}</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} data-testid="input-margin-right" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fontSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.konfigurator.fontSize}</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 10)} data-testid="input-font-size" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fontFamily"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.konfigurator.fontFamily}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-font-family">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Arial">Arial</SelectItem>
                            <SelectItem value="Helvetica">Helvetica</SelectItem>
                            <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                            <SelectItem value="Courier New">Courier New</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <FormLabel>{t.common.active}</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-layout-active" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="isDefault"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <FormLabel>{t.konfigurator.default}</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-layout-default" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    {t.common.cancel}
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-layout">
                    {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t.common.save}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      <DataTable 
        columns={columns} 
        data={layouts} 
        getRowKey={(layout) => layout.id}
      />
    </div>
  );
}

export default function ConfiguratorPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.konfigurator.title}
        description={t.konfigurator.description}
      />
      
      <Tabs defaultValue="services" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-xl">
          <TabsTrigger value="services" className="flex items-center gap-2" data-testid="tab-services">
            <Settings className="h-4 w-4" />
            {t.konfigurator.services}
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2" data-testid="tab-templates">
            <FileText className="h-4 w-4" />
            {t.konfigurator.invoiceTemplates}
          </TabsTrigger>
          <TabsTrigger value="editor" className="flex items-center gap-2" data-testid="tab-editor">
            <Layout className="h-4 w-4" />
            {t.konfigurator.invoiceEditor}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="services">
          <Card>
            <CardHeader>
              <CardTitle>{t.konfigurator.services}</CardTitle>
              <CardDescription>{t.konfigurator.servicesDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <ServiceConfigurationTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle>{t.konfigurator.invoiceTemplates}</CardTitle>
              <CardDescription>{t.konfigurator.templatesDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <InvoiceTemplatesTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="editor">
          <Card>
            <CardHeader>
              <CardTitle>{t.konfigurator.invoiceEditor}</CardTitle>
              <CardDescription>{t.konfigurator.layoutsDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <InvoiceEditorTab />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
