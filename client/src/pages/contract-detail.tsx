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
import { format } from "date-fns";
import { ArrowLeft, Save, FileText, Users, Package, Beaker, Receipt, Loader2, Download, ExternalLink } from "lucide-react";
import type { ContractInstance, Customer, Hospital, Collection, Product, CustomerProduct } from "@shared/schema";

const CONTRACT_STATUS_OPTIONS = [
  { value: "draft", label: "Koncept" },
  { value: "created", label: "Vytvorena" },
  { value: "sent", label: "Odoslana" },
  { value: "received", label: "Prijata" },
  { value: "returned", label: "Vratena" },
  { value: "verified", label: "Overena" },
  { value: "executed", label: "Vykonana" },
  { value: "completed", label: "Dokoncena" },
  { value: "terminated", label: "Ukoncena" },
  { value: "cancelled", label: "Zrusena" },
];

const SALES_CHANNEL_OPTIONS = ["CCP", "CCP+D", "CCAI", "CCAI+D", "CCAE", "CCAE+D", "I"];

const INFO_SOURCE_OPTIONS = [
  { value: "internet", label: "Internet" },
  { value: "friends", label: "Priatelia" },
  { value: "doctor", label: "Lekar" },
  { value: "positive_experience", label: "Pozitivna skusenost" },
  { value: "conference", label: "Konferencia" },
  { value: "tv", label: "TV" },
  { value: "radio", label: "Radio" },
  { value: "prenatal_course", label: "Predporodny kurz" },
  { value: "hospital_doctor", label: "Nemocnicny lekar" },
  { value: "other", label: "Ine" },
];

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

const formatDate = (date: string | Date | null | undefined) => {
  if (!date) return "-";
  try {
    return format(new Date(date), "dd.MM.yyyy");
  } catch {
    return "-";
  }
};

const formatDateTime = (date: string | Date | null | undefined) => {
  if (!date) return "-";
  try {
    return format(new Date(date), "dd.MM.yyyy HH:mm");
  } catch {
    return "-";
  }
};

function getStatusBadgeVariant(status: string): "secondary" | "default" | "destructive" {
  switch (status) {
    case "draft": return "secondary";
    case "completed": case "executed": case "verified": return "default";
    case "cancelled": case "terminated": return "destructive";
    default: return "secondary";
  }
}

