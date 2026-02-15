import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Filter, X, Search, Users, Briefcase, Phone, MapPin, Calendar, Package, Megaphone, Lightbulb, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useI18n } from "@/i18n";
import type { Translations } from "@/i18n/translations";
import { COUNTRIES, type Hospital } from "@shared/schema";
import { getCountryFlag } from "@/lib/countries";

export interface CampaignContactFilters {
  search?: string;
  country?: string;
  city?: string;
  status?: string;
  clientStatus?: string;
  serviceType?: string;
  leadStatus?: string;
  caseStatus?: string;
  expectedDateFrom?: string;
  expectedDateTo?: string;
  hospitalId?: string;
  productType?: string;
  salesChannel?: string;
  infoSource?: string;
  contactStatus?: string;
}

interface CampaignContactsFilterProps {
  filters: CampaignContactFilters;
  onFiltersChange: (filters: CampaignContactFilters) => void;
  onClear: () => void;
  countryCodes?: string[];
}

function getClientStatuses(t: Translations) {
  return [
    { value: "potential", label: t.campaigns.filter.clientStatuses.potential },
    { value: "acquired", label: t.campaigns.filter.clientStatuses.acquired },
    { value: "terminated", label: t.campaigns.filter.clientStatuses.terminated },
  ];
}

function getLeadStatuses(t: Translations) {
  return [
    { value: "cold", label: t.campaigns.filter.leadStatuses.cold },
    { value: "warm", label: t.campaigns.filter.leadStatuses.warm },
    { value: "hot", label: t.campaigns.filter.leadStatuses.hot },
    { value: "qualified", label: t.campaigns.filter.leadStatuses.qualified },
  ];
}

function getCaseStatuses(t: Translations) {
  return [
    { value: "realized", label: t.campaigns.filter.caseStatuses.realized },
    { value: "duplicate", label: t.campaigns.filter.caseStatuses.duplicate },
    { value: "in_progress", label: t.campaigns.filter.caseStatuses.in_progress },
    { value: "postponed", label: t.campaigns.filter.caseStatuses.postponed },
    { value: "not_interested", label: t.campaigns.filter.caseStatuses.not_interested },
    { value: "cancelled", label: t.campaigns.filter.caseStatuses.cancelled },
  ];
}

function getProductTypes(t: Translations) {
  return [
    { value: "cord_blood", label: t.campaigns.filter.productTypes.cord_blood },
    { value: "cord_tissue", label: t.campaigns.filter.productTypes.cord_tissue },
    { value: "both", label: t.campaigns.filter.productTypes.both },
  ];
}

const SALES_CHANNELS = [
  { value: "CCP", label: "CCP" },
  { value: "CCP+D", label: "CCP+D" },
  { value: "CCAI", label: "CCAI" },
  { value: "CCAI+D", label: "CCAI+D" },
  { value: "CCAE", label: "CCAE" },
  { value: "CCAE+D", label: "CCAE+D" },
  { value: "I", label: "I" },
];

function getInfoSources(t: Translations) {
  return [
    { value: "internet", label: t.campaigns.filter.infoSources.internet },
    { value: "friends", label: t.campaigns.filter.infoSources.friends },
    { value: "doctor", label: t.campaigns.filter.infoSources.doctor },
    { value: "hospital", label: t.campaigns.filter.infoSources.hospital },
    { value: "advertisement", label: t.campaigns.filter.infoSources.advertisement },
    { value: "event", label: t.campaigns.filter.infoSources.event },
    { value: "other", label: t.campaigns.filter.infoSources.other },
  ];
}

function getContactStatuses(t: Translations) {
  return [
    { value: "pending", label: t.campaigns.contactStatuses.pending },
    { value: "contacted", label: t.campaigns.contactStatuses.contacted },
    { value: "completed", label: t.campaigns.contactStatuses.completed },
    { value: "failed", label: t.campaigns.contactStatuses.failed },
    { value: "no_answer", label: t.campaigns.contactStatuses.no_answer },
    { value: "callback_scheduled", label: t.campaigns.contactStatuses.callback_scheduled },
    { value: "not_interested", label: t.campaigns.contactStatuses.not_interested },
  ];
}

function getServiceTypes(t: Translations) {
  return [
    { value: "cord_blood", label: t.campaigns.filter.serviceTypes.cord_blood },
    { value: "cord_tissue", label: t.campaigns.filter.serviceTypes.cord_tissue },
    { value: "both", label: t.campaigns.filter.serviceTypes.both },
  ];
}

function FilterSection({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">{title}</span>
      </div>
      {children}
    </div>
  );
}

