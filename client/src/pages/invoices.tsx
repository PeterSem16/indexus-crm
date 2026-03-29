import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, FileText, Download, Users, CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/i18n";
import { useCountryFilter } from "@/contexts/country-filter-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Checkbox } from "@/components/ui/checkbox";
import type { Invoice, Customer } from "@shared/schema";
import { format } from "date-fns";

const LOCALE_MAP: Record<string, string> = {
  en: 'en-US',
  sk: 'sk-SK',
  cs: 'cs-CZ',
  hu: 'hu-HU',
  ro: 'ro-RO',
  it: 'it-IT',
  de: 'de-DE',
};

export default function InvoicesPage() {
  const { toast } = useToast();
  const { t, locale } = useI18n();
  const { selectedCountries } = useCountryFilter();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { setPage(1); }, [selectedCountries]);

  const { data: paginatedResult, isLoading: invoicesLoading } = useQuery<{ data: Invoice[], total: number }>({
    queryKey: ["/api/invoices", { page, limit: pageSize, search: debouncedSearch, countries: selectedCountries }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(pageSize));
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (selectedCountries.length > 0) params.set("countries", selectedCountries.join(","));
      const res = await fetch(`/api/invoices?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });
  const invoices = paginatedResult?.data || [];
  const totalInvoices = paginatedResult?.total || 0;
  const totalPages = Math.ceil(totalInvoices / pageSize);

  const { data: customers = [], isLoading: customersLoading } = useQuery<any[]>({
    queryKey: ["/api/customers/lookup"],
  });

  const bulkGenerateMutation = useMutation({
    mutationFn: (customerIds: string[]) => 
      apiRequest("POST", "/api/invoices/bulk-generate", { customerIds }),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setIsBulkDialogOpen(false);
      setSelectedCustomers([]);
      toast({ title: t.success.created });
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  const getCustomerName = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    return customer ? `${customer.firstName} ${customer.lastName}` : t.common.noData;
  };

  const handleDownloadPdf = async (invoiceId: string, invoiceNumber: string) => {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/pdf`, {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to download PDF");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({ title: t.success.saved });
    } catch (error) {
      toast({ title: t.errors.loadFailed, variant: "destructive" });
    }
  };

  const toggleCustomer = (customerId: string) => {
    setSelectedCustomers(prev => 
      prev.includes(customerId) 
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    );
  };

  const selectAllCustomers = () => {
    if (selectedCustomers.length === customers.length) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(customers.map(c => c.id));
    }
  };

  const filteredInvoices = invoices;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid": return "default";
      case "sent": return "secondary";
      case "generated": return "outline";
      default: return "outline";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "paid": return t.invoices.paid;
      case "unpaid": return t.invoices.unpaid;
      case "overdue": return t.invoices.overdue;
      case "sent": return t.invoices.sent;
      case "generated": return t.invoices.generated;
      default: return status;
    }
  };

  const columns = [
    {
      key: "invoice",
      header: t.invoices.invoiceNumber,
      cell: (invoice: Invoice) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium">{invoice.invoiceNumber}</p>
              {(invoice as any).dataSource === 'iscbc' && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800" data-testid={`badge-iscbc-invoice-${invoice.id}`}>
                  ISCBC
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {new Intl.DateTimeFormat(LOCALE_MAP[locale] || 'en-US', { dateStyle: 'medium' }).format(new Date(invoice.generatedAt))}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "customer",
      header: t.invoices.customer,
      cell: (invoice: Invoice) => (
        <span>{getCustomerName(invoice.customerId)}</span>
      ),
    },
    {
      key: "amount",
      header: t.invoices.amount,
      cell: (invoice: Invoice) => (
        <span className="font-medium">
          {parseFloat(invoice.totalAmount).toFixed(2)} {invoice.currency}
        </span>
      ),
    },
    {
      key: "status",
      header: t.invoices.status,
      cell: (invoice: Invoice) => (
        <Badge variant={getStatusColor(invoice.status)} className="capitalize">
          {getStatusLabel(invoice.status)}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (invoice: Invoice) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleDownloadPdf(invoice.id, invoice.invoiceNumber)}
          data-testid={`button-download-invoice-${invoice.id}`}
        >
          <Download className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.invoices.title}
        description={t.invoices.description}
      >
        <Button 
          onClick={() => setIsBulkDialogOpen(true)} 
          disabled={bulkGenerateMutation.isPending}
          data-testid="button-bulk-invoice"
        >
          <Users className="h-4 w-4 mr-2" />
          {t.invoices.bulkGenerate}
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t.invoices.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-invoices"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {totalInvoices} {t.invoices.title.toLowerCase()}
            </div>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={filteredInvoices}
        isLoading={invoicesLoading || customersLoading}
        emptyMessage={t.invoices.noInvoices}
        getRowKey={(i) => i.id}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <div className="text-sm text-muted-foreground">
            {t.common.page || "Strana"} {page} / {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} data-testid="button-prev-page">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} data-testid="button-next-page">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{t.invoices.bulkGenerateTitle}</DialogTitle>
            <DialogDescription>
              {t.invoices.bulkGenerateDescription}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto space-y-2 py-4">
            <div className="flex items-center space-x-2 pb-2 border-b">
              <Checkbox 
                id="select-all"
                checked={selectedCustomers.length === customers.length && customers.length > 0}
                onCheckedChange={selectAllCustomers}
                data-testid="checkbox-select-all"
              />
              <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                {t.invoices.selectAll} ({customers.length} {t.customers.title.toLowerCase()})
              </label>
            </div>
            
            {customers.map((customer) => (
              <div key={customer.id} className="flex items-center space-x-3 p-2 rounded-md hover-elevate">
                <Checkbox 
                  id={`customer-${customer.id}`}
                  checked={selectedCustomers.includes(customer.id)}
                  onCheckedChange={() => toggleCustomer(customer.id)}
                  data-testid={`checkbox-customer-${customer.id}`}
                />
                <label 
                  htmlFor={`customer-${customer.id}`} 
                  className="flex-1 cursor-pointer"
                >
                  <span className="font-medium">{customer.firstName} {customer.lastName}</span>
                  <span className="text-sm text-muted-foreground ml-2">{customer.email}</span>
                </label>
                <Badge variant="outline" className="text-xs">
                  {customer.country}
                </Badge>
              </div>
            ))}
          </div>

          <DialogFooter className="border-t pt-4">
            <div className="flex items-center gap-2 mr-auto text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4" />
              {selectedCustomers.length} {t.customers.title.toLowerCase()}
            </div>
            <Button 
              variant="outline" 
              onClick={() => setIsBulkDialogOpen(false)}
              data-testid="button-cancel-bulk"
            >
              {t.common.cancel}
            </Button>
            <Button 
              onClick={() => bulkGenerateMutation.mutate(selectedCustomers)}
              disabled={selectedCustomers.length === 0 || bulkGenerateMutation.isPending}
              data-testid="button-confirm-bulk"
            >
              {bulkGenerateMutation.isPending ? t.invoices.generating : t.invoices.generateSelected}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
