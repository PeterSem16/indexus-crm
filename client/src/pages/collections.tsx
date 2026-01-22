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
  Users, Clock, LayoutDashboard, List, TrendingUp, Globe, Activity, ChevronLeft, ChevronRight, Download
} from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from "recharts";
import { Link, useLocation, useRoute } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Collection, BillingDetails, Product, Customer, Collaborator, Hospital, ProductSet, CollectionLabResult } from "@shared/schema";

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
  const [viewMode, setViewMode] = useState<"dashboard" | "list" | "calendar">("dashboard");
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  
  const dateFnsLocale = dateLocales[locale] || enUS;

  const { data: collections = [], isLoading } = useQuery<Collection[]>({
    queryKey: ["/api/collections"],
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

  const { data: labResults, isLoading: isLoadingLabResults } = useQuery<CollectionLabResult[]>({
    queryKey: ["/api/collections", collectionId, "lab-results"],
    queryFn: async () => {
      const res = await fetch(`/api/collections/${collectionId}/lab-results`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isEditing && !!collectionId,
  });

  const labResult = labResults?.[0];
  const [labFormData, setLabFormData] = useState<Partial<CollectionLabResult>>({});

  useEffect(() => {
    if (labResult) {
      setLabFormData(labResult);
    }
  }, [labResult]);

  const labResultMutation = useMutation({
    mutationFn: async (data: Partial<CollectionLabResult>) => {
      const res = await apiRequest("POST", `/api/collections/${collectionId}/lab-results`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collections", collectionId, "lab-results"] });
      toast({ title: t.common.save });
    },
    onError: () => {
      toast({ title: t.common.error, variant: "destructive" });
    },
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
      toast({ title: t.collections?.countryRequired, variant: "destructive" });
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

  const handleLabFieldChange = (field: keyof CollectionLabResult, value: string) => {
    setLabFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveLabResults = () => {
    labResultMutation.mutate({ ...labFormData, collectionId: collectionId! });
  };

  const labT = t.collections?.lab || {};

  const renderLabResultsForm = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium">{labT.basicInfo}</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{labT.usability}</Label>
            <Input
              value={labFormData.usability || ""}
              onChange={(e) => handleLabFieldChange("usability", e.target.value)}
              data-testid="input-lab-usability"
            />
          </div>
          <div className="space-y-2">
            <Label>{labT.cbu}</Label>
            <Input
              value={labFormData.cbu || ""}
              onChange={(e) => handleLabFieldChange("cbu", e.target.value)}
              data-testid="input-lab-cbu"
            />
          </div>
          <div className="space-y-2">
            <Label>{labT.collectionFor}</Label>
            <Input
              value={labFormData.collectionFor || ""}
              onChange={(e) => handleLabFieldChange("collectionFor", e.target.value)}
              data-testid="input-lab-collection-for"
            />
          </div>
          <div className="space-y-2">
            <Label>{labT.processing}</Label>
            <Input
              value={labFormData.processing || ""}
              onChange={(e) => handleLabFieldChange("processing", e.target.value)}
              data-testid="input-lab-processing"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>{labT.labNote}</Label>
          <Textarea
            value={labFormData.labNote || ""}
            onChange={(e) => handleLabFieldChange("labNote", e.target.value)}
            rows={3}
            data-testid="input-lab-note"
          />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">{labT.sterilitySection}</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{labT.sterility}</Label>
            <Input
              value={labFormData.sterility || ""}
              onChange={(e) => handleLabFieldChange("sterility", e.target.value)}
              data-testid="input-lab-sterility"
            />
          </div>
          <div className="space-y-2">
            <Label>{labT.sterilityType}</Label>
            <Input
              value={labFormData.sterilityType || ""}
              onChange={(e) => handleLabFieldChange("sterilityType", e.target.value)}
              data-testid="input-lab-sterility-type"
            />
          </div>
          <div className="space-y-2">
            <Label>{labT.resultOfSterility}</Label>
            <Input
              value={labFormData.resultOfSterility || ""}
              onChange={(e) => handleLabFieldChange("resultOfSterility", e.target.value)}
              data-testid="input-lab-result-sterility"
            />
          </div>
          <div className="space-y-2">
            <Label>{labT.infectionAgents}</Label>
            <Input
              value={labFormData.infectionAgents || ""}
              onChange={(e) => handleLabFieldChange("infectionAgents", e.target.value)}
              data-testid="input-lab-infection-agents"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">{labT.volumeSection}</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>{labT.tncCount}</Label>
            <Input
              value={labFormData.tncCount || ""}
              onChange={(e) => handleLabFieldChange("tncCount", e.target.value)}
              data-testid="input-lab-tnc-count"
            />
          </div>
          <div className="space-y-2">
            <Label>{labT.volume}</Label>
            <Input
              value={labFormData.volume || ""}
              onChange={(e) => handleLabFieldChange("volume", e.target.value)}
              data-testid="input-lab-volume"
            />
          </div>
          <div className="space-y-2">
            <Label>{labT.volumeInBag}</Label>
            <Input
              value={labFormData.volumeInBag || ""}
              onChange={(e) => handleLabFieldChange("volumeInBag", e.target.value)}
              data-testid="input-lab-volume-bag"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">{labT.tissueSection}</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{labT.umbilicalTissue}</Label>
            <Input
              value={labFormData.umbilicalTissue || ""}
              onChange={(e) => handleLabFieldChange("umbilicalTissue", e.target.value)}
              data-testid="input-lab-umbilical-tissue"
            />
          </div>
          <div className="space-y-2">
            <Label>{labT.tissueProcessed}</Label>
            <Input
              value={labFormData.tissueProcessed || ""}
              onChange={(e) => handleLabFieldChange("tissueProcessed", e.target.value)}
              data-testid="input-lab-tissue-processed"
            />
          </div>
          <div className="space-y-2">
            <Label>{labT.tissueSterility}</Label>
            <Input
              value={labFormData.tissueSterility || ""}
              onChange={(e) => handleLabFieldChange("tissueSterility", e.target.value)}
              data-testid="input-lab-tissue-sterility"
            />
          </div>
          <div className="space-y-2">
            <Label>{labT.tissueUsability}</Label>
            <Input
              value={labFormData.tissueUsability || ""}
              onChange={(e) => handleLabFieldChange("tissueUsability", e.target.value)}
              data-testid="input-lab-tissue-usability"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-lg font-medium">{labT.bagASection}</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{labT.bagAUsability}</Label>
              <Input
                value={labFormData.bagAUsability || ""}
                onChange={(e) => handleLabFieldChange("bagAUsability", e.target.value)}
                data-testid="input-lab-bag-a-usability"
              />
            </div>
            <div className="space-y-2">
              <Label>{labT.bagAVolume}</Label>
              <Input
                value={labFormData.bagAVolume || ""}
                onChange={(e) => handleLabFieldChange("bagAVolume", e.target.value)}
                data-testid="input-lab-bag-a-volume"
              />
            </div>
            <div className="space-y-2">
              <Label>{labT.bagATnc}</Label>
              <Input
                value={labFormData.bagATnc || ""}
                onChange={(e) => handleLabFieldChange("bagATnc", e.target.value)}
                data-testid="input-lab-bag-a-tnc"
              />
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <h3 className="text-lg font-medium">{labT.bagBSection}</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{labT.bagBUsability}</Label>
              <Input
                value={labFormData.bagBUsability || ""}
                onChange={(e) => handleLabFieldChange("bagBUsability", e.target.value)}
                data-testid="input-lab-bag-b-usability"
              />
            </div>
            <div className="space-y-2">
              <Label>{labT.bagBVolume}</Label>
              <Input
                value={labFormData.bagBVolume || ""}
                onChange={(e) => handleLabFieldChange("bagBVolume", e.target.value)}
                data-testid="input-lab-bag-b-volume"
              />
            </div>
            <div className="space-y-2">
              <Label>{labT.bagBTnc}</Label>
              <Input
                value={labFormData.bagBTnc || ""}
                onChange={(e) => handleLabFieldChange("bagBTnc", e.target.value)}
                data-testid="input-lab-bag-b-tnc"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t">
        <Button 
          onClick={handleSaveLabResults} 
          disabled={labResultMutation.isPending}
          data-testid="button-save-lab-results"
        >
          <Check className="h-4 w-4 mr-2" />
          {t.common.save}
        </Button>
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
                <TabsTrigger value="timeline" data-testid="tab-timeline">
                  <Activity className="h-4 w-4 mr-2" />
                  {t.collections?.timeline}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="client">{renderClientForm()}</TabsContent>
              <TabsContent value="child">{renderChildForm()}</TabsContent>
              <TabsContent value="collection">{renderCollectionForm()}</TabsContent>
              <TabsContent value="status">{renderStatusForm()}</TabsContent>
              <TabsContent value="lab">
                {isLoadingLabResults ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  renderLabResultsForm()
                )}
              </TabsContent>
              <TabsContent value="timeline">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">{t.collections?.workflowProgress}</h3>
                    <Badge variant={collection?.state === "stored" ? "default" : "secondary"}>
                      {t.collections?.currentStatus}: {getStateLabel(collection?.state || "")}
                    </Badge>
                  </div>
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                    <div className="space-y-6">
                      {COLLECTION_STATES.map((state, index) => {
                        const currentIndex = COLLECTION_STATES.indexOf(collection?.state || "created");
                        const isCompleted = index < currentIndex;
                        const isCurrent = index === currentIndex;
                        const isPending = index > currentIndex;
                        
                        return (
                          <div key={state} className="relative flex items-start gap-4 pl-10">
                            <div className={`absolute left-2 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              isCompleted ? "bg-primary border-primary" :
                              isCurrent ? "bg-primary border-primary" :
                              "bg-background border-muted-foreground"
                            }`}>
                              {isCompleted && <Check className="h-3 w-3 text-white" />}
                              {isCurrent && <div className="w-2 h-2 rounded-full bg-white" />}
                            </div>
                            <div className={`flex-1 ${isPending ? "opacity-50" : ""}`}>
                              <div className="flex items-center gap-2">
                                <span className={`font-medium ${isCurrent ? "text-primary" : ""}`}>
                                  {getStateLabel(state)}
                                </span>
                                {isCurrent && (
                                  <Badge variant="outline" className="text-xs">
                                    {t.collections?.currentStatus}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {index === 0 && t.collections?.timelineDescriptions?.created}
                                {index === 1 && t.collections?.timelineDescriptions?.paired}
                                {index === 2 && t.collections?.timelineDescriptions?.evaluated}
                                {index === 3 && t.collections?.timelineDescriptions?.verified}
                                {index === 4 && t.collections?.timelineDescriptions?.stored}
                                {index === 5 && t.collections?.timelineDescriptions?.transferred}
                                {index === 6 && t.collections?.timelineDescriptions?.released}
                                {index === 7 && t.collections?.timelineDescriptions?.pending_disposal}
                                {index === 8 && t.collections?.timelineDescriptions?.disposed}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div className="p-4 bg-primary/10 rounded-lg">
                      <p className="text-sm text-muted-foreground">{t.collections?.completedSteps}</p>
                      <p className="text-2xl font-bold text-primary">
                        {COLLECTION_STATES.indexOf(collection?.state || "created")}
                      </p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">{t.collections?.remainingSteps}</p>
                      <p className="text-2xl font-bold">
                        {COLLECTION_STATES.length - COLLECTION_STATES.indexOf(collection?.state || "created") - 1}
                      </p>
                    </div>
                  </div>
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

  const dashboardT = t.collections?.dashboard || {};
  const statesT = t.collections?.states || {};

  const CHART_COLORS = ["#6B1C3B", "#8B3A5B", "#AB587B", "#CB769B", "#EB94BB", "#FBB2DB", "#FFD0EB"];

  const statusData = COLLECTION_STATES.map(state => ({
    name: statesT[state] || state,
    value: filteredCollections.filter(c => c.state === state).length,
    state
  })).filter(d => d.value > 0);

  const countryData = selectedCountries.map(code => ({
    name: code,
    value: filteredCollections.filter(c => c.countryCode === code).length
  })).filter(d => d.value > 0);

  const now = new Date();
  const thisMonth = filteredCollections.filter(c => {
    if (!c.collectionDate) return false;
    const date = new Date(c.collectionDate);
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).length;

  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = filteredCollections.filter(c => {
    if (!c.collectionDate) return false;
    const date = new Date(c.collectionDate);
    return date.getMonth() === lastMonthDate.getMonth() && date.getFullYear() === lastMonthDate.getFullYear();
  }).length;

  const pendingLab = filteredCollections.filter(c => 
    c.state === "created" || c.state === "paired" || c.state === "evaluated"
  ).length;

  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const monthCollections = filteredCollections.filter(c => {
      if (!c.collectionDate) return false;
      const date = new Date(c.collectionDate);
      return date.getMonth() === d.getMonth() && date.getFullYear() === d.getFullYear();
    });
    return {
      name: format(d, "MMM", { locale: dateFnsLocale }),
      count: monthCollections.length
    };
  });

  const recentCollections = [...filteredCollections]
    .sort((a, b) => {
      const dateA = a.collectionDate ? new Date(a.collectionDate).getTime() : 0;
      const dateB = b.collectionDate ? new Date(b.collectionDate).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, 5);

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Syringe className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{dashboardT.totalCollections}</p>
                <p className="text-2xl font-bold">{filteredCollections.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{dashboardT.thisMonth}</p>
                <p className="text-2xl font-bold">{thisMonth}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-secondary/30 rounded-lg">
                <Calendar className="h-6 w-6 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{dashboardT.lastMonth}</p>
                <p className="text-2xl font-bold">{lastMonth}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-muted rounded-lg">
                <FlaskConical className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{dashboardT.pendingLabResults}</p>
                <p className="text-2xl font-bold">{pendingLab}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{dashboardT.byStatus}</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {statusData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                {t.common.noData}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{dashboardT.byCountry}</CardTitle>
          </CardHeader>
          <CardContent>
            {countryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={countryData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#6B1C3B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                {t.common.noData}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{dashboardT.monthlyTrend}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={monthlyData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#6B1C3B" strokeWidth={2} dot={{ fill: "#6B1C3B" }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{dashboardT.recentCollections}</CardTitle>
          </CardHeader>
          <CardContent>
            {recentCollections.length > 0 ? (
              <div className="space-y-3">
                {recentCollections.map(col => (
                  <div
                    key={col.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                    onClick={() => setLocation(`/collections/${col.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-full">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{col.clientFirstName} {col.clientLastName}</p>
                        <p className="text-xs text-muted-foreground">{col.cbuNumber}</p>
                      </div>
                    </div>
                    <Badge variant={col.state === "stored" ? "default" : "secondary"}>
                      {getStateLabel(col.state)}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                {t.common.noData}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = (firstDay.getDay() + 6) % 7;
    
    const days: (Date | null)[] = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const getCollectionsForDay = (date: Date) => {
    return filteredCollections.filter(c => {
      if (!c.collectionDate) return false;
      const colDate = new Date(c.collectionDate);
      return colDate.getDate() === date.getDate() &&
             colDate.getMonth() === date.getMonth() &&
             colDate.getFullYear() === date.getFullYear();
    });
  };

  const handleExportCSV = () => {
    if (!filteredCollections.length) {
      toast({
        title: t.common?.error,
        description: t.collections?.noDataToExport,
        variant: "destructive",
      });
      return;
    }
    
    const headers = [
      t.collections?.idColumn, 
      t.collections?.cbuNumber, 
      t.collections?.state, 
      t.collections?.clientFirstName, 
      t.collections?.clientLastName,
      t.collections?.clientEmail, 
      t.collections?.clientPhone, 
      t.collections?.childName, 
      t.collections?.birthDate, 
      t.collections?.birthWeight,
      t.collections?.hospital, 
      t.collections?.doctor, 
      t.collections?.collectionDate, 
      t.collections?.countryCode
    ];
    
    const csvContent = [
      headers.join(","),
      ...filteredCollections.map(col => [
        col.id,
        col.cbuNumber || "",
        col.state,
        `"${col.clientFirstName || ""}"`,
        `"${col.clientLastName || ""}"`,
        `"${col.clientEmail || ""}"`,
        `"${col.clientPhone || ""}"`,
        `"${col.childName || ""}"`,
        col.birthDate || "",
        col.birthWeight || "",
        `"${col.hospital || ""}"`,
        `"${col.doctor || ""}"`,
        col.collectionDate || "",
        col.countryCode || ""
      ].join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `collections_export_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
      title: t.common?.success,
      description: t.collections?.exportSuccess,
    });
  };

  const weekDays = [
    t.collections?.weekDays?.mon,
    t.collections?.weekDays?.tue,
    t.collections?.weekDays?.wed,
    t.collections?.weekDays?.thu,
    t.collections?.weekDays?.fri,
    t.collections?.weekDays?.sat,
    t.collections?.weekDays?.sun,
  ];
  const calendarDays = getDaysInMonth(calendarMonth);

  const renderCalendar = () => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
            data-testid="button-prev-month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-lg font-medium min-w-[180px] text-center">
            {format(calendarMonth, "LLLL yyyy", { locale: dateFnsLocale })}
          </h3>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
            data-testid="button-next-month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCalendarMonth(new Date())}
          data-testid="button-today"
        >
          {t.collections?.today}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map(day => (
            <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
          {calendarDays.map((date, index) => {
            if (!date) {
              return <div key={`empty-${index}`} className="h-24 bg-muted/20 rounded-md" />;
            }
            const dayCollections = getCollectionsForDay(date);
            const isToday = date.toDateString() === new Date().toDateString();
            return (
              <div
                key={date.toISOString()}
                className={`h-24 p-1 rounded-md border ${isToday ? "border-primary bg-primary/5" : "border-border"} overflow-hidden`}
              >
                <div className={`text-xs font-medium mb-1 ${isToday ? "text-primary" : ""}`}>
                  {date.getDate()}
                </div>
                <ScrollArea className="h-16">
                  <div className="space-y-1">
                    {dayCollections.map(col => (
                      <div
                        key={col.id}
                        className="text-xs p-1 bg-primary/10 rounded cursor-pointer hover-elevate truncate"
                        onClick={() => setLocation(`/collections/${col.id}`)}
                        title={`${col.clientFirstName} ${col.clientLastName}`}
                      >
                        {col.clientFirstName} {col.clientLastName?.charAt(0)}.
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={t.collections?.title}
        description={t.collections?.description}
      />

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "dashboard" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("dashboard")}
            data-testid="button-view-dashboard"
          >
            <LayoutDashboard className="h-4 w-4 mr-2" />
            {dashboardT.title}
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
            data-testid="button-view-list"
          >
            <List className="h-4 w-4 mr-2" />
            {dashboardT.listView}
          </Button>
          <Button
            variant={viewMode === "calendar" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("calendar")}
            data-testid="button-view-calendar"
          >
            <Calendar className="h-4 w-4 mr-2" />
            {dashboardT.calendarView}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={handleExportCSV}
            data-testid="button-export-csv"
          >
            <Download className="h-4 w-4 mr-2" />
            {t.collections?.exportCSV}
          </Button>
          <Link href="/collections/new">
            <Button data-testid="button-add-collection">
              <Plus className="h-4 w-4 mr-2" />
              {t.collections?.addCollection}
            </Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : viewMode === "dashboard" ? (
        renderDashboard()
      ) : viewMode === "calendar" ? (
        renderCalendar()
      ) : (
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
      )}

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
