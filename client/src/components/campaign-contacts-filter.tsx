import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Filter, X, ChevronDown, ChevronUp, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useI18n } from "@/i18n";
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

const CLIENT_STATUSES = [
  { value: "potential", label: "Potenciálny klient" },
  { value: "acquired", label: "Získaný klient" },
  { value: "terminated", label: "Ukončený klient" },
];

const LEAD_STATUSES = [
  { value: "cold", label: "Studený" },
  { value: "warm", label: "Teplý" },
  { value: "hot", label: "Horúci" },
  { value: "qualified", label: "Kvalifikovaný" },
];

const CASE_STATUSES = [
  { value: "realized", label: "Zrealizovaný" },
  { value: "duplicate", label: "Duplikát" },
  { value: "in_progress", label: "Prebieha" },
  { value: "postponed", label: "Odložený" },
  { value: "not_interested", label: "Nezáujem" },
  { value: "cancelled", label: "Zrušený" },
];

const PRODUCT_TYPES = [
  { value: "cord_blood", label: "Pupočníková krv" },
  { value: "cord_tissue", label: "Pupočníkové tkanivo" },
  { value: "both", label: "Oboje" },
];

const SALES_CHANNELS = [
  { value: "CCP", label: "CCP" },
  { value: "CCP+D", label: "CCP+D" },
  { value: "CCAI", label: "CCAI" },
  { value: "CCAI+D", label: "CCAI+D" },
  { value: "CCAE", label: "CCAE" },
  { value: "CCAE+D", label: "CCAE+D" },
  { value: "I", label: "I" },
];

const INFO_SOURCES = [
  { value: "internet", label: "Internet" },
  { value: "friends", label: "Od známych" },
  { value: "doctor", label: "Lekár" },
  { value: "hospital", label: "Nemocnica" },
  { value: "advertisement", label: "Reklama" },
  { value: "event", label: "Podujatie" },
  { value: "other", label: "Iné" },
];

const CONTACT_STATUSES = [
  { value: "pending", label: "Čaká" },
  { value: "contacted", label: "Kontaktovaný" },
  { value: "completed", label: "Dokončený" },
  { value: "failed", label: "Neúspešný" },
  { value: "no_answer", label: "Neodpovedal" },
  { value: "callback_scheduled", label: "Naplánovaný callback" },
  { value: "not_interested", label: "Nezáujem" },
];

const SERVICE_TYPES = [
  { value: "cord_blood", label: "Pupočníková krv" },
  { value: "cord_tissue", label: "Pupočníkové tkanivo" },
  { value: "both", label: "Oboje" },
];

