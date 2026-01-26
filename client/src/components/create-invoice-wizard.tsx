import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Receipt, Calendar, CreditCard, Package, FileText, Loader2, Plus, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useI18n } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

const CONSTANT_SYMBOLS: Record<string, { code: string; description: string }[]> = {
  SK: [
    { code: "0008", description: "Platba za tovar" },
    { code: "0308", description: "Platba za služby" },
    { code: "0558", description: "Platba nájomného" },
    { code: "0858", description: "Platba za zdravotnícke služby" },
    { code: "1148", description: "Platba poistného" },
    { code: "0038", description: "Splátka úveru" },
    { code: "1178", description: "Platba príspevkov" },
    { code: "0998", description: "Ostatné platby" },
  ],
  CS: [
    { code: "0008", description: "Platba za zboží" },
    { code: "0308", description: "Platba za služby" },
    { code: "0558", description: "Platba nájemného" },
    { code: "0858", description: "Platba za zdravotnické služby" },
    { code: "1148", description: "Platba pojistného" },
    { code: "0038", description: "Splátka úvěru" },
    { code: "1178", description: "Platba příspěvků" },
    { code: "0998", description: "Ostatní platby" },
  ],
  HU: [
    { code: "HU001", description: "Árufizetés" },
    { code: "HU002", description: "Szolgáltatás díja" },
    { code: "HU003", description: "Bérleti díj" },
    { code: "HU004", description: "Egészségügyi szolgáltatás" },
    { code: "HU005", description: "Biztosítási díj" },
    { code: "HU006", description: "Egyéb" },
  ],
  RO: [
    { code: "RO001", description: "Plată pentru bunuri" },
    { code: "RO002", description: "Plată pentru servicii" },
    { code: "RO003", description: "Chirie" },
    { code: "RO004", description: "Servicii medicale" },
    { code: "RO005", description: "Asigurare" },
    { code: "RO006", description: "Altele" },
  ],
  IT: [
    { code: "IT001", description: "Pagamento merci" },
    { code: "IT002", description: "Pagamento servizi" },
    { code: "IT003", description: "Affitto" },
    { code: "IT004", description: "Servizi sanitari" },
    { code: "IT005", description: "Assicurazione" },
    { code: "IT006", description: "Altro" },
  ],
  DE: [
    { code: "DE001", description: "Warenzahlung" },
    { code: "DE002", description: "Dienstleistung" },
    { code: "DE003", description: "Miete" },
    { code: "DE004", description: "Gesundheitsdienste" },
    { code: "DE005", description: "Versicherung" },
    { code: "DE006", description: "Sonstiges" },
  ],
  US: [
    { code: "US001", description: "Payment for goods" },
    { code: "US002", description: "Payment for services" },
    { code: "US003", description: "Rent payment" },
    { code: "US004", description: "Healthcare services" },
    { code: "US005", description: "Insurance" },
    { code: "US006", description: "Other" },
  ],
};

interface NumberRange {
  id: string;
  name: string;
  countryCode: string;
  year: number;
  type: string;
  prefix?: string;
  suffix?: string;
  digitsToGenerate: number;
  startNumber: number;
  endNumber: number;
  lastNumberUsed: number;
  isActive: boolean;
}

interface Product {
  id: string;
  name: string;
  description?: string;
  countries: string[];
  isActive: boolean;
}

interface InstancePrice {
  id: string;
  instanceId: string;
  instanceType: string;
  countryCode?: string;
  name: string;
  price: string;
  currency: string;
  isActive: boolean;
}

interface MarketProductInstance {
  id: string;
  productId: string;
  countryCode: string;
  name: string;
  isActive: boolean;
}

interface CustomerProduct {
  id: string;
  customerId: string;
  productId: string;
  billsetId?: string;
  product?: Product;
}

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  country?: string;
}

interface BillingDetails {
  id: string;
  companyName: string;
  countryCode: string;
  currency?: string;
  defaultVatRate?: string;
  defaultPaymentTerm?: number;
}

