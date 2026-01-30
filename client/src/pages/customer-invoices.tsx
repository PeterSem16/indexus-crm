import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, Eye, Receipt, Loader2, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, CheckCircle2, Plus, Users, FileText, Calendar, Clock, Trash2, BarChart3, TrendingUp, FileDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CreateInvoiceWizard } from "@/components/create-invoice-wizard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/i18n";
import { useCountryFilter } from "@/contexts/country-filter-context";

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  billingDetailsId?: string;
  status: string;
  totalAmount: string;
  paidAmount?: string;
  currency: string;
  issueDate?: string;
  dueDate?: string;
  deliveryDate?: string;
  sendDate?: string;
  periodFrom?: string;
  periodTo?: string;
  variableSymbol?: string;
  constantSymbol?: string;
  specificSymbol?: string;
  barcodeType?: string;
  barcodeValue?: string;
  legacyId?: string;
  subtotal?: string;
  vatAmount?: string;
  createdAt?: string;
  customerName?: string;
  billingCompanyName?: string;
  // Billing company metadata
  billingAddress?: string;
  billingCity?: string;
  billingZip?: string;
  billingCountry?: string;
  billingTaxId?: string;
  billingVatId?: string;
  // Bank account metadata
  billingBankName?: string;
  billingBankIban?: string;
  billingBankSwift?: string;
  billingBankAccountNumber?: string;
  // QR codes
  qrCodeEnabled?: boolean;
  qrCodeData?: string;
  epcQrCodeData?: string;
  // Wizard tracking
  wizardCreatedAt?: string;
}

interface InvoiceItem {
  id: string;
  invoiceId: string;
  name: string;
  quantity: number;
  unitPrice: string;
  vatRate?: string;
  total: string;
  accountingCode?: string;
}

interface InvoicePayment {
  id: string;
  invoiceId: string;
  paymentDate: string;
  amount: string;
  amountInCurrency?: string;
  currency: string;
  paymentMethod?: string;
  reference?: string;
  status: string;
}

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  country?: string;
}

interface BillingDetails {
  id: string;
  companyName: string;
}

interface ScheduledInvoice {
  id: string;
  customerId: string;
  billingDetailsId?: string;
  numberRangeId?: string;
  scheduledDate: string;
  installmentNumber: number;
  totalInstallments: number;
  status: string;
  currency: string;
  paymentTermDays: number;
  constantSymbol?: string;
  specificSymbol?: string;
  barcodeType?: string;
  items: any[];
  totalAmount: string;
  vatAmount?: string;
  subtotal?: string;
  vatRate?: string;
  parentInvoiceId?: string;
  createdInvoiceId?: string;
  createdAt: string;
  createdBy?: string;
  // Customer metadata
  customerName?: string;
  customerAddress?: string;
  customerCity?: string;
  customerZip?: string;
  customerCountry?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerCompanyName?: string;
  customerTaxId?: string;
  customerVatId?: string;
  // Billing company metadata
  billingCompanyName?: string;
  billingAddress?: string;
  billingCity?: string;
  billingZip?: string;
  billingCountry?: string;
  billingTaxId?: string;
  billingVatId?: string;
  billingEmail?: string;
  billingPhone?: string;
  // Bank account metadata
  billingBankName?: string;
  billingBankIban?: string;
  billingBankSwift?: string;
  billingBankAccountNumber?: string;
  // QR codes
  qrCodeType?: string;
  qrCodeData?: string;
  epcQrCodeData?: string;
  qrCodeEnabled?: boolean;
  // Wizard tracking
  wizardCreatedAt?: string;
}

const localeMap: Record<string, string> = {
  en: "en-US",
  sk: "sk-SK",
  cs: "cs-CZ",
  hu: "hu-HU",
  ro: "ro-RO",
  it: "it-IT",
  de: "de-DE",
};

