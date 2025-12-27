import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Search, Eye, Package, FileText, Download, Calculator, MessageSquare, History, Send, Mail, Phone, Baby, Copy, ListChecks, FileEdit, UserCircle, Clock, PlusCircle, RefreshCw, XCircle, LogIn, LogOut, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/i18n";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { AdvancedFilters, type CustomerFilters } from "@/components/advanced-filters";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { CustomerForm, type CustomerFormData } from "@/components/customer-form";
import { CustomerFormWizard, type CustomerFormData as WizardCustomerFormData } from "@/components/customer-form-wizard";
import { PotentialCaseForm, EmbeddedPotentialCaseForm } from "@/components/potential-case-form";
import { useCountryFilter } from "@/contexts/country-filter-context";
import { usePermissions } from "@/contexts/permissions-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getCountryFlag, getCountryName } from "@/lib/countries";
import type { Customer, Product, CustomerProduct, Invoice, BillingDetails, CustomerNote, ActivityLog, CommunicationMessage, CustomerPotentialCase } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";

type CustomerProductWithProduct = CustomerProduct & { product: Product };

interface InvoiceLineItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  currency: string;
}

function CustomerDetailsContent({ 
  customer, 
  onEdit 
}: { 
  customer: Customer; 
  onEdit: () => void;
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("1");
  const [isManualInvoiceOpen, setIsManualInvoiceOpen] = useState(false);
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLineItem[]>([]);
  const [newLineProductId, setNewLineProductId] = useState<string>("");
  const [newLineQty, setNewLineQty] = useState<string>("1");
  const [newLinePrice, setNewLinePrice] = useState<string>("");
  const [selectedPaymentTerm, setSelectedPaymentTerm] = useState<number | null>(null);
  const [newNoteContent, setNewNoteContent] = useState<string>("");
  const [emailSubject, setEmailSubject] = useState<string>("");
  const [emailContent, setEmailContent] = useState<string>("");
  const [smsContent, setSmsContent] = useState<string>("");

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: customerNotes = [], isLoading: notesLoading } = useQuery<CustomerNote[]>({
    queryKey: ["/api/customers", customer.id, "notes"],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${customer.id}/notes`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch notes");
      return res.json();
    },
  });

  const { data: activityLogs = [], isLoading: activityLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/customers", customer.id, "activity-logs"],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${customer.id}/activity-logs`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch activity logs");
      return res.json();
    },
  });

  const { data: allUsers = [] } = useQuery<Array<{ id: string; username: string; firstName?: string; lastName?: string }>>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const getUserName = (userId: string) => {
    const user = allUsers.find(u => u.id === userId);
    if (user) {
      if (user.firstName && user.lastName) {
        return `${user.firstName} ${user.lastName}`;
      }
      return user.username;
    }
    return userId;
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "create":
        return <PlusCircle className="h-4 w-4 text-green-600" />;
      case "update":
        return <RefreshCw className="h-4 w-4 text-blue-600" />;
      case "delete":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "login":
        return <LogIn className="h-4 w-4 text-emerald-600" />;
      case "logout":
        return <LogOut className="h-4 w-4 text-gray-600" />;
      case "view":
        return <Eye className="h-4 w-4 text-purple-600" />;
      case "assign_product":
        return <Package className="h-4 w-4 text-indigo-600" />;
      case "generate_invoice":
        return <FileText className="h-4 w-4 text-amber-600" />;
      case "send_email":
        return <Mail className="h-4 w-4 text-sky-600" />;
      case "send_sms":
        return <MessageSquare className="h-4 w-4 text-teal-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      create: t.activity?.created || "Created",
      update: t.activity?.updated || "Updated",
      delete: t.activity?.deleted || "Deleted",
      view: t.activity?.viewed || "Viewed",
      login: t.activity?.login || "Login",
      logout: t.activity?.logout || "Logout",
      assign_product: t.activity?.assignedProduct || "Assigned product",
      generate_invoice: t.activity?.generatedInvoice || "Generated invoice",
      send_email: t.activity?.sentEmail || "Sent email",
      send_sms: t.activity?.sentSms || "Sent SMS",
    };
    return labels[action] || action.replace(/_/g, " ");
  };

  const parseDetails = (details: string | null) => {
    if (!details) return null;
    try {
      const parsed = JSON.parse(details);
      return parsed;
    } catch {
      return null;
    }
  };

  const renderFieldChanges = (details: Record<string, unknown> | null, action: string) => {
    if (!details) return null;
    
    if (action === "update" && details.changes && Array.isArray(details.changes)) {
      const changedFields = details.changes
        .filter((change): change is { field: string; from?: unknown; to?: unknown } => 
          typeof change === 'object' && change !== null && 'field' in change
        )
        .map(c => c.field);
      
      if (changedFields.length > 0) {
        return (
          <p className="mt-1 text-xs text-muted-foreground">
            {t.activity?.changedField || "Changed fields"}: {changedFields.join(", ")}
          </p>
        );
      }
      return null;
    }
    
    if (details.message) {
      return (
        <p className="mt-1 text-xs text-muted-foreground">{String(details.message)}</p>
      );
    }
    
    return null;
  };

  const { data: customerProducts = [], isLoading: productsLoading } = useQuery<CustomerProductWithProduct[]>({
    queryKey: ["/api/customers", customer.id, "products"],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${customer.id}/products`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch customer products");
      return res.json();
    },
  });

  const { data: customerInvoices = [], isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/customers", customer.id, "invoices"],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${customer.id}/invoices`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch customer invoices");
      return res.json();
    },
  });

  const { data: billingCompanies = [] } = useQuery<BillingDetails[]>({
    queryKey: ["/api/billing-details", "country", customer.country],
    queryFn: async () => {
      const res = await fetch(`/api/billing-details?country=${customer.country}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const [selectedBillingCompanyId, setSelectedBillingCompanyId] = useState<string>("");
  
  // Get the currently selected billing company or use the default one
  const billingDetails = selectedBillingCompanyId 
    ? billingCompanies.find(bc => bc.id === selectedBillingCompanyId) || null
    : billingCompanies.find(bc => bc.isDefault) || billingCompanies[0] || null;

  const { data: communicationMessages = [], isLoading: messagesLoading } = useQuery<CommunicationMessage[]>({
    queryKey: ["/api/customers", customer.id, "messages"],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${customer.id}/messages`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
  });

  const addProductMutation = useMutation({
    mutationFn: (data: { productId: string; quantity: number }) =>
      apiRequest("POST", `/api/customers/${customer.id}/products`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customer.id, "products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setSelectedProductId("");
      setQuantity("1");
      toast({ title: "Product added to customer" });
    },
    onError: () => {
      toast({ title: "Failed to add product", variant: "destructive" });
    },
  });

  const removeProductMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/customer-products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customer.id, "products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Product removed from customer" });
    },
    onError: () => {
      toast({ title: "Failed to remove product", variant: "destructive" });
    },
  });

  const generateInvoiceMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/customers/${customer.id}/invoices/generate`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customer.id, "invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Invoice generated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to generate invoice", variant: "destructive" });
    },
  });

  const manualInvoiceMutation = useMutation({
    mutationFn: (data: { items: Array<{ productId?: string; description: string; quantity: number; unitPrice: string }>; currency: string; paymentTermDays?: number }) =>
      apiRequest("POST", `/api/customers/${customer.id}/invoices/manual`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customer.id, "invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setIsManualInvoiceOpen(false);
      setInvoiceLines([]);
      setSelectedPaymentTerm(null);
      toast({ title: "Invoice created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create invoice", variant: "destructive" });
    },
  });

  const createNoteMutation = useMutation({
    mutationFn: (content: string) =>
      apiRequest("POST", `/api/customers/${customer.id}/notes`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customer.id, "notes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customer.id, "activity-logs"] });
      setNewNoteContent("");
      toast({ title: "Note added successfully" });
    },
    onError: () => {
      toast({ title: "Failed to add note", variant: "destructive" });
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: (data: { subject: string; content: string }) =>
      apiRequest("POST", `/api/customers/${customer.id}/messages/email`, data),
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customer.id, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customer.id, "activity-logs"] });
      setEmailSubject("");
      setEmailContent("");
      const message = response.simulated 
        ? "Email queued (demo mode - configure SendGrid for actual delivery)" 
        : "Email sent successfully";
      toast({ title: message });
    },
    onError: () => {
      toast({ title: "Failed to send email", variant: "destructive" });
    },
  });

  const sendSmsMutation = useMutation({
    mutationFn: (data: { content: string }) =>
      apiRequest("POST", `/api/customers/${customer.id}/messages/sms`, data),
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customer.id, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customer.id, "activity-logs"] });
      setSmsContent("");
      const message = response.simulated 
        ? "SMS queued (demo mode - configure Twilio for actual delivery)" 
        : "SMS sent successfully";
      toast({ title: message });
    },
    onError: () => {
      toast({ title: "Failed to send SMS", variant: "destructive" });
    },
  });

  const handleAddNote = () => {
    if (!newNoteContent.trim()) return;
    createNoteMutation.mutate(newNoteContent.trim());
  };

  const handleSendEmail = () => {
    if (!emailSubject.trim() || !emailContent.trim()) {
      toast({ title: "Please enter subject and message", variant: "destructive" });
      return;
    }
    sendEmailMutation.mutate({ subject: emailSubject.trim(), content: emailContent.trim() });
  };

  const handleSendSms = () => {
    if (!smsContent.trim()) {
      toast({ title: "Please enter a message", variant: "destructive" });
      return;
    }
    sendSmsMutation.mutate({ content: smsContent.trim() });
  };

  const handleAddInvoiceLine = () => {
    const product = products.find(p => p.id === newLineProductId);
    if (!product) return;
    
    const qty = parseInt(newLineQty) || 1;
    const price = newLinePrice || product.price;
    
    setInvoiceLines([
      ...invoiceLines,
      {
        productId: product.id,
        productName: product.name,
        quantity: qty,
        unitPrice: price,
        currency: product.currency,
      },
    ]);
    
    setNewLineProductId("");
    setNewLineQty("1");
    setNewLinePrice("");
  };

  const handleRemoveInvoiceLine = (index: number) => {
    setInvoiceLines(invoiceLines.filter((_, i) => i !== index));
  };

  const handleCreateManualInvoice = () => {
    if (invoiceLines.length === 0) {
      toast({ title: "Please add at least one item", variant: "destructive" });
      return;
    }
    
    const paymentTerm = selectedPaymentTerm || billingDetails?.defaultPaymentTerm || 14;
    
    manualInvoiceMutation.mutate({
      items: invoiceLines.map(line => ({
        productId: line.productId,
        description: line.productName,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      })),
      currency: invoiceLines[0]?.currency || billingDetails?.currency || "EUR",
      paymentTermDays: paymentTerm,
    });
  };

  const availablePaymentTerms = billingDetails?.paymentTerms || [7, 14, 30];

  const calculateSubtotal = () => {
    return invoiceLines.reduce((sum, line) => {
      return sum + (parseFloat(line.unitPrice) * line.quantity);
    }, 0);
  };

  const vatRate = billingDetails ? parseFloat(billingDetails.vatRate) : 0;
  const subtotal = calculateSubtotal();
  const vatAmount = subtotal * (vatRate / 100);
  const totalAmount = subtotal + vatAmount;

  const handleDownloadPdf = async (invoiceId: string, invoiceNumber: string) => {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/pdf`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to download PDF");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({ title: "Invoice downloaded" });
    } catch {
      toast({ title: "Failed to download invoice", variant: "destructive" });
    }
  };

  // Filter products by active status and customer's country
  const activeProducts = products.filter(p => {
    if (!p.isActive) return false;
    // Show product if it has no countries assigned (global) or matches customer's country
    if (!p.countries || p.countries.length === 0) return true;
    return p.countries.includes(customer.country);
  });
  const assignedProductIds = customerProducts.map(cp => cp.productId);
  const availableProducts = activeProducts.filter(p => !assignedProductIds.includes(p.id));

  return (
    <div className="mt-6 space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold">
          {customer.firstName[0]}{customer.lastName[0]}
        </div>
        <div>
          <h3 className="text-xl font-semibold">
            {customer.firstName} {customer.lastName}
          </h3>
          <p className="text-muted-foreground">{customer.email}</p>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">{t.customers.fields.clientId}:</span>
              <span className="font-mono text-xs">{customer.id}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  navigator.clipboard.writeText(customer.id);
                  toast({ title: t.customers.fields.copiedToClipboard });
                }}
                data-testid="button-copy-detail-client-id"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            {customer.internalId && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">{t.customers.fields.internalId}:</span>
                <span className="font-mono text-xs">{customer.internalId}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    navigator.clipboard.writeText(customer.internalId || "");
                    toast({ title: t.customers.fields.copiedToClipboard });
                  }}
                  data-testid="button-copy-detail-internal-id"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{t.customers.details?.country || "Country"}</p>
            <p className="flex items-center gap-2 mt-1">
              <span>{getCountryFlag(customer.country)}</span>
              {getCountryName(customer.country)}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">{t.customers.details?.status || "Status"}</p>
            <div className="mt-1">
              <StatusBadge status={customer.status as any} />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">{t.customers.details?.phone || "Phone"}</p>
            <p className="mt-1">{customer.phone || "-"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">{t.customers.details?.serviceType || "Service Type"}</p>
            <p className="mt-1 capitalize">{customer.serviceType?.replace("_", " ") || "-"}</p>
          </div>
        </div>
      </div>

      <Separator />

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className={`grid w-full ${customer.clientStatus === "acquired" ? "grid-cols-5" : "grid-cols-4"}`}>
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Package className="h-4 w-4 mr-2" />
            {t.customers.tabs.overview}
          </TabsTrigger>
          {customer.clientStatus === "acquired" && (
            <TabsTrigger value="potential" data-testid="tab-potential">
              <Baby className="h-4 w-4 mr-2" />
              {t.customers.tabs.case}
            </TabsTrigger>
          )}
          <TabsTrigger value="communicate" data-testid="tab-communicate">
            <Mail className="h-4 w-4 mr-2" />
            {t.customers.tabs.contact}
          </TabsTrigger>
          <TabsTrigger value="notes" data-testid="tab-notes">
            <MessageSquare className="h-4 w-4 mr-2" />
            {t.customers.tabs.notes}
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <History className="h-4 w-4 mr-2" />
            {t.customers.tabs.activity}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold flex items-center gap-2">
                <Package className="h-4 w-4" />
                {t.customers.details?.assignedProducts || "Assigned Products"}
              </h4>
            </div>

            {productsLoading ? (
              <p className="text-sm text-muted-foreground">{t.customers.details?.loadingProducts || "Loading products..."}</p>
            ) : customerProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.customers.details?.noProducts || "No products assigned yet."}</p>
            ) : (
              <div className="space-y-2">
                {customerProducts.map((cp) => (
                  <div 
                    key={cp.id} 
                    className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">{cp.product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {cp.quantity} x {parseFloat(cp.priceOverride || cp.product.price).toFixed(2)} {cp.product.currency}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeProductMutation.mutate(cp.id)}
                      disabled={removeProductMutation.isPending}
                      data-testid={`button-remove-product-${cp.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {availableProducts.length > 0 && (
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label className="text-xs">{t.customers.details?.addProduct || "Add Product"}</Label>
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger data-testid="select-add-product">
                      <SelectValue placeholder={t.customers.details?.selectProduct || "Select product"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProducts.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} - {parseFloat(p.price).toFixed(2)} {p.currency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-20">
                  <Label className="text-xs">{t.customers.details?.quantity || "Qty"}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    data-testid="input-product-quantity"
                  />
                </div>
                <Button
                  size="icon"
                  onClick={() => {
                    const qty = parseInt(quantity) || 0;
                    if (selectedProductId && qty > 0) {
                      addProductMutation.mutate({ productId: selectedProductId, quantity: qty });
                    } else {
                      toast({ title: t.customers.details?.productValidation || "Please select a product and enter a valid quantity", variant: "destructive" });
                    }
                  }}
                  disabled={!selectedProductId || !quantity || parseInt(quantity) < 1 || addProductMutation.isPending}
                  data-testid="button-add-product-to-customer"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h4 className="font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {t.customers.details?.invoices || "Invoices"}
              </h4>
              <Button
                size="sm"
                onClick={() => setIsManualInvoiceOpen(true)}
                data-testid="button-create-invoice"
              >
                <Calculator className="h-4 w-4 mr-2" />
                {t.customers.details?.createInvoice || "Create Invoice"}
              </Button>
            </div>

            {invoicesLoading ? (
              <p className="text-sm text-muted-foreground">{t.customers.details?.loadingInvoices || "Loading invoices..."}</p>
            ) : customerInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.customers.details?.noInvoices || "No invoices generated yet."}</p>
            ) : (
              <div className="space-y-2">
                {customerInvoices.map((inv) => (
                  <div 
                    key={inv.id} 
                    className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                  >
                    <div>
                      <p className="font-medium text-sm">{inv.invoiceNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(inv.generatedAt), "MMM dd, yyyy")} - {parseFloat(inv.totalAmount).toFixed(2)} {inv.currency}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDownloadPdf(inv.id, inv.invoiceNumber)}
                      data-testid={`button-download-invoice-${inv.id}`}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {customer.clientStatus === "acquired" && (
          <TabsContent value="potential" className="mt-4">
            <EmbeddedPotentialCaseForm customer={customer} />
          </TabsContent>
        )}

        <TabsContent value="communicate" className="space-y-6 mt-4">
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Mail className="h-4 w-4" />
              {t.customers.details?.sendEmail || "Send Email"}
            </h4>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">{t.customers.details?.to || "To"}</Label>
                <Input value={customer.email} disabled className="bg-muted" data-testid="input-email-to" />
              </div>
              <div>
                <Label className="text-xs">{t.customers.details?.subject || "Subject"}</Label>
                <Input
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder={t.customers.details?.emailSubjectPlaceholder || "Email subject..."}
                  data-testid="input-email-subject"
                />
              </div>
              <div>
                <Label className="text-xs">{t.customers.details?.message || "Message"}</Label>
                <Textarea
                  value={emailContent}
                  onChange={(e) => setEmailContent(e.target.value)}
                  placeholder={t.customers.details?.writeEmailPlaceholder || "Write your email message..."}
                  className="min-h-[100px]"
                  data-testid="input-email-content"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleSendEmail}
                  disabled={!emailSubject.trim() || !emailContent.trim() || sendEmailMutation.isPending}
                  data-testid="button-send-email"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {sendEmailMutation.isPending ? (t.customers.details?.sending || "Sending...") : (t.customers.details?.sendEmail || "Send Email")}
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Phone className="h-4 w-4" />
              {t.customers.details?.sendSms || "Send SMS"}
            </h4>
            {customer.phone ? (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">{t.customers.details?.to || "To"}</Label>
                  <Input value={customer.phone} disabled className="bg-muted" data-testid="input-sms-to" />
                </div>
                <div>
                  <Label className="text-xs">{t.customers.details?.message || "Message"}</Label>
                  <Textarea
                    value={smsContent}
                    onChange={(e) => setSmsContent(e.target.value)}
                    placeholder={t.customers.details?.writeSmsPlaceholder || "Write your SMS message..."}
                    className="min-h-[80px]"
                    maxLength={160}
                    data-testid="input-sms-content"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{smsContent.length}/160 {t.customers.details?.characters || "characters"}</p>
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={handleSendSms}
                    disabled={!smsContent.trim() || sendSmsMutation.isPending}
                    data-testid="button-send-sms"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {sendSmsMutation.isPending ? (t.customers.details?.sending || "Sending...") : (t.customers.details?.sendSms || "Send SMS")}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t.customers.details?.noPhone || "No phone number on file for this customer."}</p>
            )}
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="font-semibold">{t.customers.details?.messageHistory || "Message History"}</h4>
            {messagesLoading ? (
              <p className="text-sm text-muted-foreground">{t.customers.details?.loadingMessages || "Loading messages..."}</p>
            ) : communicationMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.customers.details?.noMessages || "No messages sent yet."}</p>
            ) : (
              <div className="space-y-3">
                {communicationMessages.map((msg) => (
                  <div key={msg.id} className="p-3 rounded-lg bg-muted/50 space-y-1" data-testid={`message-item-${msg.id}`}>
                    <div className="flex items-center gap-2">
                      {msg.type === "email" ? (
                        <Mail className="h-4 w-4 text-primary" />
                      ) : (
                        <Phone className="h-4 w-4 text-primary" />
                      )}
                      <span className="text-sm font-medium capitalize" data-testid={`message-type-${msg.id}`}>{msg.type}</span>
                      <Badge variant={msg.status === "sent" ? "default" : msg.status === "failed" ? "destructive" : "secondary"} className="text-xs" data-testid={`message-status-${msg.id}`}>
                        {msg.status}
                      </Badge>
                    </div>
                    {msg.subject && <p className="text-sm font-medium" data-testid={`message-subject-${msg.id}`}>{msg.subject}</p>}
                    <p className="text-sm text-muted-foreground line-clamp-2" data-testid={`message-content-${msg.id}`}>{msg.content}</p>
                    <p className="text-xs text-muted-foreground" data-testid={`message-date-${msg.id}`}>
                      {format(new Date(msg.createdAt), "MMM dd, yyyy HH:mm")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="notes" className="space-y-4 mt-4">
          <div className="space-y-4">
            <div className="flex gap-2">
              <Textarea
                placeholder={t.customers.details?.addNotePlaceholder || "Add a note about this customer..."}
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                className="min-h-[80px]"
                data-testid="input-customer-note"
              />
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleAddNote}
                disabled={!newNoteContent.trim() || createNoteMutation.isPending}
                data-testid="button-add-note"
              >
                <Send className="h-4 w-4 mr-2" />
                {createNoteMutation.isPending ? (t.customers.details?.adding || "Adding...") : (t.customers.details?.addNote || "Add Note")}
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            {notesLoading ? (
              <p className="text-sm text-muted-foreground">{t.customers.details?.loadingNotes || "Loading notes..."}</p>
            ) : customerNotes.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.customers.details?.noNotes || "No notes yet."}</p>
            ) : (
              customerNotes.map((note) => (
                <div key={note.id} className="p-3 rounded-lg bg-muted/50 space-y-1">
                  <p className="text-sm">{note.content}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(note.createdAt), "MMM dd, yyyy HH:mm")}
                  </p>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4 mt-4">
          <div className="space-y-3">
            {activityLoading ? (
              <p className="text-sm text-muted-foreground">{t.common?.loading || "Loading activity..."}</p>
            ) : activityLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.activity?.noActivity || "No activity recorded yet."}</p>
            ) : (
              activityLogs.map((log) => {
                const details = parseDetails(log.details);
                return (
                  <div key={log.id} className="border rounded-lg p-4 bg-card" data-testid={`activity-log-${log.id}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5 p-2 rounded-full bg-muted">
                        {getActionIcon(log.action)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {getActionLabel(log.action)}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {log.entityType || "customer"}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <UserCircle className="h-3.5 w-3.5" />
                            <span>{getUserName(log.userId)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{format(new Date(log.createdAt), "dd.MM.yyyy HH:mm:ss")}</span>
                          </div>
                        </div>
                        
                        {renderFieldChanges(details, log.action)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Separator />

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={onEdit}
          data-testid="button-edit-from-view"
        >
          <Pencil className="h-4 w-4 mr-2" />
          {t.customers.details?.editCustomer || "Edit Customer"}
        </Button>
      </div>

      <Dialog open={isManualInvoiceOpen} onOpenChange={setIsManualInvoiceOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.customers.details?.createInvoice || "Create Invoice"}</DialogTitle>
            <DialogDescription>
              {t.customers.details?.selectProductsFor || "Select products and specify amounts for"} {customer.firstName} {customer.lastName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {billingCompanies.length > 0 && (
              <div className="space-y-2">
                <Label>{t.customers.details?.billingCompany || "Billing Company"}</Label>
                <Select
                  value={selectedBillingCompanyId || billingDetails?.id || ""}
                  onValueChange={setSelectedBillingCompanyId}
                >
                  <SelectTrigger data-testid="select-billing-company">
                    <SelectValue placeholder={t.customers.details?.selectBillingCompany || "Select billing company"} />
                  </SelectTrigger>
                  <SelectContent>
                    {billingCompanies.map((bc) => (
                      <SelectItem key={bc.id} value={bc.id}>
                        {bc.companyName} {bc.isDefault && "(Default)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {billingDetails && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm font-medium">{billingDetails.companyName}</p>
                    <p className="text-xs text-muted-foreground">
                      {billingDetails.address}, {billingDetails.city}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.customers.details?.vatLabel || "VAT"}: {billingDetails.vatRate}% | {t.customers.details?.currencyLabel || "Currency"}: {billingDetails.currency}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-4">
              <h4 className="font-medium">Invoice Items</h4>
              
              {invoiceLines.length === 0 ? (
                <p className="text-sm text-muted-foreground">No items added yet.</p>
              ) : (
                <div className="space-y-2">
                  {invoiceLines.map((line, index) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between p-2 rounded-md bg-muted/50 gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{line.productName}</p>
                        <p className="text-xs text-muted-foreground">
                          {line.quantity} x {parseFloat(line.unitPrice).toFixed(2)} {line.currency} = {(line.quantity * parseFloat(line.unitPrice)).toFixed(2)} {line.currency}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveInvoiceLine(index)}
                        data-testid={`button-remove-line-${index}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-2 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-xs">{t.customers.details?.product || "Product"}</Label>
                  <Select value={newLineProductId} onValueChange={(val) => {
                    setNewLineProductId(val);
                    const prod = activeProducts.find(p => p.id === val);
                    if (prod) setNewLinePrice(prod.price);
                  }}>
                    <SelectTrigger data-testid="select-invoice-product">
                      <SelectValue placeholder={t.customers.details?.selectProduct || "Select product"} />
                    </SelectTrigger>
                    <SelectContent>
                      {activeProducts.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} - {parseFloat(p.price).toFixed(2)} {p.currency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-20">
                  <Label className="text-xs">{t.customers.details?.quantity || "Qty"}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={newLineQty}
                    onChange={(e) => setNewLineQty(e.target.value)}
                    data-testid="input-invoice-qty"
                  />
                </div>
                <div className="w-28">
                  <Label className="text-xs">{t.customers.details?.unitPrice || "Unit Price"}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={newLinePrice}
                    onChange={(e) => setNewLinePrice(e.target.value)}
                    placeholder="Amount"
                    data-testid="input-invoice-price"
                  />
                </div>
                <Button
                  size="icon"
                  onClick={handleAddInvoiceLine}
                  disabled={!newLineProductId || !newLinePrice || parseFloat(newLinePrice) <= 0}
                  data-testid="button-add-invoice-line"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {invoiceLines.length > 0 && (
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{subtotal.toFixed(2)} {invoiceLines[0]?.currency}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{t.customers.details?.vatLabel || "VAT"} ({vatRate}%)</span>
                  <span>{vatAmount.toFixed(2)} {invoiceLines[0]?.currency}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg">
                  <span>{t.customers.details?.total || "Total"}</span>
                  <span>{totalAmount.toFixed(2)} {invoiceLines[0]?.currency}</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>{t.customers.details?.paymentTerm || "Payment Term"}</Label>
              <Select
                value={(selectedPaymentTerm || billingDetails?.defaultPaymentTerm || 14).toString()}
                onValueChange={(val) => setSelectedPaymentTerm(parseInt(val))}
              >
                <SelectTrigger data-testid="select-payment-term">
                  <SelectValue placeholder={t.customers.details?.selectPaymentTerm || "Select payment term"} />
                </SelectTrigger>
                <SelectContent>
                  {availablePaymentTerms.map((days) => (
                    <SelectItem key={days} value={days.toString()}>
                      {days} {t.common?.days || "days"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsManualInvoiceOpen(false);
                  setInvoiceLines([]);
                }}
                data-testid="button-cancel-invoice"
              >
                {t.common?.cancel || "Cancel"}
              </Button>
              <Button
                onClick={handleCreateManualInvoice}
                disabled={invoiceLines.length === 0 || manualInvoiceMutation.isPending}
                data-testid="button-submit-invoice"
              >
                {manualInvoiceMutation.isPending ? (t.customers.details?.generating || "Generating...") : (t.customers.details?.generate || "Generate Invoice")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CustomersPage() {
  const { toast } = useToast();
  const { t } = useI18n();
  const { selectedCountries, availableCountries } = useCountryFilter();
  const { canAdd, canEdit } = usePermissions();
  const [search, setSearch] = useState("");
  const [phoneFilter, setPhoneFilter] = useState("");
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>("_all");
  const [statusFilter, setStatusFilter] = useState<string>("_all");
  const [clientStatusFilter, setClientStatusFilter] = useState<string>("_all");
  const [countryFilter, setCountryFilter] = useState<string>("_all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [useWizardForm, setUseWizardForm] = useState(true);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [potentialCaseCustomer, setPotentialCaseCustomer] = useState<Customer | null>(null);

  const { data: allCustomers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const customers = allCustomers.filter(c => 
    selectedCountries.includes(c.country as any)
  );

  // Keep viewingCustomer in sync with latest data from query
  useEffect(() => {
    if (viewingCustomer) {
      const updated = allCustomers.find(c => c.id === viewingCustomer.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(viewingCustomer)) {
        setViewingCustomer(updated);
      }
    }
  }, [allCustomers, viewingCustomer]);

  const createMutation = useMutation({
    mutationFn: (data: CustomerFormData) => {
      const serializedData = {
        ...data,
        dateOfBirth: data.dateOfBirth ? data.dateOfBirth.toISOString() : null,
      };
      return apiRequest("POST", "/api/customers", serializedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setIsFormOpen(false);
      toast({ title: "Customer created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create customer", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: CustomerFormData & { id: string }) => {
      const serializedData = {
        ...data,
        dateOfBirth: data.dateOfBirth ? data.dateOfBirth.toISOString() : null,
      };
      return apiRequest("PATCH", `/api/customers/${serializedData.id}`, serializedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setEditingCustomer(null);
      toast({ title: "Customer updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update customer", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/customers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setDeletingCustomer(null);
      toast({ title: "Customer deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete customer", variant: "destructive" });
    },
  });

  const filteredCustomers = customers.filter(customer => {
    // Search filter - search across all text fields
    const searchLower = search.toLowerCase();
    const matchesSearch = search === "" || 
      customer.id.toLowerCase().includes(searchLower) ||
      (customer.internalId && customer.internalId.toLowerCase().includes(searchLower)) ||
      customer.firstName.toLowerCase().includes(searchLower) ||
      customer.lastName.toLowerCase().includes(searchLower) ||
      (customer.maidenName && customer.maidenName.toLowerCase().includes(searchLower)) ||
      customer.email.toLowerCase().includes(searchLower) ||
      (customer.email2 && customer.email2.toLowerCase().includes(searchLower)) ||
      (customer.phone && customer.phone.toLowerCase().includes(searchLower)) ||
      (customer.mobile && customer.mobile.toLowerCase().includes(searchLower)) ||
      (customer.mobile2 && customer.mobile2.toLowerCase().includes(searchLower)) ||
      (customer.nationalId && customer.nationalId.toLowerCase().includes(searchLower)) ||
      (customer.idCardNumber && customer.idCardNumber.toLowerCase().includes(searchLower)) ||
      (customer.city && customer.city.toLowerCase().includes(searchLower)) ||
      (customer.address && customer.address.toLowerCase().includes(searchLower)) ||
      (customer.postalCode && customer.postalCode.toLowerCase().includes(searchLower)) ||
      (customer.region && customer.region.toLowerCase().includes(searchLower)) ||
      (customer.bankAccount && customer.bankAccount.toLowerCase().includes(searchLower)) ||
      (customer.notes && customer.notes.toLowerCase().includes(searchLower));
    
    // Phone filter
    const matchesPhone = phoneFilter === "" || 
      (customer.phone && customer.phone.toLowerCase().includes(phoneFilter.toLowerCase()));
    
    // Country filter
    const matchesCountry = countryFilter === "_all" || customer.country === countryFilter;
    
    // Service type filter
    const matchesServiceType = serviceTypeFilter === "_all" || customer.serviceType === serviceTypeFilter;
    
    // Status filter
    const matchesStatus = statusFilter === "_all" || customer.status === statusFilter;
    
    // Client status filter
    const matchesClientStatus = clientStatusFilter === "_all" || customer.clientStatus === clientStatusFilter;
    
    return matchesSearch && matchesPhone && matchesCountry && matchesServiceType && matchesStatus && matchesClientStatus;
  });

  const columns = [
    {
      key: "customer",
      header: "Customer",
      cell: (customer: Customer) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
            {customer.firstName[0]}{customer.lastName[0]}
          </div>
          <div>
            <p className="font-medium">{customer.firstName} {customer.lastName}</p>
            <p className="text-sm text-muted-foreground">{customer.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "country",
      header: "Country",
      cell: (customer: Customer) => (
        <span className="flex items-center gap-2">
          <span className="text-lg">{getCountryFlag(customer.country)}</span>
          <span>{getCountryName(customer.country)}</span>
        </span>
      ),
    },
    {
      key: "service",
      header: "Service Type",
      cell: (customer: Customer) => (
        <Badge variant="outline" className="capitalize">
          {customer.serviceType?.replace("_", " ") || "Not specified"}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (customer: Customer) => (
        <StatusBadge status={customer.status as any} />
      ),
    },
    {
      key: "clientStatus",
      header: t.customers.clientStatus,
      cell: (customer: Customer) => {
        const statusColors: Record<string, string> = {
          potential: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
          acquired: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
          terminated: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
        };
        const statusLabels: Record<string, string> = {
          potential: t.customers.clientStatuses?.potential || "Potential",
          acquired: t.customers.clientStatuses?.acquired || "Acquired",
          terminated: t.customers.clientStatuses?.terminated || "Terminated",
        };
        return (
          <Badge className={statusColors[customer.clientStatus] || statusColors.potential}>
            {statusLabels[customer.clientStatus] || customer.clientStatus}
          </Badge>
        );
      },
    },
    {
      key: "leadScore",
      header: t.leadScoring?.title || "Lead Score",
      cell: (customer: Customer) => {
        if (customer.clientStatus !== "potential") {
          return <span className="text-muted-foreground">-</span>;
        }
        const score = customer.leadScore || 0;
        const status = customer.leadStatus || "cold";
        const statusColors: Record<string, string> = {
          cold: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
          warm: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
          hot: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
          qualified: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
        };
        const statusLabels: Record<string, string> = {
          cold: t.leadScoring?.statuses?.cold || "Cold",
          warm: t.leadScoring?.statuses?.warm || "Warm",
          hot: t.leadScoring?.statuses?.hot || "Hot",
          qualified: t.leadScoring?.statuses?.qualified || "Qualified",
        };
        return (
          <div className="flex items-center gap-2">
            <div className="w-12 bg-muted rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  score >= 75 ? "bg-green-500" :
                  score >= 50 ? "bg-orange-500" :
                  score >= 25 ? "bg-yellow-500" :
                  "bg-slate-400"
                }`}
                style={{ width: `${score}%` }}
              />
            </div>
            <span className="text-sm font-medium w-8">{score}</span>
            <Badge variant="secondary" className={statusColors[status]}>
              {statusLabels[status]}
            </Badge>
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (customer: Customer) => (
        <div className="flex items-center justify-end gap-1">
          {customer.clientStatus === "potential" && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                setPotentialCaseCustomer(customer);
              }}
              title={t.potentialCase?.title || "Potential Case"}
              data-testid={`button-potential-case-${customer.id}`}
            >
              <Baby className="h-4 w-4 text-blue-500" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setViewingCustomer(customer);
            }}
            data-testid={`button-view-customer-${customer.id}`}
          >
            <Eye className="h-4 w-4" />
          </Button>
          {canEdit("customers") && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                setEditingCustomer(customer);
              }}
              data-testid={`button-edit-customer-${customer.id}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {canEdit("customers") && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                setDeletingCustomer(customer);
              }}
              data-testid={`button-delete-customer-${customer.id}`}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.customers.title}
        description={t.customers.description}
      >
        {canAdd("customers") && (
          <Button onClick={() => setIsFormOpen(true)} data-testid="button-add-customer">
            <Plus className="h-4 w-4 mr-2" />
            {t.customers.addCustomer}
          </Button>
        )}
      </PageHeader>

      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t.customers.searchPlaceholder}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-customers"
                />
              </div>
              <div className="relative min-w-[150px]">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t.customers.phone || "Phone"}
                  value={phoneFilter}
                  onChange={(e) => setPhoneFilter(e.target.value)}
                  className="pl-9"
                  data-testid="input-filter-phone"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="min-w-[150px]">
                <Select value={countryFilter} onValueChange={setCountryFilter}>
                  <SelectTrigger data-testid="select-filter-country">
                    <SelectValue placeholder={t.customers.country || "Country"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All Countries</SelectItem>
                    {availableCountries.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        <span className="flex items-center gap-2">
                          <span>{country.flag}</span>
                          <span>{country.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[150px]">
                <Select value={serviceTypeFilter} onValueChange={setServiceTypeFilter}>
                  <SelectTrigger data-testid="select-filter-service-type">
                    <SelectValue placeholder={t.customers.serviceType || "Service Type"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All Service Types</SelectItem>
                    <SelectItem value="cord_blood">{t.customers.serviceTypes?.cordBlood || "Cord Blood"}</SelectItem>
                    <SelectItem value="cord_tissue">{t.customers.serviceTypes?.cordTissue || "Cord Tissue"}</SelectItem>
                    <SelectItem value="both">{t.customers.serviceTypes?.both || "Both"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[150px]">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger data-testid="select-filter-status">
                    <SelectValue placeholder={t.customers.status || "Status"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All Statuses</SelectItem>
                    <SelectItem value="active">{t.common.active || "Active"}</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="inactive">{t.common.inactive || "Inactive"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[150px]">
                <Select value={clientStatusFilter} onValueChange={setClientStatusFilter}>
                  <SelectTrigger data-testid="select-filter-client-status">
                    <SelectValue placeholder={t.customers.clientStatus || "Client Status"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All Client Statuses</SelectItem>
                    <SelectItem value="potential">{t.customers.clientStatuses?.potential || "Potential"}</SelectItem>
                    <SelectItem value="acquired">{t.customers.clientStatuses?.acquired || "Acquired"}</SelectItem>
                    <SelectItem value="terminated">{t.customers.clientStatuses?.terminated || "Terminated"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <AdvancedFilters
                module="customers"
                filters={{
                  country: countryFilter !== "_all" ? countryFilter : undefined,
                  status: clientStatusFilter !== "_all" ? clientStatusFilter : undefined,
                  serviceType: serviceTypeFilter !== "_all" ? serviceTypeFilter : undefined,
                }}
                onFiltersChange={(newFilters: CustomerFilters) => {
                  setCountryFilter(newFilters.country || "_all");
                  setClientStatusFilter(newFilters.status || "_all");
                  setServiceTypeFilter(newFilters.serviceType === "cordBlood" ? "cord_blood" : 
                                       newFilters.serviceType === "cordTissue" ? "cord_tissue" : 
                                       newFilters.serviceType || "_all");
                }}
                onClear={() => {
                  setCountryFilter("_all");
                  setServiceTypeFilter("_all");
                  setStatusFilter("_all");
                  setClientStatusFilter("_all");
                  setPhoneFilter("");
                  setSearch("");
                }}
              />
              <div className="ml-auto text-sm text-muted-foreground">
                {filteredCustomers.length} / {allCustomers.length}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={filteredCustomers}
        isLoading={isLoading}
        emptyMessage={t.customers.noCustomers}
        getRowKey={(c) => c.id}
      />

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className={useWizardForm ? "max-w-4xl max-h-[90vh] overflow-y-auto" : "max-w-2xl max-h-[90vh] overflow-y-auto"}>
          <DialogHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <DialogTitle>{t.customers.addCustomer}</DialogTitle>
                <DialogDescription>
                  {t.customers.description}
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={useWizardForm ? "default" : "outline"}
                  size="sm"
                  onClick={() => setUseWizardForm(true)}
                  data-testid="button-wizard-mode"
                >
                  <ListChecks className="h-4 w-4 mr-1" />
                  {t.wizard?.steps?.review ? t.wizard.steps.review.split(' ')[0] : "Wizard"}
                </Button>
                <Button
                  variant={!useWizardForm ? "default" : "outline"}
                  size="sm"
                  onClick={() => setUseWizardForm(false)}
                  data-testid="button-simple-mode"
                >
                  <FileEdit className="h-4 w-4 mr-1" />
                  {t.common?.form || "Form"}
                </Button>
              </div>
            </div>
          </DialogHeader>
          {useWizardForm ? (
            <CustomerFormWizard
              onSubmit={(data) => createMutation.mutate(data as CustomerFormData)}
              isLoading={createMutation.isPending}
              onCancel={() => setIsFormOpen(false)}
            />
          ) : (
            <CustomerForm
              onSubmit={(data) => createMutation.mutate(data)}
              isLoading={createMutation.isPending}
              onCancel={() => setIsFormOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingCustomer} onOpenChange={() => setEditingCustomer(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
            <DialogDescription>
              Update customer information.
            </DialogDescription>
          </DialogHeader>
          {editingCustomer && (
            <CustomerForm
              initialData={editingCustomer}
              onSubmit={(data) => updateMutation.mutate({ ...data, id: editingCustomer.id })}
              isLoading={updateMutation.isPending}
              onCancel={() => setEditingCustomer(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Sheet open={!!viewingCustomer} onOpenChange={() => setViewingCustomer(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t.customers.detailsTitle}</SheetTitle>
            <SheetDescription>
              {t.customers.detailsDescription}
            </SheetDescription>
          </SheetHeader>
          {viewingCustomer && (
            <CustomerDetailsContent 
              customer={viewingCustomer} 
              onEdit={() => {
                setViewingCustomer(null);
                setEditingCustomer(viewingCustomer);
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deletingCustomer} onOpenChange={() => setDeletingCustomer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deletingCustomer?.firstName} {deletingCustomer?.lastName}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-customer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCustomer && deleteMutation.mutate(deletingCustomer.id)}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete-customer"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {potentialCaseCustomer && (
        <PotentialCaseForm
          customer={potentialCaseCustomer}
          open={!!potentialCaseCustomer}
          onClose={() => setPotentialCaseCustomer(null)}
        />
      )}
    </div>
  );
}
