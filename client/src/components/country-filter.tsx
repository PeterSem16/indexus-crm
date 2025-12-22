import { Check, Globe, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { COUNTRIES } from "@/lib/countries";
import { useCountryFilter } from "@/contexts/country-filter-context";

export function CountryFilter() {
  const { selectedCountries, toggleCountry, selectAll, clearAll, availableCountries } = useCountryFilter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className="w-full justify-between gap-2"
          data-testid="button-country-filter"
        >
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            <span className="truncate">
              {selectedCountries.length === availableCountries.length 
                ? availableCountries.length === COUNTRIES.length 
                  ? "All Countries"
                  : `${availableCountries.length} Countries`
                : selectedCountries.length === 0
                  ? "No Countries"
                  : `${selectedCountries.length} Countries`}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <div className="flex gap-2 p-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="flex-1 text-xs"
            onClick={selectAll}
            data-testid="button-select-all-countries"
          >
            Select All
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="flex-1 text-xs"
            onClick={clearAll}
            data-testid="button-clear-all-countries"
          >
            Clear All
          </Button>
        </div>
        <DropdownMenuSeparator />
        {availableCountries.map(country => (
          <DropdownMenuItem
            key={country.code}
            onClick={() => toggleCountry(country.code)}
            className="cursor-pointer"
            data-testid={`menu-item-country-${country.code}`}
          >
            <div className="flex items-center gap-3 w-full">
              <span className="text-lg">{country.flag}</span>
              <span className="flex-1">{country.name}</span>
              {selectedCountries.includes(country.code) && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CountryBadges({ countries, max = 3 }: { countries: string[], max?: number }) {
  const displayCountries = countries.slice(0, max);
  const remaining = countries.length - max;

  return (
    <div className="flex flex-wrap gap-1">
      {displayCountries.map(code => {
        const country = COUNTRIES.find(c => c.code === code);
        return country ? (
          <Badge 
            key={code} 
            variant="secondary" 
            className="text-xs"
            data-testid={`badge-country-${code}`}
          >
            <span className="mr-1">{country.flag}</span>
            {country.code}
          </Badge>
        ) : null;
      })}
      {remaining > 0 && (
        <Badge variant="outline" className="text-xs">
          +{remaining}
        </Badge>
      )}
    </div>
  );
}