export default function CustomerInvoicesPage() {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const { selectedCountries } = useCountryFilter();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<"invoiceNumber" | "issueDate" | "dueDate" | "totalAmount" | "status" | "customerName" | "wizardCreatedAt">("issueDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [activeTab, setActiveTab] = useState("list");
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [bulkSearch, setBulkSearch] = useState("");
  const [selectedScheduledInvoice, setSelectedScheduledInvoice] = useState<ScheduledInvoice | null>(null);
  const [scheduledPage, setScheduledPage] = useState(1);
  const [scheduledSortField, setScheduledSortField] = useState<"scheduledDate" | "customerName" | "totalAmount" | "wizardCreatedAt">("scheduledDate");
  const [scheduledSortDirection, setScheduledSortDirection] = useState<"asc" | "desc">("desc");
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [pdfInvoiceId, setPdfInvoiceId] = useState<string | null>(null);
  const [pdfInvoiceType, setPdfInvoiceType] = useState<"invoice" | "scheduled">("invoice");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const perPage = 15;

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices", { countries: selectedCountries }],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: billingDetails = [] } = useQuery<BillingDetails[]>({
    queryKey: ["/api/billing-details"],
  });

  const { data: scheduledInvoices = [], isLoading: isLoadingScheduled } = useQuery<ScheduledInvoice[]>({
    queryKey: ["/api/scheduled-invoices"],
  });

  const { data: exchangeRatesData } = useQuery<{ rates: { currencyCode: string; rate: string }[]; lastUpdate: string }>({
    queryKey: ["/api/exchange-rates"],
  });

  const { data: docxTemplates = [] } = useQuery<{ id: string; name: string; countryCode: string | null; year: number | null; version: number | null; isDefault?: boolean }[]>({
    queryKey: ["/api/configurator/docx-templates"],
  });

  const exchangeRateMap = useMemo(() => {
    const map = new Map<string, number>();
    map.set("EUR", 1);
    exchangeRatesData?.rates?.forEach(r => {
      map.set(r.currencyCode, parseFloat(r.rate));
    });
    return map;
  }, [exchangeRatesData]);

  const convertToEur = (amount: string, currency: string) => {
    const num = parseFloat(amount || "0");
    if (currency === "EUR" || !currency) return num;
    const rate = exchangeRateMap.get(currency);
    if (!rate || rate === 0) return num;
    return num / rate;
  };

  const createFromScheduledMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/scheduled-invoices/${id}/create`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: t.common?.success || "Success", description: t.invoices?.invoiceCreated || "Invoice created successfully" });
    },
    onError: () => {
      toast({ title: t.common?.error || "Error", description: t.invoices?.createFailed || "Failed to create invoice", variant: "destructive" });
    },
  });

  const deleteScheduledMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/scheduled-invoices/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-invoices"] });
      toast({ title: t.common?.success || "Success", description: t.invoices?.deleted || "Scheduled invoice deleted" });
    },
    onError: () => {
      toast({ title: t.common?.error || "Error", description: t.invoices?.deleteFailed || "Failed to delete", variant: "destructive" });
    },
  });

  const customerMap = useMemo(() => {
    const map = new Map<string, Customer>();
    customers.forEach(c => map.set(c.id, c));
    return map;
  }, [customers]);

  const billingMap = useMemo(() => {
    const map = new Map<string, BillingDetails>();
    billingDetails.forEach(b => map.set(b.id, b));
    return map;
  }, [billingDetails]);

  const bulkGenerateMutation = useMutation({
    mutationFn: (customerIds: string[]) => 
      apiRequest("POST", "/api/invoices/bulk-generate", { customerIds }),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setSelectedCustomers([]);
      setActiveTab("list");
      toast({ title: t.success?.created || "Success" });
    },
    onError: () => {
      toast({ title: t.errors?.saveFailed || "Error", variant: "destructive" });
    },
  });

  const toggleCustomer = (customerId: string) => {
    setSelectedCustomers(prev => 
      prev.includes(customerId) 
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    );
  };

  const selectAllCustomers = () => {
    const filteredIds = filteredCustomersForBulk.map(c => c.id);
    if (filteredIds.every(id => selectedCustomers.includes(id))) {
      setSelectedCustomers(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedCustomers(prev => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const filteredCustomersForBulk = useMemo(() => {
    let result = customers;
    
    // Apply country filter if countries are selected
    if (selectedCountries && selectedCountries.length > 0) {
      result = result.filter(c => c.country && (selectedCountries as string[]).includes(c.country));
    }
    
    // Apply text search
    if (bulkSearch) {
      const term = bulkSearch.toLowerCase();
      result = result.filter(c => 
        c.firstName?.toLowerCase().includes(term) ||
        c.lastName?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.country?.toLowerCase().includes(term)
      );
    }
    
    return result;
  }, [customers, bulkSearch, selectedCountries]);

  const formatDate = (date?: string) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString(localeMap[locale] || "en-US");
  };

  const formatCurrency = (amount?: string, currency?: string) => {
    if (!amount) return "-";
    const num = parseFloat(amount);
    return new Intl.NumberFormat(localeMap[locale] || "en-US", {
      style: "currency",
      currency: currency || "EUR",
    }).format(num);
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      generated: t.invoices?.statusGenerated || "Generated",
      draft: t.invoices?.statusDraft || "Draft",
      sent: t.invoices?.statusSent || "Sent",
      paid: t.invoices?.statusPaid || "Paid",
      partially_paid: t.invoices?.statusPartiallyPaid || "Partially Paid",
      overdue: t.invoices?.statusOverdue || "Overdue",
      cancelled: t.invoices?.statusCancelled || "Cancelled",
    };
    return labels[status] || status;
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "paid": return "default";
      case "sent": return "secondary";
      case "overdue": return "destructive";
      case "cancelled": return "outline";
      default: return "secondary";
    }
  };

  const enrichedInvoices = useMemo(() => {
    return invoices.map(inv => {
      const customer = customerMap.get(inv.customerId);
      const billing = inv.billingDetailsId ? billingMap.get(inv.billingDetailsId) : null;
      return {
        ...inv,
        customerName: customer ? `${customer.firstName} ${customer.lastName}` : "-",
        billingCompanyName: billing?.companyName || "-",
      };
    });
  }, [invoices, customerMap, billingMap]);

  const filteredInvoices = useMemo(() => {
    let result = [...enrichedInvoices];

    if (statusFilter !== "all") {
      result = result.filter(inv => inv.status === statusFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(inv =>
        inv.invoiceNumber?.toLowerCase().includes(term) ||
        inv.customerName?.toLowerCase().includes(term) ||
        inv.billingCompanyName?.toLowerCase().includes(term)
      );
    }

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "invoiceNumber":
          comparison = (a.invoiceNumber || "").localeCompare(b.invoiceNumber || "");
          break;
        case "issueDate":
          comparison = new Date(a.issueDate || 0).getTime() - new Date(b.issueDate || 0).getTime();
          break;
        case "dueDate":
          comparison = new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime();
          break;
        case "totalAmount":
          comparison = parseFloat(a.totalAmount || "0") - parseFloat(b.totalAmount || "0");
          break;
        case "status":
          comparison = (a.status || "").localeCompare(b.status || "");
          break;
        case "customerName":
          comparison = (a.customerName || "").localeCompare(b.customerName || "");
          break;
        case "wizardCreatedAt":
          comparison = new Date(a.wizardCreatedAt || 0).getTime() - new Date(b.wizardCreatedAt || 0).getTime();
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return result;
  }, [enrichedInvoices, statusFilter, searchTerm, sortField, sortDirection]);

  const paginatedInvoices = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredInvoices.slice(start, start + perPage);
  }, [filteredInvoices, page, perPage]);

  const totalPages = Math.ceil(filteredInvoices.length / perPage);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1" />;
    return sortDirection === "asc" ? <ArrowUp className="h-4 w-4 ml-1" /> : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  const handleScheduledSort = (field: typeof scheduledSortField) => {
    if (scheduledSortField === field) {
      setScheduledSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setScheduledSortField(field);
      setScheduledSortDirection("desc");
    }
  };

  const ScheduledSortIcon = ({ field }: { field: typeof scheduledSortField }) => {
    if (scheduledSortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1" />;
    return scheduledSortDirection === "asc" ? <ArrowUp className="h-4 w-4 ml-1" /> : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  const CHART_COLORS = ["#6B1C3B", "#8B3A5B", "#AB587B", "#CB769B", "#EB94BB", "#4A5568", "#718096"];

  const reportData = useMemo(() => {
    const now = new Date();
    const months: { label: string; month: number; year: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        label: d.toLocaleDateString("sk-SK", { month: "short", year: "2-digit" }),
        month: d.getMonth(),
        year: d.getFullYear(),
      });
    }
    for (let i = 1; i <= 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      months.push({
        label: d.toLocaleDateString("sk-SK", { month: "short", year: "2-digit" }),
        month: d.getMonth(),
        year: d.getFullYear(),
      });
    }

    const monthlyData = months.map(m => {
      let issuedTotal = 0;
      let issuedCount = 0;
      let plannedTotal = 0;
      let plannedCount = 0;

      invoices.forEach(inv => {
        if (inv.issueDate) {
          const d = new Date(inv.issueDate);
          if (d.getMonth() === m.month && d.getFullYear() === m.year) {
            issuedTotal += convertToEur(inv.totalAmount || "0", inv.currency);
            issuedCount++;
          }
        }
      });

      scheduledInvoices.forEach(inv => {
        if (inv.status === "pending") {
          const d = new Date(inv.scheduledDate);
          if (d.getMonth() === m.month && d.getFullYear() === m.year) {
            plannedTotal += convertToEur(inv.totalAmount || "0", inv.currency);
            plannedCount++;
          }
        }
      });

      return {
        name: m.label,
        issued: issuedTotal,
        planned: plannedTotal,
        issuedCount,
        plannedCount,
      };
    });

    const byCustomer = new Map<string, { name: string; issued: number; planned: number }>();
    invoices.forEach(inv => {
      const customer = customerMap.get(inv.customerId);
      const name = customer ? `${customer.firstName} ${customer.lastName}` : "N/A";
      const existing = byCustomer.get(inv.customerId) || { name, issued: 0, planned: 0 };
      existing.issued += convertToEur(inv.totalAmount || "0", inv.currency);
      byCustomer.set(inv.customerId, existing);
    });
    scheduledInvoices.filter(s => s.status === "pending").forEach(inv => {
      const customer = customerMap.get(inv.customerId);
      const name = customer ? `${customer.firstName} ${customer.lastName}` : "N/A";
      const existing = byCustomer.get(inv.customerId) || { name, issued: 0, planned: 0 };
      existing.planned += convertToEur(inv.totalAmount || "0", inv.currency);
      byCustomer.set(inv.customerId, existing);
    });

    const customerData = Array.from(byCustomer.values())
      .sort((a, b) => (b.issued + b.planned) - (a.issued + a.planned))
      .slice(0, 10);

    const totals = {
      issuedTotal: invoices.reduce((sum, inv) => sum + convertToEur(inv.totalAmount || "0", inv.currency), 0),
      issuedCount: invoices.length,
      plannedTotal: scheduledInvoices.filter(s => s.status === "pending").reduce((sum, inv) => sum + convertToEur(inv.totalAmount || "0", inv.currency), 0),
      plannedCount: scheduledInvoices.filter(s => s.status === "pending").length,
    };

    const pieData = [
      { name: "Vydané", value: totals.issuedTotal },
      { name: "Plánované", value: totals.plannedTotal },
    ];

    return { monthlyData, customerData, totals, pieData };
  }, [invoices, scheduledInvoices, customerMap, convertToEur]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title={t.nav.customerInvoices}
          description={t.invoices?.description || "Manage customer invoices"}
        />
        {activeTab === "list" && (
          <Button
            onClick={() => setShowCreateWizard(true)}
            data-testid="button-create-invoice"
          >
            <Plus className="mr-2 h-4 w-4" />
            {t.invoices?.createInvoice || "Create Invoice"}
          </Button>
        )}
      </div>

      <CreateInvoiceWizard
        open={showCreateWizard}
        onClose={() => setShowCreateWizard(false)}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="list" data-testid="tab-invoices-list">
            <FileText className="h-4 w-4 mr-2" />
            {t.invoices?.listTab || "Invoice List"}
          </TabsTrigger>
          <TabsTrigger value="scheduled" data-testid="tab-invoices-scheduled">
            <Clock className="h-4 w-4 mr-2" />
            {t.invoices?.scheduledTab || "Scheduled"}
            {scheduledInvoices.filter(s => s.status === "pending").length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {scheduledInvoices.filter(s => s.status === "pending").length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="bulk" data-testid="tab-invoices-bulk">
            <Users className="h-4 w-4 mr-2" />
            {t.invoices?.bulkTab || "Bulk Generate"}
          </TabsTrigger>
          <TabsTrigger value="report" data-testid="tab-invoices-report">
            <BarChart3 className="h-4 w-4 mr-2" />
            Report
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-wrap gap-4 mb-6">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t.common?.search || "Search..."}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                      data-testid="input-search-invoices"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]" data-testid="select-status-filter">
                <SelectValue placeholder={t.invoices?.filterByStatus || "Filter by status"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.common?.all || "All"}</SelectItem>
                <SelectItem value="generated">{t.invoices?.statusGenerated || "Generated"}</SelectItem>
                <SelectItem value="sent">{t.invoices?.statusSent || "Sent"}</SelectItem>
                <SelectItem value="paid">{t.invoices?.statusPaid || "Paid"}</SelectItem>
                <SelectItem value="partially_paid">{t.invoices?.statusPartiallyPaid || "Partially Paid"}</SelectItem>
                <SelectItem value="overdue">{t.invoices?.statusOverdue || "Overdue"}</SelectItem>
                <SelectItem value="cancelled">{t.invoices?.statusCancelled || "Cancelled"}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredInvoices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t.invoices?.noInvoices || "No invoices found"}</p>
            </div>
          ) : (
            <>
              <Table data-testid="table-invoices">
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("invoiceNumber")} data-testid="th-sort-invoiceNumber">
                      <div className="flex items-center">
                        {t.invoices?.invoiceNumber || "Invoice #"}
                        <SortIcon field="invoiceNumber" />
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("customerName")} data-testid="th-sort-customerName">
                      <div className="flex items-center">
                        {t.customers?.title || "Customer"}
                        <SortIcon field="customerName" />
                      </div>
                    </TableHead>
                    <TableHead data-testid="th-billingCompany">{t.invoices?.billingCompany || "Billing Company"}</TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("status")} data-testid="th-sort-status">
                      <div className="flex items-center">
                        {t.invoices?.status || "Status"}
                        <SortIcon field="status" />
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("issueDate")} data-testid="th-sort-issueDate">
                      <div className="flex items-center">
                        {t.invoices?.issueDate || "Issue Date"}
                        <SortIcon field="issueDate" />
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("dueDate")} data-testid="th-sort-dueDate">
                      <div className="flex items-center">
                        {t.invoices?.dueDate || "Due Date"}
                        <SortIcon field="dueDate" />
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer text-right" onClick={() => handleSort("totalAmount")} data-testid="th-sort-totalAmount">
                      <div className="flex items-center justify-end">
                        {t.invoices?.totalAmount || "Total"}
                        <SortIcon field="totalAmount" />
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort("wizardCreatedAt")} data-testid="th-sort-wizardCreatedAt">
                      <div className="flex items-center">
                        {t.invoices?.wizardCreated || "Wizard Created"}
                        <SortIcon field="wizardCreatedAt" />
                      </div>
                    </TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedInvoices.map((invoice) => (
                    <TableRow key={invoice.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedInvoice(invoice)} data-testid={`row-invoice-${invoice.id}`}>
                      <TableCell className="font-medium" data-testid={`text-invoiceNumber-${invoice.id}`}>{invoice.invoiceNumber}</TableCell>
                      <TableCell data-testid={`text-customerName-${invoice.id}`}>{invoice.customerName}</TableCell>
                      <TableCell data-testid={`text-billingCompany-${invoice.id}`}>{invoice.billingCompanyName}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(invoice.status)} data-testid={`badge-status-${invoice.id}`}>
                          {getStatusLabel(invoice.status)}
                        </Badge>
                      </TableCell>
                      <TableCell data-testid={`text-issueDate-${invoice.id}`}>{formatDate(invoice.issueDate)}</TableCell>
                      <TableCell data-testid={`text-dueDate-${invoice.id}`}>{formatDate(invoice.dueDate)}</TableCell>
                      <TableCell className="text-right" data-testid={`text-totalAmount-${invoice.id}`}>{formatCurrency(invoice.totalAmount, invoice.currency)}</TableCell>
                      <TableCell data-testid={`text-wizardCreated-${invoice.id}`}>
                        {invoice.wizardCreatedAt ? (
                          <span className="text-sm text-muted-foreground">
                            {formatDate(invoice.wizardCreatedAt)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedInvoice(invoice);
                            }}
                            data-testid={`btn-view-invoice-${invoice.id}`}
                            title={t.invoices?.viewDetails || "View Details"}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPdfInvoiceId(invoice.id);
                              setPdfInvoiceType("invoice");
                              setSelectedTemplateId("");
                              setSelectedLayoutId("");
                              setPdfDialogOpen(true);
                            }}
                            data-testid={`btn-pdf-invoice-${invoice.id}`}
                            title={t.invoices?.generatePdf || "Generate PDF"}
                          >
                            <FileDown className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-muted-foreground" data-testid="text-pagination-info">
                    {t.common?.showing || "Showing"} {((page - 1) * perPage) + 1}-{Math.min(page * perPage, filteredInvoices.length)} {t.common?.of || "of"} {filteredInvoices.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={page === 1}
                      onClick={() => setPage(p => p - 1)}
                      data-testid="btn-prev-page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={page === totalPages}
                      onClick={() => setPage(p => p + 1)}
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
        </TabsContent>

        <TabsContent value="scheduled">
          <Card>
            <CardContent className="p-6">
              {isLoadingScheduled ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : scheduledInvoices.filter(s => s.status === "pending").length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t.invoices?.noScheduledInvoices || "No scheduled invoices"}</p>
                  <p className="text-sm mt-2">{t.invoices?.scheduledInvoicesDescription || "Future installment invoices will appear here"}</p>
                </div>
              ) : (
                <>
                <Table data-testid="table-scheduled-invoices">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="cursor-pointer" onClick={() => handleScheduledSort("scheduledDate")} data-testid="th-scheduled-sort-date">
                        <div className="flex items-center">
                          {t.invoices?.scheduledDate || "Scheduled Date"}
                          <ScheduledSortIcon field="scheduledDate" />
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer" onClick={() => handleScheduledSort("customerName")} data-testid="th-scheduled-sort-customer">
                        <div className="flex items-center">
                          {t.customers?.title || "Customer"}
                          <ScheduledSortIcon field="customerName" />
                        </div>
                      </TableHead>
                      <TableHead>{t.invoices?.installment || "Installment"}</TableHead>
                      <TableHead className="cursor-pointer text-right" onClick={() => handleScheduledSort("totalAmount")} data-testid="th-scheduled-sort-amount">
                        <div className="flex items-center justify-end">
                          {t.invoices?.amount || "Amount"}
                          <ScheduledSortIcon field="totalAmount" />
                        </div>
                      </TableHead>
                      <TableHead>{t.invoices?.status || "Status"}</TableHead>
                      <TableHead className="cursor-pointer" onClick={() => handleScheduledSort("wizardCreatedAt")} data-testid="th-scheduled-sort-wizard">
                        <div className="flex items-center">
                          {t.invoices?.wizardCreated || "Wizard Created"}
                          <ScheduledSortIcon field="wizardCreatedAt" />
                        </div>
                      </TableHead>
                      <TableHead className="text-right">{t.common?.actions || "Actions"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const pending = scheduledInvoices.filter(s => s.status === "pending");
                      const sorted = [...pending].sort((a, b) => {
                        const customerA = customerMap.get(a.customerId);
                        const customerB = customerMap.get(b.customerId);
                        let comparison = 0;
                        switch (scheduledSortField) {
                          case "scheduledDate":
                            comparison = new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
                            break;
                          case "customerName":
                            const nameA = customerA ? `${customerA.firstName} ${customerA.lastName}` : "";
                            const nameB = customerB ? `${customerB.firstName} ${customerB.lastName}` : "";
                            comparison = nameA.localeCompare(nameB);
                            break;
                          case "totalAmount":
                            comparison = parseFloat(a.totalAmount || "0") - parseFloat(b.totalAmount || "0");
                            break;
                          case "wizardCreatedAt":
                            comparison = new Date(a.wizardCreatedAt || 0).getTime() - new Date(b.wizardCreatedAt || 0).getTime();
                            break;
                        }
                        return scheduledSortDirection === "asc" ? comparison : -comparison;
                      });
                      const filtered = sorted;
                      const startIdx = (scheduledPage - 1) * perPage;
                      const paginated = filtered.slice(startIdx, startIdx + perPage);
                      return paginated.map((scheduled) => {
                        const customer = customerMap.get(scheduled.customerId);
                        const isOverdue = new Date(scheduled.scheduledDate) < new Date();
                        return (
                          <TableRow key={scheduled.id} data-testid={`row-scheduled-${scheduled.id}`}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span className={isOverdue ? "text-destructive font-medium" : ""}>
                                  {formatDate(scheduled.scheduledDate)}
                                </span>
                                {isOverdue && (
                                  <Badge variant="destructive" className="text-xs">
                                    {t.invoices?.overdue || "Overdue"}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {customer ? `${customer.firstName} ${customer.lastName}` : scheduled.customerId}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {scheduled.installmentNumber}/{scheduled.totalInstallments}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(scheduled.totalAmount, scheduled.currency)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                <Clock className="h-3 w-3 mr-1" />
                                {t.invoices?.pending || "Pending"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {scheduled.wizardCreatedAt ? (
                                <span className="text-sm text-muted-foreground">
                                  {formatDate(scheduled.wizardCreatedAt)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setSelectedScheduledInvoice(scheduled)}
                                  data-testid={`button-view-metadata-${scheduled.id}`}
                                  title={t.invoices?.viewMetadata || "View Metadata"}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    setPdfInvoiceId(scheduled.id);
                                    setPdfInvoiceType("scheduled");
                                    setSelectedTemplateId("");
                                    setSelectedLayoutId("");
                                    setPdfDialogOpen(true);
                                  }}
                                  data-testid={`button-pdf-scheduled-${scheduled.id}`}
                                  title={t.invoices?.generatePdf || "Generate PDF"}
                                >
                                  <FileDown className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => createFromScheduledMutation.mutate(scheduled.id)}
                                  disabled={createFromScheduledMutation.isPending}
                                  data-testid={`button-create-from-scheduled-${scheduled.id}`}
                                >
                                  {createFromScheduledMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <FileText className="h-4 w-4 mr-1" />
                                      {t.invoices?.createInvoice || "Create Invoice"}
                                    </>
                                  )}
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => deleteScheduledMutation.mutate(scheduled.id)}
                                  disabled={deleteScheduledMutation.isPending}
                                  data-testid={`button-delete-scheduled-${scheduled.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      });
                    })()}
                  </TableBody>
                </Table>
                {/* Scheduled Invoices Pagination */}
                {(() => {
                  const filtered = scheduledInvoices.filter(s => s.status === "pending");
                  const scheduledTotalPages = Math.ceil(filtered.length / perPage);
                  if (scheduledTotalPages <= 1) return null;
                  return (
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-muted-foreground">
                        {t.common?.page || "Page"} {scheduledPage} {t.common?.of || "of"} {scheduledTotalPages} ({filtered.length} {t.common?.items || "items"})
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setScheduledPage(p => Math.max(1, p - 1))}
                          disabled={scheduledPage === 1}
                          data-testid="button-scheduled-prev-page"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm">{scheduledPage} / {scheduledTotalPages}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setScheduledPage(p => Math.min(scheduledTotalPages, p + 1))}
                          disabled={scheduledPage >= scheduledTotalPages}
                          data-testid="button-scheduled-next-page"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })()}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bulk">
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder={t.common?.search || "Search customers..."}
                        value={bulkSearch}
                        onChange={(e) => setBulkSearch(e.target.value)}
                        className="pl-9"
                        data-testid="input-search-bulk-customers"
                      />
                    </div>
                  </div>
                  <Badge variant="secondary" data-testid="badge-selected-count">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {selectedCustomers.length} {t.common?.selected || "selected"}
                  </Badge>
                  <Button
                    onClick={() => bulkGenerateMutation.mutate(selectedCustomers)}
                    disabled={selectedCustomers.length === 0 || bulkGenerateMutation.isPending}
                    data-testid="button-generate-bulk"
                  >
                    {bulkGenerateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4 mr-2" />
                    )}
                    {t.invoices?.generateSelected || "Generate Invoices"}
                  </Button>
                </div>

                <p className="text-sm text-muted-foreground">
                  {t.invoices?.bulkGenerateDescription || "Select customers to generate invoices for. Only customers with assigned products will be invoiced."}
                </p>

                <div className="border rounded-lg divide-y max-h-[60vh] overflow-y-auto">
                  <div className="flex items-center gap-3 p-3 bg-muted/50 sticky top-0">
                    <Checkbox 
                      id="select-all-bulk"
                      checked={filteredCustomersForBulk.length > 0 && filteredCustomersForBulk.every(c => selectedCustomers.includes(c.id))}
                      onCheckedChange={selectAllCustomers}
                      data-testid="checkbox-select-all-bulk"
                    />
                    <Label htmlFor="select-all-bulk" className="text-sm font-medium cursor-pointer">
                      {t.invoices?.selectAll || "Select all"} ({filteredCustomersForBulk.length})
                    </Label>
                  </div>

                  {filteredCustomersForBulk.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>{t.customers?.noData || "No customers found"}</p>
                    </div>
                  ) : (
                    filteredCustomersForBulk.map((customer) => (
                      <div 
                        key={customer.id} 
                        className="flex items-center gap-3 p-3 hover-elevate cursor-pointer"
                        onClick={() => toggleCustomer(customer.id)}
                        data-testid={`row-bulk-customer-${customer.id}`}
                      >
                        <Checkbox 
                          id={`bulk-customer-${customer.id}`}
                          checked={selectedCustomers.includes(customer.id)}
                          onCheckedChange={() => toggleCustomer(customer.id)}
                          onClick={(e) => e.stopPropagation()}
                          data-testid={`checkbox-bulk-customer-${customer.id}`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{customer.firstName} {customer.lastName}</p>
                          <p className="text-sm text-muted-foreground truncate">{customer.email}</p>
                        </div>
                        {customer.country && (
                          <Badge variant="outline" className="shrink-0">
                            {customer.country}
                          </Badge>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="report">
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <Card data-testid="card-issued-total">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                  <CardTitle className="text-sm font-medium">Vydané faktúry</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(reportData.totals.issuedTotal.toString(), "EUR")}</div>
                  <p className="text-xs text-muted-foreground">{reportData.totals.issuedCount} faktúr</p>
                </CardContent>
              </Card>

              <Card data-testid="card-planned-total">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                  <CardTitle className="text-sm font-medium">Plánované faktúry</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(reportData.totals.plannedTotal.toString(), "EUR")}</div>
                  <p className="text-xs text-muted-foreground">{reportData.totals.plannedCount} faktúr</p>
                </CardContent>
              </Card>

              <Card data-testid="card-customers-count">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                  <CardTitle className="text-sm font-medium">Zákazníci</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{reportData.customerData.length}</div>
                  <p className="text-xs text-muted-foreground">s faktúrami</p>
                </CardContent>
              </Card>

              <Card data-testid="card-forecast-total">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                  <CardTitle className="text-sm font-medium">Celkom</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency((reportData.totals.issuedTotal + reportData.totals.plannedTotal).toString(), "EUR")}
                  </div>
                  <p className="text-xs text-muted-foreground">vydané + plánované</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Mesačný prehľad
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={reportData.monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" fontSize={12} />
                        <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={(value: number) => formatCurrency(value.toString(), "EUR")} />
                        <Legend />
                        <Bar dataKey="issued" name="Vydané" fill="#6B1C3B" />
                        <Bar dataKey="planned" name="Plánované" fill="#AB587B" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Pomer vydané / plánované
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={reportData.pieData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {reportData.pieData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value.toString(), "EUR")} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Top 10 zákazníkov podľa hodnoty faktúr
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reportData.customerData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <YAxis dataKey="name" type="category" fontSize={11} width={120} />
                      <Tooltip formatter={(value: number) => formatCurrency(value.toString(), "EUR")} />
                      <Legend />
                      <Bar dataKey="issued" name="Vydané" fill="#6B1C3B" />
                      <Bar dataKey="planned" name="Plánované" fill="#AB587B" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <InvoiceDetailDrawer
        invoice={selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        formatDate={formatDate}
        formatCurrency={formatCurrency}
        getStatusLabel={getStatusLabel}
        getStatusVariant={getStatusVariant}
      />

      {/* Scheduled Invoice Metadata Sheet */}
      <Sheet open={!!selectedScheduledInvoice} onOpenChange={(open) => !open && setSelectedScheduledInvoice(null)}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              {t.invoices?.scheduledInvoiceMetadata || "Scheduled Invoice Metadata"}
            </SheetTitle>
          </SheetHeader>
          
          {selectedScheduledInvoice && (
            <div className="mt-6 space-y-6">
              {/* Basic Info */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  {t.invoices?.basicInfo || "Basic Info"}
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <Label className="text-muted-foreground text-xs">{t.invoices?.installment || "Installment"}</Label>
                    <p className="font-medium">{selectedScheduledInvoice.installmentNumber}/{selectedScheduledInvoice.totalInstallments}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">{t.invoices?.scheduledDate || "Scheduled Date"}</Label>
                    <p className="font-medium">{formatDate(selectedScheduledInvoice.scheduledDate)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">{t.invoices?.amount || "Amount"}</Label>
                    <p className="font-medium">{formatCurrency(selectedScheduledInvoice.totalAmount, selectedScheduledInvoice.currency)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">{t.invoices?.vatAmount || "VAT"}</Label>
                    <p className="font-medium">{formatCurrency(selectedScheduledInvoice.vatAmount || "0", selectedScheduledInvoice.currency)}</p>
                  </div>
                </div>
              </div>

              {/* Customer Metadata */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  {t.customers?.title || "Customer"}
                </h3>
                {selectedScheduledInvoice.customerName ? (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="col-span-2">
                      <Label className="text-muted-foreground text-xs">{t.customers?.name || "Name"}</Label>
                      <p className="font-medium">{selectedScheduledInvoice.customerName}</p>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-muted-foreground text-xs">{t.customers?.address || "Address"}</Label>
                      <p>{selectedScheduledInvoice.customerAddress}</p>
                      <p>{selectedScheduledInvoice.customerZip} {selectedScheduledInvoice.customerCity}, {selectedScheduledInvoice.customerCountry}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">{t.customers?.email || "Email"}</Label>
                      <p>{selectedScheduledInvoice.customerEmail || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">{t.customers?.phone || "Phone"}</Label>
                      <p>{selectedScheduledInvoice.customerPhone || "-"}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">{t.invoices?.noMetadata || "No metadata stored"}</p>
                )}
              </div>

              {/* Billing Company Metadata */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  {t.invoices?.billingCompany || "Billing Company"}
                </h3>
                {selectedScheduledInvoice.billingCompanyName ? (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="col-span-2">
                      <Label className="text-muted-foreground text-xs">{t.invoices?.companyName || "Company"}</Label>
                      <p className="font-medium">{selectedScheduledInvoice.billingCompanyName}</p>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-muted-foreground text-xs">{t.customers?.address || "Address"}</Label>
                      <p>{selectedScheduledInvoice.billingAddress}</p>
                      <p>{selectedScheduledInvoice.billingZip} {selectedScheduledInvoice.billingCity}, {selectedScheduledInvoice.billingCountry}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">{t.invoices?.taxId || "Tax ID"}</Label>
                      <p>{selectedScheduledInvoice.billingTaxId || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">{t.invoices?.vatId || "VAT ID"}</Label>
                      <p>{selectedScheduledInvoice.billingVatId || "-"}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">{t.invoices?.noMetadata || "No metadata stored"}</p>
                )}
              </div>

              {/* Bank Account Metadata */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  {t.invoices?.bankAccount || "Bank Account"}
                </h3>
                {selectedScheduledInvoice.billingBankIban ? (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="col-span-2">
                      <Label className="text-muted-foreground text-xs">{t.invoices?.bankName || "Bank"}</Label>
                      <p className="font-medium">{selectedScheduledInvoice.billingBankName || "-"}</p>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-muted-foreground text-xs">IBAN</Label>
                      <p className="font-mono text-xs">{selectedScheduledInvoice.billingBankIban}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">SWIFT/BIC</Label>
                      <p className="font-mono">{selectedScheduledInvoice.billingBankSwift || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">{t.invoices?.accountNumber || "Account #"}</Label>
                      <p className="font-mono">{selectedScheduledInvoice.billingBankAccountNumber || "-"}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">{t.invoices?.noMetadata || "No metadata stored"}</p>
                )}
              </div>

              {/* QR Codes */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  {t.invoices?.qrCodes || "QR Codes"}
                </h3>
                {(selectedScheduledInvoice.qrCodeData || selectedScheduledInvoice.epcQrCodeData) ? (
                  <div className="flex gap-6">
                    {selectedScheduledInvoice.qrCodeData && (
                      <div className="text-center">
                        <img 
                          src={selectedScheduledInvoice.qrCodeData} 
                          alt="Pay by Square" 
                          className="w-24 h-24 rounded border"
                        />
                        <p className="text-xs text-muted-foreground mt-1">PAY by Square</p>
                      </div>
                    )}
                    {selectedScheduledInvoice.epcQrCodeData && (
                      <div className="text-center">
                        <img 
                          src={selectedScheduledInvoice.epcQrCodeData} 
                          alt="EPC QR" 
                          className="w-24 h-24 rounded border"
                        />
                        <p className="text-xs text-muted-foreground mt-1">EPC QR</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">{t.invoices?.noQrCodes || "No QR codes stored"}</p>
                )}
              </div>

              {/* Items */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  {t.invoices?.tabItems || "Items"}
                </h3>
                {selectedScheduledInvoice.items && selectedScheduledInvoice.items.length > 0 ? (
                  <div className="border rounded-lg divide-y">
                    {selectedScheduledInvoice.items.map((item: any, idx: number) => (
                      <div key={idx} className="p-3 text-sm">
                        <p className="font-medium">{item.name}</p>
                        <div className="flex justify-between text-muted-foreground mt-1">
                          <span>{item.quantity}x @ {formatCurrency(item.unitPrice, selectedScheduledInvoice.currency)}</span>
                          <span className="font-medium text-foreground">{formatCurrency(item.totalPrice, selectedScheduledInvoice.currency)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">{t.invoices?.noItems || "No items"}</p>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={pdfDialogOpen} onOpenChange={setPdfDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-pdf-template">
          <DialogHeader>
            <DialogTitle>{t.invoices?.selectTemplate || "Výber DOCX šablóny"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t.invoices?.template || "DOCX šablóna"}</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger data-testid="select-template">
                  <SelectValue placeholder="Vyberte DOCX šablónu" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">{t.invoices?.defaultTemplate || "Predvolená šablóna"}</SelectItem>
                  {docxTemplates.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id}>
                      {tpl.name}
                      {tpl.countryCode && ` (${tpl.countryCode})`}
                      {tpl.year && ` - ${tpl.year}`}
                      {tpl.version && ` v${tpl.version}`}
                      {tpl.isDefault && " *"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => setPdfDialogOpen(false)} data-testid="btn-cancel-pdf">
              {t.common?.cancel || "Zrušiť"}
            </Button>
            <Button
              onClick={() => {
                if (pdfInvoiceId) {
                  const params = new URLSearchParams();
                  if (selectedTemplateId && selectedTemplateId !== "default") {
                    params.set("templateId", selectedTemplateId);
                  }
                  const endpoint = pdfInvoiceType === "scheduled" 
                    ? `/api/scheduled-invoices/${pdfInvoiceId}/pdf-docx`
                    : `/api/invoices/${pdfInvoiceId}/pdf-docx`;
                  const url = params.toString() ? `${endpoint}?${params}` : endpoint;
                  window.open(url, "_blank");
                  setPdfDialogOpen(false);
                }
              }}
              data-testid="btn-generate-pdf"
            >
              <FileDown className="h-4 w-4 mr-2" />
              {t.invoices?.generatePdf || "Generovať PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InvoiceDetailDrawer({
  invoice,
  onClose,
  formatDate,
  formatCurrency,
  getStatusLabel,
  getStatusVariant,
}: {
  invoice: Invoice | null;
  onClose: () => void;
  formatDate: (date?: string) => string;
  formatCurrency: (amount?: string, currency?: string) => string;
  getStatusLabel: (status: string) => string;
  getStatusVariant: (status: string) => "default" | "secondary" | "destructive" | "outline";
}) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState("details");

  const { data: items = [], isLoading: itemsLoading } = useQuery<InvoiceItem[]>({
    queryKey: ["/api/invoices", invoice?.id, "items"],
    enabled: !!invoice?.id,
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery<InvoicePayment[]>({
    queryKey: ["/api/invoices", invoice?.id, "payments"],
    enabled: !!invoice?.id,
  });

  const { data: customer } = useQuery<Customer>({
    queryKey: ["/api/customers", invoice?.customerId],
    enabled: !!invoice?.customerId,
  });

  if (!invoice) return null;

  return (
    <Sheet open={!!invoice} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            {t.invoices?.invoiceDetail || "Invoice Detail"}: {invoice.invoiceNumber}
          </SheetTitle>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6" data-testid="tabs-invoice-detail">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details" data-testid="tab-details">{t.invoices?.tabDetails || "Details"}</TabsTrigger>
            <TabsTrigger value="items" data-testid="tab-items">{t.invoices?.tabItems || "Items"}</TabsTrigger>
            <TabsTrigger value="payments" data-testid="tab-payments">{t.invoices?.tabPayments || "Payments"}</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">{t.invoices?.invoiceNumber || "Invoice Number"}</Label>
                <p className="font-medium">{invoice.invoiceNumber}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">{t.invoices?.status || "Status"}</Label>
                <div>
                  <Badge variant={getStatusVariant(invoice.status)}>
                    {getStatusLabel(invoice.status)}
                  </Badge>
                </div>
              </div>
            </div>

            {customer && (
              <div>
                <Label className="text-muted-foreground">{t.customers?.title || "Customer"}</Label>
                <p className="font-medium">{customer.firstName} {customer.lastName}</p>
                <p className="text-sm text-muted-foreground">{customer.email}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">{t.invoices?.issueDate || "Issue Date"}</Label>
                <p>{formatDate(invoice.issueDate)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">{t.invoices?.dueDate || "Due Date"}</Label>
                <p>{formatDate(invoice.dueDate)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">{t.invoices?.deliveryDate || "Delivery Date"}</Label>
                <p>{formatDate(invoice.deliveryDate)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">{t.invoices?.sendDate || "Send Date"}</Label>
                <p>{formatDate(invoice.sendDate)}</p>
              </div>
            </div>

            {(invoice.periodFrom || invoice.periodTo) && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">{t.invoices?.periodFrom || "Period From"}</Label>
                  <p>{formatDate(invoice.periodFrom)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t.invoices?.periodTo || "Period To"}</Label>
                  <p>{formatDate(invoice.periodTo)}</p>
                </div>
              </div>
            )}

            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium mb-3">{t.invoices?.paymentDetails || "Payment Details"}</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-muted-foreground">{t.invoices?.variableSymbol || "Variable Symbol"}</Label>
                  <p>{invoice.variableSymbol || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t.invoices?.constantSymbol || "Constant Symbol"}</Label>
                  <p>{invoice.constantSymbol || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t.invoices?.specificSymbol || "Specific Symbol"}</Label>
                  <p>{invoice.specificSymbol || "-"}</p>
                </div>
              </div>
            </div>

            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium mb-3">{t.invoices?.amounts || "Amounts"}</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-muted-foreground">{t.invoices?.subtotal || "Subtotal"}</Label>
                  <p>{formatCurrency(invoice.subtotal, invoice.currency)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t.invoices?.vatAmount || "VAT"}</Label>
                  <p>{formatCurrency(invoice.vatAmount, invoice.currency)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t.invoices?.totalAmount || "Total"}</Label>
                  <p className="font-bold text-lg">{formatCurrency(invoice.totalAmount, invoice.currency)}</p>
                </div>
              </div>
            </div>

            {invoice.status === "paid" && (
              <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-green-700 dark:text-green-400 font-medium">
                  {t.invoices?.fullyPaid || "Fully Paid"}: {formatCurrency(invoice.paidAmount, invoice.currency)}
                </span>
              </div>
            )}

            {/* Billing Company Metadata */}
            {invoice.billingCompanyName && (
              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium mb-3">{t.invoices?.billingCompany || "Billing Company"}</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="col-span-2">
                    <Label className="text-muted-foreground text-xs">{t.invoices?.companyName || "Company"}</Label>
                    <p className="font-medium">{invoice.billingCompanyName}</p>
                  </div>
                  {(invoice.billingAddress || invoice.billingCity || invoice.billingCountry) && (
                    <div className="col-span-2">
                      <Label className="text-muted-foreground text-xs">{t.customers?.address || "Address"}</Label>
                      <p>{invoice.billingAddress || "-"}</p>
                      <p>{[invoice.billingZip, invoice.billingCity, invoice.billingCountry].filter(Boolean).join(", ") || "-"}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-muted-foreground text-xs">{t.invoices?.taxId || "Tax ID"}</Label>
                    <p>{invoice.billingTaxId || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">{t.invoices?.vatId || "VAT ID"}</Label>
                    <p>{invoice.billingVatId || "-"}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Bank Account Metadata */}
            {invoice.billingBankIban && (
              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium mb-3">{t.invoices?.bankAccount || "Bank Account"}</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="col-span-2">
                    <Label className="text-muted-foreground text-xs">{t.invoices?.bankName || "Bank"}</Label>
                    <p className="font-medium">{invoice.billingBankName || "-"}</p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-muted-foreground text-xs">IBAN</Label>
                    <p className="font-mono text-xs">{invoice.billingBankIban}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">SWIFT/BIC</Label>
                    <p className="font-mono">{invoice.billingBankSwift || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">{t.invoices?.accountNumber || "Account #"}</Label>
                    <p className="font-mono">{invoice.billingBankAccountNumber || "-"}</p>
                  </div>
                </div>
              </div>
            )}

            {/* QR Codes */}
            {(invoice.qrCodeData || invoice.epcQrCodeData) && (
              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium mb-3">{t.invoices?.qrCodes || "QR Codes"}</h4>
                <div className="flex gap-6">
                  {invoice.qrCodeData && (
                    <div className="text-center">
                      <img 
                        src={invoice.qrCodeData} 
                        alt="Pay by Square" 
                        className="w-24 h-24 rounded border"
                        data-testid={`img-qr-pay-by-square-${invoice.id}`}
                      />
                      <p className="text-xs text-muted-foreground mt-1" data-testid={`text-qr-pay-by-square-label-${invoice.id}`}>PAY by Square</p>
                    </div>
                  )}
                  {invoice.epcQrCodeData && (
                    <div className="text-center">
                      <img 
                        src={invoice.epcQrCodeData} 
                        alt="EPC QR" 
                        className="w-24 h-24 rounded border"
                        data-testid={`img-qr-epc-${invoice.id}`}
                      />
                      <p className="text-xs text-muted-foreground mt-1" data-testid={`text-qr-epc-label-${invoice.id}`}>EPC QR</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="items" className="space-y-4 mt-4">
            {itemsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>{t.invoices?.noItems || "No items"}</p>
              </div>
            ) : (
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
                      <TableCell className="text-right">{formatCurrency(item.unitPrice, invoice.currency)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.total, invoice.currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="payments" className="space-y-4 mt-4">
            {paymentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : payments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>{t.invoices?.noPayments || "No payments"}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.invoices?.paymentDate || "Date"}</TableHead>
                    <TableHead className="text-right">{t.invoices?.paymentAmount || "Amount"}</TableHead>
                    <TableHead>{t.invoices?.paymentMethod || "Method"}</TableHead>
                    <TableHead>{t.invoices?.paymentStatus || "Status"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(payment.amount, payment.currency)}</TableCell>
                      <TableCell>{payment.paymentMethod || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={payment.status === "completed" ? "default" : "secondary"}>
                          {payment.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
