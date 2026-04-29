import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Search, User, MapPin, FileText, Award, Gift, Activity, ClipboardList, Upload, Download, Eye, X, Filter, ListChecks, FileEdit, Smartphone, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ArrowUpDown, ArrowUp, ArrowDown, FileSpreadsheet, RefreshCw, Building2, Clock, Target, Hospital, Stethoscope, ListFilter, Users, UserCheck, UserX, ShieldCheck, ShieldAlert, ShieldOff, Phone, PhoneIncoming, PhoneOutgoing, Network, Mail, Briefcase, GraduationCap, Languages, Hash, Calendar, SlidersHorizontal, TrendingUp, Sparkles } from "lucide-react";
import { CollaboratorFormWizard } from "@/components/collaborator-form-wizard";
import EntityCampaignTimeline from "@/components/campaigns/EntityCampaignTimeline";
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
import {
  EntityFilter,
  type FilterField,
  type FilterRule,
  type FilterPreset,
} from "@/components/shared/EntityFilter";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getCountryFlag, getCountryName } from "@/lib/countries";
import { REGIONS_BY_COUNTRY, getAutoRegion, getAutoDistrict, getDistrictsForRegion, getGeoLabels } from "@/lib/regions";
import { SuggestRegionButton } from "@/components/suggest-region-button";
import type { 
  Collaborator, 
  CollaboratorAddress, 
  CollaboratorOtherData, 
  CollaboratorAgreement,
  CollaboratorActivity,
  SafeUser,
  Hospital as HospitalType,
  HealthInsurance,
  BillingDetails,
  ActivityLog,
} from "@shared/schema";
import { 
  COUNTRIES, 
  WORLD_COUNTRIES,
  COLLABORATOR_TYPES, 
  MARITAL_STATUSES,
  PROFESSIONAL_CLASSIFICATIONS,
  EDUCATION_LEVELS,
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
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
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
  professionalClassification: string;
  highestEducation: string;
  workplaceName: string;
  isManager: boolean;
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
  professionalClassification: "",
  highestEducation: "",
  workplaceName: "",
  isManager: false,
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
  district: string;
  countryCode: string;
}

