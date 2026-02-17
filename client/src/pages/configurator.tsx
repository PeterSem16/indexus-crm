import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useI18n } from "@/i18n";
import { useCountryFilter } from "@/contexts/country-filter-context";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, FileText, Settings, Layout, Loader2, Palette, Package, Search, Shield, Copy, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Eye, EyeOff, Lock, Unlock, Check, Hash, Info, X, DollarSign, Percent, Calculator, CreditCard, TrendingUp, Bell, CheckCircle2, XCircle, Key, AlertTriangle, Upload, FileDown, Edit, Save, Download, ArrowUpDown } from "lucide-react";
import { COUNTRIES, CURRENCIES, getCurrencySymbol } from "@shared/schema";
import { InvoiceDesigner, InvoiceDesignerConfig } from "@/components/invoice-designer";
import { ContractTemplatesManager } from "@/components/contract-templates-manager";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/auth-context";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { ServiceConfiguration, ServiceInstance, InvoiceTemplate, InvoiceLayout, Product, Role, RoleModulePermission, RoleFieldPermission, Department, BillingDetails, NumberRange, ExchangeRate, EmailRoutingRule, EmailTag, GsmSenderConfig } from "@shared/schema";
import { EMAIL_PRIORITIES, EMAIL_IMPORTANCE, EMAIL_CONDITION_TYPES, EMAIL_ACTION_TYPES, GSM_SENDER_ID_TYPES } from "@shared/schema";
import { CRM_MODULES, DEPARTMENTS, type ModuleDefinition, type FieldPermission, type ModuleAccess } from "@shared/permissions-config";
import { Building2, User, Mail, Phone, Smartphone, RefreshCw, Wallet, MessageSquare, Calendar, Clock, Star, Heart, Users, Folder, Send, Inbox, Archive, Bookmark, Tag, Gift, Briefcase, Building, ShoppingCart, Truck, Zap, Award } from "lucide-react";
import { DepartmentTree } from "@/components/department-tree";
import { NotificationRulesManager } from "@/components/notification-center";

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
  type: z.enum(["invoice", "proforma", "contract"]).default("invoice"),
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
  countries: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

type ProductFormData = z.infer<typeof productFormSchema>;

interface MarketProductInstance {
  id: string;
  productId: string;
  countryCode: string;
  name: string;
  isActive: boolean;
  validFrom?: string | null;
  validTo?: string | null;
  billingDetailsId?: string | null;
  createdAt: Date;
}

interface InstancePrice {
  id: string;
  instanceId: string;
  instanceType: string;
  priceType: string;
  amount: string;
  currency: string;
  validFrom?: string | null;
  validTo?: string | null;
  isActive: boolean;
}

interface InstancePaymentOption {
  id: string;
  instanceId: string;
  instanceType: string;
  name: string;
  installments: number;
  intervalMonths: number;
  interestRate: string;
  isActive: boolean;
}

interface InstanceDiscount {
  id: string;
  instanceId: string;
  instanceType: string;
  name: string;
  discountType: string;
  value: string;
  validFrom?: string | null;
  validTo?: string | null;
  isActive: boolean;
}

interface MarketProductService {
  id: string;
  instanceId: string;
  name: string;
  serviceCode: string;
  isActive: boolean;
  createdAt: Date;
}

interface WizardInstance {
  countryCode: string;
  name: string;
  isActive: boolean;
  billingDetailsId: string;
  currency: string;
}

function DateFields({
  label,
  dayValue,
  monthValue,
  yearValue,
  onDayChange,
  onMonthChange,
  onYearChange,
  testIdPrefix,
  yearRange = 20,
  futureYears = 10,
}: {
  label: string;
  dayValue: number;
  monthValue: number;
  yearValue: number;
  onDayChange: (val: number) => void;
  onMonthChange: (val: number) => void;
  onYearChange: (val: number) => void;
  testIdPrefix: string;
  yearRange?: number;
  futureYears?: number;
}) {
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: yearRange + futureYears }, (_, i) => currentYear + futureYears - i);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Select
          value={dayValue?.toString() || ""}
          onValueChange={(v) => onDayChange(parseInt(v))}
        >
          <SelectTrigger className="w-[80px]" data-testid={`select-${testIdPrefix}-day`}>
            <SelectValue placeholder="Deň" />
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
          <SelectTrigger className="w-[100px]" data-testid={`select-${testIdPrefix}-month`}>
            <SelectValue placeholder="Mesiac" />
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
          <SelectTrigger className="w-[100px]" data-testid={`select-${testIdPrefix}-year`}>
            <SelectValue placeholder="Rok" />
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

function parseDateToComponents(dateStr: string | null | undefined): { day: number; month: number; year: number } {
  if (!dateStr) return { day: 0, month: 0, year: 0 };
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return { day: 0, month: 0, year: 0 };
  return {
    day: date.getDate(),
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  };
}

function componentsToISOString(day: number, month: number, year: number): string | null {
  if (!day || !month || !year) return null;
  const date = new Date(year, month - 1, day);
  return date.toISOString();
}

function isoStringToComponents(dateStr: string | null | undefined): { day: number; month: number; year: number } {
  if (!dateStr) return { day: 0, month: 0, year: 0 };
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return { day: 0, month: 0, year: 0 };
  return {
    day: date.getDate(),
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  };
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

// Helper function to generate installments based on calculation mode
function generateInstallments(
  count: number, 
  basePrice: number, 
  calculationMode: "fixed" | "percentage",
  frequency: string
): any[] {
  const installmentLabels = [
    "Prvá splátka", "Druhá splátka", "Tretia splátka", "Štvrtá splátka",
    "Piata splátka", "Šiesta splátka", "Siedma splátka", "Ôsma splátka",
    "Deviata splátka", "Desiata splátka", "Jedenásta splátka", "Dvanásta splátka"
  ];
  
  const frequencyMonths: Record<string, number> = {
    monthly: 1,
    quarterly: 3,
    semi_annually: 6,
    annually: 12
  };
  
  const offsetMonths = frequencyMonths[frequency] || 1;
  
  if (calculationMode === "fixed") {
    const amountPerInstallment = Math.floor((basePrice / count) * 100) / 100;
    const remainder = basePrice - (amountPerInstallment * (count - 1));
    
    return Array.from({ length: count }, (_, i) => ({
      installmentNumber: i + 1,
      label: installmentLabels[i] || `${i + 1}. splátka`,
      calculationType: "fixed",
      amount: i === count - 1 ? remainder.toFixed(2) : amountPerInstallment.toFixed(2),
      percentage: null,
      dueOffsetMonths: i * offsetMonths
    }));
  } else {
    // Percentage mode - equal percentages by default
    const percentPerInstallment = Math.floor((100 / count) * 100) / 100;
    const remainderPercent = 100 - (percentPerInstallment * (count - 1));
    
    return Array.from({ length: count }, (_, i) => ({
      installmentNumber: i + 1,
      label: installmentLabels[i] || `${i + 1}. splátka`,
      calculationType: "percentage",
      amount: ((basePrice * (i === count - 1 ? remainderPercent : percentPerInstallment)) / 100).toFixed(2),
      percentage: i === count - 1 ? remainderPercent.toFixed(2) : percentPerInstallment.toFixed(2),
      dueOffsetMonths: i * offsetMonths
    }));
  }
}

function ProductWizard({ 
  open, 
  onOpenChange,
  onSuccess
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [productData, setProductData] = useState({
    name: "",
    description: "",
    countries: [] as string[],
    isActive: true,
  });
  const [instances, setInstances] = useState<WizardInstance[]>([]);
  const [currentInstanceIndex, setCurrentInstanceIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: billingCompanies = [] } = useQuery<BillingDetails[]>({
    queryKey: ["/api/billing-details"],
    queryFn: async () => {
      const res = await fetch("/api/billing-details", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open,
  });

  const resetWizard = () => {
    setStep(1);
    setProductData({ name: "", description: "", countries: [], isActive: true });
    setInstances([]);
    setCurrentInstanceIndex(0);
  };

  const handleClose = () => {
    resetWizard();
    onOpenChange(false);
  };

  const goToStep2 = () => {
    if (!productData.name.trim()) {
      toast({ title: t.konfigurator.productNameRequired, variant: "destructive" });
      return;
    }
    if (productData.countries.length === 0) {
      toast({ title: "Vyberte aspoň jednu krajinu", variant: "destructive" });
      return;
    }
    const newInstances = productData.countries.map(countryCode => ({
      countryCode,
      name: `${productData.name} - ${countryCode}`,
      isActive: true,
      billingDetailsId: "",
      currency: countryCode === "CZ" ? "CZK" : countryCode === "HU" ? "HUF" : countryCode === "RO" ? "RON" : countryCode === "US" ? "USD" : countryCode === "CH" ? "CHF" : "EUR",
    }));
    setInstances(newInstances);
    setCurrentInstanceIndex(0);
    setStep(2);
  };

  const updateInstanceField = (idx: number, field: string, value: any) => {
    const updated = [...instances];
    (updated[idx] as any)[field] = value;
    setInstances(updated);
  };

  const handleSubmit = async () => {
    if (instances.length === 0) {
      toast({ title: "Nie sú definované žiadne market instances", variant: "destructive" });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const productRes = await apiRequest("POST", "/api/products", productData);
      if (!productRes.ok) {
        throw new Error("Nepodarilo sa vytvoriť produkt");
      }
      const product = await productRes.json();
      
      for (const instance of instances) {
        const instanceRes = await apiRequest("POST", `/api/products/${product.id}/instances`, {
          countryCode: instance.countryCode,
          name: instance.name,
          isActive: instance.isActive,
          billingDetailsId: instance.billingDetailsId || null,
          currency: instance.currency,
        });
        if (!instanceRes.ok) {
          throw new Error(`Nepodarilo sa vytvoriť instance pre ${instance.countryCode}`);
        }
      }
      
      toast({ title: "Produkt bol úspešne vytvorený" });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      handleClose();
      onSuccess?.();
    } catch (error: any) {
      toast({ title: error.message || "Chyba pri vytváraní produktu", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentInstance = instances[currentInstanceIndex];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 1 && "Nový produkt - Základné informácie"}
            {step === 2 && `Nový produkt - Odbery (${currentInstanceIndex + 1}/${instances.length})`}
            {step === 3 && "Nový produkt - Zhrnutie"}
          </DialogTitle>
          <DialogDescription>
            Krok {step} z 3
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex-1 h-2 rounded-full ${s <= step ? 'bg-primary' : 'bg-muted'}`}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label>{t.products.productName}</Label>
              <Input
                value={productData.name}
                onChange={(e) => setProductData({ ...productData, name: e.target.value })}
                placeholder="Názov produktu"
                data-testid="wizard-input-product-name"
              />
            </div>
            <div>
              <Label>{t.products.description}</Label>
              <Textarea
                value={productData.description}
                onChange={(e) => setProductData({ ...productData, description: e.target.value })}
                placeholder="Popis produktu"
                data-testid="wizard-input-product-description"
              />
            </div>
            <div>
              <Label>{t.products.availableInCountries}</Label>
              <div className="grid grid-cols-4 gap-2 mt-2 rounded-lg border p-3">
                {COUNTRIES.map((country) => (
                  <div key={country.code} className="flex items-center gap-2">
                    <Checkbox
                      id={`wizard-country-${country.code}`}
                      checked={productData.countries.includes(country.code)}
                      onCheckedChange={(checked) => {
                        const newCountries = checked
                          ? [...productData.countries, country.code]
                          : productData.countries.filter((c) => c !== country.code);
                        setProductData({ ...productData, countries: newCountries });
                      }}
                    />
                    <Label htmlFor={`wizard-country-${country.code}`} className="text-sm cursor-pointer">{country.name}</Label>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label className="text-base">{t.products.productActive}</Label>
                <p className="text-sm text-muted-foreground">{t.products.productActiveHint}</p>
              </div>
              <Switch
                checked={productData.isActive}
                onCheckedChange={(checked) => setProductData({ ...productData, isActive: checked })}
              />
            </div>
          </div>
        )}

        {step === 2 && currentInstance && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Badge variant="secondary">{currentInstance.countryCode}</Badge>
                  {COUNTRIES.find(c => c.code === currentInstance.countryCode)?.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>{t.common.name}</Label>
                    <Input
                      value={currentInstance.name}
                      onChange={(e) => updateInstanceField(currentInstanceIndex, "name", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>{t.konfigurator.billingCompany}</Label>
                    <Select
                      value={currentInstance.billingDetailsId}
                      onValueChange={(v) => updateInstanceField(currentInstanceIndex, "billingDetailsId", v)}
                    >
                      <SelectTrigger><SelectValue placeholder={t.common.select} /></SelectTrigger>
                      <SelectContent>
                        {billingCompanies.filter(b => b.countryCode === currentInstance.countryCode).map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.companyName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t.konfigurator.currencyLabel}</Label>
                    <Select
                      value={currentInstance.currency}
                      onValueChange={(v) => updateInstanceField(currentInstanceIndex, "currency", v)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["EUR", "USD", "CZK", "HUF", "RON", "CHF"].map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {instances.length > 1 && (
              <div className="flex items-center justify-center gap-2">
                {instances.map((_, idx) => (
                  <Button
                    key={idx}
                    size="sm"
                    variant={idx === currentInstanceIndex ? "default" : "outline"}
                    onClick={() => setCurrentInstanceIndex(idx)}
                  >
                    {instances[idx].countryCode}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{productData.name}</CardTitle>
                <CardDescription>{productData.description || "Bez popisu"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-1">
                  {productData.countries.map(code => (
                    <Badge key={code} variant="secondary">{code}</Badge>
                  ))}
                </div>
                <Badge variant={productData.isActive ? "default" : "secondary"}>
                  {productData.isActive ? t.common.active : t.common.inactive}
                </Badge>
              </CardContent>
            </Card>

            <h4 className="font-medium">Odbery ({instances.length})</h4>
            {instances.map((inst, idx) => (
              <Card key={idx} className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary">{inst.countryCode}</Badge>
                  <span className="font-medium">{inst.name}</span>
                  <Badge variant="outline">{inst.currency}</Badge>
                </div>
              </Card>
            ))}
          </div>
        )}

        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" onClick={handleClose}>{t.common.cancel}</Button>
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Späť
            </Button>
          )}
          {step === 1 && (
            <Button onClick={goToStep2}>
              Ďalej <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === 2 && (
            <Button onClick={() => setStep(3)}>
              Ďalej <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === 3 && (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              Vytvoriť produkt
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Collection Configuration Dialog for selecting prices, discounts, VAT, payment options
function CollectionConfigDialog({ 
  open, 
  onOpenChange, 
  instanceId, 
  instanceName,
  instanceCountry,
  onSave,
  editingItem,
  t
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  instanceId: string; 
  instanceName: string;
  instanceCountry: string;
  onSave: (config: any) => void;
  editingItem?: any;
  t: any;
}) {
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(editingItem?.priceId || null);
  const [selectedDiscountId, setSelectedDiscountId] = useState<string | null>(editingItem?.discountId || null);
  const [selectedVatRateId, setSelectedVatRateId] = useState<string | null>(editingItem?.vatRateId || null);
  const [selectedPaymentOptionId, setSelectedPaymentOptionId] = useState<string | null>(editingItem?.paymentOptionId || null);
  const [quantity, setQuantity] = useState(editingItem?.quantity || 1);

  // Reset state when editingItem changes
  useEffect(() => {
    if (open) {
      setSelectedPriceId(editingItem?.priceId || null);
      setSelectedDiscountId(editingItem?.discountId || null);
      setSelectedVatRateId(editingItem?.vatRateId || null);
      setSelectedPaymentOptionId(editingItem?.paymentOptionId || null);
      setQuantity(editingItem?.quantity || 1);
    }
  }, [open, editingItem]);

  // Fetch all sub-form data for the instance using new unified endpoints
  const { data: prices = [] } = useQuery<any[]>({
    queryKey: ["/api/instance-prices", instanceId, "market_instance"],
    queryFn: async () => {
      const res = await fetch(`/api/instance-prices/${instanceId}/market_instance`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: open && !!instanceId,
  });

  const { data: discounts = [] } = useQuery<any[]>({
    queryKey: ["/api/instance-discounts", instanceId, "market_instance"],
    queryFn: async () => {
      const res = await fetch(`/api/instance-discounts/${instanceId}/market_instance`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: open && !!instanceId,
  });

  const { data: vatRates = [] } = useQuery<any[]>({
    queryKey: ["/api/instance-vat-rates", instanceId, "market_instance"],
    queryFn: async () => {
      const res = await fetch(`/api/instance-vat-rates/${instanceId}/market_instance`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: open && !!instanceId,
  });

  const { data: paymentOptions = [] } = useQuery<any[]>({
    queryKey: ["/api/instance-payment-options", instanceId, "market_instance"],
    queryFn: async () => {
      const res = await fetch(`/api/instance-payment-options/${instanceId}/market_instance`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: open && !!instanceId,
  });

  // Calculate preview
  const selectedPrice = prices.find((p: any) => p.id === selectedPriceId);
  const selectedDiscount = discounts.find((d: any) => d.id === selectedDiscountId);
  const selectedVat = vatRates.find((v: any) => v.id === selectedVatRateId);
  
  const basePrice = parseFloat(selectedPrice?.price || 0);
  let discountAmount = 0;
  if (selectedDiscount) {
    if (selectedDiscount.isPercentage && selectedDiscount.percentageValue) {
      discountAmount = basePrice * (parseFloat(selectedDiscount.percentageValue) / 100);
    } else if (selectedDiscount.isFixed && selectedDiscount.fixedValue) {
      discountAmount = parseFloat(selectedDiscount.fixedValue);
    }
  }
  const netAmount = (basePrice - discountAmount) * quantity;
  const vatRate = parseFloat(selectedVat?.vatRate || 0);
  const vatAmount = netAmount * (vatRate / 100);
  const grossAmount = netAmount + vatAmount;

  const handleSave = () => {
    onSave({
      id: editingItem?.id,
      instanceId,
      priceId: selectedPriceId || null,
      discountId: selectedDiscountId || null,
      vatRateId: selectedVatRateId || null,
      paymentOptionId: selectedPaymentOptionId || null,
      quantity,
      lineNetAmount: netAmount > 0 ? netAmount.toFixed(2) : null,
      lineDiscountAmount: discountAmount > 0 ? discountAmount.toFixed(2) : null,
      lineVatAmount: vatAmount > 0 ? vatAmount.toFixed(2) : null,
      lineGrossAmount: grossAmount > 0 ? grossAmount.toFixed(2) : null,
    });
    onOpenChange(false);
    // Reset
    setSelectedPriceId(null);
    setSelectedDiscountId(null);
    setSelectedVatRateId(null);
    setSelectedPaymentOptionId(null);
    setQuantity(1);
  };

  const isEditing = !!editingItem;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge variant="secondary">{instanceCountry}</Badge>
            {isEditing ? "Editácia odberu:" : "Konfigurácia odberu:"} {instanceName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Prices Section */}
          <div>
            <Label className="text-sm font-medium flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4" /> Cenník
            </Label>
            <div className="border rounded-lg p-2 max-h-32 overflow-y-auto space-y-1">
              {prices.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">Žiadne ceny</p>
              ) : prices.map((price: any) => (
                <div 
                  key={price.id} 
                  className={`p-2 rounded cursor-pointer hover-elevate flex justify-between items-center ${selectedPriceId === price.id ? 'bg-primary/10 border border-primary' : 'border'}`}
                  onClick={() => setSelectedPriceId(price.id)}
                >
                  <div>
                    <span className="text-sm font-medium">{price.name}</span>
                    {price.fromDate && <span className="text-xs text-muted-foreground ml-2">od {formatDate(price.fromDate)}</span>}
                  </div>
                  <Badge variant="outline">{parseFloat(price.price || 0).toFixed(2)} €</Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Discounts Section */}
          <div>
            <Label className="text-sm font-medium flex items-center gap-2 mb-2">
              <Percent className="h-4 w-4" /> Zľavy
            </Label>
            <div className="border rounded-lg p-2 max-h-32 overflow-y-auto space-y-1">
              <div 
                className={`p-2 rounded cursor-pointer hover-elevate flex justify-between items-center ${selectedDiscountId === null ? 'bg-primary/10 border border-primary' : 'border'}`}
                onClick={() => setSelectedDiscountId(null)}
              >
                <span className="text-sm">Bez zľavy</span>
              </div>
              {discounts.map((discount: any) => (
                <div 
                  key={discount.id} 
                  className={`p-2 rounded cursor-pointer hover-elevate flex justify-between items-center ${selectedDiscountId === discount.id ? 'bg-primary/10 border border-primary' : 'border'}`}
                  onClick={() => setSelectedDiscountId(discount.id)}
                >
                  <div>
                    <span className="text-sm font-medium">{discount.name}</span>
                    {discount.fromDate && <span className="text-xs text-muted-foreground ml-2">od {formatDate(discount.fromDate)}</span>}
                  </div>
                  <Badge variant="outline">
                    {discount.isPercentage ? `${discount.percentageValue}%` : `${parseFloat(discount.fixedValue || 0).toFixed(2)} €`}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* VAT Rates Section */}
          <div>
            <Label className="text-sm font-medium flex items-center gap-2 mb-2">
              <Calculator className="h-4 w-4" /> DPH sadzby
            </Label>
            <div className="border rounded-lg p-2 max-h-32 overflow-y-auto space-y-1">
              {vatRates.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">Žiadne DPH sadzby</p>
              ) : vatRates.map((vat: any) => (
                <div 
                  key={vat.id} 
                  className={`p-2 rounded cursor-pointer hover-elevate flex justify-between items-center ${selectedVatRateId === vat.id ? 'bg-primary/10 border border-primary' : 'border'}`}
                  onClick={() => setSelectedVatRateId(vat.id)}
                >
                  <div>
                    <span className="text-sm font-medium">{vat.name || vat.category}</span>
                    {vat.fromDate && <span className="text-xs text-muted-foreground ml-2">od {formatDate(vat.fromDate)}</span>}
                  </div>
                  <Badge variant="outline">{parseFloat(vat.vatRate || 0).toFixed(0)}%</Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Options Section */}
          <div>
            <Label className="text-sm font-medium flex items-center gap-2 mb-2">
              <CreditCard className="h-4 w-4" /> Platobné možnosti
            </Label>
            <div className="border rounded-lg p-2 max-h-32 overflow-y-auto space-y-1">
              <div 
                className={`p-2 rounded cursor-pointer hover-elevate flex justify-between items-center ${selectedPaymentOptionId === null ? 'bg-primary/10 border border-primary' : 'border'}`}
                onClick={() => setSelectedPaymentOptionId(null)}
              >
                <span className="text-sm">{t.konfigurator.noPaymentOption}</span>
              </div>
              {paymentOptions.map((opt: any) => (
                <div 
                  key={opt.id} 
                  className={`p-2 rounded cursor-pointer hover-elevate flex justify-between items-center ${selectedPaymentOptionId === opt.id ? 'bg-primary/10 border border-primary' : 'border'}`}
                  onClick={() => setSelectedPaymentOptionId(opt.id)}
                >
                  <div>
                    <span className="text-sm font-medium">{opt.name}</span>
                    {opt.isMultiPayment && <Badge variant="secondary" className="ml-2 text-xs">{t.konfigurator.installmentsLabel}</Badge>}
                  </div>
                  {opt.paymentTypeFee && <Badge variant="outline">{parseFloat(opt.paymentTypeFee || 0).toFixed(2)} €</Badge>}
                </div>
              ))}
            </div>
          </div>

          {/* Quantity */}
          <div className="flex items-center gap-4">
            <Label className="text-sm font-medium">{t.konfigurator.quantityLabel}:</Label>
            <Input 
              type="number" 
              min="1" 
              value={quantity} 
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              className="w-20"
            />
          </div>

          {/* Preview calculation */}
          <Card className="bg-accent/50">
            <CardContent className="p-4">
              <h4 className="text-sm font-medium mb-2">{t.konfigurator.calculationPreview}</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>{t.konfigurator.basePrice}:</span>
                  <span className="font-mono">{basePrice.toFixed(2)} €</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>{t.konfigurator.discountText}:</span>
                    <span className="font-mono">-{discountAmount.toFixed(2)} €</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>{t.konfigurator.netLabel} ({quantity}x):</span>
                  <span className="font-mono">{netAmount.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between">
                  <span>{t.konfigurator.vatText} ({vatRate}%):</span>
                  <span className="font-mono">{vatAmount.toFixed(2)} €</span>
                </div>
                <Separator className="my-1" />
                <div className="flex justify-between font-bold">
                  <span>{t.konfigurator.totalLabel}:</span>
                  <span className="font-mono">{grossAmount.toFixed(2)} €</span>
                </div>

                {/* Payment breakdown */}
                {selectedPaymentOptionId && (() => {
                  const paymentOpt = paymentOptions.find((p: any) => p.id === selectedPaymentOptionId);
                  if (!paymentOpt) return null;
                  
                  const fee = parseFloat(paymentOpt.paymentTypeFee || 0);
                  const totalWithFee = grossAmount + fee;
                  
                  if (paymentOpt.isMultiPayment && paymentOpt.installmentCount > 1) {
                    const installmentAmount = totalWithFee / paymentOpt.installmentCount;
                    const frequencyLabel = paymentOpt.frequency === 'monthly' ? t.konfigurator.monthly : 
                                          paymentOpt.frequency === 'quarterly' ? t.konfigurator.quarterly : 
                                          paymentOpt.frequency === 'yearly' ? t.konfigurator.yearly : paymentOpt.frequency;
                    return (
                      <>
                        <Separator className="my-2" />
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-2 space-y-1">
                          <div className="flex items-center gap-2 mb-1">
                            <CreditCard className="h-4 w-4 text-blue-600" />
                            <span className="font-medium text-blue-700 dark:text-blue-400">{t.konfigurator.installmentBreakdown}</span>
                          </div>
                          {fee > 0 && (
                            <div className="flex justify-between text-xs">
                              <span>{t.konfigurator.installmentFee}:</span>
                              <span className="font-mono">+{fee.toFixed(2)} €</span>
                            </div>
                          )}
                          <div className="flex justify-between text-xs">
                            <span>{t.konfigurator.withInstallments}:</span>
                            <span className="font-mono">{totalWithFee.toFixed(2)} €</span>
                          </div>
                          <Separator className="my-1" />
                          <div className="flex justify-between font-medium">
                            <span>{paymentOpt.installmentCount}x {frequencyLabel}:</span>
                            <span className="font-mono">{installmentAmount.toFixed(2)} €</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {Array.from({ length: Math.min(paymentOpt.installmentCount, 6) }, (_, i) => (
                              <div key={i} className="flex justify-between">
                                <span>{t.konfigurator.installmentLabel} {i + 1}:</span>
                                <span>{installmentAmount.toFixed(2)} €</span>
                              </div>
                            ))}
                            {paymentOpt.installmentCount > 6 && (
                              <div className="text-center text-muted-foreground">{t.konfigurator.andMoreInstallments.replace('{count}', paymentOpt.installmentCount - 6)}</div>
                            )}
                          </div>
                        </div>
                      </>
                    );
                  } else {
                    return (
                      <>
                        <Separator className="my-2" />
                        <div className="bg-green-50 dark:bg-green-900/20 rounded p-2">
                          <div className="flex items-center gap-2 mb-1">
                            <CreditCard className="h-4 w-4 text-green-600" />
                            <span className="font-medium text-green-700 dark:text-green-400">{t.konfigurator.oneTimePaymentLabel}</span>
                          </div>
                          <div className="flex justify-between font-medium">
                            <span>{t.konfigurator.amountDue}:</span>
                            <span className="font-mono">{grossAmount.toFixed(2)} €</span>
                          </div>
                        </div>
                      </>
                    );
                  }
                })()}
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t.common.cancel}</Button>
          <Button onClick={handleSave} disabled={!selectedPriceId}>
            <Check className="h-4 w-4 mr-2" /> {isEditing ? t.konfigurator.saveChanges : t.konfigurator.addToSet}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Storage Configuration Dialog for selecting prices, discounts, VAT, payment options for storage services
function StorageConfigDialog({ 
  open, 
  onOpenChange, 
  serviceId, 
  serviceName,
  serviceCountry,
  onSave,
  editingItem,
  t
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  serviceId: string; 
  serviceName: string;
  serviceCountry: string;
  onSave: (config: any) => void;
  editingItem?: any;
  t: any;
}) {
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(editingItem?.priceId || null);
  const [selectedDiscountId, setSelectedDiscountId] = useState<string | null>(editingItem?.discountId || null);
  const [selectedVatRateId, setSelectedVatRateId] = useState<string | null>(editingItem?.vatRateId || null);
  const [selectedPaymentOptionId, setSelectedPaymentOptionId] = useState<string | null>(editingItem?.paymentOptionId || null);
  const [quantity, setQuantity] = useState(editingItem?.quantity || 1);

  // Reset state when editingItem changes
  useEffect(() => {
    if (open) {
      setSelectedPriceId(editingItem?.priceId || null);
      setSelectedDiscountId(editingItem?.discountId || null);
      setSelectedVatRateId(editingItem?.vatRateId || null);
      setSelectedPaymentOptionId(editingItem?.paymentOptionId || null);
      setQuantity(editingItem?.quantity || 1);
    }
  }, [open, editingItem]);

  // Fetch all sub-form data for the service using "service" instanceType
  const { data: prices = [] } = useQuery<any[]>({
    queryKey: ["/api/instance-prices", serviceId, "service"],
    queryFn: async () => {
      const res = await fetch(`/api/instance-prices/${serviceId}/service`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: open && !!serviceId,
  });

  const { data: discounts = [] } = useQuery<any[]>({
    queryKey: ["/api/instance-discounts", serviceId, "service"],
    queryFn: async () => {
      const res = await fetch(`/api/instance-discounts/${serviceId}/service`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: open && !!serviceId,
  });

  const { data: vatRates = [] } = useQuery<any[]>({
    queryKey: ["/api/instance-vat-rates", serviceId, "service"],
    queryFn: async () => {
      const res = await fetch(`/api/instance-vat-rates/${serviceId}/service`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: open && !!serviceId,
  });

  const { data: paymentOptions = [] } = useQuery<any[]>({
    queryKey: ["/api/instance-payment-options", serviceId, "service"],
    queryFn: async () => {
      const res = await fetch(`/api/instance-payment-options/${serviceId}/service`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: open && !!serviceId,
  });

  // Calculate preview
  const selectedPrice = prices.find((p: any) => p.id === selectedPriceId);
  const selectedDiscount = discounts.find((d: any) => d.id === selectedDiscountId);
  const selectedVat = vatRates.find((v: any) => v.id === selectedVatRateId);
  
  const basePrice = parseFloat(selectedPrice?.price || 0);
  let discountAmount = 0;
  if (selectedDiscount) {
    if (selectedDiscount.isPercentage && selectedDiscount.percentageValue) {
      discountAmount = basePrice * (parseFloat(selectedDiscount.percentageValue) / 100);
    } else if (selectedDiscount.isFixed && selectedDiscount.fixedValue) {
      discountAmount = parseFloat(selectedDiscount.fixedValue);
    }
  }
  const netAmount = (basePrice - discountAmount) * quantity;
  const vatRate = parseFloat(selectedVat?.vatRate || 0);
  const vatAmount = netAmount * (vatRate / 100);
  const grossAmount = netAmount + vatAmount;

  const handleSave = () => {
    onSave({
      id: editingItem?.id,
      serviceId,
      priceId: selectedPriceId || null,
      discountId: selectedDiscountId || null,
      vatRateId: selectedVatRateId || null,
      paymentOptionId: selectedPaymentOptionId || null,
      quantity,
      priceOverride: grossAmount > 0 ? grossAmount.toFixed(2) : null,
      lineNetAmount: netAmount > 0 ? netAmount.toFixed(2) : null,
      lineDiscountAmount: discountAmount > 0 ? discountAmount.toFixed(2) : null,
      lineVatAmount: vatAmount > 0 ? vatAmount.toFixed(2) : null,
      lineGrossAmount: grossAmount > 0 ? grossAmount.toFixed(2) : null,
    });
    onOpenChange(false);
    // Reset
    setSelectedPriceId(null);
    setSelectedDiscountId(null);
    setSelectedVatRateId(null);
    setSelectedPaymentOptionId(null);
    setQuantity(1);
  };

  const isEditing = !!editingItem;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300">{serviceCountry}</Badge>
            {isEditing ? "Editácia skladovania:" : "Konfigurácia skladovania:"} {serviceName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Prices Section */}
          <div>
            <Label className="text-sm font-medium flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4" /> Cenník
            </Label>
            <div className="border rounded-lg p-2 max-h-32 overflow-y-auto space-y-1">
              {prices.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">Žiadne ceny</p>
              ) : prices.map((price: any) => (
                <div 
                  key={price.id} 
                  className={`p-2 rounded cursor-pointer hover-elevate flex justify-between items-center ${selectedPriceId === price.id ? 'bg-green-100 dark:bg-green-800/50 border border-green-500' : 'border'}`}
                  onClick={() => setSelectedPriceId(price.id)}
                >
                  <div>
                    <span className="text-sm font-medium">{price.name}</span>
                    {price.fromDate && <span className="text-xs text-muted-foreground ml-2">od {formatDate(price.fromDate)}</span>}
                  </div>
                  <Badge variant="outline">{parseFloat(price.price || 0).toFixed(2)} €</Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Discounts Section */}
          <div>
            <Label className="text-sm font-medium flex items-center gap-2 mb-2">
              <Percent className="h-4 w-4" /> Zľavy
            </Label>
            <div className="border rounded-lg p-2 max-h-32 overflow-y-auto space-y-1">
              <div 
                className={`p-2 rounded cursor-pointer hover-elevate flex justify-between items-center ${selectedDiscountId === null ? 'bg-green-100 dark:bg-green-800/50 border border-green-500' : 'border'}`}
                onClick={() => setSelectedDiscountId(null)}
              >
                <span className="text-sm">Bez zľavy</span>
              </div>
              {discounts.map((discount: any) => (
                <div 
                  key={discount.id} 
                  className={`p-2 rounded cursor-pointer hover-elevate flex justify-between items-center ${selectedDiscountId === discount.id ? 'bg-green-100 dark:bg-green-800/50 border border-green-500' : 'border'}`}
                  onClick={() => setSelectedDiscountId(discount.id)}
                >
                  <div>
                    <span className="text-sm font-medium">{discount.name}</span>
                    {discount.fromDate && <span className="text-xs text-muted-foreground ml-2">od {formatDate(discount.fromDate)}</span>}
                  </div>
                  <Badge variant="outline">
                    {discount.isPercentage ? `${discount.percentageValue}%` : `${parseFloat(discount.fixedValue || 0).toFixed(2)} €`}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* VAT Rates Section */}
          <div>
            <Label className="text-sm font-medium flex items-center gap-2 mb-2">
              <Calculator className="h-4 w-4" /> DPH sadzby
            </Label>
            <div className="border rounded-lg p-2 max-h-32 overflow-y-auto space-y-1">
              {vatRates.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">Žiadne DPH sadzby</p>
              ) : vatRates.map((vat: any) => (
                <div 
                  key={vat.id} 
                  className={`p-2 rounded cursor-pointer hover-elevate flex justify-between items-center ${selectedVatRateId === vat.id ? 'bg-green-100 dark:bg-green-800/50 border border-green-500' : 'border'}`}
                  onClick={() => setSelectedVatRateId(vat.id)}
                >
                  <div>
                    <span className="text-sm font-medium">{vat.name || vat.category}</span>
                    {vat.fromDate && <span className="text-xs text-muted-foreground ml-2">od {formatDate(vat.fromDate)}</span>}
                  </div>
                  <Badge variant="outline">{parseFloat(vat.vatRate || 0).toFixed(0)}%</Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Options Section */}
          <div>
            <Label className="text-sm font-medium flex items-center gap-2 mb-2">
              <CreditCard className="h-4 w-4" /> Platobné možnosti
            </Label>
            <div className="border rounded-lg p-2 max-h-32 overflow-y-auto space-y-1">
              <div 
                className={`p-2 rounded cursor-pointer hover-elevate flex justify-between items-center ${selectedPaymentOptionId === null ? 'bg-green-100 dark:bg-green-800/50 border border-green-500' : 'border'}`}
                onClick={() => setSelectedPaymentOptionId(null)}
              >
                <span className="text-sm">{t.konfigurator.noPaymentOption}</span>
              </div>
              {paymentOptions.map((opt: any) => (
                <div 
                  key={opt.id} 
                  className={`p-2 rounded cursor-pointer hover-elevate flex justify-between items-center ${selectedPaymentOptionId === opt.id ? 'bg-green-100 dark:bg-green-800/50 border border-green-500' : 'border'}`}
                  onClick={() => setSelectedPaymentOptionId(opt.id)}
                >
                  <div>
                    <span className="text-sm font-medium">{opt.name}</span>
                    {opt.isMultiPayment && <Badge variant="secondary" className="ml-2 text-xs">{t.konfigurator.installmentsLabel}</Badge>}
                  </div>
                  {opt.paymentTypeFee && <Badge variant="outline">{parseFloat(opt.paymentTypeFee || 0).toFixed(2)} €</Badge>}
                </div>
              ))}
            </div>
          </div>

          {/* Quantity */}
          <div className="flex items-center gap-4">
            <Label className="text-sm font-medium">{t.konfigurator.quantityLabel}:</Label>
            <Input 
              type="number" 
              min="1" 
              value={quantity} 
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              className="w-20"
            />
          </div>

          {/* Preview calculation */}
          <Card className="bg-green-50 dark:bg-green-900/20">
            <CardContent className="p-4">
              <h4 className="text-sm font-medium mb-2 text-green-800 dark:text-green-200">{t.konfigurator.calculationPreview}</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>{t.konfigurator.basePrice}:</span>
                  <span className="font-mono">{basePrice.toFixed(2)} €</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>{t.konfigurator.discountText}:</span>
                    <span className="font-mono">-{discountAmount.toFixed(2)} €</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>{t.konfigurator.netLabel} ({quantity}x):</span>
                  <span className="font-mono">{netAmount.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between">
                  <span>{t.konfigurator.vatText} ({vatRate}%):</span>
                  <span className="font-mono">{vatAmount.toFixed(2)} €</span>
                </div>
                <Separator className="my-1" />
                <div className="flex justify-between font-bold text-green-800 dark:text-green-200">
                  <span>{t.konfigurator.totalLabel}:</span>
                  <span className="font-mono">{grossAmount.toFixed(2)} €</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t.common.cancel}</Button>
          <Button onClick={handleSave} disabled={!selectedPriceId} className="bg-green-600 hover:bg-green-700">
            <Check className="h-4 w-4 mr-2" /> {isEditing ? t.konfigurator.saveChanges : t.konfigurator.addToSet}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Payment breakdown component for invoice preview
function PaymentBreakdownItem({ 
  instanceId, 
  instanceName, 
  paymentOptionId, 
  amount,
  storageIncluded = false,
  storageAmount = 0,
  collectionAmount = 0,
  currencySymbol = "€",
  t
}: { 
  instanceId: string; 
  instanceName: string; 
  paymentOptionId: string; 
  amount: number;
  storageIncluded?: boolean;
  storageAmount?: number;
  collectionAmount?: number;
  currencySymbol?: string;
  t: any;
}) {
  const { data: paymentOptions = [] } = useQuery<any[]>({
    queryKey: ["/api/instance-payment-options", instanceId, "market_instance"],
    queryFn: async () => {
      const res = await fetch(`/api/instance-payment-options/${instanceId}/market_instance`, { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: !!instanceId && !!paymentOptionId,
  });

  const paymentOption = paymentOptions.find((p: any) => p.id === paymentOptionId);
  
  if (!paymentOption) {
    return null;
  }

  const fee = parseFloat(paymentOption.paymentTypeFee || 0);
  const totalWithFee = amount + fee;

  if (paymentOption.isMultiPayment && paymentOption.installmentCount > 1) {
    const installmentAmount = totalWithFee / paymentOption.installmentCount;
    const frequencyLabel = paymentOption.frequency === 'monthly' ? t.konfigurator.monthly : 
                          paymentOption.frequency === 'quarterly' ? t.konfigurator.quarterly : 
                          paymentOption.frequency === 'yearly' ? t.konfigurator.yearly : paymentOption.frequency;
    
    return (
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <CreditCard className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-400">{instanceName}</span>
          <Badge variant="secondary" className="text-xs">{t.konfigurator.installmentsLabel}</Badge>
          {storageIncluded && <Badge variant="outline" className="text-xs bg-green-100 dark:bg-green-800 border-green-300 dark:border-green-700">{t.konfigurator.storageAddOn}</Badge>}
        </div>
        <div className="text-xs space-y-1">
          <div className="flex justify-between">
            <span>{t.konfigurator.paymentType}:</span>
            <span className="font-medium">{paymentOption.name}</span>
          </div>
          {storageIncluded && (
            <>
              <div className="flex justify-between text-blue-600 dark:text-blue-400">
                <span>{t.konfigurator.collectionItem}:</span>
                <span>{collectionAmount.toFixed(2)} {currencySymbol}</span>
              </div>
              <div className="flex justify-between text-green-600 dark:text-green-400">
                <span>{t.konfigurator.storageItem}:</span>
                <span>+{storageAmount.toFixed(2)} {currencySymbol}</span>
              </div>
            </>
          )}
          {fee > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>{t.konfigurator.feeLabel}:</span>
              <span>+{fee.toFixed(2)} {currencySymbol}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>{t.konfigurator.totalLabel}:</span>
            <span className="font-medium">{totalWithFee.toFixed(2)} {currencySymbol}</span>
          </div>
          <Separator className="my-1" />
          <div className="flex justify-between font-medium text-blue-700 dark:text-blue-400">
            <span>{paymentOption.installmentCount}x {frequencyLabel}:</span>
            <span>{installmentAmount.toFixed(2)} {currencySymbol}</span>
          </div>
          <div className="pt-1 border-t border-blue-200 dark:border-blue-800 mt-1 space-y-0.5">
            {Array.from({ length: Math.min(paymentOption.installmentCount, 6) }, (_, i) => (
              <div key={i} className="flex justify-between text-muted-foreground">
                <span>{t.konfigurator.installmentLabel} {i + 1}:</span>
                <span>{installmentAmount.toFixed(2)} {currencySymbol}</span>
              </div>
            ))}
            {paymentOption.installmentCount > 6 && (
              <div className="text-center text-xs text-muted-foreground pt-1">
                {t.konfigurator.andMoreInstallments.replace('{count}', paymentOption.installmentCount - 6)}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  } else {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-1">
          <CreditCard className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium text-green-700 dark:text-green-400">{instanceName}</span>
          <Badge variant="outline" className="text-xs">{t.konfigurator.oneTimePayment}</Badge>
        </div>
        <div className="text-xs space-y-1">
          <div className="flex justify-between">
            <span>{t.konfigurator.paymentType}:</span>
            <span className="font-medium">{paymentOption.name}</span>
          </div>
          <div className="flex justify-between font-medium text-green-700 dark:text-green-400">
            <span>{t.konfigurator.amountDue}:</span>
            <span>{amount.toFixed(2)} {currencySymbol}</span>
          </div>
        </div>
      </div>
    );
  }
}

// Zostavy Tab Component for Product Sets
function ZostavyTab({ productId, instances, t }: { productId: string; instances: any[]; t: any }) {
  const { toast } = useToast();
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [isAddingSet, setIsAddingSet] = useState(false);
  const [configuringInstanceId, setConfiguringInstanceId] = useState<string | null>(null);
  const [editingCollectionItem, setEditingCollectionItem] = useState<any>(null);
  const [editingStorageItem, setEditingStorageItem] = useState<any>(null);
  const [addingStorageServiceId, setAddingStorageServiceId] = useState<string | null>(null);
  const [configuringStorageService, setConfiguringStorageService] = useState<any>(null);
  const [newItemPrice, setNewItemPrice] = useState<string>("");
  const [isEditingSetName, setIsEditingSetName] = useState(false);
  const [editedSetName, setEditedSetName] = useState("");
  const [newSetData, setNewSetData] = useState({
    name: "",
    countryCode: null as string | null,
    fromDay: 0, fromMonth: 0, fromYear: 0,
    toDay: 0, toMonth: 0, toYear: 0,
    currency: "EUR",
    notes: "",
    isActive: true,
    emailAlertEnabled: false
  });
  const [isEditingSetDetails, setIsEditingSetDetails] = useState(false);
  const [editSetDetails, setEditSetDetails] = useState<any>(null);

  // Fetch ALL storage services for the product (independent of collection selection)
  const { data: allStorageServices = [] } = useQuery<any[]>({
    queryKey: ["/api/products", productId, "all-services"],
    queryFn: async () => {
      // Get services from all instances
      const allServices: any[] = [];
      for (const inst of instances) {
        const res = await fetch(`/api/product-instances/${inst.id}/services`, { credentials: "include" });
        if (res.ok) {
          const services = await res.json();
          allServices.push(...services.map((s: any) => ({ ...s, instanceName: inst.name, instanceCountryCode: inst.countryCode })));
        }
      }
      return allServices;
    },
    enabled: instances.length > 0,
  });

  // Fetch product sets
  const { data: productSets = [], refetch: refetchSets } = useQuery<any[]>({
    queryKey: ["/api/products", productId, "sets"],
    queryFn: async () => {
      const res = await fetch(`/api/products/${productId}/sets`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch sets");
      return res.json();
    },
  });

  // Fetch selected set with details
  const { data: selectedSet } = useQuery<any>({
    queryKey: ["/api/product-sets", selectedSetId],
    queryFn: async () => {
      if (!selectedSetId) return null;
      const res = await fetch(`/api/product-sets/${selectedSetId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch set");
      return res.json();
    },
    enabled: !!selectedSetId,
  });

  const createSetMutation = useMutation({
    mutationFn: async (data: any) => {
      const fromDate = componentsToISOString(data.fromDay, data.fromMonth, data.fromYear);
      const toDate = componentsToISOString(data.toDay, data.toMonth, data.toYear);
      return apiRequest("POST", `/api/products/${productId}/sets`, {
        name: data.name,
        countryCode: data.countryCode,
        fromDate,
        toDate,
        currency: data.currency,
        notes: data.notes,
        isActive: data.isActive,
        emailAlertEnabled: data.emailAlertEnabled,
      });
    },
    onSuccess: () => {
      toast({ title: t.success.created });
      refetchSets();
      setIsAddingSet(false);
      setNewSetData({ name: "", countryCode: null, fromDay: 0, fromMonth: 0, fromYear: 0, toDay: 0, toMonth: 0, toYear: 0, currency: "EUR", notes: "", isActive: true, emailAlertEnabled: false });
    },
    onError: () => toast({ title: t.errors.saveFailed, variant: "destructive" }),
  });

  const deleteSetMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/product-sets/${id}`),
    onSuccess: () => {
      toast({ title: t.success.deleted });
      refetchSets();
      setSelectedSetId(null);
    },
  });

  const updateSetMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/product-sets/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Zostava aktualizovaná" });
      refetchSets();
      queryClient.invalidateQueries({ queryKey: ["/api/product-sets", selectedSetId] });
      setIsEditingSetName(false);
    },
    onError: () => {
      toast({ title: "Chyba pri aktualizácii", variant: "destructive" });
    },
  });

  const addCollectionMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", `/api/product-sets/${selectedSetId}/collections`, data);
    },
    onSuccess: () => {
      toast({ title: "Odber pridaný do zostavy" });
      queryClient.invalidateQueries({ queryKey: ["/api/product-sets", selectedSetId] });
    },
  });

  const updateCollectionMutation = useMutation({
    mutationFn: async (data: any) => {
      const { id, ...updateData } = data;
      return apiRequest("PATCH", `/api/product-set-collections/${id}`, updateData);
    },
    onSuccess: () => {
      toast({ title: "Odber aktualizovaný" });
      queryClient.invalidateQueries({ queryKey: ["/api/product-sets", selectedSetId] });
    },
    onError: () => {
      toast({ title: "Chyba pri aktualizácii", variant: "destructive" });
    },
  });

  const addStorageMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", `/api/product-sets/${selectedSetId}/storage`, data);
    },
    onSuccess: () => {
      toast({ title: "Skladovanie pridané do zostavy" });
      queryClient.invalidateQueries({ queryKey: ["/api/product-sets", selectedSetId] });
    },
  });

  const updateStorageMutation = useMutation({
    mutationFn: async (data: any) => {
      const { id, ...updateData } = data;
      return apiRequest("PATCH", `/api/product-set-storage/${id}`, updateData);
    },
    onSuccess: () => {
      toast({ title: "Skladovanie aktualizované" });
      queryClient.invalidateQueries({ queryKey: ["/api/product-sets", selectedSetId] });
    },
    onError: () => {
      toast({ title: "Chyba pri aktualizácii", variant: "destructive" });
    },
  });

  const removeCollectionMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/product-set-collections/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/product-sets", selectedSetId] });
    },
  });

  const removeStorageMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/product-set-storage/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/product-sets", selectedSetId] });
    },
  });

  // Calculate totals dynamically
  const calculateTotals = () => {
    if (!selectedSet) return { net: 0, discount: 0, vat: 0, gross: 0 };
    
    let net = 0;
    let discount = 0;
    let vat = 0;
    let gross = 0;

    // Calculate from collections - net is original price BEFORE discount
    (selectedSet.collections || []).forEach((col: any) => {
      const lineNetAfterDiscount = parseFloat(col.lineNetAmount || 0);
      const lineDiscount = parseFloat(col.lineDiscountAmount || 0);
      const lineNetBeforeDiscount = lineNetAfterDiscount + lineDiscount;
      const lineVat = parseFloat(col.lineVatAmount || 0);
      const lineGross = parseFloat(col.lineGrossAmount || 0);
      net += lineNetBeforeDiscount;
      discount += lineDiscount;
      vat += lineVat;
      gross += lineGross;
    });

    // Calculate from storage - net is original price BEFORE discount
    (selectedSet.storage || []).forEach((stor: any) => {
      const lineNetAfterDiscount = parseFloat(stor.lineNetAmount || stor.priceOverride || 0);
      const lineDiscount = parseFloat(stor.lineDiscountAmount || 0);
      const lineNetBeforeDiscount = lineNetAfterDiscount + lineDiscount;
      const lineVat = parseFloat(stor.lineVatAmount || 0);
      const lineGross = parseFloat(stor.lineGrossAmount || stor.priceOverride || 0);
      net += lineNetBeforeDiscount;
      discount += lineDiscount;
      vat += lineVat;
      gross += lineGross;
    });

    // If no line gross calculated, fallback to net - discount + vat
    const finalGross = gross > 0 ? gross : (net - discount + vat);
    return { net, discount, vat, gross: finalGross };
  };

  const totals = calculateTotals();

  // Edit Set Details Dialog
  const renderEditSetDetailsDialog = () => (
    <Dialog open={isEditingSetDetails} onOpenChange={setIsEditingSetDetails}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t.konfigurator.editSet}</DialogTitle>
        </DialogHeader>
        {editSetDetails && (
          <div className="space-y-4">
            <div>
              <Label>{t.konfigurator.setName}</Label>
              <Input 
                value={editSetDetails.name}
                onChange={(e) => setEditSetDetails({ ...editSetDetails, name: e.target.value })}
              />
            </div>
            <div>
              <Label>{t.common.country}</Label>
              <Select value={editSetDetails.countryCode || "ALL"} onValueChange={(v) => setEditSetDetails({ ...editSetDetails, countryCode: v === "ALL" ? null : v })}>
                <SelectTrigger><SelectValue placeholder={t.common.select} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">-- {t.common.all} --</SelectItem>
                  {COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.flag} {c.code}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t.konfigurator.validFrom}</Label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">{t.collaborators.fields.day}</Label>
                    <Input type="number" min={1} max={31} value={editSetDetails.fromDay || ""} onChange={(e) => setEditSetDetails({ ...editSetDetails, fromDay: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <Label className="text-xs">{t.collaborators.fields.month}</Label>
                    <Input type="number" min={1} max={12} value={editSetDetails.fromMonth || ""} onChange={(e) => setEditSetDetails({ ...editSetDetails, fromMonth: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <Label className="text-xs">{t.collaborators.fields.year}</Label>
                    <Input type="number" min={2020} max={2100} value={editSetDetails.fromYear || ""} onChange={(e) => setEditSetDetails({ ...editSetDetails, fromYear: parseInt(e.target.value) || 0 })} />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t.konfigurator.validTo}</Label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">{t.collaborators.fields.day}</Label>
                    <Input type="number" min={1} max={31} value={editSetDetails.toDay || ""} onChange={(e) => setEditSetDetails({ ...editSetDetails, toDay: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <Label className="text-xs">{t.collaborators.fields.month}</Label>
                    <Input type="number" min={1} max={12} value={editSetDetails.toMonth || ""} onChange={(e) => setEditSetDetails({ ...editSetDetails, toMonth: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <Label className="text-xs">{t.collaborators.fields.year}</Label>
                    <Input type="number" min={2020} max={2100} value={editSetDetails.toYear || ""} onChange={(e) => setEditSetDetails({ ...editSetDetails, toYear: parseInt(e.target.value) || 0 })} />
                  </div>
                </div>
              </div>
            </div>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="editEmailAlertEnabled" 
                  checked={editSetDetails.emailAlertEnabled}
                  onCheckedChange={(checked) => setEditSetDetails({ ...editSetDetails, emailAlertEnabled: !!checked })}
                />
                <Label htmlFor="editEmailAlertEnabled" className="cursor-pointer">
                  {t.konfigurator.emailAlertEnabled}
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                {t.konfigurator.emailAlertHint}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox 
                id="editIsActive" 
                checked={editSetDetails.isActive}
                onCheckedChange={(checked) => setEditSetDetails({ ...editSetDetails, isActive: !!checked })}
              />
              <Label htmlFor="editIsActive" className="cursor-pointer">
                {t.konfigurator.activeSet}
              </Label>
            </div>
            <Separator />
            <div>
              <Label>{t.konfigurator.currency}</Label>
              <Select
                value={editSetDetails.currency || "EUR"}
                onValueChange={(value) => setEditSetDetails({ ...editSetDetails, currency: value })}
              >
                <SelectTrigger data-testid="select-set-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.symbol} - {c.name} ({c.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsEditingSetDetails(false)}>{t.common.cancel}</Button>
          <Button onClick={() => {
            if (editSetDetails) {
              const fromDate = componentsToISOString(editSetDetails.fromDay, editSetDetails.fromMonth, editSetDetails.fromYear);
              const toDate = componentsToISOString(editSetDetails.toDay, editSetDetails.toMonth, editSetDetails.toYear);
              updateSetMutation.mutate({
                id: editSetDetails.id,
                data: {
                  name: editSetDetails.name,
                  countryCode: editSetDetails.countryCode,
                  fromDate,
                  toDate,
                  isActive: editSetDetails.isActive,
                  emailAlertEnabled: editSetDetails.emailAlertEnabled,
                  currency: editSetDetails.currency || "EUR",
                }
              });
              setIsEditingSetDetails(false);
            }
          }}>
            {t.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="grid grid-cols-3 gap-4 h-[500px]">
      {renderEditSetDetailsDialog()}
      {/* Left Panel - Sets List */}
      <div className="border rounded-lg p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium">{t.konfigurator.setsTitle}</h4>
          <Button size="sm" onClick={() => setIsAddingSet(true)} data-testid="button-add-set">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {isAddingSet && (
          <Card className="p-3 mb-4">
            <div className="space-y-3">
              <div>
                <Label>{t.konfigurator.setName}</Label>
                <Input 
                  value={newSetData.name}
                  onChange={(e) => setNewSetData({ ...newSetData, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>{t.common.country}</Label>
                  <Select value={newSetData.countryCode || "ALL"} onValueChange={(v) => setNewSetData({ ...newSetData, countryCode: v === "ALL" ? null : v })}>
                    <SelectTrigger><SelectValue placeholder={t.common.select} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">-- {t.common.all} --</SelectItem>
                      {COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.flag} {c.code}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t.konfigurator.currency}</Label>
                  <Select value={newSetData.currency} onValueChange={(v) => setNewSetData({ ...newSetData, currency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map(c => <SelectItem key={c.code} value={c.code}>{c.symbol} {c.code}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">{t.konfigurator.validFrom} - {t.collaborators.fields.day}</Label>
                  <Input type="number" min={1} max={31} value={newSetData.fromDay || ""} onChange={(e) => setNewSetData({ ...newSetData, fromDay: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label className="text-xs">{t.collaborators.fields.month}</Label>
                  <Input type="number" min={1} max={12} value={newSetData.fromMonth || ""} onChange={(e) => setNewSetData({ ...newSetData, fromMonth: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label className="text-xs">{t.collaborators.fields.year}</Label>
                  <Input type="number" min={2020} max={2100} value={newSetData.fromYear || ""} onChange={(e) => setNewSetData({ ...newSetData, fromYear: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">{t.konfigurator.validTo} - {t.collaborators.fields.day}</Label>
                  <Input type="number" min={1} max={31} value={newSetData.toDay || ""} onChange={(e) => setNewSetData({ ...newSetData, toDay: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label className="text-xs">{t.collaborators.fields.month}</Label>
                  <Input type="number" min={1} max={12} value={newSetData.toMonth || ""} onChange={(e) => setNewSetData({ ...newSetData, toMonth: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label className="text-xs">{t.collaborators.fields.year}</Label>
                  <Input type="number" min={2020} max={2100} value={newSetData.toYear || ""} onChange={(e) => setNewSetData({ ...newSetData, toYear: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Checkbox 
                  id="emailAlertEnabled" 
                  checked={newSetData.emailAlertEnabled}
                  onCheckedChange={(checked) => setNewSetData({ ...newSetData, emailAlertEnabled: !!checked })}
                />
                <Label htmlFor="emailAlertEnabled" className="text-xs cursor-pointer">
                  {t.konfigurator.emailAlertEnabled}
                </Label>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => createSetMutation.mutate(newSetData)}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsAddingSet(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        )}

        {productSets.length === 0 && !isAddingSet && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>{t.konfigurator.noSets}</p>
          </div>
        )}

        {productSets.map((set: any) => {
          const countryInfo = set.countryCode ? COUNTRIES.find(c => c.code === set.countryCode) : null;
          return (
          <div
            key={set.id}
            className={`p-3 rounded-lg border mb-2 cursor-pointer hover-elevate ${selectedSetId === set.id ? 'border-primary bg-accent' : ''}`}
            onClick={() => setSelectedSetId(set.id)}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-sm">{set.name}</span>
              <div className="flex items-center gap-1">
                {countryInfo ? (
                  <Badge variant="outline" className="text-xs">{countryInfo.flag} {countryInfo.code}</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">{t.common.all}</Badge>
                )}
                <Badge variant="outline" className="text-xs">{set.currency}</Badge>
                <Badge variant={set.isActive ? "default" : "secondary"} className="text-xs">
                  {set.isActive ? t.konfigurator.activeLabel : t.konfigurator.inactiveLabel}
                </Badge>
              </div>
            </div>
            {(set.fromDate || set.toDate) && (
              <div className="text-xs text-muted-foreground mt-1">
                {formatDate(set.fromDate)} – {formatDate(set.toDate)}
              </div>
            )}
          </div>
        );})}
      </div>

      {/* Middle Panel - Set Builder */}
      <div className="border rounded-lg p-4 overflow-y-auto">
        {!selectedSetId ? (
          <div className="text-center py-16 text-muted-foreground">
            <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{t.konfigurator.selectInstance}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              {isEditingSetName ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    value={editedSetName}
                    onChange={(e) => setEditedSetName(e.target.value)}
                    className="flex-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && editedSetName.trim()) {
                        updateSetMutation.mutate({ id: selectedSetId!, data: { name: editedSetName.trim() } });
                      } else if (e.key === 'Escape') {
                        setIsEditingSetName(false);
                      }
                    }}
                  />
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={() => {
                      if (editedSetName.trim()) {
                        updateSetMutation.mutate({ id: selectedSetId!, data: { name: editedSetName.trim() } });
                      }
                    }}
                    disabled={!editedSetName.trim() || updateSetMutation.isPending}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setIsEditingSetName(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-1">
                  <h4 className="font-medium">{selectedSet?.name}</h4>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={() => {
                      setEditedSetName(selectedSet?.name || "");
                      setIsEditingSetName(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={() => {
                      const fromParts = isoStringToComponents(selectedSet?.fromDate);
                      const toParts = isoStringToComponents(selectedSet?.toDate);
                      setEditSetDetails({
                        id: selectedSet?.id,
                        name: selectedSet?.name || "",
                        fromDay: fromParts.day, fromMonth: fromParts.month, fromYear: fromParts.year,
                        toDay: toParts.day, toMonth: toParts.month, toYear: toParts.year,
                        currency: selectedSet?.currency || "EUR",
                        notes: selectedSet?.notes || "",
                        isActive: selectedSet?.isActive ?? true,
                        emailAlertEnabled: selectedSet?.emailAlertEnabled ?? false,
                      });
                      setIsEditingSetDetails(true);
                    }}
                    data-testid="button-edit-set-details"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  {selectedSet?.emailAlertEnabled && (
                    <Badge variant="outline" className="text-xs bg-orange-100 dark:bg-orange-800 border-orange-300 dark:border-orange-700">
                      <Mail className="h-3 w-3 mr-1" /> Alert
                    </Badge>
                  )}
                </div>
              )}
              <Button size="sm" variant="destructive" onClick={() => deleteSetMutation.mutate(selectedSetId)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Odbery Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">{t.konfigurator.collectionsInSet}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-1" /> {t.konfigurator.addCollection}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">{t.konfigurator.selectCollection}</Label>
                      {instances.map((inst: any) => (
                        <Button
                          key={inst.id}
                          variant="ghost"
                          className="w-full justify-start text-sm"
                          onClick={() => setConfiguringInstanceId(inst.id)}
                        >
                          <Badge variant="secondary" className="mr-2">{inst.countryCode}</Badge>
                          {inst.name}
                          <ChevronRight className="h-4 w-4 ml-auto" />
                        </Button>
                      ))}
                      {instances.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-2">{t.konfigurator.noCollections}</p>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              
              {/* Collection Configuration Dialog - for adding new */}
              {configuringInstanceId && !editingCollectionItem && (
                <CollectionConfigDialog
                  open={!!configuringInstanceId}
                  onOpenChange={(open) => !open && setConfiguringInstanceId(null)}
                  instanceId={configuringInstanceId}
                  instanceName={instances.find((i: any) => i.id === configuringInstanceId)?.name || ""}
                  instanceCountry={instances.find((i: any) => i.id === configuringInstanceId)?.countryCode || ""}
                  onSave={(config) => {
                    addCollectionMutation.mutate(config);
                    setConfiguringInstanceId(null);
                  }}
                  t={t}
                />
              )}

              {/* Collection Configuration Dialog - for editing existing */}
              {editingCollectionItem && (
                <CollectionConfigDialog
                  open={!!editingCollectionItem}
                  onOpenChange={(open) => !open && setEditingCollectionItem(null)}
                  instanceId={editingCollectionItem.instanceId}
                  instanceName={instances.find((i: any) => i.id === editingCollectionItem.instanceId)?.name || ""}
                  instanceCountry={instances.find((i: any) => i.id === editingCollectionItem.instanceId)?.countryCode || ""}
                  editingItem={editingCollectionItem}
                  onSave={(config) => {
                    updateCollectionMutation.mutate(config);
                    setEditingCollectionItem(null);
                  }}
                  t={t}
                />
              )}
              
              {(selectedSet?.collections || []).map((col: any) => {
                const inst = instances.find((i: any) => i.id === col.instanceId);
                const countryInfo = COUNTRIES.find(c => c.code === inst?.countryCode);
                const lineGross = parseFloat(col.lineGrossAmount || 0);
                const lineNet = parseFloat(col.lineNetAmount || 0);
                const lineDiscount = parseFloat(col.lineDiscountAmount || 0);
                return (
                  <div key={col.id} className="p-2 rounded mb-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300">
                          {countryInfo?.flag} {inst?.countryCode}
                        </Badge>
                        <span className="text-sm font-medium text-blue-900 dark:text-blue-100">{inst?.name || t.konfigurator.collectionItem}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={() => setEditingCollectionItem(col)}
                          data-testid={`button-edit-collection-${col.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => removeCollectionMutation.mutate(col.id)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {lineGross > 0 && (
                      <div className="mt-1 text-xs text-blue-600 dark:text-blue-300 flex items-center gap-2 flex-wrap">
                        <span>{t.konfigurator.netWithoutVat}: {lineNet.toFixed(2)} €</span>
                        {lineDiscount > 0 && <span className="text-green-600">{t.konfigurator.discountText}: -{lineDiscount.toFixed(2)} €</span>}
                        <Badge variant="outline" className="ml-auto border-blue-300 dark:border-blue-600">{lineGross.toFixed(2)} €</Badge>
                      </div>
                    )}
                  </div>
                );
              })}
              {(selectedSet?.collections || []).length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">{t.konfigurator.noCollectionsInSet}</p>
              )}
            </div>

            <Separator />

            {/* Skladovanie Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">{t.konfigurator.storageInSet}</Label>
                {(() => {
                  // Filter storage services based on selected collections' instances
                  const selectedInstanceIds = (selectedSet?.collections || []).map((col: any) => col.instanceId);
                  const filteredStorageServices = selectedInstanceIds.length > 0
                    ? allStorageServices.filter((svc: any) => {
                        // Find the instance this service belongs to and check if it's in selected collections
                        const serviceInstance = instances.find((inst: any) => inst.id === svc.instanceId);
                        return serviceInstance && selectedInstanceIds.includes(serviceInstance.id);
                      })
                    : [];
                  
                  return (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300"
                          disabled={selectedInstanceIds.length === 0}
                        >
                          <Plus className="h-4 w-4 mr-1" /> {t.konfigurator.addStorageItem}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72">
                        <div className="space-y-3">
                          <Label className="text-sm font-medium">{t.konfigurator.selectStorageService}</Label>
                          {filteredStorageServices.map((svc: any) => (
                            <Button
                              key={svc.id}
                              size="sm"
                              variant="ghost"
                              className="w-full justify-start text-sm hover:bg-green-50 dark:hover:bg-green-900/20"
                              onClick={() => setConfiguringStorageService(svc)}
                            >
                              <div className="flex items-center gap-2 w-full">
                                {svc.instanceCountryCode && <Badge variant="secondary" className="bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300">{svc.instanceCountryCode}</Badge>}
                                <span className="text-sm font-medium">{svc.name}</span>
                              </div>
                            </Button>
                          ))}
                          {filteredStorageServices.length === 0 && (
                            <p className="text-sm text-muted-foreground">{t.konfigurator.noStorageAvailable}</p>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  );
                })()}
              </div>

              {/* Storage Config Dialog - for adding new */}
              {configuringStorageService && !editingStorageItem && (
                <StorageConfigDialog
                  open={!!configuringStorageService}
                  onOpenChange={(open) => !open && setConfiguringStorageService(null)}
                  serviceId={configuringStorageService.id}
                  serviceName={configuringStorageService.name}
                  serviceCountry={configuringStorageService.instanceCountryCode || ""}
                  onSave={(config) => {
                    addStorageMutation.mutate(config);
                    setConfiguringStorageService(null);
                  }}
                  t={t}
                />
              )}

              {/* Storage Config Dialog - for editing existing */}
              {editingStorageItem && (
                <StorageConfigDialog
                  open={!!editingStorageItem}
                  onOpenChange={(open) => !open && setEditingStorageItem(null)}
                  serviceId={editingStorageItem.serviceId}
                  serviceName={allStorageServices.find((s: any) => s.id === editingStorageItem.serviceId)?.name || ""}
                  serviceCountry={allStorageServices.find((s: any) => s.id === editingStorageItem.serviceId)?.instanceCountryCode || ""}
                  editingItem={editingStorageItem}
                  onSave={(config) => {
                    updateStorageMutation.mutate(config);
                    setEditingStorageItem(null);
                  }}
                  t={t}
                />
              )}
              
              {(selectedSet?.storage || []).map((stor: any) => {
                const svc = allStorageServices.find((s: any) => s.id === stor.serviceId);
                const countryInfo = COUNTRIES.find(c => c.code === svc?.instanceCountryCode);
                const lineNet = parseFloat(stor.lineNetAmount || 0);
                const lineDiscount = parseFloat(stor.lineDiscountAmount || 0);
                const lineGross = parseFloat(stor.lineGrossAmount || stor.priceOverride || 0);
                return (
                  <div key={stor.id} className="p-2 rounded mb-1 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {svc?.instanceCountryCode && (
                          <Badge variant="secondary" className="bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300">
                            {countryInfo?.flag} {svc.instanceCountryCode}
                          </Badge>
                        )}
                        <span className="text-sm font-medium text-green-900 dark:text-green-100">{svc?.name || t.konfigurator.storageItem}</span>
                        {stor.quantity > 1 && <span className="text-xs text-muted-foreground">({stor.quantity}x)</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          onClick={() => setEditingStorageItem(stor)}
                          data-testid={`button-edit-storage-${stor.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => removeStorageMutation.mutate(stor.id)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {lineGross > 0 && (
                      <div className="mt-1 text-xs text-green-600 dark:text-green-300 flex items-center gap-2 flex-wrap">
                        <span>{t.konfigurator.netWithoutVat}: {lineNet.toFixed(2)} €</span>
                        {lineDiscount > 0 && <span className="text-green-700">{t.konfigurator.discountText}: -{lineDiscount.toFixed(2)} €</span>}
                        <Badge variant="outline" className="ml-auto border-green-300 dark:border-green-600">{lineGross.toFixed(2)} €</Badge>
                      </div>
                    )}
                  </div>
                );
              })}
              {(selectedSet?.storage || []).length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">{t.konfigurator.noStorageInSet}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right Panel - Invoice Preview & Totals */}
      <div className="border rounded-lg p-4 overflow-y-auto">
        <h4 className="font-medium mb-4">{t.konfigurator.invoicePreviewTitle}</h4>
        
        {!selectedSetId ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">{t.konfigurator.selectSetForPreview}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Currency symbol from selected set */}
            {(() => {
              const currencySymbol = getCurrencySymbol(selectedSet?.currency || "EUR");
              return (
                <>
                  {/* Line Items */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">{t.konfigurator.lineItemsLabel}</Label>
                    
                    {(selectedSet?.collections || []).map((col: any, idx: number) => {
                      const inst = instances.find((i: any) => i.id === col.instanceId);
                      const lineNetAfterDiscount = parseFloat(col.lineNetAmount || 0);
                      const lineDiscount = parseFloat(col.lineDiscountAmount || 0);
                      const lineNetBeforeDiscount = lineNetAfterDiscount + lineDiscount;
                      const lineVat = parseFloat(col.lineVatAmount || 0);
                      const lineGross = parseFloat(col.lineGrossAmount || 0);
                      return (
                        <div key={col.id} className="py-1.5 px-2 rounded bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-400 mb-1">
                          <div className="flex justify-between text-sm font-medium">
                            <span className="text-blue-900 dark:text-blue-100">{idx + 1}. {inst?.name || t.konfigurator.collectionItem} {col.quantity > 1 && `(${col.quantity}x)`}</span>
                          </div>
                          <div className="mt-1 space-y-0.5 text-xs text-blue-700 dark:text-blue-300">
                            <div className="flex justify-between">
                              <span>{t.konfigurator.priceWithoutVat}:</span>
                              <span className="font-mono">{lineNetBeforeDiscount.toFixed(2)} {currencySymbol}</span>
                            </div>
                            {lineDiscount > 0 && (
                              <div className="flex justify-between text-amber-600 dark:text-amber-400">
                                <span>{t.konfigurator.discountText}:</span>
                                <span className="font-mono">-{lineDiscount.toFixed(2)} {currencySymbol}</span>
                              </div>
                            )}
                            {lineVat > 0 && (
                              <div className="flex justify-between">
                                <span>{t.konfigurator.vatValue}:</span>
                                <span className="font-mono">+{lineVat.toFixed(2)} {currencySymbol}</span>
                              </div>
                            )}
                            <div className="flex justify-between font-medium pt-0.5 border-t border-blue-200 dark:border-blue-700">
                              <span>{t.konfigurator.totalLabel}:</span>
                              <span className="font-mono">{lineGross.toFixed(2)} {currencySymbol}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    
                    {(selectedSet?.storage || []).map((stor: any, idx: number) => {
                      const svc = allStorageServices.find((s: any) => s.id === stor.serviceId);
                      const lineNetAfterDiscount = parseFloat(stor.lineNetAmount || stor.priceOverride || 0);
                      const lineDiscount = parseFloat(stor.lineDiscountAmount || 0);
                      const lineNetBeforeDiscount = lineNetAfterDiscount + lineDiscount;
                      const lineVat = parseFloat(stor.lineVatAmount || 0);
                      const lineGross = parseFloat(stor.lineGrossAmount || stor.priceOverride || 0);
                      return (
                        <div key={stor.id} className="py-1.5 px-2 rounded bg-green-50 dark:bg-green-900/20 border-l-2 border-green-400 mb-1">
                          <div className="flex justify-between text-sm font-medium">
                            <span className="text-green-900 dark:text-green-100">{(selectedSet?.collections?.length || 0) + idx + 1}. {svc?.name || t.konfigurator.storageItem}</span>
                          </div>
                          <div className="mt-1 space-y-0.5 text-xs text-green-700 dark:text-green-300">
                            <div className="flex justify-between">
                              <span>{t.konfigurator.priceWithoutVat}:</span>
                              <span className="font-mono">{lineNetBeforeDiscount.toFixed(2)} {currencySymbol}</span>
                            </div>
                            {lineDiscount > 0 && (
                              <div className="flex justify-between text-amber-600 dark:text-amber-400">
                                <span>{t.konfigurator.discountText}:</span>
                                <span className="font-mono">-{lineDiscount.toFixed(2)} {currencySymbol}</span>
                              </div>
                            )}
                            {lineVat > 0 && (
                              <div className="flex justify-between">
                                <span>{t.konfigurator.vatValue}:</span>
                                <span className="font-mono">+{lineVat.toFixed(2)} {currencySymbol}</span>
                              </div>
                            )}
                            <div className="flex justify-between font-medium pt-0.5 border-t border-green-200 dark:border-green-700">
                              <span>{t.konfigurator.totalLabel}:</span>
                              <span className="font-mono">{lineGross.toFixed(2)} {currencySymbol}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {(selectedSet?.collections || []).length === 0 && (selectedSet?.storage || []).length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">{t.konfigurator.addItemsToSet}</p>
                    )}
                  </div>

                  <Separator />

                  {/* Totals */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{t.konfigurator.netWithoutVat}:</span>
                      <span className="font-mono">{totals.net.toFixed(2)} {currencySymbol}</span>
                    </div>
                    {totals.discount > 0 && (
                      <div className="flex justify-between text-sm text-amber-600 dark:text-amber-400">
                        <span>{t.konfigurator.discountText}:</span>
                        <span className="font-mono">-{totals.discount.toFixed(2)} {currencySymbol}</span>
                      </div>
                    )}
                    {totals.discount > 0 && (
                      <div className="flex justify-between text-sm font-medium">
                        <span>{t.konfigurator.subtotalAfterDiscount}:</span>
                        <span className="font-mono">{(totals.net - totals.discount).toFixed(2)} {currencySymbol}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>{t.konfigurator.vatText}:</span>
                      <span className="font-mono">+{totals.vat.toFixed(2)} {currencySymbol}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-medium">
                      <span>{t.konfigurator.totalLabel}:</span>
                      <span className="font-mono text-lg">{totals.gross.toFixed(2)} {currencySymbol}</span>
                    </div>
                  </div>
                </>
              );
            })()}

            {/* Payment breakdown for collections with payment options - including storage */}
            {(selectedSet?.collections || []).some((col: any) => col.paymentOptionId) && (
              <>
                <Separator />
                <div className="space-y-3">
                  <Label className="text-xs text-muted-foreground">{t.konfigurator.paymentBreakdown}</Label>
                  {(() => {
                    const currencySymbol = getCurrencySymbol(selectedSet?.currency || "EUR");
                    // Calculate total storage amount to add to installments
                    const storageTotal = (selectedSet?.storage || []).reduce((sum: number, stor: any) => {
                      return sum + parseFloat(stor.lineGrossAmount || stor.priceOverride || 0);
                    }, 0);
                    
                    // Find collections with multi-payment option
                    const collectionsWithPayment = (selectedSet?.collections || []).filter((col: any) => col.paymentOptionId);
                    
                    // Storage is only added to the FIRST collection with payment option to avoid duplication
                    let storageAlreadyAdded = false;
                    
                    return collectionsWithPayment.map((col: any) => {
                      const inst = instances.find((i: any) => i.id === col.instanceId);
                      const lineGross = parseFloat(col.lineGrossAmount || 0);
                      
                      // Add storage only to the first collection with installments
                      const includeStorage = storageTotal > 0 && !storageAlreadyAdded;
                      if (includeStorage) {
                        storageAlreadyAdded = true;
                      }
                      
                      const combinedAmount = includeStorage ? lineGross + storageTotal : lineGross;
                      
                      return (
                        <PaymentBreakdownItem 
                          key={col.id}
                          instanceId={col.instanceId}
                          instanceName={includeStorage ? `${inst?.name || t.konfigurator.collectionItem} + ${t.konfigurator.storageItem}` : (inst?.name || t.konfigurator.collectionItem)}
                          paymentOptionId={col.paymentOptionId}
                          amount={combinedAmount}
                          storageIncluded={includeStorage}
                          storageAmount={includeStorage ? storageTotal : 0}
                          collectionAmount={lineGross}
                          currencySymbol={currencySymbol}
                          t={t}
                        />
                      );
                    });
                  })()}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ProductDetailDialog({ 
  product, 
  open, 
  onOpenChange,
  onProductUpdated 
}: { 
  product: Product | null; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  onProductUpdated?: () => void;
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("detail");
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [instanceSubTab, setInstanceSubTab] = useState<"prices" | "payments" | "discounts" | "vat">("prices");
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [serviceSubTab, setServiceSubTab] = useState<"prices" | "payments" | "discounts" | "vat">("prices");
  const [isAddingInstance, setIsAddingInstance] = useState(false);
  const [isAddingService, setIsAddingService] = useState(false);
  const [isAddingPrice, setIsAddingPrice] = useState(false);
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const [isAddingDiscount, setIsAddingDiscount] = useState(false);
  const [isAddingVat, setIsAddingVat] = useState(false);
  const [isAddingServiceVat, setIsAddingServiceVat] = useState(false);
  const [isAddingServicePrice, setIsAddingServicePrice] = useState(false);
  const [isAddingServicePayment, setIsAddingServicePayment] = useState(false);
  const [isAddingServiceDiscount, setIsAddingServiceDiscount] = useState(false);
  const [newServicePriceData, setNewServicePriceData] = useState<any>({
    name: "", price: "", currency: "EUR", accountingCode: "", analyticalAccount: "",
    fromDay: 0, fromMonth: 0, fromYear: 0, toDay: 0, toMonth: 0, toYear: 0, isActive: true, description: ""
  });
  const [newServicePaymentData, setNewServicePaymentData] = useState<any>({
    name: "", type: "", invoiceItemText: "", analyticalAccount: "", accountingCode: "",
    paymentTypeFee: "", fromDay: 0, fromMonth: 0, fromYear: 0, toDay: 0, toMonth: 0, toYear: 0, isActive: true, description: "", amendment: "",
    isMultiPayment: false, frequency: "monthly", installmentCount: 1, calculationMode: "fixed", basePriceId: ""
  });
  const [newServicePaymentInstallments, setNewServicePaymentInstallments] = useState<any[]>([]);
  const [editingServicePaymentInstallments, setEditingServicePaymentInstallments] = useState<any[]>([]);
  const [newServiceDiscountData, setNewServiceDiscountData] = useState<any>({
    name: "", isFixed: false, fixedValue: "", isPercentage: true, percentageValue: "",
    fromDay: 0, fromMonth: 0, fromYear: 0, toDay: 0, toMonth: 0, toYear: 0, isActive: true, description: ""
  });
  
  const [productData, setProductData] = useState<any>({
    name: "", description: "", countries: [] as string[], isActive: true
  });
  
  useEffect(() => {
    if (product) {
      setProductData({
        name: product.name || "",
        description: product.description || "",
        countries: product.countries || [],
        isActive: product.isActive ?? true,
      });
    }
  }, [product]);
  
  const updateProductMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/products/${product?.id}`, data),
    onSuccess: () => {
      toast({ title: t.success.updated });
      onProductUpdated?.();
    },
    onError: () => {
      toast({ title: t.errors.updateFailed, variant: "destructive" });
    },
  });

  const { data: instances = [], refetch: refetchInstances } = useQuery<MarketProductInstance[]>({
    queryKey: ["/api/products", product?.id, "instances"],
    queryFn: async () => {
      if (!product?.id) return [];
      const res = await fetch(`/api/products/${product.id}/instances`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!product?.id,
  });

  const selectedInstance = instances.find(i => i.id === selectedInstanceId);

  const { data: instancePrices = [], refetch: refetchPrices } = useQuery<InstancePrice[]>({
    queryKey: ["/api/instance-prices", selectedInstanceId, "market_instance"],
    queryFn: async () => {
      if (!selectedInstanceId) return [];
      const res = await fetch(`/api/instance-prices/${selectedInstanceId}/market_instance`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedInstanceId,
  });

  const { data: instancePayments = [], refetch: refetchPayments } = useQuery<InstancePaymentOption[]>({
    queryKey: ["/api/instance-payment-options", selectedInstanceId, "market_instance"],
    queryFn: async () => {
      if (!selectedInstanceId) return [];
      const res = await fetch(`/api/instance-payment-options/${selectedInstanceId}/market_instance`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedInstanceId,
  });

  const { data: instanceDiscounts = [], refetch: refetchDiscounts } = useQuery<InstanceDiscount[]>({
    queryKey: ["/api/instance-discounts", selectedInstanceId, "market_instance"],
    queryFn: async () => {
      if (!selectedInstanceId) return [];
      const res = await fetch(`/api/instance-discounts/${selectedInstanceId}/market_instance`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedInstanceId,
  });

  const { data: instanceVatRates = [], refetch: refetchVatRates } = useQuery<any[]>({
    queryKey: ["/api/instance-vat-rates", selectedInstanceId, "market_instance"],
    queryFn: async () => {
      if (!selectedInstanceId) return [];
      const res = await fetch(`/api/instance-vat-rates/${selectedInstanceId}/market_instance`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedInstanceId,
  });

  const { data: services = [], refetch: refetchServices } = useQuery<MarketProductService[]>({
    queryKey: ["/api/product-instances", selectedInstanceId, "services"],
    queryFn: async () => {
      if (!selectedInstanceId) return [];
      const res = await fetch(`/api/product-instances/${selectedInstanceId}/services`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedInstanceId,
  });

  const selectedService = (services as any[]).find(s => s.id === selectedServiceId);

  const { data: serviceVatRates = [], refetch: refetchServiceVatRates } = useQuery<any[]>({
    queryKey: ["/api/instance-vat-rates", selectedServiceId, "service"],
    queryFn: async () => {
      if (!selectedServiceId) return [];
      const res = await fetch(`/api/instance-vat-rates/${selectedServiceId}/service`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedServiceId,
  });

  const { data: servicePrices = [], refetch: refetchServicePrices } = useQuery<any[]>({
    queryKey: ["/api/instance-prices", selectedServiceId, "service"],
    queryFn: async () => {
      if (!selectedServiceId) return [];
      const res = await fetch(`/api/instance-prices/${selectedServiceId}/service`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedServiceId,
  });

  const { data: servicePayments = [], refetch: refetchServicePayments } = useQuery<any[]>({
    queryKey: ["/api/instance-payment-options", selectedServiceId, "service"],
    queryFn: async () => {
      if (!selectedServiceId) return [];
      const res = await fetch(`/api/instance-payment-options/${selectedServiceId}/service`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedServiceId,
  });

  const { data: serviceDiscounts = [], refetch: refetchServiceDiscounts } = useQuery<any[]>({
    queryKey: ["/api/instance-discounts", selectedServiceId, "service"],
    queryFn: async () => {
      if (!selectedServiceId) return [];
      const res = await fetch(`/api/instance-discounts/${selectedServiceId}/service`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedServiceId,
  });

  const { data: billingCompanies = [] } = useQuery<BillingDetails[]>({
    queryKey: ["/api/billing-details"],
  });

  const createInstanceMutation = useMutation({
    mutationFn: (data: Partial<MarketProductInstance>) => 
      apiRequest("POST", `/api/products/${product?.id}/instances`, data),
    onSuccess: () => {
      refetchInstances();
      setIsAddingInstance(false);
      toast({ title: t.success.created });
    },
  });

  const deleteInstanceMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/product-instances/${id}`),
    onSuccess: () => {
      refetchInstances();
      setSelectedInstanceId(null);
      toast({ title: t.success.deleted });
    },
  });

  const createPriceMutation = useMutation({
    mutationFn: (data: Partial<InstancePrice>) => apiRequest("POST", "/api/instance-prices", data),
    onSuccess: () => {
      refetchPrices();
      setIsAddingPrice(false);
      toast({ title: t.success.created });
    },
  });

  const deletePriceMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/instance-prices/${id}`),
    onSuccess: () => {
      refetchPrices();
      toast({ title: t.success.deleted });
    },
  });

  const createPaymentMutation = useMutation({
    mutationFn: async (data: Partial<InstancePaymentOption> & { installments?: any[] }) => {
      const { installments, ...paymentData } = data;
      const result = await apiRequest("POST", "/api/instance-payment-options", paymentData);
      // If there are installments and this is a multi-payment option, save them
      if (installments && installments.length > 0 && result.id) {
        const installmentsWithOption = installments.map(inst => ({
          ...inst,
          paymentOptionId: result.id
        }));
        await apiRequest("POST", "/api/payment-installments/bulk", { 
          paymentOptionId: result.id, 
          installments: installmentsWithOption 
        });
      }
      return result;
    },
    onSuccess: () => {
      refetchPayments();
      setIsAddingPayment(false);
      setNewPaymentInstallments([]);
      toast({ title: t.success.created });
    },
  });

  const deletePaymentMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/instance-payment-options/${id}`),
    onSuccess: () => {
      refetchPayments();
      toast({ title: t.success.deleted });
    },
  });

  const createDiscountMutation = useMutation({
    mutationFn: (data: Partial<InstanceDiscount>) => apiRequest("POST", "/api/instance-discounts", data),
    onSuccess: () => {
      refetchDiscounts();
      setIsAddingDiscount(false);
      toast({ title: t.success.created });
    },
  });

  const deleteDiscountMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/instance-discounts/${id}`),
    onSuccess: () => {
      refetchDiscounts();
      toast({ title: t.success.deleted });
    },
  });

  const createVatRateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/instance-vat-rates", data),
    onSuccess: () => {
      refetchVatRates();
      setIsAddingVat(false);
      setNewVatRateData({ category: "", accountingCode: "", vatRate: "", createAsNewVat: false, fromDay: 0, fromMonth: 0, fromYear: 0, toDay: 0, toMonth: 0, toYear: 0 });
      toast({ title: t.success.created });
    },
  });

  const updateVatRateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/instance-vat-rates/${id}`, data),
    onSuccess: () => {
      refetchVatRates();
      setEditingVatId(null);
      setEditingVatData(null);
      toast({ title: t.success.updated });
    },
  });

  const deleteVatRateMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/instance-vat-rates/${id}`),
    onSuccess: () => {
      refetchVatRates();
      toast({ title: t.success.deleted });
    },
  });

  const createServiceVatMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/instance-vat-rates", data),
    onSuccess: () => {
      refetchServiceVatRates();
      setIsAddingServiceVat(false);
      setNewServiceVatData({ category: "", accountingCode: "", vatRate: "", createAsNewVat: false, fromDay: 0, fromMonth: 0, fromYear: 0, toDay: 0, toMonth: 0, toYear: 0 });
      toast({ title: t.success.created });
    },
  });

  const updateServiceVatMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/instance-vat-rates/${id}`, data),
    onSuccess: () => {
      refetchServiceVatRates();
      setEditingServiceVatId(null);
      setEditingServiceVatData(null);
      toast({ title: t.success.updated });
    },
  });

  const deleteServiceVatMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/instance-vat-rates/${id}`),
    onSuccess: () => {
      refetchServiceVatRates();
      toast({ title: t.success.deleted });
    },
  });

  const createServicePriceMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/instance-prices", data),
    onSuccess: () => {
      refetchServicePrices();
      setIsAddingServicePrice(false);
      setNewServicePriceData({ name: "", price: "", currency: "EUR", accountingCode: "", analyticalAccount: "", fromDay: 0, fromMonth: 0, fromYear: 0, toDay: 0, toMonth: 0, toYear: 0, isActive: true, description: "" });
      toast({ title: t.success.created });
    },
  });

  const deleteServicePriceMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/instance-prices/${id}`),
    onSuccess: () => {
      refetchServicePrices();
      toast({ title: t.success.deleted });
    },
  });

  const updateServicePriceMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/instance-prices/${id}`, data),
    onSuccess: () => {
      refetchServicePrices();
      setEditingServicePriceId(null);
      setEditingServicePriceData(null);
      toast({ title: t.success.updated });
    },
  });

  const createServicePaymentMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/instance-payment-options", data),
    onSuccess: () => {
      refetchServicePayments();
      setIsAddingServicePayment(false);
      setNewServicePaymentData({ name: "", type: "", invoiceItemText: "", analyticalAccount: "", accountingCode: "", paymentTypeFee: "", fromDay: 0, fromMonth: 0, fromYear: 0, toDay: 0, toMonth: 0, toYear: 0, isActive: true, description: "", amendment: "", isMultiPayment: false, frequency: "monthly", installmentCount: 1, calculationMode: "fixed", basePriceId: "" });
      setNewServicePaymentInstallments([]);
      toast({ title: t.success.created });
    },
  });

  const deleteServicePaymentMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/instance-payment-options/${id}`),
    onSuccess: () => {
      refetchServicePayments();
      toast({ title: t.success.deleted });
    },
  });

  const updateServicePaymentMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/instance-payment-options/${id}`, data),
    onSuccess: () => {
      refetchServicePayments();
      setEditingServicePaymentId(null);
      setEditingServicePaymentData(null);
      toast({ title: t.success.updated });
    },
  });

  const createServiceDiscountMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/instance-discounts", data),
    onSuccess: () => {
      refetchServiceDiscounts();
      setIsAddingServiceDiscount(false);
      setNewServiceDiscountData({ name: "", isFixed: false, fixedValue: "", isPercentage: true, percentageValue: "", fromDay: 0, fromMonth: 0, fromYear: 0, toDay: 0, toMonth: 0, toYear: 0, isActive: true, description: "" });
      toast({ title: t.success.created });
    },
  });

  const deleteServiceDiscountMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/instance-discounts/${id}`),
    onSuccess: () => {
      refetchServiceDiscounts();
      toast({ title: t.success.deleted });
    },
  });

  const updateServiceDiscountMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/instance-discounts/${id}`, data),
    onSuccess: () => {
      refetchServiceDiscounts();
      setEditingServiceDiscountId(null);
      setEditingServiceDiscountData(null);
      toast({ title: t.success.updated });
    },
  });

  const createServiceMutation = useMutation({
    mutationFn: (data: Partial<MarketProductService>) => 
      apiRequest("POST", `/api/product-instances/${selectedInstanceId}/services`, data),
    onSuccess: () => {
      refetchServices();
      setIsAddingService(false);
      toast({ title: t.success.created });
    },
  });

  const deleteServiceMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/product-services/${id}`),
    onSuccess: () => {
      refetchServices();
      setSelectedServiceId(null);
      toast({ title: t.success.deleted });
    },
  });

  const updateInstanceMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      apiRequest("PATCH", `/api/product-instances/${id}`, data),
    onSuccess: () => {
      refetchInstances();
      setEditingInstanceId(null);
      toast({ title: t.success.updated });
    },
  });

  const updatePriceMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      apiRequest("PATCH", `/api/instance-prices/${id}`, data),
    onSuccess: () => {
      refetchPrices();
      setEditingPriceId(null);
      toast({ title: t.success.updated });
    },
  });

  const updatePaymentMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      apiRequest("PATCH", `/api/instance-payment-options/${id}`, data),
    onSuccess: () => {
      refetchPayments();
      setEditingPaymentId(null);
      toast({ title: t.success.updated });
    },
  });

  const updateDiscountMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      apiRequest("PATCH", `/api/instance-discounts/${id}`, data),
    onSuccess: () => {
      refetchDiscounts();
      setEditingDiscountId(null);
      toast({ title: t.success.updated });
    },
  });

  const updateServiceMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      apiRequest("PATCH", `/api/product-services/${id}`, data),
    onSuccess: () => {
      refetchServices();
      setEditingServiceId(null);
      toast({ title: t.success.updated });
    },
  });

  const [editingInstanceData, setEditingInstanceData] = useState<any>(null);
  const [editingPriceData, setEditingPriceData] = useState<any>(null);
  const [editingPaymentData, setEditingPaymentData] = useState<any>(null);
  const [editingDiscountData, setEditingDiscountData] = useState<any>(null);
  const [editingServiceData, setEditingServiceData] = useState<any>(null);

  const [newInstanceData, setNewInstanceData] = useState<any>({ 
    countryCode: "", name: "", isActive: true, billingDetailsId: "",
    fromDay: 0, fromMonth: 0, fromYear: 0, toDay: 0, toMonth: 0, toYear: 0, description: ""
  });
  const [newPriceData, setNewPriceData] = useState<any>({ 
    name: "", price: "", currency: "EUR", accountingCode: "", analyticalAccount: "", countryCode: "",
    fromDay: 0, fromMonth: 0, fromYear: 0, toDay: 0, toMonth: 0, toYear: 0, isActive: true, description: "", amendment: ""
  });
  const [newPaymentData, setNewPaymentData] = useState<any>({ 
    name: "", type: "", invoiceItemText: "", analyticalAccount: "", accountingCode: "",
    paymentTypeFee: "", fromDay: 0, fromMonth: 0, fromYear: 0, toDay: 0, toMonth: 0, toYear: 0, isActive: true, description: "", amendment: "",
    isMultiPayment: false, frequency: "monthly", installmentCount: 1, calculationMode: "fixed", basePriceId: ""
  });
  const [newPaymentInstallments, setNewPaymentInstallments] = useState<any[]>([]);
  const [editingPaymentInstallments, setEditingPaymentInstallments] = useState<any[]>([]);
  const [newDiscountData, setNewDiscountData] = useState<any>({ 
    name: "", type: "", invoiceItemText: "", analyticalAccount: "", accountingCode: "",
    isFixed: false, fixedValue: "", isPercentage: true, percentageValue: "",
    fromDay: 0, fromMonth: 0, fromYear: 0, toDay: 0, toMonth: 0, toYear: 0, isActive: true, description: ""
  });
  const [newVatRateData, setNewVatRateData] = useState<any>({ 
    category: "", accountingCode: "", vatRate: "", createAsNewVat: false,
    fromDay: 0, fromMonth: 0, fromYear: 0, toDay: 0, toMonth: 0, toYear: 0
  });
  const [editingVatId, setEditingVatId] = useState<string | null>(null);
  const [editingVatData, setEditingVatData] = useState<any>(null);
  const [newServiceVatData, setNewServiceVatData] = useState<any>({ 
    category: "", accountingCode: "", vatRate: "", createAsNewVat: false,
    fromDay: 0, fromMonth: 0, fromYear: 0, toDay: 0, toMonth: 0, toYear: 0
  });
  const [editingServiceVatId, setEditingServiceVatId] = useState<string | null>(null);
  const [editingServiceVatData, setEditingServiceVatData] = useState<any>(null);
  const [editingServicePriceId, setEditingServicePriceId] = useState<string | null>(null);
  const [editingServicePriceData, setEditingServicePriceData] = useState<any>(null);
  const [editingServicePaymentId, setEditingServicePaymentId] = useState<string | null>(null);
  const [editingServicePaymentData, setEditingServicePaymentData] = useState<any>(null);
  const [editingServiceDiscountId, setEditingServiceDiscountId] = useState<string | null>(null);
  const [editingServiceDiscountData, setEditingServiceDiscountData] = useState<any>(null);
  const [newServiceData, setNewServiceData] = useState<any>({ 
    name: "", invoiceIdentifier: "", invoiceable: false, collectable: false, storable: false,
    fromDay: 0, fromMonth: 0, fromYear: 0, toDay: 0, toMonth: 0, toYear: 0, isActive: true, blockAutomation: false, certificateTemplate: "", description: "",
    allowProformaInvoices: false, invoicingPeriodYears: null, firstInvoiceAliquote: false,
    constantSymbol: "", startInvoicing: "", endInvoicing: "", accountingIdOffset: null,
    ledgerAccountProforma: "", ledgerAccountInvoice: ""
  });
  const [editingInstanceId, setEditingInstanceId] = useState<string | null>(null);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editingDiscountId, setEditingDiscountId] = useState<string | null>(null);
  const [copyingService, setCopyingService] = useState<any>(null);
  const [copyTargetInstanceId, setCopyTargetInstanceId] = useState<string>("");

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[95vw] h-[95vh] max-h-[95vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-xl">{product.name}</DialogTitle>
          <DialogDescription>{t.products.editProduct}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto min-h-0">

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="detail">{t.common.detail}</TabsTrigger>
            <TabsTrigger value="instances">{t.konfigurator.tabCollections}</TabsTrigger>
            <TabsTrigger value="services">{t.konfigurator.tabStorage}</TabsTrigger>
            <TabsTrigger value="setts">{t.konfigurator.tabSets}</TabsTrigger>
          </TabsList>

          <TabsContent value="detail" className="space-y-4 mt-4">
            <Card className="p-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>{t.products.productName}</Label>
                    <Input 
                      value={productData.name} 
                      onChange={(e) => setProductData({...productData, name: e.target.value})}
                      data-testid="input-edit-product-name"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>{t.products.description}</Label>
                    <Textarea 
                      value={productData.description} 
                      onChange={(e) => setProductData({...productData, description: e.target.value})}
                      className="min-h-[80px]"
                      data-testid="input-edit-product-description"
                    />
                  </div>
                </div>
                
                <div>
                  <Label className="mb-2 block">{t.products.availableInCountries}</Label>
                  <div className="grid grid-cols-4 gap-2 rounded-lg border p-3">
                    {COUNTRIES.map((country) => (
                      <div key={country.code} className="flex items-center gap-2">
                        <Checkbox
                          id={`edit-country-${country.code}`}
                          checked={productData.countries?.includes(country.code)}
                          onCheckedChange={(checked) => {
                            const newCountries = checked
                              ? [...(productData.countries || []), country.code]
                              : (productData.countries || []).filter((c: string) => c !== country.code);
                            setProductData({...productData, countries: newCountries});
                          }}
                        />
                        <Label htmlFor={`edit-country-${country.code}`} className="text-sm cursor-pointer">{country.name}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <Label className="text-base">{t.common.active}</Label>
                    <p className="text-sm text-muted-foreground">Produkt bude dostupný pre zákazníkov</p>
                  </div>
                  <Switch 
                    checked={productData.isActive} 
                    onCheckedChange={(v) => setProductData({...productData, isActive: v})}
                  />
                </div>
                
                <div className="flex justify-end">
                  <Button 
                    onClick={() => updateProductMutation.mutate(productData)}
                    disabled={updateProductMutation.isPending}
                    data-testid="button-save-product"
                  >
                    {updateProductMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {t.common.save}
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="instances" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Odbery</h4>
              <Button size="sm" onClick={() => setIsAddingInstance(true)} data-testid="button-add-instance">
                <Plus className="h-4 w-4 mr-1" /> {t.common.add}
              </Button>
            </div>

            {isAddingInstance && (
              <Card className="p-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>{t.common.country}</Label>
                    <Select value={newInstanceData.countryCode} onValueChange={(v) => setNewInstanceData({...newInstanceData, countryCode: v})}>
                      <SelectTrigger><SelectValue placeholder={t.common.select} /></SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t.common.name}</Label>
                    <Input value={newInstanceData.name} onChange={(e) => setNewInstanceData({...newInstanceData, name: e.target.value})} />
                  </div>
                  <div>
                    <Label>{t.konfigurator.billingCompany || "Fakturačná spoločnosť"}</Label>
                    <Select value={newInstanceData.billingDetailsId} onValueChange={(v) => setNewInstanceData({...newInstanceData, billingDetailsId: v})}>
                      <SelectTrigger><SelectValue placeholder={t.common.select} /></SelectTrigger>
                      <SelectContent>
                        {billingCompanies.filter(b => b.countryCode === newInstanceData.countryCode).map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.companyName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <Switch checked={newInstanceData.isActive} onCheckedChange={(v) => setNewInstanceData({...newInstanceData, isActive: v})} />
                    <Label>{t.common.active}</Label>
                  </div>
                  <DateFields
                    label={t.konfigurator.validFromLabel}
                    dayValue={newInstanceData.fromDay}
                    monthValue={newInstanceData.fromMonth}
                    yearValue={newInstanceData.fromYear}
                    onDayChange={(v) => setNewInstanceData({...newInstanceData, fromDay: v})}
                    onMonthChange={(v) => setNewInstanceData({...newInstanceData, fromMonth: v})}
                    onYearChange={(v) => setNewInstanceData({...newInstanceData, fromYear: v})}
                    testIdPrefix="new-instance-from"
                  />
                  <DateFields
                    label={t.konfigurator.validToLabel}
                    dayValue={newInstanceData.toDay}
                    monthValue={newInstanceData.toMonth}
                    yearValue={newInstanceData.toYear}
                    onDayChange={(v) => setNewInstanceData({...newInstanceData, toDay: v})}
                    onMonthChange={(v) => setNewInstanceData({...newInstanceData, toMonth: v})}
                    onYearChange={(v) => setNewInstanceData({...newInstanceData, toYear: v})}
                    testIdPrefix="new-instance-to"
                  />
                  <div className="col-span-3">
                    <Label>{t.konfigurator.descriptionLabel}</Label>
                    <Textarea value={newInstanceData.description} onChange={(e) => setNewInstanceData({...newInstanceData, description: e.target.value})} />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={() => setIsAddingInstance(false)}>{t.common.cancel}</Button>
                  <Button size="sm" onClick={() => createInstanceMutation.mutate({
                    ...newInstanceData,
                    fromDate: componentsToISOString(newInstanceData.fromDay, newInstanceData.fromMonth, newInstanceData.fromYear),
                    toDate: componentsToISOString(newInstanceData.toDay, newInstanceData.toMonth, newInstanceData.toYear),
                  })}>{t.common.save}</Button>
                </div>
              </Card>
            )}

            <div className="grid grid-cols-4 gap-2">
              {instances.map(instance => {
                const countryInfo = COUNTRIES.find(c => c.code === instance.countryCode);
                return (
                  <Card 
                    key={instance.id} 
                    className={`p-3 cursor-pointer hover-elevate bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 ${selectedInstanceId === instance.id ? 'ring-2 ring-blue-500' : ''}`}
                    onClick={() => setSelectedInstanceId(instance.id)}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700">
                        {countryInfo?.flag} {instance.countryCode}
                      </Badge>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { 
                          e.stopPropagation(); 
                          setEditingInstanceId(instance.id);
                          const fromParts = parseDateToComponents(instance.fromDate);
                          const toParts = parseDateToComponents(instance.toDate);
                          setEditingInstanceData({
                            ...instance,
                            fromDay: fromParts.day,
                            fromMonth: fromParts.month,
                            fromYear: fromParts.year,
                            toDay: toParts.day,
                            toMonth: toParts.month,
                            toYear: toParts.year,
                          });
                        }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); deleteInstanceMutation.mutate(instance.id); }}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm font-medium mt-1 break-words text-blue-900 dark:text-blue-100">{instance.name}</p>
                    {(instance.fromDate || instance.toDate) && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        {instance.fromDate ? new Date(instance.fromDate).toLocaleDateString() : "..."} - {instance.toDate ? new Date(instance.toDate).toLocaleDateString() : "..."}
                      </p>
                    )}
                    <Badge variant={instance.isActive ? "default" : "secondary"} className="mt-1">
                      {instance.isActive ? t.common.active : t.common.inactive}
                    </Badge>
                  </Card>
                );
              })}
            </div>

            {editingInstanceId && editingInstanceData && (
              <Card className="p-4 mt-4 border-primary">
                <h4 className="font-medium mb-4">Upraviť Odber</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>{t.common.country}</Label>
                    <Select value={editingInstanceData.countryCode} onValueChange={(v) => setEditingInstanceData({...editingInstanceData, countryCode: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t.common.name}</Label>
                    <Input value={editingInstanceData.name} onChange={(e) => setEditingInstanceData({...editingInstanceData, name: e.target.value})} />
                  </div>
                  <div>
                    <Label>Fakturačná spoločnosť</Label>
                    <Select value={editingInstanceData.billingDetailsId || ""} onValueChange={(v) => setEditingInstanceData({...editingInstanceData, billingDetailsId: v})}>
                      <SelectTrigger><SelectValue placeholder={t.common.select} /></SelectTrigger>
                      <SelectContent>
                        {billingCompanies.filter(b => b.countryCode === editingInstanceData.countryCode).map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.companyName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <Switch checked={editingInstanceData.isActive} onCheckedChange={(v) => setEditingInstanceData({...editingInstanceData, isActive: v})} />
                    <Label>{t.common.active}</Label>
                  </div>
                  <DateFields
                    label={t.konfigurator.validFromLabel}
                    dayValue={editingInstanceData.fromDay || 0}
                    monthValue={editingInstanceData.fromMonth || 0}
                    yearValue={editingInstanceData.fromYear || 0}
                    onDayChange={(v) => setEditingInstanceData({...editingInstanceData, fromDay: v})}
                    onMonthChange={(v) => setEditingInstanceData({...editingInstanceData, fromMonth: v})}
                    onYearChange={(v) => setEditingInstanceData({...editingInstanceData, fromYear: v})}
                    testIdPrefix="edit-instance-from"
                  />
                  <DateFields
                    label={t.konfigurator.validToLabel}
                    dayValue={editingInstanceData.toDay || 0}
                    monthValue={editingInstanceData.toMonth || 0}
                    yearValue={editingInstanceData.toYear || 0}
                    onDayChange={(v) => setEditingInstanceData({...editingInstanceData, toDay: v})}
                    onMonthChange={(v) => setEditingInstanceData({...editingInstanceData, toMonth: v})}
                    onYearChange={(v) => setEditingInstanceData({...editingInstanceData, toYear: v})}
                    testIdPrefix="edit-instance-to"
                  />
                  <div className="col-span-3">
                    <Label>{t.konfigurator.descriptionLabel}</Label>
                    <Textarea value={editingInstanceData.description || ""} onChange={(e) => setEditingInstanceData({...editingInstanceData, description: e.target.value})} />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={() => { setEditingInstanceId(null); setEditingInstanceData(null); }}>{t.common.cancel}</Button>
                  <Button size="sm" onClick={() => {
                    const { id, productId, createdAt, fromDay, fromMonth, fromYear, toDay, toMonth, toYear, ...updateData } = editingInstanceData;
                    updateInstanceMutation.mutate({ 
                      id: editingInstanceId, 
                      data: {
                        ...updateData,
                        fromDate: componentsToISOString(fromDay, fromMonth, fromYear),
                        toDate: componentsToISOString(toDay, toMonth, toYear),
                      }
                    });
                  }}>{t.common.save}</Button>
                </div>
              </Card>
            )}

            {selectedInstance && (
              <Card className="mt-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{selectedInstance.name}</CardTitle>
                  <CardDescription>{selectedInstance.countryCode}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs value={instanceSubTab} onValueChange={(v) => setInstanceSubTab(v as any)}>
                    <TabsList>
                      <TabsTrigger value="prices">{t.konfigurator.subTabPrices}</TabsTrigger>
                      <TabsTrigger value="payments">{t.konfigurator.subTabPayments}</TabsTrigger>
                      <TabsTrigger value="discounts">{t.konfigurator.subTabDiscounts}</TabsTrigger>
                      <TabsTrigger value="vat">{t.konfigurator.subTabVat}</TabsTrigger>
                    </TabsList>

                    <TabsContent value="prices" className="space-y-3 mt-3">
                      <div className="flex justify-end">
                        <Button size="sm" onClick={() => setIsAddingPrice(true)}><Plus className="h-4 w-4 mr-1" />{t.common.add}</Button>
                      </div>
                      {isAddingPrice && (
                        <Card className="p-4">
                          <div className="space-y-4">
                            <div className="grid grid-cols-4 gap-3">
                              <div className="col-span-2">
                                <Label>{t.konfigurator.priceName}</Label>
                                <Input value={newPriceData.name} onChange={(e) => setNewPriceData({...newPriceData, name: e.target.value})} placeholder="Napr. Základná cena" />
                              </div>
                              <div>
                                <Label>{t.common.country}</Label>
                                <Select value={newPriceData.countryCode || "ALL"} onValueChange={(v) => setNewPriceData({...newPriceData, countryCode: v === "ALL" ? null : v})}>
                                  <SelectTrigger><SelectValue placeholder={t.common.select} /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="ALL">-- {t.common.all} --</SelectItem>
                                    {COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.flag} {c.code}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex items-center gap-2 pt-6">
                                <Switch checked={newPriceData.isActive} onCheckedChange={(v) => setNewPriceData({...newPriceData, isActive: v})} />
                                <Label>{t.konfigurator.activeLabel}</Label>
                              </div>
                            </div>
                            
                            <Separator />
                            <p className="text-sm font-medium text-muted-foreground">{t.konfigurator.amountAndAccounting}</p>
                            <div className="grid grid-cols-4 gap-3">
                              <div>
                                <Label>{t.konfigurator.priceLabel}</Label>
                                <Input type="number" step="0.01" value={newPriceData.price} onChange={(e) => setNewPriceData({...newPriceData, price: e.target.value})} />
                              </div>
                              <div>
                                <Label>{t.konfigurator.currencyLabel}</Label>
                                <Select value={newPriceData.currency} onValueChange={(v) => setNewPriceData({...newPriceData, currency: v})}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {["EUR", "USD", "CZK", "HUF", "RON", "CHF"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label>{t.konfigurator.accountingCodeLabel}</Label>
                                <Input value={newPriceData.accountingCode} onChange={(e) => setNewPriceData({...newPriceData, accountingCode: e.target.value})} />
                              </div>
                              <div>
                                <Label>{t.konfigurator.analyticalAccountLabel}</Label>
                                <Input value={newPriceData.analyticalAccount} onChange={(e) => setNewPriceData({...newPriceData, analyticalAccount: e.target.value})} />
                              </div>
                            </div>
                            
                            <Separator />
                            <p className="text-sm font-medium text-muted-foreground">{t.konfigurator.validity}</p>
                            <div className="grid grid-cols-2 gap-3">
                              <DateFields
                                label={t.konfigurator.validFromLabel}
                                dayValue={newPriceData.fromDay}
                                monthValue={newPriceData.fromMonth}
                                yearValue={newPriceData.fromYear}
                                onDayChange={(v) => setNewPriceData({...newPriceData, fromDay: v})}
                                onMonthChange={(v) => setNewPriceData({...newPriceData, fromMonth: v})}
                                onYearChange={(v) => setNewPriceData({...newPriceData, fromYear: v})}
                                testIdPrefix="new-price-from"
                              />
                              <DateFields
                                label={t.konfigurator.validToLabel}
                                dayValue={newPriceData.toDay}
                                monthValue={newPriceData.toMonth}
                                yearValue={newPriceData.toYear}
                                onDayChange={(v) => setNewPriceData({...newPriceData, toDay: v})}
                                onMonthChange={(v) => setNewPriceData({...newPriceData, toMonth: v})}
                                onYearChange={(v) => setNewPriceData({...newPriceData, toYear: v})}
                                testIdPrefix="new-price-to"
                              />
                            </div>
                            
                            <div>
                              <Label>{t.konfigurator.descriptionLabel}</Label>
                              <Textarea value={newPriceData.description} onChange={(e) => setNewPriceData({...newPriceData, description: e.target.value})} className="min-h-[60px]" />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                            <Button size="sm" variant="outline" onClick={() => setIsAddingPrice(false)}>{t.common.cancel}</Button>
                            <Button size="sm" onClick={() => createPriceMutation.mutate({ 
                              ...newPriceData, 
                              instanceId: selectedInstanceId!, 
                              instanceType: "market_instance",
                              fromDate: componentsToISOString(newPriceData.fromDay, newPriceData.fromMonth, newPriceData.fromYear),
                              toDate: componentsToISOString(newPriceData.toDay, newPriceData.toMonth, newPriceData.toYear),
                            })}>{t.common.save}</Button>
                          </div>
                        </Card>
                      )}
                      {instancePrices.map(price => {
                        const priceCountryInfo = COUNTRIES.find(c => c.code === price.countryCode);
                        return (
                        <div key={price.id} className="flex items-center justify-between p-2 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                          <div className="flex items-center gap-2 flex-wrap">
                            {price.countryCode ? (
                              <Badge variant="secondary" className="text-xs">
                                {priceCountryInfo?.flag} {price.countryCode}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">{t.common.all || "All"}</Badge>
                            )}
                            <span className="font-medium">{price.name}</span>
                            <Badge variant="outline">{price.price} {price.currency}</Badge>
                            {price.accountingCode && <span className="text-xs text-muted-foreground">Účt: {price.accountingCode}</span>}
                            {price.analyticalAccount && <span className="text-xs text-muted-foreground">Anal: {price.analyticalAccount}</span>}
                            {(price.fromDate || price.toDate) && (
                              <span className="text-xs text-muted-foreground">
                                {price.fromDate ? new Date(price.fromDate).toLocaleDateString() : "..."} - {price.toDate ? new Date(price.toDate).toLocaleDateString() : "..."}
                              </span>
                            )}
                            <Badge variant={price.isActive ? "default" : "secondary"}>{price.isActive ? t.konfigurator.activeLabel : t.konfigurator.inactiveLabel}</Badge>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => { 
                              setEditingPriceId(price.id);
                              const fromParts = parseDateToComponents(price.fromDate);
                              const toParts = parseDateToComponents(price.toDate);
                              setEditingPriceData({
                                ...price,
                                fromDay: fromParts.day,
                                fromMonth: fromParts.month,
                                fromYear: fromParts.year,
                                toDay: toParts.day,
                                toMonth: toParts.month,
                                toYear: toParts.year,
                              }); 
                            }}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => deletePriceMutation.mutate(price.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        </div>
                      );
                      })}
                      {editingPriceId && editingPriceData && (() => {
                        return (
                        <Card className="p-4 border-primary">
                          <div className="space-y-4">
                            <div className="grid grid-cols-4 gap-3">
                              <div className="col-span-2">
                                <Label>{t.konfigurator.priceName}</Label>
                                <Input value={editingPriceData.name} onChange={(e) => setEditingPriceData({...editingPriceData, name: e.target.value})} />
                              </div>
                              <div>
                                <Label>{t.common.country}</Label>
                                <Select value={editingPriceData.countryCode || "ALL"} onValueChange={(v) => setEditingPriceData({...editingPriceData, countryCode: v === "ALL" ? null : v})}>
                                  <SelectTrigger><SelectValue placeholder={t.common.select} /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="ALL">-- {t.common.all} --</SelectItem>
                                    {COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.flag} {c.code}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex items-center gap-2 pt-6">
                                <Switch checked={editingPriceData.isActive} onCheckedChange={(v) => setEditingPriceData({...editingPriceData, isActive: v})} />
                                <Label>{t.konfigurator.activeLabel}</Label>
                              </div>
                            </div>
                            
                            <Separator />
                            <p className="text-sm font-medium text-muted-foreground">{t.konfigurator.amountAndAccounting}</p>
                            <div className="grid grid-cols-4 gap-3">
                              <div>
                                <Label>{t.konfigurator.priceLabel}</Label>
                                <Input type="number" step="0.01" value={editingPriceData.price} onChange={(e) => setEditingPriceData({...editingPriceData, price: e.target.value})} />
                              </div>
                              <div>
                                <Label>{t.konfigurator.currencyLabel}</Label>
                                <Select value={editingPriceData.currency} onValueChange={(v) => setEditingPriceData({...editingPriceData, currency: v})}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {["EUR", "USD", "CZK", "HUF", "RON", "CHF"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label>{t.konfigurator.accountingCodeLabel}</Label>
                                <Input value={editingPriceData.accountingCode || ""} onChange={(e) => setEditingPriceData({...editingPriceData, accountingCode: e.target.value})} />
                              </div>
                              <div>
                                <Label>{t.konfigurator.analyticalAccountLabel}</Label>
                                <Input value={editingPriceData.analyticalAccount || ""} onChange={(e) => setEditingPriceData({...editingPriceData, analyticalAccount: e.target.value})} />
                              </div>
                            </div>
                            
                            <Separator />
                            <p className="text-sm font-medium text-muted-foreground">{t.konfigurator.validity}</p>
                            <div className="grid grid-cols-2 gap-3">
                              <DateFields
                                label={t.konfigurator.validFromLabel}
                                dayValue={editingPriceData.fromDay || 0}
                                monthValue={editingPriceData.fromMonth || 0}
                                yearValue={editingPriceData.fromYear || 0}
                                onDayChange={(v) => setEditingPriceData({...editingPriceData, fromDay: v})}
                                onMonthChange={(v) => setEditingPriceData({...editingPriceData, fromMonth: v})}
                                onYearChange={(v) => setEditingPriceData({...editingPriceData, fromYear: v})}
                                testIdPrefix="edit-price-from"
                              />
                              <DateFields
                                label={t.konfigurator.validToLabel}
                                dayValue={editingPriceData.toDay || 0}
                                monthValue={editingPriceData.toMonth || 0}
                                yearValue={editingPriceData.toYear || 0}
                                onDayChange={(v) => setEditingPriceData({...editingPriceData, toDay: v})}
                                onMonthChange={(v) => setEditingPriceData({...editingPriceData, toMonth: v})}
                                onYearChange={(v) => setEditingPriceData({...editingPriceData, toYear: v})}
                                testIdPrefix="edit-price-to"
                              />
                            </div>
                            
                            <div>
                              <Label>{t.konfigurator.descriptionLabel}</Label>
                              <Textarea value={editingPriceData.description || ""} onChange={(e) => setEditingPriceData({...editingPriceData, description: e.target.value})} className="min-h-[60px]" />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                            <Button size="sm" variant="outline" onClick={() => { setEditingPriceId(null); setEditingPriceData(null); }}>{t.common.cancel}</Button>
                            <Button size="sm" onClick={() => {
                              const { id, instanceId, createdAt, fromDay, fromMonth, fromYear, toDay, toMonth, toYear, ...updateData } = editingPriceData;
                              updatePriceMutation.mutate({ 
                                id: editingPriceId, 
                                data: {
                                  ...updateData,
                                  fromDate: componentsToISOString(fromDay, fromMonth, fromYear),
                                  toDate: componentsToISOString(toDay, toMonth, toYear),
                                }
                              });
                            }}>{t.common.save}</Button>
                          </div>
                        </Card>
                      );
                      })()}
                    </TabsContent>

                    <TabsContent value="payments" className="space-y-3 mt-3">
                      <div className="flex justify-end">
                        <Button size="sm" onClick={() => setIsAddingPayment(true)}><Plus className="h-4 w-4 mr-1" />{t.common.add}</Button>
                      </div>
                      {isAddingPayment && (
                        <Card className="p-4">
                          <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-3">
                              <div className="col-span-2">
                                <Label>Názov platobnej možnosti</Label>
                                <Input value={newPaymentData.name} onChange={(e) => setNewPaymentData({...newPaymentData, name: e.target.value})} placeholder="Napr. Jednorazová platba" />
                              </div>
                              <div className="flex items-center gap-2 pt-6">
                                <Switch checked={newPaymentData.isActive} onCheckedChange={(v) => setNewPaymentData({...newPaymentData, isActive: v})} />
                                <Label>{t.konfigurator.activeLabel}</Label>
                              </div>
                            </div>
                            
                            <Separator />
                            <p className="text-sm font-medium text-muted-foreground">Fakturácia a účtovníctvo</p>
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <Label>Typ platby</Label>
                                <Input value={newPaymentData.type} onChange={(e) => setNewPaymentData({...newPaymentData, type: e.target.value})} placeholder="Napr. single, installment" />
                              </div>
                              <div>
                                <Label>Text na faktúre</Label>
                                <Input value={newPaymentData.invoiceItemText} onChange={(e) => setNewPaymentData({...newPaymentData, invoiceItemText: e.target.value})} />
                              </div>
                              <div>
                                <Label>Poplatok za typ platby</Label>
                                <Input type="number" step="0.01" value={newPaymentData.paymentTypeFee} onChange={(e) => setNewPaymentData({...newPaymentData, paymentTypeFee: e.target.value})} />
                              </div>
                              <div>
                                <Label>{t.konfigurator.accountingCodeLabel}</Label>
                                <Input value={newPaymentData.accountingCode} onChange={(e) => setNewPaymentData({...newPaymentData, accountingCode: e.target.value})} />
                              </div>
                              <div>
                                <Label>{t.konfigurator.analyticalAccountLabel}</Label>
                                <Input value={newPaymentData.analyticalAccount} onChange={(e) => setNewPaymentData({...newPaymentData, analyticalAccount: e.target.value})} />
                              </div>
                            </div>
                            
                            <Separator />
                            <p className="text-sm font-medium text-muted-foreground">{t.konfigurator.validity}</p>
                            <div className="grid grid-cols-2 gap-3">
                              <DateFields
                                label={t.konfigurator.validFromLabel}
                                dayValue={newPaymentData.fromDay}
                                monthValue={newPaymentData.fromMonth}
                                yearValue={newPaymentData.fromYear}
                                onDayChange={(v) => setNewPaymentData({...newPaymentData, fromDay: v})}
                                onMonthChange={(v) => setNewPaymentData({...newPaymentData, fromMonth: v})}
                                onYearChange={(v) => setNewPaymentData({...newPaymentData, fromYear: v})}
                                testIdPrefix="new-payment-from"
                              />
                              <DateFields
                                label={t.konfigurator.validToLabel}
                                dayValue={newPaymentData.toDay}
                                monthValue={newPaymentData.toMonth}
                                yearValue={newPaymentData.toYear}
                                onDayChange={(v) => setNewPaymentData({...newPaymentData, toDay: v})}
                                onMonthChange={(v) => setNewPaymentData({...newPaymentData, toMonth: v})}
                                onYearChange={(v) => setNewPaymentData({...newPaymentData, toYear: v})}
                                testIdPrefix="new-payment-to"
                              />
                            </div>
                            
                            <div>
                              <Label>{t.konfigurator.descriptionLabel}</Label>
                              <Textarea value={newPaymentData.description} onChange={(e) => setNewPaymentData({...newPaymentData, description: e.target.value})} className="min-h-[60px]" />
                            </div>
                            
                            <Separator />
                            <div className="flex items-center gap-2">
                              <Checkbox 
                                id="isMultiPayment" 
                                checked={newPaymentData.isMultiPayment} 
                                onCheckedChange={(v) => setNewPaymentData({...newPaymentData, isMultiPayment: !!v})} 
                              />
                              <Label htmlFor="isMultiPayment" className="font-medium">Viacnásobná platba (splátky)</Label>
                            </div>
                            
                            {newPaymentData.isMultiPayment && (
                              <div className="space-y-4 p-4 bg-muted/50 rounded-md">
                                <div className="grid grid-cols-4 gap-3">
                                  <div>
                                    <Label>Frekvencia</Label>
                                    <Select value={newPaymentData.frequency} onValueChange={(v) => setNewPaymentData({...newPaymentData, frequency: v})}>
                                      <SelectTrigger><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="monthly">Mesačne</SelectItem>
                                        <SelectItem value="quarterly">Štvrťročne</SelectItem>
                                        <SelectItem value="semi_annually">Polročne</SelectItem>
                                        <SelectItem value="annually">Ročne</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label>Počet splátok</Label>
                                    <Input 
                                      type="number" 
                                      min="1" 
                                      max="12" 
                                      value={newPaymentData.installmentCount} 
                                      onChange={(e) => setNewPaymentData({...newPaymentData, installmentCount: parseInt(e.target.value) || 1})} 
                                    />
                                  </div>
                                  <div>
                                    <Label>Typ výpočtu</Label>
                                    <Select value={newPaymentData.calculationMode} onValueChange={(v) => setNewPaymentData({...newPaymentData, calculationMode: v})}>
                                      <SelectTrigger><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="fixed">Fixná suma</SelectItem>
                                        <SelectItem value="percentage">Percentuálna</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label>Základná cena</Label>
                                    <Select value={newPaymentData.basePriceId} onValueChange={(v) => setNewPaymentData({...newPaymentData, basePriceId: v})}>
                                      <SelectTrigger><SelectValue placeholder="Vyberte cenu" /></SelectTrigger>
                                      <SelectContent>
                                        {instancePrices.map((price: any) => (
                                          <SelectItem key={price.id} value={price.id}>{price.name} - {price.price} {price.currency}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                
                                <div className="flex justify-end">
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    disabled={!newPaymentData.basePriceId}
                                    onClick={() => {
                                      const selectedPrice = instancePrices.find((p: any) => p.id === newPaymentData.basePriceId);
                                      if (selectedPrice) {
                                        const installments = generateInstallments(
                                          newPaymentData.installmentCount,
                                          parseFloat(selectedPrice.price),
                                          newPaymentData.calculationMode as "fixed" | "percentage",
                                          newPaymentData.frequency
                                        );
                                        setNewPaymentInstallments(installments);
                                      }
                                    }}
                                  >
                                    Generovať splátky
                                  </Button>
                                </div>
                                
                                {newPaymentInstallments.length > 0 && (
                                  <div className="border rounded-md overflow-hidden">
                                    <table className="w-full text-sm">
                                      <thead className="bg-muted">
                                        <tr>
                                          <th className="p-2 text-left">#</th>
                                          <th className="p-2 text-left">Názov</th>
                                          <th className="p-2 text-left">Typ</th>
                                          {newPaymentData.calculationMode === "percentage" && <th className="p-2 text-right">%</th>}
                                          <th className="p-2 text-right">Suma</th>
                                          <th className="p-2 text-right">Splatnosť (mesiace)</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {newPaymentInstallments.map((inst, idx) => (
                                          <tr key={idx} className="border-t">
                                            <td className="p-2">{inst.installmentNumber}</td>
                                            <td className="p-2">
                                              <Input 
                                                value={inst.label} 
                                                onChange={(e) => {
                                                  const updated = [...newPaymentInstallments];
                                                  updated[idx].label = e.target.value;
                                                  setNewPaymentInstallments(updated);
                                                }}
                                                className="h-8"
                                              />
                                            </td>
                                            <td className="p-2">
                                              <Select 
                                                value={inst.calculationType} 
                                                onValueChange={(v) => {
                                                  const updated = [...newPaymentInstallments];
                                                  updated[idx].calculationType = v;
                                                  setNewPaymentInstallments(updated);
                                                }}
                                              >
                                                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="fixed">Fixná</SelectItem>
                                                  <SelectItem value="percentage">%</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            </td>
                                            {newPaymentData.calculationMode === "percentage" && (
                                              <td className="p-2 text-right">
                                                <Input 
                                                  type="number" 
                                                  step="0.01"
                                                  value={inst.percentage || ""} 
                                                  onChange={(e) => {
                                                    const updated = [...newPaymentInstallments];
                                                    updated[idx].percentage = e.target.value;
                                                    const selectedPrice = instancePrices.find((p: any) => p.id === newPaymentData.basePriceId);
                                                    if (selectedPrice) {
                                                      updated[idx].amount = ((parseFloat(selectedPrice.price) * parseFloat(e.target.value || "0")) / 100).toFixed(2);
                                                    }
                                                    setNewPaymentInstallments(updated);
                                                  }}
                                                  className="h-8 w-20 text-right"
                                                />
                                              </td>
                                            )}
                                            <td className="p-2 text-right">
                                              <Input 
                                                type="number" 
                                                step="0.01"
                                                value={inst.amount} 
                                                onChange={(e) => {
                                                  const updated = [...newPaymentInstallments];
                                                  updated[idx].amount = e.target.value;
                                                  setNewPaymentInstallments(updated);
                                                }}
                                                className="h-8 w-24 text-right"
                                              />
                                            </td>
                                            <td className="p-2 text-right">
                                              <Input 
                                                type="number" 
                                                value={inst.dueOffsetMonths} 
                                                onChange={(e) => {
                                                  const updated = [...newPaymentInstallments];
                                                  updated[idx].dueOffsetMonths = parseInt(e.target.value) || 0;
                                                  setNewPaymentInstallments(updated);
                                                }}
                                                className="h-8 w-20 text-right"
                                              />
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                      <tfoot className="bg-muted">
                                        <tr>
                                          <td colSpan={newPaymentData.calculationMode === "percentage" ? 4 : 3} className="p-2 text-right font-medium">Celkom:</td>
                                          <td className="p-2 text-right font-medium">
                                            {newPaymentInstallments.reduce((sum, inst) => sum + parseFloat(inst.amount || "0"), 0).toFixed(2)}
                                          </td>
                                          <td></td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                            <Button size="sm" variant="outline" onClick={() => { setIsAddingPayment(false); setNewPaymentInstallments([]); }}>{t.common.cancel}</Button>
                            <Button size="sm" onClick={() => {
                              const { fromDay, fromMonth, fromYear, toDay, toMonth, toYear, ...paymentData } = newPaymentData;
                              createPaymentMutation.mutate({ 
                                ...paymentData, 
                                instanceId: selectedInstanceId!, 
                                instanceType: "market_instance",
                                fromDate: componentsToISOString(fromDay, fromMonth, fromYear),
                                toDate: componentsToISOString(toDay, toMonth, toYear),
                                installments: newPaymentData.isMultiPayment ? newPaymentInstallments : undefined,
                              });
                            }}>{t.common.save}</Button>
                          </div>
                        </Card>
                      )}
                      {instancePayments.map(payment => (
                        <div key={payment.id} className="flex items-center justify-between p-2 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{payment.name}</span>
                            {payment.type && <Badge variant="outline">{payment.type}</Badge>}
                            {payment.isMultiPayment && (
                              <Badge variant="secondary">
                                Splátky: {payment.installmentCount}x {
                                  payment.frequency === "monthly" ? "mesačne" :
                                  payment.frequency === "quarterly" ? "štvrťročne" :
                                  payment.frequency === "semi_annually" ? "polročne" : "ročne"
                                }
                              </Badge>
                            )}
                            {payment.paymentTypeFee && <span className="text-sm">Poplatok: {payment.paymentTypeFee}</span>}
                            {(payment.fromDate || payment.toDate) && (
                              <span className="text-xs text-muted-foreground">
                                {payment.fromDate ? new Date(payment.fromDate).toLocaleDateString() : "..."} - {payment.toDate ? new Date(payment.toDate).toLocaleDateString() : "..."}
                              </span>
                            )}
                            <Badge variant={payment.isActive ? "default" : "secondary"}>{payment.isActive ? t.konfigurator.activeLabel : t.konfigurator.inactiveLabel}</Badge>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={async () => { 
                              const fromParts = parseDateToComponents(payment.fromDate);
                              const toParts = parseDateToComponents(payment.toDate);
                              setEditingPaymentId(payment.id); 
                              setEditingPaymentData({
                                ...payment,
                                fromDay: fromParts.day,
                                fromMonth: fromParts.month,
                                fromYear: fromParts.year,
                                toDay: toParts.day,
                                toMonth: toParts.month,
                                toYear: toParts.year,
                              });
                              // Load installments for this payment option
                              if (payment.isMultiPayment) {
                                try {
                                  const res = await fetch(`/api/payment-installments/${payment.id}`);
                                  if (res.ok) {
                                    const installments = await res.json();
                                    setEditingPaymentInstallments(installments);
                                  }
                                } catch (e) {
                                  console.error("Failed to load installments:", e);
                                  setEditingPaymentInstallments([]);
                                }
                              } else {
                                setEditingPaymentInstallments([]);
                              }
                            }}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => deletePaymentMutation.mutate(payment.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        </div>
                      ))}
                      {editingPaymentId && editingPaymentData && (
                        <Card className="p-4 border-primary">
                          <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-3">
                              <div className="col-span-2">
                                <Label>Názov platobnej možnosti</Label>
                                <Input value={editingPaymentData.name} onChange={(e) => setEditingPaymentData({...editingPaymentData, name: e.target.value})} />
                              </div>
                              <div className="flex items-center gap-2 pt-6">
                                <Switch checked={editingPaymentData.isActive} onCheckedChange={(v) => setEditingPaymentData({...editingPaymentData, isActive: v})} />
                                <Label>{t.konfigurator.activeLabel}</Label>
                              </div>
                            </div>
                            
                            <Separator />
                            <p className="text-sm font-medium text-muted-foreground">Fakturácia a účtovníctvo</p>
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <Label>Typ platby</Label>
                                <Input value={editingPaymentData.type || ""} onChange={(e) => setEditingPaymentData({...editingPaymentData, type: e.target.value})} />
                              </div>
                              <div>
                                <Label>Text na faktúre</Label>
                                <Input value={editingPaymentData.invoiceItemText || ""} onChange={(e) => setEditingPaymentData({...editingPaymentData, invoiceItemText: e.target.value})} />
                              </div>
                              <div>
                                <Label>Poplatok za typ platby</Label>
                                <Input type="number" step="0.01" value={editingPaymentData.paymentTypeFee || ""} onChange={(e) => setEditingPaymentData({...editingPaymentData, paymentTypeFee: e.target.value})} />
                              </div>
                              <div>
                                <Label>{t.konfigurator.accountingCodeLabel}</Label>
                                <Input value={editingPaymentData.accountingCode || ""} onChange={(e) => setEditingPaymentData({...editingPaymentData, accountingCode: e.target.value})} />
                              </div>
                              <div>
                                <Label>{t.konfigurator.analyticalAccountLabel}</Label>
                                <Input value={editingPaymentData.analyticalAccount || ""} onChange={(e) => setEditingPaymentData({...editingPaymentData, analyticalAccount: e.target.value})} />
                              </div>
                            </div>
                            
                            <Separator />
                            <p className="text-sm font-medium text-muted-foreground">{t.konfigurator.validity}</p>
                            <div className="grid grid-cols-2 gap-3">
                              <DateFields
                                label={t.konfigurator.validFromLabel}
                                dayValue={editingPaymentData.fromDay}
                                monthValue={editingPaymentData.fromMonth}
                                yearValue={editingPaymentData.fromYear}
                                onDayChange={(v) => setEditingPaymentData({...editingPaymentData, fromDay: v})}
                                onMonthChange={(v) => setEditingPaymentData({...editingPaymentData, fromMonth: v})}
                                onYearChange={(v) => setEditingPaymentData({...editingPaymentData, fromYear: v})}
                                testIdPrefix="edit-payment-from"
                              />
                              <DateFields
                                label={t.konfigurator.validToLabel}
                                dayValue={editingPaymentData.toDay}
                                monthValue={editingPaymentData.toMonth}
                                yearValue={editingPaymentData.toYear}
                                onDayChange={(v) => setEditingPaymentData({...editingPaymentData, toDay: v})}
                                onMonthChange={(v) => setEditingPaymentData({...editingPaymentData, toMonth: v})}
                                onYearChange={(v) => setEditingPaymentData({...editingPaymentData, toYear: v})}
                                testIdPrefix="edit-payment-to"
                              />
                            </div>
                            
                            <div>
                              <Label>{t.konfigurator.descriptionLabel}</Label>
                              <Textarea value={editingPaymentData.description || ""} onChange={(e) => setEditingPaymentData({...editingPaymentData, description: e.target.value})} className="min-h-[60px]" />
                            </div>

                            <Separator />
                            <div className="flex items-center gap-2">
                              <Switch 
                                checked={editingPaymentData.isMultiPayment || false} 
                                onCheckedChange={(v) => setEditingPaymentData({...editingPaymentData, isMultiPayment: v})} 
                              />
                              <Label className="font-medium">Viacnásobná platba (splátky)</Label>
                            </div>
                            
                            {editingPaymentData.isMultiPayment && (
                              <div className="space-y-3 p-3 border rounded-md bg-muted/30">
                                <div className="grid grid-cols-4 gap-3">
                                  <div>
                                    <Label>Frekvencia</Label>
                                    <Select value={editingPaymentData.frequency || "monthly"} onValueChange={(v) => setEditingPaymentData({...editingPaymentData, frequency: v})}>
                                      <SelectTrigger><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="monthly">Mesačne</SelectItem>
                                        <SelectItem value="quarterly">Štvrťročne</SelectItem>
                                        <SelectItem value="semi_annually">Polročne</SelectItem>
                                        <SelectItem value="annually">Ročne</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label>Počet splátok</Label>
                                    <Input 
                                      type="number" 
                                      min={1} 
                                      value={editingPaymentData.installmentCount || 1} 
                                      onChange={(e) => setEditingPaymentData({...editingPaymentData, installmentCount: parseInt(e.target.value) || 1})} 
                                    />
                                  </div>
                                  <div>
                                    <Label>Typ výpočtu</Label>
                                    <Select value={editingPaymentData.calculationMode || "fixed"} onValueChange={(v) => setEditingPaymentData({...editingPaymentData, calculationMode: v})}>
                                      <SelectTrigger><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="fixed">Fixná suma</SelectItem>
                                        <SelectItem value="percentage">Percentuálna</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label>Základná cena</Label>
                                    <Select value={editingPaymentData.basePriceId || ""} onValueChange={(v) => setEditingPaymentData({...editingPaymentData, basePriceId: v})}>
                                      <SelectTrigger><SelectValue placeholder="Vyberte cenu" /></SelectTrigger>
                                      <SelectContent>
                                        {instancePrices.map((price: any) => (
                                          <SelectItem key={price.id} value={price.id}>{price.name} - {price.price} {price.currency}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                
                                <Button 
                                  type="button" 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => {
                                    const count = editingPaymentData.installmentCount || 1;
                                    const basePrice = instancePrices.find((p: any) => p.id === editingPaymentData.basePriceId);
                                    const totalPrice = basePrice ? parseFloat(basePrice.price) : 0;
                                    const mode = editingPaymentData.calculationMode || "fixed";
                                    
                                    const installments = [];
                                    for (let i = 0; i < count; i++) {
                                      if (mode === "fixed") {
                                        const baseAmount = Math.floor((totalPrice / count) * 100) / 100;
                                        const remainder = Math.round((totalPrice - baseAmount * count) * 100) / 100;
                                        installments.push({
                                          label: `Splátka ${i + 1}`,
                                          amount: i === count - 1 ? (baseAmount + remainder).toFixed(2) : baseAmount.toFixed(2),
                                          percentage: null,
                                          dueOffsetMonths: i * (
                                            editingPaymentData.frequency === "monthly" ? 1 :
                                            editingPaymentData.frequency === "quarterly" ? 3 :
                                            editingPaymentData.frequency === "semi_annually" ? 6 : 12
                                          ),
                                          sortOrder: i + 1
                                        });
                                      } else {
                                        const basePercent = Math.floor((100 / count) * 100) / 100;
                                        const remainder = Math.round((100 - basePercent * count) * 100) / 100;
                                        const percent = i === count - 1 ? basePercent + remainder : basePercent;
                                        installments.push({
                                          label: `Splátka ${i + 1}`,
                                          amount: ((totalPrice * percent) / 100).toFixed(2),
                                          percentage: percent.toFixed(2),
                                          dueOffsetMonths: i * (
                                            editingPaymentData.frequency === "monthly" ? 1 :
                                            editingPaymentData.frequency === "quarterly" ? 3 :
                                            editingPaymentData.frequency === "semi_annually" ? 6 : 12
                                          ),
                                          sortOrder: i + 1
                                        });
                                      }
                                    }
                                    setEditingPaymentInstallments(installments);
                                  }}
                                >
                                  Generovať splátky
                                </Button>
                                
                                {editingPaymentInstallments.length > 0 && (
                                  <div className="border rounded-md overflow-hidden">
                                    <table className="w-full text-sm">
                                      <thead className="bg-muted">
                                        <tr>
                                          <th className="p-2 text-left">Poradie</th>
                                          <th className="p-2 text-left">Názov</th>
                                          <th className="p-2 text-right">Suma</th>
                                          {editingPaymentData.calculationMode === "percentage" && <th className="p-2 text-right">%</th>}
                                          <th className="p-2 text-right">Offset (mesiace)</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {editingPaymentInstallments.map((inst, idx) => (
                                          <tr key={idx} className="border-t">
                                            <td className="p-2">{inst.sortOrder}</td>
                                            <td className="p-2">
                                              <Input 
                                                value={inst.label} 
                                                onChange={(e) => {
                                                  const updated = [...editingPaymentInstallments];
                                                  updated[idx].label = e.target.value;
                                                  setEditingPaymentInstallments(updated);
                                                }}
                                                className="h-7"
                                              />
                                            </td>
                                            <td className="p-2">
                                              <Input 
                                                type="number" 
                                                step="0.01"
                                                value={inst.amount} 
                                                onChange={(e) => {
                                                  const updated = [...editingPaymentInstallments];
                                                  updated[idx].amount = e.target.value;
                                                  setEditingPaymentInstallments(updated);
                                                }}
                                                className="h-7 text-right"
                                              />
                                            </td>
                                            {editingPaymentData.calculationMode === "percentage" && (
                                              <td className="p-2">
                                                <Input 
                                                  type="number" 
                                                  step="0.01"
                                                  value={inst.percentage || ""} 
                                                  onChange={(e) => {
                                                    const updated = [...editingPaymentInstallments];
                                                    updated[idx].percentage = e.target.value;
                                                    setEditingPaymentInstallments(updated);
                                                  }}
                                                  className="h-7 text-right"
                                                />
                                              </td>
                                            )}
                                            <td className="p-2">
                                              <Input 
                                                type="number" 
                                                value={inst.dueOffsetMonths} 
                                                onChange={(e) => {
                                                  const updated = [...editingPaymentInstallments];
                                                  updated[idx].dueOffsetMonths = parseInt(e.target.value) || 0;
                                                  setEditingPaymentInstallments(updated);
                                                }}
                                                className="h-7 text-right"
                                              />
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                            <Button size="sm" variant="outline" onClick={() => { setEditingPaymentId(null); setEditingPaymentData(null); setEditingPaymentInstallments([]); }}>{t.common.cancel}</Button>
                            <Button size="sm" onClick={async () => {
                              const { id, instanceId, createdAt, fromDay, fromMonth, fromYear, toDay, toMonth, toYear, ...updateData } = editingPaymentData;
                              await updatePaymentMutation.mutateAsync({ 
                                id: editingPaymentId, 
                                data: {
                                  ...updateData,
                                  fromDate: componentsToISOString(fromDay, fromMonth, fromYear),
                                  toDate: componentsToISOString(toDay, toMonth, toYear),
                                }
                              });
                              // Save installments if multi-payment
                              if (editingPaymentData.isMultiPayment && editingPaymentInstallments.length > 0) {
                                try {
                                  await apiRequest("POST", `/api/payment-installments/${editingPaymentId}/bulk`, {
                                    installments: editingPaymentInstallments
                                  });
                                } catch (e) {
                                  console.error("Failed to save installments:", e);
                                }
                              }
                              setEditingPaymentInstallments([]);
                            }}>{t.common.save}</Button>
                          </div>
                        </Card>
                      )}
                    </TabsContent>

                    <TabsContent value="discounts" className="space-y-3 mt-3">
                      <div className="flex justify-end">
                        <Button size="sm" onClick={() => setIsAddingDiscount(true)}><Plus className="h-4 w-4 mr-1" />{t.common.add}</Button>
                      </div>
                      {isAddingDiscount && (
                        <Card className="p-4">
                          <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-3">
                              <div className="col-span-2">
                                <Label>Názov zľavy</Label>
                                <Input value={newDiscountData.name} onChange={(e) => setNewDiscountData({...newDiscountData, name: e.target.value})} placeholder="Napr. Vernostná zľava" />
                              </div>
                              <div className="flex items-center gap-2 pt-6">
                                <Switch checked={newDiscountData.isActive} onCheckedChange={(v) => setNewDiscountData({...newDiscountData, isActive: v})} />
                                <Label>{t.konfigurator.activeLabel}</Label>
                              </div>
                            </div>
                            
                            <Separator />
                            <p className="text-sm font-medium text-muted-foreground">Typ a hodnota zľavy</p>
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <Label>Typ zľavy</Label>
                                <Input value={newDiscountData.type} onChange={(e) => setNewDiscountData({...newDiscountData, type: e.target.value})} placeholder="Napr. loyalty, promo" />
                              </div>
                              <div className="flex items-center gap-2 pt-6">
                                <Switch checked={newDiscountData.isPercentage} onCheckedChange={(v) => setNewDiscountData({...newDiscountData, isPercentage: v, isFixed: !v})} />
                                <Label>Percentuálna</Label>
                              </div>
                              <div>
                                <Label>{newDiscountData.isPercentage ? t.konfigurator.percentageLabel : t.konfigurator.fixedValueLabel}</Label>
                                <Input 
                                  type="number" 
                                  step="0.01" 
                                  value={newDiscountData.isPercentage ? newDiscountData.percentageValue : newDiscountData.fixedValue} 
                                  onChange={(e) => setNewDiscountData({
                                    ...newDiscountData, 
                                    [newDiscountData.isPercentage ? "percentageValue" : "fixedValue"]: e.target.value
                                  })} 
                                />
                              </div>
                            </div>
                            
                            <Separator />
                            <p className="text-sm font-medium text-muted-foreground">Fakturácia</p>
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <Label>Text na faktúre</Label>
                                <Input value={newDiscountData.invoiceItemText} onChange={(e) => setNewDiscountData({...newDiscountData, invoiceItemText: e.target.value})} />
                              </div>
                              <div>
                                <Label>{t.konfigurator.accountingCodeLabel}</Label>
                                <Input value={newDiscountData.accountingCode || ""} onChange={(e) => setNewDiscountData({...newDiscountData, accountingCode: e.target.value})} />
                              </div>
                              <div>
                                <Label>{t.konfigurator.analyticalAccountLabel}</Label>
                                <Input value={newDiscountData.analyticalAccount} onChange={(e) => setNewDiscountData({...newDiscountData, analyticalAccount: e.target.value})} />
                              </div>
                            </div>
                            
                            <Separator />
                            <p className="text-sm font-medium text-muted-foreground">{t.konfigurator.validity}</p>
                            <div className="grid grid-cols-2 gap-3">
                              <DateFields
                                label={t.konfigurator.validFromLabel}
                                dayValue={newDiscountData.fromDay}
                                monthValue={newDiscountData.fromMonth}
                                yearValue={newDiscountData.fromYear}
                                onDayChange={(v) => setNewDiscountData({...newDiscountData, fromDay: v})}
                                onMonthChange={(v) => setNewDiscountData({...newDiscountData, fromMonth: v})}
                                onYearChange={(v) => setNewDiscountData({...newDiscountData, fromYear: v})}
                                testIdPrefix="new-discount-from"
                              />
                              <DateFields
                                label={t.konfigurator.validToLabel}
                                dayValue={newDiscountData.toDay}
                                monthValue={newDiscountData.toMonth}
                                yearValue={newDiscountData.toYear}
                                onDayChange={(v) => setNewDiscountData({...newDiscountData, toDay: v})}
                                onMonthChange={(v) => setNewDiscountData({...newDiscountData, toMonth: v})}
                                onYearChange={(v) => setNewDiscountData({...newDiscountData, toYear: v})}
                                testIdPrefix="new-discount-to"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                            <Button size="sm" variant="outline" onClick={() => setIsAddingDiscount(false)}>{t.common.cancel}</Button>
                            <Button size="sm" onClick={() => {
                              const { fromDay, fromMonth, fromYear, toDay, toMonth, toYear, ...discountData } = newDiscountData;
                              createDiscountMutation.mutate({ 
                                ...discountData, 
                                instanceId: selectedInstanceId!, 
                                instanceType: "market_instance",
                                fromDate: componentsToISOString(fromDay, fromMonth, fromYear),
                                toDate: componentsToISOString(toDay, toMonth, toYear),
                              });
                            }}>{t.common.save}</Button>
                          </div>
                        </Card>
                      )}
                      {instanceDiscounts.map(discount => (
                        <div key={discount.id} className="flex items-center justify-between p-2 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{discount.name}</span>
                            {discount.type && <Badge variant="outline">{discount.type}</Badge>}
                            {discount.isPercentage && <span className="text-sm">{discount.percentageValue}%</span>}
                            {discount.isFixed && <span className="text-sm">{discount.fixedValue}</span>}
                            {(discount.fromDate || discount.toDate) && (
                              <span className="text-xs text-muted-foreground">
                                {discount.fromDate ? new Date(discount.fromDate).toLocaleDateString() : "..."} - {discount.toDate ? new Date(discount.toDate).toLocaleDateString() : "..."}
                              </span>
                            )}
                            <Badge variant={discount.isActive ? "default" : "secondary"}>{discount.isActive ? t.konfigurator.activeLabel : t.konfigurator.inactiveLabel}</Badge>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => { 
                              const fromParts = parseDateToComponents(discount.fromDate);
                              const toParts = parseDateToComponents(discount.toDate);
                              setEditingDiscountId(discount.id); 
                              setEditingDiscountData({
                                ...discount,
                                fromDay: fromParts.day,
                                fromMonth: fromParts.month,
                                fromYear: fromParts.year,
                                toDay: toParts.day,
                                toMonth: toParts.month,
                                toYear: toParts.year,
                              }); 
                            }}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteDiscountMutation.mutate(discount.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        </div>
                      ))}
                      {editingDiscountId && editingDiscountData && (
                        <Card className="p-4 border-primary">
                          <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-3">
                              <div className="col-span-2">
                                <Label>Názov zľavy</Label>
                                <Input value={editingDiscountData.name} onChange={(e) => setEditingDiscountData({...editingDiscountData, name: e.target.value})} />
                              </div>
                              <div className="flex items-center gap-2 pt-6">
                                <Switch checked={editingDiscountData.isActive} onCheckedChange={(v) => setEditingDiscountData({...editingDiscountData, isActive: v})} />
                                <Label>{t.konfigurator.activeLabel}</Label>
                              </div>
                            </div>
                            
                            <Separator />
                            <p className="text-sm font-medium text-muted-foreground">Typ a hodnota zľavy</p>
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <Label>Typ zľavy</Label>
                                <Input value={editingDiscountData.type || ""} onChange={(e) => setEditingDiscountData({...editingDiscountData, type: e.target.value})} />
                              </div>
                              <div className="flex items-center gap-2 pt-6">
                                <Switch checked={editingDiscountData.isPercentage} onCheckedChange={(v) => setEditingDiscountData({...editingDiscountData, isPercentage: v, isFixed: !v})} />
                                <Label>Percentuálna</Label>
                              </div>
                              <div>
                                <Label>{editingDiscountData.isPercentage ? t.konfigurator.percentageLabel : t.konfigurator.fixedValueLabel}</Label>
                                <Input 
                                  type="number" 
                                  step="0.01" 
                                  value={editingDiscountData.isPercentage ? (editingDiscountData.percentageValue || "") : (editingDiscountData.fixedValue || "")} 
                                  onChange={(e) => setEditingDiscountData({
                                    ...editingDiscountData, 
                                    [editingDiscountData.isPercentage ? "percentageValue" : "fixedValue"]: e.target.value
                                  })} 
                                />
                              </div>
                            </div>
                            
                            <Separator />
                            <p className="text-sm font-medium text-muted-foreground">Fakturácia</p>
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <Label>Text na faktúre</Label>
                                <Input value={editingDiscountData.invoiceItemText || ""} onChange={(e) => setEditingDiscountData({...editingDiscountData, invoiceItemText: e.target.value})} />
                              </div>
                              <div>
                                <Label>{t.konfigurator.accountingCodeLabel}</Label>
                                <Input value={editingDiscountData.accountingCode || ""} onChange={(e) => setEditingDiscountData({...editingDiscountData, accountingCode: e.target.value})} />
                              </div>
                              <div>
                                <Label>{t.konfigurator.analyticalAccountLabel}</Label>
                                <Input value={editingDiscountData.analyticalAccount || ""} onChange={(e) => setEditingDiscountData({...editingDiscountData, analyticalAccount: e.target.value})} />
                              </div>
                            </div>
                            
                            <Separator />
                            <p className="text-sm font-medium text-muted-foreground">{t.konfigurator.validity}</p>
                            <div className="grid grid-cols-2 gap-3">
                              <DateFields
                                label={t.konfigurator.validFromLabel}
                                dayValue={editingDiscountData.fromDay}
                                monthValue={editingDiscountData.fromMonth}
                                yearValue={editingDiscountData.fromYear}
                                onDayChange={(v) => setEditingDiscountData({...editingDiscountData, fromDay: v})}
                                onMonthChange={(v) => setEditingDiscountData({...editingDiscountData, fromMonth: v})}
                                onYearChange={(v) => setEditingDiscountData({...editingDiscountData, fromYear: v})}
                                testIdPrefix="edit-discount-from"
                              />
                              <DateFields
                                label={t.konfigurator.validToLabel}
                                dayValue={editingDiscountData.toDay}
                                monthValue={editingDiscountData.toMonth}
                                yearValue={editingDiscountData.toYear}
                                onDayChange={(v) => setEditingDiscountData({...editingDiscountData, toDay: v})}
                                onMonthChange={(v) => setEditingDiscountData({...editingDiscountData, toMonth: v})}
                                onYearChange={(v) => setEditingDiscountData({...editingDiscountData, toYear: v})}
                                testIdPrefix="edit-discount-to"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                            <Button size="sm" variant="outline" onClick={() => { setEditingDiscountId(null); setEditingDiscountData(null); }}>{t.common.cancel}</Button>
                            <Button size="sm" onClick={() => {
                              const { id, instanceId, createdAt, fromDay, fromMonth, fromYear, toDay, toMonth, toYear, ...updateData } = editingDiscountData;
                              updateDiscountMutation.mutate({ 
                                id: editingDiscountId, 
                                data: {
                                  ...updateData,
                                  fromDate: componentsToISOString(fromDay, fromMonth, fromYear),
                                  toDate: componentsToISOString(toDay, toMonth, toYear),
                                }
                              });
                            }}>{t.common.save}</Button>
                          </div>
                        </Card>
                      )}
                    </TabsContent>

                    <TabsContent value="vat" className="space-y-3 mt-3">
                      <div className="flex justify-end">
                        <Button size="sm" onClick={() => setIsAddingVat(true)}><Plus className="h-4 w-4 mr-1" />{t.common.add}</Button>
                      </div>
                      {isAddingVat && (
                        <Card className="p-4">
                          <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <Label>Kategória</Label>
                                <Input 
                                  value={newVatRateData.category} 
                                  onChange={(e) => setNewVatRateData({...newVatRateData, category: e.target.value})} 
                                  placeholder="Napr. standard, reduced"
                                  data-testid="input-vat-category"
                                />
                              </div>
                              <div>
                                <Label>{t.konfigurator.accountingCodeLabel}</Label>
                                <Input 
                                  value={newVatRateData.accountingCode} 
                                  onChange={(e) => setNewVatRateData({...newVatRateData, accountingCode: e.target.value})}
                                  data-testid="input-vat-accounting-code"
                                />
                              </div>
                              <div>
                                <Label>VAT sadzba (%)</Label>
                                <Input 
                                  type="number" 
                                  step="0.01" 
                                  value={newVatRateData.vatRate} 
                                  onChange={(e) => setNewVatRateData({...newVatRateData, vatRate: e.target.value})}
                                  data-testid="input-vat-rate"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <DateFields
                                label={t.konfigurator.validFromLabel}
                                dayValue={newVatRateData.fromDay}
                                monthValue={newVatRateData.fromMonth}
                                yearValue={newVatRateData.fromYear}
                                onDayChange={(v) => setNewVatRateData({...newVatRateData, fromDay: v})}
                                onMonthChange={(v) => setNewVatRateData({...newVatRateData, fromMonth: v})}
                                onYearChange={(v) => setNewVatRateData({...newVatRateData, fromYear: v})}
                                testIdPrefix="new-vat-from"
                              />
                              <DateFields
                                label={t.konfigurator.validToLabel}
                                dayValue={newVatRateData.toDay}
                                monthValue={newVatRateData.toMonth}
                                yearValue={newVatRateData.toYear}
                                onDayChange={(v) => setNewVatRateData({...newVatRateData, toDay: v})}
                                onMonthChange={(v) => setNewVatRateData({...newVatRateData, toMonth: v})}
                                onYearChange={(v) => setNewVatRateData({...newVatRateData, toYear: v})}
                                testIdPrefix="new-vat-to"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch 
                                checked={newVatRateData.createAsNewVat} 
                                onCheckedChange={(v) => setNewVatRateData({...newVatRateData, createAsNewVat: v})}
                                data-testid="switch-vat-create-as-new"
                              />
                              <Label>Vytvoriť ako nové VAT</Label>
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                            <Button size="sm" variant="outline" onClick={() => setIsAddingVat(false)}>{t.common.cancel}</Button>
                            <Button 
                              size="sm" 
                              disabled={!newVatRateData.category || createVatRateMutation.isPending}
                              onClick={() => {
                                const payload: any = {
                                  instanceId: selectedInstanceId!,
                                  instanceType: "market_instance",
                                  category: newVatRateData.category,
                                  accountingCode: newVatRateData.accountingCode || null,
                                  vatRate: newVatRateData.vatRate === "" ? null : newVatRateData.vatRate,
                                  fromDate: componentsToISOString(newVatRateData.fromDay, newVatRateData.fromMonth, newVatRateData.fromYear),
                                  toDate: componentsToISOString(newVatRateData.toDay, newVatRateData.toMonth, newVatRateData.toYear),
                                  createAsNewVat: newVatRateData.createAsNewVat,
                                };
                                createVatRateMutation.mutate(payload);
                              }}
                            >{t.common.save}</Button>
                          </div>
                        </Card>
                      )}
                      {instanceVatRates.map((vat: any) => (
                        editingVatId === vat.id ? (
                          <Card key={vat.id} className="p-4">
                            <div className="space-y-4">
                              <div className="grid grid-cols-3 gap-3">
                                <div>
                                  <Label>Kategória</Label>
                                  <Input 
                                    value={editingVatData.category} 
                                    onChange={(e) => setEditingVatData({...editingVatData, category: e.target.value})} 
                                    data-testid="input-edit-vat-category"
                                  />
                                </div>
                                <div>
                                  <Label>{t.konfigurator.accountingCodeLabel}</Label>
                                  <Input 
                                    value={editingVatData.accountingCode || ""} 
                                    onChange={(e) => setEditingVatData({...editingVatData, accountingCode: e.target.value})}
                                    data-testid="input-edit-vat-accounting-code"
                                  />
                                </div>
                                <div>
                                  <Label>VAT sadzba (%)</Label>
                                  <Input 
                                    type="number" 
                                    step="0.01" 
                                    value={editingVatData.vatRate || ""} 
                                    onChange={(e) => setEditingVatData({...editingVatData, vatRate: e.target.value})}
                                    data-testid="input-edit-vat-rate"
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <DateFields
                                  label={t.konfigurator.validFromLabel}
                                  dayValue={editingVatData.fromDay}
                                  monthValue={editingVatData.fromMonth}
                                  yearValue={editingVatData.fromYear}
                                  onDayChange={(v) => setEditingVatData({...editingVatData, fromDay: v})}
                                  onMonthChange={(v) => setEditingVatData({...editingVatData, fromMonth: v})}
                                  onYearChange={(v) => setEditingVatData({...editingVatData, fromYear: v})}
                                  testIdPrefix="edit-vat-from"
                                />
                                <DateFields
                                  label={t.konfigurator.validToLabel}
                                  dayValue={editingVatData.toDay}
                                  monthValue={editingVatData.toMonth}
                                  yearValue={editingVatData.toYear}
                                  onDayChange={(v) => setEditingVatData({...editingVatData, toDay: v})}
                                  onMonthChange={(v) => setEditingVatData({...editingVatData, toMonth: v})}
                                  onYearChange={(v) => setEditingVatData({...editingVatData, toYear: v})}
                                  testIdPrefix="edit-vat-to"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <Switch 
                                  checked={editingVatData.createAsNewVat} 
                                  onCheckedChange={(v) => setEditingVatData({...editingVatData, createAsNewVat: v})}
                                  data-testid="switch-edit-vat-create-as-new"
                                />
                                <Label>Vytvoriť ako nové VAT</Label>
                              </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                              <Button size="sm" variant="outline" onClick={() => { setEditingVatId(null); setEditingVatData(null); }}>{t.common.cancel}</Button>
                              <Button 
                                size="sm" 
                                onClick={() => {
                                  const { id, instanceId, instanceType, createdAt, fromDay, fromMonth, fromYear, toDay, toMonth, toYear, ...updateData } = editingVatData;
                                  updateVatRateMutation.mutate({ 
                                    id: editingVatId, 
                                    data: {
                                      ...updateData,
                                      vatRate: updateData.vatRate === "" ? null : updateData.vatRate,
                                      accountingCode: updateData.accountingCode || null,
                                      fromDate: componentsToISOString(fromDay, fromMonth, fromYear),
                                      toDate: componentsToISOString(toDay, toMonth, toYear),
                                    }
                                  });
                                }}
                              >{t.common.save}</Button>
                            </div>
                          </Card>
                        ) : (
                          <div key={vat.id} className="flex items-center justify-between p-2 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{vat.category}</span>
                              {vat.vatRate && <Badge variant="outline">{vat.vatRate}%</Badge>}
                              {vat.accountingCode && <span className="text-sm text-muted-foreground">{vat.accountingCode}</span>}
                              {(vat.fromDate || vat.toDate) && (
                                <span className="text-sm text-muted-foreground">
                                  {vat.fromDate ? formatDate(vat.fromDate) : "—"} – {vat.toDate ? formatDate(vat.toDate) : "—"}
                                </span>
                              )}
                              {vat.createAsNewVat && <Badge variant="secondary">Nové VAT</Badge>}
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => {
                                const fromParts = isoStringToComponents(vat.fromDate);
                                const toParts = isoStringToComponents(vat.toDate);
                                setEditingVatId(vat.id);
                                setEditingVatData({ ...vat, fromDay: fromParts.day, fromMonth: fromParts.month, fromYear: fromParts.year, toDay: toParts.day, toMonth: toParts.month, toYear: toParts.year });
                              }}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => deleteVatRateMutation.mutate(vat.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </div>
                          </div>
                        )
                      ))}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="services" className="space-y-4 mt-4">
            {!selectedInstanceId ? (
              <div className="text-center py-8 text-muted-foreground">
                Najprv vyberte Odber pre správu skladovania
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Skladovanie pre: {selectedInstance?.name}</h4>
                  <Button size="sm" onClick={() => setIsAddingService(true)} data-testid="button-add-service">
                    <Plus className="h-4 w-4 mr-1" /> {t.common.add}
                  </Button>
                </div>

                {isAddingService && (
                  <Card className="p-4">
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                          <Label>Názov služby</Label>
                          <Input value={newServiceData.name} onChange={(e) => setNewServiceData({...newServiceData, name: e.target.value})} placeholder="Napr. Odobratie krvi" />
                        </div>
                        <div className="flex items-center gap-2 pt-6">
                          <Switch checked={newServiceData.isActive} onCheckedChange={(v) => setNewServiceData({...newServiceData, isActive: v})} />
                          <Label>{t.common.active}</Label>
                        </div>
                      </div>
                      
                      <Separator />
                      <p className="text-sm font-medium text-muted-foreground">Fakturácia</p>
                      <div className="grid grid-cols-4 gap-3">
                        <div className="col-span-2">
                          <Label>Identifikátor faktúry</Label>
                          <Input value={newServiceData.invoiceIdentifier} onChange={(e) => setNewServiceData({...newServiceData, invoiceIdentifier: e.target.value})} />
                        </div>
                        <div className="flex items-center gap-2 pt-6">
                          <Checkbox checked={newServiceData.invoiceable} onCheckedChange={(v) => setNewServiceData({...newServiceData, invoiceable: !!v})} />
                          <Label>Fakturovateľné</Label>
                        </div>
                        <div className="flex items-center gap-2 pt-6">
                          <Checkbox checked={newServiceData.collectable} onCheckedChange={(v) => setNewServiceData({...newServiceData, collectable: !!v})} />
                          <Label>Zberné</Label>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Checkbox checked={newServiceData.storable} onCheckedChange={(v) => setNewServiceData({...newServiceData, storable: !!v})} />
                          <Label>Skladovateľné</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox checked={newServiceData.blockAutomation} onCheckedChange={(v) => setNewServiceData({...newServiceData, blockAutomation: !!v})} />
                          <Label className="flex items-center gap-1">
                            Blokovať automatizáciu
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Blokuje automatické generovanie faktúr pre túto službu</p>
                              </TooltipContent>
                            </Tooltip>
                          </Label>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="flex items-center gap-2">
                          <Checkbox checked={newServiceData.allowProformaInvoices} onCheckedChange={(v) => setNewServiceData({...newServiceData, allowProformaInvoices: !!v})} />
                          <Label>Povoliť proforma faktúry</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox checked={newServiceData.firstInvoiceAliquote} onCheckedChange={(v) => setNewServiceData({...newServiceData, firstInvoiceAliquote: !!v})} />
                          <Label>1. faktúra je alikvotná</Label>
                        </div>
                        <div>
                          <Label>Fakturačné obdobie (v rokoch)</Label>
                          <Select value={newServiceData.invoicingPeriodYears?.toString() || ""} onValueChange={(v) => setNewServiceData({...newServiceData, invoicingPeriodYears: v ? parseInt(v) : null})}>
                            <SelectTrigger><SelectValue placeholder="Vyberte obdobie" /></SelectTrigger>
                            <SelectContent>
                              {Array.from({length: 50}, (_, i) => i + 1).map(year => (
                                <SelectItem key={year} value={year.toString()}>{year} {year === 1 ? "rok" : year < 5 ? "roky" : "rokov"}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label>Konštantný symbol</Label>
                          <Input value={newServiceData.constantSymbol} onChange={(e) => setNewServiceData({...newServiceData, constantSymbol: e.target.value})} />
                        </div>
                        <div>
                          <Label>Začiatok fakturácie</Label>
                          <Input value={newServiceData.startInvoicing} onChange={(e) => setNewServiceData({...newServiceData, startInvoicing: e.target.value})} />
                        </div>
                        <div>
                          <Label>Koniec fakturácie</Label>
                          <Input value={newServiceData.endInvoicing} onChange={(e) => setNewServiceData({...newServiceData, endInvoicing: e.target.value})} />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label>Accounting ID Offset</Label>
                          <Input type="number" value={newServiceData.accountingIdOffset || ""} onChange={(e) => setNewServiceData({...newServiceData, accountingIdOffset: e.target.value ? parseInt(e.target.value) : null})} />
                        </div>
                        <div>
                          <Label>Účet hlavnej knihy - PROFORMA</Label>
                          <Input value={newServiceData.ledgerAccountProforma} onChange={(e) => setNewServiceData({...newServiceData, ledgerAccountProforma: e.target.value})} />
                        </div>
                        <div>
                          <Label>Účet hlavnej knihy - FAKTÚRA</Label>
                          <Input value={newServiceData.ledgerAccountInvoice} onChange={(e) => setNewServiceData({...newServiceData, ledgerAccountInvoice: e.target.value})} />
                        </div>
                      </div>
                      
                      <Separator />
                      <p className="text-sm font-medium text-muted-foreground">{t.konfigurator.validity}</p>
                      <div className="grid grid-cols-2 gap-3">
                        <DateFields
                          label={t.konfigurator.validFromLabel}
                          dayValue={newServiceData.fromDay}
                          monthValue={newServiceData.fromMonth}
                          yearValue={newServiceData.fromYear}
                          onDayChange={(v) => setNewServiceData({...newServiceData, fromDay: v})}
                          onMonthChange={(v) => setNewServiceData({...newServiceData, fromMonth: v})}
                          onYearChange={(v) => setNewServiceData({...newServiceData, fromYear: v})}
                          testIdPrefix="new-service-from"
                        />
                        <DateFields
                          label={t.konfigurator.validToLabel}
                          dayValue={newServiceData.toDay}
                          monthValue={newServiceData.toMonth}
                          yearValue={newServiceData.toYear}
                          onDayChange={(v) => setNewServiceData({...newServiceData, toDay: v})}
                          onMonthChange={(v) => setNewServiceData({...newServiceData, toMonth: v})}
                          onYearChange={(v) => setNewServiceData({...newServiceData, toYear: v})}
                          testIdPrefix="new-service-to"
                        />
                      </div>
                      
                      <div>
                        <Label>{t.konfigurator.descriptionLabel}</Label>
                        <Textarea value={newServiceData.description} onChange={(e) => setNewServiceData({...newServiceData, description: e.target.value})} className="min-h-[60px]" />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                      <Button variant="outline" size="sm" onClick={() => setIsAddingService(false)}>{t.common.cancel}</Button>
                      <Button size="sm" onClick={() => createServiceMutation.mutate({
                        ...newServiceData,
                        fromDate: componentsToISOString(newServiceData.fromDay, newServiceData.fromMonth, newServiceData.fromYear),
                        toDate: componentsToISOString(newServiceData.toDay, newServiceData.toMonth, newServiceData.toYear),
                      })}>{t.common.save}</Button>
                    </div>
                  </Card>
                )}

                <div className="grid grid-cols-3 gap-2">
                  {(services as any[]).map(service => {
                    const countryInfo = COUNTRIES.find(c => c.code === selectedInstance?.countryCode);
                    return (
                      <Card 
                        key={service.id} 
                        className={`p-3 cursor-pointer hover-elevate bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 ${selectedServiceId === service.id ? 'ring-2 ring-green-500' : ''}`}
                        onClick={() => setSelectedServiceId(service.id)}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <Badge variant="secondary" className="bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700">
                            {countryInfo?.flag} {selectedInstance?.countryCode}
                          </Badge>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { 
                              e.stopPropagation();
                              const fromParts = parseDateToComponents(service.fromDate);
                              const toParts = parseDateToComponents(service.toDate);
                              setEditingServiceId(service.id);
                              setEditingServiceData({
                                ...service,
                                fromDay: fromParts.day,
                                fromMonth: fromParts.month,
                                fromYear: fromParts.year,
                                toDay: toParts.day,
                                toMonth: toParts.month,
                                toYear: toParts.year,
                              });
                            }}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { 
                              e.stopPropagation(); 
                              setCopyingService(service);
                              setCopyTargetInstanceId("");
                            }}>
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); deleteServiceMutation.mutate(service.id); }}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm font-medium mt-1 truncate text-green-900 dark:text-green-100">{service.name}</p>
                        <div className="text-xs text-green-600 dark:text-green-400">{service.invoiceIdentifier}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {service.invoiceable && <Badge variant="outline" className="text-xs border-green-300 dark:border-green-700">Faktúr.</Badge>}
                          {service.collectable && <Badge variant="outline" className="text-xs border-green-300 dark:border-green-700">Zber.</Badge>}
                          {service.storable && <Badge variant="outline" className="text-xs border-green-300 dark:border-green-700">Sklad.</Badge>}
                        </div>
                        {(service.fromDate || service.toDate) && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                            {service.fromDate ? new Date(service.fromDate).toLocaleDateString() : "..."} - {service.toDate ? new Date(service.toDate).toLocaleDateString() : "..."}
                          </p>
                        )}
                        <Badge variant={service.isActive ? "default" : "secondary"} className="mt-1">
                          {service.isActive ? t.common.active : t.common.inactive}
                        </Badge>
                      </Card>
                    );
                  })}
                </div>

                {editingServiceId && editingServiceData && (
                  <Card className="p-4 mt-4 border-primary">
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                          <Label>Názov služby</Label>
                          <Input value={editingServiceData.name} onChange={(e) => setEditingServiceData({...editingServiceData, name: e.target.value})} />
                        </div>
                        <div className="flex items-center gap-2 pt-6">
                          <Switch checked={editingServiceData.isActive} onCheckedChange={(v) => setEditingServiceData({...editingServiceData, isActive: v})} />
                          <Label>{t.common.active}</Label>
                        </div>
                      </div>
                      
                      <Separator />
                      <p className="text-sm font-medium text-muted-foreground">Fakturácia</p>
                      <div className="grid grid-cols-4 gap-3">
                        <div className="col-span-2">
                          <Label>Identifikátor faktúry</Label>
                          <Input value={editingServiceData.invoiceIdentifier || ""} onChange={(e) => setEditingServiceData({...editingServiceData, invoiceIdentifier: e.target.value})} />
                        </div>
                        <div className="flex items-center gap-2 pt-6">
                          <Checkbox checked={editingServiceData.invoiceable} onCheckedChange={(v) => setEditingServiceData({...editingServiceData, invoiceable: !!v})} />
                          <Label>Fakturovateľné</Label>
                        </div>
                        <div className="flex items-center gap-2 pt-6">
                          <Checkbox checked={editingServiceData.collectable} onCheckedChange={(v) => setEditingServiceData({...editingServiceData, collectable: !!v})} />
                          <Label>Zberné</Label>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Checkbox checked={editingServiceData.storable} onCheckedChange={(v) => setEditingServiceData({...editingServiceData, storable: !!v})} />
                          <Label>Skladovateľné</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox checked={editingServiceData.blockAutomation} onCheckedChange={(v) => setEditingServiceData({...editingServiceData, blockAutomation: !!v})} />
                          <Label className="flex items-center gap-1">
                            Blokovať automatizáciu
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Blokuje automatické generovanie faktúr pre túto službu</p>
                              </TooltipContent>
                            </Tooltip>
                          </Label>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="flex items-center gap-2">
                          <Checkbox checked={editingServiceData.allowProformaInvoices} onCheckedChange={(v) => setEditingServiceData({...editingServiceData, allowProformaInvoices: !!v})} />
                          <Label>Povoliť proforma faktúry</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox checked={editingServiceData.firstInvoiceAliquote} onCheckedChange={(v) => setEditingServiceData({...editingServiceData, firstInvoiceAliquote: !!v})} />
                          <Label>1. faktúra je alikvotná</Label>
                        </div>
                        <div>
                          <Label>Fakturačné obdobie (v rokoch)</Label>
                          <Select value={editingServiceData.invoicingPeriodYears?.toString() || ""} onValueChange={(v) => setEditingServiceData({...editingServiceData, invoicingPeriodYears: v ? parseInt(v) : null})}>
                            <SelectTrigger><SelectValue placeholder="Vyberte obdobie" /></SelectTrigger>
                            <SelectContent>
                              {Array.from({length: 50}, (_, i) => i + 1).map(year => (
                                <SelectItem key={year} value={year.toString()}>{year} {year === 1 ? "rok" : year < 5 ? "roky" : "rokov"}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label>Konštantný symbol</Label>
                          <Input value={editingServiceData.constantSymbol || ""} onChange={(e) => setEditingServiceData({...editingServiceData, constantSymbol: e.target.value})} />
                        </div>
                        <div>
                          <Label>Začiatok fakturácie</Label>
                          <Input value={editingServiceData.startInvoicing || ""} onChange={(e) => setEditingServiceData({...editingServiceData, startInvoicing: e.target.value})} />
                        </div>
                        <div>
                          <Label>Koniec fakturácie</Label>
                          <Input value={editingServiceData.endInvoicing || ""} onChange={(e) => setEditingServiceData({...editingServiceData, endInvoicing: e.target.value})} />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label>Accounting ID Offset</Label>
                          <Input type="number" value={editingServiceData.accountingIdOffset || ""} onChange={(e) => setEditingServiceData({...editingServiceData, accountingIdOffset: e.target.value ? parseInt(e.target.value) : null})} />
                        </div>
                        <div>
                          <Label>Účet hlavnej knihy - PROFORMA</Label>
                          <Input value={editingServiceData.ledgerAccountProforma || ""} onChange={(e) => setEditingServiceData({...editingServiceData, ledgerAccountProforma: e.target.value})} />
                        </div>
                        <div>
                          <Label>Účet hlavnej knihy - FAKTÚRA</Label>
                          <Input value={editingServiceData.ledgerAccountInvoice || ""} onChange={(e) => setEditingServiceData({...editingServiceData, ledgerAccountInvoice: e.target.value})} />
                        </div>
                      </div>
                      
                      <Separator />
                      <p className="text-sm font-medium text-muted-foreground">{t.konfigurator.validity}</p>
                      <div className="grid grid-cols-2 gap-3">
                        <DateFields
                          label={t.konfigurator.validFromLabel}
                          dayValue={editingServiceData.fromDay}
                          monthValue={editingServiceData.fromMonth}
                          yearValue={editingServiceData.fromYear}
                          onDayChange={(v) => setEditingServiceData({...editingServiceData, fromDay: v})}
                          onMonthChange={(v) => setEditingServiceData({...editingServiceData, fromMonth: v})}
                          onYearChange={(v) => setEditingServiceData({...editingServiceData, fromYear: v})}
                          testIdPrefix="edit-service-from"
                        />
                        <DateFields
                          label={t.konfigurator.validToLabel}
                          dayValue={editingServiceData.toDay}
                          monthValue={editingServiceData.toMonth}
                          yearValue={editingServiceData.toYear}
                          onDayChange={(v) => setEditingServiceData({...editingServiceData, toDay: v})}
                          onMonthChange={(v) => setEditingServiceData({...editingServiceData, toMonth: v})}
                          onYearChange={(v) => setEditingServiceData({...editingServiceData, toYear: v})}
                          testIdPrefix="edit-service-to"
                        />
                      </div>
                      
                      <div>
                        <Label>{t.konfigurator.descriptionLabel}</Label>
                        <Textarea value={editingServiceData.description || ""} onChange={(e) => setEditingServiceData({...editingServiceData, description: e.target.value})} className="min-h-[60px]" />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                      <Button variant="outline" size="sm" onClick={() => { setEditingServiceId(null); setEditingServiceData(null); }}>{t.common.cancel}</Button>
                      <Button size="sm" onClick={() => {
                        const { id, instanceId, createdAt, fromDay, fromMonth, fromYear, toDay, toMonth, toYear, ...serviceData } = editingServiceData;
                        updateServiceMutation.mutate({ 
                          id: editingServiceId, 
                          data: {
                            ...serviceData,
                            fromDate: componentsToISOString(fromDay, fromMonth, fromYear),
                            toDate: componentsToISOString(toDay, toMonth, toYear),
                          }
                        });
                      }}>{t.common.save}</Button>
                    </div>
                  </Card>
                )}

                {selectedService && (
                  <Card className="mt-4">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center justify-between gap-2">
                        <span>{selectedService.name}</span>
                        <Button size="sm" variant="ghost" onClick={() => setSelectedServiceId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Tabs value={serviceSubTab} onValueChange={(v) => setServiceSubTab(v as any)}>
                        <TabsList>
                          <TabsTrigger value="prices">{t.konfigurator.subTabPrices}</TabsTrigger>
                          <TabsTrigger value="payments">{t.konfigurator.subTabPayments}</TabsTrigger>
                          <TabsTrigger value="discounts">{t.konfigurator.subTabDiscounts}</TabsTrigger>
                          <TabsTrigger value="vat">{t.konfigurator.subTabVat}</TabsTrigger>
                        </TabsList>

                        <TabsContent value="prices" className="space-y-3 mt-3">
                          <div className="flex justify-end">
                            <Button size="sm" onClick={() => setIsAddingServicePrice(true)}><Plus className="h-4 w-4 mr-1" />Pridať cenu</Button>
                          </div>
                          {isAddingServicePrice && (
                            <Card className="p-4">
                              <div className="space-y-4">
                                <div className="grid grid-cols-3 gap-3">
                                  <div className="col-span-2">
                                    <Label>{t.konfigurator.priceName}</Label>
                                    <Input value={newServicePriceData.name} onChange={(e) => setNewServicePriceData({...newServicePriceData, name: e.target.value})} placeholder="Napr. Ročné skladovanie" />
                                  </div>
                                  <div className="flex items-center gap-2 pt-6">
                                    <Switch checked={newServicePriceData.isActive} onCheckedChange={(v) => setNewServicePriceData({...newServicePriceData, isActive: v})} />
                                    <Label>{t.konfigurator.activeLabel}</Label>
                                  </div>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                  <div>
                                    <Label>{t.konfigurator.priceLabel}</Label>
                                    <Input type="number" step="0.01" value={newServicePriceData.price} onChange={(e) => setNewServicePriceData({...newServicePriceData, price: e.target.value})} />
                                  </div>
                                  <div>
                                    <Label>{t.konfigurator.currencyLabel}</Label>
                                    <Select value={newServicePriceData.currency} onValueChange={(v) => setNewServicePriceData({...newServicePriceData, currency: v})}>
                                      <SelectTrigger><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        {["EUR", "USD", "CZK", "HUF", "RON", "CHF"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label>{t.konfigurator.accountingCodeLabel}</Label>
                                    <Input value={newServicePriceData.accountingCode} onChange={(e) => setNewServicePriceData({...newServicePriceData, accountingCode: e.target.value})} />
                                  </div>
                                </div>
                              </div>
                              <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                                <Button size="sm" variant="outline" onClick={() => setIsAddingServicePrice(false)}>{t.common.cancel}</Button>
                                <Button size="sm" onClick={() => createServicePriceMutation.mutate({ 
                                  ...newServicePriceData, 
                                  instanceId: selectedServiceId!, 
                                  instanceType: "service",
                                  fromDate: componentsToISOString(newServicePriceData.fromDay, newServicePriceData.fromMonth, newServicePriceData.fromYear),
                                  toDate: componentsToISOString(newServicePriceData.toDay, newServicePriceData.toMonth, newServicePriceData.toYear),
                                })}>{t.common.save}</Button>
                              </div>
                            </Card>
                          )}
                          {servicePrices.map((price: any) => (
                            <div key={price.id} className="flex items-center justify-between p-2 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{price.name}</span>
                                <Badge variant="outline">{price.price} {price.currency}</Badge>
                                {price.accountingCode && <span className="text-xs text-muted-foreground">Účt: {price.accountingCode}</span>}
                                {price.analyticalAccount && <span className="text-xs text-muted-foreground">Anal: {price.analyticalAccount}</span>}
                                {(price.fromDate || price.toDate) && (
                                  <span className="text-xs text-muted-foreground">
                                    {price.fromDate ? new Date(price.fromDate).toLocaleDateString() : "..."} - {price.toDate ? new Date(price.toDate).toLocaleDateString() : "..."}
                                  </span>
                                )}
                                <Badge variant={price.isActive ? "default" : "secondary"}>{price.isActive ? t.konfigurator.activeLabel : t.konfigurator.inactiveLabel}</Badge>
                              </div>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" onClick={() => { 
                                  setEditingServicePriceId(price.id);
                                  const fromParts = parseDateToComponents(price.fromDate);
                                  const toParts = parseDateToComponents(price.toDate);
                                  setEditingServicePriceData({
                                    ...price,
                                    fromDay: fromParts.day,
                                    fromMonth: fromParts.month,
                                    fromYear: fromParts.year,
                                    toDay: toParts.day,
                                    toMonth: toParts.month,
                                    toYear: toParts.year,
                                  }); 
                                }}><Pencil className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => deleteServicePriceMutation.mutate(price.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              </div>
                            </div>
                          ))}
                          {editingServicePriceId && editingServicePriceData && (
                            <Card className="p-4 border-primary">
                              <div className="space-y-4">
                                <div className="grid grid-cols-3 gap-3">
                                  <div className="col-span-2">
                                    <Label>{t.konfigurator.priceName}</Label>
                                    <Input value={editingServicePriceData.name} onChange={(e) => setEditingServicePriceData({...editingServicePriceData, name: e.target.value})} />
                                  </div>
                                  <div className="flex items-center gap-2 pt-6">
                                    <Switch checked={editingServicePriceData.isActive} onCheckedChange={(v) => setEditingServicePriceData({...editingServicePriceData, isActive: v})} />
                                    <Label>{t.konfigurator.activeLabel}</Label>
                                  </div>
                                </div>
                                
                                <Separator />
                                <p className="text-sm font-medium text-muted-foreground">{t.konfigurator.amountAndAccounting}</p>
                                <div className="grid grid-cols-4 gap-3">
                                  <div>
                                    <Label>{t.konfigurator.priceLabel}</Label>
                                    <Input type="number" step="0.01" value={editingServicePriceData.price} onChange={(e) => setEditingServicePriceData({...editingServicePriceData, price: e.target.value})} />
                                  </div>
                                  <div>
                                    <Label>{t.konfigurator.currencyLabel}</Label>
                                    <Select value={editingServicePriceData.currency} onValueChange={(v) => setEditingServicePriceData({...editingServicePriceData, currency: v})}>
                                      <SelectTrigger><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        {["EUR", "USD", "CZK", "HUF", "RON", "CHF"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label>{t.konfigurator.accountingCodeLabel}</Label>
                                    <Input value={editingServicePriceData.accountingCode || ""} onChange={(e) => setEditingServicePriceData({...editingServicePriceData, accountingCode: e.target.value})} />
                                  </div>
                                  <div>
                                    <Label>{t.konfigurator.analyticalAccountLabel}</Label>
                                    <Input value={editingServicePriceData.analyticalAccount || ""} onChange={(e) => setEditingServicePriceData({...editingServicePriceData, analyticalAccount: e.target.value})} />
                                  </div>
                                </div>
                                
                                <Separator />
                                <p className="text-sm font-medium text-muted-foreground">{t.konfigurator.validity}</p>
                                <div className="grid grid-cols-2 gap-3">
                                  <DateFields
                                    label={t.konfigurator.validFromLabel}
                                    dayValue={editingServicePriceData.fromDay || 0}
                                    monthValue={editingServicePriceData.fromMonth || 0}
                                    yearValue={editingServicePriceData.fromYear || 0}
                                    onDayChange={(v) => setEditingServicePriceData({...editingServicePriceData, fromDay: v})}
                                    onMonthChange={(v) => setEditingServicePriceData({...editingServicePriceData, fromMonth: v})}
                                    onYearChange={(v) => setEditingServicePriceData({...editingServicePriceData, fromYear: v})}
                                    testIdPrefix="edit-service-price-from"
                                  />
                                  <DateFields
                                    label={t.konfigurator.validToLabel}
                                    dayValue={editingServicePriceData.toDay || 0}
                                    monthValue={editingServicePriceData.toMonth || 0}
                                    yearValue={editingServicePriceData.toYear || 0}
                                    onDayChange={(v) => setEditingServicePriceData({...editingServicePriceData, toDay: v})}
                                    onMonthChange={(v) => setEditingServicePriceData({...editingServicePriceData, toMonth: v})}
                                    onYearChange={(v) => setEditingServicePriceData({...editingServicePriceData, toYear: v})}
                                    testIdPrefix="edit-service-price-to"
                                  />
                                </div>
                                
                                <div>
                                  <Label>{t.konfigurator.descriptionLabel}</Label>
                                  <Textarea value={editingServicePriceData.description || ""} onChange={(e) => setEditingServicePriceData({...editingServicePriceData, description: e.target.value})} className="min-h-[60px]" />
                                </div>
                              </div>
                              <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                                <Button size="sm" variant="outline" onClick={() => { setEditingServicePriceId(null); setEditingServicePriceData(null); }}>{t.common.cancel}</Button>
                                <Button size="sm" onClick={() => {
                                  const { id, instanceId, createdAt, fromDay, fromMonth, fromYear, toDay, toMonth, toYear, ...updateData } = editingServicePriceData;
                                  updateServicePriceMutation.mutate({ 
                                    id: editingServicePriceId, 
                                    data: {
                                      ...updateData,
                                      fromDate: componentsToISOString(fromDay, fromMonth, fromYear),
                                      toDate: componentsToISOString(toDay, toMonth, toYear),
                                    }
                                  });
                                }}>{t.common.save}</Button>
                              </div>
                            </Card>
                          )}
                          {servicePrices.length === 0 && !isAddingServicePrice && !editingServicePriceId && (
                            <p className="text-sm text-muted-foreground text-center py-4">Žiadne ceny</p>
                          )}
                        </TabsContent>

                        <TabsContent value="payments" className="space-y-3 mt-3">
                          <div className="flex justify-end">
                            <Button size="sm" onClick={() => setIsAddingServicePayment(true)}><Plus className="h-4 w-4 mr-1" />Pridať platbu</Button>
                          </div>
                          {isAddingServicePayment && (
                            <Card className="p-4">
                              <div className="space-y-4">
                                <div className="grid grid-cols-3 gap-3">
                                  <div className="col-span-2">
                                    <Label>Názov</Label>
                                    <Input value={newServicePaymentData.name} onChange={(e) => setNewServicePaymentData({...newServicePaymentData, name: e.target.value})} placeholder="Napr. Ročná platba" />
                                  </div>
                                  <div className="flex items-center gap-2 pt-6">
                                    <Switch checked={newServicePaymentData.isActive} onCheckedChange={(v) => setNewServicePaymentData({...newServicePaymentData, isActive: v})} />
                                    <Label>{t.konfigurator.activeLabel}</Label>
                                  </div>
                                </div>
                                
                                <Separator />
                                <p className="text-sm font-medium text-muted-foreground">Fakturácia a účtovníctvo</p>
                                <div className="grid grid-cols-3 gap-3">
                                  <div>
                                    <Label>Typ platby</Label>
                                    <Input value={newServicePaymentData.type} onChange={(e) => setNewServicePaymentData({...newServicePaymentData, type: e.target.value})} placeholder="Napr. single, installment" />
                                  </div>
                                  <div>
                                    <Label>Text na faktúre</Label>
                                    <Input value={newServicePaymentData.invoiceItemText} onChange={(e) => setNewServicePaymentData({...newServicePaymentData, invoiceItemText: e.target.value})} />
                                  </div>
                                  <div>
                                    <Label>Poplatok za typ platby</Label>
                                    <Input type="number" step="0.01" value={newServicePaymentData.paymentTypeFee} onChange={(e) => setNewServicePaymentData({...newServicePaymentData, paymentTypeFee: e.target.value})} />
                                  </div>
                                  <div>
                                    <Label>{t.konfigurator.accountingCodeLabel}</Label>
                                    <Input value={newServicePaymentData.accountingCode} onChange={(e) => setNewServicePaymentData({...newServicePaymentData, accountingCode: e.target.value})} />
                                  </div>
                                  <div>
                                    <Label>{t.konfigurator.analyticalAccountLabel}</Label>
                                    <Input value={newServicePaymentData.analyticalAccount} onChange={(e) => setNewServicePaymentData({...newServicePaymentData, analyticalAccount: e.target.value})} />
                                  </div>
                                </div>
                                
                                <Separator />
                                <p className="text-sm font-medium text-muted-foreground">{t.konfigurator.validity}</p>
                                <div className="grid grid-cols-2 gap-3">
                                  <DateFields
                                    label={t.konfigurator.validFromLabel}
                                    dayValue={newServicePaymentData.fromDay}
                                    monthValue={newServicePaymentData.fromMonth}
                                    yearValue={newServicePaymentData.fromYear}
                                    onDayChange={(v) => setNewServicePaymentData({...newServicePaymentData, fromDay: v})}
                                    onMonthChange={(v) => setNewServicePaymentData({...newServicePaymentData, fromMonth: v})}
                                    onYearChange={(v) => setNewServicePaymentData({...newServicePaymentData, fromYear: v})}
                                    testIdPrefix="new-service-payment-from"
                                  />
                                  <DateFields
                                    label={t.konfigurator.validToLabel}
                                    dayValue={newServicePaymentData.toDay}
                                    monthValue={newServicePaymentData.toMonth}
                                    yearValue={newServicePaymentData.toYear}
                                    onDayChange={(v) => setNewServicePaymentData({...newServicePaymentData, toDay: v})}
                                    onMonthChange={(v) => setNewServicePaymentData({...newServicePaymentData, toMonth: v})}
                                    onYearChange={(v) => setNewServicePaymentData({...newServicePaymentData, toYear: v})}
                                    testIdPrefix="new-service-payment-to"
                                  />
                                </div>
                                
                                <div>
                                  <Label>{t.konfigurator.descriptionLabel}</Label>
                                  <Textarea value={newServicePaymentData.description} onChange={(e) => setNewServicePaymentData({...newServicePaymentData, description: e.target.value})} className="min-h-[60px]" />
                                </div>
                                
                                {/* Multi-payment disabled for storage services - only single payment allowed */}
                                {false && newServicePaymentData.isMultiPayment && (
                                  <div className="space-y-4 p-4 bg-muted/50 rounded-md">
                                    <div className="grid grid-cols-4 gap-3">
                                      <div>
                                        <Label>Frekvencia</Label>
                                        <Select value={newServicePaymentData.frequency} onValueChange={(v) => setNewServicePaymentData({...newServicePaymentData, frequency: v})}>
                                          <SelectTrigger><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="monthly">Mesačne</SelectItem>
                                            <SelectItem value="quarterly">Štvrťročne</SelectItem>
                                            <SelectItem value="semi_annually">Polročne</SelectItem>
                                            <SelectItem value="annually">Ročne</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div>
                                        <Label>Počet splátok</Label>
                                        <Input 
                                          type="number" 
                                          min="1" 
                                          max="12" 
                                          value={newServicePaymentData.installmentCount} 
                                          onChange={(e) => setNewServicePaymentData({...newServicePaymentData, installmentCount: parseInt(e.target.value) || 1})} 
                                        />
                                      </div>
                                      <div>
                                        <Label>Typ výpočtu</Label>
                                        <Select value={newServicePaymentData.calculationMode} onValueChange={(v) => setNewServicePaymentData({...newServicePaymentData, calculationMode: v})}>
                                          <SelectTrigger><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="fixed">Fixná suma</SelectItem>
                                            <SelectItem value="percentage">Percentuálna</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div>
                                        <Label>Základná cena</Label>
                                        <Select value={newServicePaymentData.basePriceId} onValueChange={(v) => setNewServicePaymentData({...newServicePaymentData, basePriceId: v})}>
                                          <SelectTrigger><SelectValue placeholder="Vyberte cenu" /></SelectTrigger>
                                          <SelectContent>
                                            {servicePrices.map((price: any) => (
                                              <SelectItem key={price.id} value={price.id}>{price.name} - {price.price} {price.currency}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                    
                                    <div className="flex justify-end">
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        disabled={!newServicePaymentData.basePriceId}
                                        onClick={() => {
                                          const selectedPrice = servicePrices.find((p: any) => p.id === newServicePaymentData.basePriceId);
                                          if (selectedPrice) {
                                            const installments = generateInstallments(
                                              newServicePaymentData.installmentCount,
                                              parseFloat(selectedPrice.price),
                                              newServicePaymentData.calculationMode as "fixed" | "percentage",
                                              newServicePaymentData.frequency
                                            );
                                            setNewServicePaymentInstallments(installments);
                                          }
                                        }}
                                      >
                                        Generovať splátky
                                      </Button>
                                    </div>
                                    
                                    {newServicePaymentInstallments.length > 0 && (
                                      <div className="border rounded-md overflow-hidden">
                                        <table className="w-full text-sm">
                                          <thead className="bg-muted">
                                            <tr>
                                              <th className="p-2 text-left">#</th>
                                              <th className="p-2 text-left">Názov</th>
                                              <th className="p-2 text-left">Typ</th>
                                              {newServicePaymentData.calculationMode === "percentage" && <th className="p-2 text-right">%</th>}
                                              <th className="p-2 text-right">Suma</th>
                                              <th className="p-2 text-right">Splatnosť (mesiace)</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {newServicePaymentInstallments.map((inst, idx) => (
                                              <tr key={idx} className="border-t">
                                                <td className="p-2">{inst.installmentNumber}</td>
                                                <td className="p-2">
                                                  <Input 
                                                    value={inst.label} 
                                                    onChange={(e) => {
                                                      const updated = [...newServicePaymentInstallments];
                                                      updated[idx].label = e.target.value;
                                                      setNewServicePaymentInstallments(updated);
                                                    }}
                                                    className="h-8"
                                                  />
                                                </td>
                                                <td className="p-2">
                                                  <Select 
                                                    value={inst.calculationType} 
                                                    onValueChange={(v) => {
                                                      const updated = [...newServicePaymentInstallments];
                                                      updated[idx].calculationType = v;
                                                      setNewServicePaymentInstallments(updated);
                                                    }}
                                                  >
                                                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                      <SelectItem value="fixed">Fixná</SelectItem>
                                                      <SelectItem value="percentage">%</SelectItem>
                                                    </SelectContent>
                                                  </Select>
                                                </td>
                                                {newServicePaymentData.calculationMode === "percentage" && (
                                                  <td className="p-2 text-right">
                                                    <Input 
                                                      type="number" 
                                                      step="0.01"
                                                      value={inst.percentage || ""} 
                                                      onChange={(e) => {
                                                        const updated = [...newServicePaymentInstallments];
                                                        updated[idx].percentage = e.target.value;
                                                        const selectedPrice = servicePrices.find((p: any) => p.id === newServicePaymentData.basePriceId);
                                                        if (selectedPrice) {
                                                          updated[idx].amount = ((parseFloat(selectedPrice.price) * parseFloat(e.target.value || "0")) / 100).toFixed(2);
                                                        }
                                                        setNewServicePaymentInstallments(updated);
                                                      }}
                                                      className="h-8 w-20 text-right"
                                                    />
                                                  </td>
                                                )}
                                                <td className="p-2 text-right">
                                                  <Input 
                                                    type="number" 
                                                    step="0.01"
                                                    value={inst.amount} 
                                                    onChange={(e) => {
                                                      const updated = [...newServicePaymentInstallments];
                                                      updated[idx].amount = e.target.value;
                                                      setNewServicePaymentInstallments(updated);
                                                    }}
                                                    className="h-8 w-24 text-right"
                                                  />
                                                </td>
                                                <td className="p-2 text-right">
                                                  <Input 
                                                    type="number" 
                                                    value={inst.dueOffsetMonths} 
                                                    onChange={(e) => {
                                                      const updated = [...newServicePaymentInstallments];
                                                      updated[idx].dueOffsetMonths = parseInt(e.target.value) || 0;
                                                      setNewServicePaymentInstallments(updated);
                                                    }}
                                                    className="h-8 w-20 text-right"
                                                  />
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                          <tfoot className="bg-muted">
                                            <tr>
                                              <td colSpan={newServicePaymentData.calculationMode === "percentage" ? 4 : 3} className="p-2 text-right font-medium">Celkom:</td>
                                              <td className="p-2 text-right font-medium">
                                                {newServicePaymentInstallments.reduce((sum, inst) => sum + parseFloat(inst.amount || "0"), 0).toFixed(2)}
                                              </td>
                                              <td></td>
                                            </tr>
                                          </tfoot>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                                <Button size="sm" variant="outline" onClick={() => { setIsAddingServicePayment(false); setNewServicePaymentInstallments([]); }}>{t.common.cancel}</Button>
                                <Button size="sm" onClick={() => createServicePaymentMutation.mutate({ 
                                  ...newServicePaymentData, 
                                  instanceId: selectedServiceId!, 
                                  instanceType: "service",
                                  fromDate: componentsToISOString(newServicePaymentData.fromDay, newServicePaymentData.fromMonth, newServicePaymentData.fromYear),
                                  toDate: componentsToISOString(newServicePaymentData.toDay, newServicePaymentData.toMonth, newServicePaymentData.toYear),
                                })}>{t.common.save}</Button>
                              </div>
                            </Card>
                          )}
                          {servicePayments.map((payment: any) => (
                            <div key={payment.id} className="flex items-center justify-between p-2 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{payment.name}</span>
                                {payment.type && <Badge variant="outline">{payment.type}</Badge>}
                                {payment.isMultiPayment && <Badge variant="outline">{payment.installmentCount || payment.installments || 1}x {payment.frequency === "monthly" ? "mesačne" : payment.frequency === "quarterly" ? "štvrťročne" : payment.frequency === "semi_annually" ? "polročne" : payment.frequency === "annually" ? "ročne" : ""}</Badge>}
                                {(payment.fromDate || payment.toDate) && (
                                  <span className="text-xs text-muted-foreground">
                                    {payment.fromDate ? new Date(payment.fromDate).toLocaleDateString() : "..."} - {payment.toDate ? new Date(payment.toDate).toLocaleDateString() : "..."}
                                  </span>
                                )}
                                <Badge variant={payment.isActive ? "default" : "secondary"}>{payment.isActive ? t.konfigurator.activeLabel : t.konfigurator.inactiveLabel}</Badge>
                              </div>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" onClick={() => { 
                                  setEditingServicePaymentId(payment.id);
                                  const fromParts = parseDateToComponents(payment.fromDate);
                                  const toParts = parseDateToComponents(payment.toDate);
                                  setEditingServicePaymentData({
                                    ...payment,
                                    fromDay: fromParts.day,
                                    fromMonth: fromParts.month,
                                    fromYear: fromParts.year,
                                    toDay: toParts.day,
                                    toMonth: toParts.month,
                                    toYear: toParts.year,
                                  }); 
                                }}><Pencil className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => deleteServicePaymentMutation.mutate(payment.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              </div>
                            </div>
                          ))}
                          {editingServicePaymentId && editingServicePaymentData && (
                            <Card className="p-4 border-primary">
                              <div className="space-y-4">
                                <div className="grid grid-cols-3 gap-3">
                                  <div className="col-span-2">
                                    <Label>Názov</Label>
                                    <Input value={editingServicePaymentData.name} onChange={(e) => setEditingServicePaymentData({...editingServicePaymentData, name: e.target.value})} />
                                  </div>
                                  <div className="flex items-center gap-2 pt-6">
                                    <Switch checked={editingServicePaymentData.isActive} onCheckedChange={(v) => setEditingServicePaymentData({...editingServicePaymentData, isActive: v})} />
                                    <Label>{t.konfigurator.activeLabel}</Label>
                                  </div>
                                </div>
                                
                                <Separator />
                                <p className="text-sm font-medium text-muted-foreground">Fakturácia a účtovníctvo</p>
                                <div className="grid grid-cols-3 gap-3">
                                  <div>
                                    <Label>Typ platby</Label>
                                    <Input value={editingServicePaymentData.type || ""} onChange={(e) => setEditingServicePaymentData({...editingServicePaymentData, type: e.target.value})} placeholder="Napr. single, installment" />
                                  </div>
                                  <div>
                                    <Label>Text na faktúre</Label>
                                    <Input value={editingServicePaymentData.invoiceItemText || ""} onChange={(e) => setEditingServicePaymentData({...editingServicePaymentData, invoiceItemText: e.target.value})} />
                                  </div>
                                  <div>
                                    <Label>Poplatok za typ platby</Label>
                                    <Input type="number" step="0.01" value={editingServicePaymentData.paymentTypeFee || ""} onChange={(e) => setEditingServicePaymentData({...editingServicePaymentData, paymentTypeFee: e.target.value})} />
                                  </div>
                                  <div>
                                    <Label>{t.konfigurator.accountingCodeLabel}</Label>
                                    <Input value={editingServicePaymentData.accountingCode || ""} onChange={(e) => setEditingServicePaymentData({...editingServicePaymentData, accountingCode: e.target.value})} />
                                  </div>
                                  <div>
                                    <Label>{t.konfigurator.analyticalAccountLabel}</Label>
                                    <Input value={editingServicePaymentData.analyticalAccount || ""} onChange={(e) => setEditingServicePaymentData({...editingServicePaymentData, analyticalAccount: e.target.value})} />
                                  </div>
                                </div>
                                
                                <Separator />
                                <p className="text-sm font-medium text-muted-foreground">{t.konfigurator.validity}</p>
                                <div className="grid grid-cols-2 gap-3">
                                  <DateFields
                                    label={t.konfigurator.validFromLabel}
                                    dayValue={editingServicePaymentData.fromDay || 0}
                                    monthValue={editingServicePaymentData.fromMonth || 0}
                                    yearValue={editingServicePaymentData.fromYear || 0}
                                    onDayChange={(v) => setEditingServicePaymentData({...editingServicePaymentData, fromDay: v})}
                                    onMonthChange={(v) => setEditingServicePaymentData({...editingServicePaymentData, fromMonth: v})}
                                    onYearChange={(v) => setEditingServicePaymentData({...editingServicePaymentData, fromYear: v})}
                                    testIdPrefix="edit-service-payment-from"
                                  />
                                  <DateFields
                                    label={t.konfigurator.validToLabel}
                                    dayValue={editingServicePaymentData.toDay || 0}
                                    monthValue={editingServicePaymentData.toMonth || 0}
                                    yearValue={editingServicePaymentData.toYear || 0}
                                    onDayChange={(v) => setEditingServicePaymentData({...editingServicePaymentData, toDay: v})}
                                    onMonthChange={(v) => setEditingServicePaymentData({...editingServicePaymentData, toMonth: v})}
                                    onYearChange={(v) => setEditingServicePaymentData({...editingServicePaymentData, toYear: v})}
                                    testIdPrefix="edit-service-payment-to"
                                  />
                                </div>
                                
                                <div>
                                  <Label>{t.konfigurator.descriptionLabel}</Label>
                                  <Textarea value={editingServicePaymentData.description || ""} onChange={(e) => setEditingServicePaymentData({...editingServicePaymentData, description: e.target.value})} className="min-h-[60px]" />
                                </div>
                                
                                {/* Multi-payment disabled for storage services - only single payment allowed */}
                                {false && editingServicePaymentData.isMultiPayment && (
                                  <div className="space-y-4 p-4 bg-muted/50 rounded-md">
                                    <div className="grid grid-cols-4 gap-3">
                                      <div>
                                        <Label>Frekvencia</Label>
                                        <Select value={editingServicePaymentData.frequency || "monthly"} onValueChange={(v) => setEditingServicePaymentData({...editingServicePaymentData, frequency: v})}>
                                          <SelectTrigger><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="monthly">Mesačne</SelectItem>
                                            <SelectItem value="quarterly">Štvrťročne</SelectItem>
                                            <SelectItem value="semi_annually">Polročne</SelectItem>
                                            <SelectItem value="annually">Ročne</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div>
                                        <Label>Počet splátok</Label>
                                        <Input 
                                          type="number" 
                                          min="1" 
                                          max="12" 
                                          value={editingServicePaymentData.installmentCount || 1} 
                                          onChange={(e) => setEditingServicePaymentData({...editingServicePaymentData, installmentCount: parseInt(e.target.value) || 1})} 
                                        />
                                      </div>
                                      <div>
                                        <Label>Typ výpočtu</Label>
                                        <Select value={editingServicePaymentData.calculationMode || "fixed"} onValueChange={(v) => setEditingServicePaymentData({...editingServicePaymentData, calculationMode: v})}>
                                          <SelectTrigger><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="fixed">Fixná suma</SelectItem>
                                            <SelectItem value="percentage">Percentuálna</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div>
                                        <Label>Základná cena</Label>
                                        <Select value={editingServicePaymentData.basePriceId || ""} onValueChange={(v) => setEditingServicePaymentData({...editingServicePaymentData, basePriceId: v})}>
                                          <SelectTrigger><SelectValue placeholder="Vyberte cenu" /></SelectTrigger>
                                          <SelectContent>
                                            {servicePrices.map((price: any) => (
                                              <SelectItem key={price.id} value={price.id}>{price.name} - {price.price} {price.currency}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                    
                                    <div className="flex justify-end">
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        disabled={!editingServicePaymentData.basePriceId}
                                        onClick={() => {
                                          const selectedPrice = servicePrices.find((p: any) => p.id === editingServicePaymentData.basePriceId);
                                          if (selectedPrice) {
                                            const installments = generateInstallments(
                                              editingServicePaymentData.installmentCount || 1,
                                              parseFloat(selectedPrice.price),
                                              (editingServicePaymentData.calculationMode || "fixed") as "fixed" | "percentage",
                                              editingServicePaymentData.frequency || "monthly"
                                            );
                                            setEditingServicePaymentInstallments(installments);
                                          }
                                        }}
                                      >
                                        Generovať splátky
                                      </Button>
                                    </div>
                                    
                                    {editingServicePaymentInstallments.length > 0 && (
                                      <div className="border rounded-md overflow-hidden">
                                        <table className="w-full text-sm">
                                          <thead className="bg-muted">
                                            <tr>
                                              <th className="p-2 text-left">#</th>
                                              <th className="p-2 text-left">Názov</th>
                                              <th className="p-2 text-left">Typ</th>
                                              {editingServicePaymentData.calculationMode === "percentage" && <th className="p-2 text-right">%</th>}
                                              <th className="p-2 text-right">Suma</th>
                                              <th className="p-2 text-right">Splatnosť (mesiace)</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {editingServicePaymentInstallments.map((inst, idx) => (
                                              <tr key={idx} className="border-t">
                                                <td className="p-2">{inst.installmentNumber}</td>
                                                <td className="p-2">
                                                  <Input 
                                                    value={inst.label} 
                                                    onChange={(e) => {
                                                      const updated = [...editingServicePaymentInstallments];
                                                      updated[idx].label = e.target.value;
                                                      setEditingServicePaymentInstallments(updated);
                                                    }}
                                                    className="h-8"
                                                  />
                                                </td>
                                                <td className="p-2">
                                                  <Select 
                                                    value={inst.calculationType} 
                                                    onValueChange={(v) => {
                                                      const updated = [...editingServicePaymentInstallments];
                                                      updated[idx].calculationType = v;
                                                      setEditingServicePaymentInstallments(updated);
                                                    }}
                                                  >
                                                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                      <SelectItem value="fixed">Fixná</SelectItem>
                                                      <SelectItem value="percentage">%</SelectItem>
                                                    </SelectContent>
                                                  </Select>
                                                </td>
                                                {editingServicePaymentData.calculationMode === "percentage" && (
                                                  <td className="p-2 text-right">
                                                    <Input 
                                                      type="number" 
                                                      step="0.01"
                                                      value={inst.percentage || ""} 
                                                      onChange={(e) => {
                                                        const updated = [...editingServicePaymentInstallments];
                                                        updated[idx].percentage = e.target.value;
                                                        const selectedPrice = servicePrices.find((p: any) => p.id === editingServicePaymentData.basePriceId);
                                                        if (selectedPrice) {
                                                          updated[idx].amount = ((parseFloat(selectedPrice.price) * parseFloat(e.target.value || "0")) / 100).toFixed(2);
                                                        }
                                                        setEditingServicePaymentInstallments(updated);
                                                      }}
                                                      className="h-8 w-20 text-right"
                                                    />
                                                  </td>
                                                )}
                                                <td className="p-2 text-right">
                                                  <Input 
                                                    type="number" 
                                                    step="0.01"
                                                    value={inst.amount} 
                                                    onChange={(e) => {
                                                      const updated = [...editingServicePaymentInstallments];
                                                      updated[idx].amount = e.target.value;
                                                      setEditingServicePaymentInstallments(updated);
                                                    }}
                                                    className="h-8 w-24 text-right"
                                                  />
                                                </td>
                                                <td className="p-2 text-right">
                                                  <Input 
                                                    type="number" 
                                                    value={inst.dueOffsetMonths} 
                                                    onChange={(e) => {
                                                      const updated = [...editingServicePaymentInstallments];
                                                      updated[idx].dueOffsetMonths = parseInt(e.target.value) || 0;
                                                      setEditingServicePaymentInstallments(updated);
                                                    }}
                                                    className="h-8 w-20 text-right"
                                                  />
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                          <tfoot className="bg-muted">
                                            <tr>
                                              <td colSpan={editingServicePaymentData.calculationMode === "percentage" ? 4 : 3} className="p-2 text-right font-medium">Celkom:</td>
                                              <td className="p-2 text-right font-medium">
                                                {editingServicePaymentInstallments.reduce((sum, inst) => sum + parseFloat(inst.amount || "0"), 0).toFixed(2)}
                                              </td>
                                              <td></td>
                                            </tr>
                                          </tfoot>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                                <Button size="sm" variant="outline" onClick={() => { setEditingServicePaymentId(null); setEditingServicePaymentData(null); setEditingServicePaymentInstallments([]); }}>{t.common.cancel}</Button>
                                <Button size="sm" onClick={() => {
                                  const { id, instanceId, createdAt, fromDay, fromMonth, fromYear, toDay, toMonth, toYear, ...updateData } = editingServicePaymentData;
                                  updateServicePaymentMutation.mutate({ 
                                    id: editingServicePaymentId, 
                                    data: {
                                      ...updateData,
                                      fromDate: componentsToISOString(fromDay, fromMonth, fromYear),
                                      toDate: componentsToISOString(toDay, toMonth, toYear),
                                    }
                                  });
                                }}>{t.common.save}</Button>
                              </div>
                            </Card>
                          )}
                          {servicePayments.length === 0 && !isAddingServicePayment && !editingServicePaymentId && (
                            <p className="text-sm text-muted-foreground text-center py-4">Žiadne platobné možnosti</p>
                          )}
                        </TabsContent>

                        <TabsContent value="discounts" className="space-y-3 mt-3">
                          <div className="flex justify-end">
                            <Button size="sm" onClick={() => setIsAddingServiceDiscount(true)}><Plus className="h-4 w-4 mr-1" />Pridať zľavu</Button>
                          </div>
                          {isAddingServiceDiscount && (
                            <Card className="p-4">
                              <div className="space-y-4">
                                <div className="grid grid-cols-3 gap-3">
                                  <div className="col-span-2">
                                    <Label>Názov zľavy</Label>
                                    <Input value={newServiceDiscountData.name} onChange={(e) => setNewServiceDiscountData({...newServiceDiscountData, name: e.target.value})} placeholder="Napr. Vernostná zľava" />
                                  </div>
                                  <div className="flex items-center gap-2 pt-6">
                                    <Switch checked={newServiceDiscountData.isActive} onCheckedChange={(v) => setNewServiceDiscountData({...newServiceDiscountData, isActive: v})} />
                                    <Label>{t.konfigurator.activeLabel}</Label>
                                  </div>
                                </div>
                                
                                <Separator />
                                <p className="text-sm font-medium text-muted-foreground">Typ a hodnota zľavy</p>
                                <div className="grid grid-cols-3 gap-3">
                                  <div>
                                    <Label>Typ zľavy</Label>
                                    <Input value={newServiceDiscountData.type || ""} onChange={(e) => setNewServiceDiscountData({...newServiceDiscountData, type: e.target.value})} placeholder="Napr. loyalty, promo" />
                                  </div>
                                  <div className="flex items-center gap-2 pt-6">
                                    <Switch checked={newServiceDiscountData.isPercentage} onCheckedChange={(v) => setNewServiceDiscountData({...newServiceDiscountData, isPercentage: v, isFixed: !v})} />
                                    <Label>Percentuálna</Label>
                                  </div>
                                  <div>
                                    <Label>{newServiceDiscountData.isPercentage ? t.konfigurator.percentageLabel : t.konfigurator.fixedValueLabel}</Label>
                                    <Input 
                                      type="number" 
                                      step="0.01" 
                                      value={newServiceDiscountData.isPercentage ? newServiceDiscountData.percentageValue : newServiceDiscountData.fixedValue} 
                                      onChange={(e) => setNewServiceDiscountData({
                                        ...newServiceDiscountData, 
                                        [newServiceDiscountData.isPercentage ? "percentageValue" : "fixedValue"]: e.target.value
                                      })} 
                                    />
                                  </div>
                                </div>
                                
                                <Separator />
                                <p className="text-sm font-medium text-muted-foreground">Fakturácia</p>
                                <div className="grid grid-cols-3 gap-3">
                                  <div>
                                    <Label>Text na faktúre</Label>
                                    <Input value={newServiceDiscountData.invoiceItemText || ""} onChange={(e) => setNewServiceDiscountData({...newServiceDiscountData, invoiceItemText: e.target.value})} />
                                  </div>
                                  <div>
                                    <Label>{t.konfigurator.accountingCodeLabel}</Label>
                                    <Input value={newServiceDiscountData.accountingCode || ""} onChange={(e) => setNewServiceDiscountData({...newServiceDiscountData, accountingCode: e.target.value})} />
                                  </div>
                                  <div>
                                    <Label>{t.konfigurator.analyticalAccountLabel}</Label>
                                    <Input value={newServiceDiscountData.analyticalAccount || ""} onChange={(e) => setNewServiceDiscountData({...newServiceDiscountData, analyticalAccount: e.target.value})} />
                                  </div>
                                </div>
                                
                                <Separator />
                                <p className="text-sm font-medium text-muted-foreground">{t.konfigurator.validity}</p>
                                <div className="grid grid-cols-2 gap-3">
                                  <DateFields
                                    label={t.konfigurator.validFromLabel}
                                    dayValue={newServiceDiscountData.fromDay}
                                    monthValue={newServiceDiscountData.fromMonth}
                                    yearValue={newServiceDiscountData.fromYear}
                                    onDayChange={(v) => setNewServiceDiscountData({...newServiceDiscountData, fromDay: v})}
                                    onMonthChange={(v) => setNewServiceDiscountData({...newServiceDiscountData, fromMonth: v})}
                                    onYearChange={(v) => setNewServiceDiscountData({...newServiceDiscountData, fromYear: v})}
                                    testIdPrefix="new-service-discount-from"
                                  />
                                  <DateFields
                                    label={t.konfigurator.validToLabel}
                                    dayValue={newServiceDiscountData.toDay}
                                    monthValue={newServiceDiscountData.toMonth}
                                    yearValue={newServiceDiscountData.toYear}
                                    onDayChange={(v) => setNewServiceDiscountData({...newServiceDiscountData, toDay: v})}
                                    onMonthChange={(v) => setNewServiceDiscountData({...newServiceDiscountData, toMonth: v})}
                                    onYearChange={(v) => setNewServiceDiscountData({...newServiceDiscountData, toYear: v})}
                                    testIdPrefix="new-service-discount-to"
                                  />
                                </div>
                              </div>
                              <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                                <Button size="sm" variant="outline" onClick={() => setIsAddingServiceDiscount(false)}>{t.common.cancel}</Button>
                                <Button size="sm" onClick={() => createServiceDiscountMutation.mutate({ 
                                  ...newServiceDiscountData, 
                                  instanceId: selectedServiceId!, 
                                  instanceType: "service",
                                  fromDate: componentsToISOString(newServiceDiscountData.fromDay, newServiceDiscountData.fromMonth, newServiceDiscountData.fromYear),
                                  toDate: componentsToISOString(newServiceDiscountData.toDay, newServiceDiscountData.toMonth, newServiceDiscountData.toYear),
                                })}>{t.common.save}</Button>
                              </div>
                            </Card>
                          )}
                          {serviceDiscounts.map((discount: any) => (
                            <div key={discount.id} className="flex items-center justify-between p-2 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{discount.name}</span>
                                {discount.type && <Badge variant="outline">{discount.type}</Badge>}
                                {discount.isPercentage && <span className="text-sm">{discount.percentageValue}%</span>}
                                {discount.isFixed && <span className="text-sm">{discount.fixedValue} €</span>}
                                {(discount.fromDate || discount.toDate) && (
                                  <span className="text-xs text-muted-foreground">
                                    {discount.fromDate ? new Date(discount.fromDate).toLocaleDateString() : "..."} - {discount.toDate ? new Date(discount.toDate).toLocaleDateString() : "..."}
                                  </span>
                                )}
                                <Badge variant={discount.isActive ? "default" : "secondary"}>{discount.isActive ? t.konfigurator.activeLabel : t.konfigurator.inactiveLabel}</Badge>
                              </div>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" onClick={() => { 
                                  setEditingServiceDiscountId(discount.id);
                                  const fromParts = parseDateToComponents(discount.fromDate);
                                  const toParts = parseDateToComponents(discount.toDate);
                                  setEditingServiceDiscountData({
                                    ...discount,
                                    fromDay: fromParts.day,
                                    fromMonth: fromParts.month,
                                    fromYear: fromParts.year,
                                    toDay: toParts.day,
                                    toMonth: toParts.month,
                                    toYear: toParts.year,
                                  }); 
                                }}><Pencil className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => deleteServiceDiscountMutation.mutate(discount.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              </div>
                            </div>
                          ))}
                          {editingServiceDiscountId && editingServiceDiscountData && (
                            <Card className="p-4 border-primary">
                              <div className="space-y-4">
                                <div className="grid grid-cols-3 gap-3">
                                  <div className="col-span-2">
                                    <Label>Názov zľavy</Label>
                                    <Input value={editingServiceDiscountData.name} onChange={(e) => setEditingServiceDiscountData({...editingServiceDiscountData, name: e.target.value})} />
                                  </div>
                                  <div className="flex items-center gap-2 pt-6">
                                    <Switch checked={editingServiceDiscountData.isActive} onCheckedChange={(v) => setEditingServiceDiscountData({...editingServiceDiscountData, isActive: v})} />
                                    <Label>{t.konfigurator.activeLabel}</Label>
                                  </div>
                                </div>
                                
                                <Separator />
                                <p className="text-sm font-medium text-muted-foreground">Typ a hodnota zľavy</p>
                                <div className="grid grid-cols-3 gap-3">
                                  <div>
                                    <Label>Typ zľavy</Label>
                                    <Input value={editingServiceDiscountData.type || ""} onChange={(e) => setEditingServiceDiscountData({...editingServiceDiscountData, type: e.target.value})} />
                                  </div>
                                  <div className="flex items-center gap-2 pt-6">
                                    <Switch checked={editingServiceDiscountData.isPercentage} onCheckedChange={(v) => setEditingServiceDiscountData({...editingServiceDiscountData, isPercentage: v, isFixed: !v})} />
                                    <Label>Percentuálna</Label>
                                  </div>
                                  <div>
                                    <Label>{editingServiceDiscountData.isPercentage ? t.konfigurator.percentageLabel : t.konfigurator.fixedValueLabel}</Label>
                                    <Input 
                                      type="number" 
                                      step="0.01" 
                                      value={editingServiceDiscountData.isPercentage ? (editingServiceDiscountData.percentageValue || "") : (editingServiceDiscountData.fixedValue || "")} 
                                      onChange={(e) => setEditingServiceDiscountData({
                                        ...editingServiceDiscountData, 
                                        [editingServiceDiscountData.isPercentage ? "percentageValue" : "fixedValue"]: e.target.value
                                      })} 
                                    />
                                  </div>
                                </div>
                                
                                <Separator />
                                <p className="text-sm font-medium text-muted-foreground">Fakturácia</p>
                                <div className="grid grid-cols-3 gap-3">
                                  <div>
                                    <Label>Text na faktúre</Label>
                                    <Input value={editingServiceDiscountData.invoiceItemText || ""} onChange={(e) => setEditingServiceDiscountData({...editingServiceDiscountData, invoiceItemText: e.target.value})} />
                                  </div>
                                  <div>
                                    <Label>{t.konfigurator.accountingCodeLabel}</Label>
                                    <Input value={editingServiceDiscountData.accountingCode || ""} onChange={(e) => setEditingServiceDiscountData({...editingServiceDiscountData, accountingCode: e.target.value})} />
                                  </div>
                                  <div>
                                    <Label>{t.konfigurator.analyticalAccountLabel}</Label>
                                    <Input value={editingServiceDiscountData.analyticalAccount || ""} onChange={(e) => setEditingServiceDiscountData({...editingServiceDiscountData, analyticalAccount: e.target.value})} />
                                  </div>
                                </div>
                                
                                <Separator />
                                <p className="text-sm font-medium text-muted-foreground">{t.konfigurator.validity}</p>
                                <div className="grid grid-cols-2 gap-3">
                                  <DateFields
                                    label={t.konfigurator.validFromLabel}
                                    dayValue={editingServiceDiscountData.fromDay || 0}
                                    monthValue={editingServiceDiscountData.fromMonth || 0}
                                    yearValue={editingServiceDiscountData.fromYear || 0}
                                    onDayChange={(v) => setEditingServiceDiscountData({...editingServiceDiscountData, fromDay: v})}
                                    onMonthChange={(v) => setEditingServiceDiscountData({...editingServiceDiscountData, fromMonth: v})}
                                    onYearChange={(v) => setEditingServiceDiscountData({...editingServiceDiscountData, fromYear: v})}
                                    testIdPrefix="edit-service-discount-from"
                                  />
                                  <DateFields
                                    label={t.konfigurator.validToLabel}
                                    dayValue={editingServiceDiscountData.toDay || 0}
                                    monthValue={editingServiceDiscountData.toMonth || 0}
                                    yearValue={editingServiceDiscountData.toYear || 0}
                                    onDayChange={(v) => setEditingServiceDiscountData({...editingServiceDiscountData, toDay: v})}
                                    onMonthChange={(v) => setEditingServiceDiscountData({...editingServiceDiscountData, toMonth: v})}
                                    onYearChange={(v) => setEditingServiceDiscountData({...editingServiceDiscountData, toYear: v})}
                                    testIdPrefix="edit-service-discount-to"
                                  />
                                </div>
                              </div>
                              <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                                <Button size="sm" variant="outline" onClick={() => { setEditingServiceDiscountId(null); setEditingServiceDiscountData(null); }}>{t.common.cancel}</Button>
                                <Button size="sm" onClick={() => {
                                  const { id, instanceId, createdAt, fromDay, fromMonth, fromYear, toDay, toMonth, toYear, ...updateData } = editingServiceDiscountData;
                                  updateServiceDiscountMutation.mutate({ 
                                    id: editingServiceDiscountId, 
                                    data: {
                                      ...updateData,
                                      fixedValue: updateData.fixedValue === "" ? null : updateData.fixedValue,
                                      percentageValue: updateData.percentageValue === "" ? null : updateData.percentageValue,
                                      fromDate: componentsToISOString(fromDay, fromMonth, fromYear),
                                      toDate: componentsToISOString(toDay, toMonth, toYear),
                                    }
                                  });
                                }}>{t.common.save}</Button>
                              </div>
                            </Card>
                          )}
                          {serviceDiscounts.length === 0 && !isAddingServiceDiscount && !editingServiceDiscountId && (
                            <p className="text-sm text-muted-foreground text-center py-4">Žiadne zľavy</p>
                          )}
                        </TabsContent>

                        <TabsContent value="vat" className="space-y-3 mt-3">
                          <div className="flex justify-end">
                            <Button size="sm" onClick={() => setIsAddingServiceVat(true)}><Plus className="h-4 w-4 mr-1" />Pridať VAT</Button>
                          </div>
                      {isAddingServiceVat && (
                        <Card className="p-4 mb-3">
                          <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <Label>Kategória</Label>
                                <Input 
                                  value={newServiceVatData.category} 
                                  onChange={(e) => setNewServiceVatData({...newServiceVatData, category: e.target.value})} 
                                  placeholder="Napr. standard, reduced"
                                  data-testid="input-service-vat-category"
                                />
                              </div>
                              <div>
                                <Label>{t.konfigurator.accountingCodeLabel}</Label>
                                <Input 
                                  value={newServiceVatData.accountingCode} 
                                  onChange={(e) => setNewServiceVatData({...newServiceVatData, accountingCode: e.target.value})}
                                  data-testid="input-service-vat-accounting-code"
                                />
                              </div>
                              <div>
                                <Label>VAT sadzba (%)</Label>
                                <Input 
                                  type="number" 
                                  step="0.01" 
                                  value={newServiceVatData.vatRate} 
                                  onChange={(e) => setNewServiceVatData({...newServiceVatData, vatRate: e.target.value})}
                                  data-testid="input-service-vat-rate"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <DateFields
                                label={t.konfigurator.validFromLabel}
                                dayValue={newServiceVatData.fromDay}
                                monthValue={newServiceVatData.fromMonth}
                                yearValue={newServiceVatData.fromYear}
                                onDayChange={(v) => setNewServiceVatData({...newServiceVatData, fromDay: v})}
                                onMonthChange={(v) => setNewServiceVatData({...newServiceVatData, fromMonth: v})}
                                onYearChange={(v) => setNewServiceVatData({...newServiceVatData, fromYear: v})}
                                testIdPrefix="new-service-vat-from"
                              />
                              <DateFields
                                label={t.konfigurator.validToLabel}
                                dayValue={newServiceVatData.toDay}
                                monthValue={newServiceVatData.toMonth}
                                yearValue={newServiceVatData.toYear}
                                onDayChange={(v) => setNewServiceVatData({...newServiceVatData, toDay: v})}
                                onMonthChange={(v) => setNewServiceVatData({...newServiceVatData, toMonth: v})}
                                onYearChange={(v) => setNewServiceVatData({...newServiceVatData, toYear: v})}
                                testIdPrefix="new-service-vat-to"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch 
                                checked={newServiceVatData.createAsNewVat} 
                                onCheckedChange={(v) => setNewServiceVatData({...newServiceVatData, createAsNewVat: v})}
                                data-testid="switch-service-vat-create-as-new"
                              />
                              <Label>Vytvoriť ako nové VAT</Label>
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                            <Button size="sm" variant="outline" onClick={() => setIsAddingServiceVat(false)}>{t.common.cancel}</Button>
                            <Button 
                              size="sm" 
                              disabled={!newServiceVatData.category || createServiceVatMutation.isPending}
                              onClick={() => {
                                const payload: any = {
                                  instanceId: selectedServiceId!,
                                  instanceType: "service",
                                  category: newServiceVatData.category,
                                  accountingCode: newServiceVatData.accountingCode || null,
                                  vatRate: newServiceVatData.vatRate === "" ? null : newServiceVatData.vatRate,
                                  fromDate: componentsToISOString(newServiceVatData.fromDay, newServiceVatData.fromMonth, newServiceVatData.fromYear),
                                  toDate: componentsToISOString(newServiceVatData.toDay, newServiceVatData.toMonth, newServiceVatData.toYear),
                                  createAsNewVat: newServiceVatData.createAsNewVat,
                                };
                                createServiceVatMutation.mutate(payload);
                              }}
                            >{t.common.save}</Button>
                          </div>
                        </Card>
                      )}
                      {serviceVatRates.map((vat: any) => (
                        editingServiceVatId === vat.id ? (
                          <Card key={vat.id} className="p-4 mb-2">
                            <div className="space-y-4">
                              <div className="grid grid-cols-3 gap-3">
                                <div>
                                  <Label>Kategória</Label>
                                  <Input 
                                    value={editingServiceVatData.category} 
                                    onChange={(e) => setEditingServiceVatData({...editingServiceVatData, category: e.target.value})} 
                                    data-testid="input-edit-service-vat-category"
                                  />
                                </div>
                                <div>
                                  <Label>{t.konfigurator.accountingCodeLabel}</Label>
                                  <Input 
                                    value={editingServiceVatData.accountingCode || ""} 
                                    onChange={(e) => setEditingServiceVatData({...editingServiceVatData, accountingCode: e.target.value})}
                                    data-testid="input-edit-service-vat-accounting-code"
                                  />
                                </div>
                                <div>
                                  <Label>VAT sadzba (%)</Label>
                                  <Input 
                                    type="number" 
                                    step="0.01" 
                                    value={editingServiceVatData.vatRate || ""} 
                                    onChange={(e) => setEditingServiceVatData({...editingServiceVatData, vatRate: e.target.value})}
                                    data-testid="input-edit-service-vat-rate"
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <DateFields
                                  label={t.konfigurator.validFromLabel}
                                  dayValue={editingServiceVatData.fromDay}
                                  monthValue={editingServiceVatData.fromMonth}
                                  yearValue={editingServiceVatData.fromYear}
                                  onDayChange={(v) => setEditingServiceVatData({...editingServiceVatData, fromDay: v})}
                                  onMonthChange={(v) => setEditingServiceVatData({...editingServiceVatData, fromMonth: v})}
                                  onYearChange={(v) => setEditingServiceVatData({...editingServiceVatData, fromYear: v})}
                                  testIdPrefix="edit-service-vat-from"
                                />
                                <DateFields
                                  label={t.konfigurator.validToLabel}
                                  dayValue={editingServiceVatData.toDay}
                                  monthValue={editingServiceVatData.toMonth}
                                  yearValue={editingServiceVatData.toYear}
                                  onDayChange={(v) => setEditingServiceVatData({...editingServiceVatData, toDay: v})}
                                  onMonthChange={(v) => setEditingServiceVatData({...editingServiceVatData, toMonth: v})}
                                  onYearChange={(v) => setEditingServiceVatData({...editingServiceVatData, toYear: v})}
                                  testIdPrefix="edit-service-vat-to"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <Switch 
                                  checked={editingServiceVatData.createAsNewVat} 
                                  onCheckedChange={(v) => setEditingServiceVatData({...editingServiceVatData, createAsNewVat: v})}
                                  data-testid="switch-edit-service-vat-create-as-new"
                                />
                                <Label>Vytvoriť ako nové VAT</Label>
                              </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                              <Button size="sm" variant="outline" onClick={() => { setEditingServiceVatId(null); setEditingServiceVatData(null); }}>{t.common.cancel}</Button>
                              <Button 
                                size="sm" 
                                onClick={() => {
                                  const { id, instanceId, instanceType, createdAt, fromDay, fromMonth, fromYear, toDay, toMonth, toYear, ...updateData } = editingServiceVatData;
                                  updateServiceVatMutation.mutate({ 
                                    id: editingServiceVatId, 
                                    data: {
                                      ...updateData,
                                      vatRate: updateData.vatRate === "" ? null : updateData.vatRate,
                                      accountingCode: updateData.accountingCode || null,
                                      fromDate: componentsToISOString(fromDay, fromMonth, fromYear),
                                      toDate: componentsToISOString(toDay, toMonth, toYear),
                                    }
                                  });
                                }}
                              >{t.common.save}</Button>
                            </div>
                          </Card>
                        ) : (
                          <div key={vat.id} className="flex items-center justify-between p-2 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{vat.category}</span>
                              {vat.vatRate && <Badge variant="outline">{vat.vatRate}%</Badge>}
                              {vat.accountingCode && <span className="text-sm text-muted-foreground">{vat.accountingCode}</span>}
                              {(vat.fromDate || vat.toDate) && (
                                <span className="text-sm text-muted-foreground">
                                  {vat.fromDate ? formatDate(vat.fromDate) : "—"} – {vat.toDate ? formatDate(vat.toDate) : "—"}
                                </span>
                              )}
                              {vat.createAsNewVat && <Badge variant="secondary">Nové VAT</Badge>}
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => {
                                const fromParts = isoStringToComponents(vat.fromDate);
                                const toParts = isoStringToComponents(vat.toDate);
                                setEditingServiceVatId(vat.id);
                                setEditingServiceVatData({ ...vat, fromDay: fromParts.day, fromMonth: fromParts.month, fromYear: fromParts.year, toDay: toParts.day, toMonth: toParts.month, toYear: toParts.year });
                              }}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => deleteServiceVatMutation.mutate(vat.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </div>
                          </div>
                        )
                      ))}
                          {serviceVatRates.length === 0 && !isAddingServiceVat && (
                            <p className="text-sm text-muted-foreground text-center py-4">Žiadne VAT sadzby</p>
                          )}
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                )}

                {copyingService && (
                  <Dialog open={!!copyingService} onOpenChange={(open) => !open && setCopyingService(null)}>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Kopírovať službu</DialogTitle>
                        <DialogDescription>
                          Vyberte cieľovú inštanciu pre kopírovanie služby "{copyingService.name}"
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div>
                          <Label>Cieľová inštancia</Label>
                          <Select value={copyTargetInstanceId} onValueChange={setCopyTargetInstanceId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Vyberte inštanciu" />
                            </SelectTrigger>
                            <SelectContent>
                              {(instances as any[])
                                .filter(inst => inst.id !== copyingService.instanceId)
                                .map(inst => (
                                  <SelectItem key={inst.id} value={inst.id}>
                                    {inst.name} ({inst.countryCode})
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setCopyingService(null)}>{t.common.cancel}</Button>
                        <Button 
                          disabled={!copyTargetInstanceId}
                          onClick={async () => {
                            const { id, createdAt, instanceId, ...serviceData } = copyingService;
                            await apiRequest("POST", `/api/product-instances/${copyTargetInstanceId}/services`, {
                              ...serviceData,
                              instanceId: copyTargetInstanceId,
                              name: `${serviceData.name} (kópia)`,
                            });
                            toast({ title: t.success.created });
                            queryClient.invalidateQueries({ queryKey: ["/api/product-instances", copyTargetInstanceId, "services"] });
                            refetchServices();
                            setCopyingService(null);
                            setCopyTargetInstanceId("");
                          }}
                        >
                          Kopírovať
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="setts" className="space-y-4 mt-4">
            <ZostavyTab productId={product.id} instances={instances} t={t} />
          </TabsContent>
        </Tabs>
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t.common.close}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const getCategoriesWithTranslations = (t: any) => [
  { value: "cord_blood", label: t.products.categories.cordBlood },
  { value: "cord_tissue", label: t.products.categories.cordTissue },
  { value: "storage", label: t.products.categories.storage },
  { value: "processing", label: t.products.categories.processing },
  { value: "testing", label: t.products.categories.testing },
  { value: "other", label: t.products.categories.other },
];

const CURRENCY_CODES = ["EUR", "USD", "CZK", "HUF", "RON", "CHF"];

function ProductsTab() {
  const { toast } = useToast();
  const { t } = useI18n();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [duplicatingProduct, setDuplicatingProduct] = useState<Product | null>(null);
  const [duplicateNewName, setDuplicateNewName] = useState("");

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

  const duplicateMutation = useMutation({
    mutationFn: (data: { id: string; newName: string }) => 
      apiRequest("POST", `/api/products/${data.id}/duplicate`, { newName: data.newName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setDuplicatingProduct(null);
      setDuplicateNewName("");
      toast({ title: t.konfigurator.productDuplicated || "Product duplicated successfully" });
    },
    onError: () => {
      toast({ title: t.errors.duplicateFailed || "Failed to duplicate product", variant: "destructive" });
    },
  });

  const filteredProducts = userProducts.filter(product =>
    product.name.toLowerCase().includes(search.toLowerCase()) ||
    (product.description?.toLowerCase().includes(search.toLowerCase()))
  );

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    form.reset({
      name: product.name,
      description: product.description || "",
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
          <Button variant="ghost" size="icon" onClick={() => setViewingProduct(product)} data-testid={`button-edit-product-${product.id}`}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => {
            setDuplicatingProduct(product);
            setDuplicateNewName(product.name + " (kópia)");
          }} data-testid={`button-duplicate-product-${product.id}`}>
            <Copy className="h-4 w-4" />
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
        <Button onClick={() => setIsWizardOpen(true)} data-testid="button-add-product">
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

      {/* Duplicate Product Dialog */}
      <Dialog open={!!duplicatingProduct} onOpenChange={(open) => { if (!open) { setDuplicatingProduct(null); setDuplicateNewName(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.konfigurator.duplicateProduct || "Kopírovať produkt"}</DialogTitle>
            <DialogDescription>
              {t.konfigurator.duplicateProductDescription || "Zadajte názov nového produktu. Všetky nastavenia budú skopírované."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t.products.productName}</Label>
              <Input 
                value={duplicateNewName} 
                onChange={(e) => setDuplicateNewName(e.target.value)}
                placeholder={t.products.productName}
                data-testid="input-duplicate-product-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDuplicatingProduct(null); setDuplicateNewName(""); }}>
              {t.common.cancel}
            </Button>
            <Button 
              onClick={() => duplicatingProduct && duplicateMutation.mutate({ id: duplicatingProduct.id, newName: duplicateNewName })}
              disabled={!duplicateNewName.trim() || duplicateMutation.isPending}
            >
              {duplicateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {t.konfigurator.duplicate || "Kopírovať"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProductDetailDialog 
        product={viewingProduct} 
        open={!!viewingProduct} 
        onOpenChange={(open) => { if (!open) setViewingProduct(null); }}
        onProductUpdated={() => queryClient.invalidateQueries({ queryKey: ["/api/products"] })}
      />

      <ProductWizard
        open={isWizardOpen}
        onOpenChange={setIsWizardOpen}
      />
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

// DOCX Templates Tab - standalone module for managing DOCX invoice templates
interface DocxTemplateType {
  id: string;
  name: string;
  description: string | null;
  filePath: string;
  originalFileName: string | null;
  countryCode: string | null;
  year: number | null;
  version: number;
  parentTemplateId: string | null;
  templateType: string;
  isDefault: boolean;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface VariableGroup {
  label: string;
  description?: string;
  variables: { key: string; description: string }[];
}

function ContractTemplatesSection() {
  return <ContractTemplatesManager />;
}

function DocxTemplatesTab() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
  const [copyingTemplate, setCopyingTemplate] = useState<DocxTemplateType | null>(null);
  const [showVariables, setShowVariables] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DocxTemplateType | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const reuploadInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDescription, setNewTemplateDescription] = useState("");
  const [newTemplateType, setNewTemplateType] = useState("invoice");
  const [newTemplateCountry, setNewTemplateCountry] = useState("");
  const [newTemplateYear, setNewTemplateYear] = useState(new Date().getFullYear().toString());
  const [copyName, setCopyName] = useState("");
  const [copyYear, setCopyYear] = useState(new Date().getFullYear().toString());
  const [filterCountry, setFilterCountry] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortField, setSortField] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;

  const countries = [
    { code: "SK", name: "Slovensko", flag: "🇸🇰" },
    { code: "CZ", name: "Česko", flag: "🇨🇿" },
    { code: "HU", name: "Maďarsko", flag: "🇭🇺" },
    { code: "RO", name: "Rumunsko", flag: "🇷🇴" },
    { code: "IT", name: "Taliansko", flag: "🇮🇹" },
    { code: "DE", name: "Nemecko", flag: "🇩🇪" },
    { code: "US", name: "USA", flag: "🇺🇸" },
  ];

  const { data: templates = [], isLoading } = useQuery<DocxTemplateType[]>({
    queryKey: ["/api/configurator/docx-templates"],
  });

  const { data: variablesData } = useQuery<Record<string, VariableGroup>>({
    queryKey: ["/api/configurator/docx-templates/variables"],
  });

  const createMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch("/api/configurator/docx-templates", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to upload template");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/configurator/docx-templates"] });
      setIsDialogOpen(false);
      setUploadingFile(null);
      setNewTemplateName("");
      setNewTemplateDescription("");
      toast({ title: "DOCX šablóna vytvorená" });
    },
    onError: () => {
      toast({ title: "Chyba pri vytváraní šablóny", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/configurator/docx-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/configurator/docx-templates"] });
      toast({ title: "DOCX šablóna zmazaná" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest("PATCH", `/api/configurator/docx-templates/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/configurator/docx-templates"] });
    },
  });

  const copyMutation = useMutation({
    mutationFn: ({ id, name, year }: { id: string; name: string; year?: number }) =>
      apiRequest("POST", `/api/configurator/docx-templates/${id}/copy`, { name, year }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/configurator/docx-templates"] });
      setIsCopyDialogOpen(false);
      setCopyingTemplate(null);
      setCopyName("");
      toast({ title: "Šablóna skopírovaná do novej verzie" });
    },
    onError: () => {
      toast({ title: "Chyba pri kopírovaní šablóny", variant: "destructive" });
    },
  });

  const handleUpload = () => {
    if (!uploadingFile || !newTemplateName) return;
    const formData = new FormData();
    formData.append("docx", uploadingFile);
    formData.append("name", newTemplateName);
    formData.append("description", newTemplateDescription);
    formData.append("templateType", newTemplateType);
    if (newTemplateCountry) formData.append("countryCode", newTemplateCountry);
    if (newTemplateYear) formData.append("year", newTemplateYear);
    createMutation.mutate(formData);
  };

  const handleCopy = () => {
    if (!copyingTemplate || !copyName) return;
    copyMutation.mutate({
      id: copyingTemplate.id,
      name: copyName,
      year: copyYear ? parseInt(copyYear) : undefined,
    });
  };

  const openCopyDialog = (template: DocxTemplateType) => {
    setCopyingTemplate(template);
    setCopyName(`${template.name} - v${(template.version || 1) + 1}`);
    setCopyYear((new Date().getFullYear()).toString());
    setIsCopyDialogOpen(true);
  };

  const openEditor = async (template: DocxTemplateType) => {
    setEditingTemplate(template);
    setIsEditorOpen(true);
    if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
    setPreviewPdfUrl(null);
    setIsLoadingPreview(true);
    try {
      const res = await fetch(`/api/configurator/docx-templates/${template.id}/preview-pdf`, {
        credentials: "include",
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setPreviewPdfUrl(url);
      } else {
        const err = await res.json().catch(() => ({ error: "Neznáma chyba" }));
        toast({ title: "Chyba pri náhľade", description: err.error, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Chyba pri načítaní náhľadu", variant: "destructive" });
    } finally {
      setIsLoadingPreview(false);
    }
  };


  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Skopírované do schránky" });
  };

  const downloadOriginalDocx = (template: DocxTemplateType) => {
    window.open(`/api/configurator/docx-templates/${template.id}/download`, "_blank");
  };

  const handleReupload = async (template: DocxTemplateType, file: File) => {
    const formData = new FormData();
    formData.append("docx", file);
    try {
      const res = await fetch(`/api/configurator/docx-templates/${template.id}/reupload`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (res.ok) {
        toast({ title: "Šablóna aktualizovaná" });
        queryClient.invalidateQueries({ queryKey: ["/api/configurator/docx-templates"] });
        openEditor(template);
      } else {
        const err = await res.json().catch(() => ({ error: "Neznáma chyba" }));
        toast({ title: "Chyba", description: err.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Chyba pri nahrávaní", variant: "destructive" });
    }
  };

  const getCountryFlag = (code: string | null) => countries.find(c => c.code === code)?.flag || "";
  const getCountryName = (code: string | null) => countries.find(c => c.code === code)?.name || code || "-";

  const filteredTemplates = useMemo(() => {
    let result = [...templates];
    if (filterCountry !== "all") {
      result = result.filter(t => t.countryCode === filterCountry);
    }
    if (filterType !== "all") {
      result = result.filter(t => t.templateType === filterType);
    }
    if (filterStatus !== "all") {
      result = result.filter(t => filterStatus === "active" ? t.isActive : !t.isActive);
    }
    result.sort((a, b) => {
      let valA: string | number = "";
      let valB: string | number = "";
      switch (sortField) {
        case "name": valA = a.name.toLowerCase(); valB = b.name.toLowerCase(); break;
        case "country": valA = a.countryCode || ""; valB = b.countryCode || ""; break;
        case "year": valA = a.year || 0; valB = b.year || 0; break;
        case "type": valA = a.templateType; valB = b.templateType; break;
        case "status": valA = a.isActive ? 1 : 0; valB = b.isActive ? 1 : 0; break;
        default: valA = a.name.toLowerCase(); valB = b.name.toLowerCase();
      }
      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return result;
  }, [templates, filterCountry, filterType, filterStatus, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredTemplates.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedTemplates = filteredTemplates.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setCurrentPage(1);
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortDir === "asc" 
      ? <ChevronUp className="h-3 w-3 ml-1" /> 
      : <ChevronDown className="h-3 w-3 ml-1" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Nahrajte DOCX šablóny s premennými pre automatické generovanie PDF faktúr
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowVariables(!showVariables)}
            data-testid="btn-toggle-variables"
          >
            <Info className="h-4 w-4 mr-2" />
            {showVariables ? "Skryť premenné" : "Zobraziť premenné"}
          </Button>
          <Button onClick={() => setIsDialogOpen(true)} data-testid="btn-new-docx-template">
            <Plus className="h-4 w-4 mr-2" />
            Nová DOCX šablóna
          </Button>
        </div>
      </div>

      {showVariables && variablesData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dostupné premenné pre DOCX šablóny</CardTitle>
            <CardDescription>
              Kliknite na premennú pre skopírovanie. Použite tieto premenné vo vašom DOCX súbore.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(variablesData).map(([groupKey, group]) => (
                <div key={groupKey} className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2">{group.label}</h4>
                  {group.description && (
                    <p className="text-xs text-muted-foreground mb-2">{group.description}</p>
                  )}
                  <div className="space-y-1">
                    {group.variables.map((v) => (
                      <div
                        key={v.key}
                        className="flex items-center justify-between text-sm hover:bg-muted p-1 rounded cursor-pointer"
                        onClick={() => copyToClipboard(v.key)}
                        data-testid={`var-${v.key}`}
                      >
                        <code className="text-xs bg-muted px-1 rounded">{v.key}</code>
                        <span className="text-xs text-muted-foreground ml-2">{v.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filterCountry} onValueChange={(v) => { setFilterCountry(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-[180px]" data-testid="select-filter-country">
            <SelectValue placeholder="Krajina" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Všetky krajiny</SelectItem>
            {countries.map(c => (
              <SelectItem key={c.code} value={c.code}>
                <span className="mr-2">{c.flag}</span>{c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={(v) => { setFilterType(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-[160px]" data-testid="select-filter-type">
            <SelectValue placeholder="Typ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Všetky typy</SelectItem>
            <SelectItem value="invoice">Faktúra</SelectItem>
            <SelectItem value="proforma">Proforma</SelectItem>
            <SelectItem value="credit_note">Dobropis</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-[140px]" data-testid="select-filter-status">
            <SelectValue placeholder="Stav" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Všetky</SelectItem>
            <SelectItem value="active">Aktívne</SelectItem>
            <SelectItem value="inactive">Neaktívne</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">
          {filteredTemplates.length} {filteredTemplates.length === 1 ? "šablóna" : "šablón"}
        </span>
      </div>

      <Card>
        <CardContent className="pt-6">
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {templates.length === 0
                ? 'Zatiaľ nemáte žiadne DOCX šablóny. Kliknite na "Nová DOCX šablóna" pre vytvorenie.'
                : "Žiadne šablóny nezodpovedajú zvoleným filtrom."}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleSort("name")} data-testid="sort-name">
                      <span className="flex items-center">Názov<SortIcon field="name" /></span>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleSort("country")} data-testid="sort-country">
                      <span className="flex items-center">Krajina<SortIcon field="country" /></span>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleSort("year")} data-testid="sort-year">
                      <span className="flex items-center">Rok<SortIcon field="year" /></span>
                    </TableHead>
                    <TableHead>Verzia</TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleSort("type")} data-testid="sort-type">
                      <span className="flex items-center">Typ<SortIcon field="type" /></span>
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => handleSort("status")} data-testid="sort-status">
                      <span className="flex items-center">Stav<SortIcon field="status" /></span>
                    </TableHead>
                    <TableHead className="text-right">Akcie</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTemplates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">
                        <div>
                          <div>{template.name}</div>
                          <div className="text-xs text-muted-foreground">{template.originalFileName || "template.docx"}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {template.countryCode ? (
                          <Badge variant="outline">
                            <span className="mr-1">{getCountryFlag(template.countryCode)}</span>
                            {getCountryName(template.countryCode)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {template.year ? (
                          <Badge variant="secondary">{template.year}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">v{template.version || 1}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {template.templateType === "invoice" ? "Faktúra" : 
                           template.templateType === "proforma" ? "Proforma" : "Dobropis"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={template.isActive ? "default" : "secondary"}>
                          {template.isActive ? "Aktívna" : "Neaktívna"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEditor(template)}
                            title="Náhľad a správa šablóny"
                            data-testid={`btn-edit-${template.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => window.open(`/api/configurator/docx-templates/${template.id}/download`, "_blank")}
                            title="Stiahnuť"
                            data-testid={`btn-download-${template.id}`}
                          >
                            <FileDown className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openCopyDialog(template)}
                            title="Kopírovať do novej verzie"
                            data-testid={`btn-copy-${template.id}`}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => toggleActiveMutation.mutate({ id: template.id, isActive: !template.isActive })}
                            title={template.isActive ? "Deaktivovať" : "Aktivovať"}
                            data-testid={`btn-toggle-${template.id}`}
                          >
                            {template.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteMutation.mutate(template.id)}
                            title="Zmazať"
                            data-testid={`btn-delete-${template.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-muted-foreground">
                    {t.common.page || "Page"} {safePage} / {totalPages} ({filteredTemplates.length} {t.common.results || "results"})
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safePage <= 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      data-testid="btn-prev-page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <Button
                        key={page}
                        variant={page === safePage ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        data-testid={`btn-page-${page}`}
                      >
                        {page}
                      </Button>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safePage >= totalPages}
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      data-testid="btn-next-page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nová DOCX šablóna</DialogTitle>
            <DialogDescription>
              Nahrajte DOCX súbor so premennými. Premenné budú pri generovaní PDF nahradené dátami z faktúry.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Názov šablóny *</Label>
              <Input
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="napr. Štandardná faktúra SK"
                data-testid="input-template-name"
              />
            </div>
            <div>
              <Label>Popis</Label>
              <Textarea
                value={newTemplateDescription}
                onChange={(e) => setNewTemplateDescription(e.target.value)}
                placeholder="Voliteľný popis šablóny..."
                data-testid="input-template-description"
              />
            </div>
            <div>
              <Label>Typ dokumentu</Label>
              <Select value={newTemplateType} onValueChange={setNewTemplateType}>
                <SelectTrigger data-testid="select-template-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="invoice">Faktúra</SelectItem>
                  <SelectItem value="proforma">Proforma faktúra</SelectItem>
                  <SelectItem value="credit_note">Dobropis</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Krajina</Label>
                <Select value={newTemplateCountry || "_all"} onValueChange={(v) => setNewTemplateCountry(v === "_all" ? "" : v)}>
                  <SelectTrigger data-testid="select-template-country">
                    <SelectValue placeholder="Všetky krajiny" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Všetky krajiny</SelectItem>
                    {countries.map((c) => (
                      <SelectItem key={c.code} value={c.code}><span className="mr-2">{c.flag}</span>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Rok</Label>
                <Input
                  type="number"
                  value={newTemplateYear}
                  onChange={(e) => setNewTemplateYear(e.target.value)}
                  placeholder="napr. 2025"
                  data-testid="input-template-year"
                />
              </div>
            </div>
            <div>
              <Label>DOCX súbor *</Label>
              <div className="mt-2">
                <input
                  type="file"
                  accept=".docx"
                  onChange={(e) => setUploadingFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-muted-foreground
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-primary file:text-primary-foreground
                    hover:file:bg-primary/90"
                  data-testid="input-docx-file"
                />
              </div>
              {uploadingFile && (
                <p className="text-sm text-muted-foreground mt-2">
                  Vybraný súbor: {uploadingFile.name}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Zrušiť
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!uploadingFile || !newTemplateName || createMutation.isPending}
              data-testid="btn-upload-docx"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Nahrať šablónu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCopyDialogOpen} onOpenChange={setIsCopyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kopírovať šablónu do novej verzie</DialogTitle>
            <DialogDescription>
              Vytvorí sa nová verzia šablóny "{copyingTemplate?.name}" s rovnakým DOCX súborom.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Názov novej verzie *</Label>
              <Input
                value={copyName}
                onChange={(e) => setCopyName(e.target.value)}
                placeholder="napr. Faktúra SK 2025 - v2"
                data-testid="input-copy-name"
              />
            </div>
            <div>
              <Label>Rok</Label>
              <Input
                type="number"
                value={copyYear}
                onChange={(e) => setCopyYear(e.target.value)}
                placeholder="napr. 2025"
                data-testid="input-copy-year"
              />
            </div>
            {copyingTemplate && (
              <div className="bg-muted p-3 rounded-md text-sm">
                <div className="font-medium mb-1">Pôvodná šablóna:</div>
                <div>Verzia: v{copyingTemplate.version || 1}</div>
                {copyingTemplate.countryCode && <div>Krajina: {getCountryFlag(copyingTemplate.countryCode)} {getCountryName(copyingTemplate.countryCode)}</div>}
                {copyingTemplate.year && <div>Rok: {copyingTemplate.year}</div>}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCopyDialogOpen(false)}>
              Zrušiť
            </Button>
            <Button
              onClick={handleCopy}
              disabled={!copyName || copyMutation.isPending}
              data-testid="btn-confirm-copy"
            >
              {copyMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              Vytvoriť novú verziu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditorOpen} onOpenChange={(open) => { if (!open) { setIsEditorOpen(false); setEditingTemplate(null); if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl); setPreviewPdfUrl(null); } }}>
        <DialogContent className="max-w-6xl max-h-[95vh]">
          <DialogHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <DialogTitle>Náhľad šablóny: {editingTemplate?.name}</DialogTitle>
                <DialogDescription>
                  Náhľad faktúry s ukážkovými údajmi. Šablónu upravte v programe Word a potom ju sem nahrajte.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="grid grid-cols-4 gap-4" style={{ height: "calc(85vh - 180px)" }}>
            <div className="col-span-3 flex flex-col min-h-0">
              {isLoadingPreview ? (
                <div className="flex-1 flex flex-col items-center justify-center border rounded-md gap-3">
                  <Loader2 className="h-8 w-8 animate-spin" data-testid="preview-loading" />
                  <p className="text-sm text-muted-foreground">Generujem PDF náhľad...</p>
                </div>
              ) : previewPdfUrl ? (
                <iframe
                  src={previewPdfUrl}
                  className="flex-1 border rounded-md w-full"
                  style={{ minHeight: "400px" }}
                  title="PDF náhľad šablóny"
                  data-testid="pdf-preview-iframe"
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center border rounded-md gap-3">
                  <FileText className="h-12 w-12 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Náhľad nie je dostupný</p>
                  <Button variant="outline" size="sm" onClick={() => editingTemplate && openEditor(editingTemplate)} data-testid="btn-retry-preview">
                    Skúsiť znova
                  </Button>
                </div>
              )}
            </div>
            
            <div className="flex flex-col min-h-0">
              <Label className="mb-2 font-semibold">Premenné pre šablónu</Label>
              <ScrollArea className="flex-1 border rounded-md p-2 min-h-0">
                {variablesData && Object.entries(variablesData).map(([groupKey, group]) => (
                  <div key={groupKey} className="mb-4">
                    <h4 className="font-medium text-xs mb-1 text-muted-foreground uppercase tracking-wider">{group.label}</h4>
                    {group.description && (
                      <p className="text-xs text-muted-foreground mb-1">{group.description}</p>
                    )}
                    <div className="space-y-0.5">
                      {group.variables.map((v: any) => (
                        <Button
                          key={v.key}
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-xs h-auto py-1 px-2"
                          onClick={() => copyToClipboard(v.key)}
                          title="Kliknite pre skopírovanie"
                          data-testid={`btn-copy-${v.key}`}
                        >
                          <code className="bg-muted px-1 rounded mr-1 text-[10px] shrink-0">{v.key}</code>
                          <span className="text-muted-foreground truncate text-[10px]">{v.description}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </ScrollArea>
              
              <div className="mt-2 p-2 bg-muted rounded-md text-xs">
                <div className="font-medium mb-1">Ako upraviť šablónu:</div>
                <div className="space-y-1 text-muted-foreground">
                  <div>1. Stiahnite DOCX šablónu</div>
                  <div>2. Upravte ju v programe Word</div>
                  <div>3. Vložte premenné v tvare <code className="text-[10px]">{`{variableName}`}</code></div>
                  <div>4. Pre cyklus: <code className="text-[10px]">{`{#items}...{/items}`}</code></div>
                  <div>5. Uložte a nahrajte upravenú šablónu</div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setIsEditorOpen(false); setEditingTemplate(null); if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl); setPreviewPdfUrl(null); }} data-testid="btn-close-preview">
              Zavrieť
            </Button>
            <Button variant="outline" onClick={() => editingTemplate && downloadOriginalDocx(editingTemplate)} data-testid="btn-download-docx">
              <Download className="h-4 w-4 mr-2" />
              Stiahnuť DOCX
            </Button>
            <input
              ref={reuploadInputRef}
              type="file"
              accept=".docx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && editingTemplate) handleReupload(editingTemplate, file);
                e.target.value = "";
              }}
              data-testid="input-reupload-docx"
            />
            <Button onClick={() => reuploadInputRef.current?.click()} data-testid="btn-reupload-docx">
              <Upload className="h-4 w-4 mr-2" />
              Nahrať upravenú šablónu
            </Button>
          </DialogFooter>
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
      key: "docxTemplate", 
      header: "DOCX",
      cell: (template: InvoiceTemplate) => (
        <div className="flex items-center gap-2">
          {(template as any).docxTemplatePath ? (
            <Badge variant="outline" className="text-green-600">Nahraný</Badge>
          ) : (
            <Badge variant="secondary">Chýba</Badge>
          )}
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".docx"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const formData = new FormData();
                formData.append("docx", file);
                try {
                  const res = await fetch(`/api/configurator/invoice-templates/${template.id}/docx`, {
                    method: "POST",
                    body: formData,
                    credentials: "include",
                  });
                  if (res.ok) {
                    queryClient.invalidateQueries({ queryKey: ["/api/configurator/invoice-templates"] });
                  }
                } catch (err) {
                  console.error("Upload failed:", err);
                }
              }}
              data-testid={`input-docx-upload-${template.id}`}
            />
            <Button size="sm" variant="outline" asChild>
              <span><Upload className="h-3 w-3 mr-1" />DOCX</span>
            </Button>
          </label>
        </div>
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

function NumberRangesTab({ mode = "invoice" }: { mode?: "invoice" | "contract" }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const { selectedCountries } = useCountryFilter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRange, setEditingRange] = useState<NumberRange | null>(null);
  const [wizardStep, setWizardStep] = useState(1);
  const [search, setSearch] = useState("");
  const totalSteps = 4;

  const modeTypes = mode === "invoice" ? ["invoice", "proforma"] : ["contract"];
  
  // Filtering & Sorting state
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;
  
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copyingRange, setCopyingRange] = useState<NumberRange | null>(null);
  const [copyTargetCountry, setCopyTargetCountry] = useState("");
  const [copyBillingDetailsId, setCopyBillingDetailsId] = useState("");

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
      type: mode === "contract" ? "contract" : "invoice",
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

  const { data: copyBillingCompanies = [] } = useQuery<BillingDetails[]>({
    queryKey: ["/api/billing-details", copyTargetCountry],
    queryFn: async () => {
      if (!copyTargetCountry) return [];
      const res = await fetch(`/api/billing-details?country=${copyTargetCountry}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: copyDialogOpen && !!copyTargetCountry,
  });

  const copyMutation = useMutation({
    mutationFn: (data: { id: string; targetCountryCode: string; billingDetailsId?: string }) =>
      apiRequest("POST", `/api/configurator/number-ranges/${data.id}/copy`, {
        targetCountryCode: data.targetCountryCode,
        billingDetailsId: data.billingDetailsId || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/configurator/number-ranges"] });
      setCopyDialogOpen(false);
      setCopyingRange(null);
      setCopyTargetCountry("");
      setCopyBillingDetailsId("");
      toast({ title: t.konfigurator.numberRangeCopied || "Number range copied successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        title: t.common.error || "Error",
        description: error.message || t.konfigurator.copyNumberRangeFailed || "Failed to copy number range",
        variant: "destructive"
      });
    },
  });

  const handleCopy = (range: NumberRange) => {
    setCopyingRange(range);
    setCopyTargetCountry("");
    setCopyBillingDetailsId("");
    setCopyDialogOpen(true);
  };

  const handleCopySubmit = () => {
    if (!copyingRange || !copyTargetCountry) return;
    copyMutation.mutate({
      id: copyingRange.id,
      targetCountryCode: copyTargetCountry,
      billingDetailsId: copyBillingDetailsId || undefined,
    });
  };

  const handleEdit = (range: NumberRange) => {
    setEditingRange(range);
    setWizardStep(1);
    form.reset({
      name: range.name,
      countryCode: range.countryCode,
      billingDetailsId: range.billingDetailsId || "",
      year: range.year,
      useServiceCode: range.useServiceCode,
      type: range.type as "invoice" | "proforma" | "contract",
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

  // Get unique years for filter dropdown
  const availableYears = [...new Set(ranges.map(r => r.year))].sort((a, b) => b - a);
  
  const filteredRanges = ranges
    .filter(range => {
      if (!modeTypes.includes(range.type)) return false;
      if (countryFilter !== "all" && range.countryCode !== countryFilter) return false;
      if (typeFilter !== "all" && range.type !== typeFilter) return false;
      if (yearFilter !== "all" && String(range.year) !== yearFilter) return false;
      // Apply search
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
    })
    .sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortField) {
        case "name": aVal = a.name; bVal = b.name; break;
        case "year": aVal = a.year; bVal = b.year; break;
        case "countryCode": aVal = a.countryCode; bVal = b.countryCode; break;
        case "type": aVal = a.type; bVal = b.type; break;
        case "lastNumberUsed": aVal = a.lastNumberUsed || 0; bVal = b.lastNumberUsed || 0; break;
        default: aVal = a.name; bVal = b.name;
      }
      if (typeof aVal === "string") {
        return sortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    });
  
  // Pagination
  const totalPages = Math.ceil(filteredRanges.length / pageSize);
  const paginatedRanges = filteredRanges.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  
  // Reset page when filters change
  const handleFilterChange = () => {
    setCurrentPage(1);
  };

  const handleSortClick = (field: string) => {
    if (sortField === field) {
      setSortDirection(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  const RangeSortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortDirection === "asc" 
      ? <ChevronUp className="h-3 w-3 ml-1" /> 
      : <ChevronDown className="h-3 w-3 ml-1" />;
  };

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
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t.common.search}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="pl-9"
              data-testid="input-search-number-ranges"
            />
          </div>
          <Select value={countryFilter} onValueChange={(v) => { setCountryFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-[160px]" data-testid="select-range-country-filter">
              <SelectValue placeholder={t.common.country} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.common.all || "All"}</SelectItem>
              {COUNTRIES.map((country) => (
                <SelectItem key={country.code} value={country.code}>
                  <span className="mr-2">{country.flag}</span>{country.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {modeTypes.length > 1 && (
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[140px]" data-testid="select-range-type-filter">
                <SelectValue placeholder={t.konfigurator.numberRangeType} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.common.all || "All"}</SelectItem>
                {modeTypes.map(mt => (
                  <SelectItem key={mt} value={mt}>
                    {mt === "invoice" ? t.konfigurator.invoice : mt === "proforma" ? t.konfigurator.proformaInvoice : (t.contractsModule?.contract || "Zmluva")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={yearFilter} onValueChange={(v) => { setYearFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-[100px]" data-testid="select-range-year-filter">
              <SelectValue placeholder={t.konfigurator.numberRangeYear} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.common.all || "All"}</SelectItem>
              {availableYears.map((year) => (
                <SelectItem key={year} value={String(year)}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(countryFilter !== "all" || (modeTypes.length > 1 && typeFilter !== "all") || yearFilter !== "all" || search) && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                setCountryFilter("all");
                setTypeFilter("all");
                setYearFilter("all");
                setSearch("");
                setCurrentPage(1);
              }}
              data-testid="clear-range-filters"
            >
              <X className="h-4 w-4 mr-1" />
              {t.common.clear || "Clear"}
            </Button>
          )}
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
                                {mode === "contract" ? (
                                  <SelectItem value="contract">{t.contractsModule?.contract || "Zmluva"}</SelectItem>
                                ) : (
                                  <>
                                    <SelectItem value="invoice">{t.konfigurator.invoice}</SelectItem>
                                    <SelectItem value="proforma">{t.konfigurator.proformaInvoice}</SelectItem>
                                  </>
                                )}
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
      
      {paginatedRanges.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {search || countryFilter !== "all" || typeFilter !== "all" || yearFilter !== "all" 
            ? (t.common.noData || "No results found") 
            : t.konfigurator.noNumberRanges}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSortClick("name")} data-testid="sort-range-name">
                <span className="flex items-center">{t.konfigurator.numberRangeName}<RangeSortIcon field="name" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSortClick("countryCode")} data-testid="sort-range-country">
                <span className="flex items-center">{t.common.country}<RangeSortIcon field="countryCode" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSortClick("year")} data-testid="sort-range-year">
                <span className="flex items-center">{t.konfigurator.numberRangeYear}<RangeSortIcon field="year" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSortClick("type")} data-testid="sort-range-type">
                <span className="flex items-center">{t.konfigurator.numberRangeType}<RangeSortIcon field="type" /></span>
              </TableHead>
              <TableHead>{t.konfigurator.prefix} / {t.konfigurator.suffix}</TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSortClick("lastNumberUsed")} data-testid="sort-range-last-used">
                <span className="flex items-center">{t.konfigurator.lastNumberUsed}<RangeSortIcon field="lastNumberUsed" /></span>
              </TableHead>
              <TableHead>{t.common.status}</TableHead>
              <TableHead className="text-right">{t.common.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRanges.map((range) => {
              const country = COUNTRIES.find(c => c.code === range.countryCode);
              return (
                <TableRow key={range.id}>
                  <TableCell className="font-medium">{range.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{country?.flag || ""}</span>
                      <Badge variant="outline" className="font-mono text-xs">{range.countryCode}</Badge>
                    </div>
                  </TableCell>
                  <TableCell>{range.year}</TableCell>
                  <TableCell>
                    <Badge variant={range.type === "invoice" ? "default" : range.type === "contract" ? "default" : "secondary"}>
                      {range.type === "invoice" ? t.konfigurator.invoice : range.type === "contract" ? (t.contractsModule?.contract || "Zmluva") : t.konfigurator.proformaInvoice}
                    </Badge>
                  </TableCell>
                  <TableCell>{range.prefix || "-"} / {range.suffix || "-"}</TableCell>
                  <TableCell>{range.lastNumberUsed || 0}</TableCell>
                  <TableCell>
                    <Badge variant={range.isActive ? "default" : "secondary"}>
                      {range.isActive ? t.common.active : t.common.inactive}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(range)} data-testid={`button-edit-range-${range.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleCopy(range)} data-testid={`button-copy-range-${range.id}`} title={t.konfigurator.copyToCountry || "Copy to another country"}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(range.id)} data-testid={`button-delete-range-${range.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {t.common.page || "Page"} {currentPage} / {totalPages} ({filteredRanges.length} {t.common.results || "results"})
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              data-testid="pagination-first"
            >
              <ChevronLeft className="h-4 w-4" />
              <ChevronLeft className="h-4 w-4 -ml-2" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              data-testid="pagination-prev"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-sm font-medium">{currentPage}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              data-testid="pagination-next"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              data-testid="pagination-last"
            >
              <ChevronRight className="h-4 w-4" />
              <ChevronRight className="h-4 w-4 -ml-2" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.konfigurator.copyNumberRange || "Copy Number Range"}</DialogTitle>
            <DialogDescription>
              {t.konfigurator.copyNumberRangeDescription || "Copy this number range to another country. The new range will start from number 1."}
            </DialogDescription>
          </DialogHeader>
          
          {copyingRange && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm font-medium">{t.konfigurator.sourceRange || "Source"}: {copyingRange.name}</p>
                <p className="text-xs text-muted-foreground">
                  {copyingRange.prefix || ""}{copyingRange.useServiceCode ? "[CODE]" : ""}{String(1).padStart(copyingRange.digitsToGenerate, "0")}{copyingRange.suffix || ""}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>{t.konfigurator.targetCountry || "Target Country"}</Label>
                <Select value={copyTargetCountry} onValueChange={(v) => { setCopyTargetCountry(v); setCopyBillingDetailsId(""); }}>
                  <SelectTrigger data-testid="select-copy-target-country">
                    <SelectValue placeholder={t.konfigurator.selectCountry || "Select country"} />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.filter(c => c.code !== copyingRange.countryCode).map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {copyTargetCountry && copyBillingCompanies.length > 0 && (
                <div className="space-y-2">
                  <Label>{t.konfigurator.billingCompany || "Billing Company"}</Label>
                  <Select 
                    value={copyBillingDetailsId || "__none__"} 
                    onValueChange={(v) => setCopyBillingDetailsId(v === "__none__" ? "" : v)}
                  >
                    <SelectTrigger data-testid="select-copy-billing-company">
                      <SelectValue placeholder={t.konfigurator.selectBillingCompany || "Select billing company (optional)"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t.common.none || "None"}</SelectItem>
                      {copyBillingCompanies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.companyName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyDialogOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button 
              onClick={handleCopySubmit} 
              disabled={!copyTargetCountry || copyMutation.isPending}
              data-testid="button-confirm-copy"
            >
              {copyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t.common.copy || "Copy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

function ExchangeRatesTab() {
  const { t } = useI18n();
  const { toast } = useToast();
  
  const { data: ratesData, isLoading } = useQuery<{ rates: ExchangeRate[]; lastUpdate: string | null }>({
    queryKey: ["/api/exchange-rates"],
  });
  
  const refreshMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/exchange-rates/refresh", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to refresh rates");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/exchange-rates"] });
      toast({
        title: t.common.success || "Úspech",
        description: `Aktualizovaných ${data.ratesCount} kurzov`,
      });
    },
    onError: () => {
      toast({
        title: t.common.error || "Chyba",
        description: "Nepodarilo sa aktualizovať kurzy",
        variant: "destructive",
      });
    },
  });
  
  const formatDate = (dateInput: string | Date | null | undefined) => {
    if (!dateInput) return "-";
    const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    return date.toLocaleDateString("sk-SK", { 
      day: "2-digit", 
      month: "2-digit", 
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  
  const rates = ratesData?.rates || [];
  const lastUpdate = ratesData?.lastUpdate;
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          Posledná aktualizácia: {formatDate(lastUpdate)}
        </div>
        <Button 
          onClick={() => refreshMutation.mutate()} 
          disabled={refreshMutation.isPending}
          data-testid="button-refresh-rates"
        >
          {refreshMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Aktualizovať kurzy
        </Button>
      </div>
      
      {rates.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Žiadne kurzy. Kliknite na "Aktualizovať kurzy" pre načítanie.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left py-3 px-4 font-medium">Kód</th>
                <th className="text-left py-3 px-4 font-medium">Názov meny</th>
                <th className="text-right py-3 px-4 font-medium">Kurz (EUR)</th>
                <th className="text-right py-3 px-4 font-medium">Platný od</th>
                <th className="text-right py-3 px-4 font-medium">Aktualizované</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((rate, index) => (
                <tr key={rate.id} className={index % 2 === 0 ? "bg-background" : "bg-muted/30"}>
                  <td className="py-2 px-4 font-mono font-medium">{rate.currencyCode}</td>
                  <td className="py-2 px-4">{rate.currencyName}</td>
                  <td className="py-2 px-4 text-right font-mono">{parseFloat(rate.rate).toFixed(4)}</td>
                  <td className="py-2 px-4 text-right text-muted-foreground">{rate.rateDate}</td>
                  <td className="py-2 px-4 text-right text-muted-foreground text-sm">
                    {formatDate(rate.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      <div className="text-xs text-muted-foreground">
        Kurzy sú automaticky aktualizované denne o polnoci zo stránky NBS.sk (Národná banka Slovenska - ECB kurzy).
      </div>
    </div>
  );
}

interface InflationRate {
  id: string;
  year: number;
  country: string;
  rate: string;
  source: string | null;
  updatedAt: Date | string;
}

const INFLATION_COUNTRIES = [
  { 
    code: "SK", 
    name: "Slovensko",
    source: "Štatistický úrad SR",
    url: "https://slovak.statistics.sk"
  },
  { 
    code: "CZ", 
    name: "Česká republika",
    source: "Český statistický úřad",
    url: "https://csu.gov.cz/inflation-consumer-prices"
  },
  { 
    code: "HU", 
    name: "Maďarsko",
    source: "Központi Statisztikai Hivatal (KSH)",
    url: "https://www.ksh.hu/stadat_infra/konyvtar/katalogus/prices_e.html"
  },
  { 
    code: "RO", 
    name: "Rumunsko",
    source: "Institutul Național de Statistică (INS)",
    url: "https://insse.ro/cms/en/content/consumer-price-indices"
  },
  { 
    code: "IT", 
    name: "Taliansko",
    source: "ISTAT",
    url: "https://www.istat.it/en/prices"
  },
  { 
    code: "DE", 
    name: "Nemecko",
    source: "Statistisches Bundesamt (Destatis)",
    url: "https://www.destatis.de/EN/Themes/Economy/Prices/Consumer-Price-Index/_node.html"
  },
  { 
    code: "US", 
    name: "USA",
    source: "Bureau of Labor Statistics (BLS)",
    url: "https://www.bls.gov/cpi/"
  },
];

function InflationTab() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [selectedCountry, setSelectedCountry] = useState("SK");
  const [editingYear, setEditingYear] = useState<number | null>(null);
  const [editingRate, setEditingRate] = useState("");
  const [newYear, setNewYear] = useState("");
  const [newRate, setNewRate] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  
  const { data: inflationData, isLoading } = useQuery<{ rates: InflationRate[]; lastUpdate: string | null }>({
    queryKey: ["/api/inflation-rates", selectedCountry],
    queryFn: async () => {
      const response = await fetch(`/api/inflation-rates?country=${selectedCountry}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch inflation rates");
      return response.json();
    },
  });
  
  const updateMutation = useMutation({
    mutationFn: async ({ year, rate, country }: { year: number; rate: string; country: string }) => {
      const response = await fetch("/api/inflation-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ year, rate, country }),
      });
      if (!response.ok) throw new Error("Failed to update inflation rate");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inflation-rates", selectedCountry] });
      setEditingYear(null);
      setShowAddForm(false);
      setNewYear("");
      setNewRate("");
      toast({
        title: t.common.success || "Úspech",
        description: t.konfigurator.inflationUpdated || "Miera inflácie bola aktualizovaná",
      });
    },
    onError: () => {
      toast({
        title: t.common.error || "Chyba",
        description: t.konfigurator.inflationUpdateFailed || "Nepodarilo sa aktualizovať mieru inflácie",
        variant: "destructive",
      });
    },
  });
  
  const formatDate = (dateInput: string | Date | null | undefined) => {
    if (!dateInput) return "-";
    const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    return date.toLocaleDateString("sk-SK", { 
      day: "2-digit", 
      month: "2-digit", 
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };
  
  const handleEdit = (year: number, currentRate: string) => {
    setEditingYear(year);
    setEditingRate(currentRate);
  };
  
  const handleSave = () => {
    if (editingYear !== null && editingRate) {
      updateMutation.mutate({ year: editingYear, rate: editingRate, country: selectedCountry });
    }
  };
  
  const handleAdd = () => {
    const year = parseInt(newYear);
    if (year && newRate) {
      updateMutation.mutate({ year, rate: newRate, country: selectedCountry });
    }
  };
  
  const countryName = INFLATION_COUNTRIES.find(c => c.code === selectedCountry)?.name || selectedCountry;
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  
  const rates = inflationData?.rates || [];
  const lastUpdate = inflationData?.lastUpdate;
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Select value={selectedCountry} onValueChange={setSelectedCountry}>
            <SelectTrigger className="w-48" data-testid="select-inflation-country">
              <SelectValue placeholder={t.common.country || "Krajina"} />
            </SelectTrigger>
            <SelectContent>
              {INFLATION_COUNTRIES.map((country) => (
                <SelectItem key={country.code} value={country.code}>
                  {country.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground">
            {t.konfigurator.lastUpdate || "Posledná aktualizácia"}: {formatDate(lastUpdate)}
          </div>
        </div>
        <Button 
          onClick={() => setShowAddForm(!showAddForm)}
          variant={showAddForm ? "outline" : "default"}
          data-testid="button-add-inflation"
        >
          {showAddForm ? t.common.cancel : (t.konfigurator.addInflationYear || "Pridať rok")}
        </Button>
      </div>
      
      {showAddForm && (
        <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/30 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">{t.konfigurator.inflationYear || "Rok"}:</label>
            <Input
              type="number"
              value={newYear}
              onChange={(e) => setNewYear(e.target.value)}
              placeholder="2024"
              className="w-24"
              data-testid="input-new-year"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">{t.konfigurator.inflationRate || "Inflácia (%)"}:</label>
            <Input
              type="number"
              step="0.01"
              value={newRate}
              onChange={(e) => setNewRate(e.target.value)}
              placeholder="5.50"
              className="w-24"
              data-testid="input-new-rate"
            />
          </div>
          <Button 
            onClick={handleAdd}
            disabled={updateMutation.isPending || !newYear || !newRate}
            data-testid="button-save-new-inflation"
          >
            {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t.common.save}
          </Button>
        </div>
      )}
      
      {rates.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {t.konfigurator.noInflationData || "Žiadne údaje o inflácii. Kliknite na \"Pridať rok\" pre zadanie údajov."}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left py-3 px-4 font-medium">{t.konfigurator.inflationYear || "Rok"}</th>
                <th className="text-right py-3 px-4 font-medium">{t.konfigurator.inflationRate || "Miera inflácie (%)"}</th>
                <th className="text-left py-3 px-4 font-medium">{t.konfigurator.inflationSource || "Zdroj"}</th>
                <th className="text-right py-3 px-4 font-medium">{t.konfigurator.updated || "Aktualizované"}</th>
                <th className="text-right py-3 px-4 font-medium">{t.common.actions}</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((rate, index) => (
                <tr key={rate.id} className={index % 2 === 0 ? "bg-background" : "bg-muted/30"}>
                  <td className="py-2 px-4 font-mono font-medium">{rate.year}</td>
                  <td className="py-2 px-4 text-right">
                    {editingYear === rate.year ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={editingRate}
                        onChange={(e) => setEditingRate(e.target.value)}
                        className="w-24 ml-auto"
                        data-testid={`input-edit-rate-${rate.year}`}
                      />
                    ) : (
                      <span className="font-mono">{parseFloat(rate.rate).toFixed(2)} %</span>
                    )}
                  </td>
                  <td className="py-2 px-4 text-muted-foreground">{rate.source || "-"}</td>
                  <td className="py-2 px-4 text-right text-muted-foreground text-sm">
                    {formatDate(rate.updatedAt)}
                  </td>
                  <td className="py-2 px-4 text-right">
                    {editingYear === rate.year ? (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          onClick={handleSave}
                          disabled={updateMutation.isPending}
                          data-testid={`button-save-rate-${rate.year}`}
                        >
                          {updateMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                          {t.common.save}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingYear(null)}
                          data-testid={`button-cancel-rate-${rate.year}`}
                        >
                          {t.common.cancel}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(rate.year, rate.rate)}
                        data-testid={`button-edit-rate-${rate.year}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      <div className="text-xs text-muted-foreground space-y-1">
        <div>{t.konfigurator.inflationManualNote || "Údaje o inflácii je potrebné aktualizovať manuálne."}</div>
        {(() => {
          const countryInfo = INFLATION_COUNTRIES.find(c => c.code === selectedCountry);
          if (countryInfo) {
            return (
              <div>
                {t.konfigurator.inflationSource || "Zdroj"}: {countryInfo.source} - {" "}
                <a 
                  href={countryInfo.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                  data-testid="link-inflation-source"
                >
                  {countryInfo.url}
                </a>
              </div>
            );
          }
          return null;
        })()}
      </div>
    </div>
  );
}

// ============================================
// GSM SENDER TAB
// ============================================

const GSM_COUNTRIES = [
  { code: "SK", name: "Slovensko", flag: "🇸🇰" },
  { code: "CZ", name: "Česko", flag: "🇨🇿" },
  { code: "HU", name: "Maďarsko", flag: "🇭🇺" },
  { code: "RO", name: "Rumunsko", flag: "🇷🇴" },
  { code: "IT", name: "Taliansko", flag: "🇮🇹" },
  { code: "DE", name: "Nemecko", flag: "🇩🇪" },
  { code: "US", name: "USA", flag: "🇺🇸" },
  { code: "CH", name: "Švajčiarsko", flag: "🇨🇭" },
];

function GsmSenderTab() {
  const { toast } = useToast();

  // Query for GSM configs
  const { data: gsmConfigs = [], isLoading: configsLoading } = useQuery<GsmSenderConfig[]>({
    queryKey: ["/api/config/gsm-sender-configs"],
  });

  // Query for BulkGate credit
  const { data: creditInfo, isLoading: creditLoading, refetch: refetchCredit } = useQuery<{ success: boolean; credit?: number; currency?: string; error?: string }>({
    queryKey: ["/api/integrations/bulkgate/credit"],
    staleTime: 60000,
  });

  // Upsert mutation
  const upsertMutation = useMutation({
    mutationFn: async (data: { countryCode: string; senderIdType: string; senderIdValue?: string }) => {
      const res = await apiRequest("POST", "/api/config/gsm-sender-configs", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config/gsm-sender-configs"] });
      toast({ title: "Konfigurácia uložená" });
    },
    onError: () => {
      toast({ title: "Chyba pri ukladaní", variant: "destructive" });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/config/gsm-sender-configs/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config/gsm-sender-configs"] });
      toast({ title: "Konfigurácia odstránená" });
    },
    onError: () => {
      toast({ title: "Chyba pri odstraňovaní", variant: "destructive" });
    },
  });

  // Local state for editing
  const [editingCountry, setEditingCountry] = useState<string | null>(null);
  const [formData, setFormData] = useState<{ senderIdType: string; senderIdValue: string }>({
    senderIdType: "gText",
    senderIdValue: "",
  });

  const handleEdit = (config: GsmSenderConfig) => {
    setEditingCountry(config.countryCode);
    setFormData({
      senderIdType: config.senderIdType,
      senderIdValue: config.senderIdValue || "",
    });
  };

  const handleSave = (countryCode: string) => {
    // Don't send value for sender types that don't need it (gSystem, gShort, gPush)
    const sendValue = needsValue(formData.senderIdType) ? formData.senderIdValue : undefined;
    upsertMutation.mutate({
      countryCode,
      senderIdType: formData.senderIdType,
      senderIdValue: sendValue || undefined,
    });
    setEditingCountry(null);
  };

  const handleAddCountry = (countryCode: string) => {
    setEditingCountry(countryCode);
    setFormData({ senderIdType: "gText", senderIdValue: "CBC" });
  };

  // Handle sender type change - clear value for types that don't need it
  const handleSenderTypeChange = (newType: string) => {
    if (!needsValue(newType)) {
      setFormData({ senderIdType: newType, senderIdValue: "" });
    } else {
      setFormData(prev => ({ ...prev, senderIdType: newType }));
    }
  };

  const getConfigForCountry = (countryCode: string) => 
    gsmConfigs.find(c => c.countryCode === countryCode);

  // Check if sender type needs a value
  const needsValue = (type: string) => {
    const senderType = GSM_SENDER_ID_TYPES.find(t => t.value === type);
    return senderType?.needsValue ?? false;
  };

  return (
    <div className="space-y-6">
      {/* BulkGate Credit Section */}
      <div className="p-4 border rounded-lg bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wallet className="h-5 w-5 text-muted-foreground" />
            <div>
              <h3 className="font-medium">BulkGate Kredit</h3>
              {creditLoading ? (
                <p className="text-sm text-muted-foreground">Načítavam...</p>
              ) : creditInfo?.success ? (
                <p className="text-lg font-semibold text-primary">
                  {creditInfo.credit?.toFixed(2)} {creditInfo.currency}
                </p>
              ) : (
                <p className="text-sm text-destructive">{creditInfo?.error || "Chyba pripojenia"}</p>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchCredit()}
            disabled={creditLoading}
            data-testid="button-refresh-credit"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${creditLoading ? 'animate-spin' : ''}`} />
            Obnoviť
          </Button>
        </div>
      </div>

      {/* Country Sender Configurations */}
      <div>
        <h3 className="font-medium mb-4">Konfigurácia odosielateľa podľa krajiny</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Nastavte typ SMS odosielateľa pre každú krajinu. Táto konfigurácia sa použije pri odosielaní SMS zákazníkom z danej krajiny.
        </p>

        {configsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Krajina</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Typ odosielateľa</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Hodnota</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">Akcie</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {GSM_COUNTRIES.map((country) => {
                  const config = getConfigForCountry(country.code);
                  const isEditing = editingCountry === country.code;

                  return (
                    <tr key={country.code} className="hover-elevate">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{country.flag}</span>
                          <span className="font-medium">{country.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <Select
                            value={formData.senderIdType}
                            onValueChange={handleSenderTypeChange}
                          >
                            <SelectTrigger className="w-48" data-testid={`select-sender-type-${country.code}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {GSM_SENDER_ID_TYPES.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  {type.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : config ? (
                          <span className="text-sm">
                            {GSM_SENDER_ID_TYPES.find(t => t.value === config.senderIdType)?.label || config.senderIdType}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">Nenastavené</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          needsValue(formData.senderIdType) ? (
                            <Input
                              value={formData.senderIdValue}
                              onChange={(e) => setFormData(prev => ({ ...prev, senderIdValue: e.target.value }))}
                              placeholder={formData.senderIdType === "gText" ? "CBC" : formData.senderIdType === "gProfile" ? "ID profilu" : "Telefónne číslo"}
                              className="w-40"
                              data-testid={`input-sender-value-${country.code}`}
                            />
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )
                        ) : config?.senderIdValue ? (
                          <span className="text-sm font-mono">{config.senderIdValue}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSave(country.code)}
                              disabled={upsertMutation.isPending || (needsValue(formData.senderIdType) && !formData.senderIdValue.trim())}
                              data-testid={`button-save-${country.code}`}
                            >
                              {upsertMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingCountry(null)}
                              data-testid={`button-cancel-${country.code}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : config ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleEdit(config)}
                              data-testid={`button-edit-${country.code}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteMutation.mutate(config.id)}
                              disabled={deleteMutation.isPending}
                              data-testid={`button-delete-${country.code}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAddCountry(country.code)}
                            data-testid={`button-add-${country.code}`}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Nastaviť
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// MESSAGE TEMPLATES TAB
// ============================================

interface MessageTemplate {
  id: string;
  name: string;
  description?: string;
  type: "email" | "sms";
  format: "text" | "html";
  subject?: string;
  content?: string;
  contentHtml?: string;
  categoryId?: string;
  language: string;
  tags?: string[];
  isDefault: boolean;
  isActive: boolean;
  usageCount: number;
  createdAt?: string;
  updatedAt?: string;
}

interface TemplateCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  priority: number;
  isActive: boolean;
}

const SYSTEM_VARIABLES = {
  customer: [
    { key: "{{customer.firstName}}", label: "Meno" },
    { key: "{{customer.lastName}}", label: "Priezvisko" },
    { key: "{{customer.fullName}}", label: "Celé meno" },
    { key: "{{customer.email}}", label: "Email" },
    { key: "{{customer.email2}}", label: "Email 2" },
    { key: "{{customer.phone}}", label: "Telefón" },
    { key: "{{customer.phone2}}", label: "Telefón 2" },
    { key: "{{customer.address}}", label: "Adresa" },
    { key: "{{customer.city}}", label: "Mesto" },
    { key: "{{customer.postalCode}}", label: "PSČ" },
    { key: "{{customer.country}}", label: "Krajina" },
    { key: "{{customer.birthDate}}", label: "Dátum narodenia" },
    { key: "{{customer.deliveryDate}}", label: "Dátum pôrodu" },
  ],
  user: [
    { key: "{{user.fullName}}", label: "Meno používateľa" },
    { key: "{{user.email}}", label: "Email používateľa" },
    { key: "{{user.phone}}", label: "Telefón používateľa" },
    { key: "{{user.position}}", label: "Pozícia" },
    { key: "{{user.signature}}", label: "Podpis" },
  ],
  order: [
    { key: "{{order.number}}", label: "Číslo objednávky" },
    { key: "{{order.date}}", label: "Dátum objednávky" },
    { key: "{{order.total}}", label: "Celková suma" },
    { key: "{{order.status}}", label: "Stav objednávky" },
  ],
  contract: [
    { key: "{{contract.number}}", label: "Číslo zmluvy" },
    { key: "{{contract.date}}", label: "Dátum zmluvy" },
    { key: "{{contract.validFrom}}", label: "Platná od" },
    { key: "{{contract.validTo}}", label: "Platná do" },
    { key: "{{contract.amount}}", label: "Suma zmluvy" },
  ],
  invoice: [
    { key: "{{invoice.number}}", label: "Číslo faktúry" },
    { key: "{{invoice.date}}", label: "Dátum faktúry" },
    { key: "{{invoice.dueDate}}", label: "Splatnosť" },
    { key: "{{invoice.amount}}", label: "Suma faktúry" },
  ],
  company: [
    { key: "{{company.name}}", label: "Názov spoločnosti" },
    { key: "{{company.email}}", label: "Email spoločnosti" },
    { key: "{{company.phone}}", label: "Telefón spoločnosti" },
    { key: "{{company.address}}", label: "Adresa spoločnosti" },
    { key: "{{company.website}}", label: "Web stránka" },
  ],
  system: [
    { key: "{{date.today}}", label: "Dnešný dátum" },
    { key: "{{date.tomorrow}}", label: "Zajtrajší dátum" },
    { key: "{{link.unsubscribe}}", label: "Odkaz na odhlásenie" },
    { key: "{{link.portal}}", label: "Odkaz na portál" },
  ],
};

const TEMPLATE_LANGUAGES = [
  { code: "sk", name: "Slovenčina" },
  { code: "cs", name: "Čeština" },
  { code: "en", name: "English" },
  { code: "hu", name: "Magyar" },
  { code: "ro", name: "Română" },
  { code: "it", name: "Italiano" },
  { code: "de", name: "Deutsch" },
];

function MessageTemplatesTab() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [activeSubTab, setActiveSubTab] = useState<"templates" | "categories">("templates");
  
  // Template dialog state
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  
  // Category dialog state
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<TemplateCategory | null>(null);
  
  // Filter state
  const [filterType, setFilterType] = useState<"all" | "email" | "sms">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterLanguage, setFilterLanguage] = useState<string>("all");
  
  // Template form state
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateType, setTemplateType] = useState<"email" | "sms">("email");
  const [templateFormat, setTemplateFormat] = useState<"text" | "html">("text");
  const [templateSubject, setTemplateSubject] = useState("");
  const [templateContent, setTemplateContent] = useState("");
  const [templateContentHtml, setTemplateContentHtml] = useState("");
  const [templateCategoryId, setTemplateCategoryId] = useState("");
  
  // Refs for cursor position tracking
  const quillRef = useRef<ReactQuill>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [templateLanguage, setTemplateLanguage] = useState("sk");
  const [templateTags, setTemplateTags] = useState("");
  const [templateIsDefault, setTemplateIsDefault] = useState(false);
  const [templateIsActive, setTemplateIsActive] = useState(true);
  
  // Category form state
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [categoryIcon, setCategoryIcon] = useState("");
  const [categoryColor, setCategoryColor] = useState("#6B7280");
  const [categoryPriority, setCategoryPriority] = useState(0);
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  
  // Available icons for category selection
  const CATEGORY_ICONS = [
    { name: "Mail", icon: "mail" },
    { name: "MessageSquare", icon: "message-square" },
    { name: "Bell", icon: "bell" },
    { name: "AlertCircle", icon: "alert-circle" },
    { name: "CheckCircle", icon: "check-circle" },
    { name: "Calendar", icon: "calendar" },
    { name: "Clock", icon: "clock" },
    { name: "Star", icon: "star" },
    { name: "Heart", icon: "heart" },
    { name: "User", icon: "user" },
    { name: "Users", icon: "users" },
    { name: "Phone", icon: "phone" },
    { name: "FileText", icon: "file-text" },
    { name: "Folder", icon: "folder" },
    { name: "Send", icon: "send" },
    { name: "Inbox", icon: "inbox" },
    { name: "Archive", icon: "archive" },
    { name: "Bookmark", icon: "bookmark" },
    { name: "Tag", icon: "tag" },
    { name: "Gift", icon: "gift" },
    { name: "CreditCard", icon: "credit-card" },
    { name: "Briefcase", icon: "briefcase" },
    { name: "Building", icon: "building" },
    { name: "ShoppingCart", icon: "shopping-cart" },
    { name: "Truck", icon: "truck" },
    { name: "Package", icon: "package" },
    { name: "Award", icon: "award" },
    { name: "Zap", icon: "zap" },
    { name: "Shield", icon: "shield" },
    { name: "Info", icon: "info" },
  ];

  // Queries
  const { data: templates = [], isLoading: templatesLoading } = useQuery<MessageTemplate[]>({
    queryKey: ["/api/message-templates"],
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<TemplateCategory[]>({
    queryKey: ["/api/template-categories"],
  });

  const { data: emailTags = [] } = useQuery<{ id: string; name: string; color: string }[]>({
    queryKey: ["/api/email-tags"],
  });

  // Template mutations
  const createTemplateMutation = useMutation({
    mutationFn: async (data: Partial<MessageTemplate>) => {
      const res = await apiRequest("POST", "/api/message-templates", data);
      if (!res.ok) throw new Error("Failed to create template");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/message-templates"] });
      toast({ title: t.konfigurator.templateCreated });
      setIsTemplateDialogOpen(false);
      resetTemplateForm();
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<MessageTemplate> }) => {
      const res = await apiRequest("PATCH", `/api/message-templates/${id}`, data);
      if (!res.ok) throw new Error("Failed to update template");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/message-templates"] });
      toast({ title: t.konfigurator.templateUpdated });
      setIsTemplateDialogOpen(false);
      resetTemplateForm();
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/message-templates/${id}`);
      if (!res.ok) throw new Error("Failed to delete template");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/message-templates"] });
      toast({ title: t.konfigurator.templateDeleted });
    },
    onError: () => {
      toast({ title: t.errors.deleteFailed, variant: "destructive" });
    },
  });

  // Category mutations
  const createCategoryMutation = useMutation({
    mutationFn: async (data: Partial<TemplateCategory>) => {
      const res = await apiRequest("POST", "/api/template-categories", data);
      if (!res.ok) throw new Error("Failed to create category");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/template-categories"] });
      toast({ title: t.konfigurator.categoryCreated });
      setIsCategoryDialogOpen(false);
      resetCategoryForm();
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TemplateCategory> }) => {
      const res = await apiRequest("PATCH", `/api/template-categories/${id}`, data);
      if (!res.ok) throw new Error("Failed to update category");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/template-categories"] });
      toast({ title: t.konfigurator.categoryUpdated });
      setIsCategoryDialogOpen(false);
      resetCategoryForm();
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/template-categories/${id}`);
      if (!res.ok) throw new Error("Failed to delete category");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/template-categories"] });
      toast({ title: t.konfigurator.categoryDeleted });
    },
    onError: () => {
      toast({ title: t.errors.deleteFailed, variant: "destructive" });
    },
  });

  const resetTemplateForm = () => {
    setEditingTemplate(null);
    setTemplateName("");
    setTemplateDescription("");
    setTemplateType("email");
    setTemplateFormat("text");
    setTemplateSubject("");
    setTemplateContent("");
    setTemplateContentHtml("");
    setTemplateCategoryId("");
    setTemplateLanguage("sk");
    setTemplateTags("");
    setTemplateIsDefault(false);
    setTemplateIsActive(true);
  };

  const resetCategoryForm = () => {
    setEditingCategory(null);
    setCategoryName("");
    setCategoryDescription("");
    setCategoryIcon("");
    setCategoryColor("#6B7280");
    setCategoryPriority(0);
  };

  const openTemplateDialog = (template?: MessageTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setTemplateName(template.name);
      setTemplateDescription(template.description || "");
      setTemplateType(template.type);
      setTemplateFormat(template.format);
      setTemplateSubject(template.subject || "");
      setTemplateContent(template.content || "");
      setTemplateContentHtml(template.contentHtml || "");
      setTemplateCategoryId(template.categoryId || "");
      setTemplateLanguage(template.language);
      setTemplateTags((template.tags || []).join(", "));
      setTemplateIsDefault(template.isDefault);
      setTemplateIsActive(template.isActive);
    } else {
      resetTemplateForm();
    }
    setIsTemplateDialogOpen(true);
  };

  const openCategoryDialog = (category?: TemplateCategory) => {
    if (category) {
      setEditingCategory(category);
      setCategoryName(category.name);
      setCategoryDescription(category.description || "");
      setCategoryIcon(category.icon || "");
      setCategoryColor(category.color || "#6B7280");
      setCategoryPriority(category.priority);
    } else {
      resetCategoryForm();
    }
    setIsCategoryDialogOpen(true);
  };

  const handleSaveTemplate = () => {
    const tags = templateTags.split(",").map(t => t.trim()).filter(Boolean);
    // For HTML templates, use contentHtml as content fallback if text content is empty
    const contentValue = templateFormat === "html" 
      ? (templateContent || templateContentHtml || " ") 
      : (templateContent || " ");
    const data: Partial<MessageTemplate> = {
      name: templateName,
      description: templateDescription || undefined,
      type: templateType,
      format: templateFormat,
      subject: templateType === "email" ? templateSubject : undefined,
      content: contentValue,
      contentHtml: templateFormat === "html" ? templateContentHtml : undefined,
      categoryId: templateCategoryId || undefined,
      language: templateLanguage,
      tags: tags.length > 0 ? tags : undefined,
      isDefault: templateIsDefault,
      isActive: templateIsActive,
    };
    if (editingTemplate) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, data });
    } else {
      createTemplateMutation.mutate(data);
    }
  };

  const handleSaveCategory = () => {
    const data: Partial<TemplateCategory> = {
      name: categoryName,
      description: categoryDescription || undefined,
      icon: categoryIcon || undefined,
      color: categoryColor,
      priority: categoryPriority,
      isActive: true,
    };
    if (editingCategory) {
      updateCategoryMutation.mutate({ id: editingCategory.id, data });
    } else {
      createCategoryMutation.mutate(data);
    }
  };

  const insertVariable = (variable: string) => {
    if (templateFormat === "html") {
      // Insert at cursor position in Quill editor
      const quill = quillRef.current?.getEditor();
      if (quill) {
        // Focus editor first to ensure we have a valid selection
        quill.focus();
        let selection = quill.getSelection();
        
        if (!selection) {
          // If still no selection after focus, insert at end
          const length = quill.getLength();
          quill.insertText(length - 1, variable);
          quill.setSelection(length - 1 + variable.length, 0);
        } else {
          quill.insertText(selection.index, variable);
          // Move cursor after inserted variable
          quill.setSelection(selection.index + variable.length, 0);
        }
        // Let onChange handler update the state automatically
      } else {
        setTemplateContentHtml(prev => prev + variable);
      }
    } else {
      // Insert at cursor position in textarea
      const textarea = textareaRef.current;
      if (textarea) {
        // Use textarea.value to avoid stale state
        const currentValue = textarea.value;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newContent = currentValue.substring(0, start) + variable + currentValue.substring(end);
        setTemplateContent(newContent);
        // Restore cursor position after variable using requestAnimationFrame
        const newCursorPos = start + variable.length;
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = newCursorPos;
          textarea.focus();
        });
      } else {
        setTemplateContent(prev => prev + variable);
      }
    }
  };

  // Filter templates
  const filteredTemplates = templates.filter(template => {
    if (filterType !== "all" && template.type !== filterType) return false;
    if (filterCategory !== "all" && template.categoryId !== filterCategory) return false;
    if (filterLanguage !== "all" && template.language !== filterLanguage) return false;
    return true;
  });

  const getCategoryName = (categoryId?: string) => {
    if (!categoryId) return "—";
    const category = categories.find(c => c.id === categoryId);
    return category?.name || "—";
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as "templates" | "categories")}>
        <TabsList>
          <TabsTrigger value="templates" data-testid="subtab-templates-list">
            <FileText className="h-4 w-4 mr-2" />
            {t.konfigurator.messageTemplates}
          </TabsTrigger>
          <TabsTrigger value="categories" data-testid="subtab-template-categories">
            <Palette className="h-4 w-4 mr-2" />
            {t.konfigurator.templateCategories}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={filterType} onValueChange={(v) => setFilterType(v as "all" | "email" | "sms")}>
                <SelectTrigger className="w-32" data-testid="select-filter-type">
                  <SelectValue placeholder={t.konfigurator.templateType} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Všetky typy</SelectItem>
                  <SelectItem value="email">{t.konfigurator.typeEmail}</SelectItem>
                  <SelectItem value="sms">{t.konfigurator.typeSms}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-40" data-testid="select-filter-category">
                  <SelectValue placeholder={t.konfigurator.templateCategory} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Všetky kategórie</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterLanguage} onValueChange={setFilterLanguage}>
                <SelectTrigger className="w-36" data-testid="select-filter-language">
                  <SelectValue placeholder={t.konfigurator.templateLanguage} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Všetky jazyky</SelectItem>
                  {TEMPLATE_LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>{lang.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => openTemplateDialog()} data-testid="button-add-template">
              <Plus className="h-4 w-4 mr-2" />
              {t.konfigurator.addMessageTemplate}
            </Button>
          </div>

          {templatesLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              {t.konfigurator.noMessageTemplates}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">{t.konfigurator.templateName}</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">{t.konfigurator.templateType}</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">{t.konfigurator.templateCategory}</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">{t.konfigurator.templateLanguage}</th>
                    <th className="px-4 py-3 text-center text-sm font-medium">{t.konfigurator.templateIsDefault}</th>
                    <th className="px-4 py-3 text-center text-sm font-medium">{t.konfigurator.templateUsageCount}</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Akcie</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredTemplates.map((template) => (
                    <tr key={template.id} className={`hover-elevate ${!template.isActive ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div>
                          <span className="font-medium">{template.name}</span>
                          {template.description && (
                            <p className="text-xs text-muted-foreground">{template.description}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={template.type === "email" ? "default" : "secondary"}>
                          {template.type === "email" ? <Mail className="h-3 w-3 mr-1" /> : <Smartphone className="h-3 w-3 mr-1" />}
                          {template.type === "email" ? t.konfigurator.typeEmail : t.konfigurator.typeSms}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {getCategoryName(template.categoryId)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {TEMPLATE_LANGUAGES.find(l => l.code === template.language)?.name || template.language}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {template.isDefault && <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />}
                      </td>
                      <td className="px-4 py-3 text-center text-sm">
                        {template.usageCount || 0}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="icon" variant="ghost" onClick={() => openTemplateDialog(template)} data-testid={`button-edit-template-${template.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => deleteTemplateMutation.mutate(template.id)} data-testid={`button-delete-template-${template.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {t.konfigurator.templateCategoriesDescription}
            </p>
            <Button onClick={() => openCategoryDialog()} data-testid="button-add-category">
              <Plus className="h-4 w-4 mr-2" />
              {t.konfigurator.addCategory}
            </Button>
          </div>

          {categoriesLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              {t.konfigurator.noCategories}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {categories.map((category) => (
                <Card key={category.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm"
                          style={{ backgroundColor: category.color }}
                        >
                          {category.icon || category.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-medium">{category.name}</h4>
                          {category.description && (
                            <p className="text-xs text-muted-foreground">{category.description}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {t.konfigurator.categoryPriority}: {category.priority}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openCategoryDialog(category)} data-testid={`button-edit-category-${category.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteCategoryMutation.mutate(category.id)} data-testid={`button-delete-category-${category.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Template Dialog */}
      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? t.konfigurator.editMessageTemplate : t.konfigurator.addMessageTemplate}
            </DialogTitle>
            <DialogDescription>
              {t.konfigurator.messageTemplatesDescription}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t.konfigurator.templateName}</Label>
                <Input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder={t.konfigurator.templateName}
                  data-testid="input-template-name"
                />
              </div>
              <div className="space-y-2">
                <Label>{t.konfigurator.templateLanguage}</Label>
                <Select value={templateLanguage} onValueChange={setTemplateLanguage}>
                  <SelectTrigger data-testid="select-template-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_LANGUAGES.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>{lang.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t.konfigurator.templateDescription}</Label>
              <Textarea
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder={t.konfigurator.templateDescription}
                rows={2}
                data-testid="input-template-description"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t.konfigurator.templateType}</Label>
                <Select value={templateType} onValueChange={(v) => setTemplateType(v as "email" | "sms")}>
                  <SelectTrigger data-testid="select-template-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">{t.konfigurator.typeEmail}</SelectItem>
                    <SelectItem value="sms">{t.konfigurator.typeSms}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t.konfigurator.templateFormat}</Label>
                <Select value={templateFormat} onValueChange={(v) => setTemplateFormat(v as "text" | "html")}>
                  <SelectTrigger data-testid="select-template-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">{t.konfigurator.formatText}</SelectItem>
                    <SelectItem value="html">{t.konfigurator.formatHtml}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t.konfigurator.templateCategory}</Label>
                <Select value={templateCategoryId} onValueChange={setTemplateCategoryId}>
                  <SelectTrigger data-testid="select-template-category">
                    <SelectValue placeholder={t.konfigurator.selectCategory} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {templateType === "email" && (
              <div className="space-y-2">
                <Label>{t.konfigurator.templateSubject}</Label>
                <Input
                  value={templateSubject}
                  onChange={(e) => setTemplateSubject(e.target.value)}
                  placeholder={t.konfigurator.templateSubject}
                  data-testid="input-template-subject"
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{templateFormat === "html" ? t.konfigurator.templateContentHtml : t.konfigurator.templateContent}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="button-insert-variable">
                      <Hash className="h-4 w-4 mr-2" />
                      {t.konfigurator.insertVariable}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[500px] z-[10001]" align="end">
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm">{t.konfigurator.availableVariables}</h4>
                      <div className="grid grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2">
                        {Object.entries(SYSTEM_VARIABLES).map(([category, variables]) => (
                          <div key={category} className="space-y-1">
                            <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b pb-1">
                              {category === "customer" ? t.customers.title :
                               category === "user" ? t.users.title :
                               category === "order" ? t.konfigurator.order :
                               category === "contract" ? t.nav.contracts :
                               category === "invoice" ? t.nav.invoices :
                               category === "company" ? t.konfigurator.company :
                               t.konfigurator.system}
                            </h5>
                            {variables.map((variable) => (
                              <Button
                                key={variable.key}
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start text-xs font-mono h-7 px-2"
                                onClick={() => insertVariable(variable.key)}
                                data-testid={`button-variable-${variable.key}`}
                              >
                                <span className="truncate flex-1 text-left">{variable.label}</span>
                              </Button>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              {templateFormat === "html" ? (
                <div className="border rounded-md" data-testid="input-template-content-html">
                  <ReactQuill
                    ref={quillRef}
                    theme="snow"
                    value={templateContentHtml}
                    onChange={setTemplateContentHtml}
                    modules={{
                      toolbar: [
                        [{ header: [1, 2, 3, false] }],
                        ["bold", "italic", "underline", "strike"],
                        [{ color: [] }, { background: [] }],
                        [{ list: "ordered" }, { list: "bullet" }],
                        [{ align: [] }],
                        ["link", "image"],
                        ["clean"],
                      ],
                    }}
                    formats={[
                      "header",
                      "bold", "italic", "underline", "strike",
                      "color", "background",
                      "list", "bullet",
                      "align",
                      "link", "image",
                    ]}
                    placeholder={t.konfigurator.templateContentHtml}
                    style={{ minHeight: "200px" }}
                  />
                </div>
              ) : (
                <Textarea
                  ref={textareaRef}
                  value={templateContent}
                  onChange={(e) => setTemplateContent(e.target.value)}
                  placeholder={t.konfigurator.templateContent}
                  rows={6}
                  data-testid="input-template-content"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label>{t.konfigurator.selectEmailTags}</Label>
              <div className="flex flex-wrap gap-2 p-3 border rounded-md min-h-[42px]">
                {emailTags.length === 0 ? (
                  <span className="text-sm text-muted-foreground">{t.common.noData}</span>
                ) : (
                  emailTags.map((tag) => {
                    const isSelected = templateTags.split(",").map(t => t.trim()).includes(tag.name);
                    return (
                      <Badge
                        key={tag.id}
                        variant={isSelected ? "default" : "outline"}
                        className="cursor-pointer"
                        style={isSelected ? { backgroundColor: tag.color } : {}}
                        onClick={() => {
                          const currentTags = templateTags.split(",").map(t => t.trim()).filter(Boolean);
                          if (isSelected) {
                            setTemplateTags(currentTags.filter(t => t !== tag.name).join(", "));
                          } else {
                            setTemplateTags([...currentTags, tag.name].join(", "));
                          }
                        }}
                        data-testid={`badge-tag-${tag.id}`}
                      >
                        {tag.name}
                      </Badge>
                    );
                  })
                )}
              </div>
              {templateTags && (
                <p className="text-xs text-muted-foreground">{templateTags}</p>
              )}
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={templateIsDefault}
                  onCheckedChange={setTemplateIsDefault}
                  data-testid="switch-template-default"
                />
                <Label>{t.konfigurator.templateIsDefault}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={templateIsActive}
                  onCheckedChange={setTemplateIsActive}
                  data-testid="switch-template-active"
                />
                <Label>{t.konfigurator.templateIsActive}</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTemplateDialogOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button
              onClick={handleSaveTemplate}
              disabled={!templateName || createTemplateMutation.isPending || updateTemplateMutation.isPending}
              data-testid="button-save-template"
            >
              {(createTemplateMutation.isPending || updateTemplateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? t.konfigurator.editCategory : t.konfigurator.addCategory}
            </DialogTitle>
            <DialogDescription>
              {t.konfigurator.templateCategoriesDescription}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t.konfigurator.categoryName}</Label>
              <Input
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder={t.konfigurator.categoryName}
                data-testid="input-category-name"
              />
            </div>
            <div className="space-y-2">
              <Label>{t.konfigurator.categoryDescription}</Label>
              <Textarea
                value={categoryDescription}
                onChange={(e) => setCategoryDescription(e.target.value)}
                placeholder={t.konfigurator.categoryDescription}
                rows={2}
                data-testid="input-category-description"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t.konfigurator.categoryIcon}</Label>
                <Popover open={isIconPickerOpen} onOpenChange={setIsIconPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      data-testid="button-select-icon"
                    >
                      {categoryIcon ? (
                        <span className="flex items-center gap-2">
                          {categoryIcon === "mail" && <Mail className="h-4 w-4" />}
                          {categoryIcon === "message-square" && <MessageSquare className="h-4 w-4" />}
                          {categoryIcon === "bell" && <Bell className="h-4 w-4" />}
                          {categoryIcon === "alert-circle" && <AlertTriangle className="h-4 w-4" />}
                          {categoryIcon === "check-circle" && <CheckCircle2 className="h-4 w-4" />}
                          {categoryIcon === "calendar" && <Calendar className="h-4 w-4" />}
                          {categoryIcon === "clock" && <Clock className="h-4 w-4" />}
                          {categoryIcon === "star" && <Star className="h-4 w-4" />}
                          {categoryIcon === "heart" && <Heart className="h-4 w-4" />}
                          {categoryIcon === "user" && <User className="h-4 w-4" />}
                          {categoryIcon === "users" && <Users className="h-4 w-4" />}
                          {categoryIcon === "phone" && <Phone className="h-4 w-4" />}
                          {categoryIcon === "file-text" && <FileText className="h-4 w-4" />}
                          {categoryIcon === "folder" && <Folder className="h-4 w-4" />}
                          {categoryIcon === "send" && <Send className="h-4 w-4" />}
                          {categoryIcon === "inbox" && <Inbox className="h-4 w-4" />}
                          {categoryIcon === "archive" && <Archive className="h-4 w-4" />}
                          {categoryIcon === "bookmark" && <Bookmark className="h-4 w-4" />}
                          {categoryIcon === "tag" && <Tag className="h-4 w-4" />}
                          {categoryIcon === "gift" && <Gift className="h-4 w-4" />}
                          {categoryIcon === "credit-card" && <CreditCard className="h-4 w-4" />}
                          {categoryIcon === "briefcase" && <Briefcase className="h-4 w-4" />}
                          {categoryIcon === "building" && <Building className="h-4 w-4" />}
                          {categoryIcon === "shopping-cart" && <ShoppingCart className="h-4 w-4" />}
                          {categoryIcon === "truck" && <Truck className="h-4 w-4" />}
                          {categoryIcon === "package" && <Package className="h-4 w-4" />}
                          {categoryIcon === "award" && <Award className="h-4 w-4" />}
                          {categoryIcon === "zap" && <Zap className="h-4 w-4" />}
                          {categoryIcon === "shield" && <Shield className="h-4 w-4" />}
                          {categoryIcon === "info" && <Info className="h-4 w-4" />}
                          <span className="text-sm">{categoryIcon}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{t.konfigurator.selectIcon}</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-2 z-[10001]" align="start">
                    <div className="grid grid-cols-6 gap-1">
                      {CATEGORY_ICONS.map((iconItem) => (
                        <Button
                          key={iconItem.icon}
                          variant={categoryIcon === iconItem.icon ? "secondary" : "ghost"}
                          size="icon"
                          className="h-9 w-9"
                          onClick={() => {
                            setCategoryIcon(iconItem.icon);
                            setIsIconPickerOpen(false);
                          }}
                          data-testid={`button-icon-${iconItem.icon}`}
                        >
                          {iconItem.icon === "mail" && <Mail className="h-4 w-4" />}
                          {iconItem.icon === "message-square" && <MessageSquare className="h-4 w-4" />}
                          {iconItem.icon === "bell" && <Bell className="h-4 w-4" />}
                          {iconItem.icon === "alert-circle" && <AlertTriangle className="h-4 w-4" />}
                          {iconItem.icon === "check-circle" && <CheckCircle2 className="h-4 w-4" />}
                          {iconItem.icon === "calendar" && <Calendar className="h-4 w-4" />}
                          {iconItem.icon === "clock" && <Clock className="h-4 w-4" />}
                          {iconItem.icon === "star" && <Star className="h-4 w-4" />}
                          {iconItem.icon === "heart" && <Heart className="h-4 w-4" />}
                          {iconItem.icon === "user" && <User className="h-4 w-4" />}
                          {iconItem.icon === "users" && <Users className="h-4 w-4" />}
                          {iconItem.icon === "phone" && <Phone className="h-4 w-4" />}
                          {iconItem.icon === "file-text" && <FileText className="h-4 w-4" />}
                          {iconItem.icon === "folder" && <Folder className="h-4 w-4" />}
                          {iconItem.icon === "send" && <Send className="h-4 w-4" />}
                          {iconItem.icon === "inbox" && <Inbox className="h-4 w-4" />}
                          {iconItem.icon === "archive" && <Archive className="h-4 w-4" />}
                          {iconItem.icon === "bookmark" && <Bookmark className="h-4 w-4" />}
                          {iconItem.icon === "tag" && <Tag className="h-4 w-4" />}
                          {iconItem.icon === "gift" && <Gift className="h-4 w-4" />}
                          {iconItem.icon === "credit-card" && <CreditCard className="h-4 w-4" />}
                          {iconItem.icon === "briefcase" && <Briefcase className="h-4 w-4" />}
                          {iconItem.icon === "building" && <Building className="h-4 w-4" />}
                          {iconItem.icon === "shopping-cart" && <ShoppingCart className="h-4 w-4" />}
                          {iconItem.icon === "truck" && <Truck className="h-4 w-4" />}
                          {iconItem.icon === "package" && <Package className="h-4 w-4" />}
                          {iconItem.icon === "award" && <Award className="h-4 w-4" />}
                          {iconItem.icon === "zap" && <Zap className="h-4 w-4" />}
                          {iconItem.icon === "shield" && <Shield className="h-4 w-4" />}
                          {iconItem.icon === "info" && <Info className="h-4 w-4" />}
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>{t.konfigurator.categoryColor}</Label>
                <Input
                  type="color"
                  value={categoryColor}
                  onChange={(e) => setCategoryColor(e.target.value)}
                  data-testid="input-category-color"
                />
              </div>
              <div className="space-y-2">
                <Label>{t.konfigurator.categoryPriority}</Label>
                <Input
                  type="number"
                  value={categoryPriority}
                  onChange={(e) => setCategoryPriority(parseInt(e.target.value) || 0)}
                  data-testid="input-category-priority"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button
              onClick={handleSaveCategory}
              disabled={!categoryName || createCategoryMutation.isPending || updateCategoryMutation.isPending}
              data-testid="button-save-category"
            >
              {(createCategoryMutation.isPending || updateCategoryMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================
// EMAIL ROUTER TAB
// ============================================

const CONDITION_OPERATORS = [
  { value: "equals", label: "Rovná sa" },
  { value: "contains", label: "Obsahuje" },
  { value: "starts_with", label: "Začína na" },
  { value: "ends_with", label: "Končí na" },
  { value: "regex", label: "Regex" },
] as const;

function EmailRouterTab() {
  const { toast } = useToast();
  const [selectedRule, setSelectedRule] = useState<EmailRoutingRule | null>(null);
  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);
  const [isTagDialogOpen, setIsTagDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<EmailTag | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"rules" | "tags">("rules");

  // Rule form state
  const [ruleName, setRuleName] = useState("");
  const [ruleDescription, setRuleDescription] = useState("");
  const [rulePriority, setRulePriority] = useState(0);
  const [ruleMatchMode, setRuleMatchMode] = useState<"all" | "any">("all");
  const [ruleStopProcessing, setRuleStopProcessing] = useState(false);
  const [ruleAutoAssignCustomer, setRuleAutoAssignCustomer] = useState(true);
  const [ruleEnableAiAnalysis, setRuleEnableAiAnalysis] = useState(false);
  const [ruleAiPipelineActions, setRuleAiPipelineActions] = useState<{
    onAngryTone?: { enabled: boolean; stageId: string };
    onRudeExpressions?: { enabled: boolean; stageId: string };
    onWantsToCancel?: { enabled: boolean; stageId: string };
    onWantsConsent?: { enabled: boolean; stageId: string };
    onDoesNotAcceptContract?: { enabled: boolean; stageId: string };
  }>({});
  const [ruleConditions, setRuleConditions] = useState<{type: string; operator: string; value: string}[]>([]);
  const [ruleActions, setRuleActions] = useState<{type: string; value: string}[]>([]);

  // Tag form state
  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState("#6B7280");
  const [tagDescription, setTagDescription] = useState("");

  const { data: rules = [], isLoading: rulesLoading } = useQuery<EmailRoutingRule[]>({
    queryKey: ["/api/email-routing-rules"],
  });

  const { data: tags = [], isLoading: tagsLoading } = useQuery<EmailTag[]>({
    queryKey: ["/api/email-tags"],
  });

  // Fetch all pipeline stages for AI automation
  const { data: allPipelineStages = [] } = useQuery<{ id: string; name: string; pipelineId: string; pipeline?: { name: string } }[]>({
    queryKey: ["/api/pipeline-stages"],
    queryFn: async () => {
      const res = await fetch("/api/pipeline-stages", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createRuleMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/email-routing-rules", data);
      if (!res.ok) throw new Error("Failed to create rule");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-routing-rules"] });
      toast({ title: "Pravidlo bolo vytvorené" });
      setIsRuleDialogOpen(false);
      resetRuleForm();
    },
    onError: () => {
      toast({ title: "Nepodarilo sa vytvoriť pravidlo", variant: "destructive" });
    },
  });

  const updateRuleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/email-routing-rules/${id}`, data);
      if (!res.ok) throw new Error("Failed to update rule");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-routing-rules"] });
      toast({ title: "Pravidlo bolo aktualizované" });
      setIsRuleDialogOpen(false);
      resetRuleForm();
    },
    onError: () => {
      toast({ title: "Nepodarilo sa aktualizovať pravidlo", variant: "destructive" });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/email-routing-rules/${id}`);
      if (!res.ok) throw new Error("Failed to delete rule");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-routing-rules"] });
      toast({ title: "Pravidlo bolo vymazané" });
    },
    onError: () => {
      toast({ title: "Nepodarilo sa vymazať pravidlo", variant: "destructive" });
    },
  });

  const toggleRuleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("POST", `/api/email-routing-rules/${id}/toggle`, { isActive });
      if (!res.ok) throw new Error("Failed to toggle rule");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-routing-rules"] });
    },
  });

  const createTagMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/email-tags", data);
      if (!res.ok) throw new Error("Failed to create tag");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-tags"] });
      toast({ title: "Tag bol vytvorený" });
      setIsTagDialogOpen(false);
      resetTagForm();
    },
    onError: () => {
      toast({ title: "Nepodarilo sa vytvoriť tag", variant: "destructive" });
    },
  });

  const updateTagMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/email-tags/${id}`, data);
      if (!res.ok) throw new Error("Failed to update tag");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-tags"] });
      toast({ title: "Tag bol aktualizovaný" });
      setIsTagDialogOpen(false);
      resetTagForm();
    },
    onError: () => {
      toast({ title: "Nepodarilo sa aktualizovať tag", variant: "destructive" });
    },
  });

  const deleteTagMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/email-tags/${id}`);
      if (!res.ok) throw new Error("Failed to delete tag");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-tags"] });
      toast({ title: "Tag bol vymazaný" });
    },
    onError: () => {
      toast({ title: "Nepodarilo sa vymazať tag", variant: "destructive" });
    },
  });

  const resetRuleForm = () => {
    setSelectedRule(null);
    setRuleName("");
    setRuleDescription("");
    setRulePriority(0);
    setRuleMatchMode("all");
    setRuleStopProcessing(false);
    setRuleAutoAssignCustomer(true);
    setRuleEnableAiAnalysis(false);
    setRuleAiPipelineActions({});
    setRuleConditions([]);
    setRuleActions([]);
  };

  const resetTagForm = () => {
    setEditingTag(null);
    setTagName("");
    setTagColor("#6B7280");
    setTagDescription("");
  };

  const openRuleDialog = (rule?: EmailRoutingRule) => {
    if (rule) {
      setSelectedRule(rule);
      setRuleName(rule.name);
      setRuleDescription(rule.description || "");
      setRulePriority(rule.priority);
      setRuleMatchMode(rule.matchMode as "all" | "any");
      setRuleStopProcessing(rule.stopProcessing);
      setRuleAutoAssignCustomer(rule.autoAssignCustomer ?? true);
      setRuleEnableAiAnalysis(rule.enableAiAnalysis ?? false);
      setRuleAiPipelineActions((rule.aiPipelineActions as any) || {});
      setRuleConditions((rule.conditions as any[]) || []);
      setRuleActions((rule.actions as any[]) || []);
    } else {
      resetRuleForm();
    }
    setIsRuleDialogOpen(true);
  };

  const openTagDialog = (tag?: EmailTag) => {
    if (tag) {
      setEditingTag(tag);
      setTagName(tag.name);
      setTagColor(tag.color);
      setTagDescription(tag.description || "");
    } else {
      resetTagForm();
    }
    setIsTagDialogOpen(true);
  };

  const handleSaveRule = () => {
    // Validate pipeline actions - if enabled, must have a stage selected
    if (ruleEnableAiAnalysis) {
      const invalidTriggers: string[] = [];
      const triggerLabels: Record<string, string> = {
        onAngryTone: "Nahnevaný tón",
        onRudeExpressions: "Hrubé výrazy",
        onWantsToCancel: "Chce zrušiť zmluvu",
        onWantsConsent: "Chce dať súhlas",
        onDoesNotAcceptContract: "Neakceptuje zmluvu",
      };
      
      for (const [key, config] of Object.entries(ruleAiPipelineActions)) {
        if (config?.enabled && !config?.stageId) {
          invalidTriggers.push(triggerLabels[key] || key);
        }
      }
      
      if (invalidTriggers.length > 0) {
        toast({ 
          title: "Chýba výber fázy pipeline", 
          description: `Prosím vyberte fázu pre: ${invalidTriggers.join(", ")}`,
          variant: "destructive" 
        });
        return;
      }
    }

    // Clean up aiPipelineActions - only include enabled triggers with valid stageId
    const cleanedAiPipelineActions: typeof ruleAiPipelineActions = {};
    for (const [key, config] of Object.entries(ruleAiPipelineActions)) {
      if (config?.enabled && config?.stageId) {
        (cleanedAiPipelineActions as any)[key] = config;
      }
    }

    const data = {
      name: ruleName,
      description: ruleDescription,
      priority: rulePriority,
      matchMode: ruleMatchMode,
      stopProcessing: ruleStopProcessing,
      autoAssignCustomer: ruleAutoAssignCustomer,
      enableAiAnalysis: ruleEnableAiAnalysis,
      aiPipelineActions: Object.keys(cleanedAiPipelineActions).length > 0 ? cleanedAiPipelineActions : null,
      conditions: ruleConditions,
      actions: ruleActions,
      isActive: true,
    };
    if (selectedRule) {
      updateRuleMutation.mutate({ id: selectedRule.id, data });
    } else {
      createRuleMutation.mutate(data);
    }
  };

  const handleSaveTag = () => {
    const data = { name: tagName, color: tagColor, description: tagDescription };
    if (editingTag) {
      updateTagMutation.mutate({ id: editingTag.id, data });
    } else {
      createTagMutation.mutate(data);
    }
  };

  const addCondition = () => {
    setRuleConditions([...ruleConditions, { type: "sender_email", operator: "contains", value: "" }]);
  };

  const removeCondition = (index: number) => {
    setRuleConditions(ruleConditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, field: string, value: string) => {
    const updated = [...ruleConditions];
    (updated[index] as any)[field] = value;
    setRuleConditions(updated);
  };

  const addAction = () => {
    setRuleActions([...ruleActions, { type: "set_priority", value: "normal" }]);
  };

  const removeAction = (index: number) => {
    setRuleActions(ruleActions.filter((_, i) => i !== index));
  };

  const updateAction = (index: number, field: string, value: string) => {
    const updated = [...ruleActions];
    (updated[index] as any)[field] = value;
    setRuleActions(updated);
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as "rules" | "tags")}>
        <TabsList>
          <TabsTrigger value="rules" data-testid="subtab-rules">
            <Settings className="h-4 w-4 mr-2" />
            Pravidlá routera
          </TabsTrigger>
          <TabsTrigger value="tags" data-testid="subtab-tags">
            <Palette className="h-4 w-4 mr-2" />
            Email tagy
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Pravidlá sa aplikujú na prichádzajúce emaily podľa priority (vyššie číslo = vyššia priorita)
            </p>
            <Button onClick={() => openRuleDialog()} data-testid="button-add-rule">
              <Plus className="h-4 w-4 mr-2" />
              Pridať pravidlo
            </Button>
          </div>

          {rulesLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : rules.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              Zatiaľ nie sú definované žiadne pravidlá
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map((rule) => (
                <Card key={rule.id} className={`${!rule.isActive ? 'opacity-50' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Switch
                          checked={rule.isActive}
                          onCheckedChange={(checked) => toggleRuleMutation.mutate({ id: rule.id, isActive: checked })}
                          data-testid={`switch-rule-${rule.id}`}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{rule.name}</span>
                            <Badge variant="outline">Priorita: {rule.priority}</Badge>
                            <Badge variant="secondary">{rule.matchMode === "all" ? "Všetky podmienky" : "Ľubovoľná podmienka"}</Badge>
                          </div>
                          {rule.description && (
                            <p className="text-sm text-muted-foreground">{rule.description}</p>
                          )}
                          <div className="flex gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {(rule.conditions as any[])?.length || 0} podmienok,{" "}
                              {(rule.actions as any[])?.length || 0} akcií
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="icon" variant="ghost" onClick={() => openRuleDialog(rule)} data-testid={`button-edit-rule-${rule.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteRuleMutation.mutate(rule.id)} data-testid={`button-delete-rule-${rule.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tags" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Vlastné tagy pre kategorizáciu a filtrovanie emailov
            </p>
            <Button onClick={() => openTagDialog()} data-testid="button-add-tag">
              <Plus className="h-4 w-4 mr-2" />
              Pridať tag
            </Button>
          </div>

          {tagsLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : tags.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              Zatiaľ nie sú definované žiadne tagy
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Badge
                  key={tag.id}
                  style={{ backgroundColor: tag.color, color: "#fff" }}
                  className="px-3 py-1.5 cursor-pointer hover-elevate"
                  onClick={() => openTagDialog(tag)}
                  data-testid={`tag-${tag.id}`}
                >
                  {tag.name}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-4 w-4 ml-2 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteTagMutation.mutate(tag.id);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Rule Dialog */}
      <Dialog open={isRuleDialogOpen} onOpenChange={setIsRuleDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedRule ? "Upraviť pravidlo" : "Nové pravidlo"}</DialogTitle>
            <DialogDescription>
              Definujte podmienky a akcie pre spracovanie prichádzajúcich emailov
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Názov pravidla</Label>
                <Input
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="Napr. Emaily od zákazníkov"
                  data-testid="input-rule-name"
                />
              </div>
              <div>
                <Label>Priorita (vyššia = skôr)</Label>
                <Input
                  type="number"
                  value={rulePriority}
                  onChange={(e) => setRulePriority(parseInt(e.target.value) || 0)}
                  data-testid="input-rule-priority"
                />
              </div>
            </div>

            <div>
              <Label>Popis</Label>
              <Textarea
                value={ruleDescription}
                onChange={(e) => setRuleDescription(e.target.value)}
                placeholder="Voliteľný popis pravidla"
                data-testid="input-rule-description"
              />
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Label>Režim zhody:</Label>
                <Select value={ruleMatchMode} onValueChange={(v) => setRuleMatchMode(v as "all" | "any")}>
                  <SelectTrigger className="w-[200px]" data-testid="select-match-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Všetky podmienky (AND)</SelectItem>
                    <SelectItem value="any">Ľubovoľná podmienka (OR)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={ruleStopProcessing}
                  onCheckedChange={setRuleStopProcessing}
                  data-testid="switch-stop-processing"
                />
                <Label>Zastaviť po tomto pravidle</Label>
              </div>
            </div>

            <Separator />

            {/* Customer Assignment & AI Analysis */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Automatizácia</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                  <Switch
                    checked={ruleAutoAssignCustomer}
                    onCheckedChange={setRuleAutoAssignCustomer}
                    data-testid="switch-auto-assign-customer"
                  />
                  <div className="space-y-1">
                    <Label className="font-medium">Automatické priradenie zákazníkovi</Label>
                    <p className="text-xs text-muted-foreground">
                      Emaily sa automaticky priradia do histórie zákazníka podľa emailovej adresy
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                  <Switch
                    checked={ruleEnableAiAnalysis}
                    onCheckedChange={setRuleEnableAiAnalysis}
                    data-testid="switch-enable-ai-analysis"
                  />
                  <div className="space-y-1">
                    <Label className="font-medium">AI analýza obsahu</Label>
                    <p className="text-xs text-muted-foreground">
                      Detekcia nahnevaného tónu, hrubých výrazov a zámerov zákazníka pomocou AI
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Pipeline Automation - only show when AI analysis is enabled */}
            {ruleEnableAiAnalysis && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div>
                    <Label className="text-base font-semibold">Pipeline automatizácia</Label>
                    <p className="text-sm text-muted-foreground">
                      Automaticky presunúť zákazníka do konkrétnej fázy pipeline na základe AI analýzy emailu
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    {/* Angry Tone */}
                    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                      <Switch
                        checked={ruleAiPipelineActions.onAngryTone?.enabled || false}
                        onCheckedChange={(checked) => setRuleAiPipelineActions(prev => ({
                          ...prev,
                          onAngryTone: { enabled: checked, stageId: prev.onAngryTone?.stageId || "" }
                        }))}
                        data-testid="switch-pipeline-angry-tone"
                      />
                      <div className="flex-1 space-y-2">
                        <Label className="font-medium">Nahnevaný tón</Label>
                        {ruleAiPipelineActions.onAngryTone?.enabled && (
                          <Select 
                            value={ruleAiPipelineActions.onAngryTone?.stageId || ""} 
                            onValueChange={(v) => setRuleAiPipelineActions(prev => ({
                              ...prev,
                              onAngryTone: { enabled: true, stageId: v }
                            }))}
                          >
                            <SelectTrigger className="w-full" data-testid="select-pipeline-angry-stage">
                              <SelectValue placeholder="Vybrať fázu pipeline..." />
                            </SelectTrigger>
                            <SelectContent>
                              {allPipelineStages.map(stage => (
                                <SelectItem key={stage.id} value={stage.id}>
                                  {stage.pipeline?.name ? `${stage.pipeline.name} → ` : ""}{stage.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>

                    {/* Rude Expressions */}
                    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                      <Switch
                        checked={ruleAiPipelineActions.onRudeExpressions?.enabled || false}
                        onCheckedChange={(checked) => setRuleAiPipelineActions(prev => ({
                          ...prev,
                          onRudeExpressions: { enabled: checked, stageId: prev.onRudeExpressions?.stageId || "" }
                        }))}
                        data-testid="switch-pipeline-rude-expressions"
                      />
                      <div className="flex-1 space-y-2">
                        <Label className="font-medium">Hrubé výrazy</Label>
                        {ruleAiPipelineActions.onRudeExpressions?.enabled && (
                          <Select 
                            value={ruleAiPipelineActions.onRudeExpressions?.stageId || ""} 
                            onValueChange={(v) => setRuleAiPipelineActions(prev => ({
                              ...prev,
                              onRudeExpressions: { enabled: true, stageId: v }
                            }))}
                          >
                            <SelectTrigger className="w-full" data-testid="select-pipeline-rude-stage">
                              <SelectValue placeholder="Vybrať fázu pipeline..." />
                            </SelectTrigger>
                            <SelectContent>
                              {allPipelineStages.map(stage => (
                                <SelectItem key={stage.id} value={stage.id}>
                                  {stage.pipeline?.name ? `${stage.pipeline.name} → ` : ""}{stage.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>

                    {/* Wants to Cancel */}
                    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                      <Switch
                        checked={ruleAiPipelineActions.onWantsToCancel?.enabled || false}
                        onCheckedChange={(checked) => setRuleAiPipelineActions(prev => ({
                          ...prev,
                          onWantsToCancel: { enabled: checked, stageId: prev.onWantsToCancel?.stageId || "" }
                        }))}
                        data-testid="switch-pipeline-wants-cancel"
                      />
                      <div className="flex-1 space-y-2">
                        <Label className="font-medium">Chce zrušiť zmluvu</Label>
                        {ruleAiPipelineActions.onWantsToCancel?.enabled && (
                          <Select 
                            value={ruleAiPipelineActions.onWantsToCancel?.stageId || ""} 
                            onValueChange={(v) => setRuleAiPipelineActions(prev => ({
                              ...prev,
                              onWantsToCancel: { enabled: true, stageId: v }
                            }))}
                          >
                            <SelectTrigger className="w-full" data-testid="select-pipeline-cancel-stage">
                              <SelectValue placeholder="Vybrať fázu pipeline..." />
                            </SelectTrigger>
                            <SelectContent>
                              {allPipelineStages.map(stage => (
                                <SelectItem key={stage.id} value={stage.id}>
                                  {stage.pipeline?.name ? `${stage.pipeline.name} → ` : ""}{stage.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>

                    {/* Wants Consent */}
                    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                      <Switch
                        checked={ruleAiPipelineActions.onWantsConsent?.enabled || false}
                        onCheckedChange={(checked) => setRuleAiPipelineActions(prev => ({
                          ...prev,
                          onWantsConsent: { enabled: checked, stageId: prev.onWantsConsent?.stageId || "" }
                        }))}
                        data-testid="switch-pipeline-wants-consent"
                      />
                      <div className="flex-1 space-y-2">
                        <Label className="font-medium">Chce dať súhlas</Label>
                        {ruleAiPipelineActions.onWantsConsent?.enabled && (
                          <Select 
                            value={ruleAiPipelineActions.onWantsConsent?.stageId || ""} 
                            onValueChange={(v) => setRuleAiPipelineActions(prev => ({
                              ...prev,
                              onWantsConsent: { enabled: true, stageId: v }
                            }))}
                          >
                            <SelectTrigger className="w-full" data-testid="select-pipeline-consent-stage">
                              <SelectValue placeholder="Vybrať fázu pipeline..." />
                            </SelectTrigger>
                            <SelectContent>
                              {allPipelineStages.map(stage => (
                                <SelectItem key={stage.id} value={stage.id}>
                                  {stage.pipeline?.name ? `${stage.pipeline.name} → ` : ""}{stage.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>

                    {/* Does Not Accept Contract */}
                    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                      <Switch
                        checked={ruleAiPipelineActions.onDoesNotAcceptContract?.enabled || false}
                        onCheckedChange={(checked) => setRuleAiPipelineActions(prev => ({
                          ...prev,
                          onDoesNotAcceptContract: { enabled: checked, stageId: prev.onDoesNotAcceptContract?.stageId || "" }
                        }))}
                        data-testid="switch-pipeline-not-accept"
                      />
                      <div className="flex-1 space-y-2">
                        <Label className="font-medium">Neakceptuje zmluvu</Label>
                        {ruleAiPipelineActions.onDoesNotAcceptContract?.enabled && (
                          <Select 
                            value={ruleAiPipelineActions.onDoesNotAcceptContract?.stageId || ""} 
                            onValueChange={(v) => setRuleAiPipelineActions(prev => ({
                              ...prev,
                              onDoesNotAcceptContract: { enabled: true, stageId: v }
                            }))}
                          >
                            <SelectTrigger className="w-full" data-testid="select-pipeline-not-accept-stage">
                              <SelectValue placeholder="Vybrať fázu pipeline..." />
                            </SelectTrigger>
                            <SelectContent>
                              {allPipelineStages.map(stage => (
                                <SelectItem key={stage.id} value={stage.id}>
                                  {stage.pipeline?.name ? `${stage.pipeline.name} → ` : ""}{stage.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Conditions */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-base font-semibold">Podmienky</Label>
                <Button size="sm" variant="outline" onClick={addCondition} data-testid="button-add-condition">
                  <Plus className="h-4 w-4 mr-1" />
                  Pridať podmienku
                </Button>
              </div>

              {ruleConditions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Žiadne podmienky - pravidlo sa aplikuje na všetky emaily</p>
              ) : (
                <div className="space-y-2">
                  {ruleConditions.map((condition, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 rounded-md border">
                      <Select value={condition.type} onValueChange={(v) => updateCondition(index, "type", v)}>
                        <SelectTrigger className="w-[180px]" data-testid={`select-condition-type-${index}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EMAIL_CONDITION_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={condition.operator} onValueChange={(v) => updateCondition(index, "operator", v)}>
                        <SelectTrigger className="w-[140px]" data-testid={`select-condition-operator-${index}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CONDITION_OPERATORS.map((op) => (
                            <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={condition.value}
                        onChange={(e) => updateCondition(index, "value", e.target.value)}
                        placeholder="Hodnota"
                        className="flex-1"
                        data-testid={`input-condition-value-${index}`}
                      />
                      <Button size="icon" variant="ghost" onClick={() => removeCondition(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Actions */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-base font-semibold">Akcie</Label>
                <Button size="sm" variant="outline" onClick={addAction} data-testid="button-add-action">
                  <Plus className="h-4 w-4 mr-1" />
                  Pridať akciu
                </Button>
              </div>

              {ruleActions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Žiadne akcie - pridajte aspoň jednu akciu</p>
              ) : (
                <div className="space-y-2">
                  {ruleActions.map((action, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 rounded-md border">
                      <Select value={action.type} onValueChange={(v) => updateAction(index, "type", v)}>
                        <SelectTrigger className="w-[200px]" data-testid={`select-action-type-${index}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EMAIL_ACTION_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {action.type === "set_priority" && (
                        <Select value={action.value} onValueChange={(v) => updateAction(index, "value", v)}>
                          <SelectTrigger className="w-[150px]" data-testid={`select-action-value-${index}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EMAIL_PRIORITIES.map((p) => (
                              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {action.type === "set_importance" && (
                        <Select value={action.value} onValueChange={(v) => updateAction(index, "value", v)}>
                          <SelectTrigger className="w-[150px]" data-testid={`select-action-value-${index}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EMAIL_IMPORTANCE.map((i) => (
                              <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {action.type === "add_tag" && (
                        <Select value={action.value} onValueChange={(v) => updateAction(index, "value", v)}>
                          <SelectTrigger className="w-[150px]" data-testid={`select-action-value-${index}`}>
                            <SelectValue placeholder="Vyberte tag" />
                          </SelectTrigger>
                          <SelectContent>
                            {tags.map((tag) => (
                              <SelectItem key={tag.id} value={tag.name}>{tag.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {(action.type === "create_notification" || action.type === "auto_reply") && (
                        <Input
                          value={action.value}
                          onChange={(e) => updateAction(index, "value", e.target.value)}
                          placeholder={action.type === "create_notification" ? "Text notifikácie" : "Text odpovede"}
                          className="flex-1"
                          data-testid={`input-action-value-${index}`}
                        />
                      )}
                      <Button size="icon" variant="ghost" onClick={() => removeAction(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRuleDialogOpen(false)} data-testid="button-cancel-rule">Zrušiť</Button>
            <Button 
              onClick={handleSaveRule} 
              disabled={!ruleName || createRuleMutation.isPending || updateRuleMutation.isPending}
              data-testid="button-save-rule"
            >
              {(createRuleMutation.isPending || updateRuleMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Uložiť
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tag Dialog */}
      <Dialog open={isTagDialogOpen} onOpenChange={setIsTagDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTag ? "Upraviť tag" : "Nový tag"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Názov tagu</Label>
              <Input
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="Napr. Urgentné"
                data-testid="input-tag-name"
              />
            </div>
            <div>
              <Label>Farba</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="color"
                  value={tagColor}
                  onChange={(e) => setTagColor(e.target.value)}
                  className="w-16 h-10 p-1"
                  data-testid="input-tag-color"
                />
                <Badge style={{ backgroundColor: tagColor, color: "#fff" }} className="px-4">
                  {tagName || "Náhľad"}
                </Badge>
              </div>
            </div>
            <div>
              <Label>Popis</Label>
              <Input
                value={tagDescription}
                onChange={(e) => setTagDescription(e.target.value)}
                placeholder="Voliteľný popis"
                data-testid="input-tag-description"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTagDialogOpen(false)} data-testid="button-cancel-tag">Zrušiť</Button>
            <Button 
              onClick={handleSaveTag} 
              disabled={!tagName || createTagMutation.isPending || updateTagMutation.isPending}
              data-testid="button-save-tag"
            >
              {(createTagMutation.isPending || updateTagMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Uložiť
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

// API Keys management
interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  isActive: boolean;
}

const apiKeyFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  permissions: z.array(z.string()).min(1, "At least one permission is required"),
  expiresAt: z.string().optional().nullable(),
});

type ApiKeyFormData = z.infer<typeof apiKeyFormSchema>;

interface AlertRule {
  id: string;
  name: string;
  description: string | null;
  metricType: string;
  comparisonOperator: string;
  thresholdValue: number;
  checkFrequency: string;
  notificationPriority: string;
  targetType: string;
  targetRoles: string[] | null;
  targetUserIds: string[] | null;
  countryCodes: string[] | null;
  cooldownMinutes: number;
  isActive: boolean;
  lastCheckedAt: Date | null;
  lastAlertedAt: Date | null;
  createdAt: Date;
  createdBy: string | null;
}

const alertRuleFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  metricType: z.string().min(1, "Metric type is required"),
  comparisonOperator: z.string().min(1, "Operator is required"),
  thresholdValue: z.number().min(0, "Threshold must be positive"),
  checkFrequency: z.string().min(1, "Frequency is required"),
  notificationPriority: z.string().default("high"),
  targetType: z.string().default("all"),
  cooldownMinutes: z.number().min(1).default(60),
  isActive: z.boolean().default(true),
});

type AlertRuleFormData = z.infer<typeof alertRuleFormSchema>;

const METRIC_TYPES = [
  'pending_lab_results',
  'collections_without_hospital',
  'overdue_collections',
  'pending_evaluations',
  'expiring_api_keys',
  'inactive_customers',
  'upcoming_collection_dates',
  'low_collection_rate',
  'pending_invoices',
  'overdue_tasks',
];

const COMPARISON_OPERATORS = ['gt', 'gte', 'lt', 'lte', 'eq', 'neq'];
const CHECK_FREQUENCIES = ['hourly', 'every_6_hours', 'daily', 'weekly'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const TARGET_USER_TYPES = ['all', 'role', 'specific_users'];

function AlertRulesTab() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<AlertRule | null>(null);

  const form = useForm<AlertRuleFormData>({
    resolver: zodResolver(alertRuleFormSchema),
    defaultValues: {
      name: "",
      description: "",
      metricType: "pending_lab_results",
      comparisonOperator: "gt",
      thresholdValue: 0,
      checkFrequency: "daily",
      notificationPriority: "high",
      targetType: "all",
      cooldownMinutes: 60,
      isActive: true,
    },
  });

  const { data: alertRules = [], isLoading } = useQuery<AlertRule[]>({
    queryKey: ["/api/alert-rules"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: AlertRuleFormData) => {
      const response = await apiRequest("POST", "/api/alert-rules", data);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create alert");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alert-rules"] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({ title: t.alerts?.alertCreated || "Alert created successfully" });
    },
    onError: (error: Error) => {
      console.error("Alert creation error:", error);
      toast({ title: error.message || t.alerts?.createFailed || "Failed to create alert", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AlertRuleFormData> }) => {
      const response = await apiRequest("PATCH", `/api/alert-rules/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alert-rules"] });
      setIsEditDialogOpen(false);
      setSelectedRule(null);
      toast({ title: t.alerts?.alertUpdated || "Alert updated successfully" });
    },
    onError: () => {
      toast({ title: t.alerts?.updateFailed || "Failed to update alert", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/alert-rules/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alert-rules"] });
      setIsDeleteDialogOpen(false);
      setSelectedRule(null);
      toast({ title: t.alerts?.alertDeleted || "Alert deleted successfully" });
    },
    onError: () => {
      toast({ title: t.alerts?.deleteFailed || "Failed to delete alert", variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/alert-rules/${id}/toggle`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/alert-rules"] });
      toast({ 
        title: data.isActive 
          ? (t.alerts?.alertActivated || "Alert activated") 
          : (t.alerts?.alertDeactivated || "Alert deactivated") 
      });
    },
  });

  const handleEdit = (rule: AlertRule) => {
    setSelectedRule(rule);
    form.reset({
      name: rule.name,
      description: rule.description || "",
      metricType: rule.metricType,
      comparisonOperator: rule.comparisonOperator,
      thresholdValue: rule.thresholdValue,
      checkFrequency: rule.checkFrequency,
      notificationPriority: rule.notificationPriority,
      targetType: rule.targetType,
      cooldownMinutes: rule.cooldownMinutes,
      isActive: rule.isActive,
    });
    setIsEditDialogOpen(true);
  };

  const getMetricLabel = (metric: string) => {
    const labels = t.alerts?.metrics as Record<string, string> | undefined;
    return labels?.[metric] || metric.replace(/_/g, ' ');
  };

  const getOperatorLabel = (op: string) => {
    const labels = t.alerts?.operators as Record<string, string> | undefined;
    return labels?.[op] || op;
  };

  const getFrequencyLabel = (freq: string) => {
    const labels = t.alerts?.frequencies as Record<string, string> | undefined;
    return labels?.[freq] || freq.replace(/_/g, ' ');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {alertRules.length} {alertRules.length === 1 ? 'alert rule' : 'alert rules'} configured
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-alert">
              <Plus className="h-4 w-4 mr-2" />
              {t.alerts?.createAlert || "Create Alert"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t.alerts?.createAlert || "Create Alert Rule"}</DialogTitle>
              <DialogDescription>
                {t.alerts?.description || "Configure automatic alerts for critical metrics"}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.alerts?.name || "Name"}</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Alert name" data-testid="input-alert-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="metricType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.alerts?.metric || "Metric"}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-metric-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {METRIC_TYPES.map((metric) => (
                            <SelectItem key={metric} value={metric}>
                              {getMetricLabel(metric)}
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
                    name="comparisonOperator"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.alerts?.condition || "Condition"}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-operator">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {COMPARISON_OPERATORS.map((op) => (
                              <SelectItem key={op} value={op}>
                                {getOperatorLabel(op)}
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
                    name="thresholdValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.alerts?.threshold || "Threshold"}</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            onChange={(e) => field.onChange(Number(e.target.value))}
                            data-testid="input-threshold" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="checkFrequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.alerts?.frequency || "Check Frequency"}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-frequency">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {CHECK_FREQUENCIES.map((freq) => (
                              <SelectItem key={freq} value={freq}>
                                {getFrequencyLabel(freq)}
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
                    name="notificationPriority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.alerts?.priority || "Priority"}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-priority">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PRIORITIES.map((p) => (
                              <SelectItem key={p} value={p}>
                                {p.charAt(0).toUpperCase() + p.slice(1)}
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
                  name="cooldownMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.alerts?.cooldownMinutes || "Cooldown (minutes)"}</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          onChange={(e) => field.onChange(Number(e.target.value))}
                          data-testid="input-cooldown" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-is-active"
                        />
                      </FormControl>
                      <FormLabel className="!mt-0">{t.alerts?.active || "Active"}</FormLabel>
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    {t.common.cancel}
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-alert">
                    {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {t.common.save}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {alertRules.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>{t.alerts?.noAlerts || "No alert rules configured"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alertRules.map((rule) => (
            <Card key={rule.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium truncate">{rule.name}</h4>
                    <Badge variant={rule.isActive ? "default" : "secondary"}>
                      {rule.isActive ? (t.alerts?.active || "Active") : (t.alerts?.inactive || "Inactive")}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {rule.notificationPriority}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {getMetricLabel(rule.metricType)} {getOperatorLabel(rule.comparisonOperator)} {rule.thresholdValue}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>{getFrequencyLabel(rule.checkFrequency)}</span>
                    {rule.lastCheckedAt && (
                      <span>Last checked: {new Date(rule.lastCheckedAt).toLocaleString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={rule.isActive}
                    onCheckedChange={() => toggleMutation.mutate(rule.id)}
                    data-testid={`switch-toggle-${rule.id}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(rule)}
                    data-testid={`button-edit-${rule.id}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedRule(rule);
                      setIsDeleteDialogOpen(true);
                    }}
                    data-testid={`button-delete-${rule.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.alerts?.editAlert || "Edit Alert Rule"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form 
              onSubmit={form.handleSubmit((data) => {
                if (selectedRule) {
                  updateMutation.mutate({ id: selectedRule.id, data });
                }
              })} 
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.alerts?.name || "Name"}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-alert-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="metricType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.alerts?.metric || "Metric"}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {METRIC_TYPES.map((metric) => (
                          <SelectItem key={metric} value={metric}>
                            {getMetricLabel(metric)}
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
                  name="comparisonOperator"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.alerts?.condition || "Condition"}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {COMPARISON_OPERATORS.map((op) => (
                            <SelectItem key={op} value={op}>
                              {getOperatorLabel(op)}
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
                  name="thresholdValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.alerts?.threshold || "Threshold"}</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="checkFrequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.alerts?.frequency || "Check Frequency"}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CHECK_FREQUENCIES.map((freq) => (
                            <SelectItem key={freq} value={freq}>
                              {getFrequencyLabel(freq)}
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
                  name="notificationPriority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t.alerts?.priority || "Priority"}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PRIORITIES.map((p) => (
                            <SelectItem key={p} value={p}>
                              {p.charAt(0).toUpperCase() + p.slice(1)}
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
                name="cooldownMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.alerts?.cooldownMinutes || "Cooldown (minutes)"}</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field} 
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  {t.common.cancel}
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {t.common.save}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.alerts?.deleteAlert || "Delete Alert"}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.alerts?.deleteConfirm || "Are you sure you want to delete this alert?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedRule && deleteMutation.mutate(selectedRule.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ApiKeysTab() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedApiKey, setSelectedApiKey] = useState<ApiKey | null>(null);
  const [newApiKeyValue, setNewApiKeyValue] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const form = useForm<ApiKeyFormData>({
    resolver: zodResolver(apiKeyFormSchema),
    defaultValues: {
      name: "",
      permissions: ["lab_results:read", "lab_results:write"],
      expiresAt: null,
    },
  });

  const { data: apiKeys = [], isLoading } = useQuery<ApiKey[]>({
    queryKey: ["/api/api-keys"],
  });

  const createApiKeyMutation = useMutation({
    mutationFn: async (data: ApiKeyFormData) => {
      const response = await apiRequest("POST", "/api/api-keys", data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      setNewApiKeyValue(data.apiKey);
      form.reset();
      toast({
        title: t.konfigurator.apiKeyCreated,
      });
    },
    onError: () => {
      toast({
        title: t.common.error,
        variant: "destructive",
      });
    },
  });

  const deleteApiKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/api-keys/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
      setIsDeleteDialogOpen(false);
      setSelectedApiKey(null);
      toast({
        title: t.konfigurator.apiKeyDeleted,
      });
    },
    onError: () => {
      toast({
        title: t.common.error,
        variant: "destructive",
      });
    },
  });

  const handleCreateApiKey = (data: ApiKeyFormData) => {
    createApiKeyMutation.mutate(data);
  };

  const handleCopyApiKey = async () => {
    if (newApiKeyValue) {
      await navigator.clipboard.writeText(newApiKeyValue);
      setCopiedKey(true);
      toast({
        title: t.konfigurator.apiKeyCopied,
      });
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleCloseNewKeyDialog = () => {
    setIsCreateDialogOpen(false);
    setNewApiKeyValue(null);
    setCopiedKey(false);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString();
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const getPermissionLabel = (permission: string) => {
    switch (permission) {
      case "lab_results:read":
        return t.konfigurator.apiKeyPermissionLabResultsRead;
      case "lab_results:write":
        return t.konfigurator.apiKeyPermissionLabResultsWrite;
      case "*":
        return t.konfigurator.apiKeyPermissionAll;
      default:
        return permission;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-add-api-key">
          <Plus className="h-4 w-4 mr-2" />
          {t.konfigurator.addApiKey}
        </Button>
      </div>

      {apiKeys.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground" data-testid="empty-state-api-keys">
          <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>{t.konfigurator.noApiKeys}</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">{t.konfigurator.apiKeyName}</th>
                <th className="text-left p-3 font-medium">{t.konfigurator.apiKeyPrefix}</th>
                <th className="text-left p-3 font-medium">{t.konfigurator.apiKeyPermissions}</th>
                <th className="text-left p-3 font-medium">{t.konfigurator.apiKeyExpires}</th>
                <th className="text-left p-3 font-medium">{t.konfigurator.apiKeyLastUsed}</th>
                <th className="text-left p-3 font-medium">{t.common.status}</th>
                <th className="text-right p-3 font-medium">{t.common.actions}</th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.map((apiKey) => (
                <tr key={apiKey.id} className="border-b last:border-b-0" data-testid={`row-api-key-${apiKey.id}`}>
                  <td className="p-3 font-medium">{apiKey.name}</td>
                  <td className="p-3">
                    <code className="bg-muted px-2 py-1 rounded text-sm">{apiKey.keyPrefix}...</code>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {apiKey.permissions.map((perm) => (
                        <Badge key={perm} variant="secondary" className="text-xs">
                          {getPermissionLabel(perm)}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="p-3">
                    {apiKey.expiresAt ? formatDate(apiKey.expiresAt) : t.konfigurator.apiKeyNeverExpires}
                  </td>
                  <td className="p-3">
                    {apiKey.lastUsedAt ? formatDate(apiKey.lastUsedAt) : t.konfigurator.apiKeyNeverUsed}
                  </td>
                  <td className="p-3" data-testid={`status-api-key-${apiKey.id}`}>
                    {isExpired(apiKey.expiresAt) ? (
                      <Badge variant="destructive">{t.konfigurator.apiKeyExpired}</Badge>
                    ) : !apiKey.isActive ? (
                      <Badge variant="secondary">{t.common.inactive}</Badge>
                    ) : (
                      <Badge variant="default">{t.konfigurator.apiKeyActive}</Badge>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedApiKey(apiKey);
                        setIsDeleteDialogOpen(true);
                      }}
                      data-testid={`button-delete-api-key-${apiKey.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={isCreateDialogOpen && !newApiKeyValue} onOpenChange={(open) => !open && handleCloseNewKeyDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.konfigurator.createApiKey}</DialogTitle>
            <DialogDescription>{t.konfigurator.apiKeysDescription}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreateApiKey)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.konfigurator.apiKeyName}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-api-key-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="permissions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.konfigurator.apiKeyPermissions}</FormLabel>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="perm-all"
                          checked={field.value.includes("*")}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              field.onChange(["*"]);
                            } else {
                              field.onChange(["lab_results:read", "lab_results:write"]);
                            }
                          }}
                          data-testid="checkbox-permission-all"
                        />
                        <Label htmlFor="perm-all" data-testid="label-permission-all">{t.konfigurator.apiKeyPermissionAll}</Label>
                      </div>
                      {!field.value.includes("*") && (
                        <>
                          <div className="flex items-center space-x-2 ml-4">
                            <Checkbox
                              id="perm-read"
                              checked={field.value.includes("lab_results:read")}
                              onCheckedChange={(checked) => {
                                const newValue = checked
                                  ? [...field.value, "lab_results:read"]
                                  : field.value.filter((p) => p !== "lab_results:read");
                                field.onChange(newValue);
                              }}
                              data-testid="checkbox-permission-read"
                            />
                            <Label htmlFor="perm-read" data-testid="label-permission-read">{t.konfigurator.apiKeyPermissionLabResultsRead}</Label>
                          </div>
                          <div className="flex items-center space-x-2 ml-4">
                            <Checkbox
                              id="perm-write"
                              checked={field.value.includes("lab_results:write")}
                              onCheckedChange={(checked) => {
                                const newValue = checked
                                  ? [...field.value, "lab_results:write"]
                                  : field.value.filter((p) => p !== "lab_results:write");
                                field.onChange(newValue);
                              }}
                              data-testid="checkbox-permission-write"
                            />
                            <Label htmlFor="perm-write" data-testid="label-permission-write">{t.konfigurator.apiKeyPermissionLabResultsWrite}</Label>
                          </div>
                        </>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expiresAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.konfigurator.apiKeyExpiresAt}</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value || null)}
                        data-testid="input-api-key-expires"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseNewKeyDialog}>
                  {t.common.cancel}
                </Button>
                <Button type="submit" disabled={createApiKeyMutation.isPending} data-testid="button-create-api-key">
                  {createApiKeyMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {t.konfigurator.createApiKey}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!newApiKeyValue} onOpenChange={(open) => !open && handleCloseNewKeyDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.konfigurator.apiKeyCreated}</DialogTitle>
            <DialogDescription className="text-amber-600 font-medium">
              {t.konfigurator.apiKeyCopyWarning}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                value={newApiKeyValue || ""}
                readOnly
                className="font-mono text-sm"
                data-testid="input-new-api-key-value"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyApiKey}
                data-testid="button-copy-api-key"
              >
                {copiedKey ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCloseNewKeyDialog} data-testid="button-close-api-key-dialog">
              {t.common.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.konfigurator.confirmDeleteApiKey}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.konfigurator.deleteApiKeyConfirmMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-api-key">{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedApiKey && deleteApiKeyMutation.mutate(selectedApiKey.id)}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete-api-key"
            >
              {deleteApiKeyMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NotificationsTab() {
  return <NotificationRulesManager />;
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
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<string>("companyName");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;
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
    const companyCountries = company.countryCodes?.length ? company.countryCodes : [company.countryCode];
    
    if (userCountryCodes && !companyCountries.some(c => userCountryCodes.includes(c))) return false;
    if (countryFilter !== "all" && !companyCountries.includes(countryFilter)) return false;
    
    if (numberRangeFilter !== "all") {
      const hasNumberRange = allNumberRanges.some(nr => nr.billingDetailsId === company.id && nr.id === numberRangeFilter);
      if (!hasNumberRange) return false;
    }

    if (statusFilter !== "all") {
      if (statusFilter === "active" && !company.isActive) return false;
      if (statusFilter === "inactive" && company.isActive) return false;
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
  }).sort((a, b) => {
    let aVal: string | number = "";
    let bVal: string | number = "";
    switch (sortField) {
      case "companyName": aVal = a.companyName.toLowerCase(); bVal = b.companyName.toLowerCase(); break;
      case "code": aVal = (a.code || "").toLowerCase(); bVal = (b.code || "").toLowerCase(); break;
      case "countryCode": aVal = a.countryCode; bVal = b.countryCode; break;
      case "isActive": aVal = a.isActive ? 1 : 0; bVal = b.isActive ? 1 : 0; break;
      default: aVal = a.companyName.toLowerCase(); bVal = b.companyName.toLowerCase();
    }
    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const billingTotalPages = Math.max(1, Math.ceil(filteredCompanies.length / PAGE_SIZE));
  const billingSafePage = Math.min(currentPage, billingTotalPages);
  const paginatedCompanies = filteredCompanies.slice((billingSafePage - 1) * PAGE_SIZE, billingSafePage * PAGE_SIZE);

  const handleBillingSortClick = (field: string) => {
    if (sortField === field) {
      setSortDirection(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  const BillingSortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortDirection === "asc" 
      ? <ChevronUp className="h-3 w-3 ml-1" /> 
      : <ChevronDown className="h-3 w-3 ml-1" />;
  };

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t.common.search}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="pl-9"
              data-testid="input-search-billing-companies"
            />
          </div>
          <Select value={countryFilter} onValueChange={(v) => { setCountryFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-[160px]" data-testid="select-billing-country-filter">
              <SelectValue placeholder={t.customers.country} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.common.all || "All"}</SelectItem>
              {availableCountries.map((country) => (
                <SelectItem key={country.code} value={country.code}>
                  <span className="mr-2">{country.flag}</span>{country.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-[130px]" data-testid="select-billing-status-filter">
              <SelectValue placeholder={t.common.status} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.common.all || "All"}</SelectItem>
              <SelectItem value="active">{t.common.active}</SelectItem>
              <SelectItem value="inactive">{t.common.inactive}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={numberRangeFilter} onValueChange={(v) => { setNumberRangeFilter(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-[200px]" data-testid="select-billing-number-range-filter">
              <SelectValue placeholder={t.konfigurator.numberRanges || "Number Ranges"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.common.all || "All"}</SelectItem>
              {allNumberRanges.map((range) => (
                <SelectItem key={range.id} value={range.id}>{range.name} ({range.year})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(countryFilter !== "all" || statusFilter !== "all" || numberRangeFilter !== "all" || search) && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                setCountryFilter("all");
                setStatusFilter("all");
                setNumberRangeFilter("all");
                setSearch("");
                setCurrentPage(1);
              }}
              data-testid="clear-billing-filters"
            >
              <X className="h-4 w-4 mr-1" />
              {t.common.clear || "Clear"}
            </Button>
          )}
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
      ) : paginatedCompanies.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {search || countryFilter !== "all" || statusFilter !== "all" || numberRangeFilter !== "all"
            ? (t.common.noData || "No results found")
            : (t.konfigurator.noBillingCompanies || "No billing companies yet")}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none" onClick={() => handleBillingSortClick("code")} data-testid="sort-billing-code">
                <span className="flex items-center">{t.common.code || "Code"}<BillingSortIcon field="code" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleBillingSortClick("companyName")} data-testid="sort-billing-name">
                <span className="flex items-center">{t.settings.companyName}<BillingSortIcon field="companyName" /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleBillingSortClick("countryCode")} data-testid="sort-billing-country">
                <span className="flex items-center">{t.customers.country}<BillingSortIcon field="countryCode" /></span>
              </TableHead>
              <TableHead>{t.common.default || "Default"}</TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleBillingSortClick("isActive")} data-testid="sort-billing-status">
                <span className="flex items-center">{t.common.status}<BillingSortIcon field="isActive" /></span>
              </TableHead>
              <TableHead className="text-right">{t.common.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedCompanies.map((company) => {
              const countryCodes = company.countryCodes?.length ? company.countryCodes : [company.countryCode];
              return (
                <TableRow key={company.id}>
                  <TableCell>{company.code || "-"}</TableCell>
                  <TableCell className="font-medium">{company.companyName}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {countryCodes.map(code => {
                        const country = COUNTRIES.find(c => c.code === code);
                        return (
                          <Badge key={code} variant="outline">
                            <span className="mr-1">{country?.flag}</span>{country?.name || code}
                          </Badge>
                        );
                      })}
                    </div>
                  </TableCell>
                  <TableCell>
                    {company.isDefault ? <Badge variant="secondary">{t.common.default || "Default"}</Badge> : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant={company.isActive ? "default" : "secondary"}>
                      {company.isActive ? t.common.active : t.common.inactive}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(company)} data-testid={`button-edit-billing-${company.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeletingCompany(company)} data-testid={`button-delete-billing-${company.id}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {billingTotalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {t.common.page || "Page"} {billingSafePage} / {billingTotalPages} ({filteredCompanies.length} {t.common.results || "results"})
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(1)} disabled={billingSafePage === 1} data-testid="billing-pagination-first">
              <ChevronLeft className="h-4 w-4" /><ChevronLeft className="h-4 w-4 -ml-2" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={billingSafePage === 1} data-testid="billing-pagination-prev">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-sm font-medium">{billingSafePage}</span>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(billingTotalPages, p + 1))} disabled={billingSafePage === billingTotalPages} data-testid="billing-pagination-next">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(billingTotalPages)} disabled={billingSafePage === billingTotalPages} data-testid="billing-pagination-last">
              <ChevronRight className="h-4 w-4" /><ChevronRight className="h-4 w-4 -ml-2" />
            </Button>
          </div>
        </div>
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

// Country System Settings Tab
function CountrySystemSettingsTab() {
  const { toast } = useToast();
  const { t } = useI18n();
  const { user } = useAuth();
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [ms365JustConnected, setMs365JustConnected] = useState(false);

  // Handle URL params from OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const countryFromUrl = params.get('country');
    const ms365Connected = params.get('ms365_connected');
    const ms365Error = params.get('ms365_error');
    
    if (countryFromUrl) {
      setSelectedCountry(countryFromUrl);
    }
    
    if (ms365Connected === 'true') {
      setMs365JustConnected(true);
      toast({ 
        title: "Úspech", 
        description: "MS365 účet bol úspešne pripojený",
      });
      // Clean URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('ms365_connected');
      window.history.replaceState({}, '', newUrl.toString());
    }
    
    if (ms365Error) {
      toast({ 
        title: "Chyba", 
        description: decodeURIComponent(ms365Error),
        variant: "destructive",
      });
      // Clean URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('ms365_error');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, [toast]);

  const userCountryCodes = user?.assignedCountries && user.assignedCountries.length > 0 ? user.assignedCountries : null;
  const availableCountries = userCountryCodes 
    ? COUNTRIES.filter(c => userCountryCodes.includes(c.code))
    : COUNTRIES;

  const { data: systemSettings = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/config/country-system-settings"],
  });

  const { data: gsmConfigs = [] } = useQuery<any[]>({
    queryKey: ["/api/config/gsm-sender-configs"],
  });

  // MS365 connection for selected country
  const { data: ms365Connection, isLoading: ms365Loading, refetch: refetchMs365 } = useQuery<{
    id: string;
    countryCode: string;
    email: string;
    displayName: string | null;
    isConnected: boolean;
    hasTokens: boolean;
  } | null>({
    queryKey: ["/api/config/system-ms365-connections", selectedCountry],
    queryFn: async () => {
      if (!selectedCountry) return null;
      const res = await fetch(`/api/config/system-ms365-connections/${selectedCountry}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: !!selectedCountry,
    refetchOnMount: true,
    staleTime: 0,
  });

  // Refetch after OAuth redirect
  useEffect(() => {
    if (ms365JustConnected && selectedCountry) {
      refetchMs365();
      setMs365JustConnected(false);
    }
  }, [ms365JustConnected, selectedCountry, refetchMs365]);

  const connectMs365Mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/config/system-ms365-connections/${selectedCountry}/auth`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to initiate auth');
      return res.json();
    },
    onSuccess: (data) => {
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    },
    onError: () => {
      toast({ title: t.common.error, description: "Nepodarilo sa iniciovať MS365 autentifikáciu", variant: "destructive" });
    },
  });

  const disconnectMs365Mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/config/system-ms365-connections/${selectedCountry}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to disconnect');
      return res.json();
    },
    onSuccess: () => {
      refetchMs365();
      queryClient.invalidateQueries({ queryKey: ["/api/config/system-ms365-connections"] });
      toast({ title: t.common.success, description: "MS365 účet odpojený" });
    },
    onError: () => {
      toast({ title: t.common.error, description: "Nepodarilo sa odpojiť MS365", variant: "destructive" });
    },
  });

  const currentSettings = systemSettings.find(s => s.countryCode === selectedCountry);
  const currentGsmConfig = gsmConfigs.find(g => g.countryCode === selectedCountry);

  const [formData, setFormData] = useState({
    systemEmailEnabled: false,
    systemEmailAddress: "",
    systemEmailDisplayName: "",
    systemSmsEnabled: false,
    systemSmsSenderType: "gSystem",
    systemSmsSenderValue: "",
    alertsEnabled: true,
    notificationsEnabled: true,
  });

  useEffect(() => {
    if (currentSettings) {
      setFormData({
        systemEmailEnabled: currentSettings.systemEmailEnabled || false,
        systemEmailAddress: currentSettings.systemEmailAddress || "",
        systemEmailDisplayName: currentSettings.systemEmailDisplayName || "",
        systemSmsEnabled: currentSettings.systemSmsEnabled || false,
        systemSmsSenderType: currentSettings.systemSmsSenderType || currentGsmConfig?.senderIdType || "gSystem",
        systemSmsSenderValue: currentSettings.systemSmsSenderValue || currentGsmConfig?.senderIdValue || "",
        alertsEnabled: currentSettings.alertsEnabled ?? true,
        notificationsEnabled: currentSettings.notificationsEnabled ?? true,
      });
    } else {
      setFormData({
        systemEmailEnabled: false,
        systemEmailAddress: "",
        systemEmailDisplayName: "",
        systemSmsEnabled: false,
        systemSmsSenderType: currentGsmConfig?.senderIdType || "gSystem",
        systemSmsSenderValue: currentGsmConfig?.senderIdValue || "",
        alertsEnabled: true,
        notificationsEnabled: true,
      });
    }
  }, [currentSettings, currentGsmConfig, selectedCountry]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/config/country-system-settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config/country-system-settings"] });
      toast({ title: t.common.success, description: "Systémové nastavenia uložené" });
    },
    onError: () => {
      toast({ title: t.common.error, description: "Nepodarilo sa uložiť nastavenia", variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!selectedCountry) {
      toast({ title: t.common.error, description: "Vyberte krajinu", variant: "destructive" });
      return;
    }
    // Use MS365 connection email if available
    const emailAddress = ms365Connection?.email || formData.systemEmailAddress;
    saveMutation.mutate({
      countryCode: selectedCountry,
      ...formData,
      systemEmailAddress: emailAddress,
    });
  };

  const senderTypes = [
    { value: "gSystem", label: "Systémové číslo", needsValue: false },
    { value: "gShort", label: "Short Code", needsValue: false },
    { value: "gText", label: "Textový odosielateľ", needsValue: true },
    { value: "gMobile", label: "Mobile Connect", needsValue: true },
    { value: "gPush", label: "Mobile Connect Push", needsValue: false },
    { value: "gOwn", label: "Vlastné číslo", needsValue: true },
    { value: "gProfile", label: "BulkGate Profil ID", needsValue: true },
  ];

  const selectedSenderType = senderTypes.find(t => t.value === formData.systemSmsSenderType);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Label>Vyberte krajinu</Label>
          <Select value={selectedCountry} onValueChange={setSelectedCountry}>
            <SelectTrigger className="w-[300px]" data-testid="select-system-settings-country">
              <SelectValue placeholder="Vyberte krajinu..." />
            </SelectTrigger>
            <SelectContent>
              {availableCountries.map((country) => (
                <SelectItem key={country.code} value={country.code}>
                  {country.flag} {country.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedCountry && (
        <div className="grid grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Systémový Email
              </CardTitle>
              <CardDescription>
                MS365 email účet pre odosielanie systémových upozornení a alertov
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="emailEnabled">Povoliť systémový email</Label>
                <Switch
                  id="emailEnabled"
                  checked={formData.systemEmailEnabled}
                  onCheckedChange={(v) => setFormData({...formData, systemEmailEnabled: v})}
                  data-testid="switch-system-email-enabled"
                />
              </div>
              
              {formData.systemEmailEnabled && (
                <>
                  {ms365Loading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : ms365Connection?.isConnected ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-green-700 dark:text-green-300">
                            MS365 pripojený
                          </p>
                          <p className="text-xs text-green-600 dark:text-green-400">
                            {ms365Connection.email}
                            {ms365Connection.displayName && ` (${ms365Connection.displayName})`}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => disconnectMs365Mutation.mutate()}
                          disabled={disconnectMs365Mutation.isPending}
                          data-testid="button-disconnect-system-ms365"
                        >
                          {disconnectMs365Mutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <XCircle className="h-4 w-4 mr-1" />
                          )}
                          Odpojiť
                        </Button>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Zobrazované meno odosielateľa</Label>
                        <Input
                          value={formData.systemEmailDisplayName}
                          onChange={(e) => setFormData({...formData, systemEmailDisplayName: e.target.value})}
                          placeholder="INDEXUS Systém"
                          data-testid="input-system-email-display-name"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Pre odosielanie systémových emailov je potrebné pripojiť MS365 účet.
                      </p>
                      <Button
                        type="button"
                        onClick={() => connectMs365Mutation.mutate()}
                        disabled={connectMs365Mutation.isPending}
                        data-testid="button-connect-system-ms365"
                      >
                        {connectMs365Mutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Mail className="h-4 w-4 mr-2" />
                        )}
                        Pripojiť Microsoft 365
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Systémový SMS odosielateľ
              </CardTitle>
              <CardDescription>
                BulkGate konfigurácia pre odosielanie systémových SMS upozornení
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="smsEnabled">Povoliť systémové SMS</Label>
                <Switch
                  id="smsEnabled"
                  checked={formData.systemSmsEnabled}
                  onCheckedChange={(v) => setFormData({...formData, systemSmsEnabled: v})}
                  data-testid="switch-system-sms-enabled"
                />
              </div>

              {formData.systemSmsEnabled && (
                <>
                  <div className="space-y-2">
                    <Label>Typ odosielateľa</Label>
                    <Select 
                      value={formData.systemSmsSenderType} 
                      onValueChange={(v) => setFormData({...formData, systemSmsSenderType: v, systemSmsSenderValue: ""})}
                    >
                      <SelectTrigger data-testid="select-system-sms-sender-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {senderTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {selectedSenderType?.needsValue && (
                    <div className="space-y-2">
                      <Label>
                        {formData.systemSmsSenderType === "gText" ? "Text odosielateľa (max 11 znakov)" : 
                         formData.systemSmsSenderType === "gOwn" ? "Telefónne číslo" :
                         formData.systemSmsSenderType === "gProfile" ? "BulkGate Profil ID" :
                         "Hodnota"}
                      </Label>
                      <Input
                        value={formData.systemSmsSenderValue}
                        onChange={(e) => setFormData({...formData, systemSmsSenderValue: e.target.value})}
                        placeholder={
                          formData.systemSmsSenderType === "gText" ? "INDEXUS" : 
                          formData.systemSmsSenderType === "gOwn" ? "+421..." :
                          formData.systemSmsSenderType === "gProfile" ? "123456" :
                          ""
                        }
                        maxLength={formData.systemSmsSenderType === "gText" ? 11 : undefined}
                        data-testid="input-system-sms-sender-value"
                      />
                    </div>
                  )}

                  {currentGsmConfig && (
                    <div className="p-3 bg-muted rounded-md">
                      <p className="text-xs text-muted-foreground">
                        Aktuálna GSM konfigurácia pre {selectedCountry}: {currentGsmConfig.senderIdType}
                        {currentGsmConfig.senderIdValue && ` (${currentGsmConfig.senderIdValue})`}
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Dodatočné nastavenia
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Alerty</Label>
                  <p className="text-sm text-muted-foreground">Povoliť automatické alerty pre túto krajinu</p>
                </div>
                <Switch
                  checked={formData.alertsEnabled}
                  onCheckedChange={(v) => setFormData({...formData, alertsEnabled: v})}
                  data-testid="switch-alerts-enabled"
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>Notifikácie</Label>
                  <p className="text-sm text-muted-foreground">Povoliť automatické notifikácie pre túto krajinu</p>
                </div>
                <Switch
                  checked={formData.notificationsEnabled}
                  onCheckedChange={(v) => setFormData({...formData, notificationsEnabled: v})}
                  data-testid="switch-notifications-enabled"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedCountry && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-system-settings">
            {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Uložiť nastavenia
          </Button>
        </div>
      )}

      {!selectedCountry && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          Vyberte krajinu pre zobrazenie systémových nastavení
        </div>
      )}
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
        residencyCountry: billingCompany.residencyCountry || "",
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
        residencyCountry: "",
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
            <TabsTrigger value="postal">{t.konfigurator.tabPostal}</TabsTrigger>
            <TabsTrigger value="residency">{t.konfigurator.tabResidency}</TabsTrigger>
            <TabsTrigger value="details">{t.konfigurator.tabDetails}</TabsTrigger>
            <TabsTrigger value="accounts">{t.konfigurator.tabAccounts}</TabsTrigger>
            <TabsTrigger value="couriers">{t.konfigurator.tabCouriers}</TabsTrigger>
            <TabsTrigger value="laboratories">{t.konfigurator.tabLabs}</TabsTrigger>
            <TabsTrigger value="collaborators">{t.konfigurator.tabCollaborators}</TabsTrigger>
            <TabsTrigger value="history">{t.konfigurator.tabHistory}</TabsTrigger>
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
                      <SelectItem key={c.code} value={c.code}>{c.code} ({c.symbol})</SelectItem>
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
                    <SelectItem key={c.code} value={c.code}>{c.code} ({c.symbol})</SelectItem>
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
      
      <Tabs defaultValue="products" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1 p-1 w-full">
          <TabsTrigger value="products" className="flex items-center gap-2 text-xs sm:text-sm" data-testid="tab-products">
            <Package className="h-4 w-4 shrink-0" />
            <span className="hidden md:inline">{t.products.title}</span>
          </TabsTrigger>
          <TabsTrigger value="billing" className="flex items-center gap-2 text-xs sm:text-sm" data-testid="tab-billing-companies">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="hidden md:inline">{t.konfigurator.billingCompanies || "Billing"}</span>
          </TabsTrigger>
          <TabsTrigger value="rates-inflation" className="flex items-center gap-2 text-xs sm:text-sm" data-testid="tab-rates-inflation">
            <DollarSign className="h-4 w-4 shrink-0" />
            <span className="hidden md:inline">{t.konfigurator.exchangeRatesAndInflation || "Kurzy"}</span>
          </TabsTrigger>
          <TabsTrigger value="email-router" className="flex items-center gap-2 text-xs sm:text-sm" data-testid="tab-email-router">
            <Mail className="h-4 w-4 shrink-0" />
            <span className="hidden md:inline">Email & GSM</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2 text-xs sm:text-sm" data-testid="tab-notifications">
            <Bell className="h-4 w-4 shrink-0" />
            <span className="hidden md:inline">Notifikacie & Alerts</span>
          </TabsTrigger>
          <TabsTrigger value="api-keys" className="flex items-center gap-2 text-xs sm:text-sm" data-testid="tab-api-keys">
            <Key className="h-4 w-4 shrink-0" />
            <span className="hidden md:inline">{t.konfigurator.apiKeys}</span>
          </TabsTrigger>
          <TabsTrigger value="permissions" className="flex items-center gap-2 text-xs sm:text-sm" data-testid="tab-permissions">
            <Shield className="h-4 w-4 shrink-0" />
            <span className="hidden md:inline">{t.konfigurator.permissionsRoles}</span>
          </TabsTrigger>
        </TabsList>

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
              <Tabs defaultValue="companies" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="companies" data-testid="subtab-billing-companies">
                    <Building2 className="h-4 w-4 mr-2" />
                    Fakturačné spoločnosti
                  </TabsTrigger>
                  <TabsTrigger value="number-ranges" data-testid="subtab-number-ranges">
                    <Hash className="h-4 w-4 mr-2" />
                    {t.konfigurator.numberRanges}
                  </TabsTrigger>
                  <TabsTrigger value="invoice-templates" data-testid="subtab-invoice-templates">
                    <FileText className="h-4 w-4 mr-2" />
                    {t.konfigurator.invoiceTemplates || "Šablóny faktúr"}
                  </TabsTrigger>
                  <TabsTrigger value="contract-templates" data-testid="subtab-contract-templates">
                    <FileText className="h-4 w-4 mr-2" />
                    {t.konfigurator.contractTemplates || "Šablóny zmlúv"}
                  </TabsTrigger>
                  <TabsTrigger value="system-settings" data-testid="subtab-system-settings">
                    <Settings className="h-4 w-4 mr-2" />
                    Systémové nastavenia
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="companies">
                  <BillingCompaniesTab />
                </TabsContent>
                <TabsContent value="number-ranges">
                  <Tabs defaultValue="nr-invoices" className="space-y-4">
                    <TabsList>
                      <TabsTrigger value="nr-invoices" data-testid="subtab-nr-invoices">
                        <FileText className="h-4 w-4 mr-2" />
                        {t.konfigurator.numberRangesInvoices || "Číselníky faktúr"}
                      </TabsTrigger>
                      <TabsTrigger value="nr-contracts" data-testid="subtab-nr-contracts">
                        <FileText className="h-4 w-4 mr-2" />
                        {t.konfigurator.numberRangesContracts || "Číselníky zmlúv"}
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="nr-invoices">
                      <NumberRangesTab mode="invoice" />
                    </TabsContent>
                    <TabsContent value="nr-contracts">
                      <NumberRangesTab mode="contract" />
                    </TabsContent>
                  </Tabs>
                </TabsContent>
                <TabsContent value="invoice-templates">
                  <DocxTemplatesTab />
                </TabsContent>
                <TabsContent value="contract-templates">
                  <ContractTemplatesSection />
                </TabsContent>
                <TabsContent value="system-settings">
                  <CountrySystemSettingsTab />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>


        <TabsContent value="rates-inflation">
          <Card>
            <CardHeader>
              <CardTitle>{t.konfigurator.exchangeRatesAndInflation || "Kurzy & Inflácie"}</CardTitle>
              <CardDescription>{t.konfigurator.exchangeRatesDescription || "Kurzy mien z NBS a ročné miery inflácie"}</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="exchange-rates" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="exchange-rates" data-testid="subtab-exchange-rates">
                    <DollarSign className="h-4 w-4 mr-2" />
                    {t.konfigurator.exchangeRates || "Kurzy mien"}
                  </TabsTrigger>
                  <TabsTrigger value="inflation" data-testid="subtab-inflation">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    {t.konfigurator.inflation || "Inflácie"}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="exchange-rates">
                  <ExchangeRatesTab />
                </TabsContent>
                <TabsContent value="inflation">
                  <InflationTab />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email-router">
          <Card>
            <CardHeader>
              <CardTitle>Email & GSM Router</CardTitle>
              <CardDescription>Konfigurácia pravidiel pre spracovanie emailov a SMS správ</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="email" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="email" data-testid="subtab-email">
                    <Mail className="h-4 w-4 mr-2" />
                    Email
                  </TabsTrigger>
                  <TabsTrigger value="gsm" data-testid="subtab-gsm">
                    <Smartphone className="h-4 w-4 mr-2" />
                    GSM
                  </TabsTrigger>
                  <TabsTrigger value="templates" data-testid="subtab-templates">
                    <FileText className="h-4 w-4 mr-2" />
                    Šablóny
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="email">
                  <EmailRouterTab />
                </TabsContent>
                <TabsContent value="gsm">
                  <GsmSenderTab />
                </TabsContent>
                <TabsContent value="templates">
                  <MessageTemplatesTab />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notifikacie & Alerts</CardTitle>
              <CardDescription>Sprava automatickych notifikacii, upozorneni a alertov</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="notification-rules" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="notification-rules" data-testid="subtab-notification-rules">
                    <Bell className="h-4 w-4 mr-2" />
                    Notifikacne pravidla
                  </TabsTrigger>
                  <TabsTrigger value="alert-rules" data-testid="subtab-alert-rules">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Alert pravidla
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="notification-rules">
                  <NotificationsTab />
                </TabsContent>
                <TabsContent value="alert-rules">
                  <AlertRulesTab />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api-keys">
          <Card>
            <CardHeader>
              <CardTitle>{t.konfigurator.apiKeys}</CardTitle>
              <CardDescription>{t.konfigurator.apiKeysDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <ApiKeysTab />
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