interface InvoiceItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: string;
  vatRate: string;
  total: string;
}

const invoiceSchema = z.object({
  numberRangeId: z.string().min(1, "Number range is required"),
  customerId: z.string().min(1, "Customer is required"),
  issueDateDay: z.number().min(1).max(31),
  issueDateMonth: z.number().min(1).max(12),
  issueDateYear: z.number().min(2000).max(2100),
  dueDateDay: z.number().min(1).max(31),
  dueDateMonth: z.number().min(1).max(12),
  dueDateYear: z.number().min(2000).max(2100),
  deliveryDateDay: z.number().min(1).max(31).optional(),
  deliveryDateMonth: z.number().min(1).max(12).optional(),
  deliveryDateYear: z.number().min(2000).max(2100).optional(),
  variableSymbol: z.string().optional(),
  constantSymbol: z.string().optional(),
  specificSymbol: z.string().optional(),
  barcodeType: z.string().optional(),
  barcodeValue: z.string().optional(),
});

type InvoiceFormData = z.infer<typeof invoiceSchema>;

interface CreateInvoiceWizardProps {
  open: boolean;
  onClose: () => void;
  customerId?: string;
  customerCountry?: string;
  onSuccess?: (invoiceId: string) => void;
}

export function CreateInvoiceWizard({
  open,
  onClose,
  customerId,
  customerCountry,
  onSuccess,
}: CreateInvoiceWizardProps) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [generatedInvoiceNumber, setGeneratedInvoiceNumber] = useState<string>("");
  const [selectedProductId, setSelectedProductId] = useState<string>("");

  const today = new Date();
  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + 14);

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      numberRangeId: "",
      customerId: customerId || "",
      issueDateDay: today.getDate(),
      issueDateMonth: today.getMonth() + 1,
      issueDateYear: today.getFullYear(),
      dueDateDay: dueDate.getDate(),
      dueDateMonth: dueDate.getMonth() + 1,
      dueDateYear: dueDate.getFullYear(),
      deliveryDateDay: today.getDate(),
      deliveryDateMonth: today.getMonth() + 1,
      deliveryDateYear: today.getFullYear(),
      variableSymbol: "",
      constantSymbol: "",
      specificSymbol: "",
      barcodeType: "QR",
      barcodeValue: "",
    },
  });

  const { data: numberRanges = [] } = useQuery<NumberRange[]>({
    queryKey: ["/api/configurator/number-ranges", customerCountry],
    queryFn: async () => {
      const params = customerCountry ? `?countries=${customerCountry}` : "";
      const response = await fetch(`/api/configurator/number-ranges${params}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch number ranges");
      return response.json();
    },
    enabled: open,
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    enabled: open,
  });

  const { data: instancePrices = [] } = useQuery<InstancePrice[]>({
    queryKey: ["/api/configurator/instance-prices"],
    enabled: open,
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    enabled: open && !customerId,
  });

  const { data: customer } = useQuery<Customer>({
    queryKey: ["/api/customers", customerId],
    enabled: open && !!customerId,
  });

  const { data: billingDetails = [] } = useQuery<BillingDetails[]>({
    queryKey: ["/api/billing-details"],
    enabled: open,
  });

  const { data: customerProducts = [] } = useQuery<CustomerProduct[]>({
    queryKey: ["/api/customers", customerId, "products"],
    queryFn: async () => {
      if (!customerId) return [];
      const response = await fetch(`/api/customers/${customerId}/products`, {
        credentials: "include",
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: open && !!customerId,
  });

  const { data: productInstances = [] } = useQuery<MarketProductInstance[]>({
    queryKey: ["/api/products", selectedProductId, "instances"],
    queryFn: async () => {
      if (!selectedProductId) return [];
      const response = await fetch(`/api/products/${selectedProductId}/instances`, {
        credentials: "include",
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: open && !!selectedProductId,
  });

  const activeNumberRanges = useMemo(() => {
    return numberRanges.filter(nr => nr.isActive);
  }, [numberRanges]);

  const countryCode = customerCountry || customer?.country || "SK";
  const constantSymbols = CONSTANT_SYMBOLS[countryCode] || CONSTANT_SYMBOLS["SK"];

  const billingInfo = useMemo(() => {
    return billingDetails.find(b => b.countryCode === countryCode);
  }, [billingDetails, countryCode]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => p.isActive && p.countries.includes(countryCode));
  }, [products, countryCode]);

  const filteredInstancePrices = useMemo(() => {
    if (!selectedProductId || productInstances.length === 0) return [];
    const instanceIds = productInstances
      .filter(pi => pi.isActive && pi.countryCode === countryCode)
      .map(pi => pi.id);
    return instancePrices.filter(ip => 
      ip.isActive && 
      instanceIds.includes(ip.instanceId) &&
      (!ip.countryCode || ip.countryCode === countryCode)
    );
  }, [instancePrices, productInstances, selectedProductId, countryCode]);

  // Auto-select assigned product from customer
  useEffect(() => {
    if (customerId && customerProducts.length > 0 && !selectedProductId) {
      const assignedProduct = customerProducts[0];
      if (assignedProduct?.productId) {
        setSelectedProductId(assignedProduct.productId);
        // Auto-add assigned billset if available
        if (assignedProduct.billsetId) {
          const billset = instancePrices.find(ip => ip.id === assignedProduct.billsetId);
          if (billset && items.length === 0) {
            addItem(billset);
          }
        }
      }
    }
  }, [customerId, customerProducts, selectedProductId, instancePrices]);

  const selectedNumberRange = useMemo(() => {
    const rangeId = form.watch("numberRangeId");
    return activeNumberRanges.find(r => r.id === rangeId);
  }, [activeNumberRanges, form.watch("numberRangeId")]);

  const previewInvoiceNumber = useMemo(() => {
    if (!selectedNumberRange) return null;
    const nextNumber = (selectedNumberRange.lastNumberUsed || 0) + 1;
    return `${selectedNumberRange.prefix || ""}${String(nextNumber).padStart(selectedNumberRange.digitsToGenerate || 6, "0")}${selectedNumberRange.suffix || ""}`;
  }, [selectedNumberRange]);

  const generateInvoiceNumberMutation = useMutation({
    mutationFn: async (numberRangeId: string) => {
      const response = await apiRequest("POST", `/api/configurator/number-ranges/${numberRangeId}/generate`);
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedInvoiceNumber(data.invoiceNumber);
      form.setValue("variableSymbol", data.invoiceNumber);
    },
    onError: () => {
      toast({
        title: t.common?.error || "Error",
        description: "Failed to generate invoice number",
        variant: "destructive",
      });
    },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/invoices", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: t.common?.success || "Success",
        description: t.invoices?.createSuccess || "Invoice created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      onSuccess?.(data.id);
      handleClose();
    },
    onError: () => {
      toast({
        title: t.common?.error || "Error",
        description: t.invoices?.createFailed || "Failed to create invoice",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    setCurrentStep(0);
    setItems([]);
    setGeneratedInvoiceNumber("");
    setSelectedProductId("");
    form.reset();
    onClose();
  };

  const handleNumberRangeChange = (numberRangeId: string) => {
    form.setValue("numberRangeId", numberRangeId);
    if (numberRangeId) {
      generateInvoiceNumberMutation.mutate(numberRangeId);
    }
  };

  const setToday = (prefix: "issueDate" | "dueDate" | "deliveryDate") => {
    const now = new Date();
    form.setValue(`${prefix}Day` as any, now.getDate());
    form.setValue(`${prefix}Month` as any, now.getMonth() + 1);
    form.setValue(`${prefix}Year` as any, now.getFullYear());
  };

  const addItem = (price: InstancePrice) => {
    const newItem: InvoiceItem = {
      id: crypto.randomUUID(),
      name: price.name,
      quantity: 1,
      unitPrice: price.price,
      vatRate: billingInfo?.defaultVatRate || "20",
      total: price.price,
    };
    setItems(prev => [...prev, newItem]);
  };

  const removeItem = (itemId: string) => {
    setItems(prev => prev.filter(i => i.id !== itemId));
  };

  const updateItemQuantity = (itemId: string, quantity: number) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const total = (parseFloat(item.unitPrice) * quantity).toFixed(2);
        return { ...item, quantity, total };
      }
      return item;
    }));
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + parseFloat(item.total), 0);
    const vatRate = parseFloat(billingInfo?.defaultVatRate || "20") / 100;
    const vatAmount = subtotal * vatRate;
    const total = subtotal + vatAmount;
    return { subtotal, vatAmount, total };
  };

  const handleSubmit = () => {
    const values = form.getValues();
    const totals = calculateTotals();

    const issueDate = new Date(values.issueDateYear, values.issueDateMonth - 1, values.issueDateDay);
    const dueDate = new Date(values.dueDateYear, values.dueDateMonth - 1, values.dueDateDay);
    const deliveryDate = values.deliveryDateYear ? 
      new Date(values.deliveryDateYear, (values.deliveryDateMonth || 1) - 1, values.deliveryDateDay || 1) : null;

    const invoiceData = {
      invoiceNumber: generatedInvoiceNumber,
      customerId: values.customerId || customerId,
      billingDetailsId: billingInfo?.id,
      issueDate: issueDate.toISOString(),
      dueDate: dueDate.toISOString(),
      deliveryDate: deliveryDate?.toISOString(),
      variableSymbol: values.variableSymbol,
      constantSymbol: values.constantSymbol,
      specificSymbol: values.specificSymbol,
      barcodeType: values.barcodeType,
      barcodeValue: values.barcodeValue || generatedInvoiceNumber,
      subtotal: totals.subtotal.toFixed(2),
      vatRate: billingInfo?.defaultVatRate || "20",
      vatAmount: totals.vatAmount.toFixed(2),
      totalAmount: totals.total.toFixed(2),
      currency: billingInfo?.currency || "EUR",
      status: "generated",
      paymentTermDays: billingInfo?.defaultPaymentTerm || 14,
      items: items.map(item => ({
        name: item.name,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice,
        vatRate: item.vatRate,
        totalPrice: item.total,
      })),
    };

    createInvoiceMutation.mutate(invoiceData);
  };

  const steps = [
    { id: "number", title: t.invoices?.stepNumber || "Invoice Number", icon: <FileText className="h-4 w-4" /> },
    { id: "dates", title: t.invoices?.stepDates || "Dates", icon: <Calendar className="h-4 w-4" /> },
    { id: "payment", title: t.invoices?.stepPayment || "Payment Details", icon: <CreditCard className="h-4 w-4" /> },
    { id: "items", title: t.invoices?.stepItems || "Items", icon: <Package className="h-4 w-4" /> },
    { id: "summary", title: t.invoices?.stepSummary || "Summary", icon: <Receipt className="h-4 w-4" /> },
  ];

  const canProceed = () => {
    switch (currentStep) {
      case 0: return !!generatedInvoiceNumber;
      case 1: return true;
      case 2: return true;
      case 3: return items.length > 0;
      case 4: return true;
      default: return false;
    }
  };

  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + i - 2);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(locale === "sk" ? "sk-SK" : "en-US", {
      style: "currency",
      currency: billingInfo?.currency || "EUR",
    }).format(amount);
  };

  const totals = calculateTotals();

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            {t.invoices?.createInvoice || "Create Invoice"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{t.common?.step || "Step"} {currentStep + 1} / {steps.length}</span>
              <span>{Math.round(((currentStep + 1) / steps.length) * 100)}%</span>
            </div>
            <Progress value={((currentStep + 1) / steps.length) * 100} className="h-2" />
          </div>

          <div className="flex flex-wrap gap-2">
            {steps.map((step, index) => (
              <button
                key={step.id}
                onClick={() => index < currentStep && setCurrentStep(index)}
                disabled={index > currentStep}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                  index === currentStep && "bg-primary text-primary-foreground",
                  index < currentStep && "bg-primary/10 text-primary cursor-pointer hover-elevate",
                  index > currentStep && "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                )}
                data-testid={`wizard-step-${step.id}`}
              >
                <span className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                  index === currentStep && "bg-primary-foreground text-primary",
                  index < currentStep && "bg-primary text-primary-foreground"
                )}>
                  {index < currentStep ? <Check className="h-3 w-3" /> : index + 1}
                </span>
                <span className="hidden sm:inline">{step.title}</span>
              </button>
            ))}
          </div>

          <Form {...form}>
            <div className="min-h-[300px]">
              {currentStep === 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    {t.invoices?.selectNumberRange || "Select Number Range"}
                  </h3>
                  
                  <FormField
                    control={form.control}
                    name="numberRangeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t.invoices?.numberRange || "Number Range"}</FormLabel>
                        <Select value={field.value} onValueChange={handleNumberRangeChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-number-range">
                              <SelectValue placeholder={t.invoices?.selectNumberRange || "Select number range"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {activeNumberRanges.length === 0 ? (
                              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                                {t.invoices?.noNumberRanges || "No number ranges available"}
                              </div>
                            ) : (
                              activeNumberRanges.map((range) => {
                                const nextNumber = (range.lastNumberUsed || 0) + 1;
                                const formattedNumber = `${range.prefix || ""}${String(nextNumber).padStart(range.digitsToGenerate || 6, "0")}${range.suffix || ""}`;
                                return (
                                  <SelectItem key={range.id} value={range.id}>
                                    <div className="flex flex-col">
                                      <span className="font-medium">{range.name}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {t.invoices?.nextNumber || "Next"}: {formattedNumber}
                                      </span>
                                    </div>
                                  </SelectItem>
                                );
                              })
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {(selectedNumberRange || generatedInvoiceNumber) && (
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-muted-foreground">{t.invoices?.generatedNumber || "Generated Invoice Number"}</Label>
                            {generateInvoiceNumberMutation.isPending ? (
                              <div className="flex items-center gap-2">
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                <span className="text-lg text-muted-foreground">{previewInvoiceNumber}</span>
                              </div>
                            ) : generatedInvoiceNumber ? (
                              <p className="text-2xl font-bold text-primary" data-testid="text-generated-invoice-number">{generatedInvoiceNumber}</p>
                            ) : previewInvoiceNumber ? (
                              <p className="text-2xl font-bold text-muted-foreground" data-testid="text-preview-invoice-number">{previewInvoiceNumber}</p>
                            ) : null}
                          </div>
                          {generatedInvoiceNumber ? (
                            <Badge variant="secondary">{t.invoices?.statusGenerated || "Generated"}</Badge>
                          ) : generateInvoiceNumberMutation.isPending ? (
                            <Badge variant="outline">{t.common?.loading || "Loading..."}</Badge>
                          ) : (
                            <Badge variant="outline">{t.invoices?.preview || "Preview"}</Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {!customerId && (
                    <FormField
                      control={form.control}
                      name="customerId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.customers?.title || "Customer"}</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-customer">
                                <SelectValue placeholder={t.invoices?.selectCustomer || "Select customer"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {customers.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.firstName} {c.lastName}
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
              )}

              {currentStep === 1 && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    {t.invoices?.dateSettings || "Date Settings"}
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>{t.invoices?.issueDate || "Issue Date"}</Label>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setToday("issueDate")} data-testid="btn-today-issue">
                          {t.common?.today || "Today"}
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <FormField
                          control={form.control}
                          name="issueDateDay"
                          render={({ field }) => (
                            <Select value={field.value?.toString()} onValueChange={(v) => field.onChange(parseInt(v))}>
                              <SelectTrigger className="w-20" data-testid="select-issue-day">
                                <SelectValue placeholder={t.common?.day || "Day"} />
                              </SelectTrigger>
                              <SelectContent>
                                {days.map((d) => <SelectItem key={d} value={d.toString()}>{d}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="issueDateMonth"
                          render={({ field }) => (
                            <Select value={field.value?.toString()} onValueChange={(v) => field.onChange(parseInt(v))}>
                              <SelectTrigger className="w-20" data-testid="select-issue-month">
                                <SelectValue placeholder={t.common?.month || "Month"} />
                              </SelectTrigger>
                              <SelectContent>
                                {months.map((m) => <SelectItem key={m} value={m.toString()}>{m}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="issueDateYear"
                          render={({ field }) => (
                            <Select value={field.value?.toString()} onValueChange={(v) => field.onChange(parseInt(v))}>
                              <SelectTrigger className="w-24" data-testid="select-issue-year">
                                <SelectValue placeholder={t.common?.year || "Year"} />
                              </SelectTrigger>
                              <SelectContent>
                                {years.map((y) => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>{t.invoices?.dueDate || "Due Date"}</Label>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setToday("dueDate")} data-testid="btn-today-due">
                          {t.common?.today || "Today"}
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <FormField
                          control={form.control}
                          name="dueDateDay"
                          render={({ field }) => (
                            <Select value={field.value?.toString()} onValueChange={(v) => field.onChange(parseInt(v))}>
                              <SelectTrigger className="w-20" data-testid="select-due-day">
                                <SelectValue placeholder={t.common?.day || "Day"} />
                              </SelectTrigger>
                              <SelectContent>
                                {days.map((d) => <SelectItem key={d} value={d.toString()}>{d}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="dueDateMonth"
                          render={({ field }) => (
                            <Select value={field.value?.toString()} onValueChange={(v) => field.onChange(parseInt(v))}>
                              <SelectTrigger className="w-20" data-testid="select-due-month">
                                <SelectValue placeholder={t.common?.month || "Month"} />
                              </SelectTrigger>
                              <SelectContent>
                                {months.map((m) => <SelectItem key={m} value={m.toString()}>{m}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="dueDateYear"
                          render={({ field }) => (
                            <Select value={field.value?.toString()} onValueChange={(v) => field.onChange(parseInt(v))}>
                              <SelectTrigger className="w-24" data-testid="select-due-year">
                                <SelectValue placeholder={t.common?.year || "Year"} />
                              </SelectTrigger>
                              <SelectContent>
                                {years.map((y) => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>{t.invoices?.deliveryDate || "Delivery Date"}</Label>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setToday("deliveryDate")} data-testid="btn-today-delivery">
                          {t.common?.today || "Today"}
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <FormField
                          control={form.control}
                          name="deliveryDateDay"
                          render={({ field }) => (
                            <Select value={field.value?.toString() || ""} onValueChange={(v) => field.onChange(v ? parseInt(v) : undefined)}>
                              <SelectTrigger className="w-20" data-testid="select-delivery-day">
                                <SelectValue placeholder={t.common?.day || "Day"} />
                              </SelectTrigger>
                              <SelectContent>
                                {days.map((d) => <SelectItem key={d} value={d.toString()}>{d}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="deliveryDateMonth"
                          render={({ field }) => (
                            <Select value={field.value?.toString() || ""} onValueChange={(v) => field.onChange(v ? parseInt(v) : undefined)}>
                              <SelectTrigger className="w-20" data-testid="select-delivery-month">
                                <SelectValue placeholder={t.common?.month || "Month"} />
                              </SelectTrigger>
                              <SelectContent>
                                {months.map((m) => <SelectItem key={m} value={m.toString()}>{m}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="deliveryDateYear"
                          render={({ field }) => (
                            <Select value={field.value?.toString() || ""} onValueChange={(v) => field.onChange(v ? parseInt(v) : undefined)}>
                              <SelectTrigger className="w-24" data-testid="select-delivery-year">
                                <SelectValue placeholder={t.common?.year || "Year"} />
                              </SelectTrigger>
                              <SelectContent>
                                {years.map((y) => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    {t.invoices?.paymentDetails || "Payment Details"}
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="variableSymbol"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.invoices?.variableSymbol || "Variable Symbol"}</FormLabel>
                          <FormControl>
                            <Input {...field} readOnly className="bg-muted" data-testid="input-variable-symbol" />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">{t.invoices?.variableSymbolNote || "Auto-filled from invoice number"}</p>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="constantSymbol"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.invoices?.constantSymbol || "Constant Symbol"}</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-constant-symbol">
                                <SelectValue placeholder={t.invoices?.selectConstantSymbol || "Select"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {constantSymbols.map((cs) => (
                                <SelectItem key={cs.code} value={cs.code}>
                                  {cs.code} - {cs.description}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="specificSymbol"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.invoices?.specificSymbol || "Specific Symbol"} ({t.common?.optional || "Optional"})</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="..." data-testid="input-specific-symbol" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="barcodeType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.invoices?.barcodeType || "Barcode Type"}</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-barcode-type">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="QR">QR Code</SelectItem>
                              <SelectItem value="CODE128">Code 128</SelectItem>
                              <SelectItem value="EAN13">EAN-13</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="barcodeValue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t.invoices?.barcodeValue || "Barcode Value"}</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder={generatedInvoiceNumber || "..."} data-testid="input-barcode-value" />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">{t.invoices?.barcodeValueNote || "Leave empty to use invoice number"}</p>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    {t.invoices?.selectItems || "Select Items"}
                  </h3>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">{t.products?.title || "Product"}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label className="text-sm">{t.invoices?.selectProduct || "Select Product"}</Label>
                          <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                            <SelectTrigger data-testid="select-product" className="mt-1">
                              <SelectValue placeholder={t.invoices?.selectProduct || "Select product"} />
                            </SelectTrigger>
                            <SelectContent>
                              {filteredProducts.length === 0 ? (
                                <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                                  {t.invoices?.noProductsAvailable || "No products available"}
                                </div>
                              ) : (
                                filteredProducts.map((product) => (
                                  <SelectItem key={product.id} value={product.id}>
                                    {product.name}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          {customerId && customerProducts.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {t.invoices?.assignedProduct || "Assigned product loaded automatically"}
                            </p>
                          )}
                        </div>

                        {selectedProductId && (
                          <div>
                            <Label className="text-sm">{t.invoices?.billsets || "Billsets"}</Label>
                            <div className="max-h-[200px] overflow-y-auto space-y-2 mt-2">
                              {filteredInstancePrices.length === 0 ? (
                                <p className="text-muted-foreground text-sm py-2">{t.invoices?.noBillsetsAvailable || "No billsets available for this product"}</p>
                              ) : (
                                filteredInstancePrices.map((price) => (
                                  <div key={price.id} className="flex items-center justify-between p-2 border rounded-md hover:bg-muted/50">
                                    <div>
                                      <p className="font-medium text-sm">{price.name}</p>
                                      <p className="text-xs text-muted-foreground">{formatCurrency(parseFloat(price.price))}</p>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => addItem(price)}
                                      data-testid={`btn-add-item-${price.id}`}
                                    >
                                      <Plus className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">{t.invoices?.selectedItems || "Selected Items"} ({items.length})</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {items.length === 0 ? (
                          <p className="text-muted-foreground text-sm text-center py-4">{t.invoices?.noItemsSelected || "No items selected"}</p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>{t.invoices?.itemName || "Name"}</TableHead>
                                <TableHead className="w-20">{t.invoices?.quantity || "Qty"}</TableHead>
                                <TableHead className="text-right">{t.invoices?.total || "Total"}</TableHead>
                                <TableHead className="w-10"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {items.map((item) => (
                                <TableRow key={item.id}>
                                  <TableCell className="text-sm">{item.name}</TableCell>
                                  <TableCell>
                                    <Input
                                      type="number"
                                      min="1"
                                      value={item.quantity}
                                      onChange={(e) => updateItemQuantity(item.id, parseInt(e.target.value) || 1)}
                                      className="w-16 h-8"
                                      data-testid={`input-qty-${item.id}`}
                                    />
                                  </TableCell>
                                  <TableCell className="text-right">{formatCurrency(parseFloat(item.total))}</TableCell>
                                  <TableCell>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeItem(item.id)}
                                      data-testid={`btn-remove-item-${item.id}`}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Receipt className="h-5 w-5" />
                    {t.invoices?.summary || "Summary"}
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">{t.invoices?.invoiceDetails || "Invoice Details"}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t.invoices?.invoiceNumber || "Invoice Number"}</span>
                          <span className="font-medium" data-testid="summary-invoice-number">{generatedInvoiceNumber}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t.invoices?.issueDate || "Issue Date"}</span>
                          <span>{form.getValues("issueDateDay")}.{form.getValues("issueDateMonth")}.{form.getValues("issueDateYear")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t.invoices?.dueDate || "Due Date"}</span>
                          <span>{form.getValues("dueDateDay")}.{form.getValues("dueDateMonth")}.{form.getValues("dueDateYear")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t.invoices?.variableSymbol || "Variable Symbol"}</span>
                          <span>{form.getValues("variableSymbol")}</span>
                        </div>
                        {form.getValues("constantSymbol") && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t.invoices?.constantSymbol || "Constant Symbol"}</span>
                            <span>{form.getValues("constantSymbol")}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">{t.invoices?.amounts || "Amounts"}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t.invoices?.subtotal || "Subtotal"}</span>
                          <span data-testid="summary-subtotal">{formatCurrency(totals.subtotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t.invoices?.vatAmount || "VAT"} ({billingInfo?.defaultVatRate || "20"}%)</span>
                          <span data-testid="summary-vat">{formatCurrency(totals.vatAmount)}</span>
                        </div>
                        <div className="flex justify-between border-t pt-2">
                          <span className="font-semibold">{t.invoices?.totalAmount || "Total"}</span>
                          <span className="font-bold text-lg text-primary" data-testid="summary-total">{formatCurrency(totals.total)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">{t.invoices?.items || "Items"} ({items.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t.invoices?.itemName || "Name"}</TableHead>
                            <TableHead className="text-right">{t.invoices?.quantity || "Qty"}</TableHead>
                            <TableHead className="text-right">{t.invoices?.unitPrice || "Unit Price"}</TableHead>
                            <TableHead className="text-right">{t.invoices?.total || "Total"}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{item.name}</TableCell>
                              <TableCell className="text-right">{item.quantity}</TableCell>
                              <TableCell className="text-right">{formatCurrency(parseFloat(item.unitPrice))}</TableCell>
                              <TableCell className="text-right">{formatCurrency(parseFloat(item.total))}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </Form>

          <div className="flex justify-between border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              data-testid="btn-cancel"
            >
              {t.common?.cancel || "Cancel"}
            </Button>
            
            <div className="flex gap-2">
              {currentStep > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(prev => prev - 1)}
                  data-testid="btn-previous"
                >
                  {t.common?.previous || "Previous"}
                </Button>
              )}
              
              {currentStep < steps.length - 1 ? (
                <Button
                  type="button"
                  onClick={() => setCurrentStep(prev => prev + 1)}
                  disabled={!canProceed()}
                  data-testid="btn-next"
                >
                  {t.common?.next || "Next"}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={createInvoiceMutation.isPending || !canProceed()}
                  data-testid="btn-create-invoice"
                >
                  {createInvoiceMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {t.invoices?.createInvoice || "Create Invoice"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
