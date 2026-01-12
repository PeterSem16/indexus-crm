import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Search, Eye, Package, FileText, Download, Calculator, MessageSquare, History, Send, Mail, Phone, PhoneCall, Baby, Copy, ListChecks, FileEdit, UserCircle, Clock, PlusCircle, RefreshCw, XCircle, LogIn, LogOut, AlertCircle, CheckCircle2, ArrowRight, Shield, CreditCard, Loader2, Calendar, Globe, Linkedin, Facebook, Twitter, Instagram, Building2, ExternalLink, Sparkles } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getCountryFlag, getCountryName } from "@/lib/countries";
import type { Customer, Product, CustomerProduct, Invoice, BillingDetails, CustomerNote, ActivityLog, CommunicationMessage, CustomerPotentialCase, MarketProductInstance } from "@shared/schema";
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
import { sk } from "date-fns/locale";

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
  const [isWebSearchOpen, setIsWebSearchOpen] = useState(false);
  const [webSearchResults, setWebSearchResults] = useState<any>(null);
  const [isWebSearchLoading, setIsWebSearchLoading] = useState(false);

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

  const handleWebSearch = async () => {
    setIsWebSearchLoading(true);
    setWebSearchResults(null);
    try {
      const response = await apiRequest("POST", `/api/customers/${customer.id}/web-search`, {});
      setWebSearchResults(response);
    } catch (error) {
      toast({ title: "Nepodarilo sa vyhľadať informácie", variant: "destructive" });
    } finally {
      setIsWebSearchLoading(false);
    }
  };

  const getPlatformIcon = (platform: string) => {
    const p = platform.toLowerCase();
    if (p.includes("linkedin")) return <Linkedin className="h-4 w-4 text-blue-600" />;
    if (p.includes("facebook")) return <Facebook className="h-4 w-4 text-blue-500" />;
    if (p.includes("twitter") || p.includes("x")) return <Twitter className="h-4 w-4" />;
    if (p.includes("instagram")) return <Instagram className="h-4 w-4 text-pink-500" />;
    return <Globe className="h-4 w-4" />;
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
            <Badge
              variant="secondary"
              className="cursor-pointer hover-elevate"
              onClick={() => {
                setIsWebSearchOpen(true);
                if (!webSearchResults) {
                  handleWebSearch();
                }
              }}
              data-testid="button-web-search"
            >
              <Sparkles className="h-3 w-3 mr-1" />
              AI Vyhľadávanie
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
        <TabsList className={`grid w-full ${customer.clientStatus === "acquired" ? "grid-cols-7" : "grid-cols-6"}`}>
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
          {activityLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : activityLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">{t.activity?.noActivity || "Žiadna aktivita"}</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
              
              <div className="space-y-6">
                {(() => {
                  const groupedLogs = activityLogs.reduce((groups, log) => {
                    const date = new Date(log.createdAt);
                    const key = format(date, "MMMM yyyy", { locale: sk });
                    if (!groups[key]) groups[key] = [];
                    groups[key].push(log);
                    return groups;
                  }, {} as Record<string, typeof activityLogs>);
                  
                  return Object.entries(groupedLogs).map(([monthYear, logs]) => (
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
                        {logs.map((log) => {
                          const details = parseDetails(log.details);
                          return (
                            <div key={log.id} className="relative pl-10">
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

      <Sheet open={isWebSearchOpen} onOpenChange={setIsWebSearchOpen}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Vyhľadávanie - {customer.firstName} {customer.lastName}
            </SheetTitle>
            <SheetDescription>
              Informácie nájdené na webe a sociálnych sieťach
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 space-y-6">
            {isWebSearchLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-sm text-muted-foreground">Vyhľadávam informácie...</p>
              </div>
            ) : webSearchResults?.results ? (
              <>
                {webSearchResults.results.summary && (
                  <div className="p-4 rounded-lg bg-muted/50 border">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Zhrnutie
                    </h4>
                    <p className="text-sm text-muted-foreground">{webSearchResults.results.summary}</p>
                  </div>
                )}

                {webSearchResults.results.profiles && webSearchResults.results.profiles.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Sociálne siete
                    </h4>
                    <div className="space-y-2">
                      {webSearchResults.results.profiles.map((profile: any, idx: number) => {
                        const hasUrl = profile.url && profile.url !== "Not found" && profile.url !== "null" && !profile.url.includes("Not found");
                        return (
                          <div key={idx} className="p-3 rounded-lg border bg-card flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              {getPlatformIcon(profile.platform)}
                              <div>
                                <p className="font-medium text-sm">{profile.platform}</p>
                                <p className="text-xs text-muted-foreground">{profile.description}</p>
                              </div>
                            </div>
                            {hasUrl ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => window.open(profile.url, "_blank")}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                Nenájdené
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {webSearchResults.results.professional && (
                  <div className="space-y-3">
                    <h4 className="font-medium flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Profesionálne informácie
                    </h4>
                    <div className="p-3 rounded-lg border bg-card space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-muted-foreground">Spoločnosť:</span>
                        <span className="text-sm font-medium">
                          {webSearchResults.results.professional.company && 
                           webSearchResults.results.professional.company !== "Not found" && 
                           webSearchResults.results.professional.company !== "null" 
                            ? webSearchResults.results.professional.company 
                            : <Badge variant="outline" className="text-xs">Nenájdené</Badge>}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-muted-foreground">Pozícia:</span>
                        <span className="text-sm font-medium">
                          {webSearchResults.results.professional.position && 
                           webSearchResults.results.professional.position !== "Not found" && 
                           webSearchResults.results.professional.position !== "null" 
                            ? webSearchResults.results.professional.position 
                            : <Badge variant="outline" className="text-xs">Nenájdené</Badge>}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-muted-foreground">Odvetvie:</span>
                        <span className="text-sm font-medium">
                          {webSearchResults.results.professional.industry && 
                           webSearchResults.results.professional.industry !== "Not found" && 
                           webSearchResults.results.professional.industry !== "null" 
                            ? webSearchResults.results.professional.industry 
                            : <Badge variant="outline" className="text-xs">Nenájdené</Badge>}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {webSearchResults.results.mentions && webSearchResults.results.mentions.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Zmienky na webe
                    </h4>
                    <div className="space-y-2">
                      {webSearchResults.results.mentions.map((mention: any, idx: number) => (
                        <div key={idx} className="p-3 rounded-lg border bg-card flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-sm">{mention.source}</p>
                            <p className="text-xs text-muted-foreground">{mention.description}</p>
                          </div>
                          {mention.url && mention.url !== "Not found" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => window.open(mention.url, "_blank")}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {webSearchResults.results.confidence && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Spoľahlivosť:</span>
                    <Badge variant={webSearchResults.results.confidence === "high" ? "default" : webSearchResults.results.confidence === "medium" ? "secondary" : "outline"}>
                      {webSearchResults.results.confidence === "high" ? "Vysoká" : webSearchResults.results.confidence === "medium" ? "Stredná" : "Nízka"}
                    </Badge>
                  </div>
                )}

                {webSearchResults.results.disclaimer && (
                  <p className="text-xs text-muted-foreground italic">{webSearchResults.results.disclaimer}</p>
                )}

                <div className="pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={handleWebSearch}
                    disabled={isWebSearchLoading}
                    className="w-full"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isWebSearchLoading ? "animate-spin" : ""}`} />
                    Vyhľadať znova
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  Vyhľadané: {webSearchResults.searchedAt ? format(new Date(webSearchResults.searchedAt), "d.M.yyyy HH:mm") : "-"}
                </p>
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Globe className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">Žiadne výsledky</p>
                <Button
                  variant="outline"
                  onClick={handleWebSearch}
                  className="mt-4"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Spustiť vyhľadávanie
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

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
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {customer.phone && (
            <CallCustomerButton 
              phoneNumber={customer.phone}
              customerId={customer.id}
              customerName={`${customer.firstName} ${customer.lastName}`}
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
            <div className="flex flex-wrap items-center gap-4" data-tour="customer-search">
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
            <div className="flex flex-wrap items-center gap-4" data-tour="customer-filters">
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
