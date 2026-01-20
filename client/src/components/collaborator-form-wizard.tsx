import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { PhoneNumberField } from "@/components/phone-number-field";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { COUNTRIES } from "@shared/schema";
import type { Collaborator, Hospital, SafeUser, HealthInsurance } from "@shared/schema";
import { ChevronLeft, ChevronRight, Check, User, Phone, CreditCard, Building2, Smartphone, MapPin, FileText, History, Plus, Pencil, Trash2, Clock, Activity, Upload, Download, Eye, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import type { CollaboratorAddress, CollaboratorAgreement, BillingDetails } from "@shared/schema";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";
import { getCountryFlag } from "@/lib/countries";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useModuleFieldPermissions } from "@/components/ui/permission-field";

const COLLABORATOR_TYPES = [
  { value: "doctor", labelKey: "doctor" },
  { value: "nurse", labelKey: "nurse" },
  { value: "resident", labelKey: "resident" },
  { value: "callCenter", labelKey: "callCenter" },
  { value: "headNurse", labelKey: "headNurse" },
  { value: "bm", labelKey: "bm" },
  { value: "vedono", labelKey: "vedono" },
  { value: "external", labelKey: "external" },
  { value: "representative", labelKey: "representative" },
  { value: "other", labelKey: "other" },
] as const;

const MARITAL_STATUSES = [
  { value: "single", labelKey: "single" },
  { value: "married", labelKey: "married" },
  { value: "divorced", labelKey: "divorced" },
  { value: "widowed", labelKey: "widowed" },
] as const;

interface CollaboratorFormData {
  legacyId: string;
  countryCode: string;
  titleBefore: string;
  firstName: string;
  lastName: string;
  maidenName: string;
  titleAfter: string;
  birthNumber: string;
  birthDay: number;
  birthMonth: number;
  birthYear: number;
  birthPlace: string;
  healthInsuranceId: string;
  maritalStatus: string;
  collaboratorType: string;
  phone: string;
  mobile: string;
  mobile2: string;
  otherContact: string;
  email: string;
  bankAccountIban: string;
  swiftCode: string;
  clientContact: boolean;
  representativeId: string;
  isActive: boolean;
  svetZdravia: boolean;
  companyName: string;
  ico: string;
  dic: string;
  icDph: string;
  companyIban: string;
  companySwift: string;
  monthRewards: boolean;
  note: string;
  hospitalId: string;
}

interface CollaboratorFormWizardProps {
  initialData?: Collaborator | null;
  onSuccess: () => void;
  onCancel?: () => void;
}

const WIZARD_STEPS = [
  { id: "personal", icon: User },
  { id: "contact", icon: Phone },
  { id: "banking", icon: CreditCard },
  { id: "companyAddress", icon: Building2 },
  { id: "agreements", icon: FileText },
  { id: "history", icon: History },
  { id: "mobile", icon: Smartphone },
];

