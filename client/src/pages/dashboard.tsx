import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Users, UserCheck, Globe, Droplets, TrendingUp, Activity, FileText, Clock, CheckCircle2, AlertCircle, ClipboardList, Eye, UserPlus, UserCog, CheckCircle, XCircle, ChevronRight, ArrowLeft, Loader2, User, Mail, Phone, MapPin, Calendar, CreditCard, Baby, Heart, Hospital, Stethoscope, Shield, Megaphone, Newspaper, Hash, Building, Search, ExternalLink, MessageSquare, PhoneCall, Save, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsCard } from "@/components/stats-card";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { useCountryFilter } from "@/contexts/country-filter-context";
import { useI18n } from "@/i18n";
import { getCountryFlag, getCountryName } from "@/lib/countries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import type { Customer, User as UserType, Invoice } from "@shared/schema";
import { useModuleFieldPermissions } from "@/components/ui/permission-field";
import { CallCustomerButton } from "@/components/sip-phone";

interface WebForm {
  id: string;
  name: string;
  slug: string;
  countryCode: string;
  isActive: boolean;
}

interface WebFormSubmission {
  id: string;
  formId: string;
  data: string;
  status: string;
  customerId: string | null;
  isNewCustomer: boolean;
  isOtpVerified: boolean;
  createdAt: string;
  processedAt: string | null;
  ipAddress?: string;
}