export function CampaignContactsFilter({ 
  filters, 
  onFiltersChange, 
  onClear,
  countryCodes = [],
}: CampaignContactsFilterProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [customerSectionOpen, setCustomerSectionOpen] = useState(true);
  const [caseSectionOpen, setCaseSectionOpen] = useState(true);
  const [contactSectionOpen, setContactSectionOpen] = useState(true);

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

  const updateFilter = (key: keyof CampaignContactFilters, value: string) => {
    onFiltersChange({ ...filters, [key]: value === "all" ? undefined : value });
  };

  const handleClear = () => {
    onClear();
    setIsOpen(false);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t.common?.search || "Hľadať..."}
          value={filters.search || ""}
          onChange={(e) => updateFilter("search", e.target.value)}
          className="pl-10"
          data-testid="input-search-contacts"
        />
      </div>

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" data-testid="button-contacts-filter">
            <Filter className="h-4 w-4 mr-2" />
            {t.common?.filter || "Filter"}
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] max-h-[80vh] overflow-y-auto" align="start">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">{t.common?.filter || "Komplexný filter"}</h4>
              {activeFilterCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleClear}
                  data-testid="button-clear-contacts-filter"
                >
                  <X className="h-4 w-4 mr-1" />
                  {t.common?.clear || "Vyčistiť"}
                </Button>
              )}
            </div>

            <Collapsible open={customerSectionOpen} onOpenChange={setCustomerSectionOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between" data-testid="button-customer-section">
                  <span className="font-medium">Klient</span>
                  {customerSectionOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label>{t.common?.country || "Krajina"}</Label>
                  <Select 
                    value={filters.country || "all"} 
                    onValueChange={(v) => updateFilter("country", v)}
                  >
                    <SelectTrigger data-testid="select-filter-country">
                      <SelectValue placeholder="Všetky krajiny" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Všetky krajiny</SelectItem>
                      {availableCountries.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {getCountryFlag(c.code)} {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Mesto</Label>
                  <Input
                    placeholder="Filtrovať podľa mesta"
                    value={filters.city || ""}
                    onChange={(e) => updateFilter("city", e.target.value)}
                    data-testid="input-filter-city"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Stav klienta</Label>
                  <Select 
                    value={filters.clientStatus || "all"} 
                    onValueChange={(v) => updateFilter("clientStatus", v)}
                  >
                    <SelectTrigger data-testid="select-filter-client-status">
                      <SelectValue placeholder="Všetky stavy" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Všetky stavy</SelectItem>
                      {CLIENT_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Typ služby</Label>
                  <Select 
                    value={filters.serviceType || "all"} 
                    onValueChange={(v) => updateFilter("serviceType", v)}
                  >
                    <SelectTrigger data-testid="select-filter-service-type">
                      <SelectValue placeholder="Všetky typy" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Všetky typy</SelectItem>
                      {SERVICE_TYPES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Lead status</Label>
                  <Select 
                    value={filters.leadStatus || "all"} 
                    onValueChange={(v) => updateFilter("leadStatus", v)}
                  >
                    <SelectTrigger data-testid="select-filter-lead-status">
                      <SelectValue placeholder="Všetky" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Všetky</SelectItem>
                      {LEAD_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Collapsible open={caseSectionOpen} onOpenChange={setCaseSectionOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between" data-testid="button-case-section">
                  <span className="font-medium">Potenciálny prípad</span>
                  {caseSectionOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label>Stav prípadu</Label>
                  <Select 
                    value={filters.caseStatus || "all"} 
                    onValueChange={(v) => updateFilter("caseStatus", v)}
                  >
                    <SelectTrigger data-testid="select-filter-case-status">
                      <SelectValue placeholder="Všetky stavy" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Všetky stavy</SelectItem>
                      {CASE_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Očakávaný dátum (od)</Label>
                  <Input
                    type="date"
                    value={filters.expectedDateFrom || ""}
                    onChange={(e) => updateFilter("expectedDateFrom", e.target.value)}
                    data-testid="input-filter-expected-from"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Očakávaný dátum (do)</Label>
                  <Input
                    type="date"
                    value={filters.expectedDateTo || ""}
                    onChange={(e) => updateFilter("expectedDateTo", e.target.value)}
                    data-testid="input-filter-expected-to"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Nemocnica</Label>
                  <Select 
                    value={filters.hospitalId || "all"} 
                    onValueChange={(v) => updateFilter("hospitalId", v)}
                  >
                    <SelectTrigger data-testid="select-filter-hospital">
                      <SelectValue placeholder="Všetky nemocnice" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Všetky nemocnice</SelectItem>
                      {filteredHospitals.map((h) => (
                        <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Typ produktu</Label>
                  <Select 
                    value={filters.productType || "all"} 
                    onValueChange={(v) => updateFilter("productType", v)}
                  >
                    <SelectTrigger data-testid="select-filter-product-type">
                      <SelectValue placeholder="Všetky typy" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Všetky typy</SelectItem>
                      {PRODUCT_TYPES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Predajný kanál</Label>
                  <Select 
                    value={filters.salesChannel || "all"} 
                    onValueChange={(v) => updateFilter("salesChannel", v)}
                  >
                    <SelectTrigger data-testid="select-filter-sales-channel">
                      <SelectValue placeholder="Všetky kanály" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Všetky kanály</SelectItem>
                      {SALES_CHANNELS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Zdroj informácií</Label>
                  <Select 
                    value={filters.infoSource || "all"} 
                    onValueChange={(v) => updateFilter("infoSource", v)}
                  >
                    <SelectTrigger data-testid="select-filter-info-source">
                      <SelectValue placeholder="Všetky zdroje" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Všetky zdroje</SelectItem>
                      {INFO_SOURCES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Collapsible open={contactSectionOpen} onOpenChange={setContactSectionOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between" data-testid="button-contact-status-section">
                  <span className="font-medium">Stav kontaktu</span>
                  {contactSectionOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label>Stav kontaktu v kampani</Label>
                  <Select 
                    value={filters.contactStatus || "all"} 
                    onValueChange={(v) => updateFilter("contactStatus", v)}
                  >
                    <SelectTrigger data-testid="select-filter-contact-status">
                      <SelectValue placeholder="Všetky stavy" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Všetky stavy</SelectItem>
                      {CONTACT_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setIsOpen(false)}>
                {t.common?.cancel || "Zavrieť"}
              </Button>
              <Button size="sm" onClick={() => setIsOpen(false)}>
                Použiť
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {activeFilterCount > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {filters.country && (
            <Badge variant="secondary" className="gap-1">
              {getCountryFlag(filters.country)} {filters.country}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilter("country", "all")} 
              />
            </Badge>
          )}
          {filters.clientStatus && (
            <Badge variant="secondary" className="gap-1">
              {CLIENT_STATUSES.find(s => s.value === filters.clientStatus)?.label}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilter("clientStatus", "all")} 
              />
            </Badge>
          )}
          {filters.caseStatus && (
            <Badge variant="secondary" className="gap-1">
              {CASE_STATUSES.find(s => s.value === filters.caseStatus)?.label}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilter("caseStatus", "all")} 
              />
            </Badge>
          )}
          {filters.salesChannel && (
            <Badge variant="secondary" className="gap-1">
              {filters.salesChannel}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilter("salesChannel", "all")} 
              />
            </Badge>
          )}
          {activeFilterCount > 4 && (
            <Badge variant="outline">+{activeFilterCount - 4}</Badge>
          )}
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