function ChipSelect({ options, value, onChange, testIdPrefix }: {
  options: { value: string; label: string }[];
  value?: string;
  onChange: (val: string | undefined) => void;
  testIdPrefix: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(opt => (
        <Badge
          key={opt.value}
          variant={value === opt.value ? "default" : "outline"}
          className={`cursor-pointer select-none ${value === opt.value ? "" : ""}`}
          onClick={() => onChange(value === opt.value ? undefined : opt.value)}
          data-testid={`${testIdPrefix}-${opt.value}`}
        >
          {opt.label}
        </Badge>
      ))}
    </div>
  );
}

export function CampaignContactsFilter({ 
  filters, 
  onFiltersChange, 
  onClear,
  countryCodes = [],
}: CampaignContactsFilterProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  const CLIENT_STATUSES = useMemo(() => getClientStatuses(t), [t]);
  const LEAD_STATUSES = useMemo(() => getLeadStatuses(t), [t]);
  const CASE_STATUSES = useMemo(() => getCaseStatuses(t), [t]);
  const PRODUCT_TYPES = useMemo(() => getProductTypes(t), [t]);
  const INFO_SOURCES = useMemo(() => getInfoSources(t), [t]);
  const CONTACT_STATUSES = useMemo(() => getContactStatuses(t), [t]);
  const SERVICE_TYPES = useMemo(() => getServiceTypes(t), [t]);

  const { data: hospitals = [] } = useQuery<Hospital[]>({
    queryKey: ["/api/hospitals"],
  });

  const filteredHospitals = countryCodes.length > 0 
    ? hospitals.filter(h => countryCodes.includes(h.countryCode))
    : hospitals;

  const availableCountries = countryCodes.length > 0
    ? COUNTRIES.filter(c => countryCodes.includes(c.code))
    : COUNTRIES;

  const activeFilterCount = Object.entries(filters).filter(
    ([key, v]) => v && v !== "all" && key !== "search"
  ).length;

  const updateFilter = (key: keyof CampaignContactFilters, value: string | undefined) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const getActiveFilterLabels = (): { key: keyof CampaignContactFilters; label: string }[] => {
    const labels: { key: keyof CampaignContactFilters; label: string }[] = [];
    if (filters.country) {
      const c = COUNTRIES.find(c => c.code === filters.country);
      labels.push({ key: "country", label: `${getCountryFlag(filters.country)} ${c?.name || filters.country}` });
    }
    if (filters.clientStatus) {
      labels.push({ key: "clientStatus", label: CLIENT_STATUSES.find(s => s.value === filters.clientStatus)?.label || filters.clientStatus });
    }
    if (filters.serviceType) {
      labels.push({ key: "serviceType", label: SERVICE_TYPES.find(s => s.value === filters.serviceType)?.label || filters.serviceType });
    }
    if (filters.leadStatus) {
      labels.push({ key: "leadStatus", label: LEAD_STATUSES.find(s => s.value === filters.leadStatus)?.label || filters.leadStatus });
    }
    if (filters.caseStatus) {
      labels.push({ key: "caseStatus", label: CASE_STATUSES.find(s => s.value === filters.caseStatus)?.label || filters.caseStatus });
    }
    if (filters.contactStatus) {
      labels.push({ key: "contactStatus", label: CONTACT_STATUSES.find(s => s.value === filters.contactStatus)?.label || filters.contactStatus });
    }
    if (filters.salesChannel) {
      labels.push({ key: "salesChannel", label: `${t.campaigns.filter.salesChannel}: ${filters.salesChannel}` });
    }
    if (filters.productType) {
      labels.push({ key: "productType", label: PRODUCT_TYPES.find(s => s.value === filters.productType)?.label || filters.productType });
    }
    if (filters.infoSource) {
      labels.push({ key: "infoSource", label: INFO_SOURCES.find(s => s.value === filters.infoSource)?.label || filters.infoSource });
    }
    if (filters.hospitalId) {
      const h = filteredHospitals.find(h => h.id === filters.hospitalId);
      labels.push({ key: "hospitalId", label: h?.name || t.campaigns.filter.hospital });
    }
    if (filters.city) {
      labels.push({ key: "city", label: `${t.campaigns.filter.city}: ${filters.city}` });
    }
    if (filters.expectedDateFrom) {
      labels.push({ key: "expectedDateFrom", label: `${t.campaigns.filter.expectedDateFrom}: ${filters.expectedDateFrom}` });
    }
    if (filters.expectedDateTo) {
      labels.push({ key: "expectedDateTo", label: `${t.campaigns.filter.expectedDateTo}: ${filters.expectedDateTo}` });
    }
    return labels;
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t.campaigns.filter.searchPlaceholder}
          value={filters.search || ""}
          onChange={(e) => updateFilter("search", e.target.value || undefined)}
          className="pl-10"
          data-testid="input-search-contacts"
        />
      </div>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" data-testid="button-contacts-filter">
            <Filter className="h-4 w-4 mr-2" />
            {t.campaigns.filter.filters}
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[420px] sm:w-[480px] flex flex-col p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-primary" />
                {t.campaigns.filter.title}
              </SheetTitle>
            </div>
            {activeFilterCount > 0 && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm text-muted-foreground">{activeFilterCount} {t.campaigns.filter.activeFilters}</span>
                <Button variant="ghost" size="sm" onClick={onClear} data-testid="button-clear-contacts-filter">
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  {t.campaigns.filter.resetAll}
                </Button>
              </div>
            )}
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">

              <FilterSection icon={Phone} title={t.campaigns.filter.contactStatusInCampaign}>
                <ChipSelect
                  options={CONTACT_STATUSES}
                  value={filters.contactStatus}
                  onChange={(v) => updateFilter("contactStatus", v)}
                  testIdPrefix="chip-contact-status"
                />
              </FilterSection>

              <Separator />

              <FilterSection icon={Users} title={t.campaigns.filter.client}>
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-muted-foreground mb-1.5 block">{t.campaigns.filter.clientStatus}</span>
                    <ChipSelect
                      options={CLIENT_STATUSES}
                      value={filters.clientStatus}
                      onChange={(v) => updateFilter("clientStatus", v)}
                      testIdPrefix="chip-client-status"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground mb-1.5 block">{t.campaigns.filter.leadQuality}</span>
                    <ChipSelect
                      options={LEAD_STATUSES}
                      value={filters.leadStatus}
                      onChange={(v) => updateFilter("leadStatus", v)}
                      testIdPrefix="chip-lead-status"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground mb-1.5 block">{t.campaigns.filter.serviceType}</span>
                    <ChipSelect
                      options={SERVICE_TYPES}
                      value={filters.serviceType}
                      onChange={(v) => updateFilter("serviceType", v)}
                      testIdPrefix="chip-service-type"
                    />
                  </div>
                </div>
              </FilterSection>

              <Separator />

              <FilterSection icon={MapPin} title={t.campaigns.filter.location}>
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-muted-foreground mb-1.5 block">{t.campaigns.filter.countryLabel}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {availableCountries.map(c => (
                        <Badge
                          key={c.code}
                          variant={filters.country === c.code ? "default" : "outline"}
                          className="cursor-pointer select-none"
                          onClick={() => updateFilter("country", filters.country === c.code ? undefined : c.code)}
                          data-testid={`chip-country-${c.code}`}
                        >
                          {getCountryFlag(c.code)} {c.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground mb-1.5 block">{t.campaigns.filter.city}</span>
                    <Input
                      placeholder={t.campaigns.filter.cityPlaceholder}
                      value={filters.city || ""}
                      onChange={(e) => updateFilter("city", e.target.value || undefined)}
                      data-testid="input-filter-city"
                    />
                  </div>
                </div>
              </FilterSection>

              <Separator />

              <FilterSection icon={Briefcase} title={t.campaigns.filter.potentialCase}>
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-muted-foreground mb-1.5 block">{t.campaigns.filter.caseStatus}</span>
                    <ChipSelect
                      options={CASE_STATUSES}
                      value={filters.caseStatus}
                      onChange={(v) => updateFilter("caseStatus", v)}
                      testIdPrefix="chip-case-status"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground mb-1.5 block">{t.campaigns.filter.productType}</span>
                    <ChipSelect
                      options={PRODUCT_TYPES}
                      value={filters.productType}
                      onChange={(v) => updateFilter("productType", v)}
                      testIdPrefix="chip-product-type"
                    />
                  </div>
                  {filteredHospitals.length > 0 && (
                    <div>
                      <span className="text-xs text-muted-foreground mb-1.5 block">{t.campaigns.filter.hospital}</span>
                      <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto">
                        {filteredHospitals.map(h => (
                          <Badge
                            key={h.id}
                            variant={filters.hospitalId === h.id ? "default" : "outline"}
                            className="cursor-pointer select-none"
                            onClick={() => updateFilter("hospitalId", filters.hospitalId === h.id ? undefined : h.id)}
                            data-testid={`chip-hospital-${h.id}`}
                          >
                            {h.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-xs text-muted-foreground mb-1.5 block">{t.campaigns.filter.expectedDateFrom}</span>
                      <Input
                        type="date"
                        value={filters.expectedDateFrom || ""}
                        onChange={(e) => updateFilter("expectedDateFrom", e.target.value || undefined)}
                        data-testid="input-filter-expected-from"
                      />
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground mb-1.5 block">{t.campaigns.filter.expectedDateTo}</span>
                      <Input
                        type="date"
                        value={filters.expectedDateTo || ""}
                        onChange={(e) => updateFilter("expectedDateTo", e.target.value || undefined)}
                        data-testid="input-filter-expected-to"
                      />
                    </div>
                  </div>
                </div>
              </FilterSection>

              <Separator />

              <FilterSection icon={Megaphone} title={t.campaigns.filter.acquisition}>
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-muted-foreground mb-1.5 block">{t.campaigns.filter.salesChannel}</span>
                    <ChipSelect
                      options={SALES_CHANNELS}
                      value={filters.salesChannel}
                      onChange={(v) => updateFilter("salesChannel", v)}
                      testIdPrefix="chip-sales-channel"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground mb-1.5 block">{t.campaigns.filter.infoSource}</span>
                    <ChipSelect
                      options={INFO_SOURCES}
                      value={filters.infoSource}
                      onChange={(v) => updateFilter("infoSource", v)}
                      testIdPrefix="chip-info-source"
                    />
                  </div>
                </div>
              </FilterSection>

            </div>
          </ScrollArea>

          <div className="border-t p-4 flex items-center justify-between gap-2">
            {activeFilterCount > 0 ? (
              <Button variant="ghost" size="sm" onClick={onClear} data-testid="button-reset-filters-bottom">
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                {t.campaigns.filter.reset}
              </Button>
            ) : (
              <span />
            )}
            <Button onClick={() => setIsOpen(false)} data-testid="button-apply-filter">
              {t.campaigns.filter.apply}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {activeFilterCount > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {getActiveFilterLabels().map(f => (
            <Badge key={f.key} variant="secondary" className="gap-1 bg-primary/10 text-primary">
              {f.label}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilter(f.key, undefined)}
                data-testid={`remove-filter-${f.key}`}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export function applyContactFilters(
  contacts: Array<{ 
    status?: string; 
    customer?: { 
      firstName: string;
      lastName: string;
      email: string;
      phone?: string | null;
      mobile?: string | null;
      country: string;
      city?: string | null;
      clientStatus?: string;
      serviceType?: string | null;
      leadStatus?: string;
      potentialCase?: {
        caseStatus?: string | null;
        expectedDateMonth?: number | null;
        expectedDateYear?: number | null;
        hospitalId?: string | null;
        productType?: string | null;
        salesChannel?: string | null;
        infoSource?: string | null;
      } | null;
    } 
  }>,
  filters: CampaignContactFilters
): typeof contacts {
  return contacts.filter(contact => {
    const customer = contact.customer;
    if (!customer) return false;

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const fullName = `${customer.firstName} ${customer.lastName}`.toLowerCase();
      const email = customer.email?.toLowerCase() || "";
      const phone = customer.phone?.toLowerCase() || "";
      const mobile = customer.mobile?.toLowerCase() || "";
      if (!fullName.includes(searchLower) && 
          !email.includes(searchLower) && 
          !phone.includes(searchLower) &&
          !mobile.includes(searchLower)) {
        return false;
      }
    }

    if (filters.country && customer.country !== filters.country) {
      return false;
    }

    if (filters.city && customer.city) {
      if (!customer.city.toLowerCase().includes(filters.city.toLowerCase())) {
        return false;
      }
    } else if (filters.city && !customer.city) {
      return false;
    }

    if (filters.clientStatus && customer.clientStatus !== filters.clientStatus) {
      return false;
    }

    if (filters.serviceType && customer.serviceType !== filters.serviceType) {
      return false;
    }

    if (filters.leadStatus && customer.leadStatus !== filters.leadStatus) {
      return false;
    }

    if (filters.contactStatus && contact.status !== filters.contactStatus) {
      return false;
    }

    const potentialCase = customer.potentialCase;
    if (filters.caseStatus) {
      if (!potentialCase || potentialCase.caseStatus !== filters.caseStatus) {
        return false;
      }
    }

    if (filters.hospitalId) {
      if (!potentialCase || potentialCase.hospitalId !== filters.hospitalId) {
        return false;
      }
    }

    if (filters.productType) {
      if (!potentialCase || potentialCase.productType !== filters.productType) {
        return false;
      }
    }

    if (filters.salesChannel) {
      if (!potentialCase || potentialCase.salesChannel !== filters.salesChannel) {
        return false;
      }
    }

    if (filters.infoSource) {
      if (!potentialCase || potentialCase.infoSource !== filters.infoSource) {
        return false;
      }
    }

    if (filters.expectedDateFrom || filters.expectedDateTo) {
      if (!potentialCase || !potentialCase.expectedDateMonth || !potentialCase.expectedDateYear) {
        return false;
      }
      const expectedDate = new Date(potentialCase.expectedDateYear, potentialCase.expectedDateMonth - 1, 1);
      
      if (filters.expectedDateFrom) {
        const fromDate = new Date(filters.expectedDateFrom);
        if (expectedDate < fromDate) return false;
      }
      if (filters.expectedDateTo) {
        const toDate = new Date(filters.expectedDateTo);
        if (expectedDate > toDate) return false;
      }
    }

    return true;
  });
}
