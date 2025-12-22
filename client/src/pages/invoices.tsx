import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, FileText, Download, Users, CheckCircle } from "lucide-react";
import { useI18n } from "@/i18n";
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

export default function InvoicesPage() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: customers = [], isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const bulkGenerateMutation = useMutation({
    mutationFn: (customerIds: string[]) => 
      apiRequest("POST", "/api/invoices/bulk-generate", { customerIds }),
    onSuccess: async (response) => {
      const data = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setIsBulkDialogOpen(false);
      setSelectedCustomers([]);
      toast({ 
        title: "Bulk invoicing complete", 
        description: data.message 
      });
    },
    onError: () => {
      toast({ title: "Failed to generate invoices", variant: "destructive" });
    },
  });

  const getCustomerName = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    return customer ? `${customer.firstName} ${customer.lastName}` : "Unknown";
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
      
      toast({ title: "Invoice downloaded successfully" });
    } catch (error) {
      toast({ title: "Failed to download invoice", variant: "destructive" });
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

  const filteredInvoices = invoices.filter(invoice =>
    invoice.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
    getCustomerName(invoice.customerId).toLowerCase().includes(search.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid": return "default";
      case "sent": return "secondary";
      case "generated": return "outline";
      default: return "outline";
    }
  };

  const columns = [
    {
      key: "invoice",
      header: "Invoice",
      cell: (invoice: Invoice) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium">{invoice.invoiceNumber}</p>
            <p className="text-sm text-muted-foreground">
              {format(new Date(invoice.generatedAt), "MMM dd, yyyy")}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      cell: (invoice: Invoice) => (
        <span>{getCustomerName(invoice.customerId)}</span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      cell: (invoice: Invoice) => (
        <span className="font-medium">
          {parseFloat(invoice.totalAmount).toFixed(2)} {invoice.currency}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (invoice: Invoice) => (
        <Badge variant={getStatusColor(invoice.status)} className="capitalize">
          {invoice.status}
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
        description=""
      >
        <Button 
          onClick={() => setIsBulkDialogOpen(true)} 
          disabled={bulkGenerateMutation.isPending}
          data-testid="button-bulk-invoice"
        >
          <Users className="h-4 w-4 mr-2" />
          Bulk Generate
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoices..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-invoices"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {filteredInvoices.length} invoices
            </div>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={filteredInvoices}
        isLoading={invoicesLoading || customersLoading}
        emptyMessage="No invoices found. Generate invoices from customer pages or use bulk generation."
        getRowKey={(i) => i.id}
      />

      <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Bulk Invoice Generation</DialogTitle>
            <DialogDescription>
              Select customers to generate invoices for. Only customers with assigned products will be invoiced.
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
                Select All ({customers.length} customers)
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
              {selectedCustomers.length} customers selected
            </div>
            <Button 
              variant="outline" 
              onClick={() => setIsBulkDialogOpen(false)}
              data-testid="button-cancel-bulk"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => bulkGenerateMutation.mutate(selectedCustomers)}
              disabled={selectedCustomers.length === 0 || bulkGenerateMutation.isPending}
              data-testid="button-confirm-bulk"
            >
              {bulkGenerateMutation.isPending ? "Generating..." : `Generate ${selectedCustomers.length} Invoices`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
