import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Filter, Save, Trash2, X, ChevronDown, ChevronUp, Star } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useI18n } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { COUNTRIES } from "@shared/schema";
import type { SavedSearch } from "@shared/schema";
import { getCountryFlag } from "@/lib/countries";

export interface CustomerFilters {
  search?: string;
  country?: string;
  status?: string;
  serviceType?: string;
  dateFrom?: string;
  dateTo?: string;
  hasProducts?: string;
  hasInvoices?: string;
}

interface AdvancedFiltersProps {
  module: string;
  filters: CustomerFilters;
  onFiltersChange: (filters: CustomerFilters) => void;
  onClear: () => void;
}

export function AdvancedFilters({ module, filters, onFiltersChange, onClear }: AdvancedFiltersProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const { data: savedSearches = [] } = useQuery<SavedSearch[]>({
    queryKey: ["/api/saved-searches", module],
    queryFn: async () => {
      const res = await fetch(`/api/saved-searches?module=${module}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: (data: { name: string; module: string; filters: string; isDefault: boolean }) =>
      apiRequest("POST", "/api/saved-searches", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-searches", module] });
      toast({ title: t.success?.saved || "Saved" });
      setIsSaveDialogOpen(false);
      setSearchName("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/saved-searches/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-searches", module] });
      toast({ title: t.success?.deleted || "Deleted" });
    },
  });

  const handleSaveSearch = () => {
    if (!searchName.trim()) return;
    saveMutation.mutate({
      name: searchName,
      module,
      filters: JSON.stringify(filters),
      isDefault,
    });
  };

  const handleLoadSearch = (savedSearch: SavedSearch) => {
    try {
      const loadedFilters = JSON.parse(savedSearch.filters);
      onFiltersChange(loadedFilters);
      setIsOpen(false);
    } catch (e) {
      console.error("Failed to parse saved search filters", e);
    }
  };

  const activeFilterCount = Object.values(filters).filter((v) => v && v !== "all").length;

  const updateFilter = (key: keyof CustomerFilters, value: string) => {
    onFiltersChange({ ...filters, [key]: value === "all" ? undefined : value });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" data-testid="button-advanced-filters">
              <Filter className="h-4 w-4 mr-2" />
              {t.advancedFilters?.title || "Advanced Filters"}
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4" align="start">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">{t.advancedFilters?.title || "Advanced Filters"}</h4>
                <Button variant="ghost" size="sm" onClick={onClear} data-testid="button-clear-filters">
                  <X className="h-4 w-4 mr-1" />
                  {t.common?.clear || "Clear"}
                </Button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">{t.common?.country || "Country"}</Label>
                  <Select value={filters.country || "all"} onValueChange={(v) => updateFilter("country", v)}>
                    <SelectTrigger data-testid="filter-country">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" data-testid="filter-country-all">{t.common?.all || "All"}</SelectItem>
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.code} data-testid={`filter-country-${c.code}`}>
                          {getCountryFlag(c.code)} {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">{t.clients?.clientStatus || "Status"}</Label>
                  <Select value={filters.status || "all"} onValueChange={(v) => updateFilter("status", v)}>
                    <SelectTrigger data-testid="filter-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" data-testid="filter-status-all">{t.common?.all || "All"}</SelectItem>
                      <SelectItem value="potential" data-testid="filter-status-potential">{t.clients?.clientStatuses?.potential || "Potential"}</SelectItem>
                      <SelectItem value="acquired" data-testid="filter-status-acquired">{t.clients?.clientStatuses?.acquired || "Acquired"}</SelectItem>
                      <SelectItem value="terminated" data-testid="filter-status-terminated">{t.clients?.clientStatuses?.terminated || "Terminated"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">{t.clients?.serviceType || "Service Type"}</Label>
                  <Select value={filters.serviceType || "all"} onValueChange={(v) => updateFilter("serviceType", v)}>
                    <SelectTrigger data-testid="filter-service-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" data-testid="filter-service-all">{t.common?.all || "All"}</SelectItem>
                      <SelectItem value="cordBlood" data-testid="filter-service-cordblood">{t.clients?.serviceTypes?.cordBlood || "Cord Blood"}</SelectItem>
                      <SelectItem value="cordTissue" data-testid="filter-service-cordtissue">{t.clients?.serviceTypes?.cordTissue || "Cord Tissue"}</SelectItem>
                      <SelectItem value="both" data-testid="filter-service-both">{t.clients?.serviceTypes?.both || "Both"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">{t.advancedFilters?.hasProducts || "Has Products"}</Label>
                  <Select value={filters.hasProducts || "all"} onValueChange={(v) => updateFilter("hasProducts", v)}>
                    <SelectTrigger data-testid="filter-has-products">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" data-testid="filter-has-products-all">{t.common?.all || "All"}</SelectItem>
                      <SelectItem value="yes" data-testid="filter-has-products-yes">{t.common?.yes || "Yes"}</SelectItem>
                      <SelectItem value="no" data-testid="filter-has-products-no">{t.common?.no || "No"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">{t.advancedFilters?.hasInvoices || "Has Invoices"}</Label>
                  <Select value={filters.hasInvoices || "all"} onValueChange={(v) => updateFilter("hasInvoices", v)}>
                    <SelectTrigger data-testid="filter-has-invoices">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" data-testid="filter-has-invoices-all">{t.common?.all || "All"}</SelectItem>
                      <SelectItem value="yes" data-testid="filter-has-invoices-yes">{t.common?.yes || "Yes"}</SelectItem>
                      <SelectItem value="no" data-testid="filter-has-invoices-no">{t.common?.no || "No"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-between pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSaveDialogOpen(true)}
                  disabled={activeFilterCount === 0}
                  data-testid="button-save-search"
                >
                  <Save className="h-4 w-4 mr-1" />
                  {t.advancedFilters?.saveSearch || "Save Search"}
                </Button>
              </div>

              {savedSearches.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between" data-testid="button-toggle-saved-searches">
                      {t.advancedFilters?.savedSearches || "Saved Searches"} ({savedSearches.length})
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1 pt-2">
                    {savedSearches.map((search) => (
                      <div
                        key={search.id}
                        className="flex items-center justify-between p-2 rounded-md hover-elevate"
                      >
                        <button
                          onClick={() => handleLoadSearch(search)}
                          className="flex items-center gap-2 text-sm text-left flex-1"
                          data-testid={`saved-search-${search.id}`}
                        >
                          {search.isDefault && <Star className="h-3 w-3 text-yellow-500" />}
                          {search.name}
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => deleteMutation.mutate(search.id)}
                          data-testid={`delete-search-${search.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {activeFilterCount > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {filters.country && (
              <Badge variant="secondary" className="gap-1">
                {getCountryFlag(filters.country)} {filters.country}
                <button
                  onClick={() => updateFilter("country", "all")}
                  data-testid="badge-clear-country"
                  className="inline-flex"
                >
                  <X className="h-3 w-3 cursor-pointer" />
                </button>
              </Badge>
            )}
            {filters.status && (
              <Badge variant="secondary" className="gap-1">
                {filters.status}
                <button
                  onClick={() => updateFilter("status", "all")}
                  data-testid="badge-clear-status"
                  className="inline-flex"
                >
                  <X className="h-3 w-3 cursor-pointer" />
                </button>
              </Badge>
            )}
            {filters.serviceType && (
              <Badge variant="secondary" className="gap-1">
                {filters.serviceType}
                <button
                  onClick={() => updateFilter("serviceType", "all")}
                  data-testid="badge-clear-service-type"
                  className="inline-flex"
                >
                  <X className="h-3 w-3 cursor-pointer" />
                </button>
              </Badge>
            )}
          </div>
        )}
      </div>

      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.advancedFilters?.saveSearch || "Save Search"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t.advancedFilters?.searchName || "Search Name"}</Label>
              <Input
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder={t.advancedFilters?.searchNamePlaceholder || "My custom search..."}
                data-testid="input-search-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)} data-testid="button-cancel-save-search">
              {t.common?.cancel || "Cancel"}
            </Button>
            <Button onClick={handleSaveSearch} disabled={!searchName.trim()} data-testid="button-confirm-save-search">
              {t.common?.save || "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
