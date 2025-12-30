import { useState, useEffect } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, FileText, Settings, Layout, Loader2, Palette, Package, Search, Shield, Copy, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Eye, EyeOff, Lock, Unlock, Check, Hash } from "lucide-react";
import { COUNTRIES } from "@shared/schema";
import { InvoiceDesigner, InvoiceDesignerConfig } from "@/components/invoice-designer";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth-context";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { ServiceConfiguration, ServiceInstance, InvoiceTemplate, InvoiceLayout, Product, Role, RoleModulePermission, RoleFieldPermission, Department, BillingDetails, NumberRange } from "@shared/schema";
import { CRM_MODULES, DEPARTMENTS, type ModuleDefinition, type FieldPermission, type ModuleAccess } from "@shared/permissions-config";
import { Building2, User, Mail, Phone } from "lucide-react";
import { DepartmentTree } from "@/components/department-tree";

const serviceFormSchema = z.object({
  serviceCode: z.string().min(1, "Service code is required"),
  serviceName: z.string().min(1, "Service name is required"),
  description: z.string().optional(),
  countryCode: z.string().min(1, "Country is required"),
  isActive: z.boolean().default(true),
  invoiceable: z.boolean().default(false),
  collectable: z.boolean().default(false),
  storable: z.boolean().default(false),
  basePrice: z.string().optional(),
  currency: z.string().default("EUR"),
  vatRate: z.string().optional(),
  processingDays: z.number().optional(),
  storageYears: z.number().optional(),
});

