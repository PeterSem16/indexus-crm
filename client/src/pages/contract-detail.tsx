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
import { ArrowLeft, Save, FileText, Users, Package, Beaker, Receipt, Loader2, Download, ExternalLink, Shield, Clock, Mail, CheckCircle, Send, Eye, AlertCircle, X, Edit, History, Phone, RefreshCw, MessageSquare, StickyNote, Layers, Calendar } from "lucide-react";
import type { ContractInstance, Customer, Hospital, Collection, Product, CustomerProduct, CollectionStatus } from "@shared/schema";

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
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionDialogShown, setActionDialogShown] = useState(false);

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

  const { data: collectionStatuses = [] } = useQuery<CollectionStatus[]>({
    queryKey: ["/api/config/collection-statuses"],
  });

  const { data: customerProducts = [] } = useQuery<CustomerProduct[]>({
    queryKey: ["/api/customer-products", { customerId }],
    enabled: !!customerId,
  });

  const { data: invoices = [] } = useQuery<any[]>({
    queryKey: ["/api/customers", customerId, "invoices"],
    enabled: !!customerId,
  });

  const isIscbc = contract?.dataSource === "iscbc";

  const { data: phoneCommunications = [] } = useQuery<any[]>({
    queryKey: ["/api/contracts", contractId, "phone-communications"],
    enabled: !!contractId && isIscbc,
  });

  const { data: contractRemarks = [] } = useQuery<any[]>({
    queryKey: ["/api/contracts", contractId, "remarks"],
    enabled: !!contractId && isIscbc,
  });

  const customerCollections = useMemo(() => {
    if (!customerId) return [];
    return collections.filter((c: Collection) => c.customerId === customerId);
  }, [collections, customerId]);

  const [lastContractUpdatedAt, setLastContractUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    if (contract && (!formInitialized || (contract.updatedAt && contract.updatedAt !== lastContractUpdatedAt))) {
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
      setLastContractUpdatedAt(contract.updatedAt || null);
    }
  }, [contract, formInitialized, lastContractUpdatedAt]);

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

  const lifecycleStepsDef = useMemo(() => [
    { id: "contactDate", label: t.contractsModule.fieldContactDate, icon: Phone, color: "#6366F1" },
    { id: "filledDate", label: t.contractsModule.fieldFilledDate, icon: Edit, color: "#8B5CF6" },
    { id: "createdContractDate", label: t.contractsModule.fieldCreatedContractDate, icon: FileText, color: "#3B82F6" },
    { id: "sentContractDate", label: t.contractsModule.fieldSentDate, icon: Send, color: "#F59E0B" },
    { id: "receivedByClientDate", label: t.contractsModule.fieldReceivedDate, icon: Download, color: "#F97316" },
    { id: "returnedDate", label: t.contractsModule.fieldReturnedDate, icon: ArrowLeft, color: "#EC4899" },
    { id: "verifiedDate", label: t.contractsModule.fieldVerifiedDate, icon: Shield, color: "#10B981" },
    { id: "executedDate", label: t.contractsModule.fieldExecutedDate, icon: CheckCircle, color: "#059669" },
  ], [t]);

  const nextExpectedStep = useMemo(() => {
    if (!formInitialized) return null;
    const completedIdx = lifecycleStepsDef.reduce((last, step, i) => formState[step.id] ? i : last, -1);
    if (completedIdx < lifecycleStepsDef.length - 1) {
      const next = lifecycleStepsDef[completedIdx + 1];
      if (!formState[next.id]) return next;
    }
    return null;
  }, [formState, formInitialized, lifecycleStepsDef]);

  useEffect(() => {
    if (nextExpectedStep && formInitialized && !actionDialogShown) {
      const timer = setTimeout(() => {
        setShowActionDialog(true);
        setActionDialogShown(true);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [nextExpectedStep, formInitialized, actionDialogShown]);

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
      {showActionDialog && nextExpectedStep && (() => {
        const NextIcon = nextExpectedStep.icon;
        const completedSteps = lifecycleStepsDef.filter(s => !!formState[s.id]);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowActionDialog(false)} data-testid="dialog-action-overlay">
            <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300" onClick={(e) => e.stopPropagation()} data-testid="dialog-action-container">
              <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${completedSteps.map(s => s.color).join(', ')}${completedSteps.length ? ', ' : ''}${nextExpectedStep.color})` }} />
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-orange-500" />
                    <h3 className="text-lg font-semibold text-foreground" data-testid="dialog-action-title">
                      {t.contractsModule.title} #{contract.contractNumber}
                    </h3>
                  </div>
                  <button onClick={() => setShowActionDialog(false)} className="text-muted-foreground hover:text-foreground rounded-full p-1 hover:bg-muted transition-colors" data-testid="button-close-action-dialog">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-xl border-2 mb-5" style={{ borderColor: `${nextExpectedStep.color}40`, backgroundColor: `${nextExpectedStep.color}08` }}>
                  <div className="flex items-center justify-center rounded-full shrink-0 animate-timeline-pulse" style={{ width: 48, height: 48, backgroundColor: `${nextExpectedStep.color}15`, border: `2px solid ${nextExpectedStep.color}`, ["--pulse-color" as any]: nextExpectedStep.color }}>
                    <NextIcon style={{ width: 22, height: 22, color: nextExpectedStep.color }} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{t.contractsModule.legacy?.nextAction || "Next expected action"}</p>
                    <p className="text-lg font-bold" style={{ color: nextExpectedStep.color }} data-testid="text-next-action-label">
                      {nextExpectedStep.label}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 mb-5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t.contractsModule.legacy?.completedSteps || "Completed steps"}</p>
                  <div className="flex flex-wrap gap-2">
                    {lifecycleStepsDef.map((step) => {
                      const StIcon = step.icon;
                      const done = !!formState[step.id];
                      const isNext = step.id === nextExpectedStep.id;
                      return (
                        <div key={step.id} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${done ? "text-white" : isNext ? "border-2 animate-pulse" : "bg-muted text-muted-foreground"}`} style={done ? { backgroundColor: step.color } : isNext ? { borderColor: step.color, color: step.color } : {}} data-testid={`chip-step-${step.id}`}>
                          <StIcon className="h-3 w-3" />
                          {step.label}
                          {done && <CheckCircle className="h-3 w-3" />}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Button className="w-full" style={{ backgroundColor: nextExpectedStep.color, color: "white" }} onClick={() => setShowActionDialog(false)} data-testid="button-action-understood">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  OK
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

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
          {contract.dataSource === "iscbc" && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 border-orange-400 text-orange-600 dark:text-orange-400" data-testid="badge-iscbc">ISCBC</Badge>
          )}
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
          {contract.dataSource === "iscbc" && (
            <>
              <TabsTrigger value="phone" data-testid="tab-phone">
                <Phone className="h-4 w-4 mr-1" />
                {t.contractsModule.legacy?.tabPhone || "Phone"}
                {phoneCommunications.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0 h-4">{phoneCommunications.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="remarks" data-testid="tab-remarks">
                <StickyNote className="h-4 w-4 mr-1" />
                {t.contractsModule.legacy?.tabRemarks || "Remarks"}
                {contractRemarks.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0 h-4">{contractRemarks.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="history" data-testid="tab-history">
                <Clock className="h-4 w-4 mr-1" />
                {t.contractsModule.legacy?.tabHistory || "History"}
              </TabsTrigger>
              <TabsTrigger value="legacy" data-testid="tab-legacy">
                <Shield className="h-4 w-4 mr-1" />
                Legacy
              </TabsTrigger>
            </>
          )}
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
                <CardContent className="pt-5 pb-4 px-2">
                  <div className="relative" data-testid="contract-lifecycle-timeline">
                    <div className="flex items-start">
                      {lifecycleSteps.map((step, i) => {
                        const StepIcon = step.icon;
                        const hasDate = !!formState[step.id];
                        const isCompleted = hasDate;
                        const isActive = i === completedIndex + 1 && !hasDate;
                        const isPast = i <= completedIndex;
                        return (
                          <div key={step.id} className="flex-1 flex flex-col items-center relative" style={{ minWidth: 0 }}>
                            <div className="flex items-center w-full">
                              {i > 0 && (
                                <div className="flex-1 h-0.5" style={{ backgroundColor: isPast ? step.color : "hsl(var(--border))" }} />
                              )}
                              <div
                                className={`relative z-10 flex items-center justify-center rounded-full shrink-0 transition-all ${isActive ? "animate-timeline-pulse" : ""}`}
                                style={{
                                  width: isActive ? 32 : 26,
                                  height: isActive ? 32 : 26,
                                  backgroundColor: isCompleted ? step.color : isActive ? "hsl(var(--background))" : "hsl(var(--muted))",
                                  border: isActive ? `2px solid ${step.color}` : isCompleted ? "none" : "2px solid hsl(var(--border))",
                                  boxShadow: isActive ? `0 0 0 3px ${step.color}30` : isCompleted ? `0 2px 4px ${step.color}40` : "none",
                                  ["--pulse-color" as any]: step.color,
                                }}
                              >
                                <StepIcon
                                  className="transition-all"
                                  style={{
                                    width: isActive ? 14 : 12,
                                    height: isActive ? 14 : 12,
                                    color: isCompleted ? "white" : isActive ? step.color : "hsl(var(--muted-foreground))",
                                  }}
                                />
                              </div>
                              {i < lifecycleSteps.length - 1 && (
                                <div className="flex-1 h-0.5" style={{ backgroundColor: isPast && i < completedIndex ? lifecycleSteps[i + 1].color : "hsl(var(--border))" }} />
                              )}
                            </div>
                            <p className="text-[9px] leading-tight text-center mt-1 px-0.5 font-medium truncate w-full" style={{ color: isCompleted ? step.color : isActive ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))" }}>
                              {step.label}
                            </p>
                            {hasDate ? (
                              <p className="text-[8px] text-muted-foreground text-center mt-0.5">
                                {formatDate(formState[step.id], contractCountryCode)}
                              </p>
                            ) : isActive ? (
                              <p className="text-[8px] text-center mt-0.5 font-medium animate-pulse" style={{ color: step.color }}>
                                ●
                              </p>
                            ) : null}
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
                {(() => {
                  const lifecycleDateFields = [
                    { id: "contactDate", label: t.contractsModule.fieldContactDate, icon: Phone },
                    { id: "filledDate", label: t.contractsModule.fieldFilledDate, icon: Edit },
                    { id: "createdContractDate", label: t.contractsModule.fieldCreatedContractDate, icon: FileText },
                    { id: "sentContractDate", label: t.contractsModule.fieldSentDate, icon: Send },
                    { id: "receivedByClientDate", label: t.contractsModule.fieldReceivedDate, icon: Download },
                    { id: "returnedDate", label: t.contractsModule.fieldReturnedDate, icon: ArrowLeft },
                    { id: "verifiedDate", label: t.contractsModule.fieldVerifiedDate, icon: Shield },
                    { id: "executedDate", label: t.contractsModule.fieldExecutedDate, icon: CheckCircle },
                  ];
                  const lcCompletedIdx = lifecycleDateFields.reduce((last, f, i) => formState[f.id] ? i : last, -1);
                  const nextExpectedId = lcCompletedIdx < lifecycleDateFields.length - 1 ? lifecycleDateFields[lcCompletedIdx + 1]?.id : null;
                  return lifecycleDateFields.map(({ id, label, icon: Icon }) => {
                    const isNextExpected = id === nextExpectedId && !formState[id];
                    return (
                      <div key={id} className={`space-y-1.5 rounded-lg p-2 transition-all ${isNextExpected ? "ring-2 ring-orange-400/60 bg-orange-50/50 dark:bg-orange-950/20 animate-field-pulse" : ""}`}>
                        <Label htmlFor={id} className={`text-xs flex items-center gap-1.5 ${isNextExpected ? "text-orange-600 dark:text-orange-400 font-semibold" : "text-muted-foreground"}`}>
                          <Icon className="h-3.5 w-3.5" />
                          {label}
                          {isNextExpected && <span className="ml-1 text-[9px] uppercase tracking-wider bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded-full">awaiting</span>}
                        </Label>
                        <DateTimePicker
                          value={formState[id] || ""}
                          onChange={(v) => updateField(id, v)}
                          countryCode={contractCountryCode}
                          data-testid={`input-${id}`}
                        />
                      </div>
                    );
                  });
                })()}
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

          {contract.dataSource === "iscbc" && contract.legacyData && (
            <ContractLegacyProductsInline contract={contract} />
          )}
        </TabsContent>

        <TabsContent value="collections" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t.contractsModule.tabCollections}</CardTitle>
            </CardHeader>
            <CardContent>
              {customerCollections.length > 0 ? (
                <div className="space-y-4">
                  {customerCollections.map((col: any) => {
                    const hospital = hospitals.find((h: Hospital) => h.id === col.hospitalId);
                    const statusObj = collectionStatuses.find(s => String(s.id) === col.state);
                    const statusLabel = statusObj ? statusObj.name : (col.state || "-");
                    return (
                      <div key={col.id} className="border rounded-lg p-4 space-y-3" data-testid={`row-collection-${col.id}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Beaker className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{col.cbuNumber || "-"}</span>
                            {col.dataSource === "iscbc" && (
                              <Badge variant="outline" className="text-[8px] px-1 py-0 bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800">
                                ISCBC
                              </Badge>
                            )}
                          </div>
                          <Badge variant="secondary">{statusLabel}</Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
                          <div>
                            <span className="text-muted-foreground text-xs">{t.contractsModule.collectionDate}:</span>
                            <p className="font-medium">{formatDateTime(col.collectionDate, contractCountryCode)}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">{t.contractsModule.fieldHospital}:</span>
                            <p className="font-medium">{hospital?.name || "-"}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">{t.contractsModule.legacy?.childName || "Child"}:</span>
                            <p className="font-medium">
                              {[col.childFirstName, col.childLastName].filter(Boolean).join(" ") || "-"}
                              {col.childGender && <span className="text-muted-foreground ml-1">({col.childGender})</span>}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">{t.contractsModule.legacy?.clientName || "Client"}:</span>
                            <p className="font-medium">{[col.clientFirstName, col.clientLastName].filter(Boolean).join(" ") || "-"}</p>
                          </div>
                          {col.clientMobile && (
                            <div>
                              <span className="text-muted-foreground text-xs">{t.contractsModule.legacy?.phoneNumber || "Mobile"}:</span>
                              <p className="font-medium">{col.clientMobile}</p>
                            </div>
                          )}
                          {col.responsibleCoordinatorId && (
                            <div>
                              <span className="text-muted-foreground text-xs">{t.contractsModule.legacy?.coordinator || "Coordinator"}:</span>
                              <p className="font-medium">{col.responsibleCoordinatorId}</p>
                            </div>
                          )}
                          {col.doctorNote && (
                            <div className="col-span-2">
                              <span className="text-muted-foreground text-xs">{t.contractsModule.legacy?.doctorNote || "Doctor note"}:</span>
                              <p className="text-sm">{col.doctorNote}</p>
                            </div>
                          )}
                          {col.note && (
                            <div className="col-span-2">
                              <span className="text-muted-foreground text-xs">{t.contractsModule.legacy?.note || "Note"}:</span>
                              <p className="text-sm">{col.note}</p>
                            </div>
                          )}
                        </div>
                        {(col.statusPairedAt || col.statusEvaluatedAt || col.statusStoredAt || col.statusDisposedAt) && (
                          <div className="border-t pt-2 mt-2">
                            <div className="flex flex-wrap gap-3 text-[11px]">
                              {col.statusPairedAt && (
                                <span className="text-muted-foreground">{t.contractsModule.legacy?.paired || "Paired"}: <span className="font-medium text-foreground">{formatDate(col.statusPairedAt, contractCountryCode)}</span></span>
                              )}
                              {col.statusEvaluatedAt && (
                                <span className="text-muted-foreground">{t.contractsModule.legacy?.evaluated || "Evaluated"}: <span className="font-medium text-foreground">{formatDate(col.statusEvaluatedAt, contractCountryCode)}</span></span>
                              )}
                              {col.statusVerifiedAt && (
                                <span className="text-muted-foreground">{t.contractsModule.legacy?.verified || "Verified"}: <span className="font-medium text-foreground">{formatDate(col.statusVerifiedAt, contractCountryCode)}</span></span>
                              )}
                              {col.statusStoredAt && (
                                <span className="text-muted-foreground">{t.contractsModule.legacy?.stored || "Stored"}: <span className="font-medium text-foreground">{formatDate(col.statusStoredAt, contractCountryCode)}</span></span>
                              )}
                              {col.statusTransferredAt && (
                                <span className="text-muted-foreground">{t.contractsModule.legacy?.transferred || "Transferred"}: <span className="font-medium text-foreground">{formatDate(col.statusTransferredAt, contractCountryCode)}</span></span>
                              )}
                              {col.statusReleasedAt && (
                                <span className="text-muted-foreground">{t.contractsModule.legacy?.released || "Released"}: <span className="font-medium text-foreground">{formatDate(col.statusReleasedAt, contractCountryCode)}</span></span>
                              )}
                              {col.statusDisposedAt && (
                                <span className="text-muted-foreground">{t.contractsModule.legacy?.disposed || "Disposed"}: <span className="font-medium text-foreground">{formatDate(col.statusDisposedAt, contractCountryCode)}</span></span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
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
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-1.5">
                            {inv.invoiceNumber}
                            {inv.dataSource === "iscbc" && (
                              <Badge variant="outline" className="text-[8px] px-1 py-0 bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800">
                                ISCBC
                              </Badge>
                            )}
                          </div>
                        </TableCell>
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
                        case "otp_resent": return <RefreshCw className="h-4 w-4" />;
                        case "otp_send_failed": return <AlertCircle className="h-4 w-4" />;
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
                        otp_resent: t.contractsModule.auditEventOtpResent,
                        otp_send_failed: t.contractsModule.auditEventOtpSendFailed,
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
                        case "otp_resent": return "text-amber-500";
                        case "otp_send_failed": return "text-destructive";
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

        {contract.dataSource === "iscbc" && (
          <>
            <TabsContent value="phone" className="space-y-4">
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {t.contractsModule.legacy?.tabPhone || "Phone Communications"} ({phoneCommunications.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {phoneCommunications.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">{t.contractsModule.legacy?.noPhoneCalls || "No phone communications"}</p>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="text-xs">{t.contractsModule.legacy?.callDate || "Date"}</TableHead>
                            <TableHead className="text-xs">{t.contractsModule.legacy?.caller || "Caller"}</TableHead>
                            <TableHead className="text-xs">{t.contractsModule.legacy?.phoneNumber || "Phone"}</TableHead>
                            <TableHead className="text-xs">{t.contractsModule.legacy?.note || "Note"}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {phoneCommunications.map((p: any) => (
                            <TableRow key={p.id} className="text-xs" data-testid={`row-phone-${p.id}`}>
                              <TableCell>{formatDateTime(p.sent_at, contractCountryCode)}</TableCell>
                              <TableCell className="font-medium">{p.user_id || "-"}</TableCell>
                              <TableCell>{p.recipient_phone || "-"}</TableCell>
                              <TableCell className="max-w-[400px]">
                                <p className="whitespace-pre-wrap break-words">{p.content || "-"}</p>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="remarks" className="space-y-4">
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <StickyNote className="h-4 w-4" />
                    {t.contractsModule.legacy?.tabRemarks || "Remarks"} ({contractRemarks.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {contractRemarks.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">{t.contractsModule.legacy?.noRemarks || "No remarks"}</p>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="text-xs">{t.contractsModule.legacy?.remarkDate || "Date"}</TableHead>
                            <TableHead className="text-xs">{t.contractsModule.legacy?.author || "Author"}</TableHead>
                            <TableHead className="text-xs">{t.contractsModule.legacy?.note || "Note"}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {contractRemarks.map((r: any) => (
                            <TableRow key={r.id} className="text-xs" data-testid={`row-remark-${r.id}`}>
                              <TableCell className="whitespace-nowrap">{formatDateTime(r.created_at, contractCountryCode)}</TableCell>
                              <TableCell className="font-medium">{r.user_id || "-"}</TableCell>
                              <TableCell className="max-w-[500px]">
                                <p className="whitespace-pre-wrap break-words">{r.content || "-"}</p>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <ContractHistoryTab contract={contract} formatDate={formatDate} formatDateTime={formatDateTime} countryCode={contractCountryCode} />
            </TabsContent>

            <TabsContent value="legacy" className="space-y-4">
              <ContractLegacyTab contract={contract} invoices={invoices} formatDate={formatDate} countryCode={contractCountryCode} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}

function ContractHistoryTab({ contract, formatDate: fmtDate, formatDateTime: fmtDateTime, countryCode }: { contract: any; formatDate: (d: any, cc?: string) => string; formatDateTime: (d: any, cc?: string) => string; countryCode: string }) {
  const { t } = useI18n();
  const legacy = contract.legacyData as Record<string, any> | null;
  const contractHistory: any[] = legacy?.contractHistory || [];

  const dateFields = [
    { key: "contactDate", label: t.contractsModule.fieldContactDate, status: "contacted" },
    { key: "filledDate", label: t.contractsModule.fieldFilledDate, status: "filled" },
    { key: "createdContractDate", label: t.contractsModule.fieldCreatedContractDate, status: "created" },
    { key: "sentContractDate", label: t.contractsModule.fieldSentContractDate, status: "sent" },
    { key: "receivedByClientDate", label: t.contractsModule.fieldReceivedByClientDate, status: "received" },
    { key: "returnedDate", label: t.contractsModule.fieldReturnedDate, status: "returned" },
    { key: "verifiedDate", label: t.contractsModule.fieldVerifiedDate, status: "verified" },
    { key: "executedDate", label: t.contractsModule.fieldExecutedDate, status: "executed" },
    { key: "terminatedDate", label: t.contractsModule.fieldTerminatedDate, status: "terminated" },
    { key: "cancelledAt", label: t.contractsModule.fieldCancelledAt, status: "cancelled" },
    { key: "collectionKitSentDate", label: t.contractsModule.fieldCollectionKitSentDate, status: "kit_sent" },
  ];

  const timeline = dateFields
    .filter(f => contract[f.key])
    .map(f => ({ date: new Date(contract[f.key]), label: f.label, status: f.status }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {t.contractsModule.legacy?.contractTimeline || "Contract Timeline"}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">{t.contractsModule.legacy?.noHistory || "No history available"}</p>
          ) : (
            <div className="space-y-3">
              {timeline.map((item, idx) => (
                <div key={idx} className="flex items-start gap-3" data-testid={`timeline-${item.status}`}>
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full mt-1 ${
                      item.status === "cancelled" || item.status === "terminated"
                        ? "bg-red-500" : "bg-green-500"
                    }`} />
                    {idx < timeline.length - 1 && <div className="w-0.5 h-6 bg-muted-foreground/20 mt-1" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{fmtDateTime(item.date, countryCode)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {contractHistory.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="h-4 w-4" />
              {t.contractsModule.legacy?.statusChanges || "Status Changes"} ({contractHistory.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs">#</TableHead>
                    <TableHead className="text-xs">{t.contractsModule.legacy?.callDate || "Date"}</TableHead>
                    <TableHead className="text-xs">{t.contractsModule.legacy?.changedBy || "Changed by"}</TableHead>
                    <TableHead className="text-xs">{t.contractsModule.legacy?.note || "Note"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contractHistory.map((h: any, idx: number) => (
                    <TableRow key={idx} className="text-xs">
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {h.hco_inserted ? fmtDateTime(h.hco_inserted, countryCode) : (h.hcs_inserted ? fmtDateTime(h.hcs_inserted, countryCode) : "-")}
                      </TableCell>
                      <TableCell>{h.hco_inserted_by || h.hcs_inserted_by || "-"}</TableCell>
                      <TableCell className="max-w-[300px]">
                        <p className="whitespace-pre-wrap break-words text-xs">
                          {h.hco_note || h.hcs_note || h.csa_code || JSON.stringify(h).substring(0, 120)}
                        </p>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ContractLegacyProductsInline({ contract }: { contract: any }) {
  const { t } = useI18n();
  const legacy = contract.legacyData as Record<string, any> | null;
  const [expandedSP, setExpandedSP] = useState<Record<string, boolean>>({});

  if (!legacy) return null;

  const contractServices: any[] = legacy.contractServices || [];
  const serviceHistory: any[] = legacy.serviceHistory || [];
  const surcharges: any[] = legacy.surcharges || [];
  const schedules: any[] = legacy.schedules || [];

  const historyForCse = (cseId: number) => serviceHistory.filter((h: any) => h.cse_id === cseId);
  const surchargesForCse = (cseId: number) => surcharges.filter((s: any) => s.cse_id === cseId);

  const fmtNum = (val: any) => {
    if (val == null || val === '') return '-';
    const n = parseFloat(String(val));
    return isNaN(n) ? '-' : n.toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const fmtDateTime = (val: any) => {
    if (!val) return '-';
    try { return new Date(val).toLocaleDateString('sk-SK'); } catch { return '-'; }
  };
  const fmtDt = fmtDateTime;

  const hasProduct = legacy.mpr_name || legacy.mpi_name || legacy.cte_name;
  const hasData = hasProduct || contractServices.length > 0 || schedules.length > 0;

  if (!hasData) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800">
          <Shield className="h-3 w-3 mr-1" />
          ISCBC
        </Badge>
      </div>

      {hasProduct && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4" />
              {t.contractsModule.legacy?.product || "Product"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              {legacy.mpr_name && (
                <div data-testid="inline-legacy-product-name">
                  <span className="text-muted-foreground text-xs">{t.contractsModule.legacy?.product || "Product"}:</span>
                  <p className="font-medium">{legacy.mpr_name}</p>
                </div>
              )}
              {legacy.pot_marketproduct_ft && legacy.pot_marketproduct_ft !== legacy.mpr_name && (
                <div data-testid="inline-legacy-product-type">
                  <span className="text-muted-foreground text-xs">{t.contractsModule.legacy?.productType || "Product type"}:</span>
                  <p className="font-medium">{legacy.pot_marketproduct_ft}</p>
                </div>
              )}
              {legacy.mpi_name && (
                <div data-testid="inline-legacy-instance-name">
                  <span className="text-muted-foreground text-xs">{t.contractsModule.legacy?.instanceName || "Instance"}:</span>
                  <p className="font-medium">{legacy.mpi_name}</p>
                </div>
              )}
              {legacy.cte_name && (
                <div data-testid="inline-legacy-template-name">
                  <span className="text-muted-foreground text-xs">{t.contractsModule.legacy?.templateName || "Template"}:</span>
                  <p className="font-medium">{legacy.cte_name}</p>
                  {legacy.cte_template_number && (
                    <p className="text-[10px] text-muted-foreground font-mono">{legacy.cte_template_number}</p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {contractServices.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Layers className="h-4 w-4" />
              {t.contractsModule.legacy?.services || "Services"} ({contractServices.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {contractServices.map((svc: any, idx: number) => {
                const svcHistory = historyForCse(svc.cse_id);
                const svcSurcharges = surchargesForCse(svc.cse_id);
                const isExp = expandedSP[`svc_${idx}`] || false;
                const setExp = (v: boolean) => setExpandedSP((prev: any) => ({ ...prev, [`svc_${idx}`]: v }));

                return (
                  <div key={idx} className="border rounded-lg overflow-hidden" data-testid={`inline-legacy-service-${idx}`}>
                    <div
                      className="flex items-center justify-between p-3 bg-muted/20 cursor-pointer hover:bg-muted/40"
                      onClick={() => (svcHistory.length > 0 || svcSurcharges.length > 0) && setExp(!isExp)}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{svc.sin_name || svc.ser_name || `Service ${idx + 1}`}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {svc.ser_company && <span className="text-[10px] text-muted-foreground">{svc.ser_company}</span>}
                            <div className="flex gap-1">
                              {svc.ser_is_invoicable && <Badge variant="outline" className="text-[9px] px-1 py-0">F</Badge>}
                              {svc.ser_is_collectable && <Badge variant="outline" className="text-[9px] px-1 py-0">O</Badge>}
                              {svc.ser_is_storable && <Badge variant="outline" className="text-[9px] px-1 py-0">S</Badge>}
                            </div>
                          </div>
                        </div>
                        <div className="text-right text-sm shrink-0">
                          {(parseFloat(svc.cse_original_price) > 0 || parseFloat(svc.cse_actual_price) > 0) ? (
                            <>
                              <div>
                                <span className="text-muted-foreground text-xs mr-1">{t.contractsModule.legacy?.originalPrice || "Original"}:</span>
                                <span className="font-medium">{fmtNum(svc.cse_original_price)}</span>
                              </div>
                              {parseFloat(svc.cse_actual_price) !== parseFloat(svc.cse_original_price) && (
                                <div>
                                  <span className="text-muted-foreground text-xs mr-1">{t.contractsModule.legacy?.actualPrice || "Actual"}:</span>
                                  <span className="font-medium text-green-600 dark:text-green-400">{fmtNum(svc.cse_actual_price)}</span>
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">{t.contractsModule.legacy?.seeInvoices || "see invoices"}</span>
                          )}
                        </div>
                      </div>
                      {(svcHistory.length > 0 || svcSurcharges.length > 0) && (
                        <div className="ml-2 flex items-center gap-1">
                          <History className="h-4 w-4 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground">{svcHistory.length + svcSurcharges.length}</span>
                        </div>
                      )}
                    </div>
                    {isExp && (
                      <div className="border-t">
                        {svcHistory.length > 0 && (
                          <div>
                            <div className="px-3 py-1 bg-muted/10 text-[10px] font-medium text-muted-foreground">
                              {t.contractsModule.legacy?.priceHistory || "Price History"}
                            </div>
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/5">
                                  <TableHead className="text-[10px]">{t.contractsModule.legacy?.priceChange || "Price"}</TableHead>
                                  <TableHead className="text-[10px]">{t.contractsModule.legacy?.validFrom || "Valid from"}</TableHead>
                                  <TableHead className="text-[10px]">{t.contractsModule.legacy?.validTo || "Valid to"}</TableHead>
                                  <TableHead className="text-[10px]">{t.contractsModule.legacy?.current || "Current"}</TableHead>
                                  <TableHead className="text-[10px]">{t.contractsModule.legacy?.changedBy || "Changed by"}</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {svcHistory.map((h: any, hIdx: number) => (
                                  <TableRow key={hIdx} className="text-[10px]">
                                    <TableCell className="font-medium">{fmtNum(h.hcs_price)}</TableCell>
                                    <TableCell>{fmtDateTime(h.hcs_from)}</TableCell>
                                    <TableCell>{fmtDt(h.hcs_to)}</TableCell>
                                    <TableCell>
                                      {h.hcs_actual ? <Badge variant="default" className="text-[9px] px-1 py-0">✓</Badge> : <span className="text-muted-foreground">-</span>}
                                    </TableCell>
                                    <TableCell>{h.hcs_inserted_by || '-'}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                        {svcSurcharges.length > 0 && (
                          <div>
                            <div className="px-3 py-1 bg-muted/10 text-[10px] font-medium text-muted-foreground">
                              {t.contractsModule.legacy?.discounts || "Discounts / Surcharges"}
                            </div>
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/5">
                                  <TableHead className="text-[10px]">{t.contractsModule.legacy?.discountName || "Name"}</TableHead>
                                  <TableHead className="text-[10px]">{t.contractsModule.legacy?.originalPrice || "Original"}</TableHead>
                                  <TableHead className="text-[10px]">{t.contractsModule.legacy?.actualPrice || "Actual"}</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {svcSurcharges.map((s: any, sIdx: number) => (
                                  <TableRow key={sIdx} className="text-[10px]">
                                    <TableCell>{s.pls_name || s.pls_invoice_item_name || '-'}</TableCell>
                                    <TableCell className={parseFloat(s.css_original_price) < 0 ? 'text-red-600 dark:text-red-400 font-medium' : 'font-medium'}>{fmtNum(s.css_original_price)}</TableCell>
                                    <TableCell className={parseFloat(s.css_actual_price) < 0 ? 'text-red-600 dark:text-red-400 font-medium' : 'font-medium'}>{fmtNum(s.css_actual_price)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {schedules.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {t.contractsModule.legacy?.installments || "Installments"} ({schedules.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {schedules.map((sch: any, idx: number) => (
                <div key={idx} className="border rounded-lg overflow-hidden" data-testid={`inline-legacy-schedule-${idx}`}>
                  <div className="p-3 bg-muted/20">
                    <p className="text-sm font-medium">{sch.csh_name || `Schedule ${idx + 1}`}</p>
                    <p className="text-[10px] text-muted-foreground">{fmtDateTime(sch.csh_inserted)} — {sch.csh_inserted_by || '-'}</p>
                  </div>
                  {sch.payments && sch.payments.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/10">
                          <TableHead className="text-[10px]">#</TableHead>
                          <TableHead className="text-[10px]">{t.contractsModule.legacy?.installmentName || "Name"}</TableHead>
                          <TableHead className="text-[10px] text-right">{t.contractsModule.legacy?.amount || "Amount"}</TableHead>
                          <TableHead className="text-[10px]">{t.contractsModule.legacy?.daysFromRealized || "Days"}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sch.payments.map((p: any, pIdx: number) => (
                          <TableRow key={pIdx} className="text-[10px]">
                            <TableCell>{p.csy_installments_id || pIdx + 1}</TableCell>
                            <TableCell>{p.csy_name || '-'}</TableCell>
                            <TableCell className="text-right font-medium">{fmtNum(p.csy_amount)}</TableCell>
                            <TableCell>
                              {p.csy_days_from_field_value > 0 ? `${p.csy_days_from_field_value}d` : ''}
                              {p.csy_days_from_previous > 0 ? `+${p.csy_days_from_previous}d` : ''}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ContractLegacyTab({ contract, invoices, formatDate: fmtDate, countryCode }: { contract: any; invoices: any[]; formatDate: (d: any, cc?: string) => string; countryCode: string }) {
  const { t } = useI18n();
  const legacy = contract.legacyData as Record<string, any> | null;
  const [expandedSP, setExpandedSP] = useState<Record<string, boolean>>({});

  const contractInvoices = useMemo(() => {
    return invoices.filter((inv: any) => inv.contractInstanceId === contract.id && inv.dataSource === 'iscbc');
  }, [invoices, contract.id]);

  if (!legacy) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>{"No legacy data available"}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const prepayments: any[] = legacy.prepayments || [];
  const servicePayments: any[] = legacy.servicePayments || [];
  const servicePaymentHistory: any[] = legacy.servicePaymentHistory || [];
  const contractServices: any[] = legacy.contractServices || [];
  const serviceHistory: any[] = legacy.serviceHistory || [];
  const surcharges: any[] = legacy.surcharges || [];
  const surchargeHistory: any[] = legacy.surchargeHistory || [];
  const schedules: any[] = legacy.schedules || [];

  const fmtNum = (val: any) => {
    if (val == null || val === '') return '-';
    const n = parseFloat(String(val));
    return isNaN(n) ? '-' : n.toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const fmtDt = (val: any) => {
    if (!val) return '-';
    try { return new Date(val).toLocaleDateString('sk-SK'); } catch { return '-'; }
  };

  const fmtDateTime = (val: any) => {
    if (!val) return '-';
    try { return new Date(val).toLocaleString('sk-SK'); } catch { return '-'; }
  };

  const historyForCsp = (cspId: number) => servicePaymentHistory.filter((h: any) => h.csp_id === cspId);
  const historyForCse = (cseId: number) => serviceHistory.filter((h: any) => h.cse_id === cseId);
  const surchargesForCse = (cseId: number) => surcharges.filter((s: any) => s.cse_id === cseId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800">
          <Shield className="h-3 w-3 mr-1" />
          ISCBC Legacy Data
        </Badge>
        {legacy.con_id && (
          <span className="text-xs text-muted-foreground">con_id: {legacy.con_id}</span>
        )}
      </div>

      {(legacy.mpr_name || legacy.mpi_name || legacy.cte_name) && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4" />
              {t.contractsModule.legacy?.product || "Product"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              {legacy.mpr_name && (
                <div data-testid="legacy-product-name">
                  <span className="text-muted-foreground text-xs">{t.contractsModule.legacy?.product || "Product"}:</span>
                  <p className="font-medium">{legacy.mpr_name}</p>
                </div>
              )}
              {legacy.pot_marketproduct_ft && legacy.pot_marketproduct_ft !== legacy.mpr_name && (
                <div data-testid="legacy-product-type">
                  <span className="text-muted-foreground text-xs">{t.contractsModule.legacy?.productType || "Product type"}:</span>
                  <p className="font-medium">{legacy.pot_marketproduct_ft}</p>
                </div>
              )}
              {legacy.mpi_name && (
                <div data-testid="legacy-instance-name">
                  <span className="text-muted-foreground text-xs">{t.contractsModule.legacy?.instanceName || "Instance"}:</span>
                  <p className="font-medium">{legacy.mpi_name}</p>
                </div>
              )}
              {legacy.cte_name && (
                <div data-testid="legacy-template-name">
                  <span className="text-muted-foreground text-xs">{t.contractsModule.legacy?.templateName || "Template"}:</span>
                  <p className="font-medium">{legacy.cte_name}</p>
                  {legacy.cte_template_number && (
                    <p className="text-[10px] text-muted-foreground font-mono">{legacy.cte_template_number}</p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {contractServices.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Layers className="h-4 w-4" />
              {t.contractsModule.legacy?.services || "Services"} ({contractServices.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {contractServices.map((svc: any, idx: number) => {
                const svcHistory = historyForCse(svc.cse_id);
                const svcSurcharges = surchargesForCse(svc.cse_id);
                const [isExpSvc, setExpSvc] = [expandedSP[`svc_${idx}`], (v: boolean) => setExpandedSP((prev: any) => ({ ...prev, [`svc_${idx}`]: v }))];

                return (
                  <div key={idx} className="border rounded-lg overflow-hidden" data-testid={`legacy-service-${idx}`}>
                    <div
                      className="flex items-center justify-between p-3 bg-muted/20 cursor-pointer hover:bg-muted/40"
                      onClick={() => (svcHistory.length > 0 || svcSurcharges.length > 0) && setExpSvc(!isExpSvc)}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{svc.sin_name || svc.ser_name || `Service ${idx + 1}`}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {svc.ser_company && <span className="text-[10px] text-muted-foreground">{svc.ser_company}</span>}
                            <div className="flex gap-1">
                              {svc.ser_is_invoicable && <Badge variant="outline" className="text-[9px] px-1 py-0">F</Badge>}
                              {svc.ser_is_collectable && <Badge variant="outline" className="text-[9px] px-1 py-0">O</Badge>}
                              {svc.ser_is_storable && <Badge variant="outline" className="text-[9px] px-1 py-0">S</Badge>}
                            </div>
                          </div>
                        </div>
                        <div className="text-right text-sm shrink-0">
                          {(parseFloat(svc.cse_original_price) > 0 || parseFloat(svc.cse_actual_price) > 0) ? (
                            <>
                              <div>
                                <span className="text-muted-foreground text-xs mr-1">{t.contractsModule.legacy?.originalPrice || "Original"}:</span>
                                <span className="font-medium">{fmtNum(svc.cse_original_price)}</span>
                              </div>
                              {parseFloat(svc.cse_actual_price) !== parseFloat(svc.cse_original_price) && (
                                <div>
                                  <span className="text-muted-foreground text-xs mr-1">{t.contractsModule.legacy?.actualPrice || "Actual"}:</span>
                                  <span className="font-medium text-green-600 dark:text-green-400">{fmtNum(svc.cse_actual_price)}</span>
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">{t.contractsModule.legacy?.seeInvoices || "see invoices"}</span>
                          )}
                        </div>
                      </div>
                      {(svcHistory.length > 0 || svcSurcharges.length > 0) && (
                        <div className="ml-2 flex items-center gap-1">
                          <History className="h-4 w-4 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground">{svcHistory.length + svcSurcharges.length}</span>
                        </div>
                      )}
                    </div>

                    {isExpSvc && (
                      <div className="border-t">
                        {svcHistory.length > 0 && (
                          <div>
                            <div className="px-3 py-1 bg-muted/10 text-[10px] font-medium text-muted-foreground">
                              {t.contractsModule.legacy?.priceHistory || "Price History"}
                            </div>
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/5">
                                  <TableHead className="text-[10px]">{t.contractsModule.legacy?.priceChange || "Price"}</TableHead>
                                  <TableHead className="text-[10px]">{t.contractsModule.legacy?.validFrom || "Valid from"}</TableHead>
                                  <TableHead className="text-[10px]">{t.contractsModule.legacy?.validTo || "Valid to"}</TableHead>
                                  <TableHead className="text-[10px]">{t.contractsModule.legacy?.current || "Current"}</TableHead>
                                  <TableHead className="text-[10px]">{t.contractsModule.legacy?.changedBy || "Changed by"}</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {svcHistory.map((h: any, hIdx: number) => (
                                  <TableRow key={hIdx} className="text-[10px]">
                                    <TableCell className="font-medium">{fmtNum(h.hcs_price)}</TableCell>
                                    <TableCell>{fmtDateTime(h.hcs_from)}</TableCell>
                                    <TableCell>{fmtDt(h.hcs_to)}</TableCell>
                                    <TableCell>
                                      {h.hcs_actual ? <Badge variant="default" className="text-[9px] px-1 py-0">✓</Badge> : <span className="text-muted-foreground">-</span>}
                                    </TableCell>
                                    <TableCell>{h.hcs_inserted_by || '-'}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                        {svcSurcharges.length > 0 && (
                          <div>
                            <div className="px-3 py-1 bg-muted/10 text-[10px] font-medium text-muted-foreground">
                              {t.contractsModule.legacy?.discounts || "Discounts / Surcharges"}
                            </div>
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/5">
                                  <TableHead className="text-[10px]">{t.contractsModule.legacy?.discountName || "Name"}</TableHead>
                                  <TableHead className="text-[10px]">{t.contractsModule.legacy?.originalPrice || "Original"}</TableHead>
                                  <TableHead className="text-[10px]">{t.contractsModule.legacy?.actualPrice || "Actual"}</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {svcSurcharges.map((s: any, sIdx: number) => (
                                  <TableRow key={sIdx} className="text-[10px]">
                                    <TableCell>{s.pls_name || s.pls_invoice_item_name || '-'}</TableCell>
                                    <TableCell className={parseFloat(s.css_original_price) < 0 ? 'text-red-600 dark:text-red-400 font-medium' : 'font-medium'}>{fmtNum(s.css_original_price)}</TableCell>
                                    <TableCell className={parseFloat(s.css_actual_price) < 0 ? 'text-red-600 dark:text-red-400 font-medium' : 'font-medium'}>{fmtNum(s.css_actual_price)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {schedules.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {t.contractsModule.legacy?.installments || "Installments"} ({schedules.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {schedules.map((sch: any, idx: number) => (
                <div key={idx} className="border rounded-lg overflow-hidden" data-testid={`legacy-schedule-${idx}`}>
                  <div className="p-3 bg-muted/20">
                    <p className="text-sm font-medium">{sch.csh_name || `Schedule ${idx + 1}`}</p>
                    <p className="text-[10px] text-muted-foreground">{fmtDateTime(sch.csh_inserted)} — {sch.csh_inserted_by || '-'}</p>
                  </div>
                  {sch.payments && sch.payments.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/10">
                          <TableHead className="text-[10px]">#</TableHead>
                          <TableHead className="text-[10px]">{t.contractsModule.legacy?.installmentName || "Name"}</TableHead>
                          <TableHead className="text-[10px] text-right">{t.contractsModule.legacy?.amount || "Amount"}</TableHead>
                          <TableHead className="text-[10px]">{t.contractsModule.legacy?.daysFromRealized || "Days"}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sch.payments.map((p: any, pIdx: number) => (
                          <TableRow key={pIdx} className="text-[10px]">
                            <TableCell>{p.csy_installments_id || pIdx + 1}</TableCell>
                            <TableCell>{p.csy_name || '-'}</TableCell>
                            <TableCell className="text-right font-medium">{fmtNum(p.csy_amount)}</TableCell>
                            <TableCell>
                              {p.csy_days_from_field_value > 0 ? `${p.csy_days_from_field_value}d` : ''}
                              {p.csy_days_from_previous > 0 ? `+${p.csy_days_from_previous}d` : ''}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            {t.contractsModule.legacy?.servicePayments || "Service Payments"} ({servicePayments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {servicePayments.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">{t.contractsModule.legacy?.noServicePayments || "No service payments"}</p>
          ) : (
            <div className="space-y-2">
              {servicePayments.map((sp: any, idx: number) => {
                const history = historyForCsp(sp.csp_id);
                const isExpanded = expandedSP[idx] || false;

                return (
                  <div key={idx} className="border rounded-lg overflow-hidden">
                    <div
                      className="flex items-center justify-between p-3 bg-muted/20 cursor-pointer hover:bg-muted/40"
                      onClick={() => history.length > 0 && setExpandedSP(prev => ({ ...prev, [idx]: !prev[idx] }))}
                      data-testid={`legacy-csp-${idx}`}
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {sp.plp_name || sp.plp_invoice_item || `Service ${idx + 1}`}
                          </p>
                          {sp.plp_invoice_item && sp.plp_name && (
                            <p className="text-xs text-muted-foreground truncate">{sp.plp_invoice_item}</p>
                          )}
                          {sp.plp_accounting_code && (
                            <p className="text-[10px] text-muted-foreground font-mono">{sp.plp_accounting_code}</p>
                          )}
                        </div>
                        <div className="text-right text-sm shrink-0">
                          {(parseFloat(sp.csp_original_price) > 0 || parseFloat(sp.csp_actual_price) > 0) ? (
                            <>
                              {parseFloat(sp.csp_original_price) > 0 && (
                                <div>
                                  <span className="text-muted-foreground text-xs mr-1">{t.contractsModule.legacy?.originalPrice || "Original"}:</span>
                                  <span className="font-medium">{fmtNum(sp.csp_original_price)}</span>
                                </div>
                              )}
                              {parseFloat(sp.csp_actual_price) > 0 && (
                                <div>
                                  <span className="text-muted-foreground text-xs mr-1">{t.contractsModule.legacy?.actualPrice || "Actual"}:</span>
                                  <span className="font-medium text-green-600 dark:text-green-400">{fmtNum(sp.csp_actual_price)}</span>
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">{t.contractsModule.legacy?.seeInvoices || "see invoices"}</span>
                          )}
                          {sp.plp_list_price != null && parseFloat(sp.plp_list_price) > 0 && sp.plp_list_price !== sp.csp_original_price && (
                            <div className="text-[10px] text-muted-foreground">
                              {t.contractsModule.legacy?.listPrice || "List"}: {fmtNum(sp.plp_list_price)}
                            </div>
                          )}
                        </div>
                      </div>
                      {history.length > 0 && (
                        <div className="ml-2 flex items-center gap-1">
                          <History className="h-4 w-4 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground">{history.length}</span>
                        </div>
                      )}
                    </div>

                    {isExpanded && history.length > 0 && (
                      <div className="border-t">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/10">
                              <TableHead className="text-[10px]">{t.contractsModule.legacy?.priceChange || "Price"}</TableHead>
                              <TableHead className="text-[10px]">{t.contractsModule.legacy?.validFrom || "Valid from"}</TableHead>
                              <TableHead className="text-[10px]">{t.contractsModule.legacy?.validTo || "Valid to"}</TableHead>
                              <TableHead className="text-[10px]">{t.contractsModule.legacy?.current || "Current"}</TableHead>
                              <TableHead className="text-[10px]">{t.contractsModule.legacy?.changedBy || "Changed by"}</TableHead>
                              <TableHead className="text-[10px]">{t.contractsModule.legacy?.note || "Note"}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {history.map((h: any, hIdx: number) => (
                              <TableRow key={hIdx} className="text-[10px]">
                                <TableCell className="font-medium">{fmtNum(h.hsp_price)}</TableCell>
                                <TableCell>{fmtDt(h.hsp_from)}</TableCell>
                                <TableCell>{fmtDt(h.hsp_to)}</TableCell>
                                <TableCell>
                                  {h.hsp_actual ? (
                                    <Badge variant="default" className="text-[9px] px-1 py-0">✓</Badge>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell>{h.hsp_inserted_by || '-'}</TableCell>
                                <TableCell className="max-w-[120px] truncate">{h.hsp_note || '-'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {contractInvoices.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              {t.contractsModule.tabInvoices || "Invoices"} — {t.contractsModule.legacy?.actualPrice || "Actual"} ({contractInvoices.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs">{t.contractsModule.invoiceNumber || "Invoice #"}</TableHead>
                    <TableHead className="text-xs">{t.invoicesModule?.issueDate || "Issue date"}</TableHead>
                    <TableHead className="text-xs">{t.contractsModule.invoiceStatus || "Status"}</TableHead>
                    <TableHead className="text-xs text-right">{t.invoices?.legacy?.totalHome || "Total (home)"}</TableHead>
                    <TableHead className="text-xs text-right">{t.invoices?.legacy?.totalAccount || "Total (acc.)"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contractInvoices.map((inv: any, idx: number) => {
                    const items: any[] = inv.legacyData?.items || [];
                    const totalHome = items.reduce((sum: number, it: any) => sum + (parseFloat(it.iit_price_cur_home_with_vat) || 0), 0);
                    const totalAccount = items.reduce((sum: number, it: any) => sum + (parseFloat(it.iit_price_cur_account_with_vat) || 0), 0);
                    return (
                      <TableRow key={idx} className="text-xs">
                        <TableCell className="font-medium">{inv.invoiceNumber || inv.legacyData?.inv_number || '-'}</TableCell>
                        <TableCell>{fmtDt(inv.issueDate || inv.legacyData?.inv_date_of_issue)}</TableCell>
                        <TableCell>
                          <Badge variant={inv.status === 'paid' ? 'default' : 'secondary'} className="text-[9px] px-1 py-0">
                            {inv.legacyData?.ips_code || inv.status || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">{fmtNum(totalHome)}</TableCell>
                        <TableCell className="text-right font-medium">{fmtNum(totalAccount)}</TableCell>
                      </TableRow>
                    );
                  })}
                  {contractInvoices.length > 0 && (() => {
                    const allItems = contractInvoices.flatMap((inv: any) => inv.legacyData?.items || []);
                    const grandHome = allItems.reduce((sum: number, it: any) => sum + (parseFloat(it.iit_price_cur_home_with_vat) || 0), 0);
                    const grandAccount = allItems.reduce((sum: number, it: any) => sum + (parseFloat(it.iit_price_cur_account_with_vat) || 0), 0);
                    return (
                      <TableRow className="text-xs font-bold bg-muted/20 border-t-2">
                        <TableCell colSpan={3} className="text-right">{t.contractsModule.legacy?.actualPrice || "Total"}:</TableCell>
                        <TableCell className="text-right text-green-600 dark:text-green-400">{fmtNum(grandHome)}</TableCell>
                        <TableCell className="text-right text-green-600 dark:text-green-400">{fmtNum(grandAccount)}</TableCell>
                      </TableRow>
                    );
                  })()}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Download className="h-4 w-4" />
            {t.contractsModule.legacy?.prepayments || "Prepayments"} ({prepayments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {prepayments.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">{t.contractsModule.legacy?.noPrepayments || "No prepayments"}</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs">#</TableHead>
                    <TableHead className="text-xs">{t.contractsModule.legacy?.paymentDate || "Payment date"}</TableHead>
                    <TableHead className="text-xs text-right">{t.contractsModule.legacy?.amount || "Amount"}</TableHead>
                    <TableHead className="text-xs">{t.contractsModule.legacy?.note || "Note"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prepayments.map((p: any, idx: number) => (
                    <TableRow key={idx} className="text-xs">
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>{fmtDt(p.pre_date_of_payment)}</TableCell>
                      <TableCell className="text-right font-medium text-green-600 dark:text-green-400">{fmtNum(p.pre_prepaid_amount)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{p.pre_note || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">{t.contractsModule.legacy?.additionalInfo || "Additional legacy info"}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            {legacy.pot_product_ft && (
              <div>
                <span className="text-muted-foreground text-xs">{t.contractsModule.legacy?.product || "Product"}:</span>
                <p className="font-medium">{legacy.pot_product_ft}</p>
              </div>
            )}
            {legacy.pot_payment_type_ft && (
              <div>
                <span className="text-muted-foreground text-xs">{t.contractsModule.legacy?.paymentType || "Payment type"}:</span>
                <p className="font-medium">{legacy.pot_payment_type_ft}</p>
              </div>
            )}
            {legacy.pot_recruiting_ft && (
              <div>
                <span className="text-muted-foreground text-xs">{t.contractsModule.legacy?.recruiting || "Recruiting"}:</span>
                <p className="font-medium">{legacy.pot_recruiting_ft}</p>
              </div>
            )}
            {legacy.con_repository && (
              <div>
                <span className="text-muted-foreground text-xs">{t.contractsModule.legacy?.repository || "Repository"}:</span>
                <p className="font-medium font-mono text-xs">{legacy.con_repository}</p>
              </div>
            )}
            {legacy.con_saving_bank && (
              <div>
                <span className="text-muted-foreground text-xs">{t.contractsModule.legacy?.savingBank || "Saving bank"}:</span>
                <p className="font-medium">{legacy.con_saving_bank}</p>
              </div>
            )}
            {legacy.con_refinancing_detail && (
              <div>
                <span className="text-muted-foreground text-xs">{t.contractsModule.legacy?.refinancing || "Refinancing"}:</span>
                <p className="font-medium">{legacy.con_refinancing_detail}</p>
              </div>
            )}
            {legacy.pot_children != null && (
              <div>
                <span className="text-muted-foreground text-xs">{t.contractsModule.legacy?.children || "Children"}:</span>
                <p className="font-medium">{legacy.pot_children}</p>
              </div>
            )}
            {legacy.con_invoicing_postponed != null && (
              <div>
                <span className="text-muted-foreground text-xs">{t.contractsModule.legacy?.invoicingPostponed || "Invoicing postponed"}:</span>
                <p className="font-medium">{legacy.con_invoicing_postponed ? "✓" : "-"}</p>
              </div>
            )}
            {(legacy.con_invoices_by_email != null || legacy.con_invoices_by_letter != null) && (
              <div>
                <span className="text-muted-foreground text-xs">{t.contractsModule.legacy?.invoiceDelivery || "Invoice delivery"}:</span>
                <p className="font-medium">
                  {legacy.con_invoices_by_email ? "Email" : ""}{legacy.con_invoices_by_email && legacy.con_invoices_by_letter ? " + " : ""}{legacy.con_invoices_by_letter ? "Letter" : ""}
                  {!legacy.con_invoices_by_email && !legacy.con_invoices_by_letter ? "-" : ""}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
