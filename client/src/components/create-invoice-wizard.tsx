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
  billsetId?: string;
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
  periodFromDay: z.number().min(1).max(31).optional(),
  periodFromMonth: z.number().min(1).max(12).optional(),
  periodFromYear: z.number().min(2000).max(2100).optional(),
  periodToDay: z.number().min(1).max(31).optional(),
  periodToMonth: z.number().min(1).max(12).optional(),
  periodToYear: z.number().min(2000).max(2100).optional(),
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
      periodFromDay: today.getDate(),
      periodFromMonth: today.getMonth() + 1,
      periodFromYear: today.getFullYear(),
      periodToDay: today.getDate(),
      periodToMonth: today.getMonth() + 1,
      periodToYear: today.getFullYear(),
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

  const { data: customer } = useQuery<Customer>({
    queryKey: ["/api/customers", customerId],
    enabled: open && !!customerId,
  });

  const countryCode = customerCountry || customer?.country || "SK";
  const constantSymbols = CONSTANT_SYMBOLS[countryCode] || CONSTANT_SYMBOLS["SK"];

  type ProductSet = {
    id: string;
    name: string;
    productId: string;
    productName?: string;
    countryCode: string | null;
    currency: string;
    totalGrossAmount: string | null;
    totalNetAmount: string | null;
    isActive: boolean;
    calculatedTotals?: {
      totalNetAmount: string;
      totalGrossAmount: string;
      totalVatAmount: string;
      totalDiscountAmount: string;
    };
  };

  type ProductSetDetail = {
    id: string;
    name: string;
    productId: string;
    currency: string;
    totalNetAmount: string | null;
    totalGrossAmount: string | null;
    totalDiscountAmount: string | null;
    totalVatAmount: string | null;
    calculatedTotals?: {
      totalNetAmount: string;
      totalGrossAmount: string;
      totalDiscountAmount: string;
      totalVatAmount: string;
    };
    collections: Array<{
      id: string;
      instanceName: string | null;
      priceName: string | null;
      priceAmount: string | null;
      quantity: number;
      lineNetAmount: string | null;
      lineGrossAmount: string | null;
      lineDiscountAmount: string | null;
      lineVatAmount: string | null;
      discountPercent: string | null;
      discountName: string | null;
      paymentType: string | null;
      vatRate: string | null;
    }>;
    storage: Array<{
      id: string;
      storageName: string | null;
      storageType: string | null;
      serviceName: string | null;
      priceOverride: string | null;
      quantity: number;
      lineNetAmount: string | null;
      lineGrossAmount: string | null;
      lineDiscountAmount: string | null;
      lineVatAmount: string | null;
      discountPercent: string | null;
      discountName: string | null;
      paymentType: string | null;
      vatRate: string | null;
    }>;
  };

  const { data: productSets = [] } = useQuery<ProductSet[]>({
    queryKey: ["/api/product-sets", countryCode, selectedProductId],
    queryFn: async () => {
      let url = `/api/product-sets?country=${encodeURIComponent(countryCode)}`;
      if (selectedProductId) {
        url += `&productId=${encodeURIComponent(selectedProductId)}`;
      }
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: open,
  });

  const [selectedBillsetId, setSelectedBillsetId] = useState<string | null>(null);

  const { data: billsetDetails } = useQuery<ProductSetDetail>({
    queryKey: ["/api/product-sets", selectedBillsetId],
    queryFn: async () => {
      if (!selectedBillsetId) return null;
      const response = await fetch(`/api/product-sets/${selectedBillsetId}`, { credentials: "include" });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!selectedBillsetId,
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    enabled: open && !customerId,
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

  const billingInfo = useMemo(() => {
    return billingDetails.find(b => b.countryCode === countryCode);
  }, [billingDetails, countryCode]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => p.isActive && p.countries.includes(countryCode));
  }, [products, countryCode]);

  const filteredProductSets = useMemo(() => {
    if (!selectedProductId) return [];
    return productSets.filter(ps => 
      ps.isActive && ps.productId === selectedProductId
    );
  }, [productSets, selectedProductId]);

  // Auto-select assigned product from customer
  useEffect(() => {
    if (customerId && customerProducts.length > 0 && !selectedProductId) {
      const assignedProduct = customerProducts[0];
      if (assignedProduct?.productId) {
        setSelectedProductId(assignedProduct.productId);
        // Auto-add assigned billset if available
        if (assignedProduct.billsetId) {
          const billset = productSets.find(ps => ps.id === assignedProduct.billsetId);
          if (billset && items.length === 0) {
            addItemFromBillset(billset);
          }
        }
      }
    }
  }, [customerId, customerProducts, selectedProductId, productSets]);

  const selectedNumberRange = useMemo(() => {
    const rangeId = form.watch("numberRangeId");
    return activeNumberRanges.find(r => r.id === rangeId);
  }, [activeNumberRanges, form.watch("numberRangeId")]);

  const previewInvoiceNumber = useMemo(() => {
    if (!selectedNumberRange) return null;
    const nextNumber = (selectedNumberRange.lastNumberUsed || 0) + 1;
    return `${selectedNumberRange.prefix || ""}${String(nextNumber).padStart(selectedNumberRange.digitsToGenerate || 6, "0")}${selectedNumberRange.suffix || ""}`;
  }, [selectedNumberRange]);


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
    setSelectedProductId("");
    form.reset();
    onClose();
  };

  const handleNumberRangeChange = (numberRangeId: string) => {
    form.setValue("numberRangeId", numberRangeId);
  };

  const setToday = (prefix: "issueDate" | "dueDate" | "deliveryDate" | "periodFrom" | "periodTo") => {
    const now = new Date();
    form.setValue(`${prefix}Day` as any, now.getDate());
    form.setValue(`${prefix}Month` as any, now.getMonth() + 1);
    form.setValue(`${prefix}Year` as any, now.getFullYear());
  };

  const formatCurrencyWithCode = (amount: number, currencyCode: string = "EUR") => {
    const symbols: Record<string, string> = {
      EUR: "€", CZK: "Kč", HUF: "Ft", RON: "lei", USD: "$", GBP: "£"
    };
    const symbol = symbols[currencyCode] || currencyCode;
    return `${currencyCode} ${amount.toFixed(2)}`;
  };

  const addItemFromBillset = (billset: ProductSet) => {
    const totalAmount = billset.totalGrossAmount || billset.totalNetAmount || "0";
    const newItem: InvoiceItem = {
      id: crypto.randomUUID(),
      name: billset.name,
      quantity: 1,
      unitPrice: totalAmount,
      vatRate: billingInfo?.defaultVatRate || "20",
      total: totalAmount,
      billsetId: billset.id,
    };
    setItems(prev => [...prev, newItem]);
    setSelectedBillsetId(billset.id);
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

  const handleSubmit = async () => {
    const values = form.getValues();
    const totals = calculateTotals();

    // Generate invoice number on final submission
    let invoiceNumber = "";
    if (values.numberRangeId) {
      try {
        const response = await apiRequest("POST", `/api/configurator/number-ranges/${values.numberRangeId}/generate`);
        const data = await response.json();
        invoiceNumber = data.invoiceNumber;
      } catch (error) {
        toast({
          title: t.common?.error || "Error",
          description: "Failed to generate invoice number",
          variant: "destructive",
        });
        return;
      }
    }

    const issueDate = new Date(values.issueDateYear, values.issueDateMonth - 1, values.issueDateDay);
    const dueDate = new Date(values.dueDateYear, values.dueDateMonth - 1, values.dueDateDay);
    const deliveryDate = values.deliveryDateYear ? 
      new Date(values.deliveryDateYear, (values.deliveryDateMonth || 1) - 1, values.deliveryDateDay || 1) : null;

    const invoiceData = {
      invoiceNumber,
      customerId: values.customerId || customerId,
      billingDetailsId: billingInfo?.id,
      issueDate: issueDate.toISOString(),
      dueDate: dueDate.toISOString(),
      deliveryDate: deliveryDate?.toISOString(),
      variableSymbol: values.variableSymbol || invoiceNumber,
      constantSymbol: values.constantSymbol,
      specificSymbol: values.specificSymbol,
      barcodeType: values.barcodeType,
      barcodeValue: values.barcodeValue || invoiceNumber,
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
      case 0: return !!form.watch("numberRangeId");
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

                  {selectedNumberRange && previewInvoiceNumber && (
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-muted-foreground">{t.invoices?.nextNumber || "Next Invoice Number"}</Label>
                            <p className="text-2xl font-bold text-muted-foreground" data-testid="text-preview-invoice-number">{previewInvoiceNumber}</p>
                          </div>
                          <Badge variant="outline">{t.invoices?.preview || "Preview"}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {t.invoices?.previewNote || "Final number will be generated when invoice is created"}
                        </p>
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

                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg bg-muted/30">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-primary" />
                          <Label className="font-medium">{t.invoices?.issueDate || "Issue Date"}</Label>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => setToday("issueDate")} data-testid="btn-today-issue">
                          {t.common?.today || "Today"}
                        </Button>
                      </div>
                      <div className="flex gap-2 items-center">
                        <FormField
                          control={form.control}
                          name="issueDateDay"
                          render={({ field }) => (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-muted-foreground">{t.common?.day || "Day"}</span>
                              <Select value={field.value?.toString()} onValueChange={(v) => field.onChange(parseInt(v))}>
                                <SelectTrigger className="w-20" data-testid="select-issue-day">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {days.map((d) => <SelectItem key={d} value={d.toString()}>{d}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="issueDateMonth"
                          render={({ field }) => (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-muted-foreground">{t.common?.month || "Month"}</span>
                              <Select value={field.value?.toString()} onValueChange={(v) => field.onChange(parseInt(v))}>
                                <SelectTrigger className="w-20" data-testid="select-issue-month">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {months.map((m) => <SelectItem key={m} value={m.toString()}>{m}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="issueDateYear"
                          render={({ field }) => (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-muted-foreground">{t.common?.year || "Year"}</span>
                              <Select value={field.value?.toString()} onValueChange={(v) => field.onChange(parseInt(v))}>
                                <SelectTrigger className="w-24" data-testid="select-issue-year">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {years.map((y) => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        />
                      </div>
                    </div>

                    <div className="p-4 border rounded-lg bg-muted/30">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-destructive" />
                          <Label className="font-medium">{t.invoices?.dueDate || "Due Date"}</Label>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => setToday("dueDate")} data-testid="btn-today-due">
                          {t.common?.today || "Today"}
                        </Button>
                      </div>
                      <div className="flex gap-2 items-center">
                        <FormField
                          control={form.control}
                          name="dueDateDay"
                          render={({ field }) => (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-muted-foreground">{t.common?.day || "Day"}</span>
                              <Select value={field.value?.toString()} onValueChange={(v) => field.onChange(parseInt(v))}>
                                <SelectTrigger className="w-20" data-testid="select-due-day">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {days.map((d) => <SelectItem key={d} value={d.toString()}>{d}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="dueDateMonth"
                          render={({ field }) => (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-muted-foreground">{t.common?.month || "Month"}</span>
                              <Select value={field.value?.toString()} onValueChange={(v) => field.onChange(parseInt(v))}>
                                <SelectTrigger className="w-20" data-testid="select-due-month">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {months.map((m) => <SelectItem key={m} value={m.toString()}>{m}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="dueDateYear"
                          render={({ field }) => (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-muted-foreground">{t.common?.year || "Year"}</span>
                              <Select value={field.value?.toString()} onValueChange={(v) => field.onChange(parseInt(v))}>
                                <SelectTrigger className="w-24" data-testid="select-due-year">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {years.map((y) => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        />
                      </div>
                    </div>

                    <div className="p-4 border rounded-lg bg-muted/30">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                          <Label className="font-medium">{t.invoices?.deliveryDate || "Delivery Date"}</Label>
                          <span className="text-xs text-muted-foreground">({t.common?.optional || "optional"})</span>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => setToday("deliveryDate")} data-testid="btn-today-delivery">
                          {t.common?.today || "Today"}
                        </Button>
                      </div>
                      <div className="flex gap-2 items-center">
                        <FormField
                          control={form.control}
                          name="deliveryDateDay"
                          render={({ field }) => (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-muted-foreground">{t.common?.day || "Day"}</span>
                              <Select value={field.value?.toString() || ""} onValueChange={(v) => field.onChange(v ? parseInt(v) : undefined)}>
                                <SelectTrigger className="w-20" data-testid="select-delivery-day">
                                  <SelectValue placeholder="-" />
                                </SelectTrigger>
                                <SelectContent>
                                  {days.map((d) => <SelectItem key={d} value={d.toString()}>{d}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="deliveryDateMonth"
                          render={({ field }) => (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-muted-foreground">{t.common?.month || "Month"}</span>
                              <Select value={field.value?.toString() || ""} onValueChange={(v) => field.onChange(v ? parseInt(v) : undefined)}>
                                <SelectTrigger className="w-20" data-testid="select-delivery-month">
                                  <SelectValue placeholder="-" />
                                </SelectTrigger>
                                <SelectContent>
                                  {months.map((m) => <SelectItem key={m} value={m.toString()}>{m}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="deliveryDateYear"
                          render={({ field }) => (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-muted-foreground">{t.common?.year || "Year"}</span>
                              <Select value={field.value?.toString() || ""} onValueChange={(v) => field.onChange(v ? parseInt(v) : undefined)}>
                                <SelectTrigger className="w-24" data-testid="select-delivery-year">
                                  <SelectValue placeholder="-" />
                                </SelectTrigger>
                                <SelectContent>
                                  {years.map((y) => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        />
                      </div>
                    </div>

                    {/* Billing Period Section Header */}
                    <div className="mt-6 pt-4 border-t">
                      <h4 className="text-sm font-semibold text-primary flex items-center gap-2 mb-4">
                        <CalendarDays className="h-4 w-4" />
                        {t.invoices?.billingPeriod || "Billing Period"} <span className="text-xs font-normal text-muted-foreground">({t.common?.optional || "optional"})</span>
                      </h4>
                    </div>

                    {/* Period From */}
                    <div className="p-4 border rounded-lg bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                          <Label className="font-medium">{t.invoices?.periodFrom || "Period From"}</Label>
                          <span className="text-xs text-muted-foreground">({t.common?.optional || "optional"})</span>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => setToday("periodFrom")} data-testid="btn-today-period-from">
                          {t.common?.today || "Today"}
                        </Button>
                      </div>
                      <div className="flex gap-2 items-center">
                        <FormField
                          control={form.control}
                          name="periodFromDay"
                          render={({ field }) => (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-muted-foreground">{t.common?.day || "Day"}</span>
                              <Select value={field.value?.toString() || ""} onValueChange={(v) => field.onChange(v ? parseInt(v) : undefined)}>
                                <SelectTrigger className="w-20" data-testid="select-period-from-day">
                                  <SelectValue placeholder="-" />
                                </SelectTrigger>
                                <SelectContent>
                                  {days.map((d) => <SelectItem key={d} value={d.toString()}>{d}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="periodFromMonth"
                          render={({ field }) => (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-muted-foreground">{t.common?.month || "Month"}</span>
                              <Select value={field.value?.toString() || ""} onValueChange={(v) => field.onChange(v ? parseInt(v) : undefined)}>
                                <SelectTrigger className="w-20" data-testid="select-period-from-month">
                                  <SelectValue placeholder="-" />
                                </SelectTrigger>
                                <SelectContent>
                                  {months.map((m) => <SelectItem key={m} value={m.toString()}>{m}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="periodFromYear"
                          render={({ field }) => (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-muted-foreground">{t.common?.year || "Year"}</span>
                              <Select value={field.value?.toString() || ""} onValueChange={(v) => field.onChange(v ? parseInt(v) : undefined)}>
                                <SelectTrigger className="w-24" data-testid="select-period-from-year">
                                  <SelectValue placeholder="-" />
                                </SelectTrigger>
                                <SelectContent>
                                  {years.map((y) => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        />
                      </div>
                    </div>

                    {/* Period To */}
                    <div className="p-4 border rounded-lg bg-purple-50/50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-purple-500" />
                          <Label className="font-medium">{t.invoices?.periodTo || "Period To"}</Label>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => setToday("periodTo")} data-testid="btn-today-period-to">
                          {t.common?.today || "Today"}
                        </Button>
                      </div>
                      <div className="flex gap-2 items-center">
                        <FormField
                          control={form.control}
                          name="periodToDay"
                          render={({ field }) => (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-muted-foreground">{t.common?.day || "Day"}</span>
                              <Select value={field.value?.toString() || ""} onValueChange={(v) => field.onChange(v ? parseInt(v) : undefined)}>
                                <SelectTrigger className="w-20" data-testid="select-period-to-day">
                                  <SelectValue placeholder="-" />
                                </SelectTrigger>
                                <SelectContent>
                                  {days.map((d) => <SelectItem key={d} value={d.toString()}>{d}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="periodToMonth"
                          render={({ field }) => (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-muted-foreground">{t.common?.month || "Month"}</span>
                              <Select value={field.value?.toString() || ""} onValueChange={(v) => field.onChange(v ? parseInt(v) : undefined)}>
                                <SelectTrigger className="w-20" data-testid="select-period-to-month">
                                  <SelectValue placeholder="-" />
                                </SelectTrigger>
                                <SelectContent>
                                  {months.map((m) => <SelectItem key={m} value={m.toString()}>{m}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="periodToYear"
                          render={({ field }) => (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-muted-foreground">{t.common?.year || "Year"}</span>
                              <Select value={field.value?.toString() || ""} onValueChange={(v) => field.onChange(v ? parseInt(v) : undefined)}>
                                <SelectTrigger className="w-24" data-testid="select-period-to-year">
                                  <SelectValue placeholder="-" />
                                </SelectTrigger>
                                <SelectContent>
                                  {years.map((y) => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
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
                            <Input {...field} placeholder={previewInvoiceNumber || "..."} data-testid="input-barcode-value" />
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
                              {filteredProductSets.length === 0 ? (
                                <p className="text-muted-foreground text-sm py-2">{t.invoices?.noBillsetsAvailable || "No billsets available for this product"}</p>
                              ) : (
                                filteredProductSets.map((billset) => (
                                  <div 
                                    key={billset.id} 
                                    className={cn(
                                      "flex items-center justify-between p-2 border rounded-md cursor-pointer transition-colors",
                                      selectedBillsetId === billset.id ? "border-primary bg-primary/10" : "hover:bg-muted/50"
                                    )}
                                    onClick={() => setSelectedBillsetId(billset.id)}
                                  >
                                    <div>
                                      <p className="font-medium text-sm">{billset.name}</p>
                                      <div className="flex items-center gap-2 text-xs">
                                        <span className="font-medium">{formatCurrencyWithCode(parseFloat(billset.calculatedTotals?.totalGrossAmount || billset.totalGrossAmount || billset.totalNetAmount || "0"), billset.currency)}</span>
                                      </div>
                                    </div>
                                    <Button
                                      type="button"
                                      variant={items.some(i => i.billsetId === billset.id) ? "default" : "ghost"}
                                      size="icon"
                                      onClick={(e) => { e.stopPropagation(); addItemFromBillset(billset); }}
                                      disabled={items.some(i => i.billsetId === billset.id)}
                                      data-testid={`btn-add-item-${billset.id}`}
                                    >
                                      {items.some(i => i.billsetId === billset.id) ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
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

                  {selectedBillsetId && billsetDetails && (
                    <div className="mt-6 space-y-4">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        {t.konfigurator?.invoicePreview || "Invoice Preview"}
                        <Badge variant="outline" className="ml-2">{billsetDetails.currency}</Badge>
                      </h4>

                      {(billsetDetails.collections?.length || 0) > 0 && (
                        <Card>
                          <CardHeader className="py-3">
                            <CardTitle className="text-sm text-blue-600 dark:text-blue-400">
                              {t.konfigurator?.collectionsInSet || "Collections"}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="space-y-3">
                              {billsetDetails.collections?.map((col, idx) => (
                                <div key={col.id} className="py-2 px-3 rounded bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-400">
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                          {idx + 1}. {col.instanceName || t.konfigurator?.collectionItem || "Collection"}
                                          {col.quantity > 1 && ` (${col.quantity}x)`}
                                        </span>
                                        {col.paymentType && (
                                          <Badge variant={col.paymentType === "installment" ? "secondary" : "outline"} className="text-[10px] px-1 py-0">
                                            {col.paymentType === "installment" ? (t.konfigurator?.installment || "Installment") : (t.konfigurator?.oneTime || "One-time")}
                                          </Badge>
                                        )}
                                      </div>
                                      {col.priceName && (
                                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">{col.priceName}</p>
                                      )}
                                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                        {col.priceAmount && (
                                          <span>{t.konfigurator?.unitPrice || "Unit"}: {formatCurrencyWithCode(parseFloat(col.priceAmount), billsetDetails.currency)}</span>
                                        )}
                                        {col.vatRate && (
                                          <span>{t.konfigurator?.vat || "VAT"}: {col.vatRate}%</span>
                                        )}
                                      </div>
                                      {parseFloat(col.lineDiscountAmount || "0") > 0 && (
                                        <div className="flex items-center gap-1 mt-1">
                                          <Badge variant="destructive" className="text-[10px] px-1 py-0">
                                            -{col.discountPercent}% {col.discountName || t.konfigurator?.discount || "Discount"}
                                          </Badge>
                                          <span className="text-xs text-destructive">
                                            -{formatCurrencyWithCode(parseFloat(col.lineDiscountAmount), billsetDetails.currency)}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                                        {formatCurrencyWithCode(parseFloat(col.lineGrossAmount || col.lineNetAmount || "0"), billsetDetails.currency)}
                                      </span>
                                      {col.lineVatAmount && parseFloat(col.lineVatAmount) > 0 && (
                                        <p className="text-[10px] text-muted-foreground">
                                          {t.konfigurator?.inclVat || "incl. VAT"} {formatCurrencyWithCode(parseFloat(col.lineVatAmount), billsetDetails.currency)}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {(billsetDetails.storage?.length || 0) > 0 && (
                        <Card>
                          <CardHeader className="py-3">
                            <CardTitle className="text-sm text-green-600 dark:text-green-400">
                              {t.konfigurator?.storageInSet || "Storage"}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="space-y-3">
                              {billsetDetails.storage?.map((stor, idx) => (
                                <div key={stor.id} className="py-2 px-3 rounded bg-green-50 dark:bg-green-900/20 border-l-2 border-green-400">
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-green-900 dark:text-green-100">
                                          {idx + 1}. {stor.serviceName || stor.storageName || t.konfigurator?.storageItem || "Storage"}
                                          {stor.quantity > 1 && ` (${stor.quantity}x)`}
                                        </span>
                                        {stor.paymentType && (
                                          <Badge variant={stor.paymentType === "installment" ? "secondary" : "outline"} className="text-[10px] px-1 py-0">
                                            {stor.paymentType === "installment" ? (t.konfigurator?.installment || "Installment") : (t.konfigurator?.oneTime || "One-time")}
                                          </Badge>
                                        )}
                                      </div>
                                      {stor.storageType && (
                                        <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">{stor.storageType}</p>
                                      )}
                                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                        {stor.priceOverride && (
                                          <span>{t.konfigurator?.unitPrice || "Unit"}: {formatCurrencyWithCode(parseFloat(stor.priceOverride), billsetDetails.currency)}</span>
                                        )}
                                        {stor.vatRate && (
                                          <span>{t.konfigurator?.vat || "VAT"}: {stor.vatRate}%</span>
                                        )}
                                      </div>
                                      {parseFloat(stor.lineDiscountAmount || "0") > 0 && (
                                        <div className="flex items-center gap-1 mt-1">
                                          <Badge variant="destructive" className="text-[10px] px-1 py-0">
                                            -{stor.discountPercent}% {stor.discountName || t.konfigurator?.discount || "Discount"}
                                          </Badge>
                                          <span className="text-xs text-destructive">
                                            -{formatCurrencyWithCode(parseFloat(stor.lineDiscountAmount), billsetDetails.currency)}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <span className="text-sm font-semibold text-green-700 dark:text-green-300">
                                        {formatCurrencyWithCode(parseFloat(stor.lineGrossAmount || stor.lineNetAmount || stor.priceOverride || "0"), billsetDetails.currency)}
                                      </span>
                                      {stor.lineVatAmount && parseFloat(stor.lineVatAmount) > 0 && (
                                        <p className="text-[10px] text-muted-foreground">
                                          {t.konfigurator?.inclVat || "incl. VAT"} {formatCurrencyWithCode(parseFloat(stor.lineVatAmount), billsetDetails.currency)}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Invoice Totals */}
                      <Card className="border-2 border-primary/20">
                        <CardContent className="pt-4">
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">{t.konfigurator?.netAmount || "Net Amount"}</span>
                              <span>{formatCurrencyWithCode(parseFloat(billsetDetails.calculatedTotals?.totalNetAmount || billsetDetails.totalNetAmount || "0"), billsetDetails.currency)}</span>
                            </div>
                            {parseFloat(billsetDetails.calculatedTotals?.totalDiscountAmount || billsetDetails.totalDiscountAmount || "0") > 0 && (
                              <div className="flex justify-between text-sm text-destructive">
                                <span>{t.konfigurator?.totalDiscount || "Total Discount"}</span>
                                <span>-{formatCurrencyWithCode(parseFloat(billsetDetails.calculatedTotals?.totalDiscountAmount || billsetDetails.totalDiscountAmount || "0"), billsetDetails.currency)}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">{t.konfigurator?.vatAmount || "VAT Amount"}</span>
                              <span>{formatCurrencyWithCode(parseFloat(billsetDetails.calculatedTotals?.totalVatAmount || billsetDetails.totalVatAmount || "0"), billsetDetails.currency)}</span>
                            </div>
                            <div className="border-t pt-2 mt-2">
                              <div className="flex justify-between font-semibold">
                                <span>{t.konfigurator?.totalGross || "Total (Gross)"}</span>
                                <span className="text-lg">{formatCurrencyWithCode(parseFloat(billsetDetails.calculatedTotals?.totalGrossAmount || billsetDetails.totalGrossAmount || "0"), billsetDetails.currency)}</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
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
                          <span className="font-medium" data-testid="summary-invoice-number">{previewInvoiceNumber} <Badge variant="outline" className="ml-2">{t.invoices?.preview || "Preview"}</Badge></span>
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
