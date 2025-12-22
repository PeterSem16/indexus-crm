import { createContext, useContext, useState, useEffect } from "react";
import { COUNTRIES, type CountryCode } from "@/lib/countries";
import { useAuth } from "@/contexts/auth-context";

interface CountryFilterContextType {
  selectedCountries: CountryCode[];
  setSelectedCountries: (countries: CountryCode[]) => void;
  toggleCountry: (code: CountryCode) => void;
  selectAll: () => void;
  clearAll: () => void;
  availableCountries: typeof COUNTRIES;
}

const CountryFilterContext = createContext<CountryFilterContextType | undefined>(undefined);

export function CountryFilterProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  
  // Get user's assigned countries or all countries if admin/no user
  const userCountryCodes = user?.assignedCountries as CountryCode[] || [];
  const availableCountries = userCountryCodes.length > 0
    ? COUNTRIES.filter(c => userCountryCodes.includes(c.code))
    : COUNTRIES;
  
  const [selectedCountries, setSelectedCountries] = useState<CountryCode[]>([]);

  // Update selected countries when user changes
  useEffect(() => {
    if (availableCountries.length > 0) {
      setSelectedCountries(availableCountries.map(c => c.code));
    }
  }, [user?.id, userCountryCodes.join(',')]);

  const toggleCountry = (code: CountryCode) => {
    setSelectedCountries(prev => 
      prev.includes(code) 
        ? prev.filter(c => c !== code)
        : [...prev, code]
    );
  };

  const selectAll = () => {
    setSelectedCountries(availableCountries.map(c => c.code));
  };

  const clearAll = () => {
    setSelectedCountries([]);
  };

  return (
    <CountryFilterContext.Provider value={{
      selectedCountries,
      setSelectedCountries,
      toggleCountry,
      selectAll,
      clearAll,
      availableCountries,
    }}>
      {children}
    </CountryFilterContext.Provider>
  );
}

export function useCountryFilter() {
  const context = useContext(CountryFilterContext);
  if (!context) {
    throw new Error("useCountryFilter must be used within a CountryFilterProvider");
  }
  return context;
}