const serviceInstanceFormSchema = z.object({
  serviceId: z.string(),
  name: z.string().min(1, "Name is required"),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  invoiceIdentifier: z.string().optional(),
  isActive: z.boolean().default(true),
  certificateTemplate: z.string().optional(),
  description: z.string().optional(),
  billingDetailsId: z.string().optional(),
  allowProformaInvoices: z.boolean().default(false),
  invoicingPeriodYears: z.number().min(1).max(100).optional(),
  constantSymbol: z.string().optional(),
  startInvoicingField: z.string().default("REALIZED"),
  endInvoicingField: z.string().optional(),
  accountingIdOffset: z.number().optional(),
  ledgerAccountProforma: z.string().optional(),
  ledgerAccountInvoice: z.string().optional(),
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

const numberRangeFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  countryCode: z.string().min(1, "Country is required"),
  billingDetailsId: z.string().optional(),
  year: z.number().min(1990).max(2100),
  useServiceCode: z.boolean().default(false),
  type: z.enum(["invoice", "proforma"]).default("invoice"),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  digitsToGenerate: z.number().min(1).max(20).default(6),
  startNumber: z.number().min(1).default(1),
  endNumber: z.number().min(1).default(999999),
  lastNumberUsed: z.number().default(0),
  accountingCode: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

const productFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  price: z.string().min(1, "Price is required"),
  currency: z.string().default("EUR"),
  category: z.string().optional(),
  countries: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

type ProductFormData = z.infer<typeof productFormSchema>;

const getCategoriesWithTranslations = (t: any) => [
  { value: "cord_blood", label: t.products.categories.cordBlood },
  { value: "cord_tissue", label: t.products.categories.cordTissue },
  { value: "storage", label: t.products.categories.storage },
  { value: "processing", label: t.products.categories.processing },
  { value: "testing", label: t.products.categories.testing },
  { value: "other", label: t.products.categories.other },
];

const CURRENCIES = ["EUR", "USD", "CZK", "HUF", "RON"];

function ProductsTab() {
  const { toast } = useToast();
  const { t } = useI18n();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  const userCountryCodes = user?.assignedCountries && user.assignedCountries.length > 0 ? user.assignedCountries : null;

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const userProducts = userCountryCodes
    ? products.filter(product => {
        if (!product.countries || product.countries.length === 0) return true;
        return product.countries.some(c => userCountryCodes.includes(c));
      })
    : products;

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      description: "",
      price: "",
      currency: "EUR",
      category: "",
      countries: [],
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: ProductFormData) => apiRequest("POST", "/api/products", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setIsFormOpen(false);
      form.reset();
      toast({ title: t.success.created });
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: ProductFormData & { id: string }) =>
      apiRequest("PATCH", `/api/products/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setEditingProduct(null);
      form.reset();
      toast({ title: t.success.updated });
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setDeletingProduct(null);
      toast({ title: t.success.deleted });
    },
    onError: () => {
      toast({ title: t.errors.deleteFailed, variant: "destructive" });
    },
  });

  const filteredProducts = userProducts.filter(product =>
    product.name.toLowerCase().includes(search.toLowerCase()) ||
    (product.description?.toLowerCase().includes(search.toLowerCase()))
  );

  const getCategoryLabel = (category: string | null) => {
    if (!category) return t.products.categories.other;
    const categories = getCategoriesWithTranslations(t);
    return categories.find(c => c.value === category)?.label || category;
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    form.reset({
      name: product.name,
      description: product.description || "",
      price: product.price,
      currency: product.currency,
      category: product.category || "",
      countries: product.countries || [],
      isActive: product.isActive,
    });
  };

  const columns = [
    {
      key: "product",
      header: t.products.productName,
      cell: (product: Product) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium">{product.name}</p>
            <p className="text-sm text-muted-foreground line-clamp-1">
              {product.description || t.common.noData}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: t.products.category,
      cell: (product: Product) => (
        <Badge variant="outline" className="capitalize">
          {getCategoryLabel(product.category)}
        </Badge>
      ),
    },
    {
      key: "countries",
      header: t.common.country,
      cell: (product: Product) => (
        <div className="flex flex-wrap gap-1">
          {product.countries && product.countries.length > 0 ? (
            product.countries.slice(0, 3).map((code) => (
              <Badge key={code} variant="secondary" className="text-xs">{code}</Badge>
            ))
          ) : (
            <span className="text-muted-foreground text-sm">{t.common.allCountries}</span>
          )}
          {product.countries && product.countries.length > 3 && (
            <Badge variant="secondary" className="text-xs">+{product.countries.length - 3}</Badge>
          )}
        </div>
      ),
    },
    {
      key: "price",
      header: t.products.price,
      cell: (product: Product) => (
        <span className="font-medium">
          {parseFloat(product.price).toFixed(2)} {product.currency}
        </span>
      ),
    },
    {
      key: "status",
      header: t.common.status,
      cell: (product: Product) => (
        <Badge variant={product.isActive ? "default" : "secondary"}>
          {product.isActive ? t.common.active : t.common.inactive}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (product: Product) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEditDialog(product)} data-testid={`button-edit-product-${product.id}`}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDeletingProduct(product)} data-testid={`button-delete-product-${product.id}`}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  const renderProductForm = (onSubmit: (data: ProductFormData) => void, isPending: boolean, onCancel: () => void) => (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>{t.products.productName}</FormLabel>
            <FormControl><Input placeholder={t.products.productName} {...field} data-testid="input-product-name" /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem>
            <FormLabel>{t.products.description}</FormLabel>
            <FormControl><Textarea placeholder={t.products.description} {...field} data-testid="input-product-description" /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="price" render={({ field }) => (
            <FormItem>
              <FormLabel>{t.products.price}</FormLabel>
              <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} data-testid="input-product-price" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="currency" render={({ field }) => (
            <FormItem>
              <FormLabel>{t.products.currency}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger data-testid="select-product-currency"><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <FormField control={form.control} name="category" render={({ field }) => (
          <FormItem>
            <FormLabel>{t.products.category}</FormLabel>
            <Select onValueChange={field.onChange} value={field.value || ""}>
              <FormControl><SelectTrigger data-testid="select-product-category"><SelectValue placeholder={t.products.selectCategory} /></SelectTrigger></FormControl>
              <SelectContent>
                {getCategoriesWithTranslations(t).map((cat) => <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="countries" render={({ field }) => (
          <FormItem>
            <FormLabel>{t.products.availableInCountries}</FormLabel>
            <div className="grid grid-cols-2 gap-2 rounded-lg border p-3">
              {COUNTRIES.map((country) => (
                <div key={country.code} className="flex items-center gap-2">
                  <Checkbox
                    id={`country-${country.code}`}
                    checked={field.value?.includes(country.code)}
                    onCheckedChange={(checked) => {
                      const newValue = checked
                        ? [...(field.value || []), country.code]
                        : (field.value || []).filter((c) => c !== country.code);
                      field.onChange(newValue);
                    }}
                  />
                  <Label htmlFor={`country-${country.code}`} className="text-sm cursor-pointer">{country.name}</Label>
                </div>
              ))}
            </div>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="isActive" render={({ field }) => (
          <FormItem className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <FormLabel className="text-base">{t.products.productActive}</FormLabel>
              <p className="text-sm text-muted-foreground">{t.products.productActiveHint}</p>
            </div>
            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-product-active" /></FormControl>
          </FormItem>
        )} />
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>{t.common.cancel}</Button>
          <Button type="submit" disabled={isPending}>{isPending ? t.common.loading : t.common.save}</Button>
        </div>
      </form>
    </Form>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t.products.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-products"
          />
        </div>
        <Button onClick={() => { form.reset(); setIsFormOpen(true); }} data-testid="button-add-product">
          <Plus className="h-4 w-4 mr-2" />
          {t.products.addProduct}
        </Button>
      </div>

      <DataTable columns={columns} data={filteredProducts} isLoading={isLoading} emptyMessage={t.products.noProducts} getRowKey={(p) => p.id} />

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.products.addNewProduct}</DialogTitle>
            <DialogDescription>{t.products.pageDescription}</DialogDescription>
          </DialogHeader>
          {renderProductForm((data) => createMutation.mutate(data), createMutation.isPending, () => setIsFormOpen(false))}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.products.editProduct}</DialogTitle>
            <DialogDescription>{t.products.updateProductInfo}</DialogDescription>
          </DialogHeader>
          {editingProduct && renderProductForm((data) => updateMutation.mutate({ ...data, id: editingProduct.id }), updateMutation.isPending, () => setEditingProduct(null))}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingProduct} onOpenChange={() => setDeletingProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.products.deleteProduct}</AlertDialogTitle>
            <AlertDialogDescription>{t.products.deleteConfirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingProduct && deleteMutation.mutate(deletingProduct.id)} className="bg-destructive text-destructive-foreground">
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ServiceConfigurationTab() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { selectedCountries } = useCountryFilter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceConfiguration | null>(null);
  const [selectedService, setSelectedService] = useState<ServiceConfiguration | null>(null);
  const [isInstanceDialogOpen, setIsInstanceDialogOpen] = useState(false);
  const [editingInstance, setEditingInstance] = useState<ServiceInstance | null>(null);
  const [instanceTab, setInstanceTab] = useState<"detail" | "invoicing">("detail");

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
      invoiceable: false,
      collectable: false,
      storable: false,
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

  // Service instances queries and mutations
  const { data: serviceInstances = [] } = useQuery<ServiceInstance[]>({
    queryKey: ["/api/configurator/services", selectedService?.id, "instances"],
    queryFn: async () => {
      if (!selectedService) return [];
      const res = await fetch(`/api/configurator/services/${selectedService.id}/instances`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch service instances");
      return res.json();
    },
    enabled: !!selectedService,
  });

  const { data: billingDetailsList = [] } = useQuery<BillingDetails[]>({
    queryKey: ["/api/billing-details"],
    queryFn: async () => {
      const res = await fetch("/api/billing-details", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch billing details");
      return res.json();
    },
  });

  const instanceForm = useForm<z.infer<typeof serviceInstanceFormSchema>>({
    resolver: zodResolver(serviceInstanceFormSchema),
    defaultValues: {
      serviceId: "",
      name: "",
      fromDate: "",
      toDate: "",
      invoiceIdentifier: "",
      isActive: true,
      certificateTemplate: "",
      description: "",
      billingDetailsId: "",
      allowProformaInvoices: false,
      invoicingPeriodYears: 1,
      constantSymbol: "",
      startInvoicingField: "REALIZED",
      endInvoicingField: "",
      accountingIdOffset: undefined,
      ledgerAccountProforma: "",
      ledgerAccountInvoice: "",
    },
  });

  const createInstanceMutation = useMutation({
    mutationFn: (data: z.infer<typeof serviceInstanceFormSchema>) =>
      apiRequest("POST", "/api/configurator/service-instances", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/configurator/services", selectedService?.id, "instances"] });
      setIsInstanceDialogOpen(false);
      instanceForm.reset();
      toast({ title: t.konfigurator.instanceCreated || "Service instance created" });
    },
  });

  const updateInstanceMutation = useMutation({
    mutationFn: (data: z.infer<typeof serviceInstanceFormSchema> & { id: string }) =>
      apiRequest("PATCH", `/api/configurator/service-instances/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/configurator/services", selectedService?.id, "instances"] });
      setIsInstanceDialogOpen(false);
      setEditingInstance(null);
      instanceForm.reset();
      toast({ title: t.konfigurator.instanceUpdated || "Service instance updated" });
    },
  });

  const deleteInstanceMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/configurator/service-instances/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/configurator/services", selectedService?.id, "instances"] });
      toast({ title: t.konfigurator.instanceDeleted || "Service instance deleted" });
    },
  });

  const handleEditInstance = (instance: ServiceInstance) => {
    setEditingInstance(instance);
    instanceForm.reset({
      serviceId: instance.serviceId,
      name: instance.name,
      fromDate: instance.fromDate || "",
      toDate: instance.toDate || "",
      invoiceIdentifier: instance.invoiceIdentifier || "",
      isActive: instance.isActive,
      certificateTemplate: instance.certificateTemplate || "",
      description: instance.description || "",
      billingDetailsId: instance.billingDetailsId || "",
      allowProformaInvoices: instance.allowProformaInvoices,
      invoicingPeriodYears: instance.invoicingPeriodYears || 1,
      constantSymbol: instance.constantSymbol || "",
      startInvoicingField: instance.startInvoicingField || "REALIZED",
      endInvoicingField: instance.endInvoicingField || "",
      accountingIdOffset: instance.accountingIdOffset || undefined,
      ledgerAccountProforma: instance.ledgerAccountProforma || "",
      ledgerAccountInvoice: instance.ledgerAccountInvoice || "",
    });
    setInstanceTab("detail");
    setIsInstanceDialogOpen(true);
  };

  const handleInstanceSubmit = (data: z.infer<typeof serviceInstanceFormSchema>) => {
    if (editingInstance) {
      updateInstanceMutation.mutate({ ...data, id: editingInstance.id });
    } else {
      createInstanceMutation.mutate(data);
    }
  };

  const openNewInstanceDialog = () => {
    if (!selectedService) return;
    setEditingInstance(null);
    instanceForm.reset({
      serviceId: selectedService.id,
      name: "",
      fromDate: "",
      toDate: "",
      invoiceIdentifier: "",
      isActive: true,
      certificateTemplate: "",
      description: "",
      billingDetailsId: "",
      allowProformaInvoices: false,
      invoicingPeriodYears: 1,
      constantSymbol: "",
      startInvoicingField: "REALIZED",
      endInvoicingField: "",
      accountingIdOffset: undefined,
      ledgerAccountProforma: "",
      ledgerAccountInvoice: "",
    });
    setInstanceTab("detail");
    setIsInstanceDialogOpen(true);
  };

  // Filter billing details by selected service's country
  const filteredBillingDetails = selectedService 
    ? billingDetailsList.filter(bd => bd.countryCode === selectedService.countryCode)
    : billingDetailsList;

  const handleEdit = (service: ServiceConfiguration) => {
    setEditingService(service);
    form.reset({
      serviceCode: service.serviceCode,
      serviceName: service.serviceName,
      description: service.description || "",
      countryCode: service.countryCode,
      isActive: service.isActive,
      invoiceable: service.invoiceable || false,
      collectable: service.collectable || false,
      storable: service.storable || false,
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
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="invoiceable"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>{t.konfigurator.invoiceable || "Invoiceable"}</FormLabel>
                        </div>
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-service-invoiceable" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="collectable"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>{t.konfigurator.collectable || "Collectable"}</FormLabel>
                        </div>
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-service-collectable" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="storable"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>{t.konfigurator.storable || "Storable"}</FormLabel>
                        </div>
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-service-storable" />
                        </FormControl>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h4 className="text-sm font-medium mb-2">{t.konfigurator.services}</h4>
          <div className="border rounded-md divide-y">
            {services.map((service) => (
              <div 
                key={service.id}
                className={`p-3 cursor-pointer hover-elevate flex items-center justify-between gap-2 ${selectedService?.id === service.id ? "bg-accent" : ""}`}
                onClick={() => setSelectedService(selectedService?.id === service.id ? null : service)}
                data-testid={`row-service-${service.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{service.serviceName}</span>
                    <Badge variant="secondary" className="text-xs">{service.serviceCode}</Badge>
                    <Badge variant="outline" className="text-xs">{service.countryCode}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1 flex-wrap">
                    {service.basePrice && <span>{service.basePrice} {service.currency}</span>}
                    {service.invoiceable && <Badge variant="outline" className="text-xs">{t.konfigurator.invoiceable || "Invoiceable"}</Badge>}
                    {service.collectable && <Badge variant="outline" className="text-xs">{t.konfigurator.collectable || "Collectable"}</Badge>}
                    {service.storable && <Badge variant="outline" className="text-xs">{t.konfigurator.storable || "Storable"}</Badge>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant={service.isActive ? "default" : "secondary"} className="text-xs">
                    {service.isActive ? t.common.active : t.common.inactive}
                  </Badge>
                  <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); handleEdit(service); }} data-testid={`button-edit-service-${service.id}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(service.id); }} data-testid={`button-delete-service-${service.id}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {services.length === 0 && (
              <div className="p-4 text-center text-muted-foreground">
                {t.konfigurator.noServices || "No services configured"}
              </div>
            )}
          </div>
        </div>

        <div className="border rounded-md">
          {selectedService ? (
            <>
              <div className="p-3 border-b flex items-center justify-between gap-2">
                <div>
                  <h4 className="font-medium">{t.konfigurator.serviceInstances || "Service Instances"}</h4>
                  <p className="text-sm text-muted-foreground">{selectedService.serviceName}</p>
                </div>
                <Button size="sm" onClick={openNewInstanceDialog} data-testid="button-add-instance">
                  <Plus className="mr-2 h-4 w-4" />
                  {t.konfigurator.addInstance || "Add Instance"}
                </Button>
              </div>
              <div className="divide-y max-h-[400px] overflow-y-auto">
                {serviceInstances.map((instance) => (
                  <div key={instance.id} className="p-3 flex items-center justify-between gap-2 hover-elevate">
                    <div>
                      <div className="font-medium">{instance.name}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                        {instance.fromDate && <span>{t.konfigurator.from || "From"}: {instance.fromDate}</span>}
                        {instance.toDate && <span>{t.konfigurator.to || "To"}: {instance.toDate}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant={instance.isActive ? "default" : "secondary"} className="text-xs">
                        {instance.isActive ? t.common.active : t.common.inactive}
                      </Badge>
                      <Button size="icon" variant="ghost" onClick={() => handleEditInstance(instance)} data-testid={`button-edit-instance-${instance.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteInstanceMutation.mutate(instance.id)} data-testid={`button-delete-instance-${instance.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {serviceInstances.length === 0 && (
                  <div className="p-4 text-center text-muted-foreground">
                    {t.konfigurator.noInstances || "No instances for this service"}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-6 text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>{t.konfigurator.selectServiceForInstances || "Select a service to manage its instances"}</p>
            </div>
          )}
        </div>
      </div>

      {/* Service Instance Dialog */}
      <Dialog open={isInstanceDialogOpen} onOpenChange={(open) => {
        setIsInstanceDialogOpen(open);
        if (!open) {
          setEditingInstance(null);
          instanceForm.reset();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingInstance ? (t.konfigurator.editInstance || "Edit Instance") : (t.konfigurator.addInstance || "Add Instance")}</DialogTitle>
            <DialogDescription>{selectedService?.serviceName}</DialogDescription>
          </DialogHeader>
          <Form {...instanceForm}>
            <form onSubmit={instanceForm.handleSubmit(handleInstanceSubmit)} className="space-y-4">
              <Tabs value={instanceTab} onValueChange={(v) => setInstanceTab(v as "detail" | "invoicing")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="detail" data-testid="tab-instance-detail">{t.common.detail || "Detail"}</TabsTrigger>
                  <TabsTrigger value="invoicing" data-testid="tab-instance-invoicing">{t.konfigurator.invoicing || "Invoicing"}</TabsTrigger>
                </TabsList>
                <TabsContent value="detail" className="space-y-4 mt-4">
                  <FormField
                    control={instanceForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.common.name || "Name"}</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-instance-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={instanceForm.control}
                      name="fromDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.konfigurator.from || "From"}</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-instance-from" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={instanceForm.control}
                      name="toDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.konfigurator.to || "To"}</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-instance-to" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={instanceForm.control}
                    name="invoiceIdentifier"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.konfigurator.invoiceIdentifier || "Invoice Identifier"}</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-instance-invoice-id" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={instanceForm.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <FormLabel>{t.common.active}</FormLabel>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-instance-active" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={instanceForm.control}
                      name="certificateTemplate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.konfigurator.certificateTemplate || "Certificate Template"}</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-instance-cert" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={instanceForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.konfigurator.description}</FormLabel>
                        <FormControl>
                          <Textarea {...field} data-testid="input-instance-description" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
                <TabsContent value="invoicing" className="space-y-4 mt-4">
                  <FormField
                    control={instanceForm.control}
                    name="billingDetailsId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.konfigurator.exportInvoicingTo || "Export Invoicing To"}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-instance-billing">
                              <SelectValue placeholder={t.common.select} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {filteredBillingDetails.map((bd) => (
                              <SelectItem key={bd.id} value={bd.id}>
                                {bd.companyName} ({bd.countryCode})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={instanceForm.control}
                      name="allowProformaInvoices"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <FormLabel>{t.konfigurator.allowProformaInvoices || "Allow Proforma Invoices"}</FormLabel>
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-instance-proforma" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={instanceForm.control}
                      name="invoicingPeriodYears"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.konfigurator.invoicingPeriod || "Invoicing Period (years)"}</FormLabel>
                          <Select onValueChange={(v) => field.onChange(parseInt(v))} value={field.value?.toString() || "1"}>
                            <FormControl>
                              <SelectTrigger data-testid="select-instance-period">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Array.from({ length: 100 }, (_, i) => i + 1).map((n) => (
                                <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={instanceForm.control}
                    name="constantSymbol"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.konfigurator.constantSymbol || "Constant Symbol"}</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-instance-constant-symbol" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={instanceForm.control}
                      name="startInvoicingField"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.konfigurator.startInvoicingField || "Start Invoicing Field"}</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-instance-start-field" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={instanceForm.control}
                      name="endInvoicingField"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.konfigurator.endInvoicingField || "End Invoicing Field"}</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-instance-end-field" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={instanceForm.control}
                    name="accountingIdOffset"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.konfigurator.accountingIdOffset || "Accounting ID Offset"}</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)} 
                            data-testid="input-instance-offset" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={instanceForm.control}
                      name="ledgerAccountProforma"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.konfigurator.ledgerAccountProforma || "Ledger Account - PROFORMA"}</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              pattern="[0-9]*"
                              onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ''))}
                              data-testid="input-instance-ledger-proforma" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={instanceForm.control}
                      name="ledgerAccountInvoice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.konfigurator.ledgerAccountInvoice || "Ledger Account - INVOICE"}</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              pattern="[0-9]*"
                              onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ''))}
                              data-testid="input-instance-ledger-invoice" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>
              </Tabs>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsInstanceDialogOpen(false)}>
                  {t.common.cancel}
                </Button>
                <Button type="submit" disabled={createInstanceMutation.isPending || updateInstanceMutation.isPending} data-testid="button-save-instance">
                  {(createInstanceMutation.isPending || updateInstanceMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t.common.save}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
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

function NumberRangesTab() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { selectedCountries } = useCountryFilter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRange, setEditingRange] = useState<NumberRange | null>(null);
  const [wizardStep, setWizardStep] = useState(1);
  const [search, setSearch] = useState("");
  const totalSteps = 4;

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 61 }, (_, i) => currentYear - 30 + i);

  const { data: ranges = [], isLoading } = useQuery<NumberRange[]>({
    queryKey: ["/api/configurator/number-ranges", selectedCountries.join(",")],
    queryFn: async () => {
      const params = selectedCountries.length > 0 ? `?countries=${selectedCountries.join(",")}` : "";
      const res = await fetch(`/api/configurator/number-ranges${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch number ranges");
      return res.json();
    },
  });

  const form = useForm<z.infer<typeof numberRangeFormSchema>>({
    resolver: zodResolver(numberRangeFormSchema),
    defaultValues: {
      name: "",
      countryCode: "",
      billingDetailsId: "",
      year: currentYear,
      useServiceCode: false,
      type: "invoice",
      prefix: "",
      suffix: "",
      digitsToGenerate: 6,
      startNumber: 1,
      endNumber: 999999,
      lastNumberUsed: 0,
      accountingCode: "",
      description: "",
      isActive: true,
    },
  });

  const selectedCountryCode = form.watch("countryCode");
  const digitsToGenerate = form.watch("digitsToGenerate");

  const { data: billingCompanies = [] } = useQuery<BillingDetails[]>({
    queryKey: ["/api/billing-details", selectedCountryCode],
    queryFn: async () => {
      if (!selectedCountryCode) return [];
      const res = await fetch(`/api/billing-details?country=${selectedCountryCode}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedCountryCode,
  });

  useEffect(() => {
    if (digitsToGenerate && digitsToGenerate >= 1 && digitsToGenerate <= 20) {
      const maxNumber = Math.pow(10, digitsToGenerate) - 1;
      form.setValue("startNumber", 1);
      form.setValue("endNumber", maxNumber);
    }
  }, [digitsToGenerate, form]);

  useEffect(() => {
    if (selectedCountryCode && !editingRange) {
      form.setValue("billingDetailsId", "");
    }
  }, [selectedCountryCode, form, editingRange]);

  const createMutation = useMutation({
    mutationFn: (data: z.infer<typeof numberRangeFormSchema>) =>
      apiRequest("POST", "/api/configurator/number-ranges", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/configurator/number-ranges"] });
      setIsDialogOpen(false);
      form.reset();
      toast({ title: t.konfigurator.numberRangeCreated });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: z.infer<typeof numberRangeFormSchema> & { id: string }) =>
      apiRequest("PATCH", `/api/configurator/number-ranges/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/configurator/number-ranges"] });
      setIsDialogOpen(false);
      setEditingRange(null);
      form.reset();
      toast({ title: t.konfigurator.numberRangeUpdated });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/configurator/number-ranges/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/configurator/number-ranges"] });
      toast({ title: t.konfigurator.numberRangeDeleted });
    },
  });

  const handleEdit = (range: NumberRange) => {
    setEditingRange(range);
    setWizardStep(1);
    form.reset({
      name: range.name,
      countryCode: range.countryCode,
      billingDetailsId: range.billingDetailsId || "",
      year: range.year,
      useServiceCode: range.useServiceCode,
      type: range.type as "invoice" | "proforma",
      prefix: range.prefix || "",
      suffix: range.suffix || "",
      digitsToGenerate: range.digitsToGenerate,
      startNumber: range.startNumber,
      endNumber: range.endNumber,
      lastNumberUsed: range.lastNumberUsed || 0,
      accountingCode: range.accountingCode || "",
      description: range.description || "",
      isActive: range.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingRange(null);
    setWizardStep(1);
    form.reset();
  };

  const nextStep = () => {
    if (wizardStep < totalSteps) {
      setWizardStep(wizardStep + 1);
    }
  };

  const prevStep = () => {
    if (wizardStep > 1) {
      setWizardStep(wizardStep - 1);
    }
  };

  const canProceedStep1 = !!form.watch("name") && !!form.watch("countryCode");
  const canProceedStep2 = !!form.watch("year") && !!form.watch("type");
  const canProceedStep3 = form.watch("digitsToGenerate") >= 1;

  const handleSubmit = (data: z.infer<typeof numberRangeFormSchema>) => {
    if (editingRange) {
      updateMutation.mutate({ ...data, id: editingRange.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredRanges = ranges.filter(range => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    const countryName = COUNTRIES.find(c => c.code === range.countryCode)?.name || "";
    return (
      range.name.toLowerCase().includes(searchLower) ||
      range.countryCode.toLowerCase().includes(searchLower) ||
      countryName.toLowerCase().includes(searchLower) ||
      (range.prefix || "").toLowerCase().includes(searchLower) ||
      (range.suffix || "").toLowerCase().includes(searchLower) ||
      String(range.year).includes(searchLower) ||
      range.type.toLowerCase().includes(searchLower)
    );
  });

  const columns = [
    { 
      key: "name",
      header: t.konfigurator.numberRangeName,
      cell: (range: NumberRange) => range.name,
    },
    { 
      key: "countryCode",
      header: t.common.country,
      cell: (range: NumberRange) => {
        const country = COUNTRIES.find(c => c.code === range.countryCode);
        return country ? country.name : range.countryCode;
      },
    },
    { 
      key: "year",
      header: t.konfigurator.numberRangeYear,
      cell: (range: NumberRange) => range.year,
    },
    { 
      key: "type",
      header: t.konfigurator.numberRangeType,
      cell: (range: NumberRange) => (
        <Badge variant={range.type === "invoice" ? "default" : "secondary"}>
          {range.type === "invoice" ? t.konfigurator.invoice : t.konfigurator.proformaInvoice}
        </Badge>
      ),
    },
    { 
      key: "format",
      header: t.konfigurator.prefix + " / " + t.konfigurator.suffix,
      cell: (range: NumberRange) => `${range.prefix || "-"} / ${range.suffix || "-"}`,
    },
    { 
      key: "lastNumberUsed",
      header: t.konfigurator.lastNumberUsed,
      cell: (range: NumberRange) => range.lastNumberUsed || 0,
    },
    { 
      key: "isActive",
      header: t.common.status,
      cell: (range: NumberRange) => (
        <Badge variant={range.isActive ? "default" : "secondary"}>
          {range.isActive ? t.common.active : t.common.inactive}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: t.common.actions,
      cell: (range: NumberRange) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleEdit(range)}
            data-testid={`button-edit-range-${range.id}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => deleteMutation.mutate(range.id)}
            data-testid={`button-delete-range-${range.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t.common.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-number-ranges"
          />
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          if (!open) handleDialogClose();
          else setIsDialogOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-number-range" onClick={() => setWizardStep(1)}>
              <Plus className="mr-2 h-4 w-4" />
              {t.konfigurator.addNumberRange}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingRange ? t.konfigurator.editNumberRange : t.konfigurator.addNumberRange}
              </DialogTitle>
              <DialogDescription>
                {t.konfigurator.numberRangeFormDescription}
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center justify-center gap-2 py-4">
              {[1, 2, 3, 4].map((step) => (
                <div key={step} className="flex items-center gap-2">
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                      wizardStep === step
                        ? "bg-primary text-primary-foreground"
                        : wizardStep > step
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {step}
                  </div>
                  {step < 4 && (
                    <div className={`w-8 h-0.5 ${wizardStep > step ? "bg-primary" : "bg-muted"}`} />
                  )}
                </div>
              ))}
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                {wizardStep === 1 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">{t.konfigurator.wizardStep1Title}</h3>
                    <p className="text-sm text-muted-foreground">{t.konfigurator.wizardStep1Desc}</p>
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.konfigurator.numberRangeName}</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-range-name" />
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
                              <SelectTrigger data-testid="select-range-country">
                                <SelectValue placeholder={t.konfigurator.selectCountryPlaceholder} />
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
                      name="billingDetailsId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.konfigurator.billingCompany}</FormLabel>
                          <Select onValueChange={(val) => field.onChange(val === "__none__" ? "" : val)} value={field.value || "__none__"}>
                            <FormControl>
                              <SelectTrigger data-testid="select-billing-company">
                                <SelectValue placeholder={t.konfigurator.selectBillingCompany} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="__none__">{t.common.none}</SelectItem>
                              {billingCompanies.map((company) => (
                                <SelectItem key={company.id} value={company.id}>
                                  {company.companyName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {wizardStep === 2 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">{t.konfigurator.wizardStep2Title}</h3>
                    <p className="text-sm text-muted-foreground">{t.konfigurator.wizardStep2Desc}</p>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="year"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t.konfigurator.numberRangeYear}</FormLabel>
                            <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                              <FormControl>
                                <SelectTrigger data-testid="select-range-year">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {yearOptions.map((year) => (
                                  <SelectItem key={year} value={year.toString()}>
                                    {year}
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
                        name="type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t.konfigurator.numberRangeType}</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-range-type">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="invoice">{t.konfigurator.invoice}</SelectItem>
                                <SelectItem value="proforma">{t.konfigurator.proformaInvoice}</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="useServiceCode"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center gap-3 space-y-0 rounded-lg border p-3">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-use-service-code"
                            />
                          </FormControl>
                          <FormLabel className="font-normal">{t.konfigurator.useServiceCode}</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {wizardStep === 3 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">{t.konfigurator.wizardStep3Title}</h3>
                    <p className="text-sm text-muted-foreground">{t.konfigurator.wizardStep3Desc}</p>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="prefix"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t.konfigurator.prefix}</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-range-prefix" placeholder="FV" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="suffix"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t.konfigurator.suffix}</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-range-suffix" placeholder="/2025" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="digitsToGenerate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.konfigurator.digitsToGenerate}</FormLabel>
                          <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                            <FormControl>
                              <SelectTrigger data-testid="select-digits-to-generate">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Array.from({ length: 20 }, (_, i) => i + 1).map((num) => (
                                <SelectItem key={num} value={num.toString()}>
                                  {num}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="startNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t.konfigurator.startNumber}</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                value={field.value ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  field.onChange(val === "" ? 1 : parseInt(val));
                                }}
                                onBlur={field.onBlur}
                                name={field.name}
                                ref={field.ref}
                                data-testid="input-start-number" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="endNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t.konfigurator.endNumber}</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                value={field.value ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  field.onChange(val === "" ? 1 : parseInt(val));
                                }}
                                onBlur={field.onBlur}
                                name={field.name}
                                ref={field.ref}
                                data-testid="input-end-number" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                {wizardStep === 4 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">{t.konfigurator.wizardStep4Title}</h3>
                    <p className="text-sm text-muted-foreground">{t.konfigurator.wizardStep4Desc}</p>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="lastNumberUsed"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t.konfigurator.lastNumberUsed}</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                value={field.value ?? ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  field.onChange(val === "" ? 0 : parseInt(val));
                                }}
                                onBlur={field.onBlur}
                                name={field.name}
                                ref={field.ref}
                                data-testid="input-last-number-used" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="accountingCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t.konfigurator.accountingCode}</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-accounting-code" />
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
                          <FormLabel>{t.konfigurator.numberRangeDescription}</FormLabel>
                          <FormControl>
                            <Textarea {...field} data-testid="input-range-description" />
                          </FormControl>
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
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-range-active"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <DialogFooter className="gap-2">
                  <Button type="button" variant="outline" onClick={handleDialogClose}>
                    {t.common.cancel}
                  </Button>
                  {wizardStep > 1 && (
                    <Button type="button" variant="outline" onClick={prevStep}>
                      {t.konfigurator.wizardPrevious}
                    </Button>
                  )}
                  {wizardStep < totalSteps ? (
                    <Button 
                      type="button" 
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        nextStep();
                      }}
                      disabled={
                        (wizardStep === 1 && !canProceedStep1) ||
                        (wizardStep === 2 && !canProceedStep2) ||
                        (wizardStep === 3 && !canProceedStep3)
                      }
                      data-testid="button-wizard-next"
                    >
                      {t.konfigurator.wizardNext}
                    </Button>
                  ) : (
                    <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-range">
                      {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {t.common.save}
                    </Button>
                  )}
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      {filteredRanges.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {search ? (t.common.noData || "No results found") : t.konfigurator.noNumberRanges}
        </div>
      ) : (
        <DataTable 
          columns={columns} 
          data={filteredRanges} 
          getRowKey={(range) => range.id}
        />
      )}
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
    mutationFn: (data: { layout: InvoiceLayout; layoutConfig: string }) =>
      apiRequest("PATCH", `/api/configurator/invoice-layouts/${data.layout.id}`, {
        name: data.layout.name,
        countryCode: data.layout.countryCode,
        isDefault: data.layout.isDefault,
        isActive: data.layout.isActive,
        paperSize: data.layout.paperSize,
        orientation: data.layout.orientation,
        marginTop: data.layout.marginTop,
        marginBottom: data.layout.marginBottom,
        marginLeft: data.layout.marginLeft,
        marginRight: data.layout.marginRight,
        fontSize: data.layout.fontSize,
        fontFamily: data.layout.fontFamily,
        layoutConfig: data.layoutConfig,
      }),
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
        layout: designingLayout,
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

const roleFormSchema = z.object({
  name: z.string().min(1, "Role name is required"),
  description: z.string().optional(),
  department: z.string().optional(),
  isActive: z.boolean().default(true),
});

type RoleFormData = z.infer<typeof roleFormSchema>;

interface RoleWithPermissions extends Role {
  modulePermissions: RoleModulePermission[];
  fieldPermissions: RoleFieldPermission[];
}

const departmentFormSchema = z.object({
  name: z.string().min(1, "Department name is required"),
  description: z.string().optional(),
  parentId: z.string().optional().nullable(),
  contactFirstName: z.string().optional().nullable(),
  contactLastName: z.string().optional().nullable(),
  contactEmail: z.string().email().optional().nullable().or(z.literal("")),
  contactPhone: z.string().optional().nullable(),
});

type DepartmentFormData = z.infer<typeof departmentFormSchema>;

function PermissionsRolesTab() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedRole, setSelectedRole] = useState<RoleWithPermissions | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
  const [copyRoleName, setCopyRoleName] = useState("");
  const [expandedModules, setExpandedModules] = useState<string[]>([]);
  const [deleteRole, setDeleteRole] = useState<Role | null>(null);
  
  const [isDeptFormOpen, setIsDeptFormOpen] = useState(false);
  const [isEditingDept, setIsEditingDept] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deleteDept, setDeleteDept] = useState<Department | null>(null);
  const [showDepartments, setShowDepartments] = useState(false);

  const { data: roles = [], isLoading } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
  });

  const { data: dbDepartments = [] } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const { data: roleDetails } = useQuery<RoleWithPermissions>({
    queryKey: ["/api/roles", selectedRole?.id],
    queryFn: async () => {
      const response = await fetch(`/api/roles/${selectedRole?.id}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch role');
      return response.json();
    },
    enabled: !!selectedRole?.id,
  });

  const form = useForm<RoleFormData>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: {
      name: "",
      description: "",
      department: "",
      isActive: true,
    },
  });

  const deptForm = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: {
      name: "",
      description: "",
      parentId: null,
      contactFirstName: "",
      contactLastName: "",
      contactEmail: "",
      contactPhone: "",
    },
  });

  const createDeptMutation = useMutation({
    mutationFn: (data: DepartmentFormData) => apiRequest("POST", "/api/departments", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setIsDeptFormOpen(false);
      deptForm.reset();
      toast({ title: t.konfigurator.departmentCreated });
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  const updateDeptMutation = useMutation({
    mutationFn: (data: DepartmentFormData & { id: string }) =>
      apiRequest("PATCH", `/api/departments/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setIsDeptFormOpen(false);
      setIsEditingDept(false);
      setEditingDept(null);
      deptForm.reset();
      toast({ title: t.konfigurator.departmentUpdated });
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  const deleteDeptMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/departments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setDeleteDept(null);
      toast({ title: t.konfigurator.departmentDeleted });
    },
    onError: () => {
      toast({ title: t.errors.deleteFailed, variant: "destructive" });
    },
  });

  const handleDeptSubmit = (data: DepartmentFormData) => {
    if (isEditingDept && editingDept) {
      updateDeptMutation.mutate({ ...data, id: editingDept.id });
    } else {
      createDeptMutation.mutate(data);
    }
  };

  const handleEditDeptClick = (dept: Department) => {
    setEditingDept(dept);
    deptForm.reset({
      name: dept.name,
      description: dept.description || "",
      parentId: dept.parentId || null,
      contactFirstName: dept.contactFirstName || "",
      contactLastName: dept.contactLastName || "",
      contactEmail: dept.contactEmail || "",
      contactPhone: dept.contactPhone || "",
    });
    setIsEditingDept(true);
    setIsDeptFormOpen(true);
  };

  const moveDeptMutation = useMutation({
    mutationFn: ({ deptId, newParentId }: { deptId: string; newParentId: string | null }) =>
      apiRequest("PATCH", `/api/departments/${deptId}`, { parentId: newParentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({ title: t.konfigurator.departmentUpdated });
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  const handleAddDeptWithParent = (parentId?: string) => {
    setIsEditingDept(false);
    deptForm.reset({
      name: "",
      description: "",
      parentId: parentId || null,
      contactFirstName: "",
      contactLastName: "",
      contactEmail: "",
      contactPhone: "",
    });
    setIsDeptFormOpen(true);
  };

  const getParentDeptName = (parentId: string | null | undefined) => {
    if (!parentId) return null;
    const parent = dbDepartments.find(d => d.id === parentId);
    return parent?.name || parentId;
  };

  const createMutation = useMutation({
    mutationFn: (data: RoleFormData) => apiRequest("POST", "/api/roles", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      setIsFormOpen(false);
      form.reset();
      toast({ title: t.konfigurator.roleCreated });
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: RoleFormData & { id: string }) =>
      apiRequest("PATCH", `/api/roles/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      setIsEditing(false);
      form.reset();
      toast({ title: t.konfigurator.roleUpdated });
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/roles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      setDeleteRole(null);
      if (selectedRole?.id === deleteRole?.id) {
        setSelectedRole(null);
      }
      toast({ title: t.konfigurator.roleDeleted });
    },
    onError: () => {
      toast({ title: t.errors.deleteFailed, variant: "destructive" });
    },
  });

  const copyMutation = useMutation({
    mutationFn: ({ roleId, name }: { roleId: string; name: string }) =>
      apiRequest("POST", `/api/roles/${roleId}/copy`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      setIsCopyDialogOpen(false);
      setCopyRoleName("");
      toast({ title: t.konfigurator.roleCopied });
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  const seedMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/roles/seed"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      toast({ title: t.konfigurator.defaultRolesCreated || "Default roles created successfully" });
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  const updateModulePermission = useMutation({
    mutationFn: ({ roleId, moduleKey, access, canAdd, canEdit }: { roleId: string; moduleKey: string; access?: ModuleAccess; canAdd?: boolean; canEdit?: boolean }) =>
      apiRequest("PUT", `/api/roles/${roleId}/modules/${moduleKey}`, { access, canAdd, canEdit }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles", selectedRole?.id] });
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  const updateFieldPermission = useMutation({
    mutationFn: ({ roleId, moduleKey, fieldKey, permission }: { roleId: string; moduleKey: string; fieldKey: string; permission: FieldPermission }) =>
      apiRequest("PUT", `/api/roles/${roleId}/modules/${moduleKey}/fields/${fieldKey}`, { permission }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles", selectedRole?.id] });
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  const handleSubmit = (data: RoleFormData) => {
    if (isEditing && selectedRole) {
      updateMutation.mutate({ ...data, id: selectedRole.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEditClick = (role: Role) => {
    setSelectedRole(role as RoleWithPermissions);
    form.reset({
      name: role.name,
      description: role.description || "",
      department: role.department || "",
      isActive: role.isActive,
    });
    setIsEditing(true);
    setIsFormOpen(true);
  };

  const handleCopyClick = (role: Role) => {
    setSelectedRole(role as RoleWithPermissions);
    setCopyRoleName(`${role.name} (Copy)`);
    setIsCopyDialogOpen(true);
  };

  const toggleModuleExpand = (moduleKey: string) => {
    setExpandedModules(prev =>
      prev.includes(moduleKey)
        ? prev.filter(k => k !== moduleKey)
        : [...prev, moduleKey]
    );
  };

  const getModuleAccess = (moduleKey: string): ModuleAccess => {
    const moduleDef = CRM_MODULES.find(m => m.key === moduleKey);
    const permission = roleDetails?.modulePermissions.find(p => p.moduleKey === moduleKey);
    return (permission?.access as ModuleAccess) || moduleDef?.defaultAccess || "visible";
  };

  const getModuleCanAdd = (moduleKey: string): boolean => {
    const permission = roleDetails?.modulePermissions.find(p => p.moduleKey === moduleKey);
    return permission?.canAdd !== false;
  };

  const getModuleCanEdit = (moduleKey: string): boolean => {
    const permission = roleDetails?.modulePermissions.find(p => p.moduleKey === moduleKey);
    return permission?.canEdit !== false;
  };

  const getFieldPermission = (moduleKey: string, fieldKey: string): FieldPermission => {
    const moduleDef = CRM_MODULES.find(m => m.key === moduleKey);
    const fieldDef = moduleDef?.fields.find(f => f.key === fieldKey);
    const permission = roleDetails?.fieldPermissions.find(
      p => p.moduleKey === moduleKey && p.fieldKey === fieldKey
    );
    return (permission?.permission as FieldPermission) || fieldDef?.defaultPermission || "editable";
  };

  const getDepartmentLabel = (deptId: string | null | undefined) => {
    if (!deptId) return "";
    const dept = dbDepartments.find(d => d.id === deptId);
    return dept?.name || deptId;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Department Management - Full Width */}
      <div className="border rounded-md">
        <div
          className="p-3 flex items-center justify-between gap-2 cursor-pointer hover-elevate"
          onClick={() => setShowDepartments(!showDepartments)}
          data-testid="toggle-departments-section"
        >
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <h3 className="text-md font-medium">{t.konfigurator.departmentsManagement}</h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">{dbDepartments.length}</Badge>
            {showDepartments ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>

        {showDepartments && (
          <div className="border-t p-3">
            <DepartmentTree
              departments={dbDepartments}
              onEdit={handleEditDeptClick}
              onDelete={setDeleteDept}
              onAdd={handleAddDeptWithParent}
              onMove={(deptId, newParentId) => moveDeptMutation.mutate({ deptId, newParentId })}
              translations={{
                addDepartment: t.konfigurator.addDepartment,
                addSubDepartment: t.konfigurator.addSubDepartment || "Add sub-department",
                noDepartments: t.konfigurator.noDepartments,
                contactPerson: t.konfigurator.contactPerson || "Contact Person",
              }}
            />
          </div>
        )}
      </div>

      {/* Roles & Permissions - Two Column Layout */}
      <div className="flex gap-6">
        <div className="w-1/3 space-y-4">
          <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-medium">{t.konfigurator.roles}</h3>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending} data-testid="button-seed-roles">
              {t.konfigurator.createDefaultRoles}
            </Button>
            <Button size="sm" onClick={() => { setIsEditing(false); form.reset(); setIsFormOpen(true); }} data-testid="button-add-role">
              <Plus className="h-4 w-4 mr-1" />
              {t.konfigurator.addRole}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {roles.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">{t.konfigurator.noRoles}</p>
          ) : (
            roles.map((role) => (
              <div
                key={role.id}
                className={`p-3 rounded-md border cursor-pointer hover-elevate ${selectedRole?.id === role.id ? 'border-primary bg-accent' : ''}`}
                onClick={() => setSelectedRole(role as RoleWithPermissions)}
                data-testid={`role-item-${role.id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{role.name}</span>
                      {role.isSystem && (
                        <Badge variant="secondary" className="text-xs">
                          <Lock className="h-3 w-3 mr-1" />
                          {t.konfigurator.systemRole}
                        </Badge>
                      )}
                      {!role.isActive && (
                        <Badge variant="outline" className="text-xs">{t.common.inactive}</Badge>
                      )}
                    </div>
                    {role.department && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {getDepartmentLabel(role.department)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); handleCopyClick(role); }}
                      data-testid={`button-copy-role-${role.id}`}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); handleEditClick(role); }}
                      data-testid={`button-edit-role-${role.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {!role.isSystem && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); setDeleteRole(role); }}
                        data-testid={`button-delete-role-${role.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 space-y-4">
        {selectedRole && roleDetails ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-medium">{t.konfigurator.moduleAccess}</h3>
                <p className="text-sm text-muted-foreground">{selectedRole.name}</p>
              </div>
              <div className="flex items-center gap-2">
                {(updateModulePermission.isPending || updateFieldPermission.isPending) ? (
                  <Badge variant="outline" className="text-xs">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    {t.common.saving}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    <Check className="h-3 w-3 mr-1" />
                    {t.common.saved}
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {CRM_MODULES.map((module) => {
                const access = getModuleAccess(module.key);
                const isExpanded = expandedModules.includes(module.key);
                const isVisible = access === "visible";

                return (
                  <div key={module.key} className="border rounded-md" data-testid={`module-${module.key}`}>
                    <div className="p-3 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => toggleModuleExpand(module.key)}
                          disabled={!isVisible}
                          data-testid={`button-expand-${module.key}`}
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                        <span className="font-medium">{module.label}</span>
                        <Badge variant={isVisible ? "default" : "secondary"} className="ml-auto">
                          {isVisible ? (
                            <><Eye className="h-3 w-3 mr-1" />{t.konfigurator.visible}</>
                          ) : (
                            <><EyeOff className="h-3 w-3 mr-1" />{t.konfigurator.hidden}</>
                          )}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4">
                        {isVisible && (
                          <>
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-muted-foreground">{t.konfigurator.canAdd}</Label>
                              <Switch
                                checked={getModuleCanAdd(module.key)}
                                onCheckedChange={(checked) => {
                                  updateModulePermission.mutate({
                                    roleId: selectedRole.id,
                                    moduleKey: module.key,
                                    canAdd: checked,
                                  });
                                }}
                                data-testid={`switch-can-add-${module.key}`}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-muted-foreground">{t.konfigurator.canEdit}</Label>
                              <Switch
                                checked={getModuleCanEdit(module.key)}
                                onCheckedChange={(checked) => {
                                  updateModulePermission.mutate({
                                    roleId: selectedRole.id,
                                    moduleKey: module.key,
                                    canEdit: checked,
                                  });
                                }}
                                data-testid={`switch-can-edit-${module.key}`}
                              />
                            </div>
                          </>
                        )}
                        <Switch
                          checked={isVisible}
                          onCheckedChange={(checked) => {
                            updateModulePermission.mutate({
                              roleId: selectedRole.id,
                              moduleKey: module.key,
                              access: checked ? "visible" : "hidden",
                            });
                          }}
                          data-testid={`switch-module-${module.key}`}
                        />
                      </div>
                    </div>

                    {isExpanded && isVisible && (
                      <div className="border-t p-3 bg-muted/30">
                        <h4 className="text-sm font-medium mb-3">{t.konfigurator.fieldPermissions}</h4>
                        <div className="grid gap-2">
                          {module.fields.map((field) => {
                            const permission = getFieldPermission(module.key, field.key);
                            return (
                              <div
                                key={field.key}
                                className="flex items-center justify-between gap-2 p-2 rounded bg-background"
                                data-testid={`field-${module.key}-${field.key}`}
                              >
                                <span className="text-sm">{field.label}</span>
                                <Select
                                  value={permission}
                                  onValueChange={(value: FieldPermission) => {
                                    updateFieldPermission.mutate({
                                      roleId: selectedRole.id,
                                      moduleKey: module.key,
                                      fieldKey: field.key,
                                      permission: value,
                                    });
                                  }}
                                >
                                  <SelectTrigger className="w-32" data-testid={`select-field-${module.key}-${field.key}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="editable">{t.konfigurator.editable}</SelectItem>
                                    <SelectItem value="readonly">{t.konfigurator.readonly}</SelectItem>
                                    <SelectItem value="hidden">{t.konfigurator.hidden}</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <p>{t.konfigurator.noRoles}</p>
          </div>
        )}
      </div>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditing ? t.konfigurator.editRole : t.konfigurator.addRole}</DialogTitle>
            <DialogDescription>{t.konfigurator.permissionsRolesDescription}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.konfigurator.roleName}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-role-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.konfigurator.roleDescription}</FormLabel>
                    <FormControl>
                      <Textarea {...field} data-testid="textarea-role-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.konfigurator.department}</FormLabel>
                    <Select value={field.value || "none"} onValueChange={(val) => field.onChange(val === "none" ? "" : val)}>
                      <FormControl>
                        <SelectTrigger data-testid="select-department">
                          <SelectValue placeholder={t.konfigurator.selectDepartment} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">{t.konfigurator.noParent}</SelectItem>
                        {dbDepartments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
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
                    <FormLabel>{t.common.active}</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-role-active" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                  {t.common.cancel}
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-role">
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t.common.save}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isCopyDialogOpen} onOpenChange={setIsCopyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.konfigurator.copyRole}</DialogTitle>
            <DialogDescription>{t.konfigurator.copyRoleDescription}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="copyRoleName">{t.konfigurator.newRoleName}</Label>
              <Input
                id="copyRoleName"
                value={copyRoleName}
                onChange={(e) => setCopyRoleName(e.target.value)}
                data-testid="input-copy-role-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsCopyDialogOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button
              onClick={() => {
                if (selectedRole && copyRoleName) {
                  copyMutation.mutate({ roleId: selectedRole.id, name: copyRoleName });
                }
              }}
              disabled={copyMutation.isPending || !copyRoleName}
              data-testid="button-confirm-copy"
            >
              {copyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t.konfigurator.copyRole}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteRole} onOpenChange={(open) => !open && setDeleteRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.konfigurator.deleteRole}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteRole?.isSystem
                ? t.konfigurator.cannotDeleteSystemRole
                : "Are you sure you want to delete this role?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            {!deleteRole?.isSystem && (
              <AlertDialogAction
                onClick={() => deleteRole && deleteMutation.mutate(deleteRole.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t.common.delete}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isDeptFormOpen} onOpenChange={setIsDeptFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditingDept ? t.konfigurator.editDepartment : t.konfigurator.addDepartment}</DialogTitle>
            <DialogDescription>{t.konfigurator.departmentsDescription}</DialogDescription>
          </DialogHeader>
          <Form {...deptForm}>
            <form onSubmit={deptForm.handleSubmit(handleDeptSubmit)} className="space-y-4">
              <FormField
                control={deptForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.konfigurator.departmentName}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-dept-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={deptForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.konfigurator.departmentDescription}</FormLabel>
                    <FormControl>
                      <Textarea {...field} value={field.value || ""} data-testid="textarea-dept-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={deptForm.control}
                name="parentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.konfigurator.parentDepartment}</FormLabel>
                    <Select value={field.value || "none"} onValueChange={(val) => field.onChange(val === "none" ? null : val)}>
                      <FormControl>
                        <SelectTrigger data-testid="select-parent-dept">
                          <SelectValue placeholder={t.konfigurator.noParent} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">{t.konfigurator.noParent}</SelectItem>
                        {dbDepartments.filter(d => d.id !== editingDept?.id).map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="border-t pt-4 mt-4">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {t.konfigurator.contactPerson || "Contact Person"}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={deptForm.control}
                    name="contactFirstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.customers.firstName || "First Name"}</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} data-testid="input-dept-contact-firstname" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={deptForm.control}
                    name="contactLastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.customers.lastName || "Last Name"}</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} data-testid="input-dept-contact-lastname" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <FormField
                    control={deptForm.control}
                    name="contactEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {t.common.email || "Email"}
                        </FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} type="email" data-testid="input-dept-contact-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={deptForm.control}
                    name="contactPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {t.common.phone || "Phone"}
                        </FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} type="tel" data-testid="input-dept-contact-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDeptFormOpen(false)}>
                  {t.common.cancel}
                </Button>
                <Button type="submit" disabled={createDeptMutation.isPending || updateDeptMutation.isPending} data-testid="button-save-dept">
                  {(createDeptMutation.isPending || updateDeptMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t.common.save}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteDept} onOpenChange={(open) => !open && setDeleteDept(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.konfigurator.deleteDepartment}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this department?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDept && deleteDeptMutation.mutate(deleteDept.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-dept"
            >
              {deleteDeptMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Billing Companies Tab with multi-tab dialog
function BillingCompaniesTab() {
  const { toast } = useToast();
  const { t } = useI18n();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [numberRangeFilter, setNumberRangeFilter] = useState<string>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<BillingDetails | null>(null);
  const [deletingCompany, setDeletingCompany] = useState<BillingDetails | null>(null);
  const [dialogTab, setDialogTab] = useState("postal");

  const userCountryCodes = user?.assignedCountries && user.assignedCountries.length > 0 ? user.assignedCountries : null;
  const availableCountries = userCountryCodes 
    ? COUNTRIES.filter(c => userCountryCodes.includes(c.code))
    : COUNTRIES;

  const { data: billingCompanies = [], isLoading } = useQuery<BillingDetails[]>({
    queryKey: ["/api/billing-details"],
  });

  const { data: allLaboratories = [] } = useQuery<any[]>({
    queryKey: ["/api/config/laboratories"],
  });

  const { data: allCollaborators = [] } = useQuery<any[]>({
    queryKey: ["/api/collaborators"],
  });

  const { data: allNumberRanges = [] } = useQuery<NumberRange[]>({
    queryKey: ["/api/configurator/number-ranges"],
  });

  const filteredCompanies = billingCompanies.filter(company => {
    // Check countryCodes array, fallback to countryCode
    const companyCountries = company.countryCodes?.length ? company.countryCodes : [company.countryCode];
    
    if (userCountryCodes && !companyCountries.some(c => userCountryCodes.includes(c))) return false;
    if (countryFilter !== "all" && !companyCountries.includes(countryFilter)) return false;
    
    // Filter by number range - check if billing company has the selected number range assigned
    if (numberRangeFilter !== "all") {
      const hasNumberRange = allNumberRanges.some(nr => nr.billingDetailsId === company.id && nr.id === numberRangeFilter);
      if (!hasNumberRange) return false;
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      return (
        company.companyName.toLowerCase().includes(searchLower) ||
        companyCountries.some(c => c.toLowerCase().includes(searchLower)) ||
        (company.code || "").toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/billing-details", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing-details"] });
      setIsFormOpen(false);
      toast({ title: t.common.success, description: t.konfigurator.billingCompanyCreated || "Billing company created" });
    },
    onError: () => {
      toast({ title: t.common.error, description: t.konfigurator.billingCompanyCreateError || "Failed to create billing company", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/billing-details/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing-details"] });
      setIsFormOpen(false);
      setEditingCompany(null);
      toast({ title: t.common.success, description: t.konfigurator.billingCompanyUpdated || "Billing company updated" });
    },
    onError: () => {
      toast({ title: t.common.error, description: t.konfigurator.billingCompanyUpdateError || "Failed to update billing company", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/billing-details/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing-details"] });
      setDeletingCompany(null);
      toast({ title: t.common.success, description: t.konfigurator.billingCompanyDeleted || "Billing company deleted" });
    },
    onError: () => {
      toast({ title: t.common.error, description: t.konfigurator.billingCompanyDeleteError || "Failed to delete billing company", variant: "destructive" });
    },
  });

  const handleAddNew = () => {
    setEditingCompany(null);
    setDialogTab("postal");
    setIsFormOpen(true);
  };

  const handleEdit = (company: BillingDetails) => {
    setEditingCompany(company);
    setDialogTab("postal");
    setIsFormOpen(true);
  };

  const columns = [
    {
      key: "code",
      header: t.common.code || "Code",
      cell: (company: BillingDetails) => company.code || "-",
    },
    {
      key: "companyName",
      header: t.settings.companyName,
      cell: (company: BillingDetails) => company.companyName,
    },
    {
      key: "countryCode",
      header: t.customers.country,
      cell: (company: BillingDetails) => {
        // Show all countries from countryCodes array, fallback to single countryCode
        const countryCodes = company.countryCodes?.length ? company.countryCodes : [company.countryCode];
        return (
          <div className="flex flex-wrap gap-1">
            {countryCodes.map(code => {
              const country = COUNTRIES.find(c => c.code === code);
              return <Badge key={code} variant="outline">{country?.name || code}</Badge>;
            })}
          </div>
        );
      },
    },
    {
      key: "isDefault",
      header: t.common.default || "Default",
      cell: (company: BillingDetails) => (
        company.isDefault ? <Badge variant="secondary">{t.common.default || "Default"}</Badge> : null
      ),
    },
    {
      key: "isActive",
      header: t.common.status,
      cell: (company: BillingDetails) => (
        <Badge variant={company.isActive ? "default" : "secondary"}>
          {company.isActive ? t.common.active : t.common.inactive}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      cell: (company: BillingDetails) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => handleEdit(company)} data-testid={`button-edit-billing-${company.id}`}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDeletingCompany(company)} data-testid={`button-delete-billing-${company.id}`}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t.common.search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-billing-companies"
            />
          </div>
          <Select value={countryFilter} onValueChange={setCountryFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-billing-country-filter">
              <SelectValue placeholder={t.customers.country} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.common.all || "All"} {t.customers.country}</SelectItem>
              {availableCountries.map((country) => (
                <SelectItem key={country.code} value={country.code}>{country.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={numberRangeFilter} onValueChange={setNumberRangeFilter}>
            <SelectTrigger className="w-[200px]" data-testid="select-billing-number-range-filter">
              <SelectValue placeholder={t.konfigurator.numberRanges || "Number Ranges"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.common.all || "All"} {t.konfigurator.numberRanges || "Number Ranges"}</SelectItem>
              {allNumberRanges.map((range) => (
                <SelectItem key={range.id} value={range.id}>{range.name} ({range.year})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleAddNew} data-testid="button-add-billing-company">
          <Plus className="mr-2 h-4 w-4" />
          {t.konfigurator.addBillingCompany || "Add Billing Company"}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DataTable columns={columns} data={filteredCompanies} getRowKey={(company) => company.id} />
      )}

      <BillingCompanyDialog
        open={isFormOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsFormOpen(false);
            setEditingCompany(null);
          }
        }}
        billingCompany={editingCompany}
        activeTab={dialogTab}
        onTabChange={setDialogTab}
        laboratories={allLaboratories}
        collaborators={allCollaborators}
        onSave={(data) => {
          if (editingCompany) {
            updateMutation.mutate({ id: editingCompany.id, data });
          } else {
            createMutation.mutate(data);
          }
        }}
        isPending={createMutation.isPending || updateMutation.isPending}
      />

      <AlertDialog open={!!deletingCompany} onOpenChange={(open) => !open && setDeletingCompany(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.konfigurator.deleteBillingCompany || "Delete Billing Company"}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.konfigurator.deleteBillingCompanyConfirm || "Are you sure you want to delete this billing company? This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCompany && deleteMutation.mutate(deletingCompany.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-billing"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Billing Company Multi-Tab Dialog Component
function BillingCompanyDialog({
  open,
  onOpenChange,
  billingCompany,
  activeTab,
  onTabChange,
  laboratories,
  collaborators,
  onSave,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billingCompany: BillingDetails | null;
  activeTab: string;
  onTabChange: (tab: string) => void;
  laboratories: any[];
  collaborators: any[];
  onSave: (data: any) => void;
  isPending: boolean;
}) {
  const { t } = useI18n();
  const [formData, setFormData] = useState<any>({});
  const [selectedLabs, setSelectedLabs] = useState<string[]>([]);
  const [selectedCollaborators, setSelectedCollaborators] = useState<string[]>([]);

  useEffect(() => {
    if (billingCompany) {
      setFormData({
        countryCode: billingCompany.countryCode || "",
        countryCodes: billingCompany.countryCodes?.length ? billingCompany.countryCodes : (billingCompany.countryCode ? [billingCompany.countryCode] : []),
        code: billingCompany.code || "",
        entityCode: billingCompany.entityCode || "",
        invoiceBarcodeLetter: billingCompany.invoiceBarcodeLetter || "",
        companyName: billingCompany.companyName || "",
        address: billingCompany.address || "",
        city: billingCompany.city || "",
        postalCode: billingCompany.postalCode || "",
        taxId: billingCompany.taxId || "",
        postalName: billingCompany.postalName || "",
        postalStreet: billingCompany.postalStreet || "",
        postalCity: billingCompany.postalCity || "",
        postalPostalCode: billingCompany.postalPostalCode || "",
        postalArea: billingCompany.postalArea || "",
        postalCountry: billingCompany.postalCountry || "",
        residencyName: billingCompany.residencyName || "",
        residencyStreet: billingCompany.residencyStreet || "",
        residencyCity: billingCompany.residencyCity || "",
        residencyPostalCode: billingCompany.residencyPostalCode || "",
        residencyArea: billingCompany.residencyArea || "",
        fullName: billingCompany.fullName || "",
        phone: billingCompany.phone || "",
        email: billingCompany.email || "",
        ico: billingCompany.ico || "",
        dic: billingCompany.dic || "",
        vatNumber: billingCompany.vatNumber || "",
        vatRate: billingCompany.vatRate || "20",
        currency: billingCompany.currency || "EUR",
        webFromEmail: billingCompany.webFromEmail || "",
        coverLetterToEmail: billingCompany.coverLetterToEmail || "",
        defaultLanguage: billingCompany.defaultLanguage || "",
        sentCollectionKitToClient: billingCompany.sentCollectionKitToClient || false,
        allowManualPaymentInsert: billingCompany.allowManualPaymentInsert || false,
        uidIsMandatory: billingCompany.uidIsMandatory || false,
        allowEmptyChildNameInCollection: billingCompany.allowEmptyChildNameInCollection || false,
        isDefault: billingCompany.isDefault || false,
        isActive: billingCompany.isActive ?? true,
        defaultPaymentTerm: billingCompany.defaultPaymentTerm || 14,
        paymentTerms: billingCompany.paymentTerms || [7, 14, 30],
        bankName: billingCompany.bankName || "",
        bankIban: billingCompany.bankIban || "",
        bankSwift: billingCompany.bankSwift || "",
      });
    } else {
      setFormData({
        countryCode: "",
        countryCodes: [],
        code: "",
        entityCode: "",
        invoiceBarcodeLetter: "",
        companyName: "",
        address: "",
        city: "",
        postalCode: "",
        taxId: "",
        postalName: "",
        postalStreet: "",
        postalCity: "",
        postalPostalCode: "",
        postalArea: "",
        postalCountry: "",
        residencyName: "",
        residencyStreet: "",
        residencyCity: "",
        residencyPostalCode: "",
        residencyArea: "",
        fullName: "",
        phone: "",
        email: "",
        ico: "",
        dic: "",
        vatNumber: "",
        vatRate: "20",
        currency: "EUR",
        webFromEmail: "",
        coverLetterToEmail: "",
        defaultLanguage: "",
        sentCollectionKitToClient: false,
        allowManualPaymentInsert: false,
        uidIsMandatory: false,
        allowEmptyChildNameInCollection: false,
        isDefault: false,
        isActive: true,
        defaultPaymentTerm: 14,
        paymentTerms: [7, 14, 30],
        bankName: "",
        bankIban: "",
        bankSwift: "",
      });
      setSelectedLabs([]);
      setSelectedCollaborators([]);
    }
  }, [billingCompany, open]);

  const handleSubmit = () => {
    if (!formData.companyName || !formData.countryCodes?.length) {
      return;
    }
    // Set primary countryCode from first selected country for backward compatibility
    const dataToSave = {
      ...formData,
      countryCode: formData.countryCodes[0] || formData.countryCode,
    };
    onSave(dataToSave);
  };

  const updateField = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {billingCompany ? (t.konfigurator.editBillingCompany || "Edit Billing Company") : (t.konfigurator.addBillingCompany || "Add Billing Company")}
          </DialogTitle>
        </DialogHeader>

        {/* Wizard Step Indicator */}
        <div className="flex flex-wrap items-center justify-center gap-1 py-3 border-b mb-4">
          {[
            { key: "postal", label: t.konfigurator.postalAddress || "Postal Address" },
            { key: "residency", label: t.konfigurator.residencyAddress || "Residency Address" },
            { key: "details", label: t.common.detail || "Details" },
            ...(billingCompany ? [
              { key: "accounts", label: t.konfigurator.accounts || "Accounts" },
              { key: "couriers", label: t.konfigurator.couriers || "Couriers" },
              { key: "laboratories", label: t.settings.laboratories },
              { key: "collaborators", label: t.collaborators?.title || "Collaborators" },
              { key: "history", label: t.konfigurator.historicalData || "History" },
            ] : [])
          ].map((step, index, arr) => (
            <div key={step.key} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onTabChange(step.key)}
                className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium transition-colors ${
                  activeTab === step.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                data-testid={`wizard-step-${step.key}`}
              >
                {index + 1}
              </button>
              <span className={`text-xs hidden lg:inline max-w-[80px] truncate ${activeTab === step.key ? "font-medium" : "text-muted-foreground"}`}>
                {step.label}
              </span>
              {index < arr.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            </div>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={onTabChange} className="mt-4">
          <TabsList className="hidden">
            <TabsTrigger value="postal">Postal</TabsTrigger>
            <TabsTrigger value="residency">Residency</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
            <TabsTrigger value="couriers">Couriers</TabsTrigger>
            <TabsTrigger value="laboratories">Labs</TabsTrigger>
            <TabsTrigger value="collaborators">Collaborators</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="postal" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t.konfigurator.countriesForBilling} *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between" data-testid="select-billing-countries">
                      {formData.countryCodes?.length > 0 
                        ? COUNTRIES.filter(c => formData.countryCodes?.includes(c.code)).map(c => c.name).join(", ")
                        : t.common.select
                      }
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-2" align="start">
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {COUNTRIES.map((country) => (
                        <div key={country.code} className="flex items-center space-x-2">
                          <Checkbox
                            id={`country-${country.code}`}
                            checked={formData.countryCodes?.includes(country.code) || false}
                            onCheckedChange={(checked) => {
                              const current = formData.countryCodes || [];
                              if (checked) {
                                updateField("countryCodes", [...current, country.code]);
                              } else {
                                updateField("countryCodes", current.filter((c: string) => c !== country.code));
                              }
                            }}
                            data-testid={`checkbox-country-${country.code}`}
                          />
                          <label htmlFor={`country-${country.code}`} className="text-sm cursor-pointer flex-1">
                            {country.flag} {country.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>{t.common.code || "Code"}</Label>
                <Input value={formData.code || ""} onChange={(e) => updateField("code", e.target.value)} data-testid="input-billing-code" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t.settings.companyName} *</Label>
              <Input value={formData.companyName || ""} onChange={(e) => updateField("companyName", e.target.value)} data-testid="input-billing-company-name" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t.konfigurator.postalName || "Postal Name"}</Label>
                <Input value={formData.postalName || ""} onChange={(e) => updateField("postalName", e.target.value)} data-testid="input-billing-postal-name" />
              </div>
              <div className="space-y-2">
                <Label>{t.settings.address}</Label>
                <Input value={formData.postalStreet || ""} onChange={(e) => updateField("postalStreet", e.target.value)} data-testid="input-billing-postal-street" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t.settings.city}</Label>
                <Input value={formData.postalCity || ""} onChange={(e) => updateField("postalCity", e.target.value)} data-testid="input-billing-postal-city" />
              </div>
              <div className="space-y-2">
                <Label>{t.settings.postalCode}</Label>
                <Input value={formData.postalPostalCode || ""} onChange={(e) => updateField("postalPostalCode", e.target.value)} data-testid="input-billing-postal-code" />
              </div>
              <div className="space-y-2">
                <Label>{t.konfigurator.area || "Area"}</Label>
                <Input value={formData.postalArea || ""} onChange={(e) => updateField("postalArea", e.target.value)} data-testid="input-billing-postal-area" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t.konfigurator.postalCountry || "Postal Country"}</Label>
                <Select value={formData.postalCountry || ""} onValueChange={(v) => updateField("postalCountry", v)}>
                  <SelectTrigger data-testid="select-billing-postal-country">
                    <SelectValue placeholder={t.common.select} />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((country) => (
                      <SelectItem key={country.code} value={country.code}>{country.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t.konfigurator.invoiceBarcodeLetter || "Invoice Barcode Letter"}</Label>
                <Select value={formData.invoiceBarcodeLetter || ""} onValueChange={(v) => updateField("invoiceBarcodeLetter", v)}>
                  <SelectTrigger data-testid="select-billing-barcode-letter">
                    <SelectValue placeholder={t.common.select} />
                  </SelectTrigger>
                  <SelectContent>
                    {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => (
                      <SelectItem key={letter} value={letter}>{letter}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-6 pt-4">
              <div className="flex items-center space-x-2">
                <Switch checked={formData.isActive} onCheckedChange={(v) => updateField("isActive", v)} data-testid="switch-billing-active" />
                <Label>{t.common.active}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch checked={formData.isDefault} onCheckedChange={(v) => updateField("isDefault", v)} data-testid="switch-billing-default" />
                <Label>{t.common.default || "Default"}</Label>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="residency" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>{t.konfigurator.residencyName || "Name"}</Label>
              <Input 
                value={formData.residencyName || ""} 
                onChange={(e) => updateField("residencyName", e.target.value)} 
                data-testid="input-billing-residency-name" 
              />
            </div>

            <div className="space-y-2">
              <Label>{t.konfigurator.residencyStreet || "Street and House Number"}</Label>
              <Input 
                value={formData.residencyStreet || ""} 
                onChange={(e) => updateField("residencyStreet", e.target.value)} 
                data-testid="input-billing-residency-street" 
              />
            </div>

            <div className="space-y-2">
              <Label>{t.konfigurator.residencyCity || "City"}</Label>
              <Input 
                value={formData.residencyCity || ""} 
                onChange={(e) => updateField("residencyCity", e.target.value)} 
                data-testid="input-billing-residency-city" 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t.settings.postalCode}</Label>
                <Input 
                  value={formData.residencyPostalCode || ""} 
                  onChange={(e) => updateField("residencyPostalCode", e.target.value)} 
                  data-testid="input-billing-residency-postal-code" 
                />
              </div>
              <div className="space-y-2">
                <Label>{t.konfigurator.residencyArea || "Area"}</Label>
                <Input 
                  value={formData.residencyArea || ""} 
                  onChange={(e) => updateField("residencyArea", e.target.value)} 
                  data-testid="input-billing-residency-area" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t.customers.country}</Label>
              <Select 
                value={formData.residencyCountry || ""} 
                onValueChange={(value) => updateField("residencyCountry", value)}
              >
                <SelectTrigger data-testid="select-billing-residency-country">
                  <SelectValue placeholder={t.common.select} />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((country) => (
                    <SelectItem key={country.code} value={country.code}>
                      {country.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="details" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t.konfigurator.fullName || "Full Name"}</Label>
                <Input value={formData.fullName || ""} onChange={(e) => updateField("fullName", e.target.value)} data-testid="input-billing-fullname" />
              </div>
              <div className="space-y-2">
                <Label>{t.konfigurator.entityCode || "Entity Code"}</Label>
                <Input value={formData.entityCode || ""} onChange={(e) => updateField("entityCode", e.target.value)} data-testid="input-billing-entity-code" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t.common.phone || "Phone"}</Label>
                <Input value={formData.phone || ""} onChange={(e) => updateField("phone", e.target.value)} data-testid="input-billing-phone" />
              </div>
              <div className="space-y-2">
                <Label>{t.common.email || "Email"}</Label>
                <Input type="email" value={formData.email || ""} onChange={(e) => updateField("email", e.target.value)} data-testid="input-billing-email" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t.konfigurator.ico || "IČO"}</Label>
                <Input value={formData.ico || ""} onChange={(e) => updateField("ico", e.target.value)} data-testid="input-billing-ico" />
              </div>
              <div className="space-y-2">
                <Label>{t.konfigurator.dic || "DIČ"}</Label>
                <Input value={formData.dic || ""} onChange={(e) => updateField("dic", e.target.value)} data-testid="input-billing-dic" />
              </div>
              <div className="space-y-2">
                <Label>{t.konfigurator.vatNumber || "VAT Number"}</Label>
                <Input value={formData.vatNumber || ""} onChange={(e) => updateField("vatNumber", e.target.value)} data-testid="input-billing-vat-number" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t.settings.vatRate}</Label>
                <Input type="number" value={formData.vatRate || ""} onChange={(e) => updateField("vatRate", e.target.value)} data-testid="input-billing-vat-rate" />
              </div>
              <div className="space-y-2">
                <Label>{t.settings.currency}</Label>
                <Select value={formData.currency || "EUR"} onValueChange={(v) => updateField("currency", v)}>
                  <SelectTrigger data-testid="select-billing-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t.konfigurator.webFromEmail || "Web From Email"}</Label>
                <Input type="email" value={formData.webFromEmail || ""} onChange={(e) => updateField("webFromEmail", e.target.value)} data-testid="input-billing-web-email" />
              </div>
              <div className="space-y-2">
                <Label>{t.konfigurator.coverLetterToEmail || "Cover Letter To Email"}</Label>
                <Input type="email" value={formData.coverLetterToEmail || ""} onChange={(e) => updateField("coverLetterToEmail", e.target.value)} data-testid="input-billing-cover-email" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t.konfigurator.defaultLanguage || "Default Language"}</Label>
              <Select value={formData.defaultLanguage || ""} onValueChange={(v) => updateField("defaultLanguage", v)}>
                <SelectTrigger data-testid="select-billing-language">
                  <SelectValue placeholder={t.common.select} />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((country) => (
                    <SelectItem key={country.code} value={country.code}>{country.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border rounded-lg p-4 space-y-3 mt-4">
              <h4 className="font-medium">{t.konfigurator.businessRules || "Business Rules"}</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch checked={formData.sentCollectionKitToClient} onCheckedChange={(v) => updateField("sentCollectionKitToClient", v)} data-testid="switch-billing-collection-kit" />
                  <Label className="text-sm">{t.konfigurator.sentCollectionKitToClient || "Send collection kit to client"}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch checked={formData.allowManualPaymentInsert} onCheckedChange={(v) => updateField("allowManualPaymentInsert", v)} data-testid="switch-billing-manual-payment" />
                  <Label className="text-sm">{t.konfigurator.allowManualPaymentInsert || "Allow manual payment insert"}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch checked={formData.uidIsMandatory} onCheckedChange={(v) => updateField("uidIsMandatory", v)} data-testid="switch-billing-uid-mandatory" />
                  <Label className="text-sm">{t.konfigurator.uidIsMandatory || "UID is mandatory"}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch checked={formData.allowEmptyChildNameInCollection} onCheckedChange={(v) => updateField("allowEmptyChildNameInCollection", v)} data-testid="switch-billing-empty-child" />
                  <Label className="text-sm">{t.konfigurator.allowEmptyChildNameInCollection || "Allow empty child name in collection"}</Label>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            {billingCompany && <BillingCompanyHistoryTab billingDetailsId={billingCompany.id} />}
          </TabsContent>

          <TabsContent value="accounts" className="mt-4">
            {billingCompany && <BillingCompanyAccountsTab billingDetailsId={billingCompany.id} />}
          </TabsContent>

          <TabsContent value="couriers" className="mt-4">
            {billingCompany && <BillingCompanyCouriersTab billingDetailsId={billingCompany.id} />}
          </TabsContent>

          <TabsContent value="laboratories" className="mt-4">
            {billingCompany && (
              <BillingCompanyLabsTab 
                billingDetailsId={billingCompany.id} 
                laboratories={laboratories.filter(l => l.countryCode === billingCompany.countryCode)}
              />
            )}
            {!billingCompany && (
              <div className="text-center py-8 text-muted-foreground">
                {t.konfigurator.noLaboratoriesAvailable || "No laboratories available"}
              </div>
            )}
          </TabsContent>

          <TabsContent value="collaborators" className="mt-4">
            {billingCompany && (
              <BillingCompanyCollaboratorsTab 
                billingDetailsId={billingCompany.id} 
                collaborators={collaborators.filter(c => c.countryCode === billingCompany.countryCode)}
              />
            )}
            {!billingCompany && (
              <div className="text-center py-8 text-muted-foreground">
                {t.konfigurator.noCollaboratorsAvailable || "No collaborators available"}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6 flex justify-between">
          {(() => {
            const allSteps = billingCompany 
              ? ["postal", "residency", "details", "accounts", "couriers", "laboratories", "collaborators", "history"]
              : ["postal", "residency", "details"];
            const currentIndex = allSteps.indexOf(activeTab);
            const isFirstStep = currentIndex === 0;
            const isLastStep = currentIndex === allSteps.length - 1;
            
            return (
              <div className="flex w-full justify-between gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  {t.common.cancel}
                </Button>
                <div className="flex gap-2">
                  {!isFirstStep && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => onTabChange(allSteps[currentIndex - 1])}
                      data-testid="button-wizard-back"
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      {t.konfigurator.previousStep || "Back"}
                    </Button>
                  )}
                  {!isLastStep && (
                    <Button 
                      type="button" 
                      onClick={() => onTabChange(allSteps[currentIndex + 1])}
                      data-testid="button-wizard-next"
                    >
                      {t.konfigurator.nextStep || "Next"}
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  )}
                  <Button 
                    onClick={handleSubmit} 
                    disabled={isPending || !formData.companyName || !formData.countryCodes?.length} 
                    data-testid="button-save-billing-company"
                  >
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t.common.save}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// History Tab - Shows audit log
function BillingCompanyHistoryTab({ billingDetailsId }: { billingDetailsId: string }) {
  const { t } = useI18n();
  const { data: auditLogs = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/billing-details", billingDetailsId, "audit-log"],
    queryFn: async () => {
      const res = await fetch(`/api/billing-details/${billingDetailsId}/audit-log`, { credentials: "include" });
      return res.json();
    },
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (auditLogs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {t.konfigurator.noHistoricalData || "No historical data available"}
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto">
      {auditLogs.map((log) => {
        const user = users.find((u: any) => u.id === log.userId);
        return (
          <div key={log.id} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{user?.fullName || user?.username || t.common.unknown}</span>
                <span className="text-muted-foreground">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="text-sm mt-1">
                <span className="font-medium">{log.fieldName}</span>:{" "}
                <span className="text-muted-foreground line-through">{log.oldValue || "(empty)"}</span>
                {" → "}
                <span>{log.newValue || "(empty)"}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Accounts Tab - Multiple bank accounts
function BillingCompanyAccountsTab({ billingDetailsId }: { billingDetailsId: string }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);

  const { data: accounts = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/billing-details", billingDetailsId, "accounts"],
    queryFn: async () => {
      const res = await fetch(`/api/billing-details/${billingDetailsId}/accounts`, { credentials: "include" });
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/billing-details/${billingDetailsId}/accounts`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing-details", billingDetailsId, "accounts"] });
      setIsAddingAccount(false);
      toast({ title: t.common.success, description: "Account created" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/billing-company-accounts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing-details", billingDetailsId, "accounts"] });
      setEditingAccount(null);
      toast({ title: t.common.success, description: "Account updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/billing-company-accounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing-details", billingDetailsId, "accounts"] });
      toast({ title: t.common.success, description: "Account deleted" });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: (accountId: string) => apiRequest("POST", `/api/billing-details/${billingDetailsId}/accounts/${accountId}/default`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing-details", billingDetailsId, "accounts"] });
      toast({ title: t.common.success, description: "Default account set" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="font-medium">{t.konfigurator.bankAccounts || "Bank Accounts"}</h4>
        <Button size="sm" onClick={() => setIsAddingAccount(true)} data-testid="button-add-account">
          <Plus className="mr-2 h-4 w-4" />
          {t.common.add || "Add"}
        </Button>
      </div>

      {accounts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {t.konfigurator.noAccounts || "No bank accounts configured"}
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map((account: any) => (
            <div key={account.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{account.name || account.bankName || "Account"}</span>
                  {account.isDefault && <Badge variant="secondary">{t.common.default || "Default"}</Badge>}
                  <Badge variant="outline">{account.currency}</Badge>
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {account.iban && <span>IBAN: {account.iban}</span>}
                </div>
              </div>
              <div className="flex gap-1">
                {!account.isDefault && (
                  <Button variant="ghost" size="sm" onClick={() => setDefaultMutation.mutate(account.id)}>
                    <Check className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => setEditingAccount(account)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(account.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <BillingAccountFormDialog
        open={isAddingAccount || !!editingAccount}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddingAccount(false);
            setEditingAccount(null);
          }
        }}
        account={editingAccount}
        onSave={(data) => {
          if (editingAccount) {
            updateMutation.mutate({ id: editingAccount.id, data });
          } else {
            createMutation.mutate(data);
          }
        }}
        isPending={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}

// Bank Account Form Dialog
function BillingAccountFormDialog({
  open,
  onOpenChange,
  account,
  onSave,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: any;
  onSave: (data: any) => void;
  isPending: boolean;
}) {
  const { t } = useI18n();
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    if (account) {
      setFormData({ ...account });
    } else {
      setFormData({
        currency: "EUR",
        name: "",
        bankName: "",
        accountNumber: "",
        accountBankCode: "",
        iban: "",
        swift: "",
        isActive: true,
        isDefault: false,
      });
    }
  }, [account, open]);

  const handleSubmit = () => {
    onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{account ? "Edit Account" : "Add Account"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t.common.name || "Name"}</Label>
              <Input value={formData.name || ""} onChange={(e) => setFormData((p: any) => ({ ...p, name: e.target.value }))} data-testid="input-account-name" />
            </div>
            <div className="space-y-2">
              <Label>{t.settings.currency}</Label>
              <Select value={formData.currency || "EUR"} onValueChange={(v) => setFormData((p: any) => ({ ...p, currency: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t.settings.bankName}</Label>
            <Input value={formData.bankName || ""} onChange={(e) => setFormData((p: any) => ({ ...p, bankName: e.target.value }))} data-testid="input-account-bank" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t.konfigurator.accountNumber || "Account Number"}</Label>
              <Input value={formData.accountNumber || ""} onChange={(e) => setFormData((p: any) => ({ ...p, accountNumber: e.target.value }))} data-testid="input-account-number" />
            </div>
            <div className="space-y-2">
              <Label>{t.konfigurator.bankCode || "Bank Code"}</Label>
              <Input value={formData.accountBankCode || ""} onChange={(e) => setFormData((p: any) => ({ ...p, accountBankCode: e.target.value }))} data-testid="input-account-bank-code" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t.settings.iban}</Label>
              <Input value={formData.iban || ""} onChange={(e) => setFormData((p: any) => ({ ...p, iban: e.target.value }))} data-testid="input-account-iban" />
            </div>
            <div className="space-y-2">
              <Label>{t.settings.swift}</Label>
              <Input value={formData.swift || ""} onChange={(e) => setFormData((p: any) => ({ ...p, swift: e.target.value }))} data-testid="input-account-swift" />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center space-x-2">
              <Switch checked={formData.isActive} onCheckedChange={(v) => setFormData((p: any) => ({ ...p, isActive: v }))} />
              <Label>{t.common.active}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch checked={formData.isDefault} onCheckedChange={(v) => setFormData((p: any) => ({ ...p, isDefault: v }))} />
              <Label>{t.common.default || "Default"}</Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t.common.cancel}
          </Button>
          <Button onClick={handleSubmit} disabled={isPending} data-testid="button-save-account">
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Laboratories Tab
function BillingCompanyLabsTab({ billingDetailsId, laboratories }: { billingDetailsId: string; laboratories: any[] }) {
  const { t } = useI18n();
  const { toast } = useToast();

  const { data: assignedLabs = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/billing-details", billingDetailsId, "laboratories"],
    queryFn: async () => {
      const res = await fetch(`/api/billing-details/${billingDetailsId}/laboratories`, { credentials: "include" });
      return res.json();
    },
  });

  const assignedLabIds = assignedLabs.map((l: any) => l.laboratoryId);

  const saveMutation = useMutation({
    mutationFn: (laboratoryIds: string[]) => apiRequest("PUT", `/api/billing-details/${billingDetailsId}/laboratories`, { laboratoryIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing-details", billingDetailsId, "laboratories"] });
      toast({ title: t.common.success, description: "Laboratories updated" });
    },
  });

  const toggleLab = (labId: string) => {
    const newIds = assignedLabIds.includes(labId)
      ? assignedLabIds.filter((id: string) => id !== labId)
      : [...assignedLabIds, labId];
    saveMutation.mutate(newIds);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {laboratories.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {t.konfigurator.noLaboratoriesAvailable || "No laboratories available for this country"}
        </div>
      ) : (
        laboratories.map((lab: any) => (
          <div key={lab.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <span className="font-medium">{lab.name}</span>
              {lab.code && <span className="text-muted-foreground ml-2">({lab.code})</span>}
            </div>
            <Switch
              checked={assignedLabIds.includes(lab.id)}
              onCheckedChange={() => toggleLab(lab.id)}
              disabled={saveMutation.isPending}
            />
          </div>
        ))
      )}
    </div>
  );
}

// Collaborators Tab
function BillingCompanyCollaboratorsTab({ billingDetailsId, collaborators }: { billingDetailsId: string; collaborators: any[] }) {
  const { t } = useI18n();
  const { toast } = useToast();

  const { data: assignedCollabs = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/billing-details", billingDetailsId, "collaborators"],
    queryFn: async () => {
      const res = await fetch(`/api/billing-details/${billingDetailsId}/collaborators`, { credentials: "include" });
      return res.json();
    },
  });

  const assignedCollabIds = assignedCollabs.map((c: any) => c.collaboratorId);

  const saveMutation = useMutation({
    mutationFn: (collaboratorIds: string[]) => apiRequest("PUT", `/api/billing-details/${billingDetailsId}/collaborators`, { collaboratorIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing-details", billingDetailsId, "collaborators"] });
      toast({ title: t.common.success, description: "Collaborators updated" });
    },
  });

  const toggleCollab = (collabId: string) => {
    const newIds = assignedCollabIds.includes(collabId)
      ? assignedCollabIds.filter((id: string) => id !== collabId)
      : [...assignedCollabIds, collabId];
    saveMutation.mutate(newIds);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {collaborators.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {t.konfigurator.noCollaboratorsAvailable || "No collaborators available for this country"}
        </div>
      ) : (
        collaborators.map((collab: any) => (
          <div key={collab.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <span className="font-medium">{collab.lastName} {collab.firstName}</span>
              {collab.email && <span className="text-muted-foreground ml-2">({collab.email})</span>}
            </div>
            <Switch
              checked={assignedCollabIds.includes(collab.id)}
              onCheckedChange={() => toggleCollab(collab.id)}
              disabled={saveMutation.isPending}
            />
          </div>
        ))
      )}
    </div>
  );
}

// Couriers Tab - Multiple couriers per billing company
function BillingCompanyCouriersTab({ billingDetailsId }: { billingDetailsId: string }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [isAddingCourier, setIsAddingCourier] = useState(false);
  const [editingCourier, setEditingCourier] = useState<any>(null);
  const [deletingCourier, setDeletingCourier] = useState<any>(null);

  const { data: couriers = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/billing-details", billingDetailsId, "couriers"],
    queryFn: async () => {
      const res = await fetch(`/api/billing-details/${billingDetailsId}/couriers`, { credentials: "include" });
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/billing-details/${billingDetailsId}/couriers`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing-details", billingDetailsId, "couriers"] });
      setIsAddingCourier(false);
      toast({ title: t.common.success, description: "Courier created" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      apiRequest("PATCH", `/api/billing-details/${billingDetailsId}/couriers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing-details", billingDetailsId, "couriers"] });
      setEditingCourier(null);
      toast({ title: t.common.success, description: "Courier updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/billing-details/${billingDetailsId}/couriers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/billing-details", billingDetailsId, "couriers"] });
      setDeletingCourier(null);
      toast({ title: t.common.success, description: "Courier deleted" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setIsAddingCourier(true)} data-testid="button-add-courier">
          <Plus className="mr-2 h-4 w-4" />
          {t.konfigurator.addCourier || "Add Courier"}
        </Button>
      </div>

      {couriers.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {t.konfigurator.noCouriersAvailable || "No couriers available"}
        </div>
      ) : (
        <div className="space-y-2">
          {couriers.map((courier: any) => (
            <div key={courier.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{courier.name}</span>
                  {!courier.isActive && (
                    <Badge variant="secondary">{t.common.inactive}</Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground flex flex-wrap gap-3 mt-1">
                  {courier.phone && <span>{courier.phone}</span>}
                  {courier.email && <span>{courier.email}</span>}
                </div>
                {courier.description && (
                  <div className="text-sm text-muted-foreground mt-1">{courier.description}</div>
                )}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => setEditingCourier(courier)} data-testid={`button-edit-courier-${courier.id}`}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setDeletingCourier(courier)} data-testid={`button-delete-courier-${courier.id}`}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Courier Dialog */}
      <CourierFormDialog
        open={isAddingCourier || !!editingCourier}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddingCourier(false);
            setEditingCourier(null);
          }
        }}
        courier={editingCourier}
        onSave={(data) => {
          if (editingCourier) {
            updateMutation.mutate({ id: editingCourier.id, data });
          } else {
            createMutation.mutate(data);
          }
        }}
        isPending={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingCourier} onOpenChange={(open) => !open && setDeletingCourier(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.konfigurator.deleteCourier || "Delete Courier"}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.konfigurator.deleteCourierConfirm || "Are you sure you want to delete this courier?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCourier && deleteMutation.mutate(deletingCourier.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Courier Form Dialog
function CourierFormDialog({
  open,
  onOpenChange,
  courier,
  onSave,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courier: any;
  onSave: (data: any) => void;
  isPending: boolean;
}) {
  const { t } = useI18n();
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    isActive: true,
    description: "",
  });

  useEffect(() => {
    if (courier) {
      setFormData({
        name: courier.name || "",
        phone: courier.phone || "",
        email: courier.email || "",
        isActive: courier.isActive ?? true,
        description: courier.description || "",
      });
    } else {
      setFormData({
        name: "",
        phone: "",
        email: "",
        isActive: true,
        description: "",
      });
    }
  }, [courier, open]);

  const handleSubmit = () => {
    if (!formData.name) return;
    onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {courier ? (t.konfigurator.editCourier || "Edit Courier") : (t.konfigurator.addCourier || "Add Courier")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t.konfigurator.courierName || "Name"} *</Label>
            <Input 
              value={formData.name} 
              onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} 
              data-testid="input-courier-name"
            />
          </div>

          <div className="space-y-2">
            <Label>{t.konfigurator.courierPhone || "Phone"}</Label>
            <Input 
              value={formData.phone} 
              onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))} 
              data-testid="input-courier-phone"
            />
          </div>

          <div className="space-y-2">
            <Label>{t.konfigurator.courierEmail || "Email"}</Label>
            <Input 
              type="email"
              value={formData.email} 
              onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))} 
              data-testid="input-courier-email"
            />
          </div>

          <div className="space-y-2">
            <Label>{t.konfigurator.courierDescription || "Description"}</Label>
            <Textarea 
              value={formData.description} 
              onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))} 
              data-testid="input-courier-description"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch 
              checked={formData.isActive} 
              onCheckedChange={(v) => setFormData(p => ({ ...p, isActive: v }))} 
              data-testid="switch-courier-active"
            />
            <Label>{t.common.active}</Label>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t.common.cancel}
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !formData.name} data-testid="button-save-courier">
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
        <TabsList className="grid w-full grid-cols-7 max-w-5xl">
          <TabsTrigger value="services" className="flex items-center gap-2" data-testid="tab-services">
            <Settings className="h-4 w-4" />
            {t.konfigurator.services}
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center gap-2" data-testid="tab-products">
            <Package className="h-4 w-4" />
            {t.products.title}
          </TabsTrigger>
          <TabsTrigger value="billing" className="flex items-center gap-2" data-testid="tab-billing-companies">
            <Building2 className="h-4 w-4" />
            {t.konfigurator.billingCompanies || "Billing Companies"}
          </TabsTrigger>
          <TabsTrigger value="number-ranges" className="flex items-center gap-2" data-testid="tab-number-ranges">
            <Hash className="h-4 w-4" />
            {t.konfigurator.numberRanges}
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2" data-testid="tab-templates">
            <FileText className="h-4 w-4" />
            {t.konfigurator.invoiceTemplates}
          </TabsTrigger>
          <TabsTrigger value="editor" className="flex items-center gap-2" data-testid="tab-editor">
            <Layout className="h-4 w-4" />
            {t.konfigurator.invoiceEditor}
          </TabsTrigger>
          <TabsTrigger value="permissions" className="flex items-center gap-2" data-testid="tab-permissions">
            <Shield className="h-4 w-4" />
            {t.konfigurator.permissionsRoles}
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

        <TabsContent value="products">
          <Card>
            <CardHeader>
              <CardTitle>{t.products.title}</CardTitle>
              <CardDescription>{t.products.pageDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <ProductsTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing">
          <Card>
            <CardHeader>
              <CardTitle>{t.konfigurator.billingCompanies || "Billing Companies"}</CardTitle>
              <CardDescription>{t.konfigurator.billingCompaniesDescription || "Manage billing companies and their settings"}</CardDescription>
            </CardHeader>
            <CardContent>
              <BillingCompaniesTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="number-ranges">
          <Card>
            <CardHeader>
              <CardTitle>{t.konfigurator.numberRanges}</CardTitle>
              <CardDescription>{t.konfigurator.numberRangesDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <NumberRangesTab />
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

        <TabsContent value="permissions">
          <Card>
            <CardHeader>
              <CardTitle>{t.konfigurator.permissionsRoles}</CardTitle>
              <CardDescription>{t.konfigurator.permissionsRolesDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <PermissionsRolesTab />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
