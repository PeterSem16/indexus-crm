import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import QRCode from "qrcode";
import { Receipt, Calendar, CalendarDays, CreditCard, Package, FileText, Loader2, Plus, Trash2, Check, Users } from "lucide-react";
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
import { useAuth } from "@/contexts/auth-context";

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
  address?: string;
  city?: string;
  postalCode?: string;
  correspondenceAddress?: string;
  corrCity?: string;
  corrPostalCode?: string;
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
  productId?: string;
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
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [isAddingBillset, setIsAddingBillset] = useState<string | null>(null);
  const [billsetLoaded, setBillsetLoaded] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");  // Pay by Square
  const [epcQrCodeDataUrl, setEpcQrCodeDataUrl] = useState<string>("");  // EPC QR
  const [isSubmitting, setIsSubmitting] = useState(false);
  
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

  const { data: allCustomers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    enabled: open && !customerId,
  });

  // Filter customers by user's assigned countries
  const customers = useMemo(() => {
    if (!user?.assignedCountries || user.assignedCountries.length === 0) {
      return allCustomers;
    }
    return allCustomers.filter(c => c.country && user.assignedCountries.includes(c.country));
  }, [allCustomers, user?.assignedCountries]);

  const formCustomerId = form.watch("customerId");
  const selectedCustomer = useMemo(() => {
    if (customerId && customer) return customer;
    if (formCustomerId) return customers.find(c => c.id === formCustomerId);
    return null;
  }, [customerId, customer, formCustomerId, customers]);

  const countryCode = customerCountry || selectedCustomer?.country || customer?.country || "SK";
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
  const [selectedDocumentType, setSelectedDocumentType] = useState<"invoice" | "proforma">("invoice");

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
    return numberRanges.filter(nr => 
      nr.isActive && 
      nr.type === selectedDocumentType &&
      (nr.countryCode === countryCode || !nr.countryCode)
    );
  }, [numberRanges, selectedDocumentType, countryCode]);

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
    onSuccess: async (data) => {
      toast({
        title: t.common?.success || "Success",
        description: t.invoices?.createSuccess || "Invoice created successfully",
      });
      await queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && typeof key[0] === 'string' && key[0].startsWith('/api/invoices');
        },
        refetchType: 'all'
      });
      onSuccess?.(data.id);
      handleClose();
    },
    onError: (error: any) => {
      console.error("[CreateInvoice] Mutation error:", error);
      let parsedError = error?.message || "Failed to create invoice";
      try {
        const parts = parsedError.split(": ");
        if (parts.length > 1) {
          const jsonPart = parts.slice(1).join(": ");
          const parsed = JSON.parse(jsonPart);
          if (parsed?.error) parsedError = parsed.error;
          if (parsed?.details) parsedError += ` - ${parsed.details}`;
        }
      } catch { /* use raw message */ }
      toast({
        title: t.common?.error || "Error",
        description: parsedError,
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

  const setDueDateFromIssue = (daysToAdd: number) => {
    const issueDay = form.getValues("issueDateDay");
    const issueMonth = form.getValues("issueDateMonth");
    const issueYear = form.getValues("issueDateYear");
    const issueDate = new Date(issueYear, issueMonth - 1, issueDay);
    issueDate.setDate(issueDate.getDate() + daysToAdd);
    form.setValue("dueDateDay", issueDate.getDate());
    form.setValue("dueDateMonth", issueDate.getMonth() + 1);
    form.setValue("dueDateYear", issueDate.getFullYear());
  };

  const setBillingPeriod = (months: number) => {
    const fromDay = form.getValues("periodFromDay") || new Date().getDate();
    const fromMonth = form.getValues("periodFromMonth") || new Date().getMonth() + 1;
    const fromYear = form.getValues("periodFromYear") || new Date().getFullYear();
    
    if (!form.getValues("periodFromDay")) {
      form.setValue("periodFromDay", fromDay);
      form.setValue("periodFromMonth", fromMonth);
      form.setValue("periodFromYear", fromYear);
    }
    
    const toDate = new Date(fromYear, fromMonth - 1, fromDay);
    toDate.setMonth(toDate.getMonth() + months);
    toDate.setDate(toDate.getDate() - 1);
    form.setValue("periodToDay", toDate.getDate());
    form.setValue("periodToMonth", toDate.getMonth() + 1);
    form.setValue("periodToYear", toDate.getFullYear());
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

  // Build complete metadata for invoice/scheduled invoice
  const buildInvoiceMetadata = () => {
    const cust = selectedCustomer;
    const billing = selectedBillingCompany;
    const account = selectedBillingAccount;
    
    return {
      // Customer metadata snapshot
      customerName: cust ? `${cust.firstName || ''} ${cust.lastName || ''}`.trim() : undefined,
      customerAddress: cust?.correspondenceAddress || cust?.address,
      customerCity: cust?.corrCity || cust?.city,
      customerZip: cust?.corrPostalCode || cust?.postalCode,
      customerCountry: cust?.country,
      customerEmail: cust?.email,
      customerPhone: cust?.phone,
      customerCompanyName: cust?.companyName,
      customerTaxId: cust?.ico,
      customerVatId: cust?.dic,
      // Billing company snapshot
      billingCompanyName: billing?.companyName,
      billingAddress: billing?.address,
      billingCity: billing?.city,
      billingZip: billing?.postalCode,
      billingCountry: billing?.countryCode,
      billingTaxId: billing?.ico || billing?.taxId, // IČO
      billingVatId: billing?.dic || billing?.vatNumber, // DIČ / IČ DPH
      billingEmail: billing?.email,
      billingPhone: billing?.phone,
      // Wizard tracking
      wizardCreatedAt: new Date().toISOString(),
      // Bank account snapshot
      billingBankName: account?.bankName || billing?.bankName,
      billingBankIban: account?.iban || billing?.bankIban,
      billingBankSwift: account?.swift || billing?.bankSwift,
      billingBankAccountNumber: account?.accountNumber,
      bankAccountId: account?.id,
      // QR code configuration (dual QR codes)
      qrCodeType: barcodeType || "PAY",
      qrCodeData: qrCodeDataUrl, // Pay by Square (SK/CZ)
      epcQrCodeData: epcQrCodeDataUrl, // EPC QR (EU standard)
      qrCodeEnabled: barcodeType ? true : false,
    };
  };

  const handleSubmit = async () => {
    if (isSubmitting) {
      console.log("[InvoiceWizard] Blocked: already submitting");
      return;
    }
    setIsSubmitting(true);
    console.log("[InvoiceWizard] === SUBMIT START ===");
    
    const submitTimeout = setTimeout(() => {
      console.log("[InvoiceWizard] Safety timeout reached - resetting isSubmitting");
      setIsSubmitting(false);
    }, 30000);
    
    try {
    {
      let authOk = false;
      try {
        const authCheck = await fetch("/api/auth/me", { credentials: "include" });
        console.log("[InvoiceWizard] Auth check status:", authCheck.status);
        authOk = authCheck.ok;
      } catch (authError) {
        console.error("[InvoiceWizard] Auth check network error:", authError);
      }
      if (!authOk) {
        toast({
          title: t.common?.error || "Error",
          description: t.common?.sessionExpired || "Session expired. Please refresh the page and log in again.",
          variant: "destructive",
        });
        window.location.href = "/login";
        return;
      }
    }

    const values = form.getValues();
    console.log("[InvoiceWizard] Form values - customerId:", values.customerId, "numberRangeId:", values.numberRangeId, "items:", items.length);
    const installmentItems = items.filter(item => item.paymentType === 'installment');
    const oneTimeItems = items.filter(item => item.paymentType !== 'installment');
    const hasInstallments = installmentItems.length > 0;
    console.log("[InvoiceWizard] hasInstallments:", hasInstallments, "installmentItems:", installmentItems.length, "oneTimeItems:", oneTimeItems.length);

    const baseIssueDate = new Date(values.issueDateYear, values.issueDateMonth - 1, values.issueDateDay);
    const baseDueDate = new Date(values.dueDateYear, values.dueDateMonth - 1, values.dueDateDay);
    const deliveryDate = values.deliveryDateYear ? 
      new Date(values.deliveryDateYear, (values.deliveryDateMonth || 1) - 1, values.deliveryDateDay || 1) : null;
    const paymentTermDays = Math.round((baseDueDate.getTime() - baseIssueDate.getTime()) / (1000 * 60 * 60 * 24));

    if (hasInstallments) {
      // NEW LOGIC: Create first invoice immediately, queue future installments
      const maxInstallments = Math.max(...installmentItems.map(item => item.installmentCount || 6), 1);
      const hasYearly = installmentItems.some(item => item.frequency === 'yearly');
      let firstInvoiceCreated = false;
      let scheduledCount = 0;
      let parentInvoiceId = "";

      // Helper function to build items for a specific installment
      const buildInstallmentItems = (installmentNum: number, includeOneTime: boolean) => {
        const invoiceItems: Array<{name: string; quantity: string; unitPrice: string; vatRate: string; totalPrice: string; productId?: string}> = [];
        
        // Add one-time items only to first invoice
        if (includeOneTime) {
          oneTimeItems.forEach(item => {
            invoiceItems.push({
              name: item.name,
              quantity: item.quantity.toString(),
              unitPrice: item.unitPrice,
              vatRate: item.vatRate,
              totalPrice: item.total,
              productId: item.productId,
            });
          });
        }

        // Add installment items that apply to this invoice
        installmentItems.forEach(item => {
          const count = item.installmentCount || 6;
          if (installmentNum <= count) {
            const total = parseFloat(item.total);
            const baseAmount = Math.floor((total / count) * 100) / 100;
            const remainder = Math.round((total - baseAmount * count) * 100) / 100;
            const thisAmount = installmentNum === 1 ? baseAmount + remainder : baseAmount;
            
            invoiceItems.push({
              name: `${item.name} (${t.invoices?.installment || "Installment"} ${installmentNum}/${count})`,
              quantity: "1",
              unitPrice: thisAmount.toFixed(2),
              vatRate: item.vatRate,
              totalPrice: thisAmount.toFixed(2),
              productId: item.productId,
            });
          }
        });

        return invoiceItems;
      };

      // Calculate totals for items
      const calculateItemsTotals = (invoiceItems: Array<{totalPrice: string; vatRate: string}>) => {
        const invoiceTotal = invoiceItems.reduce((sum, item) => sum + parseFloat(item.totalPrice), 0);
        const invoiceVatAmount = invoiceItems.reduce((sum, item) => {
          const itemTotal = parseFloat(item.totalPrice);
          const itemVatRate = parseFloat(item.vatRate || "0") / 100;
          return sum + (itemTotal * itemVatRate / (1 + itemVatRate));
        }, 0);
        const invoiceSubtotal = invoiceTotal - invoiceVatAmount;
        return { invoiceTotal, invoiceVatAmount, invoiceSubtotal };
      };

      // STEP 1: Create the first invoice immediately
      const firstInstallmentItems = buildInstallmentItems(1, true);
      console.log("[InvoiceWizard] firstInstallmentItems count:", firstInstallmentItems.length, "items:", JSON.stringify(firstInstallmentItems));
      if (firstInstallmentItems.length === 0) {
        console.error("[InvoiceWizard] BUG: firstInstallmentItems is empty! installmentItems:", installmentItems.length, "oneTimeItems:", oneTimeItems.length);
      }
      if (firstInstallmentItems.length > 0) {
        const { invoiceTotal, invoiceVatAmount, invoiceSubtotal } = calculateItemsTotals(firstInstallmentItems);
        console.log("[InvoiceWizard] Totals:", { invoiceTotal, invoiceVatAmount, invoiceSubtotal });
        
        // Generate invoice number for first invoice
        let invoiceNumber = "";
        if (values.numberRangeId) {
          console.log("[InvoiceWizard] Generating invoice number for range:", values.numberRangeId);
          try {
            const response = await apiRequest("POST", `/api/configurator/number-ranges/${values.numberRangeId}/generate`);
            const data = await response.json();
            invoiceNumber = data.invoiceNumber;
            console.log("[InvoiceWizard] Generated invoice number:", invoiceNumber);
          } catch (error) {
            console.error("[InvoiceWizard] Failed to generate invoice number:", error);
            toast({
              title: t.common?.error || "Error",
              description: "Failed to generate invoice number",
              variant: "destructive",
            });
            return;
          }
        } else {
          console.log("[InvoiceWizard] No numberRangeId provided");
        }

        let firstInvoiceData;
        try {
          const metadata = buildInvoiceMetadata();
          firstInvoiceData = {
            invoiceNumber,
            customerId: values.customerId || customerId,
            billingDetailsId: billingInfo?.id,
            issueDate: baseIssueDate.toISOString(),
            dueDate: baseDueDate.toISOString(),
            deliveryDate: deliveryDate?.toISOString(),
            variableSymbol: invoiceNumber,
            constantSymbol: values.constantSymbol,
            specificSymbol: values.specificSymbol,
            barcodeType: values.barcodeType,
            barcodeValue: invoiceNumber,
            subtotal: invoiceSubtotal.toFixed(2),
            vatRate: billingInfo?.defaultVatRate || "20",
            vatAmount: invoiceVatAmount.toFixed(2),
            totalAmount: invoiceTotal.toFixed(2),
            currency: billingInfo?.currency || "EUR",
            status: "generated",
            paymentTermDays: billingInfo?.defaultPaymentTerm || 14,
            items: firstInstallmentItems,
            installmentNumber: 1,
            totalInstallments: maxInstallments,
            // Complete metadata for template generation
            ...metadata,
          };
        } catch (dataError: unknown) {
          const errMsg = dataError instanceof Error ? dataError.message : String(dataError);
          console.error("[InvoiceWizard] Error preparing invoice data:", dataError);
          toast({
            title: "Error preparing data",
            description: errMsg,
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }

        console.log("[InvoiceWizard] Creating first invoice with data:", JSON.stringify(firstInvoiceData));
        try {
          console.log("[InvoiceWizard] About to call apiRequest for POST /api/invoices");
          const response = await apiRequest("POST", "/api/invoices", firstInvoiceData);
          console.log("[InvoiceWizard] Invoice creation response status:", response.status);
          const createdInvoice = await response.json();
          console.log("[InvoiceWizard] Created invoice:", createdInvoice);
          parentInvoiceId = createdInvoice.id;
          firstInvoiceCreated = true;
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error("[InvoiceWizard] Failed to create first invoice:", error);
          toast({
            title: t.common?.error || "Error",
            description: `${t.invoices?.createFailed || "Failed to create first invoice"}: ${errorMessage}`,
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }
      }

      // STEP 2: Queue future installments (2, 3, 4, ...) to scheduled_invoices
      for (let installmentNum = 2; installmentNum <= maxInstallments; installmentNum++) {
        // Calculate scheduled date for this installment
        const scheduledDate = new Date(baseIssueDate);
        if (hasYearly) {
          scheduledDate.setFullYear(scheduledDate.getFullYear() + installmentNum - 1);
        } else {
          scheduledDate.setMonth(scheduledDate.getMonth() + installmentNum - 1);
        }

        // Build items for this installment (no one-time items)
        const futureItems = buildInstallmentItems(installmentNum, false);
        if (futureItems.length === 0) continue;

        const { invoiceTotal, invoiceVatAmount, invoiceSubtotal } = calculateItemsTotals(futureItems);

        const metadata = buildInvoiceMetadata();
        const scheduledData = {
          customerId: values.customerId || customerId,
          billingDetailsId: billingInfo?.id,
          numberRangeId: values.numberRangeId,
          scheduledDate: scheduledDate.toISOString(),
          installmentNumber: installmentNum,
          totalInstallments: maxInstallments,
          status: "pending",
          currency: billingInfo?.currency || "EUR",
          paymentTermDays: billingInfo?.defaultPaymentTerm || 14,
          constantSymbol: values.constantSymbol,
          specificSymbol: values.specificSymbol,
          barcodeType: values.barcodeType,
          items: futureItems,
          totalAmount: invoiceTotal.toFixed(2),
          vatAmount: invoiceVatAmount.toFixed(2),
          subtotal: invoiceSubtotal.toFixed(2),
          vatRate: billingInfo?.defaultVatRate || "20",
          parentInvoiceId: parentInvoiceId,
          // Complete metadata for template generation
          ...metadata,
        };

        try {
          await apiRequest("POST", "/api/scheduled-invoices", scheduledData);
          scheduledCount++;
        } catch (error) {
          console.error(`Failed to schedule installment ${installmentNum}:`, error);
        }
      }

      if (firstInvoiceCreated) {
        const scheduledMsg = scheduledCount > 0 ? ` (${scheduledCount} ${t.invoices?.scheduledForLater || "scheduled for later"})` : "";
        toast({
          title: t.common?.success || "Success",
          description: `${t.invoices?.createSuccess || "Invoice created successfully"}${scheduledMsg}`,
        });
        await queryClient.invalidateQueries({ 
          predicate: (query) => {
            const key = query.queryKey;
            return Array.isArray(key) && typeof key[0] === 'string' && key[0].startsWith('/api/invoices');
          },
          refetchType: 'all'
        });
        await queryClient.invalidateQueries({ queryKey: ["/api/scheduled-invoices"] });
        handleClose();
      } else {
        console.error("[InvoiceWizard] firstInvoiceCreated is false - no invoice was created. Items:", items.length, "firstInstallmentItems:", firstInstallmentItems.length);
        toast({
          title: t.common?.error || "Error",
          description: firstInstallmentItems.length === 0 
            ? (t.invoices?.noItems || "No items to invoice. Please add items first.")
            : (t.invoices?.createFailed || "Failed to create invoices"),
          variant: "destructive",
        });
      }
    } else {
      // Single invoice (no installments)
      console.log("[InvoiceWizard] Single invoice path - calculating totals");
      const totals = calculateTotals();
      console.log("[InvoiceWizard] Totals:", totals);

      // Generate invoice number on final submission
      let invoiceNumber = "";
      if (values.numberRangeId) {
        console.log("[InvoiceWizard] Generating number from range:", values.numberRangeId);
        try {
          const response = await apiRequest("POST", `/api/configurator/number-ranges/${values.numberRangeId}/generate`);
          const data = await response.json();
          invoiceNumber = data.invoiceNumber;
          console.log("[InvoiceWizard] Generated number:", invoiceNumber);
        } catch (error: any) {
          console.error("[InvoiceWizard] Number generation failed:", error);
          toast({
            title: t.common?.error || "Error",
            description: `Failed to generate invoice number: ${error?.message || "Unknown error"}`,
            variant: "destructive",
          });
          return;
        }
      } else {
        console.log("[InvoiceWizard] No numberRangeId, will auto-generate on server");
      }

      const metadata = buildInvoiceMetadata();
      const resolvedCustomerId = values.customerId || customerId;
      console.log("[InvoiceWizard] customerId:", resolvedCustomerId, "items count:", items.length);

      if (!resolvedCustomerId) {
        console.error("[InvoiceWizard] No customerId available!");
        toast({
          title: t.common?.error || "Error",
          description: "Customer is required to create an invoice",
          variant: "destructive",
        });
        return;
      }

      const invoiceData = {
        invoiceNumber,
        customerId: resolvedCustomerId,
        billingDetailsId: billingInfo?.id,
        issueDate: baseIssueDate.toISOString(),
        dueDate: baseDueDate.toISOString(),
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
        ...metadata,
      };

      console.log("[InvoiceWizard] Submitting single invoice data:", JSON.stringify(invoiceData).substring(0, 500));
      try {
        const response = await apiRequest("POST", "/api/invoices", invoiceData);
        const createdInvoice = await response.json();
        console.log("[InvoiceWizard] Single invoice created:", createdInvoice);
        toast({
          title: t.common?.success || "Success",
          description: t.invoices?.createSuccess || "Invoice created successfully",
        });
        await queryClient.invalidateQueries({ 
          predicate: (query) => {
            const key = query.queryKey;
            return Array.isArray(key) && typeof key[0] === 'string' && key[0].startsWith('/api/invoices');
          },
          refetchType: 'all'
        });
        onSuccess?.(createdInvoice.id);
        handleClose();
      } catch (error: any) {
        console.error("[InvoiceWizard] Single invoice creation failed:", error);
        toast({
          title: t.common?.error || "Error",
          description: error?.message || "Failed to create invoice",
          variant: "destructive",
        });
      }
    }
    } catch (outerError: any) {
      console.error("[InvoiceWizard] Unexpected error in handleSubmit:", outerError);
      toast({
        title: "Error",
        description: outerError?.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      clearTimeout(submitTimeout);
      setIsSubmitting(false);
    }
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
  const years = Array.from({ length: 30 }, (_, i) => new Date().getFullYear() + i - 2);

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

  // Generate both QR codes for payment (Pay by Square + EPC QR)
  useEffect(() => {
    const generateQRCodes = async () => {
      if (barcodeType !== "QR" || barcodeType === "NONE") {
        setQrCodeDataUrl("");
        setEpcQrCodeDataUrl("");
        return;
      }
      
      const vs = variableSymbol || previewInvoiceNumber || "";
      const ks = constantSymbol || "";
      const ss = specificSymbol || "";
      // Use selected billing account IBAN, fallback to billing company bankIban
      const iban = selectedBillingAccount?.iban || selectedBillingCompany?.bankIban || billingInfo?.bankIban || "";
      const swift = selectedBillingAccount?.swift || selectedBillingCompany?.bankSwift || "";
      const currency = selectedBillingAccount?.currency || selectedBillingCompany?.currency || "EUR";
      const recipientName = selectedBillingCompany?.companyName || billingInfo?.companyName || "";
      
      // 1. PAY by Square format (SK/CZ) - amount is added at PDF generation time
      let payBySquareData = `SPD*1.0*ACC:${iban}`;
      if (swift) {
        payBySquareData += `+${swift}`;
      }
      payBySquareData += `*CC:${currency}*X-VS:${vs}`;
      if (ks) payBySquareData += `*X-KS:${ks}`;
      if (ss) payBySquareData += `*X-SS:${ss}`;
      
      // 2. EPC QR format (EU standard) - amount is added at PDF generation time
      const epcReference = [vs, ks, ss].filter(Boolean).join("/");
      const epcLines = [
        "BCD",           // Service Tag
        "002",           // Version
        "1",             // Character set (1=UTF-8)
        "SCT",           // Identification
        swift || "",     // BIC
        recipientName.substring(0, 70),  // Recipient name (max 70)
        iban,            // IBAN
        "",              // Amount - empty in preview, added at PDF generation
        "",              // Purpose
        "",              // Remittance (structured)
        epcReference || "",  // Remittance (unstructured) - VS/KS/SS as reference
        ""               // Information
      ];
      const epcData = epcLines.join("\n");
      
      try {
        const payBySquareUrl = await QRCode.toDataURL(payBySquareData, { 
          width: 200, 
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' }
        });
        setQrCodeDataUrl(payBySquareUrl);
      } catch (err) {
        console.error("Pay by Square QR error:", err);
        setQrCodeDataUrl("");
      }

      try {
        const epcUrl = await QRCode.toDataURL(epcData, { 
          width: 200, 
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' }
        });
        setEpcQrCodeDataUrl(epcUrl);
      } catch (err) {
        console.error("EPC QR error:", err);
        setEpcQrCodeDataUrl("");
      }
    };
    
    generateQRCodes();
  }, [barcodeType, variableSymbol, constantSymbol, specificSymbol, selectedBillingAccount, selectedBillingCompany, billingInfo, previewInvoiceNumber]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto p-6">
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
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_40%] gap-6 overflow-hidden">
                  {/* Left Column - Step 1: Customer (60%) */}
                  <div className="space-y-4 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">1</div>
                      <h3 className="text-lg font-semibold">{t.invoices?.selectCustomer || "Select Customer"}</h3>
                    </div>

                    {customerId ? (
                      <Card className="bg-muted/30">
                        <CardContent className="pt-4">
                          <div className="flex items-start gap-4 min-w-0">
                            <div className="h-12 w-12 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                              <Users className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-lg truncate">{selectedCustomer?.firstName} {selectedCustomer?.lastName}</p>
                              {selectedCustomer?.email && (
                                <p className="text-sm text-muted-foreground truncate">{selectedCustomer.email}</p>
                              )}
                              {selectedCustomer?.correspondenceAddress && (
                                <div className="mt-3 p-3 bg-background rounded-lg border min-w-0">
                                  <Label className="text-xs text-muted-foreground">{t.invoices?.correspondenceAddress || "Correspondence Address"}</Label>
                                  <p className="text-sm mt-1 break-words">{selectedCustomer.correspondenceAddress}</p>
                                  {(selectedCustomer.corrCity || selectedCustomer.corrPostalCode) && (
                                    <p className="text-sm text-muted-foreground break-words">
                                      {[selectedCustomer.corrPostalCode, selectedCustomer.corrCity].filter(Boolean).join(" ")}
                                    </p>
                                  )}
                                </div>
                              )}
                              {!selectedCustomer?.correspondenceAddress && selectedCustomer?.address && (
                                <div className="mt-3 p-3 bg-background rounded-lg border min-w-0">
                                  <Label className="text-xs text-muted-foreground">{t.customers?.address || "Address"}</Label>
                                  <p className="text-sm mt-1 break-words">{selectedCustomer.address}</p>
                                  {(selectedCustomer.city || selectedCustomer.postalCode) && (
                                    <p className="text-sm text-muted-foreground break-words">
                                      {[selectedCustomer.postalCode, selectedCustomer.city].filter(Boolean).join(" ")}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
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

                  {/* Right Column - Step 2: Select Number Range (40%) */}
                  <div className="space-y-4 lg:border-l lg:pl-6 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">2</div>
                      <h3 className="text-lg font-semibold">{t.invoices?.selectNumberRange || "Select Number Range"}</h3>
                    </div>
                    
                    {/* Document Type Selection */}
                    <div className="space-y-2">
                      <Label>{t.invoices?.documentType || "Document Type"}</Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={selectedDocumentType === "invoice" ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            setSelectedDocumentType("invoice");
                            form.setValue("numberRangeId", "");
                          }}
                          className="flex-1"
                          data-testid="btn-type-invoice"
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          {t.invoices?.invoice || "Invoice"}
                        </Button>
                        <Button
                          type="button"
                          variant={selectedDocumentType === "proforma" ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            setSelectedDocumentType("proforma");
                            form.setValue("numberRangeId", "");
                          }}
                          className="flex-1"
                          data-testid="btn-type-proforma"
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          {t.invoices?.proforma || "Proforma"}
                        </Button>
                      </div>
                    </div>

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
                  </div>
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
                        <div className="flex flex-wrap gap-1 mb-3">
                          <Button type="button" variant="secondary" size="sm" onClick={() => setDueDateFromIssue(7)} data-testid="btn-due-7">
                            7 {t.common?.days || "days"}
                          </Button>
                          <Button type="button" variant="secondary" size="sm" onClick={() => setDueDateFromIssue(14)} data-testid="btn-due-14">
                            14 {t.common?.days || "days"}
                          </Button>
                          <Button type="button" variant="secondary" size="sm" onClick={() => setDueDateFromIssue(21)} data-testid="btn-due-21">
                            21 {t.common?.days || "days"}
                          </Button>
                          <Button type="button" variant="secondary" size="sm" onClick={() => setDueDateFromIssue(30)} data-testid="btn-due-30">
                            30 {t.common?.days || "days"}
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

                      <div className="flex flex-wrap gap-1 p-3 bg-muted/30 rounded-lg border">
                        <span className="text-xs text-muted-foreground w-full mb-1">{t.invoices?.quickPeriod || "Quick period selection"}:</span>
                        <Button type="button" variant="secondary" size="sm" onClick={() => setBillingPeriod(6)} data-testid="btn-period-6m">
                          6 {t.invoices?.months || "months"}
                        </Button>
                        <Button type="button" variant="secondary" size="sm" onClick={() => setBillingPeriod(12)} data-testid="btn-period-1y">
                          1 {t.invoices?.year || "year"}
                        </Button>
                        <Button type="button" variant="secondary" size="sm" onClick={() => setBillingPeriod(24)} data-testid="btn-period-2y">
                          2 {t.invoices?.years || "years"}
                        </Button>
                        <Button type="button" variant="secondary" size="sm" onClick={() => setBillingPeriod(36)} data-testid="btn-period-3y">
                          3 {t.invoices?.years || "years"}
                        </Button>
                        <Button type="button" variant="secondary" size="sm" onClick={() => setBillingPeriod(48)} data-testid="btn-period-4y">
                          4 {t.invoices?.years || "years"}
                        </Button>
                        <Button type="button" variant="secondary" size="sm" onClick={() => setBillingPeriod(60)} data-testid="btn-period-5y">
                          5 {t.invoices?.years || "years"}
                        </Button>
                        <Button type="button" variant="secondary" size="sm" onClick={() => setBillingPeriod(72)} data-testid="btn-period-6y">
                          6 {t.invoices?.years || "years"}
                        </Button>
                        <Button type="button" variant="secondary" size="sm" onClick={() => setBillingPeriod(84)} data-testid="btn-period-7y">
                          7 {t.invoices?.years || "years"}
                        </Button>
                        <Button type="button" variant="secondary" size="sm" onClick={() => setBillingPeriod(96)} data-testid="btn-period-8y">
                          8 {t.invoices?.years || "years"}
                        </Button>
                        <Button type="button" variant="secondary" size="sm" onClick={() => setBillingPeriod(108)} data-testid="btn-period-9y">
                          9 {t.invoices?.years || "years"}
                        </Button>
                        <Button type="button" variant="secondary" size="sm" onClick={() => setBillingPeriod(120)} data-testid="btn-period-10y">
                          10 {t.invoices?.years || "years"}
                        </Button>
                        <Button type="button" variant="secondary" size="sm" onClick={() => setBillingPeriod(180)} data-testid="btn-period-15y">
                          15 {t.invoices?.years || "years"}
                        </Button>
                        <Button type="button" variant="secondary" size="sm" onClick={() => setBillingPeriod(240)} data-testid="btn-period-20y">
                          20 {t.invoices?.years || "years"}
                        </Button>
                        <Button type="button" variant="secondary" size="sm" onClick={() => setBillingPeriod(300)} data-testid="btn-period-25y">
                          25 {t.invoices?.years || "years"}
                        </Button>
                      </div>

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
                                  <Input {...field} readOnly className="bg-muted font-mono text-lg" data-testid="input-variable-symbol" />
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
                                    <SelectItem value="QR">QR Code (PAY by Square + EPC)</SelectItem>
                                    <SelectItem value="NONE">{t.common?.none || "None"}</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />

                          {/* Barcode Visual Preview - Dual QR Codes */}
                          <div className="border rounded-lg p-4 bg-white dark:bg-gray-900">
                            <div className="flex items-center justify-center min-h-[160px]">
                              {form.watch("barcodeType") === "QR" ? (
                                <div className="flex gap-6">
                                  {/* Pay by Square QR (SK/CZ) */}
                                  <div className="text-center">
                                    {qrCodeDataUrl ? (
                                      <img 
                                        src={qrCodeDataUrl} 
                                        alt="Pay by Square QR Code" 
                                        className="w-32 h-32 mx-auto rounded border"
                                        data-testid="qr-code-pay-by-square"
                                      />
                                    ) : (
                                      <div className="w-32 h-32 mx-auto border-2 border-dashed border-muted-foreground/50 rounded flex items-center justify-center bg-muted/20">
                                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                      </div>
                                    )}
                                    <p className="text-xs text-muted-foreground mt-2 font-semibold">PAY by Square</p>
                                    <p className="text-[10px] text-muted-foreground">(SK/CZ)</p>
                                  </div>
                                  {/* EPC QR (EU) */}
                                  <div className="text-center">
                                    {epcQrCodeDataUrl ? (
                                      <img 
                                        src={epcQrCodeDataUrl} 
                                        alt="EPC QR Code" 
                                        className="w-32 h-32 mx-auto rounded border"
                                        data-testid="qr-code-epc"
                                      />
                                    ) : (
                                      <div className="w-32 h-32 mx-auto border-2 border-dashed border-muted-foreground/50 rounded flex items-center justify-center bg-muted/20">
                                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                      </div>
                                    )}
                                    <p className="text-xs text-muted-foreground mt-2 font-semibold">EPC QR</p>
                                    <p className="text-[10px] text-muted-foreground">(EU Standard)</p>
                                  </div>
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
                                <span className="font-mono text-muted-foreground italic text-[10px]">{t.invoices?.addedAtGeneration || "Added at PDF generation"}</span>
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
                          <div className="overflow-x-auto">
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
                          </div>
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
                      <div className="overflow-x-auto">
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
                      </div>
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
                  disabled={isSubmitting || !canProceed()}
                  data-testid="btn-create-invoice"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
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