export default function Dashboard() {
  const { selectedCountries } = useCountryFilter();
  const { t } = useI18n();
  const { toast } = useToast();
  const { isHidden } = useModuleFieldPermissions("dashboard");

  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<WebFormSubmission | null>(null);
  const [submissionTab, setSubmissionTab] = useState("pending");
  const [fieldsToUpdate, setFieldsToUpdate] = useState<Set<string>>(new Set());
  const [socialCheckResult, setSocialCheckResult] = useState<any>(null);
  const [socialCheckLoading, setSocialCheckLoading] = useState(false);
  const [callNote, setCallNote] = useState("");

  const { data: customers = [], isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: webForms = [] } = useQuery<WebForm[]>({
    queryKey: ["/api/web-forms"],
  });

  const { data: allSubmissions = [] } = useQuery<any[]>({
    queryKey: ["/api/web-forms/stats"],
  });

  const { data: hospitals = [] } = useQuery<any[]>({
    queryKey: ["/api/hospitals"],
  });

  const { data: clinics = [] } = useQuery<any[]>({
    queryKey: ["/api/clinics"],
  });

  const { data: healthInsuranceCompanies = [] } = useQuery<any[]>({
    queryKey: ["/api/config/health-insurance"],
  });

  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["/api/products"],
  });

  const { data: productSets = [] } = useQuery<any[]>({
    queryKey: ["/api/product-sets"],
  });

  const { data: formSubmissions = [], isLoading: submissionsLoading } = useQuery<WebFormSubmission[]>({
    queryKey: ["/api/web-forms", selectedFormId, "submissions"],
    enabled: !!selectedFormId,
    queryFn: async () => {
      if (!selectedFormId) return [];
      const res = await fetch(`/api/web-forms/${selectedFormId}/submissions`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ submissionId, status }: { submissionId: string; status: string }) => {
      await apiRequest("PATCH", `/api/web-forms/submissions/${submissionId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/web-forms", selectedFormId, "submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/web-forms/stats"] });
      toast({ title: "Status aktualizovaný" });
    },
  });

  const runSocialCheck = async (submissionId: string) => {
    setSocialCheckLoading(true);
    setSocialCheckResult(null);
    try {
      const res = await apiRequest("POST", `/api/web-forms/submissions/${submissionId}/social-check`);
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("Server returned non-JSON response");
      }
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setSocialCheckResult(data);
    } catch (err: any) {
      console.error("[SocialCheck] Frontend error:", err);
      toast({ title: t.dashboard.webFormsSocialCheckError || "Chyba pri AI analýze", description: err?.message || "", variant: "destructive" });
    } finally {
      setSocialCheckLoading(false);
    }
  };

  const saveNoteMutation = useMutation({
    mutationFn: async ({ customerId, content }: { customerId: string; content: string }) => {
      await apiRequest("POST", `/api/customers/${customerId}/notes`, { content });
    },
    onSuccess: () => {
      toast({ title: t.dashboard.webFormsCallNoteSaved });
      setCallNote("");
    },
    onError: () => {
      toast({ title: "Chyba pri ukladaní poznámky", variant: "destructive" });
    },
  });

  const filteredCustomers = customers.filter(c =>
    selectedCountries.includes(c.country as any)
  );

  const filteredCustomerIds = new Set(filteredCustomers.map(c => c.id));
  const filteredInvoices = invoices.filter(inv => filteredCustomerIds.has(inv.customerId));

  const activeCustomers = filteredCustomers.filter(c => c.status === "active").length;
  const pendingCustomers = filteredCustomers.filter(c => c.status === "pending").length;
  const activeUsers = users.filter(u => u.isActive).length;

  const totalInvoices = filteredInvoices.length;
  const paidInvoices = filteredInvoices.filter(inv => inv.status === "paid");
  const unpaidInvoices = filteredInvoices.filter(inv => inv.status !== "paid");
  const overdueInvoices = filteredInvoices.filter(inv => {
    if (inv.status === "paid") return false;
    if (!inv.dueDate) return false;
    return new Date(inv.dueDate) < new Date();
  });

  const totalInvoiceAmount = filteredInvoices.reduce((sum, inv) => sum + parseFloat(inv.totalAmount || "0"), 0);
  const paidAmount = paidInvoices.reduce((sum, inv) => sum + parseFloat(inv.totalAmount || "0"), 0);
  const unpaidAmount = unpaidInvoices.reduce((sum, inv) => sum + parseFloat(inv.totalAmount || "0"), 0);

  const recentCustomers = [...filteredCustomers]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const formStats = useMemo(() => {
    const statsMap = new Map<string, { formName: string; countryCode: string; pending: number; approved: number; total: number }>();
    webForms.forEach(f => {
      statsMap.set(f.id, { formName: f.name, countryCode: f.countryCode, pending: 0, approved: 0, total: 0 });
    });
    allSubmissions.forEach(sub => {
      const existing = statsMap.get(sub.formId);
      if (existing) {
        existing.total++;
        if (sub.status === "pending") existing.pending++;
        else if (sub.status === "approved" || sub.status === "processed") existing.approved++;
      }
    });
    return Array.from(statsMap.entries())
      .map(([formId, data]) => ({ formId, ...data }))
      .filter(s => s.total > 0 || webForms.find(f => f.id === s.formId)?.isActive);
  }, [webForms, allSubmissions]);

  const customerMap = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);

  const lookupMaps = useMemo(() => {
    const hospitalMap = new Map(hospitals.map((h: any) => [h.id, h.name]));
    const clinicMap = new Map(clinics.map((c: any) => [c.id, c.doctorName || c.name || [c.doctorTitle, c.doctorFirstName, c.doctorLastName].filter(Boolean).join(" ")]));
    const insuranceMap = new Map(healthInsuranceCompanies.map((h: any) => [h.id, h.name || h.code]));
    const productMap = new Map(products.map((p: any) => [p.id, p.name]));
    const productSetMap = new Map(productSets.map((ps: any) => [ps.id, ps.name]));
    return { hospitalMap, clinicMap, insuranceMap, productMap, productSetMap };
  }, [hospitals, clinics, healthInsuranceCompanies, products, productSets]);

  const filteredFormSubmissions = useMemo(() => {
    return formSubmissions
      .filter(s => {
        if (submissionTab === "all") return true;
        if (submissionTab === "approved") return s.status === "approved" || s.status === "processed";
        return s.status === submissionTab;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [formSubmissions, submissionTab]);

  const selectedForm = webForms.find(f => f.id === selectedFormId);

  const customerColumns = [
    {
      key: "name",
      header: t.customers.title,
      cell: (customer: Customer) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
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
      header: t.common.country,
      cell: (customer: Customer) => (
        <span className="flex items-center gap-2">
          <span>{getCountryFlag(customer.country)}</span>
          <span>{getCountryName(customer.country)}</span>
        </span>
      ),
    },
    {
      key: "service",
      header: t.customers.serviceType,
      cell: (customer: Customer) => (
        <span className="text-sm capitalize">
          {customer.serviceType?.replace("_", " ") || "-"}
        </span>
      ),
    },
    {
      key: "status",
      header: t.common.status,
      cell: (customer: Customer) => (
        <StatusBadge status={customer.status as any} />
      ),
    },
  ];

  const parseSubmissionData = (dataStr: string) => {
    try { return JSON.parse(dataStr); } catch { return {}; }
  };

  const selectedFormDetail = useQuery<any>({
    queryKey: ["/api/web-forms", selectedFormId, "detail"],
    enabled: !!selectedFormId,
    queryFn: async () => {
      if (!selectedFormId) return null;
      const res = await fetch(`/api/web-forms/${selectedFormId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const formFieldLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    const detail = selectedFormDetail.data;
    if (detail?.fields) {
      for (const f of detail.fields) {
        if (f.id) map.set(f.id, f.label || f.customerField || f.id);
        if (f.customerField) map.set(f.customerField, f.label || f.customerField);
      }
    }
    return map;
  }, [selectedFormDetail.data]);

  const formFieldIdToCustomerField = useMemo(() => {
    const map = new Map<string, string>();
    const detail = selectedFormDetail.data;
    if (detail?.fields) {
      for (const f of detail.fields) {
        if (f.id && f.customerField) map.set(f.id, f.customerField);
      }
    }
    return map;
  }, [selectedFormDetail.data]);

  const formOptionValueMap = useMemo(() => {
    const map = new Map<string, string>();
    const detail = selectedFormDetail.data;
    if (detail?.fields) {
      for (const f of detail.fields) {
        if (f.options) {
          try {
            const opts = JSON.parse(f.options);
            if (Array.isArray(opts)) {
              for (const o of opts) {
                if (o.id && o.label) map.set(o.id, o.label);
                if (o.value && o.label) map.set(o.value, o.label);
              }
            }
          } catch {}
        }
      }
    }
    return map;
  }, [selectedFormDetail.data]);

  const resolveKey = (key: string): string => {
    const cf = formFieldIdToCustomerField.get(key);
    if (cf) return cf;
    const strVal = key;
    if (fieldLabels[strVal]) return strVal;
    return key;
  };

  const inferFieldType = (key: string, value: any): string => {
    const resolved = resolveKey(key);
    if (resolved !== key) return resolved;
    if (value && typeof value === "string") {
      if (lookupMaps.clinicMap.has(value)) return "gynecologistClinicId";
      if (lookupMaps.hospitalMap.has(value)) return "hospitalId";
      if (lookupMaps.insuranceMap.has(value)) return "healthInsuranceId";
      if (lookupMaps.productSetMap.has(value)) return "productSetId";
      if (lookupMaps.productMap.has(value)) return "productSetId";
    }
    return resolved;
  };

  const renderFieldValue = (key: string, value: any): string => {
    if (value === null || value === undefined || value === "") return "-";
    if (typeof value === "boolean") return value ? "Áno" : "Nie";
    if (typeof value === "object") return JSON.stringify(value);
    const strVal = String(value);
    const inferredType = inferFieldType(key, value);
    if (inferredType === "hospitalId") return lookupMaps.hospitalMap.get(strVal) || strVal;
    if (inferredType === "gynecologistClinicId") return lookupMaps.clinicMap.get(strVal) || strVal;
    if (inferredType === "healthInsuranceId") return lookupMaps.insuranceMap.get(strVal) || strVal;
    if (inferredType === "productSetId") return lookupMaps.productSetMap.get(strVal) || lookupMaps.productMap.get(strVal) || strVal;
    if (/^\d{4}-\d{2}-\d{2}(T|$)/.test(strVal)) {
      try {
        const d = new Date(strVal.length === 10 ? strVal + "T00:00:00" : strVal);
        return format(d, "dd.MM.yyyy");
      } catch { return strVal; }
    }
    if (formOptionValueMap.has(strVal)) return formOptionValueMap.get(strVal)!;
    if (lookupMaps.clinicMap.has(strVal)) return lookupMaps.clinicMap.get(strVal)!;
    if (lookupMaps.hospitalMap.has(strVal)) return lookupMaps.hospitalMap.get(strVal)!;
    if (lookupMaps.insuranceMap.has(strVal)) return lookupMaps.insuranceMap.get(strVal)!;
    if (lookupMaps.productSetMap.has(strVal)) return lookupMaps.productSetMap.get(strVal)!;
    const valueTranslations: Record<string, string> = {
      invoice: "Faktúra", cash: "Hotovosť", card: "Kartou",
      bank_transfer: "Bankový prevod", "credit_card": "Kreditná karta",
    };
    if (valueTranslations[strVal]) return valueTranslations[strVal];
    return strVal;
  };

  const fieldIcons: Record<string, any> = {
    firstName: User, lastName: User, maidenName: User, titleBefore: User, titleAfter: User,
    email: Mail, phone: Phone, mobile: Phone,
    street: MapPin, city: MapPin, postalCode: MapPin, country: Globe,
    corrStreet: MapPin, corrCity: MapPin, corrPostalCode: MapPin,
    dateOfBirth: Calendar, personalId: Hash,
    healthInsuranceId: Shield, productSetId: Heart,
    hospitalId: Hospital, gynecologistClinicId: Stethoscope,
    expectedDeliveryDate: Baby,
    paymentMethod: CreditCard,
    gdprConsent: Shield, newsletter: Newspaper,
    howDidYouHear: Megaphone,
  };

  const getFieldIcon = (key: string, value?: any) => {
    const resolvedKey = resolveKey(key);
    if (fieldIcons[resolvedKey]) return fieldIcons[resolvedKey];
    if (value !== undefined) {
      const inferred = inferFieldType(key, value);
      if (fieldIcons[inferred]) return fieldIcons[inferred];
    }
    return FileText;
  };

  const fieldSections: [string, string[]][] = [
    [t.dashboard.webFormsSectionPersonal, ["firstName", "lastName", "maidenName", "titleBefore", "titleAfter", "dateOfBirth", "personalId", "nationalId"]],
    [t.dashboard.webFormsSectionContact, ["email", "phone", "mobile"]],
    [t.dashboard.webFormsSectionAddress, ["street", "address", "city", "postalCode", "country", "region"]],
    [t.dashboard.webFormsSectionCorrAddress, ["useCorrespondenceAddress", "corrName", "corrAddress", "corrStreet", "corrCity", "corrPostalCode"]],
    [t.dashboard.webFormsSectionHealth, ["healthInsuranceId", "productSetId", "hospitalId", "hospitalName", "gynecologistClinicId", "gynecologistName", "gynecologistPhone", "gynecologistEmail", "expectedDeliveryDate", "serviceType"]],
    [t.dashboard.webFormsSectionPayment, ["paymentMethod", "bankAccount", "bankName", "bankSwift", "gdprConsent", "gdprMarketing", "gdprPregnancy", "newsletter", "howDidYouHear"]],
  ];

  const categorizeFields = (data: Record<string, any>) => {
    const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== "");
    const usedKeys = new Set<string>();
    const sections: { title: string; items: [string, any][] }[] = [];

    for (const [sectionTitle, sectionKeys] of fieldSections) {
      const items: [string, any][] = [];
      for (const [key, value] of entries) {
        const inferred = inferFieldType(key, value);
        if (sectionKeys.includes(inferred)) {
          items.push([key, value]);
          usedKeys.add(key);
        }
      }
      if (items.length > 0) sections.push({ title: sectionTitle, items });
    }

    const remaining = entries.filter(([k]) => !usedKeys.has(k));
    if (remaining.length > 0) sections.push({ title: t.dashboard.webFormsSectionOther, items: remaining });

    return sections;
  };

  const fieldLabels: Record<string, string> = {
    firstName: "Meno",
    lastName: "Priezvisko",
    maidenName: "Rodné priezvisko",
    titleBefore: "Titul pred",
    titleAfter: "Titul za",
    email: "Email",
    phone: "Telefón",
    mobile: "Mobil",
    dateOfBirth: "Dátum narodenia",
    nationalId: "Rodné číslo",
    address: "Adresa",
    city: "Mesto",
    postalCode: "PSČ",
    region: "Región",
    country: "Krajina",
    healthInsuranceId: "Zdravotná poisťovňa",
    bankAccount: "Bankový účet",
    bankName: "Banka",
    bankSwift: "SWIFT",
    expectedDeliveryDate: "Očakávaný termín pôrodu",
    hospitalName: "Nemocnica",
    gynecologistName: "Gynekológ",
    gynecologistPhone: "Tel. gynekológa",
    gynecologistEmail: "Email gynekológa",
    serviceType: "Typ služby",
    paymentMethod: "Spôsob platby",
    newsletter: "Newsletter",
    gdprConsent: "GDPR súhlas",
    gdprMarketing: "Marketing súhlas",
    gdprPregnancy: "Tehotenský súhlas",
    useCorrespondenceAddress: "Korešpondenčná adresa",
    corrName: "Korešp. meno",
    corrAddress: "Korešp. adresa",
    corrCity: "Korešp. mesto",
    corrPostalCode: "Korešp. PSČ",
    howDidYouHear: "Ako ste sa o nás dozvedeli",
    productSetId: "Produkt",
    hospitalId: "Nemocnica",
    gynecologistClinicId: "Gynekológ / Klinika",
  };

  const getFieldLabel = (key: string, value?: any): string => {
    if (fieldLabels[key]) return fieldLabels[key];
    const resolvedKey = resolveKey(key);
    if (resolvedKey !== key && fieldLabels[resolvedKey]) return fieldLabels[resolvedKey];
    if (formFieldLabelMap.has(key)) return formFieldLabelMap.get(key)!;
    if (value !== undefined) {
      const inferred = inferFieldType(key, value);
      if (inferred !== key && fieldLabels[inferred]) return fieldLabels[inferred];
    }
    return key;
  };

  const customerFieldMapping: Record<string, keyof Customer> = {
    firstName: "firstName",
    lastName: "lastName",
    maidenName: "maidenName",
    titleBefore: "titleBefore",
    titleAfter: "titleAfter",
    email: "email",
    phone: "phone",
    mobile: "mobile",
    dateOfBirth: "dateOfBirth",
    nationalId: "nationalId",
    address: "address",
    city: "city",
    postalCode: "postalCode",
    region: "region",
    country: "country",
    corrName: "corrName",
    corrAddress: "corrAddress",
    corrCity: "corrCity",
    corrPostalCode: "corrPostalCode",
    healthInsuranceId: "healthInsuranceId",
    hospitalName: "hospitalName",
    gynecologistName: "gynecologistName",
    gynecologistPhone: "gynecologistPhone",
    gynecologistEmail: "gynecologistEmail",
    expectedDeliveryDate: "expectedDeliveryDate",
    serviceType: "serviceType",
    bankAccount: "bankAccount",
    bankName: "bankName",
    bankSwift: "bankSwift",
    newsletter: "newsletter",
    personalId: "nationalId",
  };

  const buildComparison = (submission: WebFormSubmission) => {
    if (submission.isNewCustomer || !submission.customerId) return null;
    const customer = customerMap.get(submission.customerId);
    if (!customer) return null;

    const data = parseSubmissionData(submission.data);
    const rows: {
      fieldKey: string;
      label: string;
      existingValue: string;
      submittedValue: string;
      status: "match" | "differs" | "new" | "empty";
    }[] = [];

    const processedCustomerFields = new Set<string>();

    for (const [rawKey, rawValue] of Object.entries(data)) {
      if (rawValue === null || rawValue === undefined || rawValue === "") continue;
      const inferred = inferFieldType(rawKey, rawValue);
      const custField = customerFieldMapping[inferred];
      if (!custField) continue;
      processedCustomerFields.add(inferred);

      const existingRaw = customer[custField];
      let existingStr = "";
      if (existingRaw instanceof Date) {
        existingStr = format(existingRaw, "dd.MM.yyyy");
      } else if (typeof existingRaw === "boolean") {
        existingStr = existingRaw ? "true" : "false";
      } else {
        existingStr = existingRaw ? String(existingRaw) : "";
      }

      const submittedStr = renderFieldValue(rawKey, rawValue);
      const existingDisplay = existingRaw ? renderFieldValue(inferred, String(existingRaw)) : "";

      let normalizedExisting = existingStr.toLowerCase().trim();
      let normalizedSubmitted = String(rawValue).toLowerCase().trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(normalizedSubmitted) && existingRaw instanceof Date) {
        normalizedExisting = format(existingRaw, "yyyy-MM-dd");
        normalizedSubmitted = normalizedSubmitted.substring(0, 10);
      }

      let status: "match" | "differs" | "new" | "empty";
      if (!existingStr) {
        status = "new";
      } else if (normalizedExisting === normalizedSubmitted) {
        status = "match";
      } else {
        status = "differs";
      }

      rows.push({
        fieldKey: inferred,
        label: getFieldLabel(rawKey, rawValue),
        existingValue: existingDisplay,
        submittedValue: submittedStr,
        status,
      });
    }

    const nameMatch =
      data.firstName?.toString().toLowerCase().trim() === customer.firstName?.toLowerCase().trim() &&
      data.lastName?.toString().toLowerCase().trim() === customer.lastName?.toLowerCase().trim();

    const matching = rows.filter(r => r.status === "match").length;
    const differing = rows.filter(r => r.status === "differs" || r.status === "new").length;

    let isNewChild = false;
    if (customer.expectedDeliveryDate) {
      const existingDueDate = new Date(customer.expectedDeliveryDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const existingIsPast = existingDueDate < today;
      const deliveryRow = rows.find(r => r.fieldKey === "expectedDeliveryDate");
      if (existingIsPast && deliveryRow && deliveryRow.status === "differs") {
        isNewChild = true;
      }
    }

    return { rows, customer, nameMatch, matching, differing, isNewChild };
  };

  const toggleFieldUpdate = (fieldKey: string) => {
    setFieldsToUpdate(prev => {
      const next = new Set(prev);
      if (next.has(fieldKey)) next.delete(fieldKey);
      else next.add(fieldKey);
      return next;
    });
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={t.dashboard.title}
        description=""
      />

      {!isHidden("stats_overview") && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" data-tour="stats-cards">
            <StatsCard
              title={t.dashboard.totalCustomers}
              value={filteredCustomers.length}
              trend={12}
              description=""
              icon={<Users className="h-6 w-6" />}
            />
            <StatsCard
              title={t.dashboard.activeCustomers}
              value={activeCustomers}
              trend={8}
              description=""
              icon={<UserCheck className="h-6 w-6" />}
            />
            <StatsCard
              title={t.dashboard.pendingCustomers}
              value={pendingCustomers}
              trend={-5}
              description=""
              icon={<Activity className="h-6 w-6" />}
            />
            <StatsCard
              title={t.dashboard.activeCountries}
              value={selectedCountries.length}
              icon={<Globe className="h-6 w-6" />}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title={t.dashboard.totalInvoices}
              value={totalInvoices}
              description={`${totalInvoiceAmount.toFixed(0)} EUR ${t.dashboard.totalAmount}`}
              icon={<FileText className="h-6 w-6" />}
            />
            <StatsCard
              title={t.dashboard.paidInvoices}
              value={paidInvoices.length}
              description={`${paidAmount.toFixed(0)} EUR ${t.dashboard.received}`}
              icon={<CheckCircle2 className="h-6 w-6" />}
            />
            <StatsCard
              title={t.dashboard.unpaidInvoices}
              value={unpaidInvoices.length}
              description={`${unpaidAmount.toFixed(0)} EUR ${t.dashboard.pendingAmount}`}
              icon={<Clock className="h-6 w-6" />}
            />
            <StatsCard
              title={t.dashboard.overdueInvoices}
              value={overdueInvoices.length}
              description={t.dashboard.pastDueDate}
              icon={<AlertCircle className="h-6 w-6" />}
            />
          </div>
        </>
      )}

      <Card data-testid="card-web-forms-section">
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
          <CardTitle className="text-lg font-medium">{t.dashboard.webForms}</CardTitle>
          <ClipboardList className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {formStats.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t.dashboard.webFormsNoForms}</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {formStats.map(stat => (
                <div
                  key={stat.formId}
                  className="relative p-4 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors group"
                  onClick={() => { setSelectedFormId(stat.formId); setSelectedSubmission(null); setSubmissionTab("pending"); }}
                  data-testid={`tile-webform-${stat.formId}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getCountryFlag(stat.countryCode)}</span>
                      <h3 className="font-medium text-sm truncate max-w-[160px]">{stat.formName}</h3>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="flex items-center gap-3 mt-3">
                    {stat.pending > 0 && (
                      <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800" data-testid={`badge-pending-${stat.formId}`}>
                        <Clock className="h-3 w-3 mr-1" />
                        {stat.pending} {t.dashboard.webFormsNew}
                      </Badge>
                    )}
                    {stat.approved > 0 && (
                      <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {stat.approved}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">{stat.total} {t.dashboard.webFormsTotal}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {!isHidden("recent_customers") && (
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <CardTitle className="text-lg font-medium">{t.dashboard.recentCustomers}</CardTitle>
              <Droplets className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <DataTable
                columns={customerColumns}
                data={recentCustomers}
                isLoading={customersLoading}
                emptyMessage={t.dashboard.noCustomersFound}
                getRowKey={(c) => c.id}
              />
            </CardContent>
          </Card>
        )}

        {!isHidden("activity_feed") && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
              <CardTitle className="text-lg font-medium">{t.dashboard.teamOverview}</CardTitle>
              <Users className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between border-b pb-4">
                <span className="text-sm text-muted-foreground">{t.dashboard.totalUsers}</span>
                <span className="text-2xl font-bold">{users.length}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-4">
                <span className="text-sm text-muted-foreground">{t.dashboard.activeUsers}</span>
                <span className="text-2xl font-bold text-green-600 dark:text-green-400">{activeUsers}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t.dashboard.inactiveUsers}</span>
                <span className="text-2xl font-bold text-gray-400">{users.length - activeUsers}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
          <CardTitle className="text-lg font-medium">{t.dashboard.customersByCountry}</CardTitle>
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {selectedCountries.map(code => {
              const count = filteredCustomers.filter(c => c.country === code).length;
              return (
                <div
                  key={code}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getCountryFlag(code)}</span>
                    <span className="font-medium">{getCountryName(code)}</span>
                  </div>
                  <span className="text-2xl font-bold">{count}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedFormId} onOpenChange={(open) => { if (!open) { setSelectedFormId(null); setSelectedSubmission(null); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selectedSubmission ? (
            <>
              <DialogHeader className="pb-0">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedSubmission(null)} data-testid="btn-back-to-list">
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    {t.dashboard.webFormsBack}
                  </Button>
                  <DialogTitle className="text-lg">{t.dashboard.webFormsDetailTitle}</DialogTitle>
                </div>
                <DialogDescription className="sr-only">
                  {selectedForm?.name}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 mt-2">
                <div className="flex flex-wrap items-center gap-2 p-4 rounded-xl border bg-gradient-to-r from-muted/30 to-muted/60">
                  <div className="flex items-center gap-2 mr-auto">
                    <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10">
                      <ClipboardList className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{selectedForm?.name}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(selectedSubmission.createdAt), "dd.MM.yyyy 'o' HH:mm")}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedSubmission.isNewCustomer ? (
                      <Badge className="bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                        <UserPlus className="h-3 w-3 mr-1" />
                        {t.dashboard.webFormsNewCustomer}
                      </Badge>
                    ) : (
                      <Badge className="bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800">
                        <UserCog className="h-3 w-3 mr-1" />
                        {t.dashboard.webFormsExistingCustomer}
                      </Badge>
                    )}
                    {selectedSubmission.isOtpVerified && (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {t.dashboard.webFormsOtpVerified}
                      </Badge>
                    )}
                    {selectedSubmission.status === "pending" && (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
                        <Clock className="h-3 w-3 mr-1" />
                        {t.dashboard.webFormsWaitingApproval}
                      </Badge>
                    )}
                    {(selectedSubmission.status === "approved" || selectedSubmission.status === "processed") && (
                      <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {selectedSubmission.status === "processed" ? t.dashboard.webFormsProcessed : t.dashboard.webFormsApproved}
                      </Badge>
                    )}
                    {selectedSubmission.status === "rejected" && (
                      <Badge className="bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800">
                        <XCircle className="h-3 w-3 mr-1" />
                        {t.dashboard.webFormsRejected}
                      </Badge>
                    )}
                  </div>
                  {selectedSubmission.customerId && (() => {
                    const cust = customerMap.get(selectedSubmission.customerId);
                    return cust ? (
                      <div className="w-full pt-2 mt-2 border-t border-border/50 flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {t.dashboard.webFormsLinkedCustomer}: <strong className="text-foreground">{cust.firstName} {cust.lastName}</strong>
                        </span>
                      </div>
                    ) : null;
                  })()}
                </div>

                {!selectedSubmission.isNewCustomer && selectedSubmission.customerId && (() => {
                  const comparison = buildComparison(selectedSubmission);
                  if (!comparison) return null;
                  const { rows, customer, nameMatch, matching, differing, isNewChild } = comparison;
                  const differingRows = rows.filter(r => r.status === "differs" || r.status === "new");
                  const matchingRows = rows.filter(r => r.status === "match");

                  return (
                    <div className="space-y-3" data-testid="data-precheck-section">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-950">
                          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold">{t.dashboard.webFormsDataPrecheck}</h4>
                          <p className="text-xs text-muted-foreground">{t.dashboard.webFormsPrecheckDescription}</p>
                        </div>
                      </div>

                      <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30 p-3 text-xs">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs bg-white dark:bg-background border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300">
                            {t.dashboard.webFormsPrecheckTestMode}
                          </Badge>
                        </div>
                        <div className="flex gap-4 flex-wrap">
                          <span className="flex items-center gap-1.5">
                            <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />
                            <strong>{matching}</strong> {t.dashboard.webFormsPrecheckMatchingFields}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500" />
                            <strong>{differing}</strong> {t.dashboard.webFormsPrecheckDifferingFields}
                          </span>
                          {fieldsToUpdate.size > 0 && (
                            <span className="flex items-center gap-1.5">
                              <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
                              <strong>{fieldsToUpdate.size}</strong> {t.dashboard.webFormsPrecheckSelectedUpdates}
                            </span>
                          )}
                        </div>
                      </div>

                      {!nameMatch && (
                        <div className="rounded-lg border border-rose-200 bg-rose-50/50 dark:border-rose-800 dark:bg-rose-950/30 p-3" data-testid="name-mismatch-warning">
                          <div className="flex gap-2 items-start">
                            <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-rose-800 dark:text-rose-200">{t.dashboard.webFormsPrecheckWarning}</p>
                              <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{t.dashboard.webFormsPrecheckNameMismatch}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {isNewChild && (
                        <div className="rounded-lg border border-violet-200 bg-violet-50/50 dark:border-violet-800 dark:bg-violet-950/30 p-3" data-testid="new-child-warning">
                          <div className="flex gap-2 items-start">
                            <Baby className="h-4 w-4 text-violet-600 dark:text-violet-400 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-violet-800 dark:text-violet-200">{t.dashboard.webFormsPrecheckNewChild}</p>
                              <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">{t.dashboard.webFormsPrecheckNewChildDesc}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className="text-xs bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-900 dark:text-violet-300 dark:border-violet-700">
                                  {t.dashboard.webFormsPrecheckExistingDob}: {customer.expectedDeliveryDate ? format(new Date(customer.expectedDeliveryDate), "dd.MM.yyyy") : "-"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {differing === 0 ? (
                        <div className="rounded-lg border border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/30 p-4 text-center">
                          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto mb-1" />
                          <p className="text-sm text-green-700 dark:text-green-300">{t.dashboard.webFormsPrecheckNoChanges}</p>
                        </div>
                      ) : (
                        <div className="rounded-xl border overflow-hidden">
                          <Table data-testid="table-data-comparison">
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead className="text-xs w-[180px]">{t.dashboard.webFormsPrecheckField}</TableHead>
                                <TableHead className="text-xs">{t.dashboard.webFormsPrecheckExistingValue}</TableHead>
                                <TableHead className="text-xs">{t.dashboard.webFormsPrecheckNewValue}</TableHead>
                                <TableHead className="text-xs w-[90px] text-center">{t.dashboard.webFormsPrecheckResult}</TableHead>
                                <TableHead className="text-xs w-[80px] text-center">{t.dashboard.webFormsPrecheckUpdate}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {differingRows.map(row => (
                                <TableRow
                                  key={row.fieldKey}
                                  className={`${fieldsToUpdate.has(row.fieldKey) ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}`}
                                  data-testid={`row-comparison-${row.fieldKey}`}
                                >
                                  <TableCell className="text-xs font-medium py-2">{row.label}</TableCell>
                                  <TableCell className="text-xs py-2">
                                    {row.existingValue ? (
                                      <span className="text-muted-foreground">{row.existingValue}</span>
                                    ) : (
                                      <span className="text-muted-foreground/50 italic">{t.dashboard.webFormsPrecheckEmpty}</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-xs py-2">
                                    <span className="font-medium text-rose-700 dark:text-rose-300">{row.submittedValue}</span>
                                  </TableCell>
                                  <TableCell className="text-center py-2">
                                    {row.status === "differs" ? (
                                      <Badge variant="outline" className="text-xs bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800">
                                        {t.dashboard.webFormsPrecheckDiffers}
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                                        {t.dashboard.webFormsPrecheckNewField}
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-center py-2">
                                    <Checkbox
                                      checked={fieldsToUpdate.has(row.fieldKey)}
                                      onCheckedChange={() => toggleFieldUpdate(row.fieldKey)}
                                      data-testid={`checkbox-update-${row.fieldKey}`}
                                    />
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}

                      {matchingRows.length > 0 && (
                        <details className="group">
                          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors flex items-center gap-1.5 py-1">
                            <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                            {matching} {t.dashboard.webFormsPrecheckMatchingFields}
                          </summary>
                          <div className="rounded-xl border overflow-hidden mt-2">
                            <Table>
                              <TableBody>
                                {matchingRows.map(row => (
                                  <TableRow key={row.fieldKey} className="bg-green-50/30 dark:bg-green-950/10">
                                    <TableCell className="text-xs font-medium py-1.5 w-[180px]">{row.label}</TableCell>
                                    <TableCell className="text-xs py-1.5 text-muted-foreground">{row.submittedValue}</TableCell>
                                    <TableCell className="text-xs py-1.5 w-[90px] text-center">
                                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
                                        <CheckCircle className="h-2.5 w-2.5 mr-1" />
                                        {t.dashboard.webFormsPrecheckMatch}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </details>
                      )}
                    </div>
                  );
                })()}

                {(() => {
                  const comparison = !selectedSubmission.isNewCustomer && selectedSubmission.customerId
                    ? buildComparison(selectedSubmission)
                    : null;
                  const comparisonMap = new Map<string, "match" | "differs" | "new" | "empty">();
                  if (comparison) {
                    for (const row of comparison.rows) {
                      comparisonMap.set(row.fieldKey, row.status);
                    }
                  }

                  return categorizeFields(parseSubmissionData(selectedSubmission.data)).map((section) => (
                    <div key={section.title} className="space-y-1" data-testid={`section-${section.title}`}>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 pb-1">
                        {section.title}
                      </h4>
                      <div className="rounded-xl border overflow-hidden">
                        {section.items.map(([key, value], idx) => {
                          const IconComp = getFieldIcon(key, value);
                          const inferredKey = inferFieldType(key, value);
                          const fieldStatus = comparisonMap.get(inferredKey);
                          const isDeliveryDate = inferredKey === "expectedDeliveryDate" && value;
                          let trimesterInfo: { trimester: number; daysLeft: number; weeksPregnant: number; color: string; bgColor: string } | null = null;
                          if (isDeliveryDate) {
                            const strVal = String(value);
                            const dueDate = new Date(strVal.length === 10 ? strVal + "T00:00:00" : strVal);
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const daysLeft = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                            const totalPregnancyDays = 280;
                            const daysPregnant = totalPregnancyDays - daysLeft;
                            const weeksPregnant = Math.max(0, Math.floor(daysPregnant / 7));
                            let trimester = 1;
                            if (weeksPregnant >= 28) trimester = 3;
                            else if (weeksPregnant >= 13) trimester = 2;
                            const color = trimester === 1 ? "text-emerald-700 dark:text-emerald-400" : trimester === 2 ? "text-blue-700 dark:text-blue-400" : "text-violet-700 dark:text-violet-400";
                            const bgColor = trimester === 1 ? "bg-emerald-50 dark:bg-emerald-950" : trimester === 2 ? "bg-blue-50 dark:bg-blue-950" : "bg-violet-50 dark:bg-violet-950";
                            trimesterInfo = { trimester, daysLeft, weeksPregnant, color, bgColor };
                          }

                          const rowBgClass = fieldStatus === "match"
                            ? "bg-green-50/40 dark:bg-green-950/10"
                            : fieldStatus === "differs"
                              ? "bg-rose-50/40 dark:bg-rose-950/10"
                              : fieldStatus === "new"
                                ? "bg-blue-50/40 dark:bg-blue-950/10"
                                : "";
                          const borderLeftClass = fieldStatus === "match"
                            ? "border-l-2 border-l-green-400 dark:border-l-green-600"
                            : fieldStatus === "differs"
                              ? "border-l-2 border-l-rose-400 dark:border-l-rose-600"
                              : fieldStatus === "new"
                                ? "border-l-2 border-l-blue-400 dark:border-l-blue-600"
                                : "";

                          return (
                            <div
                              key={key}
                              className={`flex items-center gap-3 px-4 py-3 ${idx < section.items.length - 1 ? "border-b" : ""} hover:bg-muted/30 transition-colors ${rowBgClass} ${borderLeftClass}`}
                            >
                              <div className={`flex items-center justify-center h-8 w-8 rounded-lg shrink-0 ${trimesterInfo ? trimesterInfo.bgColor : "bg-muted/60"}`}>
                                <IconComp className={`h-4 w-4 ${trimesterInfo ? trimesterInfo.color : "text-muted-foreground"}`} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs text-muted-foreground leading-tight">{getFieldLabel(key, value)}</p>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-medium">{renderFieldValue(key, value)}</p>
                                  {trimesterInfo && (
                                    <>
                                      <Badge variant="outline" className={`text-xs ${trimesterInfo.color} border-current/20 ${trimesterInfo.bgColor}`}>
                                        {trimesterInfo.trimester}. {t.dashboard.webFormsTrimester} ({trimesterInfo.weeksPregnant}. {t.dashboard.webFormsWeek})
                                      </Badge>
                                      <Badge variant="outline" className={`text-xs ${trimesterInfo.daysLeft > 60 ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950" : trimesterInfo.daysLeft > 21 ? "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950" : "text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950"} border-current/20`}>
                                        {trimesterInfo.daysLeft > 0 ? `${trimesterInfo.daysLeft} ${t.dashboard.webFormsDaysUntilBirth}` : trimesterInfo.daysLeft === 0 ? t.dashboard.webFormsDueDateToday : `${Math.abs(trimesterInfo.daysLeft)} ${t.dashboard.webFormsDaysAfterDue}`}
                                      </Badge>
                                    </>
                                  )}
                                  {fieldStatus === "match" && (
                                    <CheckCircle className="h-3.5 w-3.5 text-green-500 dark:text-green-400 shrink-0" />
                                  )}
                                  {fieldStatus === "differs" && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800">
                                      {t.dashboard.webFormsPrecheckDiffers}
                                    </Badge>
                                  )}
                                  {fieldStatus === "new" && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                                      {t.dashboard.webFormsPrecheckNewField}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ));
                })()}

                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => runSocialCheck(selectedSubmission.id)}
                    disabled={socialCheckLoading}
                    className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950"
                    data-testid="btn-social-check"
                  >
                    {socialCheckLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    {socialCheckLoading ? t.dashboard.webFormsSocialCheckRunning : t.dashboard.webFormsSocialCheck}
                  </Button>

                  {(() => {
                    const subData = parseSubmissionData(selectedSubmission.data);
                    const phoneNumber = subData.phone || subData.mobile || "";
                    if (!phoneNumber) return null;
                    return (
                      <CallCustomerButton
                        phoneNumber={String(phoneNumber)}
                        customerId={selectedSubmission.customerId || undefined}
                        customerName={`${subData.firstName || ""} ${subData.lastName || ""}`.trim()}
                        variant="default"
                      />
                    );
                  })()}
                </div>

                {socialCheckResult && (
                  <div className="space-y-3 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-950/20 p-4" data-testid="social-check-results">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      <h4 className="text-sm font-semibold text-indigo-800 dark:text-indigo-200">{t.dashboard.webFormsSocialCheckAiAnalysis}</h4>
                    </div>
                    <div className="text-sm text-foreground/80 whitespace-pre-line leading-relaxed bg-white dark:bg-background rounded-lg p-3 border border-indigo-100 dark:border-indigo-900">
                      {socialCheckResult.aiAnalysis}
                    </div>

                    <div>
                      <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t.dashboard.webFormsSocialCheckLinks}</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {socialCheckResult.searchLinks?.map((link: any) => (
                          <a
                            key={link.platform}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-white dark:bg-background hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors text-sm"
                            data-testid={`link-social-${link.platform}`}
                          >
                            <Search className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                            <span className="font-medium truncate flex-1">{link.platform}</span>
                            <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {selectedSubmission.customerId && (
                  <div className="space-y-2 rounded-xl border p-4" data-testid="call-note-section">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <h4 className="text-sm font-semibold">{t.dashboard.webFormsCallNote}</h4>
                    </div>
                    <Textarea
                      value={callNote}
                      onChange={(e) => setCallNote(e.target.value)}
                      placeholder={t.dashboard.webFormsCallNotePlaceholder}
                      className="min-h-[80px] text-sm"
                      data-testid="textarea-call-note"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!callNote.trim() || saveNoteMutation.isPending}
                      onClick={() => {
                        if (selectedSubmission.customerId && callNote.trim()) {
                          const subData = parseSubmissionData(selectedSubmission.data);
                          const prefix = `[Web Form: ${selectedForm?.name || "Registrácia"}] `;
                          saveNoteMutation.mutate({
                            customerId: selectedSubmission.customerId,
                            content: prefix + callNote.trim(),
                          });
                        }
                      }}
                      data-testid="btn-save-call-note"
                    >
                      {saveNoteMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      {t.dashboard.webFormsSaveNote}
                    </Button>
                  </div>
                )}

                {selectedSubmission.status === "pending" && (
                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={() => updateStatusMutation.mutate({ submissionId: selectedSubmission.id, status: "approved" })}
                      disabled={updateStatusMutation.isPending}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      data-testid="btn-approve-submission"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {t.dashboard.webFormsApprove}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => updateStatusMutation.mutate({ submissionId: selectedSubmission.id, status: "rejected" })}
                      disabled={updateStatusMutation.isPending}
                      className="flex-1 border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950"
                      data-testid="btn-reject-submission"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      {t.dashboard.webFormsReject}
                    </Button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  {selectedForm?.name || "Registrácie"}
                  {selectedForm && (
                    <span className="text-lg ml-1">{getCountryFlag(selectedForm.countryCode)}</span>
                  )}
                </DialogTitle>
                <DialogDescription>{t.dashboard.webFormsListDescription}</DialogDescription>
              </DialogHeader>

              <Tabs value={submissionTab} onValueChange={setSubmissionTab} className="mt-2">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="pending" data-testid="tab-submissions-pending">
                    {t.dashboard.webFormsTabPending}
                    {formSubmissions.filter(s => s.status === "pending").length > 0 && (
                      <Badge variant="secondary" className="ml-1.5 text-xs bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                        {formSubmissions.filter(s => s.status === "pending").length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="approved" data-testid="tab-submissions-approved">{t.dashboard.webFormsTabApproved}</TabsTrigger>
                  <TabsTrigger value="rejected" data-testid="tab-submissions-rejected">{t.dashboard.webFormsTabRejected}</TabsTrigger>
                  <TabsTrigger value="all" data-testid="tab-submissions-all">{t.dashboard.webFormsTabAll}</TabsTrigger>
                </TabsList>

                <TabsContent value={submissionTab} className="mt-4">
                  {submissionsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredFormSubmissions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">{t.dashboard.webFormsNoRegistrations}</p>
                  ) : (
                    <Table data-testid="table-submissions-list">
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t.dashboard.webFormsDate}</TableHead>
                          <TableHead>{t.dashboard.webFormsName}</TableHead>
                          <TableHead>{t.dashboard.webFormsEmail}</TableHead>
                          <TableHead>{t.dashboard.webFormsType}</TableHead>
                          <TableHead>{t.dashboard.webFormsStatus}</TableHead>
                          <TableHead className="text-right">{t.dashboard.webFormsActions}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredFormSubmissions.map(sub => {
                          const data = parseSubmissionData(sub.data);
                          return (
                            <TableRow
                              key={sub.id}
                              className="cursor-pointer hover:bg-accent/50"
                              onClick={() => { setSelectedSubmission(sub); setFieldsToUpdate(new Set()); setSocialCheckResult(null); setCallNote(""); }}
                              data-testid={`row-submission-${sub.id}`}
                            >
                              <TableCell className="text-sm">
                                {format(new Date(sub.createdAt), "dd.MM.yyyy HH:mm")}
                              </TableCell>
                              <TableCell className="font-medium text-sm">
                                {data.firstName || ""} {data.lastName || ""}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {data.email || "-"}
                              </TableCell>
                              <TableCell>
                                {sub.isNewCustomer ? (
                                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                                    <UserPlus className="h-3 w-3 mr-1" />
                                    {t.dashboard.webFormsNew2}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800">
                                    <UserCog className="h-3 w-3 mr-1" />
                                    {t.dashboard.webFormsExisting}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {sub.status === "pending" && (
                                  <Badge variant="secondary" className="text-xs bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {t.dashboard.webFormsPending}
                                  </Badge>
                                )}
                                {(sub.status === "approved" || sub.status === "processed") && (
                                  <Badge variant="secondary" className="text-xs bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    {sub.status === "processed" ? t.dashboard.webFormsProcessed : t.dashboard.webFormsApproved}
                                  </Badge>
                                )}
                                {sub.status === "rejected" && (
                                  <Badge variant="secondary" className="text-xs bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                                    <XCircle className="h-3 w-3 mr-1" />
                                    {t.dashboard.webFormsRejected}
                                  </Badge>
                                )}
                                {!["pending", "approved", "rejected", "processed"].includes(sub.status) && (
                                  <Badge variant="outline" className="text-xs">{sub.status}</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm" data-testid={`btn-view-submission-${sub.id}`}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
