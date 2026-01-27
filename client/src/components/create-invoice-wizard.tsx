import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import QRCode from "qrcode";
import { Receipt, Calendar, CalendarDays, CreditCard, Package, FileText, Loader2, Plus, Trash2, Check } from "lucide-react";
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
  countryCodes?: string[];
  currency?: string;
  defaultVatRate?: string;
  defaultPaymentTerm?: number;
  bankIban?: string;
  bankSwift?: string;
  bankName?: string;
}

interface BillingAccount {
  id: string;
  billingDetailsId: string;
  name: string;
  bankName: string;
  iban: string;
  swift: string;
  currency: string;
  isDefault: boolean;
  isActive: boolean;
}

interface InvoiceItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: string;
  vatRate: string;
  total: string;
  billsetId?: string;
  paymentType?: string; // "installment" | "oneTime" | null
  installmentCount?: number;
  frequency?: string; // "monthly" | "yearly" etc
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
  const [isAddingBillset, setIsAddingBillset] = useState<string | null>(null);
  const [billsetLoaded, setBillsetLoaded] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  
  // Reset state when wizard opens
  useEffect(() => {
    if (open) {
      console.log("[Invoice v2.3] Wizard opened - resetting state");
      setItems([]);
      setBillsetLoaded(false);
      setCurrentStep(0);
      setSelectedProductId("");
    }
  }, [open]);

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

  type ProductSetCollection = {
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
    installmentCount: number | null;
    frequency: string | null;
  };

  type ProductSetStorage = {
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
    installmentCount: number | null;
    frequency: string | null;
  };

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
    collections?: ProductSetCollection[];
    storage?: ProductSetStorage[];
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
  const [selectedBillingCompanyId, setSelectedBillingCompanyId] = useState<string>("");
  const [selectedBillingAccountId, setSelectedBillingAccountId] = useState<string>("");

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

  // Filter billing companies by customer country
  const filteredBillingCompanies = useMemo(() => {
    return billingDetails.filter(b => 
      b.countryCode === countryCode || 
      (b.countryCodes && b.countryCodes.includes(countryCode))
    );
  }, [billingDetails, countryCode]);

  // Query billing accounts for selected billing company
  const { data: billingAccounts = [] } = useQuery<BillingAccount[]>({
    queryKey: ["/api/billing-details", selectedBillingCompanyId, "accounts"],
    queryFn: async () => {
      if (!selectedBillingCompanyId) return [];
      const response = await fetch(`/api/billing-details/${selectedBillingCompanyId}/accounts`, {
        credentials: "include",
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: open && !!selectedBillingCompanyId,
  });

  // Auto-select default billing company when filtered companies change
  useEffect(() => {
    if (filteredBillingCompanies.length > 0 && !selectedBillingCompanyId) {
      setSelectedBillingCompanyId(filteredBillingCompanies[0].id);
    }
  }, [filteredBillingCompanies, selectedBillingCompanyId]);

  // Auto-select default billing account when accounts load
  useEffect(() => {
    if (billingAccounts.length > 0 && !selectedBillingAccountId) {
      const defaultAccount = billingAccounts.find(a => a.isDefault) || billingAccounts[0];
      setSelectedBillingAccountId(defaultAccount.id);
    }
  }, [billingAccounts, selectedBillingAccountId]);

  // Get selected billing account details
  const selectedBillingAccount = useMemo(() => {
    return billingAccounts.find(a => a.id === selectedBillingAccountId);
  }, [billingAccounts, selectedBillingAccountId]);

  // Get selected billing company details  
  const selectedBillingCompany = useMemo(() => {
    return filteredBillingCompanies.find(b => b.id === selectedBillingCompanyId);
  }, [filteredBillingCompanies, selectedBillingCompanyId]);

  const billingInfo = useMemo(() => {
    return billingDetails.find(b => b.countryCode === countryCode);
  }, [billingDetails, countryCode]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => p.isActive && p.countries.includes(countryCode));
  }, [products, countryCode]);

  const filteredProductSets = useMemo(() => {
    if (!selectedProductId) return [];
    // API already filters by productId, just filter by isActive
    console.log("[Invoice v2.6] productSets:", productSets.length, "selectedProductId:", selectedProductId);
    const filtered = productSets.filter(ps => ps.isActive);
    console.log("[Invoice v2.6] filteredProductSets:", filtered.length);
    return filtered;
  }, [productSets, selectedProductId]);

  // Auto-select assigned product and load billset components - runs ONCE on mount
  useEffect(() => {
    console.log("[Invoice v2.6] useEffect triggered - customerId:", customerId, "customerProducts:", customerProducts.length, "billsetLoaded:", billsetLoaded);
    if (customerId && customerProducts.length > 0 && !billsetLoaded) {
      const assignedProduct = customerProducts[0];
      console.log("[Invoice v2.6] Assigned product:", assignedProduct);
      if (assignedProduct?.productId) {
        setSelectedProductId(assignedProduct.productId);
        // Auto-add assigned billset if available
        if (assignedProduct.billsetId) {
          const billset = productSets.find(ps => ps.id === assignedProduct.billsetId);
          console.log("[Invoice v2.6] Found billset:", billset?.name);
          if (billset) {
            setBillsetLoaded(true);
            // Clear items and load billset components
            setItems([]);
            // Use void to properly handle async function in useEffect
            addItemFromBillset(billset);
          }
        }
      }
    }
  }, [customerId, customerProducts, productSets, billsetLoaded]);

  const selectedNumberRange = useMemo(() => {
    const rangeId = form.watch("numberRangeId");
    return activeNumberRanges.find(r => r.id === rangeId);
  }, [activeNumberRanges, form.watch("numberRangeId")]);

  const previewInvoiceNumber = useMemo(() => {
    if (!selectedNumberRange) return null;
    const nextNumber = (selectedNumberRange.lastNumberUsed || 0) + 1;
    return `${selectedNumberRange.prefix || ""}${String(nextNumber).padStart(selectedNumberRange.digitsToGenerate || 6, "0")}${selectedNumberRange.suffix || ""}`;
  }, [selectedNumberRange]);

  // Auto-fill variable symbol from invoice number
  useEffect(() => {
    if (previewInvoiceNumber && !form.getValues("variableSymbol")) {
      form.setValue("variableSymbol", previewInvoiceNumber);
    }
  }, [previewInvoiceNumber, form]);

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

  const addItemFromBillset = async (billset: ProductSet) => {
    console.log("[Invoice v2.7] addItemFromBillset called for:", billset.id, billset.name);
    setIsAddingBillset(billset.id);
    
    try {
      // Fetch detailed billset data with enriched vatRate from API
      const response = await fetch(`/api/product-sets/${billset.id}`, { credentials: "include" });
      if (!response.ok) {
        throw new Error("Failed to fetch billset details");
      }
      const detailedBillset = await response.json();
      console.log("[Invoice v2.8] Fetched billset details:", JSON.stringify({
        id: detailedBillset.id,
        name: detailedBillset.name,
        collectionsCount: detailedBillset.collections?.length || 0,
        storageCount: detailedBillset.storage?.length || 0,
        collections: detailedBillset.collections?.map((c: any) => ({ 
          instanceName: c.instanceName, 
          paymentType: c.paymentType,
          paymentOptionId: c.paymentOptionId
        })),
        storage: detailedBillset.storage?.map((s: any) => ({ 
          serviceName: s.serviceName, 
          paymentType: s.paymentType,
          paymentOptionId: s.paymentOptionId
        }))
      }, null, 2));
      
      const newItems: InvoiceItem[] = [];
      
      // Add collection components with vatRate from API
      if (detailedBillset.collections && detailedBillset.collections.length > 0) {
        for (const col of detailedBillset.collections) {
          // Use lineGrossAmount for VAT items, lineNetAmount for non-VAT items
          const vatRateValue = col.vatRate !== undefined && col.vatRate !== null && col.vatRate !== "" 
            ? String(col.vatRate) 
            : "0";
          const hasVat = parseFloat(vatRateValue) > 0;
          const itemTotal = hasVat 
            ? (col.lineGrossAmount || col.lineNetAmount || col.priceAmount || "0")
            : (col.lineNetAmount || col.priceAmount || "0");
          const discountInfo = parseFloat(col.lineDiscountAmount || "0") > 0 
            ? ` (-${col.discountPercent}% ${col.discountName || ""})` 
            : "";
          const paymentInfo = col.paymentType === "installment" ? " [Splátka]" : "";
          const qty = col.quantity || 1;
          
          console.log(`[Invoice v2.8] Collection ${col.instanceName}: vatRate=${vatRateValue}, total=${itemTotal}, hasVat=${hasVat}, paymentType=${col.paymentType}`);
          
          newItems.push({
            id: crypto.randomUUID(),
            name: `${col.instanceName || "Odber"}${paymentInfo}${discountInfo}`,
            quantity: qty,
            unitPrice: (parseFloat(itemTotal) / qty).toFixed(2),
            vatRate: vatRateValue,
            total: itemTotal,
            billsetId: billset.id,
            paymentType: col.paymentType || null,
            installmentCount: col.installmentCount || (col.paymentType === "installment" ? 6 : undefined),
            frequency: col.frequency || (col.paymentType === "installment" ? "monthly" : undefined),
          });
        }
      }
      
      // Add storage components with vatRate from API
      if (detailedBillset.storage && detailedBillset.storage.length > 0) {
        for (const stor of detailedBillset.storage) {
          // Use lineGrossAmount for VAT items, lineNetAmount for non-VAT items
          const vatRateValue = stor.vatRate !== undefined && stor.vatRate !== null && stor.vatRate !== "" 
            ? String(stor.vatRate) 
            : "0";
          const hasVat = parseFloat(vatRateValue) > 0;
          const itemTotal = hasVat 
            ? (stor.lineGrossAmount || stor.lineNetAmount || stor.priceOverride || "0")
            : (stor.lineNetAmount || stor.priceOverride || "0");
          const discountInfo = parseFloat(stor.lineDiscountAmount || "0") > 0 
            ? ` (-${stor.discountPercent}% ${stor.discountName || ""})` 
            : "";
          const paymentInfo = stor.paymentType === "installment" ? " [Splátka]" : "";
          const qty = stor.quantity || 1;
          
          console.log(`[Invoice v2.8] Storage ${stor.serviceName}: vatRate=${vatRateValue}, total=${itemTotal}, hasVat=${hasVat}, paymentType=${stor.paymentType}`);
          
          newItems.push({
            id: crypto.randomUUID(),
            name: `${stor.serviceName || stor.storageName || "Uskladnenie"}${paymentInfo}${discountInfo}`,
            quantity: qty,
            unitPrice: (parseFloat(itemTotal) / qty).toFixed(2),
            vatRate: vatRateValue,
            total: itemTotal,
            billsetId: billset.id,
            paymentType: stor.paymentType || null,
            installmentCount: stor.installmentCount || (stor.paymentType === "installment" ? 6 : undefined),
            frequency: stor.frequency || (stor.paymentType === "installment" ? "monthly" : undefined),
          });
        }
      }
      
      // If no components found, add single summary item
      if (newItems.length === 0) {
        const totalAmount = detailedBillset.calculatedTotals?.totalGrossAmount || detailedBillset.totalGrossAmount || detailedBillset.totalNetAmount || "0";
        console.log("[Invoice v2.7] No components found, adding summary item with total:", totalAmount);
        newItems.push({
          id: crypto.randomUUID(),
          name: billset.name,
          quantity: 1,
          unitPrice: totalAmount,
          vatRate: billingInfo?.defaultVatRate || "20",
          total: totalAmount,
          billsetId: billset.id,
        });
      }
      
      console.log("[Invoice v2.8] Adding", newItems.length, "items from billset with paymentTypes:", newItems.map(i => ({ name: i.name, paymentType: i.paymentType })));
      setItems(prev => [...prev, ...newItems]);
      setSelectedBillsetId(billset.id);
    } catch (error) {
      console.error("[Invoice v2.7] Failed to add billset:", error);
      toast({
        title: t.common?.error || "Error",
        description: "Failed to load billset details",
        variant: "destructive",
      });
    } finally {
      setIsAddingBillset(null);
    }
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
    const total = items.reduce((sum, item) => sum + parseFloat(item.total), 0);
    const vatAmount = items.reduce((sum, item) => {
      const itemTotal = parseFloat(item.total);
      const itemVatRate = parseFloat(item.vatRate || "0") / 100;
      return sum + (itemTotal * itemVatRate / (1 + itemVatRate));
    }, 0);
    const subtotal = total - vatAmount;
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
    { id: "dates", title: t.invoices?.stepCompanyDates || "Billing Company & Dates", icon: <Calendar className="h-4 w-4" /> },
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

  // Watch form values for QR code generation
  const barcodeType = form.watch("barcodeType");
  const variableSymbol = form.watch("variableSymbol");
  const constantSymbol = form.watch("constantSymbol");
  const specificSymbol = form.watch("specificSymbol");

  // Generate real QR code for payment
  useEffect(() => {
    const generateQRCode = async () => {
      if (barcodeType !== "QR") {
        setQrCodeDataUrl("");
        return;
      }
      
      const vs = variableSymbol || previewInvoiceNumber || "";
      const ks = constantSymbol || "";
      const ss = specificSymbol || "";
      const amount = totals.total;
      // Use selected billing account IBAN, fallback to billing company bankIban
      const iban = selectedBillingAccount?.iban || selectedBillingCompany?.bankIban || billingInfo?.bankIban || "";
      const swift = selectedBillingAccount?.swift || selectedBillingCompany?.bankSwift || "";
      const currency = selectedBillingAccount?.currency || selectedBillingCompany?.currency || "EUR";
      
      // PAY by Square format: SPD*1.0*ACC:IBAN+SWIFT*AM:AMOUNT*CC:CURRENCY*X-VS:VS*X-KS:KS*X-SS:SS
      let qrData = `SPD*1.0*ACC:${iban}`;
      if (swift) {
        qrData += `+${swift}`;
      }
      qrData += `*AM:${amount.toFixed(2)}*CC:${currency}*X-VS:${vs}`;
      if (ks) qrData += `*X-KS:${ks}`;
      if (ss) qrData += `*X-SS:${ss}`;
      
      try {
        const dataUrl = await QRCode.toDataURL(qrData, { 
          width: 200, 
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' }
        });
        setQrCodeDataUrl(dataUrl);
      } catch (err) {
        console.error("QR code generation error:", err);
        setQrCodeDataUrl("");
      }
    };
    
    generateQRCode();
  }, [barcodeType, variableSymbol, constantSymbol, specificSymbol, totals.total, selectedBillingAccount, selectedBillingCompany, billingInfo, previewInvoiceNumber]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
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
                  {/* Billing Company Selection - First */}
                  <div className="p-4 border rounded-lg bg-muted/30">
                    <h3 className="text-lg font-semibold flex items-center gap-2 pb-2 border-b mb-4">
                      <Receipt className="h-5 w-5" />
                      {t.invoices?.billingCompany || "Billing Company"}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t.invoices?.selectBillingCompany || "Select Company"}</Label>
                        <Select 
                          value={selectedBillingCompanyId} 
                          onValueChange={(v) => {
                            setSelectedBillingCompanyId(v);
                            setSelectedBillingAccountId("");
                          }}
                        >
                          <SelectTrigger data-testid="select-billing-company">
                            <SelectValue placeholder={t.invoices?.selectCompany || "Select company"} />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredBillingCompanies.map((company) => (
                              <SelectItem key={company.id} value={company.id}>
                                {company.companyName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedBillingCompany && (
                          <p className="text-xs text-muted-foreground">
                            {t.invoices?.country || "Country"}: {selectedBillingCompany.countryCode}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>{t.invoices?.bankAccount || "Bank Account"}</Label>
                        <Select 
                          value={selectedBillingAccountId} 
                          onValueChange={setSelectedBillingAccountId}
                          disabled={billingAccounts.length === 0}
                        >
                          <SelectTrigger data-testid="select-billing-account">
                            <SelectValue placeholder={billingAccounts.length === 0 ? (t.invoices?.noAccounts || "No accounts") : (t.invoices?.selectAccount || "Select account")} />
                          </SelectTrigger>
                          <SelectContent>
                            {billingAccounts.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.name} ({account.currency})
                                {account.isDefault && <Badge variant="secondary" className="ml-2 text-[10px]">{t.common?.default || "Default"}</Badge>}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedBillingAccount && (
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            <p><span className="font-medium">IBAN:</span> {selectedBillingAccount.iban}</p>
                            {selectedBillingAccount.swift && <p><span className="font-medium">SWIFT:</span> {selectedBillingAccount.swift}</p>}
                            <p><span className="font-medium">{t.invoices?.bank || "Bank"}:</span> {selectedBillingAccount.bankName}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Column - Date Settings */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold flex items-center gap-2 pb-2 border-b">
                        <Calendar className="h-5 w-5" />
                        {t.invoices?.dateSettings || "Date Settings"}
                      </h3>

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
                    </div>

                    {/* Right Column - Billing Period */}
                    <div className="space-y-4 lg:border-l lg:pl-6">
                      <h3 className="text-lg font-semibold flex items-center gap-2 pb-2 border-b">
                        <CalendarDays className="h-5 w-5" />
                        {t.invoices?.billingPeriod || "Billing Period"}
                        <span className="text-xs font-normal text-muted-foreground">({t.common?.optional || "optional"})</span>
                      </h3>

                      {/* Period From */}
                      <div className="p-4 border rounded-lg bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                            <Label className="font-medium">{t.invoices?.periodFrom || "Period From"}</Label>
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
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    {t.invoices?.paymentDetails || "Payment Details"}
                  </h3>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left - Payment Symbols */}
                    <div className="space-y-4">
                      <Card>
                        <CardHeader className="py-3">
                          <CardTitle className="text-sm">{t.invoices?.paymentSymbols || "Payment Symbols"}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <FormField
                            control={form.control}
                            name="variableSymbol"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t.invoices?.variableSymbol || "Variable Symbol"}</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Input {...field} readOnly className="bg-muted font-mono text-lg pr-40" data-testid="input-variable-symbol" />
                                    {previewInvoiceNumber && (
                                      <Badge variant="secondary" className="absolute right-2 top-1/2 -translate-y-1/2 text-xs">
                                        {t.invoices?.invoice || "Invoice"} #{previewInvoiceNumber}
                                      </Badge>
                                    )}
                                  </div>
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
                        </CardContent>
                      </Card>
                    </div>

                    {/* Right - Barcode Preview */}
                    <div className="space-y-4">
                      <Card>
                        <CardHeader className="py-3">
                          <CardTitle className="text-sm">{t.invoices?.barcodePreview || "Barcode Preview"}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
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
                                    <SelectItem value="QR">QR Code (PAY by Square)</SelectItem>
                                    <SelectItem value="CODE128">Code 128</SelectItem>
                                    <SelectItem value="EAN13">EAN-13</SelectItem>
                                    <SelectItem value="DATAMATRIX">Data Matrix</SelectItem>
                                    <SelectItem value="PDF417">PDF417</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />

                          {/* Barcode Visual Preview */}
                          <div className="border rounded-lg p-4 bg-white dark:bg-gray-900">
                            <div className="flex items-center justify-center min-h-[160px]">
                              {form.watch("barcodeType") === "QR" ? (
                                <div className="text-center">
                                  {qrCodeDataUrl ? (
                                    <img 
                                      src={qrCodeDataUrl} 
                                      alt="Payment QR Code" 
                                      className="w-32 h-32 mx-auto rounded"
                                      data-testid="qr-code-preview"
                                    />
                                  ) : (
                                    <div className="w-32 h-32 mx-auto border-2 border-dashed border-muted-foreground/50 rounded flex items-center justify-center bg-muted/20">
                                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                    </div>
                                  )}
                                  <p className="text-xs text-muted-foreground mt-2">PAY by Square QR</p>
                                </div>
                              ) : form.watch("barcodeType") === "CODE128" ? (
                                <div className="text-center">
                                  <div className="flex items-end justify-center gap-0.5 h-16 px-4 py-2 bg-white rounded">
                                    {Array.from({ length: 40 }).map((_, i) => (
                                      <div key={i} className="bg-black" style={{ width: i % 3 === 0 ? '2px' : '1px', height: `${50 + (i % 5) * 3}px` }} />
                                    ))}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-2">Code 128 Barcode</p>
                                </div>
                              ) : form.watch("barcodeType") === "EAN13" ? (
                                <div className="text-center">
                                  <div className="flex items-end justify-center gap-0.5 h-16 px-4 py-2 bg-white rounded">
                                    {Array.from({ length: 95 }).map((_, i) => (
                                      <div key={i} className="bg-black" style={{ width: '1px', height: i === 0 || i === 2 || i === 46 || i === 48 || i === 92 || i === 94 ? '56px' : '48px' }} />
                                    ))}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-2">EAN-13 Barcode</p>
                                </div>
                              ) : (
                                <div className="text-center text-muted-foreground">
                                  <p>{t.invoices?.selectBarcodeType || "Select barcode type"}</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Barcode Data Components */}
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">{t.invoices?.barcodeData || "Barcode Data Components"}</Label>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between p-2 rounded bg-muted/50">
                                <span className="text-muted-foreground">Variable Symbol:</span>
                                <span className="font-mono">{form.watch("variableSymbol") || previewInvoiceNumber || "-"}</span>
                              </div>
                              <div className="flex justify-between p-2 rounded bg-muted/50">
                                <span className="text-muted-foreground">Constant Symbol:</span>
                                <span className="font-mono">{form.watch("constantSymbol") || "-"}</span>
                              </div>
                              <div className="flex justify-between p-2 rounded bg-muted/50">
                                <span className="text-muted-foreground">Specific Symbol:</span>
                                <span className="font-mono">{form.watch("specificSymbol") || "-"}</span>
                              </div>
                              <div className="flex justify-between p-2 rounded bg-muted/50">
                                <span className="text-muted-foreground">{t.invoices?.amount || "Amount"}:</span>
                                <span className="font-mono font-semibold">{formatCurrency(totals.total)}</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    {t.invoices?.selectItems || "Select Items"}
                  </h3>

                  <div className="grid grid-cols-1 lg:grid-cols-[30%_70%] gap-6">
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
                                      disabled={items.some(i => i.billsetId === billset.id) || isAddingBillset === billset.id}
                                      data-testid={`btn-add-item-${billset.id}`}
                                    >
                                      {isAddingBillset === billset.id ? <Loader2 className="h-4 w-4 animate-spin" /> : items.some(i => i.billsetId === billset.id) ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
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
                        <CardTitle className="text-sm flex items-center gap-2">
                          {t.invoices?.selectedItems || "Selected Items"} ({items.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {items.length === 0 ? (
                          <p className="text-muted-foreground text-sm text-center py-4">{t.invoices?.noItemsSelected || "No items selected"}</p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>{t.invoices?.itemName || "Name"}</TableHead>
                                <TableHead className="w-16 text-right">{t.invoices?.quantity || "Qty"}</TableHead>
                                <TableHead className="text-right">{t.konfigurator?.unitPrice || "Unit"}</TableHead>
                                <TableHead className="w-16 text-center">{t.konfigurator?.vat || "VAT"}</TableHead>
                                <TableHead className="text-right">{t.invoices?.total || "Total"}</TableHead>
                                <TableHead className="w-10"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {items.map((item) => (
                                <TableRow key={item.id}>
                                  <TableCell className="text-sm font-medium">{item.name}</TableCell>
                                  <TableCell className="text-right">
                                    <Input
                                      type="number"
                                      min="1"
                                      value={item.quantity}
                                      onChange={(e) => updateItemQuantity(item.id, parseInt(e.target.value) || 1)}
                                      className="w-14 h-7 text-right text-sm"
                                      data-testid={`input-qty-${item.id}`}
                                    />
                                  </TableCell>
                                  <TableCell className="text-right text-sm text-muted-foreground">{formatCurrency(parseFloat(item.unitPrice))}</TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant="outline" className="text-xs">{item.vatRate}%</Badge>
                                  </TableCell>
                                  <TableCell className="text-right font-medium">{formatCurrency(parseFloat(item.total))}</TableCell>
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
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                          {idx + 1}. {col.instanceName || t.konfigurator?.collectionItem || "Collection"}
                                          {col.quantity > 1 && ` (${col.quantity}x)`}
                                        </span>
                                        {col.paymentType && (
                                          <Badge variant={col.paymentType === "installment" ? "secondary" : "outline"} className="text-[10px] px-1 py-0">
                                            {col.paymentType === "installment" ? (t.konfigurator?.installment || "Installment") : (t.konfigurator?.oneTime || "One-time")}
                                          </Badge>
                                        )}
                                        {col.paymentType === "installment" && col.installmentCount && (
                                          <Badge variant="outline" className="text-[10px] px-1 py-0 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-300">
                                            {col.installmentCount}x {col.frequency === "monthly" ? (t.konfigurator?.monthly || "monthly") : col.frequency}
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
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-medium text-green-900 dark:text-green-100">
                                          {idx + 1}. {stor.serviceName || stor.storageName || t.konfigurator?.storageItem || "Storage"}
                                          {stor.quantity > 1 && ` (${stor.quantity}x)`}
                                        </span>
                                        {stor.paymentType && (
                                          <Badge variant={stor.paymentType === "installment" ? "secondary" : "outline"} className="text-[10px] px-1 py-0">
                                            {stor.paymentType === "installment" ? (t.konfigurator?.installment || "Installment") : (t.konfigurator?.oneTime || "One-time")}
                                          </Badge>
                                        )}
                                        {stor.paymentType === "installment" && stor.installmentCount && (
                                          <Badge variant="outline" className="text-[10px] px-1 py-0 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-300">
                                            {stor.installmentCount}x {stor.frequency === "monthly" ? (t.konfigurator?.monthly || "monthly") : stor.frequency}
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
                        {/* Show VAT rates breakdown */}
                        {(() => {
                          const vatRates = [...new Set(items.map(item => item.vatRate))];
                          return vatRates.map(rate => {
                            const rateItems = items.filter(item => item.vatRate === rate);
                            const rateVatAmount = rateItems.reduce((sum, item) => {
                              const net = parseFloat(item.unitPrice) * item.quantity;
                              return sum + (net * parseFloat(rate) / 100);
                            }, 0);
                            return (
                              <div key={rate} className="flex justify-between">
                                <span className="text-muted-foreground flex items-center gap-2">
                                  {t.invoices?.vatAmount || "VAT"} 
                                  <Badge variant="outline" className="text-xs">{rate}%</Badge>
                                </span>
                                <span>{formatCurrency(rateVatAmount)}</span>
                              </div>
                            );
                          });
                        })()}
                        <div className="flex justify-between border-t pt-2">
                          <span className="font-semibold">{t.invoices?.totalAmount || "Total"}</span>
                          <span className="font-bold text-lg text-primary" data-testid="summary-total">{formatCurrency(totals.total)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Invoice Generation Plan - Multi-invoice breakdown */}
                  {items.some(item => item.paymentType === 'installment') && (
                    <Card className="border-2 border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10">
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 text-purple-600" />
                          {t.invoices?.invoiceGenerationPlan || "Invoice Generation Plan"}
                          <Badge variant="secondary" className="ml-2">{t.invoices?.multiInvoice || "Multi-Invoice"}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {(() => {
                          const installmentItems = items.filter(item => item.paymentType === 'installment');
                          const oneTimeItems = items.filter(item => item.paymentType !== 'installment');
                          const oneTimeTotal = oneTimeItems.reduce((sum, item) => sum + parseFloat(item.total), 0);
                          
                          const maxInstallments = Math.max(...installmentItems.map(item => item.installmentCount || 6), 1);
                          
                          const getInstallmentAmount = (item: InvoiceItem, installmentNum: number) => {
                            const count = item.installmentCount || 6;
                            if (installmentNum > count) return 0;
                            const total = parseFloat(item.total);
                            const baseAmount = Math.floor(total / count * 100) / 100;
                            const remainder = Math.round((total - (baseAmount * count)) * 100) / 100;
                            return installmentNum === 1 ? baseAmount + remainder : baseAmount;
                          };
                          
                          const getInvoiceDate = (installmentNum: number, baseDate: Date) => {
                            const date = new Date(baseDate);
                            const hasYearly = installmentItems.some(item => item.frequency === 'yearly');
                            if (hasYearly) {
                              date.setFullYear(date.getFullYear() + installmentNum - 1);
                            } else {
                              date.setMonth(date.getMonth() + installmentNum - 1);
                            }
                            return date;
                          };
                          
                          const invoices = Array.from({ length: maxInstallments }).map((_, idx) => {
                            const installmentNum = idx + 1;
                            const baseDate = new Date();
                            const invoiceDate = getInvoiceDate(installmentNum, baseDate);
                            
                            const installmentItemsForThisInvoice = installmentItems
                              .filter(item => installmentNum <= (item.installmentCount || 6))
                              .map(item => ({
                                name: `${item.name} (${t.invoices?.installment || "Installment"} ${installmentNum}/${item.installmentCount || 6})`,
                                amount: getInstallmentAmount(item, installmentNum),
                                type: 'installment' as const
                              }));
                            
                            const installmentTotalForInvoice = installmentItemsForThisInvoice.reduce((sum, item) => sum + item.amount, 0);
                            
                            if (idx === 0) {
                              return {
                                number: installmentNum,
                                date: invoiceDate,
                                items: [
                                  ...oneTimeItems.map(item => ({
                                    name: item.name,
                                    amount: parseFloat(item.total),
                                    type: 'one-time' as const
                                  })),
                                  ...installmentItemsForThisInvoice
                                ],
                                total: oneTimeTotal + installmentTotalForInvoice,
                                isFirst: true
                              };
                            } else {
                              return {
                                number: installmentNum,
                                date: invoiceDate,
                                items: installmentItemsForThisInvoice,
                                total: installmentTotalForInvoice,
                                isFirst: false
                              };
                            }
                          }).filter(inv => inv.items.length > 0);
                          
                          return (
                            <>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30 border border-purple-300 dark:border-purple-700">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge className="bg-purple-600">{t.invoices?.firstInvoice || "1st Invoice"}</Badge>
                                    <span className="text-xs text-muted-foreground">{t.invoices?.generateNow || "Generate now"}</span>
                                  </div>
                                  <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{formatCurrency(invoices[0].total)}</p>
                                  <div className="mt-2 space-y-1">
                                    {invoices[0].items.map((item, i) => (
                                      <div key={i} className="flex justify-between text-xs">
                                        <span className={item.type === 'one-time' ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}>
                                          {item.type === 'one-time' ? '(J)' : '(S)'} {item.name}
                                        </span>
                                        <span>{formatCurrency(item.amount)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                {invoices.length > 1 && (
                                  <div className="p-3 rounded-lg bg-muted/50 border">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Badge variant="outline">{t.invoices?.futureInvoices || "Future Invoices"}</Badge>
                                      <span className="text-xs text-muted-foreground">{invoices.length - 1}x</span>
                                    </div>
                                    <div className="space-y-1">
                                      {invoices.slice(1).map((inv, i) => (
                                        <div key={i} className="flex justify-between text-sm">
                                          <span className="text-muted-foreground">{inv.date.toLocaleDateString('sk-SK', { month: 'short', year: '2-digit' })}</span>
                                          <span className="font-medium">{formatCurrency(inv.total)}</span>
                                        </div>
                                      ))}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-2 border-t pt-2">
                                      {t.invoices?.onlyInstallments || "Only installment payments"}
                                    </p>
                                  </div>
                                )}
                              </div>
                              
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs font-medium text-muted-foreground">{t.invoices?.invoiceCalendar || "Invoice Calendar"}</p>
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> {t.invoices?.oneTimePayment || "One-time"}</span>
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> {t.invoices?.installmentPayment || "Installment"}</span>
                                  </div>
                                </div>
                                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                                  {invoices.map((inv, idx) => (
                                    <div key={idx} className={cn(
                                      "p-2 rounded text-center text-xs border",
                                      idx === 0 ? "bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700" : "bg-muted/30 border-muted"
                                    )}>
                                      <p className="font-medium flex items-center justify-center gap-1">
                                        {idx === 0 && <FileText className="h-3 w-3 text-purple-600" />}
                                        {t.invoices?.invoice || "Invoice"} #{idx + 1}
                                      </p>
                                      <p className="text-muted-foreground">{inv.date.toLocaleDateString('sk-SK', { month: 'short', year: '2-digit' })}</p>
                                      <p className="font-semibold">{formatCurrency(inv.total)}</p>
                                      {idx === 0 && (
                                        <Badge variant="secondary" className="mt-1 text-[10px]">{t.invoices?.ready || "Ready"}</Badge>
                                      )}
                                      {idx > 0 && (
                                        <Badge variant="outline" className="mt-1 text-[10px]">{t.invoices?.scheduled || "Scheduled"}</Badge>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                              
                              <div className="flex justify-between pt-2 border-t">
                                <span className="text-sm text-muted-foreground">{t.invoices?.totalAllInvoices || "Total (all invoices)"}</span>
                                <span className="font-semibold">{formatCurrency(invoices.reduce((sum, inv) => sum + inv.total, 0))}</span>
                              </div>
                              
                              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                                <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                                  <CalendarDays className="h-4 w-4" />
                                  {t.invoices?.scheduledInvoicesNote || "Scheduled invoices will be queued and you'll receive a notification when each is ready to generate."}
                                </p>
                              </div>
                            </>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  )}

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
                            <TableHead className="text-center">{t.konfigurator?.vat || "VAT"}</TableHead>
                            <TableHead className="text-right">{t.invoices?.total || "Total"}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{item.name}</TableCell>
                              <TableCell className="text-right">{item.quantity}</TableCell>
                              <TableCell className="text-right">{formatCurrency(parseFloat(item.unitPrice))}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className="text-xs">{item.vatRate}%</Badge>
                              </TableCell>
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

          {/* Floating Navigation Bar */}
          <div className="sticky bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t shadow-lg -mx-6 px-6 py-4">
            <div className="flex justify-between items-center">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
