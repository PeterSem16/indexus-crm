import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useI18n } from "@/i18n";
import { useCountryFilter } from "@/contexts/country-filter-context";
import { format } from "date-fns";
import { sk, cs, hu, ro, it, de, enUS, type Locale } from "date-fns/locale";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, Search, Eye, Edit, Trash2, Syringe, Building2, User, Calendar, 
  FileText, FlaskConical, AlertCircle, ArrowLeft, ArrowRight, Check, Baby, 
  Users, Clock
} from "lucide-react";
import { Link, useLocation, useRoute } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Collection, BillingDetails, Product, Customer, Collaborator, Hospital, ProductSet } from "@shared/schema";

const dateLocales: Record<string, Locale> = {
  sk, cs, hu, ro, it, de, en: enUS
};

const COLLECTION_STATES = [
  "created", "paired", "evaluated", "verified", "stored", "transferred", "released", "awaiting_disposal", "disposed"
] as const;

const CHILD_GENDERS = ["male", "female"] as const;

interface CollectionFormData {
  cbuNumber: string;
  billingCompanyId: string;
  productId: string;
  billsetId: string;
  countryCode: string;
  customerId: string;
  clientFirstName: string;
  clientLastName: string;
  clientPhone: string;
  clientMobile: string;
  clientBirthNumber: string;
  clientBirthDay: string;
  clientBirthMonth: string;
  clientBirthYear: string;
  childFirstName: string;
  childLastName: string;
  childGender: string;
  collectionDate: string;
  hospitalId: string;
  cordBloodCollectorId: string;
  tissueCollectorId: string;
  placentaCollectorId: string;
  assistantNurseId: string;
  secondNurseId: string;
  representativeId: string;
  state: string;
  certificate: string;
  laboratoryId: string;
  responsibleCoordinatorId: string;
  contractId: string;
  doctorNote: string;
  note: string;
}

const initialFormData: CollectionFormData = {
  cbuNumber: "",
  billingCompanyId: "",
  productId: "",
  billsetId: "",
  countryCode: "",
  customerId: "",
  clientFirstName: "",
  clientLastName: "",
  clientPhone: "",
  clientMobile: "",
  clientBirthNumber: "",
  clientBirthDay: "",
  clientBirthMonth: "",
  clientBirthYear: "",
  childFirstName: "",
  childLastName: "",
  childGender: "",
  collectionDate: "",
  hospitalId: "",
  cordBloodCollectorId: "",
  tissueCollectorId: "",
  placentaCollectorId: "",
  assistantNurseId: "",
  secondNurseId: "",
  representativeId: "",
  state: "created",
  certificate: "",
  laboratoryId: "",
  responsibleCoordinatorId: "",
  contractId: "",
  doctorNote: "",
  note: "",
};

