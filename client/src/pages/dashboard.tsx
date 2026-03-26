import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Users, UserCheck, Globe, Droplets, TrendingUp, Activity, FileText, Clock, CheckCircle2, AlertCircle, ClipboardList, Eye, UserPlus, UserCog, CheckCircle, XCircle, ChevronRight, ArrowLeft, Loader2, User, Mail, Phone, MapPin, Calendar, CreditCard, Baby, Heart, Hospital, Stethoscope, Shield, Megaphone, Newspaper, Hash, Building } from "lucide-react";
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
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Customer, User, Invoice } from "@shared/schema";
import { useModuleFieldPermissions } from "@/components/ui/permission-field";

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

  const { data: customers = [], isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: users = [] } = useQuery<User[]>({
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
    return cf || key;
  };

  const renderFieldValue = (key: string, value: any): string => {
    if (value === null || value === undefined || value === "") return "-";
    if (typeof value === "boolean") return value ? "Áno" : "Nie";
    if (typeof value === "object") return JSON.stringify(value);
    const strVal = String(value);
    const resolvedKey = resolveKey(key);
    if (resolvedKey === "hospitalId") return lookupMaps.hospitalMap.get(strVal) || strVal;
    if (resolvedKey === "gynecologistClinicId") return lookupMaps.clinicMap.get(strVal) || strVal;
    if (resolvedKey === "healthInsuranceId") return lookupMaps.insuranceMap.get(strVal) || strVal;
    if (resolvedKey === "productSetId") return lookupMaps.productSetMap.get(strVal) || lookupMaps.productMap.get(strVal) || strVal;
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

  const getFieldIcon = (key: string) => {
    const resolvedKey = resolveKey(key);
    return fieldIcons[resolvedKey] || FileText;
  };

  const fieldSections: Record<string, string[]> = {
    "Osobné údaje": ["firstName", "lastName", "maidenName", "titleBefore", "titleAfter", "dateOfBirth", "personalId"],
    "Kontaktné údaje": ["email", "phone", "mobile"],
    "Adresa": ["street", "city", "postalCode", "country"],
    "Korešpondenčná adresa": ["corrStreet", "corrCity", "corrPostalCode"],
    "Zdravotné informácie": ["healthInsuranceId", "productSetId", "hospitalId", "gynecologistClinicId", "expectedDeliveryDate"],
    "Platba a súhlas": ["paymentMethod", "gdprConsent", "newsletter", "howDidYouHear"],
  };

  const categorizeFields = (data: Record<string, any>) => {
    const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== "");
    const usedKeys = new Set<string>();
    const sections: { title: string; items: [string, any][] }[] = [];

    for (const [sectionTitle, sectionKeys] of Object.entries(fieldSections)) {
      const items: [string, any][] = [];
      for (const [key, value] of entries) {
        const resolvedKey = resolveKey(key);
        if (sectionKeys.includes(resolvedKey)) {
          items.push([key, value]);
          usedKeys.add(key);
        }
      }
      if (items.length > 0) sections.push({ title: sectionTitle, items });
    }

    const remaining = entries.filter(([k]) => !usedKeys.has(k));
    if (remaining.length > 0) sections.push({ title: "Ďalšie údaje", items: remaining });

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

  const getFieldLabel = (key: string): string => {
    if (fieldLabels[key]) return fieldLabels[key];
    if (formFieldLabelMap.has(key)) return formFieldLabelMap.get(key)!;
    return key;
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
          <CardTitle className="text-lg font-medium">Webové formuláre</CardTitle>
          <ClipboardList className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {formStats.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Žiadne webové formuláre</p>
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
                        {stat.pending} nových
                      </Badge>
                    )}
                    {stat.approved > 0 && (
                      <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {stat.approved}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">{stat.total} celkom</span>
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
                    Späť
                  </Button>
                  <DialogTitle className="text-lg">Detail registrácie</DialogTitle>
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
                        Nový zákazník
                      </Badge>
                    ) : (
                      <Badge className="bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800">
                        <UserCog className="h-3 w-3 mr-1" />
                        Existujúci zákazník
                      </Badge>
                    )}
                    {selectedSubmission.isOtpVerified && (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        OTP overený
                      </Badge>
                    )}
                    {selectedSubmission.status === "pending" && (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
                        <Clock className="h-3 w-3 mr-1" />
                        Čaká na schválenie
                      </Badge>
                    )}
                    {(selectedSubmission.status === "approved" || selectedSubmission.status === "processed") && (
                      <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {selectedSubmission.status === "processed" ? "Spracované" : "Schválené"}
                      </Badge>
                    )}
                    {selectedSubmission.status === "rejected" && (
                      <Badge className="bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800">
                        <XCircle className="h-3 w-3 mr-1" />
                        Zamietnuté
                      </Badge>
                    )}
                  </div>
                  {selectedSubmission.customerId && (() => {
                    const cust = customerMap.get(selectedSubmission.customerId);
                    return cust ? (
                      <div className="w-full pt-2 mt-2 border-t border-border/50 flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Prepojený zákazník: <strong className="text-foreground">{cust.firstName} {cust.lastName}</strong>
                        </span>
                      </div>
                    ) : null;
                  })()}
                </div>

                {categorizeFields(parseSubmissionData(selectedSubmission.data)).map((section) => (
                  <div key={section.title} className="space-y-1" data-testid={`section-${section.title}`}>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 pb-1">
                      {section.title}
                    </h4>
                    <div className="rounded-xl border overflow-hidden">
                      {section.items.map(([key, value], idx) => {
                        const IconComp = getFieldIcon(key);
                        return (
                          <div
                            key={key}
                            className={`flex items-center gap-3 px-4 py-3 ${idx < section.items.length - 1 ? "border-b" : ""} hover:bg-muted/30 transition-colors`}
                          >
                            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted/60 shrink-0">
                              <IconComp className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-muted-foreground leading-tight">{getFieldLabel(key)}</p>
                              <p className="text-sm font-medium truncate">{renderFieldValue(key, value)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {selectedSubmission.status === "pending" && (
                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={() => updateStatusMutation.mutate({ submissionId: selectedSubmission.id, status: "approved" })}
                      disabled={updateStatusMutation.isPending}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      data-testid="btn-approve-submission"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Schváliť registráciu
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => updateStatusMutation.mutate({ submissionId: selectedSubmission.id, status: "rejected" })}
                      disabled={updateStatusMutation.isPending}
                      className="flex-1 border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950"
                      data-testid="btn-reject-submission"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Zamietnuť registráciu
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
                <DialogDescription>Prehľad registrácií z webového formulára</DialogDescription>
              </DialogHeader>

              <Tabs value={submissionTab} onValueChange={setSubmissionTab} className="mt-2">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="pending" data-testid="tab-submissions-pending">
                    Čakajúce
                    {formSubmissions.filter(s => s.status === "pending").length > 0 && (
                      <Badge variant="secondary" className="ml-1.5 text-xs bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                        {formSubmissions.filter(s => s.status === "pending").length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="approved" data-testid="tab-submissions-approved">Schválené</TabsTrigger>
                  <TabsTrigger value="rejected" data-testid="tab-submissions-rejected">Zamietnuté</TabsTrigger>
                  <TabsTrigger value="all" data-testid="tab-submissions-all">Všetky</TabsTrigger>
                </TabsList>

                <TabsContent value={submissionTab} className="mt-4">
                  {submissionsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredFormSubmissions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Žiadne registrácie</p>
                  ) : (
                    <Table data-testid="table-submissions-list">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Dátum</TableHead>
                          <TableHead>Meno</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Typ</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Akcie</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredFormSubmissions.map(sub => {
                          const data = parseSubmissionData(sub.data);
                          return (
                            <TableRow
                              key={sub.id}
                              className="cursor-pointer hover:bg-accent/50"
                              onClick={() => setSelectedSubmission(sub)}
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
                                    Nový
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800">
                                    <UserCog className="h-3 w-3 mr-1" />
                                    Existujúci
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {sub.status === "pending" && (
                                  <Badge variant="secondary" className="text-xs bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                    <Clock className="h-3 w-3 mr-1" />
                                    Čaká
                                  </Badge>
                                )}
                                {(sub.status === "approved" || sub.status === "processed") && (
                                  <Badge variant="secondary" className="text-xs bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    {sub.status === "processed" ? "Spracované" : "Schválené"}
                                  </Badge>
                                )}
                                {sub.status === "rejected" && (
                                  <Badge variant="secondary" className="text-xs bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                                    <XCircle className="h-3 w-3 mr-1" />
                                    Zamietnuté
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
