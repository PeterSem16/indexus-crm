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
import { Plus, Pencil, Trash2, FileText, Settings, Layout, Loader2, Palette, Package, Search, Shield, Copy, ChevronDown, ChevronUp, Eye, EyeOff, Lock, Unlock, Check } from "lucide-react";
import { COUNTRIES } from "@shared/schema";
import { InvoiceDesigner, InvoiceDesignerConfig } from "@/components/invoice-designer";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth-context";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { ServiceConfiguration, InvoiceTemplate, InvoiceLayout, Product, Role, RoleModulePermission, RoleFieldPermission } from "@shared/schema";
import { CRM_MODULES, DEPARTMENTS, type ModuleDefinition, type FieldPermission, type ModuleAccess } from "@shared/permissions-config";

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

  const { data: roles = [], isLoading } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
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
    mutationFn: ({ roleId, moduleKey, access }: { roleId: string; moduleKey: string; access: ModuleAccess }) =>
      apiRequest("PUT", `/api/roles/${roleId}/modules/${moduleKey}`, { access }),
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
    const dept = DEPARTMENTS.find(d => d.id === deptId);
    if (!dept) return deptId;
    const key = deptId as keyof typeof t.konfigurator.departments;
    return t.konfigurator.departments[key] || dept.name;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
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
                    <Select value={field.value || ""} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-department">
                          <SelectValue placeholder={t.konfigurator.selectDepartment} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DEPARTMENTS.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {t.konfigurator.departments[dept.id as keyof typeof t.konfigurator.departments] || dept.name}
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
        <TabsList className="grid w-full grid-cols-5 max-w-3xl">
          <TabsTrigger value="services" className="flex items-center gap-2" data-testid="tab-services">
            <Settings className="h-4 w-4" />
            {t.konfigurator.services}
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center gap-2" data-testid="tab-products">
            <Package className="h-4 w-4" />
            {t.products.title}
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