const defaultAddressData: AddressFormData = {
  name: "",
  streetNumber: "",
  city: "",
  postalCode: "",
  region: "",
  district: "",
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
          district: (addr as any).district || "",
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
          <Label>{getGeoLabels(formData.countryCode).region}</Label>
          <div className="flex items-center gap-1">
            <Select value={formData.region || ""} onValueChange={(value) => setFormData({ ...formData, region: value, district: "" })}>
              <SelectTrigger data-testid={`select-address-${addressType}-region`}><SelectValue placeholder={getGeoLabels(formData.countryCode).region} /></SelectTrigger>
              <SelectContent>
                {(REGIONS_BY_COUNTRY[formData.countryCode] || []).map((r: string) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
                {formData.region && !(REGIONS_BY_COUNTRY[formData.countryCode] || []).includes(formData.region) && (
                  <SelectItem value={formData.region}>{formData.region}</SelectItem>
                )}
              </SelectContent>
            </Select>
            <SuggestRegionButton
              countryCode={formData.countryCode}
              city={formData.city}
              streetNumber={formData.streetNumber}
              postalCode={formData.postalCode}
              size="icon"
              onSuggestion={(region, district) => setFormData({ ...formData, region, district })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>{getGeoLabels(formData.countryCode).district}</Label>
          <Select value={formData.district || ""} onValueChange={(value) => setFormData({ ...formData, district: value })}>
            <SelectTrigger data-testid={`select-address-${addressType}-district`}><SelectValue placeholder={getGeoLabels(formData.countryCode).district} /></SelectTrigger>
            <SelectContent>
              {getDistrictsForRegion(formData.countryCode, formData.region, formData.district).map((d: string) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
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
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{editingId ? t.collaborators.editAgreement || "Dohoda" : t.common.add}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-[1fr,auto]">
            <div className="space-y-4">
              <div className="grid gap-3 grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">{t.collaborators.fields.billingCompany}</Label>
                  <Select
                    value={formData.billingCompanyId || "_none"}
                    onValueChange={(value) => setFormData({ ...formData, billingCompanyId: value === "_none" ? "" : value })}
                  >
                    <SelectTrigger data-testid="select-agreement-billing" className="h-8">
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
                <div className="space-y-1">
                  <Label className="text-xs">{t.collaborators.fields.contractNumber}</Label>
                  <Input
                    value={formData.contractNumber}
                    onChange={(e) => setFormData({ ...formData, contractNumber: e.target.value })}
                    data-testid="input-agreement-contract"
                    className="h-8"
                  />
                </div>
              </div>
              <div className="grid gap-3 grid-cols-2">
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
              <div className="grid gap-3 grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">{t.collaborators.fields.agreementForm}</Label>
                  <Input
                    value={formData.agreementForm}
                    onChange={(e) => setFormData({ ...formData, agreementForm: e.target.value })}
                    data-testid="input-agreement-form"
                    className="h-8"
                  />
                </div>
                <div className="flex items-center space-x-2 pt-5">
                  <Switch
                    checked={formData.isValid}
                    onCheckedChange={(checked) => setFormData({ ...formData, isValid: checked })}
                    data-testid="switch-agreement-valid"
                  />
                  <Label className="text-xs">{t.collaborators.fields.isValid}</Label>
                </div>
              </div>
              <div className="grid gap-3 grid-cols-2">
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
            </div>

            <div className="md:border-l md:pl-4 space-y-1 min-w-[200px]">
              <Label className="text-xs font-semibold mb-2 block">{t.collaborators.fields.rewardTypes}</Label>
              {REWARD_TYPES.map((rt) => (
                <label
                  key={rt.value}
                  className="flex items-center gap-2 cursor-pointer text-xs py-0.5 hover:bg-muted/50 rounded px-1"
                  data-testid={`checkbox-reward-${rt.value}`}
                >
                  <input
                    type="checkbox"
                    checked={formData.rewardTypes.includes(rt.value)}
                    onChange={() => toggleRewardType(rt.value)}
                    className="h-3.5 w-3.5 rounded border-gray-300"
                  />
                  {t.collaborators.rewardTypes[rt.labelKey] || rt.value}
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsAddingNew(false);
                setEditingId(null);
                resetForm();
              }}
              data-testid="button-cancel-agreement"
            >
              {t.common.cancel}
            </Button>
            <Button size="sm" onClick={() => saveMutation.mutate(formData)} disabled={saveMutation.isPending} data-testid="button-save-agreement">
              {saveMutation.isPending ? t.common.loading : t.common.save}
            </Button>
          </div>
        </CardContent>
      </Card>
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="table-agreements">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-2 font-medium">{t.collaborators.fields.billingCompany}</th>
                <th className="text-left p-2 font-medium">{t.collaborators.fields.contractNumber}</th>
                <th className="text-left p-2 font-medium">{t.collaborators.fields.validFrom}</th>
                <th className="text-left p-2 font-medium">{t.collaborators.fields.validTo}</th>
                <th className="text-left p-2 font-medium">{t.collaborators.fields.agreementSent}</th>
                <th className="text-left p-2 font-medium">{t.collaborators.fields.agreementReturned}</th>
                <th className="text-left p-2 font-medium">{t.collaborators.fields.isValid}</th>
                <th className="p-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {agreements.map((agreement) => (
                <tr
                  key={agreement.id}
                  className="border-b hover:bg-blue-50 dark:hover:bg-blue-950/30 cursor-pointer transition-colors"
                  onClick={() => handleEdit(agreement)}
                  data-testid={`row-agreement-${agreement.id}`}
                >
                  <td className="p-2">{getBillingCompanyName(agreement.billingCompanyId)}</td>
                  <td className="p-2 font-mono text-xs">{agreement.contractNumber || "-"}</td>
                  <td className="p-2">{formatDate(agreement.validFromDay, agreement.validFromMonth, agreement.validFromYear)}</td>
                  <td className="p-2">{formatDate(agreement.validToDay, agreement.validToMonth, agreement.validToYear)}</td>
                  <td className="p-2">{formatDate(agreement.agreementSentDay, agreement.agreementSentMonth, agreement.agreementSentYear)}</td>
                  <td className="p-2">{formatDate(agreement.agreementReturnedDay, agreement.agreementReturnedMonth, agreement.agreementReturnedYear)}</td>
                  <td className="p-2">
                    <Badge variant={agreement.isValid ? "default" : "secondary"}>
                      {agreement.isValid ? t.common.active : t.common.inactive}
                    </Badge>
                  </td>
                  <td className="p-2">
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); handleEdit(agreement); }}
                        data-testid={`button-edit-agreement-${agreement.id}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(agreement.id); }}
                        data-testid={`button-delete-agreement-${agreement.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 text-xs text-muted-foreground">
            {agreements.length} {agreements.length === 1 ? "dohoda" : agreements.length < 5 ? "dohody" : "dohôd"}
          </div>
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
  const { data: activities = [], isLoading } = useQuery<CollaboratorActivity[]>({
    queryKey: ["/api/collaborators", collaboratorId, "activities"],
    queryFn: async () => {
      const res = await fetch(`/api/collaborators/${collaboratorId}/activities`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!collaboratorId,
  });

  const formatDate = (date: string | Date | null) => {
    if (!date) return "-";
    const d = new Date(date);
    return d.toLocaleDateString("sk");
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
        {activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground" data-testid="text-no-activities">{t.common.noData}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-activities">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium">Typ</th>
                  <th className="text-left p-2 font-medium">Detail</th>
                  <th className="text-left p-2 font-medium">Dátum</th>
                  <th className="text-left p-2 font-medium">Info</th>
                  <th className="text-left p-2 font-medium">Hodnota</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((act: any) => (
                  <tr key={act.id} className="border-b hover:bg-muted/50" data-testid={`row-activity-${act.id}`}>
                    <td className="p-2">
                      {act.isCall ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          {act.callDirection === "inbound" ? <PhoneIncoming className="h-3 w-3" /> : <PhoneOutgoing className="h-3 w-3" />}
                          {act.name || "Hovor"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {act.name || "-"}
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-muted-foreground">
                      {act.isCall ? (act.publicNote || "-") : (act.internalNote || "-")}
                    </td>
                    <td className="p-2">{formatDate(act.dueDate)}</td>
                    <td className="p-2 font-mono text-xs">
                      {act.isCall ? (act.internalNote || "-") : (act.publicNote || "-")}
                    </td>
                    <td className="p-2">
                      {act.isCall ? (
                        <span className={`text-xs ${act.callStatus === "answered" ? "text-green-600 dark:text-green-400" : act.callStatus === "missed" ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                          {act.callStatus === "answered" ? "Zodvihnutý" : act.callStatus === "missed" ? "Zmeškaný" : act.callStatus || "-"}
                        </span>
                      ) : act.amount ? (
                        <span className="text-green-600 dark:text-green-400">
                          {act.amount} {act.currency || ""}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 text-xs text-muted-foreground" data-testid="text-activities-count">
              {activities.length} {activities.length === 1 ? "záznam" : activities.length < 5 ? "záznamy" : "záznamov"}
            </div>
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
          professionalClassification: collaborator.professionalClassification || "",
          highestEducation: collaborator.highestEducation || "",
          workplaceName: collaborator.workplaceName || "",
          isManager: collaborator.isManager || false,
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

  const { data: hospitals = [] } = useQuery<any[]>({
    queryKey: ["/api/hospitals/lookup"],
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
      queryClient.invalidateQueries({ queryKey: ["/api/collaborators/stats"] });
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
              <TabsTrigger value="campaigns" data-testid="form-tab-campaigns">
                <Target className="h-4 w-4 mr-2" />
                Kampane
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

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t.collaborators.fields.professionalClassification}</Label>
              <Select
                value={formData.professionalClassification || "_none"}
                onValueChange={(value) => setFormData({ ...formData, professionalClassification: value === "_none" ? "" : value })}
              >
                <SelectTrigger data-testid="select-collaborator-professional-classification">
                  <SelectValue placeholder={t.collaborators.fields.professionalClassification} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">{t.common.noData}</SelectItem>
                  {PROFESSIONAL_CLASSIFICATIONS.map((pc) => (
                    <SelectItem key={pc.value} value={pc.value}>
                      {(t.collaborators.professionalClassifications as Record<string, string>)[pc.labelKey] || pc.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t.collaborators.fields.highestEducation}</Label>
              <Select
                value={formData.highestEducation || "_none"}
                onValueChange={(value) => setFormData({ ...formData, highestEducation: value === "_none" ? "" : value })}
              >
                <SelectTrigger data-testid="select-collaborator-highest-education">
                  <SelectValue placeholder={t.collaborators.fields.highestEducation} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">{t.common.noData}</SelectItem>
                  {EDUCATION_LEVELS.map((el) => (
                    <SelectItem key={el.value} value={el.value}>
                      {(t.collaborators.educationLevels as Record<string, string>)[el.labelKey] || el.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>{t.collaborators.fields.workplaceName}</Label>
              <Input
                value={formData.workplaceName}
                onChange={(e) => setFormData({ ...formData, workplaceName: e.target.value })}
                placeholder={t.collaborators.fields.workplaceName}
                data-testid="input-collaborator-workplace-name"
              />
              <p className="text-xs text-muted-foreground">{t.collaborators.fields.workplaceNameDesc}</p>
            </div>
            <div className="flex items-center space-x-2 pt-2">
              <Switch
                checked={formData.isManager}
                onCheckedChange={(checked) => setFormData({ ...formData, isManager: checked })}
                data-testid="switch-collaborator-is-manager"
              />
              <Label>{t.collaborators.fields.isManager}</Label>
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
            {!positionScope && !excludeScope && (
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.svetZdravia}
                  onCheckedChange={(checked) => setFormData({ ...formData, svetZdravia: checked })}
                  data-testid="switch-collaborator-svet-zdravia"
                />
                <Label>{t.collaborators.fields.svetZdravia}</Label>
              </div>
            )}
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

            <TabsContent value="campaigns">
              <EntityCampaignTimeline entityType="collaborator" entityId={collaborator.id} entityName={`${collaborator.titleBefore || ""} ${collaborator.firstName} ${collaborator.lastName}`.trim()} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </form>
  );
}

export function CollaboratorsContent({ embedded = false, positionScope, excludeScope, addButtonLabel }: { embedded?: boolean; positionScope?: string; excludeScope?: string; addButtonLabel?: string }) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const { user } = useAuth();
  const { selectedCountries } = useCountryFilter();
  const { canAdd, canEdit } = usePermissions();
  const [searchQuery, setSearchQuery] = useState("");

  // ── Unified filter rules state (primary source of truth) ──────────────
  // All filter fields (country / type / status / agreement / partnerCategory /
  // isManager / mobileApp / svetZdravia / email / mobile / phone …) live in
  // a single FilterRule[] array. Single-value variables below are derived for
  // backwards-compat with API params and stat-card highlighting.
  const [filterRules, setFilterRules] = useState<FilterRule[]>([]);
  const [activeView, setActiveView] = useState<{ id: string; name: string } | null>(null);
  // Clear country rule when global country filter changes
  useEffect(() => {
    setFilterRules((prev) => prev.filter((r) => r.field !== "country"));
  }, [selectedCountries]);

  const getRuleValue = useCallback(
    (field: string): string => {
      const r = filterRules.find(
        (x) => x.field === field && (x.op === "is" || x.op === "isAny"),
      );
      if (!r) return "";
      const v = Array.isArray(r.value) ? r.value[0] || "" : r.value;
      return v;
    },
    [filterRules],
  );

  const filterCountry = getRuleValue("country");
  const filterType = getRuleValue("type");
  const filterStatus = getRuleValue("status");
  const filterAgreement = getRuleValue("agreement");

  /** Replace (or remove) a single-value rule for the given field, then reset page. */
  const setSingleRuleValue = useCallback(
    (field: string, value: string) => {
      setFilterRules((prev) => {
        const next = prev.filter((r) => r.field !== field);
        if (value) {
          next.push({
            id: `r-${field}-${Date.now().toString(36)}`,
            conjunction: "and",
            field,
            op: "is",
            value,
          });
        }
        return next;
      });
      setPage(1);
    },
    [],
  );
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [useWizardForm, setUseWizardForm] = useState(true);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedCollaborator, setSelectedCollaborator] = useState<Collaborator | undefined>();
  const [collaboratorToDelete, setCollaboratorToDelete] = useState<Collaborator | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 50;
  
  // Sorting
  const [sortField, setSortField] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const collabQueryParams: Record<string, any> = { page, limit: pageSize };
  if (debouncedSearch) collabQueryParams.search = debouncedSearch;
  if (filterCountry) collabQueryParams.country = filterCountry;
  if (selectedCountries.length > 0) collabQueryParams.countries = selectedCountries.join(",");
  if (filterStatus) collabQueryParams.status = filterStatus;
  if (filterType) collabQueryParams.type = filterType;
  if (filterAgreement) collabQueryParams.agreement = filterAgreement;
  if (positionScope) collabQueryParams.positionScope = positionScope;
  if (excludeScope) collabQueryParams.excludeScope = excludeScope;
  const { data: collaboratorsPaginatedResult, isLoading, refetch: refetchCollaborators } = useQuery<{ data: Collaborator[], total: number }>({
    queryKey: ["/api/collaborators", collabQueryParams],
    refetchInterval: 60000,
  });
  const collaborators = collaboratorsPaginatedResult?.data || [];
  const serverCollaboratorsTotal = collaboratorsPaginatedResult?.total || 0;

  const { data: partnerCategoriesList = [] } = useQuery<any[]>({
    queryKey: ["/api/mpn/categories"],
  });
  const { data: networkMemberships = [] } = useQuery<any[]>({
    queryKey: ["/api/hospital-network-memberships"],
  });
  const partnerCategoryMap = useMemo(() => {
    const map: Record<string, any> = {};
    partnerCategoriesList.forEach((cat: any) => { map[cat.id] = cat; });
    return map;
  }, [partnerCategoriesList]);

  const statsParams: Record<string, string> = {};
  if (positionScope) statsParams.positionScope = positionScope;
  if (excludeScope) statsParams.excludeScope = excludeScope;
  const statsQs = Object.keys(statsParams).length > 0 ? "?" + new URLSearchParams(statsParams).toString() : "";
  const { data: collabStats } = useQuery<{
    total: number; active: number; inactive: number;
    validAgreement: number; expiredAgreement: number; noAgreement: number;
    types: Record<string, number>;
    categories: Record<string, number>;
  }>({
    queryKey: ["/api/collaborators/stats", statsParams],
    queryFn: async () => { const res = await fetch(`/api/collaborators/stats${statsQs}`, { credentials: "include" }); if (!res.ok) throw new Error("Failed"); return res.json(); },
    refetchInterval: 120000,
    staleTime: 60000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/collaborators/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collaborators"] });
      queryClient.invalidateQueries({ queryKey: ["/api/collaborators/stats"] });
      toast({ title: t.success.deleted });
      setIsDeleteOpen(false);
      setCollaboratorToDelete(null);
    },
    onError: () => {
      toast({ title: t.errors.deleteFailed, variant: "destructive" });
    },
  });

  const filteredAndSortedCollaborators = (() => {
    let result = [...collaborators];

    // ── Client-side filter ──────────────────────────────────────────────
    // Server only handles a SINGLE equality (op="is"/"isAny" with a single
    // string value) per server field via collabQueryParams. Anything else
    // (multi-value isAny, isNot, isEmpty/isNotEmpty, plus any rule on a
    // non-server field) must be applied here so the UI never shows a chip
    // that has no effect.
    const isHandledByServer = (r: FilterRule): boolean => {
      if (!["country", "type", "status", "agreement"].includes(r.field)) return false;
      if (r.op !== "is" && r.op !== "isAny") return false;
      if (Array.isArray(r.value)) return r.value.length === 1 && !!r.value[0];
      return !!r.value;
    };
    const clientRules = filterRules.filter((r) => !isHandledByServer(r));
    if (clientRules.length > 0) {
      const matchRule = (c: any, r: FilterRule): boolean => {
        const isEq = r.op === "is" || r.op === "isAny";
        const isNeq = r.op === "isNot";
        const contains = r.op === "contains";
        const isEmpty = r.op === "isEmpty";
        const isNotEmpty = r.op === "isNotEmpty";

        const get = (): string => {
          switch (r.field) {
            // server fields (also evaluated client-side for unsupported ops)
            case "country": return c.countryCode || c.country || "";
            case "type": return c.collaboratorType || "";
            case "status": return c.isActive ? "active" : "inactive";
            case "agreement":
              if (c.hasValidAgreement) return "valid";
              if (c.hasExpiredAgreement) return "expired";
              if (c.hasNoAgreement) return "none";
              return "";
            // pure client fields
            case "partnerCategory": return c.partnerCategory || "";
            case "isManager": return c.isManager ? "true" : "false";
            case "mobileApp": return c.mobileAppEnabled ? "true" : "false";
            case "svetZdravia": return c.svetZdravia ? "true" : "false";
            // contact
            case "email": return c.email || "";
            case "mobile": return c.mobile || "";
            case "phone": return c.phone || "";
            // personal info
            case "firstName": return c.firstName || "";
            case "lastName": return c.lastName || "";
            case "birthYear": return c.birthYear ? String(c.birthYear) : "";
            case "birthPlace": return c.birthPlace || "";
            case "workplaceName": return c.workplaceName || "";
            case "highestEducation": return c.highestEducation || "";
            case "preferredLanguage": return c.preferredLanguage || "";
            // company
            case "companyName": return c.companyName || "";
            case "ico": return c.ico || "";
            case "dic": return c.dic || "";
            // address (derived from primary address on backend)
            case "addressCity": return c.addressCity || "";
            case "addressDistrict": return c.addressDistrict || "";
            case "addressRegion": return c.addressRegion || "";
            case "addressPostalCode": return c.addressPostalCode || "";
            case "addressStreet": return c.addressStreet || "";
            default: return "";
          }
        };
        const fieldVal = String(get());

        // Boolean fields use literal "true"/"false" — treat them as never-empty
        const isBoolField = ["isManager", "mobileApp", "svetZdravia"].includes(r.field);
        if (isEmpty) {
          if (isBoolField) return fieldVal === "false";
          return !fieldVal;
        }
        if (isNotEmpty) {
          if (isBoolField) return fieldVal === "true";
          return !!fieldVal;
        }
        if (contains) {
          if (Array.isArray(r.value)) {
            return r.value.some((v) => v && fieldVal.toLowerCase().includes(String(v).toLowerCase()));
          }
          return r.value ? fieldVal.toLowerCase().includes(String(r.value).toLowerCase()) : true;
        }
        if (isEq) {
          if (Array.isArray(r.value)) {
            return r.value.some((v) => v && fieldVal === v);
          }
          return r.value ? fieldVal === r.value : true;
        }
        if (isNeq) {
          if (Array.isArray(r.value)) {
            return r.value.every((v) => !v || fieldVal !== v);
          }
          return r.value ? fieldVal !== r.value : true;
        }
        return true;
      };
      // AND across all rules
      result = result.filter((c) => clientRules.every((r) => matchRule(c, r)));
    }

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
  
  const totalPages = Math.ceil(serverCollaboratorsTotal / pageSize);
  const paginatedCollaborators = filteredAndSortedCollaborators;
  
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
    setFilterRules([]);
    setPage(1);
  };

  const hasActiveFilters = !!searchQuery || filterRules.length > 0;

  // ── EntityFilter (Variant C) — rules are the primary filter state ──
  const handleRulesChange = useCallback((newRules: FilterRule[]) => {
    setFilterRules(newRules);
    setPage(1);
  }, []);

  // Fields the backend can filter (server-side via /api/collaborators query params)
  const SERVER_FIELDS = useMemo(
    () => new Set(["country", "type", "status", "agreement"]),
    [],
  );

  // Translation helper for boolean field labels
  const _yes = (t.common as any).yes || "Yes";
  const _no = (t.common as any).no || "No";

  const filterFields: FilterField[] = useMemo(() => {
    const partnerCategoryOptions = (partnerCategoriesList || [])
      .filter((c: any) => !positionScope || c.entityScope === positionScope)
      .map((c: any) => ({ label: c.name, value: c.id }));

    return [
      {
        key: "country",
        label: t.common.country,
        icon: MapPin,
        type: "select",
        options: COUNTRIES.map((c) => ({
          label: `${getCountryFlag(c.code)} ${c.name}`,
          value: c.code,
        })),
      },
      {
        key: "type",
        label: t.collaborators.fields.collaboratorType,
        icon: Stethoscope,
        type: "select",
        options: COLLABORATOR_TYPES.map((ct) => ({
          label:
            t.collaborators.types[ct.labelKey as keyof typeof t.collaborators.types] ||
            ct.value,
          value: ct.value,
        })),
      },
      {
        key: "status",
        label: t.common.status,
        icon: Activity,
        type: "select",
        options: [
          { label: t.common.active, value: "active" },
          { label: t.common.inactive, value: "inactive" },
        ],
      },
      {
        key: "agreement",
        label: (t.collaborators as any).agreement || "Agreement",
        icon: FileText,
        type: "select",
        options: [
          { label: (t.collaborators as any).validAgreement || "Valid agreement", value: "valid" },
          { label: t.collaborators.expiredAgreement, value: "expired" },
          { label: (t.collaborators as any).noAgreement || "No agreement", value: "none" },
        ],
      },
      {
        key: "partnerCategory",
        label: (t.collaborators as any).partnerCategory || "Partner category",
        icon: Award,
        type: "select",
        options: partnerCategoryOptions,
      },
      {
        key: "isManager",
        label: (t.collaborators as any).manager || "Manager",
        icon: UserCheck,
        type: "select",
        options: [
          { label: _yes, value: "true" },
          { label: _no, value: "false" },
        ],
      },
      {
        key: "mobileApp",
        label: t.common.indexusConnect || "INDEXUS Connect",
        icon: Smartphone,
        type: "select",
        options: [
          { label: _yes, value: "true" },
          { label: _no, value: "false" },
        ],
      },
      {
        key: "svetZdravia",
        label: "Svet zdravia",
        icon: ShieldCheck,
        type: "select",
        options: [
          { label: _yes, value: "true" },
          { label: _no, value: "false" },
        ],
      },
      // ── Personal info ────────────────────────────────────────────────
      {
        key: "firstName",
        label: (t.collaborators.fields as any).firstName || (locale === "sk" ? "Krstné meno" : "First name"),
        icon: User,
        type: "text",
      },
      {
        key: "lastName",
        label: (t.collaborators.fields as any).lastName || (locale === "sk" ? "Priezvisko" : "Last name"),
        icon: User,
        type: "text",
      },
      {
        key: "birthYear",
        label: locale === "sk" ? "Rok narodenia" : "Birth year",
        icon: Calendar,
        type: "text",
      },
      {
        key: "birthPlace",
        label: locale === "sk" ? "Miesto narodenia" : "Birth place",
        icon: MapPin,
        type: "text",
      },
      {
        key: "workplaceName",
        label: locale === "sk" ? "Pracovisko" : "Workplace",
        icon: Briefcase,
        type: "text",
      },
      {
        key: "highestEducation",
        label: locale === "sk" ? "Vzdelanie" : "Education",
        icon: GraduationCap,
        type: "text",
      },
      {
        key: "preferredLanguage",
        label: locale === "sk" ? "Preferovaný jazyk" : "Preferred language",
        icon: Languages,
        type: "select",
        options: [
          { label: "Slovenčina", value: "sk" },
          { label: "English", value: "en" },
          { label: "Čeština", value: "cs" },
          { label: "Deutsch", value: "de" },
          { label: "Italiano", value: "it" },
          { label: "Română", value: "ro" },
          { label: "Magyar", value: "hu" },
        ],
      },
      // ── Company info ─────────────────────────────────────────────────
      {
        key: "companyName",
        label: locale === "sk" ? "Názov firmy" : "Company name",
        icon: Building2,
        type: "text",
      },
      {
        key: "ico",
        label: "IČO",
        icon: Hash,
        type: "text",
      },
      {
        key: "dic",
        label: "DIČ",
        icon: Hash,
        type: "text",
      },
      // ── Contact ──────────────────────────────────────────────────────
      {
        key: "email",
        label: t.common.email,
        icon: Mail,
        type: "text",
      },
      {
        key: "mobile",
        label: (t.collaborators.fields as any).mobile || "Mobile",
        icon: Smartphone,
        type: "text",
      },
      {
        key: "phone",
        label: t.common.phone,
        icon: Phone,
        type: "text",
      },
      // ── Address ──────────────────────────────────────────────────────
      {
        key: "addressCity",
        label: locale === "sk" ? "Mesto" : "City",
        icon: MapPin,
        type: "text",
      },
      {
        key: "addressDistrict",
        label: locale === "sk" ? "Okres" : "District",
        icon: MapPin,
        type: "text",
      },
      {
        key: "addressRegion",
        label: locale === "sk" ? "Kraj" : "Region",
        icon: MapPin,
        type: "text",
      },
      {
        key: "addressPostalCode",
        label: locale === "sk" ? "PSČ" : "Postal code",
        icon: Hash,
        type: "text",
      },
      {
        key: "addressStreet",
        label: locale === "sk" ? "Ulica" : "Street",
        icon: MapPin,
        type: "text",
      },
    ];
  }, [t, locale, partnerCategoriesList, positionScope, _yes, _no]);

  const filterPresets: FilterPreset[] = useMemo(() => {
    const sk = locale === "sk";
    return [
      {
        id: "active-doctors",
        label: sk ? "Aktívni lekári" : "Active doctors",
        icon: UserCheck,
        rules: [
          { id: "p1a", conjunction: "and", field: "status", op: "is", value: "active" },
          { id: "p1b", conjunction: "and", field: "type", op: "is", value: "doctor" },
        ],
      },
      {
        id: "expired-agreement",
        label: sk ? "Vypršané zmluvy" : "Expired agreements",
        icon: ShieldAlert,
        rules: [
          { id: "p2", conjunction: "and", field: "agreement", op: "is", value: "expired" },
        ],
      },
      {
        id: "no-agreement",
        label: sk ? "Bez zmluvy" : "No agreement",
        icon: ShieldOff,
        rules: [
          { id: "p3", conjunction: "and", field: "agreement", op: "is", value: "none" },
        ],
      },
      {
        id: "inactive",
        label: sk ? "Neaktívni" : "Inactive",
        icon: UserX,
        rules: [
          { id: "p4", conjunction: "and", field: "status", op: "is", value: "inactive" },
        ],
      },
      {
        id: "mobile-enabled",
        label: sk ? "S mobilnou aplikáciou" : "With mobile app",
        icon: Smartphone,
        rules: [
          { id: "p5", conjunction: "and", field: "mobileApp", op: "is", value: "true" },
        ],
      },
    ];
  }, [locale]);

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
      cell: (c: Collaborator) => {
        const hCount = (c as any).hospitalCount || 0;
        const cCount = (c as any).clinicCount || 0;
        return (
          <div className="flex items-center gap-2">
            <span className="font-medium">{c.firstName} {c.lastName}</span>
            {(c as any).dataSource === 'iscbc' && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
                ISCBC
              </Badge>
            )}
            {hCount > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5 bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800" data-testid={`badge-hospitals-${c.id}`}>
                <Hospital className="h-2.5 w-2.5" />
                {hCount}
              </Badge>
            )}
            {cCount > 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5 bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800" data-testid={`badge-clinics-${c.id}`}>
                <Stethoscope className="h-2.5 w-2.5" />
                {cCount}
              </Badge>
            )}
            {(() => {
              const nets = networkMemberships.filter((m: any) => m.collaborator_id === c.id).map((m: any) => m.network_name).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i);
              return nets.map((netName: string) => (
                <Badge key={netName} className="text-[10px] px-1.5 py-0 font-bold bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/60 dark:text-amber-300 dark:border-amber-700" data-testid={`badge-network-${c.id}`}>
                  <Network className="h-2.5 w-2.5 mr-0.5" />
                  {netName}
                </Badge>
              ));
            })()}
          </div>
        );
      },
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
      key: "partnerCategory",
      header: "Position",
      cell: (c: Collaborator) => {
        const cat = (c as any).partnerCategory;
        if (!cat) return <span className="text-muted-foreground text-xs">-</span>;
        const resolved = partnerCategoryMap[cat];
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cat);
        const SLUG_LABELS: Record<string, string> = {
          key_opinion_leader: "KOL", strategic_partner: "Strategic Partner", referral_source: "Referral Source",
          training_partner: "Training Partner", hospital_director: "Hospital Director", department_head: "Dept. Head",
          department_doctor: "Dept. Doctor", department_nurse: "Dept. Nurse", head_nurse: "Head Nurse",
          delivery_midwife: "Midwife", neonatology_head: "Neo. Head", neonatology_doctor: "Neo. Doctor",
          neonatology_nurse: "Neo. Nurse", gynecologist: "Gynecologist", ambulant_gynecologist: "Amb. Gynecologist",
          pediatrician: "Pediatrician", prenatal_instructor: "Prenatal Instructor", doula: "Doula",
          lactation_consultant: "Lactation Consultant", chief_physician: "Chief Physician",
          attending_physician: "Attending Physician", nurse: "Nurse", midwife: "Midwife",
          obstetrician: "Obstetrician", neonatologist: "Neonatologist", inactive_prospect: "Inactive",
          active_prospect: "Active Prospect",
        };
        let displayName: string;
        if (isUuid && resolved) {
          const localeMap: Record<string, string | null> = {
            sk: resolved.nameSk || resolved.name_sk, cs: resolved.nameCs || resolved.name_cs,
            en: resolved.nameEn || resolved.name_en, hu: resolved.nameHu || resolved.name_hu,
            ro: resolved.nameRo || resolved.name_ro, it: resolved.nameIt || resolved.name_it,
            de: resolved.nameDe || resolved.name_de,
          };
          displayName = localeMap[locale] || resolved.name || cat;
        } else if (isUuid) {
          displayName = cat.substring(0, 8) + "…";
        } else {
          displayName = SLUG_LABELS[cat] || cat.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase());
        }
        return (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 font-medium border bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600">
            {displayName}
          </Badge>
        );
      },
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
    <div className={embedded ? "space-y-4" : "space-y-6"}>
      {!embedded && (() => {
        const sk = locale === "sk";
        const total = collabStats?.total ?? 0;
        const visible = filteredAndSortedCollaborators?.length ?? (serverCollaboratorsTotal ?? total);
        const showCount = !!collabStats;
        return (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight" data-testid="page-title">
                {t.collaborators.title}
              </h1>
              {showCount ? (
                <p className="text-sm text-muted-foreground mt-0.5" data-testid="text-header-count">
                  <span className="font-semibold text-foreground">{visible.toLocaleString(sk ? "sk-SK" : "en-US")}</span>
                  <span className="mx-1">{sk ? "z" : "of"}</span>
                  <span className="font-medium text-foreground">{total.toLocaleString(sk ? "sk-SK" : "en-US")}</span>
                  <span className="ml-1">{sk ? "osôb" : "persons"}</span>
                  {activeView && (
                    <>
                      <span className="mx-2 text-muted-foreground/60">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-amber-500" />
                        <span className="text-muted-foreground">{sk ? "pohľad:" : "view:"}</span>
                        <span className="font-medium text-foreground">{activeView.name}</span>
                      </span>
                    </>
                  )}
                </p>
              ) : (
                <p className="text-muted-foreground mt-1 text-sm">{t.collaborators.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5"
                    data-testid="button-export-collaborators"
                    title={sk ? "Exportovať" : "Export"}
                  >
                    <Download className="h-4 w-4" />
                    <span>{sk ? "Export" : "Export"}</span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem
                    onClick={() => exportToCsv(filteredAndSortedCollaborators, 'collaborators', collaboratorExportColumns)}
                    data-testid="button-export-collaborators-csv"
                    className="gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    <span>{t.common.exportCsv}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => exportToExcel(filteredAndSortedCollaborators, 'collaborators', collaboratorExportColumns)}
                    data-testid="button-export-collaborators-excel"
                    className="gap-2"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    <span>{t.common.exportExcel}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => { refetchCollaborators(); queryClient.invalidateQueries({ queryKey: ["/api/collaborators/stats"] }); }}
                data-testid="button-refresh-collaborators"
                title={t.common.refresh}
                aria-label={t.common.refresh}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              {canAdd("collaborators") && (
                <Button
                  onClick={handleAddNew}
                  className="h-9 bg-red-700 hover:bg-red-800 text-white"
                  size="sm"
                  data-testid="button-add-collaborator"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  {addButtonLabel || t.collaborators.addCollaborator}
                </Button>
              )}
            </div>
          </div>
        );
      })()}

      {!isLoading && collabStats && (() => {
        const sk = locale === "sk";
        const filteredCount = serverCollaboratorsTotal ?? collabStats.total;
        const isFiltered = filteredCount !== collabStats.total;
        const fmt = (n: number) => n.toLocaleString(sk ? "sk-SK" : "en-US");
        // Static color tokens — Tailwind JIT must see literal class names
        const COLOR: Record<string, { active: string; idle: string; icon: string; text: string }> = {
          emerald: {
            active: "bg-emerald-500/15 dark:bg-emerald-500/25 ring-1 ring-emerald-500/50 shadow-sm",
            idle: "bg-white/70 dark:bg-slate-800/50 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/15 hover:ring-1 hover:ring-emerald-500/30",
            icon: "text-emerald-600 dark:text-emerald-400",
            text: "text-emerald-700 dark:text-emerald-300",
          },
          rose: {
            active: "bg-rose-500/15 dark:bg-rose-500/25 ring-1 ring-rose-500/50 shadow-sm",
            idle: "bg-white/70 dark:bg-slate-800/50 hover:bg-rose-500/10 dark:hover:bg-rose-500/15 hover:ring-1 hover:ring-rose-500/30",
            icon: "text-rose-600 dark:text-rose-400",
            text: "text-rose-700 dark:text-rose-300",
          },
          green: {
            active: "bg-green-500/15 dark:bg-green-500/25 ring-1 ring-green-500/50 shadow-sm",
            idle: "bg-white/70 dark:bg-slate-800/50 hover:bg-green-500/10 dark:hover:bg-green-500/15 hover:ring-1 hover:ring-green-500/30",
            icon: "text-green-600 dark:text-green-400",
            text: "text-green-700 dark:text-green-300",
          },
          amber: {
            active: "bg-amber-500/15 dark:bg-amber-500/25 ring-1 ring-amber-500/50 shadow-sm",
            idle: "bg-white/70 dark:bg-slate-800/50 hover:bg-amber-500/10 dark:hover:bg-amber-500/15 hover:ring-1 hover:ring-amber-500/30",
            icon: "text-amber-600 dark:text-amber-400",
            text: "text-amber-700 dark:text-amber-300",
          },
          slate: {
            active: "bg-slate-500/15 dark:bg-slate-500/25 ring-1 ring-slate-500/50 shadow-sm",
            idle: "bg-white/70 dark:bg-slate-800/50 hover:bg-slate-500/10 dark:hover:bg-slate-500/15 hover:ring-1 hover:ring-slate-500/30",
            icon: "text-slate-600 dark:text-slate-400",
            text: "text-slate-700 dark:text-slate-300",
          },
        };
        const Toggle = ({ id, label, count, active, onClick, color, Icon }: any) => {
          const c = COLOR[color];
          return (
            <button
              type="button"
              onClick={onClick}
              data-testid={id}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 ${active ? c.active : c.idle}`}
            >
              <Icon className={`h-4 w-4 ${c.icon}`} />
              <div className="flex flex-col items-start leading-tight text-left">
                <span className={`text-sm font-bold ${c.text}`}>{fmt(count)}</span>
                <span className="text-[10.5px] text-muted-foreground font-medium">{label}</span>
              </div>
            </button>
          );
        };
        return (
          <div
            className="relative overflow-hidden rounded-2xl border border-slate-200/70 dark:border-slate-700/70 bg-gradient-to-br from-white via-slate-50/80 to-indigo-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/20 shadow-sm"
            data-testid="collaborators-summary-bar"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-300/40 to-transparent" />
            <div className="flex flex-wrap items-center gap-2 p-2.5">
              {/* Hero — total + filtered delta */}
              <button
                type="button"
                onClick={() => { setFilterRules(prev => prev.filter(r => r.field !== "status" && r.field !== "agreement")); setPage(1); }}
                data-testid="stat-total"
                className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200 ${
                  !hasActiveFilters
                    ? "bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-sm shadow-indigo-500/20"
                    : isFiltered
                      ? "bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-sm shadow-indigo-500/20 ring-2 ring-amber-300 dark:ring-amber-400"
                      : "bg-white dark:bg-slate-800 hover:shadow-sm border border-slate-200 dark:border-slate-700"
                }`}
                title={isFiltered ? (sk ? "Kliknutím vyčistíte stav/zmluvu" : "Click to clear status/agreement") : undefined}
              >
                <div className={`flex items-center justify-center w-7 h-7 rounded-md ${(!hasActiveFilters || isFiltered) ? "bg-white/20" : "bg-indigo-500/15 dark:bg-indigo-500/20"}`}>
                  <Users className={`h-4 w-4 ${(!hasActiveFilters || isFiltered) ? "text-white" : "text-indigo-600 dark:text-indigo-400"}`} />
                </div>
                {isFiltered ? (
                  <div className="flex flex-col items-start leading-tight">
                    <div className="flex items-baseline gap-1">
                      <span className="text-base font-bold text-white" data-testid="text-filtered-count">
                        {filteredCount.toLocaleString(locale === "sk" ? "sk-SK" : "en-US")}
                      </span>
                      <span className="text-[10px] font-medium text-indigo-100">
                        {sk ? `z ${collabStats.total.toLocaleString("sk-SK")}` : `of ${collabStats.total.toLocaleString("en-US")}`}
                      </span>
                    </div>
                    <span className="text-[9px] font-medium text-amber-100 uppercase tracking-wide">
                      {sk ? "Filtrované" : "Filtered"}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-start leading-tight">
                    <span className={`text-base font-bold ${!hasActiveFilters ? "text-white" : "text-slate-900 dark:text-white"}`}>
                      {collabStats.total.toLocaleString(locale === "sk" ? "sk-SK" : "en-US")}
                    </span>
                    <span className={`text-[9px] font-medium uppercase tracking-wide ${!hasActiveFilters ? "text-indigo-100" : "text-muted-foreground"}`}>
                      {sk ? "Celkom" : "Total"}
                    </span>
                  </div>
                )}
              </button>

              {/* Status group */}
              <div className="flex items-center gap-1 pl-2 border-l border-slate-200/70 dark:border-slate-700/70">
                <Toggle
                  id="stat-active"
                  label={(t.collaborators as any).active || "Active"}
                  count={collabStats.active}
                  active={filterStatus === "active"}
                  onClick={() => { setSingleRuleValue("agreement",""); setSingleRuleValue("status", filterStatus === "active" ? "" : "active"); }}
                  color="emerald"
                  Icon={UserCheck}
                />
                <Toggle
                  id="stat-inactive"
                  label={(t.collaborators as any).inactive || "Inactive"}
                  count={collabStats.inactive}
                  active={filterStatus === "inactive"}
                  onClick={() => { setSingleRuleValue("agreement",""); setSingleRuleValue("status", filterStatus === "inactive" ? "" : "inactive"); }}
                  color="rose"
                  Icon={UserX}
                />
              </div>

              {/* Agreement group */}
              <div className="flex flex-wrap items-center gap-1 pl-2 border-l border-slate-200/70 dark:border-slate-700/70">
                <Toggle
                  id="stat-valid-agreement"
                  label={(t.collaborators as any).validAgreement || "Valid"}
                  count={collabStats.validAgreement}
                  active={filterAgreement === "valid"}
                  onClick={() => { setSingleRuleValue("status",""); setSingleRuleValue("agreement", filterAgreement === "valid" ? "" : "valid"); }}
                  color="green"
                  Icon={ShieldCheck}
                />
                <Toggle
                  id="stat-expired-agreement"
                  label={(t.collaborators as any).expired || "Expired"}
                  count={collabStats.expiredAgreement}
                  active={filterAgreement === "expired"}
                  onClick={() => { setSingleRuleValue("status",""); setSingleRuleValue("agreement", filterAgreement === "expired" ? "" : "expired"); }}
                  color="amber"
                  Icon={ShieldAlert}
                />
                <Toggle
                  id="stat-no-agreement"
                  label={(t.collaborators as any).noAgreement || "No agreement"}
                  count={collabStats.noAgreement}
                  active={filterAgreement === "none"}
                  onClick={() => { setSingleRuleValue("status",""); setSingleRuleValue("agreement", filterAgreement === "none" ? "" : "none"); }}
                  color="slate"
                  Icon={ShieldOff}
                />
              </div>
            </div>
          </div>
        );
      })()}

      <Card>
        <CardHeader className="pb-4">
          <EntityFilter
            searchQuery={searchQuery}
            onSearchChange={(q) => { setSearchQuery(q); setPage(1); }}
            searchPlaceholder={t.collaborators.searchPlaceholder}
            rules={filterRules}
            onRulesChange={handleRulesChange}
            fields={filterFields}
            presets={filterPresets}
            totalCount={serverCollaboratorsTotal}
            visibleCount={paginatedCollaborators.length}
            storageKey="entity-filter:collaborators"
            testId="filter-collaborators"
            locale={locale}
            showCountAlways
            onActiveViewChange={(v) => setActiveView(v ? { id: v.id, name: v.name } : null)}
            labels={{
              search: t.collaborators.searchPlaceholder,
              filter: t.common.filter,
              clearAll: t.common.clearAll,
            }}
          />
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
                    {t.common.showing} {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, serverCollaboratorsTotal)} {t.common.of} {serverCollaboratorsTotal}
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

      {isFormOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] animate-in fade-in duration-200"
            onClick={() => setIsFormOpen(false)}
            data-testid="collaborator-form-backdrop"
          />
          <div className="fixed inset-y-0 right-0 z-[51] w-[820px] max-w-[95vw] bg-background border-l shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
            <CollaboratorFormWizard
              initialData={selectedCollaborator || undefined}
              onSuccess={() => setIsFormOpen(false)}
              onCancel={() => setIsFormOpen(false)}
              positionScopeFilter={positionScope}
              hideSvetZdravia={!!excludeScope}
            />
          </div>
        </>
      )}

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

export default function CollaboratorsPage() {
  return <CollaboratorsContent embedded={false} />;
}
