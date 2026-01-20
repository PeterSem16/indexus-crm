import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Search, User, MapPin, FileText, Award, Gift, Activity, ClipboardList, Upload, Download, Eye, X, Filter, ListChecks, FileEdit, Smartphone, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ArrowUpDown, ArrowUp, ArrowDown, FileSpreadsheet, RefreshCw, Building2, Clock } from "lucide-react";
import { CollaboratorFormWizard } from "@/components/collaborator-form-wizard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/i18n";
import { usePermissions } from "@/contexts/permissions-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { useCountryFilter } from "@/contexts/country-filter-context";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getCountryFlag, getCountryName } from "@/lib/countries";
import type { 
  Collaborator, 
  CollaboratorAddress, 
  CollaboratorOtherData, 
  CollaboratorAgreement,
  SafeUser,
  Hospital,
  HealthInsurance,
  BillingDetails,
  ActivityLog,
} from "@shared/schema";
import { 
  COUNTRIES, 
  WORLD_COUNTRIES,
  COLLABORATOR_TYPES, 
  MARITAL_STATUSES, 
  REWARD_TYPES, 
  ADDRESS_TYPES,
} from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface CollaboratorFormData {
  countryCode: string;
  titleBefore: string;
  firstName: string;
  lastName: string;
  maidenName: string;
  titleAfter: string;
  birthNumber: string;
  birthDay: number | null;
  birthMonth: number | null;
  birthYear: number | null;
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

const defaultFormData: CollaboratorFormData = {
  countryCode: "",
  titleBefore: "",
  firstName: "",
  lastName: "",
  maidenName: "",
  titleAfter: "",
  birthNumber: "",
  birthDay: null,
  birthMonth: null,
  birthYear: null,
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
};

interface AddressFormData {
  name: string;
  streetNumber: string;
  city: string;
  postalCode: string;
  region: string;
  countryCode: string;
}

const defaultAddressData: AddressFormData = {
  name: "",
  streetNumber: "",
  city: "",
  postalCode: "",
  region: "",
  countryCode: "",
};

interface OtherDataFormData {
  ztpDay: number | null;
  ztpMonth: number | null;
  ztpYear: number | null;
  oldAgePensionDay: number | null;
  oldAgePensionMonth: number | null;
  oldAgePensionYear: number | null;
  disabilityPensionDay: number | null;
  disabilityPensionMonth: number | null;
  disabilityPensionYear: number | null;
  widowPensionDay: number | null;
  widowPensionMonth: number | null;
  widowPensionYear: number | null;
}

const defaultOtherData: OtherDataFormData = {
  ztpDay: null,
  ztpMonth: null,
  ztpYear: null,
  oldAgePensionDay: null,
  oldAgePensionMonth: null,
  oldAgePensionYear: null,
  disabilityPensionDay: null,
  disabilityPensionMonth: null,
  disabilityPensionYear: null,
  widowPensionDay: null,
  widowPensionMonth: null,
  widowPensionYear: null,
};

function DateFields({
  label,
  dayValue,
  monthValue,
  yearValue,
  onDayChange,
  onMonthChange,
  onYearChange,
  onSetAll,
  testIdPrefix,
  t,
  showEndOfYear = false,
  endOfYearSourceYear,
}: {
  label: string;
  dayValue: number | null;
  monthValue: number | null;
  yearValue: number | null;
  onDayChange: (val: number | null) => void;
  onMonthChange: (val: number | null) => void;
  onYearChange: (val: number | null) => void;
  onSetAll?: (day: number, month: number, year: number) => void;
  testIdPrefix: string;
  t: any;
  showEndOfYear?: boolean;
  endOfYearSourceYear?: number | null;
}) {
  const getDaysInMonth = (year?: number | null, month?: number | null) => {
    if (!year || !month) return 31;
    return new Date(year, month, 0).getDate();
  };
  
  const daysInMonth = getDaysInMonth(yearValue, monthValue);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 120 }, (_, i) => currentYear + 10 - i);

  const setToday = () => {
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();
    if (onSetAll) {
      onSetAll(day, month, year);
    } else {
      onDayChange(day);
      onMonthChange(month);
      onYearChange(year);
    }
  };
  
  const setEndOfYear = (sourceYear?: number | null) => {
    const year = sourceYear || new Date().getFullYear();
    if (onSetAll) {
      onSetAll(31, 12, year);
    } else {
      onDayChange(31);
      onMonthChange(12);
      onYearChange(year);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        <div className="flex gap-1">
          {showEndOfYear && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEndOfYear(endOfYearSourceYear)}
              data-testid={`button-${testIdPrefix}-endofyear`}
            >
              {t.common.endOfYear || "31.12."}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={setToday}
            data-testid={`button-${testIdPrefix}-today`}
          >
            {t.common.today}
          </Button>
        </div>
      </div>
      <div className="flex gap-2">
        <Select
          value={dayValue?.toString() || "_none"}
          onValueChange={(val) => onDayChange(val === "_none" ? null : parseInt(val))}
        >
          <SelectTrigger className="w-[80px]" data-testid={`select-${testIdPrefix}-day`}>
            <SelectValue placeholder={t.collaborators.fields.day} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">-</SelectItem>
            {days.map((day) => (
              <SelectItem key={day} value={day.toString()}>
                {day}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={monthValue?.toString() || "_none"}
          onValueChange={(val) => {
            const newMonth = val === "_none" ? null : parseInt(val);
            onMonthChange(newMonth);
            if (newMonth && dayValue) {
              const maxDay = getDaysInMonth(yearValue, newMonth);
              if (dayValue > maxDay) {
                onDayChange(maxDay);
              }
            }
          }}
        >
          <SelectTrigger className="w-[80px]" data-testid={`select-${testIdPrefix}-month`}>
            <SelectValue placeholder={t.collaborators.fields.month} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">-</SelectItem>
            {months.map((month) => (
              <SelectItem key={month} value={month.toString()}>
                {month}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={yearValue?.toString() || "_none"}
          onValueChange={(val) => {
            const newYear = val === "_none" ? null : parseInt(val);
            onYearChange(newYear);
            if (newYear && monthValue && dayValue) {
              const maxDay = getDaysInMonth(newYear, monthValue);
              if (dayValue > maxDay) {
                onDayChange(maxDay);
              }
            }
          }}
        >
          <SelectTrigger className="w-[90px]" data-testid={`select-${testIdPrefix}-year`}>
            <SelectValue placeholder={t.collaborators.fields.year} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">-</SelectItem>
            {years.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function AddressTab({
  addressType,
  collaboratorId,
  collaboratorName,
  t,
}: {
  addressType: string;
  collaboratorId: string;
  collaboratorName: string;
  t: any;
}) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<AddressFormData>(defaultAddressData);

  const { data: addressData } = useQuery<CollaboratorAddress[]>({
    queryKey: ["/api/collaborators", collaboratorId, "addresses"],
    queryFn: async () => {
      const res = await fetch(`/api/collaborators/${collaboratorId}/addresses`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!collaboratorId,
  });

  useEffect(() => {
    if (addressData) {
      const addr = addressData.find((a) => a.addressType === addressType);
      if (addr) {
        setFormData({
          name: addr.name || "",
          streetNumber: addr.streetNumber || "",
          city: (addr as any).city || "",
          postalCode: addr.postalCode || "",
          region: addr.region || "",
          countryCode: addr.countryCode || "",
        });
      } else {
        setFormData(defaultAddressData);
      }
    }
  }, [addressData, addressType]);

  const saveMutation = useMutation({
    mutationFn: (data: AddressFormData) => {
      return apiRequest("PUT", `/api/collaborators/${collaboratorId}/addresses/${addressType}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collaborators", collaboratorId, "addresses"] });
      toast({ title: t.success.saved });
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  const handleCopyFromPersonal = () => {
    setFormData({ ...formData, name: collaboratorName });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t.collaborators.fields.name}</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCopyFromPersonal}
              data-testid={`button-copy-name-${addressType}`}
            >
              <ClipboardList className="h-3 w-3 mr-1" />
              {t.collaborators.fields.copyFromPersonal}
            </Button>
          </div>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            data-testid={`input-address-${addressType}-name`}
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
      <div className="grid gap-4 md:grid-cols-2">
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
            data-testid={`input-address-${addressType}-postal`}
          />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>{t.collaborators.fields.addressRegion}</Label>
          <Input
            value={formData.region}
            onChange={(e) => setFormData({ ...formData, region: e.target.value })}
            data-testid={`input-address-${addressType}-region`}
          />
        </div>
        <div className="space-y-2">
          <Label>{t.collaborators.fields.addressCountry}</Label>
          <Select
            value={formData.countryCode || "_none"}
            onValueChange={(value) => setFormData({ ...formData, countryCode: value === "_none" ? "" : value })}
          >
            <SelectTrigger data-testid={`select-address-${addressType}-country`}>
              <SelectValue placeholder={t.collaborators.fields.addressCountry} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">{t.common.noData}</SelectItem>
              {WORLD_COUNTRIES.map((country) => (
                <SelectItem key={country.code} value={country.code}>
                  {country.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid={`button-save-address-${addressType}`}>
          {saveMutation.isPending ? t.common.loading : t.common.save}
        </Button>
      </div>
    </div>
  );
}

function CollapsibleAddressSection({
  addressType,
  title,
  collaboratorId,
  collaboratorName,
  t,
}: {
  addressType: string;
  title: string;
  collaboratorId: string;
  collaboratorName: string;
  t: any;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover-elevate">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <CardTitle className="text-base">{title}</CardTitle>
              </div>
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            <AddressTab
              addressType={addressType}
              collaboratorId={collaboratorId}
              collaboratorName={collaboratorName}
              t={t}
            />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function HistoryTab({
  collaboratorId,
  t,
}: {
  collaboratorId: string;
  t: any;
}) {
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
      <Card>
        <CardHeader>
          <CardTitle>{t.collaborators.history?.title || t.collaborators.tabs.history}</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          {t.collaborators.history?.title || t.collaborators.tabs.history}
        </CardTitle>
        <CardDescription>
          {t.collaborators.history?.description || t.collaborators.actionsDesc}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {activityLogs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {t.collaborators.history?.noHistory || t.common.noData}
          </div>
        ) : (
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
        )}
      </CardContent>
    </Card>
  );
}

function OtherDataTab({
  collaboratorId,
  t,
}: {
  collaboratorId: string;
  t: any;
}) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<OtherDataFormData>(defaultOtherData);

  const { data: otherData } = useQuery<CollaboratorOtherData | null>({
    queryKey: ["/api/collaborators", collaboratorId, "other-data"],
    queryFn: async () => {
      const res = await fetch(`/api/collaborators/${collaboratorId}/other-data`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!collaboratorId,
  });

  useEffect(() => {
    if (otherData) {
      setFormData({
        ztpDay: otherData.ztpDay,
        ztpMonth: otherData.ztpMonth,
        ztpYear: otherData.ztpYear,
        oldAgePensionDay: otherData.oldAgePensionDay,
        oldAgePensionMonth: otherData.oldAgePensionMonth,
        oldAgePensionYear: otherData.oldAgePensionYear,
        disabilityPensionDay: otherData.disabilityPensionDay,
        disabilityPensionMonth: otherData.disabilityPensionMonth,
        disabilityPensionYear: otherData.disabilityPensionYear,
        widowPensionDay: otherData.widowPensionDay,
        widowPensionMonth: otherData.widowPensionMonth,
        widowPensionYear: otherData.widowPensionYear,
      });
    }
  }, [otherData]);

  const saveMutation = useMutation({
    mutationFn: (data: OtherDataFormData) => {
      return apiRequest("PUT", `/api/collaborators/${collaboratorId}/other-data`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collaborators", collaboratorId, "other-data"] });
      toast({ title: t.success.saved });
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <DateFields
          label={t.collaborators.fields.ztpFrom}
          dayValue={formData.ztpDay}
          monthValue={formData.ztpMonth}
          yearValue={formData.ztpYear}
          onDayChange={(val) => setFormData({ ...formData, ztpDay: val })}
          onMonthChange={(val) => setFormData({ ...formData, ztpMonth: val })}
          onYearChange={(val) => setFormData({ ...formData, ztpYear: val })}
          onSetAll={(d, m, y) => setFormData({ ...formData, ztpDay: d, ztpMonth: m, ztpYear: y })}
          testIdPrefix="ztp"
          t={t}
        />
        <DateFields
          label={t.collaborators.fields.oldAgePension}
          dayValue={formData.oldAgePensionDay}
          monthValue={formData.oldAgePensionMonth}
          yearValue={formData.oldAgePensionYear}
          onDayChange={(val) => setFormData({ ...formData, oldAgePensionDay: val })}
          onMonthChange={(val) => setFormData({ ...formData, oldAgePensionMonth: val })}
          onYearChange={(val) => setFormData({ ...formData, oldAgePensionYear: val })}
          onSetAll={(d, m, y) => setFormData({ ...formData, oldAgePensionDay: d, oldAgePensionMonth: m, oldAgePensionYear: y })}
          testIdPrefix="oldAgePension"
          t={t}
        />
        <DateFields
          label={t.collaborators.fields.disabilityPension}
          dayValue={formData.disabilityPensionDay}
          monthValue={formData.disabilityPensionMonth}
          yearValue={formData.disabilityPensionYear}
          onDayChange={(val) => setFormData({ ...formData, disabilityPensionDay: val })}
          onMonthChange={(val) => setFormData({ ...formData, disabilityPensionMonth: val })}
          onYearChange={(val) => setFormData({ ...formData, disabilityPensionYear: val })}
          onSetAll={(d, m, y) => setFormData({ ...formData, disabilityPensionDay: d, disabilityPensionMonth: m, disabilityPensionYear: y })}
          testIdPrefix="disabilityPension"
          t={t}
        />
        <DateFields
          label={t.collaborators.fields.widowPension}
          dayValue={formData.widowPensionDay}
          monthValue={formData.widowPensionMonth}
          yearValue={formData.widowPensionYear}
          onDayChange={(val) => setFormData({ ...formData, widowPensionDay: val })}
          onMonthChange={(val) => setFormData({ ...formData, widowPensionMonth: val })}
          onYearChange={(val) => setFormData({ ...formData, widowPensionYear: val })}
          onSetAll={(d, m, y) => setFormData({ ...formData, widowPensionDay: d, widowPensionMonth: m, widowPensionYear: y })}
          testIdPrefix="widowPension"
          t={t}
        />
      </div>
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-other-data">
          {saveMutation.isPending ? t.common.loading : t.common.save}
        </Button>
      </div>
    </div>
  );
}

function AgreementsTab({
  collaboratorId,
  collaboratorCountry,
  t,
}: {
  collaboratorId: string;
  collaboratorCountry: string;
  t: any;
}) {
  const { toast } = useToast();
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [formData, setFormData] = useState({
    billingCompanyId: "",
    contractNumber: "",
    validFromDay: null as number | null,
    validFromMonth: null as number | null,
    validFromYear: null as number | null,
    validToDay: null as number | null,
    validToMonth: null as number | null,
    validToYear: null as number | null,
    isValid: true,
    agreementSentDay: null as number | null,
    agreementSentMonth: null as number | null,
    agreementSentYear: null as number | null,
    agreementReturnedDay: null as number | null,
    agreementReturnedMonth: null as number | null,
    agreementReturnedYear: null as number | null,
    agreementForm: "",
    rewardTypes: [] as string[],
  });

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
      setIsAddingNew(false);
      setEditingId(null);
      resetForm();
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
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

  const resetForm = () => {
    setFormData({
      billingCompanyId: "",
      contractNumber: "",
      validFromDay: null,
      validFromMonth: null,
      validFromYear: null,
      validToDay: null,
      validToMonth: null,
      validToYear: null,
      isValid: true,
      agreementSentDay: null,
      agreementSentMonth: null,
      agreementSentYear: null,
      agreementReturnedDay: null,
      agreementReturnedMonth: null,
      agreementReturnedYear: null,
      agreementForm: "",
      rewardTypes: [],
    });
  };

  const handleEdit = (agreement: CollaboratorAgreement) => {
    setEditingId(agreement.id);
    setFormData({
      billingCompanyId: agreement.billingCompanyId || "",
      contractNumber: agreement.contractNumber || "",
      validFromDay: agreement.validFromDay,
      validFromMonth: agreement.validFromMonth,
      validFromYear: agreement.validFromYear,
      validToDay: agreement.validToDay,
      validToMonth: agreement.validToMonth,
      validToYear: agreement.validToYear,
      isValid: agreement.isValid,
      agreementSentDay: agreement.agreementSentDay,
      agreementSentMonth: agreement.agreementSentMonth,
      agreementSentYear: agreement.agreementSentYear,
      agreementReturnedDay: agreement.agreementReturnedDay,
      agreementReturnedMonth: agreement.agreementReturnedMonth,
      agreementReturnedYear: agreement.agreementReturnedYear,
      agreementForm: agreement.agreementForm || "",
      rewardTypes: agreement.rewardTypes || [],
    });
    setIsAddingNew(true);
  };

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
      
      if (!response.ok) throw new Error("Upload failed");
      
      queryClient.invalidateQueries({ queryKey: ["/api/collaborators", collaboratorId, "agreements"] });
      toast({ title: t.success.saved });
    } catch (error) {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    } finally {
      setUploadingFile(false);
    }
  };

  const formatDate = (day: number | null, month: number | null, year: number | null) => {
    if (!day || !month || !year) return "-";
    return `${day}.${month}.${year}`;
  };

  const toggleRewardType = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      rewardTypes: prev.rewardTypes.includes(value)
        ? prev.rewardTypes.filter((r) => r !== value)
        : [...prev.rewardTypes, value],
    }));
  };

  const getBillingCompanyName = (id: string | null) => {
    if (!id) return "-";
    return billingCompanies.find((bc) => bc.id === id)?.companyName || "-";
  };

  if (isAddingNew || editingId) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t.collaborators.fields.billingCompany}</Label>
            <Select
              value={formData.billingCompanyId || "_none"}
              onValueChange={(value) => setFormData({ ...formData, billingCompanyId: value === "_none" ? "" : value })}
            >
              <SelectTrigger data-testid="select-agreement-billing">
                <SelectValue placeholder={t.collaborators.fields.billingCompany} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">{t.common.noData}</SelectItem>
                {billingCompanies.map((bc) => (
                  <SelectItem key={bc.id} value={bc.id}>
                    {bc.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t.collaborators.fields.contractNumber}</Label>
            <Input
              value={formData.contractNumber}
              onChange={(e) => setFormData({ ...formData, contractNumber: e.target.value })}
              data-testid="input-agreement-contract"
            />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <DateFields
            label={t.collaborators.fields.validFrom}
            dayValue={formData.validFromDay}
            monthValue={formData.validFromMonth}
            yearValue={formData.validFromYear}
            onDayChange={(val) => setFormData({ ...formData, validFromDay: val })}
            onMonthChange={(val) => setFormData({ ...formData, validFromMonth: val })}
            onYearChange={(val) => setFormData({ ...formData, validFromYear: val })}
            onSetAll={(d, m, y) => setFormData({ ...formData, validFromDay: d, validFromMonth: m, validFromYear: y })}
            testIdPrefix="validFrom"
            t={t}
          />
          <DateFields
            label={t.collaborators.fields.validTo}
            dayValue={formData.validToDay}
            monthValue={formData.validToMonth}
            yearValue={formData.validToYear}
            onDayChange={(val) => setFormData({ ...formData, validToDay: val })}
            onMonthChange={(val) => setFormData({ ...formData, validToMonth: val })}
            onYearChange={(val) => setFormData({ ...formData, validToYear: val })}
            onSetAll={(d, m, y) => setFormData({ ...formData, validToDay: d, validToMonth: m, validToYear: y })}
            testIdPrefix="validTo"
            t={t}
            showEndOfYear={true}
            endOfYearSourceYear={formData.validFromYear}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <DateFields
            label={t.collaborators.fields.agreementSent}
            dayValue={formData.agreementSentDay}
            monthValue={formData.agreementSentMonth}
            yearValue={formData.agreementSentYear}
            onDayChange={(val) => setFormData({ ...formData, agreementSentDay: val })}
            onMonthChange={(val) => setFormData({ ...formData, agreementSentMonth: val })}
            onYearChange={(val) => setFormData({ ...formData, agreementSentYear: val })}
            onSetAll={(d, m, y) => setFormData({ ...formData, agreementSentDay: d, agreementSentMonth: m, agreementSentYear: y })}
            testIdPrefix="agreementSent"
            t={t}
          />
          <DateFields
            label={t.collaborators.fields.agreementReturned}
            dayValue={formData.agreementReturnedDay}
            monthValue={formData.agreementReturnedMonth}
            yearValue={formData.agreementReturnedYear}
            onDayChange={(val) => setFormData({ ...formData, agreementReturnedDay: val })}
            onMonthChange={(val) => setFormData({ ...formData, agreementReturnedMonth: val })}
            onYearChange={(val) => setFormData({ ...formData, agreementReturnedYear: val })}
            onSetAll={(d, m, y) => setFormData({ ...formData, agreementReturnedDay: d, agreementReturnedMonth: m, agreementReturnedYear: y })}
            testIdPrefix="agreementReturned"
            t={t}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t.collaborators.fields.agreementForm}</Label>
            <Input
              value={formData.agreementForm}
              onChange={(e) => setFormData({ ...formData, agreementForm: e.target.value })}
              data-testid="input-agreement-form"
            />
          </div>
          <div className="flex items-center space-x-2 pt-6">
            <Switch
              checked={formData.isValid}
              onCheckedChange={(checked) => setFormData({ ...formData, isValid: checked })}
              data-testid="switch-agreement-valid"
            />
            <Label>{t.collaborators.fields.isValid}</Label>
          </div>
        </div>
        <div className="space-y-2">
          <Label>{t.collaborators.fields.rewardTypes}</Label>
          <div className="flex flex-wrap gap-2">
            {REWARD_TYPES.map((rt) => (
              <Badge
                key={rt.value}
                variant={formData.rewardTypes.includes(rt.value) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleRewardType(rt.value)}
                data-testid={`badge-reward-${rt.value}`}
              >
                {t.collaborators.rewardTypes[rt.labelKey] || rt.value}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setIsAddingNew(false);
              setEditingId(null);
              resetForm();
            }}
            data-testid="button-cancel-agreement"
          >
            {t.common.cancel}
          </Button>
          <Button onClick={() => saveMutation.mutate(formData)} disabled={saveMutation.isPending} data-testid="button-save-agreement">
            {saveMutation.isPending ? t.common.loading : t.common.save}
          </Button>
        </div>
      </div>
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
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">{t.collaborators.fields.billingCompany}: </span>
                        {getBillingCompanyName(agreement.billingCompanyId)}
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t.collaborators.fields.contractNumber}: </span>
                        {agreement.contractNumber || "-"}
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t.collaborators.fields.agreementForm}: </span>
                        {agreement.agreementForm || "-"}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={agreement.isValid ? "default" : "secondary"}>
                          {agreement.isValid ? t.common.active : t.common.inactive}
                        </Badge>
                        {agreement.rewardTypes && agreement.rewardTypes.length > 0 && 
                          agreement.rewardTypes.map((rt: string) => {
                            const rewardType = REWARD_TYPES.find(r => r.value === rt);
                            return (
                              <Badge key={rt} variant="outline">
                                {rewardType ? (t.collaborators.rewardTypes[rewardType.labelKey] || rt) : rt}
                              </Badge>
                            );
                          })
                        }
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button size="icon" variant="ghost" onClick={() => handleEdit(agreement)} data-testid={`button-edit-agreement-${agreement.id}`}>
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
                      <span className="text-muted-foreground">{t.collaborators.fields.validFrom}: </span>
                      {formatDate(agreement.validFromDay, agreement.validFromMonth, agreement.validFromYear)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t.collaborators.fields.validTo}: </span>
                      {formatDate(agreement.validToDay, agreement.validToMonth, agreement.validToYear)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t.collaborators.fields.agreementSent}: </span>
                      {formatDate(agreement.agreementSentDay, agreement.agreementSentMonth, agreement.agreementSentYear)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t.collaborators.fields.agreementReturned}: </span>
                      {formatDate(agreement.agreementReturnedDay, agreement.agreementReturnedMonth, agreement.agreementReturnedYear)}
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
                            data-testid={`button-view-file-${agreement.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => window.open(`/api/collaborators/${collaboratorId}/agreements/${agreement.id}/download`, "_blank")}
                            data-testid={`button-download-file-${agreement.id}`}
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
                          data-testid={`input-upload-file-${agreement.id}`}
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

function ActionsTab({
  collaboratorId,
  t,
}: {
  collaboratorId: string;
  t: any;
}) {
  const { data: activityLogs = [], isLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/collaborators", collaboratorId, "activity-logs"],
    queryFn: async () => {
      const res = await fetch(`/api/collaborators/${collaboratorId}/activity-logs`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!collaboratorId,
  });

  const { data: users = [] } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
  });

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user ? user.fullName : userId;
  };

  const getActionLabel = (action: string) => {
    const actionLabels: Record<string, string> = {
      create: t.collaborators.actions.created,
      update: t.collaborators.actions.updated,
      delete: t.collaborators.actions.deleted,
      update_address: t.collaborators.actions.addressUpdated,
      update_other_data: t.collaborators.actions.otherDataUpdated,
      create_agreement: t.collaborators.actions.agreementCreated,
      update_agreement: t.collaborators.actions.agreementUpdated,
      delete_agreement: t.collaborators.actions.agreementDeleted,
      upload_file: t.collaborators.actions.fileUploaded,
    };
    return actionLabels[action] || action;
  };

  const formatDateTime = (date: string | Date | null) => {
    if (!date) return "-";
    const d = new Date(date);
    return d.toLocaleString();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.collaborators.tabs.actions}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.collaborators.tabs.actions}</CardTitle>
        <CardDescription>{t.collaborators.actionsDesc}</CardDescription>
      </CardHeader>
      <CardContent>
        {activityLogs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">{t.common.noData}</div>
        ) : (
          <div className="space-y-2">
            {activityLogs.map((log) => (
              <div key={log.id} className="flex items-start justify-between gap-4 p-3 rounded-md bg-muted/50 border">
                <div className="flex-1">
                  <div className="font-medium">{getActionLabel(log.action)}</div>
                  <div className="text-sm text-muted-foreground">
                    {t.collaborators.actions.by} {getUserName(log.userId)}
                  </div>
                  {log.details && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {JSON.parse(log.details).addressType && 
                        `${t.collaborators.fields.addressType}: ${JSON.parse(log.details).addressType}`
                      }
                      {JSON.parse(log.details).fileName && 
                        `${t.collaborators.fields.file}: ${JSON.parse(log.details).fileName}`
                      }
                    </div>
                  )}
                </div>
                <div className="text-sm text-muted-foreground whitespace-nowrap">
                  {formatDateTime(log.createdAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CollaboratorForm({
  collaborator,
  onClose,
  onSuccess,
}: {
  collaborator?: Collaborator;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [activeFormTab, setActiveFormTab] = useState("collaborator");
  const [activeAddressTab, setActiveAddressTab] = useState("permanent");

  const [formData, setFormData] = useState<CollaboratorFormData>(() =>
    collaborator
      ? {
          countryCode: collaborator.countryCode,
          titleBefore: collaborator.titleBefore || "",
          firstName: collaborator.firstName,
          lastName: collaborator.lastName,
          maidenName: collaborator.maidenName || "",
          titleAfter: collaborator.titleAfter || "",
          birthNumber: collaborator.birthNumber || "",
          birthDay: collaborator.birthDay,
          birthMonth: collaborator.birthMonth,
          birthYear: collaborator.birthYear,
          birthPlace: collaborator.birthPlace || "",
          healthInsuranceId: collaborator.healthInsuranceId || "",
          maritalStatus: collaborator.maritalStatus || "",
          collaboratorType: collaborator.collaboratorType || "",
          phone: collaborator.phone || "",
          mobile: collaborator.mobile || "",
          mobile2: collaborator.mobile2 || "",
          otherContact: collaborator.otherContact || "",
          email: collaborator.email || "",
          bankAccountIban: collaborator.bankAccountIban || "",
          swiftCode: collaborator.swiftCode || "",
          clientContact: collaborator.clientContact,
          representativeId: collaborator.representativeId || "",
          isActive: collaborator.isActive,
          svetZdravia: collaborator.svetZdravia,
          companyName: collaborator.companyName || "",
          ico: collaborator.ico || "",
          dic: collaborator.dic || "",
          icDph: collaborator.icDph || "",
          companyIban: collaborator.companyIban || "",
          companySwift: collaborator.companySwift || "",
          monthRewards: collaborator.monthRewards,
          note: collaborator.note || "",
          hospitalId: collaborator.hospitalId || "",
        }
      : defaultFormData
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
    mutationFn: (data: CollaboratorFormData) => {
      if (collaborator) {
        return apiRequest("PUT", `/api/collaborators/${collaborator.id}`, data);
      } else {
        return apiRequest("POST", "/api/collaborators", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collaborators"] });
      toast({ title: t.success.saved });
      onSuccess();
    },
    onError: () => {
      toast({ title: t.errors.saveFailed, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName || !formData.lastName || !formData.countryCode) {
      toast({ title: t.errors.required, variant: "destructive" });
      return;
    }
    saveMutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Tabs value={activeFormTab} onValueChange={setActiveFormTab}>
        <TabsList className="flex flex-wrap gap-1 h-auto mb-4">
          <TabsTrigger value="collaborator" data-testid="form-tab-collaborator">
            <User className="h-4 w-4 mr-2" />
            {t.collaborators.tabs.collaborator}
          </TabsTrigger>
          {collaborator && (
            <>
              <TabsTrigger value="companyAndAddresses" data-testid="form-tab-company-addresses">
                <MapPin className="h-4 w-4 mr-2" />
                {t.collaborators.tabs.companyAndAddresses}
              </TabsTrigger>
              <TabsTrigger value="otherData" data-testid="form-tab-other">
                <ClipboardList className="h-4 w-4 mr-2" />
                {t.collaborators.tabs.otherData}
              </TabsTrigger>
              <TabsTrigger value="agreements" data-testid="form-tab-agreements">
                <FileText className="h-4 w-4 mr-2" />
                {t.collaborators.tabs.agreements}
              </TabsTrigger>
              <TabsTrigger value="templates" data-testid="form-tab-templates">
                <FileText className="h-4 w-4 mr-2" />
                {t.collaborators.tabs.templates}
              </TabsTrigger>
              <TabsTrigger value="rewards" data-testid="form-tab-rewards">
                <Gift className="h-4 w-4 mr-2" />
                {t.collaborators.tabs.rewards}
              </TabsTrigger>
              <TabsTrigger value="actions" data-testid="form-tab-actions">
                <Activity className="h-4 w-4 mr-2" />
                {t.collaborators.tabs.actions}
              </TabsTrigger>
              <TabsTrigger value="history" data-testid="form-tab-history">
                <Activity className="h-4 w-4 mr-2" />
                {t.collaborators.tabs.history}
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="collaborator" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t.collaborators.fields.country} *</Label>
              <Select
                value={formData.countryCode}
                onValueChange={(value) =>
                  setFormData({ ...formData, countryCode: value, healthInsuranceId: "", hospitalId: "" })
                }
              >
                <SelectTrigger data-testid="select-collaborator-country">
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
            <div className="space-y-2">
              <Label>{t.collaborators.fields.collaboratorType}</Label>
              <Select
                value={formData.collaboratorType || "_none"}
                onValueChange={(value) => setFormData({ ...formData, collaboratorType: value === "_none" ? "" : value })}
              >
                <SelectTrigger data-testid="select-collaborator-type">
                  <SelectValue placeholder={t.collaborators.fields.collaboratorType} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">{t.common.noData}</SelectItem>
                  {COLLABORATOR_TYPES.map((ct) => (
                    <SelectItem key={ct.value} value={ct.value}>
                      {t.collaborators.types[ct.labelKey] || ct.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>{t.collaborators.fields.titleBefore}</Label>
              <Input
                value={formData.titleBefore}
                onChange={(e) => setFormData({ ...formData, titleBefore: e.target.value })}
                data-testid="input-collaborator-title-before"
              />
            </div>
            <div className="space-y-2">
              <Label>{t.collaborators.fields.firstName} *</Label>
              <Input
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                data-testid="input-collaborator-firstname"
              />
            </div>
            <div className="space-y-2">
              <Label>{t.collaborators.fields.lastName} *</Label>
              <Input
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                data-testid="input-collaborator-lastname"
              />
            </div>
            <div className="space-y-2">
              <Label>{t.collaborators.fields.titleAfter}</Label>
              <Input
                value={formData.titleAfter}
                onChange={(e) => setFormData({ ...formData, titleAfter: e.target.value })}
                data-testid="input-collaborator-title-after"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t.collaborators.fields.maidenName}</Label>
              <Input
                value={formData.maidenName}
                onChange={(e) => setFormData({ ...formData, maidenName: e.target.value })}
                data-testid="input-collaborator-maiden"
              />
            </div>
            <div className="space-y-2">
              <Label>{t.collaborators.fields.birthNumber}</Label>
              <Input
                value={formData.birthNumber}
                onChange={(e) => setFormData({ ...formData, birthNumber: e.target.value })}
                data-testid="input-collaborator-birth-number"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <DateFields
              label={t.collaborators.fields.birthDate}
              dayValue={formData.birthDay}
              monthValue={formData.birthMonth}
              yearValue={formData.birthYear}
              onDayChange={(val) => setFormData({ ...formData, birthDay: val })}
              onMonthChange={(val) => setFormData({ ...formData, birthMonth: val })}
              onYearChange={(val) => setFormData({ ...formData, birthYear: val })}
              onSetAll={(d, m, y) => setFormData({ ...formData, birthDay: d, birthMonth: m, birthYear: y })}
              testIdPrefix="birth"
              t={t}
            />
            <div className="space-y-2">
              <Label>{t.collaborators.fields.birthPlace}</Label>
              <Input
                value={formData.birthPlace}
                onChange={(e) => setFormData({ ...formData, birthPlace: e.target.value })}
                data-testid="input-collaborator-birth-place"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t.collaborators.fields.healthInsurance}</Label>
              <Select
                value={formData.healthInsuranceId || "_none"}
                onValueChange={(value) => setFormData({ ...formData, healthInsuranceId: value === "_none" ? "" : value })}
              >
                <SelectTrigger data-testid="select-collaborator-insurance">
                  <SelectValue placeholder={t.collaborators.fields.healthInsurance} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">{t.common.noData}</SelectItem>
                  {filteredHealthInsurances.map((hi) => (
                    <SelectItem key={hi.id} value={hi.id}>
                      {hi.name}
                    </SelectItem>
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
                <SelectTrigger data-testid="select-collaborator-marital">
                  <SelectValue placeholder={t.collaborators.fields.maritalStatus} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">{t.common.noData}</SelectItem>
                  {MARITAL_STATUSES.map((ms) => (
                    <SelectItem key={ms.value} value={ms.value}>
                      {t.collaborators.maritalStatuses[ms.labelKey] || ms.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t.collaborators.fields.phone}</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                data-testid="input-collaborator-phone"
              />
            </div>
            <div className="space-y-2">
              <Label>{t.collaborators.fields.mobile}</Label>
              <Input
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                data-testid="input-collaborator-mobile"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t.collaborators.fields.mobile2}</Label>
              <Input
                value={formData.mobile2}
                onChange={(e) => setFormData({ ...formData, mobile2: e.target.value })}
                data-testid="input-collaborator-mobile2"
              />
            </div>
            <div className="space-y-2">
              <Label>{t.collaborators.fields.otherContact}</Label>
              <Input
                value={formData.otherContact}
                onChange={(e) => setFormData({ ...formData, otherContact: e.target.value })}
                data-testid="input-collaborator-other-contact"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t.collaborators.fields.email}</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              data-testid="input-collaborator-email"
            />
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t.collaborators.fields.bankAccountIban}</Label>
              <Input
                value={formData.bankAccountIban}
                onChange={(e) => setFormData({ ...formData, bankAccountIban: e.target.value })}
                data-testid="input-collaborator-iban"
              />
            </div>
            <div className="space-y-2">
              <Label>{t.collaborators.fields.swiftCode}</Label>
              <Input
                value={formData.swiftCode}
                onChange={(e) => setFormData({ ...formData, swiftCode: e.target.value })}
                data-testid="input-collaborator-swift"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t.collaborators.fields.representative}</Label>
              <Select
                value={formData.representativeId || "_none"}
                onValueChange={(value) => setFormData({ ...formData, representativeId: value === "_none" ? "" : value })}
              >
                <SelectTrigger data-testid="select-collaborator-representative">
                  <SelectValue placeholder={t.collaborators.fields.representative} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">{t.common.noData}</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.fullName}
                    </SelectItem>
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
                <SelectTrigger data-testid="select-collaborator-hospital">
                  <SelectValue placeholder={t.collaborators.fields.hospital} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">{t.common.noData}</SelectItem>
                  {filteredHospitals.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                data-testid="switch-collaborator-active"
              />
              <Label>{t.collaborators.fields.active}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.clientContact}
                onCheckedChange={(checked) => setFormData({ ...formData, clientContact: checked })}
                data-testid="switch-collaborator-client-contact"
              />
              <Label>{t.collaborators.fields.clientContact}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.svetZdravia}
                onCheckedChange={(checked) => setFormData({ ...formData, svetZdravia: checked })}
                data-testid="switch-collaborator-svet-zdravia"
              />
              <Label>{t.collaborators.fields.svetZdravia}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.monthRewards}
                onCheckedChange={(checked) => setFormData({ ...formData, monthRewards: checked })}
                data-testid="switch-collaborator-month-rewards"
              />
              <Label>{t.collaborators.fields.monthRewards}</Label>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t.collaborators.fields.companyName}</Label>
              <Input
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                data-testid="input-collaborator-company-name"
              />
            </div>
            <div className="space-y-2">
              <Label>{t.collaborators.fields.ico}</Label>
              <Input
                value={formData.ico}
                onChange={(e) => setFormData({ ...formData, ico: e.target.value })}
                data-testid="input-collaborator-ico"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t.collaborators.fields.dic}</Label>
              <Input
                value={formData.dic}
                onChange={(e) => setFormData({ ...formData, dic: e.target.value })}
                data-testid="input-collaborator-dic"
              />
            </div>
            <div className="space-y-2">
              <Label>{t.collaborators.fields.icDph}</Label>
              <Input
                value={formData.icDph}
                onChange={(e) => setFormData({ ...formData, icDph: e.target.value })}
                data-testid="input-collaborator-ic-dph"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t.collaborators.fields.companyIban}</Label>
              <Input
                value={formData.companyIban}
                onChange={(e) => setFormData({ ...formData, companyIban: e.target.value })}
                data-testid="input-collaborator-company-iban"
              />
            </div>
            <div className="space-y-2">
              <Label>{t.collaborators.fields.companySwift}</Label>
              <Input
                value={formData.companySwift}
                onChange={(e) => setFormData({ ...formData, companySwift: e.target.value })}
                data-testid="input-collaborator-company-swift"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t.collaborators.fields.note}</Label>
            <Textarea
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              rows={3}
              data-testid="textarea-collaborator-note"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel-collaborator">
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save-collaborator">
              {saveMutation.isPending ? t.collaborators.saving : (collaborator ? t.collaborators.updateCollaborator : t.collaborators.createCollaborator)}
            </Button>
          </div>
        </TabsContent>

        {collaborator && (
          <>
            <TabsContent value="companyAndAddresses">
              <div className="space-y-4">
                {ADDRESS_TYPES.filter(at => at.value !== "company").map((at) => (
                  <CollapsibleAddressSection
                    key={at.value}
                    addressType={at.value}
                    title={t.collaborators.addressTabs[at.labelKey] || at.value}
                    collaboratorId={collaborator.id}
                    collaboratorName={`${collaborator.firstName} ${collaborator.lastName}`}
                    t={t}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="otherData">
              <OtherDataTab collaboratorId={collaborator.id} t={t} />
            </TabsContent>

            <TabsContent value="agreements">
              <AgreementsTab collaboratorId={collaborator.id} collaboratorCountry={collaborator.countryCode} t={t} />
            </TabsContent>

            <TabsContent value="templates">
              <Card>
                <CardHeader>
                  <CardTitle>{t.collaborators.tabs.templates}</CardTitle>
                  <CardDescription>{t.collaborators.templatesDesc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">{t.collaborators.comingSoon}</div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="rewards">
              <Card>
                <CardHeader>
                  <CardTitle>{t.collaborators.tabs.rewards}</CardTitle>
                  <CardDescription>{t.collaborators.rewardsDesc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">{t.collaborators.comingSoon}</div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="actions">
              <ActionsTab collaboratorId={collaborator.id} t={t} />
            </TabsContent>

            <TabsContent value="history">
              <HistoryTab collaboratorId={collaborator.id} t={t} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </form>
  );
}

export default function CollaboratorsPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { user } = useAuth();
  const { selectedCountries } = useCountryFilter();
  const { canAdd, canEdit } = usePermissions();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterExpiredAgreement, setFilterExpiredAgreement] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [useWizardForm, setUseWizardForm] = useState(true);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedCollaborator, setSelectedCollaborator] = useState<Collaborator | undefined>();
  const [collaboratorToDelete, setCollaboratorToDelete] = useState<Collaborator | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 30;
  
  // Sorting
  const [sortField, setSortField] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const { data: collaborators = [], isLoading, refetch: refetchCollaborators } = useQuery<Collaborator[]>({
    queryKey: ["/api/collaborators", selectedCountries.join(",")],
    queryFn: async () => {
      const params = selectedCountries.length > 0 ? `?countries=${selectedCountries.join(",")}` : "";
      const res = await fetch(`/api/collaborators${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch collaborators");
      return res.json();
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds for online status
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/collaborators/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collaborators"] });
      toast({ title: t.success.deleted });
      setIsDeleteOpen(false);
      setCollaboratorToDelete(null);
    },
    onError: () => {
      toast({ title: t.errors.deleteFailed, variant: "destructive" });
    },
  });

  // Filtered and sorted collaborators
  const filteredAndSortedCollaborators = (() => {
    // First filter
    let result = collaborators.filter((c) => {
      const nameMatch = `${c.firstName} ${c.lastName}`.toLowerCase().includes(searchQuery.toLowerCase());
      const emailMatch = c.email?.toLowerCase().includes(searchQuery.toLowerCase());
      const phoneMatch = c.phone?.toLowerCase().includes(searchQuery.toLowerCase()) || c.mobile?.toLowerCase().includes(searchQuery.toLowerCase());
      const textMatch = searchQuery === "" || nameMatch || emailMatch || phoneMatch;
      
      const countryMatch = filterCountry === "" || c.countryCode === filterCountry || (c.countryCodes && c.countryCodes.includes(filterCountry));
      const typeMatch = filterType === "" || c.collaboratorType === filterType;
      const statusMatch = filterStatus === "" || 
        (filterStatus === "active" && c.isActive) || 
        (filterStatus === "inactive" && !c.isActive);
      const expiredMatch = !filterExpiredAgreement || (c as any).hasExpiredAgreement === true;
      
      return textMatch && countryMatch && typeMatch && statusMatch && expiredMatch;
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
          aVal = a.countryCode;
          bVal = b.countryCode;
          break;
        case "type":
          aVal = (a.collaboratorType || "").toLowerCase();
          bVal = (b.collaboratorType || "").toLowerCase();
          break;
        case "status":
          aVal = a.isActive ? 1 : 0;
          bVal = b.isActive ? 1 : 0;
          break;
        case "online":
          const aOnline = a.mobileAppEnabled && a.mobileLastActiveAt && 
            new Date(a.mobileLastActiveAt).getTime() > Date.now() - 5 * 60 * 1000 ? 1 : 0;
          const bOnline = b.mobileAppEnabled && b.mobileLastActiveAt && 
            new Date(b.mobileLastActiveAt).getTime() > Date.now() - 5 * 60 * 1000 ? 1 : 0;
          aVal = aOnline;
          bVal = bOnline;
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
  })();
  
  const totalPages = Math.ceil(filteredAndSortedCollaborators.length / pageSize);
  const paginatedCollaborators = filteredAndSortedCollaborators.slice(
    (page - 1) * pageSize,
    page * pageSize
  );
  
  // Reset page when filters change
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
    setSearchQuery("");
    setFilterCountry("");
    setFilterType("");
    setFilterStatus("");
    setPage(1);
  };
  
  const hasActiveFilters = searchQuery || filterCountry || filterType || filterStatus || filterExpiredAgreement;

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

  const collaboratorExportColumns = [
    { key: 'firstName', header: t.collaborators.fields.firstName },
    { key: 'lastName', header: t.collaborators.fields.lastName },
    { key: 'countryCode', header: t.common.country },
    { key: 'collaboratorType', header: t.collaborators.fields.collaboratorType },
    { key: 'email', header: t.common.email },
    { key: 'phone', header: t.collaborators.fields.phone },
    { key: 'mobile', header: t.collaborators.fields.mobile },
    { key: 'companyName', header: t.collaborators.fields.companyName },
    { key: 'isActive', header: t.common.status },
  ];

  const getCollaboratorTypeName = (type: string | null) => {
    if (!type) return "-";
    const ct = COLLABORATOR_TYPES.find((c) => c.value === type);
    return ct ? (t.collaborators.types[ct.labelKey] || type) : type;
  };

  const handleEdit = (collaborator: Collaborator) => {
    setSelectedCollaborator(collaborator);
    setIsFormOpen(true);
  };

  const handleDelete = (collaborator: Collaborator) => {
    setCollaboratorToDelete(collaborator);
    setIsDeleteOpen(true);
  };

  const handleAddNew = () => {
    setSelectedCollaborator(undefined);
    setIsFormOpen(true);
  };

  const SortableHeader = ({ field, label }: { field: string; label: string }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 px-2 -ml-2 font-medium"
      onClick={() => toggleSort(field)}
      data-testid={`sort-collaborator-${field}`}
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

  const columns = [
    {
      key: "name",
      header: <SortableHeader field="name" label={t.common.name} />,
      cell: (c: Collaborator) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{c.firstName} {c.lastName}</span>
        </div>
      ),
    },
    {
      key: "country",
      header: <SortableHeader field="country" label={t.common.country} />,
      cell: (c: Collaborator) => {
        const countries = c.countryCodes && c.countryCodes.length > 0 ? c.countryCodes : [c.countryCode];
        return (
          <div className="flex flex-wrap gap-1">
            {countries.map((code) => (
              <Badge key={code} variant="outline" className="text-xs">
                {getCountryFlag(code)} {code}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      key: "type",
      header: <SortableHeader field="type" label={t.collaborators.fields.collaboratorType} />,
      cell: (c: Collaborator) => getCollaboratorTypeName(c.collaboratorType),
    },
    {
      key: "mobileApp",
      header: <SortableHeader field="online" label={t.common.indexusConnect} />,
      cell: (c: Collaborator) => {
        if (!c.mobileAppEnabled) {
          return <span className="text-muted-foreground">-</span>;
        }
        const isOnline = c.mobileLastActiveAt && 
          new Date(c.mobileLastActiveAt).getTime() > Date.now() - 5 * 60 * 1000;
        return (
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-primary" />
            {isOnline && (
              <Badge variant="default" className="bg-green-600 text-white text-xs px-1.5 py-0.5">
                {t.common.online}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      key: "status",
      header: <SortableHeader field="status" label={t.common.status} />,
      cell: (c: Collaborator) => (
        <div className="flex flex-wrap gap-1">
          <Badge variant={c.isActive ? "default" : "secondary"}>
            {c.isActive ? t.common.active : t.common.inactive}
          </Badge>
          {(c as any).hasExpiredAgreement && (
            <Badge variant="destructive" className="text-xs">
              {t.collaborators.expiredAgreement}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: t.common.actions,
      cell: (c: Collaborator) => (
        <div className="flex items-center gap-2">
          {canEdit("collaborators") && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleEdit(c)}
              data-testid={`button-edit-collaborator-${c.id}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {canEdit("collaborators") && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleDelete(c)}
              data-testid={`button-delete-collaborator-${c.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t.collaborators.title} description={t.collaborators.description}>
        {canAdd("collaborators") && (
          <Button onClick={handleAddNew} data-testid="button-add-collaborator">
            <Plus className="h-4 w-4 mr-2" />
            {t.collaborators.addCollaborator}
          </Button>
        )}
      </PageHeader>

      <Card>
        <CardHeader className="pb-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {filteredAndSortedCollaborators.length} {t.common.of} {collaborators.length} {t.common.records}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportToCsv(filteredAndSortedCollaborators, 'collaborators', collaboratorExportColumns)}
                  data-testid="button-export-collaborators-csv"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {t.common.exportCsv}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportToExcel(filteredAndSortedCollaborators, 'collaborators', collaboratorExportColumns)}
                  data-testid="button-export-collaborators-excel"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  {t.common.exportExcel}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchCollaborators()}
                  data-testid="button-refresh-collaborators"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {t.common.refresh}
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t.collaborators.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); handleFilterChange(); }}
                  className="pl-10"
                  data-testid="input-search-collaborators"
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
                  <Badge variant="secondary" className="ml-2">!</Badge>
                )}
              </Button>
            </div>
            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>{t.common.country}</Label>
                  <Select value={filterCountry || "_all"} onValueChange={(val) => { setFilterCountry(val === "_all" ? "" : val); handleFilterChange(); }}>
                    <SelectTrigger data-testid="select-filter-country">
                      <SelectValue placeholder={t.common.all} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">{t.common.all}</SelectItem>
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {getCountryFlag(c.code)} {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t.collaborators.fields.collaboratorType}</Label>
                  <Select value={filterType || "_all"} onValueChange={(val) => { setFilterType(val === "_all" ? "" : val); handleFilterChange(); }}>
                    <SelectTrigger data-testid="select-filter-type">
                      <SelectValue placeholder={t.common.all} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">{t.common.all}</SelectItem>
                      {COLLABORATOR_TYPES.map((ct) => (
                        <SelectItem key={ct.value} value={ct.value}>
                          {t.collaborators.types[ct.labelKey] || ct.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t.common.status}</Label>
                  <Select value={filterStatus || "_all"} onValueChange={(val) => { setFilterStatus(val === "_all" ? "" : val); handleFilterChange(); }}>
                    <SelectTrigger data-testid="select-filter-status">
                      <SelectValue placeholder={t.common.all} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">{t.common.all}</SelectItem>
                      <SelectItem value="active">{t.common.active}</SelectItem>
                      <SelectItem value="inactive">{t.common.inactive}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 flex items-end">
                  <div className="flex items-center gap-2 h-9 px-3 border rounded-md">
                    <Switch 
                      checked={filterExpiredAgreement}
                      onCheckedChange={(val) => { setFilterExpiredAgreement(val); handleFilterChange(); }}
                      data-testid="switch-filter-expired-agreement"
                    />
                    <Label className="text-sm cursor-pointer" onClick={() => { setFilterExpiredAgreement(!filterExpiredAgreement); handleFilterChange(); }}>
                      {t.collaborators.expiredAgreement}
                    </Label>
                  </div>
                </div>
              </div>
            )}
            {hasActiveFilters && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">{t.common.activeFilters}:</span>
                {filterCountry && (
                  <Badge variant="secondary" className="gap-1">
                    {getCountryFlag(filterCountry)} {getCountryName(filterCountry)}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => { setFilterCountry(""); handleFilterChange(); }} />
                  </Badge>
                )}
                {filterType && (
                  <Badge variant="secondary" className="gap-1">
                    {(() => {
                      const ct = COLLABORATOR_TYPES.find(c => c.value === filterType);
                      return ct ? (t.collaborators.types[ct.labelKey as keyof typeof t.collaborators.types] || filterType) : filterType;
                    })()}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => { setFilterType(""); handleFilterChange(); }} />
                  </Badge>
                )}
                {filterStatus && (
                  <Badge variant="secondary" className="gap-1">
                    {filterStatus === "active" ? t.common.active : t.common.inactive}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => { setFilterStatus(""); handleFilterChange(); }} />
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
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredAndSortedCollaborators.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t.collaborators.noCollaborators}
            </div>
          ) : (
            <>
              <DataTable
                columns={columns}
                data={paginatedCollaborators}
                getRowKey={(c) => c.id}
              />
              
              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    {t.common.showing} {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, filteredAndSortedCollaborators.length)} {t.common.of} {filteredAndSortedCollaborators.length}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(1)}
                      disabled={page === 1}
                      data-testid="button-collaborator-first-page"
                    >
                      {t.common.first}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                      data-testid="button-collaborator-prev-page"
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
                      data-testid="button-collaborator-next-page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(totalPages)}
                      disabled={page === totalPages}
                      data-testid="button-collaborator-last-page"
                    >
                      {t.common.last}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <DialogTitle>
                  {selectedCollaborator ? t.collaborators.editCollaborator : t.collaborators.addCollaborator}
                </DialogTitle>
                <DialogDescription>
                  {selectedCollaborator ? t.collaborators.editCollaborator : t.collaborators.addCollaborator}
                </DialogDescription>
              </div>
              {!selectedCollaborator && (
                <div className="flex items-center gap-2">
                  <Button
                    variant={useWizardForm ? "default" : "outline"}
                    size="sm"
                    onClick={() => setUseWizardForm(true)}
                    data-testid="button-wizard-mode"
                  >
                    <ListChecks className="h-4 w-4 mr-1" />
                    {t.common.wizard}
                  </Button>
                  <Button
                    variant={!useWizardForm ? "default" : "outline"}
                    size="sm"
                    onClick={() => setUseWizardForm(false)}
                    data-testid="button-simple-mode"
                  >
                    <FileEdit className="h-4 w-4 mr-1" />
                    {t.common.form}
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>
          <CollaboratorFormWizard
            initialData={selectedCollaborator || undefined}
            onSuccess={() => setIsFormOpen(false)}
            onCancel={() => setIsFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.collaborators.deleteCollaborator}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.collaborators.deleteConfirm}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-collaborator">
              {t.common.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => collaboratorToDelete && deleteMutation.mutate(collaboratorToDelete.id)}
              data-testid="button-confirm-delete-collaborator"
            >
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