function DateFields({
  label,
  dayValue,
  monthValue,
  yearValue,
  onDayChange,
  onMonthChange,
  onYearChange,
  testIdPrefix,
  t,
}: {
  label: string;
  dayValue: number;
  monthValue: number;
  yearValue: number;
  onDayChange: (val: number) => void;
  onMonthChange: (val: number) => void;
  onYearChange: (val: number) => void;
  testIdPrefix: string;
  t: any;
}) {
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Select
          value={dayValue?.toString() || ""}
          onValueChange={(v) => onDayChange(parseInt(v))}
        >
          <SelectTrigger className="w-[80px]" data-testid={`wizard-select-${testIdPrefix}-day`}>
            <SelectValue placeholder={t.collaborators.fields.day} />
          </SelectTrigger>
          <SelectContent>
            {days.map((d) => (
              <SelectItem key={d} value={d.toString()}>
                {d.toString().padStart(2, "0")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={monthValue?.toString() || ""}
          onValueChange={(v) => onMonthChange(parseInt(v))}
        >
          <SelectTrigger className="w-[100px]" data-testid={`wizard-select-${testIdPrefix}-month`}>
            <SelectValue placeholder={t.collaborators.fields.month} />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m} value={m.toString()}>
                {m.toString().padStart(2, "0")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={yearValue?.toString() || ""}
          onValueChange={(v) => onYearChange(parseInt(v))}
        >
          <SelectTrigger className="w-[100px]" data-testid={`wizard-select-${testIdPrefix}-year`}>
            <SelectValue placeholder={t.collaborators.fields.year} />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={y.toString()}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

// Address types
const ADDRESS_TYPES = [
  { value: "permanent", labelKey: "permanent" },
  { value: "correspondence", labelKey: "correspondence" },
  { value: "work", labelKey: "work" },
  { value: "company", labelKey: "company" },
];

// Reward types
const REWARD_TYPES = [
  { value: "per_sample", labelKey: "perSample" },
  { value: "monthly", labelKey: "monthly" },
  { value: "quarterly", labelKey: "quarterly" },
  { value: "annual", labelKey: "annual" },
  { value: "one_time", labelKey: "oneTime" },
];

// Non-company address types for collapsible display
const NON_COMPANY_ADDRESS_TYPES = [
  { value: "permanent", labelKey: "permanent" },
  { value: "correspondence", labelKey: "correspondence" },
  { value: "work", labelKey: "work" },
];

// Addresses Tab Content Component (for non-company addresses only)
function AddressesTabContent({ collaboratorId, countryCode, collaboratorName, t }: { collaboratorId: string; countryCode: string; collaboratorName?: string; t: any }) {
  const { toast } = useToast();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["permanent"]));
  
  const { data: addresses = [], isLoading } = useQuery<CollaboratorAddress[]>({
    queryKey: ["/api/collaborators", collaboratorId, "addresses"],
    queryFn: async () => {
      const res = await fetch(`/api/collaborators/${collaboratorId}/addresses`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!collaboratorId,
  });

  const toggleSection = (type: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  };

  const getAddressByType = (type: string) => addresses.find(a => a.addressType === type);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {NON_COMPANY_ADDRESS_TYPES.map(({ value, labelKey }) => {
        const address = getAddressByType(value);
        const isExpanded = expandedSections.has(value);
        
        return (
          <Collapsible key={value} open={isExpanded} onOpenChange={() => toggleSection(value)}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover-elevate">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span className="font-medium">
                        {(t.collaborators.addressTabs as Record<string, string>)[labelKey]}
                      </span>
                      {address && (
                        <Badge variant="outline" className="ml-2">
                          {address.city || address.streetNumber || t.common.filled}
                        </Badge>
                      )}
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <AddressForm 
                    collaboratorId={collaboratorId} 
                    addressType={value}
                    existingAddress={address}
                    collaboratorName={collaboratorName}
                    t={t}
                  />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
    </div>
  );
}

// Company Address Form Component (inline display)
function CompanyAddressForm({ collaboratorId, t }: { collaboratorId: string; t: any }) {
  const { toast } = useToast();
  
  const { data: addresses = [] } = useQuery<CollaboratorAddress[]>({
    queryKey: ["/api/collaborators", collaboratorId, "addresses"],
    queryFn: async () => {
      const res = await fetch(`/api/collaborators/${collaboratorId}/addresses`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!collaboratorId,
  });

  const companyAddress = addresses.find(a => a.addressType === "company");
  
  const [formData, setFormData] = useState({
    streetNumber: companyAddress?.streetNumber || "",
    city: companyAddress?.city || "",
    postalCode: companyAddress?.postalCode || "",
    region: companyAddress?.region || "",
    countryCode: companyAddress?.countryCode || "",
  });

  useEffect(() => {
    if (companyAddress) {
      setFormData({
        streetNumber: companyAddress.streetNumber || "",
        city: companyAddress.city || "",
        postalCode: companyAddress.postalCode || "",
        region: companyAddress.region || "",
        countryCode: companyAddress.countryCode || "",
      });
    }
  }, [companyAddress]);

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (companyAddress) {
        return apiRequest("PUT", `/api/collaborators/${collaboratorId}/addresses/${companyAddress.id}`, { ...data, addressType: "company" });
      }
      return apiRequest("POST", `/api/collaborators/${collaboratorId}/addresses`, { ...data, addressType: "company" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collaborators", collaboratorId, "addresses"] });
      toast({ title: t.success.saved });
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t.collaborators.fields.streetNumber}</Label>
          <Input
            value={formData.streetNumber}
            onChange={(e) => setFormData({ ...formData, streetNumber: e.target.value })}
            data-testid="wizard-input-company-address-street"
          />
        </div>
        <div className="space-y-2">
          <Label>{t.collaborators.fields.city}</Label>
          <Input
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            data-testid="wizard-input-company-address-city"
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t.collaborators.fields.postalCode}</Label>
          <Input
            value={formData.postalCode}
            onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
            data-testid="wizard-input-company-address-zip"
          />
        </div>
        <div className="space-y-2">
          <Label>{t.collaborators.fields.region}</Label>
          <Input
            value={formData.region}
            onChange={(e) => setFormData({ ...formData, region: e.target.value })}
            data-testid="wizard-input-company-address-region"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate(formData)} disabled={saveMutation.isPending} data-testid="button-save-company-address">
          {saveMutation.isPending ? t.common.loading : t.common.save}
        </Button>
      </div>
    </div>
  );
}

// Address Form Component
function AddressForm({ collaboratorId, addressType, existingAddress, collaboratorName, t }: { 
  collaboratorId: string; 
  addressType: string; 
  existingAddress?: CollaboratorAddress;
  collaboratorName?: string;
  t: any;
}) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: existingAddress?.name || "",
    streetNumber: existingAddress?.streetNumber || "",
    city: existingAddress?.city || "",
    postalCode: existingAddress?.postalCode || "",
    region: existingAddress?.region || "",
    countryCode: existingAddress?.countryCode || "",
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (existingAddress) {
        return apiRequest("PUT", `/api/collaborators/${collaboratorId}/addresses/${existingAddress.id}`, { ...data, addressType });
      }
      return apiRequest("POST", `/api/collaborators/${collaboratorId}/addresses`, { ...data, addressType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collaborators", collaboratorId, "addresses"] });
      toast({ title: t.success.saved });
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  const copyCollaboratorName = () => {
    if (collaboratorName) {
      setFormData({ ...formData, name: collaboratorName });
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t.collaborators.fields.name}</Label>
            {collaboratorName && (
              <Button type="button" variant="ghost" size="sm" onClick={copyCollaboratorName} data-testid={`button-copy-name-${addressType}`}>
                <Copy className="h-3 w-3 mr-1" />
                {t.common.copy}
              </Button>
            )}
          </div>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            data-testid={`input-address-${addressType}-name`}
            placeholder={collaboratorName || ""}
          />
        </div>
        <div className="space-y-2">
          <Label>{t.collaborators.fields.streetNumber}</Label>
          <Input
            value={formData.streetNumber}
            onChange={(e) => setFormData({ ...formData, streetNumber: e.target.value })}
            data-testid={`input-address-${addressType}-street`}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t.collaborators.fields.city}</Label>
          <Input
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            data-testid={`input-address-${addressType}-city`}
          />
        </div>
        <div className="space-y-2">
          <Label>{t.collaborators.fields.postalCode}</Label>
          <Input
            value={formData.postalCode}
            onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
            data-testid={`input-address-${addressType}-zip`}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t.collaborators.fields.region}</Label>
          <Input
            value={formData.region}
            onChange={(e) => setFormData({ ...formData, region: e.target.value })}
            data-testid={`input-address-${addressType}-region`}
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate(formData)} disabled={saveMutation.isPending} data-testid={`button-save-address-${addressType}`}>
          {saveMutation.isPending ? t.common.loading : t.common.save}
        </Button>
      </div>
    </div>
  );
}

// Agreements Tab Content Component
function AgreementsTabContent({ collaboratorId, collaboratorCountry, t }: { collaboratorId: string; collaboratorCountry: string; t: any }) {
  const { toast } = useToast();
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  
  const { data: agreements = [] } = useQuery<CollaboratorAgreement[]>({
    queryKey: ["/api/collaborators", collaboratorId, "agreements"],
    queryFn: async () => {
      const res = await fetch(`/api/collaborators/${collaboratorId}/agreements`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!collaboratorId,
  });

  const { data: billingCompanies = [] } = useQuery<BillingDetails[]>({
    queryKey: ["/api/billing-details", collaboratorCountry],
    queryFn: async () => {
      const res = await fetch(`/api/billing-details?country=${collaboratorCountry}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!collaboratorCountry,
  });

  const deleteMutation = useMutation({
    mutationFn: (agreementId: string) => {
      return apiRequest("DELETE", `/api/collaborators/${collaboratorId}/agreements/${agreementId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collaborators", collaboratorId, "agreements"] });
      toast({ title: t.success.deleted });
    },
    onError: () => {
      toast({ title: t.errors.deleteFailed, variant: "destructive" });
    },
  });

  const handleFileUpload = async (agreementId: string, file: File) => {
    setUploadingFile(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);
      
      const response = await fetch(`/api/collaborators/${collaboratorId}/agreements/${agreementId}/upload`, {
        method: "POST",
        credentials: "include",
        body: formDataUpload,
      });
      
      if (!response.ok) throw new Error(t.errors.uploadFailed);
      
      queryClient.invalidateQueries({ queryKey: ["/api/collaborators", collaboratorId, "agreements"] });
      toast({ title: t.success.saved });
    } catch (error) {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    } finally {
      setUploadingFile(false);
    }
  };

  const formatDate = (day: number | null, month: number | null, year: number | null) => {
    if (!day || !month || !year) return t.common.noData;
    return `${day}.${month}.${year}`;
  };

  const getBillingCompanyName = (id: string | null) => {
    if (!id) return t.common.noData;
    return billingCompanies.find((bc) => bc.id === id)?.companyName || t.common.noData;
  };

  if (isAddingNew || editingId) {
    return (
      <AgreementForm
        collaboratorId={collaboratorId}
        editingId={editingId}
        agreement={editingId ? agreements.find(a => a.id === editingId) : undefined}
        billingCompanies={billingCompanies}
        onCancel={() => {
          setIsAddingNew(false);
          setEditingId(null);
        }}
        onSuccess={() => {
          setIsAddingNew(false);
          setEditingId(null);
        }}
        t={t}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setIsAddingNew(true)} data-testid="button-add-agreement">
          <Plus className="h-4 w-4 mr-2" />
          {t.common.add}
        </Button>
      </div>
      {agreements.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">{t.common.noData}</div>
      ) : (
        <div className="space-y-2">
          {agreements.map((agreement) => (
            <Card key={agreement.id}>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">{t.collaborators?.fields?.billingCompany}: </span>
                        {getBillingCompanyName(agreement.billingCompanyId)}
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t.collaborators?.fields?.contractNumber}: </span>
                        {agreement.contractNumber || t.common.noData}
                      </div>
                      <div>
                        <Badge variant={agreement.isValid ? "default" : "secondary"}>
                          {agreement.isValid ? t.common.active : t.common.inactive}
                        </Badge>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button size="icon" variant="ghost" onClick={() => setEditingId(agreement.id)} data-testid={`button-edit-agreement-${agreement.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(agreement.id)} data-testid={`button-delete-agreement-${agreement.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">{t.collaborators?.fields?.validFrom}: </span>
                      {formatDate(agreement.validFromDay, agreement.validFromMonth, agreement.validFromYear)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t.collaborators?.fields?.validTo}: </span>
                      {formatDate(agreement.validToDay, agreement.validToMonth, agreement.validToYear)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 pt-2 border-t">
                    <div className="flex items-center gap-2">
                      {agreement.fileName ? (
                        <>
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{agreement.fileName}</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => window.open(`/api/collaborators/${collaboratorId}/agreements/${agreement.id}/file`, "_blank")}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => window.open(`/api/collaborators/${collaboratorId}/agreements/${agreement.id}/download`, "_blank")}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">{t.collaborators.noFile}</span>
                      )}
                    </div>
                    <div>
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(agreement.id, file);
                          }}
                          disabled={uploadingFile}
                        />
                        <Button variant="outline" size="sm" disabled={uploadingFile} asChild>
                          <span>
                            <Upload className="h-4 w-4 mr-2" />
                            {uploadingFile ? t.common.loading : t.collaborators.uploadAgreement}
                          </span>
                        </Button>
                      </label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Agreement Form Types
const AGREEMENT_FORM_TYPES = [
  { value: "dohoda_o_vykonani_prace", labelKey: "dohodaOVykonaniPrace" },
  { value: "zmluva_o_dielo_podnikatel", labelKey: "zmluvaODieloPodnikatel" },
  { value: "zmluva_o_dielo_fyzicka_osoba", labelKey: "zmluvaODieloFyzickaOsoba" },
] as const;

// Agreement Form Component
function AgreementForm({ collaboratorId, editingId, agreement, billingCompanies, onCancel, onSuccess, t }: {
  collaboratorId: string;
  editingId: string | null;
  agreement?: CollaboratorAgreement;
  billingCompanies: BillingDetails[];
  onCancel: () => void;
  onSuccess: () => void;
  t: any;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [formData, setFormData] = useState({
    billingCompanyId: agreement?.billingCompanyId || "",
    contractNumber: agreement?.contractNumber || "",
    agreementForm: agreement?.agreementForm || "",
    validFromDay: agreement?.validFromDay,
    validFromMonth: agreement?.validFromMonth,
    validFromYear: agreement?.validFromYear,
    validToDay: agreement?.validToDay,
    validToMonth: agreement?.validToMonth,
    validToYear: agreement?.validToYear,
    agreementSentDay: agreement?.agreementSentDay,
    agreementSentMonth: agreement?.agreementSentMonth,
    agreementSentYear: agreement?.agreementSentYear,
    agreementReturnedDay: agreement?.agreementReturnedDay,
    agreementReturnedMonth: agreement?.agreementReturnedMonth,
    agreementReturnedYear: agreement?.agreementReturnedYear,
    isValid: agreement?.isValid ?? true,
    notes: (agreement as any)?.notes || "",
  });

  const saveMutation = useMutation({
    mutationFn: (data: typeof formData) => {
      if (editingId) {
        return apiRequest("PUT", `/api/collaborators/${collaboratorId}/agreements/${editingId}`, data);
      }
      return apiRequest("POST", `/api/collaborators/${collaboratorId}/agreements`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collaborators", collaboratorId, "agreements"] });
      toast({ title: t.success.saved });
      onSuccess();
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  const setToday = (field: "validFrom" | "validTo" | "agreementSent" | "agreementReturned") => {
    const today = new Date();
    const updates = {
      [`${field}Day`]: today.getDate(),
      [`${field}Month`]: today.getMonth() + 1,
      [`${field}Year`]: today.getFullYear(),
    };
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const setEndOfYear = (sourceYear?: number | null) => {
    const year = sourceYear || new Date().getFullYear();
    setFormData(prev => ({ ...prev, validToDay: 31, validToMonth: 12, validToYear: year }));
  };

  const handleFileUpload = async (file: File) => {
    if (!editingId) {
      return;
    }
    setUploadingFile(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);
      
      const response = await fetch(`/api/collaborators/${collaboratorId}/agreements/${editingId}/upload`, {
        method: "POST",
        credentials: "include",
        body: formDataUpload,
      });
      
      if (!response.ok) throw new Error();
      
      queryClient.invalidateQueries({ queryKey: ["/api/collaborators", collaboratorId, "agreements"] });
      toast({ title: t.success.saved });
    } catch (error) {
      toast({ title: t.errors.uploadFailed, variant: "destructive" });
    } finally {
      setUploadingFile(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>{t.collaborators?.fields?.billingCompany}</Label>
          <Select
            value={formData.billingCompanyId || "_none"}
            onValueChange={(value) => setFormData({ ...formData, billingCompanyId: value === "_none" ? "" : value })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t.collaborators?.fields?.billingCompany} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">{t.common?.noData}</SelectItem>
              {billingCompanies.map((bc) => (
                <SelectItem key={bc.id} value={bc.id}>{bc.companyName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t.collaborators?.fields?.contractNumber}</Label>
          <Input
            value={formData.contractNumber || ""}
            onChange={(e) => setFormData({ ...formData, contractNumber: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t.collaborators?.fields?.agreementForm}</Label>
        <Select
          value={formData.agreementForm || "_none"}
          onValueChange={(value) => setFormData({ ...formData, agreementForm: value === "_none" ? "" : value })}
        >
          <SelectTrigger data-testid="select-agreement-form">
            <SelectValue placeholder={t.collaborators?.fields?.agreementForm} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">{t.common?.noData}</SelectItem>
            {AGREEMENT_FORM_TYPES.map((af) => (
              <SelectItem key={af.value} value={af.value}>
                {(t.collaborators.agreementFormTypes as Record<string, string>)[af.labelKey]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t.collaborators?.fields?.validFrom}</Label>
            <Button type="button" variant="ghost" size="sm" onClick={() => setToday("validFrom")} data-testid="button-today-valid-from">
              {t.common.today}
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder={t.collaborators.fields.day}
              value={formData.validFromDay || ""}
              onChange={(e) => setFormData({ ...formData, validFromDay: parseInt(e.target.value) || undefined })}
              className="w-20"
            />
            <Input
              type="number"
              placeholder={t.collaborators.fields.month}
              value={formData.validFromMonth || ""}
              onChange={(e) => setFormData({ ...formData, validFromMonth: parseInt(e.target.value) || undefined })}
              className="w-20"
            />
            <Input
              type="number"
              placeholder={t.collaborators.fields.year}
              value={formData.validFromYear || ""}
              onChange={(e) => setFormData({ ...formData, validFromYear: parseInt(e.target.value) || undefined })}
              className="w-24"
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t.collaborators?.fields?.validTo}</Label>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEndOfYear(formData.validFromYear)} data-testid="button-end-of-year">
              {t.common.endOfYear}
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder={t.collaborators.fields.day}
              value={formData.validToDay || ""}
              onChange={(e) => setFormData({ ...formData, validToDay: parseInt(e.target.value) || undefined })}
              className="w-20"
            />
            <Input
              type="number"
              placeholder={t.collaborators.fields.month}
              value={formData.validToMonth || ""}
              onChange={(e) => setFormData({ ...formData, validToMonth: parseInt(e.target.value) || undefined })}
              className="w-20"
            />
            <Input
              type="number"
              placeholder={t.collaborators.fields.year}
              value={formData.validToYear || ""}
              onChange={(e) => setFormData({ ...formData, validToYear: parseInt(e.target.value) || undefined })}
              className="w-24"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t.collaborators?.fields?.agreementSent}</Label>
            <Button type="button" variant="ghost" size="sm" onClick={() => setToday("agreementSent")} data-testid="button-today-agreement-sent">
              {t.common.today}
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder={t.collaborators.fields.day}
              value={formData.agreementSentDay || ""}
              onChange={(e) => setFormData({ ...formData, agreementSentDay: parseInt(e.target.value) || undefined })}
              className="w-20"
              data-testid="input-agreement-sent-day"
            />
            <Input
              type="number"
              placeholder={t.collaborators.fields.month}
              value={formData.agreementSentMonth || ""}
              onChange={(e) => setFormData({ ...formData, agreementSentMonth: parseInt(e.target.value) || undefined })}
              className="w-20"
              data-testid="input-agreement-sent-month"
            />
            <Input
              type="number"
              placeholder={t.collaborators.fields.year}
              value={formData.agreementSentYear || ""}
              onChange={(e) => setFormData({ ...formData, agreementSentYear: parseInt(e.target.value) || undefined })}
              className="w-24"
              data-testid="input-agreement-sent-year"
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t.collaborators?.fields?.agreementReturned}</Label>
            <Button type="button" variant="ghost" size="sm" onClick={() => setToday("agreementReturned")} data-testid="button-today-agreement-returned">
              {t.common.today}
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder={t.collaborators.fields.day}
              value={formData.agreementReturnedDay || ""}
              onChange={(e) => setFormData({ ...formData, agreementReturnedDay: parseInt(e.target.value) || undefined })}
              className="w-20"
              data-testid="input-agreement-returned-day"
            />
            <Input
              type="number"
              placeholder={t.collaborators.fields.month}
              value={formData.agreementReturnedMonth || ""}
              onChange={(e) => setFormData({ ...formData, agreementReturnedMonth: parseInt(e.target.value) || undefined })}
              className="w-20"
              data-testid="input-agreement-returned-month"
            />
            <Input
              type="number"
              placeholder={t.collaborators.fields.year}
              value={formData.agreementReturnedYear || ""}
              onChange={(e) => setFormData({ ...formData, agreementReturnedYear: parseInt(e.target.value) || undefined })}
              className="w-24"
              data-testid="input-agreement-returned-year"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          checked={formData.isValid}
          onCheckedChange={(checked) => setFormData({ ...formData, isValid: checked })}
        />
        <Label>{t.collaborators?.fields?.isValid}</Label>
      </div>

      <div className="space-y-2">
        <Label>{t.collaborators?.fields?.notes}</Label>
        <Textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder={t.collaborators?.fields?.notes}
          className="min-h-[80px]"
          data-testid="textarea-agreement-notes"
        />
      </div>

      {editingId && (
        <div className="space-y-2">
          <Label>{t.collaborators?.uploadAgreement}</Label>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFile}
              data-testid="button-upload-agreement"
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploadingFile ? t.common.loading : t.collaborators?.selectFile}
            </Button>
            {agreement?.fileName && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <FileText className="h-4 w-4" />
                {agreement.fileName}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          {t.common.cancel}
        </Button>
        <Button onClick={() => saveMutation.mutate(formData)} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? t.common.loading : t.common.save}
        </Button>
      </div>
    </div>
  );
}

// History Tab Content Component
interface ActivityLog {
  id: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  details: string | null;
  createdAt: Date;
}

function HistoryTabContent({ collaboratorId, t }: { collaboratorId: string; t: any }) {
  const { data: activityLogs = [], isLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/activity-logs", "collaborator", collaboratorId],
    queryFn: async () => {
      const res = await fetch(`/api/activity-logs?entityType=collaborator&entityId=${collaboratorId}`, { 
        credentials: "include" 
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!collaboratorId,
  });

  const getActionIcon = (action: string) => {
    switch (action) {
      case "create": return <Plus className="h-4 w-4 text-green-500" />;
      case "update": return <Pencil className="h-4 w-4 text-blue-500" />;
      case "delete": return <Trash2 className="h-4 w-4 text-red-500" />;
      default: return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "create": return t.collaborators.history?.actionTypes?.created || t.collaborators.actions.created;
      case "update": return t.collaborators.history?.actionTypes?.updated || t.collaborators.actions.updated;
      default: return action;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activityLogs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {t.collaborators.history?.noHistory || t.common.noData}
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
      <div className="space-y-6">
        {activityLogs.map((log) => (
          <div key={log.id} className="relative pl-10">
            <div className="absolute left-2 w-5 h-5 rounded-full bg-background border-2 border-border flex items-center justify-center">
              {getActionIcon(log.action)}
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">{getActionLabel(log.action)}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
              {log.details && (
                <p className="text-sm text-muted-foreground">{log.details}</p>
              )}
              {log.userId && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t.collaborators.actions.by}: {log.userId}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CollaboratorFormWizard({ initialData, onSuccess, onCancel }: CollaboratorFormWizardProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const { isHidden, isReadonly } = useModuleFieldPermissions("collaborators");
  
  
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  
  const [mobileCredentials, setMobileCredentials] = useState({
    mobileAppEnabled: initialData?.mobileAppEnabled ?? false,
    mobileUsername: initialData?.mobileUsername ?? "",
    mobilePassword: "",
    mobilePasswordConfirm: "",
  });

  const [formData, setFormData] = useState<CollaboratorFormData>(() =>
    initialData
      ? {
          legacyId: initialData.legacyId || "",
          countryCode: initialData.countryCode,
          titleBefore: initialData.titleBefore || "",
          firstName: initialData.firstName,
          lastName: initialData.lastName,
          maidenName: initialData.maidenName || "",
          titleAfter: initialData.titleAfter || "",
          birthNumber: initialData.birthNumber || "",
          birthDay: initialData.birthDay || 0,
          birthMonth: initialData.birthMonth || 0,
          birthYear: initialData.birthYear || 0,
          birthPlace: initialData.birthPlace || "",
          healthInsuranceId: initialData.healthInsuranceId || "",
          maritalStatus: initialData.maritalStatus || "",
          collaboratorType: initialData.collaboratorType || "",
          phone: initialData.phone || "",
          mobile: initialData.mobile || "",
          mobile2: initialData.mobile2 || "",
          otherContact: initialData.otherContact || "",
          email: initialData.email || "",
          bankAccountIban: initialData.bankAccountIban || "",
          swiftCode: initialData.swiftCode || "",
          clientContact: initialData.clientContact,
          representativeId: initialData.representativeId || "",
          isActive: initialData.isActive,
          svetZdravia: initialData.svetZdravia,
          companyName: initialData.companyName || "",
          ico: initialData.ico || "",
          dic: initialData.dic || "",
          icDph: initialData.icDph || "",
          companyIban: initialData.companyIban || "",
          companySwift: initialData.companySwift || "",
          monthRewards: initialData.monthRewards,
          note: initialData.note || "",
          hospitalId: initialData.hospitalId || "",
        }
      : {
          legacyId: "",
          countryCode: "",
          titleBefore: "",
          firstName: "",
          lastName: "",
          maidenName: "",
          titleAfter: "",
          birthNumber: "",
          birthDay: 0,
          birthMonth: 0,
          birthYear: 0,
          birthPlace: "",
          healthInsuranceId: "",
          maritalStatus: "",
          collaboratorType: "",
          phone: "",
          mobile: "",
          mobile2: "",
          otherContact: "",
          email: "",
          bankAccountIban: "",
          swiftCode: "",
          clientContact: false,
          representativeId: "",
          isActive: true,
          svetZdravia: false,
          companyName: "",
          ico: "",
          dic: "",
          icDph: "",
          companyIban: "",
          companySwift: "",
          monthRewards: false,
          note: "",
          hospitalId: "",
        }
  );

  const { data: users = [] } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
  });

  const { data: healthInsurances = [] } = useQuery<HealthInsurance[]>({
    queryKey: ["/api/config/health-insurance"],
  });

  const { data: hospitals = [] } = useQuery<Hospital[]>({
    queryKey: ["/api/hospitals"],
  });

  const filteredHealthInsurances = formData.countryCode
    ? healthInsurances.filter((hi) => hi.countryCode === formData.countryCode)
    : healthInsurances;

  const filteredHospitals = formData.countryCode
    ? hospitals.filter((h) => h.countryCode === formData.countryCode)
    : hospitals;

  const saveMutation = useMutation({
    mutationFn: async (data: CollaboratorFormData) => {
      console.log("[Wizard] mutationFn starting, data:", data);
      console.log("[Wizard] initialData:", initialData);
      let collaboratorId: string;
      
      try {
        if (initialData) {
          console.log("[Wizard] Calling PUT /api/collaborators/" + initialData.id);
          await apiRequest("PUT", `/api/collaborators/${initialData.id}`, data);
          collaboratorId = initialData.id;
        } else {
          console.log("[Wizard] Calling POST /api/collaborators");
          const response = await apiRequest("POST", "/api/collaborators", data);
          const newCollaborator = await response.json();
          collaboratorId = newCollaborator.id;
          console.log("[Wizard] Created collaborator with id:", collaboratorId);
        }
      } catch (apiError) {
        console.error("[Wizard] API request failed:", apiError);
        throw apiError;
      }
      
      // Save mobile credentials if enabled or if previously enabled
      if (mobileCredentials.mobileAppEnabled || initialData?.mobileAppEnabled) {
        const mobileData: { mobileAppEnabled: boolean; mobileUsername?: string; mobilePassword?: string } = {
          mobileAppEnabled: mobileCredentials.mobileAppEnabled,
        };
        
        if (mobileCredentials.mobileAppEnabled) {
          mobileData.mobileUsername = mobileCredentials.mobileUsername;
          if (mobileCredentials.mobilePassword) {
            mobileData.mobilePassword = mobileCredentials.mobilePassword;
          }
        }
        
        await apiRequest("PUT", `/api/collaborators/${collaboratorId}/mobile-credentials`, mobileData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collaborators"] });
      toast({ title: t.success.saved });
      onSuccess();
    },
    onError: (error: any) => {
      console.error("[Wizard] Save error:", error);
      const errorMessage = error?.message || error?.toString() || t.errors.saveFailed;
      toast({ title: errorMessage, variant: "destructive" });
    },
  });

  const progress = ((currentStep + 1) / WIZARD_STEPS.length) * 100;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === WIZARD_STEPS.length - 1;

  const validateCurrentStep = (): boolean => {
    switch (currentStep) {
      case 0:
        return !!formData.firstName && !!formData.lastName && !!formData.countryCode;
      case 6: // Mobile step (INDEXUS Connect)
        if (mobileCredentials.mobileAppEnabled) {
          if (!mobileCredentials.mobileUsername) {
            toast({ title: t.collaborators.mobileApp.usernameRequired, variant: "destructive" });
            return false;
          }
          if (!initialData?.mobilePasswordHash && !mobileCredentials.mobilePassword) {
            toast({ title: t.collaborators.mobileApp.passwordRequired, variant: "destructive" });
            return false;
          }
          if (mobileCredentials.mobilePassword && mobileCredentials.mobilePassword !== mobileCredentials.mobilePasswordConfirm) {
            toast({ title: t.collaborators.mobileApp.passwordMismatch, variant: "destructive" });
            return false;
          }
        }
        return true;
      default:
        return true;
    }
  };

  // The save step is always the mobile step (index 4), additional tabs don't trigger save
  const SAVE_STEP_INDEX = 6; // Mobile step (last step)
  // Check if current step is a save step (mobile step = step 6, which is the last step)
  const isSaveStep = currentStep === SAVE_STEP_INDEX;
  
  const handleNext = () => {
    console.log("[Wizard] handleNext called, currentStep:", currentStep, "isSaveStep:", isSaveStep, "WIZARD_STEPS.length:", WIZARD_STEPS.length);
    
    const isValid = validateCurrentStep();
    console.log("[Wizard] validateCurrentStep result:", isValid);
    
    if (!isValid) {
      return;
    }
    
    setCompletedSteps(prev => new Set(Array.from(prev).concat(currentStep)));
    
    // Save on mobile step (step 6), which is the last step
    if (isSaveStep) {
      console.log("[Wizard] Calling saveMutation.mutate with formData:", formData);
      saveMutation.mutate(formData);
      // Mutation onSuccess will call onSuccess() to close dialog
      return;
    } else {
      console.log("[Wizard] Moving to next step:", currentStep + 1);
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleStepClick = (index: number) => {
    if (index === currentStep) {
      return;
    }
    
    // When editing existing collaborator, allow clicking on any step
    if (initialData) {
      setCurrentStep(index);
      return;
    }
    
    // For new collaborators, require completing previous steps
    if (index < currentStep) {
      setCurrentStep(index);
    } else {
      for (let i = 0; i < index; i++) {
        if (!completedSteps.has(i)) {
          toast({ title: t.wizard.completePreviousSteps, variant: "destructive" });
          return;
        }
      }
      setCurrentStep(index);
    }
  };

  const getStepTitle = (stepId: string): string => {
    const steps = t.wizard.steps;
    const stepTitles: Record<string, string> = {
      personal: steps.personalInfo,
      contact: steps.contactDetails,
      banking: steps.banking,
      companyAddress: t.collaborators.tabs.companyAndAddresses,
      agreements: t.collaborators.tabs.agreements,
      history: t.collaborators.tabs.history,
      mobile: steps.mobile,
    };
    return stepTitles[stepId] || stepId;
  };

  const getStepDescription = (stepId: string): string => {
    const steps = t.wizard.steps;
    const stepDescs: Record<string, string> = {
      personal: steps.personalInfoDesc,
      contact: steps.contactDetailsDesc,
      banking: steps.bankingDesc,
      companyAddress: t.collaborators.companyAddressesDescription,
      agreements: t.collaborators.agreementsDescription,
      history: t.collaborators.historyDescription,
      mobile: steps.mobileDesc,
    };
    return stepDescs[stepId] || "";
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {!isHidden("legacy_id") && (
                <div className="space-y-2">
                  <Label>{t.collaborators.legacyId}</Label>
                  <Input
                    value={formData.legacyId}
                    onChange={(e) => setFormData({ ...formData, legacyId: e.target.value })}
                    placeholder={t.collaborators.legacyId}
                    data-testid="wizard-input-collaborator-legacy-id"
                    disabled={isReadonly("legacy_id")}
                    className={isReadonly("legacy_id") ? "bg-muted" : ""}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>{t.collaborators.fields.country} *</Label>
                <Select
                  value={formData.countryCode}
                  onValueChange={(value) => setFormData({ ...formData, countryCode: value, healthInsuranceId: "", hospitalId: "" })}
                >
                  <SelectTrigger data-testid="wizard-select-collaborator-country">
                    <SelectValue placeholder={t.collaborators.fields.country} />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {getCountryFlag(country.code)} {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t.collaborators.fields.collaboratorType}</Label>
                <Select
                  value={formData.collaboratorType || "_none"}
                  onValueChange={(value) => setFormData({ ...formData, collaboratorType: value === "_none" ? "" : value })}
                >
                  <SelectTrigger data-testid="wizard-select-collaborator-type">
                    <SelectValue placeholder={t.collaborators.fields.collaboratorType} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">{t.common.noData}</SelectItem>
                    {COLLABORATOR_TYPES.map((ct) => (
                      <SelectItem key={ct.value} value={ct.value}>
                        {(t.collaborators.types as Record<string, string>)[ct.labelKey]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
              {!isHidden("title_before") && (
                <div className="space-y-2">
                  <Label>{t.collaborators.fields.titleBefore}</Label>
                  <Input
                    value={formData.titleBefore}
                    onChange={(e) => setFormData({ ...formData, titleBefore: e.target.value })}
                    data-testid="wizard-input-collaborator-title-before"
                    disabled={isReadonly("title_before")}
                    className={isReadonly("title_before") ? "bg-muted" : ""}
                  />
                </div>
              )}
              {!isHidden("first_name") && (
                <div className="space-y-2">
                  <Label>{t.collaborators.fields.firstName} *</Label>
                  <Input
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    data-testid="wizard-input-collaborator-firstname"
                    disabled={isReadonly("first_name")}
                    className={isReadonly("first_name") ? "bg-muted" : ""}
                  />
                </div>
              )}
              {!isHidden("last_name") && (
                <div className="space-y-2">
                  <Label>{t.collaborators.fields.lastName} *</Label>
                  <Input
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    data-testid="wizard-input-collaborator-lastname"
                    disabled={isReadonly("last_name")}
                    className={isReadonly("last_name") ? "bg-muted" : ""}
                  />
                </div>
              )}
              {!isHidden("title_after") && (
                <div className="space-y-2">
                  <Label>{t.collaborators.fields.titleAfter}</Label>
                  <Input
                    value={formData.titleAfter}
                    onChange={(e) => setFormData({ ...formData, titleAfter: e.target.value })}
                    data-testid="wizard-input-collaborator-title-after"
                    disabled={isReadonly("title_after")}
                    className={isReadonly("title_after") ? "bg-muted" : ""}
                  />
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {!isHidden("date_of_birth") && (
                <DateFields
                  label={t.collaborators.fields.birthDate}
                  dayValue={formData.birthDay}
                  monthValue={formData.birthMonth}
                  yearValue={formData.birthYear}
                  onDayChange={(val) => setFormData({ ...formData, birthDay: val })}
                  onMonthChange={(val) => setFormData({ ...formData, birthMonth: val })}
                  onYearChange={(val) => setFormData({ ...formData, birthYear: val })}
                  testIdPrefix="birth"
                  t={t}
                />
              )}
              <div className="space-y-2">
                <Label>{t.collaborators.fields.birthPlace}</Label>
                <Input
                  value={formData.birthPlace}
                  onChange={(e) => setFormData({ ...formData, birthPlace: e.target.value })}
                  data-testid="wizard-input-collaborator-birth-place"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t.collaborators.fields.healthInsurance}</Label>
                <Select
                  value={formData.healthInsuranceId || "_none"}
                  onValueChange={(value) => setFormData({ ...formData, healthInsuranceId: value === "_none" ? "" : value })}
                >
                  <SelectTrigger data-testid="wizard-select-collaborator-insurance">
                    <SelectValue placeholder={t.collaborators.fields.healthInsurance} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">{t.common.noData}</SelectItem>
                    {filteredHealthInsurances.map((hi) => (
                      <SelectItem key={hi.id} value={hi.id}>{hi.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t.collaborators.fields.maritalStatus}</Label>
                <Select
                  value={formData.maritalStatus || "_none"}
                  onValueChange={(value) => setFormData({ ...formData, maritalStatus: value === "_none" ? "" : value })}
                >
                  <SelectTrigger data-testid="wizard-select-collaborator-marital">
                    <SelectValue placeholder={t.collaborators.fields.maritalStatus} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">{t.common.noData}</SelectItem>
                    {MARITAL_STATUSES.map((ms) => (
                      <SelectItem key={ms.value} value={ms.value}>
                        {(t.collaborators.maritalStatuses as Record<string, string>)[ms.labelKey]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {!isHidden("phone") && (
                <div className="space-y-2">
                  <Label>{t.collaborators.fields.phone}</Label>
                  <PhoneNumberField
                    value={formData.phone}
                    onChange={(value) => setFormData({ ...formData, phone: value })}
                    defaultCountryCode={formData.countryCode || "SK"}
                    data-testid="wizard-input-collaborator-phone"
                    disabled={isReadonly("phone")}
                  />
                </div>
              )}
              {!isHidden("mobile") && (
                <div className="space-y-2">
                  <Label>{t.collaborators.fields.mobile}</Label>
                  <PhoneNumberField
                    value={formData.mobile}
                    onChange={(value) => setFormData({ ...formData, mobile: value })}
                    defaultCountryCode={formData.countryCode || "SK"}
                    data-testid="wizard-input-collaborator-mobile"
                    disabled={isReadonly("mobile")}
                  />
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t.collaborators.fields.mobile2}</Label>
                <PhoneNumberField
                  value={formData.mobile2}
                  onChange={(value) => setFormData({ ...formData, mobile2: value })}
                  defaultCountryCode={formData.countryCode || "SK"}
                  data-testid="wizard-input-collaborator-mobile2"
                />
              </div>
              {!isHidden("email") && (
                <div className="space-y-2">
                  <Label>{t.collaborators.fields.email}</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    data-testid="wizard-input-collaborator-email"
                    disabled={isReadonly("email")}
                    className={isReadonly("email") ? "bg-muted" : ""}
                  />
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t.collaborators.fields.representative}</Label>
                <Select
                  value={formData.representativeId || "_none"}
                  onValueChange={(value) => setFormData({ ...formData, representativeId: value === "_none" ? "" : value })}
                >
                  <SelectTrigger data-testid="wizard-select-collaborator-representative">
                    <SelectValue placeholder={t.collaborators.fields.representative} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">{t.common.noData}</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>{user.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t.collaborators.fields.hospital}</Label>
                <Select
                  value={formData.hospitalId || "_none"}
                  onValueChange={(value) => setFormData({ ...formData, hospitalId: value === "_none" ? "" : value })}
                >
                  <SelectTrigger data-testid="wizard-select-collaborator-hospital">
                    <SelectValue placeholder={t.collaborators.fields.hospital} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">{t.common.noData}</SelectItem>
                    {filteredHospitals.map((h) => (
                      <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {!isHidden("bank_account") && (
                <div className="space-y-2">
                  <Label>{t.collaborators.fields.bankAccountIban}</Label>
                  <Input
                    value={formData.bankAccountIban}
                    onChange={(e) => setFormData({ ...formData, bankAccountIban: e.target.value })}
                    placeholder="SK..."
                    data-testid="wizard-input-collaborator-iban"
                    disabled={isReadonly("bank_account")}
                    className={isReadonly("bank_account") ? "bg-muted" : ""}
                  />
                </div>
              )}
              {!isHidden("bank_account") && (
                <div className="space-y-2">
                  <Label>{t.collaborators.fields.swiftCode}</Label>
                  <Input
                    value={formData.swiftCode}
                    onChange={(e) => setFormData({ ...formData, swiftCode: e.target.value })}
                    data-testid="wizard-input-collaborator-swift"
                    disabled={isReadonly("bank_account")}
                    className={isReadonly("bank_account") ? "bg-muted" : ""}
                  />
                </div>
              )}
            </div>

            <Separator className="my-4" />

            <div className="flex flex-wrap items-center gap-6">
              {!isHidden("is_active") && (
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                    data-testid="wizard-switch-collaborator-active"
                    disabled={isReadonly("is_active")}
                  />
                  <Label>{t.collaborators.fields.active}</Label>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.clientContact}
                  onCheckedChange={(checked) => setFormData({ ...formData, clientContact: checked })}
                  data-testid="wizard-switch-collaborator-client-contact"
                />
                <Label>{t.collaborators.fields.clientContact}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.svetZdravia}
                  onCheckedChange={(checked) => setFormData({ ...formData, svetZdravia: checked })}
                  data-testid="wizard-switch-collaborator-svet-zdravia"
                />
                <Label>{t.collaborators.fields.svetZdravia}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.monthRewards}
                  onCheckedChange={(checked) => setFormData({ ...formData, monthRewards: checked })}
                  data-testid="wizard-switch-collaborator-month-rewards"
                />
                <Label>{t.collaborators.fields.monthRewards}</Label>
              </div>
            </div>
          </div>
        );

      case 3: // Company & Address (merged)
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {!isHidden("company_name") && (
                  <div className="space-y-2">
                    <Label>{t.collaborators.fields.companyName}</Label>
                    <Input
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      data-testid="wizard-input-collaborator-company-name"
                      disabled={isReadonly("company_name")}
                      className={isReadonly("company_name") ? "bg-muted" : ""}
                    />
                  </div>
                )}
                {!isHidden("company_ico") && (
                  <div className="space-y-2">
                    <Label>{t.collaborators.fields.ico}</Label>
                    <Input
                      value={formData.ico}
                      onChange={(e) => setFormData({ ...formData, ico: e.target.value })}
                      data-testid="wizard-input-collaborator-ico"
                      disabled={isReadonly("company_ico")}
                      className={isReadonly("company_ico") ? "bg-muted" : ""}
                    />
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {!isHidden("company_dic") && (
                  <div className="space-y-2">
                    <Label>{t.collaborators.fields.dic}</Label>
                    <Input
                      value={formData.dic}
                      onChange={(e) => setFormData({ ...formData, dic: e.target.value })}
                      data-testid="wizard-input-collaborator-dic"
                      disabled={isReadonly("company_dic")}
                      className={isReadonly("company_dic") ? "bg-muted" : ""}
                    />
                  </div>
                )}
                {!isHidden("company_ic_dph") && (
                  <div className="space-y-2">
                    <Label>{t.collaborators.fields.icDph}</Label>
                    <Input
                      value={formData.icDph}
                      onChange={(e) => setFormData({ ...formData, icDph: e.target.value })}
                      data-testid="wizard-input-collaborator-icdph"
                      disabled={isReadonly("company_ic_dph")}
                      className={isReadonly("company_ic_dph") ? "bg-muted" : ""}
                    />
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {!isHidden("bank_account") && (
                  <div className="space-y-2">
                    <Label>{t.collaborators.fields.companyIban}</Label>
                    <Input
                      value={formData.companyIban}
                      onChange={(e) => setFormData({ ...formData, companyIban: e.target.value })}
                      data-testid="wizard-input-collaborator-company-iban"
                      disabled={isReadonly("bank_account")}
                      className={isReadonly("bank_account") ? "bg-muted" : ""}
                    />
                  </div>
                )}
                {!isHidden("bank_account") && (
                  <div className="space-y-2">
                    <Label>{t.collaborators.fields.companySwift}</Label>
                    <Input
                      value={formData.companySwift}
                      onChange={(e) => setFormData({ ...formData, companySwift: e.target.value })}
                      data-testid="wizard-input-collaborator-company-swift"
                      disabled={isReadonly("bank_account")}
                      className={isReadonly("bank_account") ? "bg-muted" : ""}
                    />
                  </div>
                )}
              </div>

              {/* Company Address - inline display */}
              {initialData && (
                <div className="pt-4">
                  <h5 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {t.collaborators.addressTabs.company}
                  </h5>
                  <CompanyAddressForm collaboratorId={initialData.id} t={t} />
                </div>
              )}
            </div>

            <Separator className="my-4" />
            
            <div>
              <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {t.collaborators.tabs.addresses}
              </h4>
              {initialData ? (
                <AddressesTabContent 
                  collaboratorId={initialData.id} 
                  countryCode={initialData.countryCode} 
                  collaboratorName={`${initialData.firstName} ${initialData.lastName}`}
                  t={t} 
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center border rounded-lg bg-muted/30">
                  <MapPin className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">{t.wizard.completePreviousSteps}</p>
                </div>
              )}
            </div>
          </div>
        );

      case 4: // Agreements
        return initialData ? (
          <AgreementsTabContent collaboratorId={initialData.id} collaboratorCountry={initialData.countryCode} t={t} />
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t.wizard.completePreviousSteps}</p>
          </div>
        );
      
      case 5: // History
        return initialData ? (
          <HistoryTabContent collaboratorId={initialData.id} t={t} />
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <History className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t.wizard.completePreviousSteps}</p>
          </div>
        );
      
      case 6: // Mobile (INDEXUS Connect) - last step
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
              <Smartphone className="h-6 w-6 text-muted-foreground" />
              <div>
                <h4 className="font-medium">{t.collaborators.mobileApp.title}</h4>
                <p className="text-sm text-muted-foreground">
                  {t.collaborators.mobileApp.description}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={mobileCredentials.mobileAppEnabled}
                  onCheckedChange={(checked) => setMobileCredentials({ ...mobileCredentials, mobileAppEnabled: checked })}
                  data-testid="wizard-switch-mobile-app-enabled"
                />
                <Label>{t.collaborators.mobileApp.enabled}</Label>
              </div>

              {mobileCredentials.mobileAppEnabled && (
                <div className="space-y-4 pl-8 border-l-2 border-muted">
                  <div className="space-y-2">
                    <Label>{t.collaborators.mobileApp.username}</Label>
                    <Input
                      value={mobileCredentials.mobileUsername}
                      onChange={(e) => setMobileCredentials({ ...mobileCredentials, mobileUsername: e.target.value })}
                      placeholder={t.collaborators.mobileApp.usernamePlaceholder}
                      data-testid="wizard-input-mobile-username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.collaborators.mobileApp.password}</Label>
                    <Input
                      type="password"
                      value={mobileCredentials.mobilePassword}
                      onChange={(e) => setMobileCredentials({ ...mobileCredentials, mobilePassword: e.target.value })}
                      placeholder={initialData?.mobilePasswordHash ? t.collaborators.mobileApp.passwordPlaceholderExisting : t.collaborators.mobileApp.passwordPlaceholder}
                      data-testid="wizard-input-mobile-password"
                    />
                  </div>
                  {mobileCredentials.mobilePassword && (
                    <div className="space-y-2">
                      <Label>{t.collaborators.mobileApp.passwordConfirm}</Label>
                      <Input
                        type="password"
                        value={mobileCredentials.mobilePasswordConfirm}
                        onChange={(e) => setMobileCredentials({ ...mobileCredentials, mobilePasswordConfirm: e.target.value })}
                        placeholder={t.collaborators.mobileApp.passwordConfirmPlaceholder}
                        data-testid="wizard-input-mobile-password-confirm"
                      />
                      {mobileCredentials.mobilePassword !== mobileCredentials.mobilePasswordConfirm && mobileCredentials.mobilePasswordConfirm && (
                        <p className="text-sm text-destructive">{t.collaborators.mobileApp.passwordMismatch}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const currentStepInfo = WIZARD_STEPS[currentStep];
  const StepIcon = currentStepInfo?.icon || User;

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {t.wizard?.stepOf?.replace("{current}", String(currentStep + 1)).replace("{total}", String(WIZARD_STEPS.length)) || `Step ${currentStep + 1} of ${WIZARD_STEPS.length}`}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="flex flex-wrap gap-2 pt-4">
          {WIZARD_STEPS.map((step, index) => {
            const isCompleted = completedSteps.has(index);
            const isCurrent = index === currentStep;
            const isClickable = index < currentStep || isCompleted || completedSteps.has(index - 1);
            const Icon = step.icon;
            
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => handleStepClick(index)}
                disabled={!isClickable}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                  isCurrent && "bg-primary text-primary-foreground",
                  isCompleted && !isCurrent && "bg-primary/10 text-primary",
                  !isCurrent && !isCompleted && "bg-muted text-muted-foreground",
                  isClickable && !isCurrent && "hover-elevate cursor-pointer",
                  !isClickable && "cursor-not-allowed opacity-50"
                )}
                data-testid={`wizard-step-${step.id}`}
              >
                <span className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs",
                  isCurrent && "bg-primary-foreground text-primary",
                  isCompleted && !isCurrent && "bg-primary text-primary-foreground",
                  !isCurrent && !isCompleted && "bg-muted-foreground/20"
                )}>
                  {isCompleted ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                </span>
                <span className="hidden md:inline">{getStepTitle(step.id)}</span>
              </button>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="border-b pb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <StepIcon className="h-5 w-5" />
            {getStepTitle(currentStepInfo.id)}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {getStepDescription(currentStepInfo.id)}
          </p>
        </div>
        
        <div className="min-h-[300px]">
          {renderStepContent()}
        </div>
      </CardContent>

      <CardFooter className="flex justify-between gap-2 border-t pt-4">
        <div>
          {onCancel && (
            <Button variant="ghost" onClick={onCancel} data-testid="wizard-button-cancel">
              {t.common.cancel}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {!isFirstStep && (
            <Button variant="outline" onClick={handlePrevious} data-testid="wizard-button-previous">
              <ChevronLeft className="h-4 w-4 mr-1" />
              {t.wizard.previous}
            </Button>
          )}
          <Button onClick={handleNext} disabled={saveMutation.isPending} data-testid="wizard-button-next">
            {isLastStep ? (
              saveMutation.isPending ? t.common.loading : t.wizard.complete
            ) : (
              <>
                {t.wizard.next}
                <ChevronRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
