import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Search, Eye, Package, FileText, Download, Calculator, MessageSquare, History, Send, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { CustomerForm, type CustomerFormData } from "@/components/customer-form";
import { useCountryFilter } from "@/contexts/country-filter-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getCountryFlag, getCountryName } from "@/lib/countries";
import type { Customer, Product, CustomerProduct, Invoice, BillingDetails, CustomerNote, ActivityLog, CommunicationMessage } from "@shared/schema";
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

  const { data: billingDetails } = useQuery<BillingDetails | null>({
    queryKey: ["/api/billing-details", customer.country],
    queryFn: async () => {
      const res = await fetch(`/api/billing-details/${customer.country}`, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch billing details");
      return res.json();
    },
  });

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

  const activeProducts = products.filter(p => p.isActive);
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
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Country</p>
            <p className="flex items-center gap-2 mt-1">
              <span>{getCountryFlag(customer.country)}</span>
              {getCountryName(customer.country)}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Status</p>
            <div className="mt-1">
              <StatusBadge status={customer.status as any} />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Phone</p>
            <p className="mt-1">{customer.phone || "-"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Service Type</p>
            <p className="mt-1 capitalize">{customer.serviceType?.replace("_", " ") || "-"}</p>
          </div>
        </div>
      </div>

      <Separator />

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Package className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="communicate" data-testid="tab-communicate">
            <Mail className="h-4 w-4 mr-2" />
            Contact
          </TabsTrigger>
          <TabsTrigger value="notes" data-testid="tab-notes">
            <MessageSquare className="h-4 w-4 mr-2" />
            Notes
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <History className="h-4 w-4 mr-2" />
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold flex items-center gap-2">
                <Package className="h-4 w-4" />
                Assigned Products
              </h4>
            </div>

            {productsLoading ? (
              <p className="text-sm text-muted-foreground">Loading products...</p>
            ) : customerProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No products assigned yet.</p>
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
                  <Label className="text-xs">Add Product</Label>
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger data-testid="select-add-product">
                      <SelectValue placeholder="Select product" />
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
                  <Label className="text-xs">Qty</Label>
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
                      toast({ title: "Please select a product and enter a valid quantity", variant: "destructive" });
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
                Invoices
              </h4>
              <Button
                size="sm"
                onClick={() => setIsManualInvoiceOpen(true)}
                data-testid="button-create-invoice"
              >
                <Calculator className="h-4 w-4 mr-2" />
                Create Invoice
              </Button>
            </div>

            {invoicesLoading ? (
              <p className="text-sm text-muted-foreground">Loading invoices...</p>
            ) : customerInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invoices generated yet.</p>
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

        <TabsContent value="communicate" className="space-y-6 mt-4">
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Send Email
            </h4>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">To</Label>
                <Input value={customer.email} disabled className="bg-muted" data-testid="input-email-to" />
              </div>
              <div>
                <Label className="text-xs">Subject</Label>
                <Input
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Email subject..."
                  data-testid="input-email-subject"
                />
              </div>
              <div>
                <Label className="text-xs">Message</Label>
                <Textarea
                  value={emailContent}
                  onChange={(e) => setEmailContent(e.target.value)}
                  placeholder="Write your email message..."
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
                  {sendEmailMutation.isPending ? "Sending..." : "Send Email"}
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Send SMS
            </h4>
            {customer.phone ? (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">To</Label>
                  <Input value={customer.phone} disabled className="bg-muted" data-testid="input-sms-to" />
                </div>
                <div>
                  <Label className="text-xs">Message</Label>
                  <Textarea
                    value={smsContent}
                    onChange={(e) => setSmsContent(e.target.value)}
                    placeholder="Write your SMS message..."
                    className="min-h-[80px]"
                    maxLength={160}
                    data-testid="input-sms-content"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{smsContent.length}/160 characters</p>
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={handleSendSms}
                    disabled={!smsContent.trim() || sendSmsMutation.isPending}
                    data-testid="button-send-sms"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {sendSmsMutation.isPending ? "Sending..." : "Send SMS"}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No phone number on file for this customer.</p>
            )}
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="font-semibold">Message History</h4>
            {messagesLoading ? (
              <p className="text-sm text-muted-foreground">Loading messages...</p>
            ) : communicationMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No messages sent yet.</p>
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
                placeholder="Add a note about this customer..."
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
                {createNoteMutation.isPending ? "Adding..." : "Add Note"}
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            {notesLoading ? (
              <p className="text-sm text-muted-foreground">Loading notes...</p>
            ) : customerNotes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notes yet.</p>
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
              <p className="text-sm text-muted-foreground">Loading activity...</p>
            ) : activityLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
            ) : (
              activityLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-primary" />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium capitalize">
                      {log.action.replace("_", " ")}
                    </p>
                    {log.details && (
                      <p className="text-xs text-muted-foreground">
                        {JSON.parse(log.details).changes?.join(", ") || log.details}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(log.createdAt), "MMM dd, yyyy HH:mm")}
                    </p>
                  </div>
                </div>
              ))
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
          Edit Customer
        </Button>
      </div>

      <Dialog open={isManualInvoiceOpen} onOpenChange={setIsManualInvoiceOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Invoice</DialogTitle>
            <DialogDescription>
              Select products and specify amounts for {customer.firstName} {customer.lastName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {billingDetails && (
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm font-medium">{billingDetails.companyName}</p>
                <p className="text-xs text-muted-foreground">
                  {billingDetails.address}, {billingDetails.city}
                </p>
                <p className="text-xs text-muted-foreground">
                  VAT: {billingDetails.vatRate}% | Currency: {billingDetails.currency}
                </p>
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
                  <Label className="text-xs">Product</Label>
                  <Select value={newLineProductId} onValueChange={(val) => {
                    setNewLineProductId(val);
                    const prod = products.find(p => p.id === val);
                    if (prod) setNewLinePrice(prod.price);
                  }}>
                    <SelectTrigger data-testid="select-invoice-product">
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.filter(p => p.isActive).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} - {parseFloat(p.price).toFixed(2)} {p.currency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-20">
                  <Label className="text-xs">Qty</Label>
                  <Input
                    type="number"
                    min={1}
                    value={newLineQty}
                    onChange={(e) => setNewLineQty(e.target.value)}
                    data-testid="input-invoice-qty"
                  />
                </div>
                <div className="w-28">
                  <Label className="text-xs">Unit Price</Label>
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
                  <span>VAT ({vatRate}%)</span>
                  <span>{vatAmount.toFixed(2)} {invoiceLines[0]?.currency}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span>{totalAmount.toFixed(2)} {invoiceLines[0]?.currency}</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Payment Term</Label>
              <Select
                value={(selectedPaymentTerm || billingDetails?.defaultPaymentTerm || 14).toString()}
                onValueChange={(val) => setSelectedPaymentTerm(parseInt(val))}
              >
                <SelectTrigger data-testid="select-payment-term">
                  <SelectValue placeholder="Select payment term" />
                </SelectTrigger>
                <SelectContent>
                  {availablePaymentTerms.map((days) => (
                    <SelectItem key={days} value={days.toString()}>
                      {days} days
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Due date will be calculated from invoice date
              </p>
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
                Cancel
              </Button>
              <Button
                onClick={handleCreateManualInvoice}
                disabled={invoiceLines.length === 0 || manualInvoiceMutation.isPending}
                data-testid="button-submit-invoice"
              >
                {manualInvoiceMutation.isPending ? "Creating..." : "Create Invoice"}
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
  const { selectedCountries } = useCountryFilter();
  const [search, setSearch] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);

  const { data: allCustomers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const customers = allCustomers.filter(c => 
    selectedCountries.includes(c.country as any)
  );

  const createMutation = useMutation({
    mutationFn: (data: CustomerFormData) => apiRequest("POST", "/api/customers", data),
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
    mutationFn: (data: CustomerFormData & { id: string }) =>
      apiRequest("PATCH", `/api/customers/${data.id}`, data),
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

  const filteredCustomers = customers.filter(customer =>
    customer.firstName.toLowerCase().includes(search.toLowerCase()) ||
    customer.lastName.toLowerCase().includes(search.toLowerCase()) ||
    customer.email.toLowerCase().includes(search.toLowerCase())
  );

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
      key: "phone",
      header: "Phone",
      cell: (customer: Customer) => (
        <span className="text-sm">{customer.phone || "-"}</span>
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
      key: "actions",
      header: "",
      className: "text-right",
      cell: (customer: Customer) => (
        <div className="flex items-center justify-end gap-1">
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
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Manage cord blood banking customers"
      >
        <Button onClick={() => setIsFormOpen(true)} data-testid="button-add-customer">
          <Plus className="h-4 w-4 mr-2" />
          Add Customer
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-customers"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              Showing {filteredCustomers.length} of {allCustomers.length} customers
            </div>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={filteredCustomers}
        isLoading={isLoading}
        emptyMessage="No customers found for selected countries"
        getRowKey={(c) => c.id}
      />

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
            <DialogDescription>
              Add a new cord blood banking customer to the system.
            </DialogDescription>
          </DialogHeader>
          <CustomerForm
            onSubmit={(data) => createMutation.mutate(data)}
            isLoading={createMutation.isPending}
            onCancel={() => setIsFormOpen(false)}
          />
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
            <SheetTitle>Customer Details</SheetTitle>
            <SheetDescription>
              View customer information, products, and invoices
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
    </div>
  );
}
