import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { PageHeader } from "@/components/page-header";
import { useI18n } from "@/i18n";
import { format } from "date-fns";
import { sk, cs, hu, ro, it, de, enUS, type Locale } from "date-fns/locale";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { ArrowLeft, Save, FileText, Users, Package, Beaker, Receipt, Loader2, Download, ExternalLink, Shield, Clock, Mail, CheckCircle, Send, Eye, AlertCircle, X, Edit, History, Phone } from "lucide-react";
import type { ContractInstance, Customer, Hospital, Collection, Product, CustomerProduct } from "@shared/schema";

const COUNTRY_LOCALE_MAP: Record<string, Locale> = {
  SK: sk, CZ: cs, HU: hu, RO: ro, IT: it, DE: de, US: enUS
};

const COUNTRY_DATE_FORMAT: Record<string, string> = {
  SK: "dd.MM.yyyy HH:mm", CZ: "dd.MM.yyyy HH:mm", HU: "yyyy.MM.dd HH:mm",
  RO: "dd.MM.yyyy HH:mm", IT: "dd/MM/yyyy HH:mm", DE: "dd.MM.yyyy HH:mm", US: "MM/dd/yyyy hh:mm a"
};

const COUNTRY_DATE_ONLY_FORMAT: Record<string, string> = {
  SK: "dd.MM.yyyy", CZ: "dd.MM.yyyy", HU: "yyyy.MM.dd",
  RO: "dd.MM.yyyy", IT: "dd/MM/yyyy", DE: "dd.MM.yyyy", US: "MM/dd/yyyy"
};

const SALES_CHANNEL_OPTIONS = ["CCP", "CCP+D", "CCAI", "CCAI+D", "CCAE", "CCAE+D", "I"];

const formatDateTimeForInput = (date: string | Date | null | undefined) => {
  if (!date) return "";
  const d = new Date(date);
  return d.toISOString().slice(0, 16);
};

const formatDateForInput = (date: string | Date | null | undefined) => {
  if (!date) return "";
  const d = new Date(date);
  return d.toISOString().slice(0, 10);
};

const formatDate = (date: string | Date | null | undefined, countryCode?: string) => {
  if (!date) return "-";
  try {
    const cc = countryCode || "SK";
    return format(new Date(date), COUNTRY_DATE_ONLY_FORMAT[cc] || "dd.MM.yyyy", { locale: COUNTRY_LOCALE_MAP[cc] || sk });
  } catch {
    return "-";
  }
};

const formatDateTime = (date: string | Date | null | undefined, countryCode?: string) => {
  if (!date) return "-";
  try {
    const cc = countryCode || "SK";
    return format(new Date(date), COUNTRY_DATE_FORMAT[cc] || "dd.MM.yyyy HH:mm", { locale: COUNTRY_LOCALE_MAP[cc] || sk });
  } catch {
    return "-";
  }
};

function getStatusBadgeVariant(status: string): "secondary" | "default" | "destructive" {
  switch (status) {
    case "draft": return "secondary";
    case "signed": case "completed": case "executed": case "verified": return "default";
    case "cancelled": case "terminated": return "destructive";
    default: return "secondary";
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case "draft": return "bg-muted text-muted-foreground border-muted";
    case "created": return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800";
    case "sent": return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800";
    case "received": return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800";
    case "returned": return "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800";
    case "signed": return "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-700";
    case "verified": return "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800";
    case "executed": return "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800";
    case "completed": return "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800";
    case "terminated": return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800";
    case "cancelled": return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800";
    default: return "bg-muted text-muted-foreground border-muted";
  }
}

