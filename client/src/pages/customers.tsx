import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Search, Eye, Package, FileText, Download, Calculator, MessageSquare, History, Send, Mail, MailOpen, Phone, PhoneCall, PhoneOutgoing, PhoneIncoming, Baby, Copy, ListChecks, FileEdit, UserCircle, Clock, PlusCircle, RefreshCw, XCircle, LogIn, LogOut, AlertCircle, CheckCircle2, ArrowRight, Shield, CreditCard, Loader2, Calendar, Globe, Linkedin, Facebook, Twitter, Instagram, Building2, ExternalLink, Sparkles, FileSignature, Receipt, Target, ArrowDownLeft, ArrowUpRight, PenSquare, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, FileSpreadsheet, Filter, X } from "lucide-react";
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
  DialogTrigger,
  DialogFooter,
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
import { CallCustomerButton } from "@/components/sip-phone";
import { useCountryFilter } from "@/contexts/country-filter-context";
import { usePermissions } from "@/contexts/permissions-context";
import { useAuth } from "@/contexts/auth-context";

interface AvailableMailbox {
  id: string | null;
  email: string;
  displayName: string;
  type: "personal" | "shared";
  isDefault: boolean;
}
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getCountryFlag, getCountryName } from "@/lib/countries";
import type { Customer, Product, CustomerProduct, Invoice, BillingDetails, CustomerNote, ActivityLog, CommunicationMessage, CustomerPotentialCase, MarketProductInstance, CustomerEmailNotification } from "@shared/schema";
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
import { sk, cs, hu, ro, it, de, enUS } from "date-fns/locale";

type CustomerProductWithProduct = CustomerProduct & { product: Product; billsetName?: string };

interface InvoiceLineItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  currency: string;
}

interface CustomerConsent {
  id: string;
  customerId: string;
  consentType: string;
  granted: boolean;
  grantedAt: string | null;
  grantedByUserId: string | null;
  revokedAt: string | null;
  revokedByUserId: string | null;
  revokeReason: string | null;
  legalBasis: string;
  purpose: string | null;
  source: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

interface CustomerDocument {
  id: string;
  type: "contract" | "invoice";
  number: string;
  status: string;
  createdAt: string;
  createdBy: string | null;
  createdByName: string | null;
  pdfPath: string | null;
  totalAmount: string | null;
  currency: string;
  validFrom?: string | null;
  validTo?: string | null;
  dueDate?: string | null;
  cancellationReason?: string | null;
}

const CONSENT_TYPE_VALUES = [
  "marketing_email",
  "marketing_sms",
  "data_processing",
  "newsletter",
  "third_party_sharing",
  "profiling",
  "automated_decisions",
] as const;

const LEGAL_BASIS_VALUES = [
  "consent",
  "contract",
  "legal_obligation",
  "vital_interests",
  "public_task",
  "legitimate_interests",
] as const;

function DocumentsTab({ customerId }: { customerId: string }) {
  const [typeFilter, setTypeFilter] = useState<"all" | "contract" | "invoice">("all");
  
  const { data: documents = [], isLoading } = useQuery<CustomerDocument[]>({
    queryKey: ["/api/customers", customerId, "documents"],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${customerId}/documents`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
    refetchInterval: 10000, // Auto-refresh every 10 seconds
    refetchOnWindowFocus: true,
  });

  const filteredDocuments = typeFilter === "all" 
    ? documents 
    : documents.filter(doc => doc.type === typeFilter);

  const getStatusBadgeVariant = (type: string, status: string) => {
    if (type === "contract") {
      switch (status) {
        case "signed": case "completed": return "default";
        case "sent": case "pending_signature": return "secondary";
        case "draft": return "outline";
        case "cancelled": case "expired": return "destructive";
        default: return "outline";
      }
    } else {
      switch (status) {
        case "paid": return "default";
        case "sent": return "secondary";
        case "generated": return "outline";
        case "overdue": return "destructive";
        default: return "outline";
      }
    }
  };

  const getStatusLabel = (type: string, status: string) => {
    if (type === "contract") {
      switch (status) {
        case "draft": return "Koncept";
        case "sent": return "Odoslaná";
        case "pending_signature": return "Čaká na podpis";
        case "signed": return "Podpísaná";
        case "completed": return "Dokončená";
        case "cancelled": return "Zrušená";
        case "expired": return "Expirovaná";
        default: return status;
      }
    } else {
      switch (status) {
        case "generated": return "Vygenerovaná";
        case "sent": return "Odoslaná";
        case "paid": return "Uhradená";
        case "overdue": return "Po splatnosti";
        default: return status;
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p className="font-medium">Žiadne dokumenty</p>
        <p className="text-sm">Klient zatiaľ nemá žiadne zmluvy ani faktúry.</p>
      </div>
    );
  }

  // Group documents by month/year
  const groupedDocuments = filteredDocuments.reduce((groups, doc) => {
    const date = new Date(doc.createdAt);
    const key = format(date, "MMMM yyyy", { locale: sk });
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(doc);
    return groups;
  }, {} as Record<string, CustomerDocument[]>);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          <h4 className="font-semibold">Dokumenty ({filteredDocuments.length})</h4>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={typeFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setTypeFilter("all")}
            data-testid="filter-docs-all"
          >
            Všetky
          </Button>
          <Button
            variant={typeFilter === "contract" ? "default" : "outline"}
            size="sm"
            onClick={() => setTypeFilter("contract")}
            data-testid="filter-docs-contracts"
          >
            <FileText className="h-4 w-4 mr-1" />
            Zmluvy
          </Button>
          <Button
            variant={typeFilter === "invoice" ? "default" : "outline"}
            size="sm"
            onClick={() => setTypeFilter("invoice")}
            data-testid="filter-docs-invoices"
          >
            <FileText className="h-4 w-4 mr-1" />
            Faktúry
          </Button>
        </div>
      </div>

      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
        
        <div className="space-y-6">
          {Object.entries(groupedDocuments).map(([monthYear, docs]) => (
            <div key={monthYear}>
              <div className="relative pl-10 mb-3">
                <div className="absolute left-1.5 w-5 h-5 rounded-full bg-muted border-2 border-border flex items-center justify-center">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                </div>
                <h5 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  {monthYear}
                </h5>
              </div>
              
              <div className="space-y-4">
                {docs.map((doc) => (
                  <div key={doc.id} className="relative pl-10">
                    <div className={`absolute left-2.5 w-3 h-3 rounded-full border-2 ${
                      doc.type === "contract" ? "bg-primary border-primary" : "bg-blue-500 border-blue-500"
                    }`} />
                    
                    <div className="border rounded-lg p-4 bg-card">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {doc.type === "contract" ? (
                              <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                                Zmluva
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/30">
                                Faktúra
                              </Badge>
                            )}
                            <Badge variant={getStatusBadgeVariant(doc.type, doc.status) as any}>
                              {getStatusLabel(doc.type, doc.status)}
                            </Badge>
                          </div>
                          
                          <p className="font-medium">{doc.number}</p>
                          
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {format(new Date(doc.createdAt), "d.M.yyyy HH:mm")}
                            </span>
                            
                            {doc.createdByName && (
                              <span className="flex items-center gap-1">
                                <UserCircle className="h-3.5 w-3.5" />
                                {doc.createdByName}
                              </span>
                            )}
                            
                            {doc.totalAmount && (
                              <span className="font-medium text-foreground">
                                {parseFloat(doc.totalAmount).toLocaleString("sk-SK", { minimumFractionDigits: 2 })} {doc.currency}
                              </span>
                            )}
                            
                            {doc.type === "contract" && doc.validFrom && (
                              <span>
                                Platnosť: {format(new Date(doc.validFrom), "d.M.yyyy")}
                                {doc.validTo && ` - ${format(new Date(doc.validTo), "d.M.yyyy")}`}
                              </span>
                            )}
                            
                            {doc.type === "invoice" && doc.dueDate && (
                              <span>
                                Splatnosť: {format(new Date(doc.dueDate), "d.M.yyyy")}
                              </span>
                            )}
                          </div>
                          
                          {doc.type === "contract" && doc.status === "cancelled" && doc.cancellationReason && (
                            <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-sm">
                              <span className="text-destructive font-medium">Dôvod zrušenia: </span>
                              <span className="text-muted-foreground">{doc.cancellationReason}</span>
                            </div>
                          )}
                        </div>
                        
                        {doc.pdfPath && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`/api/customers/${customerId}/documents/${doc.type}/${doc.id}/pdf`, "_blank")}
                            data-testid={`button-download-${doc.type}-${doc.id}`}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            PDF
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GdprTab({ customerId }: { customerId: string }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [isAddConsentOpen, setIsAddConsentOpen] = useState(false);
  const [isRevokeDialogOpen, setIsRevokeDialogOpen] = useState(false);
  const [selectedConsentId, setSelectedConsentId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [newConsent, setNewConsent] = useState({
    consentType: "",
    legalBasis: "consent",
    purpose: "",
    source: "crm_system",
    granted: true,
  });

  const { data: consents = [], isLoading: consentsLoading } = useQuery<CustomerConsent[]>({
    queryKey: ["/api/customers", customerId, "consents"],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${customerId}/consents`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch consents");
      return res.json();
    },
  });