export default function ContractDetailPage() {
  const { toast } = useToast();
  const params = useParams<{ id: string }>();
  const contractId = params.id;

  const [activeTab, setActiveTab] = useState("basic");
  const [formState, setFormState] = useState<Record<string, any>>({});
  const [formInitialized, setFormInitialized] = useState(false);

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
      return apiRequest("PATCH", `/api/contracts/${contractId}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", contractId] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "Ulozene", description: "Zmluva bola uspesne ulozena." });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa ulozit zmluvu.", variant: "destructive" });
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
            Spat na zmluvy
          </Button>
        </Link>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Zmluva nebola najdena.
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
          Spat na zmluvy
        </Button>
      </Link>

      <PageHeader
        title={`Zmluva ${contract.contractNumber}`}
        description={customer ? `${customer.firstName} ${customer.lastName}` : undefined}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap" data-testid="tabs-list">
          <TabsTrigger value="basic" data-testid="tab-basic">
            <FileText className="h-4 w-4 mr-1" />
            Zakladne udaje
          </TabsTrigger>
          <TabsTrigger value="persons" data-testid="tab-persons">
            <Users className="h-4 w-4 mr-1" />
            Osoby
          </TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents">
            <FileText className="h-4 w-4 mr-1" />
            Dokumenty
          </TabsTrigger>
          <TabsTrigger value="products" data-testid="tab-products">
            <Package className="h-4 w-4 mr-1" />
            Produkty
          </TabsTrigger>
          <TabsTrigger value="collections" data-testid="tab-collections">
            <Beaker className="h-4 w-4 mr-1" />
            Odbery
          </TabsTrigger>
          <TabsTrigger value="invoices" data-testid="tab-invoices">
            <Receipt className="h-4 w-4 mr-1" />
            Faktury
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Identifikacia</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="internalId">Legacy ID</Label>
                  <Input
                    id="internalId"
                    value={formState.internalId || ""}
                    onChange={(e) => updateField("internalId", e.target.value)}
                    data-testid="input-internalId"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contractNumber">Cislo zmluvy</Label>
                  <Input
                    id="contractNumber"
                    value={contract.contractNumber}
                    readOnly
                    className="bg-muted"
                    data-testid="input-contractNumber"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Stav</Label>
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

          <Card>
            <CardHeader>
              <CardTitle>Datumy zivotneho cyklu</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactDate">Datum kontaktu</Label>
                  <Input
                    id="contactDate"
                    type="datetime-local"
                    value={formState.contactDate || ""}
                    onChange={(e) => updateField("contactDate", e.target.value)}
                    data-testid="input-contactDate"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="filledDate">Vyplnena zmluva dna</Label>
                  <Input
                    id="filledDate"
                    type="datetime-local"
                    value={formState.filledDate || ""}
                    onChange={(e) => updateField("filledDate", e.target.value)}
                    data-testid="input-filledDate"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="createdContractDate">Vytvorena zmluva dna</Label>
                  <Input
                    id="createdContractDate"
                    type="datetime-local"
                    value={formState.createdContractDate || ""}
                    onChange={(e) => updateField("createdContractDate", e.target.value)}
                    data-testid="input-createdContractDate"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sentContractDate">Poslana zmluva dna</Label>
                  <Input
                    id="sentContractDate"
                    type="datetime-local"
                    value={formState.sentContractDate || ""}
                    onChange={(e) => updateField("sentContractDate", e.target.value)}
                    data-testid="input-sentContractDate"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="receivedByClientDate">Prijata klientom</Label>
                  <Input
                    id="receivedByClientDate"
                    type="datetime-local"
                    value={formState.receivedByClientDate || ""}
                    onChange={(e) => updateField("receivedByClientDate", e.target.value)}
                    data-testid="input-receivedByClientDate"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="returnedDate">Vratena</Label>
                  <Input
                    id="returnedDate"
                    type="datetime-local"
                    value={formState.returnedDate || ""}
                    onChange={(e) => updateField("returnedDate", e.target.value)}
                    data-testid="input-returnedDate"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="verifiedDate">Overena</Label>
                  <Input
                    id="verifiedDate"
                    type="datetime-local"
                    value={formState.verifiedDate || ""}
                    onChange={(e) => updateField("verifiedDate", e.target.value)}
                    data-testid="input-verifiedDate"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="executedDate">Vykonana zmluva</Label>
                  <Input
                    id="executedDate"
                    type="datetime-local"
                    value={formState.executedDate || ""}
                    onChange={(e) => updateField("executedDate", e.target.value)}
                    data-testid="input-executedDate"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="terminatedDate">Ukoncena zmluva</Label>
                  <Input
                    id="terminatedDate"
                    type="datetime-local"
                    value={formState.terminatedDate || ""}
                    onChange={(e) => updateField("terminatedDate", e.target.value)}
                    data-testid="input-terminatedDate"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cancelledAt">Zrusena zmluva</Label>
                  <Input
                    id="cancelledAt"
                    type="datetime-local"
                    value={formState.cancelledAt || ""}
                    onChange={(e) => updateField("cancelledAt", e.target.value)}
                    data-testid="input-cancelledAt"
                  />
                </div>
                <div className="space-y-2 md:col-span-2 lg:col-span-3">
                  <Label htmlFor="terminationReason">Dovod ukoncenia</Label>
                  <Textarea
                    id="terminationReason"
                    value={formState.terminationReason || ""}
                    onChange={(e) => updateField("terminationReason", e.target.value)}
                    data-testid="input-terminationReason"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Medicinske udaje</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ambulantDoctor">Ambulantny lekar</Label>
                  <Input
                    id="ambulantDoctor"
                    value={formState.ambulantDoctor || ""}
                    onChange={(e) => updateField("ambulantDoctor", e.target.value)}
                    data-testid="input-ambulantDoctor"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expectedDeliveryDate">Predpokladany datum porodu</Label>
                  <Input
                    id="expectedDeliveryDate"
                    type="date"
                    value={formState.expectedDeliveryDate || ""}
                    onChange={(e) => updateField("expectedDeliveryDate", e.target.value)}
                    data-testid="input-expectedDeliveryDate"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hospitalId">Nemocnica</Label>
                  <Select
                    value={formState.hospitalId || ""}
                    onValueChange={(v) => updateField("hospitalId", v)}
                  >
                    <SelectTrigger data-testid="select-hospitalId">
                      <SelectValue placeholder="Vyberte nemocnicu" />
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
                  <Label htmlFor="obstetrician">Porodnik</Label>
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
                  <Label htmlFor="multiplePregnancy">Viacnasobne tehotenstvo</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Predaj a marketing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="salesChannel">Predajny kanal</Label>
                  <Select
                    value={formState.salesChannel || ""}
                    onValueChange={(v) => updateField("salesChannel", v)}
                  >
                    <SelectTrigger data-testid="select-salesChannel">
                      <SelectValue placeholder="Vyberte kanal" />
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
                  <Label htmlFor="infoSource">Zdroj informacii</Label>
                  <Select
                    value={formState.infoSource || ""}
                    onValueChange={(v) => updateField("infoSource", v)}
                  >
                    <SelectTrigger data-testid="select-infoSource">
                      <SelectValue placeholder="Vyberte zdroj" />
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
                  <Label htmlFor="selectionReason">Dovod vyberu</Label>
                  <Textarea
                    id="selectionReason"
                    value={formState.selectionReason || ""}
                    onChange={(e) => updateField("selectionReason", e.target.value)}
                    data-testid="input-selectionReason"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="marketingAction">Marketingova akcia</Label>
                  <Input
                    id="marketingAction"
                    value={formState.marketingAction || ""}
                    onChange={(e) => updateField("marketingAction", e.target.value)}
                    data-testid="input-marketingAction"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="marketingCode">Marketingovy kod</Label>
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
              <CardTitle>Financne</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="refinancing">Prefinancovanie</Label>
                  <Input
                    id="refinancing"
                    value={formState.refinancing || ""}
                    onChange={(e) => updateField("refinancing", e.target.value)}
                    data-testid="input-refinancing"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="refinancingId">Prefinancovanie ID</Label>
                  <Input
                    id="refinancingId"
                    value={formState.refinancingId || ""}
                    onChange={(e) => updateField("refinancingId", e.target.value)}
                    data-testid="input-refinancingId"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="giftVoucher">Darcekovova poukazka</Label>
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
              <CardTitle>Odberova sada</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="collectionKit">Odberova sada</Label>
                  <Input
                    id="collectionKit"
                    value={formState.collectionKit || ""}
                    onChange={(e) => updateField("collectionKit", e.target.value)}
                    data-testid="input-collectionKit"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="collectionKitSentDate">Poslana</Label>
                  <Input
                    id="collectionKitSentDate"
                    type="datetime-local"
                    value={formState.collectionKitSentDate || ""}
                    onChange={(e) => updateField("collectionKitSentDate", e.target.value)}
                    data-testid="input-collectionKitSentDate"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ostatne</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2 md:col-span-2 lg:col-span-3">
                  <Label htmlFor="clientNote">Poznamka klientky</Label>
                  <Textarea
                    id="clientNote"
                    value={formState.clientNote || ""}
                    onChange={(e) => updateField("clientNote", e.target.value)}
                    data-testid="input-clientNote"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="representativeId">Reprezentant</Label>
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
                  <Label htmlFor="indicatedContract">Indikovana zmluva</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="initialProductId">Inicializacny produkt</Label>
                  <Select
                    value={formState.initialProductId || ""}
                    onValueChange={(v) => updateField("initialProductId", v)}
                  >
                    <SelectTrigger data-testid="select-initialProductId">
                      <SelectValue placeholder="Vyberte produkt" />
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
                  <Label htmlFor="recruitedToProductId">Regrutoval na</Label>
                  <Select
                    value={formState.recruitedToProductId || ""}
                    onValueChange={(v) => updateField("recruitedToProductId", v)}
                  >
                    <SelectTrigger data-testid="select-recruitedToProductId">
                      <SelectValue placeholder="Vyberte produkt" />
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
                  <Label htmlFor="recruitedDate">Regrutoval dna</Label>
                  <Input
                    id="recruitedDate"
                    type="datetime-local"
                    value={formState.recruitedDate || ""}
                    onChange={(e) => updateField("recruitedDate", e.target.value)}
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
              Ulozit
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="persons" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Klientka</CardTitle>
            </CardHeader>
            <CardContent>
              {customer ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">Meno</Label>
                    <p className="font-medium" data-testid="text-customer-name">
                      {customer.titleBefore ? `${customer.titleBefore} ` : ""}{customer.firstName} {customer.lastName}{customer.titleAfter ? `, ${customer.titleAfter}` : ""}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Email</Label>
                    <p data-testid="text-customer-email">{customer.email || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Telefon</Label>
                    <p data-testid="text-customer-phone">{customer.phone || customer.mobile || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Adresa</Label>
                    <p data-testid="text-customer-address">
                      {[customer.address, customer.city, customer.postalCode].filter(Boolean).join(", ") || "-"}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">Zakaznik nebol najdeny.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Otec dietata</CardTitle>
            </CardHeader>
            <CardContent>
              {potentialCase?.fatherFirstName || potentialCase?.fatherLastName ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">Meno</Label>
                    <p className="font-medium" data-testid="text-father-name">
                      {potentialCase.fatherFirstName || ""} {potentialCase.fatherLastName || ""}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Email</Label>
                    <p data-testid="text-father-email">{potentialCase.fatherEmail || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Telefon</Label>
                    <p data-testid="text-father-phone">{potentialCase.fatherPhone || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Adresa</Label>
                    <p data-testid="text-father-address">
                      {[potentialCase.fatherAddress, potentialCase.fatherCity, potentialCase.fatherPostalCode].filter(Boolean).join(", ") || "-"}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">Udaje o otcovi nie su k dispozicii.</p>
              )}
            </CardContent>
          </Card>

          {contractParticipants.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Ucastnici zmluvy</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Meno</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Telefon</TableHead>
                      <TableHead>Podpis</TableHead>
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
                            <Badge variant="default" data-testid={`badge-signed-${p.id}`}>Podpisane</Badge>
                          ) : p.signatureRequired ? (
                            <Badge variant="secondary" data-testid={`badge-pending-${p.id}`}>Caka na podpis</Badge>
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
              <CardTitle>Dokumenty zmluvy</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cislo zmluvy</TableHead>
                    <TableHead>Stav</TableHead>
                    <TableHead>Datum vytvorenia</TableHead>
                    <TableHead>Akcie</TableHead>
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
                    <TableCell>{formatDateTime(contract.createdAt)}</TableCell>
                    <TableCell>
                      {contract.pdfPath ? (
                        <a
                          href={`/api/documents/contract-${contract.id}/download`}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid="link-download-pdf"
                        >
                          <Button variant="ghost" size="icon">
                            <Download className="h-4 w-4" />
                          </Button>
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-sm">Nie je k dispozicii</span>
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
              <CardTitle>Produkty zmluvy</CardTitle>
            </CardHeader>
            <CardContent>
              {contractProducts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produkt</TableHead>
                      <TableHead>Mnozstvo</TableHead>
                      <TableHead>Jednotkova cena</TableHead>
                      <TableHead>Celkom</TableHead>
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
                <p className="text-muted-foreground">Ziadne produkty na zmluve.</p>
              )}
            </CardContent>
          </Card>

          {customerProducts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Produkty zakaznika</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produkt</TableHead>
                      <TableHead>Mnozstvo</TableHead>
                      <TableHead>Cena</TableHead>
                      <TableHead>Poznamka</TableHead>
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
              <CardTitle>Odbery</CardTitle>
            </CardHeader>
            <CardContent>
              {customerCollections.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>CBU cislo</TableHead>
                      <TableHead>Datum odberu</TableHead>
                      <TableHead>Nemocnica</TableHead>
                      <TableHead>Meno dietata</TableHead>
                      <TableHead>Stav</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerCollections.map((col: Collection) => {
                      const hospital = hospitals.find((h: Hospital) => h.id === col.hospitalId);
                      return (
                        <TableRow key={col.id} data-testid={`row-collection-${col.id}`}>
                          <TableCell className="font-medium">{col.cbuNumber || "-"}</TableCell>
                          <TableCell>{formatDateTime(col.collectionDate)}</TableCell>
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
                <p className="text-muted-foreground">Ziadne odbery pre tohto zakaznika.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Faktury</CardTitle>
            </CardHeader>
            <CardContent>
              {invoices.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cislo faktury</TableHead>
                      <TableHead>Datum</TableHead>
                      <TableHead>Suma</TableHead>
                      <TableHead>Stav</TableHead>
                      <TableHead>Akcie</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv: any) => (
                      <TableRow key={inv.id} data-testid={`row-invoice-${inv.id}`}>
                        <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                        <TableCell>{formatDate(inv.issueDate || inv.generatedAt)}</TableCell>
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
                          {inv.pdfPath ? (
                            <a
                              href={inv.pdfPath}
                              target="_blank"
                              rel="noopener noreferrer"
                              data-testid={`link-invoice-download-${inv.id}`}
                            >
                              <Button variant="ghost" size="icon">
                                <Download className="h-4 w-4" />
                              </Button>
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground">Ziadne faktury pre tohto zakaznika.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
