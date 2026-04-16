import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { REGIONS_BY_COUNTRY, getDistrictsForRegion } from "@/lib/regions";

interface SuggestRegionButtonProps {
  countryCode: string;
  city: string;
  streetNumber?: string;
  postalCode?: string;
  onSuggestion: (region: string, district: string) => void;
  disabled?: boolean;
  size?: "sm" | "default" | "icon";
}

export function SuggestRegionButton({
  countryCode,
  city,
  streetNumber,
  postalCode,
  onSuggestion,
  disabled = false,
  size = "sm",
}: SuggestRegionButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSuggest = async () => {
    if (!countryCode || !city?.trim()) {
      toast({
        title: "Chýba mesto",
        description: "Zadajte najprv krajinu a mesto",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch("/api/suggest-region-district", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ countryCode, city: city.trim(), streetNumber, postalCode }),
      });

      if (!resp.ok) throw new Error("Failed to get suggestion");

      const data = await resp.json();
      const { region, district, confidence } = data;

      const availableRegions = REGIONS_BY_COUNTRY[countryCode] || [];
      const matchedRegion = availableRegions.find(
        (r: string) => r.toLowerCase() === region?.toLowerCase()
      ) || region || "";

      let matchedDistrict = district || "";
      if (matchedRegion) {
        const availableDistricts = getDistrictsForRegion(countryCode, matchedRegion);
        if (availableDistricts.length > 0) {
          matchedDistrict = availableDistricts.find(
            (d: string) => d.toLowerCase() === district?.toLowerCase()
          ) || matchedDistrict;
        }
      }

      onSuggestion(matchedRegion, matchedDistrict);

      toast({
        title: "Návrh regiónu",
        description: `${matchedRegion}${matchedDistrict ? ` / ${matchedDistrict}` : ""} (${confidence})`,
      });
    } catch (err) {
      toast({
        title: "Chyba",
        description: "Nepodarilo sa získať návrh",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (size === "icon") {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handleSuggest}
        disabled={disabled || loading || !city?.trim()}
        className="h-8 w-8 shrink-0"
        title="AI návrh regiónu a okresu"
        data-testid="button-suggest-region"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      onClick={handleSuggest}
      disabled={disabled || loading || !city?.trim()}
      className="gap-1.5"
      data-testid="button-suggest-region"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
      AI návrh
    </Button>
  );
}