  const createConsentMutation = useMutation({
    mutationFn: async (data: typeof newConsent) => {
      return apiRequest("POST", `/api/customers/${customerId}/consents`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "consents"] });
      setIsAddConsentOpen(false);
      setNewConsent({ consentType: "", legalBasis: "consent", purpose: "", source: "crm_system", granted: true });
      toast({ title: "Consent recorded successfully" });
    },
    onError: () => {
      toast({ title: "Failed to record consent", variant: "destructive" });
    },
  });

  const revokeConsentMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return apiRequest("POST", `/api/customers/${customerId}/consents/${id}/revoke`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "consents"] });
      setIsRevokeDialogOpen(false);
      setSelectedConsentId(null);
      setRevokeReason("");
      toast({ title: "Consent revoked successfully" });
    },
    onError: () => {
      toast({ title: "Failed to revoke consent", variant: "destructive" });
    },
  });

  const exportDataMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/customers/${customerId}/gdpr-export`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to export data");
      return res.json();
    },
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `customer_data_export_${customerId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Data exported successfully" });
    },
    onError: () => {
      toast({ title: "Failed to export data", variant: "destructive" });
    },
  });

  const getConsentTypeLabel = (value: string) => {
    const key = value as keyof typeof t.customers.gdpr.consentTypes;
    return t.customers.gdpr.consentTypes?.[key] || value;
  };

  const getLegalBasisLabel = (value: string) => {
    const key = value as keyof typeof t.customers.gdpr.legalBases;
    return t.customers.gdpr.legalBases?.[key] || value;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h4 className="font-semibold flex items-center gap-2">
          <Shield className="h-4 w-4" />
          {t.customers.gdpr?.consentsTitle || "Consent Management"}
        </h4>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => exportDataMutation.mutate()}
            disabled={exportDataMutation.isPending}
            data-testid="button-gdpr-export"
          >
            <Download className="h-4 w-4 mr-2" />
            {exportDataMutation.isPending ? "Exporting..." : (t.customers.gdpr?.exportData || "Export Data")}
          </Button>
          <Dialog open={isAddConsentOpen} onOpenChange={setIsAddConsentOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-consent">
                <Plus className="h-4 w-4 mr-2" />
                {t.customers.gdpr?.addConsent || "Add Consent"}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t.customers.gdpr?.addConsentTitle || "Record New Consent"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>{t.customers.gdpr?.consentType || "Consent Type"}</Label>
                  <Select
                    value={newConsent.consentType}
                    onValueChange={(val) => setNewConsent({ ...newConsent, consentType: val })}
                  >
                    <SelectTrigger data-testid="select-consent-type">
                      <SelectValue placeholder="Select consent type" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONSENT_TYPE_VALUES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {getConsentTypeLabel(value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t.customers.gdpr?.legalBasis || "Legal Basis"}</Label>
                  <Select
                    value={newConsent.legalBasis}
                    onValueChange={(val) => setNewConsent({ ...newConsent, legalBasis: val })}
                  >
                    <SelectTrigger data-testid="select-legal-basis">
                      <SelectValue placeholder="Select legal basis" />
                    </SelectTrigger>
                    <SelectContent>
                      {LEGAL_BASIS_VALUES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {getLegalBasisLabel(value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t.customers.gdpr?.purpose || "Purpose"}</Label>
                  <Input
                    value={newConsent.purpose}
                    onChange={(e) => setNewConsent({ ...newConsent, purpose: e.target.value })}
                    placeholder="Describe the purpose..."
                    data-testid="input-consent-purpose"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsAddConsentOpen(false)}>
                    {t.common?.cancel || "Cancel"}
                  </Button>
                  <Button
                    onClick={() => createConsentMutation.mutate(newConsent)}
                    disabled={!newConsent.consentType || createConsentMutation.isPending}
                    data-testid="button-save-consent"
                  >
                    {createConsentMutation.isPending ? "Saving..." : (t.common?.save || "Save")}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {consentsLoading ? (
        <p className="text-sm text-muted-foreground">Loading consents...</p>
      ) : consents.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.customers.gdpr?.noConsents || "No consents recorded yet."}</p>
      ) : (
        <div className="space-y-2">
          {consents.map((consent) => (
            <div
              key={consent.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                consent.granted ? "bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800" : "bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
              }`}
              data-testid={`consent-item-${consent.id}`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{getConsentTypeLabel(consent.consentType)}</span>
                  <Badge variant={consent.granted ? "default" : "destructive"}>
                    {consent.granted ? "Active" : "Revoked"}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-4 flex-wrap">
                  <span>Legal Basis: {getLegalBasisLabel(consent.legalBasis)}</span>
                  {consent.grantedAt && (
                    <span>Granted: {format(new Date(consent.grantedAt), "MMM dd, yyyy")}</span>
                  )}
                  {consent.revokedAt && (
                    <span>Revoked: {format(new Date(consent.revokedAt), "MMM dd, yyyy")}</span>
                  )}
                  {consent.purpose && <span>Purpose: {consent.purpose}</span>}
                </div>
              </div>
              {consent.granted && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedConsentId(consent.id);
                    setIsRevokeDialogOpen(true);
                  }}
                  data-testid={`button-revoke-consent-${consent.id}`}
                >
                  <XCircle className="h-4 w-4 mr-1 text-destructive" />
                  Revoke
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={isRevokeDialogOpen} onOpenChange={setIsRevokeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.customers.gdpr?.revokeConsentTitle || "Revoke Consent"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t.customers.gdpr?.revokeConsentDesc || "Please provide a reason for revoking this consent."}
            </p>
            <div>
              <Label>{t.customers.gdpr?.revokeReason || "Reason"}</Label>
              <Input
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="Enter reason for revocation..."
                data-testid="input-revoke-reason"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsRevokeDialogOpen(false)}>
                {t.common?.cancel || "Cancel"}
              </Button>
              <Button
                variant="destructive"
                onClick={() => selectedConsentId && revokeConsentMutation.mutate({ id: selectedConsentId, reason: revokeReason })}
                disabled={revokeConsentMutation.isPending}
                data-testid="button-confirm-revoke"
              >
                {revokeConsentMutation.isPending ? "Revoking..." : (t.customers.gdpr?.confirmRevoke || "Revoke")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Payment breakdown component for invoice detail dialog
function InvoicePaymentBreakdownItem({ 
  instanceId, 
  paymentOptionId, 
  amount,
  storageIncluded = false,
  storageAmount = 0,
  collectionAmount = 0,
  currencySymbol = "€",
  t
}: { 
  instanceId: string; 
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
    const frequencyLabel = paymentOption.frequency === 'monthly' ? (t.konfigurator?.monthly || "mesačne") : 
                          paymentOption.frequency === 'quarterly' ? (t.konfigurator?.quarterly || "štvrťročne") : 
                          paymentOption.frequency === 'yearly' ? (t.konfigurator?.yearly || "ročne") : paymentOption.frequency;
    
    return (
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <CreditCard className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-400">{t.konfigurator?.collectionItem || "Odber"}</span>
          <Badge variant="secondary" className="text-xs">{t.konfigurator?.installmentsLabel || "Splátky"}</Badge>
          {storageIncluded && <Badge variant="outline" className="text-xs bg-green-100 dark:bg-green-800 border-green-300 dark:border-green-700">{t.konfigurator?.storageAddOn || "+ Uskladnenie"}</Badge>}
        </div>
        <div className="text-xs space-y-1">
          <div className="flex justify-between">
            <span>{t.konfigurator?.paymentType || "Typ platby"}:</span>
            <span className="font-medium">{paymentOption.name}</span>
          </div>
          {storageIncluded && (
            <>
              <div className="flex justify-between text-blue-600 dark:text-blue-400">
                <span>{t.konfigurator?.collectionItem || "Odber"}:</span>
                <span>{collectionAmount.toFixed(2)} {currencySymbol}</span>
              </div>
              <div className="flex justify-between text-green-600 dark:text-green-400">
                <span>{t.konfigurator?.storageItem || "Uskladnenie"}:</span>
                <span>+{storageAmount.toFixed(2)} {currencySymbol}</span>
              </div>
            </>
          )}
          {fee > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>{t.konfigurator?.feeLabel || "Poplatok"}:</span>
              <span>+{fee.toFixed(2)} {currencySymbol}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>{t.konfigurator?.totalLabel || "Celkom"}:</span>
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
                <span>{t.konfigurator?.installmentLabel || "Splátka"} {i + 1}:</span>
                <span>{installmentAmount.toFixed(2)} {currencySymbol}</span>
              </div>
            ))}
            {paymentOption.installmentCount > 6 && (
              <div className="text-center text-xs text-muted-foreground pt-1">
                {(t.konfigurator?.andMoreInstallments || "... a ďalších {count} splátok").replace('{count}', String(paymentOption.installmentCount - 6))}
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
          <span className="text-sm font-medium text-green-700 dark:text-green-400">{t.konfigurator?.collectionItem || "Odber"}</span>
          <Badge variant="outline" className="text-xs">{t.konfigurator?.oneTimePayment || "Jednorázová platba"}</Badge>
        </div>
        <div className="text-xs space-y-1">
          <div className="flex justify-between">
            <span>{t.konfigurator?.paymentType || "Typ platby"}:</span>
            <span className="font-medium">{paymentOption.name}</span>
          </div>
          <div className="flex justify-between font-medium text-green-700 dark:text-green-400">
            <span>{t.konfigurator?.amountDue || "K úhrade"}:</span>
            <span>{amount.toFixed(2)} {currencySymbol}</span>
          </div>
        </div>
      </div>
    );
  }
}

// Simplified Payment breakdown component for email preview (same as InvoicePaymentBreakdownItem)
function EmailPaymentBreakdownItem({ 
  instanceId, 
  paymentOptionId, 
  amount,
  storageIncluded = false,
  storageAmount = 0,
  collectionAmount = 0,
  currencySymbol = "€",
  t
}: { 
  instanceId: string; 
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
    const frequencyLabel = paymentOption.frequency === 'monthly' ? (t.konfigurator?.monthly || "mesačne") : 
                          paymentOption.frequency === 'quarterly' ? (t.konfigurator?.quarterly || "štvrťročne") : 
                          paymentOption.frequency === 'yearly' ? (t.konfigurator?.yearly || "ročne") : paymentOption.frequency;
    
    return (
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <CreditCard className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-400">{t.konfigurator?.collectionItem || "Odber"}</span>
          <Badge variant="secondary" className="text-xs">{t.konfigurator?.installmentsLabel || "Splátky"}</Badge>
          {storageIncluded && <Badge variant="outline" className="text-xs bg-green-100 dark:bg-green-800 border-green-300 dark:border-green-700">{t.konfigurator?.storageAddOn || "+ Uskladnenie"}</Badge>}
        </div>
        <div className="text-xs space-y-1">
          <div className="flex justify-between">
            <span>{t.konfigurator?.paymentType || "Typ platby"}:</span>
            <span className="font-medium">{paymentOption.name}</span>
          </div>
          {storageIncluded && (
            <>
              <div className="flex justify-between text-blue-600 dark:text-blue-400">
                <span>{t.konfigurator?.collectionItem || "Odber"}:</span>
                <span>{collectionAmount.toFixed(2)} {currencySymbol}</span>
              </div>
              <div className="flex justify-between text-green-600 dark:text-green-400">
                <span>{t.konfigurator?.storageItem || "Uskladnenie"}:</span>
                <span>+{storageAmount.toFixed(2)} {currencySymbol}</span>
              </div>
            </>
          )}
          {fee > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>{t.konfigurator?.feeLabel || "Poplatok"}:</span>
              <span>+{fee.toFixed(2)} {currencySymbol}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>{t.konfigurator?.totalLabel || "Celkom"}:</span>
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
                <span>{t.konfigurator?.installmentLabel || "Splátka"} {i + 1}:</span>
                <span>{installmentAmount.toFixed(2)} {currencySymbol}</span>
              </div>
            ))}
            {paymentOption.installmentCount > 6 && (
              <div className="text-center text-xs text-muted-foreground pt-1">
                {(t.konfigurator?.andMoreInstallments || "... a ďalších {count} splátok").replace('{count}', String(paymentOption.installmentCount - 6))}
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
          <span className="text-sm font-medium text-green-700 dark:text-green-400">{t.konfigurator?.collectionItem || "Odber"}</span>
          <Badge variant="outline" className="text-xs">{t.konfigurator?.oneTimePayment || "Jednorázová platba"}</Badge>
        </div>
        <div className="text-xs space-y-1">
          <div className="flex justify-between">
            <span>{t.konfigurator?.paymentType || "Typ platby"}:</span>
            <span className="font-medium">{paymentOption.name}</span>
          </div>
          <div className="flex justify-between font-medium text-green-700 dark:text-green-400">
            <span>{t.konfigurator?.amountDue || "K úhrade"}:</span>
            <span>{amount.toFixed(2)} {currencySymbol}</span>
          </div>
        </div>
      </div>
    );
  }
}

// Timeline action types for filtering with vibrant colors
const TIMELINE_ACTION_TYPES = [
  { value: "all", label: "Vsetky", icon: ListChecks, activeClass: "bg-gradient-to-br from-slate-500 to-slate-600 border-slate-600 shadow-lg shadow-slate-500/25", textColor: "text-white", inactiveClass: "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm", inactiveTextColor: "text-slate-600 dark:text-slate-400" },
  { value: "update", label: "Udaje", icon: Pencil, activeClass: "bg-gradient-to-br from-blue-500 to-blue-600 border-blue-600 shadow-lg shadow-blue-500/25", textColor: "text-white", inactiveClass: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-sm", inactiveTextColor: "text-blue-600 dark:text-blue-400" },
  { value: "document", label: "Dokumenty", icon: FileText, activeClass: "bg-gradient-to-br from-emerald-500 to-emerald-600 border-emerald-600 shadow-lg shadow-emerald-500/25", textColor: "text-white", inactiveClass: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 dark:hover:border-emerald-600 hover:shadow-sm", inactiveTextColor: "text-emerald-600 dark:text-emerald-400" },
  { value: "note", label: "Poznamky", icon: MessageSquare, activeClass: "bg-gradient-to-br from-amber-500 to-amber-600 border-amber-600 shadow-lg shadow-amber-500/25", textColor: "text-white", inactiveClass: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 hover:border-amber-400 dark:hover:border-amber-600 hover:shadow-sm", inactiveTextColor: "text-amber-600 dark:text-amber-400" },
  { value: "email", label: "Emaily", icon: Mail, activeClass: "bg-gradient-to-br from-sky-500 to-sky-600 border-sky-600 shadow-lg shadow-sky-500/25", textColor: "text-white", inactiveClass: "bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800 hover:border-sky-400 dark:hover:border-sky-600 hover:shadow-sm", inactiveTextColor: "text-sky-600 dark:text-sky-400" },
  { value: "call", label: "Hovory", icon: PhoneCall, activeClass: "bg-gradient-to-br from-violet-500 to-violet-600 border-violet-600 shadow-lg shadow-violet-500/25", textColor: "text-white", inactiveClass: "bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800 hover:border-violet-400 dark:hover:border-violet-600 hover:shadow-sm", inactiveTextColor: "text-violet-600 dark:text-violet-400" },
  { value: "status", label: "Stavy", icon: RefreshCw, activeClass: "bg-gradient-to-br from-orange-500 to-orange-600 border-orange-600 shadow-lg shadow-orange-500/25", textColor: "text-white", inactiveClass: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800 hover:border-orange-400 dark:hover:border-orange-600 hover:shadow-sm", inactiveTextColor: "text-orange-600 dark:text-orange-400" },
  { value: "product", label: "Produkty", icon: Package, activeClass: "bg-gradient-to-br from-indigo-500 to-indigo-600 border-indigo-600 shadow-lg shadow-indigo-500/25", textColor: "text-white", inactiveClass: "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800 hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-sm", inactiveTextColor: "text-indigo-600 dark:text-indigo-400" },
  { value: "pipeline", label: "Pipeline", icon: ArrowRight, activeClass: "bg-gradient-to-br from-cyan-500 to-cyan-600 border-cyan-600 shadow-lg shadow-cyan-500/25", textColor: "text-white", inactiveClass: "bg-cyan-50 dark:bg-cyan-950/30 border-cyan-200 dark:border-cyan-800 hover:border-cyan-400 dark:hover:border-cyan-600 hover:shadow-sm", inactiveTextColor: "text-cyan-600 dark:text-cyan-400" },
  { value: "consent", label: "Suhlasy", icon: Shield, activeClass: "bg-gradient-to-br from-teal-500 to-teal-600 border-teal-600 shadow-lg shadow-teal-500/25", textColor: "text-white", inactiveClass: "bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800 hover:border-teal-400 dark:hover:border-teal-600 hover:shadow-sm", inactiveTextColor: "text-teal-600 dark:text-teal-400" },
  { value: "campaign", label: "Kampane", icon: Target, activeClass: "bg-gradient-to-br from-rose-500 to-rose-600 border-rose-600 shadow-lg shadow-rose-500/25", textColor: "text-white", inactiveClass: "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 hover:border-rose-400 dark:hover:border-rose-600 hover:shadow-sm", inactiveTextColor: "text-rose-600 dark:text-rose-400" },
] as const;

// Field label translations for displaying changes
const FIELD_LABELS: Record<string, string> = {
  firstName: "Meno",
  lastName: "Priezvisko",
  maidenName: "Rodné meno",
  titleBefore: "Titul pred",
  titleAfter: "Titul za",
  email: "Email",
  email2: "Sekundárny email",
  phone: "Telefón",
  mobile: "Mobil",
  mobile2: "Mobil 2",
  otherContact: "Ďalší kontakt",
  nationalId: "Rodné číslo",
  idCardNumber: "Číslo OP",
  dateOfBirth: "Dátum narodenia",
  country: "Krajina",
  city: "Mesto",
  address: "Adresa",
  postalCode: "PSČ",
  region: "Región",
  status: "Stav",
  clientStatus: "Stav klienta",
  serviceType: "Typ služby",
  leadScore: "Lead skóre",
  leadStatus: "Lead stav",
  newsletter: "Newsletter",
  notes: "Poznámky",
  bankAccount: "Bankový účet",
  bankCode: "Kód banky",
  bankName: "Názov banky",
  bankSwift: "SWIFT",
  healthInsuranceId: "Zdravotná poisťovňa",
  useCorrespondenceAddress: "Korešpondenčná adresa",
  corrName: "Korešp. meno",
  corrAddress: "Korešp. adresa",
  corrCity: "Korešp. mesto",
  corrPostalCode: "Korešp. PSČ",
  corrRegion: "Korešp. región",
  corrCountry: "Korešp. krajina",
  complaintTypeId: "Typ reklamácie",
  cooperationTypeId: "Typ spolupráce",
  vipStatusId: "VIP status",
  assignedUserId: "Priradený používateľ",
};

function CustomerHistoryTimeline({ 
  customerId, 
  customerName 
}: { 
  customerId: string; 
  customerName: string;
}) {
  const { toast } = useToast();
  const { t } = useI18n();
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [viewingEmail, setViewingEmail] = useState<any>(null);
  const [editingEmail, setEditingEmail] = useState<any>(null);
  const [editEmailSubject, setEditEmailSubject] = useState("");
  const [editEmailContent, setEditEmailContent] = useState("");

  // Fetch all data sources
  const { data: activityLogs = [], isLoading: logsLoading } = useQuery<any[]>({
    queryKey: ["/api/customers", customerId, "activity-logs"],
    refetchInterval: 10000,
  });

  const { data: documents = [], isLoading: docsLoading } = useQuery<any[]>({
    queryKey: ["/api/customers", customerId, "documents"],
  });

  const { data: notes = [], isLoading: notesLoading } = useQuery<any[]>({
    queryKey: ["/api/customers", customerId, "notes"],
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery<any[]>({
    queryKey: ["/api/customers", customerId, "messages"],
    refetchInterval: 10000, // Auto-refresh every 10 seconds for new SMS/emails
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  const { data: pipelineStages = [] } = useQuery<any[]>({
    queryKey: ["/api/pipeline-stages"],
    queryFn: async () => {
      const res = await fetch("/api/pipeline-stages", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: customerProducts = [] } = useQuery<any[]>({
    queryKey: ["/api/customers", customerId, "products"],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${customerId}/products`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch customer emails for timeline
  const { data: customerEmails = [] } = useQuery<CustomerEmailNotification[]>({
    queryKey: ["/api/customers", customerId, "emails"],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${customerId}/emails`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch customer call logs for timeline
  const { data: customerCallLogs = [] } = useQuery<Array<{
    id: string;
    userId: string;
    phoneNumber: string;
    direction: string;
    status: string;
    startedAt: string;
    answeredAt: string | null;
    endedAt: string | null;
    durationSeconds: number | null;
    notes: string | null;
    hungUpBy: string | null;
  }>>({
    queryKey: ["/api/customers", customerId, "call-logs"],
    queryFn: async () => {
      const res = await fetch(`/api/call-logs?customerId=${customerId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const getStageName = (stageId: string) => {
    const stage = pipelineStages.find((s: any) => s.id === stageId);
    return stage?.name || stageId;
  };

  const getProductName = (productId: string) => {
    const product = products.find((p: any) => p.id === productId);
    return product?.name || productId;
  };

  // Helper to get explicit color classes for timeline dots (avoids dynamic class generation)
  const getTimelineDotColors = (color: string) => {
    const colorMap: Record<string, { border: string; bg: string }> = {
      "text-blue-500": { border: "border-blue-500", bg: "bg-blue-500" },
      "text-green-500": { border: "border-green-500", bg: "bg-green-500" },
      "text-red-500": { border: "border-red-500", bg: "bg-red-500" },
      "text-yellow-500": { border: "border-yellow-500", bg: "bg-yellow-500" },
      "text-purple-500": { border: "border-purple-500", bg: "bg-purple-500" },
      "text-orange-500": { border: "border-orange-500", bg: "bg-orange-500" },
      "text-cyan-500": { border: "border-cyan-500", bg: "bg-cyan-500" },
      "text-indigo-500": { border: "border-indigo-500", bg: "bg-indigo-500" },
      "text-emerald-500": { border: "border-emerald-500", bg: "bg-emerald-500" },
      "text-amber-500": { border: "border-amber-500", bg: "bg-amber-500" },
      "text-blue-400": { border: "border-blue-400", bg: "bg-blue-400" },
      "text-green-400": { border: "border-green-400", bg: "bg-green-400" },
      "text-violet-500": { border: "border-violet-500", bg: "bg-violet-500" },
      "text-sky-500": { border: "border-sky-500", bg: "bg-sky-500" },
    };
    return colorMap[color] || { border: "border-muted-foreground", bg: "bg-muted-foreground" };
  };

  const getUserName = (userId: string) => {
    const user = users.find((u: any) => u.id === userId);
    return user?.fullName || user?.username || "Systém";
  };

  // Combine all events into unified timeline
  const timelineEvents = useMemo(() => {
    const events: Array<{
      id: string;
      type: string;
      action: string;
      title: string;
      description: string;
      details?: any;
      createdAt: string;
      userId?: string;
      downloadUrl?: string;
      documentType?: string;
      icon: any;
      color: string;
    }> = [];

    // Add activity logs
    activityLogs.forEach((log: any) => {
      // Handle details - may be string or already parsed object
      let details: any = {};
      if (log.details) {
        if (typeof log.details === "string") {
          try {
            details = JSON.parse(log.details);
          } catch (e) {
            details = {};
          }
        } else {
          details = log.details;
        }
      }

      let type = "update";
      let icon = Pencil;
      let color = "text-blue-500";

      if (log.action === "create") {
        icon = PlusCircle;
        color = "text-green-500";
        type = "update";
      } else if (log.action === "update") {
        icon = Pencil;
        color = "text-blue-500";
        type = "update";
        // Check if it's a status change
        if (details?.changes?.includes("status") || details?.changes?.includes("clientStatus")) {
          type = "status";
          icon = RefreshCw;
          color = "text-orange-500";
        }
      } else if (log.action === "delete") {
        icon = Trash2;
        color = "text-red-500";
        type = "update";
      } else if (log.action === "export") {
        icon = Download;
        color = "text-purple-500";
        type = "update";
      } else if (log.action === "add_product" || log.action === "remove_product") {
        icon = Package;
        color = "text-indigo-500";
        type = "product";
      } else if (log.action === "create_note") {
        icon = MessageSquare;
        color = "text-yellow-500";
        type = "note";
      } else if (log.action === "pipeline_move" || log.action === "stage_changed") {
        icon = ArrowRight;
        color = "text-cyan-500";
        type = "pipeline";
      } else if (log.action === "consent_granted" || log.action === "consent_revoked") {
        icon = Shield;
        color = log.action === "consent_granted" ? "text-green-500" : "text-red-500";
        type = "consent";
      } else if (log.action === "campaign_joined" || log.action === "campaign_left" || log.action === "campaign_status_changed" || log.action === "campaign_note_added") {
        icon = Target;
        color = "text-violet-500";
        type = "campaign";
      } else if (log.action === "note_added" || log.action === "add_note") {
        icon = MessageSquare;
        color = "text-amber-500";
        type = "note";
      } else if (log.action === "email_sent") {
        icon = Mail;
        color = "text-blue-400";
        type = "message";
      }

      const actionLabels: Record<string, string> = {
        create: "Vytvorenie zákazníka",
        update: "Aktualizácia údajov",
        delete: "Zmazanie",
        export: "Export dát (GDPR)",
        add_product: "Pridanie produktu",
        remove_product: "Odobratie produktu",
        create_note: "Pridanie poznámky",
        pipeline_move: "Presun v pipeline",
        stage_changed: "Presun v pipeline",
        consent_granted: "Udelenie súhlasu",
        consent_revoked: "Odvolanie súhlasu",
        campaign_joined: "Pridanie do kampane",
        campaign_left: "Odstránenie z kampane",
        campaign_status_changed: "Zmena statusu v kampani",
        campaign_note_added: "Poznámka ku kampani",
        note_added: "Pridanie poznámky",
        add_note: "Pridanie poznámky",
        email_sent: "Odoslaný email",
      };

      // Build enriched description based on action type
      let enrichedDescription = log.entityName || customerName;
      if ((log.action === "pipeline_move" || log.action === "stage_changed") && details) {
        const fromStage = details.fromStageName || (details.fromStageId ? getStageName(details.fromStageId) : "—");
        const toStage = details.toStageName || (details.toStageId ? getStageName(details.toStageId) : "—");
        enrichedDescription = `${fromStage} → ${toStage}`;
      } else if ((log.action === "add_product" || log.action === "remove_product") && details?.productId) {
        enrichedDescription = getProductName(details.productId);
      } else if ((log.action === "consent_granted" || log.action === "consent_revoked") && details?.consentType) {
        enrichedDescription = details.consentType;
      } else if (log.action === "campaign_joined" || log.action === "campaign_left") {
        enrichedDescription = details?.campaignName || "Kampaň";
      } else if (log.action === "campaign_status_changed" && details) {
        const campaignName = details.campaignName || "Kampaň";
        const prevStatus = details.previousStatus || "—";
        const newStatus = details.newStatus || "—";
        enrichedDescription = `${campaignName}: ${prevStatus} → ${newStatus}`;
      } else if (log.action === "campaign_note_added" && details) {
        enrichedDescription = details.campaignName || "Kampaň";
      } else if ((log.action === "note_added" || log.action === "add_note") && details?.content) {
        enrichedDescription = details.content.substring(0, 50) + (details.content.length > 50 ? "..." : "");
      } else if (log.action === "email_sent" && details?.subject) {
        enrichedDescription = details.subject;
      }

      events.push({
        id: log.id,
        type,
        action: log.action,
        title: actionLabels[log.action] || log.action,
        description: enrichedDescription,
        details,
        createdAt: log.createdAt,
        userId: log.userId,
        icon,
        color,
      });
    });

    // Add documents (contracts and invoices)
    documents.forEach((doc: any) => {
      events.push({
        id: doc.id,
        type: "document",
        action: "document_created",
        title: doc.type === "contract" ? "Zmluva" : "Faktúra",
        description: doc.number || doc.contractNumber || doc.invoiceNumber,
        details: { status: doc.status, templateName: doc.templateName },
        createdAt: doc.createdAt,
        userId: doc.createdBy,
        downloadUrl: `/api/customers/${customerId}/documents/${doc.type}/${doc.id}/pdf`,
        documentType: doc.type,
        icon: FileText,
        color: doc.type === "contract" ? "text-emerald-500" : "text-amber-500",
      });
    });

    // Add notes (only if not already in activity logs)
    notes.forEach((note: any) => {
      const alreadyInLogs = events.some(e => e.action === "create_note" && (e.details as any)?.noteId === note.id);
      if (!alreadyInLogs) {
        events.push({
          id: `note-${note.id}`,
          type: "note",
          action: "note",
          title: "Poznámka",
          description: note.content?.substring(0, 100) + (note.content?.length > 100 ? "..." : ""),
          details: { content: note.content },
          createdAt: note.createdAt,
          userId: note.userId,
          icon: MessageSquare,
          color: "text-yellow-500",
        });
      }
    });

    // Add messages (grouped under email filter)
    messages.forEach((msg: any) => {
      const isInbound = msg.direction === "inbound";
      const isSms = msg.type === "sms";
      
      let title = msg.type === "email" ? "Email" : "SMS";
      if (isSms) {
        title = isInbound ? "Prijatá SMS" : "Odoslaná SMS";
      } else if (msg.type === "email") {
        title = isInbound ? "Prijatý email" : "Odoslaný email";
      }
      
      events.push({
        id: `msg-${msg.id}`,
        type: "email",
        action: isSms ? (isInbound ? "sms_received" : "sms_sent") : msg.type,
        title,
        description: msg.subject || msg.content?.substring(0, 50),
        details: { 
          subject: msg.subject, 
          content: msg.content,
          recipient: msg.recipientEmail || msg.recipientPhone,
          sender: msg.senderPhone,
          direction: msg.direction,
          status: msg.status,
          messageId: msg.id,
        },
        createdAt: msg.sentAt || msg.createdAt,
        userId: msg.userId,
        icon: isSms ? (isInbound ? ArrowDownLeft : ArrowUpRight) : (isInbound ? MailOpen : Mail),
        color: isSms 
          ? (isInbound ? "text-cyan-500" : "text-emerald-500") 
          : (isInbound ? "text-green-500" : "text-sky-500"),
      });
    });

    // Add customer products assignments
    customerProducts.forEach((cp: any) => {
      events.push({
        id: `product-${cp.id}`,
        type: "product",
        action: "product_assigned",
        title: "Priradený produkt",
        description: getProductName(cp.productId),
        details: { productId: cp.productId, assignedAt: cp.createdAt },
        createdAt: cp.createdAt,
        userId: cp.assignedBy,
        icon: Package,
        color: "text-indigo-500",
      });
    });

    // Add customer emails (inbound and outbound)
    customerEmails.forEach((email: CustomerEmailNotification) => {
      const isOutbound = email.direction === "outbound";
      events.push({
        id: `email-${email.id}`,
        type: "email",
        action: isOutbound ? "email_sent" : "email_received",
        title: isOutbound ? "Odoslaný email" : "Prijatý email",
        description: email.subject || "(bez predmetu)",
        details: { 
          subject: email.subject,
          bodyPreview: email.bodyPreview,
          senderEmail: email.senderEmail,
          recipientEmail: email.recipientEmail,
          direction: email.direction,
          mailboxEmail: email.mailboxEmail,
        },
        createdAt: email.receivedAt,
        userId: undefined,
        icon: isOutbound ? ArrowUpRight : ArrowDownLeft,
        color: isOutbound ? "text-blue-500" : "text-green-500",
      });
    });

    // Add customer call logs
    customerCallLogs.forEach((call) => {
      const isOutbound = call.direction === "outbound";
      const caller = users.find((u: any) => u.id === call.userId);
      const callerName = caller?.fullName || caller?.username || (t.customers.callHistory?.unknownUser || "Unknown");
      const duration = call.durationSeconds 
        ? `${Math.floor(call.durationSeconds / 60)}:${String(call.durationSeconds % 60).padStart(2, '0')}`
        : "-";
      
      const statusLabels: Record<string, string> = {
        completed: t.customers.callHistory?.statusCompleted || "Completed",
        answered: t.customers.callHistory?.statusAnswered || "Answered",
        failed: t.customers.callHistory?.statusFailed || "Failed",
        missed: t.customers.callHistory?.statusMissed || "Missed",
        no_answer: t.customers.callHistory?.statusNoAnswer || "No Answer",
        busy: t.customers.callHistory?.statusBusy || "Busy",
        cancelled: t.customers.callHistory?.statusCancelled || "Cancelled",
        initiated: t.customers.callHistory?.statusInitiated || "Initiated",
        ringing: t.customers.callHistory?.statusRinging || "Ringing",
      };
      
      let description = `${call.phoneNumber} - ${statusLabels[call.status] || call.status}`;
      if (call.durationSeconds) {
        description += ` - ${t.customers.callHistory?.duration || "Duration"}: ${duration}`;
      }
      if (call.hungUpBy) {
        description += ` - ${call.hungUpBy === 'customer' ? (t.customers.callHistory?.hungUpByCustomer || "Customer hung up") : (t.customers.callHistory?.hungUpByUser || "User hung up")}`;
      }
      
      events.push({
        id: `call-${call.id}`,
        type: "call",
        action: isOutbound ? "outbound_call" : "inbound_call",
        title: isOutbound ? (t.customers.callHistory?.outgoingCall || "Outgoing Call") : (t.customers.callHistory?.incomingCall || "Incoming Call"),
        description,
        details: { 
          phoneNumber: call.phoneNumber,
          direction: call.direction,
          status: call.status,
          durationSeconds: call.durationSeconds,
          hungUpBy: call.hungUpBy,
          notes: call.notes,
          callerName,
        },
        createdAt: call.startedAt,
        userId: call.userId,
        icon: isOutbound ? PhoneOutgoing : PhoneIncoming,
        color: isOutbound ? "text-violet-500" : "text-cyan-500",
      });
    });

    return events;
  }, [activityLogs, documents, notes, messages, customerProducts, customerEmails, customerCallLogs, customerId, customerName, pipelineStages, products, users, t]);

  // Filter and sort events
  const filteredEvents = useMemo(() => {
    let filtered = timelineEvents.filter(event => {
      // Type filter
      if (filterType !== "all" && event.type !== filterType) {
        return false;
      }
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          event.title.toLowerCase().includes(query) ||
          event.description.toLowerCase().includes(query)
        );
      }
      return true;
    });
    
    // Sort events
    filtered.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
    });
    
    return filtered;
  }, [timelineEvents, filterType, searchQuery, sortOrder]);

  // Count events by type
  const eventCounts = useMemo(() => {
    const counts: Record<string, number> = { all: timelineEvents.length };
    timelineEvents.forEach(event => {
      counts[event.type] = (counts[event.type] || 0) + 1;
    });
    return counts;
  }, [timelineEvents]);

  // Group events by month
  const groupedEvents = useMemo(() => {
    const groups: Record<string, typeof filteredEvents> = {};
    filteredEvents.forEach(event => {
      const date = new Date(event.createdAt);
      const key = format(date, "MMMM yyyy", { locale: sk });
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(event);
    });
    return groups;
  }, [filteredEvents]);

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      toast({ title: "Dokument stiahnutý" });
    } catch (error) {
      toast({ title: "Nepodarilo sa stiahnuť dokument", variant: "destructive" });
    }
  };

  const renderFieldChanges = (details: any) => {
    if (!details) return null;
    
    // Check if we have old/new values for each field
    const oldVals = details.oldValues || {};
    const newVals = details.newValues || {};
    const hasValueDetails = Object.keys(oldVals).length > 0 || Object.keys(newVals).length > 0;
    
    if (hasValueDetails) {
      // Filter to only fields that have translations and actually changed
      const changedFields = Object.keys(newVals).filter(f => {
        const hasLabel = FIELD_LABELS[f];
        const actuallyChanged = oldVals[f] !== newVals[f];
        return hasLabel && actuallyChanged;
      });
      
      if (changedFields.length === 0) {
        // Fall through to show field names if no translated fields with actual changes
      } else {
        return (
          <div className="mt-2 space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Zmenené hodnoty:</p>
            <div className="space-y-1 bg-muted/30 rounded-md p-2">
              {changedFields.slice(0, 6).map((field: string) => {
                const oldVal = oldVals[field];
                const newVal = newVals[field];
                const displayOld = oldVal === null || oldVal === undefined || oldVal === "" ? "—" : String(oldVal);
                const displayNew = newVal === null || newVal === undefined || newVal === "" ? "—" : String(newVal);
                return (
                  <div key={field} className="flex items-center gap-2 text-xs flex-wrap">
                    <span className="font-medium min-w-[100px]">{FIELD_LABELS[field] || field}:</span>
                    <span className="text-red-600 dark:text-red-400 line-through">{displayOld}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-green-600 dark:text-green-400 font-medium">{displayNew}</span>
                  </div>
                );
              })}
              {changedFields.length > 6 && (
                <p className="text-xs text-muted-foreground">+{changedFields.length - 6} ďalších zmien</p>
              )}
            </div>
          </div>
        );
      }
    }
    
    // Fallback to just showing field names if no values available
    if (!details.changes || !Array.isArray(details.changes)) return null;
    
    const changedFields = details.changes.filter((f: string) => FIELD_LABELS[f]);
    if (changedFields.length === 0) return null;

    return (
      <div className="mt-2 space-y-1">
        <p className="text-xs font-medium text-muted-foreground">Zmenené polia:</p>
        <div className="flex flex-wrap gap-1">
          {changedFields.slice(0, 8).map((field: string) => (
            <Badge key={field} variant="outline" className="text-xs">
              {FIELD_LABELS[field] || field}
            </Badge>
          ))}
          {changedFields.length > 8 && (
            <Badge variant="outline" className="text-xs">
              +{changedFields.length - 8} ďalších
            </Badge>
          )}
        </div>
      </div>
    );
  };

  const isLoading = logsLoading || docsLoading || notesLoading || messagesLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sticky Header with Search, Sort and Filter Tiles */}
      <div className="sticky top-0 z-50 bg-background pb-4 space-y-3">
        {/* Search and Sort Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t.common?.search || "Search"}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-timeline-search"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
            className="gap-2"
            data-testid="button-timeline-sort"
          >
            <Clock className="h-4 w-4" />
            {sortOrder === "desc" ? (t.common?.newest || "Newest") : (t.common?.oldest || "Oldest")}
          </Button>
        </div>

        {/* Filter Tiles */}
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-12 gap-2">
        {TIMELINE_ACTION_TYPES.map((type) => {
          const count = eventCounts[type.value] || 0;
          const isActive = filterType === type.value;
          const TypeIcon = type.icon;
          const buttonClass = isActive ? type.activeClass : type.inactiveClass;
          const iconTextClass = isActive ? type.textColor : type.inactiveTextColor;
          const labelClass = isActive ? "text-white/90" : type.inactiveTextColor;
          const filterLabels: Record<string, string> = {
            all: t.common?.all || "All",
            update: t.customers.timeline?.filterData || "Data",
            document: t.customers.timeline?.filterDocuments || "Documents",
            note: t.customers.timeline?.filterNotes || "Notes",
            email: t.customers.timeline?.filterEmails || "Emails",
            call: t.customers.timeline?.filterCalls || "Calls",
            status: t.customers.timeline?.filterStatus || "Status",
            product: t.customers.timeline?.filterProducts || "Products",
            pipeline: t.customers.timeline?.filterPipeline || "Pipeline",
            consent: t.customers.timeline?.filterConsent || "Consent",
            campaign: t.customers.timeline?.filterCampaigns || "Campaigns",
          };
          return (
            <button
              key={type.value}
              onClick={() => setFilterType(type.value)}
              className={`p-2.5 rounded-xl border transition-all duration-200 cursor-pointer text-center ${buttonClass}`}
              data-testid={`button-filter-${type.value}`}
            >
              <TypeIcon className={`h-4 w-4 mx-auto mb-1 ${iconTextClass}`} />
              <p className={`text-lg font-bold ${iconTextClass}`}>{count}</p>
              <p className={`text-[10px] leading-tight font-medium ${labelClass}`}>{filterLabels[type.value] || type.label}</p>
            </button>
          );
        })}
        </div>
      </div>

      {/* Timeline */}
      {filteredEvents.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">{t.customers.timeline?.noRecords || "No Records"}</p>
          <p className="text-sm">{t.customers.timeline?.noRecordsDescription || "No activity records found for this customer"}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedEvents).map(([month, events]) => (
            <div key={month}>
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                  {month}
                </h3>
                <Badge variant="outline" className="text-xs">
                  {events.length}
                </Badge>
              </div>

              <div className="relative pl-6 border-l-2 border-muted space-y-4">
                {events.map((event, idx) => {
                  const Icon = event.icon;
                  return (
                    <div key={event.id} className="relative">
                      {/* Timeline dot */}
                      <div className={`absolute -left-[25px] w-4 h-4 rounded-full bg-background border-2 flex items-center justify-center ${getTimelineDotColors(event.color).border}`}>
                        <div className={`w-2 h-2 rounded-full ${getTimelineDotColors(event.color).bg}`} />
                      </div>

                      {/* Event card */}
                      <div className="ml-4 p-4 rounded-lg border bg-card hover-elevate transition-all">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1">
                            <div className={`p-2 rounded-lg bg-muted ${event.color}`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium">{event.title}</p>
                                {event.details?.status && (
                                  <Badge variant="outline" className="text-xs">
                                    {event.details.status}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground truncate">
                                {event.description}
                              </p>
                              
                              {/* Render field changes for updates */}
                              {event.action === "update" && renderFieldChanges(event.details)}

                              {/* Pipeline move details */}
                              {event.type === "pipeline" && event.details && (
                                <div className="mt-2 p-2 rounded-md bg-cyan-50 dark:bg-cyan-950/50 border border-cyan-200 dark:border-cyan-800 text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">{t.customers.timeline?.pipelineMove || "Pipeline Move"}:</span>
                                    <Badge variant="outline" className="bg-background">{event.details.fromStageName || (event.details.fromStageId ? getStageName(event.details.fromStageId) : "—")}</Badge>
                                    <ArrowRight className="h-3 w-3 text-cyan-500" />
                                    <Badge className="bg-cyan-600 text-white">{event.details.toStageName || (event.details.toStageId ? getStageName(event.details.toStageId) : "—")}</Badge>
                                  </div>
                                </div>
                              )}

                              {/* Product details */}
                              {event.type === "product" && event.details?.productId && (
                                <div className="mt-2 p-2 rounded-md bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-xs">
                                  <div className="flex items-center gap-2">
                                    <Package className="h-3.5 w-3.5 text-indigo-500" />
                                    <span className="font-medium">{getProductName(event.details.productId)}</span>
                                  </div>
                                </div>
                              )}

                              {/* Consent details */}
                              {event.type === "consent" && event.details && (
                                <div className={`mt-2 p-2 rounded-md text-xs ${
                                  event.action === "consent_granted" 
                                    ? "bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800" 
                                    : "bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800"
                                }`}>
                                  <div className="flex items-center gap-2">
                                    <Shield className={`h-3.5 w-3.5 ${event.action === "consent_granted" ? "text-green-500" : "text-red-500"}`} />
                                    <span className="font-medium">
                                      {event.details.consentType || event.details.consentName || "GDPR súhlas"}
                                    </span>
                                    {event.details.consentPurpose && (
                                      <span className="text-muted-foreground">- {event.details.consentPurpose}</span>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Status change details */}
                              {event.type === "status" && event.details && (event.details.oldStatus || event.details.newStatus) && (
                                <div className="mt-2 p-2 rounded-md bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-800 text-xs">
                                  <div className="flex items-center gap-2">
                                    <RefreshCw className="h-3.5 w-3.5 text-orange-500" />
                                    <span className="text-muted-foreground">Stav:</span>
                                    <Badge variant="outline" className="bg-background">{event.details.oldStatus || "—"}</Badge>
                                    <ArrowRight className="h-3 w-3 text-orange-500" />
                                    <Badge className="bg-orange-600 text-white">{event.details.newStatus || "—"}</Badge>
                                  </div>
                                </div>
                              )}

                              {/* Message details */}
                              {event.type === "message" && event.details && (
                                <div className="mt-2 p-2 rounded-md bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 text-xs space-y-1">
                                  <p><span className="font-medium">Príjemca:</span> {event.details.recipient}</p>
                                  {event.details.subject && (
                                    <p><span className="font-medium">Predmet:</span> {event.details.subject}</p>
                                  )}
                                  {event.details.content && (
                                    <p className="line-clamp-2 text-muted-foreground mt-1">{event.details.content}</p>
                                  )}
                                </div>
                              )}

                              {/* Note content */}
                              {event.type === "note" && event.details?.content && (
                                <div className="mt-2 p-2 rounded-md bg-yellow-50 dark:bg-yellow-950/50 border border-yellow-200 dark:border-yellow-800 text-xs">
                                  <p className="line-clamp-3 whitespace-pre-wrap">{event.details.content}</p>
                                </div>
                              )}

                              {/* Document details */}
                              {event.type === "document" && event.details && (
                                <div className="mt-2 p-2 rounded-md bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {event.details.templateName && (
                                      <span><span className="font-medium">Šablóna:</span> {event.details.templateName}</span>
                                    )}
                                    {event.details.status && (
                                      <Badge variant="outline" className="text-xs">{event.details.status}</Badge>
                                    )}
                                  </div>
                                </div>
                              )}

                              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <UserCircle className="h-3.5 w-3.5" />
                                  <span>{getUserName(event.userId || "")}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  <span>{format(new Date(event.createdAt), "d.M.yyyy HH:mm")}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Download button for documents */}
                          {event.downloadUrl && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownload(
                                event.downloadUrl!,
                                `${event.documentType}-${event.description}.pdf`
                              )}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              PDF
                            </Button>
                          )}

                          {/* View and Edit buttons for emails */}
                          {(event.type === "message" && (event.action === "email" || event.action === "email_sent")) && (
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setViewingEmail(event)}
                                title="Zobraziť email"
                                data-testid={`button-view-email-${event.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => {
                                  setEditingEmail(event);
                                  setEditEmailSubject(event.details?.subject || "");
                                  setEditEmailContent(event.details?.content || "");
                                }}
                                title="Upraviť záznam"
                                data-testid={`button-edit-email-${event.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Email Dialog */}
      <Dialog open={!!viewingEmail} onOpenChange={(open) => !open && setViewingEmail(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-500" />
              Detail emailu
            </DialogTitle>
          </DialogHeader>
          {viewingEmail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium text-muted-foreground">Príjemca</p>
                  <p>{viewingEmail.details?.to?.join(", ") || viewingEmail.details?.recipient || viewingEmail.entityName}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Dátum odoslania</p>
                  <p>{format(new Date(viewingEmail.createdAt), "d.M.yyyy HH:mm")}</p>
                </div>
                {viewingEmail.details?.from && (
                  <div>
                    <p className="font-medium text-muted-foreground">Odosielateľ</p>
                    <p>{viewingEmail.details.from}</p>
                  </div>
                )}
                {viewingEmail.details?.cc?.length > 0 && (
                  <div>
                    <p className="font-medium text-muted-foreground">Kópia (CC)</p>
                    <p>{viewingEmail.details.cc.join(", ")}</p>
                  </div>
                )}
              </div>
              <div>
                <p className="font-medium text-muted-foreground mb-1">Predmet</p>
                <p className="font-medium">{viewingEmail.details?.subject || viewingEmail.description}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground mb-1">Obsah</p>
                <div className="p-3 bg-muted/50 rounded-lg border whitespace-pre-wrap text-sm">
                  {viewingEmail.details?.content || "Bez obsahu"}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingEmail(null)}>
              Zavrieť
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Email Dialog */}
      <Dialog open={!!editingEmail} onOpenChange={(open) => !open && setEditingEmail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-blue-500" />
              Upraviť záznam emailu
            </DialogTitle>
          </DialogHeader>
          {editingEmail && (
            <div className="space-y-4">
              <div>
                <Label>Predmet</Label>
                <Input 
                  value={editEmailSubject}
                  onChange={(e) => setEditEmailSubject(e.target.value)}
                  data-testid="input-edit-email-subject"
                />
              </div>
              <div>
                <Label>Obsah</Label>
                <Textarea 
                  value={editEmailContent}
                  onChange={(e) => setEditEmailContent(e.target.value)}
                  rows={8}
                  className="resize-none"
                  data-testid="input-edit-email-content"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Poznámka: Úprava záznamu nemení už odoslaný email, len uloženú kópiu v histórii.
              </p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingEmail(null)}>
              Zrušiť
            </Button>
            <Button 
              onClick={async () => {
                if (!editingEmail) return;
                try {
                  // Update the message in database
                  const messageId = editingEmail.details?.messageId || editingEmail.id.replace("msg-", "");
                  await fetch(`/api/customers/${customerId}/messages/${messageId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                      subject: editEmailSubject,
                      content: editEmailContent,
                    }),
                  });
                  toast({ title: "Záznam emailu bol aktualizovaný" });
                  setEditingEmail(null);
                  // Refresh data
                  window.location.reload();
                } catch (error) {
                  toast({ title: "Nepodarilo sa aktualizovať záznam", variant: "destructive" });
                }
              }}
              data-testid="button-save-email-edit"
            >
              Uložiť zmeny
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CustomerDetailsContent({ 
  customer, 
  onEdit 
}: { 
  customer: Customer; 
  onEdit: () => void;
}) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  
  const getDateLocale = () => {
    switch (locale) {
      case 'sk': return sk;
      case 'cs': return cs;
      case 'hu': return hu;
      case 'ro': return ro;
      case 'it': return it;
      case 'de': return de;
      default: return enUS;
    }
  };
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedBillsetId, setSelectedBillsetId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("1");
  const [isInvoiceDetailOpen, setIsInvoiceDetailOpen] = useState(false);
  const [selectedInvoiceDetailProduct, setSelectedInvoiceDetailProduct] = useState<any>(null);
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
  const [isEmailPreviewOpen, setIsEmailPreviewOpen] = useState(false);
  const [selectedEmailRecipients, setSelectedEmailRecipients] = useState<string[]>([]);
  const [isEmailSending, setIsEmailSending] = useState(false);
  const [editingProductAssignment, setEditingProductAssignment] = useState<any>(null);
  const [editBillsetId, setEditBillsetId] = useState<string>("");
  const [selectedMailboxId, setSelectedMailboxId] = useState<string>("personal");
  
  const { user } = useAuth();

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  // Fetch billsets (product_sets) for the selected product, filtered by customer's country
  const { data: billsets = [], isLoading: billsetsLoading } = useQuery<Array<{ id: string; name: string; currency: string; countryCode: string | null; isActive: boolean; totalGrossAmount: string | null }>>({
    queryKey: ["/api/products", selectedProductId, "sets", customer.country],
    queryFn: async () => {
      if (!selectedProductId) return [];
      const res = await fetch(`/api/products/${selectedProductId}/sets?country=${customer.country}`, { credentials: "include" });
      if (!res.ok) return [];
      const sets = await res.json();
      // Only show active billsets
      return sets.filter((s: any) => s.isActive);
    },
    enabled: !!selectedProductId,
  });

  // Fetch invoice preview details for a product set
  const { data: billsetDetails } = useQuery<any>({
    queryKey: ["/api/product-sets", selectedInvoiceDetailProduct?.billsetId],
    queryFn: async () => {
      if (!selectedInvoiceDetailProduct?.billsetId) return null;
      const res = await fetch(`/api/product-sets/${selectedInvoiceDetailProduct.billsetId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedInvoiceDetailProduct?.billsetId && isInvoiceDetailOpen,
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
    refetchInterval: 10000,
  });

  // Customer email history - inbound and outbound emails
  const { data: customerEmails = [], isLoading: emailsLoading, isError: emailsError } = useQuery<CustomerEmailNotification[]>({
    queryKey: ["/api/customers", customer.id, "emails"],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${customer.id}/emails`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch customer emails");
      return res.json();
    },
    refetchInterval: 30000,
  });

  // Customer call logs - phone call history
  const { data: customerCallLogs = [], isLoading: callLogsLoading } = useQuery<Array<{
    id: string;
    userId: string;
    phoneNumber: string;
    direction: string;
    status: string;
    startedAt: string;
    answeredAt: string | null;
    endedAt: string | null;
    durationSeconds: number | null;
    notes: string | null;
    hungUpBy: string | null;
  }>>({
    queryKey: ["/api/customers", customer.id, "call-logs"],
    queryFn: async () => {
      const res = await fetch(`/api/call-logs?customerId=${customer.id}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: allUsers = [] } = useQuery<Array<{ id: string; username: string; firstName?: string; lastName?: string }>>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: availableMailboxes = [], isLoading: mailboxesLoading } = useQuery<AvailableMailbox[]>({
    queryKey: ["/api/users", user?.id, "ms365-available-mailboxes"],
    queryFn: async () => {
      if (!user?.id) return [];
      const res = await fetch(`/api/users/${user.id}/ms365-available-mailboxes`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user?.id,
  });

  const personalMailbox = availableMailboxes.find(m => m.type === "personal");
  const defaultSharedMailbox = availableMailboxes.find(m => m.isDefault && m.type === "shared");
  const defaultMailbox = defaultSharedMailbox || personalMailbox || availableMailboxes[0];
  const isMs365Connected = availableMailboxes.length > 0;
  
  useEffect(() => {
    if (availableMailboxes.length > 0 && !mailboxesLoading) {
      const isCurrentSelectionValid = 
        selectedMailboxId === "personal" && personalMailbox ||
        availableMailboxes.some(m => m.type === "shared" && (m.id === selectedMailboxId || m.email === selectedMailboxId));
      
      if (!isCurrentSelectionValid) {
        if (personalMailbox) {
          setSelectedMailboxId("personal");
        } else {
          const firstShared = availableMailboxes.find(m => m.type === "shared");
          if (firstShared) {
            setSelectedMailboxId(firstShared.id || firstShared.email);
          }
        }
      }
    }
  }, [availableMailboxes, mailboxesLoading]);

  const { data: pipelineStages = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/pipeline-stages"],
    queryFn: async () => {
      const res = await fetch("/api/pipeline-stages", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const getStageName = (stageId: string) => {
    const stage = pipelineStages.find(s => s.id === stageId);
    return stage?.name || stageId;
  };

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
      case "note_added":
      case "add_note":
      case "create_note":
        return <FileEdit className="h-4 w-4 text-amber-600" />;
      case "pipeline_move":
      case "stage_changed":
        return <ArrowRight className="h-4 w-4 text-cyan-600" />;
      case "campaign_joined":
        return <LogIn className="h-4 w-4 text-purple-600" />;
      case "campaign_left":
        return <LogOut className="h-4 w-4 text-purple-600" />;
      case "campaign_status_changed":
        return <ArrowRight className="h-4 w-4 text-indigo-600" />;
      case "campaign_note_added":
        return <FileEdit className="h-4 w-4 text-violet-600" />;
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
      pipeline_move: "Presun v pipeline",
      stage_changed: "Presun v pipeline",
      campaign_joined: "Pridanie do kampane",
      campaign_left: "Odstránenie z kampane",
      campaign_status_changed: "Zmena statusu v kampani",
      campaign_note_added: "Poznámka ku kampani",
      note_added: "Poznámka pridaná",
      add_note: "Poznámka pridaná",
      create_note: "Poznámka pridaná",
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
    
    if (action === "pipeline_move" || action === "stage_changed") {
      const fromStage = (details.fromStageName as string) || (details.fromStageId ? getStageName(details.fromStageId as string) : "—");
      const toStage = (details.toStageName as string) || (details.toStageId ? getStageName(details.toStageId as string) : "—");
      const dealTitle = details.dealTitle as string;
      return (
        <div className="mt-2 p-2 bg-muted rounded-md">
          <p className="text-sm font-medium">{dealTitle}</p>
          <div className="flex items-center gap-2 mt-1 text-xs">
            <Badge variant="outline" className="bg-background">{fromStage}</Badge>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <Badge className="bg-cyan-600 text-white">{toStage}</Badge>
          </div>
        </div>
      );
    }
    
    if (action === "campaign_joined" || action === "campaign_left") {
      const campaignName = (details.campaignName as string) || "Kampaň";
      return (
        <div className="mt-2 p-2 rounded-md bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 text-sm">
          <span className="text-muted-foreground">{action === "campaign_joined" ? "Pridaný do:" : "Odstránený z:"}</span>{" "}
          <strong>{campaignName}</strong>
        </div>
      );
    }

    if (action === "campaign_status_changed") {
      const campaignName = (details.campaignName as string) || "Kampaň";
      const previousStatus = (details.previousStatus as string) || "";
      const newStatus = (details.newStatus as string) || "";
      return (
        <div className="mt-2 p-2 rounded-md bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-sm">
          <div className="font-medium text-indigo-700 dark:text-indigo-300">{campaignName}</div>
          <div className="text-muted-foreground">
            Status: <span className="line-through">{previousStatus}</span> → <strong>{newStatus}</strong>
          </div>
          {details.notes && <div className="mt-1 text-xs italic">{details.notes as string}</div>}
        </div>
      );
    }

    if (action === "campaign_note_added") {
      const campaignName = (details.campaignName as string) || "Kampaň";
      const content = (details.content as string) || "";
      return (
        <div className="mt-2 p-2 rounded-md bg-violet-50 dark:bg-violet-950/50 border border-violet-200 dark:border-violet-800 text-sm">
          <div className="font-medium text-violet-700 dark:text-violet-300">{campaignName}</div>
          <p className="text-foreground whitespace-pre-wrap">{content}</p>
        </div>
      );
    }

    if (action === "note_added" || action === "add_note" || action === "create_note") {
      const noteContent = (details.content as string) || (details.noteContent as string) || "";
      return (
        <div className="mt-2 p-2 rounded-md bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-sm">
          <p className="text-foreground whitespace-pre-wrap">{noteContent || "—"}</p>
        </div>
      );
    }
    
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
    refetchInterval: 10000, // Auto-refresh every 10 seconds for new SMS/emails
  });

  const addProductMutation = useMutation({
    mutationFn: (data: { productId: string; billsetId: string; quantity: number }) =>
      apiRequest("POST", `/api/customers/${customer.id}/products`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customer.id, "products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setSelectedProductId("");
      setSelectedBillsetId("");
      setQuantity("1");
      toast({ title: t.customers.details?.productAdded || "Product added to customer" });
    },
    onError: () => {
      toast({ title: t.customers.details?.productAddFailed || "Failed to add product", variant: "destructive" });
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

  const updateProductMutation = useMutation({
    mutationFn: (data: { id: string; billsetId: string }) => 
      apiRequest("PATCH", `/api/customer-products/${data.id}`, { billsetId: data.billsetId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customer.id, "products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setEditingProductAssignment(null);
      setEditBillsetId("");
      toast({ title: t.customers.details?.productUpdated || "Product assignment updated" });
    },
    onError: () => {
      toast({ title: t.customers.details?.productUpdateFailed || "Failed to update product", variant: "destructive" });
    },
  });

  // Fetch billsets for editing product assignment
  const { data: editBillsets = [], isLoading: editBillsetsLoading } = useQuery<Array<{ id: string; name: string; currency: string; countryCode: string | null; isActive: boolean; totalGrossAmount: string | null }>>({
    queryKey: ["/api/products", editingProductAssignment?.productId, "sets", customer.country, "edit"],
    queryFn: async () => {
      if (!editingProductAssignment?.productId) return [];
      const res = await fetch(`/api/products/${editingProductAssignment.productId}/sets?country=${customer.country}`, { credentials: "include" });
      if (!res.ok) return [];
      const sets = await res.json();
      return sets.filter((s: any) => s.isActive);
    },
    enabled: !!editingProductAssignment?.productId,
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
    mutationFn: async (data: { subject: string; content: string; mailboxId?: string | null }) => {
      if (isMs365Connected) {
        return apiRequest("POST", "/api/ms365/send-email-from-mailbox", {
          to: customer.email,
          subject: data.subject,
          body: data.content,
          isHtml: false,
          mailboxId: data.mailboxId === "default" ? null : data.mailboxId,
          customerId: customer.id, // Log email to customer history
        });
      } else {
        return apiRequest("POST", `/api/customers/${customer.id}/messages/email`, {
          subject: data.subject,
          content: data.content,
        });
      }
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customer.id, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customer.id, "activity-logs"] });
      setEmailSubject("");
      setEmailContent("");
      const fromInfo = response.from ? ` z ${response.from}` : "";
      const message = response.simulated 
        ? "Email queued (demo mode - configure SendGrid for actual delivery)" 
        : `Email odoslaný${fromInfo}`;
      toast({ title: message });
    },
    onError: (error: any) => {
      const errorMsg = error?.message || "Failed to send email";
      toast({ title: errorMsg, variant: "destructive" });
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
    let mailboxId: string | null;
    if (selectedMailboxId === "default") {
      mailboxId = defaultMailbox?.type === "shared" ? (defaultMailbox?.id || null) : null;
    } else if (selectedMailboxId === "personal") {
      mailboxId = null;
    } else {
      mailboxId = selectedMailboxId;
    }
    sendEmailMutation.mutate({ 
      subject: emailSubject.trim(), 
      content: emailContent.trim(),
      mailboxId
    });
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
            <Badge
              variant="outline"
              className="cursor-pointer hover-elevate"
              onClick={() => {
                navigator.clipboard.writeText(customer.id);
                toast({ title: t.customers.fields.copiedToClipboard });
              }}
              data-testid="button-copy-detail-client-id"
            >
              <Copy className="h-3 w-3 mr-1" />
              {t.customers.fields.clientId}
            </Badge>
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
            <div className="flex items-center gap-2 mt-1">
              <span>{customer.phone || "-"}</span>
              {customer.phone && (
                <CallCustomerButton 
                  phoneNumber={customer.phone}
                  customerId={customer.id}
                  customerName={`${customer.firstName} ${customer.lastName}`}
                  leadScore={customer.leadScore}
                  clientStatus={customer.clientStatus}
                  variant="icon"
                />
              )}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">{t.customers.details?.serviceType || "Service Type"}</p>
            <p className="mt-1 capitalize">{customer.serviceType?.replace("_", " ") || "-"}</p>
          </div>
        </div>
      </div>

      <Separator />

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className={`grid w-full ${customer.clientStatus === "acquired" ? "grid-cols-8" : "grid-cols-7"}`}>
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
          <TabsTrigger value="documents" data-testid="tab-documents">
            <FileText className="h-4 w-4 mr-2" />
            Dokumenty
          </TabsTrigger>
          <TabsTrigger value="communicate" data-testid="tab-communicate">
            <Mail className="h-4 w-4 mr-2" />
            {t.customers.tabs.contact}
          </TabsTrigger>
          <TabsTrigger value="notes" data-testid="tab-notes">
            <MessageSquare className="h-4 w-4 mr-2" />
            {t.customers.tabs.notes}
          </TabsTrigger>
          <TabsTrigger value="gdpr" data-testid="tab-gdpr">
            <Shield className="h-4 w-4 mr-2" />
            {t.customers.tabs?.gdpr || "GDPR"}
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
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{getCountryFlag(customer.country)}</span>
                        <p className="font-medium text-sm">{cp.product.name}</p>
                        <Badge variant="outline" className="text-xs">{customer.country}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {cp.billsetName || (t.customers.details?.noBillset || "Bez zostavy")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {cp.billsetId && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedInvoiceDetailProduct(cp);
                            setIsInvoiceDetailOpen(true);
                          }}
                          data-testid={`button-invoice-detail-${cp.id}`}
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          {t.customers.details?.invoiceDetail || "Detail fakturácie"}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingProductAssignment(cp);
                          setEditBillsetId(cp.billsetId || "");
                        }}
                        data-testid={`button-edit-product-${cp.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
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
                  </div>
                ))}
              </div>
            )}

            {availableProducts.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label className="text-xs">{t.customers.details?.addProduct || "Add Product"}</Label>
                    <Select 
                      value={selectedProductId} 
                      onValueChange={(value) => {
                        setSelectedProductId(value);
                        setSelectedBillsetId("");
                      }}
                    >
                      <SelectTrigger data-testid="select-add-product">
                        <SelectValue placeholder={t.customers.details?.selectProduct || "Select product"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableProducts.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedProductId && (
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">{t.customers.details?.selectBillset || "Select Billset"}</Label>
                      <Select value={selectedBillsetId} onValueChange={setSelectedBillsetId}>
                        <SelectTrigger data-testid="select-add-billset">
                          <SelectValue placeholder={billsetsLoading ? (t.common?.loading || "Loading...") : (t.customers.details?.selectBillset || "Select billset")} />
                        </SelectTrigger>
                        <SelectContent>
                          {billsets.map((bs) => (
                            <SelectItem key={bs.id} value={bs.id}>
                              {bs.countryCode ? `${getCountryFlag(bs.countryCode)} [${bs.countryCode}]` : `[${t.common?.all || "All"}]`} {bs.name} - {bs.totalGrossAmount ? parseFloat(bs.totalGrossAmount).toFixed(2) : "0.00"} {bs.currency}
                            </SelectItem>
                          ))}
                          {billsets.length === 0 && !billsetsLoading && (
                            <SelectItem value="__no_billsets" disabled>
                              {t.customers.details?.noBillsets || "No billsets available"}
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      {selectedProductId && !billsetsLoading && billsets.length === 0 && (
                        <p className="text-xs text-destructive mt-1">
                          {t.customers.details?.noBillsetsForCountry || "No billsets configured for this product and country"}
                        </p>
                      )}
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
                        if (selectedProductId && selectedBillsetId && qty > 0) {
                          addProductMutation.mutate({ 
                            productId: selectedProductId, 
                            billsetId: selectedBillsetId,
                            quantity: qty 
                          });
                        } else {
                          toast({ 
                            title: t.customers.details?.productBillsetValidation || "Please select a product and billset with valid quantity", 
                            variant: "destructive" 
                          });
                        }
                      }}
                      disabled={!selectedProductId || !selectedBillsetId || !quantity || parseInt(quantity) < 1 || addProductMutation.isPending}
                      data-testid="button-add-product-to-customer"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
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
              {isMs365Connected && (
                <Badge variant="secondary" className="text-xs">MS365</Badge>
              )}
            </h4>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">{t.customers.details?.to || "To"}</Label>
                <Input value={customer.email} disabled className="bg-muted" data-testid="input-email-to" />
              </div>
              {isMs365Connected && availableMailboxes.length > 0 && (
                <div>
                  <Label className="text-xs">Odoslať z</Label>
                  <Select value={selectedMailboxId} onValueChange={setSelectedMailboxId}>
                    <SelectTrigger data-testid="select-email-from-mailbox">
                      <SelectValue placeholder="Vyberte schránku" />
                    </SelectTrigger>
                    <SelectContent>
                      {personalMailbox && (
                        <SelectItem value="personal">
                          {personalMailbox.displayName} ({personalMailbox.email}) [Osobná]
                        </SelectItem>
                      )}
                      {availableMailboxes.filter(m => m.type === "shared").map((mailbox) => (
                        <SelectItem key={mailbox.id || mailbox.email} value={mailbox.id || mailbox.email}>
                          {mailbox.displayName} ({mailbox.email}) [Zdieľaná]{mailbox.isDefault ? " (Predvolená)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {!isMs365Connected && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Pre odosielanie emailov cez Microsoft 365 si pripojte váš účet v nastaveniach používateľa.
                  </p>
                </div>
              )}
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
                  {sendEmailMutation.isPending ? (t.customers.details?.sending || "Odosielam...") : (t.customers.details?.sendEmail || "Odoslať email")}
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
            <h4 className="font-semibold flex items-center gap-2">
              <PhoneCall className="h-4 w-4" />
              {t.customers.details?.sipCall || "SIP Call"}
            </h4>
            {customer.phone ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {t.customers.details?.sipCallDescription || "Use SIP phone to call the customer directly. The call will be logged automatically."}
                </p>
                <CallCustomerButton 
                  phoneNumber={customer.phone}
                  customerId={customer.id}
                  customerName={`${customer.firstName} ${customer.lastName}`}
                  leadScore={customer.leadScore}
                  clientStatus={customer.clientStatus}
                />
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
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {msg.type === "email" ? (
                          <Mail className="h-4 w-4 text-primary" />
                        ) : msg.type === "sms" ? (
                          <MessageSquare className="h-4 w-4 text-cyan-600" />
                        ) : (
                          <Phone className="h-4 w-4 text-primary" />
                        )}
                        <span className="text-sm font-medium capitalize" data-testid={`message-type-${msg.id}`}>
                          {msg.type === "sms" ? "SMS" : msg.type}
                        </span>
                        {(msg as any).direction && (
                          <Badge variant="outline" className={`text-xs ${(msg as any).direction === "inbound" ? "text-cyan-600 border-cyan-400" : "text-emerald-600 border-emerald-400"}`}>
                            {(msg as any).direction === "inbound" ? "Prijatá" : "Odoslaná"}
                          </Badge>
                        )}
                        <Badge variant={msg.status === "sent" ? "default" : msg.status === "failed" ? "destructive" : "secondary"} className="text-xs" data-testid={`message-status-${msg.id}`}>
                          {msg.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            // View message detail - open in dialog or navigate to NEXUS
                            toast({
                              title: msg.type === "sms" ? "SMS správa" : "Email správa",
                              description: msg.content?.substring(0, 100) + (msg.content && msg.content.length > 100 ? "..." : ""),
                            });
                          }}
                          data-testid={`button-view-message-${msg.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {msg.type === "email" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              // Open compose with prefilled reply
                              setEmailSubject(`Re: ${msg.subject || ""}`);
                              setEmailContent("");
                            }}
                            data-testid={`button-reply-message-${msg.id}`}
                          >
                            <PenSquare className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
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

          {notesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : customerNotes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">{t.customers.details?.noNotes || "Žiadne poznámky"}</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
              
              <div className="space-y-6">
                {(() => {
                  const groupedNotes = customerNotes.reduce((groups, note) => {
                    const date = new Date(note.createdAt);
                    const key = format(date, "MMMM yyyy", { locale: sk });
                    if (!groups[key]) groups[key] = [];
                    groups[key].push(note);
                    return groups;
                  }, {} as Record<string, typeof customerNotes>);
                  
                  return Object.entries(groupedNotes).map(([monthYear, notes]) => (
                    <div key={monthYear}>
                      <div className="relative pl-10 mb-3">
                        <div className="absolute left-1.5 w-5 h-5 rounded-full bg-muted border-2 border-border flex items-center justify-center">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <h5 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                          {monthYear}
                        </h5>
                      </div>
                      
                      <div className="space-y-4">
                        {notes.map((note) => (
                          <div key={note.id} className="relative pl-10">
                            <div className="absolute left-2.5 w-3 h-3 rounded-full border-2 bg-amber-500 border-amber-500" />
                            
                            <div className="border rounded-lg p-4 bg-card">
                              <p className="text-sm">{note.content}</p>
                              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                {format(new Date(note.createdAt), "d.M.yyyy HH:mm")}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="documents" className="space-y-6 mt-4">
          <DocumentsTab customerId={customer.id} />
        </TabsContent>

        <TabsContent value="gdpr" className="space-y-6 mt-4">
          <GdprTab customerId={customer.id} />
        </TabsContent>

        <TabsContent value="history" className="space-y-4 mt-4">
          {/* Combined Activity and Email Logs Section */}
          {activityLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : activityLogs.length === 0 && customerEmails.length === 0 && customerCallLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">{t.activity?.noActivity || "Žiadna aktivita"}</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
              
              <div className="space-y-6">
                {(() => {
                  // Combine activity logs, emails and call logs into unified timeline
                  type TimelineItem = { 
                    id: string; 
                    type: 'log' | 'email' | 'call'; 
                    date: Date; 
                    data: any;
                  };
                  
                  const allItems: TimelineItem[] = [
                    ...activityLogs.map(log => ({
                      id: `log-${log.id}`,
                      type: 'log' as const,
                      date: new Date(log.createdAt),
                      data: log
                    })),
                    ...customerEmails.map(email => ({
                      id: `email-${email.id}`,
                      type: 'email' as const,
                      date: new Date(email.receivedAt),
                      data: email
                    })),
                    ...customerCallLogs.map(call => ({
                      id: `call-${call.id}`,
                      type: 'call' as const,
                      date: new Date(call.startedAt),
                      data: call
                    }))
                  ];
                  
                  // Sort by date descending
                  allItems.sort((a, b) => b.date.getTime() - a.date.getTime());
                  
                  // Group by month
                  const groupedItems = allItems.reduce((groups, item) => {
                    const key = format(item.date, "MMMM yyyy", { locale: getDateLocale() });
                    if (!groups[key]) groups[key] = [];
                    groups[key].push(item);
                    return groups;
                  }, {} as Record<string, TimelineItem[]>);
                  
                  return Object.entries(groupedItems).map(([monthYear, items]) => (
                    <div key={monthYear}>
                      <div className="relative pl-10 mb-3">
                        <div className="absolute left-1.5 w-5 h-5 rounded-full bg-muted border-2 border-border flex items-center justify-center">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <h5 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                          {monthYear}
                        </h5>
                      </div>
                      
                      <div className="space-y-4">
                        {items.map((item) => {
                          if (item.type === 'log') {
                            const log = item.data;
                            const details = parseDetails(log.details);
                            return (
                              <div key={item.id} className="relative pl-10">
                                <div className="absolute left-2.5 w-3 h-3 rounded-full border-2 bg-emerald-500 border-emerald-500" />
                                
                                <div className="border rounded-lg p-4 bg-card" data-testid={`activity-log-${log.id}`}>
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
                                          <span>{format(new Date(log.createdAt), "d.M.yyyy HH:mm:ss")}</span>
                                        </div>
                                      </div>
                                      
                                      {renderFieldChanges(details, log.action)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          } else if (item.type === 'email') {
                            const email = item.data as CustomerEmailNotification;
                            const isOutbound = email.direction === "outbound";
                            return (
                              <div key={item.id} className="relative pl-10">
                                <div className={`absolute left-2.5 w-3 h-3 rounded-full border-2 ${
                                  isOutbound ? "bg-blue-500 border-blue-500" : "bg-green-500 border-green-500"
                                }`} />
                                
                                <div className={`border rounded-lg p-4 bg-card ${
                                  isOutbound ? "border-l-4 border-l-blue-500" : "border-l-4 border-l-green-500"
                                }`} data-testid={`activity-email-${email.id}`}>
                                  <div className="flex items-start gap-3">
                                    <div className={`flex-shrink-0 mt-0.5 p-2 rounded-full ${
                                      isOutbound ? "bg-blue-100 dark:bg-blue-900" : "bg-green-100 dark:bg-green-900"
                                    }`}>
                                      {isOutbound ? (
                                        <ArrowUpRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                      ) : (
                                        <ArrowDownLeft className="h-4 w-4 text-green-600 dark:text-green-400" />
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-medium text-sm">
                                          {isOutbound ? "Odoslaný email" : "Prijatý email"}
                                        </span>
                                        <Badge variant={isOutbound ? "default" : "secondary"} className="text-xs">
                                          {isOutbound ? "odchádzajúci" : "prichádzajúci"}
                                        </Badge>
                                      </div>
                                      
                                      <p className="text-sm font-medium mt-1">{email.subject || "(bez predmetu)"}</p>
                                      
                                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                                        <div className="flex items-center gap-1">
                                          {isOutbound ? (
                                            <><span>Komu:</span><span>{email.recipientEmail}</span></>
                                          ) : (
                                            <><span>Od:</span><span>{email.senderEmail}</span></>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <Clock className="h-3.5 w-3.5" />
                                          <span>{format(new Date(email.receivedAt), "d.M.yyyy HH:mm")}</span>
                                        </div>
                                      </div>
                                      
                                      {email.bodyPreview && (
                                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                                          {email.bodyPreview}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          } else if (item.type === 'call') {
                            const call = item.data;
                            const caller = allUsers.find(u => u.id === call.userId);
                            const callerName = caller 
                              ? `${caller.firstName || ''} ${caller.lastName || ''}`.trim() || caller.username
                              : t.customers.callHistory?.unknownUser || "Unknown";
                            const duration = call.durationSeconds 
                              ? `${Math.floor(call.durationSeconds / 60)}:${String(call.durationSeconds % 60).padStart(2, '0')}`
                              : "-";
                            const isOutbound = call.direction === "outbound";
                            const statusColors: Record<string, string> = {
                              completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
                              answered: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
                              failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
                              no_answer: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
                              busy: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
                              cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
                              initiated: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
                              ringing: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
                            };
                            const statusLabels: Record<string, string> = {
                              completed: t.customers.callHistory?.statusCompleted || "Completed",
                              answered: t.customers.callHistory?.statusAnswered || "Answered",
                              failed: t.customers.callHistory?.statusFailed || "Failed",
                              no_answer: t.customers.callHistory?.statusNoAnswer || "No Answer",
                              busy: t.customers.callHistory?.statusBusy || "Busy",
                              cancelled: t.customers.callHistory?.statusCancelled || "Cancelled",
                              initiated: t.customers.callHistory?.statusInitiated || "Initiated",
                              ringing: t.customers.callHistory?.statusRinging || "Ringing",
                            };
                            const hungUpLabels: Record<string, string> = {
                              customer: t.customers.callHistory?.hungUpByCustomer || "Customer hung up",
                              user: t.customers.callHistory?.hungUpByUser || "User hung up",
                            };
                            return (
                              <div key={item.id} className="relative pl-10">
                                <div className={`absolute left-2.5 w-3 h-3 rounded-full border-2 ${
                                  isOutbound ? "bg-violet-500 border-violet-500" : "bg-cyan-500 border-cyan-500"
                                }`} />
                                
                                <div className="border rounded-lg p-4 bg-card" data-testid={`call-log-${call.id}`}>
                                  <div className="flex items-start gap-3">
                                    <div className={`flex-shrink-0 mt-0.5 p-2 rounded-full ${
                                      isOutbound ? "bg-violet-100 dark:bg-violet-900" : "bg-cyan-100 dark:bg-cyan-900"
                                    }`}>
                                      <Phone className={`h-4 w-4 ${isOutbound ? "text-violet-600 dark:text-violet-400" : "text-cyan-600 dark:text-cyan-400"}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-medium text-sm">
                                          {isOutbound 
                                            ? (t.customers.callHistory?.outgoingCall || "Outgoing Call")
                                            : (t.customers.callHistory?.incomingCall || "Incoming Call")}
                                        </span>
                                        <Badge className={`text-xs ${statusColors[call.status] || "bg-gray-100 text-gray-800"}`}>
                                          {statusLabels[call.status] || call.status}
                                        </Badge>
                                        {call.hungUpBy && (
                                          <Badge variant="outline" className="text-xs">
                                            {hungUpLabels[call.hungUpBy] || call.hungUpBy}
                                          </Badge>
                                        )}
                                      </div>
                                      
                                      <p className="text-sm font-medium mt-1">{call.phoneNumber}</p>
                                      
                                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                                        <div className="flex items-center gap-1">
                                          <UserCircle className="h-3.5 w-3.5" />
                                          <span>{callerName}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <Clock className="h-3.5 w-3.5" />
                                          <span>{format(new Date(call.startedAt), "d.M.yyyy HH:mm", { locale: getDateLocale() })}</span>
                                        </div>
                                        <div className="flex items-center gap-1 font-mono">
                                          <span>{t.customers.callHistory?.duration || "Duration"}:</span>
                                          <span className="font-semibold">{duration}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Separator />

      <div className="flex gap-2 flex-wrap">
        <Button
          variant="outline"
          onClick={onEdit}
          data-testid="button-edit-from-view"
        >
          <Pencil className="h-4 w-4 mr-2" />
          {t.customers.details?.editCustomer || "Edit Customer"}
        </Button>
        <Button
          variant="outline"
          asChild
          data-testid="button-create-contract-from-view"
        >
          <Link href={`/contracts?customerId=${customer.id}&action=new`}>
            <FileSignature className="h-4 w-4 mr-2" />
            {t.customers.details?.createContract || "Vytvoriť zmluvu"}
          </Link>
        </Button>
        <Button
          variant="outline"
          onClick={() => setIsManualInvoiceOpen(true)}
          data-testid="button-create-invoice-from-view"
        >
          <Receipt className="h-4 w-4 mr-2" />
          {t.customers.details?.createInvoice || "Vytvoriť faktúru"}
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

      {/* Invoice Detail Dialog */}
      <Dialog open={isInvoiceDetailOpen} onOpenChange={setIsInvoiceDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.customers.details?.invoiceDetail || "Detail fakturácie"}</DialogTitle>
            <DialogDescription>
              {selectedInvoiceDetailProduct?.product?.name} - {t.konfigurator?.invoicePreviewTitle || "Náhľad faktúry"}
            </DialogDescription>
          </DialogHeader>

          {billsetDetails ? (
            <div className="space-y-6">
              {/* Billset Header */}
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h4 className="font-semibold">{billsetDetails.name}</h4>
                  <Badge variant={billsetDetails.isActive ? "default" : "secondary"}>
                    {billsetDetails.isActive ? t.konfigurator?.activeLabel || "Aktívny" : t.konfigurator?.inactiveLabel || "Neaktívny"}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {billsetDetails.countryCode && (
                    <Badge variant="outline">{getCountryFlag(billsetDetails.countryCode)} {billsetDetails.countryCode}</Badge>
                  )}
                  <Badge variant="outline">{billsetDetails.currency}</Badge>
                  {billsetDetails.fromDate && (
                    <span>{t.konfigurator?.validFrom || "Od"}: {format(new Date(billsetDetails.fromDate), "dd.MM.yyyy")}</span>
                  )}
                  {billsetDetails.toDate && (
                    <span>{t.konfigurator?.validTo || "Do"}: {format(new Date(billsetDetails.toDate), "dd.MM.yyyy")}</span>
                  )}
                </div>
              </div>

              {/* Invoice Line Items - Same format as configurator */}
              {(() => {
                const currencySymbol = billsetDetails.currency === "EUR" ? "€" : 
                                       billsetDetails.currency === "CZK" ? "Kč" : 
                                       billsetDetails.currency === "USD" ? "$" : billsetDetails.currency;
                
                // Calculate totals
                let totalNet = 0;
                let totalDiscount = 0;
                let totalVat = 0;
                let totalGross = 0;
                
                (billsetDetails.collections || []).forEach((col: any) => {
                  const lineNetAfterDiscount = parseFloat(col.lineNetAmount || 0);
                  const lineDiscount = parseFloat(col.lineDiscountAmount || 0);
                  const lineNetBeforeDiscount = lineNetAfterDiscount + lineDiscount;
                  const lineVat = parseFloat(col.lineVatAmount || 0);
                  const lineGross = parseFloat(col.lineGrossAmount || 0);
                  totalNet += lineNetBeforeDiscount;
                  totalDiscount += lineDiscount;
                  totalVat += lineVat;
                  totalGross += lineGross;
                });
                
                (billsetDetails.storage || []).forEach((stor: any) => {
                  const lineNetAfterDiscount = parseFloat(stor.lineNetAmount || stor.priceOverride || 0);
                  const lineDiscount = parseFloat(stor.lineDiscountAmount || 0);
                  const lineNetBeforeDiscount = lineNetAfterDiscount + lineDiscount;
                  const lineVat = parseFloat(stor.lineVatAmount || 0);
                  const lineGross = parseFloat(stor.lineGrossAmount || stor.priceOverride || 0);
                  totalNet += lineNetBeforeDiscount;
                  totalDiscount += lineDiscount;
                  totalVat += lineVat;
                  totalGross += lineGross;
                });
                
                return (
                  <>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">{t.konfigurator?.lineItemsLabel || "Položky"}</Label>
                      
                      {/* Collection Items - Blue */}
                      {(billsetDetails.collections || []).map((col: any, idx: number) => {
                        const lineNetAfterDiscount = parseFloat(col.lineNetAmount || 0);
                        const lineDiscount = parseFloat(col.lineDiscountAmount || 0);
                        const lineNetBeforeDiscount = lineNetAfterDiscount + lineDiscount;
                        const lineVat = parseFloat(col.lineVatAmount || 0);
                        const lineGross = parseFloat(col.lineGrossAmount || 0);
                        return (
                          <div key={col.id} className="py-1.5 px-2 rounded bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-400 mb-1">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                {idx + 1}. {t.konfigurator?.collectionItem || "Odber"} {col.quantity > 1 && `(${col.quantity}x)`}
                              </span>
                              {col.instanceName && (
                                <span className="text-xs text-blue-700 dark:text-blue-300 font-normal">{col.instanceName}</span>
                              )}
                            </div>
                            <div className="mt-1 space-y-0.5 text-xs text-blue-700 dark:text-blue-300">
                              <div className="flex justify-between">
                                <span>{t.konfigurator?.priceWithoutVat || "Cena bez DPH"}:</span>
                                <span className="font-mono">{lineNetBeforeDiscount.toFixed(2)} {currencySymbol}</span>
                              </div>
                              {lineDiscount > 0 && (
                                <div className="flex justify-between text-amber-600 dark:text-amber-400">
                                  <span>{t.konfigurator?.discountText || "Zľava"}:</span>
                                  <span className="font-mono">-{lineDiscount.toFixed(2)} {currencySymbol}</span>
                                </div>
                              )}
                              {lineVat > 0 && (
                                <div className="flex justify-between">
                                  <span>{t.konfigurator?.vatValue || "DPH"}:</span>
                                  <span className="font-mono">+{lineVat.toFixed(2)} {currencySymbol}</span>
                                </div>
                              )}
                              <div className="flex justify-between font-medium pt-0.5 border-t border-blue-200 dark:border-blue-700">
                                <span>{t.konfigurator?.totalLabel || "Celkom"}:</span>
                                <span className="font-mono">{lineGross.toFixed(2)} {currencySymbol}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      
                      {/* Storage Items - Green */}
                      {(billsetDetails.storage || []).map((stor: any, idx: number) => {
                        const lineNetAfterDiscount = parseFloat(stor.lineNetAmount || stor.priceOverride || 0);
                        const lineDiscount = parseFloat(stor.lineDiscountAmount || 0);
                        const lineNetBeforeDiscount = lineNetAfterDiscount + lineDiscount;
                        const lineVat = parseFloat(stor.lineVatAmount || 0);
                        const lineGross = parseFloat(stor.lineGrossAmount || stor.priceOverride || 0);
                        return (
                          <div key={stor.id} className="py-1.5 px-2 rounded bg-green-50 dark:bg-green-900/20 border-l-2 border-green-400 mb-1">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-sm font-medium text-green-900 dark:text-green-100">
                                {(billsetDetails.collections?.length || 0) + idx + 1}. {t.konfigurator?.storageItem || "Uskladnenie"}
                              </span>
                              {stor.serviceName && (
                                <span className="text-xs text-green-700 dark:text-green-300 font-normal">{stor.serviceName}</span>
                              )}
                            </div>
                            <div className="mt-1 space-y-0.5 text-xs text-green-700 dark:text-green-300">
                              <div className="flex justify-between">
                                <span>{t.konfigurator?.priceWithoutVat || "Cena bez DPH"}:</span>
                                <span className="font-mono">{lineNetBeforeDiscount.toFixed(2)} {currencySymbol}</span>
                              </div>
                              {lineDiscount > 0 && (
                                <div className="flex justify-between text-amber-600 dark:text-amber-400">
                                  <span>{t.konfigurator?.discountText || "Zľava"}:</span>
                                  <span className="font-mono">-{lineDiscount.toFixed(2)} {currencySymbol}</span>
                                </div>
                              )}
                              {lineVat > 0 && (
                                <div className="flex justify-between">
                                  <span>{t.konfigurator?.vatValue || "DPH"}:</span>
                                  <span className="font-mono">+{lineVat.toFixed(2)} {currencySymbol}</span>
                                </div>
                              )}
                              <div className="flex justify-between font-medium pt-0.5 border-t border-green-200 dark:border-green-700">
                                <span>{t.konfigurator?.totalLabel || "Celkom"}:</span>
                                <span className="font-mono">{lineGross.toFixed(2)} {currencySymbol}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      
                      {(billsetDetails.collections || []).length === 0 && (billsetDetails.storage || []).length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">{t.konfigurator?.noItemsInSet || "Žiadne položky"}</p>
                      )}
                    </div>
                    
                    <Separator />
                    
                    {/* Totals Summary */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>{t.konfigurator?.netWithoutVat || "Cena bez DPH"}:</span>
                        <span className="font-mono">{totalNet.toFixed(2)} {currencySymbol}</span>
                      </div>
                      {totalDiscount > 0 && (
                        <div className="flex justify-between text-sm text-amber-600 dark:text-amber-400">
                          <span>{t.konfigurator?.discountText || "Zľava"}:</span>
                          <span className="font-mono">-{totalDiscount.toFixed(2)} {currencySymbol}</span>
                        </div>
                      )}
                      {totalDiscount > 0 && (
                        <div className="flex justify-between text-sm font-medium">
                          <span>{t.konfigurator?.subtotalAfterDiscount || "Medzisúčet po zľave"}:</span>
                          <span className="font-mono">{(totalNet - totalDiscount).toFixed(2)} {currencySymbol}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>{t.konfigurator?.vatText || "DPH"}:</span>
                        <span className="font-mono">+{totalVat.toFixed(2)} {currencySymbol}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-medium">
                        <span>{t.konfigurator?.totalLabel || "Celkom"}:</span>
                        <span className="font-mono text-lg">{totalGross.toFixed(2)} {currencySymbol}</span>
                      </div>
                    </div>
                    
                    {/* Installments Breakdown */}
                    {(billsetDetails.collections || []).some((col: any) => col.paymentOptionId) && (
                      <>
                        <Separator />
                        <div className="space-y-3">
                          <Label className="text-xs text-muted-foreground">{t.konfigurator?.paymentBreakdown || "Rozpis splátok"}</Label>
                          {(() => {
                            const storageTotal = (billsetDetails.storage || []).reduce((sum: number, stor: any) => {
                              return sum + parseFloat(stor.lineGrossAmount || stor.priceOverride || 0);
                            }, 0);
                            
                            const collectionsWithPayment = (billsetDetails.collections || []).filter((col: any) => col.paymentOptionId);
                            let storageAlreadyAdded = false;
                            
                            return collectionsWithPayment.map((col: any, idx: number) => {
                              const lineGross = parseFloat(col.lineGrossAmount || 0);
                              const includeStorage = storageTotal > 0 && !storageAlreadyAdded;
                              if (includeStorage) {
                                storageAlreadyAdded = true;
                              }
                              const combinedAmount = includeStorage ? lineGross + storageTotal : lineGross;
                              
                              return (
                                <InvoicePaymentBreakdownItem
                                  key={col.id}
                                  instanceId={col.instanceId}
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
                  </>
                );
              })()}

              {billsetDetails.notes && (
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-sm text-muted-foreground">{billsetDetails.notes}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {t.common?.loading || "Načítavam..."}
            </div>
          )}

          <DialogFooter className="flex-wrap gap-2">
            <Button 
              variant="default" 
              onClick={() => {
                const emails: string[] = [];
                if (customer.email) emails.push(customer.email);
                if (customer.email2) emails.push(customer.email2);
                setSelectedEmailRecipients(emails.length > 0 ? [emails[0]] : []);
                setIsEmailPreviewOpen(true);
              }}
              disabled={!customer.email && !customer.email2}
              data-testid="button-send-invoice-email"
            >
              <Mail className="w-4 h-4 mr-2" />
              {t.customers?.details?.sendEmail || "Odoslať emailom"}
            </Button>
            <Button variant="outline" onClick={() => setIsInvoiceDetailOpen(false)}>
              {t.common?.close || "Zavrieť"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Email Preview Dialog */}
      <Dialog open={isEmailPreviewOpen} onOpenChange={setIsEmailPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.customers?.details?.emailPreview || "Náhľad emailu"}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Recipient Selection */}
            <div className="space-y-2">
              <Label>{t.customers?.details?.selectRecipients || "Vyberte príjemcov"}</Label>
              <div className="space-y-2">
                {customer.email && (
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="email1"
                      checked={selectedEmailRecipients.includes(customer.email)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedEmailRecipients(prev => [...prev, customer.email]);
                        } else {
                          setSelectedEmailRecipients(prev => prev.filter(em => em !== customer.email));
                        }
                      }}
                      className="rounded"
                    />
                    <Label htmlFor="email1" className="font-normal">{customer.email}</Label>
                  </div>
                )}
                {customer.email2 && (
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="email2"
                      checked={selectedEmailRecipients.includes(customer.email2)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedEmailRecipients(prev => [...prev, customer.email2!]);
                        } else {
                          setSelectedEmailRecipients(prev => prev.filter(em => em !== customer.email2));
                        }
                      }}
                      className="rounded"
                    />
                    <Label htmlFor="email2" className="font-normal">{customer.email2}</Label>
                  </div>
                )}
              </div>
            </div>
            
            <Separator />
            
            {/* Email Preview - Complete version matching invoice detail */}
            <div className="space-y-2">
              <Label>{t.customers?.details?.emailPreviewLabel || "Náhľad obsahu"}</Label>
              {billsetDetails && (
                <div className="border rounded-lg p-4 bg-white dark:bg-gray-900 text-sm space-y-4">
                  {/* Header */}
                  <div className="border-b pb-4">
                    <h3 className="font-bold text-lg">{t.customers?.details?.invoiceCalculation || "Kalkulácia faktúry"}</h3>
                    <p className="text-muted-foreground text-xs">{t.customers?.details?.billingSet || "Zostava"}: {billsetDetails.name}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant="outline">{billsetDetails.currency}</Badge>
                      {billsetDetails.countryCode && (
                        <Badge variant="outline">{getCountryFlag(billsetDetails.countryCode)} {billsetDetails.countryCode}</Badge>
                      )}
                    </div>
                  </div>
                  
                  {/* Complete Line Items with all details */}
                  {(() => {
                    const currencySymbol = billsetDetails.currency === "EUR" ? "€" : 
                                           billsetDetails.currency === "CZK" ? "Kč" : 
                                           billsetDetails.currency === "USD" ? "$" : billsetDetails.currency;
                    
                    let totalNet = 0;
                    let totalDiscount = 0;
                    let totalVat = 0;
                    let totalGross = 0;
                    
                    (billsetDetails.collections || []).forEach((col: any) => {
                      const lineNetAfterDiscount = parseFloat(col.lineNetAmount || 0);
                      const lineDiscount = parseFloat(col.lineDiscountAmount || 0);
                      const lineNetBeforeDiscount = lineNetAfterDiscount + lineDiscount;
                      const lineVat = parseFloat(col.lineVatAmount || 0);
                      const lineGross = parseFloat(col.lineGrossAmount || 0);
                      totalNet += lineNetBeforeDiscount;
                      totalDiscount += lineDiscount;
                      totalVat += lineVat;
                      totalGross += lineGross;
                    });
                    
                    (billsetDetails.storage || []).forEach((stor: any) => {
                      const lineNetAfterDiscount = parseFloat(stor.lineNetAmount || stor.priceOverride || 0);
                      const lineDiscount = parseFloat(stor.lineDiscountAmount || 0);
                      const lineNetBeforeDiscount = lineNetAfterDiscount + lineDiscount;
                      const lineVat = parseFloat(stor.lineVatAmount || 0);
                      const lineGross = parseFloat(stor.lineGrossAmount || stor.priceOverride || 0);
                      totalNet += lineNetBeforeDiscount;
                      totalDiscount += lineDiscount;
                      totalVat += lineVat;
                      totalGross += lineGross;
                    });
                    
                    return (
                      <>
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">{t.konfigurator?.lineItemsLabel || "Položky"}</Label>
                          
                          {/* Collection Items - Blue */}
                          {(billsetDetails.collections || []).map((col: any, idx: number) => {
                            const lineNetAfterDiscount = parseFloat(col.lineNetAmount || 0);
                            const lineDiscount = parseFloat(col.lineDiscountAmount || 0);
                            const lineNetBeforeDiscount = lineNetAfterDiscount + lineDiscount;
                            const lineVat = parseFloat(col.lineVatAmount || 0);
                            const lineGross = parseFloat(col.lineGrossAmount || 0);
                            return (
                              <div key={col.id} className="py-1.5 px-2 rounded bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-400 mb-1">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                    {idx + 1}. {t.konfigurator?.collectionItem || "Odber"} {col.quantity > 1 && `(${col.quantity}x)`}
                                  </span>
                                  {col.instanceName && (
                                    <span className="text-xs text-blue-700 dark:text-blue-300 font-normal">{col.instanceName}</span>
                                  )}
                                </div>
                                <div className="mt-1 space-y-0.5 text-xs text-blue-700 dark:text-blue-300">
                                  <div className="flex justify-between">
                                    <span>{t.konfigurator?.priceWithoutVat || "Cena bez DPH"}:</span>
                                    <span className="font-mono">{lineNetBeforeDiscount.toFixed(2)} {currencySymbol}</span>
                                  </div>
                                  {lineDiscount > 0 && (
                                    <div className="flex justify-between text-amber-600 dark:text-amber-400">
                                      <span>{t.konfigurator?.discountText || "Zľava"}:</span>
                                      <span className="font-mono">-{lineDiscount.toFixed(2)} {currencySymbol}</span>
                                    </div>
                                  )}
                                  {lineVat > 0 && (
                                    <div className="flex justify-between">
                                      <span>{t.konfigurator?.vatValue || "DPH"}:</span>
                                      <span className="font-mono">+{lineVat.toFixed(2)} {currencySymbol}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between font-medium pt-0.5 border-t border-blue-200 dark:border-blue-700">
                                    <span>{t.konfigurator?.totalLabel || "Celkom"}:</span>
                                    <span className="font-mono">{lineGross.toFixed(2)} {currencySymbol}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          
                          {/* Storage Items - Green */}
                          {(billsetDetails.storage || []).map((stor: any, idx: number) => {
                            const lineNetAfterDiscount = parseFloat(stor.lineNetAmount || stor.priceOverride || 0);
                            const lineDiscount = parseFloat(stor.lineDiscountAmount || 0);
                            const lineNetBeforeDiscount = lineNetAfterDiscount + lineDiscount;
                            const lineVat = parseFloat(stor.lineVatAmount || 0);
                            const lineGross = parseFloat(stor.lineGrossAmount || stor.priceOverride || 0);
                            return (
                              <div key={stor.id} className="py-1.5 px-2 rounded bg-green-50 dark:bg-green-900/20 border-l-2 border-green-400 mb-1">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-sm font-medium text-green-900 dark:text-green-100">
                                    {(billsetDetails.collections?.length || 0) + idx + 1}. {t.konfigurator?.storageItem || "Uskladnenie"}
                                  </span>
                                  {stor.serviceName && (
                                    <span className="text-xs text-green-700 dark:text-green-300 font-normal">{stor.serviceName}</span>
                                  )}
                                </div>
                                <div className="mt-1 space-y-0.5 text-xs text-green-700 dark:text-green-300">
                                  <div className="flex justify-between">
                                    <span>{t.konfigurator?.priceWithoutVat || "Cena bez DPH"}:</span>
                                    <span className="font-mono">{lineNetBeforeDiscount.toFixed(2)} {currencySymbol}</span>
                                  </div>
                                  {lineDiscount > 0 && (
                                    <div className="flex justify-between text-amber-600 dark:text-amber-400">
                                      <span>{t.konfigurator?.discountText || "Zľava"}:</span>
                                      <span className="font-mono">-{lineDiscount.toFixed(2)} {currencySymbol}</span>
                                    </div>
                                  )}
                                  {lineVat > 0 && (
                                    <div className="flex justify-between">
                                      <span>{t.konfigurator?.vatValue || "DPH"}:</span>
                                      <span className="font-mono">+{lineVat.toFixed(2)} {currencySymbol}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between font-medium pt-0.5 border-t border-green-200 dark:border-green-700">
                                    <span>{t.konfigurator?.totalLabel || "Celkom"}:</span>
                                    <span className="font-mono">{lineGross.toFixed(2)} {currencySymbol}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        
                        <Separator />
                        
                        {/* Totals Summary */}
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>{t.konfigurator?.netWithoutVat || "Cena bez DPH"}:</span>
                            <span className="font-mono">{totalNet.toFixed(2)} {currencySymbol}</span>
                          </div>
                          {totalDiscount > 0 && (
                            <div className="flex justify-between text-sm text-amber-600 dark:text-amber-400">
                              <span>{t.konfigurator?.discountText || "Zľava"}:</span>
                              <span className="font-mono">-{totalDiscount.toFixed(2)} {currencySymbol}</span>
                            </div>
                          )}
                          {totalDiscount > 0 && (
                            <div className="flex justify-between text-sm font-medium">
                              <span>{t.konfigurator?.subtotalAfterDiscount || "Medzisúčet po zľave"}:</span>
                              <span className="font-mono">{(totalNet - totalDiscount).toFixed(2)} {currencySymbol}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm text-muted-foreground">
                            <span>{t.konfigurator?.vatText || "DPH"}:</span>
                            <span className="font-mono">+{totalVat.toFixed(2)} {currencySymbol}</span>
                          </div>
                          <Separator />
                          <div className="flex justify-between font-medium">
                            <span>{t.konfigurator?.totalLabel || "Celkom"}:</span>
                            <span className="font-mono text-lg">{totalGross.toFixed(2)} {currencySymbol}</span>
                          </div>
                        </div>
                        
                        {/* Payment Installments Breakdown */}
                        {(billsetDetails.collections || []).some((col: any) => col.paymentOptionId) && (
                          <>
                            <Separator />
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">{t.konfigurator?.paymentBreakdown || "Rozpis splátok"}</Label>
                              {(() => {
                                const storageTotal = (billsetDetails.storage || []).reduce((sum: number, stor: any) => {
                                  return sum + parseFloat(stor.lineGrossAmount || stor.priceOverride || 0);
                                }, 0);
                                
                                const collectionsWithPayment = (billsetDetails.collections || []).filter((col: any) => col.paymentOptionId);
                                let storageAlreadyAdded = false;
                                
                                return collectionsWithPayment.map((col: any, idx: number) => {
                                  const lineGross = parseFloat(col.lineGrossAmount || 0);
                                  const includeStorage = storageTotal > 0 && !storageAlreadyAdded;
                                  if (includeStorage) {
                                    storageAlreadyAdded = true;
                                  }
                                  const combinedAmount = includeStorage ? lineGross + storageTotal : lineGross;
                                  
                                  return (
                                    <EmailPaymentBreakdownItem
                                      key={col.id}
                                      instanceId={col.instanceId}
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
                      </>
                    );
                  })()}
                  
                  {billsetDetails.notes && (
                    <div className="p-2 rounded bg-muted/30 mt-2">
                      <p className="text-xs text-muted-foreground">{billsetDetails.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEmailPreviewOpen(false)}>
              {t.common?.cancel || "Zrušiť"}
            </Button>
            <Button 
              disabled={selectedEmailRecipients.length === 0 || isEmailSending}
              onClick={async () => {
                setIsEmailSending(true);
                try {
                  const res = await fetch("/api/send-invoice-email", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                      customerId: customer.id,
                      billsetId: selectedInvoiceDetailProduct?.billsetId,
                      recipients: selectedEmailRecipients,
                    }),
                  });
                  if (res.ok) {
                    toast({
                      title: t.customers?.details?.emailSent || "Email odoslaný",
                      description: t.customers?.details?.emailSentDesc || "Kalkulácia bola úspešne odoslaná",
                    });
                    setIsEmailPreviewOpen(false);
                  } else {
                    const err = await res.json();
                    toast({
                      title: t.common?.error || "Chyba",
                      description: err.error || t.customers?.details?.emailFailed || "Nepodarilo sa odoslať email",
                      variant: "destructive",
                    });
                  }
                } catch (error) {
                  toast({
                    title: t.common?.error || "Chyba",
                    description: t.customers?.details?.emailFailed || "Nepodarilo sa odoslať email",
                    variant: "destructive",
                  });
                } finally {
                  setIsEmailSending(false);
                }
              }}
              data-testid="button-confirm-send-email"
            >
              {isEmailSending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t.common?.sending || "Odosielam..."}
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  {t.customers?.details?.sendEmail || "Odoslať"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Product Assignment Dialog */}
      <Dialog open={!!editingProductAssignment} onOpenChange={(open) => {
        if (!open) {
          setEditingProductAssignment(null);
          setEditBillsetId("");
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.customers?.details?.editProductAssignment || "Upraviť priradenie produktu"}</DialogTitle>
          </DialogHeader>
          
          {editingProductAssignment && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t.customers?.details?.product || "Produkt"}</Label>
                <div className="p-2 bg-muted rounded-md text-sm font-medium">
                  {editingProductAssignment.product?.name || "Unknown product"}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>{t.customers?.details?.selectBillset || "Vyberte zostavu"}</Label>
                <Select value={editBillsetId} onValueChange={setEditBillsetId}>
                  <SelectTrigger data-testid="select-edit-billset">
                    <SelectValue placeholder={editBillsetsLoading ? (t.common?.loading || "Načítavam...") : (t.customers?.details?.selectBillset || "Vyberte zostavu")} />
                  </SelectTrigger>
                  <SelectContent>
                    {editBillsets.map((bs) => (
                      <SelectItem key={bs.id} value={bs.id}>
                        {bs.countryCode ? `${getCountryFlag(bs.countryCode)} [${bs.countryCode}]` : `[${t.common?.all || "Všetky"}]`} {bs.name} - {bs.totalGrossAmount ? parseFloat(bs.totalGrossAmount).toFixed(2) : "0.00"} {bs.currency}
                      </SelectItem>
                    ))}
                    {editBillsets.length === 0 && !editBillsetsLoading && (
                      <SelectItem value="__no_billsets" disabled>
                        {t.customers?.details?.noBillsets || "Žiadne zostavy"}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              {editingProductAssignment.billsetName && (
                <p className="text-xs text-muted-foreground">
                  {t.customers?.details?.currentBillset || "Aktuálna zostava"}: {editingProductAssignment.billsetName}
                </p>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditingProductAssignment(null);
              setEditBillsetId("");
            }}>
              {t.common?.cancel || "Zrušiť"}
            </Button>
            <Button 
              onClick={() => {
                if (editingProductAssignment && editBillsetId) {
                  updateProductMutation.mutate({
                    id: editingProductAssignment.id,
                    billsetId: editBillsetId
                  });
                }
              }}
              disabled={!editBillsetId || updateProductMutation.isPending}
              data-testid="button-save-product-assignment"
            >
              {updateProductMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t.common?.saving || "Ukladám..."}
                </>
              ) : (
                t.common?.save || "Uložiť"
              )}
            </Button>
          </DialogFooter>
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
  const [pendingViewCustomerId, setPendingViewCustomerId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 30;
  
  // Sorting
  const [sortField, setSortField] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const { data: allCustomers = [], isLoading, refetch: refetchCustomers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Handle URL parameter for viewing customer detail (from email-client link)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const viewId = urlParams.get("view");
    if (viewId) {
      setPendingViewCustomerId(viewId);
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Open customer view when data is loaded (from deep-link or email client)
  useEffect(() => {
    if (pendingViewCustomerId && allCustomers.length > 0 && !isLoading) {
      // Search in ALL customers, not filtered list - so country filter doesn't block navigation
      const customer = allCustomers.find(c => c.id === pendingViewCustomerId);
      if (customer) {
        setViewingCustomer(customer);
      } else {
        // Customer not found - show feedback
        toast({
          title: "Zákazník nenájdený",
          description: "Požadovaný zákazník nebol nájdený v systéme.",
          variant: "destructive"
        });
      }
      setPendingViewCustomerId(null);
    }
  }, [pendingViewCustomerId, allCustomers, isLoading, toast]);

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

  // Filtered and sorted customers
  const filteredAndSortedCustomers = useMemo(() => {
    // First filter
    let result = customers.filter(customer => {
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
      
      const matchesPhone = phoneFilter === "" || 
        (customer.phone && customer.phone.toLowerCase().includes(phoneFilter.toLowerCase()));
      const matchesCountry = countryFilter === "_all" || customer.country === countryFilter;
      const matchesServiceType = serviceTypeFilter === "_all" || customer.serviceType === serviceTypeFilter;
      const matchesStatus = statusFilter === "_all" || customer.status === statusFilter;
      const matchesClientStatus = clientStatusFilter === "_all" || customer.clientStatus === clientStatusFilter;
      
      return matchesSearch && matchesPhone && matchesCountry && matchesServiceType && matchesStatus && matchesClientStatus;
    });
    
    // Then sort
    result.sort((a, b) => {
      let aVal: any;
      let bVal: any;
      
      switch (sortField) {
        case "name":
          aVal = `${a.firstName} ${a.lastName}`.toLowerCase();
          bVal = `${b.firstName} ${b.lastName}`.toLowerCase();
          break;
        case "country":
          aVal = a.country;
          bVal = b.country;
          break;
        case "service":
          aVal = (a.serviceType || "").toLowerCase();
          bVal = (b.serviceType || "").toLowerCase();
          break;
        case "status":
          aVal = (a.status || "").toLowerCase();
          bVal = (b.status || "").toLowerCase();
          break;
        case "clientStatus":
          aVal = (a.clientStatus || "").toLowerCase();
          bVal = (b.clientStatus || "").toLowerCase();
          break;
        case "leadScore":
          aVal = a.leadScore || 0;
          bVal = b.leadScore || 0;
          break;
        default:
          aVal = `${a.firstName} ${a.lastName}`.toLowerCase();
          bVal = `${b.firstName} ${b.lastName}`.toLowerCase();
      }
      
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    
    return result;
  }, [customers, search, phoneFilter, countryFilter, serviceTypeFilter, statusFilter, clientStatusFilter, sortField, sortDirection]);
  
  const totalPages = Math.ceil(filteredAndSortedCustomers.length / pageSize);
  const paginatedCustomers = filteredAndSortedCustomers.slice(
    (page - 1) * pageSize,
    page * pageSize
  );
  
  const handleFilterChange = () => {
    setPage(1);
  };
  
  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setPage(1);
  };
  
  const clearAllFilters = () => {
    setSearch("");
    setPhoneFilter("");
    setCountryFilter("_all");
    setServiceTypeFilter("_all");
    setStatusFilter("_all");
    setClientStatusFilter("_all");
    setPage(1);
  };
  
  const hasActiveFilters = search || phoneFilter || countryFilter !== "_all" || serviceTypeFilter !== "_all" || statusFilter !== "_all" || clientStatusFilter !== "_all";

  // Export functions
  const exportToCsv = useCallback((data: any[], filename: string, columns: { key: string; header: string }[]) => {
    const BOM = '\uFEFF';
    const headers = columns.map(c => c.header).join(',');
    const rows = data.map(item => 
      columns.map(c => {
        const value = c.key.split('.').reduce((obj, key) => obj?.[key], item) ?? '';
        const stringValue = String(value).replace(/"/g, '""');
        return `"${stringValue}"`;
      }).join(',')
    );
    const csv = BOM + [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
    toast({ title: t.common.exportSuccess });
  }, [t, toast]);

  const exportToExcel = useCallback((data: any[], filename: string, columns: { key: string; header: string }[]) => {
    const headers = columns.map(c => c.header);
    const rows = data.map(item => 
      columns.map(c => {
        const value = c.key.split('.').reduce((obj, key) => obj?.[key], item) ?? '';
        return String(value);
      })
    );
    
    let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body><table>';
    html += '<tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr>';
    rows.forEach(row => {
      html += '<tr>' + row.map(cell => `<td>${cell}</td>`).join('') + '</tr>';
    });
    html += '</table></body></html>';
    
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.xls`;
    link.click();
    toast({ title: t.common.exportSuccess });
  }, [t, toast]);

  const customerExportColumns = [
    { key: 'firstName', header: t.customers.firstName },
    { key: 'lastName', header: t.customers.lastName },
    { key: 'email', header: t.common.email },
    { key: 'phone', header: t.customers.phone },
    { key: 'country', header: t.common.country },
    { key: 'serviceType', header: t.customers.serviceType },
    { key: 'status', header: t.common.status },
    { key: 'clientStatus', header: t.customers.clientStatus },
    { key: 'city', header: t.customers.city },
  ];

  const SortableHeader = ({ field, label }: { field: string; label: string }) => (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2 font-medium"
      onClick={() => toggleSort(field)}
      data-testid={`sort-customer-${field}`}
    >
      {label}
      {sortField === field ? (
        sortDirection === "asc" ? (
          <ArrowUp className="ml-1 h-3 w-3" />
        ) : (
          <ArrowDown className="ml-1 h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
      )}
    </Button>
  );
  
  const getServiceTypeLabel = (type: string) => {
    switch (type) {
      case "cord_blood": return t.customers.serviceTypes?.cordBlood;
      case "cord_tissue": return t.customers.serviceTypes?.cordTissue;
      case "both": return t.customers.serviceTypes?.both;
      default: return t.common.unknown;
    }
  };
  
  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active": return t.common.active;
      case "pending": return t.common.pending;
      case "inactive": return t.common.inactive;
      default: return t.common.unknown;
    }
  };
  
  const getClientStatusLabel = (status: string) => {
    switch (status) {
      case "potential": return t.customers.clientStatuses?.potential;
      case "acquired": return t.customers.clientStatuses?.acquired;
      case "terminated": return t.customers.clientStatuses?.terminated;
      default: return t.common.unknown;
    }
  };

  const columns = [
    {
      key: "customer",
      header: <SortableHeader field="name" label={t.common.name} />,
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
      header: <SortableHeader field="country" label={t.common.country} />,
      cell: (customer: Customer) => (
        <span className="flex items-center gap-2">
          <span className="text-lg">{getCountryFlag(customer.country)}</span>
          <span>{getCountryName(customer.country)}</span>
        </span>
      ),
    },
    {
      key: "service",
      header: <SortableHeader field="service" label={t.customers.serviceType} />,
      cell: (customer: Customer) => (
        <Badge variant="outline" className="capitalize">
          {customer.serviceType?.replace("_", " ") || t.common.none}
        </Badge>
      ),
    },
    {
      key: "status",
      header: <SortableHeader field="status" label={t.common.status} />,
      cell: (customer: Customer) => (
        <StatusBadge status={customer.status as any} />
      ),
    },
    {
      key: "clientStatus",
      header: <SortableHeader field="clientStatus" label={t.customers.clientStatus} />,
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
      header: <SortableHeader field="leadScore" label={t.leadScoring?.title} />,
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
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {customer.phone && (
            <CallCustomerButton 
              phoneNumber={customer.phone}
              customerId={customer.id}
              customerName={`${customer.firstName} ${customer.lastName}`}
              leadScore={customer.leadScore}
              clientStatus={customer.clientStatus}
              variant="icon"
            />
          )}
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
          <Button onClick={() => setIsFormOpen(true)} data-testid="button-add-customer" data-tour="add-customer">
            <Plus className="h-4 w-4 mr-2" />
            {t.customers.addCustomer}
          </Button>
        )}
      </PageHeader>

      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            {/* Header with count and export buttons */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {filteredAndSortedCustomers.length} {t.common.of} {allCustomers.length} {t.common.records}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportToCsv(filteredAndSortedCustomers, 'customers', customerExportColumns)}
                  data-testid="button-export-customers-csv"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {t.common.exportCsv}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportToExcel(filteredAndSortedCustomers, 'customers', customerExportColumns)}
                  data-testid="button-export-customers-excel"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  {t.common.exportExcel}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchCustomers()}
                  data-testid="button-refresh-customers"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {t.common.refresh}
                </Button>
              </div>
            </div>

            {/* Search and filter toggle */}
            <div className="flex flex-wrap items-center gap-4" data-tour="customer-search">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t.customers.searchPlaceholder}
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); handleFilterChange(); }}
                  className="pl-9"
                  data-testid="input-search-customers"
                />
              </div>
              <div className="relative min-w-[150px]">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t.customers.phone}
                  value={phoneFilter}
                  onChange={(e) => { setPhoneFilter(e.target.value); handleFilterChange(); }}
                  className="pl-9"
                  data-testid="input-filter-phone"
                />
              </div>
              <Button
                variant={showFilters ? "default" : "outline"}
                onClick={() => setShowFilters(!showFilters)}
                data-testid="button-toggle-filters"
              >
                <Filter className="h-4 w-4 mr-2" />
                {t.common.filter}
                {hasActiveFilters && (
                  <span className="ml-2 h-2 w-2 bg-primary rounded-full inline-block" />
                )}
              </Button>
            </div>

            {/* Collapsible filters */}
            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4" data-tour="customer-filters">
                <div className="space-y-2">
                  <Label>{t.common.country}</Label>
                  <Select value={countryFilter} onValueChange={(val) => { setCountryFilter(val); handleFilterChange(); }}>
                    <SelectTrigger data-testid="select-filter-country">
                      <SelectValue placeholder={t.common.all} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">{t.common.all}</SelectItem>
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
                <div className="space-y-2">
                  <Label>{t.customers.serviceType}</Label>
                  <Select value={serviceTypeFilter} onValueChange={(val) => { setServiceTypeFilter(val); handleFilterChange(); }}>
                    <SelectTrigger data-testid="select-filter-service-type">
                      <SelectValue placeholder={t.common.all} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">{t.common.all}</SelectItem>
                      <SelectItem value="cord_blood">{t.customers.serviceTypes?.cordBlood}</SelectItem>
                      <SelectItem value="cord_tissue">{t.customers.serviceTypes?.cordTissue}</SelectItem>
                      <SelectItem value="both">{t.customers.serviceTypes?.both}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t.common.status}</Label>
                  <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); handleFilterChange(); }}>
                    <SelectTrigger data-testid="select-filter-status">
                      <SelectValue placeholder={t.common.all} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">{t.common.all}</SelectItem>
                      <SelectItem value="active">{t.common.active}</SelectItem>
                      <SelectItem value="pending">{t.common.pending}</SelectItem>
                      <SelectItem value="inactive">{t.common.inactive}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t.customers.clientStatus}</Label>
                  <Select value={clientStatusFilter} onValueChange={(val) => { setClientStatusFilter(val); handleFilterChange(); }}>
                    <SelectTrigger data-testid="select-filter-client-status">
                      <SelectValue placeholder={t.common.all} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">{t.common.all}</SelectItem>
                      <SelectItem value="potential">{t.customers.clientStatuses?.potential}</SelectItem>
                      <SelectItem value="acquired">{t.customers.clientStatuses?.acquired}</SelectItem>
                      <SelectItem value="terminated">{t.customers.clientStatuses?.terminated}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
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
                      handleFilterChange();
                    }}
                    onClear={clearAllFilters}
                  />
                </div>
              </div>
            )}

            {/* Active filters badges */}
            {hasActiveFilters && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">{t.common.activeFilters}:</span>
                {countryFilter !== "_all" && (
                  <Badge variant="secondary" className="gap-1">
                    {getCountryFlag(countryFilter)} {getCountryName(countryFilter)}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => { setCountryFilter("_all"); handleFilterChange(); }} />
                  </Badge>
                )}
                {serviceTypeFilter !== "_all" && (
                  <Badge variant="secondary" className="gap-1">
                    {getServiceTypeLabel(serviceTypeFilter)}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => { setServiceTypeFilter("_all"); handleFilterChange(); }} />
                  </Badge>
                )}
                {statusFilter !== "_all" && (
                  <Badge variant="secondary" className="gap-1">
                    {getStatusLabel(statusFilter)}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => { setStatusFilter("_all"); handleFilterChange(); }} />
                  </Badge>
                )}
                {clientStatusFilter !== "_all" && (
                  <Badge variant="secondary" className="gap-1">
                    {getClientStatusLabel(clientStatusFilter)}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => { setClientStatusFilter("_all"); handleFilterChange(); }} />
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  data-testid="button-clear-filters"
                >
                  {t.common.clearAll}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <DataTable
            columns={columns}
            data={paginatedCustomers}
            isLoading={isLoading}
            emptyMessage={t.customers.noCustomers}
            getRowKey={(c) => c.id}
          />
          
          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                {t.common.showing} {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, filteredAndSortedCustomers.length)} {t.common.of} {filteredAndSortedCustomers.length}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  data-testid="button-customer-first-page"
                >
                  {t.common.first}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  data-testid="button-customer-prev-page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm px-2">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                  data-testid="button-customer-next-page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  data-testid="button-customer-last-page"
                >
                  {t.common.last}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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

      <Sheet open={!!editingCustomer} onOpenChange={() => setEditingCustomer(null)}>
        <SheetContent 
          side="right" 
          className="!w-full !max-w-none sm:!max-w-3xl lg:!max-w-4xl xl:!max-w-5xl !p-0 flex flex-col overflow-hidden border-l shadow-2xl"
        >
          {editingCustomer && (
            <>
              <div className="sticky top-0 z-[999] bg-gradient-to-r from-primary/10 via-primary/5 to-background border-b px-6 py-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 ring-2 ring-primary/20">
                    <UserCircle className="h-8 w-8 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-semibold tracking-tight truncate" data-testid="text-customer-drawer-name">
                      {editingCustomer.firstName} {editingCustomer.lastName}
                    </h2>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs" data-testid="badge-customer-drawer-country">
                        {getCountryFlag(editingCustomer.country)} {editingCustomer.country}
                      </Badge>
                      <StatusBadge status={editingCustomer.status} />
                      {editingCustomer.phone && (
                        <span className="text-sm text-muted-foreground flex items-center gap-1" data-testid="text-customer-drawer-phone">
                          <Phone className="h-3 w-3" />
                          {editingCustomer.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <Tabs defaultValue="data" className="flex-1 flex flex-col overflow-hidden">
                <div className="px-6 pt-4 pb-2 border-b bg-background/80 backdrop-blur-sm">
                  <TabsList className="grid w-full grid-cols-2 h-11">
                    <TabsTrigger value="data" className="flex items-center gap-2">
                      <FileEdit className="h-4 w-4" />
                      <span className="hidden sm:inline">{t.customers.tabs?.data || "Data"}</span>
                    </TabsTrigger>
                    <TabsTrigger value="history" className="flex items-center gap-2">
                      <History className="h-4 w-4" />
                      <span className="hidden sm:inline">{t.customers.tabs?.history || "History"}</span>
                    </TabsTrigger>
                  </TabsList>
                </div>
                
                <TabsContent value="data" className="flex-1 overflow-y-auto px-6 py-4 m-0">
                  <CustomerForm
                    initialData={editingCustomer}
                    onSubmit={(data) => updateMutation.mutate({ ...data, id: editingCustomer.id })}
                    isLoading={updateMutation.isPending}
                    onCancel={() => setEditingCustomer(null)}
                  />
                </TabsContent>
                
                <TabsContent value="history" className="flex-1 overflow-y-auto px-6 py-4 m-0">
                  <CustomerHistoryTimeline customerId={editingCustomer.id} customerName={`${editingCustomer.firstName} ${editingCustomer.lastName}`} />
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>

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