export default function CollectionsPage() {
  const { locale, t } = useI18n();
  const { selectedCountries } = useCountryFilter();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [, params] = useRoute("/collections/:id");
  
  const isNew = location === "/collections/new";
  const collectionId = params?.id;
  const isEditing = !!collectionId && !isNew;
  const isListView = !isNew && !isEditing;

  const [searchQuery, setSearchQuery] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [collectionToDelete, setCollectionToDelete] = useState<Collection | null>(null);
  const [wizardStep, setWizardStep] = useState(0);
  const [formData, setFormData] = useState<CollectionFormData>(initialFormData);
  const [activeTab, setActiveTab] = useState("client");
  
  const dateFnsLocale = dateLocales[locale] || enUS;

  const { data: collections = [], isLoading } = useQuery<Collection[]>({
    queryKey: ["/api/collections", selectedCountries.join(",")],
  });

  const { data: collection, isLoading: isLoadingCollection } = useQuery<Collection>({
    queryKey: ["/api/collections", collectionId],
    enabled: isEditing,
  });

  const { data: billingCompanies = [] } = useQuery<BillingDetails[]>({
    queryKey: ["/api/billing-details"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: collaborators = [] } = useQuery<Collaborator[]>({
    queryKey: ["/api/collaborators"],
  });

  const { data: hospitals = [] } = useQuery<Hospital[]>({
    queryKey: ["/api/hospitals"],
  });

  const { data: productSets = [] } = useQuery<ProductSet[]>({
    queryKey: ["/api/product-sets"],
  });

  const selectedCustomer = customers.find(c => c.id === formData.customerId);
  const customerCountries = selectedCustomer?.country ? [selectedCustomer.country] : [];

  const handleCustomerSelect = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      setFormData(prev => ({
        ...prev,
        customerId,
        clientFirstName: customer.firstName || prev.clientFirstName,
        clientLastName: customer.lastName || prev.clientLastName,
        clientPhone: customer.phone || prev.clientPhone,
        clientMobile: customer.mobile || prev.clientMobile,
        countryCode: customer.country || prev.countryCode,
      }));
    } else {
      handleFieldChange("customerId", customerId);
    }
  };

  useEffect(() => {
    if (collection && isEditing) {
      setFormData({
        cbuNumber: collection.cbuNumber || "",
        billingCompanyId: collection.billingCompanyId || "",
        productId: collection.productId || "",
        billsetId: collection.billsetId || "",
        countryCode: collection.countryCode || "",
        customerId: collection.customerId || "",
        clientFirstName: collection.clientFirstName || "",
        clientLastName: collection.clientLastName || "",
        clientPhone: collection.clientPhone || "",
        clientMobile: collection.clientMobile || "",
        clientBirthNumber: collection.clientBirthNumber || "",
        clientBirthDay: collection.clientBirthDay?.toString() || "",
        clientBirthMonth: collection.clientBirthMonth?.toString() || "",
        clientBirthYear: collection.clientBirthYear?.toString() || "",
        childFirstName: collection.childFirstName || "",
        childLastName: collection.childLastName || "",
        childGender: collection.childGender || "",
        collectionDate: collection.collectionDate ? format(new Date(collection.collectionDate), "yyyy-MM-dd'T'HH:mm") : "",
        hospitalId: collection.hospitalId || "",
        cordBloodCollectorId: collection.cordBloodCollectorId || "",
        tissueCollectorId: collection.tissueCollectorId || "",
        placentaCollectorId: collection.placentaCollectorId || "",
        assistantNurseId: collection.assistantNurseId || "",
        secondNurseId: collection.secondNurseId || "",
        representativeId: collection.representativeId || "",
        state: collection.state || "created",
        certificate: collection.certificate || "",
        laboratoryId: collection.laboratoryId || "",
        responsibleCoordinatorId: collection.responsibleCoordinatorId || "",
        contractId: collection.contractId || "",
        doctorNote: collection.doctorNote || "",
        note: collection.note || "",
      });
    }
  }, [collection, isEditing]);

  useEffect(() => {
    if (isNew) {
      const defaultCountry = selectedCountries.length > 0 ? selectedCountries[0] : "SK";
      setFormData({ ...initialFormData, countryCode: defaultCountry });
      setWizardStep(0);
    }
  }, [isNew, selectedCountries]);

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Collection>) => {
      const res = await apiRequest("POST", "/api/collections", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collections"] });
      toast({ title: t.common.save });
      setLocation("/collections");
    },
    onError: () => {
      toast({ title: t.common.error, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Collection>) => {
      const res = await apiRequest("PATCH", `/api/collections/${collectionId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collections"] });
      toast({ title: t.common.save });
    },
    onError: () => {
      toast({ title: t.common.error, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/collections/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collections"] });
      toast({ title: t.common.delete });
      setShowDeleteDialog(false);
      setCollectionToDelete(null);
    },
    onError: () => {
      toast({ title: t.common.error, variant: "destructive" });
    },
  });

  const filteredCollections = collections.filter((c) => {
    if (selectedCountries.length > 0 && !selectedCountries.includes(c.countryCode)) {
      return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        c.cbuNumber?.toLowerCase().includes(query) ||
        c.clientFirstName?.toLowerCase().includes(query) ||
        c.clientLastName?.toLowerCase().includes(query) ||
        c.childFirstName?.toLowerCase().includes(query) ||
        c.childLastName?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const notAvailable = t.common.noData;

  const getBillingCompanyName = (id: string | null) => {
    if (!id) return notAvailable;
    const company = billingCompanies.find((bc) => bc.id === id);
    return company?.companyName || notAvailable;
  };

  const getCollaboratorName = (id: string | null) => {
    if (!id) return notAvailable;
    const collab = collaborators.find((c) => c.id === id);
    return collab ? `${collab.firstName} ${collab.lastName}` : notAvailable;
  };

  const getHospitalName = (id: string | null) => {
    if (!id) return notAvailable;
    const hospital = hospitals.find((h) => h.id === id);
    return hospital?.name || notAvailable;
  };

  const getStateLabel = (state: string | null) => {
    if (!state) return notAvailable;
    const states = t.collections?.states;
    const labels: Record<string, string> = {
      created: states?.created || notAvailable,
      paired: states?.paired || notAvailable,
      evaluated: states?.evaluated || notAvailable,
      verified: states?.verified || notAvailable,
      stored: states?.stored || notAvailable,
      transferred: states?.transferred || notAvailable,
      released: states?.released || notAvailable,
      awaiting_disposal: states?.awaiting_disposal || notAvailable,
      disposed: states?.disposed || notAvailable,
    };
    return labels[state] || notAvailable;
  };

  const handleDelete = (col: Collection) => {
    setCollectionToDelete(col);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (collectionToDelete) {
      deleteMutation.mutate(collectionToDelete.id);
    }
  };

  const handleFieldChange = (field: keyof CollectionFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const prepareDataForSave = (): Partial<Collection> => {
    return {
      cbuNumber: formData.cbuNumber || null,
      billingCompanyId: formData.billingCompanyId || null,
      productId: formData.productId || null,
      billsetId: formData.billsetId || null,
      countryCode: formData.countryCode,
      customerId: formData.customerId || null,
      clientFirstName: formData.clientFirstName || null,
      clientLastName: formData.clientLastName || null,
      clientPhone: formData.clientPhone || null,
      clientMobile: formData.clientMobile || null,
      clientBirthNumber: formData.clientBirthNumber || null,
      clientBirthDay: formData.clientBirthDay ? parseInt(formData.clientBirthDay) : null,
      clientBirthMonth: formData.clientBirthMonth ? parseInt(formData.clientBirthMonth) : null,
      clientBirthYear: formData.clientBirthYear ? parseInt(formData.clientBirthYear) : null,
      childFirstName: formData.childFirstName || null,
      childLastName: formData.childLastName || null,
      childGender: formData.childGender || null,
      collectionDate: formData.collectionDate ? new Date(formData.collectionDate) : null,
      hospitalId: formData.hospitalId || null,
      cordBloodCollectorId: formData.cordBloodCollectorId || null,
      tissueCollectorId: formData.tissueCollectorId || null,
      placentaCollectorId: formData.placentaCollectorId || null,
      assistantNurseId: formData.assistantNurseId || null,
      secondNurseId: formData.secondNurseId || null,
      representativeId: formData.representativeId || null,
      state: formData.state || null,
      certificate: formData.certificate || null,
      laboratoryId: formData.laboratoryId || null,
      responsibleCoordinatorId: formData.responsibleCoordinatorId || null,
      contractId: formData.contractId || null,
      doctorNote: formData.doctorNote || null,
      note: formData.note || null,
    };
  };

  const handleSave = () => {
    const data = prepareDataForSave();
    console.log("Saving collection data:", data);
    if (!data.countryCode) {
      toast({ title: "Country is required", variant: "destructive" });
      return;
    }
    if (isNew) {
      createMutation.mutate(data);
    } else {
      updateMutation.mutate(data);
    }
  };

  const wizardSteps = [
    { key: "client", label: t.collections?.client, icon: User },
    { key: "child", label: t.collections?.child, icon: Baby },
    { key: "collection", label: t.collections?.collection, icon: Syringe },
    { key: "status", label: t.collections?.status, icon: Clock },
  ];

  const availableCountries = customerCountries.length > 0 ? customerCountries : ["SK", "CZ", "HU", "RO", "IT", "DE", "US"];
  const countryLabels: Record<string, string | undefined> = t.countries || {};

  const productBillsets = formData.productId 
    ? productSets.filter(ps => ps.productId === formData.productId)
    : [];

  const renderClientForm = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{t.customers?.title}</Label>
        <Select value={formData.customerId} onValueChange={handleCustomerSelect}>
          <SelectTrigger data-testid="select-customer">
            <SelectValue placeholder={t.common.select} />
          </SelectTrigger>
          <SelectContent>
            {customers.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.firstName} {c.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t.collections?.firstName}</Label>
          <Input
            value={formData.clientFirstName}
            onChange={(e) => handleFieldChange("clientFirstName", e.target.value)}
            data-testid="input-client-first-name"
          />
        </div>
        <div className="space-y-2">
          <Label>{t.collections?.lastName}</Label>
          <Input
            value={formData.clientLastName}
            onChange={(e) => handleFieldChange("clientLastName", e.target.value)}
            data-testid="input-client-last-name"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t.collections?.phone}</Label>
          <Input
            value={formData.clientPhone}
            onChange={(e) => handleFieldChange("clientPhone", e.target.value)}
            data-testid="input-client-phone"
          />
        </div>
        <div className="space-y-2">
          <Label>{t.collections?.mobile}</Label>
          <Input
            value={formData.clientMobile}
            onChange={(e) => handleFieldChange("clientMobile", e.target.value)}
            data-testid="input-client-mobile"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>{t.collections?.birthNumber}</Label>
        <Input
          value={formData.clientBirthNumber}
          onChange={(e) => handleFieldChange("clientBirthNumber", e.target.value)}
          data-testid="input-client-birth-number"
        />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>{t.collections?.birthDay}</Label>
          <Input
            type="number"
            min="1"
            max="31"
            value={formData.clientBirthDay}
            onChange={(e) => handleFieldChange("clientBirthDay", e.target.value)}
            data-testid="input-client-birth-day"
          />
        </div>
        <div className="space-y-2">
          <Label>{t.collections?.birthMonth}</Label>
          <Input
            type="number"
            min="1"
            max="12"
            value={formData.clientBirthMonth}
            onChange={(e) => handleFieldChange("clientBirthMonth", e.target.value)}
            data-testid="input-client-birth-month"
          />
        </div>
        <div className="space-y-2">
          <Label>{t.collections?.birthYear}</Label>
          <Input
            type="number"
            min="1900"
            max="2100"
            value={formData.clientBirthYear}
            onChange={(e) => handleFieldChange("clientBirthYear", e.target.value)}
            data-testid="input-client-birth-year"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t.common.country}</Label>
          <Select value={formData.countryCode} onValueChange={(v) => handleFieldChange("countryCode", v)}>
            <SelectTrigger data-testid="select-country">
              <SelectValue placeholder={t.common.select} />
            </SelectTrigger>
            <SelectContent>
              {availableCountries.map((code) => (
                <SelectItem key={code} value={code}>{countryLabels[code] || code}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t.collaborators?.fields?.billingCompany}</Label>
          <Select value={formData.billingCompanyId} onValueChange={(v) => handleFieldChange("billingCompanyId", v)}>
            <SelectTrigger data-testid="select-billing-company">
              <SelectValue placeholder={t.common.select} />
            </SelectTrigger>
            <SelectContent>
              {billingCompanies.map((bc) => (
                <SelectItem key={bc.id} value={bc.id}>{bc.companyName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t.products?.title}</Label>
          <Select value={formData.productId} onValueChange={(v) => {
            handleFieldChange("productId", v);
            handleFieldChange("billsetId", "");
          }}>
            <SelectTrigger data-testid="select-product">
              <SelectValue placeholder={t.common.select} />
            </SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t.collections?.billset}</Label>
          <Select 
            value={formData.billsetId} 
            onValueChange={(v) => handleFieldChange("billsetId", v)}
            disabled={!formData.productId || productBillsets.length === 0}
          >
            <SelectTrigger data-testid="select-billset">
              <SelectValue placeholder={productBillsets.length === 0 ? notAvailable : t.common.select} />
            </SelectTrigger>
            <SelectContent>
              {productBillsets.map((ps) => (
                <SelectItem key={ps.id} value={ps.id}>{ps.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  const renderChildForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t.collections?.firstName}</Label>
          <Input
            value={formData.childFirstName}
            onChange={(e) => handleFieldChange("childFirstName", e.target.value)}
            data-testid="input-child-first-name"
          />
        </div>
        <div className="space-y-2">
          <Label>{t.collections?.lastName}</Label>
          <Input
            value={formData.childLastName}
            onChange={(e) => handleFieldChange("childLastName", e.target.value)}
            data-testid="input-child-last-name"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>{t.collections?.gender}</Label>
        <Select value={formData.childGender} onValueChange={(v) => handleFieldChange("childGender", v)}>
          <SelectTrigger data-testid="select-child-gender">
            <SelectValue placeholder={t.common.select} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="male">{t.collections?.male}</SelectItem>
            <SelectItem value="female">{t.collections?.female}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const renderCollectionForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t.collections?.cbuNumber}</Label>
          <Input
            value={formData.cbuNumber}
            onChange={(e) => handleFieldChange("cbuNumber", e.target.value)}
            data-testid="input-cbu-number"
          />
        </div>
        <div className="space-y-2">
          <Label>{t.collections?.collectionDate}</Label>
          <Input
            type="datetime-local"
            value={formData.collectionDate}
            onChange={(e) => handleFieldChange("collectionDate", e.target.value)}
            data-testid="input-collection-date"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>{t.collections?.hospital}</Label>
        <Select value={formData.hospitalId} onValueChange={(v) => handleFieldChange("hospitalId", v)}>
          <SelectTrigger data-testid="select-hospital">
            <SelectValue placeholder={t.common.select} />
          </SelectTrigger>
          <SelectContent>
            {hospitals.map((h) => (
              <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t.collections?.cordBloodCollector}</Label>
          <Select value={formData.cordBloodCollectorId} onValueChange={(v) => handleFieldChange("cordBloodCollectorId", v)}>
            <SelectTrigger data-testid="select-cord-blood-collector">
              <SelectValue placeholder={t.common.select} />
            </SelectTrigger>
            <SelectContent>
              {collaborators.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t.collections?.tissueCollector}</Label>
          <Select value={formData.tissueCollectorId} onValueChange={(v) => handleFieldChange("tissueCollectorId", v)}>
            <SelectTrigger data-testid="select-tissue-collector">
              <SelectValue placeholder={t.common.select} />
            </SelectTrigger>
            <SelectContent>
              {collaborators.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t.collections?.placentaCollector}</Label>
          <Select value={formData.placentaCollectorId} onValueChange={(v) => handleFieldChange("placentaCollectorId", v)}>
            <SelectTrigger data-testid="select-placenta-collector">
              <SelectValue placeholder={t.common.select} />
            </SelectTrigger>
            <SelectContent>
              {collaborators.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t.collections?.assistantNurse}</Label>
          <Select value={formData.assistantNurseId} onValueChange={(v) => handleFieldChange("assistantNurseId", v)}>
            <SelectTrigger data-testid="select-assistant-nurse">
              <SelectValue placeholder={t.common.select} />
            </SelectTrigger>
            <SelectContent>
              {collaborators.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t.collections?.secondNurse}</Label>
          <Select value={formData.secondNurseId} onValueChange={(v) => handleFieldChange("secondNurseId", v)}>
            <SelectTrigger data-testid="select-second-nurse">
              <SelectValue placeholder={t.common.select} />
            </SelectTrigger>
            <SelectContent>
              {collaborators.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t.collections?.representative}</Label>
          <Select value={formData.representativeId} onValueChange={(v) => handleFieldChange("representativeId", v)}>
            <SelectTrigger data-testid="select-representative">
              <SelectValue placeholder={t.common.select} />
            </SelectTrigger>
            <SelectContent>
              {collaborators.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  const renderStatusForm = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{t.collections?.status}</Label>
        <Select value={formData.state} onValueChange={(v) => handleFieldChange("state", v)}>
          <SelectTrigger data-testid="select-state">
            <SelectValue placeholder={t.common.select} />
          </SelectTrigger>
          <SelectContent>
            {COLLECTION_STATES.map((state) => (
              <SelectItem key={state} value={state}>{getStateLabel(state)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>{t.collections?.certificate}</Label>
        <Input
          value={formData.certificate}
          onChange={(e) => handleFieldChange("certificate", e.target.value)}
          data-testid="input-certificate"
        />
      </div>
      <div className="space-y-2">
        <Label>{t.collections?.coordinator}</Label>
        <Select value={formData.responsibleCoordinatorId} onValueChange={(v) => handleFieldChange("responsibleCoordinatorId", v)}>
          <SelectTrigger data-testid="select-coordinator">
            <SelectValue placeholder={t.common.select} />
          </SelectTrigger>
          <SelectContent>
            {collaborators.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.firstName} {c.lastName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>{t.collections?.note}</Label>
        <Textarea
          value={formData.note}
          onChange={(e) => handleFieldChange("note", e.target.value)}
          rows={3}
          data-testid="input-note"
        />
      </div>
      <div className="space-y-2">
        <Label>{t.collections?.doctorNote}</Label>
        <Textarea
          value={formData.doctorNote}
          onChange={(e) => handleFieldChange("doctorNote", e.target.value)}
          rows={3}
          data-testid="input-doctor-note"
        />
      </div>
    </div>
  );

  if (isNew) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader
          title={t.collections?.addCollection}
          description={t.collections?.description}
          backUrl="/collections"
        />
        
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {wizardSteps.map((step, idx) => (
                  <div
                    key={step.key}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md cursor-pointer transition-colors ${
                      idx === wizardStep 
                        ? "bg-primary text-primary-foreground" 
                        : idx < wizardStep 
                          ? "bg-primary/20 text-primary" 
                          : "bg-muted text-muted-foreground"
                    }`}
                    onClick={() => setWizardStep(idx)}
                    data-testid={`wizard-step-${step.key}`}
                  >
                    <step.icon className="h-4 w-4" />
                    <span className="text-sm font-medium">{step.label}</span>
                    {idx < wizardStep && <Check className="h-4 w-4" />}
                  </div>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="min-h-[400px]">
              {wizardStep === 0 && renderClientForm()}
              {wizardStep === 1 && renderChildForm()}
              {wizardStep === 2 && renderCollectionForm()}
              {wizardStep === 3 && renderStatusForm()}
            </div>
            
            <div className="flex items-center justify-between mt-6 pt-6 border-t">
              <Button
                variant="outline"
                onClick={() => wizardStep > 0 ? setWizardStep(wizardStep - 1) : setLocation("/collections")}
                data-testid="button-wizard-back"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                {wizardStep > 0 ? t.common.back : t.common.cancel}
              </Button>
              
              {wizardStep < wizardSteps.length - 1 ? (
                <Button onClick={() => setWizardStep(wizardStep + 1)} data-testid="button-wizard-next">
                  {t.common.next}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={handleSave} disabled={createMutation.isPending} data-testid="button-wizard-save">
                  <Check className="h-4 w-4 mr-2" />
                  {t.common.save}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isEditing) {
    if (isLoadingCollection) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      );
    }

    return (
      <div className="p-6 space-y-6">
        <PageHeader
          title={collection?.cbuNumber || t.common.edit}
          description={`${collection?.clientFirstName || ""} ${collection?.clientLastName || ""}`}
          backUrl="/collections"
        />
        
        <Card>
          <CardContent className="pt-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-6">
                <TabsTrigger value="client" data-testid="tab-client">
                  <User className="h-4 w-4 mr-2" />
                  {t.collections?.client}
                </TabsTrigger>
                <TabsTrigger value="child" data-testid="tab-child">
                  <Baby className="h-4 w-4 mr-2" />
                  {t.collections?.child}
                </TabsTrigger>
                <TabsTrigger value="collection" data-testid="tab-collection">
                  <Syringe className="h-4 w-4 mr-2" />
                  {t.collections?.collection}
                </TabsTrigger>
                <TabsTrigger value="status" data-testid="tab-status">
                  <Clock className="h-4 w-4 mr-2" />
                  {t.collections?.status}
                </TabsTrigger>
                <TabsTrigger value="lab" data-testid="tab-lab">
                  <FlaskConical className="h-4 w-4 mr-2" />
                  {t.collections?.labResults}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="client">{renderClientForm()}</TabsContent>
              <TabsContent value="child">{renderChildForm()}</TabsContent>
              <TabsContent value="collection">{renderCollectionForm()}</TabsContent>
              <TabsContent value="status">{renderStatusForm()}</TabsContent>
              <TabsContent value="lab">
                <div className="text-center py-12 text-muted-foreground">
                  <FlaskConical className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{t.common.noData}</p>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex items-center justify-end mt-6 pt-6 border-t">
              <Button onClick={handleSave} disabled={updateMutation.isPending} data-testid="button-save">
                <Check className="h-4 w-4 mr-2" />
                {t.common.save}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={t.collections?.title}
        description={t.collections?.description}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t.common.search}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-collections"
              />
            </div>
          </div>
          <Link href="/collections/new">
            <Button data-testid="button-add-collection">
              <Plus className="h-4 w-4 mr-2" />
              {t.collections?.addCollection}
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredCollections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Syringe className="h-12 w-12 mb-4 opacity-50" />
              <p>{t.common.noData}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">{t.collections?.cbuNumber}</th>
                    <th className="text-left py-3 px-2 font-medium">{t.common.name}</th>
                    <th className="text-left py-3 px-2 font-medium">{t.common.country}</th>
                    <th className="text-left py-3 px-2 font-medium">{t.collaborators?.fields?.billingCompany}</th>
                    <th className="text-left py-3 px-2 font-medium">{t.collections?.status}</th>
                    <th className="text-right py-3 px-2 font-medium">{t.common.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCollections.map((col) => (
                    <tr 
                      key={col.id} 
                      className="border-b hover:bg-muted/50 cursor-pointer"
                      onClick={() => setLocation(`/collections/${col.id}`)}
                      data-testid={`row-collection-${col.id}`}
                    >
                      <td className="py-3 px-2 font-mono">{col.cbuNumber || notAvailable}</td>
                      <td className="py-3 px-2">
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {col.clientFirstName} {col.clientLastName}
                          </span>
                          {col.childFirstName && (
                            <span className="text-xs text-muted-foreground">
                              {col.childFirstName} {col.childLastName}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant="outline">{col.countryCode}</Badge>
                      </td>
                      <td className="py-3 px-2">{getBillingCompanyName(col.billingCompanyId)}</td>
                      <td className="py-3 px-2">
                        <Badge variant={col.state === "stored" ? "default" : "secondary"}>
                          {getStateLabel(col.state)}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setLocation(`/collections/${col.id}`)}
                            data-testid={`button-view-collection-${col.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(col)}
                            data-testid={`button-delete-collection-${col.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.collections?.deleteCollection}</DialogTitle>
            <DialogDescription>
              {t.collections?.deleteConfirm}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              {t.common.cancel}
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              {t.common.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