export default function ContractDetailPage() {
  const { toast } = useToast();
  const { t } = useI18n();
  const params = useParams<{ id: string }>();
  const contractId = params.id;

  const CONTRACT_STATUS_OPTIONS = [
    { value: "draft", label: t.contractsModule.statusDraft },
    { value: "created", label: t.contractsModule.statusCreated },
    { value: "sent", label: t.contractsModule.statusSent },
    { value: "received", label: t.contractsModule.statusReceived },
    { value: "returned", label: t.contractsModule.statusReturned },
    { value: "signed", label: t.contractsModule.statusSigned },
    { value: "verified", label: t.contractsModule.statusVerified },
    { value: "executed", label: t.contractsModule.statusExecuted },
    { value: "completed", label: t.contractsModule.statusCompleted },
    { value: "terminated", label: t.contractsModule.statusTerminated },
    { value: "cancelled", label: t.contractsModule.statusCancelled },
  ];

  const INFO_SOURCE_OPTIONS = [
    { value: "internet", label: t.contractsModule.infoSourceInternet },
    { value: "friends", label: t.contractsModule.infoSourceFriends },
    { value: "doctor", label: t.contractsModule.infoSourceDoctor },
    { value: "positive_experience", label: t.contractsModule.infoSourcePositiveExperience },
    { value: "conference", label: t.contractsModule.infoSourceConference },
    { value: "tv", label: t.contractsModule.infoSourceTV },
    { value: "radio", label: t.contractsModule.infoSourceRadio },
    { value: "prenatal_course", label: t.contractsModule.infoSourcePrenatalCourse },
    { value: "hospital_doctor", label: t.contractsModule.infoSourceHospitalDoctor },
    { value: "other", label: t.contractsModule.infoSourceOther },
  ];

  const [activeTab, setActiveTab] = useState("basic");
  const [formState, setFormState] = useState<Record<string, any>>({});
  const [formInitialized, setFormInitialized] = useState(false);
  const [sendingAuditEmail, setSendingAuditEmail] = useState(false);
  const [lastTimelineUrl, setLastTimelineUrl] = useState<string | null>(null);

  const { data: contractDetail, isLoading } = useQuery<any>({
    queryKey: ["/api/contracts", contractId],
    enabled: !!contractId,
  });

  const { data: hospitals = [] } = useQuery<Hospital[]>({
    queryKey: ["/api/hospitals"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const contract: ContractInstance | undefined = contractDetail;
  const contractProducts = contractDetail?.products || [];
  const contractParticipants = contractDetail?.participants || [];
  const signatureRequests = contractDetail?.signatureRequests || [];
  const auditLog = contractDetail?.auditLog || [];

  const customerId = contract?.customerId;
  const customer = customers.find((c: Customer) => c.id === customerId);
  const contractCountryCode = customer?.country || "SK";

  const { data: potentialCase } = useQuery<any>({
    queryKey: ["/api/customers", customerId, "potential-case"],
    enabled: !!customerId,
  });

  const { data: collections = [] } = useQuery<Collection[]>({
    queryKey: ["/api/collections"],
  });

  const { data: customerProducts = [] } = useQuery<CustomerProduct[]>({
    queryKey: ["/api/customer-products", { customerId }],
    enabled: !!customerId,
  });

  const { data: invoices = [] } = useQuery<any[]>({
    queryKey: ["/api/customers", customerId, "invoices"],
    enabled: !!customerId,
  });

  const customerCollections = useMemo(() => {
    if (!customerId) return [];
    return collections.filter((c: Collection) => c.customerId === customerId);
  }, [collections, customerId]);

  useEffect(() => {
    if (contract && !formInitialized) {
      setFormState({
        internalId: contract.internalId || "",
        status: contract.status || "draft",
        contactDate: formatDateTimeForInput(contract.contactDate),
        filledDate: formatDateTimeForInput(contract.filledDate),
        createdContractDate: formatDateTimeForInput(contract.createdContractDate),
        sentContractDate: formatDateTimeForInput(contract.sentContractDate),
        receivedByClientDate: formatDateTimeForInput(contract.receivedByClientDate),
        returnedDate: formatDateTimeForInput(contract.returnedDate),
        verifiedDate: formatDateTimeForInput(contract.verifiedDate),
        executedDate: formatDateTimeForInput(contract.executedDate),
        terminatedDate: formatDateTimeForInput(contract.terminatedDate),
        cancelledAt: formatDateTimeForInput(contract.cancelledAt),
        terminationReason: contract.terminationReason || "",
        cancellationReason: contract.cancellationReason || "",
        ambulantDoctor: contract.ambulantDoctor || "",
        expectedDeliveryDate: formatDateForInput(contract.expectedDeliveryDate),
        hospitalId: contract.hospitalId ? String(contract.hospitalId) : "",
        obstetrician: contract.obstetrician || "",
        multiplePregnancy: contract.multiplePregnancy || false,
        salesChannel: contract.salesChannel || "",
        infoSource: contract.infoSource || "",
        selectionReason: contract.selectionReason || "",
        marketingAction: contract.marketingAction || "",
        marketingCode: contract.marketingCode || "",
        refinancing: contract.refinancing || "",
        refinancingId: contract.refinancingId || "",
        giftVoucher: contract.giftVoucher || "",
        collectionKit: contract.collectionKit || "",
        collectionKitSentDate: formatDateTimeForInput(contract.collectionKitSentDate),
        clientNote: contract.clientNote || "",
        representativeId: contract.representativeId || "",
        indicatedContract: contract.indicatedContract || false,
        initialProductId: contract.initialProductId || "",
        recruitedToProductId: contract.recruitedToProductId || "",
        recruitedDate: formatDateTimeForInput(contract.recruitedDate),
      });
      setFormInitialized(true);
    }
  }, [contract, formInitialized]);

  useEffect(() => {
    if (contract && formInitialized) {
      setFormState((prev) => {
        const updates: Record<string, any> = {};
        if (contract.sentContractDate && !prev.sentContractDate) {
          updates.sentContractDate = formatDateTimeForInput(contract.sentContractDate);
        }
        if (contract.status && contract.status !== prev.status) {
          updates.status = contract.status;
        }
        if (Object.keys(updates).length > 0) {
          return { ...prev, ...updates };
        }
        return prev;
      });
    }
  }, [contract, formInitialized]);

  const updateField = (field: string, value: any) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = { ...formState };
      const dateTimeFields = [
        "contactDate", "filledDate", "createdContractDate", "sentContractDate",
        "receivedByClientDate", "returnedDate", "verifiedDate", "executedDate",
        "terminatedDate", "cancelledAt", "collectionKitSentDate", "recruitedDate",
      ];
      for (const field of dateTimeFields) {
        if (payload[field] === "") {
          payload[field] = null;
        } else if (payload[field]) {
          payload[field] = new Date(payload[field]).toISOString();
        }
      }
      if (payload.expectedDeliveryDate === "") {
        payload.expectedDeliveryDate = null;
      }
      if (payload.hospitalId === "") {
        payload.hospitalId = null;
      } else if (payload.hospitalId) {
        payload.hospitalId = parseInt(payload.hospitalId, 10);
      }
      delete payload.showTermination;
      delete payload.showCancellation;
      return apiRequest("PATCH", `/api/contracts/${contractId}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", contractId] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: t.contractsModule.saved, description: t.contractsModule.saved });
    },
    onError: () => {
      toast({ title: t.contractsModule.saveError, description: t.contractsModule.saveError, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loading-spinner" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="space-y-4">
        <Link href="/contracts">
          <Button variant="ghost" data-testid="button-back-contracts">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t.contractsModule.backToContracts}
          </Button>
        </Link>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {t.contractsModule.contractNotFound}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link href="/contracts">
        <Button variant="ghost" data-testid="button-back-contracts">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t.contractsModule.backToContracts}
        </Button>
      </Link>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="page-title">
            {t.contractsModule.title} {contract.contractNumber}
          </h1>
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-md border text-sm font-semibold ${getStatusColor(contract.status)}`} data-testid="badge-contract-status-main">
            {contract.status === "signed" && (
              <CheckCircle className="h-4 w-4" />
            )}
            {CONTRACT_STATUS_OPTIONS.find((s) => s.value === contract.status)?.label || contract.status}
          </div>
        </div>
        {customer && (
          <p className="text-muted-foreground">{customer.firstName} {customer.lastName}</p>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap" data-testid="tabs-list">
          <TabsTrigger value="basic" data-testid="tab-basic">
            <FileText className="h-4 w-4 mr-1" />
            {t.contractsModule.tabBasicData}
          </TabsTrigger>
          <TabsTrigger value="persons" data-testid="tab-persons">
            <Users className="h-4 w-4 mr-1" />
            {t.contractsModule.tabPersons}
          </TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents">
            <FileText className="h-4 w-4 mr-1" />
            {t.contractsModule.tabDocuments}
          </TabsTrigger>
          <TabsTrigger value="products" data-testid="tab-products">
            <Package className="h-4 w-4 mr-1" />
            {t.contractsModule.tabProducts}
          </TabsTrigger>
          <TabsTrigger value="collections" data-testid="tab-collections">
            <Beaker className="h-4 w-4 mr-1" />
            {t.contractsModule.tabCollections}
          </TabsTrigger>
          <TabsTrigger value="invoices" data-testid="tab-invoices">
            <Receipt className="h-4 w-4 mr-1" />
            {t.contractsModule.tabInvoices}
          </TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">
            <History className="h-4 w-4 mr-1" />
            {t.contractsModule.auditLog}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t.contractsModule.sectionIdentification}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="internalId">{t.contractsModule.fieldLegacyId}</Label>
                  <Input
                    id="internalId"
                    value={formState.internalId || ""}
                    onChange={(e) => updateField("internalId", e.target.value)}
                    data-testid="input-internalId"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contractNumber">{t.contractsModule.fieldContractNumber}</Label>
                  <Input
                    id="contractNumber"
                    value={contract.contractNumber}
                    readOnly
                    className="bg-muted"
                    data-testid="input-contractNumber"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">{t.contractsModule.fieldStatus}</Label>
                  <Select
                    value={formState.status || "draft"}
                    onValueChange={(v) => updateField("status", v)}
                  >
                    <SelectTrigger data-testid="select-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTRACT_STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} data-testid={`status-option-${opt.value}`}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {(() => {
            const lifecycleSteps = [
              { id: "contactDate", label: t.contractsModule.fieldContactDate, icon: Phone, color: "#6366F1" },
              { id: "filledDate", label: t.contractsModule.fieldFilledDate, icon: Edit, color: "#8B5CF6" },
              { id: "createdContractDate", label: t.contractsModule.fieldCreatedContractDate, icon: FileText, color: "#3B82F6" },
              { id: "sentContractDate", label: t.contractsModule.fieldSentDate, icon: Send, color: "#F59E0B" },
              { id: "receivedByClientDate", label: t.contractsModule.fieldReceivedDate, icon: Download, color: "#F97316" },
              { id: "returnedDate", label: t.contractsModule.fieldReturnedDate, icon: ArrowLeft, color: "#EC4899" },
              { id: "verifiedDate", label: t.contractsModule.fieldVerifiedDate, icon: Shield, color: "#10B981" },
              { id: "executedDate", label: t.contractsModule.fieldExecutedDate, icon: CheckCircle, color: "#059669" },
            ];
            const completedIndex = lifecycleSteps.reduce((last, step, i) => formState[step.id] ? i : last, -1);
            return (
              <Card>
                <CardContent className="pt-5 pb-4 px-4">
                  <div className="relative overflow-x-auto" data-testid="contract-lifecycle-timeline">
                    <div className="flex items-start min-w-[640px]">
                      {lifecycleSteps.map((step, i) => {
                        const StepIcon = step.icon;
                        const hasDate = !!formState[step.id];
                        const isCompleted = hasDate;
                        const isActive = i === completedIndex + 1 && !hasDate;
                        const isPast = i <= completedIndex;
                        return (
                          <div key={step.id} className="flex-1 flex flex-col items-center relative" style={{ minWidth: 80 }}>
                            <div className="flex items-center w-full">
                              {i > 0 && (
                                <div className="flex-1 h-0.5" style={{ backgroundColor: isPast ? step.color : "hsl(var(--border))" }} />
                              )}
                              <div
                                className="relative z-10 flex items-center justify-center rounded-full shrink-0 transition-all"
                                style={{
                                  width: isActive ? 36 : 30,
                                  height: isActive ? 36 : 30,
                                  backgroundColor: isCompleted ? step.color : isActive ? "hsl(var(--background))" : "hsl(var(--muted))",
                                  border: isActive ? `2px solid ${step.color}` : isCompleted ? "none" : "2px solid hsl(var(--border))",
                                  boxShadow: isActive ? `0 0 0 3px ${step.color}30` : isCompleted ? `0 2px 4px ${step.color}40` : "none",
                                }}
                              >
                                <StepIcon
                                  className="transition-all"
                                  style={{
                                    width: isActive ? 16 : 14,
                                    height: isActive ? 16 : 14,
                                    color: isCompleted ? "white" : isActive ? step.color : "hsl(var(--muted-foreground))",
                                  }}
                                />
                              </div>
                              {i < lifecycleSteps.length - 1 && (
                                <div className="flex-1 h-0.5" style={{ backgroundColor: isPast && i < completedIndex ? lifecycleSteps[i + 1].color : "hsl(var(--border))" }} />
                              )}
                            </div>
                            <p className="text-[10px] leading-tight text-center mt-1.5 px-0.5 font-medium" style={{ color: isCompleted ? step.color : isActive ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))" }}>
                              {step.label}
                            </p>
                            {hasDate && (
                              <p className="text-[9px] text-muted-foreground text-center mt-0.5">
                                {formatDateOnly(formState[step.id], contractCountryCode)}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                {t.contractsModule.sectionLifecycleDates}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { id: "contactDate", label: t.contractsModule.fieldContactDate, icon: Phone },
                  { id: "filledDate", label: t.contractsModule.fieldFilledDate, icon: Edit },
                  { id: "createdContractDate", label: t.contractsModule.fieldCreatedContractDate, icon: FileText },
                  { id: "sentContractDate", label: t.contractsModule.fieldSentDate, icon: Send },
                  { id: "receivedByClientDate", label: t.contractsModule.fieldReceivedDate, icon: Download },
                  { id: "returnedDate", label: t.contractsModule.fieldReturnedDate, icon: ArrowLeft },
                  { id: "verifiedDate", label: t.contractsModule.fieldVerifiedDate, icon: Shield },
                  { id: "executedDate", label: t.contractsModule.fieldExecutedDate, icon: CheckCircle },
                ].map(({ id, label, icon: Icon }) => (
                  <div key={id} className="space-y-1.5">
                    <Label htmlFor={id} className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </Label>
                    <DateTimePicker
                      value={formState[id] || ""}
                      onChange={(v) => updateField(id, v)}
                      countryCode={contractCountryCode}
                      data-testid={`input-${id}`}
                    />
                  </div>
                ))}
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="enableTermination"
                      checked={!!(formState.terminatedDate || formState.showTermination)}
                      onCheckedChange={(v) => {
                        if (!v) {
                          updateField("terminatedDate", "");
                          updateField("terminationReason", "");
                        }
                        updateField("showTermination", !!v);
                      }}
                      data-testid="checkbox-enable-termination"
                    />
                    <Label htmlFor="enableTermination" className="font-medium flex items-center gap-2 cursor-pointer">
                      <X className="h-4 w-4 text-destructive" />
                      {t.contractsModule.statusTerminated}
                    </Label>
                  </div>
                  {(formState.terminatedDate || formState.showTermination) && (
                    <div className="pl-8 space-y-3 border-l-2 border-destructive/20 ml-1.5">
                      <div className="space-y-1.5">
                        <Label htmlFor="terminatedDate" className="text-xs text-muted-foreground">{t.contractsModule.fieldTerminatedDate}</Label>
                        <DateTimePicker
                          value={formState.terminatedDate || ""}
                          onChange={(v) => updateField("terminatedDate", v)}
                          countryCode={contractCountryCode}
                          data-testid="input-terminatedDate"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="terminationReason" className="text-xs text-muted-foreground">{t.contractsModule.fieldTerminationReason}</Label>
                        <Textarea
                          id="terminationReason"
                          value={formState.terminationReason || ""}
                          onChange={(e) => updateField("terminationReason", e.target.value)}
                          className="text-sm"
                          rows={2}
                          data-testid="input-terminationReason"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="enableCancellation"
                      checked={!!(formState.cancelledAt || formState.showCancellation)}
                      onCheckedChange={(v) => {
                        if (!v) {
                          updateField("cancelledAt", "");
                          updateField("cancellationReason", "");
                        }
                        updateField("showCancellation", !!v);
                      }}
                      data-testid="checkbox-enable-cancellation"
                    />
                    <Label htmlFor="enableCancellation" className="font-medium flex items-center gap-2 cursor-pointer">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      {t.contractsModule.statusCancelled}
                    </Label>
                  </div>
                  {(formState.cancelledAt || formState.showCancellation) && (
                    <div className="pl-8 space-y-3 border-l-2 border-destructive/20 ml-1.5">
                      <div className="space-y-1.5">
                        <Label htmlFor="cancelledAt" className="text-xs text-muted-foreground">{t.contractsModule.fieldCancelledAt}</Label>
                        <DateTimePicker
                          value={formState.cancelledAt || ""}
                          onChange={(v) => updateField("cancelledAt", v)}
                          countryCode={contractCountryCode}
                          data-testid="input-cancelledAt"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="cancellationReason" className="text-xs text-muted-foreground">{t.contractsModule.fieldCancellationReason}</Label>
                        <Textarea
                          id="cancellationReason"
                          value={formState.cancellationReason || ""}
                          onChange={(e) => updateField("cancellationReason", e.target.value)}
                          className="text-sm"
                          rows={2}
                          data-testid="input-cancellationReason"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.contractsModule.sectionMedical}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ambulantDoctor">{t.contractsModule.fieldAmbulantDoctor}</Label>
                  <Input
                    id="ambulantDoctor"
                    value={formState.ambulantDoctor || ""}
                    onChange={(e) => updateField("ambulantDoctor", e.target.value)}
                    data-testid="input-ambulantDoctor"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expectedDeliveryDate">{t.contractsModule.fieldExpectedDeliveryDate}</Label>
                  <DateTimePicker
                    value={formState.expectedDeliveryDate || ""}
                    onChange={(v) => updateField("expectedDeliveryDate", v)}
                    countryCode={contractCountryCode}
                    includeTime={false}
                    data-testid="input-expectedDeliveryDate"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hospitalId">{t.contractsModule.fieldHospital}</Label>
                  <Select
                    value={formState.hospitalId || ""}
                    onValueChange={(v) => updateField("hospitalId", v)}
                  >
                    <SelectTrigger data-testid="select-hospitalId">
                      <SelectValue placeholder={t.contractsModule.fieldHospital} />
                    </SelectTrigger>
                    <SelectContent>
                      {hospitals.map((h: Hospital) => (
                        <SelectItem key={h.id} value={h.id} data-testid={`hospital-option-${h.id}`}>
                          {h.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="obstetrician">{t.contractsModule.fieldObstetrician}</Label>
                  <Input
                    id="obstetrician"
                    value={formState.obstetrician || ""}
                    onChange={(e) => updateField("obstetrician", e.target.value)}
                    data-testid="input-obstetrician"
                  />
                </div>
                <div className="flex items-center space-x-2 pt-6">
                  <Checkbox
                    id="multiplePregnancy"
                    checked={formState.multiplePregnancy || false}
                    onCheckedChange={(v) => updateField("multiplePregnancy", !!v)}
                    data-testid="checkbox-multiplePregnancy"
                  />
                  <Label htmlFor="multiplePregnancy">{t.contractsModule.fieldMultiplePregnancy}</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.contractsModule.sectionSalesMarketing}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="salesChannel">{t.contractsModule.fieldChannel}</Label>
                  <Select
                    value={formState.salesChannel || ""}
                    onValueChange={(v) => updateField("salesChannel", v)}
                  >
                    <SelectTrigger data-testid="select-salesChannel">
                      <SelectValue placeholder={t.contractsModule.fieldChannel} />
                    </SelectTrigger>
                    <SelectContent>
                      {SALES_CHANNEL_OPTIONS.map((ch) => (
                        <SelectItem key={ch} value={ch} data-testid={`salesChannel-option-${ch}`}>
                          {ch}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="infoSource">{t.contractsModule.fieldInfoSource}</Label>
                  <Select
                    value={formState.infoSource || ""}
                    onValueChange={(v) => updateField("infoSource", v)}
                  >
                    <SelectTrigger data-testid="select-infoSource">
                      <SelectValue placeholder={t.contractsModule.fieldInfoSource} />
                    </SelectTrigger>
                    <SelectContent>
                      {INFO_SOURCE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} data-testid={`infoSource-option-${opt.value}`}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2 lg:col-span-1">
                  <Label htmlFor="selectionReason">{t.contractsModule.fieldSelectionReason}</Label>
                  <Textarea
                    id="selectionReason"
                    value={formState.selectionReason || ""}
                    onChange={(e) => updateField("selectionReason", e.target.value)}
                    data-testid="input-selectionReason"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="marketingAction">{t.contractsModule.fieldMarketingAction}</Label>
                  <Input
                    id="marketingAction"
                    value={formState.marketingAction || ""}
                    onChange={(e) => updateField("marketingAction", e.target.value)}
                    data-testid="input-marketingAction"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="marketingCode">{t.contractsModule.fieldMarketingCode}</Label>
                  <Input
                    id="marketingCode"
                    value={formState.marketingCode || ""}
                    onChange={(e) => updateField("marketingCode", e.target.value)}
                    data-testid="input-marketingCode"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.contractsModule.sectionFinancial}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="refinancing">{t.contractsModule.fieldRefinancing}</Label>
                  <Input
                    id="refinancing"
                    value={formState.refinancing || ""}
                    onChange={(e) => updateField("refinancing", e.target.value)}
                    data-testid="input-refinancing"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="refinancingId">{t.contractsModule.fieldRefinancing} ID</Label>
                  <Input
                    id="refinancingId"
                    value={formState.refinancingId || ""}
                    onChange={(e) => updateField("refinancingId", e.target.value)}
                    data-testid="input-refinancingId"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="giftVoucher">{t.contractsModule.fieldGiftVoucher}</Label>
                  <Input
                    id="giftVoucher"
                    value={formState.giftVoucher || ""}
                    onChange={(e) => updateField("giftVoucher", e.target.value)}
                    data-testid="input-giftVoucher"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.contractsModule.sectionCollectionKit}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="collectionKit">{t.contractsModule.fieldCollectionKit}</Label>
                  <Input
                    id="collectionKit"
                    value={formState.collectionKit || ""}
                    onChange={(e) => updateField("collectionKit", e.target.value)}
                    data-testid="input-collectionKit"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="collectionKitSentDate">{t.contractsModule.fieldCollectionKitSentDate}</Label>
                  <DateTimePicker
                    value={formState.collectionKitSentDate || ""}
                    onChange={(v) => updateField("collectionKitSentDate", v)}
                    countryCode={contractCountryCode}
                    data-testid="input-collectionKitSentDate"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.contractsModule.sectionOther}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2 md:col-span-2 lg:col-span-3">
                  <Label htmlFor="clientNote">{t.contractsModule.fieldClientNote}</Label>
                  <Textarea
                    id="clientNote"
                    value={formState.clientNote || ""}
                    onChange={(e) => updateField("clientNote", e.target.value)}
                    data-testid="input-clientNote"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="representativeId">{t.contractsModule.fieldRepresentative}</Label>
                  <Input
                    id="representativeId"
                    value={formState.representativeId || ""}
                    onChange={(e) => updateField("representativeId", e.target.value)}
                    data-testid="input-representativeId"
                  />
                </div>
                <div className="flex items-center space-x-2 pt-6">
                  <Checkbox
                    id="indicatedContract"
                    checked={formState.indicatedContract || false}
                    onCheckedChange={(v) => updateField("indicatedContract", !!v)}
                    data-testid="checkbox-indicatedContract"
                  />
                  <Label htmlFor="indicatedContract">{t.contractsModule.fieldIndicatedContract}</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="initialProductId">{t.contractsModule.productName}</Label>
                  <Select
                    value={formState.initialProductId || ""}
                    onValueChange={(v) => updateField("initialProductId", v)}
                  >
                    <SelectTrigger data-testid="select-initialProductId">
                      <SelectValue placeholder={t.contractsModule.selectProductSet} />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p: Product) => (
                        <SelectItem key={p.id} value={p.id} data-testid={`initialProduct-option-${p.id}`}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recruitedToProductId">{t.contractsModule.selectProductSet}</Label>
                  <Select
                    value={formState.recruitedToProductId || ""}
                    onValueChange={(v) => updateField("recruitedToProductId", v)}
                  >
                    <SelectTrigger data-testid="select-recruitedToProductId">
                      <SelectValue placeholder={t.contractsModule.selectProductSet} />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p: Product) => (
                        <SelectItem key={p.id} value={p.id} data-testid={`recruitedProduct-option-${p.id}`}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recruitedDate">{t.contractsModule.created}</Label>
                  <DateTimePicker
                    value={formState.recruitedDate || ""}
                    onChange={(v) => updateField("recruitedDate", v)}
                    countryCode={contractCountryCode}
                    data-testid="input-recruitedDate"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              data-testid="button-save"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {saveMutation.isPending ? t.contractsModule.saving : t.contractsModule.save}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="persons" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t.contractsModule.client}</CardTitle>
            </CardHeader>
            <CardContent>
              {customer ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">{t.contractsModule.participantName}</Label>
                    <p className="font-medium" data-testid="text-customer-name">
                      {customer.titleBefore ? `${customer.titleBefore} ` : ""}{customer.firstName} {customer.lastName}{customer.titleAfter ? `, ${customer.titleAfter}` : ""}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">{t.contractsModule.participantEmail}</Label>
                    <p data-testid="text-customer-email">{customer.email || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">{t.contractsModule.participantPhone}</Label>
                    <p data-testid="text-customer-phone">{customer.phone || customer.mobile || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">{t.contractsModule.fatherStreet}</Label>
                    <p data-testid="text-customer-address">
                      {[customer.address, customer.city, customer.postalCode].filter(Boolean).join(", ") || "-"}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">{t.contractsModule.noData}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.contractsModule.fatherOfChild}</CardTitle>
            </CardHeader>
            <CardContent>
              {potentialCase?.fatherFirstName || potentialCase?.fatherLastName ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">{t.contractsModule.participantName}</Label>
                    <p className="font-medium" data-testid="text-father-name">
                      {potentialCase.fatherFirstName || ""} {potentialCase.fatherLastName || ""}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">{t.contractsModule.participantEmail}</Label>
                    <p data-testid="text-father-email">{potentialCase.fatherEmail || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">{t.contractsModule.participantPhone}</Label>
                    <p data-testid="text-father-phone">{potentialCase.fatherPhone || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">{t.contractsModule.fatherStreet}</Label>
                    <p data-testid="text-father-address">
                      {[potentialCase.fatherAddress, potentialCase.fatherCity, potentialCase.fatherPostalCode].filter(Boolean).join(", ") || "-"}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">{t.contractsModule.noData}</p>
              )}
            </CardContent>
          </Card>

          {contractParticipants.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t.contractsModule.participants}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.contractsModule.participantName}</TableHead>
                      <TableHead>{t.contractsModule.participantType}</TableHead>
                      <TableHead>{t.contractsModule.participantEmail}</TableHead>
                      <TableHead>{t.contractsModule.participantPhone}</TableHead>
                      <TableHead>{t.contractsModule.signatureRequired}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contractParticipants.map((p: any) => (
                      <TableRow key={p.id} data-testid={`row-participant-${p.id}`}>
                        <TableCell className="font-medium">{p.fullName}</TableCell>
                        <TableCell>{p.participantType}</TableCell>
                        <TableCell>{p.email || "-"}</TableCell>
                        <TableCell>{p.phone || "-"}</TableCell>
                        <TableCell>
                          {p.signedAt ? (
                            <Badge variant="default" data-testid={`badge-signed-${p.id}`}>{t.contractsModule.statusSignedLabel}</Badge>
                          ) : p.signatureRequired ? (
                            <Badge variant="secondary" data-testid={`badge-pending-${p.id}`}>{t.contractsModule.statusWaitingOtp}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t.contractsModule.tabDocuments}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.contractsModule.fieldContractNumber}</TableHead>
                    <TableHead>{t.contractsModule.fieldStatus}</TableHead>
                    <TableHead>{t.contractsModule.created}</TableHead>
                    <TableHead>{t.contractsModule.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow data-testid="row-document-main">
                    <TableCell className="font-medium">{contract.contractNumber}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(contract.status)} data-testid="badge-contract-status">
                        {CONTRACT_STATUS_OPTIONS.find((s) => s.value === contract.status)?.label || contract.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDateTime(contract.createdAt, contractCountryCode)}</TableCell>
                    <TableCell>
                      {contract.pdfPath ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={async () => {
                            try {
                              const response = await fetch(`/api/contracts/${contract.id}/pdf`, { credentials: "include" });
                              if (!response.ok) throw new Error("Download failed");
                              const blob = await response.blob();
                              const url = window.URL.createObjectURL(blob);
                              const link = document.createElement("a");
                              link.href = url;
                              link.download = `zmluva-${contract.contractNumber}.pdf`;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              window.URL.revokeObjectURL(url);
                            } catch {
                              toast({ title: t.contractsModule.saveError, variant: "destructive" });
                            }
                          }}
                          data-testid="link-download-pdf"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-sm">{t.contractsModule.noDocuments}</span>
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t.contractsModule.tabProducts}</CardTitle>
            </CardHeader>
            <CardContent>
              {contractProducts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.contractsModule.productName}</TableHead>
                      <TableHead>{t.common.selected}</TableHead>
                      <TableHead>{t.contractsModule.productPrice}</TableHead>
                      <TableHead>{t.contractsModule.productCurrency}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contractProducts.map((cp: any) => {
                      let productName = "-";
                      try {
                        const snapshot = cp.productSnapshot ? JSON.parse(cp.productSnapshot) : null;
                        productName = snapshot?.name || "-";
                      } catch {
                        productName = "-";
                      }
                      return (
                        <TableRow key={cp.id} data-testid={`row-contract-product-${cp.id}`}>
                          <TableCell className="font-medium">{productName}</TableCell>
                          <TableCell>{cp.quantity || 1}</TableCell>
                          <TableCell>{cp.unitPrice ? `${cp.unitPrice} ${contract.currency}` : "-"}</TableCell>
                          <TableCell>{cp.lineGrossAmount ? `${cp.lineGrossAmount} ${contract.currency}` : "-"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground">{t.contractsModule.noProducts}</p>
              )}
            </CardContent>
          </Card>

          {customerProducts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t.contractsModule.client} - {t.contractsModule.tabProducts}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.contractsModule.productName}</TableHead>
                      <TableHead>{t.common.selected}</TableHead>
                      <TableHead>{t.contractsModule.productPrice}</TableHead>
                      <TableHead>{t.contractsModule.fieldClientNote}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerProducts.map((cp: CustomerProduct) => {
                      const prod = products.find((p: Product) => p.id === cp.productId);
                      return (
                        <TableRow key={cp.id} data-testid={`row-customer-product-${cp.id}`}>
                          <TableCell className="font-medium">{prod?.name || cp.productId}</TableCell>
                          <TableCell>{cp.quantity}</TableCell>
                          <TableCell>{cp.priceOverride ? `${cp.priceOverride}` : "-"}</TableCell>
                          <TableCell>{cp.notes || "-"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="collections" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t.contractsModule.tabCollections}</CardTitle>
            </CardHeader>
            <CardContent>
              {customerCollections.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>CBU</TableHead>
                      <TableHead>{t.contractsModule.collectionDate}</TableHead>
                      <TableHead>{t.contractsModule.fieldHospital}</TableHead>
                      <TableHead>{t.contractsModule.participantName}</TableHead>
                      <TableHead>{t.contractsModule.collectionStatus}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerCollections.map((col: Collection) => {
                      const hospital = hospitals.find((h: Hospital) => h.id === col.hospitalId);
                      return (
                        <TableRow key={col.id} data-testid={`row-collection-${col.id}`}>
                          <TableCell className="font-medium">{col.cbuNumber || "-"}</TableCell>
                          <TableCell>{formatDateTime(col.collectionDate, contractCountryCode)}</TableCell>
                          <TableCell>{hospital?.name || "-"}</TableCell>
                          <TableCell>
                            {[col.childFirstName, col.childLastName].filter(Boolean).join(" ") || "-"}
                          </TableCell>
                          <TableCell>{col.state || "-"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground">{t.contractsModule.noCollections}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t.contractsModule.tabInvoices}</CardTitle>
            </CardHeader>
            <CardContent>
              {invoices.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.contractsModule.invoiceNumber}</TableHead>
                      <TableHead>{t.contractsModule.created}</TableHead>
                      <TableHead>{t.contractsModule.invoiceAmount}</TableHead>
                      <TableHead>{t.contractsModule.invoiceStatus}</TableHead>
                      <TableHead>{t.contractsModule.actions}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv: any) => (
                      <TableRow key={inv.id} data-testid={`row-invoice-${inv.id}`}>
                        <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                        <TableCell>{formatDate(inv.issueDate || inv.generatedAt, contractCountryCode)}</TableCell>
                        <TableCell>{inv.totalAmount ? `${inv.totalAmount} ${inv.currency || "EUR"}` : "-"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={inv.status === "paid" ? "default" : inv.status === "cancelled" ? "destructive" : "secondary"}
                            data-testid={`badge-invoice-status-${inv.id}`}
                          >
                            {inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {inv.pdfPath ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={async () => {
                                  try {
                                    const response = await fetch(`/api/invoices/${inv.id}/pdf`, { credentials: "include" });
                                    if (!response.ok) throw new Error("Download failed");
                                    const blob = await response.blob();
                                    const url = window.URL.createObjectURL(blob);
                                    const link = document.createElement("a");
                                    link.href = url;
                                    link.download = `faktura-${inv.invoiceNumber}.pdf`;
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                    window.URL.revokeObjectURL(url);
                                  } catch {
                                    toast({ title: t.contractsModule.saveError, variant: "destructive" });
                                  }
                                }}
                                data-testid={`button-invoice-download-${inv.id}`}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                            <Link href={`/invoices`}>
                              <Button variant="ghost" size="icon" data-testid={`button-invoice-view-${inv.id}`}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground">{t.contractsModule.noInvoices}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                {t.contractsModule.auditLog}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                disabled={!customer?.email || sendingAuditEmail}
                title={customer?.email ? `${t.contractsModule.sendAuditTimeline}: ${customer.email}` : t.contractsModule.noCustomerEmail}
                onClick={async () => {
                  if (!customer?.email) return;
                  setSendingAuditEmail(true);
                  try {
                    const res = await apiRequest("POST", `/api/contracts/${contractId}/export-audit`, { email: customer.email });
                    const data = await res.json();
                    if (data.emailSent) {
                      toast({ title: t.contractsModule.auditTimelineSent, description: t.contractsModule.auditTimelineSentDesc });
                    } else {
                      toast({ title: t.contractsModule.auditTimelineSent, description: "MS365 not connected - link generated but email was not sent", variant: "destructive" });
                    }
                    if (data.timelineUrl) {
                      setLastTimelineUrl(data.timelineUrl);
                    }
                  } catch {
                    toast({ title: t.contractsModule.saveError, variant: "destructive" });
                  } finally {
                    setSendingAuditEmail(false);
                  }
                }}
                data-testid="button-export-audit-send"
              >
                {sendingAuditEmail ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                {t.contractsModule.sendToCustomerEmail}
                {customer?.email && (
                  <span className="ml-1 text-xs text-muted-foreground">({customer.email})</span>
                )}
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">{t.contractsModule.auditLogDescription}</p>
              {lastTimelineUrl && (
                <div className="flex items-center gap-2 mb-4 p-3 bg-muted/50 rounded-md">
                  <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm text-muted-foreground truncate flex-1">{lastTimelineUrl}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(lastTimelineUrl);
                      toast({ title: t.contractsModule.linkCopied });
                    }}
                    data-testid="button-copy-timeline-link"
                  >
                    {t.contractsModule.copyLink}
                  </Button>
                  <a href={lastTimelineUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="sm" data-testid="button-open-timeline">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </a>
                </div>
              )}
              {auditLog.length > 0 ? (
                <div className="space-y-3">
                  {auditLog.map((entry: any, index: number) => {
                    const getActionIcon = (action: string) => {
                      switch (action) {
                        case "created": return <FileText className="h-4 w-4" />;
                        case "sent": case "otp_sent": return <Send className="h-4 w-4" />;
                        case "viewed": case "signing_page_viewed": return <Eye className="h-4 w-4" />;
                        case "otp_verified": case "verified": return <Shield className="h-4 w-4" />;
                        case "signed": case "completed": case "executed": return <CheckCircle className="h-4 w-4" />;
                        case "cancelled": case "terminated": return <X className="h-4 w-4" />;
                        case "updated": case "status_changed": return <Edit className="h-4 w-4" />;
                        case "audit_exported": return <ExternalLink className="h-4 w-4" />;
                        case "received": return <Download className="h-4 w-4" />;
                        case "returned": return <ArrowLeft className="h-4 w-4" />;
                        case "pdf_generated": return <Download className="h-4 w-4" />;
                        default: return <Clock className="h-4 w-4" />;
                      }
                    };
                    const getActionLabel = (action: string) => {
                      const map: Record<string, string> = {
                        created: t.contractsModule.auditEventCreated,
                        sent: t.contractsModule.auditEventSent,
                        viewed: t.contractsModule.auditEventViewed,
                        otp_sent: t.contractsModule.auditEventOtpSent,
                        otp_verified: t.contractsModule.auditEventOtpVerified,
                        signed: t.contractsModule.auditEventSigned,
                        completed: t.contractsModule.auditEventCompleted,
                        cancelled: t.contractsModule.auditEventCancelled,
                        updated: t.contractsModule.auditEventUpdated,
                        status_changed: t.contractsModule.auditEventStatusChanged,
                        audit_exported: t.contractsModule.auditEventAuditExported,
                        signing_page_viewed: t.contractsModule.auditEventSigningPageViewed,
                        received: t.contractsModule.auditEventReceived,
                        returned: t.contractsModule.auditEventReturned,
                        verified: t.contractsModule.auditEventVerified,
                        terminated: t.contractsModule.auditEventTerminated,
                        pdf_generated: t.contractsModule.auditEventPdfGenerated,
                        executed: t.contractsModule.auditEventExecuted,
                      };
                      return map[action] || action;
                    };
                    const getActionColor = (action: string) => {
                      switch (action) {
                        case "created": return "text-blue-500";
                        case "sent": case "otp_sent": return "text-orange-500";
                        case "otp_verified": case "verified": return "text-emerald-500";
                        case "signed": case "completed": case "executed": return "text-green-600";
                        case "cancelled": case "terminated": return "text-destructive";
                        case "status_changed": return "text-purple-500";
                        case "audit_exported": return "text-muted-foreground";
                        case "signing_page_viewed": case "viewed": return "text-indigo-500";
                        case "received": return "text-purple-500";
                        case "returned": return "text-orange-500";
                        case "pdf_generated": return "text-blue-500";
                        default: return "text-muted-foreground";
                      }
                    };
                    let details: Record<string, any> = {};
                    try { details = entry.details ? JSON.parse(entry.details) : {}; } catch { details = {}; }

                    return (
                      <div key={entry.id || index} className="flex gap-3 items-start" data-testid={`row-audit-${index}`}>
                        <div className={`mt-0.5 flex-shrink-0 ${getActionColor(entry.action)}`}>
                          {getActionIcon(entry.action)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{getActionLabel(entry.action)}</span>
                            <Badge variant="secondary" className="text-xs">
                              {entry.actorType === "user" ? entry.actorName || entry.actorEmail : entry.actorType === "customer" ? entry.actorName || "Customer" : "System"}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>{entry.createdAt ? formatDateTime(entry.createdAt, contractCountryCode) : "-"}</span>
                            {entry.ipAddress && (
                              <span className="flex items-center gap-1">
                                <Shield className="h-3 w-3" />
                                {entry.ipAddress}
                              </span>
                            )}
                          </div>
                          {Object.keys(details).length > 0 && (
                            <div className="text-xs text-muted-foreground mt-1 bg-muted/50 p-2 rounded-md">
                              {Object.entries(details).map(([key, value]) => {
                                const readableKey = key
                                  .replace(/_/g, ' ')
                                  .replace(/([A-Z])/g, ' $1')
                                  .replace(/^./, s => s.toUpperCase())
                                  .trim();
                                const readableValue = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)
                                  ? formatDateTime(value, contractCountryCode)
                                  : String(value);
                                return (
                                  <div key={key} className="flex gap-1">
                                    <span className="font-medium">{readableKey}:</span>
                                    <span>{readableValue}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">{t.contractsModule.noData}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
